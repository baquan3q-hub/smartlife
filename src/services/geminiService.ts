// File: src/services/geminiService.ts
// Gemini API client for SmartLife AI Advisor v2
// — Single model, direct call (no fallback/retry)

import { AppState, TransactionType, GPATemplateType } from '../types';
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
const envKeys = (import.meta as any).env?.VITE_GEMINI_API_KEYS || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
const API_KEYS = envKeys.split(',').map((k: string) => k.trim()).filter(Boolean);
let currentKeyIndex = 0;

// Model thống nhất duy nhất
const MODEL = 'gemini-flash-latest';

function getGeminiUrl(): string {
    const key = API_KEYS[currentKeyIndex % API_KEYS.length] || '';
    return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
}

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
    | { functionResponse: { name: string; response: { result: any } } };

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

function buildFinanceContext(state: AppState): string {
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
        .slice(0, 10)
        .map(t => `  - ${t.date}: ${t.type === TransactionType.INCOME ? '+' : '-'}${formatCurrency(t.amount)} [${t.category}]${t.description ? ` "${t.description}"` : ''}`)
        .join('\n');

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

📈 XU HƯỚNG 6 THÁNG:
${monthlyTrend.join('\n')}

🧾 10 GIAO DỊCH GẦN NHẤT:
${recentTx || '  (Chưa có giao dịch)'}`;
}

function buildGoalsContext(state: AppState): string {
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

function buildScheduleContext(state: AppState): string {
    const { todos, timetable } = state;
    let ctx = '';
    const pending = (todos || []).filter(t => !t.is_completed);
    const done = (todos || []).filter(t => t.is_completed);

    if (pending.length > 0 || done.length > 0) {
        ctx += `\n📋 CÔNG VIỆC: ${done.length}/${(todos || []).length} hoàn thành\n`;
        pending.slice(0, 8).forEach(t => {
            ctx += `  - ⬜ ${t.content} [${t.priority}]${t.deadline ? ` (Hạn: ${new Date(t.deadline).toLocaleDateString('vi-VN')})` : ''}\n`;
        });
        done.slice(0, 3).forEach(t => { ctx += `  - ✅ ${t.content}\n`; });
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

function buildProfileContext(state: AppState): string {
    const { profile } = state;
    if (!profile) return '';
    let ctx = '\n👤 HỒ SƠ NGƯỜI DÙNG:\n';
    if (profile.full_name) ctx += `  - Tên: ${profile.full_name}\n`;
    if (profile.age) ctx += `  - Tuổi: ${profile.age}\n`;
    if (profile.job) ctx += `  - Nghề nghiệp: ${profile.job}\n`;
    if (profile.monthly_salary) ctx += `  - Thu nhập hàng tháng: ${formatCurrency(profile.monthly_salary)}\n`;
    if (profile.savings_goal) ctx += `  - Mục tiêu tiết kiệm: ${formatCurrency(profile.savings_goal)}\n`;
    return ctx;
}

function buildGPAContext(state: AppState): string {
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

NGUYÊN TẮC:
1. Luôn phân tích dựa trên DỮ LIỆU THỰC của người dùng (được cung cấp bên dưới hoặc qua tool query_database).
2. Trả lời bằng tiếng Việt, ngắn gọn, dùng emoji phù hợp.
3. Khi phân tích chi tiêu: so sánh với ngân sách, chỉ ra danh mục chi nhiều nhất, đề xuất cắt giảm cụ thể.
4. Khi dự đoán: dựa trên xu hướng 6 tháng, đưa ra con số cụ thể.
5. Khi tư vấn mục tiêu: tính toán cần tiết kiệm bao nhiêu/tháng để đạt mục tiêu đúng hạn.
6. ƯU TIÊN dùng bảng (Table Markdown và biểu đồ cột ) để trình bày danh sách hoặc so sánh số liệu thực tế vs dự đoán.
7. Khi vẽ biểu đồ, CHỈ DÙNG biểu đồ cột (bar) hoặc đường (line) qua tool call. TUYỆT ĐỐI KHÔNG vẽ biểu đồ tròn (pie).
8. Khi người dùng yêu cầu dự đoán chi tiêu: phân tích mức chi tiêu trung bình các tháng trước, tính độ lệch và đưa ra dự đoán số tiền cho các tháng tới bằng một bảng (table) rõ ràng.
9. Khi người dùng yêu cầu thêm lịch/việc/giao dịch, dùng tool tương ứng.
10. Giọng điệu chuyên nghiệp, ngắn gọn. Đầu ra phải dễ đọc trên giao diện mobile (tránh viết văn quá dài).
11. Dùng tool \`query_database\` để tính toán tổng số tiền khi cần thiết, đừng tự bịa số.

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
- Dùng tool \`calculate_needed_gpa\` và \`simulate_gpa\` khi cần tính toán.`;

// ────────────────────────────────────────
// Core API Call — single model, but cycles API keys on 429
// ────────────────────────────────────────
export async function callGeminiRaw(body: object, retryCount = 0): Promise<any> {
    const url = getGeminiUrl();

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const status = res.status;

        if (status === 429) {
            // Key bị limit -> đổi sang key tiếp theo nếu còn key khác
            if (API_KEYS.length > 1 && retryCount < API_KEYS.length) {
                currentKeyIndex++;
                console.warn(`[SmartLife] Key limit reached (429). Switching to key #${(currentKeyIndex % API_KEYS.length) + 1}...`);
                return callGeminiRaw(body, retryCount + 1);
            }
            throw new Error('Hệ thống AI đang bị quá tải (429). Đã hết sạch khóa dự phòng. Vui lòng đợi 1 phút. 🔄');
        }
        if (status === 503) {
            throw new Error('Dịch vụ AI tạm thời không khả dụng (503). Vui lòng thử lại sau. 🔄');
        }

        console.error(`[SmartLife] ${MODEL} Error ${status}:`, err);
        throw new Error(err?.error?.message || `Gemini API Error ${status}`);
    }

    return await res.json();
}

// ────────────────────────────────────────
// Simple chat (backward compat for Quick Insight — no function calling)
// ────────────────────────────────────────
export async function chatWithGeminiSimple(
    history: ChatMessage[],
    appState: AppState
): Promise<string> {
    const contextText = buildFullContext(appState);
    const body = {
        systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION + '\n\n--- DỮ LIỆU NGƯỜI DÙNG ---\n' + contextText }]
        },
        contents: history.map(m => ({ role: m.role, parts: m.parts })),
        generationConfig: { temperature: 0.7, topP: 0.95, topK: 40, maxOutputTokens: 2048 },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
    };

    return enqueue(async () => {
        const data = await callGeminiRaw(body);
        
        // Log token usage for quick insight
        if (data?.usageMetadata?.totalTokenCount) {
            supabase.auth.getUser().then(({ data: authData }) => {
                const uid = authData?.user?.id;
                if (!uid) return;
                supabase.from('api_logs').insert([{
                    user_id: uid,
                    action: 'insight',
                    tokens_used: data.usageMetadata.totalTokenCount
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
