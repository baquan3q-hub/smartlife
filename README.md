# 🚀 SmartLife - Siêu Ứng Dụng Quản Trị Học Tập & Đời Sống Sinh Viên Toàn Diện

> **SmartLife** là một Super App (Siêu ứng dụng) đa phân hệ được thiết kế đặc thù nhằm giải quyết các bài toán thiết thực của sinh viên và người tự học trong kỷ nguyên số. Ứng dụng tích hợp sâu sắc giữa quản lý học vụ (GPA VNU), định hướng nghề nghiệp dựa trên tính cách (MBTI/DISC) bằng trí tuệ nhân tạo (Gemini AI), thiết lập và kết xuất CV tự động chuẩn ATS, quản lý chi tiêu toán học thông minh, rèn luyện thói quen, không gian tập trung Pomodoro, nhật ký cảm xúc có khóa bảo mật mã PIN và **Ví tài liệu số cá nhân** tích hợp.

---

## 🌟 Giá Trị Đột Phá & Triết Lý Sản Phẩm

Thách thức lớn nhất đối với sinh viên hiện đại không phải là thiếu công cụ quản lý, mà là **sự rời rạc, phân mảnh của thông tin**. Khi phải quản lý học tập trên một app, ghi chép chi tiêu trên một app khác, và viết nhật ký hay rèn luyện thói quen ở các công cụ rời rạc, họ sẽ mất đi bức tranh toàn cảnh về bản thân.

SmartLife ra đời với 3 giá trị cốt lõi:
1. **Liên thông Dữ liệu (Unified Ecosystem):** Dữ liệu học tập (GPA) kết hợp với bài test tính cách (MBTI, DISC) để làm đầu vào cho Cố vấn AI; dữ liệu tài chính cảnh báo hạn mức dựa trên mức lương/chi tiêu thực tế.
2. **Bảo mật tối đa (High Security by RLS):** Các thông tin nhạy cảm như Nhật ký cá nhân, ảnh Căn cước công dân (CCCD), Thẻ sinh viên được bảo vệ nghiêm ngặt bằng cơ chế Row Level Security (RLS) của Supabase và mã hóa mật khẩu PIN cục bộ.
3. **Trải nghiệm Premium (Premium UX/UI):** Ngôn ngữ thiết kế Glassmorphism hiện đại, tối ưu hóa kích thước thanh cuộn, hiệu ứng phóng to thẻ khi chọn và chuyển động vi mô (Micro-animations) mang lại giao diện sống động, cao cấp.

---

## 🛠️ Bản Đồ Tính Năng Cốt Lõi (10 Core Modules)

### 1. 📊 Hệ Thống GPA VNU & Quản Lý Học Vụ
* Tích hợp quy chế đào tạo tín chỉ mới nhất của Đại học Quốc gia Hà Nội (ĐHQGHN - VNU).
* Quy đổi điểm số hệ 10 sang điểm chữ (A+, A, B...) và hệ số 4 chính xác.
* Mô phỏng và lập kịch bản điểm số mục tiêu (GPA Projection) để tính toán điểm số tối thiểu cần đạt ở các học kỳ còn lại nhằm đạt bằng Khá/Giỏi/Xuất sắc khi tốt nghiệp.

### 2. 🤖 Cố Vấn Sự Nghiệp AI (AI Career Coach)
* Đọc dữ liệu điểm số thực tế từ GPA Tracker phối hợp cùng thông tin MBTI/DISC để đưa ra phân tích thế mạnh, điểm yếu.
* AI đề xuất chi tiết 3 vị trí công việc phù hợp nhất kèm theo roadmap học tập các kỹ năng bổ trợ cụ thể.

### 3. 📄 Xây Dựng CV Tự Động Chuẩn ATS (Auto CV Builder)
* Đồng bộ trực tiếp kết quả học tập từ GPA Dashboard sang CV.
* Hỗ trợ biên soạn thông tin cá nhân, kinh nghiệm, dự án, chứng chỉ và xuất bản tệp PDF chuẩn ATS chuyên nghiệp chỉ trong một click.

