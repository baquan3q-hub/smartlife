import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Mail, MessageSquare, Globe, Facebook, Send, MapPin, Loader2, ArrowUpRight, Check, type LucideIcon } from 'lucide-react';
import { Lang } from '../../../i18n/i18n';
import { supabase } from '../../../services/supabase';
import { SiteShell } from '../SiteShell';
import { PageHero } from '../sections/PageHero';
import { DarkCTA, CTAButton } from '../sections/FinalCTA';
import { Reveal, Stagger, StaggerItem, EASE } from '../motion/Reveal';
import { TiltCard } from '../motion/TiltCard';
import { MagneticButton } from '../motion/MagneticButton';

interface ContactPageProps {
    onLogin: () => void;
    onNavigate: (page: string) => void;
    lang: Lang;
    setLang: (lang: Lang) => void;
}

const translations = {
    vi: {
        heroTag: 'Liên hệ',
        heroTitle: 'Chúng tôi luôn',
        heroTitleHighlight: 'sẵn sàng hỗ trợ.',
        heroDesc: 'Có câu hỏi, góp ý hay muốn hợp tác? Liên hệ ngay — chúng tôi phản hồi trong 24h.',
        contactCards: {
            email: { title: 'Email hỗ trợ', value: 'baquan3q@gmail.com', desc: 'Phản hồi trong 24 giờ' },
            zalo: { title: 'Zalo hỗ trợ', value: '0339 789 787', desc: 'Phản hồi nhanh nhất' },
            profile: { title: 'Profile', value: 'beacons.ai/baquan3q', desc: 'Xem thông tin nhà phát triển' }
        },
        formTitle: 'Gửi tin nhắn cho chúng tôi',
        formDesc: 'Điền thông tin bên dưới, chúng tôi sẽ phản hồi sớm nhất có thể.',
        formName: 'Họ và tên',
        formNamePlaceholder: 'Nguyễn Văn A',
        formEmail: 'Email',
        formEmailPlaceholder: 'email@example.com',
        formSubject: 'Chủ đề',
        formSubjectPlaceholder: 'VD: Góp ý tính năng, Báo lỗi, Hợp tác...',
        formMessage: 'Nội dung',
        formMessagePlaceholder: 'Mô tả chi tiết vấn đề hoặc ý kiến của bạn...',
        formSubmit: 'Gửi tin nhắn',
        formSending: 'Đang gửi...',
        formSuccess: 'Tin nhắn đã được gửi thành công! Cảm ơn bạn.',
        devTitle: 'Nhà phát triển',
        devName: 'Bùi Anh Quân',
        devHandle: 'baquan3q',
        devDesc: 'Sinh viên VNU — Developer & Creator của SmartLife. Đam mê xây dựng sản phẩm công nghệ giúp sinh viên quản lý cuộc sống thông minh hơn.',
        devLocation: 'Hà Nội, Việt Nam',
        devAvailable: 'Sẵn sàng nhận hợp tác',
        socialTitle: 'Kết nối với chúng tôi',
        ctaTitle: 'Sẵn sàng trải nghiệm SmartLife?',
        ctaDesc: 'Đăng ký miễn phí và bắt đầu quản lý cuộc sống thông minh ngay hôm nay.',
        ctaBtn: 'Đăng ký miễn phí'
    },
    en: {
        heroTag: 'Contact Us',
        heroTitle: "We're always",
        heroTitleHighlight: 'here to help.',
        heroDesc: 'Have questions, feedback, or want to collaborate? Reach out — we respond within 24h.',
        contactCards: {
            email: { title: 'Support Email', value: 'baquan3q@gmail.com', desc: 'Reply within 24 hours' },
            zalo: { title: 'Zalo Support', value: '0339 789 787', desc: 'Fastest response' },
            profile: { title: 'Profile', value: 'beacons.ai/baquan3q', desc: 'View developer info' }
        },
        formTitle: 'Send us a message',
        formDesc: "Fill in the form below and we'll get back to you as soon as possible.",
        formName: 'Full Name',
        formNamePlaceholder: 'John Doe',
        formEmail: 'Email',
        formEmailPlaceholder: 'email@example.com',
        formSubject: 'Subject',
        formSubjectPlaceholder: 'e.g., Feature suggestion, Bug report, Partnership...',
        formMessage: 'Message',
        formMessagePlaceholder: 'Describe your question or feedback in detail...',
        formSubmit: 'Send Message',
        formSending: 'Sending...',
        formSuccess: 'Message sent successfully! Thank you.',
        devTitle: 'Developer',
        devName: 'Bùi Anh Quân',
        devHandle: 'baquan3q',
        devDesc: 'VNU Student — Developer & Creator of SmartLife. Passionate about building technology products to help students manage life smarter.',
        devLocation: 'Hanoi, Vietnam',
        devAvailable: 'Open for collaboration',
        socialTitle: 'Connect with us',
        ctaTitle: 'Ready to experience SmartLife?',
        ctaDesc: 'Sign up for free and start managing your life smarter today.',
        ctaBtn: 'Sign up for free'
    },
    ko: {
        heroTag: '문의하기',
        heroTitle: '언제나',
        heroTitleHighlight: '도움을 드립니다.',
        heroDesc: '질문, 피드백 또는 협업을 원하시나요? 24시간 내에 응답해 드립니다.',
        contactCards: {
            email: { title: '지원 이메일', value: 'baquan3q@gmail.com', desc: '24시간 내 답변' },
            zalo: { title: 'Zalo 지원', value: '0339 789 787', desc: '가장 빠른 응답' },
            profile: { title: '프로필', value: 'beacons.ai/baquan3q', desc: '개발자 정보 보기' }
        },
        formTitle: '메시지 보내기',
        formDesc: '아래 양식을 작성해 주시면 가능한 빨리 답변드리겠습니다.',
        formName: '이름',
        formNamePlaceholder: '홍길동',
        formEmail: '이메일',
        formEmailPlaceholder: 'email@example.com',
        formSubject: '제목',
        formSubjectPlaceholder: '예: 기능 제안, 버그 신고, 협업 문의...',
        formMessage: '내용',
        formMessagePlaceholder: '질문이나 피드백을 자세히 설명해 주세요...',
        formSubmit: '메시지 전송',
        formSending: '전송 중...',
        formSuccess: '메시지가 성공적으로 전송되었습니다! 감사합니다.',
        devTitle: '개발자',
        devName: 'Bùi Anh Quân',
        devHandle: 'baquan3q',
        devDesc: 'VNU 학생 — SmartLife 개발자 & 크리에이터. 학생들의 스마트한 생활 관리를 돕는 기술 제품 구축에 열정적입니다.',
        devLocation: '하노이, 베트남',
        devAvailable: '협업 가능',
        socialTitle: '소셜 미디어',
        ctaTitle: 'SmartLife를 경험할 준비가 되셨나요?',
        ctaDesc: '무료로 가입하고 오늘부터 더 스마트한 생활 관리를 시작하세요.',
        ctaBtn: '무료로 가입하기'
    }
};

