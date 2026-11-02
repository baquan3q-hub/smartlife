// File: src/services/desktopBridge.ts
// Cầu nối tới vỏ Windows (Tauri v2).
//
// Cách gửi lệnh: trang "điều hướng" tới https://<origin>/__desktop/<lệnh>?<tham số>. App desktop (từ v0.1.2)
// chặn lượt điều hướng đó và thực hiện lệnh — trang không bị tải lại. Không phụ thuộc kênh IPC của Tauri
// (không hoạt động ổn định với trang tải từ web). App đánh dấu bằng window.__SMARTLIFE_DESKTOP__.
// Bản desktop cũ (chưa có dấu này) thì thử IPC như trước.
// Mọi hàm đều an toàn ngoài desktop và không ném lỗi — trả về false nếu không làm được.

import { isTauri } from './stickyNoteService';

const COMMAND_PATH = '/__desktop/';
/** Khoảng cách giữa 2 lệnh: gán location liên tiếp quá nhanh thì lệnh sau huỷ lệnh trước. */
const COMMAND_GAP_MS = 120;

function hasCommandBridge(): boolean {
  return typeof window !== 'undefined' && Number((window as any).__SMARTLIFE_DESKTOP__) >= 2;
}

let queue: Promise<void> = Promise.resolve();

function sendCommand(command: string, params: Record<string, string> = {}): Promise<boolean> {
  if (!hasCommandBridge()) return Promise.resolve(false);
  const query = new URLSearchParams(params).toString();
  const url = `${window.location.origin}${COMMAND_PATH}${command}${query ? `?${query}` : ''}`;
  queue = queue.then(() => new Promise<void>(resolve => {
    try {
      window.location.href = url;
    } catch (err) {
      console.warn('[SmartLife desktop] gửi lệnh thất bại:', command, err);
    }
    setTimeout(resolve, COMMAND_GAP_MS);
  }));
  return queue.then(() => true);
}

// ── Dự phòng cho bản desktop cũ (IPC) ──
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
    return hasCommandBridge() ? sendCommand('open-note', { id: noteId }) : invoke('open_sticky_window', { noteId });
  },

  /** Mở cửa sổ note mới (giống Ctrl+Alt+N). */
  newStickyWindow(): Promise<boolean> {
    return hasCommandBridge() ? sendCommand('new-note') : invoke('new_sticky_window');
  },

  setAlwaysOnTop(on: boolean): Promise<boolean> {
    return hasCommandBridge() ? sendCommand('on-top', { value: on ? '1' : '0' }) : withCurrentWindow(w => w.setAlwaysOnTop(on));
  },

  setTitle(title: string): Promise<boolean> {
    if (!isTauri()) return Promise.resolve(false);
    return hasCommandBridge() ? sendCommand('title', { value: title }) : withCurrentWindow(w => w.setTitle(title));
  },

  /** Đóng cửa sổ note hiện tại (app lưu nốt rồi mới đóng). */
  closeCurrentWindow(): Promise<boolean> {
    return hasCommandBridge() ? sendCommand('close') : withCurrentWindow(w => w.close());
  },

  minimizeCurrentWindow(): Promise<boolean> {
    return hasCommandBridge() ? sendCommand('minimize') : withCurrentWindow(w => w.minimize());
  },

  /** Hiện cửa sổ SmartLife chính (tab: 'sticky' để mở bảng Sticky Notes). */
  focusMainWindow(tab?: 'sticky'): Promise<boolean> {
    return hasCommandBridge() ? sendCommand('show-main', tab ? { tab } : {}) : invoke('show_main_window');
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
