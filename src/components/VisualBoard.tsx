import React, { useMemo, useState } from 'react';
import { AppState, Goal, Todo, TimetableEvent } from '../types';
import { ArrowUpRight, ArrowDownRight, Target, Zap, Clock, Calendar as CalendarIcon, Wallet, Gift, Heart, Flag, Star, Headphones, Play, Music, Archive, LockKeyhole } from 'lucide-react';
import MyStorage from './MyStorage';

interface VisualBoardProps {
    appState: AppState;
    userName?: string;
    userId?: string;
    onNavigate?: (tab: 'finance' | 'schedule' | 'music') => void;
}

const VisualBoard: React.FC<VisualBoardProps> = ({ appState, userName, userId, onNavigate }) => {
    const [showAllHolidays, setShowAllHolidays] = useState(false);
    const [showStorage, setShowStorage] = useState(false);

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

    // 2. Goals Separation
    const financeGoals = useMemo(() =>
        appState.goals.filter(g => g.type === 'FINANCIAL' || (g.target_amount && g.target_amount > 0)),
        [appState.goals]);

    const scheduleGoals = useMemo(() =>
        appState.goals.filter(g => g.type !== 'FINANCIAL' && (!g.target_amount || g.target_amount === 0)),
        [appState.goals]);

    // Top 3 Priority Todos
    const priorityTodos = useMemo(() => {
        const priorityOrder = { urgent: 1, focus: 2, high: 3, medium: 4, low: 5, chill: 6, temp: 7 };
        return appState.todos
            .filter(t => !t.is_completed)
            .sort((a, b) => (priorityOrder[a.priority as keyof typeof priorityOrder] || 99) - (priorityOrder[b.priority as keyof typeof priorityOrder] || 99))
            .slice(0, 3);
    }, [appState.todos]);

    // Next 2 Upcoming Events Logic REPLACED with Today & Tomorrow Logic
    const scheduleData = useMemo(() => {
        const today = new Date();
        const currentDay = today.getDay(); // 0-6 (0=Sun, 1=Mon, ..., 6=Sat)

        // Use standard JS Day to match Database (ScheduleDashboard saves as 0-6)
        const todayTimetableDay = currentDay;
        const tomorrowTimetableDay = (currentDay + 1) % 7;

        const getEventsForDay = (dayIndex: number) => {
            return appState.timetable
                .filter(e => e.day_of_week === dayIndex)
                .sort((a, b) => a.start_time.localeCompare(b.start_time));
        };

        const getDayLabel = (d: number) => d === 0 ? "Chủ Nhật" : `Thứ ${d + 1}`;

        return {
            today: getEventsForDay(todayTimetableDay),
            tomorrow: getEventsForDay(tomorrowTimetableDay),
            todayLabel: getDayLabel(todayTimetableDay),
            tomorrowLabel: getDayLabel(tomorrowTimetableDay)
        };
    }, [appState.timetable]);

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
        <div className="w-full h-full p-4 md:p-8 overflow-y-auto pb-32">
            {/* 1. Welcome Header */}
            <header className="mb-6">
                <div className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-1">
                    {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <h1 className="text-3xl md:text-3xl font-bold text-gray-800">
                    Hello {userName || 'ban'}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600">Have a nice day</span>
                </h1>
            </header>

            {/* My Storage Toggle - Discreet */}
            <button
                onClick={() => setShowStorage(true)}
                className="fixed bottom-24 right-6 z-50 w-12 h-12 bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg flex items-center justify-center text-gray-300 hover:text-white hover:bg-gray-700 transition-all hover:scale-110 group"
                title="My Storage"
            >
                <Archive size={20} />
                <span className="absolute right-full mr-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">My Storage</span>
            </button>

            {/* My Storage Modal */}
            <MyStorage isOpen={showStorage} onClose={() => setShowStorage(false)} userId={userId || ''} />

            {/* 2. MAIN SCHEDULE SECTION (TOP) */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <CalendarIcon className="text-indigo-600" />
                        Lịch trình nay - mai
                    </h2>
                    <button onClick={() => onNavigate?.('schedule')} className="text-sm font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
                        Chi tiết <ArrowUpRight size={14} />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* TODAY CARD */}
                    <div className="bg-white rounded-3xl p-5 shadow-sm border border-indigo-100 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110 pointer-events-none"></div>
                        <div className="relative z-10">
                            <h3 className="text-indigo-900 font-bold mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                                Hôm nay ({scheduleData.todayLabel})
                            </h3>

                            <div className="space-y-3">
                                {scheduleData.today.length > 0 ? scheduleData.today.map((ev, idx) => (
                                    <div key={idx} className="flex gap-4 p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100/50 hover:bg-indigo-50 transition-colors">
                                        <div className="flex flex-col items-center justify-center min-w-[60px] border-r border-indigo-100 pr-3">
                                            <span className="text-lg font-black text-indigo-600 leading-none">{ev.start_time}</span>
                                            <span className="text-[10px] text-gray-400 font-medium uppercase">{ev.end_time || '...'}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-gray-800 text-base truncate">{ev.title}</div>
                                            {ev.location && (
                                                <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>
                                                    {ev.location}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center py-8 text-indigo-300 italic">
                                        Không có lịch trình hôm nay. Enjoy! 🎉
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* TOMORROW CARD */}
                    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 relative overflow-hidden group">
                        <div className="relative z-10">
                            <h3 className="text-gray-600 font-bold mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                                Ngày mai ({scheduleData.tomorrowLabel})
                            </h3>

                            <div className="space-y-3">
                                {scheduleData.tomorrow.length > 0 ? scheduleData.tomorrow.map((ev, idx) => (
                                    <div key={idx} className="flex gap-4 p-3 rounded-2xl bg-gray-50 border border-transparent hover:border-gray-200 transition-colors opacity-80 hover:opacity-100">
                                        <div className="flex flex-col items-center justify-center min-w-[60px] border-r border-gray-200/50 pr-3">
                                            <span className="text-lg font-black text-gray-500 leading-none">{ev.start_time}</span>
                                            <span className="text-[10px] text-gray-400 font-medium uppercase">{ev.end_time || '...'}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-gray-700 text-base truncate">{ev.title}</div>
                                            {ev.location && (
                                                <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                                                    {ev.location}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center py-8 text-gray-300 italic">
                                        Ngày mai rảnh rỗi.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Masonry / Grid Layout (Remaining Items) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">

                {/* COL 1: TASKS & HOLIDAYS (Was Col 3) */}
                <div className="space-y-8">
                    <div
                        onClick={() => onNavigate?.('schedule')}
                        className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl p-6 shadow-xl text-white relative overflow-hidden min-h-[300px] flex flex-col cursor-pointer hover:shadow-2xl transition-all group"
                    >
                        {/* Decorative Background */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-white/10 transition-colors"></div>

                        <div className="relative z-10 flex-1 flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="flex items-center gap-2 font-bold text-lg text-white/90">
                                    <Zap className="text-yellow-400 fill-yellow-400" size={20} />
                                    Nhiệm vụ hôm nay
                                </h3>
                                <ArrowUpRight size={18} className="text-white/30 group-hover:text-white transition-colors" />
                            </div>

                            <div className="space-y-3 flex-1">
                                {priorityTodos.length > 0 ? priorityTodos.map((todo, idx) => (
                                    <div key={todo.id} className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex items-start gap-3 hover:bg-white/20 transition-colors cursor-pointer group/item">
                                        <div className={`mt-1 w-5 h-5 rounded-full border-2 border-white/30 flex items-center justify-center transition-colors ${idx === 0 ? 'group-hover/item:border-yellow-400' : ''}`}>
                                            {/* Check icon placeholder */}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium leading-snug">{todo.content}</div>
                                            <span className={`text-[10px] uppercase font-bold tracking-wider opacity-60 mt-1 inline-block px-1.5 py-0.5 rounded
                                                ${todo.priority === 'urgent' ? 'bg-red-500/20 text-red-200' :
                                                    todo.priority === 'focus' ? 'bg-indigo-400/20 text-indigo-200' : 'bg-gray-500/20'}
                                            `}>
                                                {todo.priority}
                                            </span>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="flex flex-col items-center justify-center h-full text-white/50 gap-2">
                                        <div className="p-3 bg-white/10 rounded-full"><Zap size={24} /></div>
                                        <p className="text-sm">Hết việc rồi! Chill thôi! ☕</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Holidays Countdown */}
                    <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-3xl p-6 shadow-sm border border-pink-100 h-auto transition-all duration-500">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Gift size={18} className="text-rose-500" /> Lễ hội
                            </h3>
                            <button
                                onClick={() => setShowAllHolidays(!showAllHolidays)}
                                className="text-xs font-bold text-rose-500 hover:text-rose-700 transition-colors"
                            >
                                {showAllHolidays ? 'Thu gọn' : 'Xem thêm'}
                            </button>
                        </div>
                        <div className="space-y-3">
                            {visibleHolidays.map((h: any, idx: number) => (
                                <div key={idx} className="bg-white/80 p-3 rounded-2xl flex items-center justify-between shadow-sm border border-white/50">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-full shadow-sm">
                                            {h.icon}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-gray-700">{h.name}</div>
                                            <div className="text-xs text-gray-500 font-medium">{h.day}/{h.month}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-lg text-indigo-600 leading-none">{h.daysLeft}</div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase">Ngày</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* COL 2: FOCUS ZONE & SCHEDULE GOALS */}
                <div className="space-y-8">
                    {/* NEW: Music Focus Card */}
                    <div
                        onClick={() => onNavigate?.('music')}
                        className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl p-6 shadow-xl text-white relative overflow-hidden group cursor-pointer transition-transform duration-300 hover:scale-[1.02]"
                    >
                        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-white/20 transition-colors"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/30 rounded-full blur-2xl -ml-6 -mb-6 pointer-events-none"></div>

                        <div className="relative z-10 flex items-center justify-between">
                            <div>
                                <h3 className="flex items-center gap-2 font-bold text-xl mb-2">
                                    <span className="bg-white/20 p-2 rounded-lg"><Headphones size={20} className="text-white" /></span>
                                    Học bài ngay!
                                </h3>
                                <p className="text-indigo-100 text-sm mb-4 max-w-[200px]">Bật chế độ tập trung với âm nhạc và timer.</p>
                                <button className="bg-white text-indigo-600 px-5 py-2 rounded-full text-xs font-bold shadow-lg group-hover:bg-indigo-50 transition-all flex items-center gap-2">
                                    <Play size={12} fill="currentColor" /> Bắt đầu Focus
                                </button>
                            </div>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 group-hover:opacity-50 transition-opacity scale-125">
                                <Music size={80} />
                            </div>
                        </div>
                    </div>

                    {/* Schedule Goals (New) */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 max-h-[500px] overflow-y-auto scrollbar-hide">
                        <div className="flex items-center justify-between mb-6 sticky top-0 bg-white z-10 py-1">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Target size={18} className="text-indigo-500" /> Mục tiêu Lịch trình
                            </h3>
                            <button onClick={() => onNavigate?.('schedule')} className="text-xs font-bold text-gray-400 hover:text-indigo-600 transition-colors">Xem thêm</button>
                        </div>
                        <div className="space-y-5">
                            {scheduleGoals.map(goal => {
                                const { percent } = calculateTimeProgress(goal.created_at, goal.deadline);
                                const timeLeft = getTimeRemaining(goal.deadline);
                                return (
                                    <div key={goal.id} className="group border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-1.5">
                                                {goal.is_priority && <Star size={14} className="text-amber-500 fill-amber-500" />}
                                                <span className="font-bold text-gray-700 leading-tight">{goal.title}</span>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${timeLeft.color}`}>
                                                {timeLeft.text}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 mb-2">
                                            {goal.type && goal.type !== 'PERSONAL' && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
                                                    {goal.type === 'SHORT_TERM' ? 'Ngắn hạn' : goal.type === 'MEDIUM_TERM' ? 'Trung hạn' : 'Dài hạn'}
                                                </span>
                                            )}
                                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-500"
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-bold text-indigo-600">{Math.round(percent)}%</span>
                                        </div>

                                        <div className="flex justify-between items-center text-[10px] text-gray-400">
                                            <span>Deadline: {new Date(goal.deadline).toLocaleDateString('vi-VN')}</span>
                                        </div>
                                    </div>
                                );
                            })}
                            {scheduleGoals.length === 0 && <div className="text-center text-gray-400 text-sm py-4">Chưa có mục tiêu lịch trình.</div>}
                        </div>
                    </div>
                </div>

                {/* COL 3: FINANCE SNAPSHOT & GOALS (Was Col 1) */}
                <div className="space-y-8">
                    {/* Net Worth Card */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>

                        <div className="relative">
                            <div className="flex items-center gap-3 mb-4 text-gray-500">
                                <div className="p-2 bg-indigo-100/50 rounded-xl text-indigo-600">
                                    <Wallet size={20} />
                                </div>
                                <span className="font-bold text-sm uppercase tracking-wide">Tài chính tổng quan</span>
                            </div>
                            <div className="text-3xl font-bold text-gray-800 mb-2">
                                {formatCurrency(financeStats.balance)}
                            </div>
                            <div className="flex gap-4 mt-6">
                                <div>
                                    <div className="text-xs text-gray-400 font-bold uppercase mb-1">Tổng thu</div>
                                    <div className="flex items-center text-emerald-500 font-bold text-sm">
                                        <ArrowUpRight size={16} className="mr-1" />
                                        {formatCurrency(financeStats.income)}
                                    </div>
                                </div>
                                <div className="w-px bg-gray-100"></div>
                                <div>
                                    <div className="text-xs text-gray-400 font-bold uppercase mb-1">Tổng chi</div>
                                    <div className="flex items-center text-red-500 font-bold text-sm">
                                        <ArrowDownRight size={16} className="mr-1" />
                                        {formatCurrency(financeStats.expense)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Finance Goals */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Target size={18} className="text-pink-500" /> Mục tiêu Tài chính
                            </h3>
                            <button onClick={() => onNavigate?.('finance')} className="text-xs font-bold text-gray-400 hover:text-indigo-600 transition-colors">Xem thêm</button>
                        </div>
                        <div className="space-y-4">
                            {financeGoals.slice(0, 3).map(goal => {
                                const percent = goal.target_amount ? Math.min(100, Math.round(((goal.current_amount || 0) / goal.target_amount) * 100)) : 0;
                                return (
                                    <div key={goal.id} className="group">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-bold text-gray-700">{goal.title}</span>
                                            <span className="text-gray-400 font-medium text-xs">{percent}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all duration-500 group-hover:shadow-[0_0_10px_rgba(236,72,153,0.4)]"
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-1 text-right">{formatCurrency(goal.current_amount || 0)} / {formatCurrency(goal.target_amount || 0)}</div>
                                    </div>
                                );
                            })}
                            {financeGoals.length === 0 && <div className="text-center text-gray-400 text-sm py-4">Chưa có mục tiêu tài chính.</div>}
                        </div>
                    </div>
                </div>

            </div>

            {/* MY STORAGE PROMO SECTION */}
            <div className="mt-8 mb-4">
                <div
                    onClick={() => setShowStorage(true)}
                    className="relative bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 rounded-3xl p-8 md:p-10 shadow-2xl cursor-pointer group overflow-hidden hover:shadow-[0_20px_60px_rgba(0,0,0,0.3)] transition-all duration-500"
                >
                    {/* Decorative elements */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-500/20 transition-colors duration-500" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl -ml-12 -mb-12 group-hover:bg-purple-500/20 transition-colors duration-500" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />

                    {/* Grid pattern overlay */}
                    <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
                        {/* Icon */}
                        <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shrink-0">
                            <LockKeyhole size={36} className="text-white" />
                        </div>

                        {/* Text */}
                        <div className="text-center md:text-left flex-1">
                            <h3 className="text-2xl md:text-3xl font-bold text-white mb-2 group-hover:text-indigo-200 transition-colors">
                                My Storage
                            </h3>
                            <p className="text-gray-400 text-sm md:text-base max-w-lg leading-relaxed">
                                Kho lưu trữ riêng tư — Ghi chú, liên kết, tệp tin, hình ảnh, âm thanh & video.
                                Mọi thứ quan trọng, tất cả ở một nơi an toàn.
                            </p>
                            <div className="flex flex-wrap gap-2 mt-4 justify-center md:justify-start">
                                <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-semibold">Ghi chú</span>
                                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-semibold">Liên kết</span>
                                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-semibold">Tệp tin</span>
                                <span className="px-3 py-1 bg-pink-500/20 text-pink-300 rounded-full text-xs font-semibold">Hình ảnh</span>
                                <span className="px-3 py-1 bg-violet-500/20 text-violet-300 rounded-full text-xs font-semibold">Âm thanh</span>
                                <span className="px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-xs font-semibold">Video</span>
                            </div>
                        </div>

                        {/* CTA */}
                        <div className="shrink-0">
                            <div className="bg-white text-gray-900 px-6 py-3 rounded-2xl font-bold text-sm shadow-lg group-hover:bg-indigo-100 group-hover:scale-105 transition-all duration-300 flex items-center gap-2">
                                <LockKeyhole size={16} /> Mở kho
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VisualBoard;
