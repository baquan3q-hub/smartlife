import os
import sys

# Add the parent directory to sys.path to allow imports from smart_backend if needed
# But better to just copy the logic or import from smart_backend relative?
# The user's structures are a bit mixed. smart_backend is at root level sibling to src.
# To import from smart_backend from src/main.py:
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'smart_backend'))

import google.generativeai as genai
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv

# 1. Cấu hình
load_dotenv('.env.local')
load_dotenv() # Fallback

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

@app.on_event("startup")
async def startup_event():
    print(">>> SERVER STARTED AT http://localhost:8000 <<<")
    print(f">>> API Key configured: {'YES' if api_key else 'NO'} <<<")
    print(">>> Available endpoints: /chat_finance, /analyze_finance <<<")
    try:
        print(">>> Checking available Gemini models... <<<")
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(f"   - {m.name}")
    except Exception as e:
        print(f">>> Error listing models: {e} <<<")

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
    return {"status": "AI Backend is running (from src/main.py)!"}

# --- HELPER FUNCTIONS ---

def get_generative_model(system_instruction=None):
    """
    Dynamically attempts to find a working model from the user's list.
    Prioritizes Flash -> Pro -> Standard Gemini.
    """
    try:
        # Standard preferred models
        preferred_models = ['models/gemini-1.5-flash', 'models/gemini-1.5-pro', 'models/gemini-pro']
        
        available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
        
        selected_model_name = None
        
        # 1. Check preferred
        for pref in preferred_models:
            if pref in available_models:
                selected_model_name = pref
                break
        
        # 2. Fallback to first available if no preferred found
        if not selected_model_name and available_models:
            selected_model_name = available_models[0]
            print(f">>> Warning: Preferred models not found. Using fallback: {selected_model_name}")
            
        if not selected_model_name:
            raise Exception("No 'generateContent' models available for this API Key.")
            
        # 3. Initialize
        # Note: older models like gemini-pro might not support system_instruction in constructor
        # We handle this gracefully
        if '1.5' in selected_model_name and system_instruction:
             return genai.GenerativeModel(selected_model_name, system_instruction=system_instruction)
        else:
             # Fallback for models that might not support system_instruction or if none provided
             if system_instruction:
                 print(f">>> Note: Model {selected_model_name} might not support system_instruction, sending as prompt prefix.")
             return genai.GenerativeModel(selected_model_name)

    except Exception as e:
        print(f"Model Selection Error: {e}")
        # Absolute fallback to string literal if list_models fails (e.g. key restriction)
        return genai.GenerativeModel('gemini-1.5-flash') 

# --- INLINE AGENT LOGIC (To avoid import issues) ---

def analyze_spending_logic(transactions_data):
    try:
        import pandas as pd
        if not transactions_data:
            return {"insight": "Chưa có dữ liệu giao dịch để phân tích.", "actions": []}

        df = pd.DataFrame([t.dict() for t in transactions_data])
        df['amount'] = pd.to_numeric(df['amount'])
        
        expenses = df[df['type'] == 'expense']
        if expenses.empty:
            return {"insight": "Bạn chưa có khoản chi tiêu nào.", "actions": ["Hãy ghi chép chi tiêu đầu tiên!"]}

        total_spent = expenses['amount'].sum()
        category_group = expenses.groupby('category')['amount'].sum().sort_values(ascending=False)
        top_category = category_group.index[0]
        top_amount = category_group.iloc[0]

        # Ask Gemini
        prompt = f"""
        Tôi là một trợ lý tài chính cá nhân. Người dùng đã chi tiêu tổng cộng {total_spent:,.0f} VND.
        Danh mục tốn kém nhất là '{top_category}' với {top_amount:,.0f} VND.
        Dữ liệu chi tiết: {category_group.to_string()}
        Hãy đưa ra 1 nhận xét ngắn gọn (dưới 50 từ) và 3 hành động tiết kiệm.
        Output JSON: {{ "insight": "...", "actions": [...] }}
        """
        
        model = get_generative_model()
        response = model.generate_content(prompt)
        text = response.text.replace('```json', '').replace('```', '').strip()
        import json
        return json.loads(text)
    except Exception as e:
        print(f"Analysis Logic Error: {e}")
        return {
            "insight": "Hiện tại chưa thể phân tích chi tiết do lỗi hệ thống.",
            "actions": ["Kiểm tra lại dữ liệu", "Thử lại sau"]
        }

