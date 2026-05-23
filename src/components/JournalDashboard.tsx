import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BookOpen, Sparkles, Calendar as CalendarIcon, Clock, Heart, Edit2, 
  CheckCircle, ChevronLeft, ChevronRight, BarChart2, Star, Trash2, 
  Plus, X, List, Heading, Bold, Italic, CheckSquare, Search, Award, Flame, Eye,
  Underline, Strikethrough, ListOrdered, AlignLeft, AlignCenter, AlignRight, Palette, Highlighter, Eraser
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { journalService, getRandomWritingPrompt, getLocalDateString } from '../services/journalService';
import { processJournalReward } from '../services/starBrainService';
import { JournalEntry, JournalStats, MoodLevel } from '../types';
import { supabase } from '../services/supabase';
import ConfirmModal from './ConfirmModal';
import { JournalPinGuard } from './JournalPinGuard';

// Cấu hình Emoji và màu sắc cho các cấp cảm xúc (Mood)
export const MOOD_CONFIG: Record<MoodLevel, { emoji: string; label: string; color: string; bgClass: string; borderClass: string; textClass: string }> = {
  1: { emoji: '😢', label: 'Rất tệ', color: '#EF4444', bgClass: 'bg-red-50', borderClass: 'border-red-200', textClass: 'text-red-600' },
  2: { emoji: '😟', label: 'Không tốt', color: '#F97316', bgClass: 'bg-orange-50', borderClass: 'border-orange-200', textClass: 'text-orange-600' },
  3: { emoji: '😐', label: 'Bình thường', color: '#EAB308', bgClass: 'bg-yellow-50', borderClass: 'border-yellow-200', textClass: 'text-yellow-600' },
  4: { emoji: '😊', label: 'Tốt', color: '#22C55E', bgClass: 'bg-green-50', borderClass: 'border-green-200', textClass: 'text-green-600' },
  5: { emoji: '🤩', label: 'Tuyệt vời', color: '#8B5CF6', bgClass: 'bg-purple-50', borderClass: 'border-purple-200', textClass: 'text-purple-600' },
};

interface JournalDashboardProps {
  userId: string;
}

