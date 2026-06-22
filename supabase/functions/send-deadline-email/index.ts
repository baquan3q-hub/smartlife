// File: supabase/functions/send-deadline-email/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")?.trim();
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")?.trim();
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL")?.trim();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("Missing RESEND_API_KEY environment variable");
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase configuration environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();

    const {
      logId,
      to,
      lang = "vi",
      sourceType, // 'todo' | 'timetable' | 'calendar_event'
      item,       // { title/content, description/location, deadline/start_time, etc. }
      minutesLeft
    } = body;

    if (!to || !sourceType || !item) {
      throw new Error("Missing required parameters in request body");
    }

    // Build the email template based on type and language
    const isEn = lang === "en";
    let subject = "";
    let contentHtml = "";

    // Formatting values
    const title = item.content || item.title || (isEn ? "Unnamed task" : "Công việc không tên");
    const desc = item.description || item.location || (isEn ? "No details provided" : "Không có chi tiết");
    
    // Format minutes left
    let timeLeftStr = "";
    if (minutesLeft !== undefined) {
      if (minutesLeft <= 0) {
        timeLeftStr = isEn ? "Overdue!" : "Đã quá hạn!";
      } else if (minutesLeft < 60) {
        timeLeftStr = isEn ? `${minutesLeft} minutes` : `${minutesLeft} phút`;
      } else {
        const hrs = Math.floor(minutesLeft / 60);
        const mins = minutesLeft % 60;
        timeLeftStr = isEn 
          ? `${hrs} hour(s) ${mins > 0 ? `${mins} min(s)` : ""}` 
          : `${hrs} giờ ${mins > 0 ? `${mins} phút` : ""}`;
      }
    }

    if (sourceType === "todo") {
      subject = isEn 
        ? `⏰ [SmartLife] Deadline Alert: "${title}"` 
        : `⏰ [SmartLife] Nhắc nhở hạn chót: "${title}"`;

      contentHtml = `
        <div style="background-color: #f8fafc; padding: 40px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0;">
            <div style="background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%); padding: 35px 20px; text-align: center; color: #0369a1;">
              <div style="margin-bottom: 12px;">
                <img src="https://smartlife.courses/pwa-192x192.png" alt="SmartLife Logo" style="width: 54px; height: 54px; border-radius: 14px; display: inline-block; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);" />
              </div>
              <h2 style="margin: 0; font-size: 22px; font-weight: 800; color: #0c4a6e;">${isEn ? "Task Deadline Alert" : "Nhắc Nhở Hạn Chót Task"}</h2>
              <p style="margin: 5px 0 0 0; font-size: 13px; color: #0284c7; font-weight: 600;">${isEn ? "Stay on track with SmartLife" : "Quản lý thời gian thông minh cùng SmartLife"}</p>
            </div>
            <div style="padding: 35px 25px; color: #334155;">
              <p style="font-size: 15px; margin-top: 0; color: #475569;">${isEn ? "Hello," : "Xin chào bạn,"}</p>
              <p style="font-size: 15px; line-height: 1.6; color: #475569;">
                ${isEn 
                  ? `This is a reminder that your task is approaching its deadline in <strong>${timeLeftStr}</strong>.` 
                  : `Hệ thống ghi nhận công việc sau của bạn sắp đến hạn trong <strong>${timeLeftStr}</strong>.`}
              </p>
              
              <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 20px; margin: 25px 0; border-radius: 0 16px 16px 0;">
                <p style="margin: 0 0 8px 0; font-size: 15px; color: #0f172a;"><strong>${isEn ? "Task" : "Nhiệm vụ"}:</strong> ${title}</p>
                ${item.deadline ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: #475569;"><strong>${isEn ? "Due Date" : "Hạn chót"}:</strong> ${new Date(item.deadline).toLocaleString(isEn ? 'en-US' : 'vi-VN')}</p>` : ''}
                <p style="margin: 0; font-size: 13px; color: #64748b; font-style: italic;"><strong>${isEn ? "Description" : "Mô tả"}:</strong> ${desc}</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0 10px 0;">
                <a href="https://smartlife.courses" style="display: inline-block; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: white; padding: 12px 30px; text-decoration: none; font-weight: bold; border-radius: 12px; font-size: 14px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.2);">${isEn ? "View on SmartLife" : "Xem trên SmartLife"}</a>
              </div>
            </div>
            <div style="padding: 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; line-height: 1.6;">
              <div style="margin-bottom: 4px;">
                ${isEn 
                  ? "This is an automated notification. To disable email reminders, please update your settings in the app." 
                  : "Đây là email thông báo tự động. Để tắt thông báo email, vui lòng điều chỉnh trong Cài đặt ứng dụng."}
              </div>
              <div style="color: #64748b; font-weight: 600;">
                ${isEn 
                  ? "Support contact: baquan3q@gmail.com" 
                  : "Liên hệ hỗ trợ: baquan3q@gmail.com"}
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (sourceType === "calendar_event") {
      subject = isEn 
        ? `📅 [SmartLife] Upcoming Event: "${title}"` 
        : `📅 [SmartLife] Sự kiện sắp diễn ra: "${title}"`;

      contentHtml = `
        <div style="background-color: #f8fafc; padding: 40px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0;">
            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 35px 20px; text-align: center; color: #166534;">
              <div style="margin-bottom: 12px;">
                <img src="https://smartlife.courses/pwa-192x192.png" alt="SmartLife Logo" style="width: 54px; height: 54px; border-radius: 14px; display: inline-block; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);" />
              </div>
              <h2 style="margin: 0; font-size: 22px; font-weight: 800; color: #14532d;">${isEn ? "Upcoming Event Reminder" : "Nhắc Nhở Sự Kiện Sắp Tới"}</h2>
              <p style="margin: 5px 0 0 0; font-size: 13px; color: #16a34a; font-weight: 600;">${isEn ? "Never miss a moment" : "Luôn đồng hành cùng lịch trình của bạn"}</p>
            </div>
            <div style="padding: 35px 25px; color: #334155;">
              <p style="font-size: 15px; margin-top: 0; color: #475569;">${isEn ? "Hello," : "Xin chào bạn,"}</p>
              <p style="font-size: 15px; line-height: 1.6; color: #475569;">
                ${isEn 
                  ? `You have an event coming up in <strong>${timeLeftStr}</strong>.` 
                  : `Bạn có sự kiện lịch sắp bắt đầu trong <strong>${timeLeftStr}</strong>.`}
              </p>
              
              <div style="background-color: #f8fafc; border-left: 4px solid #16a34a; padding: 20px; margin: 25px 0; border-radius: 0 16px 16px 0;">
                <p style="margin: 0 0 8px 0; font-size: 15px; color: #0f172a;"><strong>${isEn ? "Event" : "Sự kiện"}:</strong> ${title}</p>
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #475569;"><strong>${isEn ? "Time" : "Thời gian"}:</strong> ${item.date} ${item.time ? item.time.slice(0, 5) : ""}</p>
                <p style="margin: 0; font-size: 13px; color: #64748b;"><strong>${isEn ? "Location" : "Địa điểm"}:</strong> ${desc}</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0 10px 0;">
                <a href="https://smartlife.courses" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; padding: 12px 30px; text-decoration: none; font-weight: bold; border-radius: 12px; font-size: 14px; box-shadow: 0 4px 12px rgba(22, 163, 74, 0.2);">${isEn ? "Open Calendar" : "Mở Lịch SmartLife"}</a>
              </div>
            </div>
            <div style="padding: 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; line-height: 1.6;">
              <div style="margin-bottom: 4px;">
                ${isEn 
                  ? "This is an automated notification. To disable email reminders, please update your settings in the app." 
                  : "Đây là email thông báo tự động. Để tắt thông báo email, vui lòng điều chỉnh trong Cài đặt ứng dụng."}
              </div>
              <div style="color: #64748b; font-weight: 600;">
                ${isEn 
                  ? "Support contact: baquan3q@gmail.com" 
                  : "Liên hệ hỗ trợ: baquan3q@gmail.com"}
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (sourceType === "timetable") {
      subject = isEn 
        ? `🏫 [SmartLife] Timetable Reminder: "${title}"` 
        : `🏫 [SmartLife] Lịch học/làm việc cố định: "${title}"`;

      contentHtml = `
        <div style="background-color: #f8fafc; padding: 40px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0;">
            <div style="background: linear-gradient(135deg, #f5f3ff 0%, #e0e7ff 100%); padding: 35px 20px; text-align: center; color: #5b21b6;">
              <div style="margin-bottom: 12px;">
                <img src="https://smartlife.courses/pwa-192x192.png" alt="SmartLife Logo" style="width: 54px; height: 54px; border-radius: 14px; display: inline-block; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);" />
              </div>
              <h2 style="margin: 0; font-size: 22px; font-weight: 800; color: #4c1d95;">${isEn ? "Timetable Event Reminder" : "Nhắc Nhở Lịch Cố Định"}</h2>
              <p style="margin: 5px 0 0 0; font-size: 13px; color: #7c3aed; font-weight: 600;">${isEn ? "Build positive study habits" : "Học tập và làm việc kỷ luật mỗi ngày"}</p>
            </div>
            <div style="padding: 35px 25px; color: #334155;">
              <p style="font-size: 15px; margin-top: 0; color: #475569;">${isEn ? "Hello," : "Xin chào bạn,"}</p>
              <p style="font-size: 15px; line-height: 1.6; color: #475569;">
                ${isEn 
                  ? `Your scheduled timetable event starts in <strong>${timeLeftStr}</strong>.` 
                  : `Lịch biểu cố định hôm nay của bạn sẽ bắt đầu trong <strong>${timeLeftStr}</strong>.`}
              </p>
              
              <div style="background-color: #f8fafc; border-left: 4px solid #7c3aed; padding: 20px; margin: 25px 0; border-radius: 0 16px 16px 0;">
                <p style="margin: 0 0 8px 0; font-size: 15px; color: #0f172a;"><strong>${isEn ? "Class/Task" : "Lịch trình"}:</strong> ${title}</p>
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #475569;"><strong>${isEn ? "Start Time" : "Giờ bắt đầu"}:</strong> ${item.start_time.slice(0, 5)} ${item.end_time ? ` - ${item.end_time.slice(0, 5)}` : ""}</p>
                <p style="margin: 0; font-size: 13px; color: #64748b;"><strong>${isEn ? "Location" : "Địa điểm"}:</strong> ${desc}</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0 10px 0;">
                <a href="https://smartlife.courses" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: white; padding: 12px 30px; text-decoration: none; font-weight: bold; border-radius: 12px; font-size: 14px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.2);">${isEn ? "Open Timetable" : "Xem Thời Khóa Biểu"}</a>
              </div>
            </div>
            <div style="padding: 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; line-height: 1.6;">
              <div style="margin-bottom: 4px;">
                ${isEn 
                  ? "This is an automated notification. To disable email reminders, please update your settings in the app." 
                  : "Đây là email thông báo tự động. Để tắt thông báo email, vui lòng điều chỉnh trong Cài đặt ứng dụng."}
              </div>
              <div style="color: #64748b; font-weight: 600;">
                ${isEn 
                  ? "Support contact: baquan3q@gmail.com" 
                  : "Liên hệ hỗ trợ: baquan3q@gmail.com"}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Call Resend API
    console.log(`Sending email to ${to}...`);
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: SENDER_EMAIL || "SmartLife <onboarding@resend.dev>",
        to: to,
        subject: subject,
        html: contentHtml,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error(`Resend API Error: ${errorText}`);

      // Update log to failed
      if (logId) {
        await supabase
          .from("email_notification_logs")
          .update({ status: "failed" })
          .eq("id", logId);
      }

      throw new Error(`Resend send failed: ${errorText}`);
    }

    const resendData = await resendResponse.json();
    console.log("Email sent successfully!", resendData);

    // Update log status to sent
    if (logId) {
      await supabase
        .from("email_notification_logs")
        .update({ status: "sent" })
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify({ message: "Email sent successfully!", data: resendData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Function execution error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
