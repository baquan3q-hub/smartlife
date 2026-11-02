// File: api/_lib/apiErrorText.js
// Lỗi tool trả về cho AI (bot Telegram, MCP). Lỗi do API key (thiếu quyền, key hết hạn / bị thu hồi)
// không tự hết khi thử lại → kèm cách sửa để AI nói rõ cho người dùng thay vì "thử lại sau".

import { ApiError } from './authKey.js';

// Tên quyền như trong Cài đặt → AI & API (src/components/settings/ApiKeysTab.tsx — đổi tên thì sửa cả 2 nơi)
export const SCOPE_NAMES = {
    'read:all': 'Đọc toàn bộ',
    'context:read': 'Đọc context',
    'tasks:read': 'Đọc task',
    'tasks:write': 'Ghi task',
    'finance:read': 'Đọc tài chính',
    'finance:write': 'Ghi giao dịch',
    'insights:write': 'Ghi lời khuyên',
    'sticky:read': 'Đọc ghi chú dán',
    'sticky:write': 'Ghi ghi chú dán',
};

const KEY_ERROR_CODES = new Set(['insufficient_scope', 'invalid_api_key', 'expired_api_key']);

/** Dạng ngắn cho log / debug: [403 insufficient_scope] API key is missing required scope: sticky:read */
export function formatApiError(err) {
    return err instanceof ApiError ? `[${err.status} ${err.code}] ${err.message}` : 'Lỗi máy chủ';
}

/** Lỗi do API key không tự hết khi thử lại. */
export function isKeyError(err) {
    return err instanceof ApiError && KEY_ERROR_CODES.has(err.code);
}

/**
 * Cách sửa lỗi API key bằng tiếng Việt, null nếu không phải lỗi key.
 * `keyLocation` = nơi đang đặt key (vd "biến SMARTLIFE_API_KEY trên Vercel rồi Redeploy").
 */
export function keyErrorHelp(err, keyLocation = 'cấu hình của ứng dụng đang dùng key') {
    if (!isKeyError(err)) return null;
    const replace = `rồi thay key cũ trong ${keyLocation}.`;
    if (err.code !== 'insufficient_scope') {
        const why = err.code === 'expired_api_key' ? 'đã hết hạn' : 'không hợp lệ hoặc đã bị thu hồi';
        return `API key ${why}. Cách sửa: mở SmartLife → Cài đặt → AI & API, tạo API key mới, ${replace}`;
    }
    const scope = err.extra?.required_scope;
    const name = SCOPE_NAMES[scope] ? `"${SCOPE_NAMES[scope]}" (${scope})` : scope ? `"${scope}"` : null;
    if (!name) return `API key thiếu quyền cho thao tác này. Cách sửa: mở SmartLife → Cài đặt → AI & API, tạo API key mới có đủ quyền, ${replace}`;
    // Key chỉ lưu hash, không sửa quyền được → phải tạo key mới
    return `API key chưa có quyền ${name}. Cách sửa: mở SmartLife → Cài đặt → AI & API, tạo API key mới có tích quyền ${name}, ${replace}`;
}

/** Nội dung lỗi gửi lại cho AI. */
export function toolErrorText(err, keyLocation) {
    const help = keyErrorHelp(err, keyLocation);
    if (!help) return formatApiError(err);
    return `${formatApiError(err)}. KHÔNG phải lỗi tạm thời — đừng bảo người dùng thử lại. Hãy nói rõ cho người dùng: ${help}`;
}
