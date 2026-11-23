// File: src/services/ai/experts/types.ts
// Kiểu chung cho "playbook chuyên gia" — bộ hướng dẫn biến AI thành một chuyên gia theo lĩnh vực.
// File thuần (không import Supabase) để dùng được cả trong app, test và scripts/ai-eval.

export type ExpertId = 'general' | 'planner' | 'psychology' | 'finance' | 'study' | 'relationship' | 'companion';

export const EXPERT_IDS: ExpertId[] = ['general', 'planner', 'psychology', 'finance', 'study', 'relationship', 'companion'];

// Tên icon kính 3D (src/components/icons/glassIcons.ts) — để chuỗi thường cho file này khỏi phụ thuộc UI
export type ExpertIcon = 'ai' | 'goals' | 'journal' | 'finance' | 'gpa' | 'chat' | 'user';

export interface ExpertExample {
    user: string;
    /** Cách trả lời mẫu (tóm tắt hành vi mong muốn, không phải câu trả lời nguyên văn) */
    assistant: string;
}

export interface ExpertProfile {
    id: ExpertId;
    name: string;          // nhãn trên chip
    icon: ExpertIcon;
    tagline: string;       // một dòng mô tả hiện khi rê chuột
    persona: string;       // vai trò + giọng điệu
    methodology: string[]; // phương pháp, khung tư duy
    intakeChecklist: string[]; // thông tin cần có trước khi tư vấn — thiếu cái nào làm câu trả lời đổi nhiều thì hỏi
    rules: string[];       // quy tắc bắt buộc
    outputTemplate: string; // bố cục câu trả lời
    /** Công cụ được dùng; 'all' = mọi công cụ. ask_user luôn được thêm riêng */
    allowedTools: string[] | 'all';
    safety: string[];      // ranh giới an toàn
    examples: ExpertExample[];
    /** Khối kiến thức chuyên ngành nạp kèm (vd. quy chế GPA) */
    knowledge?: string;
}
