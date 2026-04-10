// File: src/services/chatHistoryService.ts
// Service to manage AI Chat History in Supabase

import { supabase } from './supabase';
import type { ChartData, ActionResult } from './aiEngine';

export interface AIConversation {
    id: string;
    user_id: string;
    title: string;
    created_at: string;
    updated_at: string;
}

export interface AIMessage {
    id: string;
    conversation_id: string;
    role: 'user' | 'assistant';
    content: string;
    charts?: ChartData[];
    actions?: ActionResult[];
    created_at: string;
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
                .order('created_at', { ascending: true });

            if (error) return [];
            return data || [];
        } catch { return []; }
    },

    // Tạo cuộc trò chuyện mới
    async createConversation(title: string = 'Cuộc trò chuyện mới'): Promise<AIConversation | null> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            const { data, error } = await supabase
                .from('ai_conversations')
                .insert([{ user_id: user.id, title }])
                .select()
                .single();

            if (error) return null;
            return data;
        } catch { return null; }
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

    // Lưu một tin nhắn
    async saveMessage(
        conversationId: string,
        role: 'user' | 'assistant',
        content: string,
        charts?: ChartData[],
        actions?: ActionResult[]
    ): Promise<AIMessage | null> {
        try {
            const { data, error } = await supabase
                .from('ai_messages')
                .insert([{
                    conversation_id: conversationId,
                    role,
                    content,
                    charts: charts?.length ? charts : null,
                    actions: actions?.length ? actions : null
                }])
                .select()
                .single();

            if (error) return null;

            // Cập nhật updated_at của conversation
            await supabase
                .from('ai_conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', conversationId);

            return data;
        } catch { return null; }
    }
};
