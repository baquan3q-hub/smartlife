# SmartLife - Product & Business Context

Tài liệu này mô tả SmartLife từ góc nhìn sản phẩm, business và người dùng bình thường. Mục tiêu là giúp người đọc hiểu SmartLife đang giải quyết vấn đề gì, ai là người dùng chính, từng tính năng mang lại giá trị nào, và sản phẩm có thể phát triển thành hướng spin-off ra sao.

## 1. SmartLife là gì?

SmartLife là một ứng dụng web/PWA hỗ trợ người dùng tự quản đời sống cá nhân, đặc biệt phù hợp với sinh viên đại học. Sản phẩm gom nhiều nhu cầu thường bị tách rời vào một không gian duy nhất: quản lý lịch trình, việc cần làm, mục tiêu, chi tiêu, GPA, thói quen, tài nguyên cá nhân, âm nhạc tập trung và trợ lý AI.

Nếu nhìn theo ngôn ngữ đơn giản, SmartLife là một "trung tâm điều phối cá nhân" giúp sinh viên biết hôm nay cần làm gì, đang tiêu tiền ra sao, mục tiêu học tập đang ở đâu, thói quen có được duy trì không, và có thể hỏi AI để nhận gợi ý dựa trên dữ liệu của chính mình.

Nếu nhìn theo hướng business, SmartLife là một nền tảng self-management có thể phát triển theo mô hình freemium/pro: miễn phí cho các nhu cầu cơ bản, trả phí cho các tính năng nâng cao như AI Advisor, Visual Board, lịch trình thông minh, focus space, lưu trữ cá nhân, báo cáo cá nhân hóa hoặc gói theo trường/lớp.

## 2. Người dùng chính

### 2.1. Sinh viên đại học

Đây là nhóm người dùng phù hợp nhất với định vị hiện tại của sản phẩm. Sinh viên thường có nhiều lịch học, bài tập, deadline, chi tiêu cá nhân, mục tiêu GPA và thói quen học tập chưa ổn định. SmartLife giúp nhóm này nhìn rõ tình trạng cá nhân và tạo thói quen tự quản.

### 2.2. Người đang cần tự quản cuộc sống cá nhân

Ngoài sinh viên, sản phẩm vẫn có thể phục vụ người đi làm trẻ, freelancer hoặc người đang muốn quản lý tài chính, thời gian, mục tiêu và thói quen trong một hệ thống duy nhất.

### 2.3. Quản trị viên và chủ sản phẩm

Hệ thống có module admin để theo dõi người dùng, đơn hàng subscription và thao tác xác nhận gói Pro. Nhóm này không phải người dùng cuối chính, nhưng quan trọng cho vận hành sản phẩm.

## 3. Quy ước trạng thái tính năng

- `đang chạy trong luồng chính`: có component/service được nối trực tiếp vào app và người dùng có thể sử dụng trong luồng hiện tại.
- `có trong code nhưng chưa nối hoàn chỉnh`: có file/service/component hoặc config, nhưng chưa phải luồng production đầy đủ hoặc có dấu hiệu legacy.
- `định hướng/mở rộng`: ý tưởng có cơ sở từ code hiện tại nhưng chưa nên mô tả là đã hoàn thiện.

## 4. Giá trị cốt lõi của SmartLife

SmartLife tạo giá trị theo 4 lớp:

- Tập trung dữ liệu cá nhân: lịch, todo, chi tiêu, mục tiêu, GPA, thói quen, file và nhạc cá nhân được gom vào một app.
- Tự quan sát bản thân: người dùng thấy rõ mình đang làm gì, tiêu gì, học ra sao và có bỏ lỡ mục tiêu không.
- Hỗ trợ ra quyết định bằng AI: AI Advisor có thể dùng dữ liệu app để đưa gợi ý tài chính, lịch trình, học tập và GPA.
- Tạo nền tảng nghiên cứu/sản phẩm: dữ liệu hành vi trong app có thể dùng cho khảo sát, pilot, nghiên cứu thói quen và phát triển sản phẩm spin-off.

