// File: src/services/subscriptionService.ts
import { supabase } from './supabase';
import { SubscriptionOrder, SubscriptionPlan, SubscriptionPlanDuration } from '../types';

// ========== PLANS CONFIG ==========
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: '1_month',
    label: '1 Tháng',
    price: 30000,
    duration_days: 30,
    monthly_price: 30000,
    save_percent: 0,
  },
  {
    id: '3_months',
    label: '3 Tháng',
    price: 79000,
    duration_days: 90,
    monthly_price: Math.round(79000 / 3),
    save_percent: 12,
    is_popular: true,
  },
  {
    id: '6_months',
    label: '6 Tháng',
    price: 129000,
    duration_days: 180,
    monthly_price: Math.round(129000 / 6),
    save_percent: 28,
  },
  {
    id: 'lifetime',
    label: 'Vĩnh viễn',
    price: 399000,
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
      trialEnd.setDate(trialEnd.getDate() + 30);
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
