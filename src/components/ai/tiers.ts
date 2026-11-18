// File: src/components/ai/tiers.ts
// Ba chế độ tốc độ trả lời — hệ số lượt phải khớp TIER_WEIGHT ở api/_lib/aiModels.js

import type { AITier } from '../../services/geminiService';

export interface TierOption {
    id: AITier;
    label: string;
    weight: number;
    hint: string;
}

export const TIER_OPTIONS: TierOption[] = [
    { id: 'fast', label: 'Nhanh', weight: 1, hint: 'Trả lời ngay — hợp câu hỏi ngắn, tra cứu, thêm việc' },
    { id: 'balanced', label: 'Nghĩ vừa', weight: 2, hint: 'Suy nghĩ trước khi trả lời — hợp phân tích, so sánh' },
    { id: 'deep', label: 'Nghĩ sâu', weight: 4, hint: 'Suy luận kỹ nhất — hợp lập kế hoạch, bài toán khó' },
];

export const tierLabel = (tier?: string) => TIER_OPTIONS.find(t => t.id === tier)?.label;

const STORAGE_KEY = 'smartlife.ai.tier';

export function loadTier(): AITier {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && TIER_OPTIONS.some(t => t.id === saved)) return saved as AITier;
    } catch { /* chế độ riêng tư chặn localStorage */ }
    return 'fast';
}

export function saveTier(tier: AITier) {
    try { localStorage.setItem(STORAGE_KEY, tier); } catch { /* bỏ qua */ }
}
