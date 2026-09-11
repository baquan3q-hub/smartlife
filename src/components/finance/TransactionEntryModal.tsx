import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Plus, TrendingDown, TrendingUp, Wallet as WalletIcon, CalendarDays, 
  StickyNote, Calculator as CalculatorIcon, Check, Settings, Trash2, 
  ChevronDown, CheckCircle2
} from 'lucide-react';
import { Transaction, TransactionType, AppState, RecurringTransaction } from '../../types';
import { recurringTransactionService } from '../../services/recurringTransactionService';
import { Lang } from '../../i18n/i18n';
import { getCategoryIconInfo } from '../../utils/categoryIcons';

interface BatchRowItem {
  id: string;
  category: string;
  amount: string;
  description: string;
  wallet_id?: string;
  date: string;
}

interface TransactionEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
  onBatchAddTransactions?: (txList: Omit<Transaction, 'id'>[]) => Promise<void>;
  onUpdateTransaction?: (t: Transaction) => void;
  editingTransaction?: Transaction | null;
  expenseCategories: string[];
  incomeCategories: string[];
  pinnedCategories: string[];
  onOpenCategoryManager: () => void;
  lang: Lang;
}

// Math evaluation helper
const parseMathExpression = (expr: string): number | null => {
  if (!expr || !expr.trim()) return null;
  try {
    let cleaned = expr.toLowerCase();
    cleaned = cleaned.replace(/tr(iệu)?/g, '*1000000');
    cleaned = cleaned.replace(/m/g, '*1000000');
    cleaned = cleaned.replace(/t(ỷ)?/g, '*1000000000');
    cleaned = cleaned.replace(/k/g, '*1000');
    cleaned = cleaned.replace(/x|×/g, '*');
    cleaned = cleaned.replace(/:|÷/g, '/');
    cleaned = cleaned.replace(/\s+/g, '');
    cleaned = cleaned.replace(/(\d)[.,](\d{3})(?!\d)/g, '$1$2');
    cleaned = cleaned.replace(/,/g, '.');

    const safeRegex = /^[\d\+\-\*\/\(\)\.]+$/;
    if (!safeRegex.test(cleaned)) return null;

    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${cleaned})`)();
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return Math.max(0, result);
    }
    return null;
  } catch (e) {
    return null;
  }
};

const formatVND = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

export const TransactionEntryModal: React.FC<TransactionEntryModalProps> = ({
  isOpen,
  onClose,
  state,
  onAddTransaction,
  onBatchAddTransactions,
  onUpdateTransaction,
  editingTransaction,
  expenseCategories,
  incomeCategories,
  pinnedCategories,
  onOpenCategoryManager,
  lang
}) => {
  const [entryMode, setEntryMode] = useState<'single' | 'batch'>('single');
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [category, setCategory] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [desc, setDesc] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [walletId, setWalletId] = useState<string>('');
  const [showKeypad, setShowKeypad] = useState<boolean>(false);

  const [sessionAdded, setSessionAdded] = useState<Omit<Transaction, 'id'>[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [saveAsRecurring, setSaveAsRecurring] = useState<boolean>(false);
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringTransaction[]>([]);

  useEffect(() => {
    if (isOpen && state.profile?.id) {
      recurringTransactionService.fetchRecurringTransactions(state.profile.id)
        .then(data => setRecurringTemplates(data.filter(i => i.status === 'active')))
        .catch(() => {});
    }
  }, [isOpen, state.profile?.id]);

  const [, setIconUpdateTick] = useState(0);
  useEffect(() => {
    const handleIconsUpdate = () => setIconUpdateTick(t => t + 1);
    window.addEventListener('category_icons_updated', handleIconsUpdate);
    return () => window.removeEventListener('category_icons_updated', handleIconsUpdate);
  }, []);

  // Batch Mode Rows
  const [batchRows, setBatchRows] = useState<BatchRowItem[]>([
    { id: '1', category: '', amount: '', description: '', date: new Date().toISOString().split('T')[0] },
    { id: '2', category: '', amount: '', description: '', date: new Date().toISOString().split('T')[0] },
    { id: '3', category: '', amount: '', description: '', date: new Date().toISOString().split('T')[0] }
  ]);

  const amountInputRef = useRef<HTMLInputElement>(null);

  const availableCategories = type === TransactionType.EXPENSE ? expenseCategories : incomeCategories;
  const pinnedList = availableCategories.filter(c => pinnedCategories.includes(c));
  const otherList = availableCategories.filter(c => !pinnedCategories.includes(c));

  useEffect(() => {
    if (isOpen) {
      if (editingTransaction) {
        setType(editingTransaction.type);
        setCategory(editingTransaction.category);
        setAmount(editingTransaction.amount.toString());
        setDesc(editingTransaction.description);
        setDate(editingTransaction.date);
        setWalletId(editingTransaction.wallet_id || '');
        setEntryMode('single');
      } else {
        const defaultCat = pinnedList[0] || availableCategories[0] || 'Ăn uống';
        setCategory(defaultCat);
        setAmount('');
        setDesc('');
        setDate(new Date().toISOString().split('T')[0]);
        setSessionAdded([]);
        setToastMessage(null);
      }
      setTimeout(() => amountInputRef.current?.focus(), 150);
    }
  }, [isOpen, editingTransaction]);

  useEffect(() => {
    if (!editingTransaction && isOpen) {
      const defaultCat = pinnedList[0] || availableCategories[0] || '';
      setCategory(defaultCat);
    }
  }, [type]);

  if (!isOpen) return null;

  const quickAmountChips = [
    { label: '+10k', value: 10000 },
    { label: '+20k', value: 20000 },
    { label: '+50k', value: 50000 },
    { label: '+100k', value: 100000 },
    { label: '+200k', value: 200000 },
    { label: '+500k', value: 500000 }
  ];

  const handleChipClick = (val: number) => {
    const current = parseMathExpression(amount) || 0;
    const next = current + val;
    setAmount(next.toString());
    amountInputRef.current?.focus();
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handleSaveContinuous = (shouldClose: boolean = false) => {
    const parsedAmount = parseMathExpression(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      alert('Vui lòng nhập số tiền hợp lệ!');
      amountInputRef.current?.focus();
      return;
    }

    const finalCategory = category || (type === TransactionType.EXPENSE ? 'Chi tiêu' : 'Thu nhập');

    if (editingTransaction && onUpdateTransaction) {
      onUpdateTransaction({
        ...editingTransaction,
        amount: parsedAmount,
        category: finalCategory,
        date: date,
        type: type,
        description: desc.trim() || (type === TransactionType.EXPENSE ? 'Chi tiêu' : 'Thu nhập'),
        wallet_id: walletId || null
      });
      onClose();
      return;
    }

    const newTx: Omit<Transaction, 'id'> = {
      amount: parsedAmount,
      category: finalCategory,
      date: date,
      type: type,
      description: desc.trim() || (type === TransactionType.EXPENSE ? 'Chi tiêu' : 'Thu nhập'),
      wallet_id: walletId || null
    };

    onAddTransaction(newTx);
    setSessionAdded(prev => [newTx, ...prev]);

    if (saveAsRecurring) {
      const dayNum = date ? parseInt(date.split('-')[2] || '1', 10) : 1;
      recurringTransactionService.addRecurringTransaction(state.profile?.id || 'guest', {
        title: desc.trim() || finalCategory,
        amount: parsedAmount,
        type: type,
        category: finalCategory,
        wallet_id: walletId || null,
        day_of_month: dayNum >= 1 && dayNum <= 31 ? dayNum : 1,
        status: 'active',
        description: desc.trim() || '',
        auto_apply: true,
        last_applied_month: date.slice(0, 7)
      });
      setSaveAsRecurring(false);
    }

    showToast(`Đã thêm ${formatVND(parsedAmount)} • ${finalCategory}`);

    if (shouldClose) {
      onClose();
    } else {
      setAmount('');
      setDesc('');
      setTimeout(() => amountInputRef.current?.focus(), 50);
    }
  };

  const handleAddBatchRow = () => {
    const defaultCat = pinnedList[0] || availableCategories[0] || '';
    setBatchRows(prev => [
      ...prev,
      { id: Date.now().toString(), category: defaultCat, amount: '', description: '', date }
    ]);
  };

  const handleUpdateBatchRow = (id: string, field: keyof BatchRowItem, value: any) => {
    setBatchRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleRemoveBatchRow = (id: string) => {
    if (batchRows.length <= 1) return;
    setBatchRows(prev => prev.filter(r => r.id !== id));
  };

  const handleSaveAllBatch = async () => {
    const validRows: Omit<Transaction, 'id'>[] = [];

    for (const row of batchRows) {
      const parsed = parseMathExpression(row.amount);
      if (parsed && parsed > 0) {
        validRows.push({
          amount: parsed,
          category: row.category || availableCategories[0] || 'Chi tiêu',
          date: row.date || date,
          type: type,
          description: row.description.trim() || (type === TransactionType.EXPENSE ? 'Chi tiêu' : 'Thu nhập'),
          wallet_id: walletId || null
        });
      }
    }

    if (validRows.length === 0) {
      alert('Vui lòng nhập số tiền cho ít nhất một giao dịch!');
      return;
    }

    if (onBatchAddTransactions) {
      await onBatchAddTransactions(validRows);
    } else {
      validRows.forEach(tx => onAddTransaction(tx));
    }

    onClose();
  };

  const batchTotalAmount = batchRows.reduce((sum, r) => {
    const p = parseMathExpression(r.amount);
    return sum + (p && p > 0 ? p : 0);
  }, 0);

  const batchValidCount = batchRows.filter(r => (parseMathExpression(r.amount) || 0) > 0).length;
  const currentParsedAmount = parseMathExpression(amount);

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-3 md:p-6 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-gray-200">

        {/* Toast notification overlay */}
        {toastMessage && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-gray-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Header Bar */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            {!editingTransaction ? (
              <div className="bg-gray-100 p-0.5 rounded-lg flex">
                <button
                  type="button"
                  onClick={() => setEntryMode('single')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    entryMode === 'single'
                      ? 'bg-white text-gray-800 shadow-xs'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Nhập liên tục
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode('batch')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    entryMode === 'batch'
                      ? 'bg-white text-gray-800 shadow-xs'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Bảng nhiều dòng
                </button>
              </div>
            ) : (
              <h2 className="text-sm font-bold text-gray-800">
                Sửa giao dịch
              </h2>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Type Switcher (Chi tiêu vs Thu nhập) */}
        <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType(TransactionType.EXPENSE)}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                type === TransactionType.EXPENSE
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <TrendingDown size={13} /> Chi tiêu
            </button>
            <button
              type="button"
              onClick={() => setType(TransactionType.INCOME)}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                type === TransactionType.INCOME
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <TrendingUp size={13} /> Thu nhập
            </button>
          </div>

          {/* Quick Category Manager trigger */}
          <button
            type="button"
            onClick={onOpenCategoryManager}
            className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-sky-600 bg-white border border-gray-200 px-2.5 py-1 rounded-lg transition-colors"
          >
            <Settings size={12} />
            <span>Quản lý mục</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-4 flex-1 space-y-3.5 custom-scrollbar">

          {/* ================= MODE 1: SINGLE / CONTINUOUS ================= */}
          {entryMode === 'single' ? (
            <>
              {/* Amount Input Block */}
              <div className="bg-gray-50/60 p-3 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                    Số tiền
                  </label>
                  {currentParsedAmount !== null && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                      type === TransactionType.EXPENSE ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    }`}>
                      = {formatVND(currentParsedAmount)}
                    </span>
                  )}
                </div>

                <div className="relative flex items-center">
                  <input
                    ref={amountInputRef}
                    type="text"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveContinuous(false);
                      }
                    }}
                    placeholder="20k, 150.000, 50+20..."
                    className="w-full py-2 px-3 bg-white border border-gray-200 rounded-lg text-2xl font-bold text-gray-800 outline-none focus:border-sky-300 transition-colors placeholder-gray-300 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeypad(!showKeypad)}
                    className="absolute right-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Bàn phím tính toán"
                  >
                    <CalculatorIcon size={16} />
                  </button>
                </div>

                {/* Quick Add Chips */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {quickAmountChips.map(chip => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => handleChipClick(chip.value)}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 active:scale-95 transition-all"
                    >
                      {chip.label}
                    </button>
                  ))}
                  {amount && (
                    <button
                      type="button"
                      onClick={() => setAmount('')}
                      className="text-[11px] text-gray-400 hover:text-rose-500 ml-auto px-1 transition-colors"
                    >
                      Xóa
                    </button>
                  )}
                </div>

              </div>

              {/* Category Selector Block with Pinned on Top */}
              <div className="space-y-2">
                {pinnedList.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">
                      Đã ghim
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                      {pinnedList.map(cat => {
                        const isSelected = category === cat;
                        const { icon: CatIcon, colorClass } = getCategoryIconInfo(cat);
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setCategory(cat)}
                            className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all truncate ${
                              isSelected
                                ? 'bg-sky-50 border-sky-300 text-sky-800 shadow-xs ring-1 ring-sky-200'
                                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                            }`}
                          >
                            <CatIcon size={14} className={`${isSelected ? 'text-sky-600' : colorClass} shrink-0`} />
                            <span className="truncate">{cat}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">
                    {pinnedList.length > 0 ? 'Khác' : 'Danh mục'}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-[140px] overflow-y-auto custom-scrollbar p-1 border border-gray-200/80 rounded-xl bg-gray-50/40">
                    {otherList.map(cat => {
                      const isSelected = category === cat;
                      const { icon: CatIcon, colorClass } = getCategoryIconInfo(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(cat)}
                          className={`p-2 rounded-xl text-xs font-medium flex items-center gap-1.5 border transition-all truncate ${
                            isSelected
                              ? 'bg-sky-50 border-sky-300 text-sky-800 shadow-xs ring-1 ring-sky-200'
                              : 'bg-white border-gray-100 text-gray-600 hover:bg-gray-50 hover:border-gray-200'
                          }`}
                        >
                          <CatIcon size={14} className={`${isSelected ? 'text-sky-600' : colorClass} shrink-0`} />
                          <span className="truncate">{cat}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Compact Date, Wallet, and Note Row */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">
                    Ngày
                  </label>
                  <div className="relative flex items-center">
                    <CalendarDays size={13} className="absolute left-2.5 text-gray-400 pointer-events-none" />
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full pl-7 pr-2 py-1.5 bg-white border border-gray-200 rounded-lg font-medium text-gray-700 outline-none focus:border-sky-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">
                    Ví
                  </label>
                  <div className="relative flex items-center">
                    <WalletIcon size={13} className="absolute left-2.5 text-gray-400 pointer-events-none" />
                    <select
                      value={walletId}
                      onChange={(e) => setWalletId(e.target.value)}
                      className="w-full pl-7 pr-5 py-1.5 bg-white border border-gray-200 rounded-lg font-medium text-gray-700 outline-none focus:border-sky-300 truncate appearance-none cursor-pointer"
                    >
                      <option value="">Không chọn ví</option>
                      {state.wallets.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={11} className="absolute right-2 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">
                    Ghi chú
                  </label>
                  <div className="relative flex items-center">
                    <StickyNote size={13} className="absolute left-2.5 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Ghi chú thêm..."
                      value={desc}
                      onChange={(e) => setDesc(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveContinuous(false);
                        }
                      }}
                      className="w-full pl-7 pr-2 py-1.5 bg-white border border-gray-200 rounded-lg font-medium text-gray-700 outline-none focus:border-sky-300 placeholder-gray-300"
                    />
                  </div>
                </div>

                {!editingTransaction && (
                  <div className="col-span-2 pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-gray-600 select-none hover:text-gray-900">
                      <input
                        type="checkbox"
                        checked={saveAsRecurring}
                        onChange={(e) => setSaveAsRecurring(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-400 cursor-pointer"
                      />
                      <span>Lưu khoản này làm khoản cố định hàng tháng</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Action Buttons for Single/Continuous Mode */}
              <div className="pt-2 space-y-2">
                {!editingTransaction ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveContinuous(false)}
                      className="py-2 px-3 rounded-xl font-bold text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus size={14} />
                      <span>Thêm tiếp (Enter)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveContinuous(true)}
                      className="py-2 px-3 rounded-xl font-bold text-xs bg-gray-800 hover:bg-black text-white transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Check size={14} />
                      <span>Lưu & Đóng</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSaveContinuous(true)}
                    className="w-full py-2 rounded-xl font-bold text-xs bg-gray-800 hover:bg-black text-white transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Check size={14} />
                    <span>Cập nhật</span>
                  </button>
                )}

                {/* Session Summary */}
                {sessionAdded.length > 0 && !editingTransaction && (
                  <div className="p-2 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between text-xs text-gray-600">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-semibold text-gray-700">
                        Đã thêm {sessionAdded.length} khoản
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className="font-bold text-rose-600">
                        {formatVND(sessionAdded.reduce((s, i) => s + i.amount, 0))}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={onClose}
                      className="px-2.5 py-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-[11px] font-semibold transition-colors shrink-0"
                    >
                      Thoát
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ================= MODE 2: BATCH MULTI-ROW SHEET ================= */
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">Danh sách khoản chi</span>
                <button
                  type="button"
                  onClick={handleAddBatchRow}
                  className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 font-semibold text-xs flex items-center gap-1 transition-colors"
                >
                  <Plus size={13} />
                  <span>Thêm dòng</span>
                </button>
              </div>

              {/* Wallet and Date selection */}
              <div className="grid grid-cols-2 gap-2 p-2 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 block mb-0.5">Ngày</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 outline-none"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 block mb-0.5">Ví chung</span>
                  <select
                    value={walletId}
                    onChange={(e) => setWalletId(e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 outline-none truncate"
                  >
                    <option value="">Không chọn ví</option>
                    {state.wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Rows List */}
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                {batchRows.map((row, idx) => (
                  <div
                    key={row.id}
                    className="p-2 rounded-xl border border-gray-200 bg-white flex flex-col sm:flex-row gap-1.5 items-stretch sm:items-center text-xs"
                  >
                    <span className="text-[10px] font-bold text-gray-400 w-4 text-center shrink-0">
                      {idx + 1}
                    </span>

                    {/* Category */}
                    <div className="w-full sm:w-[130px] shrink-0">
                      <select
                        value={row.category || availableCategories[0]}
                        onChange={(e) => handleUpdateBatchRow(row.id, 'category', e.target.value)}
                        className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg font-medium text-gray-700 outline-none truncate"
                      >
                        {pinnedList.length > 0 && (
                          <optgroup label="Đã ghim">
                            {pinnedList.map(c => <option key={c} value={c}>{c}</option>)}
                          </optgroup>
                        )}
                        <optgroup label="Khác">
                          {otherList.map(c => <option key={c} value={c}>{c}</option>)}
                        </optgroup>
                      </select>
                    </div>

                    {/* Amount */}
                    <div className="w-full sm:w-[110px] shrink-0">
                      <input
                        type="text"
                        placeholder="Số tiền (20k...)"
                        value={row.amount}
                        onChange={(e) => handleUpdateBatchRow(row.id, 'amount', e.target.value)}
                        className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg font-bold text-gray-800 outline-none focus:bg-white"
                      />
                    </div>

                    {/* Description */}
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        placeholder="Ghi chú..."
                        value={row.description}
                        onChange={(e) => handleUpdateBatchRow(row.id, 'description', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddBatchRow();
                          }
                        }}
                        className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg font-medium text-gray-700 outline-none focus:bg-white"
                      />
                    </div>

                    {/* Delete row */}
                    <button
                      type="button"
                      onClick={() => handleRemoveBatchRow(row.id)}
                      disabled={batchRows.length <= 1}
                      className="p-1 text-gray-300 hover:text-rose-500 rounded-md disabled:opacity-20 shrink-0 self-end sm:self-center transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Batch Summary & Submit */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-400 font-medium block">Tổng cộng:</span>
                  <span className="text-sm font-bold text-gray-800">
                    {formatVND(batchTotalAmount)}
                  </span>
                  <span className="text-[10px] text-gray-400 ml-1">({batchValidCount} khoản)</span>
                </div>

                <button
                  type="button"
                  onClick={handleSaveAllBatch}
                  disabled={batchValidCount === 0}
                  className="px-4 py-2 rounded-xl font-bold text-xs bg-gray-800 hover:bg-black text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Lưu tất cả ({batchValidCount})
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionEntryModal;
