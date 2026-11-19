import { describe, it, expect } from 'vitest';
import {
    normalizeAskUser, maxClarifyRounds, formatClarifyAnswer, clarificationToText,
    countClarifyRounds, lastAskedConfirm, countWrites,
} from './clarify';
import { mergeSearchSources } from './webSearch';

describe('normalizeAskUser', () => {
    it('cắt còn 3 câu hỏi, 4 lựa chọn, bỏ câu thiếu lựa chọn', () => {
        const r = normalizeAskUser({
            intro: 'Cho mình hỏi thêm',
            questions: [
                { id: 'a', question: 'Q1', options: ['1', '2', '3', '4', '5'] },
                { id: 'b', question: 'Q2', options: ['chỉ một'] },
                { id: 'c', question: 'Q3', options: ['x', 'y'] },
                { id: 'd', question: 'Q4', options: ['x', 'y'] },
                { id: 'e', question: 'Q5', options: ['x', 'y'] },
            ],
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.request.questions.map(q => q.id)).toEqual(['a', 'c', 'd']);
        expect(r.request.questions[0].options).toHaveLength(4);
        expect(r.request.purpose).toBe('clarify');
        expect(r.request.questions[0].allowOther).toBe(true);
    });
    it('không có câu hợp lệ → lỗi để model gọi lại', () => {
        expect(normalizeAskUser({ intro: 'x', questions: [] }).ok).toBe(false);
    });
    it('purpose confirm được giữ', () => {
        const r = normalizeAskUser({ purpose: 'confirm', intro: '', questions: [{ question: 'Thêm 5 việc?', options: ['Đồng ý', 'Không'] }] });
        expect(r.ok && r.request.purpose).toBe('confirm');
    });
});

describe('giới hạn vòng hỏi lại', () => {
    it('1 vòng mặc định, 2 vòng cho Lên kế hoạch hoặc Nghĩ sâu', () => {
        expect(maxClarifyRounds('general', 'balanced')).toBe(1);
        expect(maxClarifyRounds('finance', 'fast')).toBe(1);
        expect(maxClarifyRounds('planner', 'fast')).toBe(2);
        expect(maxClarifyRounds('study', 'deep')).toBe(2);
    });
    it('đếm vòng hỏi lại liên tiếp ở cuối cuộc trò chuyện', () => {
        const clar = { purpose: 'clarify' as const, intro: '', questions: [] };
        expect(countClarifyRounds([
            { role: 'user' }, { role: 'assistant' },
            { role: 'user' }, { role: 'assistant', meta: { clarification: clar } },
            { role: 'user' },
        ])).toBe(1);
        expect(countClarifyRounds([
            { role: 'user' }, { role: 'assistant', meta: { clarification: clar } },
            { role: 'user' }, { role: 'assistant', meta: { clarification: clar } },
            { role: 'user' },
        ])).toBe(2);
        expect(countClarifyRounds([{ role: 'user' }])).toBe(0);
    });
    it('nhận ra lượt trước là thẻ xác nhận', () => {
        const conf = { purpose: 'confirm' as const, intro: '', questions: [] };
        expect(lastAskedConfirm([{ role: 'user' }, { role: 'assistant', meta: { clarification: conf } }, { role: 'user' }])).toBe(true);
        expect(lastAskedConfirm([{ role: 'user' }, { role: 'assistant' }, { role: 'user' }])).toBe(false);
    });
});

describe('dựng câu trả lời', () => {
    const req = {
        purpose: 'clarify' as const,
        intro: 'Để lên kế hoạch sát hơn:',
        questions: [
            { id: 'deadline', question: 'Hạn chót?', options: ['1 tuần', '1 tháng'], multi: false, allowOther: true },
            { id: 'hours', question: 'Mỗi ngày rảnh bao lâu?', options: ['1 giờ', '2 giờ'], multi: false, allowOther: true },
        ],
    };
    it('gộp lựa chọn và "Khác…"', () => {
        const text = formatClarifyAnswer(req, { deadline: { selected: ['1 tháng'] }, hours: { selected: [], other: '30 phút' } });
        expect(text).toContain('Hạn chót? → 1 tháng');
        expect(text).toContain('Mỗi ngày rảnh bao lâu? → 30 phút');
    });
    it('câu bỏ qua được ghi rõ', () => {
        expect(formatClarifyAnswer(req, {})).toContain('(bỏ qua)');
    });
    it('chữ lịch sử có câu hỏi và lựa chọn', () => {
        expect(clarificationToText(req)).toContain('1. Hạn chót? (lựa chọn: 1 tuần / 1 tháng / Khác)');
    });
});

describe('countWrites', () => {
    it('đếm số mục ghi', () => {
        expect(countWrites('add_todo', {})).toBe(1);
        expect(countWrites('batch_add_transactions', { transactions: [1, 2, 3, 4] })).toBe(4);
        expect(countWrites('get_financial_report', {})).toBe(0);
    });
});

describe('mergeSearchSources', () => {
    it('đánh số tiếp, bỏ trùng URL và sửa dấu [n]', () => {
        const first = mergeSearchSources([], {
            query: 'a', summary: 'Lãi suất 5% [1][2].',
            sources: [{ n: 1, title: 'A', url: 'https://a.vn', domain: 'a.vn' }, { n: 2, title: 'B', url: 'https://b.vn', domain: 'b.vn' }],
        });
        expect(first.sources.map(s => s.n)).toEqual([1, 2]);
        const second = mergeSearchSources(first.sources, {
            query: 'b', summary: 'Giá vàng tăng [1, 2].',
            sources: [{ n: 1, title: 'B', url: 'https://b.vn', domain: 'b.vn' }, { n: 2, title: 'C', url: 'https://c.vn', domain: 'c.vn' }],
        });
        expect(second.sources).toHaveLength(3);
        expect(second.sources[2]).toMatchObject({ n: 3, url: 'https://c.vn' });
        expect(second.summary).toBe('Giá vàng tăng [2][3].');
    });
});
