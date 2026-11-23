import React, { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react';
import { LandingCopy } from '../i18n';
import { problemApps } from '../data';
import { GlassIcon } from '../../icons/GlassIcon';
import { Reveal } from '../motion/Reveal';
import { LG_QUERY, useMediaQuery } from '../hooks/useMediaQuery';

interface ProblemSolutionProps {
    c: LandingCopy;
}

// Peak #1: eight scattered apps are pulled into one SmartLife icon as you scroll (desktop).
// Phones and reduced motion get the same story as a still before/after layout.
export const ProblemSolution: React.FC<ProblemSolutionProps> = ({ c }) => {
    const isLg = useMediaQuery(LG_QUERY);
    const reduced = useReducedMotion();
    return isLg && !reduced ? <StickyProblem c={c} /> : <StaticProblem c={c} />;
};

const Heading: React.FC<{ c: LandingCopy }> = ({ c }) => (
    <p className="l-mono mb-5 text-zinc-500">{c.problem.eyebrow}</p>
);

const StickyProblem: React.FC<ProblemSolutionProps> = ({ c }) => {
    const ref = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
    const p = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });

    const beforeOpacity = useTransform(p, [0.42, 0.6], [1, 0.25]);
    const afterOpacity = useTransform(p, [0.5, 0.68], [0, 1]);
    const afterY = useTransform(p, [0.5, 0.68], [24, 0]);
    const iconScale = useTransform(p, [0.45, 0.7], [0.4, 1]);
    const iconOpacity = useTransform(p, [0.45, 0.62], [0, 1]);
    const ringScale = useTransform(p, [0.62, 0.9], [0.6, 1.25]);
    const ringOpacity = useTransform(p, [0.62, 0.7, 0.9], [0, 0.5, 0]);

    return (
        <section ref={ref} id="problem" className="relative h-[230vh] bg-[var(--l-dawn)]">
            <div className="sticky top-0 flex h-screen items-center overflow-hidden">
                <div className="mx-auto grid w-full max-w-[1240px] grid-cols-12 items-center gap-10 px-6">
                    <div className="col-span-5">
                        <Heading c={c} />
                        <motion.h2 style={{ opacity: beforeOpacity }} className="l-h2 text-zinc-950">
                            {c.problem.before}
                        </motion.h2>
                        <motion.p style={{ opacity: afterOpacity, y: afterY }} className="l-h2 mt-3 text-[var(--l-accent)]">
                            {c.problem.after}
                        </motion.p>
                        <motion.p style={{ opacity: afterOpacity }} className="mt-8 max-w-md text-[17px] leading-7 text-zinc-600">
                            {c.problem.desc}
                        </motion.p>
                    </div>

                    <div className="relative col-span-7 aspect-square max-h-[78vh] w-full justify-self-center">
                        {problemApps.map((app) => (
                            <Tile key={app.key} p={p} x={app.x} y={app.y} label={c.problem.apps[app.key]} icon={app.icon} />
                        ))}
                        <motion.span
                            aria-hidden
                            style={{ scale: ringScale, opacity: ringOpacity }}
                            className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-[56px] border-2 border-[var(--l-accent)]"
                        />
                        <motion.div
                            style={{ scale: iconScale, opacity: iconOpacity }}
                            className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4"
                        >
                            <img
                                src="/pwa-192x192.png"
                                alt="SmartLife"
                                className="h-36 w-36 rounded-[36px] border border-zinc-900/5 shadow-[0_30px_70px_-25px_rgba(2,132,199,0.55)]"
                            />
                            <span className="text-lg font-semibold tracking-tight text-zinc-950">SmartLife</span>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    );
};

interface TileProps {
    p: MotionValue<number>;
    x: number;
    y: number;
    label: string;
    icon: Parameters<typeof GlassIcon>[0]['name'];
}

// One app tile: drifts from its scattered spot to the centre and shrinks into the SmartLife icon.
const Tile: React.FC<TileProps> = ({ p, x, y, label, icon }) => {
    const left = useTransform(p, [0.12, 0.55], [`${50 + x}%`, '50%']);
    const top = useTransform(p, [0.12, 0.55], [`${50 + y}%`, '50%']);
    const scale = useTransform(p, [0.12, 0.55], [1, 0.35]);
    const opacity = useTransform(p, [0.4, 0.56], [1, 0]);
    return (
        <motion.div
            style={{ left, top, scale, opacity }}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 whitespace-nowrap rounded-2xl border border-zinc-900/[0.08] bg-white px-3.5 py-2.5 shadow-[0_12px_30px_-16px_rgba(24,24,27,0.3)]"
        >
            <GlassIcon name={icon} size={30} />
            <span className="text-[14px] font-medium text-zinc-700">{label}</span>
        </motion.div>
    );
};

const StaticProblem: React.FC<ProblemSolutionProps> = ({ c }) => (
    <section id="problem" className="bg-[var(--l-dawn)] py-20 sm:py-28">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <Reveal className="max-w-2xl">
                <Heading c={c} />
                <h2 className="l-h2 text-zinc-950">{c.problem.before}</h2>
                <p className="l-h2 mt-2 text-[var(--l-accent)]">{c.problem.after}</p>
                <p className="mt-6 text-[17px] leading-7 text-zinc-600">{c.problem.desc}</p>
            </Reveal>

            <div className="mt-12 grid gap-4 md:grid-cols-12">
                <Reveal className="rounded-[20px] border border-dashed border-zinc-900/15 p-5 md:col-span-7">
                    <p className="l-mono mb-4 text-zinc-400">{c.problem.beforeLabel}</p>
                    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {problemApps.map((app) => (
                            <li key={app.key} className="flex items-center gap-2 rounded-xl bg-white/70 px-2.5 py-2 text-[13px] text-zinc-500">
                                <GlassIcon name={app.icon} size={22} className="opacity-70 grayscale" />
                                <span className="truncate">{c.problem.apps[app.key]}</span>
                            </li>
                        ))}
                    </ul>
                </Reveal>
                <Reveal
                    delay={0.1}
                    className="flex items-center gap-5 rounded-[20px] bg-white p-5 shadow-[0_20px_50px_-30px_rgba(2,132,199,0.5)] md:col-span-5"
                >
                    <img src="/pwa-192x192.png" alt="" className="h-20 w-20 rounded-[22px] border border-zinc-900/5" />
                    <div>
                        <p className="l-mono mb-1 text-[var(--l-accent)]">{c.problem.afterLabel}</p>
                        <p className="text-xl font-semibold tracking-tight text-zinc-950">SmartLife</p>
                    </div>
                </Reveal>
            </div>
        </div>
    </section>
);
