// File: src/main.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import StickyWindowApp, { isStickyWindowRoute } from './components/sticky/StickyWindowApp'
import SharedTaskView, { isSharedTaskRoute } from './components/share/SharedTaskView'
import { BRIDGE_BROKEN_KEY } from './services/desktopBridge'
import './index.css' // Quan trọng: Import CSS để có giao diện đẹp (Tailwind)

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null; errorInfo: ErrorInfo | null }> {
  public state = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): { hasError: boolean; error: Error } {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', backgroundColor: '#fff0f0', color: '#d8000c', fontFamily: 'monospace', minHeight: '100vh' }}>
          <h1>Something went wrong.</h1>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            <summary>Click for error details</summary>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

// Lưới an toàn cho app Windows: lệnh /__desktop/... lẽ ra phải được app chặn lại. Nếu trang thật sự bị
// chuyển tới đây (app cũ / lệnh không được nhận) → tắt kênh lệnh cho cửa sổ này và quay lại trang trước,
// thay vì hiện cả giao diện app trong cửa sổ ghi chú.
const isStrayDesktopCommand = window.location.pathname.startsWith('/__desktop/');
if (isStrayDesktopCommand) {
  try { sessionStorage.setItem(BRIDGE_BROKEN_KEY, '1'); } catch { /* ignore */ }
  if (window.history.length > 1) window.history.back();
  else window.location.replace('/');
}

// Tìm thẻ div có id="root" trong file index.html
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Không tìm thấy thẻ root trong index.html");
}

// Khởi tạo React App
if (!isStrayDesktopCommand) ReactDOM.createRoot(rootElement as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* Link task được chia sẻ (#/t/<token>): trang công khai chỉ đọc, không tải App/đăng nhập */}
      {/* Cửa sổ note nổi của bản Windows (Tauri) chỉ render phần ghi chú, không tải toàn bộ App */}
      {isStickyWindowRoute() ? <StickyWindowApp /> : isSharedTaskRoute() ? <SharedTaskView /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>,
)