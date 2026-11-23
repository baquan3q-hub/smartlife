import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, useScroll, useSpring, useTransform } from 'motion/react';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { LandingCopy } from '../i18n';
import { EASE } from '../motion/Reveal';
import { fadeUp, Line } from '../motion/Headline';
import { MagneticButton } from '../motion/MagneticButton';
import { ResponsiveImage } from '../motion/Media';
import { PhoneFrame } from '../motion/PhoneFrame';
import { images } from '../media.gen';
import CompanionAvatar from '../../ai/CompanionAvatar';

interface HeroProps {
    c: LandingCopy;
    onLogin: () => void;
    scrollTo: (target: string | number) => void;
}

const spring = { stiffness: 100, damping: 15, mass: 0.6 };

// Left-aligned headline over the ivory "morning" ground, with the product composition below it on the right.
export const Hero: React.FC<HeroProps> = ({ c, onLogin, scrollTo }) => {
    const ref = useRef<HTMLElement>(null);

    // Pointer as motion values: no React re-render per mouse move.
    const px = useMotionValue(0);
    const py = useMotionValue(0);
    const sx = useSpring(px, spring);
    const sy = useSpring(py, spring);

    useEffect(() => {
        if (!window.matchMedia('(pointer: fine)').matches) return;
        const onMove = (e: PointerEvent) => {
            px.set(e.clientX / window.innerWidth - 0.5);
            py.set(e.clientY / window.innerHeight - 0.5);
        };
        window.addEventListener('pointermove', onMove, { passive: true });
        return () => window.removeEventListener('pointermove', onMove);
    }, [px, py]);

    const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
    const p = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.3 });

    // Depth planes: the phone and the chat bubble travel faster than the dashboard behind them.
    const boardY = useTransform(p, [0, 1], [0, -40]);
    const phoneY = useTransform(p, [0, 1], [0, -130]);
    const bubbleY = useTransform(p, [0, 1], [0, -90]);
    const boardX = useTransform(sx, (v) => v * -10);
    const phoneX = useTransform(sx, (v) => v * 18);
    const phoneTilt = useTransform(sy, (v) => v * -4);
    const bubbleX = useTransform(sx, (v) => v * 26);

    return (
        <section ref={ref} id="top" className="relative overflow-hidden bg-[var(--l-dawn)] pt-28 sm:pt-36">
            <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
                <motion.p {...fadeUp(0)} className="l-mono mb-6 flex items-center gap-3 text-zinc-500">
                    <span className="text-[var(--l-warm)]">07:00</span>
                    <span className="h-px w-8 bg-zinc-300" />
                    {c.heroEyebrow}
                </motion.p>

                <h1 className="l-display max-w-[14ch] text-zinc-950 sm:max-w-none">
                    {c.heroLines.map((line, i) => (
                        <Line key={line} delay={0.08 + i * 0.1} className={i === 1 ? 'text-zinc-400' : undefined}>
                            {line}
                        </Line>
                    ))}
                </h1>

                <div className="mt-10 grid gap-12 lg:mt-14 lg:grid-cols-12 lg:gap-10">
                    <div className="lg:col-span-4">
                        <motion.p {...fadeUp(0.3)} className="max-w-md text-[17px] leading-7 text-zinc-600">
                            {c.heroDesc}
                        </motion.p>

                        <motion.div {...fadeUp(0.4)} className="mt-8 flex flex-col items-start gap-5 sm:flex-row sm:items-center lg:flex-col lg:items-start xl:flex-row xl:items-center">
                            <MagneticButton
                                onClick={onLogin}
                                className="group flex h-12 items-center justify-center gap-2.5 whitespace-nowrap rounded-full bg-zinc-950 px-7 text-[15px] font-medium text-white transition-colors hover:bg-zinc-800"
                            >
                                {c.startNow}
                                <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" />
                            </MagneticButton>
                            <button
                                type="button"
                                onClick={() => scrollTo('day')}
                                className="group inline-flex items-center gap-2 text-[15px] font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-[6px] transition-colors hover:text-zinc-950 hover:decoration-zinc-950"
                            >
                                {c.heroSecondary}
                                <ArrowDown size={15} className="transition-transform duration-300 group-hover:translate-y-0.5" />
                            </button>
                        </motion.div>

                        <motion.ul {...fadeUp(0.5)} className="mt-10 space-y-2 border-t border-zinc-900/10 pt-6">
                            {c.heroMeta.map((m, i) => (
                                <li key={m} className="flex items-baseline gap-4 text-[14px] text-zinc-600">
                                    <span className="l-mono w-6 text-zinc-400">{String(i + 1).padStart(2, '0')}</span>
                                    {m}
                                </li>
                            ))}
                        </motion.ul>
                    </div>

                    {/* Composition: dashboard, phone in front of it, companion bubble in front of both. */}
                    <div className="relative pb-24 sm:pb-32 lg:col-span-8 lg:-mr-24 xl:-mr-40">
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 1, ease: EASE, delay: 0.35 }}
                        >
                            <motion.div style={{ y: boardY, x: boardX }}>
                                <ResponsiveImage
                                    img={images['hero-dashboard']}
                                    alt="SmartLife dashboard"
                                    sizes="(min-width: 1024px) 900px, 100vw"
                                    priority
                                    className="h-auto w-full rounded-[20px] border border-zinc-900/[0.08] bg-white shadow-[0_40px_100px_-40px_rgba(24,24,27,0.35)]"
                                />
                            </motion.div>
                        </motion.div>

                        <motion.div
                            style={{ y: phoneY, x: phoneX, rotate: phoneTilt }}
                            className="absolute -bottom-2 left-3 hidden w-[30%] max-w-[230px] sm:block lg:-left-10"
                        >
                            <motion.div
                                initial={{ opacity: 0, y: 70 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 1.1, ease: EASE, delay: 0.55 }}
                            >
                                <PhoneFrame>
                                    <ResponsiveImage img={images['hero-phone']} alt="SmartLife mobile" sizes="230px" priority />
                                </PhoneFrame>
                            </motion.div>
                        </motion.div>

                        <motion.div
                            style={{ y: bubbleY, x: bubbleX }}
                            className="absolute bottom-6 right-2 w-[78%] max-w-[340px] sm:bottom-16 sm:right-10 lg:right-32 xl:right-48"
                        >
                            <motion.div
                                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 22, delay: 0.9 }}
                                className="rounded-[20px] border border-zinc-900/[0.08] bg-white p-4 shadow-[0_24px_60px_-24px_rgba(24,24,27,0.4)]"
                            >
                                <div className="mb-2.5 flex items-center gap-2.5">
                                    <CompanionAvatar avatar="sun" size={30} online />
                                    <span className="text-[13px] font-semibold text-zinc-900">{c.heroBubbleName}</span>
                                    <span className="l-mono ml-auto text-[var(--l-warm)]">20:00</span>
                                </div>
                                <p className="text-[14px] leading-6 text-zinc-700">{c.heroBubble}</p>
                            </motion.div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    );
};
