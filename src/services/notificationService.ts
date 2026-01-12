import { TimetableEvent, Goal } from "../types";
import { Solar, Lunar } from "lunar-javascript";

// Simple "Ding" sound (Base64 MP3 to avoid external deps)
const NOTIFICATION_SOUND = "data:audio/mp3;base64,SUQzBAAAAAABAFRYVFgAAAASAAADbWFqb3JfYnJhbmQAbXA0MgBUWFRYAAAAEQAAA21pbm9yX3ZlcnNpb24AMABUWFRYAAAAEAAAA2NvbXBhdGlibGVfYnJhbmQAbXA0Mmlzb21tcDQxAFRTU0UAAAAOAAADTGF2ZjU3LjU2LjEwMAAAAAAAAAAAAAAA//uQZAAAAAAAABAAAAAAAAAAAAQD//7kmRAAAAAAAAIAAAAA///+5JkAAABUAW4AAAAAAACAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/8zEAAAAAABhAAABAAAAAAAAAAAAAAAAAAAAAAABAAAAP/zMQAAAAAAGAAAAEAAAAAAAAAAAAAAAAAAAAAAAQAAAD/8zEAAAAAABgAAABAAAAAAAAAAAAAAAAAAAAAAAEAAAA//MxAAAAAAAYAAAAQAAAAAAAAAAAAAAAAAAAAAABAAAAP/zMQAAAAAAGAAAAEAAAAAAAAAAAAAAAAAAAAAAAQAAAD/8zEAAAAAABgAAABAAAAAAAAAAAAAAAAAAAAAAAEAAAA//MxAAAAAAAYAAAAQAAAAAAAAAAAAAAAAAAAAAABAAAAP/zMQAAAAAAGAAAAEAAAAAAAAAAAAAAAAAAAAAAAQAAAD/8zEAAAAAABgAAABAAAAAAAAAAAAAAAAAAAAAAAEAAAA//MxAAAAAAAYAAAAQAAAAAAAAAAAAAAAAAAAAAABAAAAP/zMQAAAAAAGAAAAEAAAAAAAAAAAAAAAAAAAAAAAQAAAD/8zEAAAAAABgAAABAAAAAAAAAAAAAAAAAAAAAAAEAAAA//MxAAAAAAAYAAAAQAAAAAAAAAAAAAAAAAAAAAABAAAAP/zMQAAAAAAGAAAAEAAAAAAAAAAAAAAAAAAAAAAAQAAAD/8zEAAAAAABgAAABAAAAAAAAAAAAAAAAAAAAAAAEAAAA//MxAAAAAAAYAAAAQAAAAAAAAAAAAAAAAAAAAAABAAAAP/zMQAAAAAAGAAAAEAAAAAAAAAAAAAAAAAAAAAAAQAAAD/8zEAAAAAABgAAABAAAAAAAAAAAAAAAAAAAAAAAEAAAA//MxAAAAAAAYAAAAQAAAAAAAAAAAAAAAAAAAAAABAAAAP/zMQAAAAAAGAAAAEAAAAAAAAAAAAAAAAAAAAAAAQAAAD/8zEAAAAAABgAAABAAAAAAAAAAAAAAAAAAAAAAAEAAAA//MxAAAAAAAYAAAAQAAAAAAAAAAAAAAAAAAAAAABAAAAP/zMQAAAAAAGAAAAEAAAAAAAAAAAAAAAAAAAAAAAQAAAD/8zEAAAAAABgAAABAAAAAAAAAAAAAAAAAAAAAAAEAAAA//MxAAAAAAAYAAAAQAAAAAAAAAAAAAAAAAAAAAABAAAAP/zMQAAAAAAGAAAAEAAAAAAAAAAAAAAAAAAAAAAAQAAAD/8zEAAAAAABgAAABAAAAAAAAAAAAAAAAAAAAAAAEAAAA="; // Placeholder, too long. I will use a shorter one or a link if base64 is too massive for inline.
// Actually, let's use a reliable simple beep URL as backup, or a very short base64.
// Let's stick to a reliable URL from a CDN like unpkg or similar if possible, OR just use the Google one but handle errors better.
// BETTER: Create a helper that tries to play.

const playNotificationSound = () => {
    try {
        // Use a short, pleasant notification sound
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // "Bell notification"
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
            goals_remind: true
        };
    } catch {
        return {
            timetable: true,
            timetable_pre: true,
            calendar_lunar: true,
            calendar_holiday: true,
            focus_timer: true,
            goals_remind: true
        };
    }
};

