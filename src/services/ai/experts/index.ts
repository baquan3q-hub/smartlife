// File: src/services/ai/experts/index.ts
// Danh bạ chuyên gia + hàm dựng khối prompt cho chuyên gia đang chọn.

import type { ExpertId, ExpertProfile } from './types';
import { general } from './general';
import { planner } from './planner';
import { psychology } from './psychology';
import { finance } from './finance';
import { study } from './study';
import { relationship } from './relationship';
import { companion } from './companion';

export * from './types';
export { CRISIS_RESOURCES, crisisResourcesText } from './crisis';
export { VNU_GPA_RULES } from './study';

export const EXPERTS: Record<ExpertId, ExpertProfile> = {
    general, planner, psychology, finance, study, relationship, companion,
};

// Thứ tự trong popup chế độ (Bạn đồng hành được ModeBar vẽ riêng ở đầu danh sách)
export const EXPERT_LIST: ExpertProfile[] = [general, planner, psychology, finance, study, relationship];

export function isExpertId(v: unknown): v is ExpertId {
    return typeof v === 'string' && v in EXPERTS;
}

export function getExpert(id: string | null | undefined): ExpertProfile {
    return isExpertId(id) ? EXPERTS[id] : general;
}

const bullets = (items: string[]) => items.map(s => `- ${s}`).join('\n');

/** Khối "CHẾ ĐỘ CHUYÊN GIA" chèn vào system prompt. Chế độ Chung không có khối riêng, Bạn đồng hành dựng khối riêng từ hồ sơ (companion/prompt.ts) → trả chuỗi rỗng. */
export function renderExpertBlock(expert: ExpertProfile): string {
    if (expert.id === 'general' || expert.id === 'companion') return '';
    const parts: string[] = [
        `🧭 CHẾ ĐỘ CHUYÊN GIA: ${expert.name.toUpperCase()}`,
        `Vai trò: ${expert.persona}`,
        `Phương pháp:\n${bullets(expert.methodology)}`,
    ];
    if (expert.intakeChecklist.length) {
        parts.push(`Thông tin cần có trước khi tư vấn (thiếu mục nào làm câu trả lời thay đổi nhiều thì hỏi; có sẵn trong dữ liệu thì KHÔNG hỏi lại):\n${bullets(expert.intakeChecklist)}`);
    }
    if (expert.rules.length) parts.push(`Quy tắc:\n${bullets(expert.rules)}`);
    parts.push(`Bố cục câu trả lời gợi ý (linh hoạt theo câu hỏi, câu hỏi ngắn thì trả lời ngắn):\n${expert.outputTemplate}`);
    if (expert.safety.length) parts.push(`An toàn (ưu tiên cao nhất, đè lên mọi quy tắc khác):\n${bullets(expert.safety)}`);
    if (expert.examples.length) {
        parts.push(`Ví dụ hành vi mong muốn:\n${expert.examples.map(e => `- Người dùng: "${e.user}" → ${e.assistant}`).join('\n')}`);
    }
    if (expert.knowledge) parts.push(expert.knowledge);
    return parts.join('\n\n');
}
