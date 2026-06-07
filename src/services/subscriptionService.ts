// File: src/services/subscriptionService.ts
import { supabase } from './supabase';
import { SubscriptionOrder, SubscriptionPlan, SubscriptionPlanDuration, AdminGiftLog } from '../types';

// ========== PLANS CONFIG ==========
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: '1_month',
    label: '1 Tháng',
    price: 49000,
    duration_days: 30,
    monthly_price: 49000,
    save_percent: 0,
  },
  {
    id: '3_months',
    label: '3 Tháng',
    price: 99000,
    duration_days: 90,
    monthly_price: Math.round(99000 / 3),
    save_percent: Math.round(100 - ((99000 / 3) / 49000) * 100), // ~33%
    is_popular: true,
  },
  {
    id: '12_months',
    label: '12 Tháng',
    price: 349000,
    duration_days: 365,
    monthly_price: Math.round(349000 / 12),
    save_percent: Math.round(100 - ((349000 / 12) / 49000) * 100), // ~41%
  },
  {
    id: 'lifetime',
    label: 'Vĩnh viễn',
    price: 499000,
    duration_days: null,
    monthly_price: 0,
    save_percent: 100,
  },
];

// ========== PAYMENT INFO ==========
export const PAYMENT_INFO = {
  bank_name: 'Vietcombank',
  account_number: '1042378908',
  account_name: 'BUI ANH QUAN',
  support_zalo: '0339789787',
  support_name: 'BA Quân',
  invoice_timeout_minutes: 10,
};

// ========== HELPER: Generate Transfer Content ==========
export const generateTransferContent = (userId: string): string => {
  const shortId = userId.replace(/-/g, '').slice(0, 8).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  return `SL${shortId}${ts}`;
};

// ========== API FUNCTIONS ==========

/**
 * Tạo đơn hàng subscription mới
 */
export const createSubscriptionOrder = async (
  userId: string,
  planType: SubscriptionPlanDuration
): Promise<SubscriptionOrder | null> => {
  const plan = SUBSCRIPTION_PLANS.find(p => p.id === planType);
  if (!plan) return null;

  const transferContent = generateTransferContent(userId);
  const expiresAt = new Date(Date.now() + PAYMENT_INFO.invoice_timeout_minutes * 60 * 1000);

  const { data, error } = await supabase
    .from('subscription_orders')
    .insert([{
      user_id: userId,
      plan_type: planType,
      amount: plan.price,
      status: 'pending',
      transfer_content: transferContent,
      invoice_expires_at: expiresAt.toISOString(),
    }])
    .select()
    .single();

  if (error) {
    console.error('[Subscription] Create order error:', error);
    return null;
  }

  return data as SubscriptionOrder;
};

/**
 * Lấy đơn hàng pending mới nhất của user
 */
export const getLatestPendingOrder = async (userId: string): Promise<SubscriptionOrder | null> => {
  const { data, error } = await supabase
    .from('subscription_orders')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as SubscriptionOrder;
};

/**
 * Đánh dấu đơn hàng đã chuyển khoản (user xác nhận)
 */
export const markOrderAsTransferred = async (orderId: string): Promise<boolean> => {
  // Chỉ đổi trạng thái — admin sẽ xác nhận sau
  // Không cần thay đổi gì vì status vẫn là pending cho đến khi admin confirm
  return true;
};

/**
 * [ADMIN] Lấy tất cả đơn hàng pending
 */
export const getAllPendingOrders = async (): Promise<SubscriptionOrder[]> => {
  const { data, error } = await supabase
    .from('subscription_orders')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Admin] Get pending orders error:', error);
    return [];
  }
  return (data || []) as SubscriptionOrder[];
};

/**
 * [ADMIN] Lấy tất cả đơn hàng (gần đây)
 */
export const getAllOrders = async (limit = 50): Promise<SubscriptionOrder[]> => {
  const { data, error } = await supabase
    .from('subscription_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Admin] Get all orders error:', error);
    return [];
  }
  return (data || []) as SubscriptionOrder[];
};

/**
 * [ADMIN] Xác nhận đơn hàng → kích hoạt Pro cho user
 */
