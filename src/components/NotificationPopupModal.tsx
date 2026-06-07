// File: src/components/NotificationPopupModal.tsx
import React, { useState } from 'react';
import { Bell, Gift, Calendar, Info, MessageSquare, Check, Crown, Sparkles, Quote } from 'lucide-react';
import { UserNotification } from '../types';
import { markAllNotificationsAsRead } from '../services/adminNotificationService';

interface NotificationPopupModalProps {
  userId: string;
  notifications: UserNotification[];
  onClose: () => void;
}

interface ParsedNotification {
  mainMsg: string;
  badge?: string;
  expiry?: string;
  note?: string;
}

// Hàm phân tích tin nhắn thông minh để rút trích dữ liệu thành dạng infographic đẹp đẽ
const parseNotificationMessage = (msg: string, type: string): ParsedNotification => {
  if (type !== 'gift_pro' && type !== 'extend_pro') {
    return { mainMsg: msg };
  }

  // Lấy ghi chú/lý do từ tin nhắn
  let note = '';
  const noteMatch = msg.match(/(?:Ghi chú|Lý do|Ghi chú từ Admin):\s*([^\n.]+)/i);
  if (noteMatch) {
    note = noteMatch[1].trim();
  }

  // Lấy ngày hết hạn
  let expiry = '';
  const expiryMatch = msg.match(/(?:đến hết ngày|đến ngày|hạn dùng đến ngày|hạn sử dụng đến ngày|Hết hạn:|hạn đến ngày)\s*([\d/.-]+)/i);
  if (expiryMatch) {
    expiry = expiryMatch[1].trim();
  }

  // Lấy số ngày
  let daysText = '';
  const daysMatch = msg.match(/(\d+)\s*ngày/i);
  if (daysMatch) {
    daysText = `${daysMatch[1]} ngày Pro`;
  }

  let mainMsg = msg;
  // Làm sạch và tinh chỉnh câu chữ mô tả
  if (msg.includes('Vĩnh viễn') || msg.includes('Lifetime')) {
    mainMsg = 'Tài khoản của bạn đã được nâng cấp lên đặc quyền Vĩnh viễn (Lifetime). Hãy cùng khám phá ngay các tính năng cao cấp!';
    daysText = 'Pro Vĩnh Viễn';
  } else if (daysText) {
    mainMsg = `Quản trị viên vừa gửi tặng bạn đặc quyền trải nghiệm trọn bộ tính năng SmartLife Pro cao cấp.`;
  } else {
    // Cắt bỏ phần ghi chú dài dòng ở cuối nếu có
    mainMsg = msg.replace(/(?:Ghi chú|Lý do|Ghi chú từ Admin):\s*.*$/i, '').trim();
  }

  return {
    mainMsg,
    badge: daysText || undefined,
    expiry: expiry || undefined,
    note: note && note !== 'Không có ghi chú' ? note : undefined
  };
};

