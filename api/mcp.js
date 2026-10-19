// File: api/mcp.js
// MCP server (Model Context Protocol, transport "Streamable HTTP", chế độ stateless)
// cho Claude Code / Claude Desktop / claude.ai / Gemini CLI / Cursor...
//
// Xác thực:
//   * Khuyên dùng:  Authorization: Bearer sl_live_...
//   * claude.ai web (chỉ nhập được URL):  https://<domain>/api/mcp?key=sl_live_...
//     → nên dùng key CHỈ ĐỌC cho cách này vì URL có thể bị ghi log.
//
// Mỗi tool gọi đúng các hàm SQL api_v1_* như REST API, nên scope / rate limit giống hệt.

import { callRpc, ApiError } from './_lib/authKey.js';

const SERVER_INFO = { name: 'smartlife', title: 'SmartLife', version: '1.0.0' };
const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const KEY_PATTERN = /^sl_live_[0-9a-f]{48}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INSTRUCTIONS =
    'SmartLife là trợ lý cá nhân của người dùng (task Kanban, lịch, tài chính, thói quen). ' +
    'Luôn gọi get_context trước để nắm toàn cảnh. Ưu tiên task: urgent > focus > chill > temp. ' +
    'Cột Kanban: backlog, todo, doing, done. Tiền tệ theo user.currency (thường là VND). ' +
    'Hỏi người dùng trước khi sắp xếp lại hoặc sửa nhiều task. Ghi kết luận quan trọng bằng create_insight.';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------
