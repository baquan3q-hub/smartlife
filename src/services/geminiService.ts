// File: src/services/geminiService.ts
// Gemini API client for SmartLife AI Advisor v2
// — Single model, direct call (no fallback/retry)

import { AppState, TransactionType, GPATemplateType, Habit, HabitLog, CountdownItem, CountUpItem } from '../types';
import {
    computeAllCourses, calculateSemesterGPA, calculateCumulativeGPA,
    getAcademicStanding, checkAcademicWarning, predictGraduationHonor,
    calculateCumulativeData, computeCourse,
} from './gpaCalculator';
import { GRADE_SCALE, SEMESTER_TYPE_LABELS } from '../constants';
import { supabase } from './supabase';
import { createSseParser } from './ai/streamParser';
import { LEGACY_SYSTEM_INSTRUCTION } from './ai/promptBlocks';

// Habit/event icons are either an emoji or "lucide:<key>" (rendered in the UI only); keep emoji in the AI context.
const iconText = (icon?: string | null) => (icon && !icon.startsWith('lucide:') ? `${icon} ` : '');

// ────────────────────────────────────────
// API Configuration
// ────────────────────────────────────────
// API key được quản lý an toàn phía server (Vercel Serverless Function)
// Frontend chỉ gọi proxy endpoint — KHÔNG bao giờ chứa key
const GEMINI_PROXY_URL = '/api/gemini';

// Model name — chỉ dùng để hiển thị, server tự quyết định model
const MODEL = 'gemini-2.5-flash';

export function getCurrentModel(): string { return MODEL; }


// ────────────────────────────────────────
// Request Queue — throttled to prevent burst rate limits
// ────────────────────────────────────────
let _requestQueue: Promise<any> = Promise.resolve();
const MIN_REQUEST_GAP_MS = 1000; // 1s giữa các request

export function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const task = _requestQueue.then(async () => {
        await new Promise(r => setTimeout(r, MIN_REQUEST_GAP_MS));
        return fn();
    }, async () => {
        await new Promise(r => setTimeout(r, MIN_REQUEST_GAP_MS));
        return fn();
    });
    _requestQueue = task.catch(() => { });
    return task;
}

// ────────────────────────────────────────
// Types
// ────────────────────────────────────────
export interface ChatMessage {
    role: 'user' | 'model' | 'function';
    parts: MessagePart[];
}

// thought / thoughtSignature: Gemini trả về khi bật suy nghĩ; chữ ký phải gửi lại nguyên vẹn trong cùng lượt gọi hàm
type PartExtras = { thought?: boolean; thoughtSignature?: string };

export type MessagePart =
    | ({ text: string } & PartExtras)
    | ({ functionCall: { name: string; args: Record<string, any> } } & PartExtras)
    | { functionResponse: { name: string; response: { result: any } } }
    | { inlineData: { mimeType: string; data: string } };

// Tầng tốc độ gửi lên proxy — server tự chọn model và mức suy nghĩ.
// 'lite' (flash-lite) chỉ do Auto chọn cho câu chat ngắn và cho lệnh nội bộ nhẹ — không có trong menu chọn tay.
export type AITier = 'lite' | 'fast' | 'balanced' | 'deep';

export interface StreamMeta {
    model: string;
    tier: string;
    weight: number;
}

export interface ToolDeclaration {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: Record<string, any>;
        required?: string[];
    };
}

// ────────────────────────────────────────
// Context Builders (unchanged logic — builds text context from AppState)
// ────────────────────────────────────────
function formatCurrency(amount: number): string {
    return amount.toLocaleString('vi-VN') + 'đ';
}

