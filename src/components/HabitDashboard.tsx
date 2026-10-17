import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CountdownItem, CountUpItem, Habit, HabitLog, DayOfWeek, CheckinReward } from '../types';
import { supabase } from '../services/supabase';
import { processCheckin, reverseCheckinStars, fetchStarStats, getLevelFromStars } from '../services/starBrainService';
import StarBrainDashboard from './StarBrainDashboard';
import { Award, Check, ChevronLeft, ChevronRight, Flame, Flag, Minus, Pencil, Plus, Repeat, Sparkles, Star, Timer, Trash2, X } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { Button, Card, EmptyState, FieldLabel, IconButton, Progress, Segmented, SectionLabel, Sheet, inputClass } from './ui/parts';
import { DEFAULT_ICON, IconPicker, IconTile, TintPicker, getTint } from './habits/icons';

const DAY_LABELS: Record<DayOfWeek, string> = { mon:'T2', tue:'T3', wed:'T4', thu:'T5', fri:'T6', sat:'T7', sun:'CN' };
const ALL_DAYS: DayOfWeek[] = ['mon','tue','wed','thu','fri','sat','sun'];
const getDayKey = (d: Date): DayOfWeek => ALL_DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const toLocalDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const diffDays = (target: string) => Math.ceil((new Date(target).getTime() - new Date(today()).getTime()) / 86400000);
const formatDate = (s: string, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }) =>
  new Date(s).toLocaleDateString('vi-VN', opts);

// "Hằng ngày", "T2, T4, T6", "3 lần/tuần"...
const frequencyLabel = (h: Habit) => {
  if (h.frequency === 'weekly') return `${h.target_per_period || 1} lần/tuần`;
  if (h.frequency === 'monthly') return `${h.target_per_period || 1} lần/tháng`;
  if (h.frequency === 'daily' || h.active_days.length === 7) return 'Hằng ngày';
  return ALL_DAYS.filter(d => h.active_days.includes(d)).map(d => DAY_LABELS[d]).join(', ');
};
const streakUnit = (h: Habit) => (h.frequency === 'weekly' ? 'tuần' : h.frequency === 'monthly' ? 'tháng' : 'ngày');

const FREE_HABIT_LIMIT = 3;

type SubTab = 'habits' | 'countdown' | 'countup' | 'stars';
const TABS: { id: SubTab; label: string }[] = [
  { id: 'habits', label: 'Thói quen' },
  { id: 'countdown', label: 'Đếm ngược' },
  { id: 'countup', label: 'Đếm ngày' },
  { id: 'stars', label: 'Sao' },
];

interface Props { userId: string; onNavigateToSchedule?: () => void; isPro?: boolean; onUpgrade?: () => void; }

