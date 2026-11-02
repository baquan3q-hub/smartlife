// File: src/hooks/useStickyNotes.ts
// Quản lý state Sticky Notes: cache-first, tự lưu (debounce), Supabase Realtime, offline outbox.
//
// Quy tắc đồng bộ:
// - Mỗi note có tối đa 1 request đang chạy (inflight). Thay đổi mới trong lúc chờ nằm ở pendingPatches
//   và được gửi tiếp sau khi request trước xong → không bao giờ ghi đè lẫn nhau.
// - Kết quả server = nguồn sự thật, chỉ trừ các trường người dùng vừa gõ mà chưa gửi.
// - Mỗi lần gõ phím: ghi ngay patch vào outbox (localStorage, đồng bộ) → mất mạng / tắt máy / mất điện
//   giữa chừng vẫn còn dữ liệu, lần mở sau tự gửi lên. Gửi thành công thì mục outbox được gỡ.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import {
  StickyNote, StickyNotePatch, stickyNoteService, newStickyNote,
  isNetworkError, isMissingTableError, isRowNotFoundError,
} from '../services/stickyNoteService';

export type StickySyncStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

const SAVE_DEBOUNCE_MS = 700;
const OUTBOX_RETRY_MS = 30_000;

export function useStickyNotes(userId: string | undefined) {
  const [notes, setNotes] = useState<StickyNote[]>(() => (userId ? stickyNoteService.readCache(userId) : []));
  /** userId đã tải xong lần đầu ('' = chưa đăng nhập). So sánh để isLoading đúng ngay ở lần render đổi user. */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const isLoading = loadedFor !== (userId || '');
  const [status, setStatus] = useState<StickySyncStatus>('idle');
  const [needsSetup, setNeedsSetup] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const notesRef = useRef(notes);
  notesRef.current = notes;
  const pendingPatches = useRef(new Map<string, StickyNotePatch>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  /** Request đang chạy cho từng note (insert hoặc update). */
  const inflight = useRef(new Map<string, Promise<unknown>>());
  /** Note vừa tạo, insert chưa xong. */
  const creating = useRef(new Set<string>());
  const editingIdRef = useRef<string | null>(null);
  /** Bản cập nhật từ thiết bị khác đến khi note đang bận — áp dụng khi rảnh. */
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

  const isBusy = (id: string) =>
    editingIdRef.current === id || pendingPatches.current.has(id) || inflight.current.has(id);

  /** Áp bản remote đã hoãn nếu note đã rảnh và bản remote mới hơn. */
  const applyDeferred = useCallback((id: string) => {
    const remote = deferredRemote.current.get(id);
    if (!remote || isBusy(id)) return;
    deferredRemote.current.delete(id);
    setNotes(prev => prev.map(n => (n.id === id && remote.updated_at > n.updated_at ? remote : n)));
  }, []);

  // ── Tải dữ liệu ───────────────────────────
  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const remaining = await stickyNoteService.flushOutbox(userId);
      const serverNotes = await stickyNoteService.list(userId);
      setNeedsSetup(false);
      setNotes(prev => {
        const localById = new Map(prev.map(n => [n.id, n]));
        const merged = serverNotes.map(s => {
          const local = localById.get(s.id);
          // Note đang lưu → giữ bản local, kết quả request sẽ cập nhật sau
          if (local && inflight.current.has(s.id)) return local;
          const pending = pendingPatches.current.get(s.id);
          return pending ? { ...s, ...pending } : s;
        });
        // Giữ note local chưa có trên server (tạo offline / đang tạo)
        const serverIds = new Set(serverNotes.map(n => n.id));
        const outboxCreates = new Set(stickyNoteService.readOutbox(userId).filter(e => e.create).map(e => e.id));
        prev.forEach(n => {
          if (!serverIds.has(n.id) && (outboxCreates.has(n.id) || creating.current.has(n.id))) merged.unshift(n);
        });
        return merged;
      });
      setStatus(remaining > 0 ? (navigator.onLine ? 'saving' : 'offline') : (pendingPatches.current.size > 0 ? 'saving' : 'idle'));
    } catch (err) {
      handleError(err);
    } finally {
      setLoadedFor(userId);
    }
  }, [userId, handleError]);

  useEffect(() => {
    if (!userId) {
      setNotes([]);
      setLoadedFor('');
      return;
    }
    setNotes(stickyNoteService.readCache(userId));
    reload();
    stickyNoteService.purgeOldTrash(userId).catch(() => { });
  }, [userId, reload]);

  // ── Realtime ──────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const removeLocal = (id: string) => {
      pendingPatches.current.delete(id);
      deferredRemote.current.delete(id);
      setNotes(prev => prev.filter(n => n.id !== id));
    };
    const channel = supabase
      .channel(`sticky-notes-${userId}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sticky_notes', filter: `user_id=eq.${userId}` },
        (payload: any) => {
          const remote = payload.new as StickyNote;
          if (!remote?.id) return;
          setNotes(prev => (prev.some(n => n.id === remote.id) ? prev : [remote, ...prev]));
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sticky_notes', filter: `user_id=eq.${userId}` },
        (payload: any) => {
          const remote = payload.new as StickyNote;
          if (!remote?.id) return;
          if (isBusy(remote.id)) {
            const prevDeferred = deferredRemote.current.get(remote.id);
            if (!prevDeferred || remote.updated_at > prevDeferred.updated_at) deferredRemote.current.set(remote.id, remote);
            return;
          }
          setNotes(prev => {
            const local = prev.find(n => n.id === remote.id);
            if (!local) return [remote, ...prev];
            if (remote.updated_at <= local.updated_at) return prev;
            return prev.map(n => (n.id === remote.id ? remote : n));
          });
        })
      // Supabase không lọc được sự kiện DELETE theo cột (bản cũ chỉ có khoá chính) → nghe không lọc,
      // chỉ xoá nếu id có trong danh sách của mình.
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'sticky_notes' },
        (payload: any) => {
          const id = payload.old?.id;
          if (id && notesRef.current.some(n => n.id === id) && !creating.current.has(id)) removeLocal(id);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // ── Online / thử lại outbox / quay lại tab ──
  useEffect(() => {
    if (!userId) return;
    const onOnline = () => { reload(); };
    const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(() => {
      if (pendingPatches.current.size === 0 && stickyNoteService.hasPendingOutbox(userId) && navigator.onLine) reload();
    }, OUTBOX_RETRY_MS);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [userId, reload]);

  // ── Lưu ───────────────────────────────────
  /**
   * Gửi thay đổi đang chờ của 1 note. Promise chỉ xong khi mọi thay đổi tới thời điểm gọi đã được gửi
   * (hoặc đã vào outbox) — an toàn để await trước khi đóng cửa sổ.
   */
  const flush = useCallback(async (id: string): Promise<void> => {
    if (!userId) return;
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }

    // Đợi request trước (insert/update) của note này và lượt đẩy outbox xong — kiểm tra lại sau mỗi lần chờ
    // để không bao giờ có 2 request cùng lúc cho 1 note, và bản cũ trong outbox không tới server sau bản mới.
    for (;;) {
      const running = inflight.current.get(id) || stickyNoteService.outboxFlushing(userId);
      if (!running) break;
      await running.catch(() => { });
    }

    const pending = pendingPatches.current.get(id);
    // Gộp patch đang nằm trong outbox (nháp từng phím / lỗi mạng trước đó). Chỉ gỡ khỏi outbox khi server xác nhận.
    const queued = pending ? stickyNoteService.peekPatch(userId, id) : undefined;
    if (!pending) return;
    const patch = { ...(queued || {}), ...pending };
    pendingPatches.current.delete(id);

    // Note tạo lúc offline chưa lên server → gộp vào lệnh tạo trong outbox
    if (stickyNoteService.readOutbox(userId).some(e => e.id === id && e.create)) {
      stickyNoteService.enqueue(userId, { id, patch });
      setStatus('offline');
      return;
    }

    setStatus('saving');
    const request = stickyNoteService.update(userId, id, patch);
    inflight.current.set(id, request);
    try {
      const row = await request;
      inflight.current.delete(id);
      stickyNoteService.ackPatch(userId, id, patch);
      // Server là nguồn sự thật, trừ các trường người dùng vừa gõ thêm trong lúc chờ
      setNotes(prev => prev.map(n => (n.id === id ? { ...row, ...(pendingPatches.current.get(id) || {}) } : n)));
      const deferred = deferredRemote.current.get(id);
      if (deferred && deferred.updated_at <= row.updated_at) deferredRemote.current.delete(id);
      applyDeferred(id);
      setStatus(pendingPatches.current.size > 0 ? 'saving' : 'saved');
    } catch (err) {
      inflight.current.delete(id);
      if (isRowNotFoundError(err)) {
        // Note đã bị xoá ở thiết bị khác
        pendingPatches.current.delete(id);
        stickyNoteService.dequeue(userId, id);
        setNotes(prev => prev.filter(n => n.id !== id));
        setStatus('idle');
        return;
      }
      // Lỗi mạng: dữ liệu vẫn nằm trong outbox (đã ghi từ lúc gõ), sẽ tự gửi lại khi có mạng
      handleError(err);
    }
  }, [userId, handleError, applyDeferred]);

  const updateNote = useCallback((id: string, patch: StickyNotePatch, opts: { immediate?: boolean } = {}) => {
    setNotes(prev => prev.map(n => (n.id === id ? { ...n, ...patch } : n)));
    pendingPatches.current.set(id, { ...(pendingPatches.current.get(id) || {}), ...patch });
    // Ghi nháp bền vững ngay lập tức (an toàn khi mất điện / tắt máy trước lúc kịp gửi)
    if (userId) stickyNoteService.enqueue(userId, { id, patch });
    const old = timers.current.get(id);
    if (old) clearTimeout(old);
    setStatus('saving');
    if (opts.immediate) {
      timers.current.delete(id);
      flush(id);
    } else {
      timers.current.set(id, setTimeout(() => flush(id), SAVE_DEBOUNCE_MS));
    }
  }, [userId, flush]);

  const createNote = useCallback(async (partial: StickyNotePatch = {}, opts: { id?: string } = {}): Promise<StickyNote | null> => {
    if (!userId) return null;
    const note = newStickyNote(userId, partial, opts.id);
    setNotes(prev => (prev.some(n => n.id === note.id) ? prev : [note, ...prev]));
    creating.current.add(note.id);
    // Ghi lệnh "tạo" vào outbox trước — nếu app tắt trước khi insert xong, lần sau sẽ tự tạo lại
    stickyNoteService.enqueue(userId, { id: note.id, create: note });
    setStatus('saving');
    const request = stickyNoteService.insert(note).catch(async (err) => {
      // Đã có trên server (outbox vừa đẩy lên trước) → coi như thành công
      if ((err as any)?.code === '23505') return note;
      throw err;
    });
    inflight.current.set(note.id, request);
    try {
      const row = await request;
      stickyNoteService.resolveCreate(userId, note.id);
      setNotes(prev => prev.map(n => (n.id === note.id ? { ...row, ...(pendingPatches.current.get(note.id) || {}) } : n)));
      setStatus(pendingPatches.current.size > 0 ? 'saving' : 'saved');
    } catch (err) {
      // Lỗi mạng: mục "tạo" vẫn nằm trong outbox, sẽ gửi lại sau. Lỗi khác: bỏ để không kẹt hàng đợi.
      if (!isNetworkError(err)) stickyNoteService.dequeue(userId, note.id);
      handleError(err);
    } finally {
      inflight.current.delete(note.id);
      creating.current.delete(note.id);
    }
    return note;
  }, [userId, handleError]);

  const deleteForever = useCallback(async (id: string) => {
    if (!userId) return;
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    pendingPatches.current.delete(id);
    deferredRemote.current.delete(id);
    setNotes(prev => prev.filter(n => n.id !== id));
    stickyNoteService.enqueue(userId, { id, hardDelete: true });
    // Đợi insert/update đang chạy xong, nếu không lệnh xoá có thể tới server trước lệnh tạo
    for (let running = inflight.current.get(id); running; running = inflight.current.get(id)) {
      await running.catch(() => { });
    }
    try {
      await stickyNoteService.deleteForever(userId, id);
      stickyNoteService.dequeue(userId, id);
    } catch (err) {
      if (!isNetworkError(err)) stickyNoteService.dequeue(userId, id);
      handleError(err);
    }
  }, [userId, handleError]);

  /** Báo note nào đang được gõ để tạm hoãn cập nhật realtime cho note đó. */
  const setEditing = useCallback((id: string | null) => {
    const prevId = editingIdRef.current;
    editingIdRef.current = id;
    if (prevId && prevId !== id) {
      flush(prevId).then(() => applyDeferred(prevId));
    }
  }, [flush, applyDeferred]);

  // Đóng tab / cửa sổ: ghi ngay thay đổi chưa gửi vào outbox (đồng bộ, không cần mạng),
  // lần mở sau sẽ tự đẩy lên. Gửi được ngay thì càng tốt.
  useEffect(() => {
    if (!userId) return;
    const persistPending = () => {
      pendingPatches.current.forEach((patch, id) => {
        const local = notesRef.current.find(n => n.id === id);
        if (creating.current.has(id) && local) {
          // Insert chưa chắc đã tới server → lưu dạng "tạo" (upsert) để không bị mất
          stickyNoteService.enqueue(userId, { id, create: local });
        } else {
          stickyNoteService.enqueue(userId, { id, patch });
        }
      });
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        Array.from(pendingPatches.current.keys()).forEach(id => { flush(id); });
      }
    };
    // Chỉ pagehide (trang thật sự bị huỷ). Không dùng beforeunload: app Windows gửi lệnh bằng điều hướng
    // bị huỷ, beforeunload sẽ chạy ở mỗi lệnh. Mỗi phím gõ cũng đã được ghi vào outbox.
    window.addEventListener('pagehide', persistPending);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', persistPending);
      document.removeEventListener('visibilitychange', onHide);
      // Rời trang Sticky trong app: gửi nốt thay đổi (request vẫn chạy sau khi unmount)
      timers.current.forEach(t => clearTimeout(t));
      timers.current.clear();
      Array.from(pendingPatches.current.keys()).forEach(id => { flush(id); });
    };
  }, [userId, flush]);

  /** Gửi ngay mọi thay đổi đang chờ (dùng khi đóng cửa sổ / thoát app). */
  const saveNow = useCallback(async () => {
    // Cả note có thay đổi chờ gửi lẫn note đang có request chạy dở (flush sẽ đợi request đó xong)
    const ids = new Set([...pendingPatches.current.keys(), ...inflight.current.keys()]);
    await Promise.all(Array.from(ids).map(id => flush(id)));
  }, [flush]);

  return {
    saveNow,
    notes, isLoading, status, needsSetup, errorMessage,
    createNote, updateNote, deleteForever, setEditing, reload, flush,
  };
}
