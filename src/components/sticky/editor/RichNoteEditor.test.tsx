// @vitest-environment jsdom
// Bảo toàn dữ liệu: mở note / nhận nội dung từ ngoài không được tạo lượt lưu; sửa thật thì lưu Markdown.
import { afterEach, describe, expect, test, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Editor } from '@tiptap/core';
import 'fake-indexeddb/auto';
import { renderToStaticMarkup } from 'react-dom/server';
import { stickyImageStore } from '../../../services/stickyImageStore';

// jsdom không có canvas → giả lập bước nén
vi.mock('../../../utils/stickyImageCompress', async (orig) => ({
  ...(await orig<typeof import('../../../utils/stickyImageCompress')>()),
  compressImage: vi.fn(async (file: Blob) => ({ blob: new Blob([await file.arrayBuffer()], { type: 'image/webp' }), width: 4, height: 3 })),
}));
import { compressImage, MAX_IMAGES_PER_NOTE } from '../../../utils/stickyImageCompress';
import RichNoteEditor from './RichNoteEditor';
import { StickyMarkdownView } from '../StickyMarkdownView';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom không có layout — ProseMirror cần khi cuộn tới con trỏ (autofocus)
const emptyRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
for (const proto of [Element.prototype, Range.prototype] as any[]) {
  proto.getClientRects ??= emptyRects;
  proto.getBoundingClientRect ??= () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) });
}

