import { supabase } from './supabase';
import { SavingsLog } from '../types';

const LOCAL_STORAGE_KEY = 'smartlife_savings_logs';

const getLocalLogs = (): SavingsLog[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading local savings logs:', e);
    return [];
  }
};

const saveLocalLogs = (logs: SavingsLog[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('Error saving local savings logs:', e);
  }
};

export const savingsService = {
  // 1. Fetch savings logs for user (optionally filtered by goalId)
  async fetchSavingsLogs(userId: string, goalId?: string): Promise<SavingsLog[]> {
    try {
      let query = supabase
        .from('savings_logs')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (goalId) {
        query = query.eq('goal_id', goalId);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Supabase fetch savings_logs error, using local fallback:', error.message);
        const local = getLocalLogs().filter(l => l.user_id === userId || !l.user_id);
        return goalId ? local.filter(l => l.goal_id === goalId) : local;
      }

      if (data && data.length >= 0) {
        // Sync local cache
        saveLocalLogs(data);
        return data;
      }
      return getLocalLogs();
    } catch (err) {
      console.error('Error in fetchSavingsLogs:', err);
      const local = getLocalLogs();
      return goalId ? local.filter(l => l.goal_id === goalId) : local;
    }
  },

  // 2. Add a new savings log entry
  async addSavingsLog(
    userId: string,
    log: Omit<SavingsLog, 'id' | 'user_id' | 'created_at'>
  ): Promise<SavingsLog | null> {
    const newLog: SavingsLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      user_id: userId,
      goal_id: log.goal_id,
      amount: log.amount,
      date: log.date || new Date().toISOString().split('T')[0],
      note: log.note || '',
      created_at: new Date().toISOString()
    };

    // Update local storage first (optimistic)
    const local = getLocalLogs();
    saveLocalLogs([newLog, ...local]);

    try {
      const { data, error } = await supabase
        .from('savings_logs')
        .insert([
          {
            user_id: userId,
            goal_id: log.goal_id,
            amount: log.amount,
            date: log.date || new Date().toISOString().split('T')[0],
            note: log.note || ''
          }
        ])
        .select()
        .single();

      if (error) {
        console.warn('Supabase insert savings_logs error, saved locally:', error.message);
        return newLog;
      }

      if (data) {
        // Update local with server response ID
        const updatedLocal = getLocalLogs().map(l => (l.id === newLog.id ? data : l));
        saveLocalLogs(updatedLocal);
        return data;
      }
      return newLog;
    } catch (err) {
      console.error('Error adding savings log:', err);
      return newLog;
    }
  },

  // 3. Update an existing savings log entry
  async updateSavingsLog(id: string, updates: Partial<SavingsLog>): Promise<boolean> {
    // Update local storage
    const local = getLocalLogs();
    const updatedLocal = local.map(l => (l.id === id ? { ...l, ...updates } : l));
    saveLocalLogs(updatedLocal);

    try {
      const { error } = await supabase
        .from('savings_logs')
        .update(updates)
        .eq('id', id);

      if (error) {
        console.warn('Supabase update savings_logs warning:', error.message);
      }
      return true;
    } catch (err) {
      console.error('Error updating savings log:', err);
      return true;
    }
  },

  // 4. Delete a savings log entry
  async deleteSavingsLog(id: string): Promise<boolean> {
    // Update local storage
    const local = getLocalLogs();
    const updatedLocal = local.filter(l => l.id !== id);
    saveLocalLogs(updatedLocal);

    try {
      const { error } = await supabase
        .from('savings_logs')
        .delete()
        .eq('id', id);

      if (error) {
        console.warn('Supabase delete savings_logs warning:', error.message);
      }
      return true;
    } catch (err) {
      console.error('Error deleting savings log:', err);
      return true;
    }
  },

  // Calculate sum of contributions for a goal
  calculateTotalSavings(logs: SavingsLog[], goalId: string): number {
    return logs
      .filter(l => l.goal_id === goalId)
      .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  }
};
