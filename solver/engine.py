import json
import os
import re
from collections import defaultdict
from itertools import product
from typing import Any, Dict, List, Optional, Sequence

DAY_MAP = {"M": 1, "T": 2, "W": 3, "Th": 4, "F": 5}
DAY_LABELS = {value: key for key, value in DAY_MAP.items()}
SECONDARY_TYPES = {"QZ", "LB", "LAB", "SM", "DIS", "WR", "QUIZ"}
STATUS_STOPWORDS = {"OPEN", "CLOSED", "FULL", "IS", "RESTR"}
TIME_RANGE_RE = re.compile(r"^\d{1,4}[APM]?\-\d{1,4}[APM]?$", re.IGNORECASE)
COURSE_CODE_RE = re.compile(r"^([A-Z]{2,5})\s*(\d{3}[A-Z]?)$")


def normalize_course_code(value: str) -> str:
    cleaned = re.sub(r"\s+", "", str(value or "")).upper()
    match = re.match(r"^([A-Z]{2,5})(\d{3}[A-Z]?)$", cleaned)
    if not match:
        return cleaned
    return f"{match.group(1)} {match.group(2)}"


def dedupe(values: Sequence[str]) -> List[str]:
    seen = set()
    ordered: List[str] = []
    for value in values:
        normalized = normalize_course_code(value)
        if normalized and normalized not in seen:
            seen.add(normalized)
            ordered.append(normalized)
    return ordered


def parse_day_string(days_str: str) -> List[int]:
    if not days_str:
        return []

    days: List[int] = []
    i = 0
    while i < len(days_str):
        if days_str[i : i + 2] == "Th":
            days.append(DAY_MAP["Th"])
            i += 2
        elif days_str[i] in DAY_MAP:
            days.append(DAY_MAP[days_str[i]])
            i += 1
        else:
            i += 1
    return days


def looks_like_day_token(token: str) -> bool:
    return bool(parse_day_string(token))


def parse_uw_clock(raw: str) -> Optional[int]:
    if not raw:
        return None

    token = raw.strip().upper()
    suffix = ""
    if token.endswith("AM"):
        suffix = "AM"
        token = token[:-2]
    elif token.endswith("PM"):
        suffix = "PM"
        token = token[:-2]
    elif token.endswith("A"):
        suffix = "AM"
        token = token[:-1]
    elif token.endswith("P"):
        suffix = "PM"
        token = token[:-1]

    digits = re.sub(r"\D", "", token)
    if not digits:
        return None

    value = int(digits)
    if suffix == "PM" and value < 1200:
        value += 1200
    elif suffix == "AM" and value == 1200:
        value = 0
    elif not suffix and value < 800:
        value += 1200
    return value


def extract_time(raw: str) -> str:
    for token_a, token_b in zip(raw.split(), raw.split()[1:]):
        if looks_like_day_token(token_a) and TIME_RANGE_RE.match(token_b):
            return f"{token_a} {token_b}"
    return "TBA"


def parse_uw_time(time_str: str) -> List[Dict[str, int]]:
    if not time_str or time_str.upper() == "TBA":
        return []

    parts = time_str.split()
    if len(parts) < 2:
        return []

    days = parse_day_string(parts[0])
    if not days:
        return []

    try:
        start_raw, end_raw = parts[1].split("-")
    except ValueError:
        return []

    start_time = parse_uw_clock(start_raw)
    end_time = parse_uw_clock(end_raw)
    if start_time is None or end_time is None:
        return []

    if end_time < start_time:
        end_time += 1200

    return [{"day": day, "start": start_time, "end": end_time} for day in days]


def time_to_int(time_str: str) -> int:
    if not time_str:
        return 0

    match = re.match(r"(\d{1,2})(?::(\d{2}))?\s*([AP]M)", time_str.upper())
    if not match:
        return 0

    hours = int(match.group(1))
    minutes = int(match.group(2) or 0)
    ampm = match.group(3)

    if ampm == "PM" and hours < 12:
        hours += 12
    if ampm == "AM" and hours == 12:
        hours = 0
    return hours * 100 + minutes


