# 💎 SmartLife Pricing & Premium Subscription System

Tài liệu này mô tả chi tiết chính sách giá (Pricing), hệ thống gói Pro, các giới hạn tính năng (Feature Gating) và cơ chế vận hành hệ thống thanh toán/hạn mức AI trong ứng dụng SmartLife.

---

## 1. Các Gói Đăng Ký (Subscription Plans)

SmartLife đã loại bỏ gói Vĩnh viễn (Lifetime) để phù hợp với định hướng cập nhật sản phẩm liên tục, đồng thời tối ưu hóa chi phí học tập cho học sinh/sinh viên với 5 gói dịch vụ sau:

| ID Gói | Tên Gói | Thời Hạn | Giá Bán (VND) | Giá Tương Đương / Tháng | % Tiết Kiệm | Ghi Chú / Thiết Kế UI |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `1_month` | 🔥 **Khám phá** | 30 ngày | 59.000đ | ~59.000đ / tháng | 0% | Gói cơ bản dùng thử ngắn hạn |
| `3_months` | ⭐ **Nghiêm túc** | 90 ngày | 139.000đ | ~46.333đ / tháng | 21% | Phù hợp chu kỳ 1 học phần |
| `6_months` | 💎 **Quyết tâm** | 180 ngày | 239.000đ | ~39.833đ / tháng | 33% | Tiết kiệm hơn cho 1 học kỳ |
| `12_months` | 👑 **Đỉnh cao** | 365 ngày | 399.000đ | ~33.250đ / tháng | 44% | **Gói Phổ Biến Nhất** (Popular Badge) |
| `4_years` | 🎓 **Sinh viên chăm chỉ** | 1460 ngày | 499.000đ | **~10.396đ / tháng** | **82%** | **BEST VALUE** - Đồng hành suốt khóa học |

---

## 2. Phân Hệ Tính Năng: Free vs Pro (Feature Gating)

Để mang lại giá trị cao nhất cho người dùng trả phí mà vẫn bảo đảm trải nghiệm cơ bản tốt cho người dùng miễn phí, SmartLife áp dụng chính sách giới hạn tính năng như sau:

### 2.1. Các Tính Năng Miễn Phí (Free Features)
- **Tổng quan (Visual Board)**: Dashboard trung tâm hiển thị lịch trình, todo, mục tiêu, biểu đồ tài chính và GPA. (Đã mở khóa hoàn toàn miễn phí).
- **Lịch trình & Thời khóa biểu**: Lên lịch học cố định theo thứ, giờ học, giảng viên và phòng học. Hỗ trợ kết xuất ảnh TKB.
- **Quản lý Tài chính (Finance)**: Ghi chép giao dịch, tích hợp bàn phím tính toán thông minh, quản lý Ví & Quỹ chi tiêu, Sổ ghi nợ vay mượn mini và Chuyển khoản nội bộ.
- **Không gian tập trung (Focus Timer)**: Đồng hồ Pomodoro/Stopwatch học tập, âm thanh nền thư giãn (tiếng mưa, sóng biển, tiếng ồn trắng).
- **GPA Tracker (Cơ bản)**: Quản lý học kỳ, nhập môn học, tính điểm hệ 10/chữ/thang 4 và GPA tích lũy.

### 2.2. Các Tính Năng Pro Gated (Yêu Cầu Nâng Cấp Pro/Trial)
- **Trợ lý Cố vấn AI (AI Advisor)**: Chat phân tích dữ liệu cá nhân, tự động tạo todo, giao dịch, lịch học và tính toán GPA bằng ngôn ngữ tự nhiên.
- **Cố vấn Sự nghiệp AI (AI Career Coach)**: Phân tích kết hợp giữa kết quả học vụ thực tế và kết quả test MBTI/DISC để đưa ra lộ trình nghề nghiệp.
- **Tự động kết xuất CV chuẩn ATS**: Đồng bộ điểm số GPA sang CV và xuất file PDF chuyên nghiệp chỉ trong 1 click.
- **Kịch bản GPA 5 năm (GPA Projections)**: Dự báo mục tiêu điểm số học kỳ còn lại để đạt bằng Khá/Giỏi/Xuất sắc.
- **Nhật ký chữa lành bảo mật (Healing Journal)**: Viết nhật ký cảm xúc cá nhân, lưu giữ tâm trạng (Mood Tracker) và bảo mật tuyệt đối bằng mã PIN riêng biệt (`Journal PIN Guard`).
- **Habit Tracker không giới hạn**: Thiết lập và theo dõi vô số thói quen, streak ngày và đổi thưởng StarBrain.

