import React, { useMemo, useState, useEffect, useRef } from 'react';
import { AppState, TransactionType, Transaction, Goal, BudgetConfig, Wallet, Debt, DebtRepayment, SavingsLog, RecurringTransaction } from '../types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area, LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Plus, X, CalendarDays, Edit2, Trash2, List, LayoutDashboard, Wallet as WalletIcon, StickyNote, Calculator as CalculatorIcon, Sparkles, Bot, Filter, ChevronDown, ChevronUp, Maximize2, Minimize2, ExternalLink, FileBarChart, Loader2, Utensils, Car, ShoppingBag, FileText, Tv, Heart, BookOpen, Coffee, Gift, Briefcase, Coins, PiggyBank, GraduationCap, Home, Droplets, Landmark, Plane, Eye, EyeOff, ArrowRightLeft, CreditCard, History, Flame, Target, Sliders, BarChart2, Repeat, Pin } from 'lucide-react';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../constants';
import Calculator from './Calculator';
import { Lang } from '../i18n/i18n';
import { savingsService } from '../services/savingsService';
import { TransactionEntryModal } from './finance/TransactionEntryModal';
import { CategoryManagerModal } from './finance/CategoryManagerModal';
import { RecurringTransactionsModal } from './finance/RecurringTransactionsModal';
import { recurringTransactionService } from '../services/recurringTransactionService';
import { getCategoryIconInfo, getCustomCategoryIcons } from '../utils/categoryIcons';



interface FinanceDashboardProps {
    state: AppState;
    onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
    onUpdateTransaction: (t: Transaction) => void;
    onDeleteTransaction: (id: string) => void;
    onAddGoal: (g: any) => void;
    onUpdateGoal: (g: any) => void;
    onDeleteGoal: (id: string) => void;
    onNavigateToCashFlow?: () => void;
    onNavigateToAI?: () => void;
    isLoading?: boolean;
    lang: Lang;
    expenseCategories: string[];
    incomeCategories: string[];
    onAddCategory: (type: 'expense' | 'income', name: string) => void;
    onDeleteCategory: (type: 'expense' | 'income', name: string) => void;
    onAddBudget: (budget: Omit<BudgetConfig, 'id'>) => void;
    onUpdateBudget: (budget: BudgetConfig) => void;
    onDeleteBudget: (id: string) => void;
    onRefresh?: () => Promise<void>;

    // Wallets callbacks
    onAddWallet: (w: Omit<Wallet, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
    onUpdateWallet: (w: Wallet) => Promise<void>;
    onDeleteWallet: (id: string) => Promise<void>;
    onTransferMoney: (fromId: string, toId: string, amount: number, note?: string) => Promise<void>;

    // Debts callbacks
    onAddDebt: (d: Omit<Debt, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
    onDeleteDebt: (id: string) => Promise<void>;
    onRepayDebt: (debtId: string, amount: number, date: string, walletId?: string | null, note?: string) => Promise<void>;
    onBatchAddTransactions?: (txList: Omit<Transaction, 'id'>[]) => Promise<void>;
    pinnedCategories?: string[];
    onTogglePinCategory?: (categoryName: string) => void;
    onEditCategory?: (type: 'expense' | 'income', oldName: string, newName: string) => Promise<void>;
}

const COLORS = ['#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#3B82F6', '#14B8A6', '#F97316', '#64748B'];

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
    },
    ko: {
        financeOverview: '자산 현황',
        income: '수입',
        expense: '지출',
        balance: '현재 잔액',
        addTransaction: '거래 추가',
        analysis: '자산 분석',
        recentTransactions: '최근 거래 내역',
        noTransactions: '등록된 거래가 없습니다.',
        goals: '자산 관리 목표',
        addGoal: '목표 추가',
        savings: '저축',
        date: '날짜',
        category: '카테고리',
        amount: '금액',
        description: '설명',
        actions: '작업',
        edit: '수정',
        delete: '삭제',
        save: '저장',
        cancel: '취소',
        income_salary: '급여',
        income_bonus: '보너스',
        income_other: '기타',
        expense_food: '식비',
        expense_transport: '교통비',
        expense_shopping: '쇼핑',
        expense_bills: '공과금/요금',
        expense_entertainment: '문화/여가',
        expense_health: '의료/건강',
        expense_education: '교육/학업',
        expense_other: '기타',
        month: '월',
        year: '년'
    }
};

const formatCurrency = (amount: number, lang: Lang) => {
    if (lang === 'vi') {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    } else if (lang === 'ko') {
        return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount / 18.5);
    } else {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 25000);
    }
};

// --- Helper for Calendar ---
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay(); // 0 = Sunday

// --- Helper for Category Icons & Emojis ---
const getCategoryEmoji = (category: string): string | null => {
    const match = category.match(/\p{Extended_Pictographic}/u);
    return match ? match[0] : null;
};

const cleanCategoryName = (category: string): string => {
    const cleaned = category.replace(/\p{Extended_Pictographic}/ug, '').trim();
    return cleaned || category;
};

const hashString = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
};

const getCategoryStyles = (category: string) => {
    const cat = category.toLowerCase().trim();
    const emoji = getCategoryEmoji(category);

    // If user customized this category's icon via the Icon Picker
    const customMap = getCustomCategoryIcons();
    if (customMap[category] || customMap[cat]) {
        const info = getCategoryIconInfo(category);
        return {
            emoji,
            icon: info.icon,
            bgClass: `${info.bgClass} ${info.colorClass} group-hover:bg-sky-600 group-hover:text-white`,
            borderColor: 'border-gray-200',
            accentColor: 'sky'
        };
    }

    // Dynamic keyword matching
    if (cat.includes('cà phê') || cat.includes('cafe') || cat.includes('coffee') || cat.includes('caffe') || cat.includes('trà sữa')) {
        return {
            emoji,
            icon: Coffee,
            bgClass: 'bg-[#efebe9] text-[#5d4037] group-hover:bg-[#5d4037] group-hover:text-white',
            borderColor: 'border-[#efebe9]',
            accentColor: 'amber'
        };
    }
    if (cat.includes('ăn uống') || cat.includes('food') || cat.includes('ẩm thực') || cat.includes('nhà hàng') || cat.includes('quán ăn') || cat.includes('đồ ăn') || cat.includes('ăn trưa') || cat.includes('ăn tối')) {
        return {
            emoji,
            icon: Utensils,
            bgClass: 'bg-rose-50 text-rose-500 group-hover:bg-rose-500 group-hover:text-white',
            borderColor: 'border-rose-100',
            accentColor: 'rose'
        };
    }
    if (cat.includes('dating') || cat.includes('hẹn hò') || cat.includes('tình yêu') || cat.includes('người yêu') || cat.includes('crush') || cat.includes('yêu')) {
        return {
            emoji,
            icon: Heart,
            bgClass: 'bg-pink-50 text-pink-500 group-hover:bg-pink-500 group-hover:text-white',
            borderColor: 'border-pink-100',
            accentColor: 'pink'
        };
    }
    if (cat.includes('di chuyển') || cat.includes('transport') || cat.includes('xe cộ') || cat.includes('đi lại') || cat.includes('xăng') || cat.includes('grab') || cat.includes('taxi')) {
        return {
            emoji,
            icon: Car,
            bgClass: 'bg-blue-50 text-blue-500 group-hover:bg-blue-500 group-hover:text-white',
            borderColor: 'border-blue-100',
            accentColor: 'blue'
        };
    }
    if (cat.includes('vé máy bay') || cat.includes('du lịch') || cat.includes('travel') || cat.includes('bay') || cat.includes('khách sạn')) {
        return {
            emoji,
            icon: Plane,
            bgClass: 'bg-sky-50 text-sky-500 group-hover:bg-sky-500 group-hover:text-white',
            borderColor: 'border-sky-100',
            accentColor: 'sky'
        };
    }
    if (cat.includes('mua sắm') || cat.includes('shopping') || cat.includes('quần áo') || cat.includes('mỹ phẩm') || cat.includes('giày') || cat.includes('shopee') || cat.includes('lazada') || cat.includes('siêu thị')) {
        return {
            emoji,
            icon: ShoppingBag,
            bgClass: 'bg-amber-50 text-amber-500 group-hover:bg-amber-500 group-hover:text-white',
            borderColor: 'border-amber-100',
            accentColor: 'amber'
        };
    }
    if (cat.includes('hóa đơn') || cat.includes('bills') || cat.includes('điện nước') || cat.includes('internet') || cat.includes('dịch vụ') || cat.includes('wifi') || cat.includes('điện') || cat.includes('nước') || cat.includes('gas')) {
        return {
            emoji,
            icon: Droplets,
            bgClass: 'bg-purple-50 text-purple-500 group-hover:bg-purple-500 group-hover:text-white',
            borderColor: 'border-purple-100',
            accentColor: 'purple'
        };
    }
    if (cat.includes('giải trí') || cat.includes('entertainment') || cat.includes('phim') || cat.includes('chơi') || cat.includes('game') || cat.includes('netflix') || cat.includes('spotify') || cat.includes('karaoke')) {
        return {
            emoji,
            icon: Tv,
            bgClass: 'bg-sky-50 text-sky-500 group-hover:bg-sky-500 group-hover:text-white',
            borderColor: 'border-sky-100',
            accentColor: 'sky'
        };
    }
    if (cat.includes('sức khỏe') || cat.includes('health') || cat.includes('thuốc') || cat.includes('bệnh viện') || cat.includes('khám') || cat.includes('gym') || cat.includes('nha khoa')) {
        return {
            emoji,
            icon: Heart,
            bgClass: 'bg-emerald-50 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white',
            borderColor: 'border-emerald-100',
            accentColor: 'emerald'
        };
    }
    if (cat.includes('giáo dục') || cat.includes('education') || cat.includes('học tập') || cat.includes('sách') || cat.includes('khóa học') || cat.includes('học phí') || cat.includes('tài liệu')) {
        return {
            emoji,
            icon: GraduationCap,
            bgClass: 'bg-teal-50 text-teal-500 group-hover:bg-teal-500 group-hover:text-white',
            borderColor: 'border-teal-100',
            accentColor: 'teal'
        };
    }
    if (cat.includes('nhà cửa') || cat.includes('nhà') || cat.includes('phòng') || cat.includes('rent') || cat.includes('thuê nhà') || cat.includes('tiền nhà')) {
        return {
            emoji,
            icon: Home,
            bgClass: 'bg-orange-50 text-orange-500 group-hover:bg-orange-500 group-hover:text-white',
            borderColor: 'border-orange-100',
            accentColor: 'orange'
        };
    }
    if (cat.includes('đầu tư') || cat.includes('invest') || cat.includes('cổ phiếu') || cat.includes('coin') || cat.includes('vàng')) {
        return {
            emoji,
            icon: TrendingUp,
            bgClass: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
            borderColor: 'border-emerald-200',
            accentColor: 'emerald'
        };
    }
    if (cat.includes('trả nợ') || cat.includes('nợ') || cat.includes('debt') || cat.includes('ngân hàng') || cat.includes('bank') || cat.includes('vay') || cat.includes('mượn')) {
        return {
            emoji,
            icon: Landmark,
            bgClass: 'bg-red-50 text-red-500 group-hover:bg-red-500 group-hover:text-white',
            borderColor: 'border-red-100',
            accentColor: 'red'
        };
    }
    if (cat.includes('tiết kiệm') || cat.includes('heo đất') || cat.includes('tích lũy') || cat.includes('gửi tiết kiệm')) {
        return {
            emoji,
            icon: PiggyBank,
            bgClass: 'bg-pink-50 text-pink-500 group-hover:bg-pink-500 group-hover:text-white',
            borderColor: 'border-pink-100',
            accentColor: 'pink'
        };
    }
    if (cat.includes('hiếu hỉ') || cat.includes('cưới') || cat.includes('tân gia') || cat.includes('sinh nhật') || cat.includes('quà') || cat.includes('tặng') || cat.includes('lì xì')) {
        return {
            emoji,
            icon: Gift,
            bgClass: 'bg-violet-50 text-violet-500 group-hover:bg-violet-500 group-hover:text-white',
            borderColor: 'border-violet-100',
            accentColor: 'violet'
        };
    }
    if (cat.includes('lương') || cat.includes('salary') || cat.includes('công ty') || cat.includes('working') || cat.includes('thu nhập')) {
        return {
            emoji,
            icon: Briefcase,
            bgClass: 'bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white',
            borderColor: 'border-sky-100',
            accentColor: 'sky'
        };
    }
    if (cat.includes('thưởng') || cat.includes('bonus')) {
        return {
            emoji,
            icon: Sparkles,
            bgClass: 'bg-yellow-50 text-yellow-600 group-hover:bg-yellow-600 group-hover:text-white',
            borderColor: 'border-yellow-100',
            accentColor: 'amber'
        };
    }
    if (cat.includes('bán hàng') || cat.includes('kinh doanh') || cat.includes('doanh thu') || cat.includes('sales') || cat.includes('tiệm')) {
        return {
            emoji,
            icon: Coins,
            bgClass: 'bg-cyan-50 text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white',
            borderColor: 'border-cyan-100',
            accentColor: 'cyan'
        };
    }

    // Deterministic fallback for custom categories
    const hash = hashString(category);
    const fallbackPalettes = [
        { bgClass: 'bg-sky-50 text-sky-500 group-hover:bg-sky-500 group-hover:text-white', borderColor: 'border-sky-100', accentColor: 'sky' },
        { bgClass: 'bg-emerald-50 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white', borderColor: 'border-emerald-100', accentColor: 'emerald' },
        { bgClass: 'bg-rose-50 text-rose-500 group-hover:bg-rose-500 group-hover:text-white', borderColor: 'border-rose-100', accentColor: 'rose' },
        { bgClass: 'bg-amber-50 text-amber-500 group-hover:bg-amber-500 group-hover:text-white', borderColor: 'border-amber-100', accentColor: 'amber' },
        { bgClass: 'bg-blue-50 text-blue-500 group-hover:bg-blue-500 group-hover:text-white', borderColor: 'border-blue-100', accentColor: 'blue' },
        { bgClass: 'bg-purple-50 text-purple-500 group-hover:bg-purple-500 group-hover:text-white', borderColor: 'border-purple-100', accentColor: 'purple' },
        { bgClass: 'bg-pink-50 text-pink-500 group-hover:bg-pink-500 group-hover:text-white', borderColor: 'border-pink-100', accentColor: 'pink' },
        { bgClass: 'bg-cyan-50 text-cyan-500 group-hover:bg-cyan-500 group-hover:text-white', borderColor: 'border-cyan-100', accentColor: 'cyan' },
        { bgClass: 'bg-teal-50 text-teal-500 group-hover:bg-teal-500 group-hover:text-white', borderColor: 'border-teal-100', accentColor: 'teal' },
        { bgClass: 'bg-orange-50 text-orange-500 group-hover:bg-orange-500 group-hover:text-white', borderColor: 'border-orange-100', accentColor: 'orange' },
    ];
    const palette = fallbackPalettes[hash % fallbackPalettes.length];

    const fallbackIcons = [WalletIcon, Coins, PiggyBank, Sparkles, Heart, FileText];
    const IconComponent = fallbackIcons[hash % fallbackIcons.length];

    return {
        emoji,
        icon: IconComponent,
        ...palette
    };
};

