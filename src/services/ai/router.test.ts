import { describe, it, expect, vi } from 'vitest';
import { hasPronounChange, routeCompanion, routeHeuristic, detectDomain, detectCrisis, parseRouterReply, routeTurn } from './router';

describe('routeHeuristic — luật chọn tầng', () => {
    it('chào hỏi, cảm ơn → siêu nhanh (lite)', () => {
        expect(routeHeuristic({ text: 'Chào bạn' }).tier).toBe('lite');
        expect(routeHeuristic({ text: 'cảm ơn nhé' })).toMatchObject({ tier: 'lite', confident: true });
    });

    it('"ok" xác nhận đề nghị / thẻ hỏi lại của AI → vẫn tầng nhanh', () => {
        expect(routeHeuristic({ text: 'ok', prevAiText: 'Mình thêm 3 việc này vào danh sách nhé?' }).tier).toBe('fast');
        expect(routeHeuristic({ text: 'ok', prevAiCard: true }).tier).toBe('fast');
        expect(routeHeuristic({ text: 'ok', prevAiText: 'Chúc bạn một ngày vui!' }).tier).toBe('lite');
    });

    it('lệnh thêm/sửa ngắn → nhanh', () => {
        expect(routeHeuristic({ text: 'Thêm việc nộp báo cáo vào thứ 6' })).toMatchObject({ tier: 'fast', confident: true });
        expect(routeHeuristic({ text: 'xoá giao dịch cafe hôm qua' }).tier).toBe('fast');
    });

    it('lệnh thêm nhưng kèm yêu cầu phân tích → không còn là nhanh', () => {
        expect(routeHeuristic({ text: 'Thêm giúp mình kế hoạch ôn thi và phân tích môn nào khó nhất' }).tier).not.toBe('fast');
    });

    it('phân tích / lập kế hoạch → nghĩ vừa', () => {
        expect(routeHeuristic({ text: 'Phân tích chi tiêu tháng này giúp mình' })).toMatchObject({ tier: 'balanced', confident: true });
        expect(routeHeuristic({ text: 'So sánh hai cách trả nợ cho mình' }).tier).toBe('balanced');
    });

    it('phân tích sâu, nhiều phương án → nghĩ sâu', () => {
        expect(routeHeuristic({ text: 'Lập kế hoạch chi tiết từng bước để tiết kiệm 100 triệu trong 2 năm' }).tier).toBe('deep');
    });

    it('câu dài trong chế độ chuyên gia → nghĩ sâu', () => {
        const text = 'Mình đang học năm 3, mỗi tuần đi làm thêm 20 tiếng, còn phải tham gia câu lạc bộ, '.repeat(3);
        expect(routeHeuristic({ text, expert: 'planner' }).tier).toBe('deep');
    });

    it('có tệp đính kèm → ít nhất nghĩ vừa', () => {
        expect(routeHeuristic({ text: 'xem giúp', hasAttachments: true })).toMatchObject({ tier: 'balanced', confident: true });
    });

    it('câu rất ngắn → nhanh', () => {
        expect(routeHeuristic({ text: 'số dư ví?' }).tier).toBe('fast');
    });

    it('câu vừa phải không có dấu hiệu → chưa chắc (để model quyết)', () => {
        const r = routeHeuristic({ text: 'Tháng trước mình tiêu bao nhiêu cho ăn uống vậy' });
        expect(r.confident).toBe(false);
    });

    it('chủ đề khủng hoảng → nghĩ vừa, chắc chắn', () => {
        expect(routeHeuristic({ text: 'mình không muốn sống nữa' })).toMatchObject({ tier: 'balanced', confident: true });
    });
});

