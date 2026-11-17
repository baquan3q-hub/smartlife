// File: src/components/sticky/StickyWindowsAppBanner.tsx
// Trên Windows mà đang mở SmartLife bằng trình duyệt (kể cả bản "cài đặt" từ Chrome/Edge/Cốc Cốc — PWA),
// người dùng dễ nhầm với app desktop rồi thắc mắc vì sao không có note nổi và Ctrl+Alt+N.
// Banner nói rõ điều đó và chỉ cách mở / tải app SmartLife cho Windows. Ẩn được (nhớ trên máy).

import React, { useState } from 'react';
import { Monitor, X, Download } from 'lucide-react';

const DISMISS_KEY = 'smartlife_windows_app_banner_dismissed';
const LATEST_RELEASE_URL = 'https://github.com/baquan3q-hub/smartlife/releases/latest';

/** Đang chạy trong cửa sổ PWA (bản cài từ trình duyệt) thay vì tab thường. */
function isInstalledWebApp(): boolean {
  try {
    return ['standalone', 'window-controls-overlay', 'minimal-ui']
      .some(mode => window.matchMedia(`(display-mode: ${mode})`).matches);
  } catch {
    return false;
  }
}

export function isWindowsBrowser(): boolean {
  return typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent);
}

export function isWindowsAppBannerDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export const StickyWindowsAppBanner: React.FC<{ onDismiss: () => void }> = ({ onDismiss }) => {
  const [installed] = useState(isInstalledWebApp);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    onDismiss();
  };

  return (
    <div role="note" className="mb-4 flex items-start gap-3 p-4 rounded-2xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-900 text-sm text-indigo-900 dark:text-indigo-100">
      <Monitor size={20} className="shrink-0 mt-0.5 text-indigo-500" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold">
          {installed ? 'Bạn đang mở SmartLife bản cài từ trình duyệt, không phải app Windows' : 'Bạn đang dùng SmartLife trên trình duyệt'}
        </p>
        <p className="mt-1 opacity-90">
          Note nổi trên màn hình và phím tắt{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-800 font-mono text-xs">Ctrl+Alt+N</kbd>{' '}
          chỉ có trong app <b>SmartLife cho Windows</b>. Đã cài rồi thì mở <b>SmartLife</b> từ Start Menu
          (tiêu đề cửa sổ là “SmartLife”, không có chữ “Assistant”).
        </p>
        <a
          href={LATEST_RELEASE_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 mt-3 px-3 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
        >
          <Download size={15} /> Tải app Windows
        </a>
      </div>
      <button onClick={dismiss} aria-label="Ẩn thông báo" title="Ẩn" className="shrink-0 p-1 rounded-lg text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/50">
        <X size={16} />
      </button>
    </div>
  );
};

export default StickyWindowsAppBanner;