// ── Main Component ──
const HabitDashboard: React.FC<Props> = ({ userId, isPro = false, onUpgrade }) => {
  const [subTab, setSubTab] = useState<SubTab>('habits');
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

  // Unified custom delete confirmation modal state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

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

  // ── On-open: fill missed days (Optimized to O(1) checks and max 30 days history) ──
  useEffect(() => {
    if (!habits.length || loading) return;
    const fillMissed = async () => {
      const todayStr = today();
      const logsToInsert: { habit_id: string; log_date: string; completed: boolean }[] = [];
      const existingLogsSet = new Set(habitLogs.map(l => `${l.habit_id}_${l.log_date}`));
      
      // Quét tối đa 30 ngày trước để tránh quá tải
      const thirtyDaysAgoTime = Date.now() - 30 * 24 * 60 * 60 * 1000;

      for (const h of habits) {
        const start = new Date(h.start_date);
        const limitStart = new Date(Math.max(start.getTime(), thirtyDaysAgoTime));
        const now = new Date(todayStr);
        const cursor = new Date(limitStart);
        
        while (cursor < now) {
          const dateStr = cursor.toISOString().split('T')[0];
          const dayKey = getDayKey(cursor);
          if ((h.frequency === 'daily' || h.frequency === 'custom') && h.active_days.includes(dayKey)) {
            const exists = existingLogsSet.has(`${h.id}_${dateStr}`);
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
    // Free user limit check
    if (!isPro && habits.length >= FREE_HABIT_LIMIT) {
      onUpgrade?.();
      setShowForm(null);
      return;
    }
    const { data } = await supabase.from('habits').insert([{ ...item, user_id: userId }]).select().single();
    if (data) setHabits(prev => [...prev, { ...data, active_days: data.active_days || ALL_DAYS }]);
    setShowForm(null);
  };
  const updateHabit = async (id: string, updates: Partial<Habit>) => {
    const { error } = await supabase.from('habits').update(updates).eq('id', id);
    if (!error) setHabits(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
    setEditItem(null); setShowForm(null);
  };
  const deleteHabit = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa thói quen',
      message: 'Bạn có chắc chắn muốn xóa thói quen này? Toàn bộ lịch sử check-in của thói quen này cũng sẽ bị xóa vĩnh viễn và không thể khôi phục.',
      onConfirm: async () => {
        await supabase.from('habits').delete().eq('id', id);
        setHabits(prev => prev.filter(h => h.id !== id));
        setHabitLogs(prev => prev.filter(l => l.habit_id !== id));
        if (detailHabit?.id === id) setDetailHabit(null);
      }
    });
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

  // Group habit logs by habit ID for O(1) retrieval
  const logsByHabitId = useMemo(() => {
    const map = new Map<string, HabitLog[]>();
    for (let i = 0; i < habitLogs.length; i++) {
      const log = habitLogs[i];
      let arr = map.get(log.habit_id);
      if (!arr) {
        arr = [];
        map.set(log.habit_id, arr);
      }
      arr.push(log);
    }
    return map;
  }, [habitLogs]);

  // A Set of completed log keys (format: "habitId_date") for O(1) checks
  const completedLogsSet = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < habitLogs.length; i++) {
      const log = habitLogs[i];
      if (log.completed) {
        set.add(`${log.habit_id}_${log.log_date}`);
      }
    }
    return set;
  }, [habitLogs]);

  const getHabitStats = useCallback((habit: Habit) => {
    const logs = logsByHabitId.get(habit.id) || [];
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
  }, [logsByHabitId]);

  // ── Today's habits (Memoized for Performance) ──
  const todaysHabits = useMemo(() => {
    const todayDayKey = getDayKey(new Date());
    return habits.filter(h => h.frequency === 'weekly' || h.frequency === 'monthly' || h.active_days.includes(todayDayKey));
  }, [habits]);

  const todayDone = useMemo(() => {
    const todayStr = today();
    return todaysHabits.filter(h => completedLogsSet.has(`${h.id}_${todayStr}`)).length;
  }, [todaysHabits, completedLogsSet]);

  // ── 30-day streak bar data (Optimized with completedLogsSet) ──
  const getStreakBar = useCallback((habit: Habit) => {
    const bars: { date: string; done: boolean; scheduled: boolean }[] = [];
    const d = new Date();
    for (let i = 29; i >= 0; i--) {
      const cursor = new Date(d); cursor.setDate(cursor.getDate() - i);
      const ds = toLocalDateStr(cursor);
      const scheduled = habit.frequency === 'weekly' || habit.frequency === 'monthly' ? true : habit.active_days.includes(getDayKey(cursor));
      const done = completedLogsSet.has(`${habit.id}_${ds}`);
      bars.push({ date: ds, done, scheduled });
    }
    return bars;
  }, [completedLogsSet]);

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

  const deleteCountdown = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa sự kiện',
      message: 'Bạn có chắc chắn muốn xóa sự kiện đếm ngược này?',
      onConfirm: async () => {
        await supabase.from('countdown_items').delete().eq('id', id);
        setCountdowns(prev => prev.filter(c => c.id !== id));
      }
    });
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

  const deleteCountup = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa mốc sự kiện',
      message: 'Bạn có chắc chắn muốn xóa mốc sự kiện đếm ngày này?',
      onConfirm: async () => {
        await supabase.from('countup_items').delete().eq('id', id);
        setCountups(prev => prev.filter(c => c.id !== id));
      }
    });
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


  // Completions in the current week/month, for weekly and monthly habits.
  const periodDone = (h: Habit) => {
    const getKey = h.frequency === 'weekly' ? getWeekKey : getMonthKey;
    const key = getKey(new Date(today()));
    return (logsByHabitId.get(h.id) || []).filter(l => l.completed && getKey(new Date(l.log_date)) === key).length;
  };
  const isDoneToday = (h: Habit) => completedLogsSet.has(`${h.id}_${today()}`);
  const otherHabits = habits.filter(h => !todaysHabits.includes(h));
  const atFreeLimit = !isPro && habits.length >= FREE_HABIT_LIMIT;
  const level = getLevelFromStars(starStats.total_earned);
  const todayLabel = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' });

  const openForm = (type: 'countdown' | 'countup' | 'habit', item: any = null) => { setEditItem(item); setShowForm(type); };

  const renderHabitRow = (h: Habit, checkable: boolean) => {
    const done = isDoneToday(h);
    const stats = getHabitStats(h);
    const tint = getTint(h.color_theme);
    const bar = getStreakBar(h).slice(-14);
    const periodic = h.frequency === 'weekly' || h.frequency === 'monthly';
    return (
      <li key={h.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={() => setDetailHabit(h)}
          className="-mx-1 flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-zinc-50"
        >
          <IconTile icon={h.icon} theme={h.color_theme} />
          <span className="min-w-0">
            <span className={`block truncate text-[15px] font-medium ${done ? 'text-zinc-500' : 'text-zinc-950'}`}>{h.title}</span>
            <span className="mt-0.5 flex items-center gap-2 text-[12px] text-zinc-500">
              <span className="truncate">{periodic ? `${Math.min(periodDone(h), h.target_per_period || 1)}/${h.target_per_period || 1} ${h.frequency === 'weekly' ? 'tuần này' : 'tháng này'}` : frequencyLabel(h)}</span>
              {stats.currentStreak > 0 && (
                <span className="inline-flex shrink-0 items-center gap-0.5 tabular-nums text-amber-700" title={`Chuỗi ${stats.currentStreak} ${streakUnit(h)}`}>
                  <Flame size={12} aria-hidden /> {stats.currentStreak} {streakUnit(h)}
                </span>
              )}
            </span>
          </span>
        </button>
        <span className="hidden shrink-0 items-center gap-[3px] md:flex" aria-hidden title="14 ngày gần nhất">
          {bar.map(b => (
            <span key={b.date} className={`h-5 w-1.5 rounded-full ${b.done ? tint.solid : b.scheduled ? 'bg-zinc-100' : 'bg-transparent'}`} />
          ))}
        </span>
        {checkable && (
          <button
            type="button"
            onClick={() => toggleCheckIn(h.id)}
            aria-pressed={done}
            aria-label={done ? `Bỏ đánh dấu "${h.title}"` : `Đánh dấu "${h.title}" đã xong`}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ${done ? `${tint.solid} border-transparent text-white` : 'border-zinc-900/[0.12] text-zinc-300 hover:border-zinc-900/[0.3] hover:text-zinc-500'}`}
          >
            <Check size={18} strokeWidth={2.5} />
          </button>
        )}
      </li>
    );
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center" role="status" aria-label="Đang tải">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-500" />
      </div>
    );
  }

  const todayPct = todaysHabits.length ? (todayDone / todaysHabits.length) * 100 : 0;
  const allDone = todaysHabits.length > 0 && todayDone === todaysHabits.length;

  return (
    <div className="habits ui-zinc w-full px-3 pb-24 pt-4 text-zinc-900 md:px-8 md:pt-8">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] text-zinc-500 first-letter:uppercase">{todayLabel}</p>
            <h1 className="mt-0.5 text-[26px] font-semibold tracking-tight text-zinc-950 md:text-[30px]">Thói quen</h1>
          </div>
          <button
            type="button"
            onClick={() => setSubTab('stars')}
            className="mt-1 flex h-10 shrink-0 items-center gap-2 rounded-full border border-zinc-900/[0.1] bg-white px-3.5 text-[14px] transition-colors hover:bg-zinc-50"
            aria-label={`${starStats.current_balance.toLocaleString()} sao, cấp ${level.name}. Mở Sao`}
          >
            <Star size={15} className="fill-amber-400 text-amber-400" aria-hidden />
            <span className="font-semibold tabular-nums text-zinc-950">{starStats.current_balance.toLocaleString()}</span>
            <span className="hidden text-zinc-500 sm:inline">· {level.name}</span>
          </button>
        </div>

        <Segmented<SubTab> value={subTab} options={TABS} onChange={setSubTab} label="Mục" size="md" className="flex w-full sm:inline-flex sm:w-auto" />

        {/* ── HABITS TAB ── */}
        {subTab === 'habits' && (
          <div className="space-y-5">
            {habits.length > 0 && (
              <Card className="p-4 sm:p-5">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[13px] text-zinc-500">Hôm nay</div>
                    <div className="mt-1 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-zinc-950">
                      {todayDone}<span className="text-[18px] font-medium text-zinc-400"> / {todaysHabits.length}</span>
                    </div>
                  </div>
                  <div className="text-right text-[13px] text-zinc-500">
                    {todaysHabits.length === 0 ? 'Không có lịch hôm nay' : allDone ? 'Đã xong tất cả' : `Còn ${todaysHabits.length - todayDone} thói quen`}
                  </div>
                </div>
                <div className="mt-4">
                  <Progress value={todayPct} className={allDone ? 'bg-emerald-500' : 'bg-sky-600'} />
                </div>
              </Card>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] tabular-nums text-zinc-500">
                {isPro ? `${habits.length} thói quen` : `${habits.length}/${FREE_HABIT_LIMIT} thói quen miễn phí`}
              </p>
              {atFreeLimit ? (
                <Button variant="primary" onClick={() => onUpgrade?.()}>
                  <Sparkles size={15} /> Nâng cấp Pro
                </Button>
              ) : (
                <Button variant="primary" onClick={() => openForm('habit')}>
                  <Plus size={16} /> Thêm thói quen
                </Button>
              )}
            </div>

            {habits.length === 0 ? (
              <EmptyState
                icon={<Flame size={20} />}
                title="Chưa có thói quen nào"
                hint="Bắt đầu với một việc nhỏ bạn muốn làm mỗi ngày, ví dụ uống đủ nước hoặc đọc 10 trang sách."
                action={<Button variant="secondary" onClick={() => openForm('habit')}><Plus size={16} /> Tạo thói quen đầu tiên</Button>}
              />
            ) : (
              <>
                {todaysHabits.length > 0 && (
                  <section>
                    <SectionLabel meta={todaysHabits.length}>Lịch hôm nay</SectionLabel>
                    <Card className="overflow-hidden">
                      <ul className="divide-y divide-zinc-900/[0.06]">{todaysHabits.map(h => renderHabitRow(h, true))}</ul>
                    </Card>
                  </section>
                )}
                {otherHabits.length > 0 && (
                  <section>
                    <SectionLabel meta={otherHabits.length}>Không có lịch hôm nay</SectionLabel>
                    <Card className="overflow-hidden">
                      <ul className="divide-y divide-zinc-900/[0.06]">{otherHabits.map(h => renderHabitRow(h, false))}</ul>
                    </Card>
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {/* ── COUNTDOWN TAB ── */}
        {subTab === 'countdown' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] text-zinc-500">Đếm số ngày tới những dịp quan trọng</p>
              <Button variant="primary" onClick={() => openForm('countdown')}>
                <Plus size={16} /> Thêm sự kiện
              </Button>
            </div>

            {countdowns.length === 0 ? (
              <EmptyState icon={<Timer size={20} />} title="Chưa có sự kiện nào" hint="Thêm kỳ thi, sinh nhật hay chuyến đi để biết còn bao nhiêu ngày." />
            ) : (
              ([
                { label: 'Hôm nay', items: todayEvents },
                { label: 'Sắp tới', items: upcoming },
                { label: 'Đã qua', items: past },
              ]).filter(g => g.items.length > 0).map(g => (
                <section key={g.label}>
                  <SectionLabel meta={g.items.length}>{g.label}</SectionLabel>
                  <Card className="overflow-hidden">
                    <ul className="divide-y divide-zinc-900/[0.06]">
                      {g.items.map(c => <CountdownRow key={c.id} item={c} onOpen={() => openForm('countdown', c)} />)}
                    </ul>
                  </Card>
                </section>
              ))
            )}
          </div>
        )}

        {/* ── COUNT-UP TAB ── */}
        {subTab === 'countup' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] text-zinc-500">Đếm số ngày kể từ một mốc</p>
              <Button variant="primary" onClick={() => openForm('countup')}>
                <Plus size={16} /> Thêm mốc
              </Button>
            </div>

            {countups.length === 0 ? (
              <EmptyState icon={<Flag size={20} />} title="Chưa có mốc nào" hint="Ví dụ: ngày bắt đầu đi làm, ngày bỏ thuốc, ngày quen nhau." />
            ) : (
              <Card className="overflow-hidden">
                <ul className="divide-y divide-zinc-900/[0.06]">
                  {countups.map(c => {
                    const elapsed = -diffDays(c.start_date);
                    const reached = getReachedMilestones(c.start_date, c.milestones);
                    const next = getNextMilestone(c.start_date, c.milestones);
                    const prev = reached.length ? reached[reached.length - 1] : 0;
                    const pct = next ? ((elapsed - prev) / (next - prev)) * 100 : 100;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => openForm('countup', c)}
                          className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-zinc-50 sm:px-4"
                        >
                          <IconTile icon={c.icon} theme={c.color_theme} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-medium text-zinc-950">{c.title}</span>
                            <span className="mt-0.5 block truncate text-[12px] text-zinc-500">
                              Từ {formatDate(c.start_date)}{next ? ` · mốc tiếp ${next.toLocaleString()} ngày` : ''}
                            </span>
                            <span className="mt-2 block max-w-[220px]">
                              <Progress value={pct} className={getTint(c.color_theme).solid} />
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-[22px] font-semibold leading-none tracking-tight tabular-nums text-zinc-950">{Math.max(0, elapsed).toLocaleString()}</span>
                            <span className="mt-1 block text-[12px] text-zinc-500">ngày</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
          </div>
        )}

        {/* ── STARS TAB ── */}
        {subTab === 'stars' && <StarBrainDashboard userId={userId} />}
      </div>

      {/* ── FORM ── */}
      {showForm && (
        <EventFormSheet
          type={showForm}
          editItem={editItem}
          onClose={() => { setShowForm(null); setEditItem(null); }}
          onSaveCountdown={(item) => editItem ? updateCountdown(editItem.id, item) : addCountdown(item)}
          onSaveCountup={(item) => editItem ? updateCountup(editItem.id, item) : addCountup(item)}
          onSaveHabit={(item) => editItem ? updateHabit(editItem.id, item) : addHabit(item)}
          onDelete={editItem && showForm !== 'habit' ? () => {
            const id = editItem.id;
            setShowForm(null); setEditItem(null);
            if (showForm === 'countdown') deleteCountdown(id); else deleteCountup(id);
          } : undefined}
        />
      )}

      {/* ── HABIT DETAIL ── */}
      {detailHabit && (
        <HabitDetailSheet
          habit={detailHabit}
          stats={getHabitStats(detailHabit)}
          logs={logsByHabitId.get(detailHabit.id) || []}
          month={detailMonth}
          setMonth={setDetailMonth}
          checkable={todaysHabits.some(h => h.id === detailHabit.id)}
          doneToday={isDoneToday(detailHabit)}
          onToggleToday={() => toggleCheckIn(detailHabit.id)}
          onClose={() => setDetailHabit(null)}
          onEdit={() => { const h = detailHabit; setDetailHabit(null); openForm('habit', h); }}
          onDelete={() => deleteHabit(detailHabit.id)}
        />
      )}

      {/* ── STARBRAIN CHECK-IN TOAST ── */}
      {checkinResult && (
        <CheckinToast result={checkinResult} onClose={() => setCheckinResult(null)} onOpenStars={() => { setCheckinResult(null); setSubTab('stars'); }} />
      )}

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(p => ({ ...p, isOpen: false }))}
        confirmText="Xóa"
        cancelText="Hủy"
      />
    </div>
  );
};

// ── Countdown Row ──
const CountdownRow: React.FC<{ item: CountdownItem; onOpen: () => void }> = ({ item, onOpen }) => {
  const days = diffDays(item.target_date);
  const isToday = days === 0;
  const isPast = days < 0;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors sm:px-4 ${isToday ? 'bg-sky-50/70 hover:bg-sky-50' : 'hover:bg-zinc-50'}`}
      >
        <IconTile icon={item.icon} theme={item.color_theme} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={`truncate text-[15px] font-medium ${isPast ? 'text-zinc-500' : 'text-zinc-950'}`}>{item.title}</span>
            {item.is_recurring && <Repeat size={13} className="shrink-0 text-zinc-400" aria-label="Lặp lại hằng năm" />}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-zinc-500">
            <span className="first-letter:uppercase">{formatDate(item.target_date, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
            {item.description ? ` · ${item.description}` : ''}
          </span>
        </span>
        <span className="shrink-0 text-right">
          {isToday ? (
            <span className="rounded-full bg-sky-600 px-2.5 py-1 text-[12px] font-medium text-white">Hôm nay</span>
          ) : (
            <>
              <span className={`block text-[22px] font-semibold leading-none tracking-tight tabular-nums ${isPast ? 'text-zinc-400' : 'text-zinc-950'}`}>
                {Math.abs(days).toLocaleString()}
              </span>
              <span className="mt-1 block text-[12px] text-zinc-500">{isPast ? 'ngày trước' : 'ngày nữa'}</span>
            </>
          )}
        </span>
      </button>
    </li>
  );
};

// ── Form Sheet ──
type Frequency = 'daily' | 'custom' | 'weekly' | 'monthly';
const FREQUENCIES: { id: Frequency; label: string }[] = [
  { id: 'daily', label: 'Hằng ngày' },
  { id: 'custom', label: 'Chọn ngày' },
  { id: 'weekly', label: 'Theo tuần' },
  { id: 'monthly', label: 'Theo tháng' },
];
const FORM_TITLES = {
  habit: ['Thói quen mới', 'Sửa thói quen'],
  countdown: ['Sự kiện đếm ngược', 'Sửa sự kiện'],
  countup: ['Mốc đếm ngày', 'Sửa mốc'],
} as const;
const DEFAULT_TINT = { habit: 'amber', countdown: 'sky', countup: 'emerald' } as const;

const EventFormSheet: React.FC<{
  type: 'countdown' | 'countup' | 'habit';
  editItem: any;
  onClose: () => void;
  onSaveCountdown: (item: any) => void;
  onSaveCountup: (item: any) => void;
  onSaveHabit: (item: any) => void;
  onDelete?: () => void;
}> = ({ type, editItem, onClose, onSaveCountdown, onSaveCountup, onSaveHabit, onDelete }) => {
  const [title, setTitle] = useState(editItem?.title || '');
  const [description, setDescription] = useState(editItem?.description || '');
  const [date, setDate] = useState(editItem?.target_date || editItem?.start_date || today());
  const [isRecurring, setIsRecurring] = useState(editItem?.is_recurring || false);
  const [colorTheme, setColorTheme] = useState(editItem?.color_theme ? getTint(editItem.color_theme).id : DEFAULT_TINT[type]);
  const [icon, setIcon] = useState<string>(editItem?.icon || DEFAULT_ICON[type]);
  const [saving, setSaving] = useState(false);

  // Habit specific
  const [frequency, setFrequency] = useState<Frequency>(editItem?.frequency || 'daily');
  const [activeDays, setActiveDays] = useState<DayOfWeek[]>(editItem?.active_days || ALL_DAYS);
  const [targetPerPeriod, setTargetPerPeriod] = useState<number>(editItem?.target_per_period || 1);
  const maxTarget = frequency === 'weekly' ? 7 : 31;

  const invalid = !title.trim() || !date || (type === 'habit' && frequency === 'custom' && activeDays.length === 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid) return;
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

  const formId = `event-form-${type}`;

  return (
    <Sheet
      open
      onClose={onClose}
      title={FORM_TITLES[type][editItem ? 1 : 0]}
      footer={
        <div className="flex items-center gap-2">
          {onDelete && (
            <Button variant="danger" onClick={onDelete} className="-ml-2 px-3">
              <Trash2 size={16} /> Xóa
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>Hủy</Button>
            <Button variant="primary" type="submit" form={formId} disabled={saving || invalid}>
              {saving ? 'Đang lưu…' : editItem ? 'Lưu' : 'Tạo'}
            </Button>
          </div>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-center gap-3">
          <IconTile icon={icon} theme={colorTheme} size="lg" />
          <div className="min-w-0 flex-1">
            <label htmlFor={`${formId}-title`} className="sr-only">Tên</label>
            <input
              id={`${formId}-title`}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={type === 'habit' ? 'Ví dụ: Đọc sách 20 phút' : type === 'countdown' ? 'Ví dụ: Thi cuối kỳ' : 'Ví dụ: Ngày bắt đầu đi làm'}
              required
              autoFocus={!editItem}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <FieldLabel>Biểu tượng</FieldLabel>
          <IconPicker value={icon} onChange={setIcon} theme={colorTheme} defaultGroup={type === 'habit' ? 'health' : 'events'} />
        </div>

        <div>
          <FieldLabel>Màu</FieldLabel>
          <TintPicker value={colorTheme} onChange={setColorTheme} />
        </div>

        {type === 'habit' && (
          <div className="space-y-3">
            <FieldLabel>Tần suất</FieldLabel>
            <Segmented<Frequency> value={frequency} options={FREQUENCIES} onChange={setFrequency} label="Tần suất" className="flex w-full" />

            {frequency === 'custom' && (
              <div className="flex justify-between gap-1" role="group" aria-label="Ngày trong tuần">
                {ALL_DAYS.map(d => {
                  const on = activeDays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setActiveDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                      className={`h-10 w-10 rounded-full text-[13px] font-medium transition-colors ${on ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-500 hover:text-zinc-900'}`}
                    >
                      {DAY_LABELS[d]}
                    </button>
                  );
                })}
              </div>
            )}

            {(frequency === 'weekly' || frequency === 'monthly') && (
              <div className="flex items-center justify-between rounded-xl bg-zinc-50 py-1.5 pl-3.5 pr-1.5">
                <span className="text-[14px] text-zinc-700">Mục tiêu</span>
                <div className="flex items-center gap-1">
                  <IconButton label="Giảm" onClick={() => setTargetPerPeriod(n => Math.max(1, n - 1))} disabled={targetPerPeriod <= 1}>
                    <Minus size={16} />
                  </IconButton>
                  <span className="w-7 text-center text-[15px] font-semibold tabular-nums text-zinc-950">{Math.min(targetPerPeriod, maxTarget)}</span>
                  <IconButton label="Tăng" onClick={() => setTargetPerPeriod(n => Math.min(maxTarget, n + 1))} disabled={targetPerPeriod >= maxTarget}>
                    <Plus size={16} />
                  </IconButton>
                  <span className="pr-2 text-[13px] text-zinc-500">lần/{frequency === 'weekly' ? 'tuần' : 'tháng'}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <FieldLabel htmlFor={`${formId}-date`}>{type === 'countdown' ? 'Ngày diễn ra' : 'Ngày bắt đầu'}</FieldLabel>
          <input id={`${formId}-date`} type="date" value={date} onChange={e => setDate(e.target.value)} required className={inputClass} />
        </div>

        {type === 'countdown' && (
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3.5 py-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-600">
            <span>
              <span className="block text-[14px] font-medium text-zinc-800">Lặp lại hằng năm</span>
              <span className="block text-[12px] text-zinc-500">Sinh nhật, ngày kỷ niệm…</span>
            </span>
            <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="sr-only" />
            <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${isRecurring ? 'bg-sky-600' : 'bg-zinc-200'}`} aria-hidden>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${isRecurring ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
            </span>
          </label>
        )}

        {(type === 'countdown' || type === 'habit') && (
          <div>
            <FieldLabel htmlFor={`${formId}-note`}>Ghi chú</FieldLabel>
            <textarea
              id={`${formId}-note`}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Không bắt buộc"
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>
        )}
      </form>
    </Sheet>
  );
};

// ── Habit Detail Sheet ──
const HabitDetailSheet: React.FC<{
  habit: Habit; stats: { currentStreak: number; bestStreak: number; completionRate: number; totalCompleted: number };
  logs: HabitLog[]; month: { year: number, month: number }; setMonth: (m: { year: number, month: number }) => void;
  checkable: boolean; doneToday: boolean; onToggleToday: () => void;
  onClose: () => void; onEdit: () => void; onDelete: () => void;
}> = ({ habit, stats, logs, month, setMonth, checkable, doneToday, onToggleToday, onClose, onEdit, onDelete }) => {
  const tint = getTint(habit.color_theme);
  const periodic = habit.frequency === 'weekly' || habit.frequency === 'monthly';
  const unit = streakUnit(habit);

  // Build calendar days
  const firstDay = new Date(month.year, month.month, 1);
  const lastDay = new Date(month.year, month.month + 1, 0);
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Mon=0
  const daysInMonth = lastDay.getDate();
  const calendarGrid: (number | null)[] = Array(startOffset).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  const todayStr = today();

  const prevMonth = () => setMonth(month.month === 0 ? { year: month.year - 1, month: 11 } : { year: month.year, month: month.month - 1 });
  const nextMonth = () => setMonth(month.month === 11 ? { year: month.year + 1, month: 0 } : { year: month.year, month: month.month + 1 });

  const statTiles = [
    { label: 'Chuỗi hiện tại', value: stats.currentStreak, suffix: unit, icon: <Flame size={14} /> },
    { label: 'Dài nhất', value: stats.bestStreak, suffix: unit, icon: <Award size={14} /> },
    { label: 'Đã hoàn thành', value: stats.totalCompleted, suffix: 'lần', icon: <Check size={14} /> },
    { label: 'Tỉ lệ', value: `${stats.completionRate}%`, suffix: '', icon: <Star size={14} /> },
  ];

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-3">
          <IconTile icon={habit.icon} theme={habit.color_theme} />
          <span className="min-w-0">
            <span className="block truncate">{habit.title}</span>
            <span className="block text-[13px] font-normal tracking-normal text-zinc-500">{frequencyLabel(habit)}</span>
          </span>
        </span>
      }
      footer={
        <div className="flex items-center gap-2">
          <IconButton label="Xóa thói quen" onClick={() => { onClose(); onDelete(); }} className="text-red-700 hover:bg-red-50 hover:text-red-700">
            <Trash2 size={17} />
          </IconButton>
          <Button variant="secondary" onClick={onEdit}>
            <Pencil size={15} /> Sửa
          </Button>
          {checkable && (
            <Button variant={doneToday ? 'secondary' : 'primary'} onClick={onToggleToday} className="ml-auto">
              {doneToday ? <><X size={15} /> Bỏ đánh dấu</> : <><Check size={16} /> Xong hôm nay</>}
            </Button>
          )}
        </div>
      }
    >
      {habit.description && <p className="mb-4 text-[14px] text-zinc-600">{habit.description}</p>}

      <div className="grid grid-cols-2 gap-2">
        {statTiles.map(s => (
          <div key={s.label} className="rounded-2xl bg-zinc-50 p-3">
            <div className="flex items-center gap-1.5 text-[12px] text-zinc-500">
              <span className="text-zinc-400">{s.icon}</span>{s.label}
            </div>
            <div className="mt-1.5 text-[20px] font-semibold leading-none tracking-tight tabular-nums text-zinc-950">
              {s.value}{s.suffix && <span className="ml-1 text-[12px] font-normal text-zinc-500">{s.suffix}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold tracking-tight text-zinc-950">Lịch sử</h3>
          <div className="flex items-center gap-1">
            <IconButton label="Tháng trước" onClick={prevMonth}><ChevronLeft size={16} /></IconButton>
            <span className="w-24 text-center text-[13px] font-medium tabular-nums text-zinc-700">Tháng {month.month + 1}, {month.year}</span>
            <IconButton label="Tháng sau" onClick={nextMonth}><ChevronRight size={16} /></IconButton>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {ALL_DAYS.map(d => <div key={d} className="pb-1 text-[12px] font-medium text-zinc-400">{DAY_LABELS[d]}</div>)}
          {calendarGrid.map((d, i) => {
            if (!d) return <div key={`e${i}`} />;
            const dateStr = `${month.year}-${String(month.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const theDate = new Date(dateStr);
            const started = dateStr >= habit.start_date.slice(0, 10);
            const isScheduled = started && (periodic || habit.active_days.includes(getDayKey(theDate)));
            const done = logs.some(l => l.log_date === dateStr && l.completed);
            const isFuture = dateStr > todayStr;
            const isToday = dateStr === todayStr;

            let cls = 'text-zinc-300';
            if (done) cls = `${tint.solid} font-medium text-white`;
            else if (!isScheduled) cls = 'text-zinc-300';
            else if (isFuture) cls = 'border border-dashed border-zinc-200 text-zinc-400';
            else if (periodic) cls = 'text-zinc-500';
            else cls = 'bg-zinc-100 text-zinc-500';
            if (isToday && !done) cls += ' ring-1 ring-inset ring-sky-600 text-sky-700';

            return (
              <div key={dateStr} className="flex justify-center">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] tabular-nums ${cls}`}>{d}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-zinc-500">
          <span className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${tint.solid}`} /> Hoàn thành</span>
          {!periodic && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-zinc-200" /> Chưa làm</span>}
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-dashed border-zinc-300" /> Sắp tới</span>
        </div>
      </div>
    </Sheet>
  );
};

// ── Check-in Toast ──
// Replaces the old full-screen celebration: a quiet card at the bottom that says what was earned.
const CheckinToast: React.FC<{ result: CheckinReward; onClose: () => void; onOpenStars: () => void }> = ({ result, onClose, onOpenStars }) => {
  const notes = [
    result.milestone && `${result.milestone.label}`,
    result.levelUp && `Lên cấp ${result.level.name}`,
    result.isPerfectDay && 'Hoàn thành tất cả thói quen hôm nay',
    result.isComeback && 'Chào mừng bạn quay lại',
    result.luckyBonus && `Thưởng may mắn +${result.luckyBonus}`,
  ].filter(Boolean) as string[];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[9998] flex justify-center px-3 md:bottom-6" role="status" aria-live="polite">
      <div className="ui-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[20px] border border-zinc-900/[0.08] bg-white p-3.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.25)]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
          <Star size={18} className="fill-amber-400 text-amber-500" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] font-semibold tabular-nums text-zinc-950">+{result.totalStars} sao</span>
            <span className="text-[12px] tabular-nums text-zinc-500">Số dư {result.newBalance.toLocaleString()}</span>
          </div>
          {result.breakdown.length > 0 && (
            <p className="mt-0.5 text-[12px] text-zinc-500">
              {result.breakdown.map(b => `${b.label} ${b.amount > 0 ? '+' : ''}${b.amount}`).join(' · ')}
            </p>
          )}
          {notes.length > 0 && <p className="mt-1 text-[13px] font-medium text-zinc-800">{notes.join(' · ')}</p>}
          <button type="button" onClick={onOpenStars} className="mt-1.5 text-[13px] font-medium text-sky-700 hover:underline">
            Xem phần thưởng
          </button>
        </div>
        <IconButton label="Đóng" onClick={onClose} className="-mr-1 -mt-1 h-8 w-8">
          <X size={16} />
        </IconButton>
      </div>
    </div>
  );
};

export default HabitDashboard;