export const NotificationPopupModal: React.FC<NotificationPopupModalProps> = ({
  userId,
  notifications,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await markAllNotificationsAsRead(userId);
      onClose();
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const isSingle = notifications.length === 1;
  const firstNotif = notifications[0];
  const isGift = notifications.some(n => n.type === 'gift_pro' || n.type === 'extend_pro');
  const parsedSingle = isSingle ? parseNotificationMessage(firstNotif.message, firstNotif.type) : null;

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'gift_pro':
        return (
          <div className="relative flex items-center justify-center">
            <span className="absolute inline-flex h-20 w-20 rounded-full bg-amber-400/20 animate-ping" />
            <div className="relative p-5 bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 text-white rounded-3xl shadow-xl shadow-amber-500/30">
              <Crown size={32} className="animate-pulse" />
            </div>
          </div>
        );
      case 'extend_pro':
        return (
          <div className="relative flex items-center justify-center">
            <span className="absolute inline-flex h-20 w-20 rounded-full bg-indigo-400/20 animate-ping" />
            <div className="relative p-5 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 text-white rounded-3xl shadow-xl shadow-indigo-500/30">
              <Sparkles size={32} />
            </div>
          </div>
        );
      case 'promo':
        return (
          <div className="p-5 bg-gradient-to-tr from-purple-600 to-pink-500 text-white rounded-3xl shadow-xl shadow-purple-500/20">
            <MessageSquare size={32} />
          </div>
        );
      default:
        return (
          <div className="p-5 bg-gradient-to-tr from-slate-600 to-slate-500 text-white rounded-3xl shadow-xl shadow-slate-500/20">
            <Info size={32} />
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className={`relative bg-white dark:bg-slate-900 border ${
        isGift 
          ? 'border-amber-200/80 dark:border-amber-900/60 shadow-amber-500/10' 
          : 'border-slate-100 dark:border-slate-800 shadow-indigo-500/5'
      } rounded-[36px] shadow-2xl w-full max-w-md overflow-hidden animate-scale-up`}>
        
        {/* Glow decorations for premium gifts */}
        {isGift && (
          <>
            <div className="absolute -top-12 -left-12 w-44 h-44 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-44 h-44 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          </>
        )}

        {/* Decorative Top Accent Bar */}
        <div className={`h-2.5 w-full bg-gradient-to-r ${
          isGift 
            ? 'from-amber-400 via-yellow-400 to-amber-500' 
            : 'from-indigo-500 via-purple-500 to-pink-500'
        }`} />

        <div className="p-8 text-center space-y-6">
          
          {/* Main Visual Header/Icon */}
          <div className="flex justify-center pt-2">
            {isSingle ? (
              getNotifIcon(firstNotif.type)
            ) : (
              <div className="relative flex items-center justify-center">
                <span className="absolute inline-flex h-20 w-20 rounded-full bg-indigo-400/15 animate-pulse" />
                <div className="relative p-5 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 text-white rounded-3xl shadow-xl shadow-indigo-500/30">
                  <Bell size={32} />
                </div>
              </div>
            )}
          </div>

          {/* Title Header */}
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {isSingle 
                ? (firstNotif.type === 'gift_pro' || firstNotif.type === 'extend_pro' 
                    ? 'Quà Tặng Premium! 🎉' 
                    : firstNotif.title)
                : 'Thông Báo Mới'
              }
            </h3>
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Hệ thống SmartLife
            </p>
          </div>

          {/* Core Content Box */}
          <div className="space-y-4">
            {isSingle && parsedSingle ? (
              /* Single notification celebratory layout */
              <div className="space-y-4">
                
                {/* Infographic Badges */}
                <div className="flex flex-wrap items-center gap-2 justify-center">
                  {parsedSingle.badge && (
                    <span className="px-4 py-1.5 text-xs font-black tracking-wider bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-full uppercase shadow-md shadow-amber-500/20 flex items-center gap-1.5 animate-pulse">
                      <Crown size={12} />
                      {parsedSingle.badge}
                    </span>
                  )}
                  {parsedSingle.expiry && (
                    <span className="px-4 py-1.5 text-xs font-bold bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-100/50 dark:border-indigo-900/30 flex items-center gap-1.5">
                      <Calendar size={12} />
                      Đến ngày: {parsedSingle.expiry}
                    </span>
                  )}
                </div>

                {/* Clean Smart Description */}
                <div className="bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl p-4 border border-slate-100/60 dark:border-slate-800/40">
                  <p className="text-sm text-slate-700 dark:text-slate-350 leading-relaxed font-semibold">
                    {parsedSingle.mainMsg}
                  </p>
                </div>

                {/* Styled Speach bubble for Note */}
                {parsedSingle.note && (
                  <div className="relative mt-2 p-4 bg-amber-50/30 dark:bg-slate-800/40 border border-amber-100/30 dark:border-slate-850 rounded-2xl">
                    <Quote size={14} className="absolute -top-1.5 left-4 text-amber-400 dark:text-slate-600 fill-amber-400/10 dark:fill-none" />
                    <p className="text-xs text-slate-650 dark:text-slate-400 italic text-left pl-3 font-medium">
                      "{parsedSingle.note}"
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Multiple notifications scrollable list */
              <div className="max-h-[260px] overflow-y-auto pr-1.5 space-y-4 scrollbar-thin text-left">
                {notifications.map((notif, index) => {
                  const parsed = parseNotificationMessage(notif.message, notif.type);
                  const isGiftType = notif.type === 'gift_pro' || notif.type === 'extend_pro';
                  return (
                    <div 
                      key={notif.id} 
                      className={`p-5 rounded-3xl border transition-all ${
                        isGiftType
                          ? 'bg-gradient-to-br from-amber-50/20 to-yellow-50/10 dark:from-amber-950/10 dark:to-slate-900/40 border-amber-200/50 dark:border-amber-900/20 shadow-lg shadow-amber-500/5'
                          : 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-100 dark:border-slate-850'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                          Thông báo {index + 1}
                        </span>
                        {parsed.badge && (
                          <span className="text-[9px] font-black uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 px-2 py-0.5 rounded-md border border-amber-200/30 dark:border-amber-900/40">
                            {parsed.badge}
                          </span>
                        )}
                      </div>
                      
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                        {notif.title}
                      </h4>
                      
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                        {parsed.mainMsg}
                      </p>

                      {parsed.note && (
                        <div className="mt-2.5 p-2 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-slate-100/40 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-450 italic">
                          "{parsed.note}"
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500 border-t border-slate-100/40 dark:border-slate-800/40 pt-2.5">
                        {parsed.expiry ? (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                            <Calendar size={10} /> Hạn dùng: {parsed.expiry}
                          </span>
                        ) : (
                          <span />
                        )}
                        <span>{new Date(notif.created_at).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Acknowledge Button */}
          <div className="pt-2">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={`w-full py-4 bg-gradient-to-r ${
                isGift 
                  ? 'from-amber-500 via-amber-600 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 shadow-amber-500/20' 
                  : 'from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-600/20'
              } text-white font-bold rounded-2xl shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-center space-x-2 disabled:opacity-50`}
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Check size={18} className="stroke-[3]" />
              )}
              <span className="tracking-wide">Đã hiểu, cảm ơn!</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
