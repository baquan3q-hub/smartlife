// File: src/services/aiEngine.ts
// SmartLife AI Engine v2 — Orchestrator with Function Calling
// Handles: query_database, add_timetable, add_todo, add_transaction, render_chart, GPA tools

import { supabase } from './supabase';
import {
    callGeminiRaw, enqueue, buildFullContext, buildFullContextAsync,
    buildProfileContext, buildFinanceContext, buildGoalsContext,
    buildScheduleContext, buildGPAContext, buildHabitContext,
    buildCountdownContext, buildJournalContext,
    SYSTEM_INSTRUCTION,
    type ChatMessage, type MessagePart, type ToolDeclaration
} from './geminiService';
import { AppState } from '../types';
import {
    computeAllCourses, calculateSemesterGPA, calculateCumulativeGPA,
    calculateCumulativeData, calculateRequiredGPA, computeCourse,
    getAcademicStanding, predictGraduationHonor,
} from './gpaCalculator';

// ────────────────────────────────────────
// Types
// ────────────────────────────────────────
export interface ChartData {
    chart_type: 'pie' | 'bar' | 'line' | 'area';
    title: string;
    data: Array<{ label: string; value: number; color?: string }>;
}

export interface ActionResult {
    type: 'timetable' | 'todo' | 'transaction';
    success: boolean;
    message: string;
    data?: any;
}

export interface AIResponse {
    text: string;
    charts: ChartData[];
    actions: ActionResult[];
    updatedHistory?: ChatMessage[];
}

// Action handlers passed from App.tsx
export interface ActionHandlers {
    onAddTimetable?: (item: any) => Promise<void>;
    onAddTodo?: (content: string, priority: string, deadline?: string) => Promise<void>;
    onAddTransaction?: (tx: any) => Promise<void>;
}

