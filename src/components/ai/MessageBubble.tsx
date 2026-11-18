// File: src/components/ai/MessageBubble.tsx
// Một tin trong khung chat: khung suy nghĩ, nội dung (chạy chữ khi đang stream), báo cáo, thao tác đã làm,
// biểu đồ, và hàng nút thao tác tin nhắn.

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Paperclip, RefreshCw, Sparkles, Square, Zap } from 'lucide-react';
import type { AppState } from '../../types';
import { editableText, hidePartialArtifact, parseArtifact, type UIMessage } from '../../services/ai/messages';
import InlineChatChart from '../InlineChatChart';
import MarkdownMessage from './MarkdownMessage';
import ThinkingPanel from './ThinkingPanel';
import MessageActions from './MessageActions';
import { FinancialImpactCard } from './FinancialImpact';
import { tierLabel } from './tiers';
import type { Artifact } from './ArtifactPane';

export interface MessageBubbleProps {
    message: UIMessage;
    appState: AppState;
    busy: boolean;
    isEditing: boolean;
    canRegenerate: boolean;
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
    message, appState, busy, isEditing, canRegenerate,
    onAddTransaction, onOpenImpactDetails, onOpenArtifact,
    onStartEdit, onCancelEdit, onSubmitEdit, onRevert, onRegenerate, onDelete, onFeedback,
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
    const showThinking = !isUser && !message.local && (streaming || !!meta?.steps?.length || !!meta?.thoughts);

    return (
        <div className={`group flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''} animate-fade-in`}>
            {!isUser && (
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

                {isEditing ? (
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
                        {!isUser && (meta?.tokens_used || meta?.tier) && (
                            <div className="text-[10px] text-gray-400 mt-1 ml-1 flex items-center gap-1 select-none">
                                <Zap size={10} className="shrink-0" />
                                {meta?.tokens_used ? <span><strong>{meta.tokens_used.toLocaleString('vi-VN')}</strong> tokens</span> : null}
                                {meta?.tier && <span>{meta?.tokens_used ? '· ' : ''}{tierLabel(meta.tier) || meta.tier}</span>}
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
