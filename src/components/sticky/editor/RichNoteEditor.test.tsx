// @vitest-environment jsdom
// Bảo toàn dữ liệu: mở note / nhận nội dung từ ngoài không được tạo lượt lưu; sửa thật thì lưu Markdown.
import { afterEach, describe, expect, test, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Editor } from '@tiptap/core';
import RichNoteEditor from './RichNoteEditor';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

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

  test('link nguy hiểm không được tạo', () => {
    const { editor } = mount('chữ');
    act(() => { editor.chain().focus().selectAll().setLink({ href: 'javascript:alert(1)' }).run(); });
    expect(editor.getHTML()).not.toContain('javascript:');
  });
});
