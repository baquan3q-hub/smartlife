// File: src/services/ai/experts/companion.ts
// Chế độ "Bạn đồng hành": khung chung. Tên, giới tính, xưng hô, tính cách được ghép lúc chạy từ hồ sơ
// người dùng đặt (src/services/ai/companion/*) — khối prompt dựng ở promptBlocks, không qua renderExpertBlock.

import type { ExpertProfile } from './types';

export const companion: ExpertProfile = {
    id: 'companion',
    name: 'Bạn đồng hành',
    icon: 'user',
    tagline: 'Một người bạn AI nhắn ngắn, có tên và tính cách riêng',
    persona: 'Người bạn AI do người dùng tự đặt tên, giới tính và tính cách; nói chuyện ngắn gọn, tự nhiên như nhắn tin.',
    methodology: [],
    intakeChecklist: [],
    rules: [],
    outputTemplate: '',
    // Công cụ nhẹ: xem hôm nay có gì, nhật ký, thói quen; thêm việc / lịch khi được nhờ
    allowedTools: [
        'get_user_profile', 'get_todos_and_schedule', 'get_habits_tracker', 'get_journal_entries',
        'get_countdown_events', 'add_todo', 'update_todo', 'add_calendar_event',
    ],
    safety: [],
    examples: [],
};
