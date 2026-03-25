import re
from itertools import product
from typing import List, Dict

def extract_time(raw: str) -> str:
    """Extracts the 'MWF 930-1020' block from the UW raw string."""
    match = re.search(r'([MTWThF]+)\s+(\d{3,4}-\d{3,4})', raw)
    return match.group(0) if match else "TBA"

def parse_uw_time(time_str: str):
    """Translates UW time format into comparable integer blocks."""
    if not time_str or time_str.upper() == "TBA":
        return []

    day_map = {'M': 1, 'T': 2, 'W': 3, 'Th': 4, 'F': 5}
    parts = time_str.split()
    if len(parts) < 2: return []
        
    days_str, hours_str = parts[0], parts[1]
    days = []
    i = 0
    while i < len(days_str):
        if i + 1 < len(days_str) and days_str[i:i+2] == 'Th':
            days.append(day_map['Th'])
            i += 2
        elif days_str[i] in day_map:
            days.append(day_map[days_str[i]])
            i += 1
        else:
            i += 1
            
    try:
        start_str, end_str = hours_str.split('-')
        start_time, end_time = int(start_str), int(end_str)
        
        if start_time < 800: start_time += 1200
        if end_time < 800: end_time += 1200
        if end_time < start_time: end_time += 1200
    except ValueError:
        return []

    return [{"day": d, "start": start_time, "end": end_time} for d in days]

def time_to_int(time_str: str) -> int:
    """Converts '11:00 AM' from the AI into UW's 1100 format."""
    if not time_str: return 0
    match = re.match(r"(\d+):(\d+)\s*([AP]M)", time_str.upper())
    if not match: return 0
    h, m, ampm = match.groups()
    h, m = int(h), int(m)
    if ampm == "PM" and h < 12: h += 12
    if ampm == "AM" and h == 12: h = 0
    return h * 100 + m

def check_conflict(section_a: Dict, section_b: Dict) -> bool:
    """Returns True if the two sections overlap in time."""
    blocks_a = parse_uw_time(extract_time(section_a.get('raw_string', '')))
    blocks_b = parse_uw_time(extract_time(section_b.get('raw_string', '')))
    
    for a in blocks_a:
        for b in blocks_b:
            if a['day'] == b['day']:
                if a['start'] < b['end'] and b['start'] < a['end']:
                    return True # OVERLAP DETECTED
    return False

def build_schedules(constraints: dict, db: List[dict]):
    """The Core Swarm Engine: Generates, Filters, and Ranks Schedules."""
    desired_courses = constraints.get("desired_courses", [])
    no_classes_before = constraints.get("no_classes_before")
    prioritize_chill = constraints.get("prioritize_chill", False)

    cutoff_time = time_to_int(no_classes_before) if no_classes_before else 0

    # 1. Gather all open sections for the requested courses
    course_pools = {course: [] for course in desired_courses}
    
    for section in db:
        c_name = section.get("course")
        if c_name in desired_courses and section.get("status", "Closed") != "Closed":
            
            # Filter out early classes
            blocks = parse_uw_time(extract_time(section.get('raw_string', '')))
            if blocks and any(b['start'] < cutoff_time for b in blocks):
                continue
                
            course_pools[c_name].append(section)

    # If a requested course has no open sections (or none after 11AM), fail early
    for c, pool in course_pools.items():
        if not pool: 
            return {"error": f"Could not find valid open sections for {c} meeting your constraints."}

    # 2. Cartesian Product: Generate EVERY possible combination
    pools = [course_pools[c] for c in desired_courses]
    all_combinations = list(product(*pools))

    # 3. Filter out Time Conflicts
    valid_schedules = []
    for combo in all_combinations:
        conflict = False
        for i in range(len(combo)):
            for j in range(i + 1, len(combo)):
                if check_conflict(combo[i], combo[j]):
                    conflict = True
                    break
            if conflict: break
        
        if not conflict:
            valid_schedules.append(combo)

    if not valid_schedules:
        return {"error": "Found classes, but they all conflict in time."}

    # 4. Rank the surviving schedules (The Vibe Check)
    def score_schedule(schedule):
        total_rmp = 0
        for sec in schedule:
            rmp = sec.get("real_rmp_rating")
            try:
                total_rmp += float(rmp)
            except (ValueError, TypeError):
                pass # Skip N/A ratings
        return total_rmp

    if prioritize_chill:
        valid_schedules.sort(key=score_schedule, reverse=True)

    # Return the Top 3 mathematically perfect schedules
    return {"top_schedules": valid_schedules[:3], "total_found": len(valid_schedules)}

# --- TEST BLOCK ---
if __name__ == "__main__":
    import json
    import os
    
    # Load the real DB for a local test
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    with open(os.path.join(base_dir, "data", "uw_database_mvp_production.json"), "r") as f:
        db = json.load(f)
        
    # The JSON payload we just got from your cURL command
    test_constraints = {
        "desired_courses": ["CSE 121", "CSE 332"],
        "no_classes_before": "08:00 AM",
        "prioritize_chill": True
    }
    
    print("⚙️ Running Mathematical Solver...")
    result = build_schedules(test_constraints, db)
    
    if "error" in result:
        print(f"❌ {result['error']}")
    else:
        print(f"✅ Found {result['total_found']} valid, non-overlapping schedules.")
        print(f"🏆 Top Ranked Schedule (Combined RMP Score):")
        for section in result['top_schedules'][0]:
            print(f"   - {section['course']} | {extract_time(section['raw_string'])} | Prof: {section.get('instructor', 'TBA')} (RMP: {section.get('real_rmp_rating', 'N/A')})")
