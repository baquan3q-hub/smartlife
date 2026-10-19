// File: api/_lib/authKey.js
// Middleware dùng chung cho /api/v1/* (thư mục bắt đầu bằng "_" nên Vercel KHÔNG biến nó thành function).
//
// Luồng xác thực:
//   1. Lấy key từ header `Authorization: Bearer sl_live_...` (hoặc `X-API-Key`).
//   2. Kiểm tra định dạng ngay tại server (chặn request rác, không tốn query DB).
//   3. Gọi hàm Postgres `api_v1_*` bằng ANON key. Hàm đó tự hash SHA-256 key,
//      tra bảng api_keys, kiểm tra scope / hạn dùng / rate limit, rồi chỉ
//      thao tác trên dữ liệu của đúng user. Xác thực + truy vấn nằm trong
//      CÙNG một transaction → không cần Service Role Key.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const KEY_PATTERN = /^sl_live_[0-9a-f]{48}$/;

let client = null;
function db() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new ApiError(500, 'server_misconfigured', 'Supabase URL / anon key chưa được cấu hình trên server.');
    }
    if (!client) {
        client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });
    }
    return client;
}

export class ApiError extends Error {
    constructor(status, code, message, extra) {
        super(message);
        this.status = status;
        this.code = code;
        this.extra = extra;
    }
}

/** Lấy API key từ request, ném 401 nếu thiếu hoặc sai định dạng. */
export function requireApiKey(req) {
    const auth = req.headers['authorization'] || '';
    const match = /^Bearer\s+(\S+)\s*$/i.exec(auth);
    const key = match ? match[1] : (req.headers['x-api-key'] || '').trim();

    if (!key) {
        throw new ApiError(401, 'missing_api_key', 'Thiếu header Authorization: Bearer sl_live_...');
    }
    if (!KEY_PATTERN.test(key)) {
        throw new ApiError(401, 'invalid_api_key', 'API key không đúng định dạng sl_live_...');
    }
    return key;
}

/** Gọi 1 hàm RPC, chuyển lỗi Postgres thành ApiError với HTTP status phù hợp. */
export async function callRpc(fn, params) {
    const { data, error } = await db().rpc(fn, params);
    if (error) throw toApiError(error);
    return data;
}

function toApiError(err) {
    // Hàm SQL raise với SQLSTATE 'PTxxx' → HTTP xxx
    const pt = /^PT(\d{3})$/.exec(err.code || '');
    if (pt) {
        return new ApiError(Number(pt[1]), err.details || 'error', err.message, err.hint ? { required_scope: err.hint } : undefined);
    }
    // Lỗi ép kiểu dữ liệu đầu vào (uuid, timestamp, date...) → 400
    if (['22P02', '22007', '22008', '22003', '23514', '23502'].includes(err.code)) {
        return new ApiError(400, 'invalid_input', err.message);
    }
    if (err.code === 'PGRST202') {
        return new ApiError(500, 'server_misconfigured', 'Chưa chạy file sql/api_v1_external_ai.sql trên Supabase.');
    }
    console.error('[api/v1] Unexpected DB error', err);
    return new ApiError(500, 'internal_error', 'Lỗi máy chủ, vui lòng thử lại.');
}

/** Đọc body JSON (Vercel đã parse sẵn nếu Content-Type là application/json). */
export function readJsonBody(req) {
    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body || '{}');
        } catch {
            throw new ApiError(400, 'invalid_json', 'Body không phải JSON hợp lệ.');
        }
    }
    if (body == null) body = {};
    if (typeof body !== 'object' || Array.isArray(body)) {
        throw new ApiError(400, 'invalid_body', 'Body phải là một JSON object.');
    }
    return body;
}

/** Lấy 1 giá trị query string (Vercel có thể trả về mảng nếu lặp tham số). */
export function q(req, name) {
    const v = req.query?.[name];
    if (Array.isArray(v)) return v[v.length - 1];
    return v === undefined || v === '' ? undefined : String(v);
}

/** Query dạng danh sách: ?status=todo,doing hoặc ?status=todo&status=doing */
export function qList(req, name) {
    const v = req.query?.[name];
    if (v === undefined || v === '') return null;
    const items = (Array.isArray(v) ? v : [v]).flatMap((s) => String(s).split(',')).map((s) => s.trim()).filter(Boolean);
    return items.length ? items : null;
}

function setCommonHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, X-API-Key, Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
}

/**
 * Bọc handler: CORS, kiểm tra method, lấy API key, xử lý lỗi thống nhất.
 * handlers: { GET: async (req, ctx) => data, POST: ... }
 * ctx = { key } ; handler trả về { status?, body } hoặc data (mặc định 200).
 */
export function apiHandler(handlers, { auth = true } = {}) {
    return async function handler(req, res) {
        setCommonHeaders(res);
        if (req.method === 'OPTIONS') {
            return res.status(204).end();
        }
        const fn = handlers[req.method];
        if (!fn) {
            res.setHeader('Allow', Object.keys(handlers).join(', '));
            return res.status(405).json({ error: { code: 'method_not_allowed', message: `Method ${req.method} không được hỗ trợ.` } });
        }
        try {
            const ctx = { key: auth ? requireApiKey(req) : null };
            const result = await fn(req, ctx);
            if (result && typeof result === 'object' && 'body' in result && 'status' in result) {
                return res.status(result.status).json(result.body);
            }
            return res.status(200).json(result ?? {});
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.status === 401) res.setHeader('WWW-Authenticate', 'Bearer realm="SmartLife API"');
                if (err.status === 429) res.setHeader('Retry-After', '60');
                return res.status(err.status).json({ error: { code: err.code, message: err.message, ...(err.extra || {}) } });
            }
            console.error('[api/v1] Unhandled error', err);
            return res.status(500).json({ error: { code: 'internal_error', message: 'Lỗi máy chủ, vui lòng thử lại.' } });
        }
    };
}
