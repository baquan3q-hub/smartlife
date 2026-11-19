// File: src/services/ai/router.ts
// Chế độ "Auto": chọn tầng tốc độ (fast / balanced / deep) và đoán lĩnh vực cho mỗi câu hỏi.
// Ưu tiên luật đơn giản (miễn phí, tức thì); chỉ khi luật không chắc mới hỏi model nhanh (purpose 'router', 0 lượt).

import type { AITier } from '../geminiService';
import type { ExpertId } from './experts/types';

export type SpeedChoice = 'auto' | AITier;

export interface RouteInput {
    text: string;
    hasAttachments?: boolean;
    expert?: ExpertId;
}

export interface HeuristicResult {
    tier: AITier;
    confident: boolean;
    reason: string;
}

export interface RouteDecision {
    tier: AITier;
    domain: ExpertId;
    /** Có dấu hiệu khủng hoảng (tự hại, bạo hành…) → luôn nạp giao thức an toàn */
    crisis: boolean;
    auto: boolean;
    source: 'fixed' | 'heuristic' | 'model' | 'fallback';
    reason: string;
}

const norm = (s: string) => (s || '').toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();

// \b của JS chỉ hiểu chữ ASCII ("thi" sẽ khớp cả "thiết") → dùng ranh giới theo chữ Unicode
const B = String.raw`(?<![\p{L}\p{N}])`;
const E = String.raw`(?![\p{L}\p{N}])`;
const words = (list: string[], flags = 'u') => new RegExp(`${B}(?:${list.join('|')})${E}`, flags);
const starts = (list: string[]) => new RegExp(`^(?:${list.join('|')})${E}`, 'u');

const GREETING = starts(['hi', 'hello', 'hey', 'alo', 'chào', 'xin chào', 'chào bạn', 'hế lô', 'cảm ơn', 'cám ơn', 'thanks', 'thank you', 'ok', 'oke', 'okay', 'ừ', 'ừm', 'được rồi', 'tốt', 'tuyệt', 'good']);
const CRUD = starts(['thêm', 'tạo', 'xoá', 'xóa', 'sửa', 'đổi', 'cập nhật', 'đánh dấu', 'ghi', 'ghi lại', 'nhắc', 'đặt lịch', 'lưu', 'hủy', 'huỷ', 'chuyển']);
const ANALYTIC = words(['phân tích', 'lập kế hoạch', 'lên kế hoạch', 'kế hoạch', 'so sánh', 'đánh giá', 'dự đoán', 'dự báo', 'lộ trình', 'chiến lược', 'tối ưu', 'tư vấn', 'giải thích', 'tại sao', 'vì sao', 'làm sao', 'làm thế nào', 'nên .{1,40} hay', 'ưu nhược', 'cân nhắc']);
const DEEP = words(['chi tiết', 'kỹ lưỡng', 'kĩ lưỡng', 'toàn diện', 'thật sâu', 'từng bước', 'nhiều phương án', 'dài hạn', '5 năm', '10 năm', 'cả năm', 'cả kỳ', 'cả học kỳ', 'toàn bộ']);

