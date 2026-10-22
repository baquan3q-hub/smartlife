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
//   TELEGRAM_THINKING_BUDGET (tuỳ chọn) số token suy nghĩ tối đa của Gemini Flash, mặc định 1024
//
// Cài webhook (1 lần): mở trình duyệt
//   https://<domain>/api/telegram?setup=<TELEGRAM_WEBHOOK_SECRET>
//
// Luồng xử lý 1 câu hỏi:
//   1. Gửi ngay tin "đang tải" có thanh tiến trình (người dùng thấy bot phản hồi tức thì).
//   2. Nạp sẵn dữ liệu SmartLife cần cho nút bấm (song song), gắn vào lượt hỏi
//      → Gemini thường trả lời ngay ở lượt đầu, không tốn thêm 1 vòng gọi tool.
//   3. Sửa tin "đang tải" thành câu trả lời cuối + nút gợi ý tiếp theo.

import { TOOLS, TOOL_MAP, INSTRUCTIONS } from './_lib/tools.js';
import { ApiError } from './_lib/authKey.js';

const MODEL = process.env.TELEGRAM_GEMINI_MODEL || 'gemini-2.5-flash';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const ALLOWED_CHAT_ID = (process.env.TELEGRAM_ALLOWED_CHAT_ID || '').trim();
const SMARTLIFE_KEY = process.env.SMARTLIFE_API_KEY;
const TZ = 'Asia/Ho_Chi_Minh';

const rawBudget = process.env.TELEGRAM_THINKING_BUDGET;
const AGENT_THINKING_BUDGET = rawBudget === undefined || rawBudget === '' ? 1024 : Number(rawBudget);
// Nút bấm có sẵn dữ liệu chỉ cần tóm tắt → tắt "suy nghĩ" để nhanh gấp nhiều lần
const rawActionBudget = process.env.TELEGRAM_ACTION_THINKING_BUDGET;
const ACTION_THINKING_BUDGET = rawActionBudget === undefined || rawActionBudget === '' ? 0 : Number(rawActionBudget);

const MAX_TOOL_ROUNDS = 4;            // câu hỏi tự do: tối đa 4 vòng gọi tool (mỗi vòng Gemini ~5-12s)
const HISTORY_TURNS = 10;          // số tin nhắn gần nhất được nhớ
const TOOL_CACHE_TTL = 20_000;     // cache kết quả tool đọc trong 20s (xóa ngay khi có thao tác ghi)
const MAX_VOICE_SECONDS = 300;

const history = new Map();         // chatId -> [{ role, parts }]
const debugChats = new Set();      // chat bật /debug: hiện các tool đã gọi
const seenUpdates = new Set();     // chống xử lý trùng khi Telegram gửi lại
const pendingTx = new Map();       // id -> { description, transcript, createdAt }
const lockedTx = new Set();        // id giao dịch đang/đã ghi → chống bấm xác nhận 2 lần
const busyChats = new Map();       // chatId -> thời điểm bắt đầu trả lời (chống spam nút)
const lastRequests = new Map();    // chatId -> câu hỏi tự do gần nhất (cho nút Thử lại)
const BUSY_TTL = 55_000;           // khóa tự hết hạn: nếu function bị dừng giữa chừng, khóa không kẹt mãi
const RESPOND_BUDGET = 48_000;     // tổng thời gian cho 1 câu trả lời (Vercel cắt ở 60s)
const isBusy = (chatId) => {
    const at = busyChats.get(chatId);
    if (at && Date.now() - at < BUSY_TTL) return true;
    busyChats.delete(chatId);
    return false;
};
const toolCache = new Map();       // key -> { at, promise }

const EXPENSE_CATEGORIES = [
    'Ăn uống', 'Dating', 'Di chuyển', 'Caffe - giao lưu', 'Giáo dục', 'Mua sắm',
    'Tiền mạng', 'Đầu tư', 'Khác', 'Giải trí', 'Cho vay', 'Sức khỏe',
    'Hiếu hỉ', 'Nhà cửa', 'Du lịch', 'My Family', 'Trả nợ', 'Cống hiến',
];

const INCOME_CATEGORIES = [
    'Được tặng', 'Mom', 'Lương', 'Thưởng', 'Part Time', 'Khác',
    'Đầu tư', 'Bán hàng', 'Ăn uống', 'Chuyển khoản 🔄',
];

const TOOL_LABELS = {
    get_context: 'tổng quan',
    list_tasks: 'danh sách task',
    get_task: 'chi tiết task',
    create_task: 'tạo task',
    update_task: 'cập nhật task',
    reorder_tasks: 'sắp xếp Kanban',
    get_finance_overview: 'tài chính tháng',
    get_balance: 'số dư',
    list_transactions: 'giao dịch',
    get_finance_options: 'ví & danh mục',
    add_transaction: 'ghi giao dịch',
    delete_transaction: 'xóa giao dịch',
    list_insights: 'nhật ký AI',
    create_insight: 'ghi nhật ký AI',
};

// ---------------------------------------------------------------------------
// Tiện ích chung
// ---------------------------------------------------------------------------
function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatVnd(amount) {
    return Number(amount || 0).toLocaleString('vi-VN') + 'đ';
}

function vnTime() {
    return new Date().toLocaleTimeString('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

function vnToday() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()); // YYYY-MM-DD
}

// ---- Bảng: Telegram không có <table> → vẽ bảng chữ đều (monospace) trong <pre> ----
const TABLE_MAX_WIDTH = 34; // vừa 1 dòng trên màn hình điện thoại

const charWidth = (ch) => (/[\p{M}‍️]/u.test(ch) ? 0 : /\p{Extended_Pictographic}/u.test(ch) ? 2 : 1);
const textWidth = (s) => Array.from(s).reduce((w, ch) => w + charWidth(ch), 0);
const padCell = (s, w, right) => {
    const gap = ' '.repeat(Math.max(0, w - textWidth(s)));
    return right ? gap + s : s + gap;
};
function truncateCell(s, max) {
    if (textWidth(s) <= max) return s;
    let out = '';
    for (const ch of Array.from(s)) {
        if (textWidth(out + ch) > max - 1) break;
        out += ch;
    }
    return `${out}…`;
}

const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line);
const isTableDivider = (line) => /^[\s|:\-]+$/.test(line) && line.includes('-');
const isNumericCell = (s) => /^[-+]?\s?[\d.,]+\s*(đ|₫|k|tr|triệu|%)?$/i.test(s);

