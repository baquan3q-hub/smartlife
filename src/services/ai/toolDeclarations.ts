// File: src/services/ai/toolDeclarations.ts
// Khai báo công cụ (function calling) cho Gemini — tách khỏi aiEngine để dùng được trong test và scripts/ai-eval.
// File thuần: chỉ import kiểu, không kéo Supabase.

import type { ToolDeclaration } from '../geminiService';
import type { ExpertProfile } from './experts/types';

export const BASE_TOOL_DECLARATIONS: ToolDeclaration[] = [
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
    },
    {
        name: 'search_nearby_places',
        description: 'Tìm kiếm và gợi ý địa điểm gần vị trí hiện tại của người dùng. Dùng khi người dùng hỏi về: cây xăng, quán ăn, quán café, tiệm sửa xe, nhà thuốc, bệnh viện, ATM, siêu thị, hoặc bất kỳ địa điểm nào gần đây. Trả về danh sách gợi ý kèm link Google Maps để chỉ đường. QUAN TRỌNG: Luôn gọi tool này khi người dùng cần tìm địa điểm — tool sẽ cung cấp GPS và link Maps.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Loại địa điểm cần tìm. VD: "cây xăng", "quán phở", "tiệm sửa xe máy", "nhà thuốc Long Châu", "quán cafe yên tĩnh có wifi"'
                },
                is_emergency: {
                    type: 'boolean',
                    description: 'True nếu là tình huống khẩn cấp (xe hỏng, cần cứu hộ, tai nạn). Sẽ ưu tiên kết quả gần nhất.'
                },
                additional_context: {
                    type: 'string',
                    description: 'Thông tin bổ sung từ người dùng. VD: "giá sinh viên", "mở cửa sau 22h", "có chỗ để xe"'
                }
            },
            required: ['query']
        }
    },
    {
        name: 'get_google_calendar_events',
        description: 'Lấy danh sách sự kiện từ Google Calendar của người dùng trong một khoảng thời gian. Dùng khi người dùng hỏi về lịch Google, sự kiện sắp tới, hoặc muốn kiểm tra lịch trình từ Google Calendar.',
        parameters: {
            type: 'object',
            properties: {
                days_ahead: {
                    type: 'integer',
                    description: 'Số ngày tới cần lấy sự kiện. Mặc định 7. VD: 1 = hôm nay, 7 = tuần này, 30 = tháng này.'
                },
                days_back: {
                    type: 'integer',
                    description: 'Số ngày trước cần lấy sự kiện. Mặc định 0.'
                }
            }
        }
    }
];

// ────────────────────────────────────────
// Công cụ mới của AI đồng hành
// ────────────────────────────────────────

// Hỏi lại người dùng bằng thẻ trắc nghiệm. Engine dừng vòng lặp khi gặp lệnh này.
export const ASK_USER_DECLARATION: ToolDeclaration = {
    name: 'ask_user',
    description: 'Hỏi lại người dùng bằng thẻ câu hỏi có lựa chọn khi THIẾU thông tin làm câu trả lời thay đổi đáng kể và không thể lấy từ công cụ dữ liệu; hoặc để XÁC NHẬN trước khi ghi hàng loạt (> 3 việc/giao dịch/lịch). Tối đa 3 câu hỏi, mỗi câu 2–4 lựa chọn ngắn. Gọi công cụ này thì KHÔNG viết thêm câu trả lời — chờ người dùng chọn.',
    parameters: {
        type: 'object',
        properties: {
            purpose: {
                type: 'string',
                enum: ['clarify', 'confirm'],
                description: '"clarify" = hỏi thêm thông tin còn thiếu; "confirm" = xin xác nhận trước khi ghi hàng loạt.',
            },
            intro: { type: 'string', description: 'Một câu ngắn giải thích vì sao cần hỏi (vd. "Để lên kế hoạch sát với bạn, mình cần biết thêm:").' },
            questions: {
                type: 'array',
                description: 'Tối đa 3 câu hỏi.',
                items: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', description: 'Mã ngắn, vd. "deadline"' },
                        question: { type: 'string', description: 'Câu hỏi ngắn gọn' },
                        options: { type: 'array', items: { type: 'string' }, description: '2–4 lựa chọn ngắn' },
                        multi: { type: 'boolean', description: 'true nếu được chọn nhiều đáp án' },
                        allowOther: { type: 'boolean', description: 'true để cho phép người dùng tự nhập "Khác…"' },
                    },
                    required: ['id', 'question', 'options'],
                },
            },
        },
        required: ['intro', 'questions'],
    },
};

// Tìm web có nguồn (gọi /api/search). Tối đa 2 lần mỗi câu hỏi.
export const WEB_SEARCH_DECLARATION: ToolDeclaration = {
    name: 'web_search',
    description: 'Tìm thông tin mới trên web (tin tức, giá cả, lãi suất, tỷ giá, quy định, lịch thi, sự kiện…) — chỉ dùng khi câu hỏi cần thông tin bên ngoài dữ liệu của người dùng hoặc có thể đã thay đổi theo thời gian. Trả về tóm tắt có đánh dấu [n] và danh sách nguồn. Tối đa 2 lần cho mỗi câu hỏi.',
    parameters: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Truy vấn tìm kiếm ngắn, cụ thể (tiếng Việt hoặc tiếng Anh).' },
        },
        required: ['query'],
    },
};

export const TOOL_DECLARATIONS: ToolDeclaration[] = [...BASE_TOOL_DECLARATIONS, WEB_SEARCH_DECLARATION, ASK_USER_DECLARATION];

/** Danh sách công cụ cho chuyên gia đang chọn. ask_user luôn có; web_search chỉ khi được bật. */
export function toolsFor(expert: Pick<ExpertProfile, 'allowedTools'>, opts: { webSearch?: boolean } = {}): ToolDeclaration[] {
    const webSearch = opts.webSearch !== false;
    const allowed = expert.allowedTools;
    const base = allowed === 'all'
        ? BASE_TOOL_DECLARATIONS
        : BASE_TOOL_DECLARATIONS.filter(t => allowed.includes(t.name));
    const out = [...base];
    if (webSearch && (allowed === 'all' || allowed.includes('web_search'))) out.push(WEB_SEARCH_DECLARATION);
    out.push(ASK_USER_DECLARATION);
    return out;
}
