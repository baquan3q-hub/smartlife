import { supabase } from './supabase';

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
 * Automatically syncs a Kanban Task link to the Bookmark manager under group "Tasks".
 */
export async function syncTaskLinkToBookmark(
  userId: string,
  taskId: string,
  taskContent: string,
  attachLink?: string | null
): Promise<void> {
  if (!userId || !taskId) return;

  const rawLink = attachLink ? attachLink.trim() : '';

  // If no link, remove any existing bookmark synced for this task
  if (!rawLink) {
    await deleteTaskLinkBookmark(userId, taskId);
    return;
  }

  let formattedUrl = rawLink;
  if (!/^https?:\/\//i.test(formattedUrl)) {
    formattedUrl = `https://${formattedUrl}`;
  }

  try {
    // Ensure "Tasks" group is in category list
    await ensureTasksCategoryExists(userId);

    // Find existing bookmark linked to this task
    const { data: existing } = await supabase
      .from('my_storage')
      .select('id, metadata')
      .eq('user_id', userId)
      .eq('type', 'link')
      .limit(100);

    const taskBookmark = (existing || []).find(
      (b: any) => b.metadata && (b.metadata.task_id === taskId || b.metadata.taskId === taskId)
    );

    if (taskBookmark) {
      // Update existing bookmark
      await supabase
        .from('my_storage')
        .update({
          title: taskContent.trim() || 'Task Link',
          content: formattedUrl,
          metadata: { ...taskBookmark.metadata, group: 'Tasks', task_id: taskId },
        })
        .eq('id', taskBookmark.id);
    } else {
      // Create new bookmark
      await supabase.from('my_storage').insert([
        {
          user_id: userId,
          type: 'link',
          title: taskContent.trim() || 'Task Link',
          content: formattedUrl,
          is_pinned: false,
          metadata: { group: 'Tasks', task_id: taskId },
        },
      ]);
    }
  } catch (err) {
    console.error('[TaskBookmarkSync] Error syncing task link to bookmark:', err);
  }
}

/**
 * Deletes any bookmark associated with a deleted task or cleared link.
 */
export async function deleteTaskLinkBookmark(userId: string, taskId: string): Promise<void> {
  if (!userId || !taskId) return;
  try {
    const { data: existing } = await supabase
      .from('my_storage')
      .select('id, metadata')
      .eq('user_id', userId)
      .eq('type', 'link')
      .limit(100);

    const match = (existing || []).find(
      (b: any) => b.metadata && (b.metadata.task_id === taskId || b.metadata.taskId === taskId)
    );

    if (match) {
      await supabase.from('my_storage').delete().eq('id', match.id);
    }
  } catch (err) {
    console.error('[TaskBookmarkSync] Error deleting task link bookmark:', err);
  }
}
