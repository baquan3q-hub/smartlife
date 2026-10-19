// File: api/_lib/openapiSpec.js
// Đặc tả OpenAPI 3.1 cho SmartLife API v1 — dùng cho OpenAI Custom GPT Actions, n8n, Postman...
// `baseUrl` được điền theo domain đang chạy (xem api/v1/openapi.js).

const errorResponse = (description) => ({
    description,
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const commonErrors = {
    400: errorResponse('Dữ liệu đầu vào không hợp lệ'),
    401: errorResponse('Thiếu, sai, hết hạn hoặc đã thu hồi API key'),
    403: errorResponse('API key thiếu scope cần thiết'),
    429: errorResponse('Vượt giới hạn 120 request/phút'),
};

const json = (schema) => ({ 'application/json': { schema } });

export function buildOpenApiSpec(baseUrl) {
    return {
        openapi: '3.1.0',
        info: {
            title: 'SmartLife API',
            version: '1.0.0',
            description:
                'API cá nhân của SmartLife cho trợ lý AI. Gọi getContext trước để nắm toàn cảnh (task, tài chính, thói quen) ' +
                'trong 1 lần. Ưu tiên task: urgent > focus > chill > temp. Cột Kanban: backlog, todo, doing, done. Tiền tệ theo user.currency (mặc định VND).',
        },
        servers: [{ url: baseUrl }],
        security: [{ bearerAuth: [] }],
        paths: {
            '/api/v1/ai/context': {
                get: {
                    operationId: 'getContext',
                    summary: 'Bức tranh toàn cảnh người dùng (gọi đầu tiên)',
                    description:
                        'Hồ sơ, mục tiêu, số task theo cột, task quá hạn / sắp đến hạn / ưu tiên cao, lịch hôm nay, số dư ví, chi tiêu tháng so với ngân sách, hóa đơn định kỳ 7 ngày tới, streak thói quen, thời gian tập trung. Scope: context:read hoặc read:all.',
                    parameters: [
                        { name: 'tz', in: 'query', required: false, schema: { type: 'string', default: 'Asia/Ho_Chi_Minh' }, description: 'IANA timezone' },
                    ],
                    responses: {
                        200: { description: 'Context JSON', content: json({ $ref: '#/components/schemas/Context' }) },
                        ...commonErrors,
                    },
                },
            },
            '/api/v1/tasks': {
                get: {
                    operationId: 'listTasks',
                    summary: 'Danh sách task (mặc định bỏ qua task đã done)',
                    description: 'Lọc theo cột, ưu tiên, khoảng deadline, quá hạn, từ khóa. Sắp xếp: doing, todo, backlog, done rồi theo sort_order. Scope: tasks:read.',
                    parameters: [
                        { name: 'status', in: 'query', schema: { type: 'string' }, description: 'Danh sách phân tách bằng dấu phẩy: backlog,todo,doing,done' },
                        { name: 'priority', in: 'query', schema: { type: 'string' }, description: 'Danh sách phân tách bằng dấu phẩy: urgent,focus,chill,temp' },
                        { name: 'due_from', in: 'query', schema: { type: 'string', format: 'date-time' } },
                        { name: 'due_to', in: 'query', schema: { type: 'string', format: 'date-time' } },
                        { name: 'overdue', in: 'query', schema: { type: 'boolean' } },
                        { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Tìm trong tiêu đề và mô tả' },
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, minimum: 1, maximum: 200 } },
                        { name: 'offset', in: 'query', schema: { type: 'integer', default: 0, minimum: 0 } },
                    ],
                    responses: {
                        200: {
                            description: 'Danh sách task',
                            content: json({
                                type: 'object',
                                properties: {
                                    total: { type: 'integer' },
                                    limit: { type: 'integer' },
                                    offset: { type: 'integer' },
                                    items: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
                                },
                            }),
                        },
                        ...commonErrors,
                    },
                },
                post: {
                    operationId: 'createTask',
                    summary: 'Tạo task mới (mặc định vào cột backlog)',
                    description: 'Dùng để gợi ý task cho người dùng. Task mới nằm trên cùng cột. Scope: tasks:write.',
                    requestBody: { required: true, content: json({ $ref: '#/components/schemas/TaskCreate' }) },
                    responses: {
                        201: { description: 'Task đã tạo', content: json({ $ref: '#/components/schemas/Task' }) },
                        ...commonErrors,
                    },
                },
            },
            '/api/v1/tasks/{id}': {
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                get: {
                    operationId: 'getTask',
                    summary: 'Chi tiết 1 task',
                    responses: {
                        200: { description: 'Task', content: json({ $ref: '#/components/schemas/Task' }) },
                        404: errorResponse('Không tìm thấy task'),
                        ...commonErrors,
                    },
                },
                patch: {
                    operationId: 'updateTask',
                    summary: 'Cập nhật một phần task',
                    description: 'Chỉ gửi trường cần đổi. Gửi deadline: null để xóa hạn. Chuyển status sang done sẽ ghi completed_at. Scope: tasks:write.',
                    requestBody: { required: true, content: json({ $ref: '#/components/schemas/TaskPatch' }) },
                    responses: {
                        200: { description: 'Task sau khi cập nhật', content: json({ $ref: '#/components/schemas/Task' }) },
                        404: errorResponse('Không tìm thấy task'),
                        ...commonErrors,
                    },
                },
            },
            '/api/v1/tasks/reorder': {
                post: {
                    operationId: 'reorderTasks',
                    summary: 'Sắp xếp lại thứ tự task trên bảng Kanban',
                    description:
                        'Gửi danh sách id theo thứ tự mới (phần tử đầu = trên cùng). Task khác trong cùng cột giữ thứ tự cũ và xếp phía sau. Có thể kèm status để chuyển cả nhóm sang cột đó. Scope: tasks:write.',
                    requestBody: {
                        required: true,
                        content: json({
                            type: 'object',
                            required: ['ids'],
                            properties: {
                                ids: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1, maxItems: 500 },
                                status: { type: 'string', enum: ['backlog', 'todo', 'doing', 'done'] },
                            },
                        }),
                    },
                    responses: {
                        200: {
                            description: 'Kết quả',
                            content: json({
                                type: 'object',
                                properties: {
                                    updated: { type: 'integer' },
                                    columns: { type: 'array', items: { type: 'string' } },
                                    order: { type: 'array', items: { type: 'string', format: 'uuid' } },
                                },
                            }),
                        },
                        ...commonErrors,
                    },
                },
            },
            '/api/v1/finance/overview': {
                get: {
                    operationId: 'getFinanceOverview',
                    summary: 'Chi tiêu theo danh mục, ngân sách, dòng tiền',
                    description:
                        'Tổng thu/chi, chi theo danh mục so với hạn mức (status ok/warning/over/no_budget), so sánh tháng trước, chi trung bình/ngày, dự báo cuối tháng, mức chi an toàn mỗi ngày, hóa đơn định kỳ, ví, nợ. Scope: finance:read.',
                    parameters: [
                        { name: 'month', in: 'query', schema: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' }, description: 'YYYY-MM, mặc định tháng hiện tại' },
                        { name: 'tz', in: 'query', schema: { type: 'string', default: 'Asia/Ho_Chi_Minh' } },
                    ],
                    responses: {
                        200: { description: 'Tổng quan tài chính', content: json({ type: 'object', additionalProperties: true }) },
                        ...commonErrors,
                    },
                },
            },
            '/api/v1/ai/insights': {
                get: {
                    operationId: 'listInsights',
                    summary: 'Các phân tích/lời khuyên AI đã ghi trước đó',
                    description: 'Đọc lại để tránh lặp ý. Scope: insights:read (hoặc read:all / insights:write).',
                    parameters: [
                        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 } },
                        { name: 'category', in: 'query', schema: { $ref: '#/components/schemas/InsightCategory' } },
                    ],
                    responses: {
                        200: {
                            description: 'Danh sách',
                            content: json({ type: 'object', properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Insight' } } } }),
                        },
                        ...commonErrors,
                    },
                },
                post: {
                    operationId: 'createInsight',
                    summary: 'Ghi phân tích / lời khuyên cho người dùng xem trong SmartLife',
                    description: 'content hỗ trợ Markdown. Dùng severity warning/critical cho cảnh báo bội chi, quá hạn. Scope: insights:write.',
                    requestBody: { required: true, content: json({ $ref: '#/components/schemas/InsightCreate' }) },
                    responses: {
                        201: {
                            description: 'Đã ghi',
                            content: json({ type: 'object', properties: { id: { type: 'string', format: 'uuid' }, created_at: { type: 'string', format: 'date-time' } } }),
                        },
                        ...commonErrors,
                    },
                },
            },
            '/api/v1/me': {
                get: {
                    operationId: 'whoAmI',
                    summary: 'Kiểm tra API key',
                    responses: {
                        200: { description: 'Thông tin key', content: json({ type: 'object', additionalProperties: true }) },
                        401: commonErrors[401],
                    },
                },
            },
        },
        components: {
            securitySchemes: {
                bearerAuth: { type: 'http', scheme: 'bearer', description: 'API key dạng sl_live_... tạo trong SmartLife → Cài đặt → Tích hợp AI & API' },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'object',
                            properties: {
                                code: { type: 'string' },
                                message: { type: 'string' },
                                required_scope: { type: 'string' },
                            },
                        },
                    },
                },
                Priority: { type: 'string', enum: ['urgent', 'focus', 'chill', 'temp'] },
                Status: { type: 'string', enum: ['backlog', 'todo', 'doing', 'done'] },
                Subtask: {
                    type: 'object',
                    properties: { id: { type: 'string' }, title: { type: 'string' }, is_completed: { type: 'boolean' } },
                },
                Task: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        title: { type: 'string' },
                        description: { type: ['string', 'null'] },
                        status: { $ref: '#/components/schemas/Status' },
                        priority: { $ref: '#/components/schemas/Priority' },
                        deadline: { type: ['string', 'null'], format: 'date-time' },
                        is_overdue: { type: 'boolean' },
                        scheduled_date: { type: ['string', 'null'], format: 'date' },
                        scheduled_time: { type: ['string', 'null'] },
                        sort_order: { type: ['integer', 'null'] },
                        time_spent_minutes: { type: 'number' },
                        subtasks: { type: 'array', items: { $ref: '#/components/schemas/Subtask' } },
                        attach_link: { type: ['string', 'null'] },
                        created_at: { type: 'string', format: 'date-time' },
                        completed_at: { type: ['string', 'null'], format: 'date-time' },
                    },
                },
                TaskCreate: {
                    type: 'object',
                    required: ['title'],
                    properties: {
                        title: { type: 'string', maxLength: 500 },
                        description: { type: 'string' },
                        status: { $ref: '#/components/schemas/Status' },
                        priority: { $ref: '#/components/schemas/Priority' },
                        deadline: { type: 'string', format: 'date-time', description: 'ISO 8601 có múi giờ, vd 2026-10-20T17:00:00+07:00' },
                        scheduled_date: { type: 'string', format: 'date' },
                        scheduled_time: { type: 'string', description: 'HH:MM' },
                        subtasks: { type: 'array', items: { type: 'string' }, maxItems: 50, description: 'Danh sách tiêu đề subtask' },
                        attach_link: { type: 'string' },
                    },
                },
                TaskPatch: {
                    type: 'object',
                    properties: {
                        title: { type: 'string', maxLength: 500 },
                        description: { type: ['string', 'null'] },
                        status: { $ref: '#/components/schemas/Status' },
                        priority: { $ref: '#/components/schemas/Priority' },
                        deadline: { type: ['string', 'null'], format: 'date-time' },
                        scheduled_date: { type: ['string', 'null'], format: 'date' },
                        scheduled_time: { type: ['string', 'null'] },
                        subtasks: { type: 'array', items: { $ref: '#/components/schemas/Subtask' }, description: 'Ghi đè toàn bộ danh sách subtask' },
                        attach_link: { type: ['string', 'null'] },
                        sort_order: { type: 'integer' },
                    },
                },
                InsightCategory: { type: 'string', enum: ['general', 'tasks', 'finance', 'habits', 'schedule', 'health', 'career'] },
                InsightCreate: {
                    type: 'object',
                    required: ['title', 'content'],
                    properties: {
                        title: { type: 'string', maxLength: 200 },
                        content: { type: 'string', maxLength: 20000, description: 'Markdown' },
                        category: { $ref: '#/components/schemas/InsightCategory' },
                        severity: { type: 'string', enum: ['info', 'suggestion', 'warning', 'critical'] },
                        data: { type: 'object', additionalProperties: true, description: 'Dữ liệu kèm theo (tối đa 50KB)' },
                    },
                },
                Insight: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        category: { type: 'string' },
                        severity: { type: 'string' },
                        title: { type: 'string' },
                        content: { type: 'string' },
                        is_read: { type: 'boolean' },
                        source: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                    },
                },
                Context: {
                    type: 'object',
                    description: 'Xem tài liệu docs/api-v1.md để biết đầy đủ các trường.',
                    properties: {
                        generated_at: { type: 'string', format: 'date-time' },
                        timezone: { type: 'string' },
                        today: { type: 'string', format: 'date' },
                        weekday: { type: 'integer', description: '0 = Chủ nhật' },
                        user: { type: 'object', additionalProperties: true },
                        tasks: { type: 'object', additionalProperties: true },
                        finance: { type: 'object', additionalProperties: true },
                        productivity: { type: 'object', additionalProperties: true },
                    },
                },
            },
        },
    };
}
