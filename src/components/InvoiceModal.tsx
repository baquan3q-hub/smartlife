// File: src/components/InvoiceModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { X, Copy, CheckCircle, Clock, AlertCircle, ExternalLink } from 'lucide-react';
import { SUBSCRIPTION_PLANS, PAYMENT_INFO } from '../services/subscriptionService';
import { SubscriptionOrder } from '../types';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: SubscriptionOrder | null;
  onCreateNewOrder?: () => void;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({ isOpen, onClose, order, onCreateNewOrder }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  // Calculate remaining time
  useEffect(() => {
    if (!order || !isOpen) return;

    const updateTimer = () => {
      const expiresAt = new Date(order.invoice_expires_at).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));

      setTimeLeft(remaining);
      if (remaining <= 0) {
        setIsExpired(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [order, isOpen]);

  // Reset expired state when order changes
  useEffect(() => {
    if (order) setIsExpired(false);
  }, [order?.id]);

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  }, []);

  if (!isOpen || !order) return null;

  const plan = SUBSCRIPTION_PLANS.find(p => p.id === order.plan_type);
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

  // Generate VietQR URL for QR placeholder (using static info)
  const qrUrl = `https://img.vietqr.io/image/VCB-${PAYMENT_INFO.account_number}-compact2.png?amount=${order.amount}&addInfo=${encodeURIComponent(order.transfer_content)}&accountName=${encodeURIComponent(PAYMENT_INFO.account_name)}`;

  const CopyButton: React.FC<{ text: string; label: string }> = ({ text, label }) => (
    <button
      onClick={() => copyToClipboard(text, label)}
      className="ml-2 p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all shrink-0"
      title="Sao chép"
    >
      {copied === label ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-300">
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10">
          <X size={20} />
        </button>

        {/* Timer Header */}
        <div className={`px-6 py-4 text-center rounded-t-3xl ${isExpired ? 'bg-red-50' : 'bg-gradient-to-r from-indigo-50 to-purple-50'}`}>
          {isExpired ? (
            <div className="flex flex-col items-center gap-2">
              <AlertCircle size={32} className="text-red-500" />
              <p className="text-red-600 font-bold">Hóa đơn đã hết hạn</p>
              <button
                onClick={onCreateNewOrder}
                className="mt-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
              >
                Tạo hóa đơn mới
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <Clock size={20} className={`${timeLeft <= 120 ? 'text-red-500 animate-pulse' : 'text-indigo-600'}`} />
              <div className={`text-2xl font-mono font-black ${timeLeft <= 120 ? 'text-red-600' : 'text-indigo-700'}`}>
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </div>
              <span className="text-xs text-gray-500">còn lại</span>
            </div>
          )}
        </div>

        {/* Order Info */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-gray-900">Thông tin đơn hàng</span>
            <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-3 py-1 rounded-full">
              {plan?.label || order.plan_type}
            </span>
          </div>
          <div className="text-2xl font-black text-gray-900 text-center py-2">
            {formatPrice(order.amount)}
          </div>
        </div>

        {/* QR Code */}
        {!isExpired && (
          <div className="px-6 py-5 flex flex-col items-center border-b border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Quét mã QR để chuyển khoản</p>
            <div className="w-52 h-52 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden">
              <img
                src={qrUrl}
                alt="QR Code chuyển khoản"
                className="w-full h-full object-contain p-1"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="text-center p-4"><p class="text-gray-400 text-sm">QR Code</p><p class="text-gray-300 text-xs mt-1">Đang tải...</p></div>';
                }}
              />
            </div>
          </div>
        )}

        {/* Bank Transfer Info */}
        {!isExpired && (
          <div className="px-6 py-5 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Hoặc chuyển khoản thủ công</p>

            {/* Bank Name */}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Ngân hàng</p>
                <p className="text-sm font-bold text-gray-900">{PAYMENT_INFO.bank_name}</p>
              </div>
            </div>

            {/* Account Number */}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Số tài khoản</p>
                <p className="text-sm font-bold text-gray-900 font-mono tracking-wider">{PAYMENT_INFO.account_number}</p>
              </div>
              <CopyButton text={PAYMENT_INFO.account_number} label="stk" />
            </div>

            {/* Account Name */}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Tên tài khoản</p>
                <p className="text-sm font-bold text-gray-900">{PAYMENT_INFO.account_name}</p>
              </div>
            </div>

            {/* Amount */}
            <div className="flex items-center justify-between bg-indigo-50 rounded-xl px-4 py-3 border border-indigo-100">
              <div>
                <p className="text-[10px] text-indigo-500 uppercase font-semibold">Số tiền</p>
                <p className="text-sm font-black text-indigo-700">{formatPrice(order.amount)}</p>
              </div>
              <CopyButton text={order.amount.toString()} label="amount" />
            </div>

            {/* Transfer Content - IMPORTANT */}
            <div className="flex items-center justify-between bg-orange-50 rounded-xl px-4 py-3 border-2 border-orange-200">
              <div>
                <p className="text-[10px] text-orange-600 uppercase font-bold">⚠️ Nội dung chuyển khoản</p>
                <p className="text-base font-black text-orange-800 font-mono tracking-widest">{order.transfer_content}</p>
              </div>
              <CopyButton text={order.transfer_content} label="content" />
            </div>

            <p className="text-[10px] text-red-500 font-semibold text-center">
              ⚠️ Vui lòng ghi đúng nội dung chuyển khoản để được kích hoạt nhanh nhất
            </p>
          </div>
        )}

        {/* Status after transfer */}
        {!isExpired && (
          <div className="px-6 pb-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
              <p className="text-sm text-blue-800 font-medium">
                📧 Sau khi chuyển khoản, tài khoản sẽ được kích hoạt trong vòng <strong>5-30 phút</strong>
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Admin sẽ xác nhận và kích hoạt Pro cho bạn
              </p>
            </div>
          </div>
        )}

        {/* Support Footer */}
        <div className="px-6 pb-6">
          <div className="bg-gray-50 rounded-xl p-4 text-center space-y-1">
            <p className="text-xs text-gray-500">Có thắc mắc cần giải đáp, tư vấn hoặc hỗ trợ?</p>
            <p className="text-sm font-bold text-gray-700">
              Liên hệ qua Zalo: <span className="text-indigo-600">{PAYMENT_INFO.support_zalo}</span> — {PAYMENT_INFO.support_name}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
