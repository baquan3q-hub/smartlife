// File: src/services/companionService.ts
// Lưu / đọc hồ sơ "Bạn đồng hành" (bảng ai_companions — sql/ai_companion_persona.sql).
// Bảng chưa tạo hoặc mạng lỗi thì dùng localStorage để app không vỡ; khi bảng có, lần lưu sau sẽ đồng bộ lên.

import { supabase } from './supabase';
import { sanitizeCompanion, type CompanionProfile } from './ai/companion/types';

const localKey = (userId: string) => `smartlife_companion_${userId}`;

function readLocal(userId: string): any | null {
    try {
        const raw = localStorage.getItem(localKey(userId));
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function writeLocal(userId: string, profile: CompanionProfile) {
    try { localStorage.setItem(localKey(userId), JSON.stringify(profile)); } catch { /* hết dung lượng / chế độ riêng tư */ }
}

/** Đọc hồ sơ; null = người dùng chưa tạo bạn AI */
export async function loadCompanion(userId: string, profileAge?: number | null): Promise<CompanionProfile | null> {
    const local = readLocal(userId);
    try {
        const { data, error } = await supabase
            .from('ai_companions')
            .select('profile, adult_confirmed_at, last_greeted_on')
            .eq('user_id', userId)
            .maybeSingle();
        if (error) throw error;
        if (data) {
            const merged = {
                ...data.profile,
                adultConfirmedAt: data.adult_confirmed_at || null,
                // lấy ngày chào mới hơn giữa DB và máy (máy có thể đã chào khi DB lỗi)
                lastGreetedOn: [data.last_greeted_on, local?.lastGreetedOn].filter(Boolean).sort().pop() || null,
            };
            const profile = sanitizeCompanion(merged, { profileAge });
            writeLocal(userId, profile);
            return profile;
        }
    } catch (e) {
        console.warn('[SmartLife] Chưa đọc được ai_companions, dùng bản lưu trên máy:', (e as any)?.message || e);
    }
    return local ? sanitizeCompanion(local, { profileAge }) : null;
}

/** Lưu hồ sơ (đã làm sạch) — luôn ghi máy trước, rồi đồng bộ Supabase */
export async function saveCompanion(userId: string, raw: Partial<CompanionProfile>, profileAge?: number | null): Promise<CompanionProfile> {
    const profile = sanitizeCompanion(raw, { profileAge });
    writeLocal(userId, profile);
    const { adultConfirmedAt, lastGreetedOn, ...rest } = profile;
    try {
        const { error } = await supabase.from('ai_companions').upsert({
            user_id: userId,
            profile: rest,
            adult_confirmed_at: adultConfirmedAt,
            last_greeted_on: lastGreetedOn || null,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        if (error) throw error;
    } catch (e) {
        console.warn('[SmartLife] Chưa lưu được ai_companions lên máy chủ (đã lưu trên máy):', (e as any)?.message || e);
    }
    return profile;
}

/** Đánh dấu đã chào hôm nay */
export async function markGreeted(userId: string, profile: CompanionProfile, dateKey: string): Promise<CompanionProfile> {
    const next = { ...profile, lastGreetedOn: dateKey };
    writeLocal(userId, next);
    try {
        await supabase.from('ai_companions').update({ last_greeted_on: dateKey }).eq('user_id', userId);
    } catch { /* đã lưu trên máy */ }
    return next;
}

/** Có nên gửi lời chào chủ động không: đã bật và hôm nay chưa chào */
export function shouldGreet(profile: CompanionProfile | null, todayKey: string): boolean {
    return !!profile && profile.greetingEnabled && profile.lastGreetedOn !== todayKey;
}
