import React, { useState, useEffect } from 'react';
import { 
  DndContext, 
  DragEndEvent, 
  DragOverEvent, 
  DragStartEvent, 
  useSensor, 
  useSensors, 
  PointerSensor, 
  DragOverlay, 
  useDroppable 
} from '@dnd-kit/core';
import { 
  SortableContext, 
  verticalListSortingStrategy, 
  useSortable 
} from '@dnd-kit/sortable';
import { Todo, TodoStatus } from '../../types';
import { Plus, Trash2, Calendar, CheckSquare } from 'lucide-react';

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

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  todos,
  onMoveTodoStatus,
  onReorderTodos,
  onEditTodo,
  onDeleteTodo,
  onQuickAddTodo,
}) => {
  const [localTodos, setLocalTodos] = useState<Todo[]>(todos);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeWidth, setActiveWidth] = useState<number | null>(null);

  // Synchronize local todos when props change, but not during dragging
  useEffect(() => {
    if (!activeId) {
      setLocalTodos(todos);
    }
  }, [todos, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Drag starts only after moving 8px, preserving normal clicks
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    const element = document.getElementById(event.active.id as string);
    if (element) {
      setActiveWidth(element.getBoundingClientRect().width);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    // Check if the over target is a column (droppable container)
    const isOverAColumn = COLUMNS.some((col) => col.id === overId);

    setLocalTodos((prevTodos) => {
      const activeTask = prevTodos.find((t) => t.id === activeId);
      if (!activeTask) return prevTodos;

      const activeStatus = activeTask.status || (activeTask.is_completed ? 'done' : 'todo');

      if (isOverAColumn) {
        const destStatus = overId as TodoStatus;
        if (activeStatus === destStatus) return prevTodos;

        // Move active task to the destination column
        return prevTodos.map((t) => {
          if (t.id === activeId) {
            return {
              ...t,
              status: destStatus,
              is_completed: destStatus === 'done',
            };
          }
          return t;
        });
      } else {
        // Over target is a card
        const overTask = prevTodos.find((t) => t.id === overId);
        if (!overTask) return prevTodos;

        const overStatus = overTask.status || (overTask.is_completed ? 'done' : 'todo');

        if (activeStatus !== overStatus) {
          // Move task to the new column and insert near the over card
          const updatedTodos = prevTodos.map((t) => {
            if (t.id === activeId) {
              return {
                ...t,
                status: overStatus,
                is_completed: overStatus === 'done',
              };
            }
            return t;
          });

          const activeIndex = updatedTodos.findIndex((t) => t.id === activeId);
          const overIndex = updatedTodos.findIndex((t) => t.id === overId);

          const result = [...updatedTodos];
          const [removed] = result.splice(activeIndex, 1);
          result.splice(overIndex, 0, removed);
          return result;
        } else {
          // Same column reordering
          const activeIndex = prevTodos.findIndex((t) => t.id === activeId);
          const overIndex = prevTodos.findIndex((t) => t.id === overId);

          if (activeIndex !== overIndex) {
            const result = [...prevTodos];
            const [removed] = result.splice(activeIndex, 1);
            result.splice(overIndex, 0, removed);
            return result;
          }
          return prevTodos;
        }
      }
    });
  };

  const handleDragEnd = () => {
    setActiveId(null);
    setActiveWidth(null);
    onReorderTodos(localTodos);
  };

  return (
    <DndContext 
      sensors={sensors} 
      onDragStart={handleDragStart} 
      onDragOver={handleDragOver} 
      onDragEnd={handleDragEnd}
    >
      <div className="w-full">
        {/* Board Columns Horizontal Container with Uniform Gaps */}
        <div className="flex flex-col md:flex-row gap-2.5 overflow-x-auto pb-4 scrollbar-thin items-stretch w-full select-none">
          {COLUMNS.map((col) => {
            const colTodos = localTodos.filter((t) => {
              // Backward compatibility for old completed todos
              if (col.id === 'done') return t.status === 'done' || t.is_completed;
              if (col.id === 'todo') return t.status === 'todo' || (!t.status && !t.is_completed);
              return t.status === col.id;
            });

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
        {activeId ? (
          <DragOverlayCard
            todo={localTodos.find((t) => t.id === activeId)!}
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
      className="group relative flex flex-col gap-2 p-2.5 rounded-[18px] bg-white border border-slate-100 cursor-grab active:cursor-grabbing select-none hover:border-slate-300 transition-all shadow-sm"
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

      {/* Footer Info (Deadline, Checklist) */}
      {(todo.deadline || totalSubtasks > 0) && (
        <div className="flex items-center gap-2 mt-1 flex-wrap select-none">
          {todo.deadline && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1 border ${
              isOverdue(todo.deadline)
                ? 'text-rose-600 border-rose-100 bg-rose-50/50'
                : 'text-slate-500 border-slate-100 bg-slate-50'
            }`}>
              <Calendar size={9} />
              {formatDate(todo.deadline)}
            </span>
          )}

          {totalSubtasks > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md border text-slate-500 border-slate-100 bg-slate-50 font-bold flex items-center gap-1">
              <CheckSquare size={9} />
              {completedSubtasks}/{totalSubtasks}
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

      {/* Footer Info (Deadline, Checklist) */}
      {(todo.deadline || totalSubtasks > 0) && (
        <div className="flex items-center gap-2 mt-1 flex-wrap select-none">
          {todo.deadline && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1 border ${
              isOverdue(todo.deadline)
                ? 'text-rose-600 border-rose-100 bg-rose-50/50'
                : 'text-slate-500 border-slate-100 bg-slate-50'
            }`}>
              <Calendar size={9} />
              {formatDate(todo.deadline)}
            </span>
          )}

          {totalSubtasks > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md border text-slate-500 border-slate-100 bg-slate-50 font-bold flex items-center gap-1">
              <CheckSquare size={9} />
              {completedSubtasks}/{totalSubtasks}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
