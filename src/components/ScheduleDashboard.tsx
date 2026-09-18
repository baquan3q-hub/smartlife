import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AppState, TimetableEvent, Goal, Todo, TodoStatus, TaskLink, parseTaskLinks, encodeTaskLinks } from '../types';
import { Calendar, Clock, Target, Plus, Trash2, Edit2, X, MapPin, Star, ChevronDown, ChevronUp, Download, CheckCircle, RefreshCw, BarChart2, ListTodo, LayoutGrid, Settings, Paperclip, Upload, Eye, ExternalLink, Link2, Sparkles } from 'lucide-react';
import html2canvas from 'html2canvas';
import MusicSpace from './MusicSpace';
import { TaskAttachment, saveAttachment, getAttachments, deleteAttachment, downloadAttachment, formatFileSize, getFileIcon, isPreviewable } from '../services/taskAttachmentService';

// Import our new tracker widgets
import { KanbanBoard } from './tracker/KanbanBoard';
import { PomodoroWidget } from './tracker/PomodoroWidget';
import { BookmarkWidget } from './tracker/BookmarkWidget';
import { HabitsWidget } from './tracker/HabitsWidget';
import { QuickNotesWidget } from './tracker/QuickNotesWidget';
import { GoogleTasksModal } from './tracker/GoogleTasksModal';
import { GoogleTasksIcon } from './icons/GoogleTasksIcon';
import { GoogleCalendarHub } from './tracker/GoogleCalendarHub';
import { isGoogleTasksConnected, syncTaskStatusAndDueToGoogle, updateGoogleTask, deleteGoogleTask, completeGoogleTask, uncompleteGoogleTask, syncGoogleTasksWithKanban, isAutoSyncEnabled } from '../services/googleTasksService';
import ConfirmModal from './ConfirmModal';
import { ReminderTimeSelector } from './common/ReminderTimeSelector';
import { getDoneCleanupSetting, getEligibleDoneTasksForCleanup } from '../services/doneTasksCleanupService';

const formatBeforeMinutes = (minutes?: number) => {
  if (minutes === undefined || minutes === null || minutes <= 0) return 'Đúng giờ';
  if (minutes < 60) return `-${minutes}p`;
  if (minutes < 1440) {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `-${hrs}h${mins}p` : `-${hrs}h`;
  }
  const days = Math.floor(minutes / 1440);
  const hrs = Math.floor((minutes % 1440) / 60);
  return hrs > 0 ? `-${days}d${hrs}h` : `-${days} ngày`;
};

