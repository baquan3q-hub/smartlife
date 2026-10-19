import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    KeyRound, Plus, Copy, Check, Trash2, Ban, Loader2, X, ShieldAlert, Terminal, FileJson,
    BrainCircuit, ChevronDown, AlertTriangle, Info, Lightbulb, Siren, PlugZap, RefreshCw
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { Lang } from '../../i18n/i18n';
import ConfirmModal from '../ConfirmModal';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------
interface ApiKeyRow {
    id: string;
    name: string;
    key_prefix: string;
    scopes: string[];
    is_active: boolean;
    last_used_at: string | null;
    expires_at: string | null;
    revoked_at: string | null;
    created_at: string;
}

interface CreatedKey {
    id: string;
    name: string;
    key: string;
    key_prefix: string;
    scopes: string[];
    expires_at: string | null;
}

interface InsightRow {
    id: string;
    category: string;
    severity: 'info' | 'suggestion' | 'warning' | 'critical';
    title: string;
    content: string;
    is_read: boolean;
    source: string | null;
    created_at: string;
}

type KeyStatus = 'active' | 'expired' | 'revoked';

const SCOPES: { id: string; vi: string; en: string; descVi: string; descEn: string }[] = [
    { id: 'read:all', vi: 'Đọc toàn bộ', en: 'Read everything', descVi: 'Context, task, tài chính, nhật ký cố vấn', descEn: 'Context, tasks, finance, insights' },
    { id: 'context:read', vi: 'Đọc context', en: 'Read context', descVi: 'Chỉ endpoint /ai/context', descEn: 'Only /ai/context' },
    { id: 'tasks:read', vi: 'Đọc task', en: 'Read tasks', descVi: 'Xem danh sách & chi tiết task', descEn: 'List and view tasks' },
    { id: 'tasks:write', vi: 'Ghi task', en: 'Write tasks', descVi: 'Tạo, sửa, sắp xếp lại Kanban', descEn: 'Create, edit, reorder Kanban' },
    { id: 'finance:read', vi: 'Đọc tài chính', en: 'Read finance', descVi: 'Chi tiêu, ngân sách, dòng tiền', descEn: 'Spending, budgets, cash flow' },
    { id: 'insights:write', vi: 'Ghi lời khuyên', en: 'Write insights', descVi: 'Lưu phân tích vào nhật ký cố vấn', descEn: 'Save analyses to the advisor log' },
];

const EXPIRY_OPTIONS: { value: number | null; vi: string; en: string }[] = [
    { value: 30, vi: '30 ngày', en: '30 days' },
    { value: 90, vi: '90 ngày', en: '90 days' },
    { value: null, vi: 'Không hết hạn', en: 'Never' },
];

