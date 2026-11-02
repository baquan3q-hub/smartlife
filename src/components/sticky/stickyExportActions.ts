// File: src/components/sticky/stickyExportActions.ts
// Phần dùng chung cho nút xuất file (thẻ note, bảng Sticky Notes, cửa sổ nổi).
// Module xuất (fflate, pdfmake…) chỉ tải khi bấm xuất.

import { FileDown, FileText } from 'lucide-react';
import type { StickyNote } from '../../services/stickyNoteService';
import type { StickyExportFormat } from '../../services/stickyExport';

export const EXPORT_FORMATS = [
  { format: 'markdown', label: 'Markdown', icon: FileText },
  { format: 'pdf', label: 'PDF', icon: FileDown },
] as const satisfies readonly { format: StickyExportFormat; label: string; icon: unknown }[];

/** `busy` = thông báo tiến trình, giữ tới khi có kết quả. */
export interface ExportMessage { text: string; error?: boolean; busy?: boolean }

let running = false;

/**
 * Xuất note + báo trạng thái qua `notify`. Mỗi lần chỉ 1 lượt xuất (bấm lặp sẽ bị bỏ qua).
 * Trả về true nếu đã xuất xong.
 */
export async function runStickyExport(
  notes: StickyNote[],
  format: StickyExportFormat,
  notify: (msg: ExportMessage) => void,
): Promise<boolean> {
  if (!notes.length || running) return false;
  running = true;
  notify({ text: format === 'pdf' ? 'Đang tạo PDF…' : 'Đang tạo file Markdown…', busy: true });
  try {
    const { exportNotes } = await import('../../services/stickyExport');
    const file = await exportNotes(notes, format);
    const done = `Đã xuất ${notes.length} ghi chú ra ${format === 'pdf' ? 'PDF' : 'Markdown'}.`;
    notify({ text: file.notice ? `${done} ${file.notice}` : done });
    return true;
  } catch (err) {
    console.error('[sticky] export failed', err);
    notify({ text: `Xuất file thất bại: ${(err as Error)?.message || 'lỗi không xác định'}`, error: true });
    return false;
  } finally {
    running = false;
  }
}
