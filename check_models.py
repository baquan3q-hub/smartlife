import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv('.env.local')

api_key = os.getenv("VITE_GEMINI_API_KEY")
genai.configure(api_key=api_key)

with open("models.txt", "w", encoding="utf-8") as f:
    try:
        f.write(f"Using Key: {api_key[:5]}...{api_key[-5:]}\n")
        f.write("Listing models...\n")
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                f.write(f"{m.name}\n")
    except Exception as e:
        f.write(f"Error listing models: {e}\n")