### 4. 💳 Quản Lý Tài chính & Máy Tính Số Học (Finance Dashboard)
* Ghi chép chi tiêu/thu nhập với danh mục đa dạng, tự động gán icon và màu sắc phù hợp dựa trên phân tích từ khóa tiếng Việt.
* Tích hợp bộ giải biểu thức toán học trực tiếp trong ô nhập số tiền (hỗ trợ các toán tử `+`, `-`, `*`, `/`, viết tắt `k`, `tr`, `m`, `t` như `50k + 1.5tr`).
* Tích hợp bàn phím toán học ảo trượt lên mượt mà (Custom Keypad) độc quyền.
* **Quản lý Ví tài chính & Quỹ chi tiêu mục đích**: Tạo và theo dõi số dư các tài khoản thực tế (tiền mặt, thẻ ngân hàng, ví điện tử) cùng quỹ mục đích riêng biệt (quỹ du lịch, tiết kiệm, học tập...).
* **Chuyển tiền nội bộ (Internal Transfer)**: Cho phép thực hiện chuyển tiền qua lại linh hoạt giữa các tài khoản thanh toán và các quỹ chi tiêu.
* **Sổ ghi nợ & Vay mượn mini (Debtor Ledger)**: Ghi chép lịch sử vay mượn nợ và hỗ trợ tự động khấu trừ/cộng vào số dư tài khoản/ví được liên kết khi thu nợ hoặc trả nợ.
* **Hiển thị số dư nhanh trên di động**: Tiện ích Ví & Quỹ trên điện thoại tự động hiển thị số dư thực tế khả dụng cho từng loại (Ví/Quỹ) giúp theo dõi nhanh chóng.

### 5. 📂 Ví Tài Liệu Số Cá Nhân & Thay Ảnh Đại Diện (New ✨)
* **Tải ảnh đại diện trực tiếp**: Người dùng có thể chạm vào ảnh đại diện trong phần Cài đặt để chụp hoặc chọn ảnh từ thiết bị, hệ thống tự động nén chất lượng cao.
* **Ví tài liệu số ngay trên đầu Cài đặt**: Lưu trữ hình ảnh mã QR (Thanh toán/Cá nhân), Thẻ sinh viên và Căn cước công dân (CCCD) để xem nhanh lúc cần thiết.
* **Xem chi tiết tài liệu (Lightbox modal)**: Bấm vào tài liệu sẽ mở Pop-up zoom lớn rõ nét, hỗ trợ thay đổi hoặc xóa bảo mật.

### 6. 📅 Thời Khóa Biểu & Xuất Ảnh Tiện Ích
* Lên lịch học cố định theo thứ trong tuần, theo dõi phòng học và giảng viên.
* Cho phép xuất thời khóa biểu thành file ảnh PNG độ phân giải cao để sinh viên cài làm hình nền điện thoại tiện tra cứu.

### 7. ⏱️ Không Gian Tập Trung Pomodoro & Âm Nhạc
* Đồng hồ Pomodoro đếm ngược hỗ trợ quản lý thời gian học tập tập trung hiệu quả.
* Tích hợp kho âm thanh nền thư giãn (tiếng mưa rơi, sóng biển, tiếng ồn trắng) và Widget Spotify kết nối thư viện nhạc không giới hạn.

### 8. 🔒 Nhật Ký Chữa Lành Bảo Mật (Healing Journal)
* Ghi chép cảm xúc, chấm điểm tâm trạng hàng ngày (Mood Tracker) và viết lời biết ơn.
* Hệ thống bảo mật mã PIN riêng biệt (Journal PIN Guard), ngăn chặn truy cập nhật ký ngay cả khi thiết bị đã được mở khóa.

### 9. 🎯 Rèn Luyện Thói Quen (Habit Tracker) & Vòng Đời Thử Thách
* Theo dõi thói quen hàng ngày với cơ chế tính chuỗi ngày liên tục (Streak).
* Tích lũy điểm thưởng StarBrain khi hoàn thành thói quen để đổi các phần thưởng động lực tự thiết lập.

### 10. 💾 Kho Lưu Trữ Trực Quan (My Storage)
* Lưu trữ các liên kết tài liệu tham khảo, bài báo khoa học, ghi chú nhanh hoặc hình ảnh học tập vào một bảng điều khiển trung tâm.

---

## 💻 Công Nghệ Sử Dụng (Tech Stack)

* **Core Framework:** React (TypeScript) + Vite mang lại tốc độ phản hồi cực nhanh dưới local.
* **Styling System:** TailwindCSS phối hợp Vanilla CSS tùy biến các hiệu ứng Glassmorphic, thanh cuộn mỏng `.custom-scrollbar` rộng 5px và hoạt ảnh trượt/zoom.
* **Database & Auth:** Supabase (PostgreSQL) hỗ trợ quản lý dữ liệu thời gian thực và quản lý tài khoản người dùng.
* **AI Integration:** Google Gemini AI API cung cấp khả năng phân tích dữ liệu học thuật và tư vấn định hướng.
* **Cử chỉ & Drag-Drop:** `@dnd-kit/core` cho các thao tác kéo thả việc cần làm trực quan.
* **Export Utilities:** `html2canvas` và `jspdf` để kết xuất tệp tin hình ảnh/PDF trực tiếp từ client.

---

## 📁 Cấu Trúc Thư Mục Dự Án (Project Structure)

