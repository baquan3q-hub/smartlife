import { AppState } from '../types';

// The URL is dynamically calculated. If in dev mode, we might hit localhost:8000
// But due to Vite proxy in vite.config.ts or Vercel Rewrites, hitting '/api/ai/chat' is preferred.
const API_BASE_URL = '/api/ai';

export const aiService = {
    async sendMessage(message: string, context: string): Promise<string> {
        try {
            const res = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, context }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData?.detail || `HTTP Error ${res.status}`);
            }

            const data = await res.json();
            return data.content || "Không có phản hồi từ máy chủ AI.";

        } catch (error: any) {
            console.error("AI Error:", error);
            if (error.message.includes('Failed to fetch')) {
                // If API is running on localhost:8000 while React is on localhost:5173 without proxy
                // Fallback attempt to full localhost URL for local dev
                try {
                    console.log("Thử gọi bằng Absolute URL localhost:8000...");
                    const fallbackRes = await fetch(`http://localhost:8000/api/ai/chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message, context }),
                    });
                    if (fallbackRes.ok) {
                        const fallbackData = await fallbackRes.json();
                        return fallbackData.content || "Không có phản hồi từ máy chủ AI.";
                    }
                } catch (e) {
                    return "⚠️ Lỗi kết nối tới Backend AI (Server có thể chưa được bật).";
                }
            }
            return `Xin lỗi, đã xảy ra lỗi từ Backend: ${error.message}`;
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
