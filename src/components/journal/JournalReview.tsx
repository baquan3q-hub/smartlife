import React, { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Award, BookOpen, ChevronLeft, ChevronRight, Flame, Heart, PenLine, Search, Type, X } from 'lucide-react';
import { JournalEntry, JournalStats, MoodLevel } from '../../types';
import { getLocalDateString } from '../../services/journalService';
import { Button, Card, CardHeader, EmptyState, IconButton, inputClass } from '../ui/parts';
import { getMood, MOOD_LEVELS, MOODS, MoodTile } from './mood';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const PAGE = 10;

// "YYYY-MM-DD" as a local date (new Date(str) would parse it as UTC).
export const parseLocalDate = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
};

export const plainText = (html: string) =>
    html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

interface JournalReviewProps {
    entries: JournalEntry[];
    stats: JournalStats | null;
    loading: boolean;
    selectedDate: string;
    onOpenDate: (date: string) => void;
}

export const JournalReview: React.FC<JournalReviewProps> = ({ entries, stats, loading, selectedDate, onOpenDate }) => {
    const today = getLocalDateString(new Date());

    if (!loading && entries.length === 0) {
        return (
            <EmptyState
                icon={<BookOpen size={20} />}
                title="Chưa có bài nhật ký nào"
                hint="Viết bài đầu tiên, lịch cảm xúc và thống kê sẽ hiện ở đây."
                action={<Button variant="primary" onClick={() => onOpenDate(today)}><PenLine size={16} /> Viết hôm nay</Button>}
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat icon={<Flame size={15} />} label="Chuỗi hiện tại" value={stats?.currentStreak ?? 0} unit="ngày" />
                <Stat icon={<Award size={15} />} label="Kỷ lục" value={stats?.longestStreak ?? 0} unit="ngày" />
                <Stat icon={<BookOpen size={15} />} label="Tổng số bài" value={stats?.totalEntries ?? 0} unit="bài" />
                <Stat icon={<Type size={15} />} label="Tổng số từ" value={stats?.totalWords ?? 0} unit="từ" />
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
                <MoodCalendar entries={entries} selectedDate={selectedDate} today={today} onOpenDate={onOpenDate} />
                <MoodSummary stats={stats} />
            </div>

            <MoodTrend entries={entries} />

            <History entries={entries} onOpenDate={onOpenDate} />
        </div>
    );
};

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: number; unit: string }> = ({ icon, label, value, unit }) => (
    <Card className="p-4">
        <div className="flex items-center gap-1.5 text-[13px] text-zinc-500">
            <span className="text-zinc-400">{icon}</span>
            <span className="truncate">{label}</span>
        </div>
        <div className="mt-3 flex items-baseline gap-1">
            <span className="text-[22px] font-semibold tracking-tight tabular-nums text-zinc-950">{value.toLocaleString('vi-VN')}</span>
            <span className="text-[13px] text-zinc-500">{unit}</span>
        </div>
    </Card>
);

// ── Mood calendar ──

