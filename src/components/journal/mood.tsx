import React from 'react';
import { Annoyed, Frown, Laugh, LucideIcon, Meh, Smile } from 'lucide-react';
import { MoodLevel } from '../../types';

// Moods are stored as numbers 1–5, so the icons and colours live only here.
// `hex` is used where a class cannot be (chart, calendar dots).
export interface Mood {
    level: MoodLevel;
    label: string;
    Icon: LucideIcon;
    tile: string;
    solid: string;
    hex: string;
}

export const MOODS: Record<MoodLevel, Mood> = {
    1: { level: 1, label: 'Rất tệ', Icon: Frown, tile: 'bg-rose-50 text-rose-700', solid: 'bg-rose-500', hex: '#f43f5e' },
    2: { level: 2, label: 'Không tốt', Icon: Annoyed, tile: 'bg-amber-50 text-amber-700', solid: 'bg-amber-500', hex: '#f59e0b' },
    3: { level: 3, label: 'Bình thường', Icon: Meh, tile: 'bg-zinc-100 text-zinc-700', solid: 'bg-zinc-400', hex: '#a1a1aa' },
    4: { level: 4, label: 'Tốt', Icon: Smile, tile: 'bg-emerald-50 text-emerald-700', solid: 'bg-emerald-500', hex: '#10b981' },
    5: { level: 5, label: 'Tuyệt vời', Icon: Laugh, tile: 'bg-violet-50 text-violet-700', solid: 'bg-violet-500', hex: '#8b5cf6' },
};

export const MOOD_LEVELS: MoodLevel[] = [1, 2, 3, 4, 5];

export const getMood = (level?: number | null): Mood | null =>
    level && level >= 1 && level <= 5 ? MOODS[level as MoodLevel] : null;

// Rounded tile with the mood icon; a neutral pen icon when no mood was picked.
export const MoodTile: React.FC<{ level?: number | null; size?: 'sm' | 'md'; fallback?: React.ReactNode }> = ({
    level,
    size = 'md',
    fallback,
}) => {
    const mood = getMood(level);
    const box = size === 'sm' ? 'h-8 w-8 rounded-[10px]' : 'h-10 w-10 rounded-xl';
    const iconSize = size === 'sm' ? 16 : 19;
    return (
        <span className={`flex shrink-0 items-center justify-center ${box} ${mood ? mood.tile : 'bg-zinc-100 text-zinc-400'}`}>
            {mood ? <mood.Icon size={iconSize} strokeWidth={1.75} aria-hidden /> : fallback}
        </span>
    );
};
