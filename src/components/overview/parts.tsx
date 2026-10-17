import React from 'react';
import { Bell, Flag, MapPin } from 'lucide-react';
import { GoogleCalendarIcon } from '../icons/GoogleCalendarIcon';

// Overview-specific pieces. The generic primitives live in ../ui/parts and are re-exported here.
export { Card, CardHeader, LinkButton, Metric, Progress, Segmented } from '../ui/parts';

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