export function buildFinanceContext(state: AppState): string {
    const { transactions, budgets } = state;
    const totalIncomeAll = transactions.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
    const totalExpenseAll = transactions.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
    const currentBalance = totalIncomeAll - totalExpenseAll;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const monthTx = transactions.filter(t => t.date.startsWith(currentMonth));
    const income = monthTx.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
    const expense = monthTx.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);

    const categoryMap = new Map<string, number>();
    monthTx.filter(t => t.type === TransactionType.EXPENSE).forEach(t => {
        categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + t.amount);
    });
    const categoryBreakdown = Array.from(categoryMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amt]) => `  - ${cat}: ${formatCurrency(amt)} (${((amt / (expense || 1)) * 100).toFixed(0)}%)`)
        .join('\n');

    const budgetStatus = budgets
        .filter(b => b.month === currentMonth)
        .map(b => {
            const spent = monthTx.filter(t => t.type === TransactionType.EXPENSE && t.category === b.category).reduce((s, t) => s + t.amount, 0);
            const pct = Math.round((spent / b.amount) * 100);
            const status = pct > 100 ? '🔴 VƯỢT' : pct > 80 ? '🟡 SẮP HẾT' : '🟢 OK';
            return `  - ${b.category}: ${formatCurrency(spent)}/${formatCurrency(b.amount)} (${pct}%) ${status}`;
        })
        .join('\n');

    const monthlyTrend: string[] = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const mIncome = transactions.filter(t => t.date.startsWith(mKey) && t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
        const mExpense = transactions.filter(t => t.date.startsWith(mKey) && t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
        monthlyTrend.push(`  - T${d.getMonth() + 1}/${d.getFullYear()}: Thu ${formatCurrency(mIncome)}, Chi ${formatCurrency(mExpense)}, Tiết kiệm ${formatCurrency(mIncome - mExpense)}`);
    }

    const recentTx = [...transactions]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 15)
        .map(t => `  - ${t.date}: ${t.type === TransactionType.INCOME ? '+' : '-'}${formatCurrency(t.amount)} [${t.category}]${t.description ? ` "${t.description}"` : ''}`)
        .join('\n');

    // Wallets context
    const walletsInfo = state.wallets && state.wallets.length > 0
        ? state.wallets.map(w => `  - ${w.icon} ${w.name} (${w.type}): ${formatCurrency(w.balance)}${w.include_in_total ? '' : ' [Không tính vào tổng số dư]'}`).join('\n')
        : '  (Chưa thiết lập ví nào)';

    // Debts context
    const debtsInfo = state.debts && state.debts.length > 0
        ? state.debts.map(d => {
            const typeLabel = d.type === 'lend' ? 'Cho vay (Con nợ)' : 'Đi vay (Chủ nợ)';
            const statusLabel = d.status === 'paid' ? 'Đã trả' : d.status === 'partial' ? 'Đã trả một phần' : 'Chưa trả';
            return `  - ${d.partner_name} [${typeLabel}]: ${formatCurrency(d.amount)} (Còn lại: ${formatCurrency(d.remaining_amount)}) | Trạng thái: ${statusLabel}${d.due_date ? ` | Hạn: ${d.due_date}` : ''}`;
        }).join('\n')
        : '  (Chưa có khoản nợ/cho vay nào)';

    return `
📊 TÀI CHÍNH THÁNG ${now.getMonth() + 1}/${now.getFullYear()}:
- Số dư hiện tại: ${formatCurrency(currentBalance)}
- Tổng thu: ${formatCurrency(income)}
- Tổng chi: ${formatCurrency(expense)}
- Tiết kiệm (Từ Mục tiêu): ${formatCurrency(state.goals.filter(g => g.target_amount && g.target_amount > 0).reduce((s, g) => s + (g.current_amount || 0), 0))}

📂 CHI TIẾT CHI TIÊU THEO DANH MỤC:
${categoryBreakdown || '  (Chưa có dữ liệu)'}

💰 NGÂN SÁCH:
${budgetStatus || '  (Chưa thiết lập ngân sách)'}

💳 DANH SÁCH VÍ:
${walletsInfo}

🤝 KHOẢN NỢ & CHO VAY:
${debtsInfo}

📈 XU HƯỚNG 6 THÁNG:
${monthlyTrend.join('\n')}

🧾 15 GIAO DỊCH GẦN NHẤT:
${recentTx || '  (Chưa có giao dịch)'}`;
}

export function buildGoalsContext(state: AppState): string {
    const { goals } = state;
    if (!goals || goals.length === 0) return '\n🎯 MỤC TIÊU: Chưa thiết lập';

    const financialGoals = goals.filter(g => g.target_amount && g.target_amount > 0);
    const otherGoals = goals.filter(g => !g.target_amount || g.target_amount === 0);
    let ctx = '';

    if (financialGoals.length > 0) {
        ctx += `\n🎯 MỤC TIÊU TÀI CHÍNH (Tiết kiệm/Đầu tư):\n`;
        ctx += financialGoals.map(g => {
            const pct = Math.round(((g.current_amount || 0) / (g.target_amount || 1)) * 100);
            const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
            return `  - ${g.title}: ${bar} ${pct}% (${formatCurrency(g.current_amount || 0)}/${formatCurrency(g.target_amount || 0)})${g.deadline ? ` [Hạn: ${g.deadline}]` : ''}`;
        }).join('\n');
    }

    if (otherGoals.length > 0) {
        ctx += `\n🎯 MỤC TIÊU KỸ NĂNG/CÁ NHÂN:\n`;
        ctx += otherGoals.map(g => {
            const pct = g.progress || 0;
            const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
            return `  - ${g.title}: ${bar} ${pct}%${g.deadline ? ` [Hạn: ${g.deadline}]` : ''}`;
        }).join('\n');
    }
    return ctx;
}

