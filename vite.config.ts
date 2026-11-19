import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// @ts-ignore
import { VitePWA } from 'vite-plugin-pwa';

// ────────────────────────────────────────
// Vite Plugin: chạy các Vercel function trong /api ngay trong dev server
// Gọi thẳng handler thật trong api/ → logic chỉ nằm một chỗ, giống hệt production.
// Env không có prefix VITE_ (GEMINI_API_KEYS…) được nạp vào process.env phía server,
// KHÔNG lộ ra trình duyệt. Sửa file trong api/ có hiệu lực ngay, không cần khởi động lại.
// ────────────────────────────────────────
// route → file handler + query thêm vào (giống rewrites trong vercel.json)
const DEV_API_ROUTES: Record<string, { file: string; query?: Record<string, string> }> = {
  '/api/gemini': { file: '/api/gemini.js' },
  '/api/search': { file: '/api/gemini.js', query: { op: 'search' } },
};

function vercelApiDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'smartlife-vercel-api-dev',
    configureServer(server) {
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }

      for (const [route, { file, query: extraQuery }] of Object.entries(DEV_API_ROUTES)) {
        server.middlewares.use(route, async (req, res) => {
          const reply = (status: number, payload: unknown) => {
            res.statusCode = status;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(payload));
          };

          try {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk as Buffer);
            const raw = Buffer.concat(chunks).toString('utf-8');
            let body: unknown = undefined;
            if (raw) {
              try {
                body = JSON.parse(raw);
              } catch {
                reply(400, { error: 'Invalid JSON body' });
                return;
              }
            }

            // Bắt chước helper req.body / req.query / res.status().json() của Vercel
            const url = new URL(req.originalUrl || req.url || '/', 'http://localhost');
            const vercelReq = Object.assign(req, {
              body,
              query: { ...Object.fromEntries(url.searchParams), ...extraQuery },
            });
            const vercelRes = Object.assign(res, {
              status(code: number) {
                res.statusCode = code;
                return vercelRes;
              },
              json(payload: unknown) {
                if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify(payload));
                return vercelRes;
              },
              send(payload: unknown) {
                res.end(typeof payload === 'string' || Buffer.isBuffer(payload) ? payload : JSON.stringify(payload));
                return vercelRes;
              },
            });

            const mod = await server.ssrLoadModule(file);
            await mod.default(vercelReq, vercelRes);
          } catch (err: any) {
            console.error(`[Vite API ${route}] Error:`, err?.message || err);
            if (!res.headersSent) reply(500, { error: err?.message || 'Internal error' });
            else res.end();
          }
        });
      }
    },
  };
}

