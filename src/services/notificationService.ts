import { TimetableEvent, Goal, Todo } from "../types";
// @ts-ignore
import { Solar, Lunar } from "lunar-javascript";
import { supabase } from "./supabase";

const playNotificationSound = () => {
    try {
        const audio = new Audio('/tiengthongbaobamgio.mp3');
        audio.volume = 0.7;
        audio.play().catch(e => console.warn("Audio play failed (user interaction needed first):", e));
    } catch (e) {
        console.error("Audio error", e);
    }
};

export const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
        alert("Trình duyệt này không hỗ trợ thông báo.");
        return false;
    }

    if (Notification.permission === "granted") {
        return true;
    }

    if (Notification.permission === "denied") {
        alert("Bạn đã chặn thông báo. Vui lòng vào cài đặt trình duyệt để mở lại.");
        return false;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        new Notification("Xin chào!", { body: "SmartLife đã được cấp quyền thông báo ✨", icon: '/pwa-192x192.png' });
        return true;
    }

    return false;
};

const getSettings = () => {
    try {
        const saved = localStorage.getItem('smartlife_noti_settings');
        return saved ? JSON.parse(saved) : {
            timetable: true,
            timetable_pre: true,
            calendar_lunar: true,
            calendar_holiday: true,
            focus_timer: true,
            goals_remind: true,
            todo_remind: true
        };
    } catch {
        return {
            timetable: true,
            timetable_pre: true,
            calendar_lunar: true,
            calendar_holiday: true,
            focus_timer: true,
            goals_remind: true,
            todo_remind: true
        };
    }
};

const notifiedTags: Record<string, number> = {};
const hasNotifiedRecently = (tag: string) => {
    const last = notifiedTags[tag];
    if (!last) return false;
    return (Date.now() - last) < 12 * 60 * 60 * 1000;
};
const markNotified = (tag: string) => {
    notifiedTags[tag] = Date.now();
};

const sendNotification = (title: string, options?: NotificationOptions) => {
    playNotificationSound();
    new Notification(title, {
        icon: '/pwa-192x192.png',
        silent: false,
        ...options
    });
};

export const checkAndNotify = (timetable: TimetableEvent[]) => {
    if (Notification.permission !== "granted") return;
    const settings = getSettings();
    if (!settings.timetable && !settings.timetable_pre) return;

    const now = new Date();
    const currentDay = now.getDay();

    timetable.forEach(event => {
        if (event.day_of_week !== currentDay) return;

        const [h, m] = event.start_time.split(':').map(Number);
        const eventTime = new Date();
        eventTime.setHours(h, m, 0, 0);

        const diffMinutes = Math.floor((eventTime.getTime() - now.getTime()) / 60000);

        if (settings.timetable_pre && diffMinutes === 15) {
            sendNotification(`⏳ Sắp diễn ra =))): ${event.title}`, {
                body: `Còn 15 phút nữa là đến giờ rồi bạn ơi! (${event.start_time})`,
                tag: `pre-15-${event.id}-${now.toDateString()}`
            });
        }

        if (settings.timetable && diffMinutes === 0) {
            sendNotification(`🔔 Đang diễn ra rùi nè: ${event.title}`, {
                body: `Sự kiện bắt đầu ngay bây giờ tại ${event.location || 'không gian mạng'}!`,
                tag: `start-${event.id}-${now.toDateString()}`
            });
        }
    });
};

export const checkCalendarAndNotify = () => {
    if (Notification.permission !== "granted") return;
    const settings = getSettings();
    const now = new Date();

    const currentHour = now.getHours();
    if (currentHour < 8 || currentHour > 20) return;

    const solar = Solar.fromDate(now);
    const lunar = Lunar.fromDate(now);
    const day = lunar.getDay();
    const month = lunar.getMonth();

    const tag = `lunar-${day}-${month}-${now.getFullYear()}`;
    if (hasNotifiedRecently(tag)) return;

    if (settings.calendar_lunar) {
        if (day === 1) {
            sendNotification("🌙 Hôm nay là Mùng 1", { body: "Chúc bạn một tháng mới bình an và may mắn! 🙏", tag });
            markNotified(tag);
            return;
        }
        if (day === 15) {
            sendNotification("🌕 Hôm nay là Rằm", { body: "Trăng tròn rồi, nhớ ăn chay hoặc thắp hương nhé! 🙏", tag });
            markNotified(tag);
            return;
        }
    }

    if (settings.calendar_holiday) {
        if (day === 1 && month === 1) {
            sendNotification("🎆 CHÚC MỪNG NĂM MỚI!", { body: "Tết đến xuân về! Chúc mừng năm mới an khang thịnh vượng! 🧧", tag: tag + '-tet' });
            markNotified(tag);
        }
    }
};

