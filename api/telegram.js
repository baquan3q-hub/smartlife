// File: api/telegram.js
// Bot Telegram cá nhân: nhắn tin hỏi về task / tài chính / thói quen, bot dùng Gemini
// (function calling) gọi các tool SmartLife rồi trả lời.
//
// Biến môi trường trên Vercel:
//   TELEGRAM_BOT_TOKEN       token từ @BotFather
//   TELEGRAM_WEBHOOK_SECRET  chuỗi bí mật tự đặt (A-Z a-z 0-9 _ -), dùng để xác thực webhook
//   TELEGRAM_ALLOWED_CHAT_ID chat id của bạn (bot sẽ chỉ trả lời người này)
//   SMARTLIFE_API_KEY        API key sl_live_... tạo trong Cài đặt → AI & API
//   GEMINI_API_KEYS          (đã có sẵn cho api/gemini.js)
//
// Cài webhook (1 lần): mở trình duyệt
//   https://<domain>/api/telegram?setup=<TELEGRAM_WEBHOOK_SECRET>

import { TOOLS, TOOL_MAP, INSTRUCTIONS } from './_lib/tools.js';
import { ApiError } from './_lib/authKey.js';

const MODEL = process.env.TELEGRAM_GEMINI_MODEL || 'gemini-2.5-flash';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const ALLOWED_CHAT_ID = (process.env.TELEGRAM_ALLOWED_CHAT_ID || '').trim();
const SMARTLIFE_KEY = process.env.SMARTLIFE_API_KEY;

const MAX_TOOL_ROUNDS = 6;
const HISTORY_TURNS = 10;          // số tin nhắn gần nhất được nhớ (mất khi function khởi động lại)
const history = new Map();         // chatId -> [{ role, parts }]
const debugChats = new Set();      // chat bật /debug: hiện các tool đã gọi
const seenUpdates = new Set();     // chống xử lý trùng khi Telegram gửi lại

// ---------------------------------------------------------------------------
// Telegram helpers
// ---------------------------------------------------------------------------
async function tg(method, payload) {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return res.json().catch(() => ({ ok: false }));
}

function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Markdown đơn giản (từ Gemini) → HTML mà Telegram hỗ trợ
function markdownToTelegramHtml(md) {
    let s = escapeHtml(md);
    s = s.replace(/```(?:\w+)?\n?([\s\S]*?)```/g, (_, code) => `<pre>${code}</pre>`);
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    s = s.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>');
    s = s.replace(/^\s*[-*]\s+/gm, '• ');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<i>$2</i>');
    return s;
}

function chunk(text, size = 3900) {
    const parts = [];
    let rest = text;
    while (rest.length > size) {
        let cut = rest.lastIndexOf('\n', size);
        if (cut < size / 2) cut = size;
        parts.push(rest.slice(0, cut));
        rest = rest.slice(cut);
    }
    if (rest.trim()) parts.push(rest);
    return parts;
}

async function sendReply(chatId, markdown) {
    for (const part of chunk(markdown)) {
        const r = await tg('sendMessage', {
            chat_id: chatId,
            text: markdownToTelegramHtml(part),
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
        });
        // HTML lỗi định dạng → gửi lại dạng chữ thường
        if (!r.ok) await tg('sendMessage', { chat_id: chatId, text: part });
    }
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------
// JSON Schema (MCP) → Schema mà Gemini functionDeclarations chấp nhận
function toGeminiSchema(s) {
    if (!s || typeof s !== 'object') return s;
    const out = {};
    let type = s.type;
    if (Array.isArray(type)) {
        if (type.includes('null')) out.nullable = true;
        type = type.find((t) => t !== 'null');
    }
    if (type) out.type = type.toUpperCase();
    if (s.description) out.description = s.description;
    if (s.enum) out.enum = s.enum;
    if (type === 'string' && s.format === 'date-time') out.format = 'date-time';
    if (s.items) out.items = toGeminiSchema(s.items);
    if (s.properties) {
        out.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toGeminiSchema(v)]));
    }
    if (s.required) out.required = s.required;
    return out;
}

// Tool không có tham số → bỏ "parameters" (Gemini không nhận OBJECT rỗng)
const FUNCTION_DECLARATIONS = TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    ...(Object.keys(t.inputSchema?.properties || {}).length ? { parameters: toGeminiSchema(t.inputSchema) } : {}),
}));

function geminiKeys() {
    return (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '')
        .split(',').map((k) => k.trim()).filter(Boolean);
}