const STATUS = { type: 'string', enum: ['backlog', 'todo', 'doing', 'done'] };
const PRIORITY = { type: 'string', enum: ['urgent', 'focus', 'chill', 'temp'] };
const READ = { readOnlyHint: true, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

const TOOLS = [
    {
        name: 'get_context',
        title: 'Bức tranh toàn cảnh',
        description:
            'Tổng hợp hồ sơ, mục tiêu, số task theo cột, task quá hạn / sắp đến hạn / ưu tiên cao, lịch hôm nay, số dư ví, chi tiêu tháng so với ngân sách, hóa đơn định kỳ 7 ngày tới, rủi ro tài chính, streak thói quen, thời gian tập trung. Gọi đầu tiên.',
        inputSchema: { type: 'object', properties: { tz: { type: 'string', description: 'IANA timezone, mặc định Asia/Ho_Chi_Minh' } } },
        annotations: READ,
        run: (key, a) => callRpc('api_v1_context', { p_key: key, p_tz: a.tz || 'Asia/Ho_Chi_Minh' }),
    },
    {
        name: 'list_tasks',
        title: 'Danh sách task',
        description: 'Lọc task theo cột, ưu tiên, khoảng deadline, quá hạn, từ khóa. Mặc định bỏ qua task done.',
        inputSchema: {
            type: 'object',
            properties: {
                status: { type: 'array', items: STATUS },
                priority: { type: 'array', items: PRIORITY },
                due_from: { type: 'string', format: 'date-time' },
                due_to: { type: 'string', format: 'date-time' },
                overdue: { type: 'boolean' },
                q: { type: 'string', description: 'Tìm trong tiêu đề và mô tả' },
                limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
                offset: { type: 'integer', minimum: 0, default: 0 },
            },
        },
        annotations: READ,
        run: (key, a) =>
            callRpc('api_v1_list_tasks', {
                p_key: key,
                p_status: a.status ?? null,
                p_priority: a.priority ?? null,
                p_due_from: a.due_from ?? null,
                p_due_to: a.due_to ?? null,
                p_overdue: a.overdue ?? null,
                p_search: a.q ?? null,
                p_limit: a.limit ?? 50,
                p_offset: a.offset ?? 0,
            }),
    },
    {
        name: 'get_task',
        title: 'Chi tiết task',
        description: 'Lấy đầy đủ 1 task (mô tả, subtasks, thời gian đã làm).',
        inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
        annotations: READ,
        run: (key, a) => callRpc('api_v1_get_task', { p_key: key, p_id: uuid(a.id) }),
    },
    {
        name: 'create_task',
        title: 'Tạo task',
        description: 'Tạo task gợi ý cho người dùng. Mặc định vào cột backlog, nằm trên cùng.',
        inputSchema: {
            type: 'object',
            required: ['title'],
            properties: {
                title: { type: 'string', maxLength: 500 },
                description: { type: 'string' },
                status: STATUS,
                priority: PRIORITY,
                deadline: { type: 'string', format: 'date-time', description: 'ISO 8601 có múi giờ, vd 2026-10-20T17:00:00+07:00' },
                scheduled_date: { type: 'string', format: 'date' },
                scheduled_time: { type: 'string', description: 'HH:MM' },
                subtasks: { type: 'array', items: { type: 'string' }, maxItems: 50 },
            },
        },
        annotations: WRITE,
        run: (key, a) => callRpc('api_v1_create_task', { p_key: key, p_task: a }),
    },
    {
        name: 'update_task',
        title: 'Cập nhật task',
        description: 'Chỉ gửi trường cần đổi. deadline: null để xóa hạn. Chuyển status sang done sẽ ghi thời điểm hoàn thành.',
        inputSchema: {
            type: 'object',
            required: ['id'],
            properties: {
                id: { type: 'string', format: 'uuid' },
                title: { type: 'string', maxLength: 500 },
                description: { type: ['string', 'null'] },
                status: STATUS,
                priority: PRIORITY,
                deadline: { type: ['string', 'null'], format: 'date-time' },
                scheduled_date: { type: ['string', 'null'], format: 'date' },
                scheduled_time: { type: ['string', 'null'] },
            },
        },
        annotations: WRITE,
        run: (key, a) => {
            const { id, ...patch } = a;
            return callRpc('api_v1_update_task', { p_key: key, p_id: uuid(id), p_patch: patch });
        },
    },
    {
        name: 'reorder_tasks',
        title: 'Sắp xếp lại Kanban',
        description:
            'Gửi id theo thứ tự mới (phần tử đầu = trên cùng). Task khác cùng cột giữ thứ tự cũ, xếp phía sau. Có thể kèm status để chuyển cả nhóm sang cột đó.',
        inputSchema: {
            type: 'object',
            required: ['ids'],
            properties: {
                ids: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1, maxItems: 500 },
                status: STATUS,
            },
        },
        annotations: { ...WRITE, idempotentHint: true },
        run: (key, a) => {
            if (!Array.isArray(a.ids) || a.ids.length === 0) throw new ApiError(400, 'invalid_ids', 'ids phải là mảng UUID không rỗng.');
            return callRpc('api_v1_reorder_tasks', { p_key: key, p_ids: a.ids.map(uuid), p_status: a.status ?? null });
        },
    },
    {
        name: 'get_finance_overview',
        title: 'Tổng quan tài chính',
        description:
            'Chi tiêu theo danh mục so với hạn mức (ok/warning/over), so với tháng trước, chi trung bình/ngày, dự báo cuối tháng, mức chi an toàn mỗi ngày, hóa đơn định kỳ, ví, nợ.',
        inputSchema: {
            type: 'object',
            properties: {
                month: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$', description: 'YYYY-MM, mặc định tháng hiện tại' },
                tz: { type: 'string' },
            },
        },
        annotations: READ,
        run: (key, a) => callRpc('api_v1_finance_overview', { p_key: key, p_month: a.month ?? null, p_tz: a.tz || 'Asia/Ho_Chi_Minh' }),
    },
    {
        name: 'list_insights',
        title: 'Lời khuyên đã ghi',
        description: 'Đọc lại các phân tích / lời khuyên đã ghi trước đó để tránh lặp ý.',
        inputSchema: {
            type: 'object',
            properties: {
                limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
                category: { type: 'string', enum: ['general', 'tasks', 'finance', 'habits', 'schedule', 'health', 'career'] },
            },
        },
        annotations: READ,
        run: (key, a) => callRpc('api_v1_list_insights', { p_key: key, p_limit: a.limit ?? 20, p_category: a.category ?? null }),
    },
    {
        name: 'create_insight',
        title: 'Ghi lời khuyên',
        description: 'Lưu phân tích / lời khuyên (Markdown) vào Nhật ký cố vấn AI trong SmartLife để người dùng xem lại.',
        inputSchema: {
            type: 'object',
            required: ['title', 'content'],
            properties: {
                title: { type: 'string', maxLength: 200 },
                content: { type: 'string', maxLength: 20000 },
                category: { type: 'string', enum: ['general', 'tasks', 'finance', 'habits', 'schedule', 'health', 'career'] },
                severity: { type: 'string', enum: ['info', 'suggestion', 'warning', 'critical'] },
            },
        },
        annotations: WRITE,
        run: (key, a) => callRpc('api_v1_create_insight', { p_key: key, p_insight: a }),
    },
];

