import React from 'react';
import { SmartInsight } from '../types';
import { Lightbulb, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface InsightCardProps {
    insight: SmartInsight;
    onDismiss: (id: string) => void;
    onAction?: (action: string) => void;
}

const InsightCard: React.FC<InsightCardProps> = ({ insight, onDismiss, onAction }) => {
    // Determine styles based on type
    let colorClass = 'bg-white border-gray-100';
    let icon = <Lightbulb size={20} className="text-indigo-600" />;

    switch (insight.type) {
        case 'FINANCE_WARNING':
            colorClass = 'bg-red-50 border-red-200';
            icon = <AlertTriangle size={20} className="text-red-500" />;
            break;
        case 'HABIT_KUDOS':
            colorClass = 'bg-emerald-50 border-emerald-200';
            icon = <CheckCircle2 size={20} className="text-emerald-500" />;
            break;
        case 'SCHEDULE_OPTIMIZATION':
            colorClass = 'bg-amber-50 border-amber-200';
            icon = <TrendingUp size={20} className="text-amber-500" />;
            break;
        default:
            colorClass = 'bg-indigo-50 border-indigo-200';
            icon = <Lightbulb size={20} className="text-indigo-500" />;
    }

    return (
        <div className={`relative p-4 rounded-2xl border flex gap-3 shadow-sm mb-4 animate-fade-in ${colorClass}`}>
            <div className="shrink-0 mt-0.5">
                {icon}
            </div>

            <div className="flex-1">
                <h4 className="font-bold text-gray-800 text-sm mb-1 uppercase tracking-wide opacity-70">
                    {insight.type === 'FINANCE_WARNING' ? 'Cảnh báo chi tiêu' :
                        insight.type === 'HABIT_KUDOS' ? 'Khen thưởng' :
                            insight.type === 'SCHEDULE_OPTIMIZATION' ? 'Tối ưu lịch trình' : 'Gợi ý thông minh'}
                </h4>
                <p className="text-sm text-gray-700 font-medium leading-relaxed">
                    {insight.message}
                </p>

                {insight.action_link && (
                    <button
                        onClick={() => onAction && onAction(insight.action_link!)}
                        className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
                    >
                        Xem chi tiết &rarr;
                    </button>
                )}
            </div>

            <button
                onClick={() => onDismiss(insight.id)}
                className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-black/5 transaction-colors"
                title="Đã hiểu"
            >
                ✕
            </button>
        </div>
    );
};

export default InsightCard;
