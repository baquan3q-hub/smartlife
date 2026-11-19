// File: src/components/ai/ModeBar.tsx
// Thanh chọn chế độ dưới ô soạn tin: chuyên gia (Chung, Lên kế hoạch, Tâm lý…) + tốc độ (Auto / Nhanh / Nghĩ vừa / Nghĩ sâu)

import React from 'react';
import { GlassIcon } from '../icons/GlassIcon';
import { EXPERT_LIST, type ExpertId } from '../../services/ai/experts';
import { SPEED_OPTIONS, type SpeedChoice } from './tiers';

interface ModeBarProps {
    speed: SpeedChoice;
    onSpeedChange: (speed: SpeedChoice) => void;
    expert: ExpertId;
    onExpertChange: (expert: ExpertId) => void;
    disabled?: boolean;
}

const ModeBar: React.FC<ModeBarProps> = ({ speed, onSpeedChange, expert, onExpertChange, disabled }) => {
    const current = EXPERT_LIST.find(e => e.id === expert) || EXPERT_LIST[0];

    return (
        <div className="mt-2 space-y-1.5">
            {/* Chuyên gia — cuộn ngang trên điện thoại */}
            <div
                className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-0.5"
                role="radiogroup"
                aria-label="Chế độ chuyên gia"
            >
                {EXPERT_LIST.map(e => {
                    const active = e.id === expert;
                    return (
                        <button
                            key={e.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={disabled}
                            onClick={() => onExpertChange(e.id)}
                            title={e.tagline}
                            className={`flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap shrink-0 transition-colors disabled:opacity-50 ${active
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/15 dark:border-indigo-400/40 dark:text-indigo-200'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white'
                                }`}
                        >
                            <GlassIcon name={e.icon} size={18} muted={!active} />
                            {e.name}
                        </button>
                    );
                })}
            </div>

            <div className="flex items-center justify-between gap-2">
                {/* Tốc độ trả lời: số sau tên là số lượt tính */}
                <div
                    className="flex items-center gap-0.5 p-0.5 rounded-lg bg-gray-100 dark:bg-slate-800 shrink-0"
                    role="radiogroup"
                    aria-label="Tốc độ trả lời"
                >
                    {SPEED_OPTIONS.map(option => {
                        const active = option.id === speed;
                        return (
                            <button
                                key={option.id}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                disabled={disabled}
                                onClick={() => onSpeedChange(option.id)}
                                title={`${option.hint} · tốn ${option.cost} lượt`}
                                className={`px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold whitespace-nowrap transition-colors disabled:opacity-50 ${active
                                    ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-600 dark:text-white'
                                    : 'text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-100'
                                    }`}
                            >
                                {option.label}
                                <span className={`ml-1 ${active ? 'text-blue-400 dark:text-blue-200' : 'text-gray-400 dark:text-slate-500'}`}>·{option.cost}</span>
                            </button>
                        );
                    })}
                </div>
                <p className="text-[9px] text-gray-400 dark:text-slate-500 text-right truncate hidden sm:block">
                    {current.id === 'general' ? 'Số sau tên là số lượt tính · Tệp tối đa 30MB/file' : current.tagline}
                </p>
            </div>
        </div>
    );
};

export default ModeBar;
