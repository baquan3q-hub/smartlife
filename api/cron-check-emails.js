// File: api/cron-check-emails.js
// Vercel Cron Job — Server-side email notification scanner
// Runs every 5 minutes (configured in vercel.json) to ensure emails
// are sent even when the user doesn't have the app open.
//
// Flow:
// 1. Call check_deadline_notifications() RPC to scan & insert pending logs
// 2. Fetch all pending logs from email_notification_logs
// 3. For each pending log, fetch the source item details and send email via Resend
// 4. Update log status to 'sent' or 'failed'

import { createClient } from '@supabase/supabase-js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'SmartLife <onboarding@resend.dev>';
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

function formatMinutesLeft(minutesLeft, lang = 'vi') {
    const isEn = lang === 'en';
    if (minutesLeft <= 0) return isEn ? 'Overdue!' : 'Đã quá hạn!';
    if (minutesLeft < 60) return isEn ? `${minutesLeft} minutes` : `${minutesLeft} phút`;

    const days = Math.floor(minutesLeft / 1440);
    const hrs = Math.floor((minutesLeft % 1440) / 60);
    const mins = minutesLeft % 60;

    if (days > 0) {
        return isEn
            ? `${days} day(s) ${hrs > 0 ? `${hrs} hour(s)` : ''}`
            : `${days} ngày ${hrs > 0 ? `${hrs} giờ` : ''}`;
    }
    return isEn
        ? `${hrs} hour(s) ${mins > 0 ? `${mins} min(s)` : ''}`
        : `${hrs} giờ ${mins > 0 ? `${mins} phút` : ''}`;
}