// ────────────────────────────────────────
// Tool Declarations for Gemini Function Calling
// ────────────────────────────────────────
const TOOL_DECLARATIONS: ToolDeclaration[] = [
    {
        name: 'query_database',
        description: 'Truy vấn dữ liệu chi tiết từ database Supabase. Dùng khi cần lọc, phân tích dữ liệu cụ thể ngoài context tóm tắt để cá nhân hóa. Các bảng khả dụng: transactions (giao dịch), goals (mục tiêu), budgets (ngân sách), timetable (lịch trình), todos (việc cần làm), profiles (hồ sơ), calendar_events (sự kiện lịch).',
        parameters: {
            type: 'object',
            properties: {
                table: {
                    type: 'string',
                    description: 'Tên bảng cần truy vấn',
                    enum: ['transactions', 'goals', 'budgets', 'timetable', 'todos', 'profiles', 'calendar_events', 'gpa_semesters', 'gpa_courses', 'habits', 'habit_logs', 'countdown_items', 'countup_items', 'journal_entries', 'journal_tags']
                },
                select: {
                    type: 'string',
                    description: 'Các cột cần lấy, mặc định "*". VD: "amount,category,date"'
                },
                filters: {
                    type: 'object',
                    description: 'Bộ lọc dạng {column: value}. VD: {"type": "expense", "category": "Ăn uống"}'
                },
                date_from: {
                    type: 'string',
                    description: 'Lọc từ ngày (inclusive). Format: YYYY-MM-DD'
                },
                date_to: {
                    type: 'string',
                    description: 'Lọc đến ngày (inclusive). Format: YYYY-MM-DD'
                },
                order_by: {
                    type: 'string',
                    description: 'Cột sắp xếp. VD: "date" hoặc "amount"'
                },
                ascending: {
                    type: 'boolean',
                    description: 'true = tăng dần, false = giảm dần. Mặc định false.'
                },
                limit: {
                    type: 'integer',
                    description: 'Số record tối đa. Mặc định 50, tối đa 200.'
                }
            },
            required: ['table']
        }
    },
    {
        name: 'add_timetable',
        description: 'Thêm sự kiện mới vào lịch trình cố định hàng tuần. Xác nhận với người dùng trước khi thêm.',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Tên sự kiện. VD: "Học IELTS"' },
                day_of_week: { type: 'integer', description: 'Ngày trong tuần: 0=Chủ nhật, 1=Thứ 2, 2=Thứ 3, 3=Thứ 4, 4=Thứ 5, 5=Thứ 6, 6=Thứ 7' },
                start_time: { type: 'string', description: 'Giờ bắt đầu, format HH:mm. VD: "19:00"' },
                end_time: { type: 'string', description: 'Giờ kết thúc, format HH:mm. VD: "20:30"' },
                location: { type: 'string', description: 'Địa điểm (tuỳ chọn)' }
            },
            required: ['title', 'day_of_week', 'start_time']
        }
    },
    {
        name: 'add_todo',
        description: 'Thêm một việc cần làm (todo) mới. Xác nhận với người dùng trước khi thêm.',
        parameters: {
            type: 'object',
            properties: {
                content: { type: 'string', description: 'Nội dung việc cần làm' },
                priority: { type: 'string', description: 'Mức ưu tiên', enum: ['high', 'medium', 'low'] },
                deadline: { type: 'string', description: 'Hạn hoàn thành, format YYYY-MM-DD' }
            },
            required: ['content']
        }
    },
    {
        name: 'add_transaction',
        description: 'Thêm giao dịch thu nhập hoặc chi tiêu mới.',
        parameters: {
            type: 'object',
            properties: {
                amount: { type: 'number', description: 'Số tiền (VND)' },
                category: { type: 'string', description: 'Danh mục. Chi tiêu: Ăn uống, Di chuyển, Nhà cửa, Điện nước, Mua sắm, Giải trí, Sức khỏe, Giáo dục, Đầu tư, Trả nợ, Cho vay, Hiếu hỉ, Dating, Du lịch, Khác. Thu nhập: Lương, Thưởng, Bán hàng, Đầu tư, Được tặng, Khác.' },
                type: { type: 'string', description: 'Loại giao dịch', enum: ['income', 'expense'] },
                date: { type: 'string', description: 'Ngày giao dịch, format YYYY-MM-DD. Mặc định hôm nay.' },
                description: { type: 'string', description: 'Ghi chú (tuỳ chọn)' }
            },
            required: ['amount', 'category', 'type']
        }
    },
    {
        name: 'render_chart',
        description: 'Vẽ biểu đồ trực quan để hiển thị cho người dùng. Dùng khi cần trực quan hóa dữ liệu chi tiêu, xu hướng, so sánh, v.v.',
        parameters: {
            type: 'object',
            properties: {
                chartType: { type: 'string', description: 'Loại biểu đồ. Khuyến khích dùng bar (cột) hoặc line (đường). TUYỆT ĐỐI KHÔNG vẽ biểu đồ tròn (pie).', enum: ['bar', 'line'] },
                title: { type: 'string', description: 'Tiêu đề biểu đồ' },
                data: {
                    type: 'array',
                    description: 'Dữ liệu biểu đồ. Mỗi phần tử có label (tên), value (giá trị số), color (màu hex tuỳ chọn)',
                    items: {
                        type: 'object',
                        properties: {
                            label: { type: 'string' },
                            value: { type: 'number' },
                            color: { type: 'string', description: 'Mã màu hex. VD: "#6366f1"' }
                        },
                        required: ['label', 'value']
                    }
                }
            },
            required: ['chartType', 'title', 'data']
        }
    },
    {
        name: 'calculate_needed_gpa',
        description: 'Tính ngược: cần GPA bao nhiêu trong N tín chỉ còn lại để đạt GPA tích lũy mục tiêu. Dùng khi sinh viên hỏi "cần bao nhiêu điểm để đạt Giỏi/Xuất sắc".',
        parameters: {
            type: 'object',
            properties: {
                target_gpa: {
                    type: 'number',
                    description: 'GPA tích lũy mục tiêu cần đạt. VD: 3.2 (Giỏi), 3.6 (Xuất sắc)'
                },
                remaining_credits: {
                    type: 'integer',
                    description: 'Số tín chỉ còn lại phải học. Nếu không biết, dùng tổng TC yêu cầu trừ TC đã tích lũy.'
                }
            },
            required: ['target_gpa']
        }
    },
    {
        name: 'simulate_gpa',
        description: 'Mô phỏng "what-if": nếu đạt GPA X trong học kỳ tới với Y tín chỉ, GPA tích lũy sẽ thay đổi thế nào? Dùng để tư vấn kịch bản cho sinh viên.',
        parameters: {
            type: 'object',
            properties: {
                scenarios: {
                    type: 'array',
                    description: 'Danh sách kịch bản. Mỗi kịch bản có semester_gpa (GPA dự kiến) và credits (số TC).',
                    items: {
                        type: 'object',
                        properties: {
                            semester_gpa: { type: 'number', description: 'GPA dự kiến cho học kỳ tới. VD: 3.5' },
                            credits: { type: 'integer', description: 'Số tín chỉ đăng ký. VD: 18' },
                            label: { type: 'string', description: 'Tên kịch bản. VD: "Kịch bản lạc quan"' }
                        },
                        required: ['semester_gpa', 'credits']
                    }
                }
            },
            required: ['scenarios']
        }
    },
    {
        name: 'batch_add_transactions',
        description: 'Thêm nhiều giao dịch thu nhập/chi tiêu cùng lúc. Dùng khi người dùng liệt kê nhiều khoản chi tiêu hoặc thu nhập trong một tin nhắn. VD: "Hôm nay tôi chi: ăn sáng 30k, grab 25k, mua sách 150k"',
        parameters: {
            type: 'object',
            properties: {
                transactions: {
                    type: 'array',
                    description: 'Danh sách giao dịch cần thêm.',
                    items: {
                        type: 'object',
                        properties: {
                            amount: { type: 'number', description: 'Số tiền (VND). Lưu ý: 30k = 30000, 1tr = 1000000' },
                            category: { type: 'string', description: 'Danh mục phù hợp nhất' },
                            type: { type: 'string', enum: ['income', 'expense'] },
                            date: { type: 'string', description: 'Ngày giao dịch YYYY-MM-DD. Mặc định hôm nay.' },
                            description: { type: 'string', description: 'Mô tả ngắn gọn' }
                        },
                        required: ['amount', 'category', 'type']
                    }
                }
            },
            required: ['transactions']
        }
    },
    {
        name: 'get_user_profile',
        description: 'Lấy thông tin cá nhân của người dùng (tên, tuổi, DISC, MBTI, sở thích, nghề nghiệp, định hướng...).',
        parameters: { type: 'object', properties: {} }
    },
    {
        name: 'get_financial_report',
        description: 'Lấy báo cáo chi tiết tài chính của người dùng (số dư hiện tại, tổng thu chi tháng, chi tiêu chi tiết theo danh mục, trạng thái ngân sách, xu hướng 6 tháng và 10 giao dịch gần nhất).',
        parameters: { type: 'object', properties: {} }
    },
    {
        name: 'get_todos_and_schedule',
        description: 'Lấy danh sách công việc cần làm (todos) và lịch trình cố định của người dùng.',
        parameters: { type: 'object', properties: {} }
    },
    {
        name: 'get_academic_gpa_record',
        description: 'Lấy bảng điểm chi tiết, tín chỉ tích lũy, cảnh báo học vụ, dự báo xếp loại tốt nghiệp và GPA tích lũy.',
        parameters: { type: 'object', properties: {} }
    },
    {
        name: 'get_habits_tracker',
        description: 'Lấy danh sách thói quen đang hoạt động, streak ngày, tần suất, tỷ lệ hoàn thành và check-in hôm nay.',
        parameters: { type: 'object', properties: {} }
    },
    {
        name: 'get_countdown_events',
        description: 'Lấy danh sách sự kiện đếm ngược hoặc mốc đếm tiến.',
        parameters: { type: 'object', properties: {} }
    },
    {
        name: 'get_journal_entries',
        description: 'Lấy nội dung các bài viết nhật ký, mood (cảm xúc), và lòng biết ơn của người dùng trong 5 ngày gần nhất.',
        parameters: { type: 'object', properties: {} }
    }
];

