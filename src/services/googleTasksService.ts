/**
 * Google Tasks Sync Service
 * Đồng bộ 2 chiều thời gian thực với Google Tasks API theo quy tắc phân loại:
 * - Cột "Doing" <-> Danh sách "My Tasks" (hoặc Task Ngày / Day)
 * - Cột "Todo" <-> Danh sách "Tasks Week" (hoặc Task Tuần / Week)
 * - Cột "Backlog" <-> Danh sách "Tasks Month" (hoặc Task Tháng / Month)
 * - Cột "Done" <-> Đánh dấu hoàn thành (completed) trong Google Tasks (mặc định tại My Tasks)
 */

import { Todo, TodoStatus } from '../types';
import {
  getValidGoogleToken,
  saveGoogleToken as saveSharedGoogleToken,
  isGoogleConnected,
  disconnectGoogle,
  getGoogleClientId as getSharedGoogleClientId,
  setGoogleClientId as setSharedGoogleClientId,
  requestUnifiedGoogleToken,
  ensureValidGoogleToken,
  googleApiFetch,
} from './googleAuthTokenManager';

export interface GoogleTaskList {
  id: string;
  title: string;
  updated?: string;
  selfLink?: string;
}

export interface GoogleTaskItem {
  id: string;
  title: string;
  updated?: string;
  selfLink?: string;
  parent?: string;
  position?: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string; // RFC 3339 timestamp
  completed?: string;
  deleted?: boolean;
  hidden?: boolean;
  links?: Array<{
    type?: string;
    description?: string;
    link?: string;
  }>;
}

export interface GoogleTasksSyncResult {
  pulledCount: number;
  pushedCount: number;
  updatedCount: number;
  totalGoogleTasks: number;
  timestamp: string;
}

const STORAGE_KEYS = {
  LIST_ID: 'smartlife_gtasks_list_id',
  LIST_TITLE: 'smartlife_gtasks_list_title',
  AUTO_SYNC: 'smartlife_gtasks_auto_sync',
  LAST_SYNC_AT: 'smartlife_gtasks_last_sync_at',
};

// 1. Quản lý Client ID
export const getGoogleClientId = (): string => {
  return getSharedGoogleClientId();
};

export const setGoogleClientId = (clientId: string): void => {
  setSharedGoogleClientId(clientId);
};

// 2. Quản lý Access Token & Trạng thái kết nối
export const getStoredAccessToken = (): string | null => {
  return getValidGoogleToken();
};

export const isGoogleTasksConnected = (): boolean => {
  return isGoogleConnected();
};

export const saveGoogleToken = (token: string, expiresInSeconds: number, refreshToken?: string): void => {
  saveSharedGoogleToken(token, expiresInSeconds, refreshToken);
};

export const disconnectGoogleTasks = (): void => {
  disconnectGoogle();
};

// 3. Quản lý cấu hình danh sách đồng bộ
export const getSelectedGoogleTaskListId = (): string => {
  if (typeof window === 'undefined') return '@all';
  return localStorage.getItem(STORAGE_KEYS.LIST_ID) || '@all';
};

export const setSelectedGoogleTaskList = (listId: string, title?: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.LIST_ID, listId);
  if (title) localStorage.setItem(STORAGE_KEYS.LIST_TITLE, title);
};

export const getSelectedGoogleTaskListTitle = (): string => {
  if (typeof window === 'undefined') return 'Tất cả danh sách (My Tasks, Tasks Week, Tasks Month)';
  return localStorage.getItem(STORAGE_KEYS.LIST_TITLE) || 'Tất cả danh sách (My Tasks, Tasks Week, Tasks Month)';
};

export const isAutoSyncEnabled = (): boolean => {
  if (typeof window === 'undefined') return true; // Mặc định bật auto sync
  const stored = localStorage.getItem(STORAGE_KEYS.AUTO_SYNC);
  return stored === null ? true : stored === 'true';
};

export const setAutoSyncEnabled = (enabled: boolean): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.AUTO_SYNC, enabled ? 'true' : 'false');
};

export const getLastSyncTime = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.LAST_SYNC_AT);
};

// 4. Các helper phân loại danh sách (My Tasks -> Doing, Tasks Week -> Todo, Tasks Month -> Backlog, Done -> Done)
export const getKanbanStatusFromListName = (listTitle: string, isDefault = false): TodoStatus => {
  const t = (listTitle || '').trim().toLowerCase();
  if (t === 'done' || t.includes('hoàn thành') || t.includes('completed') || t.includes('đã xong') || t.includes('da xong')) {
    return 'done';
  }
  if (isDefault || t === 'my tasks' || t === 'my task' || t.includes('ngày') || t.includes('ngay') || t.includes('daily') || t.includes('doing') || t.includes('hôm nay')) {
    return 'doing';
  }
  if (t.includes('week') || t.includes('tuần') || t.includes('tuan') || t.includes('todo')) {
    return 'todo';
  }
  if (t.includes('month') || t.includes('tháng') || t.includes('thang') || t.includes('backlog')) {
    return 'backlog';
  }
  return 'todo';
};

export interface SubtaskItem {
  id: string;
  title: string;
  is_completed: boolean;
}

/**
 * Định dạng notes thành Markdown checklist subtasks + mô tả chi tiết để hiển thị đẹp mắt trên Google Tasks
 */
export const formatGoogleTaskNotes = (
  description?: string,
  _subtasks?: SubtaskItem[]
): string => {
  // Chỉ đưa description thực tế vào notes của Google Tasks
  // Tránh đưa checklist markdown vào đây vì subtask đã được đồng bộ chuẩn thành native child task
  if (description && description.trim()) {
    return description.trim();
  }
  return '';
};

/**
 * Trích xuất { description, subtasks } từ Google Tasks notes
 */
export const parseGoogleTaskNotes = (
  notes?: string
): { description: string; subtasks: SubtaskItem[] } => {
  if (!notes || !notes.trim()) {
    return { description: '', subtasks: [] };
  }

  const lines = notes.split('\n');
  const subtasks: SubtaskItem[] = [];
  const descLines: string[] = [];

  // Nhận diện các dạng: - [ ] Task, - [x] Task, [ ] Task, [x] Task, * [ ] Task
  const subtaskRegex = /^\s*[-*•]?\s*\[([ xX])\]\s*(.+)$/;

  for (const line of lines) {
    const match = line.match(subtaskRegex);
    if (match) {
      const isCompleted = match[1].toLowerCase() === 'x';
      const title = match[2].trim();
      if (title) {
        subtasks.push({
          id: crypto.randomUUID(),
          title,
          is_completed: isCompleted,
        });
      }
    } else {
      descLines.push(line);
    }
  }

  const description = descLines.join('\n').trim();
  return { description, subtasks };
};

/**
 * Đồng bộ subtasks từ SmartLife sang Google Tasks dưới dạng child tasks (subtask thật trên Google Tasks)
 * - Tối ưu hóa tốc độ: Sử dụng cache tasks có sẵn, tránh gọi thêm API GET thừa
 * - Xử lý song song các subtask để giảm thiểu độ trễ mạng
 */
