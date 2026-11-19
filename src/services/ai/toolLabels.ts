// File: src/services/ai/toolLabels.ts
// Câu tiếng Việt dễ hiểu cho từng bước AI đang làm (hiện trong ThinkingPanel).

const TABLE_LABELS: Record<string, string> = {
    transactions: 'giao dịch',
    goals: 'mục tiêu',
    budgets: 'ngân sách',
    timetable: 'thời khoá biểu',
    todos: 'việc cần làm',
    profiles: 'hồ sơ',
    calendar_events: 'sự kiện lịch',
    gpa_semesters: 'học kỳ GPA',
    gpa_courses: 'môn học',
    habits: 'thói quen',
    habit_logs: 'nhật ký thói quen',
    countdown_items: 'sự kiện đếm ngược',
    countup_items: 'mốc đếm lên',
    journal_entries: 'nhật ký',
    journal_tags: 'thẻ nhật ký',
    wallets: 'ví',
    debts: 'khoản nợ',
    debt_repayments: 'lịch sử trả nợ',
    my_storage: 'kho lưu trữ',
};

// "2026-10-01" → "01/10"; khác năm hiện tại thì thêm năm
function shortDate(iso?: string): string | null {
    if (typeof iso !== 'string') return null;
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const sameYear = Number(m[1]) === new Date().getFullYear();
    return sameYear ? `${m[3]}/${m[2]}` : `${m[3]}/${m[2]}/${m[1]}`;
}

function dateRange(from?: string, to?: string): string {
    const a = shortDate(from);
    const b = shortDate(to);
    if (a && b) return ` ${a}–${b}`;
    if (a) return ` từ ${a}`;
    if (b) return ` đến ${b}`;
    return '';
}

const quote = (s: unknown, max = 40) => {
    const text = String(s ?? '').trim();
    if (!text) return '';
    return ` “${text.length > max ? text.slice(0, max - 1) + '…' : text}”`;
};

// Câu mô tả khi bắt đầu một bước
export function describeToolCall(name: string, args: Record<string, any> = {}): string {
    switch (name) {
        case 'query_database': {
            const table = TABLE_LABELS[args.table] || args.table || 'dữ liệu';
            return `Đang đọc ${table}${dateRange(args.date_from, args.date_to)}`;
        }
        case 'get_user_profile': return 'Đang xem hồ sơ của bạn';
        case 'get_financial_report': return 'Đang tổng hợp báo cáo tài chính';
        case 'get_todos_and_schedule': return 'Đang xem lịch và việc cần làm';
        case 'get_academic_gpa_record': return 'Đang xem bảng điểm GPA';
        case 'get_habits_tracker': return 'Đang xem thói quen';
        case 'get_countdown_events': return 'Đang xem các sự kiện sắp tới';
        case 'get_journal_entries': return 'Đang đọc nhật ký';
        case 'get_bookmarks': return 'Đang xem dấu trang';
        case 'get_google_calendar_events': return `Đang đọc Google Calendar${args.days_ahead ? ` ${args.days_ahead} ngày tới` : ''}`;
        case 'search_nearby_places': return `Đang tìm địa điểm${quote(args.query)}`;
        case 'web_search': return `Đang tìm trên web${quote(args.query)}`;
        case 'ask_user': return args.purpose === 'confirm' ? 'Xin bạn xác nhận trước khi ghi' : 'Hỏi lại bạn để hiểu rõ hơn';
        case 'render_chart': return `Đang vẽ biểu đồ${quote(args.title)}`;
        case 'calculate_needed_gpa': return `Đang tính GPA cần đạt${args.target_gpa ? ` để lên ${args.target_gpa}` : ''}`;
        case 'simulate_gpa': return 'Đang mô phỏng GPA';
        case 'simulate_financial_impact': return `Đang mô phỏng tác động tài chính${quote(args.description)}`;
        case 'add_todo': return `Đang thêm việc${quote(args.content)}`;
        case 'update_todo': return 'Đang cập nhật việc cần làm';
        case 'delete_todo': return 'Đang xoá việc cần làm';
        case 'add_timetable': return `Đang thêm vào thời khoá biểu${quote(args.title || args.subject)}`;
        case 'add_transaction': return `Đang ghi giao dịch${quote(args.description || args.category)}`;
        case 'batch_add_transactions': return `Đang ghi ${Array.isArray(args.transactions) ? args.transactions.length + ' ' : ''}giao dịch`;
        case 'import_gpa_data': return 'Đang nhập dữ liệu GPA';
        case 'add_bookmark': return 'Đang thêm dấu trang';
        case 'update_bookmark': return 'Đang sửa dấu trang';
        case 'delete_bookmark': return 'Đang xoá dấu trang';
        case 'add_calendar_event': return `Đang thêm sự kiện${quote(args.title)}`;
        case 'update_calendar_event': return 'Đang sửa sự kiện lịch';
        case 'delete_calendar_event': return 'Đang xoá sự kiện lịch';
        default: return `Đang chạy ${name}`;
    }
}

// Ghi chú ngắn khi bước xong ("42 bản ghi", "lỗi: …")
export function describeToolResult(name: string, result: any): { ok: boolean; detail?: string } {
    if (!result || typeof result !== 'object') return { ok: true };
    const error = result.error || (result.success === false ? result.message : null);
    if (error) return { ok: false, detail: String(error).slice(0, 120) };
    if (name === 'query_database' && typeof result.count === 'number') {
        return { ok: true, detail: result.count === 0 ? 'không có bản ghi' : `${result.count} bản ghi` };
    }
    if (name === 'web_search' && Array.isArray(result.sources)) {
        return { ok: true, detail: result.sources.length ? `${result.sources.length} nguồn` : 'không có nguồn' };
    }
    if (Array.isArray(result.places)) return { ok: true, detail: `${result.places.length} địa điểm` };
    if (Array.isArray(result.events)) return { ok: true, detail: `${result.events.length} sự kiện` };
    return { ok: true };
}

// Thời lượng gọn: 850ms → "1 giây", 72s → "1 phút 12 giây"
export function formatDuration(ms: number): string {
    const s = Math.max(1, Math.round(ms / 1000));
    if (s < 60) return `${s} giây`;
    const m = Math.floor(s / 60);
    const rest = s % 60;
    return rest ? `${m} phút ${rest} giây` : `${m} phút`;
}
