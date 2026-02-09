import { Transaction } from '../types';

const getApiUrl = () => {
    // For local development with Vite proxy or Vercel production
    // Using relative path '/api' ensures compatibility across environments
    return '/api';
};

const API_URL = getApiUrl();
console.log("DEBUG: Finance Service using API URL:", API_URL);

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
        console.error("Analysis Failed:", error);
        return { insight: "Tính năng phân tích đang bảo trì.", actions: [] };
    }
};
