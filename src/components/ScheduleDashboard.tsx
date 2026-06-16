import React, { useState, useEffect, useMemo } from 'react';
import { AppState, TimetableEvent, Goal, Todo, TodoStatus } from '../types';
import { Calendar, Clock, Target, Plus, Trash2, Edit2, X, MapPin, Star, ChevronDown, ChevronUp, Download, CheckCircle, RefreshCw, BarChart2, ListTodo, LayoutGrid, Settings } from 'lucide-react';
import html2canvas from 'html2canvas';
import CalendarWidget from './CalendarWidget';
import MusicSpace from './MusicSpace';

// Import our new tracker widgets
import { KanbanBoard } from './tracker/KanbanBoard';
import { PomodoroWidget } from './tracker/PomodoroWidget';
import { BookmarkWidget } from './tracker/BookmarkWidget';
import { HabitsWidget } from './tracker/HabitsWidget';
import { QuickNotesWidget } from './tracker/QuickNotesWidget';
import ConfirmModal from './ConfirmModal';

interface ScheduleDashboardProps {
  state: AppState;
  onAddGoal: (g: any) => void;
  onUpdateGoal: (g: any) => void;
  onDeleteGoal: (id: string) => void;
  onAddTimetable: (t: any) => void;
  onUpdateTimetable: (t: any) => void;
  onDeleteTimetable: (id: string) => void;
  onAddTodo: (content: string, priority: any, deadline?: string, status?: TodoStatus, description?: string, subtasks?: any[]) => void;
  onUpdateTodo: (t: any) => void;
  onDeleteTodo: (id: string) => void;
  onReorderTodos: (reordered: Todo[]) => void;
  onMoveTodoStatus: (id: string, status: TodoStatus) => void;
  initialFocusMode?: boolean;
  onResetFocusMode?: () => void;
  activeTaskId?: string | null;
  onStartTracking?: (todo: Todo) => void;
  onRefresh?: () => Promise<void>;
}

const DISPLAY_DAYS = [
  { value: 1, label: 'Thứ 2' },
  { value: 2, label: 'Thứ 3' },
  { value: 3, label: 'Thứ 4' },
  { value: 4, label: 'Thứ 5' },
  { value: 5, label: 'Thứ 6' },
  { value: 6, label: 'Thứ 7' },
  { value: 0, label: 'Chủ Nhật' },
];

const COLUMNS: { id: TodoStatus; label: string; bg: string; border: string; dot: string; text: string }[] = [
  { id: 'backlog', label: 'Backlog', bg: 'bg-slate-50/70', border: 'border-slate-200', dot: 'bg-slate-400', text: 'text-slate-700' },
  { id: 'todo', label: 'Todo', bg: 'bg-blue-50/40', border: 'border-blue-100', dot: 'bg-blue-500', text: 'text-blue-700' },
  { id: 'doing', label: 'Doing', bg: 'bg-amber-50/40', border: 'border-amber-100', dot: 'bg-amber-500', text: 'text-amber-700' },
  { id: 'done', label: 'Done', bg: 'bg-emerald-50/40', border: 'border-emerald-100', dot: 'bg-emerald-500', text: 'text-emerald-700' },
];