## 5. Tính năng sản phẩm

### 5.1. Đăng nhập, PWA và thông báo

**Trạng thái:** `đang chạy trong luồng chính`

**Vấn đề:** Sinh viên dùng nhiều thiết bị, dễ quên lịch học, deadline, mục tiêu hoặc sự kiện cá nhân. Một công cụ hỗ trợ thói quen cần bám được vào nhịp sử dụng hằng ngày.

**Cách SmartLife giải quyết:** Ứng dụng dùng Supabase Auth để đăng nhập Google hoặc email/password. Session được lưu qua Capacitor Preferences để phù hợp môi trường web/mobile. PWA được cấu hình trong Vite, Firebase Messaging được dùng cho service worker và thông báo. App có cơ chế bật/tắt thông báo trong Settings.

**Dữ liệu sử dụng:** Supabase session, `profiles`, `timetable`, `goals`, `calendar_events`, dữ liệu habit trong DB, trạng thái thông báo trong `localStorage`, Firebase Messaging token.

**Giá trị mang lại:** Người dùng có tài khoản riêng, dữ liệu cá nhân hóa và có thể nhận nhắc nhở. Với nghiên cứu hoặc business, đây là nền tảng để tăng retention và đo hành vi sử dụng thực tế.

### 5.2. Landing Page và Login

**Trạng thái:** `đang chạy trong luồng chính`

**Vấn đề:** Người dùng mới cần hiểu nhanh SmartLife là gì và có cách đăng nhập rõ ràng trước khi vào hệ thống.

**Cách SmartLife giải quyết:** `LandingPage` giới thiệu giá trị sản phẩm, các nhóm tính năng và hình ảnh preview. `Login` xử lý đăng nhập Google, đăng nhập email/password và đăng ký tài khoản.

**Dữ liệu sử dụng:** Supabase Auth, metadata người dùng khi đăng ký, ngôn ngữ giao diện `vi/en` trong state.

**Giá trị mang lại:** Tạo điểm vào sản phẩm rõ ràng, có thể dùng cho demo, khảo sát người dùng và định vị business.

### 5.3. VisualBoard

**Trạng thái:** `đang chạy trong luồng chính`

**Vấn đề:** Sinh viên thường bị phân mảnh thông tin: lịch ở một nơi, todo ở nơi khác, chi tiêu ở nơi khác, GPA và mục tiêu lại tách riêng. Điều này làm giảm khả năng tự quan sát và tự điều chỉnh.

**Cách SmartLife giải quyết:** `VisualBoard` là dashboard tổng quan. Nó hiển thị các chỉ số và điểm truy cập nhanh đến lịch trình, todo, mục tiêu, tài chính, GPA, AI, music/focus và storage. Trong app hiện tại, VisualBoard nằm sau Pro gate.

**Dữ liệu sử dụng:** `transactions`, `goals`, `todos`, `timetable`, `gpaSemesters`, `profile`, trạng thái Pro, dữ liệu hiển thị theo ngày hiện tại.

**Giá trị mang lại:** Đây là "màn hình trung tâm" của sản phẩm. Nó giúp người dùng hiểu tình trạng cá nhân trong vài giây và là điểm bán hàng mạnh cho gói Pro.

### 5.4. MyStorage

**Trạng thái:** `đang chạy trong luồng chính`

**Vấn đề:** Sinh viên thường lưu tài liệu học tập, link, ghi chú, hình ảnh, audio/video rải rác ở nhiều nơi.

**Cách SmartLife giải quyết:** `MyStorage` cho phép lưu note, link, file, image, audio và video. Dữ liệu metadata lưu ở bảng `my_storage`, file lưu trong Supabase Storage bucket `my-storage`. Module có tab theo loại nội dung, pin item, upload file và quản lý nội dung cá nhân.

**Dữ liệu sử dụng:** `my_storage`, Supabase Storage bucket `my-storage`, `userId`.

