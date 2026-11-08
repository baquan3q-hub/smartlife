import { supabase } from './supabase';

// Chia sẻ task bằng link công khai (chỉ xem). Schema: sql/task_share.sql
// Chỉ gồm phần quản lý link của chủ task. Trang người xem `/t/<token>` được server vẽ
// hoàn toàn bằng HTML trong api/_lib/sharePage.js (không cần JS, chạy được trong webview Zalo).

export interface TaskShare {
  id: string;
  token: string;
  todo_id: string;
  show_description: boolean;
  show_subtasks: boolean;
  show_deadline: boolean;
  show_links: boolean;
  show_owner: boolean;
  expires_at: string | null;
  view_count: number;
}

export type TaskShareOptions = Pick<
  TaskShare,
  'show_description' | 'show_subtasks' | 'show_deadline' | 'show_links' | 'show_owner' | 'expires_at'
>;

export const DEFAULT_SHARE_OPTIONS: TaskShareOptions = {
  show_description: true,
  show_subtasks: true,
  show_deadline: true,
  show_links: true,
  show_owner: true,
  expires_at: null,
};

/**
 * Domain công khai dùng cho link chia sẻ. App Capacitor/Tauri chạy ở localhost nên không thể
 * dùng window.location.origin → đặt VITE_PUBLIC_APP_URL (vd https://smartlife.vn) khi build.
 */
export const getPublicBaseUrl = (): string => {
  const configured = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return window.location.origin;
};

export const buildShareUrl = (token: string, baseUrl: string = getPublicBaseUrl()): string =>
  `${baseUrl.replace(/\/+$/, '')}/t/${token}`;

// ── Phía chủ task (cần đăng nhập, RLS) ─────────────────────────────────────────

export async function getTaskShare(todoId: string): Promise<TaskShare | null> {
  const { data, error } = await supabase.from('task_shares').select('*').eq('todo_id', todoId).maybeSingle();
  if (error) throw error;
  return (data as TaskShare | null) ?? null;
}

export async function createTaskShare(
  todoId: string,
  userId: string,
  options: TaskShareOptions = DEFAULT_SHARE_OPTIONS
): Promise<TaskShare> {
  const { data, error } = await supabase
    .from('task_shares')
    .insert({ todo_id: todoId, user_id: userId, ...options })
    .select('*')
    .single();
  if (error) throw error;
  return data as TaskShare;
}

export async function updateTaskShare(shareId: string, options: Partial<TaskShareOptions>): Promise<TaskShare> {
  const { data, error } = await supabase
    .from('task_shares')
    .update({ ...options, updated_at: new Date().toISOString() })
    .eq('id', shareId)
    .select('*')
    .single();
  if (error) throw error;
  return data as TaskShare;
}

export async function stopTaskShare(shareId: string): Promise<void> {
  const { error } = await supabase.from('task_shares').delete().eq('id', shareId);
  if (error) throw error;
}
