// File: api/v1/me.js
// GET /api/v1/me — kiểm tra nhanh API key có hoạt động không (tên key, scopes, hạn dùng).

import { apiHandler, callRpc } from '../_lib/authKey.js';

export default apiHandler({
    GET: async (_req, { key }) => callRpc('api_v1_whoami', { p_key: key }),
});