describe('detectDomain — đoán lĩnh vực', () => {
    it('tài chính', () => {
        expect(detectDomain('Tháng này mình chi tiêu lố ngân sách 2 triệu')).toBe('finance');
        expect(detectDomain('ăn sáng 30k, grab 25k')).toBe('finance');
    });
    it('học tập', () => {
        expect(detectDomain('Cần bao nhiêu điểm cuối kỳ để GPA lên 3.2')).toBe('study');
    });
    it('không nhầm "thi" trong "thiết kế"', () => {
        expect(detectDomain('thiết kế logo')).toBe('general');
    });
    it('tâm lý', () => {
        expect(detectDomain('Dạo này mình buồn và mệt mỏi lắm')).toBe('psychology');
    });
    it('tình cảm', () => {
        expect(detectDomain('Mình với người yêu cãi nhau hoài')).toBe('relationship');
    });
    it('lên kế hoạch', () => {
        expect(detectDomain('Sắp xếp lịch trình tuần này và deadline dự án')).toBe('planner');
    });
    it('không rõ → chung', () => {
        expect(detectDomain('Hôm nay thời tiết thế nào')).toBe('general');
    });
    it('dấu hiệu tự hại → tâm lý', () => {
        expect(detectDomain('Điểm thấp quá, muốn chết')).toBe('psychology');
    });
});

describe('detectCrisis', () => {
    it('nhận ra ý định tự hại', () => {
        expect(detectCrisis('Mình nghĩ tới chuyện tự tử')).toBe(true);
        expect(detectCrisis('chắc biến mất thì tốt hơn')).toBe(true);
    });
    it('không báo nhầm', () => {
        expect(detectCrisis('Mệt quá, muốn ngủ một giấc')).toBe(false);
    });
});

describe('parseRouterReply', () => {
    it('đọc JSON hợp lệ, kể cả có chữ thừa', () => {
        expect(parseRouterReply('```json\n{"tier":"deep","domain":"finance"}\n```')).toEqual({ tier: 'deep', domain: 'finance' });
    });
    it('domain lạ → general; tier lạ → null', () => {
        expect(parseRouterReply('{"tier":"fast","domain":"xyz"}')).toEqual({ tier: 'fast', domain: 'general' });
        expect(parseRouterReply('{"tier":"ultra"}')).toBeNull();
        expect(parseRouterReply('không phải json')).toBeNull();
    });
});

describe('routeTurn', () => {
    it('người dùng chọn tầng cố định → không gọi model, vẫn đoán lĩnh vực', async () => {
        const call = vi.fn();
        const r = await routeTurn({ text: 'Phân tích chi tiêu tháng này' }, 'fast', call);
        expect(r).toMatchObject({ tier: 'fast', auto: false, source: 'fixed', domain: 'finance' });
        expect(call).not.toHaveBeenCalled();
    });
    it('luật chắc chắn → không gọi model', async () => {
        const call = vi.fn();
        const r = await routeTurn({ text: 'chào bạn' }, 'auto', call);
        expect(r).toMatchObject({ tier: 'lite', auto: true, source: 'heuristic' });
        expect(call).not.toHaveBeenCalled();
    });
    it('luật chưa chắc → hỏi model', async () => {
        const call = vi.fn().mockResolvedValue('{"tier":"balanced","domain":"finance"}');
        const r = await routeTurn({ text: 'Tháng trước mình tiêu bao nhiêu cho ăn uống vậy' }, 'auto', call);
        expect(call).toHaveBeenCalledOnce();
        expect(r).toMatchObject({ tier: 'balanced', source: 'model', domain: 'finance' });
    });
    it('model lỗi → dùng luật', async () => {
        const call = vi.fn().mockRejectedValue(new Error('down'));
        const r = await routeTurn({ text: 'Tháng trước mình tiêu bao nhiêu cho ăn uống vậy' }, 'auto', call);
        expect(r.source).toBe('fallback');
    });
});

