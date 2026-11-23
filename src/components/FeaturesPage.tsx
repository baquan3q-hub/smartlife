import React from 'react';
import { Brain, Wallet, CalendarDays, Music, Sparkles, Target, FileText, Briefcase, LayoutDashboard, Flame, BookOpen, GraduationCap, Headphones, LockKeyhole, ArrowRight, CheckCircle2, Globe, Download, BarChart3, Bot, ArrowRightLeft, ChevronUp, Zap, Crown, Star, Rocket } from 'lucide-react';
import { Lang } from '../i18n/i18n';

interface FeaturesPageProps {
    onLogin: () => void;
    onNavigate: (page: string) => void;
    lang: Lang;
    setLang: (lang: Lang) => void;
}

const translations = {
    vi: {
        nav: { home: 'Trang chủ', features: 'Tính năng', pricing: 'Bảng giá', contact: 'Liên hệ' },
        install: 'Cài App',
        login: 'Đăng nhập',
        heroTag: 'Tất cả tính năng',
        heroTitle: 'Mọi thứ bạn cần,',
        heroTitleHighlight: 'trong một ứng dụng.',
        heroDesc: 'SmartLife tích hợp hơn 15+ tính năng thông minh giúp sinh viên quản lý cuộc sống hiệu quả — từ tài chính, lịch trình đến AI cá nhân hóa.',
        cat1Title: 'AI & Trợ lý Thông minh',
        cat1Desc: 'Sức mạnh trí tuệ nhân tạo cá nhân hóa theo dữ liệu và tính cách của bạn.',
        cat2Title: 'Tài chính & Quản lý',
        cat2Desc: 'Nắm bắt toàn diện dòng tiền cá nhân, ví điện tử và sổ nợ thông minh.',
        cat3Title: 'Năng suất & Thời gian',
        cat3Desc: 'Bộ công cụ hoàn chỉnh giúp tối ưu hóa thời gian học tập và làm việc.',
        cat4Title: 'Giải trí & Lưu trữ',
        cat4Desc: 'Không gian thư giãn, âm nhạc và lưu trữ an toàn cho dữ liệu cá nhân.',
        ctaTitle: 'Sẵn sàng bắt đầu?',
        ctaDesc: 'Tất cả tính năng đều miễn phí trong 7 ngày dùng thử.',
        ctaBtn: 'Đăng ký miễn phí',
        ctaPricing: 'Xem bảng giá',
        features: {
            ai: { title: 'AI Your Own', desc: 'Trợ lý AI đa năng phân tích dữ liệu cá nhân, đọc hiểu file/ảnh/audio, cá nhân hóa MBTI & DISC.' },
            career: { title: 'Cố vấn Sự nghiệp AI', desc: 'Phân tích GPA, tính cách MBTI/DISC để định hướng nghề nghiệp phù hợp.' },
            cv: { title: 'CV Builder tự động', desc: 'Tự động trích xuất thông tin từ GPA & Goals, xuất PDF chuyên nghiệp.' },
            finance: { title: 'Quản lý Tài chính', desc: 'Theo dõi thu chi, quản lý ví tài khoản thực tế & quỹ chi tiêu mục đích.' },
            cashflow: { title: 'Cashflow & Sổ nợ', desc: 'Dòng tiền thông minh tự động khấu trừ, ghi chép vay mượn liên kết thực tế.' },
            wallets: { title: 'Ví & Chuyển tiền', desc: 'Quản lý nhiều ví, chuyển tiền nội bộ linh hoạt giữa các tài khoản.' },
            schedule: { title: 'Thời khóa biểu', desc: 'Lịch trình tuần/ngày trực quan, tích hợp thời khóa biểu đại học.' },
            kanban: { title: 'Bảng Kanban & Todo', desc: 'Quản lý dự án & công việc ưu tiên theo phương pháp Kanban chuyên nghiệp.' },
            pomodoro: { title: 'Pomodoro Timer', desc: 'Bộ đếm giờ tập trung Pomodoro giúp tăng năng suất học tập.' },
            habits: { title: 'Thói quen & Streak', desc: 'Xây dựng thói quen tích cực với hệ thống streak và sao thưởng.' },
            goals: { title: 'Mục tiêu & Countdown', desc: 'Theo dõi tiến độ mục tiêu dài hạn, đếm ngược sự kiện quan trọng.' },
            gpa: { title: 'GPA Tracker', desc: 'Tính toán GPA cá nhân hóa, theo dõi tiến độ học tập từng kỳ.' },
            journal: { title: 'Nhật ký cá nhân', desc: 'Ghi chép an toàn, mood tracker và lòng biết ơn hàng ngày.' },
            spotify: { title: 'My Spotify', desc: 'Nghe nhạc mọi lúc mọi nơi không cần tài khoản Spotify Premium.' },
            focus: { title: 'Không gian tập trung', desc: 'Chế độ học Guest Mode không cần đăng nhập, phát nhạc cá nhân.' },
            storage: { title: 'My Storage', desc: 'Không gian lưu trữ bảo mật: ghi chú, tệp tin, hình ảnh & đa phương tiện.' },
            visualboard: { title: 'Visual Board', desc: 'Tổng quan toàn cảnh lịch trình, mục tiêu và bức tranh tài chính.' },
        },
        footerBuilt: 'By QuanBa',
    },
    en: {
        nav: { home: 'Home', features: 'Features', pricing: 'Pricing', contact: 'Contact' },
        install: 'Install App',
        login: 'Login',
        heroTag: 'All Features',
        heroTitle: 'Everything you need,',
        heroTitleHighlight: 'in one single app.',
        heroDesc: 'SmartLife integrates 15+ smart features to help students manage life efficiently — from finance, scheduling to personalized AI.',
        cat1Title: '🧠 AI & Smart Assistants',
        cat1Desc: 'AI intelligence personalized to your data and personality.',
        cat2Title: '💰 Finance & Management',
        cat2Desc: 'Comprehensive cash flow tracking, digital wallets, and smart debt ledger.',
        cat3Title: '📅 Productivity & Time',
        cat3Desc: 'Complete toolkit to optimize your study and work time.',
        cat4Title: '🎵 Entertainment & Storage',
        cat4Desc: 'Relaxation space, music, and secure personal data storage.',
        ctaTitle: 'Ready to get started?',
        ctaDesc: 'All features are free for 7 days trial.',
        ctaBtn: 'Sign up for free',
        ctaPricing: 'View pricing',
        features: {
            ai: { title: 'AI Your Own', desc: 'Versatile AI assistant analyzing personal data, reading files/images/audio, personalized MBTI & DISC.' },
            career: { title: 'AI Career Advisor', desc: 'Analyzes GPA, MBTI/DISC personality to recommend career paths.' },
            cv: { title: 'Auto CV Builder', desc: 'Auto-extract from GPA & Goals, export professional PDF.' },
            finance: { title: 'Finance Manager', desc: 'Track income/expenses, manage real bank accounts & purpose-based funds.' },
            cashflow: { title: 'Cashflow & Debts', desc: 'Smart auto-deducting cash flow, real-linked loan/debt tracking.' },
            wallets: { title: 'Wallets & Transfers', desc: 'Manage multiple wallets, flexible internal transfers between accounts.' },
            schedule: { title: 'Timetable', desc: 'Visual weekly/daily schedules, integrated university timetable.' },
            kanban: { title: 'Kanban & Todo', desc: 'Project management & prioritized tasks with professional Kanban methodology.' },
            pomodoro: { title: 'Pomodoro Timer', desc: 'Focus timer using Pomodoro technique to boost study productivity.' },
            habits: { title: 'Habits & Streaks', desc: 'Build positive habits with streak tracking and star rewards.' },
            goals: { title: 'Goals & Countdown', desc: 'Track long-term goal progress, countdown to important events.' },
            gpa: { title: 'GPA Tracker', desc: 'Personalized GPA calculation, track academic progress per semester.' },
            journal: { title: 'Personal Journal', desc: 'Safe journaling space, mood tracker and daily gratitude.' },
            spotify: { title: 'My Spotify', desc: 'Listen to music anywhere without Spotify Premium account.' },
            focus: { title: 'Focus Space', desc: 'Guest Mode for login-free study, play personal audio files.' },
            storage: { title: 'My Storage', desc: 'Secure storage space: notes, files, images & multimedia.' },
            visualboard: { title: 'Visual Board', desc: 'Holistic overview of schedules, goals and financial picture.' },
        },
        footerBuilt: 'Built with ❤️ and advanced AI technology.',
    },
    ko: {
        nav: { home: '홈', features: '기능', pricing: '요금제', contact: '문의' },
        install: '앱 설치',
        login: '로그인',
        heroTag: '전체 기능',
        heroTitle: '필요한 모든 것,',
        heroTitleHighlight: '하나의 앱으로.',
        heroDesc: 'SmartLife는 15개 이상의 스마트 기능을 통합하여 학생들의 효율적인 생활 관리를 돕습니다.',
        cat1Title: '🧠 AI & 스마트 어시스턴트',
        cat1Desc: '사용자 데이터와 성격에 맞춤화된 AI 지능.',
        cat2Title: '💰 재정 & 관리',
        cat2Desc: '종합적인 현금 흐름 추적, 디지털 지갑 및 스마트 채무 관리.',
        cat3Title: '📅 생산성 & 시간',
        cat3Desc: '학습과 업무 시간을 최적화하는 완벽한 도구 세트.',
        cat4Title: '🎵 엔터테인먼트 & 저장소',
        cat4Desc: '휴식 공간, 음악, 안전한 개인 데이터 저장소.',
        ctaTitle: '시작할 준비가 되셨나요?',
        ctaDesc: '모든 기능을 7일간 무료로 체험하세요.',
        ctaBtn: '무료로 시작하기',
        ctaPricing: '요금제 보기',
        features: {
            ai: { title: 'AI Your Own', desc: '개인 데이터를 분석하고 파일/이미지/오디오를 이해하는 다재다능한 AI 비서.' },
            career: { title: 'AI 커리어 상담사', desc: 'GPA, MBTI/DISC 성격을 분석하여 적합한 진로를 추천합니다.' },
            cv: { title: '자동 이력서 빌더', desc: 'GPA & Goals에서 자동 추출, 전문 PDF 이력서 작성.' },
            finance: { title: '자산 관리', desc: '수입/지출 추적, 실제 은행 계좌 및 목적별 예산 관리.' },
            cashflow: { title: '현금흐름 & 채무', desc: '스마트 자동 차감 현금 흐름, 실제 연동 대출/채무 추적.' },
            wallets: { title: '지갑 & 이체', desc: '다중 지갑 관리, 계좌 간 유연한 내부 이체.' },
            schedule: { title: '시간표', desc: '직관적인 주간/일간 일정, 대학 시간표 통합.' },
            kanban: { title: 'Kanban & Todo', desc: '전문 Kanban 방법론의 프로젝트 및 우선순위 작업 관리.' },
            pomodoro: { title: '뽀모도로 타이머', desc: '학습 생산성 향상을 위한 뽀모도로 집중 타이머.' },
            habits: { title: '습관 & 스트릭', desc: '스트릭 추적과 별점 보상으로 긍정적인 습관 형성.' },
            goals: { title: '목표 & 카운트다운', desc: '장기 목표 진행률 추적, 중요 이벤트 카운트다운.' },
            gpa: { title: 'GPA 트래커', desc: '맞춤형 GPA 계산, 학기별 학업 진행률 추적.' },
            journal: { title: '개인 일기장', desc: '안전한 기록 공간, 감정 추적기 및 일일 감사.' },
            spotify: { title: 'My Spotify', desc: '스포티파이 프리미엄 계정 없이 어디서든 음악 감상.' },
            focus: { title: '집중 공간', desc: '로그인 없는 게스트 모드, 개인 오디오 파일 재생.' },
            storage: { title: 'My Storage', desc: '안전한 저장 공간: 노트, 파일, 이미지 및 멀티미디어.' },
            visualboard: { title: '비주얼 보드', desc: '일정, 목표, 재정 상태를 한눈에 보는 통합 대시보드.' },
        },
        footerBuilt: '❤️와 스마트 AI 기술로 제작되었습니다.',
    }
};

