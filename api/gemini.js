// File: api/gemini.js
// Vercel Serverless Function — Proxy cho Gemini API với Quota Enforcement & Token Tracking
// API key được giữ an toàn phía server (process.env.GEMINI_API_KEYS)

import { createClient } from '@supabase/supabase-js';

const MODEL = 'gemini-2.5-flash';

// Khởi tạo Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Quota config cho từng plan
const QUOTA_LIMITS = {
    free: { requests_per_day: 0, tokens_per_day: 0, tokens_per_month: 0 },
    trial: { requests_per_day: 3, tokens_per_day: 30000, tokens_per_month: Infinity },
    pro: { requests_per_day: 10, tokens_per_day: 50000, tokens_per_month: 600000 },
    lifetime: { requests_per_day: 10, tokens_per_day: 50000, tokens_per_month: 600000 },
};

// Đọc API keys từ server environment (KHÔNG có prefix VITE_)
function getApiKeys() {
    const envKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    return envKeys.split(',').map(k => k.trim()).filter(Boolean);
}

// Key rotation index (reset mỗi cold start — chấp nhận được cho serverless)
let currentKeyIndex = 0;

async function callGeminiWithRetry(body, retryCount = 0) {
    const keys = getApiKeys();
    if (keys.length === 0) {
        throw new Error('GEMINI_API_KEYS chưa được cấu hình trên server.');
    }

    const key = keys[currentKeyIndex % keys.length];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const status = res.status;
        const err = await res.json().catch(() => ({}));

        // Retry với key rotation cho các lỗi tạm thời
        if ((status === 429 || status === 403 || status === 500 || status === 503 || status === 504)
            && retryCount < Math.max(3, keys.length)) {
            if (keys.length > 1) {
                currentKeyIndex++;
                console.warn(`[SmartLife Proxy] Status ${status}. Rotating to key #${(currentKeyIndex % keys.length) + 1}...`);
            }
            const delay = 1500 * (retryCount + 1);
            await new Promise(r => setTimeout(r, delay));
            return callGeminiWithRetry(body, retryCount + 1);
        }

        // Trả lỗi cho client (KHÔNG bao gồm API key)
        const errorMessage = err?.error?.message || `Gemini API Error ${status}`;
        const error = new Error(errorMessage);
        error.status = status;
        throw error;
    }

    return res.json();
}

// Hàm xác định gói của user
function determineActualPlan(profile, email) {
    if (email === 'baquan3q@gmail.com') return 'lifetime';
    if (!profile) return 'free';
    if (profile.plan === 'lifetime') return 'lifetime';
    
    const now = new Date();
    
    if (profile.plan === 'trial' && profile.trial_started_at) {
        const trialStart = new Date(profile.trial_started_at);
        const trialEnd = new Date(trialStart);
        trialEnd.setDate(trialEnd.getDate() + 7);
        const graceEnd = new Date(trialEnd);
        graceEnd.setDate(graceEnd.getDate() + 3); // 3 ngày grace
        
        if (now < graceEnd) return 'trial';
    }
    
    if (profile.plan === 'pro' && profile.pro_expiry_date) {
        const expiryDate = new Date(profile.pro_expiry_date);
        const graceEnd = new Date(expiryDate);
        graceEnd.setDate(graceEnd.getDate() + 3); // 3 ngày grace
        
        if (now < graceEnd) return 'pro';
    }
    
    return 'free';
}