export const syncSubtasksToGoogle = async (
  parentTaskId: string,
  listId: string,
  subtasks: SubtaskItem[],
  token: string,
  cachedTasks?: GoogleTaskItem[]
): Promise<void> => {
  try {
    // 1. Sử dụng cachedTasks nếu có để tránh network roundtrip thừa
    const allTasks = cachedTasks || await fetchGoogleTasks(listId, token).catch(() => []);
    const existingChildren = allTasks.filter(t => t.parent === parentTaskId && t.title && t.title.trim());

    // 2. Map child tasks hiện có theo normalized title
    const childByTitle = new Map<string, GoogleTaskItem>();
    for (const child of existingChildren) {
      childByTitle.set(child.title.trim().toLowerCase(), child);
    }

    // 3. Xử lý song song các subtask từ SmartLife
    const handledChildIds = new Set<string>();
    const subtaskOps: Promise<any>[] = [];

    for (const sub of subtasks) {
      if (!sub.title || !sub.title.trim()) continue;
      const normTitle = sub.title.trim().toLowerCase();
      const existing = childByTitle.get(normTitle);

      if (existing) {
        handledChildIds.add(existing.id);
        const targetStatus = sub.is_completed ? 'completed' : 'needsAction';
        if (existing.status !== targetStatus) {
          subtaskOps.push(updateGoogleTask(existing.id, { status: targetStatus }, listId, token).catch(() => {}));
        }
      } else {
        // Tạo child task mới với parent query param (chạy trực tiếp không cần di chuyển phụ)
        const createOp = createGoogleTask(
          {
            title: sub.title.trim(),
            status: sub.is_completed ? 'completed' : 'needsAction',
            parent: parentTaskId,
          },
          listId,
          token
        ).then(created => {
          if (created?.id) handledChildIds.add(created.id);
        }).catch(e => console.warn('[GoogleTasks] Create subtask error:', e));
        subtaskOps.push(createOp);
      }
    }

    // 4. Xóa các child tasks thừa không còn trong SmartLife
    for (const child of existingChildren) {
      if (!handledChildIds.has(child.id)) {
        subtaskOps.push(deleteGoogleTask(child.id, listId, token).catch(() => {}));
      }
    }

    await Promise.allSettled(subtaskOps);
  } catch (e) {
    console.warn('[GoogleTasks] syncSubtasksToGoogle error:', e);
  }
};

/**
 * Đọc child tasks (subtasks thật) từ Google Tasks và chuyển thành SubtaskItem[]
 */
export const readGoogleSubtasks = (
  parentTaskId: string,
  allTasks: GoogleTaskItem[]
): SubtaskItem[] => {
  return allTasks
    .filter(t => t.parent === parentTaskId && t.title && t.title.trim())
    .map(t => ({
      id: crypto.randomUUID(),
      title: t.title.trim(),
      is_completed: t.status === 'completed',
    }));
};

export const deriveTaskPriority = (
  status: TodoStatus,
  title?: string,
  notes?: string
): 'urgent' | 'high' | 'focus' | 'medium' | 'chill' | 'low' => {
  const text = `${title || ''} ${notes || ''}`.toLowerCase();
  if (text.includes('#urgent') || text.includes('[gấp]') || text.includes('🔴') || text.includes('!urgent')) {
    return 'urgent';
  }
  if (text.includes('#high') || text.includes('[cao]') || text.includes('🟠') || text.includes('[p1]')) {
    return 'high';
  }
  if (text.includes('#focus') || text.includes('[tập trung]') || text.includes('🔵') || text.includes('[p2]')) {
    return 'focus';
  }
  if (text.includes('#chill') || text.includes('[thư thả]') || text.includes('🟢') || text.includes('[p3]')) {
    return 'chill';
  }

  // Phân cấp ưu tiên theo danh sách: Doing (My Tasks) > Todo (Tasks Week) > Backlog (Tasks Month)
  if (status === 'doing') return 'focus';
  if (status === 'todo') return 'medium';
  if (status === 'backlog') return 'chill';
  return 'medium';
};

// 5. Google Identity Services Loader & OAuth Flow
declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

let gisLoadedPromise: Promise<void> | null = null;

export const loadGoogleGisScript = (): Promise<void> => {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();

  if (gisLoadedPromise) return gisLoadedPromise;

  gisLoadedPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById('google-gis-sdk');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gis-sdk';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không thể tải Google Identity Services SDK.'));
    document.head.appendChild(script);
  });

  return gisLoadedPromise;
};

export const requestGoogleTasksToken = async (clientId?: string): Promise<string> => {
  if (clientId) {
    setGoogleClientId(clientId);
  }
  return requestUnifiedGoogleToken({ prompt: 'consent' });
};

// 6. REST API Client cho Google Tasks
const API_BASE = 'https://tasks.googleapis.com/tasks/v1';

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

const tasksApiFetch = async (
  url: string,
  options: RequestInit = {},
  customToken?: string
): Promise<Response> => {
  if (customToken) {
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${customToken}`);
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(url, { ...options, headers });
  }
  return googleApiFetch(url, options);
};

/**
 * Lấy tất cả Task Lists của người dùng
 */
export const fetchGoogleTaskLists = async (token?: string): Promise<GoogleTaskList[]> => {
  const res = await tasksApiFetch(`${API_BASE}/users/@me/lists?maxResults=50`, {}, token);

  if (!res.ok) {
    if (res.status === 401) {
      disconnectGoogleTasks();
      throw new Error('Phiên đăng nhập Google Tasks đã hết hạn.');
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Lỗi lấy danh sách task: HTTP ${res.status}`);
  }

  const data = await res.json();
  return (data.items || []) as GoogleTaskList[];
};

/**
 * Tạo mới 1 Task List trên Google Tasks
 */
