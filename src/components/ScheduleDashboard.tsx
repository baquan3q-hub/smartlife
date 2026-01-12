import React, { useState, useEffect } from 'react';
import { AppState, TimetableEvent, Goal, Todo, TaskPriority } from '../types';
import { Calendar, Clock, CheckCircle2, Circle, Target, Plus, Trash2, Edit2, X, MapPin, AlertCircle, Zap, Coffee, Layers, Star, Download, Image as ImageIcon } from 'lucide-react';
import html2canvas from 'html2canvas';
import CalendarWidget from './CalendarWidget';
import FocusTimer from './FocusTimer';

interface ScheduleDashboardProps {
  state: AppState;
  onAddGoal: (g: any) => void;
  onUpdateGoal: (g: any) => void;
  onDeleteGoal: (id: string) => void;
  onAddTimetable: (t: any) => void;
  onUpdateTimetable: (t: any) => void;
  onDeleteTimetable: (id: string) => void;
  onAddTodo: (content: string, priority: TaskPriority) => void;
  onUpdateTodo: (t: any) => void;
  onDeleteTodo: (id: string) => void;
}

// Reordered: Mon (1) -> Sat (6) -> Sun (0)
const DISPLAY_DAYS = [
  { value: 1, label: 'Thứ 2' },
  { value: 2, label: 'Thứ 3' },
  { value: 3, label: 'Thứ 4' },
  { value: 4, label: 'Thứ 5' },
  { value: 5, label: 'Thứ 6' },
  { value: 6, label: 'Thứ 7' },
  { value: 0, label: 'Chủ Nhật' },
];

const PRIORITY_CONFIG = {
  [TaskPriority.URGENT]: { label: 'Ưu tiên', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle },
  [TaskPriority.FOCUS]: { label: 'Tập trung', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Zap },
  [TaskPriority.CHILL]: { label: 'Chill', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Coffee },
  [TaskPriority.TEMP]: { label: 'Tạm thời', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: Layers },
  // Map DB values to same config
  'high': { label: 'Ưu tiên', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle },
  'medium': { label: 'Tập trung', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Zap },
  'low': { label: 'Chill', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Coffee },
};

