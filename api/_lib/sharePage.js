// File: api/_lib/sharePage.js
// Trang công khai cho link chia sẻ task `/t/<token>`.
//
// Trang này được vẽ HOÀN TOÀN ở server và KHÔNG cần JavaScript:
// webview trong Zalo / Messenger (và máy yếu, mạng kém) không tải nổi bundle của app
// (~3.5 MB) nên bản cũ dùng JS chuyển hướng sang `#/t/<token>` bị trắng trang.
// Ở đây HTML đã chứa sẵn nội dung task nên mở ở đâu cũng hiện ngay.
//
// Thư mục `_lib` không bị Vercel biến thành function, và hàm này được gắn vào một function
// có sẵn (api/v1/openapi.js) để không vượt giới hạn 12 function của gói Hobby.

import { callRpc } from './authKey.js';

const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

const STATUS = {
    backlog: { label: 'Backlog', bg: '#f1f5f9', fg: '#475569' },
    todo: { label: 'Cần làm', bg: '#dbeafe', fg: '#1d4ed8' },
    doing: { label: 'Đang làm', bg: '#ffedd5', fg: '#c2410c' },
    done: { label: 'Hoàn thành', bg: '#d1fae5', fg: '#047857' },
};

const PRIORITY_LABEL = {
    urgent: 'Khẩn cấp', high: 'Khẩn cấp',
    focus: 'Tập trung', medium: 'Tập trung',
    chill: 'Thư thả', low: 'Thư thả',
    temp: 'Tạm thời',
};

export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function truncate(text, max) {
    const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Chỉ cho phép link http(s) — chặn javascript:, data:... từ dữ liệu người dùng nhập. */
export function safeHttpUrl(raw) {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return null;
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
        const u = new URL(withScheme);
        return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
    } catch {
        return null;
    }
}

/** Đọc attach_link (JSON array, hoặc chuỗi URL đơn kiểu cũ) → chỉ giữ link http(s). */
export function readSafeLinks(attachLink) {
    const trimmed = String(attachLink ?? '').trim();
    if (!trimmed) return [];

    let raw = [];
    if (trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) raw = parsed;
        } catch {
            raw = [{ name: trimmed, url: trimmed }];
        }
    } else {
        raw = [{ name: trimmed, url: trimmed }];
    }

    return raw.flatMap((l) => {
        const href = safeHttpUrl(l?.url);
        return href ? [{ name: String(l?.name ?? '').trim() || href, href }] : [];
    });
}

function formatDateTime(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    // Giờ Việt Nam, không phụ thuộc múi giờ của server
    const parts = new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false,
        timeZone: 'Asia/Ho_Chi_Minh',
    }).formatToParts(d).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
    return `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}/${parts.year}`;
}

/** Tạo nội dung thẻ xem trước từ kết quả get_shared_task (hoặc nội dung chung nếu không dùng được). */
export function buildPreview(result) {
    if (result && result.ok && result.task) {
        const t = result.task;
        const parts = [STATUS[t.status]?.label || null];
        if (Array.isArray(t.subtasks) && t.subtasks.length) {
            parts.push(`${t.subtasks.filter((s) => s.is_completed).length}/${t.subtasks.length} việc nhỏ`);
        }
        const meta = parts.filter(Boolean).join(' · ');
        const desc = [meta, truncate(t.description, 140)].filter(Boolean).join(' — ');
        return {
            title: truncate(t.title, 90) || 'Task trên SmartLife',
            description: desc || 'Xem task được chia sẻ trên SmartLife.',
        };
    }
    return {
        title: 'Task trên SmartLife',
        description: 'Link này không khả dụng hoặc đã hết hạn. SmartLife — quản lý công việc, học tập và tài chính trong một ứng dụng.',
    };
}

const STYLES = `*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
background:#f8fafc;color:#0f172a;line-height:1.5;padding:24px 16px 40px;-webkit-text-size-adjust:100%}
.wrap{max-width:560px;margin:0 auto}
.brand{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:20px;text-decoration:none}
.brand span{font-size:16px;font-weight:800;color:#1e293b;letter-spacing:-.3px}
.card{background:#fff;border:1px solid #f1f5f9;border-radius:24px;padding:24px;box-shadow:0 1px 3px rgba(15,23,42,.06)}
.badges{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.badge{padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800}
h1{font-size:21px;font-weight:800;line-height:1.35;word-wrap:break-word;overflow-wrap:break-word}
.owner{margin-top:8px;font-size:12px;color:#64748b}
.owner b{color:#334155}
.deadline{margin-top:16px;font-size:14px;font-weight:600;color:#475569}
.deadline.over{color:#e11d48}
.desc{margin-top:18px;font-size:14px;color:#334155;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:break-word}
.sec{margin-top:24px}
h2{font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
.bar{height:6px;border-radius:999px;background:#f1f5f9;overflow:hidden;margin-bottom:12px}
.bar i{display:block;height:100%;background:#10b981}
ul{list-style:none}
.sub{display:flex;gap:8px;font-size:14px;padding:3px 0;color:#334155}
.sub.ok{color:#94a3b8;text-decoration:line-through}
.sub em{font-style:normal;flex-shrink:0;width:16px;text-align:center}
.link{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid #e2e8f0;border-radius:16px;
text-decoration:none;margin-bottom:8px}
.link b{display:block;font-size:14px;color:#1e293b;font-weight:700;word-break:break-all}
.link small{display:block;font-size:11px;color:#94a3b8;word-break:break-all;margin-top:2px}
.note{margin-top:24px;padding-top:16px;border-top:1px solid #f1f5f9;font-size:11px;color:#94a3b8}
.cta{margin-top:20px;background:#0f172a;border-radius:24px;padding:24px;text-align:center}
.cta p{color:#cbd5e1;font-size:14px;margin:8px 0 16px}
.cta .hd{color:#fcd34d;font-size:11px;font-weight:800}
.cta a{display:inline-block;background:#fff;color:#0f172a;font-size:12px;font-weight:800;
padding:11px 20px;border-radius:16px;text-decoration:none}
.empty{text-align:center;padding:16px 0}
.empty h1{font-size:18px;margin-bottom:8px}
.empty p{font-size:14px;color:#64748b}`;

