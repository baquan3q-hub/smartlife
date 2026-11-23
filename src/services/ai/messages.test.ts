import { describe, expect, test } from 'vitest';
import {
    cutoffFrom, editableText, fromStoredMessage, hidePartialArtifact, parseArtifact, performedActions,
    regenerateFrom, revertTo, toGeminiHistory, type UIMessage,
} from './messages';
import { describeToolCall, describeToolResult, formatDuration } from './toolLabels';

let seq = 0;
const msg = (p: Partial<UIMessage> & Pick<UIMessage, 'role' | 'content'>): UIMessage => ({
    id: `m${++seq}`,
    status: 'done',
    ...p,
});

describe('toGeminiHistory', () => {
    test('bỏ lời chào, tin lỗi, tin đang chạy và tin rỗng', () => {
        const history = toGeminiHistory([
            msg({ role: 'assistant', content: 'Chào bạn!', local: true }),
            msg({ role: 'user', content: 'Chi tiêu tháng này?' }),
            msg({ role: 'assistant', content: '', status: 'done' }),
            msg({ role: 'assistant', content: 'nửa chừng', status: 'error' }),
            msg({ role: 'assistant', content: 'cũ', meta: { error: 'timeout' } }),
            msg({ role: 'assistant', content: 'Bạn đã chi 2 triệu.' }),
            msg({ role: 'user', content: 'Còn tháng trước?' }),
            msg({ role: 'assistant', content: 'đang gõ…', status: 'streaming' }),
        ]);
        expect(history).toEqual([
            { role: 'user', parts: [{ text: 'Chi tiêu tháng này?' }] },
            { role: 'model', parts: [{ text: 'Bạn đã chi 2 triệu.' }] },
            { role: 'user', parts: [{ text: 'Còn tháng trước?' }] },
        ]);
    });

    test('giữ câu trả lời đã dừng (phần chữ dở dang vẫn là ngữ cảnh)', () => {
        const history = toGeminiHistory([
            msg({ role: 'user', content: 'Lập kế hoạch' }),
            msg({ role: 'assistant', content: 'Bước 1…', status: 'stopped', meta: { stopped: true } }),
        ]);
        expect(history[1]).toEqual({ role: 'model', parts: [{ text: 'Bước 1…' }] });
    });

    test('bỏ tin AI đứng đầu và gộp các tin liền nhau cùng vai', () => {
        const history = toGeminiHistory([
            msg({ role: 'assistant', content: 'Thông báo cũ' }),
            msg({ role: 'user', content: 'A' }),
            msg({ role: 'user', content: 'B' }),
            msg({ role: 'assistant', content: 'C' }),
        ]);
        expect(history).toEqual([
            { role: 'user', parts: [{ text: 'A\n\nB' }] },
            { role: 'model', parts: [{ text: 'C' }] },
        ]);
    });

    test('gửi kèm nội dung tệp của tin người dùng', () => {
        const history = toGeminiHistory([
            msg({ role: 'user', content: 'Xem file', fileContext: '\n\n--- NỘI DUNG TỆP a.txt ---\nabc' }),
        ]);
        expect(history[0].parts[0]).toHaveProperty('text', 'Xem file\n\n--- NỘI DUNG TỆP a.txt ---\nabc');
    });
});

describe('quay lại / tạo lại', () => {
    const list = [
        msg({ id: 'w', role: 'assistant', content: 'Chào', local: true }),
        msg({ id: 'u1', role: 'user', content: 'Hỏi 1', dbId: 'd1', createdAt: '2026-11-19T01:00:00Z' }),
        msg({ id: 'a1', role: 'assistant', content: 'Đáp 1', dbId: 'd2', createdAt: '2026-11-19T01:00:05Z' }),
        msg({
            id: 'u2', role: 'user', content: 'Hỏi 2', dbId: 'd3', createdAt: '2026-11-19T01:01:00Z',
        }),
        msg({
            id: 'a2', role: 'assistant', content: 'Đáp 2', dbId: 'd4', createdAt: '2026-11-19T01:01:09Z',
            actions: [
                { type: 'todo', success: true, message: 'Đã thêm' },
                { type: 'transaction', success: false, message: 'Lỗi' },
                { type: 'financial_impact', success: true, message: 'Mô phỏng' },
            ],
        }),
    ];

    test('revertTo giữ mọi tin trước tin người dùng', () => {
        const cut = revertTo(list, 'u2')!;
        expect(cut.kept.map(m => m.id)).toEqual(['w', 'u1', 'a1']);
        expect(cut.removed.map(m => m.id)).toEqual(['u2', 'a2']);
        expect(cut.target.id).toBe('u2');
    });

    test('revertTo chỉ áp dụng cho tin người dùng', () => {
        expect(revertTo(list, 'a1')).toBeNull();
        expect(revertTo(list, 'không-có')).toBeNull();
    });

    test('regenerateFrom tìm câu hỏi phía trước, bỏ qua lời chào', () => {
        const cut = regenerateFrom(list, 'a2')!;
        expect(cut.kept.map(m => m.id)).toEqual(['w', 'u1', 'a1', 'u2']);
        expect(cut.removed.map(m => m.id)).toEqual(['a2']);
        expect(cut.question.id).toBe('u2');
        expect(regenerateFrom(list, 'w')).toBeNull();
        expect(regenerateFrom(list, 'u1')).toBeNull();
    });

    test('cutoffFrom lấy created_at của tin đã lưu đầu tiên từ vị trí cắt', () => {
        expect(cutoffFrom(list, 3)).toBe('2026-11-19T01:01:00Z');
        expect(cutoffFrom(list, 0)).toBe('2026-11-19T01:00:00Z');
        expect(cutoffFrom(list, 5)).toBeNull();
        const unsaved = [...list, msg({ role: 'user', content: 'chưa lưu' })];
        expect(cutoffFrom(unsaved, 5)).toBeNull();
    });

    test('performedActions chỉ đếm thao tác ghi dữ liệu thành công', () => {
        expect(performedActions(list).map(a => a.type)).toEqual(['todo']);
    });
});

