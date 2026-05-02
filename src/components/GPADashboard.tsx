// File: src/components/GPADashboard.tsx
// GPA Calculator Dashboard — Quy chế ĐHQGHN 2022
// Phase 2 + 3: Core UI + Charts + History + Export/Import

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Plus, Trash2, Edit2, ChevronDown, ChevronRight, GraduationCap,
  BookOpen, AlertTriangle, TrendingUp, Award, Calculator, Save,
  X, Check, BarChart3, Info, FileText, ChevronLeft, Download, Upload,
  History, LineChart as LineChartIcon, Eye, Target, Zap, Star, ArrowRight
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar, Cell, ReferenceLine,
} from 'recharts';
import * as XLSX from 'xlsx';
import {
  GPASemester, GPACourse, GPATemplateType, SemesterType,
  GPAComputed, GPACumulativeData, GPAProjection,
} from '../types';
import ConfirmModal from './ConfirmModal';
import {
  computeAllCourses, computeCourse, calculateSemesterGPA,
  calculateCumulativeGPA, calculateCumulativeData,
  calculateSemesterSummary, getAcademicStanding,
  checkAcademicWarning, predictGraduationHonor,
  calculateRequiredGPA, validateScore, validateCredits,
  calculateGPAProjection, getMinimumGradeForGPA,
} from '../services/gpaCalculator';
import {
  GRADE_SCALE, TEMPLATE_WEIGHTS, TEMPLATE_LABELS,
  WARNING_THRESHOLDS, GRADUATION_HONORS, NON_GPA_COURSES,
  SEMESTER_TYPE_LABELS,
} from '../constants';

// ─── Types ─────────────────────────────
interface GPADashboardProps {
  semesters: GPASemester[];
  onAddSemester: (semester: Omit<GPASemester, 'id' | 'courses'>) => void;
  onUpdateSemester: (semester: GPASemester) => void;
  onDeleteSemester: (id: string) => void;
  onAddCourse: (semesterId: string, course: Omit<GPACourse, 'id' | 'computed'>) => void;
  onUpdateCourse: (course: GPACourse) => void;
  onDeleteCourse: (id: string) => void;
  onImportGPAData?: (data: any[]) => Promise<void>;
  targetCredits?: number;
  onUpdateTargetCredits?: (credits: number) => void;
  targetGPA?: number | null;
  targetSemesters?: number;
  onUpdateGPATarget?: (targetGPA: number | null, targetSemesters: number) => void;
  isLoading?: boolean;
  lang: 'vi' | 'en';
}

// ─── Helpers ───────────────────────────
const gradeColorClass = (letter: string | null): string => {
  if (!letter) return 'text-gray-400';
  if (letter === 'A+' || letter === 'A') return 'text-emerald-600 bg-emerald-50';
  if (letter === 'B+' || letter === 'B') return 'text-blue-600 bg-blue-50';
  if (letter === 'C+' || letter === 'C') return 'text-yellow-600 bg-yellow-50';
  if (letter === 'D+' || letter === 'D') return 'text-orange-600 bg-orange-50';
  return 'text-red-600 bg-red-50'; // F
};

