// File: src/services/aiQuotaService.ts
import { supabase } from './supabase';
import { AI_QUOTA } from '../constants';

export interface UserQuotaStatus {
  requestsToday: number;
  requestsLimit: number;
  tokensToday: number;
  tokensTodayLimit: number;
  tokensMonth: number;
  tokensMonthLimit: number;
  boostTokensRemaining: number;
  plan: 'free' | 'trial' | 'pro' | 'lifetime';
}

export const aiQuotaService = {
  /**
   * Lấy chi tiết lượng sử dụng quota AI của người dùng
   */
  async getUserQuotaStatus(userId: string, planType: string = 'free'): Promise<UserQuotaStatus> {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Chuẩn hóa loại plan
    let plan: 'free' | 'trial' | 'pro' | 'lifetime' = 'free';
    if (planType === 'pro' || planType === 'trial' || planType === 'lifetime') {
      plan = planType;
    }

    const limits = AI_QUOTA[plan];

    try {
      // 1. Lấy dữ liệu lượng dùng trong ngày (requests & tokens)
      const { data: dailyData, error: dailyError } = await supabase
        .from('user_ai_quota')
        .select('*')
        .eq('user_id', userId)
        .eq('date', todayStr)
        .maybeSingle();

      if (dailyError && dailyError.code !== 'PGRST116') {
        console.warn('[AI Quota] Error querying daily data:', dailyError);
      }

      const requestsToday = dailyData?.requests_today || 0;
      const tokensToday = dailyData?.tokens_today || 0;

      // 2. Lấy dữ liệu token cả tháng bằng cách sum tokens_today của tháng hiện tại
      const { data: monthData, error: monthError } = await supabase
        .from('user_ai_quota')
        .select('tokens_today')
        .eq('user_id', userId)
        .eq('month_key', monthKey);

      if (monthError) {
        console.warn('[AI Quota] Error querying monthly data:', monthError);
      }

      const tokensMonth = (monthData || []).reduce((sum, row) => sum + Number(row.tokens_today || 0), 0);

      // 3. Lấy số lượng token boost còn lại từ các gói active và còn hạn
      const { data: boosts, error: boostError } = await supabase
        .from('user_ai_boost')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString());

      if (boostError) {
        console.warn('[AI Quota] Error querying active boosts:', boostError);
      }

      const boostTokensRemaining = (boosts || []).reduce((sum, b) => {
        const remaining = Number(b.tokens_total) - Number(b.tokens_used);
        return sum + (remaining > 0 ? remaining : 0);
      }, 0);

      return {
        requestsToday,
        requestsLimit: limits.requests_per_day,
        tokensToday,
        tokensTodayLimit: limits.tokens_per_day,
        tokensMonth,
        tokensMonthLimit: limits.tokens_per_month,
        boostTokensRemaining,
        plan
      };
    } catch (error) {
      console.error('[AI Quota] Exception fetching quota status:', error);
      return {
        requestsToday: 0,
        requestsLimit: limits.requests_per_day,
        tokensToday: 0,
        tokensTodayLimit: limits.tokens_per_day,
        tokensMonth: 0,
        tokensMonthLimit: limits.tokens_per_month,
        boostTokensRemaining: 0,
        plan
      };
    }
  }
};
