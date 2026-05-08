# SmartLife - System Architecture Context

Tài liệu này mô tả SmartLife từ góc nhìn hệ thống, kiến trúc, luồng dữ liệu và trạng thái kỹ thuật. Mục tiêu là giúp developer hoặc AI agent có context nhanh trước khi sửa code, viết tài liệu, thiết kế tính năng mới hoặc phân tích sản phẩm.

## 1. Tổng quan kiến trúc

SmartLife hiện là ứng dụng frontend-first được xây bằng React, TypeScript và Vite. Phần lớn business logic chạy ở frontend, dữ liệu lưu ở Supabase, xác thực dùng Supabase Auth, thông báo dùng Web Notification/Firebase Messaging, AI dùng Gemini API gọi từ frontend service.

Backend `/api` có dấu vết trong config nhưng chưa có implementation thực tế trong thư mục `api/`. Vì vậy trạng thái hiện tại nên hiểu là: app chính chạy bằng frontend + Supabase + external APIs, chưa phải kiến trúc frontend/backend tách lớp hoàn chỉnh.

## 2. Tech stack

- Frontend: React 19, React DOM, TypeScript, Vite.
- UI/CSS: Tailwind CSS, lucide-react icons, Lottie, responsive layout trong component.
- Data/backend service: Supabase JS, Supabase Auth, Supabase Database, Supabase Storage.
- AI: Gemini API qua `geminiService` và `aiEngine`.
- Notification: Web Notification API, Firebase Messaging, service worker `public/firebase-messaging-sw.js`.
- PWA/mobile: `vite-plugin-pwa`, Capacitor core/android/ios/preferences.
- Charts/data UI: Recharts, xlsx, html2canvas, react-number-format.
- Drag and drop: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
- Media: react-player, local public assets, Supabase Storage buckets.

## 3. Entry points và luồng khởi động

Luồng khởi động chính:

```text
index.html
  -> src/index.tsx
    -> ErrorBoundary
      -> App
        -> AuthProvider
          -> AppWrapper
            -> LandingPage | Login | AuthenticatedApp
```

`src/index.tsx` mount React app vào `#root`, bọc app trong `React.StrictMode` và `ErrorBoundary`.

`AuthProvider` trong `src/contexts/AuthContext.tsx` kiểm tra session Supabase hiện tại, lắng nghe auth state change, và expose `user`, `session`, `loading`, `signInWithGoogle`, `signInWithEmail`, `signUpWithEmail`, `signOut`.

`AppWrapper` trong `src/App.tsx` quyết định hiển thị:

- `GlobalLoader` khi auth đang loading.
- `AuthenticatedApp` khi đã đăng nhập.
- `Login` khi người dùng bấm đăng nhập.
- `LandingPage` khi chưa đăng nhập.

## 4. App shell và navigation

`AuthenticatedApp` trong `src/App.tsx` là shell chính của sản phẩm. Nó giữ `activeTab` và render module theo tab:

- `visual`: `VisualBoard`
- `finance`: `FinanceDashboard`
- `cashflow`: `CashFlowDashboard`
- `ai-advisor`: `AIAdvisorPage`
- `schedule`: `ScheduleDashboard`
- `music`: không còn là tab chính trong main render hiện tại, nhưng `MusicSpace` được tích hợp qua focus/schedule và có import.
- `gpa`: `GPADashboard`
- `habit`: `HabitDashboard`
- `admin`: `AdminDashboard` nếu email admin khớp

Sidebar desktop và bottom nav mobile đều nằm trong `App.tsx`. Pro gating cũng được xử lý tại app shell bằng `useProAccess` và `ProGateOverlay`.

## 5. Auth và Supabase client

`src/services/supabase.ts` tạo Supabase client từ:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Auth persistence dùng custom storage adapter dựa trên Capacitor Preferences:

- `Preferences.get`
- `Preferences.set`
- `Preferences.remove`

Client được cấu hình:

