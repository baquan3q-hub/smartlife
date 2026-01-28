import { GoogleGenerativeAI } from '@google/generative-ai';
import { Transaction } from '../types';

// Lấy API Key từ biến môi trường (Hỗ trợ cả Vite và process.env)
// Ưu tiên import.meta.env vì Vite bundle
const API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";

// Khởi tạo Gemini Client (Chỉ khi có key, nếu không sẽ lỗi runtime khi gọi hàm)
let genAI: any = null;
let model: any = null;

if (API_KEY) {
    genAI = new GoogleGenerativeAI(API_KEY);
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

export const analyzeFinance = async (transactions: Transaction[]) => {
    if (!model) {
        console.error("Missing API Key");
        return { insight: "⚠️ Chưa cấu hình API Key. Hãy thêm VITE_GEMINI_API_KEY vào biến môi trường.", actions: [] };
    }

    try {
        const prompt = `
            Bạn là chuyên gia tài chính cá nhân. Dưới đây là danh sách giao dịch gần đây (JSON):
            ${JSON.stringify(transactions.slice(0, 50))}

            Hãy phân tích tình hình tài chính và trả về JSON chuẩn theo mẫu sau (KHÔNG dùng markdown code block):
            { 
                "insight": "Một câu nhận xét sâu sắc về thói quen chi tiêu...", 
                "actions": ["Hành động 1...", "Hành động 2...", "Hành động 3..."] 
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean markdown formatting if present
        const jsonStr = text.replace(/```json|```/g, '').trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error("AI Analysis Failed:", error);
        return { insight: "Không thể phân tích dữ liệu lúc này.", actions: [] };
    }
};

export const parseScheduleCommand = async (command: string) => {
    if (!model) return { error: "Missing API Key" };

    try {
        const prompt = `
            Hiện tại là: ${new Date().toLocaleString('vi-VN')}
            Câu lệnh: "${command}"
            
            Trích xuất thông tin lịch trình thành JSON (KHÔNG markdown):
            {
                "subject": "Tên sự kiện",
                "room": "Địa điểm/Ghi chú",
                "start_time": "ISO 8601 string",
                "end_time": "ISO 8601 string"
            }
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonStr = text.replace(/```json|```/g, '').trim();

        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Schedule Parse Failed:", error);
        return { error: "Không hiểu câu lệnh." };
    }
};

export const chatWithFinanceAdvisor = async (message: string, history: any[], context: string) => {
    if (!API_KEY) return { response: "⚠️ Chưa có API Key. Vui lòng thêm VITE_GEMINI_API_KEY vào Vercel Environment Variables." };

    try {
        if (!genAI) {
            genAI = new GoogleGenerativeAI(API_KEY);
            model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        }

        // Convert format history cho phù hợp với Gemini SDK (user/model)
        // Lưu ý: SDK yêu cầu 'user' hoặc 'model', không phải 'assistant'
        const geminiHistory = history.map(h => ({
            role: h.role === 'assistant' || h.role === 'model' ? 'model' : 'user',
            parts: [{ text: h.content }]
        }));

        const chat = model.startChat({
            history: geminiHistory,
            generationConfig: { maxOutputTokens: 800 },
        });

        // Context injection
        const promptWithContext = `
            [SYSTEM CONTEXT - DỮ LIỆU THỰC TẾ]:
            ${context}

            [USER QUESTION]:
            ${message}

            [INSTRUCTION]:
            Trả lời thân thiện, ngắn gọn, sử dụng Emoji. Dùng Markdown để định dạng (bold, list).
        `;

        const result = await chat.sendMessage(promptWithContext);
        const response = await result.response;
        return { response: response.text() };

    } catch (error: any) {
        console.error("AI Chat Failed:", error);
        if (error.message?.includes('429')) return { response: "⚠️ AI đang bận (Quá tải). Thử lại sau 1 phút nhé!" };
        return { response: "Xin lỗi, có lỗi kết nối tới AI. Vui lòng kiểm tra mạng hoặc API Key." };
    }
};