// ────────────────────────────────────────
// Tool Execution
// ────────────────────────────────────────

// Date column mapping per table (for date filters)
const DATE_COLUMNS: Record<string, string> = {
    transactions: 'date',
    goals: 'deadline',
    budgets: 'month',
    timetable: 'created_at',
    todos: 'created_at',
    calendar_events: 'event_date',
    profiles: 'updated_at',
    gpa_semesters: 'created_at',
    gpa_courses: 'created_at',
    habits: 'created_at',
    habit_logs: 'log_date',
    countdown_items: 'target_date',
    countup_items: 'start_date',
    journal_entries: 'entry_date',
    journal_tags: 'created_at',
};

async function executeQueryDatabase(args: any): Promise<any> {
    const { table, select = '*', filters, date_from, date_to, order_by, ascending = false, limit = 50 } = args;
    const safeLimit = Math.min(limit, 200);

    let query = supabase.from(table).select(select);

    // Apply equality filters
    if (filters && typeof filters === 'object') {
        for (const [col, val] of Object.entries(filters)) {
            if (val !== undefined && val !== null) {
                query = query.eq(col, val);
            }
        }
    }

    // Apply date range filters
    const dateCol = DATE_COLUMNS[table] || 'created_at';
    if (date_from) query = query.gte(dateCol, date_from);
    if (date_to) query = query.lte(dateCol, date_to);

    // Order
    if (order_by) {
        query = query.order(order_by, { ascending });
    } else {
        query = query.order(dateCol, { ascending: false });
    }

    // Limit
    query = query.limit(safeLimit);

    const { data, error } = await query;
    if (error) {
        return { error: error.message, count: 0 };
    }
    return { data, count: data?.length || 0 };
}

