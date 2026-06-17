// File: src/components/AIBoostModal.tsx
import React, { useState } from 'react';
import { X, Zap, CheckCircle2, ChevronRight, HelpCircle } from 'lucide-react';

interface AIBoostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPack: (packType: 'boost_s' | 'boost_m' | 'boost_l') => void;
}

const AIBoostModal: React.FC<AIBoostModalProps> = ({ isOpen, onClose, onSelectPack }) => {
  const [selectedPack, setSelectedPack] = useState<'boost_s' | 'boost_m' | 'boost_l'>('boost_s');

  if (!isOpen) return null;

  const packs = [
    {
      id: 'boost_s' as const,
      name: 'AI Boost S',
      tokens: '500.000',
      price: 29000,
      expiry: 30,
      description: 'Phù hợp cho nhu cầu chat và tư vấn GPA thông thường trong tháng.',
      gradient: 'from-teal-500 to-emerald-600',
      shadow: 'shadow-emerald-100',
      badge: 'Cơ bản',
    },
    {
      id: 'boost_m' as const,
      name: 'AI Boost M',
      tokens: '1.000.000',
      price: 49000,
      expiry: 60,
      description: 'Gói phổ biến nhất. Rất thoải mái cho việc phân tích tài liệu và lập lộ trình.',
      gradient: 'from-blue-500 to-indigo-600',
      shadow: 'shadow-blue-100',
      badge: 'Phổ biến',
      isPopular: true,
    },
    {
      id: 'boost_l' as const,
      name: 'AI Boost L',
      tokens: '3.000.000',
      price: 119000,
      expiry: 90,
      description: 'Siêu tiết kiệm cho Power User sử dụng AI liên tục hàng ngày.',
      gradient: 'from-purple-500 to-pink-600',
      shadow: 'shadow-purple-100',
      badge: 'Giá tốt nhất',
    },
  ];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-300">
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10">
          <X size={20} />
        </button>

        {/* Header */}
        <div className="relative overflow-hidden rounded-t-3xl">
          <div className="bg-gradient-to-br from-teal-600 via-emerald-600 to-indigo-700 px-8 py-8 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={22} className="text-yellow-300 fill-yellow-300 animate-bounce" />
              <span className="text-sm font-semibold bg-white/20 px-3 py-1 rounded-full">AI Boost Packs</span>
            </div>
            <h2 className="text-2xl font-bold mt-2">Mua thêm AI Tokens</h2>
            <p className="text-white/80 text-sm mt-2 leading-relaxed">
              Bạn cần thêm dung lượng chat AI? Hãy chọn gói phù hợp để tiếp tục trải nghiệm Cố vấn AI mà không bị gián đoạn.
            </p>
          </div>
          {/* Decorative shapes */}
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full" />
          <div className="absolute -right-2 top-12 w-16 h-16 bg-white/5 rounded-full" />
        </div>

        {/* Content */}
        <div className="px-8 py-6 space-y-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Chọn gói Tokens</p>

          <div className="space-y-3">
            {packs.map((pack) => {
              const isSelected = selectedPack === pack.id;
              return (
                <button
                  key={pack.id}
                  onClick={() => setSelectedPack(pack.id)}
                  className={`w-full relative p-4 rounded-2xl border-2 transition-all duration-200 text-left flex items-center justify-between group ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/30 shadow-lg shadow-emerald-100/50'
                      : 'border-gray-200 hover:border-emerald-200 hover:bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon Gradient */}
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${pack.gradient} flex flex-col items-center justify-center text-white shrink-0 shadow-md`}>
                      <Zap size={20} className="fill-current" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-800">{pack.name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {pack.badge}
                        </span>
                      </div>
                      <p className="text-lg font-black text-gray-900 mt-1">
                        +{pack.tokens} <span className="text-xs font-medium text-gray-500">tokens</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1 max-w-[280px] leading-relaxed">
                        {pack.description}
                      </p>
                      <p className="text-[10px] font-semibold text-emerald-700 mt-1">
                        Hạn dùng: {pack.expiry} ngày kể từ khi kích hoạt
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-base font-black text-gray-900">{formatPrice(pack.price)}</span>
                    {isSelected && (
                      <CheckCircle2 size={20} className="text-emerald-600 fill-emerald-50/20" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Help Note */}
        <div className="px-8 pb-4">
          <div className="bg-gray-50 rounded-xl p-3 flex gap-2">
            <HelpCircle size={16} className="text-gray-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Token từ gói Boost chỉ bắt đầu bị trừ khi bạn đã dùng hết dung lượng 600.000 token hàng tháng đi kèm gói Pro/Lifetime. Các gói Boost được tiêu dùng theo nguyên tắc FIFO (gói mua trước dùng trước).
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="px-8 pb-8">
          <button
            onClick={() => onSelectPack(selectedPack)}
            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 active:scale-[0.98]"
          >
            Thanh toán {formatPrice(packs.find((p) => p.id === selectedPack)?.price || 0)}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIBoostModal;
