// File: api/cron-telegram.js
// Vercel Cron Job / Webhook trigger — Tự động gửi thông báo, lịch trình, nhắc việc qua Telegram
//
// Cách kích hoạt:
// 1. Tự động qua Vercel Cron (cấu hình trong vercel.json)
// 2. Hoặc gọi thủ công để test / dùng cron-job.org:
//    GET https://<domain>/api/cron-telegram?key=smartlife2026&type=morning
//    GET https://<domain>/api/cron-telegram?key=smartlife2026&type=afternoon
//    GET https://<domain>/api/cron-telegram?key=smartlife2026&type=evening
//    GET https://<domain>/api/cron-telegram?key=smartlife2026&type=alert

import { callRpc } from './_lib/authKey.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = (process.env.TELEGRAM_ALLOWED_CHAT_ID || '').trim();
const SMARTLIFE_KEY = process.env.SMARTLIFE_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

async function sendTelegram(method, payload) {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return res.json().catch(() => ({ ok: false }));
}

function escapeHtml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatVnd(amount) {
    return Number(amount || 0).toLocaleString('vi-VN') + 'đ';
}

function buildMorningMessage(context) {
    const user = context?.user || {};
    const tasks = context?.tasks || {};
    const finance = context?.finance || {};
    const productivity = context?.productivity || {};

    const name = escapeHtml(user.name || 'bạn');
    const todayStr = new Date().toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    const lines = [
        `🌅 <b>Chào buổi sáng, ${name}!</b>`,
        `<i>Hôm nay là ${todayStr} (giờ Việt Nam).</i>\n`
    ];

    // 1. Lịch trình hôm nay
    const timetable = tasks.today_timetable || [];
    const events = tasks.today_events || [];
    lines.push('📅 <b>Lịch trình hôm nay:</b>');
    if (timetable.length === 0 && events.length === 0) {
        lines.push('• <i>Không có lịch học/lịch cố định hôm nay. Thoải mái tập trung làm task!</i>');
    } else {
        timetable.forEach((item) => {
            const time = item.start_time ? item.start_time.slice(0, 5) : '';
            lines.push(`• 🏫 <b>${time}</b>: ${escapeHtml(item.subject || item.title || 'Lịch học')} ${item.room ? `(Phòng ${escapeHtml(item.room)})` : ''}`);
        });
        events.forEach((item) => {
            const time = item.time ? item.time.slice(0, 5) : '';
            lines.push(`• 📌 <b>${time}</b>: ${escapeHtml(item.title || 'Sự kiện')}`);
        });
    }
    lines.push('');

    // 2. Task ưu tiên
    const topTasks = (tasks.top_priority || []).slice(0, 4);
    lines.push(`🎯 <b>Task ưu tiên cần tập trung (${topTasks.length}):</b>`);
    if (topTasks.length === 0) {
        lines.push('• <i>Chưa có task ưu tiên hôm nay.</i>');
    } else {
        topTasks.forEach((t) => {
            const priorityBadge = t.priority === 'urgent' ? '🔴' : '🟡';
            lines.push(`• ${priorityBadge} ${escapeHtml(t.title)}`);
        });
    }
    lines.push('');

    // 3. Task quá hạn (nếu có)
    const overdueTasks = tasks.overdue || [];
    if (overdueTasks.length > 0) {
        lines.push(`⚠️ <b>Task đang quá hạn (${overdueTasks.length}):</b>`);
        overdueTasks.slice(0, 3).forEach((t) => {
            lines.push(`• ⏰ <s>${escapeHtml(t.title)}</s>`);
        });
        if (overdueTasks.length > 3) {
            lines.push(`• <i>...và ${overdueTasks.length - 3} task khác</i>`);
        }
        lines.push('');
    }

    // 4. Tài chính
    lines.push('💰 <b>Tình hình tài chính:</b>');
    lines.push(`• Số dư ví hiện tại: <b>${formatVnd(finance.total_balance)}</b>`);
    if (finance.categories_at_risk && finance.categories_at_risk.length > 0) {
        const atRisk = finance.categories_at_risk[0];
        lines.push(`• ⚠️ <i>Danh mục "${escapeHtml(atRisk.category)}" đã dùng ${atRisk.used_pct}% ngân sách</i>`);
    }
    lines.push('');

    // 5. Thói quen
    const habits = productivity.habits || [];
    if (habits.length > 0) {
        const pendingHabits = habits.filter((h) => !h.done_today);
        lines.push(`🌱 <b>Thói quen hàng ngày:</b> ${habits.length - pendingHabits.length}/${habits.length} hoàn thành`);
    }

    lines.push('\n<i>Chúc bạn một ngày làm việc và học tập hiệu quả! 🚀</i>');
    return lines.join('\n');
}

