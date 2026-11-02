// File: src/components/sticky/editor/RichNoteEditor.tsx
// Trình soạn thảo rich text cho Sticky Notes (Tiptap 3) — nhập/xuất Markdown (GFM) trong cột `content`.
// Chunk riêng, chỉ tải khi cần (xem NoteEditor.tsx).
//
// Bảo toàn dữ liệu:
// - Chỉ gọi onChange khi Markdown THỰC SỰ khác bản đang hiển thị (so với "baseline" đã chuẩn hoá) →
//   mở note / nhận bản từ máy khác / extension tự chèn đoạn trống KHÔNG tạo lượt lưu "ma".
// - Nội dung từ ngoài (realtime, khôi phục lịch sử, AI) nạp bằng setContent(..., emitUpdate: false).
// - Link chỉ nhận http/https/mailto; ảnh chỉ hiển thị nguồn hợp lệ.

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  EditorContent, Extension, NodeViewWrapper, ReactNodeViewRenderer, useEditor, useEditorState, type Editor, type NodeViewProps,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import {
  Bold, Italic, Strikethrough, List, ListOrdered, ListChecks, Link2, Table as TableIcon, ExternalLink, Unlink, Check, X, ImagePlus,
} from 'lucide-react';
import { escapeRawHtml, isAllowedImageSrc, sanitizeHref, stickyImageId } from '../../../utils/stickyMarkdown';
import { compressImage, MAX_IMAGES_PER_NOTE, StickyImageError } from '../../../utils/stickyImageCompress';
import { stickyImageStore } from '../../../services/stickyImageStore';
import { StickyImage } from '../StickyImage';
import type { NoteEditorProps } from './NoteEditor';
import '../stickyContent.css';

function tidy(md: string): string {
  return md.replace(/^\n+/, '').replace(/\s+$/, '');
}

function serialize(editor: Editor): string {
  return tidy(editor.getMarkdown());
}

function openExternal(raw: string | null | undefined) {
  const href = sanitizeHref(raw);
  if (href) window.open(href, '_blank', 'noopener,noreferrer');
}

const ImageNodeView: React.FC<NodeViewProps> = ({ node, selected }) => (
  <NodeViewWrapper className={`sticky-image-node${selected ? ' is-selected' : ''}`} data-drag-handle="">
    <StickyImage src={node.attrs.src} alt={node.attrs.alt} />
  </NodeViewWrapper>
);

/** Ảnh: hiển thị qua StickyImage (ảnh local đọc từ IndexedDB); HTML xuất ra (copy/dán) chỉ giữ nguồn hợp lệ. */
const SafeImage = Image.extend({
  addAttributes() {
    const parent = (this.parent?.() ?? {}) as Record<string, any>;
    return {
      ...parent,
      src: {
        ...parent.src,
        renderHTML: (attrs: { src?: string | null }) => {
          const src = attrs.src || '';
          return { src: isAllowedImageSrc(src) ? src : '' };
        },
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
}).configure({ allowBase64: false });

function countLocalImages(editor: Editor): number {
  let count = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'image' && stickyImageId(node.attrs.src)) count++;
  });
  return count;
}

const imageFiles = (list: FileList | null | undefined): File[] =>
  Array.from(list || []).filter(f => (f.type || '').startsWith('image/'));

const StickyShortcuts = Extension.create<{ onLink: () => void }>({
  name: 'stickyShortcuts',
  addOptions() {
    return { onLink: () => {} };
  },
  addKeyboardShortcuts() {
    return {
      'Mod-k': () => { this.options.onLink(); return true; },
    };
  },
});

const ToolBtn: React.FC<{ title: string; active?: boolean; onClick: () => void; children: React.ReactNode }> = ({ title, active, onClick, children }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    aria-pressed={active}
    // Giữ focus + vùng chọn trong trình soạn thảo khi bấm nút
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`shrink-0 p-1.5 rounded-md transition-colors hover:bg-black/10 dark:hover:bg-white/10 ${active ? 'bg-black/10 dark:bg-white/15' : ''}`}
  >
    {children}
  </button>
);

