import json
import random
import os

def enrich_database():
    # 1. Dynamically find the absolute path to the 'suzzallo' root directory
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # 2. Point to the database (Assuming we saved it in the 'data' folder during Phase 1)
    file_path = os.path.join(base_dir, "data", "uw_database_mvp.json")
    
    # Fallback: If it's actually in the root folder, use this instead:
    if not os.path.exists(file_path):
        file_path = os.path.join(base_dir, "uw_database_mvp.json")

    print(f"📖 Loading database from {file_path}...")
    
    try:
        with open(file_path, "r") as f:
            db = json.load(f)
    except FileNotFoundError:
        print(f"❌ ERROR: Could not find uw_database_mvp.json at {file_path}")
        return
        
    print("✨ Enriching data with the Vibe Matrix...")
    
    for section in db:
        # Give a random RMP score between 2.0 and 5.0
        score = round(random.uniform(2.0, 5.0), 1)
        
        # Give a random hours-per-week estimate
        if "311" in section.get("course_code", "") or "332" in section.get("course_code", ""):
            hours = random.randint(12, 20)
        else:
            hours = random.randint(5, 12)
            
        section["instructor_rmp_score"] = score
        section["estimated_hours_per_week"] = hours

    # Save the enriched database right next to the original
    output_path = file_path.replace(".json", "_enriched.json")
    with open(output_path, "w") as f:
        json.dump(db, f, indent=4)
        
    print(f"✅ Enriched database saved to {output_path}")

if __name__ == "__main__":
    enrich_database()