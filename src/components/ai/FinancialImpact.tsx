// File: src/components/ai/FinancialImpact.tsx
// Thẻ mô phỏng tác động tài chính (tool simulate_financial_impact) và hộp chi tiết — tách từ AIAdvisorPage

import React from 'react';
import { AlertCircle, Sparkles, X } from 'lucide-react';
import type { AppState } from '../../types';
import type { ChartData } from '../../services/aiEngine';
import InlineChatChart from '../InlineChatChart';
// ────────────────────────────────────────
// Financial Impact Components
// ────────────────────────────────────────
interface FinancialImpactCardProps {
    action: any;
    appState: AppState;
    onAddTransaction?: (tx: any) => Promise<void>;
    onOpenDetails: (data: any) => void;
}

export const FinancialImpactCard: React.FC<FinancialImpactCardProps> = ({
    action,
    appState,
    onAddTransaction,
    onOpenDetails
}) => {
    const { description, amount, simulation } = action.data || {};
    if (!simulation) return null;

    const isApplied = appState.transactions.some(t => 
        t.amount === amount && 
        (t.description === `[AI Simulated] ${description}` || t.description.includes(description))
    );

    const getImpactColor = (level: string) => {
        if (level === 'high') return 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/30';
        if (level === 'medium') return 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/30';
        return 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30';
    };

    const handleApply = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!onAddTransaction) return;
        try {
            await onAddTransaction({
                amount: Number(amount),
                category: 'Khác',
                type: 'expense',
                date: new Date().toISOString().slice(0, 10),
                description: `[AI Simulated] ${description.trim()}`
            });
            alert('Đã ghi nhận giao dịch thành công! 💸');
        } catch (err: any) {
            console.error(err);
            alert('Lỗi ghi nhận: ' + err.message);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4 space-y-3 hover:shadow-md transition-all duration-200 animate-fade-in text-left">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-base shrink-0 shadow-sm">
                        💸
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-slate-800 line-clamp-1">{description}</h4>
                        <p className="text-[10px] text-slate-400 font-bold">{amount.toLocaleString('vi-VN')}đ</p>
                    </div>
                </div>
                <span className={`text-[9.5px] font-extrabold px-2.5 py-1 rounded-full border uppercase tracking-wider ${getImpactColor(simulation.impact_level)}`}>
                    {simulation.impact_level_label}
                </span>
            </div>

            {/* Quick Summary */}
            <p className="text-[11px] text-slate-500 leading-relaxed font-semibold bg-slate-50 p-2.5 rounded-xl border border-slate-100 line-clamp-2">
                {simulation.summary}
            </p>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 bg-slate-50/50 rounded-xl border border-slate-100/50">
                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Số dư sau phát sinh</span>
                    <span className="text-xs font-black text-slate-800">{(simulation.current_balance_after || 0).toLocaleString('vi-VN')}đ</span>
                </div>
                <div className="p-2 bg-slate-50/50 rounded-xl border border-slate-100/50">
                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Trì hoãn tiết kiệm</span>
                    <span className="text-xs font-black text-slate-800">{simulation.savings_delay_days > 0 ? `+${simulation.savings_delay_days} ngày` : '0 ngày'}</span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-50">
                <button
                    onClick={() => onOpenDetails(action.data)}
                    className="flex-1 py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[10px] font-extrabold transition-all border border-indigo-100 flex items-center justify-center gap-1 active:scale-[0.98]"
                >
                    Chi tiết cố vấn 🔍
                </button>
                <button
                    onClick={handleApply}
                    disabled={isApplied}
                    className={`flex-1 py-1.5 px-3 rounded-xl text-[10px] font-extrabold transition-all flex items-center justify-center gap-1 active:scale-[0.98] ${
                        isApplied 
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 cursor-default' 
                            : 'bg-slate-900 hover:bg-slate-855 text-white border border-transparent'
                    }`}
                >
                    {isApplied ? 'Đã ghi nhận 💸' : 'Ghi nhận thực tế ➕'}
                </button>
            </div>
        </div>
    );
};

