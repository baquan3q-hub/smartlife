// File: api/gemini.js
// Vercel Serverless Function — Proxy cho Gemini API với hạn mức theo gói, tầng tốc độ và streaming.
// API key được giữ an toàn phía server (process.env.GEMINI_API_KEYS).
// Logic dùng chung ở api/_lib/ (aiModels, aiQuota, geminiClient, webSearch); dev server Vite gọi thẳng
// handler này (vite.config.ts) nên chỉ cần sửa một chỗ. ?op=search (= /api/search) → tìm web có nguồn.
//
// Body (JSON) nhận từ client:
//   contents, systemInstruction, generationConfig, safetySettings, tools, toolConfig — chuyển tiếp cho Gemini
//   tier:       'fast' | 'balanced' | 'deep'  — server tự chọn model + mức suy nghĩ (bỏ trống = model cũ)
//   purpose:    'chat' (mặc định) | 'router' | 'search' | 'memory' | 'greeting' — lệnh nội bộ không tính lượt
//   isToolCall: true với các lần gọi tiếp theo trong cùng một câu hỏi (không tính lượt)
//   stream:     true để nhận Server-Sent Events (xem streamToClient)

import { TIER_TIMEOUT_MS, normalizeTier, modelForTier, buildGenerationConfig, requestWeight } from './_lib/aiModels.js';
import { authenticate, loadUsage, enforceQuota, recordUsage, FREE_GATE } from './_lib/aiQuota.js';
import { getApiKeys, openGemini, readGeminiSse, toClientError } from './_lib/geminiClient.js';
import { handleWebSearch } from './_lib/webSearch.js';

const PURPOSES = new Set(['chat', 'router', 'search', 'memory', 'greeting']);
const LEGACY_TIMEOUT_MS = 55_000;

// Chỉ chuyển tiếp function calling; công cụ có sẵn của Google (tìm web…) tính phí riêng → đi qua /api/search
function sanitizeTools(tools) {
    if (!Array.isArray(tools)) return undefined;
    const allowed = tools.filter((t) => t && Array.isArray(t.functionDeclarations));
    return allowed.length ? allowed : undefined;
}

function setAiHeaders(res, { model, tier, weight }) {
    res.setHeader('X-SmartLife-Model', model);
    res.setHeader('X-SmartLife-Tier', tier || 'legacy');
    res.setHeader('X-SmartLife-Weight', String(weight));
    res.setHeader('Access-Control-Expose-Headers', 'X-SmartLife-Model, X-SmartLife-Tier, X-SmartLife-Weight');
}