const FeaturesPage: React.FC<FeaturesPageProps> = ({ onLogin, onNavigate, lang, setLang }) => {
    const t = translations[lang];

    const toggleLang = () => {
        setLang(lang === 'vi' ? 'en' : lang === 'en' ? 'ko' : 'vi');
    };

    const categories = [
        {
            title: t.cat1Title,
            desc: t.cat1Desc,
            color: 'from-indigo-500 to-purple-500',
            bgColor: 'bg-indigo-50/40',
            borderColor: 'border-indigo-100',
            iconColor: 'text-indigo-600',
            features: [
                { ...t.features.ai, icon: <Brain size={22} />, color: 'bg-violet-100 text-violet-600' },
                { ...t.features.career, icon: <Briefcase size={22} />, color: 'bg-rose-100 text-rose-600' },
                { ...t.features.cv, icon: <FileText size={22} />, color: 'bg-sky-100 text-sky-600' },
            ]
        },
        {
            title: t.cat2Title,
            desc: t.cat2Desc,
            color: 'from-emerald-500 to-teal-500',
            bgColor: 'bg-emerald-50/40',
            borderColor: 'border-emerald-100',
            iconColor: 'text-emerald-600',
            features: [
                { ...t.features.finance, icon: <Wallet size={22} />, color: 'bg-emerald-100 text-emerald-600' },
                { ...t.features.cashflow, icon: <BarChart3 size={22} />, color: 'bg-teal-100 text-teal-600' },
                { ...t.features.wallets, icon: <ArrowRightLeft size={22} />, color: 'bg-cyan-100 text-cyan-600' },
            ]
        },
        {
            title: t.cat3Title,
            desc: t.cat3Desc,
            color: 'from-blue-500 to-cyan-500',
            bgColor: 'bg-blue-50/40',
            borderColor: 'border-blue-100',
            iconColor: 'text-blue-600',
            features: [
                { ...t.features.schedule, icon: <CalendarDays size={22} />, color: 'bg-blue-100 text-blue-600' },
                { ...t.features.kanban, icon: <LayoutDashboard size={22} />, color: 'bg-indigo-100 text-indigo-600' },
                { ...t.features.pomodoro, icon: <Rocket size={22} />, color: 'bg-rose-100 text-rose-600' },
                { ...t.features.habits, icon: <Flame size={22} />, color: 'bg-orange-100 text-orange-600' },
                { ...t.features.goals, icon: <Target size={22} />, color: 'bg-purple-100 text-purple-600' },
                { ...t.features.gpa, icon: <GraduationCap size={22} />, color: 'bg-cyan-100 text-cyan-600' },
            ]
        },
        {
            title: t.cat4Title,
            desc: t.cat4Desc,
            color: 'from-purple-500 to-pink-500',
            bgColor: 'bg-purple-50/40',
            borderColor: 'border-purple-100',
            iconColor: 'text-purple-600',
            features: [
                { ...t.features.journal, icon: <BookOpen size={22} />, color: 'bg-emerald-100 text-emerald-600' },
                { ...t.features.spotify, icon: <Music size={22} />, color: 'bg-green-100 text-green-600' },
                { ...t.features.focus, icon: <Headphones size={22} />, color: 'bg-purple-100 text-purple-600' },
                { ...t.features.storage, icon: <LockKeyhole size={22} />, color: 'bg-zinc-100 text-zinc-600' },
                { ...t.features.visualboard, icon: <LayoutDashboard size={22} />, color: 'bg-indigo-100 text-indigo-600' },
            ]
        },
    ];

    return (
        <div className="min-h-screen bg-white font-sans text-gray-900 overflow-x-hidden">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-gray-100/80 transition-all duration-300">
                <div className="w-full px-4 xs:px-6 sm:px-8 lg:px-12 h-16 sm:h-[72px] flex items-center justify-between relative">
                    <div className="flex items-center gap-2.5 sm:gap-3 hover:opacity-90 transition-opacity cursor-pointer" onClick={() => onNavigate('home')}>
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-md shadow-indigo-100 border border-gray-100 shrink-0">
                            <img src="/pwa-192x192.png" alt="SmartLife" className="w-full h-full object-cover" />
                        </div>
                        <span className="font-extrabold text-base xs:text-lg sm:text-xl tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">SmartLife</span>
                    </div>
                    {/* Centered navigation links */}
                    <nav className="hidden md:flex items-center gap-6 sm:gap-8 absolute left-1/2 transform -translate-x-1/2">
                        <button onClick={() => onNavigate('home')} className="px-3 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all">{t.nav.home}</button>
                        <button onClick={() => onNavigate('features')} className="px-3 py-2 text-sm font-bold text-gray-900 bg-gray-100 rounded-lg transition-all">{t.nav.features}</button>
                        <button onClick={() => onNavigate('pricing')} className="px-3 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all">{t.nav.pricing}</button>
                        <button onClick={() => onNavigate('contact')} className="px-3 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all">{t.nav.contact}</button>
                    </nav>
                    <div className="flex items-center gap-2 xs:gap-3 sm:gap-4">
                        <button onClick={toggleLang} className="flex items-center gap-1.5 px-2.5 py-1.5 xs:px-3 xs:py-2 text-gray-600 hover:bg-gray-100/80 rounded-full transition-all font-semibold text-xs sm:text-sm" title="Switch Language">
                            <Globe size={16} className="sm:w-[18px] sm:h-[18px] text-gray-500" />
                            <span className="uppercase tracking-wider font-semibold">{lang}</span>
                        </button>
                        <button onClick={onLogin} className="px-4 py-2 xs:px-5 xs:py-2.5 bg-gray-900 text-white rounded-full font-bold hover:bg-gray-800 transition-all text-xs sm:text-sm shadow-md shadow-gray-200/50">
                            {t.login}
                        </button>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="pt-[100px] sm:pt-[130px] pb-12 sm:pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
                {/* Background Glows */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[400px] h-[400px] bg-purple-300/20 rounded-full blur-[120px] mix-blend-multiply animate-pulse" style={{ animationDuration: '4s' }}></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[400px] h-[400px] bg-indigo-300/20 rounded-full blur-[120px] mix-blend-multiply animate-pulse" style={{ animationDuration: '6s' }}></div>

                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-indigo-100 shadow-sm text-indigo-600 text-xs font-bold uppercase tracking-wider mb-6 animate-fade-in-up">
                        <Sparkles size={14} className="text-yellow-500" /> {t.heroTag}
                    </div>
                    <h1 className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-6 leading-[1.15] animate-fade-in-up delay-100">
                        {t.heroTitle} <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
                            {t.heroTitleHighlight}
                        </span>
                    </h1>
                    <p className="text-gray-600 text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed animate-fade-in-up delay-200">
                        {t.heroDesc}
                    </p>
                </div>
            </section>

            {/* Feature Categories */}
            <main className="space-y-16 sm:space-y-24 pb-20">
                {categories.map((cat, catIdx) => (
                    <section key={catIdx} className={`max-w-7xl mx-4 sm:mx-6 lg:mx-8 xl:mx-auto px-4 sm:px-8 lg:px-12 ${cat.bgColor} py-12 sm:py-16 rounded-3xl border ${cat.borderColor}`}>
                        {/* Category Header */}
                        <div className="text-center mb-10 sm:mb-14">
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 mb-3">
                                {cat.title}
                            </h2>
                            <p className="text-gray-600 text-base sm:text-lg max-w-2xl mx-auto">{cat.desc}</p>
                        </div>

                        {/* Feature Cards Grid */}
                        <div className={`grid gap-5 sm:gap-6 ${cat.features.length <= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
                            {cat.features.map((feat, featIdx) => (
                                <div
                                    key={featIdx}
                                    className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-default"
                                >
                                    <div className={`w-12 h-12 rounded-xl ${feat.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                                        {feat.icon}
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">{feat.title}</h3>
                                    <p className="text-sm text-gray-600 leading-relaxed">{feat.desc}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                ))}

                {/* CTA Section */}
                <section className="max-w-4xl mx-4 sm:mx-6 lg:mx-8 xl:mx-auto px-4 sm:px-8 lg:px-12">
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 px-8 sm:px-12 py-12 sm:py-16 text-center text-white">
                        {/* Decorative circles */}
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full"></div>
                        <div className="absolute -left-6 -bottom-6 w-32 h-32 bg-white/5 rounded-full"></div>
                        <div className="absolute right-1/4 bottom-4 w-20 h-20 bg-white/10 rounded-full"></div>

                        <div className="relative z-10">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider mb-4">
                                <Crown size={14} className="text-yellow-300" /> SmartLife Pro
                            </div>
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold mb-4">{t.ctaTitle}</h2>
                            <p className="text-white/80 text-base sm:text-lg mb-8 max-w-lg mx-auto">{t.ctaDesc}</p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <button
                                    onClick={onLogin}
                                    className="px-8 py-3.5 bg-white text-gray-900 rounded-full font-bold text-sm hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 flex items-center gap-2"
                                >
                                    <Zap size={18} className="text-yellow-500" /> {t.ctaBtn}
                                </button>
                                <button
                                    onClick={() => onNavigate('pricing')}
                                    className="px-8 py-3.5 bg-white/15 text-white rounded-full font-bold text-sm hover:bg-white/25 transition-all border border-white/30 flex items-center gap-2"
                                >
                                    {t.ctaPricing} <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="bg-gray-950 text-gray-400 py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-gray-800">
                            <img src="/pwa-192x192.png" alt="SmartLife" className="w-full h-full object-cover" />
                        </div>
                        <span className="font-bold text-white text-sm">SmartLife</span>
                        <span className="text-xs text-gray-500">© 2026</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-500">{t.footerBuilt}</span>
                        <button
                            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                            className="flex items-center justify-center w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-gray-400 hover:text-white transition-all"
                        >
                            <ChevronUp size={18} />
                        </button>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default FeaturesPage;
