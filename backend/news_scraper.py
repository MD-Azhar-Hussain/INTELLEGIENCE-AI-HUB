import trafilatura
import json
import requests
from pydantic import BaseModel
from typing import Optional
from bs4 import BeautifulSoup

class ScrapedArticle(BaseModel):
    title: str
    content: str
    date: Optional[str] = None
    author: Optional[str] = None
    url: str

def scrape_news(url: str):
    # Expanded headers to truly mimic a browser
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www.google.com/'
    }
    
    html_content = ""
    try:
        # Use a session to handle cookies (sites like Mint love this)
        session = requests.Session()
        response = session.get(url, headers=headers, timeout=20, allow_redirects=True)
        response.raise_for_status()
        html_content = response.text
    except Exception as e:
        print(f"⚠️ Initial fetch error: {e}")
        # Fallback to trafilatura's direct fetcher
        html_content = trafilatura.fetch_url(url)
    
    if not html_content:
        return {"error": "The source server blocked the request. Please try another source or copy-paste the text manually."}
    
    # 1. Primary Extraction (Trafilatura)
    # include_formatting=True helps preserve paragraph structures
    result_json = trafilatura.extract(html_content, output_format='json', include_comments=False, include_tables=True)
    
    final_content = ""
    title = "Untitled Intelligence"
    date = None
    author = None

    if result_json:
        data = json.loads(result_json)
        final_content = data.get("text", "")
        title = data.get("title", title)
        date = data.get("date")
        author = data.get("author")

    # 2. Fallback Extraction (Manual BS4 + Trafilatura fallback)
    # If Trafilatura (strict) fails, use BS4 to find the article body and try again
    if len(final_content) < 300:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Strip script/style tags
        for script_or_style in soup(["script", "style", "nav", "footer", "header"]):
            script_or_style.decompose()

        # Update title if possible
        if not title or title == "Untitled Intelligence":
            h1 = soup.find('h1')
            if h1: title = h1.get_text().strip()

        # Heuristic: Find the largest text block
        # This works for sites like Mint where content is in specific divs
        content_blocks = []
        for p in soup.find_all(['p', 'article']):
            text = p.get_text().strip()
            if len(text) > 40:
                content_blocks.append(text)
        
        if content_blocks:
            final_content = "\n\n".join(content_blocks)

    # 3. Final Fallback: Simple extraction
    if not final_content:
        final_content = trafilatura.extract(html_content, include_comments=False) or ""

    # Clean up redundant titles if the content starts with the title
    if final_content and title and final_content.startswith(title):
        final_content = final_content[len(title):].strip()

    if len(final_content) < 50:
        return {"error": "Content extraction failed. The website might be using a paywall or a complex JavaScript-only layout."}

    article = ScrapedArticle(
        title=title,
        content=final_content,
        date=date,
        author=author,
        url=url
    )
    
    return article.dict()
