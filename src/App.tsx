import React, { useState, useEffect } from 'react';
import { LayoutDashboard, CalendarDays, Wallet as WalletIcon, LogOut, Loader2, Settings, TimerIcon, Music, GraduationCap, ShieldAlert, ChevronLeft, ChevronRight, Menu, Crown, Flame, BookOpen, Target, Grid2X2 } from 'lucide-react';
import { NotificationPopupModal } from './components/NotificationPopupModal';
import { getUnreadCount, getUserNotifications } from './services/adminNotificationService';

// Static imports for all components to ensure instant loading and refresh in development mode
import FinanceDashboard from './components/FinanceDashboard';
import AIAdvisorPage from './components/AIAdvisorPage';
import ScheduleDashboard from './components/ScheduleDashboard';
import VisualBoard from './components/VisualBoard';
import GPADashboard from './components/GPADashboard';
import AdminDashboard from './components/AdminDashboard';
import HabitDashboard from './components/HabitDashboard';
import JournalDashboard from './components/JournalDashboard';
import GoalsDashboard from './components/GoalsDashboard';
import CashFlowDashboard from './components/CashFlowDashboard';
import SettingsModal from './components/SettingsModal';
import Login from './components/Login';
import WelcomeTourModal from './components/WelcomeTourModal';
import MusicSpace from './components/MusicSpace';
import PricingModal from './components/PricingModal';
import InvoiceModal from './components/InvoiceModal';
import MySpotify from './components/MySpotify';
import ExpandSection from './components/ExpandSection';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import ProGateOverlay from './components/ProGateOverlay';
import { GlobalLoader } from './components/GlobalLoader';
import ClickRippleEffect from './components/ClickRippleEffect';
import { careerGoalService } from './services/careerGoalService';


import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './services/supabase';
import { requestNotificationPermission, checkAndNotify, checkCalendarAndNotify, checkGoalsAndNotify, checkCustomEventsAndNotify, checkHabitsFromDBAndNotify, checkTodosAndNotify, checkAndSendEmailNotifications } from './services/notificationService';
import { generateInsights } from './services/smartEngine';
import InsightCard from './components/InsightCard';
import { messaging } from './services/firebase';
import { getToken, onMessage } from "firebase/messaging";
import { useFocusTimer } from './hooks/useFocusTimer';
import { useProAccess } from './hooks/useProAccess';
import { useTaskTracker } from './hooks/useTaskTracker';
import { ActiveTaskWidget } from './components/ActiveTaskWidget';
import { ActiveFocusWidget } from './components/ActiveFocusWidget';
import { createSubscriptionOrder, setupTrialForNewUser, getLatestPendingOrder } from './services/subscriptionService';
import { SubscriptionPlanDuration, SubscriptionOrder } from './types';
import { Lang, t } from './i18n/i18n';
import { useTheme } from './utils/theme';

// Types và Constants (Khớp với file đã sửa)
import { TaskPriority, GPATemplateType, TransactionType } from './types';
import type { AppState, Transaction, Todo, TodoStatus, SmartInsight, GPASemester, GPACourse, UserNotification, Wallet, Debt } from './types';
import { INITIAL_BUDGET, INITIAL_GOALS, INITIAL_TRANSACTIONS, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './constants';
import { walletService } from './services/walletService';
import { debtService } from './services/debtService';

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
    lang: Lang;
    setLang: (lang: Lang) => void;
}

