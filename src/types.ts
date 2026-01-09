// File: src/types.ts

// 1. Định nghĩa các Enum (Dùng để sửa lỗi ScheduleType.FIXED...)
export enum TaskPriority {
  URGENT = 'urgent',
  FOCUS = 'focus',
  CHILL = 'chill',
  TEMP = 'temp'
}

export enum ScheduleType {
  FIXED = 'Cố định',
  FLEXIBLE = 'Linh hoạt'
}

export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense'
}

// 2. Các Interface cơ bản
export interface Transaction {
  id: string;
  user_id?: string;
  amount: number;
  category: string;
  date: string;
  type: TransactionType;
  description: string;
  created_at?: string;
}

export interface Goal {
  id: string;
  user_id?: string;
  title: string;
  target_amount?: number; // Có thể null nếu chỉ là mục tiêu text
  current_amount?: number;
  deadline: string;
  type?: 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM' | 'FINANCIAL' | 'PERSONAL';
  is_priority?: boolean;
  progress?: number;
}

export interface BudgetSummary {
  totalBudget: number;
  currency: string;
  month: string;
}

// Interface cho Lịch trình (Task/Timetable)
export interface TimetableEvent {
  id: string;
  user_id?: string;
  title: string;
  day_of_week: number;
  start_time: string;
  end_time?: string;
  location?: string;
  created_at?: string;
}

export interface Task {
  id: string;
  title: string;
  startTime?: string;
  endTime?: string;
  type?: ScheduleType;
  priority?: TaskPriority;
  isCompleted: boolean;
  day_of_week?: string; // Dùng cho thời khóa biểu lặp lại
}

// Interface cho Todo (Việc cần làm đơn giản)
export interface Todo {
  id: string;
  content: string;
  is_completed: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'focus' | 'chill' | 'temp';
}

// 3. State tổng của App
export interface AppState {
  transactions: Transaction[];
  budget: BudgetSummary;
  timetable: Task[]; // Dùng chung Task cho timetable
  todos: Todo[];
  goals: Goal[];
  currentBalance: number;
  profile: Profile | null;
}

// 4. Interface cho Chat AI
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'model' | 'system';
  content: string;
  timestamp?: number;
}

// 5. Interface cho Profile User
export interface Profile {
  id: string;
  email?: string;
  full_name?: string;
  age?: number;
  job?: string;
  monthly_salary?: number;
  savings_goal?: number;
  currency?: string;
  avatar_url?: string;
  updated_at?: string;
}