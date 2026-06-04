from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import fitz  # PyMuPDF
from ai_engine import process_document
from news_scraper import scrape_news
from database import save_article

app = FastAPI(title="UPSC Intelligence Hub API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "ok", "message": "UPSC Intelligence Hub API is running"}

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    try:
        content = await file.read()
        doc = fitz.open(stream=content, filetype="pdf")
        # Try text extraction first
        text = ""
        for page in doc:
            text += page.get_text()
        
        # If text is very short or empty, it's likely a scanned image
        # We pass both: the text (if any) and the raw bytes for Multimodal OCR
        result = process_document(text=text, pdf_bytes=content)
        
        doc.close()

        # If the AI returned an error dict, pass it through with a 500 status
        if isinstance(result, dict) and "error" in result:
            raise HTTPException(status_code=500, detail=result.get("details", result["error"]))

        return {
            "filename": file.filename,
            "page_count": len(doc) if not doc.is_closed else "N/A",
            "articles": result
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/import-news")
async def import_news(payload: dict):
    url = payload.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
    
    result = scrape_news(url)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    
    # Store in database
    db_id = save_article(result)
    result["db_id"] = db_id
    
    return result

@app.post("/analyze-text")
async def analyze_text(payload: dict):
    text = payload.get("text")
    title = payload.get("title", "Imported Article")
    
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
    
    try:
        # Pass the text to the same process_document function used for PDFs
        result = process_document(text=text)
        
        if isinstance(result, dict) and "error" in result:
            raise HTTPException(status_code=500, detail=result.get("details", result["error"]))
        
        return {
            "title": title,
            "articles": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        if isinstance(result, dict) and "error" in result:
            raise HTTPException(status_code=500, detail=result.get("details", result["error"]))
        return {"title": title, "articles": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
