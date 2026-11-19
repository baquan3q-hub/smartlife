// File: src/components/sticky/stickyTheme.ts
// Bảng màu giấy note — pastel ở light mode, trầm ở dark mode.

import { StickyColor } from '../../services/stickyNoteService';

export interface StickyTheme {
  name: string;
  /** Nền thân note */
  card: string;
  /** Dải màu đậm phía trên */
  bar: string;
  /** Chấm chọn màu */
  dot: string;
  /** Màu chữ placeholder / phụ */
  muted: string;
  /** Màu nền HEX cho cửa sổ desktop */
  hex: string;
}

export const STICKY_THEME: Record<StickyColor, StickyTheme> = {
  yellow: {
    name: 'Vàng',
    card: 'bg-[#FFF8C5] text-slate-800 dark:bg-[#3d3720] dark:text-amber-50',
    bar: 'bg-[#FDE68A] dark:bg-[#5a4f22]',
    dot: 'bg-[#FCD34D]',
    muted: 'text-amber-900/50 dark:text-amber-100/40',
    hex: '#FFF8C5',
  },
  green: {
    name: 'Xanh lá',
    card: 'bg-[#E3F9E5] text-slate-800 dark:bg-[#1f3a2a] dark:text-emerald-50',
    bar: 'bg-[#BBF7D0] dark:bg-[#285239]',
    dot: 'bg-[#4ADE80]',
    muted: 'text-emerald-900/50 dark:text-emerald-100/40',
    hex: '#E3F9E5',
  },
  pink: {
    name: 'Hồng',
    card: 'bg-[#FFE4EF] text-slate-800 dark:bg-[#43222f] dark:text-pink-50',
    bar: 'bg-[#FBCFE8] dark:bg-[#5c2c40]',
    dot: 'bg-[#F472B6]',
    muted: 'text-pink-900/50 dark:text-pink-100/40',
    hex: '#FFE4EF',
  },
  purple: {
    name: 'Tím',
    card: 'bg-[#EFE7FF] text-slate-800 dark:bg-[#2f2747] dark:text-violet-50',
    bar: 'bg-[#DDD6FE] dark:bg-[#40355f]',
    dot: 'bg-[#A78BFA]',
    muted: 'text-violet-900/50 dark:text-violet-100/40',
    hex: '#EFE7FF',
  },
  blue: {
    name: 'Xanh dương',
    card: 'bg-[#E0F2FE] text-slate-800 dark:bg-[#1e3247] dark:text-sky-50',
    bar: 'bg-[#BAE6FD] dark:bg-[#284660]',
    dot: 'bg-[#38BDF8]',
    muted: 'text-sky-900/50 dark:text-sky-100/40',
    hex: '#E0F2FE',
  },
  gray: {
    name: 'Xám',
    card: 'bg-[#F1F5F9] text-slate-800 dark:bg-[#2a2f37] dark:text-slate-100',
    bar: 'bg-[#E2E8F0] dark:bg-[#383f4a]',
    dot: 'bg-[#94A3B8]',
    muted: 'text-slate-500 dark:text-slate-400',
    hex: '#F1F5F9',
  },
  charcoal: {
    name: 'Than',
    card: 'bg-[#334155] text-slate-50 dark:bg-[#1b2230] dark:text-slate-50',
    bar: 'bg-[#1E293B] dark:bg-[#111827]',
    dot: 'bg-[#334155]',
    muted: 'text-slate-300/60',
    hex: '#334155',
  },
};

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return '';
  const min = Math.round(diff / 60000);
  if (min < 1) return 'vừa xong';
  if (min < 60) return `${min} phút trước`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

export const DEVICE_LABEL: Record<string, string> = {
  web: 'Web',
  mobile: 'Điện thoại',
  desktop: 'Windows',
  bot: 'Trợ lý AI',
};
