import React, { useState, useEffect, useRef } from 'react';
import {
  FileText, User, Mail, Phone, Linkedin, Github, Compass,
  GraduationCap, Briefcase, Award, FolderGit2, CheckSquare,
  Sparkles, Save, Eye, Edit3, Download, RefreshCw, AlertTriangle,
  Plus, Trash2, ArrowLeft, Clock, Check, PlusCircle
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { cvService } from '../services/cvService';
import { careerGoalService } from '../services/careerGoalService';
import { CVData, Profile, CareerAnalysisResult } from '../types';
import ProGateOverlay from './ProGateOverlay';

interface CVBuilderProps {
  userId: string;
  isPro: boolean;
  onUpgrade: () => void;
}

const defaultCVData = (userId: string): CVData => ({
  id: '',
  user_id: userId,
  personal_info: {
    full_name: '',
    email: '',
    phone: '',
    linkedin: '',
    github: '',
    portfolio: '',
    avatar_url: ''
  },
  objective: '',
  education: [],
  experience: [],
  projects: [],
  skills: [
    { category: 'Technical', items: [] },
    { category: 'Soft Skills', items: [] },
    { category: 'Tools', items: [] }
  ],
  certificates: [],
  activities: []
});

export const CVBuilder: React.FC<CVBuilderProps> = ({
  userId,
  isPro,
  onUpgrade
}) => {
  const [cvData, setCvData] = useState<CVData | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [careerAnalysis, setCareerAnalysis] = useState<CareerAnalysisResult[]>([]);

  // UI states
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [generatingObjective, setGeneratingObjective] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [renewing, setRenewing] = useState(false);

  // Load Lang
  const lang = localStorage.getItem('smartlife_lang') || 'vi';

  // Load CV and profiles
  useEffect(() => {
    const loadData = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const [cv, prof, analysis] = await Promise.all([
          cvService.getCVData(userId),
          supabase.from('profiles').select('*').eq('id', userId).single(),
          careerGoalService.getCachedAnalysis(userId)
        ]);

        if (cv) {
          setCvData(cv);
        } else {
          const fresh = defaultCVData(userId);
          if (prof.data) {
            fresh.personal_info.full_name = prof.data.full_name || '';
            fresh.personal_info.email = prof.data.email || '';
            fresh.personal_info.avatar_url = prof.data.avatar_url || '';
            if (prof.data.university || prof.data.major) {
              fresh.education.push({
                university: prof.data.university || '',
                major: prof.data.major || '',
                gpa: undefined,
                graduation_year: undefined,
                top_courses: []
              });
            }
          }
          setCvData(fresh);
        }

        if (prof.data) {
          setProfile(prof.data);
        }
        if (analysis) {
          setCareerAnalysis(analysis.results);
        }
      } catch (err) {
        console.error('Error loading CV Builder data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      loadData();
    }
  }, [userId]);

  // Expiration check
  const isExpired = () => {
    if (isPro) return false; // Pro users have permanent CV access
    if (!cvData?.expires_at) return false;
    return new Date(cvData.expires_at).getTime() < Date.now();
  };

  const getDaysRemaining = () => {
    if (isPro) return 9999;
    if (!cvData?.expires_at) return 0;
    const diff = new Date(cvData.expires_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  // Handlers
  const handleSave = async () => {
    if (!cvData) return;
    setSaving(true);
    try {
      const success = await cvService.saveCVData(userId, cvData);
      if (success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);

        // Refresh local CV data state to pull updated expires_at
        const updated = await cvService.getCVData(userId);
        if (updated) setCvData(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleRenew = async () => {
    setRenewing(true);
    try {
      const success = await cvService.renewCVData(userId);
      if (success) {
        const updated = await cvService.getCVData(userId);
        if (updated) setCvData(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRenewing(false);
    }
  };

  const handleAutofill = async () => {
    setAutofilling(true);
    try {
      const fill = await cvService.getAutoFillData(userId);

      setCvData(prev => {
        if (!prev) return null;

        // Populate Education
        const updatedEducation = [...prev.education];
        if (updatedEducation.length === 0) {
          updatedEducation.push({
            university: fill.education.university,
            major: fill.education.major,
            gpa: fill.education.gpa,
            graduation_year: undefined,
            top_courses: fill.education.topCourses
          });
        } else {
          updatedEducation[0] = {
            ...updatedEducation[0],
            university: updatedEducation[0].university || fill.education.university,
            major: updatedEducation[0].major || fill.education.major,
            gpa: updatedEducation[0].gpa || fill.education.gpa,
            top_courses: fill.education.topCourses.length > 0 ? fill.education.topCourses : updatedEducation[0].top_courses
          };
        }

        // Merge Skills
        const updatedSkills = prev.skills.map(skillCat => {
          if (skillCat.category === 'Technical') {
            return {
              ...skillCat,
              items: Array.from(new Set([...skillCat.items, ...fill.skills.technical]))
            };
          }
          if (skillCat.category === 'Soft Skills') {
            return {
              ...skillCat,
              items: Array.from(new Set([...skillCat.items, ...fill.skills.soft]))
            };
          }
          if (skillCat.category === 'Tools') {
            return {
              ...skillCat,
              items: Array.from(new Set([...skillCat.items, ...fill.skills.tools]))
            };
          }
          return skillCat;
        });

        // Merge Projects
        const updatedProjects = [...prev.projects];
        fill.projects.forEach(fillProj => {
          if (!updatedProjects.some(p => p.title.toLowerCase() === fillProj.title.toLowerCase())) {
            updatedProjects.push({
              title: fillProj.title,
              description: fillProj.description,
              technologies: '',
              link: fillProj.link
            });
          }
        });

        // Merge Certificates
        const updatedCertificates = [...prev.certificates];
        fill.certificates.forEach(fillCert => {
          if (!updatedCertificates.some(c => c.title.toLowerCase() === fillCert.title.toLowerCase())) {
            updatedCertificates.push({
              title: fillCert.title,
              issuer: '',
              date: fillCert.date
            });
          }
        });

        return {
          ...prev,
          personal_info: {
            ...prev.personal_info,
            full_name: prev.personal_info.full_name || profile?.full_name || '',
            email: prev.personal_info.email || profile?.email || ''
          },
          education: updatedEducation,
          skills: updatedSkills,
          projects: updatedProjects,
          certificates: updatedCertificates
        };
      });

      alert('Tự động điền hoàn tất! Hãy kiểm tra các mục trong form. ✨');
    } catch (err) {
      console.error(err);
    } finally {
      setAutofilling(false);
    }
  };

  const handleGenerateObjective = async () => {
    if (!profile) return;
    setGeneratingObjective(true);
    try {
      const generated = await cvService.generateObjective(profile, careerAnalysis);
      setCvData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          objective: generated
        };
      });
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingObjective(false);
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (!cvData) return null;

  const expired = isExpired();
  const daysLeft = getDaysRemaining();

  return (
    <div className="space-y-6 relative">

      {/* CSS print override inline style block */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #cv-print-area, #cv-print-area * {
            visibility: visible;
          }
          #cv-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            min-height: 297mm;
            box-shadow: none;
            border: none;
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header bar controls (no-print) */}
      <div className="no-print bg-white border border-gray-100 rounded-3xl p-5 shadow-sm flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-teal-500 to-cyan-500 rounded-2xl text-white shadow-md shadow-teal-100">
            <FileText size={22} />
          </div>
          <div>
            <h3 className="font-extrabold text-gray-800 text-lg">Thiết kế CV thông minh</h3>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 mt-0.5">
              <Clock size={12} />
              <span>Thời gian lưu CV:</span>
              {isPro ? (
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 font-extrabold flex items-center gap-1">
                  👑 Vĩnh viễn (Pro)
                </span>
              ) : (
                <>
                  <span className={`px-2 py-0.5 rounded-full ${expired ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-teal-50 text-teal-600 border border-teal-100'}`}>
                    {expired ? 'Đã hết hạn' : `${daysLeft} ngày còn lại`}
                  </span>
                  {!expired && daysLeft < 7 && (
                    <button
                      onClick={handleRenew}
                      disabled={renewing}
                      className="text-indigo-600 hover:text-indigo-800 underline flex items-center gap-0.5 font-bold"
                    >
                      {renewing ? 'Đang gia hạn...' : 'Gia hạn thêm 7 ngày'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode Switcher */}
          <div className="bg-gray-100 p-1 rounded-xl flex gap-1">
            <button
              onClick={() => setMode('edit')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'edit'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <Edit3 size={14} /> Chỉnh sửa
            </button>
            <button
              onClick={() => setMode('preview')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'preview'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <Eye size={14} /> Xem trước & In
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || expired}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl transition-all shadow-md shadow-indigo-100 hover:scale-[1.02] active:scale-[0.98]"
          >
            {saving ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
            Lưu CV
          </button>

          {mode === 'preview' && (
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:opacity-95 text-white font-extrabold text-sm rounded-xl transition-all shadow-md shadow-teal-100 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Download size={14} /> Tải PDF
            </button>
          )}
        </div>
      </div>

      {/* Save status notification popup */}
      {saveSuccess && (
        <div className="no-print fixed bottom-6 right-6 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl z-50 flex items-center gap-2 animate-bounce font-bold">
          <Check size={18} />
          <span>Lưu CV thành công!</span>
        </div>
      )}

      {/* Expired warning overlay */}
      {expired && (
        <div className="no-print bg-red-50 border border-red-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={24} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-extrabold text-red-800 text-sm">CV của bạn đã hết hạn cập nhật (quá 7 ngày)</h4>
              <p className="text-xs text-red-600 font-medium mt-1 leading-relaxed">
                Để tránh dữ liệu cũ không đồng bộ với GPA hoặc Goal hiện tại, hệ thống tạm khoá cập nhật. Bạn có thể gia hạn ngay để chỉnh sửa tiếp.
              </p>
            </div>
          </div>
          <button
            onClick={handleRenew}
            disabled={renewing}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl flex items-center gap-1.5 shrink-0 transition-all shadow-md shadow-red-200"
          >
            {renewing ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />}
            Gia hạn cập nhật
          </button>
        </div>
      )}

      {/* Mode panels */}
      {mode === 'edit' ? (
        <div className="no-print grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Main forms column (left) */}
          <div className="lg:col-span-2 space-y-6">

            {/* Autofill Helper Block */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-emerald-800 flex items-center gap-1.5">
                  <Compass className="animate-spin-slow text-teal-600" size={16} />
                  Tính năng tự động điền thông tin (Auto-fill)
                </h4>
                <p className="text-xs text-teal-700/80 font-medium max-w-lg leading-relaxed">
                  Lấy thông tin học vấn (GPA, môn học thế mạnh) từ GPA Tracker và các kỹ năng, chứng chỉ, dự án cá nhân đã hoàn thành từ Goals Dashboard.
                </p>
              </div>
              <button
                onClick={handleAutofill}
                disabled={autofilling || expired}
                className="px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-200 shrink-0"
              >
                {autofilling ? <RefreshCw className="animate-spin" size={14} /> : <Compass size={14} />}
                Fill Profile-Goals
              </button>
            </div>

            {/* Personal Info Form */}
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
              <h4 className="font-extrabold text-gray-800 text-sm uppercase tracking-wider border-b border-gray-100 pb-2.5 flex items-center gap-2">
                <User size={16} className="text-indigo-500" />
                Thông tin cá nhân
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1.5">Họ và tên</label>
                  <input
                    type="text"
                    value={cvData.personal_info.full_name}
                    onChange={(e) => setCvData({
                      ...cvData,
                      personal_info: { ...cvData.personal_info, full_name: e.target.value }
                    })}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none text-sm font-medium transition-all"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1.5">Email</label>
                  <input
                    type="email"
                    value={cvData.personal_info.email}
                    onChange={(e) => setCvData({
                      ...cvData,
                      personal_info: { ...cvData.personal_info, email: e.target.value }
                    })}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none text-sm font-medium transition-all"
                    placeholder="nva@gmail.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1.5">Số điện thoại</label>
                  <input
                    type="tel"
                    value={cvData.personal_info.phone || ''}
                    onChange={(e) => setCvData({
                      ...cvData,
                      personal_info: { ...cvData.personal_info, phone: e.target.value }
                    })}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none text-sm font-medium transition-all"
                    placeholder="0912345678"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1.5">Đường dẫn ảnh đại diện (avatar URL)</label>
                  <input
                    type="text"
                    value={cvData.personal_info.avatar_url || ''}
                    onChange={(e) => setCvData({
                      ...cvData,
                      personal_info: { ...cvData.personal_info, avatar_url: e.target.value }
                    })}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none text-sm font-medium transition-all"
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1.5">LinkedIn Profile Link</label>
                  <input
                    type="text"
                    value={cvData.personal_info.linkedin || ''}
                    onChange={(e) => setCvData({
                      ...cvData,
                      personal_info: { ...cvData.personal_info, linkedin: e.target.value }
                    })}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none text-sm font-medium transition-all"
                    placeholder="linkedin.com/in/nguyenvana"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1.5">GitHub Profile Link</label>
                  <input
                    type="text"
                    value={cvData.personal_info.github || ''}
                    onChange={(e) => setCvData({
                      ...cvData,
                      personal_info: { ...cvData.personal_info, github: e.target.value }
                    })}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none text-sm font-medium transition-all"
                    placeholder="github.com/nguyenvana"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-400 block mb-1.5">Portfolio/Personal Web Link</label>
                  <input
                    type="text"
                    value={cvData.personal_info.portfolio || ''}
                    onChange={(e) => setCvData({
                      ...cvData,
                      personal_info: { ...cvData.personal_info, portfolio: e.target.value }
                    })}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none text-sm font-medium transition-all"
                    placeholder="nguyenvana.dev"
                  />
                </div>
              </div>
            </div>

            {/* Objective Form */}
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
                <h4 className="font-extrabold text-gray-800 text-sm uppercase tracking-wider flex items-center gap-2">
                  <Sparkles size={16} className="text-purple-500" />
                  Mục tiêu nghề nghiệp
                </h4>
                <button
                  onClick={handleGenerateObjective}
                  disabled={generatingObjective || expired}
                  className="px-3 py-1.5 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 font-extrabold text-xs text-purple-700 rounded-xl hover:from-purple-100 hover:to-indigo-100 transition-all flex items-center gap-1 shadow-sm disabled:opacity-50"
                >
                  {generatingObjective ? <RefreshCw className="animate-spin" size={12} /> : <Sparkles size={12} />}
                  AI viết hộ ✨
                </button>
              </div>

              <div>
                <textarea
                  value={cvData.objective}
                  onChange={(e) => setCvData({ ...cvData, objective: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 outline-none text-sm font-medium transition-all resize-none"
                  placeholder="Viết một đoạn giới thiệu ngắn về định hướng nghề nghiệp, kỹ năng cốt lõi và mong muốn đóng góp..."
                />
              </div>
            </div>

            {/* Education Form */}
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
                <h4 className="font-extrabold text-gray-800 text-sm uppercase tracking-wider flex items-center gap-2">
                  <GraduationCap size={16} className="text-indigo-500" />
                  Học vấn
                </h4>
                <button
                  onClick={() => {
                    setCvData(prev => {
                      if (!prev) return null;
                      return {
                        ...prev,
                        education: [...prev.education, { university: '', major: '', gpa: undefined, graduation_year: undefined, top_courses: [] }]
                      };
                    });
                  }}
                  className="px-3 py-1 bg-gray-50 border border-gray-200 hover:bg-gray-100 font-bold text-xs text-gray-600 rounded-xl transition-all flex items-center gap-1"
                >
                  <PlusCircle size={12} /> Thêm trường học
                </button>
              </div>

              {cvData.education.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Chưa có thông tin học vấn.</p>
              ) : (
                <div className="space-y-6">
                  {cvData.education.map((edu, idx) => (
                    <div key={idx} className="relative p-4 bg-gray-50 rounded-2xl border border-gray-100/50 space-y-3">
                      <button
                        onClick={() => {
                          setCvData(prev => {
                            if (!prev) return null;
                            const copy = [...prev.education];
                            copy.splice(idx, 1);
                            return { ...prev, education: copy };
                          });
                        }}
                        className="absolute right-3 top-3 p-1 bg-white border border-gray-100 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                        title="Xóa"
                      >
                        <Trash2 size={14} />
                      </button>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-gray-400 block mb-1">Trường đại học</label>
                          <input
                            type="text"
                            value={edu.university}
                            onChange={(e) => {
                              const next = [...cvData.education];
                              next[idx].university = e.target.value;
                              setCvData({ ...cvData, education: next });
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none text-xs font-semibold"
                            placeholder="Đại học Quốc gia"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-400 block mb-1">Ngành học</label>
                          <input
                            type="text"
                            value={edu.major}
                            onChange={(e) => {
                              const next = [...cvData.education];
                              next[idx].major = e.target.value;
                              setCvData({ ...cvData, education: next });
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none text-xs font-semibold"
                            placeholder="Khoa học máy tính"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-400 block mb-1">Điểm GPA (Thang 4)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={edu.gpa === undefined ? '' : edu.gpa}
                            onChange={(e) => {
                              const next = [...cvData.education];
                              next[idx].gpa = e.target.value === '' ? undefined : parseFloat(e.target.value);
                              setCvData({ ...cvData, education: next });
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none text-xs font-semibold"
                            placeholder="3.5"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-400 block mb-1">Năm tốt nghiệp dự kiến</label>
                          <input
                            type="number"
                            value={edu.graduation_year === undefined ? '' : edu.graduation_year}
                            onChange={(e) => {
                              const next = [...cvData.education];
                              next[idx].graduation_year = e.target.value === '' ? undefined : parseInt(e.target.value);
                              setCvData({ ...cvData, education: next });
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none text-xs font-semibold"
                            placeholder="2027"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[11px] font-bold text-gray-400 block mb-1">Môn học nổi bật (Ngăn cách bằng dấu phẩy)</label>
                          <input
                            type="text"
                            value={edu.top_courses?.join(', ') || ''}
                            onChange={(e) => {
                              const next = [...cvData.education];
                              next[idx].top_courses = e.target.value.split(',').map(c => c.trim()).filter(Boolean);
                              setCvData({ ...cvData, education: next });
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none text-xs font-semibold"
                            placeholder="Ví dụ: Cấu trúc dữ liệu và giải thuật (A+), Lập trình hướng đối tượng (A)"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Experience Form */}
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
                <h4 className="font-extrabold text-gray-800 text-sm uppercase tracking-wider flex items-center gap-2">
                  <Briefcase size={16} className="text-indigo-500" />
                  Kinh nghiệm làm việc
                </h4>
                <button
                  onClick={() => {
                    setCvData(prev => {
                      if (!prev) return null;
                      return {
                        ...prev,
                        experience: [...prev.experience, { position: '', company: '', start_date: '', end_date: '', description: '' }]
                      };
                    });
                  }}
                  className="px-3 py-1 bg-gray-50 border border-gray-200 hover:bg-gray-100 font-bold text-xs text-gray-600 rounded-xl transition-all flex items-center gap-1"
                >
                  <PlusCircle size={12} /> Thêm kinh nghiệm
                </button>
              </div>

              {cvData.experience.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Chưa có thông tin kinh nghiệm.</p>
              ) : (
                <div className="space-y-6">
                  {cvData.experience.map((exp, idx) => (
                    <div key={idx} className="relative p-4 bg-gray-50 rounded-2xl border border-gray-100/50 space-y-3">
                      <button
                        onClick={() => {
                          setCvData(prev => {
                            if (!prev) return null;
                            const copy = [...prev.experience];
                            copy.splice(idx, 1);
                            return { ...prev, experience: copy };
                          });
                        }}
                        className="absolute right-3 top-3 p-1 bg-white border border-gray-100 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                        title="Xóa"
                      >
                        <Trash2 size={14} />
                      </button>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-gray-400 block mb-1">Vị trí</label>
                          <input
                            type="text"
                            value={exp.position}
                            onChange={(e) => {
                              const next = [...cvData.experience];
                              next[idx].position = e.target.value;
                              setCvData({ ...cvData, experience: next });
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none text-xs font-semibold"
                            placeholder="Ví dụ: Backend Developer Intern"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-400 block mb-1">Công ty / Tổ chức</label>
                          <input
                            type="text"
                            value={exp.company}
                            onChange={(e) => {
                              const next = [...cvData.experience];
                              next[idx].company = e.target.value;
                              setCvData({ ...cvData, experience: next });
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none text-xs font-semibold"
                            placeholder="Ví dụ: Công ty Công nghệ XYZ"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-400 block mb-1">Thời gian bắt đầu (Tháng/Năm)</label>
                          <input
                            type="text"
                            value={exp.start_date}
                            onChange={(e) => {
                              const next = [...cvData.experience];
                              next[idx].start_date = e.target.value;
                              setCvData({ ...cvData, experience: next });
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none text-xs font-semibold"
                            placeholder="Ví dụ: 06/2025"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-400 block mb-1">Thời gian kết thúc (để trống nếu hiện tại)</label>
                          <input
                            type="text"
                            value={exp.end_date || ''}
                            onChange={(e) => {
                              const next = [...cvData.experience];
                              next[idx].end_date = e.target.value;
                              setCvData({ ...cvData, experience: next });
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none text-xs font-semibold"
                            placeholder="Ví dụ: Hiện tại"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[11px] font-bold text-gray-400 block mb-1">Mô tả công việc & Thành tích</label>
                          <textarea
                            value={exp.description}
                            onChange={(e) => {
                              const next = [...cvData.experience];
                              next[idx].description = e.target.value;
                              setCvData({ ...cvData, experience: next });
                            }}
                            rows={3}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none text-xs font-medium resize-none"
                            placeholder="Thiết kế và phát triển RESTful APIs bằng Express.js, tối ưu hóa câu lệnh SQL..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Projects Form */}
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
                <h4 className="font-extrabold text-gray-800 text-sm uppercase tracking-wider flex items-center gap-2">
                  <FolderGit2 size={16} className="text-indigo-500" />
                  Dự án cá nhân
                </h4>
                <button
                  onClick={() => {
                    setCvData(prev => {
                      if (!prev) return null;
                      return {
                        ...prev,
                        projects: [...prev.projects, { title: '', description: '', technologies: '', link: '' }]
                      };
                    });
                  }}
                  className="px-3 py-1 bg-gray-50 border border-gray-200 hover:bg-gray-100 font-bold text-xs text-gray-600 rounded-xl transition-all flex items-center gap-1"
                >
                  <PlusCircle size={12} /> Thêm dự án
                </button>
              </div>

              {cvData.projects.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Chưa có thông tin dự án.</p>
              ) : (
                <div className="space-y-6">
                  {cvData.projects.map((proj, idx) => (
                    <div key={idx} className="relative p-4 bg-gray-50 rounded-2xl border border-gray-100/50 space-y-3">
                      <button
                        onClick={() => {
                          setCvData(prev => {
                            if (!prev) return null;
                            const copy = [...prev.projects];
                            copy.splice(idx, 1);
                            return { ...prev, projects: copy };
                          });
                        }}
                        className="absolute right-3 top-3 p-1 bg-white border border-gray-100 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                        title="Xóa"
                      >
                        <Trash2 size={14} />
                      </button>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-gray-400 block mb-1">Tên dự án</label>
                          <input
                            type="text"
                            value={proj.title}
                            onChange={(e) => {
                              const next = [...cvData.projects];
                              next[idx].title = e.target.value;
                              setCvData({ ...cvData, projects: next });
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none text-xs font-semibold"
                            placeholder="Ví dụ: Ứng dụng Quản lý Tài chính cá nhân"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-400 block mb-1">Công nghệ sử dụng</label>
                          <input
                            type="text"
                            value={proj.technologies || ''}
                            onChange={(e) => {
                              const next = [...cvData.projects];
                              next[idx].technologies = e.target.value;
                              setCvData({ ...cvData, projects: next });
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none text-xs font-semibold"
                            placeholder="React, TypeScript, Tailwind, Supabase"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[11px] font-bold text-gray-400 block mb-1">Link dự án (GitHub / Live)</label>
                          <input
                            type="text"
                            value={proj.link || ''}
                            onChange={(e) => {
                              const next = [...cvData.projects];
                              next[idx].link = e.target.value;
                              setCvData({ ...cvData, projects: next });
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none text-xs font-semibold"
                            placeholder="github.com/username/project"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[11px] font-bold text-gray-400 block mb-1">Mô tả dự án & Kết quả</label>
                          <textarea
                            value={proj.description}
                            onChange={(e) => {
                              const next = [...cvData.projects];
                              next[idx].description = e.target.value;
                              setCvData({ ...cvData, projects: next });
                            }}
                            rows={3}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none text-xs font-medium resize-none"
                            placeholder="Ứng dụng giúp người dùng lập ngân sách thông minh, sử dụng cơ chế đồng bộ realtime bằng Supabase..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right sidebar column (Skills & Certs) */}
          <div className="space-y-6">

            {/* Skills Card */}
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
              <h4 className="font-extrabold text-gray-800 text-sm uppercase tracking-wider border-b border-gray-100 pb-2.5 flex items-center gap-2">
                <CheckSquare size={16} className="text-indigo-500" />
                Kỹ năng chuyên môn
              </h4>

              {cvData.skills.map((cat, idx) => (
                <div key={idx} className="space-y-2 bg-gray-50/50 p-3 rounded-2xl border border-gray-100/50">
                  <span className="text-xs font-extrabold text-indigo-700 block uppercase tracking-wider">{cat.category}</span>
                  <input
                    type="text"
                    value={cat.items.join(', ')}
                    onChange={(e) => {
                      const next = [...cvData.skills];
                      next[idx].items = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                      setCvData({ ...cvData, skills: next });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none text-xs font-semibold"
                    placeholder="Ví dụ: HTML, CSS, JavaScript"
                  />
                </div>
              ))}
            </div>

            {/* Certificates Card */}
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
                <h4 className="font-extrabold text-gray-800 text-sm uppercase tracking-wider flex items-center gap-2">
                  <Award size={16} className="text-indigo-500" />
                  Chứng chỉ
                </h4>
                <button
                  onClick={() => {
                    setCvData(prev => {
                      if (!prev) return null;
                      return {
                        ...prev,
                        certificates: [...prev.certificates, { title: '', issuer: '', date: '' }]
                      };
                    });
                  }}
                  className="px-2 py-0.5 bg-gray-50 border border-gray-200 hover:bg-gray-100 font-bold text-[10px] text-gray-600 rounded-xl transition-all flex items-center gap-1"
                >
                  <PlusCircle size={10} /> Thêm
                </button>
              </div>

              {cvData.certificates.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Chưa có chứng chỉ.</p>
              ) : (
                <div className="space-y-4">
                  {cvData.certificates.map((cert, idx) => (
                    <div key={idx} className="relative p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                      <button
                        onClick={() => {
                          setCvData(prev => {
                            if (!prev) return null;
                            const copy = [...prev.certificates];
                            copy.splice(idx, 1);
                            return { ...prev, certificates: copy };
                          });
                        }}
                        className="absolute right-2 top-2 p-1 bg-white border border-gray-100 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                        title="Xóa"
                      >
                        <Trash2 size={12} />
                      </button>

                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={cert.title}
                          onChange={(e) => {
                            const next = [...cvData.certificates];
                            next[idx].title = e.target.value;
                            setCvData({ ...cvData, certificates: next });
                          }}
                          className="w-full px-2 py-1.5 rounded-lg bg-white border border-gray-200 outline-none text-xs font-bold"
                          placeholder="Ví dụ: AWS Certified Solutions Architect"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={cert.issuer || ''}
                            onChange={(e) => {
                              const next = [...cvData.certificates];
                              next[idx].issuer = e.target.value;
                              setCvData({ ...cvData, certificates: next });
                            }}
                            className="w-full px-2 py-1 rounded-lg bg-white border border-gray-200 outline-none text-[10px] font-semibold"
                            placeholder="Amazon Web Services"
                          />
                          <input
                            type="text"
                            value={cert.date || ''}
                            onChange={(e) => {
                              const next = [...cvData.certificates];
                              next[idx].date = e.target.value;
                              setCvData({ ...cvData, certificates: next });
                            }}
                            className="w-full px-2 py-1 rounded-lg bg-white border border-gray-200 outline-none text-[10px] font-semibold"
                            placeholder="05/2026"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Extracurricular Activities Card */}
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
                <h4 className="font-extrabold text-gray-800 text-sm uppercase tracking-wider flex items-center gap-2">
                  <User size={16} className="text-indigo-500" />
                  Hoạt động
                </h4>
                <button
                  onClick={() => {
                    setCvData(prev => {
                      if (!prev) return null;
                      return {
                        ...prev,
                        activities: [...prev.activities, { title: '', organization: '', description: '' }]
                      };
                    });
                  }}
                  className="px-2 py-0.5 bg-gray-50 border border-gray-200 hover:bg-gray-100 font-bold text-[10px] text-gray-600 rounded-xl transition-all flex items-center gap-1"
                >
                  <PlusCircle size={10} /> Thêm
                </button>
              </div>

              {cvData.activities.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Chưa có thông tin hoạt động.</p>
              ) : (
                <div className="space-y-4">
                  {cvData.activities.map((act, idx) => (
                    <div key={idx} className="relative p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                      <button
                        onClick={() => {
                          setCvData(prev => {
                            if (!prev) return null;
                            const copy = [...prev.activities];
                            copy.splice(idx, 1);
                            return { ...prev, activities: copy };
                          });
                        }}
                        className="absolute right-2 top-2 p-1 bg-white border border-gray-100 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                        title="Xóa"
                      >
                        <Trash2 size={12} />
                      </button>

                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={act.title}
                          onChange={(e) => {
                            const next = [...cvData.activities];
                            next[idx].title = e.target.value;
                            setCvData({ ...cvData, activities: next });
                          }}
                          className="w-full px-2 py-1.5 rounded-lg bg-white border border-gray-200 outline-none text-xs font-bold"
                          placeholder="Ví dụ: Tình nguyện viên"
                        />
                        <input
                          type="text"
                          value={act.organization || ''}
                          onChange={(e) => {
                            const next = [...cvData.activities];
                            next[idx].organization = e.target.value;
                            setCvData({ ...cvData, activities: next });
                          }}
                          className="w-full px-2 py-1 rounded-lg bg-white border border-gray-200 outline-none text-[10px] font-semibold"
                          placeholder="Câu lạc bộ Công nghệ sinh viên"
                        />
                        <textarea
                          value={act.description || ''}
                          onChange={(e) => {
                            const next = [...cvData.activities];
                            next[idx].description = e.target.value;
                            setCvData({ ...cvData, activities: next });
                          }}
                          rows={2}
                          className="w-full px-2 py-1 rounded-lg bg-white border border-gray-200 outline-none text-[10px] font-medium resize-none"
                          placeholder="Hỗ trợ tổ chức Hackathon, viết nội dung truyền thông..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      ) : (
        /* Preview Mode (A4 Grid Paper Layout representation) */
        <div className="w-full overflow-x-auto py-6 bg-slate-100 rounded-3xl no-print flex justify-center">
          <div
            id="cv-print-area"
            className="w-[210mm] min-h-[297mm] bg-white text-gray-800 shadow-xl border border-gray-200 grid grid-cols-3 overflow-hidden text-xs print:shadow-none"
            style={{ contentVisibility: 'auto' }}
          >
            {/* Left Column (Dark Slate background) */}
            <div className="col-span-1 bg-slate-800 text-slate-100 p-6 flex flex-col space-y-6">

              {/* Header Profile */}
              <div className="text-center space-y-3">
                {cvData.personal_info.avatar_url ? (
                  <img
                    src={cvData.personal_info.avatar_url}
                    alt="Avatar"
                    className="w-24 h-24 rounded-full mx-auto object-cover border-2 border-slate-700 bg-slate-700 shadow-sm"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full mx-auto bg-slate-700 flex items-center justify-center text-slate-400 border-2 border-slate-600 shadow-sm">
                    <User size={36} />
                  </div>
                )}
                <div>
                  <h2 className="text-base font-extrabold tracking-tight uppercase">{cvData.personal_info.full_name || 'Họ và tên'}</h2>
                </div>
              </div>

              {/* Contacts */}
              <div className="space-y-2 border-t border-slate-700 pt-4">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Thông tin liên hệ</span>
                {cvData.personal_info.email && (
                  <div className="flex items-center gap-2 text-[11px] text-slate-300">
                    <Mail size={12} className="text-teal-400 shrink-0" />
                    <span className="truncate">{cvData.personal_info.email}</span>
                  </div>
                )}
                {cvData.personal_info.phone && (
                  <div className="flex items-center gap-2 text-[11px] text-slate-300">
                    <Phone size={12} className="text-teal-400 shrink-0" />
                    <span>{cvData.personal_info.phone}</span>
                  </div>
                )}
                {cvData.personal_info.linkedin && (
                  <div className="flex items-center gap-2 text-[11px] text-slate-300">
                    <Linkedin size={12} className="text-teal-400 shrink-0" />
                    <span className="truncate">{cvData.personal_info.linkedin}</span>
                  </div>
                )}
                {cvData.personal_info.github && (
                  <div className="flex items-center gap-2 text-[11px] text-slate-300">
                    <Github size={12} className="text-teal-400 shrink-0" />
                    <span className="truncate">{cvData.personal_info.github}</span>
                  </div>
                )}
                {cvData.personal_info.portfolio && (
                  <div className="flex items-center gap-2 text-[11px] text-slate-300">
                    <Compass size={12} className="text-teal-400 shrink-0" />
                    <span className="truncate">{cvData.personal_info.portfolio}</span>
                  </div>
                )}
              </div>

              {/* Skills */}
              <div className="space-y-4 border-t border-slate-700 pt-4">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Kỹ năng cốt lõi</span>
                {cvData.skills.map((skillCat, idx) => {
                  if (skillCat.items.length === 0) return null;
                  return (
                    <div key={idx} className="space-y-1">
                      <span className="text-[10px] font-black text-teal-400 uppercase tracking-wider block">{skillCat.category}</span>
                      <div className="flex flex-wrap gap-1">
                        {skillCat.items.map((skill, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 bg-slate-700/50 text-slate-200 font-semibold rounded">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Certificates */}
              {cvData.certificates.length > 0 && (
                <div className="space-y-3 border-t border-slate-700 pt-4">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Chứng chỉ</span>
                  <div className="space-y-2">
                    {cvData.certificates.map((cert, idx) => (
                      <div key={idx} className="text-[11px]">
                        <h5 className="font-extrabold text-slate-200">{cert.title}</h5>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {cert.issuer} {cert.date ? `| ${cert.date}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column (White background) */}
            <div className="col-span-2 p-8 flex flex-col space-y-6">

              {/* Objective */}
              {cvData.objective && (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-black text-indigo-700 uppercase tracking-wider border-b-2 border-indigo-100 pb-1 flex items-center gap-1.5">
                    <User size={13} />
                    Giới thiệu bản thân
                  </h3>
                  <p className="text-[11px] text-gray-600 font-semibold leading-relaxed">
                    {cvData.objective}
                  </p>
                </div>
              )}

              {/* Education */}
              {cvData.education.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-black text-indigo-700 uppercase tracking-wider border-b-2 border-indigo-100 pb-1 flex items-center gap-1.5">
                    <GraduationCap size={14} />
                    Học vấn
                  </h3>
                  <div className="space-y-3">
                    {cvData.education.map((edu, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-start font-extrabold">
                          <h4 className="text-[12px] text-gray-800">{edu.university}</h4>
                          <span className="text-gray-400 font-medium">{edu.graduation_year ? `Tốt nghiệp ${edu.graduation_year}` : ''}</span>
                        </div>
                        <div className="flex justify-between items-center font-bold text-gray-500">
                          <p className="text-[11px] italic">{edu.major}</p>
                          {edu.gpa !== undefined && <span className="text-xs text-indigo-600 bg-indigo-50/50 border border-indigo-100/50 px-2 py-0.5 rounded-md">GPA: {edu.gpa.toFixed(2)}</span>}
                        </div>
                        {edu.top_courses && edu.top_courses.length > 0 && (
                          <p className="text-[10px] text-gray-500 font-medium">
                            <strong className="text-gray-600">Môn tiêu biểu:</strong> {edu.top_courses.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Experience */}
              {cvData.experience.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-black text-indigo-700 uppercase tracking-wider border-b-2 border-indigo-100 pb-1 flex items-center gap-1.5">
                    <Briefcase size={13} />
                    Kinh nghiệm làm việc
                  </h3>
                  <div className="space-y-4">
                    {cvData.experience.map((exp, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-start font-extrabold">
                          <h4 className="text-[12px] text-gray-800">{exp.position}</h4>
                          <span className="text-gray-400 font-medium">{exp.start_date} - {exp.end_date || 'Hiện tại'}</span>
                        </div>
                        <h5 className="font-extrabold text-indigo-600">{exp.company}</h5>
                        <p className="text-[11px] text-gray-600 font-medium leading-relaxed whitespace-pre-line">
                          {exp.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects */}
              {cvData.projects.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-black text-indigo-700 uppercase tracking-wider border-b-2 border-indigo-100 pb-1 flex items-center gap-1.5">
                    <FolderGit2 size={13} />
                    Dự án tiêu biểu
                  </h3>
                  <div className="space-y-4">
                    {cvData.projects.map((proj, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-start font-extrabold">
                          <h4 className="text-[12px] text-gray-800">{proj.title}</h4>
                          {proj.link && (
                            <a
                              href={proj.link.startsWith('http') ? proj.link : `https://${proj.link}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-indigo-600 font-bold hover:underline"
                            >
                              Link dự án
                            </a>
                          )}
                        </div>
                        {proj.technologies && (
                          <p className="text-[10px] text-teal-600 font-extrabold">Công nghệ: {proj.technologies}</p>
                        )}
                        <p className="text-[11px] text-gray-600 font-medium leading-relaxed">
                          {proj.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activities */}
              {cvData.activities.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-black text-indigo-700 uppercase tracking-wider border-b-2 border-indigo-100 pb-1 flex items-center gap-1.5">
                    <User size={13} />
                    Hoạt động ngoại khóa
                  </h3>
                  <div className="space-y-3">
                    {cvData.activities.map((act, idx) => (
                      <div key={idx} className="space-y-1 text-[11px]">
                        <div className="flex justify-between items-start font-extrabold">
                          <h4 className="text-gray-800">{act.title}</h4>
                          <span className="text-gray-400 font-medium">{act.organization}</span>
                        </div>
                        {act.description && (
                          <p className="text-gray-500 font-medium leading-relaxed">
                            {act.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
