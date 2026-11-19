// File: src/services/ai/companion/types.ts
// Hồ sơ "Bạn đồng hành": tên, giới tính, kiểu quan hệ, xưng hô, tính cách, phong cách nói của AI.
// File thuần (không import Supabase/React) để dùng chung cho app, test và scripts/ai-eval.

export type CompanionGender = 'female' | 'male' | 'neutral';
export type CompanionRelationship = 'friend' | 'senior' | 'mentor' | 'study_buddy' | 'sweetheart';
export type EmojiLevel = 'none' | 'few' | 'many';
export type ReplyLength = 'tiny' | 'short';
export type TraitId =
    | 'funny' | 'gentle' | 'direct' | 'optimistic' | 'calm' | 'playful'
    | 'caring' | 'encouraging' | 'curious' | 'witty' | 'patient' | 'energetic';
export type AvatarId = 'cloud' | 'cat' | 'sun' | 'moon' | 'leaf' | 'star' | 'fox' | 'wave';

export interface CompanionProfile {
    name: string;
    gender: CompanionGender;
    relationship: CompanionRelationship;
    /** AI tự xưng */
    selfPronoun: string;
    /** AI gọi người dùng */
    userPronoun: string;
    traits: TraitId[];
    emoji: EmojiLevel;
    length: ReplyLength;
    interests: string;
    backstory: string;
    avatar: AvatarId;
    /** Cho phép nhắn hỏi thăm trước khi mở trang AI (mỗi ngày một lần) */
    greetingEnabled: boolean;
    /** Thời điểm người dùng tự xác nhận đủ 18 tuổi — bắt buộc cho kiểu "Người thương" */
    adultConfirmedAt: string | null;
    /** Ngày (giờ VN, YYYY-MM-DD) đã gửi lời chào gần nhất */
    lastGreetedOn?: string | null;
}

export const NAME_MAX = 24;
export const TEXT_MAX = 200;
export const MIN_TRAITS = 1;
export const MAX_TRAITS = 4;

export const GENDERS: Array<{ id: CompanionGender; label: string }> = [
    { id: 'female', label: 'Nữ' },
    { id: 'male', label: 'Nam' },
    { id: 'neutral', label: 'Không xác định' },
];

export interface RelationshipOption {
    id: CompanionRelationship;
    label: string;
    hint: string;
    /** Chỉ mở khi đã xác nhận đủ 18 tuổi */
    adultOnly?: boolean;
}

export const RELATIONSHIPS: RelationshipOption[] = [
    { id: 'friend', label: 'Bạn thân', hint: 'Nói chuyện thoải mái, trêu đùa, lắng nghe' },
    { id: 'study_buddy', label: 'Bạn cùng học', hint: 'Cùng ôn bài, nhắc deadline, giữ động lực' },
    { id: 'senior', label: 'Anh/chị khoá trên', hint: 'Từng trải, chia sẻ kinh nghiệm học và sống' },
    { id: 'mentor', label: 'Người cố vấn', hint: 'Điềm tĩnh, gợi mở, giúp bạn tự nghĩ ra hướng đi' },
    { id: 'sweetheart', label: 'Người thương', hint: 'Ấm áp, quan tâm — không có nội dung tình dục', adultOnly: true },
];

export interface TraitOption {
    id: TraitId;
    label: string;
    /** Cách thể hiện trong lời nói — đưa vào prompt */
    howTo: string;
}

export const TRAITS: TraitOption[] = [
    { id: 'funny', label: 'Hài hước', howTo: 'hay pha trò nhẹ, đùa đúng lúc (không đùa khi người dùng đang buồn)' },
    { id: 'gentle', label: 'Dịu dàng', howTo: 'lời lẽ mềm mại, từ tốn, không gay gắt' },
    { id: 'direct', label: 'Thẳng thắn', howTo: 'nói thật, rõ ràng, góp ý thẳng nhưng tôn trọng' },
    { id: 'optimistic', label: 'Lạc quan', howTo: 'nhìn mặt tích cực, nhưng không gạt đi cảm xúc tiêu cực của người dùng' },
    { id: 'calm', label: 'Điềm tĩnh', howTo: 'bình thản, chậm rãi, giúp người dùng hạ nhiệt' },
    { id: 'playful', label: 'Tinh nghịch', howTo: 'hay trêu nhẹ, dùng từ lóng thân thiện của giới trẻ vừa phải' },
    { id: 'caring', label: 'Chu đáo', howTo: 'để ý chi tiết, hỏi han chuyện ăn ngủ, sức khoẻ' },
    { id: 'encouraging', label: 'Hay động viên', howTo: 'ghi nhận cố gắng nhỏ, khích lệ cụ thể (không khen chung chung)' },
    { id: 'curious', label: 'Tò mò', howTo: 'thích hỏi thêm chi tiết về chuyện của người dùng' },
    { id: 'witty', label: 'Lém lỉnh', howTo: 'trả lời nhanh, chơi chữ, dí dỏm' },
    { id: 'patient', label: 'Kiên nhẫn', howTo: 'không vội, sẵn sàng nghe kể lại nhiều lần' },
    { id: 'energetic', label: 'Năng động', howTo: 'giọng hào hứng, rủ rê làm việc ngay' },
];

