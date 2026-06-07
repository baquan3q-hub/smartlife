// File: src/components/GoalsDashboard.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { careerGoalService } from '../services/careerGoalService';
import {
  CareerPosition,
  CareerGoal,
  LifeGoal,
  CareerGoalCategory,
  CareerGoalPriority,
  CareerGoalStatus
} from '../types';
import {
  Target, Plus, Trash2, Edit3, ExternalLink, Calendar,
  ArrowUpDown, Settings, X, CheckCircle2, ChevronRight,
  AlertCircle, Star, Move, ArrowUp, ArrowDown, Sparkles, CheckSquare, Square,
  Loader2, FileText, Compass
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { CVBuilder } from './CVBuilder.tsx'; // Named import from CVBuilder.tsx

// Category color mappings
const CATEGORY_MAP: Record<CareerGoalCategory, { label: string; bg: string; text: string; border: string }> = {
  technical: { label: 'Technical Skill', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100' },
  domain: { label: 'Domain Knowledge', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
  soft: { label: 'Soft Skill', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-100' },
  project: { label: 'Personal Project', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100' },
  tool: { label: 'Tool/Software', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100' },
  certificate: { label: 'Certificate', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100' }
};

// Priority mappings
const PRIORITY_MAP: Record<CareerGoalPriority, { label: string; color: string; bg: string }> = {
  high: { label: 'Ưu tiên Cao', color: 'text-red-600', bg: 'bg-red-50' },
  medium: { label: 'Ưu tiên Trung bình', color: 'text-amber-600', bg: 'bg-amber-50' },
  low: { label: 'Ưu tiên Thấp', color: 'text-slate-600', bg: 'bg-slate-50' }
};

// Status mappings
const STATUS_MAP: Record<CareerGoalStatus, { label: string; color: string; bg: string }> = {
  not_started: { label: 'Chưa bắt đầu', color: 'text-gray-500', bg: 'bg-gray-100' },
  in_progress: { label: 'Đang học/làm', color: 'text-indigo-600', bg: 'bg-indigo-100' },
  completed: { label: 'Hoàn thành', color: 'text-emerald-600', bg: 'bg-emerald-100' },
  overdue: { label: 'Quá hạn', color: 'text-rose-600', bg: 'bg-rose-100' }
};

// Fixed Icon Set (Option B)
const LIFE_GOAL_ICONS = [
  '🚗', '💍', '💰', '🏠', '✈️', '🎓', '💪', '🌍', '📱', '🏆',
  '👨‍👩‍👧', '🐕', '🎨', '📚', '💻', '💼', '🌴', '👶', '🏢', '❤️',
  '🚲', '🛥️', '🧗‍♂️', '🍕', '🎸', '🌟', '🌳', '🔑', '📈', '🩺'
];

const getDaysRemainingText = (deadlineStr?: string) => {
  if (!deadlineStr) return '';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(deadlineStr);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return ' (Hôm nay)';
  if (diffDays < 0) return ` (Quá hạn ${Math.abs(diffDays)} ngày)`;
  return ` (Còn ${diffDays} ngày)`;
};

interface GoalsDashboardProps {
  userId: string;
  isPro?: boolean;
  onUpgrade?: () => void;
  onNavigateToGPACareer?: () => void;
}

const GoalsDashboard: React.FC<GoalsDashboardProps> = ({
  userId,
  isPro = false,
  onUpgrade = () => {},
  onNavigateToGPACareer
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'career' | 'life' | 'cv'>('career');

  // State lists
  const [positions, setPositions] = useState<CareerPosition[]>([]);
  const [selectedPositionId, setSelectedPositionId] = useState<string>('');
  const [careerGoals, setCareerGoals] = useState<CareerGoal[]>([]);
  const [lifeGoals, setLifeGoals] = useState<LifeGoal[]>([]);

  // Modals state
  const [showGoalModal, setShowGoalModal] = useState<boolean>(false);
  const [editingGoal, setEditingGoal] = useState<CareerGoal | null>(null);

  const [showLifeModal, setShowLifeModal] = useState<boolean>(false);
  const [editingLifeGoal, setEditingLifeGoal] = useState<LifeGoal | null>(null);

  const [showPositionModal, setShowPositionModal] = useState<boolean>(false);

  // AI Recommendations State
  const [showAIModal, setShowAIModal] = useState<boolean>(false);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiRecommendations, setAiRecommendations] = useState<any[]>([]);
  const [selectedRecommendIndexes, setSelectedRecommendIndexes] = useState<number[]>([]);
  const [loadingStep, setLoadingStep] = useState<number>(0);

  // Filters & Sorting state
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'deadline' | 'priority' | 'status' | 'category'>('deadline');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const [loading, setLoading] = useState<boolean>(true);

  // Form states - Career Goal
  const [goalForm, setGoalForm] = useState({
    title: '',
    description: '',
    link: '',
    category: 'technical' as CareerGoalCategory,
    priority: 'medium' as CareerGoalPriority,
    status: 'not_started' as CareerGoalStatus,
    start_date: '',
    deadline: '',
    progress: 0
  });

  // Form states - Life Goal
  const [lifeForm, setLifeForm] = useState({
    title: '',
    target_year: new Date().getFullYear() + 5,
    icon: '🏆',
    is_achieved: false
  });

  // Position form state
  const [newPositionTitle, setNewPositionTitle] = useState<string>('');

  // Confirmation state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { }
  });

  // Drag and drop state for Life Goals
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Fetch initial data
  const fetchData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [posData, goalData, lifeData] = await Promise.all([
        careerGoalService.fetchPositions(userId),
        careerGoalService.fetchCareerGoals(userId),
        careerGoalService.fetchLifeGoals(userId)
      ]);

      setPositions(posData);
      setCareerGoals(goalData);
      setLifeGoals(lifeData);

      // Select first position if available
      if (posData.length > 0) {
        setSelectedPositionId(posData[0].id);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle position select
  const currentPosition = useMemo(() => {
    return positions.find(p => p.id === selectedPositionId) || null;
  }, [positions, selectedPositionId]);

  useEffect(() => {
    fetchData();
  }, [userId]);

  useEffect(() => {
    if (aiLoading) {
      const stepsCount = 5;
      setLoadingStep(0);
      const interval = setInterval(() => {
        setLoadingStep(prev => (prev < stepsCount - 1 ? prev + 1 : prev));
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [aiLoading]);

  const loadingSteps = [
    `🔍 Đang phân tích vị trí mục tiêu: "${currentPosition?.title || ''}"...`,
    '📚 Đang đọc bảng điểm GPA và lịch sử môn học chuyên ngành...',
    '📊 Đang thực hiện đối chiếu khoảng trống tri thức (Gap Analysis)...',
    '💡 Đang chọn lọc kỹ năng thực chiến & ý tưởng dự án cá nhân phù hợp...',
    '🧠 Trí tuệ nhân tạo Gemini đang tinh chỉnh lộ trình & chuẩn bị tài nguyên...'
  ];

  // Statistics for selected position
  const careerStats = useMemo(() => {
    const goalsForPosition = careerGoals.filter(g => g.position_id === selectedPositionId);
    const total = goalsForPosition.length;
    if (total === 0) return { total, completed: 0, progress: 0 };

    const completed = goalsForPosition.filter(g => g.status === 'completed' || g.progress === 100).length;

    // Average progress
    const sumProgress = goalsForPosition.reduce((acc, curr) => acc + curr.progress, 0);
    const avgProgress = Math.round(sumProgress / total);

    return {
      total,
      completed,
      progress: avgProgress
    };
  }, [careerGoals, selectedPositionId]);

  // Filtered & Sorted Career Goals
  const processedCareerGoals = useMemo(() => {
    let result = careerGoals.filter(g => g.position_id === selectedPositionId);

    // Filter by Category
    if (filterCategory !== 'all') {
      result = result.filter(g => g.category === filterCategory);
    }

    // Filter by Status
    if (filterStatus !== 'all') {
      result = result.filter(g => g.status === filterStatus);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'deadline') {
        const dateA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const dateB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        comparison = dateA - dateB;
      } else if (sortBy === 'priority') {
        const weight = { high: 3, medium: 2, low: 1 };
        comparison = weight[b.priority] - weight[a.priority];
      } else if (sortBy === 'status') {
        const weight = { overdue: 4, in_progress: 3, not_started: 2, completed: 1 };
        comparison = weight[b.status] - weight[a.status];
      } else if (sortBy === 'category') {
        comparison = a.category.localeCompare(b.category);
      }

      return sortAsc ? comparison : -comparison;
    });

    return result;
  }, [careerGoals, selectedPositionId, filterCategory, filterStatus, sortBy, sortAsc]);

  // Add Position
  const handleAddPosition = async () => {
    if (!newPositionTitle.trim()) return;
    const added = await careerGoalService.addPosition(userId, newPositionTitle.trim());
    if (added) {
      setPositions(prev => [...prev, added]);
      setSelectedPositionId(added.id);
      setNewPositionTitle('');
      setShowPositionModal(false);
    }
  };

  // Delete Position
  const handleDeletePosition = (id: string, title: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa vị trí mục tiêu',
      message: `Bạn có chắc muốn xóa "${title}"? Việc này sẽ xóa toàn bộ mục tiêu kỹ năng/dự án đính kèm vị trí này.`,
      onConfirm: async () => {
        const success = await careerGoalService.deletePosition(id);
        if (success) {
          setPositions(prev => prev.filter(p => p.id !== id));
          setCareerGoals(prev => prev.filter(g => g.position_id !== id));
          if (selectedPositionId === id) {
            const remaining = positions.filter(p => p.id !== id);
            setSelectedPositionId(remaining.length > 0 ? remaining[0].id : '');
          }
          setConfirmDialog(p => ({ ...p, isOpen: false }));
        }
      }
    });
  };

  // Open Goal Modal (Create / Edit)
  const openGoalModal = (goal: CareerGoal | null = null) => {
    if (goal) {
      setEditingGoal(goal);
      setGoalForm({
        title: goal.title,
        description: goal.description || '',
        link: goal.link || '',
        category: goal.category,
        priority: goal.priority,
        status: goal.status,
        start_date: goal.start_date || '',
        deadline: goal.deadline || '',
        progress: goal.progress
      });
    } else {
      setEditingGoal(null);
      setGoalForm({
        title: '',
        description: '',
        link: '',
        category: 'technical',
        priority: 'medium',
        status: 'not_started',
        start_date: new Date().toISOString().split('T')[0],
        deadline: '',
        progress: 0
      });
    }
    setShowGoalModal(true);
  };

  // Save Goal
  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalForm.title.trim() || !selectedPositionId) return;

    const goalData = {
      position_id: selectedPositionId,
      title: goalForm.title.trim(),
      description: goalForm.description.trim() || null,
      link: goalForm.link.trim() || null,
      category: goalForm.category,
      priority: goalForm.priority,
      status: goalForm.status,
      start_date: goalForm.start_date || null,
      deadline: goalForm.deadline || null,
      progress: Number(goalForm.progress)
    };

    if (editingGoal) {
      const success = await careerGoalService.updateCareerGoal(editingGoal.id, goalData);
      if (success) {
        setCareerGoals(prev => prev.map(g => g.id === editingGoal.id ? { ...g, ...goalData } : g));
        setShowGoalModal(false);
      }
    } else {
      const added = await careerGoalService.addCareerGoal(userId, goalData);
      if (added) {
        setCareerGoals(prev => [...prev, added]);
        setShowGoalModal(false);
      }
    }
  };

  // Delete Goal
  const handleDeleteGoal = (id: string, title: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa mục tiêu sự nghiệp',
      message: `Bạn có chắc chắn muốn xóa mục tiêu "${title}" không?`,
      onConfirm: async () => {
        const success = await careerGoalService.deleteCareerGoal(id);
        if (success) {
          setCareerGoals(prev => prev.filter(g => g.id !== id));
          setConfirmDialog(p => ({ ...p, isOpen: false }));
        }
      }
    });
  };

  // Toggle quick complete for Career Goal
  const handleToggleGoalComplete = async (goal: CareerGoal) => {
    const isCompleted = goal.status === 'completed';
    const newStatus: CareerGoalStatus = isCompleted ? 'in_progress' : 'completed';
    const newProgress = isCompleted ? 50 : 100;

    const success = await careerGoalService.updateCareerGoal(goal.id, {
      status: newStatus,
      progress: newProgress
    });

    if (success) {
      setCareerGoals(prev => prev.map(g => g.id === goal.id ? { ...g, status: newStatus, progress: newProgress } : g));
    }
  };

  // --- LIFE GOALS LOGIC ---

  // Open Life Goal Modal
  const openLifeModal = (goal: LifeGoal | null = null) => {
    if (goal) {
      setEditingLifeGoal(goal);
      setLifeForm({
        title: goal.title,
        target_year: goal.target_year,
        icon: goal.icon,
        is_achieved: goal.is_achieved
      });
    } else {
      setEditingLifeGoal(null);
      setLifeForm({
        title: '',
        target_year: new Date().getFullYear() + 5,
        icon: '🚗',
        is_achieved: false
      });
    }
    setShowLifeModal(true);
  };

  // Save Life Goal
  const handleSaveLifeGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lifeForm.title.trim()) return;

    const goalData = {
      title: lifeForm.title.trim(),
      target_year: Number(lifeForm.target_year),
      icon: lifeForm.icon,
      is_achieved: lifeForm.is_achieved,
      sort_order: editingLifeGoal ? editingLifeGoal.sort_order : lifeGoals.length
    };

    if (editingLifeGoal) {
      const success = await careerGoalService.updateLifeGoal(editingLifeGoal.id, goalData);
      if (success) {
        setLifeGoals(prev => prev.map(g => g.id === editingLifeGoal.id ? { ...g, ...goalData } : g).sort((a, b) => a.sort_order - b.sort_order));
        setShowLifeModal(false);
      }
    } else {
      const added = await careerGoalService.addLifeGoal(userId, goalData);
      if (added) {
        setLifeGoals(prev => [...prev, added].sort((a, b) => a.sort_order - b.sort_order));
        setShowLifeModal(false);
      }
    }
  };

  // Toggle Achieved for Life Goal
  const handleToggleLifeAchieved = async (goal: LifeGoal) => {
    const newVal = !goal.is_achieved;
    const success = await careerGoalService.updateLifeGoal(goal.id, { is_achieved: newVal });
    if (success) {
      setLifeGoals(prev => prev.map(g => g.id === goal.id ? { ...g, is_achieved: newVal } : g));
    }
  };

  // Delete Life Goal
  const handleDeleteLifeGoal = (id: string, title: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa mục tiêu dài hạn',
      message: `Bạn có chắc muốn xóa "${title}" không?`,
      onConfirm: async () => {
        const success = await careerGoalService.deleteLifeGoal(id);
        if (success) {
          setLifeGoals(prev => prev.filter(g => g.id !== id));
          setConfirmDialog(p => ({ ...p, isOpen: false }));
        }
      }
    });
  };

  // Manual sorting up/down for mobile support
  const moveLifeGoal = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= lifeGoals.length) return;

    const newList = [...lifeGoals];
    const temp = newList[index];
    newList[index] = newList[targetIndex];
    newList[targetIndex] = temp;

    // Optimistic update
    setLifeGoals(newList);
    await careerGoalService.reorderLifeGoals(userId, newList);
  };

  // Drag and Drop support
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newList = [...lifeGoals];
    const draggedItem = newList[draggedIndex];
    newList.splice(draggedIndex, 1);
    newList.splice(index, 0, draggedItem);

    setLifeGoals(newList);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);
    await careerGoalService.reorderLifeGoals(userId, lifeGoals);
  };

  // --- AI RECOMMENDATIONS FUNCTIONS ---
  const triggerAIRecommendations = async () => {
    if (!currentPosition) return;

    setShowAIModal(true);
    setAiLoading(true);
    setAiRecommendations([]);
    setSelectedRecommendIndexes([]);

    try {
      // 1. Fetch current skills under this position
      const currentSkills = careerGoals
        .filter(g => g.position_id === selectedPositionId)
        .map(g => g.title);

      // 2. Fetch GPA courses
      const { data: gpaCoursesData, error: gpaError } = await supabase
        .from('gpa_courses')
        .select('name')
        .eq('user_id', userId);

      const gpaCourses = gpaError ? [] : (gpaCoursesData || []).map(c => c.name);

      // 3. Call service to get recommendations
      const recommendations = await careerGoalService.getAIRecommendations(
        currentPosition.title,
        currentSkills,
        gpaCourses
      );

      setAiRecommendations(recommendations);
      // By default, select all recommendations
      setSelectedRecommendIndexes(recommendations.map((_, idx) => idx));
    } catch (err) {
      console.error('Error fetching AI recommendations:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddAIRecommendations = async () => {
    if (selectedRecommendIndexes.length === 0 || !selectedPositionId) return;

    const selectedSkills = aiRecommendations.filter((_, idx) => selectedRecommendIndexes.includes(idx));

    try {
      const success = await careerGoalService.addCareerGoalsBatch(userId, selectedPositionId, selectedSkills);
      if (success) {
        // Refresh career goals
        const updatedGoals = await careerGoalService.fetchCareerGoals(userId);
        setCareerGoals(updatedGoals);
        setShowAIModal(false);
      } else {
        alert('Đã xảy ra lỗi khi thêm lộ trình. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error('Error adding AI recommendations batch:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Tab Switcher */}
      <div className="flex justify-between items-center flex-wrap gap-4 border-b border-gray-200 pb-3">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveSubTab('career')}
            className={`flex items-center gap-2 pb-3 font-bold text-base md:text-lg border-b-2 transition-all px-1 ${activeSubTab === 'career'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            <Target size={20} /> Mục tiêu Nghề nghiệp
          </button>

          <button
            onClick={() => setActiveSubTab('life')}
            className={`flex items-center gap-2 pb-3 font-bold text-base md:text-lg border-b-2 transition-all px-1 ${activeSubTab === 'life'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            <Star size={20} /> Mục tiêu 5 năm
          </button>

          <button
            onClick={() => setActiveSubTab('cv')}
            className={`flex items-center gap-2 pb-3 font-bold text-base md:text-lg border-b-2 transition-all px-1 ${activeSubTab === 'cv'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            <FileText size={20} /> CV Builder
          </button>
        </div>

        {/* Global Action Button */}
        {activeSubTab === 'career' && positions.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={triggerAIRecommendations}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-indigo-100 hover:scale-105 active:scale-95 animate-in slide-in-from-right duration-300"
            >
              <Sparkles size={16} className="animate-pulse" /> Make a Roadmap by AI
            </button>
            <button
              onClick={() => openGoalModal()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-indigo-100"
            >
              <Plus size={16} /> Thêm Mục tiêu
            </button>
          </div>
        )}

        {activeSubTab === 'life' && (
          <button
            onClick={() => openLifeModal()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-indigo-100"
          >
            <Plus size={16} /> Thêm Mục tiêu 5 năm
          </button>
        )}
      </div>

      {/* --- SUB-TAB: CAREER GOALS --- */}
      {activeSubTab === 'career' && (
        <div className="space-y-6">

          {/* Position Selector & Overall Stats */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

              {/* Vị trí mục tiêu dropdown */}
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <span className="text-gray-600 font-bold shrink-0 text-sm md:text-base">🎯 Vị trí mục tiêu:</span>
                {positions.length > 0 ? (
                  <div className="flex items-center gap-1.5 w-full">
                    <select
                      value={selectedPositionId}
                      onChange={(e) => setSelectedPositionId(e.target.value)}
                      className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full"
                    >
                      {positions.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>

                    {/* Gợi ý lộ trình bằng AI button */}
                    <button
                      onClick={triggerAIRecommendations}
                      className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border border-indigo-100/50 font-bold text-xs rounded-xl hover:from-indigo-100 hover:to-purple-100 transition-all shrink-0 shadow-sm"
                      title="Gợi ý lộ trình bằng AI"
                    >
                      <Sparkles size={14} className="text-purple-600 animate-pulse" />
                      <span className="hidden sm:inline">Suggest AI</span>
                    </button>

                    {/* Quản lý vị trí */}
                    <button
                      onClick={() => setShowPositionModal(true)}
                      className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-indigo-600 transition-colors shrink-0"
                      title="Quản lý các vị trí"
                    >
                      <Settings size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setShowPositionModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl hover:bg-indigo-100 transition-colors"
                    >
                      <Plus size={14} /> Thêm vị trí đầu tiên
                    </button>
                    {onNavigateToGPACareer && (
                      <button
                        onClick={onNavigateToGPACareer}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border border-emerald-100 font-bold text-xs rounded-xl hover:from-emerald-100 hover:to-teal-100 transition-all shadow-sm"
                      >
                        <Compass size={14} className="animate-pulse" />
                        Khám phá ngành nghề bằng AI
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Progress Summary */}
              {currentPosition && (
                <div className="flex items-center gap-4 flex-1 max-w-sm md:justify-end">
                  <div className="w-full">
                    <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                      <span>Tiến độ tổng: {careerStats.completed}/{careerStats.total} kỹ năng</span>
                      <span className="text-indigo-600">{careerStats.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${careerStats.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {positions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16 px-4 text-center">
              <Target size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600 font-bold">Chưa có vị trí nghề nghiệp nào</p>
              <p className="text-gray-400 text-sm mt-1 mb-6 max-w-md mx-auto">
                Hãy xác định vị trí bạn đang theo đuổi để lập lộ trình học tập, hoặc sử dụng AI để phân tích GPA và tính cách để gợi ý cho bạn.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <button
                  onClick={() => setShowPositionModal(true)}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all hover:scale-105 active:scale-95 shadow-sm"
                >
                  + Bắt đầu thủ công
                </button>
                {onNavigateToGPACareer && (
                  <button
                    onClick={onNavigateToGPACareer}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-white font-bold rounded-xl text-sm transition-all hover:scale-105 active:scale-95 shadow-md shadow-emerald-100"
                  >
                    🧭 Gợi ý ngành nghề bằng AI
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Filter and Sorting Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50/70 border border-gray-100 p-3 rounded-2xl">

                {/* Filters */}
                <div className="flex flex-wrap gap-2">
                  {/* Category Filter */}
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="bg-white border border-gray-200 text-xs font-bold text-gray-600 px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">Tất cả Loại</option>
                    <option value="technical">Technical Skill</option>
                    <option value="domain">Domain Knowledge</option>
                    <option value="soft">Soft Skill</option>
                    <option value="project">Personal Project</option>
                    <option value="tool">Tool/Software</option>
                    <option value="certificate">Certificate</option>
                  </select>

                  {/* Status Filter */}
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-white border border-gray-200 text-xs font-bold text-gray-600 px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">Tất cả Trạng thái</option>
                    <option value="not_started">⏳ Chưa bắt đầu</option>
                    <option value="in_progress">🔄 Đang học/làm</option>
                    <option value="completed">✅ Hoàn thành</option>
                    <option value="overdue">⚠️ Quá hạn</option>
                  </select>
                </div>

                {/* Sorting */}
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs font-medium flex items-center gap-1">
                    <ArrowUpDown size={12} /> Sắp xếp:
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-white border border-gray-200 text-xs font-bold text-gray-600 px-3 py-2 rounded-xl focus:outline-none"
                  >
                    <option value="deadline">Ngày dự kiến</option>
                    <option value="priority">Mức ưu tiên</option>
                    <option value="status">Trạng thái</option>
                    <option value="category">Phân loại</option>
                  </select>

                  <button
                    onClick={() => setSortAsc(!sortAsc)}
                    className="p-2 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-indigo-600 transition-colors"
                  >
                    <span className="text-xs font-black">{sortAsc ? '▲' : '▼'}</span>
                  </button>
                </div>

              </div>

              {/* Career Goal Cards Grid */}
              {processedCareerGoals.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                  <AlertCircle className="mx-auto text-gray-300 mb-3" size={40} />
                  <p className="text-gray-500 font-bold">Không tìm thấy mục tiêu nào phù hợp</p>
                  <p className="text-gray-400 text-sm mt-1">Hãy thêm mục tiêu kỹ năng, dự án hoặc công cụ mới để theo đuổi.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {processedCareerGoals.map(goal => {
                    const catInfo = CATEGORY_MAP[goal.category];
                    const prioInfo = PRIORITY_MAP[goal.priority];
                    const statusInfo = STATUS_MAP[goal.status];
                    const isDone = goal.status === 'completed' || goal.progress === 100;

                    return (
                      <div
                        key={goal.id}
                        className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col justify-between relative overflow-hidden ${isDone ? 'border-emerald-100 bg-emerald-50/5' : 'border-gray-100'
                          }`}
                      >
                        <div>
                          {/* Card Header (Category & Priority) */}
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${catInfo.bg} ${catInfo.text} ${catInfo.border}`}>
                              {catInfo.label}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${prioInfo.bg} ${prioInfo.color}`}>
                              {prioInfo.label}
                            </span>
                          </div>

                          {/* Title */}
                          <h4 className="font-bold text-gray-800 text-base group-hover:text-indigo-600 transition-colors flex items-start gap-1.5">
                            {goal.title}
                          </h4>

                          {/* Description */}
                          {goal.description && (
                            <p className="text-gray-500 text-xs mt-2 line-clamp-3 leading-relaxed">
                              {goal.description}
                            </p>
                          )}

                          {/* External Link */}
                          {goal.link && (
                            <a
                              href={goal.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors mt-3 bg-indigo-50/40 px-2 py-1 rounded-lg"
                            >
                              <ExternalLink size={12} /> Tài liệu / Github
                            </a>
                          )}
                        </div>

                        {/* Card Footer (Progress & Timeline) */}
                        <div className="mt-5 pt-4 border-t border-gray-100 space-y-3">

                          {/* Progress slider / display */}
                          <div>
                            <div className="flex justify-between text-[11px] font-bold text-gray-500 mb-1">
                              <span>Tiến độ</span>
                              <span className={isDone ? 'text-emerald-600' : 'text-indigo-600'}>{goal.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${isDone ? 'bg-emerald-500' : 'bg-indigo-500'
                                  }`}
                                style={{ width: `${goal.progress}%` }}
                              />
                            </div>
                          </div>

                          {/* Status and Dates */}
                          <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              {goal.deadline
                                ? `${new Date(goal.deadline).toLocaleDateString('vi-VN')}${getDaysRemainingText(goal.deadline)}`
                                : 'Không có deadline'}
                            </span>

                            {/* Status and Quick Action */}
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${statusInfo.bg} ${statusInfo.color}`}>
                                {statusInfo.label}
                              </span>

                              {/* Toggle complete button */}
                              <button
                                onClick={() => handleToggleGoalComplete(goal)}
                                className={`p-1.5 rounded-lg border transition-all ${isDone
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                                  : 'bg-white border-gray-200 text-gray-400 hover:border-indigo-200 hover:text-indigo-600'
                                  }`}
                                title={isDone ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"}
                              >
                                <CheckCircle2 size={13} fill={isDone ? "currentColor" : "none"} />
                              </button>
                            </div>
                          </div>

                          {/* Edit / Delete actions */}
                          <div className="flex justify-end gap-1.5 pt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openGoalModal(goal)}
                              className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-indigo-600 transition-colors"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteGoal(goal.id, goal.title)}
                              className="p-1 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

        </div>
      )}

      {/* --- SUB-TAB: LIFE GOALS (5 YEARS) --- */}
      {activeSubTab === 'life' && (
        <div className="space-y-6 max-w-2xl mx-auto">

          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-5 md:p-6 text-center shadow-sm">
            <h3 className="text-indigo-900 font-black text-lg md:text-xl flex items-center justify-center gap-2">
              <Sparkles className="text-yellow-500" size={20} /> Tầm nhìn 5 năm tới (2026 - 2031)
            </h3>
            <p className="text-indigo-700/70 text-xs md:text-sm mt-1.5">
              Liệt kê những cột mốc lớn trong cuộc sống bạn muốn chinh phục. Kéo thả để sắp xếp ưu tiên.
            </p>
          </div>

          {/* Life Goals List */}
          {lifeGoals.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16 px-4 text-center">
              <Star size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-600 font-bold">Chưa có mục tiêu 5 năm nào</p>
              <p className="text-gray-400 text-sm mt-1 mb-6">Mục tiêu dài hạn của bạn là gì? (Ví dụ: 💍 Cưới vợ, 🚗 Mua xe, 💰 Lương 100tr...)</p>
              <button
                onClick={() => openLifeModal()}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all"
              >
                + Khởi tạo ngay
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {lifeGoals.map((goal, index) => {
                const isDragTarget = draggedIndex === index;

                return (
                  <div
                    key={goal.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4 group cursor-grab active:cursor-grabbing ${goal.is_achieved ? 'border-emerald-100 bg-emerald-50/5' : 'border-gray-100'
                      } ${isDragTarget ? 'opacity-50 border-indigo-400 ring-2 ring-indigo-100' : ''}`}
                  >

                    {/* Left: Drag Handle & Checkbox & Icon */}
                    <div className="flex items-center gap-3 min-w-0">

                      {/* Drag Handle Icon (visible on hover / active) */}
                      <div className="text-gray-300 hover:text-gray-500 cursor-grab shrink-0 hidden md:block">
                        <Move size={16} />
                      </div>

                      {/* Tick Checkbox */}
                      <button
                        onClick={() => handleToggleLifeAchieved(goal)}
                        className={`shrink-0 transition-colors ${goal.is_achieved ? 'text-emerald-500' : 'text-gray-300 hover:text-gray-400'
                          }`}
                      >
                        {goal.is_achieved ? (
                          <CheckSquare size={20} className="fill-emerald-50" />
                        ) : (
                          <Square size={20} />
                        )}
                      </button>

                      {/* Icon */}
                      <span className="text-2xl shrink-0 p-1.5 bg-gray-50 rounded-xl group-hover:scale-110 transition-transform">
                        {goal.icon}
                      </span>

                      {/* Title */}
                      <div className="min-w-0">
                        <span className={`font-bold text-gray-800 text-sm md:text-base ${goal.is_achieved ? 'line-through text-gray-400 font-medium' : ''
                          }`}>
                          {goal.title}
                        </span>

                        {/* Target Year label */}
                        <span className="block text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full w-fit mt-1">
                          Năm dự kiến: {goal.target_year}
                        </span>
                      </div>

                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2">

                      {/* Manual Mobile Sort Buttons */}
                      <div className="flex flex-col md:hidden shrink-0">
                        <button
                          disabled={index === 0}
                          onClick={() => moveLifeGoal(index, 'up')}
                          className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-20"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          disabled={index === lifeGoals.length - 1}
                          onClick={() => moveLifeGoal(index, 'down')}
                          className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-20"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>

                      {/* Edit / Delete actions */}
                      <div className="flex items-center gap-1.5 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openLifeModal(goal)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-indigo-600 transition-colors"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteLifeGoal(goal.id, goal.title)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* --- SUB-TAB: CV BUILDER --- */}
      {activeSubTab === 'cv' && (
        <CVBuilder userId={userId} isPro={isPro} onUpgrade={onUpgrade} />
      )}

      {/* --- MODAL: CAREER GOAL ADD/EDIT --- */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">

            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-gray-900 font-black text-lg">
                {editingGoal ? '✏️ Sửa mục tiêu nghề nghiệp' : '🎯 Thêm mục tiêu nghề nghiệp'}
              </h3>
              <button
                onClick={() => setShowGoalModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveGoal} className="p-5 space-y-4 overflow-y-auto flex-1">

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Tên mục tiêu *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Thành thạo SQL nâng cao, Vẽ Wireframe..."
                  value={goalForm.title}
                  onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Phân loại *</label>
                  <select
                    value={goalForm.category}
                    onChange={(e) => setGoalForm({ ...goalForm, category: e.target.value as CareerGoalCategory })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="technical">Technical Skill</option>
                    <option value="domain">Domain Knowledge</option>
                    <option value="soft">Soft Skill</option>
                    <option value="project">Personal Project</option>
                    <option value="tool">Tool/Software</option>
                    <option value="certificate">Certificate</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Mức ưu tiên *</label>
                  <select
                    value={goalForm.priority}
                    onChange={(e) => setGoalForm({ ...goalForm, priority: e.target.value as CareerGoalPriority })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="high">Cao</option>
                    <option value="medium">Trung bình</option>
                    <option value="low">Thấp</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Mô tả chi tiết</label>
                <textarea
                  placeholder="Mô tả kỹ năng cần học, tài liệu ôn thi hoặc lộ trình thực hiện..."
                  value={goalForm.description}
                  onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                />
              </div>

              {/* Link */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Đường dẫn tài liệu / Dự án</label>
                <input
                  type="url"
                  placeholder="https://github.com/... hoặc https://coursera.org/..."
                  value={goalForm.link}
                  onChange={(e) => setGoalForm({ ...goalForm, link: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Ngày bắt đầu</label>
                  <input
                    type="date"
                    value={goalForm.start_date}
                    onChange={(e) => setGoalForm({ ...goalForm, start_date: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Deadline dự kiến</label>
                  <input
                    type="date"
                    value={goalForm.deadline}
                    onChange={(e) => setGoalForm({ ...goalForm, deadline: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              {/* Status and Progress */}
              <div className="grid grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Trạng thái *</label>
                  <select
                    value={goalForm.status}
                    onChange={(e) => {
                      const newStatus = e.target.value as CareerGoalStatus;
                      const defaultProgress = newStatus === 'completed' ? 100 : newStatus === 'not_started' ? 0 : goalForm.progress;
                      setGoalForm({ ...goalForm, status: newStatus, progress: defaultProgress });
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="not_started">Chưa bắt đầu</option>
                    <option value="in_progress">Đang học/làm</option>
                    <option value="completed">Hoàn thành</option>
                    <option value="overdue">Quá hạn</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                    <span>Tiến độ</span>
                    <span>{goalForm.progress}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={goalForm.progress}
                    onChange={(e) => {
                      const newProg = Number(e.target.value);
                      let newStatus = goalForm.status;
                      if (newProg === 100) newStatus = 'completed';
                      else if (newProg === 0) newStatus = 'not_started';
                      else if (goalForm.status === 'completed' || goalForm.status === 'not_started') newStatus = 'in_progress';

                      setGoalForm({ ...goalForm, progress: newProg, status: newStatus });
                    }}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowGoalModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-500 font-bold rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-indigo-100"
                >
                  Lưu
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: LIFE GOAL ADD/EDIT --- */}
      {showLifeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">

            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-gray-900 font-black text-lg">
                {editingLifeGoal ? '✏️ Sửa mục tiêu 5 năm' : '🌟 Thêm mục tiêu 5 năm'}
              </h3>
              <button
                onClick={() => setShowLifeModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveLifeGoal} className="p-5 space-y-4">

              {/* Icon Picker (Option B) */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Chọn Icon đại diện *</label>
                <div className="grid grid-cols-6 gap-2 p-3 bg-gray-50 rounded-2xl max-h-36 overflow-y-auto scrollbar-thin">
                  {LIFE_GOAL_ICONS.map(ic => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setLifeForm({ ...lifeForm, icon: ic })}
                      className={`text-xl p-2 rounded-xl transition-all ${lifeForm.icon === ic
                        ? 'bg-indigo-600 shadow-md scale-110'
                        : 'hover:bg-gray-200/70'
                        }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Tên mục tiêu *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Mua xe, Cưới vợ, Lương 100tr..."
                  value={lifeForm.title}
                  onChange={(e) => setLifeForm({ ...lifeForm, title: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Target Year */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Năm dự kiến đạt được *</label>
                <input
                  type="number"
                  min="2026"
                  max="2050"
                  required
                  value={lifeForm.target_year}
                  onChange={(e) => setLifeForm({ ...lifeForm, target_year: Number(e.target.value) })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              {/* Completed checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="life_achieved_checkbox"
                  checked={lifeForm.is_achieved}
                  onChange={(e) => setLifeForm({ ...lifeForm, is_achieved: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="life_achieved_checkbox" className="text-sm font-bold text-gray-600">Đã hoàn thành / đạt được</label>
              </div>

              {/* Buttons */}
              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowLifeModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-500 font-bold rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-indigo-100"
                >
                  Lưu
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: POSITION MANAGER --- */}
      {showPositionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[80vh]">

            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-gray-900 font-black text-lg">💼 Quản lý Vị trí Mục tiêu</h3>
              <button
                onClick={() => setShowPositionModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">

              {/* Add position inline input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ví dụ: IT Business Analyst, Data Analyst..."
                  value={newPositionTitle}
                  onChange={(e) => setNewPositionTitle(e.target.value)}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  onClick={handleAddPosition}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-indigo-100 shrink-0"
                >
                  Thêm
                </button>
              </div>

              {/* Positions List */}
              <div className="space-y-2 mt-4">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Danh sách đã thêm</label>
                {positions.length === 0 ? (
                  <p className="text-gray-400 text-xs text-center py-4">Chưa có vị trí nào. Hãy thêm ở trên.</p>
                ) : (
                  <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                    {positions.map(pos => (
                      <div key={pos.id} className="flex items-center justify-between py-2.5">
                        <span className="text-sm font-bold text-gray-700">{pos.title}</span>
                        <button
                          onClick={() => handleDeletePosition(pos.id, pos.title)}
                          className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg transition-colors"
                          title="Xóa vị trí"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowPositionModal(false)}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-all"
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- MODAL: AI SKILLS ADVISOR --- */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-indigo-100 overflow-hidden flex flex-col max-h-[90vh] transition-all relative">

            {/* Ambient Background Glowing Orbs */}
            <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-400/10 blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-purple-400/10 blur-3xl pointer-events-none" />

            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-6 text-white relative z-10 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-black text-lg md:text-xl flex items-center gap-2">
                  <Sparkles className="text-yellow-300 animate-pulse" size={22} />
                  Cố vấn Lộ trình Kỹ năng bằng AI
                </h3>
                <p className="text-white/80 text-xs md:text-sm mt-1">
                  Đồng bộ & tối ưu hóa lộ trình phát triển cho vị trí <strong>{currentPosition?.title}</strong> dựa trên bảng điểm GPA
                </p>
              </div>
              <button
                onClick={() => setShowAIModal(false)}
                className="p-1.5 hover:bg-white/10 rounded-xl text-white/90 hover:text-white transition-colors shrink-0 self-start"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 relative z-10 min-h-[300px] flex flex-col">
              {aiLoading ? (
                /* Premium Loading Screen */
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                  <div className="relative mb-6">
                    {/* Ring animations */}
                    <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="text-purple-600 animate-ping" size={20} />
                    </div>
                  </div>
                  <h4 className="font-bold text-gray-800 text-base mb-2">Trợ lý AI đang làm việc</h4>
                  <div className="h-6 overflow-hidden">
                    <p className="text-gray-500 text-sm animate-pulse transition-all duration-300">
                      {loadingSteps[loadingStep]}
                    </p>
                  </div>
                </div>
              ) : aiRecommendations.length === 0 ? (
                /* Empty / Error state */
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <AlertCircle size={48} className="text-rose-500" />
                  <div>
                    <h4 className="font-bold text-gray-800 text-base">Không nhận được đề xuất từ AI</h4>
                    <p className="text-gray-500 text-sm mt-1">Đã có lỗi xảy ra hoặc AI không tìm thấy gợi ý nào mới phù hợp.</p>
                  </div>
                  <button
                    onClick={triggerAIRecommendations}
                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-sm transition-all"
                  >
                    Thử lại
                  </button>
                </div>
              ) : (
                /* Recommendations checklist list */
                <div className="space-y-4">
                  <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-2xl p-4 text-xs text-indigo-800 leading-relaxed">
                    🚀 <strong>Phân tích khoảng trống tri thức:</strong> Trợ lý AI đã đối chiếu bảng điểm GPA của bạn để loại bỏ lý thuyết suông và tập trung vào các kỹ năng thực chiến, công cụ tiên tiến và dự án cá nhân thực tế cần có để đạt được vị trí <strong>{currentPosition?.title}</strong>.
                  </div>

                  <div className="space-y-3">
                    {aiRecommendations.map((rec, index) => {
                      const isSelected = selectedRecommendIndexes.includes(index);
                      const catInfo = CATEGORY_MAP[rec.category as CareerGoalCategory] || CATEGORY_MAP.technical;
                      const prioInfo = PRIORITY_MAP[rec.priority as CareerGoalPriority] || PRIORITY_MAP.medium;

                      return (
                        <div
                          key={index}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedRecommendIndexes(prev => prev.filter(i => i !== index));
                            } else {
                              setSelectedRecommendIndexes(prev => [...prev, index]);
                            }
                          }}
                          className={`border rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all duration-200 cursor-pointer flex items-start gap-3 select-none ${isSelected
                            ? 'border-indigo-200 bg-indigo-50/10'
                            : 'border-gray-100 bg-white'
                            }`}
                        >
                          {/* Checkbox */}
                          <div className={`mt-1.5 shrink-0 transition-colors ${isSelected ? 'text-indigo-600' : 'text-gray-300'
                            }`}>
                            {isSelected ? (
                              <CheckSquare size={18} className="fill-indigo-50" />
                            ) : (
                              <Square size={18} />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${catInfo.bg} ${catInfo.text} ${catInfo.border}`}>
                                {catInfo.label}
                              </span>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${prioInfo.bg} ${prioInfo.color}`}>
                                {prioInfo.label}
                              </span>
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-50 border border-slate-100 text-slate-600">
                                ⏳ {rec.duration_days} ngày
                              </span>
                            </div>

                            <h4 className="font-bold text-gray-800 text-sm md:text-base leading-snug">
                              {rec.title}
                            </h4>

                            <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">
                              {rec.description}
                            </p>

                            {rec.link && (
                              <a
                                href={rec.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()} // Prevent card toggle
                                className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-600 hover:text-indigo-800 transition-colors mt-2 bg-indigo-50/60 px-2 py-0.5 rounded-md"
                              >
                                <ExternalLink size={10} /> Xem tài nguyên học tập
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {!aiLoading && aiRecommendations.length > 0 && (
              <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 relative z-10">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedRecommendIndexes.length === aiRecommendations.length) {
                        setSelectedRecommendIndexes([]);
                      } else {
                        setSelectedRecommendIndexes(aiRecommendations.map((_, idx) => idx));
                      }
                    }}
                    className="text-xs font-bold text-gray-500 hover:text-indigo-600 transition-colors bg-white border border-gray-200 px-3 py-1.5 rounded-xl"
                  >
                    {selectedRecommendIndexes.length === aiRecommendations.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                  </button>
                  <span className="text-xs font-bold text-gray-400">
                    Đã chọn {selectedRecommendIndexes.length}/{aiRecommendations.length} gợi ý
                  </span>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAIModal(false)}
                    className="px-4 py-2 border border-gray-200 text-gray-500 font-bold rounded-xl text-sm hover:bg-gray-100 transition-colors"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    disabled={selectedRecommendIndexes.length === 0}
                    onClick={handleAddAIRecommendations}
                    className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-indigo-100 disabled:opacity-50 disabled:pointer-events-none hover:scale-[1.02] active:scale-[0.98]"
                  >
                    🚀 Thêm mục tiêu đã chọn
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(p => ({ ...p, isOpen: false }))}
        confirmText="Xóa"
        cancelText="Hủy"
      />

    </div>
  );
};

export default GoalsDashboard;
