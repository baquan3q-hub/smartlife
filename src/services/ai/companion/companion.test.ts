import { describe, it, expect } from 'vitest';
import { DEFAULT_COMPANION, canUseSweetheart, defaultPronouns, hasBlockedContent, previewGreeting, sanitizeCompanion, splitCompanionMessage } from './types';
import { companionFormatting, companionIdentity, companionSafetyBlock, renderCompanionBlock } from './prompt';
import { buildGreetingContext, buildGreetingPrompt, fallbackGreeting, vnDateKey } from './greeting';

describe('hồ sơ bạn AI', () => {
    it('xưng hô gợi ý theo giới tính + quan hệ', () => {
        expect(defaultPronouns('female', 'friend')).toEqual({ selfPronoun: 'tớ', userPronoun: 'cậu' });
        expect(defaultPronouns('male', 'senior')).toEqual({ selfPronoun: 'anh', userPronoun: 'em' });
        expect(defaultPronouns('female', 'senior')).toEqual({ selfPronoun: 'chị', userPronoun: 'em' });
        expect(defaultPronouns('neutral', 'mentor')).toEqual({ selfPronoun: 'mình', userPronoun: 'bạn' });
        expect(defaultPronouns('male', 'sweetheart')).toEqual({ selfPronoun: 'anh', userPronoun: 'em' });
    });

    it('"Người thương" bị hạ về "Bạn thân" khi chưa xác nhận 18+', () => {
        expect(sanitizeCompanion({ ...DEFAULT_COMPANION, relationship: 'sweetheart' }).relationship).toBe('friend');
        const ok = sanitizeCompanion({ ...DEFAULT_COMPANION, relationship: 'sweetheart', adultConfirmedAt: '2026-11-19T00:00:00Z' });
        expect(ok.relationship).toBe('sweetheart');
    });

    it('tuổi trong hồ sơ < 18 thì không được "Người thương" dù đã tick xác nhận', () => {
        expect(canUseSweetheart('2026-11-19', 16)).toBe(false);
        const p = sanitizeCompanion({ ...DEFAULT_COMPANION, relationship: 'sweetheart', adultConfirmedAt: '2026-11-19' }, { profileAge: 16 });
        expect(p.relationship).toBe('friend');
    });

    it('chặn tên / tiểu sử có nội dung tình dục, giữ tên thường', () => {
        expect(hasBlockedContent('em sexy')).toBe(true);
        expect(hasBlockedContent('Khiêu dâm')).toBe(true);
        expect(hasBlockedContent('Sexton')).toBe(false);
        const p = sanitizeCompanion({ ...DEFAULT_COMPANION, name: 'Sexy girl', backstory: 'thích khiêu dâm', interests: 'đọc sách, mèo' });
        expect(p.name).toBe('Mây');
        expect(p.backstory).toBe('');
        expect(p.interests).toBe('đọc sách, mèo');
    });

    it('cắt độ dài, bỏ ký tự lạ, lọc tính cách không hợp lệ', () => {
        const p = sanitizeCompanion({ name: '  <b>Bơ</b>  ', traits: ['funny', 'evil', 'funny', 'calm', 'gentle', 'direct', 'witty'], backstory: 'x'.repeat(500) });
        expect(p.name).toBe('b Bơ /b');
        expect(p.traits).toEqual(['funny', 'calm', 'gentle', 'direct']);
        expect(p.backstory.length).toBe(200);
    });

    it('xưng hô ngoài danh sách thì dùng gợi ý mặc định', () => {
        const p = sanitizeCompanion({ gender: 'male', relationship: 'senior', selfPronoun: 'ta', userPronoun: 'ngươi' });
        expect(p.selfPronoun).toBe('anh');
        expect(p.userPronoun).toBe('em');
    });

    it('câu chào xem trước dùng đúng tên và xưng hô', () => {
        const g = previewGreeting({ ...DEFAULT_COMPANION, name: 'Bơ', emoji: 'none' });
        expect(g).toContain('Bơ');
        expect(g).toContain('cậu');
        expect(g).not.toMatch(/\p{Extended_Pictographic}/u);
    });
});