Sơ đồ cấu trúc mã nguồn chính trong thư mục `src/`:
```bash
src/
├── App.tsx             # Luồng điều hướng chính, xử lý Deep Link và State đồng bộ hóa
├── index.tsx           # Điểm khởi chạy ứng dụng (Entry point)
├── index.css           # Cấu hình hệ thống thiết kế CSS, các biến màu sắc, hoạt ảnh, thanh cuộn
├── types.ts            # Định nghĩa toàn bộ kiểu dữ liệu TypeScript (Profile, Goal, Todo,...)
├── constants.ts        # Các preset cấu hình ban đầu, danh mục thu chi, và hằng số hệ thống
│
├── components/         # Chứa toàn bộ các thành phần giao diện của ứng dụng
│   ├── LandingPage.tsx       # Trang chủ giới thiệu sản phẩm với các hiệu ứng chuyển động kép
│   ├── VisualBoard.tsx       # Bảng điều khiển tổng quan tích hợp widget AI và Spotify
│   ├── AIAdvisor.tsx         # Thành phần chat nổi với AI Advisor
│   ├── AIAdvisorPage.tsx     # Trang phân tích chi tiết của Trợ lý AI Tài chính & Học tập
│   ├── GPACareerTab.tsx      # Giao diện Cố vấn sự nghiệp AI (GPA + MBTI/DISC)
│   ├── CVBuilder.tsx         # Trình tạo CV và xuất PDF chuyên nghiệp
│   ├── FinanceDashboard.tsx  # Trang quản lý thu chi và tài chính (Bàn phím tính toán và nén ảnh)
│   ├── ScheduleDashboard.tsx # Trang quản lý thời khóa biểu tuần và To-Do List (Dnd)
│   ├── JournalDashboard.tsx  # Nhật ký chữa lành và theo dõi tâm trạng
│   ├── JournalPinGuard.tsx   # Hệ thống khóa mã PIN bảo mật cho nhật ký
│   ├── HabitDashboard.tsx    # Bảng rèn luyện thói quen và tính toán streak
│   ├── MySpotify.tsx         # Widget tích hợp ứng dụng nghe nhạc Spotify
│   ├── MyStorage.tsx         # Bảng lưu trữ file tài liệu và ghi chú cá nhân
│   ├── FocusTimer.tsx        # Bộ bấm giờ Pomodoro và âm thanh thư giãn
│   └── SettingsModal.tsx     # Modal cài đặt cá nhân hóa, đổi ngôn ngữ, tải lên avatar và ví tài liệu
│
├── services/           # Lớp kết nối API, dịch vụ tính toán và Supabase
│   ├── supabase.ts           # Cấu hình Supabase client kết nối cơ sở dữ liệu
│   ├── geminiService.ts      # Dịch vụ tích hợp Google Gemini AI
│   ├── aiEngine.ts           # Bộ xử lý prompt thông minh cho tư vấn Tài chính & Sức khỏe tinh thần
│   ├── careerGoalService.ts  # Bộ xử lý gợi ý công việc dựa trên khảo sát tính cách và GPA
│   ├── cvService.ts          # Xử lý dữ liệu CV và xuất tệp tin
│   ├── gpaCalculator.ts      # Bộ logic quy đổi điểm và kịch bản mục tiêu GPA VNU
│   ├── walletService.ts      # Quản lý số dư, tạo/sửa ví và quỹ và chuyển tiền nội bộ
│   ├── debtService.ts        # Quản lý các khoản vay/nợ, trả nợ và khấu trừ tự động
│   └── ...                   # Quản lý lịch trình, thông báo, nhật ký...
│
├── hooks/              # Custom React hooks dùng chung
│   ├── useAudioPlayer.ts     # Trình phát nhạc nền tập trung
│   ├── useFocusTimer.ts      # Quản lý trạng thái đếm giờ Pomodoro
│   ├── useProAccess.ts       # Kiểm tra quyền tài khoản Premium
│   └── useTaskTracker.ts     # Bộ đếm giờ thực hiện công việc (Todo time spent)
│
└── i18n/               # Cấu hình đa ngôn ngữ (Tiếng Việt, Tiếng Anh, Tiếng Hàn)
```

---

## 💎 Hệ Thống Gói Dịch Vụ & Giới Hạn Tính Năng (Pricing & Gating)

SmartLife triển khai mô hình Freemium phối hợp các gói đăng ký trả phí tối ưu chi phí dành cho sinh viên Việt Nam:

### 1. Các Gói Dịch Vụ
- 🔥 **Khám phá (1 tháng)**: 59.000đ
- ⭐ **Nghiêm túc (3 tháng)**: 139.000đ (tiết kiệm 21%)
- 💎 **Quyết tâm (6 tháng)**: 239.000đ (tiết kiệm 33%)
- 👑 **Đỉnh cao (12 tháng)**: 399.000đ (tiết kiệm 44% - *Phổ biến*)
- 🎓 **Sinh viên chăm chỉ (4 năm)**: 499.000đ (tiết kiệm 82% - **BEST VALUE** - Chỉ ~10.000đ/tháng)

