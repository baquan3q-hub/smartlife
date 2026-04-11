// File: src/components/PricingModal.tsx
import React, { useState } from 'react';
import { X, Sparkles, CheckCircle, Zap, Brain, CalendarDays, LayoutDashboard, Crown, Star } from 'lucide-react';
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
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanDuration>('3_months');

  if (!isOpen) return null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

  const features = [
    { icon: <CalendarDays size={18} />, text: 'Lịch trình & Mục tiêu — không bao giờ quên deadline' },
    { icon: <Brain size={18} />, text: 'AI Cố vấn riêng — phân tích cá nhân hóa' },
    { icon: <LayoutDashboard size={18} />, text: 'Visual Board — một cái nhìn cho cả cuộc sống đại học' },
    { icon: <Zap size={18} />, text: 'Focus Timer & Music Space — tập trung tối đa' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-300">
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
                  : 'Đầu tư cho bản thân — chi phí chỉ bằng 1 ly trà sữa/tháng 🧋'}
            </p>

            {/* Decorative circles */}
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full" />
            <div className="absolute -right-2 top-12 w-16 h-16 bg-white/5 rounded-full" />
          </div>
        </div>

        {/* Features */}
        <div className="px-8 py-5 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Tính năng Pro bao gồm</p>
          <div className="space-y-2.5">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-gray-700">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                  {f.icon}
                </div>
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Plans Grid */}
        <div className="px-8 py-6">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Chọn gói phù hợp</p>
          <div className="grid grid-cols-2 gap-3">
            {SUBSCRIPTION_PLANS.map(plan => (
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

                {/* Plan Name */}
                <div className="text-sm font-bold text-gray-800 mb-1">{plan.label}</div>

                {/* Price */}
                <div className="text-xl font-black text-gray-900">
                  {formatPrice(plan.price)}
                </div>

                {/* Monthly Price / Save */}
                {plan.id !== 'lifetime' && plan.id !== '1_month' && (
                  <div className="text-[11px] text-gray-500 mt-1">
                    ~{formatPrice(plan.monthly_price)}/tháng
                  </div>
                )}
                {plan.save_percent > 0 && plan.id !== 'lifetime' && (
                  <div className="mt-1.5 inline-block text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                    Tiết kiệm {plan.save_percent}%
                  </div>
                )}
                {plan.id === 'lifetime' && (
                  <div className="mt-1.5 inline-block text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                    Trả 1 lần duy nhất
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