def chat_advisor_logic(message: str, history: list = [], context: str = ""):
    try:
        system_instruction = """
        Bạn là **SmartLife AI** - Trợ lý ảo siêu thông minh và sắc bén. 🧠✨
        
        **Nhiệm vụ của bạn:**
        1. **Trả lời mọi câu hỏi:** Bạn có kiến thức rộng về tài chính, đời sống, học tập và phát triển bản thân.
        2. **Phân tích sắc bén:** Đưa ra lập luận chặt chẽ, rành mạch, đi thẳng vào vấn đề. Không trả lời chung chung.
        3. **Cá nhân hóa tối đa:** Dựa vào [DỮ LIỆU NGỮ CẢNH] được cung cấp (số dư, chi tiêu, thói quen...) để tư vấn sát sườn nhất.
        4. **Trình bày đẹp mắt:**
           - Luôn sử dụng **Emoji** 🌟 phù hợp để bài viết sinh động.
           - Dùng Markdown (In đậm, Gạch đầu dòng) để chia ý rõ ràng.
        
        **Phong cách:** Thông minh, hài hước một chút nhưng rất chuyên nghiệp và đáng tin cậy.
        """
        
        model = get_generative_model(system_instruction=system_instruction)
        
        # Basic history conversion (Limit to last 10 messages for speed)
        gemini_history = [{"role": "user" if msg["role"] == "user" else "model", "parts": [msg["content"]]} for msg in history[-10:]]
        
        # Start chat
        chat = model.start_chat(history=gemini_history)
        
        user_message = message
        if context:
            user_message = f"""
            [DỮ LIỆU NGỮ CẢNH CỦA NGƯỜI DÙNG]:
            {context}
            
            [CÂU HỎI]:
            {message}
            """
            
        # Some older models/libraries might behave differently with start_chat, 
        # but standard genai logic usually holds.
        response = chat.send_message(user_message)
        return response.text
    except Exception as e:
        print(f"Chat Logic Error: {e}")
        # Fallback manual generation content if chat session fails
        try:
             model = get_generative_model()
             full_prompt = f"{system_instruction}\n\nHistory: {history}\n\nUser: {message}"
             res = model.generate_content(full_prompt)
             return res.text
        except:
             return "Xin lỗi, tôi đang gặp trục trặc kết nối model. Bạn thử lại sau nhé! 😓"

def parse_schedule_logic(command: str, current_date: str):
    try:
        # Scheduler Prompt
        prompt = f"""
        Current Date: {current_date}
        User Command: "{command}"

        Task: Extract the schedule event details from the command.
        1. If it's a valid task/event, return a JSON object with:
           - title: (string) Short summary
           - start_time: (string) HH:MM format (24h)
           - end_time: (string) HH:MM format (guess duration if not specified, default 1 hour)
           - day_of_week: (int) 0=Sunday, 1=Monday, ..., 6=Saturday. Calculate based on Current Date.
           - location: (string or null)
        
        2. If the command involves a specific date (e.g. "Next Friday"), calculate the correct 'day_of_week'.
        3. If no time is specified, default to "08:00".
        4. If it's NOT a scheduling command, return {{ "error": "Not a schedule command" }}

        Example Input: "Học toán lúc 8h sáng mai" (Assuming today is Monday)
        Example Output: {{ "title": "Học Toán", "start_time": "08:00", "end_time": "09:00", "day_of_week": 2, "location": null }}

        Return ONLY the JSON string.
        """
        
        model = get_generative_model()
        response = model.generate_content(prompt)
        text = response.text.replace('```json', '').replace('```', '').strip()
        import json
        return json.loads(text)
    except Exception as e:
        print(f"Scheduler Logic Error: {e}")
        return {"error": "Không thể hiểu lệnh này. Vui lòng thử lại rõ ràng hơn."}

# --- ROUTES ---

@app.post("/chat_finance")
async def chat_finance(req: ChatRequest):
    print(f"Chat Request: {req.message}")
    response = chat_advisor_logic(req.message, req.history, req.context)
    return {"response": response}

@app.post("/analyze_finance")
async def analyze_finance(req: AnalysisRequest):
    print(f"Analyze Request: {len(req.transactions)} txns")
    return analyze_spending_logic(req.transactions)

@app.post("/parse_schedule")
async def parse_schedule(req: CommandRequest):
    print(f"Schedule Request: {req.command}")
    return parse_schedule_logic(req.command, req.current_date)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)