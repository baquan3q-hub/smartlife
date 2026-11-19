// File: src/components/AIAdvisorPage.tsx
// Trang AI đồng hành: giữ state + điều phối. Giao diện tin nhắn nằm trong src/components/ai/*
// — stream chữ, khung suy nghĩ, thao tác tin nhắn (sửa, quay lại, tạo lại, xoá, 👍/👎), chọn tốc độ.

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import {
    ArrowLeft, Sparkles, Loader2, RefreshCw,
    TrendingDown, Target, ListChecks, BarChart3, Wallet,
    PiggyBank, CalendarCheck, Brain, Lightbulb, ChevronRight, ChevronDown, ChevronUp,
    History, X, Plus, Trash2, GraduationCap,
    Heart, Pin, LayoutGrid, Zap
} from 'lucide-react';
import { GlassIcon } from './icons/GlassIcon';

import { AppState, TransactionType } from '../types';
import { callRouterModel, generateQuickInsight } from '../services/geminiService';
import {
    chatWithAI,
    type ActionHandlers, type ActionResult, type AIAttachment, type AIRunMeta, type AIStep, type AIStreamEvent, type ChartData,
} from '../services/aiEngine';
import { chatHistoryService, type AIConversation, type AIMessageMeta } from '../services/chatHistoryService';
import { memoryService } from '../services/memoryService';
import { aiQuotaService, type UserQuotaStatus } from '../services/aiQuotaService';
import {
    cutoffFrom, editableText, fromStoredMessages, newMessageId, parseArtifact, performedActions,
    regenerateFrom, revertTo, toGeminiHistory, type UIMessage,
} from '../services/ai/messages';
import AIBoostModal from './AIBoostModal';
import ConfirmModal from './ConfirmModal';
import { FinancialImpactDetailsModal } from './ai/FinancialImpact';
import MessageBubble from './ai/MessageBubble';
import MessageList from './ai/MessageList';
import Composer from './ai/Composer';
import ArtifactPane, { type Artifact } from './ai/ArtifactPane';
import { loadSpeed, saveSpeed, SPEED_OPTIONS, type SpeedChoice } from './ai/tiers';
import { getExpert, isExpertId, type ExpertId } from '../services/ai/experts';
import { routeTurn } from '../services/ai/router';
import { countClarifyRounds, lastAskedConfirm, type ClarifyRequest } from '../services/ai/clarify';
import type { WebSource } from '../services/ai/webSearch';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
    onAddTodo?: (content: string, priority: string, deadline?: string, status?: any, description?: string) => Promise<void>;
    onAddTransaction?: (tx: any) => Promise<void>;
    onImportGPAData?: (semesters: any[]) => Promise<void>;
    onSelectBoostPack?: (packType: 'boost_s' | 'boost_m' | 'boost_l') => void;
    onUpdateTodo?: (item: any) => Promise<void>;
    onDeleteTodo?: (id: string) => Promise<void>;
    onAddCalendarEvent?: (event: any) => Promise<void>;
    onUpdateCalendarEvent?: (event: any) => Promise<void>;
    onDeleteCalendarEvent?: (id: string) => Promise<void>;
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
        icon: <Zap size={16} />,
        label: 'Nếu phát sinh tiền bất ngờ ?',
        prompt: 'Tôi sắp có một khoản chi tiêu phát sinh đột xuất: đi đám cưới bạn thân hết 1 triệu đồng. Việc này có tác động như thế nào đến tổng số dư ví, ngân sách tháng này và tiến độ đạt các mục tiêu tiết kiệm của tôi? Hãy mô phỏng chi tiết và đề xuất giải pháp cho tôi nhé.',
        gradient: 'from-amber-500 to-rose-500',
    },
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
// Tin nhắn & tệp đính kèm
// ────────────────────────────────────────
const WELCOME_TEXT = '👋 Chào bạn! Mình là **SmartLife Advisor v2** — trợ lý AI thông minh.\n\n🆕 **Khả năng mới:**\n- 📊 **Truy vấn dữ liệu** trực tiếp từ database\n- 📈 **Bảng tính (table) & Dự đoán** chi tiêu\n- ✏️ **Thêm lịch trình, việc cần làm, giao dịch** bằng ngôn ngữ tự nhiên\n- 📎 **Phân tích tài liệu & hình ảnh**: Đọc hiểu ảnh thời khóa biểu, hóa đơn, file excel, csv, pdf, txt, hoặc âm thanh trực tiếp trong bộ nhớ tạm để xử lý nhanh chóng.\n\n💡 **Thử hỏi mình:**\n- _"Đưa ra dự đoán chi tiêu tháng tới cho tôi"_\n- _"Lập bảng so sánh thu chi 3 tháng gần nhất"_\n- _"Thêm lịch học IELTS thứ 3, thứ 5 lúc 19h"_\n\nHoặc chọn gợi ý bên dưới! 👇';
const RESET_TEXT = '🔄 Cuộc trò chuyện đã được làm mới! Mình sẵn sàng phân tích dữ liệu cho bạn. 🌱';
const EMPTY_TEXT = 'Cuộc trò chuyện này trống. Hãy bắt đầu hỏi gì đó!';
const FILES_ONLY_PROMPT = 'Hãy phân tích dữ liệu từ các tệp tôi đã tải lên.';

