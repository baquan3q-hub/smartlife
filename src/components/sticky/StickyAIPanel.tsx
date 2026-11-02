// File: src/components/sticky/StickyAIPanel.tsx
// Bảng AI cho 1 note: Tách task → Kanban · Sắp xếp (tiêu đề/nhãn/màu) · Tóm tắt · Viết lại.
// Nguyên tắc UX: AI chỉ GỢI Ý, người dùng xem trước và xác nhận.

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, Loader2, ListChecks, Wand2, FileText, PenLine, Check, Crown } from 'lucide-react';
import { StickyNote, StickyNotePatch } from '../../services/stickyNoteService';
import {
  stickyNoteAIService, AISuggestedTask, AIOrganizeSuggestion, AIRewriteMode, AITaskPriority,
} from '../../services/stickyNoteAIService';
import { STICKY_THEME } from './stickyTheme';
import { StickyMarkdownView } from './StickyMarkdownView';

type Tab = 'tasks' | 'organize' | 'summarize' | 'cleanup';

interface Props {
  note: StickyNote;
  existingLabels: string[];
  hasAIAccess: boolean;
  onUpgrade?: () => void;
  onClose: () => void;
  onApplyPatch: (patch: StickyNotePatch, opts?: { snapshot?: boolean }) => void;
  onAddTasks: (tasks: AISuggestedTask[]) => Promise<void>;
}

const TABS: { id: Tab; label: string; icon: React.ElementType; hint: string }[] = [
  { id: 'tasks', label: 'Tách task', icon: ListChecks, hint: 'Biến việc cần làm trong note thành task trên bảng Kanban' },
  { id: 'organize', label: 'Sắp xếp', icon: Wand2, hint: 'Gợi ý tiêu đề, nhãn và màu phù hợp' },
  { id: 'summarize', label: 'Tóm tắt', icon: FileText, hint: 'Rút gọn note thành vài gạch đầu dòng' },
  { id: 'cleanup', label: 'Viết lại', icon: PenLine, hint: 'Sửa chính tả, trình bày gọn gàng, không thêm ý' },
];

const PRIORITY_LABEL: Record<AITaskPriority, string> = {
  urgent: 'Gấp', high: 'Cao', medium: 'Vừa', low: 'Thấp',
};

