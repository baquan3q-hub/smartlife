// File: src/services/chatHistoryService.ts
// Service to manage AI Chat History in Supabase

import { supabase } from './supabase';
import type { ChartData, ActionResult, AIRunMeta } from './aiEngine';

export interface AIConversation {
    id: string;
    user_id: string;
    title: string;
    is_pinned?: boolean;
    /** Chế độ chuyên gia của cuộc trò chuyện (sql/ai_companion_upgrade.sql); null = Chung */
    expert_mode?: string | null;
    created_at: string;
    updated_at: string;
}

// ai_messages.meta — mọi thông tin phụ của một tin, thêm trường mới không cần migration
export interface AIMessageMeta extends AIRunMeta {
    tokens_used?: number;
    feedback?: 'up' | 'down';
    files?: Array<{ name: string; type: string; size: number }>;
    /** Lời chào chủ động của Bạn đồng hành (AI nhắn trước khi người dùng mở trang) */
    greeting?: boolean;
}

export interface AIMessage {
    id: string;
    conversation_id: string;
    role: 'user' | 'assistant';
    content: string;
    charts?: ChartData[] | null;
    actions?: ActionResult[] | null;
    meta?: AIMessageMeta | null;
    deleted_at?: string | null;
    created_at: string;
}

async function touchConversation(conversationId: string) {
    await supabase
        .from('ai_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
}

export const chatHistoryService = {
    // Lấy danh sách các cuộc trò chuyện của user
    async getConversations(): Promise<AIConversation[]> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const { data, error } = await supabase
                .from('ai_conversations')
                .select('*')
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false });

            if (error) return [];
            return data || [];
        } catch { return []; }
    },

    // Lấy tin nhắn trong một cuộc trò chuyện
    async getMessages(conversationId: string): Promise<AIMessage[]> {
        try {
            const { data, error } = await supabase
                .from('ai_messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .is('deleted_at', null)
                .order('created_at', { ascending: true });

            if (error) return [];
            return data || [];
        } catch { return []; }
    },

    // Tạo cuộc trò chuyện mới
    async createConversation(title: string = 'Cuộc trò chuyện mới', expertMode?: string | null): Promise<AIConversation | null> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            const row: Record<string, any> = { user_id: user.id, title };
            if (expertMode && expertMode !== 'general') row.expert_mode = expertMode;
            let { data, error } = await supabase
                .from('ai_conversations')
                .insert([row])
                .select()
                .single();
            // DB chưa chạy migration thêm cột expert_mode → tạo lại không kèm cột này
            if (error && row.expert_mode) {
                ({ data, error } = await supabase
                    .from('ai_conversations')
                    .insert([{ user_id: user.id, title }])
                    .select()
                    .single());
            }

            if (error) return null;
            return data;
        } catch { return null; }
    },

    // Lưu chế độ chuyên gia của cuộc trò chuyện (null = Chung)
    async updateConversationExpert(id: string, expertMode: string | null): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('ai_conversations')
                .update({ expert_mode: expertMode && expertMode !== 'general' ? expertMode : null })
                .eq('id', id);
            return !error;
        } catch { return false; }
    },

    // Update tiêu đề cuộc trò chuyện
    async updateConversationTitle(id: string, title: string): Promise<boolean> {
        const { error } = await supabase
            .from('ai_conversations')
            .update({ title, updated_at: new Date().toISOString() })
            .eq('id', id);

        return !error;
    },

    // Xóa cuộc trò chuyện
    async deleteConversation(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('ai_conversations')
            .delete()
            .eq('id', id);

        return !error;
    },

    // Toggle ghim/pin cuộc trò chuyện
    async togglePinConversation(id: string, isPinned: boolean): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('ai_conversations')
                .update({ is_pinned: isPinned })
                .eq('id', id);
            return !error;
        } catch { return false; }
    },

    // Lưu một tin nhắn (meta: tầng tốc độ, suy nghĩ, các bước, phản hồi 👍/👎, file đính kèm…)
    async saveMessage(
        conversationId: string,
        role: 'user' | 'assistant',
        content: string,
        extras: { charts?: ChartData[]; actions?: ActionResult[]; meta?: AIMessageMeta } = {}
    ): Promise<AIMessage | null> {
        try {
            const { charts, actions, meta } = extras;
            const payload: Record<string, unknown> = {
                conversation_id: conversationId,
                role,
                content,
                charts: charts?.length ? charts : null,
                actions: actions?.length ? actions : null,
                meta: meta && Object.keys(meta).length ? meta : null,
            };

            const { data, error } = await supabase
                .from('ai_messages')
                .insert([payload])
                .select()
                .single();

            if (error) {
                console.warn('[chatHistoryService] saveMessage failed:', error.message);
                return null;
            }

            await touchConversation(conversationId);
            return data;
        } catch { return null; }
    },

    // Ghi đè meta của một tin (vd. 👍/👎)
    async updateMessageMeta(id: string, meta: AIMessageMeta): Promise<boolean> {
        try {
            const { error } = await supabase.from('ai_messages').update({ meta }).eq('id', id);
            return !error;
        } catch { return false; }
    },

    // Xoá mềm một tin (vẫn còn trong DB, không gửi cho AI nữa)
    async softDeleteMessage(id: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('ai_messages')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id);
            return !error;
        } catch { return false; }
    },

    // "Quay lại đây": xoá mềm tin này và mọi tin sau nó trong cuộc trò chuyện
    async softDeleteFrom(conversationId: string, fromCreatedAt: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('ai_messages')
                .update({ deleted_at: new Date().toISOString() })
                .eq('conversation_id', conversationId)
                .gte('created_at', fromCreatedAt)
                .is('deleted_at', null);
            if (!error) await touchConversation(conversationId);
            return !error;
        } catch { return false; }
    },
};
