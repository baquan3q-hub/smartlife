// File: src/components/AdminDashboard.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { 
  ShieldAlert, Users, CheckCircle, RefreshCw, Activity, 
  UserPlus, LogIn, CreditCard, Crown, XCircle, Gift, 
  Mail, Bell, MessageSquare, Plus, AlertCircle, Edit, History, 
  Trash2, Check, Search, Calendar, ChevronRight 
} from 'lucide-react';
import { 
  getAllOrders, confirmOrder, cancelOrder, revertOrder, 
  SUBSCRIPTION_PLANS, getAdminGiftLogs, adminBatchGiftDays, adminSetUserPlan 
} from '../services/subscriptionService';
import { sendBatchNotification } from '../services/adminNotificationService';
import { SubscriptionOrder, AdminGiftLog, NotificationType } from '../types';
import { AdminGiftModal } from './AdminGiftModal';
import { AdminSendNotificationModal } from './AdminSendNotificationModal';

interface AdminDashboardProps {
  adminEmail: string;
  adminId?: string;
}

interface AdminUser {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  last_active_at: string | null;
  profile_updated_at: string | null;
  user_created_at: string | null;
  user_updated_at: string | null;
  last_sign_in_at: string | null;
  plan: string | null;
  pro_expiry_date: string | null;
  trial_started_at: string | null;
  journal_pin: string | null;
  journal_pin_attempts: number;
}

