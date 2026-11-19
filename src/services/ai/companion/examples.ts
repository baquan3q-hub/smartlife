// File: src/services/ai/companion/examples.ts
// Chọn 4–5 hội thoại mẫu hợp với tin nhắn hiện tại để đưa vào prompt (few-shot), thay vì nhồi cả 30 mẫu.
// Chọn tất định (cùng đầu vào → cùng kết quả) để test được.

import { DIALOGUES, type Dialogue, type DialogueTag } from './dataset';
import type { CompanionProfile } from './types';
import { isTaoMay } from './style';

const HAS_DIACRITIC = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const STRONG = /(?<![\p{L}])(?:dm|đm|đệnh mệnh|vl|vãi|vcl)(?![\p{L}])/iu;
const POSITIVE = /(đẹp|đỉnh|xịn|ngon|trơn tru|ngầu|vui|hay|giỏi|thích|được khen|ko vấp|không vấp)/i;
const SERIOUS_STAKES = /(môn|thi|điểm|ôn|kiểm tra|phỏng vấn|đồ án|học bổng|deadline|việc làm|công việc)/i;

/** Gắn tín hiệu tình huống cho một tin nhắn của người dùng (regex, không gọi AI) */
export function detectSignals(text: string): Set<DialogueTag> {
    const t = (text || '').normalize('NFC').toLowerCase().trim();
    const s = new Set<DialogueTag>();
    if (!t) return s;
    const add = (tag: DialogueTag, re: RegExp) => { if (re.test(t)) s.add(tag); };

    if (/(tạch|trượt|rớt|hụt|toang)/.test(t)) s.add(SERIOUS_STAKES.test(t) ? 'loss_serious' : 'loss_light');
    if (STRONG.test(t) && POSITIVE.test(t)) s.add('cheer');
    else if (STRONG.test(t) || /(bực|cáu|tức|ức chế|càm ràm|chửi|than )|cho (t|tao|mình|tớ) than/.test(t)) s.add('vent');
    add('cheer', /(vừa|mới) .*(xong|được|đạt|qua)|(đẹp|đỉnh|xịn|ngon|trơn tru|ngầu) (quá|ghê|xỉu)|(ko|không) vấp/);
    add('help_write', /(ko|k|không) (bt|biết|bít) .*(nhắn|nói|từ chối|trả lời|viết)|(viết|soạn|nhắn) (giúp|hộ|dùm)|tin nhắn (nhắc|xin|từ chối)/);
    add('goodbye', /(díp mắt|đi ngủ|ngủ đây|\bout\b|học bài đây|\bbye\b|bữa khác|để mai|mai kể|thôi để)/);
    add('pronoun_switch', /(xưng|nói chuyện m t|m t đi|t m đi|mày tao|tao mày|gọi (mình|tui|t|tớ|em) là bạn)/);
    add('name_pref', /(gọi (mình|tui|t|tao|tớ|em) là|đừng gọi)/);
    add('privacy', /(ai (khác )?(đọc|xem|biết) (được|đc)|riêng tư|bí mật|ngại nhắc tên|lộ ra)/);
    add('missing_context', /(nhớ .*(ko|không|hong|hông|k)\b|vụ hôm trước|chuyện hôm trước)/);
    add('confirm', /\b\d{1,2}h\d{0,2}\b.*(nha|nhé|nhó|chốt)|^(oki|ok|oke|chốt|nhất trí)\b/);
    add('choice', /(chọn|nên|vote).*\bhay\b|\bhay\b.*(\?|đi)$/);
    add('silence', /((chưa|không|ko) muốn (kể|nói))/);
    add('tone_change', /(bớt (cute|nhây|lầy)|nói (nghiêm|ngắn|gọn)|gọn (lại|nữa)|(ko|không) có mood)/);
    add('return', /(mấy hôm|lâu rồi|lâu lắm|mới vô|mới vào|quay lại)/);
    add('greeting', /^(ê|alo|hú|hi|hello|chào)(?=[\s,!.?]|$)|còn đó (hong|ko|không)/);
    add('daily', /(ăn gì|mặc gì|nấu gì|đi đâu chơi)/);
    add('honest', /(từng|có bao giờ) .*(chưa|không|ko)\??$/);
    add('disagree', /(chắc (là )?(ghét|giận|bơ)|seen .*(rồi|r)\b)/);
    add('awkward', /(quê|ngại|xấu hổ|nhục)/);
    add('busy', /(để .*(coi|xem) lại|lát nữa|tí nữa)/);
    add('correction', /(đâu phải|nhầm rồi|sai rồi|ủa .* mà)/);
    add('topic_switch', /thôi (giờ|bây giờ)/);
    if (/(=\)\)|:\)\)|quên mất)/.test(t) && !s.has('loss_serious') && !s.has('vent')) s.add('tease');
    if (t.length >= 12 && t.split(/\s+/).length >= 3 && /[a-z]/.test(t) && !HAS_DIACRITIC.test(t)) s.add('no_diacritics');
    return s;
}

/** Mẫu nền ngắn để giữ nhịp khi tin nhắn ít tín hiệu */
const BASE_IDS = ['02', '11', '16', '14'];
/** Lúc người dùng buồn / bực / chưa muốn kể thì không đưa mẫu trêu đùa */
const NO_TEASE: DialogueTag[] = ['loss_serious', 'vent', 'silence'];

export function pickExamples(profile: CompanionProfile, userText: string, n = 5): Dialogue[] {
    const signals = detectSignals(userText);
    const want = isTaoMay(profile) ? 't-m' : 'minh-ban';
    const avoidTease = NO_TEASE.some(tag => signals.has(tag));
    const pool = DIALOGUES.filter(d => d.promptable !== false && !(avoidTease && d.tags.includes('tease')));

    const matched = pool
        .map((d, i) => ({ d, i, hits: d.tags.filter(tag => signals.has(tag)).length }))
        .filter(x => x.hits > 0)
        .map(x => ({ ...x, score: x.hits * 3 + (x.d.pronoun === want ? 1 : 0) }))
        .sort((a, b) => b.score - a.score || a.i - b.i)
        .map(x => x.d);

    const out = matched.slice(0, n - 1);
    for (const id of BASE_IDS) {
        if (out.length >= n || (out.length >= 4 && out.some(d => BASE_IDS.includes(d.id)))) break;
        const d = pool.find(x => x.id === id);
        if (d && !out.includes(d)) out.push(d);
    }
    return out;
}

export function renderExamplesBlock(examples: Dialogue[], p: CompanionProfile): string {
    if (!examples.length) return '';
    const lines = [
        `💬 VÍ DỤ NHỊP TRẢ LỜI — học độ ngắn, cách đáp đúng ý, KHÔNG chép nguyên câu. Xưng hô trong ví dụ chỉ để minh hoạ: bạn luôn xưng "${p.selfPronoun}" gọi "${p.userPronoun}" trừ khi người dùng đổi.`,
    ];
    for (const d of examples) {
        lines.push('', `[${d.title}]`);
        for (const t of d.turns) lines.push(`Người dùng: ${t.user}`, `Bạn: ${t.ai}`);
    }
    return lines.join('\n');
}

/** Khối ví dụ hoàn chỉnh cho lượt hiện tại ('' nếu không có tin nhắn) */
export function companionExamplesBlock(p: CompanionProfile, userText: string | undefined, n = 5): string {
    return renderExamplesBlock(pickExamples(p, userText || '', n), p);
}
