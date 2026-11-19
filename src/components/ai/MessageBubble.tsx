// File: src/components/ai/MessageBubble.tsx
// Một tin trong khung chat: khung suy nghĩ, nội dung (chạy chữ khi đang stream), báo cáo, thao tác đã làm,
// biểu đồ, và hàng nút thao tác tin nhắn. Tin của Bạn đồng hành: avatar + tên, tách thành bong bóng nhỏ kiểu nhắn tin.

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Globe, Paperclip, RefreshCw, Sparkles, Square, Zap } from 'lucide-react';
import type { AppState } from '../../types';
import { editableText, hidePartialArtifact, parseArtifact, type UIMessage } from '../../services/ai/messages';
import InlineChatChart from '../InlineChatChart';
import MarkdownMessage from './MarkdownMessage';
import ThinkingPanel from './ThinkingPanel';
import MessageActions from './MessageActions';
import { FinancialImpactCard } from './FinancialImpact';
import { tierLabel } from './tiers';
import ClarifyCard from './ClarifyCard';
import { getExpert } from '../../services/ai/experts';
import type { Artifact } from './ArtifactPane';
import CompanionAvatar from './CompanionAvatar';
import { DEFAULT_COMPANION, splitCompanionMessage, type CompanionProfile } from '../../services/ai/companion/types';

export interface MessageBubbleProps {
    message: UIMessage;
    appState: AppState;
    busy: boolean;
    isEditing: boolean;
    canRegenerate: boolean;
    /** Tin cuối cùng trong cuộc trò chuyện — chỉ thẻ hỏi lại của tin cuối mới bấm chọn được */
    isLast?: boolean;
    /** Gửi câu trả lời cho thẻ hỏi lại (ask_user) */
    onAnswerClarify?: (text: string) => void;
    onAddTransaction?: (tx: any) => Promise<void>;
    onOpenImpactDetails: (data: any) => void;
    onOpenArtifact: (artifact: Artifact) => void;
    onStartEdit: (message: UIMessage) => void;
    onCancelEdit: () => void;
    onSubmitEdit: (message: UIMessage, text: string) => void;
    onRevert: (message: UIMessage) => void;
    onRegenerate: (message: UIMessage) => void;
    onDelete: (message: UIMessage) => void;
    onFeedback: (message: UIMessage, value: 'up' | 'down') => void;
    /** Hồ sơ bạn AI hiện tại — để vẽ avatar + tên cho tin ở chế độ Bạn đồng hành */
    companion?: CompanionProfile | null;
}

const EditBox: React.FC<{
    message: UIMessage;
    onCancel: () => void;
    onSubmit: (text: string) => void;
}> = ({ message, onCancel, onSubmit }) => {
    const [value, setValue] = useState(() => editableText(message));
    const ref = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
    }, []);

    const filesLost = !!message.meta?.files?.length && !message.attachments && !message.fileContext;
    const submit = () => { if (value.trim()) onSubmit(value.trim()); };

    return (
        <div className="w-full min-w-[260px] sm:min-w-[380px] bg-white border border-blue-200 rounded-2xl shadow-sm p-2.5 ring-2 ring-blue-50">
            <textarea
                ref={ref}
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
                    if (e.key === 'Escape') onCancel();
                }}
                rows={Math.min(8, Math.max(2, value.split('\n').length))}
                className="w-full resize-none bg-transparent text-sm text-gray-800 outline-none px-1"
            />
            <p className="text-[10px] text-gray-400 px-1 mt-1">
                Gửi lại sẽ thay các tin phía sau bằng câu trả lời mới. Việc AI đã làm (thêm việc, giao dịch…) không tự hoàn tác.
                {filesLost && ' Tệp đính kèm cũ không gửi lại được — hãy đính kèm lại nếu cần.'}
            </p>
            <div className="flex justify-end gap-1.5 mt-2">
                <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                    Huỷ
                </button>
                <button
                    type="button"
                    onClick={submit}
                    disabled={!value.trim()}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-40"
                >
                    Gửi
                </button>
            </div>
        </div>
    );
};