const DOMAIN_WORDS: Record<Exclude<ExpertId, 'general' | 'companion'>, RegExp> = {
    finance: words(['tiền', 'chi tiêu', 'thu nhập', 'lương', 'ngân sách', 'tiết kiệm', 'khoản nợ', 'trả nợ', 'vay', 'đầu tư', 'cổ phiếu', 'chứng khoán', 'crypto', 'coin', 'giao dịch', 'tài chính', 'lãi suất', 'vàng', 'tỷ giá', String.raw`\d+\s?(?:k|tr|triệu|nghìn|ngàn)`, 'vnd', 'đồng'], 'gu'),
    study: words(['gpa', 'điểm', 'tín chỉ', 'môn học', 'môn', 'học kỳ', 'học kì', 'thi', 'ôn thi', 'ôn tập', 'bài tập', 'đại học', 'sinh viên', 'cuối kỳ', 'giữa kỳ', 'học bổng', 'tốt nghiệp', 'pomodoro', 'học bài'], 'gu'),
    psychology: words(['buồn', 'chán', 'mệt mỏi', 'áp lực', 'lo âu', 'lo lắng', 'stress', 'căng thẳng', 'trầm cảm', 'cô đơn', 'khóc', 'mất ngủ', 'tự ti', 'kiệt sức', 'tuyệt vọng', 'cảm xúc', 'bế tắc', 'hoảng loạn', 'vô dụng', 'tâm lý'], 'gu'),
    relationship: words(['người yêu', 'crush', 'bạn trai', 'bạn gái', 'người ấy', 'chia tay', 'cãi nhau', 'ghen', 'tình cảm', 'tỏ tình', 'hẹn hò', 'vợ', 'chồng', 'bố mẹ', 'ba mẹ', 'gia đình', 'bạn thân', 'đồng nghiệp', 'mối quan hệ', 'người cũ'], 'gu'),
    planner: words(['kế hoạch', 'lộ trình', 'mục tiêu', 'deadline', 'hạn chót', 'thời gian biểu', 'sắp xếp', 'ưu tiên', 'dự án', 'việc cần làm', 'todo', 'tuần này', 'tháng này', 'lịch trình', 'quản lý thời gian'], 'gu'),
};

const CRISIS = words(['tự tử', 'tự sát', 'tự hại', 'tự làm hại', 'rạch tay', 'cắt tay', 'không muốn sống', 'chẳng muốn sống', 'muốn chết', 'chết đi cho xong', 'biến mất (?:thì|cho) (?:tốt|xong)', 'kết thúc cuộc đời', 'kết liễu', 'nhảy cầu', 'uống thuốc ngủ', 'bị (?:đánh|đe doạ|đe dọa|cưỡng hiếp|xâm hại|bạo hành)', 'suicide', 'kill myself']);

/** Có dấu hiệu khủng hoảng (tự hại, bạo hành) trong câu hỏi không */
export function detectCrisis(text: string): boolean {
    return CRISIS.test(norm(text));
}

/** Đoán lĩnh vực theo từ khoá. Không khớp gì → 'general'. */
export function detectDomain(text: string): ExpertId {
    const t = norm(text);
    if (!t) return 'general';
    let best: ExpertId = 'general';
    let bestScore = 0;
    for (const [id, re] of Object.entries(DOMAIN_WORDS) as Array<[ExpertId, RegExp]>) {
        const score = (t.match(re) || []).length;
        if (score > bestScore) { best = id; bestScore = score; }
    }
    if (detectCrisis(t) && best !== 'relationship') return 'psychology';
    return best;
}

/** Luật chọn tầng. confident=false nghĩa là nên hỏi model router. */
export function routeHeuristic(input: RouteInput): HeuristicResult {
    const t = norm(input.text);
    const len = t.length;
    const expert = input.expert || 'general';
    const analytic = ANALYTIC.test(t);
    const deep = DEEP.test(t);

    if (detectCrisis(t)) return { tier: 'balanced', confident: true, reason: 'chủ đề nhạy cảm cần trả lời cẩn thận' };
    if (input.hasAttachments) {
        return analytic && deep
            ? { tier: 'deep', confident: true, reason: 'tệp đính kèm + yêu cầu phân tích sâu' }
            : { tier: 'balanced', confident: true, reason: 'có tệp đính kèm' };
    }
    if (!len) return { tier: 'fast', confident: true, reason: 'tin trống' };
    if (GREETING.test(t) && len <= 40) return { tier: 'fast', confident: true, reason: 'chào hỏi / xác nhận ngắn' };
    if (CRUD.test(t) && len <= 120 && !analytic) return { tier: 'fast', confident: true, reason: 'lệnh thêm/sửa/xoá ngắn' };
    if (analytic && (deep || len > 300)) return { tier: 'deep', confident: true, reason: 'yêu cầu phân tích dài/sâu' };
    if (expert !== 'general' && len > 200) return { tier: 'deep', confident: true, reason: 'câu hỏi dài trong chế độ chuyên gia' };
    if (analytic) return { tier: 'balanced', confident: true, reason: 'cần phân tích / lập kế hoạch' };
    if (len <= 25) return { tier: 'fast', confident: true, reason: 'câu hỏi rất ngắn' };
    if (expert !== 'general') return { tier: 'balanced', confident: true, reason: 'chế độ chuyên gia' };
    if (len >= 160) return { tier: 'balanced', confident: true, reason: 'câu hỏi dài' };
    // Câu hỏi vừa phải, không có dấu hiệu rõ → để model quyết
    return { tier: len < 60 ? 'fast' : 'balanced', confident: false, reason: 'chưa rõ độ khó' };
}

