// File: src/App.tsx
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, CalendarDays, Wallet, LogOut, Loader2, Settings } from 'lucide-react';

// Import các Components (Đảm bảo bạn đã tạo file trong thư mục components)
import FinanceDashboard from './components/FinanceDashboard';
import ScheduleDashboard from './components/ScheduleDashboard';
import SettingsModal from './components/SettingsModal';
import Login from './components/Login';

// Context và Service
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './services/supabase';
import { checkAndNotify, requestNotificationPermission } from './services/notificationService';

// Types và Constants (Khớp với file đã sửa)
import { AppState, Transaction, TaskPriority } from './types';
import { INITIAL_BUDGET, INITIAL_GOALS, INITIAL_TRANSACTIONS } from './constants';

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

const AuthenticatedApp: React.FC = () => {
    const { user, signOut } = useAuth();
    const [activeTab, setActiveTab] = useState<'finance' | 'schedule'>('finance');
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // App State - Khởi tạo dữ liệu mặc định
    const [appState, setAppState] = useState<AppState>({
        transactions: INITIAL_TRANSACTIONS,
        budget: INITIAL_BUDGET,
        timetable: [], // Khởi tạo rỗng, sẽ fetch từ Supabase
        todos: [],
        goals: INITIAL_GOALS,
        currentBalance: 0,
        profile: null
    });

    // Fetch Data từ Supabase khi user đăng nhập
    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            setIsLoadingData(true);
            try {
                // Gọi song song 5 bảng dữ liệu cho nhanh
                const [txRes, goalRes, timeRes, todoRes, profileRes] = await Promise.all([
                    supabase.from('transactions').select('*').order('date', { ascending: false }),
                    supabase.from('goals').select('*').order('deadline', { ascending: true }),
                    supabase.from('timetable').select('*').order('start_time', { ascending: true }),
                    supabase.from('todos').select('*').order('created_at', { ascending: false }),
                    supabase.from('profiles').select('*').eq('id', user.id).single()
                ]);

                if (txRes.error) throw txRes.error;
                // Profile might be empty if new user, so don't throw error immediately or handle gracefully

                // Cập nhật State
                setAppState(prev => ({
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
                    timetable: timeRes.data || [],
                    todos: todoRes.data || [],
                    profile: profileRes.data || null
                }));

            } catch (error) {
                console.error('Lỗi tải dữ liệu:', error);
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchData();


    }, [user]);

    // --- NOTIFICATION LOGIC ---
    useEffect(() => {
        if (!appState.timetable.length) return;

        // Check every minute
        const interval = setInterval(() => {
            checkAndNotify(appState.timetable);
        }, 60000);

        // Initial check
        checkAndNotify(appState.timetable);

        return () => clearInterval(interval);
    }, [appState.timetable]);

    // --- CÁC HÀM XỬ LÝ (HANDLERS) ---
    const handleAddTransaction = async (newTx: Omit<Transaction, 'id'>) => {
        if (!user) return;
        const tempId = Date.now().toString();
        // Optimistic UI: Hiển thị ngay lập tức trước khi lưu server
        const optimisticTx: Transaction = { ...newTx, id: tempId, user_id: user.id };

        setAppState(prev => ({ ...prev, transactions: [optimisticTx, ...prev.transactions] }));

        try {
            const { data, error } = await supabase.from('transactions').insert([{
                user_id: user.id, ...newTx
            }]).select().single();

            if (error) throw error;
            if (data) {
                // Cập nhật lại ID thật từ server
                setAppState(prev => ({
                    ...prev,
                    transactions: prev.transactions.map(t => t.id === tempId ? { ...data, amount: Number(data.amount) } : t)
                }));
            }
        } catch (error: any) {
            console.error('Lỗi thêm giao dịch:', error);
            alert(`Lỗi: ${error.message}`);
            // Rollback (hoàn tác) nếu lỗi
            setAppState(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== tempId) }));
        }
    };

    const handleUpdateTransaction = async (updatedTx: Transaction) => {
        const previousTransactions = [...appState.transactions];
        setAppState(prev => ({ ...prev, transactions: prev.transactions.map(t => t.id === updatedTx.id ? updatedTx : t) }));

        try {
            const { error } = await supabase.from('transactions').update({
                amount: updatedTx.amount, category: updatedTx.category, date: updatedTx.date, type: updatedTx.type, description: updatedTx.description
            }).eq('id', updatedTx.id);
            if (error) throw error;
        } catch (error: any) {
            alert(`Lỗi cập nhật: ${error.message}`);
            setAppState(prev => ({ ...prev, transactions: previousTransactions }));
        }
    };

    const handleDeleteTransaction = async (id: string) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa?')) return;
        const previousTransactions = [...appState.transactions];
        setAppState(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) }));

        try {
            const { error } = await supabase.from('transactions').delete().eq('id', id);
            if (error) throw error;
        } catch (error) {
            alert('Lỗi xóa giao dịch.');
            setAppState(prev => ({ ...prev, transactions: previousTransactions }));
        }
    };

    // Các hàm giữ chỗ (Placeholder) cho Lịch trình - Bạn có thể copy logic tương tự Transaction
    // --- GOALS HANDLERS ---
    const handleAddGoal = async (newGoal: any) => {
        if (!user) return;
        const tempId = Date.now().toString();
        const optimisticGoal = { ...newGoal, id: tempId, user_id: user.id };
        setAppState(prev => ({ ...prev, goals: [...prev.goals, optimisticGoal] }));
        try {
            const { data, error } = await supabase.from('goals').insert([{ user_id: user.id, ...newGoal }]).select().single();
            if (error) throw error;
            if (data) setAppState(prev => ({ ...prev, goals: prev.goals.map(g => g.id === tempId ? data : g) }));
        } catch (error: any) {
            console.error(error);
            alert(`Lỗi thêm mục tiêu: ${error.message}`);
            setAppState(prev => ({ ...prev, goals: prev.goals.filter(g => g.id !== tempId) }));
        }
    };

    const handleUpdateGoal = async (updatedGoal: any) => {
        const prevGoals = [...appState.goals];
        setAppState(prev => ({ ...prev, goals: prev.goals.map(g => g.id === updatedGoal.id ? updatedGoal : g) }));
        try {
            const { error } = await supabase.from('goals').update({
                title: updatedGoal.title, target_amount: updatedGoal.target_amount, current_amount: updatedGoal.current_amount,
                deadline: updatedGoal.deadline, type: updatedGoal.type, progress: updatedGoal.progress
            }).eq('id', updatedGoal.id);
            if (error) throw error;
        } catch (error: any) {
            console.error(error);
            alert(`Lỗi cập nhật mục tiêu: ${error.message}`);
            setAppState(prev => ({ ...prev, goals: prevGoals }));
        }
    };

    const handleDeleteGoal = async (id: string) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa mục tiêu này?')) return;
        const prevGoals = [...appState.goals];
        setAppState(prev => ({ ...prev, goals: prev.goals.filter(g => g.id !== id) }));
        try {
            const { error } = await supabase.from('goals').delete().eq('id', id);
            if (error) throw error;
        } catch (error: any) {
            console.error(error);
            alert(`Lỗi xóa mục tiêu: ${error.message}`);
            setAppState(prev => ({ ...prev, goals: prevGoals }));
        }
    };

    const handleAddTimetable = async (item: any) => {
        if (!user) return;
        const tempId = Date.now().toString();
        const optimisticItem = { ...item, id: tempId, user_id: user.id };
        setAppState(prev => ({ ...prev, timetable: [...prev.timetable, optimisticItem] }));

        try {
            const { data, error } = await supabase.from('timetable').insert([{ user_id: user.id, ...item }]).select().single();
            if (error) throw error;
            if (data) setAppState(prev => ({ ...prev, timetable: prev.timetable.map(t => t.id === tempId ? data : t) }));
        } catch (error: any) {
            console.error(error);
            setAppState(prev => ({ ...prev, timetable: prev.timetable.filter(t => t.id !== tempId) }));
        }
    };

    const handleUpdateTimetable = async (item: any) => {
        const prevTimetable = [...appState.timetable];
        setAppState(prev => ({ ...prev, timetable: prev.timetable.map(t => t.id === item.id ? item : t) }));
        try {
            const { error } = await supabase.from('timetable').update(item).eq('id', item.id);
            if (error) throw error;
        } catch (error) {
            console.error(error);
            setAppState(prev => ({ ...prev, timetable: prevTimetable }));
        }
    };

    const handleDeleteTimetable = async (id: string) => {
        const prevTimetable = [...appState.timetable];
        setAppState(prev => ({ ...prev, timetable: prev.timetable.filter(t => t.id !== id) }));
        try {
            const { error } = await supabase.from('timetable').delete().eq('id', id);
            if (error) throw error;
        } catch (error) {
            console.error(error);
            setAppState(prev => ({ ...prev, timetable: prevTimetable }));
        }
    };
    const handleAddTodo = async (content: string, priority: any) => {
        if (!user) return;
        const tempId = crypto.randomUUID();
        const newItem = { id: tempId, content, priority, is_completed: false, user_id: user.id };

        // Optimistic UI: Update local state immediately
        setAppState(prev => ({ ...prev, todos: [newItem, ...prev.todos] }));

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
                setAppState(prev => ({
                    ...prev,
                    todos: prev.todos.map(t => t.id === tempId ? data : t)
                }));
            }
        } catch (error: any) {
            console.error(error);
            alert("Lỗi thêm việc: " + error.message);
            setAppState(prev => ({ ...prev, todos: prev.todos.filter(t => t.id !== tempId) }));
        }
    };

    const handleUpdateTodo = async (item: any) => {
        const prevTodos = [...appState.todos];
        setAppState(prev => ({ ...prev, todos: prev.todos.map(t => t.id === item.id ? item : t) }));

        try {
            const { error } = await supabase.from('todos').update(item).eq('id', item.id);
            if (error) throw error;
        } catch (error: any) {
            console.error(error);
            alert("Lỗi cập nhật việc: " + error.message);
            setAppState(prev => ({ ...prev, todos: prevTodos }));
        }
    };

    const handleDeleteTodo = async (id: string) => {
        const prevTodos = [...appState.todos];
        setAppState(prev => ({ ...prev, todos: prev.todos.filter(t => t.id !== id) }));

        try {
            const { error } = await supabase.from('todos').delete().eq('id', id);
            if (error) throw error;
        } catch (error: any) {
            console.error(error);
            alert("Lỗi xóa việc: " + error.message);
            setAppState(prev => ({ ...prev, todos: prevTodos }));
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
                    <button onClick={() => setActiveTab('finance')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${activeTab === 'finance' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}>
                        <Wallet size={20} /> Tài chính
                    </button>
                    <button onClick={() => setActiveTab('schedule')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${activeTab === 'schedule' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}>
                        <CalendarDays size={20} /> Lịch trình & Mục tiêu
                    </button>

                    {/* Notification Button Desktop */}
                    <button onClick={requestNotificationPermission} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-medium text-sm text-gray-500 hover:bg-amber-50 hover:text-amber-700">
                        <span>🔔</span> Bật thông báo
                    </button>
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
            <main className="flex-1 md:ml-64 p-4 md:p-8 min-h-screen relative pt-[130px] md:pt-8 bg-[#F8F9FC]">
                <header className="md:hidden fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100 z-30 transition-all">
                    <div className="flex items-center justify-between p-4 pb-2">
                        <div className="flex items-center gap-2">
                            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-1.5 rounded-lg">
                                <LayoutDashboard className="text-white" size={18} />
                            </div>
                            <span className="font-bold text-gray-800 text-lg tracking-tight">SmartLife</span>
                        </div>
                        <div className="flex gap-1">
                            <button onClick={requestNotificationPermission} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors" title="Bật thông báo"><span className="text-xs font-bold">🔔</span></button>
                            <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"><Settings size={20} /></button>
                            <button onClick={signOut} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"><LogOut size={20} /></button>
                        </div>
                    </div>
                    <div className="flex px-4 pb-3 gap-2">
                        <button
                            onClick={() => setActiveTab('finance')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'finance' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                            <Wallet size={16} /> Tài chính
                        </button>
                        <button
                            onClick={() => setActiveTab('schedule')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'schedule' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                            <CalendarDays size={16} /> Lịch trình
                        </button>
                    </div>
                </header>

                <div className="max-w-7xl mx-auto">
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


            {/* Mobile Nav */}


            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} userId={user?.id || ''} />
        </div >
    );
};

const AppWrapper: React.FC = () => {
    const { user, loading } = useAuth();
    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>;
    return user ? <AuthenticatedApp /> : <Login />;
};

const App: React.FC = () => (
    <AuthProvider><AppWrapper /></AuthProvider>
);

export default App;