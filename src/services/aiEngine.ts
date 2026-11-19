// File: src/services/aiEngine.ts
// SmartLife AI Engine v2 — Orchestrator with Function Calling
// Handles: query_database, add_timetable, add_todo, add_transaction, render_chart, GPA tools, Maps, Calendar

import { supabase } from './supabase';
import {
    callGeminiRaw, streamGeminiRaw, enqueue, buildFullContext, buildFullContextAsync,
    buildProfileContext, buildFinanceContext, buildGoalsContext,
    buildScheduleContext, buildGPAContext, buildHabitContext,
    buildCountdownContext, buildJournalContext,
    proxyHeaders,
    estimateGeminiCost,
    type ChatMessage, type MessagePart, type ToolDeclaration, type AITier, type StreamMeta
} from './geminiService';
import { createResponseAccumulator } from './ai/streamParser';
import { describeToolCall, describeToolResult } from './ai/toolLabels';
import { toolsFor } from './ai/toolDeclarations';
import { buildSystemPrompt } from './ai/promptBlocks';
import { getExpert, type ExpertId } from './ai/experts';
import { normalizeAskUser, maxClarifyRounds, countWrites, BULK_WRITE_LIMIT, type ClarifyRequest } from './ai/clarify';
import { fetchWebSearch, mergeSearchSources, MAX_WEB_SEARCHES, WEB_SEARCH_LIMIT_ERROR, type WebSource } from './ai/webSearch';
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
    type: 'timetable' | 'todo' | 'transaction' | 'financial_impact';
    success: boolean;
    message: string;
    data?: any;
}

// Một bước AI làm trong lúc trả lời (gọi công cụ) — hiện trong ThinkingPanel
export interface AIStep {
    id: string;
    tool: string;
    label: string;
    status: 'running' | 'done' | 'error';
    detail?: string;
    startedAt: number;
    endedAt?: number;
}

// Thông tin về một lượt trả lời, lưu vào ai_messages.meta
export interface AIRunMeta {
    model?: string;
    tier?: string;
    weight?: number;
    thoughts?: string;
    steps?: AIStep[];
    durationMs?: number;
    stopped?: boolean;
    error?: string;
    /** Chuyên gia đang chọn ở lượt này */
    expert?: ExpertId;
    /** true nếu tầng do chế độ Auto chọn */
    auto?: boolean;
    /** Lĩnh vực router đoán được */
    domain?: ExpertId;
    /** AI dừng lại để hỏi người dùng (ask_user) */
    clarification?: ClarifyRequest;
    /** Nguồn web đã dùng (web_search), đánh số liên tục [1], [2]… */
    sources?: WebSource[];
}

// Sự kiện engine phát ra trong lúc trả lời để UI hiện ngay
export type AIStreamEvent =
    | { type: 'meta'; meta: StreamMeta }
    | { type: 'text'; delta: string }
    | { type: 'thought'; delta: string }
    | { type: 'step'; step: AIStep }
    | { type: 'chart'; chart: ChartData }
    | { type: 'action'; action: ActionResult }
    | { type: 'clarify'; request: ClarifyRequest }
    | { type: 'sources'; sources: WebSource[] };

export interface ChatOptions {
    tier?: AITier;
    onEvent?: (event: AIStreamEvent) => void;
    /** Chế độ chuyên gia (mặc định 'general') */
    expert?: ExpertId;
    /** Tầng do Auto chọn (chỉ để ghi vào meta) */
    auto?: boolean;
    /** Lĩnh vực router đoán — chế độ Chung dùng để nạp khối kiến thức phù hợp */
    domain?: ExpertId;
    /** Câu hỏi có dấu hiệu khủng hoảng → nạp giao thức an toàn */
    crisis?: boolean;
    /** Chữ câu hỏi hiện tại (để chọn khối prompt, làm bối cảnh tìm web) */
    userText?: string;
    /** Số vòng hỏi lại đã dùng liên tiếp cho câu hỏi này */
    clarifyRoundsUsed?: number;
    /** Người dùng vừa trả lời thẻ xác nhận ghi hàng loạt */
    confirmedBulk?: boolean;
    /** Bật công cụ web_search (mặc định bật) */
    webSearch?: boolean;
}

export interface AIResponse {
    text: string;
    charts: ChartData[];
    actions: ActionResult[];
    updatedHistory?: ChatMessage[];
    tokens_used?: number;
    meta?: AIRunMeta;
}

// Action handlers passed from App.tsx
export interface ActionHandlers {
    onAddTimetable?: (item: any) => Promise<void>;
    onAddTodo?: (content: string, priority: string, deadline?: string, status?: any, description?: string) => Promise<void>;
    onAddTransaction?: (tx: any) => Promise<void>;
    onImportGPAData?: (semesters: any[]) => Promise<void>;
    onUpdateTodo?: (item: any) => Promise<void>;
    onDeleteTodo?: (id: string) => Promise<void>;
    onAddCalendarEvent?: (event: any) => Promise<void>;
    onUpdateCalendarEvent?: (event: any) => Promise<void>;
    onDeleteCalendarEvent?: (id: string) => Promise<void>;
}

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
    wallets: 'created_at',
    debts: 'date_lent',
    debt_repayments: 'payment_date',
    my_storage: 'created_at',
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
        // Model hay đoán tên cột (vd. goals.category) → PostgREST trả 400; gợi ý cách xem cột thật để tự sửa
        const badColumn = error.code === '42703' || /column .* does not exist/i.test(error.message || '');
        return {
            error: error.message,
            count: 0,
            ...(badColumn ? { hint: `Bảng ${table} không có cột đó. Gọi lại với limit=1, không filters, để xem các cột có thật rồi lọc lại.` } : {}),
        };
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
    const { content, priority = 'medium', deadline, status, description } = args;
    try {
        if (handlers.onAddTodo) {
            await handlers.onAddTodo(content, priority, deadline, status, description);
        }
        return {
            type: 'todo',
            success: true,
            message: `✅ Đã thêm việc: "${content}" [${priority}]${status ? ` [Cột: ${status}]` : ''}${deadline ? ` (Hạn: ${deadline})` : ''}`,
            data: args
        };
    } catch (error: any) {
        return { type: 'todo', success: false, message: `❌ Lỗi thêm việc: ${error.message}` };
    }
}