export const StickyAIPanel: React.FC<Props> = ({ note, existingLabels, hasAIAccess, onUpgrade, onClose, onApplyPatch, onAddTasks }) => {
  const [tab, setTab] = useState<Tab>('tasks');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [tasks, setTasks] = useState<(AISuggestedTask & { checked: boolean })[] | null>(null);
  const [organize, setOrganize] = useState<AIOrganizeSuggestion | null>(null);
  const [rewritten, setRewritten] = useState<Record<AIRewriteMode, string | null>>({ summarize: null, cleanup: null });

  const isEmpty = !note.title.trim() && !note.content.trim();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async () => {
    setError(null);
    setDone(null);
    setIsRunning(true);
    try {
      if (tab === 'tasks') {
        const result = await stickyNoteAIService.extractTasks(note);
        setTasks(result.map(t => ({ ...t, checked: true })));
      } else if (tab === 'organize') {
        setOrganize(await stickyNoteAIService.organize(note, existingLabels));
      } else {
        const text = await stickyNoteAIService.rewrite(note, tab);
        setRewritten(prev => ({ ...prev, [tab]: text }));
      }
    } catch (e: any) {
      setError(e?.message || 'AI gặp lỗi, vui lòng thử lại.');
    } finally {
      setIsRunning(false);
    }
  };

  const addSelectedTasks = async () => {
    const selected = (tasks || []).filter(t => t.checked && t.content.trim());
    if (selected.length === 0) return;
    setIsRunning(true);
    setError(null);
    try {
      await onAddTasks(selected.map(({ checked, ...t }) => t));
      setDone(`Đã thêm ${selected.length} task vào cột Todo trên bảng Kanban.`);
      setTasks(null);
    } catch (e: any) {
      setError(e?.message || 'Không thêm được task.');
    } finally {
      setIsRunning(false);
    }
  };

  const result = tab === 'tasks' ? tasks : tab === 'organize' ? organize : rewritten[tab];
  const current = TABS.find(t => t.id === tab)!;

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-end md:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 md:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AI cho ghi chú"
        className="w-full md:max-w-xl max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white"><Sparkles size={16} /></span>
            <h2 className="font-bold text-slate-800 dark:text-slate-100">AI cho ghi chú</h2>
          </div>
          <button onClick={onClose} aria-label="Đóng" className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
        </header>

        <nav className="flex gap-1 px-4 pt-3 overflow-x-auto scrollbar-hide" role="tablist">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => { setTab(t.id); setError(null); setDone(null); }}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <p className="text-xs text-slate-500">{current.hint}</p>

          {!hasAIAccess ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-200">
              <p className="font-semibold mb-1 flex items-center gap-1.5"><Crown size={15} /> Tính năng AI dành cho gói Pro / dùng thử</p>
              <p className="mb-3 opacity-80">Nâng cấp để AI tự tách việc, sắp xếp và tóm tắt ghi chú cho bạn.</p>
              {onUpgrade && (
                <button onClick={onUpgrade} className="px-4 py-2 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600">Xem gói Pro</button>
              )}
            </div>
          ) : isEmpty ? (
            <p className="text-sm text-slate-500 italic">Note đang trống — hãy viết gì đó trước nhé.</p>
          ) : (
            <>
              {/* Kết quả: Tách task */}
              {tab === 'tasks' && tasks && (
                tasks.length === 0 ? (
                  <p className="text-sm text-slate-500">AI không thấy việc cần làm nào trong note này.</p>
                ) : (
                  <ul className="space-y-2">
                    {tasks.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-2.5">
                        <input
                          type="checkbox"
                          checked={t.checked}
                          onChange={(e) => setTasks(ts => ts!.map((x, j) => (j === i ? { ...x, checked: e.target.checked } : x)))}
                          className="mt-1.5 accent-indigo-600"
                          aria-label={`Chọn task ${t.content}`}
                        />
                        <div className="flex-1 min-w-0">
                          <input
                            value={t.content}
                            onChange={(e) => setTasks(ts => ts!.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)))}
                            className="w-full bg-transparent text-sm font-medium text-slate-800 dark:text-slate-100 outline-none"
                          />
                          <div className="flex items-center gap-2 mt-1">
                            <select
                              value={t.priority}
                              onChange={(e) => setTasks(ts => ts!.map((x, j) => (j === i ? { ...x, priority: e.target.value as AITaskPriority } : x)))}
                              className="text-xs bg-slate-100 dark:bg-slate-800 rounded-lg px-1.5 py-0.5 outline-none"
                            >
                              {(Object.keys(PRIORITY_LABEL) as AITaskPriority[]).map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                            </select>
                            {t.deadline && (
                              <span className="text-xs text-slate-500">
                                Hạn: {new Date(t.deadline).toLocaleString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              )}

              {/* Kết quả: Sắp xếp */}
              {tab === 'organize' && organize && (
                <div className={`rounded-2xl p-4 ${STICKY_THEME[organize.color].card}`}>
                  <p className="text-[11px] uppercase tracking-wide opacity-60 mb-1">Gợi ý · màu {STICKY_THEME[organize.color].name}</p>
                  <p className="font-bold">{organize.title || <em className="opacity-50">(giữ tiêu đề)</em>}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {organize.labels.map(l => <span key={l} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10">#{l}</span>)}
                  </div>
                </div>
              )}

              {/* Kết quả: Tóm tắt / Viết lại */}
              {(tab === 'summarize' || tab === 'cleanup') && rewritten[tab] !== null && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-800 dark:text-slate-100">
                  {rewritten[tab] ? <StickyMarkdownView markdown={rewritten[tab]!} /> : <em className="opacity-50">(AI không trả về nội dung)</em>}
                </div>
              )}
            </>
          )}

          {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl p-3">{error}</p>}
          {done && <p className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3 flex items-center gap-1.5"><Check size={15} /> {done}</p>}
        </div>

        {hasAIAccess && !isEmpty && (
          <footer className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={run}
              disabled={isRunning}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {result ? 'Chạy lại' : 'Chạy AI'}
            </button>

            {tab === 'tasks' && tasks && tasks.some(t => t.checked) && (
              <button onClick={addSelectedTasks} disabled={isRunning} className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
                Thêm {tasks.filter(t => t.checked).length} task vào Kanban
              </button>
            )}

            {tab === 'organize' && organize && (
              <button
                onClick={() => {
                  onApplyPatch({
                    ...(organize.title ? { title: organize.title } : {}),
                    color: organize.color,
                    labels: Array.from(new Set([...note.labels, ...organize.labels])).slice(0, 6),
                  }, { snapshot: true });
                  setDone('Đã áp dụng gợi ý.');
                  setOrganize(null);
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Áp dụng
              </button>
            )}

            {(tab === 'summarize' || tab === 'cleanup') && rewritten[tab] && (
              <>
                <button
                  onClick={() => {
                    onApplyPatch({ content: `${note.content.trimEnd()}\n\n**— ${tab === 'summarize' ? 'Tóm tắt' : 'Bản gọn'} —**\n\n${rewritten[tab]}` }, { snapshot: true });
                    setDone('Đã chèn vào cuối note.');
                    setRewritten(prev => ({ ...prev, [tab]: null }));
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
                >
                  Chèn dưới
                </button>
                <button
                  onClick={() => {
                    onApplyPatch({ content: rewritten[tab]! }, { snapshot: true });
                    setDone('Đã thay nội dung. Bản cũ nằm trong Lịch sử phiên bản.');
                    setRewritten(prev => ({ ...prev, [tab]: null }));
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Thay thế
                </button>
              </>
            )}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
};
