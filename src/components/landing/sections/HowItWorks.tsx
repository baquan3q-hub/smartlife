import React, { useRef } from 'react';
import { motion, useScroll, useSpring } from 'motion/react';
import { LandingCopy } from '../i18n';
import { Reveal, Stagger, StaggerItem } from '../motion/Reveal';

interface HowItWorksProps {
    c: LandingCopy;
}

// Three numbered steps on one line; the line between them draws itself as you scroll past.
export const HowItWorks: React.FC<HowItWorksProps> = ({ c }) => {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.55'] });
    const draw = useSpring(scrollYProgress, { stiffness: 100, damping: 20, mass: 0.3 });

    return (
        <section id="how" className="bg-[var(--l-day)] py-24 sm:py-32">
            <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
                <Reveal className="grid gap-6 md:grid-cols-12 md:items-end">
                    <div className="md:col-span-7">
                        <p className="l-mono mb-5 text-zinc-500">{c.how.eyebrow}</p>
                        <h2 className="l-h2 text-zinc-950">{c.how.title}</h2>
                    </div>
                </Reveal>

                <div ref={ref} className="relative mt-16">
                    {/* Track + drawn line: horizontal on md+, vertical on phones */}
                    <span aria-hidden className="absolute left-[11px] top-3 bottom-3 w-px bg-zinc-900/10 md:left-0 md:right-0 md:top-[11px] md:bottom-auto md:h-px md:w-auto" />
                    <motion.span
                        aria-hidden
                        style={{ scaleY: draw }}
                        className="absolute left-[11px] top-3 bottom-3 w-px origin-top bg-[var(--l-accent)] md:hidden"
                    />
                    <motion.span
                        aria-hidden
                        style={{ scaleX: draw }}
                        className="absolute left-0 right-0 top-[11px] hidden h-px origin-left bg-[var(--l-accent)] md:block"
                    />

                    <Stagger as="ul" className="relative grid gap-12 md:grid-cols-3 md:gap-10">
                        {c.how.steps.map((step, i) => (
                            <StaggerItem as="li" key={step.title} className="relative pl-12 md:pl-0">
                                <span className="absolute left-0 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--l-accent)] bg-[var(--l-day)] md:relative">
                                    <span className="h-2 w-2 rounded-full bg-[var(--l-accent)]" />
                                </span>
                                <p className="l-clock mt-0 text-[3.5rem] leading-none text-zinc-950 md:mt-8 md:text-[4.5rem]">
                                    {String(i + 1).padStart(2, '0')}
                                </p>
                                <h3 className="mt-5 text-xl font-semibold tracking-tight text-zinc-950">{step.title}</h3>
                                <p className="mt-2 max-w-xs text-[15px] leading-6 text-zinc-600">{step.desc}</p>
                            </StaggerItem>
                        ))}
                    </Stagger>
                </div>
            </div>
        </section>
    );
};