export function buildScheduleContext(state: AppState): string {
    const { todos, timetable } = state;
    let ctx = '';
    const allTodos = todos || [];

    // Group todos by Kanban column status
    const columns: { status: string; label: string; emoji: string }[] = [
        { status: 'backlog', label: 'Backlog', emoji: '📦' },
        { status: 'todo', label: 'Todo', emoji: '📋' },
        { status: 'doing', label: 'Đang làm', emoji: '🔨' },
        { status: 'done', label: 'Hoàn thành', emoji: '✅' },
    ];

    const totalDone = allTodos.filter(t => t.status === 'done' || t.is_completed).length;

    if (allTodos.length > 0) {
        ctx += `\n📋 KANBAN BOARD — CÔNG VIỆC: ${totalDone}/${allTodos.length} hoàn thành\n`;

        columns.forEach(col => {
            const colTodos = allTodos.filter(t => {
                if (col.status === 'done') return t.status === 'done' || t.is_completed;
                if (col.status === 'todo') return t.status === 'todo' || (!t.status && !t.is_completed);
                return t.status === col.status;
            });

            ctx += `\n  ${col.emoji} CỘT "${col.label}" (${colTodos.length} task):\n`;

            if (colTodos.length === 0) {
                ctx += `    (trống)\n`;
            } else {
                colTodos.forEach(t => {
                    ctx += `    - [ID: ${t.id}] ${t.content}`;
                    if (t.deadline) {
                        ctx += ` [Hạn: ${new Date(t.deadline).toLocaleDateString('vi-VN')}]`;
                    }
                    if (t.description) {
                        const desc = t.description.substring(0, 80).replace(/\n/g, ' ');
                        ctx += ` — Mô tả: "${desc}${t.description.length > 80 ? '...' : ''}"`;
                    }
                    if (t.subtasks && t.subtasks.length > 0) {
                        const completed = t.subtasks.filter(s => s.is_completed).length;
                        ctx += ` | Checklist: ${completed}/${t.subtasks.length}`;
                        t.subtasks.forEach(s => {
                            ctx += `\n      ${s.is_completed ? '✅' : '⬜'} ${s.title}`;
                        });
                    }
                    ctx += '\n';
                });
            }
        });
    }

    if (timetable && timetable.length > 0) {
        ctx += `\n📅 LỊCH TRÌNH CỐ ĐỊNH (${timetable.length} sự kiện):\n`;
        timetable.slice(0, 6).forEach(e => {
            const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
            ctx += `  - ${days[e.day_of_week]}: ${e.title} (${e.start_time}${e.end_time ? `-${e.end_time}` : ''})${e.location ? ` @ ${e.location}` : ''}\n`;
        });
    }

    const customEvents = state.calendarEvents || [];
    if (customEvents.length > 0) {
        ctx += `\n📅 SỰ KIỆN LỊCH HẸN CHI TIẾT (Calendar):\n`;
        customEvents.forEach(e => {
            ctx += `  - [ID: ${e.id}] Ngày ${e.date}${e.time ? ` lúc ${e.time.slice(0, 5)}` : ''}: ${e.title}`;
            if (e.location) ctx += ` (Địa điểm: ${e.location})`;
            if (e.description) ctx += ` — Ghi chú: "${e.description}"`;
            if (e.email_notify) ctx += ` [Báo qua Gmail trước ${e.email_notify_before_minutes} phút]`;
            ctx += '\n';
        });
    }
    return ctx || '\n📋 LỊCH TRÌNH: Chưa có dữ liệu';
}

export function buildProfileContext(state: AppState): string {
    const { profile } = state;
    if (!profile) return '';
    let ctx = '\n👤 HỒ SƠ NGƯỜI DÙNG:\n';
    if (profile.full_name) ctx += `  - Tên: ${profile.full_name}\n`;
    if (profile.age) ctx += `  - Tuổi: ${profile.age}\n`;
    if (profile.job) ctx += `  - Nghề nghiệp: ${profile.job}\n`;
    if (profile.monthly_salary) ctx += `  - Thu nhập hàng tháng: ${formatCurrency(profile.monthly_salary)}\n`;
    if (profile.savings_goal) ctx += `  - Mục tiêu tiết kiệm: ${formatCurrency(profile.savings_goal)}\n`;
    if (profile.university) ctx += `  - Trường học: ${profile.university}\n`;
    if (profile.career_objective) ctx += `  - Định hướng nghề nghiệp: ${profile.career_objective}\n`;
    if (profile.personality_mbti) ctx += `  - Tính cách MBTI: ${profile.personality_mbti}\n`;
    if (profile.personality_disc) ctx += `  - Tính cách DISC: ${profile.personality_disc}\n`;
    if (profile.hobbies && profile.hobbies.length > 0) ctx += `  - Sở thích: ${profile.hobbies.join(', ')}\n`;
    if (profile.life_motto) ctx += `  - Châm ngôn sống: "${profile.life_motto}"\n`;
    return ctx;
}

