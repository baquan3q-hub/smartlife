// File: src/components/sticky/StickyNoteCard.tsx
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Pin, PinOff, Palette, Sparkles, History, ExternalLink, Archive, ArchiveRestore,
  Trash2, RotateCcw, X, Tag, Plus,
} from 'lucide-react';
import { StickyColor, StickyNote, StickyNotePatch, STICKY_COLORS } from '../../services/stickyNoteService';
import { STICKY_THEME, relativeTime, DEVICE_LABEL } from './stickyTheme';

export type StickyView = 'active' | 'pinned' | 'archived' | 'trash';

interface StickyNoteCardProps {
  note: StickyNote;
  view: StickyView;
  autoFocus?: boolean;
  canDetach?: boolean;
  onChange: (patch: StickyNotePatch, opts?: { immediate?: boolean }) => void;
  onFocus: () => void;
  onBlur: () => void;
  onOpenAI: () => void;
  onOpenHistory: () => void;
  onDetach?: () => void;
  onDeleteForever: () => void;
  onLabelClick?: (label: string) => void;
}

const IconBtn: React.FC<{ title: string; onClick: () => void; children: React.ReactNode; active?: boolean }> = ({ title, onClick, children, active }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`p-1.5 rounded-lg transition-colors hover:bg-black/10 dark:hover:bg-white/10 ${active ? 'bg-black/10 dark:bg-white/15' : ''}`}
  >
    {children}
  </button>
);

export const StickyNoteCard: React.FC<StickyNoteCardProps> = ({
  note, view, autoFocus, canDetach, onChange, onFocus, onBlur, onOpenAI, onOpenHistory, onDetach, onDeleteForever, onLabelClick,
}) => {
  const theme = STICKY_THEME[note.color] || STICKY_THEME.yellow;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showColors, setShowColors] = useState(false);
  const [labelDraft, setLabelDraft] = useState<string | null>(null);
  const readOnly = view === 'trash';

  // Tự giãn chiều cao theo nội dung
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 480)}px`;
  }, [note.content]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  const setColor = (color: StickyColor) => {
    onChange({ color }, { immediate: true });
    setShowColors(false);
  };

  const commitLabel = () => {
    const value = (labelDraft || '').trim().replace(/^#/, '');
    if (value && !note.labels.includes(value)) {
      onChange({ labels: [...note.labels, value].slice(0, 6) }, { immediate: true });
    }
    setLabelDraft(null);
  };

  return (
    <article
      className={`group relative break-inside-avoid mb-3 rounded-2xl shadow-sm hover:shadow-md focus-within:shadow-lg focus-within:ring-2 focus-within:ring-indigo-400/60 transition-shadow overflow-hidden ${theme.card}`}
      onFocus={onFocus}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setShowColors(false);
          onBlur();
        }
      }}
    >
      <div className={`h-1.5 ${theme.bar}`} />

      {/* Thanh công cụ — hiện khi hover / focus (luôn hiện trên màn hình cảm ứng) */}
      <div className="flex items-center justify-between gap-1 px-2 pt-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
        <div className="flex items-center">
          {view === 'trash' ? (
            <>
              <IconBtn title="Khôi phục" onClick={() => onChange({ deleted_at: null }, { immediate: true })}><RotateCcw size={15} /></IconBtn>
              <IconBtn title="Xoá vĩnh viễn" onClick={onDeleteForever}><X size={15} /></IconBtn>
            </>
          ) : (
            <>
              <IconBtn title={note.is_pinned ? 'Bỏ ghim' : 'Ghim lên đầu'} active={note.is_pinned} onClick={() => onChange({ is_pinned: !note.is_pinned }, { immediate: true })}>
                {note.is_pinned ? <PinOff size={15} /> : <Pin size={15} />}
              </IconBtn>
              <IconBtn title="Đổi màu" active={showColors} onClick={() => setShowColors(s => !s)}><Palette size={15} /></IconBtn>
              <IconBtn title="AI hỗ trợ" onClick={onOpenAI}><Sparkles size={15} /></IconBtn>
              <IconBtn title="Lịch sử phiên bản" onClick={onOpenHistory}><History size={15} /></IconBtn>
              {canDetach && onDetach && (
                <IconBtn title="Mở thành cửa sổ nổi trên desktop" onClick={onDetach}><ExternalLink size={15} /></IconBtn>
              )}
            </>
          )}
        </div>
        {view !== 'trash' && (
          <div className="flex items-center">
            <IconBtn title={note.is_archived ? 'Bỏ lưu trữ' : 'Lưu trữ'} onClick={() => onChange({ is_archived: !note.is_archived }, { immediate: true })}>
              {note.is_archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
            </IconBtn>
            <IconBtn title="Chuyển vào thùng rác" onClick={() => onChange({ deleted_at: new Date().toISOString() }, { immediate: true })}><Trash2 size={15} /></IconBtn>
          </div>
        )}
      </div>

      {showColors && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-1" role="radiogroup" aria-label="Màu ghi chú">
          {STICKY_COLORS.map(c => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={note.color === c}
              title={STICKY_THEME[c].name}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full border-2 ${STICKY_THEME[c].dot} ${note.color === c ? 'border-indigo-500 scale-110' : 'border-white/70 dark:border-slate-700'} transition-transform`}
            />
          ))}
        </div>
      )}

      <div className="px-3 pb-2 pt-1">
        <input
          value={note.title}
          readOnly={readOnly}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Tiêu đề"
          maxLength={120}
          className="w-full bg-transparent font-bold text-[15px] outline-none placeholder:font-semibold placeholder:opacity-40"
        />
        <textarea
          ref={textareaRef}
          value={note.content}
          readOnly={readOnly}
          onChange={(e) => onChange({ content: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur(); }}
          placeholder="Ghi chú..."
          rows={3}
          className="w-full bg-transparent resize-none outline-none text-sm leading-relaxed mt-1 placeholder:opacity-50"
        />

        {/* Nhãn */}
        <div className="flex flex-wrap items-center gap-1 mt-1">
          {note.labels.map(l => (
            <span key={l} className="inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10">
              <button type="button" onClick={() => onLabelClick?.(l)} className="hover:underline">#{l}</button>
              {!readOnly && (
                <button type="button" aria-label={`Bỏ nhãn ${l}`} onClick={() => onChange({ labels: note.labels.filter(x => x !== l) }, { immediate: true })} className="opacity-50 hover:opacity-100">
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
          {!readOnly && (labelDraft === null ? (
            <button
              type="button"
              onClick={() => setLabelDraft('')}
              title="Thêm nhãn"
              aria-label="Thêm nhãn"
              className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-full opacity-60 md:opacity-0 md:group-hover:opacity-60 md:group-focus-within:opacity-60 hover:!opacity-100"
            >
              <Tag size={10} /><Plus size={10} />
            </button>
          ) : (
            <input
              autoFocus
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitLabel(); }
                if (e.key === 'Escape') setLabelDraft(null);
              }}
              onBlur={commitLabel}
              placeholder="nhãn"
              maxLength={24}
              className="text-[11px] px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 outline-none w-20"
            />
          ))}
        </div>

        <div className={`flex items-center justify-between mt-2 text-[10px] font-medium ${theme.muted}`}>
          <span>{relativeTime(note.updated_at)}{note.last_device ? ` · ${DEVICE_LABEL[note.last_device] || note.last_device}` : ''}</span>
          {note.is_pinned && <Pin size={11} className="opacity-70" />}
        </div>
      </div>
    </article>
  );
};
