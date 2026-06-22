// File: src/components/ImpactSimulatorModal.tsx
import React, { useState } from 'react';
import { X, Sparkles, AlertTriangle, CheckCircle, ArrowRight, Wallet, Calendar, PiggyBank, RefreshCw, Plus } from 'lucide-react';
import { AppState, Transaction } from '../types';
import { simulateFinancialImpact, FinancialSimulationResult } from '../services/aiEngine';
import { Lang, t } from '../i18n/i18n';

interface ImpactSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  appState: AppState;
  lang: Lang;
  onAddTransaction: (tx: any) => Promise<void>;
}

const PRESETS = [
  { label: '👮 CSGT phạt', labelEn: '👮 Traffic Fine', amount: 2000000, desc: 'CSGT lập biên bản vi phạm' },
  { label: '💒 Tiệc cưới bạn', labelEn: '💒 Wedding Party', amount: 1000000, desc: 'Đi đám cưới bạn thân' },
  { label: '💻 Mua Laptop mới', labelEn: '💻 Buy Laptop', amount: 15000000, desc: 'Nâng cấp máy tính làm việc' },
  { label: '🍕 Tiệc liên hoan', labelEn: '🍕 Team Party', amount: 500000, desc: 'Liên hoan nhóm cuối tuần' },
  { label: '📱 Đổi điện thoại', labelEn: '📱 Upgrade Phone', amount: 8000000, desc: 'Mua điện thoại mới phát sinh' },
];

