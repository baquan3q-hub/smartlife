// File: src/components/AIAdvisorPage.tsx
// Full-page AI Financial Advisor Canvas v2
// — Function Calling, Inline Charts, NL Actions

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    ArrowLeft, Send, Sparkles, Loader2, Bot, RefreshCw,
    TrendingDown, Target, ListChecks, BarChart3, Wallet,
    PiggyBank, CalendarCheck, Brain, Lightbulb, ChevronRight,
    CheckCircle2, AlertCircle, History, X, Plus, Trash2, GraduationCap,
    Heart, Pin
} from 'lucide-react';

import { AppState, TransactionType } from '../types';
import { generateQuickInsight, getCurrentModel, type ChatMessage } from '../services/geminiService';
import { chatWithAI, type ActionHandlers, type ChartData, type ActionResult, type AIAttachment } from '../services/aiEngine';
import { chatHistoryService, type AIConversation, type AIMessage } from '../services/chatHistoryService';
import { memoryService } from '../services/memoryService';
import InlineChatChart from './InlineChatChart';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ConfirmModal from './ConfirmModal';
import { Lang } from '../i18n/i18n';
import * as XLSX from 'xlsx';

// ────────────────────────────────────────
// Types
// ────────────────────────────────────────
interface AIAdvisorPageProps {
    appState: AppState;
    lang: Lang;
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
    files?: Array<{ name: string; type: string; size: number }>;
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
        icon: <Heart size={16} />,
        label: 'Cuộc sống dạo này',
        prompt: 'Hãy phân tích các nhật ký gần đây, tình hình chi tiêu tài chính và danh sách công việc (todo) của tôi để đưa ra nhận xét tổng quan về cuộc sống của tôi dạo này thế nào (sức khỏe tinh thần, mức độ cân bằng, áp lực công việc, quản lý tiền bạc) và cho tôi vài lời khuyên nhé.',
        gradient: 'from-pink-500 to-rose-500',
    },
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
        label: 'Ước tính GPA',
        prompt: 'Dựa vào điểm GPA hiện tại của tôi hãy ước tính và dự đoán mức điểm/tín chỉ GPA các kỳ của tôi phải được bao tối đa bao nhiêu điểm để đạt được xếp loại giỏi bằng tốt nghiệp',
        gradient: 'from-sky-500 to-indigo-500',
    },
];

// ────────────────────────────────────────
// Helpers
// ────────────────────────────────────────
function formatCurrency(amount: number): string {
    return amount.toLocaleString('vi-VN') + 'đ';
}

// Convert file to Base64
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
        };
        reader.onerror = error => reject(error);
    });
};

// Parse Excel workbook pages into CSV representation text
const parseExcelToCSV = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                let csvResult = '';
                workbook.SheetNames.forEach(sheetName => {
                    csvResult += `\n[Bảng tính Excel: ${file.name} - Trang: ${sheetName}]\n`;
                    const sheet = workbook.Sheets[sheetName];
                    const csv = XLSX.utils.sheet_to_csv(sheet);
                    csvResult += csv + '\n';
                });
                resolve(csvResult);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
    });
};

// Read plain text file content
const readTextFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
    });
};

