// File: src/components/AIAdvisorPage.tsx
// Full-page AI Financial Advisor Canvas v2
// — Function Calling, Inline Charts, NL Actions

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    ArrowLeft, Send, Sparkles, Loader2, Bot, RefreshCw,
    TrendingDown, Target, ListChecks, BarChart3, Wallet,
    PiggyBank, CalendarCheck, Brain, Lightbulb, ChevronRight,
    CheckCircle2, AlertCircle
} from 'lucide-react';
import { AppState, TransactionType } from '../types';
import { generateQuickInsight, getCurrentModel, type ChatMessage } from '../services/geminiService';
import { chatWithAI, type ActionHandlers, type ChartData, type ActionResult } from '../services/aiEngine';
import { chatHistoryService, type AIConversation } from '../services/chatHistoryService';
import { memoryService } from '../services/memoryService';
import InlineChatChart from './InlineChatChart';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ────────────────────────────────────────
// Types
// ────────────────────────────────────────
interface AIAdvisorPageProps {
    appState: AppState;
    lang: 'vi' | 'en';
    onBack: () => void;
    // Action handlers from App.tsx
    onAddTimetable?: (item: any) => Promise<void>;
    onAddTodo?: (content: string, priority: string, deadline?: string) => Promise<void>;
    onAddTransaction?: (tx: any) => Promise<void>;
}

interface UIMessage {
    role: 'user' | 'assistant';
    content: string;
    charts?: ChartData[];
    actions?: ActionResult[];
}

// ────────────────────────────────────────
// Suggestion Chips
// ────────────────────────────────────────
interface Suggestion {
    icon: React.ReactNode;
    label: string;
    prompt: string;
    gradient: string;
}

const SUGGESTIONS: Suggestion[] = [
    {
        icon: <BarChart3 size={16} />,
        label: 'Phân tích & Dự đoán',
        prompt: 'Hãy phân tích chi tiết chi tiêu tháng này của tôi bằng bảng (table) theo danh mục và đưa ra dự đoán chi tiêu cho tháng tới.',
        gradient: 'from-blue-500 to-cyan-500',
    },
    {
        icon: <TrendingDown size={16} />,
        label: 'Xu hướng chi tiêu',
        prompt: 'Hãy truy vấn giao dịch các tháng qua, dùng bảng (table) so sánh xu hướng thu chi và đánh giá mức độ ổn định của tôi.',
        gradient: 'from-amber-500 to-orange-500',
    },
    {
        icon: <Target size={16} />,
        label: 'Tiến độ mục tiêu',
        prompt: 'Hãy đánh giá tiến độ các mục tiêu tài chính của tôi. Tôi cần tiết kiệm bao nhiêu mỗi tháng để đạt được chúng?',
        gradient: 'from-purple-500 to-pink-500',
    },
    {
        icon: <PiggyBank size={16} />,
        label: 'Tư vấn tiết kiệm',
        prompt: 'Nhìn vào dữ liệu chi tiêu hiện tại, hãy đề xuất 3-5 cách cụ thể tôi có thể tiết kiệm thêm mỗi tháng. Ước tính số tiền tiết kiệm được.',
        gradient: 'from-emerald-500 to-teal-500',
    },
    {
        icon: <ListChecks size={16} />,
        label: 'Đánh giá ngân sách',
        prompt: 'Hãy truy vấn ngân sách và giao dịch tháng này, vẽ biểu đồ cột (bar) so sánh ngân sách vs thực tế và đưa ra nhận xét.',
        gradient: 'from-rose-500 to-red-500',
    },
    {
        icon: <CalendarCheck size={16} />,
        label: 'Thêm lịch trình mới',
        prompt: 'Tôi muốn thêm lịch trình mới. Hãy hỏi tôi về tên sự kiện, ngày, giờ để thêm vào.',
        gradient: 'from-indigo-500 to-violet-500',
    },
];

// ────────────────────────────────────────
// Helpers
// ────────────────────────────────────────
function formatCurrency(amount: number): string {
    return amount.toLocaleString('vi-VN') + 'đ';
}

