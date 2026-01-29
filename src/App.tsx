// File: src/App.tsx
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, CalendarDays, Wallet, LogOut, Loader2, Settings } from 'lucide-react';

// Import các Components (Đảm bảo bạn đã tạo file trong thư mục components)
import FinanceDashboard from './components/FinanceDashboard';
import ScheduleDashboard from './components/ScheduleDashboard';
import VisualBoard from './components/VisualBoard';
import SettingsModal from './components/SettingsModal';
import Login from './components/Login';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';

// Context và Service
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './services/supabase';
import { requestNotificationPermission, checkAndNotify, checkCalendarAndNotify, checkGoalsAndNotify, checkCustomEventsAndNotify } from './services/notificationService';
import { generateInsights } from './services/smartEngine';
import InsightCard from './components/InsightCard';
import { messaging } from './services/firebase';
import { getToken, onMessage } from "firebase/messaging";

// Types và Constants (Khớp với file đã sửa)
import { AppState, Transaction, TaskPriority, SmartInsight } from './types';
import { INITIAL_BUDGET, INITIAL_GOALS, INITIAL_TRANSACTIONS, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './constants';

const RealtimeClock: React.FC = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (date: Date) => {
        return new Intl.DateTimeFormat('vi-VN', {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(date);
    };

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('vi-VN', {
            weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
        }).format(date);
    };

    return (
        <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100 text-center">
            <div className="text-lg font-bold text-indigo-700 capitalize">
                {formatDate(time)}
            </div>
            <div className="text-base font-medium text-gray-500 font-mono mt-1">
                {formatTime(time)}
            </div>
        </div>
    );
};

interface AuthenticatedAppProps {
    lang: 'vi' | 'en';
    setLang: (lang: 'vi' | 'en') => void;
}

const AuthenticatedApp: React.FC<AuthenticatedAppProps> = ({ lang, setLang }) => {
    const { user, signOut } = useAuth();
    const [activeTab, setActiveTab] = useState<'finance' | 'schedule' | 'visual'>('finance');
    const [isLoadingData, setIsLoadingData] = useState(false);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Notification State
    const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
        return localStorage.getItem('notificationsEnabled') === 'true';
    });

    const toggleNotifications = async () => {
        if (notificationsEnabled) {
            setNotificationsEnabled(false);
            localStorage.setItem('notificationsEnabled', 'false');
        } else {
            const granted = await requestNotificationPermission();
            if (granted) {
                setNotificationsEnabled(true);
                localStorage.setItem('notificationsEnabled', 'true');
            }
        }
    };

    // App State - Khởi tạo dữ liệu mặc định
    const [appState, setAppState] = useState<AppState>({
        transactions: INITIAL_TRANSACTIONS,
        budget: INITIAL_BUDGET,
        budgets: [], // New Budget Configs
        timetable: [], // Khởi tạo rỗng, sẽ fetch từ Supabase
        todos: [],
        goals: INITIAL_GOALS,
        currentBalance: 0,
        profile: null,
        // Optional: Adding calendarEvents to state if needed for global access, 
        // but for now we just need them for notifications. 
        // Let's add a "calendarEvents" field to AppState or just fetch locally for simplicity in a separate effect or combined?
        // Let's add it to state to avoid multiple fetches if CalendarWidget also needs it (Refactor opportunity).
        // For now, let's keep it simple: Add to AppState to be cleaner.
    });

    // Custom Category Management
    const [customExpenseCats, setCustomExpenseCats] = useState<string[]>([]);
    const [customIncomeCats, setCustomIncomeCats] = useState<string[]>([]);

    const allExpenseCategories = [...EXPENSE_CATEGORIES, ...customExpenseCats];
    const allIncomeCategories = [...INCOME_CATEGORIES, ...customIncomeCats];

    // Add separate state for events or extend AppState interface? 
    // Since AppState is in types.ts, let's just use a local state here for notification purposes 
    // OR just fetch in the effect.
    // Smart Insights State 🧠
    const [insights, setInsights] = useState<SmartInsight[]>([]);

    const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

    // Fetch Data từ Supabase khi user đăng nhập
    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            setIsLoadingData(true);
            try {
                // Gọi song song 6 bảng dữ liệu (added calendar_events)
                const [txRes, goalRes, timeRes, todoRes, profileRes, eventsRes, budgetRes] = await Promise.all([
                    supabase.from('transactions').select('*').order('date', { ascending: false }),
                    supabase.from('goals').select('*').order('deadline', { ascending: true }),
                    supabase.from('timetable').select('*').order('start_time', { ascending: true }),
                    supabase.from('todos').select('*').order('created_at', { ascending: false }),
                    supabase.from('profiles').select('*').eq('id', user.id).single(),
                    supabase.from('calendar_events').select('*'), // No date filter = get all for now (simpler)
                    supabase.from('budgets').select('*')
                ]);

                if (txRes.error) throw txRes.error;
                // Profile might be empty if new user, so don't throw error immediately or handle gracefully

                // Cập nhật State
                setAppState((prev: AppState) => ({
                    ...prev,
                    transactions: txRes.data.map(t => ({
                        // Chuyển đổi dữ liệu cho khớp kiểu (đề phòng số lưu dạng chuỗi)
                        id: t.id,
                        user_id: t.user_id,
                        amount: Number(t.amount),
                        category: t.category,
                        date: t.date,
                        type: t.type,
                        description: t.description || '',
                        created_at: t.created_at
                    })),
                    goals: goalRes.data || [],
                    budgets: budgetRes.data || [],
                    timetable: timeRes.data || [],
                    todos: todoRes.data || [],
                    profile: profileRes.data || null
                }));

                // Parse Custom Categories from Profile
                if (profileRes.data?.custom_categories) {
                    const customCats = profileRes.data.custom_categories;
                    if (customCats.expense) setCustomExpenseCats(customCats.expense);
                    if (customCats.income) setCustomIncomeCats(customCats.income);
                } else {
                    // Initialize if empty (migration helper)
                    if (profileRes.data && !profileRes.data.custom_categories) {
                        await supabase.from('profiles').update({
                            custom_categories: { expense: [], income: [] }
                        }).eq('id', user.id);
                    }
                }

                if (eventsRes.data) {
                    setCalendarEvents(eventsRes.data);
                }

            } catch (error) {
                console.error('Lỗi tải dữ liệu:', error);
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchData();


    }, [user]);

    // --- FIREBASE MESSAGING LOGIC ---
    useEffect(() => {
        // Feature detection to prevent crash on unsupported browsers (e.g. some mobile views)
        const isSupported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;

        if (!isSupported) {
            console.log("This browser does not support Notifications or Service Workers.");
            return;
        }

        const requestPermission = async () => {
            try {
                // 1. Xin quyền
                const permission = await Notification.requestPermission();

                if (permission === "granted") {
                    // 2. Đăng ký Service Worker thủ công để đảm bảo nó chạy
                    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
                    console.log("Service Worker đã sẵn sàng:", registration);

                    // 3. Lấy Token và gắn kèm registration vừa tạo
                    const token = await getToken(messaging, {
                        vapidKey: "BNaKU7cMSXUBoTEpfqQ87cwaLYkqZgJZ4nWJQSD10gsl64Qj0XQiKmXbeGz3_PesfzY-pZ4bWalRKuMpGxN7Hi0",
                        serviceWorkerRegistration: registration // Thêm dòng này để fix lỗi timeout
                    });

                    if (token) {
                        console.log("Token của Cun nè:", token);
                    }
                }
            } catch (error) {
                console.error("Lỗi khi lấy token:", error);
            }
        };

        requestPermission();

        // Handle foreground messages safely
        let unsubscribe = () => { };
        try {
            unsubscribe = onMessage(messaging, (payload) => {
                console.log("Nhận tin nhắn khi đang mở app:", payload);
                alert(`Thông báo mới: ${payload.notification?.title}`);
            });
        } catch (err) {
            console.error("Firebase Messaging not supported in this context:", err);
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    // --- NOTIFICATION LOGIC ---
    useEffect(() => {
        if (!notificationsEnabled) return;

        // Run checks every minute
        const interval = setInterval(() => {
            if (appState.timetable.length) checkAndNotify(appState.timetable);
            checkCalendarAndNotify();
            if (appState.goals.length) checkGoalsAndNotify(appState.goals);
            if (calendarEvents.length) checkCustomEventsAndNotify(calendarEvents);
        }, 60000);

        // Initial check on load (after data is ready)
        if (notificationsEnabled && (appState.timetable.length || calendarEvents.length)) {
            checkAndNotify(appState.timetable);
            checkCalendarAndNotify();
            if (appState.goals.length) checkGoalsAndNotify(appState.goals);
            if (calendarEvents.length) checkCustomEventsAndNotify(calendarEvents);
        }

        return () => clearInterval(interval);
        return () => clearInterval(interval);
    }, [appState.timetable, appState.goals, calendarEvents]);

    // Confirm close app
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = ''; // Legacy support
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);



    const handleDismissInsight = (id: string) => {
        setInsights((prev: SmartInsight[]) => prev.filter(i => i.id !== id));
    };

    // --- CÁC HÀM XỬ LÝ (HANDLERS) ---
    const handleAddTransaction = async (newTx: Omit<Transaction, 'id'>) => {
        if (!user) return;
        const tempId = Date.now().toString();
        // Optimistic UI: Hiển thị ngay lập tức trước khi lưu server
        const optimisticTx: Transaction = { ...newTx, id: tempId, user_id: user.id };

        setAppState((prev: AppState) => ({ ...prev, transactions: [optimisticTx, ...prev.transactions] }));

        try {
            const { data, error } = await supabase.from('transactions').insert([{
                user_id: user.id, ...newTx
            }]).select().single();

            if (error) throw error;
            if (data) {
                // Cập nhật lại ID thật từ server
                setAppState((prev: AppState) => ({
                    ...prev,
                    transactions: prev.transactions.map(t => t.id === tempId ? { ...data, amount: Number(data.amount) } : t)
                }));
            }
        } catch (error: any) {
            console.error('Lỗi thêm giao dịch:', error);
            alert(`Lỗi: ${error.message}`);
            // Rollback (hoàn tác) nếu lỗi
            setAppState((prev: AppState) => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== tempId) }));
        }
    };

    const handleUpdateTransaction = async (updatedTx: Transaction) => {
        const previousTransactions = [...appState.transactions];
        setAppState((prev: AppState) => ({ ...prev, transactions: prev.transactions.map(t => t.id === updatedTx.id ? updatedTx : t) }));

        try {
            const { error } = await supabase.from('transactions').update({
                amount: updatedTx.amount, category: updatedTx.category, date: updatedTx.date, type: updatedTx.type, description: updatedTx.description
            }).eq('id', updatedTx.id);
            if (error) throw error;
        } catch (error: any) {
            alert(`Lỗi cập nhật: ${error.message}`);
            setAppState((prev: AppState) => ({ ...prev, transactions: previousTransactions }));
        }
    };

    const handleDeleteTransaction = async (id: string) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa?')) return;
        const previousTransactions = [...appState.transactions];
        setAppState((prev: AppState) => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) }));

        try {
            const { error } = await supabase.from('transactions').delete().eq('id', id);
            if (error) throw error;
        } catch (error) {
            alert('Lỗi xóa giao dịch.');
            setAppState((prev: AppState) => ({ ...prev, transactions: previousTransactions }));
        }
    };

    // --- CATEGORY HANDLER ---
    const handleAddCategory = async (type: 'expense' | 'income', newCategory: string) => {
        if (!user || !newCategory.trim()) return;

        // Anti-duplicate check
        const currentList = type === 'expense' ? allExpenseCategories : allIncomeCategories;
        if (currentList.includes(newCategory)) {
            alert("Danh mục này đã tồn tại!");
            return;
        }

        // Update Local State first
        if (type === 'expense') setCustomExpenseCats(prev => [...prev, newCategory]);
        else setCustomIncomeCats(prev => [...prev, newCategory]);

        // Update Database
        try {
            const currentProfile = appState.profile;
            const existingCustom = currentProfile?.custom_categories || { expense: [], income: [] };

            const updatedCustom = {
                ...existingCustom,
                [type]: [...(existingCustom[type as keyof typeof existingCustom] || []), newCategory]
            };

            const { error } = await supabase.from('profiles').update({
                custom_categories: updatedCustom
            }).eq('id', user.id);

            if (error) throw error;

            // Update Profile in AppState to reflect changes
            setAppState(prev => ({
                ...prev,
                profile: prev.profile ? { ...prev.profile, custom_categories: updatedCustom } : null
            }));

        } catch (error: any) {
            console.error("Lỗi thêm danh mục:", error);
            alert("Không thể lưu danh mục mới. Vui lòng thử lại.");
            // Rollback local state
            if (type === 'expense') setCustomExpenseCats(prev => prev.filter(c => c !== newCategory));
            else setCustomIncomeCats(prev => prev.filter(c => c !== newCategory));
        }
    };

    const handleDeleteCategory = async (type: 'expense' | 'income', categoryToDelete: string) => {
        if (!user || !categoryToDelete) return;

        if (!window.confirm(`Bạn có chắc muốn xóa danh mục "${categoryToDelete}"?`)) return;

        // Update Local State
        if (type === 'expense') setCustomExpenseCats(prev => prev.filter(c => c !== categoryToDelete));
        else setCustomIncomeCats(prev => prev.filter(c => c !== categoryToDelete));

        // Update Database
        try {
            const currentProfile = appState.profile;
            const existingCustom = currentProfile?.custom_categories || { expense: [], income: [] };

            // Filter out the category
            const updatedList = (existingCustom[type as keyof typeof existingCustom] || []).filter((c: string) => c !== categoryToDelete);

            const updatedCustom = {
                ...existingCustom,
                [type]: updatedList
            };

            const { error } = await supabase.from('profiles').update({
                custom_categories: updatedCustom
            }).eq('id', user.id);

            if (error) throw error;

            // Update Profile in AppState
            setAppState(prev => ({
                ...prev,
                profile: prev.profile ? { ...prev.profile, custom_categories: updatedCustom } : null
            }));

        } catch (error: any) {
            console.error("Lỗi xóa danh mục:", error);
            alert("Không thể xóa danh mục. Vui lòng thử lại.");
            // Rollback local state
            if (type === 'expense') setCustomExpenseCats(prev => [...prev, categoryToDelete]);
            else setCustomIncomeCats(prev => [...prev, categoryToDelete]);
        }
    };

    // Các hàm giữ chỗ (Placeholder) cho Lịch trình - Bạn có thể copy logic tương tự Transaction
    // --- GOALS HANDLERS ---
    const handleAddGoal = async (newGoal: any) => {
        if (!user) return;
        const tempId = Date.now().toString();
        const optimisticGoal = { ...newGoal, id: tempId, user_id: user.id };
        setAppState((prev: AppState) => ({ ...prev, goals: [...prev.goals, optimisticGoal] }));
        try {
            const { data, error } = await supabase.from('goals').insert([{ user_id: user.id, ...newGoal }]).select().single();
            if (error) throw error;
            if (data) setAppState((prev: AppState) => ({ ...prev, goals: prev.goals.map(g => g.id === tempId ? data : g) }));
        } catch (error: any) {
            console.error(error);
            alert(`Lỗi thêm mục tiêu: ${error.message}`);
            setAppState((prev: AppState) => ({ ...prev, goals: prev.goals.filter(g => g.id !== tempId) }));
        }
    };

    const handleUpdateGoal = async (updatedGoal: any) => {
        const prevGoals = [...appState.goals];
        setAppState((prev: AppState) => ({ ...prev, goals: prev.goals.map(g => g.id === updatedGoal.id ? updatedGoal : g) }));
        try {
            const { error } = await supabase.from('goals').update({
                title: updatedGoal.title, target_amount: updatedGoal.target_amount, current_amount: updatedGoal.current_amount,
                deadline: updatedGoal.deadline, type: updatedGoal.type, progress: updatedGoal.progress
            }).eq('id', updatedGoal.id);
            if (error) throw error;
        } catch (error: any) {
            console.error(error);
            alert(`Lỗi cập nhật mục tiêu: ${error.message}`);
            setAppState((prev: AppState) => ({ ...prev, goals: prevGoals }));
        }
    };

    const handleDeleteGoal = async (id: string) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa mục tiêu này?')) return;
        const prevGoals = [...appState.goals];
        setAppState((prev: AppState) => ({ ...prev, goals: prev.goals.filter(g => g.id !== id) }));
        try {
            const { error } = await supabase.from('goals').delete().eq('id', id);
            if (error) throw error;
        } catch (error: any) {
            console.error(error);
            alert(`Lỗi xóa mục tiêu: ${error.message}`);
            setAppState((prev: AppState) => ({ ...prev, goals: prevGoals }));
        }
    };

    const handleAddTimetable = async (item: any) => {
        if (!user) return;
        const tempId = Date.now().toString();
        const optimisticItem = { ...item, id: tempId, user_id: user.id };
        setAppState((prev: AppState) => ({ ...prev, timetable: [...prev.timetable, optimisticItem] }));

        try {
            const { data, error } = await supabase.from('timetable').insert([{ user_id: user.id, ...item }]).select().single();
            if (error) throw error;
            if (data) setAppState((prev: AppState) => ({ ...prev, timetable: prev.timetable.map(t => t.id === tempId ? data : t) }));
        } catch (error: any) {
            console.error(error);
            setAppState((prev: AppState) => ({ ...prev, timetable: prev.timetable.filter(t => t.id !== tempId) }));
        }
    };

    const handleUpdateTimetable = async (item: any) => {
        const prevTimetable = [...appState.timetable];
        setAppState((prev: AppState) => ({ ...prev, timetable: prev.timetable.map(t => t.id === item.id ? item : t) }));
        try {
            const { error } = await supabase.from('timetable').update(item).eq('id', item.id);
            if (error) throw error;
        } catch (error) {
            console.error(error);
            setAppState((prev: AppState) => ({ ...prev, timetable: prevTimetable }));
        }
    };

    const handleDeleteTimetable = async (id: string) => {
        const prevTimetable = [...appState.timetable];
        setAppState((prev: AppState) => ({ ...prev, timetable: prev.timetable.filter(t => t.id !== id) }));
        try {
            const { error } = await supabase.from('timetable').delete().eq('id', id);
            if (error) throw error;
        } catch (error) {
            console.error(error);
            setAppState((prev: AppState) => ({ ...prev, timetable: prevTimetable }));
        }
    };
    const handleAddTodo = async (content: string, priority: any) => {
        if (!user) return;
        const tempId = crypto.randomUUID();
        const newItem = { id: tempId, content, priority, is_completed: false, user_id: user.id };

        // Optimistic UI: Update local state immediately
        setAppState((prev: AppState) => ({ ...prev, todos: [newItem, ...prev.todos] }));

        // Map UI priority to DB priority if needed
        let dbPriority = 'medium'; // Default fallback

        // If already a valid DB value, use it
        if (['high', 'medium', 'low'].includes(priority)) {
            dbPriority = priority;
        }
        // Otherwise map from Enum values
        else if (priority === 'urgent' || priority === TaskPriority.URGENT) dbPriority = 'high';
        else if (priority === 'focus' || priority === TaskPriority.FOCUS) dbPriority = 'medium';
        else if (priority === 'chill' || priority === TaskPriority.CHILL) dbPriority = 'low';
        else if (priority === 'temp' || priority === TaskPriority.TEMP) dbPriority = 'temp';

        try {
            const { data, error } = await supabase.from('todos').insert([{
                content, priority: dbPriority, is_completed: false, user_id: user.id
            }]).select().single();

            if (error) throw error;

            if (data) {
                setAppState((prev: AppState) => ({
                    ...prev,
                    todos: prev.todos.map(t => t.id === tempId ? data : t)
                }));
            }
        } catch (error: any) {
            console.error(error);
            alert("Lỗi thêm việc: " + error.message);
            setAppState((prev: AppState) => ({ ...prev, todos: prev.todos.filter(t => t.id !== tempId) }));
        }
    };

    const handleUpdateTodo = async (item: any) => {
        const prevTodos = [...appState.todos];
        setAppState((prev: AppState) => ({ ...prev, todos: prev.todos.map(t => t.id === item.id ? item : t) }));

        try {
            const { error } = await supabase.from('todos').update(item).eq('id', item.id);
            if (error) throw error;
        } catch (error: any) {
            console.error(error);
            alert("Lỗi cập nhật việc: " + error.message);
            setAppState((prev: AppState) => ({ ...prev, todos: prevTodos }));
        }
    };

    const handleDeleteTodo = async (id: string) => {
        const prevTodos = [...appState.todos];
        setAppState((prev: AppState) => ({ ...prev, todos: prev.todos.filter(t => t.id !== id) }));

        try {
            const { error } = await supabase.from('todos').delete().eq('id', id);
            if (error) throw error;
        } catch (error: any) {
            console.error(error);
            alert("Lỗi xóa việc: " + error.message);
            setAppState((prev: AppState) => ({ ...prev, todos: prevTodos }));
        }
    };

    return (
        <div className="min-h-screen bg-[#F8F9FC] font-sans text-gray-900 flex">
            {/* Sidebar Desktop */}
            <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 fixed h-full z-20 shadow-sm">
                <div className="p-6 flex items-center gap-3">
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2.5 rounded-xl shadow-lg">
                        <LayoutDashboard className="text-white" size={24} />
                    </div>
                    <h1 className="text-xl font-bold text-gray-800 tracking-tight">SmartLife</h1>
                </div>

                {/* Real-time Clock */}
                <div className="px-6 pb-2">
                    <RealtimeClock />
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-2">
                    {/* Language Toggle Desktop */}
                    <button onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')} className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all font-medium text-sm text-gray-500 hover:bg-gray-50 cursor-pointer border border-dashed border-gray-200 mb-2">
                        <div className="flex items-center gap-3">
                            <span>🌐</span>
                            <span>{lang === 'vi' ? 'Ngôn ngữ' : 'Language'}</span>
                        </div>
                        <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-xs">{lang.toUpperCase()}</span>
                    </button>
                    <button onClick={() => setActiveTab('visual')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${activeTab === 'visual' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}>
                        <LayoutDashboard size={20} /> {lang === 'vi' ? 'Tổng quan' : 'Visual Board'}
                    </button>
                    <button onClick={() => setActiveTab('finance')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${activeTab === 'finance' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}>
                        <Wallet size={20} /> Tài chính
                    </button>
                    <button onClick={() => setActiveTab('schedule')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${activeTab === 'schedule' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}>
                        <CalendarDays size={20} /> Lịch trình & Mục tiêu
                    </button>

                    {/* Notification Toggle Desktop */}
                    <div className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all font-medium text-sm text-gray-500 hover:bg-gray-50 cursor-pointer" onClick={toggleNotifications}>
                        <div className="flex items-center gap-3">
                            <span>🔔</span>
                            <span>Thông báo</span>
                        </div>
                        <div className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${notificationsEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${notificationsEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                    </div>
                </nav>

                <div className="p-4 border-t border-gray-100 space-y-2">
                    <button onClick={signOut} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-all font-medium text-sm">
                        <LogOut size={20} /> Đăng xuất
                    </button>
                    <button onClick={() => setIsSettingsOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all font-medium text-sm">
                        <Settings size={20} /> Cài đặt
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 md:ml-64 min-h-screen relative bg-[#F8F9FC] pb-24 md:pb-8"> {/* Added safe bottom padding for mobile */}
                <header className="md:hidden fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100 z-30 transition-all h-16">
                    <div className="flex items-center justify-between px-4 h-full">
                        <div className="flex items-center gap-2">
                            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-1.5 rounded-lg">
                                <LayoutDashboard className="text-white" size={18} />
                            </div>
                            <span className="font-bold text-gray-800 text-lg tracking-tight hidden sm:block">SmartLife</span>
                        </div>
                        <div className="flex gap-3 items-center">
                            <button onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')} className="px-2.5 py-1 bg-gray-100 text-xs font-bold rounded-lg text-gray-600 uppercase hover:bg-gray-200 transition-colors">
                                {lang}
                            </button>
                            <button onClick={toggleNotifications} className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${notificationsEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`} title="Bật/Tắt thông báo">
                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${notificationsEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                            <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"><Settings size={20} /></button>
                        </div>
                    </div>
                </header>

                <div className="max-w-7xl mx-auto p-4 md:p-8 pt-20 md:pt-8 relative h-full"> {/* Ensure relative for absolute positioning if needed */}
                    {activeTab === 'visual' && <VisualBoard appState={appState} userName={user?.user_metadata?.full_name || appState.profile?.full_name} onNavigate={setActiveTab} />}
                    {activeTab === 'finance' && (
                        <FinanceDashboard
                            state={appState}
                            onAddTransaction={handleAddTransaction}
                            onUpdateTransaction={handleUpdateTransaction}
                            onDeleteTransaction={handleDeleteTransaction}
                            onAddGoal={handleAddGoal}
                            onUpdateGoal={handleUpdateGoal}
                            onDeleteGoal={handleDeleteGoal}
                            isLoading={isLoadingData}
                            lang={lang}
                            expenseCategories={allExpenseCategories}
                            incomeCategories={allIncomeCategories}
                            onAddCategory={handleAddCategory}
                            onDeleteCategory={handleDeleteCategory}
                            onAddBudget={async (b) => {
                                if (!user) return;
                                const { data, error } = await supabase.from('budgets').insert([{ ...b, user_id: user.id }]).select().single();
                                if (data) setAppState(prev => ({ ...prev, budgets: [...prev.budgets, data] }));
                            }}
                            onUpdateBudget={async (b) => {
                                const { error } = await supabase.from('budgets').update(b).eq('id', b.id);
                                if (!error) setAppState(prev => ({ ...prev, budgets: prev.budgets.map(item => item.id === b.id ? { ...item, ...b } : item) }));
                            }}
                            onDeleteBudget={async (id) => {
                                const { error } = await supabase.from('budgets').delete().eq('id', id);
                                if (!error) setAppState(prev => ({ ...prev, budgets: prev.budgets.filter(item => item.id !== id) }));
                            }}
                        />
                    )}
                    {activeTab === 'schedule' && (
                        <ScheduleDashboard
                            state={appState}
                            onAddGoal={handleAddGoal} onUpdateGoal={handleUpdateGoal} onDeleteGoal={handleDeleteGoal}
                            onAddTimetable={handleAddTimetable} onUpdateTimetable={handleUpdateTimetable} onDeleteTimetable={handleDeleteTimetable}
                            onAddTodo={handleAddTodo} onUpdateTodo={handleUpdateTodo} onDeleteTodo={handleDeleteTodo}
                        />
                    )}
                </div>
            </main>


            {/* Mobile Bottom Nav */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center z-40 pb-safe pt-1 h-[70px] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <button
                    onClick={() => setActiveTab('visual')}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${activeTab === 'visual' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'visual' ? 'bg-indigo-50' : 'bg-transparent'}`}>
                        <LayoutDashboard size={24} strokeWidth={activeTab === 'visual' ? 2.5 : 2} />
                    </div>
                    <span className="text-[10px] font-bold">{lang === 'vi' ? 'Tổng quan' : 'Overview'}</span>
                </button>

                <button
                    onClick={() => setActiveTab('finance')}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${activeTab === 'finance' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'finance' ? 'bg-indigo-50' : 'bg-transparent'}`}>
                        <Wallet size={24} strokeWidth={activeTab === 'finance' ? 2.5 : 2} />
                    </div>
                    <span className="text-[10px] font-bold">{lang === 'vi' ? 'Tài chính' : 'Finance'}</span>
                </button>

                <button
                    onClick={() => setActiveTab('schedule')}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${activeTab === 'schedule' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'schedule' ? 'bg-indigo-50' : 'bg-transparent'}`}>
                        <CalendarDays size={24} strokeWidth={activeTab === 'schedule' ? 2.5 : 2} />
                    </div>
                    <span className="text-[10px] font-bold">{lang === 'vi' ? 'Lịch trình' : 'Schedule'}</span>
                </button>
            </nav>


            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} userId={user?.id || ''} onSignOut={signOut} />
            <PWAInstallPrompt />
        </div >
    );
};

import LandingPage from './components/LandingPage';

const AppWrapper: React.FC = () => {
    const { user, loading } = useAuth();
    const [showLogin, setShowLogin] = useState(false);
    const [lang, setLang] = useState<'vi' | 'en'>('vi');

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>;

    if (user) return <AuthenticatedApp lang={lang} setLang={setLang} />;

    if (showLogin) return <Login onBack={() => setShowLogin(false)} />;

    return <LandingPage onLogin={() => setShowLogin(true)} lang={lang} setLang={setLang} />;
};

const App: React.FC = () => (
    <AuthProvider><AppWrapper /></AuthProvider>
);

export default App;