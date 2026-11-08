// Đặt trong api/_lib (thư mục "_") để Vercel không biến file test thành function
import { describe, expect, test } from 'vitest';
import { buildPreview, escapeHtml, renderSharePage } from './sharePage.js';

const TOKEN = 'b'.repeat(64);

describe('buildPreview', () => {
    test('ghép trạng thái, tiến độ việc nhỏ và mô tả', () => {
        const p = buildPreview({
            ok: true,
            task: { title: 'Nộp báo cáo', status: 'doing', description: 'Làm  phần 2', subtasks: [{ is_completed: true }, { is_completed: false }] },
        });
        expect(p.title).toBe('Nộp báo cáo');
        expect(p.description).toBe('Đang làm · 1/2 việc nhỏ — Làm phần 2');
    });
    test('link lỗi/hết hạn dùng nội dung chung, không lộ tiêu đề', () => {
        expect(buildPreview({ ok: false, reason: 'expired' }).title).toBe('Task trên SmartLife');
        expect(buildPreview(null).title).toBe('Task trên SmartLife');
    });
});

describe('renderSharePage', () => {
    test('escape HTML trong tiêu đề/mô tả để tránh chèn mã', () => {
        const html = renderSharePage({
            token: TOKEN,
            preview: { title: '<script>alert(1)</script>"', description: 'a & b' },
            baseUrl: 'https://x.vn',
        });
        expect(html).not.toContain('<script>alert(1)');
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('a &amp; b');
        expect(html).toContain(`location.replace("/#/t/${TOKEN}")`);
        expect(html).toContain('noindex');
    });
    test('escapeHtml', () => expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;'));
});
