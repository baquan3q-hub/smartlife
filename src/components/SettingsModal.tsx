import React, { useState, useEffect } from 'react';
import { X, User, Save, Loader2, Bell, Calendar, Clock, Target, Moon, Zap, Sparkles, LogOut, Smartphone, Lock, Camera, QrCode, CreditCard, Contact, Trash2, Music, Flame, Plus, Eye, Sun, Monitor } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Profile } from '../types';
import { Lang, t } from '../i18n/i18n';
import { ThemeMode, getSavedTheme, saveTheme } from '../utils/theme';

const DocumentCard: React.FC<{
    title: string;
    hasImages: boolean;
    count: number;
    icon: React.ReactNode;
    onClick: () => void;
}> = ({ title, hasImages, count, icon, onClick }) => {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-200 relative overflow-hidden aspect-video select-none group/card
                ${hasImages
                    ? 'border-blue-500 bg-blue-50/20 text-blue-600 shadow-sm shadow-blue-100/30'
                    : 'border-dashed border-gray-200 bg-gray-50/50 hover:bg-gray-100 hover:border-gray-300 text-gray-400 hover:text-gray-500'}`}
        >
            <div className="flex flex-col items-center gap-1.5 text-center">
                <span className={`${hasImages ? 'text-blue-500' : 'text-gray-400 group-hover/card:text-indigo-500'} transition-colors`}>{icon}</span>
                <span className={`text-[10px] font-extrabold tracking-wide mt-0.5 ${hasImages ? 'text-blue-700' : ''}`}>
                    {title} {hasImages && `(${count}/2)`}
                </span>
            </div>
        </button>
    );
};

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    onSignOut: () => void;
    notificationsEnabled?: boolean;
    toggleNotifications?: () => void;
    lang: Lang;
    setLang: (lang: Lang) => void;
    headerShortcuts: { spotify: boolean; habit: boolean };
    onUpdateHeaderShortcuts: (shortcuts: { spotify: boolean; habit: boolean }) => void;
}

const DEFAULT_NOTI_SETTINGS = {
    timetable: true,
    timetable_pre: true,
    calendar_lunar: true,
    calendar_holiday: true,
    focus_timer: true,
    goals_remind: true,
    todo_remind: true
};

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    userId,
    onSignOut,
    notificationsEnabled,
    toggleNotifications,
    lang,
    setLang,
    headerShortcuts,
    onUpdateHeaderShortcuts
}) => {
    const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'navigation'>('profile');
    const [profile, setProfile] = useState<Profile | null>(null);
    const [notiSettings, setNotiSettings] = useState(DEFAULT_NOTI_SETTINGS);
    const [tempHeaderShortcuts, setTempHeaderShortcuts] = useState<{ spotify: boolean; habit: boolean }>({ spotify: true, habit: true });
    const [tempTheme, setTempTheme] = useState<ThemeMode>('system');
    const [todoExpiryEnabled, setTodoExpiryEnabled] = useState(false);
    const [todoExpiryDays, setTodoExpiryDays] = useState(90);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hobbiesInput, setHobbiesInput] = useState('');
    const [activeLightboxField, setActiveLightboxField] = useState<'qr_code_url' | 'student_card_url' | 'citizen_card_url' | null>(null);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    const getDocImages = (field: 'qr_code_url' | 'student_card_url' | 'citizen_card_url') => {
        const val = profile?.[field];
        if (!val) return [];
        if (val.startsWith('[')) {
            try {
                return JSON.parse(val) as string[];
            } catch (e) {
                return [val];
            }
        }
        return [val];
    };

    const handleCardClick = (field: 'qr_code_url' | 'student_card_url' | 'citizen_card_url', uploadId: string) => {
        const images = getDocImages(field);
        if (images.length > 0) {
            setActiveLightboxField(field);
        } else {
            document.getElementById(uploadId)?.click();
        }
    };

    const compressImageToBase64 = (file: File, maxWidth = 800, quality = 0.7): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        resolve(event.target?.result as string);
                        return;
                    }
                    ctx.drawImage(img, 0, 0, width, height);
                    const compressed = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressed);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const compressed = await compressImageToBase64(file, 200, 0.75);
            setProfile(prev => prev ? { ...prev, avatar_url: compressed } : null);
        } catch (err) {
            console.error("Error uploading avatar:", err);
            alert("Không thể tải lên ảnh đại diện.");
        }
    };

    const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'qr_code_url' | 'student_card_url' | 'citizen_card_url') => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const compressed = await compressImageToBase64(file, 800, 0.75);
            const currentImages = getDocImages(field);
            const updatedImages = [...currentImages, compressed].slice(0, 2);
            const updatedVal = JSON.stringify(updatedImages);
            setProfile(prev => prev ? { ...prev, [field]: updatedVal } : null);
        } catch (err) {
            console.error(`Error uploading ${field}:`, err);
            alert("Không thể tải lên ảnh tài liệu.");
        }
    };

    const handleDocumentDelete = (field: 'qr_code_url' | 'student_card_url' | 'citizen_card_url', index: number) => {
        if (window.confirm('Bạn có chắc chắn muốn xóa ảnh này?')) {
            const currentImages = getDocImages(field);
            const updatedImages = currentImages.filter((_, i) => i !== index);
            const updatedVal = updatedImages.length > 0 ? JSON.stringify(updatedImages) : null;
            setProfile(prev => prev ? { ...prev, [field]: updatedVal } : null);
            if (updatedImages.length === 0) {
                setActiveLightboxField(null);
            }
        }
    };

    const getFieldNameVi = (field: string) => {
        if (field === 'qr_code_url') return 'Mã QR Cá Nhân';
        if (field === 'student_card_url') return 'Thẻ Sinh Viên';
        if (field === 'citizen_card_url') return 'Căn Cước Công Dân';
        return 'Tài liệu';
    };

    useEffect(() => {
        if (isOpen) {
            if (userId) fetchProfile();
            // Load local settings
            const saved = localStorage.getItem('smartlife_noti_settings');
            if (saved) {
                try {
                    setNotiSettings({ ...DEFAULT_NOTI_SETTINGS, ...JSON.parse(saved) });
                } catch (e) {
                    console.error("Error parsing settings", e);
                }
            }
            // Sync header shortcuts temp state
            setTempHeaderShortcuts({ ...headerShortcuts });
            // Load theme setting
            setTempTheme(getSavedTheme());
            // Load todo expiry settings
            const expiryEnabled = localStorage.getItem('smartlife_todo_expiry_enabled') === 'true';
            const expiryDays = parseInt(localStorage.getItem('smartlife_todo_expiry_days') || '90', 10);
            setTodoExpiryEnabled(expiryEnabled);
            setTodoExpiryDays(expiryDays);
        }
    }, [isOpen, userId, headerShortcuts]);

    useEffect(() => {
        if (profile) {
            setHobbiesInput(profile.hobbies?.join(', ') || '');
        } else {
            setHobbiesInput('');
        }
    }, [profile?.id]);


    const fetchProfile = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                // console.error('Error fetching profile:', error);
            }

            if (data) {
                setProfile(data);
            } else {
                setProfile({ id: userId });
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };



    const toggleDisc = (char: string) => {
        setProfile(prev => {
            if (!prev) return null;
            const currentStr = prev.personality_disc || '';
            const current = currentStr.split('').filter(c => ['D', 'I', 'S', 'C'].includes(c));
            let updated: string[];
            if (current.includes(char)) {
                updated = current.filter(c => c !== char);
            } else {
                if (current.length >= 2) {
                    updated = [current[1], char];
                } else {
                    updated = [...current, char];
                }
            }
            return {
                ...prev,
                personality_disc: updated.join('') || null
            };
        });
    };


    const handleSave = async () => {
        setSaving(true);
        try {
            // 1. Save Profile (if changed)
            if (profile) {
                const updates = {
                    id: userId,
                    email: profile.email,
                    full_name: profile.full_name,
                    age: profile.age,
                    job: profile.job,
                    monthly_salary: profile.monthly_salary,
                    workplace: profile.workplace,
                    currency: profile.currency,
                    avatar_url: profile.avatar_url,
                    university: profile.university || null,
                    major: profile.major || null,
                    career_objective: profile.career_objective || null,
                    personality_mbti: profile.personality_mbti || null,
                    personality_disc: profile.personality_disc || null,
                    hobbies: hobbiesInput.split(',').map(s => s.trim()).filter(Boolean),
                    life_motto: profile.life_motto || null,
                    qr_code_url: profile.qr_code_url || null,
                    student_card_url: profile.student_card_url || null,
                    citizen_card_url: profile.citizen_card_url || null,
                    email_notifications: profile.email_notifications || null,
                    updated_at: new Date().toISOString(),
                };
                const { error } = await supabase.from('profiles').upsert(updates);
                if (error) throw error;
            }

            // 2. Save Notification Settings
            localStorage.setItem('smartlife_noti_settings', JSON.stringify(notiSettings));

            // 3. Save Header Shortcuts
            localStorage.setItem(`smartlife_header_shortcuts_${userId}`, JSON.stringify(tempHeaderShortcuts));
            onUpdateHeaderShortcuts(tempHeaderShortcuts);

            // 4. Save Theme Setting
            saveTheme(tempTheme);

            // Save Todo Expiry settings
            localStorage.setItem('smartlife_todo_expiry_enabled', todoExpiryEnabled ? 'true' : 'false');
            localStorage.setItem('smartlife_todo_expiry_days', todoExpiryDays.toString());

            // Dispatch event so other components can pick up changes immediately
            window.dispatchEvent(new Event('storage'));

            alert('Đã lưu cài đặt! ✨');
            onClose();
        } catch (error: any) {
            alert('Lỗi cập nhật: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleSetting = (key: keyof typeof DEFAULT_NOTI_SETTINGS) => {
        setNotiSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-white">
                    <h2 className="text-xl font-bold text-gray-800">{t('settings.title', lang)}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex p-1.5 mx-5 mt-4 bg-gray-150/50 rounded-2xl gap-1 border border-gray-200/20 select-none">
                    <button
                        type="button"
                        onClick={() => setActiveTab('profile')}
                        className={`py-2.5 rounded-xl text-xs md:text-sm font-extrabold flex items-center justify-center gap-2 transition-all duration-300 shrink-0
                            ${activeTab === 'profile'
                                ? 'flex-[1.5] bg-white text-indigo-600 shadow-sm px-4'
                                : 'flex-1 text-gray-400 hover:text-gray-600 hover:bg-white/40 px-2'}`}
                    >
                        <User size={16} />
                        {activeTab === 'profile' && <span className="animate-in fade-in zoom-in-95 duration-200 truncate">{t('settings.profile', lang)}</span>}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('notifications')}
                        className={`py-2.5 rounded-xl text-xs md:text-sm font-extrabold flex items-center justify-center gap-2 transition-all duration-300 shrink-0
                            ${activeTab === 'notifications'
                                ? 'flex-[1.5] bg-white text-emerald-600 shadow-sm px-4'
                                : 'flex-1 text-gray-400 hover:text-gray-600 hover:bg-white/40 px-2'}`}
                    >
                        <Bell size={16} />
                        {activeTab === 'notifications' && <span className="animate-in fade-in zoom-in-95 duration-200 truncate">{t('settings.notifications', lang)}</span>}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('navigation')}
                        className={`py-2.5 rounded-xl text-xs md:text-sm font-extrabold flex items-center justify-center gap-2 transition-all duration-300 shrink-0
                            ${activeTab === 'navigation'
                                ? 'flex-[1.5] bg-white text-indigo-600 shadow-sm px-4'
                                : 'flex-1 text-gray-400 hover:text-gray-600 hover:bg-white/40 px-2'}`}
                    >
                        <Smartphone size={16} />
                        {activeTab === 'navigation' && <span className="animate-in fade-in zoom-in-95 duration-200 truncate">{t('settings.navbar', lang)}</span>}
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">

                    {/* PROFILE TAB */}
                    {/* PROFILE TAB */}
                    {activeTab === 'profile' && (
                        loading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {/* Hidden Inputs for Documents */}
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    id="qr-upload-input"
                                    onChange={(e) => handleDocumentUpload(e, 'qr_code_url')}
                                />
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    id="student-upload-input"
                                    onChange={(e) => handleDocumentUpload(e, 'student_card_url')}
                                />
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    id="citizen-upload-input"
                                    onChange={(e) => handleDocumentUpload(e, 'citizen_card_url')}
                                />

                                {/* Document & Profile Header Hub */}
                                <div className="bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/50 p-4 rounded-3xl border border-indigo-100/40 space-y-4 mb-2">
                                    <div className="flex items-center gap-4">
                                        {/* Avatar section */}
                                        <div className="relative group cursor-pointer shrink-0" onClick={() => document.getElementById('avatar-upload-input')?.click()}>
                                            <img
                                                src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.full_name || 'User'}`}
                                                alt="Avatar"
                                                className="w-16 h-16 rounded-full object-cover border-4 border-indigo-100 shadow-sm group-hover:border-indigo-300 transition-colors"
                                            />
                                            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Camera size={14} className="text-white" />
                                            </div>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                id="avatar-upload-input"
                                                onChange={handleAvatarChange}
                                            />
                                        </div>

                                        {/* User basic greetings */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-extrabold text-gray-800 truncate text-sm leading-snug">
                                                {profile?.full_name || 'Học viên SmartLife'}
                                            </h3>
                                            <p className="text-xs text-gray-400 font-medium truncate">
                                                {profile?.email || 'Chưa thiết lập email'}
                                            </p>
                                            <p className="text-[10px] text-indigo-500 font-black tracking-wider uppercase mt-1 flex items-center gap-1">
                                                <Sparkles size={10} /> {profile?.job || 'Thành viên'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Documents row */}
                                    <div className="pt-3 border-t border-indigo-100/30">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2 ml-0.5">
                                            Ảnh QR bank + Thẻ SV + CCCD (Take Anywhere)
                                        </label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {/* QR Card */}
                                            <DocumentCard
                                                title="Mã QR"
                                                hasImages={getDocImages('qr_code_url').length > 0}
                                                count={getDocImages('qr_code_url').length}
                                                icon={<QrCode size={18} />}
                                                onClick={() => handleCardClick('qr_code_url', 'qr-upload-input')}
                                            />

                                            {/* Student Card */}
                                            <DocumentCard
                                                title="Thẻ SV"
                                                hasImages={getDocImages('student_card_url').length > 0}
                                                count={getDocImages('student_card_url').length}
                                                icon={<CreditCard size={18} />}
                                                onClick={() => handleCardClick('student_card_url', 'student-upload-input')}
                                            />

                                            {/* Citizen Card */}
                                            <DocumentCard
                                                title="CCCD"
                                                hasImages={getDocImages('citizen_card_url').length > 0}
                                                count={getDocImages('citizen_card_url').length}
                                                icon={<Contact size={18} />}
                                                onClick={() => handleCardClick('citizen_card_url', 'citizen-upload-input')}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-gray-50 rounded-2xl p-2 border border-gray-100">
                                        <div className="flex items-center justify-between p-3 flex-wrap gap-2">
                                            <div className="pr-4">
                                                <div className="font-bold text-gray-800 text-sm">{t('settings.language', lang)}</div>
                                                <div className="text-xs text-gray-400 font-medium mt-0.5">{t('settings.language_desc', lang)}</div>
                                            </div>
                                            <div className="flex bg-gray-200 rounded-lg p-1">
                                                <button
                                                    onClick={() => setLang('vi')}
                                                    className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${lang === 'vi' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                >
                                                    Tiếng Việt
                                                </button>
                                                <button
                                                    onClick={() => setLang('en')}
                                                    className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${lang === 'en' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                >
                                                    English
                                                </button>
                                                <button
                                                    onClick={() => setLang('ko')}
                                                    className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${lang === 'ko' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                >
                                                    한국어
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">{t('settings.fullname', lang)}</label>
                                        <input
                                            type="text"
                                            value={profile?.full_name || ''}
                                            onChange={(e) => setProfile(prev => prev ? { ...prev, full_name: e.target.value } : null)}
                                            className="w-full px-4 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none font-medium transition-all"
                                            placeholder={t('settings.fullname_placeholder', lang)}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">{t('settings.job', lang)}</label>
                                            <input
                                                type="text"
                                                value={profile?.job || ''}
                                                onChange={(e) => setProfile(prev => prev ? { ...prev, job: e.target.value } : null)}
                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none font-medium transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">{t('settings.age', lang)}</label>
                                            <input
                                                type="number"
                                                value={profile?.age || ''}
                                                onChange={(e) => setProfile(prev => prev ? { ...prev, age: Number(e.target.value) } : null)}
                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none font-medium transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">{t('settings.salary', lang)}</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={profile?.monthly_salary || ''}
                                                    onChange={(e) => setProfile(prev => prev ? { ...prev, monthly_salary: Number(e.target.value) } : null)}
                                                    className="w-full pl-4 pr-10 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none font-medium transition-all"
                                                    placeholder="0"
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">{lang === 'vi' ? 'đ' : lang === 'ko' ? '₩' : '$'}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">{t('settings.workplace', lang)}</label>
                                            <input
                                                type="text"
                                                value={profile?.workplace || ''}
                                                onChange={(e) => setProfile(prev => prev ? { ...prev, workplace: e.target.value } : null)}
                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none font-medium transition-all"
                                                placeholder={t('settings.workplace_placeholder', lang)}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">{t('settings.avatar_url', lang)}</label>
                                        <input
                                            type="text"
                                            value={profile?.avatar_url || ''}
                                            onChange={(e) => setProfile(prev => prev ? { ...prev, avatar_url: e.target.value } : null)}
                                            className="w-full px-4 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none font-medium transition-all text-sm text-gray-600 mb-4"
                                            placeholder={t('settings.avatar_url_placeholder', lang)}
                                        />
                                    </div>

                                    {/* AI Personalization Fields */}
                                    <div className="pt-4 border-t border-gray-150 space-y-4">
                                        <h3 className="text-sm font-bold text-indigo-600 flex items-center gap-2">
                                            <Sparkles size={16} /> Cá nhân hóa AI Advisor
                                        </h3>
                                        <p className="text-[11px] text-gray-400 font-medium">
                                            Cung cấp thông tin để trợ lý AI thấu hiểu tính cách, bối cảnh và tư vấn chính xác nhất cho bạn.
                                        </p>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Tính cách MBTI</label>
                                                <select
                                                    value={profile?.personality_mbti || ''}
                                                    onChange={(e) => setProfile(prev => prev ? { ...prev, personality_mbti: e.target.value } : null)}
                                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none font-medium transition-all text-sm"
                                                >
                                                    <option value="">Chưa xác định</option>
                                                    <option value="INTJ">INTJ - Nhà hoạch định</option>
                                                    <option value="INTP">INTP - Nhà tư duy</option>
                                                    <option value="ENTJ">ENTJ - Nhà điều hành</option>
                                                    <option value="ENTP">ENTP - Người đổi mới</option>
                                                    <option value="INFJ">INFJ - Nhà bảo vệ</option>
                                                    <option value="INFP">INFP - Người hòa giải</option>
                                                    <option value="ENFJ">ENFJ - Nhà truyền cảm hứng</option>
                                                    <option value="ENFP">ENFP - Người truyền tin</option>
                                                    <option value="ISTJ">ISTJ - Nhà quản lý</option>
                                                    <option value="ISFJ">ISFJ - Người nuôi dưỡng</option>
                                                    <option value="ESTJ">ESTJ - Người giám sát</option>
                                                    <option value="ESFJ">ESFJ - Người quan tâm</option>
                                                    <option value="ISTP">ISTP - Nhà kỹ thuật</option>
                                                    <option value="ISFP">ISFP - Người nghệ sĩ</option>
                                                    <option value="ESTP">ESTP - Người thực thi</option>
                                                    <option value="ESFP">ESFP - Người trình diễn</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block">
                                                Nhóm tính cách DISC (Chọn tối đa 2 nhóm đặc trưng)
                                            </label>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {[
                                                    { id: 'D', label: 'D - Thống trị', desc: 'Quyết đoán, mạnh mẽ, tập trung kết quả', activeClass: 'border-rose-500 bg-rose-50/70 text-rose-700 ring-rose-100 ring-2' },
                                                    { id: 'I', label: 'I - Ảnh hưởng', desc: 'Năng động, thích giao tiếp, truyền cảm hứng', activeClass: 'border-amber-500 bg-amber-50/70 text-amber-700 ring-amber-100 ring-2' },
                                                    { id: 'S', label: 'S - Kiên định', desc: 'Kiên nhẫn, điềm đạm, thích ổn định & hỗ trợ', activeClass: 'border-emerald-500 bg-emerald-50/70 text-emerald-700 ring-emerald-100 ring-2' },
                                                    { id: 'C', label: 'C - Tuân thủ', desc: 'Kỷ luật, chính xác, thích số liệu logic', activeClass: 'border-indigo-500 bg-indigo-50/70 text-indigo-700 ring-indigo-100 ring-2' }
                                                ].map(type => {
                                                    const discVal = profile?.personality_disc || '';
                                                    const isSelected = discVal.includes(type.id);
                                                    const order = discVal.indexOf(type.id);
                                                    return (
                                                        <button
                                                            key={type.id}
                                                            type="button"
                                                            onClick={() => toggleDisc(type.id)}
                                                            className={`text-left p-3.5 rounded-2xl border transition-all select-none flex flex-col justify-between min-h-[90px] ${isSelected
                                                                ? type.activeClass
                                                                : 'border-gray-200 bg-gray-50/50 hover:bg-gray-100/50 text-gray-600'
                                                                }`}
                                                        >
                                                            <div className="flex justify-between items-center w-full">
                                                                <span className="font-bold text-sm">{type.label}</span>
                                                                {isSelected && (
                                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white font-extrabold shadow-sm border border-gray-100 uppercase shrink-0">
                                                                        {order === 0 ? 'Chính' : 'Phụ'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] opacity-75 mt-1.5 leading-normal">
                                                                {type.desc}
                                                            </p>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Trường Đại học</label>
                                                <input
                                                    type="text"
                                                    value={profile?.university || ''}
                                                    onChange={(e) => setProfile(prev => prev ? { ...prev, university: e.target.value } : null)}
                                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none font-medium transition-all text-sm"
                                                    placeholder="Ví dụ: ĐHQGHN"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Ngành học</label>
                                                <input
                                                    type="text"
                                                    value={profile?.major || ''}
                                                    onChange={(e) => setProfile(prev => prev ? { ...prev, major: e.target.value } : null)}
                                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none font-medium transition-all text-sm"
                                                    placeholder="Ví dụ: Công nghệ thông tin"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Định hướng nghề nghiệp</label>
                                                <input
                                                    type="text"
                                                    value={profile?.career_objective || ''}
                                                    onChange={(e) => setProfile(prev => prev ? { ...prev, career_objective: e.target.value } : null)}
                                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none font-medium transition-all text-sm"
                                                    placeholder="Ví dụ: Kỹ sư phần mềm"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Sở thích (Ngăn cách bằng dấu phẩy)</label>
                                            <input
                                                type="text"
                                                value={hobbiesInput}
                                                onChange={(e) => setHobbiesInput(e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none font-medium transition-all text-sm"
                                                placeholder="Ví dụ: Đọc sách, Chạy bộ, Code"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Châm ngôn sống</label>
                                            <input
                                                type="text"
                                                value={profile?.life_motto || ''}
                                                onChange={(e) => setProfile(prev => prev ? { ...prev, life_motto: e.target.value } : null)}
                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none font-medium transition-all text-sm"
                                                placeholder="Ví dụ: Sống hết mình mỗi ngày."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    )}

                    {/* NOTIFICATIONS TAB */}
                    {activeTab === 'notifications' && (
                        <div className="space-y-6">
                            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 rounded-2xl text-white shadow-lg mb-6">
                                <h3 className="font-bold text-lg flex items-center gap-2 mb-1"><Sparkles size={18} /> {t('settings.make_yours', lang)}</h3>
                                <p className="text-indigo-100 text-sm opacity-90">{t('settings.make_yours_desc', lang)}</p>
                            </div>

                            {/* Section: Master Push Notifications */}
                            <div className="space-y-3 mb-6">
                                <h4 className="text-sm font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-2"><Bell size={14} /> {t('settings.push_notif', lang)}</h4>
                                <div className="bg-indigo-50/50 rounded-2xl p-2 border border-indigo-100">
                                    <SwitchItem
                                        label={t('settings.push_allow', lang)}
                                        desc={t('settings.push_allow_desc', lang)}
                                        checked={notificationsEnabled || false}
                                        onChange={() => {
                                            if (toggleNotifications) toggleNotifications();
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Section: Timetable */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Calendar size={14} /> {t('settings.timetable', lang)}</h4>
                                <div className="bg-gray-50 rounded-2xl p-2 border border-gray-100">
                                    <SwitchItem
                                        label={t('settings.timetable_pre', lang)}
                                        desc={t('settings.timetable_pre_desc', lang)}
                                        checked={notiSettings.timetable_pre}
                                        onChange={() => toggleSetting('timetable_pre')}
                                    />
                                    <div className="h-px bg-gray-200 my-1 mx-4"></div>
                                    <SwitchItem
                                        label={t('settings.timetable_ontime', lang)}
                                        desc={t('settings.timetable_ontime_desc', lang)}
                                        checked={notiSettings.timetable}
                                        onChange={() => toggleSetting('timetable')}
                                    />
                                </div>
                            </div>

                            {/* Section: Calendar */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Moon size={14} /> {t('settings.calendar', lang)}</h4>
                                <div className="bg-gray-50 rounded-2xl p-2 border border-gray-100">
                                    <SwitchItem
                                        label={t('settings.calendar_lunar', lang)}
                                        desc={t('settings.calendar_lunar_desc', lang)}
                                        checked={notiSettings.calendar_lunar}
                                        onChange={() => toggleSetting('calendar_lunar')}
                                    />
                                    <div className="h-px bg-gray-200 my-1 mx-4"></div>
                                    <SwitchItem
                                        label={t('settings.calendar_holiday', lang)}
                                        desc={t('settings.calendar_holiday_desc', lang)}
                                        checked={notiSettings.calendar_holiday}
                                        onChange={() => toggleSetting('calendar_holiday')}
                                    />
                                </div>
                            </div>

                            {/* Section: Focus & Goals */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Zap size={14} /> {t('settings.focus_goals', lang)}</h4>
                                <div className="bg-gray-50 rounded-2xl p-2 border border-gray-100">
                                    <SwitchItem
                                        label={t('settings.focus_timer', lang)}
                                        desc={t('settings.focus_timer_desc', lang)}
                                        checked={notiSettings.focus_timer}
                                        onChange={() => toggleSetting('focus_timer')}
                                    />
                                    <div className="h-px bg-gray-200 my-1 mx-4"></div>
                                    <SwitchItem
                                        label={t('settings.goals_remind', lang)}
                                        desc={t('settings.goals_remind_desc', lang)}
                                        checked={notiSettings.goals_remind}
                                        onChange={() => toggleSetting('goals_remind')}
                                    />
                                    <div className="h-px bg-gray-200 my-1 mx-4"></div>
                                    <SwitchItem
                                        label={t('settings.todo_remind', lang)}
                                        desc={t('settings.todo_remind_desc', lang)}
                                        checked={notiSettings.todo_remind || false}
                                        onChange={() => toggleSetting('todo_remind')}
                                    />
                                </div>
                            </div>

                            {/* Section: Email Notifications */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-2">
                                    <Bell size={14} className="text-emerald-500" />
                                    {lang === 'vi' ? 'Thông báo qua Email' : lang === 'en' ? 'Email Notifications' : '이메일 알림'}
                                </h4>
                                <div className="bg-emerald-50/30 rounded-2xl p-2 border border-emerald-100/50">
                                    <SwitchItem
                                        label={lang === 'vi' ? 'Bật thông báo email' : lang === 'en' ? 'Enable email notifications' : '이메일 알림 활성화'}
                                        desc={lang === 'vi' ? 'Gửi email nhắc nhở khi đến hạn chót' : lang === 'en' ? 'Send reminder emails when approaching deadlines' : '마감일이 다가오면 알림 이메일 전송'}
                                        checked={profile?.email_notifications?.enabled || false}
                                        onChange={() => {
                                            setProfile(prev => {
                                                if (!prev) return null;
                                                const current = prev.email_notifications || {
                                                    enabled: false,
                                                    todo_deadline: true,
                                                    timetable_deadline: true,
                                                    calendar_deadline: true,
                                                    hours_before: 1
                                                };
                                                return {
                                                    ...prev,
                                                    email_notifications: {
                                                        ...current,
                                                        enabled: !current.enabled
                                                    }
                                                };
                                            });
                                        }}
                                    />
                                    {profile?.email_notifications?.enabled && (
                                        <>
                                            <div className="h-px bg-emerald-100/30 my-1 mx-4"></div>
                                            <SwitchItem
                                                label={lang === 'vi' ? 'Nhắc nhở công việc (Todo)' : lang === 'en' ? 'Task reminders (Todo)' : '할 일 알림'}
                                                desc={lang === 'vi' ? 'Gửi email cho các việc cần làm' : lang === 'en' ? 'Send email for todo items' : '할 일에 대한 이메일 보내기'}
                                                checked={profile.email_notifications.todo_deadline ?? true}
                                                onChange={() => {
                                                    setProfile(prev => {
                                                        if (!prev || !prev.email_notifications) return null;
                                                        return {
                                                            ...prev,
                                                            email_notifications: {
                                                                ...prev.email_notifications,
                                                                todo_deadline: !prev.email_notifications.todo_deadline
                                                            }
                                                        };
                                                    });
                                                }}
                                            />
                                            <div className="h-px bg-emerald-100/30 my-1 mx-4"></div>
                                            <SwitchItem
                                                label={lang === 'vi' ? 'Nhắc nhở lịch học/làm việc' : lang === 'en' ? 'Timetable reminders' : '시간표 알림'}
                                                desc={lang === 'vi' ? 'Gửi email nhắc thời khóa biểu cố định' : lang === 'en' ? 'Send email for fixed timetable events' : '고정 시간표 일정에 대한 이메일 보내기'}
                                                checked={profile.email_notifications.timetable_deadline ?? true}
                                                onChange={() => {
                                                    setProfile(prev => {
                                                        if (!prev || !prev.email_notifications) return null;
                                                        return {
                                                            ...prev,
                                                            email_notifications: {
                                                                ...prev.email_notifications,
                                                                timetable_deadline: !prev.email_notifications.timetable_deadline
                                                            }
                                                        };
                                                    });
                                                }}
                                            />
                                            <div className="h-px bg-emerald-100/30 my-1 mx-4"></div>
                                            <SwitchItem
                                                label={lang === 'vi' ? 'Nhắc nhở sự kiện lịch' : lang === 'en' ? 'Calendar reminders' : '달력 일정 알림'}
                                                desc={lang === 'vi' ? 'Gửi email nhắc nhở sự kiện cá nhân' : lang === 'en' ? 'Send email for personal calendar events' : '개인 달력 일정에 대한 이메일 보내기'}
                                                checked={profile.email_notifications.calendar_deadline ?? true}
                                                onChange={() => {
                                                    setProfile(prev => {
                                                        if (!prev || !prev.email_notifications) return null;
                                                        return {
                                                            ...prev,
                                                            email_notifications: {
                                                                ...prev.email_notifications,
                                                                calendar_deadline: !prev.email_notifications.calendar_deadline
                                                            }
                                                        };
                                                    });
                                                }}
                                            />
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* NAVIGATION TAB — Header Shortcuts */}
                    {activeTab === 'navigation' && (
                        <div className="space-y-6">
                            <div className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 p-4 rounded-2xl text-white shadow-lg mb-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 -translate-y-4 translate-x-4 opacity-10 pointer-events-none">
                                    <Smartphone size={120} />
                                </div>
                                <h3 className="font-bold text-lg flex items-center gap-2 mb-1">
                                    <Smartphone size={18} />
                                    {t('settings.navbar_title', lang)}
                                </h3>
                                <p className="text-indigo-100 text-xs opacity-90 leading-relaxed">
                                    {t('settings.navbar_desc', lang)}
                                </p>
                            </div>

                            {/* Theme/Appearance Section */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <Moon size={14} />
                                    {t('settings.theme_title', lang)}
                                </h4>
                                <p className="text-xs text-gray-400 font-medium -mt-1">
                                    {t('settings.theme_desc', lang)}
                                </p>

                                <div className="bg-gray-50 rounded-2xl p-2.5 border border-gray-100">
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'light', label: t('settings.theme_light', lang), icon: <Sun size={16} />, activeBg: 'bg-white text-amber-500 shadow-sm border border-amber-100/50' },
                                            { id: 'dark', label: t('settings.theme_dark', lang), icon: <Moon size={16} />, activeBg: 'bg-white text-indigo-500 shadow-sm border border-indigo-100/50' },
                                            { id: 'system', label: t('settings.theme_system', lang), icon: <Monitor size={16} />, activeBg: 'bg-white text-emerald-500 shadow-sm border border-emerald-100/50' }
                                        ].map((item) => {
                                            const isActive = tempTheme === item.id;
                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => setTempTheme(item.id as ThemeMode)}
                                                    className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-bold transition-all duration-200 select-none gap-1.5 border border-transparent
                                                        ${isActive
                                                            ? item.activeBg
                                                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200/50 hover:text-gray-600'}`}
                                                >
                                                    {item.icon}
                                                    <span>{item.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Header Shortcuts Section */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <Smartphone size={14} />
                                    Phím tắt thanh Header
                                </h4>
                                <p className="text-xs text-gray-400 font-medium -mt-1">
                                    Bật/tắt các nút truy cập nhanh trên thanh header mobile. Các tính năng này cũng có thể truy cập qua menu "Mở rộng" trên navbar.
                                </p>

                                <div className="bg-gray-50 rounded-2xl p-2 border border-gray-100 divide-y divide-gray-100">
                                    {/* My Spotify shortcut */}
                                    <div
                                        className="flex items-center justify-between p-3.5 rounded-xl hover:bg-white cursor-pointer group transition-all"
                                        onClick={() => setTempHeaderShortcuts(prev => ({ ...prev, spotify: !prev.spotify }))}
                                    >
                                        <div className="flex items-center gap-3 flex-1 pr-4">
                                            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                                                <Music size={18} className="text-emerald-600" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-gray-800 group-hover:text-emerald-600 transition-colors">My Spotify</div>
                                                <div className="text-xs text-gray-400 font-medium mt-0.5">Hiện nút Spotify trên header để mở nhanh</div>
                                            </div>
                                        </div>
                                        <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ease-in-out shrink-0 ${tempHeaderShortcuts.spotify ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                                            <div className={`bg-white w-5 h-5 rounded-full shadow-sm transform transition-transform duration-300 ease-in-out ${tempHeaderShortcuts.spotify ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </div>
                                    </div>

                                    {/* Habit streak shortcut */}
                                    <div
                                        className="flex items-center justify-between p-3.5 rounded-xl hover:bg-white cursor-pointer group transition-all"
                                        onClick={() => setTempHeaderShortcuts(prev => ({ ...prev, habit: !prev.habit }))}
                                    >
                                        <div className="flex items-center gap-3 flex-1 pr-4">
                                            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                                                <Flame size={18} className="text-orange-600" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-gray-800 group-hover:text-orange-600 transition-colors">Thói quen</div>
                                                <div className="text-xs text-gray-400 font-medium mt-0.5">Hiện nút Thói quen trên header để truy cập nhanh</div>
                                            </div>
                                        </div>
                                        <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ease-in-out shrink-0 ${tempHeaderShortcuts.habit ? 'bg-orange-500' : 'bg-gray-200'}`}>
                                            <div className={`bg-white w-5 h-5 rounded-full shadow-sm transform transition-transform duration-300 ease-in-out ${tempHeaderShortcuts.habit ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Cài đặt Todo Expiry */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <Clock size={14} />
                                    Tự động ẩn Todo đã hoàn thành
                                </h4>
                                <p className="text-xs text-gray-400 font-medium -mt-1">
                                    Tự động ẩn các nhiệm vụ đã hoàn thành ra khỏi danh sách sau một khoảng thời gian nhất định.
                                </p>

                                <div className="bg-gray-50 rounded-2xl p-2.5 border border-gray-100 space-y-2.5">
                                    <div 
                                        className="flex items-center justify-between hover:bg-white p-3.5 rounded-xl transition-all cursor-pointer group"
                                        onClick={() => setTodoExpiryEnabled(!todoExpiryEnabled)}
                                    >
                                        <div className="flex-1 pr-4">
                                            <div className="font-bold text-sm text-gray-800 group-hover:text-indigo-600 transition-colors">Bật tự động ẩn</div>
                                            <div className="text-xs text-gray-400 font-medium mt-0.5">Ẩn nhiệm vụ done sau số ngày cấu hình bên dưới</div>
                                        </div>
                                        <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ease-in-out shrink-0 ${todoExpiryEnabled ? 'bg-indigo-500' : 'bg-gray-200'}`}>
                                            <div className={`bg-white w-5 h-5 rounded-full shadow-sm transform transition-transform duration-300 ease-in-out ${todoExpiryEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </div>
                                    </div>

                                    {todoExpiryEnabled && (
                                        <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-gray-100 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <label className="font-bold text-sm text-gray-800">Ẩn sau số ngày:</label>
                                            <select
                                                value={todoExpiryDays}
                                                onChange={(e) => setTodoExpiryDays(parseInt(e.target.value, 10))}
                                                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 font-bold text-xs outline-none text-gray-700 focus:border-indigo-300"
                                            >
                                                <option value={30}>30 ngày</option>
                                                <option value={60}>60 ngày</option>
                                                <option value={90}>90 ngày</option>
                                                <option value={180}>180 ngày</option>
                                                <option value={365}>365 ngày</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Info about Expand Drawer */}
                            <div className="bg-violet-50/50 rounded-2xl p-4 border border-violet-100/50">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-violet-600">
                                            <rect width="7" height="7" x="3" y="3" rx="1" />
                                            <rect width="7" height="7" x="14" y="3" rx="1" />
                                            <rect width="7" height="7" x="14" y="14" rx="1" />
                                            <rect width="7" height="7" x="3" y="14" rx="1" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-violet-800">Menu Mở rộng</div>
                                        <p className="text-xs text-violet-600/80 font-medium mt-1 leading-relaxed">
                                            Tất cả tính năng phụ (GPA, Mục tiêu, Spotify, Nhật ký, Thói quen, Cài đặt) đều có trong menu "Mở rộng" ở thanh navbar bên dưới.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-100 bg-white flex justify-between gap-3 z-10">
                    <button
                        onClick={() => {
                            if (window.confirm(t('settings.signout_confirm', lang))) {
                                onSignOut();
                            }
                        }}
                        className="px-5 py-2.5 rounded-xl text-red-500 font-bold hover:bg-red-50 transition-colors flex items-center gap-2 text-sm"
                    >
                        <LogOut size={18} />
                        {t('settings.signout', lang)}
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl text-gray-500 font-bold hover:bg-gray-50 transition-colors text-sm"
                        >
                            {t('settings.close', lang)}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || loading}
                            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/95 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 active:scale-95 text-sm"
                        >
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {t('settings.save', lang)}
                        </button>
                    </div>
                </div>
            </div>

            {/* Document Lightbox Modal */}
            {activeLightboxField && (
                <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white rounded-[28px] overflow-hidden max-w-md w-full shadow-2xl flex flex-col max-h-[85vh] relative animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <span className="font-extrabold text-gray-800 text-sm">
                                {getFieldNameVi(activeLightboxField)} ({getDocImages(activeLightboxField).length}/2)
                            </span>
                            <button
                                onClick={() => setActiveLightboxField(null)}
                                className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Image list / upload slot */}
                        <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4 bg-gray-50/50 min-h-[300px] max-h-[60vh] scrollbar-thin">
                            {getDocImages(activeLightboxField).map((url, index) => (
                                <div key={index} className="relative group/img bg-white p-3 rounded-2xl border border-gray-150 shadow-sm flex flex-col items-center gap-2.5">
                                    <div 
                                        onClick={() => setZoomedImage(url)}
                                        className="relative cursor-zoom-in overflow-hidden rounded-xl w-full h-[200px] flex items-center justify-center bg-gray-100/40"
                                    >
                                        <img
                                            src={url}
                                            alt={`Ảnh ${index + 1}`}
                                            className="max-w-full max-h-full object-contain hover:scale-[1.02] transition-transform duration-200"
                                        />
                                        <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                                            <Eye size={20} className="text-white" />
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleDocumentDelete(activeLightboxField, index)}
                                        className="w-full py-2 rounded-xl text-red-500 bg-red-50/60 hover:bg-red-50 hover:text-red-600 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all active:scale-95"
                                    >
                                        <Trash2 size={13} /> Xóa ảnh {getDocImages(activeLightboxField).length > 1 ? index + 1 : ''}
                                    </button>
                                </div>
                            ))}
                            
                            {getDocImages(activeLightboxField).length < 2 && (
                                <button
                                    onClick={() => {
                                        const inputId = activeLightboxField === 'qr_code_url'
                                            ? 'qr-upload-input'
                                            : activeLightboxField === 'student_card_url'
                                                ? 'student-upload-input'
                                                : 'citizen-upload-input';
                                        document.getElementById(inputId)?.click();
                                    }}
                                    className="w-full aspect-video min-h-[140px] rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/20 flex flex-col items-center justify-center text-indigo-500 hover:bg-indigo-50/50 hover:text-indigo-600 transition-all font-black text-xs gap-2 py-4 cursor-pointer active:scale-95"
                                >
                                    <Plus size={22} className="stroke-[2.5]" />
                                    Tải lên ảnh thứ 2
                                </button>
                            )}
                        </div>

                        {/* Actions Footer */}
                        <div className="p-4 border-t border-gray-100 flex gap-2 justify-end bg-gray-50/20">
                            <button
                                type="button"
                                onClick={() => setActiveLightboxField(null)}
                                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs transition-all active:scale-95"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Fullscreen Zoom Overlay */}
            {zoomedImage && (
                <div 
                    onClick={() => setZoomedImage(null)}
                    className="fixed inset-0 bg-black/95 z-[110] flex items-center justify-center p-4 backdrop-blur-lg animate-in fade-in duration-200 cursor-zoom-out"
                >
                    <button 
                        onClick={() => setZoomedImage(null)}
                        className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                    <img 
                        src={zoomedImage} 
                        alt="Zoomed document" 
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
                    />
                </div>
            )}
        </div>
    );
};

// Helper Component for the Toggle Switch
const SwitchItem = ({ label, desc, checked, onChange }: { label: string, desc: string, checked: boolean, onChange: () => void }) => (
    <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white transition-colors cursor-pointer group" onClick={onChange}>
        <div className="flex-1 pr-4">
            <div className="font-bold text-gray-800 text-sm group-hover:text-indigo-700 transition-colors">{label}</div>
            <div className="text-xs text-gray-400 font-medium mt-0.5">{desc}</div>
        </div>
        <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ease-in-out ${checked ? 'bg-indigo-500' : 'bg-gray-200'}`}>
            <div className={`bg-white w-5 h-5 rounded-full shadow-sm transform transition-transform duration-300 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}></div>
        </div>
    </div>
);

// Custom Switch Component with Core/Lock Constraint Support
const SwitchItemWithLock = ({
    label,
    desc,
    checked,
    locked,
    onChange,
    lang
}: {
    label: string,
    desc: string,
    checked: boolean,
    locked: boolean,
    onChange: () => void,
    lang: Lang
}) => (
    <div
        className={`flex items-center justify-between p-3.5 rounded-xl transition-all select-none ${locked ? 'opacity-85 hover:bg-transparent cursor-not-allowed' : 'hover:bg-white cursor-pointer group'
            }`}
        onClick={locked ? undefined : onChange}
    >
        <div className="flex-1 pr-4">
            <div className="flex items-center gap-2">
                <span className={`font-bold text-sm transition-colors ${locked ? 'text-gray-700' : 'group-hover:text-indigo-600'
                    }`}>
                    {label}
                </span>
                {locked && (
                    <span className="flex items-center gap-0.5 text-[9px] bg-amber-50 text-amber-700 border border-amber-200/50 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider scale-95 origin-left select-none">
                        <Lock size={9} />
                        {t('settings.tab_required', lang)}
                    </span>
                )}
            </div>
            <div className="text-xs text-gray-400 font-medium mt-0.5 leading-relaxed">{desc}</div>
        </div>
        <div className={`w-12 h-7 rounded-full p-1 transition-all duration-300 ease-in-out shrink-0 ${checked ? (locked ? 'bg-gray-300' : 'bg-indigo-500') : 'bg-gray-200'
            }`}>
            <div className={`bg-white w-5 h-5 rounded-full shadow-sm transform transition-all duration-300 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'
                }`} />
        </div>
    </div>
);

export default SettingsModal;
