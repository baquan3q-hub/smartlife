import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
    Brain, GraduationCap, FileText, Wallet, Flame, LockKeyhole, Check, Minus, Plus, Sparkles, type LucideIcon
} from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '../../../services/subscriptionService';
import { Lang } from '../../../i18n/i18n';
import { SiteShell } from '../SiteShell';
import { PageHero } from '../sections/PageHero';
import { DarkCTA, CTAButton } from '../sections/FinalCTA';
import { Reveal, Stagger, StaggerItem, EASE } from '../motion/Reveal';
import { TiltCard } from '../motion/TiltCard';
import { MagneticButton } from '../motion/MagneticButton';

interface PricingPageProps {
    onLogin: () => void;
    onNavigate: (page: string) => void;
    lang: Lang;
    setLang: (lang: Lang) => void;
}

type Cell = boolean | string;

const translations = {
    vi: {
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
        total: 'Tổng',
        compareTitle: 'So sánh chi tiết',
        compareDesc: 'Tất cả những gì bạn nhận được khi nâng cấp.',
        feature: 'Tính năng',
        free: 'Free',
        pro: 'Pro',
        planSelectTitle: 'Chọn gói thời hạn',
        planSelectDesc: 'Đầu tư cho bản thân — chi phí chỉ bằng 1 ly trà đá/tháng.',
        saveLabel: 'Tiết kiệm',
        popular: 'Phổ biến',
        bestValue: 'Best value',
        bestValueDesc: 'Rẻ hơn 1 ly trà đá/tháng! Chỉ hơn gói 1 năm có 100k — đủ dùng cả 4 năm đại học.',
        showcaseTag: 'So sánh trực quan',
        showcaseTitle: 'Sức mạnh vượt trội khi nâng cấp Pro',
        showcaseDesc: 'Khám phá sự khác biệt rõ rệt giữa bản trải nghiệm miễn phí và phiên bản Pro cao cấp.',
        faqTitle: 'Câu hỏi thường gặp',
        faqItems: [
            { q: 'Tôi có thể dùng thử miễn phí không?', a: 'Có! Mỗi tài khoản mới đều được 7 ngày dùng thử miễn phí với đầy đủ tính năng Pro.' },
            { q: 'Thanh toán bằng cách nào?', a: 'Thanh toán qua chuyển khoản ngân hàng (Vietcombank). Sau khi chọn gói, bạn sẽ nhận được mã chuyển khoản và thông tin tài khoản.' },
            { q: 'Có được hoàn tiền không?', a: 'Hiện tại chúng tôi không hỗ trợ hoàn tiền. Hãy tận dụng 7 ngày dùng thử để trải nghiệm trước khi quyết định.' },
            { q: 'Nếu tôi đã là Pro, mua thêm gói mới thì sao?', a: 'Thời hạn Pro mới sẽ được cộng dồn từ ngày hết hạn hiện tại, không bị mất ngày nào.' }
        ],
        ctaTitle: 'Bắt đầu miễn phí ngay hôm nay',
        ctaDesc: '7 ngày trải nghiệm đầy đủ. Không cần thẻ tín dụng.',
        ctaBtn: 'Đăng ký miễn phí',
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
            { name: 'Đếm ngược & Đếm tiến', free: '3 sự kiện', pro: 'Không giới hạn' }
        ] as { name: string; free: Cell; pro: Cell }[]
    },
    en: {
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
        total: 'Total',
        compareTitle: 'Detailed Comparison',
        compareDesc: 'Everything you get when upgrading.',
        feature: 'Feature',
        free: 'Free',
        pro: 'Pro',
        planSelectTitle: 'Choose your plan duration',
        planSelectDesc: 'Invest in yourself — costs less than a cup of coffee a month.',
        saveLabel: 'Save',
        popular: 'Popular',
        bestValue: 'Best value',
        bestValueDesc: 'Less than a cup of tea/month! Only 100k more than the 1-year plan — enough for all 4 years of college.',
        showcaseTag: 'Visual Comparison',
        showcaseTitle: 'Superpowers with Pro Upgrade',
        showcaseDesc: 'Explore the clear differences between the free trial and the premium Pro version.',
        faqTitle: 'Frequently Asked Questions',
        faqItems: [
            { q: 'Can I try it for free?', a: 'Yes! Every new account gets a 7-day free trial with full Pro features.' },
            { q: 'How do I pay?', a: "Payment via bank transfer (Vietcombank). After selecting a plan, you'll receive a transfer code and account information." },
            { q: 'Can I get a refund?', a: "Currently we don't support refunds. Please use the 7-day trial to experience before deciding." },
            { q: "What if I'm already Pro and buy another plan?", a: 'The new Pro duration will be added from your current expiry date — no days lost.' }
        ],
        ctaTitle: 'Start free today',
        ctaDesc: '7 days full experience. No credit card required.',
        ctaBtn: 'Sign up for free',
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
            { name: 'Countdown & Count-up', free: '3 events', pro: 'Unlimited' }
        ] as { name: string; free: Cell; pro: Cell }[]
    },
    ko: {
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
        total: '합계',
        compareTitle: '상세 비교',
        compareDesc: '업그레이드 시 받을 수 있는 모든 것.',
        feature: '기능',
        free: '무료',
        pro: 'Pro',
        planSelectTitle: '플랜 기간 선택',
        planSelectDesc: '자신에게 투자하세요 — 한 달에 커피 한 잔 가격.',
        saveLabel: '절약',
        popular: '인기',
        bestValue: '최고 가치',
        bestValueDesc: '한 달에 차 한 잔보다 저렴! 1년 플랜보다 100k만 더 — 대학 4년 내내 사용 가능.',
        showcaseTag: '비주얼 비교',
        showcaseTitle: '프로 업그레이드의 강력한 혜택',
        showcaseDesc: '무료 체험판과 프리미엄 프로 버전의 차이를 한눈에 확인하세요.',
        faqTitle: '자주 묻는 질문',
        faqItems: [
            { q: '무료로 사용할 수 있나요?', a: '네! 모든 신규 계정은 모든 Pro 기능을 포함한 7일 무료 체험을 제공합니다.' },
            { q: '어떻게 결제하나요?', a: '은행 이체(Vietcombank)로 결제합니다. 플랜 선택 후 이체 코드와 계좌 정보를 받으실 수 있습니다.' },
            { q: '환불 가능한가요?', a: '현재 환불은 지원하지 않습니다. 결정하기 전에 7일 체험을 이용해주세요.' },
            { q: '이미 Pro인데 다른 플랜을 구매하면?', a: '새 Pro 기간은 현재 만료일부터 추가됩니다 — 손실 없음.' }
        ],
        ctaTitle: '오늘 무료로 시작하세요',
        ctaDesc: '7일간 완전한 경험. 신용카드 불필요.',
        ctaBtn: '무료로 가입하기',
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
            { name: '카운트다운/업', free: '3건', pro: '무제한' }
        ] as { name: string; free: Cell; pro: Cell }[]
    }
};

