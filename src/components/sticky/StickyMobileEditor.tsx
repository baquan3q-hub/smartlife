// File: src/components/sticky/StickyMobileEditor.tsx
// Trang sửa ghi chú toàn màn hình trên điện thoại. Nội dung dài cuộn theo cả trang (không cuộn lồng trong thẻ),
// tiêu đề tự xuống dòng. Các thao tác ít dùng gom vào menu ⋯ để thanh trên cùng luôn vừa màn hình hẹp.

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  ArrowLeft, Pin, PinOff, Palette, MoreVertical, Sparkles, History, Archive, ArchiveRestore,
  Trash2, RotateCcw, X, Tag, Plus, Type,
} from 'lucide-react';
import { StickyColor, StickyNote, StickyNotePatch, STICKY_COLORS, stickyNoteService } from '../../services/stickyNoteService';
import type { StickyExportFormat } from '../../services/stickyExport';
import { STICKY_THEME, relativeTime, DEVICE_LABEL } from './stickyTheme';
import { NoteEditor } from './editor/NoteEditor';
import type { StickyView } from './StickyNoteCard';
import { EXPORT_FORMATS } from './stickyExportActions';

interface StickyMobileEditorProps {
  note: StickyNote;
  view: StickyView;
  autoFocus?: boolean;
  onClose: () => void;
  onChange: (patch: StickyNotePatch, opts?: { immediate?: boolean }) => void;
  onOpenAI: () => void;
  onOpenHistory: () => void;
  onDeleteForever: () => void;
  onExport?: (format: StickyExportFormat) => void;
}

type Panel = 'none' | 'colors' | 'more';

const HeaderBtn: React.FC<{ label: string; onClick: () => void; active?: boolean; children: React.ReactNode }> = ({ label, onClick, active, children }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className={`p-2.5 rounded-xl transition-colors active:bg-black/10 dark:active:bg-white/15 ${active ? 'bg-black/10 dark:bg-white/15' : ''}`}
  >
    {children}
  </button>
);