// --- Helper to parse mathematical expressions and shorthands safely ---
const parseMathExpression = (expr: string): number | null => {
    if (!expr || !expr.trim()) return null;
    try {
        let cleaned = expr.toLowerCase();

        // Replace Vietnamese shorthands & general shorthands
        cleaned = cleaned.replace(/tr(iệu)?/g, '*1000000');
        cleaned = cleaned.replace(/m/g, '*1000000');
        cleaned = cleaned.replace(/t(ỷ)?/g, '*1000000000');
        cleaned = cleaned.replace(/k/g, '*1000');

        // Replace visual operators with JS operators
        cleaned = cleaned.replace(/x|×/g, '*');
        cleaned = cleaned.replace(/:|÷/g, '/');

        // Remove spaces
        cleaned = cleaned.replace(/\s+/g, '');

        // Remove thousands separators: commas or dots followed by exactly three digits
        cleaned = cleaned.replace(/(\d)[.,](\d{3})(?!\d)/g, '$1$2');

        // Now any remaining comma is a decimal point
        cleaned = cleaned.replace(/,/g, '.');

        // Only allow safe math characters
        const safeRegex = /^[\d\+\-\*\/\(\)\.]+$/;
        if (!safeRegex.test(cleaned)) {
            return null;
        }

        // Evaluate safely
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

const keypadKeys = [
    { label: 'C', value: 'C', bg: 'bg-rose-50 text-rose-600 hover:bg-rose-100' },
    { label: '(', value: '(', bg: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
    { label: ')', value: ')', bg: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
    { label: '⌫', value: 'backspace', bg: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },

    { label: '7', value: '7', bg: 'bg-gray-50 text-gray-800 hover:bg-gray-200' },
    { label: '8', value: '8', bg: 'bg-gray-50 text-gray-800 hover:bg-gray-200' },
    { label: '9', value: '9', bg: 'bg-gray-50 text-gray-800 hover:bg-gray-200' },
    { label: '÷', value: '/', bg: 'bg-sky-50 text-sky-600 font-bold hover:bg-sky-100' },

    { label: '4', value: '4', bg: 'bg-gray-50 text-gray-800 hover:bg-gray-200' },
    { label: '5', value: '5', bg: 'bg-gray-50 text-gray-800 hover:bg-gray-200' },
    { label: '6', value: '6', bg: 'bg-gray-50 text-gray-800 hover:bg-gray-200' },
    { label: '×', value: '*', bg: 'bg-sky-50 text-sky-600 font-bold hover:bg-sky-100' },

    { label: '1', value: '1', bg: 'bg-gray-50 text-gray-800 hover:bg-gray-200' },
    { label: '2', value: '2', bg: 'bg-gray-50 text-gray-800 hover:bg-gray-200' },
    { label: '3', value: '3', bg: 'bg-gray-50 text-gray-800 hover:bg-gray-200' },
    { label: '-', value: '-', bg: 'bg-sky-50 text-sky-600 font-bold hover:bg-sky-100' },

    { label: '0', value: '0', bg: 'bg-gray-50 text-gray-800 hover:bg-gray-200' },
    { label: '.', value: '.', bg: 'bg-gray-50 text-gray-800 hover:bg-gray-200' },
    { label: 'k', value: 'k', bg: 'bg-emerald-50 text-emerald-600 font-bold hover:bg-emerald-100' },
    { label: '+', value: '+', bg: 'bg-sky-50 text-sky-600 font-bold hover:bg-sky-100' },

    { label: '=', value: '=', bg: 'col-span-4 bg-gradient-to-r from-sky-500 via-sky-600 to-blue-600 text-white font-extrabold hover:from-sky-600 hover:to-blue-700 shadow-md shadow-sky-100 py-3.5' }
];

const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ state, onAddTransaction, onBatchAddTransactions, onUpdateTransaction, onDeleteTransaction, onAddGoal, onUpdateGoal, onDeleteGoal, onNavigateToCashFlow, onNavigateToAI, isLoading, lang, expenseCategories, incomeCategories, pinnedCategories = [], onTogglePinCategory, onAddCategory, onEditCategory, onDeleteCategory, onAddBudget, onUpdateBudget, onDeleteBudget, onRefresh, onAddWallet, onUpdateWallet, onDeleteWallet, onTransferMoney, onAddDebt, onDeleteDebt, onRepayDebt }) => {
    const t = translations[lang];
    const { transactions } = state;

    const [hideBalance, setHideBalance] = useState(() => localStorage.getItem('smartlife_hide_balance') === 'true');

    useEffect(() => {
        localStorage.setItem('smartlife_hide_balance', hideBalance.toString());
    }, [hideBalance]);

    // Pull to Refresh state
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const startY = React.useRef(0);
    const isDragging = React.useRef(false);

    const handleTouchStart = (e: React.TouchEvent) => {
        const mainScroll = document.querySelector('main');
        const isAtTop = !mainScroll || mainScroll.scrollTop === 0;
        if (isAtTop && window.scrollY === 0) {
            startY.current = e.touches[0].clientY;
            isDragging.current = true;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging.current) return;
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY.current;

        if (diff > 0) {
            const offset = Math.min(diff * 0.4, 90);
            setPullDistance(offset);
            if (diff > 10 && e.cancelable) {
                e.preventDefault();
            }
        }
    };

    const handleTouchEnd = async () => {
        if (!isDragging.current) return;
        isDragging.current = false;

        if (pullDistance > 55 && onRefresh) {
            setIsRefreshing(true);
            setPullDistance(60);
            try {
                await onRefresh();
            } catch (err) {
                console.error("Refresh error:", err);
            } finally {
                setIsRefreshing(false);
                setPullDistance(0);
            }
        } else {
            setPullDistance(0);
        }
    };

    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
    const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
    const [recurringItems, setRecurringItems] = useState<RecurringTransaction[]>([]);

    const fetchRecurring = async () => {
        const userId = state.profile?.id || 'guest';
        const data = await recurringTransactionService.fetchRecurringTransactions(userId);
        setRecurringItems(data);
    };

    useEffect(() => {
        fetchRecurring();
    }, [state.profile?.id]);

    const [, setCategoryIconsTick] = useState(0);
    useEffect(() => {
        const handleUpdate = () => setCategoryIconsTick(t => t + 1);
        window.addEventListener('category_icons_updated', handleUpdate);
        return () => window.removeEventListener('category_icons_updated', handleUpdate);
    }, []);

    const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'overview' | 'calendar' | 'history' | 'report' | 'wallets'>('overview');

    // Edit State
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

    // Goal Form State
    const [goalTarget, setGoalTarget] = useState('');
    const [goalCurrent, setGoalCurrent] = useState('');
    const [goalMonthlyTarget, setGoalMonthlyTarget] = useState('');

    // Deposit Modal & Savings Habit State
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
    const [selectedGoalForDeposit, setSelectedGoalForDeposit] = useState<Goal | null>(null);
    const [depositDate, setDepositDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [depositNote, setDepositNote] = useState<string>('');
    const [depositWalletId, setDepositWalletId] = useState<string>('');

    // Savings Log & History Modal State (CRUD)
    const [savingsLogs, setSavingsLogs] = useState<SavingsLog[]>([]);
    const [isSavingHistoryModalOpen, setIsSavingHistoryModalOpen] = useState<boolean>(false);
    const [selectedGoalForHistory, setSelectedGoalForHistory] = useState<Goal | null>(null);
    const [historyGoalFilter, setHistoryGoalFilter] = useState<string>('all');
    const [editingLog, setEditingLog] = useState<SavingsLog | null>(null);
    const [editLogAmount, setEditLogAmount] = useState<string>('');
    const [editLogDate, setEditLogDate] = useState<string>('');
    const [editLogNote, setEditLogNote] = useState<string>('');

    // Savings Balance Adjustment & Analytics State
    const [isAdjustBalanceModalOpen, setIsAdjustBalanceModalOpen] = useState<boolean>(false);
    const [selectedGoalForAdjust, setSelectedGoalForAdjust] = useState<Goal | null>(null);
    const [adjustNewAmount, setAdjustNewAmount] = useState<string>('');
    const [adjustReason, setAdjustReason] = useState<string>('');
    const [savingsModalTab, setSavingsModalTab] = useState<'analytics' | 'history'>('analytics');

    // Wallets UI State
    const [isAddWalletModalOpen, setIsAddWalletModalOpen] = useState(false);
    const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
    const [walletName, setWalletName] = useState('');
    const [walletType, setWalletType] = useState<Wallet['type']>('cash');
    const [walletBalance, setWalletBalance] = useState('');
    const [walletCurrentBalance, setWalletCurrentBalance] = useState('');
    const [selectedWalletForHistory, setSelectedWalletForHistory] = useState<Wallet | null>(null);
    const [isWalletHistoryModalOpen, setIsWalletHistoryModalOpen] = useState(false);
    const [walletColor, setWalletColor] = useState('#6366F1');
    const [walletIcon, setWalletIcon] = useState('Wallet');
    const [walletIncludeInTotal, setWalletIncludeInTotal] = useState(true);

    // Transfer UI State
    const [transferFrom, setTransferFrom] = useState('');
    const [transferTo, setTransferTo] = useState('');
    const [transferAmount, setTransferAmount] = useState('');
    const [transferNote, setTransferNote] = useState('');

    // Debtor Ledger UI State
    const [isDebtorLedgerOpen, setIsDebtorLedgerOpen] = useState(false);
    const [isAddDebtOpen, setIsAddDebtOpen] = useState(false);
    const [debtPartnerName, setDebtPartnerName] = useState('');
    const [debtType, setDebtType] = useState<'lend' | 'borrow'>('lend');
    const [debtAmount, setDebtAmount] = useState('');
    const [debtDateLent, setDebtDateLent] = useState(new Date().toISOString().split('T')[0]);
    const [debtDueDate, setDebtDueDate] = useState('');
    const [debtDescription, setDebtDescription] = useState('');
    const [debtWalletId, setDebtWalletId] = useState('');

    // Repayments UI State
    const [activeDebtForRepay, setActiveDebtForRepay] = useState<Debt | null>(null);
    const [repayAmount, setRepayAmount] = useState('');
    const [repayWalletId, setRepayWalletId] = useState('');
    const [repayNote, setRepayNote] = useState('');
    const [repayDate, setRepayDate] = useState(new Date().toISOString().split('T')[0]);

    // Repayments History Cache
    const [repaymentsCache, setRepaymentsCache] = useState<Record<string, DebtRepayment[]>>({});
    const [expandedDebtHistoryId, setExpandedDebtHistoryId] = useState<string | null>(null);

    // Transaction form wallet link
    const [selectedWalletId, setSelectedWalletId] = useState<string>('');
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

    // Chart Interactive Highlight & Double-Click Detail States
    const [selectedPieCategory, setSelectedPieCategory] = useState<string | null>(null);
    const [selectedBarMonth, setSelectedBarMonth] = useState<string | null>(null);
    const [selectedBarRawKey, setSelectedBarRawKey] = useState<string | null>(null);
    const lastPieClickRef = useRef<{ name: string; time: number }>({ name: '', time: 0 });
    const lastBarClickRef = useRef<{ name: string; time: number }>({ name: '', time: 0 });

    // Chart Detail History Modal State
    const [isChartDetailModalOpen, setIsChartDetailModalOpen] = useState(false);
    const [chartDetailInfo, setChartDetailInfo] = useState<{
        type: 'category' | 'month';
        title: string;
        subtitle: string;
        category?: string;
        monthKey: string;
    } | null>(null);

    // Filter State (Month)
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

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

    useEffect(() => {
        const userId = state.profile?.id || 'guest';
        savingsService.fetchSavingsLogs(userId).then(logs => {
            setSavingsLogs(logs);
        });
    }, [state.profile?.id]);

    // Monthly Savings Habit Statistics
    const monthlySavingsStats = useMemo(() => {
        const currentMonthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
        
        // Filter logs in current month
        const currentMonthLogs = savingsLogs.filter(l => l.date && l.date.startsWith(currentMonthStr));
        const totalSavedThisMonth = currentMonthLogs.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

        // Sum of all monthly_targets of active financial goals
        const financialGoals = state.goals.filter(g => g.type === 'FINANCIAL');
        const totalMonthlyTarget = financialGoals.reduce((sum, g) => sum + (g.monthly_target || 0), 0);

        // Total accumulated balance across all savings goals
        const totalAccumulated = financialGoals.reduce((sum, g) => sum + (g.current_amount || 0), 0);
        const totalTarget = financialGoals.reduce((sum, g) => sum + (g.target_amount || 0), 0);

        // Unique days saved this month
        const daysSet = new Set(currentMonthLogs.map(l => l.date));
        const savedDaysCount = daysSet.size;

        const habitProgressPercent = totalMonthlyTarget > 0 
            ? Math.min(Math.round((totalSavedThisMonth / totalMonthlyTarget) * 100), 100)
            : (totalSavedThisMonth > 0 ? 100 : 0);

        const overallProgressPercent = totalTarget > 0
            ? Math.min(Math.round((totalAccumulated / totalTarget) * 100), 100)
            : 0;

        const avgPerLog = currentMonthLogs.length > 0
            ? Math.round(totalSavedThisMonth / currentMonthLogs.length)
            : 0;

        return {
            totalSavedThisMonth,
            totalMonthlyTarget,
            totalAccumulated,
            totalTarget,
            savedDaysCount,
            habitProgressPercent,
            overallProgressPercent,
            avgPerLog,
            currentMonthLogs
        };
    }, [savingsLogs, state.goals, selectedYear, selectedMonth]);

    const monthlySavingsComparisonChartData = useMemo(() => {
        const result: { month: string; amount: number }[] = [];
        const now = new Date();
        
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            const monthPrefix = `${y}-${String(m).padStart(2, '0')}`;
            const monthLabel = `Thg ${m}/${y}`;

            const total = savingsLogs
                .filter(l => l.date && l.date.startsWith(monthPrefix))
                .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

            result.push({
                month: monthLabel,
                amount: total
            });
        }
        return result;
    }, [savingsLogs]);

    // History Filter State
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
    const [activeStatsCard, setActiveStatsCard] = useState<'income' | 'expense' | null>(null);

    // --- Derived State ---
    const [showFilterMenu, setShowFilterMenu] = useState(false);

    // Balance Form State
    const [newBalance, setNewBalance] = useState('');
    const [showCalculator, setShowCalculator] = useState(false);

    const handleKeypadPress = (key: string) => {
        if (key === 'C') {
            setAmount('');
        } else if (key === 'backspace') {
            setAmount(prev => {
                if (prev.endsWith(' ')) {
                    return prev.trimEnd().slice(0, -1).trimEnd();
                }
                return prev.slice(0, -1);
            });
        } else if (key === '=') {
            const parsed = parseMathExpression(amount);
            if (parsed !== null) {
                setAmount(parsed.toString());
            }
        } else {
            setAmount(prev => {
                if (prev === '0' && /\d/.test(key)) return key;
                if (['+', '-', '*', '/'].includes(key)) {
                    let op = key;
                    if (key === '*') op = ' × ';
                    else if (key === '/') op = ' ÷ ';
                    else op = ` ${key} `;
                    return prev + op;
                }
                return prev + key;
            });
        }
    };

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
            rawKey: key,
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

    // Chart Click Handlers (Single click to highlight, Double click to open detail popup)
    const handlePieCategoryClick = (catName: string) => {
        const now = Date.now();
        const isDouble = lastPieClickRef.current.name === catName && (now - lastPieClickRef.current.time < 500);

        if (isDouble || selectedPieCategory === catName) {
            setChartDetailInfo({
                type: 'category',
                title: `Chi tiết chi tiêu: ${catName}`,
                subtitle: `Tháng ${selectedMonth + 1}/${selectedYear}`,
                category: catName,
                monthKey: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`
            });
            setIsChartDetailModalOpen(true);
            lastPieClickRef.current = { name: '', time: 0 };
        } else {
            setSelectedPieCategory(catName);
            lastPieClickRef.current = { name: catName, time: now };
        }
    };

    const handleBarMonthClick = (monthName: string, rawKey?: string) => {
        const now = Date.now();
        const isDouble = lastBarClickRef.current.name === monthName && (now - lastBarClickRef.current.time < 500);

        let targetKey = rawKey;
        if (!targetKey) {
            const found = stats.monthlyChartData.find(d => d.name === monthName);
            targetKey = (found as any)?.rawKey || '';
        }

        if (isDouble || selectedBarMonth === monthName) {
            setChartDetailInfo({
                type: 'month',
                title: `Chi tiết giao dịch: ${monthName}`,
                subtitle: targetKey ? `Kỳ ${targetKey}` : '',
                monthKey: targetKey || ''
            });
            setIsChartDetailModalOpen(true);
            lastBarClickRef.current = { name: '', time: 0 };
        } else {
            setSelectedBarMonth(monthName);
            setSelectedBarRawKey(targetKey || null);
            lastBarClickRef.current = { name: monthName, time: now };
        }
    };

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
        setSelectedWalletId(t.wallet_id || '');
        setIsModalOpen(true);
    };

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount) return;

        const parsedAmount = parseMathExpression(amount);
        if (parsedAmount === null || isNaN(parsedAmount) || parsedAmount <= 0) {
            alert("Số tiền không hợp lệ. Vui lòng kiểm tra lại phép tính!");
            return;
        }

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
                amount: parsedAmount,
                category: finalCategory,
                date: date,
                type: type,
                description: desc,
                wallet_id: selectedWalletId || null
            });
        } else {
            // Mode: Create
            onAddTransaction({
                amount: parsedAmount,
                category: finalCategory,
                date: date,
                type: type,
                description: desc || (type === TransactionType.INCOME ? 'Thu nhập' : 'Chi tiêu'),
                wallet_id: selectedWalletId || null
            });
        }

        setIsModalOpen(false);
        setEditingTransaction(null);
        setAmount('');
        setDesc('');
        setIsAddingNewCategory(false);
        setNewCategoryName('');
        setSelectedWalletId('');
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
        const monthlyTarget = Number(goalMonthlyTarget);

        const data = {
            title: fd.get('title'),
            target_amount: target,
            current_amount: current,
            monthly_target: isNaN(monthlyTarget) ? 0 : monthlyTarget,
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
        setGoalMonthlyTarget('');
    };

    const handleDepositSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGoalForDeposit || !depositAmount) return;

        const amount = Number(depositAmount);
        if (isNaN(amount) || amount <= 0) {
            alert("Vui lòng nhập số tiền hợp lệ");
            return;
        }

        const userId = state.profile?.id || 'guest';
        const newLog = await savingsService.addSavingsLog(userId, {
            goal_id: selectedGoalForDeposit.id,
            amount: amount,
            date: depositDate || new Date().toISOString().split('T')[0],
            note: depositNote.trim() || 'Ghi nhận tiết kiệm'
        });

        if (newLog) {
            const updatedLogs = [newLog, ...savingsLogs.filter(l => l.id !== newLog.id)];
            setSavingsLogs(updatedLogs);

            // Calculate new total accumulated amount for the goal from savings logs
            const newCurrent = savingsService.calculateTotalSavings(updatedLogs, selectedGoalForDeposit.id);
            const newProgress = Math.round((newCurrent / (selectedGoalForDeposit.target_amount || 1)) * 100);

            onUpdateGoal({
                ...selectedGoalForDeposit,
                current_amount: newCurrent,
                progress: newProgress
            });

            // Optional: If user selected a wallet to deduct from, create an expense transaction
            if (depositWalletId) {
                onAddTransaction({
                    amount: amount,
                    category: 'Tiết kiệm',
                    date: depositDate || new Date().toISOString().split('T')[0],
                    type: TransactionType.EXPENSE,
                    description: `Trích tiền tiết kiệm mục tiêu: ${selectedGoalForDeposit.title}`,
                    wallet_id: depositWalletId
                });
            }
        }

        setIsDepositModalOpen(false);
        setDepositAmount('');
        setDepositNote('');
        setDepositWalletId('');
        setDepositDate(new Date().toISOString().split('T')[0]);
        setSelectedGoalForDeposit(null);
    };

    const handleUpdateLogSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingLog) return;
        const amt = Number(editLogAmount);
        if (isNaN(amt) || amt <= 0) {
            alert("Số tiền không hợp lệ!");
            return;
        }

        const updates = {
            amount: amt,
            date: editLogDate,
            note: editLogNote.trim()
        };

        const success = await savingsService.updateSavingsLog(editingLog.id, updates);
        if (success) {
            const updatedLogs = savingsLogs.map(l => l.id === editingLog.id ? { ...l, ...updates } : l);
            setSavingsLogs(updatedLogs);

            // Recalculate target goal
            const targetGoal = state.goals.find(g => g.id === editingLog.goal_id);
            if (targetGoal) {
                const newCurrent = savingsService.calculateTotalSavings(updatedLogs, targetGoal.id);
                const newProgress = Math.round((newCurrent / (targetGoal.target_amount || 1)) * 100);
                onUpdateGoal({
                    ...targetGoal,
                    current_amount: newCurrent,
                    progress: newProgress
                });
            }
            setEditingLog(null);
            setEditLogAmount('');
            setEditLogDate('');
            setEditLogNote('');
        }
    };

    const handleDeleteLog = async (logId: string, goalId: string) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa lượt nạp tiết kiệm này?")) return;

        const success = await savingsService.deleteSavingsLog(logId);
        if (success) {
            const updatedLogs = savingsLogs.filter(l => l.id !== logId);
            setSavingsLogs(updatedLogs);

            const targetGoal = state.goals.find(g => g.id === goalId);
            if (targetGoal) {
                const newCurrent = savingsService.calculateTotalSavings(updatedLogs, targetGoal.id);
                const newProgress = Math.round((newCurrent / (targetGoal.target_amount || 1)) * 100);
                onUpdateGoal({
                    ...targetGoal,
                    current_amount: newCurrent,
                    progress: newProgress
                });
            }
        }
    };

    const handleAdjustBalanceSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGoalForAdjust) return;
        const newAmt = Number(adjustNewAmount);
        if (isNaN(newAmt) || newAmt < 0) {
            alert("Vui lòng nhập số tiền tích lũy hợp lệ!");
            return;
        }

        const currentAmt = selectedGoalForAdjust.current_amount || 0;
        const diff = newAmt - currentAmt;
        const userId = state.profile?.id || 'guest';

        if (diff !== 0) {
            const newLog = await savingsService.addSavingsLog(userId, {
                goal_id: selectedGoalForAdjust.id,
                amount: diff,
                date: new Date().toISOString().split('T')[0],
                note: adjustReason.trim() ? `Điều chỉnh số dư: ${adjustReason.trim()}` : 'Điều chỉnh số dư tích lũy'
            });
            if (newLog) {
                setSavingsLogs(prev => [newLog, ...prev.filter(l => l.id !== newLog.id)]);
            }
        }

        const newProgress = Math.round((newAmt / (selectedGoalForAdjust.target_amount || 1)) * 100);
        onUpdateGoal({
            ...selectedGoalForAdjust,
            current_amount: newAmt,
            progress: newProgress
        });

        setIsAdjustBalanceModalOpen(false);
        setSelectedGoalForAdjust(null);
        setAdjustNewAmount('');
        setAdjustReason('');
    };

    const handleAnalyzeFinance = () => {
        onNavigateToAI?.();
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
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-6 mb-6 animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Ngân sách tháng {selectedMonth + 1}</h3>
                    <button
                        onClick={() => {
                            setEditingBudget(null);
                            setBudgetLimit('');
                            // Default to first category if possible, or reset
                            setSelectedBudgetCategory(expenseCategories[0]);
                            setIsBudgetModalOpen(true);
                        }}
                        className="text-sm text-sky-600 bg-sky-50 px-3 py-1.5 rounded-lg font-semibold hover:bg-sky-100 transition-colors"
                    >
                        + Thiết lập
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3 md:gap-4">
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
                                    className="bg-white rounded-2xl p-3 md:p-5 border border-gray-100 hover:shadow-lg hover:border-sky-100 transition-all cursor-pointer group relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-sky-50 to-transparent rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>

                                    {(() => {
                                        const styles = getCategoryStyles(budget.category);
                                        const cleanName = cleanCategoryName(budget.category);
                                        const IconComponent = styles.icon;

                                        return (
                                            <>
                                                <div className="flex justify-between items-start mb-2.5 relative z-10">
                                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 md:gap-3 min-w-0">
                                                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${styles.bgClass}`}>
                                                            {styles.emoji ? (
                                                                <span className="text-sm md:text-base">{styles.emoji}</span>
                                                            ) : (
                                                                <IconComponent size={16} className="md:w-5 md:h-5" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="font-bold text-gray-800 text-xs md:text-sm block truncate" title={cleanName}>{cleanName}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                                                        <button onClick={() => { setEditingBudget(budget); setBudgetLimit(budget.amount.toString()); setSelectedBudgetCategory(budget.category); setIsBudgetModalOpen(true); }} className="p-1 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                                                        <button
                                                            onClick={() => {
                                                                if (window.confirm("Bạn có chắc chắn muốn xóa ngân sách này?")) {
                                                                    onDeleteBudget(budget.id);
                                                                }
                                                            }}
                                                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col sm:flex-row justify-between text-[10px] md:text-xs font-medium text-gray-500 mb-1.5 mt-2 gap-0.5">
                                                    <span className="truncate">Đã chi: <span className={isOver ? 'text-red-600 font-bold' : 'text-gray-900 font-bold'}>{formatCurrency(spent, lang)}</span></span>
                                                    <span className="text-gray-400 sm:text-right shrink-0">/ {formatCurrency(budget.amount, lang)}</span>
                                                </div>

                                                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden shadow-inner">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-700 ease-out shadow-sm ${isOver ? 'bg-gradient-to-r from-red-500 to-rose-600' : percent > 80 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 'bg-gradient-to-r from-emerald-400 to-teal-500'}`}
                                                        style={{ width: `${Math.min(percent, 100)}%` }}
                                                    />
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            );
                        })}

                    {(!state.budgets || state.budgets.filter(b => b.month === `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`).length === 0) && (
                        <div className="col-span-2 text-center py-6 border-2 border-dashed border-gray-100 rounded-xl">
                            <div className="w-10 h-10 bg-sky-50 rounded-full flex items-center justify-center mx-auto mb-2 text-sky-400">
                                <DollarSign size={20} />
                            </div>
                            <p className="text-gray-400 text-sm">Chưa thiết lập ngân sách</p>
                            <button onClick={() => setIsBudgetModalOpen(true)} className="mt-2 text-sky-600 text-xs font-bold hover:underline">Thêm ngay</button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // ========== REPORT TAB ==========
    const [reportPeriod, setReportPeriod] = useState<'month' | 'quarter' | 'year'>('month');
    const [reportYear, setReportYear] = useState(today.getFullYear());
    const [reportQuarter, setReportQuarter] = useState(Math.ceil((today.getMonth() + 1) / 3));
    const [reportMonth, setReportMonth] = useState(today.getMonth());
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

    const renderReport = () => {
        // Filter transactions by selected period
        const getFilteredTx = () => {
            return transactions.filter(t => {
                if (t.category === 'Điều chỉnh số dư') return false;
                const d = new Date(t.date);
                if (reportPeriod === 'month') {
                    return d.getFullYear() === reportYear && d.getMonth() === reportMonth;
                } else if (reportPeriod === 'quarter') {
                    const q = Math.ceil((d.getMonth() + 1) / 3);
                    return d.getFullYear() === reportYear && q === reportQuarter;
                } else {
                    return d.getFullYear() === reportYear;
                }
            });
        };

        const filteredTx = getFilteredTx();
        const totalIncome = filteredTx.filter(t => t.type === TransactionType.INCOME).reduce((a, b) => a + b.amount, 0);
        const totalExpense = filteredTx.filter(t => t.type === TransactionType.EXPENSE).reduce((a, b) => a + b.amount, 0);
        const netSavings = totalIncome - totalExpense;
        const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

        // Chart data: monthly breakdown within selected period
        const getChartData = () => {
            const map: Record<string, { income: number; expense: number }> = {};
            filteredTx.forEach(t => {
                const d = new Date(t.date);
                const key = `T${d.getMonth() + 1}`;
                if (!map[key]) map[key] = { income: 0, expense: 0 };
                if (t.type === TransactionType.INCOME) map[key].income += t.amount;
                else map[key].expense += t.amount;
            });
            return Object.entries(map).sort(([a], [b]) => {
                const na = parseInt(a.replace('T', '')); const nb = parseInt(b.replace('T', ''));
                return na - nb;
            }).map(([name, data]) => ({ name, ...data, savings: data.income - data.expense }));
        };

        // Category breakdown
        const getCategoryBreakdown = (type: TransactionType) => {
            const map: Record<string, { total: number; count: number; transactions: Transaction[] }> = {};
            filteredTx.filter(t => t.type === type).forEach(t => {
                if (!map[t.category]) map[t.category] = { total: 0, count: 0, transactions: [] };
                map[t.category].total += t.amount;
                map[t.category].count++;
                map[t.category].transactions.push(t);
            });
            const grandTotal = type === TransactionType.INCOME ? totalIncome : totalExpense;
            return Object.entries(map)
                .map(([name, d]) => ({ name, ...d, percent: grandTotal > 0 ? (d.total / grandTotal) * 100 : 0 }))
                .sort((a, b) => b.total - a.total);
        };

        const expenseBreakdown = getCategoryBreakdown(TransactionType.EXPENSE);
        const incomeBreakdown = getCategoryBreakdown(TransactionType.INCOME);
        const chartData = getChartData();

        // Pie data
        const pieData = expenseBreakdown.map(e => ({ name: e.name, value: e.total }));

        // Period label
        const getPeriodLabel = () => {
            if (reportPeriod === 'month') return `Tháng ${reportMonth + 1}/${reportYear}`;
            if (reportPeriod === 'quarter') return `Quý ${reportQuarter}/${reportYear}`;
            return `Năm ${reportYear}`;
        };

        return (
            <div className="space-y-6 animate-fade-in">
                {/* Period Selector */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <FileBarChart size={22} className="text-sky-600" /> Báo cáo Tài chính
                            </h3>
                            <p className="text-sm text-gray-500">{getPeriodLabel()}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Period Type */}
                            <div className="flex bg-gray-100 rounded-xl p-1">
                                {(['month', 'quarter', 'year'] as const).map(p => (
                                    <button key={p} onClick={() => setReportPeriod(p)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${reportPeriod === p ? 'bg-white text-sky-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                        {p === 'month' ? 'Tháng' : p === 'quarter' ? 'Quý' : 'Năm'}
                                    </button>
                                ))}
                            </div>
                            {/* Year */}
                            <div className="flex items-center bg-white border border-gray-200 rounded-xl px-2 py-1">
                                <button onClick={() => setReportYear(y => y - 1)} className="p-1 hover:bg-gray-100 rounded text-gray-400">❮</button>
                                <span className="mx-2 font-semibold text-gray-700 text-sm min-w-[40px] text-center">{reportYear}</span>
                                <button onClick={() => setReportYear(y => y + 1)} className="p-1 hover:bg-gray-100 rounded text-gray-400">❯</button>
                            </div>
                            {/* Month/Quarter picker */}
                            {reportPeriod === 'month' && (
                                <select value={reportMonth} onChange={e => setReportMonth(Number(e.target.value))}
                                    className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 outline-none">
                                    {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>Tháng {i + 1}</option>)}
                                </select>
                            )}
                            {reportPeriod === 'quarter' && (
                                <select value={reportQuarter} onChange={e => setReportQuarter(Number(e.target.value))}
                                    className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 outline-none">
                                    {[1, 2, 3, 4].map(q => <option key={q} value={q}>Quý {q}</option>)}
                                </select>
                            )}
                        </div>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Tổng thu nhập</p>
                        <p className="text-xl font-bold text-emerald-600">+{formatCurrency(totalIncome, lang)}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Tổng chi tiêu</p>
                        <p className="text-xl font-bold text-rose-600">-{formatCurrency(totalExpense, lang)}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Tiết kiệm ròng</p>
                        <p className={`text-xl font-bold ${netSavings >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(netSavings, lang)}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Tỷ lệ tiết kiệm</p>
                        <p className={`text-xl font-bold ${savingsRate >= 20 ? 'text-emerald-600' : savingsRate >= 0 ? 'text-amber-600' : 'text-red-600'}`}>{savingsRate}%</p>
                    </div>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Bar Chart */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h4 className="font-bold text-gray-800 mb-4">Biểu đồ Thu - Chi {reportPeriod === 'month' ? '' : `(${getPeriodLabel()})`}</h4>
                        <div className="h-72 w-full">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} barGap={8}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(v: number | undefined) => formatCurrency(v || 0, lang)} />
                                        <Legend iconType="circle" />
                                        <Bar dataKey="income" name="Thu nhập" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={40} />
                                        <Bar dataKey="expense" name="Chi tiêu" fill="#EF4444" radius={[6, 6, 0, 0]} maxBarSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400 text-sm">Không có dữ liệu trong kỳ này</div>
                            )}
                        </div>
                    </div>

                    {/* Pie Chart */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h4 className="font-bold text-gray-800 mb-4">Cơ cấu Chi tiêu</h4>
                        <div className="h-48 w-full">
                            {pieData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                                            {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v: number | undefined) => formatCurrency(v || 0, lang)} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400 text-sm">Chưa có dữ liệu</div>
                            )}
                        </div>
                        <div className="space-y-1.5 mt-3 max-h-32 overflow-y-auto scrollbar-thin">
                            {expenseBreakdown.map((e, i) => (
                                <div key={e.name} className="flex justify-between text-xs">
                                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>{e.name}</span>
                                    <span className="font-semibold">{Math.round(e.percent)}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Detailed Breakdown Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-100">
                        <h4 className="font-bold text-gray-800">Chi tiết theo Danh mục</h4>
                        <p className="text-xs text-gray-500 mt-1">{getPeriodLabel()} — Nhấn vào danh mục để xem giao dịch</p>
                    </div>

                    {/* Expense Section */}
                    {expenseBreakdown.length > 0 && (
                        <div>
                            <div className="px-5 py-3 bg-red-50 border-b border-red-100">
                                <span className="text-sm font-bold text-red-700">Chi tiêu ({formatCurrency(totalExpense, lang)})</span>
                            </div>
                            {expenseBreakdown.map((cat, idx) => (
                                <div key={cat.name}>
                                    <button onClick={() => setExpandedCategory(expandedCategory === `e-${cat.name}` ? null : `e-${cat.name}`)}
                                        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 text-left">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                            <span className="text-sm font-medium text-gray-800">{cat.name}</span>
                                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">{cat.count} giao dịch</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-bold text-gray-900">{formatCurrency(cat.total, lang)}</span>
                                            <span className="text-xs text-gray-400 w-10 text-right">{Math.round(cat.percent)}%</span>
                                            {expandedCategory === `e-${cat.name}` ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                                        </div>
                                    </button>
                                    {expandedCategory === `e-${cat.name}` && (
                                        <div className="bg-gray-50 border-b border-gray-100">
                                            <table className="w-full text-xs">
                                                <thead><tr className="text-gray-400 uppercase"><th className="px-8 py-2 text-left">Ngày</th><th className="px-3 py-2 text-left">Mô tả</th><th className="px-3 py-2 text-right">Số tiền</th></tr></thead>
                                                <tbody>
                                                    {cat.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => (
                                                        <tr key={t.id} className="border-t border-gray-100 hover:bg-white transition-colors">
                                                            <td className="px-8 py-2 text-gray-500">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                                                            <td className="px-3 py-2 text-gray-700">{t.description || '—'}</td>
                                                            <td className="px-3 py-2 text-right font-bold text-red-600">-{formatCurrency(t.amount, lang)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Income Section */}
                    {incomeBreakdown.length > 0 && (
                        <div>
                            <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100">
                                <span className="text-sm font-bold text-emerald-700">Thu nhập ({formatCurrency(totalIncome, lang)})</span>
                            </div>
                            {incomeBreakdown.map(cat => (
                                <div key={cat.name}>
                                    <button onClick={() => setExpandedCategory(expandedCategory === `i-${cat.name}` ? null : `i-${cat.name}`)}
                                        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 text-left">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                                            <span className="text-sm font-medium text-gray-800">{cat.name}</span>
                                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">{cat.count} giao dịch</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-bold text-emerald-600">+{formatCurrency(cat.total, lang)}</span>
                                            <span className="text-xs text-gray-400 w-10 text-right">{Math.round(cat.percent)}%</span>
                                            {expandedCategory === `i-${cat.name}` ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                                        </div>
                                    </button>
                                    {expandedCategory === `i-${cat.name}` && (
                                        <div className="bg-gray-50 border-b border-gray-100">
                                            <table className="w-full text-xs">
                                                <thead><tr className="text-gray-400 uppercase"><th className="px-8 py-2 text-left">Ngày</th><th className="px-3 py-2 text-left">Mô tả</th><th className="px-3 py-2 text-right">Số tiền</th></tr></thead>
                                                <tbody>
                                                    {cat.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => (
                                                        <tr key={t.id} className="border-t border-gray-100 hover:bg-white transition-colors">
                                                            <td className="px-8 py-2 text-gray-500">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                                                            <td className="px-3 py-2 text-gray-700">{t.description || '—'}</td>
                                                            <td className="px-3 py-2 text-right font-bold text-emerald-600">+{formatCurrency(t.amount, lang)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {filteredTx.length === 0 && (
                        <div className="py-16 text-center text-gray-400">
                            <FileBarChart size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="font-medium">Không có giao dịch nào trong {getPeriodLabel()}</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const handleTransferSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!transferFrom || !transferTo || !transferAmount) {
            alert('Vui lòng điền đầy đủ thông tin!');
            return;
        }
        if (transferFrom === transferTo) {
            alert('Ví gửi và ví nhận không được trùng nhau!');
            return;
        }
        const amount = Number(transferAmount);
        if (isNaN(amount) || amount <= 0) {
            alert('Số tiền chuyển không hợp lệ!');
            return;
        }

        const fromWallet = state.wallets.find(w => w.id === transferFrom);
        if (fromWallet && fromWallet.balance < amount) {
            if (!window.confirm('Số dư ví gửi không đủ. Bạn vẫn muốn tiếp tục chuyển?')) {
                return;
            }
        }

        await onTransferMoney(transferFrom, transferTo, amount, transferNote.trim() || undefined);

        setTransferFrom('');
        setTransferTo('');
        setTransferAmount('');
        setTransferNote('');
    };

    const renderWallets = () => {
        // Calculate totals
        const totalIncludedBalance = state.wallets
            .filter(w => w.include_in_total)
            .reduce((sum, w) => sum + Number(w.balance), 0);

        const realWallets = state.wallets.filter(w => w.type !== 'fund');
        const fundWallets = state.wallets.filter(w => w.type === 'fund');

        return (
            <div className="space-y-6 animate-fade-in">
                {/* Header & Total Stats */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <WalletIcon className="text-sky-600" size={22} />
                            Quản lý Ví & Quỹ tài chính
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">Phân bổ nguồn tiền và theo dõi quỹ mục đích chi tiết</p>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center w-full md:w-auto">
                        <div className="bg-sky-50/50 border border-sky-100 rounded-xl px-5 py-3 text-left">
                            <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider block">Tổng tiền trong các Ví</span>
                            <span className="text-xl font-extrabold text-sky-800 mt-0.5 block font-sans">
                                {hideBalance ? '••••••' : formatCurrency(totalIncludedBalance, lang)}
                            </span>
                        </div>
                        <button
                            onClick={() => {
                                setEditingWallet(null);
                                setWalletName('');
                                setWalletType('cash');
                                setWalletBalance('');
                                setWalletColor('#3B82F6');
                                setWalletIcon('Wallet');
                                setWalletIncludeInTotal(true);
                                setIsAddWalletModalOpen(true);
                            }}
                            className="bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-sm px-4 py-3 rounded-xl shadow-md shadow-sky-200 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus size={16} /> Tạo Ví / Quỹ mới
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Wallets & Funds Grid */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Real Wallets Section */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Tài khoản & Ví thực tế ({realWallets.length})</h4>
                            {realWallets.length === 0 ? (
                                <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center text-gray-400 text-sm">
                                    Bạn chưa tạo tài khoản thanh toán nào. Nhấn "+ Tạo Ví / Quỹ mới" để thêm.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {realWallets.map(w => {
                                        const WalletTypeIcon =
                                            w.type === 'bank' ? Landmark :
                                                w.type === 'credit' ? CreditCard :
                                                    w.type === 'savings' ? PiggyBank :
                                                        w.type === 'e-wallet' ? WalletIcon : Coins;

                                        return (
                                            <div
                                                key={w.id}
                                                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200"
                                                style={{ borderLeft: `4px solid ${w.color}` }}
                                            >
                                                <div className="p-4 flex justify-between items-start">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2.5 rounded-xl bg-gray-50 flex items-center justify-center" style={{ color: w.color }}>
                                                            <WalletTypeIcon size={18} />
                                                        </div>
                                                        <div>
                                                            <h5 className="font-bold text-sm text-gray-800">{w.name}</h5>
                                                            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                                                                {w.type === 'bank' ? 'Ngân hàng' :
                                                                    w.type === 'credit' ? 'Thẻ tín dụng' :
                                                                        w.type === 'savings' ? 'Tiết kiệm' :
                                                                            w.type === 'e-wallet' ? 'Ví điện tử' : 'Tiền mặt'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedWalletForHistory(w);
                                                                setIsWalletHistoryModalOpen(true);
                                                            }}
                                                            className="text-gray-400 hover:text-sky-600 p-1.5 rounded-lg hover:bg-gray-50 transition"
                                                            title="Lịch sử giao dịch"
                                                        >
                                                            <FileText size={13} />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setEditingWallet(w);
                                                                setWalletName(w.name);
                                                                setWalletType(w.type);
                                                                setWalletBalance(w.initial_balance.toString());
                                                                setWalletCurrentBalance(w.balance.toString());
                                                                setWalletColor(w.color);
                                                                setWalletIcon(w.icon);
                                                                setWalletIncludeInTotal(w.include_in_total);
                                                                setIsAddWalletModalOpen(true);
                                                            }}
                                                            className="text-gray-400 hover:text-sky-600 p-1.5 rounded-lg hover:bg-gray-50 transition"
                                                            title="Sửa"
                                                        >
                                                            <Edit2 size={13} />
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                if (window.confirm(`Bạn có chắc muốn xóa ví "${w.name}"?`)) {
                                                                    await onDeleteWallet(w.id);
                                                                }
                                                            }}
                                                            className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-gray-50 transition"
                                                            title="Xóa"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="px-4 pb-4 pt-1 flex justify-between items-end border-t border-gray-50 mt-2">
                                                    <div>
                                                        <span className="text-[9px] text-gray-400 font-bold block">Số dư</span>
                                                        <span className="text-base font-extrabold text-gray-800 font-sans">
                                                            {hideBalance ? '••••••' : formatCurrency(w.balance, lang)}
                                                        </span>
                                                    </div>
                                                    {!w.include_in_total && (
                                                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                                                            Không tính vào tổng
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Purpose-based Funds Section */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Quỹ mục đích & Tiêu dùng ({fundWallets.length})</h4>
                            {fundWallets.length === 0 ? (
                                <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center text-gray-400 text-sm">
                                    Chưa có quỹ chi tiêu nào được thiết lập. Thêm quỹ để giới hạn chi tiêu (ví dụ: Quỹ du lịch 2tr).
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {fundWallets.map(w => {
                                        const spent = Number(w.initial_balance) - Number(w.balance);
                                        const limit = Number(w.initial_balance);
                                        const percent = limit > 0 ? Math.min(Math.max((spent / limit) * 100, 0), 100) : 0;

                                        return (
                                            <div
                                                key={w.id}
                                                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200"
                                                style={{ borderLeft: `4px solid ${w.color}` }}
                                            >
                                                <div className="p-4">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2.5 rounded-xl bg-gray-50 flex items-center justify-center" style={{ color: w.color }}>
                                                                <Briefcase size={18} />
                                                            </div>
                                                            <div>
                                                                <h5 className="font-bold text-sm text-gray-800">{w.name}</h5>
                                                                <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">
                                                                    Quỹ ngân sách
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedWalletForHistory(w);
                                                                    setIsWalletHistoryModalOpen(true);
                                                                }}
                                                                className="text-gray-400 hover:text-sky-600 p-1.5 rounded-lg hover:bg-gray-50 transition"
                                                                title="Lịch sử giao dịch"
                                                            >
                                                                <FileText size={13} />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setEditingWallet(w);
                                                                    setWalletName(w.name);
                                                                    setWalletType(w.type);
                                                                    setWalletBalance(w.initial_balance.toString());
                                                                    setWalletCurrentBalance(w.balance.toString());
                                                                    setWalletColor(w.color);
                                                                    setWalletIcon(w.icon);
                                                                    setWalletIncludeInTotal(w.include_in_total);
                                                                    setIsAddWalletModalOpen(true);
                                                                }}
                                                                className="text-gray-400 hover:text-sky-600 p-1.5 rounded-lg hover:bg-gray-50 transition"
                                                                title="Sửa"
                                                            >
                                                                <Edit2 size={13} />
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    if (window.confirm(`Bạn có chắc muốn xóa quỹ "${w.name}"?`)) {
                                                                        await onDeleteWallet(w.id);
                                                                    }
                                                                }}
                                                                className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-gray-50 transition"
                                                                title="Xóa"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Budget Progress Bar */}
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-xs text-gray-500 font-medium">
                                                            <span>Đã dùng: {formatCurrency(Math.max(spent, 0), lang)}</span>
                                                            <span>Hạn mức: {formatCurrency(limit, lang)}</span>
                                                        </div>
                                                        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full transition-all duration-300"
                                                                style={{
                                                                    width: `${percent}%`,
                                                                    backgroundColor: percent >= 90 ? '#EF4444' : percent >= 75 ? '#F59E0B' : w.color
                                                                }}
                                                            ></div>
                                                        </div>
                                                        <div className="flex justify-between items-center text-[10px] pt-1">
                                                            <span className="font-bold text-gray-400">Tiến độ: {Math.round(percent)}%</span>
                                                            <span className={`font-black ${Number(w.balance) < 0 ? 'text-red-500 font-black' : 'text-gray-500'}`}>
                                                                {Number(w.balance) < 0
                                                                    ? `Vượt hạn mức: ${formatCurrency(Math.abs(Number(w.balance)), lang)} ⚠️`
                                                                    : `Còn lại: ${formatCurrency(Number(w.balance), lang)}`
                                                                }
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Internal Transfer Widget */}
                    <div className="space-y-6">
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                            <h4 className="font-bold text-sm text-gray-800 flex items-center gap-2 mb-4">
                                <ArrowRightLeft className="text-indigo-600" size={16} />
                                Chuyển tiền nội bộ
                            </h4>

                            <form onSubmit={handleTransferSubmit} className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-1 mb-1">Ví chuyển đi</label>
                                    <select
                                        value={transferFrom}
                                        onChange={(e) => setTransferFrom(e.target.value)}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold outline-none cursor-pointer text-gray-700"
                                        required
                                    >
                                        <option value="">-- Chọn ví nguồn --</option>
                                        {state.wallets.map(w => (
                                            <option key={w.id} value={w.id}>{w.name} ({formatCurrency(w.balance, lang)})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-1 mb-1">Ví nhận đến</label>
                                    <select
                                        value={transferTo}
                                        onChange={(e) => setTransferTo(e.target.value)}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold outline-none cursor-pointer text-gray-700"
                                        required
                                    >
                                        <option value="">-- Chọn ví nhận --</option>
                                        {state.wallets.map(w => (
                                            <option key={w.id} value={w.id}>{w.name} ({formatCurrency(w.balance, lang)})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-1 mb-1">Số tiền chuyển</label>
                                    <input
                                        type="number"
                                        required
                                        value={transferAmount}
                                        onChange={(e) => setTransferAmount(e.target.value)}
                                        placeholder="0"
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none"
                                    />
                                    <div className="text-right text-xs text-sky-600 font-bold mt-1">
                                        {transferAmount && !isNaN(Number(transferAmount)) && formatCurrency(Number(transferAmount), lang)}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-1 mb-1">Ghi chú chuyển khoản</label>
                                    <input
                                        value={transferNote}
                                        onChange={(e) => setTransferNote(e.target.value)}
                                        placeholder="Ví dụ: Rút tiền ATM, Nạp Momo..."
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold outline-none"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-100 transition-all active:scale-98"
                                >
                                    Thực hiện chuyển khoản ⚡
                                </button>
                            </form>
                        </div>
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
                    ${isSelected ? 'border-2 border-sky-500 bg-sky-50' : 'border-gray-100 bg-white hover:bg-gray-50'}
                `}
                >
                    <div className={`text-xs md:text-sm font-semibold mb-1 ${isToday ? 'bg-sky-600 text-white w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center' : 'text-gray-700'} ml-1 mt-1`}>
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
                                                    <button onClick={() => openEditModal(t)} className="p-1.5 text-gray-400 hover:text-sky-600 bg-gray-50 hover:bg-sky-50 rounded-lg transition-colors" title="Sửa">
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
                        ) : null}
                    </div>
                )}
            </div>
        );
    };

    const renderHistory = () => {
        // Filter transactions for history view
        const filteredTransactions = transactions.filter(t => {
            const d = new Date(t.date);
            const matchMonth = d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
            const matchCategory = selectedCategoryFilter === 'all' || t.category === selectedCategoryFilter;
            const matchType = !activeStatsCard || t.type === (activeStatsCard === 'income' ? TransactionType.INCOME : TransactionType.EXPENSE);

            return matchMonth && matchCategory && matchType;
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
                    <div className="flex items-center gap-3 relative flex-wrap">
                        {/* Type Segment Control */}
                        <div className="flex bg-gray-100/80 p-0.5 rounded-lg text-xs font-bold border border-gray-200/50 shadow-inner">
                            <button
                                onClick={() => setActiveStatsCard(null)}
                                className={`px-2.5 py-1.5 rounded-md transition-all ${!activeStatsCard ? 'bg-white text-sky-700 shadow-sm border border-gray-200/20' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Tất cả
                            </button>
                            <button
                                onClick={() => setActiveStatsCard('income')}
                                className={`px-2.5 py-1.5 rounded-md transition-all ${activeStatsCard === 'income' ? 'bg-white text-emerald-600 shadow-sm border border-gray-200/20' : 'text-gray-500 hover:text-emerald-600'}`}
                            >
                                Thu
                            </button>
                            <button
                                onClick={() => setActiveStatsCard('expense')}
                                className={`px-2.5 py-1.5 rounded-md transition-all ${activeStatsCard === 'expense' ? 'bg-white text-rose-600 shadow-sm border border-gray-200/20' : 'text-gray-500 hover:text-rose-600'}`}
                            >
                                Chi
                            </button>
                        </div>

                        {/* Category Filter */}
                        <div className="relative">
                            <button
                                onClick={() => setShowFilterMenu(!showFilterMenu)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${selectedCategoryFilter !== 'all' ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                            >
                                <Filter size={14} />
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
                                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${selectedCategoryFilter === 'all' ? 'font-bold text-sky-600 bg-sky-50' : 'text-gray-700'}`}
                                        >
                                            Tất cả danh mục
                                        </button>
                                        <div className="my-1 border-t border-gray-100"></div>
                                        <div className="px-4 py-1 text-xs font-bold text-gray-400 uppercase tracking-wider">Chi tiêu</div>
                                        {expenseCategories.map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => { setSelectedCategoryFilter(cat); setShowFilterMenu(false); }}
                                                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${selectedCategoryFilter === cat ? 'font-bold text-sky-600 bg-sky-50' : 'text-gray-700'}`}
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
                                                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${selectedCategoryFilter === cat ? 'font-bold text-sky-600 bg-sky-50' : 'text-gray-700'}`}
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
                                <tr key={t.id} className="hover:bg-sky-50/30 transition-colors group border-b border-gray-100">
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
                                            <button onClick={() => openEditModal(t)} className="p-1.5 md:p-2 text-gray-400 hover:text-sky-600 hover:bg-white border border-transparent hover:border-sky-100 rounded-lg transition-all shadow-sm" title="Sửa">
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
            </div>
        );
    };

    // Helper icon for empty state
    const SearchOffIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m13.5 8.5-5 5" /><path d="m8.5 8.5 5 5" /><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
    )

    return (
        <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="w-full overflow-x-hidden px-3 md:px-8 pt-4 md:pt-8 space-y-4 md:space-y-6 animate-fade-in pb-36 md:pb-20 relative min-h-[500px]"
        >
            {/* Pull to Refresh Spinner */}
            <div
                className="absolute left-0 right-0 flex justify-center pointer-events-none transition-all duration-200 z-[100]"
                style={{
                    top: `${pullDistance - 40}px`,
                    opacity: pullDistance > 10 ? Math.min(pullDistance / 50, 1) : 0
                }}
            >
                <div className="bg-white rounded-full p-2.5 shadow-lg border border-gray-100 flex items-center justify-center">
                    <Loader2
                        className={`text-sky-600 ${isRefreshing ? 'animate-spin' : ''}`}
                        size={20}
                        style={{ transform: `rotate(${pullDistance * 4}deg)` }}
                    />
                </div>
            </div>

            {/* Top Header & Actions */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3.5 md:gap-4 w-full">
                <div className="w-full lg:w-auto">
                    <div className="flex items-center justify-between lg:justify-start gap-3 w-full">
                        <h2 className="text-2xl font-bold text-gray-800"> Tổng quan tài chính </h2>
                        {/* Notebook Gray Circular Background Icon for Debtor Ledger */}
                        <button
                            onClick={() => setIsDebtorLedgerOpen(true)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-xl transition-all duration-200 shadow-sm flex items-center justify-center shrink-0"
                            title="Sổ nợ mini"
                        >
                            <BookOpen size={18} />
                        </button>
                    </div>
                    <p className="text-gray-400 text-sm">Manage Your Assets Wisely </p>
                </div>
                <div className="flex flex-wrap gap-2.5 md:gap-3 items-center w-full lg:w-auto justify-between lg:justify-end">
                    {/* Unified Selector Toolbar: Month Picker + View Switcher */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-gray-200/80 shadow-sm w-full md:w-auto justify-between md:justify-start">
                        {/* Compact Month Picker Button */}
                        <button
                            onClick={() => setIsMonthPickerOpen(true)}
                            className="flex items-center justify-center gap-1.5 px-3 h-10 rounded-xl bg-gray-50 hover:bg-sky-50 hover:text-sky-600 text-gray-700 font-bold transition-all border border-gray-200 shrink-0 text-xs"
                            title="Chọn tháng/năm"
                        >
                            <CalendarDays size={14} className="text-sky-500" />
                            <span>T{selectedMonth + 1}/{selectedYear}</span>
                        </button>

                        {/* Divider Line */}
                        <div className="w-[1px] h-6 bg-gray-200 mx-1 shrink-0"></div>

                        {/* 5 Switcher Sub-Tabs */}
                        <div className="flex flex-1 md:flex-initial gap-0.5 justify-around md:justify-start">
                            <button
                                onClick={() => setViewMode('overview')}
                                className={`flex items-center justify-center gap-1 h-10 px-2 md:px-3 rounded-xl transition-all duration-300 ${viewMode === 'overview' ? 'bg-sky-50 text-sky-700 font-bold shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
                                title="Tổng quan"
                            >
                                <LayoutDashboard size={16} />
                                {viewMode === 'overview' && <span className="text-[11px] md:text-xs font-bold whitespace-nowrap animate-in fade-in slide-in-from-left-1 duration-200">Tổng quan</span>}
                            </button>
                            <button
                                onClick={() => setViewMode('wallets')}
                                className={`flex items-center justify-center gap-1 h-10 px-2 md:px-3 rounded-xl transition-all duration-300 ${viewMode === 'wallets' ? 'bg-sky-50 text-sky-700 font-bold shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
                                title="Ví & Quỹ"
                            >
                                <WalletIcon size={16} />
                                {viewMode === 'wallets' && <span className="text-[11px] md:text-xs font-bold whitespace-nowrap animate-in fade-in slide-in-from-left-1 duration-200">Ví & Quỹ</span>}
                            </button>
                            <button
                                onClick={() => setViewMode('calendar')}
                                className={`flex items-center justify-center gap-1 h-10 px-2 md:px-3 rounded-xl transition-all duration-300 ${viewMode === 'calendar' ? 'bg-sky-50 text-sky-700 font-bold shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
                                title="Xem lịch theo ngày"
                            >
                                <CalendarDays size={16} />
                                {viewMode === 'calendar' && <span className="text-[11px] md:text-xs font-bold whitespace-nowrap animate-in fade-in slide-in-from-left-1 duration-200">Lịch ngày</span>}
                            </button>
                            <button
                                onClick={() => setViewMode('history')}
                                className={`flex items-center justify-center gap-1 h-10 px-2 md:px-3 rounded-xl transition-all duration-300 ${viewMode === 'history' ? 'bg-sky-50 text-sky-700 font-bold shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
                                title="Lịch sử"
                            >
                                <List size={16} />
                                {viewMode === 'history' && <span className="text-[11px] md:text-xs font-bold whitespace-nowrap animate-in fade-in slide-in-from-left-1 duration-200">Lịch sử</span>}
                            </button>
                            <button
                                onClick={() => setViewMode('report')}
                                className={`flex items-center justify-center gap-1 h-10 px-2 md:px-3 rounded-xl transition-all duration-300 ${viewMode === 'report' ? 'bg-sky-50 text-sky-700 font-bold shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
                                title="Báo cáo"
                            >
                                <FileBarChart size={16} />
                                {viewMode === 'report' && <span className="text-[11px] md:text-xs font-bold whitespace-nowrap animate-in fade-in slide-in-from-left-1 duration-200">Báo cáo</span>}
                            </button>
                        </div>
                    </div>

                    {/* Desktop Quick Actions: Placed right on the same line as tab category on desktop */}
                    <div className="hidden md:flex items-center gap-2 shrink-0">
                        {/* AI Analysis Button */}
                        <button
                            type="button"
                            onClick={handleAnalyzeFinance}
                            className="h-10 px-3.5 rounded-xl font-bold bg-purple-50 text-purple-700 border border-purple-200/80 hover:bg-purple-100 hover:border-purple-300 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm hover:shadow active:scale-95 text-xs"
                            title="AI Own - Phân tích tài chính"
                        >
                            <Bot size={16} className="text-purple-600" />
                            <span>AI Own</span>
                        </button>

                        {/* Recurring Transactions Button */}
                        <button
                            type="button"
                            onClick={() => setIsRecurringModalOpen(true)}
                            className="h-10 px-3.5 rounded-xl font-bold bg-white text-gray-700 border border-gray-200/80 hover:bg-gray-50 hover:text-sky-600 hover:border-gray-300 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap relative shadow-sm hover:shadow active:scale-95 text-xs"
                            title="Khoản cố định hàng tháng"
                        >
                            <Repeat size={15} className="text-gray-600" />
                            <span>Khoản cố định</span>
                            {recurringItems.filter(i => i.status === 'active' && i.last_applied_month !== `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`).length > 0 && (
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white absolute -top-1 -right-1 animate-pulse"></span>
                            )}
                        </button>

                        {/* Add Transaction Button */}
                        <button
                            type="button"
                            onClick={() => {
                                setEditingTransaction(null);
                                setIsModalOpen(true);
                            }}
                            className="h-10 px-4 rounded-xl font-bold bg-sky-500 hover:bg-sky-600 text-white transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm shadow-sky-200 hover:shadow-md active:scale-95 text-xs"
                            title="Thêm giao dịch mới"
                        >
                            <Plus size={16} className="stroke-[2.5]" />
                            <span>Thêm giao dịch</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Stats Cards */}
            {/* Main Stats Cards - Compact & Minimal */}
            {viewMode === 'overview' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                    {/* Balance Card - Luxurious Circle */}
                    <div className="col-span-2 md:col-span-1 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center relative overflow-hidden group">
                        {/* Decorative Circle */}
                        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br from-sky-500/20 to-blue-500/20 blur-xl"></div>
                        <div className="absolute right-2 top-2 w-12 h-12 rounded-full border border-sky-50/50"></div>

                        <button
                            onClick={() => setIsBalanceModalOpen(true)}
                            className="absolute top-2 right-4 text-gray-300 hover:text-sky-600 transition-colors p-1"
                        >
                            <Edit2 size={16} />
                        </button>

                        <div className="flex items-center gap-1.5 relative z-10 mb-1">
                            <p className="text-gray-400 font-bold text-[10px] uppercase tracking-wider">Số dư khả dụng</p>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setHideBalance(!hideBalance); }}
                                className="text-gray-400 hover:text-sky-600 transition-colors p-0.5 rounded-md hover:bg-sky-50/50"
                                title={hideBalance ? "Hiện số tiền" : "Ẩn số tiền"}
                            >
                                {hideBalance ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight text-gray-900 relative z-10">
                            {hideBalance ? '••••••' : formatCurrency(stats.totalBalance, lang)}
                        </h3>

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
                        <h3 className="text-xl md:text-2xl font-bold tracking-tight text-emerald-600">
                            {hideBalance ? '••••••' : `+${formatCurrency(stats.currentMonthIncome, lang)}`}
                        </h3>
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
                        <h3 className="text-xl md:text-2xl font-bold tracking-tight text-rose-600">
                            {hideBalance ? '••••••' : `-${formatCurrency(stats.currentMonthExpense, lang)}`}
                        </h3>
                    </button>
                </div>
            )}

            {/* Quick Action Buttons (Mobile only: Placed right below Income & Expense cards, above Budget & Recurring) */}
            {viewMode === 'overview' && (
                <div className="flex md:hidden items-center gap-2.5 mb-4 w-full">
                    {/* AI Analysis Button */}
                    <button
                        type="button"
                        onClick={handleAnalyzeFinance}
                        className="flex-1 sm:flex-initial h-10 px-3 rounded-xl font-bold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                        title="AI Own - Phân tích tài chính"
                    >
                        <Bot size={16} />
                        <span className="hidden sm:inline text-xs font-bold">AI Own</span>
                    </button>

                    {/* Recurring Transactions Button */}
                    <button
                        type="button"
                        onClick={() => setIsRecurringModalOpen(true)}
                        className="flex-1 sm:flex-initial h-10 px-3 rounded-xl font-bold bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:text-sky-600 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap relative"
                        title="Khoản cố định hàng tháng"
                    >
                        <Repeat size={15} className="text-gray-600" />
                        <span className="hidden sm:inline text-xs font-bold">Khoản cố định</span>
                        {recurringItems.filter(i => i.status === 'active' && i.last_applied_month !== `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`).length > 0 && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 absolute top-2 right-2"></span>
                        )}
                    </button>

                    {/* Add Transaction Button */}
                    <button
                        type="button"
                        onClick={() => {
                            setEditingTransaction(null);
                            setIsModalOpen(true);
                        }}
                        className="flex-1 sm:flex-initial h-10 px-3.5 rounded-xl font-bold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                        title="Thêm giao dịch"
                    >
                        <Plus size={16} />
                        <span className="hidden sm:inline text-xs font-bold">Thêm giao dịch</span>
                    </button>
                </div>
            )}

            {/* In other view modes on Mobile, show quick actions toolbar */}
            {viewMode !== 'overview' && (
                <div className="flex md:hidden items-center gap-2 mb-4 w-full justify-end">
                    <button
                        type="button"
                        onClick={handleAnalyzeFinance}
                        className="h-10 px-3 rounded-xl font-bold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                        title="AI Own - Phân tích tài chính"
                    >
                        <Bot size={16} />
                        <span className="hidden sm:inline text-xs font-bold">AI Own</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsRecurringModalOpen(true)}
                        className="h-10 px-3 rounded-xl font-bold bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:text-sky-600 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap relative"
                        title="Khoản cố định hàng tháng"
                    >
                        <Repeat size={15} className="text-gray-600" />
                        <span className="hidden sm:inline text-xs font-bold">Khoản cố định</span>
                        {recurringItems.filter(i => i.status === 'active' && i.last_applied_month !== `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`).length > 0 && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 absolute top-2 right-2"></span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setEditingTransaction(null);
                            setIsModalOpen(true);
                        }}
                        className="h-10 px-3.5 rounded-xl font-bold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                        title="Thêm giao dịch"
                    >
                        <Plus size={16} />
                        <span className="hidden sm:inline text-xs font-bold">Thêm giao dịch</span>
                    </button>
                </div>
            )}

            {/* Recurring / Fixed Monthly Expenses Widget */}
            {viewMode === 'overview' && (() => {
                const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
                const activeRecurring = recurringItems.filter(i => i.status === 'active');
                const unappliedCount = activeRecurring.filter(i => i.last_applied_month !== monthStr).length;
                const totalActiveAmount = activeRecurring.reduce((s, i) => s + (i.type === TransactionType.EXPENSE ? i.amount : 0), 0);

                if (recurringItems.length === 0) return null;

                return (
                    <div className="md:hidden bg-gray-50/70 p-3.5 rounded-2xl border border-gray-200/80 mb-4">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-gray-200/70 text-gray-700 flex items-center justify-center shrink-0">
                                    <Repeat size={15} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-xs md:text-sm font-bold text-gray-800">
                                            Khoản cố định T{selectedMonth + 1}
                                        </h4>
                                        {unappliedCount > 0 ? (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                                                {unappliedCount} chưa ghi
                                            </span>
                                        ) : activeRecurring.length > 0 ? (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                                                Đã ghi sổ
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                        {activeRecurring.length} khoản • {formatCurrency(totalActiveAmount, lang)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {unappliedCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setIsRecurringModalOpen(true)}
                                        className="px-3 py-1.5 bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 rounded-xl text-xs font-bold transition-colors"
                                    >
                                        Áp dụng T{selectedMonth + 1}
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setIsRecurringModalOpen(true)}
                                    className="px-3 py-1.5 bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-xl text-xs font-medium transition-colors"
                                >
                                    Quản lý
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Budget Section */}
            {viewMode === 'overview' && renderBudgets()}

            {/* Mobile Wallet Widget */}
            {viewMode === 'overview' && (() => {
                const totalWalletsBalance = state.wallets
                    .filter(w => w.type !== 'fund')
                    .reduce((sum, w) => sum + Number(w.balance), 0);
                const totalFundsBalance = state.wallets
                    .filter(w => w.type === 'fund')
                    .reduce((sum, w) => sum + Number(w.balance), 0);
                
                const walletLabel = lang === 'vi' ? 'Ví' : lang === 'ko' ? '지갑' : 'Wallets';
                const fundLabel = lang === 'vi' ? 'Quỹ' : lang === 'ko' ? '기금' : 'Funds';
                const walletsAndFundsTitle = lang === 'vi' ? 'Ví & Quỹ chi tiêu' : lang === 'ko' ? '지갑 및 기금' : 'Wallets & Funds';
                const viewDetailLabel = lang === 'vi' ? 'Xem chi tiết' : lang === 'ko' ? '자세히 보기' : 'View Details';

                return (
                    <div className="md:hidden w-full px-1">
                        <button
                            onClick={() => setViewMode('wallets')}
                            className="w-full bg-white text-gray-800 p-4 rounded-2xl border border-gray-100 hover:border-sky-100 hover:shadow-md flex justify-between items-center transition-all duration-300 shadow-sm active:scale-98 text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shadow-sm">
                                    <WalletIcon size={18} className="text-sky-600" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-gray-800">{walletsAndFundsTitle}</div>
                                    <div className="text-[11px] text-gray-500 font-semibold mt-0.5 flex items-center gap-1.5">
                                        <span>
                                            {walletLabel}: <span className="text-emerald-600">{hideBalance ? '••••••' : formatCurrency(totalWalletsBalance, lang)}</span>
                                        </span>
                                        <span className="text-gray-300">|</span>
                                        <span>
                                            {fundLabel}: <span className="text-indigo-600">{hideBalance ? '••••••' : formatCurrency(totalFundsBalance, lang)}</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-xs font-extrabold text-indigo-600">{viewDetailLabel}</span>
                                <ChevronDown size={14} className="text-indigo-600 -rotate-90" />
                            </div>
                        </button>
                    </div>
                );
            })()}

            {/* AI Analysis Modal */}
            {
                (isAnalyzing || aiInsight) && (
                    <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl relative overflow-hidden">
                            {/* Decoration */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-500 via-blue-500 to-teal-500"></div>

                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    <Bot size={24} className="text-sky-600" />
                                    Trợ lý Tài chính AI
                                </h3>
                                <button onClick={() => { setAiInsight(null); setIsAnalyzing(false); }} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={24} /></button>
                            </div>

                            {isAnalyzing ? (
                                <div className="py-10 flex flex-col items-center justify-center text-center gap-4">
                                    <div className="w-12 h-12 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
                                    <p className="text-gray-500 font-medium animate-pulse">Đang phân tích dữ liệu chi tiêu của bạn...</p>
                                </div>
                            ) : aiInsight ? (
                                <div className="space-y-6">
                                    <div className="p-4 bg-sky-50 rounded-xl border border-sky-100">
                                        <p className="text-gray-700 leading-relaxed font-medium">"{aiInsight.insight}"</p>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                                            <Sparkles size={14} className="text-amber-500" /> Đề xuất hành động
                                        </h4>
                                        <div className="space-y-2">
                                            {aiInsight.actions.map((action, idx) => (
                                                <div key={idx} className="flex items-start gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:border-sky-200 transition-colors">
                                                    <div className="mt-1 w-5 h-5 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</div>
                                                    <p className="text-sm text-gray-700">{action}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => { setAiInsight(null); }}
                                        className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-sky-200"
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
                    <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
                        <div className="order-2 lg:order-1 lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                                <h3 className="text-lg font-bold text-gray-800">Biểu đồ Thu - Chi 6 tháng gần nhất</h3>
                                {selectedBarMonth && (
                                    <div className="flex items-center gap-1.5 text-xs bg-sky-50 text-sky-800 px-2.5 py-1 rounded-xl border border-sky-200">
                                        <span className="font-medium">
                                            Đang chọn: <strong className="font-bold">{selectedBarMonth}</strong> (Nhấn lại để xem chi tiết)
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedBarMonth(null); setSelectedBarRawKey(null); }}
                                            className="text-[11px] font-bold text-sky-600 hover:text-sky-900 ml-1"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="h-64 md:h-80 w-full min-h-[300px]" >
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                    <BarChart
                                        data={stats.monthlyChartData}
                                        barGap={8}
                                        onClick={(data: any) => {
                                            if (data && data.activePayload && data.activePayload.length > 0) {
                                                const item = data.activePayload[0].payload;
                                                handleBarMonthClick(item.name, item.rawKey);
                                            }
                                        }}
                                    >
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
                                        <Bar dataKey="income" name="Thu nhập" radius={[6, 6, 0, 0]} maxBarSize={50} cursor="pointer">
                                            {stats.monthlyChartData.map((entry, index) => {
                                                const isSelected = selectedBarMonth === entry.name;
                                                const isDimmed = selectedBarMonth !== null && !isSelected;
                                                return (
                                                    <Cell
                                                        key={`bar-inc-${index}`}
                                                        fill="url(#colorBarIncome)"
                                                        opacity={isDimmed ? 0.25 : 1}
                                                        stroke={isSelected ? '#059669' : 'none'}
                                                        strokeWidth={isSelected ? 2 : 0}
                                                        style={{ transition: 'opacity 0.25s ease' }}
                                                    />
                                                );
                                            })}
                                        </Bar>
                                        <Bar dataKey="expense" name="Chi tiêu" radius={[6, 6, 0, 0]} maxBarSize={50} cursor="pointer">
                                            {stats.monthlyChartData.map((entry, index) => {
                                                const isSelected = selectedBarMonth === entry.name;
                                                const isDimmed = selectedBarMonth !== null && !isSelected;
                                                return (
                                                    <Cell
                                                        key={`bar-exp-${index}`}
                                                        fill="url(#colorBarExpense)"
                                                        opacity={isDimmed ? 0.25 : 1}
                                                        stroke={isSelected ? '#dc2626' : 'none'}
                                                        strokeWidth={isSelected ? 2 : 0}
                                                        style={{ transition: 'opacity 0.25s ease' }}
                                                    />
                                                );
                                            })}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="order-1 lg:order-2 space-y-6">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                    <h3 className="text-lg font-bold text-gray-800">Cơ cấu chi tiêu tháng {selectedMonth + 1}</h3>
                                    {selectedPieCategory && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedPieCategory(null)}
                                            className="text-[11px] font-bold text-sky-600 hover:text-sky-800"
                                        >
                                            ✕ Bỏ chọn
                                        </button>
                                    )}
                                </div>
                                <div className="h-48 relative w-full min-h-[200px]" >
                                    {stats.categoryData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                            <PieChart>
                                                <Pie
                                                    data={stats.categoryData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={40}
                                                    outerRadius={70}
                                                    paddingAngle={2}
                                                    dataKey="value"
                                                    cursor="pointer"
                                                    onClick={(data: any) => {
                                                        if (data && data.name) {
                                                            handlePieCategoryClick(data.name);
                                                        }
                                                    }}
                                                >
                                                    {stats.categoryData.map((entry, index) => {
                                                        const isSelected = selectedPieCategory === entry.name;
                                                        const isDimmed = selectedPieCategory !== null && !isSelected;
                                                        return (
                                                            <Cell
                                                                key={`cell-${index}`}
                                                                fill={COLORS[index % COLORS.length]}
                                                                opacity={isDimmed ? 0.25 : 1}
                                                                stroke={isSelected ? '#0f172a' : '#ffffff'}
                                                                strokeWidth={isSelected ? 2.5 : 1}
                                                                style={{
                                                                    filter: isSelected ? 'drop-shadow(0 0 6px rgba(0,0,0,0.3))' : 'none',
                                                                    transition: 'all 0.25s ease',
                                                                    outline: 'none',
                                                                    cursor: 'pointer'
                                                                }}
                                                            />
                                                        );
                                                    })}
                                                </Pie>
                                                <Tooltip formatter={(value: number | undefined) => formatCurrency(value || 0, lang)} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-gray-400 text-sm">Chưa có dữ liệu</div>
                                    )}
                                </div>

                                {selectedPieCategory && (
                                    <div className="text-[11px] text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg mt-2 border border-sky-100 font-medium">
                                        Đang chọn: <strong>{selectedPieCategory}</strong> (Nhấn lại để xem chi tiết)
                                    </div>
                                )}

                                <div className="space-y-1.5 mt-3 max-h-40 overflow-y-auto scrollbar-thin">
                                    {stats.categoryData.map((entry, index) => {
                                        const isSelected = selectedPieCategory === entry.name;
                                        return (
                                            <div
                                                key={index}
                                                onClick={() => handlePieCategoryClick(entry.name)}
                                                className={`flex justify-between items-center text-xs p-1.5 rounded-xl cursor-pointer transition-all ${
                                                    isSelected
                                                        ? 'bg-sky-50 text-sky-800 font-bold border border-sky-200'
                                                        : selectedPieCategory !== null
                                                        ? 'opacity-40 hover:opacity-80'
                                                        : 'hover:bg-gray-50 text-gray-600'
                                                }`}
                                                title="Nhấn để sáng màu, nhấn đúp để xem chi tiết"
                                            >
                                                <span className="flex items-center gap-1.5 truncate">
                                                    <div
                                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                                    ></div>
                                                    <span className="truncate">{entry.name}</span>
                                                </span>
                                                <span className="font-semibold shrink-0 ml-2">{Math.round(entry.percent)}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'wallets' && renderWallets()}

                {viewMode === 'calendar' && renderCalendar()}

                {viewMode === 'history' && renderHistory()}

                {viewMode === 'report' && renderReport()}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Area Chart Section (Moved) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <TrendingUp className="text-sky-600" /> Xu hướng Thu nhập & Chi tiêu
                    </h3>
                    <div className="h-80 w-full min-h-[320px]" >
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

                {/* Savings Vault & Goals Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 h-full flex flex-col">
                    {/* Section Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-gray-100 pb-3">
                        <div>
                            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                <PiggyBank className="text-sky-600 w-4 h-4 md:w-5 md:h-5" /> 
                                <span>Mục tiêu tiết kiệm</span>
                            </h3>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            <button
                                onClick={() => {
                                    setSelectedGoalForHistory(null);
                                    setHistoryGoalFilter('all');
                                    setSavingsModalTab('analytics');
                                    setIsSavingHistoryModalOpen(true);
                                }}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition whitespace-nowrap"
                            >
                                <BarChart2 size={15} /> <span>Thống kê</span>
                            </button>
                            <button
                                onClick={() => {
                                    const financialGoals = state.goals.filter(g => g.type === 'FINANCIAL');
                                    if (financialGoals.length === 0) {
                                        alert("Vui lòng tạo mục tiêu tiết kiệm trước!");
                                        setEditingGoal(null);
                                        setGoalTarget('');
                                        setGoalCurrent('');
                                        setGoalMonthlyTarget('');
                                        setIsGoalModalOpen(true);
                                        return;
                                    }
                                    setSelectedGoalForDeposit(financialGoals[0]);
                                    setDepositAmount('');
                                    setDepositDate(new Date().toISOString().split('T')[0]);
                                    setDepositNote('');
                                    setDepositWalletId(state.wallets?.[0]?.id || '');
                                    setIsDepositModalOpen(true);
                                }}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 transition whitespace-nowrap"
                            >
                                <Plus size={15} /> <span>Nạp nhanh</span>
                            </button>
                            <button
                                onClick={() => {
                                    setEditingGoal(null);
                                    setGoalTarget('');
                                    setGoalCurrent('');
                                    setGoalMonthlyTarget('');
                                    setIsGoalModalOpen(true);
                                }}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-sky-50 text-sky-600 rounded-xl text-xs font-bold hover:bg-sky-100 transition whitespace-nowrap"
                            >
                                <Target size={15} /> <span>Thêm mục tiêu</span>
                            </button>
                        </div>
                    </div>

                    {/* Savings Vault Summary Bar */}
                    <div className="mb-4 bg-slate-50 border border-slate-200/80 p-4 rounded-xl">
                        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-3 pb-3 border-b border-slate-200/60">
                            <div>
                                <div className="text-[11px] text-gray-500 font-medium truncate">Tổng tích lũy</div>
                                <div className="text-sm sm:text-base md:text-lg font-extrabold text-sky-600 mt-0.5">
                                    {formatCurrency(monthlySavingsStats.totalAccumulated, lang)}
                                </div>
                            </div>
                            <div>
                                <div className="text-[11px] text-gray-500 font-medium truncate">Tháng này ({selectedMonth + 1}/{selectedYear})</div>
                                <div className="text-sm sm:text-base md:text-lg font-extrabold text-emerald-600 mt-0.5">
                                    {formatCurrency(monthlySavingsStats.totalSavedThisMonth, lang)}
                                </div>
                            </div>
                            <div>
                                <div className="text-[11px] text-gray-500 font-medium truncate">Số ngày nạp</div>
                                <div className="text-xs sm:text-sm font-bold text-gray-800 flex items-center gap-1 mt-0.5">
                                    <Flame size={14} className="text-amber-500 shrink-0" />
                                    <span className="truncate">{monthlySavingsStats.savedDaysCount} ngày</span>
                                </div>
                            </div>
                        </div>

                        {/* Habit progress bar */}
                        <div>
                            <div className="flex justify-between items-center mb-1 text-xs">
                                <span className="font-semibold text-gray-700">Mục tiêu tháng:</span>
                                <span className="font-bold text-sky-600">
                                    {formatCurrency(monthlySavingsStats.totalSavedThisMonth, lang)} / {formatCurrency(monthlySavingsStats.totalMonthlyTarget, lang)} ({monthlySavingsStats.habitProgressPercent}%)
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-sky-500 h-full rounded-full transition-all duration-500"
                                    style={{ width: `${monthlySavingsStats.habitProgressPercent}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* Goals List */}
                    <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin space-y-3 max-h-[360px]">
                        {state.goals.filter(g => g.type === 'FINANCIAL').map(goal => (
                            <div key={goal.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50 relative group">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-gray-800 text-base">{goal.title}</h4>
                                            {goal.monthly_target && goal.monthly_target > 0 ? (
                                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md text-[10px] font-bold">
                                                    {formatCurrency(goal.monthly_target, lang)}/tháng
                                                </span>
                                            ) : null}
                                        </div>
                                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                            <CalendarDays size={12} /> Hạn: {new Date(goal.deadline).toLocaleDateString('vi-VN')}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => {
                                                setEditingGoal(goal);
                                                setGoalTarget((goal.target_amount || 0).toString());
                                                setGoalCurrent((goal.current_amount || 0).toString());
                                                setGoalMonthlyTarget((goal.monthly_target || 0).toString());
                                                setIsGoalModalOpen(true);
                                            }}
                                            className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-white rounded-lg transition"
                                            title="Sửa mục tiêu"
                                        >
                                            <Edit2 size={15} />
                                        </button>
                                        <button
                                            onClick={() => onDeleteGoal(goal.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg transition"
                                            title="Xóa mục tiêu"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex justify-between items-end text-sm mb-1.5">
                                    <span className="text-sky-600 font-bold text-base">{formatCurrency(goal.current_amount || 0, lang)}</span>
                                    <span className="text-gray-400 font-medium">/ {formatCurrency(goal.target_amount || 0, lang)}</span>
                                </div>

                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mb-3">
                                    <div
                                        className="bg-sky-500 h-full rounded-full transition-all duration-500"
                                        style={{ width: `${Math.min(((goal.current_amount || 0) / (goal.target_amount || 1)) * 100, 100)}%` }}
                                    ></div>
                                </div>

                                {/* Actions Bar on Goal Card */}
                                <div className="flex items-center justify-between pt-1 border-t border-gray-200/60">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setSelectedGoalForDeposit(goal);
                                                setDepositAmount('');
                                                setDepositDate(new Date().toISOString().split('T')[0]);
                                                setDepositNote('');
                                                setDepositWalletId(state.wallets?.[0]?.id || '');
                                                setIsDepositModalOpen(true);
                                            }}
                                            className="text-xs font-bold text-sky-600 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-lg transition flex items-center gap-1"
                                        >
                                            <Plus size={13} /> Nạp tiền
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedGoalForAdjust(goal);
                                                setAdjustNewAmount((goal.current_amount || 0).toString());
                                                setAdjustReason('');
                                                setIsAdjustBalanceModalOpen(true);
                                            }}
                                            className="text-xs font-bold text-gray-700 bg-gray-200/70 hover:bg-gray-200 px-2 py-1 rounded-lg transition flex items-center gap-1"
                                            title="Điều chỉnh số tiền tích lũy trực tiếp"
                                        >
                                            <Sliders size={13} /> Điều chỉnh
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedGoalForHistory(goal);
                                                setHistoryGoalFilter(goal.id);
                                                setSavingsModalTab('history');
                                                setIsSavingHistoryModalOpen(true);
                                            }}
                                            className="text-xs font-medium text-gray-500 hover:text-indigo-600 flex items-center gap-1 px-1.5 py-1"
                                        >
                                            <History size={13} /> Lịch sử ({savingsLogs.filter(l => l.goal_id === goal.id).length})
                                        </button>
                                    </div>
                                    <span className="text-xs font-bold text-gray-500">{Math.round(((goal.current_amount || 0) / (goal.target_amount || 1)) * 100)}%</span>
                                </div>
                            </div>
                        ))}

                        {state.goals.filter(g => g.type === 'FINANCIAL').length === 0 && (
                            <div className="text-center py-10 text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                Bạn chưa tạo quỹ tiết kiệm nào. Hãy bấm <b>+ Thêm Quỹ</b> để bắt đầu.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add/Edit Goal Modal */}
            {
                isGoalModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-lg">
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
                                    <label className="text-xs text-gray-500 uppercase font-bold ml-1">Số tiền mục tiêu (Tổng)</label>
                                    <input
                                        name="target_amount"
                                        type="number"
                                        required
                                        value={goalTarget}
                                        onChange={(e) => setGoalTarget(e.target.value)}
                                        placeholder="0"
                                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none font-medium mt-1"
                                    />
                                    <div className="flex justify-end mt-1 text-xs text-sky-600 font-bold">
                                        {goalTarget && !isNaN(Number(goalTarget)) && formatCurrency(Number(goalTarget), lang)}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold ml-1">Mục tiêu tiết kiệm hàng tháng (Thói quen)</label>
                                    <input
                                        type="number"
                                        value={goalMonthlyTarget}
                                        onChange={(e) => setGoalMonthlyTarget(e.target.value)}
                                        placeholder="Ví dụ: 2,000,000"
                                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none font-medium mt-1"
                                    />
                                    <div className="flex justify-end mt-1 text-xs text-indigo-600 font-bold">
                                        {goalMonthlyTarget && !isNaN(Number(goalMonthlyTarget)) && formatCurrency(Number(goalMonthlyTarget), lang)}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold ml-1">Đã tích lũy ban đầu</label>
                                    <input
                                        name="current_amount"
                                        type="number"
                                        value={goalCurrent}
                                        onChange={(e) => setGoalCurrent(e.target.value)}
                                        placeholder="0"
                                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none font-medium mt-1"
                                    />
                                    <div className="flex justify-end mt-1 text-xs text-sky-600 font-bold">
                                        {goalCurrent && !isNaN(Number(goalCurrent)) && formatCurrency(Number(goalCurrent), lang)}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold ml-1">Dự định hoàn thành</label>
                                    <input type="date" name="deadline" required defaultValue={editingGoal ? editingGoal.deadline : new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none text-sm mt-1" />
                                </div>
                                <button type="submit" className="w-full py-3 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-700 transition mt-2">{editingGoal ? 'Cập Nhật' : 'Lưu Mục Tiêu'}</button>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Deposit Modal */}
            {
                isDepositModalOpen && selectedGoalForDeposit && (
                    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={() => setIsDepositModalOpen(false)}>
                        <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">Nạp tiền Tiết kiệm</h3>
                                    <p className="text-xs text-gray-500 line-clamp-1">Mục tiêu: {selectedGoalForDeposit.title}</p>
                                </div>
                                <button onClick={() => setIsDepositModalOpen(false)}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
                            </div>

                            <form onSubmit={handleDepositSubmit} className="space-y-4">
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold ml-1">Số tiền tiết kiệm (VNĐ)</label>
                                    <input
                                        type="number"
                                        autoFocus
                                        required
                                        value={depositAmount}
                                        onChange={(e) => setDepositAmount(e.target.value)}
                                        placeholder="Nhập hoặc chọn số tiền..."
                                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-800 text-lg font-bold outline-none focus:border-sky-500 transition-colors mt-1"
                                    />
                                    {/* Quick preset buttons */}
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {[50000, 100000, 200000, 500000, 1000000].map((preset) => (
                                            <button
                                                key={preset}
                                                type="button"
                                                onClick={() => {
                                                    const current = Number(depositAmount) || 0;
                                                    setDepositAmount((current + preset).toString());
                                                }}
                                                className="px-2.5 py-1 bg-gray-100 hover:bg-sky-100 hover:text-sky-700 text-gray-700 text-xs font-bold rounded-lg transition-colors"
                                            >
                                                +{preset >= 1000000 ? `${preset / 1000000}M` : `${preset / 1000}k`}
                                            </button>
                                        ))}
                                        {depositAmount && Number(depositAmount) > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setDepositAmount('')}
                                                className="px-2 py-1 bg-rose-50 text-rose-600 text-xs font-bold rounded-lg hover:bg-rose-100"
                                            >
                                                Xóa
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex justify-end mt-1 text-xs text-sky-600 font-bold">
                                        {depositAmount && !isNaN(Number(depositAmount)) && formatCurrency(Number(depositAmount), lang)}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold ml-1">Ngày nạp</label>
                                    <input
                                        type="date"
                                        required
                                        value={depositDate}
                                        onChange={(e) => setDepositDate(e.target.value)}
                                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none text-sm font-medium mt-1"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold ml-1">Ghi chú (Tùy chọn)</label>
                                    <input
                                        type="text"
                                        value={depositNote}
                                        onChange={(e) => setDepositNote(e.target.value)}
                                        placeholder="Ví dụ: Nạp thói quen hàng ngày..."
                                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none text-sm font-medium mt-1"
                                    />
                                </div>

                                {state.wallets && state.wallets.length > 0 && (
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold ml-1">Trích từ Ví tài chính (Tự động trừ ví)</label>
                                        <select
                                            value={depositWalletId}
                                            onChange={(e) => setDepositWalletId(e.target.value)}
                                            className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none text-sm font-medium mt-1"
                                        >
                                            <option value="">-- Không trích ví (Chỉ lưu số dư mục tiêu) --</option>
                                            {state.wallets.map(w => (
                                                <option key={w.id} value={w.id}>
                                                    {w.name} ({formatCurrency(w.balance, lang)})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

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
                                        className="flex-1 py-3 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-700 transition"
                                    >
                                        Lưu khoản nạp
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Direct Balance Adjustment Modal */}
            {
                isAdjustBalanceModalOpen && selectedGoalForAdjust && (
                    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={() => setIsAdjustBalanceModalOpen(false)}>
                        <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">Điều chỉnh số dư tích lũy</h3>
                                    <p className="text-xs text-gray-500 line-clamp-1">Mục tiêu: {selectedGoalForAdjust.title}</p>
                                </div>
                                <button onClick={() => setIsAdjustBalanceModalOpen(false)}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
                            </div>

                            <form onSubmit={handleAdjustBalanceSubmit} className="space-y-4">
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 font-medium">
                                    Số dư hiện tại: <b>{formatCurrency(selectedGoalForAdjust.current_amount || 0, lang)}</b>. Bạn có thể sửa trực tiếp số tiền tích lũy thực tế ở bên dưới.
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold ml-1">Số tiền tích lũy mới (VNĐ)</label>
                                    <input
                                        type="number"
                                        autoFocus
                                        required
                                        value={adjustNewAmount}
                                        onChange={(e) => setAdjustNewAmount(e.target.value)}
                                        placeholder="Nhập số tiền tích lũy mới..."
                                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-800 text-lg font-bold outline-none focus:border-sky-500 transition-colors mt-1"
                                    />
                                    <div className="flex justify-end mt-1 text-xs text-sky-600 font-bold">
                                        {adjustNewAmount && !isNaN(Number(adjustNewAmount)) && formatCurrency(Number(adjustNewAmount), lang)}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold ml-1">Lý do điều chỉnh (Tùy chọn)</label>
                                    <input
                                        type="text"
                                        value={adjustReason}
                                        onChange={(e) => setAdjustReason(e.target.value)}
                                        placeholder="Ví dụ: Kiểm đếm lại heo đất, đính chính..."
                                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none text-sm font-medium mt-1"
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsAdjustBalanceModalOpen(false)}
                                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-3 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-700 transition"
                                    >
                                        Cập nhật số dư
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Savings Analytics & History Modal */}
            {
                isSavingHistoryModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={() => setIsSavingHistoryModalOpen(false)}>
                        <div className="bg-white rounded-2xl w-full max-w-xl p-6 shadow-lg flex flex-col max-h-[88vh]" onClick={(e) => e.stopPropagation()}>
                            {/* Modal Header */}
                            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                        <PiggyBank className="text-sky-600" /> Thống Kê & Lịch Sử Tiết Kiệm
                                    </h3>
                                    <p className="text-xs text-gray-500">
                                        Báo cáo tổng quan tiến độ thói quen và danh sách các khoản nạp
                                    </p>
                                </div>
                                <button onClick={() => setIsSavingHistoryModalOpen(false)}>
                                    <X size={20} className="text-gray-400 hover:text-gray-600" />
                                </button>
                            </div>

                            {/* Tab Switcher */}
                            <div className="flex border-b border-gray-200 mt-3">
                                <button
                                    onClick={() => setSavingsModalTab('analytics')}
                                    className={`px-4 py-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                                        savingsModalTab === 'analytics'
                                            ? 'border-sky-600 text-sky-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <BarChart2 size={14} /> Thống kê chi tiết
                                </button>
                                <button
                                    onClick={() => setSavingsModalTab('history')}
                                    className={`px-4 py-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                                        savingsModalTab === 'history'
                                            ? 'border-sky-600 text-sky-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <History size={14} /> Lịch sử nạp ({savingsLogs.length})
                                </button>
                            </div>

                            {/* TAB 1: ANALYTICS OVERVIEW */}
                            {savingsModalTab === 'analytics' && (
                                <div className="flex-1 overflow-y-auto py-4 space-y-4 scrollbar-thin">
                                    {/* Top KPIs Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="p-3 bg-sky-50 rounded-xl border border-sky-100">
                                            <div className="text-[11px] text-sky-700 font-semibold">Tổng tích lũy</div>
                                            <div className="text-sm sm:text-base font-extrabold text-sky-800 mt-0.5">
                                                {formatCurrency(monthlySavingsStats.totalAccumulated, lang)}
                                            </div>
                                        </div>
                                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                            <div className="text-[11px] text-emerald-700 font-semibold">Nạp tháng này</div>
                                            <div className="text-sm sm:text-base font-extrabold text-emerald-800 mt-0.5">
                                                {formatCurrency(monthlySavingsStats.totalSavedThisMonth, lang)}
                                            </div>
                                        </div>
                                        <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                            <div className="text-[11px] text-indigo-700 font-semibold">Số ngày nạp</div>
                                            <div className="text-sm sm:text-base font-extrabold text-indigo-800 mt-0.5">
                                                {monthlySavingsStats.savedDaysCount} ngày
                                            </div>
                                        </div>
                                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                                            <div className="text-[11px] text-amber-700 font-semibold">Trung bình/lần</div>
                                            <div className="text-sm sm:text-base font-extrabold text-amber-800 mt-0.5">
                                                {formatCurrency(monthlySavingsStats.avgPerLog, lang)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Monthly Savings Comparison Bar Chart */}
                                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                                        <h4 className="text-xs font-bold uppercase text-gray-700 mb-2 flex items-center gap-1.5">
                                            <BarChart2 size={14} className="text-sky-600" />
                                            <span>So sánh tiết kiệm giữa các tháng</span>
                                        </h4>
                                        <div className="h-48 w-full mt-2">
                                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                                <BarChart data={monthlySavingsComparisonChartData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} tickFormatter={(value) => value >= 1000000 ? `${value / 1000000}M` : value >= 1000 ? `${value / 1000}k` : `${value}`} />
                                                    <Tooltip
                                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                        formatter={(value: number | undefined) => [formatCurrency(value || 0, lang), 'Tiết kiệm']}
                                                    />
                                                    <Bar dataKey="amount" name="Tiền tiết kiệm" fill="#0EA5E9" radius={[6, 6, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Overall Goal Progress Summary */}
                                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-xs font-bold text-gray-700">Tổng tiến độ hoàn thành các mục tiêu:</span>
                                            <span className="text-xs font-bold text-sky-600">
                                                {monthlySavingsStats.overallProgressPercent}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                            <div
                                                className="bg-sky-500 h-full rounded-full transition-all duration-500"
                                                style={{ width: `${monthlySavingsStats.overallProgressPercent}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between text-[11px] text-gray-500 mt-1.5">
                                            <span>Đã có: {formatCurrency(monthlySavingsStats.totalAccumulated, lang)}</span>
                                            <span>Mục tiêu: {formatCurrency(monthlySavingsStats.totalTarget, lang)}</span>
                                        </div>
                                    </div>

                                    {/* Per Goal Breakdown */}
                                    <div>
                                        <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Chi tiết từng quỹ tiết kiệm</h4>
                                        <div className="space-y-2">
                                            {state.goals.filter(g => g.type === 'FINANCIAL').map(g => {
                                                const pct = Math.round(((g.current_amount || 0) / (g.target_amount || 1)) * 100);
                                                return (
                                                    <div key={g.id} className="p-3 bg-white border border-gray-200 rounded-xl">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-xs font-bold text-gray-800">{g.title}</span>
                                                            <span className="text-xs font-bold text-sky-600">{pct}%</span>
                                                        </div>
                                                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden mb-1">
                                                            <div className="bg-sky-500 h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%` }}></div>
                                                        </div>
                                                        <div className="flex justify-between text-[11px] text-gray-500">
                                                            <span>Đã nạp: {formatCurrency(g.current_amount || 0, lang)}</span>
                                                            <span>Còn thiếu: {formatCurrency(Math.max((g.target_amount || 0) - (g.current_amount || 0), 0), lang)}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: HISTORY LOGS */}
                            {savingsModalTab === 'history' && (
                                <div className="flex-1 flex flex-col min-h-0 py-3">
                                    {/* Filter bar */}
                                    <div className="pb-3 flex gap-2 border-b border-gray-100">
                                        <select
                                            value={historyGoalFilter}
                                            onChange={(e) => setHistoryGoalFilter(e.target.value)}
                                            className="p-2 bg-gray-50 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 outline-none flex-1"
                                        >
                                            <option value="all">-- Tất cả mục tiêu --</option>
                                            {state.goals.filter(g => g.type === 'FINANCIAL').map(g => (
                                                <option key={g.id} value={g.id}>{g.title}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Logs list */}
                                    <div className="flex-1 overflow-y-auto py-3 space-y-3 scrollbar-thin">
                                        {savingsLogs
                                            .filter(l => historyGoalFilter === 'all' || l.goal_id === historyGoalFilter)
                                            .map(log => {
                                                const parentGoal = state.goals.find(g => g.id === log.goal_id);
                                                const isEditingThis = editingLog?.id === log.id;

                                                return (
                                                    <div key={log.id} className="p-3.5 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors">
                                                        {isEditingThis ? (
                                                            <form onSubmit={handleUpdateLogSubmit} className="space-y-3 p-1">
                                                                <div className="font-bold text-xs text-indigo-600">Chỉnh sửa khoản nạp:</div>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <input
                                                                        type="number"
                                                                        required
                                                                        value={editLogAmount}
                                                                        onChange={(e) => setEditLogAmount(e.target.value)}
                                                                        placeholder="Số tiền..."
                                                                        className="p-2 bg-white rounded-lg border border-gray-200 text-xs font-bold"
                                                                    />
                                                                    <input
                                                                        type="date"
                                                                        required
                                                                        value={editLogDate}
                                                                        onChange={(e) => setEditLogDate(e.target.value)}
                                                                        className="p-2 bg-white rounded-lg border border-gray-200 text-xs"
                                                                    />
                                                                </div>
                                                                <input
                                                                    type="text"
                                                                    value={editLogNote}
                                                                    onChange={(e) => setEditLogNote(e.target.value)}
                                                                    placeholder="Ghi chú..."
                                                                    className="w-full p-2 bg-white rounded-lg border border-gray-200 text-xs"
                                                                />
                                                                <div className="flex justify-end gap-2 pt-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setEditingLog(null)}
                                                                        className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold"
                                                                    >
                                                                        Hủy
                                                                    </button>
                                                                    <button
                                                                        type="submit"
                                                                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold"
                                                                    >
                                                                        Lưu lại
                                                                    </button>
                                                                </div>
                                                            </form>
                                                        ) : (
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`font-bold text-sm ${log.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                                            {log.amount > 0 ? '+' : ''}{formatCurrency(log.amount, lang)}
                                                                        </span>
                                                                        <span className="text-[11px] px-2 py-0.5 bg-gray-200/60 text-gray-700 font-medium rounded-md">
                                                                            {new Date(log.date).toLocaleDateString('vi-VN')}
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-xs text-gray-600 font-medium mt-0.5">
                                                                        {log.note || 'Ghi nhận tiết kiệm'}
                                                                    </div>
                                                                    {historyGoalFilter === 'all' && parentGoal && (
                                                                        <div className="text-[10px] text-gray-400 mt-0.5">
                                                                            Mục tiêu: {parentGoal.title}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingLog(log);
                                                                            setEditLogAmount(log.amount.toString());
                                                                            setEditLogDate(log.date);
                                                                            setEditLogNote(log.note || '');
                                                                        }}
                                                                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-lg transition"
                                                                    >
                                                                        <Edit2 size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteLog(log.id, log.goal_id)}
                                                                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-white rounded-lg transition"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                        {savingsLogs.filter(l => historyGoalFilter === 'all' || l.goal_id === historyGoalFilter).length === 0 && (
                                            <div className="text-center py-10 text-gray-400 italic text-sm">
                                                Chưa có lịch sử nạp tiền nào.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Redesigned Compact Transaction Entry Modal (Continuous & Batch) */}
            <TransactionEntryModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingTransaction(null);
                }}
                state={state}
                onAddTransaction={onAddTransaction}
                onBatchAddTransactions={onBatchAddTransactions}
                onUpdateTransaction={onUpdateTransaction}
                editingTransaction={editingTransaction}
                expenseCategories={expenseCategories}
                incomeCategories={incomeCategories}
                pinnedCategories={pinnedCategories || []}
                onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
                lang={lang}
            />

            {/* Category Manager Modal (Pinned, Add, Edit, Delete) */}
            <CategoryManagerModal
                isOpen={isCategoryManagerOpen}
                onClose={() => setIsCategoryManagerOpen(false)}
                expenseCategories={expenseCategories}
                incomeCategories={incomeCategories}
                pinnedCategories={pinnedCategories || []}
                onTogglePin={(cat) => onTogglePinCategory && onTogglePinCategory(cat)}
                onAddCategory={onAddCategory}
                onEditCategory={onEditCategory}
                onDeleteCategory={onDeleteCategory}
                lang={lang}
            />

            {/* Recurring Transactions Modal (Subscriptions, Monthly Fixed Expenses) */}
            <RecurringTransactionsModal
                isOpen={isRecurringModalOpen}
                onClose={() => {
                    setIsRecurringModalOpen(false);
                    fetchRecurring();
                }}
                userId={state.profile?.id || 'guest'}
                wallets={state.wallets}
                expenseCategories={expenseCategories}
                incomeCategories={incomeCategories}
                pinnedCategories={pinnedCategories || []}
                transactions={state.transactions}
                currentMonth={selectedMonth}
                currentYear={selectedYear}
                onApplyRecurringToMonth={async (txList, recurringIds) => {
                    if (onBatchAddTransactions) {
                        await onBatchAddTransactions(txList);
                    } else {
                        txList.forEach(t => onAddTransaction(t));
                    }
                    await fetchRecurring();
                }}
                onAddCategory={onAddCategory}
                onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
                lang={lang}
            />

            {/* Chart Detail History Modal (Pop-up khi ấn 2 lần vào danh mục / cột tháng) */}
            {isChartDetailModalOpen && chartDetailInfo && (() => {
                const list = chartDetailInfo.type === 'category'
                    ? transactions.filter(t => 
                        t.type === TransactionType.EXPENSE &&
                        t.category === chartDetailInfo.category &&
                        t.date.startsWith(chartDetailInfo.monthKey)
                    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    : transactions.filter(t =>
                        t.category !== 'Điều chỉnh số dư' &&
                        t.date.startsWith(chartDetailInfo.monthKey)
                    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                const totalExpense = list
                    .filter(t => t.type === TransactionType.EXPENSE)
                    .reduce((sum, t) => sum + t.amount, 0);
                const totalIncome = list
                    .filter(t => t.type === TransactionType.INCOME)
                    .reduce((sum, t) => sum + t.amount, 0);

                return (
                    <div className="fixed inset-0 bg-black/50 z-[75] flex items-center justify-center p-3 md:p-6 backdrop-blur-xs">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col border border-gray-200">
                            {/* Header */}
                            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                                <div className="min-w-0 flex-1 pr-2">
                                    <h3 className="text-sm font-bold text-gray-800 truncate">{chartDetailInfo.title}</h3>
                                    <p className="text-[11px] text-gray-400 mt-0.5 font-medium truncate">
                                        {chartDetailInfo.subtitle} • {list.length} giao dịch
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsChartDetailModalOpen(false)}
                                    className="w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 flex items-center justify-center transition-colors shrink-0"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Summary Strip */}
                            <div className="px-4 py-2 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between text-xs shrink-0">
                                {chartDetailInfo.type === 'category' ? (
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-gray-500 font-medium">Tổng chi tiêu:</span>
                                        <span className="font-bold text-rose-600">{formatCurrency(totalExpense, lang)}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between w-full">
                                        <div>
                                            <span className="text-gray-400 text-[10px] uppercase font-bold block">Thu nhập</span>
                                            <span className="font-bold text-emerald-600">+{formatCurrency(totalIncome, lang)}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-gray-400 text-[10px] uppercase font-bold block">Chi tiêu</span>
                                            <span className="font-bold text-rose-600">-{formatCurrency(totalExpense, lang)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Transactions List */}
                            <div className="p-3 overflow-y-auto flex-1 space-y-2 custom-scrollbar">
                                {list.length === 0 ? (
                                    <div className="p-8 text-center text-xs text-gray-400">
                                        Không có giao dịch nào trong mục này.
                                    </div>
                                ) : (
                                    list.map(t => {
                                        const wallet = state.wallets.find(w => w.id === t.wallet_id);
                                        const isExpense = t.type === TransactionType.EXPENSE;
                                        return (
                                            <div
                                                key={t.id}
                                                className="p-2.5 rounded-xl border border-gray-200 bg-white flex items-center justify-between gap-2.5 text-xs hover:bg-gray-50/50 transition-colors"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-bold text-gray-800 truncate">
                                                            {t.category}
                                                        </span>
                                                        {wallet && (
                                                            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-gray-100 text-gray-600 font-medium truncate">
                                                                {wallet.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                                        <span>{t.date}</span>
                                                        {t.description && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="truncate text-gray-600">{t.description}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className={`font-bold ${isExpense ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                        {isExpense ? '-' : '+'}{formatCurrency(t.amount, lang)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-3 border-t border-gray-100 flex justify-end bg-gray-50/40 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsChartDetailModalOpen(false)}
                                    className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded-lg transition-colors"
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Edit Balance Modal */}
            {
                isBalanceModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                            <div className="p-6 text-center">
                                <div className="bg-sky-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-sky-600">
                                    <WalletIcon size={32} />
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
                                            className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-lg font-bold text-center"
                                            placeholder={stats.totalBalance.toString()}
                                        />
                                        <div className="flex justify-center mt-2 text-sm text-sky-600 font-bold">
                                            {newBalance && !isNaN(Number(newBalance)) && formatCurrency(Number(newBalance), lang)}
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button type="button" onClick={() => setIsBalanceModalOpen(false)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl">Hủy</button>
                                        <button type="submit" className="flex-1 py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-lg">Cập nhật</button>
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
                                    <div className="flex justify-end mt-1 text-xs text-sky-600 font-bold">
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
                                        className="flex-1 py-3 bg-sky-600 text-white rounded-xl font-bold shadow-lg shadow-sky-200 hover:bg-sky-700 transition"
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
                    <div className="fixed inset-0 bg-black/50 z-[65] flex items-center justify-center p-4 pb-24 md:p-6 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col max-h-[80vh] md:max-h-[90vh]">
                            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                                {(() => {
                                    const styles = getCategoryStyles(selectedBudgetForDetails.category);
                                    const cleanName = cleanCategoryName(selectedBudgetForDetails.category);
                                    const IconComponent = styles.icon;

                                    return (
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${styles.bgClass}`}>
                                                {styles.emoji ? (
                                                    <span className="text-lg">{styles.emoji}</span>
                                                ) : (
                                                    <IconComponent size={20} />
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-base md:text-lg text-gray-800">Chi tiết: {cleanName}</h3>
                                                <p className="text-xs text-gray-500">
                                                    {detailViewMonth ? `Tháng ${detailViewMonth.split('-')[1]}/${detailViewMonth.split('-')[0]}` : 'Lịch sử chi tiêu'}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })()}
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
                                                        fill={entry === detailViewMonth ? '#0284C7' : '#E5E7EB'}
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
                )}
            {/* --- End Budget Modals --- */}

            {/* Month/Year Selection Popup Modal */}
            {isMonthPickerOpen && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100 animate-slide-up">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                <CalendarDays className="text-sky-600" size={20} />
                                Chọn Thời Gian
                            </h3>
                            <button
                                onClick={() => setIsMonthPickerOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Year Selector */}
                        <div className="flex items-center justify-between bg-sky-50/50 p-2 rounded-2xl mb-6 border border-sky-100/50">
                            <button
                                type="button"
                                onClick={() => setSelectedYear(y => y - 1)}
                                className="p-2 bg-white hover:bg-sky-50 text-sky-600 rounded-xl transition-all shadow-sm border border-sky-100/20 font-bold"
                            >
                                ❮
                            </button>
                            <span className="font-extrabold text-sky-900 text-lg">Năm {selectedYear}</span>
                            <button
                                type="button"
                                onClick={() => setSelectedYear(y => y + 1)}
                                className="p-2 bg-white hover:bg-sky-50 text-sky-600 rounded-xl transition-all shadow-sm border border-sky-100/20 font-bold"
                            >
                                ❯
                            </button>
                        </div>

                        {/* Months Grid */}
                        <div className="grid grid-cols-3 gap-2.5">
                            {Array.from({ length: 12 }, (_, i) => {
                                const isCurrentMonth = selectedMonth === i;
                                return (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => {
                                            setSelectedMonth(i);
                                            setIsMonthPickerOpen(false);
                                        }}
                                        className={`py-3 px-2 rounded-2xl text-xs font-bold transition-all border ${isCurrentMonth
                                            ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white border-transparent shadow-lg shadow-sky-100 scale-[1.03]'
                                            : 'bg-white border-gray-100 text-gray-600 hover:bg-sky-50/40 hover:border-sky-100'
                                            }`}
                                    >
                                        Tháng {i + 1}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Wallets & Funds Sub-Page Helper Render & Modals */}
            {isAddWalletModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[65] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in animate-scale-up">
                    <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="font-bold text-lg text-gray-800">
                                {editingWallet ? 'Sửa Ví / Quỹ' : 'Ví / Quỹ Tài Chính Mới'}
                            </h3>
                            <button onClick={() => setIsAddWalletModalOpen(false)}>
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>

                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                if (!walletName.trim() || !walletBalance) return;

                                const amountNum = Number(walletBalance);
                                if (isNaN(amountNum) || amountNum < 0) {
                                    alert(walletType === 'fund' ? 'Hạn mức ngân sách không hợp lệ!' : 'Số tiền ban đầu không hợp lệ!');
                                    return;
                                }

                                const currentBalanceNum = editingWallet 
                                    ? Number(walletCurrentBalance) 
                                    : amountNum;

                                if (isNaN(currentBalanceNum)) {
                                    alert('Số dư hiện tại không hợp lệ!');
                                    return;
                                }

                                const walletPayload = {
                                    name: walletName.trim(),
                                    type: walletType,
                                    balance: currentBalanceNum,
                                    initial_balance: amountNum,
                                    color: walletColor,
                                    icon: walletIcon,
                                    include_in_total: walletIncludeInTotal
                                };

                                if (editingWallet) {
                                    await onUpdateWallet({
                                        ...editingWallet,
                                        ...walletPayload
                                    });
                                } else {
                                    await onAddWallet(walletPayload);
                                }

                                setIsAddWalletModalOpen(false);
                            }}
                            className="space-y-4"
                        >
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Tên tài khoản / Ví / Quỹ</label>
                                <input
                                    required
                                    value={walletName}
                                    onChange={(e) => setWalletName(e.target.value)}
                                    placeholder="Ví dụ: Techcombank, Tiền mặt, Quỹ đi du lịch..."
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-semibold mt-1 outline-none text-xs text-gray-700"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Loại ví</label>
                                <select
                                    value={walletType}
                                    onChange={(e) => setWalletType(e.target.value as any)}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold mt-1 outline-none text-xs text-gray-700 cursor-pointer"
                                >
                                    <option value="cash">Tiền mặt 💵</option>
                                    <option value="bank">Tài khoản Ngân hàng 🏦</option>
                                    <option value="credit">Thẻ tín dụng 💳</option>
                                    <option value="e-wallet">Ví điện tử (Momo, ShopeePay) 📱</option>
                                    <option value="savings">Tài khoản Tiết kiệm 🐷</option>
                                    <option value="fund">Quỹ mục đích chi tiêu (Budget Fund) 🎯</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1">
                                    {walletType === 'fund' ? 'Hạn mức ngân sách quỹ' : 'Số dư ban đầu'}
                                </label>
                                <input
                                    type="number"
                                    required
                                    value={walletBalance}
                                    onChange={(e) => setWalletBalance(e.target.value)}
                                    placeholder="0"
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-black mt-1 outline-none text-base text-gray-800"
                                />
                                <div className="text-right text-xs text-sky-600 font-bold mt-1">
                                    {walletBalance && !isNaN(Number(walletBalance)) && formatCurrency(Number(walletBalance), lang)}
                                </div>
                            </div>

                            {editingWallet && (
                                <div className="animate-fade-in">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">
                                        {walletType === 'fund' ? 'Số dư quỹ hiện có' : 'Số dư hiện tại'}
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        value={walletCurrentBalance}
                                        onChange={(e) => setWalletCurrentBalance(e.target.value)}
                                        placeholder="0"
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-black mt-1 outline-none text-base text-gray-800"
                                    />
                                    <div className="text-right text-xs text-sky-600 font-bold mt-1">
                                        {walletCurrentBalance && !isNaN(Number(walletCurrentBalance)) && formatCurrency(Number(walletCurrentBalance), lang)}
                                    </div>
                                </div>
                            )}

                            {/* Color Selector */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Màu sắc nhận diện</label>
                                <div className="flex gap-2.5 mt-2 flex-wrap">
                                    {['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#3B82F6', '#06B6D4', '#8B5CF6', '#14B8A6', '#64748B'].map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setWalletColor(c)}
                                            className="w-6 h-6 rounded-full border border-gray-200 transition-transform flex items-center justify-center"
                                            style={{ backgroundColor: c, transform: walletColor === c ? 'scale(1.2)' : 'none' }}
                                        >
                                            {walletColor === c && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Include in Total Balance Switch */}
                            <div className="flex items-center justify-between py-2 border-t border-gray-100 mt-2">
                                <div>
                                    <p className="text-xs font-bold text-gray-700">Tính vào tổng tài sản</p>
                                    <p className="text-[10px] text-gray-400">Có cộng ví này vào tổng số dư hiển thị ở dashboard chính?</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={walletIncludeInTotal}
                                    onChange={(e) => setWalletIncludeInTotal(e.target.checked)}
                                    className="w-4.5 h-4.5 rounded-lg border-gray-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-sky-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-sky-700 shadow-md transition"
                            >
                                {editingWallet ? 'Cập Nhật Ví / Quỹ' : 'Lưu Ví / Quỹ'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* SỔ NỢ MINI POPUP MODAL (DebtorLedgerModal) */}
            {isDebtorLedgerOpen && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col transform transition-all scale-100 animate-scale-up border border-gray-100">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                                    <BookOpen className="text-indigo-600" size={20} />
                                    Sổ ghi nợ & Vay mượn mini
                                </h3>
                                <p className="text-[11px] text-gray-500 font-medium">Tự động khấu trừ ví & log dòng tiền của bạn</p>
                            </div>
                            <button
                                onClick={() => {
                                    setIsDebtorLedgerOpen(false);
                                    setIsAddDebtOpen(false);
                                    setActiveDebtForRepay(null);
                                    setExpandedDebtHistoryId(null);
                                }}
                                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Content Scrollable area */}
                        <div className="overflow-y-auto p-6 flex-1 custom-scrollbar space-y-5">
                            {/* IF ADD NEW DEBT FORM IS OPEN */}
                            {isAddDebtOpen ? (
                                <div className="bg-gray-50/70 border border-gray-200/60 p-5 rounded-2xl animate-slide-up space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-extrabold text-sm text-gray-700">Tạo khoản Ghi Nợ mới</h4>
                                        <button
                                            type="button"
                                            onClick={() => setIsAddDebtOpen(false)}
                                            className="text-xs font-bold text-gray-400 hover:text-gray-600"
                                        >
                                            Hủy bỏ
                                        </button>
                                    </div>

                                    <form
                                        onSubmit={async (e) => {
                                            e.preventDefault();
                                            if (!debtPartnerName.trim() || !debtAmount) return;
                                            const amt = Number(debtAmount);
                                            if (isNaN(amt) || amt <= 0) {
                                                alert('Số tiền nợ không hợp lệ!');
                                                return;
                                            }

                                            await onAddDebt({
                                                partner_name: debtPartnerName.trim(),
                                                type: debtType,
                                                amount: amt,
                                                remaining_amount: amt,
                                                date_lent: debtDateLent,
                                                due_date: debtDueDate || null,
                                                description: debtDescription.trim() || null,
                                                status: 'pending',
                                                wallet_id: debtWalletId || null
                                            });

                                            // Clear form
                                            setDebtPartnerName('');
                                            setDebtAmount('');
                                            setDebtDueDate('');
                                            setDebtDescription('');
                                            setDebtWalletId('');
                                            setIsAddDebtOpen(false);
                                        }}
                                        className="space-y-3"
                                    >
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setDebtType('lend')}
                                                className={`py-2 px-3 rounded-xl font-bold text-xs border text-center transition-all ${debtType === 'lend'
                                                    ? 'bg-rose-500 border-rose-600 text-white shadow-sm'
                                                    : 'bg-white text-gray-500 border-gray-200'
                                                    }`}
                                            >
                                                Cho vay 💸
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDebtType('borrow')}
                                                className={`py-2 px-3 rounded-xl font-bold text-xs border text-center transition-all ${debtType === 'borrow'
                                                    ? 'bg-emerald-500 border-emerald-600 text-white shadow-sm'
                                                    : 'bg-white text-gray-500 border-gray-200'
                                                    }`}
                                            >
                                                Đi vay 💰
                                            </button>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-1 mb-1">Họ tên con nợ / chủ nợ</label>
                                            <input
                                                required
                                                value={debtPartnerName}
                                                onChange={(e) => setDebtPartnerName(e.target.value)}
                                                placeholder="Ví dụ: Bạn A, Anh Hải, Momo Credit..."
                                                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-1 mb-1">Số tiền vay mượn</label>
                                            <input
                                                type="number"
                                                required
                                                value={debtAmount}
                                                onChange={(e) => setDebtAmount(e.target.value)}
                                                placeholder="0"
                                                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-black outline-none focus:border-indigo-500"
                                            />
                                            <div className="text-right text-xs text-sky-600 font-bold mt-1">
                                                {debtAmount && !isNaN(Number(debtAmount)) && formatCurrency(Number(debtAmount), lang)}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-1 mb-1">Ngày ghi nợ</label>
                                                <input
                                                    type="date"
                                                    required
                                                    value={debtDateLent}
                                                    onChange={(e) => setDebtDateLent(e.target.value)}
                                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs outline-none font-bold text-gray-700"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-1 mb-1">Hạn trả nợ (Nếu có)</label>
                                                <input
                                                    type="date"
                                                    value={debtDueDate}
                                                    onChange={(e) => setDebtDueDate(e.target.value)}
                                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs outline-none font-bold text-gray-700"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-1 mb-1">Giải ngân qua ví (Liên kết dòng tiền)</label>
                                            <select
                                                value={debtWalletId}
                                                onChange={(e) => setDebtWalletId(e.target.value)}
                                                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none"
                                            >
                                                <option value="">-- Không qua ví (Không tạo dòng tiền) --</option>
                                                {state.wallets.map(w => (
                                                    <option key={w.id} value={w.id}>{w.name} ({formatCurrency(w.balance, lang)})</option>
                                                ))}
                                            </select>
                                            <p className="text-[9px] text-gray-500 mt-1">Nếu chọn ví giải ngân, ví sẽ tự cộng/trừ số dư và ghi nhận giao dịch chi tiết tương ứng.</p>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-1 mb-1">Ghi chú chi tiết</label>
                                            <input
                                                value={debtDescription}
                                                onChange={(e) => setDebtDescription(e.target.value)}
                                                placeholder="Ví dụ: A mượn đi ăn buffet, hứa trả sau Tết..."
                                                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md transition-all hover:bg-indigo-700 hover:shadow-lg active:scale-98"
                                        >
                                            Xác nhận tạo nợ
                                        </button>
                                    </form>
                                </div>
                            ) : activeDebtForRepay ? (
                                /* REPAY DEBT FORM */
                                <div className="bg-gray-50/70 border border-gray-200/60 p-5 rounded-2xl animate-slide-up space-y-4">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h4 className="font-extrabold text-sm text-gray-700">Thanh toán nợ</h4>
                                            <p className="text-[10px] text-gray-400">Đối tác: {activeDebtForRepay.partner_name} • Còn nợ: {formatCurrency(activeDebtForRepay.remaining_amount, lang)}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setActiveDebtForRepay(null)}
                                            className="text-xs font-bold text-gray-400 hover:text-gray-600"
                                        >
                                            Hủy
                                        </button>
                                    </div>

                                    <form
                                        onSubmit={async (e) => {
                                            e.preventDefault();
                                            if (!repayAmount) return;
                                            const amt = Number(repayAmount);
                                            if (isNaN(amt) || amt <= 0 || amt > activeDebtForRepay.remaining_amount) {
                                                alert('Số tiền thanh toán không hợp lệ hoặc lớn hơn khoản còn nợ!');
                                                return;
                                            }

                                            await onRepayDebt(
                                                activeDebtForRepay.id,
                                                amt,
                                                repayDate,
                                                repayWalletId || null,
                                                repayNote.trim() || undefined
                                            );

                                            // Clear form
                                            setRepayAmount('');
                                            setRepayNote('');
                                            setRepayWalletId('');
                                            setActiveDebtForRepay(null);
                                        }}
                                        className="space-y-3"
                                    >
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-1 mb-1">Số tiền thanh toán</label>
                                            <input
                                                type="number"
                                                required
                                                value={repayAmount}
                                                onChange={(e) => setRepayAmount(e.target.value)}
                                                placeholder="Nhập số tiền..."
                                                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-black outline-none focus:border-indigo-500"
                                            />
                                            <div className="text-right text-xs text-sky-600 font-bold mt-1">
                                                {repayAmount && !isNaN(Number(repayAmount)) && formatCurrency(Number(repayAmount), lang)}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-1 mb-1">Ngày trả tiền</label>
                                                <input
                                                    type="date"
                                                    required
                                                    value={repayDate}
                                                    onChange={(e) => setRepayDate(e.target.value)}
                                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs outline-none font-bold text-gray-700"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-1 mb-1">Ví nhận/trả tiền</label>
                                                <select
                                                    value={repayWalletId}
                                                    onChange={(e) => setRepayWalletId(e.target.value)}
                                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none cursor-pointer"
                                                >
                                                    <option value="">-- Không qua ví (Không dòng tiền) --</option>
                                                    {state.wallets.map(w => (
                                                        <option key={w.id} value={w.id}>{w.name} ({formatCurrency(w.balance, lang)})</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-1 mb-1">Ghi chú đợt trả này</label>
                                            <input
                                                value={repayNote}
                                                onChange={(e) => setRepayNote(e.target.value)}
                                                placeholder="Ví dụ: Trả bớt một nửa, trả hết nợ..."
                                                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-98"
                                        >
                                            Xác nhận trả nợ
                                        </button>
                                    </form>
                                </div>
                            ) : (
                                /* GENERAL DEBTS VIEWS */
                                <div className="space-y-4">
                                    {/* Receivables & Payables KPI */}
                                    <div className="grid grid-cols-2 gap-3.5">
                                        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-center">
                                            <p className="text-[10px] text-rose-500 font-extrabold uppercase tracking-wide">💵 Khoản Cho Vay</p>
                                            <h4 className="text-lg font-black text-rose-600 mt-1">
                                                {formatCurrency(
                                                    state.debts
                                                        .filter(d => d.type === 'lend')
                                                        .reduce((sum, d) => sum + Number(d.remaining_amount), 0),
                                                    lang
                                                )}
                                            </h4>
                                        </div>
                                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
                                            <p className="text-[10px] text-emerald-500 font-extrabold uppercase tracking-wide">💸 Khoản Đi Vay </p>
                                            <h4 className="text-lg font-black text-emerald-600 mt-1">
                                                {formatCurrency(
                                                    state.debts
                                                        .filter(d => d.type === 'borrow')
                                                        .reduce((sum, d) => sum + Number(d.remaining_amount), 0),
                                                    lang
                                                )}
                                            </h4>
                                        </div>
                                    </div>

                                    {/* Action to create new debt */}
                                    <button
                                        onClick={() => setIsAddDebtOpen(true)}
                                        className="w-full py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-extrabold rounded-2xl text-xs hover:from-indigo-600 hover:to-indigo-700 transition flex items-center justify-center gap-2 shadow-sm border border-indigo-200/10"
                                    >
                                        <Plus size={16} /> Tạo khoản Vay / Mượn mới
                                    </button>

                                    {/* List of debts */}
                                    <div className="space-y-3.5">
                                        <h4 className="font-extrabold text-xs text-gray-500 uppercase tracking-wider ml-1">Danh sách khoản nợ đang theo dõi</h4>

                                        {state.debts.length === 0 ? (
                                            <div className="py-8 text-center text-gray-400 text-xs italic">
                                                Bạn chưa có ghi chép vay mượn nào.
                                            </div>
                                        ) : (
                                            state.debts.map(d => {
                                                const isLend = d.type === 'lend';
                                                const isPaid = d.status === 'paid';
                                                const isExpanded = expandedDebtHistoryId === d.id;

                                                const toggleExpand = async () => {
                                                    if (isExpanded) {
                                                        setExpandedDebtHistoryId(null);
                                                    } else {
                                                        setExpandedDebtHistoryId(d.id);
                                                        // Fetch repayments history for this debt
                                                        const { debtService } = await import('../services/debtService');
                                                        const reps = await debtService.fetchRepayments(d.id);
                                                        setRepaymentsCache(prev => ({
                                                            ...prev,
                                                            [d.id]: reps
                                                        }));
                                                    }
                                                };

                                                return (
                                                    <div
                                                        key={d.id}
                                                        className={`border rounded-2xl p-4 transition-all relative overflow-hidden bg-white hover:border-gray-300 ${isPaid ? 'border-gray-200/50 bg-gray-50/40 opacity-70' : 'border-gray-150'
                                                            }`}
                                                    >
                                                        {/* Lend/Borrow icon tag */}
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${isLend
                                                                    ? 'bg-rose-50 text-rose-600 border-rose-100'
                                                                    : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                                    }`}>
                                                                    {isLend ? 'Cho vay' : 'Đi vay'}
                                                                </span>
                                                                <span className="font-extrabold text-sm text-gray-800">{d.partner_name}</span>
                                                            </div>
                                                            <button
                                                                onClick={() => onDeleteDebt(d.id)}
                                                                className="text-gray-400 hover:text-red-500 p-1 rounded-lg"
                                                                title="Xóa"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>

                                                        {/* Amount details */}
                                                        <div className="grid grid-cols-2 gap-2 my-2.5">
                                                            <div>
                                                                <p className="text-[9px] font-bold text-gray-400 uppercase">Khoản gốc</p>
                                                                <p className="text-xs font-bold text-gray-700">{formatCurrency(d.amount, lang)}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-[9px] font-bold text-gray-400 uppercase">Còn lại</p>
                                                                <p className={`text-sm font-black ${isPaid ? 'text-gray-400 line-through' : isLend ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                                    {formatCurrency(d.remaining_amount, lang)}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-400 mb-3 font-medium">
                                                            <span>Ngày vay: {d.date_lent.split('-').reverse().join('/')}</span>
                                                            {d.due_date && <span className="text-red-500 font-bold">Hạn trả: {d.due_date.split('-').reverse().join('/')}</span>}
                                                            {d.description && <span className="w-full text-gray-500 italic">Ghi chú: {d.description}</span>}
                                                        </div>

                                                        {/* Actions & Repayment expand button */}
                                                        <div className="flex justify-between items-center border-t border-gray-100 pt-3 flex-wrap gap-2">
                                                            <button
                                                                onClick={toggleExpand}
                                                                className="text-[10px] font-extrabold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                                                            >
                                                                {isExpanded ? 'Ẩn lịch sử' : 'Xem lịch sử trả nợ'}
                                                                <ChevronDown size={12} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                                            </button>

                                                            {!isPaid && (
                                                                <button
                                                                    onClick={() => {
                                                                        setActiveDebtForRepay(d);
                                                                        setRepayAmount(d.remaining_amount.toString());
                                                                        setRepayDate(new Date().toISOString().split('T')[0]);
                                                                        setRepayWalletId('');
                                                                    }}
                                                                    className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-extrabold text-[10px] rounded-xl transition"
                                                                >
                                                                    Trả nợ / Trả bớt 💸
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* Repayments History Container */}
                                                        {isExpanded && (
                                                            <div className="mt-3.5 border-t border-dashed border-gray-200 pt-3 animate-in slide-in-from-top-2">
                                                                <p className="text-[9px] font-black text-gray-400 uppercase mb-2 tracking-wider">Nhật ký các đợt thanh toán</p>

                                                                {(!repaymentsCache[d.id] || repaymentsCache[d.id].length === 0) ? (
                                                                    <p className="text-[10px] text-gray-400 italic text-center py-2">Chưa ghi nhận đợt trả nào.</p>
                                                                ) : (
                                                                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                                                                        {repaymentsCache[d.id].map(r => (
                                                                            <div key={r.id} className="bg-gray-50 p-2 rounded-xl border border-gray-100 text-[10px] flex justify-between items-center">
                                                                                <div>
                                                                                    <span className="font-bold text-gray-700">{r.payment_date.split('-').reverse().join('/')}</span>
                                                                                    {r.note && <span className="text-gray-400 ml-1.5">({r.note})</span>}
                                                                                </div>
                                                                                <span className="font-black text-emerald-600">
                                                                                    +{formatCurrency(r.amount, lang)}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Lịch sử giao dịch của Ví/Quỹ */}
            {isWalletHistoryModalOpen && selectedWalletForHistory && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col transform transition-all scale-100 animate-scale-up border border-gray-100">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                                    <FileText className="text-sky-600" size={20} />
                                    Lịch sử dòng tiền: {selectedWalletForHistory.name}
                                </h3>
                                <p className="text-[11px] text-gray-500 font-medium">
                                    {selectedWalletForHistory.type === 'fund' 
                                        ? `Quỹ mục đích • Hạn mức: ${formatCurrency(selectedWalletForHistory.initial_balance, lang)}` 
                                        : `Tài khoản / Ví • Loại: ${
                                            selectedWalletForHistory.type === 'bank' ? 'Ngân hàng' :
                                            selectedWalletForHistory.type === 'credit' ? 'Thẻ tín dụng' :
                                            selectedWalletForHistory.type === 'savings' ? 'Tiết kiệm' :
                                            selectedWalletForHistory.type === 'e-wallet' ? 'Ví điện tử' : 'Tiền mặt'
                                          }`
                                    }
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setIsWalletHistoryModalOpen(false);
                                    setSelectedWalletForHistory(null);
                                }}
                                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Summary Widget */}
                        <div className="bg-sky-50/50 p-4 border-b border-gray-100 flex justify-between items-center px-6 flex-shrink-0">
                            <span className="text-xs font-bold text-gray-500 uppercase font-sans">Số dư hiện tại</span>
                            <span className="text-lg font-black text-sky-700 font-sans">
                                {hideBalance ? '••••••' : formatCurrency(selectedWalletForHistory.balance, lang)}
                            </span>
                        </div>

                        {/* List of transactions */}
                        <div className="overflow-y-auto p-6 flex-1 custom-scrollbar space-y-3">
                            {(() => {
                                const walletTransactions = transactions
                                    .filter(t => t.wallet_id === selectedWalletForHistory.id)
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                                if (walletTransactions.length === 0) {
                                    return (
                                        <div className="py-16 text-center text-gray-400">
                                            <FileText size={40} className="mx-auto mb-3 opacity-30" />
                                            <p className="font-semibold text-sm">Chưa có giao dịch nào liên kết với ví/quỹ này</p>
                                        </div>
                                    );
                                }

                                return walletTransactions.map(t => {
                                    const isIncome = t.type === TransactionType.INCOME;
                                    const catStyles = getCategoryStyles(t.category);
                                    const IconComponent = catStyles.icon;

                                    return (
                                        <div key={t.id} className="flex justify-between items-center p-3.5 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white transition duration-200">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${catStyles.bgClass}`}>
                                                    {catStyles.emoji ? (
                                                        <span className="text-sm">{catStyles.emoji}</span>
                                                    ) : (
                                                        <IconComponent size={15} />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-gray-700">{t.description || t.category}</div>
                                                    <div className="text-[10px] text-gray-400 font-semibold mt-0.5">
                                                        {t.date.split('-').reverse().join('/')} • {t.category}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={`font-black text-sm ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {isIncome ? '+' : '-'}{formatCurrency(t.amount, lang)}
                                            </span>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </div>
            )}


        </div>
    );
};

export default FinanceDashboard;
