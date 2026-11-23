import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { Check, Copy, Globe, Loader2, Share2, X } from 'lucide-react';
import {
  buildShareUrl,
  createTaskShare,
  DEFAULT_SHARE_OPTIONS,
  getTaskShare,
  stopTaskShare,
  TaskShare,
  TaskShareOptions,
  updateTaskShare,
} from '../../services/taskShareService';

interface ShareTaskModalProps {
  todoId: string;
  userId: string;
  taskTitle: string;
  onClose: () => void;
}

type ToggleKey = 'show_description' | 'show_subtasks' | 'show_deadline' | 'show_links' | 'show_owner';

const TOGGLES: { key: ToggleKey; label: string }[] = [
  { key: 'show_description', label: 'Mô tả chi tiết' },
  { key: 'show_subtasks', label: 'Danh sách việc nhỏ' },
  { key: 'show_deadline', label: 'Hạn hoàn thành' },
  { key: 'show_links', label: 'Link đính kèm' },
  { key: 'show_owner', label: 'Tên của bạn' },
];

const EXPIRY_OPTIONS: { label: string; days: number | null }[] = [
  { label: 'Không hết hạn', days: null },
  { label: '1 ngày', days: 1 },
  { label: '7 ngày', days: 7 },
  { label: '30 ngày', days: 30 },
];

const expiryToDays = (expiresAt: string | null): number | null => {
  if (!expiresAt) return null;
  const left = (new Date(expiresAt).getTime() - Date.now()) / 86400000;
  // Chọn mốc gần nhất để hiển thị trong dropdown
  const candidates = [1, 7, 30];
  return candidates.reduce((best, d) => (Math.abs(d - left) < Math.abs(best - left) ? d : best), 30);
};

const daysToExpiry = (days: number | null): string | null =>
  days === null ? null : new Date(Date.now() + days * 86400000).toISOString();

const ShareTaskModal: React.FC<ShareTaskModalProps> = ({ todoId, userId, taskTitle, onClose }) => {
  const [share, setShare] = useState<TaskShare | null>(null);
  const [options, setOptions] = useState<TaskShareOptions>(DEFAULT_SHARE_OPTIONS);
  const [expiryDays, setExpiryDays] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getTaskShare(todoId)
      .then((s) => {
        if (!alive) return;
        setShare(s);
        if (s) {
          setOptions({
            show_description: s.show_description,
            show_subtasks: s.show_subtasks,
            show_deadline: s.show_deadline,
            show_links: s.show_links,
            show_owner: s.show_owner,
            expires_at: s.expires_at,
          });
          setExpiryDays(expiryToDays(s.expires_at));
        }
      })
      .catch(() => alive && setError('Không tải được trạng thái chia sẻ. Bạn đã chạy sql/task_share.sql chưa?'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [todoId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch { setError('Thao tác thất bại, vui lòng thử lại.'); } finally { setBusy(false); }
  }, []);

  const handleCreate = () => run(async () => {
    const created = await createTaskShare(todoId, userId, { ...options, expires_at: daysToExpiry(expiryDays) });
    setShare(created);
    setOptions((o) => ({ ...o, expires_at: created.expires_at }));
  });

  const patch = (change: Partial<TaskShareOptions>) => {
    const prev = options;
    setOptions({ ...options, ...change });
    if (!share) return;
    run(async () => {
      try {
        setShare(await updateTaskShare(share.id, change));
      } catch (e) {
        setOptions(prev);
        throw e;
      }
    });
  };

  const handleExpiry = (days: number | null) => {
    setExpiryDays(days);
    patch({ expires_at: daysToExpiry(days) });
  };

  const handleStop = () => run(async () => {
    if (!share) return;
    await stopTaskShare(share.id);
    setShare(null);
  });

  const url = share ? buildShareUrl(share.token) : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Không sao chép được, hãy chọn và copy link thủ công.');
    }
  };

  const handleNativeShare = async () => {
    const payload = { title: taskTitle, text: `Xem task "${taskTitle}" trên SmartLife`, url };
    try {
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import('@capacitor/share');
        await Share.share(payload);
      } else if (navigator.share) {
        await navigator.share(payload);
      } else {
        await handleCopy();
      }
    } catch (err) {
      // Người dùng đóng bảng chia sẻ không phải lỗi
      if (!/cancel|abort/i.test(String((err as any)?.message || (err as any)?.name || err))) {
        setError('Không mở được bảng chia sẻ.');
      }
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100001] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Chia sẻ task"
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Share2 size={16} /> Chia sẻ task
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
            <X size={17} />
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4 truncate">{taskTitle}</p>

        {loading ? (
          <div className="py-10 flex justify-center text-slate-400"><Loader2 className="animate-spin" size={20} /></div>
        ) : (
          <>
            {share && (
              <div className="mb-4">
                <div className="flex items-center gap-2 p-2 pl-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <Globe size={14} className="text-emerald-500 shrink-0" />
                  <input
                    readOnly
                    value={url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 min-w-0 bg-transparent text-xs text-slate-700 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="shrink-0 px-3 py-1.5 rounded-xl bg-black text-white text-[11px] font-bold flex items-center gap-1 active:scale-95"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? 'Đã chép' : 'Sao chép'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="mt-2 w-full py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5"
                >
                  <Share2 size={14} /> Gửi qua ứng dụng khác
                </button>
                <p className="mt-2 text-[11px] text-slate-400">
                  Bất kỳ ai có link đều xem được (chỉ xem, không cần tài khoản). Nội dung luôn cập nhật theo task.
                  Thay đổi chưa lưu trong cửa sổ task sẽ chưa hiện ra.
                </p>
              </div>
            )}

            <div className="space-y-1 mb-4">
              <div className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-1">Cho người xem thấy</div>
              <p className="text-[11px] text-slate-400 mb-2">Tiêu đề và trạng thái luôn hiển thị.</p>
              {TOGGLES.map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between py-1.5 cursor-pointer select-none">
                  <span className="text-sm text-slate-700">{label}</span>
                  <input
                    type="checkbox"
                    checked={options[key]}
                    disabled={busy}
                    onChange={(e) => patch({ [key]: e.target.checked } as Partial<TaskShareOptions>)}
                    className="w-4 h-4 accent-black"
                  />
                </label>
              ))}
            </div>

            <div className="mb-5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide block mb-1.5">Thời hạn link</label>
              <select
                value={expiryDays === null ? '' : String(expiryDays)}
                disabled={busy}
                onChange={(e) => handleExpiry(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white outline-none"
              >
                {EXPIRY_OPTIONS.map((o) => (
                  <option key={o.label} value={o.days === null ? '' : String(o.days)}>{o.label}</option>
                ))}
              </select>
            </div>

            {error && <p className="mb-3 text-xs font-semibold text-rose-600">{error}</p>}

            {share ? (
              <button
                type="button"
                onClick={handleStop}
                disabled={busy}
                className="w-full py-3 rounded-2xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold disabled:opacity-50"
              >
                Tắt chia sẻ (link sẽ ngừng hoạt động)
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreate}
                disabled={busy}
                className="w-full py-3 rounded-2xl bg-black hover:bg-slate-900 text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-95"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />} Tạo link chia sẻ
              </button>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ShareTaskModal;
