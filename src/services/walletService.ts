import { supabase } from './supabase';
import { Wallet } from '../types';

export const walletService = {
  // 1. Lấy danh sách ví của người dùng
  async fetchWallets(userId: string): Promise<Wallet[]> {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching wallets:', err);
      return [];
    }
  },

  // 2. Tạo ví mới
  async createWallet(
    userId: string,
    wallet: Omit<Wallet, 'id' | 'user_id' | 'created_at'>
  ): Promise<Wallet | null> {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .insert([
          {
            user_id: userId,
            name: wallet.name,
            type: wallet.type,
            balance: wallet.balance,
            initial_balance: wallet.initial_balance,
            color: wallet.color,
            icon: wallet.icon,
            include_in_total: wallet.include_in_total,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error creating wallet:', err);
      return null;
    }
  },

  // 3. Cập nhật ví
  async updateWallet(wallet: Wallet): Promise<Wallet | null> {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .update({
          name: wallet.name,
          type: wallet.type,
          balance: wallet.balance,
          color: wallet.color,
          icon: wallet.icon,
          include_in_total: wallet.include_in_total,
        })
        .eq('id', wallet.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error updating wallet:', err);
      return null;
    }
  },

  // 4. Xóa ví
  async deleteWallet(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('wallets').delete().eq('id', id);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error deleting wallet:', err);
      return false;
    }
  },

  // 5. Chuyển tiền giữa các ví (Transfer)
  async transferMoney(
    userId: string,
    fromWalletId: string,
    toWalletId: string,
    amount: number,
    note?: string
  ): Promise<boolean> {
    try {
      // 1. Lấy thông tin hai ví
      const [fromRes, toRes] = await Promise.all([
        supabase.from('wallets').select('*').eq('id', fromWalletId).single(),
        supabase.from('wallets').select('*').eq('id', toWalletId).single(),
      ]);

      if (fromRes.error || !fromRes.data) throw fromRes.error || new Error('Source wallet not found');
      if (toRes.error || !toRes.data) throw toRes.error || new Error('Destination wallet not found');

      const sourceWallet = fromRes.data as Wallet;
      const destWallet = toRes.data as Wallet;

      if (sourceWallet.balance < amount) {
        throw new Error('Số dư ví gửi không đủ để thực hiện chuyển khoản');
      }

      const newSourceBalance = Number(sourceWallet.balance) - amount;
      const newDestBalance = Number(destWallet.balance) + amount;

      // 2. Cập nhật số dư hai ví và tạo giao dịch log
      const { error: updateSourceErr } = await supabase
        .from('wallets')
        .update({ balance: newSourceBalance })
        .eq('id', fromWalletId);
      if (updateSourceErr) throw updateSourceErr;

      const { error: updateDestErr } = await supabase
        .from('wallets')
        .update({ balance: newDestBalance })
        .eq('id', toWalletId);
      if (updateDestErr) throw updateDestErr;

      // 3. Tạo 2 giao dịch trong bảng transactions để khớp dòng tiền
      const dateStr = new Date().toISOString().split('T')[0];
      const transferDesc = note ? `Chuyển khoản: ${note}` : `Chuyển tiền từ ${sourceWallet.name} sang ${destWallet.name}`;

      const { error: txErr } = await supabase.from('transactions').insert([
        {
          user_id: userId,
          amount: amount,
          category: 'Chuyển khoản 🔄',
          date: dateStr,
          type: 'expense',
          description: `${transferDesc} (Ví gửi: ${sourceWallet.name})`,
          wallet_id: fromWalletId,
        },
        {
          user_id: userId,
          amount: amount,
          category: 'Chuyển khoản 🔄',
          date: dateStr,
          type: 'income',
          description: `${transferDesc} (Ví nhận: ${destWallet.name})`,
          wallet_id: toWalletId,
        },
      ]);

      if (txErr) throw txErr;

      return true;
    } catch (err: any) {
      console.error('Error transferring money:', err);
      alert(err.message || 'Lỗi chuyển khoản giữa các ví');
      return false;
    }
  },
};
