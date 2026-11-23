import React, { useId, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { LandingCopy } from '../i18n';
import { EASE, Reveal } from '../motion/Reveal';

interface FAQProps {
    c: LandingCopy;
}

// Heading on the left, an accordion on the right. One answer open at a time.
export const FAQ: React.FC<FAQProps> = ({ c }) => {
    const [open, setOpen] = useState<number | null>(0);
    const base = useId();

    return (
        <section id="faq" className="border-t border-zinc-900/[0.06] bg-[var(--l-day)] py-24 sm:py-32">
            <div className="mx-auto grid max-w-[1240px] gap-12 px-4 sm:px-6 lg:grid-cols-12">
                <Reveal className="lg:col-span-4">
                    <div className="lg:sticky lg:top-28">
                        <p className="l-mono mb-5 text-zinc-500">{c.faq.eyebrow}</p>
                        <h2 className="l-h2 text-zinc-950">{c.faq.title}</h2>
                    </div>
                </Reveal>

                <ul className="border-t border-zinc-900/10 lg:col-span-8">
                    {c.faq.items.map((item, i) => {
                        const isOpen = open === i;
                        const btnId = `${base}-q${i}`;
                        const panelId = `${base}-a${i}`;
                        return (
                            <li key={item.q} className="border-b border-zinc-900/10">
                                <h3>
                                    <button
                                        id={btnId}
                                        type="button"
                                        aria-expanded={isOpen}
                                        aria-controls={panelId}
                                        onClick={() => setOpen(isOpen ? null : i)}
                                        className="flex w-full items-center justify-between gap-6 py-6 text-left text-[17px] font-medium text-zinc-950 transition-colors hover:text-[var(--l-accent)] sm:text-[19px]"
                                    >
                                        {item.q}
                                        <Plus
                                            size={20}
                                            className={`shrink-0 text-zinc-400 transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}
                                        />
                                    </button>
                                </h3>
                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <motion.div
                                            id={panelId}
                                            role="region"
                                            aria-labelledby={btnId}
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.4, ease: EASE }}
                                            className="overflow-hidden"
                                        >
                                            <p className="max-w-2xl pb-7 text-[16px] leading-7 text-zinc-600">{item.a}</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </section>
    );
};
