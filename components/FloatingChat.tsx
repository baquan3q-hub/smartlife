// File: src/components/FloatingChat.tsx
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquareText, X, Send, Bot, Sparkles, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AppState } from '../types';

// --- CẤU HÌNH API KEY TẠI ĐÂY ---
// Bạn nhớ thay mã API thật của bạn vào đây nhé
const API_KEY = "DÁN_API_KEY_CỦA_BẠN_VÀO_ĐÂY";

interface FloatingChatProps {
  appState: AppState;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const FloatingChat: React.FC<FloatingChatProps> = ({ appState }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // Trạng thái toàn màn hình
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Chào Cun! Mình là trợ lý SmartLife. Mình có thể giúp gì cho bạn về tài chính hay lịch trình hôm nay?',
      timestamp: Date.now()
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isExpanded]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // 1. Hiển thị tin nhắn người dùng ngay lập tức
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // 2. Chuẩn bị dữ liệu để gửi cho AI
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      // Lọc dữ liệu quan trọng để AI đọc (tránh gửi quá nhiều gây lỗi)
      const contextData = JSON.stringify({
        so_du_vi: appState.currentBalance,
        giao_dich_gan_day: appState.transactions.slice(0, 10), // Tăng lên 10 để AI biết nhiều hơn
        muc_tieu: appState.goals,
        viec_can_lam: appState.todos.filter(t => !t.is_completed),
        lich_trinh: appState.timetable
      });

      const prompt = `
        Bạn là trợ lý AI cho ứng dụng SmartLife của người dùng tên là Cun.
        Dữ liệu hiện tại của Cun: ${contextData}
        
        Người dùng hỏi: "${userMsg.content}"
        
        Hãy trả lời ngắn gọn, thân thiện, dùng tiếng Việt tự nhiên. Nếu câu hỏi liên quan đến dữ liệu, hãy phân tích dữ liệu trên để trả lời.
      `;

      // 3. Gọi Gemini
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // 4. Hiển thị câu trả lời
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: text,
        timestamp: Date.now()
      }]);

    } catch (error) {
      console.error("Lỗi AI:", error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Xin lỗi Cun, mình đang bị mất kết nối một chút. Bạn kiểm tra lại mạng hoặc API Key nhé!",
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Class điều khiển kích thước cửa sổ chat
  const containerClasses = isExpanded
    ? 'fixed inset-0 w-full h-full rounded-none z-[100] m-0 top-0 left-0' // Toàn màn hình
    : 'w-[90vw] md:w-[380px] h-[500px] rounded-2xl mb-4'; // Mặc định

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none ${isExpanded ? 'right-0 bottom-0 pointer-events-auto' : ''}`}>

      {/* Cửa sổ Chat */}
      <div className={`pointer-events-auto bg-white shadow-2xl border border-gray-200 flex flex-col transition-all duration-300 origin-bottom-right overflow-hidden ${containerClasses} ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 h-0 w-0'}`}>

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-1.5 rounded-full">
              <Bot size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm">Trợ lý SmartLife</h3>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                <span className="text-[10px] text-indigo-100 leading-none">Online</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="hover:bg-white/20 p-2 rounded-lg transition-colors"
              title={isExpanded ? "Thu nhỏ" : "Phóng to"}
            >
              {isExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <button
              onClick={() => { setIsOpen(false); setIsExpanded(false); }}
              className="hover:bg-red-500/80 hover:text-white p-2 rounded-lg transition-colors ml-1 bg-white/10"
              title="Đóng chat"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Nội dung tin nhắn */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 scrollbar-hide">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[75%] p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-tr-none shadow-md'
                : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none shadow-sm'
                }`}>
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex items-center gap-2 text-gray-500 text-xs">
                <Loader2 size={14} className="animate-spin text-indigo-600" />
                Đang suy nghĩ...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Ô nhập liệu */}
        <div className="p-3 bg-white border-t border-gray-100 shrink-0">
          <div className="relative max-w-4xl mx-auto w-full">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Hỏi về tiền tiêu, lịch trình..."
              className="w-full bg-gray-100 border-0 rounded-xl pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:bg-white transition-all resize-none outline-none h-[50px] max-h-[120px]"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="absolute right-1.5 top-1.5 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? <Sparkles size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Nút Tròn Mở Chat (Chỉ hiện khi Chat đóng hoặc chưa full màn hình) */}
      {!isExpanded && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`pointer-events-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-xl text-white p-4 rounded-full shadow-lg transition-all transform hover:scale-105 flex items-center justify-center ${isOpen ? 'rotate-90 opacity-0 w-0 h-0 p-0 overflow-hidden' : 'opacity-100'}`}
        >
          <MessageSquareText size={28} />
        </button>
      )}
    </div>
  );
};

export default FloatingChat;