export const confirmOrder = async (
  orderId: string,
  adminId: string
): Promise<boolean> => {
  try {
    // 1. Get order details
    const { data: order, error: orderError } = await supabase
      .from('subscription_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) throw new Error('Order not found');

    const plan = SUBSCRIPTION_PLANS.find(p => p.id === order.plan_type);
    if (!plan) throw new Error('Invalid plan type');

    // 2. Calculate expiry date
    let proExpiryDate: string | null = null;
    if (plan.duration_days !== null) {
      // Check if user already has active Pro — extend from current expiry
      const { data: profile } = await supabase
        .from('profiles')
        .select('pro_expiry_date, plan')
        .eq('id', order.user_id)
        .single();

      const now = new Date();
      let baseDate = now;

      if (profile?.plan === 'pro' && profile?.pro_expiry_date) {
        const currentExpiry = new Date(profile.pro_expiry_date);
        if (currentExpiry > now) {
          baseDate = currentExpiry; // Extend from current expiry
        }
      }

      const expiry = new Date(baseDate);
      expiry.setDate(expiry.getDate() + plan.duration_days);
      proExpiryDate = expiry.toISOString();
    }

    // 3. Update order status
    const { error: updateOrderError } = await supabase
      .from('subscription_orders')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        confirmed_by: adminId,
      })
      .eq('id', orderId);

    if (updateOrderError) throw updateOrderError;

    // 4. Activate Pro on profile
    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update({
        plan: plan.duration_days === null ? 'lifetime' : 'pro',
        pro_expiry_date: proExpiryDate,
      })
      .eq('id', order.user_id);

    if (updateProfileError) throw updateProfileError;

    return true;
  } catch (error) {
    console.error('[Admin] Confirm order error:', error);
    return false;
  }
};

/**
 * Setup trial cho user mới đăng ký
 * @param trialStartDate — Ngày bắt đầu trial (mặc định: ngày tạo tài khoản)
 */
export const setupTrialForNewUser = async (userId: string, trialStartDate?: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        plan: 'trial',
        trial_started_at: trialStartDate || new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) console.error('[Subscription] Setup trial error:', error);
  } catch (err) {
    console.error('[Subscription] Setup trial exception:', err);
  }
};

/**
 * [ADMIN] Hủy đơn hàng (đưa về trạng thái cancelled)
 */
export const cancelOrder = async (orderId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('subscription_orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[Admin] Cancel order error:', error);
    return false;
  }
};

/**
 * [ADMIN] Hoàn tác xác nhận đơn hàng (Đưa về trạng thái pending và hủy Pro)
 */
