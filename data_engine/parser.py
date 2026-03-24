from bs4 import BeautifulSoup
import json

def parse_local_dump():
    print("🔍 Booting up the local Data Structurer...")
    
    try:
        with open("uw_raw_dump.html", "r", encoding="utf-8") as f:
            html_content = f.read()
    except FileNotFoundError:
        print("❌ Could not find uw_raw_dump.html.")
        return

    soup = BeautifulSoup(html_content, 'html.parser')
    
    database = []
    current_course = None
    
    for tag in soup.find_all(['table', 'pre']):
        
        # 1. Identify the Course Header (e.g., "CSE 121")
        if tag.name == 'table' and tag.get('bgcolor') == '#99ccff':
            # FIXED: Use attrs dictionary to avoid the reserved 'name' keyword clash
            header_link = tag.find('a', attrs={'name': True})
            if header_link:
                current_course = " ".join(header_link.text.split())
                
        # 2. Extract the Section Data
        elif tag.name == 'pre' and current_course:
            sln_link = tag.find('a', href=lambda href: href and 'SLN=' in href)
            
            if sln_link:
                sln = sln_link.text.strip()
                
                # Clean up the chaotic spacing from the <pre> tag
                raw_text = " ".join(tag.text.split())
                
                # Determine status
                status = "Open" if " Open " in raw_text else "Closed" if " Closed " in raw_text else "Unknown"
                
                database.append({
                    "course": current_course,
                    "sln": sln,
                    "status": status,
                    "raw_string": raw_text
                })

    print(f"✅ Successfully structured {len(database)} class sections.")
    
    with open("uw_database_mvp.json", "w") as f:
        json.dump(database, f, indent=2)
        
    print("💾 Database saved to 'uw_database_mvp.json'.")
    
    if database:
        print("\n--- First 3 Entries in your new Database ---")
        print(json.dumps(database[:3], indent=2))

if __name__ == "__main__":
    parse_local_dump()