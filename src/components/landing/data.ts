import {
    LayoutDashboard, Workflow, CalendarDays, RefreshCw, Wallet, Brain, FileText, GraduationCap, Timer,
    BookOpen, Flame, Headphones, Target, Music, LockKeyhole, BarChart3, ArrowRightLeft, Bot, KanbanSquare,
    StickyNote, Bookmark, Sparkles, type LucideIcon
} from 'lucide-react';
import type { BentoKey, MarqueeKey, StoryKey } from './i18n';

interface Img {
    src: string;
    w: number;
    h: number;
}

export interface StoryDef {
    key: StoryKey;
    id: string;
    icons: LucideIcon[];
    main: Img;
    sub?: Img;
}

export const stories: StoryDef[] = [
    {
        key: 'google',
        id: 'google-ecosystem',
        icons: [LayoutDashboard, Workflow, CalendarDays, RefreshCw],
        main: { src: '/smartlife-google-ecosystem.jpg', w: 1376, h: 768 }
    },
    {
        key: 'ai',
        id: 'ai-advisor',
        icons: [Wallet, FileText, GraduationCap, Sparkles],
        main: { src: '/ai-feature-main.png', w: 1107, h: 805 },
        sub: { src: '/ai-feature-sub.png', w: 726, h: 640 }
    },
    {
        key: 'kanban',
        id: 'schedule',
        icons: [KanbanSquare, CalendarDays, StickyNote, Bookmark],
        main: { src: '/assets/schedule_preview.png', w: 1840, h: 802 }
    },
    {
        key: 'finance',
        id: 'finance',
        icons: [BarChart3, Wallet, ArrowRightLeft, Bot],
        main: { src: '/assets/finance_preview.png', w: 754, h: 781 },
        sub: { src: '/finance_preview2.png', w: 1101, h: 690 }
    }
];

export interface BentoDef {
    key: BentoKey;
    id: string;
    icon: LucideIcon;
    img: Img;
    span: string;
    dark?: boolean;
}

// 6-column grid on desktop: rows are 4+2, 2+2+2, 2+2+2
export const bento: BentoDef[] = [
    { key: 'visual', id: 'visual-board', icon: LayoutDashboard, img: { src: '/assets/visual-board-preview.png', w: 1096, h: 805 }, span: 'md:col-span-4' },
    { key: 'journal', id: 'journal', icon: BookOpen, img: { src: '/journey1.png', w: 1505, h: 797 }, span: 'md:col-span-2' },
    { key: 'habit', id: 'habit-tracker', icon: Flame, img: { src: '/habitprimary.png', w: 1504, h: 799 }, span: 'md:col-span-2' },
    { key: 'focus', id: 'focus-music', icon: Headphones, img: { src: '/assets/focus_feature_2.png', w: 1815, h: 761 }, span: 'md:col-span-2' },
    { key: 'gpa', id: 'gpa-tracker', icon: GraduationCap, img: { src: '/GPA1.png', w: 1812, h: 806 }, span: 'md:col-span-2' },
    { key: 'goals', id: 'career-life-goals', icon: Target, img: { src: '/goalscareer1.png', w: 1511, h: 787 }, span: 'md:col-span-2' },
    { key: 'spotify', id: 'spotify', icon: Music, img: { src: '/assets/spotify_preview_2.png', w: 1024, h: 565 }, span: 'md:col-span-2', dark: true },
    { key: 'storage', id: 'secure-storage', icon: LockKeyhole, img: { src: '/assets/storage_feature_1.png', w: 1024, h: 658 }, span: 'md:col-span-2' }
];

export const marquee: { key: MarqueeKey; icon: LucideIcon; target: string }[] = [
    { key: 'google', icon: RefreshCw, target: 'google-ecosystem' },
    { key: 'kanban', icon: KanbanSquare, target: 'schedule' },
    { key: 'ai', icon: Brain, target: 'ai-advisor' },
    { key: 'career', icon: Target, target: 'ai-advisor' },
    { key: 'cv', icon: FileText, target: 'ai-advisor' },
    { key: 'journal', icon: BookOpen, target: 'journal' },
    { key: 'gpa', icon: GraduationCap, target: 'gpa-tracker' },
    { key: 'finance', icon: Wallet, target: 'finance' },
    { key: 'spotify', icon: Music, target: 'spotify' },
    { key: 'habit', icon: Flame, target: 'habit-tracker' },
    { key: 'focus', icon: Timer, target: 'focus-music' },
    { key: 'storage', icon: LockKeyhole, target: 'secure-storage' }
];
