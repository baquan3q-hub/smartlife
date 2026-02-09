
import os
import time
from dotenv import load_dotenv
import google.generativeai as genai
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import json

# --- CONFIGURATION ---
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_FILE = os.path.join(PROJECT_ROOT, '.env.local')

load_dotenv(ENV_FILE, override=True)
load_dotenv(override=True) 

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

# --- MODELS ---
class Transaction(BaseModel):
    id: str
    amount: float
    category: str
    date: str
    type: str

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

# --- AI CONFIGURATION ---
model = None
try:
    API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("VITE_GEMINI_API_KEY")
    if API_KEY:
        genai.configure(api_key=API_KEY)
        model = genai.GenerativeModel('gemini-2.0-flash')
        print(f"[OK] AI Model configured successfully! (Key: ...{API_KEY[-6:]})")
    else:
        print("[WARN] GEMINI_API_KEY not found. AI features disabled.")
except Exception as e:
    print(f"[ERROR] Error configuring Gemini AI: {e}")

# --- LOGIC ---

def analyze_spending_logic(transactions_data):
    try:
        if not transactions_data:
            return {"insight": "Chưa có dữ liệu giao dịch để phân tích.", "actions": []}

        expenses = [t for t in transactions_data if t.type == 'expense']
        
        if not expenses:
            return {"insight": "Bạn chưa có khoản chi tiêu nào.", "actions": ["Hãy ghi chép chi tiêu đầu tiên!"]}

        total_spent = sum(t.amount for t in expenses)
        
        category_map = {}
        for t in expenses:
            category_map[t.category] = category_map.get(t.category, 0) + t.amount
            
        sorted_categories = sorted(category_map.items(), key=lambda item: item[1], reverse=True)
        
        top_category = sorted_categories[0][0]
        top_amount = sorted_categories[0][1]

        insight_msg = (
            f"Tổng chi tiêu: {total_spent:,.0f} VND.\n"
            f"Danh mục tốn kém nhất: {top_category} ({top_amount:,.0f} VND).\n"
        )
        
        return {
            "insight": insight_msg,
            "actions": ["Xem biểu đồ để biết thêm chi tiết."]
        }
    except Exception as e:
        print(f"Analysis Logic Error: {e}")
        return {"insight": "Lỗi xử lý dữ liệu.", "actions": []}

def chat_advisor_logic(message: str, history: list = [], context: str = ""):
    if not model:
        return "Xin lỗi, tôi chưa được kết nối với trí tuệ nhân tạo (Thiếu API Key). Hãy kiểm tra cấu hình."

    try:
        system_instruction = """
        BẠN LÀ MỘT NGƯỜI CỐ VẤN TÀI CHÍNH VÀ CUỘC SỐNG THÔNG MINH, TẬN TÂM VÀ CÓ CHỈ SỐ EQ CAO.
        
        Mục tiêu của bạn:
        1. Lắng nghe và thấu hiểu vấn đề của người dùng.
        2. Phân tích dựa trên dữ liệu thật (được cung cấp trong phần CONTEXT).
        3. Đưa ra lời khuyên CỤ THỂ, KHẢ THI và TÍCH CỰC.
        4. Luôn giữ thái độ động viên, khích lệ nhưng không sáo rỗng. Hãy như một người bạn thân thông thái.

        Phong cách giao tiếp:
        - Dùng ngôn ngữ tự nhiên, gần gũi, ấm áp (Tiếng Việt).
        - Sử dụng Markdown để trình bày rõ ràng (in đậm ý chính, gạch đầu dòng).
        - Đặt câu hỏi ngược lại để gợi mở nếu cần thêm thông tin.
        - KHÔNG BAO GIỜ phán xét cách chi tiêu của người dùng, hãy tìm cách tối ưu hóa nó.
        
        Dữ liệu hiện tại của người dùng (CONTEXT):
        """
        
        full_prompt = f"{system_instruction}\n{context}\n\nNgười dùng hỏi: {message}"
        
        response = model.generate_content(full_prompt)
        return response.text
    except Exception as e:
        print(f"AI Generation Error: {e}")
        return "Xin lỗi, tôi đang gặp chút sự cố khi suy nghĩ. Bạn thử lại sau nhé! (Error: " + str(e) + ")"

def parse_schedule_logic(command: str, current_date: str):
    return {"error": "Tính năng này chưa khả dụng."}

# --- ROUTES ---

@app.get("/api/health")
def health_check():
    return {"status": "ok", "environment": "Local", "ai_enabled": model is not None}

@app.post("/api/chat_finance")
async def chat_finance(req: ChatRequest):
    return {"response": chat_advisor_logic(req.message, req.history, req.context)}

@app.post("/api/analyze_finance")
async def analyze_finance(req: AnalysisRequest):
    return analyze_spending_logic(req.transactions)

@app.post("/api/parse_schedule")
async def parse_schedule(req: CommandRequest):
    return parse_schedule_logic(req.command, req.current_date)

# Fallback for local testing
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
