// File: src/services/geminiService.ts
// Gemini API client for SmartLife AI Advisor v2
// — Single model, direct call (no fallback/retry)

import { AppState, TransactionType } from '../types';

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

export function buildFullContext(state: AppState): string {
    return [
        buildProfileContext(state),
        buildFinanceContext(state),
        buildGoalsContext(state),
        buildScheduleContext(state),
    ].join('\n');
}

// ────────────────────────────────────────
// System Prompt
// ────────────────────────────────────────
export const SYSTEM_INSTRUCTION = `Bạn là **SmartLife Advisor** — trợ lý AI chuyên tư vấn tài chính cá nhân và quản lý cuộc sống.

NGUYÊN TẮC:
1. Luôn phân tích dựa trên DỮ LIỆU THỰC của người dùng (được cung cấp bên dưới hoặc qua tool query_database).
2. Trả lời bằng tiếng Việt, ngắn gọn, dùng emoji phù hợp.
3. Khi phân tích chi tiêu: so sánh với ngân sách, chỉ ra danh mục chi nhiều nhất, đề xuất cắt giảm cụ thể.
4. Khi dự đoán: dựa trên xu hướng 6 tháng, đưa ra con số cụ thể.
5. Khi tư vấn mục tiêu: tính toán cần tiết kiệm bao nhiêu/tháng để đạt mục tiêu đúng hạn.
6. ƯU TIÊN dùng bảng (Table Markdown và biểu đồ cột ) để trình bày danh sách hoặc so sánh số liệu thực tế vs dự đoán.
7. Khi vẽ biểu đồ, CHỈ DÙNG biểu đồ cột (bar) hoặc đường (line) qua tool call. TUYỆT ĐỐI KHÔNG vẽ biểu đồ tròn (pie). Nếu người dùng yêu cầu biểu đồ tròn, hãy từ chối khéo và thay bằng bảng hoặc biểu đồ cột.
8. Khi người dùng yêu cầu dự đoán chi tiêu: phân tích mức chi tiêu trung bình các tháng trước, tính độ lệch và đưa ra dự đoán số tiền cho các tháng tới bằng một bảng (table) rõ ràng.
9. Khi người dùng yêu cầu thêm lịch/việc/giao dịch, dùng tool tương ứng.
10. Giọng điệu chuyên nghiệp, ngắn gọn. Đầu ra phải dễ đọc trên giao diện mobile (tránh viết văn quá dài).
11. Dùng tool \`query_database\` để tính toán tổng số tiền khi cần thiết, đừng tự bịa số.`;

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
