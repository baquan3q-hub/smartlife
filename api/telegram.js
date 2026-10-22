// File: api/telegram.js
// Bot Telegram cá nhân: nhắn tin văn bản hoặc gửi VOICE để hỏi về task / tài chính / thói quen.
// Tích hợp Gemini 2.5 Flash đa phương thức (Audio Multimodal) + Function Calling SmartLife.
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
const HISTORY_TURNS = 10;          // số tin nhắn gần nhất được nhớ
const history = new Map();         // chatId -> [{ role, parts }]
const debugChats = new Set();      // chat bật /debug: hiện các tool đã gọi
const seenUpdates = new Set();     // chống xử lý trùng khi Telegram gửi lại
const pendingTx = new Map();       // id -> { amount, category, description, type, wallet, createdAt }

const EXPENSE_CATEGORIES = [
    'Ăn uống',
    'Dating',
    'Di chuyển',
    'Caffe - giao lưu',
    'Giáo dục',
    'Mua sắm',
    'Tiền mạng',
    'Đầu tư',
    'Khác',
    'Giải trí',
    'Cho vay',
    'Sức khỏe',
    'Hiếu hỉ',
    'Nhà cửa',
    'Du lịch',
    'My Family',
    'Trả nợ',
    'Cống hiến',
];

const INCOME_CATEGORIES = [
    'Được tặng',
    'Mom',
    'Lương',
    'Thưởng',
    'Part Time',
    'Khác',
    'Đầu tư',
    'Bán hàng',
    'Ăn uống',
    'Chuyển khoản 🔄',
];

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
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatVnd(amount) {
    return Number(amount || 0).toLocaleString('vi-VN') + 'đ';
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
        parts.push(rest.slice(cut));
        rest = rest.slice(cut);
    }
    if (rest.trim()) parts.push(rest);
    return parts;
}

