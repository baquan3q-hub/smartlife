import React, { useState } from 'react';
import { Globe, ChevronUp, Crown, Sparkles, CheckCircle2, X, Star, Award, ArrowRight, Zap, Brain, LayoutDashboard, Flame, BookOpen, Target, Briefcase, FileText, GraduationCap, TrendingUp, Trophy, HelpCircle, ChevronDown, Wallet, LockKeyhole } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '../services/subscriptionService';
import { Lang } from '../i18n/i18n';

interface PricingPageProps {
    onLogin: () => void;
    onNavigate: (page: string) => void;
    lang: Lang;
    setLang: (lang: Lang) => void;
}

const translations = {
    vi: {
        nav: { home: 'Trang chủ', features: 'Tính năng', pricing: 'Bảng giá', contact: 'Liên hệ' },
        login: 'Đăng nhập',
        heroTag: 'Bảng giá minh bạch',
        heroTitle: 'Chọn gói phù hợp',
        heroTitleHighlight: 'cho bạn.',
        heroDesc: 'Bắt đầu miễn phí 7 ngày. Nâng cấp bất kỳ lúc nào để mở khóa toàn bộ tính năng SmartLife.',
        freeTitle: 'Miễn phí',
        freePrice: '0đ',
        freeDesc: 'Dùng thử 7 ngày — trải nghiệm đầy đủ tính năng.',
        freeBadge: 'Dùng thử',
        proTitle: 'Pro',
        proDesc: 'Mở khóa toàn bộ — đầu tư cho bản thân.',
        proBadge: 'Phổ biến nhất',
        perMonth: '/tháng',
        startFree: 'Bắt đầu miễn phí',
        upgradePro: 'Nâng cấp Pro',
        compareTitle: 'So sánh chi tiết',
        compareDesc: 'Tất cả những gì bạn nhận được khi nâng cấp.',
        feature: 'Tính năng',
        free: 'Free',
        pro: 'Pro',
        planSelectTitle: 'Chọn gói thời hạn',
        planSelectDesc: 'Đầu tư cho bản thân — chi phí chỉ bằng 1 ly trà đá/tháng 🧋',
        saveLabel: 'Tiết kiệm',
        monthLabel: 'tháng',
        basicLabel: 'Gói cơ bản',
        popular: 'PHỔ BIẾN',
        bestValue: 'BEST VALUE',
        bestValueDesc: 'Rẻ hơn 1 ly trà đá/tháng! Chỉ hơn gói 1 năm có 100k — đủ dùng cả 4 năm đại học.',
        faqTitle: 'Câu hỏi thường gặp',
        faqItems: [
            { q: 'Tôi có thể dùng thử miễn phí không?', a: 'Có! Mỗi tài khoản mới đều được 7 ngày dùng thử miễn phí với đầy đủ tính năng Pro.' },
            { q: 'Thanh toán bằng cách nào?', a: 'Thanh toán qua chuyển khoản ngân hàng (Vietcombank). Sau khi chọn gói, bạn sẽ nhận được mã chuyển khoản và thông tin tài khoản.' },
            { q: 'Có được hoàn tiền không?', a: 'Hiện tại chúng tôi không hỗ trợ hoàn tiền. Hãy tận dụng 7 ngày dùng thử để trải nghiệm trước khi quyết định.' },
            { q: 'Nếu tôi đã là Pro, mua thêm gói mới thì sao?', a: 'Thời hạn Pro mới sẽ được cộng dồn từ ngày hết hạn hiện tại, không bị mất ngày nào.' },
        ],
        ctaTitle: 'Bắt đầu miễn phí ngay hôm nay',
        ctaDesc: '7 ngày trải nghiệm đầy đủ. Không cần thẻ tín dụng.',
        ctaBtn: 'Đăng ký miễn phí',
        footerBuilt: 'By QuanBa',
        comparisonFeatures: [
            { name: 'AI Cố vấn cá nhân', free: '10 tin/ngày', pro: '600.000 token/tháng' },
            { name: 'Quản lý Tài chính & Ví', free: true, pro: true },
            { name: 'Lịch trình & Thời khóa biểu', free: true, pro: true },
            { name: 'Todo & Kanban Board', free: true, pro: true },
            { name: 'Thói quen (Habits)', free: '3 thói quen', pro: 'Không giới hạn' },
            { name: 'Nhật ký cá nhân', free: true, pro: true },
            { name: 'GPA Tracker nâng cao', free: false, pro: true },
            { name: 'AI Career Analyzer', free: false, pro: true },
            { name: 'CV Builder & PDF Export', free: '7 ngày/lần', pro: 'Vĩnh viễn' },
            { name: 'Visual Board tổng quan', free: false, pro: true },
            { name: 'Cashflow & Sổ nợ', free: false, pro: true },
            { name: 'My Spotify', free: true, pro: true },
            { name: 'My Storage bảo mật', free: '50MB', pro: '500MB' },
            { name: 'Huy hiệu & StarBrain', free: false, pro: true },
            { name: 'Đếm ngược & Đếm tiến', free: '3 sự kiện', pro: 'Không giới hạn' },
        ],
    },
    en: {
        nav: { home: 'Home', features: 'Features', pricing: 'Pricing', contact: 'Contact' },
        login: 'Login',
        heroTag: 'Transparent Pricing',
        heroTitle: 'Choose the right plan',
        heroTitleHighlight: 'for you.',
        heroDesc: 'Start free for 7 days. Upgrade anytime to unlock all SmartLife features.',
        freeTitle: 'Free',
        freePrice: '0đ',
        freeDesc: '7-day trial — experience all features.',
        freeBadge: 'Trial',
        proTitle: 'Pro',
        proDesc: 'Unlock everything — invest in yourself.',
        proBadge: 'Most Popular',
        perMonth: '/month',
        startFree: 'Start for Free',
        upgradePro: 'Upgrade to Pro',
        compareTitle: 'Detailed Comparison',
        compareDesc: 'Everything you get when upgrading.',
        feature: 'Feature',
        free: 'Free',
        pro: 'Pro',
        planSelectTitle: 'Choose your plan duration',
        planSelectDesc: 'Invest in yourself — costs less than a cup of coffee/month ☕',
        saveLabel: 'Save',
        monthLabel: 'months',
        basicLabel: 'Basic',
        popular: 'POPULAR',
        bestValue: 'BEST VALUE',
        bestValueDesc: 'Less than a cup of tea/month! Only 100k more than the 1-year plan — enough for all 4 years of college.',
        faqTitle: 'Frequently Asked Questions',
        faqItems: [
            { q: 'Can I try it for free?', a: 'Yes! Every new account gets a 7-day free trial with full Pro features.' },
            { q: 'How do I pay?', a: 'Payment via bank transfer (Vietcombank). After selecting a plan, you\'ll receive a transfer code and account information.' },
            { q: 'Can I get a refund?', a: 'Currently we don\'t support refunds. Please use the 7-day trial to experience before deciding.' },
            { q: 'What if I\'m already Pro and buy another plan?', a: 'The new Pro duration will be added from your current expiry date — no days lost.' },
        ],
        ctaTitle: 'Start free today',
        ctaDesc: '7 days full experience. No credit card required.',
        ctaBtn: 'Sign up for free',
        footerBuilt: 'Built with ❤️ and advanced AI technology.',
        comparisonFeatures: [
            { name: 'AI Personal Advisor', free: '10 msgs/day', pro: '600,000 tokens/month' },
            { name: 'Finance & Wallet Management', free: true, pro: true },
            { name: 'Schedule & Timetable', free: true, pro: true },
            { name: 'Todo & Kanban Board', free: true, pro: true },
            { name: 'Habits Tracker', free: '3 habits', pro: 'Unlimited' },
            { name: 'Personal Journal', free: true, pro: true },
            { name: 'Advanced GPA Tracker', free: false, pro: true },
            { name: 'AI Career Analyzer', free: false, pro: true },
            { name: 'CV Builder & PDF Export', free: '7-day renewal', pro: 'Permanent' },
            { name: 'Visual Board Overview', free: false, pro: true },
            { name: 'Cashflow & Debt Ledger', free: false, pro: true },
            { name: 'My Spotify', free: true, pro: true },
            { name: 'My Storage (Secure)', free: '50MB', pro: '500MB' },
            { name: 'Badges & StarBrain', free: false, pro: true },
            { name: 'Countdown & Count-up', free: '3 events', pro: 'Unlimited' },
        ],
    },
    ko: {
        nav: { home: '홈', features: '기능', pricing: '요금제', contact: '문의' },
        login: '로그인',
        heroTag: '투명한 요금제',
        heroTitle: '나에게 맞는 플랜',
        heroTitleHighlight: '을 선택하세요.',
        heroDesc: '7일 무료 체험 후 언제든 업그레이드하여 SmartLife의 모든 기능을 이용하세요.',
        freeTitle: '무료',
        freePrice: '0₩',
        freeDesc: '7일 체험 — 모든 기능을 경험하세요.',
        freeBadge: '체험',
        proTitle: 'Pro',
        proDesc: '모든 기능 잠금 해제 — 자신에게 투자하세요.',
        proBadge: '가장 인기',
        perMonth: '/월',
        startFree: '무료로 시작하기',
        upgradePro: 'Pro 업그레이드',
        compareTitle: '상세 비교',
        compareDesc: '업그레이드 시 받을 수 있는 모든 것.',
        feature: '기능',
        free: '무료',
        pro: 'Pro',
        planSelectTitle: '플랜 기간 선택',
        planSelectDesc: '자신에게 투자하세요 — 한 달에 커피 한 잔 가격 ☕',
        saveLabel: '절약',
        monthLabel: '개월',
        basicLabel: '기본',
        popular: '인기',
        bestValue: '최고 가치',
        bestValueDesc: '한 달에 차 한 잔보다 저렴! 1년 플랜보다 100k만 더 — 대학 4년 내내 사용 가능.',
        faqTitle: '자주 묻는 질문',
        faqItems: [
            { q: '무료로 사용할 수 있나요?', a: '네! 모든 신규 계정은 모든 Pro 기능을 포함한 7일 무료 체험을 제공합니다.' },
            { q: '어떻게 결제하나요?', a: '은행 이체(Vietcombank)로 결제합니다. 플랜 선택 후 이체 코드와 계좌 정보를 받으실 수 있습니다.' },
            { q: '환불 가능한가요?', a: '현재 환불은 지원하지 않습니다. 결정하기 전에 7일 체험을 이용해주세요.' },
            { q: '이미 Pro인데 다른 플랜을 구매하면?', a: '새 Pro 기간은 현재 만료일부터 추가됩니다 — 손실 없음.' },
        ],
        ctaTitle: '오늘 무료로 시작하세요',
        ctaDesc: '7일간 완전한 경험. 신용카드 불필요.',
        ctaBtn: '무료로 가입하기',
        footerBuilt: '❤️와 스마트 AI 기술로 제작되었습니다.',
        comparisonFeatures: [
            { name: 'AI 개인 어드바이저', free: '10건/일', pro: '600,000 토큰/월' },
            { name: '재정 & 지갑 관리', free: true, pro: true },
            { name: '일정 & 시간표', free: true, pro: true },
            { name: 'Todo & Kanban 보드', free: true, pro: true },
            { name: '습관 추적기', free: '3개', pro: '무제한' },
            { name: '개인 일기장', free: true, pro: true },
            { name: '고급 GPA 트래커', free: false, pro: true },
            { name: 'AI 커리어 분석기', free: false, pro: true },
            { name: 'CV 빌더 & PDF', free: '7일 갱신', pro: '영구' },
            { name: '비주얼 보드', free: false, pro: true },
            { name: '현금흐름 & 채무', free: false, pro: true },
            { name: 'My Spotify', free: true, pro: true },
            { name: 'My Storage', free: '50MB', pro: '500MB' },
            { name: '배지 & StarBrain', free: false, pro: true },
            { name: '카운트다운/업', free: '3건', pro: '무제한' },
        ],
    }
};

