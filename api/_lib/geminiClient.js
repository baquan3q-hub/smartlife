// File: api/_lib/geminiClient.js
// Gọi Gemini phía server: xoay vòng key, thử lại lỗi tạm thời, báo rõ lỗi hết credit (402).

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const RETRYABLE = new Set([429, 403, 500, 503, 504]);

export function getApiKeys() {
    const envKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    return envKeys.split(',').map((k) => k.trim()).filter(Boolean);
}

export class GeminiUpstreamError extends Error {
    constructor(status, message, type = null) {
        super(message);
        this.status = status;
        this.type = type;
    }
}

export const BILLING_MESSAGE = 'Dịch vụ AI đang tạm ngưng vì tài khoản Google AI của SmartLife hết tín dụng. Vui lòng báo quản trị viên hoặc thử lại sau. 🙏';

// Lỗi trả cho client (không bao giờ kèm API key)
export function toClientError(err) {
    if (err?.type === 'provider_billing') {
        return { status: 402, body: { error: 'provider_billing', type: 'provider_billing', message: err.message } };
    }
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        return { status: 504, body: { error: 'Gemini phản hồi quá lâu. Hãy thử lại hoặc chọn chế độ Nhanh.', type: 'timeout' } };
    }
    return { status: err?.status || 500, body: { error: err?.message || 'Lỗi không xác định khi gọi Gemini.' } };
}

// Key rotation index (reset mỗi cold start — chấp nhận được cho serverless)
let currentKeyIndex = 0;

// Mở request tới Gemini và trả về Response khi đã OK (chưa đọc body).
// stream=true dùng :streamGenerateContent?alt=sse — chỉ thử lại TRƯỚC khi stream bắt đầu.
export async function openGemini({ model, body, stream = false, signal, retryCount = 0, billingTried = 0 }) {
    const keys = getApiKeys();
    if (keys.length === 0) throw new GeminiUpstreamError(500, 'GEMINI_API_KEYS chưa được cấu hình trên server.');

    const key = keys[currentKeyIndex % keys.length];
    const method = stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?';
    const res = await fetch(`${API_BASE}/${model}:${method}key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
    });
    if (res.ok) return res;

    const status = res.status;
    const err = await res.json().catch(() => ({}));

    // 402 = project của key này hết credit trả trước → thử key khác (có thể khác project), không chờ
    if (status === 402) {
        if (keys.length > 1 && billingTried + 1 < keys.length) {
            currentKeyIndex++;
            console.warn(`[SmartLife AI] 402 hết credit. Chuyển sang key #${(currentKeyIndex % keys.length) + 1}...`);
            return openGemini({ model, body, stream, signal, retryCount, billingTried: billingTried + 1 });
        }
        console.error('[SmartLife AI] ❌ 402: mọi key đều hết credit Google AI.');
        throw new GeminiUpstreamError(402, BILLING_MESSAGE, 'provider_billing');
    }

    if (RETRYABLE.has(status) && retryCount < Math.max(3, keys.length)) {
        if (keys.length > 1) {
            currentKeyIndex++;
            console.warn(`[SmartLife AI] ${model} trả ${status}. Chuyển sang key #${(currentKeyIndex % keys.length) + 1}...`);
        }
        await new Promise((r) => setTimeout(r, 1500 * (retryCount + 1)));
        if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
        return openGemini({ model, body, stream, signal, retryCount: retryCount + 1, billingTried });
    }

    throw new GeminiUpstreamError(status, err?.error?.message || `Gemini API Error ${status}`);
}

export async function callGemini({ model, body, signal }) {
    const res = await openGemini({ model, body, signal });
    return res.json();
}

// Đọc stream SSE của Gemini, gọi onChunk(json) cho từng gói dữ liệu.
export async function readGeminiSse(res, onChunk) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const flush = (block) => {
        const data = block
            .split(/\r?\n/)
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart())
            .join('\n');
        if (!data) return;
        try {
            onChunk(JSON.parse(data));
        } catch {
            /* bỏ qua gói hỏng */
        }
    };
    for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? '';
        blocks.forEach(flush);
    }
    buffer += decoder.decode();
    if (buffer.trim()) flush(buffer);
}
