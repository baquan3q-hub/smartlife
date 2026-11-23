// File: src/components/ai/MessageList.tsx
// Vùng cuộn tin nhắn: tự cuộn theo chữ đang chạy, dừng tự cuộn khi người dùng kéo lên đọc lại,
// hiện nút "xuống cuối" để quay về.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';

interface MessageListProps {
    children: React.ReactNode;
    // Tăng giá trị này khi người dùng vừa gửi tin → luôn kéo xuống cuối
    pinSignal: number;
}

const NEAR_BOTTOM_PX = 80;

const MessageList: React.FC<MessageListProps> = ({ children, pinSignal }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const stickRef = useRef(true);
    const [showJump, setShowJump] = useState(false);

    const scrollToBottom = useCallback((smooth: boolean) => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    }, []);

    const handleScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
        stickRef.current = atBottom;
        setShowJump(!atBottom);
    };

    // Nội dung cao lên (chữ stream, biểu đồ vẽ xong, khung suy nghĩ mở) → bám đáy nếu đang ở đáy
    useEffect(() => {
        const content = contentRef.current;
        if (!content || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => {
            if (stickRef.current) scrollToBottom(false);
        });
        observer.observe(content);
        return () => observer.disconnect();
    }, [scrollToBottom]);

    useEffect(() => {
        stickRef.current = true;
        setShowJump(false);
        scrollToBottom(true);
    }, [pinSignal, scrollToBottom]);

    return (
        <div className="relative flex-1 min-h-0">
            <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto p-4 md:p-6 custom-scrollbar">
                <div ref={contentRef} className="space-y-4">
                    {children}
                </div>
            </div>
            {showJump && (
                <button
                    type="button"
                    onClick={() => { stickRef.current = true; setShowJump(false); scrollToBottom(true); }}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 p-2 rounded-full bg-white border border-gray-200 shadow-lg text-gray-600 hover:text-blue-600 hover:border-blue-200 transition-colors animate-fade-in"
                    title="Xuống tin mới nhất"
                    aria-label="Xuống tin mới nhất"
                >
                    <ArrowDown size={16} />
                </button>
            )}
        </div>
    );
};

export default MessageList;
