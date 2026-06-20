import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  closestCenter,
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
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
import { Calendar, CheckSquare, Plus, Trash2 } from 'lucide-react';
import { Todo, TodoStatus } from '../../types';

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
  return allTodos.filter((todo) => getEffectiveStatus(todo) === colId);
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
    return other && todo.id === other.id && getEffectiveStatus(todo) === getEffectiveStatus(other);
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

  useEffect(() => {
    if (!isDraggingRef.current) {
      localTodosRef.current = sortedTodos;
      setLocalTodos(sortedTodos);
    }
  }, [sortedTodos]);

  const updateLocalTodos = (next: Todo[] | ((prev: Todo[]) => Todo[])) => {
    setLocalTodos((prev) => {
      const resolved = typeof next === 'function' ? (next as (prev: Todo[]) => Todo[])(prev) : next;
      localTodosRef.current = resolved;
      return resolved;
    });
  };

  const mouseSensorOptions = useMemo(() => ({
    activationConstraint: { distance: 8 },
  }), []);
  const touchSensorOptions = useMemo(() => ({
    activationConstraint: { delay: 180, tolerance: 8 },
  }), []);

  const sensors = useSensors(
    useSensor(MouseSensor, mouseSensorOptions),
    useSensor(TouchSensor, touchSensorOptions),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    isDraggingRef.current = true;
    activeTodoRef.current = localTodosRef.current.find(todo => todo.id === id) || null;
    setActiveId(id);

    const element = document.getElementById(`todo-card-${id}`);
    if (element) {
      setActiveWidth(element.getBoundingClientRect().width);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const nextActiveId = active.id as string;
    const overId = over.id as string;

    updateLocalTodos((prev) => {
      const next = moveTodoInBoard(prev, nextActiveId, overId);
      return hasSameBoardState(prev, next) ? prev : next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    isDraggingRef.current = false;
    setActiveId(null);
    setActiveWidth(null);
    activeTodoRef.current = null;

    if (!over) {
      updateLocalTodos(sortedTodos);
      return;
    }

    const nextActiveId = active.id as string;
    const overId = over.id as string;
    const finalTodos = moveTodoInBoard(localTodosRef.current, nextActiveId, overId);

    if (hasSameBoardState(sortedTodos, finalTodos)) {
      updateLocalTodos(sortedTodos);
      return;
    }

    updateLocalTodos(finalTodos);
    onReorderTodos(finalTodos);
  };

  const handleDragCancel = () => {
    isDraggingRef.current = false;
    setActiveId(null);
    setActiveWidth(null);
    activeTodoRef.current = null;
    updateLocalTodos(sortedTodos);
  };

  const collisionDetectionStrategy = React.useCallback((args: any) => {
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
                  <div className="space-y-2 min-h-[120px] max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
                    {colTodos.map((todo) => (
                      <SortableCard
                        key={todo.id}
                        todo={todo}
                        onEdit={onEditTodo}
                        onDelete={onDeleteTodo}
                      />
                    ))}
                    {colTodos.length === 0 && (
                      <div className="flex min-h-[112px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-xs font-semibold text-slate-400">
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

      <DragOverlay adjustScale={false}>
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
      className={`flex flex-col flex-1 min-w-[185px] md:min-w-[160px] lg:min-w-[170px] xl:min-w-[190px] rounded-[20px] bg-[#f8f9fa] px-2 py-2 transition-all duration-150 border ${isOver
        ? 'ring-2 ring-indigo-500/20 bg-indigo-50/10 border-indigo-200/50 shadow-sm'
        : 'border-slate-100/40'
        }`}
    >
      <div className="flex items-center justify-between mb-4 select-none w-full">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${col.dot}`} />
          <h4 className="font-bold text-slate-800 text-xs">{col.label}</h4>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200/50 text-slate-500 rounded-full">
          {count}
        </span>
      </div>

      <div className="flex-1">{children}</div>

      <button
        onClick={onQuickAdd}
        className="w-full mt-3 py-2 text-slate-400 hover:text-slate-600 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-200/40 rounded-xl transition-all justify-start px-2.5"
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

const SortableCard = React.memo<SortableCardProps>(({
  todo,
  onEdit,
  onDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
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
        <TaskCardShell todo={todo} />
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
      className="group relative cursor-grab active:cursor-grabbing"
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

  return (
    <div
      style={width ? { width: `${width}px` } : undefined}
      className={`relative flex min-h-[38px] flex-col gap-1 rounded-xl bg-white pl-2 pr-2 py-2 select-none ${isOverlay
        ? 'border border-slate-300 shadow-2xl cursor-grabbing pointer-events-none opacity-95'
        : 'border border-slate-100 shadow-sm hover:border-slate-300 transition-all'
        }`}
    >
      <p className="text-[11px] font-semibold text-slate-800 leading-tight break-words pr-0">
        {todo.content}
      </p>

      {todo.description && (
        <p className="text-[10px] text-slate-400 font-medium line-clamp-2 leading-normal">
          {todo.description}
        </p>
      )}

      {(totalSubtasks > 0 || todo.deadline) && (
        <div className="flex items-center gap-2 mt-1 flex-wrap select-none">
          {totalSubtasks > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md border text-slate-500 border-slate-100 bg-slate-50 font-bold flex items-center gap-1">
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
        </div>
      )}

      {!isOverlay && onDelete && (
        <div
          className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm px-1 py-0.5 rounded-lg border border-slate-100 z-20"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDelete(todo.id);
            }}
            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
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