const JournalDashboard: React.FC<JournalDashboardProps> = ({ userId }) => {
  // Navigation sub-tabs
  const [activeTab, setActiveTab] = useState<'editor' | 'review'>('editor');
  
  // Editor States
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString(new Date()));
  const [content, setContent] = useState<string>('');
  const [initialContent, setInitialContent] = useState<string>('');
  const [mood, setMood] = useState<MoodLevel | undefined>(undefined);
  const [gratitude, setGratitude] = useState<string[]>(['', '', '']);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>('');
  const [writingPrompt, setWritingPrompt] = useState<string>('');
  const [entryExists, setEntryExists] = useState<boolean>(false);
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);

  // Custom delete confirmation modal state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);

  // System States
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [rewardAlert, setRewardAlert] = useState<{ totalStars: number; breakdown: { label: string; amount: number }[] } | null>(null);
  
  // Custom WYSIWYG editor key to force re-render when changing dates
  const [editorKey, setEditorKey] = useState<string>(getLocalDateString(new Date()) + '_new');
  
  // Color & Highlight Popover toggle
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState<boolean>(false);
  
  // States of current selection formatting
  const [activeStates, setActiveStates] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    list: false,
    listOrdered: false,
    h1: false,
    h2: false,
  });

  // Review & History States
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [stats, setStats] = useState<JournalStats | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMood, setFilterMood] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  
  // State to track expanded timeline entries in review tab
  const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({});

  // Ref to contentEditable editor div
  const editorRef = useRef<HTMLDivElement>(null);

  // Đồng bộ nội dung ban đầu vào editor qua ref (KHÔNG dùng dangerouslySetInnerHTML)
  // Chỉ chạy khi editorKey thay đổi (chuyển ngày, xóa bài, load dữ liệu)
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialContent;
    }
  }, [editorKey]);

  // Load câu hỏi gợi ý ngẫu nhiên lần đầu tiên
  useEffect(() => {
    setWritingPrompt(getRandomWritingPrompt());
  }, []);

  // Fetch dữ liệu nhật ký cho ngày được chọn
  useEffect(() => {
    if (!userId || !selectedDate) return;
    
    const loadEntryForDate = async () => {
      setIsLoading(true);
      const entry = await journalService.fetchEntryByDate(userId, selectedDate);
      if (entry) {
        setContent(entry.content);
        setInitialContent(entry.content);
        setEditorKey(selectedDate + '_' + entry.id);
        setMood(entry.mood);
        setGratitude([
          entry.gratitude[0] || '',
          entry.gratitude[1] || '',
          entry.gratitude[2] || ''
        ]);
        setTags(entry.tags || []);
        setWritingPrompt(entry.writing_prompt || getRandomWritingPrompt());
        setEntryExists(true);
        setCurrentEntryId(entry.id);
      } else {
        // Reset editor cho ngày mới chưa viết
        setContent('');
        setInitialContent('');
        setEditorKey(selectedDate + '_new');
        setMood(undefined);
        setGratitude(['', '', '']);
        setTags([]);
        setWritingPrompt(getRandomWritingPrompt());
        setEntryExists(false);
        setCurrentEntryId(null);
      }
      setIsLoading(false);
    };

    loadEntryForDate();
  }, [userId, selectedDate]);

  // Fetch danh sách lịch sử & stats khi chuyển sang tab Review
  useEffect(() => {
    if (!userId) return;
    
    const loadReviewData = async () => {
      const fetchedEntries = await journalService.fetchEntries(userId);
      setEntries(fetchedEntries);
      const fetchedStats = await journalService.fetchStats(userId);
      setStats(fetchedStats);
    };

    if (activeTab === 'review') {
      loadReviewData();
    }
  }, [userId, activeTab]);

  // Đổi câu hỏi gợi ý ngẫu nhiên
  const handleRefreshPrompt = () => {
    setWritingPrompt(getRandomWritingPrompt());
  };

  // Thêm tag vào danh sách
  const handleAddTag = () => {
    const cleanTag = tagInput.trim().toLowerCase().replace('#', '');
    if (cleanTag && !tags.includes(cleanTag)) {
      setTags([...tags, cleanTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // Rich Text helper: Thực thi lệnh định dạng kiểu Word
  const execCommand = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      setContent(editorRef.current.innerHTML);
    }
    checkCommandStates();
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    setContent(e.currentTarget.innerHTML);
  };

  const checkCommandStates = () => {
    setActiveStates({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      list: document.queryCommandState('insertUnorderedList'),
      listOrdered: document.queryCommandState('insertOrderedList'),
      h1: document.queryCommandValue('formatBlock') === 'h1',
      h2: document.queryCommandValue('formatBlock') === 'h2',
    });
  };

  // Đếm từ hiện tại trong editor (loại bỏ các thẻ HTML để đếm chính xác)
  const wordCount = useMemo(() => {
    const plainText = content.replace(/<[^>]*>/g, ' ').trim();
    return plainText ? plainText.split(/\s+/).length : 0;
  }, [content]);

  // Lưu nhật ký
  const handleSaveEntry = async () => {
    if (!userId) return;
    
    setIsSaving(true);
    const entryData = {
      entry_date: selectedDate,
      content,
      mood,
      gratitude: gratitude.filter(g => g.trim() !== ''),
      word_count: wordCount,
      is_favorite: false,
      writing_prompt: writingPrompt,
      tags
    };

    try {
      const saved = await journalService.saveEntry(userId, entryData);
      if (saved) {
        setEntryExists(true);
        setCurrentEntryId(saved.id);
        setInitialContent(content);

        // Xử lý cộng điểm thưởng StarBrain
        const reward = await processJournalReward({
          userId,
          wordCount,
          hasMood: !!mood,
          gratitudeCount: entryData.gratitude.length
        });

        if (reward) {
          setRewardAlert(reward);
          // Auto hide reward alert after 5s
          setTimeout(() => setRewardAlert(null), 5000);
        } else {
          alert('Đã lưu nhật ký thành công!');
        }
      } else {
        alert('Có lỗi xảy ra khi lưu nhật ký. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error(err);
      alert('Không thể lưu nhật ký vào lúc này.');
    } finally {
      setIsSaving(false);
    }
  };

  // Xóa nhật ký hiện tại
  const handleDeleteEntry = () => {
    if (!currentEntryId) return;
    setConfirmDeleteOpen(true);
  };

  const executeDeleteEntry = async () => {
    if (!currentEntryId) return;

    setIsLoading(true);
    const ok = await journalService.deleteEntry(currentEntryId);
    if (ok) {
      setContent('');
      setInitialContent('');
      setMood(undefined);
      setGratitude(['', '', '']);
      setTags([]);
      setEntryExists(false);
      setCurrentEntryId(null);
      setEditorKey(selectedDate + '_deleted_' + Date.now());
      alert('Đã xóa bài nhật ký thành công.');
    } else {
      alert('Có lỗi khi xóa bài nhật ký.');
    }
    setIsLoading(false);
  };

  // ── LOGIC LỊCH THÁNG (Calendar) ──
  const daysInMonth = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const date = new Date(year, month, 1);
    const days = [];
    
    // Đệm các ngày của tháng trước (nếu mùng 1 không là Thứ 2)
    let startDay = date.getDay(); // 0 = Chủ nhật, 1 = Thứ 2...
    if (startDay === 0) startDay = 7; // Chuẩn hóa Thứ 2 là đầu tuần
    for (let i = 1; i < startDay; i++) {
      days.push(null);
    }

    // Các ngày trong tháng hiện tại
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [calendarDate]);

  const handlePrevMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };

  // Lấy danh sách tag độc nhất để hiển thị bộ lọc filter
  const allUniqueTags = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => e.tags?.forEach(t => set.add(t)));
    return Array.from(set);
  }, [entries]);

  // Bộ lọc danh sách timeline entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const matchesSearch = searchQuery.trim() === '' || 
        e.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.gratitude.some(g => g.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesMood = filterMood === 'all' || e.mood?.toString() === filterMood;
      const matchesTag = filterTag === 'all' || e.tags?.includes(filterTag);

      return matchesSearch && matchesMood && matchesTag;
    });
  }, [entries, searchQuery, filterMood, filterTag]);

  // Chuyển biểu đồ Recharts dữ liệu cảm xúc
  const moodChartData = useMemo(() => {
    return [...entries]
      .reverse() // Sắp xếp từ cũ nhất đến mới nhất
      .filter(e => e.mood)
      .slice(-15) // Chỉ hiển thị 15 ngày gần nhất
      .map(e => ({
        date: new Date(e.entry_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        'Cảm xúc': e.mood,
        label: MOOD_CONFIG[e.mood as MoodLevel]?.label
      }));
  }, [entries]);

  return (
    <JournalPinGuard userId={userId}>
      <div className="w-full max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-8">
      {/* 1. Header & Navigation tabs */}
      <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-800 flex items-center gap-2.5">
            <BookOpen className="text-emerald-500" size={32} />
            <span>Nhật ký cuộc sống</span>
          </h1>
          <p className="text-sm text-gray-500 font-medium">Ghi lại dòng suy nghĩ, cảm xúc và những điều tốt lành mỗi ngày</p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200 self-start md:self-auto shrink-0 shadow-inner">
          <button 
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'editor' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Edit2 size={16} /> Viết Nhật Ký
          </button>
          <button 
            onClick={() => setActiveTab('review')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'review' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <BarChart2 size={16} /> Xem Lại & Thống Kê
          </button>
        </div>
      </header>

      {/* Pop-up thưởng sao bay khi nhận thưởng */}
      {rewardAlert && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] max-w-sm w-[90%] bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 rounded-3xl p-5 shadow-2xl text-white animate-in zoom-in-95 duration-300 relative border border-yellow-300">
          <button 
            onClick={() => setRewardAlert(null)}
            className="absolute top-3 right-3 p-1.5 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={16} />
          </button>
          <div className="text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 border border-white/30 shadow-inner animate-bounce">
              <Star size={36} className="text-yellow-200 fill-yellow-300" />
            </div>
            <h3 className="text-xl font-black mb-1">Xuất Sắc! +{rewardAlert.totalStars} Sao ⭐</h3>
            <p className="text-xs text-yellow-100 mb-4">Bạn vừa tích lũy thêm năng lượng StarBrain!</p>
            
            <div className="space-y-1.5 bg-black/10 rounded-2xl p-3 text-left">
              {rewardAlert.breakdown.map((b, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span>{b.label}</span>
                  <span className="font-bold">+{b.amount}⭐</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. SUB-TAB 1: EDITOR (VIẾT NHẬT KÝ) */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel: Editor Area */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-100 space-y-5">
              {/* Chọn Ngày & Tiêu đề phụ */}
              <div className="flex flex-row items-center justify-between gap-3 border-b border-gray-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-gray-400">Ngày viết:</span>
                  <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    max={getLocalDateString(new Date())}
                    className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-250 font-bold text-xs sm:text-sm text-gray-700 outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* Nút lưu nhanh tiện lợi trên Mobile và Desktop */}
                  <button
                    onClick={handleSaveEntry}
                    disabled={isSaving || content.trim() === ''}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                      content.trim() === ''
                        ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-250 shadow-sm'
                    }`}
                    title={entryExists ? 'Cập nhật bài viết' : 'Lưu bài viết'}
                  >
                    {isSaving ? (
                      <span className="animate-spin text-[10px]">⏳</span>
                    ) : (
                      <CheckCircle size={12} />
                    )}
                    <span>{entryExists ? 'Cập nhật' : 'Lưu'}</span>
                  </button>

                  {entryExists && (
                    <button 
                      onClick={handleDeleteEntry}
                      className="flex items-center justify-center p-2 text-red-500 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-200 transition-all"
                      title="Xóa nhật ký ngày này"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Mood Picker - Grid 5 cột đều đặn, màu sắc trực quan theo từng cảm xúc */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs sm:text-sm font-black text-gray-700 uppercase tracking-wider">Cảm xúc hôm nay</label>
                  {mood && (
                    <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${MOOD_CONFIG[mood].bgClass} ${MOOD_CONFIG[mood].borderClass} ${MOOD_CONFIG[mood].textClass}`}>
                      {MOOD_CONFIG[mood].label}
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
                  {(Object.keys(MOOD_CONFIG) as unknown as MoodLevel[]).map((levelKey) => {
                    const m = MOOD_CONFIG[levelKey];
                    const isSelected = mood === Number(levelKey);
                    
                    // Tạo kiểu viền bóng động khi select dựa trên mood color cấu hình
                    const activeStyles = isSelected
                      ? `${m.bgClass} ${m.borderClass} ${m.textClass} ring-2 ring-offset-1`
                      : 'bg-gray-50/50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:border-gray-300 hover:text-gray-700';

                    return (
                      <button
                        key={levelKey}
                        type="button"
                        onClick={() => setMood(Number(levelKey) as MoodLevel)}
                        className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-2xl border font-bold transition-all duration-300 hover:scale-[1.03] active:scale-95 text-center gap-1 sm:gap-1.5 w-full cursor-pointer relative overflow-hidden group ${activeStyles}`}
                        style={{ 
                          // Gán ring color động thông qua biến css nếu được chọn
                          boxShadow: isSelected ? `0 0 0 2px ${m.color}25` : undefined,
                          borderColor: isSelected ? m.color : undefined
                        }}
                      >
                        <span className={`text-2xl sm:text-3xl transition-transform duration-300 ${isSelected ? 'scale-110 animate-bounce' : 'group-hover:scale-110'}`}>
                          {m.emoji}
                        </span>
                        <span className="text-[10px] sm:text-xs font-black tracking-tight block truncate w-full">
                          {m.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Writing Prompt Widget */}
              <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100 flex gap-3 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-100 rounded-full blur-2xl opacity-50" />
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl h-fit shrink-0">
                  <Sparkles size={18} className="animate-pulse" />
                </div>
                <div className="space-y-1 relative z-10 flex-1 min-w-0 pr-6">
                  <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Gợi ý chủ đề viết hôm nay</span>
                  <p className="text-sm text-emerald-900 font-medium leading-relaxed italic">{writingPrompt}</p>
                </div>
                <button
                  type="button"
                  onClick={handleRefreshPrompt}
                  className="absolute top-3 right-3 text-emerald-600 hover:bg-emerald-100 p-1.5 rounded-lg transition-colors"
                  title="Đổi câu hỏi gợi ý"
                >
                  🔄
                </button>
              </div>

              {/* Text Editor Wrapper */}
              <div className="space-y-3 bg-white rounded-2xl border border-gray-150 p-4 shadow-sm">
                {/* Formatting Toolbar */}
                <div className="flex flex-wrap items-center gap-1 pb-3 border-b border-gray-100">
                  {/* Headings */}
                  <button
                    type="button"
                    onClick={() => {
                      const isH1 = document.queryCommandValue('formatBlock') === 'h1';
                      execCommand('formatBlock', isH1 ? '<p>' : '<h1>');
                    }}
                    className={`p-2 rounded-xl transition-colors font-bold text-xs ${
                      activeStates.h1 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                    title="Tiêu đề lớn (H1)"
                  >
                    H1
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      const isH2 = document.queryCommandValue('formatBlock') === 'h2';
                      execCommand('formatBlock', isH2 ? '<p>' : '<h2>');
                    }}
                    className={`p-2 rounded-xl transition-colors font-bold text-xs ${
                      activeStates.h2 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                    title="Tiêu đề nhỏ (H2)"
                  >
                    H2
                  </button>

                  <div className="h-6 w-px bg-gray-200 mx-1" />

                  {/* Text formats */}
                  <button
                    type="button"
                    onClick={() => execCommand('bold')}
                    className={`p-2 rounded-xl transition-colors ${
                      activeStates.bold 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                    title="Chữ đậm (Ctrl+B)"
                  >
                    <Bold size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => execCommand('italic')}
                    className={`p-2 rounded-xl transition-colors ${
                      activeStates.italic 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                    title="Chữ nghiêng (Ctrl+I)"
                  >
                    <Italic size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => execCommand('underline')}
                    className={`p-2 rounded-xl transition-colors ${
                      activeStates.underline 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                    title="Gạch chân (Ctrl+U)"
                  >
                    <Underline size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => execCommand('strikeThrough')}
                    className={`p-2 rounded-xl transition-colors ${
                      activeStates.strikeThrough 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                    title="Gạch ngang"
                  >
                    <Strikethrough size={16} />
                  </button>

                  <div className="h-6 w-px bg-gray-200 mx-1" />

                  {/* Lists */}
                  <button
                    type="button"
                    onClick={() => execCommand('insertUnorderedList')}
                    className={`p-2 rounded-xl transition-colors ${
                      activeStates.list 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                    title="Danh sách dấu chấm"
                  >
                    <List size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => execCommand('insertOrderedList')}
                    className={`p-2 rounded-xl transition-colors ${
                      activeStates.listOrdered 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                    title="Danh sách số"
                  >
                    <ListOrdered size={16} />
                  </button>

                  <div className="h-6 w-px bg-gray-200 mx-1" />

                  {/* Alignments */}
                  <button
                    type="button"
                    onClick={() => execCommand('justifyLeft')}
                    className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-gray-700 transition-colors"
                    title="Căn trái"
                  >
                    <AlignLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => execCommand('justifyCenter')}
                    className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-gray-700 transition-colors"
                    title="Căn giữa"
                  >
                    <AlignCenter size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => execCommand('justifyRight')}
                    className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-gray-700 transition-colors"
                    title="Căn phải"
                  >
                    <AlignRight size={16} />
                  </button>

                  <div className="h-6 w-px bg-gray-200 mx-1" />

                  {/* Color & Highlight Picker Buttons with Dropdowns */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowColorPicker(!showColorPicker);
                        setShowHighlightPicker(false);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-0.5"
                      title="Màu chữ"
                    >
                      <Palette size={16} />
                    </button>
                    
                    {showColorPicker && (
                      <div className="absolute left-0 mt-1 p-2 bg-white border border-gray-200 rounded-xl shadow-lg flex gap-1.5 z-50">
                        {[
                          { color: '#1F2937', label: 'Mặc định' },
                          { color: '#EF4444', label: 'Đỏ' },
                          { color: '#3B82F6', label: 'Xanh dương' },
                          { color: '#10B981', label: 'Xanh lá' },
                          { color: '#8B5CF6', label: 'Tím' },
                          { color: '#F97316', label: 'Cam' }
                        ].map(item => (
                          <button
                            key={item.color}
                            type="button"
                            onClick={() => {
                              execCommand('foreColor', item.color);
                              setShowColorPicker(false);
                            }}
                            className="w-6 h-6 rounded-full border border-gray-200 cursor-pointer shadow-sm hover:scale-110 transition-transform shrink-0"
                            style={{ backgroundColor: item.color }}
                            title={item.label}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowHighlightPicker(!showHighlightPicker);
                        setShowColorPicker(false);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-0.5"
                      title="Tô màu nền (Highlight)"
                    >
                      <Highlighter size={16} />
                    </button>

                    {showHighlightPicker && (
                      <div className="absolute left-0 mt-1 p-2 bg-white border border-gray-200 rounded-xl shadow-lg flex gap-1.5 z-50">
                        {[
                          { color: 'transparent', label: 'Không nền' },
                          { color: '#FEF08A', label: 'Vàng' },
                          { color: '#BBF7D0', label: 'Xanh lá' },
                          { color: '#BFDBFE', label: 'Xanh dương' },
                          { color: '#FBCFE8', label: 'Hồng' }
                        ].map(item => (
                          <button
                            key={item.color}
                            type="button"
                            onClick={() => {
                              execCommand('backColor', item.color);
                              setShowHighlightPicker(false);
                            }}
                            className="w-6 h-6 rounded-full border border-gray-200 cursor-pointer shadow-sm hover:scale-110 transition-transform shrink-0 flex items-center justify-center"
                            style={{ backgroundColor: item.color }}
                            title={item.label}
                          >
                            {item.color === 'transparent' && <span className="text-[10px] text-gray-400">❌</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => execCommand('removeFormat')}
                    className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-red-500 transition-colors"
                    title="Xóa định dạng"
                  >
                    <Eraser size={16} />
                  </button>
                </div>

                {/* WYSIWYG Editor Canvas */}
                {isLoading ? (
                  <div className="h-80 flex flex-col items-center justify-center text-gray-400 gap-2 border border-dashed border-gray-200 rounded-2xl bg-gray-50/30">
                    <span className="animate-spin text-xl">⏳</span>
                    <span className="text-xs font-medium">Đang tải nhật ký...</span>
                  </div>
                ) : (
                  <div
                    key={editorKey}
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onKeyUp={checkCommandStates}
                    onMouseUp={checkCommandStates}
                    data-placeholder="Hãy viết gì đó về ngày hôm nay của bạn... (Bật mí: Viết từ 50 từ trở lên để nhận thưởng 10⭐ StarBrain nhé!)"
                    className="w-full min-h-[360px] max-h-[500px] p-4 border border-gray-150 rounded-xl outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-sans text-gray-800 overflow-y-auto leading-relaxed bg-gray-50/20 prose max-w-none prose-sm cursor-text focus:bg-white"
                    style={{ wordBreak: 'break-word' }}
                  />
                )}

                {/* Word Count Indicator */}
                <div className="flex justify-between items-center text-xs pt-2 border-t border-gray-100">
                  <span className="text-gray-400 font-medium flex items-center gap-1">
                    <Clock size={12} /> Tự động lưu bản nháp cục bộ
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <span className={`font-bold px-2 py-0.5 rounded-lg border ${
                      wordCount >= 50 
                        ? 'text-green-700 bg-green-50 border-green-200' 
                        : 'text-red-500 bg-red-50 border-red-100'
                    }`}>
                      {wordCount} từ
                    </span>
                    {wordCount < 50 && (
                      <span className="text-[10px] font-bold text-red-400">(Cần thêm {50 - wordCount} từ để nhận 10⭐)</span>
                    )}
                    {wordCount >= 50 && (
                      <span className="text-[10px] font-black text-green-500 flex items-center gap-0.5 animate-pulse">
                        <Star size={10} className="fill-green-500" /> Đạt mốc thưởng
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel: Gratitude & Tags */}
          <div className="space-y-6">
            {/* Gratitude Section */}
            <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-100 space-y-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2 text-base">
                <Heart size={18} className="text-rose-500 fill-rose-50" />
                <span>3 điều biết ơn hôm nay</span>
              </h3>
              <p className="text-xs text-gray-400 font-medium">Viết về những khoảnh khắc tích cực giúp bạn lạc quan và hạnh phúc hơn.</p>
              
              <div className="space-y-3">
                {[0, 1, 2].map((idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-sm font-black text-rose-300 w-4">{idx + 1}.</span>
                    <input
                      type="text"
                      value={gratitude[idx] || ''}
                      onChange={(e) => {
                        const newGratitude = [...gratitude];
                        newGratitude[idx] = e.target.value;
                        setGratitude(newGratitude);
                      }}
                      placeholder="Điều biết ơn thứ..."
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 outline-none focus:border-rose-300 focus:bg-white transition-all"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Tags Section */}
            <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-100 space-y-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2 text-base">
                <span className="text-emerald-500">#</span>
                <span>Từ khóa & Chủ đề (Tags)</span>
              </h3>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  placeholder="Ví dụ: hoctap, chill"
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 outline-none focus:border-emerald-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl font-bold text-sm transition-colors"
                >
                  Thêm
                </button>
              </div>

              {/* Tag Badges List */}
              <div className="flex flex-wrap gap-1.5 pt-2">
                {tags.length > 0 ? (
                  tags.map(t => (
                    <span 
                      key={t}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-55 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg text-xs font-bold"
                    >
                      #{t}
                      <button 
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="hover:bg-emerald-200/50 rounded-full p-0.5 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400 italic">Chưa gắn tag nào. Hãy gõ tag để phân loại bài viết của bạn.</span>
                )}
              </div>
            </div>

            {/* Action Save Button */}
            <button
              onClick={handleSaveEntry}
              disabled={isSaving || content.trim() === ''}
              className={`w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-100 hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none`}
            >
              {isSaving ? (
                <>
                  <span className="animate-spin text-sm">⏳</span>
                  Đang lưu bài viết...
                </>
              ) : (
                <>
                  <CheckCircle size={18} />
                  {entryExists ? 'Cập Nhật Nhật Ký' : 'Lưu Nhật Ký Hôm Nay'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 3. SUB-TAB 2: REVIEW (XEM LẠI & THỐNG KÊ) */}
      {activeTab === 'review' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* Row 1: Streak stats & Calendar grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Quick Stats Panel */}
            <div className="bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-sm flex flex-col justify-between space-y-4">
              <h3 className="font-bold text-gray-800 text-base">Thành tích viết lách</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-4 text-center">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 mx-auto mb-2">
                    <Flame size={20} />
                  </div>
                  <span className="text-[10px] font-black uppercase text-orange-700 block tracking-wider">Viết liên tục</span>
                  <span className="text-2xl font-black text-orange-600">{stats?.currentStreak || 0} ngày</span>
                </div>

                <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 text-center">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 mx-auto mb-2">
                    <Award size={20} />
                  </div>
                  <span className="text-[10px] font-black uppercase text-amber-700 block tracking-wider">Kỷ lục chuỗi</span>
                  <span className="text-2xl font-black text-amber-600">{stats?.longestStreak || 0} ngày</span>
                </div>

                <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 text-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mx-auto mb-2">
                    <BookOpen size={20} />
                  </div>
                  <span className="text-[10px] font-black uppercase text-blue-700 block tracking-wider">Tổng số bài</span>
                  <span className="text-2xl font-black text-blue-600">{stats?.totalEntries || 0} bài</span>
                </div>

                <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 text-center">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 mx-auto mb-2">
                    <Clock size={20} />
                  </div>
                  <span className="text-[10px] font-black uppercase text-emerald-700 block tracking-wider">Tổng số từ</span>
                  <span className="text-2xl font-black text-emerald-600">{stats?.totalWords || 0} từ</span>
                </div>
              </div>

              {stats && stats.totalEntries > 0 && (
                <div className="border-t border-gray-100 pt-3 flex items-center justify-between text-xs text-gray-500 font-semibold">
                  <span>Cảm xúc trung bình:</span>
                  <div className="flex items-center gap-1.5 bg-yellow-50 border border-yellow-100 text-yellow-700 px-2 py-0.5 rounded-lg">
                    <span>{MOOD_CONFIG[Math.round(stats.averageMood) as MoodLevel]?.emoji}</span>
                    <span>{stats.averageMood.toFixed(1)} / 5</span>
                  </div>
                </div>
              )}
            </div>

            {/* Calendar Grid View */}
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm md:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-800 text-base">Lịch cảm xúc</h3>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handlePrevMonth}
                    className="p-1.5 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm font-bold text-gray-700 min-w-[100px] text-center capitalize">
                    Tháng {calendarDate.getMonth() + 1} / {calendarDate.getFullYear()}
                  </span>
                  <button 
                    onClick={handleNextMonth}
                    className="p-1.5 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Grid 7 columns */}
              <div className="grid grid-cols-7 gap-1 md:gap-2 text-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-50 pb-2">
                <span>T2</span>
                <span>T3</span>
                <span>T4</span>
                <span>T5</span>
                <span>T6</span>
                <span>T7</span>
                <span>CN</span>
              </div>

              <div className="grid grid-cols-7 gap-1 md:gap-2">
                {daysInMonth.map((day, index) => {
                  if (!day) return <div key={`empty-${index}`} className="aspect-square" />;

                  const dateStr = getLocalDateString(day);
                  const entry = entries.find(e => e.entry_date === dateStr);
                  const moodColor = entry?.mood ? MOOD_CONFIG[entry.mood]?.color : null;
                  const isSelected = selectedDate === dateStr;

                  return (
                    <button
                      key={dateStr}
                      onClick={() => {
                        setSelectedDate(dateStr);
                        setActiveTab('editor');
                      }}
                      style={{ borderLeftColor: moodColor || 'transparent' }}
                      className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all border border-gray-100 hover:bg-emerald-50 hover:border-emerald-200 group ${
                        isSelected 
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-extrabold ring-1 ring-emerald-500 shadow-sm' 
                          : 'bg-gray-50/50 text-gray-700 hover:text-emerald-700'
                      }`}
                    >
                      <span className="text-xs sm:text-sm">{day.getDate()}</span>
                      
                      {/* Mood dot */}
                      {entry?.mood && (
                        <span 
                          style={{ backgroundColor: moodColor || undefined }}
                          className="w-1.5 h-1.5 rounded-full absolute bottom-1.5"
                          title={MOOD_CONFIG[entry.mood]?.label}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 2: Mood chart & Mood distribution statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Chart Area */}
            <div className="bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-sm md:col-span-2 space-y-4">
              <h3 className="font-bold text-gray-800 text-base flex items-center gap-1.5">
                <BarChart2 size={18} className="text-indigo-500" />
                <span>Xu hướng cảm xúc gần đây</span>
              </h3>
              
              <div className="h-64 w-full">
                {moodChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={moodChartData}
                      margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorMood" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} style={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }} />
                      <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tickLine={false} axisLine={false} style={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} 
                        labelClassName="font-bold text-xs text-gray-800"
                        itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#059669' }}
                      />
                      <Area type="monotone" dataKey="Cảm xúc" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorMood)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2 border border-dashed border-gray-100 rounded-2xl">
                    <span className="text-2xl">📊</span>
                    <span className="text-xs">Cần ghi nhận cảm xúc nhiều ngày hơn để xem xu hướng biểu đồ.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Mood distribution & Top tags */}
            <div className="bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-sm space-y-6">
              {/* Mood distribution progress bars */}
              <div className="space-y-4">
                <h3 className="font-bold text-gray-800 text-sm">Phân bố cảm xúc</h3>
                <div className="space-y-2.5">
                  {(Object.keys(MOOD_CONFIG) as unknown as MoodLevel[]).reverse().map(mKey => {
                    const m = MOOD_CONFIG[mKey];
                    const count = stats?.moodDistribution[mKey] || 0;
                    const percent = stats?.totalEntries ? (count / stats.totalEntries) * 100 : 0;
                    return (
                      <div key={mKey} className="flex items-center gap-2">
                        <span className="text-base leading-none w-5">{m.emoji}</span>
                        <div className="flex-1 bg-gray-50 rounded-full h-3 border border-gray-100 relative overflow-hidden">
                          <div 
                            style={{ width: `${percent}%`, backgroundColor: m.color }}
                            className="h-full rounded-full transition-all duration-500"
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-500 w-8 text-right">{count} lần</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Tags */}
              <div className="border-t border-gray-50 pt-4 space-y-3">
                <h3 className="font-bold text-gray-800 text-sm">Chủ đề được viết nhiều nhất</h3>
                <div className="flex flex-wrap gap-1.5">
                  {stats && stats.topTags.length > 0 ? (
                    stats.topTags.map(t => (
                      <span 
                        key={t.tag}
                        onClick={() => setFilterTag(t.tag)}
                        className="cursor-pointer hover:bg-emerald-100 transition-colors inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs font-bold"
                      >
                        #{t.tag}
                        <span className="px-1.5 py-0.2 bg-emerald-700 text-white rounded text-[10px] font-bold">{t.count}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400 italic">Chưa có thẻ tag được thống kê.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Filter Tools and Timeline Feed */}
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-6">
            {/* Filter Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-50 pb-4">
              <h3 className="font-bold text-gray-800 text-base">Lịch sử bài viết ({filteredEntries.length})</h3>
              
              <div className="flex flex-wrap gap-2 items-center">
                {/* Search query */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm nội dung..."
                    className="pl-9 pr-4 py-2 w-44 bg-gray-50 hover:bg-gray-100 focus:bg-white border border-gray-200 focus:border-emerald-500 rounded-xl text-xs font-medium outline-none transition-colors"
                  />
                </div>

                {/* Mood Filter */}
                <select
                  value={filterMood}
                  onChange={(e) => setFilterMood(e.target.value)}
                  className="px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 outline-none cursor-pointer"
                >
                  <option value="all">Tất cả cảm xúc</option>
                  {(Object.keys(MOOD_CONFIG) as unknown as MoodLevel[]).map(mKey => (
                    <option key={mKey} value={mKey}>{MOOD_CONFIG[mKey].emoji} {MOOD_CONFIG[mKey].label}</option>
                  ))}
                </select>

                {/* Tag Filter */}
                <select
                  value={filterTag}
                  onChange={(e) => setFilterTag(e.target.value)}
                  className="px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 outline-none cursor-pointer"
                >
                  <option value="all">Tất cả thẻ tag</option>
                  {allUniqueTags.map(tag => (
                    <option key={tag} value={tag}>#{tag}</option>
                  ))}
                </select>

                {/* Clear filters buttons */}
                {(filterMood !== 'all' || filterTag !== 'all' || searchQuery.trim() !== '') && (
                  <button
                    onClick={() => {
                      setFilterMood('all');
                      setFilterTag('all');
                      setSearchQuery('');
                    }}
                    className="p-2 hover:bg-red-50 text-red-500 rounded-xl transition-colors text-xs font-bold"
                  >
                    Xóa lọc
                  </button>
                )}
              </div>
            </div>

            {/* Timeline Feed List */}
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredEntries.length > 0 ? (
                filteredEntries.map(entry => {
                  const moodInfo = entry.mood ? MOOD_CONFIG[entry.mood] : null;
                  return (
                    <div 
                      key={entry.id}
                      className="group border border-gray-100 bg-gray-50/30 hover:bg-white hover:border-emerald-100 rounded-2xl p-4 transition-all duration-300 relative flex gap-4"
                    >
                      {/* Left timeline line and dot */}
                      <div className="flex flex-col items-center shrink-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold shadow-sm ${
                          moodInfo ? moodInfo.bgClass + ' border ' + moodInfo.borderClass : 'bg-gray-100 text-gray-500'
                        }`}>
                          {moodInfo ? moodInfo.emoji : '📝'}
                        </div>
                        <div className="flex-1 w-0.5 bg-gray-100 group-hover:bg-emerald-100 my-2" />
                      </div>

                      {/* Content panel */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <span className="font-bold text-sm text-gray-800">
                              {new Date(entry.entry_date).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                            {moodInfo && (
                              <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-lg border ${moodInfo.bgClass} ${moodInfo.borderClass} ${moodInfo.textClass}`}>
                                {moodInfo.label}
                              </span>
                            )}
                          </div>
                          
                          <button
                            onClick={() => {
                              setSelectedDate(entry.entry_date);
                              setActiveTab('editor');
                            }}
                            className="opacity-0 group-hover:opacity-100 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-xs border border-emerald-100 transition-all flex items-center gap-1.5"
                          >
                            <Edit2 size={10} /> Chỉnh sửa
                          </button>
                        </div>

                        {/* Content text */}
                        {(() => {
                          const plainText = entry.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                          const isLong = plainText.length > 180;
                          const isExpanded = !!expandedEntries[entry.id];

                          if (!isLong) {
                            return (
                              <div 
                                className="text-xs sm:text-sm text-gray-700 leading-relaxed break-words [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-medium [&_p]:my-1 font-medium"
                                dangerouslySetInnerHTML={{ __html: entry.content }}
                              />
                            );
                          }

                          if (isExpanded) {
                            return (
                              <div className="space-y-1.5">
                                <div 
                                  className="text-xs sm:text-sm text-gray-700 leading-relaxed break-words [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-medium [&_p]:my-1 font-medium"
                                  dangerouslySetInnerHTML={{ __html: entry.content }}
                                />
                                <button
                                  type="button"
                                  onClick={() => setExpandedEntries(prev => ({ ...prev, [entry.id]: false }))}
                                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline mt-1 focus:outline-none flex items-center gap-1"
                                >
                                  Thu gọn
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-1.5">
                              <div className="text-xs sm:text-sm text-gray-600 line-clamp-3 leading-relaxed">
                                {plainText}
                              </div>
                              <button
                                type="button"
                                onClick={() => setExpandedEntries(prev => ({ ...prev, [entry.id]: true }))}
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline mt-1 focus:outline-none flex items-center gap-1"
                              >
                                Xem thêm
                              </button>
                            </div>
                          );
                        })()}

                        {/* Gratitude items in history */}
                        {entry.gratitude.length > 0 && (
                          <div className="bg-rose-50/20 border border-rose-100/50 rounded-xl p-2.5 space-y-1">
                            <span className="text-[9px] font-black uppercase text-rose-500 flex items-center gap-1">
                              <Heart size={10} className="fill-rose-300 text-rose-400" /> Biết ơn hôm nay:
                            </span>
                            <div className="space-y-0.5 pl-3">
                              {entry.gratitude.map((g, idx) => (
                                <p key={idx} className="text-xs text-gray-500 font-medium leading-relaxed">
                                  {idx + 1}. {g}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tags and stats footer */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          <div className="flex flex-wrap gap-1">
                            {entry.tags?.map(t => (
                              <span 
                                key={t}
                                onClick={() => setFilterTag(t)}
                                className="cursor-pointer hover:bg-emerald-100 text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                          <span className="text-[10px] font-semibold text-gray-400">
                            {entry.word_count} từ
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-gray-400 italic">
                  Không có nhật ký nào trùng với điều kiện tìm lọc.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom delete confirmation modal */}
      <ConfirmModal
        isOpen={confirmDeleteOpen}
        title="Xóa nhật ký"
        message="Bạn có chắc chắn muốn xóa bài viết nhật ký ngày hôm nay không? Thao tác này sẽ không thể khôi phục lại."
        onConfirm={executeDeleteEntry}
        onCancel={() => setConfirmDeleteOpen(false)}
        confirmText="Xóa nhật ký"
        cancelText="Hủy"
      />
      </div>
    </JournalPinGuard>
  );
};

export default JournalDashboard;
