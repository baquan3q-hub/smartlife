import React, { useState, useEffect } from 'react';
import { X, User, Save, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Profile } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, userId }) => {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen && userId) {
            fetchProfile();
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
                console.error('Error fetching profile:', error);
                // Nếu chưa có profile thì có thể là lần đầu, không báo lỗi quá gắt
            }

            if (data) {
                setProfile(data);
            } else {
                // Initialize empty profile if none exists
                setProfile({ id: userId });
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!profile) return;
        setSaving(true);
        try {
            const updates = {
                id: userId,
                email: profile.email,
                full_name: profile.full_name,
                age: profile.age,
                job: profile.job,
                monthly_salary: profile.monthly_salary,
                currency: profile.currency,
                avatar_url: profile.avatar_url,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase.from('profiles').upsert(updates);

            if (error) throw error;
            alert('Cập nhật thành công!');
            onClose();
        } catch (error: any) {
            alert('Lỗi cập nhật: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                            <User size={20} />
                        </div>
                        Cài đặt tài khoản
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={profile?.email || ''}
                                    onChange={(e) => setProfile(prev => prev ? { ...prev, email: e.target.value } : null)}
                                    placeholder="example@email.com"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                />
                            </div>

                            {/* Full Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Họ và tên (Full Name)
                                </label>
                                <input
                                    type="text"
                                    value={profile?.full_name || ''}
                                    onChange={(e) => setProfile(prev => prev ? { ...prev, full_name: e.target.value } : null)}
                                    placeholder="Nguyễn Văn A"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Age */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Tuổi (Age)
                                    </label>
                                    <input
                                        type="number"
                                        value={profile?.age || ''}
                                        onChange={(e) => setProfile(prev => prev ? { ...prev, age: Number(e.target.value) } : null)}
                                        placeholder="25"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                    />
                                </div>

                                {/* Job */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Công việc (Job)
                                    </label>
                                    <input
                                        type="text"
                                        value={profile?.job || ''}
                                        onChange={(e) => setProfile(prev => prev ? { ...prev, job: e.target.value } : null)}
                                        placeholder="Developer"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Monthly Salary */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Lương tháng
                                    </label>
                                    <input
                                        type="text"
                                        value={profile?.monthly_salary !== undefined && profile?.monthly_salary !== null ? new Intl.NumberFormat('vi-VN').format(profile.monthly_salary) : ''}
                                        onChange={(e) => {
                                            const rawValue = e.target.value.replace(/\./g, '').replace(/,/g, '');
                                            if (rawValue === '') {
                                                setProfile(prev => prev ? { ...prev, monthly_salary: 0 } : null);
                                            } else if (!isNaN(Number(rawValue))) {
                                                setProfile(prev => prev ? { ...prev, monthly_salary: Number(rawValue) } : null);
                                            }
                                        }}
                                        placeholder="10.000.000"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                    />
                                </div>



                                {/* Currency */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Tiền tệ (Currency)
                                    </label>
                                    <select
                                        value={profile?.currency || 'VND'}
                                        onChange={(e) => setProfile(prev => prev ? { ...prev, currency: e.target.value } : null)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                    >
                                        <option value="VND">VND</option>
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="JPY">JPY</option>
                                    </select>
                                </div>
                            </div>

                            {/* Avatar URL */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Avatar URL
                                </label>
                                <input
                                    type="text"
                                    value={profile?.avatar_url || ''}
                                    onChange={(e) => setProfile(prev => prev ? { ...prev, avatar_url: e.target.value } : null)}
                                    placeholder="https://example.com/avatar.jpg"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                />
                                {profile?.avatar_url && (
                                    <div className="mt-2 flex justify-center">
                                        <img src={profile.avatar_url} alt="Avatar Preview" className="w-16 h-16 rounded-full object-cover border-2 border-indigo-100" onError={(e) => (e.currentTarget.src = 'https://ui-avatars.com/api/?name=' + (profile.full_name || 'User'))} />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-gray-600 font-medium hover:bg-gray-100 transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Lưu thay đổi
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
