import React, { useState } from 'react';
import { motion, useMotionValueEvent, useScroll } from 'motion/react';
import { Download, Globe } from 'lucide-react';
import { Lang } from '../../../i18n/i18n';
import { LandingCopy } from '../i18n';
import { useScrollSpy } from '../hooks/useScrollSpy';
import type { Page } from '../SiteShell';

interface HeaderProps {
    c: LandingCopy;
    page: Page;
    lang: Lang;
    onToggleLang: () => void;
    onInstall: () => void;
    onLogin: () => void;
    onNavigate: (page: string) => void;
    scrollTo: (target: string | number) => void;
    // Scrolls on the landing page, or opens it and scrolls there from a subpage.
    goTo: (target: string | number) => void;
}

const SPY_IDS = ['top', 'dashboard-preview', 'google-ecosystem'];

export const Header: React.FC<HeaderProps> = ({ c, page, lang, onToggleLang, onInstall, onLogin, onNavigate, scrollTo, goTo }) => {
    const { scrollY } = useScroll();
    const [scrolled, setScrolled] = useState(false);
    const spy = useScrollSpy(SPY_IDS);
    const active = page === 'home' ? spy : page;

    useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 24));

    const items: { label: string; spy?: string; onClick: () => void }[] = [
        { label: c.nav.home, spy: 'top', onClick: () => goTo(0) },
        { label: c.nav.overview, spy: 'dashboard-preview', onClick: () => goTo('dashboard-preview') },
        { label: c.nav.google, spy: 'google-ecosystem', onClick: () => goTo('google-ecosystem') },
        { label: c.nav.features, spy: 'features', onClick: () => (page === 'features' ? scrollTo(0) : onNavigate('features')) },
        { label: c.nav.pricing, spy: 'pricing', onClick: () => (page === 'pricing' ? scrollTo(0) : onNavigate('pricing')) },
        { label: c.nav.contact, spy: 'contact', onClick: () => (page === 'contact' ? scrollTo(0) : onNavigate('contact')) }
    ];

    return (
        <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 sm:px-4">
            <div
                className={`mt-0 flex w-full items-center justify-between gap-3 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    scrolled
                        ? 'mt-3 max-w-5xl rounded-full border border-zinc-900/[0.07] bg-white/75 px-3 py-2 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] backdrop-blur-xl'
                        : 'max-w-6xl border border-transparent px-2 py-4 sm:px-4'
                }`}
            >
                <button
                    type="button"
                    onClick={() => goTo(0)}
                    className="flex shrink-0 items-center gap-2.5 rounded-full pr-2"
                    aria-label="SmartLife"
                >
                    <img src="/pwa-192x192.png" alt="" className="h-8 w-8 rounded-[10px] border border-zinc-900/5" />
                    <span className="text-[15px] font-semibold tracking-tight text-zinc-950">SmartLife</span>
                </button>

                <nav className="hidden items-center lg:flex" aria-label="Main">
                    {items.map((item) => {
                        const isActive = item.spy === active;
                        return (
                            <button
                                key={item.label}
                                type="button"
                                onClick={item.onClick}
                                className={`relative whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-medium transition-colors duration-200 xl:px-3.5 ${
                                    isActive ? 'text-zinc-950' : 'text-zinc-500 hover:text-zinc-950'
                                }`}
                            >
                                {isActive && (
                                    <motion.span
                                        layoutId="nav-pill"
                                        className="absolute inset-0 rounded-full bg-zinc-900/[0.06]"
                                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                                    />
                                )}
                                <span className="relative">{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    <button
                        type="button"
                        onClick={onToggleLang}
                        className="flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium uppercase tracking-wider text-zinc-600 transition-colors hover:bg-zinc-900/5 hover:text-zinc-950"
                        title={c.langName}
                    >
                        <Globe size={16} />
                        {lang}
                    </button>
                    <button
                        type="button"
                        onClick={onInstall}
                        className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-900/5 hover:text-zinc-950"
                        title={c.install}
                    >
                        <Download size={16} />
                        <span className="hidden sm:inline">{c.install}</span>
                    </button>
                    <button
                        type="button"
                        onClick={onLogin}
                        className="h-10 rounded-full bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                    >
                        {c.login}
                    </button>
                </div>
            </div>
        </header>
    );
};
