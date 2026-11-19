// File: api/_lib/aiQuota.js
// Xác thực người dùng + hạn mức AI dùng chung cho /api/gemini và /api/search.
// Đọc env lúc gọi hàm (không phải lúc nạp module) để plugin dev của Vite nạp env trước được.

import { createClient } from '@supabase/supabase-js';

export const QUOTA_LIMITS = {
    free: { requests_per_day: 0, tokens_per_day: 0, tokens_per_month: 0 },
    trial: { requests_per_day: 3, tokens_per_day: 30000, tokens_per_month: Infinity },
    pro: { requests_per_day: 10, tokens_per_day: 50000, tokens_per_month: 600000 },
    lifetime: { requests_per_day: 10, tokens_per_day: 50000, tokens_per_month: 600000 },
};

export const OWNER_EMAIL = 'baquan3q@gmail.com';

function supabaseEnv() {
    return {
        url: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
        anonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
}

// Gói thực tế của người dùng (tính cả 3 ngày gia hạn)
export function determineActualPlan(profile, email, now = new Date()) {
    if (email === OWNER_EMAIL) return 'lifetime';
    if (!profile) return 'free';
    if (profile.plan === 'lifetime') return 'lifetime';

    if (profile.plan === 'trial' && profile.trial_started_at) {
        const graceEnd = new Date(profile.trial_started_at);
        graceEnd.setDate(graceEnd.getDate() + 7 + 3);
        if (now < graceEnd) return 'trial';
    }

    if (profile.plan === 'pro' && profile.pro_expiry_date) {
        const graceEnd = new Date(profile.pro_expiry_date);
        graceEnd.setDate(graceEnd.getDate() + 3);
        if (now < graceEnd) return 'pro';
    }

    return 'free';
}

// Xác thực bằng JWT Supabase gửi từ client.
// `db` dùng để ghi quota/boost: ưu tiên service role (người dùng không tự sửa được hạn mức),
// thiếu key đó thì dùng client theo token người dùng như trước.
export async function authenticate(req) {
    const { url, anonKey, serviceKey } = supabaseEnv();
    const result = { userId: null, userEmail: null, plan: 'free', userClient: null, db: null };
    if (!url || !anonKey) return result;

    const authHeader = req.headers?.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return result;
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) return result;

    const userClient = createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await userClient.auth.getUser(token);
    const user = data?.user;
    if (!user) return result;

    const { data: profile } = await userClient
        .from('profiles')
        .select('plan, pro_expiry_date, trial_started_at')
        .eq('id', user.id)
        .single();

    const db = serviceKey
        ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
        : userClient;

    return { userId: user.id, userEmail: user.email, plan: determineActualPlan(profile, user.email), userClient, db };
}

export function quotaKeys(now = new Date()) {
    return {
        todayStr: now.toISOString().split('T')[0],
        monthKey: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    };
}

export async function loadUsage(db, userId, now = new Date()) {
    const { todayStr, monthKey } = quotaKeys(now);
    const usage = { todayStr, monthKey, requestsToday: 0, tokensToday: 0, tokensMonth: 0 };
    if (!db || !userId) return usage;

    const [{ data: today }, { data: month }] = await Promise.all([
        db.from('user_ai_quota').select('requests_today, tokens_today').eq('user_id', userId).eq('date', todayStr).maybeSingle(),
        db.from('user_ai_quota').select('tokens_today').eq('user_id', userId).eq('month_key', monthKey),
    ]);
    usage.requestsToday = Number(today?.requests_today || 0);
    usage.tokensToday = Number(today?.tokens_today || 0);
    usage.tokensMonth = (month || []).reduce((sum, row) => sum + Number(row.tokens_today || 0), 0);
    return usage;
}

const TIER_LABEL = { lite: 'Siêu nhanh', fast: 'Nhanh', balanced: 'Nghĩ vừa', deep: 'Nghĩ sâu' };

