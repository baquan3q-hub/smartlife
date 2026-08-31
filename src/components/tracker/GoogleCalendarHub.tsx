// File: src/components/tracker/GoogleCalendarHub.tsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Clock, MapPin, Plus, RefreshCw, ExternalLink,
  ChevronLeft, ChevronRight, Sparkles, CheckCircle2,
  Trash2, X, Check, Palette, HelpCircle,
  CalendarDays, Flag, Radio, FileText
} from 'lucide-react';
import { Solar } from 'lunar-javascript';
import { GoogleCalendarIcon } from '../icons/GoogleCalendarIcon';
import {
  isGoogleCalendarConnected,
  syncGoogleCalendar,
  getCachedCalendarEvents,
  createEventFromSimpleParams,
  updateCalendarEvent,
  deleteCalendarEvent,
  CalendarEventLocal,
} from '../../services/googleCalendarService';
import { supabase } from '../../services/supabase';

interface GoogleCalendarHubProps {
  userId?: string;
  onOpenGoogleAuth?: () => void;
}

type CalendarViewMode = 'week' | 'day' | 'month' | 'list';

export type EventCategoryKey = 'work' | 'study' | 'deadline' | 'meeting' | 'personal' | 'event' | 'auto';

// ────────────────────────────────────────────────────────────
// TIMEZONE & LOCAL DATE UTILITIES (VIETNAM / LOCAL TIME SAFE)
// ────────────────────────────────────────────────────────────

export const getLocalDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getMondayOfDate = (d: Date): Date => {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const day = date.getDay(); // 0 is Sun, 1 is Mon
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.getFullYear(), date.getMonth(), diff, 0, 0, 0, 0);
};

export const getEventLocalDateStr = (timeString: string): string => {
  if (!timeString) return '';
  if (timeString.length === 10 && !timeString.includes('T')) {
    return timeString;
  }
  const d = new Date(timeString);
  if (isNaN(d.getTime())) {
    return timeString.slice(0, 10);
  }
  return getLocalDateStr(d);
};