export const checkGoalsAndNotify = (goals: Goal[]) => {
    if (Notification.permission !== "granted") return;
    const settings = getSettings();
    if (!settings.goals_remind) return;

    const now = new Date();
    if (now.getHours() < 9 || now.getHours() > 21) return;

    const tag = `goal-remind-${now.toDateString()}`;
    if (hasNotifiedRecently(tag)) return;

    if (now.getHours() === 9 || now.getHours() === 15) {
        const pendingGoals = goals.filter(g => (g?.progress ?? 0) < 100);
        if (pendingGoals.length > 0) {
            const randomGoal = pendingGoals[Math.floor(Math.random() * pendingGoals.length)];
            const messages = [
                `🎯 Đừng quên mục tiêu "${randomGoal.title}" nhé!`,
                `🔥 Bạn đã hứa sẽ hoàn thành "${randomGoal.title}" mà?`,
                `✨ Cố lên! "${randomGoal.title}" đang chờ bạn chinh phục.`
            ];
            const msg = messages[Math.floor(Math.random() * messages.length)];

            sendNotification(msg, {
                body: `Tiến độ hiện tại: ${randomGoal?.progress ?? 0}%. Keep going! 🚀`,
                tag
            });
            markNotified(tag);
        }
    }
};

interface CalendarEvent {
    id: string;
    title: string;
    description?: string;
    date: string;
    time?: string;
    location?: string;
    email_notify?: boolean;
    email_notify_before_minutes?: number;
}

export const checkCustomEventsAndNotify = (events: CalendarEvent[]) => {
    if (Notification.permission !== "granted") return;

    const now = new Date();
    const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

    const todayEvents = events.filter(e => e.date === dateStr);

    todayEvents.forEach(event => {
        if (event.time) {
            const [h, m] = event.time.split(':').map(Number);
            const eventTime = new Date();
            eventTime.setHours(h, m, 0, 0);

            const diffMinutes = Math.floor((eventTime.getTime() - now.getTime()) / 60000);

            if (diffMinutes === 0) {
                const tag = `evt-start-${event.id}`;
                if (hasNotifiedRecently(tag)) return;

                sendNotification(`🗓️ ${event.title}`, {
                    body: `Đến giờ rồi! Địa điểm: ${event.location || 'Chưa xác định'}`,
                    tag: tag
                });
                markNotified(tag);
            }
        } else {
            if (now.getHours() === 9 && now.getMinutes() === 0) {
                const tag = `evt-allday-${event.id}`;
                if (hasNotifiedRecently(tag)) return;

                sendNotification(`📅 Hôm nay: ${event.title}`, {
                    body: event.description || "Bạn có sự kiện này hôm nay.",
                    tag: tag
                });
                markNotified(tag);
            }
        }
    });
};