const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));

function uuid(v) {
    if (typeof v !== 'string' || !UUID.test(v)) throw new ApiError(400, 'invalid_id', `"${v}" không phải UUID hợp lệ.`);
    return v;
}

// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------
const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message, data) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data ? { data } : {}) } });

function getKey(req) {
    const m = /^Bearer\s+(\S+)\s*$/i.exec(req.headers['authorization'] || '');
    if (m) return m[1];
    const header = (req.headers['x-api-key'] || '').trim();
    if (header) return header;
    const q = req.query?.key;
    return (Array.isArray(q) ? q[0] : q) || '';
}

async function handleMessage(msg, key) {
    // Phản hồi từ client (không có method) → không cần trả lời
    if (msg && msg.jsonrpc === '2.0' && msg.method === undefined && ('result' in msg || 'error' in msg)) return null;
    if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
        return rpcError(msg?.id, -32600, 'Invalid Request');
    }
    const isNotification = msg.id === undefined;
    const params = msg.params || {};

    switch (msg.method) {
        case 'initialize': {
            const requested = params.protocolVersion;
            return rpcResult(msg.id, {
                protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
                capabilities: { tools: { listChanged: false } },
                serverInfo: SERVER_INFO,
                instructions: INSTRUCTIONS,
            });
        }
        case 'ping':
            return isNotification ? null : rpcResult(msg.id, {});
        case 'tools/list':
            return rpcResult(msg.id, {
                tools: TOOLS.map(({ run, ...t }) => t),
            });
        case 'tools/call': {
            const tool = TOOL_MAP.get(params.name);
            if (!tool) return rpcError(msg.id, -32602, `Unknown tool: ${params.name}`);
            const args = params.arguments && typeof params.arguments === 'object' ? params.arguments : {};
            try {
                const data = await tool.run(key, args);
                return rpcResult(msg.id, { content: [{ type: 'text', text: JSON.stringify(data) }] });
            } catch (err) {
                // Lỗi nghiệp vụ trả về cho model đọc được (isError), không làm hỏng phiên MCP
                const message = err instanceof ApiError
                    ? `[${err.status} ${err.code}] ${err.message}`
                    : 'Lỗi máy chủ, vui lòng thử lại.';
                if (!(err instanceof ApiError)) console.error('[api/mcp] tool error', err);
                return rpcResult(msg.id, { content: [{ type: 'text', text: message }], isError: true });
            }
        }
        case 'resources/list':
            return rpcResult(msg.id, { resources: [] });
        case 'prompts/list':
            return rpcResult(msg.id, { prompts: [] });
        default:
            if (isNotification) return null; // notifications/initialized, notifications/cancelled...
            return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
    }
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, X-API-Key, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(204).end();
    // Stateless: không mở SSE stream, không có session để xóa
    if (req.method === 'GET' || req.method === 'DELETE') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json(rpcError(null, -32000, 'Method not allowed. Use POST.'));
    }
    if (req.method !== 'POST') return res.status(405).end();

    const key = getKey(req);
    if (!KEY_PATTERN.test(key)) {
        res.setHeader('WWW-Authenticate', 'Bearer realm="SmartLife MCP"');
        return res.status(401).json(rpcError(null, -32001, 'Thiếu hoặc sai API key. Dùng header Authorization: Bearer sl_live_... (hoặc ?key=sl_live_...).'));
    }

    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch {
            return res.status(400).json(rpcError(null, -32700, 'Parse error'));
        }
    }

    const batch = Array.isArray(body);
    const messages = batch ? body : [body];
    if (messages.length === 0) return res.status(400).json(rpcError(null, -32600, 'Invalid Request'));

    const responses = (await Promise.all(messages.map((m) => handleMessage(m, key)))).filter(Boolean);

    // Chỉ toàn notification → 202 không có body
    if (responses.length === 0) return res.status(202).end();
    return res.status(200).json(batch ? responses : responses[0]);
}
