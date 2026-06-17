import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// @ts-ignore
import { VitePWA } from 'vite-plugin-pwa';

// ────────────────────────────────────────
// Vite Plugin: Gemini API Proxy (Dev Mode Only)
// Xử lý /api/gemini trực tiếp trong Vite dev server
// API key được đọc từ env (KHÔNG có prefix VITE_ → KHÔNG expose ra browser)
// ────────────────────────────────────────
function geminiProxyPlugin(env: Record<string, string>): Plugin {
  const MODEL = 'gemini-2.5-flash';
  let currentKeyIndex = 0;

  const QUOTA_LIMITS = {
    free: { requests_per_day: 0, tokens_per_day: 0, tokens_per_month: 0 },
    trial: { requests_per_day: 3, tokens_per_day: 30000, tokens_per_month: Infinity },
    pro: { requests_per_day: 10, tokens_per_day: 50000, tokens_per_month: 600000 },
    lifetime: { requests_per_day: 10, tokens_per_day: 50000, tokens_per_month: 600000 },
  };

  function getApiKeys(): string[] {
    const raw = env.GEMINI_API_KEYS || env.GEMINI_API_KEY || '';
    return raw.split(',').map(k => k.trim()).filter(Boolean);
  }

  function determineActualPlan(profile: any, email: string | null | undefined): string {
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

  async function checkAndConsumeBoostTokens(supabaseClient: any, userId: string, tokensToDeduct: number): Promise<boolean> {
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
        const totalRemaining = boosts.reduce((sum: number, b: any) => sum + (Number(b.tokens_total) - Number(b.tokens_used)), 0);
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

  async function callGeminiWithRetry(body: any, retryCount = 0): Promise<any> {
    const keys = getApiKeys();
    if (keys.length === 0) {
      throw Object.assign(new Error('GEMINI_API_KEYS chưa được cấu hình.'), { status: 500 });
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
      const errBody = await res.json().catch(() => ({}));

      if ((status === 429 || status === 403 || status === 500 || status === 503 || status === 504)
          && retryCount < Math.max(3, keys.length)) {
        if (keys.length > 1) currentKeyIndex++;
        const delay = 1500 * (retryCount + 1);
        await new Promise(r => setTimeout(r, delay));
        return callGeminiWithRetry(body, retryCount + 1);
      }

      throw Object.assign(
        new Error(errBody?.error?.message || `Gemini API Error ${status}`),
        { status }
      );
    }

    return res.json();
  }

  return {
    name: 'gemini-proxy',
    configureServer(server) {
      server.middlewares.use('/api/gemini', async (req, res) => {
        // CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        // Parse body
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const bodyText = Buffer.concat(chunks).toString('utf-8');

        let body: any;
        try {
          body = JSON.parse(bodyText);
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          return;
        }

        try {
          // Authentication & Quota logic inside Vite Dev Proxy
          let userId = null;
          let userPlan = 'free';
          let userEmail = null;
          let supabaseClient: any = null;

          const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
          const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

          const authHeader = req.headers.authorization;
          if (supabaseUrl && supabaseAnonKey && authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const { createClient } = await import('@supabase/supabase-js');
            supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
              global: {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              }
            });

            const { data: { user } } = await supabaseClient.auth.getUser(token);
            if (user) {
              userId = user.id;
              userEmail = user.email;

              const { data: profile } = await supabaseClient
                .from('profiles')
                .select('plan, pro_expiry_date, trial_started_at')
                .eq('id', userId)
                .single();

              userPlan = determineActualPlan(profile, userEmail);
            }
          }

          if (userPlan === 'free') {
            res.statusCode = 403;
            res.end(JSON.stringify({
              error: 'quota_exceeded',
              type: 'free_gate',
              message: 'Gói Free không bao gồm quyền truy cập AI. Vui lòng nâng cấp lên gói Pro để sử dụng tính năng này! 👑'
            }));
            return;
          }

          const todayStr = new Date().toISOString().split('T')[0];
          const now = new Date();
          const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          const limits = QUOTA_LIMITS[userPlan as keyof typeof QUOTA_LIMITS] || QUOTA_LIMITS.free;

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

            totalTokensMonth = (monthData || []).reduce((sum: number, row: any) => sum + Number(row.tokens_today || 0), 0);
          }

          const todayRequests = usage ? usage.requests_today : 0;
          const todayTokens = usage ? usage.tokens_today : 0;

          // Đọc isToolCall từ body (mặc định false)
          const isToolCall = body?.isToolCall || false;

          // Kiểm tra xem hạn mức có bị vượt không
          const isDailyRequestsExceeded = todayRequests >= limits.requests_per_day;
          const isDailyTokensExceeded = todayTokens >= limits.tokens_per_day;
          const isMonthlyTokensExceeded = limits.tokens_per_month !== Infinity && totalTokensMonth >= limits.tokens_per_month;

          let usingBoost = false;

          // Chỉ kiểm tra giới hạn lượt yêu cầu nếu không phải cuộc gọi con (isToolCall === false)
          const isRequestLimitHit = !isToolCall && isDailyRequestsExceeded;

          if (isRequestLimitHit || isDailyTokensExceeded || isMonthlyTokensExceeded) {
            const hasBoost = await checkAndConsumeBoostTokens(supabaseClient, userId, 0);
            if (!hasBoost) {
              res.statusCode = 429;
              if (isRequestLimitHit) {
                res.end(JSON.stringify({
                  error: 'quota_exceeded',
                  type: 'daily_requests_exceeded',
                  message: `Bạn đã dùng hết ${limits.requests_per_day} lượt yêu cầu AI hôm nay. Vui lòng mua thêm gói AI Boost Pack hoặc quay lại vào ngày mai! ⏰`
                }));
              } else if (isDailyTokensExceeded) {
                res.end(JSON.stringify({
                  error: 'quota_exceeded',
                  type: 'daily_tokens_exceeded',
                  message: `Bạn đã dùng hết giới hạn ${limits.tokens_per_day.toLocaleString()} token hôm nay. Vui lòng mua thêm gói AI Boost Pack hoặc quay lại vào ngày mai! ⚡`
                }));
              } else {
                res.end(JSON.stringify({
                  error: 'quota_exceeded',
                  type: 'monthly_tokens_exceeded',
                  message: `Bạn đã dùng hết giới hạn ${limits.tokens_per_month.toLocaleString()} token của tháng này. Vui lòng mua thêm gói AI Boost Pack để tiếp tục sử dụng! 🚀`
                }));
              }
              return;
            }
            usingBoost = true;
          }

          const { contents, systemInstruction, generationConfig, safetySettings, tools, toolConfig } = body;

          const geminiBody: any = { contents };
          if (systemInstruction) geminiBody.systemInstruction = systemInstruction;
          if (generationConfig) geminiBody.generationConfig = generationConfig;
          if (safetySettings) geminiBody.safetySettings = safetySettings;
          if (tools) geminiBody.tools = tools;
          if (toolConfig) geminiBody.toolConfig = toolConfig;

          const data = await callGeminiWithRetry(geminiBody);

          // Log token usage after successful call
          const responseTokens = data?.usageMetadata?.totalTokenCount || 0;

          if (supabaseClient && userId) {
            const newRequestsToday = isToolCall ? todayRequests : todayRequests + 1;
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
              console.error('[Vite Gemini Proxy] ❌ Quota upsert error:', upsertError.message);
            }

            if (usingBoost && responseTokens > 0) {
              await checkAndConsumeBoostTokens(supabaseClient, userId, responseTokens);
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify(data));
        } catch (err: any) {
          console.error('[Vite Gemini Proxy] Error:', err.message);
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = err.status || 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      // Proxy không cần nữa — geminiProxyPlugin xử lý /api/gemini trực tiếp
    },
    build: {
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/messaging'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-charts': ['recharts'],
            'vendor-ui': ['lucide-react', 'react-markdown', 'remark-gfm'],
            'vendor-utils': ['xlsx', 'html2canvas', 'react-number-format', 'lunar-javascript'],
          }
        }
      }
    },
    plugins: [
      react(),
      geminiProxyPlugin(env), // ← Proxy Gemini API trong dev mode
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: null, // Disable auto-registration to avoid conflict with firebase-messaging-sw.js
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,lottie}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.headers.has('range'),
              handler: 'NetworkOnly', // Bỏ qua cache cho các request trả về 206 Partial Content
            }
          ]
        },
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          name: 'SmartLife Assistant',
          short_name: 'SmartLife',
          description: 'Your personal smart assistant app',
          theme_color: '#4F46E5',
          background_color: '#F3F4F6',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