const ScheduleDashboard: React.FC<ScheduleDashboardProps> = ({
  state,
  onAddGoal, onUpdateGoal, onDeleteGoal,
  onAddTodo, onUpdateTodo, onDeleteTodo, onReorderTodos, onMoveTodoStatus,
  initialFocusMode = false, onResetFocusMode,
  onAddTimetable, onUpdateTimetable, onDeleteTimetable,
  activeTaskId = null,
  onStartTracking = () => {},
  onRefresh,
}) => {
  const { timetable, goals, todos } = state;
  const { timer, onOpenMusic } = state as any;

  // View state: 'board' (Kanban) or 'list' (Calendar Grid view for todos)
  const [todoView, setTodoView] = useState<'board' | 'list'>(() => {
    const saved = localStorage.getItem(`smartlife_todo_view_${state.profile?.id}`);
    return (saved === 'board' || saved === 'list') ? saved : 'board';
  });

  const [isFocusMode, setIsFocusMode] = useState(false);

  // Accordion collapses
  const [isTimetableCollapsed, setIsTimetableCollapsed] = useState(true);
  const [isRoadmapCollapsed, setIsRoadmapCollapsed] = useState(true);
  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState(true);
  const [isGoalsCollapsed, setIsGoalsCollapsed] = useState(true);

  // Pull to Refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = React.useRef(0);
  const isDragging = React.useRef(false);

  // Unified Task creation/edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [todoToDeleteId, setTodoToDeleteId] = useState<string | null>(null);

  const [modalContent, setModalContent] = useState('');
  const [modalStatus, setModalStatus] = useState<TodoStatus>('todo');
  const [modalDeadline, setModalDeadline] = useState('');
  const [modalDescription, setModalDescription] = useState('');
  const [modalSubtasks, setModalSubtasks] = useState<{ id: string; title: string; is_completed: boolean }[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Calendar states
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Goals/Timetable dialog states
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalFilter, setGoalFilter] = useState<'ALL' | 'PRIORITY' | 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM'>('ALL');

  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimetableEvent | null>(null);
  const timetableRef = React.useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Save view state preference
  useEffect(() => {
    if (state.profile?.id) {
      localStorage.setItem(`smartlife_todo_view_${state.profile.id}`, todoView);
    }
  }, [todoView, state.profile?.id]);

  // Handle focus mode triggers
  useEffect(() => {
    if (initialFocusMode) {
      setIsFocusMode(true);
      onResetFocusMode?.();
    }
  }, [initialFocusMode, onResetFocusMode]);

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
    setTimeout(async () => {
      try {
        if (!timetableRef.current) return;
        const canvas = await html2canvas(timetableRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          allowTaint: true,
        } as any);

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

  const handleGoalSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      title: fd.get('title'),
      deadline: fd.get('deadline'),
      type: fd.get('type'),
      is_priority: fd.get('is_priority') === 'on',
    };
    if (editingGoal) onUpdateGoal({ ...editingGoal, ...data });
    else onAddGoal(data);
    setIsGoalModalOpen(false);
  };

  const handleTimeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
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

  // Open Unified Modal for Creation
  const handleOpenCreateModal = (status?: TodoStatus, defaultDate?: Date) => {
    setModalMode('create');
    setSelectedTodo(null);
    setModalContent('');
    setModalStatus(status || 'todo');
    setModalDescription('');
    setModalSubtasks([]);
    setNewSubtaskTitle('');

    if (defaultDate) {
      const year = defaultDate.getFullYear();
      const month = String(defaultDate.getMonth() + 1).padStart(2, '0');
      const day = String(defaultDate.getDate()).padStart(2, '0');
      // Set to 08:00 of selected date
      setModalDeadline(`${year}-${month}-${day}T08:00`);
    } else {
      setModalDeadline('');
    }
    setIsModalOpen(true);
  };

  // Open Unified Modal for Editing
  const handleOpenEditModal = (todo: Todo) => {
    setModalMode('edit');
    setSelectedTodo(todo);
    setModalContent(todo.content);
    setModalStatus(todo.status || (todo.is_completed ? 'done' : 'todo'));
    setModalDescription(todo.description || '');
    setModalSubtasks(todo.subtasks || []);
    setNewSubtaskTitle('');

    if (todo.deadline) {
      const d = new Date(todo.deadline);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      setModalDeadline(`${year}-${month}-${day}T${hours}:${minutes}`);
    } else {
      setModalDeadline('');
    }
    setIsModalOpen(true);
  };

  // Subtask Actions inside Modal
  const handleCreateSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const newSub = {
      id: crypto.randomUUID(),
      title: newSubtaskTitle.trim(),
      is_completed: false,
    };
    setModalSubtasks([...modalSubtasks, newSub]);
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = (id: string) => {
    setModalSubtasks(
      modalSubtasks.map((st) => (st.id === id ? { ...st, is_completed: !st.is_completed } : st))
    );
  };

  const handleDeleteSubtask = (id: string) => {
    setModalSubtasks(modalSubtasks.filter((st) => st.id !== id));
  };

  // Modal Save & Delete Submissions
  const handleModalSave = () => {
    if (!modalContent.trim()) return;

    const formattedDeadline = modalDeadline ? new Date(modalDeadline).toISOString() : undefined;

    if (modalMode === 'create') {
      onAddTodo(
        modalContent.trim(),
        'medium',
        formattedDeadline,
        modalStatus,
        modalDescription.trim() || undefined,
        modalSubtasks
      );
    } else if (modalMode === 'edit' && selectedTodo) {
      onUpdateTodo({
        ...selectedTodo,
        content: modalContent.trim(),
        status: modalStatus,
        deadline: formattedDeadline || null,
        description: modalDescription.trim() || null,
        subtasks: modalSubtasks,
      });
    }
    setIsModalOpen(false);
  };

  const handleModalDelete = () => {
    if (modalMode === 'edit' && selectedTodo) {
      setTodoToDeleteId(selectedTodo.id);
      setIsModalOpen(false);
    }
  };

  const filteredGoals = goals.filter(g => {
    if (goalFilter === 'ALL') return true;
    if (goalFilter === 'PRIORITY') return g.is_priority;
    return g.type === goalFilter;
  });

  // Calendar dates logic
  const daysInMonth = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Shift first day index so 0 is Mon, 6 is Sun
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const days = [];
    // Empty cells for leading offset
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    // Days of month
    for (let d = 1; d <= totalDays; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [calendarDate]);

  const getTodosForDate = (date: Date) => {
    const targetStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return todos.filter((t) => {
      if (!t.deadline) return false;
      const d = new Date(t.deadline);
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return dStr === targetStr;
    });
  };

  const getStatusConfig = (status?: TodoStatus, isCompleted?: boolean) => {
    const s = status || (isCompleted ? 'done' : 'todo');
    return COLUMNS.find((col) => col.id === s) || COLUMNS[1];
  };

  const handleMonthPrev = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };

  const handleMonthNext = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };

  // Render weekly timetable grid
  const renderTimetableGrid = () => {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
          <div>
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Calendar className="text-indigo-600 w-4 h-4" />
              Thời khóa biểu tuần cố định
            </h4>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportTimetable}
              className="px-3 py-1.5 text-xs bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition font-bold flex items-center gap-1.5"
            >
              <Download size={14} />
              Tải ảnh lịch
            </button>
            <button onClick={() => { setEditingEvent(null); setIsTimeModalOpen(true); }} className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition font-bold flex items-center gap-1.5">
              <Plus size={14} />
              Thêm lịch mới
            </button>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <div className="grid grid-cols-7 min-h-[450px] min-w-[850px] divide-x divide-slate-100 bg-white" ref={timetableRef}>
            {DISPLAY_DAYS.map((day) => {
              const dayEvents = timetable.filter(e => e.day_of_week === day.value).sort((a, b) => a.start_time.localeCompare(b.start_time));
              const isToday = new Date().getDay() === day.value;

              return (
                <div key={day.value} className={`flex flex-col h-full ${isToday ? 'bg-indigo-50/15' : ''}`}>
                  <div className={`text-center py-3 border-b border-slate-100 ${isToday ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-50/80 text-slate-600'}`}>
                    <span className="text-xs tracking-wide">{day.label}</span>
                  </div>
                  <div className="p-2.5 space-y-2.5 flex-1">
                    {dayEvents.map(e => (
                      <div
                        key={e.id}
                        onClick={() => { setEditingEvent(e); setIsTimeModalOpen(true); }}
                        className={`relative group p-2.5 rounded-xl border border-slate-150 shadow-sm cursor-pointer transition-all hover:-translate-y-0.5 bg-white hover:border-indigo-400`}
                      >
                        <div className="font-bold text-slate-800 text-xs leading-snug mb-1">{e.title}</div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock size={10} />
                          <span>{e.start_time.slice(0, 5)} - {e.end_time?.slice(0, 5)}</span>
                        </div>
                        {e.location && (
                          <div className="flex items-center gap-1 text-[9px] text-slate-400 mt-1">
                            <MapPin size={10} /> {e.location}
                          </div>
                        )}
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteTimetable(e.id);
                          }}
                          className="absolute top-1 right-1 p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Render roadmap timeline today
  const renderRoadmapTimeline = () => {
    const todayIndex = new Date().getDay();
    const todayEvents = timetable
      .filter(t => t.day_of_week === todayIndex)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-5 mt-4">
        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-4">
          <Clock size={16} className="text-indigo-600 animate-pulse" />
          Tiến trình hoạt động hôm nay
        </h4>

        {todayEvents.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            Không có lịch trình cố định cho ngày hôm nay.
          </div>
        ) : (
          <div className="relative pl-3 space-y-6 before:absolute before:inset-0 before:left-3 before:-translate-x-px before:h-full before:w-0.5 before:bg-indigo-100">
            {todayEvents.map((event) => {
              const isPast = event.end_time ? event.end_time < currentTime : event.start_time < currentTime;
              const isHappening = event.start_time <= currentTime && (!event.end_time || event.end_time >= currentTime);

              return (
                <div key={event.id} className="relative flex items-start gap-4">
                  {/* Bullet Node */}
                  <div className={`absolute left-0 flex items-center justify-center w-6 h-6 -translate-x-1/2 rounded-full border-2 shadow-sm z-10 ${
                    isHappening ? 'bg-indigo-600 border-white ring-4 ring-indigo-100' : isPast ? 'bg-slate-200 border-white' : 'bg-white border-indigo-300'
                  }`}>
                    {isHappening ? <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" /> : <div className={`w-1.5 h-1.5 rounded-full ${isPast ? 'bg-slate-400' : 'bg-indigo-400'}`} />}
                  </div>

                  {/* Activity Card */}
                  <div className="flex-1 ml-6 p-3 rounded-2xl border border-slate-100 bg-white">
                    <div className="flex justify-between items-center mb-0.5">
                      <h5 className="text-xs font-bold text-slate-800">{event.title}</h5>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">
                        {event.start_time.slice(0, 5)}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {event.start_time.slice(0, 5)} - {event.end_time?.slice(0, 5)} {event.location && `· ${event.location}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="w-full max-w-none min-h-screen px-0 py-2 md:py-3 pt-16 md:pt-3 relative"
    >
      {/* Pull To Refresh Indicator */}
      {pullDistance > 0 && (
        <div className="absolute left-0 right-0 flex justify-center z-50 pointer-events-none transition-all duration-75" style={{ top: `${pullDistance}px` }}>
          <div className="bg-white p-2.5 rounded-full shadow-lg border border-slate-100 flex items-center gap-2">
            <RefreshCw size={14} className={`text-indigo-600 ${isRefreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${pullDistance * 4}deg)` }} />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
              {isRefreshing ? 'Đang cập nhật...' : 'Kéo thêm để tải lại'}
            </span>
          </div>
        </div>
      )}



      {/* Widget Dashboard layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,330px)] gap-3 md:gap-4 items-stretch w-full max-w-none">
        
        {/* Left Column (Flex-grow width on desktop) */}
        <div className="flex flex-col gap-3 md:gap-4 w-full">
          {/* Kanban / Calendar Card Container */}
          <div className="bg-white rounded-3xl border border-slate-100 p-2.5 flex flex-col h-fit">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3.5 pb-2.5 border-b border-slate-50 select-none">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <ListTodo size={16} className="text-slate-700" />
                Todo
              </h3>
              
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* View switcher: Board / Lịch */}
                <div className="flex bg-slate-100 p-0.5 rounded-full">
                  <button
                    onClick={() => setTodoView('board')}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold tracking-wide transition-all flex items-center gap-1.5 ${
                      todoView === 'board' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-750'
                    }`}
                  >
                    <LayoutGrid size={12} />
                    Board
                  </button>
                  <button
                    onClick={() => setTodoView('list')}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold tracking-wide transition-all flex items-center gap-1.5 ${
                      todoView === 'list' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-755'
                    }`}
                  >
                    <Calendar size={12} />
                    Lịch
                  </button>
                </div>

                {/* + Thêm task button */}
                <button
                  onClick={() => handleOpenCreateModal('todo')}
                  className="bg-black hover:bg-slate-900 text-white font-extrabold text-[10px] px-3.5 py-1.5 rounded-full flex items-center gap-1 transition-all duration-200 active:scale-95 shrink-0"
                >
                  <Plus size={12} className="stroke-[3]" />
                  Thêm task
                </button>
              </div>
            </div>

            {/* Content view render */}
            {todoView === 'board' ? (
              <KanbanBoard
                todos={todos}
                onMoveTodoStatus={onMoveTodoStatus}
                onReorderTodos={onReorderTodos}
                onEditTodo={handleOpenEditModal}
                onDeleteTodo={(id) => setTodoToDeleteId(id)}
                onQuickAddTodo={(status) => handleOpenCreateModal(status)}
              />
            ) : (
              // Calendar Monthly view of Todos
              <div className="flex-1 flex flex-col min-h-[400px]">
                {/* Calendar View Month Navigation */}
                <div className="flex justify-between items-center mb-4 select-none">
                  <span className="text-xs font-black text-slate-850 uppercase tracking-wider">
                    {`Tháng ${calendarDate.getMonth() + 1} ${calendarDate.getFullYear()}`}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={handleMonthPrev}
                      className="w-7 h-7 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-lg border border-slate-100 transition-colors font-bold text-xs"
                    >
                      &lt;
                    </button>
                    <button
                      onClick={handleMonthNext}
                      className="w-7 h-7 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-lg border border-slate-100 transition-colors font-bold text-xs"
                    >
                      &gt;
                    </button>
                  </div>
                </div>

                {/* Calendar Grid Container with scroll */}
                <div className="overflow-y-auto max-h-[480px] custom-scrollbar pr-0.5">
                  <div className="grid grid-cols-7 gap-1 md:gap-1.5 text-center mb-1 select-none">
                    {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(h => (
                      <span key={h} className="text-[10px] font-black text-slate-400 tracking-wider py-1 uppercase">{h}</span>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1 md:gap-1.5">
                    {daysInMonth.map((day, idx) => {
                      if (!day) {
                        return <div key={`empty-${idx}`} className="bg-slate-50/20 rounded-2xl min-h-[75px] md:min-h-[85px] border border-transparent" />;
                      }

                      const dateTodos = getTodosForDate(day);
                      const isToday = new Date().toLocaleDateString() === day.toLocaleDateString();

                      return (
                        <div
                          key={day.toISOString()}
                          onClick={() => handleOpenCreateModal('todo', day)}
                          className={`min-h-[75px] md:min-h-[85px] rounded-2xl p-1.5 border flex flex-col items-start gap-1 cursor-pointer transition-all duration-200 ${
                            isToday
                              ? 'bg-slate-50 border-slate-350 shadow-sm ring-1 ring-slate-200'
                              : 'bg-slate-50/40 border-slate-100/40 hover:bg-slate-50 hover:border-slate-200'
                          }`}
                        >
                          {/* Day number */}
                          <span className={`text-[10px] font-extrabold flex items-center justify-center ${
                            isToday
                              ? 'w-5 h-5 bg-slate-600 text-white rounded-full text-[9px] font-black shadow-sm'
                              : 'text-slate-500 pl-1'
                          }`}>
                            {day.getDate()}
                          </span>

                          {/* Day Todo list strips */}
                          <div className="w-full flex-1 flex flex-col gap-0.5 overflow-hidden">
                            {dateTodos.slice(0, 3).map(t => {
                              const sConf = getStatusConfig(t.status, t.is_completed);
                              return (
                                <div
                                  key={t.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditModal(t);
                                  }}
                                  className={`text-[8px] md:text-[9px] font-bold px-1 py-0.5 rounded-md border truncate leading-tight transition-all active:scale-95 ${sConf.bg} ${sConf.border} ${sConf.text} ${t.is_completed ? 'line-through opacity-70' : ''}`}
                                  title={t.content}
                                >
                                  {t.content}
                                </div>
                              );
                            })}
                            {dateTodos.length > 3 && (
                              <span className="text-[7.5px] font-extrabold text-slate-400 pl-1 mt-0.5">
                                +{dateTodos.length - 3} thẻ nữa
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bookmarks and Habits widgets side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 items-stretch">
            <BookmarkWidget userId={state.profile?.id || ''} />
            <HabitsWidget userId={state.profile?.id || ''} />
          </div>
        </div>

        {/* Right Column (Stable sidebar width on desktop) */}
        <div className="flex flex-col gap-3 md:gap-4 w-full">
          <PomodoroWidget timer={timer} onOpenMusic={onOpenMusic} />
          <div className="flex-1">
            <QuickNotesWidget userId={state.profile?.id || ''} />
          </div>
        </div>

      </div>

      {/* Accordions bottom section: Weekly Timetable, Daily Roadmap, Goals, Calendar */}
      <div className="mt-8 space-y-4">
        {/* Weekly Timetable accordion */}
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
          <button
            onClick={() => setIsTimetableCollapsed(!isTimetableCollapsed)}
            className="w-full px-5 py-4 flex items-center justify-between font-bold text-slate-800 text-sm hover:bg-slate-50 transition-colors bg-white border-b border-transparent"
          >
            <span className="flex items-center gap-2">
              <Calendar size={16} className="text-slate-700" />
              Thời khóa biểu tuần cố định
            </span>
            {isTimetableCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          {!isTimetableCollapsed && (
            <div className="p-5 pt-0 border-t border-slate-50 animate-in fade-in duration-250 bg-slate-50/20">
              <div className="pt-4">
                {renderTimetableGrid()}
              </div>
            </div>
          )}
        </div>

        {/* Daily activity roadmap accordion */}
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
          <button
            onClick={() => setIsRoadmapCollapsed(!isRoadmapCollapsed)}
            className="w-full px-5 py-4 flex items-center justify-between font-bold text-slate-800 text-sm hover:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Clock size={16} className="text-slate-700" />
              Lịch trình sự kiện hôm nay
            </span>
            {isRoadmapCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          {!isRoadmapCollapsed && (
            <div className="p-5 pt-0 border-t border-slate-50 animate-in fade-in duration-250 bg-slate-50/20">
              {renderRoadmapTimeline()}
            </div>
          )}
        </div>

        {/* Monthly Calendar accordion */}
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
          <button
            onClick={() => setIsCalendarCollapsed(!isCalendarCollapsed)}
            className="w-full px-5 py-4 flex items-center justify-between font-bold text-slate-800 text-sm hover:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Calendar size={16} className="text-slate-700" />
              Lịch biểu tháng chi tiết
            </span>
            {isCalendarCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          {!isCalendarCollapsed && (
            <div className="p-5 pt-0 border-t border-slate-50 animate-in fade-in duration-250 bg-slate-50/20">
              <div className="pt-4">
                <CalendarWidget />
              </div>
            </div>
          )}
        </div>

        {/* Goals accordion */}
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
          <button
            onClick={() => setIsGoalsCollapsed(!isGoalsCollapsed)}
            className="w-full px-5 py-4 flex items-center justify-between font-bold text-slate-800 text-sm hover:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Target size={16} className="text-slate-700" />
              Mục tiêu học tập & cá nhân
            </span>
            {isGoalsCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          {!isGoalsCollapsed && (
            <div className="p-5 pt-0 border-t border-slate-50 animate-in fade-in duration-250 bg-slate-50/20">
              <div className="pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-slate-850 text-xs">Mục tiêu của tôi</h4>
                  <button
                    onClick={() => { setEditingGoal(null); setIsGoalModalOpen(true); }}
                    className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-xl hover:bg-indigo-100 transition"
                  >
                    + Mới
                  </button>
                </div>

                {/* Goal Filter Buttons */}
                <div className="flex gap-1 overflow-x-auto pb-2 mb-3 scrollbar-hide">
                  {['ALL', 'PRIORITY', 'SHORT_TERM', 'MEDIUM_TERM', 'LONG_TERM'].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setGoalFilter(filter as any)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                        goalFilter === filter
                          ? 'bg-amber-50 border-amber-200 text-amber-700 font-extrabold'
                          : 'bg-white border-slate-150 text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      {filter === 'ALL' ? 'Tất cả' : filter === 'PRIORITY' ? 'Ưu tiên' : filter === 'SHORT_TERM' ? 'Ngắn hạn' : filter === 'MEDIUM_TERM' ? 'Trung' : 'Dài'}
                    </button>
                  ))}
                </div>

                {/* Goals list */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {filteredGoals.length === 0 ? (
                    <p className="text-center text-slate-400 text-xs py-4 italic">Chưa có mục tiêu trong danh mục này.</p>
                  ) : (
                    filteredGoals.map(g => {
                      const timeLeft = getTimeRemaining(g.deadline);
                      const currentStatus = g.status || (g.progress === 100 ? 'COMPLETED' : 'NOT_STARTED');

                      return (
                        <div key={g.id} className="relative group p-3 rounded-xl border border-slate-100 hover:border-slate-350 bg-slate-50/50 hover:bg-white transition-all">
                          <div className="flex justify-between items-start pr-1">
                            <div>
                              <div className="flex items-center gap-1.5">
                                {g.is_priority && <Star size={12} className="text-amber-500 fill-amber-500 shrink-0" />}
                                <span className="font-bold text-slate-700 text-xs">{g.title}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 mt-1">Hạn chót: {new Date(g.deadline).toLocaleDateString('vi-VN')}</div>
                            </div>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${timeLeft.color}`}>
                              {timeLeft.text}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/50">
                            <button 
                              onClick={() => {
                                let nextStatus: any = 'NOT_STARTED';
                                if (currentStatus === 'NOT_STARTED') nextStatus = 'IN_PROGRESS';
                                else if (currentStatus === 'IN_PROGRESS') nextStatus = 'COMPLETED';
                                onUpdateGoal({ ...g, status: nextStatus });
                              }}
                              className={`text-[9px] px-2 py-0.5 rounded font-bold border transition-colors ${
                                currentStatus === 'COMPLETED'
                                  ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                                  : currentStatus === 'IN_PROGRESS'
                                    ? 'bg-blue-50 border-blue-100 text-blue-600'
                                    : 'bg-slate-100 border-slate-200 text-slate-500'
                              }`}
                            >
                              {currentStatus === 'COMPLETED' ? 'Hoàn thành' : currentStatus === 'IN_PROGRESS' ? 'Đang chạy' : 'Chưa chạy'}
                            </button>
                            
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5">
                              <button onClick={() => { setEditingGoal(g); setIsGoalModalOpen(true); }} className="p-0.5 text-slate-400 hover:text-indigo-600"><Edit2 size={11} /></button>
                              <button onClick={() => onDeleteGoal(g.id)} className="p-0.5 text-slate-400 hover:text-red-500"><Trash2 size={11} /></button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Music Player space */}
      {isFocusMode && (
        <MusicSpace
          timer={timer}
          onBack={() => setIsFocusMode(false)}
          formatTime={(s: number) => {
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = s % 60;
            if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
            return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
          }}
          todos={todos}
          activeTaskId={activeTaskId}
          onUpdateTodo={onUpdateTodo}
          onStartTracking={onStartTracking}
          onAddTodo={onAddTodo}
        />
      )}

      {/* MODALS: Goal creation modal */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-slate-800 text-base">{editingGoal ? 'Chỉnh sửa mục tiêu' : 'Mục tiêu học tập mới'}</h3>
              <button onClick={() => setIsGoalModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={handleGoalSubmit} className="space-y-4">
              <div>
                <input
                  name="title"
                  required
                  defaultValue={editingGoal?.title}
                  placeholder="Tên mục tiêu..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl outline-none font-semibold text-xs focus:ring-1 focus:ring-indigo-400 bg-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Hạn chót</label>
                <input
                  type="date"
                  name="deadline"
                  required
                  defaultValue={editingGoal?.deadline}
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl outline-none font-semibold text-xs focus:ring-1 focus:ring-indigo-400 bg-white text-slate-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Loại thời hạn</label>
                <select
                  name="type"
                  defaultValue={editingGoal?.type || 'SHORT_TERM'}
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl outline-none font-semibold text-xs focus:ring-1 focus:ring-indigo-400 bg-white text-slate-600"
                >
                  <option value="SHORT_TERM">Ngắn hạn (tuần)</option>
                  <option value="MEDIUM_TERM">Trung hạn (tháng)</option>
                  <option value="LONG_TERM">Dài hạn (học kỳ)</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" name="is_priority" id="is_priority" defaultChecked={editingGoal?.is_priority} className="w-4.5 h-4.5 accent-indigo-600 rounded cursor-pointer" />
                <label htmlFor="is_priority" className="text-xs font-bold text-slate-600 cursor-pointer">Đánh dấu ưu tiên cao</label>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsGoalModalOpen(false)} className="flex-1 py-3 border border-slate-200 rounded-2xl text-slate-500 hover:bg-slate-50 font-bold text-xs">Hủy</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 font-bold text-xs shadow-sm hover:shadow active:scale-95 transition-all">Lưu mục tiêu</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALS: Weekly timetable event creation modal */}
      {isTimeModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-slate-800 text-base">{editingEvent ? 'Chỉnh sửa sự kiện' : 'Thêm lịch biểu cố định'}</h3>
              <button onClick={() => setIsTimeModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={handleTimeSubmit} className="space-y-4">
              <div>
                <input
                  name="title"
                  required
                  defaultValue={editingEvent?.title}
                  placeholder="Tên môn học / công việc..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl outline-none font-semibold text-xs focus:ring-1 focus:ring-indigo-400 bg-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Thứ tự lặp lại</label>
                <select
                  name="day_of_week"
                  defaultValue={editingEvent?.day_of_week ?? 1}
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl outline-none font-semibold text-xs focus:ring-1 focus:ring-indigo-400 bg-white text-slate-600"
                >
                  {DISPLAY_DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Bắt đầu</label>
                  <input
                    type="time"
                    name="start_time"
                    required
                    defaultValue={editingEvent?.start_time}
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl outline-none font-semibold text-xs focus:ring-1 focus:ring-indigo-400 bg-white text-slate-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Kết thúc</label>
                  <input
                    type="time"
                    name="end_time"
                    defaultValue={editingEvent?.end_time}
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl outline-none font-semibold text-xs focus:ring-1 focus:ring-indigo-400 bg-white text-slate-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Địa điểm</label>
                <input
                  name="location"
                  defaultValue={editingEvent?.location}
                  placeholder="Phòng học / online link..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl outline-none font-semibold text-xs focus:ring-1 focus:ring-indigo-400 bg-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsTimeModalOpen(false)} className="flex-1 py-3 border border-slate-200 rounded-2xl text-slate-500 hover:bg-slate-50 font-bold text-xs">Hủy</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 font-bold text-xs shadow-sm hover:shadow active:scale-95 transition-all">Lưu lịch trình</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UNIFIED TASK CREATION/DETAIL MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200 relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4 select-none pb-2">
              <span className="text-sm font-black text-slate-800">
                {modalMode === 'edit' ? 'Chi tiết công việc' : 'Tạo công việc mới'}
              </span>
              <div className="flex items-center gap-1.5">
                {modalMode === 'edit' && (
                  <button
                    type="button"
                    onClick={handleModalDelete}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-full transition-colors"
                    title="Xóa công việc"
                  >
                    <Trash2 size={17} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Status Pills Selection */}
            <div className="flex gap-1.5 mb-5 select-none flex-wrap">
              {COLUMNS.map((col) => {
                const isActive = modalStatus === col.id;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setModalStatus(col.id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold transition-all flex items-center gap-1.5 border leading-none ${
                      isActive
                        ? col.id === 'todo'
                          ? 'bg-blue-600 border-blue-600 text-white font-black shadow-sm'
                          : col.id === 'doing'
                          ? 'bg-orange-500 border-orange-500 text-white font-black shadow-sm'
                          : col.id === 'done'
                          ? 'bg-emerald-600 border-emerald-600 text-white font-black shadow-sm'
                          : 'bg-slate-600 border-slate-600 text-white font-black shadow-sm'
                        : 'bg-slate-50 border-slate-200/80 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : col.dot}`} />
                    {col.label}
                  </button>
                );
              })}
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Title Input */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">
                  TIÊU ĐỀ
                </label>
                <input
                  type="text"
                  value={modalContent}
                  onChange={(e) => setModalContent(e.target.value)}
                  placeholder="Tên task..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400 text-xs font-bold bg-white text-slate-800"
                  required
                />
              </div>

              {/* Deadline Input */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">
                  HẠN CHÓT
                </label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={modalDeadline}
                    onChange={(e) => setModalDeadline(e.target.value)}
                    className="w-full pl-3.5 pr-9 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400 text-xs text-slate-650 bg-white font-semibold"
                  />
                  {modalDeadline && (
                    <button
                      type="button"
                      onClick={() => setModalDeadline('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                      title="Xóa hạn chót"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Description Input */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">
                  MÔ TẢ
                </label>
                <textarea
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  placeholder="Thêm chi tiết (không bắt buộc)..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400 text-xs font-semibold bg-slate-50/50 text-slate-750 resize-none h-20"
                />
              </div>

              {/* Subtasks (Checklist) Input & List */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">
                  VIỆC CẦN LÀM
                </label>
                
                {/* Subtask list */}
                {modalSubtasks.length > 0 && (
                  <div className="space-y-1.5 mb-3 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                    {modalSubtasks.map((st) => (
                      <div key={st.id} className="group flex items-center justify-between p-2.5 bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-100 transition-all">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={st.is_completed}
                            onChange={() => handleToggleSubtask(st.id)}
                            className="w-4 h-4 accent-slate-800 rounded cursor-pointer shrink-0"
                          />
                          <span className={`text-xs font-bold truncate ${st.is_completed ? 'line-through text-slate-400' : 'text-slate-705'}`}>
                            {st.title}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteSubtask(st.id)}
                          className="p-1 hover:bg-slate-200 text-slate-400 hover:text-rose-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Xóa việc cần làm"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Subtask Inline Input */}
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Thêm việc cần làm..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateSubtask();
                      }
                    }}
                    className="flex-1 p-2.5 text-xs rounded-xl border border-slate-150 focus:outline-none focus:ring-1 focus:ring-slate-350 bg-slate-50/50 placeholder-slate-400 font-medium text-slate-700"
                  />
                  <button
                    type="button"
                    onClick={handleCreateSubtask}
                    className="w-8 h-8 rounded-full bg-black hover:bg-slate-900 text-white flex items-center justify-center transition-all duration-200 active:scale-90 shrink-0"
                  >
                    <Plus size={14} className="stroke-[3]" />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3 border-t border-slate-100 mt-2 select-none">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold text-xs rounded-2xl hover:bg-slate-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleModalSave}
                  disabled={!modalContent.trim()}
                  className="flex-1 py-3 bg-black hover:bg-slate-900 text-white font-bold text-xs rounded-2xl transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {modalMode === 'create' ? 'Thêm task' : 'Lưu thay đổi'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {todoToDeleteId !== null && (
        <ConfirmModal
          isOpen={todoToDeleteId !== null}
          title="Xác nhận xóa nhiệm vụ"
          message="Bạn có chắc chắn muốn xóa nhiệm vụ này không? Hành động này không thể hoàn tác."
          confirmText="Xóa"
          cancelText="Hủy"
          onConfirm={() => {
            if (todoToDeleteId) {
              onDeleteTodo(todoToDeleteId);
              setTodoToDeleteId(null);
            }
          }}
          onCancel={() => setTodoToDeleteId(null)}
        />
      )}
    </div>
  );
};

export default ScheduleDashboard;