export function buildGPAContext(state: AppState): string {
    const { gpaSemesters, gpaTargetCredits } = state;
    if (!gpaSemesters || gpaSemesters.length === 0) return '\n🎓 GPA: Chưa có dữ liệu học kỳ';

    const targetCredits = gpaTargetCredits || 120;
    const semestersComputed = gpaSemesters.map(s => ({
        ...s,
        courses: computeAllCourses(s.courses),
    }));

    const cumulativeData = calculateCumulativeData(
        semestersComputed,
        targetCredits,
        Math.max(...semestersComputed.map(s => s.year_of_study), 1)
    );

    let ctx = `\n🎓 GPA TỔNG QUAN:`;
    ctx += `\n  - LƯU Ý PHÂN TÍCH: Khung chương trình chuẩn của người dùng này là 4 Năm học (với 8 Học kỳ chính). Sinh viên có thể học thêm Học kỳ Phụ (Hè). Hãy linh hoạt lên lịch trình dựa vào số Tín học hiển thị dưới đây.`;
    ctx += `\n  - GPA Tích lũy: ${cumulativeData.gpa?.toFixed(2) || 'Chưa có'}`;
    ctx += `\n  - Xếp loại học lực: ${cumulativeData.academic_standing || 'Chưa xác định'}`;
    ctx += `\n  - Hạng tốt nghiệp dự báo: ${cumulativeData.graduation_projection || 'Chưa xác định'}`;
    ctx += `\n  - Tín chỉ tích lũy: ${cumulativeData.credits_accumulated} / ${cumulativeData.total_credits_required} TC`;
    ctx += `\n  - Mức cảnh báo: ${cumulativeData.warning_level || 'safe'}`;

    ctx += `\n\n📚 CHI TIẾT TỪNG HỌC KỲ (${semestersComputed.length} kỳ):`;
    semestersComputed.forEach(sem => {
        const semGPA = calculateSemesterGPA(sem.courses);
        const totalCredits = sem.courses.reduce((s, c) => s + c.credits, 0);
        ctx += `\n\n  --- ${sem.name} (${sem.academic_year}) - Năm ${sem.year_of_study} ---`;
        ctx += `\n  GPA Học kỳ: ${semGPA?.toFixed(2) || 'Chưa đủ điểm'} | TC: ${totalCredits}`;

        sem.courses.forEach(c => {
            const comp = c.computed || computeCourse(c);
            ctx += `\n    • ${c.name || 'Chưa đặt tên'} (${c.credits}TC, Template ${c.template}): `;
            if (comp.score10 != null) {
                ctx += `${comp.score10.toFixed(1)}/10 = ${comp.letterGrade} (${comp.grade4?.toFixed(1)}/4.0)`;
                if (!comp.passed) ctx += ' [KHÔNG ĐẠT]';
            } else {
                ctx += 'Chưa nhập đủ điểm';
            }
            if (c.exclude_from_gpa) ctx += ' [Không tính GPA]';
        });
    });

    return ctx;
}

