import React, { useState } from 'react';
import { 
    GraduationCap, Target, Music, BookOpen, Flame, Settings, 
    QrCode, CreditCard, Contact, Camera, Trash2, X, Sparkles, Plus, Eye 
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { Profile } from '../types';

interface ExpandSectionProps {
    userId: string;
    profile: Profile | null;
    onNavigate: (tab: string) => void;
    onOpenSettings: () => void;
    onOpenSpotify: () => void;
    onRefreshProfile: () => void;
}

const EXPAND_ITEMS = [
    {
        id: 'gpa',
        label: 'Điểm GPA',
        desc: 'Theo dõi điểm số & kế hoạch học tập',
        icon: GraduationCap,
        gradient: 'from-purple-500 to-violet-600',
        bg: 'bg-purple-50',
        iconColor: 'text-purple-600',
        shadowColor: 'shadow-purple-200/60',
        action: 'navigate',
    },
    {
        id: 'goals',
        label: 'Mục tiêu',
        desc: 'Quản lý mục tiêu & lộ trình sự nghiệp',
        icon: Target,
        gradient: 'from-blue-500 to-indigo-600',
        bg: 'bg-blue-50',
        iconColor: 'text-blue-600',
        shadowColor: 'shadow-blue-200/60',
        action: 'navigate',
    },
    {
        id: 'spotify',
        label: 'My Spotify',
        desc: 'Nghe nhạc & quản lý playlist cá nhân',
        icon: Music,
        gradient: 'from-emerald-500 to-green-600',
        bg: 'bg-emerald-50',
        iconColor: 'text-emerald-600',
        shadowColor: 'shadow-emerald-200/60',
        action: 'spotify',
    },
    {
        id: 'journal',
        label: 'Nhật ký',
        desc: 'Ghi chép suy nghĩ & theo dõi cảm xúc',
        icon: BookOpen,
        gradient: 'from-amber-400 to-orange-500',
        bg: 'bg-amber-50',
        iconColor: 'text-amber-600',
        shadowColor: 'shadow-amber-200/60',
        action: 'navigate',
    },
    {
        id: 'habit',
        label: 'Thói quen',
        desc: 'Xây dựng & duy trì thói quen hàng ngày',
        icon: Flame,
        gradient: 'from-orange-500 to-red-500',
        bg: 'bg-orange-50',
        iconColor: 'text-orange-600',
        shadowColor: 'shadow-orange-200/60',
        action: 'navigate',
    },
    {
        id: 'settings',
        label: 'Cài đặt',
        desc: 'Tùy chỉnh hồ sơ & cấu hình ứng dụng',
        icon: Settings,
        gradient: 'from-gray-500 to-slate-600',
        bg: 'bg-gray-50',
        iconColor: 'text-gray-600',
        shadowColor: 'shadow-gray-200/60',
        action: 'settings',
    },
];

const ExpandSection: React.FC<ExpandSectionProps> = ({
    userId,
    profile,
    onNavigate,
    onOpenSettings,
    onOpenSpotify,
    onRefreshProfile,
}) => {
    const [activeLightbox, setActiveLightbox] = useState<{ field: 'qr_code_url' | 'student_card_url' | 'citizen_card_url', url: string } | null>(null);

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
                    ctx?.drawImage(img, 0, 0, width, height);

                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(dataUrl);
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
            const { error } = await supabase.from('profiles').update({ avatar_url: compressed }).eq('id', userId);
            if (error) throw error;
            onRefreshProfile();
        } catch (err) {
            console.error(err);
            alert('Không thể tải lên ảnh đại diện.');
        }
    };

    const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'qr_code_url' | 'student_card_url' | 'citizen_card_url') => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const compressed = await compressImageToBase64(file, 800, 0.75);
            const { error } = await supabase.from('profiles').update({ [field]: compressed }).eq('id', userId);
            if (error) throw error;
            onRefreshProfile();
        } catch (err) {
            console.error(err);
            alert('Không thể tải lên tài liệu.');
        }
    };

    const handleDocDelete = async (field: 'qr_code_url' | 'student_card_url' | 'citizen_card_url') => {
        if (window.confirm('Bạn có chắc chắn muốn xóa tài liệu này?')) {
            try {
                const { error } = await supabase.from('profiles').update({ [field]: null }).eq('id', userId);
                if (error) throw error;
                setActiveLightbox(null);
                onRefreshProfile();
            } catch (err) {
                console.error(err);
                alert('Không thể xóa tài liệu.');
            }
        }
    };

    const getFieldNameVi = (field: string) => {
        if (field === 'qr_code_url') return 'Mã QR Cá Nhân';
        if (field === 'student_card_url') return 'Thẻ Sinh Viên';
        if (field === 'citizen_card_url') return 'Căn Cước Công Dân';
        return 'Tài liệu';
    };

    const handleItemClick = (item: typeof EXPAND_ITEMS[0]) => {
        if (item.action === 'settings') {
            onOpenSettings();
        } else if (item.action === 'spotify') {
            onOpenSpotify();
        } else {
            onNavigate(item.id);
        }
    };

    return (
        <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Hidden Document Inputs */}
            <input type="file" id="expand-qr-upload" accept="image/*" className="hidden" onChange={(e) => handleDocUpload(e, 'qr_code_url')} />
            <input type="file" id="expand-student-upload" accept="image/*" className="hidden" onChange={(e) => handleDocUpload(e, 'student_card_url')} />
            <input type="file" id="expand-citizen-upload" accept="image/*" className="hidden" onChange={(e) => handleDocUpload(e, 'citizen_card_url')} />

            {/* Centered Profile Header */}
            <div className="flex flex-col items-center text-center mt-2 mb-4 bg-gradient-to-b from-indigo-50/40 via-white/50 to-transparent p-6 rounded-3xl border border-indigo-50/20">
                <div className="relative group cursor-pointer" onClick={() => document.getElementById('section-avatar-upload')?.click()}>
                    <img
                        src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.full_name || 'User'}&background=6366F1&color=fff`}
                        alt="Avatar"
                        className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-xl ring-4 ring-indigo-50/80 transition-transform duration-300 hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera size={18} className="text-white" />
                    </div>
                    <input
                        type="file"
                        id="section-avatar-upload"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                    />
                </div>
                <h2 className="text-xl font-black text-gray-800 mt-4 leading-tight">{profile?.full_name || 'Học viên SmartLife'}</h2>
                <p className="text-xs text-gray-400 font-medium mt-1">{profile?.email || 'Chưa liên kết email'}</p>
                {profile?.job && (
                    <span className="mt-2.5 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black tracking-wider uppercase flex items-center gap-1.5 shadow-sm border border-indigo-100/30">
                        <Sparkles size={10} /> {profile.job}
                    </span>
                )}
            </div>

            {/* Document Wallet Card Row */}
            <div className="bg-white rounded-[28px] p-5 border border-gray-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between px-1">
                    <div>
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Ví tài liệu cá nhân</h3>
                        <p className="text-[10px] text-gray-400 mt-0.5">Click để xem nhanh ảnh tài liệu của bạn</p>
                    </div>
                    <span className="text-[9px] text-indigo-600 bg-indigo-50 font-bold px-2 py-0.5 rounded-full border border-indigo-100/30">
                        Take Anywhere
                    </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    {/* QR Card */}
                    <button
                        onClick={() => {
                            if (profile?.qr_code_url) {
                                setActiveLightbox({ field: 'qr_code_url', url: profile.qr_code_url });
                            } else {
                                document.getElementById('expand-qr-upload')?.click();
                            }
                        }}
                        className={`aspect-video rounded-2xl flex flex-col items-center justify-center border-2 p-2 relative overflow-hidden select-none transition-all duration-200 active:scale-95 group/doc
                            ${profile?.qr_code_url 
                                ? 'border-indigo-100 bg-white hover:border-indigo-300 shadow-sm' 
                                : 'border-dashed border-gray-200 bg-gray-50/50 hover:bg-gray-100 text-gray-400'}`}
                    >
                        {profile?.qr_code_url ? (
                            <>
                                <img src={profile.qr_code_url} alt="QR" className="absolute inset-0 w-full h-full object-cover group-hover/doc:scale-105 transition-transform" />
                                <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover/doc:opacity-100 transition-opacity">
                                    <Eye size={16} className="text-white" />
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center text-center gap-1.5">
                                <QrCode size={20} className="text-gray-400 group-hover/doc:text-indigo-500 transition-colors" />
                                <span className="text-[9px] font-black tracking-wide">Mã QR</span>
                            </div>
                        )}
                    </button>

                    {/* Student Card */}
                    <button
                        onClick={() => {
                            if (profile?.student_card_url) {
                                setActiveLightbox({ field: 'student_card_url', url: profile.student_card_url });
                            } else {
                                document.getElementById('expand-student-upload')?.click();
                            }
                        }}
                        className={`aspect-video rounded-2xl flex flex-col items-center justify-center border-2 p-2 relative overflow-hidden select-none transition-all duration-200 active:scale-95 group/doc
                            ${profile?.student_card_url 
                                ? 'border-indigo-100 bg-white hover:border-indigo-300 shadow-sm' 
                                : 'border-dashed border-gray-200 bg-gray-50/50 hover:bg-gray-100 text-gray-400'}`}
                    >
                        {profile?.student_card_url ? (
                            <>
                                <img src={profile.student_card_url} alt="Thẻ SV" className="absolute inset-0 w-full h-full object-cover group-hover/doc:scale-105 transition-transform" />
                                <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover/doc:opacity-100 transition-opacity">
                                    <Eye size={16} className="text-white" />
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center text-center gap-1.5">
                                <CreditCard size={20} className="text-gray-400 group-hover/doc:text-indigo-500 transition-colors" />
                                <span className="text-[9px] font-black tracking-wide">Thẻ SV</span>
                            </div>
                        )}
                    </button>

                    {/* CCCD Card */}
                    <button
                        onClick={() => {
                            if (profile?.citizen_card_url) {
                                setActiveLightbox({ field: 'citizen_card_url', url: profile.citizen_card_url });
                            } else {
                                document.getElementById('expand-citizen-upload')?.click();
                            }
                        }}
                        className={`aspect-video rounded-2xl flex flex-col items-center justify-center border-2 p-2 relative overflow-hidden select-none transition-all duration-200 active:scale-95 group/doc
                            ${profile?.citizen_card_url 
                                ? 'border-indigo-100 bg-white hover:border-indigo-300 shadow-sm' 
                                : 'border-dashed border-gray-200 bg-gray-50/50 hover:bg-gray-100 text-gray-400'}`}
                    >
                        {profile?.citizen_card_url ? (
                            <>
                                <img src={profile.citizen_card_url} alt="CCCD" className="absolute inset-0 w-full h-full object-cover group-hover/doc:scale-105 transition-transform" />
                                <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover/doc:opacity-100 transition-opacity">
                                    <Eye size={16} className="text-white" />
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center text-center gap-1.5">
                                <Contact size={20} className="text-gray-400 group-hover/doc:text-indigo-500 transition-colors" />
                                <span className="text-[9px] font-black tracking-wide">CCCD</span>
                            </div>
                        )}
                    </button>
                </div>
            </div>

            {/* Extended Features Grid */}
            <div className="bg-white rounded-[28px] p-5 border border-gray-100 shadow-sm space-y-4">
                <div className="px-1">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Tính năng mở rộng</h3>
                    <p className="text-[10px] text-gray-400 mt-0.5">Lối tắt thao tác nhanh các tiện ích</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    {EXPAND_ITEMS.map((item) => {
                        const IconComponent = item.icon;
                        return (
                            <button
                                key={item.id}
                                onClick={() => handleItemClick(item)}
                                className={`flex flex-col items-center p-3 rounded-2xl border border-gray-100 bg-white hover:shadow-md ${item.shadowColor} transition-all duration-200 active:scale-95 group relative overflow-hidden`}
                            >
                                <div className={`w-11 h-11 rounded-2xl ${item.bg} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                                    <IconComponent size={20} className={`${item.iconColor}`} strokeWidth={2.2} />
                                </div>
                                <span className="text-[10px] font-bold text-gray-800 text-center leading-tight tracking-tight">
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Document Lightbox Zoom Modal */}
            {activeLightbox && (
                <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white rounded-[28px] overflow-hidden max-w-md w-full shadow-2xl flex flex-col max-h-[85vh] relative animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <span className="font-extrabold text-gray-800 text-sm">{getFieldNameVi(activeLightbox.field)}</span>
                            <button
                                onClick={() => setActiveLightbox(null)}
                                className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Image View */}
                        <div className="p-5 flex-1 overflow-y-auto flex items-center justify-center bg-gray-50/50 min-h-[300px]">
                            <img
                                src={activeLightbox.url}
                                alt="Tài liệu"
                                className="max-w-full max-h-[50vh] object-contain rounded-xl shadow-md border border-gray-200"
                            />
                        </div>

                        {/* Actions Footer */}
                        <div className="p-4 border-t border-gray-100 flex gap-2 justify-between bg-gray-50/20">
                            <button
                                type="button"
                                onClick={() => handleDocDelete(activeLightbox.field)}
                                className="px-4 py-2 rounded-xl text-red-500 hover:bg-red-50 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
                            >
                                <Trash2 size={14} /> Xóa ảnh
                            </button>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const inputId = activeLightbox.field === 'qr_code_url'
                                            ? 'expand-qr-upload'
                                            : activeLightbox.field === 'student_card_url'
                                                ? 'expand-student-upload'
                                                : 'expand-citizen-upload';
                                        document.getElementById(inputId)?.click();
                                        setActiveLightbox(null);
                                    }}
                                    className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
                                >
                                    Thay đổi
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveLightbox(null)}
                                    className="px-5 py-2 rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-xs transition-all active:scale-95"
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpandSection;