interface ScheduleDashboardProps {
  state: AppState;
  userId?: string;
  onAddGoal: (g: any) => void;
  onUpdateGoal: (g: any) => void;
  onDeleteGoal: (id: string) => void;
  onAddTimetable: (t: any) => void;
  onUpdateTimetable: (t: any) => void;
  onDeleteTimetable: (id: string) => void;
  onAddTodo: (content: string, priority: any, deadline?: string, status?: TodoStatus, description?: string, subtasks?: any[], emailNotify?: boolean, emailNotifyBeforeMinutes?: number, attachLink?: string, customId?: string, googleTaskId?: string, googleListId?: string) => void;
  onUpdateTodo: (t: any) => void;
  onDeleteTodo: (id: string) => void;
  onDeleteMultipleTodos?: (ids: string[]) => void;
  onReorderTodos: (reordered: Todo[]) => void;
  onMoveTodoStatus: (id: string, status: TodoStatus) => void;
  initialFocusMode?: boolean;
  onResetFocusMode?: () => void;
  activeTaskId?: string | null;
  onStartTracking?: (todo: Todo) => void;
  onRefresh?: () => Promise<void>;
  onNavigate?: (tab: string, params?: any) => void;
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
  userId,
  onAddGoal, onUpdateGoal, onDeleteGoal,
  onAddTodo, onUpdateTodo, onDeleteTodo, onDeleteMultipleTodos, onReorderTodos, onMoveTodoStatus,
  initialFocusMode = false, onResetFocusMode,
  onAddTimetable, onUpdateTimetable, onDeleteTimetable,
  activeTaskId = null,
  onStartTracking = () => {},
  onRefresh,
  onNavigate,
}) => {
  const { timetable, goals, todos } = state;
  const { timer, onOpenMusic, calendarEvents = [] } = state as any;
  const effectiveUserId = userId || state.profile?.id || '';

  // View state: 'board' (Kanban) or 'list' (Calendar Grid view for todos)
  const [todoView, setTodoView] = useState<'board' | 'list'>(() => {
    const saved = localStorage.getItem(`smartlife_todo_view_${effectiveUserId}`);
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

  // Google Tasks sync modal state & real-time background sync
  const [isGoogleTasksModalOpen, setIsGoogleTasksModalOpen] = useState(false);
  const [isGTasksConnected, setIsGTasksConnected] = useState(isGoogleTasksConnected());
  const isSyncingGTasksRef = useRef(false);

  const handleSilentGTasksSync = useCallback(async () => {
    if (!isGoogleTasksConnected() || !isAutoSyncEnabled() || isSyncingGTasksRef.current) return;
    try {
      isSyncingGTasksRef.current = true;
      await syncGoogleTasksWithKanban(todos, { onAddTodo, onUpdateTodo });
    } catch (e) {
      console.warn('[GoogleTasks] Silent sync notice:', e);
    } finally {
      isSyncingGTasksRef.current = false;
    }
  }, [todos, onAddTodo, onUpdateTodo]);

  useEffect(() => {
    const checkGTasks = () => {
      const connected = isGoogleTasksConnected();
      setIsGTasksConnected(connected);
      if (connected) handleSilentGTasksSync();
    };
    checkGTasks();
    window.addEventListener('google_tasks_auth_changed', checkGTasks);

    // Tự động đồng bộ ngay khi người dùng quay lại tab/cửa sổ (Focus / Visibility)
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        handleSilentGTasksSync();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    // Đồng bộ định kỳ mỗi 45 giây
    const interval = setInterval(() => {
      handleSilentGTasksSync();
    }, 45000);

    return () => {
      window.removeEventListener('google_tasks_auth_changed', checkGTasks);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      clearInterval(interval);
    };
  }, [handleSilentGTasksSync]);

  // Auto-cleanup for completed tasks in the Done column
  const [autoCleanToast, setAutoCleanToast] = useState<string | null>(null);
  const lastAutoCleanCheckRef = useRef<number>(0);

  useEffect(() => {
    const runAutoCleanup = () => {
      const now = Date.now();
      if (now - lastAutoCleanCheckRef.current < 5000) return;
      lastAutoCleanCheckRef.current = now;

      const setting = getDoneCleanupSetting(effectiveUserId);
      if (setting.schedule === 'never') return;

      const eligible = getEligibleDoneTasksForCleanup(todos, setting.schedule);
      if (eligible.length > 0) {
        const ids = eligible.map((t) => t.id);
        if (onDeleteMultipleTodos) {
          onDeleteMultipleTodos(ids);
        } else {
          ids.forEach((id) => onDeleteTodo(id));
        }

        if (setting.notifyOnClean) {
          setAutoCleanToast(`Đã tự động dọn dẹp ${eligible.length} việc hoàn thành theo cài đặt.`);
          setTimeout(() => setAutoCleanToast(null), 4500);
        }
      }
    };

    runAutoCleanup();
    window.addEventListener('done_cleanup_setting_changed', runAutoCleanup);
    return () => window.removeEventListener('done_cleanup_setting_changed', runAutoCleanup);
  }, [todos, effectiveUserId, onDeleteMultipleTodos, onDeleteTodo]);

  // Unified Task creation/edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [todoToDeleteId, setTodoToDeleteId] = useState<string | null>(null);

  const [modalContent, setModalContent] = useState('');
  const [modalStatus, setModalStatus] = useState<TodoStatus>('todo');
  const [modalDeadline, setModalDeadline] = useState('');
  const [modalDescription, setModalDescription] = useState('');
  const [modalAttachLinks, setModalAttachLinks] = useState<TaskLink[]>([]);
  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [showAddLinkForm, setShowAddLinkForm] = useState(false);
  const [modalSubtasks, setModalSubtasks] = useState<{ id: string; title: string; is_completed: boolean }[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [modalEmailNotify, setModalEmailNotify] = useState(false);
  const [modalEmailNotifyBefore, setModalEmailNotifyBefore] = useState(60);

  // File attachments (local/IndexedDB)
  const [modalAttachments, setModalAttachments] = useState<TaskAttachment[]>([]);
  const [modalDraftTaskId, setModalDraftTaskId] = useState<string>('');
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<{ url: string; name: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calendar states
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Google Calendar Sync state
  const [isGCalCollapsed, setIsGCalCollapsed] = useState(false);
  const [gCalEvents, setGCalEvents] = useState<any[]>([]);
  const [isGCalSyncing, setIsGCalSyncing] = useState(false);
  const [gCalLastSync, setGCalLastSync] = useState<string | null>(null);
  const [isGCalConnected, setIsGCalConnected] = useState(false);

  // Google Calendar auto-sync
  useEffect(() => {
    let mounted = true;

    const syncGCal = async () => {
      try {
        const { isGoogleCalendarConnected, syncGoogleCalendar, getCachedCalendarEvents } = await import('../services/googleCalendarService');
        const connected = isGoogleCalendarConnected();
        if (mounted) setIsGCalConnected(connected);

        if (!connected) {
          // Load cached events if available
          const cached = getCachedCalendarEvents();
          if (mounted && cached.length > 0) setGCalEvents(cached);
          return;
        }

        if (mounted) setIsGCalSyncing(true);
        const result = await syncGoogleCalendar();
        if (mounted) {
          setGCalEvents(result.events);
          setGCalLastSync(result.syncedAt);
          setIsGCalSyncing(false);
        }
      } catch (err) {
        console.warn('[GoogleCalendar] Sync error:', err);
        if (mounted) setIsGCalSyncing(false);
      }
    };

    syncGCal();

    // Refresh every 60 seconds
    const interval = setInterval(syncGCal, 60000);

    // Refresh when tab becomes visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') syncGCal();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Listen for auth changes
    const handleAuthChange = () => syncGCal();
    window.addEventListener('google_auth_changed', handleAuthChange);

    return () => {
      mounted = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('google_auth_changed', handleAuthChange);
    };
  }, []);

  // Helper: Get upcoming Google Calendar events (next 7 days)
  const upcomingGCalEvents = useMemo(() => {
    const now = new Date();
    const weekLater = new Date(now);
    weekLater.setDate(weekLater.getDate() + 7);

    return gCalEvents
      .filter(e => {
        const start = new Date(e.startTime);
        return start >= now && start <= weekLater;
      })
      .slice(0, 10);
  }, [gCalEvents]);

  // Google Calendar Quick Event Modal State
  const [isGCalModalOpen, setIsGCalModalOpen] = useState(false);
  const [gCalTitle, setGCalTitle] = useState('');
  const [gCalDate, setGCalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [gCalStartTime, setGCalStartTime] = useState('09:00');
  const [gCalEndTime, setGCalEndTime] = useState('10:00');
  const [gCalLocation, setGCalLocation] = useState('');
  const [gCalDescription, setGCalDescription] = useState('');
  const [gCalIsCreating, setGCalIsCreating] = useState(false);

  const handleManualGCalSync = async () => {
    try {
      setIsGCalSyncing(true);
      const { syncGoogleCalendar } = await import('../services/googleCalendarService');
      const res = await syncGoogleCalendar();
      setGCalEvents(res.events);
      setGCalLastSync(res.syncedAt);
    } catch (err: any) {
      console.error('Lỗi đồng bộ Google Calendar:', err);
      alert(`Lỗi đồng bộ Google Calendar: ${err?.message || err}`);
    } finally {
      setIsGCalSyncing(false);
    }
  };

  const handleCreateGCalEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gCalTitle.trim()) return;
    try {
      setGCalIsCreating(true);
      const { createEventFromSimpleParams } = await import('../services/googleCalendarService');
      const newEvent = await createEventFromSimpleParams({
        title: gCalTitle.trim(),
        date: gCalDate,
        time: gCalStartTime,
        endTime: gCalEndTime,
        location: gCalLocation.trim() || undefined,
        description: gCalDescription.trim() || undefined,
      });
      setGCalEvents(prev => [newEvent, ...prev]);
      setIsGCalModalOpen(false);
      setGCalTitle('');
      setGCalLocation('');
      setGCalDescription('');
    } catch (err: any) {
      console.error('Lỗi tạo sự kiện Google Calendar:', err);
      alert(`Lỗi tạo sự kiện: ${err?.message || err}`);
    } finally {
      setGCalIsCreating(false);
    }
  };

  // Goals/Timetable dialog states
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalFilter, setGoalFilter] = useState<'ALL' | 'PRIORITY' | 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM'>('ALL');

  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimetableEvent | null>(null);
  const [timetableEmailBefore, setTimetableEmailBefore] = useState(60);
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
      location: fd.get('location'),
      email_notify: fd.get('email_notify') === 'on',
      email_notify_before_minutes: fd.get('email_notify_before_minutes') ? Number(fd.get('email_notify_before_minutes')) : 60
    };
    if (editingEvent) onUpdateTimetable({ ...editingEvent, ...data });
    else onAddTimetable(data);
    setIsTimeModalOpen(false);
  };

  // Open Unified Modal for Creation
  const handleOpenCreateModal = (status?: TodoStatus, defaultDate?: Date) => {
    const newDraftId = crypto.randomUUID();
    setModalDraftTaskId(newDraftId);
    setModalMode('create');
    setSelectedTodo(null);
    setModalContent('');
    setModalStatus(status || 'todo');
    setModalDescription('');
    setModalAttachLinks([]);
    setNewLinkName('');
    setNewLinkUrl('');
    setShowAddLinkForm(false);
    setModalAttachments([]);
    setModalSubtasks([]);
    setNewSubtaskTitle('');
    setModalEmailNotify(false);
    setModalEmailNotifyBefore(60);

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
    setModalDraftTaskId(todo.id);
    setModalMode('edit');
    setSelectedTodo(todo);
    setModalContent(todo.content);
    setModalStatus(todo.status || (todo.is_completed ? 'done' : 'todo'));
    setModalDescription(todo.description || '');
    setModalAttachLinks(parseTaskLinks(todo.attach_link));
    setNewLinkName('');
    setNewLinkUrl('');
    setShowAddLinkForm(false);

    // Load file attachments from IndexedDB
    if (todo.id) {
      getAttachments(todo.id).then(atts => setModalAttachments(atts)).catch(() => setModalAttachments([]));
    } else {
      setModalAttachments([]);
    }

    setModalSubtasks(todo.subtasks || []);
    setNewSubtaskTitle('');
    setModalEmailNotify(todo.email_notify || false);
    setModalEmailNotifyBefore(todo.email_notify_before_minutes ?? 60);

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
        modalSubtasks,
        modalEmailNotify,
        modalEmailNotifyBefore,
        encodeTaskLinks(modalAttachLinks) || undefined,
        modalDraftTaskId
      );
    } else if (modalMode === 'edit' && selectedTodo) {
      const updatedTodo = {
        ...selectedTodo,
        content: modalContent.trim(),
        status: modalStatus,
        deadline: formattedDeadline || null,
        description: modalDescription.trim() || null,
        attach_link: encodeTaskLinks(modalAttachLinks),
        subtasks: modalSubtasks,
        email_notify: modalEmailNotify,
        email_notify_before_minutes: modalEmailNotifyBefore,
      };
      onUpdateTodo(updatedTodo);
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

                {/* Google Tasks Sync Button (Icon-Only) */}
                <button
                  type="button"
                  onClick={() => setIsGoogleTasksModalOpen(true)}
                  className={`w-7 h-7 rounded-full transition-all flex items-center justify-center relative border shrink-0 cursor-pointer ${
                    isGTasksConnected
                      ? 'bg-white hover:bg-emerald-50/50 border-emerald-200/80 shadow-xs dark:bg-card dark:border-emerald-800/60'
                      : 'bg-slate-100 hover:bg-slate-200/80 border-slate-200/60 dark:bg-slate-800 dark:border-slate-700'
                  }`}
                  title={isGTasksConnected ? 'Google Tasks (Đã kết nối)' : 'Kết nối Google Tasks'}
                >
                  <GoogleTasksIcon size={16} />
                  <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-white dark:ring-card ${isGTasksConnected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                </button>

                {/* + Thêm task button */}
                <button
                  type="button"
                  onClick={() => handleOpenCreateModal('todo')}
                  className="w-7 h-7 rounded-full flex items-center justify-center bg-black hover:bg-slate-900 text-white dark:bg-primary dark:hover:bg-primary/95 dark:text-primary-foreground transition-all duration-200 active:scale-95 shrink-0 cursor-pointer shadow-xs"
                  title="Thêm task"
                >
                  <Plus size={14} className="stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Content view render */}
            {todoView === 'board' ? (
              <KanbanBoard
                todos={todos}
                userId={effectiveUserId}
                onMoveTodoStatus={onMoveTodoStatus}
                onReorderTodos={onReorderTodos}
                onEditTodo={handleOpenEditModal}
                onDeleteTodo={(id) => setTodoToDeleteId(id)}
                onDeleteMultipleTodos={onDeleteMultipleTodos || ((ids) => ids.forEach((id) => onDeleteTodo(id)))}
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
            <BookmarkWidget userId={effectiveUserId} />
            <HabitsWidget userId={effectiveUserId} />
          </div>
        </div>

        {/* Right Column (Stable sidebar width on desktop) */}
        <div className="flex flex-col gap-3 md:gap-4 w-full">
          <PomodoroWidget timer={timer} onOpenMusic={onOpenMusic} />
          <div className="flex-1">
            <QuickNotesWidget userId={effectiveUserId} onNavigate={onNavigate} />
          </div>
        </div>

      </div>

      {/* ── Google Calendar & Schedule Workspace (Transparent Glassmorphism) ── */}
      <div className="mt-8 space-y-4">
        <GoogleCalendarHub
          userId={effectiveUserId}
          onOpenGoogleAuth={() => setIsGoogleTasksModalOpen(true)}
        />

        {/* Goals accordion */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-slate-800 overflow-hidden shadow-xs">
          <button
            onClick={() => setIsGoalsCollapsed(!isGoalsCollapsed)}
            className="w-full px-5 py-4 flex items-center justify-between font-bold text-slate-800 dark:text-white text-sm hover:bg-slate-50/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Target size={16} className="text-indigo-600 dark:text-indigo-400" />
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

              <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200/60 space-y-2.5">
                <div className="flex items-center">
                  <label className="text-[11px] font-bold text-slate-650 cursor-pointer flex items-center gap-2 select-none">
                    <input
                      type="checkbox"
                      name="email_notify"
                      defaultChecked={editingEvent?.email_notify}
                      className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                    />
                    Gửi email nhắc nhở
                  </label>
                </div>
                
                <div>
                  <input type="hidden" name="email_notify_before_minutes" value={timetableEmailBefore} />
                  <ReminderTimeSelector
                    value={timetableEmailBefore}
                    onChange={setTimetableEmailBefore}
                  />
                </div>
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
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200 relative max-h-[90vh] overflow-y-auto custom-scrollbar">
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
                  HẠN CHÓT (DEADLINE)
                </label>
                <input
                  type="datetime-local"
                  value={modalDeadline}
                  onChange={(e) => setModalDeadline(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400 text-xs font-bold bg-white text-slate-800"
                />
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

              {/* Multi-Link Manager */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">
                  LINK ĐÍNH KÈM ({modalAttachLinks.length})
                </label>

                {/* List of added links */}
                {modalAttachLinks.length > 0 && (
                  <div className="space-y-1.5 mb-2.5">
                    {modalAttachLinks.map((link) => (
                      <div key={link.id} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100 group">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-700 truncate">{link.name}</p>
                          <p className="text-[9px] text-slate-400 truncate">{link.url}</p>
                        </div>
                        <a
                          href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-900/60 rounded-lg transition-colors shrink-0 flex items-center justify-center cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                          title="Mở liên kết"
                        >
                          <ExternalLink size={12} />
                        </a>
                        <button
                          type="button"
                          onClick={() => setModalAttachLinks(modalAttachLinks.filter(l => l.id !== link.id))}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Xóa link"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Link Form */}
                {showAddLinkForm ? (
                  <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100 space-y-2">
                    <input
                      type="text"
                      value={newLinkName}
                      onChange={(e) => setNewLinkName(e.target.value)}
                      placeholder="Tên link (VD: Google Classroom)"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400 text-xs font-semibold bg-white text-slate-800"
                    />
                    <input
                      type="text"
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      placeholder="URL (VD: https://classroom.google.com)"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400 text-xs font-semibold bg-white text-slate-800"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newLinkUrl.trim()) {
                          e.preventDefault();
                          let formattedUrl = newLinkUrl.trim();
                          if (!/^https?:\/\//i.test(formattedUrl)) formattedUrl = `https://${formattedUrl}`;
                          setModalAttachLinks([...modalAttachLinks, { id: crypto.randomUUID(), name: newLinkName.trim() || formattedUrl, url: formattedUrl }]);
                          setNewLinkName('');
                          setNewLinkUrl('');
                          setShowAddLinkForm(false);
                        }
                      }}
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => { setShowAddLinkForm(false); setNewLinkName(''); setNewLinkUrl(''); }}
                        className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        disabled={!newLinkUrl.trim()}
                        onClick={() => {
                          let formattedUrl = newLinkUrl.trim();
                          if (!/^https?:\/\//i.test(formattedUrl)) formattedUrl = `https://${formattedUrl}`;
                          setModalAttachLinks([...modalAttachLinks, { id: crypto.randomUUID(), name: newLinkName.trim() || formattedUrl, url: formattedUrl }]);
                          setNewLinkName('');
                          setNewLinkUrl('');
                          setShowAddLinkForm(false);
                        }}
                        className="px-3 py-1.5 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Plus size={11} /> Thêm
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddLinkForm(true)}
                    className="w-full py-2 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-300 text-[10px] font-bold text-slate-400 hover:text-blue-500 transition-colors cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Plus size={12} /> Thêm link đính kèm
                  </button>
                )}
              </div>

              {/* File Attachments (Local) */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">
                  <Paperclip size={10} className="inline mr-1" />
                  TỆP ĐÍNH KÈM ({modalAttachments.length})
                </label>

                {modalAttachments.length > 0 && (
                  <div className="space-y-1.5 mb-2.5">
                    {modalAttachments.map((att) => {
                      const icon = getFileIcon(att.type);
                      const isImage = att.type.startsWith('image/');
                      return (
                        <div key={att.id} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100 group">
                          <span className="text-sm shrink-0">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-slate-700 truncate">{att.name}</p>
                            <p className="text-[9px] text-slate-400">{formatFileSize(att.size)}</p>
                          </div>
                          {isPreviewable(att.type, att.name) && (
                            <button
                              type="button"
                              onClick={() => {
                                const blob = new Blob([att.data], { type: att.type });
                                const url = URL.createObjectURL(blob);
                                setPreviewAttachment({ url, name: att.name, type: att.type });
                              }}
                              className="p-1 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer shrink-0"
                              title="Xem trước"
                            >
                              <Eye size={12} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => downloadAttachment(att)}
                            className="p-1 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Tải xuống"
                          >
                            <Download size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteAttachment(att.id, att.taskId || modalDraftTaskId);
                              setModalAttachments(modalAttachments.filter(a => a.id !== att.id));
                            }}
                            className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Xóa file"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files || files.length === 0) return;

                    const taskId = modalDraftTaskId || selectedTodo?.id || crypto.randomUUID();
                    if (!modalDraftTaskId) setModalDraftTaskId(taskId);
                    setIsUploadingFile(true);
                    try {
                      const newAtts: TaskAttachment[] = [];
                      for (let i = 0; i < files.length; i++) {
                        const att = await saveAttachment(taskId, files[i]);
                        newAtts.push(att);
                      }
                      setModalAttachments(prev => [...prev, ...newAtts]);
                    } catch (err: any) {
                      alert(err.message || 'Lỗi tải file lên');
                    } finally {
                      setIsUploadingFile(false);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }
                  }}
                />

                <button
                  type="button"
                  disabled={isUploadingFile}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 rounded-xl border-2 border-dashed border-slate-200 hover:border-emerald-300 text-[10px] font-bold text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {isUploadingFile ? (
                    <><RefreshCw size={12} className="animate-spin" /> Đang tải lên...</>
                  ) : (
                    <><Upload size={12} /> Tải file lên (lưu local)</>   
                  )}
                </button>
                <p className="text-[8px] text-slate-400 mt-1 text-center">Tối đa 10MB/file · Lưu trên thiết bị của bạn</p>
              </div>

              {/* Enhanced File Preview Modal */}
              {previewAttachment && typeof document !== 'undefined' && createPortal(
                <div
                  className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200"
                  onClick={() => {
                    URL.revokeObjectURL(previewAttachment.url);
                    setPreviewAttachment(null);
                  }}
                >
                  <div
                    className="relative bg-white dark:bg-card border border-border/80 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-slate-50/80 dark:bg-card shrink-0 gap-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="text-base shrink-0">{getFileIcon(previewAttachment.type)}</span>
                        <p className="text-xs sm:text-sm font-bold text-foreground truncate">{previewAttachment.name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const a = document.createElement('a');
                            a.href = previewAttachment.url;
                            a.download = previewAttachment.name;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          }}
                          className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
                          title="Tải xuống"
                        >
                          <Download size={13} />
                          <span>Tải về</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            URL.revokeObjectURL(previewAttachment.url);
                            setPreviewAttachment(null);
                          }}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-colors cursor-pointer"
                          title="Đóng"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-auto flex items-center justify-center p-3 sm:p-4 min-h-[300px] max-h-[78vh] bg-slate-900/5 dark:bg-black/40">
                      {previewAttachment.type.startsWith('image/') ? (
                        <img
                          src={previewAttachment.url}
                          alt={previewAttachment.name}
                          className="max-w-full max-h-[74vh] object-contain rounded-xl shadow-sm"
                        />
                      ) : previewAttachment.type === 'application/pdf' ? (
                        <iframe
                          src={previewAttachment.url}
                          title={previewAttachment.name}
                          className="w-full h-[74vh] rounded-xl border-0 shadow-sm bg-white"
                        />
                      ) : previewAttachment.type.startsWith('video/') ? (
                        <video
                          src={previewAttachment.url}
                          controls
                          autoPlay
                          className="max-w-full max-h-[74vh] rounded-xl shadow-sm"
                        />
                      ) : previewAttachment.type.startsWith('audio/') ? (
                        <div className="p-8 flex flex-col items-center gap-3">
                          <p className="text-xs font-bold text-foreground">{previewAttachment.name}</p>
                          <audio src={previewAttachment.url} controls autoPlay className="w-80 sm:w-96" />
                        </div>
                      ) : (
                        <iframe
                          src={previewAttachment.url}
                          title={previewAttachment.name}
                          className="w-full h-[70vh] rounded-xl bg-white p-4 font-mono text-xs shadow-sm"
                        />
                      )}
                    </div>
                  </div>
                </div>,
                document.body
              )}

              {/* Email Notifications */}
              <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200/60 space-y-2.5">
                <div className="flex items-center">
                  <label className="text-[11px] font-bold text-slate-655 cursor-pointer flex items-center gap-2 select-none">
                    <input
                      type="checkbox"
                      checked={modalEmailNotify}
                      onChange={(e) => setModalEmailNotify(e.target.checked)}
                      className="w-4 h-4 accent-black rounded cursor-pointer"
                    />
                    Gửi email nhắc nhở
                  </label>
                </div>
                {modalEmailNotify && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    <ReminderTimeSelector
                      value={modalEmailNotifyBefore}
                      onChange={setModalEmailNotifyBefore}
                    />
                  </div>
                )}
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
                    className="w-8 h-8 rounded-full bg-black hover:bg-slate-900 text-white dark:bg-primary dark:hover:bg-primary/95 dark:text-primary-foreground flex items-center justify-center transition-all duration-200 active:scale-90 shrink-0"
                  >
                    <Plus size={14} className="stroke-[3]" />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 pt-3 border-t border-slate-100 dark:border-border/60 mt-2 select-none">
                {modalMode === 'edit' && selectedTodo && (
                  <button
                    type="button"
                    onClick={() => {
                      const todoId = selectedTodo.id;
                      setIsModalOpen(false);
                      setTodoToDeleteId(todoId);
                    }}
                    className="py-3 px-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/80 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 shrink-0"
                    title="Xóa nhiệm vụ này"
                  >
                    <Trash2 size={14} />
                    <span>Xóa</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 dark:border-border text-slate-600 dark:text-muted-foreground font-bold text-xs rounded-2xl hover:bg-slate-50 dark:hover:bg-secondary transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleModalSave}
                  disabled={!modalContent.trim()}
                  className="flex-1 py-3 bg-black hover:bg-slate-900 text-white dark:bg-primary dark:hover:bg-primary/95 dark:text-primary-foreground font-bold text-xs rounded-2xl transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {modalMode === 'create' ? 'Thêm task' : 'Lưu thay đổi'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {todoToDeleteId !== null && (
        <ConfirmModal
          isOpen={todoToDeleteId !== null}
          title="Bạn có chắc muốn xóa?"
          message="Nhiệm vụ này sẽ bị xóa vĩnh viễn khỏi bảng Kanban SmartLife và Google Tasks."
          confirmText="Xóa luôn"
          cancelText="Hủy"
          onConfirm={() => {
            if (todoToDeleteId) {
              const target = todos.find(t => t.id === todoToDeleteId);
              if (target?.google_task_id && isGoogleTasksConnected()) {
                deleteGoogleTask(target.google_task_id, target.google_list_id || '@default')
                  .catch(e => console.warn('[AutoSync] Delete task error:', e));
              }
              onDeleteTodo(todoToDeleteId);
              setTodoToDeleteId(null);
            }
          }}
          onCancel={() => setTodoToDeleteId(null)}
        />
      )}

      {/* Google Calendar Quick Event Modal */}
      {isGCalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-blue-50/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Calendar size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800">Thêm sự kiện Google Calendar</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Tự động đồng bộ lên Google Calendar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGCalModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateGCalEvent} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">
                  Tiêu đề sự kiện *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Lịch học React, Cuộc hẹn cà phê, Phỏng vấn..."
                  value={gCalTitle}
                  onChange={(e) => setGCalTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">
                    Ngày
                  </label>
                  <input
                    type="date"
                    required
                    value={gCalDate}
                    onChange={(e) => setGCalDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">
                    Bắt đầu
                  </label>
                  <input
                    type="time"
                    value={gCalStartTime}
                    onChange={(e) => setGCalStartTime(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">
                    Kết thúc
                  </label>
                  <input
                    type="time"
                    value={gCalEndTime}
                    onChange={(e) => setGCalEndTime(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">
                  Địa điểm (tuỳ chọn)
                </label>
                <div className="relative">
                  <MapPin size={13} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="VD: Phòng 402 - Giảng đường A, Tầng 3..."
                    value={gCalLocation}
                    onChange={(e) => setGCalLocation(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">
                  Ghi chú / Mô tả (tuỳ chọn)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú thêm về sự kiện..."
                  value={gCalDescription}
                  onChange={(e) => setGCalDescription(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsGCalModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={gCalIsCreating || !gCalTitle.trim()}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {gCalIsCreating ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      Đang tạo...
                    </>
                  ) : (
                    'Thêm vào Google Calendar'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google Tasks Sync & Management Modal */}
      <GoogleTasksModal
        isOpen={isGoogleTasksModalOpen}
        onClose={() => setIsGoogleTasksModalOpen(false)}
        todos={todos}
        syncCallbacks={{
          onAddTodo,
          onUpdateTodo,
        }}
      />

      {/* Auto-clean Toast Notification */}
      {autoCleanToast && (
        <div className="fixed bottom-6 right-6 z-[99999] bg-slate-900 text-white dark:bg-card dark:text-foreground px-4 py-3 rounded-2xl shadow-2xl border border-border flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-4 duration-200">
          <Sparkles size={16} className="text-emerald-400 shrink-0" />
          <span>{autoCleanToast}</span>
          <button
            type="button"
            onClick={() => setAutoCleanToast(null)}
            className="ml-2 p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default ScheduleDashboard;
