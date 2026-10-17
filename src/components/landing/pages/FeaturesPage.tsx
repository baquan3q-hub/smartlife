import React from 'react';
import {
    Brain, Wallet, CalendarDays, Music, FileText, Briefcase, LayoutDashboard, Flame, BookOpen, GraduationCap,
    Headphones, LockKeyhole, BarChart3, ArrowRightLeft, Rocket, Target, KanbanSquare, type LucideIcon
} from 'lucide-react';
import { Lang } from '../../../i18n/i18n';
import { SiteShell } from '../SiteShell';
import { PageHero } from '../sections/PageHero';
import { DarkCTA, CTAButton, ctaSecondary } from '../sections/FinalCTA';
import { Reveal, Stagger, StaggerItem } from '../motion/Reveal';
import { TiltCard } from '../motion/TiltCard';
import { ResponsiveImage, type Img } from '../motion/Media';
import { images } from '../media.gen';

interface FeaturesPageProps {
    onLogin: () => void;
    onNavigate: (page: string) => void;
    lang: Lang;
    setLang: (lang: Lang) => void;
}

type FeatureKey =
    | 'ai' | 'career' | 'cv' | 'finance' | 'cashflow' | 'wallets' | 'schedule' | 'kanban' | 'pomodoro'
    | 'habits' | 'goals' | 'gpa' | 'journal' | 'spotify' | 'focus' | 'storage' | 'visualboard';

const translations = {
    vi: {
        heroTag: 'Tất cả tính năng',
        heroTitle: 'Mọi thứ bạn cần,',
        heroTitleHighlight: 'trong một ứng dụng.',
        heroDesc: 'SmartLife tích hợp hơn 15+ tính năng thông minh giúp sinh viên quản lý cuộc sống hiệu quả — từ tài chính, lịch trình đến AI cá nhân hóa.',
        statFeatures: 'tính năng',
        statGroups: 'nhóm',
        statTrial: 'ngày dùng thử',
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
            visualboard: { title: 'Visual Board', desc: 'Tổng quan toàn cảnh lịch trình, mục tiêu và bức tranh tài chính.' }
        }
    },
    en: {
        heroTag: 'All Features',
        heroTitle: 'Everything you need,',
        heroTitleHighlight: 'in one single app.',
        heroDesc: 'SmartLife integrates 15+ smart features to help students manage life efficiently — from finance, scheduling to personalized AI.',
        statFeatures: 'features',
        statGroups: 'groups',
        statTrial: 'day free trial',
        cat1Title: 'AI & Smart Assistants',
        cat1Desc: 'AI intelligence personalized to your data and personality.',
        cat2Title: 'Finance & Management',
        cat2Desc: 'Comprehensive cash flow tracking, digital wallets, and smart debt ledger.',
        cat3Title: 'Productivity & Time',
        cat3Desc: 'Complete toolkit to optimize your study and work time.',
        cat4Title: 'Entertainment & Storage',
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
            visualboard: { title: 'Visual Board', desc: 'Holistic overview of schedules, goals and financial picture.' }
        }
    },
    ko: {
        heroTag: '전체 기능',
        heroTitle: '필요한 모든 것,',
        heroTitleHighlight: '하나의 앱으로.',
        heroDesc: 'SmartLife는 15개 이상의 스마트 기능을 통합하여 학생들의 효율적인 생활 관리를 돕습니다.',
        statFeatures: '기능',
        statGroups: '카테고리',
        statTrial: '일 무료 체험',
        cat1Title: 'AI & 스마트 어시스턴트',
        cat1Desc: '사용자 데이터와 성격에 맞춤화된 AI 지능.',
        cat2Title: '재정 & 관리',
        cat2Desc: '종합적인 현금 흐름 추적, 디지털 지갑 및 스마트 채무 관리.',
        cat3Title: '생산성 & 시간',
        cat3Desc: '학습과 업무 시간을 최적화하는 완벽한 도구 세트.',
        cat4Title: '엔터테인먼트 & 저장소',
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
            visualboard: { title: '비주얼 보드', desc: '일정, 목표, 재정 상태를 한눈에 보는 통합 대시보드.' }
        }
    }
};

interface Category {
    id: string;
    n: 1 | 2 | 3 | 4;
    cover: Img;
    items: [FeatureKey, LucideIcon][];
}

const categories: Category[] = [
    { id: 'cat-ai', n: 1, cover: images['story-ai'], items: [['ai', Brain], ['career', Briefcase], ['cv', FileText]] },
    { id: 'cat-finance', n: 2, cover: images['story-finance'], items: [['finance', Wallet], ['cashflow', BarChart3], ['wallets', ArrowRightLeft]] },
    {
        id: 'cat-productivity',
        n: 3,
        cover: images['story-kanban'],
        items: [['schedule', CalendarDays], ['kanban', KanbanSquare], ['pomodoro', Rocket], ['habits', Flame], ['goals', Target], ['gpa', GraduationCap]]
    },
    {
        id: 'cat-life',
        n: 4,
        cover: images['bento-journal'],
        items: [['journal', BookOpen], ['spotify', Music], ['focus', Headphones], ['storage', LockKeyhole], ['visualboard', LayoutDashboard]]
    }
];

const FEATURE_COUNT = categories.reduce((sum, cat) => sum + cat.items.length, 0);