describe('fromStoredMessage', () => {
    const row = {
        id: 'r1', conversation_id: 'c1', role: 'assistant' as const, content: 'x', created_at: '2026-11-19T00:00:00Z',
    };

    test('đặt trạng thái theo meta', () => {
        expect(fromStoredMessage(row).status).toBe('done');
        expect(fromStoredMessage({ ...row, meta: { stopped: true } }).status).toBe('stopped');
        expect(fromStoredMessage({ ...row, meta: { error: 'x' } }).status).toBe('error');
    });

    test('dùng id DB làm khoá và mốc created_at', () => {
        const m = fromStoredMessage(row);
        expect(m).toMatchObject({ id: 'r1', dbId: 'r1', createdAt: '2026-11-19T00:00:00Z' });
    });
});

describe('editableText', () => {
    test('bỏ các dòng tệp đính kèm ở cuối', () => {
        expect(editableText({ content: 'Phân tích giúp\n\n📎 **bao-cao.xlsx** (12.5 KB)\n📎 **anh.png** (300.0 KB)' }))
            .toBe('Phân tích giúp');
    });

    test('giữ nguyên tin không có tệp', () => {
        expect(editableText({ content: 'Dòng 1\nDòng 2' })).toBe('Dòng 1\nDòng 2');
    });
});

describe('artifact', () => {
    test('parseArtifact tách báo cáo khỏi câu trả lời', () => {
        const parsed = parseArtifact('Đây là báo cáo:\n<artifact title="Chi tiêu 10/2026">\n# Tổng\n</artifact>\nXong.');
        expect(parsed).toEqual({ title: 'Chi tiêu 10/2026', artifactContent: '# Tổng', cleanContent: 'Đây là báo cáo:\n\nXong.' });
        expect(parseArtifact('không có')).toBeNull();
    });

    test('hidePartialArtifact ẩn thẻ chưa đóng khi đang stream', () => {
        expect(hidePartialArtifact('Mở đầu\n<artifact title="A">\n# Đang viết')).toBe('Mở đầu');
        const closed = 'Mở đầu <artifact title="A">x</artifact>';
        expect(hidePartialArtifact(closed)).toBe(closed);
        expect(hidePartialArtifact('Bình thường')).toBe('Bình thường');
    });
});

describe('toolLabels', () => {
    test('mô tả bước đọc dữ liệu bằng tiếng Việt', () => {
        const year = new Date().getFullYear();
        expect(describeToolCall('query_database', { table: 'transactions', date_from: `${year}-10-01`, date_to: `${year}-10-31` }))
            .toBe('Đang đọc giao dịch 01/10–31/10');
        expect(describeToolCall('web_search', { query: 'lãi suất tiết kiệm' })).toBe('Đang tìm trên web “lãi suất tiết kiệm”');
        expect(describeToolCall('tool_la')).toBe('Đang chạy tool_la');
    });

    test('tóm tắt kết quả bước', () => {
        expect(describeToolResult('query_database', { count: 42 })).toEqual({ ok: true, detail: '42 bản ghi' });
        expect(describeToolResult('query_database', { count: 0 })).toEqual({ ok: true, detail: 'không có bản ghi' });
        expect(describeToolResult('add_todo', { success: false, message: 'Thiếu nội dung' })).toEqual({ ok: false, detail: 'Thiếu nội dung' });
        expect(describeToolResult('get_user_profile', null)).toEqual({ ok: true });
    });

    test('formatDuration', () => {
        expect(formatDuration(850)).toBe('1 giây');
        expect(formatDuration(12_000)).toBe('12 giây');
        expect(formatDuration(72_000)).toBe('1 phút 12 giây');
        expect(formatDuration(120_000)).toBe('2 phút');
    });
});