- `autoRefreshToken: true`
- `persistSession: true`
- `detectSessionInUrl: true`
- `flowType: 'pkce'`

Điều này phù hợp với web/mobile hybrid hơn so với chỉ dùng localStorage mặc định.

## 6. AppState và luồng dữ liệu chính

`AppState` trong `src/types.ts` là state tổng của app, gồm:

- `transactions`
- `budget`
- `budgets`
- `timetable`
- `todos`
- `goals`
- `currentBalance`
- `profile`
- `gpaSemesters`
- `gpaTargetCredits`
- `gpaTargetGPA`
- `gpaTargetSemesters`

Khi user đăng nhập, `App.tsx` fetch song song các bảng chính:

- `transactions`
- `goals`
- `timetable`
- `todos`
- `profiles`
- `calendar_events`
- `budgets`
- `gpa_semesters`
- `gpa_courses`

Sau đó app map dữ liệu vào `AppState`, gộp `gpa_courses` vào từng `gpa_semesters`, đọc thêm target GPA từ `localStorage`, và parse `profiles.custom_categories`.

Nhiều handler trong `App.tsx` dùng optimistic update: cập nhật UI trước, gọi Supabase sau, nếu lỗi thì rollback hoặc báo lỗi.

## 7. Database map

Các bảng được code gọi trực tiếp qua `supabase.from(...)`:

| Bảng | Vai trò | Trạng thái |
| --- | --- | --- |
| `profiles` | Hồ sơ user, plan, trial, custom categories, last active | `đang chạy trong luồng chính` |
| `transactions` | Giao dịch thu/chi | `đang chạy trong luồng chính` |
| `goals` | Mục tiêu cá nhân/tài chính | `đang chạy trong luồng chính` |
| `budgets` | Ngân sách theo danh mục/tháng | `đang chạy trong luồng chính` |
| `timetable` | Lịch trình/lịch học theo ngày trong tuần | `đang chạy trong luồng chính` |
| `todos` | Việc cần làm, priority, deadline, reorder | `đang chạy trong luồng chính` |
| `calendar_events` | Sự kiện cá nhân/lịch | `đang chạy trong luồng chính` |
| `gpa_semesters` | Học kỳ GPA | `đang chạy trong luồng chính` |
| `gpa_courses` | Môn học GPA | `đang chạy trong luồng chính` |
| `ai_conversations` | Conversation AI | `đang chạy trong luồng chính` |
| `ai_messages` | Message trong chat AI | `đang chạy trong luồng chính` |
| `ai_memory` | Memory cá nhân hóa cho AI | `đang chạy trong luồng chính` |
| `api_logs` | Log request AI/API | `đang chạy trong luồng chính` |
| `my_storage` | Metadata storage cá nhân | `đang chạy trong luồng chính` |
| `my_playlists` | Playlist nhạc cá nhân | `đang chạy trong luồng chính` |
| `my_tracks` | Track nhạc cá nhân | `đang chạy trong luồng chính` |
| `subscription_orders` | Đơn hàng Pro | `đang chạy trong luồng chính` |
| `countdown_items` | Sự kiện đếm ngược | `đang chạy trong luồng chính` |
| `countup_items` | Mốc đếm tiến | `đang chạy trong luồng chính` |
| `habits` | Thói quen | `đang chạy trong luồng chính` |
| `habit_logs` | Log hoàn thành thói quen | `đang chạy trong luồng chính` |

Storage buckets được code gọi:

- `my-storage`: file/image/audio/video trong `MyStorage`.
- `my-spotify`: track nhạc trong `MySpotify`.

SQL hiện có trong repo:

- `sql/countdown_habit_schema.sql`: tạo `countdown_items`, `countup_items`, `habits`, `habit_logs`, index và RLS policies.
- `sql/habit_phase3_update.sql`: cập nhật schema habits cho phase 3.
- `sql/my_spotify_schema.sql`: tạo `my_playlists`, `my_tracks`, index và RLS policies.
- `sql/subscription_schema.sql`: cập nhật `profiles`, tạo `subscription_orders`, RLS policies.
- `scripts/setup_budget_db.sql`: script setup budget.
- Root SQL: `gpa_tables.sql`, `ai_advisor_tables.sql` phục vụ GPA và AI Advisor.

