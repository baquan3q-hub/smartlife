// File: src/components/ai/ClarifyCard.tsx
// Thẻ câu hỏi lại của AI (công cụ ask_user): chọn đáp án, "Khác…" để tự gõ, rồi gửi thành tin nhắn tiếp theo.

import React, { useMemo, useState } from 'react';
import { Check, HelpCircle, ListChecks, Send } from 'lucide-react';
import { formatClarifyAnswer, type ClarifyAnswers, type ClarifyRequest } from '../../services/ai/clarify';

interface ClarifyCardProps {
    request: ClarifyRequest;
    /** Gửi câu trả lời (đã định dạng) như một tin nhắn của người dùng */
    onSubmit: (text: string) => void;
    /** Đã có tin sau thẻ này hoặc AI đang trả lời → chỉ xem, không chọn được */
    disabled?: boolean;
}

const OTHER = '__other__';

const ClarifyCard: React.FC<ClarifyCardProps> = ({ request, onSubmit, disabled }) => {
    const [picked, setPicked] = useState<Record<string, string[]>>({});
    const [other, setOther] = useState<Record<string, string>>({});
    const isConfirm = request.purpose === 'confirm';

    const toggle = (qid: string, option: string, multi: boolean) => {
        if (disabled) return;
        setPicked(prev => {
            const cur = prev[qid] || [];
            if (multi) return { ...prev, [qid]: cur.includes(option) ? cur.filter(o => o !== option) : [...cur, option] };
            return { ...prev, [qid]: cur[0] === option ? [] : [option] };
        });
    };

    const answers: ClarifyAnswers = useMemo(() => {
        const out: ClarifyAnswers = {};
        for (const q of request.questions) {
            const sel = picked[q.id] || [];
            out[q.id] = {
                selected: sel.filter(o => o !== OTHER),
                other: sel.includes(OTHER) ? (other[q.id] || '').trim() : undefined,
            };
        }
        return out;
    }, [picked, other, request.questions]);

    const answeredCount = request.questions.filter(q => {
        const a = answers[q.id];
        return a.selected.length > 0 || !!a.other;
    }).length;

    const submit = () => {
        if (disabled || answeredCount === 0) return;
        onSubmit(formatClarifyAnswer(request, answers));
    };

    return (
        <div className={`mt-3 rounded-2xl border p-3 sm:p-4 bg-white shadow-sm ${isConfirm
            ? 'border-amber-200 dark:border-amber-400/40'
            : 'border-indigo-200 dark:border-indigo-400/40'} ${disabled ? 'opacity-70' : ''}`}
        >
            <div className="flex items-center gap-2 mb-2">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isConfirm
                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300'
                    : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300'}`}
                >
                    {isConfirm ? <ListChecks size={15} /> : <HelpCircle size={15} />}
                </span>
                <span className="text-xs font-bold text-gray-700 dark:text-slate-200">
                    {isConfirm ? 'Xác nhận trước khi ghi' : 'Cho mình hỏi thêm một chút'}
                </span>
            </div>

            <div className="space-y-3">
                {request.questions.map((q, qi) => {
                    const sel = picked[q.id] || [];
                    const options = q.allowOther ? [...q.options, OTHER] : q.options;
                    return (
                        <fieldset key={q.id} disabled={disabled} className="min-w-0">
                            <legend className="text-[13px] font-semibold text-gray-800 dark:text-slate-100 mb-1.5">
                                {request.questions.length > 1 && <span className="text-gray-400 dark:text-slate-500 mr-1">{qi + 1}.</span>}
                                {q.question}
                                {q.multi && <span className="ml-1.5 text-[10px] font-medium text-gray-400 dark:text-slate-500">(chọn nhiều)</span>}
                            </legend>
                            <div className="flex flex-wrap gap-1.5" role={q.multi ? 'group' : 'radiogroup'}>
                                {options.map(option => {
                                    const active = sel.includes(option);
                                    const label = option === OTHER ? 'Khác…' : option;
                                    return (
                                        <button
                                            key={option}
                                            type="button"
                                            role={q.multi ? 'checkbox' : 'radio'}
                                            aria-checked={active}
                                            onClick={() => toggle(q.id, option, !!q.multi)}
                                            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-medium text-left transition-colors ${active
                                                ? 'bg-indigo-600 border-indigo-600 text-white dark:bg-indigo-500 dark:border-indigo-500'
                                                : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-600 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:text-indigo-200'
                                                } disabled:cursor-default`}
                                        >
                                            {active && <Check size={12} className="shrink-0" />}
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                            {sel.includes(OTHER) && (
                                <input
                                    type="text"
                                    autoFocus
                                    value={other[q.id] || ''}
                                    onChange={e => setOther(prev => ({ ...prev, [q.id]: e.target.value }))}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                                    placeholder="Nhập câu trả lời của bạn…"
                                    maxLength={300}
                                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-indigo-500/20"
                                />
                            )}
                        </fieldset>
                    );
                })}
            </div>

            {!disabled && (
                <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
                    <span className="text-[11px] text-gray-400 dark:text-slate-500">
                        {answeredCount}/{request.questions.length} câu đã chọn
                        {!isConfirm && answeredCount < request.questions.length ? ' · câu bỏ trống AI sẽ tự giả định' : ''}
                    </span>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={answeredCount === 0}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold hover:shadow-md disabled:opacity-40 disabled:hover:shadow-none transition-all shrink-0"
                    >
                        <Send size={12} /> Gửi trả lời
                    </button>
                </div>
            )}
        </div>
    );
};

export default ClarifyCard;
