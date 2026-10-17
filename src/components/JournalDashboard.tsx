import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Flame, Heart, Loader2, Plus, RefreshCw, Sparkles, Star, Trash2, X } from 'lucide-react';
import { journalService, getRandomWritingPrompt, getLocalDateString } from '../services/journalService';
import { processJournalReward } from '../services/starBrainService';
import { JournalEntry, JournalStats, MoodLevel } from '../types';
import { JournalPinGuard } from './JournalPinGuard';
import { Button, Card, CardHeader, IconButton, Segmented, Sheet, inputClass } from './ui/parts';
import { MOOD_LEVELS, MOODS, getMood } from './journal/mood';
import { EMPTY_FORMAT, FormatState, RichToolbar } from './journal/RichToolbar';
import { JournalReview, parseLocalDate, plainText } from './journal/JournalReview';

interface JournalDashboardProps {
  userId: string;
}

type Tab = 'editor' | 'review';

// What is saved for one day. Gratitude always has three slots so the inputs stay stable.
interface Snapshot {
  content: string;
  mood?: MoodLevel;
  gratitude: string[];
  tags: string[];
}

const EMPTY: Snapshot = { content: '', mood: undefined, gratitude: ['', '', ''], tags: [] };
const REWARD_WORDS = 50;

const toSnapshot = (e: JournalEntry | null): Snapshot =>
  e
    ? { content: e.content, mood: e.mood, gratitude: [0, 1, 2].map(i => e.gratitude[i] || ''), tags: e.tags || [] }
    : EMPTY;
const sameSnapshot = (a: Snapshot, b: Snapshot) => JSON.stringify(a) === JSON.stringify(b);

// Unsaved changes are kept per user and day in localStorage until they are saved or discarded.
const draftKey = (userId: string, date: string) => `smartlife:journal-draft:${userId}:${date}`;
const readDraft = (key: string): Snapshot | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
};
const writeDraft = (key: string, s: Snapshot) => {
  try {
    localStorage.setItem(key, JSON.stringify(s));
  } catch {
    /* storage unavailable: drafts are a convenience only */
  }
};
const removeDraft = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

const shiftDate = (date: string, days: number) => {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + days);
  return getLocalDateString(d);
};

