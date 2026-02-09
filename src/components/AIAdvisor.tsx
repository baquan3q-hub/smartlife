import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Sparkles, Loader2, Bot, Maximize2, Minimize2, GripHorizontal, TrendingDown, Target, ListChecks, BarChart3, RefreshCw } from 'lucide-react';
import { aiService } from '../services/aiService';
import { AppState } from '../types';
import ReactMarkdown from 'react-markdown';

interface AIAdvisorProps {
    appState: AppState;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface SuggestionChip {
    icon: React.ReactNode;
    label: string;
    prompt: string;
    color: string;
}

const SUGGESTIONS: SuggestionChip[] = [
    {
        icon: <BarChart3 size={14} />,
        label: 'Phân tích chi tiêu',
        prompt: 'Hãy phân tích chi tiêu gần đây của tôi và đưa ra nhận xét chi tiết.',
        color: 'from-blue-500 to-cyan-500',
    },
    {
        icon: <ListChecks size={14} />,
        label: 'Liệt kê công việc',
        prompt: 'Liệt kê các công việc tôi cần hoàn thành hôm nay và sắp xếp theo mức độ ưu tiên.',
        color: 'from-emerald-500 to-teal-500',
    },
    {
        icon: <TrendingDown size={14} />,
        label: 'Đánh giá tài chính',
        prompt: 'Đánh giá tổng quan tình hình tài chính của tôi và đề xuất cách tiết kiệm.',
        color: 'from-amber-500 to-orange-500',
    },
    {
        icon: <Target size={14} />,
        label: 'Nhắc nhở mục tiêu',
        prompt: 'Nhắc nhở tôi về các mục tiêu đang theo đuổi và tiến độ hiện tại.',
        color: 'from-purple-500 to-pink-500',
    },
];

const AIAdvisor: React.FC<AIAdvisorProps> = ({ appState }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Chào bạn! 👋 Mình là **SmartLife Advisor** — trợ lý thông minh của bạn.\n\nMình có thể giúp bạn **phân tích chi tiêu**, **quản lý mục tiêu**, hay đơn giản là trò chuyện về kế hoạch cuộc sống. Hãy thử các gợi ý bên dưới hoặc hỏi bất kỳ điều gì nhé! 🌱' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // --- Draggable Logic ---
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<HTMLDivElement>(null);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const elementStartPos = useRef({ x: 0, y: 0 });

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        if (isFullscreen) return;
        setIsDragging(true);
        dragStartPos.current = { x: e.clientX, y: e.clientY };
        elementStartPos.current = { x: position.x, y: position.y };
        e.preventDefault();
    }, [position, isFullscreen]);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const dx = e.clientX - dragStartPos.current.x;
            const dy = e.clientY - dragStartPos.current.y;
            setPosition({
                x: elementStartPos.current.x + dx,
                y: elementStartPos.current.y + dy,
            });
        };
        const onMouseUp = () => setIsDragging(false);

        if (isDragging) {
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }, [isDragging]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    // Focus input when opening
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    const handleSend = async (overrideMessage?: string) => {
        const msg = overrideMessage || input.trim();
        if (!msg || isLoading) return;

        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: msg }]);
        setIsLoading(true);

        try {
            const context = aiService.gatherContext(appState);
            const response = await aiService.sendMessage(msg, context);
            setMessages(prev => [...prev, { role: 'assistant', content: response }]);
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', content: "Xin lỗi, mình gặp sự cố. Bạn thử lại sau nhé! 😔" }]);
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
        setMessages([
            { role: 'assistant', content: 'Cuộc trò chuyện đã được làm mới! Mình sẵn sàng giúp bạn. 🌱' }
        ]);
    };

    // Check if showing suggestions (only when no user messages yet)
    const showSuggestions = messages.length <= 1 && !isLoading;

    // --- STYLES ---
    const getContainerStyle = (): React.CSSProperties => {
        if (isFullscreen) {
            return { position: 'fixed', inset: 16, zIndex: 9999 };
        }
        return {
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            transform: `translate(${position.x}px, ${position.y}px)`,
        };
    };

    const getWindowClass = () => {
        if (isFullscreen) return 'w-full h-full';
        return 'w-[380px] h-[540px] md:w-[420px] md:h-[580px]';
    };

    return (
        <>
            {/* Toggle Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-[9999] bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-full shadow-lg hover:shadow-2xl hover:scale-110 transition-all duration-300 group"
                    aria-label="Open AI Advisor"
                >
                    <Sparkles className="w-6 h-6" />
                    {/* Ping dot */}
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-pink-500 border-2 border-white"></span>
                    </span>
                    {/* Tooltip */}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                        Trợ lý AI SmartLife ✨
                    </div>
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div style={getContainerStyle()}>
                    <div className={`${getWindowClass()} bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col transition-all duration-300`}>

                        {/* Header - Draggable */}
                        <div
                            ref={dragRef}
                            onMouseDown={onMouseDown}
                            className={`bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 p-3.5 flex justify-between items-center text-white shrink-0 select-none ${!isFullscreen ? 'cursor-grab active:cursor-grabbing' : ''}`}
                        >
                            <div className="flex items-center gap-3">
                                {!isFullscreen && <GripHorizontal size={16} className="text-white/40" />}
                                <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                                    <Bot size={18} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm leading-tight">SmartLife Advisor</h3>
                                    <span className="flex items-center gap-1 text-[10px] text-indigo-200">
                                        <span className="relative flex h-1.5 w-1.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                                        </span>
                                        Gemini 1.5 Flash
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-0.5">
                                <button onClick={handleReset} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white" title="Làm mới">
                                    <RefreshCw size={15} />
                                </button>
                                <button onClick={() => { setIsFullscreen(!isFullscreen); setPosition({ x: 0, y: 0 }); }} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white" title={isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}>
                                    {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                                </button>
                                <button onClick={() => { setIsOpen(false); setIsFullscreen(false); setPosition({ x: 0, y: 0 }); }} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white" title="Đóng">
                                    <X size={15} />
                                </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-gray-50 to-white">
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-fade-in`}>
                                    {/* Avatar */}
                                    {msg.role === 'assistant' && (
                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-sm">
                                            <Sparkles size={12} className="text-white" />
                                        </div>
                                    )}

                                    {/* Bubble */}
                                    <div className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed shadow-sm
                    ${msg.role === 'user'
                                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl rounded-br-md'
                                            : 'bg-white text-gray-700 border border-gray-100 rounded-2xl rounded-bl-md prose prose-sm prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-indigo-700'}`}
                                    >
                                        {msg.role === 'assistant' ? (
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        ) : (
                                            msg.content
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Loading State */}
                            {isLoading && (
                                <div className="flex items-end gap-2 animate-fade-in">
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                                        <Sparkles size={12} className="text-white" />
                                    </div>
                                    <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-md border border-gray-100 shadow-sm">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                            <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                            <span className="w-2 h-2 bg-pink-400 rounded-full animate-bounce"></span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Suggestion Chips */}
                            {showSuggestions && (
                                <div className="pt-2">
                                    <p className="text-[11px] text-gray-400 font-medium mb-2 uppercase tracking-wider">💡 Gợi ý cho bạn</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {SUGGESTIONS.map((s, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleSend(s.prompt)}
                                                className="group text-left p-3 rounded-xl border border-gray-100 bg-white hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                                            >
                                                <div className={`w-7 h-7 rounded-lg bg-gradient-to-r ${s.color} flex items-center justify-center text-white mb-2 shadow-sm group-hover:scale-110 transition-transform`}>
                                                    {s.icon}
                                                </div>
                                                <span className="text-xs font-semibold text-gray-700 leading-tight">{s.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-3 bg-white border-t border-gray-100 shrink-0">
                            <div className="relative flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    placeholder="Hỏi gì đó về tài chính, kế hoạch..."
                                    className="flex-1 bg-transparent px-4 py-3 text-sm outline-none resize-none max-h-24 min-h-[44px] placeholder:text-gray-400"
                                    rows={1}
                                />
                                <button
                                    onClick={() => handleSend()}
                                    disabled={!input.trim() || isLoading}
                                    className="m-1.5 p-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-md disabled:opacity-40 disabled:hover:shadow-none transition-all shrink-0"
                                >
                                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                </button>
                            </div>
                            <p className="text-[9px] text-center text-gray-400 mt-1.5">
                                Powered by Gemini 1.5 Flash · AI có thể mắc lỗi
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AIAdvisor;
