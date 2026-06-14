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

  function getApiKeys(): string[] {
    const raw = env.GEMINI_API_KEYS || env.GEMINI_API_KEY || '';
    return raw.split(',').map(k => k.trim()).filter(Boolean);
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
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
          const { contents, systemInstruction, generationConfig, safetySettings, tools, toolConfig } = body;

          const geminiBody: any = { contents };
          if (systemInstruction) geminiBody.systemInstruction = systemInstruction;
          if (generationConfig) geminiBody.generationConfig = generationConfig;
          if (safetySettings) geminiBody.safetySettings = safetySettings;
          if (tools) geminiBody.tools = tools;
          if (toolConfig) geminiBody.toolConfig = toolConfig;

          const data = await callGeminiWithRetry(geminiBody);
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
