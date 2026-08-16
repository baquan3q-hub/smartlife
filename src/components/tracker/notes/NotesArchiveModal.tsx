// File: src/components/tracker/notes/NotesArchiveModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Search, Filter, Calendar, Tag, Trash2, Edit3, Pin, PinOff,
  Copy, Check, RotateCcw, Plus, Sparkles, Loader2, BookOpen,
  Briefcase, GraduationCap, Bell, CheckSquare, Lightbulb, ExternalLink,
  ChevronDown, AlertCircle
} from 'lucide-react';
import { NoteArchive, NoteLabelType, NoteArchiveFilter } from '../../../types';
import { noteArchiveService } from '../../../services/noteArchiveService';
import { NOTE_LABELS, DEFAULT_NOTE_LABELS_LIST } from './noteConstants';

interface NotesArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onRestoreToScratchpad: (content: string) => void;
  onOpenAISum?: () => void;
  onOpenNewNote?: () => void;
}

export const NotesArchiveModal: React.FC<NotesArchiveModalProps> = ({
  isOpen,
  onClose,
  userId,
  onRestoreToScratchpad,
  onOpenAISum,
  onOpenNewNote,
}) => {
  const [notes, setNotes] = useState<NoteArchive[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeLabel, setActiveLabel] = useState<NoteLabelType | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Editing state
  const [editingNote, setEditingNote] = useState<NoteArchive | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editLabels, setEditLabels] = useState<NoteLabelType[]>(['Work']);
  const [editDate, setEditDate] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Copy toast state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [restoredId, setRestoredId] = useState<string | null>(null);

  // Load notes
  const fetchNotes = async () => {
    if (!userId) return;
    setIsLoading(true);

    let startDate: string | undefined;
    let endDate: string | undefined;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (datePreset === 'today') {
      startDate = todayStr;
      endDate = todayStr;
    } else if (datePreset === '7days') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      startDate = past.toISOString().split('T')[0];
      endDate = todayStr;
    } else if (datePreset === '30days') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      startDate = past.toISOString().split('T')[0];
      endDate = todayStr;
    } else if (datePreset === 'custom') {
      if (customStartDate) startDate = customStartDate;
      if (customEndDate) endDate = customEndDate;
    }

    try {
      const data = await noteArchiveService.getArchivedNotes(userId, {
        label: activeLabel,
        startDate,
        endDate,
        searchQuery,
      });
      setNotes(data || []);
    } catch (err) {
      console.error('Lỗi tải ghi chú lưu trữ:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      fetchNotes();
    }
  }, [isOpen, userId, activeLabel, datePreset, customStartDate, customEndDate, searchQuery]);

  if (!isOpen) return null;

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn ghi chú này?')) return;
    const success = await noteArchiveService.deleteArchivedNote(userId, id);
    if (success) {
      setNotes(prev => prev.filter(n => n.id !== id));
      if (editingNote?.id === id) setEditingNote(null);
    }
  };

  const handleTogglePin = async (note: NoteArchive, e: React.MouseEvent) => {
    e.stopPropagation();
    const newPinStatus = !note.is_pinned;
    const success = await noteArchiveService.togglePinNote(userId, note.id, newPinStatus);
    if (success) {
      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, is_pinned: newPinStatus } : n));
    }
  };

  const handleCopy = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRestore = (content: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onRestoreToScratchpad(content);
    setRestoredId(id);
    setTimeout(() => setRestoredId(null), 2000);
  };

  const startEdit = (note: NoteArchive) => {
    setEditingNote(note);
    setEditTitle(note.title || '');
    setEditContent(note.content || '');
    setEditLabels(note.labels || ['Work']);
    setEditDate(note.note_date || new Date().toISOString().split('T')[0]);
  };

  const toggleEditLabel = (lbl: NoteLabelType) => {
    setEditLabels(prev => {
      if (prev.includes(lbl)) {
        if (prev.length === 1) return prev;
        return prev.filter(l => l !== lbl);
      } else {
        return [...prev, lbl];
      }
    });
  };

  const handleUpdateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote || !editContent.trim()) return;
    setIsUpdating(true);

    try {
      const updated = await noteArchiveService.updateArchivedNote(userId, editingNote.id, {
        title: editTitle.trim(),
        content: editContent.trim(),
        labels: editLabels,
        note_date: editDate,
      });

      if (updated) {
        setNotes(prev => prev.map(n => n.id === editingNote.id ? updated : n));
        setEditingNote(null);
      }
    } catch (err) {
      console.error('Lỗi cập nhật note:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Helper render Icon cho từng nhãn
  const renderLabelIcon = (label: NoteLabelType, size = 12) => {
    switch (label) {
      case 'Work': return <Briefcase size={size} />;
      case 'University': return <GraduationCap size={size} />;
      case 'Reminder': return <Bell size={size} />;
      case 'Learning': return <BookOpen size={size} />;
      case 'ToDo-List': return <CheckSquare size={size} />;
      case 'Ideas': return <Lightbulb size={size} />;
      default: return <Tag size={size} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl h-[92vh] max-h-[850px] rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
              <BookOpen size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-800">Bộ nhớ Ghi chú</h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
                  {notes.length} ghi chú
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Kho lưu trữ lâu dài & tổng hợp báo cáo bằng AI</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Nút AI Sum shortcut */}
            {onOpenAISum && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAISum();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-100 flex items-center gap-1.5 transition-all active:scale-95"
              >
                <Sparkles size={13} className="text-amber-300" />
                <span>AI Sum</span>
              </button>
            )}

            {/* Nút Thêm mới */}
            {onOpenNewNote && (
              <button
                onClick={() => {
                  onClose();
                  onOpenNewNote();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <Plus size={14} />
                <span>Lưu ghi chú mới</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filters Bar: Search & Labels & Date Preset */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50 space-y-3">
          
          {/* Row 1: Search & Date Presets */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm nội dung ghi chú, tiêu đề, nhãn..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium transition-all shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Date Preset Filter */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm shrink-0 text-xs">
              <span className="px-2 text-slate-400 font-semibold text-[11px] flex items-center gap-1">
                <Calendar size={12} />
              </span>
              <button
                onClick={() => setDatePreset('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  datePreset === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setDatePreset('today')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  datePreset === 'today' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Hôm nay
              </button>
              <button
                onClick={() => setDatePreset('7days')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  datePreset === '7days' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                7 ngày qua
              </button>
              <button
                onClick={() => setDatePreset('30days')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  datePreset === '30days' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                30 ngày
              </button>
              <button
                onClick={() => setDatePreset('custom')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  datePreset === 'custom' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Tùy chọn
              </button>
            </div>
          </div>

          {/* Custom Date Pickers (if custom selected) */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 text-xs bg-white p-2.5 rounded-xl border border-slate-200 animate-in fade-in">
              <span className="text-slate-500 font-semibold text-[11px]">Từ ngày:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium"
              />
              <span className="text-slate-500 font-semibold text-[11px]">Đến ngày:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium"
              />
            </div>
          )}

          {/* Row 2: Label Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setActiveLabel('All')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeLabel === 'All'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>Tất cả nhãn</span>
            </button>

            {DEFAULT_NOTE_LABELS_LIST.map(lbl => {
              const config = NOTE_LABELS[lbl];
              const isSelected = activeLabel === lbl;
              return (
                <button
                  key={lbl}
                  onClick={() => setActiveLabel(lbl)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? config.colorClass.activeTab
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {renderLabelIcon(lbl, 13)}
                  <span>{config.label}</span>
                </button>
              );
            })}
          </div>

        </div>

        {/* Main Content Area: Notes Grid / List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 size={24} className="animate-spin text-indigo-500" />
              <span className="text-xs font-semibold">Đang tải danh sách ghi chú...</span>
            </div>
          ) : notes.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
              <div className="w-14 h-14 rounded-3xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-3">
                <BookOpen size={24} />
              </div>
              <h4 className="text-sm font-black text-slate-700 mb-1">Chưa có ghi chú nào phù hợp</h4>
              <p className="text-xs text-slate-400 max-w-sm font-medium mb-4">
                {searchQuery || activeLabel !== 'All' || datePreset !== 'all'
                  ? 'Thử thay đổi bộ lọc nhãn hoặc khoảng thời gian để tìm kiếm.'
                  : 'Hãy bấm "Lưu vào bộ nhớ" trên widget Ghi chú để lưu giữ các thông tin quan trọng lâu dài.'}
              </p>
              {onOpenNewNote && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenNewNote();
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-100 flex items-center gap-1.5 transition-all"
                >
                  <Plus size={14} />
                  Lưu ghi chú đầu tiên
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {notes.map(note => {
                return (
                  <div
                    key={note.id}
                    className={`bg-white rounded-2xl border p-4.5 shadow-sm transition-all hover:shadow-md flex flex-col justify-between group ${
                      note.is_pinned ? 'border-amber-300 ring-1 ring-amber-300/40 bg-amber-50/10' : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    {/* Top: Date & Labels & Pin */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Ngày ghi nhận */}
                          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                            <Calendar size={10} />
                            {note.note_date}
                          </span>

                          {/* Nhãn */}
                          {note.labels?.map(lbl => {
                            const config = NOTE_LABELS[lbl];
                            return (
                              <span
                                key={lbl}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                                  config ? config.colorClass.badge : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                {renderLabelIcon(lbl, 10)}
                                {lbl}
                              </span>
                            );
                          })}
                        </div>

                        {/* Pin Button */}
                        <button
                          onClick={e => handleTogglePin(note, e)}
                          title={note.is_pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            note.is_pinned
                              ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
                              : 'text-slate-300 hover:text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {note.is_pinned ? <Pin size={14} className="fill-current" /> : <Pin size={14} />}
                        </button>
                      </div>

                      {/* Tiêu đề */}
                      {note.title && (
                        <h4 className="text-sm font-black text-slate-800 mb-1.5 leading-snug line-clamp-1">
                          {note.title}
                        </h4>
                      )}

                      {/* Nội dung */}
                      <p className="text-xs text-slate-650 font-medium leading-relaxed whitespace-pre-wrap line-clamp-6 mb-4">
                        {note.content}
                      </p>
                    </div>

                    {/* Bottom Action Toolbar */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto text-slate-400">
                      <div className="text-[10px] font-medium text-slate-400">
                        {note.content.trim().split(/\s+/).filter(Boolean).length} từ
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Nạp vào bảng nháp */}
                        <button
                          onClick={e => handleRestore(note.content, note.id, e)}
                          title="Nạp nội dung này vào bảng nháp ghi chú"
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 font-bold text-[11px] flex items-center gap-1 transition-all"
                        >
                          {restoredId === note.id ? (
                            <>
                              <Check size={12} className="text-emerald-600" />
                              <span className="text-emerald-600">Đã nạp</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw size={12} />
                              <span>Nạp vào nháp</span>
                            </>
                          )}
                        </button>

                        {/* Copy button */}
                        <button
                          onClick={e => handleCopy(note.content, note.id, e)}
                          title="Sao chép nội dung"
                          className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-700 text-slate-400 transition-colors"
                        >
                          {copiedId === note.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>

                        {/* Edit button */}
                        <button
                          onClick={() => startEdit(note)}
                          title="Chỉnh sửa ghi chú"
                          className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-indigo-600 text-slate-400 transition-colors"
                        >
                          <Edit3 size={14} />
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={e => handleDelete(note.id, e)}
                          title="Xóa ghi chú"
                          className="p-1.5 rounded-lg hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Edit Note Sub-Modal */}
        {editingNote && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <Edit3 size={16} className="text-indigo-600" />
                  Chỉnh sửa thẻ ghi chú
                </h4>
                <button
                  onClick={() => setEditingNote(null)}
                  className="w-7 h-7 rounded-full hover:bg-slate-200 text-slate-400 flex items-center justify-center"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleUpdateNote} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Tiêu đề</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Ngày ghi nhận</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Nhãn phân loại</label>
                  <div className="grid grid-cols-3 gap-2">
                    {DEFAULT_NOTE_LABELS_LIST.map(lbl => {
                      const isSel = editLabels.includes(lbl);
                      return (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() => toggleEditLabel(lbl)}
                          className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold text-left flex items-center justify-between ${
                            isSel ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          <span>{lbl}</span>
                          {isSel && <Check size={12} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Nội dung</label>
                  <textarea
                    rows={6}
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium resize-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingNote(null)}
                    className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating || !editContent.trim()}
                    className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold shadow-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Cập nhật
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
