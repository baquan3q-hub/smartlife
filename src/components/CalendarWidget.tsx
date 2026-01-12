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
        return {
            lunarDay: lunar.getDay(),
            lunarMonth: lunar.getMonth(),
            dayName: lunar.getDayInChinese(),
            monthName: lunar.getMonthInChinese(),
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
                        <div className="grid grid-cols-7 gap-1 text-center mb-2">
                            {WEEKDAYS.map((d, i) => (
                                <div key={d} className={`text-xs font-bold py-2 ${i === 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                    {d}
                                </div>
                            ))}
                        </div>

                        {/* Grid Body */}
                        <div className="grid grid-cols-7 gap-1 lg:gap-2">
                            {daysInMonth.map((dateObj, index) => {
                                const { day, month, year, isCurrentMonth } = dateObj;
                                const lunarInfo = getLunarInfo(day, month, year);
                                const holidays = getHolidays(day, month, year);

                                const dateStr = toDateString(day, month, year);
                                const hasEvents = events.some(e => e.date === dateStr);
                                const isSelected = isSameDate(selectedDate, day, month, year);
                                const isToday = isSameDate(new Date(), day, month, year);
                                const isWeekend = new Date(year, month - 1, day).getDay() === 0;

                                return (
                                    <div
                                        key={index}
                                        onClick={() => setSelectedDate(new Date(year, month - 1, day))}
                                        className={`
                                        min-h-[80px] sm:min-h-[90px] p-1.5 sm:p-2 rounded-xl flex flex-col justify-between border cursor-pointer transition-all hover:scale-105 hover:shadow-md
                                        ${!isCurrentMonth ? 'opacity-30' : ''}
                                        ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 border-transparent z-10' : ''}
                                        ${isToday ? 'bg-indigo-600 text-white border-indigo-600' :
                                                holidays.some(h => h.type === 'tet') ? 'bg-red-50 border-red-200' :
                                                    isWeekend ? 'bg-orange-50/30 border-orange-100' : 'bg-white border-gray-100 hover:border-indigo-200'}
                                    `}
                                    >
                                        <div className="flex justify-between items-start">
                                            <span className={`text-base sm:text-lg font-bold ${isToday ? 'text-white' : isWeekend ? 'text-red-500' : 'text-gray-700'}`}>
                                                {day}
                                            </span>
                                            <div className="flex flex-col items-end gap-1">
                                                {hasEvents && (
                                                    <div className={`w-2 h-2 rounded-full ${isToday ? 'bg-white' : 'bg-green-500'}`}></div>
                                                )}
                                                {holidays.length > 0 && (
                                                    <div className="text-[10px] bg-red-100 text-red-600 px-1 rounded font-bold overflow-hidden text-ellipsis whitespace-nowrap max-w-[40px]">
                                                        <Star size={8} className="inline fill-current" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <div className={`text-[10px] sm:text-xs font-medium ${isToday ? 'text-indigo-200' : 'text-gray-400'}`}>
                                                {lunarInfo.lunarDay}/{lunarInfo.lunarMonth}
                                            </div>
                                            {lunarInfo.lunarDay === 1 && (
                                                <div className={`text-[8px] uppercase tracking-tighter ${isToday ? 'text-white' : 'text-indigo-400'}`}>
                                                    Tháng {lunarInfo.lunarMonth}
                                                </div>
                                            )}
                                        </div>

                                        {/* Holiday Tooltip */}
                                        {holidays.length > 0 && isCurrentMonth && (
                                            <div className={`mt-1 text-[8px] sm:text-[9px] leading-tight text-center font-bold px-1 py-0.5 rounded
                                            ${isToday ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700 line-clamp-1'}
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
                    <div className="border-t border-gray-100 pt-6">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h4 className="font-bold text-gray-800">
                                    Sự kiện ngày {selectedDate.getDate()}/{selectedDate.getMonth() + 1}
                                </h4>
                                <p className="text-xs text-gray-500">
                                    {getLunarInfo(selectedDate.getDate(), selectedDate.getMonth() + 1, selectedDate.getFullYear()).dayName}
                                    &nbsp;tháng {getLunarInfo(selectedDate.getDate(), selectedDate.getMonth() + 1, selectedDate.getFullYear()).monthName}
                                </p>
                            </div>
                            <button
                                onClick={() => { setEditingEvent(null); setIsModalOpen(true); }}
                                className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition flex items-center gap-1 text-sm font-bold"
                            >
                                <Plus size={16} /> Thêm
                            </button>
                        </div>

                        <div className="space-y-3">
                            {eventsForSelectedDay.length === 0 ? (
                                <div className="text-center py-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                    <p className="text-sm text-gray-400">Không có sự kiện nào</p>
                                </div>
                            ) : (
                                eventsForSelectedDay.map(ev => (
                                    <div key={ev.id} className="group flex items-start justify-between p-3 rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all bg-white">
                                        <div>
                                            <h5 className="font-bold text-gray-800 text-sm mb-1">{ev.title}</h5>
                                            {ev.time && (
                                                <div className="flex items-center gap-1 text-xs text-indigo-600 mb-0.5">
                                                    <Clock size={12} /> {ev.time.slice(0, 5)}
                                                </div>
                                            )}
                                            {ev.location && (
                                                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                                                    <MapPin size={12} /> {ev.location}
                                                </div>
                                            )}
                                            {ev.description && (
                                                <p className="text-xs text-gray-400 line-clamp-2 mt-1 border-t border-gray-50 pt-1">
                                                    {ev.description}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingEvent(ev); setIsModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-indigo-600 bg-gray-50 rounded">
                                                <Edit2 size={12} />
                                            </button>
                                            <button onClick={() => handleDelete(ev.id)} className="p-1.5 text-gray-400 hover:text-red-600 bg-gray-50 rounded">
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))
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
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in relative z-50">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-gray-800">{editingEvent ? 'Sửa sự kiện' : 'Thêm sự kiện'}</h3>
                            <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-gray-400" /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Tiêu đề</label>
                                <input name="title" autoFocus required defaultValue={editingEvent?.title} className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-200 outline-none font-medium" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Giờ (Tùy chọn)</label>
                                    <input type="time" name="time" defaultValue={editingEvent?.time?.slice(0, 5)} className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-200 outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Ngày</label>
                                    <input
                                        type="date"
                                        name="date"
                                        required
                                        defaultValue={editingEvent?.date || selectedDateStr}
                                        className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-200 outline-none text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Địa điểm</label>
                                <div className="relative">
                                    <MapPin size={16} className="absolute left-3 top-3 text-gray-400" />
                                    <input name="location" defaultValue={editingEvent?.location} className="w-full p-2.5 pl-9 bg-gray-50 rounded-xl border border-gray-200 outline-none" placeholder="Tại nhà, trường học..." />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Ghi chú / Mô tả</label>
                                <div className="relative">
                                    <AlignLeft size={16} className="absolute left-3 top-3 text-gray-400" />
                                    <textarea name="description" rows={3} defaultValue={editingEvent?.description} className="w-full p-2.5 pl-9 bg-gray-50 rounded-xl border border-gray-200 outline-none resize-none" placeholder="Chi tiết sự kiện..." />
                                </div>
                            </div>

                            <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 mt-2">
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
