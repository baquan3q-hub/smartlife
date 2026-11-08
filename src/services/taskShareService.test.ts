import { describe, expect, test, vi } from 'vitest';

// Không cần Supabase thật cho các hàm thuần
vi.mock('./supabase', () => ({ supabase: {} }));

const { buildShareUrl, getSafeSharedLinks, isValidShareToken, parseShareHash, toSafeHttpUrl } =
  await import('./taskShareService');

const TOKEN = 'a'.repeat(64);

describe('token & url', () => {
  test('token hợp lệ là 64 ký tự hex thường', () => {
    expect(isValidShareToken(TOKEN)).toBe(true);
    expect(isValidShareToken('A'.repeat(64))).toBe(false);
    expect(isValidShareToken('abc')).toBe(false);
    expect(isValidShareToken(`${TOKEN}x`)).toBe(false);
  });

  test('buildShareUrl bỏ dấu / thừa ở cuối domain', () => {
    expect(buildShareUrl(TOKEN, 'https://smartlife.vn/')).toBe(`https://smartlife.vn/t/${TOKEN}`);
  });

  test('parseShareHash chỉ nhận #/t/<token>', () => {
    expect(parseShareHash(`#/t/${TOKEN}`)).toBe(TOKEN);
    expect(parseShareHash(`#/t/${TOKEN}?x=1`)).toBe(TOKEN);
    expect(parseShareHash('#/focus')).toBeNull();
    expect(parseShareHash('#/t/')).toBeNull();
    expect(parseShareHash('')).toBeNull();
  });
});

describe('toSafeHttpUrl', () => {
  test('thêm https:// khi thiếu scheme', () => {
    expect(toSafeHttpUrl('example.com/a')).toBe('https://example.com/a');
  });
  test('giữ nguyên http(s)', () => {
    expect(toSafeHttpUrl('http://example.com/')).toBe('http://example.com/');
  });
  test.each(['javascript:alert(1)', 'JaVaScript:alert(1)', 'data:text/html,<script>', 'file:///etc/passwd', 'vbscript:x', ''])(
    'chặn %s',
    (raw) => expect(toSafeHttpUrl(raw)).toBeNull()
  );
});

describe('getSafeSharedLinks', () => {
  test('lọc link nguy hiểm, giữ link hợp lệ (cả định dạng URL đơn cũ)', () => {
    const json = JSON.stringify([
      { id: '1', name: 'Tài liệu', url: 'docs.google.com/x' },
      { id: '2', name: 'Xấu', url: 'javascript:alert(1)' },
    ]);
    const links = getSafeSharedLinks(json);
    expect(links).toHaveLength(1);
    expect(links[0].href).toBe('https://docs.google.com/x');
    expect(getSafeSharedLinks('https://example.com')).toHaveLength(1);
    expect(getSafeSharedLinks(null)).toEqual([]);
  });
});
