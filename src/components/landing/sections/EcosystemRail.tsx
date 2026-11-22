import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'motion/react';
import { ArrowRight, Compass, Sparkles, ChevronRight, Layers } from 'lucide-react';
import { LandingCopy } from '../i18n';
import { ecosystemModules } from '../data';
import { GlassIcon } from '../../icons/GlassIcon';
import { ResponsiveImage } from '../motion/Media';
import { TiltCard } from '../motion/TiltCard';

interface EcosystemRailProps {
    c: LandingCopy;
    scrollTo: (target: string) => void;
}

export const EcosystemRail: React.FC<EcosystemRailProps> = ({ c, scrollTo }) => {
    const containerRef = useRef<HTMLElement>(null);
    const railRef = useRef<HTMLDivElement>(null);
    const [overflowDist, setOverflowDist] = useState(0);

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ['start start', 'end end']
    });

    const smoothP = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 0.3 });

    useEffect(() => {
        const updateWidth = () => {
            if (railRef.current) {
                const scrollW = railRef.current.scrollWidth;
                const clientW = window.innerWidth;
                const diff = Math.max(0, scrollW - clientW + 96);
                setOverflowDist(diff);
            }
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    // Drive horizontal translation from vertical scroll progress
    const railX = useTransform(smoothP, [0.05, 0.92], [0, -overflowDist]);
    const progressWidth = useTransform(smoothP, [0, 1], ['0%', '100%']);

    const copy = c.ecosystem;

    return (
        <section
            ref={containerRef}
            id="ecosystem"
            className="relative min-h-[280vh] bg-zinc-950 text-white selection:bg-sky-500 selection:text-white"
        >
            {/* Sticky Viewport Container */}
            <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden py-8">
                {/* Background Subtle Gradient Grid */}
                <div
                    className="pointer-events-none absolute inset-0 opacity-20"
                    style={{
                        backgroundImage: 'radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)',
                        backgroundSize: '28px 28px'
                    }}
                    aria-hidden
                />
                <div
                    className="pointer-events-none absolute -top-40 left-1/3 h-96 w-[600px] rounded-full blur-3xl opacity-25"
                    style={{ background: 'radial-gradient(circle, rgba(2,132,199,0.5), transparent 70%)' }}
                    aria-hidden
                />

                {/* Header Information */}
                <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 mb-8 sm:mb-12">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-3.5 py-1 text-xs font-semibold text-sky-400">
                                <Compass size={13} />
                                <span>{copy.eyebrow}</span>
                            </div>
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
                                className="h-full bg-gradient-to-r from-sky-400 via-indigo-400 to-emerald-400 rounded-full"
                            />
                        </div>
                        <span className="text-xs font-mono text-zinc-400 shrink-0">10 Modules • Lateral Travel</span>
                    </div>
                </div>

                {/* The Lateral Pan Rail (Desktop: Driven by scrollX; Mobile: native smooth snap swipe) */}
                <div className="relative w-full">
                    {/* Desktop Animated Rail */}
                    <motion.div
                        ref={railRef}
                        style={{ x: railX }}
                        className="hidden md:flex gap-6 pl-[max(2rem,calc((100vw-72rem)/2+1.5rem))] pr-16 items-stretch"
                    >
                        {ecosystemModules.map((item, idx) => {
                            const modCopy = copy.items[item.key];
                            return (
                                <article
                                    key={item.key}
                                    id={item.id}
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
                                    <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-3 text-xs text-zinc-400">
                                        <span className="font-medium text-zinc-500">Life OS Native</span>
                                        <button
                                            type="button"
                                            onClick={() => scrollTo(item.id)}
                                            className="inline-flex items-center gap-1 font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                                        >
                                            Chi tiết
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
