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
**Cách 1 — trên GitHub (không cần máy tính):** Actions → **Desktop (Windows)** → **Run workflow** → nhập `release_version` (vd `0.1.1`) → Run.

**Cách 2 — bằng git:**
```bash
git tag desktop-v0.1.1
git push origin desktop-v0.1.1
```
GitHub Actions (`.github/workflows/desktop-windows.yml`) build trên máy Windows và phát hành **GitHub Release** công khai kèm file `.exe` / `.msi`.

Mỗi lần push thay đổi trong `src-tauri/` hay code Sticky, workflow cũng build thử. File cài nằm ở mục **Artifacts** của lần chạy.

### Build trên máy Windows của bạn
1. Cài [Rust](https://rustup.rs) và Node 22.
2. `npm run desktop:dev` (chạy thử) hoặc `npm run desktop:build` (tạo bộ cài trong `src-tauri/target/release/bundle/`).

### Cách hoạt động
- App desktop **tải trực tiếp** `https://smartlife.courses`. Deploy web xong là desktop có tính năng mới, không cần cài lại.
- **Note nổi** dùng khung cửa sổ của Windows: kéo thanh tiêu đề để di chuyển, kéo mép/góc để đổi kích thước, **–** để thu nhỏ xuống taskbar (gộp chung icon SmartLife), **X** để đóng (note vẫn được lưu).
- Thanh công cụ của note: **+** note mới · màu · **ghim** (luôn nằm trên cùng, mặc định tắt) · **danh sách ghi chú** (tìm & mở note khác) · **lịch sử phiên bản** (xem & khôi phục) · **⋯** (cỡ chữ, mở bảng Sticky Notes, thùng rác). Phím tắt trong note: `Ctrl+N` note mới, `Ctrl` + cuộn chuột / `Ctrl +` / `Ctrl -` / `Ctrl 0` cỡ chữ, `Ctrl+S` lưu ngay.
- **Lệnh từ trang web → app** (mở note, ghim, thu nhỏ…; không bao giờ chứa nội dung ghi chú, app gửi xác nhận lại): trang điều hướng tới `https://smartlife.courses/__desktop/<lệnh>`, app chặn lại và thực hiện (`desktop_command_handler` trong `main.rs`). Không dùng kênh IPC của Tauri vì kênh này không chạy với trang tải từ web.
- **An toàn dữ liệu:** mỗi lần gõ phím được ghi ngay vào máy. Mất mạng, tắt app hay mất điện giữa chừng vẫn còn dữ liệu, lần mở sau tự đồng bộ lên server. Đóng note hoặc thoát app thì app chờ lưu xong mới đóng.
- Note đang mở được nhớ (file `open-sticky-notes.txt` trong `%APPDATA%\com.smartlife.desktop`) và mở lại đúng vị trí, kích thước khi khởi động.
- Phím tắt: **Ctrl+Alt+N** tạo note nổi mới. Khay hệ thống: tạo note, hiện/ẩn các note nổi, mở SmartLife, khởi động cùng Windows, thoát.
- Đóng cửa sổ chính thì app ẩn xuống khay hệ thống. Thoát hẳn bằng chuột phải icon khay → **Thoát SmartLife**.
- Đổi tên miền: sửa `src-tauri/tauri.conf.json` (`build.frontendDist`, `app.windows[0].url`), `src-tauri/capabilities/default.json` (`remote.urls`) và `APP_URL` trong `src-tauri/src/main.rs`.
- Đăng nhập Google trong app desktop có thể bị Google chặn ("disallowed_useragent"). Khi đó đăng nhập bằng email/mật khẩu.
- Bộ cài chưa ký số nên Windows SmartScreen sẽ cảnh báo lần đầu.

## 4. Kiểm thử chấp nhận (gợi ý)
| # | Kịch bản | Kỳ vọng |
|---|----------|---------|
| 1 | Tạo note trên web, mở điện thoại | Note xuất hiện ≤ 3 s |
| 2 | Tắt mạng, sửa note, bật mạng | Trạng thái "Offline" → tự đồng bộ |
| 3 | Sửa note nhiều lần cách nhau > 5 phút → Lịch sử | Có các phiên bản cũ, khôi phục được |
| 4 | AI → Tách task → Thêm vào Kanban | Task xuất hiện ở cột Todo, có hạn nếu note có ngày |
| 5 | Tài khoản free mở AI | Thấy thông báo nâng cấp, không gọi API |
| 6 | Windows: Ctrl+Alt+N | Cửa sổ note nổi mới, gõ ngay được |
| 7 | Windows: khởi động lại app | Các note nổi đang mở được mở lại đúng vị trí |
| 8 | Xoá note → Thùng rác → Khôi phục | Note quay lại; sau 30 ngày tự xoá vĩnh viễn |
