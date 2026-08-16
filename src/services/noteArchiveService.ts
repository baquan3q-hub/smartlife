// File: src/services/noteArchiveService.ts
// Service quản lý Bộ nhớ Lưu trữ Ghi chú (Note Archive Hub)
// Hỗ trợ lưu trữ Supabase + Optimistic LocalStorage Fallback an toàn 100%

import { supabase } from './supabase';
import { NoteArchive, NoteArchiveFilter, NoteLabelType } from '../types';

const LOCAL_STORAGE_KEY_PREFIX = 'smartlife_note_archives_';

export const noteArchiveService = {
  // Helper lấy dữ liệu local storage
  _getLocalNotes(userId: string): NoteArchive[] {
    try {
      const data = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // Helper lưu dữ liệu local storage
  _saveLocalNotes(userId: string, notes: NoteArchive[]): void {
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(notes));
    } catch (e) {
      console.warn('Lỗi lưu local storage notes:', e);
    }
  },

  // 1. Lấy danh sách ghi chú với bộ lọc
  async getArchivedNotes(userId: string, filter?: NoteArchiveFilter): Promise<NoteArchive[]> {
    if (!userId) return [];

    try {
      let query = supabase
        .from('note_archives')
        .select('*')
        .eq('user_id', userId)
        .order('is_pinned', { ascending: false })
        .order('note_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filter?.label && filter.label !== 'All') {
        query = query.contains('labels', [filter.label]);
      }

      if (filter?.startDate) {
        query = query.gte('note_date', filter.startDate);
      }

      if (filter?.endDate) {
        query = query.lte('note_date', filter.endDate);
      }

      if (filter?.isPinnedOnly) {
        query = query.eq('is_pinned', true);
      }

      const { data, error } = await query;

      if (error) {
        // Nếu bảng chưa có hoặc lỗi kết nối, fallback về LocalStorage
        console.warn('Fallback về LocalStorage cho Note Archives:', error.message);
        let localNotes = this._getLocalNotes(userId);

        if (filter?.label && filter.label !== 'All') {
          localNotes = localNotes.filter(n => n.labels?.includes(filter.label as NoteLabelType));
        }
        if (filter?.startDate) {
          localNotes = localNotes.filter(n => n.note_date >= filter.startDate!);
        }
        if (filter?.endDate) {
          localNotes = localNotes.filter(n => n.note_date <= filter.endDate!);
        }
        if (filter?.searchQuery) {
          const q = filter.searchQuery.toLowerCase();
          localNotes = localNotes.filter(n => n.title?.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q));
        }
        if (filter?.isPinnedOnly) {
          localNotes = localNotes.filter(n => n.is_pinned);
        }

        return localNotes;
      }

      // Lọc search client side nếu có searchQuery
      let resultNotes: NoteArchive[] = data || [];
      if (filter?.searchQuery?.trim()) {
        const q = filter.searchQuery.toLowerCase().trim();
        resultNotes = resultNotes.filter(n =>
          n.title?.toLowerCase().includes(q) ||
          n.content?.toLowerCase().includes(q) ||
          n.labels?.some(l => l.toLowerCase().includes(q))
        );
      }

      // Cập nhật lại cache local storage
      this._saveLocalNotes(userId, data || []);
      return resultNotes;
    } catch (err: any) {
      console.error('Lỗi khi fetch note archives:', err);
      return this._getLocalNotes(userId);
    }
  },

  // 2. Lấy tổng số lượng ghi chú đã lưu
  async getNotesCount(userId: string): Promise<number> {
    if (!userId) return 0;
    try {
      const { count, error } = await supabase
        .from('note_archives')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) {
        return this._getLocalNotes(userId).length;
      }
      return count || 0;
    } catch {
      return this._getLocalNotes(userId).length;
    }
  },

  // 3. Tạo mới một thẻ ghi chú vào bộ nhớ
  async createArchivedNote(
    userId: string,
    noteData: {
      title?: string;
      content: string;
      labels: NoteLabelType[];
      note_date?: string;
      is_pinned?: boolean;
    }
  ): Promise<NoteArchive | null> {
    if (!userId || !noteData.content.trim()) return null;

    const todayStr = new Date().toISOString().split('T')[0];
    const finalDate = noteData.note_date || todayStr;
    const finalLabels: NoteLabelType[] = noteData.labels.length > 0 ? noteData.labels : (['Work'] as NoteLabelType[]);
    
    // Tự sinh title từ dòng đầu tiên nếu không nhập
    let finalTitle = noteData.title?.trim();
    if (!finalTitle) {
      const firstLine = noteData.content.trim().split('\n')[0].replace(/^[#*-\s]+/, '').trim();
      finalTitle = firstLine.slice(0, 40) || 'Ghi chú mới';
    }

    const payload = {
      user_id: userId,
      title: finalTitle,
      content: noteData.content.trim(),
      labels: finalLabels,
      note_date: finalDate,
      is_pinned: noteData.is_pinned || false,
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('note_archives')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.warn('Lỗi Supabase khi tạo note archive, lưu vào LocalStorage:', error.message);
        const fallbackNote: NoteArchive = {
          id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          ...payload,
          created_at: new Date().toISOString(),
        };
        const currentLocal = this._getLocalNotes(userId);
        this._saveLocalNotes(userId, [fallbackNote, ...currentLocal]);
        return fallbackNote;
      }

      // Sync local cache
      const currentLocal = this._getLocalNotes(userId);
      this._saveLocalNotes(userId, [data, ...currentLocal.filter(n => n.id !== data.id)]);
      return data;
    } catch (err: any) {
      console.error('Lỗi khi insert note archive:', err);
      const fallbackNote: NoteArchive = {
        id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        ...payload,
        created_at: new Date().toISOString(),
      };
      const currentLocal = this._getLocalNotes(userId);
      this._saveLocalNotes(userId, [fallbackNote, ...currentLocal]);
      return fallbackNote;
    }
  },

  // 4. Cập nhật thẻ ghi chú
  async updateArchivedNote(
    userId: string,
    id: string,
    updates: Partial<NoteArchive>
  ): Promise<NoteArchive | null> {
    if (!id) return null;

    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('note_archives')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.warn('Lỗi Supabase khi update note archive, update local:', error.message);
        const currentLocal = this._getLocalNotes(userId);
        const updatedLocal = currentLocal.map(n => n.id === id ? { ...n, ...payload } : n);
        this._saveLocalNotes(userId, updatedLocal);
        return updatedLocal.find(n => n.id === id) || null;
      }

      // Sync local cache
      const currentLocal = this._getLocalNotes(userId);
      const updatedLocal = currentLocal.map(n => n.id === id ? data : n);
      this._saveLocalNotes(userId, updatedLocal);
      return data;
    } catch (err) {
      console.error('Lỗi update note archive:', err);
      return null;
    }
  },

  // 5. Xóa thẻ ghi chú
  async deleteArchivedNote(userId: string, id: string): Promise<boolean> {
    if (!id) return false;

    try {
      const { error } = await supabase
        .from('note_archives')
        .delete()
        .eq('id', id);

      if (error) {
        console.warn('Lỗi Supabase khi delete note archive, delete local:', error.message);
      }

      // Cập nhật local storage
      const currentLocal = this._getLocalNotes(userId);
      this._saveLocalNotes(userId, currentLocal.filter(n => n.id !== id));
      return true;
    } catch (err) {
      console.error('Lỗi delete note archive:', err);
      const currentLocal = this._getLocalNotes(userId);
      this._saveLocalNotes(userId, currentLocal.filter(n => n.id !== id));
      return true;
    }
  },

  // 6. Ghim / Bỏ ghim ghi chú
  async togglePinNote(userId: string, id: string, isPinned: boolean): Promise<boolean> {
    const updated = await this.updateArchivedNote(userId, id, { is_pinned: isPinned });
    return updated !== null;
  }
};