async function executeAddTimetable(
    args: any,
    handlers: ActionHandlers
): Promise<ActionResult> {
    const { title, day_of_week, start_time, end_time, location } = args;
    const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

    try {
        if (handlers.onAddTimetable) {
            await handlers.onAddTimetable({
                title,
                day_of_week,
                start_time,
                end_time: end_time || null,
                location: location || null
            });
        }
        return {
            type: 'timetable',
            success: true,
            message: `✅ Đã thêm lịch: "${title}" vào ${dayNames[day_of_week]} lúc ${start_time}${end_time ? `-${end_time}` : ''}${location ? ` tại ${location}` : ''}`,
            data: args
        };
    } catch (error: any) {
        return { type: 'timetable', success: false, message: `❌ Lỗi thêm lịch: ${error.message}` };
    }
}

async function executeAddTodo(
    args: any,
    handlers: ActionHandlers
): Promise<ActionResult> {
    const { content, priority = 'medium', deadline } = args;
    try {
        if (handlers.onAddTodo) {
            await handlers.onAddTodo(content, priority, deadline);
        }
        return {
            type: 'todo',
            success: true,
            message: `✅ Đã thêm việc: "${content}" [${priority}]${deadline ? ` (Hạn: ${deadline})` : ''}`,
            data: args
        };
    } catch (error: any) {
        return { type: 'todo', success: false, message: `❌ Lỗi thêm việc: ${error.message}` };
    }
}

async function executeAddTransaction(
    args: any,
    handlers: ActionHandlers
): Promise<ActionResult> {
    const { amount, category, type, description } = args;
    const date = args.date || new Date().toISOString().slice(0, 10);
    try {
        if (handlers.onAddTransaction) {
            await handlers.onAddTransaction({ amount, category, type, date, description: description || '' });
        }
        const label = type === 'income' ? 'thu nhập' : 'chi tiêu';
        return {
            type: 'transaction',
            success: true,
            message: `✅ Đã thêm ${label}: ${amount.toLocaleString('vi-VN')}đ [${category}] ngày ${date}`,
            data: { ...args, date }
        };
    } catch (error: any) {
        return { type: 'transaction', success: false, message: `❌ Lỗi thêm giao dịch: ${error.message}` };
    }
}

// ────────────────────────────────────────
// Batch Transaction Executor
// ────────────────────────────────────────
export interface AIAttachment {
    mimeType: string;
    data: string; // Base64 representation of the file
}

// Action handlers passed from App.tsx
export interface ActionHandlers {
    onAddTimetable?: (item: any) => Promise<void>;
    onAddTodo?: (content: string, priority: string, deadline?: string) => Promise<void>;
    onAddTransaction?: (tx: any) => Promise<void>;
}

