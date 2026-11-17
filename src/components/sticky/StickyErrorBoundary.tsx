// File: src/components/sticky/StickyErrorBoundary.tsx
// Bảng Sticky Notes gặp lỗi khi hiển thị → không trắng trang mà báo lỗi kèm cách tự sửa:
// tải lại, hoặc xoá bản ghi chú lưu tạm trên máy (dữ liệu trên server và thay đổi chưa gửi vẫn giữ nguyên).

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Eraser, Copy } from 'lucide-react';
import { stickyNoteService } from '../../services/stickyNoteService';

interface Props { userId: string; children: ReactNode }
interface State { error: Error | null; stack: string }

export class StickyErrorBoundary extends Component<Props, State> {
  state: State = { error: null, stack: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Sticky] Lỗi hiển thị:', error, info.componentStack);
    this.setState({ stack: (info.componentStack || '').split('\n').slice(0, 8).join('\n') });
  }

  private reload = () => window.location.reload();

  private resetCache = () => {
    stickyNoteService.clearCache(this.props.userId);
    window.location.reload();
  };

  private copy = () => {
    const { error, stack } = this.state;
    navigator.clipboard?.writeText(`${error?.name}: ${error?.message}\n${error?.stack || ''}\n${stack}`).catch(() => {});
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="max-w-lg mx-auto mt-10 p-6 rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 text-sm text-red-800 dark:text-red-200">
        <div className="flex items-center gap-2 font-bold text-base mb-2">
          <AlertTriangle size={20} /> Sticky Notes gặp lỗi khi hiển thị
        </div>
        <p className="opacity-90 mb-3">Ghi chú trên máy chủ vẫn an toàn. Thử tải lại; nếu vẫn lỗi, xoá bản lưu tạm trên máy này để tải lại từ máy chủ.</p>
        <pre className="mb-4 p-2 rounded-lg bg-white/70 dark:bg-black/30 text-xs whitespace-pre-wrap break-words max-h-32 overflow-auto">{error.message}</pre>
        <div className="flex flex-wrap gap-2">
          <button onClick={this.reload} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700">
            <RefreshCw size={15} /> Tải lại
          </button>
          <button onClick={this.resetCache} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 font-semibold hover:bg-red-100 dark:hover:bg-red-900/40">
            <Eraser size={15} /> Xoá bản lưu tạm & tải lại
          </button>
          <button onClick={this.copy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold opacity-80 hover:opacity-100">
            <Copy size={15} /> Sao chép chi tiết lỗi
          </button>
        </div>
      </div>
    );
  }
}

export default StickyErrorBoundary;
