import { supabase } from './supabase';
import { JournalEntry, JournalStats, MoodLevel } from '../types';

// 1. Danh sách câu hỏi gợi ý (Writing Prompts)
export const WRITING_PROMPTS = {
  study: [
    'Hôm nay bạn đã học được kiến thức gì mới mẻ hoặc thú vị?',
    'Môn học nào đang chiếm nhiều thời gian của bạn nhất? Bạn có gặp khó khăn gì không?',
    'Bạn đã cải thiện hoặc thay đổi phương pháp học tập nào ngày hôm nay?',
    'Điều gì giúp bạn giữ tập trung tốt nhất trong buổi học ngày hôm nay?'
  ],
  reflection: [
    'Điều gì khiến bạn mỉm cười hoặc cảm thấy hạnh phúc nhất trong ngày hôm nay?',
    'Nếu được thay đổi một điều đã xảy ra hôm nay, bạn sẽ thay đổi điều gì?',
    'Mức năng lượng tinh thần và thể chất của bạn lúc này ra sao? Tại sao?',
    'Suy nghĩ nào đang lặp đi lặp lại nhiều nhất trong tâm trí bạn lúc này?'
  ],
  goals: [
    'Hôm nay bạn đã tiến gần hơn mục tiêu lớn nào của mình dù chỉ một bước nhỏ?',
    'Nhiệm vụ quan trọng nhất bạn đã hoàn thành xuất sắc ngày hôm nay là gì?',
    'Ngày mai bạn mong muốn tập trung làm tốt điều gì nhất?',
    'Bạn tự hào về hành động hoặc quyết định nào của mình hôm nay?'
  ],
  gratitude: [
    'Người nào đã giúp đỡ hoặc làm bạn vui ngày hôm nay? Bạn có muốn cảm ơn họ không?',
    'Kể ra một việc đơn giản (bữa ăn ngon, thời tiết đẹp) đã làm ngày hôm nay dễ chịu hơn.',
    'Điều may mắn nhất bạn nhận được hôm nay là gì?',
    'Một điều bạn trân trọng về cơ thể hoặc sức khỏe của mình ngày hôm nay.'
  ]
};

// Hàm lấy câu hỏi ngẫu nhiên từ tất cả các danh mục
export const getRandomWritingPrompt = (): string => {
  const allPrompts = Object.values(WRITING_PROMPTS).flat();
  const randomIndex = Math.floor(Math.random() * allPrompts.length);
  return allPrompts[randomIndex];
};

