const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'LandingPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Helper to replace content safely regardless of Windows CRLF vs Unix LF
function replaceContent(target, replacement) {
    // Standardize line endings to LF for easier replacement
    const targetNormalized = target.replace(/\r\n/g, '\n');
    const replacementNormalized = replacement.replace(/\r\n/g, '\n');
    const contentNormalized = content.replace(/\r\n/g, '\n');

    if (!contentNormalized.includes(targetNormalized)) {
        console.error('Target not found in file:');
        console.error(target.substring(0, 100) + '...');
        process.exit(1);
    }

    const newContentNormalized = contentNormalized.replace(targetNormalized, replacementNormalized);
    
    // Put back original Windows CRLF if that's what was in the file
    if (content.includes('\r\n')) {
        content = newContentNormalized.replace(/\n/g, '\r\n');
    } else {
        content = newContentNormalized;
    }
}

// 1. Replace Header
const targetHeader = `            {/* Header */}
            <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md shadow-indigo-100 border border-gray-100 shrink-0">
                            <img src="/pwa-192x192.png" alt="SmartLife" className="w-full h-full object-cover" />
                        </div>
                        <span className="font-bold text-lg sm:text-xl tracking-tight text-gray-800">SmartLife</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-3">
                        {/* Language Toggle */}
                        <button
                            onClick={toggleLang}
                            className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 text-gray-600 hover:bg-gray-100 rounded-full transition-all font-medium text-xs sm:text-sm"
                            title="Switch Language"
                        >
                            <Globe size={16} className="sm:w-[18px] sm:h-[18px]" />
                            <span className="uppercase">{lang}</span>
                        </button>

                        <button
                            onClick={() => setIsInstallModalOpen(true)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2 bg-indigo-50 text-indigo-600 rounded-full font-bold hover:bg-indigo-100 transition-all text-xs sm:text-sm"
                            title={t.install}
                        >
                            <Download size={16} className="sm:w-[18px] sm:h-[18px]" />
                            <span className="hidden sm:inline">{t.install}</span>
                        </button>
                        <button
                            onClick={onLogin}
                            className="px-3.5 py-2 sm:px-5 sm:py-2.5 bg-gray-900 text-white rounded-full font-medium hover:bg-gray-800 transition-all text-xs sm:text-sm"
                        >
                            {t.login}
                        </button>
                    </div>
                </div>
            </header>`;

const replacementHeader = `            {/* Header */}
            <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-gray-100/80 transition-all duration-300">
                <div className="w-full px-4 xs:px-6 sm:px-8 lg:px-12 h-16 sm:h-[72px] flex items-center justify-between">
                    <div className="flex items-center gap-2.5 sm:gap-3 hover:opacity-90 transition-opacity cursor-pointer animate-fade-in" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-md shadow-indigo-100 border border-gray-100 shrink-0">
                            <img src="/pwa-192x192.png" alt="SmartLife" className="w-full h-full object-cover" />
                        </div>
                        <span className="font-extrabold text-base xs:text-lg sm:text-xl tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">SmartLife</span>
                    </div>
                    <div className="flex items-center gap-2 xs:gap-3 sm:gap-4">
                        {/* Language Toggle */}
                        <button
                            onClick={toggleLang}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 xs:px-3 xs:py-2 text-gray-600 hover:bg-gray-100/80 rounded-full transition-all font-semibold text-xs sm:text-sm"
                            title="Switch Language"
                        >
                            <Globe size={16} className="sm:w-[18px] sm:h-[18px] text-gray-500" />
                            <span className="uppercase tracking-wider font-semibold">{lang}</span>
                        </button>

                        <button
                            onClick={() => setIsInstallModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 xs:px-4 xs:py-2 bg-indigo-50 text-indigo-600 rounded-full font-bold hover:bg-indigo-100 transition-all text-xs sm:text-sm border border-indigo-100/50 shadow-sm"
                            title={t.install}
                        >
                            <Download size={16} className="sm:w-[18px] sm:h-[18px]" />
                            <span className="hidden sm:inline">{t.install}</span>
                        </button>
                        <button
                            onClick={onLogin}
                            className="px-4 py-2 xs:px-5 xs:py-2.5 bg-gray-900 text-white rounded-full font-bold hover:bg-gray-800 transition-all text-xs sm:text-sm shadow-md shadow-gray-200/50"
                        >
                            {t.login}
                        </button>
                    </div>
                </div>
            </header>`;

replaceContent(targetHeader, replacementHeader);

// 2. Replace Hero Section
const targetHero = `            {/* Hero Section */}
            <section className="pt-28 pb-12 sm:pt-32 sm:pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden min-h-[80vh] sm:min-h-[85vh] flex flex-col justify-center">`;

const replacementHero = `            {/* Hero Section */}
            <section className="pt-[76px] pb-6 sm:pt-[92px] sm:pb-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden flex flex-col justify-center">`;

replaceContent(targetHero, replacementHero);

// 3. Replace Hero Title
const targetTitle = `                    <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white border border-indigo-100 shadow-sm text-indigo-600 text-xs font-bold uppercase tracking-wider mb-6 sm:mb-8 animate-fade-in-up hover:scale-105 transition-transform cursor-default">
                        <Zap size={14} className="text-yellow-500" /> {t.heroTag}
                    </div>
                    <h1 className="text-2xl xs:text-4xl sm:text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight mb-6 leading-[1.15] md:leading-[1.1] animate-fade-in-up delay-100" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>`;

