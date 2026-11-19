import { describe, it, expect, vi } from 'vitest';
import { routeHeuristic, detectDomain, detectCrisis, parseRouterReply, routeTurn } from './router';

describe('routeHeuristic — luật chọn tầng', () => {
    it('chào hỏi, cảm ơn → nhanh', () => {
        expect(routeHeuristic({ text: 'Chào bạn' }).tier).toBe('fast');
        expect(routeHeuristic({ text: 'cảm ơn nhé' })).toMatchObject({ tier: 'fast', confident: true });
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
        expect(r).toMatchObject({ tier: 'fast', auto: true, source: 'heuristic' });
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
    it('Auto luôn tầng nhanh, không gọi model router', async () => {
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
