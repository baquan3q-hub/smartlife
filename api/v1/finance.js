// File: api/v1/finance.js
// GET /api/v1/finance/overview?month=YYYY-MM&tz=Asia/Ho_Chi_Minh
// Chi tiêu theo danh mục so với ngân sách, dòng tiền, hóa đơn định kỳ, ví, nợ.

import { apiHandler, callRpc, q } from '../_lib/authKey.js';

export default apiHandler({
    GET: async (req, { key }) => {
        return callRpc('api_v1_finance_overview', {
            p_key: key,
            p_month: q(req, 'month') ?? null,
            p_tz: q(req, 'tz') || 'Asia/Ho_Chi_Minh',
        });
    },
});