const dateLabel = (date: string, today: string) => {
  if (date === today) return 'Hôm nay';
  if (date === shiftDate(today, -1)) return 'Hôm qua';
  const s = parseLocalDate(date).toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

type Toast =
  | { kind: 'reward'; totalStars: number; breakdown: { label: string; amount: number }[] }
  | { kind: 'info' | 'error'; text: string };

const JournalDashboard: React.FC<JournalDashboardProps> = ({ userId }) => {
  const today = getLocalDateString(new Date());
  const [tab, setTab] = useState<Tab>('editor');

  // Editor
  const [selectedDate, setSelectedDate] = useState(today);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<MoodLevel | undefined>();
  const [gratitude, setGratitude] = useState<string[]>(['', '', '']);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [writingPrompt, setWritingPrompt] = useState(() => getRandomWritingPrompt());
  const [saved, setSaved] = useState<Snapshot>(EMPTY);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [format, setFormat] = useState<FormatState>(EMPTY_FORMAT);
  const [editorKey, setEditorKey] = useState(0);

  // System
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // Review
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [stats, setStats] = useState<JournalStats | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  // Latest HTML, so a remounted editor (after switching tabs) gets its text back.
  const contentRef = useRef('');
  contentRef.current = content;

  const current: Snapshot = useMemo(() => ({ content, mood, gratitude, tags }), [content, mood, gratitude, tags]);
  const dirty = !sameSnapshot(current, saved);
  const ready = !isLoading && loadedDate === selectedDate;

  const applySnapshot = useCallback((s: Snapshot) => {
    setContent(s.content);
    setMood(s.mood);
    setGratitude(s.gratitude);
    setTags(s.tags);
    setEditorKey(k => k + 1);
  }, []);

  // Fill the contentEditable when a day is loaded or the editor is shown again. Typing never re-renders it.
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = contentRef.current;
  }, [editorKey, tab, isLoading]);

  // Load the entry for the selected day, then a local draft on top of it if one exists.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      const entry = await journalService.fetchEntryByDate(userId, selectedDate);
      if (cancelled) return;
      const server = toSnapshot(entry);
      const key = draftKey(userId, selectedDate);
      const draft = readDraft(key);
      const useDraft = !!draft && !sameSnapshot(draft, server);
      if (draft && !useDraft) removeDraft(key);

      setSaved(server);
      setEntryId(entry?.id ?? null);
      applySnapshot(useDraft ? draft! : server);
      setDraftRestored(useDraft);
      setWritingPrompt(entry?.writing_prompt || getRandomWritingPrompt());
      setTagInput('');
      setLoadedDate(selectedDate);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, selectedDate, applySnapshot]);

  // Keep the draft in step with the editor.
  useEffect(() => {
    if (!ready || !userId) return;
    const key = draftKey(userId, selectedDate);
    if (dirty) writeDraft(key, current);
    else removeDraft(key);
  }, [ready, dirty, current, userId, selectedDate]);

  const loadStats = useCallback(async () => {
    if (!userId) return;
    setStats(await journalService.fetchStats(userId));
  }, [userId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (!userId || tab !== 'review') return;
    let cancelled = false;
    setReviewLoading(true);
    (async () => {
      const [list, s] = await Promise.all([journalService.fetchEntries(userId), journalService.fetchStats(userId)]);
      if (cancelled) return;
      setEntries(list);
      setStats(s);
      setReviewLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, tab]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.kind === 'reward' ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Editor helpers ──

  const readFormat = () =>
    setFormat({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      list: document.queryCommandState('insertUnorderedList'),
      listOrdered: document.queryCommandState('insertOrderedList'),
      h1: document.queryCommandValue('formatBlock') === 'h1',
      h2: document.queryCommandValue('formatBlock') === 'h2',
    });

  const exec = (command: string, value = '') => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    if (editorRef.current) setContent(editorRef.current.innerHTML);
    readFormat();
  };

  const wordCount = useMemo(() => {
    const text = plainText(content);
    return text ? text.split(' ').length : 0;
  }, [content]);

  const addTag = () => {
    const clean = tagInput.trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, '-');
    if (clean && !tags.includes(clean)) setTags([...tags, clean]);
    setTagInput('');
  };

  const goToDate = (date: string) => {
    if (date > today) return;
    setSelectedDate(date);
    setTab('editor');
  };

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
      input.click();
    }
  };

  const discardDraft = () => {
    removeDraft(draftKey(userId, selectedDate));
    applySnapshot(saved);
    setDraftRestored(false);
  };

  // ── Save / delete ──

  const handleSave = async () => {
    if (!userId || wordCount === 0 || isSaving) return;
    setIsSaving(true);
    const filledGratitude = gratitude.map(g => g.trim()).filter(Boolean);
    try {
      const result = await journalService.saveEntry(userId, {
        entry_date: selectedDate,
        content,
        mood,
        gratitude: filledGratitude,
        word_count: wordCount,
        is_favorite: false,
        writing_prompt: writingPrompt,
        tags,
      });
      if (!result) {
        setToast({ kind: 'error', text: 'Chưa lưu được bài viết. Thử lại nhé.' });
        return;
      }
      setEntryId(result.id);
      setSaved(current);
      setDraftRestored(false);
      removeDraft(draftKey(userId, selectedDate));

      const reward = await processJournalReward({
        userId,
        wordCount,
        hasMood: !!mood,
        gratitudeCount: filledGratitude.length,
      });
      setToast(reward ? { kind: 'reward', ...reward } : { kind: 'info', text: 'Đã lưu nhật ký' });
      loadStats();
    } catch (err) {
      console.error(err);
      setToast({ kind: 'error', text: 'Không lưu được nhật ký lúc này.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!entryId) return;
    setConfirmDelete(false);
    const ok = await journalService.deleteEntry(entryId);
    if (!ok) {
      setToast({ kind: 'error', text: 'Không xóa được bài viết.' });
      return;
    }
    removeDraft(draftKey(userId, selectedDate));
    setEntryId(null);
    setSaved(EMPTY);
    applySnapshot(EMPTY);
    setDraftRestored(false);
    setToast({ kind: 'info', text: 'Đã xóa bài nhật ký' });
    loadStats();
  };

  // Ctrl/Cmd+S saves.
  const saveRef = useRef(handleSave);
  saveRef.current = handleSave;
  useEffect(() => {
    if (tab !== 'editor') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab]);

  const status = !ready
    ? null
    : dirty
      ? { text: 'Chưa lưu', dot: 'bg-amber-500' }
      : entryId
        ? { text: 'Đã lưu', dot: 'bg-emerald-500' }
        : { text: 'Chưa viết', dot: 'bg-zinc-300' };

  const selectedMood = getMood(mood);
  const streak = stats?.currentStreak ?? 0;

  return (
    <JournalPinGuard userId={userId}>
      <div className="journal ui-zinc mx-auto w-full max-w-5xl px-4 pb-28 pt-5 text-zinc-900 md:px-6 md:pb-10 md:pt-8">
        {/* Header */}
        <div className="mb-5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] capitalize text-zinc-500">
              {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="text-[26px] font-semibold tracking-tight text-zinc-950 md:text-[30px]">Nhật ký</h1>
          </div>
          {streak > 0 && (
            <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-zinc-900/[0.08] bg-white px-3 text-[13px] font-medium tabular-nums text-zinc-800">
              <Flame size={15} className="text-amber-500" aria-hidden />
              {streak} ngày liên tiếp
            </span>
          )}
        </div>

        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          label="Chế độ nhật ký"
          size="md"
          className="mb-5 w-full sm:w-auto"
          options={[
            { id: 'editor', label: 'Viết' },
            { id: 'review', label: 'Xem lại' },
          ]}
        />

        {tab === 'editor' ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            {/* Main editor card */}
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-2 pt-2 sm:px-3 sm:pt-3">
                <div className="flex min-w-0 items-center">
                  <IconButton label="Ngày trước" onClick={() => goToDate(shiftDate(selectedDate, -1))}>
                    <ChevronLeft size={18} />
                  </IconButton>
                  <button
                    type="button"
                    onClick={openDatePicker}
                    className="relative inline-flex h-9 min-w-0 items-center gap-1.5 rounded-full px-2.5 text-[14px] font-medium text-zinc-900 hover:bg-zinc-100"
                    aria-label="Chọn ngày"
                  >
                    <CalendarDays size={16} className="shrink-0 text-zinc-400" aria-hidden />
                    <span className="truncate">{dateLabel(selectedDate, today)}</span>
                    <input
                      ref={dateInputRef}
                      type="date"
                      value={selectedDate}
                      max={today}
                      onChange={e => e.target.value && goToDate(e.target.value)}
                      tabIndex={-1}
                      aria-hidden
                      className="pointer-events-none absolute inset-0 opacity-0"
                    />
                  </button>
                  <IconButton
                    label="Ngày sau"
                    disabled={selectedDate >= today}
                    className="disabled:pointer-events-none disabled:opacity-30"
                    onClick={() => goToDate(shiftDate(selectedDate, 1))}
                  >
                    <ChevronRight size={18} />
                  </IconButton>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {status && (
                    <span className="flex items-center gap-1.5 px-1 text-[12px] text-zinc-500" aria-live="polite">
                      <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden />
                      {status.text}
                    </span>
                  )}
                  {entryId && (
                    <IconButton label="Xóa bài ngày này" onClick={() => setConfirmDelete(true)}>
                      <Trash2 size={16} />
                    </IconButton>
                  )}
                </div>
              </div>

              {draftRestored && (
                <div className="mx-4 mt-2 flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-800 sm:mx-5">
                  <span>Đã khôi phục bản nháp chưa lưu.</span>
                  <button type="button" onClick={discardDraft} className="shrink-0 font-medium underline-offset-2 hover:underline">
                    Bỏ nháp
                  </button>
                </div>
              )}

              {/* Mood */}
              <div className="px-4 pt-4 sm:px-5">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[13px] font-medium text-zinc-600">{selectedDate === today ? 'Hôm nay bạn thấy thế nào?' : 'Ngày này bạn thấy thế nào?'}</span>
                  {selectedMood && <span className="text-[13px] font-medium text-zinc-900">{selectedMood.label}</span>}
                </div>
                <div role="radiogroup" aria-label="Cảm xúc" className="grid grid-cols-5 gap-1.5 sm:gap-2">
                  {MOOD_LEVELS.map(level => {
                    const m = MOODS[level];
                    const on = mood === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={m.label}
                        title={m.label}
                        onClick={() => setMood(on ? undefined : level)}
                        className={`flex flex-col items-center gap-1 rounded-2xl py-2.5 transition-colors ${on ? `${m.tile} ring-1 ring-inset ring-current` : 'bg-zinc-50 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700'}`}
                      >
                        <m.Icon size={24} strokeWidth={1.6} aria-hidden />
                        <span className={`hidden max-w-full truncate px-1 text-[12px] sm:block ${on ? 'font-medium' : 'text-zinc-500'}`}>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Prompt */}
              <div className="flex items-start gap-2.5 px-4 pb-3 pt-4 sm:px-5">
                <Sparkles size={16} className="mt-0.5 shrink-0 text-sky-600" aria-hidden />
                <p className="min-w-0 flex-1 text-[14px] leading-relaxed text-zinc-600">{writingPrompt}</p>
                <IconButton label="Đổi gợi ý" onClick={() => setWritingPrompt(getRandomWritingPrompt())} className="-mr-2 -mt-1.5">
                  <RefreshCw size={15} />
                </IconButton>
              </div>

              <RichToolbar active={format} exec={exec} />

              {/* Editor */}
              {isLoading ? (
                <div className="flex min-h-[320px] items-center justify-center gap-2 text-[13px] text-zinc-500">
                  <Loader2 size={16} className="animate-spin" aria-hidden /> Đang tải…
                </div>
              ) : (
                <div
                  key={editorKey}
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline="true"
                  aria-label="Nội dung nhật ký"
                  onInput={e => setContent(e.currentTarget.innerHTML)}
                  onKeyUp={readFormat}
                  onMouseUp={readFormat}
                  data-placeholder="Viết về ngày hôm nay của bạn…"
                  className="journal-prose min-h-[320px] w-full cursor-text px-4 py-4 text-[15px] text-zinc-800 outline-none sm:px-5"
                  style={{ wordBreak: 'break-word' }}
                />
              )}

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 border-t border-zinc-900/[0.06] px-4 py-3 sm:px-5">
                <div className="min-w-0 text-[12px] tabular-nums text-zinc-500">
                  <span className="font-medium text-zinc-700">{wordCount} từ</span>
                  <span className="mx-1.5 text-zinc-300">·</span>
                  {wordCount >= REWARD_WORDS ? (
                    <span className="inline-flex items-center gap-1">
                      <Star size={12} className="fill-amber-400 text-amber-500" aria-hidden /> Đủ {REWARD_WORDS} từ để nhận sao
                    </span>
                  ) : (
                    <span>Thêm {REWARD_WORDS - wordCount} từ để nhận sao</span>
                  )}
                </div>
                <Button variant="primary" onClick={handleSave} disabled={!ready || isSaving || wordCount === 0 || (!dirty && !!entryId)}>
                  {isSaving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Check size={16} aria-hidden />}
                  {isSaving ? 'Đang lưu' : entryId ? 'Cập nhật' : 'Lưu'}
                </Button>
              </div>
            </Card>

            {/* Side column */}
            <div className="space-y-4">
              <Card>
                <CardHeader title="Biết ơn" meta={`${gratitude.filter(g => g.trim()).length}/3`} />
                <div className="space-y-2 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="relative">
                      <Heart size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-rose-400" aria-hidden />
                      <input
                        type="text"
                        value={gratitude[i]}
                        onChange={e => setGratitude(prev => prev.map((g, j) => (j === i ? e.target.value : g)))}
                        placeholder={['Một điều khiến bạn mỉm cười', 'Một người bạn muốn cảm ơn', 'Một điều nhỏ đáng nhớ'][i]}
                        aria-label={`Điều biết ơn ${i + 1}`}
                        className={`${inputClass} pl-9`}
                      />
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <CardHeader title="Thẻ" meta={tags.length || undefined} />
                <div className="px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      placeholder="hoctap, gia-dinh…"
                      aria-label="Thêm thẻ"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      disabled={!tagInput.trim()}
                      aria-label="Thêm thẻ"
                      title="Thêm thẻ"
                      className="flex w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-900/[0.1] text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-40"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  {tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tags.map(t => (
                        <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-zinc-100 py-0.5 pl-2.5 pr-1 text-[13px] text-zinc-700">
                          #{t}
                          <button
                            type="button"
                            onClick={() => setTags(tags.filter(x => x !== t))}
                            aria-label={`Bỏ thẻ ${t}`}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-200 hover:text-zinc-800"
                          >
                            <X size={13} />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2.5 text-[13px] text-zinc-500">Gắn thẻ để lọc lại bài viết sau này.</p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        ) : (
          <JournalReview entries={entries} stats={stats} loading={reviewLoading} selectedDate={selectedDate} onOpenDate={goToDate} />
        )}

        <Sheet
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title="Xóa bài nhật ký?"
          subtitle={parseLocalDate(selectedDate).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Hủy</Button>
              <Button variant="danger" onClick={handleDelete} className="bg-red-50">
                <Trash2 size={16} /> Xóa
              </Button>
            </div>
          }
        >
          <p className="text-[14px] text-zinc-600">Nội dung, cảm xúc, điều biết ơn và thẻ của ngày này sẽ bị xóa và không khôi phục được.</p>
        </Sheet>

        {toast && <JournalToast toast={toast} onClose={() => setToast(null)} />}
      </div>
    </JournalPinGuard>
  );
};

const JournalToast: React.FC<{ toast: Toast; onClose: () => void }> = ({ toast, onClose }) => (
  <div
    className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[9998] flex justify-center px-3 md:bottom-6"
    role="status"
    aria-live="polite"
  >
    <div className="ui-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[20px] border border-zinc-900/[0.08] bg-white p-3.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.25)]">
      {toast.kind === 'reward' ? (
        <>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <Star size={18} className="fill-amber-400 text-amber-500" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold tabular-nums text-zinc-950">Đã lưu · +{toast.totalStars} sao</p>
            {toast.breakdown.length > 0 && (
              <p className="mt-0.5 text-[12px] text-zinc-500">{toast.breakdown.map(b => `${b.label} +${b.amount}`).join(' · ')}</p>
            )}
          </div>
        </>
      ) : (
        <>
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${toast.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {toast.kind === 'error' ? <X size={16} aria-hidden /> : <Check size={16} aria-hidden />}
          </span>
          <p className="min-w-0 flex-1 self-center text-[14px] font-medium text-zinc-900">{toast.text}</p>
        </>
      )}
      <IconButton label="Đóng" onClick={onClose} className="-mr-1 -mt-1 h-8 w-8">
        <X size={16} />
      </IconButton>
    </div>
  </div>
);

export default JournalDashboard;
