import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Star, Plus, MapPin, Clock, AlignLeft, Trash2, X, Edit2, List, Grid } from 'lucide-react';
import { Solar, Lunar } from 'lunar-javascript';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

interface CalendarEvent {
    id: string;
    title: string;
    description?: string;
    date: string; // YYYY-MM-DD
    time?: string; // HH:MM:00
    location?: string;
    type: 'HOLIDAY' | 'PERSONAL' | 'WORK';
}

interface CalendarWidgetProps {
    className?: string;
}

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const CalendarWidget: React.FC<CalendarWidgetProps> = ({ className }) => {
    const { user } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [viewMode, setViewMode] = useState<'CALENDAR' | 'LIST'>('CALENDAR');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

    // Fetch events
    useEffect(() => {
        if (!user) return;

        const fetchEvents = async () => {
            const { data, error } = await supabase
                .from('calendar_events')
                .select('*')
                .eq('user_id', user.id)
                // Filter by a large range if needed, for now all
                .order('date', { ascending: true }); // Sort by date for list view

            if (data) {
                setEvents(data);
            }
        };

        fetchEvents();
    }, [user, currentDate]); // Reload on mount/user change

    // Reload helper
    const reloadEvents = async () => {
        if (!user) return;
        const { data } = await supabase.from('calendar_events').select('*').eq('user_id', user.id).order('date', { ascending: true });
        if (data) setEvents(data);
    }

    const daysInMonth = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1; // 1-12
        const days = [];

        // First day of the month
        const firstDay = new Date(year, month - 1, 1);
        const startDayOfWeek = firstDay.getDay(); // 0 (Sun) - 6 (Sat)

        // Previous month filler
        const prevMonthDays = new Date(year, month - 1, 0).getDate();
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            days.push({
                day: prevMonthDays - i,
                month: month === 1 ? 12 : month - 1,
                year: month === 1 ? year - 1 : year,
                isCurrentMonth: false,
            });
        }

        // Current month days of this month
        const daysCount = new Date(year, month, 0).getDate();
        for (let i = 1; i <= daysCount; i++) {
            days.push({
                day: i,
                month: month,
                year: year,
                isCurrentMonth: true,
            });
        }

        // Next month filler
        const remainingCells = 42 - days.length; // 6 rows * 7 cols
        for (let i = 1; i <= remainingCells; i++) {
            days.push({
                day: i,
                month: month === 12 ? 1 : month + 1,
                year: month === 12 ? year + 1 : year,
                isCurrentMonth: false,
            });
        }

        return days;
    }, [currentDate]);

    const getLunarInfo = (day: number, month: number, year: number) => {
        const solar = Solar.fromYmd(year, month, day);
        const lunar = solar.getLunar();
        const lDay = lunar.getDay();
        const lMonth = lunar.getMonth();

        // Convert Lunar Day to Vietnamese
        let dayName = '';
        if (lDay === 1) dayName = 'Mùng 1';
        else if (lDay <= 10) dayName = `Mùng ${lDay}`;
        else if (lDay === 15) dayName = 'Rằm';
        else dayName = `${lDay}`;

        // Convert Lunar Month to Vietnamese
        let monthName = '';
        if (lMonth === 1) monthName = 'Giêng';
        else if (lMonth === 11) monthName = 'Một';
        else if (lMonth === 12) monthName = 'Chạp';
        else monthName = `${lMonth}`;

        const isLeapMonth = lunar.getMonthInChinese().includes('闰');
        if (isLeapMonth) {
            monthName += ' (Nhuận)';
        }

        return {
            lunarDay: lDay,
            lunarMonth: lMonth,
            dayName,
            monthName,
        };
    };

    const getHolidays = (day: number, month: number, year: number) => {
        const solar = Solar.fromYmd(year, month, day);
        const holidays = [];

        // Solar Holidays
        if (day === 1 && month === 1) holidays.push({ name: 'Tết Dương', type: 'holiday' });
        if (day === 30 && month === 4) holidays.push({ name: 'Giải phóng', type: 'holiday' });
        if (day === 1 && month === 5) holidays.push({ name: 'Quốc tế LĐ', type: 'holiday' });
        if (day === 2 && month === 9) holidays.push({ name: 'Quốc khánh', type: 'holiday' });

        // Lunar Holidays
        const lunar = solar.getLunar();
        const lDay = lunar.getDay();
        const lMonth = lunar.getMonth();

        if (lDay === 1 && lMonth === 1) holidays.push({ name: 'Mùng 1 Tết', type: 'tet' });
        if (lDay === 2 && lMonth === 1) holidays.push({ name: 'Mùng 2 Tết', type: 'tet' });
        if (lDay === 3 && lMonth === 1) holidays.push({ name: 'Mùng 3 Tết', type: 'tet' });
        if (lDay === 10 && lMonth === 3) holidays.push({ name: 'Giỗ Tổ', type: 'holiday' });
        if (lDay === 15 && lMonth === 8) holidays.push({ name: 'Trung Thu', type: 'festival' });

        return holidays;
    };

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const isSameDate = (d1: Date, day: number, month: number, year: number) => {
        return d1.getDate() === day && d1.getMonth() + 1 === month && d1.getFullYear() === year;
    };

    const toDateString = (day: number, month: number, year: number) => {
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    };

    // Filter events for selected date
    const toLocalISOString = (date: Date) => {
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    };
    // Actually simpler manual construction avoids offset confusion entirely
    const getLocalDateStr = (d: Date) => {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    const selectedDateStr = getLocalDateStr(selectedDate);
    const eventsForSelectedDay = events.filter(e => e.date === selectedDateStr);

    // Sort events for List View (All events)
    const sortedEvents = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    // Separate upcoming and past? For now just simple list.

    // Modal Handlers
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!user) return;

        const fd = new FormData(e.currentTarget);
        const newEvent = {
            title: fd.get('title') as string,
            description: fd.get('description') as string,
            date: fd.get('date') as string, // Now editable in modal
            time: fd.get('time') ? (fd.get('time') as string) + ':00' : null,
            location: fd.get('location') as string,
            type: 'PERSONAL',
            user_id: user.id
        };

        if (editingEvent) {
            await supabase.from('calendar_events').update(newEvent).eq('id', editingEvent.id);
        } else {
            await supabase.from('calendar_events').insert([newEvent]);
        }

        await reloadEvents();
        setIsModalOpen(false);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Bạn có chắc muốn xóa sự kiện này?")) {
            await supabase.from('calendar_events').delete().eq('id', id);
            await reloadEvents();
            if (editingEvent?.id === id) {
                setIsModalOpen(false);
                setEditingEvent(null);
            }
        }
    }

    return (
        <div className={`bg-white rounded-3xl shadow-lg border border-gray-100 p-6 flex flex-col gap-6 ${className}`}>

            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <CalendarIcon className="text-rose-500" size={24} />
                        Lịch Vạn Niên
                    </h3>
                    <p className="text-sm text-gray-500 capitalize">
                        {viewMode === 'CALENDAR'
                            ? `Tháng ${currentDate.getMonth() + 1}, ${currentDate.getFullYear()}`
                            : 'Danh sách sự kiện'
                        }
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setViewMode(viewMode === 'CALENDAR' ? 'LIST' : 'CALENDAR')}
                        className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition"
                        title={viewMode === 'CALENDAR' ? 'Xem Danh Sách' : 'Xem Lịch'}
                    >
                        {viewMode === 'CALENDAR' ? <List size={20} /> : <Grid size={20} />}
                    </button>

                    {viewMode === 'CALENDAR' && (
                        <div className="flex bg-gray-50 rounded-xl p-1">
                            <button onClick={handlePrevMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-gray-600"><ChevronLeft size={20} /></button>
                            <button onClick={() => {
                                const now = new Date();
                                setCurrentDate(now);
                                setSelectedDate(now);
                            }} className="px-3 text-xs font-bold text-indigo-600 hover:bg-white hover:shadow-sm rounded-lg transition-all">Hôm nay</button>
                            <button onClick={handleNextMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-gray-600"><ChevronRight size={20} /></button>
                        </div>
                    )}
                </div>
            </div>

            {/* View Content */}
            {viewMode === 'CALENDAR' ? (
                <>
                    {/* 1. Calendar Grid */}
                    <div>
                        {/* Grid Header */}
                        <div className="grid grid-cols-7 gap-1.5 text-center mb-2.5 bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-cyan-50/60 p-1.5 rounded-xl border border-gray-100/40 dark:from-indigo-950/20 dark:via-purple-950/10 dark:to-cyan-950/20 dark:border-slate-800/40">
                            {WEEKDAYS.map((d, i) => (
                                <div key={d} className={`text-xs font-extrabold py-1.5 ${i === 0 ? 'text-rose-500' : i === 6 ? 'text-sky-500' : 'text-gray-400 dark:text-slate-400'}`}>
                                    {d}
                                </div>
                            ))}
                        </div>

                        {/* Grid Body */}
                        <div className="grid grid-cols-7 gap-1.5 lg:gap-2">
                            {daysInMonth.map((dateObj, index) => {
                                const { day, month, year, isCurrentMonth } = dateObj;
                                const lunarInfo = getLunarInfo(day, month, year);
                                const holidays = getHolidays(day, month, year);

                                const dateStr = toDateString(day, month, year);
                                const hasEvents = events.some(e => e.date === dateStr);
                                const isSelected = isSameDate(selectedDate, day, month, year);
                                const isToday = isSameDate(new Date(), day, month, year);
                                
                                const dayOfWeek = new Date(year, month - 1, day).getDay();
                                const isSaturday = dayOfWeek === 6;
                                const isSunday = dayOfWeek === 0;

                                // Build responsive dynamic classes
                                let cellClass = "min-h-[85px] sm:min-h-[95px] p-2 rounded-2xl flex flex-col justify-between border cursor-pointer transition-all duration-300 hover:scale-105 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-100/50 dark:hover:shadow-none ";
                                
                                if (!isCurrentMonth) {
                                    cellClass += "opacity-25 hover:opacity-50 ";
                                }
                                
                                if (isSelected) {
                                    cellClass += "ring-2 ring-indigo-500/70 border-transparent shadow-[0_0_15px_rgba(99,102,241,0.2)] scale-[1.03] z-10 ";
                                }
                                
                                if (isToday) {
                                    cellClass += "bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-600 text-white border-transparent shadow-lg shadow-indigo-500/25 ";
                                } else if (holidays.some(h => h.type === 'tet')) {
                                    cellClass += "bg-rose-50/70 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/30 ";
                                } else if (isSunday) {
                                    cellClass += "bg-rose-50/15 border-rose-100/40 hover:border-rose-200 dark:bg-rose-950/5 dark:border-rose-900/10 ";
                                } else if (isSaturday) {
                                    cellClass += "bg-sky-50/15 border-sky-100/40 hover:border-sky-200 dark:bg-sky-950/5 dark:border-sky-900/10 ";
                                } else {
                                    cellClass += "bg-white/60 hover:bg-white dark:bg-slate-900/60 dark:hover:bg-slate-900/90 border-gray-100 dark:border-slate-800/80 hover:border-indigo-200 dark:hover:border-indigo-900 ";
                                }

                                return (
                                    <div
                                        key={index}
                                        onClick={() => setSelectedDate(new Date(year, month - 1, day))}
                                        className={cellClass}
                                    >
                                        <div className="flex justify-between items-start">
                                            <span className={`text-base sm:text-lg font-bold ${
                                                isToday ? 'text-white' : 
                                                isSunday ? 'calendar-weekend-sun' : 
                                                isSaturday ? 'calendar-weekend-sat' : 'text-gray-700 dark:text-slate-200'
                                            }`}>
                                                {day}
                                            </span>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                {hasEvents && (
                                                    <span className={`w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-indigo-500'}`}></span>
                                                )}
                                                {holidays.length > 0 && (
                                                    <span className="relative flex h-1.5 w-1.5">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-450 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <span className={`text-[9px] sm:text-[10px] font-bold ${
                                                isToday ? 'text-indigo-150' : 
                                                (lunarInfo.lunarDay === 1 || lunarInfo.lunarDay === 15) ? 'lunar-special-day' : 'text-gray-400 dark:text-slate-500'
                                            }`}>
                                                {lunarInfo.lunarDay}
                                            </span>
                                            {lunarInfo.lunarDay === 1 && (
                                                <div className={`text-[7px] sm:text-[8px] font-bold uppercase tracking-tighter ${isToday ? 'text-white' : 'text-purple-500 dark:text-purple-400'}`}>
                                                    T.{lunarInfo.lunarMonth}
                                                </div>
                                            )}
                                        </div>

                                        {/* Holiday Label Banner */}
                                        {holidays.length > 0 && isCurrentMonth && (
                                            <div className={`mt-1.5 text-[8px] sm:text-[9px] leading-tight text-center font-bold px-1 py-0.5 rounded-md
                                            ${isToday ? 'bg-white/25 text-white' : 'bg-rose-50 text-rose-600 border border-rose-100/50 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/30 line-clamp-1'}
                                        `}>
                                                {holidays[0].name}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 2. Selected Date Events Section */}
                    <div className="border-t border-gray-100 dark:border-slate-800/80 pt-6">
                        <div className="flex justify-between items-center mb-5">
                            <div>
                                <h4 className="font-extrabold text-gray-805 dark:text-white text-base tracking-tight">
                                    Sự kiện ngày {selectedDate.getDate()}/{selectedDate.getMonth() + 1}
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-slate-450 mt-0.5">
                                    {getLunarInfo(selectedDate.getDate(), selectedDate.getMonth() + 1, selectedDate.getFullYear()).dayName}
                                    &nbsp;tháng {getLunarInfo(selectedDate.getDate(), selectedDate.getMonth() + 1, selectedDate.getFullYear()).monthName}
                                </p>
                            </div>
                            <button
                                onClick={() => { setEditingEvent(null); setIsModalOpen(true); }}
                                className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-95 text-white rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all shadow-md shadow-indigo-100/30 active:scale-95"
                            >
                                <Plus size={14} /> Thêm
                            </button>
                        </div>

                        <div className="space-y-4">
                            {eventsForSelectedDay.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-8 bg-white/20 dark:bg-slate-900/20 backdrop-blur-md rounded-2xl border border-dashed border-gray-200/50 dark:border-slate-800/80 shadow-inner transition-all duration-300">
                                    <div className="p-3 bg-gradient-to-tr from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 rounded-xl mb-3 text-indigo-400 dark:text-indigo-500 transition-transform duration-300">
                                        <CalendarIcon size={24} className="stroke-[1.5]" />
                                    </div>
                                    <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                                        Lịch trống
                                    </p>
                                    <p className="text-[13px] text-gray-450 dark:text-slate-400 text-center font-medium max-w-[200px]">
                                        Không có sự kiện nào được lên lịch cho ngày này
                                    </p>
                                </div>
                            ) : (
                                <div className="timeline-container space-y-4">
                                    {eventsForSelectedDay.map(ev => (
                                        <div key={ev.id} className="timeline-item relative group">
                                            {/* Timeline dot */}
                                            <div className="timeline-dot-wrapper">
                                                <span className="timeline-dot"></span>
                                            </div>
                                            
                                            {/* Card detail */}
                                            <div className="flex items-start justify-between p-4 rounded-2xl border border-gray-100 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 hover:border-indigo-200 dark:hover:border-indigo-900/80 hover:shadow-md transition-all">
                                                <div className="space-y-1">
                                                    <h5 className="font-extrabold text-gray-800 dark:text-white text-sm tracking-tight">{ev.title}</h5>
                                                    
                                                    <div className="flex flex-wrap gap-x-3.5 gap-y-1 pt-1.5">
                                                        {ev.time && (
                                                            <div className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                                                                <Clock size={12} /> {ev.time.slice(0, 5)}
                                                            </div>
                                                        )}
                                                        {ev.location && (
                                                            <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-slate-400">
                                                                <MapPin size={12} /> {ev.location}
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    {ev.description && (
                                                        <p className="text-xs text-gray-450 dark:text-slate-500 mt-2 border-t border-gray-50 dark:border-slate-800/30 pt-1.5 leading-relaxed">
                                                            {ev.description}
                                                        </p>
                                                    )}
                                                </div>
                                                
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-4 shrink-0">
                                                    <button onClick={() => { setEditingEvent(ev); setIsModalOpen(true); }} className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-gray-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-xl transition-all">
                                                        <Edit2 size={12} />
                                                    </button>
                                                    <button onClick={() => handleDelete(ev.id)} className="p-2 text-gray-400 hover:text-red-600 bg-gray-50 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-slate-700 rounded-xl transition-all">
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                /* List View */
                <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                    <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                        <span className="text-sm font-bold text-gray-600">Tất cả sự kiện ({sortedEvents.length})</span>
                        <button
                            onClick={() => {
                                setEditingEvent(null);
                                setIsModalOpen(true);
                                // Default date to today for new list creation
                                setSelectedDate(new Date());
                            }}
                            className="text-xs font-bold text-indigo-600 flex items-center gap-1"
                        >
                            <Plus size={14} /> Thêm mới
                        </button>
                    </div>

                    {sortedEvents.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <CalendarIcon size={48} className="mx-auto mb-2 opacity-20" />
                            <p>Chưa có sự kiện nào.</p>
                        </div>
                    ) : (
                        sortedEvents.map(ev => {
                            const eventDate = new Date(ev.date);
                            const isPast = eventDate < new Date(new Date().setHours(0, 0, 0, 0));

                            return (
                                <div key={ev.id} className={`flex gap-4 p-4 rounded-2xl border transition-all ${isPast ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-100 hover:border-indigo-200 hover:shadow-md'}`}>
                                    {/* Date Box */}
                                    <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl shrink-0 ${isPast ? 'bg-gray-200 text-gray-500' : 'bg-indigo-50 text-indigo-600'}`}>
                                        <span className="text-xs font-bold uppercase">{eventDate.toLocaleDateString('vi-VN', { month: 'short' })}</span>
                                        <span className="text-xl font-bold leading-none">{eventDate.getDate()}</span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h4 className={`font-bold text-base truncate ${isPast ? 'text-gray-500' : 'text-gray-800'}`}>{ev.title}</h4>
                                            <div className="flex gap-1 shrink-0">
                                                <button onClick={() => { setEditingEvent(ev); setIsModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-gray-100">
                                                    <Edit2 size={14} />
                                                </button>
                                                <button onClick={() => handleDelete(ev.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                            {ev.time && (
                                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                                    <Clock size={12} className="text-indigo-400" /> {ev.time.slice(0, 5)}
                                                </div>
                                            )}
                                            {ev.location && (
                                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                                    <MapPin size={12} className="text-indigo-400" /> {ev.location}
                                                </div>
                                            )}
                                        </div>

                                        {ev.description && (
                                            <p className="text-xs text-gray-400 mt-2 line-clamp-2">{ev.description}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="premium-glass-modal rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-fade-in relative z-50 overflow-hidden">
                        <div className="modal-glow-bubble-1 -top-16 -right-16 animate-pulse-slow"></div>
                        <div className="modal-glow-bubble-2 -bottom-16 -left-16 animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
                        
                        <div className="relative z-10 flex justify-between items-center mb-5">
                            <h3 className="font-extrabold text-lg text-gray-800">{editingEvent ? 'Sửa sự kiện' : 'Thêm sự kiện'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors"><X size={20} className="text-gray-400" /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase ml-1.5 block mb-1">Tiêu đề</label>
                                <input
                                    name="title"
                                    autoFocus
                                    required
                                    defaultValue={editingEvent?.title}
                                    className="w-full px-4 py-3 bg-white/60 backdrop-blur-sm border border-gray-200/80 rounded-2xl outline-none font-semibold text-sm transition-all focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 shadow-sm text-gray-750"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase ml-1.5 block mb-1">Giờ (Tùy chọn)</label>
                                    <div className="custom-picker-input relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors z-20">
                                            <Clock size={14} />
                                        </div>
                                        <input
                                            type="time"
                                            name="time"
                                            defaultValue={editingEvent?.time?.slice(0, 5)}
                                            className="w-full pl-9 pr-3 py-3 bg-white/60 backdrop-blur-sm border border-gray-200/80 rounded-2xl outline-none font-semibold text-sm transition-all focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 shadow-sm text-gray-750"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase ml-1.5 block mb-1">Ngày</label>
                                    <div className="custom-picker-input relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors z-20">
                                            <CalendarIcon size={14} />
                                        </div>
                                        <input
                                            type="date"
                                            name="date"
                                            required
                                            defaultValue={editingEvent?.date || selectedDateStr}
                                            className="w-full pl-9 pr-3 py-3 bg-white/60 backdrop-blur-sm border border-gray-200/80 rounded-2xl outline-none font-semibold text-sm transition-all focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 shadow-sm text-gray-750"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase ml-1.5 block mb-1">Địa điểm</label>
                                <div className="relative group">
                                    <MapPin size={16} className="absolute left-3.5 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                    <input
                                        name="location"
                                        defaultValue={editingEvent?.location}
                                        className="w-full p-3 pl-10 bg-white/60 backdrop-blur-sm border border-gray-200/80 rounded-2xl outline-none font-semibold text-sm transition-all focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 shadow-sm text-gray-750"
                                        placeholder="Tại nhà, trường học..."
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase ml-1.5 block mb-1">Ghi chú / Mô tả</label>
                                <div className="relative group">
                                    <AlignLeft size={16} className="absolute left-3.5 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                    <textarea
                                        name="description"
                                        rows={3}
                                        defaultValue={editingEvent?.description}
                                        className="w-full p-3 pl-10 bg-white/60 backdrop-blur-sm border border-gray-200/80 rounded-2xl outline-none font-semibold text-sm transition-all focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 shadow-sm text-gray-750 resize-none"
                                        placeholder="Chi tiết sự kiện..."
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100/30 transition-all active:scale-95 mt-2"
                            >
                                {editingEvent ? 'Lưu thay đổi' : 'Tạo sự kiện'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarWidget;
