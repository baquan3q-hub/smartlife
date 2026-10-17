import React from 'react';
import { ArrowRight, Download } from 'lucide-react';
import { LandingCopy } from '../i18n';
import { Reveal } from '../motion/Reveal';
import { MagneticButton } from '../motion/MagneticButton';

interface DarkCTAProps {
    title: string;
    desc: string;
    children: React.ReactNode;
}

// The one dark block on each page: dotted glow, logo, headline and the buttons passed in.
export const DarkCTA: React.FC<DarkCTAProps> = ({ title, desc, children }) => (
    <section className="px-4 py-20 sm:px-6 sm:py-28">
        <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-zinc-950 px-6 py-20 text-center sm:py-28">
            <div
                className="pointer-events-none absolute inset-0 opacity-60"
                style={{
                    backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
                    backgroundSize: '22px 22px',
                    maskImage: 'radial-gradient(ellipse 60% 70% at 50% 100%, #000, transparent 70%)'
                }}
                aria-hidden
            />
            <div
                className="pointer-events-none absolute -bottom-40 left-1/2 h-80 w-[700px] -translate-x-1/2 rounded-full blur-3xl"
                style={{ background: 'radial-gradient(closest-side, rgba(2,132,199,0.35), transparent)' }}
                aria-hidden
            />
            <div className="relative">
                <img src="/pwa-192x192.png" alt="" className="mx-auto mb-8 h-14 w-14 rounded-2xl border border-white/10" />
                <h2 className="l-h2 mx-auto max-w-2xl text-white">{title}</h2>
                <p className="mx-auto mt-5 max-w-md text-[17px] leading-7 text-zinc-400">{desc}</p>
                <div className="mt-10 flex flex-col items-center justify-center gap-3 xs:flex-row">{children}</div>
            </div>
        </Reveal>
    </section>
);

export const ctaPrimary =
    'group flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-[15px] font-medium text-zinc-950 transition-colors hover:bg-zinc-100 xs:w-auto';
export const ctaSecondary =
    'flex h-12 w-full items-center justify-center gap-2 rounded-full border border-white/15 px-6 text-[15px] font-medium text-white transition-colors hover:bg-white/[0.06] xs:w-auto';

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
    <DarkCTA title={c.ctaTitle} desc={c.ctaDesc}>
        <CTAButton onClick={onLogin}>{c.startNow}</CTAButton>
        <button type="button" onClick={onInstall} className={ctaSecondary}>
            <Download size={17} />
            {c.install}
        </button>
    </DarkCTA>
);