const FeaturesPage: React.FC<FeaturesPageProps> = ({ onLogin, onNavigate, lang, setLang }) => {
    const t = translations[lang];
    const catTitle = (n: Category['n']) => t[`cat${n}Title`];
    const catDesc = (n: Category['n']) => t[`cat${n}Desc`];

    return (
        <SiteShell page="features" lang={lang} setLang={setLang} onLogin={onLogin} onNavigate={onNavigate}>
            {({ scrollTo }) => (
                <>
                    <PageHero eyebrow={t.heroTag} title1={t.heroTitle} title2={t.heroTitleHighlight} desc={t.heroDesc}>
                        <dl className="mx-auto mt-12 grid max-w-lg grid-cols-3 divide-x divide-zinc-900/[0.08] rounded-2xl border border-zinc-900/[0.08] bg-white/70 py-5 backdrop-blur">
                            {[
                                [FEATURE_COUNT, t.statFeatures],
                                [categories.length, t.statGroups],
                                [7, t.statTrial]
                            ].map(([value, label]) => (
                                <div key={label} className="px-3">
                                    <dt className="sr-only">{label}</dt>
                                    <dd className="text-[28px] font-semibold tracking-tight text-zinc-950 tabular-nums">{value}</dd>
                                    <dd className="mt-0.5 text-[13px] text-zinc-500">{label}</dd>
                                </div>
                            ))}
                        </dl>
                        <div className="mt-8 flex flex-wrap justify-center gap-2">
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => scrollTo(cat.id)}
                                    className="flex h-10 items-center gap-2 rounded-full border border-zinc-900/[0.08] bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-900/20 hover:text-zinc-950"
                                >
                                    <span className="tabular-nums text-zinc-400">0{cat.n}</span>
                                    {catTitle(cat.n)}
                                </button>
                            ))}
                        </div>
                    </PageHero>

                    {categories.map((cat) => (
                        <section key={cat.id} id={cat.id} className="border-t border-zinc-900/[0.06] py-20 sm:py-28">
                            <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-12 md:gap-12">
                                <div className="md:col-span-5">
                                    <Reveal className="md:sticky md:top-28">
                                        <p className="l-eyebrow mb-4 flex items-center gap-3">
                                            <span className="tabular-nums text-zinc-400">
                                                0{cat.n} / 0{categories.length}
                                            </span>
                                            <span className="h-px w-6 bg-zinc-300" />
                                            {cat.items.length} {t.statFeatures}
                                        </p>
                                        <h2 className="l-h2 text-zinc-950">{catTitle(cat.n)}</h2>
                                        <p className="mt-5 text-[17px] leading-7 text-zinc-600">{catDesc(cat.n)}</p>
                                        <div className="mt-8 overflow-hidden rounded-[20px] border border-zinc-900/[0.08] bg-white p-1.5 shadow-[0_30px_70px_-35px_rgba(9,9,11,0.35)]">
                                            <ResponsiveImage
                                                img={cat.cover}
                                                alt={catTitle(cat.n)}
                                                sizes="(min-width: 1152px) 440px, (min-width: 768px) 40vw, 100vw"
                                                className="h-auto w-full rounded-[14px]"
                                            />
                                        </div>
                                    </Reveal>
                                </div>

                                <Stagger className="grid content-start gap-4 sm:grid-cols-2 md:col-span-7">
                                    {cat.items.map(([key, Icon], i) => {
                                        const f = t.features[key];
                                        const wide = cat.items.length % 2 === 1 && i === 0;
                                        return (
                                            <StaggerItem key={key} className={wide ? 'sm:col-span-2' : ''}>
                                                <TiltCard
                                                    max={4}
                                                    className="group relative h-full overflow-hidden rounded-[20px] border border-zinc-900/[0.08] bg-white p-6 transition-shadow duration-500 hover:shadow-[0_30px_60px_-30px_rgba(9,9,11,0.3)]"
                                                >
                                                    <div className="l-spotlight pointer-events-none absolute inset-0" />
                                                    <div className="relative">
                                                        <div className="mb-5 flex items-center justify-between">
                                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-900/[0.07] text-zinc-600 transition-colors duration-300 group-hover:border-sky-200 group-hover:text-[var(--l-accent)]">
                                                                <Icon size={18} />
                                                            </div>
                                                            <span className="text-xs tabular-nums text-zinc-300">
                                                                {cat.n}.{i + 1}
                                                            </span>
                                                        </div>
                                                        <h3 className="l-h3 text-zinc-950">{f.title}</h3>
                                                        <p className="mt-1.5 text-[15px] leading-6 text-zinc-600">{f.desc}</p>
                                                    </div>
                                                </TiltCard>
                                            </StaggerItem>
                                        );
                                    })}
                                </Stagger>
                            </div>
                        </section>
                    ))}

                    <DarkCTA title={t.ctaTitle} desc={t.ctaDesc}>
                        <CTAButton onClick={onLogin}>{t.ctaBtn}</CTAButton>
                        <button type="button" onClick={() => onNavigate('pricing')} className={ctaSecondary}>
                            {t.ctaPricing}
                        </button>
                    </DarkCTA>
                </>
            )}
        </SiteShell>
    );
};

export default FeaturesPage;
