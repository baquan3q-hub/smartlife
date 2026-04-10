// File: src/services/memoryService.ts
// Service to manage AI Long-term Memory in Supabase

import { supabase } from './supabase';
import { callGeminiRaw, SYSTEM_INSTRUCTION } from './geminiService';

export interface AIMemory {
    id: string;
    user_id: string;
    memory_type: 'preference' | 'fact' | 'habit' | 'goal_note';
    content: string;
    importance: number;
    created_at: string;
}

export const memoryService = {
    // Lấy toàn bộ bộ nhớ của user (để nạp vào context)
    async getMemories(): Promise<AIMemory[]> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const { data, error } = await supabase
                .from('ai_memory')
                .select('*')
                .eq('user_id', user.id)
                .order('importance', { ascending: false });

            if (error) return [];
            return data || [];
        } catch { return []; }
    },

    // Format memory thành chuỗi văn bản cho system prompt
    async getMemoryContextString(): Promise<string> {
        const memories = await this.getMemories();
        if (memories.length === 0) return '';

        return memories.map(m => `- [${m.memory_type}] ${m.content} (Độ quan trọng: ${m.importance}/10)`).join('\n');
    },

    // Lưu một memory mới
    async saveMemory(
        memory_type: 'preference' | 'fact' | 'habit' | 'goal_note',
        content: string,
        importance: number = 5
    ): Promise<AIMemory | null> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            const { data, error } = await supabase
                .from('ai_memory')
                .insert([{ user_id: user.id, memory_type, content, importance }])
                .select()
                .single();

            if (error) return null;
            return data;
        } catch { return null; }
    },

    // Xóa một memory
    async deleteMemory(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('ai_memory')
            .delete()
            .eq('id', id);

        return !error;
    },

    // Tự động phân tích hội thoại và trích xuất facts (Chạy ngầm sau mỗi buổi chat)
    async extractMemoriesFromConversation(chatHistory: string): Promise<void> {

        const prompt = `Phân tích đoạn chat sau giữa User và AI Advisor.
Hãy trích xuất các "facts" (sự thật), "preferences" (sở thích), "habits" (thói quen) hoặc "goal_notes" (lưu ý mục tiêu) về người dùng có thể hữu ích cho các cuộc trò chuyện TƯƠNG LAI.
Chỉ trích xuất những thông tin ĐÁNG NHỚ dài hạn (VD: "User đang tiết kiệm mua xe máy", "User không thích ăn hải sản", "User thường ngủ dậy lúc 6h"). KHÔNG trích xuất các giao dịch cụ thể hay thông tin đã có trong Database.

Đoạn chat:
${chatHistory}

Định dạng trả về là JSON Array: [{"type": "fact|preference|habit|goal_note", "content": "nội dung tiếng Việt", "importance": 1-10}]. Trả về [] nếu không có gì đáng nhớ.`;

        const body = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.2
            }
        };

        try {
            const result = await callGeminiRaw(body);
            const textResponse = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textResponse) {
                const extracted: Array<{type: any; content: string; importance: number}> = JSON.parse(textResponse);
                
                // Lưu từng memory
                for (const item of extracted) {
                    await this.saveMemory(item.type, item.content, item.importance);
                }
            }
        } catch (error) {
            console.error('Error extracting memories:', error);
        }
    }
};