async function executeBatchAddTransactions(
    args: any,
    handlers: ActionHandlers
): Promise<ActionResult> {
    const { transactions: txList } = args;
    if (!txList || !Array.isArray(txList) || txList.length === 0) {
        return { type: 'transaction', success: false, message: '❌ Danh sách giao dịch trống.' };
    }

    const results: string[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const tx of txList) {
        const date = tx.date || new Date().toISOString().slice(0, 10);
        try {
            if (handlers.onAddTransaction) {
                await handlers.onAddTransaction({
                    amount: tx.amount,
                    category: tx.category,
                    type: tx.type,
                    date,
                    description: tx.description || ''
                });
            }
            const label = tx.type === 'income' ? 'thu' : 'chi';
            results.push(`✅ ${label}: ${tx.amount.toLocaleString('vi-VN')}đ [${tx.category}]`);
            successCount++;
        } catch (error: any) {
            results.push(`❌ Lỗi: ${tx.category} — ${error.message}`);
            failCount++;
        }
    }

    return {
        type: 'transaction',
        success: failCount === 0,
        message: `Đã thêm ${successCount}/${txList.length} giao dịch:\n${results.join('\n')}`,
        data: { successCount, failCount, total: txList.length }
    };
}

// ────────────────────────────────────────
// Main Orchestrator — Chat with Function Calling loop
// ────────────────────────────────────────
function cleanChatHistory(contents: ChatMessage[]): ChatMessage[] {
    return contents.map(m => {
        if (m.role === 'user') {
            return m;
        }
        if (m.role === 'model') {
            const textPartsOnly = m.parts.filter(p => 'text' in p);
            if (textPartsOnly.length > 0) {
                return { role: 'model' as const, parts: textPartsOnly };
            }
        }
        return null;
    }).filter(Boolean) as ChatMessage[];
}

const MAX_TOOL_CALLS = 10; // Safety limit to prevent infinite loops

