import google.generativeai as genai
import os
import json
from datetime import datetime

async def parse_command(command: str, current_date: str):
    """
    Parses a natural language command into a structured Schedule Event JSON.
    """
    try:
        api_key = os.getenv("VITE_GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY")
        genai.configure(api_key=api_key)
        # Use a model robust at JSON extraction
        model = genai.GenerativeModel('gemini-flash-latest')
        
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
        
        response = model.generate_content(prompt)
        text_response = response.text.replace('```json', '').replace('```', '').strip()
        data = json.loads(text_response)
        
        return data

    except Exception as e:
        print(f"Scheduler AI Error: {e}")
        return {"error": "Không thể hiểu lệnh này. Vui lòng thử lại rõ ràng hơn."}