async function executeUpdateTodo(
    args: any,
    handlers: ActionHandlers
): Promise<ActionResult> {
    const { id, content, priority, deadline, status, description } = args;
    try {
        if (handlers.onUpdateTodo) {
            const updateFields: any = { id };
            if (content !== undefined) updateFields.content = content;
            if (priority !== undefined) updateFields.priority = priority;
            if (deadline !== undefined) updateFields.deadline = deadline;
            if (status !== undefined) updateFields.status = status;
            if (description !== undefined) updateFields.description = description;

            await handlers.onUpdateTodo(updateFields);
            return {
                type: 'todo',
                success: true,
                message: `✅ Đã cập nhật công việc ID: ${id}`,
                data: args
            };
        } else {
            throw new Error('Update handler is not registered');
        }
    } catch (error: any) {
        return { type: 'todo', success: false, message: `❌ Lỗi cập nhật công việc: ${error.message}` };
    }
}

async function executeDeleteTodo(
    args: any,
    handlers: ActionHandlers
): Promise<ActionResult> {
    const { id } = args;
    try {
        if (handlers.onDeleteTodo) {
            await handlers.onDeleteTodo(id);
            return {
                type: 'todo',
                success: true,
                message: `✅ Đã xóa công việc ID: ${id}`,
                data: args
            };
        } else {
            throw new Error('Delete handler is not registered');
        }
    } catch (error: any) {
        return { type: 'todo', success: false, message: `❌ Lỗi xóa công việc: ${error.message}` };
    }
}

async function executeGetBookmarks(appState: AppState): Promise<any> {
    const userId = appState.profile?.id;
    if (!userId) return { error: 'User is not logged in.' };
    const { data, error } = await supabase
        .from('my_storage')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'link')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) return { error: error.message };
    return { bookmarks: data || [] };
}

async function executeAddBookmark(args: any, appState: AppState): Promise<ActionResult> {
    const { title, url, group } = args;
    const userId = appState.profile?.id;
    if (!userId) {
        return { type: 'my_storage' as any, success: false, message: '❌ Lỗi thêm liên kết: Người dùng chưa đăng nhập.' };
    }

    let formattedUrl = url.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = `https://${formattedUrl}`;
    }

    try {
        const { data, error } = await supabase.from('my_storage').insert([
            {
                user_id: userId,
                type: 'link',
                title: title.trim(),
                content: formattedUrl,
                is_pinned: false,
                metadata: { group: group || null },
            },
        ]).select().single();

        if (error) throw error;

        return {
            type: 'my_storage' as any,
            success: true,
            message: `✅ Đã thêm liên kết: "${title}" vào nhóm [${group || 'Mặc định'}]`,
            data: data
        };
    } catch (error: any) {
        return { type: 'my_storage' as any, success: false, message: `❌ Lỗi thêm liên kết: ${error.message}` };
    }
}

async function executeUpdateBookmark(args: any, appState: AppState): Promise<ActionResult> {
    const { id, title, url, group } = args;
    const userId = appState.profile?.id;
    if (!userId) {
        return { type: 'my_storage' as any, success: false, message: '❌ Lỗi cập nhật liên kết: Người dùng chưa đăng nhập.' };
    }

    try {
        const updateFields: any = {};
        if (title !== undefined) updateFields.title = title.trim();
        if (url !== undefined) {
            let formattedUrl = url.trim();
            if (!/^https?:\/\//i.test(formattedUrl)) {
                formattedUrl = `https://${formattedUrl}`;
            }
            updateFields.content = formattedUrl;
        }
        if (group !== undefined) {
            updateFields.metadata = { group: group || null };
        }

        const { data, error } = await supabase
            .from('my_storage')
            .update(updateFields)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return {
            type: 'my_storage' as any,
            success: true,
            message: `✅ Đã cập nhật liên kết ID: ${id}`,
            data: data
        };
    } catch (error: any) {
        return { type: 'my_storage' as any, success: false, message: `❌ Lỗi cập nhật liên kết: ${error.message}` };
    }
}

async function executeDeleteBookmark(args: any, appState: AppState): Promise<ActionResult> {
    const { id } = args;
    const userId = appState.profile?.id;
    if (!userId) {
        return { type: 'my_storage' as any, success: false, message: '❌ Lỗi xóa liên kết: Người dùng chưa đăng nhập.' };
    }

    try {
        const { error } = await supabase
            .from('my_storage')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return {
            type: 'my_storage' as any,
            success: true,
            message: `✅ Đã xóa liên kết ID: ${id}`,
            data: args
        };
    } catch (error: any) {
        return { type: 'my_storage' as any, success: false, message: `❌ Lỗi xóa liên kết: ${error.message}` };
    }
}

