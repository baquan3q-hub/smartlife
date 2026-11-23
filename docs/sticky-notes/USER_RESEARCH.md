# Sticky Notes cho Windows — Tổng hợp nghiên cứu người dùng

> Ngày: 02/11/2026 · Nguồn: 3 vòng phản hồi trực tiếp của người dùng chính (sinh viên năm 3, dùng Microsoft Sticky Notes hằng ngày) · Phương pháp: affinity mapping, Jobs-to-be-done, ma trận tác động/công sức

## 1. Người dùng & "công việc cần làm" (JTBD)

**Chân dung:** sinh viên, ghi chú nhanh nội dung học (ví dụ khoá ITBA: Epic, User Story…), quen thao tác của Microsoft Sticky Notes, dùng song song web/điện thoại/Windows.

| Job | Khi… | Tôi muốn… | Để… |
|-----|------|-----------|-----|
| J1 Ghi nhanh | đang học / họp | bật note mới bằng 1 phím tắt hoặc nút + | không mất ý tưởng |
| J2 Đặt note trên màn hình | đang làm việc khác | kéo, đổi kích thước, thu nhỏ, đóng note dễ dàng; ghim khi cần | note không vướng víu |
| J3 Tin dữ liệu | mất mạng / tắt máy | mọi chữ đã gõ được giữ lại | không phải lo |
| J4 Xem lại | cần tìm note cũ | xem danh sách và lịch sử ngay trong note | không phải mở app lớn |

## 2. Nhật ký phản hồi (highlight)

| Vòng | Phản hồi (nguyên văn rút gọn) | Job bị ảnh hưởng | Mức độ |
|------|-------------------------------|------------------|--------|
| v0.1.0 | "Khi mở lên tôi không di và đóng được" | J2 | Chặn hoàn toàn |
| v0.1.1 | "Ấn dấu cộng thêm sticky note thì không được" | J1 | Chặn |
| v0.1.1 | "Thêm nút '-'… không nhất thiết lúc nào cũng phải ghim" | J2 | Cao |
| v0.1.1 | "Ẩn thanh scroll bar… chỉ hiện khi rê chuột" | J2 | Trung bình |
| v0.1.1 | "Xem lại list và lịch sử của nó" | J4 | Trung bình |
| v0.1.2 | "Ấn Ctrl+Alt+N… nó ra giao diện app luôn" | J1 | Chặn hoàn toàn |

## 3. Chủ đề rút ra (affinity mapping)

1. **Thao tác cốt lõi phải "chạy là chạy"** (J1, J2): cả 3 vòng đều có lỗi chặn ở thao tác cơ bản. Người dùng đánh giá theo chuẩn Microsoft Sticky Notes, nên chỉ cần một lỗi là mất niềm tin.
2. **Nguyên nhân kỹ thuật chung:** mọi lỗi chặn đều đến từ **một điểm yếu kiến trúc**. Thao tác cốt lõi phụ thuộc vào kênh liên lạc giữa trang web (smartlife.courses) và vỏ app Windows. Kênh này hỏng 3 lần theo 3 cách khác nhau (IPC bị chặn, kiểm tra tên miền quá chặt, lệnh không được chặn nên trang bị chuyển đi).
3. **Muốn tối giản, không bị ép:** không muốn note luôn ghim, muốn thanh cuộn ẩn, muốn thu nhỏ. Mặc định nên "nhẹ nhàng" giống Microsoft.
4. **Note là "cửa ngõ" vào dữ liệu:** muốn danh sách và lịch sử ngay trong note nhỏ, không phải mở app lớn.

## 4. Ưu tiên (tác động × công sức)

| Hạng mục | Tác động | Công sức | Quyết định |
|----------|----------|----------|------------|
| Cửa sổ note **không bao giờ** bị chuyển sang trang khác | Rất cao | Thấp | Làm ngay (v0.1.3) |
| Nhận lệnh từ mọi biến thể tên miền (`www.` hay không) | Rất cao | Thấp | Làm ngay |
| Lưới an toàn khi lệnh không được app nhận | Cao | Thấp | Làm ngay |
| Tự kiểm tra kênh lệnh khi khởi động, báo lỗi rõ ràng | Cao | Trung bình | Làm ngay |
| Đưa nút + / ghim sang menu gốc của Windows (không cần trang web) | Cao | Cao | Cân nhắc v0.2 |
| Kiểm thử tự động trên Windows trong CI (chạy app thật) | Cao | Cao | v0.2 |

## 5. Kế hoạch kiểm thử khả dụng cho bản kế tiếp

- **Phương pháp:** usability test 5 người (sinh viên đang dùng Microsoft Sticky Notes), 20 phút/người, nói to suy nghĩ (think-aloud), ghi màn hình.
- **Tiêu chí đạt:** 5/5 người hoàn thành các nhiệm vụ 1–4 mà không cần trợ giúp.

| # | Nhiệm vụ | Đo |
|---|----------|----|
| 1 | Nhấn Ctrl+Alt+N, gõ 2 dòng | Ra đúng note trống, gõ được ngay (≤ 2 s) |
| 2 | Kéo note sang góc màn hình, phóng to, thu nhỏ (–), mở lại từ taskbar | Không lỗi, không hỏi |
| 3 | Bấm + tạo note thứ 2, ghim note 1 rồi bỏ ghim | Hoạt động đúng |
| 4 | Tắt Wi-Fi, gõ thêm, đóng note, bật Wi-Fi, mở lại | Không mất chữ |
| 5 | Từ note, mở danh sách → mở note khác; mở lịch sử → khôi phục bản cũ | Tìm được trong ≤ 30 s |
| 6 | Khởi động lại app | Note mở lại đúng vị trí |

**Câu hỏi sau test:** (1) Điểm nào khác Microsoft Sticky Notes làm bạn khó chịu? (2) Có lúc nào bạn lo mất chữ không? (3) Bạn có dùng danh sách/lịch sử trong note thường xuyên không?

## 6. Bài học cho quy trình (PO/BA)

- Mỗi bản phát hành cần **checklist kiểm thử chấp nhận trên máy Windows thật** cho J1–J2 trước khi phát hành (mục 5, nhiệm vụ 1–3). Build thành công trên CI chưa đủ.
- Phản hồi nên kèm **ảnh/video và phiên bản app** (Cài đặt → Giới thiệu) để khoanh vùng nhanh.
