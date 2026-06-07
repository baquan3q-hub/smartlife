import { supabase } from './supabase';
import { CVData, Profile, CareerAnalysisResult } from '../types';
import { computeCourse, calculateCumulativeData } from './gpaCalculator';

export const cvService = {
  // Lấy CV data
  async getCVData(userId: string): Promise<CVData | null> {
    try {
      const { data, error } = await supabase
        .from('cv_data')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      return data || null;
    } catch (err) {
      console.error('Error fetching CV data:', err);
      return null;
    }
  },
  
  // Lưu/cập nhật CV data (tự động reset expires_at = now + 7 days)
  async saveCVData(userId: string, data: Partial<CVData>): Promise<boolean> {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data: existing } = await supabase
        .from('cv_data')
        .select('id')
        .eq('user_id', userId)
        .single();

      // Build payload, stripping empty/falsy id to let Supabase auto-generate
      const { id, created_at, ...rest } = data as any;
      const payload = {
        ...rest,
        user_id: userId,
        updated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString()
      };

      let error;
      if (existing) {
        const { error: err } = await supabase
          .from('cv_data')
          .update(payload)
          .eq('user_id', userId);
        error = err;
      } else {
        const { error: err } = await supabase
          .from('cv_data')
          .insert([payload]);
        error = err;
      }

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error saving CV data:', err);
      return false;
    }
  },

  // Gia hạn CV thêm 7 ngày
  async renewCVData(userId: string): Promise<boolean> {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error } = await supabase
        .from('cv_data')
        .update({
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error renewing CV data:', err);
      return false;
    }
  },
  
  // AI gợi ý mục tiêu nghề nghiệp
  async generateObjective(profile: Profile, careerAnalysis?: CareerAnalysisResult[]): Promise<string> {
    try {
      const domainsStr = careerAnalysis && careerAnalysis.length > 0
        ? careerAnalysis.map(c => `- Lĩnh vực: ${c.domain} (Độ phù hợp: ${c.fit_score}%)`).join('\n')
        : '';

      const prompt = `Bạn là chuyên gia tư vấn viết CV chuyên nghiệp.
Hãy viết một đoạn "Mục tiêu nghề nghiệp" (Career Objective) ngắn gọn, súc tích (khoảng 3-4 câu, dưới 150 từ) bằng tiếng Việt.
Hồ sơ người dùng:
- Ngành học: ${profile.major || 'Chưa cập nhật'}
- Trường: ${profile.university || 'Chưa cập nhật'}
- Định hướng cá nhân: ${profile.career_objective || 'Chưa cập nhật'}
- Nhóm tính cách: MBTI: ${profile.personality_mbti || 'Chưa kiểm tra'}, DISC: ${profile.personality_disc || 'Chưa kiểm tra'}
- Sở thích: ${profile.hobbies && profile.hobbies.length > 0 ? profile.hobbies.join(', ') : 'Chưa cập nhật'}
${domainsStr ? `\nLĩnh vực đề xuất từ AI:\n${domainsStr}` : ''}

Hãy viết một phần mục tiêu nghề nghiệp thật ấn tượng, nhấn mạnh vào định hướng, khả năng học hỏi và giá trị mang lại cho doanh nghiệp.
Chỉ trả về đoạn văn bản kết quả thô, không thêm bất kỳ định dạng Markdown hay lời giải thích nào khác.`;

      const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, topP: 0.95 }
      };

      const { callGeminiRaw } = await import('./geminiService');
      const data = await callGeminiRaw(body);
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return text.trim();
    } catch (err) {
      console.error('Error generating objective:', err);
      return 'Mục tiêu nghề nghiệp mẫu...';
    }
  },
  
  // Lấy dữ liệu tự động điền từ GPA và Goals
  async getAutoFillData(userId: string) {
    try {
      // 1. Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('university, major')
        .eq('id', userId)
        .single();

      // 2. Fetch GPA semesters & courses
      const { data: semesters } = await supabase
        .from('gpa_semesters')
        .select(`
          id,
          name,
          academic_year,
          semester_type,
          year_of_study,
          is_current,
          courses: gpa_courses (*)
        `)
        .eq('user_id', userId);

      let topCourses: string[] = [];
      let gpa = 0;

      if (semesters && semesters.length > 0) {
        const mappedSemesters = semesters.map((s: any) => ({
          ...s,
          courses: s.courses || []
        }));
        
        const gpaData = calculateCumulativeData(mappedSemesters);
        gpa = gpaData.gpa || 0;

        const allCourses = mappedSemesters.flatMap(s => s.courses);
        topCourses = allCourses
          .map(course => {
            const computed = course.computed || computeCourse(course);
            return { name: course.name, grade: computed.letterGrade || '' };
          })
          .filter(c => c.grade === 'A+' || c.grade === 'A' || c.grade === 'B+')
          .map(c => `${c.name} (${c.grade})`)
          .slice(0, 5);
      }

      // 3. Fetch completed goals
      const { data: goals } = await supabase
        .from('career_goals')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'completed');

      const skills: { technical: string[]; soft: string[]; tools: string[] } = {
        technical: [],
        soft: [],
        tools: []
      };
      const projects: { title: string; description: string; link?: string }[] = [];
      const certificates: { title: string; date?: string }[] = [];

      if (goals) {
        goals.forEach(goal => {
          if (goal.category === 'technical') {
            skills.technical.push(goal.title);
          } else if (goal.category === 'soft') {
            skills.soft.push(goal.title);
          } else if (goal.category === 'tool') {
            skills.tools.push(goal.title);
          } else if (goal.category === 'project') {
            projects.push({
              title: goal.title,
              description: goal.description || '',
              link: goal.link || undefined
            });
          } else if (goal.category === 'certificate') {
            certificates.push({
              title: goal.title,
              date: goal.deadline || undefined
            });
          }
        });
      }

      return {
        education: {
          university: profile?.university || '',
          major: profile?.major || '',
          gpa,
          topCourses
        },
        skills,
        projects,
        certificates
      };
    } catch (err) {
      console.error('Error getting auto-fill data:', err);
      return {
        education: { university: '', major: '', gpa: 0, topCourses: [] },
        skills: { technical: [], soft: [], tools: [] },
        projects: [],
        certificates: []
      };
    }
  }
};
