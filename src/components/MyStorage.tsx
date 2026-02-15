import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    X, Plus, StickyNote, Link2, FileText, Image, Music, Video,
    Trash2, Pin, PinOff, ExternalLink, Download, Search,
    Loader2, AlertCircle, Bold, Italic, Eye, Edit3, Palette, ChevronLeft,
    CheckSquare, List, LockKeyhole, Maximize2, FileDown, Play
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { StorageItem } from '../types';

interface MyStorageProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

type TabType = 'note' | 'link' | 'file' | 'image' | 'audio' | 'video';

const TABS: { key: TabType; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'note', label: 'Ghi chú', icon: <StickyNote size={16} />, color: 'from-amber-500 to-orange-500' },
    { key: 'link', label: 'Liên kết', icon: <Link2 size={16} />, color: 'from-blue-500 to-cyan-500' },
    { key: 'file', label: 'Tệp tin', icon: <FileText size={16} />, color: 'from-emerald-500 to-teal-500' },
    { key: 'image', label: 'Hình ảnh', icon: <Image size={16} />, color: 'from-pink-500 to-rose-500' },
    { key: 'audio', label: 'Âm thanh', icon: <Music size={16} />, color: 'from-violet-500 to-purple-500' },
    { key: 'video', label: 'Video', icon: <Video size={16} />, color: 'from-red-500 to-orange-500' },
];

