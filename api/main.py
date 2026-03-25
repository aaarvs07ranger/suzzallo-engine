from fastapi import FastAPI
from pydantic import BaseModel, Field, ConfigDict
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
import json
import os
from dotenv import load_dotenv
from fastapi import UploadFile, File
import pdfplumber
import io
from typing import Optional, Dict, List, Any
from solver.engine import build_schedules
from supabase import create_client, Client

# Load environment variables
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Initialize Supabase Connection
supabase_url: str = os.getenv("SUPABASE_URL")
supabase_key: str = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScheduleRequest(BaseModel):
    prompt: str
    student_context: Optional[Dict[str, Any]] = None

@app.get("/")
def health_check():
    return {"status": "Suzzallo Core is Online (Cloud Mode)"}

@app.post("/analyze-transcript")
async def analyze_transcript(file: UploadFile = File(...)):
    print(f"📄 Received file: {file.filename}")
    
    content = await file.read()
    
    try:
        raw_text = ""
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                raw_text += page.extract_text() + "\n"
                
        print("✅ Text extracted successfully. Sending to LLM for structuring...")
        
        extraction_prompt = f"""
        You are a UW Academic Advisor. Extract the student's academic standing from the following raw transcript/DARS text.
        
        Return ONLY a JSON object with this exact structure:
        {{
            "major": "string",
            "completed_courses": ["string", "string"],
            "missing_requirements": ["string", "string"]
        }}
        
        Raw Transcript Text:
        {raw_text[:8000]}
        """
        
        response = client.chat.completions.create(
            model="gpt-5.4",
            messages=[{"role": "user", "content": extraction_prompt}],
            response_format={ "type": "json_object" },
            temperature=0.0
        )
        
        student_data = json.loads(response.choices[0].message.content)
        return student_data

    except Exception as e:
        return {"error": f"Failed to parse PDF: {str(e)}"}

class ScheduleConstraints(BaseModel):
    model_config = ConfigDict(extra="forbid") 
    desired_courses: List[str] = Field(description="List of course codes the user wants, e.g., ['CSE 311', 'CSE 332']")
    no_classes_before: Optional[str] = Field(description="The earliest time to wake up, e.g., '11:00 AM'. Null if no preference.")
    prioritize_chill: bool = Field(description="True if the user asked for easy, light, or high-rated professors.")
    
@app.post("/test-extractor")
def test_extractor(req: ScheduleRequest):
    print(f"🕵️ Extractor Agent analyzing prompt: '{req.prompt}'")
    
    extraction_prompt = f"""
    You are the Data Extraction Agent for Suzzallo.
    Read the user's scheduling request and extract their exact constraints into JSON.
    Do NOT try to build the schedule. Just extract the parameters.
    
    User Request: {req.prompt}
    """
    
    try:
        response = client.beta.chat.completions.parse(
            model="gpt-5.4", 
            messages=[{"role": "user", "content": extraction_prompt}],
            response_format=ScheduleConstraints,
            temperature=0.0
        )
        
        extracted_data = response.choices[0].message.parsed
        return {"extracted_data": extracted_data.model_dump()}
        
    except Exception as e:
        return {"error": str(e)}

@app.post("/generate-schedule")
def generate_schedule(req: ScheduleRequest):
    print(f"\n🧠 SWARM INITIALIZED for prompt: '{req.prompt}'")
    
    # ==========================================
    # AGENT 1: THE EXTRACTOR
    # ==========================================
    print("🕵️ Agent 1 (Extractor): Parsing constraints...")
    extraction_prompt = f"""
    Extract the exact scheduling constraints from this user request.
    User Request: {req.prompt}
    """
    
    try:
        response = client.beta.chat.completions.parse(
            model="gpt-5.4", 
            messages=[{"role": "user", "content": extraction_prompt}],
            response_format=ScheduleConstraints,
            temperature=0.0
        )
        constraints = response.choices[0].message.parsed.model_dump()
        print(f"   ✅ Extracted: {constraints}")
        
    except Exception as e:
        return {"error": f"Extractor Agent Failed: {str(e)}"}

    # ==========================================
    # STEP 1.5: FETCH LIVE DATA FROM SUPABASE
    # ==========================================
    desired_courses = constraints.get("desired_courses", [])
    print(f"☁️ Fetching live data for {desired_courses} from Supabase...")
    
    try:
        db_response = supabase.table("course_sections").select("*").in_("course", desired_courses).execute()
        live_database = db_response.data
        print(f"   ✅ Downloaded {len(live_database)} relevant sections from the cloud.")
    except Exception as e:
        return {"error": f"Cloud Database Fetch Failed: {str(e)}"}

    # ==========================================
    # STEP 2: THE MATH ENGINE (DETERMINISTIC SOLVER)
    # ==========================================
    print("⚙️ Math Engine: Calculating permutations...")
    solver_result = build_schedules(constraints, live_database)
    
    if "error" in solver_result:
        print(f"   ❌ Math Engine Error: {solver_result['error']}")
        return {"agent_response": f"I couldn't build that schedule: {solver_result['error']}"}
        
    print(f"   ✅ Found {solver_result['total_found']} valid schedules.")
    best_schedule = solver_result['top_schedules'][0]

    # ==========================================
    # AGENT 3: THE PRESENTER
    # ==========================================
    print("🗣️ Agent 2 (Presenter): Formatting output...")
    
    student_context_str = ""
    if req.student_context:
        student_context_str = f"Keep in mind their major is {req.student_context.get('major', 'Unknown')}."

    presenter_prompt = f"""
    You are Suzzallo, an elite academic scheduling assistant for UW.
    The deterministic math engine successfully calculated {solver_result['total_found']} valid schedules.
    
    Here is the absolute #1 best mathematically possible schedule based on their constraints:
    {json.dumps(best_schedule, indent=2)}
    
    Write a concise, highly readable response to the user presenting this schedule.
    {student_context_str}
    
    RULES:
    1. List each course, the meeting days/times, the exact SLN for registration, and the Professor.
    2. Explicitly mention the RateMyProfessor (RMP) scores to prove why this schedule is elite.
    3. Keep the tone confident, helpful, and concise. Do NOT show them the raw JSON.
    """
    
    try:
        final_response = client.chat.completions.create(
            model="gpt-5.4",
            messages=[
                {"role": "system", "content": "You are a helpful academic scheduling AI."},
                {"role": "user", "content": presenter_prompt}
            ],
            temperature=0.3
        )
        
        print("✅ Swarm execution complete.")
        return {"agent_response": final_response.choices[0].message.content}
        
    except Exception as e:
        return {"error": f"Presenter Agent Failed: {str(e)}"}