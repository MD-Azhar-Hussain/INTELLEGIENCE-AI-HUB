from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import fitz  # PyMuPDF
import bcrypt
import os
import json
from dotenv import load_dotenv

load_dotenv()

import sys
import builtins
def safe_print(*args, **kwargs):
    encoding = sys.stdout.encoding or 'utf-8'
    safe_args = []
    for arg in args:
        if isinstance(arg, str):
            safe_args.append(arg.encode(encoding, errors='replace').decode(encoding))
        else:
            safe_args.append(arg)
    builtins.print(*safe_args, **kwargs)

print = safe_print

from ai_engine import process_document, critique_user_answer, scan_newspaper_page, process_newspaper_article
from news_scraper import scrape_news
import database
import asyncio
import uuid
from datetime import datetime, timezone
from fastapi import Header, Depends

# ── Newspaper page-session store ──────────────────────────────────────────────
# Stores {session_id: {"pages": [bytes, ...], "expires_at": float}}
# Pages are raw PNG bytes per page, held for 10 minutes between Phase 1 and Phase 2.
import time as _time
_NEWSPAPER_SESSIONS: dict = {}
_SESSION_TTL_SECONDS = 1800  # 30 minutes

def _cleanup_sessions():
    """Remove expired newspaper sessions to free memory."""
    now = _time.time()
    expired = [k for k, v in _NEWSPAPER_SESSIONS.items() if v["expires_at"] < now]
    for k in expired:
        del _NEWSPAPER_SESSIONS[k]
        print(f"🗑️ Expired newspaper session {k[:8]} removed.", flush=True)

app = FastAPI(title="UPSC Intelligence Hub API")

# Simple Security: Verify if the email belongs to an existing user
async def verify_officer(x_officer_email: str = Header(None)):
    if not x_officer_email:
        raise HTTPException(status_code=401, detail="Authentication required: X-Officer-Email header missing")
    
    user = await asyncio.to_thread(database.get_user, x_officer_email)
    if not user:
        raise HTTPException(status_code=403, detail="Access denied: Not a registered officer")
    return x_officer_email

# Admin Power House Security
async def verify_admin(x_officer_email: str = Header(None)):
    email = await verify_officer(x_officer_email)
    user = await asyncio.to_thread(database.get_user, email)
    
    # Check if user has explicit admin role OR is in the master admin list
    # Tip: You can change the email below to your own email to grant yourself access
    ADMIN_EMAILS = ["admin@gmail.com", "tempmailer0099@gmail.com", "azhar@example.com"] 
    if not user or (user.get("role") != "admin" and email not in ADMIN_EMAILS):
        raise HTTPException(status_code=403, detail="Strategic Clearance Level 2 required: Admin access denied")
    return email


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "ok", "message": "Strategic Intelligence API Active"}

# --- AUTHENTICATION ---