function buildEmailHtml(sourceType, title, desc, timeLeftStr, item, lang = 'vi') {
    const isEn = lang === 'en';

    const configs = {
        todo: {
            subject: isEn ? `⏰ [SmartLife] Deadline Alert: "${title}"` : `⏰ [SmartLife] Nhắc nhở hạn chót: "${title}"`,
            gradient: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
            headerColor: '#0c4a6e', subColor: '#0284c7',
            accentColor: '#0284c7', btnGradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            heading: isEn ? 'Task Deadline Alert' : 'Nhắc Nhở Hạn Chót Task',
            sub: isEn ? 'Stay on track with SmartLife' : 'Quản lý thời gian thông minh cùng SmartLife',
            body: isEn
                ? `This is a reminder that your task is approaching its deadline in <strong>${timeLeftStr}</strong>.`
                : `Hệ thống ghi nhận công việc sau của bạn sắp đến hạn trong <strong>${timeLeftStr}</strong>.`,
            label: isEn ? 'Task' : 'Nhiệm vụ',
            timeLine: item.deadline ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: #475569;"><strong>${isEn ? 'Due Date' : 'Hạn chót'}:</strong> ${new Date(item.deadline).toLocaleString(isEn ? 'en-US' : 'vi-VN')}</p>` : '',
            descLabel: isEn ? 'Description' : 'Mô tả',
            btnText: isEn ? 'View on SmartLife' : 'Xem trên SmartLife'
        },
        calendar_event: {
            subject: isEn ? `📅 [SmartLife] Upcoming Event: "${title}"` : `📅 [SmartLife] Sự kiện sắp diễn ra: "${title}"`,
            gradient: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            headerColor: '#14532d', subColor: '#16a34a',
            accentColor: '#16a34a', btnGradient: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
            heading: isEn ? 'Upcoming Event Reminder' : 'Nhắc Nhở Sự Kiện Sắp Tới',
            sub: isEn ? 'Never miss a moment' : 'Luôn đồng hành cùng lịch trình của bạn',
            body: isEn
                ? `You have an event coming up in <strong>${timeLeftStr}</strong>.`
                : `Bạn có sự kiện lịch sắp bắt đầu trong <strong>${timeLeftStr}</strong>.`,
            label: isEn ? 'Event' : 'Sự kiện',
            timeLine: `<p style="margin: 0 0 8px 0; font-size: 13px; color: #475569;"><strong>${isEn ? 'Time' : 'Thời gian'}:</strong> ${item.date || ''} ${item.time ? item.time.slice(0, 5) : ''}</p>`,
            descLabel: isEn ? 'Location' : 'Địa điểm',
            btnText: isEn ? 'Open Calendar' : 'Mở Lịch SmartLife'
        },
        timetable: {
            subject: isEn ? `🏫 [SmartLife] Timetable Reminder: "${title}"` : `🏫 [SmartLife] Lịch học/làm việc: "${title}"`,
            gradient: 'linear-gradient(135deg, #f5f3ff 0%, #e0e7ff 100%)',
            headerColor: '#4c1d95', subColor: '#7c3aed',
            accentColor: '#7c3aed', btnGradient: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
            heading: isEn ? 'Timetable Reminder' : 'Nhắc Nhở Lịch Cố Định',
            sub: isEn ? 'Build positive study habits' : 'Học tập và làm việc kỷ luật mỗi ngày',
            body: isEn
                ? `Your scheduled timetable event starts in <strong>${timeLeftStr}</strong>.`
                : `Lịch biểu cố định hôm nay của bạn sẽ bắt đầu trong <strong>${timeLeftStr}</strong>.`,
            label: isEn ? 'Class/Task' : 'Lịch trình',
            timeLine: `<p style="margin: 0 0 8px 0; font-size: 13px; color: #475569;"><strong>${isEn ? 'Start Time' : 'Giờ bắt đầu'}:</strong> ${item.start_time ? item.start_time.slice(0, 5) : ''} ${item.end_time ? ` - ${item.end_time.slice(0, 5)}` : ''}</p>`,
            descLabel: isEn ? 'Location' : 'Địa điểm',
            btnText: isEn ? 'Open SmartLife' : 'Xem trên SmartLife'
        }
    };

    const c = configs[sourceType];
    if (!c) return { subject: '', html: '' };

    const html = `
    <div style="background-color: #f8fafc; padding: 40px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0;">
        <div style="background: ${c.gradient}; padding: 35px 20px; text-align: center;">
          <div style="margin-bottom: 12px;">
            <img src="https://smartlife.courses/pwa-192x192.png" alt="SmartLife Logo" style="width: 54px; height: 54px; border-radius: 14px; display: inline-block; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);" />
          </div>
          <h2 style="margin: 0; font-size: 22px; font-weight: 800; color: ${c.headerColor};">${c.heading}</h2>
          <p style="margin: 5px 0 0 0; font-size: 13px; color: ${c.subColor}; font-weight: 600;">${c.sub}</p>
        </div>
        <div style="padding: 35px 25px; color: #334155;">
          <p style="font-size: 15px; margin-top: 0; color: #475569;">${isEn ? 'Hello,' : 'Xin chào bạn,'}</p>
          <p style="font-size: 15px; line-height: 1.6; color: #475569;">${c.body}</p>
          <div style="background-color: #f8fafc; border-left: 4px solid ${c.accentColor}; padding: 20px; margin: 25px 0; border-radius: 0 16px 16px 0;">
            <p style="margin: 0 0 8px 0; font-size: 15px; color: #0f172a;"><strong>${c.label}:</strong> ${title}</p>
            ${c.timeLine}
            <p style="margin: 0; font-size: 13px; color: #64748b;"><strong>${c.descLabel}:</strong> ${desc}</p>
          </div>
          <div style="text-align: center; margin: 30px 0 10px 0;">
            <a href="https://smartlife.courses" style="display: inline-block; background: ${c.btnGradient}; color: white; padding: 12px 30px; text-decoration: none; font-weight: bold; border-radius: 12px; font-size: 14px;">${c.btnText}</a>
          </div>
        </div>
        <div style="padding: 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; line-height: 1.6;">
          <div style="margin-bottom: 4px;">
            ${isEn ? 'This is an automated notification. To disable email reminders, update your settings in the app.' : 'Đây là email thông báo tự động. Để tắt, vui lòng điều chỉnh trong Cài đặt.'}
          </div>
          <div style="color: #64748b; font-weight: 600;">
            ${isEn ? 'Support: baquan3q@gmail.com' : 'Hỗ trợ: baquan3q@gmail.com'}
          </div>
        </div>
      </div>
    </div>`;

    return { subject: c.subject, html };
}

