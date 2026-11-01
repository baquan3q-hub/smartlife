// File: src/hooks/useStickyNotes.ts
// Quản lý state Sticky Notes: cache-first, tự lưu (debounce), Supabase Realtime, offline outbox.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import {
  StickyNote, StickyNotePatch, stickyNoteService, newStickyNote,
  isNetworkError, isMissingTableError,
} from '../services/stickyNoteService';

export type StickySyncStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

const SAVE_DEBOUNCE_MS = 700;
const OUTBOX_RETRY_MS = 30_000;

export function useStickyNotes(userId: string | undefined) {
  const [notes, setNotes] = useState<StickyNote[]>(() => (userId ? stickyNoteService.readCache(userId) : []));
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<StickySyncStatus>('idle');
  const [needsSetup, setNeedsSetup] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const notesRef = useRef(notes);
  notesRef.current = notes;
  const pendingPatches = useRef(new Map<string, StickyNotePatch>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const inflight = useRef(new Set<string>());
  const editingIdRef = useRef<string | null>(null);
  /** Bản cập nhật từ thiết bị khác đến khi đang gõ — áp dụng khi rời ô nhập. */
  const deferredRemote = useRef(new Map<string, StickyNote>());

  // ── Cache ─────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const t = setTimeout(() => stickyNoteService.writeCache(userId, notes), 300);
    return () => clearTimeout(t);
  }, [userId, notes]);

  const handleError = useCallback((err: unknown) => {
    if (isNetworkError(err)) {
      setStatus('offline');
    } else if (isMissingTableError(err)) {
      setNeedsSetup(true);
      setStatus('error');
    } else {
      console.error('[StickyNotes]', err);
      setErrorMessage(String((err as any)?.message || err));
      setStatus('error');
    }
  }, []);

  // ── Tải dữ liệu ───────────────────────────
  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      await stickyNoteService.flushOutbox(userId);
      const serverNotes = await stickyNoteService.list(userId);
      setNeedsSetup(false);
      setNotes(prev => {
        // Giữ nội dung local của note đang có thay đổi chưa lưu
        const localById = new Map(prev.map(n => [n.id, n]));
        const merged = serverNotes.map(s => {
          const pending = pendingPatches.current.get(s.id);
          return pending ? { ...s, ...pending } : s;
        });
        const serverIds = new Set(serverNotes.map(n => n.id));
        // Note tạo offline chưa lên server
        const outboxIds = new Set(stickyNoteService.readOutbox(userId).filter(e => e.create).map(e => e.id));
        prev.forEach(n => {
          if (!serverIds.has(n.id) && (outboxIds.has(n.id) || pendingPatches.current.has(n.id) || inflight.current.has(n.id))) {
            merged.unshift(localById.get(n.id)!);
          }
        });
        return merged;
      });
      setStatus(stickyNoteService.hasPendingOutbox(userId) ? 'offline' : 'idle');
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, handleError]);

  useEffect(() => {
    if (!userId) return;
    setNotes(stickyNoteService.readCache(userId));
    setIsLoading(true);
    reload();
    stickyNoteService.purgeOldTrash(userId).catch(() => { });
  }, [userId, reload]);

  // ── Realtime ──────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`sticky-notes-${userId}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sticky_notes', filter: `user_id=eq.${userId}` },
        (payload: any) => {
          if (payload.eventType === 'DELETE') {
            const id = payload.old?.id;
            if (id) setNotes(prev => prev.filter(n => n.id !== id));
            return;
          }
          const remote = payload.new as StickyNote;
          if (!remote?.id) return;
          const busy = editingIdRef.current === remote.id
            || pendingPatches.current.has(remote.id)
            || inflight.current.has(remote.id);
          if (busy) {
            deferredRemote.current.set(remote.id, remote);
            return;
          }
          setNotes(prev => {
            const local = prev.find(n => n.id === remote.id);
            if (!local) return [remote, ...prev];
            if (remote.updated_at <= local.updated_at) return prev;
            return prev.map(n => (n.id === remote.id ? remote : n));
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // ── Online / thử lại outbox ───────────────
  useEffect(() => {
    if (!userId) return;
    const onOnline = () => { reload(); };
    window.addEventListener('online', onOnline);
    const interval = setInterval(() => {
      if (stickyNoteService.hasPendingOutbox(userId) && navigator.onLine) reload();
    }, OUTBOX_RETRY_MS);
    return () => {
      window.removeEventListener('online', onOnline);
      clearInterval(interval);
    };
  }, [userId, reload]);

  // ── Lưu ───────────────────────────────────
  const flush = useCallback(async (id: string) => {
    if (!userId) return;
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
    const patch = pendingPatches.current.get(id);
    if (!patch) return;
    if (inflight.current.has(id)) {
      // Đợi request trước xong rồi lưu tiếp để không ghi đè lẫn nhau
      timers.current.set(id, setTimeout(() => flush(id), SAVE_DEBOUNCE_MS));
      return;
    }
    pendingPatches.current.delete(id);
    // Note tạo lúc offline chưa lên server → gộp vào hàng đợi, đẩy cùng lệnh tạo
    if (stickyNoteService.readOutbox(userId).some(e => e.id === id && e.create)) {
      stickyNoteService.enqueue(userId, { id, patch });
      reload();
      return;
    }
    inflight.current.add(id);
    setStatus('saving');
    try {
      const row = await stickyNoteService.update(userId, id, patch);
      setNotes(prev => prev.map(n => (n.id === id ? { ...n, version: row.version, updated_at: row.updated_at, last_device: row.last_device } : n)));
      setStatus(pendingPatches.current.size > 0 ? 'saving' : 'saved');
    } catch (err) {
      if (isNetworkError(err)) stickyNoteService.enqueue(userId, { id, patch });
      handleError(err);
    } finally {
      inflight.current.delete(id);
    }
  }, [userId, handleError, reload]);

  const updateNote = useCallback((id: string, patch: StickyNotePatch, opts: { immediate?: boolean } = {}) => {
    setNotes(prev => prev.map(n => (n.id === id ? { ...n, ...patch } : n)));
    pendingPatches.current.set(id, { ...(pendingPatches.current.get(id) || {}), ...patch });
    deferredRemote.current.delete(id);
    const old = timers.current.get(id);
    if (old) clearTimeout(old);
    if (opts.immediate) {
      flush(id);
    } else {
      setStatus('saving');
      timers.current.set(id, setTimeout(() => flush(id), SAVE_DEBOUNCE_MS));
    }
  }, [flush]);

  const createNote = useCallback(async (partial: StickyNotePatch = {}, opts: { id?: string } = {}): Promise<StickyNote | null> => {
    if (!userId) return null;
    const note = newStickyNote(userId, partial, opts.id);
    setNotes(prev => [note, ...prev]);
    inflight.current.add(note.id);
    setStatus('saving');
    try {
      const row = await stickyNoteService.insert(note);
      // Gộp thay đổi người dùng gõ trong lúc chờ insert
      setNotes(prev => prev.map(n => (n.id === note.id ? { ...row, ...(pendingPatches.current.get(note.id) || {}) } : n)));
      setStatus('saved');
    } catch (err) {
      if (isNetworkError(err)) stickyNoteService.enqueue(userId, { id: note.id, create: note });
      handleError(err);
    } finally {
      inflight.current.delete(note.id);
    }
    return note;
  }, [userId, handleError]);

  const deleteForever = useCallback(async (id: string) => {
    if (!userId) return;
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    pendingPatches.current.delete(id);
    setNotes(prev => prev.filter(n => n.id !== id));
    try {
      await stickyNoteService.deleteForever(userId, id);
    } catch (err) {
      if (isNetworkError(err)) stickyNoteService.enqueue(userId, { id, hardDelete: true });
      handleError(err);
    }
  }, [userId, handleError]);

  /** Báo note nào đang được gõ để tạm hoãn cập nhật realtime cho note đó. */
  const setEditing = useCallback((id: string | null) => {
    const prevId = editingIdRef.current;
    editingIdRef.current = id;
    if (prevId && prevId !== id) {
      flush(prevId);
      const remote = deferredRemote.current.get(prevId);
      if (remote && !pendingPatches.current.has(prevId)) {
        deferredRemote.current.delete(prevId);
        setNotes(prev => prev.map(n => (n.id === prevId && remote.updated_at > n.updated_at ? remote : n)));
      }
    }
  }, [flush]);

  // Lưu ngay khi rời trang / đóng cửa sổ
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        Array.from(pendingPatches.current.keys()).forEach(id => flush(id));
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      // Unmount: không để mất thay đổi chưa lưu
      if (userId) {
        pendingPatches.current.forEach((patch, id) => stickyNoteService.enqueue(userId, { id, patch }));
        pendingPatches.current.clear();
        stickyNoteService.flushOutbox(userId).catch(() => { });
      }
      timers.current.forEach(t => clearTimeout(t));
      timers.current.clear();
    };
  }, [userId, flush]);

  return {
    notes, isLoading, status, needsSetup, errorMessage,
    createNote, updateNote, deleteForever, setEditing, reload, flush,
  };
}
