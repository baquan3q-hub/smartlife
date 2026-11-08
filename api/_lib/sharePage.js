// File: api/_lib/sharePage.js
// Trang HTML nhỏ cho link chia sẻ task `/t/<token>`:
//   - Trình thu thập (Zalo, Messenger, Facebook, Slack...) đọc thẻ Open Graph để hiện thẻ xem trước.
//   - Người dùng thật được chuyển ngay sang trang xem của app: `/#/t/<token>`.
// Thư mục `_lib` không bị Vercel biến thành function, và hàm này được gắn vào một function có sẵn
// (api/v1/openapi.js) để không vượt giới hạn 12 function của gói Hobby.

import { callRpc } from './authKey.js';

const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

const STATUS_LABEL = { backlog: 'Backlog', todo: 'Cần làm', doing: 'Đang làm', done: 'Hoàn thành' };

export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function truncate(text, max) {
    const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Tạo nội dung thẻ xem trước từ kết quả get_shared_task (hoặc nội dung chung nếu không dùng được). */
export function buildPreview(result) {
    if (result && result.ok && result.task) {
        const t = result.task;
        const parts = [STATUS_LABEL[t.status] || null];
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

export function renderSharePage({ token, preview, baseUrl }) {
    const url = `${baseUrl}/t/${token}`;
    const image = `${baseUrl}/hero-mockup.png`;
    const title = escapeHtml(`${preview.title} · SmartLife`);
    const description = escapeHtml(preview.description);
    // token đã được kiểm tra hex 64 ký tự nên an toàn khi nhúng vào script/URL
    const target = `/#/t/${token}`;
    return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SmartLife">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<script>location.replace(${JSON.stringify(target)});</script>
</head>
<body>
<noscript><a href="${target}">Mở task trên SmartLife</a></noscript>
</body>
</html>`;
}

export async function handleSharePage(req, res, token) {
    const baseUrl = (process.env.PUBLIC_APP_URL
        || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`).replace(/\/$/, '');

    if (!TOKEN_PATTERN.test(token)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30');
        return res.status(404).send(renderSharePage({ token: '0'.repeat(64), preview: buildPreview(null), baseUrl }));
    }

    let result = null;
    try {
        result = await callRpc('get_shared_task', { p_token: token });
    } catch (err) {
        console.error('[share-page] get_shared_task failed', err?.message);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Cache ngắn để link vừa bị thu hồi không còn lộ tiêu đề lâu trên CDN
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(renderSharePage({ token, preview: buildPreview(result), baseUrl }));
}