export async function buildHabitContext(): Promise<string> {
    try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id;
        if (!uid) return '';

        const [habitsRes, logsRes] = await Promise.all([
            supabase.from('habits').select('*').eq('user_id', uid).eq('is_active', true),
            supabase.from('habit_logs').select('*,habits!inner(user_id)').eq('habits.user_id', uid).order('log_date', { ascending: false }).limit(200)
        ]);

        const habits: Habit[] = habitsRes.data || [];
        const logs: HabitLog[] = logsRes.data || [];

        if (habits.length === 0) return '\n🔥 THÓI QUEN: Chưa thiết lập thói quen nào';

        const today = new Date();
        today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
        const todayStr = today.toISOString().split('T')[0];

        let ctx = `\n🔥 THÓI QUEN (${habits.length} thói quen đang hoạt động):`;

        habits.forEach(h => {
            const habitLogs = logs.filter(l => l.habit_id === h.id);
            const completedLogs = habitLogs.filter(l => l.completed);
            const todayLog = habitLogs.find(l => l.log_date === todayStr);
            const totalDays = Math.max(1, Math.floor((new Date().getTime() - new Date(h.start_date).getTime()) / (1000 * 3600 * 24)));
            const completionRate = totalDays > 0 ? Math.round((completedLogs.length / totalDays) * 100) : 0;

            // Calculate current streak
            let currentStreak = 0;
            const sortedDates = completedLogs.map(l => l.log_date).sort().reverse();
            if (sortedDates.length > 0) {
                const cursor = new Date(todayStr);
                for (let i = 0; i < 365; i++) {
                    const key = cursor.toISOString().split('T')[0];
                    if (sortedDates.includes(key)) {
                        currentStreak++;
                        cursor.setDate(cursor.getDate() - 1);
                    } else {
                        break;
                    }
                }
            }

            ctx += `\n  - ${iconText(h.icon)}${h.title}: Streak ${currentStreak} ngày | Tỷ lệ: ${completionRate}% | Hôm nay: ${todayLog?.completed ? '✅' : '⬜'} | Tần suất: ${h.frequency} | Bắt đầu: ${h.start_date}`;
        });

        return ctx;
    } catch (e) {
        console.error('[SmartLife] Error building habit context:', e);
        return '\n🔥 THÓI QUEN: Lỗi hệ thống khi tải dữ liệu thói quen.';
    }
}

export async function buildCountdownContext(): Promise<string> {
    try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id;
        if (!uid) return '';

        const [cdRes, cuRes] = await Promise.all([
            supabase.from('countdown_items').select('*').eq('user_id', uid).order('target_date', { ascending: true }),
            supabase.from('countup_items').select('*').eq('user_id', uid).order('start_date', { ascending: false })
        ]);

        const countdowns: CountdownItem[] = cdRes.data || [];
        const countups: CountUpItem[] = cuRes.data || [];

        if (countdowns.length === 0 && countups.length === 0) return '\n⏳ ĐẾM NGƯỢC & ĐẾM TIẾN: Chưa thiết lập sự kiện nào';

        let ctx = '';
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (countdowns.length > 0) {
            ctx += `\n⏳ ĐẾM NGƯỢC (${countdowns.length} sự kiện):`;
            countdowns.forEach(c => {
                const target = new Date(c.target_date);
                target.setHours(0, 0, 0, 0);
                const daysLeft = Math.ceil((target.getTime() - today.getTime()) / (1000 * 3600 * 24));
                const status = daysLeft > 0 ? `còn ${daysLeft} ngày` : daysLeft === 0 ? 'HÔM NAY!' : `đã qua ${Math.abs(daysLeft)} ngày`;
                ctx += `\n  - ${iconText(c.icon)}${c.title}: ${status} (${c.target_date})`;
            });
        }

        if (countups.length > 0) {
            ctx += `\n📈 ĐẾM TIẾN (${countups.length} mốc):`;
            countups.forEach(c => {
                const start = new Date(c.start_date);
                start.setHours(0, 0, 0, 0);
                const daysPassed = Math.floor((today.getTime() - start.getTime()) / (1000 * 3600 * 24));
                ctx += `\n  - ${iconText(c.icon)}${c.title}: ${daysPassed} ngày (từ ${c.start_date})`;
            });
        }

        return ctx;
    } catch (e) {
        console.error('[SmartLife] Error building countdown context:', e);
        return '\n⏳ ĐẾM NGƯỢC & ĐẾM TIẾN: Lỗi hệ thống khi tải dữ liệu sự kiện.';
    }
}

export async function buildJournalContext(): Promise<string> {
    try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id;
        if (!uid) return '';

        const { data: entries, error } = await supabase
            .from('journal_entries')
            .select('entry_date, content, mood, gratitude')
            .eq('user_id', uid)
            .order('entry_date', { ascending: false })
            .limit(5);

        if (error) throw error;
        if (!entries || entries.length === 0) return '\n📔 NHẬT KÝ GẦN ĐÂY: Chưa có nhật ký nào được viết.';

        let ctx = `\n📔 NHẬT KÝ & CẢM XÚC GẦN ĐÂY (5 ngày gần nhất):`;
        entries.forEach(e => {
            const moodEmoji = e.mood === 1 ? '😢 Rất tệ' :
                e.mood === 2 ? '😟 Không tốt' :
                    e.mood === 3 ? '😐 Bình thường' :
                        e.mood === 4 ? '😊 Tốt' :
                            e.mood === 5 ? '🤩 Tuyệt vời' : 'Chưa ghi nhận';

            ctx += `\n  - Ngày ${e.entry_date} | Cảm xúc: ${moodEmoji}`;
            if (e.gratitude && Array.isArray(e.gratitude) && e.gratitude.length > 0) {
                const gratitudeFiltered = e.gratitude.filter(Boolean);
                if (gratitudeFiltered.length > 0) {
                    ctx += `\n    Biết ơn: ${gratitudeFiltered.join(', ')}`;
                }
            }
            if (e.content) {
                const excerpt = e.content.substring(0, 150).replace(/\n/g, ' ') + (e.content.length > 150 ? '...' : '');
                ctx += `\n    Nội dung: "${excerpt}"`;
            }
        });

        return ctx;
    } catch (e) {
        console.error('[SmartLife] Error building journal context:', e);
        return '\n📔 NHẬT KÝ GẦN ĐÂY: Lỗi hệ thống khi tải dữ liệu nhật ký.';
    }
}