// Helper chuyển múi giờ địa phương sang định dạng ngày YYYY-MM-DD
export const getLocalDateString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 2. Các hàm tương tác Database qua Supabase
export const journalService = {
  // Lấy danh sách nhật ký kèm tags của user
  async fetchEntries(userId: string, limit = 50): Promise<JournalEntry[]> {
    try {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', userId)
        .order('entry_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      if (!data) return [];

      // Lấy thêm tags cho các entry
      const entryIds = data.map(e => e.id);
      let tagsMap: Record<string, string[]> = {};
      
      if (entryIds.length > 0) {
        const { data: tagsData, error: tagsError } = await supabase
          .from('journal_tags')
          .select('entry_id, tag')
          .in('entry_id', entryIds);

        if (!tagsError && tagsData) {
          tagsData.forEach(t => {
            if (!tagsMap[t.entry_id]) tagsMap[t.entry_id] = [];
            tagsMap[t.entry_id].push(t.tag);
          });
        }
      }

      return data.map(entry => ({
        ...entry,
        gratitude: Array.isArray(entry.gratitude) ? entry.gratitude : [],
        tags: tagsMap[entry.id] || []
      }));
    } catch (err) {
      console.error('Error fetching journal entries:', err);
      return [];
    }
  },

  // Lấy nhật ký của một ngày cụ thể
  async fetchEntryByDate(userId: string, dateStr: string): Promise<JournalEntry | null> {
    try {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('entry_date', dateStr)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      // Lấy tags của entry này
      const { data: tagsData, error: tagsError } = await supabase
        .from('journal_tags')
        .select('tag')
        .eq('entry_id', data.id);

      const tags = (!tagsError && tagsData) ? tagsData.map(t => t.tag) : [];

      return {
        ...data,
        gratitude: Array.isArray(data.gratitude) ? data.gratitude : [],
        tags
      };
    } catch (err) {
      console.error(`Error fetching journal entry for date ${dateStr}:`, err);
      return null;
    }
  },

  // Lưu hoặc cập nhật nhật ký
  async saveEntry(
    userId: string,
    entry: Omit<JournalEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<JournalEntry | null> {
    try {
      // 1. Tính toán số lượng từ (word_count) - loại bỏ các thẻ HTML để đếm chính xác
      const plainText = entry.content.replace(/<[^>]*>/g, ' ').trim();
      const words = plainText ? plainText.split(/\s+/) : [];
      const wordCount = words.length;

      // 2. Upsert entry chính
      const { data: savedData, error: saveError } = await supabase
        .from('journal_entries')
        .upsert(
          {
            user_id: userId,
            entry_date: entry.entry_date,
            content: entry.content,
            mood: entry.mood,
            gratitude: entry.gratitude,
            word_count: wordCount,
            is_favorite: entry.is_favorite,
            writing_prompt: entry.writing_prompt,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id,entry_date' }
        )
        .select()
        .single();

      if (saveError) throw saveError;
      if (!savedData) return null;

      // 3. Xử lý lưu Tags
      // Xóa các tag cũ của entry này trước
      await supabase
        .from('journal_tags')
        .delete()
        .eq('entry_id', savedData.id);

      // Thêm các tag mới (nếu có)
      if (entry.tags && entry.tags.length > 0) {
        const newTags = entry.tags.map(t => ({
          user_id: userId,
          entry_id: savedData.id,
          tag: t.trim().toLowerCase().replace('#', '') // chuẩn hóa loại bỏ dấu # và viết thường
        }));

        const { error: tagsError } = await supabase
          .from('journal_tags')
          .insert(newTags);
        
        if (tagsError) console.error('Error inserting tags:', tagsError);
      }

      return {
        ...savedData,
        gratitude: Array.isArray(savedData.gratitude) ? savedData.gratitude : [],
        tags: entry.tags || []
      };
    } catch (err) {
      console.error('Error saving journal entry:', err);
      return null;
    }
  },

  // Xóa bài viết nhật ký
  async deleteEntry(entryId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error(`Error deleting journal entry with id ${entryId}:`, err);
      return false;
    }
  },

  // Tính toán số liệu thống kê (Streak, Mood, Tags)
  async fetchStats(userId: string): Promise<JournalStats> {
    const defaultStats: JournalStats = {
      totalEntries: 0,
      currentStreak: 0,
      longestStreak: 0,
      averageMood: 3,
      totalWords: 0,
      moodDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      topTags: []
    };

    try {
      // 1. Fetch all entry dates, moods, word counts, and IDs to calculate stats
      const { data: entries, error: entriesError } = await supabase
        .from('journal_entries')
        .select('id, entry_date, mood, word_count')
        .eq('user_id', userId)
        .order('entry_date', { ascending: false });

      if (entriesError) throw entriesError;
      if (!entries || entries.length === 0) return defaultStats;

      // 2. Fetch all tags for this user
      const { data: tags, error: tagsError } = await supabase
        .from('journal_tags')
        .select('tag')
        .eq('user_id', userId);

      // Tính tổng bài viết, tổng từ, phân bố mood
      const totalEntries = entries.length;
      let totalWords = 0;
      let moodSum = 0;
      let moodCount = 0;
      const moodDistribution: Record<MoodLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      entries.forEach(e => {
        totalWords += e.word_count || 0;
        if (e.mood && e.mood >= 1 && e.mood <= 5) {
          const m = e.mood as MoodLevel;
          moodDistribution[m] = (moodDistribution[m] || 0) + 1;
          moodSum += m;
          moodCount++;
        }
      });

      const averageMood = moodCount > 0 ? parseFloat((moodSum / moodCount).toFixed(1)) : 3;

      // 3. Thuật toán tính Streak ngày viết liên tiếp
      // Lọc các ngày duy nhất (nếu có trùng lặp) và sắp xếp giảm dần
      const dates = entries.map(e => e.entry_date).sort((a, b) => b.localeCompare(a));
      
      let currentStreak = 0;
      let longestStreak = 0;
      
      if (dates.length > 0) {
        const todayStr = getLocalDateString(new Date());
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = getLocalDateString(yesterday);

        // Kiểm tra xem có viết hôm nay hoặc hôm qua không để tính current streak
        const hasWrittenTodayOrYesterday = dates.includes(todayStr) || dates.includes(yesterdayStr);

        if (hasWrittenTodayOrYesterday) {
          currentStreak = 1;
          let currentDate = new Date(dates[0]); // Bắt đầu từ ngày viết gần nhất
          
          for (let i = 1; i < dates.length; i++) {
            const nextDate = new Date(dates[i]);
            // Tính số ngày chênh lệch giữa 2 bài viết liên tiếp
            const diffTime = currentDate.getTime() - nextDate.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
              currentStreak++;
              currentDate = nextDate;
            } else if (diffDays > 1) {
              // Gặp khoảng trống ngày viết -> dừng tính current streak
              break;
            }
          }
        }

        // Tính longest streak
        let tempStreak = 1;
        let prevDate = new Date(dates[0]);

        for (let i = 1; i < dates.length; i++) {
          const currentDate = new Date(dates[i]);
          const diffTime = prevDate.getTime() - currentDate.getTime();
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
            tempStreak++;
          } else if (diffDays > 1) {
            if (tempStreak > longestStreak) {
              longestStreak = tempStreak;
            }
            tempStreak = 1;
          }
          prevDate = currentDate;
        }
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
      }

      // 4. Tính toán Top Tags
      const tagCounts: Record<string, number> = {};
      if (!tagsError && tags) {
        tags.forEach(t => {
          tagCounts[t.tag] = (tagCounts[t.tag] || 0) + 1;
        });
      }

      const topTags = Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalEntries,
        currentStreak,
        longestStreak: Math.max(longestStreak, currentStreak),
        averageMood,
        totalWords,
        moodDistribution,
        topTags
      };
    } catch (err) {
      console.error('Error calculating journal stats:', err);
      return defaultStats;
    }
  }
};
