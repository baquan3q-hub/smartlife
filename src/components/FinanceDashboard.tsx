import React, { useMemo, useState, useEffect } from 'react';
import { AppState, TransactionType, Transaction, Goal, BudgetConfig } from '../types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Plus, X, CalendarDays, Edit2, Trash2, List, LayoutDashboard, Wallet, StickyNote, Calculator as CalculatorIcon, Sparkles, Bot, Filter, ChevronDown, Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../constants';
import Calculator from './Calculator';
import { analyzeFinance } from '../services/aiService';
import FinanceAI from './FinanceAI';




interface FinanceDashboardProps {
    state: AppState;
    onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
    onUpdateTransaction: (t: Transaction) => void;
    onDeleteTransaction: (id: string) => void;
    onAddGoal: (g: any) => void;
    onUpdateGoal: (g: any) => void;
    onDeleteGoal: (id: string) => void;
    isLoading?: boolean;
    lang: 'vi' | 'en';
    expenseCategories: string[];
    incomeCategories: string[];
    onAddCategory: (type: 'expense' | 'income', name: string) => void;
    onDeleteCategory: (type: 'expense' | 'income', name: string) => void;
    onAddBudget: (budget: Omit<BudgetConfig, 'id'>) => void;
    onUpdateBudget: (budget: BudgetConfig) => void;
    onDeleteBudget: (id: string) => void;
}

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#3B82F6', '#14B8A6', '#F97316', '#64748B'];

const translations = {
    vi: {
        financeOverview: 'Tổng quan Tài chính',
        income: 'Thu nhập',
        expense: 'Chi tiêu',
        balance: 'Số dư hiện tại',
        addTransaction: 'Thêm giao dịch',
        analysis: 'Phân tích',
        recentTransactions: 'Giao dịch gần đây',
        noTransactions: 'Chưa có giao dịch nào.',
        goals: 'Mục tiêu Tài chính',
        addGoal: 'Thêm mục tiêu',
        savings: 'Tiết kiệm',
        date: 'Ngày',
        category: 'Danh mục',
        amount: 'Số tiền',
        description: 'Mô tả',
        actions: 'Hành động',
        edit: 'Sửa',
        delete: 'Xóa',
        save: 'Lưu',
        cancel: 'Hủy',
        income_salary: 'Lương',
        income_bonus: 'Thưởng',
        income_other: 'Khác',
        expense_food: 'Ăn uống',
        expense_transport: 'Di chuyển',
        expense_shopping: 'Mua sắm',
        expense_bills: 'Hóa đơn',
        expense_entertainment: 'Giải trí',
        expense_health: 'Sức khỏe',
        expense_education: 'Giáo dục',
        expense_other: 'Khác',
        month: 'Tháng',
        year: 'Năm'
    },
    en: {
        financeOverview: 'Finance Overview',
        income: 'Income',
        expense: 'Expense',
        balance: 'Current Balance',
        addTransaction: 'Add Transaction',
        analysis: 'Analysis',
        recentTransactions: 'Recent Transactions',
        noTransactions: 'No transactions yet.',
        goals: 'Financial Goals',
        addGoal: 'Add Goal',
        savings: 'Savings',
        date: 'Date',
        category: 'Category',
        amount: 'Amount',
        description: 'Description',
        actions: 'Actions',
        edit: 'Edit',
        delete: 'Delete',
        save: 'Save',
        cancel: 'Cancel',
        income_salary: 'Salary',
        income_bonus: 'Bonus',
        income_other: 'Other',
        expense_food: 'Food',
        expense_transport: 'Transport',
        expense_shopping: 'Shopping',
        expense_bills: 'Bills',
        expense_entertainment: 'Entertainment',
        expense_health: 'Health',
        expense_education: 'Education',
        expense_other: 'Other',
        month: 'Month',
        year: 'Year'
    }
};

const formatCurrency = (amount: number, lang: 'vi' | 'en') => {
    return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', { style: 'currency', currency: lang === 'vi' ? 'VND' : 'USD' }).format(lang === 'vi' ? amount : amount / 25000);
};

// --- Helper for Calendar ---
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay(); // 0 = Sunday

