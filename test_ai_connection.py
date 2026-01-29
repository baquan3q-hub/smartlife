import google.generativeai as genai
import os
from dotenv import load_dotenv

# Load .env.local explicitly
load_dotenv('.env.local')

api_key = os.getenv("VITE_GEMINI_API_KEY")

print(f"Loaded API Key: {api_key[:10]}..." if api_key else "NO API KEY FOUND")

if not api_key:
    print("❌ ERROR: No API Key found in .env.local")
    exit(1)

genai.configure(api_key=api_key)

print("\n--- Testing Model: gemini-1.5-flash ---")
try:
    model = genai.GenerativeModel('gemini-1.5-flash')
    response = model.generate_content("Hello, working?")
    print(f"SUCCESS! Response: {response.text}")
except Exception as e:
    print(f"FAILED: {e}")

print("\n--- Listing Available Models ---")
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods and 'flash' in m.name:
            print(f"FOUND_MODEL: {m.name}")
except Exception as e:
    print(f"FAILED to list models: {e}")
