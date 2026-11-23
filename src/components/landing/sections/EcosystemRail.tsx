import React, { useRef, useEffect } from 'react';
import { motion, useMotionValue, useScroll, useSpring, useTransform } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import { LandingCopy } from '../i18n';
import { ecosystemModules } from '../data';
import { GlassIcon } from '../../icons/GlassIcon';
import { ResponsiveImage } from '../motion/Media';

interface EcosystemRailProps {
    c: LandingCopy;
    scrollTo: (target: string) => void;
}

export const EcosystemRail: React.FC<EcosystemRailProps> = ({ c, scrollTo }) => {
    const containerRef = useRef<HTMLElement>(null);
    const railRef = useRef<HTMLDivElement>(null);
    // How far the rail must travel; a motion value so the transform below always reads the latest width.
    const overflowDist = useMotionValue(0);

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ['start start', 'end end']
    });

    const smoothP = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 0.3 });

    useEffect(() => {
        const rail = railRef.current;
        if (!rail) return;
        const update = () => overflowDist.set(Math.max(0, rail.scrollWidth - window.innerWidth + 96));
        update();
        const ro = new ResizeObserver(update);
        ro.observe(rail);
        window.addEventListener('resize', update);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', update);
        };
    }, [overflowDist]);

    // Drive horizontal translation from vertical scroll progress
    const travel = useTransform(smoothP, [0.05, 0.92], [0, 1]);
    const railX = useTransform(() => -travel.get() * overflowDist.get());
    const progressWidth = useTransform(smoothP, [0, 1], ['0%', '100%']);

    const copy = c.ecosystem;

    return (
        <section
            ref={containerRef}
            id="ecosystem"
            className="relative bg-[var(--l-night)] py-20 text-white selection:bg-sky-500 selection:text-white md:min-h-[280vh] md:py-0"
        >
            {/* Sticky Viewport Container */}
            <div className="flex flex-col justify-center overflow-hidden md:sticky md:top-0 md:h-screen md:py-8">
                {/* Header Information */}
                <div className="relative mx-auto mb-8 w-full max-w-[1240px] px-4 sm:mb-12 sm:px-6">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                        <div>
                            <p className="l-mono text-zinc-400">{copy.eyebrow}</p>
                            <h2 className="l-h2 mt-3 text-white max-w-2xl">
                                {copy.title}
                            </h2>
                        </div>
                        <p className="text-[15px] leading-relaxed text-zinc-400 max-w-md">
                            {copy.desc}
                        </p>
                    </div>

                    {/* Scroll Indicator Bar */}
                    <div className="mt-6 flex items-center gap-4">
                        <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                                style={{ width: progressWidth }}
                                className="h-full rounded-full bg-[var(--l-warm)]"
                            />
                        </div>
                        <span className="l-mono shrink-0 text-zinc-500">{String(ecosystemModules.length).padStart(2, '0')}</span>
                    </div>
                </div>

                {/* The Lateral Pan Rail (Desktop: Driven by scrollX; Mobile: native smooth snap swipe) */}
                <div className="relative w-full">
                    {/* Desktop Animated Rail */}
                    <motion.div
                        ref={railRef}
                        style={{ x: railX }}
                        className="hidden md:flex gap-6 pl-[max(2rem,calc((100vw-1240px)/2+1.5rem))] pr-16 items-stretch"
                    >
                        {ecosystemModules.map((item) => {
                            const modCopy = copy.items[item.key];
                            return (
                                <article
                                    key={item.key}
                                    className="group relative flex w-[380px] shrink-0 flex-col justify-between overflow-hidden rounded-[26px] border border-white/10 bg-zinc-900/90 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-white/25 hover:bg-zinc-900"
                                >
                                    {/* Top Tag & Glass Icon */}
                                    <div>
                                        <div className="flex items-center justify-between mb-5">
                                            <span className="text-xs font-bold font-mono text-sky-400 tracking-wider">
                                                {modCopy.tag}
                                            </span>
                                            <div className="rounded-xl border border-white/10 bg-white/5 p-2 shadow-inner">
                                                <GlassIcon name={item.icon} size={36} />
                                            </div>
                                        </div>

                                        <h3 className="text-xl font-bold text-white group-hover:text-sky-300 transition-colors">
                                            {modCopy.title}
                                        </h3>
                                        <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
                                            {modCopy.desc}
                                        </p>
                                    </div>

                                    {/* Image Preview / Feature Card Bottom */}
                                    <div className="mt-6 relative overflow-hidden rounded-xl border border-white/10 bg-zinc-950/60 p-2">
                                        {item.img ? (
                                            <ResponsiveImage
                                                img={item.img}
                                                alt={modCopy.title}
                                                sizes="360px"
                                                className="h-36 w-full rounded-lg object-cover object-top opacity-85 transition-all duration-500 group-hover:opacity-100 group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="h-36 flex items-center justify-center text-xs text-zinc-500 font-mono">
                                                SmartLife Integrated Module
                                            </div>
                                        )}
                                    </div>

                                    {/* Micro Action */}
                                    <div className="mt-5 flex items-center justify-end border-t border-white/5 pt-3 text-xs text-zinc-400">
                                                                                <button
                                            type="button"
                                            onClick={() => scrollTo(item.id)}
                                            className="inline-flex items-center gap-1 font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                                        >
                                            {c.ui.detail}
                                            <ChevronRight size={13} />
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </motion.div>

                    {/* Mobile Native Touch Snap Rail */}
                    <div className="flex md:hidden gap-4 px-4 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-4">
                        {ecosystemModules.map((item) => {
                            const modCopy = copy.items[item.key];
                            return (
                                <article
                                    key={`m-${item.key}`}
                                    className="w-[85vw] max-w-[320px] shrink-0 snap-center rounded-2xl border border-white/10 bg-zinc-900 p-5"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-xs font-mono font-bold text-sky-400">{modCopy.tag}</span>
                                        <GlassIcon name={item.icon} size={30} />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">{modCopy.title}</h3>
                                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">{modCopy.desc}</p>
                                </article>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
};