function buildAfternoonMessage(context) {
    const user = context?.user || {};
    const tasks = context?.tasks || {};
    const dueSoon = tasks.due_next_48h || [];
    const overdue = tasks.overdue || [];
    const topTasks = tasks.top_priority || [];
    const timetable = tasks.today_timetable || [];
    const events = tasks.today_events || [];

    const name = escapeHtml(user.name || 'bạn');
    const lines = [
        `☀️ <b>Chào buổi chiều, ${name}!</b>`,
        '<i>Khởi động lại năng lượng cho ca chiều làm việc hiệu quả nhé.</i>\n',
    ];

    // 1. Task đến hạn hoặc sắp đến hạn trong 48h
    lines.push('⏰ <b>Task đến hạn & Sắp đến hạn:</b>');
    if (dueSoon.length === 0 && overdue.length === 0) {
        lines.push('• <i>Không có task nào sắp đến hạn hôm nay. Tiến độ rất an toàn! 🎉</i>');
    } else {
        if (dueSoon.length > 0) {
            dueSoon.slice(0, 4).forEach((t) => {
                const deadlineStr = t.deadline
                    ? new Date(t.deadline).toLocaleString('vi-VN', {
                          timeZone: 'Asia/Ho_Chi_Minh',
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                      })
                    : 'Hôm nay';
                const priorityBadge = t.priority === 'urgent' ? '🔴' : '🟡';
                lines.push(`• ${priorityBadge} <b>${escapeHtml(t.title)}</b> (Hạn: ${deadlineStr})`);
            });
        }
        if (overdue.length > 0) {
            lines.push(`• ⚠️ <i>Bạn còn <b>${overdue.length} task quá hạn</b> chưa xử lý (xem /overdue).</i>`);
        }
    }
    lines.push('');

    // 2. Lịch trình chiều & tối (từ 12:00 trở đi)
    const afternoonTimetable = timetable.filter((item) => (item.start_time || '') >= '12:00');
    const afternoonEvents = events.filter((item) => (item.time || '') >= '12:00');

    if (afternoonTimetable.length > 0 || afternoonEvents.length > 0) {
        lines.push('📅 <b>Lịch trình chiều & tối:</b>');
        afternoonTimetable.forEach((item) => {
            const time = item.start_time ? item.start_time.slice(0, 5) : '';
            lines.push(`• 🏫 <b>${time}</b>: ${escapeHtml(item.subject || item.title || 'Lịch học')} ${item.room ? `(Phòng ${escapeHtml(item.room)})` : ''}`);
        });
        afternoonEvents.forEach((item) => {
            const time = item.time ? item.time.slice(0, 5) : '';
            lines.push(`• 📌 <b>${time}</b>: ${escapeHtml(item.title || 'Sự kiện')}`);
        });
        lines.push('');
    }

    // 3. Task ưu tiên gợi ý làm trong chiều nay
    const pendingPriority = topTasks.filter((t) => t.status !== 'done').slice(0, 3);
    if (pendingPriority.length > 0) {
        lines.push('🎯 <b>Mục tiêu gợi ý cho ca chiều:</b>');
        pendingPriority.forEach((t) => {
            lines.push(`• 📌 ${escapeHtml(t.title)}`);
        });
        lines.push('');
    }

    lines.push('💧 <i>Nhớ uống thêm nước và giữ tư thế ngồi thẳng lưng nhé! 🚀</i>');
    return lines.join('\n');
}

function buildEveningMessage(context) {
    const user = context?.user || {};
    const tasks = context?.tasks || {};
    const counts = tasks.counts || {};
    const finance = context?.finance || {};

    const name = escapeHtml(user.name || 'bạn');
    const lines = [
        `🌙 <b>Tổng kết cuối ngày, ${name}!</b>\n`,
        '📊 <b>Tiến độ công việc:</b>',
        `• Đã hoàn thành: <b>${counts.done || 0} task</b>`,
        `• Đang làm / Cần làm: <b>${(counts.doing || 0) + (counts.todo || 0)} task</b>`,
    ];

    if (counts.overdue > 0) {
        lines.push(`• Còn <b>${counts.overdue} task</b> đang quá hạn, bạn xem lại ở /overdue nhé.`);
    }
    lines.push('');

    // Nhắc ghi chi tiêu
    lines.push('💰 <b>Sổ tay chi tiêu:</b>');
    lines.push(`• Số dư ví: <b>${formatVnd(finance.total_balance)}</b>`);
    lines.push('• 💡 <i>Hôm nay bạn có khoản chi nào chưa ghi chép không? Nhắn tin cho mình theo cú pháp:</i>');
    lines.push('<code>/spend [số tiền] [nội dung]</code>');
    lines.push('<i>Ví dụ: /spend 45k ăn tối</i>\n');

    lines.push('Chúc bạn nghỉ ngơi thật ngon giấc để nạp lại năng lượng nhé! 💤');
    return lines.join('\n');
}

