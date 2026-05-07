# 📋 Mô Tả Tính Năng & Luồng Nghiệp Vụ
## Module: Countdown + Count-Up + Habit & Streak Tracker
### Dự án: SmartLife Web App — Feature Integration Spec
**Phiên bản:** v1.0 | **Ngày:** 07/05/2026 | **Tác giả:** Bùi Anh Quân

---

## 1. TỔNG QUAN Ý TƯỞNG

### 1.1 Bối cảnh
Trong hệ sinh thái SmartLife, người dùng cần một công cụ **quản lý thời gian & thói quen** tích hợp sẵn, không cần mở app ngoài. Module này bổ sung 3 tính năng cốt lõi:

| Tính năng | Mô tả ngắn | Ví dụ thực tế |
|---|---|---|
| **Countdown** | Đếm ngược đến sự kiện | Còn 43 ngày đến sinh nhật |
| **Count-Up** | Đếm tiến ngày từ mốc cũ | 120 ngày kể từ khi bỏ thuốc |
| **Habit & Streak** | Tracker thói quen + chuỗi ngày | 37 ngày streak tập gym |

### 1.2 Triết lý thiết kế
- **Đơn giản trực quan**: Người dùng thấy số liệu ngay, không cần thao tác thêm.
- **Cảm xúc hóa**: Màu sắc theo danh mục, emoji/icon gắn với sự kiện → tạo kết nối cảm xúc.
- **Động lực liên tục**: Streak, completion rate, heatmap calendar → khuyến khích duy trì thói quen.
- **Tích hợp liền mạch**: Dữ liệu chia sẻ với các module khác của SmartLife (calendar, goals, notifications).

---

## 2. TÍNH NĂNG CHI TIẾT

---

### 2.1 COUNTDOWN — Đếm Ngược Sự Kiện

#### Mô tả
Người dùng tạo một "event card" gắn với ngày cụ thể trong tương lai. Hệ thống tự động tính và hiển thị số ngày còn lại theo thời gian thực.

#### Các loại Countdown
- **One-time**: Sự kiện xảy ra một lần (kỳ thi, du lịch, deadline).
- **Recurring**: Sự kiện lặp lại hàng năm (sinh nhật, kỷ niệm, lễ lớn).

#### Thuộc tính của một Countdown Item

```
CountdownItem {
  id            : UUID
  title         : string          // "My Birthday", "Kỳ thi IELTS"
  description   : string?         // ghi chú thêm (optional)
  target_date   : date            // ngày mục tiêu
  is_recurring  : boolean         // lặp hàng năm?
  color_theme   : string          // mã màu hoặc preset color
  icon          : emoji | string  // biểu tượng đại diện
  created_at    : timestamp
  user_id       : UUID
}
```

#### Logic tính toán
```
days_left = target_date - today

Nếu days_left > 0  → Hiển thị: "{days_left} days left" [màu chủ đạo]
Nếu days_left = 0  → Hiển thị: "🎉 Today!" [highlight đặc biệt]
Nếu days_left < 0  → Chuyển sang mục "PAST", hiển thị "{|days_left|} days ago"
  → Nếu is_recurring = true: tự động tính lại cho năm tiếp theo
```

#### UI/UX
- **Danh sách**: Card ngang, bên trái là icon + title + date, bên phải là số ngày (nổi bật, font lớn).
- **Sắp xếp mặc định**: Gần nhất trước (days_left tăng dần).
- **Phân nhóm**: UPCOMING | TODAY | PAST (3 section riêng).
- **Sort tùy chỉnh**: Theo ngày, theo tên, theo ngày tạo.
- **Quick add**: Nút "+" → modal form nhanh.

---

### 2.2 COUNT-UP — Đếm Ngày Kể Từ Mốc

#### Mô tả
Người dùng ghi nhận một **mốc sự kiện trong quá khứ** và hệ thống liên tục đếm số ngày đã trôi qua. Tính năng này nhấn mạnh **cảm giác tích lũy** và thành tựu theo thời gian.

#### Use cases điển hình
- 🚭 "Days since I quit smoking" — động lực cai nghiện
- 💑 "Days together" — kỷ niệm tình yêu
- 🏃 "Days since I started running" — theo dõi hành trình
- 🎓 "Days since graduation" — cột mốc cuộc đời
- 📵 "Days without social media" — digital detox

#### Thuộc tính
```
CountUpItem {
  id          : UUID
  title       : string
  start_date  : date        // ngày bắt đầu (trong quá khứ)
  color_theme : string
  icon        : emoji
  milestone   : int[]?      // [30, 100, 365, ...] — ngưỡng ăn mừng
  user_id     : UUID
}
```

