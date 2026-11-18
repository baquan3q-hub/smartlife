// File: api/_lib/aiModels.js
// Chọn model + cấu hình "suy nghĩ" theo tầng tốc độ. Client chỉ gửi `tier`, KHÔNG gửi tên model.
// Đổi model bằng env trên Vercel (AI_MODEL_FAST / AI_MODEL_BALANCED / AI_MODEL_DEEP / AI_MODEL_DEFAULT),
// nhưng hãy chạy `node scripts/ai-probe-models.mjs <model>` trước: danh sách model của Google
// có cả model đã đóng (vd. gemini-2.5-flash-lite trả 404).

export const TIERS = ['fast', 'balanced', 'deep'];

// Số lượt một câu hỏi tiêu tốn theo tầng (trần token/ngày giữ nguyên)
export const TIER_WEIGHT = { fast: 1, balanced: 2, deep: 4 };

// Đã thử ngày 18/11/2026 bằng scripts/ai-probe-models.mjs
// (deep dùng alias "latest" để không gãy khi Google đóng bản preview)
const DEFAULT_TIER_MODELS = {
    fast: 'gemini-3.5-flash',
    balanced: 'gemini-3.8-flash',
    deep: 'gemini-pro-latest',
};
const TIER_ENV = { fast: 'AI_MODEL_FAST', balanced: 'AI_MODEL_BALANCED', deep: 'AI_MODEL_DEEP' };

// Yêu cầu không gửi `tier` (các tính năng cũ: CV, nhật ký, ghi chú…) giữ nguyên model như trước
export const LEGACY_MODEL = 'gemini-2.5-flash';

// Số lượt một yêu cầu tiêu tốn: chỉ lượt gọi đầu của một câu hỏi chat mới tính.
// Không gửi tier (tính năng cũ) = 1 lượt như trước.
export function requestWeight({ tier, purpose = 'chat', isToolCall = false }) {
    if (isToolCall || purpose !== 'chat') return 0;
    return TIER_WEIGHT[tier] || 1;
}

export function normalizeTier(tier) {
    return TIERS.includes(tier) ? tier : null;
}

export function modelForTier(tier) {
    if (!tier) return process.env.AI_MODEL_DEFAULT || LEGACY_MODEL;
    return process.env[TIER_ENV[tier]] || DEFAULT_TIER_MODELS[tier];
}

// Họ 2.x cấu hình bằng thinkingBudget, họ 3.x trở lên bằng thinkingLevel
export function usesThinkingBudget(model) {
    return /^gemini-2\./.test(model);
}

// Model "pro" không tắt hẳn suy nghĩ được; vài model không nhận mức "minimal"
function isProModel(model) {
    return /pro/.test(model);
}
function supportsMinimal(model) {
    return /flash-lite|^gemini-3\.5-flash$/.test(model);
}

const BUDGETS = { fast: 0, balanced: 2048, deep: 8192 };
const LEVELS = { fast: 'minimal', balanced: 'medium', deep: 'high' };

export function thinkingConfigFor(model, tier) {
    const includeThoughts = tier !== 'fast';
    if (usesThinkingBudget(model)) {
        let budget = BUDGETS[tier];
        if (budget === 0 && isProModel(model)) budget = 128;
        return { thinkingBudget: budget, includeThoughts };
    }
    let level = LEVELS[tier];
    if (level === 'minimal' && !supportsMinimal(model)) level = 'low';
    return { thinkingLevel: level, includeThoughts };
}

// Đổi cấu hình suy nghĩ cho hợp với model đích (vd. bot Telegram gửi thinkingBudget nhưng
// model dự phòng là họ 3.x — họ này từ chối thinkingBudget = 0 với lỗi 400).
export function adaptThinkingConfig(model, thinkingConfig) {
    if (!thinkingConfig) return thinkingConfig;
    const { thinkingBudget, thinkingLevel, ...rest } = thinkingConfig;

    if (usesThinkingBudget(model)) {
        if (thinkingBudget === undefined) {
            if (!thinkingLevel) return rest;
            const fromLevel = { minimal: 0, low: 1024, medium: 4096, high: 8192 }[thinkingLevel] ?? 1024;
            return { ...rest, thinkingBudget: fromLevel === 0 && isProModel(model) ? 128 : fromLevel };
        }
        return { ...rest, thinkingBudget: thinkingBudget === 0 && isProModel(model) ? 128 : thinkingBudget };
    }

    if (thinkingBudget === undefined) return thinkingConfig;
    if (thinkingBudget < 0) return rest; // -1 = để model tự quyết
    let level = thinkingBudget === 0 ? 'minimal' : thinkingBudget <= 1024 ? 'low' : thinkingBudget <= 4096 ? 'medium' : 'high';
    if (level === 'minimal' && !supportsMinimal(model)) level = 'low';
    return { ...rest, thinkingLevel: level };
}

// Trần chữ đầu ra theo tầng (suy nghĩ cũng tính vào đây). Chỉ tính tiền phần thật sự sinh ra.
const MIN_OUTPUT_TOKENS = { fast: 4096, balanced: 8192, deep: 16384 };

// Thời gian chờ Gemini tối đa cho một lần gọi — phải nhỏ hơn maxDuration của function (vercel.json)
export const TIER_TIMEOUT_MS = { fast: 40_000, balanced: 50_000, deep: 55_000 };

// Ghép generationConfig của client với cấu hình do server quyết định
export function buildGenerationConfig(clientConfig, model, tier) {
    const cfg = { ...(clientConfig || {}) };
    if (!usesThinkingBudget(model)) {
        // Gemini 3+: Google khuyên giữ temperature mặc định (1.0), hạ xuống dễ bị lặp chữ
        delete cfg.temperature;
        delete cfg.topP;
        delete cfg.topK;
    }
    if (tier) {
        cfg.thinkingConfig = thinkingConfigFor(model, tier);
        cfg.maxOutputTokens = Math.max(Number(cfg.maxOutputTokens) || 0, MIN_OUTPUT_TOKENS[tier]);
    } else if (cfg.thinkingConfig) {
        // Client cũ gửi thinkingBudget nhưng env có thể đã đổi sang model 3.x
        cfg.thinkingConfig = adaptThinkingConfig(model, cfg.thinkingConfig);
    }
    return cfg;
}