// [vi, en, ko]
type L3 = [string, string, string];

const showcase: { icon: LucideIcon; title: L3; desc: L3; free: L3; pro: L3; freeOff?: boolean }[] = [
    {
        icon: Brain,
        title: ['AI Trợ lý Cá nhân', 'AI Personal Advisor', '나만의 AI 비서'],
        desc: [
            'Trợ lý thông minh phân tích chi tiêu, gợi ý lịch trình, đọc hiểu tài liệu, hình ảnh & audio.',
            'Smart assistant that analyzes spending, suggests schedules, and understands docs, images & audio.',
            '지출 내역 분석, 일정 추천, 문서/이미지/오디오 이해를 제공하는 맞춤형 AI 비서.'
        ],
        free: ['10 tin/ngày (Chỉ text)', '10 msgs/day (Text only)', '일 10건 (텍스트만)'],
        pro: ['600.000 token/tháng + Đọc file, ảnh, audio', '600k tokens/mo + Files, images, audio analysis', '월 600,000 토큰 + 파일/이미지/오디오 분석']
    },
    {
        icon: GraduationCap,
        title: ['Cố vấn Sự nghiệp & GPA', 'AI Career Advisor & GPA', 'AI 진로 네비게이터 & GPA'],
        desc: [
            'Phân tích GPA học tập học kỳ, kết hợp tính cách MBTI/DISC để đề xuất lộ trình thăng tiến.',
            'Analyzes semester GPA and MBTI/DISC personality to suggest detailed career roadmaps.',
            '학기별 GPA 성적과 MBTI/DISC 성격을 분석하여 상세한 커리어 로드맵 추천.'
        ],
        free: ['Không hỗ trợ', 'Not supported', '지원 안 함'],
        pro: ['AI Advisor & GPA Tracker nâng cao toàn diện', 'Full AI Advisor & Advanced GPA Tracker', 'AI 진로 분석기 & 고급 GPA 트래커 전체 기능 제공'],
        freeOff: true
    },
    {
        icon: FileText,
        title: ['CV Builder tự động', 'Auto CV Builder & Export', '자동 이력서 빌더'],
        desc: [
            'Tự động điền thông tin từ GPA Tracker và Goals của bạn, xuất tệp PDF in ấn chuẩn A4.',
            'Auto-fills academic data from GPA & Goals, exporting professional A4 PDFs.',
            'GPA 트래커 및 목표 데이터에서 학업 정보를 자동 추출하여 A4 규격 PDF로 저장.'
        ],
        free: ['Trải nghiệm (Phải gia hạn sau mỗi 7 ngày)', 'Trial (Requires renewal every 7 days)', '체험판 (7일마다 갱신 필요)'],
        pro: ['Sử dụng vĩnh viễn + Xuất PDF không giới hạn', 'Permanent use + Unlimited PDF exports', '영구 사용 + PDF 무제한 내보내기']
    },
    {
        icon: Wallet,
        title: ['Tài chính & Ví & Sổ nợ', 'Finance, Wallets & Debts', '자산 관리 & 지갑 & 채무'],
        desc: [
            'Quản lý nhiều ví/quỹ, dòng tiền thông minh Cashflow, ghi nợ & tự động khấu trừ nợ thực tế.',
            'Manage multiple wallets/funds, smart Cashflow, and debt ledgers with auto-deduction.',
            '다중 자산 지갑 관리, 현금흐름 분석 및 실시간 연동 채무 관리.'
        ],
        free: ['Ví & Ghi chép thu chi cơ bản', 'Basic wallets & income/expense logging', '기본 자산 지갑 및 수입/지출 내역 기록'],
        pro: ['Cashflow dòng tiền & Sổ nợ khấu trừ tự động', 'Advanced Cashflow & Auto debt ledger link', '현금흐름 분석 & 채무 실시간 자동 차감']
    },
    {
        icon: Flame,
        title: ['Thói quen & Sự kiện & StarBrain', 'Habits, Countdown & StarBrain', '습관 관리 & D-day & 스타브레인'],
        desc: [
            'Thiết lập chuỗi thói quen (Streak), đếm ngược/tiến ngày lễ kỷ niệm, thưởng sao StarBrain.',
            'Build streaks for habits, countdown/up for events, and earn StarBrain rewards.',
            '스트릭 습관 관리, D-day 디데이 카운트다운/업 및 스타브레인 별점 적립.'
        ],
        free: ['Tối đa 3 thói quen & 3 sự kiện', 'Max 3 habits & 3 events', '습관 최대 3개 및 디데이 최대 3개'],
        pro: ['Không giới hạn + Tích lũy StarBrain Pro', 'Unlimited tracker + Pro StarBrain rewards', '무제한 설정 + StarBrain 적립 혜택']
    },
    {
        icon: LockKeyhole,
        title: ['Kho lưu trữ đám mây bảo mật', 'Secure Cloud Storage', '보안 클라우드 저장소'],
        desc: [
            'Lưu trữ ghi chú đa phương tiện, tệp tin, hình ảnh riêng tư và bảo mật tuyệt đối.',
            'Store rich text notes, private files, and images securely with encryption.',
            '보안 암호화로 보호되는 멀티미디어 노트, 파일, 이미지 보관함.'
        ],
        free: ['Dung lượng tối đa 50MB', '50MB capacity limit', '최대 용량 50MB 제한'],
        pro: ['Dung lượng 500MB bảo mật tối đa', 'Expanded 500MB secure storage space', '용량 500MB 보안 저장소 제공']
    }
];