**Giá trị mang lại:** Người dùng có một kho lưu trữ cá nhân gắn với dashboard. Với sinh viên, đây có thể là nơi lưu tài liệu môn học, link ôn tập, ghi chú nhanh và tài nguyên học tập.

**Lưu ý sản phẩm:** Note hiện có phần render HTML. Nếu dùng trong môi trường trường học hoặc nghiên cứu nghiêm túc, cần kiểm soát sanitize nội dung trước khi mở rộng.

### 5.5. FinanceDashboard

**Trạng thái:** `đang chạy trong luồng chính`

**Vấn đề:** Nhiều sinh viên không biết tiền đi đâu, khó bám ngân sách, dễ chi tiêu theo cảm xúc và ít theo dõi mục tiêu tiết kiệm.

**Cách SmartLife giải quyết:** `FinanceDashboard` cho phép thêm/sửa/xóa giao dịch, phân loại thu/chi, quản lý danh mục mặc định và danh mục tự tạo, đặt mục tiêu tài chính, đặt ngân sách theo danh mục/tháng, xem thống kê và biểu đồ.

**Dữ liệu sử dụng:** `transactions`, `goals`, `budgets`, `profiles.custom_categories`, `EXPENSE_CATEGORIES`, `INCOME_CATEGORIES`.

**Giá trị mang lại:** Người dùng thấy rõ dòng tiền, nhóm chi tiêu lớn, tiến độ mục tiêu và mức độ bám ngân sách. Với business, finance là tính năng có giá trị cao vì tạo thói quen nhập liệu lặp lại.

### 5.6. CashFlowDashboard

**Trạng thái:** `đang chạy trong luồng chính`

**Vấn đề:** Quản lý giao dịch đơn lẻ chưa đủ; người dùng cần thấy xu hướng dòng tiền theo thời gian.

**Cách SmartLife giải quyết:** `CashFlowDashboard` dùng dữ liệu tài chính hiện có để tạo góc nhìn dòng tiền, phân tích thu - chi và hỗ trợ xem tình trạng tài chính ở cấp tổng quan hơn.

**Dữ liệu sử dụng:** `transactions`, `budgets`, `goals`, app state tài chính.

**Giá trị mang lại:** Giúp người dùng chuyển từ ghi chép sang phân tích. Đây là bước quan trọng để AI có thể đưa khuyến nghị tài chính có ngữ cảnh.

### 5.7. Mục tiêu cá nhân và tài chính

**Trạng thái:** `đang chạy trong luồng chính`

**Vấn đề:** Sinh viên thường có mục tiêu như tiết kiệm, GPA, học chứng chỉ, rèn thói quen nhưng ít theo dõi tiến độ một cách định lượng.

**Cách SmartLife giải quyết:** Mục tiêu được dùng trong cả `FinanceDashboard`, `ScheduleDashboard`, `VisualBoard` và AI context. Người dùng có thể thêm/sửa/xóa mục tiêu, cập nhật tiến độ, đặt deadline và gắn mức ưu tiên.

**Dữ liệu sử dụng:** `goals`, `profile`, app state, dữ liệu deadline.

**Giá trị mang lại:** Biến mục tiêu mơ hồ thành dữ liệu có thể theo dõi. Từ góc nhìn nghiên cứu, đây là biến quan trọng để đo năng lực tự quản.

### 5.8. ScheduleDashboard, timetable và todo

**Trạng thái:** `đang chạy trong luồng chính`

**Vấn đề:** Sinh viên cần quản lý lịch học cố định, việc linh hoạt, deadline và thứ tự ưu tiên. Nếu không có công cụ, họ dễ quên việc hoặc không biết nên làm gì trước.

**Cách SmartLife giải quyết:** `ScheduleDashboard` quản lý timetable, todo, mục tiêu và focus mode. Todo có priority, deadline, trạng thái hoàn thành và hỗ trợ reorder bằng `@dnd-kit`. Timetable lưu lịch theo ngày trong tuần và giờ bắt đầu/kết thúc.

**Dữ liệu sử dụng:** `timetable`, `todos`, `goals`, `TaskPriority`, `ScheduleType`, state focus timer.

