import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url, key)

def save_article(article_data: dict):
    # This will save the article and return the id
    # Mocking for now if Supabase is not setup
    try:
        response = supabase.table("articles").insert(article_data).execute()
        return response.data[0]["id"]
    except Exception as e:
        print(f"Database error: {e}")
        return None

def get_articles():
    try:
        response = supabase.table("articles").select("*").order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        print(f"Database error: {e}")
        return []