describe('prompt bạn AI', () => {
    const p = { ...DEFAULT_COMPANION, name: 'Bơ', gender: 'male' as const, relationship: 'senior' as const, selfPronoun: 'anh', userPronoun: 'em' };

    it('danh tính dùng tên + xưng hô, không phải SmartLife Advisor', () => {
        const t = companionIdentity(p);
        expect(t).toContain('**Bơ**');
        expect(t).toContain('xưng "anh"');
        expect(t).toContain('gọi người dùng là "em"');
        expect(t).not.toContain('Advisor');
    });

    it('trình bày ngắn theo độ dài và emoji', () => {
        expect(companionFormatting({ ...p, length: 'tiny', emoji: 'none' })).toContain('1–2 câu');
        expect(companionFormatting({ ...p, length: 'tiny', emoji: 'none' })).toContain('KHÔNG dùng emoji');
        expect(companionFormatting({ ...p, length: 'short' })).toContain('2–4 câu');
    });

    it('khối tính cách liệt kê các nét đã chọn', () => {
        const t = renderCompanionBlock({ ...p, traits: ['funny', 'calm'], interests: 'cầu lông' });
        expect(t).toContain('Hài hước');
        expect(t).toContain('Điềm tĩnh');
        expect(t).toContain('cầu lông');
        expect(t).not.toContain('Dịu dàng');
    });

    it('khối an toàn có số hỗ trợ đã xác minh và ranh giới tình dục', () => {
        const t = companionSafetyBlock(p);
        expect(t).toContain('096 306 1414');
        expect(t).toContain('115');
        expect(t).toContain('KHÔNG có nội dung tình dục');
        expect(t).toContain('chẳng thiết gì nữa');
        expect(t).not.toContain('Kiểu "Người thương"');
        expect(companionSafetyBlock({ ...p, relationship: 'sweetheart' })).toContain('Kiểu "Người thương"');
    });
});

describe('lời chào chủ động', () => {
    // 2026-11-19 08:30 giờ VN (thứ 5)
    const now = new Date('2026-11-19T01:30:00Z');

    it('ngày theo giờ Việt Nam', () => {
        expect(vnDateKey(new Date('2026-11-18T18:00:00Z'))).toBe('2026-11-19');
        expect(vnDateKey(new Date('2026-11-18T16:00:00Z'))).toBe('2026-11-18');
    });

    it('lấy việc đến hạn, quá hạn và lịch hôm nay', () => {
        const ctx = buildGreetingContext({
            profile: { id: 'u', full_name: 'Nguyễn Văn An' },
            todos: [
                { id: '1', content: 'Nộp báo cáo', is_completed: false, priority: 'high', deadline: '2026-11-19T10:00:00Z' },
                { id: '2', content: 'Đã xong', is_completed: true, priority: 'low', deadline: '2026-11-19T10:00:00Z' },
                { id: '3', content: 'Cũ', is_completed: false, priority: 'low', deadline: '2026-11-10T10:00:00Z' },
            ],
            timetable: [{ id: 't', title: 'Giải tích', day_of_week: 4, start_time: '07:00' }],
            calendarEvents: [{ title: 'Họp CLB', date: '2026-11-19', start_time: '19:00' }],
        }, now);
        expect(ctx.userName).toBe('An');
        expect(ctx.partOfDay).toBe('buổi sáng');
        expect(ctx.weekday).toBe('Thứ 5');
        expect(ctx.todosDueToday).toEqual(['Nộp báo cáo']);
        expect(ctx.overdueCount).toBe(1);
        expect(ctx.eventsToday).toEqual(['07:00 Giải tích', '19:00 Họp CLB']);
    });

    it('prompt chào có dữ liệu hôm nay và luật ngắn gọn; dự phòng không vỡ khi rỗng', () => {
        const ctx = buildGreetingContext(null, now);
        const prompt = buildGreetingPrompt(DEFAULT_COMPANION, { ...ctx, todosDueToday: ['Nộp báo cáo'] });
        expect(prompt).toContain('Nộp báo cáo');
        expect(prompt).toContain('CHỦ ĐỘNG');
        expect(prompt).toContain('**Mây**');
        expect(fallbackGreeting(DEFAULT_COMPANION, ctx)).toContain('cậu');
    });
});

describe('tách tin nhắn bạn AI', () => {
    it('tách theo dòng trống, tối đa 3 bong bóng', () => {
        expect(splitCompanionMessage('Ơ thật á?\n\nKể tớ nghe đi')).toEqual(['Ơ thật á?', 'Kể tớ nghe đi']);
        expect(splitCompanionMessage('Một câu thôi')).toEqual(['Một câu thôi']);
        expect(splitCompanionMessage('')).toEqual([]);
    });

    it('có danh sách hoặc quá nhiều đoạn thì giữ nguyên', () => {
        const crisis = 'Tớ lo cho cậu lắm.\n\n- **115**\n- **096 306 1414**';
        expect(splitCompanionMessage(crisis)).toEqual([crisis]);
        expect(splitCompanionMessage('a\n\nb\n\nc\n\nd')).toHaveLength(1);
    });
});
