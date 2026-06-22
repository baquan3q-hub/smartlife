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
    estimateGeminiCost,
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
    type: 'timetable' | 'todo' | 'transaction' | 'financial_impact';
    success: boolean;
    message: string;
    data?: any;
}

export interface AIResponse {
    text: string;
    charts: ChartData[];
    actions: ActionResult[];
    updatedHistory?: ChatMessage[];
    tokens_used?: number;
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
// Tool Declarations for Gemini Function Calling
// ────────────────────────────────────────
const TOOL_DECLARATIONS: ToolDeclaration[] = [
    {
        name: 'query_database',
        description: 'Truy vấn dữ liệu chi tiết từ database Supabase. Dùng khi cần lọc, phân tích dữ liệu cụ thể ngoài context tóm tắt để cá nhân hóa. Các bảng khả dụng: transactions (giao dịch), goals (mục tiêu), budgets (ngân sách), timetable (lịch trình), todos (việc cần làm), profiles (hồ sơ), calendar_events (sự kiện lịch), wallets (danh sách ví), debts (khoản nợ và cho vay), debt_repayments (lịch sử trả nợ).',
        parameters: {
            type: 'object',
            properties: {
                table: {
                    type: 'string',
                    description: 'Tên bảng cần truy vấn',
                    enum: ['transactions', 'goals', 'budgets', 'timetable', 'todos', 'profiles', 'calendar_events', 'gpa_semesters', 'gpa_courses', 'habits', 'habit_logs', 'countdown_items', 'countup_items', 'journal_entries', 'journal_tags', 'wallets', 'debts', 'debt_repayments', 'my_storage']
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
                deadline: { type: 'string', description: 'Hạn hoàn thành, format YYYY-MM-DD' },
                status: { type: 'string', description: 'Trạng thái cột của task', enum: ['backlog', 'todo', 'doing', 'done'] },
                description: { type: 'string', description: 'Mô tả chi tiết việc cần làm' }
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
        name: 'simulate_financial_impact',
        description: 'Mô phỏng và cố vấn tác động tài chính khi phát sinh chi phí hoặc sự kiện đột xuất giả định (ví dụ: đi đám cưới, bị phạt giao thông, mua điện thoại, hỏng xe, đầu tư công nghệ...). Trả về chi tiết ảnh hưởng tới số dư ví, ngân sách chi tiêu và tiến độ đạt các mục tiêu tiết kiệm.',
        parameters: {
            type: 'object',
            properties: {
                description: {
                    type: 'string',
                    description: 'Mô tả chi tiết hoặc tên sự kiện phát sinh. VD: "bị phạt giao thông", "đi đám cưới bạn thân", "mua laptop mới"'
                },
                amount: {
                    type: 'number',
                    description: 'Số tiền phát sinh dự kiến (VND). VD: 1000000'
                }
            },
            required: ['description', 'amount']
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
        description: 'Lấy toàn bộ Kanban board (4 cột: Backlog, Todo, Doing, Done) với chi tiết từng nhiệm vụ (mô tả, subtasks, hạn chót) và lịch trình cố định hàng tuần.',
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
    },
    {
        name: 'import_gpa_data',
        description: 'Tự động thêm dữ liệu bảng điểm học kỳ và các môn học vào GPA Tracker dựa trên kết quả phân tích hình ảnh bảng điểm hoặc văn bản do người dùng cung cấp.',
        parameters: {
            type: 'object',
            properties: {
                semesters: {
                    type: 'array',
                    description: 'Danh sách các học kỳ kèm môn học.',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Tên học kỳ. VD: "Học kỳ 1", "Học kỳ 2", "Học kỳ phụ (Hè)"' },
                            academic_year: { type: 'string', description: 'Năm học theo định dạng YYYY-YYYY. VD: "2023-2024", "2024-2025"' },
                            semester_type: { type: 'string', enum: ['HK1', 'HK2', 'HocHe'], description: 'Loại học kỳ: HK1, HK2, HocHe' },
                            year_of_study: { type: 'integer', description: 'Năm học thứ mấy của sinh viên. VD: 1, 2, 3, 4' },
                            courses: {
                                type: 'array',
                                description: 'Danh sách các môn học trong học kỳ này.',
                                items: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string', description: 'Tên môn học/học phần' },
                                        credits: { type: 'integer', description: 'Số tín chỉ của môn học. VD: 2, 3, 4' },
                                        template: { type: 'string', enum: ['A', 'B', 'C'], description: 'Mẫu tính điểm (A: CC1 10%, CC2 30%, CK 60%; B: CC1 10%, CC2 10%, CC3 20%, CK 60%; C: CC1 20%, CC2 20%, CK 60%). Mặc định "A" nếu không chắc chắn.' },
                                        score_cc1: { type: 'number', description: 'Điểm thành phần 1 (thang 10), nếu có.' },
                                        score_cc2: { type: 'number', description: 'Điểm thành phần 2 (thang 10), nếu có.' },
                                        score_cc3: { type: 'number', description: 'Điểm thành phần 3 (thang 10), nếu có.' },
                                        score_final: { type: 'number', description: 'Điểm cuối kỳ hoặc điểm tổng kết thang 10. Nếu là điểm tổng kết môn học thang 10, hãy gán vào score_final và đặt template phù hợp.' },
                                        exclude_from_gpa: { type: 'boolean', description: 'Đặt true nếu môn học này không tính vào GPA (ví dụ: Thể dục, Giáo dục quốc phòng).' }
                                    },
                                    required: ['name', 'credits']
                                }
                            }
                        },
                        required: ['name', 'academic_year', 'semester_type', 'year_of_study', 'courses']
                    }
                }
            },
            required: ['semesters']
        }
    },
    {
        name: 'update_todo',
        description: 'Cập nhật thông tin hoặc trạng thái phân loại cột (backlog, todo, doing, done) của một việc cần làm (todo) hiện tại theo ID. Xác nhận với người dùng trước khi thay đổi.',
        parameters: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'ID của việc cần làm cần cập nhật (ví dụ: uuid)' },
                content: { type: 'string', description: 'Nội dung mới của việc cần làm (tuỳ chọn)' },
                priority: { type: 'string', description: 'Mức ưu tiên mới (tuỳ chọn)', enum: ['high', 'medium', 'low'] },
                deadline: { type: 'string', description: 'Hạn hoàn thành mới (tuỳ chọn), format YYYY-MM-DD' },
                status: { type: 'string', description: 'Trạng thái cột phân loại mới (tuỳ chọn)', enum: ['backlog', 'todo', 'doing', 'done'] },
                description: { type: 'string', description: 'Mô tả chi tiết mới (tuỳ chọn)' }
            },
            required: ['id']
        }
    },
    {
        name: 'delete_todo',
        description: 'Xóa một việc cần làm (todo) theo ID. Hỏi xác nhận người dùng trước khi xóa.',
        parameters: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'ID của việc cần làm cần xóa' }
            },
            required: ['id']
        }
    },
    {
        name: 'get_bookmarks',
        description: 'Lấy danh sách tất cả các liên kết (bookmarks/links) đã lưu của người dùng.',
        parameters: { type: 'object', properties: {} }
    },
    {
        name: 'add_bookmark',
        description: 'Thêm một liên kết (bookmark) mới. Xác nhận với người dùng trước khi thêm.',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Tiêu đề hoặc mô tả ngắn của liên kết. VD: "Tài liệu học React"' },
                url: { type: 'string', description: 'Đường dẫn URL của liên kết. VD: "https://react.dev"' },
                group: { type: 'string', description: 'Tên nhóm phân loại bookmark (tuỳ chọn). VD: "dự án", "Sách", "học tập"' }
            },
            required: ['title', 'url']
        }
    },
    {
        name: 'update_bookmark',
        description: 'Cập nhật thông tin hoặc nhóm phân loại của một bookmark hiện có. Xác nhận với người dùng trước khi cập nhật.',
        parameters: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'ID của bookmark cần cập nhật' },
                title: { type: 'string', description: 'Tiêu đề mới (tuỳ chọn)' },
                url: { type: 'string', description: 'URL mới (tuỳ chọn)' },
                group: { type: 'string', description: 'Nhóm phân loại mới (tuỳ chọn)' }
            },
            required: ['id']
        }
    },
    {
        name: 'delete_bookmark',
        description: 'Xóa một liên kết (bookmark) theo ID. Hỏi xác nhận trước khi xóa.',
        parameters: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'ID của bookmark cần xóa' }
            },
            required: ['id']
        }
    },
    {
        name: 'add_calendar_event',
        description: 'Thêm lịch hẹn hoặc cuộc họp cụ thể theo ngày vào lịch (Calendar). Thích hợp cho các cuộc hẹn diễn ra một lần hoặc vào một ngày cụ thể (không cố định hàng tuần). Mặc định nếu không chỉ định gì sẽ bật thông báo báo trước 30 phút qua Gmail.',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Tiêu đề lịch hẹn. VD: "Đi ăn chè"' },
                date: { type: 'string', description: 'Ngày diễn ra lịch hẹn, format YYYY-MM-DD. VD: "2026-06-24"' },
                time: { type: 'string', description: 'Giờ diễn ra, format HH:mm. VD: "01:00" hoặc "18:30" (tuỳ chọn)' },
                location: { type: 'string', description: 'Địa điểm (tuỳ chọn)' },
                description: { type: 'string', description: 'Mô tả chi tiết hoặc ghi chú lịch hẹn (tuỳ chọn)' },
                email_notify: { type: 'boolean', description: 'Có gửi email thông báo nhắc nhở qua Gmail không. Mặc định là true.' },
                email_notify_before_minutes: { type: 'integer', description: 'Thời gian gửi thông báo trước khi diễn ra sự kiện (phút). Mặc định là 30. Nếu báo trước 1 ngày thì truyền 1440 (24 * 60).' }
            },
            required: ['title', 'date']
        }
    },
    {
        name: 'update_calendar_event',
        description: 'Cập nhật thông tin chi tiết của một lịch hẹn/sự kiện lịch hiện có theo ID. Hỏi xác nhận trước khi cập nhật.',
        parameters: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'ID của lịch hẹn cần cập nhật' },
                title: { type: 'string', description: 'Tiêu đề mới (tuỳ chọn)' },
                date: { type: 'string', description: 'Ngày mới format YYYY-MM-DD (tuỳ chọn)' },
                time: { type: 'string', description: 'Giờ mới format HH:mm (tuỳ chọn)' },
                location: { type: 'string', description: 'Địa điểm mới (tuỳ chọn)' },
                description: { type: 'string', description: 'Mô tả/ghi chú mới (tuỳ chọn)' },
                email_notify: { type: 'boolean', description: 'Bật/tắt gửi email thông báo (tuỳ chọn)' },
                email_notify_before_minutes: { type: 'integer', description: 'Thời gian gửi thông báo trước (phút) (tuỳ chọn)' }
            },
            required: ['id']
        }
    },
    {
        name: 'delete_calendar_event',
        description: 'Xóa một lịch hẹn/sự kiện lịch theo ID. Hỏi xác nhận trước khi xóa.',
        parameters: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'ID của lịch hẹn cần xóa' }
            },
            required: ['id']
        }
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
    attachments?: AIAttachment[],
    signal?: AbortSignal
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
        let totalTokensConsumed = 0;

        while (toolCallCount < MAX_TOOL_CALLS) {
            if (signal?.aborted) {
                throw new DOMException('Request aborted', 'AbortError');
            }

            if (toolCallCount > 0) {
                // Tránh gọi API liên tục quá nhanh gây nghẽn burst limit (lỗi 503)
                await new Promise<void>((resolve, reject) => {
                    const timer = setTimeout(resolve, 1200);
                    if (signal) {
                        signal.addEventListener('abort', () => {
                            clearTimeout(timer);
                            reject(new DOMException('Request aborted', 'AbortError'));
                        });
                    }
                });
            }

            const body = {
                ...buildRequest(contents),
                isToolCall: toolCallCount > 0
            };
            const data = await callGeminiRaw(body, 0, signal);

            // Log token usage with detailed tracking (Phase 1)
            if (data?.usageMetadata?.totalTokenCount) {
                totalTokensConsumed += data.usageMetadata.totalTokenCount;
                supabase.auth.getUser().then(({ data: authData }) => {
                    const uid = authData?.user?.id;
                    if (!uid) { console.warn('[SmartLife] Token log skipped: no user'); return; }
                    supabase.from('api_logs').insert([{
                        user_id: uid,
                        action: 'chat',
                        tokens_used: data.usageMetadata.totalTokenCount,
                        prompt_tokens: data.usageMetadata.promptTokenCount || 0,
                        candidates_tokens: data.usageMetadata.candidatesTokenCount || 0,
                        thoughts_tokens: data.usageMetadata.thoughtsTokenCount || data.usageMetadata.thinkingTokenCount || 0,
                        estimated_cost_vnd: estimateGeminiCost(data.usageMetadata.promptTokenCount || 0, data.usageMetadata.candidatesTokenCount || 0),
                        model: 'gemini-2.5-flash'
                    }]).then(({ error }) => {
                        if (error) console.error('[SmartLife] ❌ Token log failed:', error.message);
                        else console.info(`[SmartLife] ✅ Logged ${data.usageMetadata.totalTokenCount} tokens`);
                    });
                });
            }

            const candidate = data?.candidates?.[0];
            
            // Kiểm tra trường hợp Prompt bị hệ thống Google chặn ngay lập tức (Safety / Policy Block)
            if (!candidate) {
                let blockMsg = 'Không nhận được phản hồi từ AI.';
                if (data?.promptFeedback?.blockReason) {
                    blockMsg = `⚠️ Yêu cầu bị hệ thống kiểm duyệt tự động chặn (Lý do: ${data.promptFeedback.blockReason}). Vui lòng điều chỉnh hoặc diễn đạt lại câu hỏi phù hợp hơn.`;
                }
                return { text: blockMsg, charts, actions, updatedHistory: cleanChatHistory(contents), tokens_used: totalTokensConsumed };
            }

            // Kiểm tra finishReason của candidate
            if (candidate.finishReason && candidate.finishReason !== 'STOP') {
                if (candidate.finishReason === 'SAFETY') {
                    return {
                        text: '⚠️ Phản hồi bị chặn bởi bộ lọc an toàn tự động của Google (Lý do: SAFETY). Điều này có thể xảy ra nếu thông tin thói quen, nhật ký hoặc dữ liệu liên quan của bạn có từ ngữ quá nhạy cảm. Vui lòng kiểm tra lại dữ liệu hoặc diễn đạt câu hỏi theo cách khác.',
                        charts,
                        actions,
                        updatedHistory: cleanChatHistory(contents),
                        tokens_used: totalTokensConsumed
                    };
                }
                if (candidate.finishReason === 'RECITATION') {
                    return {
                        text: '⚠️ Phản hồi bị chặn do phát hiện nội dung sao chép tài liệu có bản quyền (Lý do: RECITATION). Vui lòng đặt câu hỏi khác hoặc diễn đạt theo cách khác.',
                        charts,
                        actions,
                        updatedHistory: cleanChatHistory(contents),
                        tokens_used: totalTokensConsumed
                    };
                }
            }

            if (!candidate.content?.parts) {
                return { text: 'Không nhận được phản hồi từ AI.', charts, actions, updatedHistory: cleanChatHistory(contents), tokens_used: totalTokensConsumed };
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
                    updatedHistory: cleanChatHistory(contents),
                    tokens_used: totalTokensConsumed
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
            updatedHistory: cleanChatHistory(contents),
            tokens_used: totalTokensConsumed
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

