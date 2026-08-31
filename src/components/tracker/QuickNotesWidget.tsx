import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import {
  StickyNote, Loader2, Save, Sparkles, BookOpen, Plus,
  Check, ArrowRight, Layers, Tag, FileSpreadsheet
} from 'lucide-react';
import { GoogleSheetsIcon } from '../icons/GoogleSheetsIcon';
import { noteArchiveService } from '../../services/noteArchiveService';
import { SaveNoteModal } from './notes/SaveNoteModal';
import { NotesArchiveModal } from './notes/NotesArchiveModal';
import { AISummaryModal } from './notes/AISummaryModal';
import { GoogleSheetViewerModal } from './notes/GoogleSheetViewerModal';

interface QuickNotesWidgetProps {
  userId: string;
  onNavigate?: (tab: string, params?: any) => void;
}

export const QuickNotesWidget: React.FC<QuickNotesWidgetProps> = ({ userId, onNavigate }) => {
  const [content, setContent] = useState('');
  const [noteId, setNoteId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Modals state
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isAISumModalOpen, setIsAISumModalOpen] = useState(false);
  const [isGoogleSheetOpen, setIsGoogleSheetOpen] = useState(false);
  const [archivedCount, setArchivedCount] = useState<number>(0);

  // Refs for tracking latest values to avoid stale closures in event listeners/cleanup
  const contentRef = useRef(content);
  const noteIdRef = useRef(noteId);
  const userIdRef = useRef(userId);
  const hasUnsavedChangesRef = useRef(false);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    noteIdRef.current = noteId;
  }, [noteId]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // Load total archived notes count
  const refreshArchivedCount = useCallback(async () => {
    if (!userId) return;
    try {
      const count = await noteArchiveService.getNotesCount(userId);
      setArchivedCount(count);
    } catch {
      // Ignore count errors
    }
  }, [userId]);

  // Fetch or initialize quick note
  const loadQuickNote = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      refreshArchivedCount();

      // Find the sticky note titled 'Quick Note'
      const { data, error } = await supabase
        .from('my_storage')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'note')
        .eq('title', 'Quick Note')
        .limit(1);

      if (error) throw error;

      // Check if we have unsaved local changes
      const isUnsaved = localStorage.getItem(`smartlife_quicknote_unsaved_${userId}`) === 'true';
      const localContent = localStorage.getItem(`smartlife_quicknote_${userId}`);

      if (data && data.length > 0) {
        const dbContent = data[0].content || '';
        const dbId = data[0].id;
        setNoteId(dbId);
        noteIdRef.current = dbId;

        if (isUnsaved && localContent !== null && localContent !== dbContent) {
          setContent(localContent);
          setSyncStatus('saving');
          hasUnsavedChangesRef.current = true;
          saveNoteToDb(localContent, dbId);
        } else {
          setContent(dbContent);
          setSyncStatus('saved');
          localStorage.setItem(`smartlife_quicknote_${userId}`, dbContent);
          localStorage.setItem(`smartlife_quicknote_unsaved_${userId}`, 'false');
        }
      } else {
        // Create default scratchpad
        const { data: newNote, error: createError } = await supabase
          .from('my_storage')
          .insert([
            {
              user_id: userId,
              type: 'note',
              title: 'Quick Note',
              content: isUnsaved && localContent !== null ? localContent : '',
            },
          ])
          .select()
          .single();

        if (createError) throw createError;
        if (newNote) {
          const dbContent = newNote.content || '';
          setContent(dbContent);
          setNoteId(newNote.id);
          noteIdRef.current = newNote.id;
          setSyncStatus('saved');
          localStorage.setItem(`smartlife_quicknote_${userId}`, dbContent);
          localStorage.setItem(`smartlife_quicknote_unsaved_${userId}`, 'false');
        }
      }
    } catch (err) {
      console.error('Lỗi tải Ghi chú nhanh:', err);
      const localNotes = localStorage.getItem(`smartlife_quicknote_${userId}`);
      if (localNotes) {
        setContent(localNotes);
      }
      setSyncStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQuickNote();
  }, [userId]);

  const saveNoteToDb = async (text: string, id: string | null) => {
    const currentUserId = userIdRef.current;
    if (!currentUserId) return;
    setSyncStatus('saving');
    hasUnsavedChangesRef.current = true;
    localStorage.setItem(`smartlife_quicknote_unsaved_${currentUserId}`, 'true');
    
    // Save locally first
    localStorage.setItem(`smartlife_quicknote_${currentUserId}`, text);

    try {
      if (id) {
        const { error } = await supabase
          .from('my_storage')
          .update({ content: text })
          .eq('id', id);

        if (error) throw error;
        setSyncStatus('saved');
        hasUnsavedChangesRef.current = false;
        localStorage.setItem(`smartlife_quicknote_unsaved_${currentUserId}`, 'false');
      } else {
        const { data, error } = await supabase
          .from('my_storage')
          .insert([
            {
              user_id: currentUserId,
              type: 'note',
              title: 'Quick Note',
              content: text,
            },
          ])
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setNoteId(data.id);
          noteIdRef.current = data.id;
        }
        setSyncStatus('saved');
        hasUnsavedChangesRef.current = false;
        localStorage.setItem(`smartlife_quicknote_unsaved_${currentUserId}`, 'false');
      }
    } catch (err) {
      console.error('Lỗi lưu ghi chú:', err);
      setSyncStatus('error');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setContent(text);
    setSyncStatus('saving');
    hasUnsavedChangesRef.current = true;

    if (userId) {
      localStorage.setItem(`smartlife_quicknote_${userId}`, text);
      localStorage.setItem(`smartlife_quicknote_unsaved_${userId}`, 'true');
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      saveNoteToDb(text, noteIdRef.current);
    }, 1200);
  };

  const handleBlur = () => {
    if (hasUnsavedChangesRef.current) {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      saveNoteToDb(contentRef.current, noteIdRef.current);
    }
  };

  // Save on unmount & page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasUnsavedChangesRef.current) {
        saveNoteToDb(contentRef.current, noteIdRef.current);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (hasUnsavedChangesRef.current) {
        saveNoteToDb(contentRef.current, noteIdRef.current);
      }
    };
  }, []);

  const getWordCount = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  };

  // Callback khi lưu thẻ ghi chú vào bộ nhớ
  const handleNoteArchived = (clearedScratchpad: boolean) => {
    refreshArchivedCount();
    if (clearedScratchpad) {
      setContent('');
      contentRef.current = '';
      if (userId) {
        localStorage.setItem(`smartlife_quicknote_${userId}`, '');
      }
      saveNoteToDb('', noteIdRef.current);
    }
  };

  // Callback khi nạp lại ghi chú từ kho vào bảng nháp
  const handleRestoreToScratchpad = (restoredText: string) => {
    const newContent = content.trim() ? `${content.trim()}\n\n---\n${restoredText}` : restoredText;
    setContent(newContent);
    contentRef.current = newContent;
    if (userId) {
      localStorage.setItem(`smartlife_quicknote_${userId}`, newContent);
    }
    saveNoteToDb(newContent, noteIdRef.current);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-3 shadow-sm relative overflow-hidden flex flex-col h-full min-h-[340px]">
      
      {/* Header with Title & Action Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-slate-800 dark:text-slate-200 shadow-xs">
            <StickyNote size={15} />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
              Ghi chú
            </h3>
          </div>
        </div>

        {/* Action Buttons Toolbar on Header */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Nút AI Sum (Màu xám & trắng nhẹ) */}
          <button
            type="button"
            onClick={() => setIsAISumModalOpen(true)}
            title="Tóm tắt thông minh bằng AI (AI Sum)"
            className="p-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 shadow-xs flex items-center justify-center transition-all active:scale-95 cursor-pointer"
          >
            <Sparkles size={14} className="text-slate-600 dark:text-slate-300" />
          </button>

          {/* Nút 📁 Bộ nhớ (Chỉ hiển thị số lượng) */}
          <button
            type="button"
            onClick={() => setIsArchiveModalOpen(true)}
            title="Kho bộ nhớ ghi chú đã lưu"
            className="h-7 min-w-[28px] px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-bold border border-slate-200/80 dark:border-slate-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-xs"
          >
            <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">
              {archivedCount > 99 ? '99+' : archivedCount}
            </span>
          </button>

          {/* Nút 📊 Google Sheets (Icon Google Sheets 2026) */}
          <button
            type="button"
            onClick={() => setIsGoogleSheetOpen(true)}
            title="Bảng tính Google Sheets"
            className="p-1.5 px-2 rounded-lg bg-emerald-50/80 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-xs"
          >
            <GoogleSheetsIcon size={14} />
          </button>
        </div>
      </div>

      {/* Secondary Meta Row: Word count & Sync Status */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold px-1 mb-1.5">
        <span className="flex items-center gap-1 text-slate-400 font-medium">
          {getWordCount(content)} từ
        </span>

        <div className="flex items-center gap-1">
          {isLoading ? (
            <span className="text-slate-400 flex items-center gap-1">
              <Loader2 size={10} className="animate-spin text-slate-400" />
            </span>
          ) : syncStatus === 'saving' ? (
            <span className="text-slate-400 flex items-center gap-1" title="Đang lưu...">
              <Loader2 size={10} className="animate-spin text-slate-400" />
            </span>
          ) : syncStatus === 'saved' ? (
            <span className="text-slate-400 dark:text-slate-500 flex items-center justify-center p-0.5" title="Đã lưu nháp">
              <Check size={11} className="text-slate-400 dark:text-slate-500 stroke-[2.5]" />
            </span>
          ) : syncStatus === 'error' ? (
            <span className="text-rose-500 text-[9.5px] font-medium" title="Lỗi đồng bộ">
              Offline
            </span>
          ) : null}
        </div>
      </div>

      {/* Note Editable Textarea Area */}
      <div className="flex-1 min-h-[140px] bg-slate-50/70 rounded-2xl border border-slate-100 p-3 shadow-inner relative group focus-within:bg-white focus-within:border-slate-300 transition-colors">
        <textarea
          value={content}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isLoading}
          placeholder={isLoading ? "Đang tải dữ liệu..." : "Ý tưởng đột xuất, ghi chú cuộc họp nhanh, to-do list... Gõ vào đây sẽ tự động lưu nháp."}
          className="w-full h-full text-xs bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none resize-none font-medium leading-relaxed"
        />
      </div>

      {/* Footer Action Bar: Nút Icon "Lưu vào bộ nhớ" */}
      <div className="pt-2 flex items-center justify-end border-t border-slate-100/80 mt-1.5">
        <button
          type="button"
          onClick={() => setIsSaveModalOpen(true)}
          disabled={!content.trim() || isLoading}
          title="Lưu vào bộ nhớ ghi chú (Ctrl + Enter)"
          className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 shadow-xs flex items-center justify-center transition-all active:scale-90 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
        >
          <Save size={14} />
        </button>
      </div>

      {/* Modal 1: Lưu vào bộ nhớ */}
      <SaveNoteModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        initialContent={content}
        userId={userId}
        onSaved={handleNoteArchived}
      />

      {/* Modal 2: Quản lý Kho Lưu Trữ Ghi Chú (CRUDS) */}
      <NotesArchiveModal
        isOpen={isArchiveModalOpen}
        onClose={() => {
          setIsArchiveModalOpen(false);
          refreshArchivedCount();
        }}
        userId={userId}
        onRestoreToScratchpad={handleRestoreToScratchpad}
        onOpenAISum={() => setIsAISumModalOpen(true)}
        onOpenNewNote={() => setIsSaveModalOpen(true)}
      />

      {/* Modal 3: Tóm tắt thông minh bằng AI (AI Sum) */}
      <AISummaryModal
        isOpen={isAISumModalOpen}
        onClose={() => setIsAISumModalOpen(false)}
        userId={userId}
        onOpenAIAdvisor={(convId) => {
          if (onNavigate) {
            onNavigate('ai-advisor', { conversationId: convId });
          }
        }}
      />

      {/* Modal 4: Google Sheets In-App Viewer */}
      <GoogleSheetViewerModal
        isOpen={isGoogleSheetOpen}
        onClose={() => setIsGoogleSheetOpen(false)}
        userId={userId}
      />

    </div>
  );
};
