// File: scripts/ai-eval/mockTools.ts
// Dữ liệu giả cho các công cụ khi chạy eval (không chạm Supabase / tài khoản thật).
// Người dùng mẫu: sinh viên năm 3 ĐHQGHN, thu nhập ~8 triệu/tháng.

const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const plus = (days: number) => { const d = new Date(today); d.setDate(d.getDate() + days); return iso(d); };

export const MOCK_PROFILE_CONTEXT = [
    'Họ tên: Minh Anh',
    'Nghề nghiệp: Sinh viên năm 3, Trường Đại học Công nghệ — ĐHQGHN, ngành Công nghệ thông tin',
    'Thu nhập: làm thêm ~8.000.000đ/tháng',
].join('\n');

const READS: Record<string, unknown> = {
    get_user_profile: {
        full_name: 'Minh Anh', occupation: 'Sinh viên năm 3 CNTT — ĐHQGHN', monthly_income: 8000000,
        goals: ['GPA ≥ 3.2', 'IELTS 6.5 trước khi tốt nghiệp'], personality_mbti: null,
    },
    get_financial_report: {
        month: iso(today).slice(0, 7), income: 8000000, expense: 7150000, balance_all_time: 12400000,
        by_category: [
            { category: 'Ăn uống', amount: 3100000 }, { category: 'Nhà ở', amount: 2000000 },
            { category: 'Mua sắm', amount: 950000 }, { category: 'Đi lại', amount: 600000 },
            { category: 'Giải trí', amount: 500000 },
        ],
        savings_goal: { name: 'Quỹ dự phòng', target: 20000000, current: 6500000 },
    },
    query_database: { rows: [
        { date: plus(-1), category: 'Ăn uống', amount: 85000, note: 'Cơm trưa + trà sữa' },
        { date: plus(-2), category: 'Mua sắm', amount: 450000, note: 'Giày' },
        { date: plus(-3), category: 'Ăn uống', amount: 120000, note: 'Lẩu với bạn' },
    ] },
    get_todos_and_schedule: {
        todos: [
            { id: 't1', title: 'Hoàn thành bài tập lớn Cơ sở dữ liệu', deadline: plus(2), priority: 'high', done: false },
            { id: 't2', title: 'Ôn thi giữa kỳ Xác suất thống kê', deadline: plus(4), priority: 'high', done: false },
            { id: 't3', title: 'Nộp đơn thực tập FPT', deadline: plus(5), priority: 'medium', done: false },
            { id: 't4', title: 'Đọc chương 3 sách Clean Code', deadline: null, priority: 'low', done: false },
            { id: 't5', title: 'Đóng tiền điện nước', deadline: plus(1), priority: 'medium', done: false },
        ],
        timetable: [
            { day: 'Thứ 2', time: '07:00–09:30', subject: 'Cơ sở dữ liệu' },
            { day: 'Thứ 3', time: '13:00–15:30', subject: 'Xác suất thống kê' },
            { day: 'Thứ 5', time: '09:30–12:00', subject: 'Mạng máy tính' },
        ],
        events: [{ title: 'Làm thêm quán cà phê', time: 'Thứ 6, Thứ 7 18:00–22:00' }],
    },
    get_academic_gpa_record: {
        scale: 'VNU (hệ 4)', cumulative_gpa: 3.05, credits_earned: 92, credits_required: 135,
        semesters: [
            { name: 'HK1 2025–2026', gpa: 3.12, credits: 18 },
            { name: 'HK2 2025–2026', gpa: 2.95, credits: 19 },
        ],
        remaining_courses_this_term: [
            { name: 'Cơ sở dữ liệu', credits: 3 }, { name: 'Xác suất thống kê', credits: 3 }, { name: 'Mạng máy tính', credits: 3 },
        ],
    },
    get_habits_tracker: { habits: [
        { name: 'Ngủ trước 23h', streak: 2, last7: [1, 0, 0, 1, 0, 1, 0] },
        { name: 'Chạy bộ', streak: 0, last7: [0, 1, 0, 0, 0, 0, 0] },
    ] },
    get_countdown_events: { events: [{ title: 'Sinh nhật bạn thân Hà', date: plus(9) }, { title: 'Thi cuối kỳ', date: plus(30) }] },
    get_journal_entries: { entries: [
        { date: plus(-1), mood: 2, text: 'Hôm nay mệt, nhiều deadline, ngủ ít.' },
        { date: plus(-3), mood: 3, text: 'Đi ăn với nhóm bạn, vui nhưng lo chuyện tiền.' },
    ] },
    get_bookmarks: { bookmarks: [] },
    get_google_calendar_events: { events: [] },
    search_nearby_places: { places: [] },
    calculate_needed_gpa: { needed_average_on_remaining: 3.62, remaining_credits: 43, feasible: true },
    simulate_gpa: { projected_gpa: 3.11 },
    simulate_financial_impact: {
        description: 'Mua xe máy', amount: 35000000, current_balance: 12400000, monthly_surplus: 850000,
        months_to_recover: 41, emergency_fund_after: 0, verdict: 'Vượt số dư hiện có — cần tiết kiệm thêm hoặc trả góp',
    },
};

export const MOCK_WEB_RESULT = {
    summary: 'Theo các nguồn tổng hợp gần đây, thông tin liên quan được nêu ở [1] và [2]. (Kết quả mô phỏng cho eval — không phải dữ liệu thật.)',
    sources: [
        { n: 1, title: 'Bài tổng hợp (mô phỏng) số 1', domain: 'vnexpress.net' },
        { n: 2, title: 'Trang chính thức (mô phỏng)', domain: 'moet.gov.vn' },
    ],
};

const WRITE_TOOLS = new Set([
    'add_todo', 'add_transaction', 'add_calendar_event', 'add_timetable', 'batch_add_transactions',
    'update_todo', 'delete_todo', 'add_bookmark', 'update_bookmark', 'delete_bookmark',
    'update_calendar_event', 'delete_calendar_event', 'import_gpa_data',
]);

export function isWriteTool(name: string) {
    return WRITE_TOOLS.has(name);
}

export function mockToolResult(name: string, args: any): unknown {
    if (name === 'render_chart') return { success: true, message: 'Đã vẽ biểu đồ' };
    if (WRITE_TOOLS.has(name)) return { success: true, message: `Đã thực hiện ${name}`, echo: args };
    if (name in READS) return READS[name];
    return { error: `Công cụ ${name} không có dữ liệu mẫu` };
}