const MessageBubble: React.FC<MessageBubbleProps> = ({
    message, appState, busy, isEditing, canRegenerate, isLast, onAnswerClarify,
    onAddTransaction, onOpenImpactDetails, onOpenArtifact,
    onStartEdit, onCancelEdit, onSubmitEdit, onRevert, onRegenerate, onDelete, onFeedback, companion,
}) => {
    const isUser = message.role === 'user';
    const streaming = message.status === 'streaming';
    const meta = message.meta;

    // Nội dung hiển thị: tách báo cáo <artifact>, khi đang stream ẩn thẻ mở dở
    const source = streaming ? hidePartialArtifact(message.content) : message.content;
    const artifact = !isUser ? parseArtifact(source) : null;
    const files = isUser ? meta?.files : undefined;
    const displayContent = isUser
        ? (files?.length ? editableText(message) : message.content)
        : artifact
            ? (artifact.cleanContent || `📊 AI đã lập báo cáo **${artifact.title}**`)
            : source;

    const hasText = displayContent.trim().length > 0;
    const sources = !isUser && !streaming ? meta?.sources || [] : [];
    const clarification = !isUser && !streaming ? meta?.clarification : undefined;
    const persona = !isUser && meta?.expert === 'companion' ? (companion || DEFAULT_COMPANION) : null;
    const expertName = persona ? '' : meta?.expert && meta.expert !== 'general' ? getExpert(meta.expert).name : '';
    const modeText = meta?.tier ? `${meta.auto ? 'Auto → ' : ''}${tierLabel(meta.tier) || meta.tier}` : '';
    // Bạn đồng hành: không hiện khung suy nghĩ — chỉ "… đang soạn tin nhắn" khi chưa có chữ
    const showThinking = !persona && !isUser && !message.local && (streaming || !!meta?.steps?.length || !!meta?.thoughts);
    const typing = !!persona && streaming && !hasText;
    const chunks = persona && !artifact ? splitCompanionMessage(displayContent) : [displayContent];

    return (
        <div className={`group flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''} animate-fade-in`}>
            {persona && <CompanionAvatar avatar={persona.avatar} size={30} className="mt-4" />}
            {!isUser && !persona && (
                <div className="w-7 h-7 md:w-8 md:h-8 mt-0.5 rounded-lg md:rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 shadow-sm">
                    <Sparkles size={12} className="text-white" />
                </div>
            )}

            <div className={`min-w-0 max-w-[88%] ${isUser ? 'lg:max-w-[75%] flex flex-col items-end' : 'lg:max-w-[85%]'}`}>
                {showThinking && (
                    <ThinkingPanel
                        live={streaming}
                        startedAt={message.startedAt}
                        steps={meta?.steps}
                        thoughts={meta?.thoughts}
                        durationMs={meta?.durationMs}
                        stopped={message.status === 'stopped'}
                    />
                )}

                {persona && (
                    <p className="mb-1 ml-1 text-[11px] font-semibold text-gray-500 dark:text-slate-400">
                        {persona.name}{meta?.greeting ? <span className="font-normal text-gray-400 dark:text-slate-500"> · nhắn trước cho bạn</span> : null}
                    </p>
                )}
                {typing && (
                    <div className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl rounded-tl-md bg-gray-50 border border-gray-100 text-xs text-gray-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400" role="status">
                        <span className="flex gap-0.5" aria-hidden="true">
                            {[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                        </span>
                        {persona.name} đang soạn tin nhắn…
                    </div>
                )}

                {persona && !isEditing && hasText ? (
                    <div className="flex flex-col items-start gap-1">
                        {chunks.map((chunk, i) => (
                            <div
                                key={i}
                                className={`px-3.5 py-2 text-sm md:text-[15px] leading-relaxed bg-gray-50 text-gray-700 border border-gray-100 shadow-sm rounded-2xl ${i === 0 ? 'rounded-tl-md' : ''} dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700`}
                            >
                                <div className={streaming && i === chunks.length - 1 ? 'ai-streaming' : ''}>
                                    <MarkdownMessage content={chunk} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : isEditing ? (
                    <EditBox message={message} onCancel={onCancelEdit} onSubmit={text => onSubmitEdit(message, text)} />
                ) : (hasText || (files && files.length > 0)) && (
                    <div
                        className={`px-3.5 py-2.5 md:px-4 md:py-3 text-sm md:text-[15px] leading-relaxed shadow-sm ${
                            isUser
                                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl rounded-br-md'
                                : 'bg-gray-50 text-gray-700 border border-gray-100 rounded-2xl rounded-bl-md'
                        }`}
                    >
                        {isUser ? (
                            <>
                                {hasText && <p className="whitespace-pre-wrap break-words">{displayContent}</p>}
                                {files && files.length > 0 && (
                                    <div className={`flex flex-wrap gap-1.5 ${hasText ? 'mt-2' : ''}`}>
                                        {files.map((f, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/15 text-[11px] font-medium max-w-[220px]">
                                                <Paperclip size={11} className="shrink-0" />
                                                <span className="truncate">{f.name}</span>
                                                <span className="opacity-70 shrink-0">{(f.size / 1024).toFixed(0)}KB</span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className={streaming ? 'ai-streaming' : ''}>
                                <MarkdownMessage content={displayContent} />
                            </div>
                        )}
                    </div>
                )}

                {/* Nguồn web (web_search) — số [n] trong câu trả lời khớp với số ở đây */}
                {sources.length > 0 && (
                    <div className="mt-2 w-full">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-1 flex items-center gap-1">
                            <Globe size={10} /> Nguồn
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {sources.map(src => (
                                <a
                                    key={src.n}
                                    href={src.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={src.title}
                                    className="inline-flex items-center gap-1.5 max-w-[240px] px-2 py-1 rounded-lg bg-white border border-gray-200 text-[11px] text-gray-600 hover:border-blue-300 hover:text-blue-700 transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:border-blue-400 dark:hover:text-blue-300"
                                >
                                    <span className="font-bold text-blue-600 dark:text-blue-300 shrink-0">[{src.n}]</span>
                                    <span className="truncate">{src.title || src.domain}</span>
                                    <span className="text-gray-400 dark:text-slate-500 shrink-0 hidden sm:inline">{src.domain}</span>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* AI hỏi lại (ask_user) */}
                {clarification && (
                    <div className="w-full">
                        <ClarifyCard
                            request={clarification}
                            disabled={busy || !isLast || !onAnswerClarify}
                            onSubmit={text => onAnswerClarify?.(text)}
                        />
                    </div>
                )}

                {/* Trạng thái dừng / lỗi */}
                {message.status === 'stopped' && !showThinking && (
                    <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400">
                        <Square size={9} className="fill-gray-400" /> Đã dừng
                    </div>
                )}
                {message.status === 'error' && (
                    <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-xl text-xs bg-red-50 border border-red-200 text-red-700">
                        <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p>Xin lỗi, đã có lỗi xảy ra: {meta?.error || 'không rõ nguyên nhân'}</p>
                            {canRegenerate && (
                                <button
                                    type="button"
                                    onClick={() => onRegenerate(message)}
                                    disabled={busy}
                                    className="mt-1.5 inline-flex items-center gap-1 font-bold text-red-700 hover:underline disabled:opacity-40"
                                >
                                    <RefreshCw size={11} /> Thử lại
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Báo cáo */}
                {artifact && !streaming && (
                    <div className="mt-2 p-3 bg-blue-50/75 rounded-xl border border-blue-100 flex items-center justify-between gap-3 shadow-sm">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-blue-950 flex items-center gap-1.5">
                                <FileText size={14} className="text-blue-600 shrink-0" />
                                <span className="truncate">Báo cáo: {artifact.title}</span>
                            </p>
                            <p className="text-[10px] text-blue-700/80 mt-0.5 truncate">Báo cáo chi tiết đã được lập.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => onOpenArtifact({ title: artifact.title, content: artifact.artifactContent })}
                            className="px-2.5 py-1.5 bg-white text-blue-700 hover:bg-blue-50 border border-blue-150 text-xs font-bold rounded-lg transition-colors shadow-sm shrink-0"
                        >
                            Xem báo cáo 📑
                        </button>
                    </div>
                )}

                {/* Việc AI đã làm */}
                {message.actions && message.actions.length > 0 && (
                    <div className="mt-2 space-y-2 w-full">
                        {message.actions.map((action, i) =>
                            action.type === 'financial_impact' ? (
                                <FinancialImpactCard
                                    key={i}
                                    action={action}
                                    appState={appState}
                                    onAddTransaction={onAddTransaction}
                                    onOpenDetails={onOpenImpactDetails}
                                />
                            ) : (
                                <div
                                    key={i}
                                    className={`flex items-start gap-2 px-3 py-2 rounded-xl text-xs ${
                                        action.success ? 'bg-blue-50 border border-blue-200 text-blue-700' : 'bg-red-50 border border-red-200 text-red-700'
                                    }`}
                                >
                                    {action.success
                                        ? <CheckCircle2 size={14} className="text-blue-500 shrink-0 mt-0.5" />
                                        : <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />}
                                    <span>{action.message}</span>
                                </div>
                            )
                        )}
                    </div>
                )}

                {/* Biểu đồ */}
                {message.charts && message.charts.length > 0 && (
                    <div className="mt-2 space-y-2 w-full">
                        {message.charts.map((chart, i) => <InlineChatChart key={i} chart={chart} />)}
                    </div>
                )}

                {/* Chân tin: token + chế độ, thao tác */}
                {!message.local && !streaming && !isEditing && (
                    <div className={`flex items-center gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
                        {!isUser && (meta?.tokens_used || meta?.tier || expertName) && (
                            <div className={`text-[10px] text-gray-400 mt-1 ml-1 flex items-center gap-1 select-none ${persona ? 'opacity-0 group-hover:opacity-100 transition-opacity' : ''}`}>
                                <Zap size={10} className="shrink-0" />
                                {meta?.tokens_used ? <span><strong>{meta.tokens_used.toLocaleString('vi-VN')}</strong> tokens</span> : null}
                                {modeText && <span title={meta?.auto ? 'Chế độ Auto đã chọn tốc độ này' : undefined}>{meta?.tokens_used ? '· ' : ''}{modeText}</span>}
                                {expertName && <span>{meta?.tokens_used || modeText ? '· ' : ''}{expertName}</span>}
                            </div>
                        )}
                        <MessageActions
                            role={message.role}
                            disabled={busy}
                            feedback={meta?.feedback}
                            align={isUser ? 'end' : 'start'}
                            onCopy={() => navigator.clipboard.writeText(isUser ? displayContent : message.content)}
                            onDelete={() => onDelete(message)}
                            onEdit={isUser ? () => onStartEdit(message) : undefined}
                            onRevert={isUser ? () => onRevert(message) : undefined}
                            onRegenerate={!isUser && canRegenerate && message.status !== 'error' ? () => onRegenerate(message) : undefined}
                            onFeedback={!isUser && message.dbId ? value => onFeedback(message, value) : undefined}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(MessageBubble);