function renderTable(lines) {
    const rows = lines
        .filter((l) => !isTableDivider(l))
        .map((l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
            .map((c) => c.trim().replace(/\*\*|__|`|\*/g, '').replace(/<\/?[a-z][^>]*>/gi, '')));
    if (rows.length === 0) return '';
    const cols = Math.max(...rows.map((r) => r.length));
    rows.forEach((r) => { while (r.length < cols) r.push(''); });

    const body = rows.slice(1);
    const numeric = Array.from({ length: cols }, (_, c) => body.length > 0
        && body.every((r) => !r[c] || isNumericCell(r[c])) && body.some((r) => r[c]));
    const widths = Array.from({ length: cols }, (_, c) => Math.max(...rows.map((r) => textWidth(r[c]))));

    // Quá rộng → thu hẹp cột chữ rộng nhất (giữ nguyên cột số)
    const total = () => widths.reduce((a, b) => a + b, 0) + 2 * (cols - 1);
    while (total() > TABLE_MAX_WIDTH) {
        let widest = -1;
        widths.forEach((w, c) => { if (!numeric[c] && w > 6 && (widest < 0 || w > widths[widest])) widest = c; });
        if (widest < 0) break;
        widths[widest]--;
    }

    const line = (r) => r.map((cell, c) => padCell(truncateCell(cell, widths[c]), widths[c], numeric[c])).join('  ').trimEnd();
    const rule = '─'.repeat(total());
    const out = [line(rows[0]), rule];
    body.forEach((r, i) => {
        if (i === body.length - 1 && body.length > 1 && /^t[ổo]ng/i.test(r[0])) out.push(rule);
        out.push(line(r));
    });
    return `<pre>${escapeHtml(out.join('\n'))}</pre>`;
}

// Thay mỗi bảng Markdown bằng 1 mã giữ chỗ, vẽ xong mới gắn lại (tránh bị các bước định dạng khác làm hỏng)
function extractTables(md, store) {
    const lines = md.split('\n');
    const out = [];
    for (let i = 0; i < lines.length;) {
        if (!isTableRow(lines[i])) {
            out.push(lines[i++]);
            continue;
        }
        let j = i;
        while (j < lines.length && isTableRow(lines[j])) j++;
        const block = lines.slice(i, j);
        if (block.length >= 2) {
            store.push(renderTable(block));
            out.push(`\u0000${store.length - 1}\u0000`);
        } else {
            out.push(...block);
        }
        i = j;
    }
    return out.join('\n');
}

// Markdown đơn giản (từ Gemini) → HTML mà Telegram hỗ trợ
function markdownToTelegramHtml(md) {
    const tables = [];
    let s = escapeHtml(extractTables(String(md || ''), tables));
    s = s.replace(/```(?:\w+)?\n?([\s\S]*?)```/g, (_, code) => `<pre>${code}</pre>`);
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    s = s.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>');
    s = s.replace(/^\s*[-*]\s+/gm, '• ');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<i>$2</i>');
    s = s.replace(/\u0000(\d+)\u0000/g, (_, n) => tables[Number(n)] || '');
    return s;
}

function stripHtml(html) {
    return String(html || '').replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

// Cắt tin dài thành nhiều phần (Telegram giới hạn 4096 ký tự)
function chunk(text, size = 3900) {
    const parts = [];
    let rest = text;
    while (rest.length > size) {
        let cut = rest.lastIndexOf('\n', size);
        if (cut < size / 2) cut = size;
        // Không cắt giữa bảng: lùi về trước dòng đầu của bảng
        let tableStart = cut;
        while (tableStart > 0 && isTableRow(rest.slice(rest.lastIndexOf('\n', tableStart - 1) + 1, tableStart))
            && isTableRow(rest.slice(cut + 1).split('\n')[0] || '')) {
            tableStart = rest.lastIndexOf('\n', tableStart - 1);
        }
        if (tableStart !== cut && tableStart > size / 4) cut = tableStart;
        parts.push(rest.slice(0, cut));
        rest = rest.slice(cut).replace(/^\n/, '');
    }
    if (rest.trim()) parts.push(rest);
    return parts;
}

// ---------------------------------------------------------------------------
// Telegram API
// ---------------------------------------------------------------------------
async function tgCall(method, payload) {
    try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15_000),
        });
        return await res.json();
    } catch (err) {
        return { ok: false, description: String(err?.message || err) };
    }
}

// Bỏ màu nút + icon 3D nếu Telegram không nhận → trả lại emoji thường ở đầu chữ
function stripButtonStyles(markup) {
    if (!markup) return markup;
    const clean = (rows) => rows.map((row) => row.map(({ style, icon_custom_emoji_id: iconId, ...btn }) => {
        if (!iconId) return btn;
        const emoji = ICON_EMOJI_BY_ID.get(iconId);
        return { ...btn, text: emoji ? `${emoji} ${btn.text}` : btn.text };
    }));
    if (markup.inline_keyboard) return { ...markup, inline_keyboard: clean(markup.inline_keyboard) };
    if (markup.keyboard) return { ...markup, keyboard: clean(markup.keyboard) };
    return markup;
}

async function tg(method, payload) {
    let r = await tgCall(method, payload);
    // Hiệu ứng tin nhắn / màu nút / icon nút không được hỗ trợ → gửi lại bản đơn giản
    if (!r.ok && /effect|button|markup|keyboard|emoji|style|icon/i.test(r.description || '')) {
        const fallback = { ...payload };
        delete fallback.message_effect_id;
        if (fallback.reply_markup) fallback.reply_markup = stripButtonStyles(fallback.reply_markup);
        r = await tgCall(method, fallback);
    }
    return r;
}

const isNotModified = (r) => /not modified/i.test(r?.description || '');

function react(chatId, messageId, emoji) {
    if (!messageId) return Promise.resolve();
    return tgCall('setMessageReaction', {
        chat_id: chatId,
        message_id: messageId,
        reaction: emoji ? [{ type: 'emoji', emoji }] : [],
    });
}

async function sendHtml(chatId, html, extra = {}) {
    const r = await tg('sendMessage', {
        chat_id: chatId,
        text: html,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        ...extra,
    });
    if (r.ok) return r;
    return tg('sendMessage', { chat_id: chatId, text: stripHtml(html), ...(extra.reply_markup ? { reply_markup: extra.reply_markup } : {}) });
}

async function editHtml(chatId, messageId, html, replyMarkup) {
    const payload = {
        chat_id: chatId,
        message_id: messageId,
        text: html,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;
    let r = await tg('editMessageText', payload);
    if (r.ok || isNotModified(r)) return { ok: true };
    // HTML lỗi → sửa lại bằng text thuần
    const plain = { chat_id: chatId, message_id: messageId, text: stripHtml(html) };
    if (replyMarkup) plain.reply_markup = replyMarkup;
    r = await tg('editMessageText', plain);
    return { ok: r.ok || isNotModified(r) };
}

// ---------------------------------------------------------------------------
// Bàn phím & nút bấm
// ---------------------------------------------------------------------------
// ---- Icon 3D động cho nút (custom emoji) ----------------------------------
// Telegram cho phép gắn custom emoji làm icon nút (icon_custom_emoji_id) và tô màu nút (style).
// Bot tự tải bộ emoji 3D theo tên pack rồi khớp theo emoji gốc của từng nút:
//   TELEGRAM_EMOJI_PACK  tên 1 hoặc nhiều pack, cách nhau dấu phẩy (phần cuối link t.me/addemoji/<tên>)
//   TELEGRAM_BUTTON_ICONS (tuỳ chọn) JSON ghi đè thủ công, vd {"📅":"5368324170671202286"}
// Thử nhanh 1 pack trong chat: /icons <tên pack hoặc link>
const ICON_EMOJI_BY_ID = new Map();   // custom_emoji_id -> emoji gốc (để quay về emoji thường khi lỗi)
const ICON_CACHE_TTL = 6 * 60 * 60 * 1000;
let iconCache = { packs: '', at: 0, map: new Map() };
let iconPackOverride = null;          // pack thử bằng /icons (chỉ sống đến khi function khởi động lại)

const normEmoji = (e) => String(e || '').replace(/️/g, '');

function parsePackNames(input) {
    return String(input || '')
        .split(',')
        .map((s) => s.trim().replace(/^https?:\/\/t\.me\/(addemoji|addstickers)\//i, '').replace(/[/?#].*$/, ''))
        .filter(Boolean);
}

async function loadPackIcons(packName) {
    const r = await tgCall('getStickerSet', { name: packName });
    if (!r.ok) return { ok: false, error: r.description || 'Không tải được pack', map: new Map() };
    const map = new Map();
    for (const s of r.result?.stickers || []) {
        if (!s.custom_emoji_id) continue;
        for (const ch of Array.from(normEmoji(s.emoji))) {
            if (!map.has(ch)) map.set(ch, s.custom_emoji_id);
        }
        const whole = normEmoji(s.emoji);
        if (whole && !map.has(whole)) map.set(whole, s.custom_emoji_id);
    }
    return { ok: true, title: r.result?.title, isCustomEmoji: r.result?.sticker_type === 'custom_emoji', map };
}

async function getIconMap() {
    const packs = iconPackOverride ?? (process.env.TELEGRAM_EMOJI_PACK || '');
    if (iconCache.packs === packs && Date.now() - iconCache.at < ICON_CACHE_TTL) return iconCache.map;
    const map = new Map();
    for (const name of parsePackNames(packs)) {
        const { map: m } = await loadPackIcons(name);
        for (const [k, v] of m) if (!map.has(k)) map.set(k, v);
    }
    try {
        const manual = JSON.parse(process.env.TELEGRAM_BUTTON_ICONS || '{}');
        for (const [k, v] of Object.entries(manual)) if (v) map.set(normEmoji(k), String(v));
    } catch {
        console.warn('[telegram] TELEGRAM_BUTTON_ICONS không phải JSON hợp lệ');
    }
    for (const [k, v] of map) ICON_EMOJI_BY_ID.set(v, k);
    iconCache = { packs, at: Date.now(), map };
    return map;
}

// Tạo 1 nút: có icon 3D thì dùng icon + chữ, không thì emoji thường + chữ
function makeButton(emoji, label, icons, extra = {}) {
    const iconId = icons?.get(normEmoji(emoji));
    return iconId
        ? { text: label, icon_custom_emoji_id: iconId, ...extra }
        : { text: `${emoji} ${label}`, ...extra };
}

// Bàn phím tác vụ nhanh ghim thường trực dưới đáy màn hình chat (ReplyKeyboardMarkup)
// style: primary = xanh dương, success = xanh lá, danger = đỏ
const MAIN_LAYOUT = [
    [['schedule', 'primary'], ['tasks', 'danger']],
    [['finance', 'success'], ['habits', 'primary']],
    [['morning', 'success'], ['night', 'primary']],
];

async function getMainKeyboard() {
    const icons = await getIconMap();
    return {
        keyboard: MAIN_LAYOUT.map((row) => row.map(([id, style]) => {
            const a = ACTIONS[id];
            return makeButton(a.emoji, a.label, icons, { style });
        })),
        resize_keyboard: true,
        is_persistent: true,
        input_field_placeholder: 'Hỏi SmartLife hoặc gửi voice 🎙️',
    };
}

// /icons            → xem trạng thái icon 3D
// /icons <pack>     → thử 1 bộ emoji (tên hoặc link t.me/addemoji/...), hiện ngay bàn phím mới
// /icons off        → quay về emoji thường
async function handleIconsCommand(chatId, arg) {
    const needed = [...new Set([
        ...Object.values(ACTIONS).flatMap((a) => [a.emoji, a.chipEmoji]),
        '🔄',
    ].map(normEmoji))];
    const report = (map) => needed.map((e) => `${map.has(e) ? '✅' : '▫️'} ${e}`).join('  ');

    if (!arg) {
        const map = await getIconMap();
        const packs = iconPackOverride ?? (process.env.TELEGRAM_EMOJI_PACK || '');
        const matched = needed.filter((e) => map.has(e)).length;
        await sendHtml(chatId, [
            '✨ <b>ICON 3D CHO NÚT BẤM</b>',
            `Pack đang dùng: ${packs ? `<code>${escapeHtml(packs)}</code>` : '<i>(chưa có — đang dùng emoji thường)</i>'}`,
            `Khớp: <b>${matched}/${needed.length}</b> icon`,
            report(map),
            '',
            '🧪 <b>Thử 1 bộ emoji 3D:</b>',
            '1. Mở 1 bộ emoji động bất kỳ trên Telegram → Chia sẻ → Copy link (dạng <code>t.me/addemoji/TenPack</code>).',
            '2. Gửi: <code>/icons t.me/addemoji/TenPack</code>',
            '3. Ưng ý thì đặt biến <code>TELEGRAM_EMOJI_PACK=TenPack</code> trên Vercel để dùng lâu dài.',
            '',
            '↩️ <code>/icons off</code> để quay lại emoji thường.',
        ].join('\n'));
        return;
    }

    if (/^(off|tắt|tat)$/i.test(arg)) {
        iconPackOverride = '';
        await sendHtml(chatId, '↩️ Đã quay về emoji thường.', { reply_markup: await getMainKeyboard() });
        return;
    }

    const names = parsePackNames(arg);
    const results = await Promise.all(names.map(async (n) => ({ name: n, ...(await loadPackIcons(n)) })));
    const failed = results.filter((r) => !r.ok || !r.isCustomEmoji);
    const merged = new Map();
    for (const r of results) if (r.ok && r.isCustomEmoji) for (const [k, v] of r.map) if (!merged.has(k)) merged.set(k, v);
    const matched = needed.filter((e) => merged.has(e)).length;

    if (matched === 0) {
        await sendHtml(chatId, [
            '⚠️ <b>Pack này không dùng được cho nút.</b>',
            ...failed.map((r) => `• <code>${escapeHtml(r.name)}</code>: ${escapeHtml(r.ok ? 'đây là bộ sticker, cần bộ emoji (link t.me/addemoji/...)' : r.error)}`),
            results.some((r) => r.ok && r.isCustomEmoji) ? '• Pack không có emoji nào trùng với các nút (📅 🎯 💰 ⚡ 🌅 🌙…).' : '',
        ].filter(Boolean).join('\n'));
        return;
    }

    iconPackOverride = names.join(',');
    iconCache.at = 0; // tải lại theo pack mới
    const keyboard = await getMainKeyboard();
    await sendHtml(chatId, [
        `✨ <b>Đã áp dụng thử pack:</b> ${results.filter((r) => r.ok).map((r) => escapeHtml(r.title || r.name)).join(', ')}`,
        `Khớp <b>${matched}/${needed.length}</b> icon: ${report(merged)}`,
        '',
        '👇 Xem bàn phím mới bên dưới. Ưng ý thì đặt trên Vercel:',
        `<code>TELEGRAM_EMOJI_PACK=${escapeHtml(names.join(','))}</code>`,
        '<i>(Bản thử chỉ giữ đến lần bot khởi động lại.)</i>',
    ].join('\n'), { reply_markup: keyboard });
}

// So khớp chữ trên nút bấm (có hoặc không có emoji ở đầu)
const normLabel = (s) => String(s || '').replace(/^[^\p{L}\p{N}]+/u, '').trim().toLowerCase();

// Dữ liệu nạp sẵn theo từng loại câu hỏi (chạy song song trước khi gọi Gemini)
const PREFETCH = {
    context: () => ({ tool: 'get_context', args: {} }),
    finance: () => ({ tool: 'get_finance_overview', args: {} }),
    balance30: () => ({ tool: 'get_balance', args: { days: 30 } }),
    overdue: () => ({ tool: 'list_tasks', args: { overdue: true, limit: 30 } }),
    todayTx: () => ({ tool: 'list_transactions', args: { from: vnToday(), to: vnToday(), limit: 50 } }),
    options: () => ({ tool: 'get_finance_options', args: {} }),
};

// Mọi tác vụ nhanh (nút bàn phím, lệnh /slash, nút gợi ý) đều khai báo ở đây
const ACTIONS = {
    schedule: {
        button: '📅 Lịch trình hôm nay',
        chip: '📅 Lịch trình',
        loading: 'Đang mở lịch trình hôm nay',
        cat: 'schedule',
        prefetch: ['context'],
        prompt: 'Kiểm tra và tóm tắt chi tiết lịch trình hôm nay của tôi (bao gồm thời khóa biểu học tập, môn học, ca học, phòng học, giảng viên và các sự kiện/cuộc hẹn). Nếu có từ 2 mục trở lên, trình bày bảng: Giờ | Môn/Sự kiện | Phòng. Nếu không có lịch cố định, hãy thông báo ngắn gọn.',
    },
    tasks: {
        button: '🎯 Top việc cần làm',
        chip: '🎯 Top việc',
        loading: 'Đang xếp hạng việc cần làm',
        cat: 'tasks',
        prefetch: ['context'],
        prompt: 'Kiểm tra danh sách công việc (Kanban tasks) của tôi. Liệt kê các task có độ ưu tiên cao nhất (urgent/focus), task có hạn chót hôm nay hoặc đang quá hạn. Trình bày bảng: Task | Hạn | Ưu tiên (tối đa 8 dòng, sắp theo thứ tự nên làm), sau đó đề xuất ngắn thứ tự xử lý trong ngày.',
    },
    finance: {
        button: '💰 Số dư & Chi tiêu',
        chip: '💰 Số dư ví',
        loading: 'Đang kiểm tra ví & ngân sách',
        cat: 'finance',
        prefetch: ['context', 'finance'],
        prompt: 'Báo cáo tài chính cho tôi: Số dư khả dụng hiện tại là bao nhiêu? Chi tiêu tháng này so với ngân sách thế nào? Có danh mục nào đang chi vượt hạn mức hoặc các hóa đơn định kỳ sắp tới trong 7 ngày không?',
    },
    habits: {
        button: '⚡ Thói quen hôm nay',
        chip: '⚡ Thói quen',
        loading: 'Đang xem streak thói quen',
        cat: 'habits',
        prefetch: ['context'],
        prompt: 'Kiểm tra tình hình rèn luyện thói quen (habits) của tôi trong SmartLife hôm nay: những thói quen nào đã hoàn thành, những thói quen nào chưa làm, streak (chuỗi ngày liên tục) của từng thói quen. Trình bày bảng: Thói quen | Hôm nay | Streak (Hôm nay ghi Xong / Chưa). Sau đó nhắc nhở và động viên tôi hoàn thành!',
    },
    morning: {
        button: '🌅 Khởi động ngày',
        chip: '🌅 Khởi động ngày',
        loading: 'Đang chuẩn bị bản tin buổi sáng',
        cat: 'morning',
        // Cần cả tài chính tháng để có "hạn mức chi an toàn mỗi ngày" (thiếu thì Gemini tốn thêm 1 vòng ~10s)
        prefetch: ['context', 'finance'],
        prompt: 'Chào buổi sáng! Hãy tổng hợp bức tranh toàn cảnh khởi động ngày mới cho tôi: lịch trình hôm nay, 3 việc quan trọng nhất cần giải quyết, hạn mức chi tiêu an toàn cho ngày hôm nay và một câu truyền cảm hứng ngắn gọn.',
    },
    night: {
        button: '🌙 Tổng kết cuối ngày',
        chip: '🌙 Tổng kết ngày',
        loading: 'Đang tổng kết ngày hôm nay',
        cat: 'night',
        prefetch: ['context', 'todayTx'],
        prompt: 'Tổng kết cuối ngày cho tôi: hôm nay tôi đã hoàn thành những task nào, chi tiêu bao nhiêu tiền, thói quen duy trì ra sao? Đánh giá ngắn gọn năng suất làm việc hôm nay và gợi ý 1-2 việc cần lưu ý cho ngày mai.',
    },
    overdue: {
        button: '⚠️ Task quá hạn',
        chip: '⚠️ Task quá hạn',
        loading: 'Đang lục task quá hạn',
        cat: 'tasks',
        prefetch: ['overdue'],
        prompt: 'Liệt kê chi tiết các task đang quá hạn (overdue) của tôi Trình bày bảng: Task | Hạn cũ | Trễ (số ngày), sau đó gợi ý giải pháp xử lý nhanh cho 3 việc quan trọng nhất.',
    },
    pomodoro: {
        button: '🍅 Khung giờ Pomodoro',
        chip: '🍅 Pomodoro',
        loading: 'Đang tìm khung giờ vàng',
        cat: 'tasks',
        prefetch: ['context'],
        prompt: 'Dựa vào lịch trình và danh sách task cần làm hôm nay, hãy gợi ý cho tôi 2-3 khung giờ vàng để bật Pomodoro tập trung sâu (Deep Work). Trình bày bảng: Khung giờ | Việc | Số phiên.',
    },
    bills: {
        button: '🧾 Hóa đơn 7 ngày tới',
        chip: '🧾 Hóa đơn 7 ngày',
        loading: 'Đang kiểm tra hóa đơn sắp tới',
        cat: 'finance',
        // Chỉ cần dữ liệu tài chính tháng (đã có hóa đơn định kỳ, nợ) → gửi Gemini ít dữ liệu hơn, trả lời nhanh hơn
        prefetch: ['finance'],
        prompt: 'Kiểm tra các hóa đơn định kỳ, tiền nhà, tiền dịch vụ hoặc các khoản nợ cần thanh toán trong 7 ngày tới. Trình bày bằng bảng 3 cột: Khoản | Hạn | Số tiền, dòng cuối là Tổng. Nếu không có khoản nào, nói ngắn gọn là không có.',
    },
    balance30: {
        button: '📊 Biến động 30 ngày',
        chip: '📊 Biến động 30 ngày',
        loading: 'Đang xem biến động số dư',
        cat: 'finance',
        prefetch: ['balance30'],
        prompt: 'Kiểm tra biến động số dư 30 ngày qua: số dư đầu kỳ, hiện tại, tổng thu, tổng chi. Trình bày các lần điều chỉnh số dư và giao dịch lớn gần đây bằng bảng 3 cột: Ngày | Nội dung | Số tiền (dấu + / -).',
    },
};

// Tách emoji ở đầu và phần chữ để có thể thay emoji bằng icon 3D
const splitEmoji = (s) => {
    const [emoji, ...rest] = s.split(' ');
    return [emoji, rest.join(' ')];
};
for (const a of Object.values(ACTIONS)) {
    [a.emoji, a.label] = splitEmoji(a.button);
    [a.chipEmoji, a.chipLabel] = splitEmoji(a.chip);
}

// Khi có icon 3D, nút gửi lên chỉ còn phần chữ → so khớp theo chữ đã chuẩn hoá
const BUTTON_TO_ACTION = Object.fromEntries(Object.entries(ACTIONS).map(([id, a]) => [normLabel(a.button), id]));

const COMMAND_TO_ACTION = {
    '/today': 'tasks',
    '/schedule': 'schedule',
    '/finance': 'finance',
    '/overdue': 'overdue',
    '/habits': 'habits',
    '/morning': 'morning',
    '/review': 'night',
    '/pomodoro': 'pomodoro',
    '/bills': 'bills',
};

// Nút gợi ý câu hỏi tiếp theo theo chủ đề
const CHIPS_BY_CATEGORY = {
    schedule: ['tasks', 'pomodoro'],
    tasks: ['overdue', 'pomodoro', 'schedule'],
    finance: ['bills', 'balance30', 'finance'],
    habits: ['tasks', 'night'],
    morning: ['tasks', 'schedule', 'finance'],
    night: ['habits', 'finance'],
};

async function buildChips(category, actionId = null) {
    const ids = (CHIPS_BY_CATEGORY[category] || []).filter((id) => id !== actionId).slice(0, 4);
    if (!ids.length && !actionId) return null;
    const icons = await getIconMap();
    const rows = [];
    for (let i = 0; i < ids.length; i += 2) {
        rows.push(ids.slice(i, i + 2).map((id) => makeButton(ACTIONS[id].chipEmoji, ACTIONS[id].chipLabel, icons, { callback_data: `cq:${id}` })));
    }
    if (actionId) rows.push([makeButton('🔄', 'Làm mới số liệu', icons, { callback_data: `rf:${actionId}`, style: 'primary' })]);
    return rows.length ? { inline_keyboard: rows } : null;
}

function detectCategory(text) {
    const s = String(text || '').toLowerCase();
    if (/task|việc|công việc|deadline|kanban/.test(s)) return 'tasks';
    if (/tiền|chi tiêu|số dư|ngân sách|chi phí|ví|giao dịch/.test(s)) return 'finance';
    if (/lịch|thời khóa biểu|tkb|tiết học|phòng học/.test(s)) return 'schedule';
    if (/thói quen|habit|streak/.test(s)) return 'habits';
    return null;
}

// ---------------------------------------------------------------------------
// Tin nhắn "đang tải" có thanh tiến trình → được sửa thành câu trả lời cuối
// ---------------------------------------------------------------------------
const BAR_TOTAL = 6;
const bar = (step) => '▰'.repeat(step) + '▱'.repeat(BAR_TOTAL - step);

function createProgress(chatId, { messageId = null, title = 'Đang suy nghĩ', prefixHtml = '' } = {}) {
    let msgId = messageId;
    let lastHtml = '';
    let queue = Promise.resolve();
    let typing = null;

    const startTyping = () => {
        tgCall('sendChatAction', { chat_id: chatId, action: 'typing' });
        typing = setInterval(() => tgCall('sendChatAction', { chat_id: chatId, action: 'typing' }), 4500);
    };
    const stopTyping = () => {
        if (typing) clearInterval(typing);
        typing = null;
    };

    const render = (step, line) => `${prefixHtml}${line}\n<code>${bar(step)}</code>`;

    async function show(step, line) {
        const html = render(step, line);
        if (html === lastHtml) return;
        lastHtml = html;
        if (msgId) {
            await editHtml(chatId, msgId, html);
        } else {
            const r = await sendHtml(chatId, html);
            msgId = r.result?.message_id || null;
        }
    }

    startTyping();
    queue = queue.then(() => show(1, `⏳ <i>${escapeHtml(title)}…</i>`));

    return {
        get messageId() {
            return msgId;
        },
        update(step, line) {
            queue = queue.then(() => show(step, line)).catch(() => {});
            return queue;
        },
        stop() {
            stopTyping();
            return queue;
        },
        // Câu trả lời cuối (markdown) thay vào chỗ tin "đang tải"
        async finish(markdown, replyMarkup = null) {
            stopTyping();
            await queue;
            const parts = chunk(markdown);
            if (parts.length === 0) parts.push('…');
            for (let i = 0; i < parts.length; i++) {
                const isLast = i === parts.length - 1;
                const html = (i === 0 ? prefixHtml : '') + markdownToTelegramHtml(parts[i]);
                const markup = isLast && replyMarkup ? replyMarkup : undefined;
                if (i === 0 && msgId) {
                    const r = await editHtml(chatId, msgId, html, markup);
                    if (r.ok) continue;
                }
                await sendHtml(chatId, html, markup ? { reply_markup: markup } : {});
            }
        },
        async fail(html, replyMarkup = null) {
            stopTyping();
            await queue;
            if (msgId) {
                const r = await editHtml(chatId, msgId, prefixHtml + html, replyMarkup || undefined);
                if (r.ok) return;
            }
            await sendHtml(chatId, prefixHtml + html, replyMarkup ? { reply_markup: replyMarkup } : {});
        },
    };
}

// ---------------------------------------------------------------------------
// Gọi tool SmartLife (có cache ngắn cho tool đọc)
// ---------------------------------------------------------------------------
const WRITE_TOOLS = new Set(['add_transaction', 'delete_transaction', 'create_task', 'update_task', 'reorder_tasks', 'create_insight']);

function cacheKey(name, args) {
    const a = { ...(args || {}) };
    if (a.tz === TZ) delete a.tz;
    const sorted = Object.keys(a).sort().reduce((o, k) => ((o[k] = a[k]), o), {});
    return `${name}:${JSON.stringify(sorted)}`;
}

async function runTool(name, args = {}) {
    const tool = TOOL_MAP.get(name);
    if (!tool) throw new ApiError(400, 'unknown_tool', `Không có tool ${name}`);

    if (WRITE_TOOLS.has(name)) {
        const result = await tool.run(SMARTLIFE_KEY, args);
        toolCache.clear(); // dữ liệu đã đổi → bỏ cache
        return result;
    }

    const key = cacheKey(name, args);
    const hit = toolCache.get(key);
    if (hit && Date.now() - hit.at < TOOL_CACHE_TTL) return hit.promise;

    // Truy vấn đọc bị treo quá 12s → báo lỗi để Gemini/người dùng biết, không chờ mãi
    let timer;
    const promise = Promise.race([
        tool.run(SMARTLIFE_KEY, args),
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new ApiError(504, 'timeout', `${name} quá 12 giây không phản hồi`)), 12_000);
        }),
    ]).finally(() => clearTimeout(timer));
    toolCache.set(key, { at: Date.now(), promise });
    promise.catch(() => toolCache.delete(key));
    if (toolCache.size > 50) {
        for (const [k, v] of toolCache) if (Date.now() - v.at > TOOL_CACHE_TTL) toolCache.delete(k);
    }
    return promise;
}

async function prefetchData(keys) {
    const specs = [...new Set(keys)].map((k) => PREFETCH[k]?.()).filter(Boolean);
    const results = await Promise.all(specs.map(async ({ tool, args }) => {
        try {
            return { tool, args, result: await runTool(tool, args) };
        } catch (err) {
            console.warn('[telegram] prefetch failed', tool, err?.message);
            return null; // Gemini sẽ tự gọi tool nếu thiếu
        }
    }));
    return results.filter(Boolean);
}

function buildDataBlock(fetched) {
    const lines = fetched.map(({ tool, args, result }) => {
        const argStr = Object.keys(args).length ? JSON.stringify(args) : '';
        return `### ${tool}(${argStr})\n${JSON.stringify(result)}`;
    });
    return `\n\n<smartlife_data fetched_at="${vnTime()}">\n${lines.join('\n\n')}\n</smartlife_data>`;
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

// Giới hạn "suy nghĩ" của Gemini 2.5 Flash để trả lời nhanh hơn
function generationConfig(base, thinkingBudget) {
    const cfg = { ...base };
    if (/gemini-2\.5-flash/i.test(MODEL) && Number.isFinite(thinkingBudget) && thinkingBudget >= 0) {
        cfg.thinkingConfig = { thinkingBudget };
    }
    return cfg;
}

// Hết thời gian cho phép (function Vercel tối đa 60s) → báo người dùng thay vì im lặng
class TimeBudgetError extends Error {}

// Lỗi từ Gemini, giữ lại mã HTTP để báo đúng nguyên nhân cho người dùng
class GeminiError extends Error {
    constructor(status, message, retryAfterSec = null) {
        super(message);
        this.status = status;
        this.retryAfterSec = retryAfterSec;
    }
}

// Model dự phòng có hạn mức riêng: dùng khi model chính bị 429 (hết lượt) / quá tải / quá chậm
const FALLBACK_MODEL = process.env.TELEGRAM_GEMINI_FALLBACK_MODEL ?? 'gemini-2.5-flash-lite';
const RETRYABLE = new Set([429, 500, 503, 504]);
const modelCooldown = new Map();   // model -> thời điểm được gọi lại sau khi bị 429

let keyIndex = 0;
async function callGemini(body, deadline = Date.now() + 45_000) {
    const keys = geminiKeys();
    if (keys.length === 0) throw new GeminiError(0, 'GEMINI_API_KEYS chưa được cấu hình.');

    // Thử lần lượt: model chính với từng key → model dự phòng với từng key.
    // Model vừa bị 429 được "nghỉ" một lúc để không phí lượt gọi ở các vòng sau.
    const all = [MODEL, ...(FALLBACK_MODEL && FALLBACK_MODEL !== MODEL ? [FALLBACK_MODEL] : [])];
    const ready = all.filter((m) => (modelCooldown.get(m) || 0) < Date.now());
    const models = ready.length ? ready : all;
    const plan = models.flatMap((model) => keys.map((_, i) => ({ model, key: keys[(keyIndex + i) % keys.length] })));

    let lastError = null;
    for (const { model, key } of plan) {
        const remaining = deadline - Date.now();
        if (remaining < 3_000) break;
        let res;
        try {
            res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                // Model chính không được ăn hết thời gian → chừa chỗ cho model dự phòng
                signal: AbortSignal.timeout(Math.min(model === MODEL && models.length > 1 ? 20_000 : 25_000, remaining)),
            });
        } catch (err) {
            lastError = new GeminiError(504, `${model}: quá thời gian chờ (${err?.name || 'network'})`);
            keyIndex++;
            continue;
        }
        if (res.ok) {
            if (model !== MODEL) console.warn('[telegram] dùng model dự phòng', model);
            return res.json();
        }
        const errBody = await res.json().catch(() => ({}));
        const retryDelay = errBody?.error?.details?.find((d) => d.retryDelay)?.retryDelay;
        lastError = new GeminiError(
            res.status,
            `${model}: ${errBody?.error?.status || 'HTTP'} ${res.status}${errBody?.error?.message ? ` — ${String(errBody.error.message).slice(0, 160)}` : ''}`,
            retryDelay ? parseInt(retryDelay, 10) : null,
        );
        console.warn('[telegram] gemini error', lastError.message);
        if (res.status === 429) modelCooldown.set(model, Date.now() + Math.min(120, lastError.retryAfterSec || 60) * 1000);
        if (!RETRYABLE.has(res.status)) throw lastError; // sai key / request lỗi → thử tiếp vô ích
        keyIndex++;
    }
    if (deadline - Date.now() < 3_000) throw new TimeBudgetError(lastError?.message || 'Hết thời gian chờ Gemini');
    throw lastError || new GeminiError(0, 'Gemini không phản hồi');
}

// Chuyển lỗi kỹ thuật thành câu dễ hiểu + mã lỗi ngắn để dễ báo lại
function describeError(err) {
    if (err instanceof TimeBudgetError) {
        return { title: '⏱️ AI phản hồi chậm quá nên mình dừng lại.', hint: 'Bấm Thử lại hoặc hỏi ngắn hơn nhé.', code: 'TIMEOUT' };
    }
    if (err instanceof GeminiError) {
        if (err.status === 429) {
            const wait = err.retryAfterSec ? `khoảng ${err.retryAfterSec} giây` : 'khoảng 1 phút';
            return { title: '🚦 AI đang hết lượt gọi (giới hạn miễn phí của Gemini).', hint: `Chờ ${wait} rồi bấm Thử lại nhé.`, code: 'GEMINI_429' };
        }
        if ([400, 401, 403, 404].includes(err.status)) {
            return { title: '🔑 Cấu hình Gemini có vấn đề (key hoặc tên model).', hint: 'Kiểm tra GEMINI_API_KEYS / TELEGRAM_GEMINI_MODEL trên Vercel.', code: `GEMINI_${err.status}` };
        }
        return { title: '🌩️ Máy chủ Gemini đang quá tải.', hint: 'Thử lại sau ít phút nhé.', code: `GEMINI_${err.status || 'NET'}` };
    }
    if (err instanceof ApiError) {
        return { title: '🗄️ Không lấy được dữ liệu SmartLife.', hint: 'Thử lại sau ít phút nhé.', code: `DB_${err.status}_${err.code}` };
    }
    return { title: '⚠️ Mình đang gặp lỗi khi xử lý.', hint: 'Bạn thử lại sau ít phút nhé.', code: 'INTERNAL' };
}

function systemPrompt() {
    const now = new Date().toLocaleString('vi-VN', { timeZone: TZ, dateStyle: 'full', timeStyle: 'short' });
    return [
        INSTRUCTIONS,
        `Bây giờ là ${now} (giờ Việt Nam).`,
        'Bạn đang trò chuyện qua Telegram với chính chủ tài khoản SmartLife.',
        'Trả lời bằng ngôn ngữ người dùng dùng, ngắn gọn, dễ đọc trên điện thoại: câu ngắn, gạch đầu dòng, **in đậm** con số quan trọng, mở đầu mỗi nhóm ý bằng 1 emoji phù hợp.',
        'BẢNG: khi có từ 3 dòng số liệu cùng loại trở lên (hóa đơn, giao dịch, chi tiêu theo danh mục, biến động/điều chỉnh số dư, task kèm hạn) → trình bày bằng bảng Markdown dạng | Cột 1 | Cột 2 | Cột 3 |, có dòng |---|. Tối đa 3 cột, tối đa 12 dòng; ô thật ngắn (≤ 14 ký tự), KHÔNG emoji và KHÔNG ** trong bảng; ngày dạng 25/10; tiền dạng 1.250.000đ (hoặc rút gọn 1,25tr / 450k nếu dài). Dòng tổng (nếu có) đặt cuối bảng. Sau bảng thêm 1-3 gạch đầu dòng nhận xét ngắn.',
        'Định dạng tiền kiểu 1.250.000đ. Không bịa số liệu: luôn dùng số MỚI NHẤT từ tool, kể cả khi đã trả lời câu tương tự trước đó.',
        'Nếu tin nhắn người dùng có khối <smartlife_data>, đó là kết quả tool vừa lấy trong CHÍNH lượt này (số liệu mới nhất): dùng trực tiếp, KHÔNG gọi lại các tool đó; chỉ gọi thêm tool khi khối này thiếu dữ liệu cần thiết. Không nhắc tới khối này với người dùng.',
        'Không bao giờ hiển thị phần [Ghi chú nội bộ] cho người dùng.',
        'Trước khi tạo, sửa hoặc sắp xếp lại task, nói rõ bạn sẽ làm gì và chờ người dùng đồng ý (trừ khi họ đã yêu cầu rõ ràng).',
    ].join('\n');
}

function rememberTurn(chatId, userText, modelText) {
    const past = history.get(chatId) || [];
    // Rút gọn câu trả lời dài khi lưu lịch sử (giữ ghi chú nội bộ ở cuối) → mỗi lượt gửi Gemini ít token hơn
    const note = modelText.match(/\n\n\[Ghi chú nội bộ[\s\S]*$/)?.[0] || '';
    const body = note ? modelText.slice(0, -note.length) : modelText;
    const short = body.length > 1200 ? `${body.slice(0, 1200)}…` : body;
    const updated = [...past, { role: 'user', parts: [{ text: userText }] }, { role: 'model', parts: [{ text: short + note }] }];
    history.set(chatId, updated.slice(-HISTORY_TURNS));
}

async function runAgent(chatId, userText, {
    prefetch = [],
    fresh = false,
    fast = false,                  // tác vụ nút bấm: dữ liệu đã nạp sẵn → trả lời nhanh
    onProgress = () => {},
    deadline = Date.now() + 45_000,
} = {}) {
    if (fresh) toolCache.clear();
    const past = history.get(chatId) || [];
    const toolsUsed = [];
    const memo = [];

    // Nạp sẵn dữ liệu → gắn vào lượt hỏi hiện tại (không lưu vào lịch sử để history gọn)
    let turnText = userText;
    let prefetched = false;
    if (prefetch.length) {
        const fetched = await prefetchData(prefetch);
        fetched.forEach((f) => toolsUsed.push(`⚡ ${f.tool} (nạp sẵn)`));
        if (fetched.length) turnText += buildDataBlock(fetched);
        prefetched = fetched.length === new Set(prefetch).size;
        onProgress(3, '🧠 <i>Đang phân tích dữ liệu…</i>');
    }

    // Chế độ nhanh: đủ dữ liệu → không "suy nghĩ" dài, tối đa 1 vòng gọi thêm tool
    const quick = fast && prefetched;
    const maxRounds = quick ? 1 : MAX_TOOL_ROUNDS;
    const thinking = quick ? ACTION_THINKING_BUDGET : AGENT_THINKING_BUDGET;

    const contents = [...past, { role: 'user', parts: [{ text: turnText }] }];

    for (let round = 0; round <= maxRounds; round++) {
        // Vòng cuối hoặc sắp hết giờ → bắt Gemini trả lời bằng chữ, không gọi tool nữa
        const mustAnswer = round === maxRounds || deadline - Date.now() < 15_000;
        const data = await callGemini({
            systemInstruction: { parts: [{ text: systemPrompt() }] },
            contents,
            tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
            ...(mustAnswer ? { toolConfig: { functionCallingConfig: { mode: 'NONE' } } } : {}),
            generationConfig: generationConfig({ temperature: 0.2 }, thinking),
        }, deadline);

        const content = data?.candidates?.[0]?.content;
        const parts = content?.parts || [];
        const calls = parts.filter((p) => p.functionCall);

        if (calls.length === 0 || mustAnswer) {
            const text = parts.filter((p) => !p.thought).map((p) => p.text || '').join('').trim()
                || 'Mình chưa có câu trả lời, bạn hỏi lại giúp mình nhé.';
            const remembered = memo.length ? `${text}\n\n[Ghi chú nội bộ, không hiển thị: ${memo.join(' | ')}]` : text;
            rememberTurn(chatId, userText, remembered);
            return { text, toolsUsed };
        }

        contents.push(content);
        const labels = [...new Set(calls.map((c) => TOOL_LABELS[c.functionCall.name] || c.functionCall.name))].join(', ');
        onProgress(4, `🔎 <i>Đang tra cứu: ${escapeHtml(labels)}…</i>`);

        const responses = await Promise.all(calls.map(async ({ functionCall }) => {
            let response;
            try {
                const result = await runTool(functionCall.name, functionCall.args || {});
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
        onProgress(5, '✍️ <i>Đang soạn câu trả lời…</i>');
    }
}

// Hỏi AI và hiển thị câu trả lời (dùng chung cho tin nhắn, nút bấm, voice)
async function respond(chatId, {
    prompt,
    prefetch = ['context'],
    actionId = null,
    category = null,
    loading = 'Đang suy nghĩ',
    editMessageId = null,
    prefixHtml = '',
    fresh = false,
}) {
    const started = Date.now();
    busyChats.set(chatId, started);
    // Nhớ yêu cầu gần nhất để nút "Thử lại" dùng được cả với câu hỏi tự do
    if (!actionId) lastRequests.set(chatId, { prompt, prefetch, category, loading });
    const progress = createProgress(chatId, { messageId: editMessageId, title: loading, prefixHtml });
    try {
        const { text, toolsUsed } = await runAgent(chatId, prompt, {
            prefetch,
            fresh,
            fast: Boolean(actionId),
            deadline: started + RESPOND_BUDGET,
            onProgress: (step, line) => progress.update(step, line),
        });
        const debugLine = debugChats.has(chatId)
            ? `\n\n🔧 ${toolsUsed.length ? toolsUsed.join('\n🔧 ') : '(không gọi công cụ nào)'}`
            : '';
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        const footer = `\n\n*🕒 Cập nhật ${vnTime()} · ${seconds}s*`;
        await progress.finish(text + debugLine + footer, await buildChips(category || ACTIONS[actionId]?.cat, actionId));
        return true;
    } catch (err) {
        console.error('[telegram] respond error', err);
        const { title, hint, code } = describeError(err);
        const retry = { inline_keyboard: [[{ text: '🔁 Thử lại', callback_data: actionId ? `rf:${actionId}` : 'rq:last', style: 'primary' }]] };
        const detail = debugChats.has(chatId) ? `\n<code>${escapeHtml(String(err?.message || err).slice(0, 300))}</code>` : '';
        await progress.fail(`<b>${title}</b>\n<i>${hint}</i>\n<code>Mã lỗi: ${escapeHtml(code)}</code>${detail}`, retry);
        return false;
    } finally {
        busyChats.delete(chatId);
    }
}

function respondAction(chatId, actionId, extra = {}) {
    const a = ACTIONS[actionId];
    return respond(chatId, {
        prompt: a.prompt,
        prefetch: a.prefetch,
        actionId,
        category: a.cat,
        loading: a.loading,
        ...extra,
    });
}

// ---------------------------------------------------------------------------
// Voice → giao dịch (thẻ xác nhận có thể đổi danh mục / thu-chi trước khi ghi)
// ---------------------------------------------------------------------------
function storePendingTx(data) {
    const id = Math.random().toString(36).substring(2, 8);
    pendingTx.set(id, { ...data, createdAt: Date.now() });
    if (pendingTx.size > 200) {
        const threshold = Date.now() - 30 * 60 * 1000;
        for (const [k, v] of pendingTx.entries()) if (v.createdAt < threshold) pendingTx.delete(k);
    }
    return id;
}

const categoriesFor = (isExpense) => (isExpense ? EXPENSE_CATEGORIES : INCOME_CATEGORIES);

function categoryIndex(isExpense, name) {
    const list = categoriesFor(isExpense);
    const idx = list.indexOf(name);
    return idx >= 0 ? idx : list.indexOf('Khác');
}

// Mã hoá trạng thái giao dịch vào callback_data (≤ 64 byte): <id>:<e|i>:<amount>:<catIdx>
const txState = (tx) => `${tx.id}:${tx.isExpense ? 'e' : 'i'}:${Math.round(tx.amount)}:${tx.catIdx}`;

function renderTxCard(tx) {
    const sign = tx.isExpense ? '-' : '+';
    const category = categoriesFor(tx.isExpense)[tx.catIdx];
    const html = [
        '🎙️ <b>GHI NHẬN TỪ GIỌNG NÓI</b>',
        tx.transcript ? `<blockquote>"${escapeHtml(tx.transcript)}"</blockquote>` : '',
        `${tx.isExpense ? '💸 <b>Khoản chi</b>' : '💰 <b>Khoản thu</b>'}  <b>${sign}${formatVnd(tx.amount)}</b>`,
        `├ 🏷️ Danh mục: <b>${escapeHtml(category)}</b>`,
        `├ 📝 Nội dung: ${escapeHtml(tx.description)}`,
        '└ 💳 Ví: <b>Cash</b>',
        '',
        '<i>Kiểm tra lại rồi bấm ✅ để ghi sổ nhé.</i>',
    ].filter((l, i) => l !== '' || i > 1).join('\n');

    const s = txState(tx);
    const markup = {
        inline_keyboard: [
            [
                { text: '✅ Ghi sổ', callback_data: `ok:${s}`, style: 'success' },
                { text: '✖️ Hủy', callback_data: `no:${tx.id}`, style: 'danger' },
            ],
            [
                { text: '🏷️ Đổi danh mục', callback_data: `cs:${s}` },
                { text: tx.isExpense ? '🔄 Chuyển thành Thu' : '🔄 Chuyển thành Chi', callback_data: `tt:${s}` },
            ],
        ],
    };
    return { html, markup };
}

function renderCategoryPicker(tx) {
    const list = categoriesFor(tx.isExpense);
    const rows = [];
    for (let i = 0; i < list.length; i += 3) {
        rows.push(list.slice(i, i + 3).map((name, j) => {
            const idx = i + j;
            const picked = idx === tx.catIdx;
            return {
                text: picked ? `✅ ${name}` : name,
                callback_data: `cp:${tx.id}:${tx.isExpense ? 'e' : 'i'}:${Math.round(tx.amount)}:${idx}`,
                ...(picked ? { style: 'success' } : {}),
            };
        }));
    }
    rows.push([{ text: '⬅️ Quay lại', callback_data: `cb:${txState(tx)}` }]);
    return { inline_keyboard: rows };
}

// Dựng lại giao dịch từ callback_data; mô tả lấy từ bộ nhớ hoặc đọc lại từ chính tin nhắn
function txFromCallback(query, id, typeFlag, amountStr, catStr) {
    const stored = pendingTx.get(id);
    const isExpense = typeFlag !== 'i';
    const list = categoriesFor(isExpense);
    let catIdx = Number(catStr);
    if (!Number.isInteger(catIdx) || catIdx < 0 || catIdx >= list.length) catIdx = list.indexOf('Khác');
    const msgText = query.message?.text || '';
    const description = stored?.description
        || (msgText.match(/Nội dung:\s*(.+)/)?.[1] || '').trim()
        || list[catIdx];
    const transcript = stored?.transcript || (msgText.match(/"([^"\n]+)"/)?.[1] || '');
    return { id, isExpense, amount: Number(amountStr) || 0, catIdx, description, transcript };
}

async function processVoiceMessage(voice) {
    const fileInfo = await tg('getFile', { file_id: voice.file_id });
    if (!fileInfo.ok || !fileInfo.result?.file_path) throw new Error('Không thể tải file voice từ máy chủ Telegram.');

    const res = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.result.file_path}`, {
        signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error('Tải file âm thanh thất bại.');
    const base64Audio = Buffer.from(await res.arrayBuffer()).toString('base64');

    const prompt = `Bạn là trợ lý AI phân tích giọng nói tiếng Việt cho ứng dụng SmartLife.
Nghe đoạn âm thanh và xác định người dùng đang:
1. Ghi nhận giao dịch chi tiêu hoặc thu nhập, hoặc
2. Hỏi / yêu cầu việc khác.

Nếu là GIAO DỊCH TÀI CHÍNH (VD: "ăn trưa 45k", "mua keo dán 20k", "uống cafe 29k", "được thưởng 500k"):
- type: "expense" (chi tiêu, mặc định) hoặc "income" (thu tiền, được cho, lương).
- amount: số tiền VNĐ nguyên (45k → 45000, 1tr2 → 1200000).
- category: chọn 1 danh mục khớp nhất:
  Chi tiêu: ${JSON.stringify(EXPENSE_CATEGORIES)}
  Thu nhập: ${JSON.stringify(INCOME_CATEGORIES)}
- description: nội dung ngắn gọn (VD: "Ăn trưa bánh cuốn", "Cafe Highland").
- transcript: câu nói nguyên văn.
- is_transaction: true

Nếu KHÔNG phải giao dịch: { "is_transaction": false, "transcript": "<câu nói nguyên văn>" }

Chỉ trả về JSON, ví dụ:
{"is_transaction":true,"type":"expense","amount":45000,"category":"Ăn uống","description":"Ăn trưa bánh cuốn","transcript":"trưa nay tôi ăn bánh cuốn 45k"}`;

    const data = await callGemini({
        contents: [{
            parts: [
                { inlineData: { mimeType: voice.mime_type || 'audio/ogg', data: base64Audio } },
                { text: prompt },
            ],
        }],
        // Bài trích xuất đơn giản → tắt "suy nghĩ" cho nhanh
        generationConfig: generationConfig({ temperature: 0.1, responseMimeType: 'application/json' }, 0),
    });

    const rawText = (data?.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('') || '{}';
    try {
        return JSON.parse(rawText.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    } catch (_) {
        return { is_transaction: false, transcript: rawText };
    }
}

async function handleVoiceMessage(chatId, voice, userMsgId) {
    react(chatId, userMsgId, '✍');

    if (voice.duration && voice.duration > MAX_VOICE_SECONDS) {
        await sendHtml(chatId, `⏱️ Đoạn ghi âm dài quá (${voice.duration}s). Bạn gửi đoạn ngắn hơn ${MAX_VOICE_SECONDS / 60} phút giúp mình nhé.`);
        return;
    }

    const listening = createProgress(chatId, { title: 'Đang nghe ghi âm' });
    let result;
    try {
        result = await processVoiceMessage(voice);
    } catch (err) {
        console.error('[telegram] voice processing error:', err);
        await listening.fail('⚠️ <b>Không nhận diện được đoạn ghi âm.</b>\n<i>Bạn thử nói rõ hơn hoặc gõ tin nhắn nhé.</i>');
        await react(chatId, userMsgId, '🤷');
        return;
    }
    await listening.stop();

    const amount = Math.round(Number(result.amount) || 0);
    if (result.is_transaction && amount > 0) {
        const isExpense = result.type !== 'income';
        const transcript = String(result.transcript || '').slice(0, 300);
        const description = String(result.description || transcript || 'Giao dịch').slice(0, 120);
        const id = storePendingTx({ description, transcript });
        const tx = { id, isExpense, amount, catIdx: categoryIndex(isExpense, result.category), description, transcript };
        const { html, markup } = renderTxCard(tx);
        const r = listening.messageId ? await editHtml(chatId, listening.messageId, html, markup) : { ok: false };
        if (!r.ok) await sendHtml(chatId, html, { reply_markup: markup });
        await react(chatId, userMsgId, '👌');
        return;
    }

    // Không phải giao dịch → chuyển nội dung sang AI trả lời, giữ transcript ở đầu tin
    const transcript = String(result.transcript || '').trim();
    if (!transcript) {
        await listening.fail('🤔 <b>Mình không nghe rõ.</b>\n<i>Bạn nói lại hoặc gõ tin nhắn nhé.</i>');
        return;
    }
    const ok = await respond(chatId, {
        prompt: transcript,
        category: detectCategory(transcript),
        editMessageId: listening.messageId,
        prefixHtml: `🎙️ <blockquote>"${escapeHtml(transcript)}"</blockquote>\n`,
    });
    await react(chatId, userMsgId, ok ? '👌' : '🤷');
}

async function confirmTransaction(query, chatId, messageId, tx) {
    if (lockedTx.has(tx.id)) {
        await tg('answerCallbackQuery', { callback_query_id: query.id, text: 'Giao dịch này đang/đã được ghi rồi.' });
        return;
    }
    lockedTx.add(tx.id);
    if (lockedTx.size > 500) lockedTx.clear();

    const category = categoriesFor(tx.isExpense)[tx.catIdx];
    const sign = tx.isExpense ? '-' : '+';
    await tg('answerCallbackQuery', { callback_query_id: query.id, text: '⏳ Đang ghi sổ…' });
    // Bỏ nút ngay để không bấm lại được
    await editHtml(chatId, messageId, `⏳ <b>Đang ghi sổ…</b>\n<code>${bar(3)}</code>\n${sign}${formatVnd(tx.amount)} · ${escapeHtml(category)}`);

    try {
        const res = await runTool('add_transaction', {
            amount: tx.amount,
            category,
            description: tx.description,
            type: tx.isExpense ? 'expense' : 'income',
            wallet: 'Cash',
        });
        pendingTx.delete(tx.id);

        const balanceAfter = res?.wallet_balance_after != null ? formatVnd(res.wallet_balance_after) : null;
        const html = [
            '✅ <b>ĐÃ GHI SỔ THÀNH CÔNG</b>',
            '━━━━━━━━━━━━━━━━━━',
            `${tx.isExpense ? '💸' : '💰'} <b>${sign}${formatVnd(tx.amount)}</b> · ${escapeHtml(category)}`,
            `📝 ${escapeHtml(tx.description)}`,
            balanceAfter ? `💳 Cash còn <b>${balanceAfter}</b>` : '💳 Ví Cash đã cập nhật',
            '━━━━━━━━━━━━━━━━━━',
            `<i>☁️ Đã đồng bộ SmartLife • ${vnTime()}</i>`,
        ].join('\n');
        const markup = {
            inline_keyboard: [[
                ...(res?.id ? [{ text: '↩️ Hoàn tác', callback_data: `undo:${res.id}`, style: 'danger' }] : []),
                { text: '💰 Xem số dư', callback_data: 'cq:finance' },
            ]],
        };
        await editHtml(chatId, messageId, html, markup);

        // Cho AI biết id giao dịch để người dùng có thể nói "hoàn tác" trong chat
        rememberTurn(
            chatId,
            `(Tôi vừa bấm xác nhận ghi ${tx.isExpense ? 'khoản chi' : 'khoản thu'} ${formatVnd(tx.amount)} - ${category} - ${tx.description} từ voice)`,
            `Đã ghi sổ. [Ghi chú nội bộ, không hiển thị: add_transaction → id=${res?.id ?? '?'}${res?.summary ? ` (${res.summary})` : ''}]`,
        );
    } catch (err) {
        lockedTx.delete(tx.id);
        console.error('[telegram] callback add_transaction error:', err);
        const { html, markup } = renderTxCard(tx);
        await editHtml(chatId, messageId, `⚠️ <b>Ghi sổ thất bại:</b> ${escapeHtml(err.message)}\n\n${html}`, markup);
    }
}

async function undoTransaction(query, chatId, messageId, txId) {
    await tg('answerCallbackQuery', { callback_query_id: query.id, text: '↩️ Đang hoàn tác…' });
    try {
        const res = await runTool('delete_transaction', { id: txId });
        const oldLine = (query.message?.text || '').split('\n').find((l) => /[-+][\d.]+đ/.test(l)) || '';
        const html = [
            '↩️ <b>ĐÃ HOÀN TÁC GIAO DỊCH</b>',
            '━━━━━━━━━━━━━━━━━━',
            oldLine ? `<s>${escapeHtml(oldLine)}</s>` : '',
            `<i>${escapeHtml(res?.summary || 'Số dư ví đã được hoàn lại.')}</i>`,
        ].filter(Boolean).join('\n');
        await editHtml(chatId, messageId, html, { inline_keyboard: [[{ text: '💰 Xem số dư', callback_data: 'cq:finance' }]] });
    } catch (err) {
        const msg = err instanceof ApiError && err.status === 404 ? 'Giao dịch đã được hoàn tác trước đó.' : `Không hoàn tác được: ${err.message}`;
        await sendHtml(chatId, `⚠️ ${escapeHtml(msg)}`);
    }
}

// ---------------------------------------------------------------------------
// Xử lý nút bấm tương tác (Inline Keyboard Callback)
// ---------------------------------------------------------------------------
async function handleCallbackQuery(query) {
    const data = query.data || '';
    const chatId = String(query.message?.chat?.id || query.from?.id);
    const messageId = query.message?.message_id;
    const answer = (text, alert = false) => tg('answerCallbackQuery', { callback_query_id: query.id, ...(text ? { text, show_alert: alert } : {}) });

    if (!ALLOWED_CHAT_ID || chatId !== ALLOWED_CHAT_ID) {
        await answer('Bạn không có quyền thao tác trên bot này.', true);
        return;
    }

    const [kind, ...rest] = data.split(':');

    // Nút gợi ý (cq) và làm mới số liệu tại chỗ (rf)
    if (kind === 'cq' || kind === 'rf') {
        const actionId = rest[0];
        if (!ACTIONS[actionId]) return answer();
        if (isBusy(chatId)) return answer('⏳ Mình đang trả lời câu trước, chờ vài giây rồi bấm lại nhé.', true);
        const isRefresh = kind === 'rf';
        await answer(isRefresh ? '🔄 Đang làm mới…' : `⚡ ${ACTIONS[actionId].chip}`);
        if (isRefresh) {
            await respondAction(chatId, actionId, { editMessageId: messageId, fresh: true });
        } else {
            // Gỡ nút trên tin cũ cho gọn khung chat, câu trả lời mới hiện ở tin tiếp theo
            if (messageId) tgCall('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });
            await respondAction(chatId, actionId);
        }
        return;
    }

    // Thử lại câu hỏi tự do gần nhất (sửa ngay trên tin báo lỗi)
    if (kind === 'rq') {
        const last = lastRequests.get(chatId);
        if (!last) return answer('Không còn câu hỏi trước đó, bạn gửi lại giúp mình nhé.', true);
        if (isBusy(chatId)) return answer('⏳ Mình đang trả lời câu trước, chờ vài giây rồi bấm lại nhé.', true);
        await answer('🔁 Đang thử lại…');
        await respond(chatId, { ...last, editMessageId: messageId });
        return;
    }

    if (kind === 'undo') return undoTransaction(query, chatId, messageId, rest[0]);

    if (kind === 'no') {
        pendingTx.delete(rest[0]);
        await answer('Đã hủy giao dịch.');
        await editHtml(chatId, messageId, '🗑️ <b>ĐÃ HỦY GIAO DỊCH</b>\n<i>Không có gì được ghi vào SmartLife.</i>');
        return;
    }

    if (['ok', 'cs', 'cp', 'cb', 'tt'].includes(kind)) {
        const [id, typeFlag, amountStr, catStr] = rest;
        const tx = txFromCallback(query, id, typeFlag, amountStr, catStr);
        if (!tx.amount) return answer('Giao dịch không hợp lệ.', true);
        if (lockedTx.has(id)) return answer('Giao dịch này đã được ghi rồi.');

        if (kind === 'ok') return confirmTransaction(query, chatId, messageId, tx);

        if (kind === 'cs') {
            await answer('Chọn danh mục mới 👇');
            await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: renderCategoryPicker(tx) });
            return;
        }

        if (kind === 'tt') {
            tx.isExpense = !tx.isExpense;
            tx.catIdx = categoryIndex(tx.isExpense, 'Khác');
            await answer(tx.isExpense ? '💸 Đã chuyển thành khoản chi' : '💰 Đã chuyển thành khoản thu');
        } else {
            await answer(kind === 'cp' ? `🏷️ ${categoriesFor(tx.isExpense)[tx.catIdx]}` : undefined);
        }
        const { html, markup } = renderTxCard(tx);
        await editHtml(chatId, messageId, html, markup);
        return;
    }

    await answer();
}

// ---------------------------------------------------------------------------
// Tin nhắn
// ---------------------------------------------------------------------------
const WELCOME_HTML = [
    '👋 <b>Chào bạn, mình là trợ lý SmartLife!</b>',
    '<blockquote>Mình đọc dữ liệu thật trong SmartLife để trả lời: task, lịch, tài chính, thói quen.</blockquote>',
    '',
    '⚡ <b>Tác vụ nhanh</b> — chạm bàn phím bên dưới',
    '📅 Lịch trình  ·  🎯 Top việc  ·  💰 Tài chính',
    '⚡ Thói quen  ·  🌅 Khởi động  ·  🌙 Tổng kết',
    '',
    '🎙️ <b>Ghi chi tiêu bằng giọng nói</b>',
    '<i>"Trưa nay ăn bún chả 45k"</i> → thẻ xác nhận, đổi danh mục, ghi sổ 1 chạm, hoàn tác được.',
    '',
    '⌨️ <b>Lệnh nhanh</b>',
    '<code>/spend 45k ăn trưa</code>  ·  /overdue  ·  /bills  ·  /reset',
    '',
    '💬 <i>Hoặc cứ nhắn tự do bất cứ điều gì bạn muốn hỏi!</i>',
].join('\n');

async function handleMessage(msg) {
    const chatId = String(msg.chat.id);
    const text = (msg.text || '').trim();
    const command = text.split(/\s|@/)[0].toLowerCase();

    // Lệnh xem id không cần kiểm tra quyền
    if (command === '/id') {
        await sendHtml(chatId, `🆔 Chat id của bạn: <code>${chatId}</code>`);
        return;
    }

    // Khóa bot riêng tư cho chủ tài khoản
    if (!ALLOWED_CHAT_ID || chatId !== ALLOWED_CHAT_ID) {
        await sendHtml(chatId, ALLOWED_CHAT_ID
            ? '🔒 Đây là bot riêng tư.'
            : `Bot chưa được khóa cho ai. Chat id của bạn là <code>${chatId}</code> — đặt biến TELEGRAM_ALLOWED_CHAT_ID=${chatId} trên Vercel rồi redeploy.`);
        return;
    }

    if (!SMARTLIFE_KEY) {
        await sendHtml(chatId, 'Thiếu biến SMARTLIFE_API_KEY trên Vercel.');
        return;
    }

    // Tin nhắn VOICE hoặc AUDIO
    if (msg.voice || msg.audio) {
        await handleVoiceMessage(chatId, msg.voice || msg.audio, msg.message_id);
        return;
    }

    if (!text) return;

    if (command === '/start' || command === '/menu') {
        await sendHtml(chatId, WELCOME_HTML, { reply_markup: await getMainKeyboard(), message_effect_id: '5046509860389126442' }); // 🎉
        return;
    }

    if (command === '/icons') {
        await handleIconsCommand(chatId, text.replace(/^\/icons(@\S+)?\s*/i, '').trim());
        return;
    }

    if (command === '/debug') {
        const on = !debugChats.has(chatId);
        if (on) debugChats.add(chatId); else debugChats.delete(chatId);
        await sendHtml(chatId, on ? '🔧 Đã <b>BẬT</b> debug: mỗi câu trả lời kèm danh sách công cụ đã dùng.' : '🔧 Đã <b>TẮT</b> debug.');
        return;
    }

    if (command === '/reset') {
        history.delete(chatId);
        toolCache.clear();
        await sendHtml(chatId, '🧹 Đã bắt đầu cuộc trò chuyện mới.', { reply_markup: await getMainKeyboard() });
        return;
    }

    if (isBusy(chatId)) {
        await sendHtml(chatId, '⏳ <i>Mình đang trả lời câu trước, bạn chờ chút rồi gửi lại nhé.</i>');
        return;
    }

    react(chatId, msg.message_id, '👀');
    let ok;
    const actionId = BUTTON_TO_ACTION[normLabel(text)] || COMMAND_TO_ACTION[command];
    if (actionId) {
        ok = await respondAction(chatId, actionId);
    } else if (command === '/spend') {
        const restText = text.replace(/^\/spend(@\S+)?\s*/i, '');
        ok = await respond(chatId, {
            prompt: restText ? `Ghi khoản chi: ${restText}` : 'Tôi muốn ghi một khoản chi, hãy hỏi tôi số tiền và nội dung.',
            prefetch: restText ? ['options'] : [],
            category: 'finance',
            loading: 'Đang ghi khoản chi',
        });
    } else {
        ok = await respond(chatId, { prompt: text, category: detectCategory(text) });
    }
    await react(chatId, msg.message_id, ok ? '👌' : '🤷');
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
            { command: 'bills', description: 'Hóa đơn cần trả trong 7 ngày tới' },
            { command: 'overdue', description: 'Danh sách task quá hạn' },
            { command: 'habits', description: 'Tiến độ thói quen hôm nay' },
            { command: 'morning', description: 'Bản tin khởi động ngày' },
            { command: 'pomodoro', description: 'Gợi ý khung giờ tập trung' },
            { command: 'review', description: 'Tổng kết ngày' },
            { command: 'spend', description: 'Ghi nhanh khoản chi, vd /spend 45k ăn trưa' },
            { command: 'reset', description: 'Bắt đầu cuộc trò chuyện mới' },
            { command: 'icons', description: 'Đổi icon 3D động cho các nút bấm' },
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

    let update;
    try {
        update = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    } catch {
        return res.status(200).end();
    }

    // Chống xử lý trùng khi Telegram gửi lại cùng 1 update
    if (update.update_id != null) {
        if (seenUpdates.has(update.update_id)) return res.status(200).end();
        if (seenUpdates.size > 500) seenUpdates.clear();
        seenUpdates.add(update.update_id);
    }

    try {
        if (update.callback_query) await handleCallbackQuery(update.callback_query);
        else if (update.message) await handleMessage(update.message);
    } catch (err) {
        console.error('[telegram] error', err);
        const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
        if (chatId) await sendHtml(String(chatId), '⚠️ Xin lỗi, mình đang gặp lỗi. Bạn thử lại sau ít phút nhé.');
    }

    return res.status(200).end();
}
