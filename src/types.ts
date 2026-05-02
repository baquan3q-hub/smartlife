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

// GPA Enums
export enum GPATemplateType {
  A = 'A',  // CC1 (10%) + CC2 (30%) + Cuối kỳ (60%)
  B = 'B',  // CC1 (10%) + CC2 (10%) + CC3 (20%) + Cuối kỳ (60%)
  C = 'C',  // CC1 (20%) + CC2 (20%) + Cuối kỳ (60%)
}

export enum SemesterType {
  HK1 = 'HK1',
  HK2 = 'HK2',
  HOC_HE = 'HocHe',
}

// GPA Interfaces
export interface GPAScores {
  cc1?: number | null;
  cc2?: number | null;
  cc3?: number | null;
  final?: number | null;
}

export interface GPAComputed {
  score10: number | null;     // Điểm học phần /10 (làm tròn 1 TP)
  letterGrade: string | null; // Điểm chữ: A+, A, B+, B, C+, C, D+, D, F
  grade4: number | null;      // Thang 4: 4.0, 3.7, 3.5, 3.0, ...
  passed: boolean;            // Đạt hay không (>= D)
}

export interface GPACourse {
  id: string;
  user_id?: string;
  semester_id: string;
  name: string;
  credits: number;                // 1–10 tín chỉ
  template: GPATemplateType;      // A, B, hoặc C
  score_cc1?: number | null;
  score_cc2?: number | null;
  score_cc3?: number | null;
  score_final?: number | null;
  exclude_from_gpa: boolean;      // Không tính GPA (GDTC, GDQP-AN...)
  is_conditional: boolean;        // Học phần điều kiện
  retake_of?: string | null;      // ID môn học lại
  created_at?: string;
  // Client-side computed (không lưu DB)
  computed?: GPAComputed;
}

export interface GPASemesterSummary {
  semester_gpa: number | null;        // GPA học kỳ (kể cả F)
  cumulative_gpa: number | null;      // GPA tích lũy (chỉ môn đạt)
  credits_registered: number;         // Tín chỉ đăng ký
  credits_passed: number;             // Tín chỉ đạt
  credits_gpa: number;                // Tín chỉ tính GPA
  academic_standing: string | null;   // Xếp loại học lực
}

export interface GPASemester {
  id: string;
  user_id?: string;
  name: string;                       // "Học kỳ 1"
  academic_year: string;              // "2024-2025"
  semester_type: SemesterType;        // HK1, HK2, HocHe
  year_of_study: number;              // Năm thứ mấy (1-6)
  is_current: boolean;
  courses: GPACourse[];               // Danh sách môn học
  summary?: GPASemesterSummary;       // Client-side computed
  created_at?: string;
}

export interface GPACumulativeData {
  gpa: number | null;
  credits_accumulated: number;
  total_credits_required: number;
  academic_standing: string | null;
  graduation_projection: string | null;
  warning_level: 'safe' | 'early_warning' | 'warning' | 'danger' | null;
}

export interface GPAProjection {
  targetGPA: number;
  currentGPA: number | null;
  currentCredits: number;
  remainingCredits: number;
  remainingSemesters: number;
  requiredGPAPerSemester: number | null; // GPA mỗi kỳ phải đạt
  requiredMinGrade: string | null;       // Điểm chữ tối thiểu (A, B+, ...)
  isFeasible: boolean;                   // Có khả thi không?
  feasibilityNote: string;               // Ghi chú khả thi
  alreadyAchieved: boolean;              // Đã đạt rồi?
  progressPercent: number;               // % tiến độ hướng tới mục tiêu
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
  created_at?: string;
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
  deadline?: string;
}

// Interface cho Ngân sách (Budget)
export interface BudgetConfig {
  id: string;
  user_id?: string;
  category: string;
  amount: number;
  month: string; // Format 'YYYY-MM'
  created_at?: string;
}

// 3. State tổng của App
export interface AppState {
  transactions: Transaction[];
  budget: BudgetSummary; // Keep for legacy or summary view
  budgets: BudgetConfig[]; // New detailed category budgets
  timetable: TimetableEvent[]; // Dùng chung Task cho timetable
  todos: Todo[];
  goals: Goal[];
  currentBalance: number;
  profile: Profile | null;
  // GPA Module
  gpaSemesters: GPASemester[];
  gpaTargetCredits: number;
  gpaTargetGPA: number | null;       // GPA mục tiêu tốt nghiệp
  gpaTargetSemesters: number;        // Số kỳ còn lại dự kiến
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
  custom_categories?: { expense: string[]; income: string[] };
  plan?: string;
  pro_expiry_date?: string;
  trial_started_at?: string;
  last_active_at?: string;
  workplace?: string; // Tên công ty hoặc trường học
  updated_at?: string;
}

// Interface cho Smart Backend
export interface BehaviorLog {
  id: string;
  user_id: string;
  action_type: 'FOCUS_SESSION' | 'EARLY_WAKEUP' | 'IMPULSE_BUY' | 'TASK_COMPLETION' | 'STRESS_SPIKE';
  value?: number;
  context?: Record<string, any>;
  created_at?: string;
}

export interface DailySnapshot {
  id: string;
  user_id: string;
  date: string;
  total_spent: number;
  total_focus_minutes: number;
  mood_score?: number;
  energy_level?: number;
  compliance_score?: number;
}

export interface SmartInsight {
  id: string;
  user_id: string;
  type: 'FINANCE_WARNING' | 'HABIT_KUDOS' | 'SCHEDULE_OPTIMIZATION' | 'NUDGE';
  message: string;
  action_link?: string;
  is_read: boolean;
  created_at?: string;
}

// 6. Subscription & Pro Plan
export type SubscriptionPlanDuration = '1_month' | '3_months' | '6_months' | 'lifetime';

export interface SubscriptionPlan {
  id: SubscriptionPlanDuration;
  label: string;
  price: number;
  duration_days: number | null; // null = lifetime
  monthly_price: number;
  save_percent: number;
  is_popular?: boolean;
}

export interface SubscriptionOrder {
  id: string;
  user_id: string;
  plan_type: SubscriptionPlanDuration;
  amount: number;
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'failed';
  transfer_content: string;
  invoice_expires_at: string;
  confirmed_at?: string;
  confirmed_by?: string;
  created_at: string;
}

// 7. My Storage
export interface StorageItem {
  id: string;
  user_id?: string;
  type: 'note' | 'link' | 'file' | 'image' | 'audio' | 'video';
  title: string;
  content?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  metadata?: Record<string, any>;
  is_pinned?: boolean;
  created_at?: string;
  updated_at?: string;
}

// 8. My Spotify — Personal Music Library
export interface MyPlaylist {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  cover_color?: string;
  is_favorite?: boolean;
  track_count?: number;
  total_duration?: number;
  created_at?: string;
  updated_at?: string;
}

export interface MyTrack {
  id: string;
  user_id?: string;
  playlist_id: string;
  title: string;
  artist?: string;
  duration?: number;       // seconds
  file_url: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  sort_order?: number;
  created_at?: string;
}