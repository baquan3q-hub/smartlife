import React, { useMemo, useState, useEffect, useRef } from 'react';
import { AppState, Goal, Todo, TimetableEvent, Habit, CountdownItem, CountUpItem, HabitLog, JournalEntry, MoodLevel } from '../types';
import { calculateCumulativeGPA, calculateSemesterGPA, getAcademicStanding } from '../services/gpaCalculator';
import { ArrowUpRight, ArrowDownRight, Target, Zap, Clock, Calendar as CalendarIcon, Wallet, Gift, Heart, Flag, Star, Headphones, Play, Music, Archive, LockKeyhole, Sparkles, Bot, GraduationCap, Crown, X, ShieldCheck, Flame, Timer, TrendingUp, Download, Share2, Edit2, BookOpen, Loader2, FileText, Eye, EyeOff } from 'lucide-react';
import MyStorage from './MyStorage';
import { useProAccess } from '../hooks/useProAccess';
import { supabase } from '../services/supabase';
import html2canvas from 'html2canvas';
import { journalService } from '../services/journalService';
import { processJournalReward } from '../services/starBrainService';

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

const VisualBoard: React.FC<VisualBoardProps> = ({ appState, userName, userId, userEmail, onNavigate, onUpgrade, onOpenSpotify, onUpdateGoal, onRefresh }) => {
    const [showAllHolidays, setShowAllHolidays] = useState(false);
    const [showStorage, setShowStorage] = useState(false);
    const [showStorageGate, setShowStorageGate] = useState(false);
    const [activeTodoStatusTab, setActiveTodoStatusTab] = useState<'backlog' | 'todo' | 'doing'>('todo');
    const [showFinanceBalance, setShowFinanceBalance] = useState(true);

    // Draggable Storage Button State
    const [storagePos, setStoragePos] = useState({ x: 0, y: 0 });
    const [isDraggingStorage, setIsDraggingStorage] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const buttonStartPos = useRef({ x: 0, y: 0 });
    const hasDragged = useRef(false);

    const handleStorageTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        dragStartPos.current = { x: touch.clientX, y: touch.clientY };
        buttonStartPos.current = { x: storagePos.x, y: storagePos.y };
        hasDragged.current = false;
        setIsDraggingStorage(true);
    };

    const handleStorageTouchMove = (e: React.TouchEvent) => {
        if (!isDraggingStorage) return;
        const touch = e.touches[0];
        const dx = touch.clientX - dragStartPos.current.x;
        const dy = touch.clientY - dragStartPos.current.y;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            hasDragged.current = true;
        }

        const targetX = buttonStartPos.current.x + dx;
        const targetY = buttonStartPos.current.y + dy;

        // Dynamic boundaries based on viewport size to prevent dragging off-screen
        const btnWidth = 48;
        const btnHeight = 48;
        const defaultRight = 24;
        const defaultBottom = 96;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        // Left boundary: screenWidth - defaultRight - btnWidth
        const minX = -(screenWidth - defaultRight - btnWidth - 12);
        // Right boundary: defaultRight
        const maxX = defaultRight - 12;

        // Top boundary: screenHeight - defaultBottom - btnHeight
        const minY = -(screenHeight - defaultBottom - btnHeight - 12);
        // Bottom boundary: defaultBottom
        const maxY = defaultBottom - 12;

        // Clamp positions
        const clampedX = Math.max(minX, Math.min(maxX, targetX));
        const clampedY = Math.max(minY, Math.min(maxY, targetY));

        setStoragePos({
            x: clampedX,
            y: clampedY
        });
    };

    const handleStorageTouchEnd = (e: React.TouchEvent) => {
        setIsDraggingStorage(false);
        if (hasDragged.current) {
            e.preventDefault();
        }
    };

    // Pull to Refresh state
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const startY = useRef(0);
    const isDragging = useRef(false);

    // Schedule Carousel Mobile (PWA) State & Refs
    const scheduleScrollRef = useRef<HTMLDivElement>(null);
    const lastActiveSlideInteraction = useRef<number>(Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            if (Date.now() - lastActiveSlideInteraction.current >= 5000) {
                const el = scheduleScrollRef.current;
                if (el) {
                    const isAtEnd = el.scrollLeft > el.clientWidth / 2;
                    el.scrollTo({
                        left: isAtEnd ? 0 : el.clientWidth,
                        behavior: 'smooth'
                    });
                    lastActiveSlideInteraction.current = Date.now();
                }
            }
        }, 1000);
        return () => clearInterval(interval);
    }, []);

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

    // 2. Goals Separation
    const financeGoals = useMemo(() =>
        appState.goals.filter(g => g.type === 'FINANCIAL' || (g.target_amount && g.target_amount > 0)),
        [appState.goals]);

    const scheduleGoals = useMemo(() =>
        appState.goals.filter(g => g.type !== 'FINANCIAL' && (!g.target_amount || g.target_amount === 0)),
        [appState.goals]);

    // NEW: Cumulative GPA
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

    // Top 3 Priority Todos
    const priorityTodos = useMemo(() => {
        const priorityOrder = { urgent: 1, focus: 2, high: 3, medium: 4, low: 5, chill: 6, temp: 7 };
        return appState.todos
            .filter(t => !t.is_completed)
            .sort((a, b) => (priorityOrder[a.priority as keyof typeof priorityOrder] || 99) - (priorityOrder[b.priority as keyof typeof priorityOrder] || 99))
            .slice(0, 3);
    }, [appState.todos]);

    // Filtered Todos by active status tab
    const filteredTodos = useMemo(() => {
        return appState.todos.filter(t => {
            if (t.is_completed || t.status === 'done') return false;
            const status = t.status || 'todo';
            return status === activeTodoStatusTab;
        });
    }, [appState.todos, activeTodoStatusTab]);

    // Next 2 Upcoming Events Logic REPLACED with Today & Tomorrow Logic
    const scheduleData = useMemo(() => {
        const today = new Date();
        const currentDay = today.getDay(); // 0-6 (0=Sun, 1=Mon, ..., 6=Sat)

        // Use standard JS Day to match Database (ScheduleDashboard saves as 0-6)
        const todayTimetableDay = currentDay;
        const tomorrowTimetableDay = (currentDay + 1) % 7;

        const getLocalDateString = (date: Date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const todayStr = getLocalDateString(today);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = getLocalDateString(tomorrow);

        const calendarEvents = (appState as any).calendarEvents || [];
        const todayCalendarEvents = calendarEvents.filter((e: any) => e.date === todayStr);
        const tomorrowCalendarEvents = calendarEvents.filter((e: any) => e.date === tomorrowStr);

        const mapTimetableEvent = (e: TimetableEvent) => ({
            id: e.id,
            title: e.title,
            start_time: e.start_time ? e.start_time.slice(0, 5) : '00:00',
            end_time: e.end_time ? e.end_time.slice(0, 5) : undefined,
            location: e.location,
            description: null,
            isCalendarEvent: false,
            email_notify: false,
            email_notify_before_minutes: 0
        });

        const mapCalendarEvent = (e: any) => ({
            id: e.id,
            title: e.title,
            start_time: e.time ? e.time.slice(0, 5) : '00:00',
            end_time: undefined,
            location: e.location,
            description: e.description,
            isCalendarEvent: true,
            email_notify: e.email_notify,
            email_notify_before_minutes: e.email_notify_before_minutes
        });

        const getEventsForDay = (dayIndex: number, dayCalendarEvents: any[]) => {
            const mappedTimetable = appState.timetable
                .filter(e => e.day_of_week === dayIndex)
                .map(mapTimetableEvent);

            const mappedCalendar = dayCalendarEvents.map(mapCalendarEvent);

            return [...mappedTimetable, ...mappedCalendar]
                .sort((a, b) => a.start_time.localeCompare(b.start_time));
        };

        const getDayLabel = (d: number) => d === 0 ? "Chủ Nhật" : `Thứ ${d + 1}`;

        return {
            today: getEventsForDay(todayTimetableDay, todayCalendarEvents),
            tomorrow: getEventsForDay(tomorrowTimetableDay, tomorrowCalendarEvents),
            todayLabel: getDayLabel(todayTimetableDay),
            tomorrowLabel: getDayLabel(tomorrowTimetableDay)
        };
    }, [appState.timetable, (appState as any).calendarEvents]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
    };

    // Helper calculate time progress
    const calculateTimeProgress = (created_at?: string, deadline?: string) => {
        if (!created_at || !deadline) return { percent: 0, text: '-' };
        const start = new Date(created_at).getTime();
        const end = new Date(deadline).getTime();
        const now = new Date().getTime();

        if (end <= start) return { percent: 100, text: '0/0 ngày' };

        const totalDuration = end - start;
        const elapsed = now - start;
        const percent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

        const daysPassed = Math.floor(elapsed / (1000 * 60 * 60 * 24));
        const totalDays = Math.floor(totalDuration / (1000 * 60 * 60 * 24));

        return { percent, text: `${daysPassed}/${totalDays} ngày` };
    };

    const getTimeRemaining = (deadline: string) => {
        const end = new Date(deadline).getTime();
        const now = new Date().getTime();
        const diff = end - now;

        if (diff <= 0) return { text: 'Đã hết hạn', isUrgent: true, color: 'text-red-700 bg-red-100 border border-red-200' };

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) return {
            text: `${days} ngày`,
            isUrgent: days < 3,
            color: days < 3 ? 'text-orange-700 bg-orange-100 border border-orange-200' : 'text-emerald-700 bg-emerald-100 border border-emerald-200'
        };
        return { text: `${hours}h${minutes}p`, isUrgent: true, color: 'text-red-700 bg-red-100 border border-red-200' };
    };

    // NEW: Vietnamese Holidays Logic
    const holidays = useMemo(() => {
        const currentYear = new Date().getFullYear();
        // Fixed dates
        const fixedHolidays = [
            { name: 'Tết Dương Lịch', day: 1, month: 1, icon: <CalendarIcon size={16} className="text-blue-500" /> },
            { name: 'Valentine', day: 14, month: 2, icon: <Heart size={16} className="text-pink-500" /> },
            { name: 'Quốc tế Phụ nữ', day: 8, month: 3, icon: <Gift size={16} className="text-rose-500" /> },
            { name: 'Giải phóng miền Nam', day: 30, month: 4, icon: <Flag size={16} className="text-red-500" /> },
            { name: 'Quốc tế Lao động', day: 1, month: 5, icon: <Zap size={16} className="text-orange-500" /> },
            { name: 'Quốc tế Thiếu nhi', day: 1, month: 6, icon: <Gift size={16} className="text-green-500" /> },
            { name: 'Quốc khánh', day: 2, month: 9, icon: <Flag size={16} className="text-red-600" /> },
            { name: 'Phụ nữ Việt Nam', day: 20, month: 10, icon: <Gift size={16} className="text-purple-500" /> },
            { name: 'Halloween', day: 31, month: 10, icon: <Zap size={16} className="text-orange-600" /> },
            { name: 'Nhà giáo Việt Nam', day: 20, month: 11, icon: <Gift size={16} className="text-blue-600" /> },
            { name: 'Giáng sinh', day: 25, month: 12, icon: <Gift size={16} className="text-emerald-600" /> },
        ];

        // Dynamic Lunar/Variable Holidays
        const dynamicHolidays2026 = [
            { name: 'Tết Nguyên Đán', date: '2026-02-17', icon: <Gift size={16} className="text-red-500" /> }, // Mùng 1 Tết 2026
            { name: 'Giỗ tổ Hùng Vương', date: '2026-04-26', icon: <Flag size={16} className="text-yellow-600" /> }, // 10/3 AL
        ];

        // 2025 Dates
        const dynamicHolidays2025 = [
            { name: 'Tết Nguyên Đán', date: '2025-01-29', icon: <Gift size={16} className="text-red-500" /> },
            { name: 'Giỗ tổ Hùng Vương', date: '2025-04-07', icon: <Flag size={16} className="text-yellow-600" /> },
        ];

        const today = new Date();
        const results: any[] = [];

        // Process Fixed
        fixedHolidays.forEach(h => {
            let year = currentYear;
            let date = new Date(year, h.month - 1, h.day);
            if (date.getTime() < today.setHours(0, 0, 0, 0)) {
                year++;
                date = new Date(year, h.month - 1, h.day);
            }
            results.push({ ...h, dateObj: date });
        });

        // Process Dynamic
        [...dynamicHolidays2025, ...dynamicHolidays2026].forEach(h => {
            const date = new Date(h.date);
            if (date.getTime() >= today.setHours(0, 0, 0, 0)) {
                results.push({
                    name: h.name,
                    day: date.getDate(),
                    month: date.getMonth() + 1,
                    icon: h.icon,
                    dateObj: date
                });
            }
        });

        // Sort by nearest
        return results
            .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
            .map(h => {
                const diffTime = Math.abs(h.dateObj.getTime() - today.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return { ...h, daysLeft: diffDays };
            });
    }, []);

    const visibleHolidays = showAllHolidays ? holidays : holidays.slice(0, 4);

    return (
        <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="w-full overflow-x-hidden px-3 md:px-8 pt-4 md:pt-8 relative min-h-screen"
        >
            {/* Background decorative glassmorphism blobs */}
            <div className="absolute top-10 left-10 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl pointer-events-none -z-10 animate-[pulse_6s_infinite]" />
            <div className="absolute top-1/3 right-10 w-[450px] h-[450px] bg-purple-200/20 rounded-full blur-3xl pointer-events-none -z-10 animate-[pulse_8s_infinite_1s]" />
            <div className="absolute bottom-20 left-1/4 w-[400px] h-[400px] bg-cyan-200/15 rounded-full blur-3xl pointer-events-none -z-10 animate-[pulse_7s_infinite_2s]" />
            {/* Pull to Refresh Spinner */}
            <div
                className="absolute left-0 right-0 flex justify-center pointer-events-none transition-all duration-200 z-[100]"
                style={{
                    top: `${pullDistance - 40}px`,
                    opacity: pullDistance > 10 ? Math.min(pullDistance / 50, 1) : 0
                }}
            >
                <div className="bg-white rounded-full p-2.5 shadow-lg border border-gray-100 flex items-center justify-center">
                    <Loader2
                        className={`text-indigo-600 ${isRefreshing ? 'animate-spin' : ''}`}
                        size={20}
                        style={{ transform: `rotate(${pullDistance * 4}deg)` }}
                    />
                </div>
            </div>

            {/* 1. Welcome Header */}
            <header className="mb-6 flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <div className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-1">
                        {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 truncate">
                        Hello {userName || 'ban'}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600">Have a nice day</span>
                    </h1>
                </div>

                {/* AI Advisor Icon Button Shortcut */}
                <button
                    onClick={() => onNavigate?.('ai-advisor')}
                    className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 border border-indigo-500/30 text-cyan-400 hover:text-cyan-300 hover:border-cyan-400/40 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center relative overflow-hidden group"
                    title="Trợ lý sự nghiệp AI"
                >
                    <div className="absolute top-0 right-0 w-8 h-8 bg-cyan-500/10 rounded-full blur-md group-hover:scale-125 transition-transform" />
                    <Bot size={22} className="relative z-10 animate-[pulse_3s_infinite]" />
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                    </span>
                </button>
            </header>


            {/* My Storage Toggle - Discreet & Draggable on Mobile */}
            <button
                onClick={handleStorageClick}
                onTouchStart={handleStorageTouchStart}
                onTouchMove={handleStorageTouchMove}
                onTouchEnd={handleStorageTouchEnd}
                style={{
                    transform: `translate3d(${storagePos.x}px, ${storagePos.y}px, 0)`,
                    transition: isDraggingStorage ? 'none' : 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                    touchAction: 'none'
                }}
                className="fixed bottom-24 right-6 z-50 w-12 h-12 bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg flex items-center justify-center text-gray-300 hover:text-white hover:bg-gray-700 hover:scale-110 active:scale-95 group select-none"
                title="My Storage"
            >
                <Archive size={20} />
                {!canUseStorage && <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-50 rounded-full flex items-center justify-center pointer-events-none"><Crown size={10} className="text-white" /></span>}
                <span className="absolute right-full mr-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">My Storage {!canUseStorage ? '(Pro)' : ''}</span>
            </button>

            {/* My Storage Modal — Pro users only */}
            <MyStorage isOpen={showStorage} onClose={() => setShowStorage(false)} userId={userId || ''} />

            {/* My Storage Pro Gate Modal */}
            {showStorageGate && (
                <div className="fixed inset-0 z-[9998] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowStorageGate(false)} />
                    <div className="relative w-[90%] max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Header gradient */}
                        <div className="bg-gradient-to-br from-gray-900 via-indigo-900 to-purple-900 p-8 text-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl -mr-10 -mt-10" />
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl -ml-8 -mb-8" />
                            <button onClick={() => setShowStorageGate(false)} className="absolute top-4 right-4 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
                                <X size={18} />
                            </button>
                            <div className="relative z-10">
                                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                    <LockKeyhole size={36} className="text-white" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">My Storage</h3>
                                <p className="text-indigo-200 text-sm">Tính năng dành cho gói Pro</p>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-5">
                            <p className="text-gray-600 text-sm text-center leading-relaxed">
                                Nâng cấp lên <strong className="text-indigo-600">SmartLife Pro</strong> để sử dụng kho lưu trữ riêng tư với ghi chú, liên kết, tệp tin, hình ảnh, âm thanh & video.
                            </p>

                            {/* Features list */}
                            <div className="space-y-3">
                                {[
                                    { icon: '📝', text: 'Ghi chú với rich text (đậm, nghiêng, checkbox)' },
                                    { icon: '🔗', text: 'Lưu trữ liên kết quan trọng' },
                                    { icon: '📁', text: 'Upload tệp tin, hình ảnh, audio (10MB) · Video (2MB)' },
                                    { icon: '🔒', text: 'Riêng tư & bảo mật trên cloud' },
                                ].map((f, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                        <span className="text-lg">{f.icon}</span>
                                        <span className="text-sm text-gray-700">{f.text}</span>
                                    </div>
                                ))}
                            </div>

                            {/* CTA */}
                            <button
                                onClick={() => { setShowStorageGate(false); onUpgrade?.(); }}
                                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                            >
                                <Crown size={18} className="text-yellow-300" />
                                Nâng cấp Pro ngay
                            </button>

                            {proAccess.isTrialActive && (
                                <p className="text-center text-xs text-gray-400">
                                    Bạn đang dùng thử — còn {proAccess.daysRemaining} ngày. My Storage chỉ khả dụng với gói Pro.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TWO-COLUMN LAYOUT FOR DESKTOP */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

                {/* ─── MAIN COLUMN (lg:col-span-3) ─── */}
                <div className="lg:col-span-3 space-y-6">

                    {/* BLOCK 1: TODAY'S ACTION HUB */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white/40 backdrop-blur-lg p-4 md:p-6 rounded-[32px] border border-white/60 shadow-[4px_4px_24px_rgba(0,0,0,0.04)]">
                        {/* Col 1: Tasks & Focus */}
                        <div className="md:col-span-1 space-y-4">
                            {/* Today's Tasks - Now named Todo and styled in light mode */}
                            <div
                                onClick={() => onNavigate?.('schedule')}
                                className="bg-indigo-50/50 backdrop-blur-md border border-indigo-100/60 rounded-3xl p-4 md:p-5 shadow-[4px_4px_20px_rgba(99,102,241,0.08)] hover:shadow-[4px_4px_25px_rgba(99,102,241,0.12)] text-gray-800 relative overflow-hidden min-h-[220px] flex flex-col justify-between cursor-pointer hover:bg-indigo-50/60 transition-all group"
                            >
                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-indigo-500/10 transition-colors"></div>

                                <div className="relative z-10 flex-1 flex flex-col justify-between">
                                    <div className="flex justify-between items-start mb-2 gap-2">
                                        <div className="flex-1">
                                            <h3 className="flex items-center gap-1.5 font-bold text-base text-gray-805">
                                                <Zap className="text-indigo-500 fill-indigo-100 animate-pulse shrink-0" size={18} />
                                                Todo
                                            </h3>

                                            {/* Status Tabs for Backlog, Todo, Doing */}
                                            <div className="flex bg-slate-100/90 p-0.5 rounded-lg text-[10px] font-bold mt-2" onClick={(e) => e.stopPropagation()}>
                                                {(['backlog', 'todo', 'doing'] as const).map(tab => (
                                                    <button
                                                        key={tab}
                                                        onClick={() => setActiveTodoStatusTab(tab)}
                                                        className={`flex-1 py-1 px-1.5 rounded-md transition-all capitalize text-[9px] font-bold ${activeTodoStatusTab === tab
                                                            ? 'bg-white text-indigo-700 shadow-xs'
                                                            : 'text-gray-500 hover:text-gray-805'
                                                            }`}
                                                    >
                                                        {tab}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <ArrowUpRight size={16} className="text-gray-400 group-hover:text-indigo-600 transition-colors mt-1 shrink-0" />
                                    </div>

                                    <div
                                        onClick={(e) => e.stopPropagation()}
                                        className="space-y-2 flex-1 max-h-[140px] overflow-y-auto px-1.5 py-1.5 pb-6 mt-2 scrollbar-thin scrollbar-thumb-gray-200 scroll-fade-bottom"
                                    >
                                        {filteredTodos.length > 0 ? filteredTodos.map((todo) => (
                                            <div key={todo.id} className="bg-white/80 backdrop-blur-md rounded-xl p-2.5 border border-gray-100 flex items-start gap-2 hover:bg-white transition-colors cursor-pointer group/item">
                                                <div className="mt-1 w-3.5 h-3.5 rounded-full border border-gray-300 flex items-center justify-center transition-colors hover:border-indigo-500 shrink-0">
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-semibold leading-snug text-gray-800 break-words">{todo.content}</div>
                                                    <div className="flex flex-col gap-1 mt-1.5">
                                                        {todo.priority && todo.priority !== 'medium' && (
                                                            <div>
                                                                <span className={`text-[8px] uppercase font-black tracking-wider px-1 py-0.5 rounded-md leading-none inline-block
                                                                    ${todo.priority === 'urgent' ? 'bg-red-50 text-red-600 border border-red-100' :
                                                                        todo.priority === 'focus' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                                                                            todo.priority === 'high' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                                                                'bg-slate-50 text-slate-600 border border-slate-200/50'}
                                                                `}>
                                                                    {todo.priority}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {todo.description && (
                                                            <span className="text-[10px] text-gray-400 font-medium leading-relaxed italic block mt-0.5 break-words">
                                                                {todo.description}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-1.5 py-6">
                                                <div className="p-1.5 bg-gray-50 rounded-full"><Zap size={16} className="text-gray-405" /></div>
                                                <p className="text-[11px] font-medium">Trống lịch phần này! ☕</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Finance Card - Swapped here from BLOCK 3 */}
                            <div
                                onClick={() => onNavigate?.('finance')}
                                className="bg-white/70 backdrop-blur-md rounded-3xl p-4 md:p-5 border border-slate-100 shadow-[4px_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[4px_4px_25px_rgba(0,0,0,0.1)] relative overflow-hidden group cursor-pointer hover:bg-slate-50/20 transition-all flex flex-col justify-between min-h-[160px]"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110 pointer-events-none"></div>

                                <div className="relative z-10 flex-1 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2 text-gray-500" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-650">
                                                    <Wallet size={14} />
                                                </div>
                                                <span className="font-bold text-xs uppercase tracking-wide text-gray-700">Tài chính</span>
                                            </div>
                                            <button
                                                onClick={() => setShowFinanceBalance(!showFinanceBalance)}
                                                className="p-1 hover:bg-gray-150 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                                                title={showFinanceBalance ? "Ẩn số dư" : "Hiển thị số dư"}
                                            >
                                                {showFinanceBalance ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        </div>

                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Số dư hiện tại</div>
                                        <div className="text-xl md:text-2xl font-black text-gray-800 tracking-tight truncate">
                                            {showFinanceBalance ? formatCurrency(financeStats.balance) : '••••••'}
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-2.5 border-t border-gray-100 mt-2.5">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[9px] text-gray-400 font-bold uppercase mb-0.5 truncate">Thu tháng này</div>
                                            <div className="flex items-center text-emerald-600 font-bold text-xs">
                                                <ArrowUpRight size={12} className="mr-0.5 shrink-0" />
                                                <span className="truncate">
                                                    {showFinanceBalance ? formatCurrency(monthlyFinanceStats.income) : '••••••'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="w-px bg-gray-100"></div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[9px] text-gray-400 font-bold uppercase mb-0.5 truncate">Chi tháng này</div>
                                            <div className="flex items-center text-red-500 font-bold text-xs">
                                                <ArrowDownRight size={12} className="mr-0.5 shrink-0" />
                                                <span className="truncate">
                                                    {showFinanceBalance ? formatCurrency(monthlyFinanceStats.expense) : '••••••'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Col 2 & 3: Lịch trình nay - mai */}
                        <div className="md:col-span-2">
                            <div className="bg-slate-50/50 backdrop-blur-md rounded-3xl p-4 md:p-5 border border-slate-100 shadow-[4px_4px_20px_rgba(0,0,0,0.04)] h-full flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-base md:text-lg font-bold text-gray-800 flex items-center gap-2">
                                            <CalendarIcon className="text-indigo-600" size={18} />
                                            Lịch trình nay - mai
                                        </h2>
                                        <button onClick={() => onNavigate?.('schedule')} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2.5 py-1 rounded-full transition-colors flex items-center gap-0.5">
                                            Chi tiết <ArrowUpRight size={12} />
                                        </button>
                                    </div>

                                    {/* DESKTOP LAYOUT (md and up): 2 Columns */}
                                    <div className="hidden md:grid md:grid-cols-2 gap-4">
                                        {/* TODAY CARD */}
                                        <div className="bg-white/75 backdrop-blur-md rounded-2xl p-4 border border-indigo-100/40 shadow-[4px_4px_16px_rgba(99,102,241,0.06)] hover:shadow-[4px_4px_22px_rgba(99,102,241,0.1)] hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/30 rounded-bl-full -mr-8 -mt-8 pointer-events-none"></div>
                                            <h3 className="text-indigo-900 font-bold text-sm mb-3 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                                Hôm nay ({scheduleData.todayLabel})
                                            </h3>

                                            <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
                                                {scheduleData.today.length > 0 ? scheduleData.today.map((ev, idx) => (
                                                    <div key={idx} className={`flex gap-2.5 p-2 rounded-xl bg-white border ${ev.isCalendarEvent ? 'border-violet-100/80 bg-gradient-to-r from-violet-50/30 to-indigo-50/10 hover:from-violet-50/50 hover:to-indigo-50/30' : 'border-indigo-100/20 hover:border-indigo-100'} transition-colors`}>
                                                        <div className={`flex flex-col items-center justify-center min-w-[50px] border-r ${ev.isCalendarEvent ? 'border-violet-100/30' : 'border-indigo-100/30'} pr-2`}>
                                                            <span className={`text-xs font-black ${ev.isCalendarEvent ? 'text-violet-650' : 'text-indigo-600'} leading-none`}>{ev.start_time}</span>
                                                            <span className="text-[8px] text-gray-400 font-medium uppercase mt-0.5">{ev.end_time || '...'}</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <div className={`font-bold text-gray-700 text-xs truncate ${ev.isCalendarEvent ? 'text-violet-955 font-black' : ''}`}>{ev.title}</div>
                                                                {ev.isCalendarEvent && (
                                                                    <span className="text-[7.5px] font-black px-1.5 py-0.2 rounded bg-violet-100 text-violet-750 uppercase tracking-wider scale-90 shrink-0">
                                                                        Lịch hẹn
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {ev.location && (
                                                                <div className="flex items-center gap-1 text-[9px] text-gray-400 mt-0.5 truncate">
                                                                    <div className={`w-1 h-1 rounded-full ${ev.isCalendarEvent ? 'bg-violet-400' : 'bg-indigo-300'}`}></div>
                                                                    {ev.location}
                                                                </div>
                                                            )}
                                                            {ev.isCalendarEvent && ev.email_notify && (
                                                                <div className="text-[8px] text-violet-650 font-semibold mt-0.5 flex items-center gap-0.5">
                                                                    🔔 Gmail (-{ev.email_notify_before_minutes}p)
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="text-center py-6 text-indigo-300 italic text-xs">
                                                        Enjoy!
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* TOMORROW CARD */}
                                        <div className="bg-white/75 backdrop-blur-md rounded-2xl p-4 border border-gray-100/80 shadow-[4px_4px_16px_rgba(0,0,0,0.05)] hover:shadow-[4px_4px_22px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
                                            <h3 className="text-gray-600 font-bold text-sm mb-3 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                                Ngày mai ({scheduleData.tomorrowLabel})
                                            </h3>

                                            <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
                                                {scheduleData.tomorrow.length > 0 ? scheduleData.tomorrow.map((ev, idx) => (
                                                    <div key={idx} className={`flex gap-2.5 p-2 rounded-xl bg-white border ${ev.isCalendarEvent ? 'border-violet-100/80 bg-gradient-to-r from-violet-50/30 to-indigo-50/10 hover:from-violet-50/50 hover:to-indigo-50/30' : 'border-gray-100/80 hover:border-gray-200'} transition-colors`}>
                                                        <div className={`flex flex-col items-center justify-center min-w-[50px] border-r ${ev.isCalendarEvent ? 'border-violet-100/30' : 'border-gray-100/30'} pr-2`}>
                                                            <span className={`text-xs font-black ${ev.isCalendarEvent ? 'text-violet-650' : 'text-gray-500'} leading-none`}>{ev.start_time}</span>
                                                            <span className="text-[8px] text-gray-400 font-medium uppercase mt-0.5">{ev.end_time || '...'}</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <div className={`font-bold text-gray-700 text-xs truncate ${ev.isCalendarEvent ? 'text-violet-955 font-black' : ''}`}>{ev.title}</div>
                                                                {ev.isCalendarEvent && (
                                                                    <span className="text-[7.5px] font-black px-1.5 py-0.2 rounded bg-violet-100 text-violet-750 uppercase tracking-wider scale-90 shrink-0">
                                                                        Lịch hẹn
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {ev.location && (
                                                                <div className="flex items-center gap-1 text-[9px] text-gray-450 mt-0.5 truncate">
                                                                    <div className={`w-1 h-1 rounded-full ${ev.isCalendarEvent ? 'bg-violet-300' : 'bg-gray-350'}`}></div>
                                                                    {ev.location}
                                                                </div>
                                                            )}
                                                            {ev.isCalendarEvent && ev.email_notify && (
                                                                <div className="text-[8px] text-violet-650 font-semibold mt-0.5 flex items-center gap-0.5">
                                                                    🔔 Gmail (-{ev.email_notify_before_minutes}p)
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="text-center py-6 text-gray-300 italic text-xs">
                                                        Trống lịch.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* MOBILE LAYOUT (md:hidden): Swipeable / Autoplay Carousel Slider */}
                                <div className="md:hidden relative w-full">
                                    <div
                                        ref={scheduleScrollRef}
                                        onTouchStart={() => { lastActiveSlideInteraction.current = Date.now(); }}
                                        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-3 pb-2 scroll-smooth"
                                    >
                                        {/* Slide 1: TODAY */}
                                        <div className="w-[90%] shrink-0 snap-center px-1">
                                            <div className="bg-white/75 backdrop-blur-md rounded-2xl p-4 border border-indigo-100/40 shadow-[4px_4px_16px_rgba(99,102,241,0.06)] relative overflow-hidden min-h-[140px]">
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/30 rounded-bl-full -mr-8 -mt-8 pointer-events-none"></div>
                                                <h3 className="text-indigo-900 font-bold text-xs mb-3 flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                                    Hôm nay ({scheduleData.todayLabel})
                                                </h3>

                                                <div className="space-y-2">
                                                    {scheduleData.today.length > 0 ? scheduleData.today.map((ev, idx) => (
                                                        <div key={idx} className={`flex gap-3 p-2.5 rounded-xl bg-white border ${ev.isCalendarEvent ? 'border-violet-100 bg-gradient-to-r from-violet-50/30 to-indigo-50/10' : 'border-indigo-100/20'}`}>
                                                            <div className={`flex flex-col items-center justify-center min-w-[50px] border-r ${ev.isCalendarEvent ? 'border-violet-100 text-violet-650' : 'border-indigo-100'} pr-2`}>
                                                                <span className={`text-xs font-black ${ev.isCalendarEvent ? 'text-violet-600' : 'text-indigo-600'} leading-none`}>{ev.start_time}</span>
                                                                <span className="text-[8px] text-gray-400 font-medium uppercase mt-0.5">{ev.end_time || '...'}</span>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <div className={`font-bold text-gray-700 text-xs truncate ${ev.isCalendarEvent ? 'text-violet-955 font-black' : ''}`}>{ev.title}</div>
                                                                    {ev.isCalendarEvent && (
                                                                        <span className="text-[7px] font-black px-1.5 py-0.2 rounded bg-violet-100 text-violet-700 uppercase tracking-wider scale-90 shrink-0">
                                                                            Lịch hẹn
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {ev.location && (
                                                                    <div className="flex items-center gap-1 text-[9px] text-gray-555 mt-0.5 truncate">
                                                                        <div className={`w-1 h-1 rounded-full ${ev.isCalendarEvent ? 'bg-violet-300' : 'bg-indigo-300'}`}></div>
                                                                        {ev.location}
                                                                    </div>
                                                                )}
                                                                {ev.isCalendarEvent && ev.email_notify && (
                                                                    <div className="text-[8px] text-violet-600 font-semibold mt-0.5 flex items-center gap-0.5">
                                                                        🔔 Gmail (-{ev.email_notify_before_minutes}p)
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )) : (
                                                        <div className="text-center py-6 text-indigo-300 italic text-xs">
                                                            Không có lịch. 🎉
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Slide 2: TOMORROW */}
                                        <div className="w-[90%] shrink-0 snap-center px-1">
                                            <div className="bg-white/75 backdrop-blur-md rounded-2xl p-4 border border-gray-100/85 shadow-[4px_4px_16px_rgba(0,0,0,0.05)] relative overflow-hidden min-h-[140px]">
                                                <h3 className="text-gray-655 font-bold text-xs mb-3 flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                                    Ngày mai ({scheduleData.tomorrowLabel})
                                                </h3>

                                                <div className="space-y-2">
                                                    {scheduleData.tomorrow.length > 0 ? scheduleData.tomorrow.map((ev, idx) => (
                                                        <div key={idx} className={`flex gap-3 p-2.5 rounded-xl bg-white border ${ev.isCalendarEvent ? 'border-violet-100 bg-gradient-to-r from-violet-50/30 to-indigo-50/10' : 'border-transparent shadow-xs'}`}>
                                                            <div className={`flex flex-col items-center justify-center min-w-[50px] border-r ${ev.isCalendarEvent ? 'border-violet-100 text-violet-650' : 'border-gray-200/50'} pr-2`}>
                                                                <span className={`text-xs font-black ${ev.isCalendarEvent ? 'text-violet-600' : 'text-gray-500'} leading-none`}>{ev.start_time}</span>
                                                                <span className="text-[8px] text-gray-400 font-medium uppercase mt-0.5">{ev.end_time || '...'}</span>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <div className={`font-bold text-gray-700 text-xs truncate ${ev.isCalendarEvent ? 'text-violet-955 font-black' : ''}`}>{ev.title}</div>
                                                                    {ev.isCalendarEvent && (
                                                                        <span className="text-[7px] font-black px-1.5 py-0.2 rounded bg-violet-100 text-violet-750 uppercase tracking-wider scale-90 shrink-0">
                                                                            Lịch hẹn
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {ev.location && (
                                                                    <div className="flex items-center gap-1 text-[9px] text-gray-450 mt-0.5 truncate">
                                                                        <div className={`w-1 h-1 rounded-full ${ev.isCalendarEvent ? 'bg-violet-300' : 'bg-gray-350'}`}></div>
                                                                        {ev.location}
                                                                    </div>
                                                                )}
                                                                {ev.isCalendarEvent && ev.email_notify && (
                                                                    <div className="text-[8px] text-violet-650 font-semibold mt-0.5 flex items-center gap-0.5">
                                                                        🔔 Gmail (-{ev.email_notify_before_minutes}p)
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )) : (
                                                        <div className="text-center py-6 text-gray-300 italic text-xs">
                                                            Ngày mai rảnh rỗi.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                {/* BLOCK 2: CAREER & ACADEMIC GROWTH */}
                <div className="space-y-6">
                    {/* GPA Snapshot & Career Goals */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">                        {/* GPA Snapshot Card */}
                        <div className="bg-white/70 backdrop-blur-md rounded-3xl p-5 md:p-6 shadow-[4px_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[4px_4px_25px_rgba(0,0,0,0.1)] border border-gray-100 transition-all overflow-hidden group relative flex flex-col justify-between min-h-[220px]">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 pointer-events-none"></div>

                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2.5 text-sm md:text-base">
                                        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 shrink-0 shadow-sm border border-blue-100/30">
                                            <GraduationCap size={16} />
                                        </div>
                                        <span>Điểm Tích Lũy</span>
                                    </h3>
                                    <button onClick={() => onNavigate?.('gpa')} className="text-xs font-bold text-gray-400 hover:text-blue-600 transition-colors">
                                        Chi tiết
                                    </button>
                                </div>

                                <div className="flex items-center gap-5 my-2">
                                    <div className="flex-1">
                                        <div className="text-3xl md:text-4xl font-black text-gray-800 mb-1">
                                            {cumulativeGPA != null ? cumulativeGPA.toFixed(2) : '0.00'}
                                        </div>
                                        <div className="text-xs text-gray-400 font-medium">Trung bình Tích lũy (Hệ số 4)</div>
                                    </div>
                                    <div
                                        onClick={() => onNavigate?.('gpa')}
                                        className="shrink-0 flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-650 text-white shadow-lg shadow-blue-500/30 group-hover:-translate-y-0.5 cursor-pointer transition-all hover:scale-105"
                                    >
                                        <ArrowUpRight size={20} />
                                    </div>
                                </div>

                                {/* Quá trình học kỳ trước */}
                                <div className="mt-4 pt-3 border-t border-gray-50">
                                    <div className="text-[10px] text-gray-450 font-bold uppercase tracking-wider mb-2">Quá trình kỳ trước</div>
                                    {previousSemesters.length > 0 ? (
                                        <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-gray-150">
                                            {previousSemesters.map((sem) => {
                                                const semGPA = calculateSemesterGPA(sem.courses);
                                                const standing = getAcademicStanding(semGPA);
                                                return (
                                                    <div
                                                        key={sem.id}
                                                        className="bg-slate-50/60 hover:bg-blue-50/30 border border-slate-100 hover:border-blue-200/50 rounded-2xl p-2.5 min-w-[105px] shrink-0 transition-all duration-200 cursor-pointer"
                                                        onClick={() => onNavigate?.('gpa')}
                                                    >
                                                        <div className="text-[9px] text-gray-455 font-bold uppercase tracking-tight truncate">{sem.name}</div>
                                                        <div className="flex items-baseline gap-1 mt-1">
                                                            <span className="text-sm font-black text-blue-600">{semGPA != null ? semGPA.toFixed(2) : '—'}</span>
                                                            {standing && (
                                                                <span className="text-[8px] font-semibold text-gray-455">/4.0</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center justify-between mt-1 text-[8px] text-gray-400">
                                                            <span className="font-medium">{sem.academic_year}</span>
                                                            {standing && (
                                                                <span className={`px-1 rounded-sm font-bold scale-90 origin-right
                                                                        ${standing === 'Xuất sắc' ? 'bg-yellow-50 text-yellow-600 border border-yellow-100' :
                                                                        standing === 'Giỏi' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                                            standing === 'Khá' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                                                                                'bg-slate-100 text-slate-600'}`}
                                                                >
                                                                    {standing}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-[10px] text-gray-400 italic">Chưa có thông tin học kỳ trước.</div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-50 z-10">
                                <button
                                    onClick={() => onNavigate?.('gpa')}
                                    className="w-full py-2.5 bg-blue-50/50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    Theo dõi quá trình học tập
                                </button>
                            </div>
                        </div>

                        {/* CAREER & VISION WIDGET */}
                        <div className="bg-white/70 backdrop-blur-md rounded-3xl p-5 md:p-6 shadow-[4px_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[4px_4px_25px_rgba(0,0,0,0.1)] border border-gray-100 transition-all relative overflow-hidden group flex flex-col justify-between min-h-[220px]">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2.5 text-sm md:text-base">
                                        <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-650 shrink-0 shadow-sm border border-indigo-100/30">
                                            <Target size={16} />
                                        </div>
                                        <span>Định hướng & Tầm nhìn</span>
                                    </h3>
                                    <button onClick={() => onNavigate?.('goals')} className="text-xs font-bold text-gray-400 hover:text-indigo-650 transition-colors">
                                        Chi tiết
                                    </button>
                                </div>

                                {/* Career Goals Progress */}
                                <div className="space-y-2 mb-4">
                                    {positions.length > 0 ? (
                                        positions.slice(0, 1).map(pos => {
                                            const posGoals = careerGoals.filter(g => g.position_id === pos.id);
                                            const completed = posGoals.filter(g => g.status === 'completed' || g.progress === 100).length;
                                            const total = posGoals.length;
                                            const progress = total > 0 ? Math.round((posGoals.reduce((acc, curr) => acc + curr.progress, 0)) / total) : 0;

                                            return (
                                                <div key={pos.id} className="bg-slate-50/70 border border-slate-100 hover:border-indigo-100 rounded-2xl p-3 transition-colors">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-extrabold text-gray-700 text-xs truncate max-w-[120px]">{pos.title}</span>
                                                        <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100/30 px-2 py-0.5 rounded-full shrink-0">{completed}/{total} kỹ năng</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-[10px] text-gray-500 mb-1.5">
                                                        <span>Tiến độ tổng:</span>
                                                        <span className="font-bold text-indigo-650">{progress}%</span>
                                                    </div>
                                                    <div className="w-full bg-gray-150 h-1.5 rounded-full overflow-hidden">
                                                        <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full" style={{ width: `${progress}%` }}></div>
                                                    </div>

                                                    {/* Show up to 3 individual skills/goals */}
                                                    {posGoals.length > 0 && (
                                                        <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-2.5">
                                                            <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1">Kỹ năng đang phát triển:</div>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {posGoals.slice(0, 3).map(g => (
                                                                    <span
                                                                        key={g.id}
                                                                        className={`px-2 py-0.5 rounded-md text-[9px] font-semibold flex items-center gap-1 border transition-colors
                                                                                ${g.status === 'completed'
                                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100/50'
                                                                                : g.progress > 0
                                                                                    ? 'bg-amber-50 text-amber-700 border-amber-100/50'
                                                                                    : 'bg-slate-55 text-gray-650 border-slate-100'
                                                                            }`}
                                                                    >
                                                                        <span className={`w-1 h-1 rounded-full ${g.status === 'completed' ? 'bg-emerald-500' : g.progress > 0 ? 'bg-amber-500' : 'bg-gray-400'}`}></span>
                                                                        {g.title} {g.progress > 0 && g.status !== 'completed' ? `(${g.progress}%)` : ''}
                                                                    </span>
                                                                ))}
                                                                {posGoals.length > 3 && (
                                                                    <span className="px-1.5 py-0.5 text-gray-400 text-[8px] font-bold">+{posGoals.length - 3}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-gray-400 text-xs italic">Chưa thiết lập vị trí mục tiêu.</p>
                                    )}
                                </div>
                            </div>

                            {/* 5-Year Life Goals Snapshot */}
                            <div className="border-t border-gray-50 pt-3">
                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Mục tiêu dài hạn 5 năm</div>
                                {lifeGoals.length > 0 ? (
                                    <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-gray-150">
                                        {lifeGoals.slice(0, 3).map(goal => (
                                            <div key={goal.id} className="flex items-center gap-1.5 text-[10px] py-1.5 px-2.5 bg-indigo-50/50 border border-indigo-100/20 hover:bg-indigo-50 rounded-2xl transition-all duration-200 shrink-0 cursor-pointer" onClick={() => onNavigate?.('goals')}>
                                                <span className="text-xs">{goal.icon}</span>
                                                <span className={`font-bold text-gray-750 truncate max-w-[70px] ${goal.is_achieved ? 'line-through text-gray-400' : ''}`}>{goal.title}</span>
                                                <span className="text-[8px] bg-white text-indigo-600 border border-indigo-100/30 px-1 rounded-sm shrink-0 font-extrabold">{goal.target_year}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-455 text-[10px] italic">Chưa thiết lập mục tiêu 5 năm.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Finance Goals (Shrunk and scrollable horizontally) */}
                    <div className="bg-white/70 backdrop-blur-md rounded-3xl p-5 shadow-[4px_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[4px_4px_25px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 border border-gray-100 transition-all duration-300 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-3.5">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                                    <Target size={18} className="text-pink-550 animate-pulse" /> Mục tiêu Tài chính
                                </h3>
                                <button onClick={() => onNavigate?.('finance')} className="text-xs font-bold text-indigo-650 hover:text-indigo-850 transition-colors">Xem tất cả</button>
                            </div>
                            {financeGoals.length > 0 ? (
                                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-200">
                                    {financeGoals.map(goal => {
                                        const percent = goal.target_amount ? Math.min(100, Math.round(((goal.current_amount || 0) / goal.target_amount) * 100)) : 0;
                                        return (
                                            <div key={goal.id} className="min-w-[190px] bg-slate-50/50 hover:bg-pink-50/20 border border-slate-100 hover:border-pink-100/30 p-3.5 rounded-2xl transition-all duration-300 shrink-0 group flex flex-col justify-between" onClick={() => onNavigate?.('finance')}>
                                                <div className="flex justify-between items-start gap-2 mb-1.5 cursor-pointer">
                                                    <span className="font-bold text-xs text-gray-700 truncate max-w-[110px] group-hover:text-pink-700 transition-colors">{goal.title}</span>
                                                    <span className="text-[9px] text-pink-650 font-bold bg-pink-50 border border-pink-100/30 px-1.5 py-0.5 rounded-md shrink-0">{percent}%</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-gray-150/70 rounded-full overflow-hidden mb-1.5">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full"
                                                        style={{ width: `${percent}%` }}
                                                    />
                                                </div>
                                                <div className="text-[9px] text-gray-455 font-semibold">{formatCurrency(goal.current_amount || 0)} / {formatCurrency(goal.target_amount || 0)}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center text-gray-400 text-xs py-2">Chưa có mục tiêu tài chính.</div>
                            )}
                        </div>
                    </div>

                    {/* Shortcuts for Learning, CV & Advisor (Compact Row) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                        {/* Học bài ngay! */}
                        <div
                            onClick={() => onNavigate?.('music')}
                            className="bg-gradient-to-br from-violet-50/60 via-purple-50/40 to-indigo-50/60 backdrop-blur-md rounded-2xl p-4 shadow-[4px_4px_16px_rgba(139,92,246,0.06)] hover:shadow-[4px_4px_22px_rgba(139,92,246,0.12)] hover:-translate-y-0.5 cursor-pointer transition-all border border-violet-100/50 hover:border-violet-200 group relative overflow-hidden flex items-center justify-between min-h-[72px]"
                        >
                            <div className="absolute -top-6 -right-6 w-16 h-16 bg-gradient-to-br from-violet-200/20 to-transparent rounded-full blur-sm group-hover:scale-125 transition-transform"></div>
                            <div className="flex items-center gap-3 relative z-10 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shrink-0 shadow-sm">
                                    <BookOpen size={16} className="text-white" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-extrabold text-gray-800 text-xs sm:text-sm truncate">Học bài ngay!</h3>
                                    <p className="text-violet-650 text-[9px] font-semibold mt-0.5 truncate">Phòng tự học tập trung</p>
                                </div>
                            </div>
                            <ArrowUpRight size={16} className="text-gray-400 group-hover:text-violet-650 shrink-0 ml-2" />
                        </div>

                        {/* Cố vấn AI */}
                        <div
                            onClick={() => onNavigate?.('gpa-career')}
                            className="bg-gradient-to-br from-indigo-50/60 via-cyan-50/40 to-purple-50/60 backdrop-blur-md rounded-2xl p-4 shadow-[4px_4px_16px_rgba(99,102,241,0.08)] hover:shadow-[4px_4px_22px_rgba(99,102,241,0.12)] hover:-translate-y-0.5 cursor-pointer transition-all border border-indigo-100/50 hover:border-indigo-200 group relative overflow-hidden flex items-center justify-between min-h-[72px]"
                        >
                            <div className="absolute -top-6 -right-6 w-16 h-16 bg-gradient-to-br from-indigo-200/20 to-transparent rounded-full blur-sm group-hover:scale-125 transition-transform"></div>
                            <div className="flex items-center gap-3 relative z-10 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shrink-0 shadow-sm">
                                    <Bot size={16} className="text-white animate-pulse" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-extrabold text-gray-800 text-xs sm:text-sm truncate">Cố vấn sự nghiệp AI</h3>
                                    <p className="text-indigo-650 text-[9px] font-semibold mt-0.5 truncate">Định hình tương lai</p>
                                </div>
                            </div>
                            <ArrowUpRight size={16} className="text-gray-400 group-hover:text-indigo-650 shrink-0 ml-2" />
                        </div>

                        {/* Xây dựng CV */}
                        <div
                            onClick={() => onNavigate?.('goals-cv')}
                            className="bg-gradient-to-br from-teal-50/60 via-emerald-55/40 to-cyan-50/60 backdrop-blur-md rounded-2xl p-4 shadow-[4px_4px_16px_rgba(20,184,166,0.08)] hover:shadow-[4px_4px_22px_rgba(20,184,166,0.12)] hover:-translate-y-0.5 cursor-pointer transition-all border border-teal-100/50 hover:border-teal-200 group relative overflow-hidden flex items-center justify-between min-h-[72px]"
                        >
                            <div className="absolute -top-6 -right-6 w-16 h-16 bg-gradient-to-br from-teal-200/20 to-transparent rounded-full blur-sm group-hover:scale-125 transition-transform"></div>
                            <div className="flex items-center gap-3 relative z-10 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shrink-0 shadow-sm">
                                    <FileText size={16} className="text-white" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-extrabold text-gray-800 text-xs sm:text-sm truncate">Xây dựng CV tự động</h3>
                                    <p className="text-teal-650 text-[9px] font-semibold mt-0.5 truncate">Ứng tuyển chuyên nghiệp</p>
                                </div>
                            </div>
                            <ArrowUpRight size={16} className="text-gray-400 group-hover:text-teal-650 shrink-0 ml-2" />
                        </div>
                    </div>
                </div>

            </div>

            {/* ─── SIDEBAR COLUMN (lg:col-span-1) ─── */}
            <div className="lg:col-span-1 space-y-6">

                {/* Quick Mood & Journal Streak Widget */}
                <div className="bg-white/70 backdrop-blur-md rounded-3xl p-5 md:p-6 shadow-[4px_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[4px_4px_25px_rgba(0,0,0,0.1)] border border-gray-100 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm md:text-base">
                            <Heart className="text-emerald-500 fill-emerald-100" size={18} />
                            <span>Tâm trạng hôm nay</span>
                        </h3>
                        {journalStreak > 0 && (
                            <span className="flex items-center gap-1 bg-orange-50 text-orange-600 px-2 py-0.5 rounded-lg text-xs font-bold shrink-0">
                                <Flame size={12} fill="currentColor" /> {journalStreak} ngày
                            </span>
                        )}
                    </div>

                    {dashboardReward && (
                        <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-center font-bold text-xs p-2 rounded-xl animate-bounce">
                            🎉 Xuất sắc! Bạn nhận được +{dashboardReward} sao!
                        </div>
                    )}

                    {todayJournal?.mood ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3 border border-gray-100">
                                <span className="text-3xl shrink-0">
                                    {todayJournal.mood === 1 ? '😢' :
                                        todayJournal.mood === 2 ? '😟' :
                                            todayJournal.mood === 3 ? '😐' :
                                                todayJournal.mood === 4 ? '😊' : '🤩'}
                                </span>
                                <div>
                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Cảm xúc của bạn</div>
                                    <div className="font-bold text-sm text-gray-700">
                                        {todayJournal.mood === 1 ? 'Rất tệ' :
                                            todayJournal.mood === 2 ? 'Không tốt' :
                                                todayJournal.mood === 3 ? 'Bình thường' :
                                                    todayJournal.mood === 4 ? 'Tốt' : 'Tuyệt vời'}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => onNavigate?.('journal')}
                                className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl transition-all border border-emerald-100 flex items-center justify-center gap-1.5"
                            >
                                <Edit2 size={12} /> Viết nhật ký chi tiết
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs text-gray-450 font-semibold">Hôm nay bạn cảm thấy thế nào? Ghi nhận nhanh:</p>
                            <div className="grid grid-cols-5 gap-2">
                                {([1, 2, 3, 4, 5] as MoodLevel[]).map(val => (
                                    <button
                                        key={val}
                                        disabled={isSavingMood}
                                        onClick={() => handleQuickMoodSelect(val)}
                                        className="aspect-square bg-gray-50 hover:bg-emerald-50 hover:scale-105 active:scale-95 border border-gray-100 rounded-2xl flex items-center justify-center text-2xl transition-all disabled:opacity-50"
                                        title={val === 1 ? 'Rất tệ' : val === 2 ? 'Không tốt' : val === 3 ? 'Bình thường' : val === 4 ? 'Tốt' : 'Tuyệt vời'}
                                    >
                                        {val === 1 ? '😢' : val === 2 ? '😟' : val === 3 ? '😐' : val === 4 ? '😊' : '🤩'}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => onNavigate?.('journal')}
                                className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl transition-all border border-emerald-100 flex items-center justify-center gap-1.5"
                            >
                                <BookOpen size={12} /> Bắt đầu viết nhật ký
                            </button>
                        </div>
                    )}
                </div>

                {/* HABIT STREAK WIDGET IN SIDEBAR */}
                {!loadingEvents && habits.length > 0 && (
                    <div ref={shareRef} className="bg-white/70 backdrop-blur-md rounded-3xl p-5 md:p-6 shadow-[4px_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[4px_4px_25px_rgba(0,0,0,0.1)] border border-gray-100 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm md:text-base">
                                <Flame className="text-orange-500 fill-orange-100 animate-pulse shrink-0" size={18} />
                                <span>Thói quen & Streak</span>
                            </h3>
                            <button
                                onClick={handleShare}
                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                                title="Tải ảnh khoe Streak"
                            >
                                <Download size={16} />
                            </button>
                        </div>

                        <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200">
                            {habits.map(habit => {
                                const stats = getHabitStats(habit);
                                return (
                                    <div
                                        key={habit.id}
                                        onClick={() => onNavigate?.('habit')}
                                        className="flex items-center justify-between bg-gray-50 hover:bg-indigo-50/40 p-2.5 rounded-2xl border border-gray-100/50 hover:border-indigo-100/30 transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="text-xl shrink-0">{habit.icon}</span>
                                            <span className="font-bold text-gray-705 text-xs truncate max-w-[120px] group-hover:text-indigo-900 transition-colors">{habit.title}</span>
                                        </div>
                                        <span className="flex items-center gap-1 text-orange-600 font-extrabold text-xs bg-orange-50 border border-orange-100/60 px-2 py-0.5 rounded-lg shrink-0">
                                            <Flame size={12} fill="currentColor" /> {stats.currentStreak}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* TIMELINE CONTAINER (Countdowns + Countups + Holidays) */}
                <div className="bg-white/70 backdrop-blur-md border border-gray-100 rounded-3xl p-5 shadow-[4px_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[4px_4px_25px_rgba(0,0,0,0.1)] space-y-6">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm md:text-base">
                            <Clock className="text-indigo-600 animate-pulse" size={18} />
                            <span>Cột mốc & Sự kiện</span>
                        </h3>
                        <button
                            onClick={() => setShowAllHolidays(!showAllHolidays)}
                            className="text-xs font-bold text-indigo-650 hover:text-indigo-850 transition-colors"
                        >
                            {showAllHolidays ? 'Thu gọn' : 'Xem tất cả'}
                        </button>
                    </div>

                    {/* Countdowns (Sắp diễn ra) */}
                    {!loadingEvents && countdowns.length > 0 && (
                        <div className="space-y-2.5">
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                <Timer size={12} className="text-indigo-500" /> Sắp diễn ra
                            </div>
                            <div className="space-y-2">
                                {countdowns.slice(0, 3).map(c => {
                                    const d = diffDays(c.target_date);
                                    return (
                                        <div key={c.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl p-2.5 hover:bg-indigo-50/50 transition-colors">
                                            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center text-xl shrink-0">{c.icon}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-gray-700 text-xs truncate">{c.title}</div>
                                                <div className="text-[9px] text-gray-450 font-medium">{new Date(c.target_date).toLocaleDateString('vi-VN')}</div>
                                            </div>
                                            <div className="text-sm font-black text-indigo-600 shrink-0">{d > 0 ? d : 0} <span className="text-[9px] font-normal text-gray-400">ngày</span></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Countups (Đã trôi qua) */}
                    {!loadingEvents && countups.length > 0 && (
                        <div className="space-y-2.5">
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                <TrendingUp size={12} className="text-emerald-500" /> Đã trôi qua
                            </div>
                            <div className="space-y-2">
                                {countups.slice(0, 3).map(c => {
                                    const d = diffDays(c.start_date, true);
                                    return (
                                        <div key={c.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl p-2.5 hover:bg-emerald-50/50 transition-colors">
                                            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center text-xl shrink-0">{c.icon}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-gray-700 text-xs truncate">{c.title}</div>
                                                <div className="text-[9px] text-gray-455 font-medium">{new Date(c.start_date).toLocaleDateString('vi-VN')}</div>
                                            </div>
                                            <div className="text-sm font-black text-emerald-600 shrink-0">{d > 0 ? d : 0} <span className="text-[9px] font-normal text-gray-400">ngày</span></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Holidays Countdown (Lễ hội) */}
                    <div className="space-y-2.5">
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                            <Gift size={12} className="text-rose-500" /> Lễ hội
                        </div>
                        <div className="space-y-2">
                            {visibleHolidays.map((h: any, idx: number) => (
                                <div key={idx} className="bg-rose-50/40 p-2.5 rounded-2xl flex items-center justify-between border border-rose-100/10 hover:bg-rose-50 transition-colors">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="p-1 bg-white rounded-lg shadow-sm shrink-0">
                                            {h.icon}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-bold text-xs text-gray-700 truncate">{h.name}</div>
                                            <div className="text-[9px] text-gray-500 font-medium">{h.day}/{h.month}</div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 ml-2">
                                        <span className="font-bold text-sm text-indigo-600">{h.daysLeft}</span>
                                        <span className="text-[8px] text-gray-400 font-bold uppercase block -mt-1">Ngày</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* MY SPOTIFY & STORAGE COMBINED ROW */}
                <div className="grid grid-cols-2 gap-4">
                    {/* MY SPOTIFY MINI WIDGET */}
                    <div
                        onClick={() => onOpenSpotify?.()}
                        className="bg-[#121212]/80 backdrop-blur-md rounded-2xl p-3.5 shadow-[4px_4px_16px_rgba(0,0,0,0.2)] hover:shadow-[4px_4px_22px_rgba(29,185,84,0.15)] hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden group border border-[#282828] flex flex-col justify-between h-28"
                    >
                        <div className="absolute -top-6 -right-6 w-16 h-16 bg-[#1DB954]/15 rounded-full blur-md group-hover:scale-125 transition-transform duration-500"></div>
                        <div className="flex justify-between items-start">
                            <div className="w-8 h-8 rounded-full bg-[#1DB954] flex items-center justify-center shadow-lg shadow-[#1DB954]/20 group-hover:scale-110 transition-transform shrink-0">
                                <Play size={14} className="text-black fill-black ml-0.5" />
                            </div>
                            <ArrowUpRight size={14} className="text-gray-555 group-hover:text-white transition-colors" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-xs">My Spotify</h3>
                            <p className="text-[#1DB954] text-[9px] font-bold uppercase tracking-wider mt-0.5">Phát nhạc</p>
                        </div>
                    </div>

                    {/* MY STORAGE MINI WIDGET */}
                    <div
                        onClick={handleStorageClick}
                        className="bg-gradient-to-br from-slate-900/80 to-gray-900/80 backdrop-blur-md rounded-2xl p-3.5 shadow-[4px_4px_16px_rgba(0,0,0,0.2)] hover:shadow-[4px_4px_22px_rgba(99,102,241,0.15)] hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden group border border-slate-800 flex flex-col justify-between h-28"
                    >
                        <div className="absolute -top-6 -right-6 w-16 h-16 bg-indigo-500/15 rounded-full blur-md group-hover:scale-125 transition-transform duration-500"></div>
                        <div className="flex justify-between items-start">
                            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform shrink-0">
                                <LockKeyhole size={14} className="text-white" />
                            </div>
                            {!canUseStorage ? (
                                <Crown size={12} className="text-yellow-400 fill-yellow-400/20" />
                            ) : (
                                <ArrowUpRight size={14} className="text-gray-555 group-hover:text-white transition-colors" />
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-xs">My Storage</h3>
                            <p className="text-gray-400 text-[9px] font-bold uppercase tracking-wider mt-0.5">Kho lưu trữ</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>

            {/* Safe space at the bottom for mobile to prevent navbar cover */ }
    <div className="md:hidden" style={{ height: 'calc(100px + env(safe-area-inset-bottom))' }} />
        </div>
    );
};

export default VisualBoard;
