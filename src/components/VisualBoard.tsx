import React, { useMemo, useState, useEffect, useRef } from 'react';
import { AppState, Goal, Habit, CountdownItem, CountUpItem, HabitLog, JournalEntry, MoodLevel } from '../types';
import { calculateCumulativeGPA, calculateSemesterGPA, getAcademicStanding } from '../services/gpaCalculator';
import { ArrowDownRight, ArrowUpRight, Archive, Bot, BookOpen, Check, Crown, Download, Eye, EyeOff, FileText, Flame, GraduationCap, Loader2, LockKeyhole, Music, Plus, Wallet, X } from 'lucide-react';
import MyStorage from './MyStorage';
import { useProAccess } from '../hooks/useProAccess';
import { supabase } from '../services/supabase';
import html2canvas from 'html2canvas';
import { journalService } from '../services/journalService';
import { processJournalReward } from '../services/starBrainService';
import { getCachedCalendarEvents, syncGoogleCalendar, isGoogleCalendarConnected, CalendarEventLocal } from '../services/googleCalendarService';
import { getLocalDateStr, getEventLocalDateStr, getEventLocalTimeStr, getHolidayVietnameseNote } from './tracker/GoogleCalendarHub';
import { Card, CardHeader, EventRow, EventState, LinkButton, Metric, OverviewEvent, Progress, Segmented } from './overview/parts';
import { HabitIcon, isLucideIcon } from './habits/icons';

interface VisualBoardProps {
    appState: AppState;
    userName?: string;
    userId?: string;
    userEmail?: string;
    onNavigate?: (tab: string) => void;
    onUpgrade?: () => void;
    onOpenSpotify?: () => void;
    onUpdateGoal?: (goal: Goal) => void;
    onRefresh?: () => Promise<void>;
}

const MOODS: { value: MoodLevel; emoji: string; label: string }[] = [
    { value: 1, emoji: '😢', label: 'Rất tệ' },
    { value: 2, emoji: '😟', label: 'Không tốt' },
    { value: 3, emoji: '😐', label: 'Bình thường' },
    { value: 4, emoji: '😊', label: 'Tốt' },
    { value: 5, emoji: '🤩', label: 'Tuyệt vời' },
];

const PRIORITY_STYLE: Record<string, string> = {
    urgent: 'bg-red-50 text-red-700',
    focus: 'bg-amber-50 text-amber-800',
    high: 'bg-amber-50 text-amber-800',
};

const STORAGE_PERKS = [
    'Ghi chú rich text: in đậm, nghiêng, checkbox',
    'Lưu các liên kết quan trọng',
    'Tải lên tệp, ảnh, audio (10MB) và video (2MB)',
    'Riêng tư và bảo mật trên cloud',
];

// "HH:MM" -> minutes since midnight; null for "Cả ngày" or anything else.
const toMinutes = (t?: string) => {
    if (!t || !/^\d{1,2}:\d{2}/.test(t)) return null;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
};

const nowMinutes = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
};