## 8. Module architecture

### 8.1. Product shell

- `App.tsx`: app shell, state tổng, data fetch, CRUD handlers, navigation, Pro gating.
- `LandingPage.tsx`: trang giới thiệu trước đăng nhập.
- `Login.tsx`: đăng nhập/đăng ký.
- `GlobalLoader.tsx`: loading overlay.

### 8.2. Finance

- `FinanceDashboard.tsx`: CRUD giao dịch, danh mục, mục tiêu, ngân sách, biểu đồ.
- `CashFlowDashboard.tsx`: góc nhìn dòng tiền và phân tích tài chính.
- `CurrencyInput.tsx`, `Calculator.tsx`, `ConfirmModal.tsx`: UI phụ trợ.
- `financeService.ts`: gọi backend finance `/api` nhưng backend hiện chưa hoàn chỉnh, nên xem là legacy/placeholder.

### 8.3. Schedule, todo, focus

- `ScheduleDashboard.tsx`: timetable, todo, goal, reorder, focus mode.
- `FocusTimer.tsx`: UI timer.
- `FocusSpace.tsx`: không gian tập trung.
- `useFocusTimer.ts`: timer engine, preset, session state, localStorage persistence.

Điểm kỹ thuật quan trọng: focus state chủ yếu lưu localStorage, chưa có bảng DB focus session. Nếu cần analytics thật, cần thiết kế bảng và logging riêng.

### 8.4. GPA

- `GPADashboard.tsx`: UI quản lý học kỳ/môn học/target GPA/import.
- `gpaCalculator.ts`: logic tính điểm, GPA học kỳ, GPA tích lũy, cảnh báo học vụ, GPA cần đạt, điểm cuối kỳ cần đạt, dự báo tốt nghiệp.
- `constants.ts`: `GRADE_SCALE`, `TEMPLATE_WEIGHTS`, `WARNING_THRESHOLDS`, `GRADUATION_HONORS`, `NON_GPA_COURSES`.

GPA là module có business logic rõ và độc lập nhất trong hệ thống.

### 8.5. AI

- `AIAdvisorPage.tsx`: giao diện chat chính được nối trong app.
- `geminiService.ts`: quản lý API keys, queue/rate limit, build context, system instruction, local insight fallback.
- `aiEngine.ts`: function calling, tool declarations, query database, add timetable, add todo, add transaction, calculate/simulate GPA, log API usage.
- `chatHistoryService.ts`: lưu conversation/message vào `ai_conversations`, `ai_messages`.
- `memoryService.ts`: lưu và đọc `ai_memory`.
- `InlineChatChart.tsx`: render chart trong chat.
- `AIAdvisor.tsx`: component cũ, không phải luồng chính hiện tại.
- `aiService.ts`: gọi `/api/ai`, hiện nên xem là legacy/placeholder do `/api` chưa có backend.

### 8.6. Visual, storage và media

- `VisualBoard.tsx`: dashboard tổng quan và điểm điều hướng nhanh.
- `MyStorage.tsx`: lưu note/link/file/image/audio/video, dùng `my_storage` và bucket `my-storage`.
- `MusicSpace.tsx`: không gian nghe nhạc/focus dùng public assets.
- `MySpotify.tsx`: playlist/track cá nhân, dùng `my_playlists`, `my_tracks`, bucket `my-spotify`.
- `useAudioPlayer.ts`: audio player hook.

### 8.7. Habit và countdown

- `HabitDashboard.tsx`: countdown, count-up, habit, habit log.
- `notificationService.ts`: có hàm kiểm tra habit từ DB để gửi notification.
- SQL chính: `sql/countdown_habit_schema.sql`, `sql/habit_phase3_update.sql`.

### 8.8. Notification và PWA

