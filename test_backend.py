import requests
import json

BASE_URL = "http://localhost:8000"

def test_chat():
    try:
        print("\nTesting /chat_finance ...")
        payload = {"message": "Hello"}
        resp = requests.post(f"{BASE_URL}/chat_finance", json=payload)
        with open("error_log.txt", "w", encoding="utf-8") as f:
            f.write(json.dumps(resp.json(), indent=2, ensure_ascii=False))
    except Exception as e:
        with open("error_log.txt", "w", encoding="utf-8") as f:
            f.write(f"Failed: {e}")

if __name__ == "__main__":
    test_chat()
