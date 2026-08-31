import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  closestCenter,
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Calendar, CheckSquare, Plus, Trash2, Link2, ExternalLink, FileText, Eye, Download, X } from 'lucide-react';
import { Todo, TodoStatus, TaskLink, parseTaskLinks } from '../../types';
import {
  TaskAttachment,
  getAttachmentCount,
  getAttachments,
  downloadAttachment,
  formatFileSize,
  getFileIcon,
  isPreviewable
} from '../../services/taskAttachmentService';

interface KanbanBoardProps {
  todos: Todo[];
  onMoveTodoStatus: (id: string, status: TodoStatus) => void;
  onReorderTodos: (reordered: Todo[]) => void;
  onEditTodo: (todo: Todo) => void;
  onDeleteTodo: (id: string) => void;
  onQuickAddTodo: (status: TodoStatus) => void;
}

const COLUMNS: { id: TodoStatus; label: string; dot: string }[] = [
  { id: 'backlog', label: 'Backlog', dot: 'bg-slate-400' },
  { id: 'todo', label: 'Todo', dot: 'bg-blue-500' },
  { id: 'doing', label: 'Doing', dot: 'bg-orange-500' },
  { id: 'done', label: 'Done', dot: 'bg-emerald-500' },
];

const COLUMN_IDS = COLUMNS.map(c => c.id);

const getEffectiveStatus = (todo: Todo): TodoStatus => {
  return todo.status || (todo.is_completed ? 'done' : 'todo');
};

