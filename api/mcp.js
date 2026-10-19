// File: api/mcp.js
// MCP server (Model Context Protocol, transport "Streamable HTTP", chế độ stateless)
// cho Claude Code / Claude Desktop / claude.ai / Gemini CLI / Cursor...
//
// Xác thực:
//   * Khuyên dùng:  Authorization: Bearer sl_live_...
//   * claude.ai web (chỉ nhập được URL):  https://<domain>/api/mcp?key=sl_live_...
//     → nên dùng key CHỈ ĐỌC cho cách này vì URL có thể bị ghi log.
//
// Mỗi tool gọi đúng các hàm SQL api_v1_* như REST API, nên scope / rate limit giống hệt.

import { TOOLS, TOOL_MAP, INSTRUCTIONS } from './_lib/tools.js';
import { ApiError } from './_lib/authKey.js';

const SERVER_INFO = { name: 'smartlife', title: 'SmartLife', version: '1.0.0' };
const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const KEY_PATTERN = /^sl_live_[0-9a-f]{48}$/;



// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------
const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message, data) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data ? { data } : {}) } });

function getKey(req) {
    const m = /^Bearer\s+(\S+)\s*$/i.exec(req.headers['authorization'] || '');
    if (m) return m[1];
    const header = (req.headers['x-api-key'] || '').trim();
    if (header) return header;
    const q = req.query?.key;
    return (Array.isArray(q) ? q[0] : q) || '';
}

async function handleMessage(msg, key) {
    // Phản hồi từ client (không có method) → không cần trả lời
    if (msg && msg.jsonrpc === '2.0' && msg.method === undefined && ('result' in msg || 'error' in msg)) return null;
    if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
        return rpcError(msg?.id, -32600, 'Invalid Request');
    }
    const isNotification = msg.id === undefined;
    const params = msg.params || {};

    switch (msg.method) {
        case 'initialize': {
            const requested = params.protocolVersion;
            return rpcResult(msg.id, {
                protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
                capabilities: { tools: { listChanged: false } },
                serverInfo: SERVER_INFO,
                instructions: INSTRUCTIONS,
            });
        }
        case 'ping':
            return isNotification ? null : rpcResult(msg.id, {});
        case 'tools/list':
            return rpcResult(msg.id, {
                tools: TOOLS.map(({ run, ...t }) => t),
            });
        case 'tools/call': {
            const tool = TOOL_MAP.get(params.name);
            if (!tool) return rpcError(msg.id, -32602, `Unknown tool: ${params.name}`);
            const args = params.arguments && typeof params.arguments === 'object' ? params.arguments : {};
            try {
                const data = await tool.run(key, args);
                return rpcResult(msg.id, { content: [{ type: 'text', text: JSON.stringify(data) }] });
            } catch (err) {
                // Lỗi nghiệp vụ trả về cho model đọc được (isError), không làm hỏng phiên MCP
                const message = err instanceof ApiError
                    ? `[${err.status} ${err.code}] ${err.message}`
                    : 'Lỗi máy chủ, vui lòng thử lại.';
                if (!(err instanceof ApiError)) console.error('[api/mcp] tool error', err);
                return rpcResult(msg.id, { content: [{ type: 'text', text: message }], isError: true });
            }
        }
        case 'resources/list':
            return rpcResult(msg.id, { resources: [] });
        case 'prompts/list':
            return rpcResult(msg.id, { prompts: [] });
        default:
            if (isNotification) return null; // notifications/initialized, notifications/cancelled...
            return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
    }
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, X-API-Key, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(204).end();
    // Stateless: không mở SSE stream, không có session để xóa
    if (req.method === 'GET' || req.method === 'DELETE') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json(rpcError(null, -32000, 'Method not allowed. Use POST.'));
    }
    if (req.method !== 'POST') return res.status(405).end();

    const key = getKey(req);
    if (!KEY_PATTERN.test(key)) {
        res.setHeader('WWW-Authenticate', 'Bearer realm="SmartLife MCP"');
        return res.status(401).json(rpcError(null, -32001, 'Thiếu hoặc sai API key. Dùng header Authorization: Bearer sl_live_... (hoặc ?key=sl_live_...).'));
    }

    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch {
            return res.status(400).json(rpcError(null, -32700, 'Parse error'));
        }
    }

    const batch = Array.isArray(body);
    const messages = batch ? body : [body];
    if (messages.length === 0) return res.status(400).json(rpcError(null, -32600, 'Invalid Request'));

    const responses = (await Promise.all(messages.map((m) => handleMessage(m, key)))).filter(Boolean);

    // Chỉ toàn notification → 202 không có body
    if (responses.length === 0) return res.status(202).end();
    return res.status(200).json(batch ? responses : responses[0]);
}