**Giá trị mang lại:** Người dùng có một hệ thống lập kế hoạch học tập và công việc cá nhân. Với nghiên cứu, có thể đo tỷ lệ hoàn thành todo, số lượng deadline, mức độ lập kế hoạch và xu hướng trì hoãn.

### 5.9. FocusTimer và FocusSpace

**Trạng thái:** `đang chạy trong luồng chính`

**Vấn đề:** Sinh viên khó duy trì tập trung, hay học ngắt quãng và thiếu công cụ đo phiên học.

**Cách SmartLife giải quyết:** `useFocusTimer` cung cấp timer tập trung với preset, trạng thái chạy/tạm dừng, phiên tập trung và tích hợp vào `FocusTimer`, `FocusSpace`, `ScheduleDashboard`. Có âm báo khi hết giờ.

**Dữ liệu sử dụng:** phần lớn state timer lưu trong `localStorage`, file âm thanh `tiengthongbaobamgio.mp3`, state React trong session hiện tại.

**Giá trị mang lại:** Tạo trải nghiệm học tập có nhịp. Tuy nhiên, nếu muốn dùng dữ liệu focus cho nghiên cứu hoặc analytics đa người dùng, cần bổ sung bảng lưu focus session trong DB.

### 5.10. MusicSpace

**Trạng thái:** `đang chạy trong luồng chính`

**Vấn đề:** Một số người dùng cần âm nhạc hoặc không gian nền để hỗ trợ tập trung.

**Cách SmartLife giải quyết:** `MusicSpace` cung cấp không gian nghe nhạc/focus với playlist, video nền, ảnh nền và tích hợp timer. Module có thể mở độc lập hoặc nhúng trong lịch trình/focus.

**Dữ liệu sử dụng:** playlist cấu hình trong code, asset trong `public/music`, state timer được truyền từ `useFocusTimer`.

**Giá trị mang lại:** Làm trải nghiệm học tập giàu cảm xúc hơn, tăng khả năng người dùng ở lại trong app khi học hoặc làm việc.

### 5.11. MySpotify

**Trạng thái:** `đang chạy trong luồng chính`

**Vấn đề:** Người dùng muốn có thư viện nhạc cá nhân thay vì chỉ dùng playlist cố định.

**Cách SmartLife giải quyết:** `MySpotify` cho phép tạo playlist cá nhân, upload track, quản lý bài hát và phát nhạc trong modal. Metadata lưu ở bảng `my_playlists`, `my_tracks`, file nhạc lưu trong Supabase Storage bucket `my-spotify`.

**Dữ liệu sử dụng:** `my_playlists`, `my_tracks`, bucket `my-spotify`, `userId`.

**Giá trị mang lại:** Tạo cá nhân hóa sâu hơn cho không gian học tập/focus. Đây cũng là tính năng giúp SmartLife khác với app quản lý tác vụ đơn thuần.

### 5.12. GPADashboard

**Trạng thái:** `đang chạy trong luồng chính`

**Vấn đề:** Sinh viên khó tự tính GPA, khó biết điểm cần đạt trong các môn còn lại, khó dự báo cảnh báo học vụ hoặc xếp loại tốt nghiệp.

**Cách SmartLife giải quyết:** `GPADashboard` cho phép quản lý học kỳ, môn học, tín chỉ, mẫu trọng số điểm, điểm thành phần, môn không tính GPA, học lại và mục tiêu GPA. `gpaCalculator` tính điểm hệ 10, điểm chữ, thang 4, GPA học kỳ, GPA tích lũy, cảnh báo học vụ, dự báo tốt nghiệp và GPA cần đạt.

**Dữ liệu sử dụng:** `gpa_semesters`, `gpa_courses`, `localStorage` cho mục tiêu GPA/tín chỉ, constants `GRADE_SCALE`, `TEMPLATE_WEIGHTS`, `WARNING_THRESHOLDS`.

