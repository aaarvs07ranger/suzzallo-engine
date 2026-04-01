import io
import json
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

import pdfplumber
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel, ConfigDict, Field
from supabase import Client, create_client

from solver.engine import build_schedules, dedupe, normalize_course_code, serialize_schedule_option

load_dotenv()

BASE_DIR = Path(__file__).resolve().parents[1]
LOCAL_DB_PATH = BASE_DIR / "data" / "uw_database_mvp_production.json"
COURSE_CODE_RE = re.compile(r"\b([A-Z]{2,5})\s*-?\s*(\d{3}[A-Z]?)\b", re.IGNORECASE)

openai_api_key = os.getenv("OPENAI_API_KEY")
client: Optional[OpenAI] = OpenAI(api_key=openai_api_key) if openai_api_key else None

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase: Optional[Client] = None
if supabase_url and supabase_key:
    supabase = create_client(supabase_url, supabase_key)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PlannerPreferences(BaseModel):
    model_config = ConfigDict(extra="forbid")
    desired_courses: List[str] = Field(default_factory=list)
    no_classes_before: Optional[str] = None
    no_classes_after: Optional[str] = None
    avoid_fridays: bool = False
    prioritize_chill: bool = False
    compact_schedule: bool = False


class ScheduleRequest(BaseModel):
    prompt: str = ""
    student_context: Optional[Dict[str, Any]] = None
    preferences: Optional[PlannerPreferences] = None


class ScheduleConstraints(BaseModel):
    model_config = ConfigDict(extra="forbid")
    desired_courses: List[str] = Field(default_factory=list)
    no_classes_before: Optional[str] = None
    no_classes_after: Optional[str] = None
    avoid_fridays: bool = False
    prioritize_chill: bool = False
    compact_schedule: bool = False


@app.get("/")
def health_check():
    mode = "cloud" if supabase else "local"
    return {"status": f"Suzzallo planner online ({mode} data mode)"}


def human_join(values: List[str]) -> str:
    if not values:
        return ""
    if len(values) == 1:
        return values[0]
    if len(values) == 2:
        return f"{values[0]} and {values[1]}"
    return f"{', '.join(values[:-1])}, and {values[-1]}"


def normalize_time_label(value: Optional[str], *, default_meridiem: str = "AM") -> Optional[str]:
    if not value:
        return None

    candidate = str(value).strip().upper().replace(".", "")
    match = re.match(r"^(\d{1,2})(?::(\d{2}))?\s*([AP]M)?$", candidate)
    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2) or 0)
    meridiem = match.group(3) or default_meridiem

    if hour > 12 or minute > 59:
        return None

    return f"{hour}:{minute:02d} {meridiem}"


def extract_course_codes(prompt: str) -> List[str]:
    courses = [f"{subject.upper()} {number.upper()}" for subject, number in COURSE_CODE_RE.findall(prompt or "")]
    return dedupe(courses)


def extract_time_from_prompt(prompt: str, patterns: List[str], *, default_meridiem: str) -> Optional[str]:
    for pattern in patterns:
        match = re.search(pattern, prompt, re.IGNORECASE)
        if not match:
            continue
        return normalize_time_label(match.group(1), default_meridiem=default_meridiem)
    return None


def heuristic_constraints_from_prompt(prompt: str) -> Dict[str, Any]:
    text = prompt or ""
    lowered = text.lower()

    return {
        "desired_courses": extract_course_codes(text),
        "no_classes_before": extract_time_from_prompt(
            text,
            [
                r"(?:no classes before|nothing before|not before|start after|after)\s+(\d{1,2}(?::\d{2})?\s*[ap]m?|\d{1,2})",
                r"(?:earliest start|latest wake(?:\s*up)?)\s+(\d{1,2}(?::\d{2})?\s*[ap]m?|\d{1,2})",
            ],
            default_meridiem="AM",
        ),
        "no_classes_after": extract_time_from_prompt(
            text,
            [
                r"(?:no classes after|done by|finish by|be done by|end by|nothing after)\s+(\d{1,2}(?::\d{2})?\s*[ap]m?|\d{1,2})",
            ],
            default_meridiem="PM",
        ),
        "avoid_fridays": bool(
            re.search(r"\b(?:no|avoid|free)\s+fridays?\b|\bfridays?\s+off\b", lowered, re.IGNORECASE)
        ),
        "prioritize_chill": any(
            phrase in lowered
            for phrase in [
                "chill",
                "easy",
                "light schedule",
                "lighter schedule",
                "best professor",
                "best professors",
                "good professor",
                "good professors",
                "high rated",
                "high-rated",
                "top rated",
                "top-rated",
            ]
        ),
        "compact_schedule": any(
            phrase in lowered
            for phrase in [
                "compact",
                "few days",
                "fewer days",
                "stacked",
                "minimize commute",
                "minimise commute",
                "minimize days on campus",
                "free up days",
            ]
        ),
    }


def merge_constraints(prompt: str, preferences: Optional[PlannerPreferences]) -> Dict[str, Any]:
    extracted = heuristic_constraints_from_prompt(prompt)
    merged = ScheduleConstraints(**extracted).model_dump()

    if preferences:
        prefs = preferences.model_dump()
        if prefs["desired_courses"]:
            merged["desired_courses"] = prefs["desired_courses"]
        for key in ["no_classes_before", "no_classes_after"]:
            merged[key] = normalize_time_label(
                prefs.get(key),
                default_meridiem="AM" if key == "no_classes_before" else "PM",
            ) or merged.get(key)
        for key in ["avoid_fridays", "prioritize_chill", "compact_schedule"]:
            merged[key] = bool(prefs.get(key) or merged.get(key))

    merged["desired_courses"] = dedupe(merged.get("desired_courses", []))
    return merged


