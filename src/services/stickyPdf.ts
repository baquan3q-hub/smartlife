// File: src/services/stickyPdf.ts
// Xuất PDF (tải lười): Markdown của note → cây mdast (remark + GFM) → nội dung pdfmake.
// Kiểu trang: nền trắng, mỗi note mở đầu bằng dải màu của note chứa tiêu đề; chân trang có số trang.
// Ảnh local đổi sang JPEG (pdfmake không đọc được WebP); ảnh trên mạng không tải (riêng tư) → ghi link.

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Content as MdContent, ListItem, PhrasingContent, Root, RootContent, Table as MdTable } from 'mdast';
import type { Content, ContentText, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { StickyNote } from './stickyNoteService';
import { STICKY_THEME } from '../components/sticky/stickyTheme';
import { extractStickyImageIds, sanitizeHref, stickyImageId } from '../utils/stickyMarkdown';
import { ExportFile, ImageLoader, loadLocalImage, MISSING_IMAGE_TEXT, exportBaseName, noteDisplayTitle } from './stickyExport';

const PAGE_MARGIN = 40;
/** A4 rộng 595.28pt */
export const CONTENT_WIDTH = 595.28 - PAGE_MARGIN * 2;
const MAX_IMAGE_HEIGHT = 420;
const TEXT = '#1e293b';
const MUTED = '#64748b';
const LINK = '#4f46e5';

/** Ảnh đã chuẩn bị cho PDF. */
export interface PdfImage { dataUrl: string; width: number; height: number }
export type PdfImageMap = Map<string, PdfImage | null>;

/** Màu dải tiêu đề = màu thanh trên của note (bản sáng). */
export function noteAccent(color: StickyNote['color']): { fill: string; text: string } {
  const bar = (STICKY_THEME[color] || STICKY_THEME.yellow).bar;
  const fill = bar.match(/bg-\[(#[0-9a-fA-F]{6})\]/)?.[1] || '#FDE68A';
  return { fill, text: color === 'charcoal' ? '#ffffff' : TEXT };
}

const parser = unified().use(remarkParse).use(remarkGfm);

function checkbox(checked: boolean): Content {
  const box: any[] = [{ type: 'rect', x: 0, y: 2.5, w: 8, h: 8, r: 1.5, lineWidth: 0.8, lineColor: checked ? LINK : '#94a3b8', ...(checked ? { color: LINK } : {}) }];
  if (checked) box.push({ type: 'polyline', lineWidth: 1.2, lineColor: '#ffffff', points: [{ x: 1.8, y: 6.6 }, { x: 3.4, y: 8.3 }, { x: 6.4, y: 4.6 }] });
  return { canvas: box, width: 10 };
}

interface Ctx { images: PdfImageMap; depth: number }

type Inline = ContentText | string;

function inlines(nodes: PhrasingContent[], style: Partial<ContentText> = {}): Inline[] {
  const out: Inline[] = [];
  for (const n of nodes) {
    switch (n.type) {
      case 'text': out.push({ text: n.value, ...style }); break;
      case 'strong': out.push(...inlines(n.children, { ...style, bold: true })); break;
      case 'emphasis': out.push(...inlines(n.children, { ...style, italics: true })); break;
      case 'delete': out.push(...inlines(n.children, { ...style, decoration: 'lineThrough' })); break;
      case 'inlineCode': out.push({ text: n.value, ...style, background: '#f1f5f9', color: '#be185d' }); break;
      case 'break': out.push({ text: '\n', ...style }); break;
      case 'link': {
        const href = sanitizeHref(n.url);
        out.push(...inlines(n.children, href ? { ...style, link: href, color: LINK, decoration: 'underline' } : style));
        break;
      }
      // <br> trong ô bảng; HTML khác hiện nguyên văn (như khi xem trong app)
      case 'html': out.push({ text: /^<br\s*\/?>$/i.test(n.value.trim()) ? '\n' : n.value, ...style }); break;
      case 'image': out.push({ text: `[${n.alt || 'Ảnh'}]`, ...style, color: MUTED }); break;
      default: if ('value' in n && typeof (n as any).value === 'string') out.push({ text: (n as any).value, ...style });
    }
  }
  return out;
}

function imageBlock(url: string, alt: string | null | undefined, images: PdfImageMap): Content {
  const id = stickyImageId(url);
  const img = id ? images.get(id) : null;
  if (img) {
    const width = Math.min(CONTENT_WIDTH, img.width * 0.75);
    return { image: img.dataUrl, fit: [width, MAX_IMAGE_HEIGHT], margin: [0, 4, 0, 4] };
  }
  if (id) return { text: `[${alt ? `${alt} — ` : ''}${MISSING_IMAGE_TEXT}]`, italics: true, color: MUTED, margin: [0, 2, 0, 2] };
  const href = sanitizeHref(url);
  return { text: [{ text: `[Ảnh${alt ? `: ${alt}` : ''}] ` , color: MUTED }, ...(href ? [{ text: href, link: href, color: LINK }] : [])] };
}

/** Đoạn văn: chữ + ảnh (ảnh tách thành khối riêng). */
function paragraph(nodes: PhrasingContent[], ctx: Ctx, style: Partial<ContentText> = {}): Content[] {
  const blocks: Content[] = [];
  let run: PhrasingContent[] = [];
  const flush = () => {
    const text = inlines(run, style);
    if (text.some(t => (typeof t === 'string' ? t : String(t.text)).trim())) blocks.push({ text, margin: [0, 0, 0, 4] });
    run = [];
  };
  for (const n of nodes) {
    if (n.type === 'image') { flush(); blocks.push(imageBlock(n.url, n.alt, ctx.images)); }
    else run.push(n);
  }
  flush();
  return blocks;
}

function listItemBody(item: ListItem, ctx: Ctx, style: Partial<ContentText> = {}): Content {
  const stack = item.children.flatMap(child => (child.type === 'paragraph' ? paragraph(child.children, ctx, style) : block(child, ctx)));
  return stack.length === 1 ? stack[0] : { stack };
}

function list(node: Extract<RootContent, { type: 'list' }>, ctx: Ctx): Content {
  const inner = { ...ctx, depth: ctx.depth + 1 };
  const isTask = node.children.some(i => typeof i.checked === 'boolean');
  if (isTask) {
    return {
      stack: node.children.map((item): Content => {
        const done = item.checked === true;
        const body = listItemBody(item, inner, done ? { decoration: 'lineThrough', color: MUTED } : {});
        return typeof item.checked === 'boolean'
          ? { columns: [checkbox(done), { width: '*', stack: [body] }], columnGap: 5 }
          : { stack: [body], margin: [15, 0, 0, 0] };
      }),
      margin: [0, 0, 0, 4],
    };
  }
  const items = node.children.map(item => listItemBody(item, inner));
  return node.ordered
    ? { ol: items, start: node.start ?? 1, margin: [0, 0, 0, 4] }
    : { ul: items, margin: [0, 0, 0, 4] };
}

function table(node: MdTable): Content {
  const cols = Math.max(1, ...node.children.map(r => r.children.length));
  const body = node.children.map((row, r) => Array.from({ length: cols }, (_, c) => {
    const cell = row.children[c];
    const align = node.align?.[c];
    return {
      text: cell ? inlines(cell.children, r === 0 ? { bold: true } : {}) : '',
      ...(r === 0 ? { fillColor: '#f1f5f9' } : {}),
      ...(align ? { alignment: align } : {}),
    } as Content;
  }));
  return {
    table: { headerRows: 1, widths: Array(cols).fill('*'), body: body as any },
    layout: { hLineColor: () => '#cbd5e1', vLineColor: () => '#cbd5e1', hLineWidth: () => 0.6, vLineWidth: () => 0.6, paddingTop: () => 3, paddingBottom: () => 3 },
    margin: [0, 2, 0, 8],
  };
}

const HEADING_SIZE: Record<number, number> = { 1: 16, 2: 14, 3: 12.5 };

function block(node: RootContent | MdContent, ctx: Ctx): Content[] {
  switch (node.type) {
    case 'paragraph': return paragraph(node.children, ctx);
    case 'heading':
      return [{ text: inlines(node.children, { bold: true }), fontSize: HEADING_SIZE[node.depth] || 11.5, margin: [0, 6, 0, 4] }];
    case 'list': return [list(node, ctx)];
    case 'table': return [table(node)];
    case 'blockquote':
      return [{
        table: { widths: ['*'], body: [[{ stack: node.children.flatMap(c => block(c, ctx)), color: '#475569' }]] },
        layout: { hLineWidth: () => 0, vLineWidth: (i: number) => (i === 0 ? 2.5 : 0), vLineColor: () => '#cbd5e1', paddingLeft: () => 8, paddingTop: () => 0, paddingBottom: () => 0 },
        margin: [0, 0, 0, 6],
      }];
    case 'code':
      return [{
        table: { widths: ['*'], body: [[{ text: node.value, fontSize: 9, preserveLeadingSpaces: true }]] },
        layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => '#f1f5f9', paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 6, paddingBottom: () => 6 },
        margin: [0, 0, 0, 6],
      }];
    case 'thematicBreak':
      return [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 0.6, lineColor: '#cbd5e1' }], margin: [0, 6, 0, 8] }];
    case 'html': return [{ text: node.value, margin: [0, 0, 0, 4] }];
    case 'image': return [imageBlock(node.url, node.alt, ctx.images)];
    default:
      if ('children' in node && Array.isArray((node as any).children)) return (node as any).children.flatMap((c: RootContent) => block(c, ctx));
      return [];
  }
}

