// File: src/components/StarBrainDashboard.tsx
// StarBrain Phase 2: Star Dashboard + Reward Store

import React, { useState, useEffect, useCallback } from 'react';
import { Reward, RewardCategory, StarTransaction } from '../types';
import {
  fetchStarStats, fetchRecentTransactions, fetchRewards,
  createReward, deleteReward, redeemReward, seedTemplateRewards,
  fetchRedemptionHistory, getLevelFromStars, getNextLevel,
  LEVELS, CATEGORY_INFO,
} from '../services/starBrainService';
import { Star, Gift, Clock, Plus, X, Trash2, ShoppingBag, History, TrendingUp, Sparkles, ChevronRight } from 'lucide-react';

interface Props { userId: string; }

const StarBrainDashboard: React.FC<Props> = ({ userId }) => {
  const [stats, setStats] = useState({ total_earned: 0, current_balance: 0, current_level: 1 });
  const [transactions, setTransactions] = useState<StarTransaction[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'store' | 'history'>('dashboard');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>('ALL');

  // ── Fetch all data ──
  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      setLoading(true);
      const [s, t, r, h] = await Promise.all([
        fetchStarStats(userId),
        fetchRecentTransactions(userId, 30),
        seedTemplateRewards(userId),
        fetchRedemptionHistory(userId, 20),
      ]);
      setStats(s);
      setTransactions(t);
      setRewards(r);
      setRedemptions(h);
      setLoading(false);
    };
    load();
  }, [userId]);

  const level = getLevelFromStars(stats.total_earned);
  const nextLevel = getNextLevel(stats.total_earned);
  const progressToNext = nextLevel
    ? Math.min(100, Math.round(((stats.total_earned - level.minStars) / (nextLevel.minStars - level.minStars)) * 100))
    : 100;

  // ── Handlers ──
  const handleRedeem = async (reward: Reward) => {
    if (stats.current_balance < reward.cost) return;
    setRedeemingId(reward.id);
    const result = await redeemReward(userId, reward.id, reward.cost);
    if (result.success && result.newBalance !== undefined) {
      setStats(prev => ({ ...prev, current_balance: result.newBalance! }));
      setRedeemSuccess(reward.title);
      const h = await fetchRedemptionHistory(userId, 20);
      setRedemptions(h);
      setTimeout(() => setRedeemSuccess(null), 3000);
    }
    setRedeemingId(null);
  };

  const handleCreate = async (data: { title: string; cost: number; category: string; emoji: string; description?: string }) => {
    const newReward = await createReward(userId, data);
    if (newReward) setRewards(prev => [...prev, newReward].sort((a, b) => a.cost - b.cost));
    setShowCreateForm(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Xóa phần thưởng này?')) return;
    await deleteReward(id);
    setRewards(prev => prev.filter(r => r.id !== id));
  };

  const filteredRewards = filterCat === 'ALL' ? rewards : rewards.filter(r => r.category === filterCat);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* ── Balance Card ── */}
      <div className="bg-gradient-to-br from-slate-800 via-indigo-900 to-violet-900 rounded-3xl p-6 text-white shadow-lg shadow-indigo-900/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-amber-400/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="absolute top-4 right-8 w-2 h-2 bg-amber-300/40 rounded-full animate-pulse" />
        <div className="absolute top-12 right-16 w-1.5 h-1.5 bg-violet-300/30 rounded-full" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-indigo-200 text-sm font-medium">Số sao hiện tại</p>
              <div className="text-4xl font-black mt-1 flex items-center gap-2">
                {stats.current_balance.toLocaleString()}
                <span className="text-amber-300 text-3xl">⭐</span>
              </div>
            </div>
            <div className="text-right">
              <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center text-3xl border border-white/10">
                {level.icon}
              </div>
              <div className="text-sm font-bold mt-1.5 text-white/90">{level.name}</div>
              <div className="text-xs text-indigo-300">Level {level.level}</div>
            </div>
          </div>

          {/* Level progress */}
          {nextLevel && (
            <div>
              <div className="flex justify-between text-xs text-indigo-200 mb-1.5">
                <span>{level.icon} Level {level.level}</span>
                <span>{nextLevel.icon} Level {nextLevel.level} ({nextLevel.minStars.toLocaleString()}⭐)</span>
              </div>
              <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-400 to-amber-300 rounded-full transition-all duration-500" style={{ width: `${progressToNext}%` }} />
              </div>
              <p className="text-xs text-indigo-300 mt-1.5">Tổng tích lũy: {stats.total_earned.toLocaleString()} ⭐</p>
            </div>
          )}
          {!nextLevel && (
            <p className="text-sm text-indigo-200 mt-2">🏆 Đã đạt level cao nhất! Tổng: {stats.total_earned.toLocaleString()} ⭐</p>
          )}
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex gap-2 bg-gray-100 p-1.5 rounded-2xl w-fit">
        {([
          { key: 'dashboard', label: '📊 Tổng quan', icon: TrendingUp },
          { key: 'store', label: '🎁 Đổi thưởng', icon: Gift },
          { key: 'history', label: '📜 Lịch sử', icon: History },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setView(t.key)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${view === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD VIEW ── */}
      {view === 'dashboard' && (
        <div className="space-y-4">
          {/* Level roadmap */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Sparkles size={18} className="text-amber-500" /> Cấp độ</h3>
            <div className="space-y-2">
              {LEVELS.map((lv, i) => {
                const isCurrentOrPast = stats.total_earned >= lv.minStars;
                const isCurrent = lv.level === level.level;
                return (
                  <div key={i} className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors ${isCurrent ? 'bg-amber-50 border border-amber-200' : isCurrentOrPast ? 'bg-gray-50' : 'opacity-40'}`}>
                    <span className="text-xl w-8 text-center">{lv.icon}</span>
                    <div className="flex-1">
                      <span className={`text-sm font-bold ${isCurrent ? 'text-amber-700' : 'text-gray-700'}`}>Level {lv.level}: {lv.name}</span>
                    </div>
                    <span className="text-xs text-gray-400 font-medium">{lv.minStars.toLocaleString()}⭐</span>
                    {isCurrent && <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-bold">Hiện tại</span>}
                    {isCurrentOrPast && !isCurrent && <span className="text-emerald-500 text-xs">✓</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent transactions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Clock size={18} className="text-gray-400" /> Giao dịch gần đây</h3>
            {transactions.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">Chưa có giao dịch nào. Hãy check-in habit để nhận sao!</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${tx.type === 'EARN' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                        {tx.type === 'EARN' ? '↑' : '↓'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{tx.description}</p>
                        <p className="text-xs text-gray-400">{new Date(tx.created_at || '').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    <span className={`font-bold text-sm ${tx.amount > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount} ⭐
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STORE VIEW ── */}
      {view === 'store' && (
        <div className="space-y-4">
          {/* Category filter */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilterCat('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${filterCat === 'ALL' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              Tất cả
            </button>
            {Object.entries(CATEGORY_INFO).map(([key, info]) => (
              <button key={key} onClick={() => setFilterCat(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${filterCat === key ? info.color + ' border-current' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                {info.emoji} {info.label}
              </button>
            ))}
          </div>

          {/* Create custom */}
          <button onClick={() => setShowCreateForm(true)}
            className="w-full py-3 border-2 border-dashed border-amber-200 rounded-2xl text-amber-600 font-bold text-sm hover:bg-amber-50 transition-colors flex items-center justify-center gap-2">
            <Plus size={18} /> Tạo phần thưởng mới
          </button>

          {/* Reward cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredRewards.map(r => {
              const catInfo = CATEGORY_INFO[r.category] || CATEGORY_INFO.TIME;
              const canAfford = stats.current_balance >= r.cost;
              return (
                <div key={r.id} className={`bg-white rounded-2xl border shadow-sm p-4 transition-all hover:shadow-md group ${canAfford ? 'border-gray-100' : 'border-gray-50 opacity-60'}`}>
                  <div className="flex items-start gap-3">
                    <div className="text-3xl shrink-0">{r.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 text-sm leading-tight">{r.title}</h4>
                      {r.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{r.description}</p>}
                      <div className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border ${catInfo.color}`}>
                        {catInfo.label}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                    <span className="text-lg font-black text-amber-600">{r.cost} ⭐</span>
                    <div className="flex items-center gap-2">
                      {!r.is_template && (
                        <button onClick={() => handleDelete(r.id)} className="p-1.5 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      )}
                      <button
                        onClick={() => handleRedeem(r)}
                        disabled={!canAfford || redeemingId === r.id}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${canAfford ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm hover:-translate-y-0.5' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                        {redeemingId === r.id ? '...' : canAfford ? 'Đổi thưởng' : `Thiếu ${r.cost - stats.current_balance}⭐`}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredRewards.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">Không có phần thưởng trong danh mục này</div>
          )}
        </div>
      )}

      {/* ── HISTORY VIEW ── */}
      {view === 'history' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><ShoppingBag size={18} className="text-purple-500" /> Lịch sử đổi thưởng</h3>
          {redemptions.length === 0 ? (
            <div className="text-center py-8">
              <Gift size={40} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-400 text-sm">Chưa đổi thưởng nào</p>
              <p className="text-gray-300 text-xs mt-1">Tích sao và đổi phần thưởng bạn xứng đáng!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {redemptions.map((rd: any) => (
                <div key={rd.id} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{rd.rewards?.emoji || '🎁'}</span>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{rd.rewards?.title || 'Phần thưởng'}</p>
                      <p className="text-xs text-gray-400">{new Date(rd.redeemed_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-red-400">-{rd.stars_spent} ⭐</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Create Reward Modal ── */}
      {showCreateForm && (
        <CreateRewardModal onClose={() => setShowCreateForm(false)} onCreate={handleCreate} />
      )}

      {/* ── Redeem Success Toast ── */}
      {redeemSuccess && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] bg-white rounded-2xl shadow-2xl border border-emerald-100 px-6 py-4 flex items-center gap-3"
          style={{ animation: 'starSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-xl">🎉</div>
          <div>
            <p className="font-bold text-gray-900 text-sm">Đổi thưởng thành công!</p>
            <p className="text-xs text-gray-500">{redeemSuccess} — Hãy tận hưởng nhé! 💛</p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes starSlideUp {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
};

// ── Create Reward Modal ──
const CreateRewardModal: React.FC<{
  onClose: () => void;
  onCreate: (data: { title: string; cost: number; category: string; emoji: string; description?: string }) => void;
}> = ({ onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState(100);
  const [category, setCategory] = useState<string>('TIME');
  const [emoji, setEmoji] = useState('🎁');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const EMOJI_OPTIONS = ['🎁', '🎬', '🎮', '☕', '🧋', '🍕', '🍰', '📱', '💆', '🚶', '😴', '🛍️', '🎡', '📺', '🎵', '🎨', '📚', '🏖️', '💅', '🧁'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || cost <= 0) return;
    setSaving(true);
    await onCreate({ title: title.trim(), cost, category, emoji, description: description.trim() || undefined });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[95%] max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 bg-gradient-to-br from-amber-400 to-orange-500 text-white">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl"><X size={18} /></button>
          <h3 className="text-xl font-bold">🎁 Tạo phần thưởng mới</h3>
          <p className="text-white/80 text-sm mt-1">Tự thưởng cho mình khi đạt mục tiêu!</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Emoji picker */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Biểu tượng</label>
            <div className="flex gap-1.5 flex-wrap">
              {EMOJI_OPTIONS.map(e => (
                <button key={e} type="button" onClick={() => setEmoji(e)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${emoji === e ? 'bg-amber-100 ring-2 ring-amber-400 scale-110' : 'bg-gray-50 hover:bg-gray-100'}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Tên phần thưởng *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="VD: Mua 1 ly trà sữa"
              required className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none" />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Ghi chú</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Tùy chọn..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none" />
          </div>

          {/* Cost */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Giá (sao) *</label>
            <input type="number" min={10} max={5000} value={cost} onChange={e => setCost(Number(e.target.value))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none font-bold text-amber-700" />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Danh mục</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                <button key={key} type="button" onClick={() => setCategory(key)}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-colors ${category === key ? info.color + ' border-current' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {info.emoji} {info.label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving || !title.trim() || cost <= 0}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-amber-200 hover:-translate-y-0.5 transition-all disabled:opacity-50">
            {saving ? 'Đang lưu...' : 'Tạo phần thưởng'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default StarBrainDashboard;