export async function chatWithAI(
    history: ChatMessage[],
    appState: AppState,
    handlers: ActionHandlers = {},
    memoryContext: string = '',
    attachments?: AIAttachment[]
): Promise<AIResponse> {
    const userName = appState.profile?.full_name || 'Người dùng';
    const now = new Date();
    const minimalContext = `\n👤 NGƯỜI DÙNG HIỆN TẠI: ${userName}\n📅 THỜI GIAN HỆ THỐNG: ${now.toLocaleString('vi-VN')} (Thứ ${now.getDay() === 0 ? 'Chủ Nhật' : now.getDay() + 1}, ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()})`;

    const profileContext = buildProfileContext(appState);
    const fullSystemPrompt = SYSTEM_INSTRUCTION
        + minimalContext
        + (profileContext ? '\n\n--- HỒ SƠ CÁ NHÂN NGƯỜI DÙNG ---\n' + profileContext : '')
        + (memoryContext ? '\n\n--- BỘ NHỚ DÀI HẠN ---\n' + memoryContext : '');

    const charts: ChartData[] = [];
    const actions: ActionResult[] = [];

    // Build request with tools
    const buildRequest = (contents: any[]) => ({
        systemInstruction: { parts: [{ text: fullSystemPrompt }] },
        contents,
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
        toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
        generationConfig: { temperature: 0.7, topP: 0.95, topK: 40, maxOutputTokens: 4096 },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
    });

    return enqueue(async () => {
        // Convert to Gemini format (only user/model roles, skip function roles for initial)
        let contents: ChatMessage[] = history.map(m => ({
            role: m.role === 'function' ? 'function' : m.role,
            parts: [...m.parts] // shallow copy to preserve original history parts
        }));

        // Attach Base64 files to the very last message in the conversation contents, if it is a user message
        if (attachments && attachments.length > 0 && contents.length > 0) {
            const lastMsg = contents[contents.length - 1];
            if (lastMsg.role === 'user') {
                const fileParts = attachments.map(att => ({
                    inlineData: {
                        mimeType: att.mimeType,
                        data: att.data
                    }
                }));
                lastMsg.parts = [...fileParts, ...lastMsg.parts];
            }
        }

        let toolCallCount = 0;

        while (toolCallCount < MAX_TOOL_CALLS) {
            if (toolCallCount > 0) {
                // Tránh gọi API liên tục quá nhanh gây nghẽn burst limit (lỗi 503)
                await new Promise(r => setTimeout(r, 1200));
            }
            const body = buildRequest(contents);
            const data = await callGeminiRaw(body);

            // Log token usage
            if (data?.usageMetadata?.totalTokenCount) {
                supabase.auth.getUser().then(({ data: authData }) => {
                    const uid = authData?.user?.id;
                    if (!uid) { console.warn('[SmartLife] Token log skipped: no user'); return; }
                    supabase.from('api_logs').insert([{
                        user_id: uid,
                        action: 'chat',
                        tokens_used: data.usageMetadata.totalTokenCount
                    }]).then(({ error }) => {
                        if (error) console.error('[SmartLife] ❌ Token log failed:', error.message);
                        else console.info(`[SmartLife] ✅ Logged ${data.usageMetadata.totalTokenCount} tokens`);
                    });
                });
            }

            const candidate = data?.candidates?.[0];
            if (!candidate?.content?.parts) {
                return { text: 'Không nhận được phản hồi từ AI.', charts, actions, updatedHistory: cleanChatHistory(contents) };
            }

            const responseParts: MessagePart[] = candidate.content.parts;

            // Check if any part is a function call
            const functionCalls = responseParts.filter(
                (p: any) => p.functionCall
            ) as Array<{ functionCall: { name: string; args: Record<string, any> } }>;

            if (functionCalls.length === 0) {
                // No function calls — extract text and return
                contents.push({ role: 'model', parts: responseParts });
                const textParts = responseParts
                    .filter((p: any) => p.text)
                    .map((p: any) => p.text);
                return {
                    text: textParts.join('\n') || 'Không có phản hồi.',
                    charts,
                    actions,
                    updatedHistory: cleanChatHistory(contents)
                };
            }

            // Process each function call
            const functionResponses: any[] = [];
            
            // Append the model's function call message to contents
            contents.push({ role: 'model', parts: responseParts });

            for (const fc of functionCalls) {
                const { name, args } = fc.functionCall;
                console.info(`[SmartLife AI] Tool call: ${name}`, args);
                let result: any;

                switch (name) {
                    case 'query_database':
                        result = await executeQueryDatabase(args);
                        break;
                    case 'add_timetable': {
                        const actionResult = await executeAddTimetable(args, handlers);
                        actions.push(actionResult);
                        result = { success: actionResult.success, message: actionResult.message };
                        break;
                    }
                    case 'add_todo': {
                        const actionResult = await executeAddTodo(args, handlers);
                        actions.push(actionResult);
                        result = { success: actionResult.success, message: actionResult.message };
                        break;
                    }
                    case 'add_transaction': {
                        const actionResult = await executeAddTransaction(args, handlers);
                        actions.push(actionResult);
                        result = { success: actionResult.success, message: actionResult.message };
                        break;
                    }
                    case 'render_chart': {
                        charts.push({
                            chart_type: args.chartType || args.chart_type || 'bar',
                            title: args.title,
                            data: args.data || []
                        });
                        result = { success: true, message: `Biểu đồ "${args.title}" đã được tạo và hiển thị cho người dùng.` };
                        break;
                    }
                    case 'calculate_needed_gpa': {
                        result = executeCalculateNeededGPA(args, appState);
                        break;
                    }
                    case 'simulate_gpa': {
                        result = executeSimulateGPA(args, appState);
                        break;
                    }
                    case 'batch_add_transactions': {
                        const actionResult = await executeBatchAddTransactions(args, handlers);
                        actions.push(actionResult);
                        result = { success: actionResult.success, message: actionResult.message };
                        break;
                    }
                    case 'get_user_profile':
                        result = { result: buildProfileContext(appState) };
                        break;
                    case 'get_financial_report':
                        result = { result: buildFinanceContext(appState) };
                        break;
                    case 'get_todos_and_schedule':
                        result = { result: buildScheduleContext(appState) };
                        break;
                    case 'get_academic_gpa_record':
                        result = { result: buildGPAContext(appState) };
                        break;
                    case 'get_habits_tracker':
                        result = { result: await buildHabitContext() };
                        break;
                    case 'get_countdown_events':
                        result = { result: await buildCountdownContext() };
                        break;
                    case 'get_journal_entries':
                        result = { result: await buildJournalContext() };
                        break;
                    default:
                        result = { error: `Unknown tool: ${name}` };
                }

                functionResponses.push({
                    functionResponse: { name, response: { result } }
                });
                toolCallCount++;
            }

            // Append the function response message to contents
            contents.push({ role: 'function', parts: functionResponses });
        }

        // If we hit the limit, return what we have
        return {
            text: '⚠️ AI đã thực hiện quá nhiều truy vấn. Vui lòng thử câu hỏi đơn giản hơn.',
            charts,
            actions,
            updatedHistory: cleanChatHistory(contents)
        };
    });
}