// ────────────────────────────────────────
// Component
// ────────────────────────────────────────
const AIAdvisorPage: React.FC<AIAdvisorPageProps> = ({
    appState, lang, onBack,
    onAddTimetable, onAddTodo, onAddTransaction
}) => {
    const [messages, setMessages] = useState<UIMessage[]>([
        {
            role: 'assistant',
            content: '👋 Chào bạn! Mình là **SmartLife Advisor v2** — trợ lý AI thông minh.\n\n🆕 **Khả năng mới:**\n- 📊 **Truy vấn dữ liệu** trực tiếp từ database\n- 📈 **Bảng tính (table) & Dự đoán** chi tiêu\n- ✏️ **Thêm lịch trình, việc cần làm, giao dịch** bằng ngôn ngữ tự nhiên\n\n💡 **Thử hỏi mình:**\n- _"Đưa ra dự đoán chi tiêu tháng tới cho tôi"_\n- _"Lập bảng so sánh thu chi 3 tháng gần nhất"_\n- _"Thêm lịch học IELTS thứ 3, thứ 5 lúc 19h"_\n\nHoặc chọn gợi ý bên dưới! 👇'
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [quickInsight, setQuickInsight] = useState<string | null>(null);
    const [isLoadingInsight, setIsLoadingInsight] = useState(false);

    // History and Memory State
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [memoryContext, setMemoryContext] = useState<string>('');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Action handlers for aiEngine
    const actionHandlers: ActionHandlers = {
        onAddTimetable,
        onAddTodo,
        onAddTransaction,
    };

    // Auto scroll
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
    useEffect(() => { inputRef.current?.focus(); }, []);

    // Load quick insight — delayed 5s to avoid competing with chat for rate limit
    useEffect(() => {
        const timer = setTimeout(async () => {
            setIsLoadingInsight(true);
            try {
                const insight = await generateQuickInsight(appState);
                setQuickInsight(insight);
            } catch (e) {
                console.error('Quick insight error:', e);
                setQuickInsight(null);
            } finally {
                setIsLoadingInsight(false);
            }
        }, 5000);
        return () => clearTimeout(timer);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Load memory context on mount
    useEffect(() => {
        memoryService.getMemoryContextString()
            .then(setMemoryContext)
            .catch(console.error);
    }, []);

    // Build chat history for Gemini (convert UIMessage → ChatMessage)
    const buildHistory = (msgs: UIMessage[]): ChatMessage[] => {
        return msgs
            .filter(m => m.role !== 'assistant' || msgs.indexOf(m) > 0) // skip initial greeting
            .map(m => ({
                role: m.role === 'user' ? 'user' as const : 'model' as const,
                parts: [{ text: m.content }]
            }));
    };

    // Send message — uses new aiEngine with function calling
    const handleSend = async (overrideMessage?: string) => {
        const msg = overrideMessage || input.trim();
        if (!msg || isLoading) return;

        setInput('');
        const newMessages: UIMessage[] = [...messages, { role: 'user', content: msg }];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            // Save conversation & user message to DB
            let currentConvId = conversationId;
            if (!currentConvId) {
                const conv = await chatHistoryService.createConversation(msg.substring(0, 50) + '...');
                if (conv) {
                    currentConvId = conv.id;
                    setConversationId(currentConvId);
                }
            }
            if (currentConvId) {
                await chatHistoryService.saveMessage(currentConvId, 'user', msg);
            }

            const history = buildHistory(newMessages);
            const response = await chatWithAI(history, appState, actionHandlers, memoryContext);

            // Save AI response to DB
            if (currentConvId) {
                await chatHistoryService.saveMessage(
                    currentConvId,
                    'assistant',
                    response.text,
                    response.charts.length > 0 ? response.charts : undefined,
                    response.actions.length > 0 ? response.actions : undefined
                );
            }

            // Extract memories periodically (e.g. if conversation has grown)
            if (newMessages.length > 3 && newMessages.length % 4 === 1) {
                // Run in background
                const chatText = newMessages.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n');
                memoryService.extractMemoriesFromConversation(chatText).catch(console.error);
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: response.text,
                charts: response.charts.length > 0 ? response.charts : undefined,
                actions: response.actions.length > 0 ? response.actions : undefined,
            }]);
        } catch (error: any) {
            console.error(error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `⚠️ Xin lỗi, đã có lỗi xảy ra: ${error.message}\n\nVui lòng thử lại.`
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleReset = () => {
        setConversationId(null);
        setMessages([{
            role: 'assistant',
            content: '🔄 Cuộc trò chuyện đã được làm mới! Mình sẵn sàng phân tích dữ liệu cho bạn. 🌱'
        }]);
    };

    const showSuggestions = messages.length <= 1 && !isLoading;

    // ── Quick Stats ──
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthTx = appState.transactions.filter(t => t.date.startsWith(currentMonth));
    const monthIncome = monthTx.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
    const monthExpense = monthTx.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
    const totalIncomeAll = appState.transactions.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
    const totalExpenseAll = appState.transactions.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
    const totalBalance = totalIncomeAll - totalExpenseAll;
    const totalSavings = appState.goals
        .filter(g => g.target_amount && g.target_amount > 0)
        .reduce((sum, g) => sum + (g.current_amount || 0), 0);
    const savingsPercentOfIncome = monthIncome > 0 ? Math.round((totalSavings / monthIncome) * 100) : 0;

    return (
        <div className="animate-fade-in -m-4 md:-m-8 -mt-20 md:-mt-8 min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onBack}
                            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500 hover:text-gray-700"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                <Brain size={20} className="text-white" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-800 text-lg leading-tight">SmartLife AI Advisor</h1>
                                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    Gemini ({getCurrentModel().replace('gemini-', '')}) · Function Calling · Truy vấn DB trực tiếp
                                </div>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleReset}
                        className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
                        title="Làm mới cuộc trò chuyện"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-0 lg:gap-6 px-0 lg:px-8 pt-0 lg:pt-6" style={{ height: 'calc(100vh - 65px)' }}>

                {/* ── Sidebar (Desktop only) ── */}
                <div className="hidden lg:flex flex-col w-80 shrink-0 gap-4 overflow-y-auto pb-6 pr-2 custom-scrollbar">
                    {/* Quick Stats */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                            <Wallet size={16} className="text-indigo-500" /> Tóm tắt T{now.getMonth() + 1}
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500">Số dư</span>
                                <span className="font-bold text-gray-800 text-sm">{formatCurrency(totalBalance)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500">Thu nhập</span>
                                <span className="font-semibold text-emerald-600 text-sm">+{formatCurrency(monthIncome)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500">Chi tiêu</span>
                                <span className="font-semibold text-red-500 text-sm">-{formatCurrency(monthExpense)}</span>
                            </div>
                            <div className="pt-2 border-t border-gray-50">
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-xs text-gray-500">Tổng quỹ tiết kiệm</span>
                                    <span className="font-bold text-sm text-indigo-600">{formatCurrency(totalSavings)}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div
                                        className="h-2 rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 transition-all duration-700 max-w-full"
                                        style={{ width: `${Math.max(Math.min(savingsPercentOfIncome, 100), 5)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AI Quick Insight */}
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-5">
                        <h3 className="text-sm font-bold text-indigo-700 mb-3 flex items-center gap-2">
                            <Lightbulb size={16} className="text-amber-500" /> Nhận xét nhanh
                        </h3>
                        {isLoadingInsight ? (
                            <div className="flex items-center gap-2 text-indigo-400 text-sm">
                                <Loader2 size={14} className="animate-spin" /> Đang phân tích...
                            </div>
                        ) : quickInsight ? (
                            <div className="text-sm text-indigo-900/80 leading-relaxed prose prose-sm prose-p:my-1">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{quickInsight}</ReactMarkdown>
                            </div>
                        ) : (
                            <p className="text-sm text-indigo-400">Không thể tải nhận xét. Hãy thử hỏi AI trực tiếp.</p>
                        )}
                    </div>

                    {/* Goals Summary */}
                    {appState.goals.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                <Target size={16} className="text-purple-500" /> Mục tiêu
                            </h3>
                            <div className="space-y-3">
                                {appState.goals.slice(0, 3).map(g => {
                                    const pct = g.target_amount && g.current_amount
                                        ? Math.round((g.current_amount / g.target_amount) * 100)
                                        : (g.progress || 0);
                                    return (
                                        <div key={g.id}>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="font-medium text-gray-700 truncate">{g.title}</span>
                                                <span className="text-gray-500 ml-2">{pct}%</span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                <div
                                                    className="h-1.5 rounded-full bg-gradient-to-r from-purple-400 to-pink-500 transition-all duration-500"
                                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Chat Area ── */}
                <div className="flex-1 flex flex-col min-h-0 bg-white lg:rounded-t-2xl lg:border lg:border-gray-100 lg:shadow-sm overflow-hidden">
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex items-end gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-fade-in`}>
                                {/* Avatar */}
                                {msg.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-sm">
                                        <Sparkles size={14} className="text-white" />
                                    </div>
                                )}

                                {/* Bubble */}
                                <div className={`max-w-[85%] lg:max-w-[75%] ${msg.role === 'user' ? '' : ''}`}>
                                    <div className={`px-4 py-3 text-sm leading-relaxed shadow-sm
                                        ${msg.role === 'user'
                                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl rounded-br-md prose-invert prose-p:text-white prose-headings:text-white'
                                            : 'bg-gray-50 text-gray-700 border border-gray-100 rounded-2xl rounded-bl-md prose prose-sm prose-p:my-1.5 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-indigo-700 prose-h3:text-base prose-h3:mt-3 prose-h3:mb-1'
                                        }`}
                                    >
                                        {msg.role === 'assistant' ? (
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    table: ({ node, ...props }) => <div className="overflow-x-auto my-4"><table className="w-full border-collapse border border-indigo-200 text-sm" {...props} /></div>,
                                                    thead: ({ node, ...props }) => <thead className="bg-indigo-50" {...props} />,
                                                    th: ({ node, ...props }) => <th className="border border-indigo-200 px-4 py-2 text-left font-semibold text-indigo-900" {...props} />,
                                                    td: ({ node, ...props }) => <td className="border border-indigo-100 px-4 py-2 text-gray-700" {...props} />,
                                                    tr: ({ node, ...props }) => <tr className="even:bg-gray-50/50" {...props} />
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        ) : (
                                            msg.content
                                        )}
                                    </div>

                                    {/* Action Confirmations */}
                                    {msg.actions && msg.actions.length > 0 && (
                                        <div className="mt-2 space-y-1.5">
                                            {msg.actions.map((action, ai) => (
                                                <div
                                                    key={ai}
                                                    className={`flex items-start gap-2 px-3 py-2 rounded-xl text-xs ${
                                                        action.success
                                                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                                            : 'bg-red-50 border border-red-200 text-red-700'
                                                    }`}
                                                >
                                                    {action.success
                                                        ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                                                        : <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                                                    }
                                                    <span>{action.message}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Inline Charts */}
                                    {msg.charts && msg.charts.length > 0 && (
                                        <div className="mt-2 space-y-2">
                                            {msg.charts.map((chart, ci) => (
                                                <InlineChatChart key={ci} chart={chart} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Loading */}
                        {isLoading && (
                            <div className="flex items-end gap-2.5 animate-fade-in">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                                    <Sparkles size={14} className="text-white" />
                                </div>
                                <div className="bg-gray-50 px-5 py-4 rounded-2xl rounded-bl-md border border-gray-100 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                        <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                        <span className="w-2 h-2 bg-pink-400 rounded-full animate-bounce"></span>
                                        <span className="text-xs text-gray-400 ml-2">Đang phân tích & truy vấn dữ liệu...</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Suggestions */}
                        {showSuggestions && (
                            <div className="pt-3">
                                <p className="text-[11px] text-gray-400 font-semibold mb-3 uppercase tracking-wider flex items-center gap-1.5">
                                    <Lightbulb size={12} /> Gợi ý câu hỏi
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {SUGGESTIONS.map((s, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleSend(s.prompt)}
                                            className="group text-left p-3.5 rounded-xl border border-gray-100 bg-white hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex items-start gap-3"
                                        >
                                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${s.gradient} flex items-center justify-center text-white shrink-0 shadow-sm group-hover:scale-110 transition-transform`}>
                                                {s.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className="text-xs font-semibold text-gray-700 leading-tight block">{s.label}</span>
                                                <ChevronRight size={12} className="text-gray-300 mt-1 group-hover:text-indigo-400 transition-colors" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 md:p-4 bg-white border-t border-gray-100 shrink-0">
                        <div className="relative flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder='Hỏi, phân tích, hoặc ra lệnh: "Thêm lịch học IELTS T3 T5 19h"...'
                                className="flex-1 bg-transparent px-4 py-3 text-sm outline-none resize-none max-h-28 min-h-[48px] placeholder:text-gray-400"
                                rows={1}
                            />
                            <button
                                onClick={() => handleSend()}
                                disabled={!input.trim() || isLoading}
                                className="m-1.5 p-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-200 disabled:opacity-40 disabled:hover:shadow-none transition-all shrink-0"
                            >
                                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                            </button>
                        </div>
                        <p className="text-[9px] text-center text-gray-400 mt-2">
                            Powered by Gemini ({getCurrentModel().replace('gemini-', '')}) · Function Calling · Truy vấn DB trực tiếp · AI có thể mắc lỗi
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIAdvisorPage;
