// File: api/gemini.js
// Vercel Serverless Function — Proxy cho Gemini API
// API key được giữ an toàn phía server (process.env.GEMINI_API_KEYS)

const MODEL = 'gemini-2.5-flash';

// Đọc API keys từ server environment (KHÔNG có prefix VITE_)
function getApiKeys() {
    const envKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    return envKeys.split(',').map(k => k.trim()).filter(Boolean);
}

// Key rotation index (reset mỗi cold start — chấp nhận được cho serverless)
let currentKeyIndex = 0;

async function callGeminiWithRetry(body, retryCount = 0) {
    const keys = getApiKeys();
    if (keys.length === 0) {
        throw new Error('GEMINI_API_KEYS chưa được cấu hình trên server.');
    }

    const key = keys[currentKeyIndex % keys.length];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const status = res.status;
        const err = await res.json().catch(() => ({}));

        // Retry với key rotation cho các lỗi tạm thời
        if ((status === 429 || status === 403 || status === 500 || status === 503 || status === 504)
            && retryCount < Math.max(3, keys.length)) {
            if (keys.length > 1) {
                currentKeyIndex++;
                console.warn(`[SmartLife Proxy] Status ${status}. Rotating to key #${(currentKeyIndex % keys.length) + 1}...`);
            }
            const delay = 1500 * (retryCount + 1);
            await new Promise(r => setTimeout(r, delay));
            return callGeminiWithRetry(body, retryCount + 1);
        }

        // Trả lỗi cho client (KHÔNG bao gồm API key)
        const errorMessage = err?.error?.message || `Gemini API Error ${status}`;
        const error = new Error(errorMessage);
        error.status = status;
        throw error;
    }

    return res.json();
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    // Chỉ cho phép POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    // Kiểm tra API key đã cấu hình chưa
    const keys = getApiKeys();
    if (keys.length === 0) {
        return res.status(500).json({
            error: 'API key chưa được cấu hình. Hãy thêm GEMINI_API_KEYS vào Vercel Environment Variables.'
        });
    }

    try {
        const { contents, systemInstruction, generationConfig, safetySettings, tools, toolConfig } = req.body;

        if (!contents || !Array.isArray(contents)) {
            return res.status(400).json({ error: 'Thiếu trường "contents" trong request body.' });
        }

        // Xây dựng body gửi tới Gemini API
        const geminiBody = { contents };
        if (systemInstruction) geminiBody.systemInstruction = systemInstruction;
        if (generationConfig) geminiBody.generationConfig = generationConfig;
        if (safetySettings) geminiBody.safetySettings = safetySettings;
        if (tools) geminiBody.tools = tools;
        if (toolConfig) geminiBody.toolConfig = toolConfig;

        const data = await callGeminiWithRetry(geminiBody);
        return res.status(200).json(data);
    } catch (error) {
        console.error('[SmartLife Proxy] Error:', error.message);
        const status = error.status || 500;
        return res.status(status).json({ error: error.message });
    }
}
