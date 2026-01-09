import { TimetableEvent } from "../types";

export const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
        alert("Trình duyệt này không hỗ trợ thông báo.");
        return false;
    }
    if (Notification.permission === "granted") return true;
    if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        return permission === "granted";
    }
    return false;
};

export const checkAndNotify = (timetable: TimetableEvent[]) => {
    if (Notification.permission !== "granted") return;

    const now = new Date();
    const currentDay = now.getDay(); // 0 (Sun) - 6 (Sat)
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Look for events starting soon (e.g., in 10 minutes)
    // We can also notify for exact start time.
    // Let's notify 15 mins before and at the start time.

    timetable.forEach(event => {
        if (event.day_of_week !== currentDay) return;

        // Calculate time difference
        const [h, m] = event.start_time.split(':').map(Number);
        const eventTime = new Date();
        eventTime.setHours(h, m, 0, 0);

        const diffMinutes = Math.floor((eventTime.getTime() - now.getTime()) / 60000);

        // Notify 15 minutes before
        if (diffMinutes === 15) {
            sendNotification(`Sắp diễn ra: ${event.title}`, {
                body: `Sự kiện sẽ bắt đầu trong 15 phút tại ${event.location || 'không xác định'}.`,
                tag: `pre-15-${event.id}-${now.toDateString()}` // Unique tag to prevent duplicate
            });
        }

        // Notify at start time (allow 0-1 min delay)
        if (diffMinutes === 0) {
            sendNotification(`Đang diễn ra: ${event.title}`, {
                body: `Sự kiện bắt đầu ngay bây giờ!`,
                tag: `start-${event.id}-${now.toDateString()}`
            });
        }
    });
};

const sendNotification = (title: string, options?: NotificationOptions) => {
    // Check if notification with same tag already exists/shown recently?
    // The 'tag' option in Notification prevents duplicates automatically on some browsers,
    // but better to be safe if we call this frequently.
    new Notification(title, {
        icon: '/pwa-192x192.png',
        ...options
    });
};