export interface AvatarOption {
    id: AvatarId;
    emoji: string;
    /** Hai màu gradient nền (hex) */
    from: string;
    to: string;
}

export const AVATARS: AvatarOption[] = [
    { id: 'cloud', emoji: '☁️', from: '#bae6fd', to: '#818cf8' },
    { id: 'cat', emoji: '🐱', from: '#fde68a', to: '#fb923c' },
    { id: 'sun', emoji: '🌻', from: '#fef08a', to: '#f59e0b' },
    { id: 'moon', emoji: '🌙', from: '#c7d2fe', to: '#6366f1' },
    { id: 'leaf', emoji: '🍀', from: '#bbf7d0', to: '#10b981' },
    { id: 'star', emoji: '⭐', from: '#fbcfe8', to: '#a855f7' },
    { id: 'fox', emoji: '🦊', from: '#fed7aa', to: '#ef4444' },
    { id: 'wave', emoji: '🌊', from: '#a5f3fc', to: '#0284c7' },
];

export const SELF_PRONOUNS = ['mình', 'tớ', 'anh', 'chị', 'em', 't'];
export const USER_PRONOUNS = ['bạn', 'cậu', 'em', 'anh', 'chị', 'm'];
/** Nhãn hiển thị cho xưng hô viết tắt */
export const PRONOUN_LABEL: Record<string, string> = { t: 't (tao)', m: 'm (mày)' };

/** Cặp t–m (tao–mày) chỉ hợp vai ngang hàng: bạn thân, bạn cùng học */
export const canUseTaoMay = (relationship: CompanionRelationship) => relationship === 'friend' || relationship === 'study_buddy';

export const EMOJI_LEVELS: Array<{ id: EmojiLevel; label: string }> = [
    { id: 'none', label: 'Không' },
    { id: 'few', label: 'Thỉnh thoảng' },
    { id: 'many', label: 'Nhiều' },
];

export const REPLY_LENGTHS: Array<{ id: ReplyLength; label: string; hint: string }> = [
    { id: 'tiny', label: 'Rất ngắn', hint: '1–2 câu, như nhắn tin' },
    { id: 'short', label: 'Ngắn', hint: '2–4 câu' },
];

/** Xưng hô gợi ý theo giới tính + kiểu quan hệ (người dùng sửa được) */
export function defaultPronouns(gender: CompanionGender, relationship: CompanionRelationship): { selfPronoun: string; userPronoun: string } {
    switch (relationship) {
        case 'senior':
            return { selfPronoun: gender === 'male' ? 'anh' : gender === 'female' ? 'chị' : 'mình', userPronoun: 'em' };
        case 'mentor':
            return gender === 'neutral'
                ? { selfPronoun: 'mình', userPronoun: 'bạn' }
                : { selfPronoun: gender === 'male' ? 'anh' : 'chị', userPronoun: 'em' };
        case 'sweetheart':
            return gender === 'male' ? { selfPronoun: 'anh', userPronoun: 'em' } : { selfPronoun: 'tớ', userPronoun: 'cậu' };
        default:
            return { selfPronoun: 'tớ', userPronoun: 'cậu' };
    }
}

export const DEFAULT_COMPANION: CompanionProfile = {
    name: 'Mây',
    gender: 'female',
    relationship: 'friend',
    selfPronoun: 'tớ',
    userPronoun: 'cậu',
    traits: ['caring', 'funny', 'encouraging'],
    emoji: 'few',
    length: 'tiny',
    interests: '',
    backstory: '',
    avatar: 'cloud',
    greetingEnabled: true,
    adultConfirmedAt: null,
    lastGreetedOn: null,
};

// Từ ngữ tình dục / thô tục / thù ghét — không cho đặt vào tên, sở thích, tiểu sử
const BLOCKED = /(?<![\p{L}\p{N}])(?:sex|sexy|tình dục|làm tình|quan hệ tình dục|khiêu dâm|porn\w*|nude|khoả thân|khỏa thân|hentai|xxx|nứng|dâm đãng|dâm dục|địt|đụ|lồn|cặc|buồi|đĩ|điếm|phò|nazi|giết người)(?![\p{L}\p{N}])/iu;

export function hasBlockedContent(text: string): boolean {
    return BLOCKED.test((text || '').normalize('NFC'));
}

