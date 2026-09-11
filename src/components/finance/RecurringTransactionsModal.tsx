import React, { useState, useEffect } from 'react';
import {
  X, Plus, Edit2, Trash2, Check, Pause, Play, Settings
} from 'lucide-react';
import { RecurringTransaction, Transaction, TransactionType, Wallet } from '../../types';
import { recurringTransactionService } from '../../services/recurringTransactionService';
import { Lang } from '../../i18n/i18n';

interface RecurringTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  wallets: Wallet[];
  expenseCategories: string[];
  incomeCategories: string[];
  pinnedCategories?: string[];
  transactions?: Transaction[];
  currentMonth: number; // 0-11
  currentYear: number;
  onApplyRecurringToMonth: (txList: Omit<Transaction, 'id'>[], recurringIds: string[]) => Promise<void>;
  onAddCategory?: (type: 'expense' | 'income', name: string) => void;
  onOpenCategoryManager?: () => void;
  lang: Lang;
}

const formatVND = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

export const RecurringTransactionsModal: React.FC<RecurringTransactionsModalProps> = ({
  isOpen,
  onClose,
  userId,
  wallets,
  expenseCategories,
  incomeCategories,
  pinnedCategories = [],
  transactions = [],
  currentMonth,
  currentYear,
  onApplyRecurringToMonth,
  onAddCategory,
  onOpenCategoryManager,
  lang
}) => {
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<'manage' | 'apply'>('apply');

  // Add / Edit Modal Sub-state
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<RecurringTransaction | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formType, setFormType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [formCategory, setFormCategory] = useState('');
  const [formWalletId, setFormWalletId] = useState('');
  const [formDayOfMonth, setFormDayOfMonth] = useState<number>(1);
  const [formDescription, setFormDescription] = useState('');
  const [formAutoApply, setFormAutoApply] = useState(true);

  // Inline category add state
  const [showInlineAddCat, setShowInlineAddCat] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');

  // Merge categories with any custom ones in transactions or transaction descriptions
  const mergedCategories = React.useMemo(() => {
    const defaultList = formType === TransactionType.EXPENSE ? expenseCategories : incomeCategories;

    // Categories in transactions
    const txCats = Array.from(new Set(
      transactions
        .filter(t => t.type === formType && t.category && t.category !== 'Điều chỉnh số dư')
        .map(t => t.category)
    ));

    // Short transaction descriptions that might have been used as an item name
    const txDescs = Array.from(new Set(
      transactions
        .filter(t =>
          t.type === formType &&
          t.description &&
          t.description.trim().length >= 2 &&
          t.description.trim().length <= 25 &&
          !t.description.startsWith('[Định kỳ]') &&
          !/^\d+$/.test(t.description.trim())
        )
        .map(t => t.description.trim())
    ));

    const extra = formCategory ? [formCategory] : [];
    const combined = [...defaultList, ...txCats, ...txDescs, ...extra];

    // Always guarantee 'Tiền mạng' for expenses
    if (formType === TransactionType.EXPENSE && !combined.some(c => c.toLowerCase() === 'tiền mạng')) {
      combined.push('Tiền mạng');
    }

    return Array.from(new Set(combined));
  }, [formType, expenseCategories, incomeCategories, transactions, formCategory]);

  const handleQuickAddCategory = () => {
    const clean = newCatInput.trim();
    if (!clean) return;
    if (onAddCategory) {
      onAddCategory(formType, clean);
    }
    setFormCategory(clean);
    setNewCatInput('');
    setShowInlineAddCat(false);
  };

  // Apply Checklist State for Current Month (e.g. '2026-09')
  const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const [selectedToApply, setSelectedToApply] = useState<Record<string, boolean>>({});
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [isApplying, setIsApplying] = useState(false);

  // Load items
  const loadItems = async () => {
    setIsLoading(true);
    const data = await recurringTransactionService.fetchRecurringTransactions(userId);
    setItems(data);
    setIsLoading(false);

    // Initialize checklist for active items
    const initialSelected: Record<string, boolean> = {};
    const initialAmounts: Record<string, string> = {};
    data.forEach(item => {
      // Default checked if active and NOT yet applied this month
      const isAlreadyApplied = item.last_applied_month === monthStr;
      initialSelected[item.id] = item.status === 'active' && !isAlreadyApplied;
      initialAmounts[item.id] = item.amount.toString();
    });
    setSelectedToApply(initialSelected);
    setCustomAmounts(initialAmounts);
  };

  useEffect(() => {
    if (isOpen) {
      loadItems();
    }
  }, [isOpen, userId, monthStr]);

  if (!isOpen) return null;

  // --- Handlers for CRUD ---
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormAmount('');
    setFormType(TransactionType.EXPENSE);
    setFormCategory(expenseCategories.includes('Tiền mạng') ? 'Tiền mạng' : (expenseCategories[0] || 'Điện nước'));
    setFormWalletId('');
    setFormDayOfMonth(1);
    setFormDescription('');
    setFormAutoApply(true);
    setShowInlineAddCat(false);
    setNewCatInput('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: RecurringTransaction) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormAmount(item.amount.toString());
    setFormType(item.type);
    setFormCategory(item.category);
    setFormWalletId(item.wallet_id || '');
    setFormDayOfMonth(item.day_of_month || 1);
    setFormDescription(item.description || '');
    setFormAutoApply(item.auto_apply);
    setIsFormOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(formAmount.replace(/[^0-9]/g, ''));
    if (!formTitle.trim() || !num || num <= 0) {
      alert('Vui lòng nhập tên khoản và số tiền hợp lệ!');
      return;
    }

    if (editingItem) {
      const updated: RecurringTransaction = {
        ...editingItem,
        title: formTitle.trim(),
        amount: num,
        type: formType,
        category: formCategory || (formType === TransactionType.EXPENSE ? expenseCategories[0] : incomeCategories[0]),
        wallet_id: formWalletId || null,
        day_of_month: formDayOfMonth || 1,
        description: formDescription.trim(),
        auto_apply: formAutoApply
      };
      await recurringTransactionService.updateRecurringTransaction(updated);
    } else {
      await recurringTransactionService.addRecurringTransaction(userId, {
        title: formTitle.trim(),
        amount: num,
        type: formType,
        category: formCategory || (formType === TransactionType.EXPENSE ? expenseCategories[0] : incomeCategories[0]),
        wallet_id: formWalletId || null,
        day_of_month: formDayOfMonth || 1,
        status: 'active',
        description: formDescription.trim(),
        auto_apply: formAutoApply,
        last_applied_month: null
      });
    }

    setIsFormOpen(false);
    await loadItems();
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa khoản cố định "${title}"?`)) return;
    await recurringTransactionService.deleteRecurringTransaction(id);
    await loadItems();
  };

  const handleToggleStatus = async (item: RecurringTransaction) => {
    const nextStatus = item.status === 'active' ? 'paused' : 'active';
    await recurringTransactionService.toggleStatus(item.id, nextStatus);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: nextStatus } : i));
    setSelectedToApply(prev => ({
      ...prev,
      [item.id]: nextStatus === 'active'
    }));
  };

  // --- Apply to Current Month ---
  const handleApplyToMonth = async () => {
    const itemsToApply = items.filter(i => selectedToApply[i.id]);
    if (itemsToApply.length === 0) {
      alert('Chưa chọn khoản nào để ghi nhận cho tháng này!');
      return;
    }

    setIsApplying(true);
    try {
      const newTransactions: Omit<Transaction, 'id'>[] = itemsToApply.map(item => {
        const customAmt = Number(customAmounts[item.id] || item.amount);
        const dayStr = String(Math.min(item.day_of_month || 1, 28)).padStart(2, '0');
        const txDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${dayStr}`;

        return {
          amount: customAmt > 0 ? customAmt : item.amount,
          category: item.category,
          date: txDate,
          type: item.type,
          description: `[Định kỳ] ${item.title}${item.description ? ` - ${item.description}` : ''}`,
          wallet_id: item.wallet_id || null
        };
      });

      const recurringIds = itemsToApply.map(i => i.id);

      await onApplyRecurringToMonth(newTransactions, recurringIds);
      await recurringTransactionService.markAsApplied(recurringIds, monthStr);

      setItems(prev => prev.map(i => recurringIds.includes(i.id) ? { ...i, last_applied_month: monthStr } : i));
      setSelectedToApply(prev => {
        const next = { ...prev };
        recurringIds.forEach(id => { next[id] = false; });
        return next;
      });

      alert(`Đã ghi nhận thành công ${itemsToApply.length} khoản cố định vào sổ chi tiêu Tháng ${currentMonth + 1}/${currentYear}!`);
    } catch (e: any) {
      console.error('Lỗi khi áp dụng khoản định kỳ:', e);
      alert('Có lỗi xảy ra khi ghi nhận khoản định kỳ. Vui lòng thử lại.');
    } finally {
      setIsApplying(false);
    }
  };

  const activeItemsCount = items.filter(i => i.status === 'active').length;
  const appliedThisMonthCount = items.filter(i => i.last_applied_month === monthStr).length;

  const renderEmptyOrSuggestions = () => {
    return (
      <div className="p-8 text-center rounded-2xl border border-dashed border-gray-200 text-xs text-gray-500 space-y-3 bg-gray-50/40">
        <p className="font-semibold text-gray-700">Bạn chưa có khoản cố định nào trong danh sách.</p>
        <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
          Tạo các khoản cố định mỗi tháng như tiền mạng, tiền nhà, điện nước, tài khoản AI... để SmartLife tự động ghi nhận vào Sổ Chi Tiêu của bạn.
        </p>S
        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1.5"
        >
          <Plus size={14} />
          <span> Tạo khoản cố định</span>
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[65] flex items-center justify-center p-3 md:p-6 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200">

        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-gray-800">Khoản tiền cố định hàng tháng</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav Tabs */}
        <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="bg-gray-100 p-0.5 rounded-lg flex text-xs">
            <button
              type="button"
              onClick={() => setActiveView('apply')}
              className={`py-1 px-3 rounded-md font-semibold transition-all ${activeView === 'apply'
                  ? 'bg-white text-gray-800 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <span>Áp dụng T{currentMonth + 1}</span>
              {appliedThisMonthCount > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                  {appliedThisMonthCount} đã ghi
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveView('manage')}
              className={`py-1 px-3 rounded-md font-semibold transition-all ${activeView === 'manage'
                  ? 'bg-white text-gray-800 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <span>Danh sách ({items.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-2.5 py-1 bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shrink-0"
          >
            <Plus size={14} />
            <span>Thêm khoản</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-4 flex-1 space-y-3 custom-scrollbar">

          {/* ================= VIEW 1: APPLY CHECKLIST FOR MONTH ================= */}
          {activeView === 'apply' ? (
            <div className="space-y-3">
              {isLoading ? (
                <div className="p-8 text-center text-xs text-gray-400">Đang tải dữ liệu...</div>
              ) : items.length === 0 ? (
                renderEmptyOrSuggestions()
              ) : (
                <div className="space-y-2">
                  {items.map(item => {
                    const isApplied = item.last_applied_month === monthStr;
                    const isChecked = !!selectedToApply[item.id];
                    const isPaused = item.status === 'paused';

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-2xl border transition-all flex items-center gap-3 ${isApplied
                            ? 'bg-emerald-50/40 border-emerald-200/80 opacity-80'
                            : isPaused
                              ? 'bg-gray-50 border-gray-200 opacity-60'
                              : isChecked
                                ? 'bg-white border-sky-300 shadow-xs'
                                : 'bg-white border-gray-200'
                          }`}
                      >
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          disabled={isApplied || isPaused}
                          checked={isChecked}
                          onChange={(e) => setSelectedToApply(prev => ({ ...prev, [item.id]: e.target.checked }))}
                          className="w-4 h-4 rounded text-sky-600 focus:ring-sky-400 cursor-pointer disabled:opacity-40 shrink-0"
                        />

                        {/* Title & Category Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black text-gray-800 truncate">
                              {item.title}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-gray-100 text-gray-600 font-bold truncate">
                              {item.category}
                            </span>
                            {isPaused && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-700 font-extrabold">
                                Đang tạm dừng
                              </span>
                            )}
                            {isApplied && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-700 font-extrabold flex items-center gap-0.5">
                                <Check size={10} /> Đã ghi sổ
                              </span>
                            )}
                          </div>

                          <span className="text-[10px] text-gray-400 block mt-0.5">
                            Ngày {item.day_of_month} hàng tháng • {item.type === TransactionType.EXPENSE ? 'Chi tiêu' : 'Thu nhập'}
                          </span>
                        </div>

                        {/* Editable Amount for this month */}
                        <div className="w-28 shrink-0 text-right">
                          {!isApplied ? (
                            <input
                              type="number"
                              disabled={!isChecked}
                              value={customAmounts[item.id] || item.amount}
                              onChange={(e) => setCustomAmounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                              className={`w-full text-right px-2 py-1 bg-gray-50 border rounded-xl text-xs font-black outline-none ${item.type === TransactionType.EXPENSE ? 'text-rose-600' : 'text-emerald-600'
                                } focus:bg-white focus:border-sky-400`}
                            />
                          ) : (
                            <span className={`text-xs font-black ${item.type === TransactionType.EXPENSE ? 'text-rose-600' : 'text-emerald-600'
                              }`}>
                              {formatVND(item.amount)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Apply Action CTA */}
              {items.length > 0 && (
                <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Đã chọn ghi sổ</span>
                    <span className="text-xs font-bold text-gray-800">
                      {items.filter(i => selectedToApply[i.id]).length} khoản
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyToMonth}
                    disabled={isApplying || items.filter(i => selectedToApply[i.id]).length === 0}
                    className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <Check size={15} />
                    <span>Ghi nhận vào sổ Tháng {currentMonth + 1}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ================= VIEW 2: FULL MANAGEMENT LIST ================= */
            <div className="space-y-2">
              {isLoading ? (
                <div className="p-8 text-center text-xs text-gray-400">Đang tải dữ liệu...</div>
              ) : items.length === 0 ? (
                renderEmptyOrSuggestions()
              ) : (
                <>
                  {items.map(item => {
                    const isPaused = item.status === 'paused';

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border transition-colors flex items-center justify-between gap-3 ${isPaused ? 'bg-gray-50/70 border-gray-200 opacity-70' : 'bg-white border-gray-200'
                          }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs md:text-sm font-bold text-gray-800 truncate">
                              {item.title}
                            </h4>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${item.type === TransactionType.EXPENSE
                                ? 'bg-rose-50 text-rose-600 border border-rose-100'
                                : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                              }`}>
                              {item.type === TransactionType.EXPENSE ? 'Chi tiêu' : 'Thu nhập'}
                            </span>
                          </div>

                          <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-600">{formatVND(item.amount)}</span>
                            <span>•</span>
                            <span>{item.category}</span>
                            <span>•</span>
                            <span>Ngày {item.day_of_month} hàng tháng</span>
                          </div>
                        </div>

                        {/* Actions: Pause, Edit, Delete */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Toggle Pause / Active */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(item)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 ${isPaused
                                ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                              }`}
                          >
                            {isPaused ? <Play size={11} /> : <Pause size={11} />}
                            <span className="hidden sm:inline">{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Edit2 size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(item.id, item.title)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Xóa"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>

        {/* Submodal Form: Add / Edit Recurring Item */}
        {isFormOpen && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md p-4">
              <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 mb-3">
                <h3 className="text-sm font-bold text-gray-800">
                  {editingItem ? 'Sửa khoản cố định' : 'Thêm khoản cố định mới'}
                </h3>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100 flex items-center justify-center transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleSaveForm} className="space-y-3 text-xs">
                {/* Type Switcher */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormType(TransactionType.EXPENSE);
                      setFormCategory(expenseCategories[0] || 'Hóa đơn');
                    }}
                    className={`py-1.5 rounded-lg font-bold transition-colors ${formType === TransactionType.EXPENSE
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                      }`}
                  >
                    Chi tiêu
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormType(TransactionType.INCOME);
                      setFormCategory(incomeCategories[0] || 'Lương');
                    }}
                    className={`py-1.5 rounded-lg font-bold transition-colors ${formType === TransactionType.INCOME
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                      }`}
                  >
                    Thu nhập
                  </button>
                </div>

                {/* Title */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Tên khoản cố định</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Tiền mạng FPT, Tài khoản AI, Gửi xe..."
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-medium text-gray-800 outline-none focus:bg-white focus:border-sky-300"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Số tiền (VNĐ)</label>
                  <input
                    type="number"
                    required
                    placeholder="VD: 160000"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-bold text-gray-800 text-base outline-none focus:bg-white focus:border-sky-300"
                  />
                </div>

                {/* Category & Day of Month */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                      Danh mục
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowInlineAddCat(!showInlineAddCat)}
                        className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 transition-colors flex items-center gap-0.5"
                      >
                        <Plus size={11} />
                        <span>{showInlineAddCat ? 'Đóng' : 'Thêm mục mới'}</span>
                      </button>
                      {onOpenCategoryManager && (
                        <button
                          type="button"
                          onClick={onOpenCategoryManager}
                          className="text-[11px] text-gray-400 hover:text-gray-600 font-medium transition-colors"
                          title="Quản lý toàn bộ danh mục"
                        >
                          Quản lý
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline Add Category input */}
                  {showInlineAddCat && (
                    <div className="p-2 bg-sky-50/50 border border-sky-200 rounded-xl space-y-1.5">
                      <div className="text-[10px] font-semibold text-sky-800">
                        Thêm danh mục {formType === TransactionType.EXPENSE ? 'chi tiêu' : 'thu nhập'} mới:
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="VD: Tiền mạng, Tiền gửi xe, Tài khoản AI..."
                          value={newCatInput}
                          onChange={(e) => setNewCatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleQuickAddCategory();
                            }
                          }}
                          className="flex-1 px-2.5 py-1 text-xs bg-white border border-sky-200 rounded-lg font-medium text-gray-800 outline-none focus:border-sky-400"
                        />
                        <button
                          type="button"
                          onClick={handleQuickAddCategory}
                          className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors"
                        >
                          Thêm
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-medium text-gray-700 outline-none focus:bg-white focus:border-sky-300"
                      >
                        {mergedCategories.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={formDayOfMonth}
                          onChange={(e) => setFormDayOfMonth(Number(e.target.value))}
                          placeholder="Ngày trong tháng"
                          className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-medium text-gray-800 outline-none focus:bg-white focus:border-sky-300"
                        />
                        <span className="absolute right-2.5 text-[10px] text-gray-400 pointer-events-none">
                          Hàng tháng
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Pick Category Chips */}
                  {mergedCategories.length > 0 && (
                    <div>
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto custom-scrollbar pt-0.5">
                        {mergedCategories.slice(0, 12).map(cat => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setFormCategory(cat)}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors ${formCategory === cat
                                ? 'bg-sky-50 border-sky-300 text-sky-800 font-bold'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Wallet */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Ví thanh toán mặc định</label>
                  <select
                    value={formWalletId}
                    onChange={(e) => setFormWalletId(e.target.value)}
                    className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-medium text-gray-700 outline-none"
                  >
                    <option value="">Không liên kết ví</option>
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({formatVND(w.balance)})</option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-semibold transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-gray-800 hover:bg-black text-white rounded-lg font-semibold transition-colors"
                  >
                    Lưu
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecurringTransactionsModal;
