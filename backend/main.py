from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import fitz  # PyMuPDF
import bcrypt
import os
import json
from dotenv import load_dotenv

load_dotenv()

from ai_engine import process_document, critique_user_answer
from news_scraper import scrape_news
import database
import asyncio
from datetime import datetime, timezone
from fastapi import Header, Depends

app = FastAPI(title="UPSC Intelligence Hub API")

# Simple Security: Verify if the email belongs to an existing user
async def verify_officer(x_officer_email: str = Header(None)):
    if not x_officer_email:
        raise HTTPException(status_code=401, detail="Authentication required: X-Officer-Email header missing")
    
    user = await asyncio.to_thread(database.get_user, x_officer_email)
    if not user:
        raise HTTPException(status_code=403, detail="Access denied: Not a registered officer")
    return x_officer_email

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
        
    # Scraping is a blocking network call
    result = await asyncio.to_thread(scrape_news, url)
    if "error" in result:
        return {"error": result["error"]}
    
    try:
        # Analysis can take 10s+
        print(f"🕵️  Analyzing content from {url}...", flush=True)
        ai_result = await asyncio.to_thread(process_document, text=result["content"])
        
        if isinstance(ai_result, list) and len(ai_result) > 0:
            article = ai_result[0]
            from urllib.parse import urlparse
            article["source"] = urlparse(url).hostname or "Web Source"
            article["ingested_at"] = datetime.now(timezone.utc).isoformat()
            article["content"] = result["content"] # Ensure raw content is preserved for frontend
            if "id" not in article:
                import time, random
                article["id"] = f"art_{int(time.time())}_{random.randint(100,999)}"
            await asyncio.to_thread(database.save_article, article)
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