### 2. Chính Sách Giới Hạn Tính Năng (Feature Gating)
- **Nhật ký cá nhân (Healing Journal)**: Tính năng PRO. Người dùng Free cần nâng cấp để truy cập (hiển thị giao diện chặn `ProGateOverlay`).
- **Theo dõi thói quen (Habit Tracker)**: Tài khoản Free giới hạn tối đa **3 thói quen hoạt động**. Khi thêm thói quen thứ 4 cần nâng cấp Pro.
- **Tính năng mở khóa Pro**: Cố vấn AI cá nhân hóa (AI Advisor), Cố vấn nghề nghiệp AI (AI Career Coach), Tạo CV ATS xuất PDF, Kế hoạch GPA 5 năm (GPA Projections).
- **Các tính năng Free hoàn toàn**: Visual Board (Dashboard tổng quan), Thời khóa biểu (Timetable), Quản lý tài chính (Finance - Ví/Quỹ, Sổ nợ, Chuyển khoản), Focus Timer Pomodoro & Music Space.

Chi tiết về kỹ thuật giới hạn quota, AI Boost Packs và sơ đồ cơ sở dữ liệu có sẵn tại [Tài liệu chính sách giá Pricing](file:///c:/Users/84923/OneDrive/Máy tính/online-learning-web ( final e learn )/SmartLifeApp/docs/PRICING.md).

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Dưới Local

### Yêu cầu hệ thống:
* **Node.js** (Phiên bản 18 trở lên)
* **npm** hoặc **yarn**

### Các bước thực hiện:

1. **Tải mã nguồn và cài đặt thư viện:**
   ```bash
   npm install
   ```

2. **Cấu hình biến môi trường:**
   Tạo file `.env.local` tại thư mục gốc và thiết lập các khóa API của bạn:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

   # Gemini API Key (server-side only — KHÔNG có prefix VITE_)
   GEMINI_API_KEYS=your_gemini_api_key
   ```
   > ⚠️ **Lưu ý bảo mật:** `GEMINI_API_KEYS` **không có prefix `VITE_`** để Vite không embed key vào client bundle. Key chỉ được đọc bởi Vercel Serverless Function (`/api/gemini.js`). Khi deploy lên Vercel, hãy thêm `GEMINI_API_KEYS` vào **Vercel Dashboard → Settings → Environment Variables**.

3. **Chạy ứng dụng trong chế độ Development:**
   ```bash
   npm run dev
   ```
   Ứng dụng sẽ chạy tại địa chỉ mặc định: `http://localhost:5173`.

4. **Biên dịch dự án (Build):**
   ```bash
   npm run build
   ```

---

## 🛡️ Thiết Kế Cơ Sở Dữ Liệu & Bảo Mật Row Level Security (RLS)

Dữ liệu của người dùng được lưu trữ an toàn trong PostgreSQL trên Supabase.
Các file schema SQL dùng để khởi tạo cơ sở dữ liệu nằm trong thư mục gốc và thư mục `sql/`:
* `supabase_schema.sql`: Khởi tạo bảng hồ sơ người dùng `profiles` và các chức năng tài chính cơ bản.
* `sql/add_documents_columns.sql`: Thêm các cột lưu trữ ảnh đại diện, QR và ảnh tài liệu (CCCD/Thẻ SV) mã hóa Base64 dưới dạng text tối ưu.
* `sql/add_ai_personalization_columns.sql`: Cập nhật các trường thông tin MBTI/DISC cá nhân hóa AI.
* `sql/journal_schema.sql`: Định nghĩa bảng nhật ký số và kích hoạt khóa mã PIN.
* `sql/wallet_debt_schema.sql`: Định nghĩa các bảng `wallets`, `debts`, và `debt_repayments` cho hệ thống Ví tài chính, Quỹ chi tiêu, Chuyển khoản nội bộ, và Sổ ghi nợ mini liên kết dòng tiền.

### Cơ chế bảo mật RLS:
Bảng `profiles` được bảo vệ nghiêm ngặt:
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cho phép người dùng quản lý hồ sơ cá nhân" ON profiles
  FOR ALL USING (auth.uid() = id);
```
Điều này đảm bảo rằng **chỉ chính bạn** (người dùng đã đăng nhập thành công) mới có thể đọc hoặc ghi đè ảnh CCCD, Thẻ SV và thông tin cá nhân của mình, ngăn chặn hoàn toàn rò rỉ dữ liệu chéo giữa các người dùng.
