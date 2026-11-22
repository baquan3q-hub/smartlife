import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    getApiKeys,
    toClientError,
    openGemini,
    GeminiUpstreamError,
    BILLING_MESSAGE,
    SPENDING_CAP_MESSAGE,
} from './geminiClient.js';

describe('getApiKeys', () => {
    const saved = { ...process.env };
    afterEach(() => {
        process.env = { ...saved };
    });

    it('trả về danh sách rỗng khi không có env', () => {
        delete process.env.GEMINI_API_KEYS;
        delete process.env.GEMINI_API_KEY;
        expect(getApiKeys()).toEqual([]);
    });

    it('tách danh sách keys cách nhau bằng dấu phẩy và trim khoảng trắng', () => {
        process.env.GEMINI_API_KEYS = ' key1 , key2,  key3  ';
        expect(getApiKeys()).toEqual(['key1', 'key2', 'key3']);
    });

    it('hỗ trợ biến cũ GEMINI_API_KEY (số ít)', () => {
        delete process.env.GEMINI_API_KEYS;
        process.env.GEMINI_API_KEY = 'single_key';
        expect(getApiKeys()).toEqual(['single_key']);
    });
});

describe('toClientError', () => {
    it('đổi lỗi provider_billing thành 402', () => {
        const err = new GeminiUpstreamError(402, BILLING_MESSAGE, 'provider_billing');
        expect(toClientError(err)).toEqual({
            status: 402,
            body: { error: 'provider_billing', type: 'provider_billing', message: BILLING_MESSAGE },
        });
    });

    it('đổi lỗi provider_spending_cap thành 429 kèm thông điệp chi tiết', () => {
        const err = new GeminiUpstreamError(429, SPENDING_CAP_MESSAGE, 'provider_spending_cap');
        expect(toClientError(err)).toEqual({
            status: 429,
            body: { error: 'provider_spending_cap', type: 'provider_spending_cap', message: SPENDING_CAP_MESSAGE },
        });
    });

    it('đổi lỗi TimeoutError / AbortError thành 504', () => {
        const err = new DOMException('Timeout', 'TimeoutError');
        const res = toClientError(err);
        expect(res.status).toBe(504);
        expect(res.body.type).toBe('timeout');
    });

    it('lỗi thông thường giữ nguyên status hoặc 500', () => {
        const err = new GeminiUpstreamError(400, 'Bad request');
        expect(toClientError(err)).toEqual({
            status: 400,
            body: { error: 'Bad request' },
        });
    });
});

describe('openGemini spending cap & rotation', () => {
    const saved = { ...process.env };
    beforeEach(() => {
        vi.restoreAllMocks();
    });
    afterEach(() => {
        process.env = { ...saved };
        vi.restoreAllMocks();
    });

    it('báo lỗi 500 nếu chưa cấu hình GEMINI_API_KEYS', async () => {
        delete process.env.GEMINI_API_KEYS;
        delete process.env.GEMINI_API_KEY;
        await expect(openGemini({ model: 'gemini-2.5-flash', body: {} })).rejects.toThrow(
            'GEMINI_API_KEYS chưa được cấu hình',
        );
    });

    it('phát hiện lỗi 429 spending cap và trả lỗi provider_spending_cap không thử lại vô ích', async () => {
        process.env.GEMINI_API_KEYS = 'test_key_1';
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 429,
            json: async () => ({
                error: {
                    code: 429,
                    message: 'Your project has exceeded its monthly spending cap. Please go to AI Studio at https://ai.studio/spend',
                    status: 'RESOURCE_EXHAUSTED',
                },
            }),
        });

        await expect(openGemini({ model: 'gemini-2.5-flash', body: {} })).rejects.toMatchObject({
            status: 429,
            type: 'provider_spending_cap',
            message: SPENDING_CAP_MESSAGE,
        });

        // Với 1 key duy nhất, không gọi lại lặp đi lặp lại
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('khi có nhiều key, nếu key 1 dính spending cap thì chuyển ngay sang key 2', async () => {
        process.env.GEMINI_API_KEYS = 'key_cap, key_ok';
        let calls = 0;
        global.fetch = vi.fn().mockImplementation(async (url) => {
            calls++;
            if (url.includes('key=key_cap')) {
                return {
                    ok: false,
                    status: 429,
                    json: async () => ({
                        error: {
                            code: 429,
                            message: 'Your project has exceeded its monthly spending cap.',
                        },
                    }),
                };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({ candidates: [] }),
            };
        });

        const res = await openGemini({ model: 'gemini-2.5-flash', body: {} });
        expect(res.ok).toBe(true);
        expect(calls).toBe(2);
    });
});
