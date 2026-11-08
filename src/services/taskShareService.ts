import { supabase } from './supabase';
import { parseTaskLinks, TaskLink } from '../types';

// Chia sẻ task bằng link công khai (chỉ xem). Schema: sql/task_share.sql

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

export interface SharedTask {
  title: string;
  status: string;
  priority?: string;
  completed_at?: string;
  description?: string;
  subtasks?: { id: string; title: string; is_completed: boolean }[];
  deadline?: string;
  attach_link?: string;
  owner_name?: string;
  updated_at?: string;
  expires_at?: string;
}

export type SharedTaskResult =
  | { ok: true; task: SharedTask }
  | { ok: false; reason: 'not_found' | 'expired' | 'error' };

const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export const isValidShareToken = (token: string): boolean => TOKEN_PATTERN.test(token);

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

/** Lấy token từ hash `#/t/<token>`; trả null nếu không phải route chia sẻ. */
export const parseShareHash = (hash: string): string | null => {
  const m = /^#\/t\/([^/?#]+)/.exec(hash);
  return m ? m[1] : null;
};

/** Chỉ cho phép link http(s) — chặn javascript:, data:... từ dữ liệu người dùng nhập. */
export const toSafeHttpUrl = (raw: string): string | null => {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
};

export const getSafeSharedLinks = (attachLink?: string | null): (TaskLink & { href: string })[] =>
  parseTaskLinks(attachLink).flatMap((l) => {
    const href = toSafeHttpUrl(l.url);
    return href ? [{ ...l, href }] : [];
  });

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

// ── Phía người xem (không cần đăng nhập) ───────────────────────────────────────

export async function fetchSharedTask(token: string): Promise<SharedTaskResult> {
  if (!isValidShareToken(token)) return { ok: false, reason: 'not_found' };
  try {
    const { data, error } = await supabase.rpc('get_shared_task', { p_token: token });
    if (error || !data) return { ok: false, reason: 'error' };
    return data as SharedTaskResult;
  } catch {
    return { ok: false, reason: 'error' };
  }
}
