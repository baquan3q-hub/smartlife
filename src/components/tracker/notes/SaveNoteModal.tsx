// File: src/components/tracker/notes/SaveNoteModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, Tag, Check, Loader2, Sparkles, FileText, CheckSquare } from 'lucide-react';
import { NoteLabelType } from '../../../types';
import { noteArchiveService } from '../../../services/noteArchiveService';
import { NOTE_LABELS, DEFAULT_NOTE_LABELS_LIST } from './noteConstants';

interface SaveNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialContent: string;
  userId: string;
  onSaved: (clearedScratchpad: boolean) => void;
}

export const SaveNoteModal: React.FC<SaveNoteModalProps> = ({
  isOpen,
  onClose,
  initialContent,
  userId,
  onSaved,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<NoteLabelType[]>(['Work']);
  const [noteDate, setNoteDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [clearScratchpad, setClearScratchpad] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setContent(initialContent || '');
      // Tự động trích dòng đầu tiên làm tiêu đề gợi ý
      const firstLine = (initialContent || '').trim().split('\n')[0].replace(/^[#*-\s]+/, '').trim();
      setTitle(firstLine.slice(0, 45) || '');
      setNoteDate(new Date().toISOString().split('T')[0]);
      setErrorMsg('');
    }
  }, [isOpen, initialContent]);

  if (!isOpen) return null;

  const toggleLabel = (labelKey: NoteLabelType) => {
    setSelectedLabels(prev => {
      if (prev.includes(labelKey)) {
        if (prev.length === 1) return prev; // Giữ lại ít nhất 1 nhãn
        return prev.filter(l => l !== labelKey);
      } else {
        return [...prev, labelKey];
      }
    });
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!content.trim()) {
      setErrorMsg('Vui lòng nhập nội dung ghi chú.');
      return;
    }
    if (!userId) {
      setErrorMsg('Không tìm thấy thông tin người dùng.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      const saved = await noteArchiveService.createArchivedNote(userId, {
        title: title.trim(),
        content: content.trim(),
        labels: selectedLabels,
        note_date: noteDate,
      });

      if (saved) {
        onSaved(clearScratchpad);
        onClose();
      } else {
        setErrorMsg('Không thể lưu ghi chú. Vui lòng thử lại.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lưu ghi chú');
    } finally {
      setIsSaving(false);
    }
  };

  // Hỗ trợ phím tắt Ctrl + Enter để lưu nhanh
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
              <Save size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">Lưu vào bộ nhớ ghi chú</h3>
              <p className="text-xs text-slate-400 font-medium">Lưu trữ lâu dài, gắn nhãn phân loại & phục vụ AI tóm tắt</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl border border-rose-100 font-semibold text-xs animate-shake">
              {errorMsg}
            </div>
          )}

          {/* Tiêu đề ghi chú */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Tiêu đề ghi chú (Tùy chọn)
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="VD: Họp dự án Web, Bài tập giải tích..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium transition-all"
            />
          </div>

          {/* Chọn ngày ghi nhận */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-400" />
              Ngày ghi nhận
            </label>
            <input
              type="date"
              value={noteDate}
              onChange={e => setNoteDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium transition-all"
            />
          </div>

          {/* Gán nhãn phân loại */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tag size={13} className="text-slate-400" />
                Gán nhãn phân loại (Có thể chọn nhiều)
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                Đã chọn {selectedLabels.length} nhãn
              </span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DEFAULT_NOTE_LABELS_LIST.map(labelKey => {
                const config = NOTE_LABELS[labelKey];
                const isSelected = selectedLabels.includes(labelKey);
                return (
                  <button
                    key={labelKey}
                    type="button"
                    onClick={() => toggleLabel(labelKey)}
                    className={`px-3 py-2 rounded-xl text-left border font-semibold text-xs flex items-center justify-between transition-all ${
                      isSelected
                        ? `${config.colorClass.bg} ${config.colorClass.text} ${config.colorClass.border} ring-2 ring-indigo-500/20 shadow-sm`
                        : 'bg-slate-50/70 text-slate-600 border-slate-200/60 hover:bg-slate-100/80'
                    }`}
                  >
                    <span className="truncate">{config.label}</span>
                    {isSelected && <Check size={14} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nội dung ghi chú */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText size={13} className="text-slate-400" />
                Nội dung ghi chú
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                {content.trim().split(/\s+/).filter(Boolean).length} từ
              </span>
            </label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={6}
              placeholder="Nhập nội dung cần lưu vào bộ nhớ..."
              className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium leading-relaxed resize-none transition-all"
            />
          </div>

          {/* Tùy chọn dọn sạch bảng nháp */}
          <div className="pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer select-none bg-slate-50 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-100/70 transition-colors">
              <input
                type="checkbox"
                checked={clearScratchpad}
                onChange={e => setClearScratchpad(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 transition"
              />
              <span className="text-xs font-semibold text-slate-700">
                Làm sạch bảng nháp sau khi lưu (để sẵn sàng cho ghi chép mới)
              </span>
            </label>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
            Mẹo: Nhấn <kbd className="px-1.5 py-0.5 bg-slate-200/70 rounded text-[9px] font-mono text-slate-600">Ctrl + Enter</kbd> để lưu nhanh
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200/60 font-semibold text-xs transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving || !content.trim()}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold text-xs shadow-md shadow-indigo-200 hover:opacity-95 active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5 transition-all"
            >
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Save size={14} />
                  Lưu vào bộ nhớ
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