const cleanText = (v: unknown, max: number) =>
    typeof v === 'string'
        ? v.normalize('NFC').replace(/[\u0000-\u001f\u007f<>{}`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
        : '';

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
    typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

/** Người dùng đã được phép chọn "Người thương" chưa (tự xác nhận 18+, và tuổi trong hồ sơ — nếu có — không dưới 18) */
export function canUseSweetheart(adultConfirmedAt: string | null | undefined, profileAge?: number | null): boolean {
    if (typeof profileAge === 'number' && profileAge > 0 && profileAge < 18) return false;
    return !!adultConfirmedAt;
}

/**
 * Chuẩn hoá hồ sơ từ form / DB: cắt độ dài, chặn nội dung không phù hợp,
 * và hạ "Người thương" về "Bạn thân" nếu chưa đủ điều kiện tuổi.
 */
export function sanitizeCompanion(raw: any, opts: { profileAge?: number | null } = {}): CompanionProfile {
    const d = DEFAULT_COMPANION;
    const gender = pick(raw?.gender, GENDERS.map(g => g.id), d.gender);
    let relationship = pick(raw?.relationship, RELATIONSHIPS.map(r => r.id), d.relationship);
    const adultConfirmedAt = typeof raw?.adultConfirmedAt === 'string' && raw.adultConfirmedAt ? raw.adultConfirmedAt : null;
    if (relationship === 'sweetheart' && !canUseSweetheart(adultConfirmedAt, opts.profileAge)) relationship = 'friend';

    let name = cleanText(raw?.name, NAME_MAX);
    if (!name || hasBlockedContent(name)) name = d.name;

    const fallback = defaultPronouns(gender, relationship);
    let selfPronoun = cleanText(raw?.selfPronoun, 12).toLowerCase();
    let userPronoun = cleanText(raw?.userPronoun, 12).toLowerCase();
    // t–m phải đi thành cặp và chỉ cho vai ngang hàng; sai thì về xưng hô gợi ý
    const tm = selfPronoun === 't' || userPronoun === 'm';
    if (tm && !(selfPronoun === 't' && userPronoun === 'm' && canUseTaoMay(relationship))) {
        selfPronoun = fallback.selfPronoun;
        userPronoun = fallback.userPronoun;
    }

    const traitIds = TRAITS.map(t => t.id);
    const traits = Array.isArray(raw?.traits)
        ? [...new Set(raw.traits.filter((t: unknown): t is TraitId => typeof t === 'string' && (traitIds as string[]).includes(t)))].slice(0, MAX_TRAITS) as TraitId[]
        : [];

    const interests = cleanText(raw?.interests, TEXT_MAX);
    const backstory = cleanText(raw?.backstory, TEXT_MAX);

    return {
        name,
        gender,
        relationship,
        selfPronoun: SELF_PRONOUNS.includes(selfPronoun) && !hasBlockedContent(selfPronoun) ? selfPronoun : fallback.selfPronoun,
        userPronoun: USER_PRONOUNS.includes(userPronoun) ? userPronoun : fallback.userPronoun,
        traits: traits.length >= MIN_TRAITS ? traits : d.traits,
        emoji: pick(raw?.emoji, EMOJI_LEVELS.map(e => e.id), d.emoji),
        length: pick(raw?.length, REPLY_LENGTHS.map(l => l.id), d.length),
        interests: hasBlockedContent(interests) ? '' : interests,
        backstory: hasBlockedContent(backstory) ? '' : backstory,
        avatar: pick(raw?.avatar, AVATARS.map(a => a.id), d.avatar),
        greetingEnabled: raw?.greetingEnabled !== false,
        adultConfirmedAt,
        lastGreetedOn: typeof raw?.lastGreetedOn === 'string' ? raw.lastGreetedOn : null,
    };
}

export const getAvatar = (id: AvatarId | string | undefined): AvatarOption => AVATARS.find(a => a.id === id) || AVATARS[0];
export const relationshipLabel = (id: CompanionRelationship) => RELATIONSHIPS.find(r => r.id === id)?.label || 'Bạn thân';
export const traitLabels = (ids: TraitId[]) => ids.map(id => TRAITS.find(t => t.id === id)?.label).filter(Boolean) as string[];

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Câu chào xem trước trong trình thiết lập — dựng bằng mẫu, không gọi AI */
export function previewGreeting(p: CompanionProfile): string {
    const e = p.emoji === 'none' ? '' : p.emoji === 'many' ? ' 🥰✨' : ' 😊';
    const hasTrait = (t: TraitId) => p.traits.includes(t);
    const opener = hasTrait('playful') || hasTrait('energetic') ? 'Ê' : 'Chào';
    const tail = hasTrait('caring')
        ? `Hôm nay ${p.userPronoun} ăn uống gì chưa, có mệt không?`
        : hasTrait('curious')
            ? `Kể ${p.selfPronoun} nghe hôm nay của ${p.userPronoun} thế nào đi?`
            : `Hôm nay ${p.userPronoun} thấy sao?`;
    return `${opener} ${p.userPronoun}! ${capitalize(p.selfPronoun)} là ${p.name} nè${e}\n\n${tail}`;
}

/**
 * Tách câu trả lời của bạn AI thành các bong bóng nhỏ theo dòng trống (tối đa 3).
 * Có danh sách / bảng (vd. số đường dây hỗ trợ) hoặc quá nhiều đoạn thì giữ nguyên một bong bóng.
 */
export function splitCompanionMessage(text: string, max = 3): string[] {
    const parts = (text || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    if (parts.length <= 1) return parts.length ? parts : [];
    if (parts.length > max || parts.some(p => /^\s*(?:[-*•]|\d+[.)]|\|)/m.test(p))) return [text.trim()];
    return parts;
}
