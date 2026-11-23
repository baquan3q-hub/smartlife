import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react';
import { CheckCircle2, Sparkles, Layers, Check } from 'lucide-react';
import { LandingCopy } from '../i18n';
import { GoogleTasksIcon } from '../../icons/GoogleTasksIcon';
import { GoogleCalendarIcon } from '../../icons/GoogleCalendarIcon';
import { GoogleSheetsIcon } from '../../icons/GoogleSheetsIcon';
import { GlassIcon } from '../../icons/GlassIcon';
import { LG_QUERY, useMediaQuery } from '../hooks/useMediaQuery';

interface SyncEngineStageProps {
    c: LandingCopy;
}

// A Kanban card slides from Doing to Done and Google lights up.
// Desktop: a sticky stage driven by scroll. Phones: the same stage in the flow, driven as it crosses the screen.
// Reduced motion: the finished state, still.
export const SyncEngineStage: React.FC<SyncEngineStageProps> = ({ c }) => {
    const isLg = useMediaQuery(LG_QUERY);
    const reduced = useReducedMotion();
    if (reduced) return <StillStage c={c} />;
    return isLg ? <StickyStage c={c} /> : <FlowStage c={c} />;
};

const StickyStage: React.FC<SyncEngineStageProps> = ({ c }) => {
    const ref = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
    const p = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.25 });
    return (
        <section ref={ref} id="sync-engine" className="relative h-[220vh] bg-[var(--l-day)]">
            <div className="sticky top-0 flex h-screen items-center overflow-hidden px-6">
                <StageBody c={c} p={p} />
            </div>
        </section>
    );
};

const FlowStage: React.FC<SyncEngineStageProps> = ({ c }) => {
    const ref = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.7'] });
    const p = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.25 });
    return (
        <section ref={ref} id="sync-engine" className="bg-[var(--l-day)] px-4 py-20 sm:px-6 sm:py-28">
            <StageBody c={c} p={p} />
        </section>
    );
};

const StillStage: React.FC<SyncEngineStageProps> = ({ c }) => {
    const p = useMotionValue(1);
    return (
        <section id="sync-engine" className="bg-[var(--l-day)] px-4 py-20 sm:px-6 sm:py-28">
            <StageBody c={c} p={p} />
        </section>
    );
};

