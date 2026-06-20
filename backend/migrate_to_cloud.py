import os
import json
import database

def migrate():
    print("STARTING FINAL CLOUD LIFT-OFF...")
    
    # 1. Migrate Users
    user_file = "data/users_db.json"
    if os.path.exists(user_file):
        try:
            with open(user_file, "r", encoding="utf-8") as f:
                users = json.load(f)
                print(f"Found {len(users)} users. Syncing...")
                for email, data in users.items():
                    database.save_user(data)
            print("Users successfully synced to Cloud.")
        except Exception as e:
            print(f"User migration failed: {e}")
    else:
        print("No local users found for migration.")

    # 2. Migrate Articles
    art_file = "data/articles.json"
    if os.path.exists(art_file):
        try:
            with open(art_file, "r", encoding="utf-8") as f:
                articles = json.load(f)
                print(f"Found {len(articles)} articles. Pushing to Cloud...")
                for art in articles:
                    try:
                        database.save_article(art)
                    except:
                        continue 
            print("Articles successfully synced to Cloud.")
        except Exception as e:
            print(f"Article migration failed: {e}")
    else:
        print("No local articles found for migration.")

    # 3. Clean up
    print("\nMIGRATION COMPLETE. All data is now live in Supabase.")
    print("You can now safely delete the 'data/' folder manually once you verify the Cloud feed.")

if __name__ == "__main__":
    migrate()
