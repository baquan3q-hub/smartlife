import { Todo } from '../types';

export type DoneAutoCleanSchedule = 'never' | '30_days' | '60_days' | '90_days';

export interface DoneCleanupSetting {
  schedule: DoneAutoCleanSchedule;
  notifyOnClean: boolean;
  lastCleanedAt?: string;
}

export const CLEANUP_SCHEDULE_OPTIONS: {
  value: DoneAutoCleanSchedule;
  label: string;
  description: string;
  durationMs: number;
}[] = [
  {
    value: 'never',
    label: 'Tắt (Thủ công)',
    description: 'Chỉ xóa khi bạn chủ động thao tác xóa.',
    durationMs: Infinity,
  },
  {
    value: '30_days',
    label: 'Sau 30 ngày',
    description: 'Tự động dọn dẹp các việc đã xong quá 30 ngày trước.',
    durationMs: 30 * 24 * 60 * 60 * 1000,
  },
  {
    value: '60_days',
    label: 'Sau 60 ngày',
    description: 'Tự động dọn dẹp các việc đã xong quá 60 ngày trước.',
    durationMs: 60 * 24 * 60 * 60 * 1000,
  },
  {
    value: '90_days',
    label: 'Sau 90 ngày',
    description: 'Tự động dọn dẹp các việc đã xong quá 90 ngày trước.',
    durationMs: 90 * 24 * 60 * 60 * 1000,
  },
];

const STORAGE_KEY_PREFIX = 'smartlife_done_cleanup_';

export const getDoneCleanupSetting = (userId?: string): DoneCleanupSetting => {
  const key = `${STORAGE_KEY_PREFIX}${userId || 'default'}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      const valid: DoneAutoCleanSchedule[] = ['never', '30_days', '60_days', '90_days'];
      return {
        schedule: valid.includes(parsed.schedule) ? parsed.schedule : 'never',
        notifyOnClean: parsed.notifyOnClean !== false,
        lastCleanedAt: parsed.lastCleanedAt,
      };
    }
  } catch (err) {
    console.warn('[DoneCleanupService] Failed to read settings from localStorage', err);
  }

  return {
    schedule: 'never',
    notifyOnClean: true,
  };
};

export const saveDoneCleanupSetting = (setting: DoneCleanupSetting, userId?: string): void => {
  const key = `${STORAGE_KEY_PREFIX}${userId || 'default'}`;
  try {
    localStorage.setItem(key, JSON.stringify(setting));
    // Trigger custom event so all listeners can update instantly
    window.dispatchEvent(new CustomEvent('done_cleanup_setting_changed', { detail: setting }));
  } catch (err) {
    console.warn('[DoneCleanupService] Failed to save settings to localStorage', err);
  }
};

/**
 * Returns timestamp in ms when the task was completed.
 * Fallbacks to stored timestamp in localStorage, or created_at if completed_at is null.
 */
export const getCompletedTimestamp = (todo: Todo): number => {
  if (todo.completed_at) {
    const ts = new Date(todo.completed_at).getTime();
    if (!Number.isNaN(ts)) return ts;
  }

  try {
    const cached = localStorage.getItem(`todo_completed_at_${todo.id}`);
    if (cached) {
      const ts = new Date(cached).getTime();
      if (!Number.isNaN(ts)) return ts;
    }
  } catch {
    // Ignore localStorage errors
  }

  if (todo.created_at) {
    const ts = new Date(todo.created_at).getTime();
    if (!Number.isNaN(ts)) return ts;
  }

  return Date.now();
};

/**
 * Filter todos that are completed and eligible for cleanup based on selected schedule
 */
export const getEligibleDoneTasksForCleanup = (
  todos: Todo[],
  schedule: DoneAutoCleanSchedule,
  referenceNow: number = Date.now()
): Todo[] => {
  if (schedule === 'never') return [];

  const doneTodos = todos.filter(t => t.status === 'done' || t.is_completed);
  if (doneTodos.length === 0) return [];

  const option = CLEANUP_SCHEDULE_OPTIONS.find(o => o.value === schedule);
  if (!option || !Number.isFinite(option.durationMs)) return [];

  const thresholdTime = referenceNow - option.durationMs;

  return doneTodos.filter(todo => {
    const completedTs = getCompletedTimestamp(todo);
    return completedTs <= thresholdTime;
  });
};

/**
 * Formats a human-friendly relative time for task completion
 */
export const formatCompletionTime = (todo: Todo): string => {
  const ts = getCompletedTimestamp(todo);
  const diffMs = Date.now() - ts;

  if (diffMs < 60 * 1000) {
    return 'Vừa xong';
  }
  const diffMins = Math.floor(diffMs / (60 * 1000));
  if (diffMins < 60) {
    return `${diffMins} phút trước`;
  }
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours} giờ trước`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays} ngày trước`;
  }
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} tháng trước`;
};
