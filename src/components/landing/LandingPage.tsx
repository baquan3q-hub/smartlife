import React, { useState } from 'react';
import { MotionConfig } from 'motion/react';
import InstallGuideModal from '../InstallGuideModal';
import { Lang } from '../../i18n/i18n';
import { copy } from './i18n';
import { stories } from './data';
import { useLenis } from './hooks/useLenis';
import { Header } from './sections/Header';
import { Hero } from './sections/Hero';
import { SyncStrip } from './sections/SyncStrip';
import { StoryFeature } from './sections/StoryFeature';
import { BentoGrid } from './sections/BentoGrid';
import { FinalCTA } from './sections/FinalCTA';
import { Footer } from './sections/Footer';

interface LandingPageProps {
    onLogin: () => void;
    onNavigate: (page: string) => void;
    lang: Lang;
    setLang: (lang: Lang) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onNavigate, lang, setLang }) => {
    const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
    const scrollTo = useLenis();
    const c = copy[lang];

    const toggleLang = () => setLang(lang === 'vi' ? 'en' : lang === 'en' ? 'ko' : 'vi');
    const openInstall = () => setIsInstallModalOpen(true);

    return (
        <MotionConfig reducedMotion="user">
            <div className="landing min-h-screen overflow-x-clip">
                <InstallGuideModal isOpen={isInstallModalOpen} onClose={() => setIsInstallModalOpen(false)} />
                <Header
                    c={c}
                    lang={lang}
                    onToggleLang={toggleLang}
                    onInstall={openInstall}
                    onLogin={onLogin}
                    onNavigate={onNavigate}
                    scrollTo={scrollTo}
                />
                <main>
                    <Hero c={c} onLogin={onLogin} scrollTo={scrollTo} />
                    <SyncStrip c={c} scrollTo={scrollTo} />
                    {stories.map((story, i) => (
                        <StoryFeature key={story.key} c={c} story={story} index={i} total={stories.length} />
                    ))}
                    <BentoGrid c={c} onLogin={onLogin} />
                    <FinalCTA c={c} onLogin={onLogin} onInstall={openInstall} />
                </main>
                <Footer c={c} scrollTo={scrollTo} />
            </div>
        </MotionConfig>
    );
};

export default LandingPage;
