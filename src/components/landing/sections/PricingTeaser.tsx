import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { LandingCopy } from '../i18n';
import { Reveal } from '../motion/Reveal';
import { MagneticButton } from '../motion/MagneticButton';
import { SUBSCRIPTION_PLANS } from '../../../services/subscriptionService';

interface PricingTeaserProps {
    c: LandingCopy;
    onLogin: () => void;
    onNavigate: (page: string) => void;
}

// Cheapest per-month price across the real plans, so this teaser never drifts from the pricing page.
const fromPrice = Math.min(...SUBSCRIPTION_PLANS.map((p) => p.monthly_price));
const priceLabel = `${new Intl.NumberFormat('vi-VN').format(fromPrice)}đ`;

export const PricingTeaser: React.FC<PricingTeaserProps> = ({ c, onLogin, onNavigate }) => {
    const k = c.pricingTeaser;
    return (
        <section id="pricing-teaser" className="bg-[var(--l-day)] py-24 sm:py-32">
            <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
                <Reveal className="max-w-2xl">
                    <p className="l-mono mb-5 text-zinc-500">{k.eyebrow}</p>
                    <h2 className="l-h2 text-zinc-950">{k.title}</h2>
                </Reveal>

                <div className="mt-14 grid gap-4 lg:grid-cols-12">
                    <Reveal className="flex flex-col rounded-[28px] border border-zinc-900/10 p-7 sm:p-9 lg:col-span-5">
                        <p className="text-[15px] font-medium text-zinc-950">{k.freeName}</p>
                        <p className="l-clock mt-4 text-[3.5rem] leading-none text-zinc-950">0đ</p>
                        <p className="mt-3 text-[15px] text-zinc-600">{k.freeDesc}</p>
                        <ul className="mt-8 flex-1 space-y-3">
                            {k.freeItems.map((item) => (
                                <li key={item} className="flex items-start gap-3 text-[15px] text-zinc-700">
                                    <Check size={17} className="mt-0.5 shrink-0 text-zinc-400" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                        <button
                            type="button"
                            onClick={onLogin}
                            className="mt-10 h-12 rounded-full border border-zinc-900/15 px-6 text-[15px] font-medium text-zinc-950 transition-colors hover:border-zinc-900/40"
                        >
                            {k.freeCta}
                        </button>
                    </Reveal>

                    <Reveal delay={0.08} className="flex flex-col rounded-[28px] bg-[var(--l-night)] p-7 text-white sm:p-9 lg:col-span-7">
                        <div className="flex items-center justify-between gap-4">
                            <p className="text-[15px] font-medium">{k.proName}</p>
                            <span className="l-mono rounded-full border border-[var(--l-warm)]/40 px-3 py-1 text-[var(--l-warm)]">{k.trial}</span>
                        </div>
                        <p className="mt-4 flex flex-wrap items-baseline gap-x-3">
                            <span className="text-[15px] text-zinc-400">{k.proFrom}</span>
                            <span className="l-clock text-[3.5rem] leading-none sm:text-[4.5rem]">{priceLabel}</span>
                            <span className="text-[15px] text-zinc-400">{k.perMonth}</span>
                        </p>
                        <ul className="mt-8 grid flex-1 gap-3 sm:grid-cols-2">
                            {k.proItems.map((item) => (
                                <li key={item} className="flex items-start gap-3 text-[15px] text-zinc-200">
                                    <Check size={17} className="mt-0.5 shrink-0 text-[var(--l-warm)]" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                        <MagneticButton
                            onClick={() => onNavigate('pricing')}
                            className="group mt-10 flex h-12 items-center justify-center gap-2.5 self-start rounded-full bg-white px-7 text-[15px] font-medium text-zinc-950 transition-colors hover:bg-zinc-100"
                        >
                            {k.cta}
                            <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" />
                        </MagneticButton>
                    </Reveal>
                </div>
            </div>
        </section>
    );
};
