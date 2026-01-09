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