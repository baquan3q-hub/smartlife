import React, { useState, useEffect, useCallback } from 'react';
import {
  X, RefreshCw, ExternalLink, FileSpreadsheet, Search,
  Download, Table, Eye, CheckCircle2, AlertCircle, Sparkles, Layers
} from 'lucide-react';
import { GoogleSheetsIcon } from '../../icons/GoogleSheetsIcon';
import {
  isSheetsConnected,
  findOrCreateSpreadsheet,
  readSheetData,
  getSpreadsheetUrl,
  getLastSheetsSync,
  syncNoteToSheets
} from '../../../services/googleSheetsService';
import { noteArchiveService } from '../../../services/noteArchiveService';

interface GoogleSheetViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

type TabType = 'Note Archives' | 'Quick Notes' | 'AI Summaries';

export const GoogleSheetViewerModal: React.FC<GoogleSheetViewerModalProps> = ({
  isOpen,
  onClose,
  userId,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('Note Archives');
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);
  const [sheetData, setSheetData] = useState<string[][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(getLastSheetsSync());

  const loadData = useCallback(async (tabName: TabType) => {
    if (!isSheetsConnected()) {
      setError('Tài khoản Google chưa được kết nối. Vui lòng đăng nhập lại Google để cấp quyền.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const sId = await findOrCreateSpreadsheet();
      setSpreadsheetId(sId);
      const url = await getSpreadsheetUrl();
      setSpreadsheetUrl(url);

      const data = await readSheetData(sId, `'${tabName}'!A1:Z100`);
      setSheetData(data || []);
      setLastSyncTime(getLastSheetsSync() || new Date().toISOString());
    } catch (err: any) {
      console.error('[GoogleSheetViewerModal] Load error:', err);
      setError(err?.message || 'Không thể tải dữ liệu từ Google Sheets');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData(activeTab);
    }
  }, [isOpen, activeTab, loadData]);

  // Sync all current notes from Supabase to Google Sheets
  const handleSyncAllNotes = async () => {
    if (!userId) return;
    setIsSyncing(true);
    setError(null);
    try {
      const allNotes = await noteArchiveService.getArchivedNotes(userId);
      for (const note of allNotes) {
        await syncNoteToSheets({
          id: note.id,
          title: note.title || 'Ghi chú',
          content: note.content,
          labels: note.labels,
          is_pinned: note.is_pinned,
          created_at: note.note_date,
          updated_at: note.updated_at,
        });
      }
      await loadData(activeTab);
    } catch (err: any) {
      console.error('[GoogleSheetViewerModal] Sync error:', err);
      setError(err?.message || 'Lỗi khi đồng bộ ghi chú lên Google Sheets');
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  const headers = sheetData.length > 0 ? sheetData[0] : [];
  const rows = sheetData.length > 1 ? sheetData.slice(1) : [];

  const filteredRows = rows.filter((row) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    return row.some((cell) => cell && cell.toLowerCase().includes(query));
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl w-full max-w-5xl h-[88vh] shadow-2xl border border-white/40 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Glassmorphism */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-center shadow-md shadow-emerald-500/10">
              <GoogleSheetsIcon size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-850 dark:text-white">
                  Google Sheets — Dữ Liệu Ngoại Vi
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200/50">
                  SmartLife Database
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Bảng tính: <strong className="text-slate-600 dark:text-slate-300">SmartLife - Dữ Liệu Ghi Chú & Lưu Trữ Cá Nhân</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {spreadsheetUrl && (
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm hover:shadow-md"
              >
                <ExternalLink size={13} />
                <span className="hidden sm:inline">Mở trên Google Drive</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 flex items-center justify-center transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Toolbar & Tabs */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-850/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Tab Selector */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-xs">
            {(['Note Archives', 'Quick Notes', 'AI Summaries'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {tab === 'Note Archives' && '📑 Ghi chú lưu trữ'}
                {tab === 'Quick Notes' && '⚡ Ghi chú nhanh'}
                {tab === 'AI Summaries' && '🤖 Báo cáo AI'}
              </button>
            ))}
          </div>

          {/* Actions & Search */}
          <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm trong bảng tính..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-emerald-500 font-medium"
              />
            </div>

            <button
              onClick={() => loadData(activeTab)}
              disabled={isLoading}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:bg-slate-50 transition"
              title="Tải lại dữ liệu từ Google Sheets"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin text-emerald-600' : ''} />
            </button>

            <button
              onClick={handleSyncAllNotes}
              disabled={isSyncing}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs disabled:opacity-50 shrink-0"
              title="Đẩy toàn bộ ghi chú hiện tại lên Google Sheets"
            >
              <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? 'Đang đồng bộ...' : 'Đẩy toàn bộ ghi chú lên'}</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6 custom-scrollbar bg-slate-50/30 dark:bg-slate-900/30">
          {error && (
            <div className="mb-4 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 flex items-start gap-3 animate-in fade-in">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
              <div className="text-xs font-semibold leading-relaxed">
                <p className="font-bold mb-0.5">Lỗi kết nối Google Sheets:</p>
                <p>{error}</p>
                <p className="mt-1 text-[11px] text-rose-600/80">
                  Gợi ý: Đăng xuất và đăng nhập lại bằng Google để cấp quyền truy cập Spreadsheets.
                </p>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
              <RefreshCw size={32} className="animate-spin text-emerald-500 mb-3" />
              <p className="text-xs font-bold">Đang tải dữ liệu từ Google Sheets...</p>
            </div>
          ) : sheetData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16 text-center">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mb-3">
                <Table size={28} />
              </div>
              <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200 mb-1">
                Tab này hiện chưa có dữ liệu
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mb-4">
                Nhấn nút "Đẩy toàn bộ ghi chú lên" để đồng bộ dữ liệu của bạn sang tab <strong>{activeTab}</strong>.
              </p>
              <button
                onClick={handleSyncAllNotes}
                disabled={isSyncing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 shadow-xs overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                      <th className="py-3 px-3 font-bold text-slate-400 text-[10px] w-12 text-center">#</th>
                      {headers.map((h, i) => (
                        <th
                          key={i}
                          className="py-3 px-4 font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[10.5px] whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredRows.map((row, rIndex) => (
                      <tr
                        key={rIndex}
                        className="hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors"
                      >
                        <td className="py-3 px-3 text-slate-400 text-[10px] text-center font-bold">
                          {rIndex + 1}
                        </td>
                        {headers.map((_, cIndex) => {
                          const val = row[cIndex] || '';
                          const isId = cIndex === 0;
                          return (
                            <td
                              key={cIndex}
                              className={`py-3 px-4 text-slate-700 dark:text-slate-300 font-medium ${
                                isId ? 'text-[10px] font-mono text-slate-400' : ''
                              }`}
                            >
                              {val.length > 80 ? (
                                <span title={val}>{val.slice(0, 80)}...</span>
                              ) : (
                                val || <span className="text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  Hiển thị <strong>{filteredRows.length}</strong> / <strong>{rows.length}</strong> hàng dữ liệu
                </span>
                {lastSyncTime && (
                  <span>
                    Cập nhật lúc: {new Date(lastSyncTime).toLocaleTimeString('vi-VN')} ({new Date(lastSyncTime).toLocaleDateString('vi-VN')})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