interface FinancialImpactDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: any;
    appState: AppState;
    onAddTransaction?: (tx: any) => Promise<void>;
}

export const FinancialImpactDetailsModal: React.FC<FinancialImpactDetailsModalProps> = ({
    isOpen,
    onClose,
    data,
    appState,
    onAddTransaction
}) => {
    if (!isOpen || !data) return null;
    const { description, amount, simulation } = data;
    if (!simulation) return null;

    const isApplied = appState.transactions.some(t => 
        t.amount === amount && 
        (t.description === `[AI Simulated] ${description}` || t.description.includes(description))
    );

    const getImpactColor = (level: string) => {
        if (level === 'high') return 'text-rose-600 bg-rose-50 border-rose-250';
        if (level === 'medium') return 'text-amber-600 bg-amber-50 border-amber-250';
        return 'text-emerald-600 bg-emerald-50 border-emerald-250';
    };

    const handleApply = async () => {
        if (!onAddTransaction) return;
        try {
            await onAddTransaction({
                amount: Number(amount),
                category: 'Khác',
                type: 'expense',
                date: new Date().toISOString().slice(0, 10),
                description: `[AI Simulated] ${description.trim()}`
            });
            alert('Đã ghi nhận giao dịch thành công! 💸');
        } catch (err: any) {
            console.error(err);
            alert('Lỗi ghi nhận: ' + err.message);
        }
    };

    // Prepare chart for surplus trends
    const trends = simulation.historical_trends?.monthly_trends || [];
    const hasTrendData = trends.length > 0;
    const chartData: ChartData | null = hasTrendData ? {
        chart_type: 'bar',
        title: 'Thặng dư Thu chi 6 tháng gần nhất',
        data: trends.map((t: any) => ({
            label: t.month,
            value: t.surplus,
            color: t.surplus >= 0 ? '#3b82f6' : '#f43f5e'
        }))
    } : null;

    const trendsAvg = simulation.historical_trends || { avg_income: 0, avg_expense: 0, avg_surplus: 0, comparison_percentage: 0 };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-250">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
                        <h2 className="text-sm font-black text-slate-800 dark:text-white">
                            Cố vấn Phân tích Tác động Tài chính
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-650 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 overflow-y-auto flex-1 custom-scrollbar space-y-5 text-left">
                    {/* General Summary & Impact Level */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full border uppercase tracking-wider flex items-center gap-1.5 ${getImpactColor(simulation.impact_level)}`}>
                                <AlertCircle size={12} />
                                Mức ảnh hưởng: {simulation.impact_level_label}
                            </span>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-650 dark:text-slate-400 font-semibold bg-slate-50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
                            {simulation.summary}
                        </p>
                    </div>

                    {/* Quick Metrics Cards */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-850">
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">Số dư sau chi</span>
                            <span className="text-xs font-black text-slate-800 dark:text-white">{(simulation.current_balance_after || 0).toLocaleString('vi-VN')}đ</span>
                            <p className="text-[8px] font-bold text-rose-500 mt-0.5">-{amount.toLocaleString('vi-VN')}đ</p>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-850">
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">Ngân sách thâm hụt</span>
                            <span className="text-xs font-black text-slate-800 dark:text-white">{simulation.budget_impact_percent}%</span>
                            <p className="text-[8px] font-bold text-amber-500 mt-0.5">tiêu hao ngân sách</p>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-850">
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">Trì hoãn tiết kiệm</span>
                            <span className="text-xs font-black text-slate-800 dark:text-white">{simulation.savings_delay_days > 0 ? `+${simulation.savings_delay_days} ngày` : '0 ngày'}</span>
                            <p className="text-[8px] font-bold text-rose-500 mt-0.5">đạt mục tiêu</p>
                        </div>
                    </div>

                    {/* Historical Trends Comparison */}
                    <div className="p-4.5 bg-gradient-to-br from-indigo-50/40 to-blue-50/20 dark:from-slate-800/20 dark:to-slate-800/5 border border-indigo-100/50 rounded-2xl space-y-3">
                        <h3 className="text-xs font-black text-indigo-950 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                            📊 So sánh với xu hướng lịch sử
                        </h3>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <span className="text-slate-400 block text-[9px] font-bold uppercase">Thặng dư TB 3 tháng:</span>
                                <strong className="text-slate-700 dark:text-slate-300 font-extrabold">{trendsAvg.avg_surplus.toLocaleString('vi-VN')}đ/tháng</strong>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[9px] font-bold uppercase">Tỷ trọng khoản chi:</span>
                                <strong className={`font-extrabold ${trendsAvg.comparison_percentage > 80 ? 'text-rose-650' : 'text-indigo-650'}`}>
                                    {trendsAvg.comparison_percentage}% thặng dư
                                </strong>
                            </div>
                        </div>

                        {/* Chart */}
                        {chartData && (
                            <div className="pt-1.5 bg-white dark:bg-slate-900 rounded-xl p-2 border border-slate-100 dark:border-slate-800">
                                <InlineChatChart chart={chartData} />
                            </div>
                        )}

                        <div className="text-[10px] text-slate-500 leading-relaxed font-medium">
                            💡 {trendsAvg.avg_surplus > 0 
                                ? `Khoản phát sinh này tiêu tốn khoảng ${trendsAvg.comparison_percentage}% số tiền bạn tiết kiệm được trung bình mỗi tháng (${trendsAvg.avg_surplus.toLocaleString('vi-VN')}đ).`
                                : 'Bạn đang thâm hụt thu chi trung bình các tháng qua. Hãy hết sức cẩn trọng với khoản chi phát sinh này!'
                            }
                        </div>
                    </div>

                    {/* Wallets Impacted list */}
                    {simulation.wallet_impacts && simulation.wallet_impacts.length > 0 && (
                        <div className="space-y-2">
                            <span className="block text-[9.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                Ví tiền bị ảnh hưởng
                            </span>
                            <div className="space-y-1.5">
                                {simulation.wallet_impacts.map((wi: any, index: number) => (
                                    <div key={index} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/10 border border-slate-100 dark:border-slate-850">
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{wi.wallet_name}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-slate-400 line-through">{(wi.balance_before || 0).toLocaleString('vi-VN')}đ</span>
                                            <span className="text-xs text-slate-400">→</span>
                                            <span className="text-xs font-black text-slate-800 dark:text-white">{(wi.balance_after || 0).toLocaleString('vi-VN')}đ</span>
                                            <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-650 dark:bg-rose-950/20 ml-1">-{wi.percentage_decrease}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recommendations Section */}
                    {simulation.recommendations && simulation.recommendations.length > 0 && (
                        <div className="space-y-2">
                            <span className="block text-[9.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                Khuyến nghị & Giải pháp từ AI
                            </span>
                            <div className="grid grid-cols-1 gap-2">
                                {simulation.recommendations.map((rec: any, index: number) => (
                                    <div key={index} className="p-3 bg-slate-50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-850">
                                        <h4 className="text-xs font-bold text-slate-855 dark:text-white flex items-center gap-1.5 mb-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                            {rec.title}
                                        </h4>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-450 leading-relaxed font-semibold pl-3">
                                            {rec.description}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 hover:bg-gray-200 dark:hover:bg-slate-850 text-gray-500 rounded-xl text-xs font-bold transition-colors"
                    >
                        Đóng lại
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={isApplied}
                        className={`px-4 py-2 font-bold text-xs rounded-xl shadow-md transition-all duration-200 active:scale-[0.99] flex items-center gap-1.5 ${
                            isApplied 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-250 cursor-default' 
                                : 'bg-slate-900 hover:bg-slate-855 text-white'
                        }`}
                    >
                        {isApplied ? 'Đã ghi nhận vào thực tế' : 'Ghi nhận khoản này thực tế'}
                    </button>
                </div>
            </div>
        </div>
    );
};
