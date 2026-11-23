import React from 'react';
import { Lang } from '../../i18n/i18n';
import { SiteShell } from './SiteShell';
import { Hero } from './sections/Hero';
import { ProblemSolution } from './sections/ProblemSolution';
import { SyncStrip } from './sections/SyncStrip';
import { DayTimeline } from './sections/DayTimeline';
import { CompanionShowcase } from './sections/CompanionShowcase';
import { SyncEngineStage } from './sections/SyncEngineStage';
import { EcosystemRail } from './sections/EcosystemRail';
import { BentoGrid } from './sections/BentoGrid';
import { HowItWorks } from './sections/HowItWorks';
import { PlatformsPrivacy } from './sections/PlatformsPrivacy';
import { PricingTeaser } from './sections/PricingTeaser';
import { FAQ } from './sections/FAQ';
import { FinalCTA } from './sections/FinalCTA';

interface LandingPageProps {
    onLogin: () => void;
    onNavigate: (page: string) => void;
    lang: Lang;
    setLang: (lang: Lang) => void;
}

// A student's day, morning to night: problem → the day → AI companion → Google sync → modules → how/where/price → FAQ.
const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onNavigate, lang, setLang }) => (
    <SiteShell page="home" lang={lang} setLang={setLang} onLogin={onLogin} onNavigate={onNavigate}>
        {({ c, scrollTo, openInstall }) => (
            <>
                <Hero c={c} onLogin={onLogin} scrollTo={scrollTo} />
                <ProblemSolution c={c} />
                <SyncStrip c={c} scrollTo={scrollTo} />
                <DayTimeline c={c} />
                <CompanionShowcase c={c} onLogin={onLogin} />
                <SyncEngineStage c={c} />
                <EcosystemRail c={c} scrollTo={scrollTo} />
                <BentoGrid c={c} onLogin={onLogin} />
                <HowItWorks c={c} />
                <PlatformsPrivacy c={c} />
                <PricingTeaser c={c} onLogin={onLogin} onNavigate={onNavigate} />
                <FAQ c={c} />
                <FinalCTA c={c} onLogin={onLogin} onInstall={openInstall} />
            </>
        )}
    </SiteShell>
);

export default LandingPage;
