import os
from supabase import create_client, Client
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

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_KEY")

if not url or not key:
    print("WARNING: Supabase credentials missing. Database functionality will be disabled.")
    supabase = None
else:
    try:
        supabase: Client = create_client(url, key)
    except Exception as e:
        print(f"FAILED to initialize Supabase: {e}")
        supabase = None

# --- PURE CLOUD ARCHITECTURE ---
# Local JSON databases have been decommissioned for absolute consistency.

def ensure_data_dir():
    if not os.path.exists("data"):
        os.makedirs("data")

def save_article(article_data: dict):
    ensure_data_dir()
    import time, random
    from datetime import datetime, timezone

    # 1. Ensure ID
    if not article_data.get("id"):
        article_data["id"] = f"art_{int(time.time())}_{random.randint(100,999)}"

    # 2. Fix ingested_at
    if not article_data.get("ingested_at") or article_data["ingested_at"] == "now()":
        article_data["ingested_at"] = datetime.now(timezone.utc).isoformat()

    # 3. Clean schema
    list_fields = ["summary", "keywords", "stakeholders", "arguments_for", "arguments_against", "challenges", "way_forward", "mcqs", "mains_questions"]
    for field in list_fields:
        val = article_data.get(field)
        if val is not None and isinstance(val, str): article_data[field] = [val]
        elif val is None: article_data[field] = []

    schema_fields = ["id", "title", "category", "gs_paper", "relevance_score", "primary_keyword", "keywords", "summary", "issue_overview", "background", "stakeholders", "arguments_for", "arguments_against", "challenges", "way_forward", "mcqs", "mains_questions", "source", "ingested_at", "filename"]
    clean_data = {k: v for k, v in article_data.items() if k in schema_fields}
    if "title" not in clean_data: clean_data["title"] = "Untitled Asset"

    # Cloud Upsert (Single Source of Truth)
    if supabase:
        try:
            print(f"☁️ SYNCING TO CLOUD: {clean_data.get('title', 'Asset')[:40]}...", flush=True)
            response = supabase.table("articles").upsert(clean_data, on_conflict="title").execute()
            if response.data: return response.data[0]["id"]
        except Exception as e:
            print(f"❌ CRITICAL CLOUD ERROR: {str(e)}")
            raise Exception("Cloud persistence failed. Local filing is disabled.")
    
    return clean_data.get("id")

def delete_article(article_id: str):
    """Permanently remove an intelligence asset from the Cloud database."""
    if supabase:
        try:
            print(f"🌋 PURGING FROM CLOUD: ID {article_id}...", flush=True)
            response = supabase.table("articles").delete().eq("id", article_id).execute()
            if response.data:
                return True
            else:
                print(f"⚠️ Cloud deletion returned empty data (no rows deleted): {response}", flush=True)
                return False
        except Exception as e:
            print(f"⚠️ Cloud deletion failed: {e}", flush=True)
    return False


def get_articles():
    """Retrieve all intelligence from Supabase. Unified Cloud Index."""
    if supabase:
        try:
            response = supabase.table("articles").select("*").order("ingested_at", desc=True).execute()
            return response.data
        except Exception as e:
            print(f"❌ Cloud retrieval error: {e}")
    return []

def check_duplicate(url: str = None, title: str = None):
    """Check if an article with the same URL (filename) or title already exists in Supabase."""
    if not supabase:
        return None
    try:
        if url:
            response = supabase.table("articles").select("*").eq("filename", url).execute()
            if response.data:
                print(f"🔗 DUPLICATE MATCH BY URL: {url}", flush=True)
                return response.data[0]
        
        if title:
            response = supabase.table("articles").select("*").ilike("title", title.strip()).execute()
            if response.data:
                print(f"📖 DUPLICATE MATCH BY TITLE: {title}", flush=True)
                return response.data[0]
    except Exception as e:
        print(f"⚠️ Error checking duplicate article: {e}", flush=True)
    return None


def save_user(user_data: dict):
    if supabase:
        try:
            supabase.table("users").upsert(user_data, on_conflict="email").execute()
        except Exception as e:
            print(f"⚠️ Cloud user save failed: {e}")

def get_user(email: str):
    """Cloud-only user lookup."""
    if supabase:
        try:
            response = supabase.table("users").select("*").eq("email", email).execute()
            if response.data:
                return response.data[0]
        except Exception as e:
            print(f"⚠️ Cloud user lookup failed: {e}")
    return None

PROG_DB = "data/progress.json"

def get_user_progress(email: str):
    progress_map = {}
    if supabase:
        try:
            response = supabase.table("user_progress").select("*").eq("user_email", email).execute()
            for item in response.data:
                progress_map[item["article_id"]] = {
                    "is_important": item.get("is_important", False),
                    "is_completed": item.get("is_completed", False)
                }
            return progress_map
        except:
            pass
    return {}

def update_user_progress(email: str, article_id: str, field: str, value: bool):
    if supabase:
        try:
            payload = {"user_email": email, "article_id": article_id, field: value}
            supabase.table("user_progress").upsert(payload, on_conflict="user_email,article_id").execute()
        except:
            pass

def get_admin_stats():
    """Aggregate core system metrics for the Power House console."""
    stats = {
        "total_articles": 0,
        "total_users": 0,
        "active_engagements": 0
    }

    if not supabase: return stats

    try:
        # 1. Total Articles
        art_res = supabase.table("articles").select("id", count="exact").execute()
        stats["total_articles"] = art_res.count if art_res.count is not None else 0
        
        # 2. Total Users
        user_res = supabase.table("users").select("email", count="exact").execute()
        stats["total_users"] = user_res.count if user_res.count is not None else 0
        
        # 3. Engagement (progress count)
        prog_res = supabase.table("user_progress").select("id", count="exact").execute()
        stats["active_engagements"] = prog_res.count if prog_res.count is not None else 0
        
        return stats
    except Exception as e:
        print(f"⚠️ Cloud stats failure: {e}")
        return stats