export const createGoogleTaskList = async (title: string, token?: string): Promise<GoogleTaskList> => {
  const res = await tasksApiFetch(
    `${API_BASE}/users/@me/lists`,
    {
      method: 'POST',
      body: JSON.stringify({ title }),
    },
    token
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Lỗi tạo danh sách: HTTP ${res.status}`);
  }

  return await res.json();
};

/**
 * Đổi tên (Rename) 1 Task List trên Google Tasks
 */
export const updateGoogleTaskList = async (listId: string, title: string, token?: string): Promise<GoogleTaskList> => {
  const res = await tasksApiFetch(
    `${API_BASE}/users/@me/lists/${encodeURIComponent(listId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    },
    token
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Lỗi cập nhật tên danh sách: HTTP ${res.status}`);
  }

  return await res.json();
};

/**
 * Đổi tên chuẩn hóa 4 danh sách trên Google Tasks để khớp 100% với các cột SmartLife:
 * - Doing (thay cho My Tasks)
 * - Todo (thay cho Tasks Week)
 * - Backlog (thay cho Task Months)
 * - Done (thay cho DONE)
 */
export const renameGoogleTaskListsToMatchSmartLife = async (
  customNames?: { doing?: string; todo?: string; backlog?: string; done?: string },
  token?: string
): Promise<{ success: boolean; allLists: GoogleTaskList[] }> => {
  const accessToken = token || getStoredAccessToken();
  if (!accessToken) throw new Error('Chưa kết nối Google Tasks.');

  const { myTasksListId, weekListId, monthListId, doneListId } = await ensureTimeframeTaskLists(accessToken);

  const doingTitle = customNames?.doing || 'Doing';
  const todoTitle = customNames?.todo || 'Todo';
  const backlogTitle = customNames?.backlog || 'Backlog';
  const doneTitle = customNames?.done || 'Done';

  const renamePromises: Promise<any>[] = [];

  if (myTasksListId) {
    renamePromises.push(updateGoogleTaskList(myTasksListId, doingTitle, accessToken).catch(e => console.warn('[Rename] Doing list error:', e)));
  }
  if (weekListId && weekListId !== myTasksListId) {
    renamePromises.push(updateGoogleTaskList(weekListId, todoTitle, accessToken).catch(e => console.warn('[Rename] Todo list error:', e)));
  }
  if (monthListId && monthListId !== myTasksListId) {
    renamePromises.push(updateGoogleTaskList(monthListId, backlogTitle, accessToken).catch(e => console.warn('[Rename] Backlog list error:', e)));
  }
  if (doneListId && doneListId !== myTasksListId) {
    renamePromises.push(updateGoogleTaskList(doneListId, doneTitle, accessToken).catch(e => console.warn('[Rename] Done list error:', e)));
  }

  await Promise.all(renamePromises);
  const updatedLists = await fetchGoogleTaskLists(accessToken).catch(() => []);

  return { success: true, allLists: updatedLists };
};

interface CachedTimeframeLists {
  data: {
    myTasksListId: string;
    weekListId: string;
    monthListId: string;
    doneListId: string;
    allLists: GoogleTaskList[];
  };
  expiresAt: number;
}

let cachedTimeframeLists: CachedTimeframeLists | null = null;

export const clearTimeframeListsCache = (): void => {
  cachedTimeframeLists = null;
};

/**
 * Tìm hoặc tự động tạo các danh sách chuẩn trên Google Tasks (với In-Memory Caching để tăng tốc tối đa):
 * - "Doing" / "My Tasks" (Doing)
 * - "Todo" / "Tasks Week" (Todo)
 * - "Backlog" / "Task Months" (Backlog)
 * - "Done" / "DONE" / "Hoàn thành" (Done)
 */
export const ensureTimeframeTaskLists = async (token?: string, forceRefresh = false): Promise<{
  myTasksListId: string;
  weekListId: string;
  monthListId: string;
  doneListId: string;
  allLists: GoogleTaskList[];
}> => {
  if (!forceRefresh && cachedTimeframeLists && Date.now() < cachedTimeframeLists.expiresAt) {
    return cachedTimeframeLists.data;
  }

  const lists = await fetchGoogleTaskLists(token);
  
  // 1. Doing / My Tasks
  let myTasksList = lists.find(l => {
    const t = l.title.toLowerCase().trim();
    return t === 'doing' || t === 'my tasks' || t === 'my task' || t === 'task ngày' || t === 'hôm nay';
  }) || lists[0];

  // 2. Todo / Tasks Week
  let weekList = lists.find(l => {
    const t = l.title.toLowerCase().trim();
    return t === 'todo' || t.includes('tasks week') || t.includes('task week') || t.includes('task tuần') || t.includes('tasks tuần') || t.includes('week') || t.includes('tuần') || t.includes('tuan');
  });

  // 3. Backlog / Task Months
  let monthList = lists.find(l => {
    const t = l.title.toLowerCase().trim();
    return t === 'backlog' || t.includes('task months') || t.includes('tasks months') || t.includes('tasks month') || t.includes('task month') || t.includes('task tháng') || t.includes('tasks tháng') || t.includes('month') || t.includes('tháng') || t.includes('thang');
  });

  // 4. Done / DONE / Hoàn thành
  let doneList = lists.find(l => {
    const t = l.title.toLowerCase().trim();
    return t === 'done' || t === 'tasks done' || t === 'task done' || t === 'cột done' || t.includes('hoàn thành') || t.includes('hoan thanh') || t.includes('đã xong') || t.includes('da xong');
  });

  // Tự động tạo danh sách nếu chưa có (dùng tên chuẩn SmartLife)
  if (!weekList) {
    try {
      weekList = await createGoogleTaskList('Todo', token);
    } catch (e) {
      console.warn('[GoogleTasks] Create Todo list warning:', e);
    }
  }
  if (!monthList) {
    try {
      monthList = await createGoogleTaskList('Backlog', token);
    } catch (e) {
      console.warn('[GoogleTasks] Create Backlog list warning:', e);
    }
  }
  if (!doneList) {
    try {
      doneList = await createGoogleTaskList('Done', token);
    } catch (e) {
      console.warn('[GoogleTasks] Create Done list warning:', e);
    }
  }

  const updatedLists = await fetchGoogleTaskLists(token).catch(() => lists);

  const result = {
    myTasksListId: myTasksList?.id || lists[0]?.id || '@default',
    weekListId: weekList?.id || lists[0]?.id || '@default',
    monthListId: monthList?.id || lists[0]?.id || '@default',
    doneListId: doneList?.id || lists[0]?.id || '@default',
    allLists: updatedLists,
  };

  // Lưu cache 60s
  cachedTimeframeLists = {
    data: result,
    expiresAt: Date.now() + 60000,
  };

  return result;
};

/**
 * Lấy toàn bộ danh sách task trong 1 list (hỗ trợ phân trang pageToken đầy đủ)
 */
export const fetchGoogleTasks = async (listId = '@default', token?: string): Promise<GoogleTaskItem[]> => {
  const allItems: GoogleTaskItem[] = [];
  let pageToken: string | undefined = undefined;
  let pageCount = 0;
  const maxPages = 20; // Tối đa 2000 tasks mỗi list

  do {
    const pageParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
    const url = `${API_BASE}/lists/${encodeURIComponent(listId)}/tasks?showCompleted=true&showHidden=true&maxResults=100${pageParam}`;
    const res = await tasksApiFetch(url, {}, token);

    if (!res.ok) {
      if (res.status === 401) {
        disconnectGoogleTasks();
        throw new Error('Phiên đăng nhập Google Tasks đã hết hạn.');
      }
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Lỗi lấy tasks: HTTP ${res.status}`);
    }

    const data = await res.json();
    if (Array.isArray(data.items)) {
      allItems.push(...data.items);
    }
    pageToken = data.nextPageToken;
    pageCount++;
  } while (pageToken && pageCount < maxPages);

  return allItems;
};

/**
 * Tạo mới 1 task trên Google Tasks
 */
export const createGoogleTask = async (
  taskData: { title: string; notes?: string; due?: string; status?: 'needsAction' | 'completed'; parent?: string },
  listId = '@default',
  token?: string
): Promise<GoogleTaskItem> => {
  const body: any = {
    title: taskData.title,
  };
  if (taskData.notes) body.notes = taskData.notes;
  if (taskData.status) body.status = taskData.status;
  if (taskData.parent) body.parent = taskData.parent;
  if (taskData.due) {
    const d = new Date(taskData.due);
    if (!Number.isNaN(d.getTime())) {
      body.due = d.toISOString();
    }
  }

  const parentQuery = taskData.parent ? `?parent=${encodeURIComponent(taskData.parent)}` : '';
  const res = await tasksApiFetch(
    `${API_BASE}/lists/${encodeURIComponent(listId)}/tasks${parentQuery}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    token
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Lỗi tạo task: HTTP ${res.status}`);
  }

  return await res.json();
};

/**
 * Cập nhật task trên Google Tasks
 */
