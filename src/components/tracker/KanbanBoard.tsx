import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
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
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Calendar,
  CheckSquare,
  Plus,
  Trash2,
  Link2,
  ExternalLink,
  FileText,
  Eye,
  Download,
  X,
  Copy,
  Check,
  Globe,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  RotateCcw,
  Sparkles,
  MoreHorizontal
} from 'lucide-react';
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
  onMoveTodoStatus?: (id: string, status: TodoStatus) => void;
  onReorderTodos: (reordered: Todo[]) => void;
  onEditTodo: (todo: Todo) => void;
  onDeleteTodo: (id: string) => void;
  onQuickAddTodo: (status: TodoStatus) => void;
}

const COLUMNS: { id: TodoStatus; label: string; dot: string; lightBg: string; activeBorder: string }[] = [
  { id: 'backlog', label: 'Backlog', dot: 'bg-slate-400', lightBg: 'bg-slate-500/10 text-slate-700 dark:text-slate-300', activeBorder: 'border-slate-400' },
  { id: 'todo', label: 'Todo', dot: 'bg-blue-500', lightBg: 'bg-blue-500/10 text-blue-700 dark:text-blue-300', activeBorder: 'border-blue-500' },
  { id: 'doing', label: 'Doing', dot: 'bg-orange-500', lightBg: 'bg-orange-500/10 text-orange-700 dark:text-orange-300', activeBorder: 'border-orange-500' },
  { id: 'done', label: 'Done', dot: 'bg-emerald-500', lightBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', activeBorder: 'border-emerald-500' },
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

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  todos,
  onMoveTodoStatus,
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
  const lastDragOverTimeRef = useRef<number>(0);

  // Mobile navigation state
  const [activeMobileCol, setActiveMobileCol] = useState<TodoStatus>('todo');
  const carouselRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef<{ [key in TodoStatus]?: HTMLDivElement | null }>({});

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

  // Quick move status handler with optimistic state
  const handleQuickMove = useCallback((todoId: string, nextStatus: TodoStatus) => {
    updateLocalTodos((prev) => {
      const target = prev.find(t => t.id === todoId);
      if (!target || getEffectiveStatus(target) === nextStatus) return prev;

      const updated = prev.map(t => {
        if (t.id === todoId) {
          return {
            ...t,
            status: nextStatus,
            is_completed: nextStatus === 'done',
            completed_at: nextStatus === 'done' ? (t.completed_at || new Date().toISOString()) : null,
          };
        }
        return t;
      });

      return updated;
    });

    if (onMoveTodoStatus) {
      onMoveTodoStatus(todoId, nextStatus);
    }
  }, [updateLocalTodos, onMoveTodoStatus]);

  // Touch & Mouse Sensors
  const mouseSensorOptions = useMemo(() => ({
    activationConstraint: { distance: 4 },
  }), []);
  const touchSensorOptions = useMemo(() => ({
    activationConstraint: { delay: 200, tolerance: 8 },
  }), []);

  const sensors = useSensors(
    useSensor(MouseSensor, mouseSensorOptions),
    useSensor(TouchSensor, touchSensorOptions),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string;
    isDraggingRef.current = true;
    const found = localTodosRef.current.find(todo => todo.id === id) || null;
    activeTodoRef.current = found;
    setActiveId(id);

    const element = document.getElementById(`todo-card-${id}`);
    if (element) {
      setActiveWidth(element.getBoundingClientRect().width);
    }
  }, []);

  // Optimized cross-column move during drag with throttling
  const handleDragOver = useCallback((event: DragOverEvent) => {
    if (!isDraggingRef.current) return;

    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    // Throttle dragOver updates to prevent layout thrashing and UI lockups
    const now = Date.now();
    if (now - lastDragOverTimeRef.current < 45) return;
    lastDragOverTimeRef.current = now;

    const currentList = localTodosRef.current;
    const activeTodo = currentList.find(t => t.id === activeId);
    if (!activeTodo) return;

    const overIsColumn = COLUMN_IDS.includes(overId as TodoStatus);
    const overTodo = overIsColumn ? null : currentList.find(t => t.id === overId);

    const activeContainer = getEffectiveStatus(activeTodo);
    const overContainer = overIsColumn ? (overId as TodoStatus) : (overTodo ? getEffectiveStatus(overTodo) : null);

    // Only update state when crossing into a DIFFERENT column
    if (overContainer && activeContainer !== overContainer) {
      updateLocalTodos((prev) => {
        const itemToMove = prev.find(t => t.id === activeId);
        if (!itemToMove) return prev;
        if (getEffectiveStatus(itemToMove) === overContainer) return prev;

        const updatedItem: Todo = {
          ...itemToMove,
          status: overContainer,
          is_completed: overContainer === 'done',
          completed_at: overContainer === 'done' ? (itemToMove.completed_at || new Date().toISOString()) : null,
        };

        const withoutItem = prev.filter(t => t.id !== activeId);

        if (overIsColumn) {
          if (overContainer === 'done') {
            const firstDoneIndex = withoutItem.findIndex(t => getEffectiveStatus(t) === 'done');
            const insertIndex = firstDoneIndex === -1 ? withoutItem.length : firstDoneIndex;
            return [
              ...withoutItem.slice(0, insertIndex),
              updatedItem,
              ...withoutItem.slice(insertIndex)
            ];
          }
          const lastIndex = withoutItem.reduce(
            (last, t, idx) => (getEffectiveStatus(t) === overContainer ? idx : last),
            -1
          );
          const insertIndex = lastIndex === -1 ? withoutItem.length : lastIndex + 1;
          return [
            ...withoutItem.slice(0, insertIndex),
            updatedItem,
            ...withoutItem.slice(insertIndex)
          ];
        }

        const overIndex = withoutItem.findIndex(t => t.id === overId);
        if (overIndex === -1) {
          return [...withoutItem, updatedItem];
        }

        return [
          ...withoutItem.slice(0, overIndex),
          updatedItem,
          ...withoutItem.slice(overIndex)
        ];
      });
    }
  }, [updateLocalTodos]);

  // Final placement calculation on drag end
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

    const activeId = active.id as string;
    const overId = over.id as string;

    const currentList = localTodosRef.current;
    const activeTodo = currentList.find(t => t.id === activeId);
    if (!activeTodo) return;

    const overIsColumn = COLUMN_IDS.includes(overId as TodoStatus);
    const overTodo = overIsColumn ? null : currentList.find(t => t.id === overId);

    const activeContainer = getEffectiveStatus(activeTodo);
    const overContainer = overIsColumn ? (overId as TodoStatus) : (overTodo ? getEffectiveStatus(overTodo) : activeContainer);

    let finalTodos = [...currentList];

    // Case 1: Reordering within the SAME column
    if (activeId !== overId && !overIsColumn && overTodo && activeContainer === overContainer) {
      const oldIndex = currentList.findIndex(t => t.id === activeId);
      const newIndex = currentList.findIndex(t => t.id === overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        finalTodos = arrayMove(currentList, oldIndex, newIndex);
      }
    }
    // Case 2: Moving into a different column or dropped on a column header
    else if (activeContainer !== overContainer || overIsColumn) {
      const updatedItem: Todo = {
        ...activeTodo,
        status: overContainer,
        is_completed: overContainer === 'done',
        completed_at: overContainer === 'done' ? (activeTodo.completed_at || new Date().toISOString()) : null,
      };

      const withoutItem = currentList.filter(t => t.id !== activeId);

      if (overIsColumn) {
        if (overContainer === 'done') {
          const firstDoneIndex = withoutItem.findIndex(t => getEffectiveStatus(t) === 'done');
          const insertIndex = firstDoneIndex === -1 ? withoutItem.length : firstDoneIndex;
          finalTodos = [
            ...withoutItem.slice(0, insertIndex),
            updatedItem,
            ...withoutItem.slice(insertIndex)
          ];
        } else {
          const lastIndex = withoutItem.reduce(
            (last, t, idx) => (getEffectiveStatus(t) === overContainer ? idx : last),
            -1
          );
          const insertIndex = lastIndex === -1 ? withoutItem.length : lastIndex + 1;
          finalTodos = [
            ...withoutItem.slice(0, insertIndex),
            updatedItem,
            ...withoutItem.slice(insertIndex)
          ];
        }
      } else {
        const overIndex = withoutItem.findIndex(t => t.id === overId);
        if (overIndex === -1) {
          finalTodos = [...withoutItem, updatedItem];
        } else {
          finalTodos = [
            ...withoutItem.slice(0, overIndex),
            updatedItem,
            ...withoutItem.slice(overIndex)
          ];
        }
      }
    }

    updateLocalTodos(finalTodos);

    if (!hasSameBoardState(sortedTodosRef.current, finalTodos)) {
      onReorderTodosRef.current(finalTodos);
    }
  }, [updateLocalTodos]);

  const handleDragCancel = useCallback(() => {
    isDraggingRef.current = false;
    setActiveId(null);
    setActiveWidth(null);
    activeTodoRef.current = null;
    updateLocalTodos(sortedTodosRef.current);
  }, [updateLocalTodos]);

  // Robust collision detection
  const collisionDetectionStrategy = useCallback((args: any) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    const intersections = rectIntersection(args);
    if (intersections.length > 0) {
      return intersections;
    }
    return closestCorners(args);
  }, []);

  // Smooth scroll carousel to column on mobile
  const scrollToColumn = useCallback((colId: TodoStatus) => {
    setActiveMobileCol(colId);
    const target = columnRefs.current[colId];
    if (target && carouselRef.current) {
      target.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  }, []);

  // Update active tab when user swipes carousel on mobile
  const handleCarouselScroll = useCallback(() => {
    const container = carouselRef.current;
    if (!container) return;
    const scrollLeft = container.scrollLeft;
    const containerWidth = container.clientWidth;

    let closestCol = activeMobileCol;
    let minDistance = Infinity;

    COLUMNS.forEach((col) => {
      const el = columnRefs.current[col.id];
      if (el) {
        const elCenter = el.offsetLeft + el.offsetWidth / 2;
        const viewCenter = scrollLeft + containerWidth / 2;
        const distance = Math.abs(elCenter - viewCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestCol = col.id;
        }
      }
    });

    if (closestCol !== activeMobileCol) {
      setActiveMobileCol(closestCol);
    }
  }, [activeMobileCol]);

  // Next / Prev mobile column helpers
  const currentColIndex = COLUMNS.findIndex(c => c.id === activeMobileCol);
  const handlePrevColumn = () => {
    if (currentColIndex > 0) {
      scrollToColumn(COLUMNS[currentColIndex - 1].id);
    }
  };
  const handleNextColumn = () => {
    if (currentColIndex < COLUMNS.length - 1) {
      scrollToColumn(COLUMNS[currentColIndex + 1].id);
    }
  };

  // Progress metrics
  const totalTasksCount = localTodos.length;
  const doneTasksCount = localTodos.filter(t => getEffectiveStatus(t) === 'done').length;
  const progressPercent = totalTasksCount > 0 ? Math.round((doneTasksCount / totalTasksCount) * 100) : 0;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="w-full flex flex-col">
        {/* MOBILE NAVIGATION & PROGRESS HEADER (< md) */}
        <div className="md:hidden flex flex-col gap-2.5 mb-3 select-none">
          {/* Progress summary bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-card border border-border/70 rounded-2xl shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Sparkles size={12} />
              </span>
              <span className="text-[11px] font-bold text-foreground truncate">Tiến độ bảng</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-20 sm:w-28 bg-secondary h-2 rounded-full overflow-hidden border border-border/40">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {doneTasksCount}/{totalTasksCount} ({progressPercent}%)
              </span>
            </div>
          </div>

          {/* Segmented Column Tabs with Quick Arrow Navigation */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevColumn}
              disabled={currentColIndex === 0}
              className={`p-1.5 rounded-xl border border-border/60 bg-white dark:bg-card transition-all shrink-0 cursor-pointer ${
                currentColIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-secondary text-foreground active:scale-95'
              }`}
              title="Cột trước"
            >
              <ChevronLeft size={15} />
            </button>

            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-muted/40 rounded-2xl flex-1 border border-border/40">
              {COLUMNS.map((col) => {
                const count = getTodosForColumn(localTodos, col.id).length;
                const isActive = activeMobileCol === col.id;

                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => scrollToColumn(col.id)}
                    className={`flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-white dark:bg-card text-foreground shadow-xs ring-1 ring-border/50 scale-[1.02]'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/40 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${col.dot}`} />
                    <span className="truncate">{col.label}</span>
                    <span className={`text-[9px] px-1 rounded-full font-black ${
                      isActive ? 'bg-secondary text-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleNextColumn}
              disabled={currentColIndex === COLUMNS.length - 1}
              className={`p-1.5 rounded-xl border border-border/60 bg-white dark:bg-card transition-all shrink-0 cursor-pointer ${
                currentColIndex === COLUMNS.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-secondary text-foreground active:scale-95'
              }`}
              title="Cột kế tiếp"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {/* COLUMNS CONTAINER: Swipe Carousel on Mobile (< md), Flex Row on Desktop (>= md) */}
        <div
          ref={carouselRef}
          onScroll={handleCarouselScroll}
          className="flex flex-row overflow-x-auto snap-x snap-mandatory scroll-smooth gap-3 pb-3 px-0.5 md:px-0 md:gap-2.5 md:overflow-x-auto md:pb-4 md:items-stretch md:w-full select-none custom-scrollbar"
        >
          {COLUMNS.map((col) => {
            const colTodos = getTodosForColumn(localTodos, col.id);

            return (
              <ColumnContainer
                key={col.id}
                colRef={(el) => { columnRefs.current[col.id] = el; }}
                col={col}
                count={colTodos.length}
                onQuickAdd={() => onQuickAddTodo(col.id)}
              >
                <SortableContext
                  items={colTodos.map((todo) => todo.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2 min-h-[120px] max-h-[58vh] md:max-h-[260px] overflow-y-auto px-1.5 py-1.5 pb-6 md:pb-8 custom-scrollbar scroll-fade-bottom">
                    {colTodos.map((todo) => (
                      <SortableCard
                        key={todo.id}
                        todo={todo}
                        onEdit={onEditTodo}
                        onDelete={onDeleteTodo}
                        onMoveStatus={handleQuickMove}
                      />
                    ))}
                    {colTodos.length === 0 && (
                      <div className="flex min-h-[112px] flex-col items-center justify-center rounded-2xl border border-dashed border-border px-4 py-8 text-xs font-semibold text-muted-foreground gap-1.5">
                        <span className="text-sm">📭</span>
                        <span>Chưa có nhiệm vụ</span>
                        <button
                          type="button"
                          onClick={() => onQuickAddTodo(col.id)}
                          className="mt-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                        >
                          + Thêm task
                        </button>
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
        duration: 120,
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
  colRef?: (el: HTMLDivElement | null) => void;
  children: React.ReactNode;
}

const ColumnContainer: React.FC<ColumnContainerProps> = ({
  col,
  count,
  onQuickAdd,
  colRef,
  children,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        if (colRef) colRef(node);
      }}
      className={`flex flex-col w-[85vw] max-w-[340px] shrink-0 snap-center md:snap-align-none md:flex-1 md:w-auto md:max-w-none min-w-[185px] md:min-w-[160px] lg:min-w-[170px] xl:min-w-[190px] rounded-[20px] kanban-column px-2.5 py-2.5 md:px-2 md:py-2 transition-all duration-150 border ${
        isOver
          ? 'ring-2 ring-indigo-500/20 bg-indigo-50/10 border-indigo-200/50 shadow-sm'
          : 'border-border/40'
      }`}
    >
      <div className="flex items-center justify-between mb-3 md:mb-4 select-none w-full px-0.5 md:px-0">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 md:w-2 md:h-2 rounded-full ${col.dot}`} />
          <h4 className="font-bold text-foreground text-xs">{col.label}</h4>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 bg-secondary text-muted-foreground rounded-full">
          <span className="md:hidden">{count} việc</span>
          <span className="hidden md:inline">{count}</span>
        </span>
      </div>

      <div className="flex-1">{children}</div>

      <button
        onClick={onQuickAdd}
        className="w-full mt-2.5 md:mt-3 py-2 text-muted-foreground hover:text-foreground text-xs font-bold flex items-center gap-1.5 hover:bg-secondary/50 rounded-xl transition-all justify-start px-2.5 cursor-pointer active:scale-98"
      >
        <Plus size={14} className="stroke-[3]" />
        <span className="md:hidden">Thêm vào {col.label}</span>
        <span className="hidden md:inline">Task</span>
      </button>
    </div>
  );
};

interface SortableCardProps {
  todo: Todo;
  onEdit: (todo: Todo) => void;
  onDelete: (id: string) => void;
  onMoveStatus?: (id: string, status: TodoStatus) => void;
}

const attachmentCountCache = new Map<string, number>();

const SortableCard = React.memo<SortableCardProps>(({
  todo,
  onEdit,
  onDelete,
  onMoveStatus,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
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
      <TaskCardShell todo={todo} onDelete={onDelete} onMoveStatus={onMoveStatus} />
    </div>
  );
});

SortableCard.displayName = 'SortableCard';

interface TaskLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle: string;
  links: TaskLink[];
}