const socialLinks: { icon: LucideIcon; label: string; url: string }[] = [
    { icon: Facebook, label: 'Facebook', url: 'https://facebook.com/buianhquan06' },
    { icon: Mail, label: 'Email', url: 'mailto:baquan3q@gmail.com' },
    { icon: Globe, label: 'Website', url: 'https://beacons.ai/baquan3q' }
];

const fieldClass =
    'w-full rounded-xl border border-zinc-900/10 bg-white px-4 py-3 text-[15px] text-zinc-950 placeholder:text-zinc-400 transition-[border-color,box-shadow] focus:border-[var(--l-accent)] focus:outline-none focus:ring-4 focus:ring-sky-100';
const labelClass = 'mb-2 block text-[13px] font-medium text-zinc-700';

const ContactPage: React.FC<ContactPageProps> = ({ onLogin, onNavigate, lang, setLang }) => {
    const t = translations[lang];
    const [formSubmitted, setFormSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });

    const finish = () => {
        setFormSubmitted(true);
        setFormData({ name: '', email: '', subject: '', message: '' });
        setTimeout(() => setFormSubmitted(false), 4000);
    };

    const triggerMailto = () => {
        const mailtoBody = `${t.formName}: ${formData.name}%0D%0A${t.formEmail}: ${formData.email}%0D%0A${t.formSubject}: ${formData.subject}%0D%0A%0D%0A${formData.message}`;
        window.open(`mailto:baquan3q@gmail.com?subject=${encodeURIComponent(formData.subject || 'SmartLife Contact')}&body=${mailtoBody}`, '_blank');
        finish();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('contact_messages').insert([
                { ...formData, created_at: new Date().toISOString() }
            ]);
            if (error) {
                console.warn('Failed to insert message to Supabase, falling back to mailto:', error);
                triggerMailto();
            } else {
                finish();
            }
        } catch (err) {
            console.error('Error inserting message to Supabase:', err);
            triggerMailto();
        } finally {
            setIsSubmitting(false);
        }
    };

    const set = (key: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setFormData((prev) => ({ ...prev, [key]: e.target.value }));

    const contactCards: { icon: LucideIcon; link: string; title: string; value: string; desc: string }[] = [
        { icon: Mail, link: 'mailto:baquan3q@gmail.com', ...t.contactCards.email },
        { icon: MessageSquare, link: 'https://zalo.me/0339789787', ...t.contactCards.zalo },
        { icon: Globe, link: 'https://beacons.ai/baquan3q', ...t.contactCards.profile }
    ];

    return (
        <SiteShell page="contact" lang={lang} setLang={setLang} onLogin={onLogin} onNavigate={onNavigate}>
            {() => (
                <>
                    <PageHero eyebrow={t.heroTag} title1={t.heroTitle} title2={t.heroTitleHighlight} desc={t.heroDesc} />

                    <section className="px-4 pb-16 sm:px-6 sm:pb-20">
                        <Stagger className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
                            {contactCards.map((card) => {
                                const Icon = card.icon;
                                return (
                                    <StaggerItem key={card.link}>
                                        <TiltCard
                                            max={5}
                                            className="group relative h-full overflow-hidden rounded-[20px] border border-zinc-900/[0.08] bg-white transition-shadow duration-500 hover:shadow-[0_30px_60px_-30px_rgba(9,9,11,0.3)]"
                                        >
                                            <div className="l-spotlight pointer-events-none absolute inset-0" />
                                            <a href={card.link} target="_blank" rel="noreferrer" className="relative flex h-full flex-col p-6">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-900/[0.07] text-zinc-600 transition-colors duration-300 group-hover:border-sky-200 group-hover:text-[var(--l-accent)]">
                                                        <Icon size={18} />
                                                    </div>
                                                    <ArrowUpRight
                                                        size={18}
                                                        className="text-zinc-300 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zinc-950"
                                                    />
                                                </div>
                                                <p className="mt-8 text-[13px] font-medium text-zinc-500">{card.title}</p>
                                                <p className="mt-1 truncate text-lg font-semibold tracking-tight text-zinc-950">{card.value}</p>
                                                <p className="mt-1 text-sm text-zinc-500">{card.desc}</p>
                                            </a>
                                        </TiltCard>
                                    </StaggerItem>
                                );
                            })}
                        </Stagger>
                    </section>

                    <section className="px-4 pb-20 sm:px-6 sm:pb-28">
                        <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-5">
                            {/* Form */}
                            <Reveal className="lg:col-span-3">
                                <div className="relative h-full overflow-hidden rounded-[24px] border border-zinc-900/[0.08] bg-white p-6 sm:p-10">
                                    <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-[28px]">{t.formTitle}</h2>
                                    <p className="mt-2 text-[15px] text-zinc-600">{t.formDesc}</p>

                                    <AnimatePresence mode="wait" initial={false}>
                                        {formSubmitted ? (
                                            <motion.div
                                                key="done"
                                                initial={{ opacity: 0, scale: 0.96 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.96 }}
                                                transition={{ duration: 0.4, ease: EASE }}
                                                className="flex min-h-[360px] flex-col items-center justify-center text-center"
                                                role="status"
                                            >
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                                                    className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"
                                                >
                                                    <Check size={26} strokeWidth={2.5} />
                                                </motion.div>
                                                <p className="max-w-xs text-lg font-medium text-zinc-950">{t.formSuccess}</p>
                                            </motion.div>
                                        ) : (
                                            <motion.form
                                                key="form"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.3 }}
                                                onSubmit={handleSubmit}
                                                className="mt-8 space-y-5"
                                            >
                                                <div className="grid gap-5 sm:grid-cols-2">
                                                    <div>
                                                        <label htmlFor="c-name" className={labelClass}>{t.formName}</label>
                                                        <input id="c-name" type="text" required value={formData.name} onChange={set('name')} placeholder={t.formNamePlaceholder} className={fieldClass} />
                                                    </div>
                                                    <div>
                                                        <label htmlFor="c-email" className={labelClass}>{t.formEmail}</label>
                                                        <input id="c-email" type="email" required value={formData.email} onChange={set('email')} placeholder={t.formEmailPlaceholder} className={fieldClass} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label htmlFor="c-subject" className={labelClass}>{t.formSubject}</label>
                                                    <input id="c-subject" type="text" required value={formData.subject} onChange={set('subject')} placeholder={t.formSubjectPlaceholder} className={fieldClass} />
                                                </div>
                                                <div>
                                                    <label htmlFor="c-message" className={labelClass}>{t.formMessage}</label>
                                                    <textarea id="c-message" required rows={5} value={formData.message} onChange={set('message')} placeholder={t.formMessagePlaceholder} className={`${fieldClass} resize-none`} />
                                                </div>
                                                <MagneticButton
                                                    type="submit"
                                                    disabled={isSubmitting}
                                                    className="group flex h-12 w-full items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 text-[15px] font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 sm:w-auto"
                                                >
                                                    {isSubmitting ? (
                                                        <>
                                                            <Loader2 size={17} className="animate-spin" /> {t.formSending}
                                                        </>
                                                    ) : (
                                                        <>
                                                            {t.formSubmit}
                                                            <Send size={16} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                                                        </>
                                                    )}
                                                </MagneticButton>
                                            </motion.form>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </Reveal>

                            {/* Developer + socials */}
                            <div className="flex flex-col gap-4 lg:col-span-2">
                                <Reveal delay={0.08} className="flex-1">
                                    <div className="relative h-full overflow-hidden rounded-[24px] bg-zinc-950 p-6 text-white sm:p-8">
                                        <div
                                            className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full blur-3xl"
                                            style={{ background: 'radial-gradient(closest-side, rgba(2,132,199,0.45), transparent)' }}
                                            aria-hidden
                                        />
                                        <div className="relative">
                                            <p className="text-[13px] font-medium text-zinc-500">{t.devTitle}</p>
                                            <div className="mt-5 flex items-center gap-4">
                                                <img src="/pwa-192x192.png" alt="" className="h-14 w-14 rounded-2xl border border-white/10" />
                                                <div className="min-w-0">
                                                    <p className="text-lg font-semibold tracking-tight">{t.devName}</p>
                                                    <p className="text-sm text-zinc-400">@{t.devHandle}</p>
                                                </div>
                                            </div>
                                            <p className="mt-5 text-[15px] leading-6 text-zinc-300">{t.devDesc}</p>
                                            <div className="mt-6 flex flex-wrap gap-2 text-[13px]">
                                                <span className="flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 text-zinc-300">
                                                    <MapPin size={13} /> {t.devLocation}
                                                </span>
                                                <span className="flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-emerald-300">
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
                                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                                                    </span>
                                                    {t.devAvailable}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </Reveal>
                                <Reveal delay={0.14}>
                                    <div className="rounded-[24px] border border-zinc-900/[0.08] bg-white p-6">
                                        <p className="text-[13px] font-medium text-zinc-500">{t.socialTitle}</p>
                                        <div className="mt-4 grid grid-cols-3 gap-2">
                                            {socialLinks.map(({ icon: Icon, label, url }) => (
                                                <a
                                                    key={label}
                                                    href={url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="group flex flex-col items-center gap-2 rounded-2xl border border-zinc-900/[0.06] py-4 text-[13px] font-medium text-zinc-600 transition-colors hover:border-zinc-900/15 hover:text-zinc-950"
                                                >
                                                    <Icon size={18} className="transition-transform duration-300 group-hover:-translate-y-0.5" />
                                                    {label}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                </Reveal>
                            </div>
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

export default ContactPage;
