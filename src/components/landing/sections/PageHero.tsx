import React from 'react';
import { motion } from 'motion/react';
import { fadeUp, Line } from '../motion/Headline';

interface PageHeroProps {
    eyebrow: string;
    title1: string;
    title2: string;
    desc: string;
    children?: React.ReactNode;
}

// Opening block of a subpage: same type scale and entrance motion as the landing hero.
export const PageHero: React.FC<PageHeroProps> = ({ eyebrow, title1, title2, desc, children }) => (
    <section className="relative overflow-hidden pb-16 pt-32 sm:pb-20 sm:pt-40">
        <div className="l-dots pointer-events-none absolute inset-0" aria-hidden />
        <div
            className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
            style={{ background: 'radial-gradient(closest-side, rgba(2,132,199,0.14), transparent)' }}
            aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 text-center sm:px-6">
            <motion.div
                {...fadeUp(0)}
                className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-900/[0.08] bg-white/70 px-3 py-1.5 text-[13px] font-medium text-zinc-600 backdrop-blur"
            >
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--l-accent)]" />
                {eyebrow}
            </motion.div>
            <h1 className="l-h1 mx-auto max-w-4xl text-zinc-950">
                <Line delay={0.1}>{title1}</Line>
                <Line delay={0.2} className="text-zinc-400">{title2}</Line>
            </h1>
            <motion.p {...fadeUp(0.35)} className="mx-auto mt-6 max-w-xl text-[17px] leading-7 text-zinc-600">
                {desc}
            </motion.p>
            {children && <motion.div {...fadeUp(0.45)}>{children}</motion.div>}
        </div>
    </section>
);