/** Nội dung Markdown → khối pdfmake. */
export function markdownToPdfContent(markdown: string, images: PdfImageMap = new Map()): Content[] {
  const tree = parser.runSync(parser.parse(markdown || '')) as Root;
  return tree.children.flatMap(n => block(n, { images, depth: 0 }));
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('vi-VN') : '';
}

/** Phần đầu note: dải màu chứa tiêu đề + dòng nhãn / ngày. */
function noteHeader(note: StickyNote): Content[] {
  const accent = noteAccent(note.color);
  const meta = [
    note.labels.map(l => `#${l}`).join('  '),
    `Cập nhật ${formatDate(note.updated_at)}`,
  ].filter(Boolean).join('   ·   ');
  return [
    {
      table: { widths: ['*'], body: [[{ text: noteDisplayTitle(note), bold: true, fontSize: 15, color: accent.text, fillColor: accent.fill }]] },
      layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 12, paddingRight: () => 12, paddingTop: () => 9, paddingBottom: () => 9 },
    },
    { text: meta, fontSize: 8.5, color: MUTED, margin: [2, 5, 0, 12] },
  ];
}

export function buildDocDefinition(notes: StickyNote[], images: PdfImageMap = new Map()): TDocumentDefinitions {
  const content: Content[] = notes.map((note, i) => ({
    stack: [...noteHeader(note), ...markdownToPdfContent(note.content, images)],
    ...(i > 0 ? { pageBreak: 'before' as const } : {}),
  }));
  return {
    pageSize: 'A4',
    pageMargins: [PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN + 10],
    info: { title: notes.length === 1 ? noteDisplayTitle(notes[0]) : 'Sticky Notes', creator: 'SmartLife' },
    defaultStyle: { font: 'Roboto', fontSize: 10.5, lineHeight: 1.3, color: TEXT },
    footer: (page, pages) => ({
      columns: [
        { text: 'SmartLife · Sticky Notes', color: '#94a3b8' },
        { text: `${page}/${pages}`, alignment: 'right', color: '#94a3b8' },
      ],
      fontSize: 8,
      margin: [PAGE_MARGIN, 14, PAGE_MARGIN, 0],
    }),
    content,
  };
}

