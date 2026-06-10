import React, { useState, useEffect } from 'react';
import {
  Briefcase, Brain, Star, CheckCircle2, AlertTriangle, Compass,
  GraduationCap, RefreshCw, Sparkles, BookOpen, ChevronRight,
  Lock, ArrowRight, Check, X, ShieldAlert, Award, Trash2
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { careerGoalService } from '../services/careerGoalService';
import { computeCourse, calculateCumulativeData } from '../services/gpaCalculator';
import { Lang } from '../i18n/i18n';
import ProGateOverlay from './ProGateOverlay';
import { GPASemester, Profile, CareerAnalysisResult } from '../types';

interface GPACareerTabProps {
  semesters: GPASemester[];
  userId: string;
  onCreatePosition?: (domain: string, positions: string[]) => void;
  lang: Lang;
  isPro?: boolean;
  onUpgrade?: () => void;
}

const translations = {
  vi: {
    careerTitle: "🎓 Cố Vấn Định Hướng Nghề Nghiệp AI",
    careerDesc: "Phân tích kết quả học tập GPA, tính cách MBTI/DISC, và sở thích để gợi ý lĩnh vực/ngành nghề và lộ trình sự nghiệp phù hợp nhất cho bạn.",
    profileSection: "Thông tin hồ sơ sự nghiệp",
    universityLabel: "Trường Đại học",
    majorLabel: "Ngành học hiện tại",
    careerObjectiveLabel: "Định hướng cá nhân",
    mbtiLabel: "Tính cách MBTI",
    discLabel: "Tính cách DISC",
    hobbiesLabel: "Sở thích",
    noMajorWarning: "Vui lòng cập nhật Ngành học để AI phân tích chính xác nhất.",
    analyzeBtn: "Phân tích nghề nghiệp bằng AI",
    analyzing: "AI đang phân tích...",
    reAnalyzeBtn: "Phân tích lại",
    cachedAtLabel: "Kết quả lưu lúc:",
    daysLeft: "còn hạn",
    resultsTitle: "Đề xuất Lĩnh vực sự nghiệp",
    fitScore: "Độ phù hợp:",
    strengths: "Điểm mạnh",
    weaknesses: "Điểm yếu & Cải thiện",
    personalityMatch: "Hòa hợp tính cách",
    recommendedSkills: "Kỹ năng & công nghệ gợi ý",
    careerPath: "Lộ trình thăng tiến",
    chooseDomainBtn: "Chọn ngành này → Tạo Mục tiêu Nghề nghiệp",
    detailBtn: "Xem chi tiết lộ trình",
    closeDetailBtn: "Đóng chi tiết",
    noDataYet: "Chưa có đủ dữ liệu học tập. Vui lòng thêm học kỳ và môn học trước.",
    successCreatePosition: "Đã tạo vị trí công việc thành công! ✨ Đang chuyển hướng...",
    loadingStep1: "Đang đọc kết quả học tập từ GPA...",
    loadingStep2: "Đối chiếu nhóm tính cách MBTI và sở thích...",
    loadingStep3: "AI đang phân tích thế mạnh học thuật...",
    loadingStep4: "Đề xuất các vị trí nghề nghiệp và lộ trình...",
    loadingStep5: "Hoàn tất báo cáo định hướng sự nghiệp...",
    saveProfileBtn: "Lưu hồ sơ",
    profileSaved: "Hồ sơ đã được lưu! ✨",
    majorPlaceholder: "Ví dụ: Công nghệ thông tin",
    uniPlaceholder: "Ví dụ: Đại học Quốc gia HN",
    deleteAnalysisBtn: "Xóa kết quả phân tích",
    confirmDeleteAnalysis: "Bạn có chắc chắn muốn xóa kết quả phân tích nghề nghiệp này? Dữ liệu sẽ bị xóa trên tất cả thiết bị.",
    deletingAnalysis: "Đang xóa phân tích..."
  },
  en: {
    careerTitle: "🎓 AI Career Counselor",
    careerDesc: "Analyzes GPA results, MBTI/DISC personality, and hobbies to recommend the best matching career domains and pathways.",
    profileSection: "Career Profile Information",
    universityLabel: "University",
    majorLabel: "Current Major",
    careerObjectiveLabel: "Career Objective",
    mbtiLabel: "MBTI Type",
    discLabel: "DISC Type",
    hobbiesLabel: "Hobbies",
    noMajorWarning: "Please update your Major to get the most accurate AI analysis.",
    analyzeBtn: "Analyze Careers with AI",
    analyzing: "AI is analyzing...",
    reAnalyzeBtn: "Re-analyze",
    cachedAtLabel: "Cached at:",
    daysLeft: "valid",
    resultsTitle: "🚀 Recommended Career Domains",
    fitScore: "Fit Score:",
    strengths: "Key Strengths",
    weaknesses: "Weaknesses & Improvements",
    personalityMatch: "Personality Match",
    recommendedSkills: "Recommended Skills & Tech",
    careerPath: "Career Growth Path",
    chooseDomainBtn: "Select Domain → Create Career Goal",
    detailBtn: "View Career Path Detail",
    closeDetailBtn: "Close Details",
    noDataYet: "No academic data yet. Please add semesters and courses first.",
    successCreatePosition: "Career position created successfully! ✨ Redirecting...",
    loadingStep1: "Reading academic courses from GPA...",
    loadingStep2: "Matching MBTI personality and hobbies...",
    loadingStep3: "AI is analyzing academic strengths...",
    loadingStep4: "Recommending job positions and roadmaps...",
    loadingStep5: "Finalizing career guidance report...",
    saveProfileBtn: "Save Profile",
    profileSaved: "Profile saved! ✨",
    majorPlaceholder: "e.g., Computer Science",
    uniPlaceholder: "e.g., National University",
    deleteAnalysisBtn: "Delete Analysis",
    confirmDeleteAnalysis: "Are you sure you want to delete this career analysis? Data will be deleted across all devices.",
    deletingAnalysis: "Deleting analysis..."
  },
  ko: {
    careerTitle: "🎓 AI 진로 및 경력 상담사",
    careerDesc: "GPA 성적, MBTI/DISC 성격 유형 및 취미를 분석하여 가장 적합한 경력 분야와 진로를 추천합니다.",
    profileSection: "진로 프로필 정보",
    universityLabel: "대학교",
    majorLabel: "현재 전공",
    careerObjectiveLabel: "진로 목표",
    mbtiLabel: "MBTI 유형",
    discLabel: "DISC 유형",
    hobbiesLabel: "취미",
    noMajorWarning: "정확한 AI 분석을 위해 전공을 업데이트해 주세요.",
    analyzeBtn: "AI 진로 분석 시작",
    analyzing: "AI 분석 중...",
    reAnalyzeBtn: "다시 분석하기",
    cachedAtLabel: "저장됨:",
    daysLeft: "유효",
    resultsTitle: "🚀 추천 경력 분야",
    fitScore: "적합도:",
    strengths: "핵심 강점",
    weaknesses: "약점 및 개선 방안",
    personalityMatch: "성격 유형 적합성",
    recommendedSkills: "추천 기술 및 툴",
    careerPath: "진로 성장 경로",
    chooseDomainBtn: "이 분야 선택 → 커리어 목표 생성",
    detailBtn: "상세 경로 보기",
    closeDetailBtn: "상세 닫기",
    noDataYet: "학업 데이터가 부족합니다. 먼저 학기 및 과목을 추가해 주세요.",
    successCreatePosition: "성공적으로 커리어 직무를 생성했습니다! ✨ 이동 중...",
    loadingStep1: "GPA에서 학업 성적 읽는 중...",
    loadingStep2: "MBTI 성격 유형 및 취미 대조 중...",
    loadingStep3: "AI가 학업적 강점 분석 중...",
    loadingStep4: "직무 추천 및 로드맵 작성 중...",
    loadingStep5: "진로 지도 보고서 완료 중...",
    saveProfileBtn: "프로필 저장",
    profileSaved: "프로필이 저장되었습니다! ✨",
    majorPlaceholder: "예: 컴퓨터공학",
    uniPlaceholder: "예: 서울대학교",
    deleteAnalysisBtn: "분석 삭제",
    confirmDeleteAnalysis: "이 진로 분석 결과를 삭제하시겠습니까? 데이터는 모든 기기에서 삭제됩니다.",
    deletingAnalysis: "분석 삭제 중..."
  }
};

export const GPACareerTab: React.FC<GPACareerTabProps> = ({
  semesters,
  userId,
  onCreatePosition,
  lang = 'vi',
  isPro = false,
  onUpgrade = () => { }
}) => {
  const t = translations[lang] || translations.vi;

  if (!isPro) {
    return <ProGateOverlay featureName="Cố Vấn Nghề Nghiệp AI" onUpgrade={onUpgrade} />;
  }

  // Profile data state
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editingMajor, setEditingMajor] = useState('');
  const [editingUni, setEditingUni] = useState('');
  const [editingObjective, setEditingObjective] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  // AI analysis state
  const [analysisResults, setAnalysisResults] = useState<CareerAnalysisResult[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(1);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [cooldownTimeStr, setCooldownTimeStr] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if cache is still valid (24h cooldown)
  const isCacheValid = React.useMemo(() => {
    if (!cachedAt) return false;
    const cachedDate = new Date(cachedAt);
    const expiresDate = new Date(cachedDate.getTime() + 24 * 60 * 60 * 1000);
    return expiresDate.getTime() > Date.now();
  }, [cachedAt]);

  // Update cooldown countdown timer
  useEffect(() => {
    if (!cachedAt) {
      setCooldownTimeStr('');
      return;
    }
    const updateCooldown = () => {
      const cachedDate = new Date(cachedAt);
      const expiresDate = new Date(cachedDate.getTime() + 24 * 60 * 60 * 1000);
      const now = new Date();
      const diffTime = expiresDate.getTime() - now.getTime();

      if (diffTime <= 0) {
        setCooldownTimeStr('');
        return;
      }

      const hours = Math.floor(diffTime / (1000 * 60 * 60));
      const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffTime % (1000 * 60)) / 1000);

      if (lang === 'vi') {
        if (hours > 0) {
          setCooldownTimeStr(`Phân tích lại sau ${hours} giờ ${minutes} phút`);
        } else {
          setCooldownTimeStr(`Phân tích lại sau ${minutes} phút ${seconds} giây`);
        }
      } else if (lang === 'ko') {
        if (hours > 0) {
          setCooldownTimeStr(`${hours}시간 ${minutes}분 후 재분석 가능`);
        } else {
          setCooldownTimeStr(`${minutes}분 ${seconds}초 후 재분석 가능`);
        }
      } else {
        if (hours > 0) {
          setCooldownTimeStr(`Re-analyze in ${hours}h ${minutes}m`);
        } else {
          setCooldownTimeStr(`Re-analyze in ${minutes}m ${seconds}s`);
        }
      }
    };

    updateCooldown();
    const timer = setInterval(updateCooldown, 1000);
    return () => clearInterval(timer);
  }, [cachedAt, lang]);

  // Load profile and cached analysis
  useEffect(() => {
    const initData = async () => {
      try {
        // Fetch profile
        const { data: profData, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (profData && !profErr) {
          setProfile(profData);
          setEditingMajor(profData.major || '');
          setEditingUni(profData.university || '');
          setEditingObjective(profData.career_objective || '');
        }

        // Fetch cached analysis
        const cached = await careerGoalService.getCachedAnalysis(userId);
        if (cached) {
          setAnalysisResults(cached.results);
          setCachedAt(cached.cachedAt);
        }
      } catch (err) {
        console.error('Error initializing GPACareerTab:', err);
      }
    };

    if (userId) {
      initData();
    }
  }, [userId]);

  // Loading animation simulation steps
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isAnalyzing) {
      timer = setInterval(() => {
        setLoadingStep((prev) => {
          if (prev < 5) return prev + 1;
          return prev;
        });
      }, 2000);
    } else {
      setLoadingStep(1);
    }
    return () => clearInterval(timer);
  }, [isAnalyzing]);

  // Save profile inline
  const handleSaveProfile = async () => {
    if (!profile) return;
    try {
      const updates = {
        ...profile,
        major: editingMajor.trim() || null,
        university: editingUni.trim() || null,
        career_objective: editingObjective.trim() || null,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('profiles').upsert(updates);
      if (error) throw error;

      setProfile(updates);
      setSaveStatus(t.profileSaved);
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      console.error('Error saving inline profile:', err);
      alert('Error: Could not save profile.');
    }
  };

  // Run AI analysis
  const handleRunAnalysis = async () => {
    if (!editingMajor.trim()) {
      alert(t.noMajorWarning);
      return;
    }

    setIsAnalyzing(true);
    setLoadingStep(1);

    // Save major and university first
    await handleSaveProfile();

    try {
      // Collect course data
      const coursesInput = semesters.flatMap(sem =>
        sem.courses.map(course => {
          const computed = course.computed || computeCourse(course);
          return {
            name: course.name,
            grade: computed.letterGrade || 'N/A',
            credits: course.credits
          };
        })
      );

      // Compute cumulative GPA
      const gpaData = calculateCumulativeData(semesters);
      const currentGPA = gpaData.gpa || 0;

      const analysisInput = {
        university: editingUni,
        major: editingMajor,
        courses: coursesInput,
        gpa: currentGPA,
        personality_mbti: profile?.personality_mbti,
        personality_disc: profile?.personality_disc,
        hobbies: profile?.hobbies,
        career_objective: editingObjective.trim() || null
      };

      const results = await careerGoalService.analyzeCareerDomains(analysisInput);

      if (results && results.length > 0) {
        setAnalysisResults(results);
        await careerGoalService.cacheAnalysisResults(userId, results);
        setCachedAt(new Date().toISOString());
      } else {
        alert('AI analysis returned empty results. Please try again.');
      }
    } catch (err) {
      console.error('Error performing AI career analysis:', err);
      alert('An error occurred during career analysis. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };
 
  // Delete AI career analysis
  const handleDeleteAnalysis = async () => {
    if (!window.confirm(t.confirmDeleteAnalysis)) return;
 
    setIsDeleting(true);
    try {
      const success = await careerGoalService.deleteCachedAnalysis(userId);
      if (success) {
        setAnalysisResults([]);
        setCachedAt(null);
      } else {
        alert(lang === 'vi' ? 'Không thể xóa kết quả phân tích.' : lang === 'ko' ? '분석 결과를 삭제할 수 없습니다.' : 'Failed to delete analysis result.');
      }
    } catch (err) {
      console.error('Error deleting career analysis:', err);
      alert('An error occurred during deletion.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Select domain and create Position in Goals Dashboard
  const handleChooseDomain = async (domainResult: CareerAnalysisResult) => {
    if (!onCreatePosition) return;
    setActionStatus(domainResult.domain);
    try {
      await onCreatePosition(domainResult.domain, domainResult.positions);
      setActionStatus(null);
    } catch (err) {
      console.error('Error selecting domain:', err);
      setActionStatus(null);
    }
  };

  // Check how many hours left before cache expires (1 day duration)
  const getDaysLeftText = () => {
    if (!cachedAt) return '';
    const cachedDate = new Date(cachedAt);
    const expiresDate = new Date(cachedDate.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    const diffTime = expiresDate.getTime() - now.getTime();
    if (diffTime <= 0) return '';

    const hours = Math.ceil(diffTime / (1000 * 60 * 60));
    if (lang === 'vi') {
      return `(còn ${hours} giờ)`;
    } else if (lang === 'ko') {
      return `(${hours}시간 남음)`;
    } else {
      return `(${hours}h left)`;
    }
  };

  const getStepText = (step: number) => {
    switch (step) {
      case 1: return t.loadingStep1;
      case 2: return t.loadingStep2;
      case 3: return t.loadingStep3;
      case 4: return t.loadingStep4;
      case 5: return t.loadingStep5;
      default: return '';
    }
  };

  const hasCourses = semesters.some(s => s.courses && s.courses.length > 0);

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-purple-500/10 border border-indigo-100/50 rounded-3xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-200/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 relative z-10">
          <div className="p-3.5 bg-gradient-to-tr from-indigo-500 to-cyan-500 rounded-2xl text-white shadow-md shadow-indigo-200">
            <Compass size={28} className="animate-pulse" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl md:text-2xl font-extrabold text-gray-800 tracking-tight">{t.careerTitle}</h2>
            <p className="text-xs md:text-sm text-gray-500 font-medium leading-relaxed max-w-2xl">{t.careerDesc}</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {!hasCourses ? (
        <div className="bg-white border border-gray-100 rounded-3xl p-10 text-center shadow-sm">
          <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-gray-200">
            <BookOpen size={24} />
          </div>
          <p className="text-gray-500 font-bold mb-2">{t.noDataYet}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Profile Details Sidebar */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-5">
            <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider border-b border-gray-100 pb-3 flex items-center gap-2">
              <GraduationCap size={16} className="text-indigo-500" />
              {t.profileSection}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1.5">{t.universityLabel}</label>
                <input
                  type="text"
                  value={editingUni}
                  onChange={(e) => setEditingUni(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50 outline-none transition-all text-sm font-medium"
                  placeholder={t.uniPlaceholder}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1.5">{t.majorLabel} <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editingMajor}
                  onChange={(e) => setEditingMajor(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50 outline-none transition-all text-sm font-medium ${!editingMajor.trim() ? 'border border-red-200 focus:border-red-400' : ''}`}
                  placeholder={t.majorPlaceholder}
                />
                {!editingMajor.trim() && (
                  <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1 font-medium">
                    <ShieldAlert size={10} /> {t.noMajorWarning}
                  </p>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wide block">{t.careerObjectiveLabel}</label>
                  {editingObjective.trim() && (
                    <button
                      onClick={() => {
                        if (window.confirm(lang === 'vi' ? 'Bạn có chắc chắn muốn xóa định hướng cá nhân?' : lang === 'ko' ? '진로 목표를 삭제하시겠습니까?' : 'Are you sure you want to clear your career objective?')) {
                          setEditingObjective('');
                        }
                      }}
                      className="text-[10px] text-red-500 hover:text-red-700 font-bold flex items-center gap-0.5 transition-colors"
                      title="Xóa định hướng"
                    >
                      <Trash2 size={10} /> {lang === 'vi' ? 'Xóa' : lang === 'ko' ? '삭제' : 'Clear'}
                    </button>
                  )}
                </div>
                <textarea
                  value={editingObjective}
                  onChange={(e) => setEditingObjective(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50 outline-none transition-all text-sm font-medium resize-none h-16"
                  placeholder={lang === 'vi' ? 'Ví dụ: Trở thành chuyên viên phân tích dữ liệu...' : lang === 'ko' ? '예: 데이터 분석가 또는 웹 개발자가 되는 것...' : 'e.g., Become a data analyst or fullstack developer...'}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">{t.mbtiLabel}</span>
                  <span className="inline-block text-xs font-bold px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                    {profile?.personality_mbti || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">{t.discLabel}</span>
                  <span className="inline-block text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                    {profile?.personality_disc || 'N/A'}
                  </span>
                </div>
              </div>

              {profile?.hobbies && profile.hobbies.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1.5">{t.hobbiesLabel}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.hobbies.map((h, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 bg-gray-50 text-gray-600 font-medium rounded-lg border border-gray-100">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 flex items-center justify-between gap-2 border-t border-gray-100">
                <button
                  onClick={handleSaveProfile}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all rounded-xl shadow-md shadow-indigo-100/30 flex items-center gap-1.5"
                >
                  <Check size={14} />
                  {t.saveProfileBtn}
                </button>
                {saveStatus && (
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1 animate-bounce">
                    <CheckCircle2 size={12} /> {saveStatus}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={handleRunAnalysis}
              disabled={isAnalyzing || !editingMajor.trim() || isCacheValid}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl shadow-md shadow-indigo-100/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  {t.analyzing}
                </>
              ) : (
                <>
                  <Sparkles size={16} className="animate-pulse" />
                  {analysisResults.length > 0 ? t.reAnalyzeBtn : t.analyzeBtn}
                </>
              )}
            </button>

            {isCacheValid && cooldownTimeStr && (
              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl p-3 font-semibold flex items-start gap-1.5 leading-normal animate-fade-in">
                <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-500" />
                <span>
                  {lang === 'vi'
                    ? `Tính năng phân tích AI đang trong thời gian giãn cách 24 giờ để tránh spam. Bạn có thể ${cooldownTimeStr.toLowerCase()}.`
                    : lang === 'ko'
                      ? `AI 분석 기능은 스팸 방지를 위해 24시간 재대기 시간이 있습니다. ${cooldownTimeStr}.`
                      : `AI analysis is on a 24-hour cooldown to prevent spam. You can ${cooldownTimeStr.toLowerCase()}.`}
                </span>
              </div>
            )}
          </div>

          {/* AI Output Section */}
          <div className="lg:col-span-2 space-y-6">

            {/* Loading status indicator */}
            {isAnalyzing && (
              <div className="bg-white border border-gray-100 rounded-3xl p-10 shadow-sm flex flex-col items-center justify-center space-y-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/20 to-transparent"></div>
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 rounded-full border-4 border-dashed border-indigo-200 animate-spin"></div>
                  <div className="absolute inset-2 rounded-full border-4 border-indigo-600/30 animate-ping"></div>
                  <div className="absolute inset-4 bg-gradient-to-tr from-indigo-500 to-cyan-400 rounded-full flex items-center justify-center text-white shadow-lg">
                    <Brain size={32} />
                  </div>
                </div>

                <div className="text-center space-y-3 z-10">
                  <h4 className="text-lg font-extrabold text-gray-800">{getStepText(loadingStep)}</h4>
                  <div className="w-64 h-1.5 bg-gray-100 rounded-full overflow-hidden mx-auto">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-700 ease-out"
                      style={{ width: `${(loadingStep / 5) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex gap-2.5 justify-center">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <div
                        key={s}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${s <= loadingStep ? 'bg-indigo-600 scale-125' : 'bg-gray-200'}`}
                      ></div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Results output */}
            {!isAnalyzing && analysisResults.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3 gap-2">
                  <h3 className="font-extrabold text-gray-800 text-lg flex items-center gap-2">
                    <Award className="text-cyan-500" size={20} />
                    {t.resultsTitle}
                  </h3>
                  <div className="flex items-center gap-3">
                    {cachedAt && (
                      <span className="text-[11px] text-gray-400 font-semibold">
                        {t.cachedAtLabel} {new Date(cachedAt).toLocaleDateString()} {new Date(cachedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    <button
                      onClick={handleDeleteAnalysis}
                      disabled={isDeleting}
                      className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 transition-colors border border-red-100/50 disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          {t.deletingAnalysis}
                        </>
                      ) : (
                        <>
                          <Trash2 size={13} />
                          {t.deleteAnalysisBtn}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysisResults.map((item, idx) => {
                    const isExpanded = expandedDomain === item.domain;

                    return (
                      <div
                        key={idx}
                        className={`bg-white border rounded-3xl p-5 hover:shadow-xl hover:shadow-gray-100/50 hover:border-indigo-100 transition-all flex flex-col relative overflow-hidden ${isExpanded ? 'md:col-span-2 border-indigo-300 shadow-lg shadow-indigo-50/50' : 'border-gray-100'}`}
                      >
                        {/* Domain Card Header */}
                        <div className="flex justify-between items-start gap-4 mb-4">
                          <div>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full tracking-wider uppercase">
                              Domain
                            </span>
                            <h4 className="text-base md:text-lg font-extrabold text-gray-800 mt-1">{item.domain}</h4>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wide">{t.fitScore}</span>
                            <span className="text-2xl font-black text-indigo-600">{item.fit_score}%</span>
                          </div>
                        </div>

                        {/* Summary of points */}
                        <div className="space-y-3 mb-5 flex-grow">
                          <div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1">{t.strengths}</span>
                            <ul className="space-y-1">
                              {item.strengths.slice(0, isExpanded ? undefined : 2).map((s, i) => (
                                <li key={i} className="text-xs text-gray-600 font-medium flex items-start gap-1.5 leading-normal">
                                  <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                                  <span>{s}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1">{t.weaknesses}</span>
                            <ul className="space-y-1">
                              {item.weaknesses.slice(0, isExpanded ? undefined : 2).map((w, i) => (
                                <li key={i} className="text-xs text-gray-600 font-medium flex items-start gap-1.5 leading-normal">
                                  <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                                  <span>{w}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {isExpanded && (
                            <>
                              <div className="border-t border-gray-100 pt-3">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1">{t.personalityMatch}</span>
                                <p className="text-xs text-indigo-900 bg-indigo-50/40 p-3 rounded-2xl border border-indigo-100/30 font-medium leading-relaxed">
                                  {item.personality_match}
                                </p>
                              </div>

                              <div className="border-t border-gray-100 pt-3">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1">{t.recommendedSkills}</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {item.recommended_skills.map((skill, i) => (
                                    <span key={i} className="text-xs font-bold text-gray-700 bg-gray-50 border border-gray-100 px-3 py-1 rounded-xl">
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="border-t border-gray-100 pt-3">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1">{t.careerPath}</span>
                                <div className="text-xs text-gray-600 font-medium bg-cyan-50/30 border border-cyan-100/30 p-3 rounded-2xl flex items-center gap-1.5">
                                  <Award size={14} className="text-cyan-500 shrink-0" />
                                  <span className="italic">{item.career_path}</span>
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Card Actions */}
                        <div className="pt-3 border-t border-gray-50 flex items-center justify-between gap-3 flex-wrap">
                          <button
                            onClick={() => setExpandedDomain(isExpanded ? null : item.domain)}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
                          >
                            {isExpanded ? t.closeDetailBtn : t.detailBtn}
                            <ChevronRight size={14} className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </button>

                          <button
                            onClick={() => handleChooseDomain(item)}
                            disabled={actionStatus !== null}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-indigo-100/30 disabled:opacity-50 disabled:scale-100"
                          >
                            {actionStatus === item.domain ? (
                              <>
                                <RefreshCw size={12} className="animate-spin" />
                                {t.successCreatePosition}
                              </>
                            ) : (
                              <>
                                <Check size={14} />
                                {t.chooseDomainBtn}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
