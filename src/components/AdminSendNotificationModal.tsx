// File: src/components/AdminSendNotificationModal.tsx
import React, { useState } from 'react';
import { X, Send, Bell, Mail, Info, Check } from 'lucide-react';
import { sendNotificationToUser, sendBatchNotification } from '../services/adminNotificationService';
import { NotificationType } from '../types';
import { supabase } from '../services/supabase';

interface AdminUser {
  id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  plan?: string;
}

interface AdminSendNotificationModalProps {
  targets: AdminUser[]; // users được chọn (1 hoặc nhiều)
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminSendNotificationModal: React.FC<AdminSendNotificationModalProps> = ({
  targets,
  onClose,
  onSuccess,
}) => {
  const [type, setType] = useState<NotificationType>('system');
  const [title, setTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [sendInApp, setSendInApp] = useState<boolean>(true);
  const [sendEmail, setSendEmail] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setErrorMsg('Tiêu đề và nội dung không được để trống');
      return;
    }
    if (!sendInApp && !sendEmail) {
      setErrorMsg('Vui lòng chọn ít nhất một hình thức gửi (In-app hoặc Email)');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessCount(null);

    try {
      const targetIds = targets.map(u => u.id);
      let inAppSuccess = true;
      let emailSuccess = true;

      // 1. Gửi in-app notifications
      if (sendInApp) {
        if (targetIds.length === 1) {
          inAppSuccess = await sendNotificationToUser(targetIds[0], type, title, message);
        } else {
          const res = await sendBatchNotification(targetIds, type, title, message);
          inAppSuccess = res.successCount > 0;
        }
      }

      // 2. Gửi email thông báo (Phase 2 calling Supabase Edge Function)
      if (sendEmail) {
        const emails = targets.map(u => u.email).filter(Boolean) as string[];
        if (emails.length > 0) {
          try {
            // Gọi Edge function qua Supabase client
            const { error: emailErr } = await supabase.functions.invoke('send-gift-email', {
              body: {
                toBatch: emails, // Hỗ trợ gửi batch trong Edge Function
                subject: title,
                html: `<div style="background-color: #f8fafc; padding: 40px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                  <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0;">
                    <div style="background: linear-gradient(135deg, #f5f3ff 0%, #d8c4ff 100%); padding: 40px 20px; text-align: center; color: #3b0764;">
                      <div style="margin-bottom: 16px;">
                        <img src="https://smartlife.courses/pwa-192x192.png" alt="SmartLife Logo" style="width: 64px; height: 64px; border-radius: 16px; border: 2px solid rgba(124, 58, 237, 0.25); display: inline-block; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);" />
                      </div>
                      <h2 style="margin: 0; font-size: 24px; font-weight: 800; tracking-tight; color: #3b0764;">Thông Báo Mới</h2>
                      <p style="margin: 5px 0 0 0; font-size: 14px; color: #6d28d9; font-weight: 500;">Hệ sinh thái nâng cao hiệu suất SmartLife</p>
                    </div>
                    <div style="padding: 40px 30px; color: #334155;">
                      <h3 style="color: #1e293b; font-size: 18px; font-weight: 700; margin-top: 0; margin-bottom: 16px;">${title}</h3>
                      <p style="font-size: 15px; line-height: 1.7; color: #475569; white-space: pre-wrap; margin-bottom: 30px;">${message}</p>
                      
                      <div style="text-align: center; margin: 35px 0 10px 0;">
                        <a href="https://smartlife.courses" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 14px 35px; text-decoration: none; font-weight: bold; border-radius: 16px; font-size: 15px; box-shadow: 0 10px 20px rgba(79, 70, 229, 0.2);">Truy cập SmartLife ngay</a>
                      </div>
                    </div>
                    <div style="padding: 25px 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
                      Đây là email tự động từ hệ thống SmartLife. Vui lòng không phản hồi trực tiếp email này.
                    </div>
                  </div>
                </div>`,
              },
            });
            emailSuccess = !emailErr;
            if (emailErr) console.error('Email invoke error:', emailErr);
          } catch (emailErr) {
            console.error('Failed to trigger email function:', emailErr);
            emailSuccess = false;
          }
        }
      }

      if (inAppSuccess || emailSuccess) {
        setSuccessCount(targetIds.length);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setErrorMsg('Không thể gửi thông báo. Vui lòng kiểm tra cấu hình.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Bell size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Soạn & Gửi thông báo</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gửi tới {targets.length} người dùng được chọn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Form fields */}
          <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto">
            {successCount !== null && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-sm rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex items-center space-x-2">
                <Check size={18} className="flex-shrink-0" />
                <span>Đã gửi thành công tới {successCount} người nhận!</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-900/30 flex items-start space-x-2">
                <Info size={16} className="mt-0.5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Target users summary */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 rounded-2xl">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                Người nhận
              </span>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 max-h-16 overflow-y-auto">
                {targets.length <= 5
                  ? targets.map(t => t.full_name || t.email).join(', ')
                  : `${targets.slice(0, 5).map(t => t.full_name || t.email).join(', ')} và ${targets.length - 5} người khác`}
              </p>
            </div>

            {/* Notification Type */}
            <div>
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                Loại thông báo
              </label>
              <select
                value={type}
                onChange={e => setType(e.target.value as NotificationType)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              >
                <option value="system">⚙️ Hệ thống (System)</option>
                <option value="gift_pro">🎁 Quà tặng Pro (Gift)</option>
                <option value="extend_pro">⏰ Gia hạn dịch vụ (Extend)</option>
                <option value="promo">📢 Khuyến mãi & Sự kiện (Promo)</option>
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                Tiêu đề thông báo
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                placeholder="Nhập tiêu đề..."
                required
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                Nội dung thông báo (hỗ trợ Emoji)
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                placeholder="Nhập nội dung chi tiết..."
                required
              />
            </div>

            {/* Delivery channels */}
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/60 space-y-3">
              <h5 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Hình thức gửi</h5>
              
              <div className="flex items-center justify-between">
                <label htmlFor="notif-send-in-app" className="flex items-center text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <Bell size={16} className="mr-2 text-indigo-500" />
                  Gửi thông báo trên ứng dụng (In-app)
                </label>
                <input
                  id="notif-send-in-app"
                  type="checkbox"
                  checked={sendInApp}
                  onChange={e => setSendInApp(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-3">
                <label htmlFor="notif-send-email" className="flex items-center text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <Mail size={16} className="mr-2 text-indigo-500" />
                  Gửi email thông báo (Resend)
                </label>
                <input
                  id="notif-send-email"
                  type="checkbox"
                  checked={sendEmail}
                  onChange={e => setSendEmail(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm rounded-xl transition-all disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim() || !message.trim()}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/10 transition-all flex items-center space-x-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Send size={16} />
              )}
              <span>Gửi thông báo</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
