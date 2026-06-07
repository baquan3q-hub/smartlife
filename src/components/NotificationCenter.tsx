// File: src/components/NotificationCenter.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Gift, Calendar, ShieldAlert, Info, X, MessageSquare, Trash2 } from 'lucide-react';
import { getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../services/adminNotificationService';
import { UserNotification } from '../types';
import { supabase } from '../services/supabase';

interface NotificationCenterProps {
  userId: string;
  onClose: () => void;
  refetchTrigger: number;
  onUnreadCountChange: (count: number) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  userId,
  onClose,
  refetchTrigger,
  onUnreadCountChange,
}) => {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    setLoading(true);
    const data = await getUserNotifications(userId, 30);
    setNotifications(data);
    
    const unread = data.filter(n => !n.is_read).length;
    onUnreadCountChange(unread);
    setLoading(false);
  };

  useEffect(() => {
    loadNotifications();
  }, [userId, refetchTrigger]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleMarkAsRead = async (id: string) => {
    const success = await markNotificationAsRead(id);
    if (success) {
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
      // Recalculate unread count
      const updated = notifications.map(n => (n.id === id ? { ...n, is_read: true } : n));
      onUnreadCountChange(updated.filter(n => !n.is_read).length);
    }
  };

  const handleMarkAllRead = async () => {
    const success = await markAllNotificationsAsRead(userId);
    if (success) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      onUnreadCountChange(0);
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'gift_pro':
        return (
          <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
            <Gift size={18} />
          </div>
        );
      case 'extend_pro':
        return (
          <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
            <Calendar size={18} />
          </div>
        );
      case 'promo':
        return (
          <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
            <MessageSquare size={18} />
          </div>
        );
      default:
        return (
          <div className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl">
            <Info size={18} />
          </div>
        );
    }
  };

  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays === 1) return 'Hôm qua';
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div
      ref={panelRef}
      className="absolute right-4 md:right-auto md:left-4 bottom-24 md:bottom-20 z-50 w-80 max-w-[calc(100vw-32px)] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[420px]"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center space-x-2">
          <Bell size={18} className="text-indigo-600 dark:text-indigo-400" />
          <h4 className="font-bold text-slate-800 dark:text-white text-sm">Thông báo</h4>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-600 text-white rounded-full">
              {unreadCount} mới
            </span>
          )}
        </div>
        <div className="flex items-center space-x-1">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Đánh dấu tất cả đã đọc"
            >
              <CheckCheck size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-850/60 max-h-[320px] scrollbar-thin">
        {loading ? (
          <div className="p-8 text-center text-slate-400">
            <span className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
            <p className="text-xs mt-2">Đang tải thông báo...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Bell size={28} className="mx-auto text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-semibold text-slate-500">Không có thông báo mới</p>
            <p className="text-xs text-slate-400">Bạn sẽ nhận được thông báo khi admin gửi quà hoặc cập nhật gói</p>
          </div>
        ) : (
          notifications.map(notif => (
            <div
              key={notif.id}
              onClick={() => !notif.is_read && handleMarkAsRead(notif.id)}
              className={`p-3.5 flex items-start space-x-3 transition-colors cursor-pointer ${
                notif.is_read
                  ? 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
                  : 'bg-indigo-50/30 dark:bg-indigo-950/10 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20'
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getNotifIcon(notif.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1.5">
                  <h5 className={`text-xs truncate ${notif.is_read ? 'font-medium text-slate-700 dark:text-slate-300' : 'font-bold text-slate-900 dark:text-white'}`}>
                    {notif.title}
                  </h5>
                  {!notif.is_read && (
                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full flex-shrink-0 mt-1.5"></span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {notif.message}
                </p>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 block">
                  {formatTime(notif.created_at)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
