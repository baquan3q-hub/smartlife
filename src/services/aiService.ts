// src/services/aiService.ts
import { Transaction } from '../types';

const API_URL = '/api';

export const analyzeFinance = async (transactions: Transaction[]) => {
    try {
        console.log("Analyzing Finance...", transactions.length);
        const response = await fetch(`${API_URL}/analyze_finance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions, user_goal: null }),
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`Analyze Error ${response.status}:`, text);
            throw new Error(`Server error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("AI Analysis Failed:", error);
        return null;
    }
};

export const parseScheduleCommand = async (command: string) => {
    try {
        console.log("Parsing Schedule:", command);
        const response = await fetch(`${API_URL}/parse_schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                command,
                current_date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`Schedule Error ${response.status}:`, text);
            throw new Error(`Server error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("AI Command Failed:", error);
        return { error: "Failed to connect to AI" };
    }
};

export const chatWithFinanceAdvisor = async (message: string, history: any[], context: string) => {
    try {
        console.log("Chatting with Advisor:", message);
        const response = await fetch(`${API_URL}/chat_finance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, history, context }),
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`Chat Error ${response.status}:`, text);
            throw new Error(`Server error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("AI Chat Failed:", error);
        return { response: "Xin lỗi, tôi không thể kết nối tới máy chủ AI (Kiểm tra terminal: python main.py). 😓" };
    }
};
