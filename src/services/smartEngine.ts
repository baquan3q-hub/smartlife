import { AppState, TimetableEvent, Transaction, SmartInsight } from '../types';

/**
 * SmartLifeEngine 🧠
 * Core algorithms for behavioral analysis and insights.
 */

// --- 1. FINANCIAL INTELLIGENCE ---

/**
 * Calculates "Spending Velocity" to check if user is burning budget too fast.
 * @returns 'SAFE' | 'WARNING' | 'DANGER'
 */
export const calculatespendingVelocity = (
    currentSpent: number,
    totalBudget: number,
    dayOfMonth: number,
    daysInMonth: number
): { status: 'SAFE' | 'WARNING' | 'DANGER'; velocity: number; message: string } => {

    if (totalBudget === 0) return { status: 'SAFE', velocity: 0, message: "Chưa thiết lập ngân sách." };

    const idealDailyBurn = totalBudget / daysInMonth;
    const currentDailyBurn = currentSpent / dayOfMonth;
    const velocity = currentDailyBurn / idealDailyBurn; // 1.0 = on track, > 1.0 = too fast

    let status: 'SAFE' | 'WARNING' | 'DANGER' = 'SAFE';
    let message = "Chi tiêu hợp lý.";

    if (velocity > 1.3) {
        status = 'DANGER';
        message = `Nguy hiểm! Bạn đang tiêu nhanh gấp ${velocity.toFixed(1)} lần cho phép.`;
    } else if (velocity > 1.05) {
        status = 'WARNING';
        message = "Cảnh báo: Bạn đang tiêu hơi quá tay.";
    }

    return { status, velocity, message };
};

// --- 2. PRODUCTIVITY & SCHEDULE ---

/**
 * Calculates "Deep Work Score" based on schedule fragmentation.
 * Score 0-100.
 */
export const calculateDeepWorkScore = (events: TimetableEvent[]): number => {
    if (!events.length) return 0;

    let focusMinutes = 0;
    let contextSwitches = 0;

    // Sort events by time
    const sortedEvents = [...events].sort((a, b) => a.start_time.localeCompare(b.start_time));

    for (let i = 0; i < sortedEvents.length; i++) {
        const event = sortedEvents[i];

        // Calculate duration logic (simplified for string HH:MM)
        // Ideally we use a helper to parse minutes. 
        // Assuming typical 1 hour blocks for now if calc is complex, 
        // but let's try a simple parse.
        const duration = getDurationInMinutes(event.start_time, event.end_time || addMinutes(event.start_time, 60));

        // Check for Focus keywords
        const isFocus = /hoc|tap trung|code|lam viec|study|focus/i.test(event.title);

        if (isFocus && duration >= 45) {
            focusMinutes += duration;
        }

        // Check gap with Next event
        if (i < sortedEvents.length - 1) {
            const nextEvent = sortedEvents[i + 1];
            const gap = getDurationInMinutes(event.end_time || addMinutes(event.start_time, 60), nextEvent.start_time);
            if (gap > 0 && gap < 30) {
                contextSwitches++; // Penalty for small gaps
            }
        }
    }

    // Formula: (FocusHours * 10) - (Switches * 5)
    // Normalize to 0-100
    const rawScore = ((focusMinutes / 60) * 15) - (contextSwitches * 5);
    return Math.min(100, Math.max(0, Math.round(rawScore)));
};

// --- HELPERS ---
const getDurationInMinutes = (start: string, end: string): number => {
    try {
        const [h1, m1] = start.split(':').map(Number);
        const [h2, m2] = end.split(':').map(Number);
        return (h2 * 60 + m2) - (h1 * 60 + m1);
    } catch (e) { return 60; }
};

const addMinutes = (time: string, mins: number): string => {
    const [h, m] = time.split(':').map(Number);
    const d = new Date(); d.setHours(h, m + mins);
    return `${d.getHours()}:${d.getMinutes()}`;
}

// --- 3. RECOMMENDATION ENGINE (NUDGES) ---

export const generateInsights = (state: AppState): SmartInsight[] => {
    const insights: SmartInsight[] = [];
    const today = new Date();

    // 1. Finance Nudge
    if (state.budget.totalBudget > 0) {
        // Calculate actual spent this month
        const currentMonth = today.getMonth() + 1; // 1-12
        const spentThisMonth = state.transactions
            .filter(t => t.type === 'expense' && new Date(t.date).getMonth() + 1 === currentMonth)
            .reduce((sum, t) => sum + t.amount, 0);

        const financeCheck = calculatespendingVelocity(
            spentThisMonth,
            state.budget.totalBudget,
            today.getDate(),
            new Date(today.getFullYear(), currentMonth, 0).getDate()
        );

        if (financeCheck.status !== 'SAFE') {
            insights.push({
                id: crypto.randomUUID(),
                user_id: 'local', // Placeholder
                type: 'FINANCE_WARNING',
                message: financeCheck.message,
                is_read: false,
                action_link: 'finance'
            });
        }
    }

    // 2. Schedule Nudge (Deep Work)
    // Filter today's events from timetable (using day_of_week)
    // Coerce type since AppState defines it as Task[] but retrieval is TimetableEvent[]
    const dbEvents = state.timetable as unknown as TimetableEvent[];
    const dailyEvents = dbEvents.filter(e => Number(e.day_of_week) === today.getDay());

    const deepWorkScore = calculateDeepWorkScore(dailyEvents);

    if (deepWorkScore < 30 && dailyEvents.length > 2) {
        insights.push({
            id: crypto.randomUUID(),
            user_id: 'local',
            type: 'SCHEDULE_OPTIMIZATION',
            message: "Lịch hôm nay hơi vụn vặt. Thử gộp các việc nhỏ lại để tập trung hơn nhé!",
            is_read: false,
            action_link: 'schedule'
        });
    } else if (deepWorkScore > 80) {
        insights.push({
            id: crypto.randomUUID(),
            user_id: 'local',
            type: 'HABIT_KUDOS',
            message: "Tuyệt vời! Lịch trình hôm nay rất tối ưu cho Deep Work.",
            is_read: false,
            action_link: 'schedule'
        });
    }

    return insights;
};
