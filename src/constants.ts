// File: src/constants.ts
import { Transaction, Task, TaskPriority, ScheduleType, Goal, BudgetSummary } from './types';

// Danh mục Chi tiêu
export const EXPENSE_CATEGORIES = [
  'Ăn uống', 'Di chuyển', 'Nhà cửa', 'Điện nước', 'Mua sắm',
  'Giải trí', 'Sức khỏe', 'Giáo dục', 'Đầu tư', 'Trả nợ',
  'Cho vay', 'Hiếu hỉ', 'Dating', 'Du lịch', 'Khác'
];

// Danh mục Thu nhập
export const INCOME_CATEGORIES = [
  'Lương', 'Thưởng', 'Bán hàng', 'Đầu tư', 'Được tặng', 'Khác'
];

// Dữ liệu mẫu (Initial Data)
export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const INITIAL_BUDGET: BudgetSummary = {
  totalBudget: 0,
  currency: 'VND',
  month: new Date().toISOString().slice(0, 7) // Tự động lấy tháng hiện tại (VD: 2024-01)
};

// Dữ liệu mẫu cho Lịch trình (Fix lỗi Enum)
export const INITIAL_SCHEDULE: Task[] = [
  { id: '1', title: 'Họp Team Marketing', startTime: '08:30', endTime: '10:00', type: ScheduleType.FIXED, priority: TaskPriority.URGENT, isCompleted: false },
  { id: '2', title: 'Ăn trưa với đối tác', startTime: '12:00', endTime: '13:30', type: ScheduleType.FIXED, priority: TaskPriority.FOCUS, isCompleted: false },
  { id: '3', title: 'Học từ vựng tiếng Anh', startTime: '20:00', endTime: '20:45', type: ScheduleType.FLEXIBLE, priority: TaskPriority.URGENT, isCompleted: false },
];

export const INITIAL_GOALS: Goal[] = [
  { id: '1', title: 'Tiết kiệm 100 triệu', deadline: '2025-12-31', type: 'MEDIUM_TERM', progress: 45 },
  { id: '2', title: 'IELTS 7.0', deadline: '2026-06-01', type: 'LONG_TERM', progress: 30 },
];

// ────────────────────────────────────────
// GPA Constants — Quy chế ĐHQGHN 2022
// ────────────────────────────────────────

/**
 * Bảng quy đổi điểm chuẩn: Thang 10 → Điểm chữ → Thang 4
 * Thứ tự từ cao → thấp (dùng cho tra bảng)
 */
export const GRADE_SCALE = [
  { min: 9.0, max: 10.0, letter: 'A+', grade4: 4.0, standing: 'Xuất sắc' },
  { min: 8.5, max: 8.9,  letter: 'A',  grade4: 3.7, standing: 'Xuất sắc' },
  { min: 8.0, max: 8.4,  letter: 'B+', grade4: 3.5, standing: 'Giỏi' },
  { min: 7.0, max: 7.9,  letter: 'B',  grade4: 3.0, standing: 'Giỏi' },
  { min: 6.5, max: 6.9,  letter: 'C+', grade4: 2.5, standing: 'Khá' },
  { min: 5.5, max: 6.4,  letter: 'C',  grade4: 2.0, standing: 'Khá' },
  { min: 5.0, max: 5.4,  letter: 'D+', grade4: 1.5, standing: 'Trung bình' },
  { min: 4.0, max: 4.9,  letter: 'D',  grade4: 1.0, standing: 'Trung bình' },
  { min: 0.0, max: 3.9,  letter: 'F',  grade4: 0.0, standing: 'Yếu' },
] as const;

/**
 * Trọng số điểm thành phần cho 3 template
 */
export const TEMPLATE_WEIGHTS: Record<string, { cc1: number; cc2: number; cc3?: number; final: number }> = {
  A: { cc1: 0.10, cc2: 0.30, final: 0.60 },            // CC1 (10%) + CC2 (30%) + Cuối kỳ (60%)
  B: { cc1: 0.10, cc2: 0.10, cc3: 0.20, final: 0.60 }, // CC1 (10%) + CC2 (10%) + CC3 (20%) + Cuối kỳ (60%)
  C: { cc1: 0.20, cc2: 0.20, final: 0.60 },            // CC1 (20%) + CC2 (20%) + Cuối kỳ (60%)
};

/**
 * Tên hiển thị cho từng template
 */
export const TEMPLATE_LABELS: Record<string, string> = {
  A: 'CC1 (10%) + CC2 (30%) + Cuối kỳ (60%)',
  B: 'CC1 (10%) + CC2 (10%) + CC3 (20%) + Cuối kỳ (60%)',
  C: 'CC1 (20%) + CC2 (20%) + Cuối kỳ (60%)',
};

/**
 * Ngưỡng cảnh báo học vụ theo năm học
 */
export const WARNING_THRESHOLDS = [
  { year: 1, cumulative: 1.20, semester: 0.80 },
  { year: 2, cumulative: 1.40, semester: 1.00 },
  { year: 3, cumulative: 1.60, semester: 1.00 },
  { year: 4, cumulative: 1.80, semester: 1.00 }, // 4+ dùng chung ngưỡng này
] as const;

/**
 * Hạng tốt nghiệp theo GPA tích lũy
 */
export const GRADUATION_HONORS = [
  { min: 3.60, max: 4.00, label: 'Xuất sắc' },
  { min: 3.20, max: 3.59, label: 'Giỏi' },
  { min: 2.50, max: 3.19, label: 'Khá' },
  { min: 2.00, max: 2.49, label: 'Trung bình' },
] as const;

/**
 * Danh sách học phần thường không tính GPA
 */
export const NON_GPA_COURSES = [
  'Giáo dục quốc phòng - An ninh',
  'Giáo dục thể chất',
  'Kỹ năng bổ trợ',
] as const;

/**
 * Semester type labels
 */
export const SEMESTER_TYPE_LABELS: Record<string, string> = {
  HK1: 'Học kỳ 1',
  HK2: 'Học kỳ 2',
  HocHe: 'Học hè',
};

// Template nhắc lệnh cho AI
export const SYSTEM_INSTRUCTION_TEMPLATE = `
Role: Bạn là "SmartLife Assistant" - Một trợ lý ảo AI chuyên nghiệp về tài chính cá nhân và hiệu suất.
Tone & Style: Chuyên nghiệp, ngắn gọn, đi thẳng vào vấn đề. Luôn dùng tiếng Việt.

---
### DỮ LIỆU HIỆN TẠI
**1. Tài chính (Finance):**
{{FINANCE_DATA}}

**2. Lịch trình & Mục tiêu (Tasks & Goals):**
{{TASK_DATA}}

---
### NHIỆM VỤ
1. **Phân tích tài chính:**
   - So sánh chi tiêu các tháng.
   - Chỉ ra hạng mục tốn kém nhất.
   - Đưa ra giải pháp cắt giảm.
   
2. **Quản lý thời gian:**
   - Sắp xếp lịch trình logic.
   - Cảnh báo xung đột.
`;