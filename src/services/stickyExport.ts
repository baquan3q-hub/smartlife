// File: src/services/stickyExport.ts
// Xuất Sticky Notes ra file:
// - Markdown: 1 note không có ảnh local → .md; có ảnh hoặc nhiều note → .zip (mỗi note 1 .md + thư mục images/)
// - PDF: 1 file cho 1 hay nhiều note (pdfmake tải lười — xem stickyPdf.ts)
// Ảnh local (sticky-img://) đọc từ IndexedDB của thiết bị này; ảnh không có trên máy → dòng ghi chú thay thế.

import { zipSync, strToU8 } from 'fflate';
import type { StickyNote } from './stickyNoteService';
import { stickyImageStore } from './stickyImageStore';
import { extractStickyImageIds, firstLines, safeFileName, uniqueFileName } from '../utils/stickyMarkdown';
import { saveFile } from '../utils/saveFile';

export type StickyExportFormat = 'markdown' | 'pdf';

export interface ExportFile { blob: Blob; filename: string }

/** Ảnh local đã đọc từ thiết bị. */
export interface ExportImage { blob: Blob; ext: string }
export type ImageLoader = (id: string) => Promise<ExportImage | null>;

export const MISSING_IMAGE_TEXT = 'Ảnh chỉ có trên thiết bị đã chèn';

const EXT_BY_MIME: Record<string, string> = {
  'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
};

export const loadLocalImage: ImageLoader = async (id) => {
  const blob = await stickyImageStore.getBlob(id).catch(() => null);
  return blob ? { blob, ext: EXT_BY_MIME[blob.type] || 'img' } : null;
};

/** Tiêu đề hiển thị: tiêu đề note, không có thì dòng đầu nội dung. */
export function noteDisplayTitle(note: Pick<StickyNote, 'title' | 'content'>): string {
  return note.title.trim() || firstLines(note.content, 1)[0]?.slice(0, 80) || 'Ghi chú';
}

const LOCAL_IMAGE_MD_RE = /!\[([^\]]*)\]\(sticky-img:\/\/([a-zA-Z0-9-]{8,64})(?:\s+"[^"]*")?\)/g;

/**
 * Markdown của 1 note: front-matter (tiêu đề, nhãn, màu, ngày) + tiêu đề + nội dung.
 * `imagePath(id)` = đường dẫn ảnh trong gói xuất, null = ảnh không có trên máy.
 */
export function noteToMarkdown(note: StickyNote, imagePath: (id: string) => string | null): string {
  const title = noteDisplayTitle(note);
  const front = [
    '---',
    `title: ${JSON.stringify(title)}`,
    ...(note.labels.length ? [`labels: ${JSON.stringify(note.labels)}`] : []),
    `color: ${note.color}`,
    `created: ${note.created_at}`,
    `updated: ${note.updated_at}`,
    '---',
  ].join('\n');
  const body = (note.content || '').replace(LOCAL_IMAGE_MD_RE, (_m, alt: string, id: string) => {
    const path = imagePath(id);
    if (path) return `![${alt}](${path})`;
    return `*[${alt ? `${alt} — ` : ''}${MISSING_IMAGE_TEXT}]*`;
  });
  return `${front}\n\n# ${title.replace(/\n/g, ' ')}\n\n${body.trim()}\n`;
}

function dateStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Tên file cho gói xuất: 1 note → theo tiêu đề; nhiều note → sticky-notes-<ngày>. */
export function exportBaseName(notes: StickyNote[]): string {
  return notes.length === 1 ? safeFileName(noteDisplayTitle(notes[0])) : `sticky-notes-${dateStamp()}`;
}

export async function buildMarkdownExport(notes: StickyNote[], loadImage: ImageLoader = loadLocalImage): Promise<ExportFile> {
  if (!notes.length) throw new Error('Chưa chọn ghi chú nào.');
  const ids = Array.from(new Set(notes.flatMap(n => extractStickyImageIds(n.content))));
  const loaded = await Promise.all(ids.map(async id => [id, await loadImage(id)] as const));
  const images = new Map(loaded.filter((e): e is readonly [string, ExportImage] => !!e[1]));
  const imagePath = (id: string) => {
    const img = images.get(id);
    return img ? `images/${id}.${img.ext}` : null;
  };
  const base = exportBaseName(notes);

  if (notes.length === 1 && images.size === 0) {
    return { blob: new Blob([noteToMarkdown(notes[0], imagePath)], { type: 'text/markdown;charset=utf-8' }), filename: `${base}.md` };
  }

  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {};
  const used = new Set<string>();
  for (const note of notes) {
    files[uniqueFileName(safeFileName(noteDisplayTitle(note)), 'md', used)] = strToU8(noteToMarkdown(note, imagePath));
  }
  for (const [id, img] of images) {
    // Ảnh đã nén sẵn → lưu nguyên, không nén lại
    files[`images/${id}.${img.ext}`] = [new Uint8Array(await img.blob.arrayBuffer()), { level: 0 }];
  }
  const zipped = zipSync(files, { level: 6 });
  return { blob: new Blob([zipped], { type: 'application/zip' }), filename: `${base}.zip` };
}

/** Tạo file rồi tải về / chia sẻ (mobile). PDF tải lười để không làm nặng bundle chính. */
export async function exportNotes(notes: StickyNote[], format: StickyExportFormat): Promise<void> {
  let file: ExportFile;
  if (format === 'pdf') {
    const { buildPdfExport } = await import('./stickyPdf');
    file = await buildPdfExport(notes);
  } else {
    file = await buildMarkdownExport(notes);
  }
  await saveFile(file.blob, file.filename);
}