// Logic kiểm tra và trừ token từ các gói AI Boost Packs (Phase 5)
async function checkAndConsumeBoostTokens(supabaseClient, userId, tokensToDeduct) {
    if (!supabaseClient) return false;
    
    const { data: boosts, error } = await supabaseClient
        .from('user_ai_boost')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('purchased_at', { ascending: true }); // FIFO
        
    if (error || !boosts || boosts.length === 0) return false;
    
    // Nếu chỉ kiểm tra khả dụng (tokensToDeduct === 0)
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
            const status = newUsed >= Number(boost.tokens_total) ? 'exhausted' : 'active';
            await supabaseClient
                .from('user_ai_boost')
                .update({ tokens_used: newUsed, status })
                .eq('id', boost.id);
            remainingToDeduct = 0;
            break;
        } else {
            await supabaseClient
                .from('user_ai_boost')
                .update({ tokens_used: boost.tokens_total, status: 'exhausted' })
                .eq('id', boost.id);
            remainingToDeduct -= available;
        }
    }
    
    return remainingToDeduct === 0;
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    // Chỉ cho phép POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    // Kiểm tra API key đã cấu hình chưa
    const keys = getApiKeys();
    if (keys.length === 0) {
        return res.status(500).json({
            error: 'API key chưa được cấu hình. Hãy thêm GEMINI_API_KEYS vào Vercel Environment Variables.'
        });
    }

    let userId = null;
    let userPlan = 'free';
    let userEmail = null;
    let supabaseClient = supabase;

    // 1. Authenticate user bằng JWT token gửi từ client
    if (supabaseUrl && supabaseAnonKey) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            
            // Khởi tạo Supabase client scoped với token của user để vượt qua RLS
            supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            });

            const { data: { user }, error } = await supabaseClient.auth.getUser(token);
            if (user) {
                userId = user.id;
                userEmail = user.email;
                
                // Lấy plan từ database
                const { data: profile } = await supabaseClient
                    .from('profiles')
                    .select('plan, pro_expiry_date, trial_started_at')
                    .eq('id', userId)
                    .single();
                    
                userPlan = determineActualPlan(profile, userEmail);
            }
        }
    }

    // 2. Chặn nếu là user Free
    if (userPlan === 'free') {
        return res.status(403).json({
            error: 'quota_exceeded',
            type: 'free_gate',
            message: 'Gói Free không bao gồm quyền truy cập AI. Vui lòng nâng cấp lên gói Pro để sử dụng tính năng này! 👑'
        });
    }

    // 3. Truy cập dữ liệu quota hiện tại
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const limits = QUOTA_LIMITS[userPlan];

    let usage = null;
    let totalTokensMonth = 0;

    if (supabaseClient && userId) {
        const { data } = await supabaseClient
            .from('user_ai_quota')
            .select('*')
            .eq('user_id', userId)
            .eq('date', todayStr)
            .maybeSingle();
        usage = data;

        const { data: monthData } = await supabaseClient
            .from('user_ai_quota')
            .select('tokens_today')
            .eq('user_id', userId)
            .eq('month_key', monthKey);
        
        totalTokensMonth = (monthData || []).reduce((sum, row) => sum + Number(row.tokens_today || 0), 0);
    }

    const todayRequests = usage ? usage.requests_today : 0;
    const todayTokens = usage ? usage.tokens_today : 0;

    // 4. Kiểm tra giới hạn số lượt yêu cầu trong ngày (daily requests)
    if (todayRequests >= limits.requests_per_day) {
        return res.status(429).json({
            error: 'quota_exceeded',
            type: 'daily_requests_exceeded',
            message: `Bạn đã dùng hết ${limits.requests_per_day} lượt yêu cầu AI hôm nay. Vui lòng quay lại vào ngày mai! ⏰`
        });
    }

    // 5. Kiểm tra giới hạn token hàng ngày (daily tokens)
    if (todayTokens >= limits.tokens_per_day) {
        return res.status(429).json({
            error: 'quota_exceeded',
            type: 'daily_tokens_exceeded',
            message: `Bạn đã dùng hết giới hạn ${limits.tokens_per_day.toLocaleString()} token hôm nay. Vui lòng quay lại vào ngày mai! ⚡`
        });
    }

    // 6. Kiểm tra giới hạn token hàng tháng (monthly tokens)
    let isMonthlyExceeded = limits.tokens_per_month !== Infinity && totalTokensMonth >= limits.tokens_per_month;
    let usingBoost = false;

    if (isMonthlyExceeded) {
        // Nếu vượt hạn tháng, kiểm tra xem có Boost Pack không
        const hasBoost = await checkAndConsumeBoostTokens(supabaseClient, userId, 0);
        if (!hasBoost) {
            return res.status(429).json({
                error: 'quota_exceeded',
                type: 'monthly_tokens_exceeded',
                message: `Bạn đã dùng hết giới hạn ${limits.tokens_per_month.toLocaleString()} token của tháng này. Vui lòng mua thêm gói AI Boost Pack để tiếp tục sử dụng! 🚀`
            });
        }
        usingBoost = true;
    }

    try {
        const { contents, systemInstruction, generationConfig, safetySettings, tools, toolConfig } = req.body;

        if (!contents || !Array.isArray(contents)) {
            return res.status(400).json({ error: 'Thiếu trường "contents" trong request body.' });
        }

        // Xây dựng body gửi tới Gemini API
        const geminiBody = { contents };
        if (systemInstruction) geminiBody.systemInstruction = systemInstruction;
        if (generationConfig) geminiBody.generationConfig = generationConfig;
        if (safetySettings) geminiBody.safetySettings = safetySettings;
        if (tools) geminiBody.tools = tools;
        if (toolConfig) geminiBody.toolConfig = toolConfig;

        // Gọi Gemini API
        const data = await callGeminiWithRetry(geminiBody);

        // 7. Ghi nhận lượng token tiêu thụ sau khi gọi thành công
        const responseTokens = data?.usageMetadata?.totalTokenCount || 0;

        if (supabaseClient && userId) {
            // Cập nhật bảng quota hàng ngày
            const newRequestsToday = todayRequests + 1;
            const newTokensToday = todayTokens + responseTokens;

            const { error: upsertError } = await supabaseClient
                .from('user_ai_quota')
                .upsert({
                    user_id: userId,
                    date: todayStr,
                    requests_today: newRequestsToday,
                    tokens_today: newTokensToday,
                    month_key: monthKey,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id,date'
                });

            if (upsertError) {
                console.error('[SmartLife Proxy] ❌ Quota upsert error:', upsertError.message);
            }

            // Nếu đang dùng Boost Pack, trừ token từ Boost Pack tương ứng
            if (usingBoost && responseTokens > 0) {
                await checkAndConsumeBoostTokens(supabaseClient, userId, responseTokens);
            }
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('[SmartLife Proxy] Error:', error.message);
        const status = error.status || 500;
        return res.status(status).json({ error: error.message });
    }
}
