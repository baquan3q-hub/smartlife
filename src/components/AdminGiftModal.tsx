// File: src/components/AdminGiftModal.tsx
import React, { useState } from 'react';
import { X, Gift, Calendar, Shield, Info, Check, Mail, Bell } from 'lucide-react';
import { adminGiftDays, adminSetUserPlan, adminBatchGiftDays } from '../services/subscriptionService';
import { sendNotificationToUser, sendBatchNotification } from '../services/adminNotificationService';
import { supabase } from '../services/supabase';

interface AdminUser {
  id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  plan?: string;
  pro_expiry_date?: string;
  trial_started_at?: string;
  user_created_at?: string;
}

interface AdminGiftModalProps {
  users: AdminUser[]; // Hỗ trợ mảng nhiều user
  adminId: string;
  adminEmail: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminGiftModal: React.FC<AdminGiftModalProps> = ({
  users,
  adminId,
  adminEmail,
  onClose,
  onSuccess,
}) => {
  const isSingle = users.length === 1;
  const singleUser = users[0];

  const [activeTab, setActiveTab] = useState<'gift' | 'set_plan'>('gift');
  const [days, setDays] = useState<number>(30);
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'trial' | 'pro' | 'lifetime'>('pro');
  const [note, setNote] = useState<string>('');
  
  // Notification options
  const [sendInApp, setSendInApp] = useState<boolean>(true);
  const [sendEmail, setSendEmail] = useState<boolean>(false);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const presets = [7, 15, 30, 90, 365];

  // Calculate expiry preview (chỉ hiển thị khi có 1 user)
  const getExpiryPreview = () => {
    if (!isSingle) return null;
    const now = new Date();
    let baseDate = now;

    if (singleUser.plan === 'pro' && singleUser.pro_expiry_date) {
      const currentExpiry = new Date(singleUser.pro_expiry_date);
      if (currentExpiry > now) {
        baseDate = currentExpiry;
      }
    }

    if (activeTab === 'gift') {
      const expiry = new Date(baseDate);
      expiry.setDate(expiry.getDate() + (days || 0));
      return expiry;
    } else {
      if (selectedPlan === 'pro') {
        const expiry = new Date(now);
        expiry.setDate(expiry.getDate() + (days || 0));
        return expiry;
      }
      return null;
    }
  };

  const handleGift = async () => {
    if (days <= 0 || days > 365) {
      setErrorMsg('Số ngày tặng phải từ 1 đến 365 ngày');
      return;
    }
    
    setLoading(true);
    setErrorMsg('');
    try {
      const targetIds = users.map(u => u.id);
      let success = false;
      const expiryPreview = getExpiryPreview();

      if (isSingle) {
        success = await adminGiftDays(adminId, adminEmail, singleUser.id, days, note);
      } else {
        const res = await adminBatchGiftDays(adminId, adminEmail, targetIds, days, note);
        success = res.successCount > 0;
      }
      
      if (success) {
        // Gửi notification in-app nếu được chọn
        if (sendInApp) {
          const dateStr = expiryPreview ? expiryPreview.toLocaleDateString('vi-VN') : '';
          const msgBody = isSingle 
            ? `Quản trị viên đã tặng bạn ${days} ngày sử dụng gói SmartLife Pro. Hạn dùng đến ngày ${dateStr}. Ghi chú: ${note || 'Không có ghi chú'}`
            : `Quản trị viên đã tặng bạn ${days} ngày sử dụng gói SmartLife Pro. Ghi chú: ${note || 'Chúc bạn học tập hiệu quả!'}`;

          await sendBatchNotification(
            targetIds,
            'gift_pro',
            '🎁 Bạn nhận được quà tặng Pro!',
            msgBody,
            { days_granted: days, note }
          );
        }

        // Gửi email nếu được chọn (Phase 2 calling Supabase Edge Function)
        if (sendEmail) {
          const emails = users.map(u => u.email).filter(Boolean) as string[];
          if (emails.length > 0) {
            const dateStr = expiryPreview ? expiryPreview.toLocaleDateString('vi-VN') : '';
            try {
              const { error: emailErr } = await supabase.functions.invoke('send-gift-email', {
                body: {
                  toBatch: emails,
                  subject: '🎁 Bạn vừa được tặng gói SmartLife Pro!',
                  userName: isSingle ? (singleUser.full_name || 'Bạn') : 'Bạn',
                  giftType: 'days',
                  days: days,
                  expiryDate: isSingle ? dateStr : undefined,
                  note: note || 'Chúc bạn học tập và làm việc hiệu quả cùng SmartLife!',
                },
              });
              if (emailErr) console.error('Email invoke error:', emailErr);
            } catch (emailErr) {
              console.error('Failed to trigger email function:', emailErr);
            }
          }
        }

        onSuccess();
        onClose();
      } else {
        setErrorMsg('Không thể thực hiện tặng quà. Vui lòng kiểm tra lại.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Đã xảy ra lỗi.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPlan = async () => {
    if (selectedPlan === 'pro' && (days <= 0 || days > 365)) {
      setErrorMsg('Số ngày tặng phải từ 1 đến 365 ngày');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const targetIds = users.map(u => u.id);
      const expiryPreview = getExpiryPreview();

      // Duyệt qua danh sách để đổi plan
      const promises = targetIds.map(id => 
        adminSetUserPlan(adminId, adminEmail, id, selectedPlan, selectedPlan === 'pro' ? days : undefined, note)
      );
      const results = await Promise.all(promises);
      const success = results.every(r => r === true);

      if (success) {
        // Gửi notification in-app nếu được chọn
        if (sendInApp) {
          let title = '⚙️ Cập nhật gói dịch vụ';
          let msg = '';
          const planLabels = {
            free: 'Miễn phí (Free)',
            trial: 'Trải nghiệm (Trial 7 ngày)',
            pro: `SmartLife Pro (${days} ngày)`,
            lifetime: 'SmartLife Pro Vĩnh viễn (Lifetime)',
          };

          if (selectedPlan === 'lifetime') {
            title = '👑 Nâng cấp SmartLife Pro Vĩnh viễn!';
            msg = `Chúc mừng! Quản trị viên đã nâng cấp tài khoản của bạn lên gói Premium Vĩnh viễn (Lifetime). Ghi chú: ${note || ''}`;
          } else if (selectedPlan === 'pro') {
            title = '🎁 Gia hạn SmartLife Pro!';
            const dateStr = expiryPreview ? expiryPreview.toLocaleDateString('vi-VN') : '';
            msg = isSingle 
              ? `Tài khoản của bạn đã được thay đổi sang gói Pro trong ${days} ngày. Hạn dùng đến ngày ${dateStr}. Ghi chú: ${note || ''}`
              : `Tài khoản của bạn đã được thay đổi sang gói Pro trong ${days} ngày. Ghi chú: ${note || ''}`;
          } else {
            msg = `Tài khoản của bạn đã được chuyển đổi sang gói ${planLabels[selectedPlan]}. Ghi chú: ${note || ''}`;
          }

          await sendBatchNotification(targetIds, 'extend_pro', title, msg, { new_plan: selectedPlan, note });
        }

        // Gửi email nếu được chọn (Phase 2 calling Supabase Edge Function)
        if (sendEmail) {
          const emails = users.map(u => u.email).filter(Boolean) as string[];
          if (emails.length > 0) {
            const dateStr = expiryPreview ? expiryPreview.toLocaleDateString('vi-VN') : '';
            try {
              const { error: emailErr } = await supabase.functions.invoke('send-gift-email', {
                body: {
                  toBatch: emails,
                  subject: `⚙️ Cập nhật tài khoản SmartLife: Gói ${selectedPlan.toUpperCase()}`,
                  userName: isSingle ? (singleUser.full_name || 'Bạn') : 'Bạn',
                  giftType: 'plan',
                  planName: selectedPlan,
                  days: selectedPlan === 'pro' ? days : undefined,
                  expiryDate: selectedPlan === 'pro' && isSingle ? dateStr : undefined,
                  note: note || 'Cảm ơn bạn đã đồng hành cùng SmartLife!',
                },
              });
              if (emailErr) console.error('Email invoke error:', emailErr);
            } catch (emailErr) {
              console.error('Failed to trigger email function:', emailErr);
            }
          }
        }

        onSuccess();
        onClose();
      } else {
        setErrorMsg('Không thể đổi gói dịch vụ. Vui lòng kiểm tra lại.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Đã xảy ra lỗi.');
    } finally {
      setLoading(false);
    }
  };

  const getPlanBadgeStyle = (planName?: string) => {
    switch (planName) {
      case 'pro':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'lifetime':
        return 'bg-purple-100 text-purple-800 border-purple-200 font-semibold';
      case 'trial':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Gift size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Điều chỉnh gói dịch vụ</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isSingle ? 'Điều chỉnh thủ công gói cho thành viên' : `Tặng/Điều chỉnh cho ${users.length} thành viên`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Users Info */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          {isSingle ? (
            <div className="flex items-center space-x-4">
              <img
                src={singleUser.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${singleUser.email}`}
                alt={singleUser.full_name || ''}
                className="w-14 h-14 rounded-2xl border border-slate-100 dark:border-slate-800 object-cover shadow-sm"
              />
              <div className="flex-1">
                <h4 className="text-base font-bold text-slate-800 dark:text-white">{singleUser.full_name || 'Chưa đặt tên'}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">{singleUser.email}</p>
                <div className="flex items-center space-x-2 mt-1.5">
                  <span className={`px-2 py-0.5 text-xs rounded-full border ${getPlanBadgeStyle(singleUser.plan)}`}>
                    {singleUser.plan === 'pro'
                      ? 'SmartLife Pro'
                      : singleUser.plan === 'lifetime'
                      ? 'Pro Vĩnh viễn'
                      : singleUser.plan === 'trial'
                      ? 'Thử nghiệm'
                      : 'Miễn phí'}
                  </span>
                  {singleUser.plan === 'pro' && singleUser.pro_expiry_date && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center">
                      <Calendar size={12} className="mr-1" />
                      Hết hạn: {new Date(singleUser.pro_expiry_date).toLocaleDateString('vi-VN')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-850 rounded-2xl">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                Danh sách thành viên nhận quà ({users.length})
              </span>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 max-h-16 overflow-y-auto">
                {users.map(u => u.full_name || u.email || 'Thành viên').join(', ')}
              </p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6">
          <button
            onClick={() => {
              setActiveTab('gift');
              setErrorMsg('');
            }}
            className={`py-3 text-sm font-semibold border-b-2 mr-6 transition-all ${
              activeTab === 'gift'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Tặng thêm ngày Pro
          </button>
          <button
            onClick={() => {
              setActiveTab('set_plan');
              setErrorMsg('');
            }}
            className={`py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'set_plan'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Thay đổi Plan trực tiếp
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-5 max-h-[40vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-900/30 flex items-start space-x-2">
              <Info size={16} className="mt-0.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'gift' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Số ngày Pro muốn tặng (Tối đa 365)
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {presets.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setDays(p)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-xl border transition-all ${
                        days === p
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      +{p} ngày
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={days}
                    onChange={e => setDays(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    placeholder="Nhập số ngày muốn tặng..."
                  />
                  <span className="absolute right-4 top-3 text-sm text-slate-400">ngày</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Chọn gói dịch vụ mới
                </label>
                <select
                  value={selectedPlan}
                  onChange={e => setSelectedPlan(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all appearance-none"
                >
                  <option value="free">Miễn phí (Free)</option>
                  <option value="trial">Gói trải nghiệm (Trial 7 ngày)</option>
                  <option value="pro">Gói SmartLife Pro (Gia hạn ngày)</option>
                  <option value="lifetime">Premium Vĩnh viễn (Lifetime)</option>
                </select>
              </div>

              {selectedPlan === 'pro' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Số ngày Pro được cấp (Tối đa 365)
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {presets.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setDays(p)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-xl border transition-all ${
                          days === p
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {p} ngày
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={days}
                      onChange={e => setDays(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      placeholder="Nhập số ngày..."
                    />
                    <span className="absolute right-4 top-3 text-sm text-slate-400">ngày</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
              Lý do / Ghi chú (Lưu lịch sử & thông báo cho users)
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
              placeholder="VD: Quà tặng dịp lễ, đền bù lỗi hệ thống, gia hạn Pro..."
            />
          </div>

          {/* Expiry Preview */}
          {isSingle && ((activeTab === 'gift' && days > 0) || (activeTab === 'set_plan' && selectedPlan === 'pro' && days > 0)) && (
            <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100/50 dark:border-amber-900/20 rounded-xl flex items-center justify-between text-amber-800 dark:text-amber-300 text-sm">
              <span className="flex items-center">
                <Shield size={16} className="mr-2 flex-shrink-0" />
                Dự kiến gia hạn đến:
              </span>
              <span className="font-bold">
                {getExpiryPreview()?.toLocaleDateString('vi-VN')}
              </span>
            </div>
          )}

          {!isSingle && ((activeTab === 'gift' && days > 0) || (activeTab === 'set_plan' && selectedPlan === 'pro' && days > 0)) && (
            <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/20 rounded-xl flex items-center justify-between text-indigo-800 dark:text-indigo-300 text-sm">
              <span className="flex items-center">
                <Shield size={16} className="mr-2 flex-shrink-0 text-indigo-500" />
                Cộng dồn thêm:
              </span>
              <span className="font-bold">{days} ngày Pro</span>
            </div>
          )}

          {activeTab === 'set_plan' && selectedPlan === 'lifetime' && (
            <div className="p-3.5 bg-purple-50/50 dark:bg-purple-950/10 border border-purple-100/50 dark:border-purple-900/20 rounded-xl flex items-center justify-between text-purple-800 dark:text-purple-300 text-sm">
              <span className="flex items-center font-medium">
                <Shield size={16} className="mr-2 flex-shrink-0 text-purple-500" />
                Thời hạn mới:
              </span>
              <span className="font-bold uppercase tracking-wider text-xs">Vĩnh viễn (Lifetime)</span>
            </div>
          )}

          {/* Notification toggles */}
          <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/60 space-y-3">
            <h5 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Hình thức thông báo</h5>
            
            <div className="flex items-center justify-between">
              <label htmlFor="send-in-app" className="flex items-center text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <Bell size={16} className="mr-2 text-indigo-500" />
                Thông báo trên ứng dụng (In-app)
              </label>
              <input
                id="send-in-app"
                type="checkbox"
                checked={sendInApp}
                onChange={e => setSendInApp(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-3">
              <label htmlFor="send-email" className="flex items-center text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <Mail size={16} className="mr-2 text-indigo-500" />
                Gửi email thông báo (Resend)
              </label>
              <input
                id="send-email"
                type="checkbox"
                checked={sendEmail}
                onChange={e => setSendEmail(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm rounded-xl transition-all disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            onClick={activeTab === 'gift' ? handleGift : handleSetPlan}
            disabled={loading || (activeTab === 'gift' && days <= 0)}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/10 transition-all flex items-center space-x-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <Check size={16} />
            )}
            <span>Xác nhận</span>
          </button>
        </div>
      </div>
    </div>
  );
};
