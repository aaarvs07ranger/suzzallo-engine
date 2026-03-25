import requests
import json
import os
import time
import re

# RateMyProfessor's internal GraphQL endpoint and public authorization token
RMP_URL = "https://www.ratemyprofessors.com/graphql"
AUTH_TOKEN = "Basic dGVzdDp0ZXN0" 
UW_SCHOOL_ID = "U2Nob29sLTE0OTU=" 

def extract_instructor(raw_string):
    # Hunt for the classic UW name format: LastName,FirstName
    match = re.search(r'([A-Za-z\-]+),([A-Za-z\-]+)', raw_string)
    if match:
        last_name = match.group(1)
        first_name = match.group(2)
        return f"{first_name} {last_name}"
    return None

def get_real_rmp_data(search_name):
    # Fake a real Chrome browser on a Mac to bypass bot protection
    headers = {
        "Authorization": AUTH_TOKEN,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }

    query = """
    query NewSearchTeachersQuery($text: String!, $schoolID: ID!) {
      newSearch {
        teachers(query: {text: $text, schoolID: $schoolID}, first: 50) {
          edges {
            node {
              firstName
              lastName
              avgRating
              avgDifficulty
              numRatings
            }
          }
        }
      }
    }
    """

    variables = {
        "text": search_name,
        "schoolID": UW_SCHOOL_ID
    }

    try:
        response = requests.post(RMP_URL, json={"query": query, "variables": variables}, headers=headers)
        
        if response.status_code != 200:
            print(f"   ❌ RMP Blocked Request: HTTP {response.status_code}")
            return None
            
        data = response.json()
        teachers = data.get("data", {}).get("newSearch", {}).get("teachers", {}).get("edges", [])
        
        if teachers:
            # THE DUPLICATE FIX: Sort all matching profiles by the number of ratings.
            # Grab the one with the maximum reviews to ignore dead/fake profiles.
            best_match = max(teachers, key=lambda edge: edge["node"].get("numRatings", 0))
            node = best_match["node"]
            
            return {
                "rating": node.get("avgRating", 0),
                "difficulty": node.get("avgDifficulty", 0),
                "num_ratings": node.get("numRatings", 0)
            }
    except Exception as e:
        print(f"   ⚠️ Connection Error: {e}")
    
    return None

def run_real_enricher():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    file_path = os.path.join(base_dir, "data", "uw_database_mvp.json")
    
    if not os.path.exists(file_path):
        file_path = os.path.join(base_dir, "uw_database_mvp.json")

    print(f"📖 Loading MVP database from {file_path}...")
    with open(file_path, "r") as f:
        db = json.load(f)

    print("🚀 Initiating Live RateMyProfessor GraphQL Hijack...")
    
    prof_cache = {}

    for section in db:
        raw_string = section.get("raw_string", "")
        
        # 1. Extract the name using our Regex engine
        instructor = extract_instructor(raw_string)
        
        if not instructor:
            continue
            
        # 2. Inject the clean name back into the database
        section["instructor"] = instructor

        # 3. Hit the RMP API (using cache to avoid redundant hits)
        if instructor not in prof_cache:
            print(f"🔍 Searching RMP for: {instructor}...")
            rmp_data = get_real_rmp_data(instructor)
            prof_cache[instructor] = rmp_data
            time.sleep(0.4) # Throttle to avoid IP ban
            
        data = prof_cache[instructor]
        if data and data["num_ratings"] > 0:
            section["real_rmp_rating"] = data["rating"]
            section["real_rmp_difficulty"] = data["difficulty"]
            section["rmp_reviews_count"] = data["num_ratings"]
            print(f"   ✅ Found: {instructor} -> {data['rating']}/5.0 (Diff: {data['difficulty']}, Reviews: {data['num_ratings']})")
        else:
            section["real_rmp_rating"] = "N/A"
            section["real_rmp_difficulty"] = "N/A"

    output_path = file_path.replace(".json", "_production.json")
    with open(output_path, "w") as f:
        json.dump(db, f, indent=4)
        
    print(f"\n🔥 Production database built and saved to {output_path}")

if __name__ == "__main__":
    run_real_enricher()