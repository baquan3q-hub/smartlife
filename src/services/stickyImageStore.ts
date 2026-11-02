// File: src/services/stickyImageStore.ts
// Ảnh trong Sticky Notes chỉ lưu trên thiết bị (IndexedDB) — không tốn dung lượng Supabase, không đồng bộ.
// Note chỉ chứa tham chiếu `sticky-img://<id>`; máy khác thấy ô "Ảnh chỉ có trên thiết bị đã chèn".
//
// Dọn rác: ảnh không còn được note nào (kể cả thùng rác) tham chiếu sẽ được đánh dấu "mồ côi";
// mồ côi quá ORPHAN_GRACE_MS mới xoá thật → hoàn tác / khôi phục phiên bản gần đây vẫn còn ảnh.

import { STICKY_IMG_SCHEME, extractStickyImageIds } from '../utils/stickyMarkdown';

const DB_NAME = 'smartlife_sticky_images';
const DB_VERSION = 1;
const STORE = 'images';
export const ORPHAN_GRACE_MS = 7 * 86400_000;

export interface StickyImageRecord {
  id: string;
  user_id: string;
  note_id: string;
  mime: string;
  width: number;
  height: number;
  size: number;
  /** ArrayBuffer thay vì Blob: WebView cũ (iOS/Android) lưu Blob trong IndexedDB không ổn định */
  data: ArrayBuffer;
  created_at: number;
  orphaned_at: number | null;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Thiết bị không hỗ trợ lưu ảnh (IndexedDB).'));
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('user_id', 'user_id');
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // Tab khác nâng cấp DB → đóng để không chặn, lần sau mở lại
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => { dbPromise = null; reject(req.error); };
    req.onblocked = () => { dbPromise = null; reject(new Error('Kho ảnh đang bị tab khác giữ, hãy tải lại trang.')); };
  });
  return dbPromise;
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Huỷ giao dịch'));
  });
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

const urlCache = new Map<string, Promise<string | null>>();

export const stickyImageStore = {
  /** Lưu ảnh (đã nén) → trả về src để chèn vào note: sticky-img://<id> */
  async put(input: { userId: string; noteId: string; blob: Blob; width: number; height: number }): Promise<string> {
    const data = await input.blob.arrayBuffer();
    const record: StickyImageRecord = {
      id: newId(),
      user_id: input.userId,
      note_id: input.noteId,
      mime: input.blob.type || 'image/webp',
      width: input.width,
      height: input.height,
      size: data.byteLength,
      data,
      created_at: Date.now(),
      orphaned_at: null,
    };
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    await done(tx);
    return `${STICKY_IMG_SCHEME}${record.id}`;
  },

  async get(id: string): Promise<StickyImageRecord | null> {
    const db = await openDb();
    const record = await promisify(db.transaction(STORE).objectStore(STORE).get(id));
    return (record as StickyImageRecord | undefined) ?? null;
  },

  async getBlob(id: string): Promise<Blob | null> {
    const record = await this.get(id);
    return record ? new Blob([record.data], { type: record.mime }) : null;
  },

  /** Object URL để hiển thị (cache trong phiên). null = ảnh không có trên thiết bị này. */
  getUrl(id: string): Promise<string | null> {
    let cached = urlCache.get(id);
    if (!cached) {
      cached = this.getBlob(id)
        .then(blob => (blob ? URL.createObjectURL(blob) : null))
        .catch(() => null);
      // Không giữ kết quả "không có" — ảnh có thể vừa được ghi xong ở cửa sổ khác
      cached.then(url => { if (!url) urlCache.delete(id); });
      urlCache.set(id, cached);
    }
    return cached;
  },

  /**
   * Dọn ảnh mồ côi của user. `contents` = nội dung MỌI note của user (gồm thùng rác, note chưa đồng bộ).
   * Chỉ gọi sau khi tải danh sách note từ server thành công, nếu không ảnh đang dùng có thể bị coi là mồ côi.
   */
  async collectGarbage(userId: string, contents: string[], now = Date.now()): Promise<{ marked: number; deleted: number }> {
    const used = new Set(contents.flatMap(c => extractStickyImageIds(c)));
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    let marked = 0;
    let deleted = 0;
    const cursorReq = store.index('user_id').openCursor(IDBKeyRange.only(userId));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      const rec = cursor.value as StickyImageRecord;
      if (used.has(rec.id)) {
        if (rec.orphaned_at !== null) cursor.update({ ...rec, orphaned_at: null });
      } else if (rec.orphaned_at === null) {
        cursor.update({ ...rec, orphaned_at: now });
        marked++;
      } else if (now - rec.orphaned_at >= ORPHAN_GRACE_MS) {
        cursor.delete();
        deleted++;
        const url = urlCache.get(rec.id);
        urlCache.delete(rec.id);
        url?.then(u => { if (u) URL.revokeObjectURL(u); });
      }
      cursor.continue();
    };
    await done(tx);
    return { marked, deleted };
  },

  /** Xin trình duyệt không tự xoá dữ liệu khi thiếu dung lượng (ảnh chỉ có 1 bản trên máy). */
  async requestPersistence(): Promise<void> {
    try {
      if (navigator.storage?.persisted && !(await navigator.storage.persisted())) await navigator.storage.persist?.();
    } catch { /* không hỗ trợ */ }
  },
};

/** Test: đóng DB, xoá cache. */
export async function __resetStickyImageStoreForTests() {
  const db = await dbPromise?.catch(() => null);
  db?.close();
  dbPromise = null;
  urlCache.clear();
}