const LANG_INDEX: Record<Lang, 0 | 1 | 2> = { vi: 0, en: 1, ko: 2 };

const DURATION: Record<string, L3> = {
    '1_month': ['1 tháng', '1 month', '1개월'],
    '3_months': ['3 tháng', '3 months', '3개월'],
    '6_months': ['6 tháng', '6 months', '6개월'],
    '12_months': ['12 tháng', '12 months', '12개월'],
    '4_years': ['48 tháng (4 năm)', '48 months (4 years)', '48개월 (4년)']
};

const formatPrice = (price: number) => new Intl.NumberFormat('vi-VN').format(price) + 'đ';

const CellValue: React.FC<{ value: Cell; pro?: boolean }> = ({ value, pro }) => {
    if (value === true)
        return (
            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${pro ? 'bg-sky-50 text-[var(--l-accent)]' : 'bg-zinc-100 text-zinc-600'}`}>
                <Check size={14} strokeWidth={2.5} />
            </span>
        );
    if (value === false) return <Minus size={16} className="mx-auto text-zinc-300" />;
    return <span className={`text-[13px] ${pro ? 'font-medium text-zinc-950' : 'text-zinc-500'}`}>{value}</span>;
};

const PricingPage: React.FC<PricingPageProps> = ({ onLogin, onNavigate, lang, setLang }) => {
    const t = translations[lang];
    const li = LANG_INDEX[lang];
    const regularPlans = SUBSCRIPTION_PLANS.filter((p) => !p.is_best_value);
    const bestValuePlan = SUBSCRIPTION_PLANS.find((p) => p.is_best_value);
    const [planId, setPlanId] = useState(() => (regularPlans.find((p) => p.is_popular) ?? regularPlans[0]).id);
    const [openFaq, setOpenFaq] = useState<number | null>(0);
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId) ?? SUBSCRIPTION_PLANS[0];

    return (
        <SiteShell page="pricing" lang={lang} setLang={setLang} onLogin={onLogin} onNavigate={onNavigate}>
            {() => (
                <>
                    <PageHero eyebrow={t.heroTag} title1={t.heroTitle} title2={t.heroTitleHighlight} desc={t.heroDesc} />

                    {/* Free vs Pro */}
                    <section className="px-4 pb-20 sm:px-6 sm:pb-28">
                        <Stagger className="mx-auto grid max-w-5xl gap-5 md:grid-cols-[1fr_1.25fr]">
                            <StaggerItem>
                                <div className="flex h-full flex-col rounded-[24px] border border-zinc-900/[0.08] bg-white p-7 sm:p-9">
                                    <span className="w-fit rounded-full border border-zinc-900/[0.08] px-3 py-1 text-xs font-medium text-zinc-600">{t.freeBadge}</span>
                                    <h3 className="mt-6 text-lg font-semibold text-zinc-950">{t.freeTitle}</h3>
                                    <p className="mt-2 text-[48px] font-semibold leading-none tracking-tight text-zinc-950">{t.freePrice}</p>
                                    <p className="mt-4 text-[15px] leading-6 text-zinc-600">{t.freeDesc}</p>
                                    <ul className="mb-8 mt-6 space-y-2.5 text-[14px] text-zinc-600">
                                        {t.comparisonFeatures.filter((f) => f.free !== false).slice(0, 6).map((f) => (
                                            <li key={f.name} className="flex items-start gap-2.5">
                                                <Check size={16} className="mt-0.5 shrink-0 text-zinc-400" />
                                                <span>
                                                    {f.name}
                                                    {typeof f.free === 'string' && <span className="text-zinc-400"> · {f.free}</span>}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                    <button
                                        type="button"
                                        onClick={onLogin}
                                        className="mt-auto flex h-12 w-full items-center justify-center rounded-full border border-zinc-900/10 text-[15px] font-medium text-zinc-950 transition-colors hover:bg-zinc-50"
                                    >
                                        {t.startFree}
                                    </button>
                                </div>
                            </StaggerItem>

                            <StaggerItem>
                                <div className="relative flex h-full flex-col overflow-hidden rounded-[24px] bg-zinc-950 p-7 text-white sm:p-9">
                                    <div
                                        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl"
                                        style={{ background: 'radial-gradient(closest-side, rgba(2,132,199,0.45), transparent)' }}
                                        aria-hidden
                                    />
                                    <div
                                        className="pointer-events-none absolute inset-0 opacity-50"
                                        style={{
                                            backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
                                            backgroundSize: '20px 20px',
                                            maskImage: 'radial-gradient(ellipse 70% 60% at 100% 0%, #000, transparent 70%)'
                                        }}
                                        aria-hidden
                                    />
                                    <div className="relative flex h-full flex-col">
                                        <span className="flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-sky-200">
                                            <Sparkles size={12} /> {t.proBadge}
                                        </span>
                                        <div className="mt-6 flex items-baseline justify-between gap-4">
                                            <h3 className="text-lg font-semibold">{t.proTitle}</h3>
                                            <span className="text-sm text-zinc-400">{DURATION[plan.id]?.[li]}</span>
                                        </div>
                                        <div className="mt-2 flex items-baseline gap-1.5">
                                            <motion.span
                                                key={plan.id}
                                                initial={{ y: 16, opacity: 0, filter: 'blur(6px)' }}
                                                animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                                                transition={{ duration: 0.45, ease: EASE }}
                                                className="text-[48px] font-semibold leading-none tracking-tight tabular-nums"
                                            >
                                                {formatPrice(plan.monthly_price)}
                                            </motion.span>
                                            <span className="text-sm text-zinc-400">{t.perMonth}</span>
                                        </div>
                                        <p className="mt-3 h-5 text-sm text-zinc-400 tabular-nums">
                                            {t.total} {formatPrice(plan.price)}
                                            {plan.save_percent > 0 && (
                                                <>
                                                    <span className="mx-1.5 line-through opacity-60">{formatPrice(plan.original_price)}</span>
                                                    <span className="text-emerald-400">−{plan.save_percent}%</span>
                                                </>
                                            )}
                                        </p>
                                        <p className="mt-4 text-[15px] leading-6 text-zinc-300">{t.proDesc}</p>

                                        <p className="mt-7 text-xs font-medium uppercase tracking-wider text-zinc-500">{t.planSelectTitle}</p>
                                        <div role="radiogroup" aria-label={t.planSelectTitle} className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-white/[0.06] p-1 xs:grid-cols-3 sm:grid-cols-5">
                                            {SUBSCRIPTION_PLANS.map((p) => {
                                                const active = p.id === planId;
                                                return (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={active}
                                                        onClick={() => setPlanId(p.id)}
                                                        className={`relative h-11 rounded-xl text-[13px] font-medium transition-colors ${active ? 'text-zinc-950' : 'text-zinc-400 hover:text-white'}`}
                                                    >
                                                        {active && (
                                                            <motion.span
                                                                layoutId="plan-pill"
                                                                className="absolute inset-0 rounded-xl bg-white"
                                                                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                                                            />
                                                        )}
                                                        <span className="relative">{DURATION[p.id]?.[li].split(' (')[0]}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <MagneticButton
                                            onClick={onLogin}
                                            className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[15px] font-medium text-zinc-950 transition-colors hover:bg-zinc-100"
                                        >
                                            <Sparkles size={16} /> {t.upgradePro}
                                        </MagneticButton>
                                    </div>
                                </div>
                            </StaggerItem>
                        </Stagger>
                    </section>

                    {/* Duration plans */}
                    <section className="border-t border-zinc-900/[0.06] px-4 py-20 sm:px-6 sm:py-28">
                        <div className="mx-auto max-w-6xl">
                            <Reveal className="mx-auto max-w-2xl text-center">
                                <h2 className="l-h2 text-zinc-950">{t.planSelectTitle}</h2>
                                <p className="mt-4 text-[17px] leading-7 text-zinc-600">{t.planSelectDesc}</p>
                            </Reveal>
                            <Stagger className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                {regularPlans.map((p) => (
                                    <StaggerItem key={p.id}>
                                        <TiltCard
                                            max={4}
                                            className={`group relative h-full overflow-hidden rounded-[20px] border bg-white p-6 transition-shadow duration-500 hover:shadow-[0_30px_60px_-30px_rgba(9,9,11,0.3)] ${p.is_popular ? 'border-sky-300 ring-4 ring-sky-100' : 'border-zinc-900/[0.08]'}`}
                                        >
                                            <div className="l-spotlight pointer-events-none absolute inset-0" />
                                            <button type="button" onClick={onLogin} className="relative flex h-full w-full flex-col text-left">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium text-zinc-500">{DURATION[p.id]?.[li]}</span>
                                                    {p.is_popular ? (
                                                        <span className="rounded-full bg-[var(--l-accent)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">{t.popular}</span>
                                                    ) : p.save_percent > 0 ? (
                                                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                                                            {t.saveLabel} {p.save_percent}%
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <p className="mt-1 text-lg font-semibold text-zinc-950">{p.label}</p>
                                                <p className="mt-6 text-[32px] font-semibold leading-none tracking-tight text-zinc-950 tabular-nums">{formatPrice(p.price)}</p>
                                                <p className="mt-2 h-5 text-sm text-zinc-400 tabular-nums">
                                                    {p.original_price > p.price && <span className="line-through">{formatPrice(p.original_price)}</span>}
                                                </p>
                                                <p className="mt-auto pt-6 text-sm text-zinc-600 tabular-nums">
                                                    ≈ {formatPrice(p.monthly_price)}
                                                    {t.perMonth}
                                                </p>
                                            </button>
                                        </TiltCard>
                                    </StaggerItem>
                                ))}
                            </Stagger>

                            {bestValuePlan && (
                                <Reveal className="mt-4">
                                    <button
                                        type="button"
                                        onClick={onLogin}
                                        className="group relative flex w-full flex-col gap-6 overflow-hidden rounded-[24px] bg-zinc-950 p-7 text-left text-white sm:p-9 md:flex-row md:items-center md:justify-between"
                                    >
                                        <div
                                            className="pointer-events-none absolute -left-20 -top-28 h-72 w-[520px] rounded-full blur-3xl transition-opacity duration-500 group-hover:opacity-100 opacity-70"
                                            style={{ background: 'radial-gradient(closest-side, rgba(2,132,199,0.4), transparent)' }}
                                            aria-hidden
                                        />
                                        <div className="relative max-w-xl">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-950">{t.bestValue}</span>
                                                <span className="text-sm text-zinc-400">{DURATION[bestValuePlan.id]?.[li]}</span>
                                            </div>
                                            <p className="mt-3 text-2xl font-semibold tracking-tight">{bestValuePlan.label}</p>
                                            <p className="mt-2 text-[15px] leading-6 text-zinc-400">{t.bestValueDesc}</p>
                                        </div>
                                        <div className="relative shrink-0 md:text-right">
                                            <p className="text-sm text-zinc-500 line-through tabular-nums">{formatPrice(bestValuePlan.original_price)}</p>
                                            <p className="text-[40px] font-semibold leading-none tracking-tight tabular-nums">{formatPrice(bestValuePlan.price)}</p>
                                            <p className="mt-2 text-sm text-emerald-400 tabular-nums">
                                                ≈ {formatPrice(bestValuePlan.monthly_price)}
                                                {t.perMonth} · −{bestValuePlan.save_percent}%
                                            </p>
                                        </div>
                                    </button>
                                </Reveal>
                            )}
                        </div>
                    </section>

                    {/* Free vs Pro showcase */}
                    <section className="border-t border-zinc-900/[0.06] px-4 py-20 sm:px-6 sm:py-28">
                        <div className="mx-auto max-w-6xl">
                            <Reveal className="mx-auto max-w-2xl text-center">
                                <p className="l-eyebrow mb-4">{t.showcaseTag}</p>
                                <h2 className="l-h2 text-zinc-950">{t.showcaseTitle}</h2>
                                <p className="mt-4 text-[17px] leading-7 text-zinc-600">{t.showcaseDesc}</p>
                            </Reveal>
                            <Stagger className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {showcase.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <StaggerItem key={item.title[1]}>
                                            <TiltCard
                                                max={4}
                                                className="group relative flex h-full flex-col overflow-hidden rounded-[20px] border border-zinc-900/[0.08] bg-white p-6 transition-shadow duration-500 hover:shadow-[0_30px_60px_-30px_rgba(9,9,11,0.3)]"
                                            >
                                                <div className="l-spotlight pointer-events-none absolute inset-0" />
                                                <div className="relative flex h-full flex-col">
                                                    <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-900/[0.07] text-zinc-600 transition-colors duration-300 group-hover:border-sky-200 group-hover:text-[var(--l-accent)]">
                                                        <Icon size={18} />
                                                    </div>
                                                    <h3 className="l-h3 text-zinc-950">{item.title[li]}</h3>
                                                    <p className="mt-1.5 text-[15px] leading-6 text-zinc-600">{item.desc[li]}</p>
                                                    <div className="mt-auto space-y-2 pt-6">
                                                        <div className="flex items-start gap-3 rounded-xl bg-zinc-50 px-3.5 py-3 text-[13px] text-zinc-600">
                                                            <span className="w-8 shrink-0 font-medium text-zinc-400">{t.free}</span>
                                                            <span className={item.freeOff ? 'text-zinc-400 line-through' : ''}>{item.free[li]}</span>
                                                        </div>
                                                        <div className="flex items-start gap-3 rounded-xl bg-sky-50 px-3.5 py-3 text-[13px] text-zinc-900">
                                                            <span className="w-8 shrink-0 font-semibold text-[var(--l-accent)]">{t.pro}</span>
                                                            <span>{item.pro[li]}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </TiltCard>
                                        </StaggerItem>
                                    );
                                })}
                            </Stagger>
                        </div>
                    </section>

                    {/* Comparison table */}
                    <section className="border-t border-zinc-900/[0.06] px-4 py-20 sm:px-6 sm:py-28">
                        <div className="mx-auto max-w-4xl">
                            <Reveal className="text-center">
                                <h2 className="l-h2 text-zinc-950">{t.compareTitle}</h2>
                                <p className="mt-4 text-[17px] leading-7 text-zinc-600">{t.compareDesc}</p>
                            </Reveal>
                            <Reveal className="mt-12 overflow-hidden rounded-[20px] border border-zinc-900/[0.08] bg-white">
                                <table className="w-full table-fixed text-left">
                                    <thead>
                                        <tr className="border-b border-zinc-900/[0.06] text-[13px]">
                                            <th className="px-4 py-4 font-medium text-zinc-500 sm:px-6">{t.feature}</th>
                                            <th className="w-[26%] px-2 py-4 text-center font-medium text-zinc-500 sm:w-[24%]">{t.free}</th>
                                            <th className="w-[30%] bg-sky-50/60 px-2 py-4 text-center font-semibold text-[var(--l-accent)] sm:w-[26%]">{t.pro}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {t.comparisonFeatures.map((f) => (
                                            <tr key={f.name} className="border-b border-zinc-900/[0.05] transition-colors last:border-0 hover:bg-zinc-50/70">
                                                <td className="px-4 py-3.5 text-[14px] text-zinc-800 sm:px-6">{f.name}</td>
                                                <td className="px-2 py-3.5 text-center">
                                                    <CellValue value={f.free} />
                                                </td>
                                                <td className="bg-sky-50/60 px-2 py-3.5 text-center">
                                                    <CellValue value={f.pro} pro />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </Reveal>
                        </div>
                    </section>

                    {/* FAQ */}
                    <section className="border-t border-zinc-900/[0.06] px-4 py-20 sm:px-6 sm:py-28">
                        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-12">
                            <Reveal className="md:col-span-4">
                                <h2 className="l-h2 text-zinc-950">{t.faqTitle}</h2>
                            </Reveal>
                            <Stagger className="divide-y divide-zinc-900/[0.08] border-y border-zinc-900/[0.08] md:col-span-8">
                                {t.faqItems.map((item, i) => {
                                    const open = openFaq === i;
                                    return (
                                        <StaggerItem key={item.q}>
                                            <button
                                                type="button"
                                                aria-expanded={open}
                                                onClick={() => setOpenFaq(open ? null : i)}
                                                className="flex w-full items-center justify-between gap-6 py-5 text-left"
                                            >
                                                <span className="text-[17px] font-medium text-zinc-950">{item.q}</span>
                                                <motion.span
                                                    animate={{ rotate: open ? 45 : 0 }}
                                                    transition={{ duration: 0.3, ease: EASE }}
                                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-900/10 text-zinc-600"
                                                >
                                                    <Plus size={16} />
                                                </motion.span>
                                            </button>
                                            <AnimatePresence initial={false}>
                                                {open && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.4, ease: EASE }}
                                                        className="overflow-hidden"
                                                    >
                                                        <p className="max-w-2xl pb-6 text-[15px] leading-7 text-zinc-600">{item.a}</p>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </StaggerItem>
                                    );
                                })}
                            </Stagger>
                        </div>
                    </section>

                    <DarkCTA title={t.ctaTitle} desc={t.ctaDesc}>
                        <CTAButton onClick={onLogin}>{t.ctaBtn}</CTAButton>
                    </DarkCTA>
                </>
            )}
        </SiteShell>
    );
};

export default PricingPage;
