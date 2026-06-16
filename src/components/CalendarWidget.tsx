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

        // Next month filler — use only enough rows needed (max 6)
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
    const getLocalDateStr = (d: Date) => {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    const selectedDateStr = getLocalDateStr(selectedDate);
    const eventsForSelectedDay = events.filter(e => e.date === selectedDateStr);

    // Sort events for List View (All events)
    const sortedEvents = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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

    // Compact lunar text for cell
    const lunarLabel = (lunarDay: number, lunarMonth: number) => {
        if (lunarDay === 1) return `1/${lunarMonth}`;
        return `${lunarDay}`;
    };

    return (
        <div className={`bg-white rounded-2xl border border-slate-100 flex flex-col ${className}`}>

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
                <div className="flex items-center gap-2">
                    <CalendarIcon size={15} className="text-indigo-500" />
                    <span className="text-xs font-black text-slate-800 tracking-tight">Lịch Vạn Niên</span>
                </div>

                <div className="flex items-center gap-1.5">
                    {/* View toggle */}
                    <button
                        onClick={() => setViewMode(viewMode === 'CALENDAR' ? 'LIST' : 'CALENDAR')}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title={viewMode === 'CALENDAR' ? 'Xem danh sách' : 'Xem lịch'}
                    >
                        {viewMode === 'CALENDAR' ? <List size={13} /> : <Grid size={13} />}
                    </button>

                    {viewMode === 'CALENDAR' && (
                        <div className="flex items-center bg-slate-50 rounded-lg p-0.5">
                            <button onClick={handlePrevMonth} className="p-1 hover:bg-white rounded-md transition-colors text-slate-500">
                                <ChevronLeft size={13} />
                            </button>
                            <button
                                onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }}
                                className="px-2 text-[10px] font-extrabold text-indigo-600 hover:bg-white rounded-md transition-colors"
                            >
                                T{currentDate.getMonth() + 1}/{currentDate.getFullYear()}
                            </button>
                            <button onClick={handleNextMonth} className="p-1 hover:bg-white rounded-md transition-colors text-slate-500">
                                <ChevronRight size={13} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Content ── */}
            {viewMode === 'CALENDAR' ? (
                <div className="flex flex-col lg:flex-row">
                    {/* Calendar Grid */}
                    <div className="flex-1 p-3">
                        {/* Weekday headers */}
                        <div className="grid grid-cols-7 gap-0.5 mb-1">
                            {WEEKDAYS.map((d, i) => (
                                <div key={d} className={`text-center text-[9px] font-extrabold py-1 ${
                                    i === 0 ? 'text-rose-400' : i === 6 ? 'text-sky-400' : 'text-slate-400'
                                }`}>
                                    {d}
                                </div>
                            ))}
                        </div>

                        {/* Day cells grid */}
                        <div className="grid grid-cols-7 gap-0.5">
                            {daysInMonth.map((dateObj, index) => {
                                const { day, month, year, isCurrentMonth } = dateObj;
                                const lunarInfo = getLunarInfo(day, month, year);
                                const holidays = getHolidays(day, month, year);
                                const dateStr = toDateString(day, month, year);
                                const hasEvents = events.some(e => e.date === dateStr);
                                const isSelected = isSameDate(selectedDate, day, month, year);
                                const isToday = isSameDate(new Date(), day, month, year);
                                const dayOfWeek = new Date(year, month - 1, day).getDay();
                                const isSunday = dayOfWeek === 0;
                                const isSaturday = dayOfWeek === 6;
                                const hasTet = holidays.some(h => h.type === 'tet');
                                const hasHoliday = holidays.length > 0;

                                return (
                                    <div
                                        key={index}
                                        onClick={() => setSelectedDate(new Date(year, month - 1, day))}
                                        className={`
                                            relative flex flex-col items-center justify-center py-1.5 rounded-lg cursor-pointer
                                            transition-all duration-150 select-none group
                                            ${!isCurrentMonth ? 'opacity-25' : ''}
                                            ${isToday
                                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200/50'
                                                : isSelected
                                                    ? 'bg-indigo-50 ring-1.5 ring-indigo-400/50'
                                                    : hasTet
                                                        ? 'bg-rose-50/60 hover:bg-rose-50'
                                                        : 'hover:bg-slate-50'
                                            }
                                        `}
                                    >
                                        {/* Solar day */}
                                        <span className={`text-[11px] font-bold leading-none ${
                                            isToday ? 'text-white'
                                            : isSunday ? 'text-rose-500'
                                            : isSaturday ? 'text-sky-500'
                                            : 'text-slate-700'
                                        }`}>
                                            {day}
                                        </span>

                                        {/* Lunar day */}
                                        <span className={`text-[7.5px] font-semibold leading-none mt-0.5 ${
                                            isToday ? 'text-indigo-200'
                                            : (lunarInfo.lunarDay === 1 || lunarInfo.lunarDay === 15) ? 'text-purple-500 font-bold'
                                            : 'text-slate-400'
                                        }`}>
                                            {lunarLabel(lunarInfo.lunarDay, lunarInfo.lunarMonth)}
                                        </span>

                                        {/* Indicators row */}
                                        {(hasEvents || hasHoliday) && isCurrentMonth && (
                                            <div className="flex items-center gap-0.5 mt-0.5">
                                                {hasEvents && (
                                                    <span className={`w-1 h-1 rounded-full ${isToday ? 'bg-white' : 'bg-indigo-400'}`} />
                                                )}
                                                {hasHoliday && (
                                                    <span className={`w-1 h-1 rounded-full ${isToday ? 'bg-amber-300' : 'bg-rose-400'}`} />
                                                )}
                                            </div>
                                        )}

                                        {/* Holiday tooltip on hover */}
                                        {hasHoliday && isCurrentMonth && (
                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block z-30">
                                                <div className="bg-slate-800 text-white text-[8px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap shadow-lg">
                                                    {holidays[0].name}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Selected Date Events Panel ── */}
                    <div className="lg:w-[240px] lg:border-l border-t lg:border-t-0 border-slate-100 p-3 flex flex-col">
                        <div className="flex items-center justify-between mb-2.5">
                            <div>
                                <span className="text-[11px] font-black text-slate-800">
                                    {selectedDate.getDate()}/{selectedDate.getMonth() + 1}
                                </span>
                                <span className="text-[9px] text-slate-400 ml-1.5 font-semibold">
                                    {getLunarInfo(selectedDate.getDate(), selectedDate.getMonth() + 1, selectedDate.getFullYear()).dayName}
                                    {' '}T.{getLunarInfo(selectedDate.getDate(), selectedDate.getMonth() + 1, selectedDate.getFullYear()).lunarMonth}
                                </span>
                            </div>
                            <button
                                onClick={() => { setEditingEvent(null); setIsModalOpen(true); }}
                                className="p-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                                title="Thêm sự kiện"
                            >
                                <Plus size={12} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto max-h-[200px] lg:max-h-[280px] space-y-1.5 pr-0.5 custom-scrollbar">
                            {eventsForSelectedDay.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-6 text-center">
                                    <CalendarIcon size={16} className="text-slate-200 mb-1.5" />
                                    <p className="text-[10px] font-semibold text-slate-400">Không có sự kiện</p>
                                </div>
                            ) : (
                                eventsForSelectedDay.map(ev => (
                                    <div key={ev.id} className="group p-2 rounded-xl border border-slate-100 bg-slate-50/40 hover:border-indigo-200 hover:bg-white transition-all">
                                        <div className="flex items-start justify-between gap-1.5">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[10.5px] font-bold text-slate-800 truncate">{ev.title}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {ev.time && (
                                                        <span className="flex items-center gap-0.5 text-[9px] font-semibold text-indigo-500">
                                                            <Clock size={8} /> {ev.time.slice(0, 5)}
                                                        </span>
                                                    )}
                                                    {ev.location && (
                                                        <span className="flex items-center gap-0.5 text-[9px] text-slate-400 truncate">
                                                            <MapPin size={8} /> {ev.location}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                <button onClick={() => { setEditingEvent(ev); setIsModalOpen(true); }} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">
                                                    <Edit2 size={10} />
                                                </button>
                                                <button onClick={() => handleDelete(ev.id)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors">
                                                    <Trash2 size={10} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* ── List View ── */
                <div className="p-3 space-y-1.5 max-h-[400px] overflow-y-auto custom-scrollbar">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                            {sortedEvents.length} sự kiện
                        </span>
                        <button
                            onClick={() => { setEditingEvent(null); setIsModalOpen(true); setSelectedDate(new Date()); }}
                            className="text-[10px] font-bold text-indigo-600 flex items-center gap-0.5 hover:text-indigo-700"
                        >
                            <Plus size={11} /> Thêm
                        </button>
                    </div>

                    {sortedEvents.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                            <CalendarIcon size={20} className="mx-auto mb-1.5 opacity-30" />
                            <p className="text-[10px] font-semibold">Chưa có sự kiện nào</p>
                        </div>
                    ) : (
                        sortedEvents.map(ev => {
                            const eventDate = new Date(ev.date);
                            const isPast = eventDate < new Date(new Date().setHours(0, 0, 0, 0));

                            return (
                                <div key={ev.id} className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all group ${
                                    isPast ? 'bg-slate-50/50 border-slate-50 opacity-50' : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-sm'
                                }`}>
                                    {/* Date chip */}
                                    <div className={`flex flex-col items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
                                        isPast ? 'bg-slate-100 text-slate-400' : 'bg-indigo-50 text-indigo-600'
                                    }`}>
                                        <span className="text-[8px] font-bold uppercase leading-none">{eventDate.toLocaleDateString('vi-VN', { month: 'short' })}</span>
                                        <span className="text-sm font-black leading-none">{eventDate.getDate()}</span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-[10.5px] font-bold truncate ${isPast ? 'text-slate-400' : 'text-slate-800'}`}>{ev.title}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {ev.time && <span className="text-[9px] text-slate-400 flex items-center gap-0.5"><Clock size={8} /> {ev.time.slice(0, 5)}</span>}
                                            {ev.location && <span className="text-[9px] text-slate-400 flex items-center gap-0.5 truncate"><MapPin size={8} /> {ev.location}</span>}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <button onClick={() => { setEditingEvent(ev); setIsModalOpen(true); }} className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-100">
                                            <Edit2 size={10} />
                                        </button>
                                        <button onClick={() => handleDelete(ev.id)} className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100">
                                            <Trash2 size={10} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* ── Event Modal ── */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center px-5 py-3.5 border-b border-slate-100">
                            <h3 className="text-sm font-black text-slate-800">{editingEvent ? 'Sửa sự kiện' : 'Thêm sự kiện'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                                <X size={16} className="text-slate-400" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-0.5 block mb-1">Tiêu đề</label>
                                <input
                                    name="title"
                                    autoFocus
                                    required
                                    defaultValue={editingEvent?.title}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold text-xs transition-all focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 text-slate-700"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-0.5 block mb-1">Giờ</label>
                                    <div className="relative">
                                        <Clock size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                                        <input
                                            type="time"
                                            name="time"
                                            defaultValue={editingEvent?.time?.slice(0, 5)}
                                            className="w-full pl-7 pr-2.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold text-xs transition-all focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 text-slate-700"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-0.5 block mb-1">Ngày</label>
                                    <div className="relative">
                                        <CalendarIcon size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                                        <input
                                            type="date"
                                            name="date"
                                            required
                                            defaultValue={editingEvent?.date || selectedDateStr}
                                            className="w-full pl-7 pr-2.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold text-xs transition-all focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 text-slate-700"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-0.5 block mb-1">Địa điểm</label>
                                <div className="relative">
                                    <MapPin size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                                    <input
                                        name="location"
                                        defaultValue={editingEvent?.location}
                                        className="w-full pl-7 pr-2.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold text-xs transition-all focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 text-slate-700"
                                        placeholder="Tại nhà, trường học..."
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-0.5 block mb-1">Ghi chú</label>
                                <div className="relative">
                                    <AlignLeft size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                                    <textarea
                                        name="description"
                                        rows={2}
                                        defaultValue={editingEvent?.description}
                                        className="w-full pl-7 pr-2.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold text-xs transition-all focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 text-slate-700 resize-none"
                                        placeholder="Chi tiết sự kiện..."
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-200/30 transition-all active:scale-[0.98]"
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
