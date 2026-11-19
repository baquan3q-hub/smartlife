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

/** Object URL đang dùng: refs = số ảnh đang hiển thị; về 0 thì thu hồi sau URL_RELEASE_MS (tránh tạo lại khi cuộn/đổi note). */
const urlCache = new Map<string, { url: Promise<string | null>; refs: number; timer?: ReturnType<typeof setTimeout> }>();
const URL_RELEASE_MS = 30_000;

function forgetUrl(id: string) {
  const entry = urlCache.get(id);
  if (!entry) return;
  urlCache.delete(id);
  if (entry.timer) clearTimeout(entry.timer);
  entry.url.then(u => { if (u) URL.revokeObjectURL(u); }, () => {});
}

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

  /**
   * Object URL để hiển thị, mỗi lần gọi phải kèm 1 lần releaseUrl(id).
   * null = ảnh không có trên thiết bị này; reject = không đọc được kho ảnh (bị chặn, ẩn danh…).
   */
  getUrl(id: string): Promise<string | null> {
    let entry = urlCache.get(id);
    if (!entry) {
      const url = this.getBlob(id).then(blob => (blob ? URL.createObjectURL(blob) : null));
      entry = { url, refs: 0 };
      urlCache.set(id, entry);
      // Không giữ kết quả "không có"/lỗi — ảnh có thể vừa được ghi xong ở cửa sổ khác
      const mine = entry;
      url.then(u => { if (!u && urlCache.get(id) === mine) urlCache.delete(id); },
        () => { if (urlCache.get(id) === mine) urlCache.delete(id); });
    }
    entry.refs++;
    if (entry.timer) { clearTimeout(entry.timer); entry.timer = undefined; }
    return entry.url;
  },

  releaseUrl(id: string) {
    const entry = urlCache.get(id);
    if (!entry || --entry.refs > 0) return;
    entry.refs = 0;
    entry.timer = setTimeout(() => { if (urlCache.get(id) === entry && entry.refs === 0) forgetUrl(id); }, URL_RELEASE_MS);
  },

  /**
   * Xoá ngay các ảnh `ids` của user không còn nằm trong `stillUsed` (nội dung các note còn lại).
   * Dùng khi xoá vĩnh viễn note — không đợi hạn mồ côi.
   */
  async deleteUnused(userId: string, ids: string[], stillUsed: string[]): Promise<number> {
    const used = new Set(stillUsed.flatMap(c => extractStickyImageIds(c)));
    const targets = ids.filter(id => !used.has(id));
    if (!targets.length) return 0;
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    let deleted = 0;
    for (const id of targets) {
      const req = store.get(id);
      req.onsuccess = () => {
        const rec = req.result as StickyImageRecord | undefined;
        if (rec?.user_id !== userId) return;
        store.delete(id);
        deleted++;
      };
    }
    await done(tx);
    targets.forEach(forgetUrl);
    return deleted;
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
        forgetUrl(rec.id);
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
  urlCache.forEach(e => e.timer && clearTimeout(e.timer));
  urlCache.clear();
}
