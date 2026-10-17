import React, { useState } from 'react';
import {
    Activity, Apple, Baby, Ban, Bike, BookOpen, Brain, Briefcase, Cake, CalendarDays, CalendarHeart, Camera, Car, Check,
    CigaretteOff, Circle, Clock, Code, Coffee, Dog, Droplets, Dumbbell, Flag, Flame, Flower2, Footprints, Gamepad2, Gift,
    GraduationCap, Heart, HeartPulse, House, Languages, Laptop, Leaf, Lightbulb, LucideIcon, Moon, Music, NotebookPen,
    Palette, PartyPopper, PenLine, Phone, PiggyBank, Pill, Plane, Salad, ShoppingCart, Smile, Sparkles, Sprout, Star, Sun,
    Target, Trophy, Users, Utensils, Wallet, Waves,
} from 'lucide-react';

// Icons for habits, countdowns and count-ups.
// New items store "lucide:<key>" in the existing `icon` column; older rows hold an emoji and are rendered as text,
// so no data migration is needed.

const PREFIX = 'lucide:';

export const ICON_GROUPS: { id: string; label: string; icons: Record<string, LucideIcon> }[] = [
    {
        id: 'health',
        label: 'Sức khỏe',
        icons: {
            dumbbell: Dumbbell, footprints: Footprints, bike: Bike, waves: Waves, 'heart-pulse': HeartPulse, activity: Activity,
            droplets: Droplets, apple: Apple, salad: Salad, pill: Pill, moon: Moon, sun: Sun,
        },
    },
    {
        id: 'study',
        label: 'Học & làm',
        icons: {
            'book-open': BookOpen, 'graduation-cap': GraduationCap, laptop: Laptop, code: Code, 'pen-line': PenLine,
            'notebook-pen': NotebookPen, languages: Languages, brain: Brain, briefcase: Briefcase, lightbulb: Lightbulb,
            target: Target, clock: Clock,
        },
    },
    {
        id: 'mind',
        label: 'Tinh thần',
        icons: {
            flower: Flower2, leaf: Leaf, sprout: Sprout, smile: Smile, heart: Heart, sparkles: Sparkles, coffee: Coffee,
            music: Music, palette: Palette, camera: Camera, 'gamepad': Gamepad2, ban: Ban, 'cigarette-off': CigaretteOff,
        },
    },
    {
        id: 'life',
        label: 'Đời sống',
        icons: {
            house: House, utensils: Utensils, 'shopping-cart': ShoppingCart, wallet: Wallet, 'piggy-bank': PiggyBank,
            users: Users, phone: Phone, dog: Dog, baby: Baby, car: Car, plane: Plane, check: Check,
        },
    },
    {
        id: 'events',
        label: 'Sự kiện',
        icons: {
            calendar: CalendarDays, 'calendar-heart': CalendarHeart, cake: Cake, gift: Gift, 'party-popper': PartyPopper,
            trophy: Trophy, star: Star, flag: Flag, flame: Flame,
        },
    },
];

const ICONS: Record<string, LucideIcon> = Object.assign({}, ...ICON_GROUPS.map(g => g.icons));

export const isLucideIcon = (icon?: string | null) => !!icon && icon.startsWith(PREFIX);
export const lucideIcon = (key: string) => `${PREFIX}${key}`;

// Plain-text form of an icon for places that cannot render components (AI prompts, titles).
export const iconText = (icon?: string | null) => (!icon || isLucideIcon(icon) ? '' : icon);

export const DEFAULT_ICON = {
    habit: lucideIcon('target'),
    countdown: lucideIcon('calendar'),
    countup: lucideIcon('flag'),
} as const;

// Renders a stored icon value: a Lucide icon for "lucide:<key>", the emoji itself otherwise.
export const HabitIcon: React.FC<{ icon?: string | null; size?: number; className?: string; strokeWidth?: number }> = ({
    icon,
    size = 18,
    className = '',
    strokeWidth = 1.75,
}) => {
    if (isLucideIcon(icon)) {
        const Cmp = ICONS[icon!.slice(PREFIX.length)] || Circle;
        return <Cmp size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
    }
    return (
        <span className={`leading-none ${className}`} style={{ fontSize: Math.round(size * 1.05) }} aria-hidden>
            {icon || '•'}
        </span>
    );
};

// ── Tints ──
// Six muted colours. `tile` is the soft background + text used for icon tiles, `solid` the fill used for
// "done" states and the history grid, `text` an accent colour for numbers.
export interface Tint {
    id: string;
    label: string;
    tile: string;
    solid: string;
    text: string;
    swatch: string;
}