export const checkAndNotify = (timetable: TimetableEvent[]) => {
    if (Notification.permission !== "granted") return;
    const settings = getSettings();
    if (!settings.timetable && !settings.timetable_pre) return;

    const now = new Date();
    const currentDay = now.getDay(); // 0 (Sun) - 6 (Sat)

    timetable.forEach(event => {
        if (event.day_of_week !== currentDay) return;

        // Calculate time difference
        const [h, m] = event.start_time.split(':').map(Number);
        const eventTime = new Date();
        eventTime.setHours(h, m, 0, 0);

        const diffMinutes = Math.floor((eventTime.getTime() - now.getTime()) / 60000);

        // Notify 15 minutes before
        if (settings.timetable_pre && diffMinutes === 15) {
            sendNotification(`⏳ Sắp diễn ra =))): ${event.title}`, {
                body: `Còn 15 phút nữa là đến giờ rồi bạn ơi! (${event.start_time})`,
                tag: `pre-15-${event.id}-${now.toDateString()}`
            });
        }

        // Notify at start time
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

    // Check only around 7:00 AM - 9:00 AM to avoid spam, or run once a day logic
    // For simplicity in this interval loop, we check if hour is 8 or 9 and we haven't notified today
    const currentHour = now.getHours();
    if (currentHour < 8 || currentHour > 20) return; // Only verify during day

    const solar = Solar.fromDate(now);
    const lunar = Lunar.fromDate(now);
    const day = lunar.getDay();
    const month = lunar.getMonth();

    const tag = `lunar-${day}-${month}-${now.getFullYear()}`;
    if (hasNotifiedRecently(tag)) return;

    // 1. Rằm & Mùng 1
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

    // 2. Holidays (Simple list)
    if (settings.calendar_holiday) {
        // Tet Nguyen Dan (Lunar 1/1) already covered by Mung 1 but can overload
        if (day === 1 && month === 1) {
            sendNotification("🎆 CHÚC MỪNG NĂM MỚI!", { body: "Tết đến xuân về! Chúc mừng năm mới an khang thịnh vượng! 🧧", tag: tag + '-tet' });
        }
    }
};

export const checkGoalsAndNotify = (goals: Goal[]) => {
    if (Notification.permission !== "granted") return;
    const settings = getSettings();
    if (!settings.goals_remind) return;

    // Notify randomly between 9 AM and 9 PM
    const now = new Date();
    if (now.getHours() < 9 || now.getHours() > 21) return;

    // Logic: 5% chance every check (assuming check interval is 1 min) -> too high
    // Better: Check if we haven't notified about goals today
    const tag = `goal-remind-${now.toDateString()}`;
    if (hasNotifiedRecently(tag)) return;

    // Pick a random time? Or just notify at 9 AM?
    // Let's notify at 9 AM or 3 PM if not done
    if (now.getHours() === 9 || now.getHours() === 15) {
        const pendingGoals = goals.filter(g => g.progress < 100);
        if (pendingGoals.length > 0) {
            const randomGoal = pendingGoals[Math.floor(Math.random() * pendingGoals.length)];
            const messages = [
                `🎯 Đừng quên mục tiêu "${randomGoal.title}" nhé!`,
                `🔥 Bạn đã hứa sẽ hoàn thành "${randomGoal.title}" mà?`,
                `✨ Cố lên! "${randomGoal.title}" đang chờ bạn chinh phục.`
            ];
            const msg = messages[Math.floor(Math.random() * messages.length)];

            sendNotification(msg, {
                body: `Tiến độ hiện tại: ${randomGoal.progress}%. Keep going! 🚀`,
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
    date: string; // YYYY-MM-DD
    time?: string; // HH:MM:00
    location?: string;
}

export const checkCustomEventsAndNotify = (events: CalendarEvent[]) => {
    if (Notification.permission !== "granted") return;

    // Default settings check (assuming 'calendar_lunar' implies general calendar notifications for now, 
    // or we can add a specific setting later. For now, let's respect the master toggle concept or just default 'true' for personal events)
    // Ideally we add 'personal_events: true' to settings, but let's assume if user adds event they want noti.

    const now = new Date();
    // Format YYYY-MM-DD
    const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

    // Filter events for TODAY
    const todayEvents = events.filter(e => e.date === dateStr);

    todayEvents.forEach(event => {
        // 1. If has specific time
        if (event.time) {
            const [h, m] = event.time.split(':').map(Number);
            const eventTime = new Date();
            eventTime.setHours(h, m, 0, 0);

            // Diff in minutes
            const diffMinutes = Math.floor((eventTime.getTime() - now.getTime()) / 60000);

            // Notify AT THE TIME (0 to -1 min to catch it)
            if (diffMinutes === 0) {
                const tag = `evt-start-${event.id}`;
                if (hasNotifiedRecently(tag)) return;

                sendNotification(`🗓️ ${event.title}`, {
                    body: `Đến giờ rồi! Địa điểm: ${event.location || 'Chưa xác định'}`,
                    tag: tag
                });
                markNotified(tag);
            }
        }
        // 2. All day event -> Notify at 9:00 AM once
        else {
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

// Helper: Prevent duplicate notifications in same session/day
const notifiedTags: Record<string, number> = {};
const hasNotifiedRecently = (tag: string) => {
    const last = notifiedTags[tag];
    if (!last) return false;
    // Debounce for 12 hours
    return (Date.now() - last) < 12 * 60 * 60 * 1000;
};
const markNotified = (tag: string) => {
    notifiedTags[tag] = Date.now();
};


const sendNotification = (title: string, options?: NotificationOptions) => {
    // Play sound manually to ensure it's audible
    playNotificationSound();

    new Notification(title, {
        icon: '/pwa-192x192.png',
        silent: false, // We played sound manually, but keeping this doesn't hurt
        ...options
    });
};