#### Logic
```
days_elapsed = today - start_date

Hiển thị: "{days_elapsed} days"

Milestone check:
  Nếu days_elapsed ∈ milestone[] → trigger confetti + notification đặc biệt
  Preset milestones gợi ý: 7, 30, 50, 100, 180, 365, 500, 1000
```

#### UI/UX
- Giao diện tương tự countdown nhưng số đếm **tăng** mỗi ngày.
- Badge milestone khi đạt mốc (ví dụ: 🏅 "100 Days!").
- Tùy chọn chia sẻ card ra ngoài (share image).

---

### 2.3 HABIT & STREAK TRACKER — Theo Dõi Thói Quen

#### Mô tả
Người dùng tạo các thói quen cần duy trì hàng ngày hoặc theo lịch tùy chỉnh. Hệ thống ghi nhận check-in và tính toán **streak (chuỗi ngày liên tiếp)**, đồng thời cung cấp thống kê hành vi chi tiết.

#### Thuộc tính của một Habit
```
Habit {
  id              : UUID
  title           : string          // "Gym Workout", "Read 30 mins"
  description     : string?
  icon            : emoji | string
  color_theme     : string
  frequency       : enum            // DAILY | WEEKLY | CUSTOM
  active_days     : DayOfWeek[]     // [MON, TUE, WED, THU, FRI] nếu CUSTOM
  reminder_time   : time?           // "18:30"
  start_date      : date
  user_id         : UUID
  created_at      : timestamp
}
```

#### Thuộc tính Check-in
```
HabitLog {
  id          : UUID
  habit_id    : UUID
  log_date    : date
  completed   : boolean
  note        : string?     // ghi chú tùy chọn
  logged_at   : timestamp
}
```

#### Logic Streak
```
current_streak:
  Đếm ngược từ hôm nay liên tục các ngày có completed = true
  Nếu hôm nay chưa check-in → không bẻ streak (grace period đến 23:59)
  Nếu bỏ lỡ 1 ngày scheduled → streak = 0, bắt đầu lại

best_streak:
  Max streak đạt được từ trước đến nay

completion_rate:
  (số ngày completed / tổng số ngày scheduled kể từ start_date) × 100%
```

#### Logic Reminder
```
Nếu reminder_time ≠ null AND active_days chứa ngày hôm nay:
  Push notification vào reminder_time
  Nội dung: "⏰ Đừng quên: {habit.title} hôm nay!"
```

---

## 3. THỐNG KÊ & ANALYTICS

### 3.1 Habit Statistics (per-habit)

| Metric | Mô tả |
|---|---|
| Current Streak | Chuỗi ngày check-in liên tiếp hiện tại |
| Best Streak | Chuỗi ngày dài nhất từ trước tới nay |
| Total Completions | Tổng số lần hoàn thành |
| Completion Rate | % ngày hoàn thành / ngày đã lên lịch |
| Heatmap Calendar | Grid calendar màu xanh = done, xám = missed |
| Frequency | Tần suất (Daily / Custom) |
| Start Date | Ngày bắt đầu thói quen |

### 3.2 Overall Statistics (toàn bộ habits)

| Metric | Mô tả |
|---|---|
| Year Heatmap | Toàn bộ ngày trong năm, màu đậm hơn = nhiều habit done |
| Completion Times | Biểu đồ cột — phân bố giờ check-in trong ngày |
| Session Breakdown | Morning (06–12h), Afternoon (12–18h), Evening/Night (18–06h) |
| Weekly Pattern | Biểu đồ cột — ngày nào trong tuần hoàn thành nhiều nhất |

---

## 4. LUỒNG NGHIỆP VỤ (BUSINESS FLOW)

### 4.1 Luồng Tạo Countdown / Count-Up

```
[User] → Click nút "+" (Add Event)
        → Chọn loại: [Countdown] hoặc [Count-Up]
        → Điền form:
            - Title (bắt buộc)
            - Target Date / Start Date (bắt buộc)
            - Chọn màu theme
            - Chọn icon/emoji
            - Recurring? (chỉ với Countdown)
            - Milestone alerts? (chỉ với Count-Up)
        → Save
        → Hiển thị card mới trong danh sách
        → Tự động sort lại danh sách
```

### 4.2 Luồng Tạo Habit

```
[User] → Click "Add Habit"
        → Điền form:
            - Habit name (bắt buộc)
            - Description (optional)
            - Start date
            - Frequency: Daily / Weekly / Custom days
            - Reminder time + active days
            - Color theme
            - Icon
        → Save
        → Habit card xuất hiện trong Habit List
        → Hệ thống đăng ký push notification nếu có reminder
```

