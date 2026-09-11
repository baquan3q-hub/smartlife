import { supabase } from './supabase';
import { RecurringTransaction, TransactionType } from '../types';

const LOCAL_STORAGE_KEY = 'smartlife_recurring_transactions';

const getLocalRecurring = (): RecurringTransaction[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading local recurring transactions:', e);
    return [];
  }
};

const saveLocalRecurring = (items: RecurringTransaction[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Error saving local recurring transactions:', e);
  }
};

export const recurringTransactionService = {
  // 1. Fetch recurring transactions for user
  async fetchRecurringTransactions(userId: string): Promise<RecurringTransaction[]> {
    try {
      const { data, error } = await supabase
        .from('recurring_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase fetch recurring_transactions error, using local fallback:', error.message);
        const local = getLocalRecurring().filter(item => item.user_id === userId || !item.user_id);
        return local;
      }

      if (data && Array.isArray(data)) {
        const formatted: RecurringTransaction[] = data.map(item => ({
          id: item.id,
          user_id: item.user_id,
          title: item.title,
          amount: Number(item.amount),
          type: item.type as TransactionType,
          category: item.category,
          wallet_id: item.wallet_id || null,
          day_of_month: Number(item.day_of_month) || 1,
          status: (item.status === 'paused' ? 'paused' : 'active') as 'active' | 'paused',
          description: item.description || '',
          auto_apply: item.auto_apply !== false,
          last_applied_month: item.last_applied_month || null,
          created_at: item.created_at
        }));
        saveLocalRecurring(formatted);
        return formatted;
      }

      return getLocalRecurring();
    } catch (err) {
      console.error('Error in fetchRecurringTransactions:', err);
      return getLocalRecurring();
    }
  },

  // 2. Add recurring transaction
  async addRecurringTransaction(
    userId: string,
    item: Omit<RecurringTransaction, 'id' | 'created_at'>
  ): Promise<RecurringTransaction | null> {
    const tempId = 'rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const newItem: RecurringTransaction = {
      ...item,
      id: tempId,
      user_id: userId,
      created_at: new Date().toISOString()
    };

    // Optimistic local update
    const currentLocal = getLocalRecurring();
    saveLocalRecurring([newItem, ...currentLocal]);

    try {
      const { data, error } = await supabase
        .from('recurring_transactions')
        .insert([{
          user_id: userId,
          title: item.title,
          amount: item.amount,
          type: item.type,
          category: item.category,
          wallet_id: item.wallet_id || null,
          day_of_month: item.day_of_month || 1,
          status: item.status || 'active',
          description: item.description || '',
          auto_apply: item.auto_apply !== false,
          last_applied_month: item.last_applied_month || null
        }])
        .select()
        .single();

      if (error) {
        console.warn('Supabase insert recurring_transactions error, kept in local:', error.message);
        return newItem;
      }

      if (data) {
        const savedItem: RecurringTransaction = {
          id: data.id,
          user_id: data.user_id,
          title: data.title,
          amount: Number(data.amount),
          type: data.type as TransactionType,
          category: data.category,
          wallet_id: data.wallet_id || null,
          day_of_month: Number(data.day_of_month) || 1,
          status: data.status as 'active' | 'paused',
          description: data.description || '',
          auto_apply: data.auto_apply !== false,
          last_applied_month: data.last_applied_month || null,
          created_at: data.created_at
        };

        const updatedLocal = getLocalRecurring().map(i => i.id === tempId ? savedItem : i);
        saveLocalRecurring(updatedLocal);
        return savedItem;
      }

      return newItem;
    } catch (err) {
      console.error('Error in addRecurringTransaction:', err);
      return newItem;
    }
  },

  // 3. Update recurring transaction
  async updateRecurringTransaction(item: RecurringTransaction): Promise<boolean> {
    // Update local cache
    const currentLocal = getLocalRecurring();
    saveLocalRecurring(currentLocal.map(i => i.id === item.id ? item : i));

    try {
      const { error } = await supabase
        .from('recurring_transactions')
        .update({
          title: item.title,
          amount: item.amount,
          type: item.type,
          category: item.category,
          wallet_id: item.wallet_id || null,
          day_of_month: item.day_of_month || 1,
          status: item.status,
          description: item.description || '',
          auto_apply: item.auto_apply !== false,
          last_applied_month: item.last_applied_month || null
        })
        .eq('id', item.id);

      if (error) {
        console.warn('Supabase update recurring_transactions error, kept in local:', error.message);
        return true;
      }
      return true;
    } catch (err) {
      console.error('Error in updateRecurringTransaction:', err);
      return true;
    }
  },

  // 4. Delete recurring transaction
  async deleteRecurringTransaction(id: string): Promise<boolean> {
    const currentLocal = getLocalRecurring();
    saveLocalRecurring(currentLocal.filter(i => i.id !== id));

    try {
      const { error } = await supabase
        .from('recurring_transactions')
        .delete()
        .eq('id', id);

      if (error) {
        console.warn('Supabase delete recurring_transactions error, kept in local:', error.message);
        return true;
      }
      return true;
    } catch (err) {
      console.error('Error in deleteRecurringTransaction:', err);
      return true;
    }
  },

  // 5. Toggle pause / active status
  async toggleStatus(id: string, newStatus: 'active' | 'paused'): Promise<boolean> {
    const currentLocal = getLocalRecurring();
    const target = currentLocal.find(i => i.id === id);
    if (target) {
      target.status = newStatus;
      saveLocalRecurring(currentLocal);
    }

    try {
      const { error } = await supabase
        .from('recurring_transactions')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) {
        console.warn('Supabase toggleStatus error, local updated:', error.message);
      }
      return true;
    } catch (err) {
      console.error('Error in toggleStatus:', err);
      return true;
    }
  },

  // 6. Mark items as applied for a given month ('YYYY-MM')
  async markAsApplied(ids: string[], monthYear: string): Promise<boolean> {
    const currentLocal = getLocalRecurring();
    const updated = currentLocal.map(item => {
      if (ids.includes(item.id)) {
        return { ...item, last_applied_month: monthYear };
      }
      return item;
    });
    saveLocalRecurring(updated);

    try {
      const { error } = await supabase
        .from('recurring_transactions')
        .update({ last_applied_month: monthYear })
        .in('id', ids);

      if (error) {
        console.warn('Supabase markAsApplied error, local updated:', error.message);
      }
      return true;
    } catch (err) {
      console.error('Error in markAsApplied:', err);
      return true;
    }
  }
};
