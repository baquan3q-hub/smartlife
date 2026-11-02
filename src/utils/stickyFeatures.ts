// File: src/utils/stickyFeatures.ts
// Công tắc tính năng cho Sticky Notes.
// - Tắt toàn hệ thống khi build: VITE_STICKY_RICH_EDITOR=false
// - Tắt trên 1 máy (hỗ trợ người dùng gặp lỗi): localStorage.smartlife_sticky_rich_editor = 'off'

const RICH_EDITOR_KEY = 'smartlife_sticky_rich_editor';

export function isRichEditorEnabled(): boolean {
  if (import.meta.env.VITE_STICKY_RICH_EDITOR === 'false') return false;
  try {
    return localStorage.getItem(RICH_EDITOR_KEY) !== 'off';
  } catch {
    return true;
  }
}