export async function buildFullContextAsync(state: AppState): Promise<string> {
    const [habitCtx, countdownCtx, journalCtx] = await Promise.all([
        buildHabitContext(),
        buildCountdownContext(),
        buildJournalContext()
    ]);

    return [
        buildProfileContext(state),
        buildFinanceContext(state),
        buildGoalsContext(state),
        buildScheduleContext(state),
        buildGPAContext(state),
        habitCtx,
        countdownCtx,
        journalCtx,
    ].join('\n');
}

export function buildFullContext(state: AppState): string {
    return [
        buildProfileContext(state),
        buildFinanceContext(state),
        buildGoalsContext(state),
        buildScheduleContext(state),
        buildGPAContext(state),
    ].join('\n');
}

// ────────────────────────────────────────
// System Prompt
// ────────────────────────────────────────
// Prompt đầy đủ (giữ cho Insight nhanh). Trang chat dùng buildSystemPrompt() — chỉ nạp khối cần cho từng lượt.
export const SYSTEM_INSTRUCTION = LEGACY_SYSTEM_INSTRUCTION;

// ────────────────────────────────────────
// Core API Call — single model, but cycles API keys on 429
// ────────────────────────────────────────
export async function proxyHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
}

// Chờ có thể huỷ (bấm Dừng trong lúc đang chờ thử lại)
function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(new DOMException('Request aborted', 'AbortError'));
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Request aborted', 'AbortError'));
        }, { once: true });
    });
}

// Phân loại lỗi HTTP của proxy: trả về 'retry' nếu nên thử lại, còn lại ném lỗi có thông điệp dễ hiểu
async function handleProxyError(res: Response, retryCount: number): Promise<'retry'> {
    const err = await res.json().catch(() => ({}));
    const status = res.status;

    // Nếu là lỗi quota_exceeded từ proxy
    if (err?.error === 'quota_exceeded' || err?.type?.includes('exceeded') || err?.type?.includes('gate')) {
        throw new Error(err.message || 'Giới hạn sử dụng AI của bạn đã hết.');
    }

    // Hết credit Google AI (402), vượt spending cap (429) hoặc model trả lời quá lâu — thử lại cũng vô ích
    if (err?.type === 'provider_billing' || err?.type === 'provider_spending_cap' || err?.type === 'timeout') {
        throw new Error(err.message || err.error || `Gemini API Error ${status}`);
    }

    // Retry cho lỗi tạm thời (server đã xử lý key rotation) - chỉ retry nếu không phải lỗi quota
    if ((status === 429 || status === 500 || status === 503 || status === 504) && retryCount < 3) {
        console.warn(`[SmartLife] Proxy returned ${status}. Retrying (${retryCount + 1}/3)...`);
        return 'retry';
    }

    if (status === 429) {
        throw new Error(err?.message || err?.error || 'Hệ thống AI đang bị quá tải (429). Vui lòng đợi một lát rồi thử lại. 🔄');
    }

    console.error(`[SmartLife] Proxy Error ${status}:`, err);
    throw new Error(err?.error || `Gemini API Error ${status}`);
}

export async function callGeminiRaw(body: object, retryCount = 0, signal?: AbortSignal): Promise<any> {
    const res = await fetch(GEMINI_PROXY_URL, {
        method: 'POST',
        headers: await proxyHeaders(),
        body: JSON.stringify(body),
        signal,
    });

    if (!res.ok) {
        await handleProxyError(res, retryCount);
        await abortableDelay(2000 * (retryCount + 1), signal);
        return callGeminiRaw(body, retryCount + 1, signal);
    }

    return await res.json();
}

export interface StreamCallbacks {
    signal?: AbortSignal;
    onMeta?: (meta: StreamMeta) => void;
    /** Mỗi gói JSON của Gemini (đã parse) — dùng để hiện chữ / suy nghĩ ngay khi tới */
    onChunk?: (chunk: any) => void;
}

