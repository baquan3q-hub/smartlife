// Đặt trong api/_lib (thư mục "_") để Vercel không biến file test thành function
import { describe, expect, test } from 'vitest';
import { ApiError } from './authKey.js';
import { formatApiError, keyErrorHelp, toolErrorText } from './apiErrorText.js';

const BOT = 'biến SMARTLIFE_API_KEY trên Vercel rồi Redeploy';
const missingScope = (scope) =>
    new ApiError(403, 'insufficient_scope', `API key is missing required scope: ${scope}`, scope ? { required_scope: scope } : undefined);

describe('lỗi tool gửi cho AI', () => {
    test('thiếu sticky:read → nêu tên quyền như trong Cài đặt, tạo key mới, không bảo thử lại', () => {
        const text = toolErrorText(missingScope('sticky:read'), BOT);
        expect(text).toContain('[403 insufficient_scope]');
        expect(text).toContain('"Đọc ghi chú dán" (sticky:read)');
        expect(text).toContain('tạo API key mới');
        expect(text).toContain('SMARTLIFE_API_KEY');
        expect(text).toContain('đừng bảo người dùng thử lại');
    });

    test('không biết tên quyền → không ra câu mơ hồ', () => {
        expect(keyErrorHelp(missingScope('x:y'))).toContain('"x:y"');
        expect(keyErrorHelp(missingScope(undefined))).toContain('có đủ quyền');
    });

    test('key hết hạn / bị thu hồi cũng có cách sửa', () => {
        expect(keyErrorHelp(new ApiError(401, 'expired_api_key', 'API key has expired'))).toContain('đã hết hạn');
        expect(keyErrorHelp(new ApiError(401, 'invalid_api_key', 'revoked'))).toContain('bị thu hồi');
    });

    test('lỗi thường giữ nguyên dạng ngắn', () => {
        const notFound = new ApiError(404, 'not_found', 'Sticky note not found');
        expect(toolErrorText(notFound, BOT)).toBe('[404 not_found] Sticky note not found');
        expect(keyErrorHelp(notFound)).toBeNull();
        expect(formatApiError(new Error('boom'))).toBe('Lỗi máy chủ');
    });
});
