// Tiny money expression evaluator for the landing demo: "50k + 1.5tr", "2tr - 350k", "100k x 4".
// k = thousand, tr (or m) = million. Dots in "1.550.000" are thousand separators; "1.5" or "1,5" is a decimal.
// Returns null for anything it cannot read, so the demo never shows a made-up number.

const MULT: Record<string, number> = { k: 1e3, tr: 1e6, m: 1e6 };

export const evalMoney = (input: string): number | null => {
    const src = input.toLowerCase().replace(/\s+/g, '').replace(/₫|đ|vnd/g, '');
    if (!src) return null;
    let i = 0;

    const number = (): number | null => {
        const m = /^(\d+(?:[.,]\d+)*)(tr|k|m)?/.exec(src.slice(i));
        if (!m) return null;
        i += m[0].length;
        const raw = m[1];
        const suffix = m[2];
        let n: number;
        if (!suffix && /^\d{1,3}([.,]\d{3})+$/.test(raw)) {
            n = Number(raw.replace(/[.,]/g, ''));
        } else {
            if ((raw.match(/[.,]/g) ?? []).length > 1) return null;
            n = Number(raw.replace(',', '.'));
        }
        return suffix ? n * MULT[suffix] : n;
    };

    const factor = (): number | null => {
        const ch = src[i];
        if (ch === '(') {
            i++;
            const v = expr();
            if (v === null || src[i] !== ')') return null;
            i++;
            return v;
        }
        if (ch === '-') {
            i++;
            const v = factor();
            return v === null ? null : -v;
        }
        return number();
    };

    const term = (): number | null => {
        let v = factor();
        while (v !== null && i < src.length && '*x×/:÷'.includes(src[i])) {
            const op = src[i++];
            const rhs = factor();
            if (rhs === null) return null;
            if ('*x×'.includes(op)) v *= rhs;
            else {
                if (rhs === 0) return null;
                v /= rhs;
            }
        }
        return v;
    };

    function expr(): number | null {
        let v = term();
        while (v !== null && i < src.length && (src[i] === '+' || src[i] === '-')) {
            const op = src[i++];
            const rhs = term();
            if (rhs === null) return null;
            v = op === '+' ? v + rhs : v - rhs;
        }
        return v;
    }

    const result = expr();
    if (result === null || i !== src.length || !Number.isFinite(result)) return null;
    return Math.round(result);
};

export const formatVnd = (n: number) => `${new Intl.NumberFormat('vi-VN').format(n)} ₫`;
