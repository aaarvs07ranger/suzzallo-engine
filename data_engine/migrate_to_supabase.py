import os
import json
from dotenv import load_dotenv
from supabase import create_client, Client

# 1. Initialize Supabase Connection
load_dotenv()
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

if not url or not key:
    print("❌ ERROR: Missing SUPABASE_URL or SUPABASE_KEY in .env file.")
    exit(1)

supabase: Client = create_client(url, key)

def run_migration():
    # 2. Find the local JSON database
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    file_path = os.path.join(base_dir, "data", "uw_database_mvp_production.json")
    
    print(f"📖 Loading local database from {file_path}...")
    try:
        with open(file_path, "r") as f:
            db = json.load(f)
    except FileNotFoundError:
        print("❌ ERROR: Could not find production JSON database.")
        return

    print(f"🚀 Pushing {len(db)} course sections to Supabase Cloud...")

    # 3. Clean and format the data for Postgres
    formatted_data = []
    for section in db:
        # We must ensure every row has an SLN to act as the Primary Key
        sln = section.get("sln")
        if not sln:
            continue
            
        formatted_data.append({
            "sln": str(sln),
            "course": section.get("course", "Unknown"),
            "status": section.get("status", "Unknown"),
            "raw_string": section.get("raw_string", ""),
            "instructor": section.get("instructor", "TBA"),
            "real_rmp_rating": str(section.get("real_rmp_rating", "N/A")),
            "real_rmp_difficulty": str(section.get("real_rmp_difficulty", "N/A")),
            "rmp_reviews_count": int(section.get("rmp_reviews_count", 0) if section.get("rmp_reviews_count") != "N/A" else 0)
        })

    # 4. Batch Upsert to Supabase
    # We slice it into batches of 500 to avoid overloading the API
    batch_size = 500
    for i in range(0, len(formatted_data), batch_size):
        batch = formatted_data[i:i + batch_size]
        try:
            data, count = supabase.table('course_sections').upsert(batch).execute()
            print(f"   ✅ Successfully uploaded batch {i} to {i + len(batch)}")
        except Exception as e:
            print(f"   ❌ Error uploading batch: {e}")

    print("🔥 Database migration complete! Suzzallo is in the cloud.")

if __name__ == "__main__":
    run_migration()