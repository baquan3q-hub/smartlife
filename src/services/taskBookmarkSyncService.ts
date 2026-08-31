import { supabase } from './supabase';
import { parseTaskLinks } from '../types';

/**
 * Ensures the system category "Tasks" is included in user's saved bookmark categories.
 */
export async function ensureTasksCategoryExists(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const { data } = await supabase
      .from('my_storage')
      .select('id, content')
      .eq('user_id', userId)
      .eq('type', 'bookmark_categories')
      .limit(1);

    let categories: string[] = ['Tasks', 'dự án', 'Sách'];
    if (data && data.length > 0) {
      try {
        const parsed = JSON.parse(data[0].content || '[]');
        if (!parsed.includes('Tasks')) {
          categories = ['Tasks', ...parsed];
          await supabase
            .from('my_storage')
            .update({ content: JSON.stringify(categories) })
            .eq('id', data[0].id);
        }
      } catch (e) {
        // Fallback
      }
    } else {
      await supabase.from('my_storage').insert([
        {
          user_id: userId,
          type: 'bookmark_categories',
          title: 'Bookmark Categories',
          content: JSON.stringify(categories),
        },
      ]);
    }
  } catch (err) {
    console.error('[TaskBookmarkSync] Error ensuring Tasks category:', err);
  }
}

/**
 * Automatically syncs Kanban Task links to the Bookmark manager under group "Tasks".
 * Supports both old single URL format and new JSON array format.
 */
export async function syncTaskLinkToBookmark(
  userId: string,
  taskId: string,
  taskContent: string,
  attachLink?: string | null
): Promise<void> {
  if (!userId || !taskId) return;

  // Parse links (handles both old string URL and new JSON array format)
  const links = parseTaskLinks(attachLink);

  // If no links, remove any existing bookmarks synced for this task
  if (links.length === 0) {
    await deleteTaskLinkBookmark(userId, taskId);
    return;
  }

  try {
    // Ensure "Tasks" group is in category list
    await ensureTasksCategoryExists(userId);

    // Find existing bookmarks linked to this task
    const { data: existing } = await supabase
      .from('my_storage')
      .select('id, metadata')
      .eq('user_id', userId)
      .eq('type', 'link')
      .limit(200);

    const taskBookmarks = (existing || []).filter(
      (b: any) => b.metadata && (b.metadata.task_id === taskId || b.metadata.taskId === taskId)
    );

    // Delete old bookmarks that no longer match any link
    const linkUrls = new Set(links.map(l => {
      let url = l.url;
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      return url;
    }));

    for (const old of taskBookmarks) {
      // We'll just delete all and re-create to keep things simple
    }
    if (taskBookmarks.length > 0) {
      await Promise.all(
        taskBookmarks.map((b: any) => supabase.from('my_storage').delete().eq('id', b.id))
      );
    }

    // Create new bookmarks for each link
    const inserts = links.map((link) => {
      let formattedUrl = link.url;
      if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = `https://${formattedUrl}`;
      }
      return {
        user_id: userId,
        type: 'link' as const,
        title: link.name || taskContent.trim() || 'Task Link',
        content: formattedUrl,
        is_pinned: false,
        metadata: { group: 'Tasks', task_id: taskId },
      };
    });

    if (inserts.length > 0) {
      await supabase.from('my_storage').insert(inserts);
    }
  } catch (err) {
    console.error('[TaskBookmarkSync] Error syncing task link to bookmark:', err);
  }
}

/**
 * Deletes any bookmarks associated with a deleted task or cleared link.
 */
export async function deleteTaskLinkBookmark(userId: string, taskId: string): Promise<void> {
  if (!userId || !taskId) return;
  try {
    const { data: existing } = await supabase
      .from('my_storage')
      .select('id, metadata')
      .eq('user_id', userId)
      .eq('type', 'link')
      .limit(200);

    const matches = (existing || []).filter(
      (b: any) => b.metadata && (b.metadata.task_id === taskId || b.metadata.taskId === taskId)
    );

    if (matches.length > 0) {
      await Promise.all(
        matches.map((b: any) => supabase.from('my_storage').delete().eq('id', b.id))
      );
    }
  } catch (err) {
    console.error('[TaskBookmarkSync] Error deleting task link bookmark:', err);
  }
}