const TextBtn: React.FC<{ title: string; onClick: () => void; children: React.ReactNode; danger?: boolean }> = ({ title, onClick, children, danger }) => (
  <button
    type="button"
    title={title}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`shrink-0 px-1.5 py-1 rounded-md text-[11px] font-semibold hover:bg-black/10 dark:hover:bg-white/10 ${danger ? 'text-red-600 dark:text-red-400' : ''}`}
  >
    {children}
  </button>
);

const FormatToolbar: React.FC<{ editor: Editor; onLink: () => void; onImage?: () => void }> = ({ editor, onLink, onImage }) => {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
      link: e.isActive('link'),
      table: e.isActive('table'),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <div className="flex flex-col gap-0.5 py-0.5" role="toolbar" aria-label="Định dạng">
      <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
        <ToolBtn title="Đậm (Ctrl+B)" active={s.bold} onClick={() => chain().toggleBold().run()}><Bold size={14} /></ToolBtn>
        <ToolBtn title="Nghiêng (Ctrl+I)" active={s.italic} onClick={() => chain().toggleItalic().run()}><Italic size={14} /></ToolBtn>
        <ToolBtn title="Gạch ngang" active={s.strike} onClick={() => chain().toggleStrike().run()}><Strikethrough size={14} /></ToolBtn>
        <span className="w-px h-4 bg-black/10 dark:bg-white/15 mx-0.5" />
        <ToolBtn title="Danh sách" active={s.bullet} onClick={() => chain().toggleBulletList().run()}><List size={14} /></ToolBtn>
        <ToolBtn title="Danh sách số" active={s.ordered} onClick={() => chain().toggleOrderedList().run()}><ListOrdered size={14} /></ToolBtn>
        <ToolBtn title="Checklist" active={s.task} onClick={() => chain().toggleTaskList().run()}><ListChecks size={14} /></ToolBtn>
        <span className="w-px h-4 bg-black/10 dark:bg-white/15 mx-0.5" />
        <ToolBtn title="Chèn link (Ctrl+K)" active={s.link} onClick={onLink}><Link2 size={14} /></ToolBtn>
        <ToolBtn title="Chèn bảng" active={s.table} onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon size={14} /></ToolBtn>
        {onImage && <ToolBtn title="Chèn ảnh (chỉ lưu trên thiết bị này)" onClick={onImage}><ImagePlus size={14} /></ToolBtn>}
      </div>
      {s.table && (
        <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide opacity-90">
          <TextBtn title="Thêm hàng bên dưới" onClick={() => chain().addRowAfter().run()}>+ Hàng</TextBtn>
          <TextBtn title="Thêm cột bên phải" onClick={() => chain().addColumnAfter().run()}>+ Cột</TextBtn>
          <TextBtn title="Xoá hàng đang chọn" onClick={() => chain().deleteRow().run()}>− Hàng</TextBtn>
          <TextBtn title="Xoá cột đang chọn" onClick={() => chain().deleteColumn().run()}>− Cột</TextBtn>
          <TextBtn title="Xoá cả bảng" danger onClick={() => chain().deleteTable().run()}>Xoá bảng</TextBtn>
        </div>
      )}
    </div>
  );
};

const LinkBar: React.FC<{
  initial: string; hasLink: boolean; onApply: (url: string) => boolean; onRemove: () => void; onCancel: () => void;
}> = ({ initial, hasLink, onApply, onRemove, onCancel }) => {
  const [url, setUrl] = useState(initial);
  const [error, setError] = useState(false);
  const submit = () => { if (!onApply(url)) setError(true); };
  return (
    <div className="flex flex-col gap-0.5 py-1">
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(false); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); submit(); }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
          }}
          placeholder="Dán link, ví dụ https://…"
          aria-label="Địa chỉ link"
          inputMode="url"
          className="flex-1 min-w-0 text-xs px-2 py-1 rounded-md bg-black/5 dark:bg-white/10 outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <ToolBtn title="Áp dụng" onClick={submit}><Check size={14} /></ToolBtn>
        {hasLink && <ToolBtn title="Mở link" onClick={() => openExternal(url)}><ExternalLink size={14} /></ToolBtn>}
        {hasLink && <ToolBtn title="Bỏ link" onClick={onRemove}><Unlink size={14} /></ToolBtn>}
        <ToolBtn title="Huỷ" onClick={onCancel}><X size={14} /></ToolBtn>
      </div>
      {error && <span className="text-[11px] text-red-600 dark:text-red-400">Link không hợp lệ — chỉ nhận http, https hoặc mailto.</span>}
    </div>
  );
};

