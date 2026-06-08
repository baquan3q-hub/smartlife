// File: supabase/functions/send-gift-email/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("Missing RESEND_API_KEY environment variable");
    }

    const body = await req.json();
    const { to, toBatch, subject, html, userName, giftType, days, expiryDate, planName, note } = body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const rawEmails = toBatch || (to ? [to] : []);
    const emailList = rawEmails
      .map((email: string) => email.trim())
      .filter((email: string) => emailRegex.test(email));

    if (emailList.length === 0) {
      throw new Error("No valid recipients specified");
    }

    // Construct default HTML if not provided directly
    let finalHtml = html;
    if (!finalHtml) {
      const displayNote = note || "Chúc bạn học tập và làm việc hiệu quả cùng SmartLife!";
      if (giftType === "days") {
        finalHtml = `
          <div style="background-color: #f8fafc; padding: 40px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0;">
              <div style="background: linear-gradient(135deg, #f5f3ff 0%, #d8c4ff 100%); padding: 40px 20px; text-align: center; color: #3b0764;">
                <div style="margin-bottom: 16px;">
                  <img src="https://smartlife.courses/pwa-192x192.png" alt="SmartLife Logo" style="width: 64px; height: 64px; border-radius: 16px; border: 2px solid rgba(124, 58, 237, 0.25); display: inline-block; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);" />
                </div>
                <h2 style="margin: 0; font-size: 24px; font-weight: 800; tracking-tight; color: #3b0764;">Quà Tặng Premium!</h2>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #6d28d9; font-weight: 500;">Hệ sinh thái nâng cao hiệu suất SmartLife</p>
              </div>
              <div style="padding: 40px 30px; color: #334155;">
                <p style="font-size: 16px; line-height: 1.6; margin-top: 0;">Xin chào <strong>${userName || "Thành viên"}</strong>,</p>
                <p style="font-size: 15px; line-height: 1.7; color: #475569;">Quản trị viên vừa tặng bạn <strong>${days} ngày</strong> trải nghiệm gói dịch vụ <strong>SmartLife Pro</strong> cao cấp.</p>
                
                <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 20px; margin: 25px 0; border-radius: 0 16px 16px 0;">
                  <p style="margin: 0; font-size: 14px; color: #475569;"><strong>Thời hạn sử dụng:</strong> đến hết ngày ${expiryDate}</p>
                  <div style="margin-top: 12px; padding: 12px; background-color: #faf5ff; border-radius: 12px; border: 1px solid #f3e8ff; font-size: 13px; color: #64748b; font-style: italic;">
                    <strong>Lời nhắn từ Admin:</strong> "${displayNote}"
                  </div>
                </div>
                
                <p style="font-size: 14px; line-height: 1.6; color: #64748b;">Hãy mở ứng dụng ngay để trải nghiệm các tính năng lập lịch trình thông minh, nhật ký an toàn, và cố vấn học tập AI nhé!</p>
                
                <div style="text-align: center; margin: 35px 0 10px 0;">
                  <a href="https://smartlife.courses" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 14px 35px; text-decoration: none; font-weight: bold; border-radius: 16px; font-size: 15px; box-shadow: 0 10px 20px rgba(79, 70, 229, 0.2);">Mở Web App SmartLife</a>
                </div>
              </div>
              <div style="padding: 25px 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
                Đây là email tự động từ hệ thống SmartLife. Vui lòng không phản hồi trực tiếp email này.
              </div>
            </div>
          </div>
        `;
      } else if (giftType === "plan") {
        const planLabels: Record<string, string> = {
          free: "Miễn phí (Free)",
          trial: "Trải nghiệm (Trial 7 ngày)",
          pro: `SmartLife Pro (${days || 30} ngày)`,
          lifetime: "SmartLife Pro Vĩnh viễn (Lifetime)",
        };
        const planLabel = planLabels[planName] || planName;

        finalHtml = `
          <div style="background-color: #f8fafc; padding: 40px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0;">
              <div style="background: linear-gradient(135deg, #f5f3ff 0%, #d8c4ff 100%); padding: 40px 20px; text-align: center; color: #3b0764;">
                <div style="margin-bottom: 16px;">
                  <img src="https://smartlife.courses/pwa-192x192.png" alt="SmartLife Logo" style="width: 64px; height: 64px; border-radius: 16px; border: 2px solid rgba(124, 58, 237, 0.25); display: inline-block; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);" />
                </div>
                <h2 style="margin: 0; font-size: 24px; font-weight: 800; tracking-tight; color: #3b0764;">Cập Nhật Tài Khoản!</h2>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #6d28d9; font-weight: 500;">Hệ sinh thái nâng cao hiệu suất SmartLife</p>
              </div>
              <div style="padding: 40px 30px; color: #334155;">
                <p style="font-size: 16px; line-height: 1.6; margin-top: 0;">Xin chào <strong>${userName || "Thành viên"}</strong>,</p>
                <p style="font-size: 15px; line-height: 1.7; color: #475569;">Tài khoản của bạn vừa được quản trị viên điều chỉnh gói dịch vụ.</p>
                
                <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 20px; margin: 25px 0; border-radius: 0 16px 16px 0;">
                  <p style="margin: 0 0 8px 0; font-size: 15px; color: #334155;"><strong>Gói dịch vụ mới:</strong> <span style="color: #4f46e5; font-weight: bold; text-transform: uppercase;">${planLabel}</span></p>
                  ${expiryDate ? `<p style="margin: 0 0 8px 0; font-size: 14px; color: #475569;"><strong>Ngày hết hạn:</strong> ${expiryDate}</p>` : ''}
                  <div style="margin-top: 12px; padding: 12px; background-color: #faf5ff; border-radius: 12px; border: 1px solid #f3e8ff; font-size: 13px; color: #64748b; font-style: italic;">
                    <strong>Ghi chú:</strong> "${displayNote}"
                  </div>
                </div>
                
                <p style="font-size: 14px; line-height: 1.6; color: #64748b;">Nếu có bất kỳ thắc mắc nào, vui lòng liên hệ admin để được hỗ trợ nhanh nhất.</p>
                
                <div style="text-align: center; margin: 35px 0 10px 0;">
                  <a href="https://smartlife.courses" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 14px 35px; text-decoration: none; font-weight: bold; border-radius: 16px; font-size: 15px; box-shadow: 0 10px 20px rgba(79, 70, 229, 0.2);">Mở Web App SmartLife</a>
                </div>
              </div>
              <div style="padding: 25px 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
                Đây là email tự động từ hệ thống SmartLife. Vui lòng không phản hồi trực tiếp email này.
              </div>
            </div>
          </div>
        `;
      }
    }

    // Call Resend API: Use Batch API if there are multiple recipients, or single email API if only one.
    const results = [];
    if (emailList.length === 1) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "SmartLife <baquan@smartlife.courses>",
          to: emailList[0],
          subject: subject || "Thông báo từ SmartLife",
          html: finalHtml,
        }),
      });
      results.push(response);
    } else {
      // Chunk recipients into batches of 100 (Resend limit)
      const chunkSize = 100;
      for (let i = 0; i < emailList.length; i += chunkSize) {
        const chunk = emailList.slice(i, i + chunkSize);
        const batchPayload = chunk.map((recipient: string) => ({
          from: "SmartLife <baquan@smartlife.courses>",
          to: recipient,
          subject: subject || "Thông báo từ SmartLife",
          html: finalHtml,
        }));

        const response = await fetch("https://api.resend.com/emails/batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "batch-validation": "permissive",
            "batchValidation": "permissive",
          },
          body: JSON.stringify(batchPayload),
        });

        results.push(response);

        // Sleep 200ms between batches to avoid hitting Resend rate limit limits
        if (i + chunkSize < emailList.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    }

    const failed = [];
    const successDetails = [];
    const validationErrors = [];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (!r.ok) {
        const errText = await r.text();
        failed.push({ index: i, status: r.status, details: errText });
      } else {
        try {
          const resBody = await r.json();
          if (resBody.errors && resBody.errors.length > 0) {
            validationErrors.push(...resBody.errors);
          }
          if (resBody.data) {
            successDetails.push(...resBody.data);
          }
        } catch (_) {
          // Response body was not JSON or failed to parse
        }
      }
    }

    if (failed.length > 0) {
      console.error("Resend API hard errors:", failed);
      return new Response(
        JSON.stringify({ error: "Failed to send some or all email batches", details: failed }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        message: "Emails processed successfully!",
        successCount: successDetails.length,
        validationErrorsCount: validationErrors.length,
        validationErrors: validationErrors
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