const MoodCalendar: React.FC<{ entries: JournalEntry[]; selectedDate: string; today: string; onOpenDate: (d: string) => void }> = ({
    entries,
    selectedDate,
    today,
    onOpenDate,
}) => {
    const [month, setMonth] = useState(() => {
        const d = parseLocalDate(selectedDate);
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });

    const byDate = useMemo(() => new Map(entries.map(e => [e.entry_date, e])), [entries]);

    const cells = useMemo(() => {
        const first = new Date(month.getFullYear(), month.getMonth(), 1);
        const lead = (first.getDay() + 6) % 7; // Monday first
        const days: (string | null)[] = Array(lead).fill(null);
        const d = new Date(first);
        while (d.getMonth() === month.getMonth()) {
            days.push(getLocalDateString(d));
            d.setDate(d.getDate() + 1);
        }
        return days;
    }, [month]);

    const isCurrentMonth = month.getFullYear() === new Date().getFullYear() && month.getMonth() === new Date().getMonth();
    const written = cells.filter(c => c && byDate.has(c)).length;

    return (
        <Card className="lg:col-span-3">
            <CardHeader
                title={`Tháng ${month.getMonth() + 1}, ${month.getFullYear()}`}
                meta={`${written} bài`}
                action={
                    <div className="-mr-2 flex items-center">
                        <IconButton label="Tháng trước" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
                            <ChevronLeft size={18} />
                        </IconButton>
                        <IconButton
                            label="Tháng sau"
                            disabled={isCurrentMonth}
                            className="disabled:pointer-events-none disabled:opacity-30"
                            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                        >
                            <ChevronRight size={18} />
                        </IconButton>
                    </div>
                }
            />
            <div className="px-3 pb-4 pt-3 sm:px-5 sm:pb-5">
                <div className="grid grid-cols-7 text-center text-[12px] text-zinc-400">
                    {WEEKDAYS.map(w => <span key={w} className="pb-1.5">{w}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {cells.map((date, i) => {
                        if (!date) return <span key={`pad-${i}`} />;
                        const entry = byDate.get(date);
                        const mood = getMood(entry?.mood);
                        const future = date > today;
                        const selected = date === selectedDate;
                        return (
                            <button
                                key={date}
                                type="button"
                                disabled={future}
                                onClick={() => onOpenDate(date)}
                                aria-label={`${parseLocalDate(date).toLocaleDateString('vi-VN')}${entry ? `, ${mood ? mood.label : 'đã viết'}` : ''}`}
                                className={`relative flex h-11 flex-col items-center justify-center rounded-xl text-[13px] tabular-nums transition-colors ${
                                    future
                                        ? 'text-zinc-300'
                                        : selected
                                          ? 'bg-zinc-950 text-white'
                                          : date === today
                                            ? 'font-semibold text-zinc-950 ring-1 ring-inset ring-zinc-900/15 hover:bg-zinc-100'
                                            : 'text-zinc-700 hover:bg-zinc-100'
                                }`}
                            >
                                {parseLocalDate(date).getDate()}
                                {entry && (
                                    <span
                                        className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${mood ? '' : 'border border-zinc-400'}`}
                                        style={mood ? { backgroundColor: mood.hex } : undefined}
                                        aria-hidden
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[12px] text-zinc-500">
                    {MOOD_LEVELS.map(l => (
                        <span key={l} className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: MOODS[l].hex }} aria-hidden />
                            {MOODS[l].label}
                        </span>
                    ))}
                    <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full border border-zinc-400" aria-hidden />
                        Không chọn
                    </span>
                </div>
            </div>
        </Card>
    );
};

// ── Average mood, distribution and top tags ──

const MoodSummary: React.FC<{ stats: JournalStats | null }> = ({ stats }) => {
    const avg = stats && stats.averageMood > 0 ? stats.averageMood : 0;
    const avgMood = getMood(Math.round(avg));
    const counted = stats ? MOOD_LEVELS.reduce((s, l) => s + (stats.moodDistribution[l] || 0), 0) : 0;

    return (
        <Card className="lg:col-span-2">
            <CardHeader title="Cảm xúc" meta={counted ? `${counted} lần ghi` : undefined} />
            <div className="space-y-5 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
                <div className="flex items-center gap-3">
                    <MoodTile level={avgMood?.level} fallback={<Heart size={18} />} />
                    <div>
                        <div className="text-[13px] text-zinc-500">Trung bình</div>
                        <div className="text-[15px] font-semibold tabular-nums text-zinc-950">
                            {avgMood ? `${avgMood.label} · ${avg.toFixed(1)}/5` : 'Chưa có dữ liệu'}
                        </div>
                    </div>
                </div>

                <ul className="space-y-2.5">
                    {[...MOOD_LEVELS].reverse().map(l => {
                        const m = MOODS[l];
                        const count = stats?.moodDistribution[l] || 0;
                        const pct = counted ? (count / counted) * 100 : 0;
                        return (
                            <li key={l} className="flex items-center gap-2.5 text-[13px]">
                                <m.Icon size={16} strokeWidth={1.75} className="shrink-0 text-zinc-400" aria-hidden />
                                <span className="w-[76px] shrink-0 text-zinc-600">{m.label}</span>
                                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                                    <span className={`block h-full rounded-full ${m.solid}`} style={{ width: `${pct}%` }} />
                                </span>
                                <span className="w-6 shrink-0 text-right tabular-nums text-zinc-500">{count}</span>
                            </li>
                        );
                    })}
                </ul>

                {stats && stats.topTags.length > 0 && (
                    <div>
                        <div className="mb-2 text-[13px] text-zinc-500">Chủ đề hay viết</div>
                        <div className="flex flex-wrap gap-1.5">
                            {stats.topTags.slice(0, 8).map(t => (
                                <span key={t.tag} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[12px] text-zinc-700">
                                    #{t.tag}
                                    <span className="tabular-nums text-zinc-400">{t.count}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
};

// ── Mood trend ──

const TrendTooltip: React.FC<{ active?: boolean; payload?: any[] }> = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as { date: string; mood: number };
    const m = getMood(p.mood);
    return (
        <div className="ui-zinc rounded-xl border border-zinc-900/[0.08] bg-white px-3 py-2 text-[12px] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.2)]">
            <div className="text-zinc-500">{p.date}</div>
            <div className="font-medium text-zinc-950">{m?.label}</div>
        </div>
    );
};

const MoodDot: React.FC<any> = ({ cx, cy, payload }) => {
    if (cx == null || cy == null) return null;
    return <circle cx={cx} cy={cy} r={3.5} fill={getMood(payload.mood)?.hex || '#a1a1aa'} stroke="none" />;
};

const MoodTrend: React.FC<{ entries: JournalEntry[] }> = ({ entries }) => {
    const data = useMemo(
        () =>
            [...entries]
                .filter(e => e.mood)
                .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
                .slice(-21)
                .map(e => ({
                    date: parseLocalDate(e.entry_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
                    mood: e.mood as number,
                })),
        [entries]
    );

    return (
        <Card>
            <CardHeader title="Xu hướng cảm xúc" meta={data.length ? `${data.length} ngày gần nhất` : undefined} />
            <div className="px-2 pb-3 pt-2 sm:px-3">
                {data.length >= 2 ? (
                    <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data} margin={{ top: 12, right: 12, left: 12, bottom: 0 }}>
                                <CartesianGrid vertical={false} stroke="rgba(113,113,122,0.15)" />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#a1a1aa' }} minTickGap={16} />
                                <YAxis hide domain={[1, 5]} />
                                <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'rgba(113,113,122,0.3)' }} />
                                <Area type="monotone" dataKey="mood" stroke="#0284c7" strokeWidth={2} fill="#0284c7" fillOpacity={0.08} dot={<MoodDot />} activeDot={{ r: 5 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <p className="px-3 pb-3 pt-1 text-[13px] text-zinc-500">Chọn cảm xúc ở ít nhất hai bài viết để xem xu hướng.</p>
                )}
            </div>
        </Card>
    );
};

// ── History ──

const History: React.FC<{ entries: JournalEntry[]; onOpenDate: (d: string) => void }> = ({ entries, onOpenDate }) => {
    const [query, setQuery] = useState('');
    const [mood, setMood] = useState<MoodLevel | null>(null);
    const [tag, setTag] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [visible, setVisible] = useState(PAGE);

    const tags = useMemo(() => {
        const set = new Set<string>();
        entries.forEach(e => e.tags?.forEach(t => set.add(t)));
        return Array.from(set).sort();
    }, [entries]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return entries.filter(e => {
            const text = !q || plainText(e.content).toLowerCase().includes(q) || e.gratitude.some(g => g.toLowerCase().includes(q));
            return text && (!mood || e.mood === mood) && (!tag || e.tags?.includes(tag));
        });
    }, [entries, query, mood, tag]);

    const filtering = !!query.trim() || !!mood || !!tag;
    const clear = () => {
        setQuery('');
        setMood(null);
        setTag(null);
    };

    return (
        <Card>
            <CardHeader title="Bài đã viết" meta={filtered.length} />
            <div className="space-y-2.5 px-4 pt-3 sm:px-5">
                <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="search"
                            value={query}
                            onChange={e => {
                                setQuery(e.target.value);
                                setVisible(PAGE);
                            }}
                            placeholder="Tìm trong nhật ký"
                            aria-label="Tìm trong nhật ký"
                            className={`${inputClass} pl-10`}
                        />
                    </div>
                    {tags.length > 0 && (
                        <select
                            value={tag ?? ''}
                            onChange={e => {
                                setTag(e.target.value || null);
                                setVisible(PAGE);
                            }}
                            aria-label="Lọc theo thẻ"
                            className={`${inputClass} sm:w-44`}
                        >
                            <option value="">Mọi thẻ</option>
                            {tags.map(t => <option key={t} value={t}>#{t}</option>)}
                        </select>
                    )}
                </div>
                <div className="flex items-center gap-1" role="group" aria-label="Lọc theo cảm xúc">
                    {MOOD_LEVELS.map(l => {
                        const m = MOODS[l];
                        const on = mood === l;
                        return (
                            <button
                                key={l}
                                type="button"
                                aria-pressed={on}
                                aria-label={m.label}
                                title={m.label}
                                onClick={() => {
                                    setMood(on ? null : l);
                                    setVisible(PAGE);
                                }}
                                className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${on ? `${m.tile} ring-1 ring-inset ring-current` : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700'}`}
                            >
                                <m.Icon size={18} strokeWidth={1.75} aria-hidden />
                            </button>
                        );
                    })}
                    {filtering && (
                        <button type="button" onClick={clear} className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[13px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
                            <X size={14} /> Bỏ lọc
                        </button>
                    )}
                </div>
            </div>

            {filtered.length === 0 ? (
                <p className="px-5 pb-6 pt-4 text-center text-[13px] text-zinc-500">Không có bài nào khớp với bộ lọc.</p>
            ) : (
                <ul className="mt-2 divide-y divide-zinc-900/[0.06]">
                    {filtered.slice(0, visible).map(entry => {
                        const m = getMood(entry.mood);
                        const text = plainText(entry.content);
                        const long = text.length > 220;
                        const open = !!expanded[entry.id];
                        return (
                            <li key={entry.id} className="flex gap-3 px-4 py-4 sm:px-5">
                                <MoodTile level={entry.mood} fallback={<PenLine size={17} strokeWidth={1.75} />} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-[14px] font-medium capitalize text-zinc-950">
                                                {parseLocalDate(entry.entry_date).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })}
                                            </p>
                                            <p className="text-[12px] tabular-nums text-zinc-500">
                                                {[m?.label, `${entry.word_count} từ`].filter(Boolean).join(' · ')}
                                            </p>
                                        </div>
                                        <IconButton label="Mở để sửa" onClick={() => onOpenDate(entry.entry_date)} className="-mr-2 -mt-1">
                                            <PenLine size={16} />
                                        </IconButton>
                                    </div>

                                    {open || !long ? (
                                        <div className="journal-prose mt-2 text-[14px] text-zinc-700" dangerouslySetInnerHTML={{ __html: entry.content }} />
                                    ) : (
                                        <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-zinc-600">{text}</p>
                                    )}
                                    {long && (
                                        <button
                                            type="button"
                                            onClick={() => setExpanded(prev => ({ ...prev, [entry.id]: !open }))}
                                            className="mt-1 text-[13px] font-medium text-sky-700 hover:underline"
                                        >
                                            {open ? 'Thu gọn' : 'Đọc tiếp'}
                                        </button>
                                    )}

                                    {entry.gratitude.length > 0 && (
                                        <ul className="mt-2.5 space-y-1">
                                            {entry.gratitude.map((g, i) => (
                                                <li key={i} className="flex items-start gap-2 text-[13px] text-zinc-600">
                                                    <Heart size={13} className="mt-[3px] shrink-0 text-rose-400" aria-hidden />
                                                    <span className="min-w-0">{g}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}

                                    {!!entry.tags?.length && (
                                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                                            {entry.tags.map(t => (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    onClick={() => {
                                                        setTag(t);
                                                        setVisible(PAGE);
                                                    }}
                                                    className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[12px] text-zinc-600 hover:text-zinc-900"
                                                >
                                                    #{t}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {filtered.length > visible && (
                <div className="border-t border-zinc-900/[0.06] p-2 text-center">
                    <Button variant="ghost" onClick={() => setVisible(v => v + PAGE)}>
                        Xem thêm {Math.min(PAGE, filtered.length - visible)} bài
                    </Button>
                </div>
            )}
        </Card>
    );
};
