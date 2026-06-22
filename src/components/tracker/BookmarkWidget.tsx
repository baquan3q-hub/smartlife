import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../services/supabase';
import { StorageItem } from '../../types';
import { Plus, X, Bookmark, SlidersHorizontal, Loader2, Trash2, Edit2, Check } from 'lucide-react';
import MyStorage from '../MyStorage';

interface BookmarkWidgetProps {
  userId: string;
}

export const BookmarkWidget: React.FC<BookmarkWidgetProps> = ({ userId }) => {
  const [bookmarks, setBookmarks] = useState<StorageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStorageOpen, setIsStorageOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add bookmark form state
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Bookmark groups states
  const [groups, setGroups] = useState<string[]>([]);
  const [selectedGroupTab, setSelectedGroupTab] = useState('Tất cả');
  const [isManageGroupsOpen, setIsManageGroupsOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [bookmarkGroup, setBookmarkGroup] = useState('');

  // Rename group states
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');

  // Edit bookmark states
  const [editingBookmark, setEditingBookmark] = useState<StorageItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);

  const getGroupColor = (group?: string) => {
    const isDark = document.documentElement.classList.contains('dark');
    if (!group) {
      return isDark
        ? { bg: 'rgba(148, 163, 184, 0.12)', text: '#CBD5E1', border: 'rgba(148, 163, 184, 0.22)' }
        : { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
    }
    let hash = 0;
    for (let i = 0; i < group.length; i++) {
      hash = group.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return isDark ? {
      bg: `hsl(${hue}, 40%, 16%)`,
      text: `hsl(${hue}, 90%, 80%)`,
      border: `hsl(${hue}, 35%, 24%)`,
    } : {
      bg: `hsl(${hue}, 80%, 96%)`,
      text: `hsl(${hue}, 85%, 26%)`,
      border: `hsl(${hue}, 70%, 88%)`,
    };
  };

  const handleOpenEdit = (b: StorageItem) => {
    setEditingBookmark(b);
    setEditTitle(b.title || '');
    setEditUrl(b.content || '');
    setEditGroup(b.metadata?.group || '');
    setIsEditOpen(true);
  };

  const handleUpdateBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBookmark || !editTitle.trim() || !editUrl.trim()) return;

    setIsSaving(true);
    let formattedUrl = editUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    try {
      const { error } = await supabase
        .from('my_storage')
        .update({
          title: editTitle.trim(),
          content: formattedUrl,
          metadata: { ...editingBookmark.metadata, group: editGroup || null },
        })
        .eq('id', editingBookmark.id);

      if (error) throw error;

      setIsEditOpen(false);
      setEditingBookmark(null);
      fetchBookmarks();
    } catch (err: any) {
      alert('Lỗi cập nhật liên kết: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Save categories list to database
  const saveCategoriesToDb = async (updatedGroups: string[]) => {
    if (!userId) return;
    localStorage.setItem(`bookmark_groups_${userId}`, JSON.stringify(updatedGroups));
    
    try {
      const { data, error } = await supabase
        .from('my_storage')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'bookmark_categories')
        .limit(1);
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        await supabase
          .from('my_storage')
          .update({ content: JSON.stringify(updatedGroups) })
          .eq('id', data[0].id);
      } else {
        await supabase.from('my_storage').insert([
          {
            user_id: userId,
            type: 'bookmark_categories',
            title: 'Bookmark Categories',
            content: JSON.stringify(updatedGroups),
          }
        ]);
      }
    } catch (err) {
      console.error('Lỗi lưu danh mục bookmark:', err);
    }
  };

  // Load groups from Supabase, fallback to localStorage
  const loadCategories = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('my_storage')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'bookmark_categories')
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        try {
          const parsed = JSON.parse(data[0].content || '[]');
          setGroups(parsed);
          localStorage.setItem(`bookmark_groups_${userId}`, data[0].content || '[]');
        } catch (e) {
          // fallback
        }
      } else {
        // Not in DB yet, try local storage
        const saved = localStorage.getItem(`bookmark_groups_${userId}`);
        let initial = ['dự án', 'Sách'];
        if (saved) {
          try {
            initial = JSON.parse(saved);
          } catch (e) {}
        }
        setGroups(initial);
        // Save to DB so it exists
        await supabase.from('my_storage').insert([
          {
            user_id: userId,
            type: 'bookmark_categories',
            title: 'Bookmark Categories',
            content: JSON.stringify(initial),
          }
        ]);
      }
    } catch (err) {
      console.error('Lỗi tải danh mục bookmark:', err);
      // Fallback to localStorage
      const saved = localStorage.getItem(`bookmark_groups_${userId}`);
      if (saved) {
        try {
          setGroups(JSON.parse(saved));
        } catch (e) {
          setGroups(['dự án', 'Sách']);
        }
      } else {
        setGroups(['dự án', 'Sách']);
      }
    }
  };

  useEffect(() => {
    loadCategories();
  }, [userId]);

  const fetchBookmarks = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('my_storage')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'link')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100); // Increased limit to support client-side filtering

      if (error) throw error;
      setBookmarks(data || []);
    } catch (err: any) {
      console.error('Lỗi tải bookmark:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookmarks();
  }, [userId]);

  const handleAddBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;

    setIsSaving(true);
    setError('');

    // Ensure URL has protocol
    let formattedUrl = url.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    try {
      const { error } = await supabase.from('my_storage').insert([
        {
          user_id: userId,
          type: 'link',
          title: title.trim(),
          content: formattedUrl,
          is_pinned: false,
          metadata: { group: bookmarkGroup || null },
        },
      ]);

      if (error) throw error;

      setTitle('');
      setUrl('');
      setBookmarkGroup('');
      setShowAddForm(false);
      fetchBookmarks();
    } catch (err: any) {
      setError(err.message || 'Lỗi thêm liên kết');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBookmark = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa liên kết này không?')) return;
    try {
      const { error } = await supabase.from('my_storage').delete().eq('id', id);
      if (error) throw error;
      setBookmarks(bookmarks.filter((b) => b.id !== id));
    } catch (err: any) {
      console.error('Lỗi xóa bookmark:', err);
      alert('Lỗi khi xóa liên kết: ' + err.message);
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newGroupName.trim();
    if (!cleanName) return;
    if (groups.includes(cleanName)) {
      alert('Tên nhóm đã tồn tại!');
      return;
    }
    const updated = [...groups, cleanName];
    setGroups(updated);
    setNewGroupName('');
    await saveCategoriesToDb(updated);
  };

  const handleRemoveGroup = async (groupToRemove: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa nhóm "${groupToRemove}" không? Tất cả bookmark trong nhóm này sẽ trở về trạng thái không phân loại.`)) return;

    const updated = groups.filter(g => g !== groupToRemove);
    setGroups(updated);

    if (selectedGroupTab === groupToRemove) {
      setSelectedGroupTab('Tất cả');
    }

    await saveCategoriesToDb(updated);

    // Update in Supabase
    try {
      const bookmarksInGroup = bookmarks.filter(b => b.metadata?.group === groupToRemove);
      if (bookmarksInGroup.length > 0) {
        const updates = bookmarksInGroup.map(b => {
          const newMetadata = { ...b.metadata };
          delete newMetadata.group;
          return supabase
            .from('my_storage')
            .update({ metadata: newMetadata })
            .eq('id', b.id);
        });
        await Promise.all(updates);
        fetchBookmarks();
      }
    } catch (err) {
      console.error('Lỗi cập nhật bookmark sau khi xóa nhóm:', err);
    }
  };

  const handleRenameGroup = async (oldName: string, newName: string) => {
    const cleanNewName = newName.trim();
    if (!cleanNewName || cleanNewName === oldName) {
      setEditingGroup(null);
      return;
    }
    if (groups.includes(cleanNewName)) {
      alert('Tên nhóm đã tồn tại!');
      return;
    }

    // Update groups list local state
    const updated = groups.map(g => g === oldName ? cleanNewName : g);
    setGroups(updated);

    if (selectedGroupTab === oldName) {
      setSelectedGroupTab(cleanNewName);
    }

    setEditingGroup(null);
    await saveCategoriesToDb(updated);

    // Update in Supabase
    try {
      const bookmarksInGroup = bookmarks.filter(b => b.metadata?.group === oldName);
      if (bookmarksInGroup.length > 0) {
        const updates = bookmarksInGroup.map(b => {
          const newMetadata = { ...b.metadata, group: cleanNewName };
          return supabase
            .from('my_storage')
            .update({ metadata: newMetadata })
            .eq('id', b.id);
        });
        await Promise.all(updates);
        fetchBookmarks();
      }
    } catch (err) {
      console.error('Lỗi cập nhật tên nhóm bookmark:', err);
    }
  };

  const getDomain = (linkUrl?: string) => {
    if (!linkUrl) return '';
    try {
      const parsed = new URL(linkUrl);
      return parsed.hostname.replace('www.', '');
    } catch (e) {
      return '';
    }
  };

  // Compile unique groups list dynamically (merging saved custom groups with any other groups found in bookmarks)
  const allGroups = useMemo(() => {
    const bookmarkGroups = bookmarks.map(b => b.metadata?.group).filter(Boolean) as string[];
    const combined = Array.from(new Set([...groups, ...bookmarkGroups]));
    return combined;
  }, [groups, bookmarks]);

  // Filter bookmarks based on selected tab
  const filteredBookmarks = useMemo(() => {
    if (selectedGroupTab === 'Tất cả') {
      return bookmarks;
    }
    return bookmarks.filter(b => b.metadata?.group === selectedGroupTab);
  }, [bookmarks, selectedGroupTab]);

  return (
    <div className="bg-white rounded-[28px] border border-slate-100 p-2.5 flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex justify-between items-center mb-5 select-none">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
              <Bookmark size={15} />
            </div>
            <h3 className="text-[15px] font-bold text-slate-800">
              Bookmark
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-black hover:bg-slate-900 text-white dark:bg-primary dark:hover:bg-primary/95 dark:text-primary-foreground font-bold text-[10px] px-3.5 py-1.5 rounded-full flex items-center gap-1 transition-all duration-200 active:scale-95 shrink-0 cursor-pointer"
              title="Thêm bookmark"
            >
              <Plus size={11} className="stroke-[3]" />
              Thêm bookmark
            </button>
            <button
              onClick={() => setIsManageGroupsOpen(true)}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              title="Quản lý nhóm"
            >
              <SlidersHorizontal size={14} />
            </button>
          </div>
        </div>

        {/* Group Tabs / Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 mb-3.5 scrollbar-hide select-none">
          <button
            onClick={() => setSelectedGroupTab('Tất cả')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedGroupTab === 'Tất cả'
                ? 'bg-[#5f6e7f] dark:bg-primary text-white dark:text-primary-foreground shadow-sm'
                : 'bg-slate-100/70 text-slate-500 hover:bg-slate-100'
            }`}
          >
            Tất cả
          </button>
          {allGroups.map((group) => (
            <button
              key={group}
              onClick={() => setSelectedGroupTab(group)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedGroupTab === group
                  ? 'bg-[#5f6e7f] dark:bg-primary text-white dark:text-primary-foreground shadow-sm'
                  : 'bg-slate-100/70 text-slate-500 hover:bg-slate-100'
              }`}
            >
              {group}
            </button>
          ))}
        </div>

        {/* Add Form */}
        {showAddForm && (
          <form onSubmit={handleAddBookmark} className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 mb-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
            <div>
              <input
                type="text"
                placeholder="Tên liên kết (ví dụ: Google Classroom)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-350 focus:border-slate-350 bg-white"
                required
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="Đường dẫn URL (ví dụ: classroom.google.com)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-350 focus:border-slate-350 bg-white"
                required
              />
            </div>
            <div>
              <select
                value={bookmarkGroup}
                onChange={(e) => setBookmarkGroup(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-350 focus:border-slate-350 bg-white text-gray-750 font-medium"
              >
                <option value="">Không phân loại</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="text-[10px] text-rose-500 font-medium">{error}</p>}
            <div className="flex justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-250/60 rounded-lg transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSaving || !title.trim() || !url.trim()}
                className="px-3.5 py-1.5 text-[10px] font-bold text-white bg-black disabled:opacity-50 hover:bg-slate-900 dark:bg-primary dark:hover:bg-primary/95 dark:text-primary-foreground rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                {isSaving && <Loader2 size={10} className="animate-spin" />}
                Lưu liên kết
              </button>
            </div>
          </form>
        )}

        {/* List of bookmarks */}
        <div className="space-y-4 max-h-[160px] md:max-h-[200px] overflow-y-auto px-1 py-1 pb-6 scrollbar-thin scroll-fade-bottom">
          {isLoading && bookmarks.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-slate-400 text-xs gap-1.5">
              <Loader2 size={14} className="animate-spin text-slate-500" />
              Đang tải liên kết...
            </div>
          ) : filteredBookmarks.length > 0 ? (
            filteredBookmarks.map((b) => {
              const domain = getDomain(b.content);
              const faviconUrl = domain ? `https://www.google.com/s2/favicons?sz=64&domain=${domain}` : '';
              const groupColors = b.metadata?.group ? getGroupColor(b.metadata.group) : null;
              
              return (
                <div
                  key={b.id}
                  className="group flex items-center justify-between transition-all duration-200"
                >
                  <a
                    href={b.content}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 flex-1 min-w-0 mr-1.5"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                      {faviconUrl ? (
                        <img
                          src={faviconUrl}
                          alt=""
                          className="w-4.5 h-4.5 object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Bookmark size={13} className="text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors leading-tight">
                        {b.title}
                      </p>
                      <span className="text-[9px] text-slate-400 truncate block mt-0.5 font-medium leading-none">
                        {domain || 'docs.google.com'}
                      </span>
                    </div>
                    {b.metadata?.group && groupColors && (
                      <span
                        className="px-1.5 py-0.5 rounded-md text-[8.5px] font-extrabold uppercase tracking-wider border transition-all shrink-0 ml-auto mr-1.5"
                        style={{ backgroundColor: groupColors.bg, color: groupColors.text, borderColor: groupColors.border }}
                      >
                        {b.metadata.group}
                      </span>
                    )}
                  </a>
                  <div className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0 ml-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleOpenEdit(b);
                      }}
                      className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                      title="Sửa liên kết"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleDeleteBookmark(b.id);
                      }}
                      className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                      title="Xóa liên kết"
                    >
                      <X size={13} className="stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-8 px-4 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
              {selectedGroupTab === 'Tất cả'
                ? 'Chưa lưu liên kết nào'
                : `Không có liên kết nào trong nhóm "${selectedGroupTab}"`}
            </div>
          )}
        </div>
      </div>

      {/* Manage Groups Modal */}
      {isManageGroupsOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setIsManageGroupsOpen(false);
              setEditingGroup(null);
            }}
          />
          {/* Modal Content */}
          <div className="relative w-[90%] max-w-sm bg-white rounded-3xl shadow-2xl p-6 overflow-hidden animate-in zoom-in-95 duration-200 text-slate-800">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-bold text-gray-800">Quản lý nhóm</h3>
              <button
                onClick={() => {
                  setIsManageGroupsOpen(false);
                  setEditingGroup(null);
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* List of groups */}
            <div className="space-y-2.5 mb-6 max-h-60 overflow-y-auto pr-1">
              {groups.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs italic bg-slate-50 rounded-2xl">
                  Chưa có nhóm nào.
                </div>
              ) : (
                groups.map((group) => {
                  const isEditingThis = editingGroup === group;
                  return (
                    <div
                      key={group}
                      className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors"
                    >
                      {isEditingThis ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleRenameGroup(group, editingGroupName);
                          }}
                          className="flex-1 flex gap-2 mr-2"
                        >
                          <input
                            type="text"
                            value={editingGroupName}
                            onChange={(e) => setEditingGroupName(e.target.value)}
                            className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-350 focus:border-slate-350 bg-white text-slate-800 font-medium"
                            required
                            autoFocus
                          />
                          <button
                            type="submit"
                            className="p-1 hover:bg-slate-200 text-emerald-600 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Lưu"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingGroup(null)}
                            className="p-1 hover:bg-slate-200 text-slate-400 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Hủy"
                          >
                            <X size={13} />
                          </button>
                        </form>
                      ) : (
                        <>
                          <span className="text-xs font-semibold text-slate-700">{group}</span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                setEditingGroup(group);
                                setEditingGroupName(group);
                              }}
                              className="p-1 hover:bg-slate-200 text-slate-400 hover:text-sky-600 rounded-lg transition-colors cursor-pointer"
                              title="Sửa tên"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleRemoveGroup(group)}
                              className="p-1 hover:bg-slate-200 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                              title="Xóa nhóm"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Add new group form */}
            <form onSubmit={handleAddGroup} className="flex gap-2">
              <input
                type="text"
                placeholder="Tên nhóm mới"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-350 focus:border-slate-350 bg-slate-50/50"
                required
              />
              <button
                type="submit"
                disabled={!newGroupName.trim()}
                className="bg-black hover:bg-slate-900 text-white dark:bg-primary dark:hover:bg-primary/95 dark:text-primary-foreground disabled:opacity-50 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <Plus size={14} className="stroke-[3]" />
                Thêm
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Storage panel modal (keep as backup if still needed) */}
      <MyStorage
        isOpen={isStorageOpen}
        onClose={() => {
          setIsStorageOpen(false);
          fetchBookmarks();
        }}
        userId={userId}
      />

      {/* Edit Bookmark Modal */}
      {isEditOpen && editingBookmark && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setIsEditOpen(false);
              setEditingBookmark(null);
            }}
          />
          {/* Modal Content */}
          <div className="relative w-[90%] max-w-sm bg-white rounded-3xl shadow-2xl p-6 overflow-hidden animate-in zoom-in-95 duration-200 text-slate-800">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-bold text-gray-800">Chỉnh sửa Bookmark</h3>
              <button
                onClick={() => {
                  setIsEditOpen(false);
                  setEditingBookmark(null);
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateBookmark} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-0.5 block mb-1">Tên liên kết</label>
                <input
                  type="text"
                  placeholder="Tên liên kết (ví dụ: Google Classroom)"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-350 focus:border-slate-350 bg-white"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-0.5 block mb-1">Đường dẫn URL</label>
                <input
                  type="text"
                  placeholder="Đường dẫn URL (ví dụ: classroom.google.com)"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-350 focus:border-slate-350 bg-white"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-0.5 block mb-1">Nhóm / Category</label>
                <select
                  value={editGroup}
                  onChange={(e) => setEditGroup(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-350 focus:border-slate-350 bg-white text-gray-750 font-medium"
                >
                  <option value="">Không phân loại</option>
                  {groups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex justify-end gap-1.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditOpen(false);
                    setEditingBookmark(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !editTitle.trim() || !editUrl.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-black disabled:opacity-50 hover:bg-slate-900 dark:bg-primary dark:hover:bg-primary/95 dark:text-primary-foreground rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-slate-200/50"
                >
                  {isSaving && <Loader2 size={12} className="animate-spin" />}
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
