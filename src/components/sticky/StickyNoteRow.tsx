// File: src/components/sticky/StickyNoteRow.tsx
// Một hàng trong danh sách ghi chú trên điện thoại: chỉ xem trước (tiêu đề, vài dòng, checklist),
// chạm vào để mở trang sửa toàn màn hình (StickyMobileEditor).

import React, { useMemo } from 'react';
import { Pin, Check, CheckSquare, Image as ImageIcon, Table2 } from 'lucide-react';
import { StickyNote } from '../../services/stickyNoteService';
import { notePreview } from '../../utils/stickyMarkdown';
import { STICKY_THEME, relativeTime, DEVICE_LABEL } from './stickyTheme';

const MAX_TASKS = 3;
const MAX_LABELS = 2;

interface StickyNoteRowProps {
  note: StickyNote;
  onOpen: () => void;
  selecting?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

export const StickyNoteRow: React.FC<StickyNoteRowProps> = ({ note, onOpen, selecting, selected, onToggleSelect }) => {
  const theme = STICKY_THEME[note.color] || STICKY_THEME.yellow;
  const preview = useMemo(() => notePreview(note.content), [note.content]);

  // Không có tiêu đề → dùng dòng đầu làm tiêu đề, phần còn lại làm đoạn trích
  const title = note.title.trim();
  const lines = title ? preview.lines : preview.lines.slice(1);
  const heading = title || preview.lines[0] || preview.tasks[0]?.text || '';
  const tasks = title || preview.lines.length ? preview.tasks : preview.tasks.slice(1);
  // Việc chưa xong lên trước — thứ cần theo dõi
  const shownTasks = [...tasks.filter(t => !t.done), ...tasks.filter(t => t.done)].slice(0, MAX_TASKS);
  const doneCount = preview.tasks.filter(t => t.done).length;
  const hiddenLabels = note.labels.length - MAX_LABELS;

  return (
    <article
      className={`relative flex rounded-2xl overflow-hidden shadow-sm active:scale-[0.99] transition-transform ${theme.card} ${selected ? 'ring-[3px] ring-indigo-500' : ''}`}
    >
      <span aria-hidden className={`w-1.5 shrink-0 ${theme.dot}`} />
      <button
        type="button"
        onClick={selecting ? onToggleSelect : onOpen}
        {...(selecting ? { role: 'checkbox', 'aria-checked': !!selected } : {})}
        aria-label={selecting ? `Chọn ghi chú ${heading}`.trim() : undefined}
        className="flex-1 min-w-0 text-left px-3 py-2.5"
      >
        <div className="flex items-start gap-2">
          <h3 className={`flex-1 min-w-0 font-bold text-[15px] leading-snug line-clamp-2 break-words ${heading ? '' : 'opacity-40'}`}>
            {note.is_pinned && <Pin size={12} className="inline -mt-0.5 mr-1 opacity-60" aria-label="Đã ghim" />}
            {heading || 'Ghi chú trống'}
          </h3>
          {selecting ? (
            <span className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${selected ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white/80 dark:bg-slate-800/80 border-slate-400'}`}>
              {selected && <Check size={14} strokeWidth={3} />}
            </span>
          ) : preview.tasks.length > 0 && (
            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10">
              <CheckSquare size={11} /> {doneCount}/{preview.tasks.length}
            </span>
          )}
        </div>

        {lines.length > 0 && (
          <p className="mt-1 text-[13px] leading-snug opacity-80 line-clamp-3 whitespace-pre-line break-words">
            {lines.slice(0, 3).join('\n')}
          </p>
        )}

        {shownTasks.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-[13px] leading-snug">
            {shownTasks.map((t, i) => (
              <li key={i} className={`flex items-start gap-1.5 min-w-0 ${t.done ? 'opacity-50 line-through' : 'opacity-85'}`}>
                <span aria-hidden className="shrink-0">{t.done ? '☑' : '☐'}</span>
                <span className="truncate">{t.text}</span>
              </li>
            ))}
            {tasks.length > MAX_TASKS && <li className="text-[11px] opacity-50 pl-5">+{tasks.length - MAX_TASKS} việc khác</li>}
          </ul>
        )}

        <div className={`flex items-center gap-1.5 mt-1.5 text-[11px] font-medium min-w-0 ${theme.muted}`}>
          {note.labels.slice(0, MAX_LABELS).map(l => (
            <span key={l} className="shrink min-w-0 truncate max-w-[40%] font-semibold px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-200">#{l}</span>
          ))}
          {hiddenLabels > 0 && <span className="shrink-0">+{hiddenLabels}</span>}
          {preview.hasTable && <Table2 size={12} className="shrink-0" aria-label="Có bảng" />}
          {preview.imageCount > 0 && (
            <span className="shrink-0 inline-flex items-center gap-0.5" aria-label={`${preview.imageCount} ảnh`}><ImageIcon size={12} />{preview.imageCount > 1 && preview.imageCount}</span>
          )}
          <span className="ml-auto shrink-0">
            {relativeTime(note.updated_at)}{note.last_device ? ` · ${DEVICE_LABEL[note.last_device] || note.last_device}` : ''}
          </span>
        </div>
      </button>
    </article>
  );
};
