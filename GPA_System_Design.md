# Hệ Thống Tính Điểm GPA Thông Minh
### Tài liệu mô tả luồng hệ thống & giao diện người dùng
> Phiên bản 1.0 · Áp dụng quy chế ĐHQGHN 2022 · Tích hợp AI Advisor

---

## Mục lục

1. [Quy chế chấm điểm & Những điều cần lưu ý](#1-quy-chế-chấm-điểm--những-điều-cần-lưu-ý)
2. [Kiến trúc tổng thể hệ thống](#2-kiến-trúc-tổng-thể-hệ-thống)
3. [Luồng nhập liệu & tính toán](#3-luồng-nhập-liệu--tính-toán)
4. [Mô tả giao diện từng màn hình](#4-mô-tả-giao-diện-từng-màn-hình)
5. [Luồng AI Advisor](#5-luồng-ai-advisor)
6. [Luồng dữ liệu & lưu trữ](#6-luồng-dữ-liệu--lưu-trữ)
7. [Các trạng thái đặc biệt cần xử lý](#7-các-trạng-thái-đặc-biệt-cần-xử-lý)

---

## 1. Quy chế chấm điểm & Những điều cần lưu ý

### 1.1 Ba bước tính GPA theo quy chế ĐHQGHN 2022

```
BƯỚC 1                  BƯỚC 2                  BƯỚC 3
Điểm thành phần    →    Điểm học phần / 10  →   Điểm chữ   →   Điểm / thang 4
(60% cuối kỳ           (làm tròn 1 chữ số      (A+, A,         (A+ = 4.0,
+ 40% bộ phận)          thập phân)              B+… F)          A = 3.7…)

                                                                      ↓
                                                         GPA = Σ(điểm4 × tín chỉ)
                                                               ÷ Σ(tín chỉ)
                                                         (làm tròn 2 chữ số thập phân)
```

### 1.2 Bảng quy đổi điểm chuẩn

| Thang 10       | Điểm chữ | Thang 4 | Xếp loại học lực |
|---------------|----------|---------|-----------------|
| 9.0 – 10.0    | A+       | 4.0     | Xuất sắc        |
| 8.5 – 8.9     | A        | 3.7     | Xuất sắc        |
| 8.0 – 8.4     | B+       | 3.5     | Giỏi            |
| 7.0 – 7.9     | B        | 3.0     | Giỏi            |
| 6.5 – 6.9     | C+       | 2.5     | Khá             |
| 5.5 – 6.4     | C        | 2.0     | Khá             |
| 5.0 – 5.4     | D+       | 1.5     | Trung bình      |
| 4.0 – 4.9     | D        | 1.0     | Trung bình      |
| Dưới 4.0      | F        | 0       | Yếu / Trượt     |

### 1.3 Ba dạng cấu trúc điểm 40% bộ phận

Sinh viên chọn **một trong ba dạng** phù hợp với đề cương môn học:

| Dạng | Thành phần điểm bộ phận | Điểm cuối kỳ | Tổng |
|------|------------------------|--------------|------|
| **Template A** | CC1 (10%) + CC2 (30%) | 60% | 100% |
| **Template B** | CC1 (10%) + CC2 (10%) + CC3 (20%) | 60% | 100% |
| **Template C** | CC1 (20%) + CC2 (20%) | 60% | 100% |

> **Lưu ý bắt buộc:** Điểm cuối kỳ **không được dưới 60% trọng số** và là điều kiện bắt buộc theo quy chế.

### 1.4 Ba loại "điểm trung bình" sinh viên hay nhầm

| Chỉ số | Cách tính | Dùng để làm gì |
|--------|-----------|----------------|
| **TBCH học kỳ** | Tất cả môn trong kỳ, **kể cả F** | Xét học lực từng kỳ, cảnh báo học vụ, số tín chỉ được đăng ký kỳ sau |
| **TBCH các học phần** | Tất cả môn từ đầu khóa, **kể cả F** | Đăng ký chương trình thứ 2, chuyển đổi chương trình |
| **GPA tích lũy** | Chỉ các môn **đã đạt** (D trở lên) | Xét tốt nghiệp, hạng tốt nghiệp ← **Đây mới là GPA thực sự** |

### 1.5 Các học phần KHÔNG tính vào GPA

- Giáo dục quốc phòng – an ninh (GDQP-AN)
- Giáo dục thể chất (GDTC)
- Kỹ năng bổ trợ
- Một số học phần ngoại ngữ khối kiến thức chung (tùy chương trình đào tạo)
- Học phần tự chọn tự do (vẫn ghi vào phụ lục văn bằng nếu đạt D+)

> Các học phần này vẫn là **điều kiện bắt buộc** để được xét tốt nghiệp.

### 1.6 Ngưỡng cảnh báo học vụ

| Năm học | GPA tích lũy dưới ngưỡng | GPA học kỳ dưới ngưỡng |
|---------|--------------------------|------------------------|
| Năm 1   | < 1.20                   | Kỳ 1: < 0.80 / Kỳ sau: < 1.00 |
| Năm 2   | < 1.40                   | < 1.00 |
| Năm 3   | < 1.60                   | < 1.00 |
| Năm 4+  | < 1.80                   | < 1.00 |

> Ngoài ra: Nợ quá **24 tín chỉ F** hoặc số tín chỉ không đạt trong kỳ vượt **50%** khối lượng đăng ký cũng kích hoạt cảnh báo.

### 1.7 Hạng tốt nghiệp & Điều kiện

| Hạng tốt nghiệp | GPA tích lũy toàn khóa |
|-----------------|------------------------|
| Xuất sắc        | 3.60 – 4.00            |
| Giỏi            | 3.20 – 3.59            |
| Khá             | 2.50 – 3.19            |
| Trung bình      | 2.00 – 2.49            |

> ⚠️ **Lưu ý quan trọng:** Hạng Xuất sắc hoặc Giỏi bị **hạ 1 bậc** nếu bị kỷ luật từ cảnh cáo trở lên **hoặc** tổng học phần học lại vượt quá **5% tổng số tín chỉ chương trình**.

---

## 2. Kiến trúc tổng thể hệ thống

```
┌─────────────────────────────────────────────────────────────────┐
│                     NGƯỜI DÙNG (Sinh viên)                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │     GIAO DIỆN CHÍNH         │
              │  (Main Layout)               │
              │                             │
              │  ┌──────────┐ ┌──────────┐  │
              │  │ Sidebar  │ │  Content │  │
              │  │ (Kỳ học) │ │  Area    │  │
              │  └──────────┘ └──────────┘  │
              └──────────────┬──────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
   ┌─────▼──────┐    ┌───────▼──────┐    ┌──────▼──────┐
   │   INPUT    │    │  DASHBOARD   │    │  AI ADVISOR │
   │   MODULE   │    │   MODULE     │    │   MODULE    │
   │            │    │              │    │             │
   │ Bảng nhập  │    │ GPA Cards    │    │ Chat bubble │
   │ môn học    │    │ Charts       │    │ Dự đoán     │
   │ Templates  │    │ Cảnh báo     │    │ Tư vấn      │
   └─────┬──────┘    └──────┬───────┘    └──────┬──────┘
         │                  │                   │
         └──────────────────▼───────────────────┘
                            │
                  ┌─────────▼─────────┐
                  │  CALCULATION      │
                  │  ENGINE           │
                  │                   │
                  │ • Điểm /10        │
                  │ • Điểm chữ        │
                  │ • GPA học kỳ      │
                  │ • GPA tích lũy    │
                  └─────────┬─────────┘
                            │
                  ┌─────────▼─────────┐
                  │  PERSISTENT       │
                  │  STORAGE          │
                  │                   │
                  │ semesters[]       │
                  │ courses[]         │
                  │ scores{}          │
                  └───────────────────┘
```

---

## 3. Luồng nhập liệu & tính toán

### 3.1 Luồng nhập điểm đầy đủ

```
[Người dùng mở ứng dụng]
         │
         ▼
[Chọn hoặc tạo học kỳ]
    ← Kỳ 1 / Kỳ 2 / Học hè  +  Năm học (VD: 2024-2025)
         │
         ▼
[Nhập môn học vào bảng]
    ← Tên môn học
    ← Số tín chỉ (1–5)
    ← Chọn Template điểm bộ phận (A / B / C)
    ← Nhập điểm từng thành phần (0–10)
    ← Checkbox "Không tính GPA" (nếu là GDTC, GDQP-AN...)
         │
         ▼
[Hệ thống tự động tính – Real-time]
    → Điểm học phần = Σ(điểm_cc × hệ_số) + điểm_cuoiky × 0.60
    → Làm tròn 1 chữ số thập phân
    → Tra bảng → Điểm chữ (A+…F)
    → Tra bảng → Thang 4
         │
         ▼
[Cập nhật Dashboard ngay lập tức]
    → GPA học kỳ (kể cả F)
    → GPA tích lũy (chỉ môn đạt)
    → Xếp loại học lực
    → Kiểm tra ngưỡng cảnh báo học vụ
    → Dự báo hạng tốt nghiệp (nếu đủ dữ liệu)
```

### 3.2 Luồng tính điểm chi tiết theo từng Template

```
TEMPLATE A — Điểm bộ phận [10% + 30%]
────────────────────────────────────────────────────────────
  CC1 × 0.10
+ CC2 × 0.30
+ Cuối kỳ × 0.60
= Điểm học phần /10 (làm tròn 1 tp)

TEMPLATE B — Điểm bộ phận [10% + 10% + 20%]
────────────────────────────────────────────────────────────
  CC1 × 0.10
+ CC2 × 0.10
+ CC3 × 0.20
+ Cuối kỳ × 0.60
= Điểm học phần /10 (làm tròn 1 tp)

TEMPLATE C — Điểm bộ phận [20% + 20%]
────────────────────────────────────────────────────────────
  CC1 × 0.20
+ CC2 × 0.20
+ Cuối kỳ × 0.60
= Điểm học phần /10 (làm tròn 1 tp)
```

### 3.3 Luồng tính GPA từ nhiều môn

```
Sau khi có điểm /10 từng môn:

Môn A: 8.2 → B+ → 3.5 × 3 TC = 10.5 điểm quy đổi
Môn B: 7.0 → B  → 3.0 × 2 TC =  6.0 điểm quy đổi
Môn C: 5.3 → D+ → 1.5 × 4 TC =  6.0 điểm quy đổi
Môn D: 3.5 → F  → 0.0 × 3 TC =  0.0 điểm quy đổi (không đạt)
Môn E: 9.1 → A+ → 4.0 × 2 TC =  8.0 điểm quy đổi

──────────────────────────────────────────────────
GPA Học kỳ (kể cả F):
= (10.5 + 6.0 + 6.0 + 0.0 + 8.0) ÷ (3+2+4+3+2) = 30.5 ÷ 14 = 2.18

GPA Tích lũy (chỉ môn đạt — loại môn F):
= (10.5 + 6.0 + 6.0 + 8.0) ÷ (3+2+4+2) = 30.5 ÷ 11 = 2.77

Xếp loại học lực theo GPA học kỳ 2.18 → Trung bình
```

---

## 4. Mô tả giao diện từng màn hình

### 4.1 Màn hình chính — Layout tổng thể

```
┌──────────────────────────────────────────────────────────────────────┐
│  TOPBAR                                                               │
│  [Logo / Tên app]                    [Tên sinh viên]  [Avatar]  [⚙️]  │
├──────────────┬───────────────────────────────────────────────────────┤
│  SIDEBAR     │  CONTENT AREA                                          │
│  ────────    │                                                         │
│  📊 Tổng quan │  ← Hiển thị màn hình đang chọn                        │
│              │                                                         │
│  Năm học     │                                                         │
│  ▼ 2024-2025 │                                                         │
│    • HK1 ✓  │                                                         │
│    • HK2 ●  │                                                         │
│  ▶ 2023-2024 │                                                         │
│  ▶ 2022-2023 │                                                         │
│              │                                                         │
│  [+ Thêm HK] │                                                         │
│              │                                                         │
│  🤖 AI Tư vấn │                                                         │
└──────────────┴───────────────────────────────────────────────────────┘
```

---

### 4.2 Màn hình Tổng quan (Dashboard)

```
┌──────────────────────────────────────────────────────────────────────┐
│  DASHBOARD — Tổng quan GPA                              HK2 / 2024-25│
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  GPA HỌC KỲ  │  │  GPA TÍCH LŨY│  │  XẾP LOẠI    │  │  TÍN CHỈ  │ │
│  │              │  │              │  │              │  │           │ │
│  │     2.74     │  │     3.12     │  │    KHÁ       │  │  82 / 120 │ │
│  │  ────────    │  │  ────────    │  │  ────────    │  │  ───────  │ │
│  │  HK này      │  │  Toàn khóa   │  │  Học kỳ này  │  │  Tích lũy │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └───────────┘ │
│                                                                        │
│  [⚠️ Banner cảnh báo — nếu có]                                          │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ ⚠️ GPA tích lũy của bạn (3.12) đang tiến gần ngưỡng xếp loại    │  │
│  │    Giỏi (3.20). Cần thêm 0.08 điểm để lên hạng.                │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  BIỂU ĐỒ TIẾN ĐỘ GPA                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  4.0 │                                          ●               │  │
│  │  3.5 │                              ●───────────               │  │
│  │  3.0 │                  ●───────────                            │  │
│  │  2.5 │      ●───────────                                        │  │
│  │  2.0 │──────                                                    │  │
│  │      └──────────────────────────────────────────────────────── │  │
│  │       HK1'22  HK2'22  HK1'23  HK2'23  HK1'24  HK2'24          │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  DỰ BÁO HẠNG TỐT NGHIỆP                                               │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  Nếu duy trì GPA ≥ 3.12 → Hạng KHÁ đảm bảo                    │  │
│  │  Cần GPA ≥ 3.20 ở 3 kỳ còn lại → có thể đạt hạng GIỎI          │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

### 4.3 Màn hình Nhập điểm — Bảng môn học

```
┌──────────────────────────────────────────────────────────────────────┐
│  HỌC KỲ 2 — NĂM HỌC 2024-2025                  GPA kỳ này:  2.74    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ Tên môn học      │ TC │ Template │ CC1  │ CC2  │ CC3* │ Cuối kỳ │  │
│  │                  │    │          │      │      │      │   60%   │  │
│  ├──────────────────┼────┼──────────┼──────┼──────┼──────┼─────────┤  │
│  │ Giải tích 1      │ 3  │ [A ▼]    │ 7.5  │ 8.0  │  —   │  8.5    │  │
│  │                  │    │ 10% 30%  │      │      │      │         │  │
│  │                  │    │          │              → Điểm: 8.2  B+ │  │
│  ├──────────────────┼────┼──────────┼──────┼──────┼──────┼─────────┤  │
│  │ Lập trình cơ bản │ 3  │ [B ▼]    │ 9.0  │ 8.5  │ 7.0  │  8.0    │  │
│  │                  │    │ 10%10%20%│      │      │      │         │  │
│  │                  │    │          │              → Điểm: 8.1  B+ │  │
│  ├──────────────────┼────┼──────────┼──────┼──────┼──────┼─────────┤  │
│  │ Tiếng Anh 1      │ 3  │ [C ▼]    │ 6.0  │ 6.5  │  —   │  5.5    │  │
│  │ [☑ Không tính GPA│    │ 20% 20%  │      │      │      │         │  │
│  │   (NN khối CC)]  │    │          │              → Điểm: 5.8   C │  │
│  ├──────────────────┼────┼──────────┼──────┼──────┼──────┼─────────┤  │
│  │ GDTC             │ 1  │ [A ▼]    │ 8.0  │ —    │  —   │  7.5    │  │
│  │ [☑ HP điều kiện] │    │          │      │      │      │         │  │
│  │ [Không tính GPA] │    │          │              → Đạt (P)      │  │
│  ├──────────────────┼────┼──────────┼──────┼──────┼──────┼─────────┤  │
│  │ [🗑] Xóa hàng      │    │          │      │      │      │         │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  [+ Thêm môn học]                          [💾 Đã lưu tự động 2s trước]│
│                                                                        │
│  TÓM TẮT HỌC KỲ NÀY                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  Tổng TC đăng ký: 10  │  TC tính GPA: 6  │  TC đạt: 6         │  │
│  │  GPA học kỳ: 2.74     │  TBCH học phần: 2.68                   │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

**Hành vi của bảng nhập:**

- Khi chọn **Template A**: Ẩn cột CC3, hiện CC1 (10%) và CC2 (30%)
- Khi chọn **Template B**: Hiện CC1 (10%), CC2 (10%), CC3 (20%)
- Khi chọn **Template C**: Ẩn cột CC3, hiện CC1 (20%) và CC2 (20%)
- Điểm /10 và Điểm chữ **tự cập nhật ngay** khi người dùng nhập từng ô
- Ô điểm validate: chỉ cho nhập số từ 0.0 đến 10.0
- Nhấn Tab hoặc Enter để chuyển ô tiếp theo
- Khi tick "Không tính GPA": dòng mờ đi, điểm chữ hiện nhưng không đưa vào phép tính GPA

---

### 4.4 Màn hình Lịch sử & Bộ lọc

```
┌──────────────────────────────────────────────────────────────────────┐
│  LỊCH SỬ HỌC TẬP                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [Lọc: Tất cả ▼]  [Năm học: 2024-2025 ▼]   [📥 Xuất bảng điểm]       │
│                                                                        │
│  ──── NĂM HỌC 2024-2025 ────────────────────────────────────────      │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │  HỌC KỲ 1                      GPA kỳ: 3.20   Hạng: Giỏi    │     │
│  │  ─────────────────────────────────────────────────────────   │     │
│  │  Giải tích 1     3TC   B+  3.5  ✓                            │     │
│  │  Vật lý đại cương 3TC  A   3.7  ✓                            │     │
│  │  Nhập môn CNTT   2TC   B   3.0  ✓                            │     │
│  │  Tiếng Anh 1     3TC   C   2.0  (không tính GPA)             │     │
│  │                                            [▶ Xem chi tiết]  │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │  HỌC KỲ 2  ● Đang học        GPA kỳ dự báo: 2.74            │     │
│  │  ─────────────────────────────────────────────────────────   │     │
│  │  Giải tích 2     3TC   B+  3.5  ✓  (đã có điểm)             │     │
│  │  Lập trình CB    3TC   B+  3.5  ✓  (đã có điểm)             │     │
│  │  Vật lý 2        3TC   [Chưa đủ điểm]                        │     │
│  │                                            [▶ Nhập điểm]     │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                        │
│  ──── NĂM HỌC 2023-2024 ────────────────────────────────────────      │
│  [▶ Nhấn để mở rộng]                                                   │
│                                                                        │
│  TỔNG KẾT TOÀN KHÓA                                                    │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │  GPA tích lũy: 3.12  │  Tổng TC tích lũy: 82 / 120          │     │
│  │  Xếp loại: Khá       │  Tiến độ tốt nghiệp: 68%  [████░░░]  │     │
│  │  Hạng dự báo: KHÁ    │  (Cần thêm 38 TC nữa)                │     │
│  └──────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘
```

---

### 4.5 Màn hình cảnh báo học vụ

Hiển thị nổi bật khi sinh viên rơi vào ngưỡng cảnh báo:

```
┌──────────────────────────────────────────────────────────────────────┐
│  ⚠️  CẢNH BÁO HỌC VỤ                                     [X Đóng]    │
│  ──────────────────────────────────────────────────────────────────   │
│                                                                        │
│  GPA tích lũy hiện tại: 1.35                                          │
│  Ngưỡng an toàn năm 2:  1.40                                          │
│                                                                        │
│  Bạn đang thấp hơn ngưỡng an toàn 0.05 điểm.                         │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  Để thoát khỏi ngưỡng cảnh báo, AI khuyến nghị:                │  │
│  │  • Cần GPA học kỳ này ≥ 1.65 để kéo GPA tích lũy lên 1.41     │  │
│  │  • Ưu tiên cải thiện môn: Giải tích 2 (D) → học lại            │  │
│  │  • Không nên rút môn sau hạn (sẽ bị F tự động)                 │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  [🤖 Hỏi AI để được tư vấn chi tiết hơn]                              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Luồng AI Advisor

### 5.1 Vị trí và cách mở AI trong giao diện

```
[Giao diện chính]
        │
        │  Góc dưới phải: icon 🤖 nổi (floating button)
        │
        ▼
[Nhấn vào icon]
        │
        ▼
┌──────────────────────────────────────┐
│  🤖 GPA AI Advisor          [─] [X]  │
│  ────────────────────────────────    │
│                                      │
│  Xin chào! Tôi đã đọc dữ liệu       │
│  GPA của bạn. Bạn muốn hỏi gì?      │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ Gợi ý nhanh:                  │  │
│  │ • Tôi cần bao nhiêu điểm      │  │
│  │   cuối kỳ để đạt B+?          │  │
│  │ • Nếu học lại môn X thì GPA   │  │
│  │   tích lũy thay đổi thế nào?  │  │
│  │ • Tôi có nguy cơ cảnh báo     │  │
│  │   học vụ không?               │  │
│  └────────────────────────────────┘  │
│                                      │
│  [Nhập câu hỏi của bạn...      ] [▶] │
└──────────────────────────────────────┘
```

### 5.2 Luồng xử lý một câu hỏi AI

```
[Người dùng nhập câu hỏi]
         │
         ▼
[Thu thập context từ dữ liệu người dùng]
  → Toàn bộ dữ liệu GPA hiện tại
  → Danh sách môn học + điểm + tín chỉ
  → GPA học kỳ, GPA tích lũy
  → Năm học hiện tại (để xác định ngưỡng cảnh báo)
  → Số tín chỉ tích lũy / cần tích lũy
         │
         ▼
[Gửi đến AI API]
  System prompt: Quy chế ĐHQGHN 2022 + dữ liệu sinh viên
  User message: Câu hỏi của sinh viên
         │
         ▼
[AI trả lời]
  → Có số điểm cụ thể
  → Có giải thích ngắn gọn
  → Có lời khuyên hành động tiếp theo
         │
         ▼
[Hiển thị trong chat bubble]
  → Hỗ trợ markdown cơ bản (bảng, bullet)
  → Nút "Hỏi thêm" / "Xem bảng điểm"
```

### 5.3 Các loại câu hỏi AI xử lý được

| Nhóm câu hỏi | Ví dụ | AI cần làm |
|---|---|---|
| **Tính điểm cần thiết** | "Tôi cần bao nhiêu điểm cuối kỳ môn Giải tích để được B+?" | Tính ngược từ mục tiêu điểm chữ → điểm cuối kỳ tối thiểu |
| **Dự đoán GPA** | "Nếu học kỳ này tôi trung bình 7.5 điểm, GPA tích lũy sẽ là bao nhiêu?" | Mô phỏng GPA với điểm giả định |
| **Cải thiện điểm** | "Nếu học lại Vật lý (D) và được B, GPA của tôi thay đổi thế nào?" | Tính lại GPA khi overwrite điểm cũ |
| **Cảnh báo học vụ** | "Tôi có nguy cơ bị cảnh báo học vụ không?" | So sánh GPA với ngưỡng theo năm học |
| **Lên kế hoạch** | "Tôi cần GPA như thế nào trong 2 kỳ còn lại để đạt hạng Giỏi?" | Tính GPA mục tiêu và môn cần ưu tiên |
| **Tốt nghiệp** | "Tôi có thể tốt nghiệp hạng Khá không?" | Kiểm tra điều kiện tốt nghiệp + ước tính hạng |

---

## 6. Luồng dữ liệu & lưu trữ

### 6.1 Cấu trúc dữ liệu

```json
{
  "user_id": "sv_12345",
  "created_at": "2022-09-01",
  "year_of_study": 3,
  "program": {
    "name": "Công nghệ thông tin",
    "total_credits_required": 120
  },
  "semesters": [
    {
      "id": "hk1_2024_2025",
      "name": "Học kỳ 1",
      "academic_year": "2024-2025",
      "is_current": true,
      "courses": [
        {
          "id": "course_001",
          "name": "Giải tích 1",
          "credits": 3,
          "template": "A",
          "scores": {
            "cc1": 7.5,
            "cc2": 8.0,
            "final": 8.5
          },
          "computed": {
            "score10": 8.2,
            "letter_grade": "B+",
            "grade4": 3.5,
            "passed": true
          },
          "exclude_from_gpa": false,
          "is_conditional": false,
          "retake_of": null
        }
      ],
      "summary": {
        "semester_gpa": 3.20,
        "credits_registered": 15,
        "credits_passed": 12,
        "academic_standing": "Giỏi"
      }
    }
  ],
  "cumulative": {
    "gpa": 3.12,
    "credits_accumulated": 82,
    "academic_standing": "Khá",
    "graduation_projection": "Khá"
  }
}
```

### 6.2 Luồng lưu & đồng bộ dữ liệu

```
[Người dùng thay đổi bất kỳ ô nào]
         │
         ▼  (debounce 500ms)
[Tính lại tức thì trong bộ nhớ]
         │
         ▼
[Cập nhật UI ngay lập tức]
         │
         ▼
[Lưu vào bộ nhớ cục bộ] → "Đã lưu tự động"
         │
         ▼ (nếu có kết nối)
[Đồng bộ lên Cloud] → "Đã đồng bộ ✓"


EXPORT:
[Nhấn "Tải xuống bản sao lưu"]
  → Xuất file JSON với toàn bộ dữ liệu
  → Tên file: gpa_backup_[ngay]_[thang]_[nam].json

IMPORT:
[Nhấn "Khôi phục dữ liệu"]
  → Chọn file JSON
  → Validate cấu trúc
  → Xác nhận ghi đè
  → Nạp dữ liệu vào app
```

---

## 7. Các trạng thái đặc biệt cần xử lý

### 7.1 Trạng thái dữ liệu

| Trạng thái | Mô tả | Hiển thị trong UI |
|---|---|---|
| **Chưa nhập đủ điểm** | Còn ô điểm thành phần trống | Điểm /10 hiện "—", điểm chữ hiện "—" |
| **Môn F** | Điểm < 4.0 | Dòng màu đỏ nhạt, badge "F" đỏ, không tính vào GPA tích lũy |
| **Môn điều kiện** | GDTC, GDQP-AN, kỹ năng | Dòng xám nhạt, badge "HP điều kiện", chỉ hiện Đạt/Không đạt |
| **Môn học lại** | Sinh viên đăng ký học lại D/D+/F | Badge "Học lại", điểm cũ bị thay thế hoàn toàn |
| **Môn không tính GPA** | Tự chọn tự do, NN khối CC | Dòng mờ hơn, có icon "∅ GPA" |

### 7.2 Trạng thái cảnh báo học vụ

| Mức độ | Điều kiện | Màu banner | Hành động |
|---|---|---|---|
| **An toàn** | GPA trên ngưỡng | Xanh lá (ẩn banner) | Không có |
| **Cảnh báo sớm** | Trong 0.2 điểm so với ngưỡng | Vàng | Hiện gợi ý cải thiện |
| **Cảnh báo học vụ** | Dưới ngưỡng theo năm | Cam đậm | Banner nổi bật + AI tư vấn |
| **Nguy hiểm** | Nợ ≥ 24TC F hoặc ≥50% TC kỳ trượt | Đỏ | Banner toàn màn hình + khuyến nghị gặp cố vấn |

### 7.3 Trạng thái dự báo tốt nghiệp

```
Kiểm tra đủ điều kiện tốt nghiệp:

☑ Tổng TC tích lũy ≥ 120 (hoặc theo chương trình)
☑ GPA tích lũy ≥ 2.00 (chương trình thường) / ≥ 2.50 (tài năng/CLC)
☑ Đã đạt GDTC + GDQP-AN + Kỹ năng bổ trợ
☑ Đạt chuẩn ngoại ngữ đầu ra
☑ Không trong diện bị kỷ luật

→ Nếu đủ: Hiện hạng tốt nghiệp dự kiến + lưu ý hạ bậc (nếu có)
→ Nếu thiếu: Liệt kê cụ thể điều kiện còn thiếu
```

---

## Phụ lục — Luồng người dùng lần đầu (Onboarding)

```
[Lần đầu mở app]
         │
         ▼
[Màn hình chào — Onboarding]
  "Chào mừng đến với GPA Tracker!"
  "Hãy bắt đầu bằng cách nhập thông tin học kỳ đầu tiên"
         │
         ▼
[Bước 1: Chọn năm học & học kỳ]
  Dropdown: Năm học (2020-2021 → 2025-2026)
  Dropdown: Học kỳ (HK1 / HK2 / Học hè)
  Input: Năm thứ mấy? (1 / 2 / 3 / 4+)
         │
         ▼
[Bước 2: Thêm môn đầu tiên]
  Hiện bảng nhập với 1 hàng mẫu đã điền sẵn demo
  Hướng dẫn hover từng cột
         │
         ▼
[Bước 3: Xem kết quả]
  Hiện GPA ngay sau khi nhập đủ → "Đây là GPA học kỳ đầu tiên của bạn!"
         │
         ▼
[Hoàn thành onboarding → Vào app chính]
```

---

*Tài liệu này mô tả luồng hệ thống và giao diện cho tính năng GPA Calculator.*  
*Áp dụng quy chế ĐHQGHN 2022 · Tích hợp Anthropic AI API · Phiên bản 1.0*
