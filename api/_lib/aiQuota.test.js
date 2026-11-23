import { describe, it, expect } from 'vitest';
import { evaluateQuota, determineActualPlan, QUOTA_LIMITS } from './aiQuota.js';

const pro = QUOTA_LIMITS.pro;
const usage = (requestsToday, tokensToday = 0, tokensMonth = 0) => ({ requestsToday, tokensToday, tokensMonth });

describe('evaluateQuota', () => {
    it('còn đủ lượt thì cho qua', () => {
        expect(evaluateQuota({ limits: pro, usage: usage(6), weight: 4, tier: 'deep' })).toBeNull();
    });

    it('Nghĩ sâu cần 4 lượt nhưng chỉ còn 3 → gợi ý chế độ rẻ hơn', () => {
        const v = evaluateQuota({ limits: pro, usage: usage(7), weight: 4, tier: 'deep' });
        expect(v.status).toBe(429);
        expect(v.body.type).toBe('tier_requests_exceeded');
        expect(v.body.remaining).toBe(3);
        expect(v.body.message).toContain('Nghĩ vừa hoặc Nhanh');
    });

    it('còn 1 lượt thì chỉ gợi ý Nhanh', () => {
        const v = evaluateQuota({ limits: pro, usage: usage(9), weight: 2, tier: 'balanced' });
        expect(v.body.message).toContain('chuyển sang Nhanh');
        expect(v.body.message).not.toContain('Nghĩ vừa hoặc');
    });

    it('hết sạch lượt → thông báo hết lượt trong ngày như cũ', () => {
        const v = evaluateQuota({ limits: pro, usage: usage(10), weight: 1, tier: 'fast' });
        expect(v.body.type).toBe('daily_requests_exceeded');
    });

    it('lần gọi con (weight 0) không bị chặn vì lượt, chỉ vì token', () => {
        expect(evaluateQuota({ limits: pro, usage: usage(10), weight: 0, tier: 'deep' })).toBeNull();
        const v = evaluateQuota({ limits: pro, usage: usage(10, 50000), weight: 0, tier: 'deep' });
        expect(v.body.type).toBe('daily_tokens_exceeded');
    });

    it('hết token tháng', () => {
        const v = evaluateQuota({ limits: pro, usage: usage(0, 0, 600000), weight: 1, tier: null });
        expect(v.body.type).toBe('monthly_tokens_exceeded');
    });

    it('gói trial không giới hạn token tháng', () => {
        expect(evaluateQuota({ limits: QUOTA_LIMITS.trial, usage: usage(0, 0, 10_000_000), weight: 1, tier: null })).toBeNull();
    });
});

describe('determineActualPlan', () => {
    const now = new Date('2026-11-18T00:00:00Z');

    it('chủ app luôn là lifetime', () => {
        expect(determineActualPlan(null, 'baquan3q@gmail.com', now)).toBe('lifetime');
    });

    it('trial còn trong 7 ngày + 3 ngày gia hạn', () => {
        expect(determineActualPlan({ plan: 'trial', trial_started_at: '2026-11-09T00:00:00Z' }, 'a@b.c', now)).toBe('trial');
        expect(determineActualPlan({ plan: 'trial', trial_started_at: '2026-11-07T00:00:00Z' }, 'a@b.c', now)).toBe('free');
    });

    it('pro hết hạn quá 3 ngày → free', () => {
        expect(determineActualPlan({ plan: 'pro', pro_expiry_date: '2026-11-16T00:00:00Z' }, 'a@b.c', now)).toBe('pro');
        expect(determineActualPlan({ plan: 'pro', pro_expiry_date: '2026-11-10T00:00:00Z' }, 'a@b.c', now)).toBe('free');
    });
});
