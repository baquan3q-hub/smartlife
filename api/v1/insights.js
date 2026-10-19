// File: api/v1/insights.js
//   POST /api/v1/ai/insights  → AI ghi phân tích / lời khuyên (bảng ai_advisor_logs)
//   GET  /api/v1/ai/insights  → AI đọc lại các lời khuyên gần đây để tránh lặp ý

import { apiHandler, callRpc, readJsonBody, q, ApiError } from '../_lib/authKey.js';

export default apiHandler({
    GET: async (req, { key }) => {
        const limit = q(req, 'limit');
        if (limit !== undefined && !Number.isInteger(Number(limit))) {
            throw new ApiError(400, 'invalid_input', 'limit phải là số nguyên.');
        }
        const items = await callRpc('api_v1_list_insights', {
            p_key: key,
            p_limit: limit === undefined ? 20 : Number(limit),
            p_category: q(req, 'category') ?? null,
        });
        return { items };
    },

    POST: async (req, { key }) => {
        const created = await callRpc('api_v1_create_insight', { p_key: key, p_insight: readJsonBody(req) });
        return { status: 201, body: created };
    },
});
