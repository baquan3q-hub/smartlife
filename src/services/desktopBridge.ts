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

/** index.tsx đặt cờ này nếu một lệnh không được app chặn (trang bị chuyển tới /__desktop/...). */
export const BRIDGE_BROKEN_KEY = 'smartlife_desktop_bridge_broken';

function hasCommandBridge(): boolean {
  if (typeof window === 'undefined' || Number((window as any).__SMARTLIFE_DESKTOP__) < 2) return false;
  try {
    return sessionStorage.getItem(BRIDGE_BROKEN_KEY) !== '1';
  } catch {
    return true;
  }
}

/** Thời gian chờ app xác nhận đã nhận lệnh. */
const ACK_TIMEOUT_MS = 1500;
const pendingAcks = new Map<string, () => void>();

if (typeof window !== 'undefined') {
  (window as any).__smartlifeAck = (nonce: string) => {
    pendingAcks.get(nonce)?.();
  };
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Gửi lệnh tới app. Trả về true chỉ khi app xác nhận (eval __smartlifeAck) — không xác nhận thì false
 * để nơi gọi báo lỗi / dùng cách khác. Lệnh không bao giờ chứa nội dung ghi chú.
 */
function sendCommand(command: string, params: Record<string, string> = {}): Promise<boolean> {
  if (!hasCommandBridge()) return Promise.resolve(false);
  const nonce = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  const query = new URLSearchParams({ ...params, nonce }).toString();
  const url = `${window.location.origin}${COMMAND_PATH}${command}?${query}`;
  const run = () => new Promise<boolean>(resolve => {
    const timer = window.setTimeout(() => { pendingAcks.delete(nonce); resolve(false); }, ACK_TIMEOUT_MS);
    pendingAcks.set(nonce, () => { window.clearTimeout(timer); pendingAcks.delete(nonce); resolve(true); });
    try {
      window.location.href = url;
    } catch (err) {
      console.warn('[SmartLife desktop] gửi lệnh thất bại:', command, err);
    }
  }).then(async ok => {
    // Giãn cách: gán location liên tiếp quá nhanh thì lệnh sau huỷ lệnh trước
    await new Promise(r => setTimeout(r, COMMAND_GAP_MS));
    return ok;
  });
  const result = queue.then(run, run);
  queue = result.catch(() => false);
  return result;
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

  /** Kênh lệnh đã bị tắt cho cửa sổ này (app chưa cập nhật / lệnh không được nhận). */
  isBridgeBroken(): boolean {
    try {
      return Number((window as any).__SMARTLIFE_DESKTOP__) < 2 || sessionStorage.getItem(BRIDGE_BROKEN_KEY) === '1';
    } catch {
      return false;
    }
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
