// File: src/components/AIAdvisorPage.tsx
// Full-page AI Financial Advisor Canvas v2
// — Function Calling, Inline Charts, NL Actions

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    ArrowLeft, Send, Sparkles, Loader2, Bot, RefreshCw,
    TrendingDown, Target, ListChecks, BarChart3, Wallet,
    PiggyBank, CalendarCheck, Brain, Lightbulb, ChevronRight, ChevronDown, ChevronUp,
    CheckCircle2, AlertCircle, History, X, Plus, Trash2, GraduationCap,
    Heart, Pin, Copy, Check, Download, FileText, LayoutGrid, Mic, MicOff, Zap, Square
} from 'lucide-react';

import { AppState, TransactionType } from '../types';
import { generateQuickInsight, getCurrentModel, type ChatMessage } from '../services/geminiService';
import { chatWithAI, type ActionHandlers, type ChartData, type ActionResult, type AIAttachment } from '../services/aiEngine';
import { chatHistoryService, type AIConversation, type AIMessage } from '../services/chatHistoryService';
import { memoryService } from '../services/memoryService';
import { aiQuotaService, type UserQuotaStatus } from '../services/aiQuotaService';
import AIBoostModal from './AIBoostModal';
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
    onImportGPAData?: (semesters: any[]) => Promise<void>;
    onSelectBoostPack?: (packType: 'boost_s' | 'boost_m' | 'boost_l') => void;
}