export const updateGoogleTask = async (
  taskId: string,
  updates: Partial<GoogleTaskItem>,
  listId = '@default',
  token?: string
): Promise<GoogleTaskItem> => {
  const body: any = {};
  if (updates.title !== undefined) body.title = updates.title;
  if (updates.notes !== undefined) body.notes = updates.notes;
  if (updates.status !== undefined) body.status = updates.status;
  if (updates.due !== undefined) {
    if (updates.due) {
      const d = new Date(updates.due);
      body.due = Number.isNaN(d.getTime()) ? null : d.toISOString();
    } else {
      body.due = null;
    }
  }

  const res = await tasksApiFetch(
    `${API_BASE}/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
    token
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Lỗi cập nhật task: HTTP ${res.status}`);
  }

  return await res.json();
};

/**
 * Đánh dấu task hoàn thành trên Google Tasks
 */
export const completeGoogleTask = async (taskId: string, listId = '@default', token?: string): Promise<GoogleTaskItem> => {
  return updateGoogleTask(taskId, { status: 'completed' }, listId, token);
};

/**
 * Mở lại task trên Google Tasks
 */
export const uncompleteGoogleTask = async (taskId: string, listId = '@default', token?: string): Promise<GoogleTaskItem> => {
  return updateGoogleTask(taskId, { status: 'needsAction' }, listId, token);
};

/**
 * Xóa task khỏi Google Tasks
 */