export const checkHabitsFromDBAndNotify = async (userId: string) => {
    if (Notification.permission !== "granted") return;

    const now = new Date();
    const h = now.getHours();

    if (h !== 8 && h !== 20) return;

    const tag = `habit-remind-${now.toDateString()}-${h}`;
    if (hasNotifiedRecently(tag)) return;

    try {
        const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        const daysOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const currentDayStr = daysOfWeek[now.getDay()];

        const { data: habits, error: habitsError } = await supabase
            .from('habits')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true);

        if (habitsError || !habits) return;

        const todayHabits = habits.filter((h: any) =>
            h.frequency === 'daily' ||
            (h.frequency === 'custom' && h.active_days?.includes(currentDayStr))
        );

        if (todayHabits.length === 0) return;

        const { data: logs, error: logsError } = await supabase
            .from('habit_logs')
            .select('*')
            .in('habit_id', todayHabits.map((h: any) => h.id))
            .eq('log_date', dateStr);

        if (logsError) return;

        const completedHabitIds = (logs || []).filter((l: any) => l.completed).map((l: any) => l.habit_id);
        const pendingHabits = todayHabits.filter((h: any) => !completedHabitIds.includes(h.id));

        if (pendingHabits.length > 0) {
            if (h === 8) {
                sendNotification("🌅 Chào buổi sáng!", {
                    body: `Bạn có ${pendingHabits.length} thói quen cần hoàn thành hôm nay. Hãy bắt đầu ngày mới đầy năng lượng nhé!`,
                    tag
                });
            } else if (h === 20) {
                sendNotification("🌙 Nhắc nhở thói quen", {
                    body: `Bạn vẫn còn ${pendingHabits.length} thói quen chưa xong (như: ${pendingHabits[0].title}). Dành chút thời gian hoàn thành nào! 💪`,
                    tag
                });
            }
            markNotified(tag);
        } else if (h === 20) {
            sendNotification("🎉 Tuyệt vời!", {
                body: "Bạn đã hoàn thành TẤT CẢ thói quen hôm nay. Chúc bạn ngủ ngon! 😴",
                tag
            });
            markNotified(tag);
        }

    } catch (e) {
        console.error("Habit notification error:", e);
    }
};

export const checkTodosAndNotify = (todos: Todo[]) => {
    if (Notification.permission !== "granted") return;
    const settings = getSettings();
    if (!settings.todo_remind) return;

    const now = new Date();
    const h = now.getHours();
    let slot = '';
    let dateStr = now.toDateString();

    if (h >= 12 && h < 20) {
        slot = '12';
    } else {
        slot = '20';
        if (h < 12) {
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            dateStr = yesterday.toDateString();
        }
    }

    const tag = `todo-remind-${slot}-${dateStr}`;
    if (hasNotifiedRecently(tag)) return;

    const pendingTodos = todos.filter(t => !t.is_completed);

    if (pendingTodos.length > 0) {
        const todoMessages = [
            `📝 Bạn có ${pendingTodos.length} công việc chưa hoàn thành!`,
            `🎯 Hãy hoàn thành các task của ngày hôm nay nhé!`,
            `⚡ Đừng quên check-in các việc cần làm trong danh sách!`
        ];
        const msg = todoMessages[Math.floor(Math.random() * todoMessages.length)];
        const bodyContent = pendingTodos.slice(0, 2).map(t => `- ${t.content}`).join('\n') + 
            (pendingTodos.length > 2 ? `\n... và ${pendingTodos.length - 2} việc khác.` : '');

        sendNotification(msg, {
            body: bodyContent,
            tag
        });
        markNotified(tag);
    }
};

// In-memory dedup cache to prevent rapid-fire duplicate sends within same session
const emailSentCache: Record<string, number> = {};
const hasEmailSentRecently = (key: string): boolean => {
    const lastSent = emailSentCache[key];
    if (!lastSent) return false;
    // Block re-send within 30 minutes
    return (Date.now() - lastSent) < 30 * 60 * 1000;
};
const markEmailSent = (key: string) => {
    emailSentCache[key] = Date.now();
};

// Helper: Call /api/send-email (Vercel serverless or Vite dev proxy)
const callSendEmailAPI = async (payload: {
    logId?: string;
    to: string;
    lang: string;
    sourceType: string;
    item: any;
    minutesLeft: number;
}): Promise<{ success: boolean; error?: string }> => {
    try {
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error(`[EmailNotification] API Error (${response.status}):`, errData);
            return { success: false, error: errData.error || `HTTP ${response.status}` };
        }

        const data = await response.json();
        console.log('[EmailNotification] ✅ Email sent:', data);
        return { success: true };
    } catch (e: any) {
        console.error('[EmailNotification] Network error:', e.message);
        return { success: false, error: e.message };
    }
};

