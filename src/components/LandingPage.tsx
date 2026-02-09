import React, { useState } from 'react';
import { LayoutDashboard, Wallet, CalendarDays, Rocket, ArrowRight, ShieldCheck, Zap, Download, Globe, Mail, MessageCircle, User, Archive, LockKeyhole, Star, Headphones, Coffee } from 'lucide-react';
import InstallGuideModal from './InstallGuideModal';

interface LandingPageProps {
    onLogin: () => void;
    lang: 'vi' | 'en';
    setLang: (lang: 'vi' | 'en') => void;
}

const translations = {
    vi: {
        install: 'Cài App',
        login: 'Đăng nhập',
        heroTag: 'Trợ lý cá nhân All-in-One',
        heroTitle1: 'Quản lý cuộc sống',
        heroTitle2: 'Thông minh & Hiệu quả',
        heroDesc: 'SmartLife giúp bạn làm chủ tài chính, sắp xếp thời gian biểu và chinh phục mục tiêu cá nhân. Tất cả trong một ứng dụng duy nhất.',
        startNow: 'Bắt đầu miễn phí',
        learnMore: 'Tìm hiểu thêm',

        featVisualTitle: 'Góc nhìn toàn cảnh,\nKiểm soát mọi thứ.',
        featVisualDesc: 'Theo dõi tổng quan lịch trình, mục tiêu và đếm ngược ngày lễ sắp tới. Nắm bắt bức tranh tài chính toàn diện với số liệu thu chi tổng hợp.',
        featVisualItems: ['Tổng quan lịch trình & Mục tiêu', 'Đếm ngược ngày lễ VN', 'Báo cáo thu chi tổng hợp'],

        featFinanceTitle: 'Tài chính minh bạch,\nTiết kiệm tối đa.',
        featFinanceDesc: 'Theo dõi thu chi chi tiết, xem báo cáo trực quan và nhận phân tích thông minh từ AI để tối ưu hóa ngân sách của bạn.',
        featFinanceItems: ['Báo cáo thu chi hàng tháng', 'Phân tích AI thông minh', 'Đặt mục tiêu tiết kiệm'],

        featScheduleTitle: 'Làm chủ thời gian,\nNâng cao hiệu suất.',
        featScheduleDesc: 'Thời khóa biểu trực quan, To-do list ưu tiên thông minh và chế độ Focus mode giúp bạn tập trung hoàn thành mọi công việc.',
        featScheduleItems: ['Thời khóa biểu tuần/ngày', 'Todo list theo mức độ ưu tiên', 'Focus Timer tích hợp'],

        featFocusTitle: 'Tập trung cao độ,\nThư giãn tuyệt đối.',
        featFocusDesc: 'Chế độ Focus với bộ đếm giờ Pomodoro và kho nhạc Lofi chill giúp bạn duy trì sự tập trung và giảm căng thẳng khi học tập, làm việc.',
        featFocusItems: ['Bộ đếm giờ Pomodoro tùy chỉnh', 'Kho nhạc Lofi & Background Sounds', 'Thống kê thời gian tập trung'],

        featGoalsTitle: 'Đặt mục tiêu,\nHiện thực hóa ước mơ.',
        featGoalsDesc: 'Theo dõi từng bước tiến của bạn với tính năng quản lý mục tiêu dài hạn và ngắn hạn. Đừng chỉ mơ ước, hãy thực hiện.',
        featGoalsItems: ['Theo dõi tiến độ trực quan', 'Nhắc nhở hạn chót', 'Giao diện lịch vạn niên'],

        promoTag: 'Tính năng mới',
        promoTitle: 'Khám phá My Storage',
        promoDesc: 'Không gian lưu trữ cá nhân bảo mật. Ghi chú, tệp tin, hình ảnh & đa phương tiện - tất cả trong một nơi duy nhất.',
        promoBtn: 'Trải nghiệm ngay',
        featStorageItems: ['Ghi chú đa phương tiện (Rich Text)', 'Lưu trữ & Xem trước Tệp tin/Media', 'Bảo mật tuyệt đối & Riêng tư'],

        contactTitle: 'Kết nối với tôi',
        contactDesc: 'Liên hệ để hợp tác hoặc đóng góp ý kiến phát triển ứng dụng.',
        footerBuilt: 'Được xây dựng với ❤️ và công nghệ AI tiên tiến.',
        langName: 'Tiếng Việt'
    },
    en: {
        install: 'Install App',
        login: 'Login',
        heroTag: 'All-in-One Personal Assistant',
        heroTitle1: 'Manage Your Life',
        heroTitle2: 'Smart & Efficiently',
        heroDesc: 'SmartLife helps you master your finances, organize your schedule, and conquer personal goals. All in one single app.',
        startNow: 'Start for Free',
        learnMore: 'Learn More',

        featVisualTitle: 'Holistic View,\nControl Everything.',
        featVisualDesc: 'Get an overview of schedules, goals, and upcoming holiday countdowns. Master your financial picture with comprehensive income and expense data.',
        featVisualItems: ['Schedule & Goals Overview', 'Holiday Countdown', 'Comprehensive Financial Report'],

        featFinanceTitle: 'Transparent Finance,\nMaximize Savings.',
        featFinanceDesc: 'Track expenses in detail, view visual reports, and get smart AI analysis to optimize your budget.',
        featFinanceItems: ['Monthly expense reports', 'Smart AI Analysis', 'Set savings goals'],

        featScheduleTitle: 'Master Your Time,\nBoost Productivity.',
        featScheduleDesc: 'Visual timetable, smart prioritized To-do list, and Focus mode to help you concentrate on getting things done.',
        featScheduleItems: ['Weekly/Daily timetable', 'Priority-based Todo list', 'Integrated Focus Timer'],

        featFocusTitle: 'Deep Focus,\nAbsolute Relaxation.',
        featFocusDesc: 'Focus mode with Pomodoro timer and chill Lofi music library helps you maintain concentration and reduce stress while studying or working.',
        featFocusItems: ['Customizable Pomodoro Timer', 'Lofi Music & Background Sounds', 'Focus Time Statistics'],

        featGoalsTitle: 'Set Goals,\nRealize Dreams.',
        featGoalsDesc: 'Track your every step with long-term and short-term goal management. Don\'t just dream, make it happen.',
        featGoalsItems: ['Visual progress tracking', 'Deadline reminders', 'Perpetual calendar interface'],
        promoTag: 'New Feature',
        promoTitle: 'Discover My Storage',
        promoDesc: 'Secure personal storage space. Notes, files, images & media - all in one single place.',
        promoBtn: 'Experience Now',
        featStorageItems: ['Rich Text Multimedia Notes', 'Store & Preview Files/Media', 'Absolute Security & Privacy'],

        contactTitle: 'Connect with Me',
        contactDesc: 'Contact for collaboration or feedback on app development.',
        footerBuilt: 'Built with ❤️ and advanced AI technology.',
        langName: 'English'
    }
};

