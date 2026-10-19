// File: api/v1/context.js
// GET /api/v1/ai/context  (rewrite trong vercel.json)
// Trả về 1 JSON tổng hợp: user, tasks, finance, productivity — gọn để tiết kiệm token cho LLM.
// Toàn bộ tổng hợp chạy trong 1 hàm Postgres (1 round-trip) → nhanh và nhất quán.
// Query: ?tz=Asia/Ho_Chi_Minh (mặc định)

import { apiHandler, callRpc, q } from '../_lib/authKey.js';

export default apiHandler({
    GET: async (req, { key }) => {
        return callRpc('api_v1_context', {
            p_key: key,
            p_tz: q(req, 'tz') || 'Asia/Ho_Chi_Minh',
        });
    },
});
