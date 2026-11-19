import { describe, it, expect } from 'vitest';
import { DEFAULT_COMPANION, type CompanionProfile } from './types';
import { companionExamplesBlock, detectSignals, pickExamples } from './examples';
import { SLANG_LEXICON, companionStyleBlock, isTaoMay } from './style';

const TM: CompanionProfile = { ...DEFAULT_COMPANION, selfPronoun: 't', userPronoun: 'm' };
const ids = (p: CompanionProfile, text: string) => pickExamples(p, text).map(d => d.id);

describe('nhận tín hiệu tin nhắn', () => {
    it('"tạch r =))": trà sữa là hụt nhẹ, môn thi là mất mát thật', () => {
        const light = detectSignals('cái vòng quay trà sữa ấy, tạch r =))');
        expect(light.has('loss_light')).toBe(true);
        expect(light.has('tease')).toBe(true);
        const serious = detectSignals('môn t ôn cả tháng ấy, tạch r =))');
        expect(serious.has('loss_serious')).toBe(true);
        expect(serious.has('tease')).toBe(false);
    });

    it('từ mạnh: khoe vui khác bực bội', () => {
        expect(detectSignals('đẹp vl').has('cheer')).toBe(true);
        expect(detectSignals('đẹp vl').has('vent')).toBe(false);
        expect(detectSignals('bực vl').has('vent')).toBe(true);
    });

    it('xác nhận giờ khác muốn dừng', () => {
        expect(detectSignals('uk 7h nha').has('confirm')).toBe(true);
        expect(detectSignals('uk thôi để bữa khác').has('goodbye')).toBe(true);
        expect(detectSignals('díp mắt r').has('goodbye')).toBe(true);
    });

    it('nhờ viết tin, đổi xưng hô, không dấu, riêng tư, thiếu ngữ cảnh', () => {
        expect(detectSignals('t ko bt từ chối kèo tối nay sao').has('help_write')).toBe(true);
        expect(detectSignals('viết giúp t một tin nhắn nhắc nhóm').has('help_write')).toBe(true);
        expect(detectSignals('ê nói chuyện m t đi cho dễ').has('pronoun_switch')).toBe(true);
        expect(detectSignals('ê nói chuyện m t đi cho dễ').has('greeting')).toBe(true);
        expect(detectSignals('nay minh met qua, ko muon hoc nua').has('no_diacritics')).toBe(true);
        expect(detectSignals('chuyện này có ai khác đọc được không?').has('privacy')).toBe(true);
        expect(detectSignals('nhớ tên con mèo ko?').has('missing_context')).toBe(true);
    });

    it('tin nhắn rỗng không có tín hiệu', () => {
        expect(detectSignals('').size).toBe(0);
    });
});

describe('chọn hội thoại mẫu', () => {
    it('trượt môn chọn mẫu 05, không chọn mẫu trêu 04', () => {
        const got = ids(TM, 'môn t ôn cả tháng ấy, tạch r =))');
        expect(got).toContain('05');
        expect(got).not.toContain('04');
        expect(got).not.toContain('24');
    });

    it('hụt trà sữa thì có mẫu 04', () => {
        expect(ids(TM, 'cái vòng quay trà sữa ấy, tạch r =))')).toContain('04');
    });

    it('"díp mắt r" chọn mẫu tạm biệt', () => {
        const got = ids(TM, 'thôi t díp mắt r');
        expect(got.some(id => ['10', '30'].includes(id))).toBe(true);
    });

    it('hồ sơ tớ/cậu ưu tiên mẫu mình–bạn khi cùng điểm', () => {
        // "gọi mình là" khớp cả 18 và 29 (đều mình–bạn) — và 01 (pronoun_switch, mình–bạn)
        const got = pickExamples(DEFAULT_COMPANION, 'cứ gọi mình là Bắp nha');
        expect(got[0].pronoun).toBe('minh-ban');
    });

    it('không bao giờ chọn mẫu 28 (riêng tư) — app trả lời bằng thông tin thật', () => {
        expect(ids(DEFAULT_COMPANION, 'chuyện này có ai khác đọc được không?')).not.toContain('28');
    });

    it('4–5 mẫu, tất định, có mẫu nền khi ít tín hiệu', () => {
        const a = ids(DEFAULT_COMPANION, 'hôm nay trời đẹp');
        expect(a.length).toBeGreaterThanOrEqual(4);
        expect(a.length).toBeLessThanOrEqual(5);
        expect(a).toContain('02');
        expect(ids(DEFAULT_COMPANION, 'hôm nay trời đẹp')).toEqual(a);
        for (const text of ['môn t ôn cả tháng ấy, tạch r =))', 'uk 7h nha', 'bực vl', 'đẹp vl', '']) {
            const n = ids(TM, text).length;
            expect(n).toBeGreaterThanOrEqual(4);
            expect(n).toBeLessThanOrEqual(5);
        }
    });

    it('khối ví dụ nhắc xưng hô của hồ sơ, không phải của mẫu', () => {
        const block = companionExamplesBlock(DEFAULT_COMPANION, 'bực vl');
        expect(block).toContain('xưng "tớ" gọi "cậu"');
        expect(block).toContain('Người dùng:');
        expect(block).toContain('KHÔNG chép nguyên câu');
    });
});

describe('quy tắc giọng người bạn Việt', () => {
    it('hiểu từ mạnh nhưng không tự dùng; có từ điển', () => {
        const t = companionStyleBlock(DEFAULT_COMPANION);
        expect(t).toContain('KHÔNG BAO GIỜ tự viết');
        expect(t).toContain('vl, vãi');
        expect(SLANG_LEXICON.length).toBeGreaterThanOrEqual(10);
        expect(t).toContain('tiếng Việt có dấu');
    });

    it('đổi xưng hô giữa chat + quyền riêng tư nói thật', () => {
        const t = companionStyleBlock(DEFAULT_COMPANION);
        expect(t).toContain('Mặc định xưng "tớ" gọi "cậu"');
        expect(t).toContain('đổi ngay');
        expect(t).toContain('Google Gemini');
        expect(t).toContain('KHÔNG hứa');
    });

    it('chỉ thêm dòng t–m khi hồ sơ xưng t–m', () => {
        expect(isTaoMay(TM)).toBe(true);
        expect(companionStyleBlock(TM)).toContain('Đang xưng t–m');
        expect(companionStyleBlock(DEFAULT_COMPANION)).not.toContain('Đang xưng t–m');
    });
});
