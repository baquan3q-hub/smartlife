// File: src/components/sticky/StickyNotesDashboard.tsx
// Trang Sticky Notes (tab #/sticky) — dùng chung cho Web, Mobile (Capacitor) và cửa sổ chính Windows (Tauri).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StickyNote as StickyIcon, Plus, Search, Loader2, Cloud, CloudOff, CheckCircle2, AlertTriangle,
  Pin, Archive, Trash2, LayoutGrid, Monitor, X, CheckSquare,
} from 'lucide-react';
import type { StickyExportFormat } from '../../services/stickyExport';
import { isExportEnabled } from '../../utils/stickyFeatures';
import { useStickyNotes, StickySyncStatus } from '../../hooks/useStickyNotes';
import {
  StickyColor, StickyNote, StickyNotePatch, StickyNoteVersion, STICKY_COLORS, TRASH_RETENTION_DAYS,
  stickyNoteService, isTauri, detectDevice,
} from '../../services/stickyNoteService';
import { desktopBridge } from '../../services/desktopBridge';
import { AISuggestedTask } from '../../services/stickyNoteAIService';
import { StickyNoteCard, StickyView } from './StickyNoteCard';
import { StickyHistoryModal } from './StickyHistoryModal';
import { StickyAIPanel } from './StickyAIPanel';
import { STICKY_THEME } from './stickyTheme';
import { contentMatchesQuery } from '../../utils/stickyMarkdown';
import { preloadRichEditor } from './editor/NoteEditor';
import { EXPORT_FORMATS, ExportMessage, runStickyExport } from './stickyExportActions';

export const DESKTOP_RELEASES_URL = 'https://github.com/baquan3q-hub/smartlife/releases';

interface Props {
  userId: string;
  hasAIAccess: boolean;
  onUpgrade?: () => void;
  onAddTodo: (content: string, priority: AISuggestedTask['priority'], deadline?: string) => Promise<void> | void;
}

const VIEWS: { id: StickyView; label: string; icon: React.ElementType }[] = [
  { id: 'active', label: 'Tất cả', icon: LayoutGrid },
  { id: 'pinned', label: 'Đã ghim', icon: Pin },
  { id: 'archived', label: 'Lưu trữ', icon: Archive },
  { id: 'trash', label: 'Thùng rác', icon: Trash2 },
];