const ImpactSimulatorModal: React.FC<ImpactSimulatorModalProps> = ({
  isOpen,
  onClose,
  appState,
  lang,
  onAddTransaction
}) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FinancialSimulationResult | null>(null);
  const [applied, setApplied] = useState(false);

  const isEn = lang === 'en';

  if (!isOpen) return null;

  const handleSelectPreset = (preset: typeof PRESETS[0]) => {
    setDescription(isEn ? preset.desc : preset.desc);
    setAmount(preset.amount);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount) return;

    setLoading(true);
    setResult(null);
    setApplied(false);

    try {
      const res = await simulateFinancialImpact(description.trim(), Number(amount), appState, lang);
      setResult(res);
    } catch (err) {
      console.error(err);
      alert(isEn ? 'Analysis failed. Please try again.' : 'Không thể hoàn thành đánh giá. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTransaction = async () => {
    if (!amount || !description.trim()) return;

    try {
      await onAddTransaction({
        amount: Number(amount),
        category: 'Khác',
        type: 'expense',
        date: new Date().toISOString().slice(0, 10),
        description: `[AI Simulated] ${description.trim()}`
      });
      setApplied(true);
      alert(isEn ? 'Transaction applied successfully! 💸' : 'Đã ghi nhận giao dịch thành công! 💸');
    } catch (err: any) {
      console.error(err);
      alert('Error: ' + err.message);
    }
  };

  const getImpactColor = (level: string) => {
    if (level === 'high') return 'text-rose-500 bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30';
    if (level === 'medium') return 'text-amber-500 bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30';
    return 'text-emerald-500 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-250">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
            <h2 className="text-lg font-black text-slate-800 dark:text-white">
              {isEn ? 'AI Financial Impact Simulator' : 'Cố vấn Tác động Tài chính AI'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-650 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
          
          {/* Input Form */}
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wider">
                  {isEn ? 'Scenario Description' : 'Kịch bản phát sinh'}
                </label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={isEn ? 'e.g. Wedding party, Speeding ticket...' : 'VD: Đi ăn cưới bạn, Bị phạt vi phạm giao thông...'}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wider">
                  {isEn ? 'Estimated Amount (VND)' : 'Số tiền phát sinh (VND)'}
                </label>
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 1000000"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800 transition-all"
                />
              </div>
            </div>

            {/* Presets List */}
            <div>
              <span className="block text-[9px] font-black text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">
                {isEn ? 'Quick Presets' : 'Kịch bản gợi ý nhanh'}
              </span>
              <div className="flex gap-2 flex-wrap select-none">
                {PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-750 bg-slate-50/50 dark:bg-slate-800/20 text-[10.5px] font-bold text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-150"
                  >
                    {isEn ? preset.labelEn : preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Analyze Trigger */}
            <button
              type="submit"
              disabled={loading || !description.trim() || !amount}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-200/20 transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2 select-none"
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  {isEn ? 'AI is evaluating impact...' : 'AI đang tính toán tác động tài chính...'}
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  {isEn ? 'Simulate Financial Impact' : 'Đánh giá tác động tài chính'}
                </>
              )}
            </button>
          </form>

          {/* AI Result Container */}
          {result && (
            <div className="space-y-5 border-t border-slate-100 dark:border-slate-850 pt-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Impact Level and Summary */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full border ${getImpactColor(result.impact_level)} uppercase tracking-wide flex items-center gap-1.5`}>
                    <AlertTriangle size={11} />
                    {isEn ? 'Impact Level' : 'Mức ảnh hưởng'}: {result.impact_level_label}
                  </span>
                </div>
                
                <p className="text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-400 font-semibold bg-slate-50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
                  {result.summary}
                </p>
              </div>

              {/* Before/After Visualization Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                
                {/* Wallet Balance Impact */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-850 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 mb-1">
                    <Wallet size={13} />
                    <span className="text-[9px] font-black uppercase tracking-wider">{isEn ? 'Est. Total Balance' : 'Số dư sau phát sinh'}</span>
                  </div>
                  <div className="text-sm font-black text-slate-800 dark:text-white">
                    {result.current_balance_after.toLocaleString('vi-VN')}đ
                  </div>
                  <div className="text-[9.5px] font-bold text-rose-500 mt-1 flex items-center gap-0.5">
                    -{Number(amount).toLocaleString('vi-VN')}đ
                  </div>
                </div>

                {/* Monthly Budget Consumed */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-850 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 mb-1">
                    <Calendar size={13} />
                    <span className="text-[9px] font-black uppercase tracking-wider">{isEn ? 'Budget Spent' : 'Ngân sách thâm hụt'}</span>
                  </div>
                  <div className="text-sm font-black text-slate-800 dark:text-white">
                    {result.budget_impact_percent}%
                  </div>
                  <div className="text-[9.5px] font-bold text-amber-500 mt-1">
                    {isEn ? 'of monthly budget' : 'ngân sách tháng này'}
                  </div>
                </div>

                {/* Savings Goal Delay */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-850 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 mb-1">
                    <PiggyBank size={13} />
                    <span className="text-[9px] font-black uppercase tracking-wider">{isEn ? 'Savings Delay' : 'Chậm tiến độ tiết kiệm'}</span>
                  </div>
                  <div className="text-sm font-black text-slate-800 dark:text-white">
                    {result.savings_delay_days > 0 ? `+${result.savings_delay_days} ${isEn ? 'days' : 'ngày'}` : `0 ${isEn ? 'days' : 'ngày'}`}
                  </div>
                  <div className="text-[9.5px] font-bold text-rose-500 mt-1">
                    {isEn ? 'to achieve goals' : 'dự kiến đạt mục tiêu'}
                  </div>
                </div>

              </div>

              {/* Wallet list impacts */}
              {result.wallet_impacts && result.wallet_impacts.length > 0 && (
                <div className="space-y-2">
                  <span className="block text-[9.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {isEn ? 'Impacted Wallets' : 'Các ví chịu ảnh hưởng'}
                  </span>
                  <div className="space-y-1.5">
                    {result.wallet_impacts.map((wi, index) => (
                      <div key={index} className="flex justify-between items-center p-3 rounded-xl bg-white dark:bg-slate-800/10 border border-slate-100 dark:border-slate-850">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{wi.wallet_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-400 line-through">{wi.balance_before.toLocaleString('vi-VN')}đ</span>
                          <ArrowRight size={10} className="text-slate-400" />
                          <span className="text-xs font-black text-slate-800 dark:text-white">{wi.balance_after.toLocaleString('vi-VN')}đ</span>
                          <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 ml-1">-{wi.percentage_decrease}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations Section */}
              <div className="space-y-2">
                <span className="block text-[9.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {isEn ? 'AI Recommendations & Next Steps' : 'Đề xuất cố vấn từ AI & Next steps'}
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {result.recommendations.map((rec, index) => (
                    <div key={index} className="p-3 bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800/10 dark:to-slate-800/5 rounded-2xl border border-slate-150/40 dark:border-slate-850">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        {rec.title}
                      </h4>
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-normal pl-3 font-semibold">
                        {rec.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Apply Transaction to Real Wallet */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={applied}
                  onClick={handleApplyTransaction}
                  className={`w-full py-3 font-bold text-xs rounded-xl shadow-md transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2 select-none
                    ${applied 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/10 dark:text-emerald-400 dark:border-emerald-900/20 cursor-default' 
                      : 'bg-black hover:bg-slate-900 text-white dark:bg-primary dark:hover:bg-primary/95 dark:text-primary-foreground'}`}
                >
                  {applied ? (
                    <>
                      <CheckCircle size={14} className="text-emerald-500" />
                      {isEn ? 'Applied as Real Transaction' : 'Đã áp dụng vào chi tiêu thực tế'}
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      {isEn ? 'Apply as Real Expense Transaction' : 'Ghi nhận khoản này vào chi tiêu thực tế'}
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ImpactSimulatorModal;
