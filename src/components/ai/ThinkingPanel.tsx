// File: src/components/ai/ThinkingPanel.tsx
// Khung "AI đang làm gì": khi đang chạy hiện các bước tìm dữ liệu + suy nghĩ chạy chữ,
// xong thì thu gọn thành "Đã suy nghĩ 12 giây · 3 bước", bấm để mở lại.

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, Brain, CheckCircle2, ChevronDown, Loader2 } from 'lucide-react';
import type { AIStep } from '../../services/aiEngine';
import { formatDuration } from '../../services/ai/toolLabels';

interface ThinkingPanelProps {
    live: boolean;
    startedAt?: number;
    steps?: AIStep[];
    thoughts?: string;
    durationMs?: number;
    stopped?: boolean;
}

// Tóm tắt suy nghĩ của Gemini thường có dòng tiêu đề dạng **…** — in đậm dòng đó, còn lại để chữ thường
const ThoughtText: React.FC<{ text: string }> = ({ text }) => (
    <>
        {text.split('\n').map((line, i) => {
            const t = line.trim();
            if (!t) return <div key={i} className="h-1.5" />;
            const heading = t.match(/^\*\*(.+)\*\*$/);
            if (heading) return <p key={i} className="font-semibold text-gray-600 mt-1.5 first:mt-0">{heading[1]}</p>;
            return <p key={i}>{t.replace(/\*\*(.+?)\*\*/g, '$1')}</p>;
        })}
    </>
);

const StepIcon: React.FC<{ status: AIStep['status'] }> = ({ status }) => {
    if (status === 'running') return <Loader2 size={13} className="animate-spin text-blue-500 shrink-0 mt-px" />;
    if (status === 'error') return <AlertCircle size={13} className="text-red-500 shrink-0 mt-px" />;
    return <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-px" />;
};

const ThinkingPanel: React.FC<ThinkingPanelProps> = ({ live, startedAt, steps = [], thoughts = '', durationMs, stopped }) => {
    const [userOpen, setUserOpen] = useState<boolean | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const thoughtsRef = useRef<HTMLDivElement>(null);

    // Đồng hồ giây khi đang chạy
    useEffect(() => {
        if (!live) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [live]);

    // Suy nghĩ chạy chữ: luôn kéo xuống dòng mới nhất
    useEffect(() => {
        if (live && thoughtsRef.current) thoughtsRef.current.scrollTop = thoughtsRef.current.scrollHeight;
    }, [thoughts, live]);

    const hasBody = steps.length > 0 || thoughts.trim().length > 0;
    if (!live && !hasBody) return null;

    const open = (userOpen ?? live) && hasBody;
    const elapsed = live ? Math.max(0, now - (startedAt ?? now)) : durationMs;
    const running = [...steps].reverse().find(s => s.status === 'running');

    let label: string;
    if (live) {
        label = running ? running.label : thoughts ? 'Đang suy nghĩ' : 'Đang phân tích';
    } else {
        const parts = [elapsed ? `${stopped ? 'Đã dừng sau' : 'Đã suy nghĩ'} ${formatDuration(elapsed)}` : stopped ? 'Đã dừng' : 'Đã suy nghĩ'];
        if (steps.length) parts.push(`${steps.length} bước`);
        label = parts.join(' · ');
    }

    return (
        <div className="mb-1.5">
            <button
                type="button"
                onClick={() => hasBody && setUserOpen(!open)}
                className={`inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    live ? 'text-blue-700 bg-blue-50' : 'text-gray-500 hover:bg-gray-100'
                } ${hasBody ? 'cursor-pointer' : 'cursor-default'}`}
                aria-expanded={open}
            >
                {live
                    ? <Loader2 size={12} className="animate-spin shrink-0" />
                    : <Brain size={12} className="shrink-0" />}
                <span className={`truncate ${live ? 'ai-shimmer-text' : ''}`}>{label}</span>
                {live && elapsed !== undefined && elapsed >= 1000 && (
                    <span className="text-blue-400 font-medium shrink-0">· {formatDuration(elapsed)}</span>
                )}
                {hasBody && <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />}
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="overflow-hidden"
                    >
                        <div className="mt-1.5 ml-1 pl-3 border-l-2 border-blue-100 space-y-1.5 text-xs text-gray-500">
                            {steps.map(step => (
                                <div key={step.id} className="flex items-start gap-1.5">
                                    <StepIcon status={step.status} />
                                    <div className="min-w-0">
                                        <span className={step.status === 'error' ? 'text-red-600' : 'text-gray-600'}>{step.label}</span>
                                        {step.detail && <span className="text-gray-400"> · {step.detail}</span>}
                                    </div>
                                </div>
                            ))}
                            {thoughts.trim() && (
                                <div ref={thoughtsRef} className="max-h-48 overflow-y-auto custom-scrollbar leading-relaxed pr-1 space-y-0.5">
                                    <ThoughtText text={thoughts} />
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ThinkingPanel;