async function executeAddCalendarEvent(
    args: any,
    appState: AppState,
    handlers: ActionHandlers
): Promise<ActionResult> {
    const userId = appState.profile?.id;
    if (!userId) {
        return { type: 'calendar_event' as any, success: false, message: '❌ Lỗi thêm lịch hẹn: Người dùng chưa đăng nhập.' };
    }
    const { title, date, time, location, description, email_notify = true, email_notify_before_minutes = 30 } = args;
    try {
        let formattedTime = time || null;
        if (formattedTime) {
            const parts = formattedTime.split(':');
            if (parts.length === 2) {
                formattedTime = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
            } else if (parts.length === 3) {
                formattedTime = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`;
            }
        }

        const newEvent = {
            user_id: userId,
            title,
            date,
            time: formattedTime,
            location: location || null,
            description: description || null,
            type: 'PERSONAL',
            email_notify,
            email_notify_before_minutes
        };

        const { data, error } = await supabase.from('calendar_events').insert([newEvent]).select().single();
        if (error) throw error;

        if (handlers.onAddCalendarEvent) {
            await handlers.onAddCalendarEvent(data);
        }

        return {
            type: 'calendar_event' as any,
            success: true,
            message: `✅ Đã thêm lịch hẹn: "${title}" vào ngày ${date}${time ? ` lúc ${time}` : ''}${email_notify ? ` (Báo trước ${email_notify_before_minutes} phút qua Gmail)` : ''}`,
            data
        };
    } catch (error: any) {
        return { type: 'calendar_event' as any, success: false, message: `❌ Lỗi thêm lịch hẹn: ${error.message}` };
    }
}

async function executeUpdateCalendarEvent(
    args: any,
    appState: AppState,
    handlers: ActionHandlers
): Promise<ActionResult> {
    const userId = appState.profile?.id;
    if (!userId) {
        return { type: 'calendar_event' as any, success: false, message: '❌ Lỗi cập nhật lịch hẹn: Người dùng chưa đăng nhập.' };
    }
    const { id, title, date, time, location, description, email_notify, email_notify_before_minutes } = args;
    try {
        const updateFields: any = {};
        if (title !== undefined) updateFields.title = title;
        if (date !== undefined) updateFields.date = date;
        if (time !== undefined) {
            let formattedTime = time || null;
            if (formattedTime) {
                const parts = formattedTime.split(':');
                if (parts.length === 2) {
                    formattedTime = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
                } else if (parts.length === 3) {
                    formattedTime = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`;
                }
            }
            updateFields.time = formattedTime;
        }
        if (location !== undefined) updateFields.location = location || null;
        if (description !== undefined) updateFields.description = description || null;
        if (email_notify !== undefined) updateFields.email_notify = email_notify;
        if (email_notify_before_minutes !== undefined) updateFields.email_notify_before_minutes = email_notify_before_minutes;

        const { data, error } = await supabase
            .from('calendar_events')
            .update(updateFields)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        if (handlers.onUpdateCalendarEvent) {
            await handlers.onUpdateCalendarEvent(data);
        }

        return {
            type: 'calendar_event' as any,
            success: true,
            message: `✅ Đã cập nhật lịch hẹn: "${data.title}" ngày ${data.date}`,
            data
        };
    } catch (error: any) {
        return { type: 'calendar_event' as any, success: false, message: `❌ Lỗi cập nhật lịch hẹn: ${error.message}` };
    }
}

async function executeDeleteCalendarEvent(
    args: any,
    appState: AppState,
    handlers: ActionHandlers
): Promise<ActionResult> {
    const userId = appState.profile?.id;
    if (!userId) {
        return { type: 'calendar_event' as any, success: false, message: '❌ Lỗi xóa lịch hẹn: Người dùng chưa đăng nhập.' };
    }
    const { id } = args;
    try {
        const { error } = await supabase
            .from('calendar_events')
            .delete()
            .eq('id', id);

        if (error) throw error;

        if (handlers.onDeleteCalendarEvent) {
            await handlers.onDeleteCalendarEvent(id);
        }

        return {
            type: 'calendar_event' as any,
            success: true,
            message: `✅ Đã xóa lịch hẹn ID: ${id}`,
            data: args
        };
    } catch (error: any) {
        return { type: 'calendar_event' as any, success: false, message: `❌ Lỗi xóa lịch hẹn: ${error.message}` };
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

// ────────────────────────────────────────
// Maps & Location Tool Executors
// ────────────────────────────────────────

async function executeSearchNearbyPlaces(args: any): Promise<any> {
    const { query, is_emergency = false, additional_context = '' } = args;

    try {
        // Dynamic import to avoid bundling issues
        const { getCurrentLocation, buildGoogleMapsSearchUrl, buildGoogleMapsDirectionsUrl } = await import('./geolocationService');

        let location;
        try {
            location = await getCurrentLocation({ timeout: is_emergency ? 5000 : 10000 });
        } catch (locError: any) {
            return {
                success: false,
                has_location: false,
                error: locError.message,
                suggestion: 'Không thể xác định vị trí GPS. Hãy hỏi người dùng đang ở khu vực nào để gợi ý chính xác hơn.',
                maps_search_url: `https://www.google.com/maps/search/${encodeURIComponent(query)}`,
            };
        }

        const { lat, lng, accuracy } = location;

        // Build useful Maps URLs
        const searchUrl = buildGoogleMapsSearchUrl(query, lat, lng);

        return {
            success: true,
            has_location: true,
            user_location: {
                lat: Math.round(lat * 10000) / 10000,
                lng: Math.round(lng * 10000) / 10000,
                accuracy_meters: Math.round(accuracy),
            },
            query,
            is_emergency,
            additional_context,
            maps_search_url: searchUrl,
            maps_directions_template: `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination={PLACE_ADDRESS}&travelmode=driving`,
            instructions_for_ai: `Bạn có GPS của người dùng: ${lat}, ${lng} (độ chính xác ±${Math.round(accuracy)}m).
Hãy dùng kiến thức của bạn để gợi ý 2-4 địa điểm "${query}" phổ biến gần khu vực này.
Với mỗi địa điểm, hãy trả lời theo format:
📍 **Tên địa điểm**
📍 Địa chỉ ước tính
🕐 Giờ mở cửa (nếu biết)
📞 Hotline (nếu biết, đặc biệt cho cứu hộ/sửa xe)

Cuối cùng, LUÔN kèm link tìm kiếm Google Maps: ${searchUrl}
${is_emergency ? '⚠️ ĐÂY LÀ TÌNH HUỐNG KHẨN CẤP — ưu tiên kết quả GẦN NHẤT và số điện thoại liên hệ.' : ''}
${additional_context ? `📝 Yêu cầu thêm từ người dùng: ${additional_context}` : ''}`,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message,
            maps_search_url: `https://www.google.com/maps/search/${encodeURIComponent(query)}`,
        };
    }
}

async function executeGetGoogleCalendarEvents(args: any): Promise<any> {
    const { days_ahead = 7, days_back = 0 } = args;

    try {
        const { isGoogleCalendarConnected, listCalendarEvents } = await import('./googleCalendarService');

        if (!isGoogleCalendarConnected()) {
            return {
                success: false,
                error: 'Google Calendar chưa được kết nối. Người dùng cần đăng nhập lại bằng Google để cấp quyền Calendar.',
            };
        }

        const now = new Date();
        const timeMin = new Date(now);
        timeMin.setDate(timeMin.getDate() - days_back);
        timeMin.setHours(0, 0, 0, 0);
        const timeMax = new Date(now);
        timeMax.setDate(timeMax.getDate() + days_ahead);
        timeMax.setHours(23, 59, 59, 999);

        const events = await listCalendarEvents(
            'primary',
            timeMin.toISOString(),
            timeMax.toISOString(),
            50
        );

        const simplifiedEvents = events.map((e: any) => ({
            title: e.summary || '(Không có tiêu đề)',
            start: e.start?.dateTime || e.start?.date || '',
            end: e.end?.dateTime || e.end?.date || '',
            location: e.location || '',
            description: e.description ? e.description.substring(0, 200) : '',
            is_all_day: !e.start?.dateTime,
            status: e.status || 'confirmed',
        }));

        return {
            success: true,
            events: simplifiedEvents,
            count: simplifiedEvents.length,
            range: `${timeMin.toISOString().slice(0, 10)} → ${timeMax.toISOString().slice(0, 10)}`,
        };
    } catch (error: any) {
        return {
            success: false,
            error: `Lỗi khi lấy Google Calendar: ${error.message}`,
        };
    }
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
// Chỉ giữ chữ người dùng + câu trả lời cuối của AI (bỏ suy nghĩ, chữ ký, lượt gọi hàm) cho lịch sử nhiều lượt
function cleanChatHistory(contents: ChatMessage[]): ChatMessage[] {
    return contents.map(m => {
        if (m.role === 'user') {
            return m;
        }
        if (m.role === 'model') {
            const textPartsOnly = m.parts
                .filter((p: any) => typeof p.text === 'string' && p.text && !p.thought)
                .map((p: any) => ({ text: p.text }));
            if (textPartsOnly.length > 0) {
                return { role: 'model' as const, parts: textPartsOnly };
            }
        }
        return null;
    }).filter(Boolean) as ChatMessage[];
}

const MAX_TOOL_CALLS = 10; // Safety limit to prevent infinite loops
const TOOL_ROUND_GAP_MS = 500; // nghỉ ngắn giữa các vòng gọi công cụ để tránh nghẽn burst (503)

function abortError() {
    return new DOMException('Request aborted', 'AbortError');
}

function waitOrAbort(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(abortError());
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(abortError());
        }, { once: true });
    });
}

