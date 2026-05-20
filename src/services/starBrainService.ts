// File: src/services/starBrainService.ts
// StarBrain Reward System — Phase 1: Core Point Engine
// Client-side calculation, Supabase persistence

import { supabase } from './supabase';
import { CheckinReward } from '../types';

// ── Constants ──
const BASE_POINTS = 10;
const LUCKY_CHANCE = 0.15;
const LUCKY_MIN = 20;
const LUCKY_MAX = 50;

export const MILESTONE_REWARDS: Record<number, { stars: number; badge: string; label: string }> = {
  7:   { stars: 50,  badge: '🔥', label: 'Week Warrior' },
  14:  { stars: 80,  badge: '⚔️', label: 'Fortnight Fighter' },
  30:  { stars: 150, badge: '👑', label: 'Monthly Master' },
  60:  { stars: 250, badge: '🦁', label: 'Consistency King' },
  100: { stars: 500, badge: '🌟', label: 'Century Legend' },
};

export const LEVELS = [
  { level: 1, name: 'Newcomer',   icon: '🌱', minStars: 0 },
  { level: 2, name: 'Starter',    icon: '🌿', minStars: 200 },
  { level: 3, name: 'Builder',    icon: '🔨', minStars: 500 },
  { level: 4, name: 'Consistent', icon: '📅', minStars: 1000 },
  { level: 5, name: 'Dedicated',  icon: '💪', minStars: 2000 },
  { level: 6, name: 'Achiever',   icon: '🏅', minStars: 4000 },
  { level: 7, name: 'Champion',   icon: '🏆', minStars: 7000 },
  { level: 8, name: 'Legend',     icon: '👑', minStars: 12000 },
];

// ── Calculation Functions ──

export function getStreakMultiplier(streakDays: number): number {
  return 1 + Math.log2(streakDays + 1) * 0.3;
}

export function getTimeBonus(): { amount: number; label: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 9)   return { amount: 5,  label: 'Early Bird 🌅' };
  if (hour >= 9 && hour < 12)  return { amount: 3,  label: 'Morning Person ☀️' };
  if (hour >= 12 && hour < 18) return { amount: 1,  label: 'On Schedule 👍' };
  if (hour >= 18 && hour < 23) return { amount: 0,  label: '' };
  return { amount: -2, label: 'Night Owl 🦉' };
}

export function rollLuckyBonus(): number | null {
  if (Math.random() < LUCKY_CHANCE) {
    return Math.floor(Math.random() * (LUCKY_MAX - LUCKY_MIN + 1)) + LUCKY_MIN;
  }
  return null;
}

export function getLevelFromStars(totalEarned: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalEarned >= LEVELS[i].minStars) return LEVELS[i];
  }
  return LEVELS[0];
}

export function getNextLevel(totalEarned: number) {
  const current = getLevelFromStars(totalEarned);
  return LEVELS.find(l => l.level === current.level + 1) || null;
}

// ── Reverse Stars on Uncheck ──

