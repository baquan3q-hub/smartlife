import React, { useState, useEffect } from 'react';
import { X, User, Save, Loader2, Bell, Calendar, Clock, Target, Moon, Zap, Sparkles, LogOut, Smartphone, Lock } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Profile } from '../types';
import { Lang, t } from '../i18n/i18n';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    onSignOut: () => void;
    notificationsEnabled?: boolean;
    toggleNotifications?: () => void;
    lang: Lang;
    setLang: (lang: Lang) => void;
    visibleMobileTabs: string[];
    onUpdateVisibleMobileTabs: (tabs: string[]) => void;
}

const DEFAULT_NOTI_SETTINGS = {
    timetable: true,
    timetable_pre: true,
    calendar_lunar: true,
    calendar_holiday: true,
    focus_timer: true,
    goals_remind: true
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
    visibleMobileTabs,
    onUpdateVisibleMobileTabs
}) => {
    const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'navigation'>('profile');
    const [profile, setProfile] = useState<Profile | null>(null);
    const [notiSettings, setNotiSettings] = useState(DEFAULT_NOTI_SETTINGS);
    const [tempVisibleTabs, setTempVisibleTabs] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

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
            // Sync mobile visible tabs temp state
            setTempVisibleTabs([...visibleMobileTabs]);
        }
    }, [isOpen, userId, visibleMobileTabs]);

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

    const handleToggleTab = (tabId: string) => {
        // Enforce constraint: visual, finance, and schedule CANNOT be toggled off.
        if (['visual', 'finance', 'schedule'].includes(tabId)) return;

        setTempVisibleTabs(prev => {
            if (prev.includes(tabId)) {
                return prev.filter(t => t !== tabId);
            } else {
                return [...prev, tabId];
            }
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
                    updated_at: new Date().toISOString(),
                };
                const { error } = await supabase.from('profiles').upsert(updates);
                if (error) throw error;
            }

            // 2. Save Notification Settings
            localStorage.setItem('smartlife_noti_settings', JSON.stringify(notiSettings));

            // 3. Save Navigation Settings
            localStorage.setItem(`smartlife_visible_tabs_${userId}`, JSON.stringify(tempVisibleTabs));
            onUpdateVisibleMobileTabs(tempVisibleTabs);

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
                <div className="flex px-5 pt-2 gap-4 border-b border-gray-50 bg-gray-50/30 overflow-x-auto scrollbar-none">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 ${activeTab === 'profile' ? 'text-indigo-600 border-indigo-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                    >
                        <User size={18} /> {t('settings.profile', lang)}
                    </button>
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 ${activeTab === 'notifications' ? 'text-emerald-600 border-emerald-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                    >
                        <Bell size={18} /> {t('settings.notifications', lang)}
                    </button>
                    <button
                        onClick={() => setActiveTab('navigation')}
                        className={`py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 ${activeTab === 'navigation' ? 'text-indigo-600 border-indigo-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                    >
                        <Smartphone size={18} /> {t('settings.navbar', lang)}
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">

                    {/* PROFILE TAB */}
                    {activeTab === 'profile' && (
                        loading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                            </div>
                        ) : (
                            <div className="space-y-5">
                                <div className="flex justify-center mb-6">
                                    <div className="relative group cursor-pointer">
                                        <img
                                            src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.full_name || 'User'}`}
                                            alt="Avatar"
                                            className="w-24 h-24 rounded-full object-cover border-4 border-indigo-50 shadow-sm"
                                        />
                                        <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-white text-xs font-bold">{t('settings.change_avatar', lang)}</span>
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
                                            className="w-full px-4 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none font-medium transition-all text-sm text-gray-600"
                                            placeholder={t('settings.avatar_url_placeholder', lang)}
                                        />
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
                                </div>
                            </div>
                        </div>
                    )}

                    {/* NAVIGATION TAB */}
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

                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <Smartphone size={14} />
                                    {t('settings.tabs_title', lang)}
                                </h4>
                                
                                <div className="bg-gray-50 rounded-2xl p-2 border border-gray-100 divide-y divide-gray-100">
                                    {/* 1. Tổng quan */}
                                    <SwitchItemWithLock
                                        label={t('tab.overview', lang)}
                                        desc={t('tab.overview_desc', lang)}
                                        checked={true}
                                        locked={true}
                                        onChange={() => {}}
                                        lang={lang}
                                    />

                                    {/* 2. Tài chính */}
                                    <SwitchItemWithLock
                                        label={t('tab.finance', lang)}
                                        desc={t('tab.finance_desc', lang)}
                                        checked={true}
                                        locked={true}
                                        onChange={() => {}}
                                        lang={lang}
                                    />

                                    {/* 3. Lịch trình */}
                                    <SwitchItemWithLock
                                        label={t('tab.schedule', lang)}
                                        desc={t('tab.schedule_desc', lang)}
                                        checked={true}
                                        locked={true}
                                        onChange={() => {}}
                                        lang={lang}
                                    />

                                    {/* 4. Nhật ký */}
                                    <SwitchItemWithLock
                                        label={t('tab.journal', lang)}
                                        desc={t('tab.journal_desc', lang)}
                                        checked={tempVisibleTabs.includes('journal')}
                                        locked={false}
                                        onChange={() => handleToggleTab('journal')}
                                        lang={lang}
                                    />

                                    {/* 5. Thói quen */}
                                    <SwitchItemWithLock
                                        label={t('tab.habit', lang)}
                                        desc={t('tab.habit_desc', lang)}
                                        checked={tempVisibleTabs.includes('habit')}
                                        locked={false}
                                        onChange={() => handleToggleTab('habit')}
                                        lang={lang}
                                    />

                                    {/* 6. GPA Tracker */}
                                    <SwitchItemWithLock
                                        label={t('tab.gpa', lang)}
                                        desc={t('tab.gpa_desc', lang)}
                                        checked={tempVisibleTabs.includes('gpa')}
                                        locked={false}
                                        onChange={() => handleToggleTab('gpa')}
                                        lang={lang}
                                    />
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
                            className="px-6 py-2.5 rounded-xl bg-gray-900 text-white font-bold hover:bg-black transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 active:scale-95 text-sm"
                        >
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {t('settings.save', lang)}
                        </button>
                    </div>
                </div>
            </div>
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
        className={`flex items-center justify-between p-3.5 rounded-xl transition-all select-none ${
            locked ? 'opacity-85 hover:bg-transparent cursor-not-allowed' : 'hover:bg-white cursor-pointer group'
        }`}
        onClick={locked ? undefined : onChange}
    >
        <div className="flex-1 pr-4">
            <div className="flex items-center gap-2">
                <span className={`font-bold text-sm transition-colors ${
                    locked ? 'text-gray-700' : 'group-hover:text-indigo-600'
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
        <div className={`w-12 h-7 rounded-full p-1 transition-all duration-300 ease-in-out shrink-0 ${
            checked ? (locked ? 'bg-gray-300' : 'bg-indigo-500') : 'bg-gray-200'
        }`}>
            <div className={`bg-white w-5 h-5 rounded-full shadow-sm transform transition-all duration-300 ease-in-out ${
                checked ? 'translate-x-5' : 'translate-x-0'
            }`} />
        </div>
    </div>
);

export default SettingsModal;