const SyncBadge: React.FC<{ status: StickySyncStatus }> = ({ status }) => {
  const map: Record<StickySyncStatus, { icon: React.ReactNode; text: string; cls: string }> = {
    idle: { icon: <Cloud size={13} />, text: 'Đã đồng bộ', cls: 'text-slate-500 bg-slate-100 dark:bg-slate-800' },
    saving: { icon: <Loader2 size={13} className="animate-spin" />, text: 'Đang lưu…', cls: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40' },
    saved: { icon: <CheckCircle2 size={13} />, text: 'Đã lưu', cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
    offline: { icon: <CloudOff size={13} />, text: 'Offline · sẽ tự đồng bộ', cls: 'text-amber-700 bg-amber-50 dark:bg-amber-950/40' },
    error: { icon: <AlertTriangle size={13} />, text: 'Lỗi đồng bộ', cls: 'text-red-600 bg-red-50 dark:bg-red-950/40' },
  };
  const s = map[status];
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>
      {s.icon} {s.text}
    </span>
  );
};

function isTypingTarget(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

const StickyNotesDashboard: React.FC<Props> = ({ userId, hasAIAccess, onUpgrade, onAddTodo }) => {
  const {
    notes, isLoading, status, needsSetup, errorMessage,
    createNote, updateNote, deleteForever, setEditing,
  } = useStickyNotes(userId);

  const [view, setView] = useState<StickyView>('active');
  const [query, setQuery] = useState('');
  const [colorFilter, setColorFilter] = useState<StickyColor | null>(null);
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [historyNoteId, setHistoryNoteId] = useState<string | null>(null);
  const [aiNoteId, setAiNoteId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  /** Note vừa tạo trong phiên này, chưa rời ô nhập lần nào — bỏ trống khi rời thì tự dọn. */
  const freshIds = useRef(new Set<string>());
  const onAddTodoRef = useRef(onAddTodo);
  onAddTodoRef.current = onAddTodo;
  const desktop = isTauri();
  const canExport = isExportEnabled();
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [exporting, setExporting] = useState<StickyExportFormat | null>(null);
  const [toast, setToast] = useState<ExportMessage | null>(null);

  const allLabels = useMemo(
    () => Array.from(new Set(notes.filter(n => !n.deleted_at).flatMap(n => n.labels))).sort((a, b) => a.localeCompare(b, 'vi')),
    [notes],
  );

  const counts = useMemo(() => ({
    active: notes.filter(n => !n.deleted_at && !n.is_archived).length,
    pinned: notes.filter(n => !n.deleted_at && !n.is_archived && n.is_pinned).length,
    archived: notes.filter(n => !n.deleted_at && n.is_archived).length,
    trash: notes.filter(n => !!n.deleted_at).length,
  }), [notes]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes
      .filter(n => {
        if (view === 'trash') return !!n.deleted_at;
        if (n.deleted_at) return false;
        if (view === 'archived') return n.is_archived;
        if (n.is_archived) return false;
        if (view === 'pinned') return n.is_pinned;
        return true;
      })
      .filter(n => !colorFilter || n.color === colorFilter)
      .filter(n => !labelFilter || n.labels.includes(labelFilter))
      .filter(n => !q || n.title.toLowerCase().includes(q) || contentMatchesQuery(n.content, q) || n.labels.some(l => l.toLowerCase().includes(q)))
      .sort((a, b) => {
        if (view === 'trash') return (b.deleted_at || '').localeCompare(a.deleted_at || '');
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return b.created_at.localeCompare(a.created_at);
      });
  }, [notes, view, query, colorFilter, labelFilter]);

  // Chỉ xuất note đang thấy (đúng thứ tự lưới) — note bị lọc ẩn đi thì không xuất
  const selectedNotes = useMemo(() => visible.filter(n => selectedIds.has(n.id)), [visible, selectedIds]);

  const exitSelecting = useCallback(() => {
    setSelecting(false);
    setSelectedIds(new Set());
  }, []);

  // Đổi tab thì bỏ chọn
  useEffect(() => {
    setSelectedIds(new Set());
    if (view === 'trash') setSelecting(false);
  }, [view]);

  // Thông báo tiến trình (busy) giữ nguyên tới khi có kết quả
  useEffect(() => {
    if (!toast || toast.busy) return;
    const t = setTimeout(() => setToast(null), toast.error ? 6000 : 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const runExport = useCallback(async (list: StickyNote[], format: StickyExportFormat) => {
    const ok = await runStickyExport(list, format, (msg) => {
      setToast(msg);
      setExporting(msg.busy ? format : null);
    });
    if (ok && list.length > 1) exitSelecting();
  }, [exitSelecting]);

  const handleCreate = useCallback(async () => {
    if (view === 'trash' || view === 'archived') setView('active');
    const note = await createNote({
      color: colorFilter || 'yellow',
      labels: labelFilter ? [labelFilter] : [],
      is_pinned: view === 'pinned',
    });
    if (note) {
      freshIds.current.add(note.id);
      setFocusId(note.id);
    }
  }, [createNote, view, colorFilter, labelFilter]);

  // Tải sẵn trình soạn thảo rich text (chunk riêng) để lần bấm vào note đầu tiên không phải chờ
  useEffect(() => { preloadRichEditor(); }, []);

  // Phím tắt: N = note mới, / = tìm kiếm
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      if (historyNoteId || aiNoteId) return;
      if (e.key === 'Escape' && selecting) { exitSelecting(); return; }
      if (selecting) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); handleCreate(); }
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleCreate, historyNoteId, aiNoteId, selecting, exitSelecting]);

  const applyWithSnapshot = useCallback(async (note: StickyNote, patch: StickyNotePatch) => {
    try {
      await stickyNoteService.snapshot(note);
    } catch { /* vẫn áp dụng; trigger DB cũng có thể đã lưu bản cũ */ }
    updateNote(note.id, patch, { immediate: true });
  }, [updateNote]);

  const handleRestoreVersion = useCallback((note: StickyNote, v: StickyNoteVersion) => {
    applyWithSnapshot(note, { title: v.title, content: v.content, color: v.color });
    setHistoryNoteId(null);
  }, [applyWithSnapshot]);

  const handleAddTasks = useCallback(async (tasks: AISuggestedTask[]) => {
    for (const t of tasks) {
      // Dùng hàm mới nhất sau mỗi lần thêm (App tính sort_order từ danh sách todo hiện tại)
      await onAddTodoRef.current(t.content, t.priority, t.deadline || undefined);
      await new Promise(r => setTimeout(r, 0));
    }
  }, []);

  const historyNote = notes.find(n => n.id === historyNoteId) || null;
  const aiNote = notes.find(n => n.id === aiNoteId) || null;
  const showDesktopPromo = !desktop && detectDevice() === 'web';

  return (
    <div className="max-w-7xl mx-auto px-2 md:px-4 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-300 to-yellow-400 text-amber-900 shadow-sm shadow-amber-200/60">
            <StickyIcon size={22} />
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 leading-tight">Sticky Notes</h1>
            <p className="text-xs text-slate-500">Ghi nhanh · đồng bộ Web, điện thoại và Windows</p>
          </div>
          <div className="ml-1"><SyncBadge status={status} /></div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); (e.target as HTMLInputElement).blur(); } }}
              placeholder="Tìm ghi chú…  ( / )"
              aria-label="Tìm ghi chú"
              className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-400/50"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Xoá tìm kiếm" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"><X size={14} /></button>
            )}
          </div>
          {canExport && view !== 'trash' && visible.length > 0 && (
            <button
              onClick={() => (selecting ? exitSelecting() : setSelecting(true))}
              aria-pressed={selecting}
              title="Chọn nhiều ghi chú để xuất file"
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${selecting ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <CheckSquare size={16} /> <span className="hidden sm:inline">{selecting ? 'Xong' : 'Chọn'}</span>
            </button>
          )}
          <button
            onClick={handleCreate}
            title="Ghi chú mới (N)"
            className="hidden md:inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm"
          >
            <Plus size={16} /> Ghi chú mới
          </button>
        </div>
      </div>

      {needsSetup && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-semibold">Cơ sở dữ liệu chưa có bảng Sticky Notes.</p>
          <p className="opacity-80">Quản trị viên cần chạy file <code className="font-mono">sql/sticky_notes_schema.sql</code> trong Supabase SQL Editor. Ghi chú hiện chỉ lưu trên thiết bị này.</p>
        </div>
      )}
      {status === 'error' && !needsSetup && errorMessage && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-xl p-3">{errorMessage}</p>
      )}

      {/* Bộ lọc */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide" role="tablist">
          {VIEWS.map(v => {
            const Icon = v.icon;
            const active = view === v.id;
            return (
              <button
                key={v.id}
                role="tab"
                aria-selected={active}
                onClick={() => setView(v.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${active ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <Icon size={14} /> {v.label}
                <span className={`text-[10px] px-1.5 rounded-full ${active ? 'bg-white/20 dark:bg-slate-900/10' : 'bg-slate-100 dark:bg-slate-800'}`}>{counts[v.id]}</span>
              </button>
            );
          })}
          <span className="mx-2 h-5 w-px bg-slate-200 dark:bg-slate-700 shrink-0" />
          {STICKY_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColorFilter(f => (f === c ? null : c))}
              title={`Lọc màu ${STICKY_THEME[c].name}`}
              aria-pressed={colorFilter === c}
              className={`shrink-0 w-5 h-5 rounded-full border-2 ${STICKY_THEME[c].dot} ${colorFilter === c ? 'border-indigo-500 scale-110' : 'border-white dark:border-slate-800'} transition-transform`}
            />
          ))}
        </div>
        {allLabels.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {allLabels.map(l => (
              <button
                key={l}
                onClick={() => setLabelFilter(f => (f === l ? null : l))}
                aria-pressed={labelFilter === l}
                className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${labelFilter === l ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
              >
                #{l}
              </button>
            ))}
          </div>
        )}
      </div>

      {view === 'trash' && counts.trash > 0 && (
        <p className="text-xs text-slate-500 mb-3">Ghi chú trong thùng rác sẽ bị xoá vĩnh viễn sau {TRASH_RETENTION_DAYS} ngày.</p>
      )}

      {/* Lưới ghi chú */}
      {isLoading && notes.length === 0 ? (
        <div className="columns-2 md:columns-3 xl:columns-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="break-inside-avoid mb-3 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" style={{ height: 110 + (i % 3) * 50 }} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20 px-4">
          <div className="w-16 h-16 rounded-3xl bg-amber-100 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center mb-4">
            <StickyIcon size={30} />
          </div>
          <p className="font-bold text-slate-700 dark:text-slate-200">
            {query || colorFilter || labelFilter ? 'Không tìm thấy ghi chú phù hợp' :
              view === 'trash' ? 'Thùng rác trống' :
              view === 'archived' ? 'Chưa có ghi chú lưu trữ' :
              view === 'pinned' ? 'Chưa ghim ghi chú nào' : 'Bắt đầu ghi chú đầu tiên'}
          </p>
          {view === 'active' && !query && !colorFilter && !labelFilter && (
            <>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">Ghi nhanh ý tưởng, việc cần làm… rồi để AI tách thành task trên bảng Kanban.</p>
              <button onClick={handleCreate} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
                <Plus size={16} /> Ghi chú mới
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="columns-2 md:columns-3 xl:columns-4 gap-3">
          {visible.map(note => (
            <StickyNoteCard
              key={note.id}
              note={note}
              view={view}
              autoFocus={focusId === note.id}
              canDetach={desktop}
              onChange={(patch, opts) => updateNote(note.id, patch, opts)}
              onFocus={() => { if (!selecting) setEditing(note.id); }}
              onBlur={() => {
                setEditing(null);
                if (focusId === note.id) setFocusId(null);
                // Note vừa tạo mà rời đi khi còn trống → tự dọn, tránh rác
                if (freshIds.current.delete(note.id)) {
                  const isBlank = !note.title.trim() && !note.content.trim() && note.labels.length === 0;
                  if (isBlank) deleteForever(note.id);
                }
              }}
              onOpenAI={() => setAiNoteId(note.id)}
              onOpenHistory={() => setHistoryNoteId(note.id)}
              onDetach={async () => {
                if (!(await desktopBridge.openStickyWindow(note.id))) {
                  alert('Không mở được cửa sổ nổi. Hãy cập nhật SmartLife cho Windows lên bản mới nhất.');
                }
              }}
              onDeleteForever={() => {
                if (window.confirm('Xoá vĩnh viễn ghi chú này? Không thể hoàn tác.')) deleteForever(note.id);
              }}
              onLabelClick={(l) => setLabelFilter(l)}
              onExport={canExport ? (format) => runExport([note], format) : undefined}
              selecting={selecting && view !== 'trash'}
              selected={selectedIds.has(note.id)}
              onToggleSelect={() => setSelectedIds(prev => {
                const next = new Set(prev);
                if (!next.delete(note.id)) next.add(note.id);
                return next;
              })}
            />
          ))}
        </div>
      )}

      {showDesktopPromo && (
        <a
          href={DESKTOP_RELEASES_URL}
          target="_blank"
          rel="noreferrer"
          className="hidden md:flex items-center gap-3 mt-8 p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
        >
          <Monitor size={20} className="text-indigo-500 shrink-0" />
          <span><b>SmartLife cho Windows</b> — ghim note nổi trên màn hình, icon taskbar, phím tắt <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs">Ctrl+Alt+N</kbd> tạo note từ bất kỳ đâu.</span>
        </a>
      )}

      {/* Thanh chọn nhiều → xuất file */}
      {selecting && view !== 'trash' && visible.length > 0 && (
        <div
          role="toolbar"
          aria-label="Xuất các ghi chú đã chọn"
          className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-6 z-40 w-[calc(100%-1.5rem)] max-w-xl flex flex-wrap items-center gap-2 p-2 pl-4 rounded-2xl bg-slate-900 text-white shadow-xl dark:bg-slate-100 dark:text-slate-900"
        >
          <span className="text-sm font-semibold mr-auto">Đã chọn {selectedNotes.length}</span>
          <button
            onClick={() => setSelectedIds(selectedNotes.length === visible.length ? new Set() : new Set(visible.map(n => n.id)))}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-white/10 dark:hover:bg-black/10"
          >
            {selectedNotes.length === visible.length ? 'Bỏ chọn hết' : 'Chọn tất cả'}
          </button>
          {EXPORT_FORMATS.map(({ format, label, icon: Icon }) => (
            <button
              key={format}
              disabled={!selectedNotes.length || !!exporting}
              onClick={() => runExport(selectedNotes, format)}
              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {exporting === format ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />} {label}
            </button>
          ))}
          <button onClick={exitSelecting} aria-label="Thoát chế độ chọn" className="p-1.5 rounded-lg hover:bg-white/10 dark:hover:bg-black/10"><X size={16} /></button>
        </div>
      )}

      {toast && (
        <div
          role={toast.error ? 'alert' : 'status'}
          className={`fixed left-1/2 -translate-x-1/2 z-50 ${selecting ? 'bottom-44 md:bottom-24' : 'bottom-24 md:bottom-6'} max-w-[calc(100%-2rem)] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg ${toast.error ? 'bg-red-600 text-white' : 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'}`}
        >
          {toast.busy && <Loader2 size={15} className="animate-spin shrink-0" />}
          {toast.text}
        </div>
      )}

      {/* Nút tạo nhanh trên mobile */}
      <button
        onClick={handleCreate}
        aria-label="Ghi chú mới"
        className={`${selecting ? 'hidden' : 'flex'} md:hidden fixed right-5 bottom-28 z-40 w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-300/50 items-center justify-center active:scale-95 transition-transform`}
      >
        <Plus size={26} />
      </button>

      {historyNote && (
        <StickyHistoryModal
          note={historyNote}
          onClose={() => setHistoryNoteId(null)}
          onRestore={(v) => handleRestoreVersion(historyNote, v)}
        />
      )}
      {aiNote && (
        <StickyAIPanel
          note={aiNote}
          existingLabels={allLabels}
          hasAIAccess={hasAIAccess}
          onUpgrade={onUpgrade}
          onClose={() => setAiNoteId(null)}
          onApplyPatch={(patch, opts) => (opts?.snapshot ? applyWithSnapshot(aiNote, patch) : updateNote(aiNote.id, patch, { immediate: true }))}
          onAddTasks={handleAddTasks}
        />
      )}
    </div>
  );
};

export default StickyNotesDashboard;