let keyIndex = 0;
async function callGemini(body) {
    const keys = geminiKeys();
    if (keys.length === 0) throw new Error('GEMINI_API_KEYS chưa được cấu hình.');
    let lastError;
    for (let attempt = 0; attempt < Math.max(2, keys.length); attempt++) {
        const key = keys[keyIndex % keys.length];
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (res.ok) return res.json();
        lastError = `Gemini HTTP ${res.status}`;
        if (![429, 500, 503, 504].includes(res.status)) break;
        keyIndex++;
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
    throw new Error(lastError);
}

function systemPrompt() {
    const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'full', timeStyle: 'short' });
    return [
        INSTRUCTIONS,
        `Bây giờ là ${now} (giờ Việt Nam).`,
        'Bạn đang trò chuyện qua Telegram với chính chủ tài khoản SmartLife.',
        'Trả lời bằng ngôn ngữ người dùng dùng, ngắn gọn, dễ đọc trên điện thoại: câu ngắn, gạch đầu dòng, **in đậm** con số quan trọng. Không dùng bảng.',
        'Định dạng tiền kiểu 1.250.000đ. Không bịa số liệu: luôn gọi tool để lấy số MỚI NHẤT, kể cả khi đã trả lời câu tương tự trước đó.',
        'Không bao giờ hiển thị phần [Ghi chú nội bộ] cho người dùng.',
        'Trước khi tạo, sửa hoặc sắp xếp lại task, nói rõ bạn sẽ làm gì và chờ người dùng đồng ý (trừ khi họ đã yêu cầu rõ ràng).',
    ].join('\n');
}

const WRITE_TOOLS = new Set(['add_transaction', 'delete_transaction', 'create_task', 'update_task', 'reorder_tasks', 'create_insight']);

async function runAgent(chatId, userText) {
    const past = history.get(chatId) || [];
    const contents = [...past, { role: 'user', parts: [{ text: userText }] }];
    const toolsUsed = [];
    const memo = [];   // id + kết quả các thao tác ghi, lưu vào lịch sử để "hoàn tác" ở tin sau vẫn làm được

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const data = await callGemini({
            systemInstruction: { parts: [{ text: systemPrompt() }] },
            contents,
            tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
            generationConfig: { temperature: 0.2 },
        });

        const content = data?.candidates?.[0]?.content;
        const parts = content?.parts || [];
        const calls = parts.filter((p) => p.functionCall);

        if (calls.length === 0 || round === MAX_TOOL_ROUNDS) {
            const text = parts.map((p) => p.text || '').join('').trim() || 'Mình chưa có câu trả lời, bạn hỏi lại giúp mình nhé.';
            const remembered = memo.length ? `${text}\n\n[Ghi chú nội bộ, không hiển thị: ${memo.join(' | ')}]` : text;
            const updated = [...past, { role: 'user', parts: [{ text: userText }] }, { role: 'model', parts: [{ text: remembered }] }];
            history.set(chatId, updated.slice(-HISTORY_TURNS));
            return { text, toolsUsed };
        }

        // Giữ nguyên content của model (gồm cả thought signature) rồi trả kết quả tool
        contents.push(content);
        if (round === 0) tg('sendChatAction', { chat_id: chatId, action: 'typing' });

        const responses = await Promise.all(calls.map(async ({ functionCall }) => {
            const tool = TOOL_MAP.get(functionCall.name);
            let response;
            try {
                if (!tool) throw new ApiError(400, 'unknown_tool', `Không có tool ${functionCall.name}`);
                const result = await tool.run(SMARTLIFE_KEY, functionCall.args || {});
                response = { result };
                toolsUsed.push(`✅ ${functionCall.name}`);
                if (WRITE_TOOLS.has(functionCall.name)) {
                    memo.push(`${functionCall.name} → id=${result?.id ?? result?.deleted ?? '?'}${result?.summary ? ` (${result.summary})` : ''}`);
                }
            } catch (err) {
                response = { error: err instanceof ApiError ? `[${err.status} ${err.code}] ${err.message}` : 'Lỗi máy chủ' };
                toolsUsed.push(`⚠️ ${functionCall.name}: ${response.error}`);
                if (!(err instanceof ApiError)) console.error('[telegram] tool error', err);
            }
            console.log('[telegram] tool', functionCall.name, JSON.stringify(functionCall.args || {}), response.error || 'ok');
            return { functionResponse: { name: functionCall.name, response } };
        }));
        contents.push({ role: 'user', parts: responses });
    }
}

