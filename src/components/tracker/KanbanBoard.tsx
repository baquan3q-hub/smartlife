import React, { useState, useEffect, useRef } from 'react';
import { 
  DndContext, 
  DragEndEvent, 
  DragOverEvent,
  DragStartEvent, 
  useSensor, 
  useSensors, 
  MouseSensor,
  TouchSensor,
  DragOverlay, 
  useDroppable,
  closestCorners
} from '@dnd-kit/core';
import { 
  SortableContext, 
  verticalListSortingStrategy, 
  useSortable 
} from '@dnd-kit/sortable';
import { Todo, TodoStatus } from '../../types';
import { Plus, Trash2, CheckSquare, Calendar } from 'lucide-react';

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
  { id: 'done', label: 'Done', dot: 'bg-slate-500' },
];

const COLUMN_IDS: string[] = COLUMNS.map(c => c.id);

/** Determine the effective status of a todo */
const getEffectiveStatus = (t: Todo): TodoStatus => {
  if (t.status) return t.status;
  return t.is_completed ? 'done' : 'todo';
};

/** Filter todos for a column */
const getTodosForColumn = (allTodos: Todo[], colId: TodoStatus): Todo[] => {
  return allTodos.filter((t) => {
    if (colId === 'done') return t.status === 'done' || t.is_completed;
    if (colId === 'todo') return t.status === 'todo' || (!t.status && !t.is_completed);
    return t.status === colId;
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
  // Local copy for real-time visual feedback during drag
  const [localTodos, setLocalTodos] = useState<Todo[]>(todos);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeWidth, setActiveWidth] = useState<number | null>(null);
  const activeTodoRef = useRef<Todo | null>(null);
  const isDraggingRef = useRef(false);

  // Sync from props when NOT dragging
  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalTodos(todos);
    }
  }, [todos]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    isDraggingRef.current = true;
    activeTodoRef.current = todos.find(t => t.id === id) || null;
    setActiveId(id);
    const element = document.getElementById(id);
    if (element) {
      setActiveWidth(element.getBoundingClientRect().width);
    }
  };

  /**
   * onDragOver: ONLY handles CROSS-COLUMN moves.
   * Same-column reordering animation is handled by SortableContext/useSortable.
   *
   * ANTI-LOOP MECHANISM:
   * - If active item is already in the target column → return `prev` (same ref) → no re-render → loop broken
   * - Only creates a new array when the item actually changes columns
   */
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const dragId = active.id as string;
    const overId = over.id as string;

    if (dragId === overId) return;

    setLocalTodos((prev) => {
      const activeTodo = prev.find(t => t.id === dragId);
      if (!activeTodo) return prev;

      const activeColumn = getEffectiveStatus(activeTodo);

      // Determine target column
      let targetColumn: TodoStatus;
      if (COLUMN_IDS.includes(overId)) {
        targetColumn = overId as TodoStatus;
      } else {
        const overTodo = prev.find(t => t.id === overId);
        if (!overTodo) return prev;
        targetColumn = getEffectiveStatus(overTodo);
      }

      // ★ CRITICAL: Same column → bail out with same reference → NO re-render → NO loop
      if (activeColumn === targetColumn) return prev;

      // Cross-column move: update status
      const updated = prev.map(t => {
        if (t.id === dragId) {
          return { ...t, status: targetColumn, is_completed: targetColumn === 'done' };
        }
        return t;
      });

      // If hovering over a specific card, also reposition near it
      if (!COLUMN_IDS.includes(overId)) {
        const aIdx = updated.findIndex(t => t.id === dragId);
        const oIdx = updated.findIndex(t => t.id === overId);
        if (aIdx !== -1 && oIdx !== -1 && aIdx !== oIdx) {
          const [removed] = updated.splice(aIdx, 1);
          updated.splice(oIdx, 0, removed);
        }
      }

      return updated;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    isDraggingRef.current = false;
    setActiveId(null);
    setActiveWidth(null);
    activeTodoRef.current = null;

    if (!over) {
      // Drag cancelled - reset to original props
      setLocalTodos(todos);
      return;
    }

    const draggedId = active.id as string;
    const overId = over.id as string;

    if (draggedId === overId) {
      setLocalTodos(todos);
      return;
    }

    // Start from localTodos which has cross-column moves already applied
    let finalTodos = [...localTodos];

    const draggedTodo = finalTodos.find(t => t.id === draggedId);
    if (!draggedTodo) {
      setLocalTodos(todos);
      return;
    }

    const isOverAColumn = COLUMN_IDS.includes(overId);

    if (isOverAColumn) {
      // Dropped on an empty column area
      const destStatus = overId as TodoStatus;
      finalTodos = finalTodos.map(t => {
        if (t.id === draggedId) {
          return { ...t, status: destStatus, is_completed: destStatus === 'done' };
        }
        return t;
      });
    } else {
      // Dropped on a card - handle same-column reorder
      const overTodo = finalTodos.find(t => t.id === overId);
      if (overTodo) {
        const draggedColumn = getEffectiveStatus(draggedTodo);
        const overColumn = getEffectiveStatus(overTodo);

        // Update status if needed (cross-column move not yet applied)
        if (draggedColumn !== overColumn) {
          finalTodos = finalTodos.map(t => {
            if (t.id === draggedId) {
              return { ...t, status: overColumn, is_completed: overColumn === 'done' };
            }
            return t;
          });
        }

        // Reorder within the final array
        const dIdx = finalTodos.findIndex(t => t.id === draggedId);
        const oIdx = finalTodos.findIndex(t => t.id === overId);
        if (dIdx !== -1 && oIdx !== -1 && dIdx !== oIdx) {
          const [removed] = finalTodos.splice(dIdx, 1);
          finalTodos.splice(oIdx, 0, removed);
        }
      }
    }

    onReorderTodos(finalTodos);
  };

  const handleDragCancel = () => {
    isDraggingRef.current = false;
    setActiveId(null);
    setActiveWidth(null);
    activeTodoRef.current = null;
    setLocalTodos(todos);
  };

  // Custom collision detection: fallback to closest column horizontally when pointer is in gaps/outside
  const customCollisionDetection = (args: any) => {
    // 1. Try standard closestCorners first
    const collisions = closestCorners(args);
    if (collisions && collisions.length > 0) {
      return collisions;
    }

    // 2. Fallback: Find the column closest to the pointer's X coordinate
    const { pointerCoordinates, droppableContainers } = args;
    if (!pointerCoordinates) return [];

    const x = pointerCoordinates.x;
    const columns = droppableContainers.filter((container: any) =>
      COLUMN_IDS.includes(container.id)
    );

    if (columns.length === 0) return [];

    let closestColumn = null;
    let minDistance = Infinity;

    for (const container of columns) {
      const rect = container.rect.current;
      if (rect) {
        const columnCenterX = rect.left + rect.width / 2;
        const distance = Math.abs(x - columnCenterX);
        if (distance < minDistance) {
          minDistance = distance;
          closestColumn = container;
        }
      }
    }

    if (closestColumn) {
      return [{ id: closestColumn.id }];
    }

    return [];
  };

  // Use localTodos for rendering (has real-time drag state)
  const displayTodos = localTodos;

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="w-full">
        {/* Board Columns Horizontal Container with Uniform Gaps */}
        <div className="flex flex-col md:flex-row gap-2.5 overflow-x-auto pb-4 scrollbar-thin items-stretch w-full select-none">
          {COLUMNS.map((col) => {
            const colTodos = getTodosForColumn(displayTodos, col.id);

            return (
              <ColumnContainer
                key={col.id}
                col={col}
                count={colTodos.length}
                onQuickAdd={() => onQuickAddTodo(col.id)}
              >
                <SortableContext
                  items={colTodos.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3 min-h-[80px] max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                    {colTodos.map((todo) => (
                      <SortableCard
                        key={todo.id}
                        todo={todo}
                        onEdit={onEditTodo}
                        onDelete={onDeleteTodo}
                        activeId={activeId}
                      />
                    ))}
                    {colTodos.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                        Chưa có thẻ nào
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
          <DragOverlayCard
            todo={activeTodoRef.current}
            width={activeWidth || undefined}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

// --- Column Container ---
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
      className={`flex flex-col flex-1 min-w-[185px] md:min-w-[160px] lg:min-w-[170px] xl:min-w-[190px] rounded-[20px] bg-[#f8f9fa] p-2.5 transition-all duration-200 border ${
        isOver 
          ? 'ring-2 ring-indigo-500/20 bg-indigo-50/10 border-indigo-200/50 scale-[1.005] shadow-sm' 
          : 'border-slate-100/40'
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 select-none w-full">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${col.dot}`} />
          <h4 className="font-bold text-slate-800 text-xs">{col.label}</h4>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200/50 text-slate-550 rounded-full">
          {count}
        </span>
      </div>

      {/* Column Cards */}
      <div className="flex-1">
        {children}
      </div>

      {/* Column Footer Quick Add */}
      <button
        onClick={onQuickAdd}
        className="w-full mt-3 py-2 text-slate-400 hover:text-slate-600 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-200/40 rounded-xl transition-all justify-start px-2.5"
      >
        <Plus size={14} className="stroke-[3]" />
        Thêm task
      </button>
    </div>
  );
};

// --- Sortable Card ---
interface SortableCardProps {
  todo: Todo;
  onEdit: (todo: Todo) => void;
  onDelete: (id: string) => void;
  activeId: string | null;
}

const SortableCard: React.FC<SortableCardProps> = ({
  todo,
  onEdit,
  onDelete,
  activeId,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const day = date.getDate();
      const month = date.getMonth() + 1;
      return `${day} Th${month}`;
    } catch (e) {
      return '';
    }
  };

  const isOverdue = (dateStr?: string) => {
    if (!dateStr) return false;
    try {
      const end = new Date(dateStr).getTime();
      const now = new Date().getTime();
      return end < now;
    } catch (e) {
      return false;
    }
  };

  const completedSubtasks = todo.subtasks?.filter((s) => s.is_completed).length || 0;
  const totalSubtasks = todo.subtasks?.length || 0;

  if (isDragging) {
    // Render a ghost placeholder card in the list to preserve layout width/height
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="w-full min-h-[82px] p-2.5 rounded-[18px] border border-dashed border-slate-300 bg-slate-50/50 pointer-events-none"
      />
    );
  }

  return (
    <div
      id={todo.id}
      ref={setNodeRef}
      style={style}
      onClick={() => onEdit(todo)}
      {...attributes}
      {...listeners}
      className="group relative flex flex-col gap-2 p-2.5 rounded-[18px] bg-white border border-slate-100 cursor-grab active:cursor-grabbing select-none hover:border-slate-300 transition-colors duration-150 shadow-sm"
    >
      {/* Content */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-bold text-slate-800 leading-snug break-words flex-1">
          {todo.content}
        </p>
      </div>

      {/* Description Snippet if exists */}
      {todo.description && (
        <p className="text-[10px] text-slate-400 font-medium line-clamp-2 leading-normal">
          {todo.description}
        </p>
      )}

      {/* Footer Info */}
      {(totalSubtasks > 0 || todo.deadline) && (
        <div className="flex items-center gap-2 mt-1 flex-wrap select-none">
          {totalSubtasks > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md border text-slate-500 border-slate-100 bg-slate-50 font-bold flex items-center gap-1">
              <CheckSquare size={9} />
              {completedSubtasks}/{totalSubtasks}
            </span>
          )}
          {todo.deadline && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-md border font-bold flex items-center gap-1 ${
              isOverdue(todo.deadline)
                ? 'bg-rose-50 border-rose-100 text-rose-600'
                : 'bg-indigo-50 border-indigo-100 text-indigo-600'
            }`}>
              <Calendar size={9} />
              {formatDate(todo.deadline)}
            </span>
          )}
        </div>
      )}

      {/* Card hover delete action */}
      <div 
        className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm px-1 py-0.5 rounded-lg border border-slate-100 z-20" 
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(todo.id);
          }}
          className="p-1 hover:bg-slate-100 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
          title="Xóa"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
};

// --- Drag Overlay Visual Card ---
interface DragOverlayCardProps {
  todo: Todo;
  width?: number;
}

const DragOverlayCard: React.FC<DragOverlayCardProps> = ({ todo, width }) => {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const day = date.getDate();
      const month = date.getMonth() + 1;
      return `${day} Th${month}`;
    } catch (e) {
      return '';
    }
  };

  const isOverdue = (dateStr?: string) => {
    if (!dateStr) return false;
    try {
      const end = new Date(dateStr).getTime();
      const now = new Date().getTime();
      return end < now;
    } catch (e) {
      return false;
    }
  };

  const completedSubtasks = todo.subtasks?.filter((s) => s.is_completed).length || 0;
  const totalSubtasks = todo.subtasks?.length || 0;

  return (
    <div
      style={width ? { width: `${width}px` } : undefined}
      className="flex flex-col gap-2 p-2.5 rounded-[18px] bg-white border border-slate-300 shadow-2xl cursor-grabbing select-none z-50 pointer-events-none opacity-95"
    >
      {/* Content */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-bold text-slate-800 leading-snug break-words flex-1">
          {todo.content}
        </p>
      </div>

      {/* Description Snippet if exists */}
      {todo.description && (
        <p className="text-[10px] text-slate-400 font-medium line-clamp-2 leading-normal">
          {todo.description}
        </p>
      )}

      {/* Footer Info */}
      {(totalSubtasks > 0 || todo.deadline) && (
        <div className="flex items-center gap-2 mt-1 flex-wrap select-none">
          {totalSubtasks > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md border text-slate-500 border-slate-100 bg-slate-50 font-bold flex items-center gap-1">
              <CheckSquare size={9} />
              {completedSubtasks}/{totalSubtasks}
            </span>
          )}
          {todo.deadline && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-md border font-bold flex items-center gap-1 ${
              isOverdue(todo.deadline)
                ? 'bg-rose-50 border-rose-100 text-rose-600'
                : 'bg-indigo-50 border-indigo-100 text-indigo-600'
            }`}>
              <Calendar size={9} />
              {formatDate(todo.deadline)}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
