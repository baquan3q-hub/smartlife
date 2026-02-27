import React, { useMemo, useState } from 'react';
import { AppState, TransactionType } from '../types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';
import { TrendingUp, Activity, ArrowLeft } from 'lucide-react';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#3B82F6', '#14B8A6', '#F97316', '#64748B'];

interface CashFlowDashboardProps {
    state: AppState;
    lang: 'vi' | 'en';
    onBack: () => void;
}

const formatCurrency = (amount: number, lang: 'vi' | 'en') => {
    return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', { style: 'currency', currency: lang === 'vi' ? 'VND' : 'USD' }).format(lang === 'vi' ? amount : amount / 25000);
};

const CashFlowDashboard: React.FC<CashFlowDashboardProps> = ({ state, lang, onBack }) => {
    const { transactions } = state;
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());

    const changeMonth = (offset: number) => {
        let newMonth = selectedMonth + offset;
        let newYear = selectedYear;
        if (newMonth > 11) { newMonth = 0; newYear++; }
        if (newMonth < 0) { newMonth = 11; newYear--; }
        setSelectedMonth(newMonth);
        setSelectedYear(newYear);
    };

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

    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in pb-20">
            {/* Header with Back button */}
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Dòng tiền</h2>
                    <p className="text-gray-400 text-sm">Báo cáo thu - chi chi tiết</p>
                </div>
            </div>

            {/* Filter */}
            <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-2 py-1.5 md:px-3 md:py-2 shadow-sm w-fit mb-6">
                <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-indigo-600 transition-colors">❮</button>
                <span className="mx-2 md:mx-3 font-semibold text-gray-700 min-w-[90px] md:min-w-[100px] text-center text-sm md:text-base">Tháng {selectedMonth + 1}/{selectedYear}</span>
                <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-indigo-600 transition-colors">❯</button>
            </div>

            <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <TrendingUp className="text-emerald-600" /> Báo cáo Dòng tiền tháng {selectedMonth + 1}/{selectedYear}
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Cash Flow Bar Chart - Income vs Expense by Category */}
                        <div>
                            <h4 className="text-md font-bold text-gray-700 mb-4 text-center">Xếp hạng Thu - Chi</h4>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        layout="vertical"
                                        data={[
                                            { name: 'Tổng thu', amount: stats.currentMonthIncome, fill: '#10B981' },
                                            { name: 'Tổng chi', amount: stats.currentMonthExpense, fill: '#EF4444' }
                                        ]}
                                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#4B5563', fontWeight: 600 }} width={80} />
                                        <Tooltip
                                            cursor={{ fill: 'transparent' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                            formatter={(value: any) => formatCurrency(value as number, lang)}
                                        />
                                        <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={30}>
                                            {
                                                [
                                                    { name: 'Tổng thu', amount: stats.currentMonthIncome, fill: '#10B981' },
                                                    { name: 'Tổng chi', amount: stats.currentMonthExpense, fill: '#EF4444' }
                                                ].map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))
                                            }
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        {/* Cash Flow Pie Chart - Detailed Structure */}
                        <div>
                            <h4 className="text-md font-bold text-gray-700 mb-4 text-center">Cơ cấu chi tiêu chi tiết</h4>
                            <div className="h-64 w-full relative">
                                {stats.categoryData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={stats.categoryData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={90}
                                                paddingAngle={2}
                                                dataKey="value"
                                                label={({ name, percent }: any) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                                                labelLine={false}
                                            >
                                                {stats.categoryData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value: any) => formatCurrency(Number(value), lang)} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                        Chưa có dữ liệu chi tiêu tháng này
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Area Chart - Spending Trends */}
                    <div className="mt-8 pt-8 border-t border-gray-100">
                        <h4 className="text-md font-bold text-gray-700 mb-6 flex items-center justify-center gap-2">
                            <Activity className="text-indigo-600" /> Xu hướng chi tiêu 6 tháng
                        </h4>
                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.monthlyChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280' }} />
                                    <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`} tick={{ fill: '#6B7280' }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                        formatter={(value: any) => formatCurrency(Number(value), lang)}
                                    />
                                    <Area type="monotone" dataKey="expense" name="Chi tiêu" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorTrend)" />
                                    <Area type="monotone" dataKey="income" name="Thu nhập" stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" fill="transparent" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CashFlowDashboard;