- `notificationService.ts`: xin quyền notification, nhắc timetable, calendar event, goals, custom events, habits.
- `firebase.ts`: init Firebase app và messaging.
- `public/firebase-messaging-sw.js`: service worker Firebase Messaging.
- `vite.config.ts`: cấu hình PWA bằng `vite-plugin-pwa`, tắt auto-register để tránh conflict với Firebase service worker.

### 8.9. Subscription và admin

- `useProAccess.ts`: tính quyền Pro, trial, grace period, lifetime.
- `subscriptionService.ts`: plan config, tạo order, đọc pending order, xác nhận, cancel, revert, setup trial.
- `PricingModal.tsx`, `InvoiceModal.tsx`, `ProGateOverlay.tsx`: UI payment/access.
- `AdminDashboard.tsx`: dashboard vận hành cho admin email hard-code.

## 9. AI pipeline chi tiết

Luồng AI chính:

```text
AIAdvisorPage
  -> user message
  -> aiEngine hoặc geminiService
  -> build context từ AppState
  -> gọi Gemini API
  -> có thể gọi tool/function
  -> ghi chat history, memory hoặc api_logs
  -> render response/chart/action trong UI
```

Context được build từ:

- tài chính: giao dịch, tổng thu/chi, danh mục, ngân sách.
- mục tiêu: title, deadline, progress, priority.
- lịch trình/todo: timetable, deadline, trạng thái hoàn thành.
- profile: tên, tuổi, nghề/trường, salary, currency.
- GPA: học kỳ, môn học, tín chỉ, điểm, GPA mục tiêu.

Function calling trong `aiEngine.ts` hỗ trợ các hành động như:

- `query_database`: truy vấn dữ liệu app theo ngữ cảnh cho phép.
- `add_timetable`: thêm lịch.
- `add_todo`: thêm việc cần làm.
- `add_transaction`: thêm giao dịch.
- `calculate_needed_gpa`: tính GPA cần đạt.
- `simulate_gpa`: mô phỏng GPA.

Giới hạn cần nhớ: AI đang chạy ở frontend service và phụ thuộc API key trong env. Nếu sản phẩm public/scale lớn, nên chuyển phần gọi AI sang backend để bảo vệ key, kiểm soát quota và logging tốt hơn.

## 10. LocalStorage và client-side state

Các nhóm dữ liệu còn nằm nhiều ở client:

- Focus timer state trong `useFocusTimer`.
- Trạng thái bật/tắt notification.
- Một số settings của `SettingsModal`.
- Target GPA/tín chỉ/mục tiêu học kỳ trong `App.tsx`.
- Một số state UI của calendar/visual.

Điều này ổn cho MVP nhưng không đủ nếu muốn phân tích hành vi đa người dùng, đồng bộ nhiều thiết bị hoặc nghiên cứu khoa học có số liệu chính xác.

## 11. Backend/API status

**Trạng thái:** `có trong code nhưng chưa nối hoàn chỉnh`

Các dấu hiệu có backend:

- `package.json` có `dev:backend`: `uvicorn api.index:app --host 0.0.0.0 --port 8000 --reload`.
- `vite.config.ts` proxy `/api` sang `http://127.0.0.1:8000`.
- `vercel.json` rewrite `/api/(.*)` sang `/api/index.py`.
- `apiClient.ts`, `aiService.ts`, `financeService.ts` gọi `/api`.

Thực tế hiện tại:

- Thư mục `api/` không có file backend.
- Luồng app chính vẫn chạy dựa trên frontend + Supabase + Gemini/Firebase.

Kết luận kỹ thuật: không nên mô tả SmartLife hiện tại là hệ thống full-stack FastAPI hoàn chỉnh. Nên ghi là có định hướng/di tích backend nhưng implementation chưa hiện diện.

## 12. Security, privacy và vận hành

Các điểm cần chú ý nếu mở rộng sản phẩm:

