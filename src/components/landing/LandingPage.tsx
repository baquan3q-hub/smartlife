import React from 'react';
import { Lang } from '../../i18n/i18n';
import { SiteShell } from './SiteShell';
import { Hero } from './sections/Hero';
import { SyncStrip } from './sections/SyncStrip';
import { SyncEngineStage } from './sections/SyncEngineStage';
import { EcosystemRail } from './sections/EcosystemRail';
import { BentoGrid } from './sections/BentoGrid';
import { FinalCTA } from './sections/FinalCTA';

interface LandingPageProps {
    onLogin: () => void;
    onNavigate: (page: string) => void;
    lang: Lang;
    setLang: (lang: Lang) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onNavigate, lang, setLang }) => (
    <SiteShell page="home" lang={lang} setLang={setLang} onLogin={onLogin} onNavigate={onNavigate}>
        {({ c, scrollTo, openInstall }) => (
            <>
                <Hero c={c} onLogin={onLogin} scrollTo={scrollTo} />
                <SyncStrip c={c} scrollTo={scrollTo} />
                <SyncEngineStage c={c} />
                <EcosystemRail c={c} scrollTo={scrollTo} />
                <BentoGrid c={c} onLogin={onLogin} />
                <FinalCTA c={c} onLogin={onLogin} onInstall={openInstall} />
            </>
        )}
    </SiteShell>
);

export default LandingPage;