// Bàn phím tác vụ nhanh ghim thường trực dưới đáy màn hình chat (ReplyKeyboardMarkup)
const MAIN_KEYBOARD = {
    keyboard: [
        [{ text: '📅 Lịch trình hôm nay' }, { text: '🎯 Top việc cần làm' }],
        [{ text: '💰 Số dư & Chi tiêu' }, { text: '⚡ Thói quen hôm nay' }],
        [{ text: '🌅 Khởi động ngày' }, { text: '🌙 Tổng kết cuối ngày' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
};

// Ánh xạ prompt chi tiết theo từng nút bấm
const BUTTON_ACTIONS = {
    '📅 Lịch trình hôm nay': {
        prompt: 'Kiểm tra và tóm tắt chi tiết lịch trình hôm nay của tôi (bao gồm thời khóa biểu học tập, môn học, ca học, phòng học, giảng viên và các sự kiện/cuộc hẹn). Nếu không có lịch cố định, hãy thông báo ngắn gọn.',
        category: 'schedule',
    },
    '🎯 Top việc cần làm': {
        prompt: 'Kiểm tra danh sách công việc (Kanban tasks) của tôi. Liệt kê các task có độ ưu tiên cao nhất (urgent/focus), task có hạn chót hôm nay hoặc đang quá hạn. Đề xuất thứ tự ưu tiên xử lý trong ngày.',
        category: 'tasks',
    },
    '💰 Số dư & Chi tiêu': {
        prompt: 'Báo cáo tài chính cho tôi: Số dư khả dụng hiện tại là bao nhiêu? Chi tiêu tháng này so với ngân sách thế nào? Có danh mục nào đang chi vượt hạn mức hoặc các hóa đơn định kỳ sắp tới trong 7 ngày không?',
        category: 'finance',
    },
    '⚡ Thói quen hôm nay': {
        prompt: 'Kiểm tra tình hình rèn luyện thói quen (habits) của tôi trong SmartLife hôm nay: những thói quen nào đã hoàn thành, những thói quen nào chưa làm, streak (chuỗi ngày liên tục) của từng thói quen. Hãy nhắc nhở và động viên tôi hoàn thành!',
        category: 'habits',
    },
    '🌅 Khởi động ngày': {
        prompt: 'Chào buổi sáng! Hãy tổng hợp bức tranh toàn cảnh khởi động ngày mới cho tôi: lịch trình hôm nay, 3 việc quan trọng nhất cần giải quyết, hạn mức chi tiêu an toàn cho ngày hôm nay và một câu truyền cảm hứng ngắn gọn.',
        category: 'morning',
    },
    '🌙 Tổng kết cuối ngày': {
        prompt: 'Tổng kết cuối ngày cho tôi: hôm nay tôi đã hoàn thành những task nào, chi tiêu bao nhiêu tiền, thói quen duy trì ra sao? Đánh giá ngắn gọn năng suất làm việc hôm nay và gợi ý 1-2 việc cần lưu ý cho ngày mai.',
        category: 'night',
    },

    // Các action phụ / follow-up chips
    '⚠️ Task quá hạn': {
        prompt: 'Liệt kê chi tiết các task đang quá hạn (overdue) của tôi kèm deadline cũ và gợi ý giải pháp xử lý nhanh từng việc.',
        category: 'tasks',
    },
    '🍅 Khung giờ Pomodoro': {
        prompt: 'Dựa vào lịch trình và danh sách task cần làm hôm nay, hãy gợi ý cho tôi 2-3 khung giờ vàng để bật Pomodoro tập trung sâu (Deep Work).',
        category: 'tasks',
    },
    '🧾 Hóa đơn 7 ngày tới': {
        prompt: 'Kiểm tra các hóa đơn định kỳ, tiền nhà, tiền dịch vụ hoặc các khoản nợ cần thanh toán trong 7 ngày tới.',
        category: 'finance',
    },
    '📊 Biến động 30 ngày': {
        prompt: 'Kiểm tra biến động số dư và các lần điều chỉnh số dư trong 30 ngày qua.',
        category: 'finance',
    },
};

// Ánh xạ lệnh gõ (/slash) sang prompt tương ứng
const COMMAND_ACTIONS = {
    '/today': { prompt: BUTTON_ACTIONS['🎯 Top việc cần làm'].prompt, category: 'tasks' },
    '/schedule': { prompt: BUTTON_ACTIONS['📅 Lịch trình hôm nay'].prompt, category: 'schedule' },
    '/finance': { prompt: BUTTON_ACTIONS['💰 Số dư & Chi tiêu'].prompt, category: 'finance' },
    '/overdue': { prompt: BUTTON_ACTIONS['⚠️ Task quá hạn'].prompt, category: 'tasks' },
    '/habits': { prompt: BUTTON_ACTIONS['⚡ Thói quen hôm nay'].prompt, category: 'habits' },
    '/morning': { prompt: BUTTON_ACTIONS['🌅 Khởi động ngày'].prompt, category: 'morning' },
    '/review': { prompt: BUTTON_ACTIONS['🌙 Tổng kết cuối ngày'].prompt, category: 'night' },
    '/pomodoro': { prompt: BUTTON_ACTIONS['🍅 Khung giờ Pomodoro'].prompt, category: 'tasks' },
};

// Tạo các nút gợi ý câu hỏi tiếp theo (Contextual Prompt Chips) gắn liền dưới câu trả lời của AI
function buildContextualChips(category) {
    if (category === 'schedule') {
        return {
            inline_keyboard: [
                [
                    { text: '🎯 Top việc cần làm', callback_data: 'cq:tasks' },
                    { text: '🍅 Khung giờ Pomodoro', callback_data: 'cq:pomodoro' },
                ],
            ],
        };
    }
    if (category === 'tasks') {
        return {
            inline_keyboard: [
                [
                    { text: '⚠️ Task quá hạn', callback_data: 'cq:overdue' },
                    { text: '🍅 Khung giờ Pomodoro', callback_data: 'cq:pomodoro' },
                ],
                [
                    { text: '📅 Xem lịch trình', callback_data: 'cq:schedule' },
                ],
            ],
        };
    }
    if (category === 'finance') {
        return {
            inline_keyboard: [
                [
                    { text: '🧾 Hóa đơn 7 ngày tới', callback_data: 'cq:bills' },
                    { text: '📊 Biến động 30 ngày', callback_data: 'cq:balance30' },
                ],
            ],
        };
    }
    if (category === 'habits') {
        return {
            inline_keyboard: [
                [
                    { text: '🎯 Top việc cần làm', callback_data: 'cq:tasks' },
                    { text: '🌙 Tổng kết ngày', callback_data: 'cq:night' },
                ],
            ],
        };
    }
    if (category === 'morning') {
        return {
            inline_keyboard: [
                [
                    { text: '🎯 Top việc cần làm', callback_data: 'cq:tasks' },
                    { text: '📅 Lịch trình', callback_data: 'cq:schedule' },
                ],
            ],
        };
    }
    if (category === 'night') {
        return {
            inline_keyboard: [
                [
                    { text: '⚡ Thói quen', callback_data: 'cq:habits' },
                    { text: '💰 Số dư ví', callback_data: 'cq:finance' },
                ],
            ],
        };
    }
    return null;
}

async function sendReply(chatId, markdown, replyMarkup = null) {
    const markupToSend = replyMarkup !== undefined && replyMarkup !== null ? replyMarkup : MAIN_KEYBOARD;
    const parts = chunk(markdown);
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const payload = {
            chat_id: chatId,
            text: markdownToTelegramHtml(part),
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
        };
        if (isLast && markupToSend) {
            payload.reply_markup = markupToSend;
        }
        const r = await tg('sendMessage', payload);
        if (!r.ok) {
            const fallbackPayload = { chat_id: chatId, text: part };
            if (isLast && markupToSend) fallbackPayload.reply_markup = markupToSend;
            await tg('sendMessage', fallbackPayload);
        }
    }
}

// Lưu cache giao dịch chờ xác nhận (dọn dẹp sau 30 phút)
function storePendingTx(data) {
    const id = Math.random().toString(36).substring(2, 8);
    pendingTx.set(id, { ...data, createdAt: Date.now() });
    if (pendingTx.size > 200) {
        const threshold = Date.now() - 30 * 60 * 1000;
        for (const [k, v] of pendingTx.entries()) {
            if (v.createdAt < threshold) pendingTx.delete(k);
        }
    }
    return id;
}

// Thẻ giao diện xác nhận Voice hiện đại, sang trọng
function buildVoiceConfirmationCard(tx, id) {
    const isExpense = tx.type !== 'income';
    const sign = isExpense ? '-' : '+';
    const typeLabel = isExpense ? 'Khoản chi' : 'Khoản thu';
    const typeBadge = isExpense ? '💸' : '💰';

    const card = [
        '🎙️ <b>GHI NHẬN TỪ GIỌNG NÓI</b>',
        `<i>"${escapeHtml(tx.transcript || tx.description)}"</i>`,
        '━━━━━━━━━━━━━━━━━━━━',
        `${typeBadge} <b>${typeLabel}:</b> <code>${sign}${formatVnd(tx.amount)}</code>`,
        `🏷️ <b>Danh mục:</b> <b>${escapeHtml(tx.category)}</b>`,
        `📝 <b>Nội dung:</b> ${escapeHtml(tx.description)}`,
        `💳 <b>Ví thanh toán:</b> Cash`,
        '━━━━━━━━━━━━━━━━━━━━',
        '⚡ <i>Bạn có muốn lưu giao dịch này vào SmartLife không?</i>',
    ].join('\n');

    // Nén vào callback_data (tối đa 64 bytes)
    const catList = isExpense ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    const catIdx = Math.max(0, catList.indexOf(tx.category));
    const confirmData = `ok:${id}:${isExpense ? 'e' : 'i'}:${tx.amount}:${catIdx}`;
    const cancelData = `no:${id}`;

    const replyMarkup = {
        inline_keyboard: [
            [
                { text: '✨ Xác nhận ghi sổ', callback_data: confirmData },
                { text: '❌ Hủy bỏ', callback_data: cancelData },
            ],
        ],
    };

    return { card, replyMarkup };
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------
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
    const memo = [];

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
// Xử lý Voice / Âm thanh từ Telegram bằng Gemini Multimodal
// ---------------------------------------------------------------------------
async function processVoiceMessage(voice) {
    const fileInfo = await tg('getFile', { file_id: voice.file_id });
    if (!fileInfo.ok || !fileInfo.result?.file_path) {
        throw new Error('Không thể tải file voice từ máy chủ Telegram.');
    }
    const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.result.file_path}`;
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error('Tải file âm thanh thất bại.');
    const arrayBuffer = await res.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    const prompt = `Bạn là trợ lý AI thông minh phân tích giọng nói tiếng Việt cho ứng dụng SmartLife.
Hãy nghe đoạn âm thanh này và xác định xem người dùng đang muốn:
1. Ghi nhận giao dịch chi tiêu hoặc thu nhập tài chính.
2. Hoặc đang hỏi/nói một câu chuyện, yêu cầu công việc bình thường.

Nếu là GIAO DỊCH TÀI CHÍNH (VD: "ăn trưa 45k", "mua keo dán 20k", "uống cafe 29k", "cho người yêu 69k", "được thưởng 500k"):
- type: "expense" (chi tiêu, mặc định) hoặc "income" (thu tiền, được cho, lương).
- amount: Số tiền VNĐ nguyên (VD: 45k -> 45000, 1 lít/100k -> 100000, 1tr2 -> 1200000).
- category: Chọn 1 danh mục khớp nhất trong các danh mục sau:
  Chi tiêu: ["Ăn uống", "Dating", "Di chuyển", "Caffe - giao lưu", "Giáo dục", "Mua sắm", "Tiền mạng", "Đầu tư", "Khác", "Giải trí", "Cho vay", "Sức khỏe", "Hiếu hỉ", "Nhà cửa", "Du lịch", "My Family", "Trả nợ", "Cống hiến"]
  Thu nhập: ["Được tặng", "Mom", "Lương", "Thưởng", "Part Time", "Khác", "Đầu tư", "Bán hàng", "Ăn uống", "Chuyển khoản 🔄"]
- description: Tên nội dung ngắn gọn (VD: "Ăn bánh cuốn trưa", "Mua keo dán", "Cafe Highland", "Cho người yêu").
- transcript: Câu nói nguyên văn của người dùng.
- is_transaction: true

Nếu KHÔNG phải giao dịch tài chính (VD: "hôm nay tôi có task nào không", "chào bạn",...):
- is_transaction: false
- transcript: Câu nói nguyên văn của người dùng.

Trả về DUY NHẤT một JSON hợp lệ (không kèm markdown \`\`\`json):
{
  "is_transaction": true,
  "type": "expense",
  "amount": 45000,
  "category": "Ăn uống",
  "description": "Ăn trưa bánh cuốn",
  "transcript": "trưa nay tôi ăn bánh cuốn 45k"
}`;

    const data = await callGemini({
        contents: [
            {
                parts: [
                    {
                        inlineData: {
                            mimeType: voice.mime_type || 'audio/ogg',
                            data: base64Audio,
                        },
                    },
                    { text: prompt },
                ],
            },
        ],
        generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
        },
    });

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    try {
        return JSON.parse(rawText);
    } catch (_) {
        return { is_transaction: false, transcript: rawText };
    }
}

async function handleVoiceMessage(chatId, voice) {
    await tg('sendChatAction', { chat_id: chatId, action: 'record_voice' });
    try {
        const result = await processVoiceMessage(voice);
        if (result.is_transaction && result.amount > 0) {
            const id = storePendingTx(result);
            const { card, replyMarkup } = buildVoiceConfirmationCard(result, id);
            await tg('sendMessage', {
                chat_id: chatId,
                text: card,
                parse_mode: 'HTML',
                reply_markup: replyMarkup,
            });
        } else {
            // Không phải giao dịch tài chính → chuyển nội dung text sang AI trả lời
            const transcript = result.transcript || 'Mình không nghe rõ, bạn có thể nói lại hoặc gõ tin nhắn nhé.';
            await sendReply(chatId, `🎙️ <i>"${escapeHtml(transcript)}"</i>\n\nĐang xử lý yêu cầu của bạn...`);
            await tg('sendChatAction', { chat_id: chatId, action: 'typing' });
            const { text: answer, toolsUsed } = await runAgent(chatId, transcript);
            const debugLine = debugChats.has(chatId)
                ? `\n\n🔧 ${toolsUsed.length ? toolsUsed.join('\n🔧 ') : '(không gọi công cụ nào)'}`
                : '';
            const lower = transcript.toLowerCase();
            let cat = null;
            if (/task|việc|công việc|deadline|kanban/i.test(lower)) cat = 'tasks';
            else if (/tiền|chi tiêu|số dư|ngân sách|chi phí|ví|giao dịch/i.test(lower)) cat = 'finance';
            else if (/lịch|thời khóa biểu|tkb|tiết học|phòng học/i.test(lower)) cat = 'schedule';
            else if (/thói quen|habit|streak/i.test(lower)) cat = 'habits';
            await sendReply(chatId, answer + debugLine, buildContextualChips(cat));
        }
    } catch (err) {
        console.error('[telegram] voice processing error:', err);
        await tg('sendMessage', {
            chat_id: chatId,
            text: '⚠️ Không thể nhận diện đoạn ghi âm. Bạn vui lòng thử nói rõ ràng hơn hoặc gửi tin nhắn văn bản nhé.',
        });
    }
}

// ---------------------------------------------------------------------------
// Xử lý nút bấm tương tác (Inline Keyboard Callback)
// ---------------------------------------------------------------------------
async function handleCallbackQuery(query) {
    const callbackData = query.data || '';
    const chatId = String(query.message?.chat?.id || query.from?.id);
    const messageId = query.message?.message_id;

    if (ALLOWED_CHAT_ID && chatId !== ALLOWED_CHAT_ID) {
        await tg('answerCallbackQuery', {
            callback_query_id: query.id,
            text: 'Bạn không có quyền thao tác trên bot này.',
            show_alert: true,
        });
        return;
    }

    // Xử lý nút bấm gợi ý hành động tiếp theo (Contextual Prompt Chips)
    if (callbackData.startsWith('cq:')) {
        const action = callbackData.replace('cq:', '');
        await tg('answerCallbackQuery', {
            callback_query_id: query.id,
            text: '⚡ Đang lấy dữ liệu...',
        });

        const actionMap = {
            tasks: { prompt: BUTTON_ACTIONS['🎯 Top việc cần làm'].prompt, cat: 'tasks' },
            schedule: { prompt: BUTTON_ACTIONS['📅 Lịch trình hôm nay'].prompt, cat: 'schedule' },
            finance: { prompt: BUTTON_ACTIONS['💰 Số dư & Chi tiêu'].prompt, cat: 'finance' },
            habits: { prompt: BUTTON_ACTIONS['⚡ Thói quen hôm nay'].prompt, cat: 'habits' },
            morning: { prompt: BUTTON_ACTIONS['🌅 Khởi động ngày'].prompt, cat: 'morning' },
            night: { prompt: BUTTON_ACTIONS['🌙 Tổng kết cuối ngày'].prompt, cat: 'night' },
            overdue: { prompt: BUTTON_ACTIONS['⚠️ Task quá hạn'].prompt, cat: 'tasks' },
            pomodoro: { prompt: BUTTON_ACTIONS['🍅 Khung giờ Pomodoro'].prompt, cat: 'tasks' },
            bills: { prompt: BUTTON_ACTIONS['🧾 Hóa đơn 7 ngày tới'].prompt, cat: 'finance' },
            balance30: { prompt: BUTTON_ACTIONS['📊 Biến động 30 ngày'].prompt, cat: 'finance' },
        };

        const target = actionMap[action];
        if (!target) return;

        await tg('sendChatAction', { chat_id: chatId, action: 'typing' });
        const { text: answer, toolsUsed } = await runAgent(chatId, target.prompt);
        const debugLine = debugChats.has(chatId)
            ? `\n\n🔧 ${toolsUsed.length ? toolsUsed.join('\n🔧 ') : '(không gọi công cụ nào)'}`
            : '';
        const chips = buildContextualChips(target.cat);
        await sendReply(chatId, answer + debugLine, chips);
        return;
    }

    if (!callbackData.startsWith('ok:') && !callbackData.startsWith('no:')) {
        await tg('answerCallbackQuery', { callback_query_id: query.id });
        return;
    }

    const [action, id, typeFlag, amountStr, catIdxStr] = callbackData.split(':');

    if (action === 'no') {
        pendingTx.delete(id);
        await tg('answerCallbackQuery', {
            callback_query_id: query.id,
            text: 'Đã hủy bỏ giao dịch.',
        });
        const cancelCard = [
            '🗑️ <b>ĐÃ HỦY GIAO DỊCH</b>',
            '━━━━━━━━━━━━━━━━━━━━',
            '<i>Giao dịch đã được hủy và không ghi nhận vào SmartLife.</i>',
        ].join('\n');
        await tg('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: cancelCard,
            parse_mode: 'HTML',
        });
        return;
    }

    if (action === 'ok') {
        await tg('answerCallbackQuery', {
            callback_query_id: query.id,
            text: 'Đang ghi nhận vào SmartLife...',
        });

        const stored = pendingTx.get(id);
        pendingTx.delete(id);

        const isExpense = stored?.type ? stored.type === 'expense' : typeFlag !== 'i';
        const type = isExpense ? 'expense' : 'income';
        const amount = stored?.amount || Number(amountStr) || 0;
        const catList = isExpense ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
        const category = stored?.category || catList[Number(catIdxStr)] || (isExpense ? 'Ăn uống' : 'Lương');
        const description = stored?.description || category;

        try {
            const tool = TOOL_MAP.get('add_transaction');
            if (!tool) throw new Error('Không tìm thấy công cụ add_transaction');
            const res = await tool.run(SMARTLIFE_KEY, {
                amount,
                category,
                description,
                type,
                wallet: 'Cash',
            });

            const balanceAfter = res?.wallet_balance_after != null ? formatVnd(res.wallet_balance_after) : (res?.summary || 'Đã cập nhật');
            const sign = isExpense ? '-' : '+';
            const nowTime = new Date().toLocaleTimeString('vi-VN', {
                timeZone: 'Asia/Ho_Chi_Minh',
                hour: '2-digit',
                minute: '2-digit',
            });

            const successCard = [
                '✨ <b>GHI SỔ THÀNH CÔNG</b>',
                '━━━━━━━━━━━━━━━━━━━━',
                `${isExpense ? '💸' : '💰'} <b>Số tiền:</b> <code>${sign}${formatVnd(amount)}</code>`,
                `🏷️ <b>Danh mục:</b> <b>${escapeHtml(category)}</b>`,
                `📝 <b>Ghi chú:</b> ${escapeHtml(description)}`,
                `💳 <b>Ví thanh toán:</b> Cash`,
                `🏦 <b>Số dư ví Cash:</b> <b>${balanceAfter}</b>`,
                '━━━━━━━━━━━━━━━━━━━━',
                `<i>✅ Đã đồng bộ lên SmartLife • ${nowTime}</i>`,
            ].join('\n');

            await tg('editMessageText', {
                chat_id: chatId,
                message_id: messageId,
                text: successCard,
                parse_mode: 'HTML',
            });
        } catch (err) {
            console.error('[telegram] callback add_transaction error:', err);
            await tg('sendMessage', {
                chat_id: chatId,
                text: '⚠️ Không thể ghi giao dịch vào SmartLife: ' + err.message,
            });
        }
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
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true,
    });
    const commands = await tg('setMyCommands', {
        commands: [
            { command: 'menu', description: 'Hiện bảng điều khiển & nút tác vụ nhanh' },
            { command: 'today', description: 'Top việc cần làm hôm nay' },
            { command: 'schedule', description: 'Lịch trình, thời khóa biểu hôm nay' },
            { command: 'finance', description: 'Tình hình tài chính & số dư' },
            { command: 'overdue', description: 'Danh sách task quá hạn' },
            { command: 'habits', description: 'Tiến độ thói quen hôm nay' },
            { command: 'review', description: 'Tổng kết ngày' },
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

// ---------------------------------------------------------------------------
// Main Webhook Handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
    if (req.method === 'GET') {
        if (WEBHOOK_SECRET && req.query?.setup === WEBHOOK_SECRET) return setup(req, res);
        return res.status(200).send('SmartLife Telegram bot is running.');
    }
    if (req.method !== 'POST') return res.status(405).end();

    // Xác thực request từ Telegram
    if (!WEBHOOK_SECRET || req.headers['x-telegram-bot-api-secret-token'] !== WEBHOOK_SECRET) {
        return res.status(401).end();
    }

    const update = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

    // 1. Xử lý nút bấm tương tác (callback_query)
    if (update.callback_query) {
        if (seenUpdates.has(update.update_id)) return res.status(200).end();
        seenUpdates.add(update.update_id);
        await handleCallbackQuery(update.callback_query);
        return res.status(200).end();
    }

    // 2. Xử lý tin nhắn (message)
    const msg = update.message;
    if (!msg || seenUpdates.has(update.update_id)) return res.status(200).end();
    seenUpdates.add(update.update_id);
    if (seenUpdates.size > 500) seenUpdates.clear();

    const chatId = String(msg.chat.id);

    try {
        // Lệnh xem id không cần kiểm tra quyền
        if (msg.text && msg.text.trim().toLowerCase().startsWith('/id')) {
            await tg('sendMessage', { chat_id: chatId, text: `Chat id của bạn: ${chatId}` });
            return res.status(200).end();
        }

        // Khóa bot riêng tư cho chủ tài khoản
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

        // 2.1. Nhận tin nhắn VOICE hoặc AUDIO ghi âm
        if (msg.voice || msg.audio) {
            await handleVoiceMessage(chatId, msg.voice || msg.audio);
            return res.status(200).end();
        }

        // 2.2. Nhận tin nhắn VĂN BẢN
        if (!msg.text) return res.status(200).end();

        const text = msg.text.trim();
        const command = text.split(/\s|@/)[0].toLowerCase();

        if (command === '/start' || command === '/menu') {
            await sendReply(
                chatId,
                'Chào bạn 👋 Mình là trợ lý SmartLife.\n\n' +
                '🎯 <b>Chạm nhanh vào các nút ở bàn phím bên dưới để xem ngay:</b>\n' +
                '• 📅 <b>Lịch trình hôm nay:</b> Lịch học, ca học, sự kiện.\n' +
                '• 🎯 <b>Top việc cần làm:</b> Task ưu tiên, deadline gần nhất.\n' +
                '• 💰 <b>Số dư & Chi tiêu:</b> Số dư khả dụng, hạn mức tháng.\n' +
                '• ⚡ <b>Thói quen hôm nay:</b> Tiến độ & streak thói quen.\n' +
                '• 🌅 <b>Khởi động ngày:</b> Bức tranh toàn cảnh buổi sáng.\n' +
                '• 🌙 <b>Tổng kết cuối ngày:</b> Review năng suất & chi tiêu.\n\n' +
                '🎙️ <b>Gửi tin nhắn thoại (Voice):</b>\n' +
                '• <i>"Trưa nay ăn bún chả 45k"</i> → Nhận diện và hiện nút xác nhận ghi sổ.\n' +
                '• <i>"Hôm nay tôi rảnh lúc nào?"</i> → Phân tích và trả lời ngay.\n\n' +
                '💬 <i>Hoặc cứ nhắn tin tự do bất cứ điều gì bạn muốn hỏi!</i>',
                MAIN_KEYBOARD
            );
            return res.status(200).end();
        }

        if (command === '/debug') {
            const on = !debugChats.has(chatId);
            if (on) debugChats.add(chatId); else debugChats.delete(chatId);
            await tg('sendMessage', {
                chat_id: chatId,
                text: on ? 'Đã BẬT chế độ debug: mỗi câu trả lời sẽ kèm danh sách công cụ đã dùng.' : 'Đã TẮT chế độ debug.',
            });
            return res.status(200).end();
        }

        if (command === '/reset') {
            history.delete(chatId);
            await tg('sendMessage', { chat_id: chatId, text: 'Đã bắt đầu cuộc trò chuyện mới.' });
            return res.status(200).end();
        }

        await tg('sendChatAction', { chat_id: chatId, action: 'typing' });

        let prompt = text;
        let category = null;

        if (BUTTON_ACTIONS[text]) {
            prompt = BUTTON_ACTIONS[text].prompt;
            category = BUTTON_ACTIONS[text].category;
        } else if (COMMAND_ACTIONS[command]) {
            prompt = COMMAND_ACTIONS[command].prompt;
            category = COMMAND_ACTIONS[command].category;
        } else if (command === '/spend') {
            const rest = text.replace(/^\/spend(@\S+)?\s*/i, '');
            prompt = rest ? `Ghi khoản chi: ${rest}` : 'Tôi muốn ghi một khoản chi, hãy hỏi tôi số tiền và nội dung.';
            category = 'finance';
        } else {
            // Nhận diện category tự động từ câu hỏi tự do
            const lower = text.toLowerCase();
            if (/task|việc|công việc|deadline|kanban/i.test(lower)) category = 'tasks';
            else if (/tiền|chi tiêu|số dư|ngân sách|chi phí|ví|giao dịch/i.test(lower)) category = 'finance';
            else if (/lịch|thời khóa biểu|tkb|tiết học|phòng học/i.test(lower)) category = 'schedule';
            else if (/thói quen|habit|streak/i.test(lower)) category = 'habits';
        }

        const { text: answer, toolsUsed } = await runAgent(chatId, prompt);
        const debugLine = debugChats.has(chatId)
            ? `\n\n🔧 ${toolsUsed.length ? toolsUsed.join('\n🔧 ') : '(không gọi công cụ nào)'}`
            : '';
        const chips = buildContextualChips(category);
        await sendReply(chatId, answer + debugLine, chips);
    } catch (err) {
        console.error('[telegram] error', err);
        await tg('sendMessage', { chat_id: chatId, text: 'Xin lỗi, mình đang gặp lỗi. Bạn thử lại sau ít phút nhé.' });
    }

    return res.status(200).end();
}
