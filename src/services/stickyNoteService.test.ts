import { describe, expect, test, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: {} }));

import { normalizeStickyNote, normalizeStickyNotes, StickyNote } from './stickyNoteService';

const full: StickyNote = {
  id: 'n1', user_id: 'u1', title: 'Tiêu đề', content: 'Nội dung rất dài', color: 'green', labels: ['học'],
  is_pinned: false, is_archived: false, deleted_at: null, sort_order: 0, version: 3, last_device: 'web',
  created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z',
};

describe('chuẩn hoá ghi chú từ bên ngoài', () => {
  test('bản realtime thiếu cột nội dung (TOAST) → giữ nội dung đang có, không làm mất chữ', () => {
    const remote = { id: 'n1', user_id: 'u1', is_pinned: true, version: 4, last_device: 'bot', updated_at: '2026-11-02T00:00:00Z' };
    const merged = normalizeStickyNote(remote, full)!;
    expect(merged.content).toBe('Nội dung rất dài');
    expect(merged.title).toBe('Tiêu đề');
    expect(merged.labels).toEqual(['học']);
    expect(merged.is_pinned).toBe(true);
    expect(merged.version).toBe(4);
    expect(merged.last_device).toBe('bot');
  });

  test('trường null / sai kiểu → giá trị an toàn, giao diện không bị lỗi', () => {
    const note = normalizeStickyNote({ id: 'n2', title: null, content: undefined, labels: [null, 'a', 3], color: 'đỏ', created_at: null, updated_at: '2026-11-02T00:00:00Z' })!;
    expect(note).toMatchObject({ title: '', content: '', labels: ['a'], color: 'yellow', deleted_at: null, is_pinned: false });
    expect(note.created_at).toBe('2026-11-02T00:00:00Z');
    expect(note.title.trim()).toBe('');
  });

  test('cache cũ hỏng: bỏ mục không có id, bỏ trùng, không phải mảng thì trả rỗng', () => {
    expect(normalizeStickyNotes(null)).toEqual([]);
    expect(normalizeStickyNotes({ a: 1 })).toEqual([]);
    const list = normalizeStickyNotes([full, null, { title: 'không id' }, { ...full, title: 'trùng' }]);
    expect(list.map(n => n.id)).toEqual(['n1']);
    expect(list[0].title).toBe('Tiêu đề');
  });
});
