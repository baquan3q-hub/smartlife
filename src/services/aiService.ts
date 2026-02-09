import { AppState } from '../types';

// Read API key from Vite env
const API_KEY: string = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';

// Direct REST API — no SDK dependency issues
const API_BASE = 'https://generativelanguage.googleapis.com';

// Try these endpoints in order until one works
const ENDPOINTS = [
    { url: `${API_BASE}/v1beta/models/gemini-2.0-flash-lite:generateContent`, name: 'Gemini 2.0 Flash Lite' },
    { url: `${API_BASE}/v1beta/models/gemini-2.0-flash:generateContent`, name: 'Gemini 2.0 Flash' },
    { url: `${API_BASE}/v1/models/gemini-1.5-flash:generateContent`, name: 'Gemini 1.5 Flash' },
    { url: `${API_BASE}/v1/models/gemini-pro:generateContent`, name: 'Gemini Pro' },
];

if (API_KEY) {
    console.log('✅ AI API Key loaded');
} else {
    console.warn('⚠️ VITE_GEMINI_API_KEY not found');
}

const SYSTEM_PROMPT = `BẠN LÀ MỘT NGƯỜI CỐ VẤN TÀI CHÍNH VÀ CUỘC SỐNG THÔNG MINH, TẬN TÂM VÀ CÓ CHỈ SỐ EQ CAO.

Mục tiêu:
1. Lắng nghe và thấu hiểu vấn đề của người dùng.
2. Phân tích dựa trên dữ liệu thật (được cung cấp trong phần CONTEXT).
3. Đưa ra lời khuyên CỤ THỂ, KHẢ THI và TÍCH CỰC.
4. Luôn giữ thái độ động viên, khích lệ nhưng không sáo rỗng. Hãy như một người bạn thân thông thái.

Phong cách:
- Dùng ngôn ngữ tự nhiên, gần gũi, ấm áp (Tiếng Việt).
- Sử dụng Markdown để trình bày rõ ràng.
- Đặt câu hỏi ngược lại để gợi mở nếu cần.
- KHÔNG BAO GIỜ phán xét cách chi tiêu, hãy tìm cách tối ưu hóa.
- Trả lời ngắn gọn nhưng ý nghĩa, không quá 200 từ trừ khi cần phân tích chi tiết.`;

// Track which endpoint works so we don't retry every time
let workingEndpointIndex = 0;

async function callGeminiAPI(prompt: string): Promise<string> {
    const body = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
        }
    });

    // Try from last known working endpoint
    for (let i = workingEndpointIndex; i < ENDPOINTS.length; i++) {
        const endpoint = ENDPOINTS[i];
        try {
            const res = await fetch(`${endpoint.url}?key=${API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            });

            if (res.status === 404) {
                console.warn(`⚠️ ${endpoint.name}: not available, trying next...`);
                continue;
            }

            if (res.status === 429) {
                throw new Error('QUOTA_EXCEEDED');
            }

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData?.error?.message || `HTTP ${res.status}`);
            }

            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                workingEndpointIndex = i; // Remember this endpoint works
                console.log(`✅ AI responded via: ${endpoint.name}`);
                return text;
            }
        } catch (err: any) {
            if (err.message === 'QUOTA_EXCEEDED') throw err;
            if (i === ENDPOINTS.length - 1) throw err;
            console.warn(`⚠️ ${endpoint.name} failed: ${err.message}`);
        }
    }

    throw new Error('NO_MODEL_AVAILABLE');
}

export const aiService = {
    async sendMessage(message: string, context: string): Promise<string> {
        if (!API_KEY) {
            return "⚠️ Chưa cấu hình API Key. Hãy thêm `VITE_GEMINI_API_KEY` vào file `.env.local`.";
        }

        try {
            const fullPrompt = `${SYSTEM_PROMPT}\n\nDữ liệu hiện tại của người dùng (CONTEXT):\n${context}\n\nNgười dùng hỏi: ${message}`;
            return await callGeminiAPI(fullPrompt);
        } catch (error: any) {
            console.error("AI Error:", error);
            if (error.message === 'QUOTA_EXCEEDED') {
                return "⚠️ Đã hết quota API tạm thời. Đợi 1 phút rồi thử lại nhé!";
            }
            if (error.message === 'NO_MODEL_AVAILABLE') {
                return "⚠️ Không tìm thấy model AI khả dụng. Hãy kiểm tra API Key.";
            }
            return `Xin lỗi, đã xảy ra lỗi: ${error.message}`;
        }
    },

    gatherContext(state: AppState): string {
        const { profile, todos, goals, transactions } = state as any;

        let context = "THÔNG TIN NGƯỜI DÙNG:\n";
        if (profile?.full_name) context += `- Tên: ${profile.full_name}\n`;

        const pendingTodos = (todos || []).filter((t: any) => !t.is_completed);
        context += `\nCÔNG VIỆC CẦN LÀM (${pendingTodos.length}):\n`;
        pendingTodos.slice(0, 5).forEach((t: any) => {
            context += `- ${t.content} (${t.priority})${t.deadline ? ` [Hạn: ${new Date(t.deadline).toLocaleDateString('vi-VN')}]` : ''}\n`;
        });

        const activeGoals = goals || [];
        if (activeGoals.length > 0) {
            context += `\nMỤC TIÊU (${activeGoals.length}):\n`;
            activeGoals.slice(0, 3).forEach((g: any) => {
                context += `- ${g.title} (${g.type})${g.deadline ? ` [Hạn: ${new Date(g.deadline).toLocaleDateString('vi-VN')}]` : ''}\n`;
            });
        }

        if (transactions && transactions.length > 0) {
            context += `\nGIAO DỊCH GẦN ĐÂY:\n`;
            transactions.slice(0, 5).forEach((t: any) => {
                context += `- ${t.date}: ${t.is_expense ? '-' : '+'}${t.amount?.toLocaleString()}đ (${t.category})\n`;
            });
        }

        return context;
    }
};