**Giá trị mang lại:** Đây là tính năng có độ phù hợp cao với sinh viên đại học. Nó biến dữ liệu học tập thành kế hoạch hành động cụ thể.

### 5.13. AI Advisor

**Trạng thái:** `đang chạy trong luồng chính`

**Vấn đề:** Dữ liệu cá nhân nhiều nhưng người dùng không phải lúc nào cũng biết tự phân tích. Sinh viên cần một trợ lý giải thích tình trạng tài chính, lịch trình, todo, GPA và gợi ý bước tiếp theo.

**Cách SmartLife giải quyết:** `AIAdvisorPage` là giao diện chat chính. `geminiService` xây context từ tài chính, mục tiêu, lịch trình, profile và GPA. `aiEngine` hỗ trợ function calling như truy vấn dữ liệu, thêm lịch, thêm todo, thêm giao dịch, tính GPA cần đạt và mô phỏng GPA. Chat history và memory được lưu qua service riêng.

**Dữ liệu sử dụng:** `transactions`, `goals`, `budgets`, `timetable`, `todos`, `gpaSemesters`, `profile`, `ai_conversations`, `ai_messages`, `ai_memory`, `api_logs`.

**Giá trị mang lại:** Đây là lớp khác biệt lớn nhất của SmartLife: không chỉ ghi nhận dữ liệu mà còn diễn giải dữ liệu thành lời khuyên. Với business, AI Advisor là ứng viên mạnh cho Pro feature.

**Lưu ý sản phẩm:** AI phụ thuộc chất lượng dữ liệu người dùng nhập. Không nên mô tả AI như hệ thống ra quyết định tự động hoàn toàn.

### 5.14. Habit, Countdown và Count-up

**Trạng thái:** `đang chạy trong luồng chính`

**Vấn đề:** Sinh viên không chỉ cần quản lý việc cần làm mà còn cần xây dựng thói quen dài hạn, theo dõi ngày quan trọng và ghi nhận chuỗi duy trì.

**Cách SmartLife giải quyết:** `HabitDashboard` quản lý countdown item, count-up item, habit và habit log. Người dùng có thể tạo sự kiện đếm ngược, mốc đếm tiến, thói quen theo ngày/tuần/tháng/custom và đánh dấu hoàn thành.

**Dữ liệu sử dụng:** `countdown_items`, `countup_items`, `habits`, `habit_logs`.

**Giá trị mang lại:** Mở rộng SmartLife từ quản lý việc sang hình thành thói quen. Đây là hướng rất phù hợp với nghiên cứu hành vi sinh viên và có thể trở thành điểm khác biệt sản phẩm.

### 5.15. CalendarWidget và calendar events

**Trạng thái:** `đang chạy trong luồng chính`

**Vấn đề:** Người dùng cần nhìn lịch theo ngày/tháng và ghi lại sự kiện cá nhân ngoài timetable cố định.

**Cách SmartLife giải quyết:** `CalendarWidget` dùng bảng `calendar_events`, localStorage cho một số state thiết lập, và service thông báo để nhắc sự kiện.

**Dữ liệu sử dụng:** `calendar_events`, localStorage, notification service.

**Giá trị mang lại:** Bổ sung lớp lịch cá nhân cho lịch học/lịch todo, giúp app gần hơn với nhu cầu quản lý đời sống thực tế.

### 5.16. Settings

**Trạng thái:** `đang chạy trong luồng chính`

**Vấn đề:** Người dùng cần cấu hình thông báo, ngôn ngữ, tài khoản và một số thiết lập cá nhân.

**Cách SmartLife giải quyết:** `SettingsModal` cho phép bật/tắt notification, đổi ngôn ngữ, đăng xuất và quản lý một số thiết lập lưu ở localStorage.

**Dữ liệu sử dụng:** localStorage, Supabase Auth, `userId`, notification settings.

**Giá trị mang lại:** Tăng tính kiểm soát cá nhân và giảm cảm giác bị app can thiệp quá nhiều.

### 5.17. Pro subscription và payment flow

**Trạng thái:** `đang chạy trong luồng chính`