// Stream SSE về client:
//   event: meta  → { model, tier, weight }
//   (mặc định)   → từng gói JSON của Gemini (candidates, usageMetadata…)
//   event: error → { error, type?, message? } khi lỗi giữa chừng
//   event: done  → { usageMetadata }
// Quota được ghi sau khi stream kết thúc — kể cả khi người dùng bấm Dừng giữa chừng.
async function streamToClient({ req, res, model, tier, weight, geminiBody, timeoutMs, onFinish }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException('Gemini timeout', 'TimeoutError')), timeoutMs);
    let clientGone = false;
    const onClose = () => {
        if (!res.writableFinished) {
            clientGone = true;
            controller.abort(new DOMException('Client closed', 'AbortError'));
        }
    };
    res.on('close', onClose);
    req.on?.('aborted', onClose);

    let upstream;
    try {
        upstream = await openGemini({ model, body: geminiBody, stream: true, signal: controller.signal });
    } catch (err) {
        clearTimeout(timer);
        if (clientGone) return;
        console.error('[SmartLife AI] Stream open error:', err.message);
        const e = toClientError(err);
        return res.status(e.status).json(e.body);
    }

    res.statusCode = 200;
    setAiHeaders(res, { model, tier, weight });
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = (event, data) => {
        if (clientGone) return;
        res.write(`${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(data)}\n\n`);
    };
    send('meta', { model, tier: tier || 'legacy', weight });

    let usageMetadata = null;
    let completed = false;
    try {
        await readGeminiSse(upstream, (chunk) => {
            if (chunk.usageMetadata) usageMetadata = chunk.usageMetadata;
            send(null, chunk);
        });
        completed = true;
    } catch (err) {
        if (!clientGone) {
            console.error('[SmartLife AI] Stream error:', err.message);
            send('error', toClientError(err).body);
        }
    } finally {
        clearTimeout(timer);
    }

    // Người dùng tự dừng vẫn tính lượt; lỗi phía Gemini chỉ tính token đã dùng
    await onFinish({ tokens: usageMetadata?.totalTokenCount || 0, countRequest: completed || clientGone });

    if (!clientGone) {
        send('done', { usageMetadata });
        res.end();
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

    if (getApiKeys().length === 0) {
        return res.status(500).json({
            error: 'API key chưa được cấu hình. Hãy thêm GEMINI_API_KEYS vào Vercel Environment Variables.',
        });
    }

    // /api/search → rewrite về đây (gói Hobby giới hạn 12 function nên không tách file riêng)
    if (req.query?.op === 'search') return handleWebSearch(req, res);

    const body = req.body || {};
    const { contents, systemInstruction, generationConfig, safetySettings, tools, toolConfig } = body;
    if (!contents || !Array.isArray(contents)) {
        return res.status(400).json({ error: 'Thiếu trường "contents" trong request body.' });
    }

    // 1. Xác thực + chặn gói Free
    const auth = await authenticate(req);
    if (auth.plan === 'free') return res.status(FREE_GATE.status).json(FREE_GATE.body);

    // 2. Tầng tốc độ, mục đích, số lượt tiêu tốn
    const purpose = PURPOSES.has(body.purpose) ? body.purpose : 'chat';
    let tier = normalizeTier(body.tier);
    if (purpose !== 'chat' && tier && tier !== 'fast') tier = 'fast'; // lệnh nội bộ luôn chạy model nhanh
    const isToolCall = body.isToolCall === true;
    const weight = requestWeight({ tier, purpose, isToolCall });
    const model = modelForTier(tier);

    // 3. Hạn mức (vượt mà còn Boost Pack thì vẫn cho qua)
    const usage = await loadUsage(auth.db, auth.userId);
    const quota = await enforceQuota({ auth, usage, weight, tier });
    if (quota.blocked) return res.status(quota.blocked.status).json(quota.blocked.body);

    // 4. Dựng request cho Gemini
    const geminiBody = { contents };
    if (systemInstruction) geminiBody.systemInstruction = systemInstruction;
    geminiBody.generationConfig = buildGenerationConfig(generationConfig, model, tier);
    if (safetySettings) geminiBody.safetySettings = safetySettings;
    const safeTools = sanitizeTools(tools);
    if (safeTools) {
        geminiBody.tools = safeTools;
        if (toolConfig) geminiBody.toolConfig = toolConfig;
    }

    const timeoutMs = tier ? TIER_TIMEOUT_MS[tier] : LEGACY_TIMEOUT_MS;
    const finish = ({ tokens, countRequest }) => recordUsage({
        auth,
        usage,
        weight: countRequest ? weight : 0,
        tokens,
        usingBoost: quota.usingBoost,
    });

    if (body.stream === true) {
        return streamToClient({ req, res, model, tier, weight, geminiBody, timeoutMs, onFinish: finish });
    }

    try {
        const upstream = await openGemini({ model, body: geminiBody, signal: AbortSignal.timeout(timeoutMs) });
        const data = await upstream.json();
        await finish({ tokens: data?.usageMetadata?.totalTokenCount || 0, countRequest: true });
        setAiHeaders(res, { model, tier, weight });
        return res.status(200).json(data);
    } catch (err) {
        console.error('[SmartLife AI] Error:', err.message);
        const e = toClientError(err);
        return res.status(e.status).json(e.body);
    }
}
