// File: src/components/tracker/notes/AISummaryModal.tsx
import React, { useState, useEffect } from 'react';
import {
  X, Sparkles, Calendar, Tag, Loader2, Copy, Check, ExternalLink,
  RotateCcw, AlertCircle, ArrowRight, MessageSquare, BookOpen,
  Briefcase, GraduationCap, Bell, CheckSquare, Lightbulb, ShieldCheck,
  Edit3, Eye, Save, FileText
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { NoteLabelType, AISummaryRequest } from '../../../types';
import { noteAISummaryService, AISummaryResult } from '../../../services/noteAISummaryService';
import { noteArchiveService } from '../../../services/noteArchiveService';
import { NOTE_LABELS, DEFAULT_NOTE_LABELS_LIST } from './noteConstants';

interface AISummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onOpenAIAdvisor?: (conversationId?: string) => void;
}

export const AISummaryModal: React.FC<AISummaryModalProps> = ({
  isOpen,
  onClose,
  userId,
  onOpenAIAdvisor,
}) => {
  // Preset timeframes
  const [timeframePreset, setTimeframePreset] = useState<'today' | '3days' | '7days' | '30days' | 'this_month' | 'all' | 'custom'>('7days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<NoteLabelType | 'All'>('All');

  // Preview count state
  const [matchingCount, setMatchingCount] = useState<number | null>(null);
  const [isCounting, setIsCounting] = useState(false);

  // AI Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<AISummaryResult | null>(null);
  const [editableContent, setEditableContent] = useState('');
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSavingArchive, setIsSavingArchive] = useState(false);
  const [savedArchiveSuccess, setSavedArchiveSuccess] = useState(false);

  // Compute actual date range from preset
  const calculateDateRange = () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (timeframePreset === 'today') {
      return { startDate: todayStr, endDate: todayStr };
    } else if (timeframePreset === '3days') {
      const past = new Date();
      past.setDate(past.getDate() - 3);
      return { startDate: past.toISOString().split('T')[0], endDate: todayStr };
    } else if (timeframePreset === '7days') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      return { startDate: past.toISOString().split('T')[0], endDate: todayStr };
    } else if (timeframePreset === '30days') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      return { startDate: past.toISOString().split('T')[0], endDate: todayStr };
    } else if (timeframePreset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      return { startDate: firstDay, endDate: todayStr };
    } else if (timeframePreset === 'all') {
      return { startDate: '2020-01-01', endDate: todayStr };
    } else {
      return {
        startDate: customStartDate || '2020-01-01',
        endDate: customEndDate || todayStr
      };
    }
  };

  // Check matching notes count when filter changes
  useEffect(() => {
    if (!isOpen || !userId) return;

    let isMounted = true;
    const updateCount = async () => {
      setIsCounting(true);
      const { startDate, endDate } = calculateDateRange();
      try {
        const notes = await noteArchiveService.getArchivedNotes(userId, {
          label: selectedLabel,
          startDate,
          endDate,
        });
        if (isMounted) {
          setMatchingCount(notes.length);
        }
      } catch {
        if (isMounted) setMatchingCount(0);
      } finally {
        if (isMounted) setIsCounting(false);
      }
    };

    updateCount();
    return () => { isMounted = false; };
  }, [isOpen, userId, timeframePreset, customStartDate, customEndDate, selectedLabel]);

  if (!isOpen) return null;

  const handleRunAISummary = async () => {
    if (!userId) return;
    const { startDate, endDate } = calculateDateRange();

    setIsGenerating(true);
    setErrorMsg('');
    setResult(null);
    setSavedArchiveSuccess(false);

    const request: AISummaryRequest = {
      label: selectedLabel,
      startDate,
      endDate,
      timeframePreset,
    };

    try {
      const res = await noteAISummaryService.generateSummary(userId, request);
      if (res.success) {
        setResult(res);
        setEditableContent(res.summaryMarkdown);
        setViewMode('preview');
      } else {
        setErrorMsg(res.errorMessage || 'Không thể tạo tóm tắt. Vui lòng kiểm tra lại.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kết nối AI');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    const textToCopy = editableContent || result?.summaryMarkdown || '';
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToArchive = async () => {
    const textToSave = editableContent.trim();
    if (!textToSave || !userId) return;

    setIsSavingArchive(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const targetLabel: NoteLabelType = selectedLabel === 'All' ? 'Work' : selectedLabel;
      const title = `Tóm tắt AI (${selectedLabel === 'All' ? 'Tổng quan' : selectedLabel}) - ${todayStr}`;

      const saved = await noteArchiveService.createArchivedNote(userId, {
        title,
        content: textToSave,
        labels: [targetLabel],
        note_date: todayStr,
      });

      if (saved) {
        setSavedArchiveSuccess(true);
        setTimeout(() => setSavedArchiveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Lỗi khi lưu tóm tắt vào note archives:', err);
    } finally {
      setIsSavingArchive(false);
    }
  };

  const handleOpenAdvisor = () => {
    if (onOpenAIAdvisor) {
      onClose();
      onOpenAIAdvisor(result?.conversationId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl max-h-[92vh] rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-800">AI Sum — Tóm tắt Ghi chú</h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                  AI Assistant
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Tổng hợp cuộc họp, việc cần làm & ghi chú tự do</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          
          {/* Section 1: Cấu hình bộ lọc nếu chưa có kết quả hoặc muốn cấu hình lại */}
          {!result && (
            <div className="space-y-4">
              
              {/* 1. Chọn khoảng thời gian */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                  <Calendar size={13} className="text-indigo-500" />
                  1. Chọn khoảng thời gian tóm tắt
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {[
                    { key: 'today', label: 'Hôm nay' },
                    { key: '3days', label: '3 ngày qua' },
                    { key: '7days', label: '7 ngày qua (Gợi ý)' },
                    { key: 'this_month', label: 'Tháng này' },
                    { key: '30days', label: '30 ngày qua' },
                    { key: 'all', label: 'Toàn bộ thời gian' },
                    { key: 'custom', label: 'Tùy chọn ngày' },
                  ].map(item => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setTimeframePreset(item.key as any)}
                      className={`px-3 py-2 rounded-xl font-bold text-xs transition-all text-center border ${
                        timeframePreset === item.key
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {timeframePreset === 'custom' && (
                  <div className="mt-2.5 flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-semibold">Từ:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={e => setCustomStartDate(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium"
                    />
                    <span className="text-slate-500 font-semibold">Đến:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={e => setCustomEndDate(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium"
                    />
                  </div>
                )}
              </div>

              {/* 2. Chọn loại nhãn */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                  <Tag size={13} className="text-indigo-500" />
                  2. Chọn nhãn phân loại cần tóm tắt
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedLabel('All')}
                    className={`px-3 py-2 rounded-xl font-bold text-xs text-left border flex items-center justify-between transition-all ${
                      selectedLabel === 'All'
                        ? 'bg-slate-800 text-white border-slate-800 shadow-md'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>Tất cả nhãn (Tổng quan)</span>
                    {selectedLabel === 'All' && <Check size={14} />}
                  </button>

                  {DEFAULT_NOTE_LABELS_LIST.map(lbl => {
                    const config = NOTE_LABELS[lbl];
                    const isSel = selectedLabel === lbl;
                    return (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => setSelectedLabel(lbl)}
                        className={`px-3 py-2 rounded-xl font-bold text-xs text-left border flex items-center justify-between transition-all ${
                          isSel
                            ? `${config.colorClass.bg} ${config.colorClass.text} ${config.colorClass.border} ring-2 ring-indigo-500/20 shadow-sm`
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate">{config.label}</span>
                        {isSel && <Check size={14} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Realtime Notes Found Preview */}
              <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100/80 flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-900 font-semibold">
                  <BookOpen size={16} className="text-indigo-600" />
                  <span>Dữ liệu đầu vào:</span>
                </div>
                <div>
                  {isCounting ? (
                    <span className="flex items-center gap-1 text-slate-400 font-medium">
                      <Loader2 size={12} className="animate-spin" /> Đang đếm...
                    </span>
                  ) : (
                    <span className="font-extrabold text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-xs">
                      {matchingCount ?? 0} ghi chú sẵn sàng
                    </span>
                  )}
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 text-rose-700 rounded-xl border border-rose-100 font-semibold flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          )}

          {/* Section 2: Loading State */}
          {isGenerating && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="relative">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-200">
                  <Sparkles size={28} className="text-amber-300" />
                </div>
                <Loader2 size={36} className="animate-spin text-purple-600 absolute -top-2.5 -right-2.5" />
              </div>
              <h4 className="text-sm font-black text-slate-800">AI đang đọc và tổng hợp các ghi chú...</h4>
              <p className="text-xs text-slate-400 max-w-xs font-medium">
                Đang phân tích các cuộc họp, trích xuất việc cần làm và cấu trúc hóa báo cáo cho bạn.
              </p>
            </div>
          )}

          {/* Section 3: Kết quả Tóm tắt Markdown (Hỗ trợ Xem trước Rich Markdown & Chỉnh sửa) */}
          {result && !isGenerating && (
            <div className="space-y-4 animate-in fade-in duration-300">
              
              {/* Result Toolbar & Action Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                
                {/* Left: View Mode Toggle (Preview vs Edit) & Sync Badge */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
                    <button
                      onClick={() => setViewMode('preview')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                        viewMode === 'preview'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Eye size={13} />
                      <span>Xem trước</span>
                    </button>
                    <button
                      onClick={() => setViewMode('edit')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                        viewMode === 'edit'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Edit3 size={13} />
                      <span>Chỉnh sửa</span>
                    </button>
                  </div>

                  <div className="hidden sm:flex items-center gap-1 text-emerald-700 font-bold text-[11px] bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                    <ShieldCheck size={13} />
                    <span>Đã lưu vào AI Own</span>
                  </div>
                </div>

                {/* Right: Actions (Save to Note Archives, Copy, Regenerate) */}
                <div className="flex items-center gap-1.5 ml-auto">
                  {/* Nút Lưu vào Bộ nhớ Ghi chú */}
                  <button
                    onClick={handleSaveToArchive}
                    disabled={isSavingArchive || !editableContent.trim()}
                    title="Lưu bản tóm tắt này thành thẻ ghi chú trong kho lưu trữ"
                    className={`px-2.5 py-1.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition-all ${
                      savedArchiveSuccess
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-white hover:bg-indigo-50 text-indigo-700 border-indigo-200 hover:border-indigo-300'
                    }`}
                  >
                    {isSavingArchive ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : savedArchiveSuccess ? (
                      <Check size={13} className="text-emerald-600" />
                    ) : (
                      <Save size={13} />
                    )}
                    <span>{savedArchiveSuccess ? 'Đã lưu kho' : 'Lưu vào bộ nhớ'}</span>
                  </button>

                  {/* Nút Sao chép */}
                  <button
                    onClick={handleCopy}
                    className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1 transition"
                  >
                    {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
                  </button>

                  {/* Nút Tóm tắt lại */}
                  <button
                    onClick={() => {
                      setResult(null);
                      setErrorMsg('');
                    }}
                    className="p-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                    title="Tóm tắt lại"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>

              {/* View Container: Rich Markdown Preview OR Editable Textarea */}
              {viewMode === 'preview' ? (
                <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm leading-relaxed max-h-[440px] overflow-y-auto">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ node, ...props }) => (
                        <h1 className="text-base sm:text-lg font-black text-indigo-900 border-b border-indigo-100 pb-2 mb-3 mt-3 first:mt-0" {...props} />
                      ),
                      h2: ({ node, ...props }) => (
                        <h2 className="text-sm sm:text-base font-extrabold text-slate-800 border-l-4 border-indigo-500 pl-2.5 py-0.5 mb-2.5 mt-4 first:mt-0" {...props} />
                      ),
                      h3: ({ node, ...props }) => (
                        <h3 className="text-xs sm:text-sm font-bold text-indigo-800 mb-2 mt-3.5 flex items-center gap-1.5" {...props} />
                      ),
                      h4: ({ node, ...props }) => (
                        <h4 className="text-xs font-bold text-slate-800 mb-1.5 mt-2" {...props} />
                      ),
                      p: ({ node, ...props }) => (
                        <p className="text-xs text-slate-700 leading-relaxed mb-3 last:mb-0" {...props} />
                      ),
                      strong: ({ node, ...props }) => (
                        <strong className="font-extrabold text-indigo-950 bg-indigo-50/60 px-1 py-0.5 rounded" {...props} />
                      ),
                      em: ({ node, ...props }) => (
                        <em className="italic text-slate-600 font-medium" {...props} />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul className="list-disc pl-5 mb-3 space-y-1.5 text-xs text-slate-700" {...props} />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol className="list-decimal pl-5 mb-3 space-y-1.5 text-xs text-slate-700" {...props} />
                      ),
                      li: ({ node, ...props }) => (
                        <li className="text-slate-700 leading-relaxed" {...props} />
                      ),
                      blockquote: ({ node, ...props }) => (
                        <blockquote className="border-l-4 border-indigo-300 bg-indigo-50/40 p-3 rounded-r-xl my-3 text-xs text-slate-700 italic" {...props} />
                      ),
                      code: ({ node, ...props }) => (
                        <code className="px-1.5 py-0.5 bg-slate-100 text-indigo-600 rounded text-[11px] font-mono" {...props} />
                      ),
                      hr: ({ node, ...props }) => (
                        <hr className="border-slate-200 my-4" {...props} />
                      ),
                      table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-3"><table className="w-full border-collapse border border-slate-200 text-xs" {...props} /></div>
                      ),
                      th: ({ node, ...props }) => (
                        <th className="border border-slate-200 bg-slate-100 px-3 py-2 text-left font-bold text-slate-800" {...props} />
                      ),
                      td: ({ node, ...props }) => (
                        <td className="border border-slate-200 px-3 py-2 text-slate-700" {...props} />
                      ),
                    }}
                  >
                    {editableContent}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                    <span>Chỉnh sửa nội dung Markdown trực tiếp:</span>
                    <span>{editableContent.trim().split(/\s+/).filter(Boolean).length} từ</span>
                  </div>
                  <textarea
                    rows={14}
                    value={editableContent}
                    onChange={e => setEditableContent(e.target.value)}
                    placeholder="Chỉnh sửa nội dung tóm tắt..."
                    className="w-full p-4 text-xs font-mono text-slate-800 bg-white placeholder-slate-400 focus:outline-none resize-none leading-relaxed"
                  />
                </div>
              )}

              {/* Bottom Navigation to AI Advisor */}
              {onOpenAIAdvisor && (
                <div className="p-3.5 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <MessageSquare size={18} className="text-indigo-600" />
                    <div>
                      <h5 className="font-extrabold text-slate-800 text-xs">Hỏi sâu hơn về bản tóm tắt này?</h5>
                      <p className="text-[11px] text-slate-500 font-medium">Cuộc hội thoại đã được lưu vào AI Advisor của bạn.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleOpenAdvisor}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 shrink-0 transition"
                  >
                    <span>Mở AI Advisor</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200/60 font-semibold text-xs transition-colors"
          >
            Đóng
          </button>

          {!result && (
            <button
              type="button"
              onClick={handleRunAISummary}
              disabled={isGenerating || isCounting || matchingCount === 0}
              className="px-5 py-2.5 rounded-xl bg-black hover:bg-slate-900 active:scale-95 text-white font-extrabold text-xs shadow-sm disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 transition-all cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={14} className="animate-spin text-white" />
                  <span>Đang tổng hợp...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} className="text-white" />
                  <span>Bắt đầu tóm tắt bằng AI ({matchingCount ?? 0} ghi chú)</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
