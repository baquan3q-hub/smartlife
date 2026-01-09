// File: src/App.tsx
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, CalendarDays, Wallet, Settings, LogOut, Loader2 } from 'lucide-react';
import FinanceDashboard from './components/FinanceDashboard';
import ScheduleDashboard from './components/ScheduleDashboard';
import FloatingChat from './components/FloatingChat'; // Đây là nơi AI sẽ sống
import Login from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppState, Transaction } from './types';
import { INITIAL_BUDGET, INITIAL_GOALS, INITIAL_TRANSACTIONS } from './constants';
import { supabase } from './services/supabase';

const AuthenticatedApp: React.FC = () => {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'finance' | 'schedule'>('finance');
  const [isLoadingData, setIsLoadingData] = useState(false);

  // App State
  const [appState, setAppState] = useState<AppState>({
    transactions: INITIAL_TRANSACTIONS,
    budget: INITIAL_BUDGET,
    timetable: [],
    todos: [],
    goals: INITIAL_GOALS,
    currentBalance: 0
  });

  // Fetch Data from Supabase
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const [txRes, goalRes, timeRes, todoRes] = await Promise.all([
          supabase.from('transactions').select('*').order('date', { ascending: false }),
          supabase.from('goals').select('*').order('deadline', { ascending: true }),
          supabase.from('timetable').select('*').order('start_time', { ascending: true }),
          supabase.from('todos').select('*').order('created_at', { ascending: false })
        ]);

        if (txRes.error) throw txRes.error;
        if (goalRes.error) throw goalRes.error;
        if (timeRes.error) throw timeRes.error;
        if (todoRes.error) throw todoRes.error;

        setAppState(prev => ({
          ...prev,
          transactions: txRes.data.map(t => ({
            id: t.id, user_id: t.user_id, amount: Number(t.amount), category: t.category, date: t.date, type: t.type, description: t.description || '', created_at: t.created_at
          })),
          goals: goalRes.data,
          timetable: timeRes.data,
          todos: todoRes.data
        }));

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, [user]);

  // --- TRANSACTION HANDLERS ---
  const handleAddTransaction = async (newTx: Omit<Transaction, 'id'>) => {
    if (!user) return;
    const tempId = Date.now().toString();
    const optimisticTx: Transaction = { ...newTx, id: tempId, user_id: user.id };

    setAppState(prev => ({ ...prev, transactions: [optimisticTx, ...prev.transactions] }));

    try {
      const { data, error } = await supabase.from('transactions').insert([{
        user_id: user.id, ...newTx
      }]).select().single();

      if (error) throw error;
      if (data) {
        setAppState(prev => ({
          ...prev,
          transactions: prev.transactions.map(t => t.id === tempId ? { ...data, amount: Number(data.amount) } : t)
        }));
      }
    } catch (error: any) {
      console.error('Error adding transaction:', error);
      alert(`Lỗi: ${error.message}`);
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

  // --- OTHER HANDLERS (Simplified for brevity as they were correct) ---
  const handleAddGoal = async (item: any) => {/*...giữ nguyên logic cũ...*/ };
  const handleUpdateGoal = async (item: any) => {/*...giữ nguyên logic cũ...*/ };
  const handleDeleteGoal = async (id: string) => {/*...giữ nguyên logic cũ...*/ };

  const handleAddTimetable = async (item: any) => {/*...giữ nguyên logic cũ...*/ };
  const handleUpdateTimetable = async (item: any) => {/*...giữ nguyên logic cũ...*/ };
  const handleDeleteTimetable = async (id: string) => {/*...giữ nguyên logic cũ...*/ };

  const handleAddTodo = async (content: string, priority: any) => {/*...giữ nguyên logic cũ...*/ };
  const handleUpdateTodo = async (item: any) => {/*...giữ nguyên logic cũ...*/ };
  const handleDeleteTodo = async (id: string) => {/*...giữ nguyên logic cũ...*/ };

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

        <nav className="flex-1 px-4 space-y-2 mt-2">
          <button onClick={() => setActiveTab('finance')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${activeTab === 'finance' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}>
            <Wallet size={20} /> Tài chính
          </button>
          <button onClick={() => setActiveTab('schedule')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${activeTab === 'schedule' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}>
            <CalendarDays size={20} /> Lịch trình & Mục tiêu
          </button>
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-2">
          <button onClick={signOut} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-all font-medium text-sm">
            <LogOut size={20} /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 min-h-screen relative">
        <header className="md:hidden flex items-center justify-between mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100 sticky top-4 z-30">
          <span className="font-bold text-gray-800">SmartLife</span>
          <button onClick={signOut}><LogOut size={20} /></button>
        </header>

        <div className="max-w-7xl mx-auto">
          {activeTab === 'finance' && (
            <FinanceDashboard
              state={appState}
              onAddTransaction={handleAddTransaction}
              onUpdateTransaction={handleUpdateTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              isLoading={isLoadingData}
            />
          )}
          {activeTab === 'schedule' && (
            <ScheduleDashboard
              state={appState}
              // Truyền các hàm handlers tương ứng vào đây như cũ
              onAddGoal={handleAddGoal} onUpdateGoal={handleUpdateGoal} onDeleteGoal={handleDeleteGoal}
              onAddTimetable={handleAddTimetable} onUpdateTimetable={handleUpdateTimetable} onDeleteTimetable={handleDeleteTimetable}
              onAddTodo={handleAddTodo} onUpdateTodo={handleUpdateTodo} onDeleteTodo={handleDeleteTodo}
            />
          )}
        </div>
      </main>

      {/* CHAT AI Ở ĐÂY - NÓ NHẬN DỮ LIỆU APPSTATE ĐỂ THÔNG MINH HƠN */}
      <FloatingChat appState={appState} />

      {/* Mobile Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex justify-around">
        <button onClick={() => setActiveTab('finance')}><Wallet />Tài chính</button>
        <button onClick={() => setActiveTab('schedule')}><CalendarDays />Lịch trình</button>
      </div>
    </div>
  );
};

// ... Phần AppWrapper và export default App giữ nguyên
const AppWrapper: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;
  return user ? <AuthenticatedApp /> : <Login />;
};

const App: React.FC = () => (
  <AuthProvider><AppWrapper /></AuthProvider>
);

export default App;