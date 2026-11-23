import React, { useEffect, useRef } from 'react';
import {
    backOut,
    easeIn,
    easeOut,
    motion,
    MotionConfig,
    useMotionValue,
    useScroll,
    useSpring,
    useTransform,
    type MotionValue
} from 'motion/react';
import { LandingCopy, type ProblemApp } from '../i18n';
import { problemApps } from '../data';
import { GlassIcon } from '../../icons/GlassIcon';
import { LG_QUERY, useMediaQuery } from '../hooks/useMediaQuery';

interface ProblemSolutionProps {
    c: LandingCopy;
}

// Peak #1, driven by scroll and fully reversible:
// eight app tiles bloom out of the centre, hold still for a beat, then fly back in on curved paths
// and merge into the SmartLife icon. Desktop pins the stage; phones play it in the flow.
// Runs regardless of the OS reduced-motion setting (product decision), hence MotionConfig "never".
export const ProblemSolution: React.FC<ProblemSolutionProps> = ({ c }) => {
    const isLg = useMediaQuery(LG_QUERY);
    return <MotionConfig reducedMotion="never">{isLg ? <StickyProblem c={c} /> : <FlowProblem c={c} />}</MotionConfig>;
};

const SPRING = { stiffness: 120, damping: 30, mass: 0.3 };

// Timeline (p = 0..1): bloom 0.08–0.39 · hold · merge 0.50–0.79 · climax 0.64–0.95.
const BLOOM_START = 0.08;
const MERGE_START = 0.5;
const STEP = 0.018;
const BLOOM_LEN = 0.18;
const MERGE_LEN = 0.16;
const TILT = [-6, 5, -4, 7, -5, 4, -7, 6];

// Phones: the free scatter of problemApps collides on a narrow stage, so tiles bloom into
// two staggered columns instead (percent of stage width / height from the centre).
const PHONE_POS: Record<ProblemApp, [number, number]> = {
    notes: [-24, -38],
    timetable: [24, -30],
    sheet: [26, -6],
    todo: [23, 18],
    music: [25, 40],
    timer: [-25, 34],
    diary: [-23, 10],
    gpa: [-26, -14]
};

function useChoreo(p: MotionValue<number>) {
    return {
        beforeOpacity: useTransform(p, [0.66, 0.8], [1, 0.25]),
        afterOpacity: useTransform(p, [0.7, 0.84], [0, 1]),
        afterY: useTransform(p, [0.7, 0.84], [24, 0]),
        iconScale: useTransform(p, [0.64, 0.8], [0.5, 1], { ease: backOut }),
        iconOpacity: useTransform(p, [0.64, 0.72], [0, 1]),
        ringScale: useTransform(p, [0.72, 0.95], [0.7, 1.5]),
        ringOpacity: useTransform(p, [0.72, 0.76, 0.95], [0, 0.6, 0]),
        orbitScale: useTransform(p, [0.08, 0.36, 0.5, 0.72], [0.3, 1, 1, 0.4]),
        orbitOpacity: useTransform(p, [0.08, 0.3, 0.55, 0.72], [0, 1, 1, 0]),
        beforeLabel: useTransform(p, [0.1, 0.2, 0.55, 0.65], [0, 1, 1, 0]),
        afterLabel: useTransform(p, [0.7, 0.8], [0, 1])
    };
}

const Eyebrow: React.FC<{ c: LandingCopy }> = ({ c }) => <p className="l-mono mb-5 text-zinc-500">{c.problem.eyebrow}</p>;

