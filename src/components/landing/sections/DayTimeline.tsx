import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Calculator } from 'lucide-react';
import { LandingCopy, StoryKey } from '../i18n';
import { dayGround, dayOrder, stories, StoryDef } from '../data';
import { GlassIcon } from '../../icons/GlassIcon';
import { GoogleCalendarIcon } from '../../icons/GoogleCalendarIcon';
import { GoogleTasksIcon } from '../../icons/GoogleTasksIcon';
import { ResponsiveImage } from '../motion/Media';
import { EASE, Reveal } from '../motion/Reveal';
import { useScrollSpy } from '../hooks/useScrollSpy';
import { evalMoney, formatVnd } from '../calc';

interface DayTimelineProps {
    c: LandingCopy;
}

const chapters: StoryDef[] = dayOrder.map((key) => stories.find((s) => s.key === key)!);
const chapterIds = chapters.map((s) => s.id);

// "A student's day": four chapters from 07:00 to 22:00. The ground colour follows the hour,
// and on desktop a sticky panel on the right shows the clock and the screen for the chapter you are reading.
export const DayTimeline: React.FC<DayTimelineProps> = ({ c }) => {
    const spy = useScrollSpy(chapterIds);
    const [active, setActive] = useState<StoryKey>('kanban');

    useEffect(() => {
        const hit = chapters.find((s) => s.id === spy);
        if (hit) setActive(hit.key);
    }, [spy]);

    const night = active === 'ai';
    const chapter = c.day.chapters[active];

    return (
        <motion.section
            id="day"
            initial={false}
            animate={{ backgroundColor: dayGround[active] }}
            transition={{ duration: 0.8, ease: EASE }}
            className={`relative transition-[color] duration-700 ${night ? 'text-white' : 'text-zinc-950'}`}
        >
            <div className="mx-auto max-w-[1240px] px-4 pt-24 sm:px-6 sm:pt-32">
                <Reveal className="max-w-3xl">
                    <p className={`l-mono mb-5 ${night ? 'text-zinc-400' : 'text-zinc-500'}`}>{c.day.eyebrow}</p>
                    <h2 className="l-h1">{c.day.title}</h2>
                </Reveal>

                <div className="mt-10 lg:mt-0 lg:grid lg:grid-cols-12 lg:gap-12">
                    <div className="lg:col-span-5">
                        {chapters.map((story) => (
                            <Chapter key={story.key} c={c} story={story} night={night} />
                        ))}
                    </div>

                    {/* Sticky clock + screen, desktop only */}
                    <div className="hidden lg:col-span-7 lg:block">
                        <div className="sticky top-0 flex h-screen flex-col justify-center py-24">
                            <div className="mb-6 flex items-end justify-between gap-6">
                                <div className="relative h-[7.5rem] overflow-hidden">
                                    <AnimatePresence mode="popLayout" initial={false}>
                                        <motion.span
                                            key={chapter.time}
                                            initial={{ y: '100%', opacity: 0 }}
                                            animate={{ y: '0%', opacity: 1 }}
                                            exit={{ y: '-100%', opacity: 0 }}
                                            transition={{ type: 'spring', stiffness: 200, damping: 22 }}
                                            className="l-clock block text-[7rem] leading-none text-[var(--l-warm)]"
                                        >
                                            {chapter.time}
                                        </motion.span>
                                    </AnimatePresence>
                                </div>
                                <DayRail active={active} night={night} />
                            </div>
                            <div className="relative aspect-[1600/914] w-full">
                                {chapters.map((story) => (
                                    <motion.div
                                        key={story.key}
                                        initial={false}
                                        animate={{ opacity: story.key === active ? 1 : 0, scale: story.key === active ? 1 : 0.98 }}
                                        transition={{ duration: 0.6, ease: EASE }}
                                        className="absolute inset-0"
                                        aria-hidden={story.key !== active}
                                    >
                                        <Screen c={c} story={story} sizes="(min-width: 1240px) 700px, 58vw" />
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.section>
    );
};

// Four ticks for the four chapters, the current one lit.
const DayRail: React.FC<{ active: StoryKey; night: boolean }> = ({ active, night }) => (
    <ol className="mb-3 flex items-center gap-2" aria-hidden>
        {dayOrder.map((key) => (
            <li
                key={key}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                    key === active ? 'w-10 bg-[var(--l-warm)]' : night ? 'w-4 bg-white/20' : 'w-4 bg-zinc-900/15'
                }`}
            />
        ))}
    </ol>
);

const Screen: React.FC<{ c: LandingCopy; story: StoryDef; sizes: string }> = ({ c, story, sizes }) => (
    <div className="relative h-full w-full">
        <ResponsiveImage
            img={story.main}
            alt={c.stories[story.key].eyebrow}
            sizes={sizes}
            className="h-full w-full rounded-[20px] border border-zinc-900/[0.08] bg-white object-cover object-top shadow-[0_40px_90px_-40px_rgba(0,0,0,0.45)]"
        />
        {story.sub && (
            <ResponsiveImage
                img={story.sub}
                alt=""
                sizes="260px"
                className="absolute -bottom-8 -right-4 w-[38%] rounded-2xl border border-zinc-900/[0.08] bg-white p-1 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)]"
            />
        )}
        {story.key === 'google' && (
            <div className="absolute -bottom-6 right-6 flex items-center gap-3 rounded-2xl border border-zinc-900/[0.08] bg-white px-4 py-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.35)]">
                <GoogleTasksIcon size={20} />
                <GoogleCalendarIcon size={20} />
                <span className="flex items-center gap-2 text-[13px] font-medium text-zinc-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {c.syncStatus}
                </span>
            </div>
        )}
    </div>
);

const Chapter: React.FC<{ c: LandingCopy; story: StoryDef; night: boolean }> = ({ c, story, night }) => {
    const s = c.stories[story.key];
    const ch = c.day.chapters[story.key];
    return (
        <article id={story.id} className="flex flex-col justify-center py-14 lg:min-h-screen lg:py-24">
            <p className="l-mono flex items-center gap-3">
                <span className="text-[var(--l-warm)]">{ch.time}</span>
                <span className={`h-px w-8 ${night ? 'bg-white/20' : 'bg-zinc-900/15'}`} />
                <span className={night ? 'text-zinc-400' : 'text-zinc-500'}>{ch.label}</span>
            </p>
            <h3 className="mt-5 text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.03em]">{s.title}</h3>
            <p className={`mt-4 text-[17px] leading-7 ${night ? 'text-zinc-400' : 'text-zinc-600'}`}>{s.desc}</p>
            <ul className="mt-7 space-y-3">
                {s.points.map((point, i) => (
                    <li key={point} className="flex items-start gap-3.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                            {story.icons[i] && <GlassIcon name={story.icons[i]} size={26} />}
                        </span>
                        <span className={`text-[15px] leading-6 ${night ? 'text-zinc-300' : 'text-zinc-700'}`}>{point}</span>
                    </li>
                ))}
            </ul>
            {story.key === 'finance' && <MoneyCalc c={c} />}
            <div className="mt-10 lg:hidden">
                <Screen c={c} story={story} sizes="100vw" />
            </div>
        </article>
    );
};

const PRESETS = ['50k + 1.5tr', '2tr - 350k', '100k x 4'];

// A real evaluator (k = thousand, tr = million), so the result always matches what was typed.
const MoneyCalc: React.FC<{ c: LandingCopy }> = ({ c }) => {
    const [expr, setExpr] = useState(PRESETS[0]);
    const value = useMemo(() => evalMoney(expr), [expr]);
    return (
        <div className="mt-8 rounded-[20px] border border-zinc-900/[0.08] bg-white p-4 text-zinc-950 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.3)]">
            <label htmlFor="money-calc" className="mb-2 flex items-center gap-2 text-[13px] font-medium text-zinc-700">
                <Calculator size={14} className="text-[var(--l-accent)]" />
                {c.day.calcLabel}
            </label>
            <input
                id="money-calc"
                value={expr}
                onChange={(e) => setExpr(e.target.value)}
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-xl border border-zinc-900/10 bg-zinc-50 px-3.5 py-2.5 font-mono text-[15px] text-zinc-900 outline-none transition-colors focus:border-[var(--l-accent)] focus:bg-white"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                    {PRESETS.map((p) => (
                        <button
                            key={p}
                            type="button"
                            onClick={() => setExpr(p)}
                            className="rounded-lg border border-zinc-900/10 px-2 py-1 font-mono text-[12px] text-zinc-600 transition-colors hover:border-[var(--l-accent)] hover:text-[var(--l-accent)]"
                        >
                            {p}
                        </button>
                    ))}
                </div>
                <output htmlFor="money-calc" aria-live="polite" className="l-clock text-xl text-emerald-600">
                    {value === null ? <span className="font-sans text-[13px] tracking-normal text-zinc-400">{c.day.calcInvalid}</span> : formatVnd(value)}
                </output>
            </div>
            <p className="l-mono mt-3 normal-case text-zinc-400">{c.day.calcHint}</p>
        </div>
    );
};