const NOTE_COLORS = [
    { name: 'Mặc định', value: 'bg-white', text: 'text-gray-800' },
    { name: 'Vàng', value: 'bg-amber-50', text: 'text-amber-900' },
    { name: 'Xanh lá', value: 'bg-emerald-50', text: 'text-emerald-900' },
    { name: 'Xanh dương', value: 'bg-blue-50', text: 'text-blue-900' },
    { name: 'Hồng', value: 'bg-pink-50', text: 'text-pink-900' },
    { name: 'Tím', value: 'bg-violet-50', text: 'text-violet-900' },
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const MyStorage: React.FC<MyStorageProps> = ({ isOpen, onClose, userId }) => {
    const [activeTab, setActiveTab] = useState<TabType>('note');
    const [items, setItems] = useState<StorageItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Add form states
    const [showAddForm, setShowAddForm] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');
    const [selectedColor, setSelectedColor] = useState(0);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const contentRef = useRef<HTMLTextAreaElement>(null);

    // Cursor position tracking for formatting
    const [cursorPos, setCursorPos] = useState({ start: 0, end: 0 });

    // File naming before upload
    const [showFileNameDialog, setShowFileNameDialog] = useState(false);
    const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);
    const [fileCustomName, setFileCustomName] = useState('');

    // View note modal
    const [viewingNote, setViewingNote] = useState<StorageItem | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [editTitle, setEditTitle] = useState('');
    const editRef = useRef<HTMLTextAreaElement>(null);
    const [editCursorPos, setEditCursorPos] = useState({ start: 0, end: 0 });

    // Media viewer (lightbox for images, fullscreen for video/audio/file)
    const [viewingMedia, setViewingMedia] = useState<StorageItem | null>(null);

    // Fetch items when tab changes
    useEffect(() => {
        if (isOpen && userId) fetchItems();
    }, [isOpen, activeTab, userId]);

    const fetchItems = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('my_storage')
                .select('*')
                .eq('user_id', userId)
                .eq('type', activeTab)
                .order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;
            setItems(data || []);
        } catch (err: any) {
            console.error('Lỗi tải dữ liệu:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Track cursor position on textarea interactions
    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNewContent(e.target.value);
        setCursorPos({ start: e.target.selectionStart, end: e.target.selectionEnd });
    };

    const handleContentSelect = () => {
        if (contentRef.current) {
            setCursorPos({
                start: contentRef.current.selectionStart,
                end: contentRef.current.selectionEnd,
            });
        }
    };

    // Insert wrap formatting (bold/italic) using SAVED cursor position
    const insertAtCursor = useCallback((before: string, after: string = '') => {
        const textarea = contentRef.current;
        if (!textarea) return;

        // Use saved cursor position since button click steals focus
        const start = cursorPos.start;
        const end = cursorPos.end;
        const text = newContent;
        const selected = text.substring(start, end);

        const newText = text.substring(0, start) + before + selected + after + text.substring(end);
        setNewContent(newText);

        const newStart = start + before.length;
        const newEnd = newStart + selected.length;

        // Update saved cursor pos
        setCursorPos({ start: newEnd + after.length, end: newEnd + after.length });

        // Restore focus and cursor
        requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(newStart, newEnd);
        });
    }, [newContent, cursorPos]);

    // Insert line prefix (checkbox/bullet) using SAVED cursor position
    const insertLinePrefix = useCallback((prefix: string) => {
        const textarea = contentRef.current;
        if (!textarea) return;

        const start = cursorPos.start;
        const text = newContent;
        const lineStart = text.lastIndexOf('\n', start - 1) + 1;
        const newText = text.substring(0, lineStart) + prefix + text.substring(lineStart);
        setNewContent(newText);

        const newPos = start + prefix.length;
        setCursorPos({ start: newPos, end: newPos });

        requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(newPos, newPos);
        });
    }, [newContent, cursorPos]);

    const handleBold = (e: React.MouseEvent) => { e.preventDefault(); insertAtCursor('**', '**'); };
    const handleItalic = (e: React.MouseEvent) => { e.preventDefault(); insertAtCursor('*', '*'); };
    const handleCheckbox = (e: React.MouseEvent) => { e.preventDefault(); insertLinePrefix('- [ ] '); };
    const handleBullet = (e: React.MouseEvent) => { e.preventDefault(); insertLinePrefix('- '); };

    // Rich markdown renderer for notes
    const renderNoteContent = (content: string): string => {
        let lines = content.split('\n');
        let html = lines.map(line => {
            // Checkbox checked: - [x] text
            if (/^- \[x\] (.*)/.test(line)) {
                const match = line.match(/^- \[x\] (.*)/);
                return `<div class="flex items-start gap-2 my-0.5"><span class="inline-block w-4 h-4 mt-0.5 rounded border-2 border-emerald-500 bg-emerald-500 text-white text-[10px] leading-4 text-center shrink-0">✓</span><span class="line-through text-gray-400">${formatInline(match![1])}</span></div>`;
            }
            // Checkbox unchecked: - [ ] text
            if (/^- \[ \] (.*)/.test(line)) {
                const match = line.match(/^- \[ \] (.*)/);
                return `<div class="flex items-start gap-2 my-0.5"><span class="inline-block w-4 h-4 mt-0.5 rounded border-2 border-gray-300 shrink-0"></span><span>${formatInline(match![1])}</span></div>`;
            }
            // Bullet point: - text
            if (/^- (.+)/.test(line)) {
                const match = line.match(/^- (.+)/);
                return `<div class="flex items-start gap-2 my-0.5"><span class="text-gray-400 mt-0.5 shrink-0">•</span><span>${formatInline(match![1])}</span></div>`;
            }
            // Empty line
            if (line.trim() === '') return '<br/>';
            // Normal line
            return `<p class="my-0.5">${formatInline(line)}</p>`;
        }).join('');

        return html;
    };

    // Inline formatting: bold, italic
    const formatInline = (text: string): string => {
        // Bold: **text**
        let result = text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>');
        // Italic: *text*  (but not ** which is bold)
        result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em class="italic">$1</em>');
        return result;
    };

    const handleAddItem = async () => {
        if (!newTitle.trim() && activeTab === 'note' && !newContent.trim()) return;
        if (!newTitle.trim() && activeTab !== 'note') return;

        try {
            const metadata: Record<string, any> = {};
            if (activeTab === 'note') {
                metadata.color = selectedColor;
            }

            const { error } = await supabase.from('my_storage').insert([{
                user_id: userId,
                type: activeTab,
                title: newTitle.trim() || 'Không tiêu đề',
                content: newContent.trim(),
                metadata,
            }]);

            if (error) throw error;
            setNewTitle('');
            setNewContent('');
            setShowAddForm(false);
            setSelectedColor(0);
            fetchItems();
        } catch (err: any) {
            setError(err.message);
        }
    };

    // Step 1: User clicks "Thêm" on file tabs → show naming dialog
    const handleFileAddClick = () => {
        setShowFileNameDialog(true);
        setFileCustomName('');
    };

    // Step 2: User picks file after naming
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setPendingFiles(files);

        // If no custom name set yet, prefill with first file's name
        if (!fileCustomName.trim()) {
            const baseName = files[0].name.replace(/\.[^/.]+$/, '');
            setFileCustomName(baseName);
        }
    };

    // Step 3: Confirm upload with custom name
    const handleConfirmUpload = async () => {
        if (!pendingFiles || pendingFiles.length === 0) return;

        setIsUploading(true);
        setError('');

        for (let i = 0; i < pendingFiles.length; i++) {
            const file = pendingFiles[i];

            if (file.size > MAX_FILE_SIZE) {
                setError(`Tệp "${file.name}" vượt quá 50MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
                continue;
            }

            try {
                const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const filePath = `${userId}/${Date.now()}_${safeName}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('my-storage')
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false,
                    });

                if (uploadError) {
                    console.error('Lỗi tải lên:', uploadError);
                    setError(`Lỗi tải "${file.name}": ${uploadError.message}`);
                    continue;
                }

                // Get signed URL (for private buckets)
                const { data: urlData } = await supabase.storage
                    .from('my-storage')
                    .createSignedUrl(uploadData.path, 60 * 60 * 24 * 365); // 1 year

                const fileUrl = urlData?.signedUrl || '';

                // Use custom name for first file, original name for rest
                const displayName = i === 0 && fileCustomName.trim()
                    ? fileCustomName.trim()
                    : file.name;

                const { error: insertError } = await supabase.from('my_storage').insert([{
                    user_id: userId,
                    type: activeTab,
                    title: displayName,
                    file_url: fileUrl,
                    file_name: safeName,
                    file_size: file.size,
                    metadata: { originalName: file.name, mimeType: file.type },
                }]);

                if (insertError) {
                    setError(`Lỗi lưu "${file.name}": ${insertError.message}`);
                }
            } catch (err: any) {
                setError(`Lỗi: ${err.message}`);
            }
        }

        setIsUploading(false);
        setPendingFiles(null);
        setShowFileNameDialog(false);
        setFileCustomName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchItems();
    };

    const handleDelete = async (item: StorageItem) => {
        if (!confirm(`Xóa "${item.title}"?`)) return;

        try {
            if (item.file_name) {
                const { data: fileList } = await supabase.storage
                    .from('my-storage')
                    .list(userId, { search: item.file_name });

                if (fileList && fileList.length > 0) {
                    await supabase.storage.from('my-storage').remove([`${userId}/${fileList[0].name}`]);
                }
            }

            const { error } = await supabase.from('my_storage').delete().eq('id', item.id);
            if (error) throw error;
            setItems(prev => prev.filter(i => i.id !== item.id));
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleTogglePin = async (item: StorageItem) => {
        try {
            const { error } = await supabase.from('my_storage')
                .update({ is_pinned: !item.is_pinned })
                .eq('id', item.id);
            if (error) throw error;
            fetchItems();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleUpdateNote = async () => {
        if (!viewingNote) return;
        try {
            const { error } = await supabase.from('my_storage')
                .update({ title: editTitle, content: editContent, updated_at: new Date().toISOString() })
                .eq('id', viewingNote.id);
            if (error) throw error;
            setIsEditing(false);
            setViewingNote({ ...viewingNote, title: editTitle, content: editContent });
            fetchItems();
        } catch (err: any) {
            setError(err.message);
        }
    };

    // Track edit textarea cursor
    const handleEditSelect = () => {
        if (editRef.current) {
            setEditCursorPos({ start: editRef.current.selectionStart, end: editRef.current.selectionEnd });
        }
    };

    // Insert formatting in edit mode using SAVED cursor position
    const insertEditFormat = (e: React.MouseEvent, before: string, after: string = '') => {
        e.preventDefault();
        const textarea = editRef.current;
        if (!textarea) return;
        const start = editCursorPos.start;
        const end = editCursorPos.end;
        const selected = editContent.substring(start, end);
        const newText = editContent.substring(0, start) + before + selected + after + editContent.substring(end);
        setEditContent(newText);
        const newStart = start + before.length;
        const newEnd = newStart + selected.length;
        setEditCursorPos({ start: newEnd + after.length, end: newEnd + after.length });
        requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(newStart, newEnd);
        });
    };

    const insertEditLinePrefix = (e: React.MouseEvent, prefix: string) => {
        e.preventDefault();
        const textarea = editRef.current;
        if (!textarea) return;
        const start = editCursorPos.start;
        const lineStart = editContent.lastIndexOf('\n', start - 1) + 1;
        const newText = editContent.substring(0, lineStart) + prefix + editContent.substring(lineStart);
        setEditContent(newText);
        const newPos = start + prefix.length;
        setEditCursorPos({ start: newPos, end: newPos });
        requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(newPos, newPos);
        });
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    };

    const filteredItems = items.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.content?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isFileTab = ['file', 'image', 'audio', 'video'].includes(activeTab);
    const currentTabInfo = TABS.find(t => t.key === activeTab)!;

    const getNoteColor = (item: StorageItem) => {
        const colorIdx = item.metadata?.color ?? 0;
        return NOTE_COLORS[colorIdx] || NOTE_COLORS[0];
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Note Viewer Modal */}
            {viewingNote && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={() => { setViewingNote(null); setIsEditing(false); }} />
                    <div className={`relative w-[90%] max-w-2xl max-h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden ${getNoteColor(viewingNote).value}`}>
                        {/* Note Header */}
                        <div className="p-5 border-b border-gray-200/50 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <button onClick={() => { setViewingNote(null); setIsEditing(false); }}
                                    className="p-2 hover:bg-black/5 rounded-xl transition-colors">
                                    <ChevronLeft size={18} />
                                </button>
                                {isEditing ? (
                                    <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                                        className="font-bold text-lg bg-transparent border-b-2 border-gray-400 outline-none px-1" />
                                ) : (
                                    <h3 className="font-bold text-lg">{viewingNote.title}</h3>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {isEditing ? (
                                    <>
                                        <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:bg-black/5 rounded-xl">Hủy</button>
                                        <button onClick={handleUpdateNote} className="px-4 py-1.5 text-sm text-white bg-indigo-600 rounded-xl font-semibold hover:bg-indigo-700">Lưu</button>
                                    </>
                                ) : (
                                    <button onClick={() => { setIsEditing(true); setEditTitle(viewingNote.title); setEditContent(viewingNote.content || ''); }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-black/5 rounded-xl transition-colors">
                                        <Edit3 size={14} /> Chỉnh sửa
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Edit Toolbar */}
                        {isEditing && (
                            <div className="flex items-center gap-1 px-5 pt-3 pb-1">
                                <div className="flex items-center gap-0.5 p-1 bg-white/80 rounded-lg border border-gray-200">
                                    <button onMouseDown={(e) => insertEditFormat(e, '**', '**')} title="In đậm"
                                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-800 transition-colors">
                                        <Bold size={14} />
                                    </button>
                                    <button onMouseDown={(e) => insertEditFormat(e, '*', '*')} title="In nghiêng"
                                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-800 transition-colors">
                                        <Italic size={14} />
                                    </button>
                                    <div className="w-px h-5 bg-gray-200 mx-0.5" />
                                    <button onMouseDown={(e) => insertEditLinePrefix(e, '- [ ] ')} title="Thêm checkbox"
                                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-800 transition-colors">
                                        <CheckSquare size={14} />
                                    </button>
                                    <button onMouseDown={(e) => insertEditLinePrefix(e, '- ')} title="Gạch đầu dòng"
                                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-800 transition-colors">
                                        <List size={14} />
                                    </button>
                                </div>
                                <span className="text-[10px] text-gray-400 ml-2">**đậm** | *nghiêng* | - [ ] checkbox | - gạch đầu dòng</span>
                            </div>
                        )}

                        {/* Note Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {isEditing ? (
                                <textarea ref={editRef} value={editContent}
                                    onChange={(e) => { setEditContent(e.target.value); setEditCursorPos({ start: e.target.selectionStart, end: e.target.selectionEnd }); }}
                                    onSelect={handleEditSelect} onKeyUp={handleEditSelect} onClick={handleEditSelect}
                                    className="w-full h-full min-h-[300px] bg-transparent outline-none resize-none text-sm leading-relaxed font-mono"
                                    placeholder="Nhập nội dung ghi chú...&#10;**text** → in đậm&#10;*text* → in nghiêng&#10;- [ ] → checkbox&#10;- → gạch đầu dòng" />
                            ) : (
                                <div
                                    className={`prose prose-sm max-w-none ${getNoteColor(viewingNote).text} leading-relaxed`}
                                    dangerouslySetInnerHTML={{ __html: renderNoteContent(viewingNote.content || 'Chưa có nội dung.') }}
                                />
                            )}
                        </div>
                        {/* Note Footer */}
                        <div className="p-3 border-t border-gray-200/50 text-center shrink-0">
                            <span className="text-[10px] text-gray-400">
                                Tạo lúc {viewingNote.created_at ? new Date(viewingNote.created_at).toLocaleString('vi-VN') : '---'}
                                {viewingNote.updated_at && viewingNote.updated_at !== viewingNote.created_at && ` | Sửa lúc ${new Date(viewingNote.updated_at).toLocaleString('vi-VN')}`}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Media Viewer Modal (Image Lightbox / Video Player / Audio / File) */}
            {viewingMedia && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setViewingMedia(null)} />
                    <div className="relative w-[95%] max-w-5xl max-h-[90vh] flex flex-col items-center">
                        {/* Close button */}
                        <button onClick={() => setViewingMedia(null)}
                            className="absolute top-2 right-2 z-10 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors">
                            <X size={20} />
                        </button>

                        {/* Title */}
                        <div className="text-white text-center mb-3 w-full">
                            <h3 className="font-bold text-lg truncate">{viewingMedia.title}</h3>
                            {viewingMedia.file_size && (
                                <span className="text-gray-300 text-xs">{formatFileSize(viewingMedia.file_size)}</span>
                            )}
                        </div>

                        {/* Content based on type */}
                        {viewingMedia.type === 'image' && viewingMedia.file_url && (
                            <div className="flex-1 flex items-center justify-center overflow-auto max-h-[70vh] w-full">
                                <img
                                    src={viewingMedia.file_url}
                                    alt={viewingMedia.title}
                                    className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-2xl"
                                    style={{ imageRendering: 'auto' }}
                                />
                            </div>
                        )}

                        {viewingMedia.type === 'video' && viewingMedia.file_url && (
                            <div className="flex-1 w-full max-h-[70vh] flex items-center justify-center">
                                <video
                                    controls
                                    autoPlay
                                    className="max-w-full max-h-[70vh] rounded-xl shadow-2xl bg-black"
                                    style={{ minWidth: '60%' }}
                                >
                                    <source src={viewingMedia.file_url} />
                                    Trình duyệt không hỗ trợ phát video.
                                </video>
                            </div>
                        )}

                        {viewingMedia.type === 'audio' && viewingMedia.file_url && (
                            <div className="w-full max-w-lg bg-white/10 backdrop-blur rounded-2xl p-8 flex flex-col items-center gap-6">
                                <div className="w-24 h-24 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                                    <Music size={40} className="text-white" />
                                </div>
                                <audio controls autoPlay className="w-full" style={{ filter: 'invert(1)' }}>
                                    <source src={viewingMedia.file_url} />
                                    Trình duyệt không hỗ trợ phát âm thanh.
                                </audio>
                            </div>
                        )}

                        {viewingMedia.type === 'file' && viewingMedia.file_url && (
                            <div className="w-full max-w-md bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl">
                                <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                                    <FileText size={36} className="text-white" />
                                </div>
                                <p className="text-gray-600 text-sm text-center">
                                    {viewingMedia.metadata?.originalName || viewingMedia.file_name || viewingMedia.title}
                                </p>
                                <div className="flex gap-3 w-full">
                                    <a href={viewingMedia.file_url} target="_blank" rel="noopener noreferrer"
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors">
                                        <ExternalLink size={16} /> Mở tệp
                                    </a>
                                    <a href={viewingMedia.file_url} download target="_blank" rel="noopener noreferrer"
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors">
                                        <Download size={16} /> Tải xuống
                                    </a>
                                </div>
                            </div>
                        )}

                        {/* Download bar for media */}
                        {viewingMedia.type !== 'file' && viewingMedia.file_url && (
                            <div className="mt-4 flex gap-3">
                                <a href={viewingMedia.file_url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors border border-white/20">
                                    <ExternalLink size={14} /> Mở tab mới
                                </a>
                                <a href={viewingMedia.file_url} download target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors border border-white/20">
                                    <Download size={14} /> Tải xuống
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* File Naming Dialog */}
            {showFileNameDialog && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={() => { setShowFileNameDialog(false); setPendingFiles(null); setFileCustomName(''); }} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-[90%] max-w-md p-6 space-y-4">
                        <h3 className="font-bold text-lg text-gray-800">Thêm {currentTabInfo.label}</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-sm text-gray-600 font-medium mb-1 block">Đặt tên hiển thị</label>
                                <input
                                    type="text"
                                    value={fileCustomName}
                                    onChange={(e) => setFileCustomName(e.target.value)}
                                    placeholder={`Nhập tên cho ${currentTabInfo.label.toLowerCase()}...`}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-sm text-gray-600 font-medium mb-1 block">Chọn tệp</label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept={
                                        activeTab === 'image' ? 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/bmp,image/*' :
                                            activeTab === 'audio' ? 'audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/flac,audio/aac,audio/*' :
                                                activeTab === 'video' ? 'video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo,video/*' :
                                                    '*/*'
                                    }
                                    onChange={handleFileSelect}
                                    className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-semibold hover:file:bg-indigo-100 file:cursor-pointer"
                                />
                                {pendingFiles && pendingFiles.length > 0 && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        Đã chọn: {Array.from(pendingFiles).map(f => f.name).join(', ')} ({Array.from(pendingFiles).map(f => formatFileSize(f.size)).join(', ')})
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => { setShowFileNameDialog(false); setPendingFiles(null); setFileCustomName(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
                                Hủy
                            </button>
                            <button onClick={handleConfirmUpload}
                                disabled={!pendingFiles || pendingFiles.length === 0 || isUploading}
                                className={`px-5 py-2 text-sm text-white rounded-xl font-semibold bg-gradient-to-r ${currentTabInfo.color} hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}>
                                {isUploading ? <><Loader2 size={14} className="animate-spin" /> Đang tải...</> : 'Tải lên'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Panel */}
            <div className="relative bg-white rounded-3xl shadow-2xl w-[95%] max-w-4xl h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-5 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
                            <LockKeyhole size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-white font-bold text-lg">My Storage</h2>
                            <span className="text-gray-400 text-xs">Riêng tư & Bảo mật</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Tìm kiếm..."
                                className="bg-white/10 text-white text-sm pl-9 pr-4 py-2 rounded-xl border border-white/10 focus:border-white/30 outline-none w-48 placeholder:text-gray-500"
                            />
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex p-3 gap-2 bg-gray-50 border-b border-gray-100 shrink-0 overflow-x-auto scrollbar-hide">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => { setActiveTab(tab.key); setShowAddForm(false); setError(''); setShowFileNameDialog(false); }}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all
                ${activeTab === tab.key
                                    ? `bg-gradient-to-r ${tab.color} text-white shadow-md`
                                    : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'}`}
                        >
                            {tab.icon}
                            {tab.label}
                            {items.length > 0 && activeTab === tab.key && (
                                <span className="bg-white/30 px-1.5 py-0.5 rounded text-[10px]">{filteredItems.length}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Error */}
                {error && (
                    <div className="mx-5 mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                        <AlertCircle size={16} />
                        <span className="flex-1">{error}</span>
                        <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                    {/* Add Button / Form */}
                    {!showAddForm && !showFileNameDialog ? (
                        <button
                            onClick={() => { if (isFileTab) handleFileAddClick(); else setShowAddForm(true); }}
                            className="w-full mb-4 p-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-all flex items-center justify-center gap-2 group"
                        >
                            {isUploading ? (
                                <><Loader2 size={18} className="animate-spin" /> Đang tải lên...</>
                            ) : (
                                <><Plus size={18} className="group-hover:scale-110 transition-transform" /> Thêm {currentTabInfo.label}</>
                            )}
                        </button>
                    ) : !isFileTab && showAddForm ? (
                        <div className="mb-4 p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                            <input
                                type="text"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder={activeTab === 'link' ? 'Tên liên kết...' : 'Tiêu đề...'}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                                autoFocus
                            />

                            {/* Rich text toolbar for notes */}
                            {activeTab === 'note' && (
                                <div className="flex items-center gap-1 p-1 bg-white rounded-lg border border-gray-200">
                                    <button onMouseDown={handleBold} title="In đậm (**text**)"
                                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-800 transition-colors">
                                        <Bold size={14} />
                                    </button>
                                    <button onMouseDown={handleItalic} title="In nghiêng (*text*)"
                                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-800 transition-colors">
                                        <Italic size={14} />
                                    </button>
                                    <div className="w-px h-5 bg-gray-200 mx-0.5" />
                                    <button onMouseDown={handleCheckbox} title="Thêm checkbox (- [ ])"
                                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-800 transition-colors">
                                        <CheckSquare size={14} />
                                    </button>
                                    <button onMouseDown={handleBullet} title="Gạch đầu dòng (- )"
                                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-800 transition-colors">
                                        <List size={14} />
                                    </button>
                                    <div className="w-px h-5 bg-gray-200 mx-0.5" />
                                    <div className="relative">
                                        <button onClick={() => setShowColorPicker(!showColorPicker)} title="Đổi màu nền"
                                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-800 transition-colors flex items-center gap-1">
                                            <Palette size={14} />
                                            <div className={`w-3 h-3 rounded-full border border-gray-300 ${NOTE_COLORS[selectedColor].value}`} />
                                        </button>
                                        {showColorPicker && (
                                            <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 p-2 flex gap-1.5 z-10">
                                                {NOTE_COLORS.map((c, i) => (
                                                    <button key={i} onClick={() => { setSelectedColor(i); setShowColorPicker(false); }}
                                                        className={`w-7 h-7 rounded-full border-2 ${c.value} ${selectedColor === i ? 'border-indigo-500 scale-110' : 'border-gray-200'} transition-all hover:scale-110`}
                                                        title={c.name} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-gray-400 ml-auto mr-2">**đậm** *nghiêng* - [ ] ☑ - •</span>
                                </div>
                            )}

                            <textarea
                                ref={contentRef}
                                value={newContent}
                                onChange={handleContentChange}
                                onSelect={handleContentSelect}
                                onKeyUp={handleContentSelect}
                                onClick={handleContentSelect}
                                placeholder={activeTab === 'link' ? 'https://...' : 'Nội dung...\n**text** → in đậm\n*text* → in nghiêng\n- [ ] → checkbox\n- → gạch đầu dòng'}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none resize-none min-h-[80px] font-mono"
                                rows={activeTab === 'note' ? 8 : 2}
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => { setShowAddForm(false); setNewTitle(''); setNewContent(''); setShowColorPicker(false); }}
                                    className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors">
                                    Hủy
                                </button>
                                <button onClick={handleAddItem}
                                    className={`px-5 py-2 text-sm text-white rounded-xl font-semibold bg-gradient-to-r ${currentTabInfo.color} hover:shadow-md transition-all`}>
                                    Lưu
                                </button>
                            </div>
                        </div>
                    ) : null}

                    {/* Loading */}
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16 text-gray-400">
                            <Loader2 size={24} className="animate-spin mr-2" /> Đang tải...
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-300">
                            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${currentTabInfo.color} flex items-center justify-center text-white mb-4 opacity-30`}>
                                {currentTabInfo.icon}
                            </div>
                            <p className="text-sm">Chưa có {currentTabInfo.label.toLowerCase()} nào.</p>
                            <p className="text-xs text-gray-300 mt-1">Nhấn nút "Thêm" phía trên để bắt đầu</p>
                        </div>
                    ) : (
                        /* Items Grid */
                        <div className={`grid gap-3 ${activeTab === 'image' ? 'grid-cols-2 md:grid-cols-3' : activeTab === 'note' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                            {filteredItems.map(item => {
                                const noteColor = getNoteColor(item);
                                return (
                                    <div
                                        key={item.id}
                                        className={`rounded-2xl border shadow-sm hover:shadow-md transition-all group overflow-hidden cursor-pointer
                      ${activeTab === 'note' ? `${noteColor.value} border-gray-200/50` : 'bg-white border-gray-100'}
                      ${item.is_pinned ? 'ring-2 ring-amber-300 border-amber-200' : ''}`}
                                        onClick={() => {
                                            if (activeTab === 'note') {
                                                setViewingNote(item);
                                                setIsEditing(false);
                                            } else if (['image', 'video', 'audio', 'file'].includes(activeTab) && item.file_url) {
                                                setViewingMedia(item);
                                            }
                                        }}
                                    >
                                        {/* Image Preview */}
                                        {activeTab === 'image' && item.file_url && (
                                            <div className="aspect-square bg-gray-100 overflow-hidden relative">
                                                <img src={item.file_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                    onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50" x="30" font-size="40">🖼️</text></svg>'; }} />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                    <Maximize2 size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                                </div>
                                            </div>
                                        )}

                                        {/* Audio Player */}
                                        {activeTab === 'audio' && item.file_url && (
                                            <div className="p-4 pb-2" onClick={(e) => e.stopPropagation()}>
                                                <audio controls className="w-full h-10" preload="metadata">
                                                    <source src={item.file_url} />
                                                    Trình duyệt không hỗ trợ phát âm thanh.
                                                </audio>
                                            </div>
                                        )}

                                        {/* Video Thumbnail */}
                                        {activeTab === 'video' && item.file_url && (
                                            <div className="aspect-video bg-black rounded-t-2xl overflow-hidden relative">
                                                <video className="w-full h-full object-cover" preload="metadata" muted>
                                                    <source src={item.file_url} />
                                                </video>
                                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                                                    <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                                        <Play size={24} className="text-gray-800 ml-1" />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Item Info */}
                                        <div className="p-4">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    {item.is_pinned && (
                                                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mb-1 inline-block">GHIM</span>
                                                    )}
                                                    <h4 className={`font-bold text-sm truncate ${activeTab === 'note' ? noteColor.text : 'text-gray-800'}`}>{item.title}</h4>

                                                    {/* Note content preview */}
                                                    {activeTab === 'note' && item.content && (
                                                        <div className="mt-2">
                                                            <div
                                                                className={`text-xs line-clamp-4 ${noteColor.text} opacity-70`}
                                                                dangerouslySetInnerHTML={{ __html: renderNoteContent(item.content) }}
                                                            />
                                                            <span className="text-[10px] text-indigo-500 mt-2 inline-flex items-center gap-1 font-medium">
                                                                <Eye size={10} /> Nhấn để xem chi tiết
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Link */}
                                                    {activeTab === 'link' && item.content && (
                                                        <a href={item.content} target="_blank" rel="noopener noreferrer"
                                                            className="text-blue-500 text-xs mt-1 flex items-center gap-1 hover:text-blue-700 truncate"
                                                            onClick={(e) => e.stopPropagation()}>
                                                            <ExternalLink size={12} /> {item.content}
                                                        </a>
                                                    )}

                                                    {/* File info */}
                                                    {isFileTab && item.file_size && (
                                                        <span className="text-[10px] text-gray-400 mt-1 block">
                                                            {formatFileSize(item.file_size)}
                                                            {item.metadata?.originalName && item.metadata.originalName !== item.title && (
                                                                <> | {item.metadata.originalName}</>
                                                            )}
                                                        </span>
                                                    )}

                                                    <span className="text-[10px] text-gray-300 mt-1 block">
                                                        {item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : ''}
                                                    </span>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                                    onClick={(e) => e.stopPropagation()}>
                                                    <button onClick={() => handleTogglePin(item)}
                                                        className="p-1.5 hover:bg-black/5 rounded-lg text-gray-400 hover:text-amber-600 transition-colors" title={item.is_pinned ? 'Bỏ ghim' : 'Ghim'}>
                                                        {item.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
                                                    </button>
                                                    {item.file_url && (
                                                        <a href={item.file_url} download target="_blank" rel="noopener noreferrer"
                                                            className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors" title="Tải xuống">
                                                            <Download size={14} />
                                                        </a>
                                                    )}
                                                    <button onClick={() => handleDelete(item)}
                                                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors" title="Xóa">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 bg-gray-50 border-t border-gray-100 text-center shrink-0">
                    <p className="text-[10px] text-gray-400">
                        My Storage — Dữ liệu lưu trữ riêng tư trên Supabase | Giới hạn 50MB/tệp
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MyStorage;
