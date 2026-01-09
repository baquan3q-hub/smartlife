// File: src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css' // Quan trọng: Import CSS để có giao diện đẹp (Tailwind)

// Tìm thẻ div có id="root" trong file index.html
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Không tìm thấy thẻ root trong index.html");
}

// Khởi tạo React App
ReactDOM.createRoot(rootElement as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)