function logChatTokens(usage: any, model: string) {
    if (!usage?.totalTokenCount) return;
    supabase.auth.getUser().then(({ data: authData }) => {
        const uid = authData?.user?.id;
        if (!uid) { console.warn('[SmartLife] Token log skipped: no user'); return; }
        supabase.from('api_logs').insert([{
            user_id: uid,
            action: 'chat',
            tokens_used: usage.totalTokenCount,
            prompt_tokens: usage.promptTokenCount || 0,
            candidates_tokens: usage.candidatesTokenCount || 0,
            thoughts_tokens: usage.thoughtsTokenCount || usage.thinkingTokenCount || 0,
            estimated_cost_vnd: estimateGeminiCost(usage.promptTokenCount || 0, usage.candidatesTokenCount || 0, model),
            model
        }]).then(({ error }) => {
            if (error) console.error('[SmartLife] ❌ Token log failed:', error.message);
        });
    });
}

export async function chatWithAI(
    history: ChatMessage[],
    appState: AppState,
    handlers: ActionHandlers = {},
    memoryContext: string = '',
    attachments?: AIAttachment[],
    signal?: AbortSignal,
    options: ChatOptions = {}
): Promise<AIResponse> {
    const { tier, onEvent } = options;
    const expert = getExpert(options.expert);
    const clarifyRoundsUsed = options.clarifyRoundsUsed || 0;
    const clarifyAllowed = clarifyRoundsUsed < maxClarifyRounds(expert.id, tier);
    const emit = (event: AIStreamEvent) => {
        try { onEvent?.(event); } catch (e) { console.error('[SmartLife AI] onEvent error:', e); }
    };

    const userName = appState.profile?.full_name || 'Người dùng';
    const now = new Date();
    const minimalContext = `\n👤 NGƯỜI DÙNG HIỆN TẠI: ${userName}\n📅 THỜI GIAN HỆ THỐNG: ${now.toLocaleString('vi-VN')} (Thứ ${now.getDay() === 0 ? 'Chủ Nhật' : now.getDay() + 1}, ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()})`;

    const profileContext = buildProfileContext(appState);
    // Chỉ nạp các khối prompt cần cho lượt này (chuyên gia, lĩnh vực, công cụ, số lượt hỏi lại còn lại)
    const basePrompt = buildSystemPrompt({
        expert: expert.id,
        tier,
        domain: options.domain,
        userText: options.userText,
        crisis: options.crisis,
        clarifyRoundsUsed,
        confirmedBulk: options.confirmedBulk,
        webSearch: options.webSearch,
        hasPersonality: !!(appState.profile?.personality_mbti || appState.profile?.personality_disc),
    }).text;
    const tools = toolsFor(expert, { webSearch: options.webSearch });
    const fullSystemPrompt = basePrompt
        + minimalContext
        + (profileContext ? '\n\n--- HỒ SƠ CÁ NHÂN NGƯỜI DÙNG ---\n' + profileContext : '')
        + (memoryContext ? '\n\n--- BỘ NHỚ DÀI HẠN ---\n' + memoryContext : '');

    const charts: ChartData[] = [];
    const actions: ActionResult[] = [];
    const steps: AIStep[] = [];
    let thoughts = '';
    let answer = '';
    let runModel: StreamMeta | null = null;
    const startedAt = Date.now();
    let clarification: ClarifyRequest | undefined;
    let sources: WebSource[] = [];
    let webSearches = 0;
    let writesDone = 0; // số mục đã ghi trong lượt (chặn ghi hàng loạt chưa xác nhận)

    // Build request with tools
    const buildRequest = (contents: any[]) => ({
        systemInstruction: { parts: [{ text: fullSystemPrompt }] },
        contents,
        tools: [{ functionDeclarations: tools }],
        toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
        generationConfig: { temperature: 0.7, topP: 0.95, topK: 40, maxOutputTokens: 4096 },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
        ...(tier ? { tier } : {}),
        purpose: 'chat',
    });

    return enqueue(async () => {
        // Gemini chỉ nhận vai user/model (họ 3.x từ chối vai 'function') — kết quả công cụ gửi bằng vai user
        let contents: ChatMessage[] = history.map(m => ({
            role: m.role === 'function' ? 'user' : m.role,
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
        let round = 0;
        let totalTokensConsumed = 0;

        const finish = (text: string): AIResponse => ({
            text,
            charts,
            actions,
            updatedHistory: cleanChatHistory(contents),
            tokens_used: totalTokensConsumed,
            meta: {
                model: runModel?.model,
                tier: runModel?.tier,
                weight: runModel?.weight,
                thoughts: thoughts || undefined,
                steps: steps.length ? steps : undefined,
                durationMs: Date.now() - startedAt,
                expert: expert.id,
                auto: options.auto || undefined,
                domain: options.domain,
                clarification,
                sources: sources.length ? sources : undefined,
            },
        });

        while (toolCallCount < MAX_TOOL_CALLS) {
            if (signal?.aborted) throw abortError();
            if (round > 0) await waitOrAbort(TOOL_ROUND_GAP_MS, signal);

            const body = {
                ...buildRequest(contents),
                isToolCall: round > 0
            };

            // Có onEvent → stream để hiện chữ/suy nghĩ ngay; không thì gọi thường như trước
            let data: any;
            if (onEvent) {
                const acc = createResponseAccumulator();
                let roundHasText = false;
                let roundHasThought = false;
                await streamGeminiRaw(body, {
                    signal,
                    onMeta: (meta) => {
                        if (!runModel) {
                            runModel = meta;
                            emit({ type: 'meta', meta });
                        }
                    },
                    onChunk: (chunk) => {
                        const delta = acc.add(chunk);
                        if (delta.thought) {
                            const sep = !roundHasThought && thoughts ? '\n\n' : '';
                            roundHasThought = true;
                            thoughts += sep + delta.thought;
                            emit({ type: 'thought', delta: sep + delta.thought });
                        }
                        if (delta.text) {
                            const sep = !roundHasText && answer ? '\n\n' : '';
                            roundHasText = true;
                            answer += sep + delta.text;
                            emit({ type: 'text', delta: sep + delta.text });
                        }
                    },
                });
                data = acc.result();
            } else {
                data = await callGeminiRaw(body, 0, signal);
                const parts = data?.candidates?.[0]?.content?.parts || [];
                const roundText = parts.filter((p: any) => typeof p.text === 'string' && !p.thought).map((p: any) => p.text).join('');
                const roundThought = parts.filter((p: any) => p.thought && p.text).map((p: any) => p.text).join('');
                if (roundThought) thoughts += (thoughts ? '\n\n' : '') + roundThought;
                if (roundText) answer += (answer ? '\n\n' : '') + roundText;
            }
            round++;

            const usage = data?.usageMetadata;
            if (usage?.totalTokenCount) {
                totalTokensConsumed += usage.totalTokenCount;
                logChatTokens(usage, runModel?.model || 'gemini-2.5-flash');
            }

            const candidate = data?.candidates?.[0];

            // Kiểm tra trường hợp Prompt bị hệ thống Google chặn ngay lập tức (Safety / Policy Block)
            if (!candidate) {
                let blockMsg = answer || 'Không nhận được phản hồi từ AI.';
                if (data?.promptFeedback?.blockReason) {
                    blockMsg = `⚠️ Yêu cầu bị hệ thống kiểm duyệt tự động chặn (Lý do: ${data.promptFeedback.blockReason}). Vui lòng điều chỉnh hoặc diễn đạt lại câu hỏi phù hợp hơn.`;
                }
                return finish(blockMsg);
            }

            // Kiểm tra finishReason của candidate
            if (candidate.finishReason === 'SAFETY') {
                return finish('⚠️ Phản hồi bị chặn bởi bộ lọc an toàn tự động của Google (Lý do: SAFETY). Điều này có thể xảy ra nếu thông tin thói quen, nhật ký hoặc dữ liệu liên quan của bạn có từ ngữ quá nhạy cảm. Vui lòng kiểm tra lại dữ liệu hoặc diễn đạt câu hỏi theo cách khác.');
            }
            if (candidate.finishReason === 'RECITATION') {
                return finish('⚠️ Phản hồi bị chặn do phát hiện nội dung sao chép tài liệu có bản quyền (Lý do: RECITATION). Vui lòng đặt câu hỏi khác hoặc diễn đạt theo cách khác.');
            }

            if (!candidate.content?.parts?.length) {
                return finish(answer || 'Không nhận được phản hồi từ AI.');
            }

            const responseParts: MessagePart[] = candidate.content.parts;

            // Check if any part is a function call
            const functionCalls = responseParts.filter(
                (p: any) => p.functionCall
            ) as Array<{ functionCall: { name: string; args: Record<string, any> } }>;

            if (functionCalls.length === 0) {
                // No function calls — trả lời xong
                contents.push({ role: 'model', parts: responseParts });
                return finish(answer || 'Không có phản hồi.');
            }

            // Process each function call
            const functionResponses: any[] = [];

            // Giữ nguyên các phần của model (kể cả thoughtSignature) — họ Gemini 3 bắt buộc khi gửi kết quả hàm
            contents.push({ role: 'model', parts: responseParts });

            // ask_user hợp lệ → dừng ngay, không chạy công cụ khác trong vòng này; giao diện hiện thẻ hỏi lại
            const askCall = functionCalls.find(fc => fc.functionCall.name === 'ask_user');
            let askError: string | null = null;
            if (askCall) {
                const parsed = normalizeAskUser(askCall.functionCall.args);
                if ('error' in parsed) {
                    askError = parsed.error;
                } else if (parsed.request.purpose === 'clarify' && !clarifyAllowed) {
                    askError = 'Đã hết lượt hỏi lại cho câu hỏi này. Hãy trả lời luôn và mở đầu bằng dòng "**Giả định:** …".';
                } else {
                    clarification = parsed.request;
                    const now = Date.now();
                    const step: AIStep = {
                        id: `${round}-${steps.length}`,
                        tool: 'ask_user',
                        label: describeToolCall('ask_user', askCall.functionCall.args),
                        status: 'done',
                        startedAt: now,
                        endedAt: now,
                    };
                    steps.push(step);
                    emit({ type: 'step', step: { ...step } });
                    emit({ type: 'clarify', request: clarification });
                    const intro = clarification.intro || (clarification.purpose === 'confirm' ? 'Bạn xác nhận giúp mình nhé:' : 'Mình cần hỏi thêm một chút:');
                    return finish(answer.trim() ? answer : intro);
                }
            }

            // Ghi hàng loạt (> BULK_WRITE_LIMIT mục) phải được xác nhận bằng ask_user purpose "confirm" trước
            const writesThisRound = functionCalls.reduce((n, fc) => n + countWrites(fc.functionCall.name, fc.functionCall.args), 0);
            const blockWrites = !options.confirmedBulk && writesDone + writesThisRound > BULK_WRITE_LIMIT;

            for (const fc of functionCalls) {
                if (signal?.aborted) throw abortError();
                const { name, args = {} } = fc.functionCall;
                console.info(`[SmartLife AI] Tool call: ${name}`, args);
                let result: any;

                const step: AIStep = {
                    id: `${round}-${steps.length}`,
                    tool: name,
                    label: describeToolCall(name, args),
                    status: 'running',
                    startedAt: Date.now(),
                };
                steps.push(step);
                emit({ type: 'step', step: { ...step } });
                const chartsBefore = charts.length;
                const actionsBefore = actions.length;

                try {
                    if (name === 'ask_user') {
                        result = { error: askError || 'Không thể hỏi lại lúc này.' };
                    } else if (blockWrites && countWrites(name, args) > 0) {
                        result = {
                            success: false,
                            error: `Chưa ghi: lượt này định ghi ${writesDone + writesThisRound} mục (> ${BULK_WRITE_LIMIT}). Hãy gọi ask_user purpose "confirm" liệt kê các mục để người dùng xác nhận trước.`,
                        };
                    } else switch (name) {
                        case 'web_search': {
                            if (webSearches >= MAX_WEB_SEARCHES) {
                                result = WEB_SEARCH_LIMIT_ERROR;
                                break;
                            }
                            webSearches++;
                            const found = await fetchWebSearch(String(args.query || ''), {
                                headers: await proxyHeaders(),
                                signal,
                                context: options.userText,
                            });
                            if ('error' in found) {
                                result = found;
                                break;
                            }
                            const merged = mergeSearchSources(sources, found);
                            sources = merged.sources;
                            const used = new Set(found.sources.map(x => x.url));
                            result = {
                                summary: merged.summary,
                                sources: sources.filter(x => used.has(x.url)).map(x => ({ n: x.n, title: x.title, domain: x.domain })),
                                note: 'Trích dẫn bằng đúng số [n] ở trên.',
                            };
                            emit({ type: 'sources', sources: [...sources] });
                            break;
                        }
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
                        case 'update_todo': {
                            const actionResult = await executeUpdateTodo(args, handlers);
                            actions.push(actionResult);
                            result = { success: actionResult.success, message: actionResult.message };
                            break;
                        }
                        case 'delete_todo': {
                            const actionResult = await executeDeleteTodo(args, handlers);
                            actions.push(actionResult);
                            result = { success: actionResult.success, message: actionResult.message };
                            break;
                        }
                        case 'get_bookmarks': {
                            result = await executeGetBookmarks(appState);
                            break;
                        }
                        case 'add_bookmark': {
                            const actionResult = await executeAddBookmark(args, appState);
                            actions.push(actionResult);
                            result = { success: actionResult.success, message: actionResult.message };
                            break;
                        }
                        case 'update_bookmark': {
                            const actionResult = await executeUpdateBookmark(args, appState);
                            actions.push(actionResult);
                            result = { success: actionResult.success, message: actionResult.message };
                            break;
                        }
                        case 'delete_bookmark': {
                            const actionResult = await executeDeleteBookmark(args, appState);
                            actions.push(actionResult);
                            result = { success: actionResult.success, message: actionResult.message };
                            break;
                        }
                        case 'add_calendar_event': {
                            const actionResult = await executeAddCalendarEvent(args, appState, handlers);
                            actions.push(actionResult);
                            result = { success: actionResult.success, message: actionResult.message };
                            break;
                        }
                        case 'update_calendar_event': {
                            const actionResult = await executeUpdateCalendarEvent(args, appState, handlers);
                            actions.push(actionResult);
                            result = { success: actionResult.success, message: actionResult.message };
                            break;
                        }
                        case 'delete_calendar_event': {
                            const actionResult = await executeDeleteCalendarEvent(args, appState, handlers);
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
                        case 'import_gpa_data': {
                            if (handlers.onImportGPAData) {
                                try {
                                    await handlers.onImportGPAData(args.semesters);
                                    result = { success: true, message: `✅ Đã import thành công ${args.semesters.length} học kỳ vào GPA Tracker.` };
                                } catch (e: any) {
                                    result = { success: false, error: e.message };
                                }
                            } else {
                                result = { success: false, error: 'GPA Import handler is not registered.' };
                            }
                            break;
                        }
                        case 'simulate_financial_impact': {
                            try {
                                const simResult = await simulateFinancialImpact(args.description, args.amount, appState, 'vi');
                                result = { success: true, ...simResult };
                                actions.push({
                                    type: 'financial_impact' as any,
                                    success: true,
                                    message: `Đã mô phỏng tác động tài chính của kịch bản "${args.description}" với số tiền ${args.amount.toLocaleString('vi-VN')}đ.`,
                                    data: {
                                        description: args.description,
                                        amount: args.amount,
                                        simulation: simResult
                                    }
                                });
                            } catch (e: any) {
                                result = { success: false, error: e.message };
                            }
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
                        case 'search_nearby_places': {
                            result = await executeSearchNearbyPlaces(args);
                            break;
                        }
                        case 'get_google_calendar_events': {
                            result = await executeGetGoogleCalendarEvents(args);
                            break;
                        }
                        default:
                            result = { error: `Unknown tool: ${name}` };
                    }
                } catch (e: any) {
                    if (e?.name === 'AbortError') throw e;
                    console.error(`[SmartLife AI] Tool ${name} failed:`, e);
                    result = { success: false, error: e?.message || 'Công cụ gặp lỗi.' };
                }

                if (countWrites(name, args) > 0 && result?.success !== false && !result?.error) {
                    writesDone += countWrites(name, args);
                }
                const outcome = describeToolResult(name, result);
                step.status = outcome.ok ? 'done' : 'error';
                step.detail = outcome.detail;
                step.endedAt = Date.now();
                emit({ type: 'step', step: { ...step } });
                for (const chart of charts.slice(chartsBefore)) emit({ type: 'chart', chart });
                for (const action of actions.slice(actionsBefore)) emit({ type: 'action', action });

                functionResponses.push({
                    functionResponse: { name, response: { result } }
                });
                toolCallCount++;
            }

            // Kết quả công cụ trả về bằng vai 'user' (Gemini 3.x không nhận vai 'function')
            contents.push({ role: 'user', parts: functionResponses });
        }

        // If we hit the limit, return what we have
        const limitNote = '⚠️ AI đã thực hiện quá nhiều truy vấn. Vui lòng thử câu hỏi đơn giản hơn.';
        return finish(answer ? `${answer}\n\n${limitNote}` : limitNote);
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

export interface FinancialSimulationResult {
    impact_level: 'low' | 'medium' | 'high';
    impact_level_label: string;
    summary: string;
    current_balance_after: number;
    budget_impact_percent: number;
    wallet_impacts: Array<{
        wallet_name: string;
        balance_before: number;
        balance_after: number;
        percentage_decrease: number;
    }>;
    savings_delay_days: number;
    recommendations: Array<{
        title: string;
        description: string;
        action_type: 'adjust_budget' | 'transfer_wallet' | 'reduce_expense' | 'other';
    }>;
    historical_trends?: {
        monthly_trends: Array<{ month: string; income: number; expense: number; surplus: number }>;
        avg_income: number;
        avg_expense: number;
        avg_surplus: number;
        comparison_percentage: number;
    };
}

export async function simulateFinancialImpact(
    description: string,
    amount: number,
    appState: AppState,
    lang: string = 'vi'
): Promise<FinancialSimulationResult> {
    const walletsStr = appState.wallets?.map(w => `- ${w.name}: Số dư hiện tại ${w.balance.toLocaleString('vi-VN')}đ`).join('\n') || '- Không có ví';
    const budgetsStr = appState.budgets?.map(b => `- ${b.category}: Ngân sách ${b.amount.toLocaleString('vi-VN')}đ tháng ${b.month}`).join('\n') || '- Không có ngân sách';
    const goalsStr = appState.goals?.filter(g => g.type === 'FINANCIAL').map(g => `- ${g.title}: Mục tiêu ${g?.target_amount?.toLocaleString('vi-VN')}đ, hiện tại ${g?.current_amount?.toLocaleString('vi-VN')}đ, hạn chót ${g.deadline}`).join('\n') || '- Không có mục tiêu tài chính';

    // Calculate historical monthly trends (last 6 months)
    const txs = appState.transactions || [];
    const monthlySummary: Record<string, { income: number; expense: number }> = {};
    
    txs.forEach(t => {
        if (!t.date) return;
        const month = t.date.slice(0, 7); // "YYYY-MM"
        if (!monthlySummary[month]) {
            monthlySummary[month] = { income: 0, expense: 0 };
        }
        if (t.type === 'income') {
            monthlySummary[month].income += t.amount;
        } else if (t.type === 'expense') {
            monthlySummary[month].expense += t.amount;
        }
    });

    const sortedMonths = Object.keys(monthlySummary).sort();
    const last6Months = sortedMonths.slice(-6);
    const monthlyTrendsArray = last6Months.map(m => ({
        month: m,
        income: monthlySummary[m].income,
        expense: monthlySummary[m].expense,
        surplus: monthlySummary[m].income - monthlySummary[m].expense
    }));

    const last3Months = sortedMonths.slice(-3);
    let totalIncomeLast3Months = 0;
    let totalExpenseLast3Months = 0;
    last3Months.forEach(m => {
        totalIncomeLast3Months += monthlySummary[m].income;
        totalExpenseLast3Months += monthlySummary[m].expense;
    });
    const activeMonthsCount = last3Months.length || 1;
    const avgIncomeLast3Months = totalIncomeLast3Months / activeMonthsCount;
    const avgExpenseLast3Months = totalExpenseLast3Months / activeMonthsCount;
    const avgSavingsLast3Months = avgIncomeLast3Months - avgExpenseLast3Months;

    const trendsStr = monthlyTrendsArray.map(t => 
        `- Tháng ${t.month}: Thu nhập ${t.income.toLocaleString('vi-VN')}đ | Chi tiêu ${t.expense.toLocaleString('vi-VN')}đ | Thặng dư ${t.surplus.toLocaleString('vi-VN')}đ`
    ).join('\n');

    const isEn = lang === 'en';
    
    const prompt = `Bạn là chuyên gia cố vấn tài chính cá nhân thông minh.
Hãy đánh giá tác động tài chính của kịch bản phát sinh bất ngờ:
- Nội dung phát sinh: "${description}"
- Số tiền phát sinh: ${amount.toLocaleString('vi-VN')}đ (chi phí chi tiêu)

Tình hình tài chính hiện tại của người dùng:
- Số dư khả dụng tổng: ${(appState.currentBalance || 0).toLocaleString('vi-VN')}đ
- Các ví tiền:
${walletsStr}
- Ngân sách tháng này:
${budgetsStr}
- Mục tiêu tài chính:
${goalsStr}

LỊCH SỬ THU CHI VÀ XU HƯỚNG CÁC THÁNG TRƯỚC:
- Xu hướng thu chi theo tháng:
${trendsStr || '- Chưa có dữ liệu thu chi tháng trước'}
- Trung bình 3 tháng gần nhất:
  + Thu nhập trung bình: ${avgIncomeLast3Months.toLocaleString('vi-VN')}đ/tháng
  + Chi tiêu trung bình: ${avgExpenseLast3Months.toLocaleString('vi-VN')}đ/tháng
  + Thặng dư tiết kiệm trung bình: ${avgSavingsLast3Months.toLocaleString('vi-VN')}đ/tháng

Yêu cầu phân tích:
1. Đánh giá xem khoản phát sinh ${amount.toLocaleString('vi-VN')}đ này chiếm bao nhiêu phần trăm so với Thặng dư tiết kiệm trung bình hàng tháng của người dùng (${avgSavingsLast3Months.toLocaleString('vi-VN')}đ).
2. Dựa vào xu hướng chi tiêu các tháng trước để dự báo xem việc gánh thêm khoản chi này có đẩy người dùng vào tình trạng thâm hụt ngân sách hay không.
3. Đưa ra các khuyến nghị, đề xuất giải pháp hành động cụ thể để bù đắp khoản chi tiêu này (như cắt giảm ngân sách danh mục nào, rút tiền từ ví nào, hoãn mục tiêu nào).

Yêu cầu trả về kết quả dưới dạng JSON có cấu trúc chính xác như sau (KHÔNG thêm bất kỳ markdown hay văn bản giải thích nào ngoài JSON):
{
  "impact_level": "low" | "medium" | "high",
  "impact_level_label": "Mức độ ảnh hưởng ngắn gọn",
  "summary": "Tóm tắt đánh giá chi tiết tác động của việc này đối với các ví, ngân sách chi tiêu và các mục tiêu tiết kiệm bằng tiếng ${isEn ? 'Anh' : 'Việt'}",
  "current_balance_after": "Tổng số dư sau khi trừ đi chi phí này (số)",
  "budget_impact_percent": "Phần trăm ngân sách tháng này bị tiêu hao bởi khoản này (số, ví dụ: 12.5)",
  "wallet_impacts": [
    {
      "wallet_name": "Tên ví bị ảnh hưởng",
      "balance_before": "Số dư trước (số)",
      "balance_after": "Số dư sau (số)",
      "percentage_decrease": "Phần trăm giảm (số)"
    }
  ],
  "savings_delay_days": "Số ngày trì hoãn mục tiêu tiết kiệm dự kiến (số ngày, ví dụ: 15)",
  "recommendations": [
    {
      "title": "Tên đề xuất bằng tiếng ${isEn ? 'Anh' : 'Việt'}",
      "description": "Mô tả hành động đề xuất chi tiết bằng tiếng ${isEn ? 'Anh' : 'Việt'}",
      "action_type": "adjust_budget" | "transfer_wallet" | "reduce_expense" | "other"
    }
  ]
}
`;

    const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { 
            temperature: 0.2, 
            topP: 0.95,
            responseMimeType: "application/json"
        }
    };

    const { callGeminiRaw } = await import('./geminiService');
    const data = await callGeminiRaw(body);
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    try {
        const parsed = JSON.parse(text.trim()) as FinancialSimulationResult;
        return {
            ...parsed,
            historical_trends: {
                monthly_trends: monthlyTrendsArray,
                avg_income: avgIncomeLast3Months,
                avg_expense: avgExpenseLast3Months,
                avg_surplus: avgSavingsLast3Months,
                comparison_percentage: avgSavingsLast3Months > 0 ? Number(((amount / avgSavingsLast3Months) * 100).toFixed(1)) : 100
            }
        };
    } catch (e) {
        console.error("Error parsing AI Financial Simulation response:", text, e);
        return {
            impact_level: 'medium',
            impact_level_label: isEn ? 'Medium' : 'Trung bình',
            summary: isEn 
                ? `An expense of ${amount.toLocaleString('en-US')} USD has arisen. This will decrease your total balance.`
                : `Có khoản chi tiêu phát sinh ${amount.toLocaleString('vi-VN')}đ cho "${description}". Khoản này sẽ làm giảm tổng số dư khả dụng của bạn.`,
            current_balance_after: (appState.currentBalance || 0) - amount,
            budget_impact_percent: 0,
            wallet_impacts: [],
            savings_delay_days: 0,
            recommendations: [
                {
                    title: isEn ? 'Review Budgets' : 'Xem lại ngân sách',
                    description: isEn ? 'Track your expenses to keep balanced.' : 'Theo dõi chi tiêu để giữ cân bằng tài chính.',
                    action_type: 'other'
                }
            ],
            historical_trends: {
                monthly_trends: monthlyTrendsArray,
                avg_income: avgIncomeLast3Months,
                avg_expense: avgExpenseLast3Months,
                avg_surplus: avgSavingsLast3Months,
                comparison_percentage: avgSavingsLast3Months > 0 ? Number(((amount / avgSavingsLast3Months) * 100).toFixed(1)) : 100
            }
        };
    }
}

