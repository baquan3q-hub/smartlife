import { Transaction } from '../types';

const getApiUrl = () => {
    // For local development with Vite proxy or Vercel production
    // Using relative path '/api' ensures compatibility across environments
    return '/api';
};

const API_URL = getApiUrl();
console.log("DEBUG: AI Service using API URL:", API_URL);

// Simple Health Check
fetch(`${API_URL}/health`)
    .then(res => res.json())
    .then(data => console.log("DEBUG: Backend Health Check:", data))
    .catch(err => console.error("DEBUG: Backend Verification FAILED:", err));

export const analyzeFinance = async (transactions: Transaction[]) => {
    try {
        const response = await fetch(`${API_URL}/analyze_finance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions })
        });

        if (!response.ok) throw new Error("Backend Error");
        return await response.json();
    } catch (error) {
        console.error("AI Analysis Failed:", error);
        return { insight: "Không thể phân tích dữ liệu lúc này. Hãy kiểm tra kết nối tới Python Backend.", actions: [] };
    }
};

export const parseScheduleCommand = async (command: string) => {
    try {
        const response = await fetch(`${API_URL}/parse_schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                command,
                current_date: new Date().toLocaleString('vi-VN')
            })
        });

        if (!response.ok) throw new Error("Backend Error");
        return await response.json();
    } catch (error) {
        console.error("Schedule Parse Failed:", error);
        return { error: "Không hiểu câu lệnh." };
    }
};

export const chatWithFinanceAdvisor = async (message: string, history: any[], context: string) => {
    try {
        // Filter history to simple format if needed, but backend handles it
        const response = await fetch(`${API_URL}/chat_finance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                history,
                context
            })
        });

        if (!response.ok) throw new Error("Backend Error");
        return await response.json();
    } catch (error) {
        console.error("AI Chat Failed:", error);
        return { response: "⚠️ Lỗi kết nối tới Python Backend. Hãy đảm bảo bạn đã chạy 'npm run dev' và cửa sổ Python không bị lỗi." };
    }
};