// Gọi proxy với stream: true (Server-Sent Events). Chỉ thử lại khi stream CHƯA bắt đầu;
// lỗi giữa chừng (event: error) được ném ra để phía trên giữ phần chữ đã nhận.
export async function streamGeminiRaw(body: object, cb: StreamCallbacks = {}, retryCount = 0): Promise<{ meta: StreamMeta | null; usageMetadata: any }> {
    const { signal, onMeta, onChunk } = cb;
    const res = await fetch(GEMINI_PROXY_URL, {
        method: 'POST',
        headers: await proxyHeaders(),
        body: JSON.stringify({ ...body, stream: true }),
        signal,
    });

    if (!res.ok) {
        await handleProxyError(res, retryCount);
        await abortableDelay(2000 * (retryCount + 1), signal);
        return streamGeminiRaw(body, cb, retryCount + 1);
    }

    let meta: StreamMeta | null = null;
    let usageMetadata: any = null;

    // Proxy cũ / môi trường không stream được → trả JSON thường, coi như một gói duy nhất
    const contentType = res.headers.get('Content-Type') || '';
    if (!contentType.includes('text/event-stream') || !res.body) {
        const data = await res.json();
        const model = res.headers.get('X-SmartLife-Model');
        if (model) {
            meta = { model, tier: res.headers.get('X-SmartLife-Tier') || 'legacy', weight: Number(res.headers.get('X-SmartLife-Weight') || 1) };
            onMeta?.(meta);
        }
        onChunk?.(data);
        return { meta, usageMetadata: data?.usageMetadata ?? null };
    }

    let streamError: Error | null = null;
    const parser = createSseParser(({ event, data }) => {
        let payload: any;
        try {
            payload = JSON.parse(data);
        } catch {
            return;
        }
        if (event === 'meta') {
            meta = payload;
            onMeta?.(payload);
        } else if (event === 'error') {
            streamError = new Error(payload?.message || payload?.error || 'Mất kết nối với AI giữa chừng.');
        } else if (event === 'done') {
            if (payload?.usageMetadata) usageMetadata = payload.usageMetadata;
        } else {
            if (payload?.usageMetadata) usageMetadata = payload.usageMetadata;
            onChunk?.(payload);
        }
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            parser.push(decoder.decode(value, { stream: true }));
            if (streamError) break;
        }
        parser.push(decoder.decode());
        parser.flush();
    } finally {
        reader.releaseLock?.();
    }

    if (streamError) throw streamError;
    return { meta, usageMetadata };
}

// Helper to estimate token usage cost in VND
export function estimateGeminiCost(promptTokens: number, candidatesTokens: number, model: string = 'gemini-2.5-flash'): number {
    const USD_TO_VND = 25400;
    // Pricing for Gemini 2.5 Flash / Gemini 2.0 Flash
    let inputPricePerMillion = 0.075;
    let outputPricePerMillion = 0.30;

    if (model.includes('pro')) {
        inputPricePerMillion = 1.25;
        outputPricePerMillion = 5.00;
    }

    const costUsd = (promptTokens * inputPricePerMillion + candidatesTokens * outputPricePerMillion) / 1000000;
    return costUsd * USD_TO_VND;
}

// ────────────────────────────────────────
// Router của chế độ Auto: phân loại bằng model siêu nhanh (tầng lite, purpose 'router' → không tính lượt).
// Trước đây không gửi tier nên rơi về model cũ gemini-2.5-flash có suy nghĩ → chậm hơn cần thiết.
// ────────────────────────────────────────
export async function callRouterModel(prompt: string, signal?: AbortSignal): Promise<string> {
    const data = await callGeminiRaw({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 256, responseMimeType: 'application/json' },
        purpose: 'router',
        tier: 'lite',
    }, 0, signal);
    const parts = data?.candidates?.[0]?.content?.parts || [];
    return parts.filter((p: any) => typeof p.text === 'string' && !p.thought).map((p: any) => p.text).join('');
}

// ────────────────────────────────────────
// Lời chào chủ động của Bạn đồng hành (purpose 'greeting', tầng fast không suy nghĩ, không tính lượt; mỗi ngày tối đa 1 lần)
// ────────────────────────────────────────
export async function callGreetingModel(systemPrompt: string, signal?: AbortSignal): Promise<string> {
    const data = await callGeminiRaw({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: '(người dùng vừa mở ứng dụng)' }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 200 },
        purpose: 'greeting',
        tier: 'fast',
    }, 0, signal);
    const parts = data?.candidates?.[0]?.content?.parts || [];
    return parts.filter((p: any) => typeof p.text === 'string' && !p.thought).map((p: any) => p.text).join('').trim();
}