const StageBody: React.FC<{ c: LandingCopy; p: MotionValue<number> }> = ({ c, p }) => {
    const boardRef = useRef<HTMLDivElement>(null);
    // Distance from the Doing column to the Done column, measured so the card lands in its column at any width.
    const travel = useMotionValue(0);

    useEffect(() => {
        const board = boardRef.current;
        if (!board) return;
        const GAP = 16;
        const update = () => travel.set((board.clientWidth - GAP) / 2 + GAP);
        update();
        const ro = new ResizeObserver(update);
        ro.observe(board);
        return () => ro.disconnect();
    }, [travel]);

    const move = useTransform(p, [0.2, 0.6], [0, 1]);
    const cardX = useTransform(() => move.get() * travel.get());
    const cardY = useTransform(p, [0.2, 0.4, 0.6], [0, -18, 0]);
    const cardRotate = useTransform(p, [0.2, 0.38, 0.6], [0, 3, 0]);
    const cardShadow = useTransform(
        p,
        [0.2, 0.4, 0.6],
        ['0 4px 12px rgba(0,0,0,0.06)', '0 24px 36px -8px rgba(2,132,199,0.3)', '0 6px 16px rgba(16,185,129,0.15)']
    );
    const syncBeamOpacity = useTransform(p, [0.45, 0.65, 0.85], [0.35, 1, 1]);
    const syncScale = useTransform(p, [0.55, 0.7], [0.97, 1]);
    const googleDoneOpacity = useTransform(p, [0.55, 0.65], [0, 1]);
    const deepCleanOpacity = useTransform(p, [0.65, 0.78], [0, 1]);
    const tasksBar = useTransform(p, [0.2, 0.7], ['30%', '100%']);

    const copy = c.syncStage;

    return (
        <div className="relative mx-auto w-full max-w-[1192px]">
            <div className="mb-8 grid gap-4 sm:mb-12 lg:grid-cols-12 lg:items-end">
                <div className="lg:col-span-7">
                    <p className="l-mono mb-4 text-zinc-500">{copy.eyebrow}</p>
                    <h2 className="l-h2 text-zinc-950">{copy.title}</h2>
                </div>
                <p className="text-[16px] leading-7 text-zinc-600 lg:col-span-5">{copy.desc}</p>
            </div>

            <div className="relative rounded-[28px] border border-zinc-900/[0.08] bg-[var(--l-dawn)] p-4 sm:p-7">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-900/[0.07] pb-4">
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-700">{copy.statusLive}</span>
                    </div>
                    <motion.div
                        style={{ opacity: deepCleanOpacity }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                    >
                        <Sparkles size={13} />
                        {copy.cleanBadge}
                    </motion.div>
                </div>

                <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12 lg:gap-8">
                    <div className="rounded-2xl border border-zinc-900/[0.07] bg-white/70 p-3 sm:p-4 lg:col-span-7">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <GlassIcon name="kanban" size={24} />
                                <h3 className="text-sm font-bold text-zinc-800">SmartLife Kanban</h3>
                            </div>
                            <span className="text-right text-[11px] font-medium text-zinc-400">{c.ui.stageHint}</span>
                        </div>

                        <div ref={boardRef} className="relative grid grid-cols-2 gap-4">
                            <div className="min-h-[200px] rounded-xl border border-zinc-200/80 bg-white p-3">
                                <div className="mb-3 flex items-center justify-between border-b border-zinc-100 pb-2">
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-sky-700">
                                        <span className="h-2 w-2 rounded-full bg-sky-500" />
                                        {copy.colDoing}
                                    </span>
                                    <span className="text-[11px] font-semibold text-zinc-400">1</span>
                                </div>
                                <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-zinc-200 p-3 text-center text-xs text-zinc-400">
                                    {c.ui.stagePlaceholder}
                                </div>
                            </div>

                            <div className="min-h-[200px] rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-3">
                                <div className="mb-3 flex items-center justify-between border-b border-emerald-100 pb-2">
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                        {copy.colDone}
                                    </span>
                                    <motion.span
                                        style={{ opacity: googleDoneOpacity }}
                                        className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-600"
                                    >
                                        +1
                                    </motion.span>
                                </div>
                            </div>

                            <motion.div
                                style={{ x: cardX, y: cardY, rotate: cardRotate, boxShadow: cardShadow }}
                                className="absolute left-3 top-[44px] z-20 w-[calc(50%-32px)] rounded-xl border border-sky-200 bg-white p-3 sm:p-3.5"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <GoogleTasksIcon size={14} />
                                    <motion.div style={{ opacity: googleDoneOpacity }}>
                                        <CheckCircle2 size={16} className="text-emerald-500" />
                                    </motion.div>
                                </div>
                                <h4 className="mt-2 text-xs font-bold leading-snug text-zinc-900">{copy.taskTitle}</h4>
                                <p className="mt-1 flex items-center gap-1 text-[11px] text-zinc-500">
                                    <Layers size={11} className="shrink-0" />
                                    {copy.taskSub}
                                </p>
                            </motion.div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3.5 lg:col-span-5">
                        <motion.div style={{ scale: syncScale }} className="rounded-2xl border border-zinc-900/[0.07] bg-white p-4">
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <GoogleTasksIcon size={22} />
                                    <span className="text-sm font-bold text-zinc-900">Google Tasks</span>
                                </div>
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                                    <Check size={11} />
                                    {c.ui.stageMatched}
                                </span>
                            </div>
                            <p className="text-xs text-zinc-600">{copy.tasksSynced}</p>
                            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                                <motion.div style={{ width: tasksBar }} className="h-full rounded-full bg-[var(--l-accent)]" />
                            </div>
                        </motion.div>

                        <motion.div style={{ scale: syncScale }} className="rounded-2xl border border-zinc-900/[0.07] bg-white p-4">
                            <div className="mb-2 flex items-center gap-2">
                                <GoogleCalendarIcon size={22} />
                                <span className="text-sm font-bold text-zinc-900">Google Calendar</span>
                            </div>
                            <p className="text-xs text-zinc-600">{copy.calendarSynced}</p>
                        </motion.div>

                        <motion.div
                            style={{ opacity: syncBeamOpacity }}
                            className="flex items-center gap-3 rounded-2xl border border-zinc-900/[0.07] bg-white p-3.5"
                        >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--l-dawn)]">
                                <GoogleSheetsIcon size={20} />
                            </div>
                            <div>
                                <span className="block text-xs font-bold text-zinc-900">Google Sheets</span>
                                <span className="block text-[11px] text-zinc-500">{c.ui.sheetsDesc}</span>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
};