**Vấn đề:** Một sản phẩm có AI, lưu trữ và tính năng nâng cao cần mô hình doanh thu để duy trì chi phí vận hành.

**Cách SmartLife giải quyết:** `useProAccess` xác định quyền truy cập theo plan, trial, grace period và lifetime. `PricingModal` hiển thị gói, `InvoiceModal` hiển thị đơn thanh toán, `subscriptionService` tạo order, xác nhận order, hủy order và cập nhật profile. App có Pro gate cho một số tính năng.

**Dữ liệu sử dụng:** `profiles.plan`, `profiles.pro_expiry_date`, `profiles.trial_started_at`, `subscription_orders`, thông tin chuyển khoản trong `PAYMENT_INFO`.

**Giá trị mang lại:** Tạo nền tảng monetization. Với spin-off, có thể thử nghiệm gói cá nhân, gói sinh viên, gói theo lớp/khoa hoặc gói trường học.

### 5.18. AdminDashboard

**Trạng thái:** `đang chạy trong luồng chính`

**Vấn đề:** Chủ sản phẩm cần quản lý user, đơn hàng và trạng thái Pro.

**Cách SmartLife giải quyết:** `AdminDashboard` chỉ hiển thị cho email admin hard-code trong app. Module đọc danh sách profile/order, xác nhận/hủy/revert order và có phần hướng dẫn SQL để cấu hình subscription.

**Dữ liệu sử dụng:** `profiles`, `subscription_orders`, admin email.

**Giá trị mang lại:** Hỗ trợ vận hành MVP mà chưa cần dashboard backend riêng.

**Lưu ý business:** Cơ chế phân quyền admin hard-code chỉ phù hợp giai đoạn MVP/demo; nếu sản phẩm mở rộng cần role/permission chính thức trong DB.

## 6. Các phần có trong code nhưng chưa nên xem là hoàn chỉnh

### 6.1. Backend `/api`

**Trạng thái:** `có trong code nhưng chưa nối hoàn chỉnh`

`package.json` có script `dev:backend` chạy `uvicorn api.index:app`, `vite.config.ts` proxy `/api` về port 8000 và `vercel.json` rewrite `/api/(.*)` sang `/api/index.py`. Tuy nhiên thư mục `api/` hiện không có file backend tương ứng. Điều này cho thấy dự án từng có hoặc dự kiến có backend FastAPI, nhưng trạng thái hiện tại chưa production-ready.

### 6.2. `aiService`, `financeService`, `apiClient`

**Trạng thái:** `có trong code nhưng chưa nối hoàn chỉnh`

Các service này gọi `/api` hoặc backend external, trong khi luồng AI chính hiện chủ yếu nằm ở `geminiService` và `aiEngine` phía frontend. Nên xem chúng là legacy/placeholder hoặc lớp tích hợp chưa hoàn thiện.

### 6.3. `AIAdvisor.tsx`

**Trạng thái:** `có trong code nhưng chưa nối hoàn chỉnh`

`AIAdvisorPage` là giao diện AI được nối vào app chính. `AIAdvisor.tsx` vẫn tồn tại nhưng không phải luồng chính hiện tại.

### 6.4. `smartEngine` và `InsightCard`

**Trạng thái:** `có trong code nhưng chưa nối hoàn chỉnh`

`smartEngine` có logic tạo insight cục bộ như spending velocity, deep work score, schedule insight. `InsightCard` cũng có component hiển thị insight. Tuy nhiên phần hiển thị insight trong app chính chưa rõ là luồng sản phẩm hoàn chỉnh. Có thể dùng làm nền cho tính năng "Smart Insights" sau này.

### 6.5. Behavioral tracking

**Trạng thái:** `định hướng/mở rộng`

`types.ts` có `BehaviorLog`, `DailySnapshot`, `SmartInsight`, nhưng chưa thấy pipeline đầy đủ để thu thập, tổng hợp và phân tích behavioral data như một hệ thống nghiên cứu hoàn chỉnh. Nếu muốn dùng cho nghiên cứu khoa học, cần bổ sung schema, logging event và dashboard phân tích.

