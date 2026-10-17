import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Delete, KeyRound, Loader2, Lock, RefreshCw, ShieldAlert } from 'lucide-react';

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

  const title = !pinExists ? (setupStep === 'create' ? 'Tạo mã PIN' : 'Nhập lại mã PIN') : 'Nhập mã PIN';
  const hint = !pinExists
    ? setupStep === 'create'
      ? 'Mã 4 số giúp giữ nhật ký của bạn riêng tư.'
      : 'Nhập lại để xác nhận.'
    : 'Nhật ký của bạn đang được khóa.';
  const keyClass =
    'flex h-16 w-16 items-center justify-center rounded-full font-medium tabular-nums text-zinc-900 transition-colors disabled:opacity-40';

  return (
    <div className="ui-zinc flex min-h-[70vh] w-full items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm rounded-[24px] border border-zinc-900/[0.08] bg-white px-6 py-8 text-zinc-900">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16 text-[13px] text-zinc-500">
            <Loader2 size={22} className="animate-spin text-zinc-400" aria-hidden />
            Đang kiểm tra…
          </div>
        ) : isLocked ? (
          // ── GIAO DIỆN KHÓA TÀI KHOẢN ──
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700">
              <ShieldAlert size={22} strokeWidth={1.75} aria-hidden />
            </span>
            <h2 className="mt-4 text-[19px] font-semibold tracking-tight text-zinc-950">Nhật ký đang bị khóa</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-600">
              Mã PIN đã bị nhập sai 5 lần liên tiếp. Liên hệ quản trị viên để đặt lại mã PIN.
            </p>
            <div className="mt-5 rounded-2xl bg-zinc-50 p-4 text-left text-[13px] leading-relaxed text-zinc-600">
              <p className="mb-1.5 font-medium text-zinc-800">Nếu bạn là quản trị viên</p>
              <ol className="list-decimal space-y-0.5 pl-4">
                <li>Mở Admin Panel, tab Người dùng.</li>
                <li>Tìm tài khoản và chọn Reset PIN Nhật ký.</li>
                <li>Quay lại đây để tạo mã PIN mới.</li>
              </ol>
            </div>
            <button
              type="button"
              onClick={loadPinStatus}
              className="mt-5 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-zinc-900/[0.1] bg-white text-[14px] font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
            >
              <RefreshCw size={16} aria-hidden /> Kiểm tra lại
            </button>
          </div>
        ) : (
          // ── GIAO DIỆN NHẬP / CÀI ĐẶT PIN ──
          <div className="flex flex-col items-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
              {pinExists ? <Lock size={22} strokeWidth={1.75} aria-hidden /> : <KeyRound size={22} strokeWidth={1.75} aria-hidden />}
            </span>
            <h2 className="mt-4 text-[19px] font-semibold tracking-tight text-zinc-950">{title}</h2>
            <p className="mt-1 text-center text-[14px] text-zinc-500">{hint}</p>

            {/* Dấu chấm tròn thể hiện độ dài PIN */}
            <div
              className={`my-6 flex items-center gap-4 ${isShake ? 'ui-shake' : ''}`}
              role="img"
              aria-label={`Đã nhập ${inputPin.length} trên 4 số`}
            >
              {[0, 1, 2, 3].map(index => (
                <span
                  key={index}
                  className={`h-3.5 w-3.5 rounded-full transition-colors duration-150 ${
                    inputPin.length > index ? 'bg-zinc-950' : 'bg-zinc-200'
                  }`}
                />
              ))}
            </div>

            {/* Thông báo trạng thái */}
            <div className="mb-4 min-h-[20px] text-center text-[13px]" aria-live="polite">
              {message.text && (
                <span
                  className={
                    message.type === 'error' ? 'text-red-700' : message.type === 'success' ? 'text-emerald-700' : 'text-zinc-600'
                  }
                >
                  {message.text}
                </span>
              )}
            </div>

            {/* Bàn phím số */}
            <div className="grid grid-cols-3 gap-x-5 gap-y-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleNumberPress(num)}
                  disabled={isSaving}
                  className={`${keyClass} bg-zinc-100 text-[24px] hover:bg-zinc-200 active:bg-zinc-200`}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setInputPin('')}
                disabled={isSaving || !inputPin}
                className={`${keyClass} whitespace-nowrap text-[13px] text-zinc-500 hover:bg-zinc-100`}
              >
                Xóa hết
              </button>
              <button
                type="button"
                onClick={() => handleNumberPress('0')}
                disabled={isSaving}
                className={`${keyClass} bg-zinc-100 text-[24px] hover:bg-zinc-200 active:bg-zinc-200`}
              >
                0
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving || !inputPin}
                aria-label="Xóa số cuối"
                title="Xóa số cuối"
                className={`${keyClass} text-zinc-500 hover:bg-zinc-100`}
              >
                <Delete size={22} strokeWidth={1.75} />
              </button>
            </div>

            {!pinExists && (
              <p className="mt-6 text-center text-[12px] leading-relaxed text-zinc-500">
                Hãy ghi nhớ mã PIN và không chia sẻ cho người khác.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
