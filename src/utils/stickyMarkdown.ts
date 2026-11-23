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
  // Tự thêm https:// cho dạng "example.com/abc", "example.com:8080", "localhost:3000"
  // (kiểm tra trước scheme vì "host:port" trông giống scheme)
  const bareHost = /^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?([/?#]|$)/i.test(value);
  const candidate = bareHost ? `https://${value}` : /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : null;
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

const IMAGE_MD_RE = /!\[[^\]]*\]\([^)\s]*(?:\s+"[^"]*")?\)/g;

/** Thay ảnh bằng mã [[IMG_n]] trước khi gửi AI (đỡ tốn token, AI không làm hỏng đường dẫn ảnh). */
export function protectImages(markdown: string): { text: string; images: string[] } {
  const images: string[] = [];
  const text = (markdown || '').replace(IMAGE_MD_RE, (m) => `[[IMG_${images.push(m) - 1}]]`);
  return { text, images };
}

/** Đặt ảnh lại vào chỗ mã [[IMG_n]]; ảnh nào AI làm mất mã thì nối vào cuối — không bao giờ mất ảnh. */
export function restoreImages(text: string, images: string[]): string {
  const used = new Set<number>();
  let out = (text || '').replace(/\[\[IMG_(\d+)\]\]/g, (m, n: string) => {
    const i = Number(n);
    if (!images[i] || used.has(i)) return '';
    used.add(i);
    return images[i];
  });
  const missing = images.filter((_, i) => !used.has(i));
  if (missing.length) out = `${out.trimEnd()}\n\n${missing.join('\n\n')}`;
  return out;
}

/** Ảnh → "[ảnh]" (cho các tác vụ AI không cần ảnh). */
export function replaceImagesWithLabel(markdown: string): string {
  return (markdown || '').replace(IMAGE_MD_RE, '[ảnh]');
}

// Trình soạn thảo lưu "<" / ">" / "&" gõ trong chữ thành &lt; &gt; &amp; → giải mã khi hiển thị chữ thuần
const HTML_ENTITY_RE = /&(#\d+|#x[0-9a-f]+|lt|gt|amp|quot|apos|nbsp);/gi;
const NAMED_ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntity(match: string, name: string): string {
  if (name[0] !== '#') return NAMED_ENTITIES[name.toLowerCase()] ?? match;
  const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
}

// Thẻ HTML thô (trừ <br> do bảng sinh ra và autolink <https://…>, <a@b.com>)
const RAW_HTML_START_RE = /<(?=[a-z/!?])(?!br\s*\/?>)(?![a-z][a-z0-9+.-]*:[^\s<>]*>)(?![^\s<>@]+@[^\s<>]+>)/gi;

/**
 * Note văn bản thuần cũ có thể chứa "<Nam>", "<div>"… — Markdown hiểu là thẻ HTML và trình soạn thảo sẽ bỏ mất.
 * Chuyển "<" mở thẻ thành &lt; (ngoài khối code) để giữ nguyên dạng chữ. Ứng dụng không bao giờ tự sinh HTML thô
 * ngoài <br> trong ô bảng, nên không ảnh hưởng nội dung mới.
 */
export function escapeRawHtml(markdown: string): string {
  if (!markdown || !markdown.includes('<')) return markdown;
  let fence: { char: string; len: number } | null = null;
  return markdown.split('\n').map((line) => {
    const m = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (m) {
      if (!fence) fence = { char: m[1][0], len: m[1].length };
      else if (m[1][0] === fence.char && m[1].length >= fence.len) fence = null;
      return line;
    }
    if (fence) return line;
    return line.split(/(`[^`\n]*`)/).map((part, i) => (i % 2 ? part : part.replace(RAW_HTML_START_RE, '&lt;'))).join('');
  }).join('\n');
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
      .replace(/^\s*\|(.*)\|\s*$/, (_, cells: string) => cells.replace(/\\\|/g, '\u0000').split('|').map(c => c.trim().replace(/\u0000/g, '|')).filter(Boolean).join(' · '))
      .replace(/^\s*([-*_])(\s*\1){2,}\s*$/, ''))
    .join('\n')
    // Chỉ trong 1 dòng — tránh ghép nhầm "__" / "**" cách xa nhau trong note văn bản thuần cũ
    .replace(/(\*\*|__)(?=\S)([^\n]*?\S)\1/g, '$2')
    .replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?!\w)/g, '$1$2')
    .replace(/(^|[^\w_])_(?=\S)([^_\n]*?\S)_(?!\w)/g, '$1$2')
    .replace(/~~(?=\S)([^\n]*?\S)~~/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, '$1')
    .replace(HTML_ENTITY_RE, decodeEntity)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const plainCache = new Map<string, string>();

/**
 * Nội dung note có chứa `q` (đã lowercase) không — so cả chuỗi gốc (để tìm được URL trong link, `__init__`...)
 * lẫn văn bản đã bỏ cú pháp (để "đậm và" khớp "**đậm** và"). Kết quả bỏ cú pháp được cache theo nội dung.
 */
export function contentMatchesQuery(markdown: string, q: string): boolean {
  if (!q) return true;
  if (!markdown) return false;
  if (markdown.toLowerCase().includes(q)) return true;
  let plain = plainCache.get(markdown);
  if (plain === undefined) {
    plain = markdownToPlainText(markdown).toLowerCase();
    if (plainCache.size >= 500) plainCache.clear();
    plainCache.set(markdown, plain);
  }
  return plain.includes(q);
}

/** Dòng đầu tiên có chữ (đã bỏ cú pháp) — dùng làm tiêu đề khi note không có tiêu đề. */
export function firstLines(markdown: string, count = 2): string[] {
  return markdownToPlainText(markdown).split('\n').map(l => l.trim()).filter(Boolean).slice(0, count);
}

export interface NotePreviewTask { text: string; done: boolean }
export interface NotePreview {
  /** Dòng chữ thường (đã bỏ cú pháp, bỏ ảnh, bỏ dòng checklist) */
  lines: string[];
  /** Mọi dòng checklist theo thứ tự */
  tasks: NotePreviewTask[];
  hasTable: boolean;
  imageCount: number;
}

const TASK_LINE_RE = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.*)$/;
const TABLE_SEPARATOR_RE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/m;

/** Bản xem trước gọn cho danh sách ghi chú trên điện thoại. */
export function notePreview(markdown: string): NotePreview {
  const source = (markdown || '').replace(/\r\n?/g, '\n');
  const imageCount = (source.match(IMAGE_MD_RE) || []).length;
  const lines: string[] = [];
  const tasks: NotePreviewTask[] = [];
  for (const raw of source.replace(IMAGE_MD_RE, '').split('\n')) {
    const task = TASK_LINE_RE.exec(raw);
    if (task) {
      const text = markdownToPlainText(task[2]);
      if (text) tasks.push({ text, done: task[1] !== ' ' });
      continue;
    }
    if (/^\s{0,3}(`{3,}|~{3,})/.test(raw)) continue; // dòng mở/đóng khối code
    const text = markdownToPlainText(raw);
    if (text) lines.push(text);
  }
  return { lines, tasks, hasTable: TABLE_SEPARATOR_RE.test(source), imageCount };
}

/** Tên file an toàn trên Windows/Android/iOS: bỏ dấu, bỏ ký tự cấm, tối đa 80 ký tự. */
export function safeFileName(name: string, fallback = 'ghi-chu'): string {
  const base = (name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    // Chỉ giữ chữ, số và . _ - (bỏ ký tự cấm trên Windows, emoji, ký hiệu)
    .replace(/[^\p{L}\p{N}._ -]/gu, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80)
    .replace(/[-.]+$/g, '');
  // Windows cấm cả "aux.notes", "com1.txt"...
  const reserved = /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i;
  return base && !reserved.test(base) ? base : fallback;
}

/** Thêm hậu tố -2, -3... khi trùng tên (không phân biệt hoa thường, như Windows). */
export function uniqueFileName(name: string, ext: string, used: Set<string>): string {
  let candidate = `${name}.${ext}`;
  for (let i = 2; used.has(candidate.toLowerCase()); i++) candidate = `${name}-${i}.${ext}`;
  used.add(candidate.toLowerCase());
  return candidate;
}