const RichNoteEditor: React.FC<NoteEditorProps> = ({
  value, onChange, variant, readOnly, autoFocus, placeholder = 'Ghi chú...', showToolbar, onFocus, onBlur, focusRef,
  onLegacyRewrite, fallbackId, imageScope,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const onLegacyRewriteRef = useRef(onLegacyRewrite);
  onChangeRef.current = onChange;
  onLegacyRewriteRef.current = onLegacyRewrite;
  // Đang gõ trong textarea dự phòng (lúc chunk còn tải) → nhận lại focus khi thay bằng trình soạn thảo
  const [inheritFocus] = useState(() => {
    const active = typeof document !== 'undefined' ? document.activeElement as HTMLElement | null : null;
    return !!fallbackId && active?.dataset?.stickyFallback === fallbackId;
  });

  /** Giá trị `value` mà trình soạn thảo đang phản ánh (do mình phát ra hoặc đã nạp vào). */
  const lastValueRef = useRef(value);
  /** Markdown đã chuẩn hoá của nội dung đang hiển thị — chỉ lưu khi khác giá trị này. */
  const baselineRef = useRef<string | null>(null);
  /** Nội dung gốc khác bản chuẩn hoá (note văn bản thuần cũ) → báo cha chụp phiên bản trước lần lưu đầu. */
  const legacyRef = useRef(false);
  const openLinkRef = useRef<() => void>(() => {});
  const [focused, setFocused] = useState(false);
  const [link, setLink] = useState<{ initial: string; hasLink: boolean; key: number } | null>(null);

  const setBaseline = (md: string, source: string) => {
    baselineRef.current = md;
    legacyRef.current = source.trim() !== md;
  };

  // ── Ảnh (chỉ lưu trên thiết bị) ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const [imageNotice, setImageNotice] = useState<{ text: string; busy?: boolean } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotice = (text: string, busy = false) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setImageNotice({ text, busy });
    if (!busy) noticeTimer.current = setTimeout(() => setImageNotice(null), 5000);
  };
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  const imageScopeRef = useRef(imageScope);
  imageScopeRef.current = readOnly ? undefined : imageScope;

  /** Nén + lưu từng ảnh rồi chèn tham chiếu sticky-img:// (tại `pos` khi thả, ngược lại tại con trỏ). */
  const insertImagesRef = useRef(async (_files: File[], _pos?: number) => {});
  insertImagesRef.current = async (files: File[], pos?: number) => {
    const ed = editorRef.current;
    const scope = imageScopeRef.current;
    if (!ed || ed.isDestroyed || !scope || !files.length) return;
    const room = MAX_IMAGES_PER_NOTE - countLocalImages(ed);
    if (room <= 0) { showNotice(`Mỗi ghi chú tối đa ${MAX_IMAGES_PER_NOTE} ảnh.`); return; }
    const batch = files.slice(0, room);
    let error: string | null = files.length > room ? `Mỗi ghi chú tối đa ${MAX_IMAGES_PER_NOTE} ảnh — đã bỏ bớt.` : null;
    showNotice(batch.length > 1 ? `Đang xử lý ${batch.length} ảnh…` : 'Đang xử lý ảnh…', true);
    let insertAt = pos;
    for (const file of batch) {
      try {
        const { blob, width, height } = await compressImage(file);
        const src = await stickyImageStore.put({ userId: scope.userId, noteId: scope.noteId, blob, width, height });
        if (ed.isDestroyed) return;
        const node = { type: 'image', attrs: { src, alt: '' } };
        if (insertAt !== undefined) {
          const at = Math.min(insertAt, ed.state.doc.content.size);
          ed.chain().focus().insertContentAt(at, node).run();
          insertAt = ed.state.selection.to;
        } else {
          ed.chain().focus().insertContent(node).run();
        }
      } catch (e) {
        error = e instanceof StickyImageError ? e.message : 'Không lưu được ảnh trên thiết bị này.';
        console.warn('[sticky] chèn ảnh lỗi:', e);
      }
    }
    if (error) showNotice(error);
    else setImageNotice(null);
    stickyImageStore.requestPersistence();
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        underline: false,
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          // autolink làm link "dính" (gõ tiếp vẫn nằm trong link) → tắt; dán URL hoặc Ctrl+K vẫn tạo link
          autolink: false,
          linkOnPaste: true,
          defaultProtocol: 'https',
          isAllowedUri: (url) => !!sanitizeHref(url),
          HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: false } }),
      SafeImage,
      Placeholder.configure({ placeholder }),
      Markdown,
      StickyShortcuts.configure({ onLink: () => openLinkRef.current() }),
    ],
    content: escapeRawHtml(value),
    contentType: 'markdown',
    editable: !readOnly,
    autofocus: autoFocus || inheritFocus ? 'end' : false,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class: 'sticky-md',
        spellcheck: variant === 'card' ? 'true' : 'false',
        'aria-label': 'Nội dung ghi chú',
      },
      handleClick: (view, _pos, event) => {
        const anchor = (event.target as HTMLElement | null)?.closest?.('a');
        if (!anchor) return false;
        // Đang sửa: Ctrl/Cmd + Click mới mở link (click thường để đặt con trỏ)
        if (!view.editable || event.ctrlKey || event.metaKey) {
          event.preventDefault();
          openExternal(anchor.getAttribute('href'));
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const files = imageFiles(event.clipboardData?.files);
        if (!files.length || !imageScopeRef.current) return false;
        event.preventDefault();
        insertImagesRef.current(files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = imageFiles((event as DragEvent).dataTransfer?.files);
        if (!files.length || !imageScopeRef.current) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: (event as DragEvent).clientX, top: (event as DragEvent).clientY })?.pos;
        insertImagesRef.current(files, pos);
        return true;
      },
      handleKeyDown: (view, event) => {
        if (event.key === 'Escape' && variant === 'card') {
          (view.dom as HTMLElement).blur();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e, transaction }) => {
      // Lần cập nhật đầu có thể đến trước khi baseline kịp đặt (autofocus → extension chèn đoạn trống):
      // lấy baseline từ tài liệu NGAY TRƯỚC giao dịch này.
      if (baselineRef.current === null && e.markdown) setBaseline(tidy(e.markdown.serialize(transaction.before.toJSON())), lastValueRef.current);
      const md = serialize(e);
      if (md === baselineRef.current) return;
      if (legacyRef.current) {
        legacyRef.current = false;
        onLegacyRewriteRef.current?.();
      }
      baselineRef.current = md;
      lastValueRef.current = md;
      onChangeRef.current(md);
    },
  }, []);
  editorRef.current = editor;

  // Baseline = nội dung vừa nạp (chạy đồng bộ khi mount, trước autofocus của Tiptap)
  useLayoutEffect(() => {
    if (editor && baselineRef.current === null) setBaseline(serialize(editor), lastValueRef.current);
  }, [editor]);

  // Nội dung thay đổi từ ngoài (máy khác, khôi phục phiên bản, AI) → nạp lại, không phát lượt lưu
  useEffect(() => {
    if (!editor || editor.isDestroyed || value === lastValueRef.current) return;
    lastValueRef.current = value;
    const { from, to } = editor.state.selection;
    editor.commands.setContent(escapeRawHtml(value), { emitUpdate: false, contentType: 'markdown' });
    setBaseline(serialize(editor), value);
    if (editor.isFocused) {
      const max = editor.state.doc.content.size;
      try { editor.commands.setTextSelection({ from: Math.min(from, max), to: Math.min(to, max) }); } catch { /* giữ con trỏ đầu */ }
    }
  }, [editor, value]);

  useEffect(() => { editor?.setEditable(!readOnly, false); }, [editor, readOnly]);

  useEffect(() => {
    if (!focusRef || !editor) return;
    focusRef.current = () => editor.commands.focus('end');
    return () => { focusRef.current = null; };
  }, [focusRef, editor]);

  const openLink = useCallback(() => {
    if (!editor || readOnly) return;
    const href = (editor.getAttributes('link').href as string | undefined) || '';
    // key mới → ô link nạp lại địa chỉ khi bấm Ctrl+K ở link khác lúc ô đang mở
    setLink({ initial: href, hasLink: !!href, key: Date.now() });
  }, [editor, readOnly]);
  openLinkRef.current = openLink;

  const closeLink = () => { setLink(null); editor?.commands.focus(); };

  const applyLink = (raw: string): boolean => {
    if (!editor) return false;
    if (!raw.trim()) { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setLink(null); return true; }
    const href = sanitizeHref(raw);
    if (!href) return false;
    const { empty } = editor.state.selection;
    if (empty && !editor.isActive('link')) {
      // Không chọn chữ → chèn chính địa chỉ làm chữ của link
      editor.chain().focus().insertContent({ type: 'text', text: raw.trim(), marks: [{ type: 'link', attrs: { href } }] }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    setLink(null);
    return true;
  };

  // Focus tính theo cả khung (nội dung + thanh định dạng + ô link): đi lại giữa các phần bên trong vẫn là "đang sửa",
  // rời khỏi khung từ bất kỳ phần nào (kể cả ô link) mới là thôi sửa.
  const isInside = (node: EventTarget | null) => !!node && !!containerRef.current?.contains(node as Node);
  const focusHandlers = {
    onFocus: (e: React.FocusEvent) => {
      if (isInside(e.relatedTarget)) return;
      setFocused(true);
      onFocus?.();
    },
    onBlur: (e: React.FocusEvent) => {
      if (isInside(e.relatedTarget)) return;
      setFocused(false);
      setLink(null);
      onBlur?.();
    },
  };

  if (!editor) return null;

  const toolbarVisible = !readOnly && (variant === 'card' ? focused : !!showToolbar);
  const canInsertImage = !readOnly && !!imageScope;
  const toolbar = toolbarVisible && (
    <FormatToolbar editor={editor} onLink={openLink} onImage={canInsertImage ? () => fileInputRef.current?.click() : undefined} />
  );
  const imageExtras = canInsertImage && (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        tabIndex={-1}
        onChange={(e) => {
          const files = imageFiles(e.target.files);
          e.target.value = '';
          insertImagesRef.current(files);
        }}
      />
      {imageNotice && (
        <div role="status" className="flex items-center gap-1.5 py-0.5 text-[11px] opacity-80">
          {imageNotice.busy && <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />}
          {imageNotice.text}
        </div>
      )}
    </>
  );
  const linkBar = link && (
    <LinkBar
      key={link.key}
      initial={link.initial}
      hasLink={link.hasLink}
      onApply={applyLink}
      onRemove={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setLink(null); }}
      onCancel={closeLink}
    />
  );

  if (variant === 'window') {
    return (
      <div ref={containerRef} {...focusHandlers} className="flex-1 min-h-0 flex flex-col">
        {toolbar}
        {linkBar}
        {imageExtras}
        <EditorContent editor={editor} className="sticky-editor sticky-editor-fill sticky-scroll flex-1 min-h-0 overflow-y-auto mt-1" />
      </div>
    );
  }

  return (
    <div ref={containerRef} {...focusHandlers}>
      <EditorContent editor={editor} className="sticky-editor sticky-scroll max-h-[480px] overflow-y-auto text-sm mt-1" />
      {linkBar}
      {imageExtras}
      {toolbar}
    </div>
  );
};

export default RichNoteEditor;
