import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, RefreshCw, CheckCircle2, AlertCircle, Settings, LogOut, ChevronRight, Sparkles, CheckCheck, Trash2, Layers } from 'lucide-react';
import { Todo } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { GoogleTasksIcon } from '../icons/GoogleTasksIcon';
import {
  isGoogleTasksConnected,
  getGoogleClientId,
  setGoogleClientId,
  requestGoogleTasksToken,
  disconnectGoogleTasks,
  fetchGoogleTaskLists,
  getSelectedGoogleTaskListId,
  setSelectedGoogleTaskList,
  isAutoSyncEnabled,
  setAutoSyncEnabled,
  getLastSyncTime,
  syncGoogleTasksWithKanban,
  deepCleanAndRebuildGoogleTasks,
  renameGoogleTaskListsToMatchSmartLife,
  GoogleTaskList,
  GoogleTasksSyncResult,
  DeepCleanResult,
  SyncCallbacks,
} from '../../services/googleTasksService';

interface GoogleTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  todos: Todo[];
  syncCallbacks: SyncCallbacks;
  onSyncCompleted?: (result: GoogleTasksSyncResult) => void;
}

export const GoogleTasksModal: React.FC<GoogleTasksModalProps> = ({
  isOpen,
  onClose,
  todos,
  syncCallbacks,
  onSyncCompleted,
}) => {
  const { signInWithGoogle } = useAuth();
  const [isConnected, setIsConnected] = useState(isGoogleTasksConnected());
  const [clientId, setClientId] = useState(getGoogleClientId());
  const [showConfigClientId, setShowConfigClientId] = useState(false);
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [selectedListId, setSelectedListId] = useState(getSelectedGoogleTaskListId());
  const [autoSync, setAutoSync] = useState(isAutoSyncEnabled());
  const [lastSync, setLastSync] = useState<string | null>(getLastSyncTime());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [syncResult, setSyncResult] = useState<GoogleTasksSyncResult | null>(null);
  const [deepCleanInfo, setDeepCleanInfo] = useState<DeepCleanResult | null>(null);
  const [renameSuccessMsg, setRenameSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tải danh sách Task Lists khi đã kết nối
  const loadLists = useCallback(async () => {
    if (!isGoogleTasksConnected()) return;
    try {
      const lists = await fetchGoogleTaskLists();
      setTaskLists(lists);
    } catch (err: any) {
      console.warn('[GoogleTasksModal] Load lists error:', err);
      if (String(err.message || err).includes('hết hạn') || String(err.message || err).includes('401')) {
        setIsConnected(false);
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      const connected = isGoogleTasksConnected();
      setIsConnected(connected);
      setClientId(getGoogleClientId());
      setAutoSync(isAutoSyncEnabled());
      setLastSync(getLastSyncTime());
      setSelectedListId(getSelectedGoogleTaskListId());
      setSyncResult(null);
      setDeepCleanInfo(null);
      setRenameSuccessMsg(null);
      setErrorMsg(null);

      if (connected) {
        loadLists();
      }
    }
  }, [isOpen, loadLists]);

  // Lắng nghe sự kiện auth thay đổi
  useEffect(() => {
    const handleAuthChange = () => {
      setIsConnected(isGoogleTasksConnected());
      setLastSync(getLastSyncTime());
    };
    window.addEventListener('google_tasks_auth_changed', handleAuthChange);
    return () => window.removeEventListener('google_tasks_auth_changed', handleAuthChange);
  }, []);

  if (!isOpen) return null;

  // Xử lý Đổi tên 4 danh sách trên Google Tasks thành Doing, Todo, Backlog, Done
  const handleRenameListsToSmartLife = async () => {
    if (!isConnected) return;
    setIsRenaming(true);
    setErrorMsg(null);
    setRenameSuccessMsg(null);
    try {
      const res = await renameGoogleTaskListsToMatchSmartLife();
      if (res.allLists && res.allLists.length > 0) {
        setTaskLists(res.allLists);
      }
      setRenameSuccessMsg('Đã đổi tên 4 danh sách trên Google Tasks thành: Doing, Todo, Backlog, Done thành công!');
    } catch (err: any) {
      console.error('[GoogleTasksModal] Rename error:', err);
      setErrorMsg(err.message || 'Lỗi đổi tên danh sách trên Google Tasks.');
    } finally {
      setIsRenaming(false);
    }
  };

  // Xử lý Đăng nhập Google
  const handleConnectGoogle = async () => {
    setErrorMsg(null);
    setIsAuthenticating(true);
    try {
      const targetClientId = clientId.trim() || getGoogleClientId();
      if (!targetClientId) {
        setShowConfigClientId(true);
        throw new Error('Vui lòng nhập Google Client ID trước khi kết nối.');
      }
      setGoogleClientId(targetClientId);
      await requestGoogleTasksToken(targetClientId);
      setIsConnected(true);
      await loadLists();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi xác thực Google Tasks.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Xử lý Ngắt kết nối
  const handleDisconnect = () => {
    disconnectGoogleTasks();
    setIsConnected(false);
    setTaskLists([]);
    setSyncResult(null);
    setDeepCleanInfo(null);
  };

  // Xử lý Lưu Client ID
  const handleSaveClientId = () => {
    setGoogleClientId(clientId);
    setShowConfigClientId(false);
  };

  // Xử lý Thay đổi Task List
  const handleSelectList = (listId: string) => {
    setSelectedListId(listId);
    const item = taskLists.find(l => l.id === listId);
    setSelectedGoogleTaskList(listId, listId === '@all' ? 'Tất cả danh sách (My Tasks, Tasks Week, Task Months)' : item?.title);
  };

  // Xử lý Bật/Tắt Auto Sync
  const handleToggleAutoSync = (checked: boolean) => {
    setAutoSync(checked);
    setAutoSyncEnabled(checked);
  };

  // Xử lý Đồng bộ ngay (Toàn bộ danh sách hoặc danh sách được chọn)
  const handleSyncNow = async (targetId = selectedListId) => {
    if (!isConnected) {
      setErrorMsg('Vui lòng kết nối Google Tasks trước khi đồng bộ.');
      return;
    }
    setErrorMsg(null);
    setDeepCleanInfo(null);
    setIsSyncing(true);
    try {
      const result = await syncGoogleTasksWithKanban(todos, syncCallbacks, targetId);
      setSyncResult(result);
      setLastSync(result.timestamp);
      if (onSyncCompleted) {
        onSyncCompleted(result);
      }
    } catch (err: any) {
      console.error('[GoogleTasksModal] Sync error:', err);
      setErrorMsg(err.message || 'Lỗi đồng bộ với Google Tasks.');
      if (String(err.message || err).includes('hết hạn')) {
        setIsConnected(false);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // 🧹 Xử lý Dọn dẹp toàn diện & Build lại Google Tasks từ SmartLife
  const handleDeepCleanAndRebuild = async () => {
    if (!isConnected) {
      setErrorMsg('Vui lòng kết nối Google Tasks trước khi dọn dẹp.');
      return;
    }
    setErrorMsg(null);
    setSyncResult(null);
    setIsSyncing(true);
    try {
      const res = await deepCleanAndRebuildGoogleTasks(todos, syncCallbacks);
      setDeepCleanInfo(res);
      setLastSync(res.timestamp);
      if (onSyncCompleted) {
        onSyncCompleted({
          pulledCount: 0,
          pushedCount: res.pushedActiveCount + res.syncedDoneCount,
          updatedCount: res.updatedCount,
          totalGoogleTasks: res.totalGoogleTasks,
          timestamp: res.timestamp,
        });
      }
      await loadLists();
    } catch (err: any) {
      console.error('[GoogleTasksModal] Deep clean error:', err);
      setErrorMsg(err.message || 'Lỗi dọn dẹp và đồng bộ Google Tasks.');
      if (String(err.message || err).includes('hết hạn')) {
        setIsConnected(false);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSync = (dateStr?: string | null) => {
    if (!dateStr) return 'Chưa đồng bộ';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 'Chưa đồng bộ';
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const date = `${d.getDate()}/${d.getMonth() + 1}`;
    return `${time} ngày ${date}`;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-card border border-border/80 rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border bg-slate-50/70 dark:bg-card/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 border border-border shadow-xs flex items-center justify-center p-2 shrink-0">
              <GoogleTasksIcon size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-foreground">Google Tasks Sync</h3>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold flex items-center gap-1 ${
                  isConnected 
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' 
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  {isConnected ? 'Đã kết nối' : 'Chưa kết nối'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium">SmartLife ⟷ Google Tasks: Doing • Todo • Backlog • Done</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-colors cursor-pointer"
            title="Đóng"
          >
            <X size={17} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs custom-scrollbar">
          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 rounded-2xl border border-rose-200 font-semibold flex items-start gap-2 animate-in fade-in">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1 text-[11.5px] leading-relaxed break-words">{errorMsg}</div>
            </div>
          )}

          {/* Connection Status Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-border flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <span className="font-bold text-foreground text-xs">
                  {isConnected ? 'Tài khoản Google đang kết nối' : 'Kết nối với tài khoản Google'}
                </span>
              </div>
              {isConnected && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="text-[10px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <LogOut size={11} />
                  Ngắt kết nối
                </button>
              )}
            </div>

            {!isConnected ? (
              <div className="space-y-3 pt-1">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Đăng nhập tài khoản Google để tự động đồng bộ 4 danh sách Doing, Todo, Backlog và Done về bảng Kanban của bạn.
                </p>
                <button
                  type="button"
                  onClick={() => signInWithGoogle()}
                  className="w-full py-2.5 rounded-xl bg-black hover:bg-slate-900 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Đăng nhập với Google (1-Click)</span>
                </button>

                {/* Secondary option: Popover Token Client */}
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={isAuthenticating}
                  className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  {isAuthenticating ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      <span>Đang xác thực Popup...</span>
                    </>
                  ) : (
                    <span>Cấp quyền qua Popup riêng</span>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between text-[11px] pt-1 text-muted-foreground">
                <span>Lần đồng bộ gần nhất:</span>
                <span className="font-bold text-foreground">{formatLastSync(lastSync)}</span>
              </div>
            )}
          </div>

          {/* Task List Selector */}
          {isConnected && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                DANH SÁCH GOOGLE TASKS ĐỒNG BỘ
              </label>
              <select
                value={selectedListId}
                onChange={(e) => handleSelectList(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-border text-foreground font-bold text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="@all">
                  🌟 Tất cả danh sách (Doing, Todo, Backlog, Done)
                </option>
                {taskLists.map((list) => (
                  <option key={list.id} value={list.id}>
                    📋 {list.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Auto Sync Toggle */}
          {isConnected && (
            <div className="p-3.5 rounded-2xl bg-slate-50/60 dark:bg-slate-850/60 border border-border flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-foreground">Tự động đồng bộ thời gian thực</p>
                <p className="text-[10px] text-muted-foreground">Tự động cập nhật Google Tasks theo bảng Kanban SmartLife (Master)</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => handleToggleAutoSync(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          )}

          {/* Deep Clean Result Banner */}
          {deepCleanInfo && (
            <div className="p-3.5 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 rounded-2xl border border-emerald-200 animate-in fade-in space-y-2">
              <div className="flex items-center justify-between font-bold text-xs">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Dọn dẹp sạch & Tái cấu trúc Google Tasks thành công!</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] pt-0.5">
                <div className="bg-white/90 dark:bg-card p-2 rounded-xl text-center border border-emerald-100 dark:border-emerald-900 shadow-2xs">
                  <div className="flex items-center justify-center gap-1 text-rose-600 dark:text-rose-400 text-[10px] font-bold">
                    <Trash2 size={11} />
                    <span>Xóa trùng</span>
                  </div>
                  <p className="font-black text-rose-700 dark:text-rose-300 text-sm mt-0.5">
                    {deepCleanInfo.deletedDuplicates + deepCleanInfo.deletedOrphans}
                  </p>
                </div>

                <div className="bg-white/90 dark:bg-card p-2 rounded-xl text-center border border-emerald-100 dark:border-emerald-900 shadow-2xs">
                  <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                    <CheckCheck size={11} />
                    <span>Cột Done</span>
                  </div>
                  <p className="font-black text-emerald-700 dark:text-emerald-300 text-sm mt-0.5">
                    {deepCleanInfo.syncedDoneCount}
                  </p>
                </div>

                <div className="bg-white/90 dark:bg-card p-2 rounded-xl text-center border border-emerald-100 dark:border-emerald-900 shadow-2xs">
                  <div className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                    <Layers size={11} />
                    <span>Task Active</span>
                  </div>
                  <p className="font-black text-blue-700 dark:text-blue-300 text-sm mt-0.5">
                    {deepCleanInfo.pushedActiveCount}
                  </p>
                </div>

                <div className="bg-white/90 dark:bg-card p-2 rounded-xl text-center border border-emerald-100 dark:border-emerald-900 shadow-2xs">
                  <div className="flex items-center justify-center gap-1 text-purple-600 dark:text-purple-400 text-[10px] font-bold">
                    <RefreshCw size={11} />
                    <span>Cập nhật</span>
                  </div>
                  <p className="font-black text-purple-700 dark:text-purple-300 text-sm mt-0.5">
                    {deepCleanInfo.updatedCount}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium text-center">
                ✨ Mọi task trùng lặp đã được xóa sạch. Task Done đã chuyển vào mục Completed.
              </p>
            </div>
          )}

          {/* Standard Sync Result Banner */}
          {syncResult && !deepCleanInfo && (
            <div className="p-3.5 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 rounded-2xl border border-emerald-200 animate-in fade-in space-y-1.5">
              <div className="flex items-center justify-between font-bold text-xs">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Đồng bộ 2 chiều hoàn tất!</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                <div className="bg-white/80 dark:bg-card p-1.5 rounded-lg text-center border border-emerald-100 dark:border-emerald-900">
                  <p className="text-muted-foreground text-[9px]">Kéo từ Google</p>
                  <p className="font-black text-emerald-700 dark:text-emerald-400">+{syncResult.pulledCount}</p>
                </div>
                <div className="bg-white/80 dark:bg-card p-1.5 rounded-lg text-center border border-emerald-100 dark:border-emerald-900">
                  <p className="text-muted-foreground text-[9px]">Đẩy lên Google</p>
                  <p className="font-black text-emerald-700 dark:text-emerald-400">+{syncResult.pushedCount}</p>
                </div>
                <div className="bg-white/80 dark:bg-card p-1.5 rounded-lg text-center border border-emerald-100 dark:border-emerald-900">
                  <p className="text-muted-foreground text-[9px]">Cập nhật</p>
                  <p className="font-black text-emerald-700 dark:text-emerald-400">{syncResult.updatedCount}</p>
                </div>
              </div>
            </div>
          )}

          {/* Rename Success Alert */}
          {renameSuccessMsg && (
            <div className="p-3 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 rounded-2xl border border-emerald-200 font-semibold flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <div className="flex-1 text-[11.5px] leading-relaxed">{renameSuccessMsg}</div>
            </div>
          )}

          {/* Primary Action Button: Single, Clear, Prominent */}
          {isConnected && (
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => handleSyncNow(selectedListId)}
                disabled={isSyncing || isRenaming}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:from-blue-700 hover:to-primary/90 text-white font-black text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
                <span>{isSyncing ? 'Đang đồng bộ dữ liệu...' : 'Đồng bộ 2 chiều ngay'}</span>
              </button>
            </div>
          )}

          {/* Advanced Options Accordion */}
          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setShowConfigClientId(prev => !prev)}
              className="text-[11px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors cursor-pointer w-full justify-between py-1"
            >
              <span className="flex items-center gap-1.5">
                <Settings size={12} />
                <span>Công cụ & Cấu hình nâng cao</span>
              </span>
              <ChevronRight size={12} className={`transition-transform duration-200 ${showConfigClientId ? 'rotate-90' : ''}`} />
            </button>

            {showConfigClientId && (
              <div className="mt-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-border space-y-3.5 animate-in fade-in duration-150">
                {/* Advanced Tools for Connected Users */}
                {isConnected && (
                  <div className="space-y-2 pb-2 border-b border-border/70">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                      CÔNG CỤ BẢO TRÌ GOOGLE TASKS
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleDeepCleanAndRebuild}
                        disabled={isSyncing || isRenaming}
                        className="py-2 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 font-bold text-[11px] border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-center gap-1.5 transition-all active:scale-98 disabled:opacity-50 cursor-pointer text-center"
                        title="Quét sạch mọi bản ghi duplicate chéo danh sách và sắp xếp lại"
                      >
                        <Sparkles size={12} className="text-amber-500 shrink-0" />
                        <span>Dọn trùng & Tái cấu trúc</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRenameListsToSmartLife}
                        disabled={isSyncing || isRenaming}
                        className="py-2 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 font-bold text-[11px] border border-amber-200/80 dark:border-amber-800/80 flex items-center justify-center gap-1.5 transition-all active:scale-98 disabled:opacity-50 cursor-pointer text-center"
                        title="Đổi tên 4 danh sách trên Google Tasks thành Doing, Todo, Backlog, Done"
                      >
                        <span className="text-xs">🏷️</span>
                        <span>{isRenaming ? 'Đang đổi...' : 'Đổi tên 4 danh sách'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Google OAuth Client ID Setting */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                    Google OAuth 2.0 Client ID (Web Application)
                  </label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="xxxx-xxxx.apps.googleusercontent.com"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-card border border-border text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleSaveClientId}
                      className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-bold text-[11px] hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      Lưu Client ID
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
