import React, { useEffect, useState } from 'react';
import { X, Sparkles, LayoutDashboard, BrainCircuit, Wallet, CalendarDays, Flame, Music, GraduationCap, Clock, Archive, BookOpen, Target } from 'lucide-react';

interface WelcomeTourModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const features = [
    { icon: <LayoutDashboard size={20} className="text-blue-500" />, title: 'Visual Board', desc: 'Trực quan hóa bức tranh toàn bộ cuộc sống của bạn' },
    { icon: <BrainCircuit size={20} className="text-purple-500" />, title: 'AI Advisor', desc: 'Trợ lý thông minh hành động và phân tích all your data' },
    { icon: <Wallet size={20} className="text-emerald-500" />, title: 'Tài chính', desc: 'Kiểm soát thu chi, báo cáo trực quan' },
    { icon: <CalendarDays size={20} className="text-indigo-500" />, title: 'Lịch trình', desc: 'Sắp xếp thời gian, Todo list thông minh và đặt mục tiêu cá' },
    { icon: <Flame size={20} className="text-orange-500" />, title: 'Thói quen', desc: 'Hình thành habit bằng cơ chế đổi thưởng dopamine, countdown/up' },
    { icon: <BookOpen size={20} className="text-emerald-600" />, title: 'Nhật ký cá nhân', desc: 'Chữa lành, mood tracker & đồng bộ dữ liệu với AI' },
    { icon: <Target size={20} className="text-purple-600" />, title: 'Mục tiêu & Lộ trình', desc: 'Lập kế hoạch sự nghiệp, mục tiêu 5 năm & AI định hướng lộ trình' },
    { icon: <Clock size={20} className="text-rose-500" />, title: 'Pomodoro', desc: 'Tập trung cao độ với bộ đếm giờ' },
    { icon: <GraduationCap size={20} className="text-cyan-500" />, title: 'GPA Tracker', desc: 'Quản lý điểm số, đặt mục tiêu học tập' },
    { icon: <Music size={20} className="text-pink-500" />, title: 'My Spotify', desc: 'Nghe nhạc & Podcast không giới hạn' },
    { icon: <Archive size={20} className="text-amber-500" />, title: 'My Storage', desc: 'Kho lưu trữ đa phương tiện bảo mật' },
];

const WelcomeTourModal: React.FC<WelcomeTourModalProps> = ({ isOpen, onClose }) => {
    const [timeLeft, setTimeLeft] = useState(15); // Tăng lên 15s vì có nhiều chữ để đọc
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        // Đếm ngược
        const timer = setInterval(() => {
            if (!isHovered) {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        onClose();
                        return 0;
                    }
                    return prev - 1;
                });
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [isOpen, isHovered, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
                onClick={onClose}
            ></div>

            {/* Modal */}
            <div
                className="relative bg-white w-full max-w-3xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-500 ease-out flex flex-col max-h-[90vh]"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Header Decoration */}
                <div className="absolute top-[-50px] left-[-50px] w-64 h-64 bg-indigo-400 rounded-full mix-blend-multiply filter blur-[80px] opacity-30 animate-pulse"></div>
                <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-pink-400 rounded-full mix-blend-multiply filter blur-[80px] opacity-30 animate-pulse" style={{ animationDelay: '2s' }}></div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors z-10"
                >
                    <X size={20} />
                </button>

                <div className="p-6 sm:p-8 flex flex-col h-full overflow-y-auto custom-scrollbar relative z-10">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mb-4 shadow-inner">
                            <Sparkles size={32} />
                        </div>
                        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
                            Chào mừng đến với SmartLife! 🎉
                        </h2>
                        <p className="text-gray-500 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
                            Super tool cá nhân hóa "All-in-One". Bạn không cần dùng nhiều app khác nhau nữa.
                            <br />Tất cả mọi thứ bạn cần để làm chủ cuộc sống đều ở đây!
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-8">
                        {features.map((feat, idx) => (
                            <div
                                key={idx}
                                className="p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-xl bg-white shadow-sm group-hover:scale-110 transition-transform">
                                        {feat.icon}
                                    </div>
                                    <h3 className="font-bold text-gray-800 text-sm">{feat.title}</h3>
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed pl-1">
                                    {feat.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer with Progress Bar */}
                <div className="bg-gray-50 p-4 border-t border-gray-100 relative overflow-hidden shrink-0">
                    <div className="flex items-center justify-between relative z-10">
                        <p className="text-xs font-medium text-gray-400">
                            {isHovered ? 'Xin hãy đọc pls...Tks' : `Tự động đóng sau ${timeLeft} giây`}
                        </p>
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition-colors shadow-md hover:shadow-lg"
                        >
                            Khám phá ngay
                        </button>
                    </div>
                    {/* Progress Bar Line */}
                    <div className="absolute bottom-0 left-0 h-1 bg-gray-200 w-full">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 transition-all ease-linear"
                            style={{
                                width: `${(timeLeft / 15) * 100}%`,
                                transitionDuration: isHovered ? '0s' : '1s'
                            }}
                        ></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WelcomeTourModal;
