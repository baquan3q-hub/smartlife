import React from 'react';
import { ArrowUpRight, Bell, Flag, MapPin } from 'lucide-react';
import { GoogleCalendarIcon } from '../icons/GoogleCalendarIcon';

// Small building blocks for the Overview screen. Same look as the landing page:
// zinc neutrals, one sky accent, hairline borders, 20px radius, no gradients.

export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
    <section className={`rounded-[20px] border border-zinc-900/[0.08] bg-white ${className}`}>{children}</section>
);

interface CardHeaderProps {
    title: string;
    meta?: React.ReactNode;
    action?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ title, meta, action }) => (
    <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="flex min-w-0 items-baseline gap-2">
            <h2 className="truncate text-[15px] font-semibold tracking-tight text-zinc-950">{title}</h2>
            {meta !== undefined && <span className="shrink-0 text-[13px] tabular-nums text-zinc-400">{meta}</span>}
        </div>
        {action}
    </div>
);

export const LinkButton: React.FC<{ onClick?: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-[13px] font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
    >
        {children}
        <ArrowUpRight size={14} />
    </button>
);

export const Progress: React.FC<{ value: number }> = ({ value }) => (
    <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-sky-600 transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
);

interface SegmentedProps<T extends string> {
    value: T;
    options: { id: T; label: string }[];
    onChange: (id: T) => void;
    label: string;
}

export function Segmented<T extends string>({ value, options, onChange, label }: SegmentedProps<T>) {
    return (
        <div role="tablist" aria-label={label} className="inline-flex shrink-0 rounded-full bg-zinc-100 p-0.5">
            {options.map(o => (
                <button
                    key={o.id}
                    type="button"
                    role="tab"
                    aria-selected={value === o.id}
                    onClick={() => onChange(o.id)}
                    className={`rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors ${value === o.id ? 'bg-white text-zinc-950 shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-zinc-500 hover:text-zinc-800'}`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

interface MetricProps {
    label: string;
    icon: React.ReactNode;
    value: React.ReactNode;
    sub?: React.ReactNode;
    onClick?: () => void;
    // Extra control in the top-right corner (e.g. hide balance). Clicks on it do not trigger onClick.
    action?: React.ReactNode;
}

// A metric tile. The whole tile is one button; `action` sits above it so it can be pressed on its own.
export const Metric: React.FC<MetricProps> = ({ label, icon, value, sub, onClick, action }) => (
    <div className="relative rounded-[20px] border border-zinc-900/[0.08] bg-white p-4 transition-colors hover:border-zinc-900/[0.18]">
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="absolute inset-0 rounded-[20px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
        />
        <div className="pointer-events-none relative flex items-center justify-between gap-2 text-[13px] text-zinc-500">
            <span className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 text-zinc-400">{icon}</span>
                <span className="truncate">{label}</span>
            </span>
            {action && <span className="pointer-events-auto -m-1">{action}</span>}
        </div>
        <div className="pointer-events-none relative mt-3 truncate text-[20px] font-semibold tracking-tight tabular-nums text-zinc-950 sm:text-[22px]">
            {value}
        </div>
        {sub && <div className="pointer-events-none relative mt-1 truncate text-[12px] text-zinc-500">{sub}</div>}
    </div>
);

export const formatBeforeMinutes = (minutes?: number) => {
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

const formatUntil = (min: number) => {
    if (min < 60) return `còn ${min} phút`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `còn ${h}h${m}p` : `còn ${h} giờ`;
};

export type EventState = 'allday' | 'past' | 'now' | 'next' | 'later';

export interface OverviewEvent {
    id: string;
    title: string;
    start_time: string;
    end_time?: string;
    location?: string;
    isGoogleEvent: boolean;
    isCalendarEvent: boolean;
    holidayNote: string | null;
    email_notify?: boolean;
    email_notify_before_minutes?: number;
    state?: EventState;
    minutesUntil?: number | null;
}

// One row of the day timeline: time, a dot on the rail, then title and details.
export const EventRow: React.FC<{ ev: OverviewEvent; last: boolean }> = ({ ev, last }) => {
    const past = ev.state === 'past';
    const active = ev.state === 'now' || ev.state === 'next';
    return (
        <li className="flex gap-3">
            <div className="w-12 shrink-0 pt-3 text-right tabular-nums">
                <div className={`text-[13px] font-medium ${past ? 'text-zinc-400' : active ? 'text-sky-700' : 'text-zinc-900'}`}>{ev.start_time}</div>
                {ev.end_time && <div className="text-[12px] text-zinc-400">{ev.end_time}</div>}
            </div>
            <div className="relative flex w-3 shrink-0 justify-center" aria-hidden>
                {!last && <span className="absolute bottom-0 top-0 w-px bg-zinc-200" />}
                <span
                    className={`relative mt-[18px] h-2.5 w-2.5 rounded-full border-2 ${active ? 'border-sky-600 bg-sky-600 ring-4 ring-sky-100' : past ? 'border-zinc-300 bg-white' : 'border-zinc-400 bg-white'}`}
                />
            </div>
            <div className={`mb-1.5 min-w-0 flex-1 rounded-2xl px-3 py-2.5 ${active ? 'bg-sky-50/70' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                    <div className={`min-w-0 text-[14px] font-medium leading-snug ${past ? 'text-zinc-400 line-through decoration-zinc-300' : 'text-zinc-950'}`}>
                        {ev.isGoogleEvent && <GoogleCalendarIcon size={13} className="mr-1.5 inline-block -translate-y-px" />}
                        {ev.title}
                    </div>
                    {ev.state === 'now' && <span className="shrink-0 rounded-full bg-sky-600 px-2 py-0.5 text-[11px] font-medium text-white">Đang diễn ra</span>}
                    {ev.state === 'next' && ev.minutesUntil != null && (
                        <span className="shrink-0 text-[12px] font-medium tabular-nums text-sky-700">{formatUntil(ev.minutesUntil)}</span>
                    )}
                </div>
                {(ev.location || ev.holidayNote || ev.email_notify || (ev.isCalendarEvent && !ev.isGoogleEvent)) && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-zinc-500">
                        {ev.isCalendarEvent && !ev.isGoogleEvent && <span>Lịch hẹn</span>}
                        {ev.holidayNote && (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                                <Flag size={11} /> {ev.holidayNote}
                            </span>
                        )}
                        {ev.location && (
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex min-w-0 max-w-full items-center gap-1 hover:text-sky-700 hover:underline"
                                title="Mở Google Maps"
                            >
                                <MapPin size={11} className="shrink-0" />
                                <span className="truncate">{ev.location}</span>
                            </a>
                        )}
                        {ev.email_notify && (
                            <span className="inline-flex items-center gap-1">
                                <Bell size={11} /> Gmail ({formatBeforeMinutes(ev.email_notify_before_minutes)})
                            </span>
                        )}
                    </div>
                )}
            </div>
        </li>
    );
};