export const TINTS: Tint[] = [
    { id: 'sky', label: 'Xanh dương', tile: 'bg-sky-50 text-sky-700', solid: 'bg-sky-500', text: 'text-sky-700', swatch: 'bg-sky-500' },
    { id: 'emerald', label: 'Xanh lá', tile: 'bg-emerald-50 text-emerald-700', solid: 'bg-emerald-500', text: 'text-emerald-700', swatch: 'bg-emerald-500' },
    { id: 'amber', label: 'Vàng', tile: 'bg-amber-50 text-amber-700', solid: 'bg-amber-500', text: 'text-amber-700', swatch: 'bg-amber-500' },
    { id: 'rose', label: 'Hồng', tile: 'bg-rose-50 text-rose-700', solid: 'bg-rose-500', text: 'text-rose-700', swatch: 'bg-rose-500' },
    { id: 'violet', label: 'Tím', tile: 'bg-violet-50 text-violet-700', solid: 'bg-violet-500', text: 'text-violet-700', swatch: 'bg-violet-500' },
    { id: 'zinc', label: 'Xám', tile: 'bg-zinc-100 text-zinc-700', solid: 'bg-zinc-500', text: 'text-zinc-700', swatch: 'bg-zinc-500' },
];

// Old gradient theme names (and the form's old defaults) mapped onto the new tints.
const LEGACY_TINT: Record<string, string> = {
    sunrise: 'amber', orange: 'amber', lava: 'rose', peach: 'rose',
    cosmic: 'violet', royal: 'violet', nature: 'emerald', ocean: 'sky', blue: 'sky', midnight: 'zinc',
};

export const getTint = (theme?: string | null): Tint => {
    const id = theme ? LEGACY_TINT[theme] || theme : 'sky';
    return TINTS.find(t => t.id === id) || TINTS[0];
};

// Rounded square holding an icon in its tint. `done` switches to the solid fill with a white icon.
export const IconTile: React.FC<{ icon?: string | null; theme?: string | null; size?: 'sm' | 'md' | 'lg'; done?: boolean }> = ({
    icon,
    theme,
    size = 'md',
    done = false,
}) => {
    const tint = getTint(theme);
    const box = size === 'lg' ? 'h-12 w-12 rounded-2xl' : size === 'sm' ? 'h-8 w-8 rounded-[10px]' : 'h-10 w-10 rounded-xl';
    const iconSize = size === 'lg' ? 22 : size === 'sm' ? 16 : 19;
    return (
        <span className={`flex shrink-0 items-center justify-center transition-colors ${box} ${done ? `${tint.solid} text-white` : tint.tile}`}>
            <HabitIcon icon={icon} size={iconSize} />
        </span>
    );
};

// ── Pickers used by the forms ──

export const TintPicker: React.FC<{ value: string; onChange: (id: string) => void }> = ({ value, onChange }) => {
    const current = getTint(value).id;
    return (
        <div role="radiogroup" aria-label="Màu" className="flex flex-wrap gap-2">
            {TINTS.map(t => (
                <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={current === t.id}
                    aria-label={t.label}
                    title={t.label}
                    onClick={() => onChange(t.id)}
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition-shadow ${current === t.id ? 'ring-2 ring-zinc-900/70 ring-offset-2 ring-offset-white' : ''}`}
                >
                    <span className={`h-6 w-6 rounded-full ${t.swatch}`} />
                </button>
            ))}
        </div>
    );
};

export const IconPicker: React.FC<{ value: string; onChange: (icon: string) => void; theme: string; defaultGroup?: string }> = ({
    value,
    onChange,
    theme,
    defaultGroup,
}) => {
    const initial = isLucideIcon(value)
        ? ICON_GROUPS.find(g => value.slice(PREFIX.length) in g.icons)?.id
        : undefined;
    const [group, setGroup] = useState(initial || defaultGroup || ICON_GROUPS[0].id);
    const tint = getTint(theme);
    const active = ICON_GROUPS.find(g => g.id === group) || ICON_GROUPS[0];
    const legacy = value && !isLucideIcon(value) ? value : null;

    return (
        <div>
            <div className="mb-2.5 flex flex-wrap gap-1">
                {ICON_GROUPS.map(g => (
                    <button
                        key={g.id}
                        type="button"
                        onClick={() => setGroup(g.id)}
                        aria-pressed={group === g.id}
                        className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${group === g.id ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900'}`}
                    >
                        {g.label}
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-7">
                {legacy && (
                    <IconChoice selected={value === legacy} tile={tint.tile} label="Biểu tượng hiện tại" onClick={() => onChange(legacy)}>
                        <HabitIcon icon={legacy} size={18} />
                    </IconChoice>
                )}
                {Object.entries(active.icons).map(([key, Cmp]) => {
                    const v = lucideIcon(key);
                    return (
                        <IconChoice key={key} selected={value === v} tile={tint.tile} label={key} onClick={() => onChange(v)}>
                            <Cmp size={18} strokeWidth={1.75} aria-hidden />
                        </IconChoice>
                    );
                })}
            </div>
        </div>
    );
};

const IconChoice: React.FC<{ selected: boolean; tile: string; label: string; onClick: () => void; children: React.ReactNode }> = ({
    selected,
    tile,
    label,
    onClick,
    children,
}) => (
    <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={selected}
        className={`flex aspect-square items-center justify-center rounded-xl transition-colors ${selected ? `${tile} ring-1 ring-inset ring-current` : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}`}
    >
        {children}
    </button>
);
