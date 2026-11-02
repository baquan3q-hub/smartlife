// File: src/services/stickyNoteService.ts
// Sticky Notes — lưu trữ Supabase + cache offline (localStorage) + hàng đợi đồng bộ (outbox)
// Thiết kế: docs/sticky-notes/PRD.md · Schema: sql/sticky_notes_schema.sql

import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

export type StickyColor = 'yellow' | 'green' | 'pink' | 'purple' | 'blue' | 'gray' | 'charcoal';
export type StickyDevice = 'web' | 'mobile' | 'desktop';

export interface StickyNote {
  id: string;
  user_id: string;
  title: string;
  content: string;
  color: StickyColor;
  labels: string[];
  is_pinned: boolean;
  is_archived: boolean;
  deleted_at: string | null;
  sort_order: number;
  version: number;
  last_device: StickyDevice | null;
  created_at: string;
  updated_at: string;
}

export interface StickyNoteVersion {
  id: string;
  note_id: string;
  title: string;
  content: string;
  color: StickyColor;
  version: number;
  device: StickyDevice | null;
  created_at: string;
}

/** Các trường người dùng được phép sửa. */
export type StickyNotePatch = Partial<Pick<StickyNote,
  'title' | 'content' | 'color' | 'labels' | 'is_pinned' | 'is_archived' | 'deleted_at' | 'sort_order'>>;

interface OutboxEntry {
  id: string;
  /** Có khi note được tạo lúc offline và chưa từng lên server. */
  create?: StickyNote;
  patch?: StickyNotePatch;
  hardDelete?: boolean;
}

const CACHE_PREFIX = 'smartlife_sticky_cache_';
const OUTBOX_PREFIX = 'smartlife_sticky_outbox_';
export const TRASH_RETENTION_DAYS = 30;
const flushing = new Map<string, Promise<number>>();
export const STICKY_COLORS: StickyColor[] = ['yellow', 'green', 'pink', 'purple', 'blue', 'gray', 'charcoal'];

// ────────────────────────────────────────
// Môi trường chạy
// ────────────────────────────────────────
export function isTauri(): boolean {
  return typeof window !== 'undefined'
    && ('__SMARTLIFE_DESKTOP__' in window || '__TAURI__' in window || '__TAURI_INTERNALS__' in window);
}

export function detectDevice(): StickyDevice {
  if (isTauri()) return 'desktop';
  try {
    if (Capacitor.isNativePlatform()) return 'mobile';
  } catch { /* web */ }
  return 'web';
}

/** Lỗi do mất mạng (nên xếp hàng thử lại) — khác với lỗi dữ liệu/quyền. */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = String((err as any)?.message || err || '');
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(msg);
}

/** Bảng chưa được tạo (chưa chạy file SQL). */
export function isMissingTableError(err: unknown): boolean {
  const code = (err as any)?.code;
  const msg = String((err as any)?.message || '');
  return code === '42P01' || code === 'PGRST205' || (/sticky_note/.test(msg) && /does not exist|schema cache/i.test(msg));
}

/** UPDATE ... .single() không tìm thấy dòng (note đã bị xoá ở thiết bị khác). */
export function isRowNotFoundError(err: unknown): boolean {
  return (err as any)?.code === 'PGRST116';
}

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* hết dung lượng / chế độ riêng tư */ }
}

export function newStickyNote(userId: string, partial: StickyNotePatch = {}, id?: string): StickyNote {
  const now = new Date().toISOString();
  return {
    id: id || crypto.randomUUID(),
    user_id: userId,
    title: '',
    content: '',
    color: 'yellow',
    labels: [],
    is_pinned: false,
    is_archived: false,
    deleted_at: null,
    sort_order: 0,
    version: 1,
    last_device: detectDevice(),
    created_at: now,
    updated_at: now,
    ...partial,
  };
}

