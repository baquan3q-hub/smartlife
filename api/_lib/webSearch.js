// File: api/_lib/webSearch.js
// Tìm trên web bằng Google Search grounding của Gemini, trả về tóm tắt có số trích dẫn + danh sách nguồn.
// Dùng cho công cụ web_search của AI Cố vấn: một request riêng (không trộn với function calling),
// không tính lượt câu hỏi, chỉ tính token vào hạn mức ngày/tháng.
//
// Không tách thành function riêng vì gói Vercel Hobby giới hạn 12 function/deploy:
// /api/search được rewrite về /api/gemini?op=search (vercel.json + plugin dev trong vite.config.ts).
//
// POST /api/search { query: string, context?: string }
// → 200 { query, summary, sources: [{ n, title, url, domain }], queries, model }

import { modelForTier, thinkingConfigFor } from './aiModels.js';
import { authenticate, loadUsage, enforceQuota, recordUsage, FREE_GATE } from './aiQuota.js';
import { openGemini, toClientError } from './geminiClient.js';
import { extractGrounding, resolveSourceUrls } from './grounding.js';

const SEARCH_INSTRUCTION = `Bạn là trợ lý tra cứu của SmartLife. Hãy dùng Google Search để tìm thông tin cho câu hỏi, rồi tóm tắt bằng tiếng Việt:
- Khách quan, ngắn gọn (tối đa ~250 từ), ưu tiên số liệu, ngày tháng, tên nguồn cụ thể.
- Ưu tiên nguồn chính thống: cơ quan nhà nước, trường học, báo lớn, trang chính thức của tổ chức.
- Nếu các nguồn mâu thuẫn hoặc thông tin có thể đã cũ, nói rõ.
- Không bịa; không tìm thấy thì nói không tìm thấy.`;

// CORS, method, API key đã được api/gemini.js kiểm tra trước khi gọi vào đây
export async function handleWebSearch(req, res) {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    const context = typeof req.body?.context === 'string' ? req.body.context.trim().slice(0, 500) : '';
    if (query.length < 2 || query.length > 300) {
        return res.status(400).json({ error: 'Câu tìm kiếm phải dài từ 2 đến 300 ký tự.' });
    }

    const auth = await authenticate(req);
    if (auth.plan === 'free') return res.status(FREE_GATE.status).json(FREE_GATE.body);

    const usage = await loadUsage(auth.db, auth.userId);
    const quota = await enforceQuota({ auth, usage, weight: 0, tier: null });
    if (quota.blocked) return res.status(quota.blocked.status).json(quota.blocked.body);

    const model = modelForTier('fast');
    const now = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const geminiBody = {
        systemInstruction: { parts: [{ text: `${SEARCH_INSTRUCTION}\nHôm nay là ${now}.` }] },
        contents: [{
            role: 'user',
            parts: [{ text: context ? `${query}\n\n(Bối cảnh: ${context})` : query }],
        }],
        tools: [{ google_search: {} }],
        generationConfig: { maxOutputTokens: 2048, thinkingConfig: thinkingConfigFor(model, 'fast') },
    };

    try {
        const upstream = await openGemini({ model, body: geminiBody, signal: AbortSignal.timeout(30_000) });
        const data = await upstream.json();
        await recordUsage({
            auth,
            usage,
            weight: 0,
            tokens: data?.usageMetadata?.totalTokenCount || 0,
            usingBoost: quota.usingBoost,
        });

        const { summary, sources, queries } = extractGrounding(data);
        await resolveSourceUrls(sources);
        return res.status(200).json({ query, summary, sources, queries, model });
    } catch (err) {
        console.error('[SmartLife Search] Error:', err.message);
        const e = toClientError(err);
        return res.status(e.status).json(e.body);
    }
}
