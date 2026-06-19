import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

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

import json
LOCAL_DB = "data/articles.json"
USER_DB = "data/users_db.json"

def ensure_data_dir():
    if not os.path.exists("data"):
        os.makedirs("data")

def save_article(article_data: dict):
    ensure_data_dir()
    import time, random
    from datetime import datetime, timezone

    # 1. Ensure absolute ID exists before anything else
    if not article_data.get("id"):
        article_data["id"] = f"art_{int(time.time())}_{random.randint(100,999)}"

    # 2. Fix ingested_at: replace PostgreSQL "now()" string with real ISO timestamp
    if not article_data.get("ingested_at") or article_data["ingested_at"] == "now()":
        article_data["ingested_at"] = datetime.now(timezone.utc).isoformat()

    # 2. Strict Type Enforcement (Fixes Supabase Array Errors)
    # Ensure fields expected as arrays are NOT strings
    list_fields = [
        "summary", "keywords", "stakeholders", "arguments_for", 
        "arguments_against", "challenges", "way_forward", "mcqs", "mains_questions"
    ]
    for field in list_fields:
        val = article_data.get(field)
        if val is not None and isinstance(val, str):
            # If it's a string, try to wrap it or split it
            article_data[field] = [val]
        elif val is None:
            article_data[field] = []

    # 3. Clean schema for Supabase
    schema_fields = [
        "id", "title", "category", "gs_paper", "relevance_score", 
        "primary_keyword", "keywords", "summary", "issue_overview", 
        "background", "stakeholders", "arguments_for", "arguments_against", 
        "challenges", "way_forward", "mcqs", "mains_questions", "source", "ingested_at"
    ]
    clean_data = {k: v for k, v in article_data.items() if k in schema_fields}
    if "title" not in clean_data: clean_data["title"] = "Untitled Asset"

    # Try Cloud Upsert
    cloud_id = None
    if supabase:
        try:
            print(f"☁️  UPSERTING TO CLOUD: {clean_data['title'][:40]}...", flush=True)
            response = supabase.table("articles").upsert(clean_data, on_conflict="title").execute()
            if response.data:
                cloud_id = response.data[0]["id"]
                print(f"✅ CLOUD SUCCESS: ID {cloud_id}")
        except Exception as e:
            print(f"❌ CLOUD DB ERROR: {str(e)}")

    # Local Preservation (Robust Save)
    try:
        articles = get_articles(local_only=True)
        found = False
        for i, a in enumerate(articles):
            if a.get("title") == clean_data.get("title"):
                articles[i] = clean_data
                found = True
                break
        if not found: articles.append(clean_data)
        
        with open(LOCAL_DB, "w", encoding="utf-8") as f:
            json.dump(articles, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"❌ LOCAL SAVE ERROR: {e}")
    
    return cloud_id or clean_data.get("id")

def get_articles(local_only=False):
    ensure_data_dir()
    cloud_articles = []
    if supabase and not local_only:
        try:
            response = supabase.table("articles").select("*").order("ingested_at", desc=True).execute()
            cloud_articles = response.data
        except: pass
    
    local_articles = []
    if os.path.exists(LOCAL_DB):
        try:
            with open(LOCAL_DB, "r", encoding="utf-8") as f:
                local_articles = json.load(f)
        except json.JSONDecodeError:
            print("⚠️ LOCAL DB CORRUPTED. Attempting recovery...", flush=True)
            try:
                with open(LOCAL_DB, "r", encoding="utf-8") as f:
                    content = f.read()
                    # Strip illegal control characters
                    import re
                    cleaned_content = re.sub(r'[\x00-\x1F\x7F]', '', content)
                    local_articles = json.loads(cleaned_content)
                    print("✅ Recovery successful.")
            except:
                print("❌ Recovery failed. Starting with empty local cache.")
                local_articles = []

    # Merge and de-duplicate by title
    titles = {a.get("title") for a in cloud_articles if a.get("title")}
    for a in local_articles:
        if a.get("title") and a["title"] not in titles:
            cloud_articles.append(a)
    
    return cloud_articles

def save_user(user_data: dict):
    ensure_data_dir()
    if supabase:
        try:
            supabase.table("users").upsert(user_data, on_conflict="email").execute()
        except Exception as e:
            print(f"⚠️ Cloud user save failed: {e}")

    # Local save always (source of truth for verify_officer)
    users = {}
    if os.path.exists(USER_DB):
        try:
            with open(USER_DB, "r", encoding="utf-8") as f:
                users = json.load(f)
        except Exception:
            users = {}
    users[user_data["email"]] = user_data
    with open(USER_DB, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2, ensure_ascii=False)

def get_user(email: str):
    """Check cloud first, then local file. Always fall through to local on cloud miss."""
    cloud_user = None
    if supabase:
        try:
            response = supabase.table("users").select("*").eq("email", email).execute()
            if response.data:
                cloud_user = response.data[0]
        except Exception as e:
            print(f"⚠️ Cloud user lookup failed: {e}")

    if cloud_user:
        return cloud_user

    # Always check local file as definitive fallback
    if os.path.exists(USER_DB):
        try:
            with open(USER_DB, "r", encoding="utf-8") as f:
                users = json.load(f)
                return users.get(email)
        except Exception:
            pass
    return None

PROG_DB = "data/progress.json"

def get_user_progress(email: str):
    ensure_data_dir()
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
    
    # Local fallback
    if os.path.exists(PROG_DB):
        with open(PROG_DB, "r") as f:
            all_progress = json.load(f)
            return all_progress.get(email, {})
    return {}

def update_user_progress(email: str, article_id: str, field: str, value: bool):
    ensure_data_dir()
    if supabase:
        try:
            payload = {"user_email": email, "article_id": article_id, field: value}
            supabase.table("user_progress").upsert(payload, on_conflict="user_email,article_id").execute()
        except:
            pass
    
    # Local fallback
    all_progress = {}
    if os.path.exists(PROG_DB):
        with open(PROG_DB, "r") as f:
            all_progress = json.load(f)
    
    if email not in all_progress:
        all_progress[email] = {}
    if article_id not in all_progress[email]:
        all_progress[email][article_id] = {"is_important": False, "is_completed": False}
    
    all_progress[email][article_id][field] = value
    with open(PROG_DB, "w") as f:
        json.dump(all_progress, f, indent=2)