const VisualBoard: React.FC<VisualBoardProps> = ({ appState, userName, userId, userEmail, onNavigate, onUpgrade, onOpenSpotify, onRefresh }) => {
    const [showAllHolidays, setShowAllHolidays] = useState(false);
    const [showStorage, setShowStorage] = useState(false);
    const [showStorageGate, setShowStorageGate] = useState(false);
    const [activeTodoStatusTab, setActiveTodoStatusTab] = useState<'backlog' | 'todo' | 'doing'>('todo');
    const [showFinanceBalance, setShowFinanceBalance] = useState(true);
    const [scheduleDay, setScheduleDay] = useState<'today' | 'tomorrow'>('today');
    const [nowMin, setNowMin] = useState(nowMinutes);
    const [googleEvents, setGoogleEvents] = useState<CalendarEventLocal[]>(() => getCachedCalendarEvents());

    // Sync Google Calendar for Visual Board
    useEffect(() => {
        const loadGCal = async () => {
            if (isGoogleCalendarConnected()) {
                try {
                    const res = await syncGoogleCalendar();
                    setGoogleEvents(res.events);
                } catch {
                    setGoogleEvents(getCachedCalendarEvents());
                }
            } else {
                setGoogleEvents(getCachedCalendarEvents());
            }
        };
        loadGCal();
        const handleAuth = () => loadGCal();
        window.addEventListener('google_auth_changed', handleAuth);
        return () => window.removeEventListener('google_auth_changed', handleAuth);
    }, []);

    // Keeps "now" / "next" markers on the timeline current.
    useEffect(() => {
        const id = setInterval(() => setNowMin(nowMinutes()), 60_000);
        return () => clearInterval(id);
    }, []);

    // Pull to Refresh state
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const startY = useRef(0);
    const isDragging = useRef(false);

    const handleTouchStart = (e: React.TouchEvent) => {
        const mainScroll = document.querySelector('main');
        const isAtTop = !mainScroll || mainScroll.scrollTop === 0;
        if (isAtTop && window.scrollY === 0) {
            startY.current = e.touches[0].clientY;
            isDragging.current = true;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging.current) return;
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY.current;

        if (diff > 0) {
            const offset = Math.min(diff * 0.4, 90);
            setPullDistance(offset);
            if (diff > 10 && e.cancelable) {
                e.preventDefault();
            }
        }
    };

    const handleTouchEnd = async () => {
        if (!isDragging.current) return;
        isDragging.current = false;

        if (pullDistance > 55 && onRefresh) {
            setIsRefreshing(true);
            setPullDistance(60);
            try {
                await onRefresh();
            } catch (err) {
                console.error("Refresh error:", err);
            } finally {
                setIsRefreshing(false);
                setPullDistance(0);
            }
        } else {
            setPullDistance(0);
        }
    };

    // Habit & Event States
    const [habits, setHabits] = useState<Habit[]>([]);
    const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
    const [countdowns, setCountdowns] = useState<CountdownItem[]>([]);
    const [countups, setCountups] = useState<CountUpItem[]>([]);
    const [careerGoals, setCareerGoals] = useState<any[]>([]);
    const [lifeGoals, setLifeGoals] = useState<any[]>([]);
    const [positions, setPositions] = useState<any[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(true);
    const shareRef = useRef<HTMLDivElement>(null);

    // Journal & Mood Widget States
    const [todayJournal, setTodayJournal] = useState<JournalEntry | null>(null);
    const [journalStreak, setJournalStreak] = useState<number>(0);
    const [isSavingMood, setIsSavingMood] = useState<boolean>(false);
    const [dashboardReward, setDashboardReward] = useState<number | null>(null);

    useEffect(() => {
        if (!userId) return;
        const fetchEvents = async () => {
            const [cdRes, cuRes, hRes, hlRes, cgRes, lgRes, cpRes] = await Promise.all([
                supabase.from('countdown_items').select('*').eq('user_id', userId).order('target_date', { ascending: true }),
                supabase.from('countup_items').select('*').eq('user_id', userId).order('start_date', { ascending: false }),
                supabase.from('habits').select('*').eq('user_id', userId).eq('is_active', true),
                supabase.from('habit_logs').select('*,habits!inner(user_id)').eq('habits.user_id', userId),
                supabase.from('career_goals').select('*').eq('user_id', userId),
                supabase.from('life_goals').select('*').eq('user_id', userId).order('sort_order', { ascending: true }),
                supabase.from('career_positions').select('*').eq('user_id', userId)
            ]);
            if (cdRes.data) setCountdowns(cdRes.data);
            if (cuRes.data) setCountups(cuRes.data);
            if (hRes.data) setHabits(hRes.data);
            if (hlRes.data) setHabitLogs(hlRes.data);
            if (cgRes.data) setCareerGoals(cgRes.data);
            if (lgRes.data) setLifeGoals(lgRes.data);
            if (cpRes.data) setPositions(cpRes.data);
            setLoadingEvents(false);
        };
        fetchEvents();

        const loadJournalData = async () => {
            const todayStr = new Date().toISOString().split('T')[0];
            const entry = await journalService.fetchEntryByDate(userId, todayStr);
            setTodayJournal(entry);

            const stats = await journalService.fetchStats(userId);
            setJournalStreak(stats.currentStreak);
        };
        loadJournalData();
    }, [userId]);

    const handleQuickMoodSelect = async (selectedMood: MoodLevel) => {
        if (!userId || isSavingMood) return;
        setIsSavingMood(true);
        const todayStr = new Date().toISOString().split('T')[0];

        const entryData = {
            entry_date: todayStr,
            content: todayJournal?.content || '',
            mood: selectedMood,
            gratitude: todayJournal?.gratitude || [],
            word_count: todayJournal?.word_count || 0,
            is_favorite: todayJournal?.is_favorite || false,
            writing_prompt: todayJournal?.writing_prompt || '',
            tags: todayJournal?.tags || []
        };

        const saved = await journalService.saveEntry(userId, entryData);
        if (saved) {
            setTodayJournal(saved);

            const reward = await processJournalReward({
                userId,
                wordCount: saved.word_count,
                hasMood: true,
                gratitudeCount: saved.gratitude.length
            });
            if (reward) {
                setDashboardReward(reward.totalStars);
                setTimeout(() => setDashboardReward(null), 4000);
            }

            const stats = await journalService.fetchStats(userId);
            setJournalStreak(stats.currentStreak);
        }
        setIsSavingMood(false);
    };

    const handleShare = async () => {
        if (!shareRef.current) return;
        try {
            const canvas = await html2canvas(shareRef.current, { background: '#ffffff', scale: 2 } as any);
            const image = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = image;
            link.download = 'my-habit-streak.png';
            link.click();
        } catch (err) {
            console.error('Error sharing image', err);
            alert('Không thể tạo ảnh chia sẻ lúc này.');
        }
    };

    // Helpers
    const today = () => {
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split('T')[0];
    };
    const getDayKey = (d: Date): any => ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][d.getDay() === 0 ? 6 : d.getDay() - 1];
    const diffDays = (d: string, isPast: boolean = false) => {
        const target = new Date(d); target.setHours(0, 0, 0, 0);
        const now = new Date(today()); now.setHours(0, 0, 0, 0);
        return isPast ? Math.floor((now.getTime() - target.getTime()) / (1000 * 3600 * 24)) : Math.ceil((target.getTime() - now.getTime()) / (1000 * 3600 * 24));
    };

    const getWeekKey = (d: Date) => { const t = new Date(d); t.setDate(t.getDate() - (t.getDay() === 0 ? 6 : t.getDay() - 1)); return t.toISOString().split('T')[0]; };
    const getMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const getHabitStats = (habit: Habit) => {
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
            return { currentStreak };
        }

        let currentStreak = 0;
        const d = new Date(today());
        const todayLog = logs.find(l => l.log_date === today());
        const todayScheduled = habit.active_days.includes(getDayKey(d));
        if (todayScheduled && todayLog?.completed) currentStreak = 1;

        const cursor = new Date(d); cursor.setDate(cursor.getDate() - 1);
        while (true) {
            const ds = cursor.toISOString().split('T')[0];
            const dayKey = getDayKey(cursor);
            if (!habit.active_days.includes(dayKey)) { cursor.setDate(cursor.getDate() - 1); continue; }
            const log = logs.find(l => l.log_date === ds);
            if (log?.completed) { currentStreak++; cursor.setDate(cursor.getDate() - 1); }
            else break;
            if (currentStreak > 1000) break;
        }
        return { currentStreak };
    };

    // Pro access check for My Storage
    const proAccess = useProAccess(appState.profile, userEmail);
    const canUseStorage = proAccess.isProActive || proAccess.isLifetime;

    const handleStorageClick = () => {
        if (canUseStorage) {
            setShowStorage(true);
        } else {
            setShowStorageGate(true);
        }
    };

    // derived data
    // 1. Finance: All-time stats
    const financeStats = useMemo(() => {
        let income = 0;
        let expense = 0;
        appState.transactions.forEach(t => {
            if (t.type === 'income') income += t.amount;
            else expense += t.amount;
        });
        return { income, expense, balance: income - expense };
    }, [appState.transactions]);

    // 1b. Finance: Monthly stats (income & expense of current month)
    const monthlyFinanceStats = useMemo(() => {
        const now = new Date();
        const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        let income = 0;
        let expense = 0;
        appState.transactions.forEach(t => {
            if (t.date && t.date.startsWith(currentYearMonth)) {
                if (t.type === 'income') income += t.amount;
                else expense += t.amount;
            }
        });
        return { income, expense };
    }, [appState.transactions]);

    // 2. Finance goals
    const financeGoals = useMemo(() =>
        appState.goals.filter(g => g.type === 'FINANCIAL' || (g.target_amount && g.target_amount > 0)),
        [appState.goals]);

    // 3. GPA
    const cumulativeGPA = useMemo(() => calculateCumulativeGPA(appState.gpaSemesters), [appState.gpaSemesters]);

    const previousSemesters = useMemo(() => {
        const semOrder = { HK1: 1, HK2: 2, HocHe: 3 };
        return [...appState.gpaSemesters].sort((a, b) => {
            if (a.year_of_study !== b.year_of_study) {
                return a.year_of_study - b.year_of_study;
            }
            return (semOrder[a.semester_type as keyof typeof semOrder] || 99) - (semOrder[b.semester_type as keyof typeof semOrder] || 99);
        });
    }, [appState.gpaSemesters]);

    const latestSemester = useMemo(() => {
        const sem = previousSemesters[previousSemesters.length - 1];
        if (!sem) return null;
        const gpa = calculateSemesterGPA(sem.courses);
        return { name: sem.name, gpa, standing: getAcademicStanding(gpa) };
    }, [previousSemesters]);

    // 4. Todos
    const filteredTodos = useMemo(() => {
        return appState.todos.filter(t => {
            if (t.is_completed || t.status === 'done') return false;
            const status = t.status || 'todo';
            return status === activeTodoStatusTab;
        });
    }, [appState.todos, activeTodoStatusTab]);

    const openTodoCount = useMemo(
        () => appState.todos.filter(t => !t.is_completed && t.status !== 'done' && (t.status || 'todo') !== 'backlog').length,
        [appState.todos]
    );

    // 5. Today & Tomorrow schedule (timetable calendar events + Google Calendar)
    const scheduleData = useMemo(() => {
        const today = new Date();
        const currentDay = today.getDay(); // 0-6 (0=Sun, 1=Mon, ..., 6=Sat)

        const todayTimetableDay = currentDay;
        const tomorrowTimetableDay = (currentDay + 1) % 7;

        const todayStr = getLocalDateStr(today);
        const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        const tomorrowStr = getLocalDateStr(tomorrow);

        const calendarEvents = (appState as any).calendarEvents || [];
        const todayCalendarEvents = calendarEvents.filter((e: any) => e.date === todayStr);
        const tomorrowCalendarEvents = calendarEvents.filter((e: any) => e.date === tomorrowStr);

        const todayGCalEvents = googleEvents.filter(e => {
            const s = getEventLocalDateStr(e.startTime);
            const en = getEventLocalDateStr(e.endTime);
            return s <= todayStr && en >= todayStr;
        });

        const tomorrowGCalEvents = googleEvents.filter(e => {
            const s = getEventLocalDateStr(e.startTime);
            const en = getEventLocalDateStr(e.endTime);
            return s <= tomorrowStr && en >= tomorrowStr;
        });

        const mapCalendarEvent = (e: any): OverviewEvent => ({
            id: e.id,
            title: e.title,
            start_time: e.time ? e.time.slice(0, 5) : '00:00',
            end_time: undefined,
            location: e.location,
            isCalendarEvent: true,
            isGoogleEvent: false,
            holidayNote: getHolidayVietnameseNote(e.title),
            email_notify: e.email_notify,
            email_notify_before_minutes: e.email_notify_before_minutes
        });

        const mapGCalEvent = (e: CalendarEventLocal): OverviewEvent => ({
            id: e.id,
            title: e.title,
            start_time: e.isAllDay ? 'Cả ngày' : getEventLocalTimeStr(e.startTime),
            end_time: e.isAllDay ? undefined : getEventLocalTimeStr(e.endTime),
            location: e.location,
            isCalendarEvent: true,
            isGoogleEvent: true,
            holidayNote: getHolidayVietnameseNote(e.title),
            email_notify: false,
            email_notify_before_minutes: 0
        });

        const getEventsForDay = (dayCalendarEvents: any[], dayGCalEvents: CalendarEventLocal[]) => {
            const mappedCalendar = dayCalendarEvents.map(mapCalendarEvent);
            const mappedGCal = dayGCalEvents.map(mapGCalEvent);

            // Deduplicate
            const seen = new Set<string>();
            const list: OverviewEvent[] = [];
            [...mappedGCal, ...mappedCalendar].forEach(item => {
                const key = `${item.title.trim().toLowerCase()}_${item.start_time}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    list.push(item);
                }
            });

            return list.sort((a, b) => a.start_time.localeCompare(b.start_time));
        };

        const getDayLabel = (d: number) => d === 0 ? "Chủ Nhật" : `Thứ ${d + 1}`;

        return {
            today: getEventsForDay(todayCalendarEvents, todayGCalEvents),
            tomorrow: getEventsForDay(tomorrowCalendarEvents, tomorrowGCalEvents),
            todayLabel: getDayLabel(todayTimetableDay),
            tomorrowLabel: getDayLabel(tomorrowTimetableDay)
        };
    }, [(appState as any).calendarEvents, googleEvents]);

    // Marks each of today's events as past / happening now / next up.
    const todayTimeline = useMemo(() => {
        let nextAssigned = false;
        return scheduleData.today.map(ev => {
            const start = toMinutes(ev.start_time);
            const end = toMinutes(ev.end_time) ?? (start != null ? start + 60 : null);
            let state: EventState = 'later';
            if (start == null) state = 'allday';
            else if (end != null && end <= nowMin) state = 'past';
            else if (start <= nowMin) state = 'now';
            else if (!nextAssigned) {
                state = 'next';
                nextAssigned = true;
            }
            return { ...ev, state, minutesUntil: start != null ? start - nowMin : null };
        });
    }, [scheduleData.today, nowMin]);

    const visibleEvents = scheduleDay === 'today' ? todayTimeline : scheduleData.tomorrow;

    // 6. Habits due today and whether they are done
    const habitsToday = useMemo(() => {
        const todayStr = today();
        const dayKey = getDayKey(new Date(todayStr));
        return habits
            .filter(h => h.frequency === 'weekly' || h.frequency === 'monthly' || h.active_days?.includes(dayKey))
            .map(h => ({
                habit: h,
                done: habitLogs.some(l => l.habit_id === h.id && l.log_date === todayStr && l.completed),
                streak: getHabitStats(h).currentStreak
            }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [habits, habitLogs]);

    const habitsLeft = habitsToday.filter(h => !h.done).length;
    const bestHabitStreak = habitsToday.reduce((max, h) => Math.max(max, h.streak), 0);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
    };
    const masked = (val: number) => (showFinanceBalance ? formatCurrency(val) : '••••••');

    // 7. Vietnamese holidays
    const holidays = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const fixedHolidays = [
            { name: 'Tết Dương Lịch', day: 1, month: 1 },
            { name: 'Valentine', day: 14, month: 2 },
            { name: 'Quốc tế Phụ nữ', day: 8, month: 3 },
            { name: 'Giải phóng miền Nam', day: 30, month: 4 },
            { name: 'Quốc tế Lao động', day: 1, month: 5 },
            { name: 'Quốc tế Thiếu nhi', day: 1, month: 6 },
            { name: 'Quốc khánh', day: 2, month: 9 },
            { name: 'Phụ nữ Việt Nam', day: 20, month: 10 },
            { name: 'Halloween', day: 31, month: 10 },
            { name: 'Nhà giáo Việt Nam', day: 20, month: 11 },
            { name: 'Giáng sinh', day: 25, month: 12 },
        ];

        // Lunar / variable holidays
        const dynamicHolidays = [
            { name: 'Tết Nguyên Đán', date: '2025-01-29' },
            { name: 'Giỗ tổ Hùng Vương', date: '2025-04-07' },
            { name: 'Tết Nguyên Đán', date: '2026-02-17' },
            { name: 'Giỗ tổ Hùng Vương', date: '2026-04-26' },
        ];

        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const results: { name: string; day: number; month: number; dateObj: Date }[] = [];

        fixedHolidays.forEach(h => {
            let date = new Date(currentYear, h.month - 1, h.day);
            if (date.getTime() < todayDate.getTime()) date = new Date(currentYear + 1, h.month - 1, h.day);
            results.push({ ...h, dateObj: date });
        });

        dynamicHolidays.forEach(h => {
            const date = new Date(h.date);
            if (date.getTime() >= todayDate.getTime()) {
                results.push({ name: h.name, day: date.getDate(), month: date.getMonth() + 1, dateObj: date });
            }
        });

        return results
            .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
            .map(h => ({ ...h, daysLeft: Math.ceil(Math.abs(h.dateObj.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)) }));
    }, []);

    const visibleHolidays = showAllHolidays ? holidays : holidays.slice(0, 3);

    // Countdowns + holidays ahead, sorted by days left; countups after them.
    const upcoming = useMemo(() => {
        const ahead = [
            ...countdowns.slice(0, 3).map(c => ({
                key: `cd-${c.id}`,
                lead: c.icon,
                title: c.title,
                date: new Date(c.target_date).toLocaleDateString('vi-VN'),
                days: Math.max(0, diffDays(c.target_date)),
                tag: 'Đếm ngược'
            })),
            ...visibleHolidays.map(h => ({
                key: `hd-${h.name}-${h.month}`,
                lead: `${h.day}/${h.month}`,
                title: h.name,
                date: 'Ngày lễ',
                days: h.daysLeft,
                tag: ''
            }))
        ].sort((a, b) => a.days - b.days);
        const since = countups.slice(0, 3).map(c => ({
            key: `cu-${c.id}`,
            lead: c.icon,
            title: c.title,
            date: `Từ ${new Date(c.start_date).toLocaleDateString('vi-VN')}`,
            days: Math.max(0, diffDays(c.start_date, true))
        }));
        return { ahead, since };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [countdowns, countups, visibleHolidays]);

    const careerSummary = useMemo(() => {
        const pos = positions[0];
        if (!pos) return null;
        const posGoals = careerGoals.filter(g => g.position_id === pos.id);
        const completed = posGoals.filter(g => g.status === 'completed' || g.progress === 100).length;
        const progress = posGoals.length > 0 ? Math.round(posGoals.reduce((acc, g) => acc + (g.progress || 0), 0) / posGoals.length) : 0;
        return { title: pos.title as string, completed, total: posGoals.length, progress, skills: posGoals.slice(0, 3) };
    }, [positions, careerGoals]);

    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 11 ? 'Chào buổi sáng' : hour < 14 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
    const firstName = (userName || '').trim().split(/\s+/).pop() || 'bạn';
    const currentMood = MOODS.find(m => m.value === todayJournal?.mood);

    const quickActions = [
        { label: 'Học tập trung', icon: <BookOpen size={16} />, onClick: () => onNavigate?.('music') },
        { label: 'Cố vấn AI', icon: <Bot size={16} />, onClick: () => onNavigate?.('gpa-career') },
        { label: 'Tạo CV', icon: <FileText size={16} />, onClick: () => onNavigate?.('goals-cv') },
        { label: 'Spotify', icon: <Music size={16} />, onClick: () => onOpenSpotify?.() },
        { label: 'My Storage', icon: <Archive size={16} />, onClick: handleStorageClick, pro: !canUseStorage },
    ];

    return (
        <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="overview ui-zinc relative min-h-screen w-full overflow-x-hidden px-3 pt-4 text-zinc-900 md:px-8 md:pt-8"
        >
            {/* Pull to Refresh Spinner */}
            <div
                className="pointer-events-none absolute left-0 right-0 z-[100] flex justify-center transition-all duration-200"
                style={{
                    top: `${pullDistance - 40}px`,
                    opacity: pullDistance > 10 ? Math.min(pullDistance / 50, 1) : 0
                }}
            >
                <div className="flex items-center justify-center rounded-full border border-zinc-900/[0.08] bg-white p-2.5 shadow-sm">
                    <Loader2
                        className={`text-sky-600 ${isRefreshing ? 'animate-spin' : ''}`}
                        size={20}
                        style={{ transform: `rotate(${pullDistance * 4}deg)` }}
                    />
                </div>
            </div>

            {/* My Storage Modal — Pro users only */}
            <MyStorage isOpen={showStorage} onClose={() => setShowStorage(false)} userId={userId || ''} />

            {/* My Storage Pro Gate Modal */}
            {showStorageGate && (
                <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-zinc-950/50 backdrop-blur-sm" onClick={() => setShowStorageGate(false)} />
                    <div role="dialog" aria-modal="true" aria-labelledby="storage-gate-title" className="relative w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <button
                            type="button"
                            onClick={() => setShowStorageGate(false)}
                            className="absolute right-4 top-4 rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                            aria-label="Đóng"
                        >
                            <X size={18} />
                        </button>
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                            <LockKeyhole size={22} />
                        </div>
                        <h3 id="storage-gate-title" className="mt-5 text-[20px] font-semibold tracking-tight text-zinc-950">My Storage là tính năng Pro</h3>
                        <p className="mt-2 text-[14px] leading-6 text-zinc-600">
                            Kho lưu trữ riêng tư cho ghi chú, liên kết, tệp, hình ảnh, âm thanh và video.
                        </p>
                        <ul className="mt-5 space-y-2.5">
                            {STORAGE_PERKS.map(text => (
                                <li key={text} className="flex items-start gap-2.5 text-[14px] text-zinc-700">
                                    <Check size={16} className="mt-0.5 shrink-0 text-sky-600" />
                                    {text}
                                </li>
                            ))}
                        </ul>
                        <button
                            type="button"
                            onClick={() => { setShowStorageGate(false); onUpgrade?.(); }}
                            className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-zinc-950 text-[14px] font-medium text-white transition-colors hover:bg-zinc-800"
                        >
                            <Crown size={16} />
                            Nâng cấp Pro
                        </button>
                        {proAccess.isTrialActive && (
                            <p className="mt-3 text-center text-[12px] text-zinc-500">
                                Bạn đang dùng thử, còn {proAccess.daysRemaining} ngày. My Storage chỉ có trong gói Pro.
                            </p>
                        )}
                    </div>
                </div>
            )}

            <div className="mx-auto max-w-6xl space-y-3 md:space-y-4">
                {/* 1. Header */}
                <header className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                        <div className="text-[13px] font-medium capitalize text-zinc-500">
                            {now.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                        <h1 className="mt-1 truncate text-[26px] font-semibold tracking-tight text-zinc-950 md:text-[32px]">
                            {greeting}, {firstName}
                        </h1>
                        <p className="mt-1 text-[14px] text-zinc-500">
                            Hôm nay có <b className="font-medium text-zinc-900">{scheduleData.today.length} lịch</b>,{' '}
                            <b className="font-medium text-zinc-900">{openTodoCount} việc cần làm</b>
                            {habitsToday.length > 0 && (
                                <> và <b className="font-medium text-zinc-900">{habitsLeft} thói quen</b> chưa xong</>
                            )}
                            .
                        </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                        <button
                            type="button"
                            onClick={() => onNavigate?.('schedule')}
                            className="flex h-10 items-center gap-1.5 rounded-full border border-zinc-900/[0.1] bg-white px-4 text-[14px] font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
                        >
                            <Plus size={16} /> Thêm việc
                        </button>
                        <button
                            type="button"
                            onClick={() => onNavigate?.('ai-advisor')}
                            className="flex h-10 items-center gap-1.5 rounded-full bg-zinc-950 px-4 text-[14px] font-medium text-white transition-colors hover:bg-zinc-800"
                        >
                            <Bot size={16} /> Hỏi AI
                        </button>
                    </div>
                </header>

                {dashboardReward && (
                    <div role="status" className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-900 animate-in fade-in slide-in-from-top-1 duration-300">
                        <span aria-hidden>⭐</span> Bạn nhận được <b className="font-semibold">+{dashboardReward} sao</b> vì đã ghi lại tâm trạng hôm nay.
                    </div>
                )}

                {/* 2. Schedule + Todos */}
                <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-[1.6fr_1fr]">
                    <Card className="flex flex-col">
                        <CardHeader
                            title={scheduleDay === 'today' ? `Hôm nay · ${scheduleData.todayLabel}` : `Ngày mai · ${scheduleData.tomorrowLabel}`}
                            meta={visibleEvents.length}
                            action={
                                <div className="flex items-center gap-1">
                                    <Segmented<typeof scheduleDay>
                                        label="Chọn ngày"
                                        value={scheduleDay}
                                        onChange={setScheduleDay}
                                        options={[{ id: 'today', label: 'Hôm nay' }, { id: 'tomorrow', label: 'Ngày mai' }]}
                                    />
                                </div>
                            }
                        />
                        <div className="flex-1 px-3 pb-2 pt-2 sm:px-4">
                            {visibleEvents.length > 0 ? (
                                <ol className="max-h-[360px] overflow-y-auto pr-1">
                                    {visibleEvents.map((ev, idx) => (
                                        <EventRow key={`${ev.id}-${idx}`} ev={ev} last={idx === visibleEvents.length - 1} />
                                    ))}
                                </ol>
                            ) : (
                                <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-1 text-center">
                                    <p className="text-[14px] font-medium text-zinc-700">{scheduleDay === 'today' ? 'Hôm nay trống lịch' : 'Ngày mai chưa có lịch'}</p>
                                    <p className="text-[13px] text-zinc-500">Tận hưởng thời gian rảnh nhé.</p>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end border-t border-zinc-900/[0.06] px-3 py-2">
                            <LinkButton onClick={() => onNavigate?.('schedule')}>Mở lịch trình</LinkButton>
                        </div>
                    </Card>

                    <Card className="flex flex-col">
                        <CardHeader
                            title="Việc cần làm"
                            meta={filteredTodos.length}
                            action={
                                <Segmented<typeof activeTodoStatusTab>
                                    label="Trạng thái việc"
                                    value={activeTodoStatusTab}
                                    onChange={setActiveTodoStatusTab}
                                    options={[{ id: 'backlog', label: 'Backlog' }, { id: 'todo', label: 'Todo' }, { id: 'doing', label: 'Doing' }]}
                                />
                            }
                        />
                        <div className="flex-1 px-2 pb-2 pt-2">
                            {filteredTodos.length > 0 ? (
                                <ul className="max-h-[360px] overflow-y-auto">
                                    {filteredTodos.map(todo => (
                                        <li key={todo.id}>
                                            <button
                                                type="button"
                                                onClick={() => onNavigate?.('schedule')}
                                                className="flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-zinc-50"
                                            >
                                                <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-[1.5px] ${activeTodoStatusTab === 'doing' ? 'border-sky-600' : 'border-zinc-300'}`} aria-hidden />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block break-words text-[14px] leading-snug text-zinc-900">{todo.content}</span>
                                                    {todo.description && <span className="mt-0.5 block break-words text-[12px] leading-5 text-zinc-500">{todo.description}</span>}
                                                </span>
                                                {todo.priority && todo.priority !== 'medium' && (
                                                    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium capitalize ${PRIORITY_STYLE[todo.priority] || 'bg-zinc-100 text-zinc-600'}`}>
                                                        {todo.priority}
                                                    </span>
                                                )}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-1 text-center">
                                    <p className="text-[14px] font-medium text-zinc-700">Không có việc nào ở đây</p>
                                    <p className="text-[13px] text-zinc-500">Danh sách này đang trống.</p>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end border-t border-zinc-900/[0.06] px-3 py-2">
                            <LinkButton onClick={() => onNavigate?.('schedule')}>Mở Kanban</LinkButton>
                        </div>
                    </Card>
                </div>

                {/* 3. Metrics */}
                <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
                    <Metric
                        label="Số dư"
                        icon={<Wallet size={14} />}
                        value={masked(financeStats.balance)}
                        sub={<span className="inline-flex items-center gap-0.5 text-emerald-700"><ArrowUpRight size={12} />Thu tháng {masked(monthlyFinanceStats.income)}</span>}
                        onClick={() => onNavigate?.('finance')}
                        action={
                            <button
                                type="button"
                                onClick={() => setShowFinanceBalance(!showFinanceBalance)}
                                className="rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                                aria-label={showFinanceBalance ? 'Ẩn số dư' : 'Hiện số dư'}
                                title={showFinanceBalance ? 'Ẩn số dư' : 'Hiện số dư'}
                            >
                                {showFinanceBalance ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        }
                    />
                    <Metric
                        label="Chi tháng này"
                        icon={<ArrowDownRight size={14} />}
                        value={masked(monthlyFinanceStats.expense)}
                        sub={financeGoals.length > 0 ? `${financeGoals.length} mục tiêu tiết kiệm` : 'Xem chi tiết thu chi'}
                        onClick={() => onNavigate?.('finance')}
                    />
                    <Metric
                        label="Streak nhật ký"
                        icon={<Flame size={14} />}
                        value={<>{journalStreak} <span className="text-[14px] font-normal text-zinc-500">ngày</span></>}
                        sub={bestHabitStreak > 0 ? `Thói quen dài nhất ${bestHabitStreak}` : 'Viết mỗi ngày để giữ chuỗi'}
                        onClick={() => onNavigate?.('journal')}
                    />
                    <Metric
                        label="GPA tích lũy"
                        icon={<GraduationCap size={14} />}
                        value={<>{cumulativeGPA != null ? cumulativeGPA.toFixed(2) : '0.00'} <span className="text-[14px] font-normal text-zinc-500">/ 4</span></>}
                        sub={latestSemester ? `${latestSemester.name}: ${latestSemester.gpa != null ? latestSemester.gpa.toFixed(2) : '—'}${latestSemester.standing ? ` · ${latestSemester.standing}` : ''}` : 'Chưa có học kỳ nào'}
                        onClick={() => onNavigate?.('gpa')}
                    />
                </div>

                {/* 4. Check-in: mood + today's habits */}
                <Card className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
                    <div className="p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="text-[15px] font-semibold tracking-tight text-zinc-950">Hôm nay bạn thấy thế nào?</h2>
                            <LinkButton onClick={() => onNavigate?.('journal')}>Nhật ký</LinkButton>
                        </div>
                        <div className="mt-3 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Tâm trạng hôm nay">
                            {MOODS.map(m => {
                                const selected = currentMood?.value === m.value;
                                return (
                                    <button
                                        key={m.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        disabled={isSavingMood || (!!currentMood && !selected)}
                                        onClick={() => !currentMood && handleQuickMoodSelect(m.value)}
                                        title={m.label}
                                        className={`flex aspect-square max-h-14 w-full items-center justify-center rounded-2xl border text-[22px] transition-all ${selected
                                            ? 'border-sky-600 bg-sky-50'
                                            : currentMood
                                                ? 'border-transparent bg-zinc-50 opacity-40'
                                                : 'border-zinc-900/[0.06] bg-zinc-50 hover:-translate-y-0.5 hover:bg-white hover:border-zinc-900/[0.14]'
                                            } disabled:cursor-default`}
                                    >
                                        <span aria-hidden>{m.emoji}</span>
                                        <span className="sr-only">{m.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="mt-2.5 text-[13px] text-zinc-500">
                            {isSavingMood ? 'Đang lưu…' : currentMood ? <>Đã ghi nhận: <span className="font-medium text-zinc-800">{currentMood.label}</span></> : 'Chạm một biểu tượng để ghi nhanh.'}
                        </p>
                    </div>

                    <div ref={shareRef} className="border-t border-zinc-900/[0.06] bg-white p-4 sm:p-5 md:border-l md:border-t-0">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="text-[15px] font-semibold tracking-tight text-zinc-950">
                                Thói quen hôm nay
                                {habitsToday.length > 0 && <span className="ml-2 text-[13px] font-normal tabular-nums text-zinc-400">{habitsToday.length - habitsLeft}/{habitsToday.length}</span>}
                            </h2>
                            <div className="flex items-center">
                                {habitsToday.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleShare}
                                        className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
                                        title="Tải ảnh streak"
                                        aria-label="Tải ảnh streak"
                                    >
                                        <Download size={15} />
                                    </button>
                                )}
                                <LinkButton onClick={() => onNavigate?.('habit')}>Tất cả</LinkButton>
                            </div>
                        </div>
                        {loadingEvents ? (
                            <div className="mt-3 flex gap-2" aria-hidden>
                                {[0, 1, 2].map(i => <div key={i} className="h-10 w-32 animate-pulse rounded-full bg-zinc-100" />)}
                            </div>
                        ) : habitsToday.length > 0 ? (
                            <ul className="mt-3 flex flex-wrap gap-2">
                                {habitsToday.map(({ habit, done, streak }) => (
                                    <li key={habit.id}>
                                        <button
                                            type="button"
                                            onClick={() => onNavigate?.('habit')}
                                            className={`flex h-10 max-w-[220px] items-center gap-2 rounded-full border pl-1.5 pr-3 text-[13px] transition-colors ${done ? 'border-sky-600/20 bg-sky-50 text-sky-900' : 'border-zinc-900/[0.08] bg-white text-zinc-800 hover:border-zinc-900/[0.16]'}`}
                                        >
                                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${done ? 'bg-sky-600 text-white' : 'bg-zinc-100'}`}>
                                                {done ? <Check size={14} strokeWidth={3} /> : <HabitIcon icon={habit.icon} size={14} className="text-zinc-600" />}
                                            </span>
                                            <span className="truncate font-medium">{habit.title}</span>
                                            {streak > 0 && (
                                                <span className="inline-flex shrink-0 items-center gap-0.5 tabular-nums text-zinc-500">
                                                    <Flame size={12} className="text-orange-500" />{streak}
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-3 text-[13px] text-zinc-500">
                                {habits.length > 0 ? 'Hôm nay không có thói quen nào theo lịch.' : 'Chưa có thói quen nào. Tạo một thói quen nhỏ để bắt đầu chuỗi.'}
                            </p>
                        )}
                    </div>
                </Card>

                {/* 5. Upcoming + Goals */}
                <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
                    <Card>
                        <CardHeader
                            title="Sắp tới"
                            action={
                                <button
                                    type="button"
                                    onClick={() => setShowAllHolidays(!showAllHolidays)}
                                    className="rounded-full px-2 py-1 text-[13px] font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                                >
                                    {showAllHolidays ? 'Thu gọn' : 'Thêm ngày lễ'}
                                </button>
                            }
                        />
                        <ul className="px-4 pb-3 pt-2 sm:px-5">
                            {upcoming.ahead.map(item => (
                                <li key={item.key} className="flex items-center gap-3 border-b border-zinc-900/[0.06] py-2.5 last:border-b-0">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-50 text-[12px] font-medium tabular-nums text-zinc-600">
                                        {isLucideIcon(item.lead) ? (
                                            <HabitIcon icon={item.lead} size={17} />
                                        ) : (
                                            <span className={item.lead.length > 2 && /\d/.test(item.lead) ? '' : 'text-[18px]'}>{item.lead}</span>
                                        )}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[14px] font-medium text-zinc-900">{item.title}</span>
                                        <span className="block text-[12px] text-zinc-500">{item.tag ? `${item.tag} · ${item.date}` : item.date}</span>
                                    </span>
                                    <span className="shrink-0 text-right tabular-nums">
                                        <span className={`text-[15px] font-semibold ${item.days <= 7 ? 'text-sky-700' : 'text-zinc-900'}`}>{item.days === 0 ? 'Hôm nay' : item.days}</span>
                                        {item.days > 0 && <span className="ml-1 text-[12px] text-zinc-500">ngày</span>}
                                    </span>
                                </li>
                            ))}
                            {upcoming.since.length > 0 && (
                                <li className="pb-1 pt-4 text-[12px] font-medium text-zinc-400">Đã đồng hành</li>
                            )}
                            {upcoming.since.map(item => (
                                <li key={item.key} className="flex items-center gap-3 border-b border-zinc-900/[0.06] py-2.5 last:border-b-0">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-50 text-zinc-600"><HabitIcon icon={item.lead} size={17} /></span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[14px] font-medium text-zinc-900">{item.title}</span>
                                        <span className="block text-[12px] text-zinc-500">{item.date}</span>
                                    </span>
                                    <span className="shrink-0 tabular-nums">
                                        <span className="text-[15px] font-semibold text-zinc-900">{item.days}</span>
                                        <span className="ml-1 text-[12px] text-zinc-500">ngày</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </Card>

                    <Card>
                        <CardHeader title="Mục tiêu" action={<LinkButton onClick={() => onNavigate?.('goals')}>Chi tiết</LinkButton>} />
                        <div className="space-y-5 px-4 pb-5 pt-3 sm:px-5">
                            {/* Career */}
                            <div>
                                <div className="text-[12px] font-medium text-zinc-400">Sự nghiệp</div>
                                {careerSummary ? (
                                    <button type="button" onClick={() => onNavigate?.('goals')} className="mt-2 block w-full text-left">
                                        <div className="flex items-baseline justify-between gap-3">
                                            <span className="truncate text-[14px] font-medium text-zinc-900">{careerSummary.title}</span>
                                            <span className="shrink-0 text-[12px] tabular-nums text-zinc-500">
                                                {careerSummary.completed}/{careerSummary.total} kỹ năng · <span className="font-medium text-zinc-900">{careerSummary.progress}%</span>
                                            </span>
                                        </div>
                                        <div className="mt-2"><Progress value={careerSummary.progress} /></div>
                                        {careerSummary.skills.length > 0 && (
                                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                                                {careerSummary.skills.map(g => (
                                                    <span key={g.id} className="inline-flex items-center gap-1 rounded-md bg-zinc-50 px-2 py-0.5 text-[12px] text-zinc-600">
                                                        <span className={`h-1.5 w-1.5 rounded-full ${g.status === 'completed' ? 'bg-emerald-500' : g.progress > 0 ? 'bg-sky-500' : 'bg-zinc-300'}`} />
                                                        {g.title}{g.progress > 0 && g.status !== 'completed' ? ` ${g.progress}%` : ''}
                                                    </span>
                                                ))}
                                                {careerSummary.total > 3 && <span className="px-1 py-0.5 text-[12px] text-zinc-400">+{careerSummary.total - 3}</span>}
                                            </div>
                                        )}
                                    </button>
                                ) : (
                                    <p className="mt-2 text-[13px] text-zinc-500">Chưa đặt vị trí mục tiêu.</p>
                                )}
                            </div>

                            {/* Finance goals */}
                            <div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[12px] font-medium text-zinc-400">Tài chính</span>
                                    {financeGoals.length > 3 && <button type="button" onClick={() => onNavigate?.('finance')} className="text-[12px] text-zinc-500 hover:text-zinc-900">+{financeGoals.length - 3} mục tiêu</button>}
                                </div>
                                {financeGoals.length > 0 ? (
                                    <ul className="mt-2 space-y-3">
                                        {financeGoals.slice(0, 3).map(goal => {
                                            const percent = goal.target_amount ? Math.min(100, Math.round(((goal.current_amount || 0) / goal.target_amount) * 100)) : 0;
                                            return (
                                                <li key={goal.id}>
                                                    <button type="button" onClick={() => onNavigate?.('finance')} className="block w-full text-left">
                                                        <div className="flex items-baseline justify-between gap-3">
                                                            <span className="truncate text-[14px] text-zinc-900">{goal.title}</span>
                                                            <span className="shrink-0 text-[12px] font-medium tabular-nums text-zinc-900">{percent}%</span>
                                                        </div>
                                                        <div className="mt-1.5"><Progress value={percent} /></div>
                                                        <div className="mt-1 text-[12px] tabular-nums text-zinc-500">
                                                            {formatCurrency(goal.current_amount || 0)} / {formatCurrency(goal.target_amount || 0)}
                                                        </div>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <p className="mt-2 text-[13px] text-zinc-500">Chưa có mục tiêu tài chính.</p>
                                )}
                            </div>

                            {/* 5-year goals */}
                            {lifeGoals.length > 0 && (
                                <div>
                                    <div className="text-[12px] font-medium text-zinc-400">Mục tiêu 5 năm</div>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {lifeGoals.slice(0, 4).map(goal => (
                                            <button
                                                key={goal.id}
                                                type="button"
                                                onClick={() => onNavigate?.('goals')}
                                                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-zinc-900/[0.08] px-2.5 py-1 text-[12px] transition-colors hover:border-zinc-900/[0.16]"
                                            >
                                                <span>{goal.icon}</span>
                                                <span className={`truncate ${goal.is_achieved ? 'text-zinc-400 line-through' : 'text-zinc-800'}`}>{goal.title}</span>
                                                <span className="tabular-nums text-zinc-400">{goal.target_year}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* 6. Quick actions */}
                <nav aria-label="Lối tắt" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {quickActions.map(a => (
                        <button
                            key={a.label}
                            type="button"
                            onClick={a.onClick}
                            className="group flex h-12 items-center gap-2.5 rounded-2xl border border-zinc-900/[0.08] bg-white px-3.5 text-[14px] font-medium text-zinc-800 transition-colors hover:border-zinc-900/[0.18] hover:text-zinc-950"
                        >
                            <span className="text-zinc-400 transition-colors group-hover:text-sky-600">{a.icon}</span>
                            <span className="truncate">{a.label}</span>
                            {a.pro && <Crown size={13} className="ml-auto shrink-0 text-amber-500" aria-label="Pro" />}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Safe space at the bottom for mobile to prevent navbar cover */}
            <div className="md:hidden" style={{ height: 'calc(100px + env(safe-area-inset-bottom))' }} />
            <div className="hidden h-10 md:block" />
        </div>
    );
};

export default VisualBoard;