// ---------------------------------------------------------------------------
// Setup: đăng ký webhook + menu lệnh
// ---------------------------------------------------------------------------
async function setup(req, res) {
    if (!BOT_TOKEN || !WEBHOOK_SECRET) {
        return res.status(500).json({ ok: false, error: 'Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_WEBHOOK_SECRET trên Vercel.' });
    }
    const host = process.env.PUBLIC_APP_URL || `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
    const url = `${host.replace(/\/$/, '')}/api/telegram`;
    const webhook = await tg('setWebhook', {
        url,
        secret_token: WEBHOOK_SECRET,
        allowed_updates: ['message'],
        drop_pending_updates: true,
    });
    const commands = await tg('setMyCommands', {
        commands: [
            { command: 'today', description: 'Hôm nay tôi nên làm gì?' },
            { command: 'finance', description: 'Tình hình chi tiêu tháng này' },
            { command: 'overdue', description: 'Task quá hạn' },
            { command: 'spend', description: 'Ghi nhanh khoản chi, vd /spend 45k ăn trưa' },
            { command: 'reset', description: 'Bắt đầu cuộc trò chuyện mới' },
            { command: 'debug', description: 'Bật/tắt hiện công cụ bot đã dùng' },
            { command: 'id', description: 'Xem chat id của bạn' },
        ],
    });
    const me = await tg('getMe', {});
    return res.status(200).json({
        ok: !!webhook.ok,
        bot: me.result?.username ? `@${me.result.username}` : null,
        webhook_url: url,
        webhook: webhook.description,
        commands: commands.ok,
        allowed_chat_id: ALLOWED_CHAT_ID || '(chưa đặt — nhắn /id cho bot để lấy)',
        smartlife_key: SMARTLIFE_KEY ? 'đã cấu hình' : 'THIẾU SMARTLIFE_API_KEY',
    });
}

const SHORTCUTS = {
    '/today': 'Xem tình hình của tôi hôm nay: lịch cố định, task quá hạn, task ưu tiên. Gợi ý tôi nên làm gì trước.',
    '/finance': 'Tình hình chi tiêu tháng này so với ngân sách thế nào? Có danh mục nào sắp vượt hạn mức hay hóa đơn sắp đến hạn không?',
    '/overdue': 'Liệt kê các task đang quá hạn và gợi ý cách xử lý từng task.',
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
    if (req.method === 'GET') {
        if (WEBHOOK_SECRET && req.query?.setup === WEBHOOK_SECRET) return setup(req, res);
        return res.status(200).send('SmartLife Telegram bot is running.');
    }
    if (req.method !== 'POST') return res.status(405).end();

    // Chỉ chấp nhận request thật từ Telegram
    if (!WEBHOOK_SECRET || req.headers['x-telegram-bot-api-secret-token'] !== WEBHOOK_SECRET) {
        return res.status(401).end();
    }

    const update = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const msg = update.message;
    if (!msg?.text || seenUpdates.has(update.update_id)) return res.status(200).end();
    seenUpdates.add(update.update_id);
    if (seenUpdates.size > 500) seenUpdates.clear();

    const chatId = String(msg.chat.id);
    const text = msg.text.trim();
    const command = text.split(/\s|@/)[0].toLowerCase();

    try {
        if (command === '/id') {
            await tg('sendMessage', { chat_id: chatId, text: `Chat id của bạn: ${chatId}` });
            return res.status(200).end();
        }

        // Bot riêng tư: chỉ trả lời chủ tài khoản
        if (!ALLOWED_CHAT_ID || chatId !== ALLOWED_CHAT_ID) {
            await tg('sendMessage', {
                chat_id: chatId,
                text: ALLOWED_CHAT_ID
                    ? 'Đây là bot riêng tư.'
                    : `Bot chưa được khóa cho ai. Chat id của bạn là ${chatId} — đặt biến TELEGRAM_ALLOWED_CHAT_ID=${chatId} trên Vercel rồi redeploy.`,
            });
            return res.status(200).end();
        }

        if (!SMARTLIFE_KEY) {
            await tg('sendMessage', { chat_id: chatId, text: 'Thiếu biến SMARTLIFE_API_KEY trên Vercel.' });
            return res.status(200).end();
        }

        if (command === '/start') {
            await sendReply(chatId, 'Chào bạn 👋 Mình là trợ lý SmartLife. Hỏi mình về **task, lịch, chi tiêu, thói quen** — ví dụ: "Hôm nay tôi nên làm gì trước?" hoặc dùng menu lệnh /today, /finance, /overdue.');
            return res.status(200).end();
        }
        if (command === '/debug') {
            const on = !debugChats.has(chatId);
            if (on) debugChats.add(chatId); else debugChats.delete(chatId);
            await tg('sendMessage', { chat_id: chatId, text: on ? 'Đã BẬT chế độ debug: mỗi câu trả lời sẽ kèm danh sách công cụ đã dùng.' : 'Đã TẮT chế độ debug.' });
            return res.status(200).end();
        }
        if (command === '/reset') {
            history.delete(chatId);
            await tg('sendMessage', { chat_id: chatId, text: 'Đã bắt đầu cuộc trò chuyện mới.' });
            return res.status(200).end();
        }

        await tg('sendChatAction', { chat_id: chatId, action: 'typing' });
        let prompt = SHORTCUTS[command] || text;
        if (command === '/spend') {
            const rest = text.replace(/^\/spend(@\S+)?\s*/i, '');
            prompt = rest ? `Ghi khoản chi: ${rest}` : 'Tôi muốn ghi một khoản chi, hãy hỏi tôi số tiền và nội dung.';
        }
        const { text: answer, toolsUsed } = await runAgent(chatId, prompt);
        const debugLine = debugChats.has(chatId)
            ? `\n\n🔧 ${toolsUsed.length ? toolsUsed.join('\n🔧 ') : '(không gọi công cụ nào)'}`
            : '';
        await sendReply(chatId, answer + debugLine);
    } catch (err) {
        console.error('[telegram] error', err);
        await tg('sendMessage', { chat_id: chatId, text: 'Xin lỗi, mình đang gặp lỗi. Bạn thử lại sau ít phút nhé.' });
    }
    // Luôn trả 200 để Telegram không gửi lại tin nhắn
    return res.status(200).end();
}
