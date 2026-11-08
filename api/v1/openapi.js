// File: api/v1/openapi.js
// GET /api/v1/openapi.json — công khai, không cần key. Domain trong `servers` lấy theo request.
// Ngoài ra function này còn phục vụ trang xem trước của link chia sẻ task (`/t/:token` → ?share=:token),
// gộp chung để không vượt giới hạn 12 function của gói Hobby.

import { buildOpenApiSpec } from '../_lib/openapiSpec.js';
import { handleSharePage } from '../_lib/sharePage.js';

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=300');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: { code: 'method_not_allowed' } });

    const shareToken = Array.isArray(req.query?.share) ? req.query.share[0] : req.query?.share;
    if (shareToken !== undefined) return handleSharePage(req, res, String(shareToken));

    const host = process.env.PUBLIC_APP_URL
        || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`;

    return res.status(200).json(buildOpenApiSpec(host.replace(/\/$/, '')));
}
