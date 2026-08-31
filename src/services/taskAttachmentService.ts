/**
 * Task Attachment Service — Local IndexedDB storage for task file attachments.
 * Files are stored locally for optimal performance, not uploaded to server.
 */

const DB_NAME = 'smartlife_task_attachments';
const DB_VERSION = 1;
const STORE_NAME = 'attachments';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file

export interface TaskAttachment {
  id: string;
  taskId: string;
  name: string;
  type: string;       // MIME type
  size: number;
  data: ArrayBuffer;  // Raw file data
  created_at: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('taskId', 'taskId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function notifyUpdated(taskId?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('task_attachments_updated', { detail: { taskId } }));
  }
}

/**
 * Save a file attachment for a task.
 */
export async function saveAttachment(
  taskId: string,
  file: File
): Promise<TaskAttachment> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File quá lớn. Tối đa ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }

  const data = await file.arrayBuffer();
  const attachment: TaskAttachment = {
    id: crypto.randomUUID(),
    taskId,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    data,
    created_at: new Date().toISOString(),
  };

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(attachment);
    request.onsuccess = () => {
      notifyUpdated(taskId);
      resolve(attachment);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Get all attachments for a task.
 */
export async function getAttachments(taskId: string): Promise<TaskAttachment[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('taskId');
    const request = index.getAll(taskId);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Delete a specific attachment by ID.
 */
export async function deleteAttachment(id: string, taskId?: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => {
      notifyUpdated(taskId);
      resolve();
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Reassign attachments from one taskId to another (e.g. from draft/temp id to real DB id).
 */
export async function reassignAttachments(oldTaskId: string, newTaskId: string): Promise<void> {
  if (!oldTaskId || !newTaskId || oldTaskId === newTaskId) return;
  const attachments = await getAttachments(oldTaskId);
  if (attachments.length === 0) return;

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const att of attachments) {
      store.put({ ...att, taskId: newTaskId });
    }
    tx.oncomplete = () => {
      db.close();
      notifyUpdated(newTaskId);
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Delete all attachments for a task (used when task is deleted).
 */
export async function deleteAllForTask(taskId: string): Promise<void> {
  const attachments = await getAttachments(taskId);
  if (attachments.length === 0) return;

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const att of attachments) {
      store.delete(att.id);
    }
    tx.oncomplete = () => {
      db.close();
      notifyUpdated(taskId);
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get count of attachments for a task (lightweight check without loading data).
 */
export async function getAttachmentCount(taskId: string): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('taskId');
    const request = index.count(taskId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Create a downloadable blob URL for an attachment.
 */
export function createDownloadUrl(attachment: TaskAttachment): string {
  const blob = new Blob([attachment.data], { type: attachment.type });
  return URL.createObjectURL(blob);
}

/**
 * Trigger a file download for an attachment.
 */
export function downloadAttachment(attachment: TaskAttachment): void {
  const url = createDownloadUrl(attachment);
  const a = document.createElement('a');
  a.href = url;
  a.download = attachment.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Format file size in human-readable format.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get an appropriate icon/emoji for a file type.
 */
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
  if (mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('text')) return '📝';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive') || mimeType.includes('compressed')) return '📦';
  return '📎';
}

/**
 * Determine if a file can be previewed directly in the browser.
 */
export function isPreviewable(mimeType: string, fileName: string = ''): boolean {
  if (mimeType.startsWith('image/')) return true;
  if (mimeType.startsWith('video/')) return true;
  if (mimeType.startsWith('audio/')) return true;
  if (mimeType === 'application/pdf') return true;
  if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('xml')) return true;
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'pdf', 'mp4', 'webm', 'mp3', 'wav', 'ogg', 'txt', 'md', 'json', 'js', 'ts', 'html', 'css'].includes(ext || '')) {
    return true;
  }
  return false;
}