export default async function handler(req, res) {
    // Security: Verify cron secret (Vercel sends this header for cron jobs)
    if (CRON_SECRET && req.headers['authorization'] !== `Bearer ${CRON_SECRET}`) {
        console.warn('[CronEmail] Unauthorized cron request');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!RESEND_API_KEY || !supabaseUrl || !supabaseServiceKey) {
        console.error('[CronEmail] Missing environment variables');
        return res.status(500).json({ error: 'Missing required environment variables' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    let scannedCount = 0;
    let sentCount = 0;
    let failedCount = 0;

    try {
        // Step 1: Call check_deadline_notifications() RPC to scan and create pending logs
        const { data: scannedItems, error: rpcError } = await supabase.rpc('check_deadline_notifications');

        if (rpcError) {
            console.error('[CronEmail] RPC error:', rpcError.message);
            // Continue — there might still be pending logs from client-side
        } else {
            scannedCount = scannedItems?.length || 0;
            console.log(`[CronEmail] Scanned ${scannedCount} new notifications via RPC`);
        }

        // Step 2: Fetch ALL pending email notification logs (including those created by client-side)
        const { data: pendingLogs, error: fetchError } = await supabase
            .from('email_notification_logs')
            .select('*')
            .eq('status', 'pending')
            .order('sent_at', { ascending: true })
            .limit(50); // Process max 50 per run to avoid timeout

        if (fetchError) {
            console.error('[CronEmail] Error fetching pending logs:', fetchError.message);
            return res.status(500).json({ error: 'Failed to fetch pending logs' });
        }

        if (!pendingLogs || pendingLogs.length === 0) {
            console.log('[CronEmail] No pending notifications to process');
            return res.status(200).json({ message: 'No pending notifications', scanned: scannedCount, sent: 0, failed: 0 });
        }

        console.log(`[CronEmail] Processing ${pendingLogs.length} pending notifications...`);

        // Step 3: Process each pending log
        for (const log of pendingLogs) {
            try {
                // Fetch the source item details based on source_type
                let item = null;
                let title = '';
                let desc = '';
                let minutesLeft = 0;

                if (log.source_type === 'todo') {
                    const { data: todo } = await supabase
                        .from('todos')
                        .select('*')
                        .eq('id', log.source_id)
                        .single();

                    if (!todo || todo.is_completed) {
                        // Skip completed todos — mark as sent to avoid re-processing
                        await supabase.from('email_notification_logs').update({ status: 'sent' }).eq('id', log.id);
                        continue;
                    }

                    item = todo;
                    title = todo.content || 'Unnamed task';
                    desc = todo.description || 'Không có chi tiết';
                    minutesLeft = todo.deadline ? Math.floor((new Date(todo.deadline).getTime() - Date.now()) / 60000) : 0;

                } else if (log.source_type === 'calendar_event') {
                    const { data: ce } = await supabase
                        .from('calendar_events')
                        .select('*')
                        .eq('id', log.source_id)
                        .single();

                    if (!ce) {
                        await supabase.from('email_notification_logs').update({ status: 'failed' }).eq('id', log.id);
                        failedCount++;
                        continue;
                    }

                    item = ce;
                    title = ce.title || 'Unnamed event';
                    desc = ce.location || ce.description || 'Không có chi tiết';
                    const timeStr = ce.time ? ce.time.padEnd(8, ':00').slice(0, 8) : '00:00:00';
                    minutesLeft = Math.floor((new Date(`${ce.date}T${timeStr}`).getTime() - Date.now()) / 60000);

                } else if (log.source_type === 'timetable') {
                    const { data: tt } = await supabase
                        .from('timetable')
                        .select('*')
                        .eq('id', log.source_id)
                        .single();

                    if (!tt) {
                        await supabase.from('email_notification_logs').update({ status: 'failed' }).eq('id', log.id);
                        failedCount++;
                        continue;
                    }

                    item = tt;
                    title = tt.title || 'Unnamed event';
                    desc = tt.location || 'Không có chi tiết';
                    const now = new Date();
                    const [eh, em] = tt.start_time.split(':').map(Number);
                    const eventDate = new Date(now);
                    eventDate.setHours(eh, em, 0, 0);
                    minutesLeft = Math.floor((eventDate.getTime() - now.getTime()) / 60000);
                }

                if (!item) {
                    await supabase.from('email_notification_logs').update({ status: 'failed' }).eq('id', log.id);
                    failedCount++;
                    continue;
                }

                // Build and send email
                const timeLeftStr = formatMinutesLeft(minutesLeft);
                const { subject, html } = buildEmailHtml(log.source_type, title, desc, timeLeftStr, item);

                if (!subject || !html) {
                    await supabase.from('email_notification_logs').update({ status: 'failed' }).eq('id', log.id);
                    failedCount++;
                    continue;
                }

                const resendResponse = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${RESEND_API_KEY}`,
                    },
                    body: JSON.stringify({
                        from: SENDER_EMAIL,
                        to: log.email_to,
                        subject,
                        html,
                    }),
                });

                if (resendResponse.ok) {
                    await supabase.from('email_notification_logs').update({ status: 'sent' }).eq('id', log.id);
                    sentCount++;
                    console.log(`[CronEmail] ✅ Sent ${log.source_type} email to ${log.email_to}: "${title}"`);
                } else {
                    const errData = await resendResponse.text();
                    console.error(`[CronEmail] ❌ Failed to send to ${log.email_to}:`, errData);
                    await supabase.from('email_notification_logs').update({ status: 'failed' }).eq('id', log.id);
                    failedCount++;
                }
            } catch (itemError) {
                console.error(`[CronEmail] Error processing log ${log.id}:`, itemError.message);
                await supabase.from('email_notification_logs').update({ status: 'failed' }).eq('id', log.id);
                failedCount++;
            }
        }

        const result = {
            message: 'Cron job completed',
            scanned: scannedCount,
            sent: sentCount,
            failed: failedCount,
            total_processed: pendingLogs.length,
            timestamp: new Date().toISOString()
        };

        console.log('[CronEmail] Job completed:', result);
        return res.status(200).json(result);

    } catch (error) {
        console.error('[CronEmail] Fatal error:', error.message);
        return res.status(500).json({ error: error.message });
    }
}