@app.post("/register")
async def register(payload: dict):
    name, email, password = payload.get("name"), payload.get("email"), payload.get("password")
    if not all([name, email, password]):
        raise HTTPException(status_code=400, detail="Missing essential credentials")
    
    existing = await asyncio.to_thread(database.get_user, email)
    if existing:
        raise HTTPException(status_code=400, detail="Officer already enlisted")
    
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    user_data = {
        "name": name, 
        "email": email, 
        "password_hash": hashed.decode('utf-8'), 
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await asyncio.to_thread(database.save_user, user_data)
    return {"message": "Success", "user": {"name": name, "email": email}}

@app.post("/login")
async def login(payload: dict):
    email, password = payload.get("email"), payload.get("password")
    stored_user = await asyncio.to_thread(database.get_user, email)
    if not stored_user or not bcrypt.checkpw(password.encode('utf-8'), stored_user["password_hash"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"message": "Success", "user": {"name": stored_user["name"], "email": email}}

# --- INTELLIGENCE FEED ---

@app.get("/articles")
async def get_articles_feed():
    return await asyncio.to_thread(database.get_articles)

@app.get("/user/progress")
async def get_progress(email: str):
    return await asyncio.to_thread(database.get_user_progress, email)

@app.post("/user/progress/toggle")
async def toggle_progress(payload: dict, officer: str = Depends(verify_officer)):
    email, article_id, field, value = payload.get("email"), payload.get("article_id"), payload.get("field"), payload.get("value")
    await asyncio.to_thread(database.update_user_progress, email, article_id, field, value)
    return {"status": "ok"}

@app.post("/migrate-article")
async def migrate_article(payload: dict, officer: str = Depends(verify_officer)):
    await asyncio.to_thread(database.save_article, payload)
    return {"status": "ok"}

# --- INGESTION ---

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...), officer: str = Depends(verify_officer)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    try:
        content = await file.read()
        # PDF processing is CPU heavy, thread it
        def extract_text():
            doc = fitz.open(stream=content, filetype="pdf")
            text = "".join(page.get_text() for page in doc)
            doc.close()
            return text
        
        text = await asyncio.to_thread(extract_text)
        result = await asyncio.to_thread(process_document, text=text, pdf_bytes=content)

        if isinstance(result, list):
            import time, random
            for art in result:
                if "id" not in art:
                    art["id"] = f"art_{int(time.time())}_{random.randint(100,999)}"
                await asyncio.to_thread(database.save_article, art)
        elif isinstance(result, dict) and "error" not in result:
            if "id" not in result:
                import time, random
                result["id"] = f"art_{int(time.time())}_{random.randint(100,999)}"
            await asyncio.to_thread(database.save_article, result)

        return {"filename": file.filename, "articles": result}
    except Exception as e:
        print(f"❌ Upload Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/import-news")
async def import_news(payload: dict, officer: str = Depends(verify_officer)):
    url = payload.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
        
    # 1. Check duplicate by URL first (before scraping)
    existing = await asyncio.to_thread(database.check_duplicate, url=url)
    if existing:
        print(f"♻️  Duplicate detected by URL: {url}. Returning cached article.", flush=True)
        existing["url"] = url
        return existing

    print(f"🌐 Scraping URL: {url}...", flush=True)
    # Scraping is a blocking network call
    result = await asyncio.to_thread(scrape_news, url)
    if "error" in result:
        return {"error": result["error"]}
    
    # 2. Check duplicate by Scraped Title (before AI analysis)
    title = result.get("title")
    if title:
        existing_by_title = await asyncio.to_thread(database.check_duplicate, title=title)
        if existing_by_title:
            print(f"♻️  Duplicate detected by Title: {title}. Returning cached article.", flush=True)
            # Update the URL (filename field) in the database for direct URL matching next time
            if not existing_by_title.get("filename") or existing_by_title.get("filename") != url:
                existing_by_title["filename"] = url
                await asyncio.to_thread(database.save_article, existing_by_title)
            existing_by_title["url"] = url
            return existing_by_title

    try:
        print(f"🕵️  Analyzing content from {url}...", flush=True)
        # Analysis can take 10s+; web_import=True promotes Groq to Phase 0
        ai_result = await asyncio.to_thread(process_document, text=result["content"], web_import=True)
        
        if isinstance(ai_result, list) and len(ai_result) > 0:
            article = ai_result[0]
            from urllib.parse import urlparse
            article["source"] = urlparse(url).hostname or "Web Source"
            article["ingested_at"] = datetime.now(timezone.utc).isoformat()
            article["content"] = result["content"] # Ensure raw content is preserved for frontend
            article["filename"] = url # Store the full URL in filename column for URL-based deduplication
            if "id" not in article:
                import time, random
                article["id"] = f"art_{int(time.time())}_{random.randint(100,999)}"
            await asyncio.to_thread(database.save_article, article)
            article["url"] = url
            return article
        elif isinstance(ai_result, dict) and "error" in ai_result:
            print(f"⚠️  AI Analysis Failed: {ai_result['error']}")
            return {"error": "AI could not parse this article", "raw": result}
    except Exception as ai_err:
        print(f"❌ AI Critical Error: {ai_err}")


    # Fallback
    if "id" not in result:
        import time, random
        result["id"] = f"web_{int(time.time())}_{random.randint(100,999)}"
    return result

@app.post("/analyze-text")
async def analyze_text(payload: dict, officer: str = Depends(verify_officer)):
    text = payload.get("text")
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Text content is required and cannot be empty")
    
    result = await asyncio.to_thread(process_document, text=text)
    if isinstance(result, list):
        for art in result:
            art["ingested_at"] = datetime.now(timezone.utc).isoformat()
            await asyncio.to_thread(database.save_article, art)
    elif isinstance(result, dict) and "error" not in result:
        result["ingested_at"] = datetime.now(timezone.utc).isoformat()
        await asyncio.to_thread(database.save_article, result)
    
    return {"articles": result}

@app.post("/critique-answer")
async def critique_answer(payload: dict):
    question, user_answer, context = payload.get("question"), payload.get("user_answer"), payload.get("context", "")
    if not question or not user_answer:
        raise HTTPException(status_code=400, detail="Missing question or answer")
        
    result = await asyncio.to_thread(critique_user_answer, question, user_answer, context)
    if "error" in result:
        return {"error": result["error"]}
    return result

# --- ADMIN POWER HOUSE ---

@app.get("/admin/stats")
async def admin_stats(admin: str = Depends(verify_admin)):
    return await asyncio.to_thread(database.get_admin_stats)

@app.get("/admin/duplicates")
async def detect_duplicates(admin: str = Depends(verify_admin)):
    """Analyze the intelligence feed for overlapping or redundant assets."""
    articles = await asyncio.to_thread(database.get_articles)
    seen_titles = {}
    duplicates = []
    
    for a in articles:
        title = a.get("title", "").lower().strip()
        if not title: continue
        
        # Simple Title Matching for efficiency
        if title in seen_titles:
            duplicates.append({
                "original": seen_titles[title],
                "duplicate": a
            })
        else:
            seen_titles[title] = a
            
    return {"duplicate_count": len(duplicates), "clusters": duplicates}

@app.delete("/admin/article/{article_id}")
async def admin_delete_article(article_id: str, admin: str = Depends(verify_admin)):
    success = await asyncio.to_thread(database.delete_article, article_id)
    if not success:
        raise HTTPException(status_code=404, detail="Asset not found or already purged")
    return {"message": "Strategic asset successfully purged from global intelligence feed"}


# ─────────────────────────────────────────────────────────────────────────────
# NEWSPAPER — Phase 1a: Upload PDF & render to page images (NO AI calls, fast)
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/scan-newspaper")
async def scan_newspaper(file: UploadFile = File(...), officer: str = Depends(verify_officer)):
    """Fast upload endpoint: renders each PDF page to a JPEG and stores in session.
    Checks MD5 file hash against database to identify if already ingested.
    If already ingested, returns already_ingested: true and skips OCR scan."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted for newspaper scanning.")

    try:
        content = await file.read()
        if len(content) > 50 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="PDF is too large. Please keep it under 50MB.")

        # --- Step A: Calculate file hash & check deduplication ---
        import hashlib
        file_hash = hashlib.md5(content).hexdigest()

        # Check if articles with filename starting with hash:{file_hash}__ exist in Supabase
        already_ingested = False
        existing_articles = []
        if database.supabase:
            try:
                # Query articles where filename matches hash:file_hash__%
                response = database.supabase.table("articles").select("*").like("filename", f"hash:{file_hash}__%").execute()
                if response.data:
                    existing_articles = response.data
                    already_ingested = True
                    print(f"🔗 deduplication: file {file.filename} matches hash {file_hash} (found {len(existing_articles)} articles). Bypassing scan.", flush=True)
            except Exception as e:
                print(f"⚠️ Deduplication database check failed: {e}", flush=True)

        if already_ingested:
            # Reconstruct the checklist grouping from existing database articles
            import re
            pages_map = {}
            for art in existing_articles:
                source_str = art.get("source", "")
                # Default to page 1 if not parsed
                page_num = 1
                page_match = re.search(r"Page\s+(\d+)", source_str, re.IGNORECASE)
                if page_match:
                    page_num = int(page_match.group(1))

                if page_num not in pages_map:
                    pages_map[page_num] = []

                summary_list = art.get("summary", [])
                excerpt = summary_list[0] if summary_list else "UPSC Ingested intelligence asset."
                
                # Strip out syllabus mapping prefix from keywords to display clean keywords on the front checklist if any
                clean_keywords = [k for k in art.get("keywords", []) if not k.startswith("syllabus:")]
                
                pages_map[page_num].append({
                    "headline": art.get("title", "Untitled"),
                    "excerpt": excerpt,
                    "relevance_score": art.get("relevance_score", 75),
                    "category": art.get("category", "General")
                })

            scanned_pages = []
            for pNum in sorted(pages_map.keys()):
                scanned_pages.append({
                    "page": pNum,
                    "page_index": pNum - 1,
                    "stories": pages_map[pNum]
                })

            total_p = max(pages_map.keys()) if pages_map else 1

            return {
                "session_id": f"duplicate_{file_hash}",
                "filename": file.filename,
                "total_pages": total_p,
                "already_ingested": True,
                "pages": scanned_pages
            }

        # --- Step B: Render PDF pages to images (if not deduplicated) ---
        def render_pages() -> list:
            import fitz
            doc = fitz.open(stream=content, filetype="pdf")
            pages = []
            for page in doc:
                # 100 DPI is sufficient for vision AI + JPEG keeps payload ~300-700KB
                mat = fitz.Matrix(100 / 72, 100 / 72)
                pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
                pages.append(pix.tobytes("jpeg"))
            doc.close()
            return pages

        print(f"📰 Rendering PDF: {file.filename}...", flush=True)
        page_images: list[bytes] = await asyncio.to_thread(render_pages)
        total_pages = len(page_images)

        _cleanup_sessions()
        session_id = str(uuid.uuid4())
        _NEWSPAPER_SESSIONS[session_id] = {
            "pages": page_images,
            "filename": file.filename,
            "file_hash": file_hash,
            "expires_at": _time.time() + _SESSION_TTL_SECONDS
        }

        print(f"✅ Session {session_id[:8]} created: {total_pages} pages rendered and ready.", flush=True)
        return {
            "session_id": session_id,
            "filename": file.filename,
            "total_pages": total_pages,
            "already_ingested": False
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Newspaper upload error: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"PDF upload failed: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# NEWSPAPER — Phase 1b: Scan ONE page for headlines (one AI call per request)
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/scan-page")
async def scan_page_endpoint(payload: dict, officer: str = Depends(verify_officer)):
    """Scans a single page from a session for article headlines using Gemini Vision.
    Called by the frontend once per page — enables live page-by-page progress UI."""
    session_id = payload.get("session_id")
    page_index = payload.get("page_index")

    if not session_id or page_index is None:
        raise HTTPException(status_code=400, detail="session_id and page_index are required.")

    session = _NEWSPAPER_SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found. Please re-upload the newspaper.")

    if _time.time() > session["expires_at"]:
        _NEWSPAPER_SESSIONS.pop(session_id, None)
        raise HTTPException(status_code=410, detail="Session expired. Please re-upload.")

    pages = session["pages"]
    if page_index >= len(pages):
        raise HTTPException(status_code=400, detail=f"page_index {page_index} out of range (PDF has {len(pages)} pages).")

    page_bytes = pages[page_index]
    print(f"🔍 Scanning page {page_index + 1} of {len(pages)} for session {session_id[:8]}...", flush=True)

    try:
        stories = await asyncio.to_thread(scan_newspaper_page, page_bytes)
        print(f"✅ Page {page_index + 1}: {len(stories)} stories found.", flush=True)
        return {
            "page": page_index + 1,
            "page_index": page_index,
            "stories": stories
        }
    except Exception as e:
        print(f"❌ Page {page_index + 1} scan error: {e}", flush=True)
        # Return empty instead of 500 — frontend skips pages with no stories
        return {"page": page_index + 1, "page_index": page_index, "stories":[]}


# ─────────────────────────────────────────────────────────────────────────────
# NEWSPAPER INGESTION — Phase 2: Deep UPSC analysis for one selected article
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/ingest-newspaper-article")
async def ingest_newspaper_article(payload: dict, officer: str = Depends(verify_officer)):
    """Phase 2: Deep UPSC analysis of a single selected newspaper article.
    Uses the stored page image from the session + the selected headline."""
    session_id = payload.get("session_id")
    page_index = payload.get("page_index")
    headline = payload.get("headline", "").strip()

    if not session_id or page_index is None or not headline:
        raise HTTPException(status_code=400, detail="session_id, page_index and headline are required.")

    session = _NEWSPAPER_SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session expired or not found. Please re-upload the newspaper.")

    if _time.time() > session["expires_at"]:
        del _NEWSPAPER_SESSIONS[session_id]
        raise HTTPException(status_code=410, detail="Session expired. Please re-upload the newspaper.")

    pages = session["pages"]
    if page_index >= len(pages):
        raise HTTPException(status_code=400, detail=f"page_index {page_index} out of range (PDF has {len(pages)} pages).")

    page_bytes = pages[page_index]
    filename = session.get("filename", "newspaper")

    print(f"🚀 Ingesting article: '{headline}' from page {page_index + 1} of '{filename}'...", flush=True)

    try:
        result = await asyncio.to_thread(process_newspaper_article, page_bytes, headline)

        if isinstance(result, list) and len(result) > 0:
            import time, random
            article = result[0]
            newspaper_title = filename.replace(".pdf", "").replace("_", " ").title()
            article["source"] = f"{newspaper_title} — Page {page_index + 1}"
            
            file_hash = session.get("file_hash")
            if file_hash:
                article["filename"] = f"hash:{file_hash}__:{filename}"
            else:
                article["filename"] = filename

            article["ingested_at"] = datetime.now(timezone.utc).isoformat()
            if "id" not in article:
                article["id"] = f"news_{int(time.time())}_{random.randint(100,999)}"
            await asyncio.to_thread(database.save_article, article)
            print(f"✅ Article saved: {article.get('title', headline)}", flush=True)
            return article

        elif isinstance(result, dict) and "error" in result:
            raise HTTPException(status_code=500, detail=f"AI analysis failed: {result['error']}")

        raise HTTPException(status_code=500, detail="Unexpected response from AI engine.")

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Newspaper ingest error: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
