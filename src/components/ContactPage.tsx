import React, { useState } from 'react';
import { Globe, ChevronUp, Mail, Phone, Globe as GlobeIcon, Facebook, User, Send, MessageSquare, ArrowRight, Zap, MapPin, Clock, Sparkles, Loader2 } from 'lucide-react';
import { Lang } from '../i18n/i18n';
import { supabase } from '../services/supabase';

interface ContactPageProps {
    onLogin: () => void;
    onNavigate: (page: string) => void;
    lang: Lang;
    setLang: (lang: Lang) => void;
}

const translations = {
    vi: {
        nav: { home: 'Trang chủ', features: 'Tính năng', pricing: 'Bảng giá', contact: 'Liên hệ' },
        login: 'Đăng nhập',
        heroTag: 'Liên hệ',
        heroTitle: 'Chúng tôi luôn',
        heroTitleHighlight: 'sẵn sàng hỗ trợ.',
        heroDesc: 'Có câu hỏi, góp ý hay muốn hợp tác? Liên hệ ngay — chúng tôi phản hồi trong 24h.',
        contactCards: {
            email: { title: 'Email hỗ trợ', value: 'baquan3q@gmail.com', desc: 'Phản hồi trong 24 giờ' },
            zalo: { title: 'Zalo hỗ trợ', value: '0339 789 787', desc: 'Phản hồi nhanh nhất' },
            profile: { title: 'Profile', value: 'beacons.ai/baquan3q', desc: 'Xem thông tin nhà phát triển' },
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
        formSuccess: '✅ Tin nhắn đã được gửi thành công! Cảm ơn bạn.',
        devTitle: 'Nhà phát triển',
        devName: 'Bùi Anh Quân',
        devHandle: 'baquan3q',
        devDesc: 'Sinh viên VNU — Developer & Creator của SmartLife. Đam mê xây dựng sản phẩm công nghệ giúp sinh viên quản lý cuộc sống thông minh hơn.',
        devLocation: 'Hà Nội, Việt Nam',
        devAvailable: 'Sẵn sàng nhận hợp tác',
        socialTitle: 'Kết nối với chúng tôi',
        ctaTitle: 'Sẵn sàng trải nghiệm SmartLife?',
        ctaDesc: 'Đăng ký miễn phí và bắt đầu quản lý cuộc sống thông minh ngay hôm nay.',
        ctaBtn: 'Đăng ký miễn phí',
        footerBuilt: 'By QuanBa',
    },
    en: {
        nav: { home: 'Home', features: 'Features', pricing: 'Pricing', contact: 'Contact' },
        login: 'Login',
        heroTag: 'Contact Us',
        heroTitle: 'We\'re always',
        heroTitleHighlight: 'here to help.',
        heroDesc: 'Have questions, feedback, or want to collaborate? Reach out — we respond within 24h.',
        contactCards: {
            email: { title: 'Support Email', value: 'baquan3q@gmail.com', desc: 'Reply within 24 hours' },
            zalo: { title: 'Zalo Support', value: '0339 789 787', desc: 'Fastest response' },
            profile: { title: 'Profile', value: 'beacons.ai/baquan3q', desc: 'View developer info' },
        },
        formTitle: 'Send us a message',
        formDesc: 'Fill in the form below and we\'ll get back to you as soon as possible.',
        formName: 'Full Name',
        formNamePlaceholder: 'John Doe',
        formEmail: 'Email',
        formEmailPlaceholder: 'email@example.com',
        formSubject: 'Subject',
        formSubjectPlaceholder: 'e.g., Feature suggestion, Bug report, Partnership...',
        formMessage: 'Message',
        formMessagePlaceholder: 'Describe your question or feedback in detail...',
        formSubmit: 'Send Message',
        formSuccess: '✅ Message sent successfully! Thank you.',
        devTitle: 'Developer',
        devName: 'Bùi Anh Quân',
        devHandle: 'baquan3q',
        devDesc: 'VNU Student — Developer & Creator of SmartLife. Passionate about building technology products to help students manage life smarter.',
        devLocation: 'Hanoi, Vietnam',
        devAvailable: 'Open for collaboration',
        socialTitle: 'Connect with us',
        ctaTitle: 'Ready to experience SmartLife?',
        ctaDesc: 'Sign up for free and start managing your life smarter today.',
        ctaBtn: 'Sign up for free',
        footerBuilt: 'Built with ❤️ and advanced AI technology.',
    },
    ko: {
        nav: { home: '홈', features: '기능', pricing: '요금제', contact: '문의' },
        login: '로그인',
        heroTag: '문의하기',
        heroTitle: '언제나',
        heroTitleHighlight: '도움을 드립니다.',
        heroDesc: '질문, 피드백 또는 협업을 원하시나요? 24시간 내에 응답해 드립니다.',
        contactCards: {
            email: { title: '지원 이메일', value: 'baquan3q@gmail.com', desc: '24시간 내 답변' },
            zalo: { title: 'Zalo 지원', value: '0339 789 787', desc: '가장 빠른 응답' },
            profile: { title: '프로필', value: 'beacons.ai/baquan3q', desc: '개발자 정보 보기' },
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
        formSuccess: '✅ 메시지가 성공적으로 전송되었습니다! 감사합니다.',
        devTitle: '개발자',
        devName: 'Bùi Anh Quân',
        devHandle: 'baquan3q',
        devDesc: 'VNU 학생 — SmartLife 개발자 & 크리에이터. 학생들의 스마트한 생활 관리를 돕는 기술 제품 구축에 열정적입니다.',
        devLocation: '하노이, 베트남',
        devAvailable: '협업 가능',
        socialTitle: '소셜 미디어',
        ctaTitle: 'SmartLife를 경험할 준비가 되셨나요?',
        ctaDesc: '무료로 가입하고 오늘부터 더 스마트한 생활 관리를 시작하세요.',
        ctaBtn: '무료로 가입하기',
        footerBuilt: '❤️와 스마트 AI 기술로 제작되었습니다.',
    }
};

const ContactPage: React.FC<ContactPageProps> = ({ onLogin, onNavigate, lang, setLang }) => {
    const t = translations[lang];
    const [formSubmitted, setFormSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });

    const toggleLang = () => {
        setLang(lang === 'vi' ? 'en' : lang === 'en' ? 'ko' : 'vi');
    };

    const triggerMailto = () => {
        const mailtoBody = `${t.formName}: ${formData.name}%0D%0A${t.formEmail}: ${formData.email}%0D%0A${t.formSubject}: ${formData.subject}%0D%0A%0D%0A${formData.message}`;
        window.open(`mailto:baquan3q@gmail.com?subject=${encodeURIComponent(formData.subject || 'SmartLife Contact')}&body=${mailtoBody}`, '_blank');
        setFormSubmitted(true);
        setFormData({ name: '', email: '', subject: '', message: '' });
        setTimeout(() => setFormSubmitted(false), 4000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // Attempt to insert message into supabase contact_messages table
            const { error } = await supabase.from('contact_messages').insert([
                {
                    name: formData.name,
                    email: formData.email,
                    subject: formData.subject,
                    message: formData.message,
                    created_at: new Date().toISOString()
                }
            ]);

            if (error) {
                console.warn('Failed to insert message to Supabase, falling back to mailto:', error);
                triggerMailto();
            } else {
                setFormSubmitted(true);
                setFormData({ name: '', email: '', subject: '', message: '' });
                setTimeout(() => setFormSubmitted(false), 4000);
            }
        } catch (err) {
            console.error('Error inserting message to Supabase:', err);
            triggerMailto();
        } finally {
            setIsSubmitting(false);
        }
    };

    const contactCards = [
        {
            icon: <Mail size={24} />,
            color: 'bg-pink-100 text-pink-600',
            hoverColor: 'hover:border-pink-200 hover:shadow-pink-100/50',
            ...t.contactCards.email,
            link: 'mailto:baquan3q@gmail.com',
        },
        {
            icon: <MessageSquare size={24} />,
            color: 'bg-blue-100 text-blue-600',
            hoverColor: 'hover:border-blue-200 hover:shadow-blue-100/50',
            ...t.contactCards.zalo,
            link: 'https://zalo.me/0339789787',
        },
        {
            icon: <GlobeIcon size={24} />,
            color: 'bg-teal-100 text-teal-600',
            hoverColor: 'hover:border-teal-200 hover:shadow-teal-100/50',
            ...t.contactCards.profile,
            link: 'https://beacons.ai/baquan3q',
        },
    ];

    const socialLinks = [
        { icon: <Facebook size={20} />, label: 'Facebook', url: 'https://facebook.com/buianhquan06', color: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
        { icon: <Mail size={20} />, label: 'Email', url: 'mailto:baquan3q@gmail.com', color: 'bg-pink-50 text-pink-600 hover:bg-pink-100' },
        { icon: <GlobeIcon size={20} />, label: 'Website', url: 'https://beacons.ai/baquan3q', color: 'bg-teal-50 text-teal-600 hover:bg-teal-100' },
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
                        <button onClick={() => onNavigate('pricing')} className="px-3 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all">{t.nav.pricing}</button>
                        <button onClick={() => onNavigate('contact')} className="px-3 py-2 text-sm font-bold text-gray-900 bg-gray-100 rounded-lg transition-all">{t.nav.contact}</button>
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
                <div className="absolute top-0 right-0 -mr-32 -mt-32 w-[500px] h-[500px] bg-pink-200/20 rounded-full blur-[120px] mix-blend-multiply"></div>
                <div className="absolute bottom-0 left-0 -ml-32 -mb-16 w-[400px] h-[400px] bg-indigo-200/20 rounded-full blur-[120px] mix-blend-multiply"></div>
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-pink-100 shadow-sm text-pink-600 text-xs font-bold uppercase tracking-wider mb-6">
                        <Mail size={14} /> {t.heroTag}
                    </div>
                    <h1 className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-6 leading-[1.15]">
                        {t.heroTitle} <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600">
                            {t.heroTitleHighlight}
                        </span>
                    </h1>
                    <p className="text-gray-600 text-base sm:text-lg max-w-2xl mx-auto">{t.heroDesc}</p>
                </div>
            </section>

            {/* Contact Cards */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
                <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
                    {contactCards.map((card, i) => (
                        <a
                            key={i}
                            href={card.link}
                            target="_blank"
                            rel="noreferrer"
                            className={`group rounded-2xl border-2 border-gray-100 bg-white p-6 sm:p-8 text-center hover:shadow-xl ${card.hoverColor} transition-all duration-300 cursor-pointer`}
                        >
                            <div className={`w-14 h-14 rounded-2xl ${card.color} flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300`}>
                                {card.icon}
                            </div>
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{card.title}</h3>
                            <p className="text-base font-bold text-gray-900 mb-1.5">{card.value}</p>
                            <p className="text-xs text-gray-500">{card.desc}</p>
                        </a>
                    ))}
                </div>
            </section>

            {/* Contact Form + Developer Info */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
                <div className="grid lg:grid-cols-5 gap-8 sm:gap-12">
                    {/* Form */}
                    <div className="lg:col-span-3">
                        <div className="bg-gray-50/80 rounded-3xl p-6 sm:p-10 border border-gray-100">
                            <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-2">{t.formTitle}</h2>
                            <p className="text-sm text-gray-500 mb-8">{t.formDesc}</p>

                            {formSubmitted ? (
                                <div className="py-12 text-center">
                                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Send size={28} className="text-green-600" />
                                    </div>
                                    <p className="text-lg font-bold text-gray-900">{t.formSuccess}</p>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div className="grid sm:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">{t.formName}</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.name}
                                                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                                placeholder={t.formNamePlaceholder}
                                                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">{t.formEmail}</label>
                                            <input
                                                type="email"
                                                required
                                                value={formData.email}
                                                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                                placeholder={t.formEmailPlaceholder}
                                                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">{t.formSubject}</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.subject}
                                            onChange={e => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                                            placeholder={t.formSubjectPlaceholder}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">{t.formMessage}</label>
                                        <textarea
                                            required
                                            rows={5}
                                            value={formData.message}
                                            onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))}
                                            placeholder={t.formMessagePlaceholder}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all resize-none"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-75 disabled:pointer-events-none"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
                                                <span>Gửi tin nhắn...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Send size={16} /> {t.formSubmit}
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>

                    {/* Developer Info */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Developer Card */}
                        <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-sm">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-5">{t.devTitle}</h3>
                            <div className="flex items-start gap-4 mb-5">
                                <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-indigo-100 shadow-md shrink-0">
                                    <img src="/pwa-192x192.png" alt="Developer" className="w-full h-full object-cover" />
                                </div>
                                <div>
                                    <h4 className="text-lg font-extrabold text-gray-900">{t.devName}</h4>
                                    <p className="text-sm text-indigo-600 font-semibold">@{t.devHandle}</p>
                                </div>
                            </div>
                            <p className="text-sm text-gray-600 leading-relaxed mb-5">{t.devDesc}</p>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-sm text-gray-600">
                                    <MapPin size={16} className="text-pink-500 shrink-0" />
                                    <span>{t.devLocation}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-gray-600">
                                    <Clock size={16} className="text-green-500 shrink-0" />
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                        {t.devAvailable}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Social Links */}
                        <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-sm">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-5">{t.socialTitle}</h3>
                            <div className="space-y-3">
                                {socialLinks.map((social, i) => (
                                    <a
                                        key={i}
                                        href={social.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl ${social.color} font-semibold text-sm transition-all hover:scale-[1.02] active:scale-95`}
                                    >
                                        {social.icon}
                                        <span>{social.label}</span>
                                        <ArrowRight size={14} className="ml-auto opacity-50" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="max-w-4xl mx-4 sm:mx-6 lg:mx-8 xl:mx-auto px-4 sm:px-8 lg:px-12 pb-20">
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-pink-600 via-purple-600 to-indigo-600 px-8 sm:px-12 py-12 sm:py-16 text-center text-white">
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full"></div>
                    <div className="absolute -left-6 -bottom-6 w-32 h-32 bg-white/5 rounded-full"></div>
                    <div className="absolute right-1/3 top-1/4 w-20 h-20 bg-white/10 rounded-full"></div>
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

export default ContactPage;
