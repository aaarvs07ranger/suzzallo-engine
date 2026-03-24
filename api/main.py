from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware # Add this import
from openai import OpenAI
import json
import os
from dotenv import load_dotenv
from fastapi import UploadFile, File
import pdfplumber
import io
from typing import Optional, Dict, Any

# Load the API key from the .env file
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Load the Database into memory when the server starts
with open("data/uw_database_mvp.json", "r") as f:
    uw_database = json.load(f)
    
# We convert it to a string so the LLM can read it
db_string = json.dumps(uw_database)

class ScheduleRequest(BaseModel):
    prompt: str
    student_context: Optional[Dict[str, Any]] = None # New optional field

@app.get("/")
def health_check():
    return {"status": "Suzzallo Core is Online"}

@app.post("/analyze-transcript")
async def analyze_transcript(file: UploadFile = File(...)):
    print(f"📄 Received file: {file.filename}")
    
    # 1. Read the PDF into memory
    content = await file.read()
    
    try:
        # 2. Extract raw text using pdfplumber
        raw_text = ""
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                raw_text += page.extract_text() + "\n"
                
        print("✅ Text extracted successfully. Sending to LLM for structuring...")
        
        # 3. Use the LLM as an ETL (Extract, Transform, Load) tool
        # We force GPT-5.4 to return a strict JSON object
        extraction_prompt = f"""
        You are a UW Academic Advisor. Extract the student's academic standing from the following raw transcript/DARS text.
        
        Return ONLY a JSON object with this exact structure:
        {{
            "major": "string",
            "completed_courses": ["string", "string"],
            "missing_requirements": ["string", "string"]
        }}
        
        Raw Transcript Text:
        {raw_text[:8000]} # Limit to 8000 chars to avoid overloading the context if it's huge
        """
        
        response = client.chat.completions.create(
            model="gpt-5.4",
            messages=[{"role": "user", "content": extraction_prompt}],
            response_format={ "type": "json_object" }, # Forces the output to be pure JSON
            temperature=0.0
        )
        
        # 4. Parse the LLM's JSON response and return it to the frontend
        student_data = json.loads(response.choices[0].message.content)
        return student_data

    except Exception as e:
        return {"error": f"Failed to parse PDF: {str(e)}"}

@app.post("/generate-schedule")
def generate_schedule(req: ScheduleRequest):
    print(f"🧠 Agent received prompt: '{req.prompt}'")
    
    # 1. Base System Prompt
    system_instruction = f"""
    You are Suzzallo, an elite, hyper-intelligent academic scheduling agent for the University of Washington.
    Your goal is to read the user's request, look at the provided JSON database of UW classes, and output a perfect, logical schedule.
    
    RULES:
    1. ONLY recommend classes that exist in the provided JSON database.
    2. Pay strict attention to the "status" field. Do not recommend "Closed" classes unless absolutely necessary.
    3. Pay attention to the meeting times. Do NOT schedule two classes that overlap in time.
    4. Provide the exact SLN (Schedule Line Number) for the user to register.
    5. Explain your reasoning briefly.
    """
    
    # 2. Inject the Student's PDF Data if they uploaded it
    if req.student_context:
        print("📥 Injecting Student DARS Context into AI Brain...")
        system_instruction += f"""
        
        STUDENT ACADEMIC RECORD:
        The student has already taken these classes, DO NOT recommend them again: {req.student_context.get('completed_courses', [])}
        The student MUST fulfill these requirements: {req.student_context.get('missing_requirements', [])}
        Current Major Status: {req.student_context.get('major', 'Unknown')}
        """
        
    system_instruction += f"""
    
    DATABASE:
    {db_string}
    """
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": req.prompt}
            ],
            temperature=0.0 
        )
        
        answer = response.choices[0].message.content
        return {"agent_response": answer}
        
    except Exception as e:
        return {"error": str(e)}