## 7. Business framing

### 7.1. Vấn đề thị trường

Sinh viên không thiếu app, nhưng thiếu một hệ thống vừa đủ cá nhân hóa, vừa gom nhiều mảng đời sống học tập vào một nơi. Nhiều người không dùng app quản lý vì thấy phức tạp, nhập liệu mất thời gian, hoặc không thấy lợi ích ngay. SmartLife có cơ hội nếu chứng minh được rằng việc gom dữ liệu và AI gợi ý giúp sinh viên tự quản tốt hơn.

### 7.2. Giá trị khác biệt

- Kết hợp học tập, tài chính, lịch trình, GPA, thói quen và AI trong một app.
- Phù hợp bối cảnh sinh viên Việt Nam hơn các app productivity chung.
- Có thể dùng như sản phẩm cá nhân và cũng có thể dùng như nền tảng nghiên cứu hành vi.
- Có dữ liệu đủ rộng để phát triển AI cá nhân hóa nếu logging được hoàn thiện.

### 7.3. Mô hình doanh thu khả thi

- Freemium: miễn phí cho quản lý cơ bản, trả phí cho AI, VisualBoard, phân tích nâng cao, storage hoặc music cá nhân.
- Student Pro: gói giá thấp theo tháng/kỳ học.
- School pilot: triển khai cho một lớp/khoa để hỗ trợ nghiên cứu và cải thiện kỹ năng tự quản.
- B2B/B2E giáo dục: dashboard tổng hợp ẩn danh cho nhà trường nếu có đồng ý dữ liệu và tuân thủ quyền riêng tư.

### 7.4. Rủi ro sản phẩm

- Người dùng bỏ cuộc nếu nhập liệu quá nhiều.
- AI không hữu ích nếu dữ liệu cá nhân ít hoặc sai.
- FocusTimer chưa lưu DB nên khó chứng minh hiệu quả tập trung trên nhiều người.
- Backend `/api` chưa hoàn chỉnh có thể gây nhầm lẫn khi mở rộng.
- Các tính năng quá nhiều có thể làm định vị sản phẩm bị rộng nếu không chọn trọng tâm.

## 8. Định hướng spin-off

Hướng spin-off tốt nhất không nên là "app quản lý tất cả mọi thứ", mà nên là:

**SmartLife - AI self-management platform for university students.**

Trọng tâm nên đặt vào 3 lời hứa sản phẩm:

- Giúp sinh viên hiểu tình trạng cá nhân: lịch, todo, tiền, GPA, thói quen.
- Giúp sinh viên hành động tốt hơn: nhắc việc, focus, mục tiêu, khuyến nghị AI.
- Giúp nhà trường/nghiên cứu hiểu nhu cầu thật: khảo sát, pilot, dữ liệu hành vi có đồng ý.

## 9. AI Context Summary

SmartLife là ứng dụng React/TypeScript/Vite dùng Supabase, Firebase Messaging, Gemini và PWA để hỗ trợ sinh viên tự quản. Các tính năng chính đang chạy gồm auth, landing/login, VisualBoard, tài chính, cashflow, lịch trình, todo, mục tiêu, focus timer, music, MySpotify, GPA, AI Advisor, habit/countdown/count-up, storage, settings, Pro subscription và admin. Dữ liệu chính nằm ở Supabase tables như `profiles`, `transactions`, `goals`, `budgets`, `timetable`, `todos`, `calendar_events`, `gpa_semesters`, `gpa_courses`, `ai_conversations`, `ai_messages`, `ai_memory`, `api_logs`, `my_storage`, `my_playlists`, `my_tracks`, `subscription_orders`, `countdown_items`, `countup_items`, `habits`, `habit_logs`. Các phần cần cẩn trọng khi mô tả là `/api` backend đang rỗng, một số service legacy chưa nối hoàn chỉnh, FocusTimer còn lưu localStorage, và behavioral analytics chưa phải pipeline nghiên cứu hoàn chỉnh.