export const stickyNoteService = {
  // ── Cache ────────────────────────────────
  readCache(userId: string): StickyNote[] {
    const notes = safeGet<StickyNote[]>(`${CACHE_PREFIX}${userId}`, []);
    return Array.isArray(notes) ? notes : [];
  },

  writeCache(userId: string, notes: StickyNote[]) {
    safeSet(`${CACHE_PREFIX}${userId}`, notes);
  },

  // ── Outbox (thay đổi chờ đẩy lên khi có mạng) ──
  readOutbox(userId: string): OutboxEntry[] {
    const items = safeGet<OutboxEntry[]>(`${OUTBOX_PREFIX}${userId}`, []);
    return Array.isArray(items) ? items : [];
  },

  hasPendingOutbox(userId: string): boolean {
    return this.readOutbox(userId).length > 0;
  },

  enqueue(userId: string, entry: OutboxEntry) {
    const items = this.readOutbox(userId);
    const existing = items.find(i => i.id === entry.id);
    if (!existing) {
      items.push(entry);
    } else if (entry.hardDelete) {
      // Note chưa từng lên server thì bỏ luôn, ngược lại chỉ giữ lệnh xoá
      if (existing.create) items.splice(items.indexOf(existing), 1);
      else Object.assign(existing, { patch: undefined, hardDelete: true });
    } else {
      if (entry.create) existing.create = { ...(existing.create || {}), ...entry.create } as StickyNote;
      if (entry.patch) existing.patch = { ...(existing.patch || {}), ...entry.patch };
    }
    safeSet(`${OUTBOX_PREFIX}${userId}`, items);
  },

  /** Insert lên server thành công → đổi mục "tạo" trong outbox thành patch thường (hoặc bỏ nếu không còn gì). */
  resolveCreate(userId: string, id: string) {
    const items = this.readOutbox(userId);
    const entry = items.find(i => i.id === id && i.create);
    if (!entry) return;
    delete entry.create;
    const next = entry.patch && Object.keys(entry.patch).length > 0 ? items : items.filter(i => i !== entry);
    safeSet(`${OUTBOX_PREFIX}${userId}`, next);
  },

  /** Bỏ mọi mục outbox của 1 note (vd đã xoá thành công trên server). */
  dequeue(userId: string, id: string) {
    safeSet(`${OUTBOX_PREFIX}${userId}`, this.readOutbox(userId).filter(i => i.id !== id));
  },

  /** Đọc (không xoá) patch đang chờ trong outbox của 1 note đã có trên server. */
  peekPatch(userId: string, id: string): StickyNotePatch | undefined {
    const entry = this.readOutbox(userId).find(i => i.id === id && !i.create && !i.hardDelete && i.patch);
    return entry?.patch ? { ...entry.patch } : undefined;
  },

  /**
   * Server đã lưu `sent` → gỡ mục outbox của note nếu nó không có gì mới hơn.
   * Nếu người dùng gõ thêm trong lúc chờ, mục outbox đã khác → giữ lại để lần lưu sau gửi tiếp.
   */
  ackPatch(userId: string, id: string, sent: StickyNotePatch) {
    const items = this.readOutbox(userId);
    const entry = items.find(i => i.id === id && !i.create && !i.hardDelete);
    if (!entry?.patch) return;
    const sameAsSent = Object.entries(entry.patch).every(([k, v]) =>
      k in sent && JSON.stringify((sent as any)[k]) === JSON.stringify(v));
    if (sameAsSent) safeSet(`${OUTBOX_PREFIX}${userId}`, items.filter(i => i !== entry));
  },

  /** Lượt đẩy outbox đang chạy (nếu có). */
  outboxFlushing(userId: string): Promise<number> | undefined {
    return flushing.get(userId);
  },

  /** Đẩy toàn bộ outbox. Trả về số mục còn lại (lỗi mạng sẽ giữ lại). Không chạy song song. */
  flushOutbox(userId: string): Promise<number> {
    const running = flushing.get(userId);
    if (running) return running;
    const task = this._flushOutbox(userId).finally(() => flushing.delete(userId));
    flushing.set(userId, task);
    return task;
  },

  async _flushOutbox(userId: string): Promise<number> {
    const items = this.readOutbox(userId);
    if (items.length === 0) return 0;
    const done: string[] = [];
    const device = detectDevice();

    for (const item of items) {
      try {
        if (item.hardDelete) {
          const { error } = await supabase.from('sticky_notes').delete().eq('id', item.id).eq('user_id', userId);
          if (error) throw error;
        } else if (item.create) {
          const row = { ...item.create, ...(item.patch || {}), last_device: device };
          const { error } = await supabase.from('sticky_notes').upsert(row, { onConflict: 'id' });
          if (error) throw error;
        } else if (item.patch) {
          const { error } = await supabase.from('sticky_notes')
            .update({ ...item.patch, last_device: device })
            .eq('id', item.id).eq('user_id', userId);
          if (error) throw error;
        }
        done.push(JSON.stringify(item));
      } catch (err) {
        if (!isNetworkError(err)) {
          // Lỗi dữ liệu (vd note đã bị xoá ở thiết bị khác) → bỏ mục này để không kẹt hàng đợi
          console.warn('[StickyNotes] Bỏ mục outbox lỗi:', item.id, err);
          done.push(JSON.stringify(item));
        }
      }
    }

    // Đọc lại: trong lúc chờ mạng có thể đã có mục mới / mục bị gộp thêm → chỉ xoá đúng các mục đã xử lý
    const doneSet = new Set(done);
    const remaining = this.readOutbox(userId).filter(i => !doneSet.has(JSON.stringify(i)));
    safeSet(`${OUTBOX_PREFIX}${userId}`, remaining);
    return remaining.length;
  },

  // ── Server ───────────────────────────────
  /** Toàn bộ note của user (gồm thùng rác). Tải theo trang — Supabase giới hạn mỗi lần trả tối đa 1000 dòng. */
  async list(userId: string): Promise<StickyNote[]> {
    const PAGE = 1000;
    const all: StickyNote[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('sticky_notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      all.push(...((data || []) as StickyNote[]));
      if (!data || data.length < PAGE) return all;
    }
  },

  async insert(note: StickyNote): Promise<StickyNote> {
    const { data, error } = await supabase
      .from('sticky_notes')
      .insert({ ...note, last_device: detectDevice() })
      .select()
      .single();
    if (error) throw error;
    return data as StickyNote;
  },

  async update(userId: string, id: string, patch: StickyNotePatch): Promise<StickyNote> {
    const { data, error } = await supabase
      .from('sticky_notes')
      .update({ ...patch, last_device: detectDevice() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data as StickyNote;
  },

  async deleteForever(userId: string, id: string): Promise<void> {
    const { error } = await supabase.from('sticky_notes').delete().eq('id', id).eq('user_id', userId);
    if (error) throw error;
  },

  /** Xoá vĩnh viễn note trong thùng rác quá 30 ngày. */
  async purgeOldTrash(userId: string): Promise<void> {
    const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 86400_000).toISOString();
    await supabase.from('sticky_notes').delete()
      .eq('user_id', userId)
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoff);
  },

  /** Chụp phiên bản thủ công (vd trước khi AI thay nội dung) — không phụ thuộc giới hạn 5 phút của trigger. */
  async snapshot(note: StickyNote): Promise<void> {
    if (!note.title && !note.content) return;
    const { error } = await supabase.from('sticky_note_versions').insert({
      note_id: note.id,
      user_id: note.user_id,
      title: note.title,
      content: note.content,
      color: note.color,
      version: note.version,
      device: detectDevice(),
    });
    if (error) throw error;
  },

  async listVersions(userId: string, noteId: string): Promise<StickyNoteVersion[]> {
    const { data, error } = await supabase
      .from('sticky_note_versions')
      .select('id, note_id, title, content, color, version, device, created_at')
      .eq('user_id', userId)
      .eq('note_id', noteId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data || []) as StickyNoteVersion[];
  },
};
