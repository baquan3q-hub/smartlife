# Sticky Notes — Hướng dẫn triển khai

## 1. Cơ sở dữ liệu (bắt buộc, 1 lần)
1. Mở Supabase → **SQL Editor** → New query.
2. Dán toàn bộ nội dung `sql/sticky_notes_schema.sql` → **Run**.
3. Kiểm tra: **Table Editor** có `sticky_notes`, `sticky_note_versions`; **Database → Publications → supabase_realtime** có `sticky_notes`.

> Chưa chạy SQL thì trang Sticky Notes vẫn mở được, hiện cảnh báo và chỉ lưu tạm trên thiết bị.

## 2. Web & điện thoại
- Merge nhánh → Vercel tự deploy. Truy cập: thanh bên **Sticky Notes**, `#/sticky`, menu **Mở rộng** (mobile), hoặc nút **Sticky** trên widget Ghi chú.
- App Android/iOS (Capacitor): `npm run build && npx cap sync` như thường lệ.

## 3. Windows (Tauri)
### Build tự động (khuyên dùng)
```bash
git tag desktop-v0.1.0
git push origin desktop-v0.1.0
```
GitHub Actions (`.github/workflows/desktop-windows.yml`) build trên máy Windows và tạo **bản nháp Release** có file `.exe` / `.msi`. Vào GitHub → Releases → kiểm tra → **Publish**.

Mỗi lần push thay đổi trong `src-tauri/` hay code Sticky, workflow cũng build thử. File cài nằm ở mục **Artifacts** của lần chạy.

### Build trên máy Windows của bạn
1. Cài [Rust](https://rustup.rs) và Node 22.
2. `npm run desktop:dev` (chạy thử) hoặc `npm run desktop:build` (tạo bộ cài trong `src-tauri/target/release/bundle/`).

### Cách hoạt động
- App desktop **tải trực tiếp** `https://smartlife.courses`. Deploy web xong là desktop có tính năng mới, không cần cài lại.
- Đổi tên miền: sửa `src-tauri/tauri.conf.json` (`build.frontendDist`, `app.windows[0].url`), `src-tauri/capabilities/default.json` (`remote.urls`) và `APP_URL` trong `src-tauri/src/main.rs`.
- Phím tắt: **Ctrl+Shift+N** tạo note nổi mới. Đóng cửa sổ chính thì app ẩn xuống khay hệ thống. Thoát hẳn bằng chuột phải icon khay → **Thoát SmartLife**.
- Đăng nhập Google trong app desktop có thể bị Google chặn ("disallowed_useragent"). Khi đó đăng nhập bằng email/mật khẩu.
- Bộ cài chưa ký số nên Windows SmartScreen sẽ cảnh báo lần đầu. Muốn bỏ cảnh báo thì cần mua chứng chỉ code signing.

## 4. Kiểm thử chấp nhận (gợi ý)
| # | Kịch bản | Kỳ vọng |
|---|----------|---------|
| 1 | Tạo note trên web, mở điện thoại | Note xuất hiện ≤ 3 s |
| 2 | Tắt mạng, sửa note, bật mạng | Trạng thái "Offline" → tự đồng bộ |
| 3 | Sửa note nhiều lần cách nhau > 5 phút → Lịch sử | Có các phiên bản cũ, khôi phục được |
| 4 | AI → Tách task → Thêm vào Kanban | Task xuất hiện ở cột Todo, có hạn nếu note có ngày |
| 5 | Tài khoản free mở AI | Thấy thông báo nâng cấp, không gọi API |
| 6 | Windows: Ctrl+Shift+N | Cửa sổ note nổi mới, gõ ngay được |
| 7 | Windows: khởi động lại app | Các note nổi đang mở được mở lại đúng vị trí |
| 8 | Xoá note → Thùng rác → Khôi phục | Note quay lại; sau 30 ngày tự xoá vĩnh viễn |
