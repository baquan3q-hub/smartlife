// File: src/services/geminiService.ts
// Gemini 1.5 Flash — Direct frontend API client for SmartLife AI Advisor

import { AppState, TransactionType } from '../types';

const GEMINI_API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ────────────────────────────────────────
// Types
// ────────────────────────────────────────
export interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

// ────────────────────────────────────────
// Context Builder — Turns AppState into a rich text prompt
// ────────────────────────────────────────
function formatCurrency(amount: number): string {
    return amount.toLocaleString('vi-VN') + 'đ';
}

function buildFinanceContext(state: AppState): string {
    const { transactions, budgets, currentBalance } = state;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Current month transactions
    const monthTx = transactions.filter(t => t.date.startsWith(currentMonth));
    const income = monthTx.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
    const expense = monthTx.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);

    // Category breakdown
    const categoryMap = new Map<string, number>();
    monthTx.filter(t => t.type === TransactionType.EXPENSE).forEach(t => {
        categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + t.amount);
    });
    const categoryBreakdown = Array.from(categoryMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amt]) => `  - ${cat}: ${formatCurrency(amt)} (${((amt / (expense || 1)) * 100).toFixed(0)}%)`)
        .join('\n');

    // Budget status
    const budgetStatus = budgets
        .filter(b => b.month === currentMonth)
        .map(b => {
            const spent = monthTx
                .filter(t => t.type === TransactionType.EXPENSE && t.category === b.category)
                .reduce((s, t) => s + t.amount, 0);
            const pct = Math.round((spent / b.amount) * 100);
            const status = pct > 100 ? '🔴 VƯỢT' : pct > 80 ? '🟡 SẮP HẾT' : '🟢 OK';
            return `  - ${b.category}: ${formatCurrency(spent)}/${formatCurrency(b.amount)} (${pct}%) ${status}`;
        })
        .join('\n');

    // Last 6 months trend
    const monthlyTrend: string[] = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const mIncome = transactions.filter(t => t.date.startsWith(mKey) && t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
        const mExpense = transactions.filter(t => t.date.startsWith(mKey) && t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
        monthlyTrend.push(`  - T${d.getMonth() + 1}/${d.getFullYear()}: Thu ${formatCurrency(mIncome)}, Chi ${formatCurrency(mExpense)}, Tiết kiệm ${formatCurrency(mIncome - mExpense)}`);
    }

    // Recent transactions
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
- Tiết kiệm: ${formatCurrency(income - expense)}

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
        done.slice(0, 3).forEach(t => {
            ctx += `  - ✅ ${t.content}\n`;
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
const SYSTEM_INSTRUCTION = `Bạn là **SmartLife Advisor** — trợ lý AI chuyên tư vấn tài chính cá nhân và quản lý cuộc sống.

NGUYÊN TẮC:
1. Luôn phân tích dựa trên DỮ LIỆU THỰC của người dùng (được cung cấp bên dưới).
2. Trả lời bằng tiếng Việt, ngắn gọn, dùng emoji phù hợp.
3. Khi phân tích chi tiêu: so sánh với ngân sách, chỉ ra danh mục chi nhiều nhất, đề xuất cắt giảm cụ thể.
4. Khi dự đoán: dựa trên xu hướng 6 tháng, đưa ra con số cụ thể.
5. Khi tư vấn mục tiêu: tính toán cần tiết kiệm bao nhiêu/tháng để đạt mục tiêu đúng hạn.
6. ƯU TIÊN dùng bảng (Table Markdown) để trình bày khi có dữ liệu dạng danh sách (như danh sách chi tiêu, kế hoạch tuần, phân loại ngân sách) cho dễ nhìn. Nêu cụ thể số tiền.
7. Nếu thiếu dữ liệu, hỏi lại thay vì bịa số.
8. Giọng điệu: chuyên nghiệp nhưng thân thiện, như một cố vấn tài chính đáng tin.`;

// ────────────────────────────────────────
// API Call
// ────────────────────────────────────────
export async function chatWithGemini(
    history: ChatMessage[],
    appState: AppState
): Promise<string> {
    const contextText = buildFullContext(appState);

    const body = {
        system_instruction: {
            parts: [{ text: SYSTEM_INSTRUCTION + '\n\n--- DỮ LIỆU NGƯỜI DÙNG ---\n' + contextText }]
        },
        contents: history,
        generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 2048,
        },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
    };

    const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('Gemini API Error:', err);
        throw new Error(err?.error?.message || `Gemini API Error ${res.status}`);
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Không nhận được phản hồi từ AI.';
}

// ────────────────────────────────────────
// Quick Insight (1-shot analysis)
// ────────────────────────────────────────
export async function generateQuickInsight(appState: AppState): Promise<string> {
    const messages: ChatMessage[] = [
        {
            role: 'user',
            parts: [{ text: 'Hãy tóm tắt tình hình tài chính của tôi tháng này trong 3-4 dòng ngắn gọn. Nêu điểm tốt và điểm cần cải thiện.' }]
        }
    ];
    return chatWithGemini(messages, appState);
}
