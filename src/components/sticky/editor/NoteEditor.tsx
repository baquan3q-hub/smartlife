// File: src/components/sticky/editor/NoteEditor.tsx
// Ô soạn nội dung note. Trình soạn thảo rich text (Tiptap) được tải lười (chunk riêng) —
// trong lúc tải, khi tải lỗi (offline sau khi có bản deploy mới) hoặc khi tắt công tắc,
// dùng textarea cũ: vẫn sửa được Markdown thô, không mất dữ liệu.

import React, { Suspense, lazy, useEffect, useId, useLayoutEffect, useRef } from 'react';
import { isRichEditorEnabled } from '../../../utils/stickyFeatures';

export interface NoteEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  /** card: thẻ trên bảng (cao tối đa 480px, thanh định dạng khi đang sửa) · window: cửa sổ nổi (lấp đầy) */
  variant: 'card' | 'window';
  readOnly?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  /** Cửa sổ nổi: hiện thanh định dạng (nút "Aa") */
  showToolbar?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Gán hàm focus() để component cha đặt con trỏ vào note */
  focusRef?: React.MutableRefObject<(() => void) | null>;
  /** Lần sửa đầu sẽ lưu note cũ ở dạng Markdown chuẩn hoá (khác chuỗi gốc) → cha chụp phiên bản cũ trước. */
  onLegacyRewrite?: () => void;
  /** Nội bộ: id của textarea dự phòng — trình soạn thảo nhận lại focus nếu người dùng đang gõ trong đó. */
  fallbackId?: string;
}

// Đọc 1 lần (localStorage) — đổi công tắc cần tải lại trang
const RICH_ENABLED = isRichEditorEnabled();

let editorModule: Promise<typeof import('./RichNoteEditor')> | null = null;
/** Tải trước chunk trình soạn thảo (gọi khi mở bảng Sticky Notes). */
export function preloadRichEditor() {
  if (!RICH_ENABLED) return;
  editorModule ??= import('./RichNoteEditor');
  editorModule.catch(() => { editorModule = null; });
}

const RichNoteEditor = lazy(() => {
  editorModule ??= import('./RichNoteEditor');
  return editorModule.catch((e) => { editorModule = null; throw e; });
});

/** Textarea cũ — dùng khi trình soạn thảo chưa sẵn sàng. */
export const PlainNoteEditor: React.FC<NoteEditorProps> = ({
  value, onChange, variant, readOnly, autoFocus, placeholder = 'Ghi chú...', onFocus, onBlur, focusRef, fallbackId,
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || variant !== 'card') return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 480)}px`;
  }, [value, variant]);

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  useEffect(() => {
    if (!focusRef) return;
    focusRef.current = () => ref.current?.focus();
    return () => { focusRef.current = null; };
  }, [focusRef]);

  return (
    <textarea
      ref={ref}
      data-sticky-fallback={fallbackId}
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={(e) => { if (variant === 'card' && e.key === 'Escape') e.currentTarget.blur(); }}
      placeholder={placeholder}
      spellCheck={variant === 'card'}
      rows={variant === 'card' ? 3 : undefined}
      className={variant === 'card'
        ? 'sticky-scroll w-full bg-transparent resize-none outline-none text-sm leading-relaxed mt-1 placeholder:opacity-50'
        : 'sticky-scroll flex-1 min-h-0 mt-1 bg-transparent resize-none outline-none leading-relaxed placeholder:opacity-50'}
      style={variant === 'window' ? { fontSize: '1em' } : undefined}
    />
  );
};

class EditorErrorBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.warn('[sticky] Trình soạn thảo lỗi, dùng ô văn bản thường:', error); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export const NoteEditor: React.FC<NoteEditorProps> = (props) => {
  const fallbackId = useId();
  if (!RICH_ENABLED) return <PlainNoteEditor {...props} />;
  return (
    <EditorErrorBoundary fallback={<PlainNoteEditor {...props} />}>
      <Suspense fallback={<PlainNoteEditor {...props} fallbackId={fallbackId} />}>
        <RichNoteEditor {...props} fallbackId={fallbackId} />
      </Suspense>
    </EditorErrorBoundary>
  );
};