// ────────────────────────────────────────
// Simple chat (backward compat for Quick Insight — no function calling)
// ────────────────────────────────────────
export async function chatWithGeminiSimple(
    history: ChatMessage[],
    appState: AppState
): Promise<string> {
    // Phase 5 Context Optimization: For quick insight (strictly financial summary),
    // we only need profile and finance data. Avoid sending GPA, schedule, and goals context to save tokens.
    const profileText = buildProfileContext(appState);
    const financeText = buildFinanceContext(appState);
    const contextText = [profileText, financeText].join('\n');

    const body = {
        systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION + '\n\n--- DỮ LIỆU TÀI CHÍNH NGƯỜI DÙNG ---\n' + contextText }]
        },
        contents: history.map(m => ({ role: m.role, parts: m.parts })),
        generationConfig: { temperature: 0.7, topP: 0.95, topK: 40, maxOutputTokens: 1024 }, // Optimized from 2048 to 1024
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
    };

    return enqueue(async () => {
        const data = await callGeminiRaw(body);

        // Log token usage for quick insight with detailed token tracking (Phase 1)
        if (data?.usageMetadata?.totalTokenCount) {
            supabase.auth.getUser().then(({ data: authData }) => {
                const uid = authData?.user?.id;
                if (!uid) return;
                supabase.from('api_logs').insert([{
                    user_id: uid,
                    action: 'insight',
                    tokens_used: data.usageMetadata.totalTokenCount,
                    prompt_tokens: data.usageMetadata.promptTokenCount || 0,
                    candidates_tokens: data.usageMetadata.candidatesTokenCount || 0,
                    thoughts_tokens: data.usageMetadata.thoughtsTokenCount || data.usageMetadata.thinkingTokenCount || 0,
                    estimated_cost_vnd: estimateGeminiCost(data.usageMetadata.promptTokenCount || 0, data.usageMetadata.candidatesTokenCount || 0),
                    model: 'gemini-2.5-flash'
                }]).then(({ error }) => {
                    if (error) console.error('[SmartLife] ❌ Insight token log failed:', error.message);
                    else console.info(`[SmartLife] ✅ Logged ${data.usageMetadata.totalTokenCount} insight tokens`);
                });
            });
        }

        return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Không nhận được phản hồi từ AI.';
    });
}

// ────────────────────────────────────────
// Quick Insight — cached, no function calling
// ────────────────────────────────────────
interface InsightCache { text: string; timestamp: number; monthKey: string; }
let _insightCache: InsightCache | null = null;
const INSIGHT_CACHE_TTL = 30 * 60 * 1000; // 30 phút

// Fallback insight khi API không khả dụng
function generateLocalInsight(appState: AppState): string {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthTx = appState.transactions.filter(t => t.date.startsWith(currentMonth));
    const income = monthTx.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
    const expense = monthTx.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
    const remaining = income - expense;

    if (monthTx.length === 0) return '📊 Chưa có giao dịch nào trong tháng này. Hãy bắt đầu theo dõi chi tiêu nhé!';

    return `📊 **Tháng ${now.getMonth() + 1}**: Thu nhập ${formatCurrency(income)}, chi tiêu ${formatCurrency(expense)}. Dôi dư: ${formatCurrency(remaining)} (${income > 0 ? Math.round((remaining / income) * 100) : 0}%). Hãy hỏi AI để được phân tích chi tiết!`;
}

export async function generateQuickInsight(appState: AppState): Promise<string> {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (_insightCache && _insightCache.monthKey === monthKey && Date.now() - _insightCache.timestamp < INSIGHT_CACHE_TTL) {
        console.info('[SmartLife] Quick insight served from cache');
        return _insightCache.text;
    }

    try {
        const messages: ChatMessage[] = [{
            role: 'user',
            parts: [{ text: 'Hãy tóm tắt tình hình tài chính của tôi tháng này trong 3-4 dòng ngắn gọn. Hãy gọi phần "thu nhập trừ đi chi tiêu" là "số tiền dôi dư" hoặc "còn lại", TUYỆT ĐỐI KHÔNG gọi nó là "tiết kiệm" (vì quỹ tiết kiệm là riêng). Nêu điểm tốt và điểm cần cải thiện.' }]
        }];
        const result = await chatWithGeminiSimple(messages, appState);
        _insightCache = { text: result, timestamp: Date.now(), monthKey };
        return result;
    } catch {
        // API không khả dụng → tạo insight từ dữ liệu local
        return generateLocalInsight(appState);
    }
}
