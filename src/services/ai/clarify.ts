// File: src/services/ai/clarify.ts
// Công cụ ask_user: kiểm tra tham số, giới hạn số vòng hỏi lại, dựng câu trả lời của người dùng.
// File thuần để test được và dùng chung cho scripts/ai-eval.

import type { AITier } from '../geminiService';
import type { ExpertId } from './experts/types';

export type ClarifyPurpose = 'clarify' | 'confirm';

export interface ClarifyQuestion {
    id: string;
    question: string;
    options: string[];
    multi: boolean;
    allowOther: boolean;
}

export interface ClarifyRequest {
    purpose: ClarifyPurpose;
    intro: string;
    questions: ClarifyQuestion[];
}

/** Đáp án theo id câu hỏi: các lựa chọn đã chọn + chữ tự nhập ở "Khác…" */
export type ClarifyAnswers = Record<string, { selected: string[]; other?: string }>;

export const MAX_CLARIFY_QUESTIONS = 3;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;
/** Ghi quá số này trong một lượt thì phải xác nhận trước bằng ask_user purpose "confirm" */
export const BULK_WRITE_LIMIT = 3;

/** Số vòng hỏi lại tối đa cho một câu hỏi: 1, riêng Lên kế hoạch hoặc Nghĩ sâu được 2 */
export function maxClarifyRounds(expert: ExpertId | undefined, tier: AITier | undefined): number {
    return expert === 'planner' || tier === 'deep' ? 2 : 1;
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Chuẩn hoá tham số ask_user từ model. Lỗi thì trả thông điệp để gửi lại cho model tự sửa. */
export function normalizeAskUser(args: any): { ok: true; request: ClarifyRequest } | { ok: false; error: string } {
    const purpose: ClarifyPurpose = args?.purpose === 'confirm' ? 'confirm' : 'clarify';
    const intro = clean(args?.intro, 300);
    const raw = Array.isArray(args?.questions) ? args.questions : [];
    const questions: ClarifyQuestion[] = [];
    const usedIds = new Set<string>();
    for (const q of raw) {
        if (questions.length >= MAX_CLARIFY_QUESTIONS) break;
        const question = clean(q?.question, 200);
        if (!question) continue;
        const options: string[] = [];
        for (const o of Array.isArray(q?.options) ? q.options : []) {
            const text = clean(o, 80);
            if (text && !options.includes(text)) options.push(text);
            if (options.length >= MAX_OPTIONS) break;
        }
        if (options.length < MIN_OPTIONS) continue;
        let id = clean(q?.id, 40).replace(/[^\w-]/g, '_') || `q${questions.length + 1}`;
        while (usedIds.has(id)) id = `${id}_${questions.length + 1}`;
        usedIds.add(id);
        questions.push({
            id,
            question,
            options,
            multi: q?.multi === true,
            allowOther: q?.allowOther !== false, // mặc định cho nhập "Khác…"
        });
    }
    if (!questions.length) {
        return { ok: false, error: 'ask_user cần ít nhất 1 câu hỏi có 2–4 lựa chọn. Hãy gọi lại đúng định dạng, hoặc trả lời luôn và nêu rõ giả định.' };
    }
    return { ok: true, request: { purpose, intro, questions } };
}

/** Chữ gửi đi thay người dùng sau khi họ chọn trên thẻ hỏi lại */
export function formatClarifyAnswer(request: ClarifyRequest, answers: ClarifyAnswers): string {
    const lines = request.questions.map(q => {
        const a = answers[q.id];
        const picked = [...(a?.selected || [])];
        const other = a?.other?.trim();
        if (other) picked.push(other);
        return `- ${q.question} → ${picked.length ? picked.join(', ') : '(bỏ qua)'}`;
    });
    const head = request.purpose === 'confirm' ? 'Xác nhận của mình:' : 'Trả lời câu hỏi của bạn:';
    return `${head}\n${lines.join('\n')}`;
}

/** Câu hỏi của AI dạng chữ — đưa vào lịch sử để lượt sau model biết mình đã hỏi gì */
/** shownText: chữ đã hiện trong tin — nếu đã chứa lời dẫn thì không lặp lại */
export function clarificationToText(request: ClarifyRequest, shownText = ''): string {
    const qs = request.questions.map((q, i) => `${i + 1}. ${q.question} (lựa chọn: ${q.options.join(' / ')}${q.allowOther ? ' / Khác' : ''})`);
    const intro = request.intro && !shownText.includes(request.intro.trim()) ? request.intro : '';
    return [intro, ...qs].filter(Boolean).join('\n');
}

interface MessageLike {
    role: 'user' | 'assistant';
    local?: boolean;
    meta?: { clarification?: ClarifyRequest | null } | null;
}

/** Số vòng hỏi lại liên tiếp (purpose "clarify") ngay trước lượt hiện tại */
export function countClarifyRounds(messages: MessageLike[]): number {
    let n = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.local || m.role === 'user') continue;
        const c = m.meta?.clarification;
        if (!c) break;
        if (c.purpose === 'clarify') n++;
    }
    return n;
}

/** Tin AI gần nhất có phải thẻ xin xác nhận ghi hàng loạt không — nếu có, câu trả lời kế tiếp coi như đã xác nhận */
export function lastAskedConfirm(messages: MessageLike[]): boolean {
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.local || m.role === 'user') continue;
        return m.meta?.clarification?.purpose === 'confirm';
    }
    return false;
}

/** Số mục một lệnh gọi công cụ sẽ ghi (việc, giao dịch, lịch) — để chặn ghi hàng loạt chưa xác nhận */
export function countWrites(name: string, args: any): number {
    switch (name) {
        case 'add_todo':
        case 'add_transaction':
        case 'add_calendar_event':
        case 'add_timetable':
            return 1;
        case 'batch_add_transactions':
            return Array.isArray(args?.transactions) ? args.transactions.length : 1;
        default:
            return 0;
    }
}
