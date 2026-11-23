// File: src/services/ai/webSearch.ts
// Công cụ web_search phía client: gọi /api/search, giới hạn 2 lần mỗi câu hỏi, gộp nguồn của nhiều lần tìm.

export interface WebSource {
    n: number;
    title: string;
    url: string;
    domain: string;
}

export interface WebSearchResult {
    query: string;
    summary: string;
    sources: WebSource[];
}

export const MAX_WEB_SEARCHES = 2;

export const WEB_SEARCH_LIMIT_ERROR = {
    error: `Đã dùng hết ${MAX_WEB_SEARCHES} lượt tìm web cho câu hỏi này. Hãy trả lời dựa trên kết quả đã có và nói rõ phần nào chưa kiểm chứng được.`,
};

/**
 * Gộp nguồn của một lần tìm vào danh sách chung: đánh số lại liên tục qua các lần tìm, bỏ trùng theo URL,
 * và sửa các dấu [n] trong tóm tắt cho khớp số mới.
 */
export function mergeSearchSources(existing: WebSource[], incoming: WebSearchResult): { sources: WebSource[]; summary: string } {
    const sources = [...existing];
    const remap = new Map<number, number>();
    for (const s of incoming.sources || []) {
        if (!s?.url) continue;
        const found = sources.find(x => x.url === s.url);
        if (found) {
            remap.set(s.n, found.n);
            continue;
        }
        const n = sources.length + 1;
        sources.push({ n, title: s.title || s.domain || s.url, url: s.url, domain: s.domain || '' });
        remap.set(s.n, n);
    }
    const summary = (incoming.summary || '').replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (whole, list: string) => {
        const nums = list.split(',').map(x => Number(x.trim()));
        if (!nums.every(k => remap.has(k))) return whole;
        return nums.map(k => `[${remap.get(k)}]`).join('');
    });
    return { sources, summary };
}

/** Gọi /api/search. Lỗi (chưa đăng nhập, gói Free, hết hạn mức…) trả về { error } để model tự xử lý. */
export async function fetchWebSearch(
    query: string,
    opts: { headers: Record<string, string>; signal?: AbortSignal; context?: string; endpoint?: string; fetchImpl?: typeof fetch },
): Promise<WebSearchResult | { error: string }> {
    const q = (query || '').trim().slice(0, 300);
    if (q.length < 2) return { error: 'Câu tìm kiếm quá ngắn.' };
    const doFetch = opts.fetchImpl || fetch;
    try {
        const res = await doFetch(opts.endpoint || '/api/search', {
            method: 'POST',
            headers: opts.headers,
            body: JSON.stringify({ query: q, context: opts.context?.slice(0, 500) }),
            signal: opts.signal,
        });
        const data: any = await res.json().catch(() => ({}));
        if (!res.ok) {
            return { error: data?.message || data?.error || `Tìm web thất bại (mã ${res.status}).` };
        }
        return {
            query: data.query || q,
            summary: typeof data.summary === 'string' ? data.summary : '',
            sources: Array.isArray(data.sources) ? data.sources : [],
        };
    } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
        return { error: 'Không kết nối được dịch vụ tìm web.' };
    }
}