/** Đợi tới khi điều kiện đúng (IndexedDB/nén ảnh chạy bất đồng bộ — máy chậm cần lâu hơn). */
const until = async (check: () => void) => {
  for (const end = Date.now() + 5000; ;) {
    // Mỗi bước act ngắn để React kịp cập nhật giao diện rồi mới kiểm tra
    await act(() => new Promise(r => setTimeout(r, 10)));
    try { check(); return; } catch (e) { if (Date.now() > end) throw e; }
  }
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function mount(value: string, onChange = vi.fn(), variant: 'card' | 'window' = 'card') {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const render = (v: string) => act(() => { root!.render(<RichNoteEditor variant={variant} value={v} onChange={onChange} />); });
  render(value);
  const editor = (host.querySelector('.ProseMirror') as any).editor as Editor;
  return { onChange, editor, render, host };
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe('RichNoteEditor', () => {
  test('mở note văn bản thuần cũ: không lưu, xuống dòng giữ nguyên', () => {
    const legacy = 'Mua sữa\nGọi mẹ lúc 8h\n\n5 * 3 = 15\n- việc a';
    const { onChange, editor } = mount(legacy);
    act(() => { editor.commands.focus(); editor.commands.blur(); });
    expect(onChange).not.toHaveBeenCalled();
    expect(editor.getHTML()).toContain('Mua sữa\nGọi mẹ lúc 8h');
  });

  test('cửa sổ nổi tự focus khi mở: không lưu', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const onChange = vi.fn();
    act(() => { root!.render(<RichNoteEditor variant="window" autoFocus value={'Việc:\n- a\n\n| x | y |\n| - | - |\n| 1 | 2 |'} onChange={onChange} />); });
    await act(() => new Promise(r => setTimeout(r, 20)));
    expect(onChange).not.toHaveBeenCalled();
  });

  test('nội dung từ máy khác: nạp lại, không lưu ngược', () => {
    const { onChange, editor, render } = mount('bản cũ');
    render('**bản mới** từ điện thoại');
    expect(onChange).not.toHaveBeenCalled();
    expect(editor.getHTML()).toContain('<strong>bản mới</strong>');
  });

  test('gõ chữ → lưu Markdown', () => {
    const { onChange, editor } = mount('Xin chào');
    act(() => { editor.chain().focus('end').insertContent(' bạn').run(); });
    expect(onChange).toHaveBeenLastCalledWith('Xin chào bạn');
    act(() => { editor.chain().selectAll().toggleBold().run(); });
    expect(onChange).toHaveBeenLastCalledWith('**Xin chào bạn**');
  });

  test('bảng + checklist ra GFM', () => {
    const { onChange, editor } = mount('');
    act(() => { editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).insertContent('A').run(); });
    const md = onChange.mock.calls.at(-1)?.[0] as string;
    expect(md).toMatch(/^\| A\s*\|/);
    expect(md).toBe(md.trim());
    expect(md).toContain('| ---');
  });

  test('note cũ có "<…>": giữ chữ, chụp phiên bản trước lần lưu đầu (1 lần)', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const onChange = vi.fn();
    const onLegacyRewrite = vi.fn();
    act(() => { root!.render(<RichNoteEditor variant="card" value={'Gửi <Nam>\n<div>x</div>'} onChange={onChange} onLegacyRewrite={onLegacyRewrite} />); });
    const editor = (host.querySelector('.ProseMirror') as any).editor as Editor;
    expect(editor.getText()).toContain('Gửi <Nam>');
    expect(editor.getText()).toContain('<div>x</div>');
    act(() => { editor.chain().focus('end').insertContent('!').run(); });
    act(() => { editor.chain().focus('end').insertContent('?').run(); });
    expect(onLegacyRewrite).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls.at(-1)?.[0]).toContain('&lt;Nam&gt;');
  });

  test('note do trình soạn thảo lưu: không chụp phiên bản', () => {
    const onLegacyRewrite = vi.fn();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => { root!.render(<RichNoteEditor variant="card" value={'**Đậm** và [a](https://a.com)'} onChange={vi.fn()} onLegacyRewrite={onLegacyRewrite} />); });
    const editor = (host.querySelector('.ProseMirror') as any).editor as Editor;
    act(() => { editor.chain().focus('end').insertContent('!').run(); });
    expect(onLegacyRewrite).not.toHaveBeenCalled();
  });

  test('<br> trong ô bảng nạp lại thành xuống dòng', () => {
    const { editor } = mount('| a |\n| - |\n| 2<br>x |');
    expect(editor.getHTML()).not.toContain('&lt;br');
    expect(editor.getText()).toContain('x');
  });

  test('rời ô link ra ngoài → hết trạng thái đang sửa', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const outside = document.createElement('input');
    document.body.appendChild(outside);
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    act(() => { root!.render(<RichNoteEditor variant="window" value="chữ" onChange={vi.fn()} onFocus={onFocus} onBlur={onBlur} />); });
    const editor = (host.querySelector('.ProseMirror') as any).editor as Editor;
    act(() => { (editor.view.dom as HTMLElement).focus(); });
    act(() => { editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })); });
    const linkInput = host.querySelector('input[aria-label="Địa chỉ link"]') as HTMLInputElement;
    expect(linkInput).toBeTruthy();
    act(() => { linkInput.focus(); });
    expect(onBlur).not.toHaveBeenCalled();
    act(() => { outside.focus(); });
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(host.querySelector('input[aria-label="Địa chỉ link"]')).toBeNull();
    outside.remove();
  });

  test('xem chỉ đọc: HTML thô hiện thành chữ, <br> thành xuống dòng', () => {
    const html = renderToStaticMarkup(<StickyMarkdownView markdown={'Gửi <Nam> nhé\n\n<div>x</div>\n\n| a |\n| - |\n| 2<br>y |'} />);
    expect(html).toContain('Gửi &lt;Nam&gt; nhé');
    expect(html).toContain('&lt;div&gt;x&lt;/div&gt;');
    expect(html).toMatch(/2<br\/?>\s*y/);
    expect(html).not.toContain('<div>x');
  });

  test('ảnh local: Markdown giữ nguyên, máy khác thấy ô thay thế, không tự lưu', async () => {
    const md = 'Trước\n\n![](sticky-img://aaaaaaaa-1111)\n\nSau';
    const { onChange, editor, host: h } = mount(md);
    expect(editor.getMarkdown().trim()).toBe(md);
    await until(() => expect(h.textContent).toContain('Ảnh chỉ có trên thiết bị đã chèn'));
    expect(h.textContent).toContain('Ảnh chỉ có trên thiết bị đã chèn');
    expect(onChange).not.toHaveBeenCalled();
  });

  test('chọn ảnh → lưu IndexedDB, chèn sticky-img://, hiển thị được', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const onChange = vi.fn();
    act(() => { root!.render(<RichNoteEditor variant="window" value="Ghi chú" onChange={onChange} imageScope={{ userId: 'u1', noteId: 'n1' }} />); });
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    const file = new File([new Uint8Array([1, 2, 3])], 'chup.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    act(() => { input.dispatchEvent(new Event('change', { bubbles: true })); });
    await until(() => expect(onChange).toHaveBeenCalled());
    const md = onChange.mock.calls.at(-1)?.[0] as string;
    const id = md.match(/sticky-img:\/\/([a-zA-Z0-9-]+)/)?.[1];
    expect(id).toBeTruthy();
    expect(await stickyImageStore.get(id!)).toMatchObject({ user_id: 'u1', note_id: 'n1', width: 4, height: 3 });
    await until(() => expect(host!.querySelector('.sticky-image-node img')?.getAttribute('src')).toMatch(/^blob:/));
  });

  test('đổi sang note khác khi ảnh đang nén → không chèn vào note mới', async () => {
    let finish!: () => void;
    vi.mocked(compressImage).mockImplementationOnce(() => new Promise(r => {
      finish = () => r({ blob: new Blob([new Uint8Array([1])], { type: 'image/webp' }), width: 1, height: 1 });
    }));
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const onChange = vi.fn();
    const renderNote = (noteId: string, value: string) => act(() => {
      root!.render(<RichNoteEditor variant="window" value={value} onChange={onChange} imageScope={{ userId: 'u1', noteId }} />);
    });
    renderNote('A', 'Note A');
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new File([new Uint8Array([1])], 'a.png', { type: 'image/png' })], configurable: true });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
    renderNote('B', 'Note B');
    expect(host.textContent).toContain('Đang xử lý ảnh');
    act(() => { finish(); });
    await until(() => expect(host!.textContent).not.toContain('Đang xử lý ảnh'));
    const editor = (host.querySelector('.ProseMirror') as any).editor as Editor;
    expect(editor.getMarkdown()).not.toContain('sticky-img://');
    expect(onChange).not.toHaveBeenCalled();
  });

  test('dán liên tiếp khi đang xử lý vẫn không vượt giới hạn ảnh', async () => {
    const existing = Array.from({ length: MAX_IMAGES_PER_NOTE - 1 }, (_, i) => `![](sticky-img://img-${i}-aaaa)`).join('\n\n');
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const onChange = vi.fn();
    act(() => { root!.render(<RichNoteEditor variant="window" value={existing} onChange={onChange} imageScope={{ userId: 'u1', noteId: 'n1' }} />); });
    const input = host.querySelector('input[type="file"]') as HTMLInputElement;
    const pick = () => {
      Object.defineProperty(input, 'files', { value: [new File([new Uint8Array([1])], 'x.png', { type: 'image/png' })], configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    act(() => { pick(); pick(); });
    await until(() => expect(onChange).toHaveBeenCalled());
    const md = onChange.mock.calls.at(-1)?.[0] as string;
    expect(md.match(/sticky-img:\/\//g)).toHaveLength(MAX_IMAGES_PER_NOTE);
    expect(host.textContent).toContain(`tối đa ${MAX_IMAGES_PER_NOTE} ảnh`);
  });

  test('không có imageScope (chỉ đọc) → không có ô chọn ảnh', () => {
    const { host: h } = mount('x');
    expect(h.querySelector('input[type="file"]')).toBeNull();
  });

  test('link nguy hiểm không được tạo', () => {
    const { editor } = mount('chữ');
    act(() => { editor.chain().focus().selectAll().setLink({ href: 'javascript:alert(1)' }).run(); });
    expect(editor.getHTML()).not.toContain('javascript:');
  });
});
