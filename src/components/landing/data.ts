import type { GlassIconName } from '../icons/glassIcons';
import type { BentoKey, MarqueeKey, ProblemApp, StoryKey } from './i18n';
import { images } from './media.gen';
import type { Img } from './motion/Media';

export interface StoryDef {
    key: StoryKey;
    id: string;
    icons: GlassIconName[];
    main: Img;
    sub?: Img;
}

export const stories: StoryDef[] = [
    {
        key: 'google',
        id: 'google-ecosystem',
        icons: ['overview', 'kanban', 'schedule', 'sync'],
        main: images['story-google']
    },
    {
        key: 'ai',
        id: 'ai-advisor',
        icons: ['finance', 'cv', 'gpa', 'ai'],
        main: images['story-ai'],
        sub: images['story-ai-sub']
    },
    {
        key: 'kanban',
        id: 'schedule',
        icons: ['kanban', 'schedule', 'sticky', 'bookmark'],
        main: images['story-kanban']
    },
    {
        key: 'finance',
        id: 'finance',
        icons: ['chart', 'finance', 'cashflow', 'ai'],
        main: images['story-finance'],
        sub: images['story-finance-sub']
    }
];

export interface BentoDef {
    key: BentoKey;
    id: string;
    icon: GlassIconName;
    img: Img;
    span: string;
    dark?: boolean;
}

// 6-column grid on desktop: rows are 4+2, 2+2+2, 2+2+2
export const bento: BentoDef[] = [
    { key: 'visual', id: 'visual-board', icon: 'overview', img: images['bento-visual'], span: 'md:col-span-4' },
    { key: 'journal', id: 'journal', icon: 'book', img: images['bento-journal'], span: 'md:col-span-2' },
    { key: 'habit', id: 'habit-tracker', icon: 'habit', img: images['bento-habit'], span: 'md:col-span-2' },
    { key: 'focus', id: 'focus-music', icon: 'focus', img: images['bento-focus'], span: 'md:col-span-2' },
    { key: 'gpa', id: 'gpa-tracker', icon: 'gpa', img: images['bento-gpa'], span: 'md:col-span-2' },
    { key: 'goals', id: 'career-life-goals', icon: 'goals', img: images['bento-goals'], span: 'md:col-span-2' },
    { key: 'spotify', id: 'spotify', icon: 'music', img: images['bento-spotify'], span: 'md:col-span-2', dark: true },
    { key: 'storage', id: 'secure-storage', icon: 'storage', img: images['bento-storage'], span: 'md:col-span-2' }
];

export const marquee: { key: MarqueeKey; icon: GlassIconName; target: string }[] = [
    { key: 'google', icon: 'sync', target: 'google-ecosystem' },
    { key: 'kanban', icon: 'kanban', target: 'schedule' },
    { key: 'ai', icon: 'ai', target: 'ai-advisor' },
    { key: 'career', icon: 'goals', target: 'ai-advisor' },
    { key: 'cv', icon: 'cv', target: 'ai-advisor' },
    { key: 'journal', icon: 'book', target: 'journal' },
    { key: 'gpa', icon: 'gpa', target: 'gpa-tracker' },
    { key: 'finance', icon: 'finance', target: 'finance' },
    { key: 'spotify', icon: 'music', target: 'spotify' },
    { key: 'habit', icon: 'habit', target: 'habit-tracker' },
    { key: 'focus', icon: 'timer', target: 'focus-music' },
    { key: 'storage', icon: 'storage', target: 'secure-storage' }
];

export type EcosystemKey =
    | 'gpa'
    | 'career'
    | 'cv'
    | 'finance'
    | 'google'
    | 'kanban'
    | 'journal'
    | 'pomodoro'
    | 'habits'
    | 'storage';

export interface EcosystemDef {
    key: EcosystemKey;
    id: string;
    icon: GlassIconName;
    img?: Img;
    color: string;
}

export const ecosystemModules: EcosystemDef[] = [
    { key: 'gpa', id: 'gpa-tracker', icon: 'gpa', img: images['bento-gpa'], color: '#0284c7' },
    { key: 'career', id: 'ai-advisor', icon: 'ai', img: images['story-ai'], color: '#8b5cf6' },
    { key: 'cv', id: 'ai-advisor', icon: 'cv', img: images['story-ai-sub'], color: '#06b6d4' },
    { key: 'finance', id: 'finance', icon: 'finance', img: images['story-finance'], color: '#10b981' },
    { key: 'google', id: 'google-ecosystem', icon: 'sync', img: images['story-google'], color: '#f59e0b' },
    { key: 'kanban', id: 'schedule', icon: 'kanban', img: images['story-kanban'], color: '#3b82f6' },
    { key: 'journal', id: 'journal', icon: 'journal', img: images['bento-journal'], color: '#ec4899' },
    { key: 'pomodoro', id: 'focus-music', icon: 'focus', img: images['bento-focus'], color: '#f97316' },
    { key: 'habits', id: 'habit-tracker', icon: 'habit', img: images['bento-habit'], color: '#eab308' },
    { key: 'storage', id: 'secure-storage', icon: 'storage', img: images['bento-storage'], color: '#6366f1' }
];


// The scattered apps a student juggles before SmartLife, with where each tile starts (% offset from the stage centre).
export const problemApps: { key: ProblemApp; icon: GlassIconName; x: number; y: number }[] = [
    { key: 'notes', icon: 'sticky', x: -34, y: -30 },
    { key: 'timetable', icon: 'schedule', x: 4, y: -40 },
    { key: 'sheet', icon: 'chart', x: 34, y: -26 },
    { key: 'todo', icon: 'tasks', x: 40, y: 6 },
    { key: 'music', icon: 'music', x: 28, y: 34 },
    { key: 'timer', icon: 'timer', x: -6, y: 40 },
    { key: 'diary', icon: 'book', x: -36, y: 26 },
    { key: 'gpa', icon: 'gpa', x: -42, y: -2 }
];

// The day runs morning → night; each chapter reuses a story (copy + screenshots) and keeps its old anchor id.
export const dayOrder: StoryKey[] = ['kanban', 'google', 'finance', 'ai'];
export const dayGround: Record<StoryKey, string> = {
    kanban: '#f6f4ef',
    google: '#ffffff',
    finance: '#efe7da',
    ai: '#0b0d12'
};
