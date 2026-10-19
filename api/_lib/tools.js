// File: api/_lib/tools.js
// Danh sách tool dùng chung cho MCP server (api/mcp.js) và bot Telegram (api/telegram.js).
// Mỗi tool gọi đúng hàm SQL api_v1_* nên scope / rate limit giống REST API.

import { callRpc, ApiError } from './authKey.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const INSTRUCTIONS =
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

export const TOOLS = [
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

export const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));

function uuid(v) {
    if (typeof v !== 'string' || !UUID.test(v)) throw new ApiError(400, 'invalid_id', `"${v}" không phải UUID hợp lệ.`);
    return v;
}
