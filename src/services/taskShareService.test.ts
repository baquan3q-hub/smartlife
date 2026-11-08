import { describe, expect, test, vi } from 'vitest';

// Không cần Supabase thật cho các hàm thuần
vi.mock('./supabase', () => ({ supabase: {} }));

const { buildShareUrl } = await import('./taskShareService');

const TOKEN = 'a'.repeat(64);

describe('buildShareUrl', () => {
  test('ghép đúng dạng /t/<token>', () => {
    expect(buildShareUrl(TOKEN, 'https://smartlife.vn')).toBe(`https://smartlife.vn/t/${TOKEN}`);
  });

  test('bỏ dấu / thừa ở cuối domain', () => {
    expect(buildShareUrl(TOKEN, 'https://smartlife.vn///')).toBe(`https://smartlife.vn/t/${TOKEN}`);
  });
});