// Get mime type based on extension fallback
const getMimeTypeFromExtension = (ext: string): string => {
    switch (ext) {
        case 'pdf': return 'application/pdf';
        case 'png': return 'image/png';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'webp': return 'image/webp';
        case 'heic': return 'image/heic';
        case 'mp3': return 'audio/mp3';
        case 'wav': return 'audio/wav';
        case 'm4a': return 'audio/m4a';
        case 'aac': return 'audio/aac';
        default: return 'application/octet-stream';
    }
};

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
            content: '👋 Chào bạn! Mình là **SmartLife Advisor v2** — trợ lý AI thông minh.\n\n🆕 **Khả năng mới:**\n- 📊 **Truy vấn dữ liệu** trực tiếp từ database\n- 📈 **Bảng tính (table) & Dự đoán** chi tiêu\n- ✏️ **Thêm lịch trình, việc cần làm, giao dịch** bằng ngôn ngữ tự nhiên\n- 📎 **Phân tích tài liệu & hình ảnh**: Đọc hiểu ảnh thời khóa biểu, hóa đơn, file excel, csv, pdf, txt, hoặc âm thanh trực tiếp trong bộ nhớ tạm để xử lý nhanh chóng.\n\n💡 **Thử hỏi mình:**\n- _"Đưa ra dự đoán chi tiêu tháng tới cho tôi"_\n- _"Lập bảng so sánh thu chi 3 tháng gần nhất"_\n- _"Thêm lịch học IELTS thứ 3, thứ 5 lúc 19h"_\n\nHoặc chọn gợi ý bên dưới! 👇'
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [quickInsight, setQuickInsight] = useState<string | null>(null);
    const [isLoadingInsight, setIsLoadingInsight] = useState(false);

    // Attached files state
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showUploadMenu, setShowUploadMenu] = useState(false);
    const uploadMenuRef = useRef<HTMLDivElement>(null);


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        const newFiles = Array.from(files);

        // Filter out files that exceed 15MB
        const MAX_SIZE = 15 * 1024 * 1024;
        const validFiles: File[] = [];
        const oversizedFiles: string[] = [];

        newFiles.forEach(file => {
            if (file.size <= MAX_SIZE) {
                validFiles.push(file);
            } else {
                oversizedFiles.push(file.name);
            }
        });

        if (oversizedFiles.length > 0) {
            alert(`Các tệp sau vượt quá giới hạn 15MB và không được đính kèm:\n- ${oversizedFiles.join('\n- ')}`);
        }

        setAttachedFiles(prev => [...prev, ...validFiles]);
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // Reset input to allow choosing same file again
        }
    };

    const triggerFileSelect = (type: 'image' | 'document' | 'audio') => {
        if (!fileInputRef.current) return;
        
        if (type === 'image') {
            fileInputRef.current.accept = 'image/*';
        } else if (type === 'document') {
            fileInputRef.current.accept = 'application/pdf,text/plain,text/csv,.csv,.xlsx,.xls,.json,.md';
        } else if (type === 'audio') {
            fileInputRef.current.accept = 'audio/*';
        }
        
        fileInputRef.current.click();
        setShowUploadMenu(false);
    };

    const handleTogglePinConversation = async (e: React.MouseEvent, convId: string, pin: boolean) => {
        e.stopPropagation();
        const success = await chatHistoryService.togglePinConversation(convId, pin);
        if (success) {
            setConversations(prev => prev.map(c => c.id === convId ? { ...c, is_pinned: pin } : c));
        } else {
            alert('Lỗi ghim cuộc trò chuyện. Hãy chắc chắn bạn đã chạy SQL migration.');
        }
    };


    // History and Memory State
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [memoryContext, setMemoryContext] = useState<string>('');
    const [conversations, setConversations] = useState<AIConversation[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
    });

    const [showPopupHint, setShowPopupHint] = useState(false);

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
    useEffect(() => {
        inputRef.current?.focus();

        // Show hint popup for 8 seconds on mount
        setShowPopupHint(true);
        const timer = setTimeout(() => {
            setShowPopupHint(false);
        }, 8000);
        return () => clearTimeout(timer);
    }, []);

    // Load conversations when the component mounts or when conversationId changes
    useEffect(() => {
        chatHistoryService.getConversations().then(setConversations);
    }, [conversationId]);

    // Fetch AI Quick Insight manually on demand
    const handleFetchAIInsight = async () => {
        setIsLoadingInsight(true);
        try {
            const insight = await generateQuickInsight(appState);
            setQuickInsight(insight);
        } catch (e) {
            console.error('Quick insight error:', e);
            alert('Không thể kết nối AI. Vui lòng thử lại sau. 🔄');
        } finally {
            setIsLoadingInsight(false);
        }
    };

    // Load memory context on mount
    useEffect(() => {
        memoryService.getMemoryContextString()
            .then(setMemoryContext)
            .catch(console.error);
    }, []);

    // Click outside upload menu handler
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (uploadMenuRef.current && !uploadMenuRef.current.contains(event.target as Node)) {
                setShowUploadMenu(false);
            }
        };
        if (showUploadMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showUploadMenu]);


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
        if ((!msg && attachedFiles.length === 0) || isLoading) return;

        setInput('');

        let finalUserMsg = msg;
        if (!finalUserMsg && attachedFiles.length > 0) {
            finalUserMsg = "Hãy phân tích dữ liệu từ các tệp tôi đã tải lên.";
        }

        setIsLoading(true);
        const attachmentsToSend: AIAttachment[] = [];
        let promptExtension = '';

        // Process files sequentially
        for (const file of attachedFiles) {
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (ext === 'xlsx' || ext === 'xls') {
                try {
                    const excelText = await parseExcelToCSV(file);
                    promptExtension += `\n\n--- DỮ LIỆU ĐÍNH KÈM TỪ EXCEL (${file.name}) ---\n${excelText}\n--- HẾT DỮ LIỆU EXCEL ---`;
                } catch (err: any) {
                    console.error('Error parsing excel:', err);
                    promptExtension += `\n\n[Lỗi đọc file Excel ${file.name}: ${err.message}]`;
                }
            } else if (['txt', 'csv', 'md', 'json', 'xml'].includes(ext || '')) {
                try {
                    const fileContent = await readTextFile(file);
                    promptExtension += `\n\n--- NỘI DUNG TỆP ${file.name} ---\n${fileContent}\n--- HẾT NỘI DUNG TỆP ---`;
                } catch (err: any) {
                    console.error('Error reading text file:', err);
                    promptExtension += `\n\n[Lỗi đọc file văn bản ${file.name}: ${err.message}]`;
                }
            } else {
                try {
                    const base64Data = await fileToBase64(file);
                    attachmentsToSend.push({
                        mimeType: file.type || getMimeTypeFromExtension(ext || ''),
                        data: base64Data
                    });
                } catch (err: any) {
                    console.error('Error converting file to base64:', err);
                    alert(`Không thể đọc file ${file.name}: ${err.message}`);
                }
            }
        }

        // Save metadata of files for UI chat history rendering
        const filesMetadata = attachedFiles.map(f => ({ name: f.name, type: f.type, size: f.size }));
        setAttachedFiles([]);

        // Text sent to database/UI includes file names for context
        let visibleMessageContent = finalUserMsg;
        if (filesMetadata.length > 0) {
            visibleMessageContent += '\n\n' + filesMetadata.map(f => `📎 **${f.name}** (${(f.size / 1024).toFixed(1)} KB)`).join('\n');
        }

        const newMessages: UIMessage[] = [...messages, { role: 'user', content: visibleMessageContent, files: filesMetadata }];
        setMessages(newMessages);

        try {
            // Save conversation & user message to DB
            let currentConvId = conversationId;
            if (!currentConvId) {
                const conv = await chatHistoryService.createConversation((msg || "Phân tích tài liệu").substring(0, 50) + '...');
                if (conv) {
                    currentConvId = conv.id;
                    setConversationId(currentConvId);
                }
            }
            if (currentConvId) {
                await chatHistoryService.saveMessage(currentConvId, 'user', visibleMessageContent);
            }

            const history = buildHistory(newMessages);
            // Replace the last history item's content with promptExtension to let Gemini see spreadsheet and text files directly
            if (history.length > 0 && promptExtension) {
                history[history.length - 1].parts = [{ text: finalUserMsg + promptExtension }];
            }

            const response = await chatWithAI(history, appState, actionHandlers, memoryContext, attachmentsToSend);

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

            // Extract memories periodically
            if (newMessages.length > 3 && newMessages.length % 4 === 1) {
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
        setConfirmDialog({
            isOpen: true,
            title: 'Xóa hội thoại',
            message: 'Bạn có chắc chắn muốn xóa cuộc trò chuyện này?',
            onConfirm: async () => {
                const success = await chatHistoryService.deleteConversation(convId);
                if (success) {
                    setConversations(prev => prev.filter(c => c.id !== convId));
                    if (conversationId === convId) {
                        handleReset();
                    }
                }
            }
        });
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
                                [...conversations]
                                    .sort((a, b) => {
                                        const pinA = a.is_pinned ? 1 : 0;
                                        const pinB = b.is_pinned ? 1 : 0;
                                        if (pinA !== pinB) return pinB - pinA;
                                        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
                                    })
                                    .map(conv => (
                                        <div
                                            key={conv.id}
                                            onClick={() => loadConversation(conv.id)}
                                            className={`group px-3 py-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-all border ${conversationId === conv.id ? 'bg-indigo-50/80 border-indigo-100' : 'hover:bg-gray-50/50 border-transparent'} ${conv.is_pinned ? 'border-l-4 border-l-indigo-500 bg-slate-50/40 shadow-sm' : ''}`}
                                        >
                                            <div className="flex-1 min-w-0 pr-2">
                                                <div className="flex items-center gap-1.5">
                                                    <p className={`text-sm truncate font-medium ${conversationId === conv.id ? 'text-indigo-700 font-semibold' : 'text-gray-700'}`}>{conv.title}</p>
                                                    {conv.is_pinned && <Pin size={10} className="text-indigo-500 fill-indigo-500 shrink-0" />}
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-0.5">{new Date(conv.updated_at).toLocaleDateString('vi-VN')}</p>
                                            </div>
                                            <div className="flex items-center gap-0.5 shrink-0">
                                                {/* Pin Toggle */}
                                                <button
                                                    onClick={(e) => handleTogglePinConversation(e, conv.id, !conv.is_pinned)}
                                                    className={`p-1 rounded-lg transition-colors ${
                                                        conv.is_pinned 
                                                            ? 'text-indigo-600 bg-indigo-50 opacity-100' 
                                                            : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:bg-gray-150 hover:text-gray-600'
                                                    }`}
                                                    title={conv.is_pinned ? "Bỏ ghim" : "Ghim lên đầu"}
                                                >
                                                    <Pin size={13} className={conv.is_pinned ? "fill-indigo-500" : ""} />
                                                </button>
                                                {/* Delete */}
                                                <button
                                                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 hover:text-red-600 text-gray-400 rounded-lg transition-colors"
                                                    title="Xóa"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
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
                            onClick={() => setShowPopupHint(!showPopupHint)}
                            className={`p-2 rounded-xl transition-colors flex items-center gap-1.5 text-sm font-medium ${showPopupHint ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100 text-amber-500 hover:text-amber-600'}`}
                            title="Gợi ý lệnh AI Agent"
                        >
                            <Lightbulb size={16} />
                            <span className="hidden sm:inline">Gợi ý lệnh</span>
                        </button>
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

            {/* Floating Suggestion Popup */}
            {showPopupHint && (
                <div className="absolute top-[60px] right-4 md:right-8 w-80 bg-white rounded-2xl shadow-2xl border border-indigo-100 p-4 z-[60] animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                            <Sparkles size={16} className="text-amber-500" /> Gợi ý lệnh AI nhanh
                        </h3>
                        <button onClick={() => setShowPopupHint(false)} className="text-gray-400 hover:text-gray-600 p-1">
                            <X size={14} />
                        </button>
                    </div>
                    <div className="space-y-3">
                        <button onClick={() => { setInput('Hôm nay ăn sáng 30k, uống cafe 25k, đổ xăng 50k.'); setShowPopupHint(false); inputRef.current?.focus(); }} className="w-full text-left p-2.5 rounded-xl bg-gray-50 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-colors group">
                            <p className="text-xs font-semibold text-gray-700 group-hover:text-indigo-700 flex items-center gap-1.5"><Wallet size={12} /> Thêm thu chi tự động bằng prompt tự nhiên </p>
                            <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">"Hôm nay ăn sáng 30k, uống cafe 25k, đổ xăng 50k."</p>
                        </button>
                        <button onClick={() => { setInput('Thêm lịch học Toán vào 19h tối thứ 3 và thứ 5.'); setShowPopupHint(false); inputRef.current?.focus(); }} className="w-full text-left p-2.5 rounded-xl bg-gray-50 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-colors group">
                            <p className="text-xs font-semibold text-gray-700 group-hover:text-indigo-700 flex items-center gap-1.5"><CalendarCheck size={12} /> Tạo lịch trình nhanh</p>
                            <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">"Thêm lịch học Toán vào 19h tối thứ 3 và thứ 5."</p>
                        </button>
                        <button onClick={() => { setInput('Nhắc tôi làm bài tập môn Hóa trước 22h tối nay.'); setShowPopupHint(false); inputRef.current?.focus(); }} className="w-full text-left p-2.5 rounded-xl bg-gray-50 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-colors group">
                            <p className="text-xs font-semibold text-gray-700 group-hover:text-indigo-700 flex items-center gap-1.5"><ListChecks size={12} /> Quản lý công việc (Todo)</p>
                            <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">"Nhắc tôi làm bài tập môn Hóa trước 22h tối nay."</p>
                        </button>
                    </div>
                </div>
            )}

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
                        <h3 className="text-sm font-bold text-indigo-700 mb-2.5 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Lightbulb size={16} className="text-amber-500" /> Nhận xét nhanh
                            </span>
                        </h3>
                        {isLoadingInsight ? (
                            <div className="flex items-center gap-2 text-indigo-500 text-xs font-semibold py-2">
                                <Loader2 size={14} className="animate-spin" /> Đang phân tích sâu...
                            </div>
                        ) : quickInsight ? (
                            <div className="space-y-3">
                                <div className="text-xs text-indigo-900/80 leading-relaxed prose prose-sm prose-p:my-0.5">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{quickInsight}</ReactMarkdown>
                                </div>
                                <button
                                    onClick={() => setQuickInsight(null)}
                                    className="text-[11px] text-indigo-500 hover:text-indigo-700 font-bold hover:underline flex items-center gap-1 mt-1"
                                >
                                    Thu nhỏ ↩
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-xs text-indigo-900/80 leading-relaxed font-medium">
                                    Tháng {now.getMonth() + 1}: Thu nhập {formatCurrency(monthIncome)}, chi tiêu {formatCurrency(monthExpense)}. Còn lại: <strong className="text-indigo-700">{formatCurrency(monthIncome - monthExpense)}</strong> ({monthIncome > 0 ? Math.round(((monthIncome - monthExpense) / monthIncome) * 100) : 0}%).
                                </p>
                                <button
                                    onClick={handleFetchAIInsight}
                                    className="w-full py-1.5 px-3 bg-white hover:bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-150 transition-colors flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"
                                >
                                    <Sparkles size={12} /> Phân tích sâu bằng AI ✨
                                </button>
                            </div>
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
                                                    p: ({ node, ...props }) => <p className="mb-3.5 leading-relaxed text-gray-700 last:mb-0" {...props} />,
                                                    h3: ({ node, ...props }) => <h3 className="text-base font-bold text-indigo-800 mt-4 mb-2" {...props} />,
                                                    ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-3.5 space-y-1.5" {...props} />,
                                                    ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-3.5 space-y-1.5" {...props} />,
                                                    li: ({ node, ...props }) => <li className="text-gray-700 leading-relaxed" {...props} />,
                                                    strong: ({ node, ...props }) => <strong className="font-bold text-indigo-950" {...props} />,
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
                        {/* Attached Files Preview */}
                        {attachedFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2 p-2 bg-gray-50 rounded-xl border border-gray-100 max-h-32 overflow-y-auto custom-scrollbar">
                                {attachedFiles.map((file, fIdx) => {
                                    return (
                                        <div key={fIdx} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-lg border border-gray-200 text-xs shadow-sm max-w-[200px] animate-fade-in">
                                            <span className="truncate font-medium text-gray-700" title={file.name}>{file.name}</span>
                                            <span className="text-[10px] text-gray-400 shrink-0">({(file.size / 1024).toFixed(0)}KB)</span>
                                            <button
                                                onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== fIdx))}
                                                className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-red-500 transition-colors shrink-0"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <div className="relative flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                            {/* Upload Popover Menu */}
                            {showUploadMenu && (
                                <div 
                                    ref={uploadMenuRef}
                                    className="absolute bottom-14 left-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-150 p-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 flex flex-col gap-0.5"
                                >
                                    <div className="px-2.5 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tải lên tệp tin</div>
                                    <button
                                        type="button"
                                        onClick={() => triggerFileSelect('image')}
                                        className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition-colors text-left"
                                    >
                                        <span className="text-base">🖼️</span> Hình ảnh (Ảnh chụp, TKB...)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => triggerFileSelect('document')}
                                        className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition-colors text-left"
                                    >
                                        <span className="text-base">📄</span> Tài liệu (PDF, Excel, TXT...)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => triggerFileSelect('audio')}
                                        className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition-colors text-left"
                                    >
                                        <span className="text-base">🎙️</span> Âm thanh (Audio, Ghi âm...)
                                    </button>
                                </div>
                            )}

                            {/* Hidden file input */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                multiple
                                accept="image/*,audio/*,application/pdf,text/plain,text/csv,.csv,.xlsx,.xls,.json,.md"
                            />
                            {/* Attachment trigger button */}
                            <button
                                type="button"
                                onClick={() => setShowUploadMenu(!showUploadMenu)}
                                disabled={isLoading}
                                className={`m-1 p-2 rounded-xl transition-all shrink-0 ${showUploadMenu ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:text-indigo-600 hover:bg-gray-150'}`}
                                title="Đính kèm tài liệu, ảnh hoặc âm thanh"
                            >
                                <Plus size={20} className={`transition-transform duration-200 ${showUploadMenu ? 'rotate-45' : ''}`} />
                            </button>
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder='Nhập đi bạn ơi, hoặc đính kèm ảnh, âm thanh, tài liệu....'
                                className="flex-1 bg-transparent px-1 py-2.5 text-sm outline-none resize-none max-h-28 min-h-[44px] placeholder:text-gray-400"
                                rows={1}
                            />
                            <button
                                onClick={() => handleSend()}
                                disabled={(!input.trim() && attachedFiles.length === 0) || isLoading}
                                className="m-1 p-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-200 disabled:opacity-40 disabled:hover:shadow-none transition-all shrink-0"
                            >
                                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            </button>
                        </div>
                        <p className="text-[9px] text-center text-gray-400 mt-2">
                            Powered by Gemini ({getCurrentModel().replace('gemini-', '')}) · Tải lên tối đa 15MB/file, phân tích qua bộ nhớ RAM
                        </p>
                    </div>
                </div>
            </div>
            <ConfirmModal
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(p => ({ ...p, isOpen: false }))}
            />
        </div>
    );
};

export default AIAdvisorPage;
