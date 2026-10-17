import React, { useCallback, useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import InstallGuideModal from '../InstallGuideModal';
import { Lang } from '../../i18n/i18n';
import { copy, LandingCopy } from './i18n';
import { HEADER_OFFSET, useLenis } from './hooks/useLenis';
import { Header } from './sections/Header';
import { Footer } from './sections/Footer';

export type Page = 'home' | 'features' | 'pricing' | 'contact';

// A landing-page target to scroll to after navigating home from a subpage.
const PENDING_KEY = 'landing:scrollTo';

export interface ShellApi {
    c: LandingCopy;
    scrollTo: (target: string | number) => void;
    openInstall: () => void;
}

interface SiteShellProps {
    page: Page;
    lang: Lang;
    setLang: (lang: Lang) => void;
    onLogin: () => void;
    onNavigate: (page: string) => void;
    children: (api: ShellApi) => React.ReactNode;
}

// Header, footer, smooth scroll and install modal shared by the landing page and its subpages.
export const SiteShell: React.FC<SiteShellProps> = ({ page, lang, setLang, onLogin, onNavigate, children }) => {
    const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
    const scrollTo = useLenis();
    const c = copy[lang];

    useEffect(() => {
        if (page !== 'home') {
            window.scrollTo(0, 0);
            return;
        }
        let target: string | null = null;
        try {
            target = sessionStorage.getItem(PENDING_KEY);
        } catch {
            return;
        }
        if (!target) return;
        // Jump instantly: the page just changed, so a long smooth scroll from the top would only add delay.
        // The key is cleared here, not above, so a StrictMode re-run of this effect still sees it.
        const id = window.setTimeout(() => {
            try {
                sessionStorage.removeItem(PENDING_KEY);
            } catch {
                // Ignore: it was readable a moment ago.
            }
            const el = target === '0' ? null : document.getElementById(target!);
            window.scrollTo(0, el ? el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET : 0);
        }, 120);
        return () => window.clearTimeout(id);
    }, [page]);

    const goTo = useCallback(
        (target: string | number) => {
            if (page === 'home') {
                scrollTo(target);
                return;
            }
            try {
                sessionStorage.setItem(PENDING_KEY, String(target));
            } catch {
                // Storage blocked: land at the top of the landing page instead.
            }
            onNavigate('home');
        },
        [page, scrollTo, onNavigate]
    );

    const toggleLang = () => setLang(lang === 'vi' ? 'en' : lang === 'en' ? 'ko' : 'vi');
    const openInstall = () => setIsInstallModalOpen(true);

    return (
        <MotionConfig reducedMotion="user">
            <div className="landing min-h-screen overflow-x-clip">
                <InstallGuideModal isOpen={isInstallModalOpen} onClose={() => setIsInstallModalOpen(false)} />
                <Header
                    c={c}
                    page={page}
                    lang={lang}
                    onToggleLang={toggleLang}
                    onInstall={openInstall}
                    onLogin={onLogin}
                    onNavigate={onNavigate}
                    scrollTo={scrollTo}
                    goTo={goTo}
                />
                <main>{children({ c, scrollTo, openInstall })}</main>
                <Footer c={c} scrollTo={scrollTo} goTo={goTo} onNavigate={onNavigate} />
            </div>
        </MotionConfig>
    );
};
