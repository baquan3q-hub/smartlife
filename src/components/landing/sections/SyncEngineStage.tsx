import React, { useRef, useState } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'motion/react';
import { CheckCircle2, RefreshCw, Sparkles, Layers, ArrowRight, Zap, Check } from 'lucide-react';
import { LandingCopy } from '../i18n';
import { GoogleTasksIcon } from '../../icons/GoogleTasksIcon';
import { GoogleCalendarIcon } from '../../icons/GoogleCalendarIcon';
import { GoogleSheetsIcon } from '../../icons/GoogleSheetsIcon';
import { GlassIcon } from '../../icons/GlassIcon';

interface SyncEngineStageProps {
    c: LandingCopy;
}

export const SyncEngineStage: React.FC<SyncEngineStageProps> = ({ c }) => {
    const stageRef = useRef<HTMLElement>(null);
    const [manualCardDone, setManualCardDone] = useState(false);

    // Track scroll across the 220vh stage
    const { scrollYProgress } = useScroll({
        target: stageRef,
        offset: ['start start', 'end end']
    });

    const p = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.25 });

    // Card movement: from left column (Doing) to right column (Done)
    // Between p = 0.25 and 0.65, card translates X and lifts in Y
    const cardX = useTransform(p, [0.2, 0.6], [0, 240]);
    const cardY = useTransform(p, [0.2, 0.4, 0.6], [0, -18, 0]);
    const cardRotate = useTransform(p, [0.2, 0.38, 0.6], [0, 3, 0]);
    const cardShadow = useTransform(
        p,
        [0.2, 0.4, 0.6],
        [
            '0 4px 12px rgba(0,0,0,0.06)',
            '0 24px 36px -8px rgba(2,132,199,0.3)',
            '0 6px 16px rgba(16,185,129,0.15)'
        ]
    );

    // Google sync wave & badge activations
    const syncBeamOpacity = useTransform(p, [0.45, 0.65, 0.85], [0, 1, 0.8]);
    const syncScale = useTransform(p, [0.55, 0.7], [0.96, 1]);
    const googleDoneOpacity = useTransform(p, [0.55, 0.65], [0, 1]);
    const doingBadgeOpacity = useTransform(p, [0.5, 0.6], [1, 0.3]);
    const deepCleanOpacity = useTransform(p, [0.65, 0.78], [0, 1]);

    const copy = c.syncStage;

    return (
        <section
            ref={stageRef}
            id="sync-engine"
            className="relative min-h-[220vh] bg-gradient-to-b from-zinc-50 via-sky-50/20 to-zinc-50"
        >
            {/* Sticky Scrollytelling Stage */}
            <div className="sticky top-0 flex h-screen w-full flex-col justify-center overflow-hidden px-4 sm:px-6">
                {/* Background ambient lighting */}
                <div
                    className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
                    style={{ background: 'radial-gradient(circle, rgba(2,132,199,0.18), transparent 70%)' }}
                    aria-hidden
                />

                <div className="relative mx-auto max-w-6xl w-full">
                    {/* Stage Header */}
                    <div className="text-center mb-8 sm:mb-12">
                        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-50 px-3.5 py-1 text-xs font-semibold text-sky-700">
                            <Zap size={13} className="text-sky-600 fill-sky-600" />
                            <span>{copy.eyebrow}</span>
                        </div>
                        <h2 className="l-h2 mt-3 text-zinc-950 max-w-3xl mx-auto">
                            {copy.title}
                        </h2>
                        <p className="mt-3 text-[16px] text-zinc-600 max-w-2xl mx-auto">
                            {copy.desc}
                        </p>
                    </div>

                    {/* Interactive Live Surface Stage Container */}
                    <div className="relative rounded-[28px] border border-zinc-900/[0.08] bg-white/90 p-5 shadow-[0_30px_90px_-20px_rgba(9,9,11,0.18)] backdrop-blur-md sm:p-8">
                        {/* Status bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4 mb-6">
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                                </span>
                                <span className="text-xs font-bold text-zinc-700 tracking-wide uppercase">{copy.statusLive}</span>
                                <span className="text-xs text-zinc-400 font-mono">(SmartLife Engine Master v2.4)</span>
                            </div>

                            <motion.div
                                style={{ opacity: deepCleanOpacity }}
                                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700"
                            >
                                <Sparkles size={13} />
                                <span>{copy.cleanBadge}</span>
                            </motion.div>
                        </div>

                        {/* Split Stage: Kanban on Left, Google Sync on Right */}
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8 items-center">
                            {/* Left: Kanban Board Simulator (7 Cols) */}
                            <div className="lg:col-span-7 rounded-2xl bg-zinc-50/80 p-4 border border-zinc-200/70">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <GlassIcon name="kanban" size={24} />
                                        <h3 className="text-sm font-bold text-zinc-800">SmartLife Kanban</h3>
                                    </div>
                                    <span className="text-[11px] font-medium text-zinc-400">Cuộn hoặc chạm để quan sát</span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 relative">
                                    {/* Column Doing */}
                                    <div className="rounded-xl bg-white p-3 border border-zinc-200/80 shadow-xs min-h-[220px]">
                                        <div className="flex items-center justify-between border-b border-zinc-100 pb-2 mb-3">
                                            <span className="text-xs font-bold text-sky-700 flex items-center gap-1.5">
                                                <span className="h-2 w-2 rounded-full bg-sky-500" />
                                                {copy.colDoing}
                                            </span>
                                            <span className="text-[11px] font-semibold text-zinc-400">1</span>
                                        </div>

                                        {/* Card placeholder behind moving card */}
                                        <div className="rounded-xl border border-dashed border-zinc-200 p-3 h-28 flex flex-col justify-center items-center text-zinc-400 text-xs text-center">
                                            <span>Thẻ công việc đang lướt sang Done</span>
                                        </div>
                                    </div>

                                    {/* Column Done */}
                                    <div className="rounded-xl bg-emerald-50/40 p-3 border border-emerald-200/60 shadow-xs min-h-[220px]">
                                        <div className="flex items-center justify-between border-b border-emerald-100 pb-2 mb-3">
                                            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                                {copy.colDone}
                                            </span>
                                            <motion.span
                                                style={{ opacity: googleDoneOpacity }}
                                                className="text-[11px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full"
                                            >
                                                +1
                                            </motion.span>
                                        </div>
                                    </div>

                                    {/* The Dynamic Moving Card Driven by Scroll */}
                                    <motion.div
                                        style={{
                                            x: cardX,
                                            y: cardY,
                                            rotate: cardRotate,
                                            boxShadow: cardShadow
                                        }}
                                        className="absolute left-3 top-[44px] w-[calc(50%-18px)] rounded-xl border border-sky-200 bg-white p-3.5 z-20 cursor-grab active:cursor-grabbing"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-sky-100 text-sky-800">
                                                VNU Academic
                                            </span>
                                            <motion.div style={{ opacity: googleDoneOpacity }}>
                                                <CheckCircle2 size={16} className="text-emerald-500" />
                                            </motion.div>
                                        </div>

                                        <h4 className="mt-2 text-xs font-bold text-zinc-900 leading-snug">
                                            {copy.taskTitle}
                                        </h4>
                                        <p className="mt-1 text-[11px] text-zinc-500 flex items-center gap-1">
                                            <Layers size={11} />
                                            {copy.taskSub}
                                        </p>

                                        <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-400 border-t border-zinc-100 pt-2">
                                            <span className="flex items-center gap-1 font-mono text-zinc-600">
                                                <GoogleTasksIcon size={12} />
                                                #GT-8492
                                            </span>
                                            <span className="text-emerald-600 font-semibold">Priority: High</span>
                                        </div>
                                    </motion.div>
                                </div>
                            </div>

                            {/* Right: Google Ecosystem Sync Status (5 Cols) */}
                            <div className="lg:col-span-5 flex flex-col gap-3.5">
                                <motion.div
                                    style={{ scale: syncScale }}
                                    className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <GoogleTasksIcon size={22} />
                                            <span className="text-sm font-bold text-zinc-900">Google Tasks Live Link</span>
                                        </div>
                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                            <Check size={11} />
                                            Khớp 4 Danh sách
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-600">
                                        {copy.tasksSynced}
                                    </p>
                                    <div className="mt-3 h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                                        <motion.div
                                            style={{ width: useTransform(p, [0.2, 0.7], ['30%', '100%']) }}
                                            className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full"
                                        />
                                    </div>
                                </motion.div>

                                <motion.div
                                    style={{ scale: syncScale }}
                                    className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <GoogleCalendarIcon size={22} />
                                            <span className="text-sm font-bold text-zinc-900">Google Calendar</span>
                                        </div>
                                        <span className="text-[11px] font-mono text-sky-600 font-semibold bg-sky-50 px-2 py-0.5 rounded-full">
                                            Auto-Block
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-600">
                                        {copy.calendarSynced}
                                    </p>
                                </motion.div>

                                <motion.div
                                    style={{ opacity: syncBeamOpacity }}
                                    className="rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50/60 to-sky-50/60 p-3.5 flex items-center gap-3"
                                >
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-xs">
                                        <GoogleSheetsIcon size={20} />
                                    </div>
                                    <div>
                                        <span className="block text-xs font-bold text-zinc-900">Google Sheets Data Lake</span>
                                        <span className="block text-[11px] text-zinc-500">Backup và kết xuất báo cáo tài chính tự động</span>
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
