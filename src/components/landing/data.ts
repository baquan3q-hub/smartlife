import type { GlassIconName } from '../icons/glassIcons';
import type { BentoKey, MarqueeKey, StoryKey } from './i18n';
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
