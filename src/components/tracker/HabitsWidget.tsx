import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../services/supabase';
import { Habit, HabitLog, DayOfWeek } from '../../types';
import { Flame, Plus, CheckCircle, Circle, Loader2, Repeat } from 'lucide-react';
import { processCheckin, reverseCheckinStars } from '../../services/starBrainService';

interface HabitsWidgetProps {
  userId: string;
  onNavigateToHabits?: () => void;
}

const ALL_DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: Record<DayOfWeek, string> = { mon: 'T2', tue: 'T3', wed: 'T4', thu: 'T5', fri: 'T6', sat: 'T7', sun: 'CN' };

const COLOR_PRESETS = [
  { name: 'sunrise', bg: 'bg-gradient-to-br from-orange-400 to-rose-500', light: 'bg-orange-50 text-orange-600 border-orange-200' },
  { name: 'cosmic', bg: 'bg-gradient-to-br from-indigo-500 to-purple-600', light: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { name: 'nature', bg: 'bg-gradient-to-br from-emerald-400 to-teal-500', light: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { name: 'ocean', bg: 'bg-gradient-to-br from-blue-500 to-cyan-500', light: 'bg-blue-50 text-blue-700 border-blue-200' },
];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getDayKey = (d: Date): DayOfWeek => ALL_DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];

export const HabitsWidget: React.FC<HabitsWidgetProps> = ({ userId, onNavigateToHabits }) => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchHabitsData = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const [hRes, hlRes] = await Promise.all([
        supabase.from('habits').select('*').eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: true }),
        supabase.from('habit_logs').select('*,habits!inner(user_id)').eq('habits.user_id', userId).order('log_date', { ascending: false }),
      ]);
      
      if (hRes.data) {
        setHabits(hRes.data.map((h: any) => ({ ...h, active_days: h.active_days || ALL_DAYS })));
      }
      if (hlRes.data) {
        setLogs(hlRes.data);
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu thói quen:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHabitsData();
  }, [userId]);

  const todayDayKey = useMemo(() => getDayKey(new Date()), []);
  const todayStr = useMemo(() => today(), []);

  // Calculate dates of current week (Monday to Sunday)
  const weekDates = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    // Monday is index 0 of our weekDates array, Sunday is index 6.
    const diff = d.getDate() - (day === 0 ? 6 : day - 1);
    const startOfWeek = new Date(d.getFullYear(), d.getMonth(), diff);
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const temp = new Date(startOfWeek.getTime());
      temp.setDate(startOfWeek.getDate() + i);
      dates.push(`${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, '0')}-${String(temp.getDate()).padStart(2, '0')}`);
    }
    return dates;
  }, []);

  // Filter habits for today
  const todaysHabits = useMemo(() => {
    return habits.filter(
      (h) => h.frequency === 'weekly' || h.frequency === 'monthly' || h.active_days.includes(todayDayKey)
    );
  }, [habits, todayDayKey]);

  const todayCompletedCount = useMemo(() => {
    return todaysHabits.filter((h) => logs.some((l) => l.habit_id === h.id && l.log_date === todayStr && l.completed))
      .length;
  }, [todaysHabits, logs, todayStr]);

  const getHabitStreak = (habit: Habit) => {
    const habitLogs = logs.filter((l) => l.habit_id === habit.id);
    const completedLogs = habitLogs.filter((l) => l.completed);

    if (habit.frequency === 'weekly' || habit.frequency === 'monthly') {
      return completedLogs.length;
    }

    let currentStreak = 0;
    const d = new Date();
    const todayLog = habitLogs.find((l) => l.log_date === todayStr);
    const todayScheduled = habit.active_days.includes(getDayKey(d));

    if (todayScheduled && todayLog?.completed) {
      currentStreak = 1;
    }

    const cursor = new Date(d);
    cursor.setDate(cursor.getDate() - 1);
    while (true) {
      const ds = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(
        cursor.getDate()
      ).padStart(2, '0')}`;
      const dayKey = getDayKey(cursor);
      if (!habit.active_days.includes(dayKey)) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
      const log = habitLogs.find((l) => l.log_date === ds);
      if (log?.completed) {
        currentStreak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
      if (currentStreak > 1000) break;
    }
    return currentStreak;
  };

  const handleToggleCheckIn = async (habitId: string) => {
    const existing = logs.find((l) => l.habit_id === habitId && l.log_date === todayStr);
    let justCheckedIn = false;
    let targetLogId = '';

    if (existing) {
      const newVal = !existing.completed;
      justCheckedIn = newVal;
      setLogs((prev) => prev.map((l) => (l.id === existing.id ? { ...l, completed: newVal } : l)));
      await supabase.from('habit_logs').update({ completed: newVal }).eq('id', existing.id);
      targetLogId = existing.id;
    } else {
      justCheckedIn = true;
      const tempId = 'temp-' + Date.now();
      const optimistic: HabitLog = { id: tempId, habit_id: habitId, log_date: todayStr, completed: true };
      setLogs((prev) => [optimistic, ...prev]);
      
      const { data } = await supabase
        .from('habit_logs')
        .insert([{ habit_id: habitId, log_date: todayStr, completed: true }])
        .select()
        .single();
        
      if (data) {
        setLogs((prev) => prev.map((l) => (l.id === tempId ? data : l)));
        targetLogId = data.id;
      }
    }

    // Award / Reverse StarBrain points
    try {
      if (justCheckedIn) {
        const habit = habits.find((h) => h.id === habitId);
        if (!habit) return;
        const streak = getHabitStreak(habit);
        const allHabitsToday = todaysHabits.map((h) => ({
          id: h.id,
          done: h.id === habitId ? true : logs.some((l) => l.habit_id === h.id && l.log_date === todayStr && l.completed),
        }));

        await processCheckin({
          userId,
          habitId,
          streakDays: streak,
          allHabitsToday,
        });
      } else {
        await reverseCheckinStars(userId, habitId);
      }
    } catch (err) {
      console.warn('Lỗi StarBrain:', err);
    }
  };

  const handleQuickAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSaving(true);
    try {
      const randomEmojis = ['🏃‍♂️', '📚', '💧', '🍎', '🧘‍♀️', '🧠', '💤', '⏰', '🪴', '☕'];
      const randomColors = ['sunrise', 'cosmic', 'nature', 'ocean'];
      const emoji = randomEmojis[Math.floor(Math.random() * randomEmojis.length)];
      const color = randomColors[Math.floor(Math.random() * randomColors.length)];

      const newHabit = {
        user_id: userId,
        title: newTitle.trim(),
        icon: emoji,
        color_theme: color,
        frequency: 'daily',
        active_days: ALL_DAYS,
        start_date: todayStr,
        is_active: true,
      };

      const { data, error } = await supabase.from('habits').insert([newHabit]).select().single();
      if (error) throw error;

      if (data) {
        setHabits((prev) => [...prev, { ...data, active_days: data.active_days || ALL_DAYS }]);
      }
      setNewTitle('');
      setShowAddForm(false);
    } catch (err: any) {
      console.error('Lỗi thêm thói quen nhanh:', err);
      alert('Không thể tạo thói quen nhanh: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getThemeConfig = (theme: string) => {
    return COLOR_PRESETS.find((c) => c.name === theme) || COLOR_PRESETS[0];
  };

  return (
    <div className="bg-white rounded-[28px] border border-slate-100 p-2.5 flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex justify-between items-center mb-5 select-none">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
              <Repeat size={15} />
            </div>
            <h3 className="text-[15px] font-bold text-slate-800">
              Thói quen
            </h3>
          </div>
        </div>

        {/* Habits List */}
        <div className="space-y-4">
          {isLoading && habits.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-slate-400 text-xs gap-1.5">
              <Loader2 size={14} className="animate-spin text-slate-500" />
              Đang tải thói quen...
            </div>
          ) : habits.length > 0 ? (
            habits.slice(0, 5).map((h) => {
              const done = logs.some((l) => l.habit_id === h.id && l.log_date === todayStr && l.completed);
              const streak = getHabitStreak(h);
              
              return (
                <div
                  key={h.id}
                  className="flex items-center justify-between py-1 px-1 rounded-2xl group transition-all duration-150"
                >
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    {/* Checkbox button */}
                    <button
                      onClick={() => handleToggleCheckIn(h.id)}
                      className="p-0.5 rounded-full hover:bg-slate-100 transition-colors shrink-0 text-slate-300 hover:text-slate-550 cursor-pointer"
                    >
                      {done ? (
                        <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-white">
                          <CheckCircle size={12} className="stroke-[3.5]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border-[1.5px] border-slate-300 bg-white" />
                      )}
                    </button>

                    <span className="text-[12px] font-bold text-slate-800 truncate leading-snug">
                      {h.title}
                    </span>
                  </div>

                  {/* Progress Indicator Dots + Flame Streak */}
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    {/* 7 dots */}
                    <div className="flex gap-1 items-center">
                      {weekDates.map((dateStr, idx) => {
                        const isLogged = logs.some((l) => l.habit_id === h.id && l.log_date === dateStr && l.completed);
                        return (
                          <span
                            key={dateStr}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${
                              isLogged ? 'bg-slate-700' : 'bg-slate-200'
                            }`}
                            title={DAY_LABELS[ALL_DAYS[idx]]}
                          />
                        );
                      })}
                    </div>

                    {/* Streak badge */}
                    {streak > 0 && (
                      <span className="text-[10px] text-orange-500 font-extrabold flex items-center gap-1 select-none bg-orange-50 border border-orange-105 px-1.5 py-0.5 rounded-md">
                        <Flame size={10} className="fill-orange-550 text-orange-550" />
                        {streak}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-8 px-4 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
              Chưa thiết lập thói quen nào
            </div>
          )}
        </div>
      </div>

      {/* Simplified input row at bottom */}
      <form onSubmit={handleQuickAddHabit} className="relative mt-5 flex items-center bg-slate-50 hover:bg-slate-100/70 rounded-full p-1 pl-3.5 transition-all select-none">
        <input
          type="text"
          placeholder="Thêm thói quen mới..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="flex-1 bg-transparent text-xs outline-none text-slate-700 placeholder-slate-400 font-medium py-1.5"
          required
        />
        <button
          type="submit"
          disabled={isSaving || !newTitle.trim()}
          className="w-7 h-7 rounded-full bg-black hover:bg-slate-900 text-white flex items-center justify-center transition-all duration-200 active:scale-90 shrink-0 cursor-pointer"
        >
          {isSaving ? <Loader2 size={12} className="animate-spin text-white" /> : <Plus size={14} className="stroke-[3]" />}
        </button>
      </form>
    </div>
  );
};
