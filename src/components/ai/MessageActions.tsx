// File: src/components/ai/MessageActions.tsx
// Hàng nút dưới mỗi tin: hiện khi rê chuột trên desktop, luôn hiện (mờ) trên màn hình cảm ứng

import React, { useState } from 'react';
import { Check, Copy, Pencil, RefreshCw, ThumbsDown, ThumbsUp, Trash2, Undo2 } from 'lucide-react';

interface MessageActionsProps {
    role: 'user' | 'assistant';
    disabled?: boolean;
    feedback?: 'up' | 'down';
    align?: 'start' | 'end';
    onCopy: () => void;
    onDelete?: () => void;
    onEdit?: () => void;
    onRevert?: () => void;
    onRegenerate?: () => void;
    onFeedback?: (value: 'up' | 'down') => void;
}

const ActionButton: React.FC<{
    title: string;
    onClick: () => void;
    disabled?: boolean;
    active?: boolean;
    danger?: boolean;
    children: React.ReactNode;
}> = ({ title, onClick, disabled, active, danger, children }) => (
    <button
        type="button"
        title={title}
        aria-label={title}
        onClick={onClick}
        disabled={disabled}
        className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
            active
                ? 'text-blue-600 bg-blue-50'
                : danger
                    ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
        }`}
    >
        {children}
    </button>
);

const MessageActions: React.FC<MessageActionsProps> = ({
    role, disabled, feedback, align = 'start',
    onCopy, onDelete, onEdit, onRevert, onRegenerate, onFeedback,
}) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        onCopy();
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div
            className={`flex items-center gap-0.5 mt-1 ${align === 'end' ? 'justify-end' : ''} transition-opacity opacity-70 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-within:opacity-100`}
        >
            {role === 'user' && onEdit && (
                <ActionButton title="Sửa & gửi lại" onClick={onEdit} disabled={disabled}><Pencil size={13} /></ActionButton>
            )}
            {role === 'user' && onRevert && (
                <ActionButton title="Quay lại đây (nhắn lại từ tin này)" onClick={onRevert} disabled={disabled}><Undo2 size={13} /></ActionButton>
            )}
            {role === 'assistant' && onRegenerate && (
                <ActionButton title="Tạo lại câu trả lời" onClick={onRegenerate} disabled={disabled}><RefreshCw size={13} /></ActionButton>
            )}
            <ActionButton title={copied ? 'Đã sao chép' : 'Sao chép'} onClick={handleCopy}>
                {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </ActionButton>
            {role === 'assistant' && onFeedback && (
                <>
                    <ActionButton title="Câu trả lời hữu ích" onClick={() => onFeedback('up')} active={feedback === 'up'}>
                        <ThumbsUp size={13} className={feedback === 'up' ? 'fill-blue-100' : ''} />
                    </ActionButton>
                    <ActionButton title="Chưa tốt" onClick={() => onFeedback('down')} active={feedback === 'down'}>
                        <ThumbsDown size={13} className={feedback === 'down' ? 'fill-blue-100' : ''} />
                    </ActionButton>
                </>
            )}
            {onDelete && (
                <ActionButton title="Xoá tin nhắn" onClick={onDelete} disabled={disabled} danger><Trash2 size={13} /></ActionButton>
            )}
        </div>
    );
};

export default MessageActions;
