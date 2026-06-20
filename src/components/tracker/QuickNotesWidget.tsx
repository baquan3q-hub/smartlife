import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { StickyNote, CloudLightning, Loader2, Save } from 'lucide-react';

interface QuickNotesWidgetProps {
  userId: string;
}

export const QuickNotesWidget: React.FC<QuickNotesWidgetProps> = ({ userId }) => {
  const [content, setContent] = useState('');
  const [noteId, setNoteId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

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

  // Fetch or initialize quick note
  const loadQuickNote = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
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
          // If we have newer unsaved local content, use it and push it to Supabase
          setContent(localContent);
          setSyncStatus('saving');
          hasUnsavedChangesRef.current = true;
          // Trigger immediate save to Supabase
          saveNoteToDb(localContent, dbId);
        } else {
          // Otherwise, sync DB content to local state and local storage
          setContent(dbContent);
          setSyncStatus('saved');
          localStorage.setItem(`smartlife_quicknote_${userId}`, dbContent);
          localStorage.setItem(`smartlife_quicknote_unsaved_${userId}`, 'false');
        }
      } else {
        // Create a default quick note if not found
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
      // Fallback to localStorage if Supabase query fails
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
        // Fallback: Create if noteId is not yet loaded
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

    // Save to localStorage immediately on keystroke as a backup
    if (userId) {
      localStorage.setItem(`smartlife_quicknote_${userId}`, text);
      localStorage.setItem(`smartlife_quicknote_unsaved_${userId}`, 'true');
    }

    // Debounce database save (1.2 seconds of inactivity)
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      saveNoteToDb(text, noteIdRef.current);
    }, 1200);
  };

  const handleBlur = () => {
    // If there are unsaved changes, save immediately when focus is lost
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

      // Cleanup timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Save any pending changes
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

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-2.5 shadow-sm relative overflow-hidden flex flex-col h-full min-h-[300px]">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
          <StickyNote size={16} className="text-slate-700" />
          Ghi chú
        </h3>

        <div className="flex items-center gap-3">
          {/* Word count */}
          <span className="text-[10px] font-bold text-slate-400">
            {getWordCount(content)} từ
          </span>

          {/* Sync Status Badge */}
          <div className="flex items-center gap-1.5 text-[10px] font-semibold">
            {isLoading ? (
              <span className="text-slate-400 flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" />
                Đang tải...
              </span>
            ) : syncStatus === 'saving' ? (
              <span className="text-slate-500 flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" />
                Tự động lưu...
              </span>
            ) : syncStatus === 'saved' ? (
              <span className="text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100/50">
                Đã lưu
              </span>
            ) : syncStatus === 'error' ? (
              <span className="text-rose-605 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100/50">
                Lưu máy (Offline)
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Note Area */}
      <div className="flex-1 min-h-0 bg-slate-50/50 rounded-2xl border border-slate-100 p-3.5 shadow-inner mt-1">
        <textarea
          value={content}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isLoading}
          placeholder={isLoading ? "Đang tải dữ liệu..." : "Ý tưởng đột xuất, ghi chú nhanh bài học... Gõ vào đây sẽ tự động lưu."}
          className="w-full h-full text-xs bg-transparent text-slate-750 placeholder-slate-400 focus:outline-none resize-none font-medium leading-relaxed"
        />
      </div>
    </div>
  );
};
