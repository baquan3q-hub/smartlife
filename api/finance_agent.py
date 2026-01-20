import pandas as pd
import google.generativeai as genai
import os

def analyze_spending(transactions_data):
    """
    Analyzes spending data and returns insights + specific actions.
    """
    if not transactions_data:
        return {"insight": "Chưa có dữ liệu giao dịch để phân tích.", "actions": []}

    # 1. Convert to DataFrame
    df = pd.DataFrame([t.dict() for t in transactions_data])
    df['amount'] = pd.to_numeric(df['amount'])
    
    # Filter only expenses
    expenses = df[df['type'] == 'expense']
    if expenses.empty:
        return {"insight": "Bạn chưa có khoản chi tiêu nào.", "actions": ["Hãy ghi chép chi tiêu đầu tiên!"]}

    total_spent = expenses['amount'].sum()
    category_group = expenses.groupby('category')['amount'].sum().sort_values(ascending=False)
    top_category = category_group.index[0]
    top_amount = category_group.iloc[0]

    # 2. Ask Gemini for Advice
    try:
        api_key = os.getenv("VITE_GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY")
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-flash-latest')
        
        prompt = f"""
        Tôi là một trợ lý tài chính cá nhân. Người dùng đã chi tiêu tổng cộng {total_spent:,.0f} VND.
        Danh mục tốn kém nhất là '{top_category}' với {top_amount:,.0f} VND.
        
        Dữ liệu chi tiết theo danh mục:
        {category_group.to_string()}

        Hãy đưa ra 1 nhận xét ngắn gọn (dưới 50 từ) về thói quen chi tiêu này và đề xuất 3 hành động cụ thể để tiết kiệm hiệu quả hơn.
        Output dạng JSON: {{ "insight": "...", "actions": ["...", "...", "..."] }}
        """
        
        response = model.generate_content(prompt)
        text_response = response.text.replace('```json', '').replace('```', '').strip()
        import json
        return json.loads(text_response)

    except Exception as e:
        print(f"AI Error: {e}")
        # Fallback if AI fails
        return {
            "insight": f"Bạn đang chi tiêu nhiều nhất cho {top_category} ({top_amount:,.0f}đ). Cần cân nhắc giảm bớt.",
            "actions": [f"Đặt hạn mức cho {top_category}", "Tìm phương án thay thế rẻ hơn", "Theo dõi sát sao hơn vào tuần tới"]
        }

def chat_with_advisor(message: str, history: list = [], context: str = ""):
    try:
        api_key = os.getenv("VITE_GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY")
        genai.configure(api_key=api_key)
        
        # System prompt to define the persona
        system_instruction = """
        Bạn là một chuyên gia tư vấn tài chính cá nhân thông minh, thân thiện và am hiểu.
        Tên của bạn là "SmartLife Finance Advisor".
        Nhiệm vụ của bạn là giải đáp các thắc mắc về tài chính, đưa ra lời khuyên tiết kiệm, đầu tư, và quản lý ngân sách.
        
        Phong cách trả lời:
        - Ngắn gọn, súc tích, đi thẳng vào vấn đề.
        - Dùng emoji 💰 phù hợp để tạo cảm giác thân thiện.
        - Dữ liệu ngữ cảnh sẽ được cung cấp dưới dạng JSON chứa 'summary' và 'recent_transactions'.
        - 'recent_transactions' là danh sách rút gọn: d=ngày, c=danh mục, a=số tiền, t=loại (Thu/Chi), n=ghi chú.
        - Nếu người dùng hỏi chi tiết (ví dụ: "liệt kê chi tiêu cho ăn uống"), hãy DÙNG dữ liệu trong 'recent_transactions' để liệt kê cụ thể.
        - **Định dạng trả lời:**
          + Sử dụng **Bảng Markdown** (Table) để liệt kê các giao dịch hoặc so sánh số liệu (Cột: Ngày | Số tiền | Ghi chú).
          + Sử dụng **Gạch đầu dòng** (Bullet points) cho các lời khuyên, nhận xét hoặc các ý chính.
          + Không viết thành đoạn văn dài dòng khó đọc.
        - Luôn khích lệ người dùng.
        """

        model = genai.GenerativeModel('gemini-flash-latest', system_instruction=system_instruction)
        
        # Build chat history for Gemini
        chat = model.start_chat(history=[
            {"role": "user" if msg["role"] == "user" else "model", "parts": [msg["content"]]} 
            for msg in history
        ])
        
        # Add context if provided (e.g., current spending summary)
        user_message = message
        if context:
            user_message = f"""
            [Dữ liệu tài chính hiện tại (JSON): {context}]
            
            Câu hỏi của người dùng: {message}
            """
            
        response = chat.send_message(user_message)
        return response.text
        
    except Exception as e:
        print(f"Chat Error: {e}")
        error_str = str(e)
        if "429" in error_str or "ResourceExhausted" in error_str:
             return "⚠️ Hết hạn mức AI hôm nay (Quota Exceeded). Google Gemini Free Tier có giới hạn số lần hỏi. Vui lòng thử lại sau hoặc ngày mai! ⏳"
        return "Xin lỗi, tôi đang gặp chút trục trặc khi kết nối với máy chủ AI. Bạn hãy thử lại sau nhé! 😓"
