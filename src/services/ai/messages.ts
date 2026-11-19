// File: src/services/ai/messages.ts
// Danh sách tin trên màn hình chat là nguồn sự thật duy nhất: lịch sử gửi cho Gemini được dựng lại từ đây,
// nên xoá / quay lại / tạo lại tin chỉ cần sửa danh sách này (và xoá mềm trong DB) là AI tự "quên" theo.

import type { ChatMessage } from '../geminiService';
import type { AIAttachment, ActionResult, ChartData } from '../aiEngine';
import type { AIMessage, AIMessageMeta } from '../chatHistoryService';
import { clarificationToText } from './clarify';

export type UIMessageStatus = 'streaming' | 'done' | 'stopped' | 'error';

export interface UIMessage {
    id: string;              // khoá trên giao diện (ổn định suốt vòng đời tin)
    dbId?: string;           // id trong ai_messages (chưa lưu thì không có)
    createdAt?: string;      // created_at trong DB — mốc để "quay lại" xoá mềm từ đây trở đi
    role: 'user' | 'assistant';
    content: string;         // chữ hiển thị (tin người dùng có thêm dòng 📎 tên tệp)
    fileContext?: string;    // nội dung tệp chữ / Excel đã đọc, chỉ gửi cho AI trong phiên này
    attachments?: AIAttachment[]; // ảnh / PDF / âm thanh dạng base64, giữ trong phiên để "Tạo lại"
    charts?: ChartData[];
    actions?: ActionResult[];
    meta?: AIMessageMeta;
    status?: UIMessageStatus;
    startedAt?: number;      // lúc bắt đầu trả lời (đếm giây khi đang suy nghĩ)
    local?: boolean;         // lời chào / thông báo của giao diện — không gửi cho AI, không lưu
}

export function newMessageId(): string {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    } catch { /* môi trường không hỗ trợ */ }
    return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

const FILE_LINE = /^📎 \*\*.+\*\* \([\d.,]+ KB\)$/;

// Chữ người dùng tự gõ (bỏ các dòng 📎 tệp đính kèm) — dùng khi sửa / quay lại
export function editableText(message: Pick<UIMessage, 'content'>): string {
    const lines = message.content.split('\n');
    while (lines.length && (FILE_LINE.test(lines[lines.length - 1].trim()) || !lines[lines.length - 1].trim())) {
        lines.pop();
    }
    return lines.join('\n').trim();
}

// Tin có được tính vào ngữ cảnh gửi cho AI không
function isContextual(m: UIMessage): boolean {
    if (m.local) return false;
    if (m.status === 'streaming' || m.status === 'error') return false;
    if (m.meta?.error) return false;
    return true;
}

// Dựng lịch sử cho Gemini: chỉ text (không gửi lại suy nghĩ / lệnh gọi hàm của các lượt trước),
// bỏ tin trống, lỗi, đang chạy; bỏ tin AI đứng đầu; gộp các tin liền nhau cùng vai.
export function toGeminiHistory(messages: UIMessage[]): ChatMessage[] {
    const turns: Array<{ role: 'user' | 'model'; texts: string[] }> = [];
    for (const m of messages) {
        if (!isContextual(m)) continue;
        // Tin AI dừng lại để hỏi (ask_user): thêm câu hỏi + lựa chọn để lượt sau model biết mình đã hỏi gì
        const asked = m.role === 'assistant' && m.meta?.clarification ? '\n\n' + clarificationToText(m.meta.clarification, m.content) : '';
        const text = (m.content + asked + (m.role === 'user' && m.fileContext ? m.fileContext : '')).trim();
        if (!text) continue;
        const role = m.role === 'user' ? 'user' : 'model';
        if (!turns.length && role === 'model') {
            // Lời chào chủ động của Bạn đồng hành: giữ lại, kèm lượt người dùng giả để lịch sử bắt đầu bằng 'user'
            if (!m.meta?.greeting) continue;
            turns.push({ role: 'user', texts: ['(người dùng vừa mở ứng dụng)'] });
        }
        const last = turns[turns.length - 1];
        if (last && last.role === role) last.texts.push(text);
        else turns.push({ role, texts: [text] });
    }
    return turns.map(t => ({ role: t.role, parts: [{ text: t.texts.join('\n\n') }] }));
}

export function fromStoredMessage(row: AIMessage): UIMessage {
    const meta = row.meta || undefined;
    return {
        id: row.id,
        dbId: row.id,
        createdAt: row.created_at,
        role: row.role,
        content: row.content,
        charts: row.charts || undefined,
        actions: row.actions || undefined,
        meta,
        status: meta?.error ? 'error' : meta?.stopped ? 'stopped' : 'done',
    };
}

export function fromStoredMessages(rows: AIMessage[]): UIMessage[] {
    return rows.map(fromStoredMessage);
}

// created_at của tin đã lưu đầu tiên tính từ vị trí index — dùng cho softDeleteFrom.
// null nghĩa là từ đó trở đi không có tin nào trong DB (chỉ cần cắt trên giao diện).
export function cutoffFrom(messages: UIMessage[], index: number): string | null {
    for (let i = Math.max(0, index); i < messages.length; i++) {
        const m = messages[i];
        if (m.dbId && m.createdAt) return m.createdAt;
    }
    return null;
}

// "Quay lại đây" / "Sửa & gửi lại" trên tin người dùng: giữ mọi tin trước nó
export function revertTo(messages: UIMessage[], id: string): { kept: UIMessage[]; removed: UIMessage[]; target: UIMessage } | null {
    const index = messages.findIndex(m => m.id === id);
    if (index === -1 || messages[index].role !== 'user') return null;
    return { kept: messages.slice(0, index), removed: messages.slice(index), target: messages[index] };
}

// "Tạo lại" trên tin AI: giữ tới tin người dùng gần nhất phía trước, bỏ tin AI này và mọi tin sau
export function regenerateFrom(messages: UIMessage[], id: string): { kept: UIMessage[]; removed: UIMessage[]; question: UIMessage } | null {
    const index = messages.findIndex(m => m.id === id);
    if (index === -1 || messages[index].role !== 'assistant') return null;
    let q = index - 1;
    while (q >= 0 && (messages[q].role !== 'user' || messages[q].local)) q--;
    if (q < 0) return null;
    return { kept: messages.slice(0, index), removed: messages.slice(index), question: messages[q] };
}

// Trong các tin sắp bị bỏ, AI đã làm thao tác ghi dữ liệu nào (thêm việc, giao dịch…) — để cảnh báo
export function performedActions(messages: UIMessage[]): ActionResult[] {
    return messages.flatMap(m => (m.actions || []).filter(a => a.success && a.type !== 'financial_impact'));
}

// Tách thẻ <artifact title="…">…</artifact> khỏi câu trả lời
export function parseArtifact(content: string): { title: string; artifactContent: string; cleanContent: string } | null {
    const re = /<artifact\s+title=["']([^"']+)["']\s*>([\s\S]*?)<\/artifact>/i;
    const match = content.match(re);
    if (!match) return null;
    return {
        title: match[1],
        artifactContent: match[2].trim(),
        cleanContent: content.replace(re, '').trim(),
    };
}

// Khi đang stream, thẻ artifact có thể mới mở chưa đóng — ẩn phần dở dang đó
export function hidePartialArtifact(content: string): string {
    const open = content.search(/<artifact\b/i);
    if (open === -1) return content;
    if (/<\/artifact>/i.test(content.slice(open))) return content;
    return content.slice(0, open).trimEnd();
}