// Quyết định có cho gọi không (hàm thuần, không I/O — để test).
// weight: số lượt câu hỏi này tiêu tốn (0 với lệnh gọi con/nội bộ).
// Trả về null nếu trong hạn mức, ngược lại { status, body } để trả cho client
// (handler vẫn thử Boost Pack trước khi chặn).
export function evaluateQuota({ limits, usage, weight, tier }) {
    const remaining = Math.max(0, limits.requests_per_day - usage.requestsToday);

    if (weight > 0 && usage.requestsToday + weight > limits.requests_per_day) {
        if (remaining > 0 && tier && weight > 1) {
            const cheaper = Object.entries({ balanced: 2, fast: 1 })
                .filter(([, w]) => w <= remaining)
                .map(([t]) => TIER_LABEL[t]);
            return {
                status: 429,
                body: {
                    error: 'quota_exceeded',
                    type: 'tier_requests_exceeded',
                    remaining,
                    needed: weight,
                    message: `Chế độ ${TIER_LABEL[tier]} cần ${weight} lượt nhưng hôm nay bạn chỉ còn ${remaining} lượt. Hãy chuyển sang ${cheaper.join(' hoặc ')} để tiếp tục nhé! ⚡`,
                },
            };
        }
        return {
            status: 429,
            body: {
                error: 'quota_exceeded',
                type: 'daily_requests_exceeded',
                remaining: 0,
                message: `Bạn đã dùng hết ${limits.requests_per_day} lượt yêu cầu AI hôm nay. Vui lòng mua thêm gói AI Boost Pack hoặc quay lại vào ngày mai! ⏰`,
            },
        };
    }

    if (usage.tokensToday >= limits.tokens_per_day) {
        return {
            status: 429,
            body: {
                error: 'quota_exceeded',
                type: 'daily_tokens_exceeded',
                message: `Bạn đã dùng hết giới hạn ${limits.tokens_per_day.toLocaleString('vi-VN')} token hôm nay. Vui lòng mua thêm gói AI Boost Pack hoặc quay lại vào ngày mai! ⚡`,
            },
        };
    }

    if (limits.tokens_per_month !== Infinity && usage.tokensMonth >= limits.tokens_per_month) {
        return {
            status: 429,
            body: {
                error: 'quota_exceeded',
                type: 'monthly_tokens_exceeded',
                message: `Bạn đã dùng hết giới hạn ${limits.tokens_per_month.toLocaleString('vi-VN')} token của tháng này. Vui lòng mua thêm gói AI Boost Pack để tiếp tục sử dụng! 🚀`,
            },
        };
    }

    return null;
}

export const FREE_GATE = {
    status: 403,
    body: {
        error: 'quota_exceeded',
        type: 'free_gate',
        message: 'Gói Free không bao gồm quyền truy cập AI. Vui lòng nâng cấp lên gói Pro để sử dụng tính năng này! 👑',
    },
};

// Kiểm tra (tokensToDeduct = 0) hoặc trừ token từ các gói AI Boost Pack, FIFO theo ngày mua
export async function checkAndConsumeBoostTokens(db, userId, tokensToDeduct) {
    if (!db || !userId) return false;

    const { data: boosts, error } = await db
        .from('user_ai_boost')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('purchased_at', { ascending: true });

    if (error || !boosts || boosts.length === 0) return false;

    if (tokensToDeduct === 0) {
        const totalRemaining = boosts.reduce((sum, b) => sum + (Number(b.tokens_total) - Number(b.tokens_used)), 0);
        return totalRemaining > 0;
    }

    let remainingToDeduct = tokensToDeduct;
    for (const boost of boosts) {
        const available = Number(boost.tokens_total) - Number(boost.tokens_used);
        if (available <= 0) continue;

        if (remainingToDeduct <= available) {
            const newUsed = Number(boost.tokens_used) + remainingToDeduct;
            await db
                .from('user_ai_boost')
                .update({ tokens_used: newUsed, status: newUsed >= Number(boost.tokens_total) ? 'exhausted' : 'active' })
                .eq('id', boost.id);
            remainingToDeduct = 0;
            break;
        }
        await db
            .from('user_ai_boost')
            .update({ tokens_used: boost.tokens_total, status: 'exhausted' })
            .eq('id', boost.id);
        remainingToDeduct -= available;
    }

    return remainingToDeduct === 0;
}

// Kiểm tra hạn mức; vượt mà còn Boost Pack thì vẫn cho qua.
// Trả về { blocked: {status, body} } hoặc { usingBoost }.
export async function enforceQuota({ auth, usage, weight, tier }) {
    const limits = QUOTA_LIMITS[auth.plan] || QUOTA_LIMITS.free;
    const verdict = evaluateQuota({ limits, usage, weight, tier });
    if (!verdict) return { usingBoost: false, limits };
    const hasBoost = await checkAndConsumeBoostTokens(auth.db, auth.userId, 0);
    if (!hasBoost) return { blocked: verdict, limits };
    return { usingBoost: true, limits };
}

// Ghi lượt + token sau khi gọi xong. Đọc lại dòng hôm nay ngay trước khi ghi
// để giảm lệch khi có nhiều yêu cầu chạy song song (stream dài).
export async function recordUsage({ auth, usage, weight, tokens, usingBoost }) {
    if (!auth.db || !auth.userId) return;
    const { data: fresh } = await auth.db
        .from('user_ai_quota')
        .select('requests_today, tokens_today')
        .eq('user_id', auth.userId)
        .eq('date', usage.todayStr)
        .maybeSingle();

    const { error } = await auth.db
        .from('user_ai_quota')
        .upsert({
            user_id: auth.userId,
            date: usage.todayStr,
            requests_today: Number(fresh?.requests_today ?? usage.requestsToday) + weight,
            tokens_today: Number(fresh?.tokens_today ?? usage.tokensToday) + tokens,
            month_key: usage.monthKey,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,date' });

    if (error) console.error('[SmartLife AI] ❌ Quota upsert error:', error.message);

    if (usingBoost && tokens > 0) {
        await checkAndConsumeBoostTokens(auth.db, auth.userId, tokens);
    }
}
