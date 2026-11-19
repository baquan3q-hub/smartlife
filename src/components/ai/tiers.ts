// File: src/components/ai/tiers.ts
// Chế độ tốc độ trả lời — hệ số lượt phải khớp TIER_WEIGHT ở api/_lib/aiModels.js
// "Auto" để bộ định tuyến (services/ai/router.ts) tự chọn tầng cho từng câu hỏi.

import type { AITier } from '../../services/geminiService';
import type { SpeedChoice } from '../../services/ai/router';

export type { SpeedChoice };

export interface TierOption {
    id: AITier;
    label: string;
    weight: number;
    hint: string;
}

export interface SpeedOption {
    id: SpeedChoice;
    label: string;
    /** Hiển thị số lượt: "1–4" cho Auto */
    cost: string;
    hint: string;
}

export const TIER_OPTIONS: TierOption[] = [
    { id: 'fast', label: 'Nhanh', weight: 1, hint: 'Trả lời ngay — hợp câu hỏi ngắn, tra cứu, thêm việc' },
    { id: 'balanced', label: 'Nghĩ vừa', weight: 2, hint: 'Suy nghĩ trước khi trả lời — hợp phân tích, so sánh' },
    { id: 'deep', label: 'Nghĩ sâu', weight: 4, hint: 'Suy luận kỹ nhất — hợp lập kế hoạch, bài toán khó' },
];

export const SPEED_OPTIONS: SpeedOption[] = [
    { id: 'auto', label: 'Auto', cost: '1–4', hint: 'Tự chọn tốc độ theo từng câu hỏi — câu đơn giản trả lời nhanh, câu khó nghĩ kỹ' },
    ...TIER_OPTIONS.map(t => ({ id: t.id, label: t.label, cost: String(t.weight), hint: t.hint })),
];

/** Tầng chỉ Auto dùng (không có trong menu) — vẫn cần nhãn để hiện "Auto → Siêu nhanh" */
const AUTO_ONLY: Partial<Record<AITier, { label: string; weight: number }>> = {
    lite: { label: 'Siêu nhanh', weight: 1 },
};

export const tierLabel = (tier?: string) => TIER_OPTIONS.find(t => t.id === tier)?.label ?? AUTO_ONLY[tier as AITier]?.label;
export const tierWeight = (tier?: string) => TIER_OPTIONS.find(t => t.id === tier)?.weight ?? AUTO_ONLY[tier as AITier]?.weight;

const STORAGE_KEY = 'smartlife.ai.tier';

/** Lần đầu dùng (chưa lưu gì) mặc định Auto; người đã chọn tầng cố định trước đây giữ nguyên lựa chọn */
export function loadSpeed(): SpeedChoice {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && SPEED_OPTIONS.some(t => t.id === saved)) return saved as SpeedChoice;
    } catch { /* chế độ riêng tư chặn localStorage */ }
    return 'auto';
}

export function saveSpeed(speed: SpeedChoice) {
    try { localStorage.setItem(STORAGE_KEY, speed); } catch { /* bỏ qua */ }
}

/** Giữ cho mã cũ: tầng cố định đã lưu (Auto → 'fast') */
export function loadTier(): AITier {
    const s = loadSpeed();
    return s === 'auto' ? 'fast' : s;
}

export function saveTier(tier: AITier) {
    saveSpeed(tier);
}
