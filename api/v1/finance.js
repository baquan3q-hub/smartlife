// File: api/v1/finance.js
// Một function cho nhóm /finance (vercel.json rewrite gắn ?action= / ?id=):
//   GET    /api/v1/finance/overview?month=YYYY-MM&tz=   → tổng quan tháng
//   GET    /api/v1/finance/options                      → ví + danh mục hay dùng
//   GET    /api/v1/finance/balance?days=30              → số dư khả dụng + ví + điều chỉnh N ngày
//   GET    /api/v1/finance/transactions?from=&to=&type=&category=&q=&limit=
//   POST   /api/v1/finance/transactions                 → thêm giao dịch (cập nhật số dư ví)
//   DELETE /api/v1/finance/transactions/:id             → xóa, hoàn lại số dư ví

import { apiHandler, callRpc, readJsonBody, q, ApiError } from '../_lib/authKey.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default apiHandler({
    GET: async (req, { key }) => {
        const action = q(req, 'action') || 'overview';
        if (action === 'options') {
            return callRpc('api_v1_finance_options', { p_key: key });
        }
        if (action === 'balance') {
            const days = q(req, 'days');
            if (days !== undefined && !Number.isInteger(Number(days))) {
                throw new ApiError(400, 'invalid_input', 'days phải là số nguyên.');
            }
            return callRpc('api_v1_balance', {
                p_key: key,
                p_days: days === undefined ? 30 : Number(days),
                p_tz: q(req, 'tz') || 'Asia/Ho_Chi_Minh',
            });
        }
        if (action === 'transactions') {
            const limit = q(req, 'limit');
            if (limit !== undefined && !Number.isInteger(Number(limit))) {
                throw new ApiError(400, 'invalid_input', 'limit phải là số nguyên.');
            }
            return callRpc('api_v1_list_transactions', {
                p_key: key,
                p_from: q(req, 'from') ?? null,
                p_to: q(req, 'to') ?? null,
                p_type: q(req, 'type') ?? null,
                p_category: q(req, 'category') ?? null,
                p_search: q(req, 'q') ?? null,
                p_limit: limit === undefined ? 30 : Number(limit),
                p_tz: q(req, 'tz') || 'Asia/Ho_Chi_Minh',
            });
        }
        return callRpc('api_v1_finance_overview', {
            p_key: key,
            p_month: q(req, 'month') ?? null,
            p_tz: q(req, 'tz') || 'Asia/Ho_Chi_Minh',
        });
    },

    POST: async (req, { key }) => {
        if (q(req, 'action') !== 'transactions') throw new ApiError(404, 'not_found', 'Dùng POST /api/v1/finance/transactions.');
        const tx = await callRpc('api_v1_create_transaction', {
            p_key: key,
            p_tx: readJsonBody(req),
            p_tz: q(req, 'tz') || 'Asia/Ho_Chi_Minh',
        });
        return { status: 201, body: tx };
    },

    DELETE: async (req, { key }) => {
        const id = q(req, 'id');
        if (q(req, 'action') !== 'transactions' || !id) throw new ApiError(404, 'not_found', 'Dùng DELETE /api/v1/finance/transactions/{id}.');
        if (!UUID.test(id)) throw new ApiError(400, 'invalid_id', 'id phải là UUID.');
        return callRpc('api_v1_delete_transaction', { p_key: key, p_id: id });
    },
});
