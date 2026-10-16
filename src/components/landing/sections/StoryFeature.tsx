import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { GoogleCalendarIcon } from '../../icons/GoogleCalendarIcon';
import { GoogleTasksIcon } from '../../icons/GoogleTasksIcon';
import { LandingCopy } from '../i18n';
import { StoryDef } from '../data';
import { Reveal, Stagger, StaggerItem } from '../motion/Reveal';
import { TiltCard } from '../motion/TiltCard';

interface StoryFeatureProps {
    c: LandingCopy;
    story: StoryDef;
    index: number;
    total: number;
}

export const StoryFeature: React.FC<StoryFeatureProps> = ({ c, story, index, total }) => {
    const ref = useRef<HTMLElement>(null);
    const s = c.stories[story.key];
    const reverse = index % 2 === 1;

    const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
    const mainY = useTransform(scrollYProgress, [0, 1], [40, -40]);
    const subY = useTransform(scrollYProgress, [0, 1], [90, -90]);

    return (
        <section ref={ref} id={story.id} className="py-20 sm:py-28">
            <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 md:grid-cols-12 md:gap-10">
                <div className={`md:col-span-5 ${reverse ? 'md:order-2 md:col-start-8' : ''}`}>
                    <Reveal>
                        <p className="l-eyebrow mb-4 flex items-center gap-3">
                            <span className="tabular-nums text-zinc-400">
                                {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
                            </span>
                            <span className="h-px w-6 bg-zinc-300" />
                            {s.eyebrow}
                        </p>
                        <h2 className="l-h2 text-zinc-950">{s.title}</h2>
                        <p className="mt-5 text-[17px] leading-7 text-zinc-600">{s.desc}</p>
                    </Reveal>
                    <Stagger as="ul" className="mt-8 space-y-1">
                        {s.points.map((point, i) => {
                            const Icon = story.icons[i];
                            return (
                                <StaggerItem
                                    as="li"
                                    key={point}
                                    className="group flex items-start gap-3.5 rounded-xl px-2 py-2.5 transition-colors duration-300 hover:bg-white"
                                >
                                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-zinc-900/[0.07] bg-white text-zinc-500 transition-colors duration-300 group-hover:border-sky-200 group-hover:text-[var(--l-accent)]">
                                        {Icon && <Icon size={15} />}
                                    </span>
                                    <span className="text-[15px] leading-6 text-zinc-700">{point}</span>
                                </StaggerItem>
                            );
                        })}
                    </Stagger>
                </div>

                <div className={`relative md:col-span-7 ${reverse ? 'md:order-1 md:col-start-1 md:row-start-1' : ''}`}>
                    <motion.div style={{ y: mainY }}>
                        <TiltCard
                            max={3}
                            className="group relative overflow-hidden rounded-[22px] border border-zinc-900/[0.08] bg-white p-1.5 shadow-[0_30px_80px_-30px_rgba(9,9,11,0.25)]"
                        >
                            <img
                                src={story.main.src}
                                alt={s.eyebrow}
                                width={story.main.w}
                                height={story.main.h}
                                loading="lazy"
                                className="h-auto w-full rounded-[16px] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.015]"
                            />
                            <div className="l-spotlight pointer-events-none absolute inset-0" />
                        </TiltCard>
                    </motion.div>

                    {story.sub && (
                        <motion.div
                            style={{ y: subY }}
                            className={`absolute -bottom-8 w-[42%] ${reverse ? '-left-3 sm:-left-6' : '-right-3 sm:-right-6'}`}
                        >
                            <img
                                src={story.sub.src}
                                alt=""
                                width={story.sub.w}
                                height={story.sub.h}
                                loading="lazy"
                                className="h-auto w-full rounded-2xl border border-zinc-900/[0.08] bg-white p-1 shadow-[0_24px_60px_-20px_rgba(9,9,11,0.35)]"
                            />
                        </motion.div>
                    )}

                    {story.key === 'google' && (
                        <motion.div
                            style={{ y: subY }}
                            className="absolute -bottom-6 right-4 flex items-center gap-3 rounded-2xl border border-zinc-900/[0.08] bg-white/90 px-4 py-3 shadow-[0_20px_50px_-20px_rgba(9,9,11,0.3)] backdrop-blur sm:-right-4"
                        >
                            <div className="flex items-center gap-1.5">
                                <GoogleTasksIcon size={20} />
                                <GoogleCalendarIcon size={20} />
                            </div>
                            <span className="flex items-center gap-2 text-[13px] font-medium text-zinc-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                {c.syncStatus}
                            </span>
                        </motion.div>
                    )}
                </div>
            </div>
        </section>
    );
};
