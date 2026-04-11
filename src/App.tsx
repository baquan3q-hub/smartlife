// File: src/App.tsx
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, CalendarDays, Wallet, LogOut, Loader2, Settings, TimerIcon, Music, GraduationCap, ShieldAlert, ChevronLeft, ChevronRight, Menu, Crown } from 'lucide-react';

// Import các Components (Đảm bảo bạn đã tạo file trong thư mục components)
import FinanceDashboard from './components/FinanceDashboard';
import CashFlowDashboard from './components/CashFlowDashboard';
import AIAdvisorPage from './components/AIAdvisorPage';
import ScheduleDashboard from './components/ScheduleDashboard';
import VisualBoard from './components/VisualBoard';
import SettingsModal from './components/SettingsModal';
import Login from './components/Login';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
// Import FocusSpace
import FocusSpace from './components/FocusSpace';
import MusicSpace from './components/MusicSpace';
import GPADashboard from './components/GPADashboard';
import AdminDashboard from './components/AdminDashboard';
import PricingModal from './components/PricingModal';
import InvoiceModal from './components/InvoiceModal';
import ProGateOverlay from './components/ProGateOverlay';


import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './services/supabase';
import { requestNotificationPermission, checkAndNotify, checkCalendarAndNotify, checkGoalsAndNotify, checkCustomEventsAndNotify } from './services/notificationService';
import { generateInsights } from './services/smartEngine';
import InsightCard from './components/InsightCard';
import { messaging } from './services/firebase';
import { getToken, onMessage } from "firebase/messaging";
import { useFocusTimer } from './hooks/useFocusTimer';
import { useProAccess } from './hooks/useProAccess';
import { createSubscriptionOrder, setupTrialForNewUser } from './services/subscriptionService';
import { SubscriptionPlanDuration, SubscriptionOrder } from './types';