const SEVERITY_STYLE: Record<InsightRow['severity'], { icon: React.ReactNode; cls: string }> = {
    info: { icon: <Info size={14} />, cls: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40 dark:text-sky-300' },
    suggestion: { icon: <Lightbulb size={14} />, cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300' },
    warning: { icon: <AlertTriangle size={14} />, cls: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300' },
    critical: { icon: <Siren size={14} />, cls: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300' },
};

function getApiBaseUrl(): string {
    const fromEnv = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.replace(/\/$/, '');
    if (fromEnv) return fromEnv;
    if (!Capacitor.isNativePlatform() && window.location.protocol.startsWith('http')) {
        return window.location.origin;
    }
    return 'https://<your-smartlife-domain>';
}

function keyStatus(k: ApiKeyRow): KeyStatus {
    if (!k.is_active) return 'revoked';
    if (k.expires_at && new Date(k.expires_at).getTime() <= Date.now()) return 'expired';
    return 'active';
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------
const CopyButton: React.FC<{ text: string; label?: string; className?: string }> = ({ text, label, className = '' }) => {
    const [copied, setCopied] = useState(false);
    const onCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            window.prompt('Copy:', text);
        }
    };
    return (
        <button
            type="button"
            onClick={onCopy}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${copied
                ? 'bg-emerald-500 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'} ${className}`}
        >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {label && <span>{copied ? 'Copied' : label}</span>}
        </button>
    );
};

const CodeBlock: React.FC<{ code: string }> = ({ code }) => (
    <div className="relative group">
        <pre className="bg-slate-900 dark:bg-black/60 text-slate-100 text-[11px] leading-relaxed rounded-xl p-3 pr-12 overflow-x-auto custom-scrollbar font-mono whitespace-pre">
            {code}
        </pre>
        <div className="absolute top-2 right-2">
            <CopyButton text={code} />
        </div>
    </div>
);

const Overlay: React.FC<{ children: React.ReactNode; onClose?: () => void }> = ({ children, onClose }) =>
    createPortal(
        <div
            className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>,
        document.body
    );

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const ApiKeysTab: React.FC<{ lang: Lang }> = ({ lang }) => {
    const vi = lang === 'vi';
    const L = (viText: string, enText: string) => (vi ? viText : enText);
    const locale = vi ? 'vi-VN' : lang === 'ko' ? 'ko-KR' : 'en-US';
    const fmt = (iso: string | null) =>
        iso ? new Date(iso).toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

    const baseUrl = useMemo(getApiBaseUrl, []);

    const [keys, setKeys] = useState<ApiKeyRow[]>([]);
    const [insights, setInsights] = useState<InsightRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    // Create modal
    const [showCreate, setShowCreate] = useState(false);
    const [formName, setFormName] = useState('');
    const [formExpiry, setFormExpiry] = useState<number | null>(90);
    const [formScopes, setFormScopes] = useState<string[]>(['read:all']);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // Reveal-once dialog
    const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
    const [savedAck, setSavedAck] = useState(false);
    const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
    const [testMessage, setTestMessage] = useState('');

    // Confirm revoke / delete
    const [confirm, setConfirm] = useState<{ type: 'revoke' | 'delete'; key: ApiKeyRow } | null>(null);
    const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
    const [showGuide, setShowGuide] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        const [keysRes, insightsRes] = await Promise.all([
            supabase
                .from('api_keys')
                .select('id, name, key_prefix, scopes, is_active, last_used_at, expires_at, revoked_at, created_at')
                .order('created_at', { ascending: false }),
            supabase
                .from('ai_advisor_logs')
                .select('id, category, severity, title, content, is_read, source, created_at')
                .order('created_at', { ascending: false })
                .limit(10),
        ]);
        if (keysRes.error) {
            setLoadError(keysRes.error.message);
        } else {
            setKeys((keysRes.data || []) as ApiKeyRow[]);
        }
        if (!insightsRes.error) setInsights((insightsRes.data || []) as InsightRow[]);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const openCreate = () => {
        setFormName('');
        setFormExpiry(90);
        setFormScopes(['read:all']);
        setCreateError(null);
        setShowCreate(true);
    };

    const toggleScope = (id: string) =>
        setFormScopes((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

    const applyPreset = (preset: 'readonly' | 'full') =>
        setFormScopes(preset === 'readonly' ? ['read:all'] : ['read:all', 'tasks:write', 'insights:write']);

    const handleCreate = async () => {
        if (!formName.trim()) {
            setCreateError(L('Vui lòng đặt tên cho key.', 'Please name this key.'));
            return;
        }
        if (formScopes.length === 0) {
            setCreateError(L('Chọn ít nhất 1 quyền.', 'Choose at least one scope.'));
            return;
        }
        setCreating(true);
        setCreateError(null);
        const { data, error } = await supabase.rpc('create_api_key', {
            p_name: formName.trim(),
            p_scopes: formScopes,
            p_expires_in_days: formExpiry,
        });
        setCreating(false);
        if (error) {
            setCreateError(error.message);
            return;
        }
        setShowCreate(false);
        setSavedAck(false);
        setTestState('idle');
        setCreatedKey(data as CreatedKey);
        load();
    };

    const handleConfirm = async () => {
        if (!confirm) return;
        const { type, key } = confirm;
        setConfirm(null);
        const { error } =
            type === 'revoke'
                ? await supabase.rpc('revoke_api_key', { p_id: key.id })
                : await supabase.from('api_keys').delete().eq('id', key.id);
        if (error) {
            alert(error.message);
            return;
        }
        load();
    };

    const testConnection = async (key: string) => {
        setTestState('testing');
        try {
            const res = await fetch(`${baseUrl}/api/v1/me`, { headers: { Authorization: `Bearer ${key}` } });
            const body = await res.json().catch(() => ({}));
            if (res.ok) {
                setTestState('ok');
                setTestMessage(L(`Kết nối thành công — key "${body?.key?.name}" hoạt động.`, `Connected — key "${body?.key?.name}" works.`));
            } else {
                setTestState('fail');
                setTestMessage(body?.error?.message || `HTTP ${res.status}`);
            }
        } catch (e) {
            setTestState('fail');
            setTestMessage(L('Không gọi được API (chạy local cần `vercel dev`).', 'Could not reach the API (local dev needs `vercel dev`).'));
        }
    };

    const toggleInsight = async (row: InsightRow) => {
        const next = expandedInsight === row.id ? null : row.id;
        setExpandedInsight(next);
        if (next && !row.is_read) {
            setInsights((prev) => prev.map((i) => (i.id === row.id ? { ...i, is_read: true } : i)));
            await supabase.from('ai_advisor_logs').update({ is_read: true }).eq('id', row.id);
        }
    };

    const deleteInsight = async (id: string) => {
        setInsights((prev) => prev.filter((i) => i.id !== id));
        await supabase.from('ai_advisor_logs').delete().eq('id', id);
    };

    const curlSample = (key = 'sl_live_xxxxxxxx') =>
        `curl -s "${baseUrl}/api/v1/ai/context" \\\n  -H "Authorization: Bearer ${key}"`;

    const statusBadge = (s: KeyStatus) => {
        const map: Record<KeyStatus, { label: string; cls: string }> = {
            active: { label: L('Đang hoạt động', 'Active'), cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' },
            expired: { label: L('Hết hạn', 'Expired'), cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' },
            revoked: { label: L('Đã thu hồi', 'Revoked'), cls: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10' },
        };
        return (
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${map[s].cls}`}>
                {map[s].label}
            </span>
        );
    };

    // -----------------------------------------------------------------------
    return (
        <div className="space-y-6">
            {/* Banner */}
            <div className="bg-gradient-to-r from-slate-800 via-indigo-700 to-violet-600 p-4 rounded-2xl text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 -translate-y-4 translate-x-4 opacity-10 pointer-events-none">
                    <BrainCircuit size={120} />
                </div>
                <h3 className="font-bold text-lg flex items-center gap-2 mb-1">
                    <PlugZap size={18} />
                    {L('Tích hợp AI & API', 'AI & API integration')}
                </h3>
                <p className="text-indigo-100 text-xs opacity-90 leading-relaxed">
                    {L(
                        'Tạo khóa cá nhân để Custom GPT, Claude (MCP), n8n hoặc bot của bạn đọc dữ liệu SmartLife, sắp xếp task và ghi lời khuyên.',
                        'Create personal keys so your Custom GPT, Claude (MCP), n8n or bots can read SmartLife data, reorder tasks and write advice.'
                    )}
                </p>
            </div>

            {/* Keys list */}
            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <KeyRound size={14} />
                        {L('API keys của bạn', 'Your API keys')}
                    </h4>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={load}
                            className="p-2 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-gray-100 transition-colors"
                            title={L('Tải lại', 'Refresh')}
                        >
                            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            type="button"
                            onClick={openCreate}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-colors"
                        >
                            <Plus size={14} />
                            {L('Tạo key', 'New key')}
                        </button>
                    </div>
                </div>

                {loading && keys.length === 0 ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                    </div>
                ) : loadError ? (
                    <div className="p-4 rounded-2xl bg-rose-50 text-rose-700 text-xs font-medium border border-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900">
                        {L('Không tải được danh sách key. Đã chạy file sql/api_v1_external_ai.sql chưa?', 'Could not load keys. Has sql/api_v1_external_ai.sql been run?')}
                        <div className="mt-1 opacity-70 font-mono">{loadError}</div>
                    </div>
                ) : keys.length === 0 ? (
                    <div className="p-6 rounded-2xl border-2 border-dashed border-gray-200 text-center">
                        <KeyRound className="mx-auto text-gray-300 mb-2" size={28} />
                        <p className="text-sm font-bold text-gray-600">{L('Chưa có API key nào', 'No API keys yet')}</p>
                        <p className="text-xs text-gray-400 mt-1">{L('Tạo key đầu tiên để kết nối AI bên ngoài.', 'Create your first key to connect an external AI.')}</p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {keys.map((k) => {
                            const s = keyStatus(k);
                            return (
                                <div
                                    key={k.id}
                                    className={`p-3.5 rounded-2xl border bg-gray-50 border-gray-100 ${s !== 'active' ? 'opacity-70' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-sm text-gray-800 truncate">{k.name}</span>
                                                {statusBadge(s)}
                                            </div>
                                            <div className="font-mono text-[11px] text-gray-500 mt-1">{k.key_prefix}…</div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {s === 'active' && (
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirm({ type: 'revoke', key: k })}
                                                    className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                                                    title={L('Thu hồi', 'Revoke')}
                                                >
                                                    <Ban size={15} />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setConfirm({ type: 'delete', key: k })}
                                                className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                title={L('Xóa', 'Delete')}
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {k.scopes.map((sc) => (
                                            <span key={sc} className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                                                {sc}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 mt-2.5 text-[10px] text-gray-400 font-medium">
                                        <div>
                                            <div className="uppercase tracking-wider">{L('Tạo', 'Created')}</div>
                                            <div className="text-gray-600 font-semibold">{fmt(k.created_at)}</div>
                                        </div>
                                        <div>
                                            <div className="uppercase tracking-wider">{L('Dùng lần cuối', 'Last used')}</div>
                                            <div className="text-gray-600 font-semibold">{k.last_used_at ? fmt(k.last_used_at) : L('Chưa dùng', 'Never')}</div>
                                        </div>
                                        <div>
                                            <div className="uppercase tracking-wider">{L('Hết hạn', 'Expires')}</div>
                                            <div className="text-gray-600 font-semibold">{k.expires_at ? fmt(k.expires_at) : L('Không', 'Never')}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Quick connect guide */}
            <section className="space-y-3">
                <button
                    type="button"
                    onClick={() => setShowGuide((v) => !v)}
                    className="w-full flex items-center justify-between text-sm font-bold text-gray-400 uppercase tracking-wider"
                >
                    <span className="flex items-center gap-2">
                        <Terminal size={14} />
                        {L('Hướng dẫn kết nối nhanh', 'Quick connect guide')}
                    </span>
                    <ChevronDown size={16} className={`transition-transform ${showGuide ? 'rotate-180' : ''}`} />
                </button>

                {showGuide && (
                    <div className="space-y-4 bg-gray-50 rounded-2xl p-4 border border-gray-100 animate-in fade-in duration-200">
                        <div>
                            <div className="text-xs font-bold text-gray-700 mb-1.5">{L('Endpoint tổng hợp (gọi đầu tiên)', 'Context endpoint (call first)')}</div>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 min-w-0 truncate text-[11px] font-mono bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700">
                                    GET {baseUrl}/api/v1/ai/context
                                </code>
                                <CopyButton text={`${baseUrl}/api/v1/ai/context`} />
                            </div>
                        </div>

                        <div>
                            <div className="text-xs font-bold text-gray-700 mb-1.5">cURL</div>
                            <CodeBlock code={curlSample()} />
                        </div>

                        <div className="space-y-1.5">
                            <div className="text-xs font-bold text-gray-700">{L('OpenAI Custom GPT / n8n', 'OpenAI Custom GPT / n8n')}</div>
                            <ol className="text-xs text-gray-500 leading-relaxed list-decimal pl-4 space-y-0.5">
                                <li>{L('Actions → Import from URL → dán link openapi.json bên dưới.', 'Actions → Import from URL → paste the openapi.json link below.')}</li>
                                <li>{L('Authentication → API Key → Auth Type: Bearer → dán key sl_live_...', 'Authentication → API Key → Auth Type: Bearer → paste your sl_live_... key.')}</li>
                                <li>{L('n8n: HTTP Request node, header Authorization: Bearer <key>.', 'n8n: HTTP Request node, header Authorization: Bearer <key>.')}</li>
                            </ol>
                            <div className="flex items-center gap-2 pt-1">
                                <a
                                    href={`${baseUrl}/api/v1/openapi.json`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-bold text-indigo-600 hover:border-indigo-300 transition-colors"
                                >
                                    <FileJson size={13} />
                                    openapi.json
                                </a>
                                <CopyButton text={`${baseUrl}/api/v1/openapi.json`} label={L('Copy link', 'Copy link')} />
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* Advisor log written by external AI */}
            <section className="space-y-3">
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <BrainCircuit size={14} />
                    {L('Nhật ký cố vấn AI', 'AI advisor log')}
                    {insights.some((i) => !i.is_read) && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500 text-white normal-case tracking-normal">
                            {insights.filter((i) => !i.is_read).length}
                        </span>
                    )}
                </h4>
                {insights.length === 0 ? (
                    <p className="text-xs text-gray-400">
                        {L('Chưa có lời khuyên nào. AI ghi vào đây qua POST /api/v1/ai/insights.', 'No insights yet. AI writes here via POST /api/v1/ai/insights.')}
                    </p>
                ) : (
                    <div className="space-y-2">
                        {insights.map((row) => {
                            const sev = SEVERITY_STYLE[row.severity] || SEVERITY_STYLE.info;
                            const open = expandedInsight === row.id;
                            return (
                                <div key={row.id} className="rounded-2xl border border-gray-100 bg-gray-50 overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => toggleInsight(row)}
                                        className="w-full flex items-center gap-2.5 p-3 text-left"
                                    >
                                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${sev.cls}`}>{sev.icon}</span>
                                        <div className="min-w-0 flex-1">
                                            <div className={`text-sm truncate ${row.is_read ? 'font-medium text-gray-600' : 'font-bold text-gray-800'}`}>{row.title}</div>
                                            <div className="text-[10px] text-gray-400 font-medium">
                                                {row.category} · {row.source || 'API'} · {fmt(row.created_at)}
                                            </div>
                                        </div>
                                        {!row.is_read && <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />}
                                        <ChevronDown size={15} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                                    </button>
                                    {open && (
                                        <div className="px-3 pb-3">
                                            <div className="prose prose-sm max-w-none text-xs text-gray-600 dark:prose-invert bg-white rounded-xl p-3 border border-gray-100">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{row.content}</ReactMarkdown>
                                            </div>
                                            <div className="flex justify-end mt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => deleteInsight(row.id)}
                                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-rose-600 transition-colors"
                                                >
                                                    <Trash2 size={12} />
                                                    {L('Xóa', 'Delete')}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* ---------------- Create key modal ---------------- */}
            {showCreate && (
                <Overlay onClose={() => !creating && setShowCreate(false)}>
                    <div className="flex items-center justify-between p-5 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <KeyRound size={18} className="text-indigo-600" />
                            {L('Tạo API key mới', 'Create API key')}
                        </h3>
                        <button type="button" onClick={() => setShowCreate(false)} className="p-2 rounded-full text-gray-400 hover:bg-gray-100">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="p-5 space-y-5 overflow-y-auto custom-scrollbar">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{L('Tên key', 'Key name')}</label>
                            <input
                                autoFocus
                                value={formName}
                                maxLength={80}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder={L('VD: Claude Agent của tôi', 'e.g. My Claude agent')}
                                className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{L('Thời hạn', 'Expiration')}</label>
                            <div className="mt-1.5 grid grid-cols-3 gap-2">
                                {EXPIRY_OPTIONS.map((o) => (
                                    <button
                                        key={String(o.value)}
                                        type="button"
                                        onClick={() => setFormExpiry(o.value)}
                                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${formExpiry === o.value
                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                                            : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                                    >
                                        {vi ? o.vi : o.en}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{L('Quyền hạn', 'Scopes')}</label>
                                <div className="flex gap-1.5">
                                    <button type="button" onClick={() => applyPreset('readonly')} className="text-[10px] font-bold px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200">
                                        {L('Chỉ đọc', 'Read-only')}
                                    </button>
                                    <button type="button" onClick={() => applyPreset('full')} className="text-[10px] font-bold px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200">
                                        {L('Đầy đủ', 'Full')}
                                    </button>
                                </div>
                            </div>
                            <div className="mt-1.5 space-y-1.5">
                                {SCOPES.map((s) => {
                                    const checked = formScopes.includes(s.id);
                                    return (
                                        <label
                                            key={s.id}
                                            className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${checked
                                                ? 'border-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/30 dark:border-indigo-800'
                                                : 'border-gray-100 hover:bg-gray-50'}`}
                                        >
                                            <input type="checkbox" checked={checked} onChange={() => toggleScope(s.id)} className="mt-0.5 accent-indigo-600" />
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold text-gray-700">
                                                    {vi ? s.vi : s.en} <span className="font-mono font-medium text-gray-400">{s.id}</span>
                                                </div>
                                                <div className="text-[11px] text-gray-400">{vi ? s.descVi : s.descEn}</div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        {createError && (
                            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium dark:bg-rose-950/40 dark:text-rose-300">{createError}</div>
                        )}
                    </div>

                    <div className="p-5 border-t border-gray-100 flex gap-2">
                        <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50">
                            {L('Hủy', 'Cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={creating}
                            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold inline-flex items-center justify-center gap-2"
                        >
                            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            {L('Tạo key', 'Create key')}
                        </button>
                    </div>
                </Overlay>
            )}

            {/* ---------------- Reveal-once dialog ---------------- */}
            {createdKey && (
                <Overlay>
                    <div className="p-5 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Check size={18} className="text-emerald-500" />
                            {L('Đã tạo key', 'Key created')}: {createdKey.name}
                        </h3>
                    </div>
                    <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
                        <div className="flex gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200">
                            <ShieldAlert size={18} className="shrink-0 mt-0.5" />
                            <p className="text-xs leading-relaxed font-medium">
                                {L(
                                    'Key chỉ hiển thị MỘT LẦN DUY NHẤT. SmartLife chỉ lưu bản băm nên không thể xem lại. Không chia sẻ key và không đưa vào code công khai — ai có key đều đọc được dữ liệu của bạn theo quyền đã cấp.',
                                    'This key is shown ONLY ONCE. SmartLife stores just a hash and cannot show it again. Never share it or commit it to public code — anyone holding it can access your data within its scopes.'
                                )}
                            </p>
                        </div>

                        <div>
                            <div className="flex items-stretch gap-2">
                                <code className="flex-1 min-w-0 break-all text-[12px] font-mono bg-slate-900 dark:bg-black/60 text-emerald-300 rounded-xl px-3 py-2.5 select-all">
                                    {createdKey.key}
                                </code>
                                <CopyButton text={createdKey.key} label="Copy" className="!px-3" />
                            </div>
                        </div>

                        <div>
                            <div className="text-xs font-bold text-gray-700 mb-1.5">{L('Thử ngay', 'Try it')}</div>
                            <CodeBlock code={curlSample(createdKey.key)} />
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => testConnection(createdKey.key)}
                                disabled={testState === 'testing'}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 disabled:opacity-60"
                            >
                                {testState === 'testing' ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />}
                                {L('Kiểm tra kết nối', 'Test connection')}
                            </button>
                            {(testState === 'ok' || testState === 'fail') && (
                                <span className={`text-[11px] font-semibold ${testState === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>{testMessage}</span>
                            )}
                        </div>

                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer select-none">
                            <input type="checkbox" checked={savedAck} onChange={(e) => setSavedAck(e.target.checked)} className="accent-indigo-600" />
                            {L('Tôi đã lưu key ở nơi an toàn', 'I have stored this key safely')}
                        </label>
                    </div>
                    <div className="p-5 border-t border-gray-100">
                        <button
                            type="button"
                            disabled={!savedAck}
                            onClick={() => setCreatedKey(null)}
                            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold"
                        >
                            {L('Xong', 'Done')}
                        </button>
                    </div>
                </Overlay>
            )}

            <ConfirmModal
                isOpen={!!confirm}
                title={confirm?.type === 'revoke' ? L('Thu hồi API key?', 'Revoke API key?') : L('Xóa API key?', 'Delete API key?')}
                message={
                    confirm?.type === 'revoke'
                        ? L(`"${confirm?.key.name}" sẽ ngừng hoạt động ngay lập tức. Mọi AI đang dùng key này sẽ bị từ chối.`,
                            `"${confirm?.key.name}" stops working immediately. Any AI using it will be rejected.`)
                        : L(`Xóa vĩnh viễn "${confirm?.key.name}" khỏi danh sách. Key sẽ không dùng được nữa.`,
                            `Permanently delete "${confirm?.key.name}". The key will stop working.`)
                }
                confirmText={confirm?.type === 'revoke' ? L('Thu hồi', 'Revoke') : L('Xóa', 'Delete')}
                cancelText={L('Hủy', 'Cancel')}
                icon={confirm?.type === 'revoke' ? <Ban size={24} /> : <Trash2 size={24} />}
                onConfirm={handleConfirm}
                onCancel={() => setConfirm(null)}
            />
        </div>
    );
};

export default ApiKeysTab;
