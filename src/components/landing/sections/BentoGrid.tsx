import React from 'react';
import { ArrowRight } from 'lucide-react';
import { LandingCopy } from '../i18n';
import { bento } from '../data';
import { Reveal, Stagger, StaggerItem } from '../motion/Reveal';
import { TiltCard } from '../motion/TiltCard';

interface BentoGridProps {
    c: LandingCopy;
    onLogin: () => void;
}

export const BentoGrid: React.FC<BentoGridProps> = ({ c, onLogin }) => (
    <section id="features" className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="mx-auto mb-14 max-w-2xl text-center">
                <p className="l-eyebrow mb-4">{c.bentoEyebrow}</p>
                <h2 className="l-h2 text-zinc-950">{c.bentoTitle}</h2>
                <p className="mt-5 text-[17px] leading-7 text-zinc-600">{c.bentoDesc}</p>
            </Reveal>

            <Stagger className="grid grid-cols-1 gap-4 md:grid-cols-6">
                {bento.map((item) => {
                    const copy = c.bento[item.key];
                    const dark = item.dark;
                    return (
                        <StaggerItem key={item.key} id={item.id} className={item.span}>
                            <TiltCard
                                max={4}
                                className={`group relative flex h-full flex-col overflow-hidden rounded-[22px] border p-6 transition-shadow duration-500 hover:shadow-[0_30px_60px_-30px_rgba(9,9,11,0.3)] ${
                                    dark ? 'border-white/10 bg-zinc-950' : 'border-zinc-900/[0.08] bg-white'
                                }`}
                            >
                                <div className="l-spotlight pointer-events-none absolute inset-0" />
                                <div className="relative flex items-start justify-between gap-4">
                                    <div>
                                        <div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-xl border ${dark ? 'border-white/10 text-zinc-300' : 'border-zinc-900/[0.07] text-zinc-600'}`}>
                                            <item.icon size={17} />
                                        </div>
                                        <h3 className={`l-h3 ${dark ? 'text-white' : 'text-zinc-950'}`}>{copy.title}</h3>
                                        <p className={`mt-1.5 max-w-sm text-[15px] leading-6 ${dark ? 'text-zinc-400' : 'text-zinc-600'}`}>{copy.desc}</p>
                                    </div>
                                </div>

                                {item.key === 'focus' && (
                                    <a href="#/focus" className="relative mt-4 inline-flex items-center gap-1.5 self-start text-sm font-medium text-[var(--l-accent)]">
                                        {c.focusCta}
                                        <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" />
                                    </a>
                                )}
                                {item.key === 'storage' && (
                                    <button type="button" onClick={onLogin} className="relative mt-4 inline-flex items-center gap-1.5 self-start text-sm font-medium text-[var(--l-accent)]">
                                        {c.storageCta}
                                        <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" />
                                    </button>
                                )}

                                <div className="relative -mx-6 -mb-6 mt-6 flex flex-1 items-end pl-6">
                                    <img
                                        src={item.img.src}
                                        alt={copy.title}
                                        width={item.img.w}
                                        height={item.img.h}
                                        loading="lazy"
                                        className={`h-auto w-full translate-y-2 rounded-tl-xl border-l border-t object-cover object-left-top transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0 group-hover:scale-[1.02] ${
                                            dark ? 'border-white/10' : 'border-zinc-900/[0.08]'
                                        } ${item.span === 'md:col-span-4' ? 'max-h-[340px]' : 'aspect-[16/10]'}`}
                                    />
                                </div>
                            </TiltCard>
                        </StaggerItem>
                    );
                })}
            </Stagger>
        </div>
    </section>
);
