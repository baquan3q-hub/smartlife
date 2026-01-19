import os
import google.generativeai as genai
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv
# 1. Cấu hình
load_dotenv('.env.local')
load_dotenv() # Fallback

# Reset Gemini config per request or global? Global is fine for now.
api_key = os.getenv("VITE_GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

app = FastAPI()

# 2. Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELS ---
class Transaction(BaseModel):
    id: str
    amount: float
    category: str
    date: str
    type: str # 'income' or 'expense'

class AnalysisRequest(BaseModel):
    transactions: List[Transaction]
    user_goal: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    history: List[dict] = []
    context: Optional[str] = ""

class CommandRequest(BaseModel):
    command: str
    current_date: str

# --- ROUTES ---

@app.get("/")
def home():
    return {"status": "AI Backend is running!"}

@app.post("/chat_finance")
async def chat_finance(req: ChatRequest):
    try:
        from api.finance_agent import chat_with_advisor
        print(f"Chat: {req.message}")
        response = chat_with_advisor(req.message, req.history, req.context)
        return {"response": response}
    except Exception as e:
        print(f"Chat Error: {e}")
        # Fallback simple response if import fails or other error
        if not api_key:
            return {"response": "Chưa cấu hình API Key Gemini."}
        
        # Simple fallback generation
        try:
            model = genai.GenerativeModel('gemini-1.5-flash')
            res = model.generate_content(req.message)
            return {"response": res.text}
        except:
             return {"response": f"Lỗi hệ thống: {str(e)}"}

@app.post("/analyze_finance")
async def analyze_finance(req: AnalysisRequest):
    try:
        from api.finance_agent import analyze_spending
        return analyze_spending(req.transactions)
    except Exception as e:
        print(f"Analyze Error: {e}")
        return {
            "insight": "Hiện tại chưa thể phân tích chi tiết.",
            "actions": ["Theo dõi chi tiêu", "Tiết kiệm thêm", "Kiểm tra lại kết nối"]
        }

@app.post("/parse_schedule")
async def parse_schedule(req: CommandRequest):
    try:
        from api.scheduler_agent import parse_command
        return await parse_command(req.command, req.current_date)
    except Exception as e:
        print(f"Schedule Error: {e}")
        return {"error": "Lỗi xử lý lịch trình."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)