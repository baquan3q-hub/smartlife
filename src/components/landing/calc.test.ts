import { describe, expect, it } from 'vitest';
import { evalMoney, formatVnd } from './calc';

describe('evalMoney', () => {
    it('reads k and tr suffixes', () => {
        expect(evalMoney('50k + 1.5tr')).toBe(1_550_000);
        expect(evalMoney('2tr - 350k')).toBe(1_650_000);
        expect(evalMoney('1,5tr')).toBe(1_500_000);
    });

    it('applies × and ÷ before + and −', () => {
        expect(evalMoney('100k x 4')).toBe(400_000);
        expect(evalMoney('100k * 4 + 50k')).toBe(450_000);
        expect(evalMoney('1tr ÷ 4')).toBe(250_000);
        expect(evalMoney('(50k + 50k) * 3')).toBe(300_000);
    });

    it('treats dotted groups as thousand separators', () => {
        expect(evalMoney('1.550.000 + 50.000đ')).toBe(1_600_000);
    });

    it('returns null for input it cannot read', () => {
        expect(evalMoney('')).toBeNull();
        expect(evalMoney('abc')).toBeNull();
        expect(evalMoney('50k +')).toBeNull();
        expect(evalMoney('1tr / 0')).toBeNull();
        expect(evalMoney('(50k')).toBeNull();
    });
});

describe('formatVnd', () => {
    it('groups with dots and adds the đồng sign', () => {
        expect(formatVnd(1_550_000)).toBe('1.550.000 ₫');
    });
});
