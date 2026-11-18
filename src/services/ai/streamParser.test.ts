import { describe, expect, test } from 'vitest';
import { createResponseAccumulator, createSseParser, type SseEvent } from './streamParser';

function collect() {
    const events: SseEvent[] = [];
    const parser = createSseParser(e => events.push(e));
    return { events, parser };
}

describe('createSseParser', () => {
    test('tách nhiều sự kiện trong một gói', () => {
        const { events, parser } = collect();
        parser.push('data: {"a":1}\n\ndata: {"a":2}\n\n');
        expect(events).toEqual([
            { event: null, data: '{"a":1}' },
            { event: null, data: '{"a":2}' },
        ]);
    });

    test('ghép lại sự kiện bị cắt giữa chừng giữa hai gói mạng', () => {
        const { events, parser } = collect();
        parser.push('data: {"te');
        expect(events).toHaveLength(0);
        parser.push('xt":"xin chào"}\n');
        expect(events).toHaveLength(0);
        parser.push('\nda');
        expect(events).toEqual([{ event: null, data: '{"text":"xin chào"}' }]);
        parser.push('ta: 2\n\n');
        expect(events[1]).toEqual({ event: null, data: '2' });
    });

    test('đọc tên sự kiện, bỏ dòng chú thích, nhận cả CRLF', () => {
        const { events, parser } = collect();
        parser.push(': keep-alive\r\n\r\nevent: meta\r\ndata: {"model":"m"}\r\n\r\nevent: done\r\ndata: {}\r\n\r\n');
        expect(events).toEqual([
            { event: 'meta', data: '{"model":"m"}' },
            { event: 'done', data: '{}' },
        ]);
    });

    test('nối nhiều dòng data bằng xuống dòng', () => {
        const { events, parser } = collect();
        parser.push('data: dòng 1\ndata: dòng 2\n\n');
        expect(events).toEqual([{ event: null, data: 'dòng 1\ndòng 2' }]);
    });

    test('flush phát nốt sự kiện cuối không có dòng trống kết thúc', () => {
        const { events, parser } = collect();
        parser.push('event: error\ndata: {"error":"x"}');
        expect(events).toHaveLength(0);
        parser.flush();
        expect(events).toEqual([{ event: 'error', data: '{"error":"x"}' }]);
        parser.flush();
        expect(events).toHaveLength(1);
    });
});

const chunk = (parts: any[], extra: Record<string, any> = {}) => ({
    candidates: [{ content: { role: 'model', parts }, ...extra }],
});

describe('createResponseAccumulator', () => {
    test('trả từng đoạn chữ / suy nghĩ và gộp chữ liền nhau', () => {
        const acc = createResponseAccumulator();
        expect(acc.add(chunk([{ text: 'Đang ', thought: true }]))).toEqual({ text: '', thought: 'Đang ', functionCalls: [] });
        acc.add(chunk([{ text: 'nghĩ', thought: true }]));
        expect(acc.add(chunk([{ text: 'Chào ' }])).text).toBe('Chào ');
        acc.add(chunk([{ text: 'bạn' }], { finishReason: 'STOP' }));
        acc.add({ usageMetadata: { totalTokenCount: 42 } });

        const result = acc.result();
        expect(result.candidates[0].content.parts).toEqual([
            { text: 'Đang nghĩ', thought: true },
            { text: 'Chào bạn' },
        ]);
        expect(result.candidates[0].finishReason).toBe('STOP');
        expect(result.usageMetadata).toEqual({ totalTokenCount: 42 });
    });

    test('không gộp phần có thoughtSignature với phần khác', () => {
        const acc = createResponseAccumulator();
        acc.add(chunk([{ text: 'A' }]));
        acc.add(chunk([{ text: 'B', thoughtSignature: 'sig-1' }]));
        acc.add(chunk([{ text: 'C' }]));
        expect(acc.result().candidates[0].content.parts).toEqual([
            { text: 'A' },
            { text: 'B', thoughtSignature: 'sig-1' },
            { text: 'C' },
        ]);
    });

    test('giữ nguyên lệnh gọi hàm kèm chữ ký và báo ra delta', () => {
        const acc = createResponseAccumulator();
        const call = { name: 'query_database', args: { table: 'transactions' } };
        const delta = acc.add(chunk([{ functionCall: call, thoughtSignature: 'sig-2' }]));
        expect(delta.functionCalls).toEqual([call]);
        expect(acc.result().candidates[0].content.parts).toEqual([{ functionCall: call, thoughtSignature: 'sig-2' }]);
    });

    test('bỏ qua gói rỗng / không có candidate', () => {
        const acc = createResponseAccumulator();
        expect(acc.add(null)).toEqual({ text: '', thought: '', functionCalls: [] });
        acc.add({ promptFeedback: { blockReason: 'SAFETY' } });
        const result = acc.result();
        expect(result.candidates).toBeUndefined();
        expect(result.promptFeedback).toEqual({ blockReason: 'SAFETY' });
    });
});
