import React, { useMemo, useState } from 'react';
import { AppState, Goal, Todo, TimetableEvent } from '../types';
import { ArrowUpRight, ArrowDownRight, Target, Zap, Clock, Calendar as CalendarIcon, Wallet, Gift, Heart, Flag, Star } from 'lucide-react';

interface VisualBoardProps {
    appState: AppState;
    userName?: string;
    onNavigate?: (tab: 'finance' | 'schedule') => void;
}

const VisualBoard: React.FC<VisualBoardProps> = ({ appState, userName, onNavigate }) => {
    const [showAllHolidays, setShowAllHolidays] = useState(false);

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

    // Next 2 Upcoming Events (Same logic)
    const upcomingEvents = useMemo(() => {
        const todayDay = new Date().getDay();
        const jsDayToTimetableDay = todayDay === 0 ? 8 : todayDay + 1;
        return appState.timetable
            .filter(e => e.day_of_week === jsDayToTimetableDay)
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
            .slice(0, 3);
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

        // Dynamic Lunar/Variable Holidays (Hardcoded for 2026/2027 based on current context if possible, or simpler logic)
        // Since we don't have a lunar library, we'll map specific known dates for the near future.
        // 2026 Dates:
        const dynamicHolidays2026 = [
            { name: 'Tết Nguyên Đán', date: '2026-02-17', icon: <Gift size={16} className="text-red-500" /> }, // Mùng 1 Tết 2026
            { name: 'Giỗ tổ Hùng Vương', date: '2026-04-26', icon: <Flag size={16} className="text-yellow-600" /> }, // 10/3 AL
        ];

        // 2025 Dates (Just in case user time is earlier, though meta says 2026)
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
            <header className="mb-10">
                <div className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-1">
                    {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-800">
                    Chào {userName || 'bạn'}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600">tập trung nhé! ✨</span>
                </h1>
            </header>

            {/* 2. Masonry / Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">

                {/* COL 1: FINANCE SNAPSHOT & GOALS */}
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

                    {/* NEW: Holidays Countdown (Moved here) */}
                    <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-3xl p-6 shadow-sm border border-pink-100 h-auto transition-all duration-500">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Gift size={18} className="text-rose-500" /> Ngày lễ sắp tới
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

                    <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-6 shadow-xl text-white relative overflow-hidden min-h-[300px] flex flex-col">
                        {/* Decorative Background */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/20 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

                        <div className="relative z-10 flex-1 flex flex-col">
                            <h3 className="flex items-center gap-2 font-bold text-lg mb-6 opacity-90">
                                <Zap className="text-yellow-400 fill-yellow-400" size={20} />
                                Nhiệm vụ hôm nay
                            </h3>

                            <div className="space-y-3 flex-1">
                                {priorityTodos.length > 0 ? priorityTodos.map((todo, idx) => (
                                    <div key={todo.id} className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex items-start gap-3 hover:bg-white/20 transition-colors cursor-pointer group">
                                        <div className={`mt-1 w-5 h-5 rounded-full border-2 border-white/30 flex items-center justify-center transition-colors ${idx === 0 ? 'group-hover:border-yellow-400' : ''}`}>
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
                                        <p className="text-sm">Trống trơn! Thời gian để thư giãn? ☕</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* COL 3: TIME & UPCOMING */}
                <div className="space-y-8">
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 h-full">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-6">
                            <Clock size={18} className="text-teal-500" /> Sắp diễn ra
                        </h3>

                        <div className="relative pl-4 border-l-2 border-gray-100 space-y-8">
                            {upcomingEvents.length > 0 ? upcomingEvents.map((ev, idx) => (
                                <div key={ev.id} className="relative">
                                    <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white ${idx === 0 ? 'bg-teal-500 ring-4 ring-teal-50' : 'bg-gray-300'}`}></div>
                                    <div>
                                        <span className="text-xs font-bold text-gray-400 block mb-0.5 bg-gray-50 inline-block px-2 py-0.5 rounded">{ev.start_time} - {ev.end_time || '...'}</span>
                                        <div className="text-gray-800 font-bold text-sm">{ev.title}</div>
                                        {ev.location && <div className="text-xs text-gray-400 mt-1 flex items-center gap-1"><div className="w-1 h-1 bg-gray-300 rounded-full"></div> {ev.location}</div>}
                                    </div>
                                </div>
                            )) : (
                                <div className="text-gray-400 text-sm italic">Hôm nay rảnh rỗi! 🎉</div>
                            )}

                            {/* Add a button to add event */}
                            <div className="relative pt-2">
                                <div className="absolute -left-[21px] top-1/2 w-3 h-3 rounded-full bg-gray-200 border-2 border-white"></div>
                                <button onClick={() => onNavigate?.('schedule')} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">+ Thêm sự kiện</button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default VisualBoard;
