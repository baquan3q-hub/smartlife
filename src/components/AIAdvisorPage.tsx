// File: src/components/AIAdvisorPage.tsx
// Full-page AI Financial Advisor Canvas v2
// — Function Calling, Inline Charts, NL Actions

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    ArrowLeft, Send, Sparkles, Loader2, Bot, RefreshCw,
    TrendingDown, Target, ListChecks, BarChart3, Wallet,
    PiggyBank, CalendarCheck, Brain, Lightbulb, ChevronRight,
    CheckCircle2, AlertCircle, History, X, Plus, Trash2, GraduationCap
} from 'lucide-react';
import { AppState, TransactionType } from '../types';
import { generateQuickInsight, getCurrentModel, type ChatMessage } from '../services/geminiService';
import { chatWithAI, type ActionHandlers, type ChartData, type ActionResult } from '../services/aiEngine';
import { chatHistoryService, type AIConversation, type AIMessage } from '../services/chatHistoryService';
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
        prompt: 'Hãy truy vấn giao dịch các tháng qua, dùng bảng (table) so sánh xu hướng thu chi và đánh giá mức độ ổn định của tôi qua biểu đồ đường và cột.',
        gradient: 'from-amber-500 to-orange-500',
    },
    {
        icon: <Target size={16} />,
        label: 'Tiến độ mục tiêu',
        prompt: 'Hãy đánh giá tiến độ các task và todolist deadline và các mục tiêu tài chính của tôi. Tôi cần tiết kiệm bao nhiêu mỗi tháng để đạt được chúng?',
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
        label: 'Lịch Trình và Việc Cần Làm',
        prompt: 'Liệt kê lịch trình của tôi tuần này và các nhiệm vụ tôi đặt ra ?.',
        gradient: 'from-indigo-500 to-violet-500',
    },
    {
        icon: <GraduationCap size={16} />,
        label: 'Tư vấn lộ trình GPA',
        prompt: 'Dựa vào điểm GPA hiện tại của tôi hãy ước tính tôi cần đạt được học lực loại gì cho các kỳ sau để đạt được hạng bằng Giỏi khi tốt nghiệp.',
        gradient: 'from-sky-500 to-indigo-500',
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
    const [conversations, setConversations] = useState<AIConversation[]>([]);
    const [showHistory, setShowHistory] = useState(false);

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

    // Load conversations when the component mounts or when conversationId changes
    useEffect(() => {
        chatHistoryService.getConversations().then(setConversations);
    }, [conversationId]);

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
        setShowHistory(false);
    };

    const loadConversation = async (convId: string) => {
        setIsLoading(true);
        try {
            const msgs: AIMessage[] = await chatHistoryService.getMessages(convId);
            const uiMsgs: UIMessage[] = msgs.map((m: AIMessage) => ({
                role: m.role,
                content: m.content,
                charts: m.charts || undefined,
                actions: m.actions || undefined
            }));
            setMessages(uiMsgs.length > 0 ? uiMsgs : [{
                role: 'assistant',
                content: 'Cuộc trò chuyện này trống. Hãy bắt đầu hỏi gì đó!'
            }]);
            setConversationId(convId);
            setShowHistory(false);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
        e.stopPropagation();
        const success = await chatHistoryService.deleteConversation(convId);
        if (success) {
            setConversations(prev => prev.filter(c => c.id !== convId));
            if (conversationId === convId) {
                handleReset();
            }
        }
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
        <div className="animate-fade-in fixed inset-0 md:relative md:inset-auto bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex flex-col h-[100dvh] md:h-auto z-40 md:z-auto">
            {/* History Overlay/Drawer */}
            {showHistory && (
                <div className="fixed inset-0 z-50 flex">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
                    <div className="relative w-80 max-w-[85%] h-full bg-white shadow-2xl flex flex-col animate-fade-in-right">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h2 className="font-bold text-gray-800 flex items-center gap-2">
                                <History size={18} className="text-indigo-500" />
                                Lịch sử trò chuyện
                            </h2>
                            <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-gray-200 rounded-lg">
                                <X size={18} className="text-gray-500" />
                            </button>
                        </div>

                        <div className="p-3">
                            <button
                                onClick={handleReset}
                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 font-medium transition-colors text-sm"
                            >
                                <Plus size={16} /> Cuộc trò chuyện mới
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1 custom-scrollbar">
                            {conversations.length === 0 ? (
                                <p className="text-center text-sm text-gray-400 mt-10">Chưa có lịch sử</p>
                            ) : (
                                conversations.map(conv => (
                                    <div
                                        key={conv.id}
                                        onClick={() => loadConversation(conv.id)}
                                        className={`group px-3 py-3 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${conversationId === conv.id ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-gray-50 border border-transparent'}`}
                                    >
                                        <div className="flex-1 min-w-0 pr-2">
                                            <p className={`text-sm truncate font-medium ${conversationId === conv.id ? 'text-indigo-700' : 'text-gray-700'}`}>{conv.title}</p>
                                            <p className="text-[10px] text-gray-400 mt-0.5">{new Date(conv.updated_at).toLocaleDateString('vi-VN')}</p>
                                        </div>
                                        <button
                                            onClick={(e) => handleDeleteConversation(e, conv.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 hover:text-red-600 text-gray-400 rounded-lg transition-all"
                                            title="Xóa"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 md:px-8 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onBack}
                            className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-500 hover:text-gray-700"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-100">
                                <Brain size={16} className="text-white" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-800 text-sm leading-tight">SmartLife AI Advisor</h1>
                                <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    Gemini AI Advisor ({getCurrentModel().replace('gemini-', '')})
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setShowHistory(true)}
                            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500 hover:text-indigo-600 flex items-center gap-1.5"
                            title="Lịch sử chat"
                        >
                            <History size={16} />
                            <span className="text-xs font-medium hidden sm:inline">Lịch sử</span>
                        </button>
                        <button
                            onClick={handleReset}
                            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600 hidden sm:flex items-center"
                            title="Làm mới cuộc trò chuyện"
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto flex-1 flex flex-col lg:flex-row gap-0 lg:gap-6 px-0 lg:px-8 pt-0 lg:pt-2 overflow-hidden w-full min-h-0">

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
                                <Target size={16} className="text-purple-500" /> Mục tiêu ({appState.goals.length})
                            </h3>
                            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                {appState.goals.map(g => {
                                    // Financial goals: current_amount / target_amount
                                    // Schedule/learning goals: time-based progress
                                    let pct = 0;
                                    let subLabel = '';

                                    if (g.target_amount && g.target_amount > 0) {
                                        // Financial goal
                                        pct = Math.min(100, Math.round(((g.current_amount || 0) / g.target_amount) * 100));
                                        subLabel = `${formatCurrency(g.current_amount || 0)} / ${formatCurrency(g.target_amount)}`;
                                    } else if (g.progress != null) {
                                        // Has explicit progress field
                                        pct = g.progress;
                                    } else if (g.created_at && g.deadline) {
                                        // Time-based progress
                                        const start = new Date(g.created_at).getTime();
                                        const end = new Date(g.deadline).getTime();
                                        const now = Date.now();
                                        if (end > start) {
                                            pct = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
                                        }
                                    }

                                    return (
                                        <div key={g.id}>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="font-medium text-gray-700 truncate">{g.title}</span>
                                                <span className="text-gray-400 ml-2 shrink-0">{pct}%</span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2 relative overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-purple-400 to-pink-500 transition-all duration-500"
                                                    style={{ width: `${Math.max(pct, 2)}%` }}
                                                />
                                            </div>
                                            {subLabel && (
                                                <p className="text-[10px] text-gray-400 mt-0.5 text-right">{subLabel}</p>
                                            )}
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
                                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg md:rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-sm">
                                        <Sparkles size={12} className="text-white bg-transparent" />
                                    </div>
                                )}

                                {/* Bubble */}
                                <div className={`max-w-[88%] lg:max-w-[75%] ${msg.role === 'user' ? '' : ''}`}>
                                    <div className={`px-3.5 py-2.5 md:px-4 md:py-3 text-sm leading-relaxed shadow-sm
                                        ${msg.role === 'user'
                                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl rounded-br-md prose-invert prose-p:text-white prose-headings:text-white'
                                            : 'bg-gray-50 text-gray-700 border border-gray-100 rounded-2xl rounded-bl-md prose prose-sm prose-p:my-1 md:prose-p:my-1.5 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-indigo-700 prose-h3:text-base prose-h3:mt-3 prose-h3:mb-1'
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
                                                    className={`flex items-start gap-2 px-3 py-2 rounded-xl text-xs ${action.success
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
                                <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg md:rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                                    <Sparkles size={12} className="text-white" />
                                </div>
                                <div className="bg-gray-50 px-4 py-3 md:px-5 md:py-4 rounded-2xl rounded-bl-md border border-gray-100 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                        <span className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce"></span>
                                        <span className="text-[10px] text-gray-400 ml-1">Đang phân tích dữ liệu...</span>
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
                                placeholder='Nhập đi bạn ơi ....'
                                className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none resize-none max-h-28 min-h-[44px] placeholder:text-gray-400"
                                rows={1}
                            />
                            <button
                                onClick={() => handleSend()}
                                disabled={!input.trim() || isLoading}
                                className="m-1 p-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-200 disabled:opacity-40 disabled:hover:shadow-none transition-all shrink-0"
                            >
                                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            </button>
                        </div>
                        <p className="text-[9px] text-center text-gray-400 mt-2">
                            Powered by Gemini ({getCurrentModel().replace('gemini-', '')})
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIAdvisorPage;
