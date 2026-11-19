import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildSystemPrompt, LEGACY_SYSTEM_INSTRUCTION } from './promptBlocks';
import { DEFAULT_COMPANION } from './companion/types';

describe('buildSystemPrompt', () => {
    it('prompt cũ ghép lại giống hệt bản gốc trước khi tách khối', () => {
        // bản gốc ở commit 41490dc được lưu kèm để so sánh
        const original = readFileSync(new URL('./__fixtures__/legacySystemInstruction.txt', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
        expect(LEGACY_SYSTEM_INSTRUCTION).toBe(original);
    });

    it('Chung: giữ các khối cũ, không có khối chuyên gia, không nạp GPA khi không liên quan', () => {
        const p = buildSystemPrompt({ expert: 'general', userText: 'Tháng này tiêu bao nhiêu?' });
        expect(p.blocks).toEqual(['identity', 'tools', 'artifacts', 'reasoning', 'formatting', 'domain_notes', 'web_search', 'clarify']);
        expect(p.text).toContain('SmartLife Advisor');
        expect(p.text).not.toContain('QUY CHẾ GPA');
    });

    it('Chung + câu hỏi GPA → nạp quy chế GPA', () => {
        expect(buildSystemPrompt({ expert: 'general', userText: 'GPA tích lũy của mình bao nhiêu' }).blocks).toContain('gpa_rules');
        expect(buildSystemPrompt({ expert: 'general', domain: 'study' }).blocks).toContain('gpa_rules');
    });

    it('Học tập: quy chế GPA nằm trong khối chuyên gia, không nạp trùng', () => {
        const p = buildSystemPrompt({ expert: 'study' });
        expect(p.blocks).toContain('expert');
        expect(p.blocks).not.toContain('gpa_rules');
        expect(p.text.match(/QUY CHẾ GPA ĐHQGHN 2022/g)).toHaveLength(1);
    });

    it('Tâm lý: trình bày kiểu trò chuyện, có giao thức khủng hoảng, không có bảng/artifact, không web', () => {
        const p = buildSystemPrompt({ expert: 'psychology' });
        expect(p.blocks).not.toContain('artifacts');
        expect(p.blocks).not.toContain('web_search');
        expect(p.text).toContain('GIAO THỨC KHỦNG HOẢNG');
        expect(p.text).toContain('096 306 1414');
        expect(p.text).toContain('KHÔNG dùng ask_user dạng trắc nghiệm');
    });

    it('Dấu hiệu khủng hoảng ở chế độ khác → nạp khối an toàn', () => {
        expect(buildSystemPrompt({ expert: 'finance', crisis: true }).blocks).toContain('crisis');
        expect(buildSystemPrompt({ expert: 'psychology', crisis: true }).blocks).not.toContain('crisis');
    });

    it('Tài chính: cấm khuyến nghị mã cụ thể', () => {
        expect(buildSystemPrompt({ expert: 'finance' }).text).toContain('KHÔNG khuyến nghị mua/bán mã cổ phiếu');
    });

    it('số lượt hỏi lại còn lại', () => {
        expect(buildSystemPrompt({ expert: 'general' }).text).toContain('Còn 1 lượt hỏi lại');
        expect(buildSystemPrompt({ expert: 'planner' }).text).toContain('Còn 2 lượt hỏi lại');
        expect(buildSystemPrompt({ expert: 'general', tier: 'deep', clarifyRoundsUsed: 1 }).text).toContain('Còn 1 lượt hỏi lại');
        expect(buildSystemPrompt({ expert: 'general', clarifyRoundsUsed: 1 }).text).toContain('Đã hết lượt hỏi lại');
    });

    it('cá nhân hoá MBTI/DISC chỉ khi hồ sơ có', () => {
        expect(buildSystemPrompt({}).blocks).not.toContain('personalization');
        expect(buildSystemPrompt({ hasPersonality: true }).blocks).toContain('personalization');
    });
});

describe('buildSystemPrompt — Bạn đồng hành', () => {
    const companion = { ...DEFAULT_COMPANION, name: 'Bơ', selfPronoun: 'tớ', userPronoun: 'cậu' };

    it('danh tính + cách nhắn riêng, bỏ artifacts / reasoning / domain_notes / GPA', () => {
        const p = buildSystemPrompt({ expert: 'companion', companion, userText: 'GPA của tớ bao nhiêu' });
        expect(p.blocks).toEqual(['identity', 'tools', 'formatting', 'companion_persona', 'companion_safety', 'clarify']);
        expect(p.text).toContain('**Bơ**');
        expect(p.text).not.toContain('SmartLife Advisor');
        expect(p.text).not.toContain('<artifact');
        expect(p.text).not.toContain('QUY CHẾ GPA');
        expect(p.text).toContain('KHÔNG dùng ask_user để hỏi thêm thông tin');
    });

    it('khủng hoảng → nạp giao thức an toàn; không có hồ sơ → dùng hồ sơ mặc định', () => {
        const p = buildSystemPrompt({ expert: 'companion', crisis: true });
        expect(p.blocks).toContain('crisis');
        expect(p.text).toContain('**Mây**');
    });

    it('chế độ Chung không bị ảnh hưởng', () => {
        expect(buildSystemPrompt({ expert: 'general', companion }).text).not.toContain('Bơ');
    });
});
