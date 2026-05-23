import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Lock, ShieldAlert, Key, RefreshCw, Delete, AlertCircle, Sparkles } from 'lucide-react';

interface JournalPinGuardProps {
  userId: string;
  children: React.ReactNode;
}

// Hàm băm SHA-256 sử dụng Web Crypto API có sẵn trên mọi trình duyệt hiện đại
const hashPin = async (pin: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Biến lưu trạng thái đã mở khóa tạm thời trong phiên làm việc hiện tại (mất khi reload/reset hoặc thoát app)
const journalUnlockedCache: Record<string, boolean> = {};

export const JournalPinGuard: React.FC<JournalPinGuardProps> = ({ userId, children }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [pinExists, setPinExists] = useState<boolean>(false);
  const [attempts, setAttempts] = useState<number>(0);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [inputPin, setInputPin] = useState<string>('');
  
  // Trạng thái cho chế độ Thiết lập (Setup Mode)
  const [setupStep, setSetupStep] = useState<'create' | 'confirm'>('create');
  const [tempPin, setTempPin] = useState<string>('');
  
  // Trạng thái hiển thị thông báo
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' | 'info' | null }>({
    text: '',
    type: null,
  });

  const [isShake, setIsShake] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [unlockedSession, setUnlockedSession] = useState<boolean>(() => {
    return !!journalUnlockedCache[userId];
  });

  // Tải thông tin cấu hình PIN từ Supabase
  const loadPinStatus = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('journal_pin, journal_pin_attempts')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (data) {
        setPinExists(!!data.journal_pin);
        const dbAttempts = data.journal_pin_attempts || 0;
        setAttempts(dbAttempts);
        if (dbAttempts >= 5) {
          setIsLocked(true);
          journalUnlockedCache[userId] = false;
          setUnlockedSession(false);
          setMessage({
            text: 'Tài khoản nhật ký tạm thời bị khóa do nhập sai quá 5 lần. Hãy liên hệ Admin để khôi phục.',
            type: 'error'
          });
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải trạng thái PIN:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId && !unlockedSession) {
      loadPinStatus();
    } else {
      setLoading(false);
    }
  }, [userId, unlockedSession]);

  // Lắng nghe sự kiện bàn phím số
  useEffect(() => {
    if (loading || isLocked || unlockedSession) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleNumberPress(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape') {
        setInputPin('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inputPin, pinExists, setupStep, tempPin, isLocked, loading, unlockedSession]);

  // Kích hoạt hiệu ứng lắc khi nhập sai
  const triggerShake = () => {
    setIsShake(true);
    setTimeout(() => setIsShake(false), 500);
  };

  // Nhấn nút số
  const handleNumberPress = (num: string) => {
    if (inputPin.length >= 4) return;
    const newPin = inputPin + num;
    setInputPin(newPin);

    // Khi đã nhập đủ 4 số
    if (newPin.length === 4) {
      // Đợi hiệu ứng phản hồi nhỏ trước khi xử lý tiếp
      setTimeout(() => {
        processPin(newPin);
      }, 200);
    }
  };

  // Xóa số cuối
  const handleDelete = () => {
    setInputPin(prev => prev.slice(0, -1));
  };

  // Xử lý logic chính khi nhập đủ 4 số
  const processPin = async (pin: string) => {
    if (!pinExists) {
      // ── CHẾ ĐỘ THIẾT LẬP MỚI ──
      if (setupStep === 'create') {
        setTempPin(pin);
        setSetupStep('confirm');
        setInputPin('');
        setMessage({ text: 'Nhập lại mã PIN để xác nhận thiết lập', type: 'info' });
      } else {
        if (pin === tempPin) {
          // Lưu PIN mới lên cơ sở dữ liệu
          setIsSaving(true);
          try {
            const hashed = await hashPin(pin);
            const { error } = await supabase
              .from('profiles')
              .update({
                journal_pin: hashed,
                journal_pin_attempts: 0
              })
              .eq('id', userId);

            if (error) throw error;

            journalUnlockedCache[userId] = true;
            setUnlockedSession(true);
            setMessage({ text: 'Thiết lập mã PIN thành công!', type: 'success' });
          } catch (err: any) {
            console.error(err);
            setMessage({ text: 'Có lỗi xảy ra khi lưu mã PIN: ' + err.message, type: 'error' });
            // Reset
            setSetupStep('create');
            setTempPin('');
            setInputPin('');
          } finally {
            setIsSaving(false);
          }
        } else {
          // Xác nhận sai
          triggerShake();
          setInputPin('');
          setMessage({ text: 'Mã PIN xác nhận không trùng khớp! Hãy thiết lập lại.', type: 'error' });
          setSetupStep('create');
          setTempPin('');
        }
      }
    } else {
      // ── CHẾ ĐỘ NHẬP PIN MỞ KHÓA ──
      try {
        setLoading(true);
        const hashedInput = await hashPin(pin);
        
        // Fetch trực tiếp để tránh cache trạng thái bị lệch
        const { data, error } = await supabase
          .from('profiles')
          .select('journal_pin, journal_pin_attempts')
          .eq('id', userId)
          .single();

        if (error) throw error;

        if (data && data.journal_pin === hashedInput) {
          // Nhập đúng
          if (data.journal_pin_attempts > 0) {
            // Reset số lần nhập sai trên DB về 0
            await supabase
              .from('profiles')
              .update({ journal_pin_attempts: 0 })
              .eq('id', userId);
          }
          journalUnlockedCache[userId] = true;
          setUnlockedSession(true);
        } else {
          // Nhập sai
          const newAttempts = (data?.journal_pin_attempts || 0) + 1;
          
          // Cập nhật số lần thử sai lên DB
          await supabase
            .from('profiles')
            .update({ journal_pin_attempts: newAttempts })
            .eq('id', userId);

          setAttempts(newAttempts);
          triggerShake();
          setInputPin('');

          if (newAttempts >= 5) {
            setIsLocked(true);
            setMessage({
              text: 'Bạn đã nhập sai mã PIN quá 5 lần. Nhật ký của bạn đã bị khóa để bảo mật thông tin.',
              type: 'error'
            });
          } else {
            setMessage({
              text: `Mã PIN không đúng! Bạn còn ${5 - newAttempts} lần thử.`,
              type: 'error'
            });
          }
        }
      } catch (err: any) {
        console.error(err);
        setMessage({ text: 'Có lỗi kiểm tra mã PIN: ' + err.message, type: 'error' });
      } finally {
        setLoading(false);
      }
    }
  };

  // Trả về giao diện chính của Nhật ký nếu đã mở khóa thành công
  if (unlockedSession) {
    return <>{children}</>;
  }

  return (
    <div className="w-full max-w-md mx-auto my-8 bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden p-6 md:p-8 flex flex-col items-center">
      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <RefreshCw className="animate-spin text-emerald-500" size={36} />
          <p className="text-sm text-gray-500 font-bold">Đang tải cấu hình bảo mật...</p>
        </div>
      ) : isLocked ? (
        // ── GIAO DIỆN KHÓA TÀI KHOẢN ──
        <div className="w-full text-center py-8 space-y-6 animate-in zoom-in-95 duration-200">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-100 shadow-inner">
            <ShieldAlert size={40} className="animate-bounce" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-gray-800">Mục Nhật ký bị Khóa</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Vì lý do bảo mật, mục Nhật ký đã bị tạm khóa sau **5 lần** nhập sai mã PIN liên tiếp.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left space-y-2">
            <h4 className="text-xs font-black text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle size={14} /> Hướng dẫn khôi phục:
            </h4>
            <p className="text-xs text-amber-700 leading-relaxed font-medium">
              Bạn đang là Admin hệ thống. Để khôi phục mã PIN:
              <br />
              1. Bấm vào phần **Admin Panel** ở menu bên trái (hoặc đường dẫn `/admin`).
              <br />
              2. Chuyển sang tab **Người dùng**.
              <br />
              3. Tìm tài khoản của bạn và nhấn nút **Reset PIN Nhật ký**.
              <br />
              4. Quay lại đây thiết lập mã PIN mới và sử dụng bình thường.
            </p>
          </div>

          <button
            onClick={loadPinStatus}
            className="w-full flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95"
          >
            <RefreshCw size={16} /> Kiểm tra lại trạng thái khóa
          </button>
        </div>
      ) : (
        // ── GIAO DIỆN NHẬP / CÀI ĐẶT PIN ──
        <div className="w-full flex flex-col items-center space-y-6">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shadow-inner border border-emerald-100">
            {pinExists ? <Lock size={28} /> : <Sparkles size={28} className="animate-pulse" />}
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-xl font-black text-gray-800">
              {!pinExists 
                ? (setupStep === 'create' ? 'Tạo mã PIN Bảo mật' : 'Xác nhận mã PIN') 
                : 'Mã PIN Nhật ký'}
            </h2>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
              {!pinExists 
                ? 'Nhật ký cá nhân cần khóa bảo vệ' 
                : 'Nhập mã PIN để xem và viết nhật ký'}
            </p>
          </div>

          {/* Dấu chấm tròn thể hiện độ dài PIN */}
          <div 
            className={`flex items-center justify-center gap-4 py-4 ${isShake ? 'animate-shake' : ''}`}
            style={{
              animation: isShake ? 'shake 0.5s ease-in-out' : undefined
            }}
          >
            {[0, 1, 2, 3].map((index) => {
              const isActive = inputPin.length > index;
              return (
                <div
                  key={index}
                  className={`w-4.5 h-4.5 rounded-full border-2 transition-all duration-150 ${
                    isActive 
                      ? 'bg-emerald-500 border-emerald-500 scale-110 shadow-sm shadow-emerald-200' 
                      : 'bg-gray-50 border-gray-300'
                  }`}
                />
              );
            })}
          </div>

          {/* Thông báo trạng thái */}
          {message.text && (
            <div className={`text-center text-xs font-bold px-4 py-2.5 rounded-xl border w-full flex items-center justify-center gap-1.5 ${
              message.type === 'error' ? 'bg-red-50 text-red-600 border-red-100' :
              message.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' :
              'bg-blue-50 text-blue-700 border-blue-100'
            }`}>
              {message.type === 'error' && <AlertCircle size={14} />}
              <span>{message.text}</span>
            </div>
          )}

          {/* Bàn phím số cảm ứng đẹp mắt */}
          <div className="grid grid-cols-3 gap-3.5 w-full max-w-[280px]">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleNumberPress(num)}
                disabled={isSaving}
                className="w-16 h-16 rounded-full bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border border-gray-100 font-mono text-xl font-bold text-gray-800 flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {num}
              </button>
            ))}
            
            {/* Phím Clear/Trống */}
            <button
              type="button"
              onClick={() => setInputPin('')}
              disabled={isSaving || !inputPin}
              className="w-16 h-16 rounded-full font-sans text-xs font-bold text-gray-400 hover:text-gray-600 flex items-center justify-center transition-all cursor-pointer disabled:opacity-30"
            >
              Xóa hết
            </button>

            {/* Phím 0 */}
            <button
              type="button"
              onClick={() => handleNumberPress('0')}
              disabled={isSaving}
              className="w-16 h-16 rounded-full bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border border-gray-100 font-mono text-xl font-bold text-gray-800 flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-sm disabled:opacity-50"
            >
              0
            </button>

            {/* Phím Xóa chữ cuối (Backspace) */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSaving || !inputPin}
              className="w-16 h-16 rounded-full bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border border-gray-100 text-gray-500 flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-sm disabled:opacity-50"
              title="Xóa ký tự cuối"
            >
              <Delete size={20} />
            </button>
          </div>

          {!pinExists && (
            <div className="text-[10px] text-gray-400 text-center leading-relaxed">
              Mã PIN này sẽ bảo vệ mọi nội dung viết hoặc đọc nhật ký của bạn.
              <br />
              Hãy nhớ kỹ và không chia sẻ cho người khác.
            </div>
          )}
        </div>
      )}

      {/* Shake Keyframe Animation Inject */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};