export const revertOrder = async (orderId: string): Promise<boolean> => {
  try {
    const { data: order, error: orderError } = await supabase
      .from('subscription_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) throw new Error('Order not found');

    const { error: updateOrderError } = await supabase
      .from('subscription_orders')
      .update({
        status: 'pending',
        confirmed_at: null,
        confirmed_by: null,
      })
      .eq('id', orderId);

    if (updateOrderError) throw updateOrderError;

    // Evaluate what plan the user should fallback to
    const { data: profile } = await supabase
      .from('profiles')
      .select('trial_started_at')
      .eq('id', order.user_id)
      .single();

    let fallbackPlan = 'free';
    if (profile?.trial_started_at) {
      const trialStart = new Date(profile.trial_started_at);
      const trialEnd = new Date(trialStart);
      trialEnd.setDate(trialEnd.getDate() + 7);
      if (trialEnd > new Date()) fallbackPlan = 'trial';
    }

    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update({
        plan: fallbackPlan,
        pro_expiry_date: null,
      })
      .eq('id', order.user_id);

    if (updateProfileError) throw updateProfileError;

    return true;
  } catch (error) {
    console.error('[Admin] Revert order error:', error);
    return false;
  }
};

/**
 * [ADMIN] Tặng/Gia hạn X ngày Pro cho một user cụ thể (tối đa 365 ngày/lần)
 */
export const adminGiftDays = async (
  adminId: string,
  adminEmail: string,
  targetUserId: string,
  days: number,
  note?: string
): Promise<boolean> => {
  if (days <= 0 || days > 365) {
    console.error('Days granted must be between 1 and 365');
    return false;
  }

  try {
    // 1. Lấy thông tin plan hiện tại của user
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan, pro_expiry_date')
      .eq('id', targetUserId)
      .single();

    if (profileError || !profile) throw new Error('User profile not found');

    const now = new Date();
    let baseDate = now;
    const oldPlan = profile.plan || 'free';
    const oldExpiry = profile.pro_expiry_date;

    // Nếu user đang có Pro active thì cộng dồn từ ngày hết hạn cũ, ngược lại tính từ Now
    if (oldPlan === 'pro' && oldExpiry) {
      const currentExpiry = new Date(oldExpiry);
      if (currentExpiry > now) {
        baseDate = currentExpiry;
      }
    }

    const newExpiryDate = new Date(baseDate);
    newExpiryDate.setDate(newExpiryDate.getDate() + days);
    const newExpiryStr = newExpiryDate.toISOString();

    // 2. Cập nhật profile
    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update({
        plan: 'pro',
        pro_expiry_date: newExpiryStr,
      })
      .eq('id', targetUserId);

    if (updateProfileError) throw updateProfileError;

    // 3. Ghi log lịch sử tặng
    const { error: logError } = await supabase
      .from('admin_gift_logs')
      .insert([{
        admin_id: adminId,
        admin_email: adminEmail,
        target_user_id: targetUserId,
        action_type: 'gift_pro',
        days_granted: days,
        old_plan: oldPlan,
        new_plan: 'pro',
        old_expiry: oldExpiry,
        new_expiry: newExpiryStr,
        note: note || '',
      }]);

    if (logError) {
      console.warn('[Admin] Failed to write gift log:', logError);
    }

    return true;
  } catch (error) {
    console.error('[Admin] Gift days error:', error);
    return false;
  }
};

/**
 * [ADMIN] Điều chỉnh trực tiếp plan của user (Free, Trial, Pro, Lifetime)
 */
export const adminSetUserPlan = async (
  adminId: string,
  adminEmail: string,
  targetUserId: string,
  newPlan: 'free' | 'trial' | 'pro' | 'lifetime',
  days?: number,
  note?: string
): Promise<boolean> => {
  try {
    if (newPlan === 'pro' && days && (days <= 0 || days > 365)) {
      console.error('Days granted must be between 1 and 365');
      return false;
    }

    // 1. Lấy thông tin plan hiện tại
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan, pro_expiry_date')
      .eq('id', targetUserId)
      .single();

    if (profileError || !profile) throw new Error('User profile not found');

    const oldPlan = profile.plan || 'free';
    const oldExpiry = profile.pro_expiry_date;

    let newExpiryStr: string | null = null;
    let actionType: 'extend_pro' | 'gift_trial' | 'gift_pro' | 'upgrade_lifetime' | 'downgrade_free' = 'gift_pro';

    if (newPlan === 'pro') {
      const grantDays = days || 30;
      const now = new Date();
      const newExpiryDate = new Date(now);
      newExpiryDate.setDate(newExpiryDate.getDate() + grantDays);
      newExpiryStr = newExpiryDate.toISOString();
      actionType = 'gift_pro';
    } else if (newPlan === 'lifetime') {
      newExpiryStr = null;
      actionType = 'upgrade_lifetime';
    } else if (newPlan === 'trial') {
      newExpiryStr = null;
      actionType = 'gift_trial';
    } else {
      newExpiryStr = null;
      actionType = 'downgrade_free';
    }

    // 2. Cập nhật profile
    const updateData: any = {
      plan: newPlan,
      pro_expiry_date: newExpiryStr,
    };
    if (newPlan === 'trial') {
      updateData.trial_started_at = new Date().toISOString();
    }

    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', targetUserId);

    if (updateProfileError) throw updateProfileError;

    // 3. Ghi log
    const { error: logError } = await supabase
      .from('admin_gift_logs')
      .insert([{
        admin_id: adminId,
        admin_email: adminEmail,
        target_user_id: targetUserId,
        action_type: actionType,
        days_granted: newPlan === 'pro' ? (days || 30) : null,
        old_plan: oldPlan,
        new_plan: newPlan,
        old_expiry: oldExpiry,
        new_expiry: newExpiryStr,
        note: note || '',
      }]);

    if (logError) {
      console.warn('[Admin] Failed to write gift log:', logError);
    }

    return true;
  } catch (error) {
    console.error('[Admin] Set user plan error:', error);
    return false;
  }
};

/**
 * [ADMIN] Tặng hàng loạt Pro cho danh sách users
 */
export const adminBatchGiftDays = async (
  adminId: string,
  adminEmail: string,
  targetUserIds: string[],
  days: number,
  note?: string
): Promise<{ successCount: number; failedCount: number }> => {
  let successCount = 0;
  let failedCount = 0;

  for (const userId of targetUserIds) {
    const success = await adminGiftDays(adminId, adminEmail, userId, days, note);
    if (success) {
      successCount++;
    } else {
      failedCount++;
    }
  }

  return { successCount, failedCount };
};

/**
 * [ADMIN] Lấy lịch sử tặng gói Pro
 */
export const getAdminGiftLogs = async (limit = 100): Promise<AdminGiftLog[]> => {
  const { data, error } = await supabase
    .from('admin_gift_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Admin] Get gift logs error:', error);
    return [];
  }
  return (data || []) as AdminGiftLog[];
};

