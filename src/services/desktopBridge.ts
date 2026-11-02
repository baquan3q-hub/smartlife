// File: src/services/desktopBridge.ts
// Cầu nối tới vỏ Windows (Tauri v2). Dùng window.__TAURI__ (withGlobalTauri) nên web/mobile không cần thêm thư viện.
// Mọi hàm đều an toàn khi chạy ngoài Tauri và không bao giờ ném lỗi — trả về false nếu không làm được.
// Các việc quan trọng (kéo/đóng/đổi kích thước cửa sổ, nhớ note đang mở) do Rust xử lý, không phụ thuộc file này.

import { isTauri } from './stickyNoteService';

function tauri(): any {
  return (window as any).__TAURI__;
}

async function invoke(cmd: string, args?: Record<string, unknown>): Promise<boolean> {
  try {
    const t = tauri();
    if (!t?.core?.invoke) return false;
    await t.core.invoke(cmd, args);
    return true;
  } catch (err) {
    console.warn(`[SmartLife desktop] ${cmd} thất bại:`, err);
    return false;
  }
}

async function withCurrentWindow(fn: (w: any) => Promise<unknown> | unknown): Promise<boolean> {
  try {
    const w = tauri()?.window?.getCurrentWindow?.();
    if (!w) return false;
    await fn(w);
    return true;
  } catch (err) {
    console.warn('[SmartLife desktop] window API thất bại:', err);
    return false;
  }
}

export const desktopBridge = {
  isDesktop: isTauri,

  /** Mở (hoặc focus) cửa sổ note nổi trên desktop. */
  openStickyWindow(noteId: string): Promise<boolean> {
    return invoke('open_sticky_window', { noteId });
  },

  /** Mở cửa sổ note mới (giống Ctrl+Alt+N). */
  newStickyWindow(): Promise<boolean> {
    return invoke('new_sticky_window');
  },

  setAlwaysOnTop(on: boolean): Promise<boolean> {
    return withCurrentWindow(w => w.setAlwaysOnTop(on));
  },

  setTitle(title: string): Promise<boolean> {
    if (!isTauri()) return Promise.resolve(false);
    return withCurrentWindow(w => w.setTitle(title));
  },

  closeCurrentWindow(): Promise<boolean> {
    return withCurrentWindow(w => w.close());
  },

  focusMainWindow(): Promise<boolean> {
    return invoke('show_main_window');
  },

  /** Lắng nghe lệnh điều hướng từ khay hệ thống (vd mở tab Sticky). Trả về hàm huỷ. */
  async onNavigate(cb: (tab: string) => void): Promise<(() => void) | undefined> {
    try {
      const listen = tauri()?.event?.listen;
      if (!listen) return undefined;
      return await listen('smartlife://navigate', (e: { payload: unknown }) => {
        if (typeof e.payload === 'string') cb(e.payload);
      });
    } catch {
      return undefined;
    }
  },
};
