import { afterEach, describe, expect, test, vi } from 'vitest';
import type { StickyNote } from '../../services/stickyNoteService';

const exportNotes = vi.fn();
vi.mock('../../services/stickyExport', () => ({ exportNotes: (...a: unknown[]) => exportNotes(...a) }));

const { runStickyExport } = await import('./stickyExportActions');
const note = { id: 'n1' } as StickyNote;

afterEach(() => exportNotes.mockReset());

describe('runStickyExport', () => {
  test('báo tiến trình rồi kết quả, kèm lưu ý nếu có', async () => {
    exportNotes.mockResolvedValue({ notice: 'Không có emoji.' });
    const msgs: unknown[] = [];
    expect(await runStickyExport([note], 'pdf', m => msgs.push(m))).toBe(true);
    expect(msgs).toEqual([
      { text: 'Đang tạo PDF…', busy: true },
      { text: 'Đã xuất 1 ghi chú ra PDF. Không có emoji.' },
    ]);
  });

  test('bấm lần 2 khi đang xuất → bỏ qua, không xuất trùng', async () => {
    let finish!: () => void;
    exportNotes.mockReturnValue(new Promise<object>(r => { finish = () => r({}); }));
    const first = runStickyExport([note], 'markdown', () => {});
    expect(await runStickyExport([note], 'markdown', () => {})).toBe(false);
    await vi.waitFor(() => expect(exportNotes).toHaveBeenCalledTimes(1));
    finish();
    expect(await first).toBe(true);
    exportNotes.mockResolvedValue({});
    expect(await runStickyExport([note], 'markdown', () => {})).toBe(true);
  });

  test('lỗi → báo lỗi, lượt sau vẫn xuất được', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    exportNotes.mockRejectedValueOnce(new Error('hết bộ nhớ'));
    const msgs: any[] = [];
    expect(await runStickyExport([note], 'pdf', m => msgs.push(m))).toBe(false);
    expect(msgs.at(-1)).toEqual({ text: 'Xuất file thất bại: hết bộ nhớ', error: true });
    exportNotes.mockResolvedValue({});
    expect(await runStickyExport([note], 'pdf', () => {})).toBe(true);
  });
});
