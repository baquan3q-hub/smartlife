// File: src/components/ProGateOverlay.tsx
import React from 'react';
import { Lock, Crown, Sparkles, CalendarDays, Brain, LayoutDashboard, Flame, Star, Zap, TrendingUp, Trophy, BookOpen, Briefcase, FileText, Target } from 'lucide-react';

interface ProGateOverlayProps {
  featureName: string;
  featureIcon?: React.ReactNode;
  onUpgrade: () => void;
  isGracePeriod?: boolean;
}

const ProGateOverlay: React.FC<ProGateOverlayProps> = ({ featureName, featureIcon, onUpgrade, isGracePeriod }) => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 animate-in fade-in duration-500">
      <div className="relative max-w-md w-full">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-100/50 via-purple-50/50 to-pink-100/50 rounded-3xl blur-xl scale-110" />

        {/* Main Card */}
        <div className="relative bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-gray-100 p-8 text-center">
          {/* Lock Icon */}
          <div className="relative mx-auto w-20 h-20 mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl rotate-6 opacity-20" />
            <div className="relative w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Lock size={32} className="text-white" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {isGracePeriod ? 'Thời gian gia hạn sắp hết!' : 'Tính năng Pro'}
          </h2>

          {/* Feature name */}
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-sm font-semibold px-4 py-2 rounded-xl mb-4">
            {featureIcon || <Sparkles size={16} />}
            {featureName}
          </div>

          {/* Description */}
          <p className="text-gray-500 text-sm leading-relaxed mb-1">
            {isGracePeriod
              ? 'Bạn đang trong thời gian gia hạn. Nâng cấp ngay để không bị gián đoạn!'
              : 'Tính năng này yêu cầu tài khoản Pro. Nâng cấp để mở khóa toàn bộ sức mạnh của SmartLife.'
            }
          </p>

          <p className="text-gray-400 text-xs mb-6">
            Chỉ từ ~10.000đ/tháng — rẻ hơn 1 ly trà đá 🧋
          </p>

          {/* Locked features list (Scrollable) */}
          <div className="flex flex-col gap-2 mb-6 max-h-48 overflow-y-auto pr-1 custom-scrollbar text-left">
            <div className="flex items-center gap-3 text-xs text-gray-600 bg-gray-50 rounded-xl px-4 py-2.5">
              <Brain size={14} className="text-violet-500 shrink-0" />
              <span className="font-bold flex-1 min-w-0 truncate">AI Cố vấn riêng (600k tokens/tháng)</span>
              <Lock size={12} className="ml-auto text-gray-300 shrink-0" />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-600 bg-gray-50 rounded-xl px-4 py-2.5">
              <Briefcase size={14} className="text-rose-500 shrink-0" />
              <span className="font-bold flex-1 min-w-0 truncate">AI Career Analyzer (MBTI/DISC)</span>
              <Lock size={12} className="ml-auto text-gray-300 shrink-0" />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-600 bg-gray-50 rounded-xl px-4 py-2.5">
              <FileText size={14} className="text-sky-500 shrink-0" />
              <span className="font-bold flex-1 min-w-0 truncate">CV Builder chuẩn Harvard (Export PDF)</span>
              <Lock size={12} className="ml-auto text-gray-300 shrink-0" />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-600 bg-gray-50 rounded-xl px-4 py-2.5">
              <Target size={14} className="text-purple-500 shrink-0" />
              <span className="font-bold flex-1 min-w-0 truncate">Lộ trình Sự nghiệp & 5 năm</span>
              <Lock size={12} className="ml-auto text-gray-300 shrink-0" />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-600 bg-gray-50 rounded-xl px-4 py-2.5">
              <Trophy size={14} className="text-cyan-500 shrink-0" />
              <span className="font-bold flex-1 min-w-0 truncate">GPA Tracker & Giả lập điểm số</span>
              <Lock size={12} className="ml-auto text-gray-300 shrink-0" />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-600 bg-gray-50 rounded-xl px-4 py-2.5">
              <LayoutDashboard size={14} className="text-indigo-500 shrink-0" />
              <span className="font-bold flex-1 min-w-0 truncate">Visual Board tổng quan</span>
              <Lock size={12} className="ml-auto text-gray-300 shrink-0" />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-600 bg-gray-50 rounded-xl px-4 py-2.5">
              <TrendingUp size={14} className="text-emerald-500 shrink-0" />
              <span className="font-bold flex-1 min-w-0 truncate">Quản lý tài chính & Cashflow</span>
              <Lock size={12} className="ml-auto text-gray-300 shrink-0" />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-600 bg-gray-50 rounded-xl px-4 py-2.5">
              <BookOpen size={14} className="text-teal-500 shrink-0" />
              <span className="font-bold flex-1 min-w-0 truncate">Nhật ký cá nhân Pro (Mood & AI)</span>
              <Lock size={12} className="ml-auto text-gray-300 shrink-0" />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-600 bg-gray-50 rounded-xl px-4 py-2.5">
              <Flame size={14} className="text-orange-500 shrink-0" />
              <span className="font-bold flex-1 min-w-0 truncate">Habit Tracker không giới hạn</span>
              <Lock size={12} className="ml-auto text-gray-300 shrink-0" />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-600 bg-gray-50 rounded-xl px-4 py-2.5">
              <Star size={14} className="text-amber-500 shrink-0" />
              <span className="font-bold flex-1 min-w-0 truncate">StarBrain ⭐ Hệ thống sao thưởng</span>
              <Lock size={12} className="ml-auto text-gray-300 shrink-0" />
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={onUpgrade}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-[0.98]"
          >
            <Crown size={18} className="text-yellow-300" />
            Nâng cấp Pro ngay
          </button>

          {/* Free features reminder */}
          <div className="text-[11px] text-gray-400 mt-4 flex flex-col items-center gap-1">
            <p>Tương lai nằm trong tay bạn. Đầu tư sớm, sinh lời cao!</p>
            <p>💡 Gói Sinh viên chăm chỉ 4 năm chỉ 499k — rẻ hơn trà đá!</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProGateOverlay;
