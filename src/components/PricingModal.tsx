// File: src/components/PricingModal.tsx
import React, { useState } from 'react';
import { X, Sparkles, CheckCircle, Zap, Brain, CalendarDays, LayoutDashboard, Crown, Star, Flame, Trophy, BarChart3, TrendingUp, BookOpen, Target, Briefcase, FileText, GraduationCap, Award } from 'lucide-react';
import { SUBSCRIPTION_PLANS, PAYMENT_INFO } from '../services/subscriptionService';
import { SubscriptionPlanDuration } from '../types';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan: (planId: SubscriptionPlanDuration) => void;
  daysRemaining?: number;
  isTrialExpired?: boolean;
}

const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose, onSelectPlan, daysRemaining, isTrialExpired }) => {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanDuration>('4_years');

  if (!isOpen) return null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

  const regularPlans = SUBSCRIPTION_PLANS.filter(p => !p.is_best_value);
  const bestValuePlan = SUBSCRIPTION_PLANS.find(p => p.is_best_value);

  const features = [
    { icon: <Brain size={18} />, color: 'text-violet-600', bgColor: 'bg-violet-50', text: 'AI Cố vấn riêng — 600.000 token/tháng included' },
    { icon: <Briefcase size={18} />, color: 'text-rose-600', bgColor: 'bg-rose-50', text: 'AI Career Analyzer — Phân tích ngành học & tính cách đề xuất nghề nghiệp' },
    { icon: <FileText size={18} />, color: 'text-sky-600', bgColor: 'bg-sky-50', text: 'CV Builder — Tự động điền học vấn & kỹ năng, export PDF chuyên nghiệp' },
    { icon: <Target size={18} />, color: 'text-purple-600', bgColor: 'bg-purple-50', text: 'Lộ trình Sự nghiệp & Mục tiêu 5 năm — AI cố vấn kỹ năng dựa trên GPA' },
    { icon: <Trophy size={18} />, color: 'text-cyan-600', bgColor: 'bg-cyan-50', text: 'GPA Tracker nâng cao — dự đoán GPA tốt nghiệp & lộ trình học tập' },
    { icon: <LayoutDashboard size={18} />, color: 'text-indigo-600', bgColor: 'bg-indigo-50', text: 'Visual Board — toàn cảnh cuộc sống đại học trong 1 giao diện' },
    { icon: <TrendingUp size={18} />, color: 'text-emerald-600', bgColor: 'bg-emerald-50', text: 'Quản lý tài chính & Cashflow — theo dõi thu chi thông minh' },
    { icon: <BookOpen size={18} />, color: 'text-teal-600', bgColor: 'bg-teal-50', text: 'Nhật ký cá nhân — không gian chữa lành, mood tracker & đồng bộ dữ liệu với AI' },
    { icon: <Flame size={18} />, color: 'text-orange-600', bgColor: 'bg-orange-50', text: 'Habit Tracker không giới hạn — theo dõi thói quen với streak & count-up' },
    { icon: <Star size={18} />, color: 'text-amber-500', bgColor: 'bg-amber-50', text: 'StarBrain 🌟 — hệ thống sao thưởng & cửa hàng đổi quà' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto scrollbar-thin animate-in fade-in zoom-in-95 duration-300">
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10">
          <X size={20} />
        </button>

        {/* Header */}
        <div className="relative overflow-hidden rounded-t-3xl">
          <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 px-8 py-8 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Crown size={24} className="text-yellow-300" />
              <span className="text-sm font-semibold bg-white/20 px-3 py-1 rounded-full">Nâng cấp Pro</span>
            </div>
            <h2 className="text-2xl font-bold mt-2">Mở khóa toàn bộ SmartLife</h2>
            <p className="text-white/80 text-sm mt-2">
              {isTrialExpired
                ? 'Thời gian dùng thử đã hết. Nâng cấp để tiếp tục sử dụng đầy đủ tính năng!'
                : daysRemaining && daysRemaining > 0
                  ? `Bạn còn ${daysRemaining} ngày dùng thử. Nâng cấp ngay để không bị gián đoạn!`
                  : 'Đầu tư cho bản thân — chi phí chỉ bằng 1 ly trà đá/tháng 🧋'}
            </p>

            {/* Decorative circles */}
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full" />
            <div className="absolute -right-2 top-12 w-16 h-16 bg-white/5 rounded-full" />
          </div>
        </div>

        {/* Features */}
        <div className="px-8 py-5 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Các tính năng bao gồm</p>
          <div className="space-y-3.5 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-3 text-sm text-gray-700">
                <div className={`w-8 h-8 rounded-lg ${f.bgColor} flex items-center justify-center ${f.color} shrink-0 mt-0.5`}>
                  {f.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-gray-800 text-xs md:text-sm">{f.text.split(' — ')[0]}</span>
                  </div>
                  {f.text.includes(' — ') && (
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{f.text.split(' — ')[1]}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>


        {/* Plans Grid */}
        <div className="px-8 py-6">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Chọn gói phù hợp</p>
          
          {/* 4 Regular Plans in 2x2 Grid */}
          <div className="grid grid-cols-2 gap-3">
            {regularPlans.map(plan => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative p-4 rounded-2xl border-2 transition-all duration-200 text-left group ${
                  selectedPlan === plan.id
                    ? 'border-indigo-500 bg-indigo-50/50 shadow-lg shadow-indigo-100'
                    : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
                }`}
              >
                {/* Popular Badge */}
                {plan.is_popular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-[10px] font-bold px-3 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap">
                    <Star size={10} fill="currentColor" /> PHỔ BIẾN
                  </div>
                )}

                {/* Plan Emoji + Name */}
                <div className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-1.5">
                  <span>{plan.emoji}</span>
                  <span>{plan.label}</span>
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-xl font-black text-gray-900">{formatPrice(plan.price)}</span>
                  {plan.original_price && plan.original_price > plan.price && (
                    <span className="text-xs text-gray-400 line-through">{formatPrice(plan.original_price)}</span>
                  )}
                </div>

                {/* Monthly Price / Save */}
                <div className="text-[11px] text-gray-500 mt-1">
                  ~{formatPrice(plan.monthly_price)}/tháng
                </div>
                {plan.save_percent > 0 ? (
                  <div className="mt-1.5 inline-block text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                    Tiết kiệm {plan.save_percent}%
                  </div>
                ) : (
                  <div className="mt-1.5 inline-block text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                    Gói cơ bản
                  </div>
                )}

                {/* Selected Indicator */}
                {selectedPlan === plan.id && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle size={18} className="text-indigo-600" fill="currentColor" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Best Value Plan — Full Width, Special Design */}
          {bestValuePlan && (
            <button
              onClick={() => setSelectedPlan(bestValuePlan.id)}
              className={`relative w-full mt-4 p-5 rounded-2xl border-2 transition-all duration-200 text-left overflow-hidden ${
                selectedPlan === bestValuePlan.id
                  ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 shadow-lg shadow-emerald-100'
                  : 'border-emerald-200 bg-gradient-to-br from-emerald-50/30 to-teal-50/30 hover:border-emerald-400 hover:shadow-md'
              }`}
            >
              {/* Best Value Badge */}
              <div className="absolute -top-0 right-0 bg-gradient-to-l from-emerald-500 to-teal-500 text-white text-[10px] font-bold px-4 py-1 rounded-bl-xl flex items-center gap-1">
                <Award size={12} fill="currentColor" /> BEST VALUE
              </div>

              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-emerald-200 shrink-0">
                  🎓
                </div>

                <div className="flex-1 min-w-0">
                  {/* Name */}
                  <div className="text-base font-black text-gray-900 flex items-center gap-2">
                    {bestValuePlan.label}
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">4 NĂM</span>
                  </div>

                  {/* Price */}
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-emerald-700">{formatPrice(bestValuePlan.price)}</span>
                    <span className="text-sm text-gray-400 line-through">{formatPrice(bestValuePlan.original_price || 0)}</span>
                  </div>

                  {/* Details */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      ~{formatPrice(bestValuePlan.monthly_price)}/tháng
                    </span>
                    <span className="text-[11px] font-bold text-orange-600 bg-orange-100 px-2.5 py-0.5 rounded-full">
                      🔥 Tiết kiệm {bestValuePlan.save_percent}%
                    </span>
                  </div>

                  {/* FOMO text */}
                  <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                    💡 Rẻ hơn 1 ly trà đá/tháng! Chỉ hơn gói 1 năm có 100k — đủ dùng cả 4 năm đại học.
                  </p>
                </div>
              </div>

              {/* Selected Indicator */}
              {selectedPlan === bestValuePlan.id && (
                <div className="absolute top-5 right-14">
                  <CheckCircle size={20} className="text-emerald-600" fill="currentColor" />
                </div>
              )}
            </button>
          )}
        </div>

        {/* CTA */}
        <div className="px-8 pb-6">
          <button
            onClick={() => onSelectPlan(selectedPlan)}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-[0.98]"
          >
            <Sparkles size={18} />
            Thanh toán {formatPrice(SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan)?.price || 0)}
          </button>
          <p className="text-center text-[11px] text-gray-400 mt-3">
            Bạn sẽ được chuyển đến thông tin thanh toán qua chuyển khoản ngân hàng
          </p>
        </div>

        {/* Support */}
        <div className="px-8 pb-6">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-[11px] text-gray-500">
              Thắc mắc? Liên hệ Zalo: <span className="font-bold text-indigo-600">{PAYMENT_INFO.support_zalo}</span> — {PAYMENT_INFO.support_name}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;