function renderTask(task) {
    const st = STATUS[task.status] || STATUS.todo;
    const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
    const done = subtasks.filter((s) => s.is_completed).length;
    const links = readSafeLinks(task.attach_link);
    const priority = task.priority ? PRIORITY_LABEL[task.priority] : null;
    const deadline = task.deadline ? formatDateTime(task.deadline) : null;
    const overdue = !!task.deadline && task.status !== 'done' && new Date(task.deadline).getTime() < Date.now();

    return `<article class="card">
<div class="badges">
<span class="badge" style="background:${st.bg};color:${st.fg}">${escapeHtml(st.label)}</span>
${priority ? `<span class="badge" style="background:#f1f5f9;color:#475569">${escapeHtml(priority)}</span>` : ''}
</div>
<h1>${escapeHtml(task.title)}</h1>
${task.owner_name ? `<p class="owner">Chia sẻ bởi <b>${escapeHtml(task.owner_name)}</b></p>` : ''}
${deadline ? `<p class="deadline${overdue ? ' over' : ''}">Hạn: ${escapeHtml(deadline)}${overdue ? ' · Quá hạn' : ''}</p>` : ''}
${task.description ? `<p class="desc">${escapeHtml(task.description)}</p>` : ''}
${subtasks.length ? `<div class="sec">
<h2>Việc nhỏ (${done}/${subtasks.length})</h2>
<div class="bar"><i style="width:${Math.round((done / subtasks.length) * 100)}%"></i></div>
<ul>${subtasks.map((s) => `<li class="sub${s.is_completed ? ' ok' : ''}"><em>${s.is_completed ? '✓' : '○'}</em><span>${escapeHtml(s.title)}</span></li>`).join('')}</ul>
</div>` : ''}
${links.length ? `<div class="sec">
<h2>Liên kết</h2>
${links.map((l) => `<a class="link" href="${escapeHtml(l.href)}" target="_blank" rel="noopener noreferrer nofollow"><span><b>${escapeHtml(l.name)}</b><small>${escapeHtml(l.href)}</small></span></a>`).join('')}
</div>` : ''}
<p class="note">Link chia sẻ trực tiếp — nội dung luôn cập nhật theo task gốc.</p>
</article>`;
}

function renderEmpty(reason) {
    const msg = reason === 'expired'
        ? { title: 'Link đã hết hạn', body: 'Chủ task đã đặt thời hạn cho link này và nó đã hết hiệu lực.' }
        : reason === 'error'
            ? { title: 'Không tải được task', body: 'Có lỗi kết nối. Vui lòng thử lại sau ít phút.' }
            : { title: 'Không tìm thấy task', body: 'Link này không tồn tại hoặc chủ task đã tắt chia sẻ.' };
    return `<article class="card empty"><h1>${escapeHtml(msg.title)}</h1><p>${escapeHtml(msg.body)}</p></article>`;
}

export function renderSharePage({ token, result, baseUrl }) {
    const preview = buildPreview(result);
    const title = escapeHtml(`${preview.title} · SmartLife`);
    const description = escapeHtml(preview.description);
    const url = escapeHtml(`${baseUrl}/t/${token}`);
    const image = escapeHtml(`${baseUrl}/share-card.png`);
    const body = result && result.ok && result.task
        ? renderTask(result.task)
        : renderEmpty(result ? result.reason : 'error');

    return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SmartLife">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1529">
<meta property="og:image:height" content="804">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
<link rel="icon" href="/favicon.ico">
<style>${STYLES}</style>
</head>
<body>
<div class="wrap">
<a class="brand" href="${escapeHtml(baseUrl)}/"><span>SmartLife</span></a>
${body}
<section class="cta">
<div class="hd">Quản lý công việc cùng SmartLife</div>
<p>Task, lịch học, tài chính và mục tiêu của bạn — gọn trong một ứng dụng, có thể chia sẻ như thế này.</p>
<a href="${escapeHtml(baseUrl)}/">Dùng thử SmartLife miễn phí</a>
</section>
</div>
</body>
</html>`;
}

export async function handleSharePage(req, res, token) {
    const baseUrl = (process.env.PUBLIC_APP_URL
        || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`).replace(/\/$/, '');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Trang chứa nội dung thật → không cache, để link vừa bị tắt không còn hiện trên CDN
    res.setHeader('Cache-Control', 'no-store');

    if (!TOKEN_PATTERN.test(token)) {
        return res.status(404).send(renderSharePage({ token: '0'.repeat(64), result: { ok: false, reason: 'not_found' }, baseUrl }));
    }

    let result = null;
    try {
        result = await callRpc('get_shared_task', { p_token: token });
    } catch (err) {
        console.error('[share-page] get_shared_task failed', err?.message);
    }

    const status = result && result.ok ? 200 : 404;
    return res.status(status).send(renderSharePage({ token, result, baseUrl }));
}
