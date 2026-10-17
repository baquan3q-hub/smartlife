import React, { useRef } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { LandingCopy } from '../i18n';
import { EASE } from '../motion/Reveal';
import { fadeUp, Line } from '../motion/Headline';
import { MagneticButton } from '../motion/MagneticButton';
import { ResponsiveImage } from '../motion/Media';
import { PhoneFrame } from '../motion/PhoneFrame';
import { images } from '../media.gen';

interface HeroProps {
    c: LandingCopy;
    onLogin: () => void;
    scrollTo: (target: string | number) => void;
}

export const Hero: React.FC<HeroProps> = ({ c, onLogin, scrollTo }) => {
    const mockRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({ target: mockRef, offset: ['start end', 'center center'] });
    const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });
    const rotateX = useTransform(progress, [0, 1], [22, 0]);
    const scale = useTransform(progress, [0, 1], [0.9, 1]);
    const y = useTransform(progress, [0, 1], [40, 0]);
    const phoneY = useTransform(progress, [0, 1], [110, 0]);

    return (
        <section id="top" className="relative overflow-hidden pt-32 sm:pt-40">
            <div className="l-dots pointer-events-none absolute inset-0" aria-hidden />
            <div
                className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
                style={{ background: 'radial-gradient(closest-side, rgba(2,132,199,0.14), transparent)' }}
                aria-hidden
            />

            <div className="relative mx-auto max-w-6xl px-4 text-center sm:px-6">
                <motion.div {...fadeUp(0)} className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-900/[0.08] bg-white/70 px-3 py-1.5 text-[13px] font-medium text-zinc-600 backdrop-blur">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--l-accent)]" />
                    {c.heroEyebrow}
                </motion.div>

                <h1 className="l-h1 mx-auto max-w-4xl text-zinc-950">
                    <Line delay={0.1}>{c.heroTitle1}</Line>
                    <Line delay={0.2} className="text-zinc-400">{c.heroTitle2}</Line>
                </h1>

                <motion.p {...fadeUp(0.35)} className="mx-auto mt-6 max-w-xl text-[17px] leading-7 text-zinc-600">
                    {c.heroDesc}
                </motion.p>

                <motion.div {...fadeUp(0.45)} className="mt-9 flex flex-col items-center justify-center gap-3 xs:flex-row">
                    <MagneticButton
                        onClick={onLogin}
                        className="group flex h-12 w-full items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 text-[15px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(9,9,11,0.5)] transition-colors hover:bg-zinc-800 xs:w-auto"
                    >
                        {c.startNow}
                        <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" />
                    </MagneticButton>
                    <button
                        type="button"
                        onClick={() => scrollTo('dashboard-preview')}
                        className="flex h-12 w-full items-center justify-center rounded-full border border-zinc-900/10 bg-white px-6 text-[15px] font-medium text-zinc-800 transition-colors hover:border-zinc-900/20 hover:bg-zinc-50 xs:w-auto"
                    >
                        {c.learnMore}
                    </button>
                </motion.div>
            </div>

            <div
                id="dashboard-preview"
                ref={mockRef}
                className="relative mx-auto mt-14 max-w-6xl px-4 pb-16 sm:mt-20 sm:px-6 sm:pb-20"
                style={{ perspective: 1400 }}
            >
                {/* Desktop screenshot; small screens get the phone screenshot alone */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, ease: EASE, delay: 0.5 }}
                    style={{ rotateX, scale, y, transformOrigin: 'center top' }}
                    className="hidden rounded-[22px] border border-zinc-900/[0.08] bg-white/80 p-1.5 shadow-[0_40px_100px_-30px_rgba(9,9,11,0.35)] backdrop-blur sm:block sm:rounded-[28px] sm:p-2"
                >
                    <div className="flex items-center justify-between px-3 py-2 sm:px-4">
                        <div className="flex gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
                            <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
                            <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
                        </div>
                        <span className="text-[11px] font-medium text-zinc-400">{c.previewBadge}</span>
                    </div>
                    <ResponsiveImage
                        img={images['hero-dashboard']}
                        alt="SmartLife"
                        sizes="(min-width: 1152px) 1120px, 100vw"
                        className="h-auto w-full rounded-[16px] sm:rounded-[22px]"
                        priority
                    />
                </motion.div>

                <motion.div
                    style={{ y: phoneY }}
                    className="relative mx-auto w-[64%] max-w-[270px] sm:absolute sm:bottom-0 sm:right-10 sm:mx-0 sm:w-[23%] sm:max-w-[250px] lg:right-14"
                >
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1.1, ease: EASE, delay: 0.8 }}
                    >
                        <PhoneFrame>
                            <ResponsiveImage img={images['hero-phone']} alt="SmartLife mobile" sizes="(min-width: 640px) 250px, 64vw" priority />
                        </PhoneFrame>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
};