const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ state, onAddTransaction, onUpdateTransaction, onDeleteTransaction, onAddGoal, onUpdateGoal, onDeleteGoal, isLoading, lang, expenseCategories, incomeCategories, onAddCategory, onDeleteCategory, onAddBudget, onUpdateBudget, onDeleteBudget }) => {
    const t = translations[lang];
    const { transactions } = state;

    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'overview' | 'calendar' | 'history'>('overview');

    // Edit State
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

    // Goal Form State (Visual only)
    const [goalTarget, setGoalTarget] = useState('');
    const [goalCurrent, setGoalCurrent] = useState('');

    // Deposit Modal State
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
    const [selectedGoalForDeposit, setSelectedGoalForDeposit] = useState<Goal | null>(null);
    const [depositAmount, setDepositAmount] = useState('');

    // Calendar Detail State
    const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

    // Budget Modal State
    const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
    const [selectedBudgetCategory, setSelectedBudgetCategory] = useState(expenseCategories[0]);
    const [budgetLimit, setBudgetLimit] = useState('');
    const [editingBudget, setEditingBudget] = useState<BudgetConfig | null>(null);
    const [selectedBudgetForDetails, setSelectedBudgetForDetails] = useState<BudgetConfig | null>(null);
    const [detailViewMonth, setDetailViewMonth] = useState<string | null>(null);

    // Filter State (Month)
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());

    // Form State
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
    const [category, setCategory] = useState(expenseCategories[0]);

    // Custom Category State
    const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [desc, setDesc] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        // Reset category when modal opens or type changes
        if (isModalOpen && !editingTransaction) {
            setCategory((type === TransactionType.INCOME ? incomeCategories : expenseCategories)[0]);
            setIsAddingNewCategory(false);
            setNewCategoryName('');
        }
    }, [isModalOpen, type, editingTransaction, expenseCategories, incomeCategories]);

    // History Filter State
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
    const [activeStatsCard, setActiveStatsCard] = useState<'income' | 'expense' | null>(null);

    // --- Derived State ---
    const [showFilterMenu, setShowFilterMenu] = useState(false);

    // Balance Form State
    const [newBalance, setNewBalance] = useState('');
    const [showCalculator, setShowCalculator] = useState(false);

    // AI State
    const [aiInsight, setAiInsight] = useState<{ insight: string; actions: string[] } | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);


    const stats = useMemo(() => {
        const totalIncome = transactions.reduce((acc, t) => t.type === TransactionType.INCOME ? acc + t.amount : acc, 0);
        const totalExpense = transactions.reduce((acc, t) => t.type === TransactionType.EXPENSE ? acc + t.amount : acc, 0);
        const currentBalance = totalIncome - totalExpense;

        const monthlyDataMap: Record<string, { income: number, expense: number }> = {};
        transactions.forEach(t => {
            if (t.category === 'Điều chỉnh số dư') return; // Exclude balance adjustments from monthly stats
            const d = new Date(t.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyDataMap[key]) monthlyDataMap[key] = { income: 0, expense: 0 };
            if (t.type === TransactionType.INCOME) monthlyDataMap[key].income += t.amount;
            else monthlyDataMap[key].expense += t.amount;
        });

        const monthlyChartData = Object.keys(monthlyDataMap).sort().map(key => ({
            name: `Tháng ${key.split('-')[1]}`,
            ...monthlyDataMap[key]
        })).slice(-6);

        const currentMonthTransactions = transactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        });

        const currentMonthIncome = currentMonthTransactions
            .filter(t => t.type === TransactionType.INCOME && t.category !== 'Điều chỉnh số dư')
            .reduce((acc, t) => acc + t.amount, 0);
        const currentMonthExpense = currentMonthTransactions
            .filter(t => t.type === TransactionType.EXPENSE && t.category !== 'Điều chỉnh số dư')
            .reduce((acc, t) => acc + t.amount, 0);

        const categoryMap: Record<string, number> = {};
        currentMonthTransactions
            .filter(t => t.type === TransactionType.EXPENSE && t.category !== 'Điều chỉnh số dư')
            .forEach(t => {
                categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
            });

        const categoryData = Object.keys(categoryMap).map(key => ({
            name: key,
            value: categoryMap[key],
            percent: currentMonthExpense > 0 ? (categoryMap[key] / currentMonthExpense) * 100 : 0
        })).sort((a, b) => b.value - a.value);

        return {
            totalBalance: currentBalance,
            monthlyChartData,
            categoryData,
            currentMonthIncome,
            currentMonthExpense,
            currentMonthTransactions
        };
    }, [transactions, selectedMonth, selectedYear]);

    const financeContext = useMemo(() => {
        // Prepare ALL Data for AI (We send ALL history for "Expert" analysis)
        const allTx = transactions
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Newest first
            .map(t => ({
                d: t.date,
                c: t.category,
                a: t.amount,
                t: t.type === TransactionType.INCOME ? 'Thu' : 'Chi',
                n: t.description
            }));

        return JSON.stringify({
            summary: {
                balance: stats.totalBalance,
                this_month_income: stats.currentMonthIncome,
                this_month_expense: stats.currentMonthExpense
            },
            recent_transactions: allTx // AI instructions expect this key
        });


    }, [stats, transactions, state.goals, state.timetable, selectedMonth, selectedYear]);


    // --- Handlers ---
    const openEditModal = (t: Transaction) => {
        setEditingTransaction(t);
        setAmount(t.amount.toString());
        setType(t.type);
        setCategory(t.category);
        setDesc(t.description);
        setDate(t.date);
        setIsModalOpen(true);
    };

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount) return;

        let finalCategory = category;

        // Handle Custom Category Creation
        if (isAddingNewCategory) {
            if (!newCategoryName.trim()) {
                alert("Vui lòng nhập tên danh mục mới!");
                return;
            }
            onAddCategory(type === TransactionType.INCOME ? 'income' : 'expense', newCategoryName.trim());
            finalCategory = newCategoryName.trim();
        }

        if (editingTransaction) {
            // Mode: Update
            onUpdateTransaction({
                ...editingTransaction,
                amount: Number(amount),
                category: finalCategory,
                date: date,
                type: type,
                description: desc
            });
        } else {
            // Mode: Create
            onAddTransaction({
                amount: Number(amount),
                category: finalCategory,
                date: date,
                type: type,
                description: desc || (type === TransactionType.INCOME ? 'Thu nhập' : 'Chi tiêu')
            });
        }

        setIsModalOpen(false);
        setEditingTransaction(null);
        setAmount('');
        setDesc('');
        setIsAddingNewCategory(false);
        setNewCategoryName('');
    };

    const handleUpdateBalance = (e: React.FormEvent) => {
        e.preventDefault();
        const targetBalance = Number(newBalance);
        const current = stats.totalBalance;
        const diff = targetBalance - current;

        if (diff === 0) {
            setIsBalanceModalOpen(false);
            return;
        }

        onAddTransaction({
            amount: Math.abs(diff),
            category: 'Điều chỉnh số dư',
            date: new Date().toISOString().split('T')[0],
            type: diff > 0 ? TransactionType.INCOME : TransactionType.EXPENSE,
            description: 'Cập nhật số dư thủ công'
        });

        setIsBalanceModalOpen(false);
        setNewBalance('');
    };




    const changeMonth = (delta: number) => {
        let m = selectedMonth + delta;
        let y = selectedYear;
        if (m > 11) { m = 0; y++; }
        if (m < 0) { m = 11; y--; }
        setSelectedMonth(m);
        setSelectedYear(y);
        setSelectedCalendarDate(null); // Reset selection on month change
    };

    const handleGoalSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const target = Number(fd.get('target_amount'));
        const current = Number(fd.get('current_amount'));

        const data = {
            title: fd.get('title'),
            target_amount: target,
            current_amount: current,
            deadline: fd.get('deadline'),
            type: 'FINANCIAL', // Default type for Finance Dashboard
            progress: Math.round((current / (target || 1)) * 100)
        };

        if (editingGoal) {
            onUpdateGoal({ ...editingGoal, ...data });
        } else {
            onAddGoal(data);
        }
        setIsGoalModalOpen(false);
        setEditingGoal(null);
        setGoalTarget('');
        setGoalCurrent('');
    };

    const handleDepositSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGoalForDeposit || !depositAmount) return;

        const amount = Number(depositAmount);
        if (isNaN(amount) || amount <= 0) {
            alert("Vui lòng nhập số tiền hợp lệ");
            return;
        }

        const newCurrent = (selectedGoalForDeposit.current_amount || 0) + amount;
        const newProgress = Math.round((newCurrent / (selectedGoalForDeposit.target_amount || 1)) * 100);

        onUpdateGoal({
            ...selectedGoalForDeposit,
            current_amount: newCurrent,
            progress: newProgress
        });

        setIsDepositModalOpen(false);
        setDepositAmount('');
        setSelectedGoalForDeposit(null);
    };

    const handleAnalyzeFinance = async () => {
        setIsAnalyzing(true);
        const result = await analyzeFinance(transactions);
        setAiInsight(result);
        setIsAnalyzing(false);
    };

    // --- Budget Handlers ---
    const handleBudgetSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const limit = Number(budgetLimit);
        if (!limit || limit <= 0) {
            alert("Vui lòng nhập ngân sách hợp lệ!");
            return;
        }

        const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

        if (editingBudget) {
            onUpdateBudget({ ...editingBudget, amount: limit });
        } else {
            // Check if already exists?
            // Ideally we check before submitting or upsert. Setup for now is basic insert.
            onAddBudget({
                category: selectedBudgetCategory,
                amount: limit,
                month: monthStr
            });
        }
        setIsBudgetModalOpen(false);
        setBudgetLimit('');
        setEditingBudget(null);
    };

    const getBudgetProgress = (category: string) => {
        const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
        // Find budget for this category and month
        const budget = state.budgets?.find(b => b.category === category && b.month === monthStr);
        if (!budget) return null;

        const spent = stats.currentMonthTransactions
            .filter(t => t.type === TransactionType.EXPENSE && t.category === category)
            .reduce((acc, t) => acc + t.amount, 0);

        return {
            budget,
            spent,
            percent: Math.min((spent / budget.amount) * 100, 100),
            isOver: spent > budget.amount
        };
    };

    // --- Render Components ---

    const renderBudgets = () => {
        return (
            <div className="relative mb-6 rounded-2xl p-[2px] overflow-hidden group shadow-lg animate-fade-in">
                {/* Gold Running Border Effect */}
                <div className="absolute inset-[-200%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2E8F0_0%,#FFD700_25%,#FDB931_50%,#FFD700_75%,#E2E8F0_100%)]"></div>

                <div className="relative bg-white rounded-2xl p-6 h-full">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Ngân sách Tháng {selectedMonth + 1}</h3>
                        <button
                            onClick={() => {
                                setEditingBudget(null);
                                setBudgetLimit('');
                                // Default to first category if possible, or reset
                                setSelectedBudgetCategory(expenseCategories[0]);
                                setIsBudgetModalOpen(true);
                            }}
                            className="text-sm text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg font-semibold hover:bg-indigo-100 transition-colors"
                        >
                            + Thiết lập
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {state.budgets
                            ?.filter(b => b.month === `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`)
                            .map(budget => {
                                const progress = getBudgetProgress(budget.category);
                                if (!progress) return null;
                                const { spent, percent, isOver } = progress;

                                return (
                                    <div
                                        key={budget.id}
                                        onClick={() => {
                                            setSelectedBudgetForDetails(budget);
                                            setDetailViewMonth(`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`);
                                        }}
                                        className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-lg hover:border-indigo-100 transition-all cursor-pointer group relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-indigo-50 to-transparent rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>

                                        <div className="flex justify-between items-center mb-3 relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                    <Wallet size={20} />
                                                </div>
                                                <div>
                                                    <span className="font-bold text-gray-800 text-sm md:text-base block">{budget.category}</span>
                                                    {isOver && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold inline-block">Vượt ngân sách</span>}
                                                </div>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                                <button onClick={() => { setEditingBudget(budget); setBudgetLimit(budget.amount.toString()); setSelectedBudgetCategory(budget.category); setIsBudgetModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 size={16} /></button>
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm("Bạn có chắc chắn muốn xóa ngân sách này?")) {
                                                            onDeleteBudget(budget.id);
                                                        }
                                                    }}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex justify-between text-xs font-medium text-gray-500 mb-2">
                                            <span>Đã chi: <span className={isOver ? 'text-red-600 font-bold' : 'text-gray-900 font-bold'}>{formatCurrency(spent, lang)}</span></span>
                                            <span className="text-gray-400">/ {formatCurrency(budget.amount, lang)}</span>
                                        </div>

                                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden shadow-inner">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ease-out shadow-sm ${isOver ? 'bg-gradient-to-r from-red-500 to-rose-600' : percent > 80 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 'bg-gradient-to-r from-emerald-400 to-teal-500'}`}
                                                style={{ width: `${Math.min(percent, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}

                        {(!state.budgets || state.budgets.filter(b => b.month === `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`).length === 0) && (
                            <div className="col-span-1 md:col-span-2 text-center py-6 border-2 border-dashed border-gray-100 rounded-xl">
                                <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-2 text-indigo-400">
                                    <DollarSign size={20} />
                                </div>
                                <p className="text-gray-400 text-sm">Chưa thiết lập ngân sách</p>
                                <button onClick={() => setIsBudgetModalOpen(true)} className="mt-2 text-indigo-600 text-xs font-bold hover:underline">Thêm ngay</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderCalendar = () => {
        const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
        const firstDay = getFirstDayOfMonth(selectedYear, selectedMonth);
        const days = [];

        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-20 md:h-32 bg-gray-50/50 border border-gray-100"></div>);
        }

        // Prepare date string for filtering
        const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

        for (let day = 1; day <= daysInMonth; day++) {
            const dayString = `${monthPrefix}-${String(day).padStart(2, '0')}`;
            const dayTx = transactions.filter(t => t.date === dayString);
            const dayIncome = dayTx.filter(t => t.type === TransactionType.INCOME).reduce((a, b) => a + b.amount, 0);
            const dayExpense = dayTx.filter(t => t.type === TransactionType.EXPENSE).reduce((a, b) => a + b.amount, 0);

            const isSelected = selectedCalendarDate === dayString;
            const isToday = dayString === new Date().toISOString().split('T')[0];

            days.push(
                <div
                    key={day}
                    onClick={() => setSelectedCalendarDate(dayString)}
                    className={`h-20 md:h-32 border p-1 md:p-2 cursor-pointer transition-all relative group overflow-hidden
                    ${isSelected ? 'border-2 border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-white hover:bg-gray-50'}
                `}
                >
                    <div className={`text-xs md:text-sm font-semibold mb-1 ${isToday ? 'bg-indigo-600 text-white w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center' : 'text-gray-700'} ml-1 mt-1`}>
                        {day}
                    </div>
                    <div className="space-y-0.5 px-0.5">
                        {dayIncome > 0 && <div className="text-[9px] md:text-[10px] bg-green-100/80 text-green-700 px-1 rounded truncate leading-tight tracking-tighter">+{formatCurrency(dayIncome, lang)}</div>}
                        {dayExpense > 0 && <div className="text-[9px] md:text-[10px] bg-red-100/80 text-red-700 px-1 rounded truncate leading-tight tracking-tighter">-{formatCurrency(dayExpense, lang)}</div>}
                    </div>
                </div>
            );
        }


        // Selected Date Details
        const selectedDayTransactions = selectedCalendarDate
            ? transactions.filter(t => t.date === selectedCalendarDate)
            : [];

        return (
            <div className="space-y-6">
                {/* Calendar Grid */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-gray-700">Lịch sử {selectedMonth + 1}/{selectedYear}</h3>
                        <div className="flex gap-2">
                            <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-200 rounded">{'<'}</button>
                            <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-200 rounded">{'>'}</button>
                        </div>
                    </div>
                    <div className="overflow-x-auto custom-scrollbar pb-2">
                        <div className="min-w-[700px]">
                            <div className="grid grid-cols-7 text-center bg-gray-100 py-2 text-xs font-semibold text-gray-500">
                                <div>CN</div><div>T2</div><div>T3</div><div>T4</div><div>T5</div><div>T6</div><div>T7</div>
                            </div>
                            <div className="grid grid-cols-7">
                                {days}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Selected Date Details Table */}
                {selectedCalendarDate && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-slide-up">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800">
                                Chi tiết ngày {selectedCalendarDate.split('-').reverse().join('/')}
                            </h3>
                            <div className="flex gap-2">
                                <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg">
                                    Thu: {formatCurrency(selectedDayTransactions.filter(t => t.type === TransactionType.INCOME).reduce((a, b) => a + b.amount, 0), lang)}
                                </span>
                                <span className="text-sm font-medium text-red-600 bg-red-50 px-3 py-1 rounded-lg">
                                    Chi: {formatCurrency(selectedDayTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((a, b) => a + b.amount, 0), lang)}
                                </span>
                            </div>
                        </div>
                        {selectedDayTransactions.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                        <tr>
                                            <th className="px-4 py-3">Danh mục</th>
                                            <th className="px-4 py-3">Mô tả (Ghi chú)</th>
                                            <th className="px-4 py-3 text-right">Số tiền</th>
                                            <th className="px-4 py-3 text-center">Hành động</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {selectedDayTransactions.map(t => (
                                            <tr key={t.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${t.type === TransactionType.INCOME ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                                        {t.category}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700 flex items-center gap-2">
                                                    {t.description && <StickyNote size={14} className="text-gray-400" />}
                                                    {t.description || <i className="text-gray-400">Không có ghi chú</i>}
                                                </td>
                                                <td className={`px-4 py-3 text-right font-bold text-sm ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-gray-900'}`}>
                                                    {t.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(t.amount, lang)}
                                                </td>
                                                <td className="px-4 py-3 text-center flex justify-center gap-2">
                                                    <button onClick={() => openEditModal(t)} className="p-1.5 text-gray-400 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 rounded-lg transition-colors" title="Sửa">
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button onClick={() => onDeleteTransaction(t.id)} className="p-1.5 text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg transition-colors" title="Xóa">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-center text-gray-400 py-4">Không có giao dịch nào trong ngày này.</p>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderHistory = () => {
        // Filter transactions for history view
        const filteredTransactions = transactions.filter(t => {
            // Filter by Month/Year (reuse selectedMonth/Year from global state or allow independent?) 
            // User requested "Lịch sử chi tiêu" inside "Chi tiết", likely wants to see everything or filter specifically.
            // Let's use the global selectedMonth/Year for consistency with the rest of the dashboard,
            // BUT allow "All Time" or specific filtering if needed. 
            // For now, let's stick to the Global Month Filter for date, and add Category Filter.

            const d = new Date(t.date);
            const matchMonth = d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;

            // However, user might want to see ALL history. 
            // Let's add a toggle or just use the separate filter state if we want robust filtering.
            // Simplified: Use the global month filter for now, as that's the dashboard's context. 
            // If user wants "All", they might expect a separate page, but here we are in a dashboard view.

            // UPDATE: Making it strictly based on the requested "Phễu để lọc".
            // Let's filter by the Global Month FIRST, then apply Category.

            const matchCategory = selectedCategoryFilter === 'all' || t.category === selectedCategoryFilter;



            return matchMonth && matchCategory;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const totalFilteredIncome = filteredTransactions.filter(t => t.type === TransactionType.INCOME && t.category !== 'Điều chỉnh số dư').reduce((a, b) => a + b.amount, 0);
        const totalFilteredExpense = filteredTransactions.filter(t => t.type === TransactionType.EXPENSE && t.category !== 'Điều chỉnh số dư').reduce((a, b) => a + b.amount, 0);

        return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in">
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h3 className="font-bold text-lg text-gray-800">Chi tiết Giao dịch (Tháng {selectedMonth + 1}/{selectedYear})</h3>
                        <div className="flex gap-3 mt-1 text-sm">
                            <span className="text-emerald-600 font-medium">Thu: {formatCurrency(totalFilteredIncome, lang)}</span>
                            <span className="text-gray-300">|</span>
                            <span className="text-red-500 font-medium">Chi: {formatCurrency(totalFilteredExpense, lang)}</span>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-2 relative">
                        <div className="relative">
                            <button
                                onClick={() => setShowFilterMenu(!showFilterMenu)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${selectedCategoryFilter !== 'all' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                            >
                                <Filter size={16} />
                                <span>
                                    {selectedCategoryFilter === 'all' ? 'Tất cả danh mục' : selectedCategoryFilter}
                                </span>
                                <ChevronDown size={14} />
                            </button>

                            {showFilterMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowFilterMenu(false)}></div>
                                    <div className="absolute left-0 md:left-auto md:right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-20 max-h-80 overflow-y-auto py-1">
                                        <button
                                            onClick={() => { setSelectedCategoryFilter('all'); setShowFilterMenu(false); }}
                                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${selectedCategoryFilter === 'all' ? 'font-bold text-indigo-600 bg-indigo-50' : 'text-gray-700'}`}
                                        >
                                            Tất cả danh mục
                                        </button>
                                        <div className="my-1 border-t border-gray-100"></div>
                                        <div className="px-4 py-1 text-xs font-bold text-gray-400 uppercase tracking-wider">Chi tiêu</div>
                                        {expenseCategories.map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => { setSelectedCategoryFilter(cat); setShowFilterMenu(false); }}
                                                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${selectedCategoryFilter === cat ? 'font-bold text-indigo-600 bg-indigo-50' : 'text-gray-700'}`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                        <div className="my-1 border-t border-gray-100"></div>
                                        <div className="px-4 py-1 text-xs font-bold text-gray-400 uppercase tracking-wider">Thu nhập</div>
                                        {incomeCategories.map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => { setSelectedCategoryFilter(cat); setShowFilterMenu(false); }}
                                                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${selectedCategoryFilter === cat ? 'font-bold text-indigo-600 bg-indigo-50' : 'text-gray-700'}`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 md:px-6 md:py-4 font-semibold whitespace-nowrap">Ngày</th>
                                <th className="px-4 py-3 md:px-6 md:py-4 font-semibold whitespace-nowrap">Danh mục</th>
                                <th className="px-4 py-3 md:px-6 md:py-4 font-semibold min-w-[200px]">Mô tả (Ghi chú)</th>
                                <th className="px-4 py-3 md:px-6 md:py-4 font-semibold text-right whitespace-nowrap">Số tiền</th>
                                <th className="px-4 py-3 md:px-6 md:py-4 font-semibold text-center whitespace-nowrap">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredTransactions.map(t => (
                                <tr key={t.id} className="hover:bg-indigo-50/30 transition-colors group border-b border-gray-100">
                                    <td className="px-4 py-3 md:px-6 md:py-5">
                                        <div className="flex flex-col">
                                            <span className="text-gray-700 font-bold text-xs md:text-sm">{t.date.split('-').reverse().join('/')}</span>
                                            <span className="text-[10px] text-gray-400">{new Date(t.date).toLocaleDateString('vi-VN', { weekday: 'short' })}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 md:px-6 md:py-5">
                                        <span className={`px-2 py-1 rounded-lg text-xs font-bold border whitespace-nowrap ${t.type === TransactionType.INCOME
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                            : 'bg-rose-50 text-rose-700 border-rose-100'
                                            }`}>
                                            {t.category}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 md:px-6 md:py-5">
                                        <div className="text-sm font-medium text-gray-700 line-clamp-1" title={t.description}>
                                            {t.description}
                                        </div>
                                        {t.description && <div className="text-[10px] text-gray-400 mt-0.5">Note</div>}
                                    </td>
                                    <td className={`px-4 py-3 md:px-6 md:py-5 text-right font-bold text-sm whitespace-nowrap ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-gray-900'}`}>
                                        {t.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(t.amount, lang)}
                                    </td>
                                    <td className="px-4 py-3 md:px-6 md:py-5 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => openEditModal(t)} className="p-1.5 md:p-2 text-gray-400 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-indigo-100 rounded-lg transition-all shadow-sm" title="Sửa">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => onDeleteTransaction(t.id)} className="p-1.5 md:p-2 text-gray-400 hover:text-red-600 hover:bg-white border border-transparent hover:border-red-100 rounded-lg transition-all shadow-sm" title="Xóa">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredTransactions.length === 0 && (
                        <div className="p-12 text-center flex flex-col items-center justify-center text-gray-400">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                <SearchOffIcon />
                            </div>
                            <p className="text-sm font-medium">Không tìm thấy giao dịch nào</p>
                            <p className="text-xs mt-1">Thử thay đổi bộ lọc hoặc tháng hiển thị</p>
                        </div>
                    )}
                </div>
            </div >
        );
    };

    // Helper icon for empty state
    const SearchOffIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m13.5 8.5-5 5" /><path d="m8.5 8.5 5 5" /><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
    )

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in pb-20">
            {/* Top Header & Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800"> Tổng quan tài chính </h2>
                    <p className="text-gray-400 text-sm">Manage Your Assets Wisely </p>
                </div>

                <div className="flex flex-wrap gap-2 md:gap-3 items-center">
                    {/* Global Month Filter */}
                    <div className="flex items-center bg-white border border-gray-200 rounded-xl px-2 py-1.5 md:px-3 md:py-2 shadow-sm">
                        <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-indigo-600 transition-colors">❮</button>
                        <span className="mx-2 md:mx-3 font-semibold text-gray-700 min-w-[90px] md:min-w-[100px] text-center text-sm md:text-base">Tháng {selectedMonth + 1}/{selectedYear}</span>
                        <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-indigo-600 transition-colors">❯</button>
                    </div>

                    <div className="flex gap-1 md:gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                        <button onClick={() => setViewMode('overview')} className={`p-1.5 md:p-2 rounded-lg transition-all ${viewMode === 'overview' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`} title="Tổng quan"><LayoutDashboard size={18} /></button>
                        <button onClick={() => setViewMode('calendar')} className={`p-1.5 md:p-2 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`} title="Lịch"><CalendarDays size={18} /></button>
                        <button onClick={() => setViewMode('history')} className={`p-1.5 md:p-2 rounded-lg transition-all ${viewMode === 'history' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`} title="Danh sách"><List size={18} /></button>
                    </div>

                    {/* Buttons Group */}
                    <div className="flex flex-1 w-full md:w-auto gap-2">
                        {/* AI Analysis Button */}
                        <button
                            onClick={handleAnalyzeFinance}
                            className="flex-1 flex items-center justify-center gap-1.5 md:gap-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white px-3 py-2 md:px-4 md:py-2.5 rounded-xl font-bold shadow-md hover:shadow-lg transition-all whitespace-nowrap"
                        >
                            <Sparkles size={16} className="text-yellow-300" />
                            <span className="text-xs md:text-sm">Phân tích</span>
                        </button>

                        {/* Add Transaction Button */}
                        <button
                            onClick={() => {
                                setEditingTransaction(null);
                                setIsModalOpen(true);
                                setType(TransactionType.EXPENSE);
                                setAmount('');
                                setDesc('');
                                setCategory(EXPENSE_CATEGORIES[0]);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 md:gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 md:px-4 md:py-2.5 rounded-xl font-bold shadow-md hover:shadow-lg transition-all whitespace-nowrap"
                        >
                            <Plus size={18} />
                            <span className="text-xs md:text-sm">Thêm Mới</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Stats Cards */}
            {/* Main Stats Cards - Compact & Minimal */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {/* Balance Card - Luxurious Circle */}
                <div className="col-span-2 md:col-span-1 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center relative overflow-hidden group">
                    {/* Decorative Circle */}
                    <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 blur-xl"></div>
                    <div className="absolute right-2 top-2 w-12 h-12 rounded-full border border-indigo-50/50"></div>

                    <button
                        onClick={() => setIsBalanceModalOpen(true)}
                        className="absolute top-2 right-4 text-gray-300 hover:text-indigo-600 transition-colors p-1"
                    >
                        <Edit2 size={16} />
                    </button>

                    <p className="text-gray-400 font-bold text-[10px] uppercase tracking-wider mb-1 relative z-10">Số dư khả dụng</p>
                    <h3 className="text-2xl font-bold tracking-tight text-gray-900 relative z-10">{formatCurrency(stats.totalBalance, lang)}</h3>
                </div>

                {/* Income Card - 2-Step Interaction */}
                <button
                    onClick={() => setActiveStatsCard(activeStatsCard === 'income' ? null : 'income')}
                    className={`col-span-1 bg-white p-4 rounded-2xl shadow-sm border flex flex-col justify-center text-left transition-all group relative
                        ${activeStatsCard === 'income' ? 'border-emerald-200 ring-2 ring-emerald-50' : 'border-gray-100 hover:border-emerald-100 hover:shadow-md'}
                    `}
                >
                    <div className="flex justify-between w-full">
                        <p className={`font-bold text-[10px] uppercase tracking-wider mb-1 transition-colors ${activeStatsCard === 'income' ? 'text-emerald-600' : 'text-gray-400 group-hover:text-emerald-500'}`}>Thu nhập T{selectedMonth + 1}</p>
                        {activeStatsCard === 'income' && (
                            <div
                                onClick={(e) => { e.stopPropagation(); setViewMode('history'); }}
                                className="absolute top-2 right-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full cursor-pointer hover:bg-emerald-100 flex items-center gap-1 animate-in fade-in zoom-in"
                            >
                                Chi tiết <ExternalLink size={10} />
                            </div>
                        )}
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold tracking-tight text-emerald-600">+{formatCurrency(stats.currentMonthIncome, lang)}</h3>
                </button>

                {/* Expense Card - 2-Step Interaction */}
                <button
                    onClick={() => setActiveStatsCard(activeStatsCard === 'expense' ? null : 'expense')}
                    className={`col-span-1 bg-white p-4 rounded-2xl shadow-sm border flex flex-col justify-center text-left transition-all group relative
                        ${activeStatsCard === 'expense' ? 'border-rose-200 ring-2 ring-rose-50' : 'border-gray-100 hover:border-rose-100 hover:shadow-md'}
                    `}
                >
                    <div className="flex justify-between w-full">
                        <p className={`font-bold text-[10px] uppercase tracking-wider mb-1 transition-colors ${activeStatsCard === 'expense' ? 'text-rose-600' : 'text-gray-400 group-hover:text-rose-500'}`}>Chi tiêu T{selectedMonth + 1}</p>
                        {activeStatsCard === 'expense' && (
                            <div
                                onClick={(e) => { e.stopPropagation(); setViewMode('history'); }}
                                className="absolute top-2 right-2 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-full cursor-pointer hover:bg-rose-100 flex items-center gap-1 animate-in fade-in zoom-in"
                            >
                                Chi tiết <ExternalLink size={10} />
                            </div>
                        )}
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold tracking-tight text-rose-600">-{formatCurrency(stats.currentMonthExpense, lang)}</h3>
                </button>
            </div>




            {/* Budget Section */}
            {renderBudgets()}

            {/* AI Analysis Modal */}
            {
                (isAnalyzing || aiInsight) && (
                    <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl relative overflow-hidden">
                            {/* Decoration */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    <Bot size={24} className="text-indigo-600" />
                                    Trợ lý Tài chính AI
                                </h3>
                                <button onClick={() => { setAiInsight(null); setIsAnalyzing(false); }} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={24} /></button>
                            </div>

                            {isAnalyzing ? (
                                <div className="py-10 flex flex-col items-center justify-center text-center gap-4">
                                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                    <p className="text-gray-500 font-medium animate-pulse">Đang phân tích dữ liệu chi tiêu của bạn...</p>
                                </div>
                            ) : aiInsight ? (
                                <div className="space-y-6">
                                    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                                        <p className="text-gray-700 leading-relaxed font-medium">"{aiInsight.insight}"</p>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                                            <Sparkles size={14} className="text-amber-500" /> Đề xuất hành động
                                        </h4>
                                        <div className="space-y-2">
                                            {aiInsight.actions.map((action, idx) => (
                                                <div key={idx} className="flex items-start gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:border-indigo-200 transition-colors">
                                                    <div className="mt-1 w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</div>
                                                    <p className="text-sm text-gray-700">{action}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => { setAiInsight(null); }}
                                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-indigo-200"
                                    >
                                        Đã hiểu, cảm ơn AI!
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )
            }

            {
                isLoading && (
                    <div className="fixed inset-0 bg-white/50 z-40 flex items-center justify-center">
                        <div className="bg-white p-4 rounded-xl shadow-xl flex items-center gap-3">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                            Loading data...
                        </div>
                    </div>
                )
            }

            {/* VIEW SWITCHER */}
            <div className="min-h-[400px]">
                {viewMode === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-800 mb-6">Biểu đồ Thu - Chi 6 tháng gần nhất</h3>
                            <div className="h-64 md:h-80 w-full" style={{ minHeight: '300px' }}>
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                    <BarChart data={stats.monthlyChartData} barGap={8}>
                                        <defs>
                                            <linearGradient id="colorBarIncome" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#34D399" stopOpacity={1} />
                                                <stop offset="100%" stopColor="#10B981" stopOpacity={1} />
                                            </linearGradient>
                                            <linearGradient id="colorBarExpense" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#F87171" stopOpacity={1} />
                                                <stop offset="100%" stopColor="#EF4444" stopOpacity={1} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 500 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} tickFormatter={(value) => `${value / 1000000}M`} />
                                        <Tooltip
                                            cursor={{ fill: '#F9FAFB' }}
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding: '12px' }}
                                            formatter={(value: number | undefined) => formatCurrency(value || 0, lang)}
                                            itemStyle={{ fontWeight: 600, paddingBottom: '4px' }}
                                        />
                                        <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                                        <Bar dataKey="income" name="Thu nhập" fill="url(#colorBarIncome)" radius={[6, 6, 0, 0]} maxBarSize={50} />
                                        <Bar dataKey="expense" name="Chi tiêu" fill="url(#colorBarExpense)" radius={[6, 6, 0, 0]} maxBarSize={50} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-lg font-bold text-gray-800 mb-2">Cơ cấu chi tiêu tháng {selectedMonth + 1}</h3>
                                <div className="h-48 relative w-full" style={{ minHeight: '200px' }}>
                                    {stats.categoryData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                            <PieChart>
                                                <Pie data={stats.categoryData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                                                    {stats.categoryData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(value: number | undefined) => formatCurrency(value || 0, lang)} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-gray-400 text-sm">Chưa có dữ liệu</div>
                                    )}
                                </div>
                                <div className="space-y-2 mt-4 max-h-40 overflow-y-auto scrollbar-thin">
                                    {stats.categoryData.map((entry, index) => (
                                        <div key={index} className="flex justify-between text-xs">
                                            <span className="flex items-center gap-1.5">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                                {entry.name}
                                            </span>
                                            <span className="font-semibold">{Math.round(entry.percent)}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>


                        </div>
                    </div>
                )}

                {viewMode === 'calendar' && renderCalendar()}

                {viewMode === 'history' && renderHistory()}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Area Chart Section (Moved) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <TrendingUp className="text-indigo-600" /> Xu hướng Thu nhập & Chi tiêu
                    </h3>
                    <div className="h-80 w-full" style={{ minHeight: '320px' }}>
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <AreaChart data={stats.monthlyChartData}>
                                <defs>
                                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={(value) => `${value / 1000000}M`} />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number | undefined) => formatCurrency(value || 0, lang)} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Area type="monotone" dataKey="income" name="Thu nhập" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" />
                                <Area type="monotone" dataKey="expense" name="Chi tiêu" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExpense)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Savings Goals Management Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 h-full flex flex-col">
                    <div className="flex justify-between items-center mb-4 md:mb-6">
                        <div>
                            <h3 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
                                <Wallet className="text-indigo-600 w-5 h-5 md:w-6 md:h-6" /> <span className="hidden md:inline">Danh sách Mục tiêu Tiết kiệm</span><span className="md:hidden">Mục tiêu Tiết kiệm</span>
                            </h3>
                            <p className="text-xs md:text-sm text-gray-500">Đặt mục tiêu và theo dõi tiến độ</p>
                        </div>
                        <button
                            onClick={() => {
                                setEditingGoal(null);
                                setGoalTarget('');
                                setGoalCurrent('');
                                setIsGoalModalOpen(true);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-100 transition"
                        >
                            <Plus size={16} /> Thêm
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin space-y-4 max-h-[350px]">
                        {state.goals.filter(g => g.type === 'FINANCIAL').map(goal => (
                            <div key={goal.id} className="border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-shadow bg-gray-50 relative group">
                                <button
                                    onClick={() => onDeleteGoal(goal.id)}
                                    className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingGoal(goal);
                                        setGoalTarget((goal.target_amount || 0).toString());
                                        setGoalCurrent(goal.current_amount?.toString() || '');
                                        setIsGoalModalOpen(true);
                                    }}
                                    className="absolute top-2 right-9 p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Edit2 size={16} />
                                </button>

                                <h4 className="font-bold text-gray-800 mb-1">{goal.title}</h4>
                                <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                    <CalendarDays size={12} /> Hạn: {new Date(goal.deadline).toLocaleDateString('vi-VN')}
                                </p>

                                <div className="flex justify-between items-end text-sm mb-1">
                                    <span className="text-indigo-600 font-bold">{formatCurrency(goal.current_amount || 0, lang)}</span>
                                    <span className="text-gray-400 font-medium">/ {formatCurrency(goal.target_amount || 0, lang)}</span>
                                </div>

                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-1000"
                                        style={{ width: `${Math.min(((goal.current_amount || 0) / (goal.target_amount || 1)) * 100, 100)}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between mt-2">
                                    <button
                                        onClick={() => {
                                            setSelectedGoalForDeposit(goal);
                                            setDepositAmount('');
                                            setIsDepositModalOpen(true);
                                        }}
                                        className="text-xs font-bold text-indigo-600 hover:underline"
                                    >
                                        + Nạp thêm
                                    </button>
                                    <span className="text-xs font-bold text-gray-500">{Math.round(((goal.current_amount || 0) / (goal.target_amount || 1)) * 100)}%</span>
                                </div>
                            </div>
                        ))}

                        {state.goals.filter(g => g.type === 'FINANCIAL').length === 0 && (
                            <div className="text-center py-10 text-gray-400 italic">
                                Bạn chưa có mục tiêu.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add/Edit Transaction Modal */}
            {
                isGoalModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm z-[60]">
                        <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg text-gray-800">{editingGoal ? 'Sửa Mục Tiêu' : 'Mục tiêu Tiết kiệm Mới'}</h3>
                                <button onClick={() => setIsGoalModalOpen(false)}><X size={20} className="text-gray-400" /></button>
                            </div>
                            <form onSubmit={handleGoalSubmit} className="space-y-4">
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold ml-1">Tên mục tiêu</label>
                                    <input name="title" required defaultValue={editingGoal?.title} placeholder="Ví dụ: Mua iPhone 16" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none font-medium mt-1" />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold ml-1">Số tiền mục tiêu</label>
                                    <input
                                        name="target_amount"
                                        type="number"
                                        required
                                        value={goalTarget}
                                        onChange={(e) => setGoalTarget(e.target.value)}
                                        placeholder="0"
                                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none font-medium mt-1"
                                    />
                                    <div className="flex justify-end mt-1 text-xs text-indigo-600 font-bold">
                                        {goalTarget && !isNaN(Number(goalTarget)) && formatCurrency(Number(goalTarget), lang)}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold ml-1">Đã tích lũy</label>
                                    <input
                                        name="current_amount"
                                        type="number"
                                        value={goalCurrent}
                                        onChange={(e) => setGoalCurrent(e.target.value)}
                                        placeholder="0"
                                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none font-medium mt-1"
                                    />
                                    <div className="flex justify-end mt-1 text-xs text-indigo-600 font-bold">
                                        {goalCurrent && !isNaN(Number(goalCurrent)) && formatCurrency(Number(goalCurrent), lang)}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold ml-1">Dự định hoàn thành</label>
                                    <input type="date" name="deadline" required defaultValue={editingGoal ? editingGoal.deadline : new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none text-sm mt-1" />
                                </div>
                                <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 mt-2">{editingGoal ? 'Cập Nhật' : 'Lưu Mục Tiêu'}</button>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Deposit Modal */}
            {
                isDepositModalOpen && selectedGoalForDeposit && (
                    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">Nạp thêm tiền</h3>
                                    <p className="text-xs text-gray-500 line-clamp-1">Cho mục tiêu: {selectedGoalForDeposit.title}</p>
                                </div>
                                <button onClick={() => setIsDepositModalOpen(false)}><X size={20} className="text-gray-400" /></button>
                            </div>

                            <form onSubmit={handleDepositSubmit} className="space-y-4">
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold ml-1">Số tiền muốn nạp</label>
                                    <input
                                        type="number"
                                        autoFocus
                                        value={depositAmount}
                                        onChange={(e) => setDepositAmount(e.target.value)}
                                        placeholder="Nhập số tiền..."
                                        className="w-full p-4 bg-indigo-50 rounded-xl border-2 border-indigo-100 text-indigo-700 text-lg font-bold outline-none focus:border-indigo-500 transition-colors mt-2"
                                    />
                                    <div className="flex justify-end mt-1 text-xs text-gray-400">
                                        {depositAmount && !isNaN(Number(depositAmount)) && formatCurrency(Number(depositAmount), lang)}
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsDepositModalOpen(false)}
                                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition"
                                    >
                                        Xác nhận
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {
                isModalOpen && (
                    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col transform transition-all scale-100">

                            {/* Header - Minimal, No Title */}
                            <div className="absolute top-4 right-4 z-10">
                                <button
                                    onClick={() => { setIsModalOpen(false); setEditingTransaction(null); }}
                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="overflow-y-auto px-6 pt-12 pb-6 scrollbar-thin">
                                <form onSubmit={handleAddSubmit} className="space-y-6">

                                    {/* Type Switcher */}
                                    <div className="bg-gray-100/80 p-1.5 rounded-2xl flex relative">
                                        <button
                                            type="button"
                                            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-300 relative z-10 flex items-center justify-center gap-2
                                                ${type === TransactionType.EXPENSE ? 'text-rose-600 shadow-sm bg-white' : 'text-gray-500 hover:text-gray-700'}`}
                                            onClick={() => setType(TransactionType.EXPENSE)}
                                        >
                                            <TrendingDown size={16} /> Chi tiêu
                                        </button>
                                        <button
                                            type="button"
                                            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-300 relative z-10 flex items-center justify-center gap-2
                                                ${type === TransactionType.INCOME ? 'text-emerald-600 shadow-sm bg-white' : 'text-gray-500 hover:text-gray-700'}`}
                                            onClick={() => setType(TransactionType.INCOME)}
                                        >
                                            <TrendingUp size={16} /> Thu nhập
                                        </button>
                                    </div>

                                    {/* Amount Input */}
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block ml-1">Số tiền</label>
                                        <div className="relative group">
                                            <input
                                                type="number"
                                                required
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                className={`w-full p-4 bg-gray-50/50 border-2 rounded-2xl outline-none text-2xl font-bold pr-12 transition-all
                                                    ${type === TransactionType.EXPENSE ? 'text-rose-600 border-transparent focus:border-rose-100 focus:bg-white focus:ring-4 focus:ring-rose-50' : 'text-emerald-600 border-transparent focus:border-emerald-100 focus:bg-white focus:ring-4 focus:ring-emerald-50'}
                                                    placeholder-gray-300
                                                `}
                                                placeholder="0"
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowCalculator(!showCalculator)}
                                                className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all
                                                    ${showCalculator ? 'bg-indigo-100 text-indigo-600 shadow-inner' : 'text-gray-300 hover:text-indigo-500 hover:bg-indigo-50'}
                                                `}
                                                title="Máy tính"
                                            >
                                                <CalculatorIcon size={20} />
                                            </button>
                                        </div>

                                        {/* Calculator Preview */}
                                        {showCalculator && (
                                            <div className="mt-3 overflow-hidden rounded-2xl shadow-lg border border-gray-100 animate-in slide-in-from-top-2">
                                                <Calculator
                                                    initialValue={amount}
                                                    onComplete={(val) => {
                                                        setAmount(val);
                                                        setShowCalculator(false);
                                                    }}
                                                    onClose={() => setShowCalculator(false)}
                                                />
                                            </div>
                                        )}

                                        {/* Currency Helper */}
                                        <div className={`flex justify-end mt-2 text-xs font-bold transition-opacity ${amount ? 'opacity-100' : 'opacity-0'}`}>
                                            <span className="bg-gray-100 px-2 py-1 rounded-lg text-gray-500">
                                                {amount && !isNaN(Number(amount)) && formatCurrency(Number(amount), lang)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Category Select */}
                                    {/* Category Select Grid */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block ml-1">Danh mục</label>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
                                            {(type === TransactionType.INCOME ? incomeCategories : expenseCategories).map(c => (
                                                <button
                                                    key={c}
                                                    type="button"
                                                    onClick={() => { setCategory(c); setIsAddingNewCategory(false); }}
                                                    className={`p-3 rounded-2xl text-sm font-bold transition-all border-2 text-left truncate flex items-center gap-2
                                                        ${category === c
                                                            ? (type === TransactionType.EXPENSE ? 'bg-rose-50 border-rose-100 text-rose-600 shadow-sm ring-2 ring-rose-50' : 'bg-emerald-50 border-emerald-100 text-emerald-600 shadow-sm ring-2 ring-emerald-50')
                                                            : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50 hover:border-gray-200'
                                                        }
                                                    `}
                                                >
                                                    <div className={`w-2 h-2 rounded-full ${category === c ? (type === TransactionType.EXPENSE ? 'bg-rose-500' : 'bg-emerald-500') : 'bg-gray-300'}`}></div>
                                                    {c}
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => { setCategory(''); setIsAddingNewCategory(true); }}
                                                className={`p-3 rounded-2xl text-sm font-bold transition-all border-2 border-dashed flex items-center justify-center gap-1
                                                    ${isAddingNewCategory
                                                        ? 'border-indigo-300 bg-indigo-50 text-indigo-600'
                                                        : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500'
                                                    }
                                                `}
                                            >
                                                <Plus size={16} /> Khác
                                            </button>
                                        </div>

                                        {isAddingNewCategory && (
                                            <div className="animate-in fade-in slide-in-from-top-2 pt-2">
                                                <input
                                                    placeholder="Nhập tên danh mục mới..."
                                                    value={newCategoryName}
                                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                                    className="w-full p-4 bg-indigo-50/50 border-2 border-indigo-100 text-indigo-700 rounded-2xl outline-none font-bold placeholder-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all"
                                                    autoFocus
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Date & Desc Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2 md:col-span-1">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block ml-1">Ngày</label>
                                            <div className="relative">
                                                <input
                                                    type="date"
                                                    required
                                                    value={date}
                                                    onChange={(e) => setDate(e.target.value)}
                                                    className="w-full p-3.5 bg-gray-50/50 border-2 border-transparent rounded-2xl outline-none text-gray-700 font-semibold focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50 transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div className="col-span-2 md:col-span-1">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block ml-1">Note</label>
                                            <input
                                                placeholder="Chi tiết..."
                                                value={desc}
                                                onChange={(e) => setDesc(e.target.value)}
                                                className="w-full p-3.5 bg-gray-50/50 border-2 border-transparent rounded-2xl outline-none text-gray-700 font-medium focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50 transition-all placeholder-gray-400"
                                            />
                                        </div>
                                    </div>

                                    {/* Submit Button */}
                                    <button
                                        type="submit"
                                        className={`w-full py-4 rounded-2xl font-bold text-white shadow-xl transform active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4
                                            ${type === TransactionType.EXPENSE
                                                ? 'bg-gradient-to-r from-rose-500 to-red-600 shadow-rose-200 hover:bg-rose-600'
                                                : 'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-200 hover:bg-emerald-600'}
                                        `}
                                    >
                                        {editingTransaction ? <Edit2 size={20} /> : <Plus size={20} />}
                                        {editingTransaction ? 'Cập nhật' : 'Lưu Giao dịch'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Edit Balance Modal */}
            {
                isBalanceModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                            <div className="p-6 text-center">
                                <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
                                    <Wallet size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-800 mb-2">Điều chỉnh số dư</h3>
                                <p className="text-sm text-gray-500 mb-6">Nhập số tiền thực tế bạn đang có. Hệ thống sẽ tự tạo giao dịch điều chỉnh.</p>

                                <form onSubmit={handleUpdateBalance}>
                                    <div className="relative mb-6">
                                        <span className="absolute left-4 top-3.5 text-gray-400 font-bold">₫</span>
                                        <input
                                            type="number"
                                            required
                                            autoFocus
                                            value={newBalance}
                                            onChange={(e) => setNewBalance(e.target.value)}
                                            className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-bold text-center"
                                            placeholder={stats.totalBalance.toString()}
                                        />
                                        <div className="flex justify-center mt-2 text-sm text-indigo-600 font-bold">
                                            {newBalance && !isNaN(Number(newBalance)) && formatCurrency(Number(newBalance), lang)}
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button type="button" onClick={() => setIsBalanceModalOpen(false)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl">Hủy</button>
                                        <button type="submit" className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg">Cập nhật</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Budget Modal */}
            {
                isBudgetModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">{editingBudget ? 'Sửa Ngân sách' : 'Thiết lập Ngân sách'}</h3>
                                    <p className="text-xs text-gray-500">Tháng {selectedMonth + 1}/{selectedYear}</p>
                                </div>
                                <button onClick={() => { setIsBudgetModalOpen(false); setEditingBudget(null); }}><X size={20} className="text-gray-400" /></button>
                            </div>

                            <form onSubmit={handleBudgetSubmit} className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase ml-1">Danh mục</label>
                                    <select
                                        value={selectedBudgetCategory}
                                        onChange={(e) => setSelectedBudgetCategory(e.target.value)}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none mt-1 font-medium text-gray-700"
                                        disabled={!!editingBudget} // Disable category change if editing
                                    >
                                        {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase ml-1">Giới hạn chi tiêu</label>
                                    <input
                                        type="number"
                                        autoFocus
                                        value={budgetLimit}
                                        onChange={(e) => setBudgetLimit(e.target.value)}
                                        placeholder="0"
                                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none text-lg font-bold mt-1"
                                    />
                                    <div className="flex justify-end mt-1 text-xs text-indigo-600 font-bold">
                                        {budgetLimit && !isNaN(Number(budgetLimit)) && formatCurrency(Number(budgetLimit), lang)}
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => { setIsBudgetModalOpen(false); setEditingBudget(null); }}
                                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition"
                                    >
                                        Lưu
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Budget Details Modal */}
            {
                selectedBudgetForDetails && (
                    <div className="fixed inset-0 bg-black/50 z-[65] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col max-h-[90vh]">
                            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">Chi tiết: {selectedBudgetForDetails.category}</h3>
                                    <p className="text-xs text-gray-500">
                                        {detailViewMonth ? `Tháng ${detailViewMonth.split('-')[1]}/${detailViewMonth.split('-')[0]}` : 'Lịch sử chi tiêu'}
                                    </p>
                                </div>
                                <button onClick={() => { setSelectedBudgetForDetails(null); setDetailViewMonth(null); }}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
                            </div>

                            {/* Chart Section */}
                            <div className="h-48 mb-4 w-full flex-shrink-0" style={{ minHeight: '200px' }}>
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                    <BarChart
                                        data={(() => {
                                            const data = [];
                                            // Show 6 months: 5 previous + current
                                            for (let i = 5; i >= 0; i--) {
                                                const d = new Date(selectedYear, selectedMonth - i, 1);
                                                const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                                                const spent = transactions
                                                    .filter(t => t.type === TransactionType.EXPENSE && t.category === selectedBudgetForDetails.category && t.date.startsWith(monthStr))
                                                    .reduce((acc, t) => acc + t.amount, 0);
                                                data.push({
                                                    name: `T${d.getMonth() + 1}`,
                                                    fullDate: monthStr,
                                                    amount: spent
                                                });
                                            }
                                            return data;
                                        })()}
                                        margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${(val / 1000).toFixed(0)}k`} />
                                        <Tooltip
                                            formatter={(value) => formatCurrency(Number(value), lang)}
                                            labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                            cursor={{ fill: 'transparent' }}
                                        />
                                        <Bar
                                            dataKey="amount"
                                            radius={[4, 4, 0, 0]}
                                            onClick={(data: any) => setDetailViewMonth(data?.fullDate)}
                                            cursor="pointer"
                                        >
                                            {
                                                (() => {
                                                    const data = [];
                                                    for (let i = 5; i >= 0; i--) {
                                                        const d = new Date(selectedYear, selectedMonth - i, 1);
                                                        data.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                                                    }
                                                    return data;
                                                })().map((entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={entry === detailViewMonth ? '#4F46E5' : '#E5E7EB'}
                                                    />
                                                ))
                                            }
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
                                {(() => {
                                    const viewMonth = detailViewMonth || `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
                                    const details = transactions.filter(t =>
                                        t.type === TransactionType.EXPENSE &&
                                        t.category === selectedBudgetForDetails.category &&
                                        t.date.startsWith(viewMonth)
                                    ).sort((a, b) => b.date.localeCompare(a.date));

                                    if (details.length === 0) {
                                        return <p className="text-center text-gray-400 py-8">Không có giao dịch trong tháng {viewMonth.split('-')[1]}.</p>;
                                    }

                                    return (
                                        <div className="space-y-3">
                                            {details.map(t => (
                                                <div key={t.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                    <div>
                                                        <div className="text-sm font-semibold text-gray-700">{t.description || 'Không có mô tả'}</div>
                                                        <div className="text-xs text-gray-500">{t.date.split('-').reverse().join('/')}</div>
                                                    </div>
                                                    <span className="font-bold text-red-500 text-sm">
                                                        -{formatCurrency(t.amount, lang)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center flex-shrink-0">
                                <span className="text-sm font-medium text-gray-500">Tổng tháng {detailViewMonth ? detailViewMonth.split('-')[1] : String(selectedMonth + 1).padStart(2, '0')}</span>
                                <span className="text-lg font-bold text-red-600">
                                    {formatCurrency(
                                        transactions
                                            .filter(t => t.type === TransactionType.EXPENSE && t.category === selectedBudgetForDetails.category && t.date.startsWith(detailViewMonth || `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`))
                                            .reduce((acc, t) => acc + t.amount, 0),
                                        lang
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>
                )
            }

            <FinanceAI context={financeContext} />
        </div >
    );
};

export default FinanceDashboard;
