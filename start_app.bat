@echo off
echo ===================================================
echo   KHOI DONG HE THONG SMARTLIFE (AI + WEB)
echo ===================================================

echo 1. Kich hoat hiep si AI (Backend)...
start "SmartLife AI Backend" cmd /k "call venv\Scripts\activate && python -m uvicorn src.main:app --reload --port 8000"

echo 2. Kich hoat giao dien Web (Frontend)...
start "SmartLife Web App" cmd /k "npm run dev"

echo ===================================================
echo   DA KHOI DONG XONG!
echo   - Backend chay tai: http://localhost:8000
echo   - Web App chay tai: http://localhost:5173 (hoac 3000)
echo ===================================================
timeout /t 5