const AuthenticatedApp: React.FC<AuthenticatedAppProps> = ({ lang, setLang }) => {
    const { user, signOut } = useAuth();

    // Notifications State
    const [unreadNotifications, setUnreadNotifications] = useState<UserNotification[]>([]);

    // In-app notifications Realtime Subscription
    useEffect(() => {
        if (!user) return;

        // Tải thông báo chưa đọc khi vào app
        getUserNotifications(user.id).then(notifs => {
            const unread = notifs.filter(n => !n.is_read);
            if (unread.length > 0) {
                setUnreadNotifications(unread);
            }
        });

        const channel = supabase
            .channel(`user-notifications-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'user_notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    const newNotif = payload.new as UserNotification;
                    console.log('Realtime notification received:', newNotif);

                    // Thêm thông báo mới vào modal popup trong thời gian thực
                    setUnreadNotifications(prev => {
                        if (prev.some(n => n.id === newNotif.id)) return prev;
                        return [newNotif, ...prev];
                    });

                    // Gửi push notification nếu được cấp quyền
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification(newNotif.title, {
                            body: newNotif.message,
                            icon: '/pwa-192x192.png'
                        });
                    }

                    // Refresh data if subscription changes
                    if (newNotif.type === 'gift_pro' || newNotif.type === 'extend_pro') {
                        fetchData(true);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

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
        gpaTargetGPA: null,
        gpaTargetSemesters: 4,
        wallets: [],
        debts: [],
    });

    const [activeTab, setActiveTab] = useState<'visual' | 'finance' | 'schedule' | 'music' | 'cashflow' | 'ai-advisor' | 'gpa' | 'admin' | 'habit' | 'journal' | 'goals' | 'expand'>(() => {
        const hash = window.location.hash;
        const cleanHash = hash.replace(/^#\/?/, '');
        const validTabs = ['visual', 'finance', 'schedule', 'music', 'cashflow', 'ai-advisor', 'gpa', 'admin', 'habit', 'journal', 'goals', 'expand'];
        if (validTabs.includes(cleanHash)) {
            if (cleanHash === 'music') {
                return 'schedule';
            }
            return cleanHash as any;
        }
        return 'visual';
    });

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            const cleanHash = hash.replace(/^#\/?/, '');
            const validTabs = ['visual', 'finance', 'schedule', 'music', 'cashflow', 'ai-advisor', 'gpa', 'admin', 'habit', 'journal', 'goals', 'expand'];
            if (cleanHash === 'music') {
                setStartInFocusMode(true);
                setActiveTab('schedule');
            } else if (validTabs.includes(cleanHash)) {
                setActiveTab(cleanHash as any);
            }
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    useEffect(() => {
        const targetHash = `#/${activeTab}`;
        if (window.location.hash !== targetHash) {
            window.location.hash = targetHash;
        }
    }, [activeTab]);

    const deferredTab = React.useDeferredValue(activeTab);

    const handleResetFocusMode = React.useCallback(() => {
        setStartInFocusMode(false);
    }, []);

    const lastReorderTimeRef = React.useRef(0);
    const lastFetchTimeRef = React.useRef(0);
    const isCompletedAtSupportedRef = React.useRef(true);

    const [settingsTrigger, setSettingsTrigger] = useState(0);
    useEffect(() => {
        const handleStorageChange = () => {
            setSettingsTrigger(prev => prev + 1);
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const filteredTodos = React.useMemo(() => {
        const isExpiryEnabled = localStorage.getItem('smartlife_todo_expiry_enabled') === 'true';
        if (!isExpiryEnabled) return appState.todos;

        const expiryDays = parseInt(localStorage.getItem('smartlife_todo_expiry_days') || '90', 10);
        const cutoffTime = Date.now() - expiryDays * 24 * 60 * 60 * 1000;

        return appState.todos.filter(todo => {
            const isCompleted = todo.status === 'done' || todo.is_completed;
            if (!isCompleted) return true;

            const completedTimeStr = todo.completed_at || localStorage.getItem(`todo_completed_at_${todo.id}`) || (todo as any).updated_at || todo.created_at;
            if (!completedTimeStr) return true;

            const completedTime = new Date(completedTimeStr).getTime();
            if (isNaN(completedTime) || isNaN(cutoffTime)) return true;
            return completedTime >= cutoffTime;
        });
    }, [appState.todos, settingsTrigger]);

    const [gpaInitialView, setGpaInitialView] = useState<string | null>(null);
    const [goalsInitialView, setGoalsInitialView] = useState<'career' | 'life' | 'cv' | null>(null);
    const [startInFocusMode, setStartInFocusMode] = useState(() => {
        const hash = window.location.hash;
        return hash === '#/music' || hash === '#music';
    }); // New state for auto-opening focus
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSpotifyOpen, setIsSpotifyOpen] = useState(false);



    // Header Shortcuts State (Spotify & Habit buttons on mobile header)
    const [headerShortcuts, setHeaderShortcuts] = useState<{ spotify: boolean; habit: boolean }>(() => {
        const saved = localStorage.getItem(`smartlife_header_shortcuts_${user?.id}`);
        return saved ? JSON.parse(saved) : { spotify: true, habit: true };
    });

    useEffect(() => {
        if (user?.id) {
            const saved = localStorage.getItem(`smartlife_header_shortcuts_${user.id}`);
            setHeaderShortcuts(saved ? JSON.parse(saved) : { spotify: true, habit: true });
        }
    }, [user?.id]);

    // Fixed mobile navbar tabs (4 items only)
    const MOBILE_NAV_TABS = [
        { id: 'visual', labelVi: 'Tổng quan', labelEn: 'Overview', labelKo: '개요', icon: LayoutDashboard, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { id: 'finance', labelVi: 'Tài chính', labelEn: 'Finance', labelKo: '재정', icon: WalletIcon, color: 'text-blue-900', bg: 'bg-blue-50' },
        { id: 'schedule', labelVi: 'Lịch trình', labelEn: 'Schedule', labelKo: '일정', icon: CalendarDays, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { id: 'expand', labelVi: 'Mở rộng', labelEn: 'More', labelKo: '더보기', icon: Grid2X2, color: 'text-violet-600', bg: 'bg-violet-50' },
    ];

    // Pro Subscription State
    const [isPricingOpen, setIsPricingOpen] = useState(false);
    const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
    const [currentOrder, setCurrentOrder] = useState<SubscriptionOrder | null>(null);

    // Shared Focus Timer Engine
    const timer = useFocusTimer();

    // Custom Event Listener to open music space from ActiveFocusWidget
    useEffect(() => {
        const handleOpenMusic = () => {
            setStartInFocusMode(true);
            setActiveTab('schedule');
        };
        window.addEventListener('open-music-space', handleOpenMusic);
        return () => window.removeEventListener('open-music-space', handleOpenMusic);
    }, []);

    // Custom Event Listener to open settings modal
    useEffect(() => {
        const handleOpenSettings = () => {
            setIsSettingsOpen(true);
        };
        window.addEventListener('open-settings-modal', handleOpenSettings);
        return () => window.removeEventListener('open-settings-modal', handleOpenSettings);
    }, []);

    // Task Tracker Engine
    const saveTimeSpent = (todoId: string, secondsSpent: number) => {
        const todo = appState.todos.find(t => t.id === todoId);
        if (todo) {
            const currentSpent = todo.time_spent || 0;
            const updatedTodo = {
                ...todo,
                time_spent: currentSpent + secondsSpent,
                is_completed: true // Mark task completed when completed via widget controls
            };
            handleUpdateTodo(updatedTodo);
        }
    };

    const taskTracker = useTaskTracker(saveTimeSpent);

    // Sync task tracker's active task with state updates (e.g., if todo name is edited)
    useEffect(() => {
        if (taskTracker.activeTask) {
            const currentTodo = appState.todos.find(t => t.id === taskTracker.activeTask?.id);
            if (currentTodo && JSON.stringify(currentTodo) !== JSON.stringify(taskTracker.activeTask)) {
                taskTracker.setActiveTask(currentTodo);
            }
        }
    }, [appState.todos, taskTracker.activeTask, taskTracker.setActiveTask]);

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
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
    const [isWelcomeTourOpen, setIsWelcomeTourOpen] = useState(false);

    useEffect(() => {
        if (!user) return;

        const tourLastShownKey = `smartlife_tour_last_shown_${user.id}`;
        const lastActiveKey = `smartlife_last_active_time_${user.id}`;
        const logoutFlagKey = `smartlife_logged_out_flag`;

        const now = Date.now();
        const lastShown = localStorage.getItem(tourLastShownKey);
        const prevLastActive = localStorage.getItem(lastActiveKey);
        const wasLoggedOut = localStorage.getItem(logoutFlagKey) === 'true';

        // Update the last active time to now (recorded for this session entry)
        localStorage.setItem(lastActiveKey, now.toString());

        let shouldShowTour = false;

        if (!lastShown) {
            // New user (never shown the tour on this account/device)
            shouldShowTour = true;
        } else if (wasLoggedOut) {
            // Logged out and logged back in
            shouldShowTour = true;
            localStorage.removeItem(logoutFlagKey);
        } else if (prevLastActive) {
            // Checked if they haven't opened the app for a week (7 days)
            const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
            const timeDiff = now - Number(prevLastActive);
            if (timeDiff >= oneWeekMs) {
                shouldShowTour = true;
            }
        }

        if (shouldShowTour) {
            setIsWelcomeTourOpen(true);
            localStorage.setItem(tourLastShownKey, now.toString());
        }
    }, [user?.id]);

    const handleSignOut = () => {
        if (window.confirm('Bạn có chắc chắn muốn đăng xuất không?')) {
            signOut();
        }
    };

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

    const handleOpenPricing = React.useCallback(async () => {
        if (!user) return;

        // Kiểm tra hóa đơn hiện tại trong state
        if (currentOrder) {
            const expireTime = new Date(currentOrder.invoice_expires_at).getTime();
            if (expireTime > Date.now()) {
                setIsInvoiceOpen(true);
                return;
            } else {
                setCurrentOrder(null);
            }
        }

        // Gọi DB kiểm tra xem có hóa đơn pending nào không
        const pendingOrder = await getLatestPendingOrder(user.id);
        if (pendingOrder) {
            const expireTime = new Date(pendingOrder.invoice_expires_at).getTime();
            if (expireTime > Date.now()) {
                setCurrentOrder(pendingOrder);
                setIsInvoiceOpen(true);
                return;
            }
        }

        // Nếu không có hóa đơn nào hợp lệ, mở modal chọn gói
        setIsPricingOpen(true);
    }, [user, currentOrder]);

    // --- PRO: Setup trial for new users ---
    // Trial 7 ngày tính từ ngày tạo tài khoản (user.created_at)
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
    }, [user?.id, appState.profile?.plan]);

    // Fetch Data từ Supabase khi user đăng nhập
    const fetchData = async (silent = false) => {
        if (!user) return;
        if (!silent) setIsLoadingData(true);
        try {
            function withTimeout<T>(promise: Promise<T>, timeoutMs = 8000): Promise<T> {
                return Promise.race([
                    promise,
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('Yêu cầu dữ liệu quá thời gian (Timeout)')), timeoutMs)
                    )
                ]);
            }

            // Gọi song song các bảng dữ liệu bao gồm wallets và debts
            const [txRes, goalRes, timeRes, todoRes, profileRes, eventsRes, budgetRes, gpaSemRes, gpaCourseRes, walletRes, debtRes] = await withTimeout(Promise.all([
                supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }),
                supabase.from('goals').select('*').eq('user_id', user.id).order('deadline', { ascending: true }),
                supabase.from('timetable').select('*').eq('user_id', user.id).order('start_time', { ascending: true }),
                supabase.from('todos').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
                supabase.from('profiles').select('*').eq('id', user.id).single(),
                supabase.from('calendar_events').select('*').eq('user_id', user.id),
                supabase.from('budgets').select('*').eq('user_id', user.id),
                supabase.from('gpa_semesters').select('*').eq('user_id', user.id).order('academic_year', { ascending: true }),
                supabase.from('gpa_courses').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
                supabase.from('wallets').select('*').eq('user_id', user.id),
                supabase.from('debts').select('*').eq('user_id', user.id),
            ]), 8000);

            if (txRes.error) throw txRes.error;

            // Cập nhật State
            setAppState((prev: AppState) => {
                const now = Date.now();
                const shouldSkipTodos = now - lastReorderTimeRef.current < 3000;
                return {
                    ...prev,
                    transactions: txRes.data.map(t => ({
                        id: t.id,
                        user_id: t.user_id,
                        amount: Number(t.amount),
                        category: t.category,
                        date: t.date,
                        type: t.type,
                        description: t.description || '',
                        created_at: t.created_at,
                        wallet_id: t.wallet_id || null,
                        debt_id: t.debt_id || null,
                    })),
                    goals: goalRes.data || [],
                    budgets: budgetRes.data || [],
                    timetable: timeRes.data || [],
                    todos: shouldSkipTodos ? prev.todos : (todoRes.data || []).map((t: any) => ({
                        ...t,
                        completed_at: t.completed_at || localStorage.getItem(`todo_completed_at_${t.id}`) || null
                    })),
                    profile: profileRes.data || null,
                    // GPA: Combine semesters with their courses
                    gpaSemesters: (gpaSemRes.data || []).map((sem: any) => ({
                        ...sem,
                        courses: (gpaCourseRes.data || []).filter((c: any) => c.semester_id === sem.id),
                    })),
                    gpaTargetCredits: Number(localStorage.getItem(`gpaTargetCredits_${user.id}`)) || 135,
                    gpaTargetGPA: localStorage.getItem(`gpaTargetGPA_${user.id}`) ? Number(localStorage.getItem(`gpaTargetGPA_${user.id}`)) : null,
                    gpaTargetSemesters: Number(localStorage.getItem(`gpaTargetSemesters_${user.id}`)) || 4,
                    wallets: walletRes.data || [],
                    debts: debtRes.data || [],
                };
            });

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
            lastFetchTimeRef.current = Date.now();

        } catch (error) {
            console.error('Lỗi tải dữ liệu:', error);
        } finally {
            if (!silent) setIsLoadingData(false);
        }
    };

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

        // Sync guest todos from localStorage to Supabase
        const guestTodosStr = localStorage.getItem('smartlife_guest_todos');
        if (guestTodosStr) {
            try {
                const guestTodos = JSON.parse(guestTodosStr);
                if (Array.isArray(guestTodos) && guestTodos.length > 0) {
                    const todosToInsert = guestTodos.map(todo => ({
                        user_id: user.id,
                        content: todo.content,
                        priority: todo.priority === 'focus' ? 'medium' : (['high', 'medium', 'low', 'urgent', 'chill', 'temp'].includes(todo.priority) ? todo.priority : 'medium'),
                        is_completed: todo.is_completed || false,
                        deadline: todo.deadline || null
                    }));

                    supabase.from('todos').insert(todosToInsert).then(({ error }) => {
                        if (error) {
                            console.error('[SmartLife] Error syncing guest todos:', error);
                        } else {
                            console.info('[SmartLife] ✅ Guest todos synced successfully');
                            localStorage.removeItem('smartlife_guest_todos');
                            fetchData(true);
                        }
                    });
                } else {
                    localStorage.removeItem('smartlife_guest_todos');
                }
            } catch (e) {
                console.error('[SmartLife] Error parsing guest todos:', e);
                localStorage.removeItem('smartlife_guest_todos');
            }
        }

        fetchData(false);
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id) return;
        const handleWindowFocus = () => {
            const now = Date.now();
            if (now - lastFetchTimeRef.current > 30000) {
                fetchData(true); // Quiet background refresh on focus
            }
        };
        window.addEventListener('focus', handleWindowFocus);
        return () => window.removeEventListener('focus', handleWindowFocus);
    }, [user?.id]);

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
            if (user?.id) checkHabitsFromDBAndNotify(user.id);
            checkTodosAndNotify(appState.todos);
        }, 60000);

        if (notificationsEnabled) {
            if (appState.timetable.length) checkAndNotify(appState.timetable);
            checkCalendarAndNotify();
            if (appState.goals.length) checkGoalsAndNotify(appState.goals);
            if (calendarEvents.length) checkCustomEventsAndNotify(calendarEvents);
            if (user?.id) checkHabitsFromDBAndNotify(user.id);
            checkTodosAndNotify(appState.todos);
        }

        return () => clearInterval(interval);
    }, [appState.timetable, appState.goals, calendarEvents, appState.todos]);

    // --- EMAIL NOTIFICATION FALLBACK LOOP ---
    useEffect(() => {
        if (!user || !appState.profile) return;

        const checkEmails = () => {
            checkAndSendEmailNotifications(
                appState.todos,
                appState.timetable,
                calendarEvents,
                appState.profile,
                lang
            );
        };

        // Run once on load
        checkEmails();

        const interval = setInterval(checkEmails, 60000);
        return () => clearInterval(interval);
    }, [appState.todos, appState.timetable, calendarEvents, appState.profile, lang, user]);

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

        // Cập nhật số dư ví trong local state & database nếu giao dịch có liên kết ví
        if (newTx.wallet_id) {
            const wallet = appState.wallets.find(w => w.id === newTx.wallet_id);
            if (wallet) {
                const balanceChange = newTx.type === 'income' ? newTx.amount : -newTx.amount;
                const updatedWallet = { ...wallet, balance: Number(wallet.balance) + balanceChange };

                setAppState(prev => ({
                    ...prev,
                    wallets: prev.wallets.map(w => w.id === wallet.id ? updatedWallet : w)
                }));

                supabase.from('wallets').update({ balance: updatedWallet.balance }).eq('id', wallet.id).then();
            }
        }

        try {
            const { data, error } = await supabase.from('transactions').insert([{
                user_id: user.id, ...newTx
            }]).select().single();

            if (error) throw error;
            if (data) {
                setAppState((prev: AppState) => ({
                    ...prev,
                    transactions: prev.transactions.map(t => t.id === tempId ? {
                        ...data,
                        amount: Number(data.amount),
                        wallet_id: data.wallet_id || null,
                        debt_id: data.debt_id || null
                    } : t)
                }));
            }
        } catch (error: any) {
            console.error('Lỗi thêm giao dịch:', error);
            alert(`Lỗi: ${error.message}`);
            // Rollback ví & giao dịch
            if (newTx.wallet_id) {
                const wallet = appState.wallets.find(w => w.id === newTx.wallet_id);
                if (wallet) {
                    const balanceChange = newTx.type === 'income' ? -newTx.amount : newTx.amount;
                    const revertedWallet = { ...wallet, balance: Number(wallet.balance) + balanceChange };
                    setAppState(prev => ({
                        ...prev,
                        wallets: prev.wallets.map(w => w.id === wallet.id ? revertedWallet : w)
                    }));
                    supabase.from('wallets').update({ balance: revertedWallet.balance }).eq('id', wallet.id).then();
                }
            }
            setAppState((prev: AppState) => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== tempId) }));
        }
    };

    const handleUpdateTransaction = async (updatedTx: Transaction) => {
        const previousTransactions = [...appState.transactions];
        const oldTx = appState.transactions.find(t => t.id === updatedTx.id);

        setAppState((prev: AppState) => ({ ...prev, transactions: prev.transactions.map(t => t.id === updatedTx.id ? updatedTx : t) }));

        // Cập nhật lại số dư của ví cũ và ví mới
        if (oldTx) {
            let walletsToUpdate = [...appState.wallets];
            let isChanged = false;

            if (oldTx.wallet_id) {
                const oldWallet = walletsToUpdate.find(w => w.id === oldTx.wallet_id);
                if (oldWallet) {
                    const oldBalanceChange = oldTx.type === 'income' ? -oldTx.amount : oldTx.amount;
                    oldWallet.balance = Number(oldWallet.balance) + oldBalanceChange;
                    isChanged = true;
                }
            }

            if (updatedTx.wallet_id) {
                const newWallet = walletsToUpdate.find(w => w.id === updatedTx.wallet_id);
                if (newWallet) {
                    const newBalanceChange = updatedTx.type === 'income' ? updatedTx.amount : -updatedTx.amount;
                    newWallet.balance = Number(newWallet.balance) + newBalanceChange;
                    isChanged = true;
                }
            }

            if (isChanged) {
                setAppState(prev => ({ ...prev, wallets: walletsToUpdate }));

                const updatePromises = [];
                if (oldTx.wallet_id) {
                    const oldW = walletsToUpdate.find(w => w.id === oldTx.wallet_id);
                    if (oldW) updatePromises.push(supabase.from('wallets').update({ balance: oldW.balance }).eq('id', oldW.id));
                }
                if (updatedTx.wallet_id && updatedTx.wallet_id !== oldTx.wallet_id) {
                    const newW = walletsToUpdate.find(w => w.id === updatedTx.wallet_id);
                    if (newW) updatePromises.push(supabase.from('wallets').update({ balance: newW.balance }).eq('id', newW.id));
                }
                Promise.all(updatePromises).then();
            }
        }

        try {
            const { error } = await supabase.from('transactions').update({
                amount: updatedTx.amount,
                category: updatedTx.category,
                date: updatedTx.date,
                type: updatedTx.type,
                description: updatedTx.description,
                wallet_id: updatedTx.wallet_id || null,
                debt_id: updatedTx.debt_id || null
            }).eq('id', updatedTx.id);
            if (error) throw error;
        } catch (error: any) {
            alert(`Lỗi cập nhật: ${error.message}`);
            setAppState((prev: AppState) => ({ ...prev, transactions: previousTransactions }));
            // Reload lại để phục hồi đúng số dư ví từ DB
            fetchData(true);
        }
    };

    const handleDeleteTransaction = async (id: string) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa?')) return;
        const previousTransactions = [...appState.transactions];
        const txToDelete = appState.transactions.find(t => t.id === id);

        setAppState((prev: AppState) => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) }));

        // Hoàn tác số dư ví
        if (txToDelete && txToDelete.wallet_id) {
            const wallet = appState.wallets.find(w => w.id === txToDelete.wallet_id);
            if (wallet) {
                const balanceChange = txToDelete.type === 'income' ? -txToDelete.amount : txToDelete.amount;
                const updatedWallet = { ...wallet, balance: Number(wallet.balance) + balanceChange };

                setAppState(prev => ({
                    ...prev,
                    wallets: prev.wallets.map(w => w.id === wallet.id ? updatedWallet : w)
                }));

                supabase.from('wallets').update({ balance: updatedWallet.balance }).eq('id', wallet.id).then();
            }
        }

        try {
            const { error } = await supabase.from('transactions').delete().eq('id', id);
            if (error) throw error;
        } catch (error) {
            alert('Lỗi xóa giao dịch.');
            setAppState((prev: AppState) => ({ ...prev, transactions: previousTransactions }));
            fetchData(true);
        }
    };

    // --- WALLET & DEBT CALLBACKS ---
    const handleAddWallet = async (newWallet: Omit<Wallet, 'id' | 'user_id' | 'created_at'>) => {
        if (!user) return;
        const result = await walletService.createWallet(user.id, newWallet);
        if (result) {
            setAppState(prev => ({ ...prev, wallets: [...prev.wallets, result] }));
        }
    };

    const handleUpdateWallet = async (updatedWallet: Wallet) => {
        const result = await walletService.updateWallet(updatedWallet);
        if (result) {
            setAppState(prev => ({
                ...prev,
                wallets: prev.wallets.map(w => w.id === updatedWallet.id ? result : w)
            }));
        }
    };

    const handleDeleteWallet = async (id: string) => {
        if (!window.confirm('Bạn có chắc muốn xóa ví này? Tất cả giao dịch liên kết sẽ mất liên kết với ví.')) return;
        const success = await walletService.deleteWallet(id);
        if (success) {
            setAppState(prev => ({
                ...prev,
                wallets: prev.wallets.filter(w => w.id !== id),
                transactions: prev.transactions.map(t => t.wallet_id === id ? { ...t, wallet_id: null } : t)
            }));
        }
    };

    const handleTransferMoney = async (fromWalletId: string, toWalletId: string, amount: number, note?: string) => {
        if (!user) return;
        const success = await walletService.transferMoney(user.id, fromWalletId, toWalletId, amount, note);
        if (success) {
            await fetchData(true); // Tải lại toàn bộ dữ liệu để cập nhật số dư & giao dịch chuyển tiền
        }
    };

    const handleAddDebt = async (newDebt: Omit<Debt, 'id' | 'user_id' | 'created_at'>) => {
        if (!user) return;
        const result = await debtService.createDebt(user.id, newDebt);
        if (result) {
            setAppState(prev => ({ ...prev, debts: [result, ...prev.debts] }));

            // Nếu có liên kết với ví, tạo giao dịch chi tiêu/thu nhập tương ứng để khấu trừ ví
            if (newDebt.wallet_id) {
                const isLend = newDebt.type === 'lend';
                const txCategory = isLend ? 'Cho vay 💸' : 'Đi vay 💰';
                const txType = isLend ? TransactionType.EXPENSE : TransactionType.INCOME;
                const txDesc = isLend
                    ? `Cho vay: ${newDebt.partner_name} (${newDebt.description || 'Giải ngân'})`
                    : `Đi vay từ: ${newDebt.partner_name} (${newDebt.description || 'Giải ngân'})`;

                await handleAddTransaction({
                    amount: newDebt.amount,
                    category: txCategory,
                    date: newDebt.date_lent,
                    type: txType,
                    description: txDesc,
                    wallet_id: newDebt.wallet_id,
                    debt_id: result.id
                });
            } else {
                await fetchData(true);
            }
        }
    };

    const handleDeleteDebt = async (id: string) => {
        if (!window.confirm('Bạn có chắc muốn xóa khoản nợ này? Lịch sử trả nợ liên quan cũng sẽ bị xóa.')) return;
        const success = await debtService.deleteDebt(id);
        if (success) {
            setAppState(prev => ({
                ...prev,
                debts: prev.debts.filter(d => d.id !== id),
                transactions: prev.transactions.map(t => t.debt_id === id ? { ...t, debt_id: null } : t)
            }));
            await fetchData(true);
        }
    };

    const handleRepayDebt = async (debtId: string, amount: number, date: string, walletId?: string | null, note?: string) => {
        if (!user) return;
        const { repayment, updatedDebt } = await debtService.repayDebt(user.id, debtId, amount, date, walletId, note);
        if (updatedDebt) {
            await fetchData(true);
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
        if (!window.confirm("Bạn có chắc chắn muốn xóa lịch này không?")) return;
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

    const handleAddCalendarEvent = async (event: any) => {
        setCalendarEvents((prev) => {
            if (prev.some(e => e.id === event.id)) return prev;
            return [...prev, event];
        });
    };

    const handleUpdateCalendarEvent = async (event: any) => {
        setCalendarEvents((prev) => prev.map(e => e.id === event.id ? event : e));
    };

    const handleDeleteCalendarEvent = async (id: string) => {
        setCalendarEvents((prev) => prev.filter(e => e.id !== id));
    };

    const handleAddTodo = async (content: string, priority: any, deadline?: string, status: TodoStatus = 'todo', description?: string, subtasks?: any[], emailNotify?: boolean, emailNotifyBeforeMinutes?: number) => {
        if (!user) return;
        const tempId = crypto.randomUUID();
        // New todos get sort_order = 0 (top), existing items shift up
        const minOrder = appState.todos.length > 0 ? Math.min(...appState.todos.map(t => t.sort_order ?? 0)) : 0;
        const newSortOrder = minOrder - 1;
        const newItem = { id: tempId, content, priority, is_completed: status === 'done', status, user_id: user.id, deadline, sort_order: newSortOrder, description, subtasks, email_notify: emailNotify, email_notify_before_minutes: emailNotifyBeforeMinutes };

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
            const insertPayload: any = {
                content, priority: dbPriority, is_completed: status === 'done', status, user_id: user.id, deadline, sort_order: newSortOrder,
                description, subtasks,
                email_notify: emailNotify,
                email_notify_before_minutes: emailNotifyBeforeMinutes
            };
            let data = null;
            let error = null;

            const res = await supabase.from('todos').insert([insertPayload]).select().single();
            data = res.data;
            error = res.error;

            if (error) {
                if (error.code === '42703') {
                    console.warn("[SmartLife] description/subtasks/email columns not found. Retrying insertion without them.");
                    const fallbackPayload = {
                        content, priority: dbPriority, is_completed: status === 'done', status, user_id: user.id, deadline, sort_order: newSortOrder
                    };
                    const fallbackRes = await supabase.from('todos').insert([fallbackPayload]).select().single();
                    data = fallbackRes.data;
                    error = fallbackRes.error;
                }
                if (error) throw error;
            }

            if (data) {
                setAppState((prev: AppState) => ({
                    ...prev,
                    todos: prev.todos.map(t => t.id === tempId ? { ...t, ...data } : t)
                }));
            }
        } catch (error: any) {
            console.error(error);
            alert("Lỗi thêm việc: " + error.message);
            setAppState((prev: AppState) => ({ ...prev, todos: prev.todos.filter(t => t.id !== tempId) }));
        }
    };

    const handleUpdateTodo = React.useCallback(async (item: any) => {
        let prevTodos: Todo[] = [];

        let updatedItem = { ...item };

        // Use setAppState to safely read current todos and apply the update atomically
        setAppState((prev: AppState) => {
            prevTodos = prev.todos;
            const existingTodo = prev.todos.find(t => t.id === item.id);
            const wasAlreadyDone = existingTodo && (existingTodo.status === 'done' || existingTodo.is_completed);

            if (item.status !== undefined) {
                updatedItem.is_completed = item.status === 'done';
                if (item.status === 'done') {
                    const ts = (wasAlreadyDone && existingTodo?.completed_at) || new Date().toISOString();
                    updatedItem.completed_at = ts;
                    localStorage.setItem(`todo_completed_at_${item.id}`, ts);
                } else {
                    updatedItem.completed_at = null;
                    localStorage.removeItem(`todo_completed_at_${item.id}`);
                }
            } else if (item.is_completed !== undefined) {
                updatedItem.status = item.is_completed ? 'done' : 'todo';
                if (item.is_completed) {
                    const ts = (wasAlreadyDone && existingTodo?.completed_at) || new Date().toISOString();
                    updatedItem.completed_at = ts;
                    localStorage.setItem(`todo_completed_at_${item.id}`, ts);
                } else {
                    updatedItem.completed_at = null;
                    localStorage.removeItem(`todo_completed_at_${item.id}`);
                }
            }

            return { ...prev, todos: prev.todos.map(t => t.id === item.id ? { ...t, ...updatedItem } : t) };
        });

        try {
            // Only send DB-safe fields
            const { id, user_id, created_at, ...updateFields } = updatedItem;
            if (!isCompletedAtSupportedRef.current) {
                delete updateFields.completed_at;
            }
            const { error } = await supabase.from('todos').update(updateFields).eq('id', item.id);
            if (error) {
                if (error.code === '42703') {
                    console.warn("[SmartLife] Column error. Retrying update with only core fields (omitting completed_at).");
                    isCompletedAtSupportedRef.current = false;
                    const safeFields: any = {};
                    const allowed = ['content', 'is_completed', 'status', 'priority', 'deadline', 'sort_order'];
                    allowed.forEach(k => {
                        if (k in updateFields) safeFields[k] = (updateFields as any)[k];
                    });
                    const { error: retryError } = await supabase.from('todos').update(safeFields).eq('id', item.id);
                    if (retryError) throw retryError;
                } else {
                    throw error;
                }
            }
        } catch (error: any) {
            console.error(error);
            alert("Lỗi cập nhật việc: " + error.message);
            setAppState((prev: AppState) => ({ ...prev, todos: prevTodos }));
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleMoveTodoStatus = React.useCallback(async (id: string, status: TodoStatus) => {
        lastReorderTimeRef.current = Date.now();
        await handleUpdateTodo({ id, status });
    }, [handleUpdateTodo]);

    const handleDeleteTodo = async (id: string) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa công việc này không?")) return;
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

    // Batch reorder todos after drag-drop (optimistic + persist)
    const handleReorderTodos = React.useCallback(async (reorderedTodos: Todo[]) => {
        lastReorderTimeRef.current = Date.now();

        // Capture prevTodos via ref-safe approach (read current state snapshot)
        let prevTodos: Todo[] = [];
        setAppState((prev: AppState) => {
            prevTodos = prev.todos;
            return prev; // no-op, just capture
        });

        // Assign fresh sort_order based on array position
        const withOrder = reorderedTodos.map((t, idx) => {
            const nextTodo = { ...t, sort_order: idx };
            const existingTodo = prevTodos.find(prevTodo => prevTodo.id === t.id);
            const wasAlreadyDone = existingTodo && (existingTodo.status === 'done' || existingTodo.is_completed);

            if (nextTodo.status === 'done') {
                if (!nextTodo.completed_at) {
                    nextTodo.completed_at = (wasAlreadyDone && existingTodo?.completed_at) || new Date().toISOString();
                }
                localStorage.setItem(`todo_completed_at_${nextTodo.id}`, nextTodo.completed_at);
            } else {
                nextTodo.completed_at = null;
                localStorage.removeItem(`todo_completed_at_${nextTodo.id}`);
            }
            return nextTodo;
        });

        setAppState((prev: AppState) => ({ ...prev, todos: withOrder }));

        // Only update todos that actually changed in DB to minimize request count and avoid rate limits
        const prevTodosMap = new Map(prevTodos.map(t => [t.id, t]));
        const changedTodos = withOrder.filter(t => {
            const prev = prevTodosMap.get(t.id);
            if (!prev) return true;
            return (
                prev.sort_order !== t.sort_order ||
                (prev.status || (prev.is_completed ? 'done' : 'todo')) !== (t.status || (t.is_completed ? 'done' : 'todo')) ||
                prev.is_completed !== t.is_completed ||
                prev.completed_at !== t.completed_at
            );
        });

        if (changedTodos.length === 0) return;

        try {
            // Batch update sort_order, status, is_completed, and completed_at for each changed item
            const updates = changedTodos.map(t => {
                const updateFields: any = {
                    sort_order: t.sort_order,
                    status: t.status || (t.is_completed ? 'done' : 'todo'),
                    is_completed: t.status === 'done',
                };
                if (isCompletedAtSupportedRef.current) {
                    updateFields.completed_at = t.completed_at;
                }
                return supabase.from('todos').update(updateFields).eq('id', t.id);
            });
            const results = await Promise.all(updates);
            const failed = results.find(r => r.error);
            if (failed?.error) {
                if (failed.error.code === '42703') {
                    console.warn("[SmartLife] Column error during reorder. Retrying without completed_at.");
                    isCompletedAtSupportedRef.current = false;
                    const retryUpdates = changedTodos.map(t =>
                        supabase.from('todos').update({
                            sort_order: t.sort_order,
                            status: t.status || (t.is_completed ? 'done' : 'todo'),
                            is_completed: t.status === 'done',
                        }).eq('id', t.id)
                    );
                    const retryResults = await Promise.all(retryUpdates);
                    const retryFailed = retryResults.find(r => r.error);
                    if (retryFailed?.error) throw retryFailed.error;
                } else {
                    throw failed.error;
                }
            }
        } catch (error: any) {
            console.error('Reorder failed:', error);
            alert("Lỗi sắp xếp việc: " + error.message);
            setAppState((prev: AppState) => ({ ...prev, todos: prevTodos }));
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        if (!window.confirm("Bạn có chắc chắn muốn xóa học kỳ này không? Tất cả môn học thuộc học kỳ cũng sẽ bị xóa.")) return;
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

    const handleUpdateGPATarget = (targetGPA: number | null, targetSemesters: number) => {
        if (!user) return;
        setAppState(prev => ({ ...prev, gpaTargetGPA: targetGPA, gpaTargetSemesters: targetSemesters }));
        if (targetGPA != null) {
            localStorage.setItem(`gpaTargetGPA_${user.id}`, targetGPA.toString());
        } else {
            localStorage.removeItem(`gpaTargetGPA_${user.id}`);
        }
        localStorage.setItem(`gpaTargetSemesters_${user.id}`, targetSemesters.toString());
    };

    const handleDeleteGPACourse = async (id: string) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa môn học này không?")) return;
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
        <div className="h-[100dvh] w-screen overflow-hidden bg-background font-sans text-foreground flex flex-col md:flex-row">
            {/* Sidebar Desktop */}
            <aside
                onMouseEnter={() => setIsSidebarCollapsed(false)}
                onMouseLeave={() => setIsSidebarCollapsed(true)}
                className={`hidden md:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-card border-r border-border fixed h-full z-20 ${isSidebarCollapsed ? 'shadow-sm' : 'shadow-lg'} transition-all duration-300 ease-in-out`}
            >
                <div className={`pt-6 pb-4 flex items-center ${isSidebarCollapsed ? 'px-4 justify-center' : 'px-6 justify-between'} gap-3 relative`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-indigo-100/10 border border-border shrink-0">
                            <img src="/pwa-192x192.png" alt="SmartLife" className="w-full h-full object-cover" />
                        </div>
                        {!isSidebarCollapsed && <h1 className="text-xl font-bold text-foreground tracking-tight whitespace-nowrap">SmartLife</h1>}
                    </div>

                    {/* Toggle Button */}
                    <button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className={`absolute -right-3 top-8 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 shadow-sm transition-all z-30`}
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

                <nav className="flex-1 overflow-y-auto overflow-x-hidden px-4 space-y-2 mt-2 scrollbar-thin">
                    {/* Language Toggle Desktop */}
                    <button onClick={() => setLang(lang === 'vi' ? 'en' : lang === 'en' ? 'ko' : 'vi')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} px-4 py-3.5 rounded-xl transition-all font-medium text-sm text-gray-500 hover:bg-gray-50 cursor-pointer border border-dashed border-gray-200 mb-2`}>
                        <div className="flex items-center gap-3">
                            <span title={t('sidebar.language', lang)}>🌐</span>
                            {!isSidebarCollapsed && <span>{t('sidebar.language', lang)}</span>}
                        </div>
                        {!isSidebarCollapsed && <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-xs">{lang === 'vi' ? '🇻🇳 VI' : lang === 'en' ? '🇺🇸 EN' : '🇰🇷 KO'}</span>}
                    </button>

                    <button onClick={() => setActiveTab('visual')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${activeTab === 'visual' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`} title={isSidebarCollapsed ? t('tab.overview', lang) : ''}>
                        <LayoutDashboard size={20} className="shrink-0" /> {!isSidebarCollapsed && <span className="whitespace-nowrap">{t('tab.overview', lang)}</span>}
                    </button>
                    <button onClick={() => setActiveTab('finance')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${activeTab === 'finance' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`} title={isSidebarCollapsed ? t('tab.finance', lang) : ''}>
                        <WalletIcon size={20} className="shrink-0" /> {!isSidebarCollapsed && <span className="whitespace-nowrap">{t('tab.finance', lang)}</span>}
                    </button>
                    <button onClick={() => setActiveTab('schedule')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${activeTab === 'schedule' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`} title={isSidebarCollapsed ? t('tab.schedule_goals', lang) : ''}>
                        <CalendarDays size={20} className="shrink-0" /> {!isSidebarCollapsed && <span className="whitespace-nowrap">{t('tab.schedule_goals', lang)}</span>}
                    </button>
                    <button onClick={() => setActiveTab('habit')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${activeTab === 'habit' ? 'bg-orange-50 text-orange-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`} title={isSidebarCollapsed ? t('tab.habit', lang) : ''}>
                        <Flame size={20} className="shrink-0" /> {!isSidebarCollapsed && <span className="whitespace-nowrap">{t('tab.habit', lang)}</span>}
                    </button>
                    <button onClick={() => setActiveTab('journal')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${activeTab === 'journal' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`} title={isSidebarCollapsed ? t('tab.journal', lang) : ''}>
                        <BookOpen size={20} className="shrink-0" /> {!isSidebarCollapsed && <span className="whitespace-nowrap">{t('tab.journal', lang)}</span>}
                        {!proAccess.hasAccess && !isSidebarCollapsed && <span className="ml-auto text-[9px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-bold">PRO</span>}
                    </button>
                    <button onClick={() => setActiveTab('gpa')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${activeTab === 'gpa' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`} title={isSidebarCollapsed ? 'GPA' : ''}>
                        <GraduationCap size={20} className="shrink-0" /> {!isSidebarCollapsed && <span className="whitespace-nowrap">GPA</span>}
                    </button>
                    <button onClick={() => setActiveTab('goals')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${activeTab === 'goals' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`} title={isSidebarCollapsed ? 'Mục tiêu' : ''}>
                        <Target size={20} className="shrink-0" /> {!isSidebarCollapsed && <span className="whitespace-nowrap">Mục tiêu</span>}
                    </button>

                    {/* Admin Panel Toggle */}
                    {user?.email === 'baquan3q@gmail.com' && (
                        <button onClick={() => setActiveTab('admin')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3.5 rounded-xl transition-all font-bold text-sm ${activeTab === 'admin' ? 'bg-red-50 text-red-600' : 'text-gray-500 hover:bg-gray-50 hover:text-red-500'}`} title={isSidebarCollapsed ? 'Admin Panel' : ''}>
                            <ShieldAlert size={20} className="shrink-0" /> {!isSidebarCollapsed && <span className="whitespace-nowrap">Admin Panel</span>}
                        </button>
                    )}

                    {/* Pro Upgrade Button */}
                    {!proAccess.isProActive && !proAccess.isLifetime && (
                        <button onClick={handleOpenPricing} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3.5 rounded-xl transition-all font-semibold text-sm bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 hover:from-indigo-100 hover:to-purple-100 border border-indigo-100`} title={isSidebarCollapsed ? t('sidebar.upgrade_pro', lang) : ''}>
                            <Crown size={20} className="shrink-0 text-yellow-500" /> {!isSidebarCollapsed && <span className="whitespace-nowrap">{t('sidebar.upgrade_pro', lang)}</span>}
                        </button>
                    )}

                </nav>

                {/* Pro Status Badge */}
                {!isSidebarCollapsed && (
                    <div className="px-4 py-2">
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${proAccess.badgeColor === 'green' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                proAccess.badgeColor === 'yellow' ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' :
                                    proAccess.badgeColor === 'red' ? 'bg-red-50 text-red-600 border border-red-100' :
                                        'bg-gray-50 text-gray-500 border border-gray-100'
                            }`}>
                            <span className={`w-2 h-2 rounded-full ${proAccess.badgeColor === 'green' ? 'bg-emerald-500' :
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
                    <button onClick={() => setIsSpotifyOpen(true)} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-xl text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-all font-bold text-sm`} title={isSidebarCollapsed ? 'My Spotify' : ''}>
                        <Music size={20} className="shrink-0" /> {!isSidebarCollapsed && <span className="whitespace-nowrap">My Spotify</span>}
                    </button>
                    <button onClick={() => setIsSettingsOpen(true)} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-xl text-gray-500 hover:text-indigo-600 hover:bg-gray-50 transition-all font-medium text-sm`} title={isSidebarCollapsed ? 'Cài đặt' : ''}>
                        <Settings size={20} className="shrink-0" /> {!isSidebarCollapsed && <span className="whitespace-nowrap">Cài đặt</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={`flex-1 md:ml-20 h-full overflow-y-auto scrollbar-hide relative bg-background transition-all duration-300 ease-in-out ${activeTab === 'ai-advisor' ? 'pb-0' : 'pb-28 md:pb-8'}`}>
                {activeTab !== 'ai-advisor' && <header className="md:hidden fixed top-0 left-0 right-0 bg-card/95 backdrop-blur-md shadow-sm border-b border-border z-30 transition-all h-16">
                    <div className="flex items-center justify-between px-4 h-full">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg overflow-hidden border border-border">
                                <img src="/pwa-192x192.png" alt="SmartLife" className="w-full h-full object-cover" />
                            </div>
                            <span className="font-bold text-gray-800 text-lg tracking-tight hidden sm:block">SmartLife</span>
                        </div>
                        <div className="flex gap-2 items-center">
                            {/* Habit Shortcut — toggleable in Settings */}
                            {headerShortcuts.habit && (
                                <button onClick={() => setActiveTab('habit')} className={`p-2 rounded-full transition-all ${activeTab === 'habit' ? 'text-orange-600 bg-orange-100' : 'text-orange-500 bg-orange-50 hover:bg-orange-100'}`} title="Thói quen">
                                    <Flame size={20} />
                                </button>
                            )}
                            {/* Spotify Shortcut — toggleable in Settings */}
                            {headerShortcuts.spotify && (
                                <button onClick={() => setIsSpotifyOpen(true)} className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-full transition-colors" title="My Spotify">
                                    <Music size={20} />
                                </button>
                            )}
                            {/* Admin Panel — always visible for admin */}
                            {user?.email === 'baquan3q@gmail.com' && (
                                <button onClick={() => setActiveTab('admin')} className={`p-2 rounded-full transition-colors ${activeTab === 'admin' ? 'text-red-600 bg-red-50' : 'text-red-500 hover:bg-red-50'}`} title="Admin Panel">
                                    <ShieldAlert size={20} />
                                </button>
                            )}
                            {/* Pro Upgrade */}
                            {!proAccess.isProActive && !proAccess.isLifetime && (
                                <button onClick={handleOpenPricing} className="relative p-2 rounded-full hover:bg-yellow-50 transition-colors" title="Nâng cấp Pro">
                                    <Crown size={20} className="text-yellow-500" fill="currentColor" />
                                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-white" />
                                </button>
                            )}
                            {/* Settings — always visible */}
                            <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors" title="Cài đặt">
                                <Settings size={20} />
                            </button>
                        </div>
                    </div>
                </header>}

                <div className={`${activeTab === 'ai-advisor' ? 'h-full' : 'w-full max-w-none min-h-screen px-1 md:px-2.5 py-3 md:py-5 pt-16 md:pt-4 relative'}`}> {/* AI Advisor gets full screen, others get dynamic fluid layout */}
                    {deferredTab === 'visual' && (
                        <VisualBoard appState={{ ...appState, calendarEvents }} userName={user?.user_metadata?.full_name || appState.profile?.full_name} userId={user?.id} userEmail={user?.email || undefined} onUpdateGoal={handleUpdateGoal} onUpgrade={handleOpenPricing} onOpenSpotify={() => setIsSpotifyOpen(true)} onNavigate={(tab) => {
                            if (tab === 'music') {
                                setStartInFocusMode(true);
                                setActiveTab('schedule');
                            } else if (tab === 'gpa-career') {
                                setGpaInitialView('career');
                                setActiveTab('gpa');
                            } else if (tab === 'goals-cv') {
                                setGoalsInitialView('cv');
                                setActiveTab('goals');
                            } else {
                                setActiveTab(tab as any);
                            }
                        }} onRefresh={async () => { await fetchData(true); }} />
                    )}
                    {deferredTab === 'finance' && (
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
                            onRefresh={async () => { await fetchData(true); }}
                            onAddWallet={handleAddWallet}
                            onUpdateWallet={handleUpdateWallet}
                            onDeleteWallet={handleDeleteWallet}
                            onTransferMoney={handleTransferMoney}
                            onAddDebt={handleAddDebt}
                            onDeleteDebt={handleDeleteDebt}
                            onRepayDebt={handleRepayDebt}
                        />
                    )}
                    {deferredTab === 'cashflow' && (
                        <CashFlowDashboard
                            state={appState}
                            lang={lang}
                            onBack={() => setActiveTab('finance')}
                        />
                    )}
                    {deferredTab === 'ai-advisor' && (
                        <AIAdvisorPage
                            appState={{ ...appState, calendarEvents }}
                            lang={lang}
                            onBack={() => setActiveTab('finance')}
                            onAddTimetable={handleAddTimetable}
                            onAddTodo={handleAddTodo}
                            onAddTransaction={handleAddTransaction}
                            onImportGPAData={handleImportGPAData}
                            onSelectBoostPack={handleSelectPlan}
                            onUpdateTodo={handleUpdateTodo}
                            onDeleteTodo={handleDeleteTodo}
                            onAddCalendarEvent={handleAddCalendarEvent}
                            onUpdateCalendarEvent={handleUpdateCalendarEvent}
                            onDeleteCalendarEvent={handleDeleteCalendarEvent}
                        />
                    )}
                    {deferredTab === 'admin' && user?.email === 'baquan3q@gmail.com' && (
                        <AdminDashboard adminEmail={user.email} adminId={user.id} />
                    )}
                    {deferredTab === 'schedule' && (
                        <ScheduleDashboard
                            state={{ ...appState, todos: filteredTodos, calendarEvents, timer, onOpenMusic: () => setActiveTab('music') } as any}
                            onAddGoal={handleAddGoal} onUpdateGoal={handleUpdateGoal} onDeleteGoal={handleDeleteGoal}
                            onAddTimetable={handleAddTimetable} onUpdateTimetable={handleUpdateTimetable} onDeleteTimetable={handleDeleteTimetable}
                            onAddTodo={handleAddTodo} onUpdateTodo={handleUpdateTodo} onDeleteTodo={handleDeleteTodo} onReorderTodos={handleReorderTodos}
                            onMoveTodoStatus={handleMoveTodoStatus}
                            initialFocusMode={startInFocusMode}
                            onResetFocusMode={handleResetFocusMode}
                            activeTaskId={taskTracker.activeTask?.id || null}
                            onStartTracking={taskTracker.startTracking}
                            onRefresh={async () => { await fetchData(true); }}
                        />
                    )}
                    {deferredTab === 'gpa' && (
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
                            targetGPA={appState.gpaTargetGPA}
                            targetSemesters={appState.gpaTargetSemesters}
                            onUpdateGPATarget={handleUpdateGPATarget}
                            isLoading={isLoadingData}
                            lang={lang}
                            userId={user?.id || ''}
                            initialViewMode={gpaInitialView}
                            onResetInitialView={() => setGpaInitialView(null)}
                            onCreatePosition={async (domain) => {
                                if (user?.id) {
                                    await careerGoalService.addPosition(user.id, domain);
                                    setActiveTab('goals');
                                }
                            }}
                            isPro={proAccess.hasAccess}
                            onUpgrade={handleOpenPricing}
                        />
                    )}
                    {deferredTab === 'goals' && (
                        <GoalsDashboard
                            userId={user?.id || ''}
                            isPro={proAccess.hasAccess}
                            onUpgrade={handleOpenPricing}
                            onNavigateToGPACareer={() => {
                                setGpaInitialView('career');
                                setActiveTab('gpa');
                            }}
                            initialViewMode={goalsInitialView}
                            onResetInitialView={() => setGoalsInitialView(null)}
                        />
                    )}
                    {deferredTab === 'habit' && (
                        <HabitDashboard
                            userId={user?.id || ''}
                            onNavigateToSchedule={() => setActiveTab('schedule')}
                            isPro={proAccess.hasAccess}
                            onUpgrade={handleOpenPricing}
                        />
                    )}
                    {deferredTab === 'journal' && (
                        proAccess.hasAccess ? (
                            <JournalDashboard userId={user?.id || ''} />
                        ) : (
                            <ProGateOverlay featureName="Nhật ký cá nhân" onUpgrade={handleOpenPricing} isGracePeriod={proAccess.isInGracePeriod} />
                        )
                    )}
                    {deferredTab === 'expand' && (
                        <ExpandSection
                            userId={user?.id || ''}
                            profile={appState.profile}
                            onNavigate={(tab) => {
                                if (tab === 'music') {
                                    setStartInFocusMode(true);
                                    setActiveTab('schedule');
                                } else {
                                    setActiveTab(tab as any);
                                }
                            }}
                            onOpenSettings={() => setIsSettingsOpen(true)}
                            onOpenSpotify={() => setIsSpotifyOpen(true)}
                            onRefreshProfile={async () => { await fetchData(true); }}
                        />
                    )}
                </div>
            </main>


            {/* Mobile Bottom Nav — Fixed 4 items */}
            {activeTab !== 'ai-advisor' && (
                <div className="md:hidden fixed bottom-safe-dock left-6 right-6 z-50 max-w-lg mx-auto transform-gpu">
                    <nav className="bg-card/90 backdrop-blur-xl border border-border flex justify-between items-center rounded-full h-[68px] shadow-[0_10px_35px_rgba(56,189,248,0.15)] px-3 py-1.5">
                        {MOBILE_NAV_TABS.map(tab => {
                            const IconComponent = tab.icon;
                            const isActive = activeTab === tab.id;
                            const activeColorClass = tab.color;
                            const activeBgClass = tab.bg;
                            const label = lang === 'vi' ? tab.labelVi : lang === 'en' ? tab.labelEn : tab.labelKo;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => { setActiveTab(tab.id as any); }}
                                    className={`flex items-center justify-center rounded-full h-12 shrink-0 transition-all duration-300 cubic-bezier(0.34, 1.56, 0.64, 1) active:scale-95 ${isActive
                                            ? `px-5 py-2.5 ${activeBgClass} ${activeColorClass} shadow-sm shadow-indigo-100/10`
                                            : 'px-3 py-2 text-gray-400 active:text-gray-600 active:bg-gray-50/20'
                                        }`}
                                >
                                    <IconComponent size={22} strokeWidth={isActive ? 2.5 : 2} className={`shrink-0 transition-transform duration-300 cubic-bezier(0.34, 1.56, 0.64, 1) ${isActive && tab.id === 'expand' ? 'rotate-90' : ''}`} />
                                    <span
                                        className={`text-[12px] font-bold tracking-tight transition-all duration-300 cubic-bezier(0.34, 1.56, 0.64, 1) overflow-hidden whitespace-nowrap ${isActive ? 'max-w-[100px] opacity-100 ml-2.5' : 'max-w-0 opacity-0 ml-0'
                                            }`}
                                    >
                                        {label}
                                    </span>
                                </button>
                            );
                        })}
                    </nav>
                </div>
            )}
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                userId={user?.id || ''}
                onSignOut={signOut}
                notificationsEnabled={notificationsEnabled}
                toggleNotifications={toggleNotifications}
                lang={lang}
                setLang={setLang}
                headerShortcuts={headerShortcuts}
                onUpdateHeaderShortcuts={setHeaderShortcuts}
            />
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
            <WelcomeTourModal
                isOpen={isWelcomeTourOpen}
                onClose={() => setIsWelcomeTourOpen(false)}
            />
            <MySpotify isOpen={isSpotifyOpen} onClose={() => setIsSpotifyOpen(false)} userId={user?.id || ''} />
            <PWAInstallPrompt />
            {unreadNotifications.length > 0 && user && (
                <NotificationPopupModal
                    userId={user.id}
                    notifications={unreadNotifications}
                    onClose={() => setUnreadNotifications([])}
                />
            )}

            <ActiveTaskWidget
                activeTask={taskTracker.activeTask}
                status={taskTracker.status}
                elapsedTime={taskTracker.elapsedTime}
                isTracking={taskTracker.isTracking}
                pauseTracking={taskTracker.pauseTracking}
                resumeTracking={taskTracker.resumeTracking}
                completeTracking={taskTracker.completeTracking}
                cancelTracking={taskTracker.cancelTracking}
            />

            <ActiveFocusWidget
                timer={timer}
                activeTab={activeTab}
            />

            {/* Global Lottie Overlay when data is initially loading */}
            {isLoadingData && <GlobalLoader />}
        </div >
    );
};

import LandingPage from './components/LandingPage';
import FeaturesPage from './components/FeaturesPage';
import PricingPage from './components/PricingPage';
import ContactPage from './components/ContactPage';

const AppWrapper: React.FC = () => {
    useTheme();
    const { user, loading } = useAuth();
    const [showLogin, setShowLogin] = useState(false);
    const [lang, setLang] = useState<Lang>(() => {
        const saved = localStorage.getItem('smartlife_lang');
        return (saved === 'vi' || saved === 'en' || saved === 'ko') ? saved : 'vi';
    });

    const [hash, setHash] = useState(window.location.hash);
    const timer = useFocusTimer();

    useEffect(() => {
        const handleHashChange = () => {
            setHash(window.location.hash);
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const isLocked = !!user || hash === '#/focus' || hash === '#/study';

    useEffect(() => {
        if (isLocked) {
            document.documentElement.classList.add('authenticated-app');
        } else {
            document.documentElement.classList.remove('authenticated-app');
        }
        return () => {
            document.documentElement.classList.remove('authenticated-app');
        };
    }, [isLocked]);

    useEffect(() => {
        localStorage.setItem('smartlife_lang', lang);
    }, [lang]);

    const formatTime = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        }
        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    if (loading) return <GlobalLoader />;

    if (hash === '#/focus' || hash === '#/study') {
        return (
            <MusicSpace
                timer={timer}
                onBack={() => { window.location.hash = ''; }}
                formatTime={formatTime}
                isStandalone={true}
                onLoginRedirect={() => {
                    setShowLogin(true);
                    window.location.hash = '';
                }}
            />
        );
    }

    if (user) return <AuthenticatedApp lang={lang} setLang={setLang} />;

    if (showLogin) return <Login onBack={() => setShowLogin(false)} />;

    const handleNavigate = (page: string) => {
        if (page === 'home') {
            window.location.hash = '';
        } else {
            window.location.hash = `#/${page}`;
        }
    };

    if (hash === '#/features') {
        return <FeaturesPage onLogin={() => setShowLogin(true)} onNavigate={handleNavigate} lang={lang} setLang={setLang} />;
    }
    if (hash === '#/pricing') {
        return <PricingPage onLogin={() => setShowLogin(true)} onNavigate={handleNavigate} lang={lang} setLang={setLang} />;
    }
    if (hash === '#/contact') {
        return <ContactPage onLogin={() => setShowLogin(true)} onNavigate={handleNavigate} lang={lang} setLang={setLang} />;
    }

    return <LandingPage onLogin={() => setShowLogin(true)} onNavigate={handleNavigate} lang={lang} setLang={setLang} />;
};

const App: React.FC = () => (
    <AuthProvider>
        <AppWrapper />
        <ClickRippleEffect />
    </AuthProvider>
);

export default App;