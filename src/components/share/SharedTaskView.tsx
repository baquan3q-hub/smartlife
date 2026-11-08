import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock, ExternalLink, Flag, Link2, Sparkles, UserRound } from 'lucide-react';
import { fetchSharedTask, getSafeSharedLinks, parseShareHash, SharedTask, SharedTaskResult } from '../../services/taskShareService';

// Trang xem task được chia sẻ — công khai, chỉ đọc, dành cho người chưa có tài khoản.
// Được render riêng từ index.tsx (không tải App/AuthProvider) để mở nhanh.

export const isSharedTaskRoute = (): boolean => parseShareHash(window.location.hash) !== null;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  backlog: { label: 'Backlog', cls: 'bg-slate-100 text-slate-600' },
  todo: { label: 'Cần làm', cls: 'bg-blue-100 text-blue-700' },
  doing: { label: 'Đang làm', cls: 'bg-orange-100 text-orange-700' },
  done: { label: 'Hoàn thành', cls: 'bg-emerald-100 text-emerald-700' },
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Khẩn cấp', high: 'Khẩn cấp',
  focus: 'Tập trung', medium: 'Tập trung',
  chill: 'Thư thả', low: 'Thư thả',
  temp: 'Tạm thời',
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

const MESSAGES: Record<'not_found' | 'expired' | 'error', { title: string; body: string }> = {
  not_found: { title: 'Không tìm thấy task', body: 'Link này không tồn tại hoặc chủ task đã tắt chia sẻ.' },
  expired: { title: 'Link đã hết hạn', body: 'Chủ task đã đặt thời hạn cho link này và nó đã hết hiệu lực.' },
  error: { title: 'Không tải được task', body: 'Có lỗi kết nối. Vui lòng thử lại sau ít phút.' },
};

const goHome = () => {
  window.location.href = `${window.location.origin}/`;
};

const SharedTaskView: React.FC = () => {
  const [result, setResult] = useState<SharedTaskResult | null>(null);

  useEffect(() => {
    // Trang riêng tư theo link: không cho công cụ tìm kiếm lập chỉ mục
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
    return () => { robots.remove(); };
  }, []);

  useEffect(() => {
    const token = parseShareHash(window.location.hash) || '';
    let alive = true;
    fetchSharedTask(token).then((r) => {
      if (!alive) return;
      setResult(r);
      document.title = r.ok ? `${r.task.title} · SmartLife` : 'SmartLife';
    });
    return () => { alive = false; };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center px-4 py-8 sm:py-12">
      <a href="/" className="flex items-center gap-2 mb-6 select-none" aria-label="SmartLife">
        <img src="/favicon.ico" alt="" className="w-7 h-7 rounded-md" />
        <span className="text-base font-black text-slate-800 tracking-tight">SmartLife</span>
      </a>

      <main className="w-full max-w-xl">
        {!result && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-center text-sm text-slate-400">
            Đang tải...
          </div>
        )}

        {result && result.ok === false && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-center">
            <h1 className="text-lg font-black text-slate-800 mb-2">{MESSAGES[result.reason].title}</h1>
            <p className="text-sm text-slate-500">{MESSAGES[result.reason].body}</p>
          </div>
        )}

        {result && result.ok === true && <TaskCard task={result.task} />}

        <section className="mt-6 rounded-3xl bg-slate-900 text-white p-6 text-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-300 mb-2">
            <Sparkles size={13} /> Quản lý công việc cùng SmartLife
          </div>
          <p className="text-sm text-slate-300 mb-4">
            Task, lịch học, tài chính và mục tiêu của bạn — gọn trong một ứng dụng, có thể chia sẻ như thế này.
          </p>
          <button
            type="button"
            onClick={goHome}
            className="px-5 py-2.5 rounded-2xl bg-white text-slate-900 text-xs font-bold hover:bg-slate-100 active:scale-95 transition"
          >
            Dùng thử SmartLife miễn phí
          </button>
        </section>
      </main>
    </div>
  );
};

const TaskCard: React.FC<{ task: SharedTask }> = ({ task }) => {
  const status = STATUS_META[task.status] || STATUS_META.todo;
  const subtasks = task.subtasks || [];
  const doneCount = subtasks.filter((s) => s.is_completed).length;
  const links = getSafeSharedLinks(task.attach_link);
  const priority = task.priority ? PRIORITY_LABEL[task.priority] : undefined;
  const overdue = !!task.deadline && task.status !== 'done' && new Date(task.deadline).getTime() < Date.now();

  return (
    <article className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold ${status.cls}`}>{status.label}</span>
        {priority && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
            <Flag size={11} /> {priority}
          </span>
        )}
      </div>

      <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug break-words">{task.title}</h1>

      {task.owner_name && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500">
          <UserRound size={13} /> Chia sẻ bởi <b className="text-slate-700">{task.owner_name}</b>
        </p>
      )}

      {task.deadline && (
        <p className={`mt-4 inline-flex items-center gap-1.5 text-sm font-semibold ${overdue ? 'text-rose-600' : 'text-slate-600'}`}>
          <Clock size={15} /> Hạn: {formatDateTime(task.deadline)}{overdue && ' · Quá hạn'}
        </p>
      )}

      {task.description && (
        // Hiển thị dạng text thuần (whitespace-pre-wrap), không render HTML từ dữ liệu người dùng
        <p className="mt-5 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">{task.description}</p>
      )}

      {subtasks.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-wide mb-2">
            Việc nhỏ ({doneCount}/{subtasks.length})
          </h2>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-3">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(doneCount / subtasks.length) * 100}%` }} />
          </div>
          <ul className="space-y-1.5">
            {subtasks.map((s) => (
              <li key={s.id} className="flex items-start gap-2 text-sm">
                {s.is_completed
                  ? <CheckCircle2 size={17} className="text-emerald-500 shrink-0 mt-0.5" />
                  : <Circle size={17} className="text-slate-300 shrink-0 mt-0.5" />}
                <span className={`break-words ${s.is_completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{s.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {links.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-wide mb-2">Liên kết</h2>
          <ul className="space-y-2">
            {links.map((l) => (
              <li key={l.id}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="flex items-center gap-2.5 p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 transition"
                >
                  <Link2 size={15} className="text-blue-500 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-800 truncate">{l.name || l.href}</span>
                    <span className="block text-[11px] text-slate-400 truncate">{l.href}</span>
                  </span>
                  <ExternalLink size={14} className="text-slate-400 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
        Link chia sẻ trực tiếp — nội dung luôn cập nhật theo task gốc.
      </p>
    </article>
  );
};

export default SharedTaskView;
