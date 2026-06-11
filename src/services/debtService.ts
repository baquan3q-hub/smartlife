import { supabase } from './supabase';
import { Debt, DebtRepayment } from '../types';

export const debtService = {
  // 1. Lấy danh sách khoản nợ của user
  async fetchDebts(userId: string): Promise<Debt[]> {
    try {
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching debts:', err);
      return [];
    }
  },

  // 2. Tạo khoản nợ mới (Cho vay / Đi vay)
  // Nếu có walletId và liên kết dòng tiền, ta sẽ thực hiện tạo giao dịch bên ngoài hoặc trực tiếp trong service này
  async createDebt(
    userId: string,
    debt: Omit<Debt, 'id' | 'user_id' | 'created_at'>
  ): Promise<Debt | null> {
    try {
      const { data, error } = await supabase
        .from('debts')
        .insert([
          {
            user_id: userId,
            partner_name: debt.partner_name,
            type: debt.type,
            amount: debt.amount,
            remaining_amount: debt.remaining_amount,
            date_lent: debt.date_lent,
            due_date: debt.due_date || null,
            description: debt.description || '',
            status: debt.status,
            wallet_id: debt.wallet_id || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error creating debt:', err);
      return null;
    }
  },

  // 3. Xóa khoản nợ
  async deleteDebt(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('debts').delete().eq('id', id);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error deleting debt:', err);
      return false;
    }
  },

  // 4. Lấy lịch sử trả nợ của một khoản nợ
  async fetchRepayments(debtId: string): Promise<DebtRepayment[]> {
    try {
      const { data, error } = await supabase
        .from('debt_repayments')
        .select('*')
        .eq('debt_id', debtId)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching debt repayments:', err);
      return [];
    }
  },

  // 5. Ghi nhận trả nợ từng phần (hoặc toàn phần)
  async repayDebt(
    userId: string,
    debtId: string,
    amount: number,
    paymentDate: string,
    walletId?: string | null,
    note?: string
  ): Promise<{ repayment: DebtRepayment | null; updatedDebt: Debt | null }> {
    try {
      // 1. Lấy thông tin khoản nợ hiện tại
      const { data: debtData, error: debtErr } = await supabase
        .from('debts')
        .select('*')
        .eq('id', debtId)
        .single();

      if (debtErr || !debtData) throw debtErr || new Error('Không tìm thấy khoản nợ');
      const debt = debtData as Debt;

      if (amount <= 0 || amount > debt.remaining_amount) {
        throw new Error('Số tiền trả nợ không hợp lệ (lớn hơn số tiền còn nợ)');
      }

      const newRemaining = Number(debt.remaining_amount) - amount;
      let newStatus: 'pending' | 'partial' | 'paid' = 'partial';
      if (newRemaining <= 0) {
        newStatus = 'paid';
      }

      // 2. Cập nhật Ví nếu có liên kết dòng tiền
      let transactionId: string | null = null;
      if (walletId) {
        const { data: walletData, error: walletErr } = await supabase
          .from('wallets')
          .select('*')
          .eq('id', walletId)
          .single();

        if (!walletErr && walletData) {
          const isLend = debt.type === 'lend'; // Cho vay -> Khi đòi được nợ: ví nhận tiền (+)
          const balanceChange = isLend ? amount : -amount; // Đi vay -> Khi trả nợ: ví mất tiền (-)
          
          const newWalletBalance = Number(walletData.balance) + balanceChange;
          
          const { error: walletUpdateErr } = await supabase
            .from('wallets')
            .update({ balance: newWalletBalance })
            .eq('id', walletId);
          
          if (walletUpdateErr) console.error('Lỗi cập nhật số dư ví trả nợ:', walletUpdateErr);

          // Tạo một giao dịch thu/chi chính thức
          const txCategory = isLend ? 'Thu hồi nợ 💰' : 'Trả nợ 💸';
          const txType = isLend ? 'income' : 'expense';
          const txDesc = isLend
            ? `Thu hồi nợ từ ${debt.partner_name} (${note || 'Trả nợ'})`
            : `Thanh toán nợ cho ${debt.partner_name} (${note || 'Trả nợ'})`;

          const { data: txData, error: txErr } = await supabase
            .from('transactions')
            .insert([
              {
                user_id: userId,
                amount: amount,
                category: txCategory,
                date: paymentDate,
                type: txType,
                description: txDesc,
                wallet_id: walletId,
                debt_id: debtId,
              },
            ])
            .select()
            .single();
          
          if (!txErr && txData) {
            transactionId = txData.id;
          } else {
            console.error('Lỗi tạo giao dịch trả nợ:', txErr);
          }
        }
      }

      // 3. Thêm bản ghi vào bảng debt_repayments
      const { data: repayData, error: repayErr } = await supabase
        .from('debt_repayments')
        .insert([
          {
            debt_id: debtId,
            amount: amount,
            payment_date: paymentDate,
            wallet_id: walletId || null,
            note: note || '',
            transaction_id: transactionId,
          },
        ])
        .select()
        .single();

      if (repayErr) throw repayErr;

      // 4. Cập nhật trạng thái và số tiền còn lại trong bảng debts
      const { data: updatedDebtData, error: debtUpdateErr } = await supabase
        .from('debts')
        .update({
          remaining_amount: newRemaining,
          status: newStatus,
        })
        .eq('id', debtId)
        .select()
        .single();

      if (debtUpdateErr) throw debtUpdateErr;

      return {
        repayment: repayData,
        updatedDebt: updatedDebtData,
      };
    } catch (err: any) {
      console.error('Error in repayDebt:', err);
      alert(err.message || 'Lỗi ghi nhận thanh toán nợ');
      return { repayment: null, updatedDebt: null };
    }
  },
};