def build_constraint_summary(constraints: Dict[str, Any]) -> List[str]:
    summary: List[str] = []
    if constraints.get("no_classes_before"):
        summary.append(f"nothing before {constraints['no_classes_before']}")
    if constraints.get("no_classes_after"):
        summary.append(f"done by {constraints['no_classes_after']}")
    if constraints.get("avoid_fridays"):
        summary.append("Friday-free if possible")
    if constraints.get("prioritize_chill"):
        summary.append("strong professor ratings")
    if constraints.get("compact_schedule"):
        summary.append("compact days")
    return summary


def build_planner_message(
    constraints: Dict[str, Any],
    total_found: int,
    schedule_options: List[Dict[str, Any]],
    student_context: Optional[Dict[str, Any]],
) -> str:
    courses = constraints.get("desired_courses", [])
    course_text = human_join(courses)
    constraint_summary = build_constraint_summary(constraints)
    summary_text = f" I honored {human_join(constraint_summary)}." if constraint_summary else ""

    major_text = ""
    if student_context and student_context.get("major"):
        major_text = f" I also kept your **{student_context['major']}** context in view."

    option_labels = human_join([f"**{option['label']}**" for option in schedule_options])
    return (
        f"Found **{total_found} valid schedules** for **{course_text}**.{summary_text}"
        f"{major_text} I picked {option_labels} so you can compare week shape, professor fit, and overall balance."
    )


def extract_transcript_with_llm(raw_text: str) -> Dict[str, Any]:
    extraction_prompt = f"""
    You are a UW academic advisor.
    Extract the student's academic standing from the transcript text below.

    Return only a JSON object with this structure:
    {{
      "major": "string",
      "completed_courses": ["CSE 121", "MATH 124"],
      "missing_requirements": ["string", "string"]
    }}

    Transcript text:
    {raw_text[:12000]}
    """

    response = client.chat.completions.create(
        model="gpt-5.4",
        messages=[{"role": "user", "content": extraction_prompt}],
        response_format={"type": "json_object"},
        temperature=0.0,
    )
    return json.loads(response.choices[0].message.content)


def extract_transcript_fallback(raw_text: str) -> Dict[str, Any]:
    courses = extract_course_codes(raw_text)
    major_match = re.search(r"(?:major|program of study)\s*[:\-]?\s*(.+)", raw_text, re.IGNORECASE)
    major = major_match.group(1).strip() if major_match else "Undeclared"
    return {
        "major": major,
        "completed_courses": courses[:40],
        "missing_requirements": [],
    }


@lru_cache(maxsize=1)
def load_local_database() -> List[Dict[str, Any]]:
    with open(LOCAL_DB_PATH, "r") as handle:
        return json.load(handle)


def fetch_relevant_sections(desired_courses: List[str]) -> List[Dict[str, Any]]:
    normalized = [normalize_course_code(course).replace(" ", "") for course in desired_courses]

    if supabase:
        try:
            response = supabase.table("course_sections").select("*").in_("course", desired_courses).execute()
            if response.data:
                return response.data
        except Exception:
            pass

    local_data = load_local_database()
    return [
        section
        for section in local_data
        if any(
            normalize_course_code(section.get("course", "")).replace(" ", "").startswith(course)
            for course in normalized
        )
    ]


@app.post("/analyze-transcript")
async def analyze_transcript(file: UploadFile = File(...)):
    content = await file.read()

    try:
        raw_text_parts: List[str] = []
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                raw_text_parts.append(page.extract_text() or "")
        raw_text = "\n".join(raw_text_parts).strip()
        if not raw_text:
            raise ValueError("I couldn't extract readable text from that PDF.")

        if client:
            student_data = extract_transcript_with_llm(raw_text)
        else:
            student_data = extract_transcript_fallback(raw_text)

        completed = dedupe(student_data.get("completed_courses", []))
        missing = student_data.get("missing_requirements", []) or []
        payload = {
            "ok": True,
            "major": student_data.get("major") or "Undeclared",
            "completed_courses": completed,
            "missing_requirements": missing,
            "stats": {
                "completed_count": len(completed),
                "missing_count": len(missing),
            },
        }
        return payload
    except Exception as exc:
        return {
            "ok": False,
            "error": f"Transcript parsing failed: {exc}",
        }


@app.post("/test-extractor")
def test_extractor(req: ScheduleRequest):
    return {"ok": True, "extracted_data": merge_constraints(req.prompt, req.preferences)}


@app.post("/generate-schedule")
def generate_schedule(req: ScheduleRequest):
    constraints = merge_constraints(req.prompt, req.preferences)

    if not constraints.get("desired_courses"):
        message = "Tell me at least one course code so I can build a real quarter plan."
        return {"ok": False, "error": message, "agent_response": message}

    try:
        live_database = fetch_relevant_sections(constraints["desired_courses"])
        solver_result = build_schedules(constraints, live_database)
    except Exception as exc:
        message = f"Something went wrong while building schedules: {exc}"
        return {"ok": False, "error": message, "agent_response": message}

    if "error" in solver_result:
        return {"ok": False, "error": solver_result["error"], "agent_response": solver_result["error"]}

    schedule_options = [
        serialize_schedule_option(option, index)
        for index, option in enumerate(solver_result["top_schedules"], start=1)
    ]

    agent_response = build_planner_message(
        constraints=constraints,
        total_found=solver_result["total_found"],
        schedule_options=schedule_options,
        student_context=req.student_context,
    )

    return {
        "ok": True,
        "agent_response": agent_response,
        "constraints": constraints,
        "total_found": solver_result["total_found"],
        "schedule_options": schedule_options,
        "schedule_data": schedule_options[0]["schedule_data"] if schedule_options else [],
    }