export const deleteGoogleTask = async (taskId: string, listId = '@default', token?: string): Promise<void> => {
  await tasksApiFetch(
    `${API_BASE}/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: 'DELETE',
    },
    token
  ).catch((e) => console.warn('[GoogleTasks] Delete task warning:', e));
};

/**
 * Di chuyển hoặc cập nhật task khi kéo thả trên Kanban:
 * - Doing -> List "My Tasks"
 * - Todo -> List "Tasks Week"
 * - Backlog -> List "Task Months"
 * - Done -> List "DONE" (hoặc danh sách Hoàn thành) và đánh dấu completed
 */
export const syncTaskStatusAndDueToGoogle = async (
  googleTaskId: string,
  targetStatus: TodoStatus,
  currentDeadline?: string,
  currentListId = '@default',
  token?: string,
  todoItem?: { content: string; description?: string; subtasks?: SubtaskItem[] },
  onUpdateIds?: (updated: { google_task_id: string; google_list_id: string }) => void
): Promise<void> => {
  const accessToken = token || getStoredAccessToken();
  if (!accessToken) return;

  const { myTasksListId, weekListId, monthListId, doneListId } = await ensureTimeframeTaskLists(accessToken);

  let targetListId = currentListId;
  let targetGoogleStatus: 'needsAction' | 'completed' = 'needsAction';

  if (targetStatus === 'done') {
    targetListId = doneListId || myTasksListId;
    targetGoogleStatus = 'completed';
  } else if (targetStatus === 'doing') {
    targetListId = myTasksListId;
    targetGoogleStatus = 'needsAction';
  } else if (targetStatus === 'todo') {
    targetListId = weekListId;
    targetGoogleStatus = 'needsAction';
  } else if (targetStatus === 'backlog') {
    targetListId = monthListId;
    targetGoogleStatus = 'needsAction';
  }

  const formattedNotes = todoItem ? formatGoogleTaskNotes(todoItem.description, todoItem.subtasks) : undefined;

  // Nếu task cần chuyển sang danh sách khác (ví dụ: kéo vào DONE hoặc từ DONE sang Doing/Todo):
  if (targetListId && currentListId && targetListId !== currentListId && todoItem) {
    try {
      const movedTask = await createGoogleTask({
        title: todoItem.content,
        notes: formattedNotes || todoItem.description,
        due: currentDeadline,
        status: targetGoogleStatus,
      }, targetListId, accessToken);

      await deleteGoogleTask(googleTaskId, currentListId, accessToken).catch(() => {});

      if (onUpdateIds && movedTask?.id) {
        onUpdateIds({ google_task_id: movedTask.id, google_list_id: targetListId });
      }
      return;
    } catch (e) {
      console.warn('[GoogleTasks] Move task between lists error:', e);
    }
  }

  await updateGoogleTask(
    googleTaskId,
    {
      status: targetGoogleStatus,
      notes: formattedNotes,
      due: currentDeadline,
    },
    targetListId || currentListId,
    accessToken
  ).catch(() => {});
};

export interface TodoMutationCallbacks {
  onUpdateTodoId?: (id: string, googleTaskId: string, googleListId: string) => void;
}

/**
 * ĐỒNG BỘ ĐỘC LẬP TỨC THÌ (SmartLife là Master):
 * Tự động đẩy mọi thao tác tạo mới, sửa nội dung/deadline/subtasks/status, hoặc xóa trên SmartLife sang Google Tasks
 */
export const syncTodoMutationToGoogle = async (
  todo: Todo,
  action: 'create' | 'update' | 'delete',
  previousStatus?: TodoStatus,
  callbacks?: TodoMutationCallbacks,
  token?: string
): Promise<void> => {
  const accessToken = token || getStoredAccessToken();
  if (!accessToken || !isAutoSyncEnabled()) return;

  try {
    const { myTasksListId, weekListId, monthListId, doneListId } = await ensureTimeframeTaskLists(accessToken);

    const getDestListId = (status?: TodoStatus, isCompleted?: boolean): string => {
      if (status === 'done' || isCompleted) return doneListId || myTasksListId;
      if (status === 'doing') return myTasksListId;
      if (status === 'todo') return weekListId;
      if (status === 'backlog') return monthListId;
      return myTasksListId;
    };

    if (action === 'delete') {
      if (todo.google_task_id) {
        await deleteGoogleTask(todo.google_task_id, todo.google_list_id || '@default', accessToken).catch(() => {});
      }
      return;
    }

    if (!todo.content || !todo.content.trim()) return;

    const isDone = todo.status === 'done' || !!todo.is_completed;
    const targetStatus: 'needsAction' | 'completed' = isDone ? 'completed' : 'needsAction';
    const targetListId = getDestListId(todo.status, todo.is_completed);
    const formattedNotes = formatGoogleTaskNotes(todo.description, todo.subtasks as SubtaskItem[]);

    // 1. Thao tác CREATE (hoặc UPDATE nhưng chưa có google_task_id)
    if (action === 'create' || !todo.google_task_id) {
      const created = await createGoogleTask(
        {
          title: todo.content.trim(),
          notes: formattedNotes || undefined,
          due: todo.deadline || undefined,
          status: targetStatus,
        },
        targetListId,
        accessToken
      );

      if (created?.id) {
        // Đồng bộ subtasks con (nếu có)
        if (todo.subtasks && (todo.subtasks as SubtaskItem[]).length > 0) {
          await syncSubtasksToGoogle(created.id, targetListId, todo.subtasks as SubtaskItem[], accessToken).catch(() => {});
        }

        if (callbacks?.onUpdateTodoId) {
          callbacks.onUpdateTodoId(todo.id, created.id, targetListId);
        }
      }
      return;
    }

    // 2. Thao tác UPDATE (Đã có google_task_id)
    const currentListId = todo.google_list_id || targetListId;

    // Khi hoàn thành task (Done), cập nhật trực tiếp status = 'completed' trên Google Tasks
    if (isDone) {
      await updateGoogleTask(
        todo.google_task_id,
        {
          title: todo.content.trim(),
          notes: formattedNotes || undefined,
          due: todo.deadline || undefined,
          status: 'completed',
        },
        currentListId,
        accessToken
      ).catch(() => {});

      if (todo.subtasks) {
        await syncSubtasksToGoogle(todo.google_task_id, currentListId, todo.subtasks as SubtaskItem[], accessToken).catch(() => {});
      }
      return;
    }

    // Kiểm tra xem có cần chuyển sang list khác không (ví dụ: Doing -> Backlog hoặc Todo -> Doing)
    if (targetListId !== currentListId) {
      // Di chuyển bằng cách tạo ở list mới và xóa ở list cũ
      const moved = await createGoogleTask(
        {
          title: todo.content.trim(),
          notes: formattedNotes || undefined,
          due: todo.deadline || undefined,
          status: targetStatus,
        },
        targetListId,
        accessToken
      );

      await deleteGoogleTask(todo.google_task_id, currentListId, accessToken).catch(() => {});

      if (moved?.id) {
        if (todo.subtasks && (todo.subtasks as SubtaskItem[]).length > 0) {
          await syncSubtasksToGoogle(moved.id, targetListId, todo.subtasks as SubtaskItem[], accessToken).catch(() => {});
        }

        if (callbacks?.onUpdateTodoId) {
          callbacks.onUpdateTodoId(todo.id, moved.id, targetListId);
        }
      }
      return;
    }

    // Cùng danh sách: Cập nhật thông tin task
    await updateGoogleTask(
      todo.google_task_id,
      {
        title: todo.content.trim(),
        notes: formattedNotes || undefined,
        due: todo.deadline || undefined,
        status: targetStatus,
      },
      currentListId,
      accessToken
    ).catch(() => {});

    // Đồng bộ subtasks con sang native child tasks
    if (todo.subtasks) {
      await syncSubtasksToGoogle(todo.google_task_id, currentListId, todo.subtasks as SubtaskItem[], accessToken).catch(() => {});
    }
  } catch (err) {
    console.warn('[GoogleTasks] syncTodoMutationToGoogle error:', err);
  }
};

// 7. Two-Way Synchronization Engine
export interface SyncCallbacks {
  onAddTodo: (
    content: string,
    priority: any,
    deadline?: string,
    status?: TodoStatus,
    description?: string,
    subtasks?: any[],
    emailNotify?: boolean,
    emailNotifyBeforeMinutes?: number,
    attachLink?: string,
    customId?: string,
    googleTaskId?: string,
    googleListId?: string
  ) => void;
  onUpdateTodo: (todo: Todo) => void;
}

export interface DeepCleanResult {
  deletedDuplicates: number;
  deletedOrphans: number;
  syncedDoneCount: number;
  pushedActiveCount: number;
  updatedCount: number;
  totalGoogleTasks: number;
  timestamp: string;
}

/**
 * Kiểm tra xem task hoàn thành có nằm trong khoảng thời gian gần đây hay không (mặc định 7 ngày)
 */
const isRecentlyCompleted = (completedIso?: string, daysLimit = 7): boolean => {
  if (!completedIso) return true;
  const d = new Date(completedIso);
  if (Number.isNaN(d.getTime())) return true;
  const cutoff = Date.now() - daysLimit * 24 * 60 * 60 * 1000;
  return d.getTime() >= cutoff;
};

/**
 * Chuẩn hóa chuỗi để so sánh chính xác
 */
export const normalizeTitle = (str: string): string => {
  return (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
};

/**
 * Đồng bộ 2 chiều thời gian thực giữa Google Tasks và Kanban Board:
 * Ưu tiên SmartLife là GỐC (Source of Truth):
 * 1. Quét & Xóa toàn bộ task trùng lặp (Duplicate) trên TOÀN CỤC các danh sách Google Tasks.
 * 2. Đẩy toàn bộ dữ liệu hiện có từ SmartLife sang Google Tasks theo đúng danh sách (Doing -> My Tasks, Todo -> Tasks Week, Backlog -> Task Months, Done -> DONE).
 * 3. Kéo các task mới hoặc cập nhật từ Google Tasks (chỉ lấy Done gần nhất trong 7 ngày).
 */
export const syncGoogleTasksWithKanban = async (
  currentTodos: Todo[],
  callbacks: SyncCallbacks,
  selectedListId = '@all'
): Promise<GoogleTasksSyncResult> => {
  const token = getStoredAccessToken();
  if (!token) {
    throw new Error('Chưa kết nối tài khoản Google Tasks.');
  }

  const { myTasksListId, weekListId, monthListId, doneListId, allLists } = await ensureTimeframeTaskLists(token);

  let pulledCount = 0;
  let pushedCount = 0;
  let updatedCount = 0;
  let totalGoogleTasks = 0;
  const nowStr = new Date().toISOString();

  // Helper tìm ID danh sách đích cho từng task trên SmartLife
  const getDestListIdForTodo = (t: Todo) => {
    if (t.status === 'done' || t.is_completed) return doneListId || myTasksListId;
    if (t.status === 'doing') return myTasksListId;
    if (t.status === 'todo') return weekListId;
    if (t.status === 'backlog') return monthListId;
    return myTasksListId;
  };

  // Xác định danh sách cần đồng bộ
  let targetListsToSync: GoogleTaskList[] = [];
  if (selectedListId === '@all') {
    targetListsToSync = allLists;
  } else {
    const single = allLists.find(l => l.id === selectedListId);
    targetListsToSync = single ? [single] : allLists;
  }

  // -------------------------------------------------------------
  // BƯỚC 1: LẤY TẤT CẢ TASK TRÊN GOOGLE VÀ DỌN DẸP TRÙNG LẶP TOÀN CỤC (CHẠY SONG SONG TĂNG TỐC)
  // -------------------------------------------------------------
  const allGoogleEntries: Array<{ task: GoogleTaskItem; listId: string }> = [];
  const allGoogleRawTasks: Array<{ task: GoogleTaskItem; listId: string }> = []; // Giữ tất cả bao gồm child tasks

  const fetchedListResults = await Promise.all(
    targetListsToSync.map(async (list) => {
      const rawTasks = await fetchGoogleTasks(list.id, token).catch(() => []);
      return { listId: list.id, rawTasks };
    })
  );

  for (const { listId, rawTasks } of fetchedListResults) {
    for (const t of rawTasks) {
      if (t.title && t.title.trim()) {
        allGoogleRawTasks.push({ task: t, listId });
        // Chỉ thêm parent tasks (không có parent) vào danh sách chính
        if (!t.parent) {
          allGoogleEntries.push({ task: t, listId });
        }
      }
    }
  }

  // Khử trùng lặp toàn cục: Gom nhóm theo normalized title
  const googleByNormTitle = new Map<string, Array<{ task: GoogleTaskItem; listId: string }>>();
  const allGoogleTasksMap = new Map<string, { task: GoogleTaskItem; listId: string }>();

  for (const entry of allGoogleEntries) {
    const norm = normalizeTitle(entry.task.title);
    const existingGroup = googleByNormTitle.get(norm) || [];
    existingGroup.push(entry);
    googleByNormTitle.set(norm, existingGroup);
    allGoogleTasksMap.set(entry.task.id, entry);
  }

  // Xóa các bản sao trùng thừa trên Google Tasks (giữ lại bản mới nhất hoặc bản completed)
  const dedupedGoogleEntries: Array<{ task: GoogleTaskItem; listId: string }> = [];
  for (const [, group] of googleByNormTitle.entries()) {
    if (group.length === 1) {
      dedupedGoogleEntries.push(group[0]);
    } else {
      // Ưu tiên bản completed nếu người dùng vừa hoàn thành task, hoặc bản cập nhật gần nhất
      const completedEntry = group.find(g => g.task.status === 'completed');
      const keepEntry = completedEntry || group.sort((a, b) => new Date(b.task.updated || 0).getTime() - new Date(a.task.updated || 0).getTime())[0];
      dedupedGoogleEntries.push(keepEntry);

      for (const redundant of group) {
        if (redundant.task.id !== keepEntry.task.id) {
          console.warn(`[AutoSync] Deleting cross-list duplicate task "${redundant.task.title}" (${redundant.task.id}) on list ${redundant.listId}`);
          deleteGoogleTask(redundant.task.id, redundant.listId, token).catch(() => {});
          allGoogleTasksMap.delete(redundant.task.id);
        }
      }
    }
  }

  totalGoogleTasks = dedupedGoogleEntries.length;

  // Map tra cứu dữ liệu SmartLife
  const localByGoogleId = new Map<string, Todo>();
  const localByNormTitle = new Map<string, Todo>();
  for (const t of currentTodos) {
    if (t.google_task_id) localByGoogleId.set(t.google_task_id, t);
    if (t.content && t.content.trim()) localByNormTitle.set(normalizeTitle(t.content), t);
  }

  // -------------------------------------------------------------
  // BƯỚC 2: ĐỒNG BỘ SMARTLIFE LÀ GỐC (Master Push & Link) ➔ Google Tasks
  // -------------------------------------------------------------
  const matchedGoogleTaskIds = new Set<string>();

  for (const localTodo of currentTodos) {
    if (!localTodo.content || !localTodo.content.trim()) continue;

    const norm = normalizeTitle(localTodo.content);
    const destListId = getDestListIdForTodo(localTodo);
    const isLocalDone = localTodo.status === 'done' || localTodo.is_completed;

    // Tìm xem trên Google Tasks đã có task này chưa (qua google_task_id hoặc tên)
    let existingGTaskEntry = localTodo.google_task_id ? allGoogleTasksMap.get(localTodo.google_task_id) : undefined;
    if (!existingGTaskEntry) {
      const matchInGroup = dedupedGoogleEntries.find(g => normalizeTitle(g.task.title) === norm);
      if (matchInGroup) {
        existingGTaskEntry = matchInGroup;
      }
    }

    if (existingGTaskEntry) {
      matchedGoogleTaskIds.add(existingGTaskEntry.task.id);
      const gTask = existingGTaskEntry.task;
      const currentListId = existingGTaskEntry.listId;
      const listObj = allLists.find(l => l.id === currentListId);
      const isGoogleDone = gTask.status === 'completed' || getKanbanStatusFromListName(listObj?.title || '') === 'done';
      const parsedNotes = parseGoogleTaskNotes(gTask.notes);

      try {
        // TRƯỜNG HỢP 1: Người dùng ấn Hoàn thành trên Google Tasks (ở bất kỳ danh sách nào)
        if (isGoogleDone && !isLocalDone) {
          const completedAt = gTask.completed || gTask.updated || nowStr;
          // Ưu tiên đọc native subtasks (child tasks) từ Google
          const nativeSubtasks = readGoogleSubtasks(gTask.id, allGoogleRawTasks.filter(e => e.listId === currentListId).map(e => e.task));
          const finalSubtasks = nativeSubtasks.length > 0 ? nativeSubtasks : (parsedNotes.subtasks.length > 0 ? parsedNotes.subtasks : localTodo.subtasks);

          callbacks.onUpdateTodo({
            ...localTodo,
            status: 'done',
            is_completed: true,
            completed_at: completedAt,
            deadline: gTask.due ? new Date(gTask.due).toISOString() : localTodo.deadline,
            description: parsedNotes.description || localTodo.description,
            subtasks: finalSubtasks,
            google_task_id: gTask.id,
            google_list_id: currentListId,
            google_synced_at: nowStr,
          });
          updatedCount++;
        }
        // TRƯỜNG HỢP 2: SmartLife là DONE (Người dùng đã hoàn thành task trên SmartLife)
        // -> SmartLife là Master: Giữ nguyên trạng thái Done, ĐỒNG BỘ 'completed' sang Google Tasks (Tuyệt đối không revert về Doing)
        else if (isLocalDone) {
          const formattedNotes = formatGoogleTaskNotes(localTodo.description, localTodo.subtasks as SubtaskItem[]);

          if (gTask.status !== 'completed') {
            await updateGoogleTask(
              gTask.id,
              {
                status: 'completed',
                notes: formattedNotes || undefined,
                due: localTodo.deadline || undefined,
              },
              currentListId,
              token
            ).catch(() => {});
          }

          if (!localTodo.google_task_id || localTodo.google_task_id !== gTask.id || localTodo.google_list_id !== currentListId) {
            callbacks.onUpdateTodo({
              ...localTodo,
              status: 'done',
              is_completed: true,
              google_task_id: gTask.id,
              google_list_id: currentListId,
              google_synced_at: nowStr,
            });
          }
          updatedCount++;
        }
        // TRƯỜNG HỢP 3: Cả hai đều chưa hoàn thành (Active tasks: Doing / Todo / Backlog)
        else {
          const formattedNotes = formatGoogleTaskNotes(localTodo.description, localTodo.subtasks as SubtaskItem[]);

          // Cập nhật thông tin task trên Google Tasks
          await updateGoogleTask(
            gTask.id,
            {
              title: localTodo.content.trim(),
              notes: formattedNotes || undefined,
              due: localTodo.deadline || undefined,
              status: 'needsAction',
            },
            currentListId,
            token
          ).catch(() => {});

          // Đồng bộ 2 chiều thời gian deadline và nhắc nhở
          const gDueIso = gTask.due ? new Date(gTask.due).toISOString() : undefined;
          const hasDueChangedOnGoogle = gDueIso && (!localTodo.deadline || new Date(gDueIso).getTime() !== new Date(localTodo.deadline).getTime());

          if (hasDueChangedOnGoogle && gTask.updated && localTodo.google_synced_at && new Date(gTask.updated).getTime() > new Date(localTodo.google_synced_at).getTime()) {
            callbacks.onUpdateTodo({
              ...localTodo,
              deadline: gDueIso,
              email_notify: true,
              email_notify_before_minutes: localTodo.email_notify_before_minutes || 60,
              google_task_id: gTask.id,
              google_list_id: currentListId,
              google_synced_at: nowStr,
            });
          } else if (gTask.due && !localTodo.deadline) {
            callbacks.onUpdateTodo({
              ...localTodo,
              deadline: new Date(gTask.due).toISOString(),
              email_notify: true,
              email_notify_before_minutes: localTodo.email_notify_before_minutes || 60,
              google_task_id: gTask.id,
              google_list_id: currentListId,
              google_synced_at: nowStr,
            });
          } else if (!localTodo.google_task_id || localTodo.google_list_id !== currentListId) {
            callbacks.onUpdateTodo({
              ...localTodo,
              google_task_id: gTask.id,
              google_list_id: currentListId,
              google_synced_at: nowStr,
            });
          }

          // Đồng bộ subtasks thật (child tasks) sang Google Tasks với cache có sẵn
          if (localTodo.subtasks && (localTodo.subtasks as SubtaskItem[]).length > 0) {
            const currentCachedTasks = allGoogleRawTasks.filter(e => e.listId === currentListId).map(e => e.task);
            await syncSubtasksToGoogle(gTask.id, currentListId, localTodo.subtasks as SubtaskItem[], token, currentCachedTasks).catch(() => {});
          }
          updatedCount++;
        }
      } catch (err) {
        console.warn('[GoogleTasks] Sync master item error:', err);
      }
    } else {
      // Task chưa có trên Google Tasks -> Tạo mới vào đúng danh sách (Doing -> My Tasks, Todo -> Tasks Week, Backlog -> Task Months, Done -> DONE)
      try {
        const isDone = localTodo.status === 'done' || localTodo.is_completed;
        const targetStatus = isDone ? 'completed' : 'needsAction';
        const formattedNotes = formatGoogleTaskNotes(localTodo.description, localTodo.subtasks as SubtaskItem[]);

        const createdGTask = await createGoogleTask(
          {
            title: localTodo.content.trim(),
            notes: formattedNotes || undefined,
            due: localTodo.deadline || undefined,
            status: targetStatus,
          },
          destListId,
          token
        );

        if (createdGTask && createdGTask.id) {
          matchedGoogleTaskIds.add(createdGTask.id);

          // Đồng bộ subtasks thật (child tasks) sang Google Tasks với cache có sẵn
          if (localTodo.subtasks && (localTodo.subtasks as SubtaskItem[]).length > 0) {
            const destCachedTasks = allGoogleRawTasks.filter(e => e.listId === destListId).map(e => e.task);
            await syncSubtasksToGoogle(createdGTask.id, destListId, localTodo.subtasks as SubtaskItem[], token, destCachedTasks).catch(() => {});
          }

          callbacks.onUpdateTodo({
            ...localTodo,
            google_task_id: createdGTask.id,
            google_list_id: destListId,
            google_synced_at: nowStr,
          });
          pushedCount++;
        }
      } catch (err) {
        console.warn('[GoogleTasks] Push new task error:', err);
      }
    }
  }

  // -------------------------------------------------------------
  // BƯỚC 3: DỌN DẸP & KÉO TASK MỚI TỪ GOOGLE TASKS
  // -------------------------------------------------------------
  for (const entry of dedupedGoogleEntries) {
    if (matchedGoogleTaskIds.has(entry.task.id)) continue;

    const gTask = entry.task;
    const listId = entry.listId;
    const norm = normalizeTitle(gTask.title);
    const isGoogleCompleted = gTask.status === 'completed';
    const existingLocal = localByGoogleId.get(gTask.id) || localByNormTitle.get(norm);

    if (!existingLocal) {
      const isRecent = isRecentlyCompleted(gTask.completed || gTask.updated, 7);

      if (!isRecent && isGoogleCompleted) {
        // Task hoàn thành đã cũ trên Google Tasks -> Bỏ qua
        continue;
      }

      const isDefault = listId === myTasksListId;
      const listObj = allLists.find(l => l.id === listId);
      const listStatus = getKanbanStatusFromListName(listObj?.title || '', isDefault);

      // Kéo task mới về SmartLife (kèm deadline, reminders và subtasks)
      const googleDue = gTask.due ? new Date(gTask.due).toISOString() : undefined;
      const parsedNotes = parseGoogleTaskNotes(gTask.notes);
      // Ưu tiên đọc native subtasks (child tasks) từ Google
      const nativeSubtasksForPull = readGoogleSubtasks(gTask.id, allGoogleRawTasks.filter(e => e.listId === listId).map(e => e.task));
      const finalSubtasksForPull = nativeSubtasksForPull.length > 0 ? nativeSubtasksForPull : parsedNotes.subtasks;

      let attachLinkJson: string | undefined = undefined;
      if (gTask.links && gTask.links.length > 0) {
        const links = gTask.links
          .filter(l => l.link)
          .map(l => ({
            id: crypto.randomUUID(),
            name: l.description || (l.type === 'email' ? 'Gmail Message' : 'Google Link'),
            url: l.link!,
          }));
        if (links.length > 0) attachLinkJson = JSON.stringify(links);
      }

      const targetStatus: TodoStatus = (isGoogleCompleted || listStatus === 'done') ? 'done' : listStatus;
      const priority = deriveTaskPriority(targetStatus, gTask.title, gTask.notes);

      callbacks.onAddTodo(
        gTask.title.trim(),
        priority,
        googleDue,
        targetStatus,
        parsedNotes.description || undefined,
        finalSubtasksForPull,
        !!googleDue,
        60,
        attachLinkJson,
        undefined,
        gTask.id,
        listId
      );
      pulledCount++;
    }
  }

  localStorage.setItem(STORAGE_KEYS.LAST_SYNC_AT, nowStr);
  window.dispatchEvent(new CustomEvent('google_tasks_sync_updated', { detail: { pulledCount, pushedCount, updatedCount } }));

  return {
    pulledCount,
    pushedCount,
    updatedCount,
    totalGoogleTasks,
    timestamp: nowStr,
  };
};

/**
 * 🧹 DỌN DẸP SẠCH TOÀN BỘ TRÙNG LẶP & TÁI CẤU TRÚC GOOGLE TASKS TỪ SMARTLIFE (Master Clean & Rebuild)
 * - Quét sạch mọi bản sao trùng lặp trên Google Tasks (kể cả giữa các danh sách).
 * - Đưa toàn bộ task ở cột Done (hoặc is_completed) vào danh sách "DONE" trên Google Tasks.
 * - Đồng bộ đầy đủ Deadline/Nhắc nhở và Subtasks sang Google Tasks dưới dạng Markdown checklist.
 * - Sắp xếp lại toàn bộ task Doing ➔ My Tasks, Todo ➔ Tasks Week, Backlog ➔ Task Months, Done ➔ DONE.
 * - Xóa bỏ các task mồ côi thừa thãi sinh ra từ các lỗi đồng bộ cũ.
 */
export const deepCleanAndRebuildGoogleTasks = async (
  currentTodos: Todo[],
  callbacks: SyncCallbacks,
  token?: string
): Promise<DeepCleanResult> => {
  const accessToken = token || getStoredAccessToken();
  if (!accessToken) throw new Error('Chưa kết nối Google Tasks.');

  const { myTasksListId, weekListId, monthListId, doneListId, allLists } = await ensureTimeframeTaskLists(accessToken);
  const nowStr = new Date().toISOString();

  let deletedDuplicates = 0;
  let deletedOrphans = 0;
  let syncedDoneCount = 0;
  let pushedActiveCount = 0;
  let updatedCount = 0;

  // 1. Thu thập toàn bộ task từ tất cả danh sách trên Google Tasks (hỗ trợ phân trang)
  const allGoogleEntries: Array<{ task: GoogleTaskItem; listId: string }> = [];
  for (const list of allLists) {
    const tasks = await fetchGoogleTasks(list.id, accessToken).catch(() => []);
    for (const t of tasks) {
      if (t.title && t.title.trim()) {
        allGoogleEntries.push({ task: t, listId: list.id });
      }
    }
  }

  // 2. Gom nhóm theo normalized title trên toàn hệ thống Google Tasks
  const googleGroupsByNormTitle = new Map<string, Array<{ task: GoogleTaskItem; listId: string }>>();
  const googleEntriesById = new Map<string, { task: GoogleTaskItem; listId: string }>();

  for (const entry of allGoogleEntries) {
    const norm = normalizeTitle(entry.task.title);
    const group = googleGroupsByNormTitle.get(norm) || [];
    group.push(entry);
    googleGroupsByNormTitle.set(norm, group);
    googleEntriesById.set(entry.task.id, entry);
  }

  const handledGoogleTaskIds = new Set<string>();

  // 3. Chuẩn hóa & Đẩy dữ liệu từ SmartLife sang Google Tasks (SmartLife là Master)
  for (const localTodo of currentTodos) {
    if (!localTodo.content || !localTodo.content.trim()) continue;

    const norm = normalizeTitle(localTodo.content);
    const isDone = localTodo.status === 'done' || localTodo.is_completed;
    const targetStatus: 'completed' | 'needsAction' = isDone ? 'completed' : 'needsAction';
    const formattedNotes = formatGoogleTaskNotes(localTodo.description, localTodo.subtasks as SubtaskItem[]);

    // Xác định danh sách đích
    let destListId = myTasksListId;
    if (isDone) destListId = doneListId || myTasksListId;
    else if (localTodo.status === 'doing') destListId = myTasksListId;
    else if (localTodo.status === 'todo') destListId = weekListId;
    else if (localTodo.status === 'backlog') destListId = monthListId;

    // Tìm tất cả bản sao hiện có trên Google Tasks
    let matchedInstances: Array<{ task: GoogleTaskItem; listId: string }> = [];

    if (localTodo.google_task_id && googleEntriesById.has(localTodo.google_task_id)) {
      matchedInstances.push(googleEntriesById.get(localTodo.google_task_id)!);
    }

    const titleMatches = googleGroupsByNormTitle.get(norm) || [];
    for (const tMatch of titleMatches) {
      if (!matchedInstances.some(m => m.task.id === tMatch.task.id)) {
        matchedInstances.push(tMatch);
      }
    }

    if (matchedInstances.length > 0) {
      // Chọn 1 bản ghi duy nhất để giữ lại (ưu tiên bản ghi đã ở đúng list hoặc bản needsAction)
      const keepInstance =
        matchedInstances.find(m => m.listId === destListId) ||
        matchedInstances.find(m => m.task.status === targetStatus) ||
        matchedInstances[0];

      handledGoogleTaskIds.add(keepInstance.task.id);

      // XÓA TẤT CẢ CÁC BẢN SAO TRÙNG THỪA KHÁC TRÊN GOOGLE TASKS
      for (const duplicate of matchedInstances) {
        if (duplicate.task.id !== keepInstance.task.id) {
          handledGoogleTaskIds.add(duplicate.task.id);
          console.log(`[DeepClean] Deleting duplicate task "${duplicate.task.title}" (${duplicate.task.id}) on list ${duplicate.listId}`);
          await deleteGoogleTask(duplicate.task.id, duplicate.listId, accessToken).catch(() => {});
          deletedDuplicates++;
        }
      }

      // Cập nhật bản ghi được giữ lại vào đúng trạng thái, deadline và subtasks
      try {
        if (keepInstance.listId !== destListId) {
          // Di chuyển sang đúng danh sách (bao gồm cả di chuyển sang DONE list)
          const movedTask = await createGoogleTask(
            {
              title: localTodo.content.trim(),
              notes: formattedNotes || undefined,
              due: localTodo.deadline || undefined,
              status: targetStatus,
            },
            destListId,
            accessToken
          );
          await deleteGoogleTask(keepInstance.task.id, keepInstance.listId, accessToken).catch(() => {});
          handledGoogleTaskIds.add(movedTask.id);

          callbacks.onUpdateTodo({
            ...localTodo,
            google_task_id: movedTask.id,
            google_list_id: destListId,
            google_synced_at: nowStr,
          });

          if (isDone) syncedDoneCount++;
          else pushedActiveCount++;
        } else {
          // Cập nhật thuộc tính và trạng thái
          await updateGoogleTask(
            keepInstance.task.id,
            {
              title: localTodo.content.trim(),
              notes: formattedNotes || undefined,
              due: localTodo.deadline || undefined,
              status: targetStatus,
            },
            keepInstance.listId,
            accessToken
          );

          callbacks.onUpdateTodo({
            ...localTodo,
            google_task_id: keepInstance.task.id,
            google_list_id: keepInstance.listId,
            google_synced_at: nowStr,
          });

          if (isDone) syncedDoneCount++;
          else pushedActiveCount++;
        }
        updatedCount++;
      } catch (e) {
        console.warn('[DeepClean] Update task error:', e);
      }
    } else {
      // Task chưa có trên Google Tasks -> Tạo mới với đầy đủ Deadline & Subtasks vào đúng danh sách
      try {
        const createdTask = await createGoogleTask(
          {
            title: localTodo.content.trim(),
            notes: formattedNotes || undefined,
            due: localTodo.deadline || undefined,
            status: targetStatus,
          },
          destListId,
          accessToken
        );

        if (createdTask?.id) {
          handledGoogleTaskIds.add(createdTask.id);
          callbacks.onUpdateTodo({
            ...localTodo,
            google_task_id: createdTask.id,
            google_list_id: destListId,
            google_synced_at: nowStr,
          });

          if (isDone) syncedDoneCount++;
          else pushedActiveCount++;
        }
      } catch (e) {
        console.warn('[DeepClean] Create task error:', e);
      }
    }
  }

  // 4. Quét sạch các task mồ côi (không tồn tại trong SmartLife) hoặc trùng lặp không gán
  for (const entry of allGoogleEntries) {
    if (handledGoogleTaskIds.has(entry.task.id)) continue;

    // Task này trên Google không thuộc SmartLife -> Xóa dọn dẹp
    console.log(`[DeepClean] Deleting orphan task "${entry.task.title}" (${entry.task.id}) on list ${entry.listId}`);
    await deleteGoogleTask(entry.task.id, entry.listId, accessToken).catch(() => {});
    deletedOrphans++;
  }

  localStorage.setItem(STORAGE_KEYS.LAST_SYNC_AT, nowStr);
  window.dispatchEvent(new CustomEvent('google_tasks_sync_updated', {
    detail: { deletedDuplicates, deletedOrphans, syncedDoneCount, pushedActiveCount }
  }));

  return {
    deletedDuplicates,
    deletedOrphans,
    syncedDoneCount,
    pushedActiveCount,
    updatedCount,
    totalGoogleTasks: currentTodos.length,
    timestamp: nowStr,
  };
};

/**
 * Quét dọn toàn bộ task trùng lặp (Duplicate) và task mồ côi trên Google Tasks (tương thích ngược)
 */
export const cleanDuplicateAndOrphanGoogleTasks = async (
  currentTodos: Todo[],
  callbacks: SyncCallbacks,
  token?: string
): Promise<{ deletedDuplicates: number; deletedOrphans: number; syncResult: GoogleTasksSyncResult }> => {
  const deepRes = await deepCleanAndRebuildGoogleTasks(currentTodos, callbacks, token);
  return {
    deletedDuplicates: deepRes.deletedDuplicates,
    deletedOrphans: deepRes.deletedOrphans,
    syncResult: {
      pulledCount: 0,
      pushedCount: deepRes.pushedActiveCount + deepRes.syncedDoneCount,
      updatedCount: deepRes.updatedCount,
      totalGoogleTasks: deepRes.totalGoogleTasks,
      timestamp: deepRes.timestamp,
    },
  };
};


