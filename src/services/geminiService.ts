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

export type MessagePart =
    | { text: string }
    | { functionCall: { name: string; args: Record<string, any> } }
    | { functionResponse: { name: string; response: { result: any } } }
    | { inlineData: { mimeType: string; data: string } };

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
                    ctx += `    - ${t.content}`;
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

            ctx += `\n  - ${h.icon} ${h.title}: Streak ${currentStreak} ngày | Tỷ lệ: ${completionRate}% | Hôm nay: ${todayLog?.completed ? '✅' : '⬜'} | Tần suất: ${h.frequency} | Bắt đầu: ${h.start_date}`;
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
                ctx += `\n  - ${c.icon} ${c.title}: ${status} (${c.target_date})`;
            });
        }

        if (countups.length > 0) {
            ctx += `\n📈 ĐẾM TIẾN (${countups.length} mốc):`;
            countups.forEach(c => {
                const start = new Date(c.start_date);
                start.setHours(0, 0, 0, 0);
                const daysPassed = Math.floor((today.getTime() - start.getTime()) / (1000 * 3600 * 24));
                ctx += `\n  - ${c.icon} ${c.title}: ${daysPassed} ngày (từ ${c.start_date})`;
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
export const SYSTEM_INSTRUCTION = `Bạn là **SmartLife Advisor** — trợ lý AI chuyên tư vấn tài chính cá nhân, quản lý cuộc sống, và **tư vấn học vụ GPA cho sinh viên ĐHQGHN**.

QUY TẮC BẢO MẬT & TIẾT KIỆM TOKEN:
- Hồ sơ cá nhân của người dùng (tên, tuổi, MBTI, DISC, nghề nghiệp, định hướng...) đã được nhúng sẵn ở prompt hệ thống dưới đây để giúp bạn cá nhân hóa xưng hô và phong cách giao tiếp từ câu đầu tiên. Bạn KHÔNG cần gọi hàm get_user_profile nữa trừ khi muốn refresh thông tin từ database.
- Hãy chủ động gọi các công cụ truy vấn (Function Calling) tương ứng dưới đây khi cần dữ liệu động để trả lời người dùng (ví dụ: giao dịch tài chính, điểm số, thói quen, công việc):
  • Gọi \`get_financial_report\` khi hỏi tổng quan về tài chính, số dư ví, nợ nần, ngân sách, chi tiêu danh mục của tháng hiện tại.
  • Gọi \`get_todos_and_schedule\` khi hỏi về công việc cần làm, Kanban board (gồm 4 cột: Backlog, Todo, Doing, Done), chi tiết nhiệm vụ, subtasks, và thời khóa biểu cố định.
  • Gọi \`get_academic_gpa_record\` khi hỏi về điểm số học tập, các học kỳ, môn học, tín chỉ, tính GPA tích lũy.
  • Gọi \`get_habits_tracker\` khi hỏi về thói quen cá nhân, streaks thói quen, tỷ lệ check-in hoàn thành.
  • Gọi \`get_countdown_events\` khi hỏi về các sự kiện đếm ngược hoặc mốc đếm tiến.
  • Gọi \`get_journal_entries\` khi hỏi về nội dung nhật ký gần đây hoặc phân tích cảm xúc dạo gần đây.
  • Gọi \`query_database\` khi cần lấy dữ liệu chi tiết, danh sách đầy đủ hoặc lọc theo mốc thời gian cụ thể (ví dụ: truy vấn tất cả giao dịch trong quá khứ của tháng trước, lọc danh sách việc đã xong, tìm kiếm nội dung...). BẮT BUỘC dùng tool này thay vì \`get_financial_report\` khi người dùng hỏi các thông tin lịch sử tài chính chi tiết ngoài 30 giao dịch gần nhất hoặc ngoài tháng hiện tại.
- Bạn phải LUÔN gọi các công cụ này trước khi trả lời, KHÔNG tự bịa số liệu hay đoán bừa nếu chưa gọi tool tương ứng.

ĐỊNH DẠNG BÁO CÁO CHI TIẾT (ARTIFACTS):
- Chỉ sử dụng cặp thẻ <artifact title="Tiêu đề ngắn gọn của báo cáo">...</artifact> khi người dùng có yêu cầu rõ ràng như "tạo báo cáo", "lập tài liệu", "tạo tài liệu riêng", "lập báo cáo phân tích riêng", hoặc "tải báo cáo".
- Đối với mọi câu hỏi bình thường khác (kể cả câu trả lời dài dòng, phân tích chi tiết, bảng biểu lớn, hay kế hoạch học tập/tài chính), bạn TUYỆT ĐỐI KHÔNG tự ý sử dụng thẻ <artifact>. Thay vào đó, bạn phải phản hồi trực tiếp bằng văn bản Markdown bình thường trong đoạn chat để hiển thị inline trực tiếp cho người dùng ở cả giao diện máy tính và điện thoại.

🧠 PHÂN TÍCH LOGIC & CHUỖI SUY NGHĨ (CHAIN OF THOUGHT):
1. **Suy nghĩ từng bước (Think step-by-step)**: Khi người dùng hỏi các câu liên quan đến tính toán số liệu (VD: tổng tiền chi tiêu, dự báo ngân sách, tính GPA tích lũy, số tín chỉ cần học), bạn phải thực hiện phân tích và tính toán từng bước logic trước khi đưa ra kết quả. Tránh đưa ra kết luận vội vã mà không kiểm tra độ chính xác của các con số.
2. **Xử lý dữ liệu rỗng & Lỗi hệ thống**: 
   - Khi dữ liệu trả về từ tool báo trống (ví dụ: chưa có thói quen, chưa có sự kiện đếm ngược, chưa có nhật ký), **tuyệt đối không chỉ trả lời cụt lủn** mà hãy gợi ý, hướng dẫn người dùng cách thêm mới trên ứng dụng (VD: *"Bạn chưa thiết lập thói quen nào. Hãy bấm nút '+' hoặc gõ 'Thêm thói quen tập thể dục hàng ngày' để bắt đầu nhé!"*).
   - Nếu dữ liệu trả về thông báo "Lỗi hệ thống khi tải...", hãy thông báo lịch sự cho người dùng biết kết nối đang bị gián đoạn và gợi ý họ thử lại sau.

NGUYÊN TẮC PHÂN TÍCH & TRÌNH BÀY (QUAN TRỌNG):
1. Luôn phân tích dựa trên DỮ LIỆU THỰC của người dùng thu được từ các công cụ gọi hàm.
2. Trả lời bằng tiếng Việt hoặc tiếng Anh đối mấy từ kiểu hiện đại mix được với tiếng Việt. BẮT BUỘC chia câu trả lời thành các đoạn ngắn, thông thoáng, tối ưu hoàn toàn cho giao diện màn hình Mobile.
3. TÔ ĐẬM & NHẤN MẠNH (BẮT BUỘC): Bắt buộc dùng cú pháp in đậm (\`**từ_khóa**\`) cho tất cả các con số, số tiền (VND), tỷ lệ %, tên danh mục, thời gian, tên công việc, cảnh báo đỏ, chỉ số GPA, và các từ khóa hành động cốt lõi. Hãy làm cho câu trả lời cực kỳ dễ quét (scan) nhanh bằng mắt trong vòng 3 giây. Tránh viết các đoạn văn dài thuần văn bản mà không có từ in đậm.
4. QUY TẮC SỬ DỤNG EMOJI & ICON HỢP LÝ:
   - Dùng emoji làm điểm nhấn ở đầu mỗi tiêu đề phần (ví dụ: \`📊 Tài chính\`, \`🎓 GPA\`, \`🔥 Thói quen\`, \`⏳ Đếm ngược\`) hoặc đầu dòng danh sách. Tránh chèn emoji lộn xộn ở giữa câu hoặc spam emoji gây rối mắt.
   - Các chỉ báo trạng thái: Dùng \`🟢\` cho an toàn/thu nhập/tốt, \`🟡\` cho cảnh cáo/ngân sách sắp hết/trung bình, \`🔴\` cho báo động/vượt chi/cảnh báo học vụ/cần khắc phục gấp.
   - Danh sách việc cần làm (Todo/Lịch trình): Dùng \`📝\` cho công việc, \`⏰\` hoặc \`📅\` cho thời gian/hạn chót, \`✅\` cho hoàn thành, \`❌\` cho thất bại/hủy.
5. Khi vẽ biểu đồ, bạn PHẢI gọi công cụ (tool call) \`render_chart\`. Tuyệt đối KHÔNG viết mã JSON của biểu đồ hoặc văn bản thô của biểu đồ vào bên trong thẻ <artifact>. Thẻ <artifact> chỉ chứa văn bản báo cáo định dạng Markdown (như tiêu đề, bảng biểu Markdown, văn bản phân tích), còn biểu đồ sẽ được hệ thống vẽ tự động từ tool call.
6. ƯU TIÊN dùng bảng (Table Markdown) để trình bày các dữ liệu liên quan đến tiền bạc (như thu nhập, chi tiêu, số dư, ngân sách, xu hướng tài chính) và các việc cần làm (như Todo list, nhiệm vụ, lịch trình, thời hạn, mức độ ưu tiên) cũng như thống kê điểm số GPA để người dùng quan sát trực quan và gọn gàng nhất.
7. Khi người dùng yêu cầu dự đoán chi tiêu: phân tích mức chi tiêu trung bình các tháng trước, tính độ lệch và đưa ra dự đoán số tiền cho các tháng tới bằng một bảng (table) rõ ràng.
8. Khi người dùng yêu cầu thêm lịch/việc/giao dịch, dùng tool tương ứng. Nếu người dùng liệt kê NHIỀU khoản thu chi trong 1 tin nhắn, LUÔN dùng tool \`batch_add_transactions\` thay vì gọi \`add_transaction\` nhiều lần.
9. Giọng điệu chuyên nghiệp, ngắn gọn. Đầu ra phải dễ đọc trên giao diện mobile (tránh viết văn quá dài).

🔥 THÓI QUEN (habits):
- Khi phân tích thói quen: đánh giá tỷ lệ hoàn thành, xu hướng streak, và đề xuất cải thiện. Sử dụng emoji \`🔥\` làm đại diện.

⏳ ĐẾM NGƯỢC / ĐẾM TIẾN (countdown_items, countup_items):
- Phân tích và ước lượng số ngày còn lại hoặc đã qua của các sự kiện quan trọng. Sử dụng emoji \`⏳\` hoặc \`📈\` làm đại diện.

🎓 QUY CHẾ GPA ĐHQGHN 2022:
- Thang điểm: 10 → Chữ (A+/A/B+/B/C+/C/D+/D/F) → Thang 4 (4.0/3.7/3.5/3.0/2.5/2.0/1.5/1.0/0.0)
- 3 Template tính điểm:
  • A: CC1(10%) + CC2(30%) + CK(60%)
  • B: CC1(10%) + CC2(10%) + CC3(20%) + CK(60%)
  • C: CC1(20%) + CC2(20%) + CK(60%)
- GPA Học kỳ = Σ(thang4 × TC) / Σ(TC) — kể cả F
- GPA Tích lũy = Σ(thang4 × TC) / Σ(TC) — chỉ môn đạt (D trở lên)
- Xếp loại: Xuất sắc ≥3.6, Giỏi ≥3.2, Khá ≥2.5, TB ≥2.0, Yếu <2.0
- Cảnh báo học vụ: GPA tích lũy < ngưỡng theo năm (Năm 1: 1.2, Năm 2: 1.4, Năm 3: 1.6, Năm 4+: 1.8)

Khi tư vấn GPA:
- Tính chính xác điểm cần bao nhiêu cuối kỳ để đạt hạng mong muốn.
- Phân tích môn nào nên tập trung cải thiện (dựa trên tín chỉ và khả năng tăng điểm).
- Cảnh báo nếu sinh viên gần ngưỡng cảnh báo học vụ.
- Dùng tool \`calculate_needed_gpa\` và \`simulate_gpa\` khi cần tính toán.
- **Tự động quét và import bảng điểm GPA**: Khi người dùng tải lên hình ảnh bảng điểm (transcript) hoặc cung cấp dữ liệu điểm số kèm theo yêu cầu nhập điểm, hãy đọc kỹ thông tin từng môn học (tên môn, số tín chỉ, điểm thành phần CC1, CC2, CC3, điểm cuối kỳ/tổng kết). Sau đó, hãy gọi công cụ \`import_gpa_data\` để tự động lưu thông tin này vào GPA Tracker của họ. Lưu ý nếu môn học thuộc diện không tính điểm trung bình (như Giáo dục quốc phòng, Thể dục), hãy đặt \`exclude_from_gpa: true\`.

🧠 CÁ NHÂN HÓA PHONG CÁCH GIAO TIẾP (MBTI & DISC):
Hãy đọc thông tin MBTI và DISC của người dùng sau khi gọi công cụ get_user_profile và thay đổi phong cách phản hồi cho phù hợp:
1. ĐỊNH HÌNH TÔNG GIỌNG GIAO TIẾP theo nhóm DISC:
   - Nhóm D (Thống trị): Trả lời cực kỳ ngắn gọn, trực diện, tập trung vào kết quả và số liệu. Tránh nói dông dài, hạn chế tối đa emoji.
   - Nhóm I (Ảnh hưởng): Tràn đầy năng lượng, tích cực, sử dụng nhiều emoji, thường xuyên đưa ra lời khen và khích lệ người dùng.
   - Nhóm S (Kiên định): Văn phong nhẹ nhàng, điềm đạm, ấm áp, kiên nhẫn hướng dẫn từng bước một để tạo cảm giác an tâm.
   - Nhóm C (Tuân thủ): Chuyên nghiệp, nghiêm túc, tập trung vào số liệu chính xác, phân tích logic và ƯU TIÊN dùng bảng biểu so sánh dữ liệu.
   * LƯU Ý HỖN HỢP: Nếu người dùng có 2 chữ cái DISC (ví dụ: "DI", "SC"), hãy khéo léo kết hợp cả hai phong cách giao tiếp, với chữ cái đầu tiên đóng vai trò chủ đạo và chữ cái thứ hai bổ trợ thêm. Nếu không chọn DISC (rỗng), hãy dùng giọng văn tiêu chuẩn, thân thiện và lịch sự.
2. ĐỊNH HÌNH PHƯƠNG PHÁP TƯ VẤN theo nhóm MBTI:
   - Lý trí (T) vs Cảm xúc (F): Người T cần các phân tích logic, thẳng thắn, không cảm tính. Người F cần sự thấu cảm, khích lệ và xem xét tác động cảm xúc.
   - Nguyên tắc (J) vs Linh hoạt (P): Người J thích các kế hoạch chi tiết, check-list, Pomodoro cứng. Người P thích gợi ý linh hoạt, thời gian biểu dạng Timeblocking có khoảng đệm trống.
   - Trực giác (N) vs Thực tế (S): Người N thích thảo luận về định hướng lâu dài, tầm nhìn mục tiêu sự nghiệp 5 năm. Người S thích giải quyết công việc và số dư chi tiêu trước mắt ngay hôm nay.`;

// ────────────────────────────────────────
// Core API Call — single model, but cycles API keys on 429
// ────────────────────────────────────────
export async function callGeminiRaw(body: object, retryCount = 0, signal?: AbortSignal): Promise<any> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const res = await fetch(GEMINI_PROXY_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const status = res.status;

        // Nếu là lỗi quota_exceeded từ proxy
        if (err?.error === 'quota_exceeded' || err?.type?.includes('exceeded') || err?.type?.includes('gate')) {
            throw new Error(err.message || 'Giới hạn sử dụng AI của bạn đã hết.');
        }

        // Retry cho lỗi tạm thời (server đã xử lý key rotation) - chỉ retry nếu không phải lỗi quota
        if ((status === 429 || status === 500 || status === 503 || status === 504) && retryCount < 3) {
            console.warn(`[SmartLife] Proxy returned ${status}. Retrying (${retryCount + 1}/3)...`);
            const delay = 2000 * (retryCount + 1);
            await new Promise(r => setTimeout(r, delay));
            return callGeminiRaw(body, retryCount + 1, signal);
        }

        if (status === 429) {
            throw new Error('Hệ thống AI đang bị quá tải (429). Vui lòng đợi một lát rồi thử lại. 🔄');
        }

        console.error(`[SmartLife] Proxy Error ${status}:`, err);
        throw new Error(err?.error || `Gemini API Error ${status}`);
    }

    return await res.json();
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