const TIERS: AITier[] = ['fast', 'balanced', 'deep'];
const DOMAINS: ExpertId[] = ['general', 'planner', 'psychology', 'finance', 'study', 'relationship'];

export function buildRouterPrompt(text: string): string {
    return `Phân loại câu hỏi của người dùng một ứng dụng quản lý cuộc sống (tài chính, lịch, học tập, nhật ký).
Chọn "tier":
- "fast": tra cứu đơn giản, lệnh thêm/sửa, câu hỏi ngắn trả lời được ngay.
- "balanced": cần đọc dữ liệu và phân tích vừa phải, lời khuyên có lý do.
- "deep": lập kế hoạch nhiều bước, so sánh nhiều phương án, tính toán phức tạp.
Chọn "domain": general | planner | psychology | finance | study | relationship.
Chỉ trả JSON một dòng, không giải thích: {"tier":"...","domain":"..."}

Câu hỏi: """${text.slice(0, 1500)}"""`;
}

/** Đọc JSON model trả về; sai định dạng → null */
export function parseRouterReply(reply: string): { tier: AITier; domain: ExpertId } | null {
    const m = (reply || '').match(/\{[\s\S]*?\}/);
    if (!m) return null;
    try {
        const obj = JSON.parse(m[0]);
        const tier = TIERS.includes(obj?.tier) ? obj.tier as AITier : null;
        if (!tier) return null;
        const domain = DOMAINS.includes(obj?.domain) ? obj.domain as ExpertId : 'general';
        return { tier, domain };
    } catch {
        return null;
    }
}

/**
 * Quyết định tầng + lĩnh vực cho một lượt.
 * callModel: hàm gọi model nhanh (purpose 'router'); bỏ trống thì chỉ dùng luật.
 */
export async function routeTurn(
    input: RouteInput,
    speed: SpeedChoice,
    callModel?: (prompt: string) => Promise<string>,
    timeoutMs = 4000,
): Promise<RouteDecision> {
    const domain = detectDomain(input.text);
    const crisis = detectCrisis(input.text);
    if (speed !== 'auto') {
        return { tier: speed, domain, crisis, auto: false, source: 'fixed', reason: 'người dùng chọn' };
    }
    // Bạn đồng hành: tin nhắn ngắn kiểu chat → luôn tầng nhanh, chỉ nâng lên khi có dấu hiệu khủng hoảng; không gọi model router
    if (input.expert === 'companion') {
        return crisis
            ? { tier: 'balanced', domain, crisis, auto: true, source: 'heuristic', reason: 'chủ đề nhạy cảm cần trả lời cẩn thận' }
            : { tier: 'fast', domain, crisis, auto: true, source: 'heuristic', reason: 'trò chuyện với bạn đồng hành' };
    }
    const h = routeHeuristic(input);
    if (h.confident || !callModel) {
        return { tier: h.tier, domain, crisis, auto: true, source: 'heuristic', reason: h.reason };
    }
    try {
        const reply = await Promise.race([
            callModel(buildRouterPrompt(input.text)),
            new Promise<string>((_, reject) => setTimeout(() => reject(new Error('router timeout')), timeoutMs)),
        ]);
        const parsed = parseRouterReply(reply);
        if (parsed) {
            return {
                tier: parsed.tier,
                domain: domain !== 'general' ? domain : parsed.domain,
                crisis,
                auto: true,
                source: 'model',
                reason: 'model phân loại',
            };
        }
    } catch { /* model lỗi / quá giờ → dùng luật */ }
    return { tier: h.tier, domain, crisis, auto: true, source: 'fallback', reason: h.reason };
}
