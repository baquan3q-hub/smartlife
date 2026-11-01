// File: src/components/sticky/StickyWindowApp.tsx
// Cửa sổ note nổi trên Windows (Tauri) — route: #/sticky-window?id=<uuid>  hoặc  #/sticky-window?new=1
// Mỗi note là 1 cửa sổ nhỏ không viền, có thể luôn nằm trên cùng, vị trí được Tauri ghi nhớ.

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Plus, Palette, Pin, PinOff, X, Maximize2, Trash2, Loader2, CloudOff, Check } from 'lucide-react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { useStickyNotes } from '../../hooks/useStickyNotes';
import { STICKY_COLORS, StickyColor } from '../../services/stickyNoteService';
import { desktopBridge } from '../../services/desktopBridge';
import { applyTheme, getSavedTheme } from '../../utils/theme';
import { STICKY_THEME } from './stickyTheme';

const ON_TOP_KEY = 'smartlife_sticky_on_top_';

export function isStickyWindowRoute(): boolean {
  return window.location.hash.startsWith('#/sticky-window');
}

function readParams(): { id: string | null; isNew: boolean } {
  const query = window.location.hash.split('?')[1] || '';
  const params = new URLSearchParams(query);
  return { id: params.get('id'), isNew: params.get('new') === '1' };
}

