import React from 'react';
import { ArrowRight, Download } from 'lucide-react';
import { LandingCopy } from '../i18n';
import { Reveal } from '../motion/Reveal';
import { MagneticButton } from '../motion/MagneticButton';

interface DarkCTAProps {
    title: string;
    desc: string;
    children: React.ReactNode;
    // Small mono mark above the title (the landing page uses the night hour).
    mark?: string;
}

// The one night-coloured block on each page: headline on the left, buttons on the right.
export const DarkCTA: React.FC<DarkCTAProps> = ({ title, desc, children, mark }) => (
    <section className="px-4 py-20 sm:px-6 sm:py-28">
        <Reveal className="relative mx-auto grid max-w-6xl gap-10 overflow-hidden rounded-[28px] bg-[var(--l-night)] px-6 py-14 sm:px-12 sm:py-20 md:grid-cols-12 md:items-end">
            <div className="md:col-span-8">
                <div className="mb-8 flex items-center gap-3">
                    <img src="/pwa-192x192.png" alt="" className="h-11 w-11 rounded-xl border border-white/10" />
                    {mark && <span className="l-mono text-[var(--l-warm)]">{mark}</span>}
                </div>
                <h2 className="l-h2 max-w-2xl text-white">{title}</h2>
                <p className="mt-5 max-w-md text-[17px] leading-7 text-zinc-400">{desc}</p>
            </div>
            <div className="flex flex-col gap-3 xs:flex-row md:col-span-4 md:flex-col md:items-stretch">{children}</div>
        </Reveal>
    </section>
);

export const ctaPrimary =
    'group flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-[15px] font-medium text-zinc-950 transition-colors hover:bg-zinc-100 xs:w-auto md:w-full';
export const ctaSecondary =
    'flex h-12 w-full items-center justify-center gap-2 rounded-full border border-white/15 px-6 text-[15px] font-medium text-white transition-colors hover:bg-white/[0.06] xs:w-auto md:w-full';

// Primary white button for DarkCTA with the sliding arrow.
export const CTAButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
    <MagneticButton onClick={onClick} className={ctaPrimary}>
        {children}
        <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" />
    </MagneticButton>
);

interface FinalCTAProps {
    c: LandingCopy;
    onLogin: () => void;
    onInstall: () => void;
}

export const FinalCTA: React.FC<FinalCTAProps> = ({ c, onLogin, onInstall }) => (
    <DarkCTA title={c.ctaTitle} desc={c.ctaDesc} mark="22:30">
        <CTAButton onClick={onLogin}>{c.startNow}</CTAButton>
        <button type="button" onClick={onInstall} className={ctaSecondary}>
            <Download size={17} />
            {c.install}
        </button>
    </DarkCTA>
);