const getTodosForColumn = (allTodos: Todo[], colId: TodoStatus): Todo[] => {
  const colTodos = allTodos.filter((todo) => getEffectiveStatus(todo) === colId);
  return colTodos.sort((a, b) => {
    const orderA = typeof a.sort_order === 'number' ? a.sort_order : Number.MAX_SAFE_INTEGER;
    const orderB = typeof b.sort_order === 'number' ? b.sort_order : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    if (colId === 'done') {
      const timeA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const timeB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
    }
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
};

const sortTodosForBoard = (items: Todo[]): Todo[] => {
  return [...items].sort((a, b) => {
    const orderA = typeof a.sort_order === 'number' ? a.sort_order : Number.MAX_SAFE_INTEGER;
    const orderB = typeof b.sort_order === 'number' ? b.sort_order : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
};

const hasSameBoardState = (a: Todo[], b: Todo[]) => {
  if (a.length !== b.length) return false;
  return a.every((todo, index) => {
    const other = b[index];
    return (
      other &&
      todo.id === other.id &&
      getEffectiveStatus(todo) === getEffectiveStatus(other) &&
      todo.sort_order === other.sort_order
    );
  });
};

const moveTodoInBoard = (items: Todo[], activeId: string, overId: string): Todo[] => {
  if (activeId === overId) return items;

  const activeTodo = items.find(todo => todo.id === activeId);
  if (!activeTodo) return items;

  const overIsColumn = COLUMN_IDS.includes(overId as TodoStatus);
  const overTodo = overIsColumn ? null : items.find(todo => todo.id === overId);
  if (!overIsColumn && !overTodo) return items;

  const targetStatus = overIsColumn ? overId as TodoStatus : getEffectiveStatus(overTodo as Todo);

  // Custom fallback: if dragging over the column background of its own column, do nothing.
  if (overIsColumn && getEffectiveStatus(activeTodo) === targetStatus) {
    return items;
  }

  const movedTodo = {
    ...activeTodo,
    status: targetStatus,
    is_completed: targetStatus === 'done',
    completed_at: targetStatus === 'done'
      ? (activeTodo.completed_at || new Date().toISOString())
      : null,
  };
  const withoutActive = items.filter(todo => todo.id !== activeId);

  if (overIsColumn) {
    if (targetStatus === 'done') {
      // Khi kéo vào cột Done, đưa ngay lên đầu cột Done để dễ dàng theo dõi
      const firstDoneIndex = withoutActive.findIndex(todo => getEffectiveStatus(todo) === 'done');
      const insertIndex = firstDoneIndex === -1 ? withoutActive.length : firstDoneIndex;
      return [
        ...withoutActive.slice(0, insertIndex),
        movedTodo,
        ...withoutActive.slice(insertIndex),
      ];
    }

    const lastTargetIndex = withoutActive.reduce((lastIndex, todo, index) => {
      return getEffectiveStatus(todo) === targetStatus ? index : lastIndex;
    }, -1);
    const insertIndex = lastTargetIndex + 1;
    return [
      ...withoutActive.slice(0, insertIndex),
      movedTodo,
      ...withoutActive.slice(insertIndex),
    ];
  }

  const overIndex = withoutActive.findIndex(todo => todo.id === overId);
  if (overIndex === -1) return items;

  return [
    ...withoutActive.slice(0, overIndex),
    movedTodo,
    ...withoutActive.slice(overIndex),
  ];
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  todos,
  onReorderTodos,
  onEditTodo,
  onDeleteTodo,
  onQuickAddTodo,
}) => {
  const sortedTodos = useMemo(() => sortTodosForBoard(todos), [todos]);
  const [localTodos, setLocalTodos] = useState<Todo[]>(() => sortedTodos);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeWidth, setActiveWidth] = useState<number | null>(null);
  const activeTodoRef = useRef<Todo | null>(null);
  const localTodosRef = useRef<Todo[]>(sortedTodos);
  const isDraggingRef = useRef(false);
  const sortedTodosRef = useRef<Todo[]>(sortedTodos);
  const onReorderTodosRef = useRef(onReorderTodos);
  const dragOverThrottleRef = useRef<number>(0);

  // Keep refs in sync without triggering re-renders
  sortedTodosRef.current = sortedTodos;
  onReorderTodosRef.current = onReorderTodos;

  useEffect(() => {
    if (!isDraggingRef.current) {
      localTodosRef.current = sortedTodos;
      setLocalTodos(sortedTodos);
    }
  }, [sortedTodos]);

  const updateLocalTodos = useCallback((next: Todo[] | ((prev: Todo[]) => Todo[])) => {
    setLocalTodos((prev) => {
      const resolved = typeof next === 'function' ? (next as (prev: Todo[]) => Todo[])(prev) : next;
      localTodosRef.current = resolved;
      return resolved;
    });
  }, []);

  const mouseSensorOptions = useMemo(() => ({
    activationConstraint: { distance: 4 },
  }), []);
  const touchSensorOptions = useMemo(() => ({
    activationConstraint: { delay: 150, tolerance: 6 },
  }), []);

  const sensors = useSensors(
    useSensor(MouseSensor, mouseSensorOptions),
    useSensor(TouchSensor, touchSensorOptions),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string;
    isDraggingRef.current = true;
    activeTodoRef.current = localTodosRef.current.find(todo => todo.id === id) || null;
    setActiveId(id);

    const element = document.getElementById(`todo-card-${id}`);
    if (element) {
      setActiveWidth(element.getBoundingClientRect().width);
    }
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    if (!isDraggingRef.current) return;

    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const activeTodo = localTodosRef.current.find(t => t.id === activeId);
    const overIsColumn = COLUMN_IDS.includes(overId as TodoStatus);
    const overTodo = overIsColumn ? null : localTodosRef.current.find(t => t.id === overId);

    const activeContainer = activeTodo ? getEffectiveStatus(activeTodo) : null;
    const overContainer = overIsColumn ? (overId as TodoStatus) : (overTodo ? getEffectiveStatus(overTodo) : null);

    // Chỉ cập nhật state khi di chuyển XUYÊN CỘT (Cross-column) để loại bỏ 95% re-render thừa
    if (activeContainer && overContainer && activeContainer !== overContainer) {
      updateLocalTodos((prev) => {
        const next = moveTodoInBoard(prev, activeId, overId);
        return hasSameBoardState(prev, next) ? prev : next;
      });
    }
  }, [updateLocalTodos]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    isDraggingRef.current = false;
    setActiveId(null);
    setActiveWidth(null);
    activeTodoRef.current = null;

    if (!over) {
      updateLocalTodos(sortedTodosRef.current);
      return;
    }

    const nextActiveId = active.id as string;
    const overId = over.id as string;
    const finalTodos = moveTodoInBoard(localTodosRef.current, nextActiveId, overId);

    if (hasSameBoardState(sortedTodosRef.current, finalTodos)) {
      updateLocalTodos(sortedTodosRef.current);
      return;
    }

    updateLocalTodos(finalTodos);
    onReorderTodosRef.current(finalTodos);
  }, [updateLocalTodos]);

  const handleDragCancel = useCallback(() => {
    isDraggingRef.current = false;
    setActiveId(null);
    setActiveWidth(null);
    activeTodoRef.current = null;
    updateLocalTodos(sortedTodosRef.current);
  }, [updateLocalTodos]);

  const collisionDetectionStrategy = useCallback((args: any) => {
    // 1. Phản hồi tức thì theo con trỏ chuột
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    // 2. Fallback sang rectIntersection
    const intersections = rectIntersection(args);
    if (intersections.length > 0) {
      return intersections;
    }
    return closestCorners(args);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="w-full">
        <div className="flex flex-col md:flex-row gap-2.5 overflow-x-auto pb-4 scrollbar-thin items-stretch w-full select-none">
          {COLUMNS.map((col) => {
            const colTodos = getTodosForColumn(localTodos, col.id);

            return (
              <ColumnContainer
                key={col.id}
                col={col}
                count={colTodos.length}
                onQuickAdd={() => onQuickAddTodo(col.id)}
              >
                <SortableContext
                  items={colTodos.map((todo) => todo.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2 min-h-[120px] max-h-[260px] overflow-y-auto px-1.5 py-1.5 pb-8 custom-scrollbar scroll-fade-bottom">
                    {colTodos.map((todo) => (
                      <SortableCard
                        key={todo.id}
                        todo={todo}
                        onEdit={onEditTodo}
                        onDelete={onDeleteTodo}
                      />
                    ))}
                    {colTodos.length === 0 && (
                      <div className="flex min-h-[112px] flex-col items-center justify-center rounded-2xl border border-dashed border-border px-4 py-10 text-xs font-semibold text-muted-foreground">
                        Trống
                      </div>
                    )}
                  </div>
                </SortableContext>
              </ColumnContainer>
            );
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={{
        duration: 150,
        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
      }}>
        {activeId && activeTodoRef.current ? (
          <TaskCardShell todo={activeTodoRef.current} width={activeWidth || undefined} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

interface ColumnContainerProps {
  col: typeof COLUMNS[number];
  count: number;
  onQuickAdd: () => void;
  children: React.ReactNode;
}

const ColumnContainer: React.FC<ColumnContainerProps> = ({
  col,
  count,
  onQuickAdd,
  children,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col flex-1 min-w-[185px] md:min-w-[160px] lg:min-w-[170px] xl:min-w-[190px] rounded-[20px] kanban-column px-2 py-2 transition-all duration-150 border ${isOver
        ? 'ring-2 ring-indigo-500/20 bg-indigo-50/10 border-indigo-200/50 shadow-sm'
        : 'border-border/40'
        }`}
    >
      <div className="flex items-center justify-between mb-4 select-none w-full">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${col.dot}`} />
          <h4 className="font-bold text-foreground text-xs">{col.label}</h4>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 bg-secondary text-muted-foreground rounded-full">
          {count}
        </span>
      </div>

      <div className="flex-1">{children}</div>

      <button
        onClick={onQuickAdd}
        className="w-full mt-3 py-2 text-muted-foreground hover:text-foreground text-xs font-bold flex items-center gap-1.5 hover:bg-secondary/50 rounded-xl transition-all justify-start px-2.5"
      >
        <Plus size={14} className="stroke-[3]" />
        Task
      </button>
    </div>
  );
};

interface SortableCardProps {
  todo: Todo;
  onEdit: (todo: Todo) => void;
  onDelete: (id: string) => void;
}

const attachmentCountCache = new Map<string, number>();

const SortableCard = React.memo<SortableCardProps>(({
  todo,
  onEdit,
  onDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
  });

  const style = {
    transform: transform ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` : undefined,
    transition,
    willChange: isDragging ? 'transform' : undefined,
    opacity: isDragging ? 0.25 : 1,
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="w-full opacity-30 pointer-events-none"
      >
        <TaskCardShell todo={todo} isOverlay />
      </div>
    );
  }

  return (
    <div
      id={`todo-card-${todo.id}`}
      ref={setNodeRef}
      style={style}
      onClick={() => onEdit(todo)}
      {...attributes}
      {...listeners}
      className="group relative cursor-grab active:cursor-grabbing will-change-transform select-none"
    >
      <TaskCardShell todo={todo} onDelete={onDelete} />
    </div>
  );
});

SortableCard.displayName = 'SortableCard';

interface TaskCardShellProps {
  todo: Todo;
  width?: number;
  isOverlay?: boolean;
  onDelete?: (id: string) => void;
}

const TaskCardShell = React.memo<TaskCardShellProps>(({ todo, width, isOverlay = false, onDelete }) => {
  const completedSubtasks = todo.subtasks?.filter((subtask) => subtask.is_completed).length || 0;
  const totalSubtasks = todo.subtasks?.length || 0;
  const links = useMemo(() => parseTaskLinks(todo.attach_link), [todo.attach_link]);
  const [showLinksPopup, setShowLinksPopup] = useState(false);
  const [fileCount, setFileCount] = useState<number>(() => attachmentCountCache.get(todo.id) || 0);
  const [showFilesPopup, setShowFilesPopup] = useState(false);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<{ url: string; name: string; type: string } | null>(null);
  
  const popupRef = useRef<HTMLDivElement>(null);
  const filePopupRef = useRef<HTMLDivElement>(null);

  // Load attachment count with cache and skip overlay queries to maintain 60fps
  useEffect(() => {
    if (isOverlay) return;
    let isMounted = true;
    const updateCount = () => {
      getAttachmentCount(todo.id)
        .then((cnt) => {
          attachmentCountCache.set(todo.id, cnt);
          if (isMounted) setFileCount(cnt);
        })
        .catch(() => {
          if (isMounted) setFileCount(0);
        });
    };

    updateCount();
    window.addEventListener('task_attachments_updated', updateCount);
    return () => {
      isMounted = false;
      window.removeEventListener('task_attachments_updated', updateCount);
    };
  }, [todo.id, isOverlay]);

  // Close popup on click outside
  useEffect(() => {
    if (!showLinksPopup) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowLinksPopup(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showLinksPopup]);

  useEffect(() => {
    if (!showFilesPopup) return;
    const handler = (e: MouseEvent) => {
      if (filePopupRef.current && !filePopupRef.current.contains(e.target as Node)) {
        setShowFilesPopup(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilesPopup]);

  const handleLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowFilesPopup(false);
    if (links.length === 1) {
      const url = links[0].url.startsWith('http') ? links[0].url : `https://${links[0].url}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (links.length > 1) {
      setShowLinksPopup(prev => !prev);
    }
  };

  const handleFileBadgeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowLinksPopup(false);
    try {
      const list = await getAttachments(todo.id);
      setAttachments(list);

      if (list.length === 0) return;

      if (list.length === 1) {
        const single = list[0];
        if (isPreviewable(single.type, single.name)) {
          const blob = new Blob([single.data], { type: single.type });
          const url = URL.createObjectURL(blob);
          setPreviewAttachment({ url, name: single.name, type: single.type });
        } else {
          downloadAttachment(single);
        }
      } else {
        setShowFilesPopup(prev => !prev);
      }
    } catch (err) {
      console.error('Lỗi khi mở tệp đính kèm:', err);
    }
  };

  return (
    <div
      style={width ? { width: `${width}px` } : undefined}
      className={`relative flex min-h-[38px] flex-col gap-1 rounded-xl bg-card pl-2 pr-2 py-2 select-none ${(showLinksPopup || showFilesPopup) ? 'z-40' : 'z-10'} ${isOverlay
        ? 'border border-border/80 shadow-2xl cursor-grabbing pointer-events-none opacity-95'
        : 'border border-border shadow-sm hover:border-primary/40 transition-all'
        }`}
    >
      <p className="text-[11px] font-semibold text-foreground leading-tight break-words pr-0">
        {todo.content}
      </p>

      {todo.description && (
        <p className="text-[10px] text-muted-foreground font-medium line-clamp-2 leading-normal">
          {todo.description}
        </p>
      )}

      {(totalSubtasks > 0 || todo.deadline || links.length > 0 || fileCount > 0) && (
        <div className="flex items-center gap-2 mt-1 flex-wrap select-none">
          {totalSubtasks > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md border text-muted-foreground border-border bg-secondary font-bold flex items-center gap-1">
              <CheckSquare size={9} />
              {completedSubtasks}/{totalSubtasks}
            </span>
          )}
          {todo.deadline && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-md border font-bold flex items-center gap-1 ${isOverdue(todo.deadline)
              ? 'bg-rose-50 border-rose-100 text-rose-600'
              : 'bg-indigo-50 border-indigo-100 text-indigo-600'
              }`}>
              <Calendar size={9} />
              {formatDate(todo.deadline)}
            </span>
          )}
          {links.length > 0 && (
            <div className="relative" ref={popupRef}>
              <button
                type="button"
                onClick={handleLinkClick}
                className="text-[9px] px-1.5 py-0.5 rounded-md border font-bold flex items-center gap-1 bg-sky-50 border-sky-100 text-sky-600 hover:text-sky-800 hover:bg-sky-100 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-400 dark:hover:bg-sky-900/60 transition-colors z-10 cursor-pointer"
                title={links.length === 1 ? (links[0].name || links[0].url) : `${links.length} liên kết (Bấm để xem)`}
              >
                <Link2 size={10} className="shrink-0" />
                {links.length > 1 && <span className="text-[9px] font-bold leading-none">{links.length}</span>}
              </button>

              {/* Multi-link popup with compact styling and truncated titles */}
              {showLinksPopup && links.length > 1 && (
                <div
                  className="absolute left-0 top-full mt-1.5 w-48 max-w-[calc(100vw-32px)] bg-white/95 dark:bg-card/95 backdrop-blur-md border border-border/80 rounded-xl shadow-xl z-50 p-1 animate-in fade-in zoom-in-95 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-2 py-1 border-b border-border/40 mb-1">
                    <span className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Link2 size={10} className="text-sky-500" /> {links.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowLinksPopup(false)}
                      className="p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                      title="Đóng"
                    >
                      <X size={10} />
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-0.5">
                    {links.map((link) => {
                      const href = link.url.startsWith('http') ? link.url : `https://${link.url}`;
                      return (
                        <a
                          key={link.id}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={link.name || link.url}
                          onClick={(e) => { e.stopPropagation(); setShowLinksPopup(false); }}
                          className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-sky-50 dark:hover:bg-sky-950/30 rounded-lg transition-colors group/link text-left"
                        >
                          <ExternalLink size={10} className="text-sky-500 shrink-0" />
                          <span className="text-[10px] font-semibold text-foreground truncate max-w-[140px] group-hover/link:text-sky-600 transition-colors leading-tight">
                            {link.name || link.url}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          {fileCount > 0 && (
            <div className="relative" ref={filePopupRef}>
              <button
                type="button"
                onClick={handleFileBadgeClick}
                className="text-[9px] px-1.5 py-0.5 rounded-md border font-bold flex items-center gap-1 bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors z-10 cursor-pointer"
                title={`${fileCount} tệp đính kèm (Bấm để xem/tải)`}
              >
                <FileText size={10} className="shrink-0" />
                {fileCount > 1 && <span className="text-[9px] font-bold leading-none">{fileCount}</span>}
              </button>

              {/* Multi-file popup with compact styling and truncated titles */}
              {showFilesPopup && attachments.length > 1 && (
                <div
                  className="absolute right-0 sm:left-0 top-full mt-1.5 w-52 max-w-[calc(100vw-32px)] bg-white/95 dark:bg-card/95 backdrop-blur-md border border-border/80 rounded-xl shadow-xl z-50 p-1 animate-in fade-in zoom-in-95 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-2 py-1 border-b border-border/40 mb-1">
                    <span className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <FileText size={10} className="text-emerald-500" /> {attachments.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFilesPopup(false)}
                      className="p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                      title="Đóng"
                    >
                      <X size={10} />
                    </button>
                  </div>
                  <div className="max-h-44 overflow-y-auto custom-scrollbar space-y-0.5">
                    {attachments.map((att) => {
                      const canPreview = isPreviewable(att.type, att.name);
                      const icon = getFileIcon(att.type);
                      return (
                        <div
                          key={att.id}
                          title={att.name}
                          className="flex items-center justify-between gap-1 px-2 py-1.5 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 rounded-lg transition-colors group/item"
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="text-xs shrink-0">{icon}</span>
                            <span className="text-[10px] font-semibold text-foreground truncate max-w-[110px] leading-tight">
                              {att.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {canPreview && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const blob = new Blob([att.data], { type: att.type });
                                  const url = URL.createObjectURL(blob);
                                  setPreviewAttachment({ url, name: att.name, type: att.type });
                                  setShowFilesPopup(false);
                                }}
                                className="p-1 hover:bg-blue-50 text-slate-400 hover:text-blue-600 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 rounded-md transition-colors cursor-pointer"
                                title="Xem trước"
                              >
                                <Eye size={10} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadAttachment(att);
                              }}
                              className="p-1 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400 rounded-md transition-colors cursor-pointer"
                              title="Tải về"
                            >
                              <Download size={10} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {previewAttachment && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={(e) => {
            e.stopPropagation();
            URL.revokeObjectURL(previewAttachment.url);
            setPreviewAttachment(null);
          }}
        >
          <div
            className="relative bg-white dark:bg-card border border-border/80 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-slate-50/80 dark:bg-card shrink-0 gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="text-base shrink-0">{getFileIcon(previewAttachment.type)}</span>
                <p className="text-xs sm:text-sm font-bold text-foreground truncate">{previewAttachment.name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = previewAttachment.url;
                    a.download = previewAttachment.name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
                  title="Tải xuống"
                >
                  <Download size={13} />
                  <span>Tải về</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(previewAttachment.url);
                    setPreviewAttachment(null);
                  }}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-colors cursor-pointer"
                  title="Đóng"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center p-3 sm:p-4 min-h-[300px] max-h-[78vh] bg-slate-900/5 dark:bg-black/40">
              {previewAttachment.type.startsWith('image/') ? (
                <img
                  src={previewAttachment.url}
                  alt={previewAttachment.name}
                  className="max-w-full max-h-[74vh] object-contain rounded-xl shadow-sm"
                />
              ) : previewAttachment.type === 'application/pdf' ? (
                <iframe
                  src={previewAttachment.url}
                  title={previewAttachment.name}
                  className="w-full h-[74vh] rounded-xl border-0 shadow-sm"
                />
              ) : previewAttachment.type.startsWith('video/') ? (
                <video
                  src={previewAttachment.url}
                  controls
                  autoPlay
                  className="max-w-full max-h-[74vh] rounded-xl shadow-sm"
                />
              ) : previewAttachment.type.startsWith('audio/') ? (
                <div className="p-8 flex flex-col items-center gap-3">
                  <p className="text-xs font-bold text-foreground">{previewAttachment.name}</p>
                  <audio src={previewAttachment.url} controls autoPlay className="w-80 sm:w-96" />
                </div>
              ) : (
                <iframe
                  src={previewAttachment.url}
                  title={previewAttachment.name}
                  className="w-full h-[70vh] rounded-xl bg-white p-4 font-mono text-xs shadow-sm"
                />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {!isOverlay && onDelete && (
        <div
          className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 backdrop-blur-sm px-1 py-0.5 rounded-lg border border-border z-20"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDelete(todo.id);
            }}
            className="p-1 hover:bg-secondary text-muted-foreground hover:text-rose-600 rounded transition-colors cursor-pointer"
            title="Xoa"
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
});

TaskCardShell.displayName = 'TaskCardShell';

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} Th${date.getMonth() + 1}`;
};

const isOverdue = (dateStr?: string) => {
  if (!dateStr) return false;
  const end = new Date(dateStr).getTime();
  return Number.isFinite(end) && end < Date.now();
};