const StickyProblem: React.FC<ProblemSolutionProps> = ({ c }) => {
    const ref = useRef<HTMLElement>(null);
    // 'start end': the bloom plays while the section slides in, so the pinned frame is never empty.
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] });
    const p = useSpring(scrollYProgress, SPRING);
    const k = useChoreo(p);

    return (
        <section ref={ref} id="problem" className="relative h-[300vh] bg-[var(--l-dawn)]">
            <div className="sticky top-0 flex h-screen items-center overflow-hidden">
                <div className="mx-auto grid w-full max-w-[1240px] grid-cols-12 items-center gap-10 px-6">
                    <div className="col-span-5">
                        <Eyebrow c={c} />
                        <motion.h2 style={{ opacity: k.beforeOpacity }} className="l-h2 text-zinc-950">
                            {c.problem.before}
                        </motion.h2>
                        <motion.p style={{ opacity: k.afterOpacity, y: k.afterY }} className="l-h2 mt-3 text-[var(--l-accent)]">
                            {c.problem.after}
                        </motion.p>
                        <motion.p style={{ opacity: k.afterOpacity }} className="mt-8 max-w-md text-[17px] leading-7 text-zinc-600">
                            {c.problem.desc}
                        </motion.p>
                    </div>
                    <Stage c={c} p={p} k={k} className="col-span-7 h-[78vh] max-h-[720px] w-full" />
                </div>
            </div>
        </section>
    );
};

const FlowProblem: React.FC<ProblemSolutionProps> = ({ c }) => {
    const stageRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({ target: stageRef, offset: ['start 0.8', 'end 0.5'] });
    const p = useSpring(scrollYProgress, SPRING);
    const k = useChoreo(p);

    return (
        <section id="problem" className="overflow-hidden bg-[var(--l-dawn)] py-20 sm:py-28">
            <div className="mx-auto max-w-[640px] px-4 sm:px-6">
                <Eyebrow c={c} />
                <motion.h2 style={{ opacity: k.beforeOpacity }} className="l-h2 text-zinc-950">
                    {c.problem.before}
                </motion.h2>

                <div ref={stageRef} className="mx-auto mt-10 aspect-[4/5] w-full max-w-[420px]">
                    <Stage c={c} p={p} k={k} compact className="h-full w-full" />
                </div>

                {/* The payoff sits below the stage: on a phone the stage is high on screen by the time it lands. */}
                <motion.p style={{ opacity: k.afterOpacity, y: k.afterY }} className="l-h2 mt-8 text-[var(--l-accent)]">
                    {c.problem.after}
                </motion.p>
                <motion.p style={{ opacity: k.afterOpacity }} className="mt-5 text-[17px] leading-7 text-zinc-600">
                    {c.problem.desc}
                </motion.p>
            </div>
        </section>
    );
};

interface StageProps {
    c: LandingCopy;
    p: MotionValue<number>;
    k: ReturnType<typeof useChoreo>;
    compact?: boolean;
    className?: string;
}

