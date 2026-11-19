// File: src/services/ai/companion/greeting.ts
// Lời chào chủ động mỗi ngày một lần khi mở trang AI ở chế độ Bạn đồng hành.
// Chỉ dùng dữ liệu đã có trong appState (không gọi thêm tool) — prompt ngắn, chạy ở tầng nhanh, không tính lượt.

import type { AppState } from '../../../types';
import type { CompanionProfile } from './types';
import { companionIdentity, companionFormatting, companionSafetyBlock } from './prompt';

/** Ngày theo giờ Việt Nam (UTC+7), dạng YYYY-MM-DD */
export function vnDateKey(now: Date = new Date()): string {
    return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

/** Giờ hiện tại theo giờ Việt Nam (0–23) */
export function vnHour(now: Date = new Date()): number {
    return new Date(now.getTime() + 7 * 3600_000).getUTCHours();
}

export function partOfDay(hour: number): string {
    if (hour < 5) return 'đêm khuya';
    if (hour < 11) return 'buổi sáng';
    if (hour < 14) return 'buổi trưa';
    if (hour < 18) return 'buổi chiều';
    return 'buổi tối';
}

export interface GreetingContext {
    userName?: string;
    partOfDay: string;
    weekday: string;
    todosDueToday: string[];
    overdueCount: number;
    eventsToday: string[];
}

const WEEKDAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const clip = (s: unknown, n = 60) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Tóm tắt "hôm nay" từ appState — không lộ số tiền hay dữ liệu nhạy cảm */
export function buildGreetingContext(appState: Partial<AppState> | null | undefined, now: Date = new Date()): GreetingContext {
    const today = vnDateKey(now);
    const dow = new Date(now.getTime() + 7 * 3600_000).getUTCDay();
    const todos = (appState?.todos || []).filter(t => !t.is_completed);
    const dueKey = (d?: string) => (d ? vnDateKey(new Date(d)) : '');
    const todosDueToday = todos.filter(t => t.deadline && dueKey(t.deadline) === today).slice(0, 3).map(t => clip(t.content));
    const overdueCount = todos.filter(t => t.deadline && dueKey(t.deadline) < today).length;

    const classes = (appState?.timetable || [])
        .filter(e => e.day_of_week === dow)
        .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
        .map(e => `${clip(e.start_time, 5)} ${clip(e.title, 40)}`);
    const events = (appState?.calendarEvents || [])
        .filter((e: any) => String(e?.date || e?.event_date || '').slice(0, 10) === today)
        .map((e: any) => `${e.start_time ? clip(e.start_time, 5) + ' ' : ''}${clip(e.title, 40)}`);

    const fullName = clip(appState?.profile?.full_name, 40);
    return {
        userName: fullName ? fullName.split(' ').pop() : undefined,
        partOfDay: partOfDay(vnHour(now)),
        weekday: WEEKDAYS[dow],
        todosDueToday,
        overdueCount,
        eventsToday: [...classes, ...events].slice(0, 4),
    };
}

/** Prompt cho lời chào — gửi như system prompt, kèm một tin nhắn người dùng ngắn "(mở ứng dụng)" */
export function buildGreetingPrompt(p: CompanionProfile, ctx: GreetingContext): string {
    const facts: string[] = [`- Bây giờ là ${ctx.partOfDay} ${ctx.weekday}.`];
    if (ctx.userName) facts.push(`- Tên người dùng: ${ctx.userName}.`);
    if (ctx.todosDueToday.length) facts.push(`- Việc đến hạn hôm nay: ${ctx.todosDueToday.join('; ')}.`);
    if (ctx.overdueCount) facts.push(`- Có ${ctx.overdueCount} việc đã quá hạn.`);
    if (ctx.eventsToday.length) facts.push(`- Lịch hôm nay: ${ctx.eventsToday.join('; ')}.`);
    return [
        companionIdentity(p),
        companionFormatting({ ...p, length: 'tiny' }),
        companionSafetyBlock(p),
        [
            'NHIỆM VỤ LƯỢT NÀY: người dùng vừa mở ứng dụng. Hãy CHỦ ĐỘNG nhắn trước một lời chào / hỏi thăm.',
            '- Tối đa 2 câu, dưới 35 từ, đúng tính cách và xưng hô ở trên.',
            '- Nếu có việc hay lịch hôm nay thì nhắc nhẹ MỘT điều cụ thể nhất; không liệt kê, không gây áp lực.',
            '- Kết bằng một câu hỏi mở dễ trả lời. Không giới thiệu lại mình là ai.',
            'DỮ LIỆU HÔM NAY:',
            ...facts,
        ].join('\n'),
    ].join('\n\n');
}

/** Lời chào dự phòng khi gọi AI lỗi */
export function fallbackGreeting(p: CompanionProfile, ctx: GreetingContext): string {
    const hi = ctx.partOfDay === 'buổi sáng' ? 'Chào buổi sáng' : ctx.partOfDay === 'đêm khuya' ? 'Khuya rồi đó' : 'Hello';
    const name = ctx.userName ? ` ${ctx.userName}` : '';
    const emoji = p.emoji === 'none' ? '' : ' 👋';
    const nudge = ctx.todosDueToday.length
        ? `Hôm nay ${p.userPronoun} có "${ctx.todosDueToday[0]}" nè, ${p.selfPronoun} ngồi cạnh cổ vũ nha.`
        : `Hôm nay của ${p.userPronoun} thế nào rồi?`;
    return `${hi}${name}${emoji}\n\n${nudge}`;
}
