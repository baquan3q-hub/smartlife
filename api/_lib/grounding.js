// File: api/_lib/grounding.js
// Rút nguồn + chèn số trích dẫn [1], [2]… từ groundingMetadata của Gemini (Google Search).

// Phần chữ trả lời (bỏ phần "suy nghĩ")
export function answerText(data) {
    const parts = data?.candidates?.[0]?.content?.parts || [];
    return parts.filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
}

function domainOf(url, fallback) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return fallback || '';
    }
}

// Chèn " [n]" vào cuối từng đoạn được nguồn hỗ trợ.
// segment.startIndex/endIndex của Gemini tính theo BYTE UTF-8 (tiếng Việt có dấu chiếm 2–3 byte).
export function insertCitationMarkers(text, supports, chunkToNumber) {
    if (!text || !Array.isArray(supports) || supports.length === 0) return text;
    const bytes = Buffer.from(text, 'utf-8');
    const inserts = new Map(); // byteOffset -> Set<number>
    for (const s of supports) {
        const end = s?.segment?.endIndex;
        if (!Number.isInteger(end) || end < 0 || end > bytes.length) continue;
        const nums = (s.groundingChunkIndices || []).map((i) => chunkToNumber.get(i)).filter(Boolean);
        if (nums.length === 0) continue;
        const set = inserts.get(end) || new Set();
        nums.forEach((n) => set.add(n));
        inserts.set(end, set);
    }
    const offsets = [...inserts.keys()].sort((a, b) => a - b);
    const out = [];
    let cursor = 0;
    for (const off of offsets) {
        out.push(bytes.subarray(cursor, off));
        const marker = [...inserts.get(off)].sort((a, b) => a - b).map((n) => `[${n}]`).join('');
        out.push(Buffer.from(` ${marker}`, 'utf-8'));
        cursor = off;
    }
    out.push(bytes.subarray(cursor));
    return Buffer.concat(out).toString('utf-8');
}

// { summary, sources: [{ n, title, url, domain }], queries }
// Nguồn trùng URL được gộp; số thứ tự theo lần xuất hiện đầu tiên.
export function extractGrounding(data) {
    const meta = data?.candidates?.[0]?.groundingMetadata || {};
    const chunks = Array.isArray(meta.groundingChunks) ? meta.groundingChunks : [];
    const sources = [];
    const byUrl = new Map();
    const chunkToNumber = new Map();
    chunks.forEach((chunk, idx) => {
        const web = chunk?.web;
        if (!web?.uri) return;
        let n = byUrl.get(web.uri);
        if (!n) {
            n = sources.length + 1;
            byUrl.set(web.uri, n);
            sources.push({ n, title: web.title || domainOf(web.uri), url: web.uri, domain: web.title || domainOf(web.uri) });
        }
        chunkToNumber.set(idx, n);
    });
    const text = answerText(data);
    return {
        summary: insertCitationMarkers(text, meta.groundingSupports, chunkToNumber).trim(),
        sources,
        queries: Array.isArray(meta.webSearchQueries) ? meta.webSearchQueries : [],
    };
}

// Link của Google Search grounding là link chuyển hướng (vertexaisearch…) — đổi sang link bài gốc
// để người dùng thấy đúng trang báo/web. Lỗi hay chậm thì giữ link cũ.
export async function resolveSourceUrls(sources, timeoutMs = 2500) {
    await Promise.all(sources.map(async (s) => {
        if (!/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect/.test(s.url)) return;
        try {
            const res = await fetch(s.url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
            const location = res.headers.get('location');
            if (location && /^https?:\/\//.test(location)) {
                s.url = location;
                s.domain = domainOf(location, s.domain);
            }
        } catch {
            /* giữ link chuyển hướng */
        }
    }));
    return sources;
}