type FileMeta = { name: string; type: string; size: number };

const localNotice = (content: string): UIMessage => ({ id: newMessageId(), role: 'assistant', content, local: true });

// Excel / tệp chữ → đọc thành văn bản gửi kèm câu hỏi; ảnh, PDF, âm thanh → base64 cho Gemini đọc trực tiếp
async function readAttachedFiles(files: File[]): Promise<{ fileContext: string; attachments: AIAttachment[] }> {
    const attachments: AIAttachment[] = [];
    let fileContext = '';
    for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (ext === 'xlsx' || ext === 'xls') {
            try {
                const excelText = await parseExcelToCSV(file);
                fileContext += `\n\n--- DỮ LIỆU ĐÍNH KÈM TỪ EXCEL (${file.name}) ---\n${excelText}\n--- HẾT DỮ LIỆU EXCEL ---`;
            } catch (err: any) {
                console.error('Error parsing excel:', err);
                fileContext += `\n\n[Lỗi đọc file Excel ${file.name}: ${err.message}]`;
            }
        } else if (['txt', 'csv', 'md', 'json', 'xml'].includes(ext)) {
            try {
                const text = await readTextFile(file);
                fileContext += `\n\n--- NỘI DUNG TỆP ${file.name} ---\n${text}\n--- HẾT NỘI DUNG TỆP ---`;
            } catch (err: any) {
                console.error('Error reading text file:', err);
                fileContext += `\n\n[Lỗi đọc file văn bản ${file.name}: ${err.message}]`;
            }
        } else {
            try {
                attachments.push({ mimeType: file.type || getMimeTypeFromExtension(ext), data: await fileToBase64(file) });
            } catch (err: any) {
                console.error('Error converting file to base64:', err);
                alert(`Không thể đọc file ${file.name}: ${err.message}`);
            }
        }
    }
    return { fileContext, attachments };
}

const actionWarning = (actions: ActionResult[]) =>
    actions.length
        ? `\n\nLưu ý: ${actions.length} việc AI đã làm trong các tin này (thêm việc, ghi giao dịch, thêm lịch…) sẽ KHÔNG tự hoàn tác — hãy xoá thủ công nếu cần.`
        : '';

// Hàm ổn định (không đổi giữa các lần render) nhưng luôn gọi phiên bản mới nhất — để MessageBubble memo hiệu quả
function useStableCallback<T extends (...args: any[]) => any>(fn: T): T {
    const ref = useRef(fn);
    useLayoutEffect(() => { ref.current = fn; });
    return useCallback(((...args: any[]) => ref.current(...args)) as T, []);
}

