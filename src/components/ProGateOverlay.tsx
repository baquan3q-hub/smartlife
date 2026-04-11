// File: src/components/ProGateOverlay.tsx
import React from 'react';
import { Lock, Crown, Sparkles, CalendarDays, Brain, LayoutDashboard } from 'lucide-react';

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
            Chỉ từ 30.000đ/tháng — rẻ hơn 1 ly trà sữa 🧋
          </p>

          {/* Locked features list */}
          <div className="flex flex-col gap-2 mb-6">
            <div className="flex items-center gap-3 text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-2.5">
              <CalendarDays size={16} className="text-indigo-500 shrink-0" />
              <span>Lịch trình & Quản lý mục tiêu</span>
              <Lock size={12} className="ml-auto text-gray-300" />
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-2.5">
              <Brain size={16} className="text-purple-500 shrink-0" />
              <span>AI Cố vấn cá nhân</span>
              <Lock size={12} className="ml-auto text-gray-300" />
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-2.5">
              <LayoutDashboard size={16} className="text-pink-500 shrink-0" />
              <span>Visual Board tổng quan</span>
              <Lock size={12} className="ml-auto text-gray-300" />
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
          <p className="text-[11px] text-gray-400 mt-4">
            💡 GPA Tracker và Quản lý tài chính vẫn miễn phí
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProGateOverlay;
