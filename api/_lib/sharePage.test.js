// Đặt trong api/_lib (thư mục "_") để Vercel không biến file test thành function
import { describe, expect, test } from 'vitest';
import { buildPreview, escapeHtml, readSafeLinks, renderSharePage, safeHttpUrl } from './sharePage.js';

const TOKEN = 'b'.repeat(64);
const render = (result) => renderSharePage({ token: TOKEN, result, baseUrl: 'https://x.vn' });

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

describe('safeHttpUrl', () => {
    test('thêm https:// khi thiếu scheme, giữ nguyên http(s)', () => {
        expect(safeHttpUrl('example.com/a')).toBe('https://example.com/a');
        expect(safeHttpUrl('http://example.com/')).toBe('http://example.com/');
    });

    test.each(['javascript:alert(1)', 'JaVaScript:alert(1)', 'data:text/html,<script>', 'file:///etc/passwd', ''])(
        'chặn %s',
        (raw) => expect(safeHttpUrl(raw)).toBeNull()
    );
});

describe('readSafeLinks', () => {
    test('đọc JSON array và loại link nguy hiểm', () => {
        const links = readSafeLinks(JSON.stringify([
            { name: 'Tài liệu', url: 'docs.google.com/x' },
            { name: 'Xấu', url: 'javascript:alert(1)' },
        ]));
        expect(links).toEqual([{ name: 'Tài liệu', href: 'https://docs.google.com/x' }]);
    });

    test('tương thích chuỗi URL đơn kiểu cũ, và chuỗi rỗng', () => {
        expect(readSafeLinks('https://example.com/')).toEqual([{ name: 'https://example.com/', href: 'https://example.com/' }]);
        expect(readSafeLinks(null)).toEqual([]);
        expect(readSafeLinks('   ')).toEqual([]);
    });
});

describe('renderSharePage', () => {
    const task = {
        ok: true,
        task: {
            title: 'Nộp báo cáo', status: 'doing', priority: 'urgent',
            description: 'Dòng 1\nDòng 2', deadline: '2026-12-01T03:00:00Z',
            subtasks: [{ title: 'Phần A', is_completed: true }, { title: 'Phần B', is_completed: false }],
            attach_link: JSON.stringify([{ name: 'Drive', url: 'drive.google.com/f' }]),
            owner_name: 'Quân',
        },
    };

    test('vẽ sẵn nội dung task trong HTML, không cần JavaScript', () => {
        const html = render(task);
        expect(html).toContain('Nộp báo cáo');
        expect(html).toContain('Đang làm');
        expect(html).toContain('Khẩn cấp');
        expect(html).toContain('Phần A');
        expect(html).toContain('https://drive.google.com/f');
        expect(html).toContain('Chia sẻ bởi <b>Quân</b>');
        expect(html).toContain('Việc nhỏ (1/2)');
        // Không có <script> nào: webview Zalo chặn/không chạy JS vẫn hiện đủ nội dung
        expect(html).not.toContain('<script');
        expect(html).not.toContain('location.replace');
    });

    test('không đặt noindex để Zalo/Facebook tạo được thẻ xem trước', () => {
        expect(render(task)).not.toContain('noindex');
    });

    test('escape HTML trong dữ liệu người dùng để tránh chèn mã', () => {
        const html = render({ ok: true, task: { title: '<img src=x onerror=alert(1)>', status: 'todo' } });
        expect(html).not.toContain('<img src=x');
        expect(html).toContain('&lt;img src=x');
    });

    test('link hỏng/hết hạn hiện thông báo, không lộ nội dung', () => {
        expect(render({ ok: false, reason: 'expired' })).toContain('Link đã hết hạn');
        expect(render({ ok: false, reason: 'not_found' })).toContain('Không tìm thấy task');
        expect(render(null)).toContain('Không tải được task');
    });

    test('escapeHtml', () => expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;'));
});
