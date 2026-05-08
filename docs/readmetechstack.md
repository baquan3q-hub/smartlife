<div align="center">

# 🧠 SmartLife Assistant — Tech Stack & System Overview

**Ứng dụng trợ lý cá nhân thông minh tích hợp AI, quản lý tài chính, lịch trình và năng suất.**

![Version](https://img.shields.io/badge/version-0.0.0-blue)
![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-BaaS-3FCF8E?logo=supabase)
![Gemini](https://img.shields.io/badge/Gemini_AI-Flash-8E75B2?logo=google)

</div>

---

## 📖 Mục Lục

- [Bối cảnh dự án](#-bối-cảnh-dự-án)
- [Tech Stack tổng quan](#-tech-stack-tổng-quan)
- [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [Luồng hệ thống](#-luồng-hệ-thống-system-flow)
- [Database Schema](#-database-schema)
- [Tính năng chính](#-tính-năng-chính)
- [Cách chạy dự án](#-cách-chạy-dự-án)

---

## 🎯 Bối Cảnh Dự Án

**SmartLife Assistant** là một ứng dụng web **Progressive Web App (PWA)** hướng đến người dùng Việt Nam, hoạt động như một **trợ lý cá nhân toàn diện** với các chức năng chính:

1. **Quản lý tài chính cá nhân** — Theo dõi thu/chi, ngân sách, dòng tiền, mục tiêu tiết kiệm
2. **Quản lý lịch trình & năng suất** — Thời khóa biểu, danh sách việc cần làm, Focus Timer (Pomodoro)
3. **AI Advisor thông minh** — Trợ lý AI tích hợp Gemini có khả năng phân tích dữ liệu tài chính, tư vấn chiến lược, thực thi hành động (thêm giao dịch, lịch trình) thông qua function calling
4. **Lịch âm-dương** — Hỗ trợ lịch âm lịch Việt Nam với nhắc nhở ngày lễ
5. **Không gian âm nhạc** — Phát nhạc tập trung/thư giãn khi làm việc
6. **Lưu trữ cá nhân (My Storage)** — Quản lý ghi chú, link, file, hình ảnh, audio, video

Ứng dụng được thiết kế responsive cho cả **desktop** và **mobile**, hỗ trợ cài đặt như ứng dụng native thông qua PWA, và có cấu hình **Capacitor** để đóng gói thành app Android/iOS.

**Mục tiêu dài hạn:** Trở thành một nền tảng quản lý cuộc sống thông minh tích hợp AI sâu, với khả năng tự học từ hành vi người dùng (behavioral analysis) và đưa ra gợi ý chủ động (Smart Nudges).

---

## 🛠 Tech Stack Tổng Quan

### Frontend

| Công nghệ | Phiên bản | Vai trò |
|---|---|---|
| **React** | 19.2 | UI Library chính, quản lý component-based |
| **TypeScript** | 5.8 | Type safety, IntelliSense, giảm runtime bugs |
| **Vite** | 6.2 | Build tool & Dev server (HMR cực nhanh) |
| **TailwindCSS** | CDN | Utility-first CSS framework cho UI styling |
| **Lucide React** | 0.562 | Icon library hiện đại (thay thế FontAwesome) |
| **Recharts** | 3.6 | Thư viện biểu đồ React (bar, line, area charts) |
| **React Markdown** | 10.1 | Render Markdown content (AI responses) |
| **Remark GFM** | 4.0 | Plugin GitHub Flavored Markdown (bảng, strikethrough) |
| **React Number Format** | 5.4 | Format số tiền theo định dạng VND |
| **React Player** | 3.4 | Phát nhạc/video (YouTube, SoundCloud, file) |
| **html2canvas** | 1.4 | Chụp screenshot UI (export báo cáo) |
| **lunar-javascript** | 1.7 | Tính lịch âm lịch (Rằm, Mùng 1, ngày lễ Việt) |
| **Inter Font** | Google Fonts | Typography chính của ứng dụng |

### Backend as a Service (BaaS)

| Công nghệ | Vai trò |
|---|---|
| **Supabase** | Database (PostgreSQL), Authentication (OAuth + Email), Row Level Security (RLS), Realtime Subscriptions |
| **Firebase Cloud Messaging** | Push Notification cho PWA (foreground & background) |
| **Google Gemini API** | AI Engine — model `gemini-flash-latest` cho Chat, Function Calling, Memory Extraction |

### Build & Deployment

| Công nghệ | Vai trò |
|---|---|
| **Vite** | Bundler & Dev Server (port 3000) |
| **Vite PWA Plugin** | Tự động generate Service Worker, manifest.json, offline caching |
| **Vercel** | Hosting & Serverless Functions (API proxy) |
| **Capacitor** | Đóng gói PWA thành app native Android/iOS |

### Backend (Python — Serverless)

| Công nghệ | Vai trò |
|---|---|
| **FastAPI** | REST API framework (Vercel Serverless Functions) |
| **Uvicorn** | ASGI server cho local development |
| **google-generativeai** | Python SDK tương tác Gemini API |
| **supabase-py** | Python client cho Supabase database |
| **pydantic** | Data validation & Settings management |

---

## 🏗 Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser/PWA)                      │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │  React 19   │  │  TailwindCSS  │  │   Service Worker (PWA)   │ │
│  │  TypeScript  │  │  Lucide Icons │  │   Firebase Messaging SW  │ │
│  └──────┬─────┘  └──────────────┘  └───────────────────────────┘ │
│         │                                                         │
│  ┌──────┴──────────────────────────────────────────────────────┐  │
│  │                    SERVICES LAYER                            │  │
│  │  ┌─────────────┐ ┌──────────────┐ ┌───────────────────────┐ │  │
│  │  │ supabase.ts  │ │ firebase.ts  │ │  geminiService.ts     │ │  │
│  │  │ (DB + Auth)  │ │ (Push Noti)  │ │  (AI Chat/Insight)    │ │  │
│  │  └──────┬──────┘ └──────┬───────┘ └──────────┬────────────┘ │  │
│  │  ┌──────┴──────┐ ┌──────┴───────┐ ┌──────────┴────────────┐ │  │
│  │  │ chatHistory  │ │ notification │ │  aiEngine.ts          │ │  │
│  │  │  Service.ts  │ │  Service.ts  │ │  (Function Calling)   │ │  │
│  │  └─────────────┘ └─────────────┘  └───────────────────────┘ │  │
│  │  ┌─────────────┐ ┌──────────────┐                           │  │
│  │  │ memoryServ.  │ │ smartEngine  │                           │  │
│  │  │  (AI Memo)   │ │  (Insights)  │                           │  │
│  │  └─────────────┘ └──────────────┘                           │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS
          ┌───────────────┼───────────────────┐
          │               │                   │
          ▼               ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│   Supabase   │  │   Firebase   │  │  Google Gemini   │
│  PostgreSQL  │  │     FCM      │  │     API          │
│  Auth (PKCE) │  │  Push Noti   │  │  gemini-flash    │
│  Storage     │  │              │  │  Function Call   │
│  RLS Policies│  │              │  │                  │
└──────────────┘  └──────────────┘  └──────────────────┘
```

---

## 📁 Cấu Trúc Thư Mục

```
SmartLifeApp/
├── 📄 index.html                    # Entry HTML (Tailwind CDN, Inter font)
├── 📄 package.json                  # Dependencies & scripts
├── 📄 vite.config.ts                # Vite config (PWA, Proxy, Env)
├── 📄 tsconfig.json                 # TypeScript config (ES2022, React JSX)
├── 📄 tailwind.config.js            # Tailwind config
├── 📄 capacitor.config.ts           # Capacitor mobile config (com.smartlife.app)
├── 📄 vercel.json                   # Vercel deployment rewrites
├── 📄 ai_advisor_tables.sql         # SQL schema cho AI features
├── 📄 requirements.txt              # Python dependencies (FastAPI, Gemini SDK)
├── 📄 .env / .env.local             # Environment variables (API keys)
│
├── 📂 api/                          # Python Serverless Functions (Vercel)
│
├── 📂 public/                       # Static assets
│   ├── 🖼 pwa-192x192.png           # PWA icon
│   ├── 🖼 ai-feature-main.png       # Landing page AI feature image
│   ├── 📄 firebase-messaging-sw.js  # Firebase Service Worker
│   └── 📂 music/                    # Local music files
│
└── 📂 src/                          # Main source code
    ├── 📄 index.tsx                  # Entry point (ReactDOM, ErrorBoundary)
    ├── 📄 App.tsx                    # Root component (Router, State, Handlers)
    ├── 📄 types.ts                   # TypeScript interfaces & enums
    ├── 📄 constants.ts               # App constants & default data
    ├── 📄 index.css                  # Base CSS styles
    │
    ├── 📂 components/                # UI Components
    │   ├── 📄 LandingPage.tsx        # Trang giới thiệu (chưa đăng nhập)
    │   ├── 📄 Login.tsx              # Trang đăng nhập (Google OAuth + Email)
    │   ├── 📄 VisualBoard.tsx        # Dashboard tổng quan (Overview)
    │   ├── 📄 FinanceDashboard.tsx   # Quản lý tài chính (111KB - module lớn nhất)
    │   ├── 📄 CashFlowDashboard.tsx  # Phân tích dòng tiền
    │   ├── 📄 ScheduleDashboard.tsx  # Quản lý lịch trình & mục tiêu
    │   ├── 📄 CalendarWidget.tsx     # Widget lịch âm-dương
    │   ├── 📄 AIAdvisorPage.tsx      # Giao diện AI Advisor (Chat UI)
    │   ├── 📄 AIAdvisor.tsx          # AI Advisor logic component
    │   ├── 📄 InlineChatChart.tsx    # Biểu đồ inline trong chat AI
    │   ├── 📄 FocusTimer.tsx         # Focus Timer (Pomodoro)
    │   ├── 📄 FocusSpace.tsx         # Focus Space wrapper
    │   ├── 📄 MusicSpace.tsx         # Không gian nghe nhạc
    │   ├── 📄 MyStorage.tsx          # Lưu trữ cá nhân (notes, files, media)
    │   ├── 📄 Calculator.tsx         # Máy tính tiện ích
    │   ├── 📄 CurrencyInput.tsx      # Input format tiền tệ VND
    │   ├── 📄 SettingsModal.tsx       # Modal cài đặt profile
    │   ├── 📄 InsightCard.tsx        # Card hiển thị Smart Insights
    │   ├── 📄 InstallGuideModal.tsx  # Hướng dẫn cài PWA
    │   └── 📄 PWAInstallPrompt.tsx   # Prompt cài đặt PWA
    │
    ├── 📂 services/                  # Business logic & API clients
    │   ├── 📄 supabase.ts            # Supabase client (Auth, DB, Capacitor storage)
    │   ├── 📄 firebase.ts            # Firebase init (Cloud Messaging)
    │   ├── 📄 geminiService.ts       # Gemini AI API (chat, insight, context builder)
    │   ├── 📄 aiEngine.ts            # AI Function Calling engine
    │   ├── 📄 aiService.ts           # AI service utilities
    │   ├── 📄 chatHistoryService.ts  # Chat history CRUD (Supabase)
    │   ├── 📄 memoryService.ts       # AI long-term memory (auto-extract facts)
    │   ├── 📄 notificationService.ts # Push & local notifications
    │   ├── 📄 smartEngine.ts         # Behavioral analysis & Smart Insights
    │   ├── 📄 financeService.ts      # Finance utility functions
    │   └── 📄 apiClient.ts           # HTTP API client wrapper
    │
    ├── 📂 contexts/                  # React Contexts
    │   └── 📄 AuthContext.tsx         # Authentication state (Supabase Auth)
    │
    └── 📂 hooks/                     # Custom React Hooks
        └── 📄 useFocusTimer.ts       # Focus Timer hook (Pomodoro logic)
```

---

## 🔄 Luồng Hệ Thống (System Flow)

### 1. Luồng Khởi Động App

```
index.html
  └─▶ src/index.tsx (ErrorBoundary + React.StrictMode)
       └─▶ App.tsx
            └─▶ AuthProvider (Supabase session check)
                 ├─▶ [Chưa đăng nhập] → LandingPage → Login
                 └─▶ [Đã đăng nhập]   → AuthenticatedApp
                      ├─▶ Fetch data từ Supabase (7 bảng song song)
                      ├─▶ Đăng ký Firebase Messaging token
                      ├─▶ Bật Notification interval (mỗi 60s)
                      └─▶ Render UI theo activeTab
```

### 2. Luồng Xác Thực (Authentication)

```
User ────▶ Login Component
              ├─▶ Google OAuth (Supabase signInWithOAuth + PKCE)
              │    └─▶ Redirect → Supabase callback → Session token
              └─▶ Email/Password (Supabase signInWithPassword)
                   └─▶ Session token → Lưu Capacitor Preferences

AuthContext.onAuthStateChange()
  └─▶ Cập nhật user state → Re-render AuthenticatedApp
```

### 3. Luồng Quản Lý Dữ Liệu (Optimistic UI Pattern)

```
User Action (VD: Thêm giao dịch)
  │
  ├─▶ 1. Tạo tempId (Date.now())
  ├─▶ 2. Cập nhật UI ngay lập tức (Optimistic Update)
  ├─▶ 3. Gửi request INSERT vào Supabase
  │       ├─▶ ✅ Thành công: Thay tempId bằng ID thật từ server
  │       └─▶ ❌ Thất bại: Rollback UI về trạng thái trước
  │
  └─▶ Pattern áp dụng cho: transactions, goals, timetable, todos, budgets
```

### 4. Luồng AI Advisor (Function Calling)

```
User nhập câu hỏi
  │
  ├─▶ 1. buildFullContext(appState)
  │       ├─ Tài chính: Thu/chi, ngân sách, xu hướng 6 tháng
  │       ├─ Mục tiêu: Tiến độ, deadline
  │       ├─ Lịch trình: Todos, timetable
  │       └─ Hồ sơ: Tên, tuổi, nghề, lương
  │
  ├─▶ 2. Nạp AI Memory context (memoryService)
  │
  ├─▶ 3. Gửi đến Gemini API (gemini-flash-latest)
  │       ├─ System Instruction + User Data Context
  │       ├─ Chat History (conversation thread)
  │       └─ Tool Declarations (function calling schema)
  │
  ├─▶ 4. Xử lý Response
  │       ├─ Text → Render Markdown
  │       ├─ Function Call → Thực thi action
  │       │    ├─ add_transaction → handleAddTransaction()
  │       │    ├─ add_timetable → handleAddTimetable()
  │       │    ├─ add_todo → handleAddTodo()
  │       │    ├─ query_database → Supabase query
  │       │    └─ render_chart → InlineChatChart component
  │       └─ Charts → Recharts (Bar/Line chỉ, KHÔNG Pie)
  │
  ├─▶ 5. Lưu tin nhắn vào Supabase (chatHistoryService)
  │
  └─▶ 6. Background: Trích xuất memory từ hội thoại (memoryService)
```

### 5. Luồng Thông Báo (Notification)

```
App khởi động
  │
  ├─▶ Firebase: Đăng ký Service Worker + lấy FCM Token
  │    └─▶ Foreground: onMessage() → Alert
  │    └─▶ Background: firebase-messaging-sw.js
  │
  └─▶ Local Notification Engine (setInterval 60s)
       ├─▶ checkAndNotify() — Nhắc lịch trình (15 phút trước & đúng giờ)
       ├─▶ checkCalendarAndNotify() — Nhắc Rằm, Mùng 1, ngày lễ (lunar-javascript)
       ├─▶ checkGoalsAndNotify() — Nhắc mục tiêu ngẫu nhiên (9h & 15h)
       └─▶ checkCustomEventsAndNotify() — Nhắc sự kiện cá nhân
```

### 6. Luồng Smart Engine (Behavioral Analysis)

```
AppState thay đổi
  │
  └─▶ generateInsights(state)
       ├─▶ calculateSpendingVelocity()
       │    └─ So sánh tốc độ chi tiêu vs ngân sách cho phép
       │         ├─ SAFE: Chi tiêu hợp lý
       │         ├─ WARNING: Chi hơi quá tay (velocity > 1.05x)
       │         └─ DANGER: Nguy hiểm (velocity > 1.3x)
       │
       └─▶ calculateDeepWorkScore()
            └─ Phân tích lịch trình: Focus blocks, context switches
                 ├─ < 30: Lịch vụn vặt → Đề xuất gộp việc
                 └─ > 80: Tối ưu → Khen ngợi
```

---

## 🗄 Database Schema

### Supabase PostgreSQL Tables

| Bảng | Mô tả | RLS |
|---|---|---|
| `profiles` | Hồ sơ người dùng (tên, tuổi, nghề, lương, danh mục tùy chỉnh) | ✅ |
| `transactions` | Giao dịch thu/chi (amount, category, date, type) | ✅ |
| `goals` | Mục tiêu tài chính & cá nhân (target_amount, progress, deadline) | ✅ |
| `budgets` | Ngân sách theo danh mục & tháng | ✅ |
| `timetable` | Thời khóa biểu cố định (day_of_week, start_time, location) | ✅ |
| `todos` | Danh sách việc cần làm (priority, deadline, is_completed) | ✅ |
| `calendar_events` | Sự kiện cá nhân (date, time, location) | ✅ |
| `ai_conversations` | Cuộc hội thoại AI (title, timestamps) | ✅ |
| `ai_messages` | Tin nhắn AI (role, content, charts JSONB, actions JSONB) | ✅ |
| `ai_memory` | Bộ nhớ dài hạn AI (preference/fact/habit/goal_note, importance) | ✅ |

> **Bảo mật:** Tất cả bảng đều bật **Row Level Security (RLS)** — mỗi user chỉ truy cập được dữ liệu của chính mình thông qua `auth.uid() = user_id`.

---

## ⚡ Tính Năng Chính

### 🏠 Visual Board (Tổng quan)
- Dashboard tổng hợp: Số dư, chi tiêu tháng, mục tiêu
- Quick Insight AI (tóm tắt tài chính 3-4 dòng, cache 30 phút)
- Điểm Deep Work Score
- Lịch âm-dương widget

### 💰 Finance Dashboard (Tài chính)
- CRUD giao dịch thu/chi với Optimistic UI
- Biểu đồ phân tích theo danh mục (Recharts)
- Quản lý ngân sách theo tháng & danh mục
- Danh mục tùy chỉnh (lưu trong profile)
- Cash Flow Dashboard (phân tích dòng tiền)
- Export báo cáo (html2canvas)

### 📅 Schedule Dashboard (Lịch trình)
- Thời khóa biểu cố định theo ngày trong tuần
- Todo list với priority levels (urgent/focus/chill/temp)
- Focus Timer (Pomodoro) với shared state qua custom hook
- Mục tiêu với thanh tiến độ
- Tích hợp Music Space (nhạc nền khi focus)

### 🤖 AI Advisor (Trợ lý AI)
- Chat interface với Markdown rendering
- Function Calling: Truy vấn DB, thêm giao dịch/lịch/việc
- Inline charts trong phản hồi AI
- Persistent Chat History (Supabase)
- Long-term Memory (tự trích xuất facts từ hội thoại)
- API Key rotation khi bị rate limit (429)
- Request Queue (throttle 1s giữa các request)

### 🔔 Notification System
- Firebase Cloud Messaging (push khi đóng app)
- Local notifications: lịch trình, lịch âm, mục tiêu, sự kiện
- Âm thanh thông báo tùy chỉnh

### ⚙️ Khác
- PWA Install Prompt & Guide
- Multi-language (Tiếng Việt / English)
- Settings Modal (profile management)
- Capacitor ready (Android/iOS packaging)
- Error Boundary (graceful error handling)
- Confirm before close (beforeunload)

---

## 🚀 Cách Chạy Dự Án

### Prerequisites
- **Node.js** ≥ 18
- **Python** ≥ 3.9 (cho backend API, optional)

### Frontend

```bash
# 1. Cài dependencies
npm install

# 2. Cấu hình biến môi trường (.env.local)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GEMINI_API_KEY=your-gemini-api-key

# 3. Chạy dev server
npm run dev
# → Mở http://localhost:3000
```

### Backend (Python — Optional cho local)

```bash
# 1. Tạo virtual environment
python -m venv venv
source venv/bin/activate  # hoặc venv\Scripts\activate trên Windows

# 2. Cài dependencies
pip install -r requirements.txt

# 3. Chạy API server
npm run dev:backend
# → API chạy tại http://localhost:8000
# → Vite sẽ proxy /api/* sang backend
```

### Build Production

```bash
npm run build
# → Output tại /dist, deploy lên Vercel
```

---

## 📊 Tóm Tắt Tech Stack Nhanh

```
Frontend:    React 19 + TypeScript 5.8 + Vite 6.2
Styling:     TailwindCSS (CDN) + Inter Font
State:       React useState + useEffect + useContext (không Redux)
Database:    Supabase (PostgreSQL + Auth + RLS)
AI:          Google Gemini API (gemini-flash-latest)
Noti:        Firebase Cloud Messaging + Browser Notification API
Charts:      Recharts 3.6
Calendar:    lunar-javascript (âm lịch Việt)
Mobile:      PWA (Vite PWA Plugin) + Capacitor 8
Deploy:      Vercel (Frontend + Serverless Python)
Backend:     FastAPI + Uvicorn (optional serverless)
```

---

<div align="center">

**SmartLife Assistant** — *Sống thông minh hơn mỗi ngày* 🚀

</div>
