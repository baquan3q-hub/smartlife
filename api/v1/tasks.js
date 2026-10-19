// File: api/v1/tasks.js
// Một function xử lý toàn bộ nhóm /tasks (vercel.json rewrite gắn ?id= hoặc ?action=):
//   GET   /api/v1/tasks              → danh sách (lọc status, priority, deadline, overdue, q)
//   GET   /api/v1/tasks/:id          → chi tiết 1 task
//   POST  /api/v1/tasks              → tạo task (mặc định vào cột backlog)
//   PATCH /api/v1/tasks/:id          → cập nhật một phần
//   POST  /api/v1/tasks/reorder      → sắp xếp lại thứ tự Kanban

import { apiHandler, callRpc, readJsonBody, q, qList, ApiError } from '../_lib/authKey.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function taskId(req) {
    const id = q(req, 'id');
    if (id === undefined) return undefined;
    if (!UUID.test(id)) throw new ApiError(400, 'invalid_id', 'Task id phải là UUID.');
    return id;
}

function toInt(v, name) {
    if (v === undefined) return undefined;
    const n = Number(v);
    if (!Number.isInteger(n)) throw new ApiError(400, 'invalid_input', `${name} phải là số nguyên.`);
    return n;
}

function toBool(v, name) {
    if (v === undefined) return undefined;
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
    throw new ApiError(400, 'invalid_input', `${name} phải là true hoặc false.`);
}

export default apiHandler({
    GET: async (req, { key }) => {
        const id = taskId(req);
        if (id) {
            return callRpc('api_v1_get_task', { p_key: key, p_id: id });
        }
        return callRpc('api_v1_list_tasks', {
            p_key: key,
            p_status: qList(req, 'status'),
            p_priority: qList(req, 'priority'),
            p_due_from: q(req, 'due_from') ?? null,
            p_due_to: q(req, 'due_to') ?? null,
            p_overdue: toBool(q(req, 'overdue'), 'overdue') ?? null,
            p_search: q(req, 'q') ?? null,
            p_limit: toInt(q(req, 'limit'), 'limit') ?? 50,
            p_offset: toInt(q(req, 'offset'), 'offset') ?? 0,
        });
    },

    POST: async (req, { key }) => {
        const body = readJsonBody(req);

        if (q(req, 'action') === 'reorder') {
            const ids = body.ids;
            if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === 'string' && UUID.test(x))) {
                throw new ApiError(400, 'invalid_ids', 'ids phải là mảng UUID theo thứ tự mới (phần tử đầu = trên cùng).');
            }
            return callRpc('api_v1_reorder_tasks', {
                p_key: key,
                p_ids: ids,
                p_status: body.status ?? null,
            });
        }

        const task = await callRpc('api_v1_create_task', { p_key: key, p_task: body });
        return { status: 201, body: task };
    },

    PATCH: async (req, { key }) => {
        const id = taskId(req);
        if (!id) throw new ApiError(400, 'missing_id', 'Dùng PATCH /api/v1/tasks/{id}.');
        return callRpc('api_v1_update_task', { p_key: key, p_id: id, p_patch: readJsonBody(req) });
    },
});
