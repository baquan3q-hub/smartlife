// File: src/components/sticky/StickyWindowApp.tsx
// Cửa sổ note nổi trên Windows (Tauri) — route: #/sticky-window?id=<uuid>[&new=1]
//
// Khung cửa sổ (kéo, đổi kích thước, thu nhỏ, đóng) do Windows vẽ nên luôn hoạt động.
// Trang này lo nội dung note + thanh công cụ: note mới, màu, ghim, danh sách note, lịch sử phiên bản, menu ⋯.
// Lệnh tới app (mở note, ghim, đặt tiêu đề...) đi qua desktopBridge. Khi đóng, Rust gọi window.__smartlifeSaveNow().

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Palette, Pin, PinOff, Trash2, Loader2, CloudOff, Check, AlertTriangle, ZoomIn, ZoomOut,
  List, History, MoreHorizontal, LayoutGrid, Search, X, Type,
} from 'lucide-react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { useStickyNotes } from '../../hooks/useStickyNotes';
import { STICKY_COLORS, StickyColor, StickyNote, StickyNoteVersion, stickyNoteService } from '../../services/stickyNoteService';
import { desktopBridge } from '../../services/desktopBridge';
import { applyTheme, getSavedTheme } from '../../utils/theme';
import { STICKY_THEME, relativeTime } from './stickyTheme';
import { StickyHistoryModal } from './StickyHistoryModal';
import { NoteEditor } from './editor/NoteEditor';
import { contentMatchesQuery, firstLines } from '../../utils/stickyMarkdown';

const ON_TOP_KEY = 'smartlife_sticky_on_top_';
const FONT_KEY = 'smartlife_sticky_font_';
const FORMAT_BAR_KEY = 'smartlife_sticky_format_bar';
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

function noteHeading(n: Pick<StickyNote, 'title' | 'content'>): string {
  return n.title.trim() || firstLines(n.content, 1)[0] || 'Ghi chú trống';
}

const Centered: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`h-screen flex flex-col items-center justify-center gap-3 p-6 text-center text-sm ${className}`}>{children}</div>
);

const ToolBtn: React.FC<{
  title: string; onClick: () => void; active?: boolean; children: React.ReactNode;
}> = ({ title, onClick, active, children }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    aria-pressed={active}
    onClick={onClick}
    className={`p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${active ? 'bg-black/10 dark:bg-white/15' : ''}`}
  >
    {children}
  </button>
);