interface UIMessage {
    role: 'user' | 'assistant';
    content: string;
    charts?: ChartData[];
    actions?: ActionResult[];
    files?: Array<{ name: string; type: string; size: number }>;
    tokens_used?: number;
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
        gradient: 'from-violet-500 to-violet-500',
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
        gradient: 'from-green-500 to-emerald-500',
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
    onAddTimetable, onAddTodo, onAddTransaction, onImportGPAData,
    onSelectBoostPack
}) => {
    const [messages, setMessages] = useState<UIMessage[]>([
        {
            role: 'assistant',
            content: '👋 Chào bạn! Mình là **SmartLife Advisor v2** — trợ lý AI thông minh.\n\n🆕 **Khả năng mới:**\n- 📊 **Truy vấn dữ liệu** trực tiếp từ database\n- 📈 **Bảng tính (table) & Dự đoán** chi tiêu\n- ✏️ **Thêm lịch trình, việc cần làm, giao dịch** bằng ngôn ngữ tự nhiên\n- 📎 **Phân tích tài liệu & hình ảnh**: Đọc hiểu ảnh thời khóa biểu, hóa đơn, file excel, csv, pdf, txt, hoặc âm thanh trực tiếp trong bộ nhớ tạm để xử lý nhanh chóng.\n\n💡 **Thử hỏi mình:**\n- _"Đưa ra dự đoán chi tiêu tháng tới cho tôi"_\n- _"Lập bảng so sánh thu chi 3 tháng gần nhất"_\n- _"Thêm lịch học IELTS thứ 3, thứ 5 lúc 19h"_\n\nHoặc chọn gợi ý bên dưới! 👇'
        }
    ]);
    const [geminiChatHistory, setGeminiChatHistory] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activeArtifact, setActiveArtifact] = useState<{ title: string; content: string } | null>(null);
    const [copied, setCopied] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const handleStopResponse = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsLoading(false);
    };

    // AI Quota states (Phase 4 & 5)
    const [quotaStatus, setQuotaStatus] = useState<UserQuotaStatus | null>(null);
    const [showQuotaDetail, setShowQuotaDetail] = useState(false);
    const [showBoostModal, setShowBoostModal] = useState(false);

    const refreshQuota = useCallback(async () => {
        if (!appState.profile?.id) return;
        const status = await aiQuotaService.getUserQuotaStatus(appState.profile.id, appState.profile.plan);
        setQuotaStatus(status);
    }, [appState.profile?.id, appState.profile?.plan]);

    useEffect(() => {
        refreshQuota();
    }, [refreshQuota]);

    // Sidebar cards layout states (Collapse/Hide)
    const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);
    const [isInsightCollapsed, setIsInsightCollapsed] = useState(false);
    const [isGoalsCollapsed, setIsGoalsCollapsed] = useState(false);

    const [isStatsHidden, setIsStatsHidden] = useState(false);
    const [isInsightHidden, setIsInsightHidden] = useState(false);
    const [isGoalsHidden, setIsGoalsHidden] = useState(false);

    const [showWidgetMenu, setShowWidgetMenu] = useState(false);
    const widgetMenuRef = useRef<HTMLDivElement>(null);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

    const parseArtifact = (content: string) => {
        const artifactRegex = /<artifact\s+title=["']([^"']+)["']\s*>([\s\S]*?)<\/artifact>/i;
        const match = content.match(artifactRegex);
        if (match) {
            const title = match[1];
            const artifactContent = match[2].trim();
            const cleanContent = content.replace(artifactRegex, '').trim();
            return {
                title,
                artifactContent,
                cleanContent
            };
        }
        return null;
    };

    const getParsedChart = (text: string): ChartData | null => {
        try {
            const cleanText = text.trim();
            if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
                const parsed = JSON.parse(cleanText);
                if (parsed && (parsed.chartType || parsed.chart_type) && parsed.title && Array.isArray(parsed.data)) {
                    return {
                        chart_type: parsed.chartType || parsed.chart_type || 'bar',
                        title: parsed.title,
                        data: parsed.data
                    };
                }
            }
        } catch (e) {
            // silent fail
        }
        return null;
    };
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
        const MAX_SIZE = 30 * 1024 * 1024;
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
        onImportGPAData,
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
        return () => {
            clearTimeout(timer);
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    useEffect(() => {
        const handleResize = () => {
            setIsDesktop(window.innerWidth >= 1024);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
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

    const handleCopyArtifact = () => {
        if (!activeArtifact) return;
        navigator.clipboard.writeText(activeArtifact.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownloadArtifact = () => {
        if (!activeArtifact) return;
        const blob = new Blob([activeArtifact.content], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${activeArtifact.title.replace(/\s+/g, '_')}.md`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Load memory context on mount
    useEffect(() => {
        memoryService.getMemoryContextString()
            .then(setMemoryContext)
            .catch(console.error);
    }, []);

    // Speech Recognition states & setup
    const [isRecording, setIsRecording] = useState(false);
    const [recordingError, setRecordingError] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            const rec = new SpeechRecognition();
            rec.continuous = true;
            rec.interimResults = true;
            rec.lang = lang === 'vi' ? 'vi-VN' : lang === 'ko' ? 'ko-KR' : 'en-US';

            rec.onresult = (event: any) => {
                let currentText = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        currentText += event.results[i][0].transcript;
                    }
                }
                if (currentText) {
                    setInput(prev => prev + (prev ? ' ' : '') + currentText);
                }
            };

            rec.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                if (event.error !== 'no-speech') {
                    setRecordingError(event.error);
                    setIsRecording(false);
                }
            };

            rec.onend = () => {
                setIsRecording(false);
            };

            recognitionRef.current = rec;
        }
    }, [lang]);

    const toggleRecording = () => {
        if (!recognitionRef.current) {
            alert(lang === 'vi' ? 'Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.' : 'Your browser does not support Speech Recognition.');
            return;
        }

        if (isRecording) {
            recognitionRef.current.stop();
            setIsRecording(false);
        } else {
            setRecordingError(null);
            try {
                recognitionRef.current.start();
                setIsRecording(true);
            } catch (err: any) {
                console.error('Error starting recognition:', err);
                setIsRecording(false);
            }
        }
    };

    // Click outside upload menu & widget menu handler
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (uploadMenuRef.current && !uploadMenuRef.current.contains(event.target as Node)) {
                setShowUploadMenu(false);
            }
            if (widgetMenuRef.current && !widgetMenuRef.current.contains(event.target as Node)) {
                setShowWidgetMenu(false);
            }
        };
        if (showUploadMenu || showWidgetMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showUploadMenu, showWidgetMenu]);


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

        // Initialize AbortController for request cancellation
        const controller = new AbortController();
        abortControllerRef.current = controller;

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

            // Construct new user ChatMessage for Gemini history
            const userPartText = finalUserMsg + promptExtension;
            const newUserMsg: ChatMessage = {
                role: 'user',
                parts: [{ text: userPartText }]
            };
            const historyToSend = [...geminiChatHistory, newUserMsg];

            const response = await chatWithAI(historyToSend, appState, actionHandlers, memoryContext, attachmentsToSend, controller.signal);

            // Save AI response to DB
            if (currentConvId) {
                await chatHistoryService.saveMessage(
                    currentConvId,
                    'assistant',
                    response.text,
                    response.charts.length > 0 ? response.charts : undefined,
                    response.actions.length > 0 ? response.actions : undefined,
                    response.tokens_used
                );
            }

            // Update Gemini Chat History state
            if (response.updatedHistory) {
                setGeminiChatHistory(response.updatedHistory);
            } else {
                setGeminiChatHistory([...historyToSend, { role: 'model', parts: [{ text: response.text }] }]);
            }

            // Extract memories periodically
            if (newMessages.length > 3 && newMessages.length % 4 === 1) {
                const chatText = newMessages.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n');
                memoryService.extractMemoriesFromConversation(chatText).catch(console.error);
            }

            // Auto-open artifact if generated (Mobile only)
            const parsedRes = parseArtifact(response.text);
            if (parsedRes && !isDesktop) {
                setActiveArtifact({
                    title: parsedRes.title,
                    content: parsedRes.artifactContent
                });
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: response.text,
                charts: response.charts.length > 0 ? response.charts : undefined,
                actions: response.actions.length > 0 ? response.actions : undefined,
                tokens_used: response.tokens_used
            }]);
        } catch (error: any) {
            if (error.name === 'AbortError') {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `🛑 Đã dừng phản hồi từ AI theo yêu cầu.`
                }]);
            } else {
                console.error(error);
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `⚠️ Xin lỗi, đã có lỗi xảy ra: ${error.message}\n\nVui lòng thử lại.`
                }]);
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
            refreshQuota();
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
        setActiveArtifact(null);
        setMessages([{
            role: 'assistant',
            content: '🔄 Cuộc trò chuyện đã được làm mới! Mình sẵn sàng phân tích dữ liệu cho bạn. 🌱'
        }]);
        setGeminiChatHistory([]);
        setShowHistory(false);
    };

    const loadConversation = async (convId: string) => {
        setIsLoading(true);
        setActiveArtifact(null);
        try {
            const msgs: AIMessage[] = await chatHistoryService.getMessages(convId);
            const uiMsgs: UIMessage[] = msgs.map((m: AIMessage) => ({
                role: m.role,
                content: m.content,
                charts: m.charts || undefined,
                actions: m.actions || undefined,
                tokens_used: m.tokens_used
            }));
            setMessages(uiMsgs.length > 0 ? uiMsgs : [{
                role: 'assistant',
                content: 'Cuộc trò chuyện này trống. Hãy bắt đầu hỏi gì đó!'
            }]);

            // Reconstruct the Gemini Chat History from loaded database messages
            const loadedHistory: ChatMessage[] = msgs.map(m => ({
                role: m.role === 'user' ? 'user' as const : 'model' as const,
                parts: [{ text: m.content }]
            }));
            // Shift the first message if it is from model to satisfy Gemini's alternating role constraint
            if (loadedHistory.length > 0 && loadedHistory[0].role === 'model') {
                loadedHistory.shift();
            }
            setGeminiChatHistory(loadedHistory);

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
        <div className="animate-fade-in fixed inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 flex flex-col h-[100dvh] z-40">
            {/* History Overlay/Drawer */}
            {showHistory && (
                <div className="fixed inset-0 z-50 flex">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
                    <div className="relative w-80 max-w-[85%] h-full bg-white shadow-2xl flex flex-col animate-fade-in-right">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h2 className="font-bold text-gray-800 flex items-center gap-2">
                                <History size={18} className="text-blue-500" />
                                Lịch sử trò chuyện
                            </h2>
                            <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-gray-200 rounded-lg">
                                <X size={18} className="text-gray-500" />
                            </button>
                        </div>

                        <div className="p-3">
                            <button
                                onClick={handleReset}
                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 font-medium transition-colors text-sm"
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
                                            className={`group px-3 py-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-all border ${conversationId === conv.id ? 'bg-blue-50/80 border-blue-100' : 'hover:bg-gray-50/50 border-transparent'} ${conv.is_pinned ? 'border-l-4 border-l-blue-500 bg-slate-50/40 shadow-sm' : ''}`}
                                        >
                                            <div className="flex-1 min-w-0 pr-2">
                                                <div className="flex items-center gap-1.5">
                                                    <p className={`text-sm truncate font-medium ${conversationId === conv.id ? 'text-blue-700 font-semibold' : 'text-gray-700'}`}>{conv.title}</p>
                                                    {conv.is_pinned && <Pin size={10} className="text-blue-500 fill-blue-500 shrink-0" />}
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-0.5">{new Date(conv.updated_at).toLocaleDateString('vi-VN')}</p>
                                            </div>
                                            <div className="flex items-center gap-0.5 shrink-0">
                                                {/* Pin Toggle */}
                                                <button
                                                    onClick={(e) => handleTogglePinConversation(e, conv.id, !conv.is_pinned)}
                                                    className={`p-1 rounded-lg transition-colors ${conv.is_pinned
                                                        ? 'text-blue-600 bg-blue-50 opacity-100'
                                                        : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:bg-gray-150 hover:text-gray-600'
                                                        }`}
                                                    title={conv.is_pinned ? "Bỏ ghim" : "Ghim lên đầu"}
                                                >
                                                    <Pin size={13} className={conv.is_pinned ? "fill-blue-500" : ""} />
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
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-100">
                                <Brain size={16} className="text-white" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-800 text-sm leading-tight">SmartLife AI Advisor</h1>
                                <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                    </span>
                                    Gemini AI Advisor ({getCurrentModel().replace('gemini-', '')})
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {/* Quota Indicator Chip */}
                        {quotaStatus && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowQuotaDetail(!showQuotaDetail)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 border border-gray-100 rounded-xl transition-all cursor-pointer text-xs font-semibold text-gray-700 active:scale-95"
                                    title="Nhấp để xem chi tiết Quota AI"
                                >
                                    <Zap size={14} className={quotaStatus.tokensToday >= quotaStatus.tokensTodayLimit * 0.8 ? 'text-amber-500 animate-pulse fill-amber-500' : 'text-indigo-600'} />
                                    <span className="hidden sm:inline">AI Quota:</span>
                                    <span>{Math.min(100, Math.round((quotaStatus.tokensToday / (quotaStatus.tokensTodayLimit || 1)) * 100))}%</span>
                                </button>
                                
                                {showQuotaDetail && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowQuotaDetail(false)} />
                                        <div className="absolute right-0 top-10 w-72 bg-white border border-gray-150 rounded-2xl shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200 text-left">
                                            <h3 className="font-bold text-gray-800 text-xs mb-3 flex items-center justify-between">
                                                <span className="flex items-center gap-1"><Brain size={14} className="text-indigo-600" /> Hạn mức sử dụng AI</span>
                                                <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-wider">{quotaStatus.plan}</span>
                                            </h3>
                                            
                                            <div className="space-y-3 text-[11px]">
                                                {/* Requests */}
                                                <div>
                                                    <div className="flex justify-between text-gray-500 mb-1 font-medium">
                                                        <span>💬 Lượt yêu cầu (ngày):</span>
                                                        <span className="font-bold text-gray-800">{quotaStatus.requestsToday}/{quotaStatus.requestsLimit}</span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                        <div 
                                                            className="h-1.5 rounded-full bg-indigo-500" 
                                                            style={{ width: `${Math.min((quotaStatus.requestsToday / (quotaStatus.requestsLimit || 1)) * 100, 100)}%` }} 
                                                        />
                                                    </div>
                                                </div>

                                                {/* Tokens Today */}
                                                <div>
                                                    <div className="flex justify-between text-gray-500 mb-1 font-medium">
                                                        <span>⚡ Token hôm nay:</span>
                                                        <span className="font-bold text-gray-800">{(quotaStatus.tokensToday / 1000).toFixed(1)}k/{(quotaStatus.tokensTodayLimit / 1000).toFixed(0)}k</span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                        <div 
                                                            className={`h-1.5 rounded-full ${quotaStatus.tokensToday >= quotaStatus.tokensTodayLimit * 0.8 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                                                            style={{ width: `${Math.min((quotaStatus.tokensToday / (quotaStatus.tokensTodayLimit || 1)) * 100, 100)}%` }} 
                                                        />
                                                    </div>
                                                </div>

                                                {/* Tokens Month */}
                                                {quotaStatus.tokensMonthLimit !== Infinity && quotaStatus.tokensMonthLimit > 0 && (
                                                    <div>
                                                        <div className="flex justify-between text-gray-500 mb-1 font-medium">
                                                            <span>📅 Token tháng này:</span>
                                                            <span className="font-bold text-gray-800">{(quotaStatus.tokensMonth / 1000).toFixed(0)}k/{(quotaStatus.tokensMonthLimit / 1000).toFixed(0)}k</span>
                                                        </div>
                                                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                            <div 
                                                                className={`h-1.5 rounded-full ${quotaStatus.tokensMonth >= quotaStatus.tokensMonthLimit * 0.8 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                                                style={{ width: `${Math.min((quotaStatus.tokensMonth / (quotaStatus.tokensMonthLimit || 1)) * 100, 100)}%` }} 
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Boost info */}
                                                <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between text-[10px] font-semibold">
                                                    <span className="text-gray-500">🚀 Token Boost khả dụng:</span>
                                                    <span className="font-bold text-emerald-600">+{quotaStatus.boostTokensRemaining.toLocaleString()} tokens</span>
                                                </div>

                                                <button
                                                    onClick={() => { setShowQuotaDetail(false); setShowBoostModal(true); }}
                                                    className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-emerald-100 text-center transition-all block mt-2 text-[10px]"
                                                >
                                                    🚀 Mua thêm AI Boost Pack
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        <button
                            onClick={() => setShowPopupHint(!showPopupHint)}
                            className={`p-2 rounded-xl transition-colors flex items-center gap-1.5 text-sm font-medium ${showPopupHint ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-amber-500 hover:text-amber-600'}`}
                            title="Gợi ý lệnh AI Agent"
                        >
                            <Lightbulb size={16} />
                            <span className="hidden sm:inline">Gợi ý lệnh</span>
                        </button>

                        {(isStatsHidden || isInsightHidden || isGoalsHidden) && (
                            <div className="relative" ref={widgetMenuRef}>
                                <button
                                    onClick={() => setShowWidgetMenu(!showWidgetMenu)}
                                    className={`p-2 rounded-xl transition-colors flex items-center gap-1.5 text-sm font-medium ${showWidgetMenu ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-500 hover:text-blue-600'}`}
                                    title="Quản lý thẻ thông tin"
                                >
                                    <LayoutGrid size={16} />
                                    <span className="hidden sm:inline">Quản lý thẻ</span>
                                </button>
                                {showWidgetMenu && (
                                    <div className="absolute right-0 top-11 w-56 bg-white rounded-2xl shadow-xl border border-gray-150 p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col gap-0.5">
                                        <div className="px-2.5 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Khôi phục thẻ</div>
                                        {isStatsHidden && (
                                            <button
                                                onClick={() => { setIsStatsHidden(false); setShowWidgetMenu(false); }}
                                                className="w-full text-left px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors flex items-center gap-2"
                                            >
                                                <Wallet size={14} className="text-blue-500" /> Hiện Tóm tắt tài chính
                                            </button>
                                        )}
                                        {isInsightHidden && (
                                            <button
                                                onClick={() => { setIsInsightHidden(false); setShowWidgetMenu(false); }}
                                                className="w-full text-left px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors flex items-center gap-2"
                                            >
                                                <Lightbulb size={14} className="text-blue-500" /> Hiện Nhận xét nhanh
                                            </button>
                                        )}
                                        {isGoalsHidden && (
                                            <button
                                                onClick={() => { setIsGoalsHidden(false); setShowWidgetMenu(false); }}
                                                className="w-full text-left px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors flex items-center gap-2"
                                            >
                                                <Target size={14} className="text-blue-500" /> Hiện Mục tiêu
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            onClick={() => setShowHistory(true)}
                            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500 hover:text-blue-600 flex items-center gap-1.5"
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
                <div className="absolute top-[60px] right-4 md:right-8 w-80 bg-white rounded-2xl shadow-2xl border border-blue-100 p-4 z-[60] animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                            <Sparkles size={16} className="text-blue-500" /> Gợi ý lệnh AI Agent
                        </h3>
                        <button onClick={() => setShowPopupHint(false)} className="text-gray-400 hover:text-gray-600 p-1">
                            <X size={14} />
                        </button>
                    </div>
                    <div className="space-y-3">
                        <button onClick={() => { setInput('Hôm nay ăn sáng 30k, uống cafe 25k, đổ xăng 50k.'); setShowPopupHint(false); inputRef.current?.focus(); }} className="w-full text-left p-2.5 rounded-xl bg-gray-50 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-colors group">
                            <p className="text-xs font-semibold text-gray-700 group-hover:text-blue-700 flex items-center gap-1.5"><Wallet size={12} /> Thêm thu chi tự động bằng prompt tự nhiên </p>
                            <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">"Hôm nay ăn sáng 30k, uống cafe 25k, đổ xăng 50k."</p>
                        </button>
                        <button onClick={() => { setInput('Thêm lịch học Toán vào 19h tối thứ 3 và thứ 5.'); setShowPopupHint(false); inputRef.current?.focus(); }} className="w-full text-left p-2.5 rounded-xl bg-gray-50 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-colors group">
                            <p className="text-xs font-semibold text-gray-700 group-hover:text-blue-700 flex items-center gap-1.5"><CalendarCheck size={12} /> Tạo lịch trình nhanh</p>
                            <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">"Thêm lịch học Toán vào 19h tối thứ 3 và thứ 5."</p>
                        </button>
                        <button onClick={() => { setInput('Nhắc tôi làm bài tập môn Hóa trước 22h tối nay.'); setShowPopupHint(false); inputRef.current?.focus(); }} className="w-full text-left p-2.5 rounded-xl bg-gray-50 hover:bg-emerald-50 border border-transparent hover:border-emerald-100 transition-colors group">
                            <p className="text-xs font-semibold text-gray-700 group-hover:text-emerald-700 flex items-center gap-1.5"><ListChecks size={12} /> Quản lý công việc (Todo)</p>
                            <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">"Nhắc tôi làm bài tập môn Hóa trước 22h tối nay."</p>
                        </button>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto flex-1 flex flex-col lg:flex-row gap-0 lg:gap-6 px-0 lg:px-8 pt-0 lg:pt-2 overflow-hidden w-full min-h-0">

                {/* ── Sidebar (Desktop only) ── */}
                {!(isStatsHidden && isInsightHidden && isGoalsHidden) && (
                    <div className={`hidden lg:flex flex-col w-80 shrink-0 gap-4 overflow-y-auto pb-6 pr-2 custom-scrollbar ${activeArtifact && !isDesktop ? 'lg:hidden' : ''}`}>
                        {/* Quick Stats */}
                        {!isStatsHidden && (
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 transition-all duration-300">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                        <Wallet size={16} className="text-blue-500" /> Tóm tắt T{now.getMonth() + 1}
                                    </h3>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => setIsStatsCollapsed(!isStatsCollapsed)}
                                            className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                                            title={isStatsCollapsed ? "Mở rộng" : "Thu gọn"}
                                        >
                                            {isStatsCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                        </button>
                                        <button
                                            onClick={() => setIsStatsHidden(true)}
                                            className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                                            title="Tắt/Ẩn thẻ"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>

                                {!isStatsCollapsed && (
                                    <div className="space-y-3 animate-fade-in">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-500">Số dư</span>
                                            <span className="font-bold text-gray-800 text-sm">{formatCurrency(totalBalance)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-500">Thu nhập</span>
                                            <span className="font-semibold text-blue-600 text-sm">+{formatCurrency(monthIncome)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-500">Chi tiêu</span>
                                            <span className="font-semibold text-red-500 text-sm">-{formatCurrency(monthExpense)}</span>
                                        </div>
                                        <div className="pt-2 border-t border-gray-50">
                                            <div className="flex justify-between items-center mb-1.5">
                                                <span className="text-xs text-gray-500">Tổng quỹ tiết kiệm</span>
                                                <span className="font-bold text-sm text-blue-600">{formatCurrency(totalSavings)}</span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2">
                                                <div
                                                    className="h-2 rounded-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-700 max-w-full"
                                                    style={{ width: `${Math.max(Math.min(savingsPercentOfIncome, 100), 5)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* AI Quick Insight */}
                        {!isInsightHidden && (
                            <div className="bg-gradient-to-br from-blue-55 to-indigo-50/50 rounded-2xl border border-blue-100 p-5 transition-all duration-300">
                                <div className="flex items-center justify-between mb-2.5">
                                    <h3 className="text-sm font-bold text-blue-700 flex items-center gap-2">
                                        <Lightbulb size={16} className="text-amber-500" /> Nhận xét nhanh
                                    </h3>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => setIsInsightCollapsed(!isInsightCollapsed)}
                                            className="p-1 hover:bg-blue-100/50 rounded-lg text-blue-400 hover:text-blue-700 transition-colors"
                                            title={isInsightCollapsed ? "Mở rộng" : "Thu gọn"}
                                        >
                                            {isInsightCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                        </button>
                                        <button
                                            onClick={() => setIsInsightHidden(true)}
                                            className="p-1 hover:bg-blue-100/50 rounded-lg text-blue-400 hover:text-red-500 transition-colors"
                                            title="Tắt/Ẩn thẻ"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>

                                {!isInsightCollapsed && (
                                    <div className="animate-fade-in">
                                        {isLoadingInsight ? (
                                            <div className="flex items-center gap-2 text-blue-500 text-xs font-semibold py-2">
                                                <Loader2 size={14} className="animate-spin" /> Đang phân tích sâu...
                                            </div>
                                        ) : quickInsight ? (
                                            <div className="space-y-3">
                                                <div className="text-xs text-blue-900/80 leading-relaxed prose prose-sm prose-p:my-0.5">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{quickInsight}</ReactMarkdown>
                                                </div>
                                                <button
                                                    onClick={() => setQuickInsight(null)}
                                                    className="text-[11px] text-blue-500 hover:text-blue-700 font-bold hover:underline flex items-center gap-1 mt-1"
                                                >
                                                    Thu nhỏ ↩
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <p className="text-xs text-blue-900/80 leading-relaxed font-medium">
                                                    Tháng {now.getMonth() + 1}: Thu nhập {formatCurrency(monthIncome)}, chi tiêu {formatCurrency(monthExpense)}. Còn lại: <strong className="text-blue-700">{formatCurrency(monthIncome - monthExpense)}</strong> ({monthIncome > 0 ? Math.round(((monthIncome - monthExpense) / monthIncome) * 100) : 0}%).
                                                </p>
                                                <button
                                                    onClick={handleFetchAIInsight}
                                                    className="w-full py-1.5 px-3 bg-white hover:bg-blue-50 text-blue-700 text-xs font-bold rounded-xl border border-blue-150 transition-colors flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"
                                                >
                                                    <Sparkles size={12} /> Phân tích sâu bằng AI ✨
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Goals Summary */}
                        {appState.goals.length > 0 && !isGoalsHidden && (
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 transition-all duration-300">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                        <Target size={16} className="text-blue-500" /> Mục tiêu ({appState.goals.length})
                                    </h3>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => setIsGoalsCollapsed(!isGoalsCollapsed)}
                                            className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                                            title={isGoalsCollapsed ? "Mở rộng" : "Thu gọn"}
                                        >
                                            {isGoalsCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                        </button>
                                        <button
                                            onClick={() => setIsGoalsHidden(true)}
                                            className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                                            title="Tắt/Ẩn thẻ"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>

                                {!isGoalsCollapsed && (
                                    <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1 animate-fade-in">
                                        {appState.goals.map(g => {
                                            let pct = 0;
                                            let subLabel = '';

                                            if (g.target_amount && g.target_amount > 0) {
                                                pct = Math.min(100, Math.round(((g.current_amount || 0) / g.target_amount) * 100));
                                                subLabel = `${formatCurrency(g.current_amount || 0)} / ${formatCurrency(g.target_amount)}`;
                                            } else if (g.progress != null) {
                                                pct = g.progress;
                                            } else if (g.created_at && g.deadline) {
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
                                                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-500"
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
                                )}
                            </div>
                        )}

                        {/* Hidden Widgets Restore Bar */}
                        {(isStatsHidden || isInsightHidden || isGoalsHidden) && (
                            <div className="bg-slate-50/50 rounded-2xl border border-dashed border-gray-200 p-4 mt-auto">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Thẻ đã ẩn</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {isStatsHidden && (
                                        <button
                                            onClick={() => setIsStatsHidden(false)}
                                            className="px-2 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-gray-200 rounded-lg text-[10px] font-semibold flex items-center gap-1 shadow-sm transition-all"
                                        >
                                            + Tóm tắt
                                        </button>
                                    )}
                                    {isInsightHidden && (
                                        <button
                                            onClick={() => setIsInsightHidden(false)}
                                            className="px-2 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-gray-200 rounded-lg text-[10px] font-semibold flex items-center gap-1 shadow-sm transition-all"
                                        >
                                            + Nhận xét
                                        </button>
                                    )}
                                    {isGoalsHidden && (
                                        <button
                                            onClick={() => setIsGoalsHidden(false)}
                                            className="px-2 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-gray-200 rounded-lg text-[10px] font-semibold flex items-center gap-1 shadow-sm transition-all"
                                        >
                                            + Mục tiêu
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Chat Area ── */}
                <div className="flex-1 flex flex-col min-h-0 bg-white lg:rounded-t-2xl lg:border lg:border-gray-100 lg:shadow-sm overflow-hidden">
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar">
                        {messages.map((msg, idx) => {
                            const parsedArtifactData = msg.role === 'assistant' ? parseArtifact(msg.content) : null;
                            const displayContent = parsedArtifactData
                                ? (parsedArtifactData.cleanContent || `📊 AI đã lập báo cáo **${parsedArtifactData.title}**`)
                                : msg.content;

                            return (
                                <div key={idx} className={`flex items-end gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-fade-in`}>
                                    {/* Avatar */}
                                    {msg.role === 'assistant' && (
                                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg md:rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 shadow-sm">
                                            <Sparkles size={12} className="text-white bg-transparent" />
                                        </div>
                                    )}

                                    {/* Bubble */}
                                    <div className={`max-w-[88%] ${msg.role === 'user' ? 'lg:max-w-[75%]' : 'lg:max-w-[85%]'} ${msg.role === 'user' ? '' : ''}`}>
                                        <div className={`px-3.5 py-2.5 md:px-4 md:py-3 text-sm md:text-[15px] leading-relaxed shadow-sm
                                            ${msg.role === 'user'
                                                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl rounded-br-md prose-invert prose-p:text-white prose-headings:text-white'
                                                : 'bg-gray-50 text-gray-700 border border-gray-100 rounded-2xl rounded-bl-md prose prose-sm md:prose-base prose-p:my-1 md:prose-p:my-1.5 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-blue-700 prose-h3:text-base md:prose-h3:text-lg prose-h3:mt-3 prose-h3:mb-1'
                                            }`}
                                        >
                                            {msg.role === 'assistant' ? (
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        p: ({ node, ...props }) => <p className="mb-3.5 leading-relaxed text-gray-700 last:mb-0" {...props} />,
                                                        h3: ({ node, ...props }) => <h3 className="text-base font-bold text-blue-800 mt-4 mb-2" {...props} />,
                                                        ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-3.5 space-y-1.5" {...props} />,
                                                        ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-3.5 space-y-1.5" {...props} />,
                                                        li: ({ node, ...props }) => <li className="text-gray-700 leading-relaxed" {...props} />,
                                                        strong: ({ node, ...props }) => <strong className="font-bold text-blue-950" {...props} />,
                                                        table: ({ node, ...props }) => <div className="overflow-x-auto my-4"><table className="w-full border-collapse border border-blue-200 text-sm" {...props} /></div>,
                                                        thead: ({ node, ...props }) => <thead className="bg-blue-50" {...props} />,
                                                        th: ({ node, ...props }) => <th className="border border-blue-200 px-4 py-2 text-left font-semibold text-blue-900" {...props} />,
                                                        td: ({ node, ...props }) => <td className="border border-blue-100 px-4 py-2 text-gray-700" {...props} />,
                                                        tr: ({ node, ...props }) => <tr className="even:bg-gray-50/50" {...props} />
                                                    }}
                                                >
                                                    {displayContent}
                                                </ReactMarkdown>
                                            ) : (
                                                displayContent
                                            )}
                                        </div>

                                        {/* Artifact Card trigger in Chat Bubble */}
                                        {parsedArtifactData && !isDesktop && (
                                            <div className="mt-2 p-3 bg-blue-50/75 rounded-xl border border-blue-100 flex items-center justify-between gap-3 animate-fade-in shadow-sm">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-blue-950 flex items-center gap-1.5">
                                                        <FileText size={14} className="text-blue-600" /> Báo cáo: {parsedArtifactData.title}
                                                    </p>
                                                    <p className="text-[10px] text-blue-700/80 mt-0.5 truncate">Báo cáo chi tiết đã được lập.</p>
                                                </div>
                                                <button
                                                    onClick={() => setActiveArtifact({ title: parsedArtifactData.title, content: parsedArtifactData.artifactContent })}
                                                    className="px-2.5 py-1.5 bg-white text-blue-700 hover:bg-blue-50 border border-blue-150 text-xs font-bold rounded-lg transition-colors shadow-sm shrink-0"
                                                >
                                                    Xem báo cáo 📑
                                                </button>
                                            </div>
                                        )}

                                        {/* Action Confirmations */}
                                        {msg.actions && msg.actions.length > 0 && (
                                            <div className="mt-2 space-y-1.5">
                                                {msg.actions.map((action, ai) => (
                                                    <div
                                                        key={ai}
                                                        className={`flex items-start gap-2 px-3 py-2 rounded-xl text-xs ${action.success
                                                            ? 'bg-blue-50 border border-blue-200 text-blue-700'
                                                            : 'bg-red-50 border border-red-200 text-red-700'
                                                            }`}
                                                    >
                                                        {action.success
                                                            ? <CheckCircle2 size={14} className="text-blue-500 shrink-0 mt-0.5" />
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
                                         {/* Token Counter */}
                                         {msg.role === 'assistant' && msg.tokens_used !== undefined && msg.tokens_used !== null && (
                                             <div className="text-[10px] text-gray-400 mt-1 ml-1 flex items-center gap-1 select-none animate-fade-in">
                                                 <Zap size={10} className="text-gray-400 shrink-0" />
                                                 <span>Tiêu tốn: <strong>{msg.tokens_used.toLocaleString()}</strong> tokens</span>
                                             </div>
                                         )}
                                     </div>
                                </div>
                            );
                        })}

                        {/* Loading */}
                        {isLoading && (
                            <div className="flex items-end gap-2.5 animate-fade-in">
                                <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg md:rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0">
                                    <Sparkles size={12} className="text-white" />
                                </div>
                                <div className="bg-gray-50 px-4 py-3 md:px-5 md:py-4 rounded-2xl rounded-bl-md border border-gray-100 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></span>
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
                        <div className="relative flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
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
                                        className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors text-left"
                                    >
                                        <span className="text-base">🖼️</span> Hình ảnh (Ảnh chụp, TKB...)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => triggerFileSelect('document')}
                                        className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors text-left"
                                    >
                                        <span className="text-base">📄</span> Tài liệu (PDF, Excel, TXT...)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => triggerFileSelect('audio')}
                                        className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors text-left"
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
                                className={`m-1 p-2 rounded-xl transition-all shrink-0 ${showUploadMenu ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:text-blue-600 hover:bg-gray-150'}`}
                                title="Đính kèm tài liệu, ảnh hoặc âm thanh"
                            >
                                <Plus size={20} className={`transition-transform duration-200 ${showUploadMenu ? 'rotate-45' : ''}`} />
                            </button>

                            {/* Voice recognition mic button */}
                            <button
                                type="button"
                                onClick={toggleRecording}
                                disabled={isLoading}
                                className={`m-1 p-2 rounded-xl transition-all shrink-0 ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'text-gray-400 hover:text-blue-600 hover:bg-gray-150'}`}
                                title={lang === 'vi' ? 'Nhận diện giọng nói' : 'Voice Typing'}
                            >
                                <Mic size={20} />
                            </button>

                            {/* Live Speech Recognition Overlay */}
                            {isRecording && (
                                <div className="absolute inset-y-0.5 left-0.5 right-0.5 bg-white/95 backdrop-blur-sm flex items-center justify-between px-4 z-10 animate-fade-in rounded-[10px] border border-red-100">
                                    <div className="flex items-center gap-3">
                                        <span className="relative flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                        </span>
                                        <span className="text-xs font-bold text-gray-650 animate-pulse">
                                            {lang === 'vi' ? 'Đang lắng nghe giọng nói...' : lang === 'ko' ? '음성을 듣고 있습니다...' : 'Listening to your voice...'}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={toggleRecording}
                                        className="text-xs font-bold text-red-500 hover:text-red-600 px-3 py-1 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100"
                                    >
                                        {lang === 'vi' ? 'Hoàn thành' : lang === 'ko' ? '완료' : 'Done'}
                                    </button>
                                </div>
                            )}

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
                                type="button"
                                onClick={isLoading ? handleStopResponse : () => handleSend()}
                                disabled={!isLoading && !input.trim() && attachedFiles.length === 0}
                                className={`m-1 p-2 rounded-xl transition-all shrink-0 ${
                                    isLoading 
                                        ? 'bg-red-500 hover:bg-red-600 text-white hover:shadow-lg hover:shadow-red-200 animate-pulse' 
                                        : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:shadow-lg hover:shadow-blue-200 disabled:opacity-40 disabled:hover:shadow-none'
                                }`}
                                title={isLoading ? 'Dừng phản hồi' : 'Gửi tin nhắn'}
                            >
                                {isLoading ? <Square size={16} className="fill-white text-white" /> : <Send size={16} />}
                            </button>
                        </div>
                        <p className="text-[9px] text-center text-gray-400 mt-2">
                            Powered by Gemini ({getCurrentModel().replace('gemini-', '')}) · Tải lên tối đa 15MB/file, phân tích qua bộ nhớ RAM
                        </p>
                    </div>
                </div>

                {/* ── Artifact Pane (Desktop side column, Mobile drawer) ── */}
                {activeArtifact && (
                    <>
                        {/* Desktop Side Column */}
                        {!isDesktop && (
                            <div className="hidden lg:flex flex-col w-[45%] lg:max-w-2xl shrink-0 bg-white border border-gray-100 rounded-t-2xl shadow-sm overflow-hidden animate-fade-in-left">
                                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                                            <FileText size={14} className="bg-transparent text-blue-700" />
                                        </div>
                                        <h2 className="font-bold text-gray-800 text-sm truncate" title={activeArtifact.title}>
                                            {activeArtifact.title}
                                        </h2>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={handleCopyArtifact}
                                            className="p-1.5 hover:bg-gray-250 rounded-lg text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1 bg-transparent"
                                            title="Sao chép báo cáo"
                                        >
                                            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                        </button>
                                        <button
                                            onClick={handleDownloadArtifact}
                                            className="p-1.5 hover:bg-gray-250 rounded-lg text-gray-500 hover:text-gray-700 transition-colors bg-transparent"
                                            title="Tải xuống Markdown"
                                        >
                                            <Download size={14} />
                                        </button>
                                        <button
                                            onClick={() => setActiveArtifact(null)}
                                            className="p-1.5 hover:bg-gray-250 rounded-lg text-gray-500 hover:text-gray-700 transition-colors ml-1 bg-transparent"
                                            title="Đóng báo cáo"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 prose prose-sm md:prose-base custom-scrollbar">
                                    {(() => {
                                        const chart = getParsedChart(activeArtifact.content);
                                        if (chart) {
                                            return (
                                                <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-sm max-w-full overflow-hidden">
                                                    <InlineChatChart chart={chart} />
                                                </div>
                                            );
                                        }
                                        return (
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    p: ({ node, ...props }) => <p className="mb-4 leading-relaxed text-gray-700 last:mb-0" {...props} />,
                                                    h3: ({ node, ...props }) => <h3 className="text-base font-bold text-blue-800 mt-4 mb-2" {...props} />,
                                                    ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-4 space-y-1.5" {...props} />,
                                                    ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-4 space-y-1.5" {...props} />,
                                                    li: ({ node, ...props }) => <li className="text-gray-700 leading-relaxed" {...props} />,
                                                    strong: ({ node, ...props }) => <strong className="font-bold text-blue-950" {...props} />,
                                                    table: ({ node, ...props }) => <div className="overflow-x-auto my-4"><table className="w-full border-collapse border border-blue-200 text-sm" {...props} /></div>,
                                                    thead: ({ node, ...props }) => <thead className="bg-blue-50" {...props} />,
                                                    th: ({ node, ...props }) => <th className="border border-blue-200 px-4 py-2 text-left font-semibold text-blue-900" {...props} />,
                                                    td: ({ node, ...props }) => <td className="border border-blue-100 px-4 py-2 text-gray-700" {...props} />,
                                                    tr: ({ node, ...props }) => <tr className="even:bg-gray-50/50" {...props} />
                                                }}
                                            >
                                                {activeArtifact.content}
                                            </ReactMarkdown>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}

                        {/* Mobile Slide-up Fullscreen Drawer */}
                        <div className="lg:hidden fixed inset-0 z-[100] flex flex-col bg-white animate-fade-in-up">
                            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                                        <FileText size={14} className="bg-transparent text-blue-700" />
                                    </div>
                                    <h2 className="font-bold text-gray-800 text-sm truncate" title={activeArtifact.title}>
                                        {activeArtifact.title}
                                    </h2>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={handleCopyArtifact}
                                        className="p-2 hover:bg-gray-250 rounded-lg text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1 bg-transparent"
                                    >
                                        {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                                    </button>
                                    <button
                                        onClick={handleDownloadArtifact}
                                        className="p-2 hover:bg-gray-250 rounded-lg text-gray-500 hover:text-gray-700 transition-colors bg-transparent"
                                    >
                                        <Download size={16} />
                                    </button>
                                    <button
                                        onClick={() => setActiveArtifact(null)}
                                        className="p-2 hover:bg-gray-250 rounded-lg text-gray-500 hover:text-gray-700 transition-colors bg-transparent"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5 prose prose-sm md:prose-base custom-scrollbar pb-10">
                                {(() => {
                                    const chart = getParsedChart(activeArtifact.content);
                                    if (chart) {
                                        return (
                                            <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-sm max-w-full overflow-hidden">
                                                <InlineChatChart chart={chart} />
                                            </div>
                                        );
                                    }
                                    return (
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                p: ({ node, ...props }) => <p className="mb-4 leading-relaxed text-gray-700 last:mb-0" {...props} />,
                                                h3: ({ node, ...props }) => <h3 className="text-base font-bold text-blue-800 mt-4 mb-2" {...props} />,
                                                ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-4 space-y-1.5" {...props} />,
                                                ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-4 space-y-1.5" {...props} />,
                                                li: ({ node, ...props }) => <li className="text-gray-700 leading-relaxed" {...props} />,
                                                strong: ({ node, ...props }) => <strong className="font-bold text-blue-950" {...props} />,
                                                table: ({ node, ...props }) => <div className="overflow-x-auto my-4"><table className="w-full border-collapse border border-blue-200 text-sm" {...props} /></div>,
                                                thead: ({ node, ...props }) => <thead className="bg-blue-50" {...props} />,
                                                th: ({ node, ...props }) => <th className="border border-blue-200 px-4 py-2 text-left font-semibold text-blue-900" {...props} />,
                                                td: ({ node, ...props }) => <td className="border border-blue-100 px-4 py-2 text-gray-700" {...props} />,
                                                tr: ({ node, ...props }) => <tr className="even:bg-gray-50/50" {...props} />
                                            }}
                                        >
                                            {activeArtifact.content}
                                        </ReactMarkdown>
                                    );
                                })()}
                            </div>
                        </div>
                    </>
                )}
            </div>
            <ConfirmModal
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(p => ({ ...p, isOpen: false }))}
            />
            <AIBoostModal
                isOpen={showBoostModal}
                onClose={() => setShowBoostModal(false)}
                onSelectPack={(packType) => {
                    setShowBoostModal(false);
                    if (onSelectBoostPack) {
                        onSelectBoostPack(packType);
                    } else {
                        alert('Chức năng mua gói bổ sung chưa sẵn sàng. Vui lòng liên hệ Admin.');
                    }
                }}
            />
        </div>
    );
};

export default AIAdvisorPage;
