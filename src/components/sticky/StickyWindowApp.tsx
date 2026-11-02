// File: src/components/sticky/StickyWindowApp.tsx
// Cửa sổ note nổi trên Windows (Tauri) — route: #/sticky-window?id=<uuid>[&new=1]
//
// Khung cửa sổ (kéo, đổi kích thước, đóng) do Windows vẽ (Rust: decorations = true) nên luôn hoạt động,
// kể cả khi trang đang tải hay mất mạng. Trang này chỉ lo nội dung note + vài nút tiện ích.
// Khi người dùng bấm X, Rust gọi window.__smartlifeSaveNow() để lưu nốt trước khi đóng.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Palette, Pin, PinOff, Maximize2, Trash2, Loader2, CloudOff, Check, AlertTriangle, ZoomIn, ZoomOut } from 'lucide-react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { useStickyNotes } from '../../hooks/useStickyNotes';
import { STICKY_COLORS, StickyColor } from '../../services/stickyNoteService';
import { desktopBridge } from '../../services/desktopBridge';
import { applyTheme, getSavedTheme } from '../../utils/theme';
import { STICKY_THEME } from './stickyTheme';

const ON_TOP_KEY = 'smartlife_sticky_on_top_';
const FONT_KEY = 'smartlife_sticky_font_';
const FONT_MIN = 11;
const FONT_MAX = 28;
const FONT_DEFAULT = 14;

declare global {
  interface Window {
    /** Rust gọi trước khi đóng cửa sổ / thoát app. */
    __smartlifeSaveNow?: () => Promise<void>;
  }
}

export function isStickyWindowRoute(): boolean {
  return window.location.hash.startsWith('#/sticky-window');
}

function readParams(): { id: string | null; isNew: boolean } {
  const query = window.location.hash.split('?')[1] || '';
  const params = new URLSearchParams(query);
  return { id: params.get('id'), isNew: params.get('new') === '1' };
}

function readNumber(key: string, fallback: number): number {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? v : fallback;
  } catch {
    return fallback;
  }
}

const Centered: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`h-screen flex flex-col items-center justify-center gap-3 p-6 text-center text-sm ${className}`}>{children}</div>
);