// ── Danh sách ghi chú (xem & mở note khác ngay trong cửa sổ nổi) ──
const NotesListPanel: React.FC<{
  notes: StickyNote[];
  currentId: string;
  onOpen: (id: string) => void;
  onNew: () => void;
  onOpenBoard: () => void;
  onClose: () => void;
}> = ({ notes, currentId, onOpen, onNew, onOpenBoard, onClose }) => {
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes
      .filter(n => !n.deleted_at && !n.is_archived)
      .filter(n => !q || n.title.toLowerCase().includes(q) || contentMatchesQuery(n.content, q) || n.labels.some(l => l.toLowerCase().includes(q)))
      .sort((a, b) => (a.is_pinned !== b.is_pinned ? (a.is_pinned ? -1 : 1) : b.updated_at.localeCompare(a.updated_at)));
  }, [notes, query]);

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      <div className="flex items-center gap-1.5 px-2 py-2 border-b border-slate-100 dark:border-slate-800">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            placeholder="Tìm ghi chú…"
            className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs outline-none"
          />
        </div>
        <ToolBtn title="Ghi chú mới" onClick={onNew}><Plus size={15} /></ToolBtn>
        <ToolBtn title="Đóng danh sách" onClick={onClose}><X size={15} /></ToolBtn>
      </div>
      <ul className="flex-1 overflow-y-auto sticky-scroll p-1.5 space-y-1">
        {list.length === 0 && <li className="text-center text-xs text-slate-400 py-6">Không có ghi chú phù hợp</li>}
        {list.map(n => {
          const lines = firstLines(n.content, 2);
          const preview = n.title.trim() ? lines[0] : lines[1];
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onOpen(n.id)}
                className={`w-full text-left flex gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 ${n.id === currentId ? 'ring-1 ring-indigo-400' : ''}`}
              >
                <span className={`w-1.5 shrink-0 rounded-full ${STICKY_THEME[n.color]?.dot || STICKY_THEME.yellow.dot}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-xs font-semibold truncate">
                    {n.is_pinned && <Pin size={10} className="shrink-0 opacity-60" />}
                    <span className="truncate">{noteHeading(n)}</span>
                  </span>
                  {preview && <span className="block text-[11px] text-slate-500 truncate">{preview}</span>}
                  <span className="block text-[10px] text-slate-400">{relativeTime(n.updated_at)}{n.id === currentId ? ' · đang mở' : ''}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onOpenBoard}
        className="flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-300 py-2 border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        <LayoutGrid size={13} /> Mở bảng Sticky Notes đầy đủ
      </button>
    </div>
  );
};

const StickyWindowInner: React.FC = () => {
  const { user, loading } = useAuth();
  const {
    notes, isLoading, status, createNote, updateNote, deleteForever, setEditing, saveNow,
  } = useStickyNotes(user?.id);
  const [noteId] = useState<string | null>(() => readParams().id);
  const [isNew, setIsNew] = useState(() => readParams().isNew);
  const [panel, setPanel] = useState<'none' | 'colors' | 'list' | 'history' | 'more'>('none');
  const [onTop, setOnTop] = useState(false);
  const [fontSize, setFontSize] = useState(() => (noteId ? readNumber(`${FONT_KEY}${noteId}`, FONT_DEFAULT) : FONT_DEFAULT));
  const [toast, setToast] = useState<string | null>(null);
  const creatingRef = useRef(false);
  const focusEditorRef = useRef<(() => void) | null>(null);
  const [showFormat, setShowFormat] = useState(() => {
    try { return localStorage.getItem(FORMAT_BAR_KEY) === '1'; } catch { return false; }
  });
  const toggleFormat = () => setShowFormat(prev => {
    try { localStorage.setItem(FORMAT_BAR_KEY, prev ? '0' : '1'); } catch { /* ignore */ }
    return !prev;
  });

  const note = notes.find(n => n.id === noteId) || null;
  const noteRef = useRef(note);
  noteRef.current = note;

  useEffect(() => { applyTheme(getSavedTheme()); }, []);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(t => (t === text ? null : t)), 2500);
  }, []);

  // ?new=1 (từ Ctrl+Alt+N / khay hệ thống / nút +): tạo note với đúng id app đã cấp
  useEffect(() => {
    if (!isNew || !user || isLoading || creatingRef.current || !noteId) return;
    creatingRef.current = true;
    const done = () => {
      window.history.replaceState(null, '', `#/sticky-window?id=${noteId}`);
      setIsNew(false);
      requestAnimationFrame(() => focusEditorRef.current?.());
    };
    if (notes.some(n => n.id === noteId)) { done(); return; }
    createNote({}, { id: noteId }).finally(done);
  }, [isNew, user, isLoading, notes, noteId, createNote]);

  // Ghim (luôn nằm trên cùng): mặc định tắt, nhớ theo từng note
  useEffect(() => {
    if (!noteId) return;
    try {
      const value = localStorage.getItem(`${ON_TOP_KEY}${noteId}`) === 'true';
      setOnTop(value);
      if (value) desktopBridge.setAlwaysOnTop(true);
    } catch { /* ignore */ }
  }, [noteId]);

  // Tiêu đề trang (không gửi nội dung note sang app — tránh lộ nội dung qua URL lệnh)
  const windowTitle = note ? noteHeading(note).slice(0, 60) : 'Ghi chú';
  useEffect(() => { document.title = windowTitle; }, [windowTitle]);

  // App Windows cũ / kênh lệnh không hoạt động → các nút cần app (+, ghim, mở note) sẽ không chạy
  const [bridgeBroken] = useState(() => desktopBridge.isDesktop() && desktopBridge.isBridgeBroken());

  // Rust gọi hàm này khi người dùng đóng cửa sổ (nút X) hoặc thoát app
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

  // Cỡ chữ: Ctrl + cuộn chuột, Ctrl + (+ / - / 0)
  const changeFont = useCallback((delta: number | 'reset') => {
    setFontSize(prev => {
      const next = delta === 'reset' ? FONT_DEFAULT : Math.min(FONT_MAX, Math.max(FONT_MIN, prev + delta));
      try { if (noteId) localStorage.setItem(`${FONT_KEY}${noteId}`, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, [noteId]);

  const newNote = useCallback(async () => {
    const ok = await desktopBridge.newStickyWindow();
    if (!ok) showToast('Không mở được. Hãy dùng phím tắt Ctrl+Alt+N.');
  }, [showToast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanel(p => (p === 'history' ? p : 'none'));
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === '=' || e.key === '+') { e.preventDefault(); changeFont(1); }
      else if (e.key === '-') { e.preventDefault(); changeFont(-1); }
      else if (e.key === '0') { e.preventDefault(); changeFont('reset'); }
      else if (e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(); }
      else if (e.key.toLowerCase() === 'n') { e.preventDefault(); newNote(); }
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
  }, [changeFont, saveNow, newNote]);

  const toggleOnTop = async () => {
    const next = !onTop;
    setOnTop(next);
    try { if (noteId) localStorage.setItem(`${ON_TOP_KEY}${noteId}`, String(next)); } catch { /* ignore */ }
    const ok = await desktopBridge.setAlwaysOnTop(next);
    if (!ok) {
      setOnTop(!next);
      showToast('Chưa ghim được. Hãy cập nhật SmartLife cho Windows bản mới nhất.');
    } else {
      showToast(next ? 'Đã ghim: luôn nằm trên cùng' : 'Đã bỏ ghim');
    }
  };

  const openNote = async (id: string) => {
    setPanel('none');
    if (id === noteId) return;
    const ok = await desktopBridge.openStickyWindow(id);
    if (!ok) showToast('Không mở được ghi chú này.');
  };

  const moveToTrash = async () => {
    if (!note) return;
    updateNote(note.id, { deleted_at: new Date().toISOString() });
    await saveNow();
    const closed = await desktopBridge.closeCurrentWindow();
    if (!closed) showToast('Đã chuyển vào thùng rác. Bấm X để đóng cửa sổ.');
  };

  const restoreVersion = async (v: StickyNoteVersion) => {
    if (!note) return;
    try { await stickyNoteService.snapshot(note); } catch { /* vẫn khôi phục */ }
    updateNote(note.id, { title: v.title, content: v.content, color: v.color }, { immediate: true });
    setPanel('none');
    showToast('Đã khôi phục phiên bản cũ');
  };

  const togglePanel = (p: typeof panel) => setPanel(cur => (cur === p ? 'none' : p));

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

  const statusIcon = status === 'saving' ? <Loader2 size={13} className="animate-spin" />
    : status === 'offline' ? <CloudOff size={13} />
    : status === 'error' ? <AlertTriangle size={13} />
    : <Check size={13} />;
  const statusText = status === 'saving' ? 'Đang lưu…'
    : status === 'offline' ? 'Offline · đã lưu trên máy, sẽ tự đồng bộ'
    : status === 'error' ? 'Lỗi đồng bộ · đã lưu trên máy'
    : 'Đã lưu & đồng bộ';

  return (
    <div className={`relative h-screen flex flex-col overflow-hidden ${theme.card}`}>
      {/* Thanh công cụ */}
      <div className={`relative z-30 flex items-center justify-between px-1.5 py-1 select-none ${theme.bar}`}>
        <div className="flex items-center gap-0.5">
          <ToolBtn title="Ghi chú mới (Ctrl+N)" onClick={newNote}><Plus size={16} /></ToolBtn>
          <ToolBtn title="Đổi màu" active={panel === 'colors'} onClick={() => togglePanel('colors')}><Palette size={15} /></ToolBtn>
          <ToolBtn title={onTop ? 'Đang ghim (luôn nằm trên cùng) — bấm để bỏ ghim' : 'Ghim: luôn nằm trên cùng'} active={onTop} onClick={toggleOnTop}>
            {onTop ? <Pin size={15} /> : <PinOff size={15} />}
          </ToolBtn>
          <ToolBtn title="Danh sách ghi chú" active={panel === 'list'} onClick={() => togglePanel('list')}><List size={16} /></ToolBtn>
          <ToolBtn title="Lịch sử phiên bản" active={panel === 'history'} onClick={() => togglePanel('history')}><History size={15} /></ToolBtn>
          <ToolBtn title={showFormat ? 'Ẩn thanh định dạng' : 'Định dạng: đậm, nghiêng, link, bảng…'} active={showFormat} onClick={toggleFormat}>
            <span className="block w-[15px] text-center text-[12px] font-bold leading-[15px]">Aa</span>
          </ToolBtn>
        </div>
        <div className="flex items-center gap-0.5">
          <span title={statusText} aria-label={statusText} role="status" className="p-1.5 opacity-60">{statusIcon}</span>
          <ToolBtn title="Thêm" active={panel === 'more'} onClick={() => togglePanel('more')}><MoreHorizontal size={16} /></ToolBtn>
        </div>

        {panel === 'more' && (
          <div className="absolute right-1.5 top-full mt-1 w-52 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 py-1 text-xs z-40">
            <div className="flex items-center justify-between px-3 py-1.5">
              <span className="flex items-center gap-1.5"><Type size={13} /> Cỡ chữ {fontSize}px</span>
              <span className="flex items-center gap-0.5">
                <button title="Thu nhỏ chữ (Ctrl -)" aria-label="Thu nhỏ chữ" onClick={() => changeFont(-1)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><ZoomOut size={14} /></button>
                <button title="Phóng to chữ (Ctrl +)" aria-label="Phóng to chữ" onClick={() => changeFont(1)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><ZoomIn size={14} /></button>
              </span>
            </div>
            <button onClick={() => { changeFont('reset'); setPanel('none'); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">Cỡ chữ mặc định (Ctrl 0)</button>
            <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
            <button onClick={() => { setPanel('none'); desktopBridge.focusMainWindow('sticky'); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5"><LayoutGrid size={13} /> Mở bảng Sticky Notes</button>
            <button onClick={() => { setPanel('none'); moveToTrash(); }} className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 flex items-center gap-1.5"><Trash2 size={13} /> Chuyển vào thùng rác</button>
          </div>
        )}
      </div>

      {panel === 'colors' && (
        <div className="flex gap-1.5 px-2 py-1.5" role="radiogroup" aria-label="Màu ghi chú">
          {STICKY_COLORS.map((c: StickyColor) => (
            <button
              key={c}
              role="radio"
              aria-checked={note.color === c}
              title={STICKY_THEME[c].name}
              aria-label={STICKY_THEME[c].name}
              onClick={() => { updateNote(note.id, { color: c }, { immediate: true }); setPanel('none'); }}
              className={`w-5 h-5 rounded-full border-2 ${STICKY_THEME[c].dot} ${note.color === c ? 'border-indigo-500' : 'border-white/70'}`}
            />
          ))}
        </div>
      )}

      {bridgeBroken && (
        <a
          href="https://github.com/baquan3q-hub/smartlife/releases/latest"
          target="_blank"
          rel="noreferrer"
          className="block text-[11px] leading-snug px-3 py-1.5 bg-amber-100 text-amber-900 border-b border-amber-200"
        >
          Bản SmartLife cho Windows này đã cũ: nút +, ghim, mở note có thể không chạy. Bấm để tải bản mới.
        </a>
      )}

      <div className="relative flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 flex flex-col px-3 pt-2 pb-2" style={{ fontSize }} onClick={() => panel === 'more' && setPanel('none')}>
          <input
            value={note.title}
            onChange={(e) => updateNote(note.id, { title: e.target.value })}
            onFocus={() => setEditing(note.id)}
            onBlur={() => setEditing(null)}
            placeholder="Tiêu đề"
            maxLength={120}
            spellCheck={false}
            className="bg-transparent font-bold outline-none placeholder:opacity-40"
            style={{ fontSize: '1em' }}
          />
          <NoteEditor
            variant="window"
            autoFocus
            value={note.content}
            onChange={(content) => updateNote(note.id, { content })}
            onLegacyRewrite={() => { stickyNoteService.snapshot(note).catch(() => {}); }}
            onFocus={() => setEditing(note.id)}
            onBlur={() => setEditing(null)}
            showToolbar={showFormat}
            focusRef={focusEditorRef}
          />
          {note.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {note.labels.map(l => <span key={l} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10">#{l}</span>)}
            </div>
          )}
        </div>

        {panel === 'list' && (
          <NotesListPanel
            notes={notes}
            currentId={note.id}
            onOpen={openNote}
            onNew={() => { setPanel('none'); newNote(); }}
            onOpenBoard={() => { setPanel('none'); desktopBridge.focusMainWindow('sticky'); }}
            onClose={() => setPanel('none')}
          />
        )}
      </div>

      {panel === 'history' && (
        <StickyHistoryModal note={note} onClose={() => setPanel('none')} onRestore={restoreVersion} />
      )}

      {toast && (
        <div role="status" className="absolute left-2 right-2 bottom-2 z-50 rounded-lg bg-slate-900/90 text-white text-xs px-3 py-2 text-center shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
};

const StickyWindowApp: React.FC = () => (
  <AuthProvider>
    <StickyWindowInner />
  </AuthProvider>
);

export default StickyWindowApp;
