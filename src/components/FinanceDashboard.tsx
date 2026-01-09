import React, { useMemo, useState } from 'react';
import { AppState, TransactionType, Transaction, Goal } from '../types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Plus, X, CalendarDays, Edit2, Trash2, List, LayoutDashboard, Wallet, StickyNote, Calculator as CalculatorIcon } from 'lucide-react';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../constants';
import Calculator from './Calculator';
import { analyzeFinancialData } from '../services/geminiService';

interface FinanceDashboardProps {
    state: AppState;
    onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
    onUpdateTransaction: (t: Transaction) => void; // Added for Edit
    onDeleteTransaction: (id: string) => void;
    onAddGoal: (g: any) => void;
    onUpdateGoal: (g: any) => void;
    onDeleteGoal: (id: string) => void;
    isLoading?: boolean;
}

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#3B82F6', '#14B8A6', '#F97316', '#64748B'];

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

// --- Helper for Calendar ---
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay(); // 0 = Sunday

const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ state, onAddTransaction, onUpdateTransaction, onDeleteTransaction, onAddGoal, onUpdateGoal, onDeleteGoal, isLoading }) => {
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

    // Filter State (Month)
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());

    // Form State
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
    const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
    const [desc, setDesc] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Balance Form State
    const [newBalance, setNewBalance] = useState('');
    const [showCalculator, setShowCalculator] = useState(false);

    // AI State
    const [analysisResult, setAnalysisResult] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showAnalysis, setShowAnalysis] = useState(false);
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

        if (editingTransaction) {
            // Mode: Update
            onUpdateTransaction({
                ...editingTransaction,
                amount: Number(amount),
                category: category,
                date: date,
                type: type,
                description: desc
            });
        } else {
            // Mode: Create
            onAddTransaction({
                amount: Number(amount),
                category: category,
                date: date,
                type: type,
                description: desc || (type === TransactionType.INCOME ? 'Thu nhập' : 'Chi tiêu')
            });
        }

        setIsModalOpen(false);
        setEditingTransaction(null);
        setAmount('');
        setDesc('');
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


    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        setShowAnalysis(false);
        try {
            // Get Monthly Data
            const currentData = {
                income: stats.currentMonthIncome,
                expense: stats.currentMonthExpense,
                transactions: stats.currentMonthTransactions
            };

            // Get Last Month Data (Simple calculation)
            // Note: In a real app we might want to memoize this or fetch it specifically, 
            // but here we can just filter from all transactions.
            let lastM = selectedMonth - 1;
            let lastY = selectedYear;
            if (lastM < 0) { lastM = 11; lastY--; }

            const lastMonthTx = transactions.filter(t => {
                const d = new Date(t.date);
                return d.getMonth() === lastM && d.getFullYear() === lastY && t.category !== 'Điều chỉnh số dư';
            });

            const lastMonthData = {
                income: lastMonthTx.filter(t => t.type === TransactionType.INCOME).reduce((a, b) => a + b.amount, 0),
                expense: lastMonthTx.filter(t => t.type === TransactionType.EXPENSE).reduce((a, b) => a + b.amount, 0)
            };

            const result = await analyzeFinancialData(currentData, lastMonthData);
            setAnalysisResult(result);
            setShowAnalysis(true);
        } catch (error) {
            console.error(error);
            setAnalysisResult("Có lỗi xảy ra khi kết nối với AI.");
            setShowAnalysis(true);
        } finally {
            setIsAnalyzing(false);
        }
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

    // --- Render Components ---

    const renderCalendar = () => {
        const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
        const firstDay = getFirstDayOfMonth(selectedYear, selectedMonth);
        const days = [];

        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-28 md:h-32 bg-gray-50/50 border border-gray-100"></div>);
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
                    className={`h-28 md:h-32 border p-1 md:p-2 cursor-pointer transition-all relative group overflow-hidden
                    ${isSelected ? 'border-2 border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-white hover:bg-gray-50'}
                `}
                >
                    <div className={`text-xs md:text-sm font-semibold mb-1 ${isToday ? 'bg-indigo-600 text-white w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center' : 'text-gray-700'} ml-1 mt-1`}>
                        {day}
                    </div>
                    <div className="space-y-0.5 px-0.5">
                        {dayIncome > 0 && <div className="text-[9px] md:text-[10px] bg-green-100/80 text-green-700 px-1 rounded truncate leading-tight tracking-tighter">+{formatCurrency(dayIncome)}</div>}
                        {dayExpense > 0 && <div className="text-[9px] md:text-[10px] bg-red-100/80 text-red-700 px-1 rounded truncate leading-tight tracking-tighter">-{formatCurrency(dayExpense)}</div>}
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
                                    Thu: {formatCurrency(selectedDayTransactions.filter(t => t.type === TransactionType.INCOME).reduce((a, b) => a + b.amount, 0))}
                                </span>
                                <span className="text-sm font-medium text-red-600 bg-red-50 px-3 py-1 rounded-lg">
                                    Chi: {formatCurrency(selectedDayTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((a, b) => a + b.amount, 0))}
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
                                                    {t.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(t.amount)}
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

    const renderHistory = () => (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
                <h3 className="font-bold text-lg text-gray-800">Toàn bộ Lịch sử Giao dịch</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                        <tr>
                            <th className="px-6 py-4 font-semibold">Ngày</th>
                            <th className="px-6 py-4 font-semibold">Danh mục</th>
                            <th className="px-6 py-4 font-semibold">Mô tả (Ghi chú)</th>
                            <th className="px-6 py-4 font-semibold text-right">Số tiền</th>
                            <th className="px-6 py-4 font-semibold text-center">Hành động</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {transactions.map(t => (
                            <tr key={t.id} className="hover:bg-gray-50 transition-colors group">
                                <td className="px-6 py-4 text-sm text-gray-600 font-medium whitespace-nowrap">{t.date}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${t.type === TransactionType.INCOME ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                        {t.category}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate" title={t.description}>
                                    {t.description}
                                </td>
                                <td className={`px-6 py-4 text-right font-bold text-sm ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-gray-900'}`}>
                                    {t.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(t.amount)}
                                </td>
                                <td className="px-6 py-4 text-center flex justify-center gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEditModal(t)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all" title="Sửa">
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => onDeleteTransaction(t.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all" title="Xóa">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {transactions.length === 0 && (
                    <div className="p-8 text-center text-gray-500 text-sm">Chưa có giao dịch nào.</div>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Top Header & Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Tổng quan Tài chính</h2>
                    <p className="text-gray-500 text-sm">Quản lý dòng tiền thông minh</p>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    {/* Global Month Filter */}
                    <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                        <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-indigo-600 transition-colors">❮</button>
                        <span className="mx-3 font-semibold text-gray-700 min-w-[100px] text-center">Tháng {selectedMonth + 1}/{selectedYear}</span>
                        <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-indigo-600 transition-colors">❯</button>
                    </div>

                    <div className="flex gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                        <button onClick={() => setViewMode('overview')} className={`p-2 rounded-lg transition-all ${viewMode === 'overview' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`} title="Tổng quan"><LayoutDashboard size={20} /></button>
                        <button onClick={() => setViewMode('calendar')} className={`p-2 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`} title="Lịch"><CalendarDays size={20} /></button>
                        <button onClick={() => setViewMode('history')} className={`p-2 rounded-lg transition-all ${viewMode === 'history' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`} title="Danh sách"><List size={20} /></button>
                    </div>

                    <button
                        onClick={() => {
                            setEditingTransaction(null);
                            setIsModalOpen(true);
                            setType(TransactionType.EXPENSE);
                            setAmount('');
                            setDesc('');
                            setCategory(EXPENSE_CATEGORIES[0]);
                        }}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all"
                    >
                        <Plus size={20} />
                        <span className="hidden sm:inline">Thêm Giao dịch</span>
                    </button>
                </div>
            </div>

            {/* Main Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
                <div className="col-span-2 md:col-span-1 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:border-indigo-200 transition-colors">
                    <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <div className="flex justify-between items-start relative z-10">
                        <p className="text-gray-500 font-medium mb-1 text-sm md:text-base">Số dư khả dụng</p>
                        <button onClick={() => setIsBalanceModalOpen(true)} className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors" title="Sửa số dư">
                            <Edit2 size={14} />
                        </button>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold text-gray-800 relative z-10">{formatCurrency(stats.totalBalance)}</h3>
                    <div className="mt-4 flex items-center text-indigo-600 text-sm font-medium relative z-10">
                        <DollarSign size={16} className="mr-1" />
                        Hiện có
                    </div>
                </div>

                <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="flex justify-between items-center mb-1">
                        <p className="text-gray-500 font-medium text-xs md:text-base">Thu nhập tháng {selectedMonth + 1}</p>
                    </div>
                    <h3 className="text-lg md:text-3xl font-bold text-emerald-600 truncate">{formatCurrency(stats.currentMonthIncome)}</h3>
                </div>

                <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                    <p className="text-gray-500 font-medium mb-1 text-xs md:text-base">Chi tiêu tháng {selectedMonth + 1}</p>
                    <h3 className="text-lg md:text-3xl font-bold text-red-500 truncate">{formatCurrency(stats.currentMonthExpense)}</h3>
                </div>

                {/* AI Analysis Section */}
                <div className="col-span-2 md:col-span-3">
                    {!showAnalysis ? (
                        <button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing}
                            className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white py-2 px-3 md:p-4 rounded-xl md:rounded-2xl shadow-lg flex items-center justify-center gap-2 font-bold transition-all transform hover:scale-[1.01] text-xs md:text-base"
                        >
                            {isAnalyzing ? (
                                <><div className="animate-spin rounded-full h-4 w-4 md:h-5 md:w-5 border-b-2 border-white"></div> Đang phân tích...</>
                            ) : (
                                <><div className="text-yellow-200 text-base md:text-xl">✨</div> AI Phân tích & Nhận xét Tiêu dùng</>
                            )}
                        </button>
                    ) : (
                        <div className="bg-white p-3 md:p-6 rounded-xl md:rounded-2xl shadow-lg border border-indigo-100 animate-slide-up relative">
                            <button onClick={() => setShowAnalysis(false)} className="absolute top-2 right-2 md:top-4 md:right-4 text-gray-400 hover:text-gray-600"><X size={16} className="md:w-5 md:h-5" /></button>
                            <div className="flex items-start gap-2 md:gap-4">
                                <div className="bg-violet-100 p-2 md:p-3 rounded-lg md:rounded-xl shrink-0">
                                    <span className="text-lg md:text-2xl">🤖</span>
                                </div>
                                <div className="space-y-1 md:space-y-2 flex-1">
                                    <h3 className="font-bold text-gray-800 text-sm md:text-lg">Góc nhìn AI</h3>
                                    <div className="prose prose-sm max-w-none text-gray-600 bg-gray-50 p-2 md:p-4 rounded-lg md:rounded-xl text-xs md:text-sm">
                                        {analysisResult.split('\n').map((line, i) => (
                                            <p key={i} className={`mb-0.5 md:mb-1 ${line.startsWith('-') ? 'pl-2 md:pl-4' : ''}`}>{line}</p>
                                        ))}
                                    </div>
                                    <div className="flex justify-end pt-1 md:pt-2">
                                        <button onClick={handleAnalyze} className="text-[10px] md:text-xs text-indigo-600 hover:underline font-medium">Phân tích lại</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>


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
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.monthlyChartData} barGap={8}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={(value) => `${value / 1000000}M`} />
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => formatCurrency(value)} />
                                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                        <Bar dataKey="income" name="Thu nhập" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                        <Bar dataKey="expense" name="Chi tiêu" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-lg font-bold text-gray-800 mb-2">Cơ cấu chi tiêu tháng {selectedMonth + 1}</h3>
                                <div className="h-48 relative">
                                    {stats.categoryData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={stats.categoryData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                                                    {stats.categoryData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
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
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
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
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => formatCurrency(value)} />
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
                                        setGoalTarget(goal.target_amount.toString());
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
                                    <span className="text-indigo-600 font-bold">{formatCurrency(goal.current_amount || 0)}</span>
                                    <span className="text-gray-400 font-medium">/ {formatCurrency(goal.target_amount || 0)}</span>
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
                                        {goalTarget && !isNaN(Number(goalTarget)) && formatCurrency(Number(goalTarget))}
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
                                        {goalCurrent && !isNaN(Number(goalCurrent)) && formatCurrency(Number(goalCurrent))}
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
                                        {depositAmount && !isNaN(Number(depositAmount)) && formatCurrency(Number(depositAmount))}
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
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
                            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                                <h3 className="font-bold text-lg text-gray-800">{editingTransaction ? 'Sửa Giao dịch' : 'Thêm Giao dịch mới'}</h3>
                                <button onClick={() => { setIsModalOpen(false); setEditingTransaction(null); }}><X size={24} className="text-gray-400" /></button>
                            </div>
                            <div className="overflow-y-auto p-6 scrollbar-thin">
                                <form onSubmit={handleAddSubmit} className="space-y-4">
                                    <div className="flex bg-gray-100 p-1 rounded-xl">
                                        <button type="button" className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${type === TransactionType.EXPENSE ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`} onClick={() => setType(TransactionType.EXPENSE)}>Chi tiêu</button>
                                        <button type="button" className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${type === TransactionType.INCOME ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`} onClick={() => setType(TransactionType.INCOME)}>Thu nhập</button>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase ml-1">Số tiền</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                required
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xl font-bold text-gray-800 pr-12"
                                                placeholder="0"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowCalculator(!showCalculator)}
                                                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${showCalculator ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-indigo-600 hover:bg-gray-100'}`}
                                                title="Máy tính"
                                            >
                                                <CalculatorIcon size={20} />
                                            </button>
                                        </div>
                                        {showCalculator && (
                                            <div className="mt-2 text-sm">
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
                                        {showCalculator && (
                                            <div className="mt-2 text-sm">
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
                                        <div className="flex justify-end mt-1 text-xs text-indigo-600 font-bold">
                                            {amount && !isNaN(Number(amount)) && formatCurrency(Number(amount))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase ml-1">Danh mục</label>
                                        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none">
                                            {(type === TransactionType.INCOME ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase ml-1">Ngày</label>
                                        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase ml-1">Ghi chú (Mô tả)</label>
                                        <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none" placeholder="Chi tiết..." />
                                    </div>
                                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg mt-2">{editingTransaction ? 'Cập nhật' : 'Lưu lại'}</button>
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
                                            {newBalance && !isNaN(Number(newBalance)) && formatCurrency(Number(newBalance))}
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

        </div >
    );
};

export default FinanceDashboard;