/** Ảnh local → JPEG nền trắng (pdfmake chỉ đọc JPEG/PNG). */
async function toPdfImage(blob: Blob): Promise<PdfImage | null> {
  try {
    const bmp = await createImageBitmap(blob);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bmp, 0, 0);
      return { dataUrl: canvas.toDataURL('image/jpeg', 0.88), width: bmp.width, height: bmp.height };
    } finally {
      bmp.close();
    }
  } catch {
    return null;
  }
}

let pdfMakePromise: Promise<typeof import('pdfmake/build/pdfmake')> | null = null;
function loadPdfMake() {
  pdfMakePromise ??= Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]).then(([mod, fonts]) => {
    const pdfMake = ((mod as any).default || mod) as typeof import('pdfmake/build/pdfmake');
    pdfMake.addVirtualFileSystem(((fonts as any).default || fonts) as any);
    return pdfMake;
  }).catch((err) => { pdfMakePromise = null; throw err; });
  return pdfMakePromise;
}

export async function buildPdfExport(notes: StickyNote[], loadImage: ImageLoader = loadLocalImage): Promise<ExportFile> {
  if (!notes.length) throw new Error('Chưa chọn ghi chú nào.');
  const ids = Array.from(new Set(notes.flatMap(n => extractStickyImageIds(n.content))));
  const images: PdfImageMap = new Map();
  // Tuần tự: mỗi ảnh giải mã ra canvas khá tốn bộ nhớ trên điện thoại
  for (const id of ids) {
    const img = await loadImage(id);
    images.set(id, img ? await toPdfImage(img.blob) : null);
  }
  const pdfMake = await loadPdfMake();
  const blob = await pdfMake.createPdf(buildDocDefinition(notes, images)).getBlob();
  return { blob, filename: `${exportBaseName(notes)}.pdf` };
}
