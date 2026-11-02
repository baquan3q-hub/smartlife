// File: src/utils/stickyMarkdown.ts
// Tiện ích cho nội dung Sticky Notes dạng Markdown (GFM).
// Nội dung note lưu trong cột `content` dưới dạng Markdown. Note cũ (văn bản thuần) cũng được đọc như Markdown —
// chuỗi gốc chỉ thay đổi khi người dùng sửa note.

/** Tham chiếu tới ảnh lưu trên thiết bị (IndexedDB): sticky-img://<uuid> */
export const STICKY_IMG_SCHEME = 'sticky-img://';

const SAFE_LINK_PROTOCOLS = ['http:', 'https:', 'mailto:'];

/** Link an toàn để mở / xuất ra file. Trả về null nếu scheme không được phép (javascript:, data:, file:, ...). */
export function sanitizeHref(raw: string | null | undefined): string | null {
  const value = (raw || '').trim();
  if (!value) return null;
  // Tự thêm https:// cho dạng "example.com/abc"
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : /^[\w-]+(\.[\w-]+)+/.test(value) ? `https://${value}` : null;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return SAFE_LINK_PROTOCOLS.includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/** Nguồn ảnh được phép hiển thị: ảnh local của SmartLife, ảnh http(s), blob của chính trang. */
export function isAllowedImageSrc(src: string | null | undefined): boolean {
  const value = (src || '').trim();
  if (!value) return false;
  if (value.startsWith(STICKY_IMG_SCHEME)) return isValidImageId(value.slice(STICKY_IMG_SCHEME.length));
  return /^(https?:|blob:)/i.test(value);
}

export function isValidImageId(id: string): boolean {
  return /^[a-zA-Z0-9-]{8,64}$/.test(id);
}

/** Lấy id ảnh local (sticky-img://<id>) từ src, hoặc null. */
export function stickyImageId(src: string | null | undefined): string | null {
  const value = (src || '').trim();
  if (!value.startsWith(STICKY_IMG_SCHEME)) return null;
  const id = value.slice(STICKY_IMG_SCHEME.length);
  return isValidImageId(id) ? id : null;
}

/** Mọi id ảnh local được tham chiếu trong Markdown (không trùng, giữ thứ tự xuất hiện). */
export function extractStickyImageIds(markdown: string): string[] {
  const ids: string[] = [];
  const re = /sticky-img:\/\/([a-zA-Z0-9-]{8,64})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown || ''))) {
    if (!ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
}

/**
 * Markdown → văn bản thuần (dùng cho tìm kiếm, tiêu đề cửa sổ, preview danh sách).
 * Không cần chính xác tuyệt đối — chỉ bỏ cú pháp để người dùng đọc/tìm được.
 */
export function markdownToPlainText(markdown: string): string {
  if (!markdown) return '';
  return markdown
    .replace(/\r\n?/g, '\n')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt: string) => (alt ? `[${alt}]` : '[ảnh]'))
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .split('\n')
    // Dòng phân cách của bảng (| --- | :-: |)
    .filter(line => !/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line) || !line.includes('|'))
    .map(line => line
      .replace(/^\s{0,3}#{1,6}\s+/, '')
      .replace(/^\s*>\s?/, '')
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]\s+/, '')
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')
      .replace(/^\s*\|(.*)\|\s*$/, (_, cells: string) => cells.split(/(?<!\\)\|/).map(c => c.trim()).filter(Boolean).join(' · '))
      .replace(/^\s*([-*_])(\s*\1){2,}\s*$/, ''))
    .join('\n')
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?!\w)/g, '$1$2')
    .replace(/(^|[^\w_])_(?=\S)([^_\n]*?\S)_(?!\w)/g, '$1$2')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, '$1')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Dòng đầu tiên có chữ (đã bỏ cú pháp) — dùng làm tiêu đề khi note không có tiêu đề. */
export function firstLines(markdown: string, count = 2): string[] {
  return markdownToPlainText(markdown).split('\n').map(l => l.trim()).filter(Boolean).slice(0, count);
}

/** Tên file an toàn trên Windows/Android/iOS: bỏ dấu, bỏ ký tự cấm, tối đa 80 ký tự. */
export function safeFileName(name: string, fallback = 'ghi-chu'): string {
  const base = (name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[\\/:*?"<>|#%{}^~[\]`'\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80)
    .replace(/[-.]+$/g, '');
  const reserved = /^(con|prn|aux|nul|com\d|lpt\d)$/i;
  return base && !reserved.test(base) ? base : fallback;
}

/** Thêm hậu tố -2, -3... khi trùng tên (không phân biệt hoa thường, như Windows). */
export function uniqueFileName(name: string, ext: string, used: Set<string>): string {
  let candidate = `${name}.${ext}`;
  for (let i = 2; used.has(candidate.toLowerCase()); i++) candidate = `${name}-${i}.${ext}`;
  used.add(candidate.toLowerCase());
  return candidate;
}
