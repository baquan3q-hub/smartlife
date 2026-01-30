
import os
import google.generativeai as genai
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import json

# --- CONFIGURATION ---
# Check if running in Vercel (environment variable usually present or we can infer)
# For Vercel, we might need root_path="/api" if the rewrite handles it that way.
# However, Vercel Serverless often strips the prefix before handing to WSGI?
# Actually, vercel.json rewrite "/api/(.*)" -> "/api/index.py"
# The ASGI app receives the full path including /api prefix usually.
# Safest bet: handle both or use root_path.

app = FastAPI(
    docs_url="/api/docs", 
    openapi_url="/api/openapi.json"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Key Check
api_key = os.getenv("GEMINI_API_KEY") 
if api_key:
    genai.configure(api_key=api_key)
else:
    print("Warning: GEMINI_API_KEY not set in environment variables.")

# --- MODELS ---
class Transaction(BaseModel):
    id: str
    amount: float
    category: str
    date: str
    type: str # 'income' or 'expense'

class ChatRequest(BaseModel):
    message: str
    history: List[dict] = []
    context: Optional[str] = ""

class AnalysisRequest(BaseModel):
    transactions: List[Transaction]
    user_goal: Optional[str] = None

class CommandRequest(BaseModel):
    command: str
    current_date: str

# --- HELPER FUNCTIONS ---
def get_generative_model(system_instruction=None):
    try:
        if not api_key:
            raise Exception("API Key missing")
            
        model_name = 'gemini-1.5-flash' # Default fast model
        
        # Simple instantiation
        if system_instruction:
            return genai.GenerativeModel(model_name, system_instruction=system_instruction)
        return genai.GenerativeModel(model_name)
    except Exception as e:
        print(f"Model Init Error: {e}")
        # Fallback
        return genai.GenerativeModel('gemini-pro')

# --- LOGIC WITHOUT PANDAS (Optimized for Vercel) ---
def analyze_spending_logic(transactions_data):
    try:
        if not transactions_data:
            return {"insight": "Chưa có dữ liệu giao dịch để phân tích.", "actions": []}

        # Native Python Statistics
        expenses = [t for t in transactions_data if t.type == 'expense']
        
        if not expenses:
            return {"insight": "Bạn chưa có khoản chi tiêu nào.", "actions": ["Hãy ghi chép chi tiêu đầu tiên!"]}

        total_spent = sum(t.amount for t in expenses)
        
        # Group by category
        category_map = {}
        for t in expenses:
            category_map[t.category] = category_map.get(t.category, 0) + t.amount
            
        # Sort desc
        sorted_categories = sorted(category_map.items(), key=lambda item: item[1], reverse=True)
        
        top_category = sorted_categories[0][0]
        top_amount = sorted_categories[0][1]
        
        category_summary_str = "\n".join([f"- {cat}: {amt:,.0f}" for cat, amt in sorted_categories])

        # Ask Gemini
        prompt = f"""
        Tôi là một trợ lý tài chính cá nhân. Người dùng đã chi tiêu tổng cộng {total_spent:,.0f} VND.
        Danh mục tốn kém nhất là '{top_category}' với {top_amount:,.0f} VND.
        Chi tiết:
        {category_summary_str}
        
        Hãy đưa ra 1 nhận xét ngắn gọn (dưới 50 từ) và 3 hành động tiết kiệm thực tế.
        Output JSON: {{ "insight": "...", "actions": [...] }}
        """
        
        model = get_generative_model()
        response = model.generate_content(prompt)
        text = response.text.replace('```json', '').replace('```', '').strip()
        return json.loads(text)
    except Exception as e:
        print(f"Analysis Logic Error: {e}")
        return {
            "insight": "Không thể phân tích vào lúc này (Lỗi Backend/API Key).",
            "actions": ["Kiểm tra cấu hình API Key trên Vercel"]
        }

def chat_advisor_logic(message: str, history: list = [], context: str = ""):
    try:
        system_instruction = """
        Bạn là **SmartLife AI** - Trợ lý ảo siêu thông minh.
        Nhiệm vụ: Trả lời ngắn gọn, thông minh, hữu ích. Dùng Emoji 🌟.
        Nếu có ngữ cảnh tài chính, hãy tư vấn sát sườn.
        """
        
        model = get_generative_model(system_instruction=system_instruction)
        
        # Simple history mapping
        gemini_history = []
        for msg in history[-5:]: # Keep context small
            role = "user" if msg.get("role") == "user" else "model"
            content = msg.get("content", "")
            if content:
                gemini_history.append({"role": role, "parts": [content]})

        chat = model.start_chat(history=gemini_history)
        
        user_message = message
        if context:
            user_message = f"[CONTEXT]: {context}\n\n[QUESTION]: {message}"
            
        response = chat.send_message(user_message)
        return response.text
    except Exception as e:
        print(f"Chat Error: {e}")
        return "Xin lỗi, AI đang bận hoặc chưa cấu hình đúng API Key. (Hãy kiểm tra Env Variable)"

def parse_schedule_logic(command: str, current_date: str):
    try:
        prompt = f"""
        Current Date: {current_date}
        Command: "{command}"
        Extract schedule event: title, start_time (HH:MM), end_time (HH:MM), day_of_week (0-6).
        Return JSON ONLY: {{ "title": "...", "start_time": "...", "end_time": "...", "day_of_week": int, "location": null }}
        If invalid, return {{ "error": "Invalid command" }}
        """
        model = get_generative_model()
        response = model.generate_content(prompt)
        text = response.text.replace('```json', '').replace('```', '').strip()
        return json.loads(text)
    except Exception as e:
        print(f"Schedule Parse Error: {e}")
        return {"error": "Lỗi xử lý AI"}

# --- ROUTES ---

@app.get("/api/health")
def health_check():
    return {"status": "ok", "environment": "Vercel"}

@app.post("/api/chat_finance")
async def chat_finance(req: ChatRequest):
    return {"response": chat_advisor_logic(req.message, req.history, req.context)}

@app.post("/api/analyze_finance")
async def analyze_finance(req: AnalysisRequest):
    return analyze_spending_logic(req.transactions)

@app.post("/api/parse_schedule")
async def parse_schedule(req: CommandRequest):
    return parse_schedule_logic(req.command, req.current_date)

# Fallback for local testing if running this file directly
if __name__ == "__main__":
    import uvicorn
    # When running locally, we might not have /api prefix in the URL if we hit root
    # But vite proxy sends /api.
    # To mimic vercel:
    uvicorn.run(app, host="0.0.0.0", port=8000)