### 2.3. Quy Tắc Giới Hạn Habit Tracker Cho Free User
- Người dùng Free chỉ được tạo tối đa **3 thói quen hoạt động**.
- Khi người dùng Free cố gắng thêm thói quen thứ 4, hệ thống sẽ tự động hiển thị modal nâng cấp gói dịch vụ. Nút "Thêm thói quen" trên Dashboard sẽ chuyển thành "Nâng cấp Pro" kèm theo badge chỉ báo giới hạn (ví dụ: `3/3 Free`).

---

## 3. Kiến Trúc Vận Hành & Bảo Mật Backend AI API

Để không làm lộ thông tin nhạy cảm của hệ thống và API key của Gemini, SmartLife triển khai hạ tầng bảo mật phân tầng:

- **AI API Proxy**: Toàn bộ luồng chat và phân tích AI gửi từ Frontend KHÔNG bao giờ gọi trực tiếp tới Google API. Frontend sẽ gửi request kèm theo Supabase JWT Token của user đến serverless proxy `/api/gemini` (Backend).
- **Quản lý API Key bảo mật**: Key Google Gemini được lưu trong biến môi trường `GEMINI_API_KEYS` trên Vercel Backend và tự động xoay tua (key rotation) nếu gặp lỗi rate limit (429) hoặc quota.
- **Ràng Buộc Hạn Mức (Quota Enforcement)**:
  - Gói Free: Bị chặn hoàn toàn, không thể gửi request đến proxy (trả về lỗi `free_gate`).
  - Gói Trial (Dùng thử 7 ngày): Tối đa **3 request/ngày** và **30.000 token/ngày**.
  - Gói Pro / Student: Tối đa **10 request/ngày** và **50.000 token/ngày** (Hạn mức tháng 600.000 token).
- **AI Boost Packs**: Người dùng có thể mua các gói nạp token phụ trợ (`boost_s`, `boost_m`, `boost_l`) khi đã dùng hết hạn mức ngày/tháng để tiếp tục tương tác với AI. Token Boost sẽ được trừ theo thứ tự mua trước dùng trước (FIFO).

---

## 4. Quy Trình Thanh Toán & Phê Duyệt Admin

1. **Tạo đơn hàng**: Người dùng chọn gói dịch vụ trong `PricingModal` -> Hệ thống hiển thị thông tin chuyển khoản ngân hàng (QR Code, STK, cú pháp chuyển khoản có kèm mã order ID).
2. **Lưu trữ đơn hàng**: Một record mới được tạo trong bảng `subscription_orders` của Supabase với trạng thái `pending`.
3. **Phê duyệt Admin**:
   - Admin đăng nhập bằng email quản trị (`baquan3q@gmail.com`) và truy cập tab **Admin**.
   - Admin kiểm tra giao dịch chuyển khoản trên tài khoản ngân hàng thực tế khớp với mã Order ID.
   - Nhấn nút **Xác nhận (Approve)** trên Admin Dashboard.
   - Hệ thống tự động kích hoạt gói Pro cho user: cập nhật bảng `profiles` đặt `plan = 'pro'`, thiết lập ngày hết hạn tương ứng (`pro_expiry_date`), và gửi thông báo hệ thống chúc mừng người dùng nâng cấp thành công.