const MenuItem: React.FC<{ icon: React.ElementType; label: string; onClick: () => void; danger?: boolean }> = ({ icon: Icon, label, onClick, danger }) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-left active:bg-slate-100 dark:active:bg-slate-800 ${danger ? 'text-red-600' : ''}`}
  >
    <Icon size={18} className="shrink-0 opacity-80" /> {label}
  </button>
);

export const StickyMobileEditor: React.FC<StickyMobileEditorProps> = ({
  note, view, autoFocus, onClose, onChange, onOpenAI, onOpenHistory, onDeleteForever, onExport,
}) => {
  const theme = STICKY_THEME[note.color] || STICKY_THEME.yellow;
  const readOnly = view === 'trash';
  const [panel, setPanel] = useState<Panel>('none');
  const [showFormat, setShowFormat] = useState(false);
  const [labelDraft, setLabelDraft] = useState<string | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Tiêu đề tự giãn theo số dòng
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [note.title]);

  // Khoá cuộn trang phía sau
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Nút Back của Android / phím Esc → đóng trang sửa (không thoát app)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    let removeBack: (() => void) | null = null;
    let cancelled = false;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(async ({ App }) => {
        const handle = await App.addListener('backButton', () => onCloseRef.current());
        if (cancelled) handle.remove(); else removeBack = () => { handle.remove(); };
      }).catch(() => {});
    }
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
      removeBack?.();
    };
  }, []);

  const act = (fn: () => void) => () => { setPanel('none'); fn(); };

  const commitLabel = () => {
    const value = (labelDraft || '').trim().replace(/^#/, '');
    if (value && !note.labels.includes(value)) {
      onChange({ labels: [...note.labels, value].slice(0, 6) }, { immediate: true });
    }
    setLabelDraft(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={note.title || 'Ghi chú'}
      className={`fixed inset-0 z-[60] flex flex-col ${theme.card}`}
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Thanh trên cùng */}
      <div className={`relative flex items-center gap-1 px-1.5 py-1 border-b border-black/5 dark:border-white/10 ${theme.bar}`}>
        <HeaderBtn label="Quay lại" onClick={onClose}><ArrowLeft size={20} /></HeaderBtn>
        <span className={`flex-1 min-w-0 truncate text-xs font-medium ${theme.muted}`}>
          {readOnly ? 'Trong thùng rác' : `Sửa ${relativeTime(note.updated_at)}${note.last_device ? ` · ${DEVICE_LABEL[note.last_device] || note.last_device}` : ''}`}
        </span>
        {readOnly ? (
          <HeaderBtn label="Khôi phục" onClick={() => onChange({ deleted_at: null }, { immediate: true })}><RotateCcw size={19} /></HeaderBtn>
        ) : (
          <>
            <HeaderBtn label="Định dạng chữ" active={showFormat} onClick={() => setShowFormat(s => !s)}><Type size={19} /></HeaderBtn>
            <HeaderBtn label={note.is_pinned ? 'Bỏ ghim' : 'Ghim lên đầu'} active={note.is_pinned} onClick={() => onChange({ is_pinned: !note.is_pinned }, { immediate: true })}>
              {note.is_pinned ? <PinOff size={19} /> : <Pin size={19} />}
            </HeaderBtn>
            <HeaderBtn label="Đổi màu" active={panel === 'colors'} onClick={() => setPanel(p => (p === 'colors' ? 'none' : 'colors'))}><Palette size={19} /></HeaderBtn>
          </>
        )}
        <HeaderBtn label="Thêm thao tác" active={panel === 'more'} onClick={() => setPanel(p => (p === 'more' ? 'none' : 'more'))}><MoreVertical size={19} /></HeaderBtn>

        {panel === 'more' && (
          <>
            <button type="button" aria-label="Đóng menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setPanel('none')} />
            <div role="menu" className="absolute right-2 top-full mt-1 z-20 w-60 py-1 rounded-2xl bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-100 shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {readOnly ? (
                <>
                  <MenuItem icon={RotateCcw} label="Khôi phục" onClick={act(() => onChange({ deleted_at: null }, { immediate: true }))} />
                  <MenuItem icon={X} label="Xoá vĩnh viễn" danger onClick={act(onDeleteForever)} />
                </>
              ) : (
                <>
                  <MenuItem icon={Sparkles} label="AI hỗ trợ" onClick={act(onOpenAI)} />
                  <MenuItem icon={History} label="Lịch sử phiên bản" onClick={act(onOpenHistory)} />
                  {onExport && EXPORT_FORMATS.map(({ format, label, icon }) => (
                    <MenuItem key={format} icon={icon} label={`Xuất ${label}`} onClick={act(() => onExport(format))} />
                  ))}
                  <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                  <MenuItem
                    icon={note.is_archived ? ArchiveRestore : Archive}
                    label={note.is_archived ? 'Bỏ lưu trữ' : 'Lưu trữ'}
                    onClick={act(() => { onChange({ is_archived: !note.is_archived }, { immediate: true }); onClose(); })}
                  />
                  <MenuItem
                    icon={Trash2}
                    label="Chuyển vào thùng rác"
                    danger
                    onClick={act(() => { onChange({ deleted_at: new Date().toISOString() }, { immediate: true }); onClose(); })}
                  />
                </>
              )}
            </div>
          </>
        )}
      </div>

      {panel === 'colors' && (
        <div className="flex flex-wrap gap-2.5 px-4 py-2.5 border-b border-black/5 dark:border-white/10" role="radiogroup" aria-label="Màu ghi chú">
          {STICKY_COLORS.map((c: StickyColor) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={note.color === c}
              aria-label={STICKY_THEME[c].name}
              onClick={() => { onChange({ color: c }, { immediate: true }); setPanel('none'); }}
              className={`w-8 h-8 rounded-full border-2 ${STICKY_THEME[c].dot} ${note.color === c ? 'border-indigo-500 scale-110' : 'border-white/70 dark:border-slate-700'} transition-transform`}
            />
          ))}
        </div>
      )}

      {/* Nội dung: cả trang cuộn, trình soạn thảo lấp phần còn lại */}
      <div className="flex-1 min-h-0 flex flex-col px-4 pt-3 pb-2 text-base">
        <textarea
          ref={titleRef}
          rows={1}
          value={note.title}
          readOnly={readOnly}
          onChange={(e) => onChange({ title: e.target.value.replace(/\n/g, ' ') })}
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
          placeholder="Tiêu đề"
          maxLength={120}
          className="w-full shrink-0 bg-transparent font-bold text-xl leading-snug resize-none outline-none overflow-hidden break-words placeholder:opacity-40"
        />
        <NoteEditor
          variant="window"
          value={note.content}
          readOnly={readOnly}
          autoFocus={autoFocus}
          showToolbar={showFormat && !readOnly}
          onChange={(content) => onChange({ content })}
          onLegacyRewrite={() => { stickyNoteService.snapshot(note).catch(() => {}); }}
          imageScope={readOnly ? undefined : { userId: note.user_id, noteId: note.id }}
        />

        {/* Nhãn */}
        <div className="shrink-0 flex flex-wrap items-center gap-1.5 pt-2">
          {note.labels.map(l => (
            <span key={l} className="inline-flex items-center gap-1 text-xs font-semibold pl-2.5 pr-1.5 py-1 rounded-full bg-black/5 dark:bg-white/10">
              #{l}
              {!readOnly && (
                <button type="button" aria-label={`Bỏ nhãn ${l}`} onClick={() => onChange({ labels: note.labels.filter(x => x !== l) }, { immediate: true })} className="p-0.5 opacity-60">
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
          {!readOnly && (labelDraft === null ? (
            <button type="button" onClick={() => setLabelDraft('')} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full opacity-60 active:opacity-100">
              <Tag size={12} /><Plus size={12} /> Nhãn
            </button>
          ) : (
            <input
              autoFocus
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitLabel(); }
                if (e.key === 'Escape') { e.stopPropagation(); setLabelDraft(null); }
              }}
              onBlur={commitLabel}
              placeholder="nhãn"
              maxLength={24}
              className="text-xs px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/10 outline-none w-28"
            />
          ))}
        </div>
      </div>
    </div>
  );
};