// ────────────────────────────────────────
// Component
// ────────────────────────────────────────
const AIAdvisorPage: React.FC<AIAdvisorPageProps> = ({
    appState, lang, onBack,
    onAddTimetable, onAddTodo, onAddTransaction, onImportGPAData,
    onSelectBoostPack, onUpdateTodo, onDeleteTodo,
    onAddCalendarEvent, onUpdateCalendarEvent, onDeleteCalendarEvent
}) => {
    const [messages, setMessages] = useState<UIMessage[]>(() => [localNotice(WELCOME_TEXT)]);
    const messagesRef = useRef(messages);
    messagesRef.current = messages;

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingConversation, setIsLoadingConversation] = useState(false);
    const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
    const [speed, setSpeed] = useState<SpeedChoice>(loadSpeed);
    // Chế độ chuyên gia của cuộc trò chuyện đang mở (lưu ở ai_conversations.expert_mode)
    const [expert, setExpert] = useState<ExpertId>('general');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [pinSignal, setPinSignal] = useState(0);
    const abortControllerRef = useRef<AbortController | null>(null);
    // Thao tác DB đang chờ (xoá mềm khi quay lại / tạo lại) — tin mới phải lưu SAU khi xong để không bị xoá nhầm
    const pendingDbRef = useRef<Promise<unknown>>(Promise.resolve());
    // Tăng mỗi lần đổi / làm mới cuộc trò chuyện — để lượt chạy cũ không ghi đè cuộc trò chuyện mới
    const sessionRef = useRef(0);

    const [isSimPopupOpen, setIsSimPopupOpen] = useState(false);
    const [simDescription, setSimDescription] = useState('');
    const [simAmount, setSimAmount] = useState('');
    const [selectedImpactDetails, setSelectedImpactDetails] = useState<any>(null);

    const handleSpeedChange = (next: SpeedChoice) => {
        setSpeed(next);
        saveSpeed(next);
    };

    const handleExpertChange = (next: ExpertId) => {
        if (next === expert) return;
        setExpert(next);
        const convId = conversationIdRef.current;
        if (!convId) return;
        chatHistoryService.updateConversationExpert(convId, next).catch(console.error);
        setConversations(prev => prev.map(c => (c.id === convId ? { ...c, expert_mode: next === 'general' ? null : next } : c)));
    };

    // Dừng: chỉ huỷ request — lượt chạy tự giữ phần chữ đã nhận, gắn nhãn "Đã dừng" và lưu lại
    const handleStopResponse = () => {
        abortControllerRef.current?.abort();
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

    const [quickInsight, setQuickInsight] = useState<string | null>(null);
    const [isLoadingInsight, setIsLoadingInsight] = useState(false);

    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

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
    const conversationIdRef = useRef<string | null>(null);
    const setConvId = (id: string | null) => {
        conversationIdRef.current = id;
        setConversationId(id);
    };
    const [memoryContext, setMemoryContext] = useState<string>('');
    const [conversations, setConversations] = useState<AIConversation[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean; title: string; message: string; confirmText?: string; onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const [showPopupHint, setShowPopupHint] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Action handlers for aiEngine
    const actionHandlers: ActionHandlers = {
        onAddTimetable,
        onAddTodo,
        onAddTransaction,
        onImportGPAData,
        onUpdateTodo,
        onDeleteTodo,
        onAddCalendarEvent,
        onUpdateCalendarEvent,
        onDeleteCalendarEvent,
    };

    useEffect(() => {
        inputRef.current?.focus();

        // Show hint popup for 8 seconds on mount
        setShowPopupHint(true);
        const timer = setTimeout(() => setShowPopupHint(false), 8000);
        return () => {
            clearTimeout(timer);
            abortControllerRef.current?.abort();
        };
    }, []);

    useEffect(() => {
        const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
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

    // Load memory context on mount
    useEffect(() => {
        memoryService.getMemoryContextString()
            .then(setMemoryContext)
            .catch(console.error);
    }, []);

    // Click outside widget menu
    useEffect(() => {
        if (!showWidgetMenu) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (widgetMenuRef.current && !widgetMenuRef.current.contains(event.target as Node)) setShowWidgetMenu(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showWidgetMenu]);

    // ────────────────────────────────────────
    // Lưu trữ
    // ────────────────────────────────────────
    const patchMessage = (id: string, patch: Partial<UIMessage>) => {
        setMessages(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)));
    };

    const ensureConversation = async (title: string): Promise<string | null> => {
        if (conversationIdRef.current) return conversationIdRef.current;
        const session = sessionRef.current;
        const conv = await chatHistoryService.createConversation(title.length > 50 ? title.substring(0, 50) + '...' : title, expert);
        if (!conv) return null;
        if (sessionRef.current === session) setConvId(conv.id);
        return conv.id;
    };

    const persistUserMessage = async (message: UIMessage, title: string): Promise<string | null> => {
        const convId = await ensureConversation(title);
        if (!convId) return null;
        const saved = await chatHistoryService.saveMessage(convId, 'user', message.content, { meta: message.meta });
        if (saved) patchMessage(message.id, { dbId: saved.id, createdAt: saved.created_at });
        return convId;
    };

    // Xoá mềm trong DB mọi tin từ vị trí index trở đi (theo created_at)
    const softDeleteFromIndex = (list: UIMessage[], index: number) => {
        const cutoff = cutoffFrom(list, index);
        const convId = conversationIdRef.current;
        if (!cutoff || !convId) return;
        pendingDbRef.current = pendingDbRef.current.then(() => chatHistoryService.softDeleteFrom(convId, cutoff));
    };

    const maybeExtractMemories = (list: UIMessage[]) => {
        const real = list.filter(m => !m.local && m.content.trim());
        if (real.length < 4 || real.length % 4 !== 0) return;
        const chatText = real.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n');
        memoryService.extractMemoriesFromConversation(chatText).catch(console.error);
    };

    // ────────────────────────────────────────
    // Một lượt trả lời của AI (stream)
    // base: danh sách tin tới câu hỏi cần trả lời; conversationReady: id cuộc trò chuyện khi tin người dùng đã lưu xong
    // ────────────────────────────────────────
    const runAssistant = async (base: UIMessage[], attachments: AIAttachment[], conversationReady: Promise<string | null>) => {
        const controller = new AbortController();
        abortControllerRef.current = controller;
        const replyId = newMessageId();
        const startedAt = Date.now();

        setMessages([...base, { id: replyId, role: 'assistant', content: '', status: 'streaming', startedAt }]);
        setIsLoading(true);
        setPinSignal(s => s + 1);

        // Gom sự kiện, mỗi khung hình vẽ lại một lần
        const live = {
            text: '',
            thoughts: '',
            steps: [] as AIStep[],
            charts: [] as ChartData[],
            actions: [] as ActionResult[],
            run: {} as AIRunMeta,
            clarification: undefined as ClarifyRequest | undefined,
            sources: [] as WebSource[],
        };
        const liveMeta = (): AIMessageMeta => ({
            ...live.run,
            thoughts: live.thoughts || undefined,
            steps: live.steps.length ? [...live.steps] : undefined,
            clarification: live.clarification,
            sources: live.sources.length ? [...live.sources] : undefined,
        });
        let frame = 0;
        const flush = () => {
            frame = 0;
            setMessages(prev => prev.map(m => (m.id === replyId ? {
                ...m,
                content: live.text,
                charts: live.charts.length ? [...live.charts] : undefined,
                actions: live.actions.length ? [...live.actions] : undefined,
                meta: liveMeta(),
            } : m)));
        };
        const onEvent = (event: AIStreamEvent) => {
            switch (event.type) {
                case 'meta':
                    live.run = { ...live.run, model: event.meta.model, tier: event.meta.tier, weight: event.meta.weight };
                    break;
                case 'text': live.text += event.delta; break;
                case 'thought': live.thoughts += event.delta; break;
                case 'step': {
                    const i = live.steps.findIndex(s => s.id === event.step.id);
                    if (i === -1) live.steps.push({ ...event.step });
                    else live.steps[i] = { ...event.step };
                    break;
                }
                case 'chart': live.charts.push(event.chart); break;
                case 'action': live.actions.push(event.action); break;
                case 'clarify': live.clarification = event.request; break;
                case 'sources': live.sources = event.sources; break;
            }
            if (!frame) frame = requestAnimationFrame(flush);
        };

        try {
            let final: UIMessage;
            try {
                // Câu hỏi cần trả lời = tin người dùng cuối cùng; Auto chọn tầng + đoán lĩnh vực / dấu hiệu khủng hoảng
                const question = [...base].reverse().find(m => m.role === 'user' && !m.local);
                const userText = question ? editableText(question) : '';
                const route = await routeTurn(
                    { text: userText, hasAttachments: attachments.length > 0, expert },
                    speed,
                    prompt => callRouterModel(prompt, controller.signal),
                );
                if (controller.signal.aborted) throw new DOMException('Đã dừng', 'AbortError');
                live.run = { ...live.run, tier: route.tier, auto: route.auto || undefined, expert, domain: route.domain };
                const response = await chatWithAI(
                    toGeminiHistory(base), appState, actionHandlers, memoryContext, attachments, controller.signal,
                    {
                        tier: route.tier,
                        onEvent,
                        expert,
                        auto: route.auto,
                        domain: route.domain,
                        crisis: route.crisis,
                        userText,
                        clarifyRoundsUsed: countClarifyRounds(base),
                        confirmedBulk: lastAskedConfirm(base),
                    }
                );
                final = {
                    id: replyId,
                    role: 'assistant',
                    content: response.text,
                    status: 'done',
                    startedAt,
                    charts: response.charts.length ? response.charts : undefined,
                    actions: response.actions.length ? response.actions : undefined,
                    meta: { ...response.meta, tokens_used: response.tokens_used || undefined },
                };
                const artifact = parseArtifact(response.text);
                if (artifact) setActiveArtifact({ title: artifact.title, content: artifact.artifactContent });
            } catch (error: any) {
                const aborted = error?.name === 'AbortError';
                if (!aborted) console.error(error);
                final = {
                    id: replyId,
                    role: 'assistant',
                    content: live.text,
                    status: aborted ? 'stopped' : 'error',
                    startedAt,
                    charts: live.charts.length ? live.charts : undefined,
                    actions: live.actions.length ? live.actions : undefined,
                    meta: {
                        ...liveMeta(),
                        durationMs: Date.now() - startedAt,
                        ...(aborted ? { stopped: true } : { error: error?.message || String(error) }),
                    },
                };
            }
            if (frame) cancelAnimationFrame(frame);
            frame = 0;
            setMessages(prev => prev.map(m => (m.id === replyId ? final : m)));

            // Lưu: câu trả lời đầy đủ, hoặc phần dở dang khi dừng / lỗi nếu đã có nội dung hay đã làm thao tác
            const convId = await conversationReady;
            const hasContent = !!final.content.trim() || !!final.charts || !!final.actions;
            if (convId && (final.status === 'done' || hasContent)) {
                const saved = await chatHistoryService.saveMessage(convId, 'assistant', final.content, {
                    charts: final.charts,
                    actions: final.actions,
                    meta: final.meta,
                });
                if (saved) patchMessage(replyId, { dbId: saved.id, createdAt: saved.created_at });
            }
            if (final.status === 'done') maybeExtractMemories([...base, final]);
        } catch (error) {
            console.error('[AIAdvisor] runAssistant:', error);
        } finally {
            if (frame) cancelAnimationFrame(frame);
            if (abortControllerRef.current === controller) abortControllerRef.current = null;
            setIsLoading(false);
            refreshQuota();
        }
    };

    // Thêm tin người dùng vào sau base rồi để AI trả lời
    const sendTurn = (
        base: UIMessage[],
        text: string,
        extras: { fileContext?: string; attachments?: AIAttachment[]; files?: FileMeta[] } = {}
    ) => {
        const files = extras.files?.length ? extras.files : undefined;
        const content = files
            ? `${text}\n\n${files.map(f => `📎 **${f.name}** (${(f.size / 1024).toFixed(1)} KB)`).join('\n')}`
            : text;
        const userMessage: UIMessage = {
            id: newMessageId(),
            role: 'user',
            content,
            status: 'done',
            fileContext: extras.fileContext || undefined,
            attachments: extras.attachments?.length ? extras.attachments : undefined,
            meta: files ? { files } : undefined,
        };
        const conversationReady = pendingDbRef.current
            .catch(() => undefined)
            .then(() => persistUserMessage(userMessage, text));
        return runAssistant([...base, userMessage], userMessage.attachments || [], conversationReady);
    };

    const handleSend = async (overrideMessage?: string) => {
        const msg = (overrideMessage ?? input).trim();
        if ((!msg && attachedFiles.length === 0) || isLoading) return;

        const files = attachedFiles;
        setInput('');
        setAttachedFiles([]);
        setEditingId(null);
        setIsLoading(true);

        const { fileContext, attachments } = await readAttachedFiles(files);
        await sendTurn(messagesRef.current, msg || FILES_ONLY_PROMPT, {
            fileContext,
            attachments,
            files: files.map(f => ({ name: f.name, type: f.type, size: f.size })),
        });
    };

    // ────────────────────────────────────────
    // Thao tác trên tin nhắn
    // ────────────────────────────────────────
    const handleStartEdit = useStableCallback((message: UIMessage) => {
        if (!isLoading) setEditingId(message.id);
    });
    const handleCancelEdit = useStableCallback(() => setEditingId(null));

    // Trả lời thẻ hỏi lại (ask_user): gửi thành tin nhắn tiếp theo của người dùng
    const handleAnswerClarify = useStableCallback((text: string) => {
        // Gửi thẳng, không đụng tới ô soạn / tệp người dùng đang chuẩn bị
        if (!isLoading) sendTurn(messagesRef.current, text);
    });

    // Sửa & gửi lại: bỏ tin này cùng mọi tin sau, gửi nội dung mới (giữ tệp đính kèm nếu còn trong phiên)
    const handleSubmitEdit = useStableCallback((target: UIMessage, text: string) => {
        if (isLoading) return;
        const list = messagesRef.current;
        const cut = revertTo(list, target.id);
        if (!cut) return;
        setEditingId(null);
        softDeleteFromIndex(list, cut.kept.length);
        const keepFiles = !!(target.attachments || target.fileContext);
        sendTurn(cut.kept, text, {
            fileContext: target.fileContext,
            attachments: target.attachments,
            files: keepFiles ? target.meta?.files : undefined,
        });
    });

    // Quay lại đây: bỏ tin này cùng mọi tin sau, đưa nội dung lên ô soạn để nhắn lại
    const handleRevert = useStableCallback((target: UIMessage) => {
        if (isLoading) return;
        const list = messagesRef.current;
        const cut = revertTo(list, target.id);
        if (!cut) return;
        const later = cut.removed.length - 1;
        const filesNote = target.meta?.files?.length ? '\n\nTệp đính kèm của tin này cần chọn lại trước khi gửi.' : '';
        setConfirmDialog({
            isOpen: true,
            title: 'Quay lại tin nhắn này?',
            message: `Tin này${later > 0 ? ` và ${later} tin sau nó` : ''} sẽ được gỡ khỏi cuộc trò chuyện — AI cũng sẽ quên phần đó. Nội dung tin được đưa lại vào ô soạn để bạn sửa và gửi lại.`
                + filesNote + actionWarning(performedActions(cut.removed)),
            confirmText: 'Quay lại',
            onConfirm: () => {
                softDeleteFromIndex(list, cut.kept.length);
                setMessages(cut.kept.length ? cut.kept : [localNotice(WELCOME_TEXT)]);
                setEditingId(null);
                setInput(editableText(target));
                setTimeout(() => inputRef.current?.focus(), 0);
            },
        });
    });

    // Tạo lại: bỏ câu trả lời này (và mọi tin sau), AI trả lời lại câu hỏi trước đó
    const handleRegenerate = useStableCallback((target: UIMessage) => {
        if (isLoading) return;
        const list = messagesRef.current;
        const cut = regenerateFrom(list, target.id);
        if (!cut) return;
        const run = () => {
            softDeleteFromIndex(list, cut.kept.length);
            const ready = pendingDbRef.current.catch(() => undefined).then(() => conversationIdRef.current);
            runAssistant(cut.kept, cut.question.attachments || [], ready);
        };
        const done = performedActions(cut.removed);
        const later = cut.removed.length - 1;
        if (!done.length && later <= 0) {
            run();
            return;
        }
        setConfirmDialog({
            isOpen: true,
            title: 'Tạo lại câu trả lời?',
            message: `Câu trả lời này${later > 0 ? ` và ${later} tin sau nó` : ''} sẽ được thay bằng câu trả lời mới.` + actionWarning(done),
            confirmText: 'Tạo lại',
            onConfirm: run,
        });
    });

    const handleDeleteMessage = useStableCallback((target: UIMessage) => {
        if (isLoading) return;
        setConfirmDialog({
            isOpen: true,
            title: 'Xoá tin nhắn?',
            message: 'Tin nhắn sẽ được gỡ khỏi cuộc trò chuyện và AI không dùng nó làm ngữ cảnh nữa.' + actionWarning(performedActions([target])),
            confirmText: 'Xoá',
            onConfirm: () => {
                const dbId = target.dbId;
                if (dbId) pendingDbRef.current = pendingDbRef.current.then(() => chatHistoryService.softDeleteMessage(dbId));
                setMessages(prev => {
                    const next = prev.filter(m => m.id !== target.id);
                    return next.length ? next : [localNotice(WELCOME_TEXT)];
                });
                if (editingId === target.id) setEditingId(null);
            },
        });
    });

    const handleFeedback = useStableCallback((target: UIMessage, value: 'up' | 'down') => {
        const current = messagesRef.current.find(m => m.id === target.id) || target;
        const meta: AIMessageMeta = { ...current.meta, feedback: current.meta?.feedback === value ? undefined : value };
        patchMessage(target.id, { meta });
        if (current.dbId) chatHistoryService.updateMessageMeta(current.dbId, meta);
    });

    const handleOpenArtifact = useStableCallback((artifact: Artifact) => setActiveArtifact(artifact));
    const handleOpenImpactDetails = useStableCallback((data: any) => setSelectedImpactDetails(data));

    // ────────────────────────────────────────
    // Cuộc trò chuyện
    // ────────────────────────────────────────
    const leaveCurrentConversation = () => {
        sessionRef.current += 1;
        abortControllerRef.current?.abort();
        setActiveArtifact(null);
        setEditingId(null);
    };

    const handleReset = () => {
        leaveCurrentConversation();
        setConvId(null);
        setMessages([localNotice(RESET_TEXT)]);
        setShowHistory(false);
    };

    const loadConversation = async (convId: string) => {
        leaveCurrentConversation();
        setIsLoadingConversation(true);
        try {
            const conv = conversations.find(c => c.id === convId);
            setExpert(isExpertId(conv?.expert_mode) ? conv!.expert_mode as ExpertId : 'general');
            const rows = await chatHistoryService.getMessages(convId);
            const ui = fromStoredMessages(rows);
            setMessages(ui.length > 0 ? ui : [localNotice(EMPTY_TEXT)]);
            setConvId(convId);
            setShowHistory(false);
            setPinSignal(s => s + 1);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingConversation(false);
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
                    if (conversationIdRef.current === convId) {
                        handleReset();
                    }
                }
            }
        });
    };

    const showSuggestions = messages.every(m => m.local) && !isLoading && !isLoadingConversation;
    const lastRun = [...messages].reverse().find(m => m.meta?.model)?.meta;
    const modelLabel = lastRun?.model ? lastRun.model.replace(/^gemini-/, '') : null;

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
                            <div className="w-9 h-9 flex items-center justify-center">
                                <GlassIcon name="ai" size={34} eager />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-800 text-sm leading-tight">SmartLife AI Advisor</h1>
                                <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                    </span>
                                    {getExpert(expert).name} · {SPEED_OPTIONS.find(o => o.id === speed)?.label}{modelLabel ? ` · ${modelLabel}` : ''}
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
                    <MessageList pinSignal={pinSignal}>
                        {isLoadingConversation ? (
                            <div className="flex items-center justify-center gap-2 py-10 text-xs text-gray-400">
                                <Loader2 size={14} className="animate-spin" /> Đang tải cuộc trò chuyện...
                            </div>
                        ) : (() => {
                            let seenUser = false;
                            const lastId = messages[messages.length - 1]?.id;
                            return messages.map(m => {
                                if (m.role === 'user' && !m.local) seenUser = true;
                                return (
                                    <MessageBubble
                                        key={m.id}
                                        message={m}
                                        appState={appState}
                                        busy={isLoading}
                                        isEditing={editingId === m.id}
                                        canRegenerate={m.role === 'assistant' && !m.local && seenUser}
                                        onAddTransaction={onAddTransaction}
                                        onOpenImpactDetails={handleOpenImpactDetails}
                                        onOpenArtifact={handleOpenArtifact}
                                        onStartEdit={handleStartEdit}
                                        onCancelEdit={handleCancelEdit}
                                        onSubmitEdit={handleSubmitEdit}
                                        onRevert={handleRevert}
                                        onRegenerate={handleRegenerate}
                                        onDelete={handleDeleteMessage}
                                        onFeedback={handleFeedback}
                                        isLast={m.id === lastId}
                                        onAnswerClarify={handleAnswerClarify}
                                    />
                                );
                            });
                        })()}

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
                                            onClick={() => {
                                                if (s.label.includes('Nếu phát sinh')) {
                                                    setIsSimPopupOpen(true);
                                                } else {
                                                    handleSend(s.prompt);
                                                }
                                            }}
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
                    </MessageList>

                    <Composer
                        lang={lang}
                        input={input}
                        setInput={setInput}
                        attachedFiles={attachedFiles}
                        setAttachedFiles={setAttachedFiles}
                        isLoading={isLoading}
                        speed={speed}
                        onSpeedChange={handleSpeedChange}
                        expert={expert}
                        onExpertChange={handleExpertChange}
                        onSend={() => handleSend()}
                        onStop={handleStopResponse}
                        inputRef={inputRef}
                    />
                </div>

                {/* ── Artifact Pane (Desktop side column, Mobile drawer) ── */}
                {activeArtifact && (
                    <ArtifactPane artifact={activeArtifact} isDesktop={isDesktop} onClose={() => setActiveArtifact(null)} />
                )}
            </div>
            <ConfirmModal
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmText={confirmDialog.confirmText}
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

            {isSimPopupOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-250">
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
                                <h2 className="text-sm font-black text-slate-800 dark:text-white">
                                    Mô phỏng tác động phát sinh 💸
                                </h2>
                            </div>
                            <button
                                onClick={() => setIsSimPopupOpen(false)}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-650 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-4">
                            {/* Preset select */}
                            <div>
                                <span className="block text-[9px] font-black text-gray-400 uppercase tracking-wider mb-2">Kịch bản gợi ý nhanh</span>
                                <div className="flex gap-1.5 flex-wrap">
                                    {[
                                        { label: '👮 CSGT phạt', amount: 2000000, desc: 'Bị CSGT xử phạt hành chính' },
                                        { label: '💒 Đi đám cưới', amount: 1000000, desc: 'Đi ăn cưới bạn thân' },
                                        { label: '💻 Mua Laptop', amount: 15000000, desc: 'Đầu tư laptop phục vụ học tập/làm việc' },
                                        { label: '🍕 Liên hoan nhóm', amount: 500000, desc: 'Chi tiền liên hoan nhóm cuối tuần' },
                                        { label: '📱 Đổi điện thoại', amount: 8000000, desc: 'Mua điện thoại mới phát sinh' },
                                    ].map((preset, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                                setSimDescription(preset.desc);
                                                setSimAmount(String(preset.amount));
                                            }}
                                            className="px-2 py-1.5 rounded-xl border border-gray-200 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-650 hover:border-indigo-200 text-[10.5px] font-semibold text-gray-650 transition-all duration-150"
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Custom Form */}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                                        Tình huống phát sinh
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={simDescription}
                                        onChange={(e) => setSimDescription(e.target.value)}
                                        placeholder="Ví dụ: Đi đám cưới bạn thân, Sửa xe máy bị hỏng..."
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-slate-50 text-xs font-bold text-gray-855 outline-none focus:border-indigo-450 focus:bg-white transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                                        Số tiền phát sinh (VND)
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        value={simAmount}
                                        onChange={(e) => setSimAmount(e.target.value)}
                                        placeholder="Ví dụ: 1000000"
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-slate-50 text-xs font-bold text-gray-855 outline-none focus:border-indigo-455 focus:bg-white transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                            <button
                                onClick={() => setIsSimPopupOpen(false)}
                                className="px-4 py-2 hover:bg-gray-200 text-gray-500 rounded-xl text-xs font-bold transition-colors"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                onClick={() => {
                                    if (!simDescription.trim() || !simAmount) {
                                        alert('Vui lòng điền đầy đủ thông tin.');
                                        return;
                                    }
                                    const amountVal = Number(simAmount);
                                    if (isNaN(amountVal) || amountVal <= 0) {
                                        alert('Số tiền không hợp lệ.');
                                        return;
                                    }
                                    setIsSimPopupOpen(false);

                                    // Send the prompt to AI
                                    const finalPrompt = `Tôi gặp tình huống phát sinh đột xuất: "${simDescription.trim()}" với số tiền là ${amountVal.toLocaleString('vi-VN')}đ. Hãy mô phỏng tác động tài chính của việc này lên số dư, các ví và mục tiêu tiết kiệm của tôi, đồng thời đề xuất giải pháp hành động tiếp theo nhé.`;
                                    handleSend(finalPrompt);

                                    // Clear fields
                                    setSimDescription('');
                                    setSimAmount('');
                                }}
                                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-200/50 transition-all flex items-center gap-1.5"
                            >
                                <Sparkles size={12} />
                                Gửi AI đánh giá
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedImpactDetails && (
                <FinancialImpactDetailsModal
                    isOpen={!!selectedImpactDetails}
                    onClose={() => setSelectedImpactDetails(null)}
                    data={selectedImpactDetails}
                    appState={appState}
                    onAddTransaction={onAddTransaction}
                />
            )}
        </div>
    );
};

export default AIAdvisorPage;
