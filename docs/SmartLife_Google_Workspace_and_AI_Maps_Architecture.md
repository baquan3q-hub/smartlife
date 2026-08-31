# SmartLife Architecture & Strategy: Google Workspace Ecosystem & AI Maps Assistant

> **Tài liệu Phân Tích & Kế Hoạch Triển Khai Kiến Trúc Phần Mềm (Software Architecture Design)**  
> **Phiên bản:** 2.5 — **Tác giả:** Lead Software Architect  
> **Ngày lập:** 31/08/2026  
> **Mục tiêu:** Nâng tầm SmartLife thành Siêu ứng dụng cá nhân hóa với trải nghiệm Google Workspace trực quan (Calendar & Sheets) kết hợp Trợ lý Bản đồ AI (Google Maps Realtime Location).

---

## 📑 MỤC LỤC

1. [Tầm Nhìn & Đặc Tả Yêu Cầu (Vision & Requirements)](#1-tầm-nhìn--đặc-tả-yêu-cầu-vision--requirements)
2. [Phân Tích Chi Tiết 3 Trụ Cột Nâng Cấp](#2-phân-tích-chi-tiết-3-trụ-cột-nâng-cấp)
   - [2.1. Google Calendar: Trải Nghiệm Ứng Dụng Thứ Hai (100% Two-Way Sync, Minimalist UI)](#21-google-calendar-trải-nghiệm-ứng-dụng-thứ-hai-100-two-way-sync-minimalist-ui)
   - [2.2. Google Sheets: Cơ Sở Dữ Liệu Ngoài Đa Năng (External Database & Sheet Editor)](#22-google-sheets-cơ-sở-dữ-liệu-ngoài-đa-năng-external-database--sheet-editor)
   - [2.3. AI Maps Assistant: Trợ Lý Định Vị & Tìm Kiếm Địa Điểm Thông Minh (Realtime Geolocation)](#23-ai-maps-assistant-trợ-lý-định-vị--tìm-kiếm-địa-điểm-thông-minh-realtime-geolocation)
3. [Đánh Giá Tính Khả Thi Kỹ Thuật (Technical Feasibility)](#3-đánh-giá-tính-khả-thi-kỹ-thuật-technical-feasibility)
4. [Đánh Giá Chi Phí Vận Hành & Quotas (Cost & Quota Analysis)](#4-đánh-giá-chi-phí-vận-hành--quotas-cost--quota-analysis)
5. [Phân Tích Rủi Ro & Biện Pháp Giảm Thiểu (Risk & Mitigation Matrix)](#5-phân-tích-rủi-ro--biện-pháp-giảm-thiểu-risk--mitigation-matrix)
6. [Giá Trị & Lợi Ích Cạnh Tranh (User & Business Value)](#6-giá-trị--lợi-ích-cạnh-tranh-user--business-value)
7. [Kế Hoạch & Lộ Trình Triển Khai Từng Phase (Step-by-Step Implementation Roadmap)](#7-kế-hoạch--lộ-trình-triển-khai-từng-phase-step-by-step-implementation-roadmap)

---

## 1. TẦM NHÌN & ĐẶC TẢ YÊU CẦU (VISION & REQUIREMENTS)

### 🎯 1.1. Bối cảnh & Bài toán
SmartLife đã xây dựng thành công:
- **Kanban Board** kết nối đồng bộ 2 chiều với **Google Tasks**.
- Quản lý tài chính, GPA, thói quen, nhật ký và kho lưu trữ.
- Trợ lý AI tích hợp Function Calling thông minh.

Tuy nhiên, người dùng hiện đại không muốn phải chuyển đổi qua lại giữa quá nhiều ứng dụng rời rạc. Ba nhu cầu trọng tâm được đặt ra:
1. **Google Calendar tích hợp hoàn chỉnh như 1 app độc lập trên SmartLife:** Đồng bộ 100% lịch Google, nhưng giao diện phải tinh gọn, sang trọng, trực quan và dễ sử dụng hơn chính Google Calendar gốc.
2. **Lưu trữ dữ liệu có cấu trúc trên 1 file Google Sheets:** Cho phép người dùng sở hữu dữ liệu của mình trên Google Drive cá nhân, xem và chỉnh sửa trực tiếp trên giao diện bảng tính (Spreadsheet).
3. **Trợ lý AI tích hợp Google Maps & Định vị thời gian thực:** Giúp đỡ người dùng tức thì trong các tình huống thực tế đời sống (tìm quán ăn, cây xăng, quán cà phê học bài, cứu hộ xe máy/ô tô, tiệm sửa xe gần nhất).

---

## 2. PHÂN TÍCH CHI TIẾT 3 TRỤ CỘT NÂNG CẤP

```
+----------------------------------------------------------------------------------------------------+
|                                    SMARTLIFE ECOSYSTEM v2.5                                        |
|                                                                                                    |
|  +-----------------------+     +-----------------------+     +----------------------------------+  |
|  |    GOOGLE CALENDAR    |     |     GOOGLE SHEETS     |     |        AI MAPS ASSISTANT         |  |
|  |     (SmartLife 2nd)   |     |    (External Store)   |     |    (Realtime Geolocation Engine) |  |
|  +-----------------------+     +-----------------------+     +----------------------------------+  |
|  | * 100% 2-Way Sync     |     | * Auto-Created Sheet  |     | * Realtime GPS Lat/Lng           |  |
|  | * Day/Week/Month Grid |     | * 3 Tabs: Notes, Quick|     | * Places Search: Cây xăng,       |  |
|  | * Minimalist Dark/Lite|     |   Notes, AI Summaries |     |   Quán ăn, Cafe, Sửa xe, Cứu hộ  |  |
|  | * Weekly Timetable    |     | * In-App Sheet Viewer |     | * Smart Route & 1-Click Navigate |  |
|  |   Recurring Events    |     | * Direct Edit & Export|     | * Interactive Map Cards in Chat  |  |
|  +-----------------------+     +-----------------------+     +----------------------------------+  |
|              \                             |                             /                         |
|               \                            |                            /                          |
|                v                           v                           v                           |
|  +-----------------------------------------------------------------------------------------------+  |
|  |                         UNIFIED AUTH & GOOGLE API INTEGRATION LAYER                           |  |
|  |    (Supabase Provider Token + Google Identity Services SDK + Google Cloud REST Clients)       |  |
|  +-----------------------------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------------------------+
```

---

### 2.1. Google Calendar: Trải Nghiệm Ứng Dụng Thứ Hai (100% Two-Way Sync, Minimalist UI)

#### ✨ Đặc điểm Thiết Kế (Design Philosophy):
* **Tối giản hơn Google Calendar:** Loại bỏ các thanh menu cồng kềnh, tập trung vào không gian hiển thị sự kiện với phong cách **Glassmorphism**, Typography hiện đại (Inter / Outfit), màu sắc mã hóa theo phân loại sự kiện (Học tập, Công việc, Cá nhân, Deadline).
* **Đa chế độ xem linh hoạt (Flexible Views):**
  1. **Chế độ Tuần (Week Grid / Timetable View):** Tối ưu cho sinh viên và người đi làm, hiển thị các khung giờ vàng từ 06:00 đến 23:00 rõ ràng, hỗ trợ kéo thả sự kiện.
  2. **Chế độ Tháng (Month View):** Lịch ma trận tháng tích hợp Lịch Âm (Lunar Solar) siêu mượt, chấm màu hiển thị mật độ sự kiện trong ngày.
  3. **Chế độ Lộ trình Ngày (Day Agenda / Roadmap):** Dòng thời gian cuộn dọc liên tục theo thời gian thực (Red Timeline Bar).
  4. **Chế độ Danh sách (List View):** Lọc theo ngày, tuần, tháng với thanh tìm kiếm nhanh.

#### 🔄 Cơ chế Đồng Bộ 100% Hai Chiều (Full Two-Way Sync Engine):
* **Tất cả các Lịch (All Calendars Support):** Cho phép người dùng chọn xem toàn bộ các Lịch trên tài khoản Google (Primary, Lịch làm việc, Lịch sinh nhật, hoặc Lịch riêng `SmartLife Schedule`).
* **Instant Mutation Push (SmartLife $\rightarrow$ Google Calendar):**
  * Thêm/Sửa/Xóa sự kiện trên SmartLife $\rightarrow$ Gọi REST API cập nhật tức thì trên Google Calendar trong < 300ms.
  * Hỗ trợ sự kiện đơn lẻ (`Single Event`) và sự kiện lặp lại định kỳ (`Recurring Event` với chuẩn `RRULE:FREQ=WEEKLY;BYDAY=...`).
* **Live Inbound Pull (Google Calendar $\rightarrow$ SmartLife):**
  * Tự động kéo các sự kiện mới tạo trên Google Calendar điện thoại/web về SmartLife mỗi khi mở tab hoặc qua chu kỳ đồng bộ 60s.
  * Hỗ trợ xóa/sửa trên Google Calendar tự động phản ánh ngược về SmartLife.

---

### 2.2. Google Sheets: Cơ Sở Dữ Liệu Ngoài Đa Năng (External Database & Sheet Editor)

#### 📊 Cấu trúc File Bảng Tính Tập Trung (`SmartLife Data Hub`):
Ứng dụng tự động quản lý một file Spreadsheet duy nhất trên Google Drive của người dùng mang tên:  
👉 **`SmartLife - Dữ Liệu Ghi Chú & Lưu Trữ Cá Nhân`**

File được phân chia thành các Trang tính (Worksheets / Tabs) chuẩn hóa:
1. **Tab `Note Archives (Kho Lưu Trữ Ghi Chú)`:**
   | ID | Ngày tạo | Tiêu đề | Nhãn (Labels) | Nội dung chi tiết | Ghim | Cập nhật cuối |
   | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
   | `uuid-1` | 2026-08-31 | Kế hoạch đồ án tốt nghiệp | University, Work | Nội dung markdown... | TRUE | 2026-08-31 16:30 |
2. **Tab `Quick Notes (Nháp Nhanh & Lịch Sử)`:**
   * Lưu trữ bản ghi chú hiện tại cùng nhật ký các phiên lưu nháp trước đó.
3. **Tab `AI Summaries & Insights`:**
   * Lưu các bản tóm tắt thông minh, phân tích chi tiêu, báo cáo học tập định kỳ do Gemini AI xuất bản.

#### 🛠️ Tính năng Đọc, Xem & Chỉnh Sửa:
* **In-App Google Sheet Viewer / Web Embed:** Xem bảng tính ngay trong SmartLife qua giao diện rút gọn hoặc mở trực tiếp trên Google Sheets chỉ bằng 1 cú click.
* **Auto-Sync on Save:** Khi tạo hoặc chỉnh sửa ghi chú trong SmartLife $\rightarrow$ Tự động cập nhật dòng tương ứng trên Google Sheets.
* **Manual Re-Sync / 1-Click Export:** Nút bấm cho phép người dùng xuất hoặc đồng bộ lại toàn bộ dữ liệu chỉ trong 2 giây.

---

### 2.3. AI Maps Assistant: Trợ Lý Định Vị & Tìm Kiếm Địa Điểm Thông Minh (Realtime Geolocation)

#### 📍 Tích hợp Định Vị Thời Gian Thực (Realtime Geolocation):
* Sử dụng `navigator.geolocation.getCurrentPosition` và `watchPosition` (kèm fallback Native Geolocation trên Capacitor) với độ chính xác cao (`enableHighAccuracy: true`).
* Tự động lấy tọa độ hiện tại (`lat`, `lng`) của người dùng khi người dùng cần trợ giúp địa điểm.

#### 🧠 Tích hợp Function Calling vào Gemini AI Engine:
Bổ sung công cụ AI chuyên dụng: `search_places_and_navigation` và `find_emergency_service`.

* **Các trường hợp hỗ trợ đời sống thực tế:**
  1. ⛽ **Tìm Cây xăng gần nhất:** Phục vụ các trường hợp sắp hết xăng, cần tìm cây xăng Petrolimex/PVOIL gần nhất kèm khoảng cách km.
  2. 🍜 **Tìm Quán ăn & Ẩm thực:** "Gợi ý quán phở/cơm trưa ngon, giá sinh viên quanh đây", "quán ăn mở đêm sau 22h".
  3. ☕ **Tìm Quán Cà phê làm việc/học tập:** "Tìm quán cafe yên tĩnh có wifi mạnh và ổ cắm điện gần đây".
  4. 🛠️ **Tìm Tiệm sửa xe & Cứu hộ khẩn cấp:** "Xe tôi bị thủng lốp/chết máy ở khu vực này, tìm tiệm sửa xe máy hoặc số cứu hộ gần nhất".
  5. 🏥 **Tìm Hiệu thuốc & Cơ sở y tế:** "Tìm nhà thuốc Long Châu / Pharmacity gần nhất".

#### 🗺️ Trực Quan Hóa Tương Tác (Interactive Map Cards trong AI Chat & Schedule):
* AI không chỉ trả về văn bản khô khan mà trả về **Thẻ Địa Điểm Tương Tác (Interactive Place Card)**:
  * Tên địa điểm, Địa chỉ cụ thể.
  * Khoảng cách chính xác (ví dụ: `Cách bạn 450m - 2 phút di chuyển`).
  * Đánh giá sao (⭐ 4.6 / 5.0) & Giờ mở cửa.
  * Số điện thoại liên hệ nhanh (bấm gọi ngay cho dịch vụ cứu hộ/sửa xe).
  * Nút **"Chỉ đường ngay (Google Maps)"** $\rightarrow$ mở trực tiếp ứng dụng Google Maps với tọa độ đích đã được điền sẵn.

---

## 3. ĐÁNH GIÁ TÍNH KHẢ THI KỸ THUẬT (TECHNICAL FEASIBILITY)

| Hạng mục | Khả năng triển khai | Đánh giá kiến trúc |
| :--- | :---: | :--- |
| **Xác thực OAuth chung** | **100%** | Mở rộng scopes trong `AuthContext.tsx`. Người dùng chỉ cần đăng nhập 1 lần duy nhất cho cả Tasks, Calendar, Sheets. |
| **Google Calendar 2-Way Sync** | **100%** | Google Calendar API v3 cung cấp đầy đủ endpoints `events.list`, `events.insert`, `events.patch`, `events.delete` và hỗ trợ Webhook/Polling. |
| **Lịch Trình Tối Giản (Minimalist UI)** | **100%** | Dựng component React TailwindCSS chuẩn Responsive, nhẹ hơn 80% so với web Google Calendar gốc, hỗ trợ Dark Mode hoàn hảo. |
| **Google Sheets Single Store** | **100%** | Google Sheets API v4 hỗ trợ `spreadsheets.create`, `values.get`, `values.append`, `values.batchUpdate`. |
| **AI Maps Assistant (Function Calling)** | **100%** | Đã có sẵn kiến trúc Function Calling của Gemini (`aiEngine.ts`). Chỉ cần thêm tool declaration và xử lý Geolocation. |

👉 **Kết luận Khả Thi:** **Tuyệt đối 100% khả thi**, hoàn toàn nằm trong tầm kiểm soát kỹ thuật và tương thích hoàn hảo với mã nguồn hiện tại của dự án.

---

## 4. ĐÁNH GIÁ CHI PHÍ VẬN HÀNH & QUOTAS (COST & QUOTA ANALYSIS)

### 💰 Bảng Thống Kê Chi Phí & Định Mức Miễn Phí (Google Cloud Free Tier):

| Dịch vụ API | Định mức Miễn phí (Free Tier) | Mức sử dụng dự kiến của SmartLife | Chi phí phát sinh |
| :--- | :--- | :--- | :---: |
| **Google Calendar API v3** | **1,000,000 requests / ngày** | ~500 - 5,000 requests/ngày | **0 VNĐ ($0)** |
| **Google Sheets API v4** | **300 requests / phút / project** (60 req/min/user) | ~10 - 100 requests/phút | **0 VNĐ ($0)** |
| **Google Drive File Storage** | Lưu trữ trên Google Drive cá nhân của user (15GB free) | ~50 KB / file Sheet của user | **0 VNĐ ($0)** |
| **Browser Geolocation API** | Tích hợp sẵn trong trình duyệt & Capacitor | Không giới hạn | **0 VNĐ ($0)** |
| **Google Maps Places Deep Links** | Dùng Google Maps URL Scheme / Places API Web | Không tốn phí khi mở qua Deep Link chỉ đường | **0 VNĐ ($0)** |
| **Gemini AI Function Calling** | Free Tier Gemini 1.5 / 2.0 Flash (15 RPM, 1M TPM) | Đã tích hợp sẵn trong SmartLife | **0 VNĐ ($0)** |
| **Hạ tầng SmartLife Server** | Chạy Client-side REST với OAuth Token của User | $0 chi phí server phụ trợ | **0 VNĐ ($0)** |

👉 **Tổng Chi Phí Vận Hành:** **0 VNĐ (Hoàn toàn Miễn Phí)**.

---

## 5. PHÂN TÍCH RỦI RO & BIỆN PHÁP GIẢM THIỂU (RISK & MITIGATION MATRIX)

| Rủi ro tiềm ẩn (Risk) | Mức độ | Biện pháp kỹ thuật khắc phục (Mitigation Strategy) |
| :--- | :---: | :--- |
| **Token OAuth hết hạn (401 Unauthorized)** | Trung bình | Tự động phát hiện lỗi 401 $\rightarrow$ Gọi hàm Silent Token Refresh qua Supabase hoặc nhắc nhở 1-click cấp lại token an toàn. |
| **Xung đột dữ liệu khi sửa ở cả 2 nơi (Race Condition)** | Thấp | Áp dụng chiến lược **Timestamp Resolution (Last-Write-Wins)** và cơ chế **SmartLife là Master Source of Truth**. |
| **Người dùng từ chối cấp quyền Định vị (GPS Permission Denied)** | Trung bình | AI tự động phát hiện và chuyển sang chế độ: Yêu cầu người dùng nhập tên địa điểm/khu vực thủ công (ví dụ: *"Tôi đang ở gần ngã tư Cầu Giấy"*). |
| **Format Sheet bị người dùng sửa tay làm sai cấu trúc** | Thấp | Service tự động kiểm tra header cột khi đọc/ghi, nếu thiếu cột sẽ tự động append mà không làm crash ứng dụng. |
| **Quá tải request khi sync đồng loạt (Rate Limit)** | Thấp | Bổ sung cơ chế **Debounce (300ms)** và hàng đợi xử lý tuần tự (**Async Queue**) trong các service. |

---

## 6. GIÁ TRỊ & LỢI ÍCH CẠNH TRANH (USER & BUSINESS VALUE)

1. **Trải Nghiệm All-In-One Không Rời Rạc:** Người dùng không cần mở 4-5 tab khác nhau (Google Calendar, Google Sheets, Google Maps, Google Tasks, ChatGPT). Mọi thứ đều nằm trong một giao diện duy nhất cực kỳ mượt mà.
2. **Quyền Sở Hữu Dữ Liệu Tuyệt Đối (Data Ownership):** Người dùng hoàn toàn an tâm vì dữ liệu của họ vừa lưu trên Supabase, vừa tự động nằm trên Google Drive cá nhân dưới dạng bảng tính Google Sheets.
3. **Giá Trị Thực Tế Vượt Trội của AI Maps:** Biến AI từ một chatbot trả lời lý thuyết thành một **Trợ Lý Đời Sống Thực Tế** có thể hỗ trợ người dùng khi đang chạy xe ngoài đường, tìm chỗ ăn uống, học bài và ứng phó tình huống khẩn cấp.

---

## 7. KẾ HOẠCH & LỘ TRÌNH TRIỂN KHAI TỪNG PHASE (STEP-BY-STEP IMPLEMENTATION ROADMAP)

Để đảm bảo chất lượng kiểm thử và tránh quên bối cảnh, dự án được chia làm **4 Phase chuẩn kỹ thuật**:

```
[PHASE 1: NỀN TẢNG XÁC THỰC & GOOGLE CALENDAR ENGINE]
  - Cập nhật Scopes OAuth trong AuthContext.tsx
  - Viết googleCalendarService.ts (CRUD Events, Recurring Timetable, Two-way sync)
  - Nâng cấp UI Lịch trình / ScheduleDashboard tối giản & linh hoạt

[PHASE 2: GOOGLE SHEETS EXTERNAL DATA STORE ENGINE]
  - Viết googleSheetsService.ts (Tạo Spreadsheet, Append/Update Notes, Quick Notes)
  - Tích hợp vào QuickNotesWidget.tsx & noteArchiveService.ts
  - Giao diện In-App Sheet Viewer & 1-Click Export

[PHASE 3: AI MAPS & REALTIME GEOLOCATION ASSISTANT]
  - Xây dựng geolocationService.ts (Lấy tọa độ GPS realtime chính xác)
  - Khai báo Tool `search_places_and_navigation` trong geminiService & aiEngine.ts
  - Tạo UI Interactive Place Card & Nút chỉ đường 1 chạm trong AI Chat

[PHASE 4: TỔNG HỢP GOOGLE WORKSPACE HUB & HOÀN THIỆN]
  - Nâng cấp GoogleSyncHubModal.tsx (Quản lý 3 tab: Tasks, Calendar, Sheets)
  - Kiểm thử toàn diện, tối ưu hiệu năng, khử trùng lặp và cập nhật tài liệu
```

---

### 📅 Chi Tiết Từng Phase:

#### 🔹 Phase 1: Nền Tảng Xác Thực & Google Calendar 100% Sync
* **Mục tiêu:** Biến lịch SmartLife thành phiên bản Google Calendar thứ 2 nhưng đẹp, tinh gọn và mượt mà hơn.
* **Các file tác động:**
  * `src/contexts/AuthContext.tsx`: Cập nhật Scopes OAuth đầy đủ.
  * `src/services/googleCalendarService.ts` (NEW): Core service giao tiếp REST API v3 của Google Calendar.
  * `src/components/ScheduleDashboard.tsx` & `CalendarWidget.tsx`: Tối ưu hóa giao diện xem Tuần, Tháng, Ngày với phong cách Minimalist Glassmorphism.
  * `src/App.tsx`: Gắn các mutation hooks cho Timetable và Calendar Events.

#### 🔹 Phase 2: Google Sheets External Data Store
* **Mục tiêu:** Cung cấp giải pháp lưu trữ, xem và chỉnh sửa dữ liệu ghi chú trên Google Sheets.
* **Các file tác động:**
  * `src/services/googleSheetsService.ts` (NEW): Tự động tạo/tìm Spreadsheet `SmartLife - Dữ Liệu Ghi Chú & Lưu Trữ Cá Nhân`, quản lý các Tab `Note Archives`, `Quick Notes`, `AI Summaries`.
  * `src/services/noteArchiveService.ts`: Bổ sung hook tự động đẩy dữ liệu sang Sheets khi tạo/sửa note.
  * `src/components/tracker/QuickNotesWidget.tsx` & `NotesArchiveModal.tsx`: Thêm nút mở Sheet trực tiếp, nút đồng bộ nhanh.

#### 🔹 Phase 3: AI Maps & Realtime Location Assistant
* **Mục tiêu:** Giúp AI hiểu vị trí thực tế của người dùng và hỗ trợ tìm kiếm địa điểm (cây xăng, quán ăn, cafe, cứu hộ, sửa xe) với chỉ đường Google Maps 1 chạm.
* **Các file tác động:**
  * `src/services/geolocationService.ts` (NEW): Module đọc tọa độ GPS an toàn từ trình duyệt & Capacitor.
  * `src/services/aiEngine.ts` & `geminiService.ts`: Khai báo tools `search_places_and_navigation` và `find_emergency_service`.
  * `src/components/AIAdvisorPage.tsx`: Render component thẻ địa điểm tương tác `InteractivePlaceCard` trong luồng chat.

#### 🔹 Phase 4: Trung Tâm Điều Khiển Google Workspace Hub & Kiểm Thử Toàn Diện
* **Mục tiêu:** Hợp nhất giao diện quản lý tập trung và đảm bảo độ ổn định 100%.
* **Các file tác động:**
  * `src/components/tracker/GoogleSyncHubModal.tsx` (NEW): Modal tích hợp 3 trong 1 (Tasks, Calendar, Sheets).
  * `Context_new.md`: Cập nhật kiến trúc hoàn chỉnh.

---
*Tài liệu được phát triển bởi Lead Software Architect dành riêng cho dự án SmartLife App.*
