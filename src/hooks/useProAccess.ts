// File: src/hooks/useProAccess.ts
import { Profile } from '../types';

const TRIAL_DAYS = 30;
const GRACE_PERIOD_DAYS = 3;

export interface ProAccessState {
  /** User có quyền truy cập tính năng Pro không */
  hasAccess: boolean;
  /** Trial đang active */
  isTrialActive: boolean;
  /** Pro subscription đang active */
  isProActive: boolean;
  /** Đang trong grace period (hết hạn nhưng chưa hết grace) */
  isInGracePeriod: boolean;
  /** Lifetime plan */
  isLifetime: boolean;
  /** Số ngày còn lại (trial hoặc pro) */
  daysRemaining: number;
  /** Label hiển thị cho plan hiện tại */
  planLabel: string;
  /** Trạng thái badge color */
  badgeColor: 'green' | 'yellow' | 'red' | 'gray';
  /** Trạng thái badge text */
  badgeText: string;
}

/**
 * Hook đánh giá quyền truy cập Pro features  
 * Logic:
 * 1. Nếu plan = 'lifetime' → always active
 * 2. Nếu plan = 'trial' → check trial_started_at + 30 ngày
 * 3. Nếu plan = 'pro' → check pro_expiry_date
 * 4. Grace period: Khi hết hạn (trial hoặc pro), cho thêm 3 ngày
 * 5. Admin (baquan3q@gmail.com) luôn có access
 */
export const useProAccess = (profile: Profile | null, userEmail?: string): ProAccessState => {
  // Admin bypass
  if (userEmail === 'baquan3q@gmail.com') {
    return {
      hasAccess: true,
      isTrialActive: false,
      isProActive: true,
      isInGracePeriod: false,
      isLifetime: true,
      daysRemaining: Infinity,
      planLabel: 'Admin',
      badgeColor: 'green',
      badgeText: 'ADMIN',
    };
  }

  const now = new Date();

  // Default: no access
  if (!profile) {
    return {
      hasAccess: false,
      isTrialActive: false,
      isProActive: false,
      isInGracePeriod: false,
      isLifetime: false,
      daysRemaining: 0,
      planLabel: 'Free',
      badgeColor: 'gray',
      badgeText: 'FREE',
    };
  }

  // 1. LIFETIME
  if (profile.plan === 'lifetime') {
    return {
      hasAccess: true,
      isTrialActive: false,
      isProActive: true,
      isInGracePeriod: false,
      isLifetime: true,
      daysRemaining: Infinity,
      planLabel: 'Pro Vĩnh viễn',
      badgeColor: 'green',
      badgeText: 'PRO ♾️',
    };
  }

  // 2. TRIAL
  if (profile.plan === 'trial' && profile.trial_started_at) {
    const trialStart = new Date(profile.trial_started_at);
    const trialEnd = new Date(trialStart);
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

    const graceEnd = new Date(trialEnd);
    graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);

    const msRemaining = trialEnd.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

    if (now < trialEnd) {
      // Trial active
      return {
        hasAccess: true,
        isTrialActive: true,
        isProActive: false,
        isInGracePeriod: false,
        isLifetime: false,
        daysRemaining,
        planLabel: `Dùng thử (${daysRemaining} ngày)`,
        badgeColor: daysRemaining <= 7 ? 'yellow' : 'green',
        badgeText: `TRIAL ${daysRemaining}d`,
      };
    } else if (now < graceEnd) {
      // Grace period
      const graceRemaining = Math.max(0, Math.ceil((graceEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      return {
        hasAccess: true,
        isTrialActive: false,
        isProActive: false,
        isInGracePeriod: true,
        isLifetime: false,
        daysRemaining: 0,
        planLabel: `Gia hạn (${graceRemaining} ngày)`,
        badgeColor: 'red',
        badgeText: `HẾT HẠN`,
      };
    }
    // Trial + Grace expired
  }

  // 3. PRO (subscription)
  if (profile.plan === 'pro' && profile.pro_expiry_date) {
    const expiryDate = new Date(profile.pro_expiry_date);
    const graceEnd = new Date(expiryDate);
    graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);

    const msRemaining = expiryDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

    if (now < expiryDate) {
      return {
        hasAccess: true,
        isTrialActive: false,
        isProActive: true,
        isInGracePeriod: false,
        isLifetime: false,
        daysRemaining,
        planLabel: `Pro (${daysRemaining} ngày)`,
        badgeColor: daysRemaining <= 7 ? 'yellow' : 'green',
        badgeText: `PRO ${daysRemaining}d`,
      };
    } else if (now < graceEnd) {
      const graceRemaining = Math.max(0, Math.ceil((graceEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      return {
        hasAccess: true,
        isTrialActive: false,
        isProActive: false,
        isInGracePeriod: true,
        isLifetime: false,
        daysRemaining: 0,
        planLabel: `Gia hạn (${graceRemaining} ngày)`,
        badgeColor: 'red',
        badgeText: 'HẾT HẠN',
      };
    }
    // Pro + Grace expired
  }

  // 4. FREE / EXPIRED
  return {
    hasAccess: false,
    isTrialActive: false,
    isProActive: false,
    isInGracePeriod: false,
    isLifetime: false,
    daysRemaining: 0,
    planLabel: 'Free',
    badgeColor: 'gray',
    badgeText: 'FREE',
  };
};