const TaskLinksModal: React.FC<TaskLinksModalProps> = ({
  isOpen,
  onClose,
  taskTitle,
  links,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || links.length === 0) return null;

  const handleCopy = (id: string, rawUrl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenLink = (rawUrl: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleOpenAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    links.forEach((link) => {
      const url = link.url.startsWith('http') ? link.url : `https://${link.url}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  };

  const getDomain = (rawUrl: string) => {
    try {
      const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="relative bg-white dark:bg-card border border-border/80 rounded-3xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-slate-50/80 dark:bg-muted/30 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/20">
              <Link2 size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                  Danh sách liên kết
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                  {links.length} link
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5" title={taskTitle}>
                Nhiệm vụ: <span className="text-foreground/90 font-medium">{taskTitle}</span>
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

        {/* Modal Body: Link Cards */}
        <div className="flex-1 overflow-y-auto max-h-[60vh] p-4 sm:p-5 space-y-2.5 custom-scrollbar">
          {links.map((link) => {
            const domain = getDomain(link.url);
            const isCopied = copiedId === link.id;
            const fullUrl = link.url.startsWith('http') ? link.url : `https://${link.url}`;

            return (
              <div
                key={link.id}
                onClick={(e) => handleOpenLink(link.url, e)}
                className="group relative flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl border border-border/70 bg-secondary/20 hover:bg-sky-50/50 dark:hover:bg-sky-950/20 hover:border-sky-500/40 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Favicon / Icon */}
                  <div className="w-8 h-8 rounded-xl bg-background flex items-center justify-center shrink-0 overflow-hidden border border-border/70 shadow-2xs">
                    {domain ? (
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                        alt=""
                        className="w-4 h-4 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <Globe size={15} className="text-sky-500" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                      <p className="text-xs sm:text-sm font-bold text-foreground group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors truncate">
                        {link.name || domain || link.url}
                      </p>
                      {domain && (
                        <span className="text-[10px] text-muted-foreground/80 font-medium px-1.5 py-0.2 bg-muted/60 rounded border border-border/40 shrink-0">
                          {domain}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate font-mono mt-0.5" title={fullUrl}>
                      {fullUrl}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => handleCopy(link.id, link.url, e)}
                    className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      isCopied
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent'
                    }`}
                    title={isCopied ? 'Đã sao chép liên kết!' : 'Sao chép liên kết'}
                  >
                    {isCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    {isCopied && <span className="text-[11px] hidden sm:inline font-bold">Đã chép</span>}
                  </button>

                  <a
                    href={fullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Truy cập liên kết trong tab mới"
                  >
                    <ExternalLink size={13} />
                    <span className="hidden sm:inline">Mở link</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-slate-50/50 dark:bg-muted/20 shrink-0">
          <button
            type="button"
            onClick={handleOpenAll}
            className="flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer active:scale-95 border border-sky-200/50 dark:border-sky-800/50"
            title="Mở toàn bộ liên kết trong các tab mới"
          >
            <ExternalLink size={13} />
            <span>Mở tất cả ({links.length})</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary px-4 py-1.5 rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

interface TaskFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle: string;
  attachments: TaskAttachment[];
  onPreview: (attachment: TaskAttachment) => void;
}

const TaskFilesModal: React.FC<TaskFilesModalProps> = ({
  isOpen,
  onClose,
  taskTitle,
  attachments,
  onPreview,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || attachments.length === 0) return null;

  const handleDownloadAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    attachments.forEach((att) => {
      downloadAttachment(att);
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="relative bg-white dark:bg-card border border-border/80 rounded-3xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-slate-50/80 dark:bg-muted/30 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <FileText size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                  Tệp đính kèm
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {attachments.length} tệp
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5" title={taskTitle}>
                Nhiệm vụ: <span className="text-foreground/90 font-medium">{taskTitle}</span>
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

        {/* Modal Body: File Cards */}
        <div className="flex-1 overflow-y-auto max-h-[60vh] p-4 sm:p-5 space-y-2.5 custom-scrollbar">
          {attachments.map((att) => {
            const canPreview = isPreviewable(att.type, att.name);
            const icon = getFileIcon(att.type);

            return (
              <div
                key={att.id}
                onClick={() => {
                  if (canPreview) {
                    onPreview(att);
                  } else {
                    downloadAttachment(att);
                  }
                }}
                className="group relative flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl border border-border/70 bg-secondary/20 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 hover:border-emerald-500/40 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* File icon */}
                  <div className="w-9 h-9 rounded-xl bg-background flex items-center justify-center shrink-0 border border-border/70 shadow-2xs text-lg">
                    {icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                      {att.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {formatFileSize(att.size)}
                      </span>
                      {att.type && (
                        <span className="text-[10px] text-muted-foreground/80 font-medium px-1.5 py-0.2 bg-muted/60 rounded border border-border/40 shrink-0 truncate max-w-[130px]">
                          {att.type.split('/')[1]?.toUpperCase() || att.type}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {canPreview && (
                    <button
                      type="button"
                      onClick={() => onPreview(att)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Xem trước tệp"
                    >
                      <Eye size={13} />
                      <span className="hidden sm:inline">Xem</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => downloadAttachment(att)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Tải tệp về máy"
                  >
                    <Download size={13} />
                    <span className="hidden sm:inline">Tải về</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-slate-50/50 dark:bg-muted/20 shrink-0">
          <button
            type="button"
            onClick={handleDownloadAll}
            className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer active:scale-95 border border-emerald-200/50 dark:border-emerald-800/50"
            title="Tải toàn bộ tệp đính kèm về máy"
          >
            <Download size={13} />
            <span>Tải tất cả ({attachments.length})</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary px-4 py-1.5 rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

interface TaskCardShellProps {
  todo: Todo;
  width?: number;
  isOverlay?: boolean;
  onDelete?: (id: string) => void;
  onMoveStatus?: (id: string, status: TodoStatus) => void;
}

const TaskCardShell = React.memo<TaskCardShellProps>(({
  todo,
  width,
  isOverlay = false,
  onDelete,
  onMoveStatus,
}) => {
  const currentStatus = getEffectiveStatus(todo);
  const completedSubtasks = todo.subtasks?.filter((subtask) => subtask.is_completed).length || 0;
  const totalSubtasks = todo.subtasks?.length || 0;
  const links = useMemo(() => parseTaskLinks(todo.attach_link), [todo.attach_link]);
  const [showLinksPopup, setShowLinksPopup] = useState(false);
  const [fileCount, setFileCount] = useState<number>(() => attachmentCountCache.get(todo.id) || 0);
  const [showFilesPopup, setShowFilesPopup] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<{ url: string; name: string; type: string } | null>(null);

  // Cached attachment count loading - skips unnecessary queries during drag
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

    if (!attachmentCountCache.has(todo.id)) {
      updateCount();
    }

    window.addEventListener('task_attachments_updated', updateCount);
    return () => {
      isMounted = false;
      window.removeEventListener('task_attachments_updated', updateCount);
    };
  }, [todo.id, isOverlay]);

  const handleLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowFilesPopup(false);
    if (links.length === 1) {
      const url = links[0].url.startsWith('http') ? links[0].url : `https://${links[0].url}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (links.length > 1) {
      setShowLinksPopup(true);
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
        setShowFilesPopup(true);
      }
    } catch (err) {
      console.error('Lỗi khi mở tệp đính kèm:', err);
    }
  };

  // Quick next status determination
  const getNextStatusAction = () => {
    switch (currentStatus) {
      case 'backlog':
        return { target: 'todo' as TodoStatus, label: 'Todo', icon: <ArrowRight size={9} />, color: 'bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 border-blue-200/50' };
      case 'todo':
        return { target: 'doing' as TodoStatus, label: 'Doing', icon: <ArrowRight size={9} />, color: 'bg-orange-50 hover:bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400 border-orange-200/50' };
      case 'doing':
        return { target: 'done' as TodoStatus, label: 'Xong', icon: <Check size={9} className="stroke-[3]" />, color: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200/50' };
      case 'done':
        return { target: 'doing' as TodoStatus, label: 'Làm lại', icon: <RotateCcw size={9} />, color: 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200/60' };
      default:
        return null;
    }
  };

  const nextAction = getNextStatusAction();

  return (
    <div
      style={width ? { width: `${width}px` } : undefined}
      className={`relative flex min-h-[38px] flex-col gap-1.5 md:gap-1 rounded-2xl md:rounded-xl bg-card pl-2.5 pr-2.5 py-2.5 md:pl-2 md:pr-2 md:py-2 select-none z-10 ${isOverlay
        ? 'border border-border/80 shadow-2xl cursor-grabbing pointer-events-none opacity-95'
        : 'border border-border shadow-sm hover:border-primary/40 transition-all'
        }`}
    >
      <p className="text-[12px] md:text-[11px] font-semibold text-foreground leading-snug md:leading-tight break-words pr-0">
        {todo.content}
      </p>

      {todo.description && (
        <p className="text-[11px] md:text-[10px] text-muted-foreground font-medium line-clamp-2 leading-normal">
          {todo.description}
        </p>
      )}

      {/* Metadata Badges: Subtasks, Deadlines, Links, Files */}
      {(totalSubtasks > 0 || todo.deadline || links.length > 0 || fileCount > 0) && (
        <div className="flex items-center gap-1.5 md:gap-2 mt-0.5 md:mt-1 flex-wrap select-none">
          {totalSubtasks > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md border text-muted-foreground border-border bg-secondary font-bold flex items-center gap-1">
              <CheckSquare size={9} />
              {completedSubtasks}/{totalSubtasks}
            </span>
          )}
          {todo.deadline && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-md border font-bold flex items-center gap-1 ${isOverdue(todo.deadline)
              ? 'bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-400'
              : 'bg-indigo-50 border-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:border-indigo-900/60 dark:text-indigo-400'
              }`}>
              <Calendar size={9} />
              {formatDate(todo.deadline)}
            </span>
          )}
          {links.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={handleLinkClick}
                className="text-[9px] px-1.5 py-0.5 rounded-md border font-bold flex items-center gap-1 bg-sky-50 border-sky-100 text-sky-600 hover:text-sky-800 hover:bg-sky-100 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-400 dark:hover:bg-sky-900/60 transition-colors z-10 cursor-pointer"
                title={links.length === 1 ? (links[0].name || links[0].url) : `${links.length} liên kết (Bấm để xem danh sách)`}
              >
                <Link2 size={10} className="shrink-0" />
                {links.length > 1 && <span className="text-[9px] font-bold leading-none">{links.length}</span>}
              </button>
            </div>
          )}
          {fileCount > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={handleFileBadgeClick}
                className="text-[9px] px-1.5 py-0.5 rounded-md border font-bold flex items-center gap-1 bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors z-10 cursor-pointer"
                title={fileCount === 1 ? '1 tệp đính kèm (Bấm để xem/tải)' : `${fileCount} tệp đính kèm (Bấm để xem danh sách)`}
              >
                <FileText size={10} className="shrink-0" />
                {fileCount > 1 && <span className="text-[9px] font-bold leading-none">{fileCount}</span>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* QUICK STATUS TRANSITION & ACTIONS BAR - MOBILE ONLY (md:hidden) */}
      {!isOverlay && onMoveStatus && (
        <div
          className="md:hidden flex items-center justify-between gap-1.5 pt-1 mt-0.5 border-t border-border/40"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Smart Next Status Step Button */}
          {nextAction && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveStatus(todo.id, nextAction.target);
              }}
              className={`text-[9px] px-2 py-0.5 rounded-lg border font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 ${nextAction.color}`}
              title={`Chuyển sang ${nextAction.label}`}
            >
              <span>{nextAction.label}</span>
              {nextAction.icon}
            </button>
          )}

          {/* Quick Status Menu Button */}
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowStatusMenu(!showStatusMenu);
              }}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
              title="Đổi cột trạng thái"
            >
              <MoreHorizontal size={12} />
            </button>

            {/* Dropdown Popover for All Statuses */}
            {showStatusMenu && (
              <div
                className="absolute right-0 bottom-full mb-1.5 w-32 bg-white dark:bg-card border border-border rounded-xl shadow-xl p-1 z-30 animate-in zoom-in-95 duration-100 flex flex-col gap-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2 py-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50">
                  Chuyển cột
                </div>
                {COLUMNS.map((c) => {
                  const isCurrent = currentStatus === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowStatusMenu(false);
                        if (!isCurrent) {
                          onMoveStatus(todo.id, c.id);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1 text-[11px] rounded-lg font-medium transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-secondary font-bold text-foreground'
                          : 'hover:bg-secondary/70 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                        {c.label}
                      </span>
                      {isCurrent && <Check size={10} className="text-emerald-500 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      {showLinksPopup && links.length > 1 && typeof document !== 'undefined' && createPortal(
        <TaskLinksModal
          isOpen={showLinksPopup}
          onClose={() => setShowLinksPopup(false)}
          taskTitle={todo.content}
          links={links}
        />,
        document.body
      )}

      {showFilesPopup && attachments.length > 1 && typeof document !== 'undefined' && createPortal(
        <TaskFilesModal
          isOpen={showFilesPopup}
          onClose={() => setShowFilesPopup(false)}
          taskTitle={todo.content}
          attachments={attachments}
          onPreview={(att) => {
            const blob = new Blob([att.data], { type: att.type });
            const url = URL.createObjectURL(blob);
            setPreviewAttachment({ url, name: att.name, type: att.type });
            setShowFilesPopup(false);
          }}
        />,
        document.body
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
            title="Xóa"
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