// Types và Constants (Khớp với file đã sửa)
import { AppState, Transaction, TaskPriority, SmartInsight, GPASemester, GPACourse, GPATemplateType } from './types';
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
    const [activeTab, setActiveTab] = useState<'visual' | 'finance' | 'schedule' | 'music' | 'cashflow' | 'ai-advisor' | 'gpa' | 'admin'>('visual');
    const [startInFocusMode, setStartInFocusMode] = useState(false); // New state for auto-opening focus
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Pro Subscription State
    const [isPricingOpen, setIsPricingOpen] = useState(false);
    const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
    const [currentOrder, setCurrentOrder] = useState<SubscriptionOrder | null>(null);

    // Shared Focus Timer Engine
    const timer = useFocusTimer();

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

    // Navigation state
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const handleSignOut = () => {
        if (window.confirm('Bạn có chắc chắn muốn đăng xuất không?')) {
            signOut();
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
        gpaSemesters: [], // GPA Module — khởi tạo rỗng, fetch từ Supabase
        gpaTargetCredits: 135,
    });

    // Pro Access (must be after appState declaration)
    const proAccess = useProAccess(appState.profile, user?.email || undefined);

    // Custom Category Management
    const [customExpenseCats, setCustomExpenseCats] = useState<string[]>([]);
    const [customIncomeCats, setCustomIncomeCats] = useState<string[]>([]);

    const allExpenseCategories = [...EXPENSE_CATEGORIES, ...customExpenseCats];
    const allIncomeCategories = [...INCOME_CATEGORIES, ...customIncomeCats];

    // Smart Insights State 🧠
    const [insights, setInsights] = useState<SmartInsight[]>([]);

    const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

    // --- PRO SUBSCRIPTION: Handle plan selection ---
    const handleSelectPlan = async (planId: SubscriptionPlanDuration) => {
        if (!user) return;
        const order = await createSubscriptionOrder(user.id, planId);
        if (order) {
            setCurrentOrder(order);
            setIsPricingOpen(false);
            setIsInvoiceOpen(true);
        } else {
            alert('Không thể tạo đơn hàng. Vui lòng thử lại.');
        }
    };

    const handleCreateNewOrder = () => {
        setIsInvoiceOpen(false);
        setIsPricingOpen(true);
    };

    // --- PRO: Setup trial for new users ---
    // Trial 30 ngày tính từ ngày tạo tài khoản (user.created_at)
    useEffect(() => {
        if (!user || !appState.profile) return;
        const needsTrial = (!appState.profile.plan || appState.profile.plan === 'free') && !appState.profile.trial_started_at;
        if (needsTrial) {
            // Dùng ngày tạo tài khoản làm mốc bắt đầu trial
            const accountCreatedAt = user.created_at || new Date().toISOString();
            setupTrialForNewUser(user.id, accountCreatedAt).then(() => {
                setAppState(prev => ({
                    ...prev,
                    profile: prev.profile ? {
                        ...prev.profile,
                        plan: 'trial',
                        trial_started_at: accountCreatedAt,
                    } : null,
                }));
            });
        }
    }, [user, appState.profile?.plan]);

    // Fetch Data từ Supabase khi user đăng nhập
    useEffect(() => {
        if (!user) return;

        // Route URL /admin to admin tab if user has permission
        if (window.location.pathname === '/admin' && user.email === 'baquan3q@gmail.com') {
            setActiveTab('admin');
        }

        // Update last_active_at — ghi nhận thời gian online
        supabase.from('profiles')
            .update({ last_active_at: new Date().toISOString() })
            .eq('id', user.id)
            .then(({ error }) => {
                if (error) console.warn('[SmartLife] Không update được last_active_at:', error.message);
                else console.info('[SmartLife] ✅ last_active_at updated');
            });

        const fetchData = async () => {
            setIsLoadingData(true);
            try {
                // Gọi song song 6 bảng dữ liệu (added calendar_events)
                const [txRes, goalRes, timeRes, todoRes, profileRes, eventsRes, budgetRes, gpaSemRes, gpaCourseRes] = await Promise.all([
                    supabase.from('transactions').select('*').order('date', { ascending: false }),
                    supabase.from('goals').select('*').order('deadline', { ascending: true }),
                    supabase.from('timetable').select('*').order('start_time', { ascending: true }),
                    supabase.from('todos').select('*').order('created_at', { ascending: false }),
                    supabase.from('profiles').select('*').eq('id', user.id).single(),
                    supabase.from('calendar_events').select('*'),
                    supabase.from('budgets').select('*'),
                    supabase.from('gpa_semesters').select('*').order('academic_year', { ascending: true }),
                    supabase.from('gpa_courses').select('*').order('created_at', { ascending: true }),
                ]);

                if (txRes.error) throw txRes.error;

                // Cập nhật State
                setAppState((prev: AppState) => ({
                    ...prev,
                    transactions: txRes.data.map(t => ({
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
                    profile: profileRes.data || null,
                    // GPA: Combine semesters with their courses
                    gpaSemesters: (gpaSemRes.data || []).map((sem: any) => ({
                        ...sem,
                        courses: (gpaCourseRes.data || []).filter((c: any) => c.semester_id === sem.id),
                    })),
                    gpaTargetCredits: Number(localStorage.getItem(`gpaTargetCredits_${user.id}`)) || 135,
                }));

                // Parse Custom Categories from Profile
                if (profileRes.data?.custom_categories) {
                    const customCats = profileRes.data.custom_categories;
                    if (customCats.expense) setCustomExpenseCats(customCats.expense);
                    if (customCats.income) setCustomIncomeCats(customCats.income);
                } else {
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
        const isSupported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;

        if (!isSupported) {
            console.log("This browser does not support Notifications or Service Workers.");
            return;
        }

        const requestPermission = async () => {
            try {
                const permission = await Notification.requestPermission();

                if (permission === "granted") {
                    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
                    console.log("Service Worker đã sẵn sàng:", registration);

                    const token = await getToken(messaging, {
                        vapidKey: "BNaKU7cMSXUBoTEpfqQ87cwaLYkqZgJZ4nWJQSD10gsl64Qj0XQiKmXbeGz3_PesfzY-pZ4bWalRKuMpGxN7Hi0",
                        serviceWorkerRegistration: registration
                    });

                    if (token) {
                    }
                }
            } catch (error) {
                console.error("Lỗi khi lấy token:", error);
            }
        };

        requestPermission();

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

        const interval = setInterval(() => {
            if (appState.timetable.length) checkAndNotify(appState.timetable);
            checkCalendarAndNotify();
            if (appState.goals.length) checkGoalsAndNotify(appState.goals);
            if (calendarEvents.length) checkCustomEventsAndNotify(calendarEvents);
        }, 60000);

        if (notificationsEnabled && (appState.timetable.length || calendarEvents.length)) {
            checkAndNotify(appState.timetable);
            checkCalendarAndNotify();
            if (appState.goals.length) checkGoalsAndNotify(appState.goals);
            if (calendarEvents.length) checkCustomEventsAndNotify(calendarEvents);
        }

        return () => clearInterval(interval);
    }, [appState.timetable, appState.goals, calendarEvents]);

    // Confirm close app
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
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
        const optimisticTx: Transaction = { ...newTx, id: tempId, user_id: user.id };

        setAppState((prev: AppState) => ({ ...prev, transactions: [optimisticTx, ...prev.transactions] }));

        try {
            const { data, error } = await supabase.from('transactions').insert([{
                user_id: user.id, ...newTx
            }]).select().single();

            if (error) throw error;
            if (data) {
                setAppState((prev: AppState) => ({
                    ...prev,
                    transactions: prev.transactions.map(t => t.id === tempId ? { ...data, amount: Number(data.amount) } : t)
                }));
            }
        } catch (error: any) {
            console.error('Lỗi thêm giao dịch:', error);
            alert(`Lỗi: ${error.message}`);
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

        const currentList = type === 'expense' ? allExpenseCategories : allIncomeCategories;
        if (currentList.includes(newCategory)) {
            alert("Danh mục này đã tồn tại!");
            return;
        }

        if (type === 'expense') setCustomExpenseCats(prev => [...prev, newCategory]);
        else setCustomIncomeCats(prev => [...prev, newCategory]);

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

            setAppState(prev => ({
                ...prev,
                profile: prev.profile ? { ...prev.profile, custom_categories: updatedCustom } : null
            }));

        } catch (error: any) {
            console.error("Lỗi thêm danh mục:", error);
            alert("Không thể lưu danh mục mới. Vui lòng thử lại.");
            if (type === 'expense') setCustomExpenseCats(prev => prev.filter(c => c !== newCategory));
            else setCustomIncomeCats(prev => prev.filter(c => c !== newCategory));
        }
    };

    const handleDeleteCategory = async (type: 'expense' | 'income', categoryToDelete: string) => {
        if (!user || !categoryToDelete) return;

        if (!window.confirm(`Bạn có chắc muốn xóa danh mục "${categoryToDelete}"?`)) return;

        if (type === 'expense') setCustomExpenseCats(prev => prev.filter(c => c !== categoryToDelete));
        else setCustomIncomeCats(prev => prev.filter(c => c !== categoryToDelete));

        try {
            const currentProfile = appState.profile;
            const existingCustom = currentProfile?.custom_categories || { expense: [], income: [] };

            const updatedList = (existingCustom[type as keyof typeof existingCustom] || []).filter((c: string) => c !== categoryToDelete);

            const updatedCustom = {
                ...existingCustom,
                [type]: updatedList
            };

            const { error } = await supabase.from('profiles').update({
                custom_categories: updatedCustom
            }).eq('id', user.id);

            if (error) throw error;

            setAppState(prev => ({
                ...prev,
                profile: prev.profile ? { ...prev.profile, custom_categories: updatedCustom } : null
            }));

        } catch (error: any) {
            console.error("Lỗi xóa danh mục:", error);
            alert("Không thể xóa danh mục. Vui lòng thử lại.");
            if (type === 'expense') setCustomExpenseCats(prev => [...prev, categoryToDelete]);
            else setCustomIncomeCats(prev => [...prev, categoryToDelete]);
        }
    };

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
    const handleAddTodo = async (content: string, priority: any, deadline?: string) => {
        if (!user) return;
        const tempId = crypto.randomUUID();
        const newItem = { id: tempId, content, priority, is_completed: false, user_id: user.id, deadline };

        setAppState((prev: AppState) => ({ ...prev, todos: [newItem, ...prev.todos] }));

        let dbPriority = 'medium';

        if (['high', 'medium', 'low'].includes(priority)) {
            dbPriority = priority;
        }
        else if (priority === 'urgent' || priority === TaskPriority.URGENT) dbPriority = 'high';
        else if (priority === 'focus' || priority === TaskPriority.FOCUS) dbPriority = 'medium';
        else if (priority === 'chill' || priority === TaskPriority.CHILL) dbPriority = 'low';
        else if (priority === 'temp' || priority === TaskPriority.TEMP) dbPriority = 'temp';

        try {
            const { data, error } = await supabase.from('todos').insert([{
                content, priority: dbPriority, is_completed: false, user_id: user.id, deadline
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

    // --- GPA HANDLERS ---
    const handleAddGPASemester = async (newSem: Omit<GPASemester, 'id' | 'courses'>) => {
        if (!user) return;
        const tempId = Date.now().toString();
        const optimistic: GPASemester = { ...newSem, id: tempId, user_id: user.id, courses: [] };
        setAppState(prev => ({ ...prev, gpaSemesters: [...prev.gpaSemesters, optimistic] }));
        try {
            const { data, error } = await supabase.from('gpa_semesters').insert([{
                user_id: user.id, name: newSem.name, academic_year: newSem.academic_year,
                semester_type: newSem.semester_type, year_of_study: newSem.year_of_study, is_current: newSem.is_current,
            }]).select().single();
            if (error) throw error;
            if (data) setAppState(prev => ({ ...prev, gpaSemesters: prev.gpaSemesters.map(s => s.id === tempId ? { ...data, courses: [] } : s) }));
        } catch (err: any) {
            console.error('Error adding semester:', err);
            setAppState(prev => ({ ...prev, gpaSemesters: prev.gpaSemesters.filter(s => s.id !== tempId) }));
        }
    };

    const handleUpdateGPASemester = async (sem: GPASemester) => {
        const prev = appState.gpaSemesters;
        setAppState(p => ({ ...p, gpaSemesters: p.gpaSemesters.map(s => s.id === sem.id ? sem : s) }));
        try {
            const { error } = await supabase.from('gpa_semesters').update({
                name: sem.name, academic_year: sem.academic_year, semester_type: sem.semester_type,
                year_of_study: sem.year_of_study, is_current: sem.is_current,
            }).eq('id', sem.id);
            if (error) throw error;
        } catch { setAppState(p => ({ ...p, gpaSemesters: prev })); }
    };

    const handleDeleteGPASemester = async (id: string) => {
        const prev = appState.gpaSemesters;
        setAppState(p => ({ ...p, gpaSemesters: p.gpaSemesters.filter(s => s.id !== id) }));
        try {
            const { error } = await supabase.from('gpa_semesters').delete().eq('id', id);
            if (error) throw error;
        } catch { setAppState(p => ({ ...p, gpaSemesters: prev })); }
    };

    const handleImportGPAData = async (importedSemesters: any[]) => {
        if (!user) return;
        try {
            for (const sem of importedSemesters) {
                const { data: semData, error: semErr } = await supabase.from('gpa_semesters').insert([{
                    user_id: user.id, name: sem.name, academic_year: sem.academic_year,
                    semester_type: sem.semester_type, year_of_study: sem.year_of_study, is_current: sem.is_current,
                }]).select().single();
                if (semErr) throw semErr;

                if (semData && sem.courses && sem.courses.length > 0) {
                    const coursesToInsert = sem.courses.map((c: any) => ({
                        user_id: user.id, semester_id: semData.id, name: c.name, credits: c.credits,
                        template: c.template, score_cc1: c.score_cc1, score_cc2: c.score_cc2,
                        score_cc3: c.score_cc3, score_final: c.score_final,
                        exclude_from_gpa: c.exclude_from_gpa, is_conditional: c.is_conditional
                    }));
                    const { error: coursesErr } = await supabase.from('gpa_courses').insert(coursesToInsert);
                    if (coursesErr) throw coursesErr;
                }
            }
            const [semRes, courseRes] = await Promise.all([
                supabase.from('gpa_semesters').select('*').order('created_at', { ascending: true }),
                supabase.from('gpa_courses').select('*').order('created_at', { ascending: true })
            ]);
            if (semRes.data && courseRes.data) {
                const combinedSemesters = semRes.data.map(sem => ({
                    ...sem,
                    courses: courseRes.data.filter(c => c.semester_id === sem.id)
                }));
                setAppState(prev => ({ ...prev, gpaSemesters: combinedSemesters }));
            }
        } catch (err: any) {
            console.error('Import Error:', err);
            throw err;
        }
    };

    const handleAddGPACourse = async (semesterId: string, course: Omit<GPACourse, 'id' | 'computed'>) => {
        if (!user) return;
        const tempId = Date.now().toString();
        const optimistic: GPACourse = { ...course, id: tempId, user_id: user.id, semester_id: semesterId, exclude_from_gpa: course.exclude_from_gpa ?? false, is_conditional: course.is_conditional ?? false };
        setAppState(prev => ({
            ...prev, gpaSemesters: prev.gpaSemesters.map(s => s.id === semesterId ? { ...s, courses: [...s.courses, optimistic] } : s)
        }));
        try {
            const { data, error } = await supabase.from('gpa_courses').insert([{
                user_id: user.id, semester_id: semesterId, name: course.name, credits: course.credits,
                template: course.template, score_cc1: course.score_cc1, score_cc2: course.score_cc2,
                score_cc3: course.score_cc3, score_final: course.score_final,
                exclude_from_gpa: course.exclude_from_gpa, is_conditional: course.is_conditional,
            }]).select().single();
            if (error) throw error;
            if (data) setAppState(prev => ({
                ...prev, gpaSemesters: prev.gpaSemesters.map(s => s.id === semesterId
                    ? { ...s, courses: s.courses.map(c => c.id === tempId ? { ...data, exclude_from_gpa: data.exclude_from_gpa ?? false, is_conditional: data.is_conditional ?? false } : c) }
                    : s)
            }));
        } catch (err: any) {
            console.error('Error adding course:', err);
            setAppState(prev => ({
                ...prev, gpaSemesters: prev.gpaSemesters.map(s => s.id === semesterId ? { ...s, courses: s.courses.filter(c => c.id !== tempId) } : s)
            }));
        }
    };

    const handleUpdateGPACourse = async (course: GPACourse) => {
        setAppState(prev => ({
            ...prev, gpaSemesters: prev.gpaSemesters.map(s => ({
                ...s, courses: s.courses.map(c => c.id === course.id ? course : c)
            }))
        }));
        try {
            await supabase.from('gpa_courses').update({
                name: course.name, credits: course.credits, template: course.template,
                score_cc1: course.score_cc1, score_cc2: course.score_cc2, score_cc3: course.score_cc3,
                score_final: course.score_final, exclude_from_gpa: course.exclude_from_gpa,
                is_conditional: course.is_conditional,
            }).eq('id', course.id);
        } catch (err) { console.error('Error updating course:', err); }
    };
    const handleUpdateGPATargetCredits = (credits: number) => {
        if (!user) return;
        setAppState(prev => ({ ...prev, gpaTargetCredits: credits }));
        localStorage.setItem(`gpaTargetCredits_${user.id}`, credits.toString());
    };

    const handleDeleteGPACourse = async (id: string) => {
        const prevState = appState.gpaSemesters;
        setAppState(prev => ({
            ...prev, gpaSemesters: prev.gpaSemesters.map(s => ({ ...s, courses: s.courses.filter(c => c.id !== id) }))
        }));
        try {
            const { error } = await supabase.from('gpa_courses').delete().eq('id', id);
            if (error) throw error;
        } catch { setAppState(prev => ({ ...prev, gpaSemesters: prevState })); }
    };

    return (
        <div className="min-h-screen bg-[#F8F9FC] font-sans text-gray-900 flex">
            {/* Sidebar Desktop */}
            <aside className={`hidden md:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-gray-200 fixed h-full z-20 shadow-sm transition-all duration-300 ease-in-out`}>
                <div className={`p-6 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} gap-3 relative`}>
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-indigo-100 border border-gray-100 shrink-0">
                            <img src="/pwa-192x192.png" alt="SmartLife" className="w-full h-full object-cover" />
                        </div>
                        {!isSidebarCollapsed && <h1 className="text-xl font-bold text-gray-800 tracking-tight whitespace-nowrap">SmartLife</h1>}
                    </div>
                    
                    {/* Toggle Button */}
                    <button 
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className={`absolute -right-3 top-8 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-all z-30`}
                    >
                        {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                    </button>
                </div>

                {/* Real-time Clock */}
                {!isSidebarCollapsed && (
                    <div className="px-6 pb-2 animate-in fade-in duration-500">
                        <RealtimeClock />
                    </div>
                )}

                <nav className={`flex-1 overflow-y-auto px-4 space-y-2 mt-2 scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300`}>
                    {/* Language Toggle Desktop */}
                    <button onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} px-4 py-3.5 rounded-xl transition-all font-medium text-sm text-gray-500 hover:bg-gray-50 cursor-pointer border border-dashed border-gray-200 mb-2`}>
                        <div className="flex items-center gap-3">
                            <span title={lang === 'vi' ? 'Ngôn ngữ' : 'Language'}>🌐</span>
                            {!isSidebarCollapsed && <span>{lang === 'vi' ? 'Ngôn ngữ' : 'Language'}</span>}
                        </div>
                        {!isSidebarCollapsed && <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-xs">{lang.toUpperCase()}</span>}
                    </button>

                    <button onClick={() => setActiveTab('visual')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${activeTab === 'visual' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`} title={isSidebarCollapsed ? (lang === 'vi' ? 'Tổng quan' : 'Visual Board') : ''}>
                        <LayoutDashboard size={20} className="shrink-0" /> {!isSidebarCollapsed && <span className="whitespace-nowrap">{lang === 'vi' ? 'Tổng quan' : 'Visual Board'}</span>}
                        {!proAccess.hasAccess && !isSidebarCollapsed && <span className="ml-auto text-[9px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-bold">PRO</span>}
                    </button>
                    <button onClick={() => setActiveTab('finance')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${activeTab === 'finance' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`} title={isSidebarCollapsed ? 'Tài chính' : ''}>
                        <Wallet size={20} className="shrink-0" /> {!isSidebarCollapsed && <span className="whitespace-nowrap">Tài chính</span>}
                    </button>
                    <button onClick={() => setActiveTab('schedule')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${activeTab === 'schedule' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`} title={isSidebarCollapsed ? 'Lịch trình & Mục tiêu' : ''}>
                        <CalendarDays size={20} className="shrink-0" /> {!isSidebarCollapsed && <span className="whitespace-nowrap">Lịch trình & Mục tiêu</span>}
                        {!proAccess.hasAccess && !isSidebarCollapsed && <span className="ml-auto text-[9px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-bold">PRO</span>}
                    </button>
                    <button onClick={() => setActiveTab('gpa')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${activeTab === 'gpa' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`} title={isSidebarCollapsed ? 'GPA' : ''}>
                        <GraduationCap size={20} className="shrink-0" /> {!isSidebarCollapsed && <span className="whitespace-nowrap">GPA</span>}
                    </button>

                    {/* Admin Panel Toggle */}
                    {user?.email === 'baquan3q@gmail.com' && (
                        <button onClick={() => setActiveTab('admin')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3.5 rounded-xl transition-all font-bold text-sm ${activeTab === 'admin' ? 'bg-red-50 text-red-600' : 'text-gray-500 hover:bg-gray-50 hover:text-red-500'}`} title={isSidebarCollapsed ? 'Admin Panel' : ''}>
                            <ShieldAlert size={20} className="shrink-0" /> {!isSidebarCollapsed && <span className="whitespace-nowrap">Admin Panel</span>}
                        </button>
                    )}

                    {/* Pro Upgrade Button */}
                    {!proAccess.isProActive && !proAccess.isLifetime && (
                        <button onClick={() => setIsPricingOpen(true)} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3.5 rounded-xl transition-all font-semibold text-sm bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 hover:from-indigo-100 hover:to-purple-100 border border-indigo-100`} title={isSidebarCollapsed ? 'Nâng cấp Pro' : ''}>
                            <Crown size={20} className="shrink-0 text-yellow-500" /> {!isSidebarCollapsed && <span className="whitespace-nowrap">Nâng cấp Pro</span>}
                        </button>
                    )}

                    {/* Notification Toggle Desktop */}
                    <div className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} px-4 py-3.5 rounded-xl transition-all font-medium text-sm text-gray-500 hover:bg-gray-50 cursor-pointer`} onClick={toggleNotifications}>
                        <div className="flex items-center gap-3">
                            <span title="Thông báo">🔔</span>
                            {!isSidebarCollapsed && <span>Thông báo</span>}
                        </div>
                        {!isSidebarCollapsed && (
                            <div className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${notificationsEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${notificationsEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                        )}
                    </div>
                </nav>

                {/* Pro Status Badge */}
                {!isSidebarCollapsed && (
                    <div className="px-4 py-2">
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${
                            proAccess.badgeColor === 'green' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                            proAccess.badgeColor === 'yellow' ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' :
                            proAccess.badgeColor === 'red' ? 'bg-red-50 text-red-600 border border-red-100' :
                            'bg-gray-50 text-gray-500 border border-gray-100'
                        }`}>
                            <span className={`w-2 h-2 rounded-full ${
                                proAccess.badgeColor === 'green' ? 'bg-emerald-500' :
                                proAccess.badgeColor === 'yellow' ? 'bg-yellow-500 animate-pulse' :
                                proAccess.badgeColor === 'red' ? 'bg-red-500 animate-pulse' :
                                'bg-gray-400'
                            }`} />
                            <span>{proAccess.badgeText}</span>
                            <span className="ml-auto text-[10px] font-normal opacity-70">{proAccess.planLabel}</span>
                        </div>
                    </div>
                )}

                <div className={`p-4 border-t border-gray-100 space-y-2 ${isSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
                    <button onClick={handleSignOut} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-all font-medium text-sm`} title={isSidebarCollapsed ? 'Đăng xuất' : ''}>
                        <LogOut size={20} className="shrink-0" /> {!isSidebarCollapsed && <span className="whitespace-nowrap">Đăng xuất</span>}
                    </button>
                    <button onClick={() => setIsSettingsOpen(true)} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-xl text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all font-medium text-sm`} title={isSidebarCollapsed ? 'Cài đặt' : ''}>
                        <Settings size={20} className="shrink-0" /> {!isSidebarCollapsed && <span className="whitespace-nowrap">Cài đặt</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={`flex-1 ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'} min-h-screen relative bg-[#F8F9FC] transition-all duration-300 ease-in-out ${activeTab === 'ai-advisor' ? 'pb-0' : 'pb-24 md:pb-8'}`}> {/* Added safe bottom padding for mobile */}
                {activeTab !== 'ai-advisor' && <header className="md:hidden fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100 z-30 transition-all h-16">
                    <div className="flex items-center justify-between px-4 h-full">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg overflow-hidden border border-gray-100">
                                <img src="/pwa-192x192.png" alt="SmartLife" className="w-full h-full object-cover" />
                            </div>
                            <span className="font-bold text-gray-800 text-lg tracking-tight hidden sm:block">SmartLife</span>
                        </div>
                        <div className="flex gap-3 items-center">
                            <button onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')} className="px-2.5 py-1 bg-gray-100 text-xs font-bold rounded-lg text-gray-600 uppercase hover:bg-gray-200 transition-colors">
                                {lang}
                            </button>
                            {/* Admin Panel — mobile header */}
                            {user?.email === 'baquan3q@gmail.com' && (
                                <button onClick={() => setActiveTab('admin')} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors" title="Admin Panel">
                                    <ShieldAlert size={20} />
                                </button>
                            )}
                            {/* Pro Crown — mobile header */}
                            {!proAccess.isProActive && !proAccess.isLifetime && (
                                <button onClick={() => setIsPricingOpen(true)} className="relative p-2 rounded-full hover:bg-yellow-50 transition-colors" title="Nâng cấp Pro">
                                    <Crown size={20} className="text-yellow-500" fill="currentColor" />
                                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-white" />
                                </button>
                            )}
                            <button onClick={toggleNotifications} className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${notificationsEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`} title="Bật/Tắt thông báo">
                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${notificationsEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                            <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"><Settings size={20} /></button>
                        </div>
                    </div>
                </header>}

                <div className={`${activeTab === 'ai-advisor' ? 'h-full' : 'max-w-7xl mx-auto p-4 md:p-8 pt-20 md:pt-8 relative h-full'}`}> {/* AI Advisor gets full screen, others get padded layout */}
                    {activeTab === 'visual' && (
                        proAccess.hasAccess ? (
                            <VisualBoard appState={appState} userName={user?.user_metadata?.full_name || appState.profile?.full_name} userId={user?.id} onNavigate={(tab) => {
                                if (tab === 'music') {
                                    setStartInFocusMode(true);
                                    setActiveTab('schedule');
                                } else {
                                    setActiveTab(tab);
                                }
                            }} />
                        ) : (
                            <ProGateOverlay featureName="Visual Board" onUpgrade={() => setIsPricingOpen(true)} isGracePeriod={proAccess.isInGracePeriod} />
                        )
                    )}
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
                            onNavigateToCashFlow={() => setActiveTab('cashflow')}
                            onNavigateToAI={() => setActiveTab('ai-advisor')}
                        />
                    )}
                    {activeTab === 'cashflow' && (
                        <CashFlowDashboard
                            state={appState}
                            lang={lang}
                            onBack={() => setActiveTab('finance')}
                        />
                    )}
                    {activeTab === 'ai-advisor' && (
                        proAccess.hasAccess ? (
                            <AIAdvisorPage
                                appState={appState}
                                lang={lang}
                                onBack={() => setActiveTab('finance')}
                                onAddTimetable={handleAddTimetable}
                                onAddTodo={handleAddTodo}
                                onAddTransaction={handleAddTransaction}
                            />
                        ) : (
                            <div className="max-w-7xl mx-auto p-4 md:p-8 pt-20 md:pt-8">
                                <ProGateOverlay featureName="AI Advisor" onUpgrade={() => setIsPricingOpen(true)} isGracePeriod={proAccess.isInGracePeriod} />
                            </div>
                        )
                    )}
                    {activeTab === 'admin' && user?.email === 'baquan3q@gmail.com' && (
                        <AdminDashboard adminEmail={user.email} />
                    )}
                    {activeTab === 'schedule' && (
                        proAccess.hasAccess ? (
                            <ScheduleDashboard
                                state={{ ...appState, timer, onOpenMusic: () => setActiveTab('music') } as any}
                                onAddGoal={handleAddGoal} onUpdateGoal={handleUpdateGoal} onDeleteGoal={handleDeleteGoal}
                                onAddTimetable={handleAddTimetable} onUpdateTimetable={handleUpdateTimetable} onDeleteTimetable={handleDeleteTimetable}
                                onAddTodo={handleAddTodo} onUpdateTodo={handleUpdateTodo} onDeleteTodo={handleDeleteTodo}
                                initialFocusMode={startInFocusMode}
                                onResetFocusMode={() => setStartInFocusMode(false)}
                            />
                        ) : (
                            <ProGateOverlay featureName="Lịch trình & Mục tiêu" onUpgrade={() => setIsPricingOpen(true)} isGracePeriod={proAccess.isInGracePeriod} />
                        )
                    )}
                    {activeTab === 'gpa' && (
                        <GPADashboard
                            semesters={appState.gpaSemesters}
                            onAddSemester={handleAddGPASemester}
                            onUpdateSemester={handleUpdateGPASemester}
                            onDeleteSemester={handleDeleteGPASemester}
                            onAddCourse={handleAddGPACourse}
                            onUpdateCourse={handleUpdateGPACourse}
                            onDeleteCourse={handleDeleteGPACourse}
                            onImportGPAData={handleImportGPAData}
                            targetCredits={appState.gpaTargetCredits}
                            onUpdateTargetCredits={handleUpdateGPATargetCredits}
                            isLoading={isLoadingData}
                            lang={lang}
                        />
                    )}
                </div>
            </main>


            {/* Mobile Bottom Nav */}
            {activeTab !== 'ai-advisor' && <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center z-40 pb-safe pt-1 h-[70px] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
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

                <button
                    onClick={() => setActiveTab('gpa')}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${activeTab === 'gpa' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'gpa' ? 'bg-indigo-50' : 'bg-transparent'}`}>
                        <GraduationCap size={24} strokeWidth={activeTab === 'gpa' ? 2.5 : 2} />
                    </div>
                    <span className="text-[10px] font-bold">GPA</span>
                </button>
            </nav>}


            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} userId={user?.id || ''} onSignOut={signOut} />
            <PricingModal
                isOpen={isPricingOpen}
                onClose={() => setIsPricingOpen(false)}
                onSelectPlan={handleSelectPlan}
                daysRemaining={proAccess.daysRemaining}
                isTrialExpired={!proAccess.hasAccess && !proAccess.isTrialActive}
            />
            <InvoiceModal
                isOpen={isInvoiceOpen}
                onClose={() => setIsInvoiceOpen(false)}
                order={currentOrder}
                onCreateNewOrder={handleCreateNewOrder}
            />
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