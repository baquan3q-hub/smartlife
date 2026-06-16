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

      if (data && data.length > 0) {
        setContent(data[0].content || '');
        setNoteId(data[0].id);
        setSyncStatus('saved');
      } else {
        // Create a default quick note if not found
        const { data: newNote, error: createError } = await supabase
          .from('my_storage')
          .insert([
            {
              user_id: userId,
              type: 'note',
              title: 'Quick Note',
              content: '',
            },
          ])
          .select()
          .single();

        if (createError) throw createError;
        if (newNote) {
          setContent(newNote.content || '');
          setNoteId(newNote.id);
          setSyncStatus('saved');
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
    if (!userId) return;
    setSyncStatus('saving');
    
    // Save locally first
    localStorage.setItem(`smartlife_quicknote_${userId}`, text);

    try {
      if (id) {
        const { error } = await supabase
          .from('my_storage')
          .update({ content: text })
          .eq('id', id);
        
        if (error) throw error;
        setSyncStatus('saved');
      } else {
        // Fallback: Create if noteId is not yet loaded
        const { data, error } = await supabase
          .from('my_storage')
          .insert([
            {
              user_id: userId,
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
        }
        setSyncStatus('saved');
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

    // Debounce database save (1.2 seconds of inactivity)
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      saveNoteToDb(text, noteId);
    }, 1200);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
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
                ✓ Đã lưu đám mây
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
          disabled={isLoading}
          placeholder={isLoading ? "Đang tải dữ liệu..." : "Ý tưởng đột xuất, ghi chú nhanh bài học... Gõ vào đây sẽ tự động lưu."}
          className="w-full h-full text-xs bg-transparent text-slate-750 placeholder-slate-400 focus:outline-none resize-none font-medium leading-relaxed"
        />
      </div>
    </div>
  );
};
