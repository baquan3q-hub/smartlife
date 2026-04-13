import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { ShieldAlert, Users, CheckCircle, RefreshCw, Activity, UserPlus, LogIn, CreditCard, Crown, XCircle } from 'lucide-react';
import { getAllOrders, confirmOrder, cancelOrder, revertOrder, SUBSCRIPTION_PLANS } from '../services/subscriptionService';
import { SubscriptionOrder } from '../types';

interface AdminDashboardProps {
    adminEmail: string;
}

// Dữ liệu trả về từ hàm SQL get_admin_users()
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
}

type UserPlanFilter = 'all' | 'trial' | 'pro' | 'lifetime' | 'free';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ adminEmail }) => {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [tokensToday, setTokensToday] = useState(0);
    const [apiKeyCount, setApiKeyCount] = useState(0);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [debugLog, setDebugLog] = useState<string[]>([]);
    const [rpcError, setRpcError] = useState<string | null>(null);

    // Subscription Management
    const [adminTab, setAdminTab] = useState<'users' | 'subscriptions'>('users');
    const [orders, setOrders] = useState<SubscriptionOrder[]>([]);
    const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
    const [planFilter, setPlanFilter] = useState<UserPlanFilter>('all');

    const log = (msg: string) => setDebugLog(prev => [...prev.slice(-9), `[${new Date().toLocaleTimeString('vi-VN')}] ${msg}`]);

    const fetchAdminData = useCallback(async () => {
        setLoading(true);
        setRpcError(null);
        try {
            // 1. Gọi hàm SQL get_admin_users() — lấy cả auth.users data
            const { data, error } = await supabase.rpc('get_admin_users');

            if (error) {
                log(`❌ get_admin_users: ${error.message}`);
                setRpcError(error.message);
                setUsers([]);
            } else {
                setUsers(data || []);
                log(`✅ Loaded ${(data || []).length} users từ get_admin_users()`);
            }

            // 2. Token AI hôm nay
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

            // 3. API keys
            const envKeys = (import.meta as any).env?.VITE_GEMINI_API_KEYS || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
            setApiKeyCount(envKeys.split(',').filter(Boolean).length);

            setLastRefresh(new Date());
        } catch (err: any) {
            log(`❌ Fatal: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch subscription orders
    const fetchOrders = useCallback(async () => {
        const data = await getAllOrders(100);
        const now = new Date().getTime();
        const mappedData = data.map(order => {
            if (order.status === 'pending') {
                const orderTime = new Date(order.created_at).getTime();
                if (now - orderTime > 60 * 60 * 1000) { // 1 tiếng không duyệt -> fail
                    return { ...order, status: 'failed' as const };
                }
            }
            return order;
        });
        setOrders(mappedData);
    }, []);

    const handleConfirmOrder = async (orderId: string) => {
        if (!window.confirm('Xác nhận CÓ hoặc KHÔNG: Kích hoạt gói Pro cho đơn hàng này?')) return;
        setConfirmingOrderId(orderId);
        try {
            // Get current admin user id
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');
            
            const success = await confirmOrder(orderId, user.id);
            if (success) {
                log('✅ Đã xác nhận đơn hàng: ' + orderId.slice(0, 8));
                fetchOrders();
                fetchAdminData(); // Refresh user list too
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

    useEffect(() => {
        fetchAdminData();
        fetchOrders();

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
    }, [fetchAdminData]);

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

    // --- User plan helpers ---
    const getUserPlanStatus = (u: AdminUser) => {
        const now = new Date();
        if (u.plan === 'lifetime') return { label: 'Vĩnh viễn', color: 'bg-purple-100 text-purple-700', days: Infinity };
        if (u.plan === 'pro' && u.pro_expiry_date) {
            const expiry = new Date(u.pro_expiry_date);
            const days = Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            if (days > 0) return { label: `Pro (${days}d)`, color: 'bg-green-100 text-green-700', days };
            return { label: 'Hết hạn', color: 'bg-red-100 text-red-600', days: 0 };
        }
        if (u.plan === 'trial' && u.trial_started_at) {
            const start = new Date(u.trial_started_at);
            const end = new Date(start); end.setDate(end.getDate() + 30);
            const days = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            if (days > 0) return { label: `Trial (${days}d)`, color: 'bg-blue-100 text-blue-700', days };
            return { label: 'Trial hết', color: 'bg-red-100 text-red-600', days: 0 };
        }
        return { label: 'Free', color: 'bg-gray-100 text-gray-500', days: 0 };
    };

    const filteredUsers = users.filter(u => {
        if (planFilter === 'all') return true;
        if (planFilter === 'trial') return u.plan === 'trial';
        if (planFilter === 'pro') return u.plan === 'pro';
        if (planFilter === 'lifetime') return u.plan === 'lifetime';
        if (planFilter === 'free') return !u.plan || u.plan === 'free' || (u.plan === 'trial' && getUserPlanStatus(u).days === 0);
        return true;
    });

    const proCount = users.filter(u => u.plan === 'pro' && getUserPlanStatus(u).days > 0).length;
    const trialCount = users.filter(u => u.plan === 'trial' && getUserPlanStatus(u).days > 0).length;
    const lifetimeCount = users.filter(u => u.plan === 'lifetime').length;

    // Visitors Today logic
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const visitorsToday = users.filter(u => u.last_active_at && new Date(u.last_active_at) >= todayStart).length;

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <ShieldAlert className="text-red-500" />
                        Admin Dashboard
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm">Quản trị: <strong>{adminEmail}</strong></p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium animate-pulse">● LIVE</span>
                    <span className="text-xs text-gray-400">{lastRefresh.toLocaleTimeString('vi-VN')}</span>
                    <button onClick={() => { fetchAdminData(); fetchOrders(); }} disabled={loading} className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-colors disabled:opacity-50">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
                <button onClick={() => setAdminTab('users')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${adminTab === 'users' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    <Users size={16} /> Người dùng
                </button>
                <button onClick={() => setAdminTab('subscriptions')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 relative ${adminTab === 'subscriptions' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    <CreditCard size={16} /> Subscription
                    {pendingOrdersCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">{pendingOrdersCount}</span>
                    )}
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
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">Tổng người dùng</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">{loading ? '...' : users.length}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Users size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">Token AI hôm nay</p>
                        <p className="text-3xl font-bold text-emerald-600 mt-1">{tokensToday.toLocaleString()}</p>
                        <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-full font-medium">
                            <CheckCircle size={12}/> System: Ổn định ({apiKeyCount} keys)
                        </div>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <Activity size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">Đơn chờ xác nhận</p>
                        <p className={`text-3xl font-bold mt-1 ${pendingOrdersCount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{pendingOrdersCount}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${pendingOrdersCount > 0 ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-400'}`}>
                        <CreditCard size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">Lượng truy cập today</p>
                        <p className="text-3xl font-bold text-indigo-600 mt-1">{loading ? '...' : visitorsToday}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Users size={24} />
                    </div>
                </div>
            </div>

            {/* User Table */}
            {adminTab === 'users' && <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="font-semibold text-gray-800">Danh sách người dùng ({filteredUsers.length}/{users.length})</h2>
                        <button onClick={fetchAdminData} className="text-sm text-indigo-600 font-medium hover:text-indigo-800 flex items-center gap-1">
                            <RefreshCw size={14} /> Làm mới
                        </button>
                    </div>
                    {/* Plan Filter */}
                    <div className="flex gap-1.5 flex-wrap">
                        {[
                            { key: 'all' as UserPlanFilter, label: 'Tất cả', count: users.length },
                            { key: 'trial' as UserPlanFilter, label: 'Trial', count: trialCount },
                            { key: 'pro' as UserPlanFilter, label: 'Pro', count: proCount },
                            { key: 'lifetime' as UserPlanFilter, label: 'Lifetime', count: lifetimeCount },
                            { key: 'free' as UserPlanFilter, label: 'Free/Hết hạn', count: users.length - proCount - trialCount - lifetimeCount },
                        ].map(f => (
                            <button
                                key={f.key}
                                onClick={() => setPlanFilter(f.key)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    planFilter === f.key
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {f.label} ({f.count})
                            </button>
                        ))}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-semibold">
                            <tr>
                                <th className="px-5 py-3">Người dùng</th>
                                <th className="px-5 py-3">
                                    <div className="flex items-center gap-1"><Crown size={13}/> Gói</div>
                                </th>
                                <th className="px-5 py-3">
                                    <div className="flex items-center gap-1"><UserPlus size={13}/> Ngày tạo TK</div>
                                </th>
                                <th className="px-5 py-3">
                                    <div className="flex items-center gap-1"><LogIn size={13}/> Đăng nhập cuối</div>
                                </th>
                                <th className="px-5 py-3">Lần cuối online</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-gray-400">
                                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-400" />
                                        Đang tải...
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-gray-400">
                                        <p className="font-medium">Không có dữ liệu</p>
                                        <p className="text-xs mt-1">Chạy SQL bên dưới → đăng xuất → đăng nhập lại.</p>
                                    </td>
                                </tr>
                            ) : filteredUsers.map(u => {  const planStatus = getUserPlanStatus(u); return (
                                <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                                    {/* User info */}
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            {u.avatar_url ? (
                                                <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                                                    {(u.full_name || '?')[0].toUpperCase()}
                                                </div>
                                            )}
                                            <div>
                                                <div className="font-medium text-gray-900 text-sm">{u.full_name || 'Ẩn danh'}</div>
                                                <div className="text-gray-400 text-[11px]">{u.email || u.id.slice(0, 16) + '...'}</div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Plan Status */}
                                    <td className="px-5 py-4">
                                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${planStatus.color}`}>
                                            {planStatus.label}
                                        </span>
                                    </td>

                                    {/* Created At (from auth.users) */}
                                    <td className="px-5 py-4">
                                        <span className="text-xs text-gray-600">{formatDate(u.user_created_at)}</span>
                                    </td>

                                    {/* Last Sign In (from auth.users) */}
                                    <td className="px-5 py-4">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-xs font-semibold text-purple-600">
                                                {timeAgoString(u.last_sign_in_at) || '—'}
                                            </span>
                                            <span className="text-[10px] text-gray-400">{formatDate(u.last_sign_in_at)}</span>
                                        </div>
                                    </td>

                                    {/* Last Active (from profiles.last_active_at) */}
                                    <td className="px-5 py-4">
                                        {u.last_active_at ? (
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                                    </span>
                                                    <span className="text-xs font-semibold text-indigo-600">
                                                        {timeAgoString(u.last_active_at)}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-gray-400 pl-3.5">{formatDate(u.last_active_at)}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">Chưa ghi nhận</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            </div>}

            {/* Subscription Management Tab */}
            {adminTab === 'subscriptions' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                            <CreditCard size={18} className="text-indigo-600" />
                            Quản lý Subscription ({orders.length})
                        </h2>
                        <button onClick={fetchOrders} className="text-sm text-indigo-600 font-medium hover:text-indigo-800 flex items-center gap-1">
                            <RefreshCw size={14} /> Làm mới
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-semibold">
                                <tr>
                                    <th className="px-5 py-3">User ID</th>
                                    <th className="px-5 py-3">Gói</th>
                                    <th className="px-5 py-3">Số tiền</th>
                                    <th className="px-5 py-3">Nội dung CK</th>
                                    <th className="px-5 py-3">Trạng thái</th>
                                    <th className="px-5 py-3">Ngày tạo</th>
                                    <th className="px-5 py-3">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {orders.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12 text-gray-400">
                                            <CreditCard size={24} className="mx-auto mb-2 text-gray-300" />
                                            Chưa có đơn hàng nào
                                        </td>
                                    </tr>
                                ) : orders.map(order => {
                                    const plan = SUBSCRIPTION_PLANS.find(p => p.id === order.plan_type);
                                    const user = users.find(u => u.id === order.user_id);
                                    return (
                                        <tr key={order.id} className={`hover:bg-gray-50/50 transition-colors ${order.status === 'pending' ? 'bg-yellow-50/30' : ''}`}>
                                            <td className="px-5 py-4">
                                                <div className="text-xs">
                                                    <div className="font-medium text-gray-900">{user?.full_name || 'Ẩn danh'}</div>
                                                    <div className="text-gray-400 text-[10px]">{user?.email || order.user_id.slice(0, 12) + '...'}</div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg">
                                                    {plan?.label || order.plan_type}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 font-bold text-gray-900">
                                                {new Intl.NumberFormat('vi-VN').format(order.amount)}đ
                                            </td>
                                            <td className="px-5 py-4">
                                                <code className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded font-mono font-bold">
                                                    {order.transfer_content}
                                                </code>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                    order.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                                    order.status === 'expired' ? 'bg-gray-100 text-gray-500' :
                                                    'bg-red-100 text-red-600'
                                                }`}>
                                                    {order.status === 'pending' ? '⏳ Chờ xác nhận' :
                                                     order.status === 'confirmed' ? '✅ Đã xác nhận' :
                                                     order.status === 'expired' ? '⚪ Hết hạn' :
                                                     order.status === 'failed' ? '❌ Đã hủy (Quá hạn)' : '❌ Đã hủy'}
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
                                                                {order.status === 'failed' ? 'Ép Kích hoạt' : 'Kích hoạt'}
                                                            </button>
                                                            <button
                                                                onClick={() => handleCancelOrder(order.id)}
                                                                disabled={confirmingOrderId === order.id}
                                                                className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 text-[11px] font-bold rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                                                            >
                                                                Hủy
                                                            </button>
                                                        </>
                                                    )}
                                                    {order.status === 'confirmed' && (
                                                        <>
                                                            <span className="text-xs text-green-600 flex items-center gap-1 font-bold">
                                                                <CheckCircle size={12} /> Done
                                                            </span>
                                                            <button
                                                                onClick={() => handleRevertOrder(order.id)}
                                                                disabled={confirmingOrderId === order.id}
                                                                className="flex items-center gap-1 px-2.5 py-1 text-orange-600 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 text-[10px] font-bold rounded-md transition-colors disabled:opacity-50 ml-1"
                                                                title="Hoàn tác xác nhận"
                                                            >
                                                                <RefreshCw size={10} className={confirmingOrderId === order.id ? 'animate-spin' : ''} />
                                                                Undo
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

            {/* Debug Console */}
            {debugLog.length > 0 && (
                <div className="bg-gray-900 text-green-400 p-4 rounded-2xl font-mono text-xs space-y-0.5 max-h-40 overflow-y-auto">
                    <p className="text-gray-500 mb-1">── Console Log ──</p>
                    {debugLog.map((line, i) => <p key={i}>{line}</p>)}
                </div>
            )}

            {/* SQL Guide */}
            <details className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden" open>
                <summary className="px-6 py-4 cursor-pointer font-semibold text-slate-700 flex items-center gap-2 hover:bg-slate-100 transition-colors">
                    <ShieldAlert size={18} className="text-red-500" /> Hướng dẫn SQL — BẮT BUỘC chạy trong Supabase
                </summary>
                <div className="px-6 pb-6">
                    <p className="text-sm text-slate-600 mb-3">Copy toàn bộ → Supabase → <strong>SQL Editor</strong> → Run → Phải thấy <strong className="text-green-700">Success</strong>.</p>
                    <pre className="bg-slate-800 text-slate-200 p-4 rounded-xl font-mono text-[11px] whitespace-pre-wrap overflow-x-auto leading-relaxed">
{`-- 1. Thêm cột theo dõi
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Hàm lấy dữ liệu user cho Admin (JOIN auth.users + plan info)
DROP FUNCTION IF EXISTS get_admin_users();
CREATE OR REPLACE FUNCTION get_admin_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  last_active_at TIMESTAMPTZ,
  profile_updated_at TIMESTAMPTZ,
  user_created_at TIMESTAMPTZ,
  user_updated_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  plan TEXT,
  pro_expiry_date TIMESTAMPTZ,
  trial_started_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.email() != '${adminEmail}' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY
  SELECT
    p.id,
    u.email::TEXT,
    p.full_name,
    p.avatar_url,
    p.last_active_at,
    p.updated_at as profile_updated_at,
    u.created_at as user_created_at,
    u.updated_at as user_updated_at,
    u.last_sign_in_at,
    p.plan,
    p.pro_expiry_date,
    p.trial_started_at
  FROM profiles p
  LEFT JOIN auth.users u ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

-- 3. RLS cho profiles (admin đọc/sửa)
DROP POLICY IF EXISTS "Admin Select All Profiles" ON profiles;
CREATE POLICY "Admin Select All Profiles" ON profiles
  FOR SELECT USING (auth.email() = '${adminEmail}');

DROP POLICY IF EXISTS "Admin Update All Profiles" ON profiles;
CREATE POLICY "Admin Update All Profiles" ON profiles
  FOR UPDATE USING (auth.email() = '${adminEmail}');

-- 4. Bảng log token AI
CREATE TABLE IF NOT EXISTS api_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own logs" ON api_logs;
CREATE POLICY "Users insert own logs" ON api_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin view all logs" ON api_logs;
CREATE POLICY "Admin view all logs" ON api_logs
  FOR SELECT USING (auth.email() = '${adminEmail}');

-- 5. Bật Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE api_logs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;`}
                    </pre>
                </div>
            </details>
        </div>
    );
};

export default AdminDashboard;
