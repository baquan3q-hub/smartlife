import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'motion/react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { LandingCopy } from '../i18n';
import { EASE } from '../motion/Reveal';
import { fadeUp, Line } from '../motion/Headline';
import { MagneticButton } from '../motion/MagneticButton';
import { ResponsiveImage } from '../motion/Media';
import { PhoneFrame } from '../motion/PhoneFrame';
import { GlassIcon } from '../../icons/GlassIcon';
import { images } from '../media.gen';

interface HeroProps {
    c: LandingCopy;
    onLogin: () => void;
    scrollTo: (target: string | number) => void;
}

export const Hero: React.FC<HeroProps> = ({ c, onLogin, scrollTo }) => {
    const stageRef = useRef<HTMLDivElement>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    // Track scroll across the hero viewport
    const { scrollYProgress } = useScroll({
        target: stageRef,
        offset: ['start start', 'end start']
    });

    const smoothP = useSpring(scrollYProgress, { stiffness: 100, damping: 28, mass: 0.3 });

    // Multi-plane parallax differential rates
    const headlineY = useTransform(smoothP, [0, 1], [0, 80]);
    const headlineOpacity = useTransform(smoothP, [0, 0.7], [1, 0.1]);

    const dashboardRotateX = useTransform(smoothP, [0, 0.8], [14, 0]);
    const dashboardScale = useTransform(smoothP, [0, 0.8], [0.94, 1.02]);
    const dashboardY = useTransform(smoothP, [0, 1], [20, -50]);

    // Phone plane moves 35% faster, overtaking the dashboard on scroll
    const phoneY = useTransform(smoothP, [0, 1], [60, -110]);
    const phoneRotate = useTransform(smoothP, [0, 1], [-2, 2]);

    // Atmospheric 3D icons on independent depth planes
    const icon1Y = useTransform(smoothP, [0, 1], [0, -140]);
    const icon2Y = useTransform(smoothP, [0, 1], [0, -80]);
    const icon3Y = useTransform(smoothP, [0, 1], [0, -170]);
    const icon4Y = useTransform(smoothP, [0, 1], [0, -100]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const { innerWidth, innerHeight } = window;
            const x = (e.clientX / innerWidth - 0.5) * 20;
            const y = (e.clientY / innerHeight - 0.5) * 20;
            setMousePos({ x, y });
        };
        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <section ref={stageRef} id="top" className="relative overflow-hidden pt-28 pb-16 sm:pt-36 sm:pb-24">
            {/* Deep Background Plane: Glow + Grid Dots */}
            <div className="l-dots pointer-events-none absolute inset-0 opacity-80" aria-hidden />
            <div
                className="pointer-events-none absolute left-1/2 top-4 h-[550px] w-[950px] -translate-x-1/2 rounded-full opacity-60 blur-3xl transition-transform duration-700 ease-out"
                style={{
                    background: 'radial-gradient(closest-side, rgba(2,132,199,0.18), rgba(99,102,241,0.06), transparent)',
                    transform: `translate3d(calc(-50% + ${mousePos.x * 0.4}px), ${mousePos.y * 0.4}px, 0)`
                }}
                aria-hidden
            />

            {/* Floating 3D Glass Icons - Far & Mid Planes (hidden on very small screens to maintain crisp clarity) */}
            <motion.div
                style={{ y: icon1Y }}
                animate={{
                    x: mousePos.x * 0.7,
                    rotate: [0, 3, 0]
                }}
                transition={{ rotate: { duration: 6, repeat: Infinity, ease: 'easeInOut' } }}
                className="pointer-events-none absolute left-[5%] top-36 z-20 hidden md:block"
            >
                <div className="flex items-center gap-2 rounded-2xl border border-white/60 bg-white/70 p-3 shadow-[0_16px_36px_-12px_rgba(2,132,199,0.25)] backdrop-blur-md">
                    <GlassIcon name="kanban" size={40} />
                    <div className="text-left">
                        <span className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Workflow</span>
                        <span className="block text-[13px] font-bold text-zinc-800">Kanban 4 Cột</span>
                    </div>
                </div>
            </motion.div>

            <motion.div
                style={{ y: icon2Y }}
                animate={{
                    x: -mousePos.x * 0.6,
                    rotate: [0, -4, 0]
                }}
                transition={{ rotate: { duration: 7, repeat: Infinity, ease: 'easeInOut' } }}
                className="pointer-events-none absolute right-[6%] top-44 z-20 hidden md:block"
            >
                <div className="flex items-center gap-2 rounded-2xl border border-white/60 bg-white/70 p-3 shadow-[0_16px_36px_-12px_rgba(99,102,241,0.25)] backdrop-blur-md">
                    <GlassIcon name="gpa" size={40} />
                    <div className="text-left">
                        <span className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Academic</span>
                        <span className="block text-[13px] font-bold text-zinc-800">GPA VNU Vàng</span>
                    </div>
                </div>
            </motion.div>

            <motion.div
                style={{ y: icon3Y }}
                animate={{
                    x: mousePos.x * 0.5,
                    rotate: [0, 2, 0]
                }}
                transition={{ rotate: { duration: 8, repeat: Infinity, ease: 'easeInOut' } }}
                className="pointer-events-none absolute left-[8%] bottom-32 z-30 hidden lg:block"
            >
                <div className="flex items-center gap-2.5 rounded-2xl border border-white/60 bg-white/80 p-3 shadow-[0_20px_40px_-16px_rgba(2,132,199,0.3)] backdrop-blur-md">
                    <GlassIcon name="ai" size={42} />
                    <div className="text-left">
                        <span className="block text-[11px] font-semibold text-sky-600 uppercase tracking-wider">AI Advisor</span>
                        <span className="block text-[13px] font-bold text-zinc-800">Cố Vấn Định Hướng</span>
                    </div>
                </div>
            </motion.div>

            {/* Typography Plane */}
            <motion.div
                style={{ y: headlineY, opacity: headlineOpacity }}
                className="relative z-10 mx-auto max-w-6xl px-4 text-center sm:px-6"
            >
                <motion.div
                    {...fadeUp(0)}
                    className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-900/[0.08] bg-white/80 px-4 py-1.5 text-[13px] font-semibold text-zinc-700 shadow-sm backdrop-blur"
                >
                    <span className="flex h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                    <span>{c.heroEyebrow}</span>
                    <span className="h-3 w-px bg-zinc-200" />
                    <span className="flex items-center gap-1 text-sky-600 font-medium">
                        <Sparkles size={13} />
                        Next-Gen 2026
                    </span>
                </motion.div>

                <h1 className="l-h1 mx-auto max-w-4xl text-zinc-950">
                    <Line delay={0.08}>{c.heroTitle1}</Line>
                    <Line delay={0.18} className="text-zinc-400">{c.heroTitle2}</Line>
                </h1>

                <motion.p {...fadeUp(0.3)} className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-zinc-600 sm:text-[18px]">
                    {c.heroDesc}
                </motion.p>

                <motion.div {...fadeUp(0.42)} className="mt-9 flex flex-col items-center justify-center gap-3.5 xs:flex-row">
                    <MagneticButton
                        onClick={onLogin}
                        className="group flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-zinc-950 px-7 text-[15px] font-medium text-white shadow-[0_10px_28px_-8px_rgba(9,9,11,0.5)] transition-all hover:bg-zinc-800 hover:shadow-[0_14px_32px_-8px_rgba(9,9,11,0.6)] xs:w-auto"
                    >
                        <span>{c.startNow}</span>
                        <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" />
                    </MagneticButton>
                    <button
                        type="button"
                        onClick={() => scrollTo('sync-engine')}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-zinc-900/10 bg-white/90 px-6 text-[15px] font-medium text-zinc-800 shadow-sm transition-all hover:border-zinc-900/25 hover:bg-zinc-50 xs:w-auto"
                    >
                        <span>{c.learnMore}</span>
                    </button>
                </motion.div>
            </motion.div>

            {/* Primary Device & Foreground Subject Plane (Dimensional Stage) */}
            <div
                id="dashboard-preview"
                className="relative mx-auto mt-12 max-w-6xl px-4 pb-12 sm:mt-18 sm:px-6 sm:pb-16"
                style={{ perspective: 1600 }}
            >
                {/* Desktop Dashboard Screen */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.9, ease: EASE, delay: 0.4 }}
                    style={{
                        rotateX: dashboardRotateX,
                        scale: dashboardScale,
                        y: dashboardY,
                        transformOrigin: 'center top'
                    }}
                    className="relative rounded-[24px] border border-zinc-900/[0.08] bg-white/80 p-2 shadow-[0_45px_110px_-30px_rgba(9,9,11,0.28)] backdrop-blur-md sm:rounded-[30px] sm:p-2.5"
                >
                    {/* Apple-style window chrome */}
                    <div className="flex items-center justify-between px-3 py-2 sm:px-4">
                        <div className="flex gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{c.previewBadge}</span>
                        </div>
                    </div>
                    <ResponsiveImage
                        img={images['hero-dashboard']}
                        alt="SmartLife Life OS Dashboard"
                        sizes="(min-width: 1152px) 1120px, 100vw"
                        className="h-auto w-full rounded-[18px] sm:rounded-[24px] shadow-sm"
                        priority
                    />
                </motion.div>

                {/* Foreground Phone Subject Plane (Travels faster, creating true optical depth) */}
                <motion.div
                    style={{
                        y: phoneY,
                        rotate: phoneRotate
                    }}
                    className="relative -mt-16 mx-auto w-[72%] max-w-[280px] sm:absolute sm:bottom-[-20px] sm:right-8 sm:mt-0 sm:w-[25%] sm:max-w-[260px] lg:right-12 z-30"
                >
                    <motion.div
                        initial={{ opacity: 0, y: 60, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 1.1, ease: EASE, delay: 0.6 }}
                        className="drop-shadow-[0_35px_50px_rgba(0,0,0,0.32)]"
                    >
                        <PhoneFrame>
                            <ResponsiveImage
                                img={images['hero-phone']}
                                alt="SmartLife Mobile"
                                sizes="(min-width: 640px) 260px, 72vw"
                                priority
                            />
                        </PhoneFrame>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
};