export const checkAndSendEmailNotifications = async (
    todos: Todo[],
    timetable: TimetableEvent[],
    calendarEvents: any[],
    profile: any,
    currentLang: string
) => {
    if (!profile || !profile.email) return;

    const now = new Date();
    const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

    // 1. Check Todos
    const dueTodos = todos.filter(t => {
        if (t.is_completed || !t.deadline) return false;
        const emailNotify = t.email_notify || (profile?.email_notifications?.enabled && profile?.email_notifications?.todo_deadline);
        if (!emailNotify) return false;
        
        const diffMinutes = Math.floor((new Date(t.deadline).getTime() - now.getTime()) / 60000);
        const beforeMinutes = t.email_notify_before_minutes ?? (profile?.email_notifications?.hours_before ? profile.email_notifications.hours_before * 60 : 60);
        
        return diffMinutes > 0 && diffMinutes <= beforeMinutes;
    });

    for (const todo of dueTodos) {
        try {
            const diffMinutes = Math.floor((new Date(todo.deadline!).getTime() - now.getTime()) / 60000);
            const dedupKey = `todo_${todo.id}_${dateStr}`;

            // In-memory dedup: skip if already sent recently in this session
            if (hasEmailSentRecently(dedupKey)) continue;

            // DB-level dedup: include date in notification_type so the same todo can be notified on different days
            const notiType = `deadline_${dateStr}`;
            
            const { data: inserted, error: insertError } = await supabase
                .from('email_notification_logs')
                .insert([{
                    user_id: profile.id,
                    source_type: 'todo',
                    source_id: todo.id,
                    notification_type: notiType,
                    email_to: profile.email,
                    status: 'pending'
                }])
                .select()
                .single();

            if (insertError) {
                if (insertError.code === '23505') {
                    // Already sent today for this todo — mark in-memory cache too
                    markEmailSent(dedupKey);
                } else {
                    console.error("[EmailNotification] Error logging todo notification:", insertError);
                }
                continue;
            }

            if (inserted) {
                const result = await callSendEmailAPI({
                    logId: inserted.id,
                    to: profile.email,
                    lang: currentLang,
                    sourceType: 'todo',
                    item: todo,
                    minutesLeft: diffMinutes
                });

                if (result.success) {
                    markEmailSent(dedupKey);
                    // Update log status to sent
                    await supabase
                        .from('email_notification_logs')
                        .update({ status: 'sent' })
                        .eq('id', inserted.id);
                } else {
                    // Update log status to failed
                    await supabase
                        .from('email_notification_logs')
                        .update({ status: 'failed' })
                        .eq('id', inserted.id);
                }
            }
        } catch (e) {
            console.error("[EmailNotification] Error processing todo email:", e);
        }
    }

    // 2. Check Calendar Events
    const dueCalendarEvents = calendarEvents.filter(ce => {
        if (!ce.date) return false;
        const emailNotify = ce.email_notify || (profile?.email_notifications?.enabled && profile?.email_notifications?.calendar_deadline);
        if (!emailNotify) return false;
        
        // Parse event time safely: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
        const timeStr = ce.time ? ce.time.padEnd(8, ':00').slice(0, 8) : '00:00:00';
        const eventTimeStr = `${ce.date}T${timeStr}`;
        const eventTime = new Date(eventTimeStr);
        if (isNaN(eventTime.getTime())) return false;

        const diffMinutes = Math.floor((eventTime.getTime() - now.getTime()) / 60000);
        const beforeMinutes = ce.email_notify_before_minutes ?? (profile?.email_notifications?.hours_before ? profile.email_notifications.hours_before * 60 : 60);
        
        return diffMinutes > 0 && diffMinutes <= beforeMinutes;
    });

    for (const ce of dueCalendarEvents) {
        try {
            const timeStr = ce.time ? ce.time.padEnd(8, ':00').slice(0, 8) : '00:00:00';
            const eventTimeStr = `${ce.date}T${timeStr}`;
            const diffMinutes = Math.floor((new Date(eventTimeStr).getTime() - now.getTime()) / 60000);
            const dedupKey = `calendar_${ce.id}_${dateStr}`;

            if (hasEmailSentRecently(dedupKey)) continue;

            const notiType = `deadline_${dateStr}`;

            const { data: inserted, error: insertError } = await supabase
                .from('email_notification_logs')
                .insert([{
                    user_id: profile.id,
                    source_type: 'calendar_event',
                    source_id: ce.id,
                    notification_type: notiType,
                    email_to: profile.email,
                    status: 'pending'
                }])
                .select()
                .single();

            if (insertError) {
                if (insertError.code === '23505') {
                    markEmailSent(dedupKey);
                } else {
                    console.error("[EmailNotification] Error logging calendar notification:", insertError);
                }
                continue;
            }

            if (inserted) {
                const result = await callSendEmailAPI({
                    logId: inserted.id,
                    to: profile.email,
                    lang: currentLang,
                    sourceType: 'calendar_event',
                    item: ce,
                    minutesLeft: diffMinutes
                });

                if (result.success) {
                    markEmailSent(dedupKey);
                    await supabase
                        .from('email_notification_logs')
                        .update({ status: 'sent' })
                        .eq('id', inserted.id);
                } else {
                    await supabase
                        .from('email_notification_logs')
                        .update({ status: 'failed' })
                        .eq('id', inserted.id);
                }
            }
        } catch (e) {
            console.error("[EmailNotification] Error processing calendar event email:", e);
        }
    }

    // 3. Check Timetable (Weekly recurring class schedule)
    const todayIndex = now.getDay();
    const dueTimetable = timetable.filter(tt => {
        if (tt.day_of_week !== todayIndex) return false;
        const emailNotify = tt.email_notify || (profile?.email_notifications?.enabled && profile?.email_notifications?.timetable_deadline);
        if (!emailNotify) return false;
        
        // Ensure start_time is properly formatted (HH:MM or HH:MM:SS)
        const startTimeParts = tt.start_time.split(':');
        const eventHour = parseInt(startTimeParts[0], 10);
        const eventMin = parseInt(startTimeParts[1], 10);
        if (isNaN(eventHour) || isNaN(eventMin)) return false;

        const eventDate = new Date(now);
        eventDate.setHours(eventHour, eventMin, 0, 0);

        const diffMinutes = Math.floor((eventDate.getTime() - now.getTime()) / 60000);
        const beforeMinutes = tt.email_notify_before_minutes ?? (profile?.email_notifications?.hours_before ? profile.email_notifications.hours_before * 60 : 60);
        
        return diffMinutes > 0 && diffMinutes <= beforeMinutes;
    });

    for (const tt of dueTimetable) {
        try {
            const startTimeParts = tt.start_time.split(':');
            const eventDate = new Date(now);
            eventDate.setHours(parseInt(startTimeParts[0], 10), parseInt(startTimeParts[1], 10), 0, 0);
            const diffMinutes = Math.floor((eventDate.getTime() - now.getTime()) / 60000);
            
            const notiType = `timetable_${dateStr}`;
            const dedupKey = `timetable_${tt.id}_${dateStr}`;

            if (hasEmailSentRecently(dedupKey)) continue;
            
            const { data: inserted, error: insertError } = await supabase
                .from('email_notification_logs')
                .insert([{
                    user_id: profile.id,
                    source_type: 'timetable',
                    source_id: tt.id,
                    notification_type: notiType,
                    email_to: profile.email,
                    status: 'pending'
                }])
                .select()
                .single();

            if (insertError) {
                if (insertError.code === '23505') {
                    markEmailSent(dedupKey);
                } else {
                    console.error("[EmailNotification] Error logging timetable notification:", insertError);
                }
                continue;
            }

            if (inserted) {
                const result = await callSendEmailAPI({
                    logId: inserted.id,
                    to: profile.email,
                    lang: currentLang,
                    sourceType: 'timetable',
                    item: tt,
                    minutesLeft: diffMinutes
                });

                if (result.success) {
                    markEmailSent(dedupKey);
                    await supabase
                        .from('email_notification_logs')
                        .update({ status: 'sent' })
                        .eq('id', inserted.id);
                } else {
                    await supabase
                        .from('email_notification_logs')
                        .update({ status: 'failed' })
                        .eq('id', inserted.id);
                }
            }
        } catch (e) {
            console.error("[EmailNotification] Error processing timetable email:", e);
        }
    }
};