export async function reverseCheckinStars(userId: string, habitId: string): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // 1. Find all EARN transactions for this habit today
  const { data: todayTxs } = await supabase
    .from('star_transactions')
    .select('id, amount')
    .eq('user_id', userId)
    .eq('habit_id', habitId)
    .eq('type', 'EARN')
    .gte('created_at', todayStart.toISOString());

  if (!todayTxs || todayTxs.length === 0) return 0;

  const totalToReverse = todayTxs.reduce((sum, tx) => sum + tx.amount, 0);

  // 2. Delete those transactions
  const ids = todayTxs.map(tx => tx.id);
  await supabase.from('star_transactions').delete().in('id', ids);

  // 3. Also remove today's Perfect Day bonus if it was triggered by this habit
  const { data: pdTxs } = await supabase
    .from('star_transactions')
    .select('id, amount')
    .eq('user_id', userId)
    .eq('source', 'PERFECT_DAY')
    .is('habit_id', null)
    .gte('created_at', todayStart.toISOString());

  let pdReversed = 0;
  if (pdTxs && pdTxs.length > 0) {
    pdReversed = pdTxs.reduce((sum, tx) => sum + tx.amount, 0);
    await supabase.from('star_transactions').delete().in('id', pdTxs.map(t => t.id));
  }

  const grandTotal = totalToReverse + pdReversed;

  // 4. Update user_star_stats — recalculate from actual remaining EARN transactions
  const { data: statsData } = await supabase
    .from('user_star_stats').select('*')
    .eq('user_id', userId).single();

  if (statsData) {
    const newBalance = Math.max(0, statsData.current_balance - grandTotal);

    // Recalculate total_earned from remaining EARN transactions (source of truth)
    const { data: remainingEarns } = await supabase
      .from('star_transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'EARN');

    const actualTotalEarned = (remainingEarns || []).reduce((sum, tx) => sum + tx.amount, 0);
    const newLevel = getLevelFromStars(actualTotalEarned);

    await supabase.from('user_star_stats').update({
      current_balance: newBalance,
      total_earned: actualTotalEarned,
      current_level: newLevel.level,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);

    return newBalance;
  }
  return 0;
}

// ── Main Process Checkin ──

interface ProcessCheckinParams {
  userId: string;
  habitId: string;
  streakDays: number;
  allHabitsToday: { id: string; done: boolean }[];
  wasInactiveForDays?: number;
}

export async function processCheckin(params: ProcessCheckinParams): Promise<CheckinReward | null> {
  const { userId, habitId, streakDays, allHabitsToday, wasInactiveForDays } = params;

  // Prevent double-award: check if already earned today for this habit
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: existingTx } = await supabase
    .from('star_transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('habit_id', habitId)
    .eq('source', 'CHECKIN_BASE')
    .gte('created_at', todayStart.toISOString())
    .limit(1);

  if (existingTx && existingTx.length > 0) return null;

  const breakdown: { source: string; amount: number; label: string }[] = [];
  const transactions: { user_id: string; habit_id?: string; type: string; amount: number; source: string; description: string }[] = [];

  // 1. Base + Streak Multiplier
  const streakMult = getStreakMultiplier(streakDays);
  const baseWithStreak = Math.floor(BASE_POINTS * streakMult);
  breakdown.push({ source: 'CHECKIN_BASE', amount: BASE_POINTS, label: 'Check-in cơ bản' });

  if (streakDays > 0) {
    const streakBonus = baseWithStreak - BASE_POINTS;
    if (streakBonus > 0) {
      breakdown.push({ source: 'STREAK_BONUS', amount: streakBonus, label: `Streak ${streakDays} 🔥 (×${streakMult.toFixed(1)})` });
    }
  }

  transactions.push({
    user_id: userId, habit_id: habitId, type: 'EARN',
    amount: baseWithStreak, source: 'CHECKIN_BASE',
    description: `Check-in + Streak ${streakDays} ngày`,
  });

  let totalStars = baseWithStreak;

  // 2. Time Bonus
  const timeBonus = getTimeBonus();
  if (timeBonus.amount !== 0) {
    totalStars += timeBonus.amount;
    breakdown.push({ source: 'TIME_BONUS', amount: timeBonus.amount, label: timeBonus.label });
    transactions.push({
      user_id: userId, habit_id: habitId, type: 'EARN',
      amount: timeBonus.amount, source: 'TIME_BONUS',
      description: timeBonus.label,
    });
  }

  // 3. Lucky Bonus (15% chance)
  const lucky = rollLuckyBonus();
  if (lucky) {
    totalStars += lucky;
    breakdown.push({ source: 'LUCKY_BONUS', amount: lucky, label: 'Lucky Day! 🎰' });
    transactions.push({
      user_id: userId, habit_id: habitId, type: 'EARN',
      amount: lucky, source: 'LUCKY_BONUS',
      description: `Lucky Bonus +${lucky}⭐`,
    });
  }

  // 4. Milestone Bonus
  const milestone = MILESTONE_REWARDS[streakDays] || null;
  if (milestone) {
    totalStars += milestone.stars;
    breakdown.push({ source: 'MILESTONE_BONUS', amount: milestone.stars, label: `${milestone.badge} ${milestone.label}` });
    transactions.push({
      user_id: userId, habit_id: habitId, type: 'EARN',
      amount: milestone.stars, source: 'MILESTONE_BONUS',
      description: `Mốc ${streakDays} ngày: ${milestone.label}`,
    });
  }

  // 5. Perfect Day (all habits today completed)
  const allDoneNow = allHabitsToday.every(h => h.id === habitId ? true : h.done);
  const isPerfectDay = allDoneNow && allHabitsToday.length > 1;
  if (isPerfectDay) {
    const { data: pdTx } = await supabase
      .from('star_transactions').select('id')
      .eq('user_id', userId).eq('source', 'PERFECT_DAY')
      .gte('created_at', todayStart.toISOString()).limit(1);

    if (!pdTx || pdTx.length === 0) {
      totalStars += 30;
      breakdown.push({ source: 'PERFECT_DAY', amount: 30, label: 'Perfect Day! 🌈' });
      transactions.push({
        user_id: userId, type: 'EARN',
        amount: 30, source: 'PERFECT_DAY',
        description: 'Hoàn thành tất cả thói quen hôm nay!',
      });
    }
  }

  // 6. Comeback Bonus (after 1-3 days inactive)
  const isComeback = wasInactiveForDays !== undefined && wasInactiveForDays >= 1 && wasInactiveForDays <= 3;
  if (isComeback) {
    totalStars += 15;
    breakdown.push({ source: 'COMEBACK_BONUS', amount: 15, label: 'Welcome Back! 💪' });
    transactions.push({
      user_id: userId, habit_id: habitId, type: 'EARN',
      amount: 15, source: 'COMEBACK_BONUS',
      description: 'Quay lại sau khi nghỉ!',
    });
  }

  // ── Save to Supabase ──
  if (transactions.length > 0) {
    await supabase.from('star_transactions').insert(transactions);
  }

  // ── Update user_star_stats ──
  const { data: statsData } = await supabase
    .from('user_star_stats').select('*')
    .eq('user_id', userId).single();

  let newBalance: number;
  let newTotalEarned: number;
  let oldLevel = 0;

  if (statsData) {
    newBalance = statsData.current_balance + totalStars;
    newTotalEarned = statsData.total_earned + totalStars;
    oldLevel = statsData.current_level;
    const newLevel = getLevelFromStars(newTotalEarned);

    await supabase.from('user_star_stats').update({
      current_balance: newBalance,
      total_earned: newTotalEarned,
      current_level: newLevel.level,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);
  } else {
    newBalance = totalStars;
    newTotalEarned = totalStars;
    const newLevel = getLevelFromStars(newTotalEarned);

    await supabase.from('user_star_stats').insert({
      user_id: userId,
      current_balance: newBalance,
      total_earned: newTotalEarned,
      current_level: newLevel.level,
    });
  }

  const level = getLevelFromStars(newTotalEarned);
  return {
    totalStars,
    breakdown,
    luckyBonus: lucky,
    milestone: milestone ? { streakDays, ...milestone } : null,
    isPerfectDay,
    isComeback,
    newBalance,
    newTotalEarned,
    levelUp: level.level > oldLevel,
    level,
  };
}

// ── Fetch helpers ──

export async function fetchStarStats(userId: string) {
  const { data } = await supabase
    .from('user_star_stats').select('*')
    .eq('user_id', userId).single();

  if (!data) return { user_id: userId, total_earned: 0, current_balance: 0, current_level: 1 };

  // Recalculate total_earned from actual EARN transactions (source of truth)
  const { data: earnTxs } = await supabase
    .from('star_transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', 'EARN');

  const actualTotalEarned = (earnTxs || []).reduce((sum, tx) => sum + tx.amount, 0);

  // Sync if cached value is wrong
  if (actualTotalEarned !== data.total_earned) {
    const correctLevel = getLevelFromStars(actualTotalEarned);
    await supabase.from('user_star_stats').update({
      total_earned: actualTotalEarned,
      current_level: correctLevel.level,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);

    return { ...data, total_earned: actualTotalEarned, current_level: correctLevel.level };
  }

  return data;
}

export async function fetchRecentTransactions(userId: string, limit = 20) {
  const { data } = await supabase
    .from('star_transactions').select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}

// ── Phase 2: Reward Store ──

export const REWARD_TEMPLATES = [
  { title: '1 tiếng xem phim không cảm thấy tội lỗi', cost: 150, category: 'TIME' as const, emoji: '🎬' },
  { title: '30 phút chơi game sau khi học xong', cost: 80, category: 'ENTERTAINMENT' as const, emoji: '🎮' },
  { title: 'Mua 1 ly trà sữa', cost: 100, category: 'FOOD' as const, emoji: '🧋' },
  { title: 'Cà phê đặc biệt buổi sáng', cost: 60, category: 'FOOD' as const, emoji: '☕' },
  { title: 'Ngủ nướng 1 tiếng cuối tuần', cost: 120, category: 'TIME' as const, emoji: '😴' },
  { title: '30 phút scroll TikTok thoải mái', cost: 70, category: 'ENTERTAINMENT' as const, emoji: '📱' },
  { title: 'Order đồ ăn yêu thích', cost: 180, category: 'FOOD' as const, emoji: '🍕' },
  { title: 'Nghỉ ngơi trọn vẹn 1 buổi chiều', cost: 300, category: 'SELF_CARE' as const, emoji: '💆' },
  { title: 'Đi dạo 1 vòng không mang sách vở', cost: 120, category: 'SELF_CARE' as const, emoji: '🚶' },
  { title: 'Mua món đồ mình đã muốn từ lâu', cost: 1000, category: 'BIG_GOAL' as const, emoji: '🛍️' },
  { title: 'Dành 1 ngày đi chơi', cost: 800, category: 'BIG_GOAL' as const, emoji: '🎡' },
  { title: 'Xem 2 tập anime', cost: 200, category: 'ENTERTAINMENT' as const, emoji: '📺' },
];

export const CATEGORY_INFO: Record<string, { label: string; emoji: string; color: string }> = {
  TIME: { label: 'Thời gian tự do', emoji: '🎯', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  FOOD: { label: 'Ăn uống', emoji: '☕', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  ENTERTAINMENT: { label: 'Giải trí', emoji: '📱', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  SELF_CARE: { label: 'Chăm sóc bản thân', emoji: '💆', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  BIG_GOAL: { label: 'Mục tiêu lớn', emoji: '🌟', color: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export async function fetchRewards(userId: string) {
  const { data } = await supabase
    .from('rewards').select('*')
    .eq('user_id', userId)
    .order('cost', { ascending: true });
  return data || [];
}

export async function createReward(userId: string, reward: { title: string; description?: string; cost: number; category: string; emoji: string }) {
  const { data } = await supabase
    .from('rewards')
    .insert([{ ...reward, user_id: userId, is_template: false }])
    .select().single();
  return data;
}

export async function deleteReward(rewardId: string) {
  await supabase.from('rewards').delete().eq('id', rewardId);
}

export async function redeemReward(userId: string, rewardId: string, cost: number) {
  // 1. Check balance
  const stats = await fetchStarStats(userId);
  if (stats.current_balance < cost) return { success: false, message: 'Không đủ sao!' };

  // 2. Create redemption record
  await supabase.from('reward_redemptions').insert([{
    user_id: userId, reward_id: rewardId, stars_spent: cost,
  }]);

  // 3. Create REDEEM transaction
  await supabase.from('star_transactions').insert([{
    user_id: userId, type: 'REDEEM', amount: -cost,
    source: 'REWARD_REDEEM', description: `Đổi thưởng (-${cost}⭐)`,
  }]);

  // 4. Update balance (NOT total_earned — level stays)
  const newBalance = stats.current_balance - cost;
  await supabase.from('user_star_stats').update({
    current_balance: newBalance,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId);

  return { success: true, newBalance };
}

export async function seedTemplateRewards(userId: string) {
  // Only seed if user has no rewards yet
  const existing = await fetchRewards(userId);
  if (existing.length > 0) return existing;

  const templates = REWARD_TEMPLATES.map(t => ({
    ...t, user_id: userId, is_template: true,
  }));
  const { data } = await supabase.from('rewards').insert(templates).select();
  return data || [];
}

export async function fetchRedemptionHistory(userId: string, limit = 20) {
  const { data } = await supabase
    .from('reward_redemptions').select('*, rewards(title, emoji, category)')
    .eq('user_id', userId)
    .order('redeemed_at', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function processJournalReward(params: {
  userId: string;
  wordCount: number;
  hasMood: boolean;
  gratitudeCount: number;
}): Promise<{ totalStars: number; breakdown: { label: string; amount: number }[] } | null> {
  const { userId, wordCount, hasMood, gratitudeCount } = params;

  if (wordCount < 50) return null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: existing } = await supabase
    .from('star_transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('source', 'CHECKIN_BASE')
    .like('description', '%Nhật ký%')
    .gte('created_at', todayStart.toISOString())
    .limit(1);

  if (existing && existing.length > 0) return null;

  const breakdown: { source: string; amount: number; label: string }[] = [];
  const transactions: { user_id: string; type: string; amount: number; source: string; description: string }[] = [];
  let totalStars = 0;

  totalStars += 10;
  breakdown.push({ source: 'CHECKIN_BASE', amount: 10, label: 'Viết nhật ký cơ bản (≥ 50 từ) 📝' });
  transactions.push({
    user_id: userId,
    type: 'EARN',
    amount: 10,
    source: 'CHECKIN_BASE',
    description: 'Viết nhật ký hàng ngày (≥ 50 từ)'
  });

  if (hasMood) {
    totalStars += 2;
    breakdown.push({ source: 'TIME_BONUS', amount: 2, label: 'Ghi nhận cảm xúc ngày hôm nay 😊' });
    transactions.push({
      user_id: userId,
      type: 'EARN',
      amount: 2,
      source: 'TIME_BONUS',
      description: 'Nhật ký: Ghi nhận cảm xúc'
    });
  }

  if (gratitudeCount >= 3) {
    totalStars += 5;
    breakdown.push({ source: 'LUCKY_BONUS', amount: 5, label: 'Viết đủ 3 điều biết ơn 🙏' });
    transactions.push({
      user_id: userId,
      type: 'EARN',
      amount: 5,
      source: 'LUCKY_BONUS',
      description: 'Nhật ký: 3 điều biết ơn'
    });
  }

  if (transactions.length > 0) {
    await supabase.from('star_transactions').insert(transactions);
  }

  const stats = await fetchStarStats(userId);
  const newBalance = stats.current_balance + totalStars;
  const newTotalEarned = stats.total_earned + totalStars;
  const newLevel = getLevelFromStars(newTotalEarned);

  await supabase.from('user_star_stats').update({
    current_balance: newBalance,
    total_earned: newTotalEarned,
    current_level: newLevel.level,
    updated_at: new Date().toISOString()
  }).eq('user_id', userId);

  return {
    totalStars,
    breakdown: breakdown.map(b => ({ label: b.label, amount: b.amount }))
  };
}


