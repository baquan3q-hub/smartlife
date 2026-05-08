import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CountdownItem, CountUpItem, Habit, HabitLog, DayOfWeek, CheckinReward } from '../types';
import { supabase } from '../services/supabase';
import { processCheckin, reverseCheckinStars, fetchStarStats, getLevelFromStars, getNextLevel, LEVELS } from '../services/starBrainService';
import StarBrainDashboard from './StarBrainDashboard';
import { Plus, X, Flame, Timer, TrendingUp, Trash2, Edit3, ChevronDown, RotateCcw, Award, CheckCircle2, Circle, Calendar, BarChart3, ChevronLeft, ChevronRight, Star, Sparkles, Zap, Gift, ListChecks } from 'lucide-react';

const DAY_LABELS: Record<DayOfWeek, string> = { mon:'T2', tue:'T3', wed:'T4', thu:'T5', fri:'T6', sat:'T7', sun:'CN' };
const ALL_DAYS: DayOfWeek[] = ['mon','tue','wed','thu','fri','sat','sun'];
const getDayKey = (d: Date): DayOfWeek => ALL_DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];

// ── Preset Data (Phase 3 Gradients) ──
const COLOR_PRESETS = [
  { name: 'sunrise', bg: 'bg-gradient-to-br from-orange-400 to-rose-500', light: 'bg-orange-50 text-orange-600 border-orange-200' },
  { name: 'cosmic', bg: 'bg-gradient-to-br from-indigo-500 to-purple-600', light: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { name: 'nature', bg: 'bg-gradient-to-br from-emerald-400 to-teal-500', light: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { name: 'ocean', bg: 'bg-gradient-to-br from-blue-500 to-cyan-500', light: 'bg-blue-50 text-blue-700 border-blue-200' },
  { name: 'peach', bg: 'bg-gradient-to-br from-pink-400 to-orange-400', light: 'bg-pink-50 text-pink-600 border-pink-200' },
  { name: 'midnight', bg: 'bg-gradient-to-br from-slate-700 to-slate-900', light: 'bg-slate-100 text-slate-800 border-slate-300' },
  { name: 'lava', bg: 'bg-gradient-to-br from-red-500 to-orange-500', light: 'bg-red-50 text-red-600 border-red-200' },
  { name: 'royal', bg: 'bg-gradient-to-br from-violet-600 to-fuchsia-600', light: 'bg-violet-50 text-violet-700 border-violet-200' },
];

const EMOJI_PRESETS = [
  // Health & Fitness
  '🏃‍♂️','🏋️‍♀️','🚴‍♂️','🧘‍♀️','🏊‍♂️','⚽','🏸','💧','🍎','🥗','💊','💤','🩺','☀️',
  // Work & Study
  '📚','💻','🎓','📈','🧠','📝','💼','🏆','🚀','⏰','📱','💸',
  // Hobbies & Life
  '🎨','🎵','🎮','✈️','🪴','📸','🎬','🐶','🐱','🚗','🏖️','☕','🧹',
  // Social & Others
  '💑','👪','🎉','❤️','🌟','🔥','💪','🎯','🎂','🚭','👍','🤝'
];

const getColorClasses = (theme: string) => COLOR_PRESETS.find(c => c.name === theme) || COLOR_PRESETS[0];
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const toLocalDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const diffDays = (target: string) => Math.ceil((new Date(target).getTime() - new Date(today()).getTime()) / 86400000);

interface Props { userId: string; onNavigateToSchedule?: () => void; }

// ── Main Component ──
const HabitDashboard: React.FC<Props> = ({ userId, onNavigateToSchedule }) => {
  const [subTab, setSubTab] = useState<'habits' | 'countdown' | 'countup' | 'stars'>('habits');
  const [countdowns, setCountdowns] = useState<CountdownItem[]>([]);
  const [countups, setCountups] = useState<CountUpItem[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<'countdown' | 'countup' | 'habit' | null>(null);
  const [editItem, setEditItem] = useState<any>(null);
  const [detailHabit, setDetailHabit] = useState<Habit | null>(null);
  const [detailMonth, setDetailMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });

  // ── StarBrain State ──
  const [starStats, setStarStats] = useState({ total_earned: 0, current_balance: 0, current_level: 1 });
  const [checkinResult, setCheckinResult] = useState<CheckinReward | null>(null);

  // ── Fetch Data ──
  useEffect(() => {
    if (!userId) return;
    const fetchAll = async () => {
      setLoading(true);
      const [cdRes, cuRes, hRes, hlRes] = await Promise.all([
        supabase.from('countdown_items').select('*').eq('user_id', userId).order('target_date', { ascending: true }),
        supabase.from('countup_items').select('*').eq('user_id', userId).order('start_date', { ascending: false }),
        supabase.from('habits').select('*').eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: true }),
        supabase.from('habit_logs').select('*,habits!inner(user_id)').eq('habits.user_id', userId).order('log_date', { ascending: false }),
      ]);
      if (cdRes.data) setCountdowns(cdRes.data);
      if (cuRes.data) setCountups(cuRes.data.map((i: any) => ({ ...i, milestones: i.milestones || [7,30,100,365,1000] })));
      if (hRes.data) setHabits(hRes.data.map((h: any) => ({ ...h, active_days: h.active_days || ALL_DAYS })));
      if (hlRes.data) setHabitLogs(hlRes.data);
      // Fetch star stats
      try { const ss = await fetchStarStats(userId); setStarStats(ss); } catch {}
      setLoading(false);
    };
    fetchAll();
  }, [userId]);

  // ── On-open: fill missed days ──
  useEffect(() => {
    if (!habits.length || loading) return;
    const fillMissed = async () => {
      const todayStr = today();
      const logsToInsert: { habit_id: string; log_date: string; completed: boolean }[] = [];
      for (const h of habits) {
        const start = new Date(h.start_date);
        const now = new Date(todayStr);
        const cursor = new Date(start);
        while (cursor < now) {
          const dateStr = cursor.toISOString().split('T')[0];
          const dayKey = getDayKey(cursor);
          if ((h.frequency === 'daily' || h.frequency === 'custom') && h.active_days.includes(dayKey)) {
            const exists = habitLogs.some(l => l.habit_id === h.id && l.log_date === dateStr);
            if (!exists) logsToInsert.push({ habit_id: h.id, log_date: dateStr, completed: false });
          }
          cursor.setDate(cursor.getDate() + 1);
        }
      }
      if (logsToInsert.length > 0 && logsToInsert.length < 500) {
        const { data } = await supabase.from('habit_logs').upsert(logsToInsert, { onConflict: 'habit_id,log_date', ignoreDuplicates: true }).select();
        if (data) setHabitLogs(prev => [...prev, ...data]);
      }
    };
    fillMissed();
  }, [habits.length, loading]);

  // ── Habit CRUD ──
  const addHabit = async (item: Omit<Habit, 'id' | 'user_id' | 'created_at'>) => {
    const { data } = await supabase.from('habits').insert([{ ...item, user_id: userId }]).select().single();
    if (data) setHabits(prev => [...prev, { ...data, active_days: data.active_days || ALL_DAYS }]);
    setShowForm(null);
  };
  const updateHabit = async (id: string, updates: Partial<Habit>) => {
    const { error } = await supabase.from('habits').update(updates).eq('id', id);
    if (!error) setHabits(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
    setEditItem(null); setShowForm(null);
  };
  const deleteHabit = async (id: string) => {
    if (!window.confirm('Xóa thói quen này? Toàn bộ lịch sử check-in cũng sẽ bị xóa.')) return;
    await supabase.from('habits').delete().eq('id', id);
    setHabits(prev => prev.filter(h => h.id !== id));
    setHabitLogs(prev => prev.filter(l => l.habit_id !== id));
    if (detailHabit?.id === id) setDetailHabit(null);
  };

  // ── Check-in Toggle ──
  const toggleCheckIn = async (habitId: string) => {
    const todayStr = today();
    const existing = habitLogs.find(l => l.habit_id === habitId && l.log_date === todayStr);
    let justCheckedIn = false;

    if (existing) {
      const newVal = !existing.completed;
      justCheckedIn = newVal;
      setHabitLogs(prev => prev.map(l => l.id === existing.id ? { ...l, completed: newVal } : l));
      await supabase.from('habit_logs').update({ completed: newVal }).eq('id', existing.id);
    } else {
      justCheckedIn = true;
      const optimistic: HabitLog = { id: 'temp-' + Date.now(), habit_id: habitId, log_date: todayStr, completed: true };
      setHabitLogs(prev => [optimistic, ...prev]);
      const { data } = await supabase.from('habit_logs').insert([{ habit_id: habitId, log_date: todayStr, completed: true }]).select().single();
      if (data) setHabitLogs(prev => prev.map(l => l.id === optimistic.id ? data : l));
    }

    // ── StarBrain: Award stars on check-in ──
    if (justCheckedIn) {
      try {
        const habit = habits.find(h => h.id === habitId);
        if (!habit) return;
        const stats = getHabitStats(habit);

        // Comeback detection
        const prevLogs = habitLogs
          .filter(l => l.habit_id === habitId && l.completed && l.log_date < todayStr)
          .sort((a, b) => b.log_date.localeCompare(a.log_date));
        const lastDate = prevLogs[0]?.log_date;
        let wasInactiveForDays: number | undefined;
        if (lastDate) {
          const diff = Math.floor((new Date(todayStr).getTime() - new Date(lastDate).getTime()) / 86400000);
          if (diff > 1) wasInactiveForDays = diff - 1;
        }

        // All today's habits for Perfect Day check
        const allHabitsToday = todaysHabits.map(h => ({
          id: h.id,
          done: h.id === habitId ? true : habitLogs.some(l => l.habit_id === h.id && l.log_date === todayStr && l.completed),
        }));

        const result = await processCheckin({
          userId, habitId,
          streakDays: stats.currentStreak,
          allHabitsToday,
          wasInactiveForDays,
        });

        if (result) {
          setCheckinResult(result);
          setStarStats({ current_balance: result.newBalance, total_earned: result.newTotalEarned, current_level: result.level.level });
          setTimeout(() => setCheckinResult(null), 5000);
        }
      } catch (err) {
        console.warn('StarBrain error:', err);
      }
    } else {
      // ── StarBrain: Reverse stars on uncheck ──
      try {
        const newBalance = await reverseCheckinStars(userId, habitId);
        const ss = await fetchStarStats(userId);
        setStarStats({ current_balance: ss.current_balance, total_earned: ss.total_earned, current_level: ss.current_level });
      } catch (err) {
        console.warn('StarBrain reverse error:', err);
      }
    }
  };

  // ── Streak Engine ──
  const getWeekKey = (d: Date) => { const t = new Date(d); t.setDate(t.getDate() - (t.getDay() === 0 ? 6 : t.getDay() - 1)); return toLocalDateStr(t); };
  const getMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`;

  const getHabitStats = useCallback((habit: Habit) => {
    const logs = habitLogs.filter(l => l.habit_id === habit.id);
    const completedLogs = logs.filter(l => l.completed);

    if (habit.frequency === 'weekly' || habit.frequency === 'monthly') {
      const isWeekly = habit.frequency === 'weekly';
      const getKey = isWeekly ? getWeekKey : getMonthKey;
      const target = habit.target_per_period || 1;
      
      const periodCounts: Record<string, number> = {};
      completedLogs.forEach(l => { const k = getKey(new Date(l.log_date)); periodCounts[k] = (periodCounts[k] || 0) + 1; });

      const d = new Date(today());
      const currentKey = getKey(d);
      let currentStreak = 0;
      if ((periodCounts[currentKey] || 0) >= target) currentStreak++;
      
      const cursor = new Date(d);
      if (isWeekly) cursor.setDate(cursor.getDate() - 7); else cursor.setMonth(cursor.getMonth() - 1);
      
      while (true) {
        const k = getKey(cursor);
        if ((periodCounts[k] || 0) >= target) {
          currentStreak++;
          if (isWeekly) cursor.setDate(cursor.getDate() - 7); else cursor.setMonth(cursor.getMonth() - 1);
        } else break;
      }
      
      let bestStreak = 0, tempStreak = 0, scheduledPeriods = 0;
      const start = new Date(habit.start_date);
      const iter = new Date(start);
      const now = new Date(today());
      
      while (iter <= now || getKey(iter) === currentKey) {
        scheduledPeriods++;
        const k = getKey(iter);
        if ((periodCounts[k] || 0) >= target) {
          tempStreak++;
          bestStreak = Math.max(bestStreak, tempStreak);
        } else if (k !== currentKey) tempStreak = 0;
        
        if (isWeekly) iter.setDate(iter.getDate() + 7); else iter.setMonth(iter.getMonth() + 1);
      }
      const successfulPeriods = Object.values(periodCounts).filter(v => v >= target).length;
      const completionRate = scheduledPeriods > 0 ? Math.round((successfulPeriods / scheduledPeriods) * 100) : 0;
      return { currentStreak, bestStreak, completionRate, totalCompleted: completedLogs.length, totalScheduled: scheduledPeriods * target };
    }

    const scheduledLogs = logs.length;
    const completionRate = scheduledLogs > 0 ? Math.round((completedLogs.length / scheduledLogs) * 100) : 0;
    // Current streak: count backwards from today
    let currentStreak = 0;
    const d = new Date(today());
    // Check if today is scheduled and done
    const todayLog = logs.find(l => l.log_date === today());
    const todayScheduled = habit.active_days.includes(getDayKey(d));
    if (todayScheduled && todayLog?.completed) currentStreak = 1;
    else if (todayScheduled && !todayLog) { /* grace: don't break, just don't count */ }
    // Go backwards
    const cursor = new Date(d); cursor.setDate(cursor.getDate() - 1);
    while (true) {
      const ds = toLocalDateStr(cursor);
      const dayKey = getDayKey(cursor);
      if (!habit.active_days.includes(dayKey)) { cursor.setDate(cursor.getDate() - 1); continue; }
      const log = logs.find(l => l.log_date === ds);
      if (log?.completed) { currentStreak++; cursor.setDate(cursor.getDate() - 1); }
      else break;
      if (currentStreak > 1000) break; // safety
    }
    // Best streak
    let bestStreak = 0, tempStreak = 0;
    const sortedDates = logs.filter(l => l.completed).map(l => l.log_date).sort();
    // Build scheduled date set for this habit
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) { tempStreak = 1; }
      else {
        // check consecutive scheduled days between sortedDates[i-1] and sortedDates[i]
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        let gap = false;
        const check = new Date(prev); check.setDate(check.getDate() + 1);
        while (check < curr) {
          if (habit.active_days.includes(getDayKey(check))) { gap = true; break; }
          check.setDate(check.getDate() + 1);
        }
        tempStreak = gap ? 1 : tempStreak + 1;
      }
      bestStreak = Math.max(bestStreak, tempStreak);
    }
    bestStreak = Math.max(bestStreak, currentStreak);
    return { currentStreak, bestStreak, completionRate, totalCompleted: completedLogs.length, totalScheduled: scheduledLogs };
  }, [habitLogs]);

  // ── Today's habits ──
  const todayDayKey = getDayKey(new Date());
  const todaysHabits = habits.filter(h => h.frequency === 'weekly' || h.frequency === 'monthly' || h.active_days.includes(todayDayKey));
  const todayDone = todaysHabits.filter(h => habitLogs.some(l => l.habit_id === h.id && l.log_date === today() && l.completed)).length;

  // ── 30-day streak bar data ──
  const getStreakBar = useCallback((habit: Habit) => {
    const bars: { date: string; done: boolean; scheduled: boolean }[] = [];
    const d = new Date();
    for (let i = 29; i >= 0; i--) {
      const cursor = new Date(d); cursor.setDate(cursor.getDate() - i);
      const ds = cursor.toISOString().split('T')[0];
      const scheduled = habit.frequency === 'weekly' || habit.frequency === 'monthly' ? true : habit.active_days.includes(getDayKey(cursor));
      const done = habitLogs.some(l => l.habit_id === habit.id && l.log_date === ds && l.completed);
      bars.push({ date: ds, done, scheduled });
    }
    return bars;
  }, [habitLogs]);

  // ── CRUD Countdown ──
  const addCountdown = async (item: Omit<CountdownItem, 'id' | 'user_id' | 'created_at'>) => {
    const { data, error } = await supabase.from('countdown_items').insert([{ ...item, user_id: userId }]).select().single();
    if (data) setCountdowns(prev => [...prev, data].sort((a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime()));
    setShowForm(null);
  };

  const updateCountdown = async (id: string, updates: Partial<CountdownItem>) => {
    const { error } = await supabase.from('countdown_items').update(updates).eq('id', id);
    if (!error) setCountdowns(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    setEditItem(null); setShowForm(null);
  };

  const deleteCountdown = async (id: string) => {
    if (!window.confirm('Xóa sự kiện này?')) return;
    await supabase.from('countdown_items').delete().eq('id', id);
    setCountdowns(prev => prev.filter(c => c.id !== id));
  };

  // ── CRUD Count-Up ──
  const addCountup = async (item: Omit<CountUpItem, 'id' | 'user_id' | 'created_at'>) => {
    const { data, error } = await supabase.from('countup_items').insert([{ ...item, user_id: userId }]).select().single();
    if (data) setCountups(prev => [{ ...data, milestones: data.milestones || [7,30,100,365,1000] }, ...prev]);
    setShowForm(null);
  };

  const updateCountup = async (id: string, updates: Partial<CountUpItem>) => {
    const { error } = await supabase.from('countup_items').update(updates).eq('id', id);
    if (!error) setCountups(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    setEditItem(null); setShowForm(null);
  };

  const deleteCountup = async (id: string) => {
    if (!window.confirm('Xóa mốc sự kiện này?')) return;
    await supabase.from('countup_items').delete().eq('id', id);
    setCountups(prev => prev.filter(c => c.id !== id));
  };

  // ── Countdown Groups ──
  const { upcoming, todayEvents, past } = useMemo(() => {
    const up: CountdownItem[] = [], td: CountdownItem[] = [], pa: CountdownItem[] = [];
    countdowns.forEach(c => {
      const d = diffDays(c.target_date);
      if (d > 0) up.push(c);
      else if (d === 0) td.push(c);
      else pa.push(c);
    });
    return { upcoming: up, todayEvents: td, past: pa.reverse() };
  }, [countdowns]);

  // ── Count-Up Milestone Check ──
  const getReachedMilestones = (startDate: string, milestones: number[]) => {
    const elapsed = -diffDays(startDate); // positive number
    return milestones.filter(m => elapsed >= m);
  };
  const getNextMilestone = (startDate: string, milestones: number[]) => {
    const elapsed = -diffDays(startDate);
    return milestones.find(m => m > elapsed) || null;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Flame className="text-orange-500" size={28} /> Thói quen & Sự kiện
          </h1>
          <p className="text-gray-500 text-sm mt-1">Theo dõi sự kiện, mốc thời gian và thói quen hàng ngày</p>
        </div>
        {/* ── StarBrain Balance Widget ── */}
        <div className="flex items-stretch gap-2 w-full">
          <div className="flex-1 bg-gradient-to-r from-amber-50/70 to-yellow-50/60 border border-amber-100 rounded-xl px-2 md:px-3 py-1.5 md:py-2 flex items-center justify-center gap-1.5 shadow-sm">
            <div className="w-7 h-7 md:w-8 md:h-8 bg-gradient-to-br from-amber-300 to-yellow-400 rounded-lg flex items-center justify-center shadow-sm shrink-0">
              <Star size={14} className="text-white fill-white" />
            </div>
            <div>
              <div className="text-sm md:text-base font-black text-amber-600/80 leading-tight">{starStats.current_balance.toLocaleString()}</div>
              <div className="text-[9px] md:text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                {getLevelFromStars(starStats.total_earned).icon} {getLevelFromStars(starStats.total_earned).name}
              </div>
            </div>
          </div>
          <button
            onClick={() => setSubTab('stars')}
            className="flex-1 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/60 rounded-xl px-2 md:px-3 py-1.5 md:py-2 flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <div className="w-7 h-7 md:w-8 md:h-8 bg-gradient-to-br from-orange-300 to-rose-400 rounded-lg flex items-center justify-center shadow-sm shrink-0">
              <Gift size={14} className="text-white" />
            </div>
            <span className="text-[11px] md:text-sm font-bold text-orange-500">Đổi quà</span>
          </button>
          <button
            onClick={() => onNavigateToSchedule?.()}
            className="flex-1 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 rounded-xl px-2 md:px-3 py-1.5 md:py-2 flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <div className="w-7 h-7 md:w-8 md:h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center shadow-sm shrink-0">
              <ListChecks size={14} className="text-white" />
            </div>
            <span className="text-[11px] md:text-sm font-bold text-blue-500">Todo</span>
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 md:gap-2 bg-gray-100 p-1 md:p-1.5 rounded-xl md:rounded-2xl w-fit">
        {([
          { key: 'habits', label: '🔥 Habits', icon: Flame },
          { key: 'countdown', label: '⏳ Countdown', icon: Timer },
          { key: 'countup', label: '⬆️ Count-Up', icon: TrendingUp },
          { key: 'stars', label: '⭐ Stars', icon: Star },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`px-2.5 md:px-4 py-1.5 md:py-2.5 rounded-lg md:rounded-xl text-[11px] md:text-sm font-semibold transition-all ${subTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── HABITS TAB ── */}
      {subTab === 'habits' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">Today's Habits</h2>
            <button onClick={() => { setEditItem(null); setShowForm('habit'); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold text-sm shadow-lg shadow-orange-200 hover:-translate-y-0.5 transition-all">
              <Plus size={18} /> Thêm thói quen
            </button>
          </div>

          {/* Today Panel */}
          <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-6 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-bl-full -z-0"></div>
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-gray-500 font-bold uppercase tracking-wider text-xs">Tiến độ hôm nay</h3>
                  <div className="text-3xl font-black text-gray-900 mt-1">{todayDone} <span className="text-lg text-gray-400 font-medium">/ {todaysHabits.length}</span></div>
                </div>
                <div className="w-16 h-16 rounded-full border-4 border-orange-100 flex items-center justify-center">
                  <Flame size={32} className={todayDone === todaysHabits.length && todaysHabits.length > 0 ? 'text-orange-500 animate-pulse' : 'text-gray-300'} />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {todaysHabits.map(h => {
                  const done = habitLogs.some(l => l.habit_id === h.id && l.log_date === today() && l.completed);
                  const color = getColorClasses(h.color_theme);
                  return (
                    <button key={h.id} onClick={() => toggleCheckIn(h.id)}
                      className={`flex items-center p-3 rounded-xl border text-left transition-all ${done ? color.light + ' ring-2 ring-offset-1 ' + color.bg.replace('bg-', 'ring-') : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0 mr-3 ${done ? color.bg + ' text-white shadow-sm' : 'bg-white text-gray-400 shadow-sm'}`}>
                        {h.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-bold truncate ${done ? 'text-gray-900' : 'text-gray-600'}`}>{h.title}</div>
                        <div className="text-[10px] text-gray-400 font-medium flex items-center gap-1 mt-0.5">
                          <Flame size={10} className={done ? 'text-orange-400' : ''} /> {getHabitStats(h).currentStreak} streak
                        </div>
                      </div>
                      <div className="shrink-0 ml-2 text-gray-300">
                        {done ? <CheckCircle2 size={20} className={color.bg.replace('bg-', 'text-')} /> : <Circle size={20} />}
                      </div>
                    </button>
                  );
                })}
                {todaysHabits.length === 0 && (
                  <div className="col-span-full py-4 text-center text-gray-400 text-sm">Không có thói quen nào được lên lịch cho hôm nay.</div>
                )}
              </div>
            </div>
          </div>

          {/* All Habits List */}
          <div>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 mt-8">Tất cả thói quen</h3>
            <div className="space-y-3">
              {habits.map(h => {
                const stats = getHabitStats(h);
                const bar = getStreakBar(h);
                const color = getColorClasses(h.color_theme);
                return (
                  <div key={h.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all group flex flex-col sm:flex-row gap-4 items-start sm:items-center cursor-pointer" onClick={() => setDetailHabit(h)}>
                    <div className="flex items-center gap-4 flex-1 w-full">
                      <div className={`w-12 h-12 ${color.bg} text-white rounded-xl flex items-center justify-center text-2xl shadow-sm shrink-0`}>
                        {h.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 truncate text-lg">{h.title}</h4>
                        <div className="flex items-center gap-3 text-xs font-medium mt-1">
                          <span className="flex items-center gap-1 text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md"><Flame size={12} /> {stats.currentStreak}</span>
                          <span className="flex items-center gap-1 text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md"><Award size={12} /> {stats.bestStreak} max</span>
                          <span className="text-gray-400 hidden sm:inline">{stats.completionRate}% completion</span>
                        </div>
                      </div>
                    </div>
                    {/* 30-day timeline bar */}
                    <div className="w-full sm:w-48 shrink-0 flex items-center justify-between sm:justify-end gap-0.5 h-6">
                      {bar.map((b, i) => (
                        <div key={i} title={b.date} className={`flex-1 h-full max-w-[6px] rounded-sm transition-colors ${b.done ? color.bg : (b.scheduled ? 'bg-gray-100' : 'bg-transparent')}`} />
                      ))}
                    </div>
                  </div>
                );
              })}
              {habits.length === 0 && (
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                  <Flame size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 font-medium">Chưa có thói quen nào</p>
                  <p className="text-gray-400 text-sm mt-1">Tạo thói quen để bắt đầu theo dõi tiến độ</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── COUNTDOWN TAB ── */}
      {subTab === 'countdown' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button onClick={() => { setEditItem(null); setShowForm('countdown'); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-indigo-200 hover:-translate-y-0.5 transition-all">
              <Plus size={18} /> Thêm sự kiện
            </button>
          </div>

          {/* Today */}
          {todayEvents.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">🎉 Hôm nay</h3>
              <div className="space-y-3">
                {todayEvents.map(c => <CountdownCard key={c.id} item={c} onEdit={() => { setEditItem(c); setShowForm('countdown'); }} onDelete={() => deleteCountdown(c.id)} />)}
              </div>
            </div>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">⏳ Sắp tới ({upcoming.length})</h3>
              <div className="space-y-3">
                {upcoming.map(c => <CountdownCard key={c.id} item={c} onEdit={() => { setEditItem(c); setShowForm('countdown'); }} onDelete={() => deleteCountdown(c.id)} />)}
              </div>
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">📌 Đã qua ({past.length})</h3>
              <div className="space-y-3">
                {past.map(c => <CountdownCard key={c.id} item={c} onEdit={() => { setEditItem(c); setShowForm('countdown'); }} onDelete={() => deleteCountdown(c.id)} />)}
              </div>
            </div>
          )}

          {countdowns.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
              <Timer size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">Chưa có sự kiện nào</p>
              <p className="text-gray-400 text-sm mt-1">Nhấn "Thêm sự kiện" để bắt đầu đếm ngược</p>
            </div>
          )}
        </div>
      )}

      {/* ── COUNT-UP TAB ── */}
      {subTab === 'countup' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button onClick={() => { setEditItem(null); setShowForm('countup'); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-emerald-200 hover:-translate-y-0.5 transition-all">
              <Plus size={18} /> Thêm mốc sự kiện
            </button>
          </div>

          <div className="space-y-3">
            {countups.map(c => {
              const elapsed = -diffDays(c.start_date);
              const reached = getReachedMilestones(c.start_date, c.milestones);
              const next = getNextMilestone(c.start_date, c.milestones);
              const color = getColorClasses(c.color_theme);
              return (
                <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all group">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 ${color.bg} rounded-2xl flex items-center justify-center text-2xl shadow-sm shrink-0`}>
                      {c.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 truncate">{c.title}</h4>
                      <p className="text-gray-400 text-xs mt-0.5">Từ {new Date(c.start_date).toLocaleDateString('vi-VN')}</p>
                      {reached.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {reached.slice(-3).map(m => (
                            <span key={m} className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full font-bold border border-amber-100">🏅 {m} ngày</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-3xl font-black text-gray-900">{elapsed.toLocaleString()}</div>
                      <div className="text-xs text-gray-400 font-medium">ngày</div>
                      {next && <div className="text-[10px] text-gray-300 mt-1">Mốc tiếp: {next} ngày</div>}
                    </div>
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditItem(c); setShowForm('countup'); }} className="p-1.5 hover:bg-gray-100 rounded-lg"><Edit3 size={14} className="text-gray-400" /></button>
                      <button onClick={() => deleteCountup(c.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 size={14} className="text-red-400" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {countups.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
              <TrendingUp size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">Chưa có mốc sự kiện nào</p>
              <p className="text-gray-400 text-sm mt-1">Ghi nhận mốc sự kiện quan trọng để đếm ngày</p>
            </div>
          )}
        </div>
      )}

      {/* ── STARS TAB ── */}
      {subTab === 'stars' && (
        <StarBrainDashboard userId={userId} />
      )}

      {/* ── FORM MODAL ── */}
      {showForm && (
        <EventFormModal
          type={showForm}
          editItem={editItem}
          onClose={() => { setShowForm(null); setEditItem(null); }}
          onSaveCountdown={(item) => editItem ? updateCountdown(editItem.id, item) : addCountdown(item)}
          onSaveCountup={(item) => editItem ? updateCountup(editItem.id, item) : addCountup(item)}
          onSaveHabit={(item) => editItem ? updateHabit(editItem.id, item) : addHabit(item)}
        />
      )}

      {/* ── HABIT DETAIL MODAL ── */}
      {detailHabit && (
        <HabitDetailModal
          habit={detailHabit}
          stats={getHabitStats(detailHabit)}
          logs={habitLogs.filter(l => l.habit_id === detailHabit.id)}
          month={detailMonth}
          setMonth={setDetailMonth}
          onClose={() => setDetailHabit(null)}
          onEdit={() => { setEditItem(detailHabit); setShowForm('habit'); }}
          onDelete={() => deleteHabit(detailHabit.id)}
        />
      )}

      {/* ── STARBRAIN CHECKIN CELEBRATION ── */}
      {checkinResult && (
        <CheckinCelebration result={checkinResult} onClose={() => setCheckinResult(null)} />
      )}
    </div>
  );
};

// ── Countdown Card ──
const CountdownCard: React.FC<{ item: CountdownItem; onEdit: () => void; onDelete: () => void }> = ({ item, onEdit, onDelete }) => {
  const days = diffDays(item.target_date);
  const isToday = days === 0;
  const isPast = days < 0;
  const color = getColorClasses(item.color_theme);

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 hover:shadow-md transition-all group ${isToday ? 'border-yellow-200 bg-yellow-50/30 ring-2 ring-yellow-100' : 'border-gray-100'}`}>
      <div className="flex items-center gap-4">
        <div className={`w-14 h-14 ${color.bg} rounded-2xl flex items-center justify-center text-2xl shadow-sm shrink-0`}>
          {item.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-gray-900 truncate">{item.title}</h4>
            {item.is_recurring && <RotateCcw size={12} className="text-indigo-400 shrink-0" />}
          </div>
          {item.description && <p className="text-gray-400 text-xs mt-0.5 truncate">{item.description}</p>}
          <p className="text-gray-400 text-xs mt-0.5">{new Date(item.target_date).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
        </div>
        <div className="text-right shrink-0">
          {isToday ? (
            <div className="text-2xl font-black text-yellow-600">🎉 Hôm nay!</div>
          ) : isPast ? (
            <>
              <div className="text-2xl font-black text-gray-400">{Math.abs(days)}</div>
              <div className="text-xs text-gray-400">ngày trước</div>
            </>
          ) : (
            <>
              <div className="text-3xl font-black text-gray-900">{days}</div>
              <div className="text-xs text-gray-400 font-medium">ngày nữa</div>
            </>
          )}
        </div>
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1.5 hover:bg-gray-100 rounded-lg"><Edit3 size={14} className="text-gray-400" /></button>
          <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 size={14} className="text-red-400" /></button>
        </div>
      </div>
    </div>
  );
};

// ── Form Modal ──
const EventFormModal: React.FC<{
  type: 'countdown' | 'countup' | 'habit';
  editItem: any;
  onClose: () => void;
  onSaveCountdown: (item: any) => void;
  onSaveCountup: (item: any) => void;
  onSaveHabit: (item: any) => void;
}> = ({ type, editItem, onClose, onSaveCountdown, onSaveCountup, onSaveHabit }) => {
  const [title, setTitle] = useState(editItem?.title || '');
  const [description, setDescription] = useState(editItem?.description || '');
  const [date, setDate] = useState(editItem?.target_date || editItem?.start_date || editItem?.start_date || today());
  const [isRecurring, setIsRecurring] = useState(editItem?.is_recurring || false);
  const [colorTheme, setColorTheme] = useState(editItem?.color_theme || (type === 'countdown' ? 'blue' : type === 'habit' ? 'orange' : 'emerald'));
  const [icon, setIcon] = useState(editItem?.icon || (type === 'habit' ? '✅' : '📅'));
  const [showEmojis, setShowEmojis] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Habit specific
  const [frequency, setFrequency] = useState<'daily'|'custom'|'weekly'|'monthly'>(editItem?.frequency || 'daily');
  const [activeDays, setActiveDays] = useState<DayOfWeek[]>(editItem?.active_days || ALL_DAYS);
  const [targetPerPeriod, setTargetPerPeriod] = useState<number>(editItem?.target_per_period || 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setSaving(true);
    if (type === 'countdown') {
      await onSaveCountdown({ title: title.trim(), description: description.trim() || null, target_date: date, is_recurring: isRecurring, color_theme: colorTheme, icon });
    } else if (type === 'countup') {
      await onSaveCountup({ title: title.trim(), start_date: date, color_theme: colorTheme, icon, milestones: [7, 30, 100, 365, 1000] });
    } else {
      await onSaveHabit({ 
        title: title.trim(), description: description.trim() || null, start_date: date, 
        color_theme: colorTheme, icon, frequency, 
        target_per_period: (frequency === 'weekly' || frequency === 'monthly') ? targetPerPeriod : undefined,
        active_days: frequency === 'daily' ? ALL_DAYS : activeDays, 
        is_active: true 
      });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[95%] max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className={`p-6 ${type === 'countdown' ? 'bg-gradient-to-br from-indigo-600 to-blue-700' : type === 'habit' ? 'bg-gradient-to-br from-orange-500 to-red-600' : 'bg-gradient-to-br from-emerald-600 to-teal-700'} text-white`}>
          <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl"><X size={18} /></button>
          <h3 className="text-xl font-bold">{editItem ? 'Chỉnh sửa' : 'Thêm'} {type === 'countdown' ? 'Countdown' : type === 'habit' ? 'Thói quen' : 'Count-Up'}</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Icon + Title */}
          <div className="flex gap-3">
            <div className="relative">
              <button type="button" onClick={() => setShowEmojis(!showEmojis)}
                className="w-14 h-14 bg-gray-100 hover:bg-gray-200 rounded-2xl flex items-center justify-center text-2xl transition-colors border-2 border-dashed border-gray-200">
                {icon}
              </button>
              {showEmojis && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 z-50 w-[280px] grid grid-cols-6 gap-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                  {EMOJI_PRESETS.map((e, idx) => (
                    <button key={idx} type="button" onClick={() => { setIcon(e); setShowEmojis(false); }}
                      className="w-10 h-10 flex items-center justify-center text-xl hover:bg-gray-100 rounded-xl transition-colors">{e}</button>
                  ))}
                </div>
              )}
            </div>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tên sự kiện *" required
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none" />
          </div>

          {/* Description (countdown & habit) */}
          {(type === 'countdown' || type === 'habit') && (
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Ghi chú (tùy chọn)"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none resize-none" rows={2} />
          )}

          {/* Date */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">{type === 'countdown' ? 'Ngày mục tiêu' : 'Ngày bắt đầu'}</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none" />
          </div>

          {/* Habit frequency */}
          {type === 'habit' && (
            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Tần suất</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setFrequency('daily')} className={`py-2 rounded-lg text-sm font-bold border transition-colors ${frequency === 'daily' ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>Hàng ngày</button>
                <button type="button" onClick={() => setFrequency('custom')} className={`py-2 rounded-lg text-sm font-bold border transition-colors ${frequency === 'custom' ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>Tùy chỉnh</button>
                <button type="button" onClick={() => setFrequency('weekly')} className={`py-2 rounded-lg text-sm font-bold border transition-colors ${frequency === 'weekly' ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>Theo Tuần</button>
                <button type="button" onClick={() => setFrequency('monthly')} className={`py-2 rounded-lg text-sm font-bold border transition-colors ${frequency === 'monthly' ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>Theo Tháng</button>
              </div>

              {frequency === 'custom' && (
                <div className="flex justify-between gap-1 mt-2">
                  {ALL_DAYS.map(d => (
                    <button key={d} type="button" onClick={() => setActiveDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                      className={`w-10 h-10 rounded-full text-xs font-bold transition-all ${activeDays.includes(d) ? 'bg-orange-500 text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                      {DAY_LABELS[d]}
                    </button>
                  ))}
                </div>
              )}

              {(frequency === 'weekly' || frequency === 'monthly') && (
                <div className="mt-3 bg-orange-50/50 p-3 rounded-xl border border-orange-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-700">Mục tiêu:</span>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" max={frequency === 'weekly' ? 7 : 31} value={targetPerPeriod} onChange={e => setTargetPerPeriod(Number(e.target.value))}
                      className="w-16 px-2 py-1 text-center border border-gray-300 rounded-lg font-bold text-gray-800 outline-none focus:border-orange-400" />
                    <span className="text-sm font-medium text-gray-500">lần / {frequency === 'weekly' ? 'tuần' : 'tháng'}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recurring (countdown only) */}
          {type === 'countdown' && (
            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
              <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)}
                className="w-5 h-5 rounded-lg text-indigo-600 border-gray-300" />
              <div>
                <span className="text-sm font-medium text-gray-700">Lặp lại hàng năm</span>
                <p className="text-xs text-gray-400">VD: Sinh nhật, kỷ niệm...</p>
              </div>
            </label>
          )}

          {/* Color */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Màu chủ đề</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_PRESETS.map(c => (
                <button key={c.name} type="button" onClick={() => setColorTheme(c.name)}
                  className={`w-9 h-9 ${c.bg} rounded-xl transition-all ${colorTheme === c.name ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`} />
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving || !title.trim()}
            className={`w-full py-3.5 rounded-xl font-bold text-sm text-white shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 ${type === 'countdown' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : type === 'habit' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-200' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'}`}>
            {saving ? 'Đang lưu...' : (editItem ? 'Cập nhật' : 'Tạo mới')}
          </button>
        </form>
      </div>
    </div>
  );
};

// ── Habit Detail Modal (Dot Calendar) ──
const HabitDetailModal: React.FC<{
  habit: Habit; stats: any; logs: HabitLog[]; month: { year: number, month: number };
  setMonth: (m: { year: number, month: number }) => void; onClose: () => void; onEdit: () => void; onDelete: () => void;
}> = ({ habit, stats, logs, month, setMonth, onClose, onEdit, onDelete }) => {
  const color = getColorClasses(habit.color_theme);
  
  // Build calendar days
  const firstDay = new Date(month.year, month.month, 1);
  const lastDay = new Date(month.year, month.month + 1, 0);
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Mon=0
  const daysInMonth = lastDay.getDate();
  const calendarGrid = Array(startOffset).fill(null).concat(Array.from({length: daysInMonth}, (_,i) => i+1));

  const prevMonth = () => setMonth(month.month === 0 ? { year: month.year - 1, month: 11 } : { year: month.year, month: month.month - 1 });
  const nextMonth = () => setMonth(month.month === 11 ? { year: month.year + 1, month: 0 } : { year: month.year, month: month.month + 1 });

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className={`p-6 ${color.bg} text-white flex items-center gap-4 shrink-0`}>
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl shadow-sm backdrop-blur-sm">{habit.icon}</div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{habit.title}</h2>
            <p className="text-white/80 text-sm mt-0.5">{habit.description || 'Theo dõi thói quen'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X size={20} /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-2xl p-4 text-center border border-gray-100">
              <Flame size={24} className="mx-auto text-orange-500 mb-1" />
              <div className="text-2xl font-black text-gray-900">{stats.currentStreak}</div>
              <div className="text-xs font-bold text-gray-500 uppercase">Current Streak</div>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 text-center border border-gray-100">
              <Award size={24} className="mx-auto text-yellow-500 mb-1" />
              <div className="text-2xl font-black text-gray-900">{stats.bestStreak}</div>
              <div className="text-xs font-bold text-gray-500 uppercase">Best Streak</div>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 text-center border border-gray-100">
              <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1" />
              <div className="text-2xl font-black text-gray-900">{stats.totalCompleted}</div>
              <div className="text-xs font-bold text-gray-500 uppercase">Total Done</div>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 text-center border border-gray-100">
              <BarChart3 size={24} className="mx-auto text-blue-500 mb-1" />
              <div className="text-2xl font-black text-gray-900">{stats.completionRate}%</div>
              <div className="text-xs font-bold text-gray-500 uppercase">Completion Rate</div>
            </div>
          </div>

          {/* Calendar Heatmap */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><Calendar size={18} className="text-gray-400" /> Lịch sử</h3>
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-lg"><ChevronLeft size={16} /></button>
                <span className="text-sm font-bold w-20 text-center">T{month.month + 1}, {month.year}</span>
                <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-lg"><ChevronRight size={16} /></button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-y-2 text-center mb-2">
              {['T2','T3','T4','T5','T6','T7','CN'].map(d => <div key={d} className="text-[10px] font-bold text-gray-400">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-y-2 gap-x-1">
              {calendarGrid.map((d, i) => {
                if (!d) return <div key={i} />;
                const dateStr = `${month.year}-${String(month.month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const theDate = new Date(dateStr);
                const isScheduled = habit.active_days.includes(getDayKey(theDate)) && theDate >= new Date(habit.start_date);
                const log = logs.find(l => l.log_date === dateStr);
                const isFuture = theDate > new Date(today());
                
                let dotClass = 'bg-gray-100 text-gray-400';
                if (!isScheduled) dotClass = 'opacity-20'; // not scheduled
                else if (isFuture) dotClass = 'bg-gray-50 border border-dashed border-gray-200 text-gray-300';
                else if (log?.completed) dotClass = `${color.bg} text-white shadow-sm ring-1 ring-offset-1 ${color.bg.replace('bg-', 'ring-')}`;
                else dotClass = 'bg-red-50 text-red-400 border border-red-100'; // missed

                return (
                  <div key={i} className="flex justify-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${dotClass}`}>
                      {d}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3 shrink-0">
          <button onClick={() => { onClose(); onEdit(); }} className="flex-1 py-3 bg-white border border-gray-200 rounded-xl font-bold text-sm text-gray-700 hover:bg-gray-50 shadow-sm flex items-center justify-center gap-2"><Edit3 size={16} /> Sửa</button>
          <button onClick={() => { onClose(); onDelete(); }} className="flex-1 py-3 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 flex items-center justify-center gap-2"><Trash2 size={16} /> Xóa</button>
        </div>
      </div>
    </div>
  );
};

// ── Checkin Celebration Modal ──
const CheckinCelebration: React.FC<{ result: CheckinReward; onClose: () => void }> = ({ result, onClose }) => {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'starSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Header glow */}
        <div className={`p-6 text-center ${
          result.luckyBonus ? 'bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-400' :
          result.milestone ? 'bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500' :
          'bg-gradient-to-br from-amber-400 to-orange-500'
        } text-white relative overflow-hidden`}>
          {/* Sparkle dots */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="absolute w-1.5 h-1.5 bg-white/40 rounded-full"
                style={{
                  left: `${10 + i * 12}%`, top: `${20 + (i % 3) * 25}%`,
                  animation: `starFloat ${1.5 + i * 0.2}s ease-in-out infinite alternate`,
                  animationDelay: `${i * 0.15}s`,
                }} />
            ))}
          </div>

          <div className="relative z-10">
            {result.luckyBonus ? (
              <div className="text-4xl mb-2" style={{ animation: 'starPulse 0.6s ease-in-out infinite alternate' }}>🎰</div>
            ) : result.milestone ? (
              <div className="text-4xl mb-2" style={{ animation: 'starPulse 0.6s ease-in-out infinite alternate' }}>{result.milestone.badge}</div>
            ) : (
              <Sparkles size={36} className="mx-auto mb-2" style={{ animation: 'starSpin 2s linear infinite' }} />
            )}
            <div className="text-5xl font-black" style={{ animation: 'starBounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)' }}>
              +{result.totalStars} ⭐
            </div>
            {result.milestone && (
              <div className="mt-2 text-sm font-bold bg-white/20 rounded-full px-4 py-1 inline-block">
                {result.milestone.badge} {result.milestone.label}
              </div>
            )}
            {result.levelUp && (
              <div className="mt-2 text-sm font-bold bg-white/30 rounded-full px-4 py-1 inline-block">
                🎉 Level Up! → {result.level.icon} {result.level.name}
              </div>
            )}
          </div>
        </div>

        {/* Breakdown */}
        <div className="p-5 space-y-2">
          {result.breakdown.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm"
              style={{ animation: `starFadeInRight 0.3s ease-out ${0.1 + i * 0.08}s both` }}>
              <span className="text-gray-600 font-medium">{item.label}</span>
              <span className={`font-bold ${item.amount > 0 ? 'text-amber-600' : 'text-red-400'}`}>
                {item.amount > 0 ? '+' : ''}{item.amount} ⭐
              </span>
            </div>
          ))}

          <div className="border-t border-gray-100 pt-3 mt-3 flex items-center justify-between">
            <span className="text-gray-500 text-sm font-medium">Số dư hiện tại</span>
            <span className="text-lg font-black text-amber-600">{result.newBalance.toLocaleString()} ⭐</span>
          </div>

          {result.isPerfectDay && (
            <div className="bg-emerald-50 text-emerald-700 rounded-xl p-3 text-center text-sm font-bold border border-emerald-100 mt-2">
              🌈 Perfect Day! Hoàn thành tất cả thói quen!
            </div>
          )}
          {result.isComeback && (
            <div className="bg-blue-50 text-blue-700 rounded-xl p-3 text-center text-sm font-bold border border-blue-100 mt-2">
              💪 Welcome Back! Chào mừng bạn quay lại!
            </div>
          )}
        </div>

        <button onClick={onClose}
          className="w-full py-3.5 bg-gray-50 text-gray-500 font-bold text-sm hover:bg-gray-100 transition-colors border-t border-gray-100">
          Tuyệt vời! ✨
        </button>
      </div>

      <style>{`
        @keyframes starSlideUp {
          from { opacity: 0; transform: translateY(40px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes starBounceIn {
          from { opacity: 0; transform: scale(0.3); }
          50% { transform: scale(1.1); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes starFloat {
          from { opacity: 0.3; transform: translateY(0); }
          to { opacity: 0.8; transform: translateY(-8px); }
        }
        @keyframes starPulse {
          from { transform: scale(1); }
          to { transform: scale(1.15); }
        }
        @keyframes starSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes starFadeInRight {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default HabitDashboard;
