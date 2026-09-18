import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Trash2,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Settings2,
  Calendar,
  Check,
  CheckSquare,
  Square,
  ArrowRight
} from 'lucide-react';
import { Todo } from '../../types';
import {
  DoneAutoCleanSchedule,
  DoneCleanupSetting,
  CLEANUP_SCHEDULE_OPTIONS,
  getDoneCleanupSetting,
  saveDoneCleanupSetting,
  getEligibleDoneTasksForCleanup,
  formatCompletionTime,
  getCompletedTimestamp,
} from '../../services/doneTasksCleanupService';
import ConfirmModal from '../ConfirmModal';

interface DoneCleanupModalProps {
  isOpen: boolean;
  onClose: () => void;
  doneTodos: Todo[];
  onDeleteTodo: (id: string) => void;
  onDeleteMultipleTodos: (ids: string[]) => void;
  userId?: string;
}

export const DoneCleanupModal: React.FC<DoneCleanupModalProps> = ({
  isOpen,
  onClose,
  doneTodos,
  onDeleteTodo,
  onDeleteMultipleTodos,
  userId,
}) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cleanupSetting, setCleanupSetting] = useState<DoneCleanupSetting>(() => getDoneCleanupSetting(userId));
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Confirmation state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: () => {},
  });

  // Re-read settings when opened or userId changes
  useEffect(() => {
    if (isOpen) {
      setCleanupSetting(getDoneCleanupSetting(userId));
      setSelectedIds(new Set());
      setSavedSuccess(false);
    }
  }, [isOpen, userId]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmState.isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, confirmState.isOpen]);

  // Tasks eligible for > 30d, > 60d, > 90d quick filters
  const tasksOlderThan30d = useMemo(
    () => getEligibleDoneTasksForCleanup(doneTodos, '30_days'),
    [doneTodos]
  );
  const tasksOlderThan60d = useMemo(
    () => getEligibleDoneTasksForCleanup(doneTodos, '60_days'),
    [doneTodos]
  );
  const tasksOlderThan90d = useMemo(
    () => getEligibleDoneTasksForCleanup(doneTodos, '90_days'),
    [doneTodos]
  );

  if (!isOpen) return null;

  // Toggle selection of a single task
  const toggleSelectTask = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all or deselect all
  const handleToggleSelectAll = () => {
    if (selectedIds.size === doneTodos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(doneTodos.map((t) => t.id)));
    }
  };

  // Select tasks older than 30 days
  const handleSelectOlderThan30d = () => {
    setSelectedIds(new Set(tasksOlderThan30d.map((t) => t.id)));
  };

  // Select tasks older than 60 days
  const handleSelectOlderThan60d = () => {
    setSelectedIds(new Set(tasksOlderThan60d.map((t) => t.id)));
  };

  // Select tasks older than 90 days
  const handleSelectOlderThan90d = () => {
    setSelectedIds(new Set(tasksOlderThan90d.map((t) => t.id)));
  };

  // Confirm delete selected
  const handleConfirmDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setConfirmState({
      isOpen: true,
      title: `Xóa ${ids.length} việc đã chọn?`,
      message: `Hành động này sẽ xóa vĩnh viễn ${ids.length} việc đã hoàn thành khỏi bảng Kanban và đồng bộ hệ thống.`,
      action: () => {
        onDeleteMultipleTodos(ids);
        setSelectedIds(new Set());
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        if (ids.length === doneTodos.length) {
          onClose();
        }
      },
    });
  };

  // Confirm delete all
  const handleConfirmDeleteAll = () => {
    if (doneTodos.length === 0) return;
    const ids = doneTodos.map((t) => t.id);
    setConfirmState({
      isOpen: true,
      title: `Xóa toàn bộ ${doneTodos.length} việc đã hoàn thành?`,
      message: `Tất cả ${doneTodos.length} việc trong cột Done sẽ bị xóa sạch khỏi bảng Kanban và cơ sở dữ liệu.`,
      action: () => {
        onDeleteMultipleTodos(ids);
        setSelectedIds(new Set());
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        onClose();
      },
    });
  };

  // Save auto cleanup settings
  const handleSaveAutoSettings = () => {
    saveDoneCleanupSetting(cleanupSetting, userId);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 2000);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[150000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-card border border-border/80 rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-slate-50/80 dark:bg-muted/30 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-slate-500/10 dark:bg-slate-500/20 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 border border-slate-500/20">
              <Trash2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-foreground">
                  Dọn dẹp việc đã xong
                </h3>
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-mono">
                  {doneTodos.length} việc
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quản lý, xóa thủ công hoặc thiết lập tự động xóa cho cột Done
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-colors cursor-pointer"
            title="Đóng (ESC)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border px-5 pt-2 bg-slate-50/40 dark:bg-muted/10 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'manual'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Trash2 size={14} />
            <span>Xóa thủ công</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-secondary text-foreground font-mono">
              {doneTodos.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('auto')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'auto'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Settings2 size={14} />
            <span>Tự động dọn dẹp</span>
            {cleanupSetting.schedule !== 'never' && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
          {activeTab === 'manual' ? (
            <div className="flex flex-col gap-4">
              {/* Quick Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleConfirmDeleteAll}
                  disabled={doneTodos.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/60 border border-rose-200/50 dark:border-rose-800/40 transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Trash2 size={13} />
                  <span>Xóa tất cả ({doneTodos.length})</span>
                </button>

                {tasksOlderThan30d.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectOlderThan30d}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-secondary/70 hover:bg-secondary text-foreground border border-border/60 transition-all cursor-pointer active:scale-95"
                  >
                    <Clock size={13} className="text-amber-500" />
                    <span>Chọn việc &gt; 30 ngày ({tasksOlderThan30d.length})</span>
                  </button>
                )}

                {tasksOlderThan60d.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectOlderThan60d}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-secondary/70 hover:bg-secondary text-foreground border border-border/60 transition-all cursor-pointer active:scale-95"
                  >
                    <Calendar size={13} className="text-indigo-500" />
                    <span>Chọn việc &gt; 60 ngày ({tasksOlderThan60d.length})</span>
                  </button>
                )}

                {tasksOlderThan90d.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectOlderThan90d}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-secondary/70 hover:bg-secondary text-foreground border border-border/60 transition-all cursor-pointer active:scale-95"
                  >
                    <Calendar size={13} className="text-rose-500" />
                    <span>Chọn việc &gt; 90 ngày ({tasksOlderThan90d.length})</span>
                  </button>
                )}

                {doneTodos.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="ml-auto text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-secondary"
                  >
                    {selectedIds.size === doneTodos.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                  </button>
                )}
              </div>

              {/* Task Checklist */}
              {doneTodos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
                  <div className="w-14 h-14 rounded-3xl bg-slate-100 dark:bg-muted/40 flex items-center justify-center text-2xl mb-1">
                    🎉
                  </div>
                  <p className="text-sm font-bold text-foreground">Không có công việc nào trong cột Done</p>
                  <p className="text-xs max-w-xs text-muted-foreground">
                    Cột Done hiện tại trống. Khi bạn hoàn thành công việc, chúng sẽ hiển thị ở đây.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground px-1 pb-1">
                    <span>Danh sách ({doneTodos.length} việc)</span>
                    <span>Đã chọn: <strong className="text-foreground">{selectedIds.size}</strong></span>
                  </div>

                  <div className="flex flex-col gap-1.5 max-h-[44vh] overflow-y-auto pr-1 custom-scrollbar">
                    {doneTodos.map((todo) => {
                      const isSelected = selectedIds.has(todo.id);
                      const timeAgo = formatCompletionTime(todo);

                      return (
                        <div
                          key={todo.id}
                          onClick={() => toggleSelectTask(todo.id)}
                          className={`group flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                            isSelected
                              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/40 shadow-xs'
                              : 'bg-card hover:bg-secondary/40 border-border/70'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelectTask(todo.id);
                              }}
                              className="text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
                            >
                              {isSelected ? (
                                <CheckSquare size={17} className="text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Square size={17} className="text-slate-400 dark:text-slate-500" />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-xs sm:text-sm font-semibold truncate ${
                                  isSelected
                                    ? 'text-foreground font-bold'
                                    : 'text-foreground/90'
                                }`}
                                title={todo.content}
                              >
                                {todo.content}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 size={11} className="text-emerald-500" />
                                  <span>{timeAgo}</span>
                                </span>
                                {todo.deadline && (
                                  <span className="truncate">
                                    • Hạn: {new Date(todo.deadline).toLocaleDateString('vi-VN')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteTodo(todo.id);
                            }}
                            className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-all opacity-70 group-hover:opacity-100 shrink-0 cursor-pointer"
                            title="Xóa nhiệm vụ này"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: AUTO CLEANUP SETTINGS */
            <div className="flex flex-col gap-4">
              <div className="p-3.5 rounded-2xl bg-secondary/50 border border-border/70 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles size={16} />
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  <p className="font-bold text-foreground mb-0.5">Cơ chế dọn dẹp tự động thông minh</p>
                  Hệ thống sẽ tự động quét và xóa các việc đã hoàn thành trong cột <strong>Done</strong> theo chu kỳ bạn chọn, giúp bảng Kanban luôn gọn gàng và tải nhanh.
                </div>
              </div>

              {/* Schedule options list */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">
                  Chu kỳ tự động xóa:
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {CLEANUP_SCHEDULE_OPTIONS.map((opt) => {
                    const isChecked = cleanupSetting.schedule === opt.value;

                    return (
                      <div
                        key={opt.value}
                        onClick={() =>
                          setCleanupSetting((prev) => ({
                            ...prev,
                            schedule: opt.value,
                          }))
                        }
                        className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                            : 'bg-card hover:bg-secondary/50 border-border/70'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                              isChecked
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {isChecked && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm font-bold text-foreground">
                              {opt.label}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {opt.description}
                            </p>
                          </div>
                        </div>

                        {isChecked && (
                          <Check size={16} className="text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notify toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border/70 bg-card">
                <div>
                  <p className="text-xs sm:text-sm font-bold text-foreground">
                    Thông báo khi tự động dọn dẹp
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Hiển thị thông báo nhỏ khi có task được dọn dẹp tự động
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setCleanupSetting((prev) => ({
                      ...prev,
                      notifyOnClean: !prev.notifyOnClean,
                    }))
                  }
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    cleanupSetting.notifyOnClean
                      ? 'bg-emerald-600'
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform shadow-xs ${
                      cleanupSetting.notifyOnClean ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-slate-50/70 dark:bg-muted/20 shrink-0 gap-3">
          {activeTab === 'manual' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Đóng
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteSelected}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Trash2 size={13} />
                <span>Xóa {selectedIds.size} việc đã chọn</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Đóng
              </button>

              <button
                type="button"
                onClick={handleSaveAutoSettings}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition-all cursor-pointer active:scale-95"
              >
                {savedSuccess ? (
                  <>
                    <Check size={14} className="stroke-[3]" />
                    <span>Đã lưu thành công!</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Lưu thiết lập</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmState.isOpen && (
        <ConfirmModal
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          confirmText="Xác nhận xóa"
          cancelText="Hủy"
          onConfirm={confirmState.action}
          onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>,
    document.body
  );
};
