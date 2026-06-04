import trafilatura
import json
from ai_engine import process_document
from database import save_article
from pydantic import BaseModel
from typing import Optional, List

class ScrapedArticle(BaseModel):
    title: str
    content: str
    date: Optional[str] = None
    author: Optional[str] = None
    url: str

def scrape_news(url: str):
    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        return {"error": "Could not fetch content from URL"}
    
    # Extract main content
    # output_format='json' gives us metadata too
    result_json = trafilatura.extract(downloaded, output_format='json', include_comments=False, include_tables=True)
    
    if not result_json:
        return {"error": "Could not extract content from webpage"}
    
    data = json.loads(result_json)
    
    # Structure it
    article = ScrapedArticle(
        title=data.get("title", "Untitled"),
        content=data.get("text", ""),
        date=data.get("date"),
        author=data.get("author"),
        url=url
    )
    
    # We can also pass this to the UPSC AI Engine to get the GS Paper mapping and MCQs!
    # The user asked to "Store the article in the database" and "Display in clean reading format".
    # I will return the cleaned article first.
    
    return article.dict()