// ────────────────────────────────────────
// Vite Plugin: Send Email Proxy (Dev Mode Only)
// Xử lý /api/send-email trực tiếp trong Vite dev server
// RESEND_API_KEY được đọc từ env (KHÔNG có prefix VITE_)
// ────────────────────────────────────────
function sendEmailProxyPlugin(env: Record<string, string>): Plugin {
  const RESEND_API_KEY = env.RESEND_API_KEY || '';
  const SENDER_EMAIL = env.SENDER_EMAIL || 'SmartLife <onboarding@resend.dev>';

  function buildEmailTemplate(sourceType: string, item: any, minutesLeft: number | undefined, lang = 'vi') {
    const isEn = lang === 'en';
    const title = item.content || item.title || (isEn ? 'Unnamed task' : 'Công việc không tên');
    const desc = item.description || item.location || (isEn ? 'No details provided' : 'Không có chi tiết');

    let timeLeftStr = '';
    if (minutesLeft !== undefined) {
      if (minutesLeft <= 0) {
        timeLeftStr = isEn ? 'Overdue!' : 'Đã quá hạn!';
      } else if (minutesLeft < 60) {
        timeLeftStr = isEn ? `${minutesLeft} minutes` : `${minutesLeft} phút`;
      } else {
        const hrs = Math.floor(minutesLeft / 60);
        const mins = minutesLeft % 60;
        timeLeftStr = isEn
          ? `${hrs} hour(s) ${mins > 0 ? `${mins} min(s)` : ''}`
          : `${hrs} giờ ${mins > 0 ? `${mins} phút` : ''}`;
      }
    }

    let subject = '';
    let html = '';

    if (sourceType === 'todo') {
      subject = isEn ? `⏰ [SmartLife] Deadline Alert: "${title}"` : `⏰ [SmartLife] Nhắc nhở hạn chót: "${title}"`;
      html = `<div style="background-color:#f8fafc;padding:40px 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:580px;margin:0 auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.04);border:1px solid #e2e8f0;"><div style="background:linear-gradient(135deg,#e0f2fe,#bae6fd);padding:35px 20px;text-align:center;"><h2 style="margin:0;font-size:22px;font-weight:800;color:#0c4a6e;">${isEn ? 'Task Deadline Alert' : 'Nhắc Nhở Hạn Chót Task'}</h2></div><div style="padding:35px 25px;color:#334155;"><p>${isEn ? 'Hello,' : 'Xin chào bạn,'}</p><p>${isEn ? `Your task is approaching deadline in <strong>${timeLeftStr}</strong>.` : `Công việc sắp đến hạn trong <strong>${timeLeftStr}</strong>.`}</p><div style="background:#f8fafc;border-left:4px solid #0284c7;padding:20px;margin:25px 0;border-radius:0 16px 16px 0;"><p style="margin:0 0 8px;font-size:15px;"><strong>${isEn ? 'Task' : 'Nhiệm vụ'}:</strong> ${title}</p><p style="margin:0;font-size:13px;color:#64748b;"><strong>${isEn ? 'Description' : 'Mô tả'}:</strong> ${desc}</p></div></div></div></div>`;
    } else if (sourceType === 'calendar_event') {
      subject = isEn ? `📅 [SmartLife] Upcoming Event: "${title}"` : `📅 [SmartLife] Sự kiện sắp diễn ra: "${title}"`;
      html = `<div style="background-color:#f8fafc;padding:40px 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:580px;margin:0 auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.04);border:1px solid #e2e8f0;"><div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);padding:35px 20px;text-align:center;"><h2 style="margin:0;font-size:22px;font-weight:800;color:#14532d;">${isEn ? 'Upcoming Event' : 'Nhắc Nhở Sự Kiện'}</h2></div><div style="padding:35px 25px;"><p>${isEn ? `Event starts in <strong>${timeLeftStr}</strong>.` : `Sự kiện bắt đầu trong <strong>${timeLeftStr}</strong>.`}</p><div style="background:#f8fafc;border-left:4px solid #16a34a;padding:20px;margin:25px 0;border-radius:0 16px 16px 0;"><p style="margin:0 0 8px;font-size:15px;"><strong>${isEn ? 'Event' : 'Sự kiện'}:</strong> ${title}</p><p style="margin:0;font-size:13px;color:#64748b;">${item.date} ${item.time ? item.time.slice(0, 5) : ''}</p></div></div></div></div>`;
    } else if (sourceType === 'timetable') {
      subject = isEn ? `🏫 [SmartLife] Timetable: "${title}"` : `🏫 [SmartLife] Lịch cố định: "${title}"`;
      html = `<div style="background-color:#f8fafc;padding:40px 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:580px;margin:0 auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.04);border:1px solid #e2e8f0;"><div style="background:linear-gradient(135deg,#f5f3ff,#e0e7ff);padding:35px 20px;text-align:center;"><h2 style="margin:0;font-size:22px;font-weight:800;color:#4c1d95;">${isEn ? 'Timetable Reminder' : 'Nhắc Nhở Lịch Cố Định'}</h2></div><div style="padding:35px 25px;"><p>${isEn ? `Event starts in <strong>${timeLeftStr}</strong>.` : `Lịch bắt đầu trong <strong>${timeLeftStr}</strong>.`}</p><div style="background:#f8fafc;border-left:4px solid #7c3aed;padding:20px;margin:25px 0;border-radius:0 16px 16px 0;"><p style="margin:0 0 8px;font-size:15px;"><strong>${isEn ? 'Class/Task' : 'Lịch trình'}:</strong> ${title}</p><p style="margin:0;font-size:13px;">${item.start_time ? item.start_time.slice(0, 5) : ''} ${item.end_time ? '- ' + item.end_time.slice(0, 5) : ''}</p></div></div></div></div>`;
    }

    return { subject, html };
  }

  return {
    name: 'send-email-proxy',
    configureServer(server) {
      server.middlewares.use('/api/send-email', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
        if (req.method !== 'POST') { res.statusCode = 405; res.end(JSON.stringify({ error: 'Method not allowed' })); return; }

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        let body: any;
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf-8')); } catch {
          res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid JSON' })); return;
        }

        if (!RESEND_API_KEY) {
          console.error('[Vite SendEmail] RESEND_API_KEY not configured in .env.local');
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'RESEND_API_KEY chưa được cấu hình. Thêm RESEND_API_KEY vào .env.local' }));
          return;
        }

        try {
          const { logId, to, lang, sourceType, item, minutesLeft } = body;
          if (!to || !sourceType || !item) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing required: to, sourceType, item' }));
            return;
          }

          const { subject, html } = buildEmailTemplate(sourceType, item, minutesLeft, lang);
          if (!subject || !html) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: `Unknown sourceType: ${sourceType}` }));
            return;
          }

          console.log(`[Vite SendEmail] Sending ${sourceType} email to ${to}...`);
          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
            body: JSON.stringify({ from: SENDER_EMAIL, to, subject, html }),
          });

          const resendData = await resendRes.json();

          if (!resendRes.ok) {
            console.error(`[Vite SendEmail] Resend Error (${resendRes.status}):`, resendData);
            res.statusCode = resendRes.status;
            res.end(JSON.stringify({ error: 'Resend send failed', details: resendData }));
            return;
          }

          console.log('[Vite SendEmail] ✅ Email sent!', resendData);
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ message: 'Email sent successfully!', data: resendData }));
        } catch (err: any) {
          console.error('[Vite SendEmail] Error:', err.message);
          res.statusCode = 500;
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
      // Proxy không cần nữa — vercelApiDevPlugin chạy /api/gemini, /api/search trực tiếp
    },
    css: {
      postcss: {
        plugins: [],
      },
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
      tailwindcss(),
      vercelApiDevPlugin(env), // ← /api/gemini, /api/search chạy handler thật trong dev mode
      sendEmailProxyPlugin(env), // ← Proxy Send Email API trong dev mode
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: null, // Disable auto-registration to avoid conflict with firebase-messaging-sw.js
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,lottie}', 'icons/glass/*-sm.webp'],
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