// ────────────────────────────────────────
// GPA Tool Executors
// ────────────────────────────────────────
function executeCalculateNeededGPA(args: any, appState: AppState): any {
    const { target_gpa, remaining_credits: userRemainingCredits } = args;
    const { gpaSemesters } = appState;

    if (!gpaSemesters || gpaSemesters.length === 0) {
        return { error: 'Chưa có dữ liệu GPA. Sinh viên cần nhập điểm trước.' };
    }

    const semestersComputed = gpaSemesters.map(s => ({
        ...s, courses: computeAllCourses(s.courses),
    }));

    const cumulativeData = calculateCumulativeData(
        semestersComputed, 120,
        Math.max(...semestersComputed.map(s => s.year_of_study), 1)
    );

    const currentGPA = cumulativeData.gpa ?? 0;
    const currentCredits = cumulativeData.credits_accumulated;
    const totalRequired = cumulativeData.total_credits_required;
    const remainingCredits = userRemainingCredits ?? (totalRequired - currentCredits);

    if (remainingCredits <= 0) {
        return {
            current_gpa: currentGPA,
            current_credits: currentCredits,
            message: 'Sinh viên đã hoàn thành đủ tín chỉ yêu cầu.',
            target_gpa,
            achievable: currentGPA >= target_gpa,
        };
    }

    // Required GPA = (target * totalCreditsAfter - current * currentCredits) / remainingCredits
    const totalCreditsAfter = currentCredits + remainingCredits;
    const requiredGPA = (target_gpa * totalCreditsAfter - currentGPA * currentCredits) / remainingCredits;

    return {
        current_gpa: Number(currentGPA.toFixed(2)),
        current_credits: currentCredits,
        remaining_credits: remainingCredits,
        target_gpa,
        required_gpa_for_remaining: Number(requiredGPA.toFixed(2)),
        achievable: requiredGPA <= 4.0 && requiredGPA >= 0,
        standing_current: cumulativeData.academic_standing,
        message: requiredGPA <= 4.0 && requiredGPA >= 0
            ? `Cần đạt GPA trung bình ${requiredGPA.toFixed(2)} trong ${remainingCredits} TC còn lại để đạt GPA tích lũy ${target_gpa}.`
            : `Không thể đạt GPA tích lũy ${target_gpa} với ${remainingCredits} TC còn lại (cần GPA ${requiredGPA.toFixed(2)} — vượt thang 4.0).`,
    };
}

function executeSimulateGPA(args: any, appState: AppState): any {
    const { scenarios } = args;
    const { gpaSemesters } = appState;

    if (!gpaSemesters || gpaSemesters.length === 0) {
        return { error: 'Chưa có dữ liệu GPA. Sinh viên cần nhập điểm trước.' };
    }

    const semestersComputed = gpaSemesters.map(s => ({
        ...s, courses: computeAllCourses(s.courses),
    }));

    const cumulativeData = calculateCumulativeData(
        semestersComputed, 120,
        Math.max(...semestersComputed.map(s => s.year_of_study), 1)
    );

    const currentGPA = cumulativeData.gpa ?? 0;
    const currentCredits = cumulativeData.credits_accumulated;

    const results = (scenarios || []).map((sc: any) => {
        const { semester_gpa, credits, label } = sc;
        const newTotalCredits = currentCredits + credits;
        const newGPA = (currentGPA * currentCredits + semester_gpa * credits) / newTotalCredits;
        const newStanding = getAcademicStanding(newGPA);
        const newHonor = predictGraduationHonor(newGPA);

        return {
            label: label || `GPA ${semester_gpa} × ${credits}TC`,
            semester_gpa,
            credits,
            projected_cumulative_gpa: Number(newGPA.toFixed(2)),
            gpa_change: Number((newGPA - currentGPA).toFixed(3)),
            new_standing: newStanding,
            graduation_honor: newHonor,
            total_credits_after: newTotalCredits,
        };
    });

    return {
        current_gpa: Number(currentGPA.toFixed(2)),
        current_credits: currentCredits,
        current_standing: cumulativeData.academic_standing,
        scenarios: results,
    };
}