const getPlanDurationLabel = (planId: string, lang: Lang) => {
    const labels: Record<string, Record<string, string>> = {
        '1_month': { vi: '1 tháng', en: '1 month', ko: '1개월' },
        '3_months': { vi: '3 tháng', en: '3 months', ko: '3개월' },
        '6_months': { vi: '6 tháng', en: '6 months', ko: '6개월' },
        '12_months': { vi: '12 tháng', en: '12 months', ko: '12개월' },
        '4_years': { vi: '48 tháng (4 năm)', en: '48 months (4 years)', ko: '48개월 (4년)' },
    };
    return labels[planId]?.[lang] || '';
};

const PricingPage: React.FC<PricingPageProps> = ({ onLogin, onNavigate, lang, setLang }) => {
    const t = translations[lang];
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    const toggleLang = () => {
        setLang(lang === 'vi' ? 'en' : lang === 'en' ? 'ko' : 'vi');
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
    };

    const regularPlans = SUBSCRIPTION_PLANS.filter(p => !p.is_best_value);
    const bestValuePlan = SUBSCRIPTION_PLANS.find(p => p.is_best_value);

    const visualShowcaseFeatures = [
        {
            icon: <Brain size={22} />,
            color: 'bg-violet-100 text-violet-600',
            title: lang === 'vi' ? 'AI Trợ lý Cá nhân' : lang === 'ko' ? '나만의 AI 비서' : 'AI Personal Advisor',
            desc: lang === 'vi' ? 'Trợ lý thông minh phân tích chi tiêu, gợi ý lịch trình, đọc hiểu tài liệu, hình ảnh & audio.' : lang === 'ko' ? '지출 내역 분석, 일정 추천, 문서/이미지/오디오 이해를 제공하는 맞춤형 AI 비서.' : 'Smart assistant that analyzes spending, suggests schedules, and understands docs, images & audio.',
            freeText: lang === 'vi' ? '10 tin/ngày (Chỉ text)' : lang === 'ko' ? '일 10건 (텍스트만)' : '10 msgs/day (Text only)',
            freeIcon: <CheckCircle2 size={14} className="text-gray-400" />,
            proText: lang === 'vi' ? '600.000 token/tháng + Đọc file, ảnh, audio' : lang === 'ko' ? '월 600,000 토큰 + 파일/이미지/오디오 분석' : '600k tokens/mo + Files, images, audio analysis',
            proIcon: <Sparkles size={14} className="text-yellow-500 fill-yellow-500 animate-pulse" />
        },
        {
            icon: <GraduationCap size={22} />,
            color: 'bg-rose-100 text-rose-600',
            title: lang === 'vi' ? 'Cố vấn Sự nghiệp & GPA' : lang === 'ko' ? 'AI 진로 네비게이터 & GPA' : 'AI Career Advisor & GPA',
            desc: lang === 'vi' ? 'Phân tích GPA học tập học kỳ, kết hợp tính cách MBTI/DISC để đề xuất lộ trình thăng tiến.' : lang === 'ko' ? '학기별 GPA 성적과 MBTI/DISC 성격을 분석하여 상세한 커리어 로드맵 추천.' : 'Analyzes semester GPA and MBTI/DISC personality to suggest detailed career roadmaps.',
            freeText: lang === 'vi' ? 'Không hỗ trợ' : lang === 'ko' ? '지원 안 함' : 'Not supported',
            freeIcon: <X size={14} className="text-red-400" />,
            proText: lang === 'vi' ? 'AI Advisor & GPA Tracker nâng cao toàn diện' : lang === 'ko' ? 'AI 진로 분석기 & 고급 GPA 트래커 전체 기능 제공' : 'Full AI Advisor & Advanced GPA Tracker',
            proIcon: <Sparkles size={14} className="text-indigo-500 fill-indigo-500" />
        },
        {
            icon: <FileText size={22} />,
            color: 'bg-sky-100 text-sky-600',
            title: lang === 'vi' ? 'CV Builder tự động' : lang === 'ko' ? '자동 이력서 빌더' : 'Auto CV Builder & Export',
            desc: lang === 'vi' ? 'Tự động điền thông tin từ GPA Tracker và Goals của bạn, xuất tệp PDF in ấn chuẩn A4.' : lang === 'ko' ? 'GPA 트래커 및 목표 데이터에서 학업 정보를 자동 추출하여 A4 규격 PDF로 저장.' : 'Auto-fills academic data from GPA & Goals, exporting professional A4 PDFs.',
            freeText: lang === 'vi' ? 'Trải nghiệm (Phải gia hạn sau mỗi 7 ngày)' : lang === 'ko' ? '체험판 (7일마다 갱신 필요)' : 'Trial (Requires renewal every 7 days)',
            freeIcon: <CheckCircle2 size={14} className="text-gray-400" />,
            proText: lang === 'vi' ? 'Sử dụng vĩnh viễn + Xuất PDF không giới hạn' : lang === 'ko' ? '영구 사용 + PDF 무제한 내보내기' : 'Permanent use + Unlimited PDF exports',
            proIcon: <Sparkles size={14} className="text-teal-500 fill-teal-500" />
        },
        {
            icon: <Wallet size={22} />,
            color: 'bg-emerald-100 text-emerald-600',
            title: lang === 'vi' ? 'Tài chính & Ví & Sổ nợ' : lang === 'ko' ? '자산 관리 & 지갑 & 채무' : 'Finance, Wallets & Debts',
            desc: lang === 'vi' ? 'Quản lý nhiều ví/quỹ, dòng tiền thông minh Cashflow, ghi nợ & tự động khấu trừ nợ thực tế.' : lang === 'ko' ? '다중 자산 지갑 관리, 현금흐름 분석 및 실시간 연동 채무 관리.' : 'Manage multiple wallets/funds, smart Cashflow, and debt ledgers with auto-deduction.',
            freeText: lang === 'vi' ? 'Ví & Ghi chép thu chi cơ bản' : lang === 'ko' ? '기본 자산 지갑 및 수입/지출 내역 기록' : 'Basic wallets & income/expense logging',
            freeIcon: <CheckCircle2 size={14} className="text-gray-400" />,
            proText: lang === 'vi' ? 'Cashflow dòng tiền & Sổ nợ khấu trừ tự động' : lang === 'ko' ? '현금흐름 분석 & 채무 실시간 자동 차감' : 'Advanced Cashflow & Auto debt ledger link',
            proIcon: <Sparkles size={14} className="text-emerald-500 fill-emerald-500" />
        },
        {
            icon: <Flame size={22} />,
            color: 'bg-orange-100 text-orange-600',
            title: lang === 'vi' ? 'Thói quen & Sự kiện & StarBrain' : lang === 'ko' ? '습관 관리 & D-day & 스타브레인' : 'Habits, Countdown & StarBrain',
            desc: lang === 'vi' ? 'Thiết lập chuỗi thói quen (Streak), đếm ngược/tiến ngày lễ kỷ niệm, thưởng sao StarBrain.' : lang === 'ko' ? '스트릭 습관 관리, D-day 디데이 카운트다운/업 및 스타브레인 별점 적립.' : 'Build streaks for habits, countdown/up for events, and earn StarBrain rewards.',
            freeText: lang === 'vi' ? 'Tối đa 3 thói quen & 3 sự kiện' : lang === 'ko' ? '습관 최대 3개 및 디데이 최대 3개' : 'Max 3 habits & 3 events',
            freeIcon: <CheckCircle2 size={14} className="text-gray-400" />,
            proText: lang === 'vi' ? 'Không giới hạn + Tích lũy StarBrain Pro' : lang === 'ko' ? '무제한 설정 + StarBrain 적립 혜택' : 'Unlimited tracker + Pro StarBrain rewards',
            proIcon: <Sparkles size={14} className="text-orange-500 fill-orange-500" />
        },
        {
            icon: <LockKeyhole size={22} />,
            color: 'bg-zinc-100 text-zinc-600',
            title: lang === 'vi' ? 'Kho lưu trữ đám mây bảo mật' : lang === 'ko' ? '보안 클라우드 저장소' : 'Secure Cloud Storage',
            desc: lang === 'vi' ? 'Lưu trữ ghi chú đa phương tiện, tệp tin, hình ảnh riêng tư và bảo mật tuyệt đối.' : lang === 'ko' ? '보안 암호화로 보호되는 멀티미디어 노트, 파일, 이미지 보관함.' : 'Store rich text notes, private files, and images securely with encryption.',
            freeText: lang === 'vi' ? 'Dung lượng tối đa 50MB' : lang === 'ko' ? '최대 용량 50MB 제한' : '50MB capacity limit',
            freeIcon: <CheckCircle2 size={14} className="text-gray-400" />,
            proText: lang === 'vi' ? 'Dung lượng 500MB bảo mật tối đa' : lang === 'ko' ? '용량 500MB 보안 저장소 제공' : 'Expanded 500MB secure storage space',
            proIcon: <Sparkles size={14} className="text-indigo-600 fill-indigo-600" />
        }
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
                        <button onClick={() => onNavigate('features')} className="px-3 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all">{t.nav.features}</button>
                        <button onClick={() => onNavigate('pricing')} className="px-3 py-2 text-sm font-bold text-gray-900 bg-gray-100 rounded-lg transition-all">{t.nav.pricing}</button>
                        <button onClick={() => onNavigate('contact')} className="px-3 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all">{t.nav.contact}</button>
                    </nav>
                    <div className="flex items-center gap-2 xs:gap-3 sm:gap-4">
                        <button onClick={toggleLang} className="flex items-center gap-1.5 px-2.5 py-1.5 xs:px-3 xs:py-2 text-gray-600 hover:bg-gray-100/80 rounded-full transition-all font-semibold text-xs sm:text-sm">
                            <Globe size={16} className="sm:w-[18px] sm:h-[18px] text-gray-500" />
                            <span className="uppercase tracking-wider font-semibold">{lang}</span>
                        </button>
                        <button onClick={onLogin} className="px-4 py-2 xs:px-5 xs:py-2.5 bg-gray-900 text-white rounded-full font-bold hover:bg-gray-800 transition-all text-xs sm:text-sm shadow-md shadow-gray-200/50">
                            {t.login}
                        </button>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <section className="pt-[100px] sm:pt-[130px] pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-indigo-100/50 to-transparent rounded-full blur-[100px]"></div>
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-indigo-100 shadow-sm text-indigo-600 text-xs font-bold uppercase tracking-wider mb-6">
                        <Crown size={14} className="text-yellow-500" /> {t.heroTag}
                    </div>
                    <h1 className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-6 leading-[1.15]">
                        {t.heroTitle} <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
                            {t.heroTitleHighlight}
                        </span>
                    </h1>
                    <p className="text-gray-600 text-base sm:text-lg max-w-2xl mx-auto">{t.heroDesc}</p>
                </div>
            </section>

            {/* Free vs Pro Cards */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
                <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
                    {/* Free Card */}
                    <div className="rounded-3xl border-2 border-gray-200 p-8 sm:p-10 bg-white hover:shadow-lg transition-all duration-300">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold uppercase tracking-wider mb-4">
                            {t.freeBadge}
                        </div>
                        <h3 className="text-2xl font-extrabold text-gray-900 mb-1">{t.freeTitle}</h3>
                        <div className="flex items-baseline gap-1 mb-3">
                            <span className="text-4xl font-black text-gray-900">{t.freePrice}</span>
                        </div>
                        <p className="text-gray-500 text-sm mb-6">{t.freeDesc}</p>
                        <button
                            onClick={onLogin}
                            className="w-full py-3.5 bg-gray-100 text-gray-800 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                        >
                            {t.startFree}
                        </button>
                    </div>

                    {/* Pro Card */}
                    <div className="rounded-3xl border-2 border-indigo-500 p-8 sm:p-10 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 shadow-xl shadow-indigo-100/50 relative overflow-hidden hover:shadow-2xl transition-all duration-300">
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-200/30 rounded-full"></div>
                        <div className="absolute right-8 top-16 w-12 h-12 bg-purple-200/20 rounded-full"></div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold uppercase tracking-wider mb-4">
                            <Star size={12} fill="currentColor" /> {t.proBadge}
                        </div>
                        <h3 className="text-2xl font-extrabold text-gray-900 mb-1">{t.proTitle}</h3>
                        <div className="flex items-baseline gap-1 mb-1">
                            <span className="text-4xl font-black text-indigo-700">{formatPrice(SUBSCRIPTION_PLANS[0].monthly_price)}</span>
                            <span className="text-sm text-gray-500 font-medium">{t.perMonth}</span>
                        </div>
                        <p className="text-gray-500 text-sm mb-6">{t.proDesc}</p>
                        <button
                            onClick={onLogin}
                            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                            <Sparkles size={16} /> {t.upgradePro}
                        </button>
                    </div>
                </div>
            </section>

            {/* Visual Comparison Grid */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100/50 shadow-sm text-indigo-600 text-xs font-bold uppercase tracking-wider mb-4">
                        <Sparkles size={14} className="text-yellow-500 fill-yellow-500" />
                        {lang === 'vi' ? 'So sánh trực quan' : lang === 'ko' ? '비주얼 비교' : 'Visual Comparison'}
                    </div>
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
                        {lang === 'vi' ? 'Sức mạnh vượt trội khi nâng cấp Pro' : lang === 'ko' ? '프로 업그레이드의 강력한 혜택' : 'Superpowers with Pro Upgrade'}
                    </h2>
                    <p className="text-gray-600 text-base sm:text-lg max-w-2xl mx-auto">
                        {lang === 'vi' ? 'Khám phá sự khác biệt rõ rệt giữa bản trải nghiệm miễn phí và phiên bản Pro cao cấp.' : lang === 'ko' ? '무료 체험판과 프리미엄 프로 버전의 차이를 한눈에 확인하세요.' : 'Explore the clear differences between the free trial and the premium Pro version.'}
                    </p>
                </div>

                {/* Scroll Indicator Cue */}
                <div className="flex items-center justify-center gap-1.5 mb-6 text-xs text-indigo-500 font-bold uppercase tracking-wider animate-pulse-subtle">
                    <span>{lang === 'vi' ? 'Kéo ngang để xem thêm' : lang === 'ko' ? '드래그하여 더보기' : 'Swipe/Scroll to view details'}</span>
                    <ArrowRight size={14} className="animate-bounce-subtle text-indigo-500" />
                </div>

                <div className="flex overflow-x-auto gap-6 pb-8 snap-x snap-mandatory scrollbar-thin px-4 -mx-4 sm:px-0 sm:mx-0 scroll-smooth">
                    {visualShowcaseFeatures.map((item, index) => (
                        <div key={index} className="flex-none w-[280px] xs:w-[310px] sm:w-[330px] snap-center group rounded-3xl bg-white border border-gray-100 shadow-[0_4px_25px_rgba(0,0,0,0.03)] p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-full -mr-5 -mt-5"></div>

                            <div>
                                <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                                    {item.icon}
                                </div>
                                <h3 className="text-base font-extrabold text-gray-900 mb-1.5">{item.title}</h3>
                                <p className="text-xs text-gray-500 leading-relaxed mb-4">{item.desc}</p>
                            </div>

                            <div className="space-y-2.5 bg-gray-50/80 rounded-2xl p-4 border border-gray-100/50">
                                {/* Free comparison */}
                                <div className="flex items-start justify-between gap-3 text-xs">
                                    <span className="font-bold text-gray-400 uppercase tracking-wider shrink-0 w-12 pt-0.5">Free:</span>
                                    <div className="flex-1 text-right font-semibold text-gray-600 flex items-center justify-end gap-1.5">
                                        {item.freeIcon}
                                        <span>{item.freeText}</span>
                                    </div>
                                </div>
                                {/* Divider line */}
                                <div className="border-t border-gray-200/50"></div>
                                {/* Pro comparison */}
                                <div className="flex items-start justify-between gap-3 text-xs">
                                    <span className="font-extrabold text-indigo-500 uppercase tracking-wider shrink-0 w-12 pt-0.5">Pro:</span>
                                    <div className="flex-1 text-right font-bold text-indigo-700 flex items-center justify-end gap-1.5 bg-indigo-50/50 px-2.5 py-1 rounded-xl border border-indigo-100/30">
                                        {item.proIcon}
                                        <span>{item.proText}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Comparison Table */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
                <div className="text-center mb-10">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">{t.compareTitle}</h2>
                    <p className="text-gray-600 text-base sm:text-lg">{t.compareDesc}</p>
                </div>

                <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    {/* Table Header */}
                    <div className="grid grid-cols-[1fr_100px_100px] sm:grid-cols-[1fr_140px_140px] bg-gray-50 border-b border-gray-200 px-4 sm:px-6 py-4">
                        <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">{t.feature}</span>
                        <span className="text-sm font-bold text-gray-500 uppercase tracking-wider text-center">{t.free}</span>
                        <span className="text-sm font-bold text-indigo-600 uppercase tracking-wider text-center flex items-center justify-center gap-1">
                            <Crown size={14} className="text-yellow-500" /> {t.pro}
                        </span>
                    </div>
                    {/* Table Rows */}
                    {t.comparisonFeatures.map((feat: any, i: number) => (
                        <div key={i} className={`grid grid-cols-[1fr_100px_100px] sm:grid-cols-[1fr_140px_140px] px-4 sm:px-6 py-3.5 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} border-b border-gray-100 last:border-b-0`}>
                            <span className="text-sm font-medium text-gray-800">{feat.name}</span>
                            <div className="flex items-center justify-center">
                                {feat.free === true ? (
                                    <CheckCircle2 size={18} className="text-green-500" />
                                ) : feat.free === false ? (
                                    <X size={18} className="text-gray-300" />
                                ) : (
                                    <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{feat.free}</span>
                                )}
                            </div>
                            <div className="flex items-center justify-center">
                                {feat.pro === true ? (
                                    <CheckCircle2 size={18} className="text-indigo-500" />
                                ) : (
                                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">{feat.pro}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Plan Duration Selection */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
                <div className="text-center mb-10">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">{t.planSelectTitle}</h2>
                    <p className="text-gray-600 text-base sm:text-lg">{t.planSelectDesc}</p>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                    {regularPlans.map(plan => (
                        <div
                            key={plan.id}
                            className="relative p-5 sm:p-6 rounded-2xl border-2 border-gray-200 bg-white hover:border-indigo-300 hover:shadow-lg transition-all duration-300 group cursor-pointer"
                            onClick={onLogin}
                        >
                            {plan.is_popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 whitespace-nowrap">
                                    <Star size={10} fill="currentColor" /> {t.popular}
                                </div>
                            )}
                            <div className="text-2xl mb-2">{plan.emoji}</div>
                            <div className="text-sm font-bold text-gray-800 mb-0.5">{plan.label}</div>
                            <div className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full inline-block mb-3 border border-indigo-100">
                                {getPlanDurationLabel(plan.id, lang)}
                            </div>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-2xl font-black text-gray-900">{formatPrice(plan.price)}</span>
                            </div>
                            {plan.original_price && plan.original_price > plan.price && (
                                <div className="text-xs text-gray-400 line-through mt-0.5">{formatPrice(plan.original_price)}</div>
                            )}
                            <div className="text-[11px] text-gray-500 mt-1.5">~{formatPrice(plan.monthly_price)}{t.perMonth}</div>
                            {plan.save_percent > 0 ? (
                                <div className="mt-2 inline-block text-[10px] font-bold text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full">
                                    {t.saveLabel} {plan.save_percent}%
                                </div>
                            ) : (
                                <div className="mt-2 inline-block text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                                    {t.basicLabel}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Best Value Plan */}
                {bestValuePlan && (
                    <div
                        className="relative mt-6 p-6 sm:p-8 rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden"
                        onClick={onLogin}
                    >
                        <div className="absolute -top-0 right-0 bg-gradient-to-l from-emerald-500 to-teal-500 text-white text-[11px] font-bold px-5 py-1.5 rounded-bl-xl flex items-center gap-1">
                            <Award size={14} fill="currentColor" /> {t.bestValue}
                        </div>
                        <div className="flex flex-col sm:flex-row items-start gap-5">
                            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg shadow-emerald-200 shrink-0">
                                🎓
                            </div>
                            <div className="flex-1">
                                <div className="text-lg font-black text-gray-900 flex items-center gap-2 flex-wrap">
                                    {bestValuePlan.label}
                                    <span className="text-[11px] font-bold bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full">
                                        {getPlanDurationLabel(bestValuePlan.id, lang)}
                                    </span>
                                </div>
                                <div className="flex items-baseline gap-2.5 mt-2">
                                    <span className="text-3xl font-black text-emerald-700">{formatPrice(bestValuePlan.price)}</span>
                                    <span className="text-sm text-gray-400 line-through">{formatPrice(bestValuePlan.original_price || 0)}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                                        ~{formatPrice(bestValuePlan.monthly_price)}{t.perMonth}
                                    </span>
                                    <span className="text-[11px] font-bold text-orange-600 bg-orange-100 px-2.5 py-0.5 rounded-full">
                                        🔥 {t.saveLabel} {bestValuePlan.save_percent}%
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-2.5 leading-relaxed">💡 {t.bestValueDesc}</p>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* FAQ */}
            <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
                <div className="text-center mb-10">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">{t.faqTitle}</h2>
                </div>
                <div className="space-y-3">
                    {t.faqItems.map((item: any, i: number) => (
                        <div key={i} className="rounded-2xl border border-gray-200 bg-white overflow-hidden hover:shadow-sm transition-all">
                            <button
                                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                className="w-full px-6 py-4 flex items-center justify-between text-left"
                            >
                                <span className="text-sm font-bold text-gray-800 pr-4">{item.q}</span>
                                <ChevronDown size={18} className={`text-gray-400 shrink-0 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`} />
                            </button>
                            <div className={`px-6 overflow-hidden transition-all duration-300 ${openFaq === i ? 'pb-4 max-h-40' : 'max-h-0'}`}>
                                <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="max-w-4xl mx-4 sm:mx-6 lg:mx-8 xl:mx-auto px-4 sm:px-8 lg:px-12 pb-20">
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 px-8 sm:px-12 py-12 sm:py-16 text-center text-white">
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full"></div>
                    <div className="absolute -left-6 -bottom-6 w-32 h-32 bg-white/5 rounded-full"></div>
                    <div className="relative z-10">
                        <h2 className="text-2xl sm:text-3xl font-extrabold mb-4">{t.ctaTitle}</h2>
                        <p className="text-white/80 text-base sm:text-lg mb-8 max-w-lg mx-auto">{t.ctaDesc}</p>
                        <button
                            onClick={onLogin}
                            className="px-8 py-3.5 bg-white text-gray-900 rounded-full font-bold text-sm hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 flex items-center gap-2 mx-auto"
                        >
                            <Zap size={18} className="text-yellow-500" /> {t.ctaBtn}
                        </button>
                    </div>
                </div>
            </section>

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

export default PricingPage;