type UserPlanFilter = 'all' | 'trial' | 'pro' | 'lifetime' | 'free';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ adminEmail, adminId }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [tokensToday, setTokensToday] = useState(0);
  const [apiKeyCount, setApiKeyCount] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [rpcError, setRpcError] = useState<string | null>(null);

  // Tab State: 'users' | 'subscriptions' | 'gift'
  const [adminTab, setAdminTab] = useState<'users' | 'subscriptions' | 'gift'>('users');
  
  // Subscription Orders State
  const [orders, setOrders] = useState<SubscriptionOrder[]>([]);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  
  // Filtering & Selection
  const [planFilter, setPlanFilter] = useState<UserPlanFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Modal State
  const [giftModalUsers, setGiftModalUsers] = useState<AdminUser[] | null>(null);
  const [notifModalTargets, setNotifModalTargets] = useState<AdminUser[] | null>(null);

  // Gift History State
  const [giftLogs, setGiftLogs] = useState<AdminGiftLog[]>([]);
  const [loadingGiftLogs, setLoadingGiftLogs] = useState(false);

  // Resolved Admin ID
  const [resolvedAdminId, setResolvedAdminId] = useState<string>('');

  // Bulk Panel Forms State
  const [bulkGiftTarget, setBulkGiftTarget] = useState<'all' | 'free' | 'trial' | 'pro' | 'lifetime'>('free');
  const [bulkGiftDays, setBulkGiftDays] = useState<number>(30);
  const [bulkGiftNote, setBulkGiftNote] = useState<string>('');
  const [bulkGiftSendInApp, setBulkGiftSendInApp] = useState<boolean>(true);
  const [bulkGiftSendEmail, setBulkGiftSendEmail] = useState<boolean>(false);
  const [bulkGiftLoading, setBulkGiftLoading] = useState<boolean>(false);

  const [bulkNotifTarget, setBulkNotifTarget] = useState<'all' | 'free' | 'trial' | 'pro' | 'lifetime'>('all');
  const [bulkNotifType, setBulkNotifType] = useState<NotificationType>('system');
  const [bulkNotifTitle, setBulkNotifTitle] = useState<string>('');
  const [bulkNotifMessage, setBulkNotifMessage] = useState<string>('');
  const [bulkNotifSendInApp, setBulkNotifSendInApp] = useState<boolean>(true);
  const [bulkNotifSendEmail, setBulkNotifSendEmail] = useState<boolean>(false);
  const [bulkNotifLoading, setBulkNotifLoading] = useState<boolean>(false);

  const log = (msg: string) => setDebugLog(prev => [...prev.slice(-9), `[${new Date().toLocaleTimeString('vi-VN')}] ${msg}`]);

  useEffect(() => {
    const getAdminUser = async () => {
      if (adminId) {
        setResolvedAdminId(adminId);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setResolvedAdminId(user.id);
      }
    };
    getAdminUser();
  }, [adminId]);

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    setRpcError(null);
    try {
      const { data, error } = await supabase.rpc('get_admin_users');

      if (error) {
        log(`❌ get_admin_users: ${error.message}`);
        setRpcError(error.message);
        setUsers([]);
      } else {
        setUsers(data || []);
        log(`✅ Loaded ${(data || []).length} users từ get_admin_users()`);
      }

      // Token AI hôm nay
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { data: logsData, error: logsError } = await supabase
          .from('api_logs')
          .select('tokens_used')
          .gte('created_at', today.toISOString());

        if (!logsError && logsData) {
          const total = logsData.reduce((sum, l) => sum + (l.tokens_used || 0), 0);
          setTokensToday(total);
        }
      } catch {
        log('⚠️ api_logs chưa tồn tại — bỏ qua');
      }

      // API keys
      const envKeys = (import.meta as any).env?.VITE_GEMINI_API_KEYS || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
      setApiKeyCount(envKeys.split(',').filter(Boolean).length);

      setLastRefresh(new Date());
    } catch (err: any) {
      log(`❌ Fatal: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    const data = await getAllOrders(100);
    const now = new Date().getTime();
    const mappedData = data.map(order => {
      if (order.status === 'pending') {
        const orderTime = new Date(order.created_at).getTime();
        if (now - orderTime > 60 * 60 * 1000) {
          return { ...order, status: 'failed' as const };
        }
      }
      return order;
    });
    setOrders(mappedData);
  }, []);

  const fetchGiftLogs = useCallback(async () => {
    setLoadingGiftLogs(true);
    const logs = await getAdminGiftLogs(100);
    setGiftLogs(logs);
    setLoadingGiftLogs(false);
  }, []);

  useEffect(() => {
    fetchAdminData();
    fetchOrders();
    fetchGiftLogs();

    const profileChannel = supabase
      .channel('admin-profiles-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        log('🔄 Realtime: profile changed');
        fetchAdminData();
      })
      .subscribe();

    const logsChannel = supabase
      .channel('admin-logs-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'api_logs' }, (payload) => {
        const tokens = (payload.new as any)?.tokens_used || 0;
        log(`🔄 Realtime: +${tokens} tokens`);
        setTokensToday(prev => prev + tokens);
      })
      .subscribe();

    const interval = setInterval(fetchAdminData, 30_000);

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(logsChannel);
      clearInterval(interval);
    };
  }, [fetchAdminData, fetchOrders, fetchGiftLogs]);

  const handleConfirmOrder = async (orderId: string) => {
    if (!window.confirm('Xác nhận CÓ hoặc KHÔNG: Kích hoạt gói Pro cho đơn hàng này?')) return;
    setConfirmingOrderId(orderId);
    try {
      const success = await confirmOrder(orderId, resolvedAdminId);
      if (success) {
        log('✅ Đã xác nhận đơn hàng: ' + orderId.slice(0, 8));
        fetchOrders();
        fetchAdminData();
      } else {
        log('❌ Lỗi xác nhận đơn hàng');
        alert('Không thể xác nhận đơn hàng. Vui lòng thử lại.');
      }
    } catch (err: any) {
      log('❌ Error: ' + err.message);
    } finally {
      setConfirmingOrderId(null);
    }
  };

  const handleRevertOrder = async (orderId: string) => {
    if (!window.confirm('Xác nhận CÓ hoặc KHÔNG: Hoàn tác đơn hàng này về Trạng thái Chờ và Hủy gói Pro của User?')) return;
    setConfirmingOrderId(orderId);
    try {
      const success = await revertOrder(orderId);
      if (success) {
        log('✅ Đã hoàn tác đơn hàng: ' + orderId.slice(0, 8));
        fetchOrders();
        fetchAdminData();
      } else {
        alert('Không thể hoàn tác đơn hàng.');
      }
    } catch (err: any) {
      log('❌ Error: ' + err.message);
    } finally {
      setConfirmingOrderId(null);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm('Xác nhận CÓ hoặc KHÔNG: Hủy bỏ vĩnh viễn đơn hàng này?')) return;
    setConfirmingOrderId(orderId);
    try {
      const success = await cancelOrder(orderId);
      if (success) {
        log('✅ Đã hủy đơn hàng: ' + orderId.slice(0, 8));
        fetchOrders();
      } else {
        alert('Không thể hủy đơn hàng.');
      }
    } catch (err: any) {
      log('❌ Error: ' + err.message);
    } finally {
      setConfirmingOrderId(null);
    }
  };

  const handleResetUserPin = async (userId: string, displayName: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn Reset PIN Nhật ký của "${displayName}" không? Việc này sẽ xóa mã PIN hiện tại và đưa số lần thử sai về 0.`)) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          journal_pin: null, 
          journal_pin_attempts: 0 
        })
        .eq('id', userId);

      if (error) throw error;
      log(`✅ Đã Reset PIN Nhật ký cho user: ${displayName}`);
      alert(`Đã Reset PIN Nhật ký thành công cho ${displayName}!`);
      fetchAdminData();
    } catch (err: any) {
      log(`❌ Reset PIN thất bại: ${err.message}`);
      alert(`Lỗi Reset PIN: ${err.message}`);
    }
  };

  const handleDeleteUser = async (userId: string, displayName: string) => {
    if (!window.confirm(`⚠️ CẢNH BÁO NGUY HIỂM: Bạn có chắc chắn muốn XOÁ VĨNH VIỄN người dùng "${displayName}" khỏi hệ thống không? Toàn bộ dữ liệu (lịch trình, nhật ký, tài chính) của họ sẽ biến mất hoàn toàn.`)) return;
    try {
      const { data, error } = await supabase.rpc('delete_user_by_admin', { target_user_id: userId });
      if (error) throw error;
      if (data) {
        log(`✅ Đã xoá thành viên: ${displayName}`);
        alert(`Đã xoá thành viên "${displayName}" thành công!`);
        fetchAdminData();
      } else {
        alert('Không thể xoá thành viên.');
      }
    } catch (err: any) {
      log(`❌ Xoá thành viên thất bại: ${err.message}`);
      alert(`Lỗi khi xoá: ${err.message}`);
    }
  };


  const timeAgoString = (dateInput: string | null | undefined) => {
    if (!dateInput) return null;
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return null;
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 0) return 'Vừa xong';
    if (seconds < 60) return 'Vài giây trước';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  };

  const formatDate = (dateInput: string | null | undefined) => {
    if (!dateInput) return '—';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString('vi-VN');
  };

  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;

  const getUserPlanStatus = (u: AdminUser) => {
    const now = new Date();
    if (u.plan === 'lifetime') return { label: 'Vĩnh viễn', color: 'bg-purple-100 text-purple-700 border-purple-200', days: Infinity };
    if (u.plan === 'pro' && u.pro_expiry_date) {
      const expiry = new Date(u.pro_expiry_date);
      const days = Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      if (days > 0) return { label: `Pro (${days}d)`, color: 'bg-amber-100 text-amber-700 border-amber-200', days };
      return { label: 'Pro hết hạn', color: 'bg-red-100 text-red-650 border-red-200', days: 0 };
    }
    if (u.plan === 'trial' && u.trial_started_at) {
      const start = new Date(u.trial_started_at);
      const end = new Date(start); end.setDate(end.getDate() + 7); // Trial 7 days
      const days = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      if (days > 0) return { label: `Trial (${days}d)`, color: 'bg-blue-100 text-blue-700 border-blue-200', days };
      return { label: 'Trial hết hạn', color: 'bg-red-100 text-red-650 border-red-200', days: 0 };
    }
    return { label: 'Free', color: 'bg-gray-100 text-gray-500 border-gray-200', days: 0 };
  };

  const filterUsersByGroup = (group: 'all' | 'free' | 'trial' | 'pro' | 'lifetime') => {
    return users.filter(u => {
      if (group === 'all') return true;
      if (group === 'trial') return u.plan === 'trial' && getUserPlanStatus(u).days > 0;
      if (group === 'pro') return u.plan === 'pro' && getUserPlanStatus(u).days > 0;
      if (group === 'lifetime') return u.plan === 'lifetime';
      if (group === 'free') {
        const status = getUserPlanStatus(u);
        return !u.plan || u.plan === 'free' || status.days === 0;
      }
      return true;
    });
  };

  // Filters and search
  const filteredUsers = users.filter(u => {
    // 1. Search Query filter
    const matchesSearch = searchQuery.trim() === '' || 
      (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // 2. Plan filter
    if (planFilter === 'all') return true;
    if (planFilter === 'trial') return u.plan === 'trial' && getUserPlanStatus(u).days > 0;
    if (planFilter === 'pro') return u.plan === 'pro' && getUserPlanStatus(u).days > 0;
    if (planFilter === 'lifetime') return u.plan === 'lifetime';
    if (planFilter === 'free') {
      const status = getUserPlanStatus(u);
      return !u.plan || u.plan === 'free' || status.days === 0;
    }
    return true;
  });

  const proCount = users.filter(u => u.plan === 'pro' && getUserPlanStatus(u).days > 0).length;
  const trialCount = users.filter(u => u.plan === 'trial' && getUserPlanStatus(u).days > 0).length;
  const lifetimeCount = users.filter(u => u.plan === 'lifetime').length;

  const now = new Date();
  const ms24h = 24 * 60 * 60 * 1000;
  const ms7d = 7 * 24 * 60 * 60 * 1000;
  const visitors24h = users.filter(u => u.last_active_at && (now.getTime() - new Date(u.last_active_at).getTime()) <= ms24h).length;
  const visitors7d = users.filter(u => u.last_active_at && (now.getTime() - new Date(u.last_active_at).getTime()) <= ms7d).length;

  // Handle Bulk Gift Submit
  const handleBulkGiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targets = filterUsersByGroup(bulkGiftTarget);
    if (targets.length === 0) {
      alert('Không có người dùng nào thuộc bộ lọc đã chọn.');
      return;
    }

    if (bulkGiftDays <= 0 || bulkGiftDays > 365) {
      alert('Số ngày tặng phải từ 1 đến 365 ngày');
      return;
    }

    const confirmMsg = `Xác nhận tặng ${bulkGiftDays} ngày Pro cho ${targets.length} người dùng thuộc nhóm [${bulkGiftTarget.toUpperCase()}]?`;
    if (!window.confirm(confirmMsg)) return;

    setBulkGiftLoading(true);
    try {
      const targetIds = targets.map(t => t.id);
      const res = await adminBatchGiftDays(resolvedAdminId, adminEmail, targetIds, bulkGiftDays, bulkGiftNote);
      
      log(`🎁 Tặng hàng loạt: Thành công ${res.successCount}, Thất bại ${res.failedCount}`);

      // Gửi in-app notifications
      if (bulkGiftSendInApp) {
        await sendBatchNotification(
          targetIds,
          'gift_pro',
          '🎁 Món quà Pro từ Admin!',
          `Quản trị viên đã tặng bạn ${bulkGiftDays} ngày sử dụng SmartLife Pro. Ghi chú: ${bulkGiftNote || 'Chúc bạn học tập hiệu quả!'}`
        );
      }

      // Gửi email hàng loạt (Phase 2 calling Supabase Edge Function)
      if (bulkGiftSendEmail) {
        const emails = targets.map(u => u.email).filter(Boolean) as string[];
        if (emails.length > 0) {
          try {
            const { error: emailErr } = await supabase.functions.invoke('send-gift-email', {
              body: {
                toBatch: emails,
                subject: '🎁 Quà tặng Premium SmartLife Pro!',
                html: `<div style="background-color: #f8fafc; padding: 40px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                  <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0;">
                    <div style="background: linear-gradient(135deg, #f5f3ff 0%, #d8c4ff 100%); padding: 40px 20px; text-align: center; color: #3b0764;">
                      <div style="margin-bottom: 16px;">
                        <img src="https://smartlife.courses/pwa-192x192.png" alt="SmartLife Logo" style="width: 64px; height: 64px; border-radius: 16px; border: 2px solid rgba(124, 58, 237, 0.25); display: inline-block; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);" />
                      </div>
                      <h2 style="margin: 0; font-size: 24px; font-weight: 800; tracking-tight; color: #3b0764;">Quà Tặng Premium!</h2>
                      <p style="margin: 5px 0 0 0; font-size: 14px; color: #6d28d9; font-weight: 500;">Hệ sinh thái nâng cao hiệu suất SmartLife</p>
                    </div>
                    <div style="padding: 40px 30px; color: #334155;">
                      <p style="font-size: 16px; line-height: 1.6; margin-top: 0;">Xin chào bạn,</p>
                      <p style="font-size: 15px; line-height: 1.7; color: #475569;">Quản trị viên vừa gửi tặng bạn <strong>${bulkGiftDays} ngày sử dụng gói SmartLife Pro</strong> cao cấp.</p>
                      
                      <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 16px; margin: 20px 0; border-radius: 0 12px 12px 0; font-size: 13px; color: #64748b; font-style: italic;">
                        <strong>Ghi chú:</strong> "${bulkGiftNote || 'Quà tặng trải nghiệm dịch vụ'}"
                      </div>
                      
                      <div style="text-align: center; margin: 35px 0 10px 0;">
                        <a href="https://smartlife.courses" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 14px 35px; text-decoration: none; font-weight: bold; border-radius: 16px; font-size: 15px; box-shadow: 0 10px 20px rgba(79, 70, 229, 0.2);">Khám phá SmartLife ngay</a>
                      </div>
                    </div>
                    <div style="padding: 25px 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
                      Đây là email tự động từ hệ thống SmartLife. Vui lòng không phản hồi trực tiếp email này.
                    </div>
                  </div>
                </div>`,
              },
            });
            if (emailErr) console.error('Email invoke error:', emailErr);
          } catch (emailErr) {
            console.error('Failed to trigger email function:', emailErr);
          }
        }
      }

      alert(`Đã hoàn thành tặng quà! Thành công: ${res.successCount}, Thất bại: ${res.failedCount}`);
      setBulkGiftNote('');
      fetchAdminData();
      fetchGiftLogs();
    } catch (err: any) {
      alert('Lỗi tặng hàng loạt: ' + err.message);
    } finally {
      setBulkGiftLoading(false);
    }
  };

  // Handle Bulk Announcement Submit
  const handleBulkNotifSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targets = filterUsersByGroup(bulkNotifTarget);
    if (targets.length === 0) {
      alert('Không có người dùng nào thuộc bộ lọc đã chọn.');
      return;
    }

    if (!bulkNotifTitle.trim() || !bulkNotifMessage.trim()) {
      alert('Tiêu đề và nội dung không được bỏ trống.');
      return;
    }

    const confirmMsg = `Xác nhận gửi thông báo tới ${targets.length} người dùng thuộc nhóm [${bulkNotifTarget.toUpperCase()}]?`;
    if (!window.confirm(confirmMsg)) return;

    setBulkNotifLoading(true);
    try {
      const targetIds = targets.map(t => t.id);

      // Gửi in-app notifications
      let inAppSuccess = true;
      if (bulkNotifSendInApp) {
        const res = await sendBatchNotification(targetIds, bulkNotifType, bulkNotifTitle, bulkNotifMessage);
        inAppSuccess = res.successCount > 0;
      }

      // Gửi email hàng loạt (Phase 2 calling Supabase Edge Function)
      if (bulkNotifSendEmail) {
        const emails = targets.map(u => u.email).filter(Boolean) as string[];
        if (emails.length > 0) {
          try {
            const { error: emailErr } = await supabase.functions.invoke('send-gift-email', {
              body: {
                toBatch: emails,
                subject: bulkNotifTitle,
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
                      <h3 style="color: #1e293b; font-size: 18px; font-weight: 700; margin-top: 0; margin-bottom: 16px;">${bulkNotifTitle}</h3>
                      <p style="font-size: 15px; line-height: 1.7; color: #475569; white-space: pre-wrap; margin-bottom: 30px;">${bulkNotifMessage}</p>
                      
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
            if (emailErr) console.error('Email invoke error:', emailErr);
          } catch (emailErr) {
            console.error('Failed to trigger email function:', emailErr);
          }
        }
      }

      alert('Đã gửi thông báo hàng loạt thành công!');
      setBulkNotifTitle('');
      setBulkNotifMessage('');
    } catch (err: any) {
      alert('Lỗi gửi thông báo: ' + err.message);
    } finally {
      setBulkNotifLoading(false);
    }
  };

  const getActionTypeLabel = (type: string) => {
    switch (type) {
      case 'gift_pro': return '🎁 Tặng Pro';
      case 'extend_pro': return '⏰ Gia hạn Pro';
      case 'upgrade_lifetime': return '👑 Lên Lifetime';
      case 'gift_trial': return '🧪 Cấp Trial';
      case 'downgrade_free': return '⬇️ Xuống Free';
      default: return type;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="text-red-500" />
            Admin Dashboard
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">Quản trị: <strong>{adminEmail}</strong></p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-green-150 text-green-700 dark:bg-green-950/40 dark:text-green-400 px-2.5 py-1 rounded-full font-bold animate-pulse">● LIVE REALTIME</span>
          <span className="text-xs text-gray-400 dark:text-slate-500">{lastRefresh.toLocaleTimeString('vi-VN')}</span>
          <button 
            onClick={() => { 
              fetchAdminData(); 
              fetchOrders(); 
              if (adminTab === 'gift') fetchGiftLogs();
            }} 
            disabled={loading} 
            className="p-2.5 bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800 p-1.5 rounded-2xl w-fit">
        <button onClick={() => setAdminTab('users')} className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${adminTab === 'users' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-350'}`}>
          <Users size={16} /> Thành viên
        </button>
        <button onClick={() => setAdminTab('subscriptions')} className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 relative ${adminTab === 'subscriptions' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-350'}`}>
          <CreditCard size={16} /> Hoá đơn
          {pendingOrdersCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">{pendingOrdersCount}</span>
          )}
        </button>
        <button onClick={() => { setAdminTab('gift'); fetchGiftLogs(); }} className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${adminTab === 'gift' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-350'}`}>
          <Gift size={16} /> Quà tặng & Thông báo
        </button>
      </div>

      {/* Error from RPC */}
      {rpcError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
          <strong>❌ Lỗi gọi get_admin_users():</strong> <code className="bg-red-100 px-1 rounded">{rpcError}</code>
          <p className="mt-1 text-red-600">Hãy chạy SQL ở khung bên dưới trong Supabase SQL Editor rồi tải lại trang.</p>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 dark:text-slate-500 font-bold tracking-wide uppercase">Thành viên</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{loading ? '...' : users.length}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Users size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 dark:text-slate-500 font-bold tracking-wide uppercase">Token AI hôm nay</p>
            <p className="text-3xl font-bold text-emerald-600 mt-1">{tokensToday.toLocaleString()}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Activity size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 dark:text-slate-500 font-bold tracking-wide uppercase">Đơn Chờ Duyệt</p>
            <p className={`text-3xl font-bold mt-1 ${pendingOrdersCount > 0 ? 'text-orange-600' : 'text-gray-400 dark:text-slate-600'}`}>{pendingOrdersCount}</p>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${pendingOrdersCount > 0 ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-450' : 'bg-gray-50 dark:bg-slate-800 text-gray-400'}`}>
            <CreditCard size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 dark:text-slate-500 font-bold tracking-wide uppercase">Online (24h)</p>
            <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{loading ? '...' : visitors24h}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Users size={24} />
          </div>
        </div>
      </div>

      {/* User Table Tab */}
      {adminTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="font-bold text-gray-800 dark:text-white text-base">Danh sách thành viên ({filteredUsers.length}/{users.length})</h2>
              
              {/* Search input */}
              <div className="relative w-full md:w-80">
                <Search size={16} className="absolute left-3 top-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên, email, ID..."
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                />
              </div>
            </div>
            
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Plan Filter Row */}
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { key: 'all' as UserPlanFilter, label: 'Tất cả', count: users.length },
                  { key: 'trial' as UserPlanFilter, label: 'Trial', count: trialCount },
                  { key: 'pro' as UserPlanFilter, label: 'Pro', count: proCount },
                  { key: 'lifetime' as UserPlanFilter, label: 'Lifetime', count: lifetimeCount },
                  { key: 'free' as UserPlanFilter, label: 'Free / Hết hạn', count: users.length - proCount - trialCount - lifetimeCount },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setPlanFilter(f.key)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                      planFilter === f.key
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-slate-200/60 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>

              {/* Bulk Selection Actions Bar */}
              {selectedUserIds.length > 0 && (
                <div className="flex items-center space-x-2 bg-indigo-50/80 dark:bg-indigo-950/35 border border-indigo-100 dark:indigo-900/40 px-4 py-1.5 rounded-2xl animate-fade-in">
                  <span className="text-xs text-indigo-700 dark:text-indigo-300 font-bold">Đã chọn {selectedUserIds.length} người</span>
                  <button
                    onClick={() => {
                      const targets = users.filter(u => selectedUserIds.includes(u.id));
                      setGiftModalUsers(targets);
                    }}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center space-x-1"
                  >
                    <Gift size={12} />
                    <span>Tặng Pro</span>
                  </button>
                  <button
                    onClick={() => {
                      const targets = users.filter(u => selectedUserIds.includes(u.id));
                      setNotifModalTargets(targets);
                    }}
                    className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center space-x-1"
                  >
                    <Bell size={12} />
                    <span>Gửi thông báo</span>
                  </button>
                  <button
                    onClick={() => setSelectedUserIds([])}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded"
                  >
                    <XCircle size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-slate-350">
              <thead className="bg-gray-50 dark:bg-slate-850/60 text-gray-500 dark:text-slate-450 uppercase text-[11px] font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedUserIds(filteredUsers.map(u => u.id));
                        } else {
                          setSelectedUserIds([]);
                        }
                      }}
                      className="rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 accent-indigo-600 w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="px-5 py-4">Người dùng</th>
                  <th className="px-5 py-4"><div className="flex items-center gap-1"><Crown size={13}/> Gói</div></th>
                  <th className="px-5 py-4"><div className="flex items-center gap-1"><UserPlus size={13}/> Tạo TK</div></th>
                  <th className="px-5 py-4"><div className="flex items-center gap-1"><LogIn size={13}/> Đăng nhập cuối</div></th>
                  <th className="px-5 py-4">Lần cuối online</th>
                  <th className="px-5 py-4">Mã PIN Nhật ký</th>
                  <th className="px-5 py-4 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400">
                      <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-400" />
                      Đang tải thành viên...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400">
                      <p className="font-semibold text-slate-500">Không tìm thấy kết quả phù hợp</p>
                      <p className="text-xs mt-1">Thay đổi từ khóa hoặc bộ lọc</p>
                    </td>
                  </tr>
                ) : filteredUsers.map(u => {
                  const planStatus = getUserPlanStatus(u);
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/45 dark:hover:bg-slate-800/20 transition-colors">
                      {/* Checkbox */}
                      <td className="px-5 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(u.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedUserIds(prev => [...prev, u.id]);
                            } else {
                              setSelectedUserIds(prev => prev.filter(id => id !== u.id));
                            }
                          }}
                          className="rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 accent-indigo-600 w-4 h-4 cursor-pointer"
                        />
                      </td>

                      {/* User Avatar & Info */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={u.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${u.email}`}
                            alt=""
                            className="w-9 h-9 rounded-xl border border-slate-100 dark:border-slate-800 object-cover shadow-sm"
                          />
                          <div>
                            <div className="font-bold text-gray-950 dark:text-white text-sm">{u.full_name || 'Chưa đổi tên'}</div>
                            <div className="text-gray-400 text-xs">{u.email || u.id.slice(0, 16) + '...'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Plan status badge */}
                      <td className="px-5 py-4">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${planStatus.color}`}>
                          {planStatus.label}
                        </span>
                      </td>

                      {/* Creation Date */}
                      <td className="px-5 py-4">
                        <span className="text-xs font-medium text-gray-500">{formatDate(u.user_created_at)}</span>
                      </td>

                      {/* Last sign in */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                            {timeAgoString(u.last_sign_in_at) || 'Chưa đăng nhập'}
                          </span>
                          <span className="text-[10px] text-gray-400 mt-0.5">{formatDate(u.last_sign_in_at)}</span>
                        </div>
                      </td>

                      {/* Last active time */}
                      <td className="px-5 py-4">
                        {u.last_active_at ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              <span className="text-xs font-bold text-slate-800 dark:text-white">
                                {timeAgoString(u.last_active_at)}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-400 pl-3.5 mt-0.5">{formatDate(u.last_active_at)}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Không có dữ liệu</span>
                        )}
                      </td>

                      {/* Journal Pin Reset */}
                      <td className="px-5 py-4">
                        {u.journal_pin ? (
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${u.journal_pin_attempts >= 5 ? 'bg-red-50 text-red-650 border-red-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                              {u.journal_pin_attempts >= 5 ? 'Khóa (5/5)' : 'Đã cài PIN'}
                            </span>
                            <button
                              onClick={() => handleResetUserPin(u.id, u.full_name || u.email || 'người dùng')}
                              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg border border-red-150 transition-colors"
                            >
                              Reset
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-450 italic">Chưa cài PIN</span>
                        )}
                      </td>

                      {/* Row Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => setGiftModalUsers([u])}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Tặng Pro / Đổi Plan"
                          >
                            <Gift size={16} />
                          </button>
                          <button
                            onClick={() => setNotifModalTargets([u])}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Gửi thông báo riêng"
                          >
                            <Bell size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.full_name || u.email || 'người dùng')}
                            className="p-1.5 text-slate-500 hover:text-red-650 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Xoá vĩnh viễn người dùng"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subscription orders Tab */}
      {adminTab === 'subscriptions' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-850/60">
            <h2 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 text-base">
              <CreditCard size={18} className="text-indigo-600" />
              Duyệt hoá đơn chuyển khoản ({orders.length})
            </h2>
            <button onClick={fetchOrders} className="text-sm text-indigo-600 font-medium hover:text-indigo-800 flex items-center gap-1">
              <RefreshCw size={14} /> Tải lại
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-slate-350">
              <thead className="bg-gray-50 dark:bg-slate-850/60 text-gray-500 dark:text-slate-450 uppercase text-[11px] font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-3">Thành viên</th>
                  <th className="px-5 py-3">Gói</th>
                  <th className="px-5 py-3">Số tiền</th>
                  <th className="px-5 py-3">Nội dung CK</th>
                  <th className="px-5 py-3">Trạng thái</th>
                  <th className="px-5 py-3">Ngày tạo</th>
                  <th className="px-5 py-3">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850/60">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400">
                      <CreditCard size={24} className="mx-auto mb-2 text-gray-300" />
                      Chưa có hoá đơn nào
                    </td>
                  </tr>
                ) : orders.map(order => {
                  const plan = SUBSCRIPTION_PLANS.find(p => p.id === order.plan_type);
                  const user = users.find(u => u.id === order.user_id);
                  return (
                    <tr key={order.id} className={`hover:bg-slate-50/45 dark:hover:bg-slate-800/20 transition-colors ${order.status === 'pending' ? 'bg-amber-50/15' : ''}`}>
                      <td className="px-5 py-4">
                        <div className="text-xs">
                          <div className="font-bold text-gray-900 dark:text-white">{user?.full_name || 'Không rõ tên'}</div>
                          <div className="text-gray-450">{user?.email || order.user_id.slice(0, 12) + '...'}</div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 px-2.5 py-1 rounded-xl">
                          {plan?.label || order.plan_type}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-bold text-gray-900 dark:text-white">
                        {new Intl.NumberFormat('vi-VN').format(order.amount)}đ
                      </td>
                      <td className="px-5 py-4">
                        <code className="text-xs bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 px-2 py-1 rounded font-mono font-bold">
                          {order.transfer_content}
                        </code>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                          order.status === 'confirmed' ? 'bg-green-100 text-green-700 border-green-200' :
                          order.status === 'expired' ? 'bg-gray-100 text-gray-500 border-gray-200' :
                          'bg-red-100 text-red-650 border-red-200'
                        }`}>
                          {order.status === 'pending' ? '⏳ Chờ duyệt' :
                           order.status === 'confirmed' ? '✅ Đã kích hoạt' :
                           order.status === 'expired' ? '⚪ Hết hạn' :
                           order.status === 'failed' ? '❌ Hết hạn (Huỷ)' : '❌ Đã huỷ'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {(order.status === 'pending' || order.status === 'failed') && (
                            <>
                              <button
                                onClick={() => handleConfirmOrder(order.id)}
                                disabled={confirmingOrderId === order.id}
                                className={`flex items-center gap-1 px-3 py-1.5 text-white text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50 ${order.status === 'failed' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'}`}
                              >
                                {confirmingOrderId === order.id ? <RefreshCw size={12} className="animate-spin" /> : <Crown size={12} />}
                                {order.status === 'failed' ? 'Ép duyệt' : 'Kích hoạt Pro'}
                              </button>
                              <button
                                onClick={() => handleCancelOrder(order.id)}
                                disabled={confirmingOrderId === order.id}
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50"
                              >
                                Hủy
                              </button>
                            </>
                          )}
                          {order.status === 'confirmed' && (
                            <>
                              <span className="text-xs text-green-600 flex items-center gap-1 font-bold">
                                <CheckCircle size={12} /> Hoàn tất
                              </span>
                              <button
                                onClick={() => handleRevertOrder(order.id)}
                                disabled={confirmingOrderId === order.id}
                                className="flex items-center gap-1 px-2.5 py-1 text-orange-600 hover:text-orange-850 bg-orange-50 hover:bg-orange-100 text-[10px] font-bold rounded-lg transition-colors disabled:opacity-50 ml-1 border border-orange-200"
                                title="Hoàn tác để khóa Pro"
                              >
                                <RefreshCw size={10} className={confirmingOrderId === order.id ? 'animate-spin' : ''} />
                                Thu hồi Pro
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Gift logs & announcements Tab */}
      {adminTab === 'gift' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Bulk Gift Form Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
              <h3 className="font-bold text-gray-800 dark:text-white text-base flex items-center gap-2 mb-4">
                <Gift className="text-indigo-600" />
                Tặng Pro Hàng Loạt
              </h3>
              <form onSubmit={handleBulkGiftSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Đối tượng áp dụng
                  </label>
                  <select
                    value={bulkGiftTarget}
                    onChange={e => setBulkGiftTarget(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                  >
                    <option value="free">Chỉ tài khoản Free / Pro hết hạn</option>
                    <option value="trial">Chỉ tài khoản đang dùng Trial</option>
                    <option value="pro">Chỉ tài khoản đang có Pro hoạt động</option>
                    <option value="lifetime">Chỉ tài khoản Lifetime</option>
                    <option value="all">Tất cả tài khoản trong hệ thống</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Số ngày tặng (Tối đa 365)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={bulkGiftDays}
                      onChange={e => setBulkGiftDays(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                      placeholder="Nhập số ngày..."
                      required
                    />
                    <span className="absolute right-4 top-2.5 text-sm text-slate-400">ngày</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Ghi chú lý do tặng
                  </label>
                  <textarea
                    value={bulkGiftNote}
                    onChange={e => setBulkGiftNote(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white resize-none"
                    placeholder="VD: Quà tặng dịp Tết dương lịch..."
                  />
                </div>

                {/* Notifications setup */}
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-150/60 dark:border-slate-850 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-300">Thông báo trên App (In-app)</span>
                    <input
                      type="checkbox"
                      checked={bulkGiftSendInApp}
                      onChange={e => setBulkGiftSendInApp(e.target.checked)}
                      className="rounded text-indigo-650 w-4 h-4"
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm border-t border-slate-200/50 dark:border-slate-800 pt-2">
                    <span className="text-slate-600 dark:text-slate-300">Gửi mail thông báo (Resend)</span>
                    <input
                      type="checkbox"
                      checked={bulkGiftSendEmail}
                      onChange={e => setBulkGiftSendEmail(e.target.checked)}
                      className="rounded text-indigo-650 w-4 h-4"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between bg-indigo-50/40 dark:bg-indigo-950/20 p-3 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30">
                  <span className="text-xs text-indigo-800 dark:text-indigo-300">Dự kiến áp dụng:</span>
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    {filterUsersByGroup(bulkGiftTarget).length} tài khoản
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={bulkGiftLoading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-600/10 flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {bulkGiftLoading ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <Gift size={16} />
                  )}
                  <span>Xác nhận Tặng hàng loạt</span>
                </button>
              </form>
            </div>

            {/* Bulk Announcement Form Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
              <h3 className="font-bold text-gray-800 dark:text-white text-base flex items-center gap-2 mb-4">
                <Bell className="text-indigo-600" />
                Gửi Thông Báo / Quảng Cáo Hàng Loạt
              </h3>
              <form onSubmit={handleBulkNotifSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Gửi tới nhóm người dùng
                  </label>
                  <select
                    value={bulkNotifTarget}
                    onChange={e => setBulkNotifTarget(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                  >
                    <option value="all">Tất cả người dùng</option>
                    <option value="free">Chỉ người dùng Free/Hết hạn</option>
                    <option value="trial">Chỉ người dùng Trial</option>
                    <option value="pro">Chỉ người dùng Pro</option>
                    <option value="lifetime">Chỉ người dùng Lifetime</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                      Loại tin nhắn
                    </label>
                    <select
                      value={bulkNotifType}
                      onChange={e => setBulkNotifType(e.target.value as NotificationType)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                    >
                      <option value="system">⚙️ Hệ thống</option>
                      <option value="promo">📢 Sự kiện / QC</option>
                      <option value="gift_pro">🎁 Quà tặng</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                      Tiêu đề thông báo
                    </label>
                    <input
                      type="text"
                      value={bulkNotifTitle}
                      onChange={e => setBulkNotifTitle(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                      placeholder="Nhập tiêu đề..."
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Nội dung chi tiết (hỗ trợ Emoji)
                  </label>
                  <textarea
                    value={bulkNotifMessage}
                    onChange={e => setBulkNotifMessage(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white resize-none"
                    placeholder="Nhập nội dung..."
                    required
                  />
                </div>

                {/* Notifications setup */}
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-150/60 dark:border-slate-850 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-300">Gửi thông báo trên App (In-app)</span>
                    <input
                      type="checkbox"
                      checked={bulkNotifSendInApp}
                      onChange={e => setBulkNotifSendInApp(e.target.checked)}
                      className="rounded text-indigo-650 w-4 h-4"
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm border-t border-slate-200/50 dark:border-slate-800 pt-2">
                    <span className="text-slate-600 dark:text-slate-300">Gửi mail thông báo (Resend)</span>
                    <input
                      type="checkbox"
                      checked={bulkNotifSendEmail}
                      onChange={e => setBulkNotifSendEmail(e.target.checked)}
                      className="rounded text-indigo-650 w-4 h-4"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between bg-indigo-50/40 dark:bg-indigo-950/20 p-3 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30">
                  <span className="text-xs text-indigo-800 dark:text-indigo-300">Người nhận dự kiến:</span>
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    {filterUsersByGroup(bulkNotifTarget).length} tài khoản
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={bulkNotifLoading || !bulkNotifTitle.trim() || !bulkNotifMessage.trim()}
                  className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-650/10 flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {bulkNotifLoading ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <Mail size={16} />
                  )}
                  <span>Gửi tin hàng loạt</span>
                </button>
              </form>
            </div>
          </div>

          {/* Gift logs History Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-850/60">
              <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 text-base">
                <History size={18} className="text-indigo-650" />
                Lịch sử Tặng gói & Điều chỉnh ({giftLogs.length})
              </h3>
              <button onClick={fetchGiftLogs} className="text-sm text-indigo-650 font-medium hover:text-indigo-800 flex items-center gap-1">
                <RefreshCw size={14} className={loadingGiftLogs ? 'animate-spin' : ''} /> Tải lại
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600 dark:text-slate-350">
                <thead className="bg-gray-50 dark:bg-slate-850/60 text-gray-500 dark:text-slate-450 uppercase text-[11px] font-bold tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Quản trị viên</th>
                    <th className="px-5 py-3.5">Người nhận</th>
                    <th className="px-5 py-3.5">Hành động</th>
                    <th className="px-5 py-3.5">Số ngày</th>
                    <th className="px-5 py-3.5">Thay đổi gói</th>
                    <th className="px-5 py-3.5">Hạn cũ → Hạn mới</th>
                    <th className="px-5 py-3.5">Ghi chú</th>
                    <th className="px-5 py-3.5">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850/60">
                  {loadingGiftLogs ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-gray-400">
                        <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-indigo-400" />
                        Đang tải lịch sử...
                      </td>
                    </tr>
                  ) : giftLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-gray-400">
                        Chưa có lịch sử quà tặng nào.
                      </td>
                    </tr>
                  ) : giftLogs.map(log => {
                    const recipient = users.find(u => u.id === log.target_user_id);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/45 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="px-5 py-4">
                          <span className="text-xs font-semibold text-slate-850 dark:text-slate-300">{log.admin_email}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-xs">
                            <div className="font-bold text-slate-800 dark:text-white">{recipient?.full_name || 'Không rõ tên'}</div>
                            <div className="text-slate-450">{recipient?.email || log.target_user_id.slice(0, 12) + '...'}</div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs font-bold text-indigo-650 dark:text-indigo-400">
                            {getActionTypeLabel(log.action_type)}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-semibold">
                          {log.days_granted ? `+${log.days_granted} ngày` : '—'}
                        </td>
                        <td className="px-5 py-4 text-xs font-medium">
                          <span className="capitalize">{log.old_plan || 'free'}</span>
                          <span className="mx-1.5 text-slate-400">→</span>
                          <span className="capitalize font-bold text-slate-905 dark:text-white">{log.new_plan}</span>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500">
                          <div className="flex flex-col">
                            <span>{log.old_expiry ? new Date(log.old_expiry).toLocaleDateString('vi-VN') : '—'}</span>
                            <span className="text-[10px] text-slate-400">đến {log.new_expiry ? new Date(log.new_expiry).toLocaleDateString('vi-VN') : '—'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 max-w-[150px] truncate text-xs" title={log.note || ''}>
                          {log.note || <span className="text-gray-400 italic">Không có</span>}
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-500">
                          {formatDate(log.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Debug Console */}
      {debugLog.length > 0 && (
        <div className="bg-gray-900 text-green-400 p-4 rounded-2xl font-mono text-xs space-y-0.5 max-h-40 overflow-y-auto">
          <p className="text-gray-500 mb-1">── Console Log ──</p>
          {debugLog.map((line, i) => <p key={i}>{line}</p>)}
        </div>
      )}

      {/* SQL Guide */}
      <details className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden">
        <summary className="px-6 py-4 cursor-pointer font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors">
          <ShieldAlert size={18} className="text-red-500" /> Hướng dẫn SQL — BẮT BUỘC chạy trong Supabase SQL Editor
        </summary>
        <div className="px-6 pb-6">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">Copy toàn bộ script bên dưới → Supabase → <strong>SQL Editor</strong> → Run → Phải thấy thành công.</p>
          <pre className="bg-slate-800 text-slate-200 p-4 rounded-xl font-mono text-[11px] whitespace-pre-wrap overflow-x-auto leading-relaxed">
{`-- Chạy SQL trong file: sql/admin_gift_schema.sql`}
          </pre>
        </div>
      </details>

      {/* Modals */}
      {giftModalUsers && (
        <AdminGiftModal
          users={giftModalUsers}
          adminId={resolvedAdminId}
          adminEmail={adminEmail}
          onClose={() => setGiftModalUsers(null)}
          onSuccess={() => {
            fetchAdminData();
            fetchGiftLogs();
            setSelectedUserIds([]);
            alert('Đã cập nhật gói thành viên thành công!');
          }}
        />
      )}

      {notifModalTargets && (
        <AdminSendNotificationModal
          targets={notifModalTargets}
          onClose={() => setNotifModalTargets(null)}
          onSuccess={() => {
            alert('Đã gửi thông báo thành công!');
          }}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