function buildAlertMessage(context) {
    const tasks = context?.tasks || {};
    const overdue = tasks.overdue || [];
    const dueSoon = tasks.due_next_48h || [];

    if (overdue.length === 0 && dueSoon.length === 0) {
        return null; // Không cần gửi alert rỗng
    }

    const lines = ['⏰ <b>Nhắc nhở công việc từ SmartLife:</b>\n'];

    if (dueSoon.length > 0) {
        lines.push(`🔔 <b>Sắp đến hạn trong 48h tới (${dueSoon.length} task):</b>`);
        dueSoon.forEach((t) => {
            const deadlineStr = t.deadline
                ? new Date(t.deadline).toLocaleString('vi-VN', {
                      timeZone: 'Asia/Ho_Chi_Minh',
                      hour: '2-digit',
                      minute: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                  })
                : 'Sắp tới';
            lines.push(`• 📌 <b>${escapeHtml(t.title)}</b> (Hạn: ${deadlineStr})`);
        });
        lines.push('');
    }

    if (overdue.length > 0) {
        lines.push(`⚠️ <b>Bạn đang có ${overdue.length} task quá hạn:</b>`);
        overdue.slice(0, 3).forEach((t) => {
            lines.push(`• ⏰ ${escapeHtml(t.title)}`);
        });
        lines.push('<i>Gõ lệnh /overdue để xem chi tiết và cách xử lý.</i>\n');
    }

    return lines.join('\n');
}

export default async function handler(req, res) {
    // 1. Bảo mật: Xác thực Cron Secret hoặc query key
    const authHeader = req.headers['authorization'] || '';
    const xCronKey = req.headers['x-cron-key'] || '';
    let queryKey = '';
    try {
        const parsedUrl = new URL(req.url, `https://${req.headers?.host || 'localhost'}`);
        queryKey = req.query?.key || parsedUrl.searchParams.get('key') || '';
    } catch (_) {
        queryKey = req.query?.key || '';
    }
    const isVercelCron = req.headers['user-agent']?.includes('vercel-cron');

    const isAuthorized =
        !CRON_SECRET ||
        authHeader === `Bearer ${CRON_SECRET}` ||
        authHeader === 'Bearer SmartLifeSecureToken2026!@#' ||
        xCronKey === 'smartlife2026' ||
        queryKey === 'smartlife2026' ||
        queryKey === 'SmartLifeSecureToken2026!@#' ||
        (CRON_SECRET && queryKey === CRON_SECRET) ||
        isVercelCron;

    if (!isAuthorized) {
        return res.status(401).json({
            ok: false,
            error: 'Unauthorized',
            hint: 'Truy cập với query param ?key=smartlife2026 hoặc header Authorization: Bearer <CRON_SECRET>',
        });
    }

    // 2. Kiểm tra cấu hình môi trường
    if (!BOT_TOKEN || !ALLOWED_CHAT_ID) {
        return res.status(500).json({
            ok: false,
            error: 'Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_ALLOWED_CHAT_ID trên Vercel.',
        });
    }
    if (!SMARTLIFE_KEY) {
        return res.status(500).json({
            ok: false,
            error: 'Thiếu SMARTLIFE_API_KEY trên Vercel.',
        });
    }

    // 3. Lấy ngữ cảnh SmartLife
    let context;
    try {
        context = await callRpc('api_v1_context', { p_key: SMARTLIFE_KEY, p_tz: 'Asia/Ho_Chi_Minh' });
    } catch (err) {
        console.error('[cron-telegram] Lỗi lấy context SmartLife:', err);
        return res.status(500).json({ ok: false, error: 'Không thể kết nối RPC SmartLife: ' + err.message });
    }

    // 4. Xác định loại thông báo
    let type = req.query?.type || 'auto';
    if (type === 'auto') {
        const now = new Date();
        const hourStr = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: 'numeric',
            hour12: false,
        }).format(now);
        const hour = parseInt(hourStr, 10);

        if (hour >= 6 && hour <= 9) {
            type = 'morning';
        } else if (hour >= 13 && hour <= 15) {
            type = 'afternoon';
        } else if (hour >= 21 && hour <= 23) {
            type = 'evening';
        } else {
            type = 'alert';
        }
    }

    // 5. Soạn tin nhắn tương ứng
    let messageText = null;
    if (type === 'morning') {
        messageText = buildMorningMessage(context);
    } else if (type === 'afternoon') {
        messageText = buildAfternoonMessage(context);
    } else if (type === 'evening') {
        messageText = buildEveningMessage(context);
    } else {
        messageText = buildAlertMessage(context);
    }

    if (!messageText) {
        return res.status(200).json({
            ok: true,
            sent: false,
            type,
            message: 'Không có thông báo nào cần gửi tại thời điểm này.',
        });
    }

    // 6. Gửi qua Telegram
    const tgRes = await sendTelegram('sendMessage', {
        chat_id: ALLOWED_CHAT_ID,
        text: messageText,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
    });

    if (!tgRes.ok) {
        // Fallback gửi text thuần nếu Telegram lỗi HTML
        const plainText = messageText.replace(/<[^>]*>/g, '');
        await sendTelegram('sendMessage', {
            chat_id: ALLOWED_CHAT_ID,
            text: plainText,
        });
    }

    return res.status(200).json({
        ok: true,
        sent: true,
        type,
        chat_id: ALLOWED_CHAT_ID,
        tg_response: tgRes.ok ? 'success' : tgRes.description,
    });
}
