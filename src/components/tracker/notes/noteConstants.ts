// File: src/components/tracker/notes/noteConstants.ts
import { NoteLabelType } from '../../../types';

export interface LabelConfig {
  key: NoteLabelType;
  label: string;
  vietnameseLabel: string;
  description: string;
  iconName: string;
  colorClass: {
    bg: string;
    text: string;
    border: string;
    badge: string;
    activeTab: string;
    dot: string;
    gradient: string;
  };
}

export const NOTE_LABELS: Record<NoteLabelType, LabelConfig> = {
  Work: {
    key: 'Work',
    label: 'Work',
    vietnameseLabel: 'Công việc',
    description: 'Cuộc họp nhanh, dự án, công việc chuyên môn',
    iconName: 'Briefcase',
    colorClass: {
      bg: 'bg-indigo-50/80',
      text: 'text-indigo-700',
      border: 'border-indigo-200/70',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
      activeTab: 'bg-indigo-600 text-white shadow-indigo-200',
      dot: 'bg-indigo-500',
      gradient: 'from-indigo-500 to-blue-600'
    }
  },
  University: {
    key: 'University',
    label: 'University',
    vietnameseLabel: 'Học tập / Đại học',
    description: 'Giảng đường, bài tập lớn, đồ án môn học',
    iconName: 'GraduationCap',
    colorClass: {
      bg: 'bg-emerald-50/80',
      text: 'text-emerald-700',
      border: 'border-emerald-200/70',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      activeTab: 'bg-emerald-600 text-white shadow-emerald-200',
      dot: 'bg-emerald-500',
      gradient: 'from-emerald-500 to-teal-600'
    }
  },
  Reminder: {
    key: 'Reminder',
    label: 'Reminder',
    vietnameseLabel: 'Nhắc nhở',
    description: 'Việc gấp, hạn chót cần lưu ý, thông báo',
    iconName: 'Bell',
    colorClass: {
      bg: 'bg-amber-50/80',
      text: 'text-amber-700',
      border: 'border-amber-200/70',
      badge: 'bg-amber-50 text-amber-700 border-amber-200/80',
      activeTab: 'bg-amber-500 text-white shadow-amber-200',
      dot: 'bg-amber-500',
      gradient: 'from-amber-500 to-orange-500'
    }
  },
  Learning: {
    key: 'Learning',
    label: 'Learning',
    vietnameseLabel: 'Kiến thức / Sách',
    description: 'Kiến thức mới, bài học đọc được, tài liệu',
    iconName: 'BookOpen',
    colorClass: {
      bg: 'bg-sky-50/80',
      text: 'text-sky-700',
      border: 'border-sky-200/70',
      badge: 'bg-sky-50 text-sky-700 border-sky-200/80',
      activeTab: 'bg-sky-600 text-white shadow-sky-200',
      dot: 'bg-sky-500',
      gradient: 'from-sky-500 to-cyan-600'
    }
  },
  'ToDo-List': {
    key: 'ToDo-List',
    label: 'ToDo-List',
    vietnameseLabel: 'Danh sách việc',
    description: 'Đầu mục việc cần làm, checklist phát sinh',
    iconName: 'CheckSquare',
    colorClass: {
      bg: 'bg-purple-50/80',
      text: 'text-purple-700',
      border: 'border-purple-200/70',
      badge: 'bg-purple-50 text-purple-700 border-purple-200/80',
      activeTab: 'bg-purple-600 text-white shadow-purple-200',
      dot: 'bg-purple-500',
      gradient: 'from-purple-500 to-fuchsia-600'
    }
  },
  Ideas: {
    key: 'Ideas',
    label: 'Ideas',
    vietnameseLabel: 'Ý tưởng',
    description: 'Ý tưởng sáng tạo đột xuất, giải pháp mới',
    iconName: 'Lightbulb',
    colorClass: {
      bg: 'bg-rose-50/80',
      text: 'text-rose-700',
      border: 'border-rose-200/70',
      badge: 'bg-rose-50 text-rose-700 border-rose-200/80',
      activeTab: 'bg-rose-600 text-white shadow-rose-200',
      dot: 'bg-rose-500',
      gradient: 'from-rose-500 to-pink-600'
    }
  }
};

export const DEFAULT_NOTE_LABELS_LIST: NoteLabelType[] = [
  'Work',
  'University',
  'Reminder',
  'Learning',
  'ToDo-List',
  'Ideas'
];
