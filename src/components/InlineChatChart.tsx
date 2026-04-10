// File: src/components/InlineChatChart.tsx
// Inline chart component for AI chat — renders inside chat bubbles
// Uses Recharts (already in package.json)

import React from 'react';
import {
    PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import type { ChartData } from '../services/aiEngine';

// ── Default color palette ──
const COLORS = [
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#06b6d4', '#3b82f6', '#818cf8', '#c084fc'
];

function getColor(index: number, customColor?: string): string {
    return customColor || COLORS[index % COLORS.length];
}

// ── Custom tooltip ──
const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-gray-100 text-xs">
            {label && <p className="font-semibold text-gray-700 mb-1">{label}</p>}
            {payload.map((item: any, i: number) => (
                <p key={i} style={{ color: item.color || item.fill }}>
                    {item.name}: <span className="font-bold">{Number(item.value).toLocaleString('vi-VN')}đ</span>
                </p>
            ))}
        </div>
    );
};

// ── Custom label for Pie chart ──
const renderPieLabel = ({ name, percent }: any) => {
    if (percent < 0.05) return null; // Skip tiny slices
    return `${name} (${(percent * 100).toFixed(0)}%)`;
};

// ── Main Component ──
interface InlineChatChartProps {
    chart: ChartData;
}

const InlineChatChart: React.FC<InlineChatChartProps> = ({ chart }) => {
    const { chart_type, title, data } = chart;

    if (!data || data.length === 0) {
        return (
            <div className="bg-gray-50 rounded-xl p-4 text-center text-gray-400 text-sm">
                Không có dữ liệu để hiển thị biểu đồ
            </div>
        );
    }

    // Prepare data — rename keys for Recharts
    const chartData = data.map((d, i) => ({
        name: d.label,
        value: d.value,
        fill: getColor(i, d.color)
    }));

    const renderChart = () => {
        switch (chart_type) {
            case 'pie':
                return (
                    <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                outerRadius={90}
                                innerRadius={45}
                                paddingAngle={3}
                                dataKey="value"
                                label={renderPieLabel}
                                labelLine={true}
                            >
                                {chartData.map((entry, i) => (
                                    <Cell key={i} fill={entry.fill} stroke="white" strokeWidth={2} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                );

            case 'bar':
                return (
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                interval={0}
                                angle={-30}
                                textAnchor="end"
                                height={60}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: '#9ca3af' }}
                                tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={50}>
                                {chartData.map((entry, i) => (
                                    <Cell key={i} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'line':
                return (
                    <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
                            <YAxis
                                tick={{ fontSize: 10, fill: '#9ca3af' }}
                                tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke="#6366f1"
                                strokeWidth={2.5}
                                dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, fill: '#4f46e5' }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                );

            case 'area':
                return (
                    <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
                            <YAxis
                                tick={{ fontSize: 10, fill: '#9ca3af' }}
                                tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke="#6366f1"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorValue)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                );

            default:
                return <p className="text-gray-400 text-sm">Loại biểu đồ không hỗ trợ: {chart_type}</p>;
        }
    };

    return (
        <div className="my-3 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
            </div>

            {/* Chart */}
            <div className="px-2 pb-3">
                {renderChart()}
            </div>
        </div>
    );
};

export default InlineChatChart;
