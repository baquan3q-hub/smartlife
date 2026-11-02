import { describe, expect, test } from 'vitest';
import {
  contentMatchesQuery, extractStickyImageIds, isAllowedImageSrc, markdownToPlainText, safeFileName, sanitizeHref, stickyImageId, uniqueFileName,
} from './stickyMarkdown';

describe('sanitizeHref', () => {
  test('cho phép http, https, mailto', () => {
    expect(sanitizeHref('https://a.com/x?y=1')).toBe('https://a.com/x?y=1');
    expect(sanitizeHref('http://a.com')).toBe('http://a.com/');
    expect(sanitizeHref('mailto:a@b.com')).toBe('mailto:a@b.com');
  });
  test('tự thêm https:// cho tên miền trần', () => {
    expect(sanitizeHref('smartlife.courses/abc')).toBe('https://smartlife.courses/abc');
  });
  test('chặn scheme nguy hiểm', () => {
    for (const bad of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'data:text/html,<b>', 'file:///C:/x', 'vbscript:x', '', 'just text']) {
      expect(sanitizeHref(bad)).toBeNull();
    }
  });
});

describe('ảnh local', () => {
  test('nhận diện sticky-img://', () => {
    expect(isAllowedImageSrc('sticky-img://0b6f1c2e-1111-4a4a-9999-123456789abc')).toBe(true);
    expect(stickyImageId('sticky-img://0b6f1c2e-1111-4a4a-9999-123456789abc')).toBe('0b6f1c2e-1111-4a4a-9999-123456789abc');
    expect(isAllowedImageSrc('sticky-img://../../etc')).toBe(false);
    expect(isAllowedImageSrc('javascript:alert(1)')).toBe(false);
    expect(isAllowedImageSrc('data:image/png;base64,AAA')).toBe(false);
    expect(isAllowedImageSrc('https://x.com/a.png')).toBe(true);
  });
  test('liệt kê id ảnh không trùng', () => {
    const md = '![a](sticky-img://aaaaaaaa-1) chữ ![b](sticky-img://bbbbbbbb-2)\n![a lại](sticky-img://aaaaaaaa-1)';
    expect(extractStickyImageIds(md)).toEqual(['aaaaaaaa-1', 'bbbbbbbb-2']);
  });
});

describe('markdownToPlainText', () => {
  test('bỏ cú pháp nhưng giữ chữ', () => {
    const md = '# Tiêu đề\n\n**Đậm** và *nghiêng*, [link](https://a.com)\n\n- [ ] việc 1\n- [x] việc 2\n1. số một\n> trích dẫn';
    expect(markdownToPlainText(md)).toBe('Tiêu đề\n\nĐậm và nghiêng, link\n\nviệc 1\nviệc 2\nsố một\ntrích dẫn');
  });
  test('bảng → các ô nối bằng ·, bỏ dòng phân cách', () => {
    expect(markdownToPlainText('| a | b |\n| --- | :-: |\n| 1 | 2 |')).toBe('a · b\n1 · 2');
    expect(markdownToPlainText('Trên\n\n---\n\nDưới')).toBe('Trên\n\nDưới');
  });
  test('ảnh → [mô tả]', () => {
    expect(markdownToPlainText('Xem ![sơ đồ](sticky-img://aaaaaaaa-1) nhé')).toBe('Xem [sơ đồ] nhé');
    expect(markdownToPlainText('![](sticky-img://aaaaaaaa-1)')).toBe('[ảnh]');
  });
  test('văn bản thuần cũ giữ nguyên', () => {
    const plain = 'Mua sữa\nGọi mẹ lúc 8h\n\n5 * 3 = 15, file_name_v2';
    expect(markdownToPlainText(plain)).toBe(plain);
  });
  test('bỏ ký tự escape', () => {
    expect(markdownToPlainText('5 \\* 3 \\# không phải tiêu đề')).toBe('5 * 3 # không phải tiêu đề');
  });
});

describe('tên file', () => {
  test('bỏ dấu và ký tự cấm', () => {
    expect(safeFileName('Kế hoạch: tuần 1/2 *quan trọng*?')).toBe('Ke-hoach-tuan-1-2-quan-trong');
    expect(safeFileName('Đi chợ')).toBe('Di-cho');
    expect(safeFileName('   ')).toBe('ghi-chu');
    expect(safeFileName('CON')).toBe('ghi-chu');
    expect(safeFileName('a'.repeat(200)).length).toBe(80);
  });
  test('chống trùng tên', () => {
    const used = new Set<string>();
    expect(uniqueFileName('note', 'md', used)).toBe('note.md');
    expect(uniqueFileName('Note', 'md', used)).toBe('Note-2.md');
    expect(uniqueFileName('note', 'md', used)).toBe('note-3.md');
  });
});

describe('sửa theo code review', () => {
  test('host:port và localhost được thêm https://', () => {
    expect(sanitizeHref('myserver.com:8080/dashboard')).toBe('https://myserver.com:8080/dashboard');
    expect(sanitizeHref('localhost:5173')).toBe('https://localhost:5173/');
    expect(sanitizeHref('javascript:alert(1)')).toBeNull();
  });
  test('tìm được URL trong link và chữ đã bỏ cú pháp', () => {
    const md = '**Đậm** và [tài liệu](https://drive.google.com/abc) __init__.py';
    expect(contentMatchesQuery(md, 'drive.google')).toBe(true);
    expect(contentMatchesQuery(md, 'đậm và')).toBe(true);
    expect(contentMatchesQuery(md, '__init__')).toBe(true);
    expect(contentMatchesQuery(md, 'không có')).toBe(false);
  });
  test('không ghép "__" khác dòng', () => {
    expect(markdownToPlainText('file__a\nb__c')).toBe('file__a\nb__c');
  });
  test('ô bảng có \\| giữ nguyên dấu |', () => {
    expect(markdownToPlainText('| a \\| b | c |')).toBe('a | b · c');
  });
  test('tên thiết bị Windows kèm đuôi', () => {
    expect(safeFileName('aux.notes')).toBe('ghi-chu');
    expect(safeFileName('auxiliary')).toBe('auxiliary');
  });
  test('không dùng regex lookbehind (Safari < 16.4 lỗi cú pháp)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('./stickyMarkdown.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/\(\?<[!=]/);
  });
});