const Stage: React.FC<StageProps> = ({ c, p, k, compact, className }) => {
    const ref = useRef<HTMLDivElement>(null);
    // Measured stage size, so tile offsets are real pixels and only transforms animate.
    const w = useMotionValue(0);
    const h = useMotionValue(0);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const update = () => {
            w.set(el.clientWidth);
            h.set(el.clientHeight);
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [w, h]);

    return (
        <div className={`relative ${className ?? ''}`}>
            <ul className="sr-only">
                {problemApps.map((app) => (
                    <li key={app.key}>{c.problem.apps[app.key]}</li>
                ))}
            </ul>

            <div ref={ref} aria-hidden className="absolute inset-0">
                {/* State label: "before" while the tiles are out, "with SmartLife" once they have merged */}
                <div className="absolute left-0 top-0 grid">
                    <motion.span style={{ opacity: k.beforeLabel }} className="l-mono col-start-1 row-start-1 text-zinc-400">
                        {c.problem.beforeLabel}
                    </motion.span>
                    <motion.span style={{ opacity: k.afterLabel }} className="l-mono col-start-1 row-start-1 text-[var(--l-accent)]">
                        {c.problem.afterLabel}
                    </motion.span>
                </div>

                <motion.span
                    style={{ scale: k.orbitScale, opacity: k.orbitOpacity }}
                    className="absolute left-1/2 top-1/2 aspect-square w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-zinc-900/15"
                />

                {problemApps.map((app, i) => (
                    <Tile
                        key={app.key}
                        p={p}
                        i={i}
                        w={w}
                        h={h}
                        dx={(compact ? PHONE_POS[app.key][0] : app.x) / 100}
                        dy={(compact ? PHONE_POS[app.key][1] : app.y) / 100}
                        label={c.problem.apps[app.key]}
                        icon={app.icon}
                        compact={compact}
                    />
                ))}

                <motion.span
                    style={{ scale: k.ringScale, opacity: k.ringOpacity }}
                    className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-[var(--l-accent)] ${
                        compact ? 'h-36 w-36 rounded-[38px]' : 'h-56 w-56 rounded-[56px]'
                    }`}
                />
                <motion.div
                    style={{ scale: k.iconScale, opacity: k.iconOpacity }}
                    className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3"
                >
                    <img
                        src="/pwa-192x192.png"
                        alt=""
                        className={`border border-zinc-900/5 shadow-[0_30px_70px_-25px_rgba(2,132,199,0.55)] ${
                            compact ? 'h-24 w-24 rounded-[26px]' : 'h-36 w-36 rounded-[36px]'
                        }`}
                    />
                    <span className="text-lg font-semibold tracking-tight text-zinc-950">SmartLife</span>
                    <span className="l-mono text-[var(--l-warm)]">8 → 1</span>
                </motion.div>
            </div>
        </div>
    );
};

interface TileProps {
    p: MotionValue<number>;
    i: number;
    w: MotionValue<number>;
    h: MotionValue<number>;
    dx: number;
    dy: number;
    label: string;
    icon: Parameters<typeof GlassIcon>[0]['name'];
    compact?: boolean;
}

// One app tile. Bloom: centre → its spot (backOut overshoot, a little tilt).
// Merge: back to centre with x eased in and y eased out, so the path curves; shrinks and fades as it lands.
const Tile: React.FC<TileProps> = ({ p, i, w, h, dx, dy, label, icon, compact }) => {
    const s = BLOOM_START + i * STEP;
    const m = MERGE_START + i * STEP;

    const bloom = useTransform(p, [s, s + BLOOM_LEN], [0, 1], { ease: backOut });
    const merge = useTransform(p, [m, m + MERGE_LEN], [0, 1]);
    const mergeX = useTransform(p, [m, m + MERGE_LEN], [0, 1], { ease: easeIn });
    const mergeY = useTransform(p, [m, m + MERGE_LEN], [0, 1], { ease: easeOut });
    const fade = useTransform(p, [m + MERGE_LEN * 0.7, m + MERGE_LEN], [0, 1]);

    const x = useTransform(() => bloom.get() * (1 - mergeX.get()) * dx * w.get());
    const y = useTransform(() => bloom.get() * (1 - mergeY.get()) * dy * h.get());
    const scale = useTransform(() => (0.4 + 0.6 * bloom.get()) * (1 - 0.7 * merge.get()));
    const rotate = useTransform(() => TILT[i % TILT.length] * bloom.get() * (1 - merge.get()));
    const opacity = useTransform(() => Math.min(1, bloom.get() * 1.4) * (1 - fade.get()));

    return (
        <motion.div
            style={{ x, y, scale, rotate, opacity }}
            className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center whitespace-nowrap border border-zinc-900/[0.08] bg-white shadow-[0_12px_30px_-16px_rgba(24,24,27,0.3)] ${
                compact ? 'gap-2 rounded-xl px-2.5 py-2' : 'gap-2.5 rounded-2xl px-3.5 py-2.5'
            }`}
        >
            <GlassIcon name={icon} size={compact ? 22 : 30} />
            <span className={`font-medium text-zinc-700 ${compact ? 'text-[12.5px]' : 'text-[14px]'}`}>{label}</span>
        </motion.div>
    );
};