const warningColorClass = (level: string | null): { bg: string; border: string; text: string; icon: string } => {
  switch (level) {
    case 'early_warning': return { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-800', icon: '⚠️' };
    case 'warning': return { bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-800', icon: '🟠' };
    case 'danger': return { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-800', icon: '🔴' };
    default: return { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800', icon: '✅' };
  }
};

// ─── Main Component ────────────────────
const GPADashboard: React.FC<GPADashboardProps> = ({
  semesters, onAddSemester, onUpdateSemester, onDeleteSemester,
  onAddCourse, onUpdateCourse, onDeleteCourse, onImportGPAData,
  targetCredits = 135, onUpdateTargetCredits,
  targetGPA: propTargetGPA, targetSemesters: propTargetSemesters = 4,
  onUpdateGPATarget,
  isLoading, lang
}) => {
  // ── State ──
  const [selectedSemesterId, setSelectedSemesterId] = useState<string | null>(null);
  const [showSemesterModal, setShowSemesterModal] = useState(false);
  const [editingSemester, setEditingSemester] = useState<GPASemester | null>(null);
  const [showMobileSemesterList, setShowMobileSemesterList] = useState(false);
  const [viewMode, setViewMode] = useState<'dashboard' | 'history' | 'charts' | 'target'>('dashboard');
  const [expandedHistorySemId, setExpandedHistorySemId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Semester form
  const [formSemType, setFormSemType] = useState<SemesterType>(SemesterType.HK1);
  const [formAcademicYear, setFormAcademicYear] = useState('2024-2025');
  const [formYearOfStudy, setFormYearOfStudy] = useState(1);

  // Target Credits edit
  const [isEditingCredits, setIsEditingCredits] = useState(false);
  const [tempCredits, setTempCredits] = useState(targetCredits.toString());

  // Auto-select first or current semester
  useEffect(() => {
    if (semesters.length > 0 && !selectedSemesterId) {
      const current = semesters.find(s => s.is_current);
      setSelectedSemesterId(current?.id || semesters[0].id);
    }
  }, [semesters, selectedSemesterId]);

  // ── Computed Data ──
  const semestersComputed = useMemo(() => {
    return semesters.map(sem => ({
      ...sem,
      courses: computeAllCourses(sem.courses),
      summary: calculateSemesterSummary(
        { ...sem, courses: computeAllCourses(sem.courses) },
        semesters.map(s => ({ ...s, courses: computeAllCourses(s.courses) }))
      ),
    }));
  }, [semesters]);

  const selectedSemester = semestersComputed.find(s => s.id === selectedSemesterId) || null;

  const cumulativeData: GPACumulativeData = useMemo(() => {
    const maxYear = Math.max(...semesters.map(s => s.year_of_study), 1);
    return calculateCumulativeData(
      semesters.map(s => ({ ...s, courses: computeAllCourses(s.courses) })),
      targetCredits,
      maxYear
    );
  }, [semesters, targetCredits]);

  // Group semesters by year of study
  const semestersByYear = useMemo(() => {
    const grouped = new Map<number, typeof semestersComputed>();
    semestersComputed
      .sort((a, b) => {
        if (a.year_of_study !== b.year_of_study) return a.year_of_study - b.year_of_study;
        const typeOrder = { HK1: 0, HK2: 1, HocHe: 2 };
        return (typeOrder[a.semester_type as keyof typeof typeOrder] || 0) - (typeOrder[b.semester_type as keyof typeof typeOrder] || 0);
      })
      .forEach(sem => {
        if (!grouped.has(sem.year_of_study)) grouped.set(sem.year_of_study, []);
        grouped.get(sem.year_of_study)!.push(sem);
      });
      
    return Array.from(grouped.entries()).map(([year, sems]) => {
      const allYearCourses = sems.flatMap(s => s.courses);
      const yearlyGPA = calculateSemesterGPA(allYearCourses);
      return {
        yearLabel: `Năm thứ ${year}`,
        sems,
        yearlyGPA
      };
    });
  }, [semestersComputed]);

  // ── Chart Data ──
  const chartData = useMemo(() => {
    return semestersComputed
      .sort((a, b) => {
        if (a.academic_year !== b.academic_year) return a.academic_year.localeCompare(b.academic_year);
        const typeOrder = { HK1: 0, HK2: 1, HocHe: 2 };
        return (typeOrder[a.semester_type as keyof typeof typeOrder] || 0) - (typeOrder[b.semester_type as keyof typeof typeOrder] || 0);
      })
      .map(sem => ({
        name: `${sem.name}\n${sem.academic_year}`,
        shortName: `${sem.semester_type === 'HocHe' ? 'HH' : sem.semester_type}`,
        year: sem.academic_year,
        semesterGPA: sem.summary?.semester_gpa ?? null,
        cumulativeGPA: sem.summary?.cumulative_gpa ?? null,
      }))
      .filter(d => d.semesterGPA !== null);
  }, [semestersComputed]);

  // ── Grade Distribution ──
  const gradeDistribution = useMemo(() => {
    const counts: Record<string, number> = { 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C+': 0, 'C': 0, 'D+': 0, 'D': 0, 'F': 0 };
    const coursesByGrade: Record<string, { name: string; credits: number; score10: number | null; semester: string }[]> = {
      'A+': [], 'A': [], 'B+': [], 'B': [], 'C+': [], 'C': [], 'D+': [], 'D': [], 'F': []
    };
    semestersComputed.forEach(sem => {
      sem.courses.forEach(c => {
        const letter = c.computed?.letterGrade;
        if (letter && letter in counts) {
          counts[letter]++;
          coursesByGrade[letter].push({
            name: c.name,
            credits: c.credits,
            score10: c.computed?.score10 ?? null,
            semester: sem.name,
          });
        }
      });
    });
    return Object.entries(counts).map(([grade, count]) => ({ grade, count, courses: coursesByGrade[grade] }));
  }, [semestersComputed]);

  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);

  const gradeColors: Record<string, string> = {
    'A+': '#059669', 'A': '#10B981', 'B+': '#3B82F6', 'B': '#60A5FA',
    'C+': '#F59E0B', 'C': '#FBBF24', 'D+': '#F97316', 'D': '#FB923C', 'F': '#EF4444'
  };

  // ── Handlers ──
  const handleAddSemester = () => {
    // Check for duplicates
    const isDuplicate = semesters.some(s => s.year_of_study === formYearOfStudy && s.semester_type === formSemType);
    if (isDuplicate) {
      alert(`Xin lỗi, Học kỳ này (Năm ${formYearOfStudy} - ${SEMESTER_TYPE_LABELS[formSemType as SemesterType]}) đã tồn tại trong danh sách! Vui lòng chọn học kỳ đó để thêm môn học.`);
      return;
    }

    const name = SEMESTER_TYPE_LABELS[formSemType as SemesterType] || formSemType;
    onAddSemester({
      name,
      academic_year: formAcademicYear,
      semester_type: formSemType,
      year_of_study: formYearOfStudy,
      is_current: semesters.length === 0,
    });
    setShowSemesterModal(false);
  };

  const handleAddNewCourse = (semesterId: string) => {
    onAddCourse(semesterId, {
      semester_id: semesterId,
      name: '',
      credits: 3,
      template: GPATemplateType.A,
      score_cc1: null,
      score_cc2: null,
      score_cc3: null,
      score_final: null,
      exclude_from_gpa: false,
      is_conditional: false,
    });
  };

  const handleExport = () => {
    const flatData: any[] = [];
    semesters.forEach(s => {
      if (s.courses.length === 0) {
        flatData.push({
          'Tên Học Kỳ': s.name,
          'Năm Học': s.academic_year,
          'Loại Kỳ (1,2,summer)': s.semester_type,
          'Năm Thứ': s.year_of_study,
          'Tên Môn Học': '',
          'Số Tín Chỉ': '',
          'Mẫu Tính Điểm (A,B,C)': '',
          'Điểm CC1': '',
          'Điểm CC2': '',
          'Điểm CC3': '',
          'Điểm Cuối Kỳ': '',
          'Bỏ Qua GPA': '',
        });
      } else {
        s.courses.forEach(c => {
          flatData.push({
            'Tên Học Kỳ': s.name,
            'Năm Học': s.academic_year,
            'Loại Kỳ (1,2,summer)': s.semester_type,
            'Năm Thứ': s.year_of_study,
            'Tên Môn Học': c.name,
            'Số Tín Chỉ': c.credits,
            'Mẫu Tính Điểm (A,B,C)': c.template,
            'Điểm CC1': c.score_cc1 ?? '',
            'Điểm CC2': c.score_cc2 ?? '',
            'Điểm CC3': c.score_cc3 ?? '',
            'Điểm Cuối Kỳ': c.score_final ?? '',
            'Bỏ Qua GPA': c.exclude_from_gpa ? 'x' : '',
          });
        });
      }
    });

    const ws = XLSX.utils.json_to_sheet(flatData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'GPA Data');
    XLSX.writeFile(wb, `gpa_backup_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

      const semMap = new Map<string, any>();
      data.forEach((row: any) => {
        const semName = row['Tên Học Kỳ'];
        if (!semName) return;
        
        const year = String(row['Năm Học'] || '2023-2024');
        const key = `${semName}-${year}`;
        
        if (!semMap.has(key)) {
          semMap.set(key, {
            name: String(semName),
            academic_year: year,
            semester_type: String(row['Loại Kỳ (1,2,summer)'] || '1'),
            year_of_study: Number(row['Năm Thứ']) || 1,
            is_current: false,
            courses: []
          });
        }
        
        const courseName = row['Tên Môn Học'];
        if (courseName) {
          semMap.get(key).courses.push({
            name: String(courseName),
            credits: Number(row['Số Tín Chỉ']) || 3,
            template: String(row['Mẫu Tính Điểm (A,B,C)']) || 'A',
            score_cc1: row['Điểm CC1'] !== '' && row['Điểm CC1'] !== undefined ? Number(row['Điểm CC1']) : null,
            score_cc2: row['Điểm CC2'] !== '' && row['Điểm CC2'] !== undefined ? Number(row['Điểm CC2']) : null,
            score_cc3: row['Điểm CC3'] !== '' && row['Điểm CC3'] !== undefined ? Number(row['Điểm CC3']) : null,
            score_final: row['Điểm Cuối Kỳ'] !== '' && row['Điểm Cuối Kỳ'] !== undefined ? Number(row['Điểm Cuối Kỳ']) : null,
            exclude_from_gpa: row['Bỏ Qua GPA'] === 'x' || row['Bỏ Qua GPA'] === 'X',
            is_conditional: false
          });
        }
      });

      const importedData = Array.from(semMap.values());
      if (importedData.length === 0) {
        alert('File Excel không có dữ liệu học kỳ hợp lệ!');
        return;
      }

      if (!window.confirm(`Bạn muốn Import ${importedData.length} học kỳ từ Excel? Dữ liệu này sẽ được gộp chung với dữ liệu hiện tại.`)) return;

      if (onImportGPAData) {
        await onImportGPAData(importedData);
        alert('Import dữ liệu GPA từ file Excel thành công!');
      } else {
        alert('Tính năng import đang bị lỗi cấu hình (onImportGPAData missing)!');
      }
    } catch (err: any) {
      alert('Lỗi đọc file Excel: ' + err.message);
    } finally {
      e.target.value = ''; // Reset
    }
  };

  // ── Academic year options ──
  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, i) => {
      const y = now - 3 + i;
      return `${y}-${y + 1}`;
    });
  }, []);

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════

  // ── Onboarding (no semesters) ──
  if (semesters.length === 0 && !isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header gradient */}
          <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 p-8 text-white text-center">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
              <GraduationCap size={40} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Chào mừng đến với GPA Tracker!</h2>
            <p className="text-white/80 text-sm">Hãy bắt đầu bằng cách thêm học kỳ đầu tiên</p>
          </div>

          <div className="p-8 space-y-6">
            {/* Academic year */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Năm học</label>
              <select
                value={formAcademicYear}
                onChange={e => setFormAcademicYear(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 font-medium"
              >
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* Semester type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Học kỳ</label>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(SEMESTER_TYPE_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFormSemType(key as SemesterType)}
                    className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all border-2 ${
                      formSemType === key
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Year of study */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Năm thứ mấy?</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map(y => (
                  <button
                    key={y}
                    onClick={() => setFormYearOfStudy(y)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                      formYearOfStudy === y
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    Năm {y}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleAddSemester}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200 text-base"
            >
              🚀 Bắt đầu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <GraduationCap size={22} className="text-white" />
            </div>
            GPA Tracker
          </h2>
          <p className="text-gray-500 text-sm mt-1">Quy chế ĐHQGHN 2022</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
            {[
              { key: 'dashboard' as const, label: 'Nhập điểm', icon: <GraduationCap size={14} /> },
              { key: 'target' as const, label: 'Mục tiêu', icon: <Target size={14} /> },
              { key: 'charts' as const, label: 'Biểu đồ', icon: <LineChartIcon size={14} /> },
              { key: 'history' as const, label: 'Lịch sử', icon: <History size={14} /> },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setViewMode(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === tab.key
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon} <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Export/Import */}
          <button onClick={handleExport} className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors" title="Export ra Excel">
            <Download size={18} />
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors" title="Import từ Excel">
            <Upload size={18} />
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx, .xls" onChange={handleImport} className="hidden" />

          {/* Mobile semester toggle */}
          <button
            onClick={() => setShowMobileSemesterList(!showMobileSemesterList)}
            className="md:hidden flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 shadow-sm"
          >
            <BookOpen size={16} />
            {selectedSemester ? `${selectedSemester.name} — ${selectedSemester.academic_year}` : 'Chọn học kỳ'}
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* ─── Mobile semester selector dropdown ─── */}
      {showMobileSemesterList && (
        <div className="md:hidden bg-white rounded-2xl shadow-lg border border-gray-100 p-4 space-y-2 animate-slide-up">
          {semestersByYear.map(({ yearLabel, sems, yearlyGPA }) => (
            <div key={yearLabel}>
              <div className="flex justify-between items-center px-2 py-1">
                <div className="text-xs font-bold text-indigo-500 uppercase tracking-wider">{yearLabel}</div>
                {yearlyGPA != null && <div className="text-xs font-bold text-gray-500">GPA Năm: {yearlyGPA.toFixed(2)}</div>}
              </div>
              {sems.map(sem => (
                <button
                  key={sem.id}
                  onClick={() => { setSelectedSemesterId(sem.id); setShowMobileSemesterList(false); }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    selectedSemesterId === sem.id ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {sem.is_current && <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full mr-2">●</span>}
                  {sem.name}
                  {sem.summary?.semester_gpa != null && (
                    <span className="float-right text-xs text-gray-400">GPA: {sem.summary.semester_gpa.toFixed(2)}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
          <button
            onClick={() => { setShowSemesterModal(true); setShowMobileSemesterList(false); }}
            className="w-full py-2.5 text-sm font-semibold text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors"
          >
            + Thêm học kỳ mới
          </button>
        </div>
      )}

      <div className="flex gap-6">
        {/* ─── Desktop Sidebar ─── */}
        <div className="hidden md:block w-64 shrink-0 space-y-4">
          {/* Cumulative GPA Card */}
          <div className="bg-gradient-to-br from-cyan-500 via-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-xl shadow-blue-200/50">
            <div className="text-xs font-medium text-white/70 uppercase tracking-wider">GPA Tích lũy</div>
            <div className="text-4xl font-black mt-1 tracking-tight">
              {cumulativeData.gpa != null ? cumulativeData.gpa.toFixed(2) : '—'}
            </div>
            <div className="text-sm text-white/80 mt-2">
              {cumulativeData.academic_standing || 'Chưa có dữ liệu'}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-white/60">
              <Award size={14} />
              {isEditingCredits ? (
                <div className="flex items-center gap-1">
                  <span>{cumulativeData.credits_accumulated} / </span>
                  <input
                    type="number"
                    value={tempCredits}
                    onChange={e => setTempCredits(e.target.value)}
                    className="w-12 bg-white/20 text-white border border-white/40 focus:border-white focus:bg-white/30 outline-none p-0.5 rounded text-xs no-arrows transition-all"
                    autoFocus
                  />
                  <span> TC</span>
                  <button onClick={() => {
                      if (onUpdateTargetCredits) onUpdateTargetCredits(Number(tempCredits) || 120);
                      setIsEditingCredits(false);
                    }} className="ml-2 bg-emerald-500 text-white hover:bg-emerald-400 p-1 rounded transition-colors" title="Lưu">
                    <Check size={12} strokeWidth={3} />
                  </button>
                  <button onClick={() => {
                      setTempCredits(targetCredits.toString());
                      setIsEditingCredits(false);
                    }} className="bg-red-500/80 text-white hover:bg-red-400/80 p-1 rounded transition-colors" title="Hủy">
                    <X size={12} strokeWidth={3} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span>{cumulativeData.credits_accumulated} / {cumulativeData.total_credits_required} TC</span>
                  <button onClick={() => setIsEditingCredits(!isEditingCredits)} className="text-white/60 hover:text-white transition-colors ml-1" title="Sửa Tổng Tín Chỉ Mục Tiêu">
                    <Edit2 size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Semester list */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700">Học kỳ</span>
              <button
                onClick={() => setShowSemesterModal(true)}
                className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                + Thêm
              </button>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {semestersByYear.map(({ yearLabel, sems, yearlyGPA }) => (
                <div key={yearLabel}>
                  <div className="px-4 py-2 flex justify-between items-center bg-gray-50 sticky top-0 z-10 border-y border-gray-100 shadow-sm">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{yearLabel}</span>
                    {yearlyGPA != null && <span className="text-[10px] font-bold text-gray-500">GPA ĐẠT: {yearlyGPA.toFixed(2)}</span>}
                  </div>
                  {sems.map(sem => (
                    <button
                      key={sem.id}
                      onClick={() => setSelectedSemesterId(sem.id)}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between transition-all border-l-3 ${
                        selectedSemesterId === sem.id
                          ? 'bg-indigo-50/80 border-l-indigo-500 text-indigo-700'
                          : 'border-l-transparent text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {sem.is_current && (
                          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                        )}
                        <span className="text-sm font-medium">{sem.name}</span>
                      </div>
                      {sem.summary?.semester_gpa != null && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          sem.summary.semester_gpa >= 3.2 ? 'bg-emerald-50 text-emerald-600' :
                          sem.summary.semester_gpa >= 2.0 ? 'bg-blue-50 text-blue-600' :
                          'bg-red-50 text-red-600'
                        }`}>
                          {sem.summary.semester_gpa.toFixed(2)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Main Content ─── */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* ══════════ DASHBOARD VIEW ══════════ */}
          {viewMode === 'dashboard' && (
            <>
              {selectedSemester ? (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <SummaryCard
                      label="GPA Học kỳ"
                      value={selectedSemester.summary?.semester_gpa?.toFixed(2) || '—'}
                      sub={selectedSemester.summary?.academic_standing || ''}
                      icon={<BarChart3 size={18} />}
                      color="indigo"
                    />
                    <SummaryCard
                      label="GPA Tích lũy"
                      value={cumulativeData.gpa?.toFixed(2) || '—'}
                      sub={cumulativeData.academic_standing || ''}
                      icon={<TrendingUp size={18} />}
                      color="purple"
                    />
                    <SummaryCard
                      label="Xếp loại"
                      value={selectedSemester.summary?.academic_standing || '—'}
                      sub={`Học kỳ này`}
                      icon={<Award size={18} />}
                      color="blue"
                    />
                    <SummaryCard
                      label="Tín chỉ"
                      value={`${cumulativeData.credits_accumulated}`}
                      sub={`/ ${cumulativeData.total_credits_required} TC`}
                      icon={<BookOpen size={18} />}
                      color="emerald"
                    />
                  </div>

                  {/* Warning Banner */}
                  {cumulativeData.warning_level && cumulativeData.warning_level !== 'safe' && (
                    <WarningBanner
                      level={cumulativeData.warning_level}
                      cumulativeGPA={cumulativeData.gpa}
                      yearOfStudy={selectedSemester.year_of_study}
                    />
                  )}

                  {/* Semester Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">
                        {selectedSemester.name} — {selectedSemester.academic_year}
                      </h3>
                      <p className="text-xs text-gray-500">
                        Năm thứ {selectedSemester.year_of_study} · {TEMPLATE_LABELS[selectedSemester.courses[0]?.template] || 'Chưa có môn'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddNewCourse(selectedSemester.id)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        <Plus size={16} /> Thêm môn
                      </button>
                      <button
                        onClick={() => {
                          setConfirmDialog({
                            isOpen: true,
                            title: 'Xóa học kỳ',
                            message: `Bạn có chắc chắn muốn xóa "${selectedSemester.name} — ${selectedSemester.academic_year}"?`,
                            onConfirm: () => {
                              onDeleteSemester(selectedSemester.id);
                              setSelectedSemesterId(null);
                            }
                          });
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        title="Xóa học kỳ"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Course Input Table */}
                  <CourseTable
                    courses={selectedSemester.courses}
                    onUpdateCourse={onUpdateCourse}
                    onDeleteCourse={onDeleteCourse}
                  />

                  {/* Semester Summary */}
                  {selectedSemester.courses.length > 0 && (
                    <div className="bg-gradient-to-r from-gray-50 to-indigo-50/30 rounded-2xl border border-gray-100 p-5">
                      <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <Calculator size={16} /> Tóm tắt học kỳ
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                        <MiniStat label="TC đăng ký" value={selectedSemester.summary?.credits_registered || 0} />
                        <MiniStat label="TC tính GPA" value={selectedSemester.summary?.credits_gpa || 0} />
                        <MiniStat label="TC đạt" value={selectedSemester.summary?.credits_passed || 0} />
                        <MiniStat label="GPA Học kỳ" value={selectedSemester.summary?.semester_gpa?.toFixed(2) || '—'} highlight />
                        <MiniStat label="GPA Tích lũy" value={selectedSemester.summary?.cumulative_gpa?.toFixed(2) || '—'} highlight />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
                  <GraduationCap size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-400 font-medium">Chọn một học kỳ từ sidebar hoặc tạo mới</p>
                </div>
              )}
            </>
          )}

          {/* ══════════ CHARTS VIEW ══════════ */}
          {viewMode === 'charts' && (
            <div className="space-y-6">
              {/* GPA Progress Chart */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                    <TrendingUp size={16} className="text-indigo-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Tiến trình GPA theo học kỳ</h3>
                </div>
                {chartData.length >= 1 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="shortName" tick={{ fontSize: 12, fill: '#6B7280' }} />
                      <YAxis domain={[0, 4]} ticks={[0, 1, 2, 3, 3.6, 4]} tick={{ fontSize: 11, fill: '#6B7280' }} />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)' }}
                        formatter={(value: number | undefined, name: string | undefined) => [
                          (value ?? 0).toFixed(2),
                          name === 'semesterGPA' ? 'GPA Học kỳ' : 'GPA Tích lũy'
                        ]}
                        labelFormatter={(label) => {
                          const item = chartData.find(d => d.shortName === label);
                          return item ? `${item.name}` : label;
                        }}
                      />
                      <Legend formatter={(value) => value === 'semesterGPA' ? 'GPA Học kỳ' : 'GPA Tích lũy'} />
                      <ReferenceLine y={2.0} stroke="#F59E0B" strokeDasharray="5 5" label={{ value: 'TB', position: 'right', fill: '#F59E0B', fontSize: 10 }} />
                      <ReferenceLine y={3.2} stroke="#10B981" strokeDasharray="5 5" label={{ value: 'Giỏi', position: 'right', fill: '#10B981', fontSize: 10 }} />
                      <Line type="monotone" dataKey="semesterGPA" stroke="#818CF8" strokeWidth={2.5} dot={{ fill: '#818CF8', strokeWidth: 2, r: 5 }} activeDot={{ r: 7 }} connectNulls />
                      <Line type="monotone" dataKey="cumulativeGPA" stroke="#6366F1" strokeWidth={3} dot={{ fill: '#6366F1', strokeWidth: 2, r: 5 }} activeDot={{ r: 7 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-60 flex items-center justify-center text-gray-400 text-sm">
                    Nhập điểm ít nhất 1 học kỳ để xem biểu đồ
                  </div>
                )}
              </div>

              {/* Grade Distribution Chart */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                    <BarChart3 size={16} className="text-purple-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Phân bổ điểm chữ</h3>
                </div>
                {gradeDistribution.some(d => d.count > 0) ? (
                  <>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={gradeDistribution} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="grade" tick={{ fontSize: 12, fontWeight: 600, fill: '#374151' }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB' }}
                          formatter={(value: number | undefined) => [`${value ?? 0} môn`, 'Số lượng']}
                        />
                        <Bar
                          dataKey="count"
                          radius={[8, 8, 0, 0]}
                          maxBarSize={40}
                          cursor="pointer"
                          onClick={(data: any) => {
                            if (data && data.grade && data.count > 0) {
                              setSelectedGrade(prev => prev === data.grade ? null : data.grade);
                            }
                          }}
                        >
                          {gradeDistribution.map((entry) => (
                            <Cell
                              key={entry.grade}
                              fill={gradeColors[entry.grade] || '#6B7280'}
                              opacity={selectedGrade && selectedGrade !== entry.grade ? 0.35 : 1}
                              stroke={selectedGrade === entry.grade ? gradeColors[entry.grade] : 'none'}
                              strokeWidth={selectedGrade === entry.grade ? 3 : 0}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    {/* Course detail panel when a bar is clicked */}
                    {selectedGrade && (() => {
                      const selected = gradeDistribution.find(d => d.grade === selectedGrade);
                      if (!selected || selected.courses.length === 0) return null;
                      return (
                        <div className="mt-4 border border-gray-100 rounded-xl overflow-hidden animate-fade-in">
                          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: gradeColors[selectedGrade] }}
                              />
                              <span className="text-sm font-bold text-gray-700">
                                Điểm {selectedGrade} — {selected.courses.length} môn
                              </span>
                            </div>
                            <button
                              onClick={() => setSelectedGrade(null)}
                              className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                              <X size={14} className="text-gray-400" />
                            </button>
                          </div>
                          <div className="divide-y divide-gray-50 max-h-52 overflow-y-auto">
                            {selected.courses.map((course, i) => (
                              <div key={i} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-800 truncate">{course.name}</div>
                                  <div className="text-[11px] text-gray-400">{course.semester}</div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 ml-3">
                                  <span className="text-xs text-gray-500">{course.credits} TC</span>
                                  <span
                                    className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                                    style={{ backgroundColor: gradeColors[selectedGrade] }}
                                  >
                                    {course.score10 != null ? course.score10.toFixed(1) : '—'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                    Chưa có dữ liệu điểm
                  </div>
                )}
              </div>

              {/* Graduation Projection */}
              {cumulativeData.gpa != null && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                      <Award size={16} className="text-purple-600" />
                    </div>
                    <h3 className="font-bold text-gray-800">Dự báo hạng tốt nghiệp</h3>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {GRADUATION_HONORS.map(h => {
                      const isActive = cumulativeData.gpa! >= h.min && cumulativeData.gpa! <= h.max;
                      return (
                        <div
                          key={h.label}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            isActive
                              ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg scale-105'
                              : 'bg-gray-50 text-gray-400'
                          }`}
                        >
                          {h.label} ({h.min.toFixed(2)}–{h.max.toFixed(2)})
                        </div>
                      );
                    })}
                  </div>
                  {/* Credit Progress Bar */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                      <span>Tiến độ tín chỉ</span>
                      <span className="font-semibold">{cumulativeData.credits_accumulated} / {cumulativeData.total_credits_required} TC ({Math.round((cumulativeData.credits_accumulated / cumulativeData.total_credits_required) * 100)}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((cumulativeData.credits_accumulated / cumulativeData.total_credits_required) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════ HISTORY VIEW ══════════ */}
          {viewMode === 'history' && (
            <div className="space-y-4">
              {/* Overall Summary */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <MiniStat label="Tổng kỳ" value={semestersComputed.length} />
                  <MiniStat label="GPA Tích lũy" value={cumulativeData.gpa?.toFixed(2) || '—'} highlight />
                  <MiniStat label="TC Tích lũy" value={cumulativeData.credits_accumulated} />
                  <MiniStat label="Hạng TN" value={cumulativeData.graduation_projection || '—'} />
                </div>
              </div>

              {/* Semester Accordion */}
              {semestersByYear.map(({ yearLabel, sems, yearlyGPA }) => (
                <div key={yearLabel}>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1 flex justify-between items-center">
                    <span>📅 {yearLabel}</span>
                    {yearlyGPA != null && <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">GPA NĂM: {yearlyGPA.toFixed(2)}</span>}
                  </div>
                  <div className="space-y-3">
                    {sems.map(sem => {
                      const isExpanded = expandedHistorySemId === sem.id;
                      const gpaColor = (sem.summary?.semester_gpa ?? 0) >= 3.2 ? 'text-emerald-600' :
                                       (sem.summary?.semester_gpa ?? 0) >= 2.0 ? 'text-blue-600' : 'text-red-600';
                      return (
                        <div key={sem.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                          {/* Semester header row */}
                          <button
                            onClick={() => setExpandedHistorySemId(isExpanded ? null : sem.id)}
                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${sem.is_current ? 'bg-indigo-500 animate-pulse' : 'bg-gray-300'}`} />
                              <div>
                                <span className="text-sm font-semibold text-gray-800">{sem.name}</span>
                                <span className="text-xs text-gray-400 ml-2">Năm {sem.year_of_study}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <span className={`text-lg font-black ${gpaColor}`}>
                                  {sem.summary?.semester_gpa?.toFixed(2) || '—'}
                                </span>
                                <span className="text-[10px] text-gray-400 block">
                                  {sem.summary?.credits_registered || 0} TC · {sem.summary?.academic_standing || ''}
                                </span>
                              </div>
                              {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                            </div>
                          </button>

                          {/* Expanded courses */}
                          {isExpanded && (
                            <div className="border-t border-gray-100 bg-gray-50/30">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-gray-100">
                                    <th className="text-left px-4 py-2 font-semibold text-gray-500">Môn học</th>
                                    <th className="text-center px-2 py-2 font-semibold text-gray-500 w-12">TC</th>
                                    <th className="text-center px-2 py-2 font-semibold text-gray-500 w-16">Điểm/10</th>
                                    <th className="text-center px-2 py-2 font-semibold text-gray-500 w-12">Chữ</th>
                                    <th className="text-center px-2 py-2 font-semibold text-gray-500 w-14">Thang 4</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {sem.courses.map(c => {
                                    const comp = c.computed || computeCourse(c);
                                    return (
                                      <tr key={c.id} className={`${c.exclude_from_gpa ? 'opacity-50' : ''} ${comp.letterGrade === 'F' ? 'bg-red-50/50' : ''}`}>
                                        <td className="px-4 py-2 font-medium text-gray-700">
                                          {c.name || <span className="text-gray-300 italic">Chưa đặt tên</span>}
                                          {c.exclude_from_gpa && <span className="text-[8px] bg-gray-200 text-gray-500 px-1 py-0.5 rounded ml-1">∅GPA</span>}
                                        </td>
                                        <td className="text-center text-gray-600 font-medium">{c.credits}</td>
                                        <td className="text-center font-bold text-gray-800">{comp.score10?.toFixed(1) || '—'}</td>
                                        <td className="text-center">
                                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${gradeColorClass(comp.letterGrade)}`}>
                                            {comp.letterGrade || '—'}
                                          </span>
                                        </td>
                                        <td className="text-center font-medium text-gray-600">{comp.grade4?.toFixed(1) || '—'}</td>
                                      </tr>
                                    );
                                  })}
                                  {sem.courses.length === 0 && (
                                    <tr><td colSpan={5} className="px-4 py-3 text-center text-gray-400">Chưa có môn học</td></tr>
                                  )}
                                </tbody>
                              </table>
                              {/* Semester totals */}
                              <div className="px-4 py-3 bg-gradient-to-r from-indigo-50/50 to-purple-50/30 border-t border-gray-100 flex justify-between text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                <span>TC đăng ký: {sem.summary?.credits_registered}</span>
                                <span>TC đạt: {sem.summary?.credits_passed}</span>
                                <span className="text-indigo-600">GPA kỳ: {sem.summary?.semester_gpa?.toFixed(2) || '—'}</span>
                                <span className="text-purple-600">GPA TL: {sem.summary?.cumulative_gpa?.toFixed(2) || '—'}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {semestersComputed.length === 0 && (
                <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
                  <History size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-400 font-medium">Chưa có lịch sử học kỳ</p>
                </div>
              )}
            </div>
          )}

          {/* ══════════ TARGET VIEW ══════════ */}
          {viewMode === 'target' && (
            <GPATargetPanel
              semesters={semesters}
              cumulativeData={cumulativeData}
              targetCredits={targetCredits}
              propTargetGPA={propTargetGPA}
              propTargetSemesters={propTargetSemesters}
              onUpdateGPATarget={onUpdateGPATarget}
            />
          )}
        </div>
      </div>

      {/* ─── Add Semester Modal ─── */}
      {showSemesterModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowSemesterModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Thêm học kỳ mới</h3>
              <button onClick={() => setShowSemesterModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Năm học</label>
              <select value={formAcademicYear} onChange={e => setFormAcademicYear(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
              >
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Loại học kỳ</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(SEMESTER_TYPE_LABELS).map(([key, label]) => (
                  <button key={key} onClick={() => setFormSemType(key as SemesterType)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                      formSemType === key ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Năm thứ</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map(y => (
                  <button key={y} onClick={() => setFormYearOfStudy(y)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                      formYearOfStudy === y ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleAddSemester}
              className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Thêm học kỳ
            </button>
          </div>
        </div>
      )}

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

// ═════════════════════════════════════════
// SUB-COMPONENTS
// ═════════════════════════════════════════

// ── Summary Card ──
const SummaryCard: React.FC<{ label: string; value: string; sub: string; icon: React.ReactNode; color: string }> = ({ label, value, sub, icon, color }) => {
  const colorMap: Record<string, string> = {
    indigo: 'from-indigo-500 to-indigo-600',
    purple: 'from-purple-500 to-purple-600',
    blue: 'from-blue-500 to-blue-600',
    emerald: 'from-emerald-500 to-emerald-600',
  };
  const bgMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    purple: 'bg-purple-50 text-purple-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bgMap[color] || bgMap.indigo}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{sub}</div>
    </div>
  );
};

// ── Mini Stat ──
const MiniStat: React.FC<{ label: string; value: string | number; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div>
    <div className={`text-xl font-bold ${highlight ? 'text-indigo-600' : 'text-gray-800'}`}>{value}</div>
    <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">{label}</div>
  </div>
);

// ── Warning Banner ──
const WarningBanner: React.FC<{ level: string; cumulativeGPA: number | null; yearOfStudy: number }> = ({ level, cumulativeGPA, yearOfStudy }) => {
  const colors = warningColorClass(level);
  const threshold = WARNING_THRESHOLDS.find(t => t.year === Math.min(yearOfStudy, 4));

  return (
    <div className={`${colors.bg} ${colors.border} border-2 rounded-2xl p-5 animate-pulse-slow`}>
      <div className={`flex items-start gap-3 ${colors.text}`}>
        <AlertTriangle size={22} className="shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-sm mb-1">
            {level === 'danger' ? '🚨 CẢNH BÁO NGUY HIỂM' : level === 'warning' ? '⚠️ CẢNH BÁO HỌC VỤ' : '⚡ CẬN NGƯỠNG CẢNH BÁO'}
          </h4>
          <p className="text-sm opacity-90">
            GPA tích lũy hiện tại: <strong>{cumulativeGPA?.toFixed(2)}</strong>
            {threshold && <> · Ngưỡng an toàn năm {yearOfStudy}: <strong>{threshold.cumulative}</strong></>}
          </p>
          {threshold && cumulativeGPA != null && cumulativeGPA < threshold.cumulative && (
            <p className="text-xs mt-2 opacity-75">
              Cần tăng {(threshold.cumulative - cumulativeGPA).toFixed(2)} điểm để thoát ngưỡng cảnh báo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Course Input Table ──
const CourseTable: React.FC<{
  courses: GPACourse[];
  onUpdateCourse: (course: GPACourse) => void;
  onDeleteCourse: (id: string) => void;
}> = ({ courses, onUpdateCourse, onDeleteCourse }) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const handleScoreChange = useCallback((course: GPACourse, field: string, value: string) => {
    const numVal = value === '' ? null : parseFloat(value);
    if (numVal !== null && (isNaN(numVal) || numVal < 0 || numVal > 10)) return;

    const updated = { ...course, [field]: numVal };
    // Recompute
    updated.computed = computeCourse(updated);
    onUpdateCourse(updated);
  }, [onUpdateCourse]);

  const handleFieldChange = useCallback((course: GPACourse, field: string, value: any) => {
    const updated = { ...course, [field]: value };
    if (field === 'template') {
      // Reset CC3 if switching away from template B
      if (value !== GPATemplateType.B) updated.score_cc3 = null;
    }
    updated.computed = computeCourse(updated);
    onUpdateCourse(updated);
  }, [onUpdateCourse]);

  if (courses.length === 0) {
    return (
      <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
        <BookOpen size={36} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-400 font-medium">Chưa có môn học nào</p>
        <p className="text-gray-400 text-xs mt-1">Nhấn "Thêm môn" để bắt đầu nhập điểm</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/80 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 min-w-[200px]">Tên môn học</th>
              <th className="text-center px-2 py-3 font-semibold text-gray-600 w-16">TC</th>
              <th className="text-center px-2 py-3 font-semibold text-gray-600 w-24">Template</th>
              <th className="text-center px-2 py-3 font-semibold text-gray-600 w-20">CC1</th>
              <th className="text-center px-2 py-3 font-semibold text-gray-600 w-20">CC2</th>
              <th className="text-center px-2 py-3 font-semibold text-gray-600 w-20">CC3</th>
              <th className="text-center px-2 py-3 font-semibold text-gray-600 w-20">Cuối kỳ</th>
              <th className="text-center px-2 py-3 font-semibold text-gray-600 w-20">Điểm/10</th>
              <th className="text-center px-2 py-3 font-semibold text-gray-600 w-16">Chữ</th>
              <th className="text-center px-2 py-3 font-semibold text-gray-600 w-14">∅GPA</th>
              <th className="text-center px-2 py-3 font-semibold text-gray-600 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {courses.map(course => {
              const computed = course.computed || computeCourse(course);
              const isExcluded = course.exclude_from_gpa || course.is_conditional;
              const templateWeights = TEMPLATE_WEIGHTS[course.template];

              return (
                <tr
                  key={course.id}
                  className={`group hover:bg-indigo-50/30 transition-colors ${isExcluded ? 'opacity-50' : ''} ${computed.letterGrade === 'F' ? 'bg-red-50/30' : ''}`}
                >
                  {/* Tên môn */}
                  <td className="px-4 py-2.5">
                    <input
                      type="text"
                      value={course.name}
                      onChange={e => handleFieldChange(course, 'name', e.target.value)}
                      placeholder="Tên môn học..."
                      className="w-full bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-indigo-400 focus:ring-0 px-0 py-1 text-sm font-medium text-gray-800 placeholder:text-gray-300 transition-colors"
                    />
                    {course.is_conditional && <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded mt-0.5 inline-block">HP điều kiện</span>}
                  </td>

                  {/* Tín chỉ */}
                  <td className="px-2 py-2.5 text-center">
                    <input
                      type="number" min="1" max="10"
                      value={course.credits}
                      onChange={e => handleFieldChange(course, 'credits', parseInt(e.target.value) || 1)}
                      className="w-14 text-center bg-gray-50 border border-gray-200 rounded-lg py-1.5 text-sm font-medium focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                    />
                  </td>

                  {/* Template */}
                  <td className="px-2 py-2.5 text-center">
                    <select
                      value={course.template}
                      onChange={e => handleFieldChange(course, 'template', e.target.value)}
                      className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-medium text-center focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                    </select>
                    <div className="text-[9px] text-gray-400 mt-0.5">
                      {course.template === 'A' ? '10%+30%' : course.template === 'B' ? '10+10+20%' : '20%+20%'}
                    </div>
                  </td>

                  {/* CC1 */}
                  <td className="px-2 py-2.5 text-center">
                    <ScoreInput
                      value={course.score_cc1}
                      onChange={v => handleScoreChange(course, 'score_cc1', v)}
                      weight={templateWeights?.cc1}
                    />
                  </td>

                  {/* CC2 */}
                  <td className="px-2 py-2.5 text-center">
                    <ScoreInput
                      value={course.score_cc2}
                      onChange={v => handleScoreChange(course, 'score_cc2', v)}
                      weight={templateWeights?.cc2}
                    />
                  </td>

                  {/* CC3 */}
                  <td className="px-2 py-2.5 text-center">
                    {course.template === GPATemplateType.B ? (
                      <ScoreInput
                        value={course.score_cc3}
                        onChange={v => handleScoreChange(course, 'score_cc3', v)}
                        weight={templateWeights?.cc3}
                      />
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* Cuối kỳ */}
                  <td className="px-2 py-2.5 text-center">
                    <ScoreInput
                      value={course.score_final}
                      onChange={v => handleScoreChange(course, 'score_final', v)}
                      weight={0.60}
                      isFinal
                    />
                  </td>

                  {/* Điểm /10 */}
                  <td className="px-2 py-2.5 text-center">
                    <span className="text-sm font-bold text-gray-800">
                      {computed.score10 != null ? computed.score10.toFixed(1) : '—'}
                    </span>
                  </td>

                  {/* Điểm chữ */}
                  <td className="px-2 py-2.5 text-center">
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${gradeColorClass(computed.letterGrade)}`}>
                      {computed.letterGrade || '—'}
                    </span>
                  </td>

                  {/* Checkbox không tính GPA */}
                  <td className="px-2 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={course.exclude_from_gpa}
                      onChange={e => handleFieldChange(course, 'exclude_from_gpa', e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                      title="Không tính vào GPA"
                    />
                  </td>

                  {/* Delete */}
                  <td className="px-2 py-2.5 text-center">
                    <button
                      onClick={() => {
                        setConfirmDialog({
                          isOpen: true,
                          title: 'Xóa môn học',
                          message: `Bạn có chắc chắn muốn xóa môn "${course.name || 'chưa đặt tên'}"?`,
                          onConfirm: () => onDeleteCourse(course.id)
                        });
                      }}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-gray-100">
        {courses.map(course => {
          const computed = course.computed || computeCourse(course);
          const isExcluded = course.exclude_from_gpa || course.is_conditional;
          const templateWeights = TEMPLATE_WEIGHTS[course.template];

          return (
            <div key={course.id} className={`p-4 ${isExcluded ? 'opacity-50' : ''} ${computed.letterGrade === 'F' ? 'bg-red-50/30' : ''}`}>
              {/* Row 1: Name + Grade */}
              <div className="flex items-center justify-between mb-3">
                <input
                  type="text"
                  value={course.name}
                  onChange={e => handleFieldChange(course, 'name', e.target.value)}
                  placeholder="Tên môn học..."
                  className="flex-1 bg-transparent border-0 border-b border-transparent focus:border-indigo-400 focus:ring-0 px-0 py-0.5 text-sm font-semibold text-gray-800 placeholder:text-gray-300"
                />
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  <span className="text-sm font-bold text-gray-800">
                    {computed.score10 != null ? computed.score10.toFixed(1) : '—'}
                  </span>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${gradeColorClass(computed.letterGrade)}`}>
                    {computed.letterGrade || '—'}
                  </span>
                </div>
              </div>

              {/* Row 2: Credits + Template + Flags */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1.5">
                  <span className="text-[10px] text-gray-500">TC:</span>
                  <input
                    type="number" min="1" max="10"
                    value={course.credits}
                    onChange={e => handleFieldChange(course, 'credits', parseInt(e.target.value) || 1)}
                    className="w-8 text-center bg-transparent border-0 p-0 text-sm font-bold focus:ring-0"
                  />
                </div>
                <select
                  value={course.template}
                  onChange={e => handleFieldChange(course, 'template', e.target.value)}
                  className="bg-gray-50 border-0 rounded-lg px-2 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="A">Template A</option>
                  <option value="B">Template B</option>
                  <option value="C">Template C</option>
                </select>
                <label className="flex items-center gap-1 text-[10px] text-gray-500 ml-auto cursor-pointer">
                  <input
                    type="checkbox"
                    checked={course.exclude_from_gpa}
                    onChange={e => handleFieldChange(course, 'exclude_from_gpa', e.target.checked)}
                    className="w-3.5 h-3.5 text-indigo-600 rounded border-gray-300"
                  />
                  ∅GPA
                </label>
                <button
                  onClick={() => {
                    setConfirmDialog({
                      isOpen: true,
                      title: 'Xóa môn học',
                      message: `Bạn có chắc chắn muốn xóa môn "${course.name || 'chưa đặt tên'}"?`,
                      onConfirm: () => onDeleteCourse(course.id)
                    });
                  }}
                  className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Row 3: Score inputs */}
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-[9px] text-gray-400 font-semibold block mb-0.5">
                    CC1 ({Math.round((templateWeights?.cc1 || 0) * 100)}%)
                  </label>
                  <input
                    type="number" step="0.1" min="0" max="10"
                    value={course.score_cc1 ?? ''}
                    onChange={e => handleScoreChange(course, 'score_cc1', e.target.value)}
                    placeholder="—"
                    className="w-full text-center bg-gray-50 border border-gray-200 rounded-lg py-1.5 text-sm font-medium focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-gray-400 font-semibold block mb-0.5">
                    CC2 ({Math.round((templateWeights?.cc2 || 0) * 100)}%)
                  </label>
                  <input
                    type="number" step="0.1" min="0" max="10"
                    value={course.score_cc2 ?? ''}
                    onChange={e => handleScoreChange(course, 'score_cc2', e.target.value)}
                    placeholder="—"
                    className="w-full text-center bg-gray-50 border border-gray-200 rounded-lg py-1.5 text-sm font-medium focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                {course.template === GPATemplateType.B ? (
                  <div>
                    <label className="text-[9px] text-gray-400 font-semibold block mb-0.5">
                      CC3 ({Math.round((templateWeights?.cc3 || 0) * 100)}%)
                    </label>
                    <input
                      type="number" step="0.1" min="0" max="10"
                      value={course.score_cc3 ?? ''}
                      onChange={e => handleScoreChange(course, 'score_cc3', e.target.value)}
                      placeholder="—"
                      className="w-full text-center bg-gray-50 border border-gray-200 rounded-lg py-1.5 text-sm font-medium focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                ) : (
                  <div className="flex items-end justify-center pb-1">
                    <span className="text-gray-300 text-sm">—</span>
                  </div>
                )}
                <div>
                  <label className="text-[9px] text-gray-400 font-semibold block mb-0.5">CK (60%)</label>
                  <input
                    type="number" step="0.1" min="0" max="10"
                    value={course.score_final ?? ''}
                    onChange={e => handleScoreChange(course, 'score_final', e.target.value)}
                    placeholder="—"
                    className="w-full text-center bg-indigo-50 border border-indigo-200 rounded-lg py-1.5 text-sm font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>
            </div>
          );
        })}
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
const ScoreInput: React.FC<{
  value: number | null | undefined;
  onChange: (value: string) => void;
  weight?: number;
  isFinal?: boolean;
}> = ({ value, onChange, weight, isFinal }) => (
  <div>
    <input
      type="number" step="0.1" min="0" max="10"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder="—"
      className={`w-16 text-center border rounded-lg py-1.5 text-sm font-medium focus:ring-2 focus:ring-indigo-400 transition-colors ${
        isFinal
          ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold focus:border-indigo-400'
          : 'bg-gray-50 border-gray-200 text-gray-700 focus:border-indigo-400'
      }`}
    />
    {weight != null && (
      <div className="text-[9px] text-gray-400 mt-0.5">{Math.round(weight * 100)}%</div>
    )}
  </div>
);
// ── GPA Target Panel ──
const GPATargetPanel: React.FC<{
  semesters: GPASemester[];
  cumulativeData: GPACumulativeData;
  targetCredits: number;
  propTargetGPA?: number | null;
  propTargetSemesters: number;
  onUpdateGPATarget?: (targetGPA: number | null, targetSemesters: number) => void;
}> = ({ semesters, cumulativeData, targetCredits, propTargetGPA, propTargetSemesters, onUpdateGPATarget }) => {

  const [localTargetGPA, setLocalTargetGPA] = useState<string>(propTargetGPA?.toString() || '');
  const [localTargetSemesters, setLocalTargetSemesters] = useState<number>(propTargetSemesters);
  const [hasCalculated, setHasCalculated] = useState(propTargetGPA != null);

  // Sync from props
  useEffect(() => {
    if (propTargetGPA != null) {
      setLocalTargetGPA(propTargetGPA.toString());
      setHasCalculated(true);
    }
  }, [propTargetGPA]);

  useEffect(() => {
    setLocalTargetSemesters(propTargetSemesters);
  }, [propTargetSemesters]);

  const projection: GPAProjection | null = useMemo(() => {
    const gpa = parseFloat(localTargetGPA);
    if (!hasCalculated || isNaN(gpa) || gpa <= 0 || gpa > 4.0) return null;

    const computedSemesters = semesters.map(s => ({
      ...s,
      courses: computeAllCourses(s.courses),
    }));

    return calculateGPAProjection(computedSemesters, gpa, targetCredits, localTargetSemesters);
  }, [hasCalculated, localTargetGPA, localTargetSemesters, semesters, targetCredits]);

  const handleCalculate = () => {
    const gpa = parseFloat(localTargetGPA);
    if (isNaN(gpa) || gpa <= 0 || gpa > 4.0) {
      alert('GPA mục tiêu phải từ 0.01 đến 4.00');
      return;
    }
    if (localTargetSemesters < 1 || localTargetSemesters > 20) {
      alert('Số kỳ còn lại phải từ 1 đến 20');
      return;
    }
    setHasCalculated(true);
    onUpdateGPATarget?.(gpa, localTargetSemesters);
  };

  const handlePreset = (gpa: number) => {
    setLocalTargetGPA(gpa.toString());
    setHasCalculated(true);
    onUpdateGPATarget?.(gpa, localTargetSemesters);
  };

  const handleReset = () => {
    setLocalTargetGPA('');
    setHasCalculated(false);
    onUpdateGPATarget?.(null, 4);
  };

  // Grade color mapping
  const gradeColor = (grade: string | null): string => {
    if (!grade) return 'text-gray-400';
    if (grade === 'A+' || grade === 'A') return 'text-emerald-600';
    if (grade === 'B+') return 'text-blue-600';
    if (grade === 'B') return 'text-blue-500';
    if (grade === 'C+' || grade === 'C') return 'text-yellow-600';
    return 'text-orange-600';
  };

  // Feasibility icon
  const feasibilityIcon = (p: GPAProjection) => {
    if (p.alreadyAchieved) return <Award size={38} className="text-emerald-500" />;
    if (!p.isFeasible) return <AlertTriangle size={38} className="text-red-500" />;
    
    // For feasible states
    let colorClass = "text-blue-500";
    if (p.requiredGPAPerSemester && p.requiredGPAPerSemester >= 3.8) {
      colorClass = "text-indigo-500";
    } else if (p.requiredGPAPerSemester && p.requiredGPAPerSemester >= 3.5) {
      colorClass = "text-amber-500";
    }
    
    return (
      <div className={`p-3 rounded-2xl bg-white border shadow-sm ${colorClass} border-${colorClass.replace('text-', '')}/20`}>
        <Target size={32} strokeWidth={2.5} />
      </div>
    );
  };

  const progressColor = (p: GPAProjection): string => {
    if (p.alreadyAchieved) return 'from-emerald-500 to-green-400';
    if (!p.isFeasible) return 'from-red-500 to-red-400';
    if (p.requiredGPAPerSemester && p.requiredGPAPerSemester >= 3.5) return 'from-amber-500 to-orange-400';
    return 'from-indigo-500 to-purple-500';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-br from-cyan-500 via-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Target size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">GPA Kỳ Vọng</h3>
              <p className="text-white/70 text-xs">Đặt mục tiêu và xem lộ trình đạt GPA mong muốn</p>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap gap-2 mb-5">
            <span className="text-xs text-white/60 self-center mr-1">Chọn nhanh:</span>
            {[
              { label: '🏆 Xuất sắc', gpa: 3.6 },
              { label: '🎓 Giỏi', gpa: 3.2 },
              { label: '📘 Khá', gpa: 2.5 },
            ].map(p => (
              <button
                key={p.gpa}
                onClick={() => handlePreset(p.gpa)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  parseFloat(localTargetGPA) === p.gpa && hasCalculated
                    ? 'bg-white text-blue-700 border-white shadow-lg scale-105'
                    : 'bg-white/10 text-white/90 border-white/20 hover:bg-white/20'
                }`}
              >
                {p.label} ({p.gpa.toFixed(1)})
              </button>
            ))}
          </div>

          {/* Input Form */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-[10px] text-white/60 uppercase tracking-wider mb-1 font-semibold">GPA Mục tiêu (thang 4)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="4.00"
                value={localTargetGPA}
                onChange={e => { setLocalTargetGPA(e.target.value); setHasCalculated(false); }}
                placeholder="VD: 3.60"
                className="w-full px-4 py-2.5 bg-white/15 backdrop-blur-sm border border-white/25 rounded-xl text-white font-bold text-lg placeholder:text-white/40 focus:ring-2 focus:ring-white/40 focus:border-white/50 outline-none transition-all"
              />
            </div>
            <div className="w-full sm:w-32">
              <label className="block text-[10px] text-white/60 uppercase tracking-wider mb-1 font-semibold">Số kỳ còn lại</label>
              <input
                type="number"
                min="1"
                max="20"
                value={localTargetSemesters}
                onChange={e => { setLocalTargetSemesters(parseInt(e.target.value) || 1); setHasCalculated(false); }}
                className="w-full px-4 py-2.5 bg-white/15 backdrop-blur-sm border border-white/25 rounded-xl text-white font-bold text-lg focus:ring-2 focus:ring-white/40 focus:border-white/50 outline-none transition-all"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleCalculate}
                className="px-6 py-2.5 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition-all shadow-lg text-sm whitespace-nowrap"
              >
                <Calculator size={16} className="inline mr-1.5 -mt-0.5" />
                Tính toán
              </button>
              {hasCalculated && (
                <button
                  onClick={handleReset}
                  className="p-2.5 bg-white/10 text-white/70 rounded-xl hover:bg-white/20 transition-all"
                  title="Xóa mục tiêu"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* No data state */}
      {!hasCalculated && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-blue-200 p-12 text-center">
          <Target size={48} className="mx-auto text-blue-300 mb-4" />
          <p className="text-gray-500 font-medium mb-2">Chưa đặt mục tiêu GPA</p>
          <p className="text-gray-400 text-sm">Chọn nhanh hoặc nhập GPA mong muốn ở trên để bắt đầu phân tích</p>
        </div>
      )}

      {/* Projection Results */}
      {projection && (
        <div className="space-y-5">
          {/* Current Status Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">GPA Hiện tại</div>
              <div className="text-2xl font-black text-gray-900">{projection.currentGPA?.toFixed(2) || '—'}</div>
              <div className="text-xs text-gray-400 mt-0.5">{cumulativeData.academic_standing || 'Chưa có'}</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">GPA Mục tiêu</div>
              <div className="text-2xl font-black text-indigo-600">{projection.targetGPA.toFixed(2)}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {projection.targetGPA >= 3.6 ? 'Xuất sắc' : projection.targetGPA >= 3.2 ? 'Giỏi' : projection.targetGPA >= 2.5 ? 'Khá' : 'Trung bình'}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">TC Đã tích lũy</div>
              <div className="text-2xl font-black text-gray-900">{projection.currentCredits}</div>
              <div className="text-xs text-gray-400 mt-0.5">/ {targetCredits} TC</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">TC Còn lại</div>
              <div className="text-2xl font-black text-purple-600">{projection.remainingCredits}</div>
              <div className="text-xs text-gray-400 mt-0.5">{projection.remainingSemesters} kỳ còn lại</div>
            </div>
          </div>

          {/* Main Result Card */}
          <div className={`rounded-2xl border-2 p-6 shadow-sm ${
            projection.alreadyAchieved
              ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200'
              : !projection.isFeasible
                ? 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200'
                : 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200'
          }`}>
            <div className="flex items-start gap-4">
              <div className="shrink-0">{feasibilityIcon(projection)}</div>
              <div className="flex-1 mt-1">
                <h4 className="font-bold text-lg text-gray-800 mb-1">
                  {projection.alreadyAchieved ? 'Bạn đã đạt mục tiêu!' :
                   !projection.isFeasible ? 'Mục tiêu không khả thi' :
                   'Yêu cầu để đạt mục tiêu'}
                </h4>
                <p className="text-sm text-gray-600 leading-relaxed">{projection.feasibilityNote}</p>
              </div>
            </div>

            {/* Required GPA per semester */}
            {projection.requiredGPAPerSemester != null && projection.isFeasible && (
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-white">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={16} className="text-indigo-600" />
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">GPA mỗi kỳ cần đạt</span>
                  </div>
                  <div className="text-3xl font-black text-indigo-700">{projection.requiredGPAPerSemester.toFixed(2)}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {projection.alreadyAchieved ? 'Tối thiểu để duy trì mục tiêu' : `Cho ${projection.remainingSemesters} kỳ còn lại`}
                  </div>
                </div>
                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-white">
                  <div className="flex items-center gap-2 mb-2">
                    <Star size={16} className="text-purple-600" />
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Điểm chữ tối thiểu</span>
                  </div>
                  <div className={`text-3xl font-black ${gradeColor(projection.requiredMinGrade)}`}>
                    {projection.requiredMinGrade || '—'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Trung bình các môn phải đạt {projection.requiredMinGrade} trở lên
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-indigo-600" />
                <span className="text-sm font-bold text-gray-700">Tiến độ mục tiêu</span>
              </div>
              <span className="text-sm font-bold text-indigo-600">{Math.min(projection.progressPercent, 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${progressColor(projection)} rounded-full transition-all duration-700 ease-out relative`}
                style={{ width: `${Math.min(projection.progressPercent, 100)}%` }}
              >
                {projection.progressPercent >= 15 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                    {projection.currentGPA?.toFixed(2)} → {projection.targetGPA.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-gray-400 font-medium">
              <span>0.00</span>
              <span>GPA Hiện tại: {projection.currentGPA?.toFixed(2) || '—'}</span>
              <span>4.00</span>
            </div>
          </div>

          {/* Grade Scale Reference */}
          {projection.isFeasible && projection.requiredGPAPerSemester != null && !projection.alreadyAchieved && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen size={16} className="text-purple-600" />
                <h4 className="text-sm font-bold text-gray-700">Bảng quy đổi — Bạn cần đạt ít nhất</h4>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[
                  { letter: 'A+', grade4: 4.0, min10: '9.0+' },
                  { letter: 'A', grade4: 3.7, min10: '8.5+' },
                  { letter: 'B+', grade4: 3.5, min10: '8.0+' },
                  { letter: 'B', grade4: 3.0, min10: '7.0+' },
                  { letter: 'C+', grade4: 2.5, min10: '6.5+' },
                ].map(g => {
                  const isRequired = projection.requiredMinGrade === g.letter;
                  const isAbove = projection.requiredGPAPerSemester! >= g.grade4;
                  return (
                    <div
                      key={g.letter}
                      className={`text-center p-3 rounded-xl border-2 transition-all ${
                        isRequired
                          ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200 scale-105'
                          : isAbove
                            ? 'bg-gray-50 border-gray-100 opacity-50'
                            : 'bg-gray-50 border-gray-100'
                      }`}
                    >
                      <div className={`text-lg font-black ${isRequired ? 'text-indigo-600' : 'text-gray-600'}`}>{g.letter}</div>
                      <div className="text-[10px] text-gray-500 font-medium">Thang 4: {g.grade4}</div>
                      <div className="text-[10px] text-gray-400">Thang 10: {g.min10}</div>
                      {isRequired && (
                        <div className="mt-1">
                          <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full font-bold">TỐI THIỂU</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Strategy Suggestions */}
          {projection.isFeasible && !projection.alreadyAchieved && (
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl border border-amber-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={16} className="text-amber-600" />
                <h4 className="text-sm font-bold text-amber-800">Gợi ý chiến lược</h4>
              </div>
              <div className="space-y-2">
                {[
                  { icon: '📚', text: 'Ưu tiên đầu tư công sức cho các môn nhiều tín chỉ (3-4 TC) — ảnh hưởng lớn nhất đến GPA.' },
                  { icon: '🎯', text: `Điểm cuối kỳ chiếm 60% — tập trung ôn thi kỹ sẽ tối ưu nhất cho GPA.` },
                  { icon: '📊', text: `Mỗi kỳ đăng ký vừa phải (~${Math.ceil(projection.remainingCredits / projection.remainingSemesters)} TC/kỳ) để đảm bảo chất lượng.` },
                  ...(projection.requiredGPAPerSemester && projection.requiredGPAPerSemester >= 3.5
                    ? [{ icon: '⚡', text: 'Hạn chế đăng ký các môn khó cùng lúc. Phân bổ hợp lý giữa các kỳ.' }]
                    : []),
                  ...(projection.requiredGPAPerSemester && projection.requiredGPAPerSemester >= 3.0
                    ? [{ icon: '📝', text: 'Không bỏ bê điểm chuyên cần (CC1, CC2) — đây là điểm dễ lấy nhất.' }]
                    : []),
                ].map((tip, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="text-base mt-0.5 shrink-0">{tip.icon}</span>
                    <p className="text-sm text-amber-900/80 leading-relaxed">{tip.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GPADashboard;
