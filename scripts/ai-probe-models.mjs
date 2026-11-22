// Thử nhanh các model Gemini còn mở với key trong .env.local.
// Danh sách model Google trả về KHÔNG đáng tin (có model nằm trong danh sách nhưng gọi trả 404),
// nên trước khi đổi AI_MODEL_FAST / AI_MODEL_BALANCED / AI_MODEL_DEEP hãy chạy:
//   node scripts/ai-probe-models.mjs [model1 model2 ...]
// Script in trạng thái, thời gian, số token suy nghĩ; không in API key.
import { readFileSync } from 'node:fs';

function loadEnvFile(path) {
    try {
        for (const line of readFileSync(path, 'utf-8').split(/\r?\n/)) {
            const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
            if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
        }
    } catch { /* không có file thì thôi */ }
}
loadEnvFile('.env.local');
loadEnvFile('.env');

const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
const keys = rawKeys.split(',').map((k) => k.trim()).filter(Boolean);
if (keys.length === 0) {
    console.error('Thiếu GEMINI_API_KEYS trong .env.local');
    process.exit(1);
}

const DEFAULT_CANDIDATES = [
    'gemini-2.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-pro-latest',
    'gemini-3.1-pro-preview',
];
const models = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_CANDIDATES;

const is3x = (m) => !/gemini-2\./.test(m);

async function call(key, model, extra = {}) {
    const started = Date.now();
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Một người tiết kiệm 3 triệu/tháng, cần 50 triệu. Mất bao lâu? Trả lời 1 câu.' }] }],
            ...extra,
        }),
        signal: AbortSignal.timeout(90_000),
    }).catch((e) => ({ ok: false, status: 'ERR', json: async () => ({ error: { message: e.message } }) }));
    const ms = Date.now() - started;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = data?.error?.message || '';
        return { ok: false, status: res.status, ms, msg: msg.slice(0, 100), isSpendingCap: /spending cap|spend cap/i.test(msg) };
    }
    const parts = data?.candidates?.[0]?.content?.parts || [];
    return {
        ok: true,
        status: res.status,
        ms,
        thoughts: parts.filter((p) => p.thought).length,
        thoughtTokens: data?.usageMetadata?.thoughtsTokenCount || 0,
        total: data?.usageMetadata?.totalTokenCount || 0,
        grounded: !!data?.candidates?.[0]?.groundingMetadata,
        text: parts.filter((p) => !p.thought && p.text).map((p) => p.text).join('').slice(0, 60).replace(/\s+/g, ' '),
    };
}

function fmt(label, r) {
    if (!r.ok) return `  ${label.padEnd(22)} ✗ ${r.status} (${r.ms}ms) ${r.msg}`;
    return `  ${label.padEnd(22)} ✓ ${String(r.ms).padStart(6)}ms  thought-parts=${r.thoughts} thought-tok=${r.thoughtTokens} total=${r.total}${r.grounded ? ' grounded' : ''}  "${r.text}"`;
}

for (let kIdx = 0; kIdx < keys.length; kIdx++) {
    const key = keys[kIdx];
    const masked = `${key.slice(0, 8)}...${key.slice(-4)}`;
    console.log(`\n==================================================`);
    console.log(`🔑 Key #${kIdx + 1}/${keys.length}: ${masked}`);
    console.log(`==================================================`);

    let spendCapHit = false;
    for (const model of models) {
        console.log(`\n▶ ${model}`);
        const base = await call(key, model);
        console.log(fmt('mặc định', base));
        if (!base.ok) {
            if (base.isSpendingCap) {
                spendCapHit = true;
            }
            continue;
        }

        if (is3x(model)) {
            for (const level of ['minimal', 'low', 'medium', 'high']) {
                const r = await call(key, model, { generationConfig: { thinkingConfig: { thinkingLevel: level, includeThoughts: true } } });
                console.log(fmt(`thinkingLevel=${level}`, r));
            }
        } else {
            for (const budget of [0, 2048]) {
                const r = await call(key, model, { generationConfig: { thinkingConfig: { thinkingBudget: budget, includeThoughts: budget > 0 } } });
                console.log(fmt(`thinkingBudget=${budget}`, r));
            }
        }

        const search = await call(key, model, { tools: [{ google_search: {} }] });
        console.log(fmt('google_search', search));

        const mixed = await call(key, model, {
            tools: [
                { google_search: {} },
                { functionDeclarations: [{ name: 'noop', description: 'không làm gì', parameters: { type: 'OBJECT', properties: {} } }] },
            ],
        });
        console.log(fmt('search + function', mixed));
    }

    if (spendCapHit) {
        console.log(`\n⚠️  LƯU Ý: Key #${kIdx + 1} (${masked}) đã chạm hạn mức chi tiêu tháng (Spending Cap) của Google AI!`);
        console.log(`👉 Truy cập: https://ai.studio/spend để nâng hạn mức hoặc tạo API Key mới.`);
    }
}