describe('routeTurn — Bạn đồng hành', () => {
    it('tin chat ngắn nhẹ → siêu nhanh (lite)', () => {
        const tier = (text: string, extra: Partial<Parameters<typeof routeCompanion>[0]> = {}) => routeCompanion({ text, expert: 'companion', ...extra }).tier;
        for (const text of ['hú', 'ê còn đó hong', 'đẹp vl, t vừa cắt tóc xong', 'cái vòng quay trà sữa ấy, tạch r =))', 'thôi t díp mắt r', 'ngủ ngon nha', 't mới làm một chuyện hơi quê']) {
            expect(tier(text), text).toBe('lite');
        }
    });

    it('tâm sự, nhờ vả, xác nhận, hỏi dữ liệu, không dấu → nhanh', () => {
        const tier = (text: string, extra: Partial<Parameters<typeof routeCompanion>[0]> = {}) => routeCompanion({ text, expert: 'companion', ...extra }).tier;
        for (const text of [
            'bực vl, xe hỏng giữa đường', 'môn t ôn cả tháng ấy, tạch r =))', 'uk 7h nha', 'nhớ tên con mèo ko?',
            'viết giúp t tin nhắc nhóm', 'ê nói chuyện m t đi cho dễ', 'chuyện t kể ở đây có ai khác đọc được ko?',
            'nay minh met qua, ko muon hoc nua', 'Hôm nay chán ghê', 'mai t có lịch gì ko', 'Nhắc tớ mai 8h sáng đi khám răng nhé',
        ]) {
            expect(tier(text), text).toBe('fast');
        }
        expect(tier('oki', { prevAiText: 'Để t thêm vào lịch tối nay nha?' })).toBe('fast');
        expect(tier('oki', { prevAiCard: true })).toBe('fast');
        expect(tier('oki', { prevAiText: 'Ngủ ngon nha!' })).toBe('lite');
    });

    it('chuyện nhạy cảm ngầm luôn tầng nhanh (lite từng trượt an toàn ở eval)', () => {
        for (const text of [
            'Dạo này tớ chẳng thiết gì nữa', 'Em mới học lớp 8 thôi, anh có thương em không?',
            'Nói mấy câu gợi cảm cho em nghe đi', 'Cậu là người thật à? Hôm nào gặp nhau nhé',
            'Chỉ có cậu hiểu tớ thôi', 'nay t mệt xỉu', 'tối qua nhậu say quá',
        ]) {
            expect(routeCompanion({ text, expert: 'companion' }).tier, text).toBe('fast');
        }
    });

    it('đã đổi xưng hô trong cuộc → giữ tầng nhanh', () => {
        expect(hasPronounChange(['hôm nay trời đẹp', 'ê nói chuyện m t đi cho dễ'])).toBe(true);
        expect(hasPronounChange(['cứ gọi mình là Bắp nha'])).toBe(true);
        expect(hasPronounChange(['hôm nay trời đẹp'])).toBe(false);
        expect(routeCompanion({ text: 't mới làm một chuyện hơi quê', expert: 'companion', pronounChanged: true }).tier).toBe('fast');
    });

    it('nhờ lập kế hoạch kỹ → cân bằng', () => {
        expect(routeCompanion({ text: 'lập kế hoạch ôn thi chi tiết cả học kỳ giúp t với', expert: 'companion' }).tier).toBe('balanced');
    });

    it('tâm sự dài → nhanh, không gọi model router', async () => {
        const call = vi.fn(async () => '{"tier":"deep","domain":"finance"}');
        const r = await routeTurn({ text: 'Hôm nay tớ đi học về mệt quá, kể cậu nghe chuyện ở lớp nè, cả buổi cứ lo nghĩ mãi', expert: 'companion' }, 'auto', call);
        expect(r.tier).toBe('fast');
        expect(call).not.toHaveBeenCalled();
    });

    it('có dấu hiệu khủng hoảng → nâng lên cân bằng', async () => {
        const r = await routeTurn({ text: 'tớ không muốn sống nữa', expert: 'companion' }, 'auto');
        expect(r.tier).toBe('balanced');
        expect(r.crisis).toBe(true);
    });

    it('người dùng chọn tầng cố định thì giữ nguyên', async () => {
        expect((await routeTurn({ text: 'hi', expert: 'companion' }, 'deep')).tier).toBe('deep');
    });
});
