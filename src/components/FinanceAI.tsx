import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Minimize2, MessageCircle, Loader2 } from 'lucide-react';
import { chatWithFinanceAdvisor } from '../services/aiService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
    role: 'user' | 'model';
    content: string;
}

interface FinanceAIProps {
    context?: string; // Optional context about current financial status
}

const FinanceAI: React.FC<FinanceAIProps> = ({ context }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', content: "Xin chào! Tôi là trợ lý tài chính của bạn. Tôi có thể giúp gì cho bạn hôm nay? 💰" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Draggable Logic
    // Initial position is 0,0 relative to its fixed position (bottom-28 right-6)
    // We want to track position relative to viewport or just keep using offset.
    // Using offset is easier but for bounds checking we need window dims.
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    useEffect(() => {
        const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        setIsDragging(true);
        dragStartPos.current = { x: clientX - position.x, y: clientY - position.y };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent | TouchEvent) => {
            if (!isDragging) return;

            // Prevent default behavior (scrolling) only when dragging
            if (e.cancelable) e.preventDefault();

            const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

            // Calculate new position relative to start
            let newX = clientX - dragStartPos.current.x;
            let newY = clientY - dragStartPos.current.y;

            // Optional: Add boundaries here if needed, but snap logic might handle it.
            // For smoother feel, we let user drag anywhere, but maybe clamp to logical screen.
            // But since 'position' is transform offset, it's relative to initial "bottom-28 right-6".
            // Let's just update position for now and handle snap on Up.
            setPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            if (isDragging) {
                setIsDragging(false);

                // SNAP LOGIC
                // We need to calculate the actual screen position of the element center
                // Initial fixed position: right: 24px (6 * 4), bottom: 112px (28 * 4).
                // Element origin is bottom-right.
                // Current offset is position.x, position.y.

                // Let's approximate element center. The button is roughly 56x56.
                // Initial Center X relative to window right = 24 + 28 = 52px.
                // Initial Center Y relative to window bottom = 112 + 28 = 140px.

                // Screen X = WindowWidth - 52 + position.x
                // Screen Y = WindowHeight - 140 + position.y

                const currentScreenX = windowSize.width - 52 + position.x;
                // const currentScreenY = windowSize.height - 140 + position.y;

                // Snap to left or right
                // If ScreenX < WindowWidth / 2 -> Snap Left
                // Else -> Snap Right

                const snapToRight = currentScreenX > windowSize.width / 2;

                // Target X offset?
                // If snap right: Target Screen X should be WindowWidth - 52 (Original Pos)
                // So target position.x = 0 (roughly)
                // Actually, let's just reverse the math.
                // Target Screen X (Right) = WindowWidth - 52.
                // Target Screen X (Left) = 52.

                let targetX = 0;
                if (snapToRight) {
                    targetX = 0; // Return to original right side
                } else {
                    // Move to left side
                    // WindowWidth - 52 + x = 52 => x = 104 - WindowWidth
                    targetX = 104 - windowSize.width;
                }

                // We can animate this transition by setting a transition style then updating state
                // But simplified: just set position.
                // For animation, we can use CSS transition on the div, which we have (duration-300?)
                // Actually the div wrapper doesn't have transition-all by default in the current code... 
                // Wait, it does (?) - no, the inner divs do. The outer wrapper needs transition for smooth snap.

                // Let's rely on React state update. If we want smooth snap, we need CSS transition on the wrapper.
                // I will add 'transition-transform duration-300' to wrapper.
                setPosition(prev => ({ ...prev, x: targetX }));
            }
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove, { passive: false });
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchmove', handleMouseMove, { passive: false });
            window.addEventListener('touchend', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleMouseMove);
            window.removeEventListener('touchend', handleMouseUp);
        };
    }, [isDragging, windowSize]); // Add windowSize dependency

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async (messageText?: string | React.MouseEvent) => {
        const textToSend = (typeof messageText === 'string' ? messageText : input).trim();

        if (!textToSend || isLoading) return;

        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: textToSend }]);
        setIsLoading(true);

        try {
            const userMessage = textToSend;
            const history = messages.map(m => ({ role: m.role, content: m.content }));
            const data = await chatWithFinanceAdvisor(userMessage, history, context || "");

            if (data.response) {
                setMessages(prev => [...prev, { role: 'model', content: data.response }]);
            } else {
                throw new Error("No response");
            }

        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, { role: 'model', content: "Xin lỗi, hiện tại tôi không thể kết nối. Vui lòng thử lại sau." }]);
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

    // Toggle handler that distinguishes click from drag
    const handleToggleClick = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging) {
            setIsOpen(!isOpen);
        }
    };

    return (
        <div
            className={`fixed bottom-28 right-6 z-50 flex flex-col items-end pointer-events-none transition-transform duration-300 ease-out`} // Added transition for smooth snap
            style={{
                transform: `translate(${position.x}px, ${position.y}px)`,
                touchAction: 'none',
                transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.8, 0.5, 1)' // Disable transition during drag
            }}
        >
            {/* Chat Window */}
            <div
                className={`
                    bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden 
                    transition-all duration-300 ease-in-out origin-bottom-right pointer-events-auto
                    ${isOpen ? 'w-[350px] h-[500px] opacity-100 scale-100 mb-4' : 'w-0 h-0 opacity-0 scale-90 mb-0'}
                `}
            >
                {/* Header - Draggable */}
                <div
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex justify-between items-center text-white cursor-move select-none"
                    style={{ touchAction: 'none' }}
                >
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-white/20 rounded-lg">
                            <Bot size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm">Trợ lý Tài chính</h3>
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                <span className="text-[10px] text-white/80">Online</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                    >
                        <Minimize2 size={18} />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 h-[380px] bg-gray-50 scrollbar-thin">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className={`
                                    max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed
                                    ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-tr-none'
                                        : 'bg-white text-gray-700 border border-gray-100 shadow-sm rounded-tl-none'}
                                `}
                            >
                                <ReactMarkdown
                                    components={{
                                        strong: ({ node, ...props }) => <span className="font-bold text-indigo-600" {...props} />,
                                        ul: ({ node, ...props }) => <ul className="list-disc pl-4 my-1 space-y-1" {...props} />,
                                        li: ({ node, ...props }) => <li className="marker:text-indigo-600" {...props} />,
                                        p: ({ node, ...props }) => <p className="mb-1 last:mb-0" {...props} />,
                                        table: ({ node, ...props }) => <div className="overflow-x-auto my-2"><table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg" {...props} /></div>,
                                        thead: ({ node, ...props }) => <thead className="bg-gray-50" {...props} />,
                                        tbody: ({ node, ...props }) => <tbody className="bg-white divide-y divide-gray-200" {...props} />,
                                        tr: ({ node, ...props }) => <tr className="" {...props} />,
                                        th: ({ node, ...props }) => <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200" {...props} />,
                                        td: ({ node, ...props }) => <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 border-b border-gray-100" {...props} />
                                    }}
                                    remarkPlugins={[remarkGfm]}
                                >
                                    {msg.content}
                                </ReactMarkdown>
                            </div>
                        </div>
                    ))}

                    {messages.length === 1 && (
                        <div className="flex flex-col gap-2 p-2">
                            <p className="text-xs text-gray-400 font-medium ml-1">Đề xuất câu hỏi:</p>
                            <div className="flex flex-wrap gap-2">
                                {["Phân tích chi tiêu 📊", "Tối ưu hóa chi tiêu 💡", "Làm sao để tiết kiệm? 💰"].map((text, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSend(text)}
                                        className="bg-white border border-indigo-100 text-indigo-600 text-xs px-3 py-2 rounded-full hover:bg-indigo-50 transition-colors shadow-sm text-left"
                                    >
                                        {text}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex items-center gap-2">
                                <Loader2 size={16} className="animate-spin text-indigo-600" />
                                <span className="text-xs text-gray-400">Đang trả lời...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-3 border-t border-gray-100 bg-white">
                    <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Hỏi về tài chính..."
                            className="flex-1 bg-transparent border-none outline-none text-sm text-gray-700 min-w-0"
                            disabled={isLoading}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Toggle Button - Draggable */}
            <div
                className="pointer-events-auto active:cursor-grabbing hover:cursor-grab touch-none"
                style={{ touchAction: 'none' }}
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
            >
                <button
                    onClick={(e) => {
                        // If we dragged, don't toggle? 
                        // Actually, if we use a wrapper div for drag events, the button onClick might still trigger.
                        // Let's use a simple heuristic: if isDragging was true recently...
                        // But isDragging is false on mouseUp.
                        if (!isDragging) setIsOpen(!isOpen);
                    }}
                    className={`
                        flex items-center justify-center w-14 h-14 rounded-full shadow-xl 
                        transition-all duration-300 transform hover:scale-105 active:scale-95
                        ${isOpen ? 'bg-gray-200 text-gray-600 rotate-90 opacity-0 pointer-events-none' : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'}
                    `}
                    style={{ display: isOpen ? 'none' : 'flex' }}
                >
                    <div className="relative">
                        <Bot size={28} />
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                    </div>
                </button>
            </div>
        </div>
    );
};

export default FinanceAI;
