// File: src/services/careerGoalService.ts
import { supabase } from './supabase';
import { CareerPosition, CareerGoal, LifeGoal } from '../types';

export const careerGoalService = {
  // --- CAREER POSITIONS ---
  async fetchPositions(userId: string): Promise<CareerPosition[]> {
    try {
      const { data, error } = await supabase
        .from('career_positions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching career positions:', err);
      return [];
    }
  },

  async addPosition(userId: string, title: string): Promise<CareerPosition | null> {
    try {
      const { data, error } = await supabase
        .from('career_positions')
        .insert([{ user_id: userId, title }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error adding career position:', err);
      return null;
    }
  },

  async updatePosition(id: string, title: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('career_positions')
        .update({ title })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error updating career position:', err);
      return false;
    }
  },

  async deletePosition(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('career_positions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error deleting career position:', err);
      return false;
    }
  },

  // --- CAREER GOALS ---
  async fetchCareerGoals(userId: string): Promise<CareerGoal[]> {
    try {
      const { data, error } = await supabase
        .from('career_goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching career goals:', err);
      return [];
    }
  },

  async addCareerGoal(userId: string, goal: Omit<CareerGoal, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<CareerGoal | null> {
    try {
      const { data, error } = await supabase
        .from('career_goals')
        .insert([{ user_id: userId, ...goal }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error adding career goal:', err);
      return null;
    }
  },

  async updateCareerGoal(id: string, updates: Partial<CareerGoal>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('career_goals')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error updating career goal:', err);
      return false;
    }
  },

  async deleteCareerGoal(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('career_goals')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error deleting career goal:', err);
      return false;
    }
  },

  // --- LIFE GOALS (5 YEARS) ---
  async fetchLifeGoals(userId: string): Promise<LifeGoal[]> {
    try {
      const { data, error } = await supabase
        .from('life_goals')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching life goals:', err);
      return [];
    }
  },

  async addLifeGoal(userId: string, goal: Omit<LifeGoal, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<LifeGoal | null> {
    try {
      const { data, error } = await supabase
        .from('life_goals')
        .insert([{ user_id: userId, ...goal }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error adding life goal:', err);
      return null;
    }
  },

  async updateLifeGoal(id: string, updates: Partial<LifeGoal>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('life_goals')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error updating life goal:', err);
      return false;
    }
  },

  async deleteLifeGoal(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('life_goals')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error deleting life goal:', err);
      return false;
    }
  },

  async reorderLifeGoals(userId: string, reorderedList: LifeGoal[]): Promise<boolean> {
    try {
      const updates = reorderedList.map((g, idx) => 
        supabase
          .from('life_goals')
          .update({ sort_order: idx, updated_at: new Date().toISOString() })
          .eq('id', g.id)
      );

      const results = await Promise.all(updates);
      const failed = results.find(r => r.error);
      if (failed?.error) throw failed.error;
      return true;
    } catch (err) {
      console.error('Error reordering life goals:', err);
      return false;
    }
  },

  // --- AI INTEGRATION ---
  async getAIRecommendations(positionTitle: string, currentSkills: string[], gpaCourses: string[]): Promise<any[]> {
    try {
      const prompt = `Bạn là chuyên gia tư vấn lộ trình sự nghiệp và cố vấn học tập xuất sắc.
Hãy nghiên cứu vị trí nghề nghiệp mục tiêu: "${positionTitle}".
Người dùng hiện đã có các kỹ năng: ${currentSkills.length > 0 ? currentSkills.join(', ') : 'Chưa có'}.
Người dùng đã hoàn thành các môn học chuyên ngành sau trong bảng điểm GPA: ${gpaCourses.length > 0 ? gpaCourses.join(', ') : 'Chưa có'}.

Hãy đề xuất từ 4 đến 6 kỹ năng, dự án cá nhân hoặc công cụ học tập quan trọng nhất để giúp người dùng xây dựng portfolio xuất sắc cho vị trí này.
Lưu ý quan trọng:
1. Đối chiếu với các môn học GPA đã hoàn thành: Nếu họ đã học tốt các môn lý thuyết liên quan, hãy tập trung đề xuất kỹ năng thực hành, công cụ làm việc thực tế, hoặc dự án cá nhân (Project) để rèn luyện thay vì lý thuyết suông.
2. Tránh đề xuất trùng lặp với các kỹ năng họ đã có.
3. Trả về kết quả DƯỚI DẠNG MỘT MẢNG JSON HỢP LỆ. KHÔNG viết thêm bất kỳ từ giải thích nào trước hoặc sau khối JSON. KHÔNG đặt trong block markdown \`\`\`json. Chỉ trả về chuỗi JSON thô.

Mỗi kỹ năng trong mảng JSON phải tuân thủ cấu trúc sau:
{
  "title": "Tên kỹ năng hoặc dự án cá nhân ngắn gọn, chuyên nghiệp",
  "category": "technical" | "domain" | "soft" | "project" | "tool" | "certificate",
  "priority": "high" | "medium" | "low",
  "duration_days": số ngày dự kiến cần thiết để học/hoàn thành (VD: 30, 45, 60),
  "description": "Mô tả chi tiết tại sao kỹ năng này cần thiết cho vị trí ${positionTitle} và gợi ý tài liệu/phương pháp học tập cụ thể",
  "link": "Link tài liệu học tập gợi ý chất lượng (nếu có, VD: https://coursera.org/... hoặc https://github.com/...)"
}
`;

      const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, topP: 0.95, responseMimeType: "application/json" }
      };

      // Import callGeminiRaw dynamically or let geminiService supply it
      const { callGeminiRaw } = await import('./geminiService');
      const data = await callGeminiRaw(body);
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (err) {
      console.error('Error getting AI recommendations:', err);
      return [];
    }
  },

  async addCareerGoalsBatch(userId: string, positionId: string, skills: any[]): Promise<boolean> {
    try {
      const dbSkills = skills.map(s => {
        const startDate = new Date();
        const deadlineDate = new Date();
        deadlineDate.setDate(startDate.getDate() + (s.duration_days || 30));
        
        return {
          user_id: userId,
          position_id: positionId,
          title: s.title,
          description: s.description || null,
          link: s.link || null,
          category: s.category,
          priority: s.priority || 'medium',
          status: 'not_started',
          start_date: startDate.toISOString().split('T')[0],
          deadline: deadlineDate.toISOString().split('T')[0],
          progress: 0
        };
      });

      const { error } = await supabase
        .from('career_goals')
        .insert(dbSkills);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error batch adding career goals:', err);
      return false;
    }
  }
};