const replacementTitle = `                    <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white border border-indigo-100 shadow-sm text-indigo-600 text-xs font-bold uppercase tracking-wider mb-3 sm:mb-4 animate-fade-in-up hover:scale-105 transition-transform cursor-default">
                        <Zap size={14} className="text-yellow-500" /> {t.heroTag}
                    </div>
                    <h1 className="text-2xl xs:text-4xl sm:text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight mb-3 sm:mb-4 leading-[1.15] md:leading-[1.1] animate-fade-in-up delay-100" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>`;

replaceContent(targetTitle, replacementTitle);

// 4. Replace scrolling ticker
const targetTicker = `                    {/* Infinite Scrolling Ticker of Features */}
                    <div className="w-full max-w-full py-2 mb-6 sm:mb-8 select-none relative overflow-hidden animate-fade-in-up delay-150">
                        <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-20 bg-gradient-to-r from-white via-white/80 to-transparent z-10 pointer-events-none" />
                        <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-20 bg-gradient-to-l from-white via-white/80 to-transparent z-10 pointer-events-none" />

                        <div className="animate-marquee flex items-center gap-4 py-2">`;

const replacementTicker = `                    {/* Infinite Scrolling Ticker of Features */}
                    <div className="w-full max-w-full py-1 mb-3 sm:mb-4 select-none relative overflow-hidden animate-fade-in-up delay-150">
                        <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-20 bg-gradient-to-r from-white via-white/80 to-transparent z-10 pointer-events-none" />
                        <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-20 bg-gradient-to-l from-white via-white/80 to-transparent z-10 pointer-events-none" />

                        <div className="animate-marquee flex items-center gap-3 py-1">`;

replaceContent(targetTicker, replacementTicker);

// 5. Replace marquee item styling
const targetMarqueeItem = `                                    className={\`flex items-center gap-2.5 px-6 py-3 bg-gradient-to-r \${item.color} border border-white/45 rounded-full font-bold text-sm shadow-[0_2px_10px_rgba(0,0,0,0.02)] whitespace-nowrap hover:scale-105 hover:-translate-y-0.5 hover:shadow-md active:scale-95 transition-all duration-300 cursor-pointer\`}`;

const replacementMarqueeItem = `                                    className={\`flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r \${item.color} border border-white/45 rounded-full font-bold text-sm shadow-[0_2px_10px_rgba(0,0,0,0.02)] whitespace-nowrap hover:scale-105 hover:-translate-y-0.5 hover:shadow-md active:scale-95 transition-all duration-300 cursor-pointer\`}`;

replaceContent(targetMarqueeItem, replacementMarqueeItem);

// 6. Replace description margin
const targetDescMargin = `                    <div className="text-gray-600 mb-8 sm:mb-10 max-w-full sm:max-w-3xl mx-auto leading-relaxed animate-fade-in-up delay-200 px-1">`;

const replacementDescMargin = `                    <div className="text-gray-600 mb-5 sm:mb-6 max-w-full sm:max-w-3xl mx-auto leading-relaxed animate-fade-in-up delay-200 px-1">`;

replaceContent(targetDescMargin, replacementDescMargin);

// 7. Replace CTA Buttons
const targetButtons = `                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-300 w-full max-w-md sm:max-w-none mx-auto">
                        <div className="relative group w-full sm:w-auto">
                            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-60 transition duration-500"></div>
                            <button
                                onClick={onLogin}
                                className="relative w-full sm:w-auto px-6 py-3.5 sm:px-8 sm:py-4 bg-gray-900 text-white rounded-full font-bold text-base sm:text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-2"
                            >
                                {t.startNow} <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                        <a href="#features" className="w-full sm:w-auto px-6 py-3.5 sm:px-8 sm:py-4 bg-white text-gray-700 border border-gray-200 shadow-sm rounded-full font-bold text-base sm:text-lg hover:bg-gray-50 hover:shadow-md transition-all flex items-center justify-center group">
                            {t.learnMore}
                        </a>
                    </div>`;

const replacementButtons = `                    <div className="flex flex-col xs:flex-row items-center justify-center gap-3 sm:gap-4 animate-fade-in-up delay-300 w-full max-w-md sm:max-w-none mx-auto pb-2">
                        <div className="relative group w-full xs:w-auto">
                            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-60 transition duration-500"></div>
                            <button
                                onClick={onLogin}
                                className="relative w-full xs:w-auto px-5 py-3 xs:px-8 xs:py-4 bg-gray-900 text-white rounded-full font-bold text-sm xs:text-base sm:text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-2"
                            >
                                {t.startNow} <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                        <a href="#features" className="w-full xs:w-auto px-5 py-3 xs:px-8 xs:py-4 bg-white text-gray-700 border border-gray-200 shadow-sm rounded-full font-bold text-sm xs:text-base sm:text-lg hover:bg-gray-50 hover:shadow-md transition-all flex items-center justify-center group">
                            {t.learnMore}
                        </a>
                    </div>`;

replaceContent(targetButtons, replacementButtons);

fs.writeFileSync(filePath, content, 'utf8');
console.log('LandingPage.tsx updated successfully!');