def int_to_minutes(value: int) -> int:
    return (value // 100) * 60 + (value % 100)


def minutes_to_label(minutes: int) -> str:
    hours = minutes // 60
    mins = minutes % 60
    suffix = "AM" if hours < 12 else "PM"
    display_hours = hours % 12 or 12
    return f"{display_hours}:{mins:02d} {suffix}"


def int_to_label(value: int) -> str:
    return minutes_to_label(int_to_minutes(value))


def format_duration(start: int, end: int) -> float:
    return round((int_to_minutes(end) - int_to_minutes(start)) / 60, 2)


def safe_float(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def get_raw_tokens(section: Dict[str, Any]) -> List[str]:
    raw = str(section.get("raw_string", "")).strip()
    tokens = raw.split()
    sln = str(section.get("sln", "")).strip()

    if sln:
        for index, token in enumerate(tokens):
            if re.sub(r"\D", "", token) == re.sub(r"\D", "", sln):
                return tokens[index:]

    return tokens


def get_section_code(section: Dict[str, Any]) -> str:
    tokens = get_raw_tokens(section)
    return tokens[1].strip() if len(tokens) > 1 else ""


def get_component_type(section: Dict[str, Any]) -> str:
    tokens = get_raw_tokens(section)
    hint = tokens[2].upper() if len(tokens) > 2 else ""
    if hint in SECONDARY_TYPES:
        if hint == "QZ":
            return "Quiz"
        if hint in {"LB", "LAB"}:
            return "Lab"
        if hint == "DIS":
            return "Discussion"
        return hint.title()
    return "Lecture"


def section_is_secondary(section: Dict[str, Any]) -> bool:
    section_code = get_section_code(section)
    tokens = get_raw_tokens(section)
    hint = tokens[2].upper() if len(tokens) > 2 else ""
    return len(section_code) > 1 or hint in SECONDARY_TYPES


def parse_credits(section: Dict[str, Any]) -> float:
    tokens = get_raw_tokens(section)
    if len(tokens) < 3:
        return 0.0

    candidate = tokens[2]
    match = re.search(r"\d+(?:\.\d+)?", candidate)
    if match:
        return float(match.group(0))
    return 0.0


def parse_section_meetings(section: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw = str(section.get("raw_string", "")).strip()
    tokens = raw.split()
    meetings: List[Dict[str, Any]] = []
    section_code = get_section_code(section)
    component_type = get_component_type(section)

    for index in range(1, len(tokens)):
        day_token = tokens[index - 1]
        time_token = tokens[index]
        if not looks_like_day_token(day_token) or not TIME_RANGE_RE.match(time_token):
            continue

        blocks = parse_uw_time(f"{day_token} {time_token}")
        if not blocks:
            continue

        location_tokens: List[str] = []
        lookahead = index + 1
        while lookahead < len(tokens):
            token = tokens[lookahead]
            upper = token.upper()
            if "," in token or upper in STATUS_STOPWORDS:
                break
            location_tokens.append(token)
            lookahead += 1
            if len(location_tokens) >= 2:
                next_token = tokens[lookahead] if lookahead < len(tokens) else ""
                if "," in next_token or next_token.upper() in STATUS_STOPWORDS:
                    break

        location = " ".join(location_tokens).strip() or "TBA"
        start = blocks[0]["start"]
        end = blocks[0]["end"]
        days = [DAY_LABELS[block["day"]] for block in blocks]

        meetings.append(
            {
                "days": days,
                "days_label": "".join(days),
                "start": round(int_to_minutes(start) / 60, 2),
                "end": round(int_to_minutes(end) / 60, 2),
                "duration": format_duration(start, end),
                "start_int": start,
                "end_int": end,
                "time_label": f"{int_to_label(start)}-{int_to_label(end)}",
                "location": location,
                "component": component_type,
                "section": section_code,
                "blocks": blocks,
            }
        )

    return meetings


def get_all_blocks(item: Dict[str, Any]) -> List[Dict[str, int]]:
    if "sections" in item:
        sections = item["sections"]
    else:
        sections = [item]

    blocks: List[Dict[str, int]] = []
    for section in sections:
        for meeting in parse_section_meetings(section):
            blocks.extend(meeting["blocks"])
    return blocks


def get_numeric_ratings(sections: Sequence[Dict[str, Any]]) -> List[float]:
    ratings: List[float] = []
    for section in sections:
        rating = safe_float(section.get("real_rmp_rating"))
        if rating is not None:
            ratings.append(rating)
    return ratings


def build_course_option(course: str, sections: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    ordered_sections = sorted(
        [dict(section) for section in sections],
        key=lambda item: (section_is_secondary(item), get_section_code(item)),
    )
    ratings = get_numeric_ratings(ordered_sections)
    credits = max(parse_credits(section) for section in ordered_sections) if ordered_sections else 0.0
    section_label = " + ".join(filter(None, [get_section_code(section) for section in ordered_sections]))
    return {
        "course": course,
        "sections": ordered_sections,
        "section_label": section_label,
        "credits": credits,
        "average_rating": round(sum(ratings) / len(ratings), 2) if ratings else None,
    }


def build_course_options(course: str, sections: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not sections:
        return []

    primaries: List[Dict[str, Any]] = []
    secondaries: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    for section in sections:
        if section_is_secondary(section):
            secondaries[get_section_code(section)[:1]].append(section)
        else:
            primaries.append(section)

    options: List[Dict[str, Any]] = []
    used_secondary_slns = set()

    if primaries:
        for primary in primaries:
            prefix = get_section_code(primary)[:1]
            linked = secondaries.get(prefix, [])
            if linked:
                for secondary in linked:
                    options.append(build_course_option(course, [primary, secondary]))
                    used_secondary_slns.add(str(secondary.get("sln", "")))
            else:
                options.append(build_course_option(course, [primary]))
    else:
        for section in sections:
            options.append(build_course_option(course, [section]))

    for group in secondaries.values():
        for secondary in group:
            if str(secondary.get("sln", "")) not in used_secondary_slns and not primaries:
                options.append(build_course_option(course, [secondary]))

    return options


def check_conflict(option_a: Dict[str, Any], option_b: Dict[str, Any]) -> bool:
    blocks_a = get_all_blocks(option_a)
    blocks_b = get_all_blocks(option_b)

    for block_a in blocks_a:
        for block_b in blocks_b:
            if block_a["day"] != block_b["day"]:
                continue
            if block_a["start"] < block_b["end"] and block_b["start"] < block_a["end"]:
                return True
    return False


def schedule_signature(schedule: Sequence[Dict[str, Any]]) -> str:
    slns = sorted(str(section.get("sln", "")) for option in schedule for section in option["sections"])
    return "|".join(slns)


def schedule_metrics(schedule: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    all_blocks = [block for option in schedule for block in get_all_blocks(option)]
    all_days = sorted({block["day"] for block in all_blocks})
    ratings = [rating for option in schedule for rating in get_numeric_ratings(option["sections"])]

    gap_minutes = 0
    for day in all_days:
        day_blocks = sorted(
            [block for block in all_blocks if block["day"] == day],
            key=lambda block: block["start"],
        )
        for current, nxt in zip(day_blocks, day_blocks[1:]):
            gap_minutes += max(0, int_to_minutes(nxt["start"]) - int_to_minutes(current["end"]))

    earliest_start = min((block["start"] for block in all_blocks), default=0)
    latest_end = max((block["end"] for block in all_blocks), default=0)
    total_credits = sum(option.get("credits", 0.0) for option in schedule)

    return {
        "credits": round(total_credits, 1),
        "days_on_campus": len(all_days),
        "fridays_free": 5 not in all_days,
        "earliest_start": int_to_label(earliest_start) if earliest_start else None,
        "latest_end": int_to_label(latest_end) if latest_end else None,
        "gap_minutes": gap_minutes,
        "gap_hours": round(gap_minutes / 60, 1),
        "average_rating": round(sum(ratings) / len(ratings), 2) if ratings else None,
        "rated_sections": len(ratings),
    }


def score_best_professors(schedule: Sequence[Dict[str, Any]]) -> tuple:
    metrics = schedule_metrics(schedule)
    rating = metrics["average_rating"] or 0
    return (rating, metrics["fridays_free"], -metrics["days_on_campus"], -metrics["gap_minutes"])


def score_compact(schedule: Sequence[Dict[str, Any]], avoid_fridays: bool) -> tuple:
    metrics = schedule_metrics(schedule)
    friday_score = 1 if metrics["fridays_free"] else 0
    return (
        friday_score if avoid_fridays else 0,
        -metrics["days_on_campus"],
        -metrics["gap_minutes"],
        -(time_to_int(metrics["latest_end"]) if metrics["latest_end"] else 0),
    )


def score_balanced(
    schedule: Sequence[Dict[str, Any]],
    prioritize_chill: bool,
    compact_schedule: bool,
    avoid_fridays: bool,
) -> tuple:
    metrics = schedule_metrics(schedule)
    rating = metrics["average_rating"] or 0
    friday_score = 1 if metrics["fridays_free"] else 0
    return (
        rating * (2 if prioritize_chill else 1),
        friday_score if avoid_fridays else 0,
        -metrics["days_on_campus"] if compact_schedule else 0,
        -metrics["gap_minutes"] if compact_schedule else 0,
        -(time_to_int(metrics["earliest_start"]) if metrics["earliest_start"] else 0),
    )


def option_copy(option: Dict[str, Any], label: str, description: str) -> Dict[str, Any]:
    return {
        "label": label,
        "description": description,
        "schedule": list(option["schedule"]),
        "metrics": dict(option["metrics"]),
    }


def rank_schedules(valid_schedules: Sequence[Sequence[Dict[str, Any]]], constraints: Dict[str, Any]) -> List[Dict[str, Any]]:
    prioritize_chill = constraints.get("prioritize_chill", False)
    compact_schedule = constraints.get("compact_schedule", False)
    avoid_fridays = constraints.get("avoid_fridays", False)

    schedules = [
        {
            "schedule": list(schedule),
            "metrics": schedule_metrics(schedule),
        }
        for schedule in valid_schedules
    ]

    strategies = [
        (
            "Balanced fit",
            "A strong all-around option with a usable weekly rhythm.",
            lambda item: score_balanced(
                item["schedule"],
                prioritize_chill=prioritize_chill,
                compact_schedule=compact_schedule,
                avoid_fridays=avoid_fridays,
            ),
        ),
        (
            "Best professors",
            "Leans toward higher-rated instructors where reviews are available.",
            lambda item: score_best_professors(item["schedule"]),
        ),
        (
            "Most compact week",
            "Minimizes campus days and long breaks between classes.",
            lambda item: score_compact(item["schedule"], avoid_fridays=avoid_fridays),
        ),
    ]

    top_options: List[Dict[str, Any]] = []
    seen = set()

    for label, description, scorer in strategies:
        ranked = sorted(schedules, key=scorer, reverse=True)
        for candidate in ranked:
            signature = schedule_signature(candidate["schedule"])
            if signature in seen:
                continue
            seen.add(signature)
            top_options.append(option_copy(candidate, label, description))
            break

    if len(top_options) < 3:
        ranked = sorted(
            schedules,
            key=lambda item: score_balanced(
                item["schedule"],
                prioritize_chill=prioritize_chill,
                compact_schedule=compact_schedule,
                avoid_fridays=avoid_fridays,
            ),
            reverse=True,
        )
        for candidate in ranked:
            signature = schedule_signature(candidate["schedule"])
            if signature in seen:
                continue
            seen.add(signature)
            top_options.append(option_copy(candidate, "Alternate pick", "Another viable schedule with different tradeoffs."))
            if len(top_options) == 3:
                break

    return top_options


def build_schedules(constraints: Dict[str, Any], db: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    desired_courses = dedupe(constraints.get("desired_courses", []))
    no_classes_before = constraints.get("no_classes_before")
    no_classes_after = constraints.get("no_classes_after")
    avoid_fridays = constraints.get("avoid_fridays", False)

    cutoff_start = time_to_int(no_classes_before) if no_classes_before else 0
    cutoff_end = time_to_int(no_classes_after) if no_classes_after else 0
    normalized_requests = {course: normalize_course_code(course).replace(" ", "") for course in desired_courses}

    course_pools: Dict[str, List[Dict[str, Any]]] = {course: [] for course in desired_courses}

    for section in db:
        course_name = normalize_course_code(section.get("course", ""))
        normalized_course = course_name.replace(" ", "")
        status = str(section.get("status", "Closed")).strip().title()

        matched_course = None
        for original, normalized in normalized_requests.items():
            if normalized_course.startswith(normalized):
                matched_course = original
                break

        if not matched_course or status == "Closed":
            continue

        blocks = get_all_blocks(section)
        if blocks and cutoff_start and any(block["start"] < cutoff_start for block in blocks):
            continue
        if blocks and cutoff_end and any(block["end"] > cutoff_end for block in blocks):
            continue
        if avoid_fridays and any(block["day"] == 5 for block in blocks):
            continue

        course_pools[matched_course].append(section)

    for course, pool in course_pools.items():
        if not pool:
            return {"error": f"Could not find valid open sections for {course} meeting your constraints."}

    option_pools = [build_course_options(course, course_pools[course]) for course in desired_courses]
    for course, options in zip(desired_courses, option_pools):
        if not options:
            return {"error": f"Could not build a usable set of sections for {course}."}

    valid_schedules = []
    for combination in product(*option_pools):
        if any(check_conflict(a, b) for index, a in enumerate(combination) for b in combination[index + 1 :]):
            continue
        valid_schedules.append(list(combination))

    if not valid_schedules:
        return {"error": "Found classes, but they all conflict in time."}

    return {
        "top_schedules": rank_schedules(valid_schedules, constraints),
        "total_found": len(valid_schedules),
    }


def build_why_this_works(option: Dict[str, Any]) -> List[str]:
    metrics = option["metrics"]
    reasons: List[str] = [option["description"]]

    if metrics.get("fridays_free"):
        reasons.append("Keeps Friday open.")

    if metrics.get("average_rating") is not None:
        reasons.append(
            f"Averages {metrics['average_rating']:.1f} across {metrics['rated_sections']} rated sections."
        )

    if metrics.get("earliest_start"):
        reasons.append(f"Starts no earlier than {metrics['earliest_start']}.")

    if metrics.get("gap_hours", 0) == 0:
        reasons.append("No idle gaps between classes on the same day.")
    elif metrics.get("gap_hours", 0) > 0:
        reasons.append(f"About {metrics['gap_hours']:.1f} hours of total gap time across the week.")

    return reasons[:4]


def serialize_schedule_option(option: Dict[str, Any], rank: int) -> Dict[str, Any]:
    course_cards: List[Dict[str, Any]] = []
    visual_blocks: List[Dict[str, Any]] = []

    for course_option in option["schedule"]:
        meetings: List[Dict[str, Any]] = []
        for section in course_option["sections"]:
            rating = safe_float(section.get("real_rmp_rating"))
            reviews_count = section.get("rmp_reviews_count")
            for meeting in parse_section_meetings(section):
                meeting_payload = {
                    "id": f"{section.get('sln', 'section')}-{meeting['section']}-{meeting['days_label']}",
                    "course": course_option["course"],
                    "type": meeting["component"],
                    "days": meeting["days"],
                    "start": meeting["start"],
                    "duration": meeting["duration"],
                    "prof": section.get("instructor") or "TBA",
                    "rating": rating,
                    "reviews_count": reviews_count,
                    "loc": meeting["location"],
                    "time_label": meeting["time_label"],
                    "days_label": meeting["days_label"],
                    "section": meeting["section"],
                    "sln": str(section.get("sln", "")),
                }
                meetings.append(meeting_payload)
                visual_blocks.append(
                    {
                        "id": meeting_payload["id"],
                        "name": course_option["course"],
                        "type": meeting["component"],
                        "days": meeting["days"],
                        "start": meeting["start"],
                        "duration": meeting["duration"],
                        "prof": meeting_payload["prof"],
                        "rating": rating,
                        "reviews_count": reviews_count,
                        "loc": meeting["location"],
                        "time_label": meeting["time_label"],
                        "days_label": meeting["days_label"],
                        "section": meeting["section"],
                        "sln": meeting_payload["sln"],
                    }
                )

        primary_professor = next(
            (section.get("instructor") for section in course_option["sections"] if not section_is_secondary(section)),
            None,
        ) or course_option["sections"][0].get("instructor") or "TBA"

        ratings = get_numeric_ratings(course_option["sections"])
        course_cards.append(
            {
                "course": course_option["course"],
                "section_label": course_option["section_label"],
                "credits": course_option["credits"],
                "professor": primary_professor,
                "rating": round(sum(ratings) / len(ratings), 2) if ratings else None,
                "meetings": meetings,
                "slns": [str(section.get("sln", "")) for section in course_option["sections"]],
            }
        )

    return {
        "id": f"option-{rank}",
        "rank": rank,
        "label": option["label"],
        "description": option["description"],
        "metrics": option["metrics"],
        "why_this_works": build_why_this_works(option),
        "courses": course_cards,
        "schedule_data": visual_blocks,
    }


if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    with open(os.path.join(base_dir, "data", "uw_database_mvp_production.json"), "r") as handle:
        database = json.load(handle)

    test_constraints = {
        "desired_courses": ["CSE 121", "CSE 332"],
        "no_classes_before": "10:00 AM",
        "avoid_fridays": True,
        "prioritize_chill": True,
        "compact_schedule": True,
    }

    result = build_schedules(test_constraints, database)
    if "error" in result:
        print(result["error"])
    else:
        for index, option in enumerate(result["top_schedules"], start=1):
            serialized = serialize_schedule_option(option, index)
            print(serialized["label"], serialized["metrics"])