- AI API key không nên để frontend gọi trực tiếp trong production quy mô lớn.
- Admin email đang hard-code trong `App.tsx`; nên thay bằng role/permission trong DB.
- MyStorage render note có thể cần sanitize HTML.
- File upload cần kiểm soát MIME type, size, virus scanning nếu dùng thật.
- Dữ liệu sinh viên/GPA/tài chính là dữ liệu nhạy cảm; cần consent, privacy policy và cơ chế xóa dữ liệu.
- RLS policies đã có trong một số SQL module, nhưng cần rà soát đầy đủ cho toàn bộ bảng đang dùng.

## 13. Trạng thái kiểm thử

Repo hiện không thể hiện test suite rõ trong `package.json`. Script chính là:

- `dev`
- `dev:frontend`
- `dev:backend`
- `build`
- `preview`

Vì chưa có test command riêng, kiểm thử hiện phù hợp nhất là:

- `npm run build` để kiểm tra TypeScript/Vite build.
- test thủ công các flow auth, CRUD, AI, GPA, Pro gate, upload file, notification.
- bổ sung test unit cho `gpaCalculator.ts` trước vì đây là module logic thuần, có nhiều edge case và dễ tách test.

## 14. Định hướng cải tiến kiến trúc

Các bước cải tiến hợp lý:

- Tạo backend thật cho `/api` hoặc xóa các dấu vết `/api` nếu không dùng nữa.
- Chuyển AI calls sang backend để bảo vệ key và quản lý quota.
- Thêm bảng `focus_sessions` nếu muốn phân tích thời gian tập trung.
- Chuẩn hóa event logging cho behavioral analytics: task completed, focus started/ended, budget exceeded, AI used, GPA updated.
- Thêm role admin trong database thay vì hard-code email.
- Viết test cho `gpaCalculator`, `subscriptionService`, `aiEngine` tool execution và các CRUD service quan trọng.
- Tạo migration tổng hợp hoặc Supabase schema docs để tránh schema nằm rải rác ở nhiều file SQL.

## 15. File map nhanh

```text
src/
  App.tsx                         app shell, routing/tab, state, CRUD handlers
  index.tsx                       React entrypoint + ErrorBoundary
  types.ts                        domain types
  constants.ts                    categories, GPA constants, AI prompt template
  contexts/AuthContext.tsx        Supabase auth context
  components/                     UI modules
  hooks/                          focus timer, pro access, audio player
  services/                       Supabase, AI, notification, subscription, GPA logic
sql/                              schema for habit, spotify, subscription
scripts/                          setup scripts
public/                           PWA icons, Firebase SW, images, music assets
api/                              currently empty
```

## 16. AI Context Summary

SmartLife là React/TypeScript/Vite PWA với Supabase làm data/auth layer, Firebase Messaging cho thông báo, Gemini cho AI Advisor, và nhiều module self-management cho sinh viên. `App.tsx` là trung tâm điều phối state và CRUD; `AuthContext` quản lý Supabase session; `supabase.ts` dùng Capacitor Preferences để persist session. Các module chính đang chạy gồm VisualBoard, Finance, CashFlow, Schedule/Todo/Goal, FocusTimer, MusicSpace, MySpotify, GPA, AIAdvisorPage, HabitDashboard, MyStorage, Settings, Pro subscription và Admin. Dữ liệu chính nằm trong Supabase tables được code gọi trực tiếp: `profiles`, `transactions`, `goals`, `budgets`, `timetable`, `todos`, `calendar_events`, `gpa_semesters`, `gpa_courses`, `ai_conversations`, `ai_messages`, `ai_memory`, `api_logs`, `my_storage`, `my_playlists`, `my_tracks`, `subscription_orders`, `countdown_items`, `countup_items`, `habits`, `habit_logs`. Cần đặc biệt nhớ rằng `/api` backend hiện rỗng dù config/scripts vẫn nhắc đến FastAPI, một số service là legacy, FocusTimer còn lưu localStorage, và behavioral analytics chưa hoàn chỉnh.