const LandingPage: React.FC<LandingPageProps> = ({ onLogin, lang, setLang }) => {
    const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

    const t = translations[lang];

    const toggleLang = () => {
        setLang(lang === 'vi' ? 'en' : 'vi');
    };

    return (
        <div className="min-h-screen bg-white font-sans text-gray-900 overflow-x-hidden">
            <InstallGuideModal isOpen={isInstallModalOpen} onClose={() => setIsInstallModalOpen(false)} />

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-lg">
                            <LayoutDashboard className="text-white" size={20} />
                        </div>
                        <span className="font-bold text-xl tracking-tight text-gray-800">SmartLife</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Language Toggle */}
                        <button
                            onClick={toggleLang}
                            className="flex items-center gap-1.5 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-full transition-all font-medium text-sm"
                            title="Switch Language"
                        >
                            <Globe size={18} />
                            <span className="uppercase">{lang}</span>
                        </button>

                        <button
                            onClick={() => setIsInstallModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full font-bold hover:bg-indigo-100 transition-all text-sm"
                            title={t.install}
                        >
                            <Download size={18} />
                            <span className="hidden sm:inline">{t.install}</span>
                        </button>
                        <button
                            onClick={onLogin}
                            className="px-5 py-2.5 bg-gray-900 text-white rounded-full font-medium hover:bg-gray-800 transition-all text-sm"
                        >
                            {t.login}
                        </button>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-40 -mt-40 w-96 h-96 bg-purple-100 rounded-full blur-3xl opacity-50"></div>
                <div className="absolute bottom-0 left-0 -ml-40 -mb-40 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-50"></div>

                <div className="max-w-5xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-6 animate-fade-in-up">
                        <Zap size={14} /> {t.heroTag}
                    </div>
                    <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-6 leading-tight animate-fade-in-up delay-100">
                        {t.heroTitle1} <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">{t.heroTitle2}</span>
                    </h1>
                    <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in-up delay-200">
                        {t.heroDesc}
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-300">
                        <button
                            onClick={onLogin}
                            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-2"
                        >
                            {t.startNow} <ArrowRight size={20} />
                        </button>
                        <a href="#features" className="w-full sm:w-auto px-8 py-4 bg-white text-gray-700 border border-gray-200 rounded-full font-bold text-lg hover:bg-gray-50 transition-all flex items-center justify-center">
                            {t.learnMore}
                        </a>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <div id="features" className="space-y-24 py-20 pb-0">
                {/* Feature 0: Visual Board (NEW) */}
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-indigo-50/30 py-20 rounded-3xl border border-indigo-50">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="space-y-6">
                            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                                <LayoutDashboard size={28} />
                            </div>
                            <h2 className="text-3xl font-bold text-gray-900 whitespace-pre-line">{t.featVisualTitle}</h2>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                {t.featVisualDesc}
                            </p>
                            <ul className="space-y-3">
                                {t.featVisualItems.map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-gray-700 font-medium">
                                        <ShieldCheck className="text-indigo-500" size={20} /> {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-indigo-200 to-purple-200 rounded-3xl blur-xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
                            <img
                                src="/assets/visual-board-preview.png"
                                alt="Visual Board Overview"
                                className="relative rounded-2xl shadow-2xl border border-gray-100 transform group-hover:-translate-y-2 transition-transform duration-500"
                            />
                        </div>
                    </div>
                </section>

                {/* Feature 1: Finance */}
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="order-2 md:order-1 relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-3xl blur-xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
                            <img
                                src="/assets/finance_preview.png"
                                alt="Quản lý Tài chính"
                                className="relative rounded-2xl shadow-2xl border border-gray-100 transform group-hover:-translate-y-2 transition-transform duration-500"
                            />
                        </div>
                        <div className="order-1 md:order-2 space-y-6">
                            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                                <Wallet size={28} />
                            </div>
                            <h2 className="text-3xl font-bold text-gray-900 whitespace-pre-line">{t.featFinanceTitle}</h2>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                {t.featFinanceDesc}
                            </p>
                            <ul className="space-y-3">
                                {t.featFinanceItems.map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-gray-700 font-medium">
                                        <ShieldCheck className="text-emerald-500" size={20} /> {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Feature 2: Schedule */}
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-gray-50/50 py-20 rounded-3xl">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="space-y-6">
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                                <CalendarDays size={28} />
                            </div>
                            <h2 className="text-3xl font-bold text-gray-900 whitespace-pre-line">{t.featScheduleTitle}</h2>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                {t.featScheduleDesc}
                            </p>
                            <ul className="space-y-3">
                                {t.featScheduleItems.map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-gray-700 font-medium">
                                        <ShieldCheck className="text-blue-500" size={20} /> {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-3xl blur-xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
                            <img
                                src="/assets/schedule_preview.png"
                                alt="Quản lý Lịch trình"
                                className="relative rounded-2xl shadow-2xl border border-gray-100 transform group-hover:-translate-y-2 transition-transform duration-500"
                            />
                        </div>
                    </div>
                </section>

                {/* Feature 2.5: Focus & Music (NEW) */}
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-purple-50/30 py-20 rounded-3xl border border-purple-50">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="order-2 md:order-1 relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-purple-200 to-pink-200 rounded-3xl blur-xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
                            {/* Image Composition */}
                            <div className="relative">
                                <img
                                    src="/assets/focus_feature_2.png"
                                    alt="Focus Timer"
                                    className="relative rounded-2xl shadow-2xl border border-gray-100 transform group-hover:scale-105 transition-transform duration-500 z-10"
                                />
                                <img
                                    src="/assets/focus_feature_1.png"
                                    alt="Music Player"
                                    className="absolute -bottom-8 -right-4 w-2/5 rounded-2xl shadow-2xl border border-gray-100 transform rotate-3 group-hover:rotate-6 transition-transform duration-500 z-20"
                                />
                            </div>
                        </div>
                        <div className="order-1 md:order-2 space-y-6">
                            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
                                <Headphones size={28} />
                            </div>
                            <h2 className="text-3xl font-bold text-gray-900 whitespace-pre-line">{t.featFocusTitle}</h2>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                {t.featFocusDesc}
                            </p>
                            <ul className="space-y-3">
                                {t.featFocusItems && t.featFocusItems.map((item: string, i: number) => (
                                    <li key={i} className="flex items-center gap-3 text-gray-700 font-medium">
                                        <Zap className="text-purple-500" size={20} /> {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Feature 3: Goals */}
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="order-2 md:order-1 relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-orange-100 to-amber-100 rounded-3xl blur-xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
                            <img
                                src="/assets/goals_preview.png"
                                alt="Quản lý Mục tiêu"
                                className="relative rounded-2xl shadow-2xl border border-gray-100 transform group-hover:-translate-y-2 transition-transform duration-500"
                            />
                        </div>
                        <div className="order-1 md:order-2 space-y-6">
                            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                                <Rocket size={28} />
                            </div>
                            <h2 className="text-3xl font-bold text-gray-900 whitespace-pre-line">{t.featGoalsTitle}</h2>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                {t.featGoalsDesc}
                            </p>
                            <ul className="space-y-3">
                                {t.featGoalsItems.map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-gray-700 font-medium">
                                        <ShieldCheck className="text-orange-500" size={20} /> {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Promo Banner: My Storage */}
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
                    <div className="relative rounded-3xl overflow-hidden shadow-2xl group cursor-pointer bg-gradient-to-r from-blue-900 to-indigo-900" onClick={onLogin}>
                        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay group-hover:scale-105 transition-transform duration-700" />

                        <div className="relative z-10 p-8 md:p-12 grid md:grid-cols-2 gap-12 items-center">
                            {/* Content */}
                            <div className="text-center md:text-left">
                                <div className="inline-block px-4 py-1.5 rounded-full bg-blue-500/30 border border-blue-400/30 text-blue-200 text-xs font-bold uppercase tracking-wider mb-6">
                                    {t.promoTag}
                                </div>
                                <h2 className="text-3xl md:text-4xl font-black text-white mb-6 leading-tight">
                                    {t.promoTitle}
                                </h2>
                                <p className="text-blue-100 text-lg mb-8 leading-relaxed">
                                    {t.promoDesc}
                                </p>

                                {/* Feature List */}
                                <ul className="space-y-3 mb-8 text-left inline-block">
                                    {t.featStorageItems && t.featStorageItems.map((item: string, i: number) => (
                                        <li key={i} className="flex items-center gap-3 text-blue-50 font-medium">
                                            <div className="p-1 rounded-full bg-blue-500/20 text-blue-300">
                                                <ShieldCheck size={16} />
                                            </div>
                                            {item}
                                        </li>
                                    ))}
                                </ul>

                                <div>
                                    <button className="px-8 py-3 bg-white text-indigo-900 rounded-xl font-bold hover:bg-blue-50 transition-colors shadow-lg hover:shadow-xl flex items-center gap-2 mx-auto md:mx-0 group-hover:scale-105 transform duration-300">
                                        <Archive size={20} />
                                        {t.promoBtn}
                                    </button>
                                </div>
                            </div>

                            {/* Images Composition */}
                            <div className="relative h-full min-h-[300px] flex items-center justify-center">
                                {/* Back Image (Files/Images) */}
                                <div className="absolute top-0 right-0 w-3/4 transform translate-x-4 -translate-y-4 rotate-3 group-hover:rotate-6 transition-transform duration-500">
                                    <img
                                        src="/assets/storage_feature_2.png"
                                        alt="My Storage Files"
                                        className="rounded-xl shadow-2xl border border-white/20 w-full"
                                    />
                                </div>

                                {/* Front Image (Notes) */}
                                <div className="absolute bottom-0 left-0 w-3/4 transform -translate-x-4 translate-y-4 -rotate-3 group-hover:-rotate-6 transition-transform duration-500 z-10">
                                    <img
                                        src="/assets/storage_feature_1.png"
                                        alt="My Storage Notes"
                                        className="rounded-xl shadow-2xl border border-white/20 w-full"
                                    />
                                </div>

                                {/* Floating Decor */}
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
                                    <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-lg animate-bounce">
                                        <LockKeyhole size={32} className="text-white" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {/* Contact Section */}
            <section className="py-12 bg-gray-900 text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')] bg-cover bg-center opacity-10"></div>
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                    <h2 className="text-2xl font-bold mb-3">{t.contactTitle}</h2>
                    <p className="text-gray-400 mb-6 max-w-lg mx-auto text-sm">
                        {t.contactDesc}
                    </p>

                    <div className="flex flex-wrap justify-center gap-4">
                        <a href="https://beacons.ai/baquan3q" target="_blank" rel="noreferrer" className="flex items-center gap-2.5 px-5 py-3 bg-white/10 hover:bg-white/20 rounded-xl backdrop-blur-sm transition-all border border-white/5 hover:scale-105 group">
                            <div className="bg-indigo-500/20 p-1.5 rounded-lg group-hover:bg-indigo-500/30 transition-colors">
                                <User className="text-indigo-400" size={18} />
                            </div>
                            <div className="text-left">
                                <div className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">Profile</div>
                                <div className="font-semibold text-sm">baquan3q</div>
                            </div>
                        </a>

                        <a href="mailto:baquan3q@gmail.com" className="flex items-center gap-2.5 px-5 py-3 bg-white/10 hover:bg-white/20 rounded-xl backdrop-blur-sm transition-all border border-white/5 hover:scale-105 group">
                            <div className="bg-pink-500/20 p-1.5 rounded-lg group-hover:bg-pink-500/30 transition-colors">
                                <Mail className="text-pink-400" size={18} />
                            </div>
                            <div className="text-left">
                                <div className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">Email</div>
                                <div className="font-semibold text-sm">baquan3q@gmail.com</div>
                            </div>
                        </a>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-100 py-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500">
                    <p className="mb-2 font-medium">SmartLife Application © 2026</p>
                    <p className="text-sm">{t.footerBuilt}</p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
