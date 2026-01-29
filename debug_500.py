import requests
import json
from datetime import datetime

url = "http://localhost:8000/parse_schedule"
payload = {
    "command": "Học toán lúc 8h sáng mai",
    "current_date": datetime.now().isoformat()
}

try:
    print(f"Sending request to {url}...")
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")
except Exception as e:
    print(f"Request failed: {e}")
