import { describe, it, expect } from 'vitest';
import { insertCitationMarkers, extractGrounding } from './grounding.js';

const byteEnd = (text, upTo) => Buffer.byteLength(text.slice(0, text.indexOf(upTo) + upTo.length), 'utf-8');

describe('insertCitationMarkers', () => {
    it('chèn đúng vị trí dù tiếng Việt có dấu chiếm nhiều byte', () => {
        const text = 'Lãi suất tiết kiệm tăng nhẹ. Giá vàng giảm mạnh.';
        const supports = [
            { segment: { endIndex: byteEnd(text, 'tăng nhẹ.') }, groundingChunkIndices: [0] },
            { segment: { endIndex: byteEnd(text, 'giảm mạnh.') }, groundingChunkIndices: [1, 0] },
        ];
        const out = insertCitationMarkers(text, supports, new Map([[0, 1], [1, 2]]));
        expect(out).toBe('Lãi suất tiết kiệm tăng nhẹ. [1] Giá vàng giảm mạnh. [1][2]');
    });

    it('bỏ qua chỉ số lỗi', () => {
        const text = 'Xin chào';
        expect(insertCitationMarkers(text, [{ segment: { endIndex: 999 }, groundingChunkIndices: [0] }], new Map([[0, 1]]))).toBe(text);
    });
});

describe('extractGrounding', () => {
    it('gộp nguồn trùng URL, bỏ phần suy nghĩ', () => {
        const text = 'Học phí năm 2026 tăng 10%.';
        const data = {
            candidates: [{
                content: { parts: [{ text: 'đang nghĩ…', thought: true }, { text }] },
                groundingMetadata: {
                    webSearchQueries: ['học phí 2026'],
                    groundingChunks: [
                        { web: { uri: 'https://a.example/1', title: 'vnexpress.net' } },
                        { web: { uri: 'https://a.example/1', title: 'vnexpress.net' } },
                        { web: { uri: 'https://b.example/2', title: 'tuoitre.vn' } },
                    ],
                    groundingSupports: [{ segment: { endIndex: Buffer.byteLength(text) }, groundingChunkIndices: [1, 2] }],
                },
            }],
        };
        const g = extractGrounding(data);
        expect(g.sources).toHaveLength(2);
        expect(g.sources[1]).toMatchObject({ n: 2, domain: 'tuoitre.vn' });
        expect(g.summary).toBe('Học phí năm 2026 tăng 10%. [1][2]');
        expect(g.queries).toEqual(['học phí 2026']);
    });
});