const ScheduleDashboard: React.FC<ScheduleDashboardProps> = ({
  state,
  onAddGoal, onUpdateGoal, onDeleteGoal,
  onAddTimetable, onUpdateTimetable, onDeleteTimetable,
  onAddTodo, onUpdateTodo, onDeleteTodo
}) => {
  const { timetable, goals, todos } = state;

  // Modals
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalFilter, setGoalFilter] = useState<'ALL' | 'PRIORITY' | 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM'>('ALL');

  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimetableEvent | null>(null);

  // Export State
  const timetableRef = React.useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Todo Input
  const [newTodoContent, setNewTodoContent] = useState('');
  const [newTodoPriority, setNewTodoPriority] = useState<TaskPriority>(TaskPriority.FOCUS);

  // Filter Goals Logic
  const filteredGoals = goals.filter(g => {
    if (goalFilter === 'ALL') return true;
    if (goalFilter === 'PRIORITY') return g.is_priority;
    return g.type === goalFilter;
  });

  // Countdown Tick
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);



  // -- HELPERS --
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

  const handleExportTimetable = async () => {
    if (!timetableRef.current) return;
    setIsExporting(true);
    // Wait for render
    setTimeout(async () => {
      try {
        if (!timetableRef.current) return;
        const canvas = await html2canvas(timetableRef.current, {
          scale: 2, // High resolution
          useCORS: true,
          backgroundColor: '#ffffff',
          allowTaint: true,
        });

        const link = document.createElement('a');
        link.download = `ThoiKhoaBieu_SmartLife_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (err) {
        console.error("Export failed:", err);
        alert("Có lỗi khi tải ảnh. Vui lòng thử lại.");
      } finally {
        setIsExporting(false);
      }
    }, 100);
  };

  // -- HANDLERS --
  const handleGoalSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      title: fd.get('title'),
      deadline: fd.get('deadline'),
      type: fd.get('type'),
      is_priority: fd.get('is_priority') === 'on',
      // progress removed
    };
    if (editingGoal) onUpdateGoal({ ...editingGoal, ...data });
    else onAddGoal(data);
    setIsGoalModalOpen(false);
  };

  const handleTimeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    // Fix Time Format (HH:MM -> HH:MM:00) for Supabase Time type
    let start = fd.get('start_time') as string;
    let end = fd.get('end_time') as string;

    if (start && start.split(':').length === 2) start += ':00';
    if (end && end.split(':').length === 2) end += ':00';

    const data = {
      title: fd.get('title'),
      day_of_week: Number(fd.get('day_of_week')),
      start_time: start,
      end_time: end,
      location: fd.get('location')
    };
    if (editingEvent) onUpdateTimetable({ ...editingEvent, ...data });
    else onAddTimetable(data);
    setIsTimeModalOpen(false);
  };

  const handleTodoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoContent.trim()) return;

    // Map UI Priority to standard DB Priority values
    let dbPriority: any = 'medium';
    if (newTodoPriority === TaskPriority.URGENT) dbPriority = 'high';
    else if (newTodoPriority === TaskPriority.CHILL || newTodoPriority === TaskPriority.TEMP) dbPriority = 'low';

    // Use the mapped priority to avoid SQL Constraint check failure
    onAddTodo(newTodoContent, dbPriority);
    setNewTodoContent('');
  };

  // -- RENDERERS --

  // 1. Timetable View (Colorful & Bigger)
  const renderTimetable = () => {
    // Colors for different days to make it vibrant
    const DAY_COLORS = [
      'bg-rose-50 border-rose-100 text-rose-700',      // Sun
      'bg-amber-50 border-amber-100 text-amber-700',   // Mon
      'bg-emerald-50 border-emerald-100 text-emerald-700', // Tue
      'bg-sky-50 border-sky-100 text-sky-700',         // Wed
      'bg-violet-50 border-violet-100 text-violet-700', // Thu
      'bg-pink-50 border-pink-100 text-pink-700',      // Fri
      'bg-indigo-50 border-indigo-100 text-indigo-700' // Sat
    ];

    return (
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden h-full flex flex-col">
        <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-white">
          <div>
            <h3 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-1.5 md:gap-2">
              <Calendar className="text-indigo-600 w-5 h-5 md:w-6 md:h-6" />
              Thời khóa biểu tuần
            </h3>
            <p className="text-sm text-gray-500 pl-8">Quản lý lịch học và làm việc cố định</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportTimetable}
              className="px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition font-bold flex items-center gap-1.5"
              title="Tải ảnh lịch về máy"
            >
              <Download size={16} className="md:w-5 md:h-5" />
              <span className="hidden md:inline">Tải ảnh</span>
            </button>
            <button onClick={() => { setEditingEvent(null); setIsTimeModalOpen(true); }} className="px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition font-bold flex items-center gap-1.5">
              <Plus size={16} className="md:w-5 md:h-5" />
              <span className="hidden md:inline">Thêm lịch</span>
              <span className="md:hidden">Thêm</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto custom-scrollbar">
          <div className="grid grid-cols-7 h-full min-h-[600px] min-w-[1000px] divide-x divide-gray-100 bg-white" ref={timetableRef}>
            {DISPLAY_DAYS.map((day, index) => {
              const dayEvents = timetable.filter(e => e.day_of_week === day.value).sort((a, b) => a.start_time.localeCompare(b.start_time));
              const isToday = new Date().getDay() === day.value;
              const dayColor = DAY_COLORS[day.value];

              return (
                <div key={day.value} className={`flex flex-col h-full group transition-colors ${isToday ? 'bg-indigo-50/20' : ''}`}>
                  <div className={`text-center py-4 border-b border-gray-100 ${isToday ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-50/50'}`}>
                    <span className={`text-sm font-bold block ${isToday ? 'text-white' : 'text-gray-600'}`}>{day.label}</span>
                  </div>
                  <div className="p-3 space-y-3 flex-1">
                    {dayEvents.map(e => (
                      <div
                        key={e.id}
                        onClick={() => { setEditingEvent(e); setIsTimeModalOpen(true); }}
                        className={`relative p-3 rounded-2xl border-l-4 shadow-sm hover:shadow-lg cursor-pointer transition-all hover:-translate-y-1 bg-white border-gray-100 hover:border-indigo-400`}
                      >
                        <div className="font-bold text-gray-800 text-sm leading-tight mb-1">{e.title}</div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Clock size={12} className="text-indigo-500" />
                          <span className="font-medium bg-gray-50 px-1.5 rounded">{e.start_time.slice(0, 5)} - {e.end_time?.slice(0, 5)}</span>
                        </div>
                        {e.location && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                            <MapPin size={12} /> {e.location}
                          </div>
                        )}
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            if (window.confirm('Bạn có chắc chắn muốn xóa lịch này không?')) {
                              onDeleteTimetable(e.id);
                            }
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-white/80 rounded-lg text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-sm"
                          title="Xóa lịch"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Watermark for Export (Hidden normally) */}
        {isExporting && (
          <div className="flex justify-between items-center p-6 border-t border-gray-100 bg-white">
            <div className="flex items-center gap-3">
              {state.profile?.avatar_url ? (
                <img src={state.profile.avatar_url} alt="Owner" className="w-12 h-12 rounded-full border-2 border-indigo-100 object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                  {state.profile?.full_name?.charAt(0) || 'U'}
                </div>
              )}
              <div>
                <h4 className="text-xl font-bold text-indigo-800">SmartLife <span className="text-base font-medium text-gray-500">by BaQuan</span></h4>
                <p className="text-sm text-gray-400">Được tạo tự động từ SmartLife App</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-gray-600">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
        )}
      </div>

    );
  };


  // 1.5. Today's Roadmap
  const renderRoadmap = () => {
    const todayIndex = new Date().getDay();
    const todayEvents = timetable
      .filter(t => t.day_of_week === todayIndex)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    // Calculate current time position? For now just static list.
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    return (
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 mt-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
            <MapPin size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">Lịch trình Hôm nay</h3>
            <p className="text-sm text-gray-500">
              {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        {todayEvents.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <p>Hôm nay bạn thảnh thơi! Không có lịch trình.</p>
          </div>
        ) : (
          <div className="relative pl-4 space-y-8 before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-indigo-200 before:to-transparent">
            {todayEvents.map((event, index) => {
              const isPast = event.end_time ? event.end_time < currentTime : event.start_time < currentTime;
              const isHappening = event.start_time <= currentTime && (!event.end_time || event.end_time >= currentTime);

              return (
                <div key={event.id} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group ${isHappening ? 'scale-105 transition-transform' : ''}`}>
                  {/* Icon/Dot */}
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-4 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10
                                    ${isHappening ? 'bg-indigo-600 border-indigo-100 ring-4 ring-indigo-50' : isPast ? 'bg-gray-200 border-gray-50' : 'bg-white border-indigo-200'}
                                `}>
                    {isHappening ? <Zap size={14} className="text-white" /> : <div className={`w-2 h-2 rounded-full ${isPast ? 'bg-gray-400' : 'bg-indigo-400'}`}></div>}
                  </div>

                  {/* Content Card */}
                  <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border shadow-sm transition-all
                                    ${isHappening ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-200 border-transparent' : 'bg-white border-gray-100 hover:shadow-md'}
                                `}>
                    <div className="flex justify-between items-start mb-1">
                      <h4 className={`font-bold text-lg ${isHappening ? 'text-white' : 'text-gray-800'}`}>{event.title}</h4>
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isHappening ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        {event.start_time.slice(0, 5)}
                      </span>
                    </div>
                    <div className={`text-sm flex items-center gap-2 ${isHappening ? 'text-indigo-100' : 'text-gray-500'}`}>
                      <Clock size={14} />
                      {event.start_time.slice(0, 5)} - {event.end_time?.slice(0, 5)}
                    </div>
                    {event.location && (
                      <div className={`text-xs mt-2 flex items-center gap-1.5 ${isHappening ? 'text-indigo-200' : 'text-gray-400'}`}>
                        <MapPin size={12} /> {event.location}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // 2. Todos View (Priority Grouped)
  const renderTodos = () => {
    // Sort: Uncompleted first, then by Priority Order (High -> Low)
    const getPriorityScore = (p: any) => {
      if (p === 'high' || p === 'urgent' || p === TaskPriority.URGENT) return 0;
      if (p === 'medium' || p === 'focus' || p === TaskPriority.FOCUS) return 1;
      if (p === 'low' || p === 'chill' || p === TaskPriority.CHILL) return 2;
      if (p === 'temp' || p === TaskPriority.TEMP) return 3;
      return 4;
    };

    const sortedTodos = [...todos].sort((a, b) => {
      // 1. Completed at bottom
      if (a.is_completed !== b.is_completed) {
        return a.is_completed ? 1 : -1;
      }
      // 2. Priority Score (Lower is better/higher priority)
      const scoreA = getPriorityScore(a.priority);
      const scoreB = getPriorityScore(b.priority);
      return scoreA - scoreB;
    });

    return (
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 flex flex-col">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-1"><CheckCircle2 size={24} className="text-emerald-500" /> Việc cần làm</h3>
          <p className="text-sm text-gray-400">Đã xong {todos.filter(t => t.is_completed).length}/{todos.length} việc</p>
        </div>

        <form onSubmit={handleTodoSubmit} className="space-y-3 mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-100">
          <input
            type="text"
            value={newTodoContent}
            onChange={e => setNewTodoContent(e.target.value)}
            placeholder="Nhập công việc mới..."
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
          />
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {Object.values(TaskPriority).map(p => {
              const config = PRIORITY_CONFIG[p];
              const Icon = config.icon;
              const isSelected = newTodoPriority === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setNewTodoPriority(p)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border
                                    ${isSelected ? config.color + ' ring-2 ring-offset-1 ring-gray-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}
                                `}
                >
                  <Icon size={12} /> {config.label}
                </button>
              )
            })}
          </div>
          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-colors shadow-md flex justify-center items-center gap-2">
            <Plus size={18} /> Thêm việc
          </button>
        </form>

        <div className="space-y-2 flex-1 pr-1">
          {sortedTodos.map(t => {
            const config = PRIORITY_CONFIG[t.priority as TaskPriority] || PRIORITY_CONFIG[TaskPriority.FOCUS];
            return (
              <div key={t.id} className={`group flex items-start gap-3 p-3.5 rounded-2xl border transition-all ${t.is_completed ? 'bg-gray-50 border-transparent opacity-60' : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-md'}`}>
                <button onClick={() => onUpdateTodo({ ...t, is_completed: !t.is_completed })} className={`mt-0.5 transition-colors ${t.is_completed ? 'text-emerald-500' : 'text-gray-300 hover:text-emerald-500'}`}>
                  {t.is_completed ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                </button>

                <div className="flex-1">
                  <p className={`text-sm font-medium leading-snug ${t.is_completed ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{t.content}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wide border flex items-center gap-1 w-fit ${config.color}`}>
                      {config.label}
                    </span>
                  </div>
                </div>

                <button onClick={() => onDeleteTodo(t.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity p-1"><X size={18} /></button>
              </div>
            );
          })}
          {todos.length === 0 && <p className="text-center text-sm text-gray-400 italic py-10">Bạn chưa có công việc nào!</p>}
        </div>
      </div>
    );
  };

  // Mobile Tabs
  const [mobileTab, setMobileTab] = useState<'SCHEDULE' | 'GOALS'>('SCHEDULE');

  return (
    <div className="animate-fade-in pb-20">

      {/* Mobile Tab Navigation (Visible < xl) */}
      <div className="xl:hidden flex p-1 bg-gray-200/50 rounded-xl mb-6 mx-auto max-w-md">
        <button
          onClick={() => setMobileTab('SCHEDULE')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mobileTab === 'SCHEDULE' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Lịch trình
        </button>
        <button
          onClick={() => setMobileTab('GOALS')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mobileTab === 'GOALS' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Mục tiêu
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

        {/* LEFT: Timetable (8 cols) - Show if Desktop OR (Mobile & Tab=SCHEDULE) */}
        <div className={`xl:col-span-8 h-full flex flex-col gap-6 ${mobileTab !== 'SCHEDULE' ? 'hidden xl:flex' : 'flex'}`}>
          {renderTimetable()}
          {renderRoadmap()}
          <CalendarWidget />
        </div>

        {/* RIGHT: Goals & Todos (4 cols) - Show if Desktop OR (Mobile & Tab=GOALS) */}
        <div className={`xl:col-span-4 space-y-8 ${mobileTab !== 'GOALS' ? 'hidden xl:block' : 'block'}`}>

          {/* NEW: Focus Timer */}
          <FocusTimer />


          {/* Goals */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Target size={24} className="text-amber-500" /> Mục tiêu</h3>
              <button onClick={() => { setEditingGoal(null); setIsGoalModalOpen(true); }} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition">Thêm mới</button>
            </div>

            {/* Goal Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-4">
              {['ALL', 'PRIORITY', 'SHORT_TERM', 'MEDIUM_TERM', 'LONG_TERM'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setGoalFilter(filter as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border
                    ${goalFilter === filter
                      ? 'bg-amber-100 text-amber-700 border-amber-200'
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}
                  `}
                >
                  {filter === 'ALL' ? 'Tất cả' :
                    filter === 'PRIORITY' ? 'Ưu tiên' :
                      filter === 'SHORT_TERM' ? 'Ngắn hạn' :
                        filter === 'MEDIUM_TERM' ? 'Trung hạn' : 'Dài hạn'}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {filteredGoals.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-4 italic">Không có mục tiêu nào trong danh mục này.</p>
              ) : (
                filteredGoals.map(g => {
                  const timeLeft = getTimeRemaining(g.deadline);
                  return (
                    <div key={g.id} className={`relative group p-4 rounded-2xl border transition-all ${g.is_priority ? 'bg-amber-50 border-amber-200 shadow-sm' : 'bg-gray-50 border-gray-100 hover:border-indigo-200'}`}>
                      {/* Outer Border Deadline for High Visibility */}
                      <div className={`absolute -right-2 top-4 px-3 py-1 rounded-l-lg text-[10px] font-bold shadow-sm z-10 ${timeLeft.color}`}>
                        {timeLeft.text}
                      </div>

                      <div className="flex justify-between items-start mb-2 pr-12">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {g.is_priority && <Star size={14} className="text-amber-500 fill-amber-500" />}
                            <h4 className="font-bold text-gray-800 text-sm">{g.title}</h4>
                          </div>

                          <div className="flex flex-col gap-1 mt-2">
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                              <Calendar size={12} className="text-indigo-400" />
                              Hạn chót: <span className="text-gray-700">{new Date(g.deadline).toLocaleDateString('vi-VN')}</span>
                            </div>
                            {g.type && g.type !== 'PERSONAL' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-500 font-bold w-fit">
                                {g.type === 'SHORT_TERM' ? 'Ngắn hạn' : g.type === 'MEDIUM_TERM' ? 'Trung hạn' : 'Dài hạn'}
                              </span>
                            )}
                          </div>

                        </div>
                      </div>

                      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button onClick={() => { setEditingGoal(g); setIsGoalModalOpen(true); }} className="p-1.5 bg-white rounded-lg text-gray-400 hover:text-indigo-600 shadow-sm transition-colors border border-gray-100"><Edit2 size={14} /></button>
                        <button onClick={() => onDeleteGoal(g.id)} className="p-1.5 bg-white rounded-lg text-gray-400 hover:text-red-600 shadow-sm transition-colors border border-gray-100"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {renderTodos()}

        </div>

        {/* --- MODALS --- */}

        {/* Goal Modal */}
        {isGoalModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-gray-800">{editingGoal ? 'Sửa mục tiêu' : 'Mục tiêu mới'}</h3>
                <button onClick={() => setIsGoalModalOpen(false)}><X size={20} className="text-gray-400" /></button>
              </div>
              <form onSubmit={handleGoalSubmit} className="space-y-4">
                <input name="title" required defaultValue={editingGoal?.title} placeholder="Tên mục tiêu" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none font-medium" />
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold ml-1">Hạn chót</label>
                  <input type="date" name="deadline" required defaultValue={editingGoal?.deadline} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold ml-1">Loại thời hạn</label>
                  <select name="type" defaultValue={editingGoal?.type || 'SHORT_TERM'} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none text-sm">
                    <option value="SHORT_TERM">Ngắn hạn</option>
                    <option value="MEDIUM_TERM">Trung hạn</option>
                    <option value="LONG_TERM">Dài hạn</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 p-1">
                  <input type="checkbox" name="is_priority" id="is_priority" defaultChecked={editingGoal?.is_priority} className="w-5 h-5 accent-indigo-600 rounded cursor-pointer" />
                  <label htmlFor="is_priority" className="text-sm font-bold text-gray-700 cursor-pointer">Đánh dấu quan trọng/ưu tiên</label>
                </div>

                <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 mt-2">Lưu Mục Tiêu</button>
              </form>
            </div>
          </div>
        )}

        {/* Time Modal */}
        {isTimeModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-gray-800">{editingEvent ? 'Sửa lịch' : 'Thêm lịch mới'}</h3>
                <button onClick={() => setIsTimeModalOpen(false)}><X size={20} className="text-gray-400" /></button>
              </div>
              <form onSubmit={handleTimeSubmit} className="space-y-4">
                <input name="title" required defaultValue={editingEvent?.title} placeholder="Tên sự kiện" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none font-medium" />
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold ml-1">Thứ trong tuần</label>
                  <select name="day_of_week" defaultValue={editingEvent?.day_of_week ?? 1} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none text-sm">
                    {DISPLAY_DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 uppercase font-bold ml-1">Bắt đầu</label>
                    <input type="time" name="start_time" required defaultValue={editingEvent?.start_time} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase font-bold ml-1">Kết thúc</label>
                    <input type="time" name="end_time" defaultValue={editingEvent?.end_time} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" />
                  </div>
                </div>
                <input name="location" defaultValue={editingEvent?.location} placeholder="Địa điểm (Tùy chọn)" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none" />

                <div className="flex gap-3 mt-2">
                  {editingEvent && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Bạn có chắc chắn muốn xóa lịch này không?')) {
                          onDeleteTimetable(editingEvent.id);
                          setIsTimeModalOpen(false);
                        }
                      }}
                      className="flex-1 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors"
                    >
                      Xóa
                    </button>
                  )}
                  <button type="submit" className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700">
                    {editingEvent ? 'Cập nhật' : 'Lưu mới'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}



      </div>
    </div>
  );
};

export default ScheduleDashboard;
