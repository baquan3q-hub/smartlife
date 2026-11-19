import { describe, it, expect, afterEach } from 'vitest';
import {
    requestWeight,
    normalizeTier,
    modelForTier,
    thinkingConfigFor,
    adaptThinkingConfig,
    buildGenerationConfig,
    LEGACY_MODEL,
} from './aiModels.js';

describe('requestWeight', () => {
    it('tính lượt theo hệ số Nhanh 1 / Nghĩ vừa 2 / Nghĩ sâu 4', () => {
        expect(requestWeight({ tier: 'fast' })).toBe(1);
        expect(requestWeight({ tier: 'balanced' })).toBe(2);
        expect(requestWeight({ tier: 'deep' })).toBe(4);
    });

    it('tầng Siêu nhanh (lite) vẫn 1 lượt — tiết kiệm phía chi phí model, không trừ thêm lượt', () => {
        expect(requestWeight({ tier: 'lite' })).toBe(1);
        expect(requestWeight({ tier: 'lite', purpose: 'router' })).toBe(0);
        expect(normalizeTier('lite')).toBe('lite');
    });

    it('tính năng cũ không gửi tier vẫn là 1 lượt', () => {
        expect(requestWeight({ tier: null })).toBe(1);
    });

    it('lần gọi con và lệnh nội bộ không tính lượt', () => {
        expect(requestWeight({ tier: 'deep', isToolCall: true })).toBe(0);
        expect(requestWeight({ tier: 'fast', purpose: 'memory' })).toBe(0);
        expect(requestWeight({ tier: null, purpose: 'router' })).toBe(0);
        expect(requestWeight({ tier: 'fast', purpose: 'greeting' })).toBe(0);
    });
});

describe('modelForTier', () => {
    const saved = { ...process.env };
    afterEach(() => {
        process.env = { ...saved };
    });

    it('lite dùng flash-lite, đổi được bằng AI_MODEL_LITE; không suy nghĩ', () => {
        delete process.env.AI_MODEL_LITE;
        expect(modelForTier('lite')).toBe('gemini-3.5-flash-lite');
        expect(thinkingConfigFor('gemini-3.5-flash-lite', 'lite')).toEqual({ thinkingLevel: 'minimal', includeThoughts: false });
        process.env.AI_MODEL_LITE = 'gemini-flash-lite-latest';
        expect(modelForTier('lite')).toBe('gemini-flash-lite-latest');
        expect(buildGenerationConfig({ maxOutputTokens: 200 }, 'gemini-flash-lite-latest', 'lite').maxOutputTokens).toBe(2048);
    });

    it('không có tier → giữ model cũ', () => {
        delete process.env.AI_MODEL_DEFAULT;
        expect(modelForTier(null)).toBe(LEGACY_MODEL);
    });

    it('env ghi đè model của từng tầng', () => {
        process.env.AI_MODEL_DEEP = 'gemini-test-deep';
        expect(modelForTier('deep')).toBe('gemini-test-deep');
    });

    it('chỉ nhận 3 tầng hợp lệ', () => {
        expect(normalizeTier('deep')).toBe('deep');
        expect(normalizeTier('gemini-pro-latest')).toBeNull();
        expect(normalizeTier(undefined)).toBeNull();
    });
});

describe('thinkingConfigFor', () => {
    it('họ 2.5 dùng thinkingBudget, tầng nhanh tắt suy nghĩ', () => {
        expect(thinkingConfigFor('gemini-2.5-flash', 'fast')).toEqual({ thinkingBudget: 0, includeThoughts: false });
        expect(thinkingConfigFor('gemini-2.5-flash', 'deep')).toEqual({ thinkingBudget: 8192, includeThoughts: true });
    });

    it('model pro 2.5 không tắt hẳn suy nghĩ được', () => {
        expect(thinkingConfigFor('gemini-2.5-pro', 'fast').thinkingBudget).toBe(128);
    });

    it('họ 3.x dùng thinkingLevel, model không có "minimal" thì hạ xuống "low"', () => {
        expect(thinkingConfigFor('gemini-3.5-flash', 'fast')).toEqual({ thinkingLevel: 'minimal', includeThoughts: false });
        expect(thinkingConfigFor('gemini-3.8-flash', 'fast').thinkingLevel).toBe('low');
        expect(thinkingConfigFor('gemini-pro-latest', 'fast').thinkingLevel).toBe('low');
        expect(thinkingConfigFor('gemini-3.8-flash', 'balanced')).toEqual({ thinkingLevel: 'medium', includeThoughts: true });
    });
});

describe('adaptThinkingConfig', () => {
    it('đổi thinkingBudget 0 sang thinkingLevel cho họ 3.x (tránh lỗi 400)', () => {
        expect(adaptThinkingConfig('gemini-flash-lite-latest', { thinkingBudget: 0 })).toEqual({ thinkingLevel: 'minimal' });
        expect(adaptThinkingConfig('gemini-3.8-flash', { thinkingBudget: 0 })).toEqual({ thinkingLevel: 'low' });
        expect(adaptThinkingConfig('gemini-3.8-flash', { thinkingBudget: 1024 })).toEqual({ thinkingLevel: 'low' });
        expect(adaptThinkingConfig('gemini-3.8-flash', { thinkingBudget: 8192, includeThoughts: true }))
            .toEqual({ thinkingLevel: 'high', includeThoughts: true });
    });

    it('giữ nguyên budget cho họ 2.5', () => {
        expect(adaptThinkingConfig('gemini-2.5-flash', { thinkingBudget: 0 })).toEqual({ thinkingBudget: 0 });
    });
});

describe('buildGenerationConfig', () => {
    it('server tự gắn thinkingConfig + trần chữ theo tầng, bỏ temperature với họ 3.x', () => {
        const cfg = buildGenerationConfig(
            { temperature: 0.7, topK: 40, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 99999 } },
            'gemini-pro-latest',
            'deep',
        );
        expect(cfg.temperature).toBeUndefined();
        expect(cfg.topK).toBeUndefined();
        expect(cfg.thinkingConfig).toEqual({ thinkingLevel: 'high', includeThoughts: true });
        expect(cfg.maxOutputTokens).toBe(16384);
    });

    it('yêu cầu cũ (không tier) với model 2.5 giữ nguyên cấu hình', () => {
        const input = { temperature: 0.2, responseMimeType: 'application/json' };
        expect(buildGenerationConfig(input, 'gemini-2.5-flash', null)).toEqual(input);
    });
});