const StickyWindowInner: React.FC = () => {
  const { user, loading } = useAuth();
  const {
    notes, isLoading, status, createNote, updateNote, deleteForever, setEditing, saveNow,
  } = useStickyNotes(user?.id);
  const [noteId] = useState<string | null>(() => readParams().id);
  const [isNew, setIsNew] = useState(() => readParams().isNew);
  const [showColors, setShowColors] = useState(false);
  const [onTop, setOnTop] = useState(true);
  const [fontSize, setFontSize] = useState(() => (noteId ? readNumber(`${FONT_KEY}${noteId}`, FONT_DEFAULT) : FONT_DEFAULT));
  const creatingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const note = notes.find(n => n.id === noteId) || null;
  const noteRef = useRef(note);
  noteRef.current = note;

  useEffect(() => { applyTheme(getSavedTheme()); }, []);

  // ?new=1 (từ Ctrl+Alt+N / khay hệ thống): tạo note với đúng id Rust đã cấp
  useEffect(() => {
    if (!isNew || !user || isLoading || creatingRef.current || !noteId) return;
    creatingRef.current = true;
    const done = () => {
      window.history.replaceState(null, '', `#/sticky-window?id=${noteId}`);
      setIsNew(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    };
    if (notes.some(n => n.id === noteId)) { done(); return; }
    createNote({}, { id: noteId }).finally(done);
  }, [isNew, user, isLoading, notes, noteId, createNote]);

  // Luôn nằm trên cùng (mặc định bật) — nhớ theo từng note
  useEffect(() => {
    if (!noteId) return;
    try {
      const saved = localStorage.getItem(`${ON_TOP_KEY}${noteId}`);
      const value = saved === null ? true : saved === 'true';
      setOnTop(value);
      desktopBridge.setAlwaysOnTop(value);
    } catch { /* ignore */ }
  }, [noteId]);

  // Tiêu đề cửa sổ = tiêu đề / dòng đầu của note
  const windowTitle = note ? (note.title.trim() || note.content.split('\n')[0]?.trim().slice(0, 40) || 'Ghi chú') : 'Ghi chú';
  useEffect(() => {
    document.title = windowTitle;
    desktopBridge.setTitle(windowTitle);
  }, [windowTitle]);

  // Rust gọi hàm này khi người dùng đóng cửa sổ (nút X của Windows) hoặc thoát app
  const handleBeforeClose = useCallback(async () => {
    const current = noteRef.current;
    if (current && !current.title.trim() && !current.content.trim() && current.labels.length === 0 && !current.deleted_at) {
      await deleteForever(current.id); // note trống → không giữ lại
      return;
    }
    await saveNow();
  }, [deleteForever, saveNow]);

  useEffect(() => {
    window.__smartlifeSaveNow = handleBeforeClose;
    return () => { if (window.__smartlifeSaveNow === handleBeforeClose) delete window.__smartlifeSaveNow; };
  }, [handleBeforeClose]);

  // Phóng to / thu nhỏ chữ: Ctrl + cuộn chuột, Ctrl + (+ / - / 0)
  const changeFont = useCallback((delta: number | 'reset') => {
    setFontSize(prev => {
      const next = delta === 'reset' ? FONT_DEFAULT : Math.min(FONT_MAX, Math.max(FONT_MIN, prev + delta));
      try { if (noteId) localStorage.setItem(`${FONT_KEY}${noteId}`, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, [noteId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === '=' || e.key === '+') { e.preventDefault(); changeFont(1); }
      else if (e.key === '-') { e.preventDefault(); changeFont(-1); }
      else if (e.key === '0') { e.preventDefault(); changeFont('reset'); }
      else if (e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(); }
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      changeFont(e.deltaY < 0 ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onWheel);
    };
  }, [changeFont, saveNow]);

  const toggleOnTop = () => {
    const next = !onTop;
    setOnTop(next);
    desktopBridge.setAlwaysOnTop(next);
    try { if (noteId) localStorage.setItem(`${ON_TOP_KEY}${noteId}`, String(next)); } catch { /* ignore */ }
  };

  const newNote = async () => {
    const ok = await desktopBridge.newStickyWindow();
    if (!ok) alert('Không mở được cửa sổ mới. Hãy dùng phím tắt Ctrl+Alt+N.');
  };

  const moveToTrash = async () => {
    if (!note) return;
    updateNote(note.id, { deleted_at: new Date().toISOString() });
    await saveNow();
    const closed = await desktopBridge.closeCurrentWindow();
    if (!closed) alert('Đã chuyển vào thùng rác. Bấm X ở góc trên để đóng cửa sổ.');
  };

  // ── Các trạng thái đặc biệt (khung Windows vẫn cho kéo / đóng bình thường) ──
  if (loading) {
    return <Centered className="bg-[#FFF8C5] text-amber-700"><Loader2 className="animate-spin" /></Centered>;
  }

  if (!user) {
    return (
      <Centered className="bg-[#FFF8C5] text-slate-700">
        <p>Hãy đăng nhập SmartLife ở cửa sổ chính trước, rồi mở lại ghi chú.</p>
        <button onClick={() => desktopBridge.focusMainWindow()} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold">Mở SmartLife</button>
      </Centered>
    );
  }

  if (!note) {
    if (isNew || isLoading) {
      return <Centered className="bg-[#FFF8C5] text-amber-700"><Loader2 className="animate-spin" /></Centered>;
    }
    return (
      <Centered className="bg-slate-100 text-slate-600">
        <AlertTriangle size={20} />
        <p>Ghi chú này đã bị xoá vĩnh viễn hoặc không tồn tại. Bấm X ở góc trên để đóng.</p>
      </Centered>
    );
  }

  const theme = STICKY_THEME[note.color] || STICKY_THEME.yellow;

  if (note.deleted_at) {
    return (
      <Centered className={theme.card}>
        <p>Ghi chú đang ở thùng rác.</p>
        <button onClick={() => updateNote(note.id, { deleted_at: null }, { immediate: true })} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold">Khôi phục</button>
      </Centered>
    );
  }

  const statusIcon = status === 'saving' ? <Loader2 size={12} className="animate-spin" />
    : status === 'offline' ? <CloudOff size={12} />
    : status === 'error' ? <AlertTriangle size={12} />
    : status === 'saved' || status === 'idle' ? <Check size={12} /> : null;
  const statusText = status === 'saving' ? 'Đang lưu…'
    : status === 'offline' ? 'Offline · đã lưu trên máy, sẽ tự đồng bộ'
    : status === 'error' ? 'Lỗi đồng bộ · đã lưu trên máy'
    : 'Đã lưu';

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${theme.card}`}>
      {/* Thanh công cụ */}
      <div className={`flex items-center justify-between px-1.5 py-1 select-none ${theme.bar}`}>
        <div className="flex items-center gap-0.5">
          <button title="Ghi chú mới (Ctrl+Alt+N)" aria-label="Ghi chú mới" onClick={newNote} className="p-1.5 rounded-md hover:bg-black/10"><Plus size={15} /></button>
          <button title="Đổi màu" aria-label="Đổi màu" onClick={() => setShowColors(s => !s)} className={`p-1.5 rounded-md hover:bg-black/10 ${showColors ? 'bg-black/10' : ''}`}><Palette size={15} /></button>
          <button title={onTop ? 'Đang luôn nằm trên cùng — bấm để tắt' : 'Luôn nằm trên cùng'} aria-label="Luôn nằm trên cùng" aria-pressed={onTop} onClick={toggleOnTop} className={`p-1.5 rounded-md hover:bg-black/10 ${onTop ? 'bg-black/10' : ''}`}>
            {onTop ? <Pin size={15} /> : <PinOff size={15} />}
          </button>
          <button title="Thu nhỏ chữ (Ctrl -)" aria-label="Thu nhỏ chữ" onClick={() => changeFont(-1)} className="p-1.5 rounded-md hover:bg-black/10"><ZoomOut size={15} /></button>
          <button title="Phóng to chữ (Ctrl +)" aria-label="Phóng to chữ" onClick={() => changeFont(1)} className="p-1.5 rounded-md hover:bg-black/10"><ZoomIn size={15} /></button>
        </div>
        <div className="flex items-center gap-0.5">
          <span title={statusText} aria-label={statusText} role="status" className="p-1.5 opacity-60">{statusIcon}</span>
          <button title="Mở trong SmartLife" aria-label="Mở trong SmartLife" onClick={() => desktopBridge.focusMainWindow()} className="p-1.5 rounded-md hover:bg-black/10"><Maximize2 size={14} /></button>
          <button title="Chuyển vào thùng rác" aria-label="Chuyển vào thùng rác" onClick={moveToTrash} className="p-1.5 rounded-md hover:bg-black/10"><Trash2 size={14} /></button>
        </div>
      </div>

      {showColors && (
        <div className="flex gap-1.5 px-2 py-1.5" role="radiogroup" aria-label="Màu ghi chú">
          {STICKY_COLORS.map((c: StickyColor) => (
            <button
              key={c}
              role="radio"
              aria-checked={note.color === c}
              title={STICKY_THEME[c].name}
              aria-label={STICKY_THEME[c].name}
              onClick={() => { updateNote(note.id, { color: c }, { immediate: true }); setShowColors(false); }}
              className={`w-5 h-5 rounded-full border-2 ${STICKY_THEME[c].dot} ${note.color === c ? 'border-indigo-500' : 'border-white/70'}`}
            />
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col px-3 pt-2 pb-2" style={{ fontSize }}>
        <input
          value={note.title}
          onChange={(e) => updateNote(note.id, { title: e.target.value })}
          onFocus={() => setEditing(note.id)}
          onBlur={() => setEditing(null)}
          placeholder="Tiêu đề"
          maxLength={120}
          className="bg-transparent font-bold outline-none placeholder:opacity-40"
          style={{ fontSize: '1em' }}
        />
        <textarea
          ref={textareaRef}
          autoFocus
          value={note.content}
          onChange={(e) => updateNote(note.id, { content: e.target.value })}
          onFocus={() => setEditing(note.id)}
          onBlur={() => setEditing(null)}
          placeholder="Ghi chú..."
          className="flex-1 min-h-0 mt-1 bg-transparent resize-none outline-none leading-relaxed placeholder:opacity-50"
          style={{ fontSize: '1em' }}
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