const StickyWindowInner: React.FC = () => {
  const { user, loading } = useAuth();
  const { notes, isLoading, status, createNote, updateNote, deleteForever, setEditing, flush } = useStickyNotes(user?.id);
  const [noteId, setNoteId] = useState<string | null>(() => readParams().id);
  const [showColors, setShowColors] = useState(false);
  const [onTop, setOnTop] = useState(true);
  const creatingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { applyTheme(getSavedTheme()); }, []);

  // ?id=<uuid>&new=1 (từ phím tắt Ctrl+Shift+N / khay hệ thống) → tạo note với đúng id đó.
  // Rust cấp sẵn id để nhãn cửa sổ = sticky-<id> → Tauri nhớ được vị trí cửa sổ.
  useEffect(() => {
    if (!user || isLoading || creatingRef.current) return;
    const { id, isNew } = readParams();
    if (!isNew) return;
    creatingRef.current = true;
    const finish = () => {
      window.history.replaceState(null, '', `#/sticky-window?id=${id || ''}`);
      textareaRef.current?.focus();
    };
    if (id && notes.some(n => n.id === id)) { finish(); return; }
    createNote({}, { id: id || undefined }).then(n => {
      if (!n) return;
      if (!id) setNoteId(n.id);
      window.history.replaceState(null, '', `#/sticky-window?id=${n.id}`);
      textareaRef.current?.focus();
    });
  }, [user, isLoading, notes, createNote]);

  useEffect(() => {
    if (!noteId) return;
    desktopBridge.rememberOpen(noteId);
    try {
      const saved = localStorage.getItem(`${ON_TOP_KEY}${noteId}`);
      const value = saved === null ? true : saved === 'true';
      setOnTop(value);
      desktopBridge.setAlwaysOnTop(value);
    } catch { /* ignore */ }
  }, [noteId]);

  const note = notes.find(n => n.id === noteId) || null;

  useLayoutEffect(() => {
    if (note && document.activeElement !== textareaRef.current) {
      document.title = note.title || note.content.split('\n')[0]?.slice(0, 40) || 'Sticky Note';
    }
  }, [note?.title, note?.content]);

  const close = async () => {
    if (noteId) desktopBridge.forgetOpen(noteId);
    if (note && !note.title.trim() && !note.content.trim() && note.labels.length === 0) {
      await deleteForever(note.id); // note trống → không giữ lại
    } else if (note) {
      await flush(note.id); // lưu ngay phần đang gõ trước khi đóng cửa sổ
      setEditing(null);
    }
    await desktopBridge.closeCurrentWindow();
  };

  const toggleOnTop = () => {
    const next = !onTop;
    setOnTop(next);
    desktopBridge.setAlwaysOnTop(next);
    try { if (noteId) localStorage.setItem(`${ON_TOP_KEY}${noteId}`, String(next)); } catch { /* ignore */ }
  };

  if (loading || (!note && (isLoading || readParams().isNew))) {
    return <div className="h-screen flex items-center justify-center bg-[#FFF8C5] text-amber-700"><Loader2 className="animate-spin" /></div>;
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 p-6 text-center bg-[#FFF8C5] text-slate-700 text-sm" data-tauri-drag-region>
        <p>Hãy đăng nhập SmartLife ở cửa sổ chính trước.</p>
        <button onClick={() => desktopBridge.focusMainWindow()} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold">Mở SmartLife</button>
      </div>
    );
  }

  if (!note || note.deleted_at) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 p-6 text-center bg-slate-100 text-slate-600 text-sm" data-tauri-drag-region>
        <p>Ghi chú này đã bị xoá hoặc không tồn tại.</p>
        <button onClick={close} className="px-3 py-1.5 rounded-lg bg-slate-700 text-white font-semibold">Đóng</button>
      </div>
    );
  }

  const theme = STICKY_THEME[note.color] || STICKY_THEME.yellow;

  return (
    <div className={`h-screen flex flex-col overflow-hidden select-none ${theme.card}`}>
      {/* Thanh tiêu đề — kéo để di chuyển cửa sổ */}
      <div className={`flex items-center justify-between px-1.5 py-1 ${theme.bar}`} data-tauri-drag-region>
        <div className="flex items-center gap-0.5">
          <button title="Ghi chú mới" aria-label="Ghi chú mới" onClick={() => createNote({ color: note.color }).then(n => n && desktopBridge.openStickyWindow(n.id))} className="p-1.5 rounded-md hover:bg-black/10"><Plus size={14} /></button>
          <button title="Đổi màu" aria-label="Đổi màu" onClick={() => setShowColors(s => !s)} className="p-1.5 rounded-md hover:bg-black/10"><Palette size={14} /></button>
          <button title={onTop ? 'Bỏ luôn nằm trên cùng' : 'Luôn nằm trên cùng'} aria-label="Luôn nằm trên cùng" onClick={toggleOnTop} className={`p-1.5 rounded-md hover:bg-black/10 ${onTop ? 'bg-black/10' : ''}`}>
            {onTop ? <Pin size={14} /> : <PinOff size={14} />}
          </button>
        </div>
        <span className="flex-1 text-center text-[10px] font-semibold opacity-60 pointer-events-none" data-tauri-drag-region>
          {status === 'saving' ? <Loader2 size={11} className="inline animate-spin" /> : status === 'offline' ? <CloudOff size={11} className="inline" /> : status === 'saved' ? <Check size={11} className="inline" /> : null}
        </span>
        <div className="flex items-center gap-0.5">
          <button title="Mở trong SmartLife" aria-label="Mở trong SmartLife" onClick={() => desktopBridge.focusMainWindow()} className="p-1.5 rounded-md hover:bg-black/10"><Maximize2 size={13} /></button>
          <button
            title="Chuyển vào thùng rác"
            aria-label="Chuyển vào thùng rác"
            onClick={async () => {
              desktopBridge.forgetOpen(note.id);
              updateNote(note.id, { deleted_at: new Date().toISOString() });
              await flush(note.id);
              await desktopBridge.closeCurrentWindow();
            }}
            className="p-1.5 rounded-md hover:bg-black/10"
          >
            <Trash2 size={13} />
          </button>
          <button title="Đóng (note vẫn được lưu)" aria-label="Đóng" onClick={close} className="p-1.5 rounded-md hover:bg-red-500 hover:text-white"><X size={14} /></button>
        </div>
      </div>

      {showColors && (
        <div className="flex gap-1.5 px-2 py-1.5">
          {STICKY_COLORS.map((c: StickyColor) => (
            <button
              key={c}
              title={STICKY_THEME[c].name}
              aria-label={STICKY_THEME[c].name}
              onClick={() => { updateNote(note.id, { color: c }, { immediate: true }); setShowColors(false); }}
              className={`w-5 h-5 rounded-full border-2 ${STICKY_THEME[c].dot} ${note.color === c ? 'border-indigo-500' : 'border-white/70'}`}
            />
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col px-3 pt-2 pb-2 select-text">
        <input
          value={note.title}
          onChange={(e) => updateNote(note.id, { title: e.target.value })}
          onFocus={() => setEditing(note.id)}
          onBlur={() => setEditing(null)}
          placeholder="Tiêu đề"
          maxLength={120}
          className="bg-transparent font-bold text-sm outline-none placeholder:opacity-40"
        />
        <textarea
          ref={textareaRef}
          autoFocus
          value={note.content}
          onChange={(e) => updateNote(note.id, { content: e.target.value })}
          onFocus={() => setEditing(note.id)}
          onBlur={() => setEditing(null)}
          placeholder="Ghi chú..."
          className="flex-1 min-h-0 mt-1 bg-transparent resize-none outline-none text-sm leading-relaxed placeholder:opacity-50"
        />
        {note.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {note.labels.map(l => <span key={l} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10">#{l}</span>)}
          </div>
        )}
      </div>
    </div>
  );
};

const StickyWindowApp: React.FC = () => (
  <AuthProvider>
    <StickyWindowInner />
  </AuthProvider>
);

export default StickyWindowApp;
