// File: src/services/desktopBridge.ts
// Cầu nối tới vỏ Windows (Tauri v2). Dùng window.__TAURI__ (withGlobalTauri) nên web/mobile không cần thêm thư viện.
// Mọi hàm đều an toàn khi chạy ngoài Tauri (không làm gì).

import { isTauri } from './stickyNoteService';

const OPEN_WINDOWS_KEY = 'smartlife_sticky_open_windows';

function tauri(): any {
  return (window as any).__TAURI__;
}

async function invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T | undefined> {
  const t = tauri();
  if (!t?.core?.invoke) return undefined;
  return t.core.invoke(cmd, args);
}

function currentWindow(): any {
  return tauri()?.window?.getCurrentWindow?.();
}

function readOpenIds(): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem(OPEN_WINDOWS_KEY) || '[]');
    return Array.isArray(ids) ? ids.filter((x: unknown) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeOpenIds(ids: string[]) {
  try {
    localStorage.setItem(OPEN_WINDOWS_KEY, JSON.stringify(Array.from(new Set(ids))));
  } catch { /* ignore */ }
}

export const desktopBridge = {
  isDesktop: isTauri,

  /** Mở (hoặc focus) cửa sổ note nổi trên desktop. */
  async openStickyWindow(noteId: string): Promise<void> {
    await invoke('open_sticky_window', { noteId });
  },

  async setAlwaysOnTop(on: boolean): Promise<void> {
    await currentWindow()?.setAlwaysOnTop?.(on);
  },

  async closeCurrentWindow(): Promise<void> {
    await currentWindow()?.close?.();
  },

  async focusMainWindow(): Promise<void> {
    await invoke('show_main_window');
  },

  /** Lắng nghe lệnh điều hướng từ khay hệ thống (vd mở tab Sticky). Trả về hàm huỷ. */
  async onNavigate(cb: (tab: string) => void): Promise<(() => void) | undefined> {
    const listen = tauri()?.event?.listen;
    if (!listen) return undefined;
    return listen('smartlife://navigate', (e: { payload: unknown }) => {
      if (typeof e.payload === 'string') cb(e.payload);
    });
  },

  /** Ghi nhớ cửa sổ note đang mở để khôi phục khi khởi động lại app. */
  rememberOpen(noteId: string) {
    writeOpenIds([...readOpenIds(), noteId]);
  },

  forgetOpen(noteId: string) {
    writeOpenIds(readOpenIds().filter(id => id !== noteId));
  },

  /** Gọi 1 lần từ cửa sổ chính khi app desktop khởi động. */
  async restoreOpenWindows(): Promise<void> {
    if (!isTauri()) return;
    for (const id of readOpenIds()) {
      try {
        await invoke('open_sticky_window', { noteId: id });
      } catch {
        this.forgetOpen(id);
      }
    }
  },
};
