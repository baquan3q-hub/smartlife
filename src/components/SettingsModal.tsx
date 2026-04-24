import React, { useState, useEffect } from 'react';
import { X, User, Save, Loader2, Bell, Calendar, Clock, Target, Moon, Zap, Sparkles, LogOut } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Profile } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    onSignOut: () => void;
    notificationsEnabled?: boolean;
    toggleNotifications?: () => void;
}

const DEFAULT_NOTI_SETTINGS = {
    timetable: true,
    timetable_pre: true,
    calendar_lunar: true,
    calendar_holiday: true,
    focus_timer: true,
    goals_remind: true
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, userId, onSignOut, notificationsEnabled, toggleNotifications }) => {
    const [activeTab, setActiveTab] = useState<'profile' | 'notifications'>('profile');
    const [profile, setProfile] = useState<Profile | null>(null);
    const [notiSettings, setNotiSettings] = useState(DEFAULT_NOTI_SETTINGS);
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
        }
    }, [isOpen, userId]);

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

            // 2. Save Settings
            localStorage.setItem('smartlife_noti_settings', JSON.stringify(notiSettings));

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
                    <h2 className="text-xl font-bold text-gray-800">Cài đặt</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex px-5 pt-2 gap-4 border-b border-gray-50 bg-gray-50/30">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'profile' ? 'text-indigo-600 border-indigo-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                    >
                        <User size={18} /> Hồ sơ cá nhân
                    </button>
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'notifications' ? 'text-emerald-600 border-emerald-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                    >
                        <Bell size={18} /> Thông báo & Nhắc nhở
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
                                            <span className="text-white text-xs font-bold">Đổi ảnh</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Họ và tên</label>
                                        <input
                                            type="text"
                                            value={profile?.full_name || ''}
                                            onChange={(e) => setProfile(prev => prev ? { ...prev, full_name: e.target.value } : null)}
                                            className="w-full px-4 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none font-medium transition-all"
                                            placeholder="Nhập tên của bạn..."
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Công việc</label>
                                            <input
                                                type="text"
                                                value={profile?.job || ''}
                                                onChange={(e) => setProfile(prev => prev ? { ...prev, job: e.target.value } : null)}
                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none font-medium transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Tuổi</label>
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
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Mức lương tháng</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={profile?.monthly_salary || ''}
                                                    onChange={(e) => setProfile(prev => prev ? { ...prev, monthly_salary: Number(e.target.value) } : null)}
                                                    className="w-full pl-4 pr-10 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none font-medium transition-all"
                                                    placeholder="0"
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">đ</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Công ty / Trường học</label>
                                            <input
                                                type="text"
                                                value={profile?.workplace || ''}
                                                onChange={(e) => setProfile(prev => prev ? { ...prev, workplace: e.target.value } : null)}
                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none font-medium transition-all"
                                                placeholder="Nhập nơi làm việc/học tập..."
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Avatar URL</label>
                                        <input
                                            type="text"
                                            value={profile?.avatar_url || ''}
                                            onChange={(e) => setProfile(prev => prev ? { ...prev, avatar_url: e.target.value } : null)}
                                            className="w-full px-4 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none font-medium transition-all text-sm text-gray-600"
                                            placeholder="Link ảnh..."
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
                                <h3 className="font-bold text-lg flex items-center gap-2 mb-1"><Sparkles size={18} /> Make it Yours</h3>
                                <p className="text-indigo-100 text-sm opacity-90">Tùy chỉnh cách SmartLife làm phiền bạn (một cách đáng yêu). 💖</p>
                            </div>

                            {/* Section: Master Push Notifications */}
                            <div className="space-y-3 mb-6">
                                <h4 className="text-sm font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-2"><Bell size={14} /> Thông báo đẩy (Push)</h4>
                                <div className="bg-indigo-50/50 rounded-2xl p-2 border border-indigo-100">
                                    <SwitchItem
                                        label="Cho phép gửi thông báo"
                                        desc="Nhận thông báo ngay cả khi không mở app."
                                        checked={notificationsEnabled || false}
                                        onChange={() => {
                                            if (toggleNotifications) toggleNotifications();
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Section: Timetable */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Calendar size={14} /> Thời khóa biểu</h4>
                                <div className="bg-gray-50 rounded-2xl p-2 border border-gray-100">
                                    <SwitchItem
                                        label="Báo trước 15 phút"
                                        desc="Để kịp chuẩn bị tinh thần, makeup sương sương."
                                        checked={notiSettings.timetable_pre}
                                        onChange={() => toggleSetting('timetable_pre')}
                                    />
                                    <div className="h-px bg-gray-200 my-1 mx-4"></div>
                                    <SwitchItem
                                        label="Báo đúng giờ"
                                        desc="Đing đong! Đến giờ chạy deadline rồi."
                                        checked={notiSettings.timetable}
                                        onChange={() => toggleSetting('timetable')}
                                    />
                                </div>
                            </div>

                            {/* Section: Calendar */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Moon size={14} /> Lịch Vạn Niên</h4>
                                <div className="bg-gray-50 rounded-2xl p-2 border border-gray-100">
                                    <SwitchItem
                                        label="Rằm & Mùng 1"
                                        desc="Nhắc nhẹ để ăn chay hoặc thắp hương."
                                        checked={notiSettings.calendar_lunar}
                                        onChange={() => toggleSetting('calendar_lunar')}
                                    />
                                    <div className="h-px bg-gray-200 my-1 mx-4"></div>
                                    <SwitchItem
                                        label="Lễ Tết Việt Nam"
                                        desc="Đếm ngược đến ngày được nghỉ xả hơi!"
                                        checked={notiSettings.calendar_holiday}
                                        onChange={() => toggleSetting('calendar_holiday')}
                                    />
                                </div>
                            </div>

                            {/* Section: Focus & Goals */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Zap size={14} /> Focus & Goals</h4>
                                <div className="bg-gray-50 rounded-2xl p-2 border border-gray-100">
                                    <SwitchItem
                                        label="Bấm giờ tập trung"
                                        desc="Thông báo khi hoàn thành phiên Pomodoro."
                                        checked={notiSettings.focus_timer}
                                        onChange={() => toggleSetting('focus_timer')}
                                    />
                                    <div className="h-px bg-gray-200 my-1 mx-4"></div>
                                    <SwitchItem
                                        label="Nhắc nhở Mục tiêu"
                                        desc="Động lực mỗi ngày để không quên ước mơ."
                                        checked={notiSettings.goals_remind}
                                        onChange={() => toggleSetting('goals_remind')}
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
                            if (window.confirm('Bạn có chắc chắn muốn đăng xuất không?')) {
                                onSignOut();
                            }
                        }}
                        className="px-5 py-2.5 rounded-xl text-red-500 font-bold hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                        <LogOut size={18} />
                        Đăng xuất
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl text-gray-500 font-bold hover:bg-gray-50 transition-colors"
                        >
                            Đóng
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || loading}
                            className="px-6 py-2.5 rounded-xl bg-gray-900 text-white font-bold hover:bg-black transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 active:scale-95"
                        >
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            Lưu cài đặt
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

export default SettingsModal;