export const getEventLocalTimeStr = (timeString: string): string => {
  if (!timeString) return '';
  const d = new Date(timeString);
  if (isNaN(d.getTime())) {
    return timeString.slice(11, 16);
  }
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// ────────────────────────────────────────────────────────────
// VIETNAMESE HOLIDAY SUBTITLE & TRANSLATION DICTIONARY
// ────────────────────────────────────────────────────────────

export const getHolidayVietnameseNote = (title: string): string | null => {
  if (!title) return null;
  const t = title.toLowerCase().trim();

  if (t.includes('independence day holiday')) return 'Nghỉ lễ Quốc khánh 2/9';
  if (t.includes('independence day')) return 'Lễ Quốc khánh 2/9';
  if (t.includes('national day')) return 'Ngày Quốc khánh Việt Nam';
  if (t.includes('new year\'s day') || t.includes('new year day')) return 'Tết Dương lịch (Năm mới)';
  if (t.includes('international workers\' day') || t.includes('labor day') || t.includes('labour day')) return 'Ngày Quốc tế Lao động 1/5';
  if (t.includes('liberation day') || t.includes('reunification day')) return 'Ngày Giải phóng miền Nam 30/4';
  if (t.includes('hung king') || t.includes('hung temple')) return 'Giỗ tổ Hùng Vương (10/3 Âm lịch)';
  if (t.includes('lunar new year\'s eve')) return 'Đêm Giao thừa Tết Nguyên Đán';
  if (t.includes('lunar new year') || t.includes('tet holiday')) return 'Tết Nguyên Đán';
  if (t.includes('vietnamese women')) return 'Ngày Phụ nữ Việt Nam 20/10';
  if (t.includes('international women')) return 'Ngày Quốc tế Phụ nữ 8/3';
  if (t.includes('teacher')) return 'Ngày Nhà giáo Việt Nam 20/11';
  if (t.includes('christmas')) return 'Lễ Giáng sinh (Noel)';
  if (t.includes('mid-autumn')) return 'Tết Trung thu (Rằm tháng 8)';
  if (t.includes('quốc khánh')) return 'Nghỉ lễ Quốc khánh 2/9';
  if (t.includes('giải phóng')) return 'Ngày Giải phóng miền Nam 30/4';
  if (t.includes('giỗ tổ')) return 'Giỗ tổ Hùng Vương (10/3 Âm lịch)';

  return null;
};

// ────────────────────────────────────────────────────────────
// TODAY ROADMAP STATUS ENGINE
// ────────────────────────────────────────────────────────────

export type EventLiveStatus = 'IN_PROGRESS' | 'COMPLETED' | 'UPCOMING' | 'ALL_DAY';

export interface EventStatusMeta {
  status: EventLiveStatus;
  label: string;
  badgeClass: string;
  subText: string;
}

export const getEventLiveStatus = (evt: CalendarEventLocal, now: Date = new Date()): EventStatusMeta => {
  if (evt.isAllDay) {
    return {
      status: 'ALL_DAY',
      label: 'Cả ngày',
      badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30',
      subText: 'Sự kiện trọn ngày hôm nay',
    };
  }

  const startD = new Date(evt.startTime);
  const endD = new Date(evt.endTime);
  const nowMs = now.getTime();
  const startMs = startD.getTime();
  const endMs = endD.getTime();

  if (nowMs >= startMs && nowMs <= endMs) {
    const remainingMin = Math.max(1, Math.round((endMs - nowMs) / 60000));
    return {
      status: 'IN_PROGRESS',
      label: 'Đang diễn ra',
      badgeClass: 'bg-emerald-500 text-white font-extrabold shadow-sm shadow-emerald-500/30 animate-pulse',
      subText: `Còn ~${remainingMin} phút nữa`,
    };
  }

  if (nowMs > endMs) {
    return {
      status: 'COMPLETED',
      label: 'Đã qua',
      badgeClass: 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-300/40',
      subText: 'Đã hoàn thành theo lịch',
    };
  }

  const diffMin = Math.round((startMs - nowMs) / 60000);
  let subText = '';
  if (diffMin < 60) {
    subText = `Bắt đầu sau ${diffMin} phút`;
  } else {
    const diffHours = (diffMin / 60).toFixed(1);
    subText = `Bắt đầu sau ~${diffHours} giờ`;
  }

  return {
    status: 'UPCOMING',
    label: 'Sắp tới',
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-400/30',
    subText,
  };
};

// ────────────────────────────────────────────────────────────
// BẢNG 11 MÀU CHUẨN GOOGLE CALENDAR
// ────────────────────────────────────────────────────────────

export interface GoogleColorItem {
  id: string;
  name: string;
  hex: string;
  desc: string;
}

export const GOOGLE_COLOR_PALETTE: GoogleColorItem[] = [
  { id: '5', name: 'Vàng Banana', hex: '#f6bf26', desc: 'Công việc, dự án, code, nhiệm vụ trọng tâm' },
  { id: '7', name: 'Xanh Peacock', hex: '#039be5', desc: 'Học tập, môn học, tài liệu, nghiên cứu' },
  { id: '11', name: 'Đỏ Tomato', hex: '#d50000', desc: 'Deadline, hạn nộp bài, kỳ thi khẩn cấp' },
  { id: '3', name: 'Tím Grape', hex: '#8e24aa', desc: 'Cuộc hẹn, họp nhóm, phỏng vấn, trao đổi' },
  { id: '10', name: 'Xanh Basil', hex: '#0b8043', desc: 'Cá nhân, gym, sức khỏe, thói quen' },
  { id: '6', name: 'Cam Tangerine', hex: '#f4511e', desc: 'Sự kiện, lễ hội, hoạt động chung' },
  { id: '4', name: 'Hồng Flamingo', hex: '#e67c73', desc: 'Thư giãn, nghệ thuật, giải trí' },
  { id: '1', name: 'Tím Lavender', hex: '#7986cb', desc: 'Đọc sách, suy ngẫm, kế hoạch dài hạn' },
  { id: '9', name: 'Xanh Blueberry', hex: '#3f51b5', desc: 'Công nghệ, kỹ thuật chuyên sâu' },
  { id: '2', name: 'Xanh Sage', hex: '#33b679', desc: 'Gia đình, bạn bè, quan hệ xã hội' },
  { id: '8', name: 'Xám Graphite', hex: '#616161', desc: 'Lưu trữ, việc định kỳ không phân loại' },
];

export interface EventPresetCategory {
  key: EventCategoryKey;
  label: string;
  icon: string;
  desc: string;
  keywords: string[];
  defaultColorId: string;
  defaultHex: string;
}

export const PRESET_CATEGORIES: EventPresetCategory[] = [
  {
    key: 'work',
    label: 'Công việc',
    icon: '💼',
    desc: 'Dự án, Code, Báo cáo, Nhiệm vụ chính',
    keywords: ['work', 'dự án', 'project', 'code', 'review', 'task', 'báo cáo', 'client', 'khách hàng', 'làm việc', 'liberal'],
    defaultColorId: '5',
    defaultHex: '#f6bf26',
  },
  {
    key: 'study',
    label: 'Học tập',
    icon: '📘',
    desc: 'Môn học, Giảng đường, IELTS, Nghiên cứu',
    keywords: ['học', 'lập trình', 'đào tạo', 'học liệu', 'ielts', 'toeic', 'tiếng anh', 'english', 'toán', 'lý', 'hóa', 'tin', 'react', 'bài giảng', 'lab', 'thực hành', 'bài tập', 'khóa học', 'phát triển', 'thiết kế', 'kiến trúc'],
    defaultColorId: '7',
    defaultHex: '#039be5',
  },
  {
    key: 'deadline',
    label: 'Deadline',
    icon: '🚨',
    desc: 'Hạn chót, Nộp bài, Kỳ thi, Việc khẩn cấp',
    keywords: ['deadline', 'hạn chót', 'nộp bài', 'kiểm tra', 'bài thi', 'kỳ thi', 'thi cuối kỳ', 'thi giữa kỳ', 'exam', 'due', 'khẩn cấp', 'gấp'],
    defaultColorId: '11',
    defaultHex: '#d50000',
  },
  {
    key: 'meeting',
    label: 'Cuộc hẹn & Họp',
    icon: '☕',
    desc: 'Họp nhóm, Google Meet, Cafe, Phỏng vấn',
    keywords: ['họp', 'meet', 'hẹn', 'cafe', 'gặp', 'phỏng vấn', 'interview', 'trao đổi', 'sync'],
    defaultColorId: '3',
    defaultHex: '#8e24aa',
  },
  {
    key: 'personal',
    label: 'Cá nhân & Sức khỏe',
    icon: '🧘',
    desc: 'Gym, Khám sức khỏe, Ăn uống, Du lịch',
    keywords: ['gym', 'chạy', 'khám', 'mua', 'ăn', 'du lịch', 'nghỉ', 'sinh nhật', 'workout', 'yoga', 'bác sĩ', 'thuốc', 'holiday', 'nghỉ lễ', 'quốc khánh'],
    defaultColorId: '10',
    defaultHex: '#0b8043',
  },
  {
    key: 'event',
    label: 'Sự kiện & Khác',
    icon: '🎈',
    desc: 'Lễ hội, Hoạt động tập thể, Sự kiện đặc biệt',
    keywords: ['sự kiện', 'event', 'workshop', 'webinar', 'hội thảo', 'liên hoan', 'party', 'tiệc'],
    defaultColorId: '6',
    defaultHex: '#f4511e',
  },
];

export interface CustomEventSetting {
  label: string;
  icon: string;
  colorId: string;
  hex: string;
}

export const hexToGlassStyle = (hex: string) => {
  const cleanHex = (hex || '#f6bf26').replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 246;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 191;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 38;

  return {
    cardStyle: {
      backgroundColor: `rgba(${r}, ${g}, ${b}, 0.08)`,
      borderLeftColor: `#${cleanHex}`,
    },
    pillStyle: {
      backgroundColor: `rgba(${r}, ${g}, ${b}, 0.16)`,
      borderLeftColor: `#${cleanHex}`,
    },
    dotHex: `#${cleanHex}`,
    rgb: { r, g, b },
  };
};

export const detectAutoCategory = (title: string, colorHex?: string): CustomEventSetting => {
  const t = title.toLowerCase();

  // 1. Deadline / Khẩn cấp
  if (
    t.includes('deadline') ||
    t.includes('hạn chót') ||
    t.includes('nộp bài') ||
    t.includes('kiểm tra') ||
    t.includes('bài thi') ||
    t.includes('kỳ thi') ||
    t.includes('thi cuối kỳ') ||
    t.includes('thi giữa kỳ') ||
    (/\b(thi|exam|due)\b/i.test(t) && !t.includes('thiết kế') && !t.includes('thích'))
  ) {
    return { label: 'Deadline', icon: '🚨', colorId: '11', hex: '#d50000' };
  }

  // 2. Học tập
  if (
    t.includes('học') ||
    t.includes('lập trình') ||
    t.includes('đào tạo') ||
    t.includes('học liệu') ||
    t.includes('hướng đối tượng') ||
    t.includes('thiết kế') ||
    t.includes('ielts') ||
    t.includes('toeic') ||
    t.includes('tiếng anh') ||
    t.includes('english') ||
    t.includes('toán') ||
    t.includes('lý') ||
    t.includes('hóa') ||
    t.includes('tin') ||
    t.includes('react') ||
    t.includes('công nghệ') ||
    t.includes('bài giảng') ||
    t.includes('giáo trình') ||
    t.includes('lab') ||
    t.includes('thực hành') ||
    t.includes('bài tập') ||
    t.includes('phát triển') ||
    /[a-z]{2,5}\d{3,5}/i.test(t)
  ) {
    return { label: 'Học tập', icon: '📘', colorId: '7', hex: '#039be5' };
  }

  // 3. Cuộc hẹn / Họp
  if (t.includes('họp') || t.includes('meet') || t.includes('hẹn') || t.includes('cafe') || t.includes('gặp') || t.includes('phỏng vấn')) {
    return { label: 'Cuộc hẹn & Họp', icon: '☕', colorId: '3', hex: '#8e24aa' };
  }

  // 4. Công việc
  if (t.includes('work') || t.includes('dự án') || t.includes('project') || t.includes('code') || t.includes('review') || t.includes('task') || t.includes('báo cáo') || t.includes('liberal')) {
    return { label: 'Công việc', icon: '💼', colorId: '5', hex: '#f6bf26' };
  }

  // 5. Cá nhân & Lễ
  if (t.includes('gym') || t.includes('chạy') || t.includes('khám') || t.includes('mua') || t.includes('ăn') || t.includes('du lịch') || t.includes('nghỉ') || t.includes('sinh nhật') || t.includes('workout') || t.includes('holiday') || t.includes('quốc khánh')) {
    return { label: 'Cá nhân & Sức khỏe', icon: '🧘', colorId: '10', hex: '#0b8043' };
  }

  // Mặc định
  return { label: 'Sự kiện & Khác', icon: '🎈', colorId: '6', hex: colorHex || '#f4511e' };
};

const WEEKDAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
const MONTH_WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

export const GoogleCalendarHub: React.FC<GoogleCalendarHubProps> = ({
  userId,
  onOpenGoogleAuth,
}) => {
  const [events, setEvents] = useState<CalendarEventLocal[]>([]);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [isConnected, setIsConnected] = useState(isGoogleCalendarConnected());
  const [isSyncing, setIsSyncing] = useState(false);
  const [, setLastSync] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Week navigation state (Always exact local Monday)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getMondayOfDate(new Date()));

  // Month navigation state
  const [monthCurrentDate, setMonthCurrentDate] = useState<Date>(new Date());
  const [monthSelectedDate, setMonthSelectedDate] = useState<Date>(new Date());

  // Custom User Event Settings store
  const storageKey = `smartlife_event_custom_settings_${userId || 'guest'}`;
  const [customSettings, setCustomSettings] = useState<Record<string, CustomEventSetting>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Modals state
  const [editingEvent, setEditingEvent] = useState<CalendarEventLocal | null>(null);
  const [tempLabel, setTempLabel] = useState('Công việc');
  const [tempIcon, setTempIcon] = useState('💼');
  const [tempColorId, setTempColorId] = useState('5');
  const [tempHex, setTempHex] = useState('#f6bf26');
  const [isSavingGoogleColor, setIsSavingGoogleColor] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Color Help Popover state
  const [isColorHelpOpen, setIsColorHelpOpen] = useState(false);

  // Quick Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPresetKey, setNewPresetKey] = useState<EventCategoryKey>('auto');
  const [newDate, setNewDate] = useState(() => getLocalDateStr(new Date()));
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [newEndTime, setNewEndTime] = useState('10:00');
  const [newLocation, setNewLocation] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Live timer update every 30s
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Khi mở modal chỉnh sửa sự kiện, nạp cài đặt hiện tại
  useEffect(() => {
    if (editingEvent) {
      const currentSetting = resolveEventSetting(editingEvent);
      setTempLabel(currentSetting.label);
      setTempIcon(currentSetting.icon);
      setTempColorId(currentSetting.colorId);
      setTempHex(currentSetting.hex);
    }
  }, [editingEvent]);

  // Giải quyết Setting cho từng sự kiện
  const resolveEventSetting = useCallback((evt: CalendarEventLocal): CustomEventSetting => {
    const custom = customSettings[evt.id] || (evt.googleEventId ? customSettings[evt.googleEventId] : undefined);
    if (custom) return custom;

    const auto = detectAutoCategory(evt.title, evt.color);
    if (evt.color && evt.color !== '#4285f4') {
      const matchColor = GOOGLE_COLOR_PALETTE.find(c => c.hex.toLowerCase() === evt.color.toLowerCase());
      if (matchColor) {
        return { ...auto, colorId: matchColor.id, hex: matchColor.hex };
      }
    }
    return auto;
  }, [customSettings]);

  // Lưu cài đặt Nhãn & Màu Sắc và Đồng Bộ lên Google Calendar
  const handleSaveCustomSetting = async () => {
    if (!editingEvent) return;

    const newSetting: CustomEventSetting = {
      label: tempLabel,
      icon: tempIcon,
      colorId: tempColorId,
      hex: tempHex,
    };

    // 1. Lưu Local Storage
    setCustomSettings(prev => {
      const next = { ...prev };
      next[editingEvent.id] = newSetting;
      if (editingEvent.googleEventId) next[editingEvent.googleEventId] = newSetting;
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (err) {
        console.warn('Lỗi lưu cài đặt:', err);
      }
      return next;
    });

    // 2. Cập nhật state sự kiện trong bộ nhớ tạm thời
    setEvents(prev => prev.map(e => e.id === editingEvent.id ? { ...e, color: tempHex } : e));

    // 3. Đồng bộ 2 chiều lên Google Calendar API
    if (editingEvent.googleEventId && isGoogleCalendarConnected()) {
      try {
        setIsSavingGoogleColor(true);
        await updateCalendarEvent('primary', editingEvent.googleEventId, {
          colorId: tempColorId,
        });
        setToastMessage(`✅ Đã đồng bộ màu ${GOOGLE_COLOR_PALETTE.find(c => c.id === tempColorId)?.name || 'mới'} lên Google Calendar!`);
        setTimeout(() => setToastMessage(null), 3000);
      } catch (err: any) {
        console.warn('Lỗi đồng bộ màu Google:', err);
      } finally {
        setIsSavingGoogleColor(false);
      }
    }

    setEditingEvent(null);
  };

  // Khôi phục tự động theo AI
  const handleResetToAuto = () => {
    if (!editingEvent) return;
    setCustomSettings(prev => {
      const next = { ...prev };
      delete next[editingEvent.id];
      if (editingEvent.googleEventId) delete next[editingEvent.googleEventId];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
    setEditingEvent(null);
    setToastMessage('✨ Đã khôi phục nhận diện nhãn tự động!');
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Đồng bộ toàn diện: Google Calendar + Supabase Database
  const doSync = useCallback(async () => {
    const connected = isGoogleCalendarConnected();
    setIsConnected(connected);

    let gEvents: CalendarEventLocal[] = [];
    let sbEvents: CalendarEventLocal[] = [];

    setIsSyncing(true);

    try {
      // 1. Fetch Supabase calendar_events if user logged in
      if (userId) {
        try {
          const { data } = await supabase
            .from('calendar_events')
            .select('*')
            .eq('user_id', userId);

          if (data && data.length > 0) {
            sbEvents = data.map((sb: any) => {
              const startDT = sb.time ? `${sb.date}T${sb.time.slice(0, 5)}:00` : `${sb.date}T00:00:00`;
              const endDT = sb.time ? `${sb.date}T${sb.time.slice(0, 5)}:00` : `${sb.date}T23:59:59`;
              return {
                id: `sb_${sb.id}`,
                googleEventId: '',
                calendarId: 'supabase',
                title: sb.title,
                description: sb.description || '',
                location: sb.location || '',
                startTime: startDT,
                endTime: endDT,
                isAllDay: !sb.time,
                color: '#039be5',
                htmlLink: '',
                isRecurring: false,
                status: 'confirmed',
                updatedAt: sb.created_at || new Date().toISOString(),
              };
            });
          }
        } catch (sbErr) {
          console.warn('[GoogleCalendarHub] Supabase events load error:', sbErr);
        }
      }

      // 2. Fetch Google Calendar
      if (connected) {
        const res = await syncGoogleCalendar();
        gEvents = res.events;
        setLastSync(res.syncedAt);
      } else {
        gEvents = getCachedCalendarEvents();
      }

      // 3. Merge & Deduplicate
      const mergedMap = new Map<string, CalendarEventLocal>();
      gEvents.forEach(e => mergedMap.set(e.googleEventId || e.id, e));
      sbEvents.forEach(e => {
        if (!mergedMap.has(e.id)) mergedMap.set(e.id, e);
      });

      const mergedList = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );

      setEvents(mergedList);
    } catch (err) {
      console.warn('[GoogleCalendarHub] Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [userId]);

  useEffect(() => {
    doSync();
    const interval = setInterval(doSync, 60000);
    const handleAuth = () => doSync();
    window.addEventListener('google_auth_changed', handleAuth);
    return () => {
      clearInterval(interval);
      window.removeEventListener('google_auth_changed', handleAuth);
    };
  }, [doSync]);

  // Days of the current week (Constructed in local time)
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate() + i, 0, 0, 0, 0);
      days.push(d);
    }
    return days;
  }, [currentWeekStart]);

  const handlePrevWeek = () => {
    const d = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate() - 7, 0, 0, 0, 0);
    setCurrentWeekStart(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate() + 7, 0, 0, 0, 0);
    setCurrentWeekStart(d);
  };

  const handleCurrentWeek = () => {
    setCurrentWeekStart(getMondayOfDate(new Date()));
  };

  // Filter events for week (Local Date Safe)
  const weekEventsMap = useMemo(() => {
    const map: Record<string, CalendarEventLocal[]> = {};
    weekDays.forEach(day => {
      const dateStr = getLocalDateStr(day);
      map[dateStr] = events.filter(e => {
        const eStartDate = getEventLocalDateStr(e.startTime);
        const eEndDate = getEventLocalDateStr(e.endTime);
        return eStartDate <= dateStr && eEndDate >= dateStr;
      }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    });
    return map;
  }, [weekDays, events]);

  // Today's events (Local Date Safe)
  const todayStr = getLocalDateStr(new Date());
  const todayEvents = useMemo(() => {
    return events.filter(e => {
      const eStartDate = getEventLocalDateStr(e.startTime);
      const eEndDate = getEventLocalDateStr(e.endTime);
      return eStartDate <= todayStr && eEndDate >= todayStr;
    }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [events, todayStr]);

  // Roadmap Stats for Today
  const todayRoadmapStats = useMemo(() => {
    let inProgressCount = 0;
    let completedCount = 0;
    let upcomingCount = 0;

    todayEvents.forEach(evt => {
      const { status } = getEventLiveStatus(evt, currentTime);
      if (status === 'IN_PROGRESS' || status === 'ALL_DAY') inProgressCount++;
      else if (status === 'COMPLETED') completedCount++;
      else upcomingCount++;
    });

    return { inProgressCount, completedCount, upcomingCount, total: todayEvents.length };
  }, [todayEvents, currentTime]);

  // Upcoming events next 30 days
  const upcomingEvents = useMemo(() => {
    const nowLocalStr = getLocalDateStr(new Date());
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    const maxLocalStr = getLocalDateStr(thirtyDaysLater);

    return events.filter(e => {
      const eDate = getEventLocalDateStr(e.startTime);
      return eDate >= nowLocalStr && eDate <= maxLocalStr;
    }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [events]);

  // Month days calculation (Local Date Safe)
  const daysInMonth = useMemo(() => {
    const year = monthCurrentDate.getFullYear();
    const month = monthCurrentDate.getMonth() + 1; // 1-12
    const days: Array<{ day: number; month: number; year: number; isCurrentMonth: boolean }> = [];

    // First day of month (Monday start)
    const firstDay = new Date(year, month - 1, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 (Sun) - 6 (Sat)
    const adjustedStart = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // 0 (Mon) - 6 (Sun)

    // Previous month filler
    const prevMonthDays = new Date(year, month - 1, 0).getDate();
    for (let i = adjustedStart - 1; i >= 0; i--) {
      days.push({
        day: prevMonthDays - i,
        month: month === 1 ? 12 : month - 1,
        year: month === 1 ? year - 1 : year,
        isCurrentMonth: false,
      });
    }

    // Current month days
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
    const totalCells = days.length <= 35 ? 35 : 42;
    const remainingCells = totalCells - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        day: i,
        month: month === 12 ? 1 : month + 1,
        year: month === 12 ? year + 1 : year,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [monthCurrentDate]);

  const getLunarInfo = (day: number, month: number, year: number) => {
    try {
      const solar = Solar.fromYmd(year, month, day);
      const lunar = solar.getLunar();
      const lDay = lunar.getDay();
      const lMonth = lunar.getMonth();

      let dayName = '';
      if (lDay === 1) dayName = 'Mùng 1';
      else if (lDay <= 10) dayName = `Mùng ${lDay}`;
      else if (lDay === 15) dayName = 'Rằm';
      else dayName = `${lDay}`;

      return {
        lunarDay: lDay,
        lunarMonth: lMonth,
        dayName,
        label: lDay === 1 ? `1/${lMonth}` : `${lDay}`,
      };
    } catch {
      return { lunarDay: day, lunarMonth: month, dayName: `${day}`, label: `${day}` };
    }
  };

  const selectedMonthDateStr = getLocalDateStr(monthSelectedDate);
  const eventsForSelectedMonthDay = useMemo(() => {
    return events.filter(e => {
      const eStartDate = getEventLocalDateStr(e.startTime);
      const eEndDate = getEventLocalDateStr(e.endTime);
      return eStartDate <= selectedMonthDateStr && eEndDate >= selectedMonthDateStr;
    }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [events, selectedMonthDateStr]);

  // Clickable Actions
  const handleOpenMap = (e: React.MouseEvent, location: string) => {
    e.stopPropagation();
    if (!location) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`, '_blank', 'noopener,noreferrer');
  };

  const handleOpenEventTime = (e: React.MouseEvent, evt: CalendarEventLocal) => {
    e.stopPropagation();
    if (evt.htmlLink) {
      window.open(evt.htmlLink, '_blank', 'noopener,noreferrer');
    } else {
      setEditingEvent(evt);
    }
  };

  // Handle Event Creation
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsCreating(true);
    try {
      const preset = PRESET_CATEGORIES.find(p => p.key === newPresetKey);
      const targetColorId = preset?.defaultColorId;

      const created = await createEventFromSimpleParams({
        title: newTitle.trim(),
        date: newDate,
        time: newStartTime,
        endTime: newEndTime,
        location: newLocation.trim() || undefined,
        description: newDescription.trim() || undefined,
      });

      if (preset) {
        setCustomSettings(prev => {
          const next = { ...prev };
          const setting: CustomEventSetting = {
            label: preset.label,
            icon: preset.icon,
            colorId: preset.defaultColorId,
            hex: preset.defaultHex,
          };
          next[created.id] = setting;
          if (created.googleEventId) next[created.googleEventId] = setting;
          try {
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch {}
          return next;
        });

        if (created.googleEventId && isGoogleCalendarConnected() && targetColorId) {
          updateCalendarEvent('primary', created.googleEventId, { colorId: targetColorId }).catch(() => {});
        }
      }

      setEvents(prev => [created, ...prev]);
      setIsCreateModalOpen(false);
      setNewTitle('');
      setNewLocation('');
      setNewDescription('');
      setNewPresetKey('auto');
      setToastMessage('✅ Đã thêm sự kiện vào Google Calendar!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      alert(`Lỗi tạo sự kiện: ${err?.message || err}`);
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Delete Event
  const handleDelete = async (e: React.MouseEvent, eventId: string, googleEventId?: string) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn xóa sự kiện này?')) return;
    try {
      if (googleEventId && isGoogleCalendarConnected()) {
        await deleteCalendarEvent('primary', googleEventId);
      } else if (eventId.startsWith('sb_')) {
        const rawId = eventId.replace('sb_', '');
        await supabase.from('calendar_events').delete().eq('id', rawId);
      }
      setEvents(prev => prev.filter(item => item.id !== eventId));
      setToastMessage('🗑️ Đã xóa sự kiện thành công!');
      setTimeout(() => setToastMessage(null), 2500);
    } catch (err: any) {
      alert(`Lỗi xóa sự kiện: ${err?.message || err}`);
    }
  };

  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-indigo-500/5 p-4 sm:p-6 overflow-hidden relative transition-all min-h-[600px] flex flex-col">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-slate-900/95 dark:bg-slate-800/95 text-white font-bold text-xs shadow-2xl border border-white/20 flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-200">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Top Header Toolbar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
        
        {/* Left: Branding & Status */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-center shadow-sm shrink-0">
            <GoogleCalendarIcon size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                Google Calendar
              </h3>
              {isConnected ? (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10.5px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Đã kết nối</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10.5px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Chưa kết nối</span>
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
              Thời khóa biểu & lịch trình đồng bộ Google
            </p>
          </div>
        </div>

        {/* Center: View Switcher (Clean Text Tabs, No Emojis) */}
        <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-inner">
          <button
            onClick={() => setViewMode('week')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              viewMode === 'week'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Tuần
          </button>
          <button
            onClick={() => setViewMode('day')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              viewMode === 'day'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Hôm nay
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              viewMode === 'month'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Tháng
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Danh sách
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Question mark help button */}
          <button
            onClick={() => setIsColorHelpOpen(true)}
            className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 transition shadow-xs flex items-center justify-center cursor-pointer"
            title="Xem ý nghĩa màu sắc & phân loại"
          >
            <HelpCircle size={16} />
          </button>

          {isConnected ? (
            <>
              <button
                onClick={doSync}
                disabled={isSyncing}
                className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 transition shadow-xs flex items-center justify-center cursor-pointer disabled:opacity-50"
                title="Đồng bộ lại Google Calendar"
              >
                <RefreshCw size={15} className={isSyncing ? 'animate-spin text-indigo-600' : ''} />
              </button>

              {/* Add event button: clean '+' icon */}
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="w-9 h-9 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold shadow-md shadow-blue-500/20 flex items-center justify-center transition active:scale-95 cursor-pointer"
                title="Thêm sự kiện Google Calendar"
              >
                <Plus size={18} className="stroke-[3]" />
              </button>

              <a
                href="https://calendar.google.com"
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition"
                title="Mở Google Calendar trên Web"
              >
                <ExternalLink size={15} />
              </a>
            </>
          ) : (
            <button
              onClick={onOpenGoogleAuth}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-md transition hover:opacity-95 cursor-pointer"
            >
              Kết nối Google
            </button>
          )}
        </div>
      </div>

      {/* ── SECTION 1: WEEK VIEW (Thời khóa biểu tuần: Padding nhỏ, Chữ hiển thị dài, Nút Icon cùng dòng) ── */}
      {viewMode === 'week' && (
        <div className="mt-4 space-y-3 flex-1 flex flex-col">
          {/* Week Navigation bar */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-800 dark:text-white">
                Tuần từ {weekDays[0].toLocaleDateString('vi-VN')} đến {weekDays[6].toLocaleDateString('vi-VN')}
              </span>
              <button
                onClick={handleCurrentWeek}
                className="px-2.5 py-0.5 text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg border border-indigo-200/50 hover:bg-indigo-100 transition cursor-pointer"
              >
                Tuần này
              </button>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
              <button onClick={handlePrevWeek} className="p-1 text-slate-500 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition cursor-pointer" title="Tuần trước">
                <ChevronLeft size={15} />
              </button>
              <button onClick={handleNextWeek} className="p-1 text-slate-500 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition cursor-pointer" title="Tuần sau">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* 7-Day Columns Grid (Rộng hơn & Padding nhỏ để hiển thị nhiều chữ nhất) */}
          <div className="overflow-x-auto custom-scrollbar pb-2 flex-1">
            <div className="grid grid-cols-7 min-w-[940px] gap-2 h-full">
              {weekDays.map((day, idx) => {
                const dateStr = getLocalDateStr(day);
                const isToday = dateStr === todayStr;
                const dayEvents = weekEventsMap[dateStr] || [];

                return (
                  <div
                    key={dateStr}
                    className={`rounded-2xl border p-1.5 flex flex-col min-h-[460px] transition-all duration-200 ${
                      isToday
                        ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-600/50 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/60 dark:border-slate-700/60'
                    }`}
                  >
                    {/* Day Header */}
                    <div className={`p-2 rounded-xl text-center mb-2 transition-colors ${
                      isToday
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700'
                    }`}>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider opacity-80">
                        {WEEKDAY_NAMES[idx]}
                      </div>
                      <div className="text-sm font-black mt-0.5">
                        {day.getDate()}/{day.getMonth() + 1}
                      </div>
                    </div>

                    {/* Day Events Column */}
                    <div className="flex-1 space-y-2 overflow-y-auto max-h-[420px] pr-0.5 custom-scrollbar">
                      {dayEvents.length === 0 ? (
                        <div className="h-full flex items-center justify-center py-12 text-center text-slate-300 dark:text-slate-600 text-[10.5px] font-medium">
                          Trống
                        </div>
                      ) : (
                        dayEvents.map(evt => {
                          const setting = resolveEventSetting(evt);
                          const glass = hexToGlassStyle(setting.hex);
                          const start = evt.isAllDay ? 'Cả ngày' : getEventLocalTimeStr(evt.startTime);
                          const end = evt.isAllDay ? '' : getEventLocalTimeStr(evt.endTime);
                          const holidayNote = getHolidayVietnameseNote(evt.title);

                          return (
                            <div
                              key={evt.id}
                              style={glass.cardStyle}
                              className="rounded-xl border-y border-r border-slate-200/70 dark:border-slate-700/70 border-l-[3.5px] px-2 py-1.5 transition-all duration-200 hover:shadow-md hover:scale-[1.01] group relative bg-white dark:bg-slate-800/80 backdrop-blur-xs"
                            >
                              {/* Floating Quick Action Icons on the same row (Top Right) */}
                              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 dark:bg-slate-800/95 shadow-sm rounded-lg px-1 py-0.5 border border-slate-200/70 dark:border-slate-700/70 flex items-center gap-1 z-10">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingEvent(evt);
                                  }}
                                  className="p-0.5 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                                  title="Đổi màu sắc"
                                >
                                  <Palette size={11} />
                                </button>
                                {evt.htmlLink && (
                                  <a
                                    href={evt.htmlLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-0.5 text-slate-400 hover:text-blue-600 transition"
                                    title="Mở Google Calendar"
                                  >
                                    <ExternalLink size={11} />
                                  </a>
                                )}
                                <button
                                  onClick={(e) => handleDelete(e, evt.id, evt.googleEventId)}
                                  className="p-0.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                  title="Xóa sự kiện"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>

                              {/* Title with full width */}
                              <h5 className="font-bold text-[11.5px] leading-snug text-slate-900 dark:text-white break-words line-clamp-3 pr-2">
                                {evt.title}
                              </h5>

                              {/* Holiday Vietnamese Subtitle */}
                              {holidayNote && (
                                <div className="text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                                  <Flag size={9} />
                                  <span className="truncate">{holidayNote}</span>
                                </div>
                              )}

                              {/* Interactive Clickable Time Row */}
                              <button
                                type="button"
                                onClick={(e) => handleOpenEventTime(e, evt)}
                                className="w-full flex items-center gap-1 mt-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left cursor-pointer group/time"
                                title="Bấm để mở lịch hoặc xem chi tiết"
                              >
                                <Clock size={10} className="shrink-0 text-slate-400 group-hover/time:text-indigo-500 transition-colors" />
                                <span className="truncate">{start}{end ? ` - ${end}` : ''}</span>
                              </button>

                              {/* Interactive Clickable Location Row */}
                              {evt.location && (
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenMap(e, evt.location!)}
                                  className="w-full flex items-center gap-1 mt-0.5 text-[9.5px] font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors text-left cursor-pointer truncate group/loc"
                                  title={`Xem "${evt.location}" trên Google Maps`}
                                >
                                  <MapPin size={9.5} className="shrink-0 text-slate-400 group-hover/loc:text-blue-500 transition-colors" />
                                  <span className="truncate">{evt.location}</span>
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 2: TODAY ROADMAP JOURNEY (Nghệ Thuật, Lộ Trình & Trạng Thái Thời Gian Thực) ── */}
      {viewMode === 'day' && (
        <div className="mt-4 space-y-4 flex-1 flex flex-col">
          
          {/* Roadmap Header Summary Bar */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-indigo-500/20">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs sm:text-sm font-black tracking-tight">
                  Lộ Trình Hoạt Động Hôm Nay
                </span>
                <span className="text-[11px] font-semibold text-indigo-300">
                  • {currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 font-medium">
                {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
            </div>

            {/* Quick Status Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {todayRoadmapStats.inProgressCount > 0 && (
                <div className="px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10.5px] font-extrabold flex items-center gap-1.5 animate-pulse">
                  <Radio size={11} className="text-emerald-400" />
                  <span>{todayRoadmapStats.inProgressCount} đang diễn ra</span>
                </div>
              )}
              <div className="px-2.5 py-1 rounded-xl bg-white/10 border border-white/10 text-slate-200 text-[10.5px] font-bold">
                <span>{todayRoadmapStats.completedCount}/{todayRoadmapStats.total} đã qua</span>
              </div>
              {todayRoadmapStats.upcomingCount > 0 && (
                <div className="px-2.5 py-1 rounded-xl bg-blue-500/20 border border-blue-400/40 text-blue-300 text-[10.5px] font-bold">
                  <span>{todayRoadmapStats.upcomingCount} sắp tới</span>
                </div>
              )}
            </div>
          </div>

          {todayEvents.length === 0 ? (
            <div className="py-20 text-center text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 flex-1 flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center mb-2.5">
                <CheckCircle2 size={28} />
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Hôm nay không có lịch trình nào</p>
              <p className="text-xs text-slate-400 mt-0.5">Bạn có thể bấm dấu + ở trên để lên lộ trình mới!</p>
            </div>
          ) : (
            /* Roadmap Visual Journey Timeline */
            <div className="relative pl-6 sm:pl-8 space-y-4 max-h-[540px] overflow-y-auto pr-2 custom-scrollbar flex-1 pb-4">
              
              {/* Continuous Glowing Central Spine */}
              <div className="absolute left-2.5 sm:left-3.5 top-3 bottom-3 w-[2.5px] bg-gradient-to-b from-indigo-500 via-purple-500 to-slate-300 dark:to-slate-700 rounded-full" />

              {todayEvents.map((evt) => {
                const setting = resolveEventSetting(evt);
                const glass = hexToGlassStyle(setting.hex);
                const start = evt.isAllDay ? 'Cả ngày' : getEventLocalTimeStr(evt.startTime);
                const end = evt.isAllDay ? '' : getEventLocalTimeStr(evt.endTime);
                const statusMeta = getEventLiveStatus(evt, currentTime);
                const holidayNote = getHolidayVietnameseNote(evt.title);

                const isInProgress = statusMeta.status === 'IN_PROGRESS';
                const isCompleted = statusMeta.status === 'COMPLETED';

                return (
                  <div key={evt.id} className="relative group">
                    {/* Node on the Timeline Spine */}
                    <div className={`absolute -left-6 sm:-left-8 top-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all z-10 ${
                      isInProgress
                        ? 'bg-emerald-500 border-white text-white shadow-lg shadow-emerald-500/50 scale-125 animate-bounce'
                        : isCompleted
                          ? 'bg-slate-400 dark:bg-slate-600 border-white dark:border-slate-800 text-white'
                          : 'bg-white dark:bg-slate-800 border-indigo-500 text-indigo-600 shadow-sm'
                    }`}>
                      {isCompleted ? (
                        <Check size={10} className="stroke-[3]" />
                      ) : isInProgress ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      )}
                    </div>

                    {/* Artistic Event Roadmap Card */}
                    <div
                      style={glass.cardStyle}
                      className={`p-3.5 sm:p-4 rounded-3xl border-y border-r border-l-[5px] backdrop-blur-md transition-all duration-300 hover:shadow-xl ${
                        isInProgress
                          ? 'bg-gradient-to-r from-emerald-500/10 via-indigo-500/5 to-white/90 dark:to-slate-800 border-emerald-400 ring-2 ring-emerald-500/30 shadow-lg'
                          : isCompleted
                            ? 'bg-white/60 dark:bg-slate-800/50 opacity-75 border-slate-300 dark:border-slate-700'
                            : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        
                        <div className="flex-1 min-w-0">
                          {/* Top Status and Time Badges */}
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${statusMeta.badgeClass}`}>
                              {statusMeta.label}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              {statusMeta.subText}
                            </span>
                          </div>

                          {/* Event Title */}
                          <h4 className={`text-sm sm:text-base font-black text-slate-900 dark:text-white leading-snug break-words ${isCompleted ? 'line-through opacity-80' : ''}`}>
                            {evt.title}
                          </h4>

                          {/* Vietnamese Holiday Subtitle */}
                          {holidayNote && (
                            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
                              <Flag size={13} className="shrink-0" />
                              <span>Chú thích: {holidayNote}</span>
                            </div>
                          )}

                          {/* Clickable Info Row */}
                          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                            {/* Clickable Time */}
                            <button
                              type="button"
                              onClick={(e) => handleOpenEventTime(e, evt)}
                              className="flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer group/time"
                              title="Bấm để mở lịch hoặc xem chi tiết"
                            >
                              <Clock size={13} className="text-slate-400 group-hover/time:text-indigo-500 transition-colors shrink-0" />
                              <span className="font-bold">{start}{end ? ` - ${end}` : ''}</span>
                            </button>

                            {/* Clickable Location */}
                            {evt.location && (
                              <button
                                type="button"
                                onClick={(e) => handleOpenMap(e, evt.location!)}
                                className="flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors cursor-pointer truncate max-w-sm group/loc"
                                title={`Xem "${evt.location}" trên Google Maps`}
                              >
                                <MapPin size={13} className="text-slate-400 group-hover/loc:text-blue-500 transition-colors shrink-0" />
                                <span className="truncate font-semibold">{evt.location}</span>
                              </button>
                            )}
                          </div>

                          {evt.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 bg-slate-50/70 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-start gap-1.5">
                              <FileText size={12} className="shrink-0 mt-0.5 text-slate-400" />
                              <span>{evt.description}</span>
                            </p>
                          )}
                        </div>

                        {/* Actions on the same row */}
                        <div className="flex items-center gap-1.5 shrink-0 self-start">
                          <button
                            onClick={() => setEditingEvent(evt)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
                            title="Đổi màu sắc"
                          >
                            <Palette size={15} />
                          </button>

                          {evt.htmlLink && (
                            <a
                              href={evt.htmlLink}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl border border-blue-200/60 dark:border-blue-800/60 transition flex items-center justify-center"
                              title="Mở trên Google Calendar"
                            >
                              <ExternalLink size={15} />
                            </a>
                          )}

                          <button
                            onClick={(e) => handleDelete(e, evt.id, evt.googleEventId)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
                            title="Xóa sự kiện"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SECTION 3: MONTH VIEW (Lịch Tháng Chuẩn Âm Dương & Múi Giờ) ── */}
      {viewMode === 'month' && (
        <div className="mt-4 flex flex-col xl:flex-row gap-4 flex-1">
          {/* Main Month Grid (Rộng rãi, dễ theo dõi) */}
          <div className="flex-1 bg-white dark:bg-slate-855 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 p-4 shadow-xs flex flex-col">
            
            {/* Month Header Navigation */}
            <div className="flex items-center justify-between pb-3.5 mb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <CalendarDays size={18} className="text-indigo-600" />
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  Tháng {monthCurrentDate.getMonth() + 1}/{monthCurrentDate.getFullYear()}
                </span>
                <button
                  onClick={() => {
                    setMonthCurrentDate(new Date());
                    setMonthSelectedDate(new Date());
                  }}
                  className="px-2.5 py-0.5 text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 rounded-md border border-indigo-200/50 hover:bg-indigo-100 transition cursor-pointer"
                >
                  Hôm nay
                </button>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                <button
                  onClick={() => setMonthCurrentDate(new Date(monthCurrentDate.getFullYear(), monthCurrentDate.getMonth() - 1, 1))}
                  className="p-1.5 text-slate-500 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                  title="Tháng trước"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  onClick={() => setMonthCurrentDate(new Date(monthCurrentDate.getFullYear(), monthCurrentDate.getMonth() + 1, 1))}
                  className="p-1.5 text-slate-500 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                  title="Tháng sau"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            {/* Weekday Header Labels (T2 - CN) */}
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {MONTH_WEEKDAYS.map((wd, i) => (
                <div
                  key={wd}
                  className={`text-center text-[11px] font-black py-1.5 rounded-lg ${
                    i === 6 ? 'text-rose-500 bg-rose-50/40 dark:bg-rose-950/20' : i === 5 ? 'text-sky-500 bg-sky-50/40 dark:bg-sky-950/20' : 'text-slate-400 bg-slate-50/40 dark:bg-slate-800/40'
                  }`}
                >
                  {wd}
                </div>
              ))}
            </div>

            {/* Day Cells Grid (Spacious Height & Multi-Event Pills) */}
            <div className="grid grid-cols-7 gap-1.5 flex-1">
              {daysInMonth.map((dateObj, idx) => {
                const { day, month, year, isCurrentMonth } = dateObj;
                const cellDate = new Date(year, month - 1, day);
                const dateStr = getLocalDateStr(cellDate);
                const lunar = getLunarInfo(day, month, year);
                const dayEvts = events.filter(e => {
                  const s = getEventLocalDateStr(e.startTime);
                  const en = getEventLocalDateStr(e.endTime);
                  return s <= dateStr && en >= dateStr;
                });
                const isSelected = dateStr === selectedMonthDateStr;
                const isToday = dateStr === todayStr;

                return (
                  <div
                    key={idx}
                    onClick={() => setMonthSelectedDate(new Date(year, month - 1, day))}
                    className={`
                      relative flex flex-col p-1.5 rounded-xl cursor-pointer border
                      transition-all duration-150 select-none min-h-[96px] sm:min-h-[108px]
                      ${!isCurrentMonth ? 'opacity-35 bg-slate-50/30 dark:bg-slate-900/20 border-slate-100 dark:border-slate-800' : 'bg-white dark:bg-slate-800 border-slate-200/60 dark:border-slate-700/60'}
                      ${isToday
                        ? 'ring-2 ring-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/30'
                        : isSelected
                          ? 'ring-2 ring-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/50 shadow-sm'
                          : 'hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-xs'
                      }
                    `}
                  >
                    {/* Top Row: Solar Day + Lunar Day */}
                    <div className="flex items-center justify-between px-0.5">
                      <span className={`text-xs font-black leading-none ${
                        isToday
                          ? 'px-1.5 py-0.5 rounded-md bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}>
                        {day}
                      </span>

                      <span className={`text-[8.5px] font-semibold leading-none ${
                        (lunar.lunarDay === 1 || lunar.lunarDay === 15) ? 'text-purple-600 dark:text-purple-400 font-bold' : 'text-slate-400'
                      }`}>
                        {lunar.label}
                      </span>
                    </div>

                    {/* Event Strips Container */}
                    <div className="mt-1 space-y-1 flex-1 overflow-hidden">
                      {dayEvts.slice(0, 2).map(evt => {
                        const setting = resolveEventSetting(evt);
                        const glass = hexToGlassStyle(setting.hex);
                        const timeStr = evt.isAllDay ? '' : getEventLocalTimeStr(evt.startTime);

                        return (
                          <div
                            key={evt.id}
                            style={glass.pillStyle}
                            className="px-1.5 py-0.5 rounded border-l-[2.5px] text-[9.5px] font-bold text-slate-850 dark:text-slate-150 truncate flex items-center gap-1 shadow-2xs"
                            title={`${evt.title} ${timeStr ? `(${timeStr})` : ''}`}
                          >
                            {timeStr && <span className="opacity-75 text-[8.5px] shrink-0">{timeStr}</span>}
                            <span className="truncate">{evt.title}</span>
                          </div>
                        );
                      })}

                      {/* If 3 or more events: clear indicator badge */}
                      {dayEvts.length > 2 && (
                        <div className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 px-1 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/50 dark:border-indigo-800/50 w-fit truncate">
                          +{dayEvts.length - 2} sự kiện nữa
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Events Panel */}
          <div className="xl:w-[360px] bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 p-4 flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-200/60 dark:border-slate-700/60">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {monthSelectedDate.getDate()}/{monthSelectedDate.getMonth() + 1}/{monthSelectedDate.getFullYear()}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                    {eventsForSelectedMonthDay.length} sự kiện
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-400 font-semibold mt-0.5">
                  Âm lịch: {getLunarInfo(monthSelectedDate.getDate(), monthSelectedDate.getMonth() + 1, monthSelectedDate.getFullYear()).dayName}
                </p>
              </div>

              <button
                onClick={() => {
                  setNewDate(selectedMonthDateStr);
                  setIsCreateModalOpen(true);
                }}
                className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition shadow-xs cursor-pointer"
                title="Thêm sự kiện vào ngày này"
              >
                <Plus size={16} className="stroke-[3]" />
              </button>
            </div>

            {/* List of all events for this selected day */}
            <div className="flex-1 overflow-y-auto max-h-[500px] space-y-2.5 pr-1 custom-scrollbar">
              {eventsForSelectedMonthDay.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2 text-slate-400">
                    <CalendarDays size={22} />
                  </div>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Không có sự kiện nào trong ngày này</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Bấm dấu + ở trên để thêm lịch mới</p>
                </div>
              ) : (
                eventsForSelectedMonthDay.map((evt, i) => {
                  const setting = resolveEventSetting(evt);
                  const glass = hexToGlassStyle(setting.hex);
                  const start = evt.isAllDay ? 'Cả ngày' : getEventLocalTimeStr(evt.startTime);
                  const end = evt.isAllDay ? '' : getEventLocalTimeStr(evt.endTime);
                  const holidayNote = getHolidayVietnameseNote(evt.title);

                  return (
                    <div
                      key={evt.id}
                      style={glass.cardStyle}
                      className="p-3 rounded-xl border-y border-r border-slate-200/70 dark:border-slate-700/70 border-l-[4px] bg-white dark:bg-slate-800 shadow-2xs group relative transition hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black text-slate-400 shrink-0">#{i + 1}</span>
                            <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 break-words">
                              {evt.title}
                            </p>
                          </div>
                          {holidayNote && (
                            <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                              <Flag size={10} />
                              <span>{holidayNote}</span>
                            </div>
                          )}
                        </div>

                        {/* Action Icons on same row */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0 ml-1">
                          <button
                            onClick={() => setEditingEvent(evt)}
                            className="p-1 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                            title="Đổi màu sắc"
                          >
                            <Palette size={12} />
                          </button>
                          {evt.htmlLink && (
                            <a
                              href={evt.htmlLink}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-slate-400 hover:text-blue-600 transition"
                              title="Mở Google Calendar"
                            >
                              <ExternalLink size={12} />
                            </a>
                          )}
                          <button
                            onClick={(e) => handleDelete(e, evt.id, evt.googleEventId)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="Xóa sự kiện"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Clickable Time */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenEventTime(e, evt)}
                        className="w-full flex items-center gap-1.5 mt-2 text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left cursor-pointer group/time"
                        title="Bấm để mở lịch hoặc xem chi tiết"
                      >
                        <Clock size={11} className="shrink-0 text-slate-400 group-hover/time:text-indigo-500 transition-colors" />
                        <span>{start}{end ? ` - ${end}` : ''}</span>
                      </button>

                      {/* Clickable Location */}
                      {evt.location && (
                        <button
                          type="button"
                          onClick={(e) => handleOpenMap(e, evt.location!)}
                          className="w-full flex items-center gap-1.5 mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors text-left cursor-pointer truncate group/loc"
                          title={`Xem "${evt.location}" trên Google Maps`}
                        >
                          <MapPin size={10.5} className="shrink-0 text-slate-400 group-hover/loc:text-blue-500 transition-colors" />
                          <span className="truncate">{evt.location}</span>
                        </button>
                      )}

                      {evt.description && (
                        <p className="text-[10px] text-slate-400 mt-1.5 line-clamp-2 bg-slate-50/60 dark:bg-slate-900/40 p-1.5 rounded-lg flex items-start gap-1">
                          <FileText size={10} className="shrink-0 mt-0.5 text-slate-400" />
                          <span>{evt.description}</span>
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 4: LIST VIEW (Danh sách sắp tới) ── */}
      {viewMode === 'list' && (
        <div className="mt-4 space-y-3 flex-1 flex flex-col">
          <div className="flex items-center justify-between text-xs font-black text-slate-900 dark:text-white px-1">
            <span>Sự kiện sắp diễn ra (30 ngày tới)</span>
            <span className="text-slate-400 font-medium">{upcomingEvents.length} sự kiện</span>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 flex-1 flex flex-col items-center justify-center">
              Không có sự kiện sắp tới.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1 custom-scrollbar flex-1">
              {upcomingEvents.map(evt => {
                const setting = resolveEventSetting(evt);
                const glass = hexToGlassStyle(setting.hex);
                const startStr = evt.isAllDay ? 'Cả ngày' : getEventLocalTimeStr(evt.startTime);
                const endStr = evt.isAllDay ? '' : getEventLocalTimeStr(evt.endTime);
                const eventLocalDate = new Date(evt.startTime);
                const holidayNote = getHolidayVietnameseNote(evt.title);

                return (
                  <div
                    key={evt.id}
                    style={glass.cardStyle}
                    className="p-3 rounded-2xl border-y border-r border-slate-200/70 dark:border-slate-700/70 border-l-[4px] bg-white dark:bg-slate-800/70 backdrop-blur-md flex items-center justify-between gap-3 shadow-2xs hover:shadow-md transition group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Date Block */}
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 flex flex-col items-center justify-center shrink-0 shadow-2xs">
                        <span className="text-[8px] font-black uppercase text-slate-400 leading-none">
                          T{eventLocalDate.getMonth() + 1}
                        </span>
                        <span className="text-xs font-black text-slate-900 dark:text-white leading-tight mt-0.5">
                          {eventLocalDate.getDate()}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <h5 className="font-bold text-xs sm:text-sm truncate text-slate-900 dark:text-white">
                          {evt.title}
                        </h5>

                        {holidayNote && (
                          <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                            <Flag size={9.5} />
                            <span>{holidayNote}</span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3.5 mt-1 text-xs text-slate-600 dark:text-slate-300">
                          {/* Clickable Time */}
                          <button
                            type="button"
                            onClick={(e) => handleOpenEventTime(e, evt)}
                            className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer group/time"
                            title="Bấm để mở lịch hoặc xem chi tiết"
                          >
                            <Clock size={11} className="text-slate-400 group-hover/time:text-indigo-500 transition-colors shrink-0" />
                            <span>{startStr}{endStr ? ` - ${endStr}` : ''}</span>
                          </button>

                          {/* Clickable Location */}
                          {evt.location && (
                            <button
                              type="button"
                              onClick={(e) => handleOpenMap(e, evt.location!)}
                              className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors cursor-pointer truncate max-w-xs group/loc"
                              title={`Xem "${evt.location}" trên Google Maps`}
                            >
                              <MapPin size={11} className="text-slate-400 group-hover/loc:text-blue-500 transition-colors shrink-0" />
                              <span className="truncate">{evt.location}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Icons on the same row */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditingEvent(evt)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
                        title="Đổi màu sắc"
                      >
                        <Palette size={14} />
                      </button>

                      {evt.htmlLink && (
                        <a
                          href={evt.htmlLink}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-xl transition shrink-0"
                          title="Mở Google Calendar"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}

                      <button
                        onClick={(e) => handleDelete(e, evt.id, evt.googleEventId)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
                        title="Xóa sự kiện"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: GIẢI THÍCH HỆ THỐNG MÀU SẮC (?) ── */}
      {isColorHelpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsColorHelpOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <HelpCircle size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Ý Nghĩa Hệ Thống Màu Sắc</h4>
                  <p className="text-[11px] text-slate-400">Đồng bộ tự động với mã màu Google Calendar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsColorHelpOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content: 6 Core Preset Colors */}
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
              {PRESET_CATEGORIES.map(cat => (
                <div
                  key={cat.key}
                  className="p-3 rounded-2xl border border-slate-200/70 dark:border-slate-800 flex items-start gap-3 bg-slate-50/50 dark:bg-slate-800/40"
                >
                  <div
                    className="w-4 h-4 rounded-full mt-0.5 shrink-0 shadow-xs ring-2 ring-white dark:ring-slate-900"
                    style={{ backgroundColor: cat.defaultHex }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        {cat.label}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 font-semibold">
                        {cat.defaultHex}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {cat.desc}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {cat.keywords.slice(0, 4).map(kw => (
                        <span key={kw} className="px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[9.5px] font-medium border border-slate-200/60 dark:border-slate-600">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>💡 Bạn có thể bấm vào icon <Palette size={12} className="inline mx-0.5 text-indigo-500" /> trên mỗi sự kiện để đổi màu tùy ý.</span>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ĐỔI MÀU SẮC SỰ KIỆN (Icon-Only Row & Clean Layout) ── */}
      {editingEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setEditingEvent(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Palette size={16} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Chọn Màu Sắc Sự Kiện</h4>
                  <p className="text-[11px] text-slate-400 font-medium truncate max-w-[240px]">
                    {editingEvent.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingEvent(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* LIVE PREVIEW BANNER */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                Xem trước giao diện thẻ
              </label>
              {(() => {
                const previewGlass = hexToGlassStyle(tempHex);
                return (
                  <div
                    style={previewGlass.cardStyle}
                    className="p-3 rounded-2xl border-y border-r border-slate-200/80 dark:border-slate-700/80 border-l-[4px] bg-white dark:bg-slate-800 flex items-center justify-between gap-3 shadow-xs transition-all duration-300"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {editingEvent.title}
                      </span>
                    </div>
                    <span className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 shrink-0">
                      {GOOGLE_COLOR_PALETTE.find(c => c.id === tempColorId)?.name || 'Màu đã chọn'}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* 1. CHỌN DANH MỤC: CÙNG DÒNG ICON-ONLY (AI & Categories) */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                Nhóm Gợi Ý (Bấm chọn biểu tượng)
              </label>
              <div className="flex items-center justify-between gap-1.5 bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                {/* AI Button */}
                <button
                  type="button"
                  onClick={handleResetToAuto}
                  className="flex-1 py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer hover:bg-white dark:hover:bg-slate-700 border-transparent text-amber-500"
                  title="Nhận diện AI Tự động"
                >
                  <Sparkles size={16} />
                  <span className="text-[9px] font-black">AI</span>
                </button>

                {PRESET_CATEGORIES.map((preset) => {
                  const isSelected = tempColorId === preset.defaultColorId;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => {
                        setTempLabel(preset.label);
                        setTempIcon(preset.icon);
                        setTempColorId(preset.defaultColorId);
                        setTempHex(preset.defaultHex);
                      }}
                      className={`flex-1 py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-indigo-500 bg-white dark:bg-slate-800 border-indigo-400 font-black shadow-xs scale-105'
                          : 'hover:bg-white dark:hover:bg-slate-700/60 border-transparent text-slate-600 dark:text-slate-300'
                      }`}
                      title={`${preset.label}: ${preset.desc}`}
                    >
                      <span className="text-base leading-none">{preset.icon}</span>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: preset.defaultHex }} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. CHỌN MÀU SẮC GOOGLE CALENDAR */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Bảng 11 Màu Google Calendar</span>
                <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold">
                  Đồng bộ 2 chiều
                </span>
              </label>
              <div className="grid grid-cols-6 gap-1.5">
                {GOOGLE_COLOR_PALETTE.map((color) => {
                  const isSelected = tempColorId === color.id;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => {
                        setTempColorId(color.id);
                        setTempHex(color.hex);
                      }}
                      className={`p-2 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-indigo-600 bg-white dark:bg-slate-800 shadow-sm scale-110 border-indigo-400'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/60'
                      }`}
                      title={`${color.name}: ${color.desc}`}
                    >
                      <span
                        className="w-5 h-5 rounded-full shadow-xs flex items-center justify-center"
                        style={{ backgroundColor: color.hex }}
                      >
                        {isSelected && <Check size={11} className="text-white drop-shadow-sm stroke-[3]" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer: Cùng Dòng Icon-Only Action Buttons */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetToAuto}
                className="w-9 h-9 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center transition cursor-pointer"
                title="Khôi phục nhận diện AI tự động"
              >
                <Sparkles size={16} />
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
                  title="Hủy"
                >
                  <X size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustomSetting}
                  disabled={isSavingGoogleColor}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Lưu & Đồng bộ Google"
                >
                  {isSavingGoogleColor ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Check size={15} className="stroke-[3]" />
                  )}
                  <span>Lưu & Đồng Bộ</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── MODAL: THÊM SỰ KIỆN GOOGLE CALENDAR (Icon-Only Category Row) ── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 flex items-center justify-center shadow-xs">
                  <GoogleCalendarIcon size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Thêm sự kiện Google Calendar</h3>
                  <p className="text-[10.5px] text-slate-400 font-medium">Tự động đồng bộ lên Google Calendar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="p-5 space-y-3.5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">
                  Tiêu đề sự kiện *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Lịch học React, Deadline Đồ án, Họp nhóm..."
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* Nhóm sự kiện: CÙNG DÒNG ICON-ONLY (AI & Category Icons) */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">
                  Nhóm sự kiện (Bấm chọn biểu tượng)
                </label>
                <div className="flex items-center justify-between gap-1 bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                  {/* AI Button */}
                  <button
                    type="button"
                    onClick={() => setNewPresetKey('auto')}
                    className={`flex-1 py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      newPresetKey === 'auto'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-xs scale-105 font-black'
                        : 'hover:bg-white dark:hover:bg-slate-700 text-amber-500 border-transparent'
                    }`}
                    title="Nhận diện AI Tự Động theo từ khóa"
                  >
                    <Sparkles size={16} />
                    <span className="text-[9px]">AI</span>
                  </button>

                  {PRESET_CATEGORIES.map(cat => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setNewPresetKey(cat.key)}
                      className={`flex-1 py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        newPresetKey === cat.key
                          ? 'ring-2 ring-indigo-500 bg-white dark:bg-slate-800 border-indigo-400 shadow-xs scale-105'
                          : 'hover:bg-white dark:hover:bg-slate-700/60 border-transparent text-slate-600 dark:text-slate-300'
                      }`}
                      title={`${cat.label}: ${cat.desc}`}
                    >
                      <span className="text-base leading-none">{cat.icon}</span>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.defaultHex }} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">
                    Ngày
                  </label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">
                    Bắt đầu
                  </label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={e => setNewStartTime(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">
                    Kết thúc
                  </label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={e => setNewEndTime(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">
                  Địa điểm (tuỳ chọn)
                </label>
                <div className="relative">
                  <MapPin size={13} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="VD: Phòng 302 Giảng đường B, 123 Cầu Giấy, Google Meet..."
                    value={newLocation}
                    onChange={e => setNewLocation(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">
                  Ghi chú (tuỳ chọn)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú thêm về sự kiện..."
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Form Action Buttons on the same row */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
                  title="Hủy"
                >
                  <X size={16} />
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newTitle.trim()}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl transition shadow-md disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  title="Thêm sự kiện"
                >
                  {isCreating ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <Check size={14} className="stroke-[3]" />
                  )}
                  <span>Thêm sự kiện</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
