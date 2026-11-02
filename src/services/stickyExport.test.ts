import { describe, expect, test } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import type { StickyNote } from './stickyNoteService';
import { buildMarkdownExport, ImageLoader, noteDisplayTitle, noteToMarkdown } from './stickyExport';
import { buildDocDefinition, markdownToPdfContent, noteAccent } from './stickyPdf';

const IMG_A = 'aaaaaaaa-1111';
const IMG_MISSING = 'bbbbbbbb-2222';

function note(p: Partial<StickyNote> = {}): StickyNote {
  return {
    id: 'n1', user_id: 'u1', title: 'Đi chợ', content: 'Mua **sữa**', color: 'yellow', labels: [],
    is_pinned: false, is_archived: false, deleted_at: null, sort_order: 0, version: 1, last_device: null,
    created_at: '2026-11-01T08:00:00.000Z', updated_at: '2026-11-02T09:30:00.000Z', ...p,
  };
}

const loader: ImageLoader = async (id) =>
  id === IMG_A ? { blob: new Blob([new Uint8Array([9, 8, 7])], { type: 'image/webp' }), ext: 'webp' } : null;

const unzip = async (blob: Blob) => unzipSync(new Uint8Array(await blob.arrayBuffer()));

describe('xuất Markdown', () => {
  test('front-matter + tiêu đề + nội dung giữ nguyên định dạng', () => {
    const md = noteToMarkdown(note({ labels: ['nhà', 'việc "gấp"'] }), () => null);
    expect(md).toBe([
      '---',
      'title: "Đi chợ"',
      'labels: ["nhà","việc \\"gấp\\""]',
      'color: yellow',
      'created: 2026-11-01T08:00:00.000Z',
      'updated: 2026-11-02T09:30:00.000Z',
      '---',
      '',
      '# Đi chợ',
      '',
      'Mua **sữa**',
      '',
    ].join('\n'));
  });

  test('note không tiêu đề → lấy dòng đầu nội dung', () => {
    expect(noteDisplayTitle(note({ title: '  ', content: '**Họp** lúc 9h\n- a' }))).toBe('Họp lúc 9h');
    expect(noteDisplayTitle(note({ title: '', content: '' }))).toBe('Ghi chú');
  });

  test('1 note không ảnh → file .md, tên bỏ dấu', async () => {
    const file = await buildMarkdownExport([note()], loader);
    expect(file.filename).toBe('Di-cho.md');
    expect(file.blob.type).toContain('text/markdown');
    expect(await file.blob.text()).toContain('Mua **sữa**');
  });

  test('note có ảnh → .zip kèm thư mục images/, ảnh không có trên máy thành dòng ghi chú', async () => {
    const content = `Trước\n\n![bìa](sticky-img://${IMG_A})\n\n![](sticky-img://${IMG_MISSING})`;
    const file = await buildMarkdownExport([note({ content })], loader);
    expect(file.filename).toBe('Di-cho.zip');
    const files = await unzip(file.blob);
    expect(Object.keys(files).sort()).toEqual(['Di-cho.md', `images/${IMG_A}.webp`]);
    const md = strFromU8(files['Di-cho.md']);
    expect(md).toContain(`![bìa](images/${IMG_A}.webp)`);
    expect(md).toContain('*[Ảnh chỉ có trên thiết bị đã chèn]*');
    expect(md).not.toContain('sticky-img://');
    expect(Array.from(files[`images/${IMG_A}.webp`])).toEqual([9, 8, 7]);
  });

  test('nhiều note → 1 .zip, trùng tên thì thêm hậu tố, ảnh dùng chung chỉ lưu 1 lần', async () => {
    const img = `![](sticky-img://${IMG_A})`;
    const file = await buildMarkdownExport([note({ content: img }), note({ id: 'n2', content: img }), note({ id: 'n3', title: 'CON' })], loader);
    expect(file.filename).toMatch(/^sticky-notes-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(Object.keys(await unzip(file.blob)).sort()).toEqual(['Di-cho-2.md', 'Di-cho.md', 'ghi-chu.md', `images/${IMG_A}.webp`]);
  });

  test('không có note → báo lỗi', async () => {
    await expect(buildMarkdownExport([], loader)).rejects.toThrow('Chưa chọn');
  });
});

describe('xuất PDF (bố cục)', () => {
  const flat = (x: unknown) => JSON.stringify(x);

  test('đậm / nghiêng / gạch / link an toàn', () => {
    const c = flat(markdownToPdfContent('**Đậm** *nghiêng* ~~gạch~~ [web](https://a.com) [xấu](javascript:alert(1))'));
    expect(c).toContain('"text":"Đậm","bold":true');
    expect(c).toContain('"text":"nghiêng","italics":true');
    expect(c).toContain('"decoration":"lineThrough"');
    expect(c).toContain('"link":"https://a.com/"');
    expect(c).not.toContain('javascript:');
    expect(c).toContain('"text":"xấu"');
  });

  test('checklist có ô tick, việc xong bị gạch', () => {
    const [list] = markdownToPdfContent('- [x] xong\n- [ ] chưa') as any[];
    const [done, todo] = list.stack;
    expect(done.columns[0].canvas).toHaveLength(2); // ô + dấu tick
    expect(todo.columns[0].canvas).toHaveLength(1);
    expect(flat(done)).toContain('"decoration":"lineThrough"');
    expect(flat(todo)).not.toContain('lineThrough');
  });

  test('bảng: hàng tiêu đề đậm, <br> trong ô thành xuống dòng', () => {
    const [t] = markdownToPdfContent('| A | B |\n| - | - |\n| 1<br>2 | x |') as any[];
    expect(t.table.widths).toEqual(['*', '*']);
    expect(flat(t.table.body[0][0])).toContain('"bold":true');
    expect(flat(t.table.body[1][0])).toContain('"text":"\\n"');
  });

  test('ảnh local có → khối ảnh; không có → dòng ghi chú; ảnh trên mạng không tải', () => {
    const images = new Map([[IMG_A, { dataUrl: 'data:image/jpeg;base64,AAA', width: 2000, height: 1000 }], [IMG_MISSING, null]]);
    const c = markdownToPdfContent(`a ![](sticky-img://${IMG_A}) b\n\n![x](sticky-img://${IMG_MISSING})\n\n![m](https://ex.com/p.png)`, images) as any[];
    const img = c.find(b => b.image);
    expect(img.image).toBe('data:image/jpeg;base64,AAA');
    expect(img.fit[0]).toBeLessThanOrEqual(515.28);
    expect(flat(c)).toContain('x — Ảnh chỉ có trên thiết bị đã chèn');
    expect(flat(c)).not.toContain('"image":"https://');
    expect(flat(c)).toContain('"link":"https://ex.com/p.png"');
  });

  test('HTML thô hiện thành chữ', () => {
    expect(flat(markdownToPdfContent('Gửi <Nam>\n\n<div>x</div>'))).toContain('<div>x</div>');
  });

  test('nhiều note: dải màu theo note, mỗi note sang trang mới, chân trang có số trang', () => {
    const doc = buildDocDefinition([note(), note({ id: 'n2', title: 'Than', color: 'charcoal' })]) as any;
    expect(doc.content).toHaveLength(2);
    expect(doc.content[0].pageBreak).toBeUndefined();
    expect(doc.content[1].pageBreak).toBe('before');
    const strip = (i: number) => doc.content[i].stack[0].table.body[0][0];
    expect(strip(0)).toMatchObject({ text: 'Đi chợ', fillColor: noteAccent('yellow').fill });
    expect(strip(1)).toMatchObject({ fillColor: '#1E293B', color: '#ffffff' });
    expect(flat(doc.footer(2, 5))).toContain('2/5');
  });
});
