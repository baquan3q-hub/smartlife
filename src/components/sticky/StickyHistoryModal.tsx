// File: src/components/sticky/StickyHistoryModal.tsx
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { History, Loader2, RotateCcw, X } from 'lucide-react';
import { StickyNote, StickyNoteVersion, stickyNoteService } from '../../services/stickyNoteService';
import { STICKY_THEME, DEVICE_LABEL } from './stickyTheme';
import { StickyMarkdownView } from './StickyMarkdownView';

interface Props {
  note: StickyNote;
  onClose: () => void;
  onRestore: (version: StickyNoteVersion) => void;
}

export const StickyHistoryModal: React.FC<Props> = ({ note, onClose, onRestore }) => {
  const [versions, setVersions] = useState<StickyNoteVersion[]>([]);
  const [selected, setSelected] = useState<StickyNoteVersion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    stickyNoteService.listVersions(note.user_id, note.id)
      .then(v => { if (!cancelled) { setVersions(v); setSelected(v[0] || null); } })
      .catch(e => { if (!cancelled) setError(e?.message || 'Không tải được lịch sử.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [note.id, note.user_id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-end md:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 md:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Lịch sử phiên bản"
        className="w-full md:max-w-3xl max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <History size={18} className="text-indigo-500" />
            <h2 className="font-bold text-slate-800 dark:text-slate-100">Lịch sử phiên bản</h2>
            <span className="text-xs text-slate-400">· {note.title || 'Không tiêu đề'}</span>
          </div>
          <button onClick={onClose} aria-label="Đóng" className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
        </header>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-16 text-slate-400"><Loader2 className="animate-spin" /></div>
        ) : error ? (
          <p className="p-6 text-sm text-red-500">{error}</p>
        ) : versions.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Chưa có phiên bản cũ. SmartLife tự lưu một bản mỗi khi nội dung thay đổi (tối đa 1 bản / 5 phút, giữ 50 bản gần nhất).
          </p>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col md:flex-row">
            <ul className="md:w-60 shrink-0 overflow-y-auto border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 max-h-40 md:max-h-none">
              {versions.map(v => (
                <li key={v.id}>
                  <button
                    onClick={() => setSelected(v)}
                    className={`w-full text-left px-4 py-3 text-sm border-l-4 transition-colors ${selected?.id === v.id ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
                  >
                    <div className="font-semibold text-slate-700 dark:text-slate-200">
                      {new Date(v.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-xs text-slate-400">Bản {v.version}{v.device ? ` · ${DEVICE_LABEL[v.device] || v.device}` : ''}</div>
                  </button>
                </li>
              ))}
            </ul>
            {selected && (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className={`flex-1 overflow-y-auto m-4 rounded-2xl p-4 ${STICKY_THEME[selected.color]?.card || STICKY_THEME.yellow.card}`}>
                  {selected.title && <h3 className="font-bold mb-2">{selected.title}</h3>}
                  {selected.content
                    ? <StickyMarkdownView markdown={selected.content} className="text-sm" />
                    : <em className="text-sm opacity-50">(trống)</em>}
                </div>
                <div className="flex justify-end gap-2 px-4 pb-4">
                  <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Đóng</button>
                  <button
                    onClick={() => onRestore(selected)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 inline-flex items-center gap-1.5"
                  >
                    <RotateCcw size={14} /> Khôi phục bản này
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
