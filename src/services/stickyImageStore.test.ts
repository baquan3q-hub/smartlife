import 'fake-indexeddb/auto';
import { afterEach, describe, expect, test } from 'vitest';
import { ORPHAN_GRACE_MS, stickyImageStore, __resetStickyImageStoreForTests } from './stickyImageStore';
import { fitSize, MAX_INPUT_BYTES, StickyImageError, validateImageFile } from '../utils/stickyImageCompress';

const blob = (bytes = 3, type = 'image/webp') => new Blob([new Uint8Array(bytes).fill(7)], { type });
const idOf = (src: string) => src.replace('sticky-img://', '');

afterEach(async () => {
  await __resetStickyImageStoreForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('smartlife_sticky_images');
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
});

describe('stickyImageStore', () => {
  test('lưu rồi đọc lại đúng dữ liệu', async () => {
    const src = await stickyImageStore.put({ userId: 'u1', noteId: 'n1', blob: blob(5), width: 10, height: 20 });
    expect(src).toMatch(/^sticky-img:\/\/[a-zA-Z0-9-]{8,64}$/);
    const rec = await stickyImageStore.get(idOf(src));
    expect(rec).toMatchObject({ user_id: 'u1', note_id: 'n1', mime: 'image/webp', width: 10, height: 20, size: 5, orphaned_at: null });
    const back = await stickyImageStore.getBlob(idOf(src));
    expect(new Uint8Array(await back!.arrayBuffer())).toEqual(new Uint8Array(5).fill(7));
    expect(await stickyImageStore.getUrl(idOf(src))).toMatch(/^blob:/);
  });

  test('ảnh không có trên máy → null', async () => {
    expect(await stickyImageStore.get('khong-co-anh-nay')).toBeNull();
    expect(await stickyImageStore.getUrl('khong-co-anh-nay')).toBeNull();
  });

  test('dọn rác: đánh dấu mồ côi, còn dùng thì bỏ dấu, quá hạn mới xoá, không đụng user khác', async () => {
    const used = await stickyImageStore.put({ userId: 'u1', noteId: 'n1', blob: blob(), width: 1, height: 1 });
    const orphan = await stickyImageStore.put({ userId: 'u1', noteId: 'n1', blob: blob(), width: 1, height: 1 });
    const other = await stickyImageStore.put({ userId: 'u2', noteId: 'x', blob: blob(), width: 1, height: 1 });
    const t0 = 1_000_000;
    const contents = [`Ảnh ![](${used})`];

    expect(await stickyImageStore.collectGarbage('u1', contents, t0)).toEqual({ marked: 1, deleted: 0 });
    expect((await stickyImageStore.get(idOf(orphan)))?.orphaned_at).toBe(t0);

    // Chưa quá hạn → giữ
    expect(await stickyImageStore.collectGarbage('u1', contents, t0 + ORPHAN_GRACE_MS - 1)).toEqual({ marked: 0, deleted: 0 });
    // Được dùng lại (vd khôi phục phiên bản) → bỏ dấu
    await stickyImageStore.collectGarbage('u1', [...contents, `![](${orphan})`], t0 + 10);
    expect((await stickyImageStore.get(idOf(orphan)))?.orphaned_at).toBeNull();

    await stickyImageStore.collectGarbage('u1', contents, t0 + 20);
    expect(await stickyImageStore.collectGarbage('u1', contents, t0 + 20 + ORPHAN_GRACE_MS)).toEqual({ marked: 0, deleted: 1 });
    expect(await stickyImageStore.get(idOf(orphan))).toBeNull();
    expect(await stickyImageStore.get(idOf(used))).not.toBeNull();
    expect(await stickyImageStore.get(idOf(other))).not.toBeNull();
  });
});

describe('nén ảnh', () => {
  test('thu nhỏ giữ tỉ lệ, không phóng to', () => {
    expect(fitSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitSize(1000, 3200)).toEqual({ width: 500, height: 1600 });
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitSize(5000, 1)).toEqual({ width: 1600, height: 1 });
  });
  test('chặn SVG, file không phải ảnh, ảnh quá 10 MB', () => {
    expect(() => validateImageFile(blob(1, 'image/svg+xml'))).toThrow(StickyImageError);
    expect(() => validateImageFile(blob(1, 'text/html'))).toThrow(StickyImageError);
    expect(() => validateImageFile({ type: 'image/jpeg', size: MAX_INPUT_BYTES + 1 } as Blob)).toThrow(/10 MB/);
    expect(() => validateImageFile(blob(1, 'image/png'))).not.toThrow();
  });
});
