import {
    LayoutDashboard, Workflow, CalendarDays, RefreshCw, Wallet, Brain, FileText, GraduationCap, Timer,
    BookOpen, Flame, Headphones, Target, Music, LockKeyhole, BarChart3, ArrowRightLeft, Bot, KanbanSquare,
    StickyNote, Bookmark, Sparkles, type LucideIcon
} from 'lucide-react';
import type { BentoKey, MarqueeKey, StoryKey } from './i18n';
import { images } from './media.gen';
import type { Img } from './motion/Media';

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
        main: images['story-google']
    },
    {
        key: 'ai',
        id: 'ai-advisor',
        icons: [Wallet, FileText, GraduationCap, Sparkles],
        main: images['story-ai'],
        sub: images['story-ai-sub']
    },
    {
        key: 'kanban',
        id: 'schedule',
        icons: [KanbanSquare, CalendarDays, StickyNote, Bookmark],
        main: images['story-kanban']
    },
    {
        key: 'finance',
        id: 'finance',
        icons: [BarChart3, Wallet, ArrowRightLeft, Bot],
        main: images['story-finance'],
        sub: images['story-finance-sub']
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
    { key: 'visual', id: 'visual-board', icon: LayoutDashboard, img: images['bento-visual'], span: 'md:col-span-4' },
    { key: 'journal', id: 'journal', icon: BookOpen, img: images['bento-journal'], span: 'md:col-span-2' },
    { key: 'habit', id: 'habit-tracker', icon: Flame, img: images['bento-habit'], span: 'md:col-span-2' },
    { key: 'focus', id: 'focus-music', icon: Headphones, img: images['bento-focus'], span: 'md:col-span-2' },
    { key: 'gpa', id: 'gpa-tracker', icon: GraduationCap, img: images['bento-gpa'], span: 'md:col-span-2' },
    { key: 'goals', id: 'career-life-goals', icon: Target, img: images['bento-goals'], span: 'md:col-span-2' },
    { key: 'spotify', id: 'spotify', icon: Music, img: images['bento-spotify'], span: 'md:col-span-2', dark: true },
    { key: 'storage', id: 'secure-storage', icon: LockKeyhole, img: images['bento-storage'], span: 'md:col-span-2' }
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