### 4.3 Luồng Daily Check-in

```
[User] mở SmartLife → thấy Today's Habits panel
        → Tap vào habit card để check-in
            → Hệ thống ghi HabitLog(date=today, completed=true)
            → Streak tính lại ngay lập tức
            → Card chuyển sang trạng thái "Done" ✅
        → Nếu đạt milestone streak (7, 30, 100...):
            → Hiện confetti animation + modal chúc mừng
            → Tùy chọn chia sẻ thành tích
```

### 4.4 Luồng Xem Thống Kê

```
[User] → Vào tab "Statistics" hoặc click vào 1 habit cụ thể
        → Xem:
            [Overall] → Year heatmap + completion times + weekly pattern
            [Per Habit] → Streak / completion rate / calendar heatmap
        → Filter theo: 7 ngày / 30 ngày / 3 tháng / 1 năm / All time
```

### 4.5 Luồng Xử Lý Bỏ Lỡ Ngày (Missed Day)

```
Mỗi ngày vào lúc 00:01:
  Hệ thống quét tất cả habits có scheduled ngày hôm qua
  → Nếu HabitLog(yesterday) = null hoặc completed = false:
      → Ghi log: completed = false
      → Kiểm tra streak: nếu hôm qua scheduled → streak = 0
  → Nếu completed = true → streak tiếp tục
```

---

## 5. DATA MODEL TỔNG HỢP

```
Users (đã có trong SmartLife)
  └── CountdownItems (1-to-many)
  └── CountUpItems (1-to-many)
  └── Habits (1-to-many)
        └── HabitLogs (1-to-many per Habit)

Bảng: countdown_items
  id, user_id, title, description, target_date,
  is_recurring, color_theme, icon, created_at

Bảng: countup_items
  id, user_id, title, start_date,
  milestones (jsonb array), color_theme, icon, created_at

Bảng: habits
  id, user_id, title, description, icon, color_theme,
  frequency, active_days (jsonb), reminder_time,
  start_date, is_active, created_at

Bảng: habit_logs
  id, habit_id, log_date, completed, note, logged_at
```

---

## 6. TÍCH HỢP VỚI SMARTLIFE

| Module SmartLife | Điểm tích hợp |
|---|---|
| **Dashboard** | Widget hiển thị countdown gần nhất + streak hiện tại |
| **Notifications** | Reminder check-in habit + milestone alert |
| **Calendar** | Sync ngày target của countdown vào calendar |
| **Goals Module** | Habit completion rate đóng góp vào tiến độ mục tiêu |
| **Analytics** | Dữ liệu habit feed vào báo cáo hành vi tổng thể |

---

## 7. PHẠM VI TRIỂN KHAI ĐỀ XUẤT

### Phase 1 — MVP (ưu tiên cao)
- [x] CRUD Countdown (one-time + recurring)
- [x] CRUD Count-Up
- [x] CRUD Habit (daily frequency)
- [x] Daily check-in
- [x] Streak calculation (current + best)
- [x] Danh sách hiển thị cơ bản

### Phase 2 — Enhanced
- [ ] Custom frequency (specific weekdays)
- [ ] Reminder push notification
- [ ] Habit heatmap calendar
- [ ] Per-habit statistics page

### Phase 3 — Advanced
- [ ] Overall statistics dashboard (charts)
- [ ] Milestone celebration animation
- [ ] Share card (ảnh thành tích)
- [ ] Dashboard widget integration
- [ ] Export data CSV

---

## 8. GHI CHÚ KỸ THUẬT CHO ANTIGRAVITY

- **Tech stack**: Kế thừa SmartLife hiện tại (Next.js + Supabase + Gemini AI nếu có).
- **Streak logic**: Chạy cron job hoặc edge function lúc 00:01 mỗi ngày để xử lý missed days.
- **Timezone**: Lưu trữ theo UTC, tính toán theo local timezone của user.
- **Recurring countdown**: Khi `target_date` qua → tự động set `target_date = target_date + 1 year`.
- **Color theme**: Dùng preset palette (green, blue, red, orange, purple...) + cho phép custom hex.
- **Icon**: Hỗ trợ emoji picker hoặc bộ icon preset theo danh mục.
- **Performance**: Habit logs có thể nhiều → cần index trên `(habit_id, log_date)`.
- **Optimistic UI**: Check-in nên update UI ngay, đồng bộ server background.

---

*Tài liệu này được chuẩn bị cho Antigravity phân tích & đánh giá tích hợp vào SmartLife Web App.*
