# SmartLife Sticky Notes — PRD & Thiết kế hệ thống

> Phiên bản: 1.0 · Ngày: 01/11/2026 · Trạng thái: Đang phát triển (nhánh `feature/sticky-notes`)

---

## 1. Bối cảnh & vấn đề

Người dùng mục tiêu (sinh viên, người đi làm trẻ) đang dùng **Microsoft Sticky Notes** để ghi nhanh. Các điểm đau quan sát được:

| # | Điểm đau | Hệ quả |
|---|----------|--------|
| P1 | Không có AI hỗ trợ | Ghi xong phải tự chép sang to-do / lịch, tự phân loại |
| P2 | Cấu trúc nghèo nàn (chỉ text + màu) | Không gắn nhãn, không tìm theo chủ đề, không liên kết task |
| P3 | Đồng bộ đa nền tảng hạn chế | Muốn xem trên web, điện thoại, desktop nhưng trải nghiệm rời rạc |
| P4 | Không có lịch sử phiên bản | Lỡ xoá/ghi đè nội dung là mất |
| P5 | Ghi chú tách rời hệ sinh thái cá nhân | Không nối được với Kanban, Lịch, Telegram của SmartLife |

**Cơ hội:** SmartLife đã có web (React/Vite), mobile (Capacitor), Supabase, AI Gemini có quota, Kanban + Google Tasks sync, Telegram bot. Sticky Notes là "điểm chạm hằng ngày" giúp tăng tần suất mở app (DAU) và dẫn người dùng vào các tính năng Pro (AI).

## 2. Mục tiêu & chỉ số

| Mục tiêu | Chỉ số (North Star / phụ) | Mục tiêu 60 ngày |
|----------|---------------------------|------------------|
| Trở thành nơi ghi nhanh mặc định | Số note tạo / người dùng hoạt động / tuần | ≥ 10 |
| Ghi chú → hành động | % note dùng "Tách task bằng AI" | ≥ 15% |
| Đa nền tảng | % người dùng xem note trên ≥ 2 thiết bị | ≥ 30% |
| Tin cậy | Số sự cố mất dữ liệu | 0 |

**Ngoài phạm vi (v1):** chia sẻ note cho người khác, vẽ tay/ink, đính kèm ảnh, mã hoá đầu-cuối, bản macOS (code Tauri hỗ trợ nhưng chưa phát hành).

## 3. User stories & tiêu chí chấp nhận

### Epic A — Ghi chú cốt lõi (Giai đoạn 1)
- **A1.** Là người dùng, tôi muốn tạo note bằng 1 thao tác để ghi nhanh ý tưởng.
  - AC: Nút "+" / phím `N` tạo note mới, con trỏ đặt sẵn vào ô nội dung.
- **A2.** Tôi muốn note tự lưu khi gõ.
  - AC: Lưu sau ≤ 0,7 s ngừng gõ; có trạng thái "Đang lưu / Đã lưu / Offline".
- **A3.** Tôi muốn đổi màu, ghim, lưu trữ, xoá (có thùng rác khôi phục được).
- **A4.** Tôi muốn tìm kiếm và lọc theo màu/nhãn.
- **A5.** Tôi muốn sửa ở thiết bị này và thấy ở thiết bị khác gần như tức thì.
  - AC: Thay đổi xuất hiện ở thiết bị khác ≤ 3 s khi online (Supabase Realtime).
- **A6.** Tôi muốn xem và khôi phục phiên bản cũ của note.
  - AC: Snapshot tự động khi nội dung thay đổi, tối đa 1 bản / 5 phút / note.
- **A7.** Tôi vẫn ghi được khi mất mạng.
  - AC: Note hiển thị từ cache; thay đổi được xếp hàng và tự đẩy khi có mạng.

### Epic B — Desktop Windows (Giai đoạn 2)
- **B1.** Tôi muốn cài app Windows, ghim vào taskbar, có icon ở khay hệ thống.
- **B2.** Tôi muốn "tách" một note ra thành cửa sổ nổi nhỏ trên desktop, có thể luôn nằm trên cùng.
- **B3.** Tôi muốn phím tắt toàn cục `Ctrl+Alt+N` để tạo note từ bất kỳ đâu.
- **B4.** Tôi muốn app tự khởi động cùng Windows (bật/tắt được).
- **B5.** Vị trí/kích thước cửa sổ note được nhớ trên máy đó.

### Epic C — AI (Giai đoạn 3)
- **C1.** Tách task: AI đọc note → đề xuất danh sách task (nội dung, ưu tiên, hạn) → tôi chọn → thêm vào Kanban.
- **C2.** Gợi ý tổ chức: AI đề xuất tiêu đề, nhãn, màu → tôi bấm Áp dụng.
- **C3.** Tóm tắt / viết lại gọn gàng → xem trước → Thay thế hoặc Chèn dưới.
- AC chung: dùng chung quota AI hiện tại (`/api/gemini`); người dùng free thấy thông báo nâng cấp; không bao giờ tự ghi đè nội dung khi chưa xác nhận (có snapshot trước khi áp dụng).

## 4. Kiến trúc tổng thể

```
               ┌───────────────────────── Supabase ─────────────────────────┐
               │  sticky_notes (RLS)  ──trigger──▶ sticky_note_versions (RLS)│
               │        │ Realtime (postgres_changes)                        │
               └────────┼────────────────────────────────────────────────────┘
          ┌─────────────┼──────────────┬──────────────────────────┐
          ▼             ▼              ▼                          ▼
   Web (Vercel)   Mobile (Capacitor)  Windows (Tauri v2)     /api/gemini (Vercel)
   tab #/sticky   cùng bundle React   ├ cửa sổ chính = web    quota + Gemini 2.5 Flash
                                      ├ cửa sổ note nổi:
                                      │  #/sticky-window?id=…
                                      ├ tray, Ctrl+Alt+N
                                      └ autostart, window-state
```

**Quyết định kiến trúc (ADR rút gọn)**

| Quyết định | Lựa chọn | Lý do | Đánh đổi |
|-----------|----------|-------|---------|
| Desktop shell | **Tauri v2** (thay vì Electron) | Bộ cài ~10 MB, RAM thấp, dùng WebView2 có sẵn trên Windows | Cần Rust toolchain để build (giải quyết bằng GitHub Actions) |
| Nội dung desktop | **Tải web production** `https://smartlife.courses` | Đăng nhập, `/api/gemini`, cập nhật tính năng ngay khi deploy web; 1 codebase | Lần đầu cần mạng; sau đó PWA service worker cache |
| Nguồn dữ liệu | Supabase là nguồn sự thật duy nhất | Đã có RLS, Realtime, Auth | — |
| Xung đột | Last-write-wins theo note + lịch sử phiên bản | Đơn giản, đủ cho dùng cá nhân; mất mát được bù bằng versions | Không merge từng ký tự (không phải CRDT) |
| Offline | Cache localStorage + hàng đợi outbox | Không thêm thư viện | Giới hạn ~5 MB |
| Lịch sử | Trigger DB tạo snapshot | Không phụ thuộc client, mọi nền tảng đều được ghi | Thêm dữ liệu → giới hạn 5 phút/bản |

## 5. Mô hình dữ liệu

Xem `sql/sticky_notes_schema.sql`.

- `sticky_notes`: `id, user_id, title, content, color, labels[], is_pinned, is_archived, deleted_at, sort_order, version, created_at, updated_at, last_device`
- `sticky_note_versions`: `id, note_id, user_id, title, content, color, version, device, created_at`
- Trigger `BEFORE UPDATE`: tăng `version`, đặt `updated_at`; nếu `title/content` đổi và chưa có snapshot trong 5 phút → lưu bản cũ vào `sticky_note_versions`.
- Realtime: `sticky_notes` được thêm vào publication `supabase_realtime`.
- Xoá mềm (`deleted_at`) → thùng rác; dọn vĩnh viễn sau 30 ngày (client gọi khi mở thùng rác).

## 6. Đồng bộ & offline

1. Khởi động: đọc cache → hiển thị ngay → tải từ server → hợp nhất.
2. Ghi: cập nhật UI lạc quan → debounce 700 ms → `upsert`. Lỗi mạng → đưa vào outbox (localStorage), thử lại khi `online` / mỗi 30 s.
3. Nhận realtime: bỏ qua sự kiện của note đang được gõ (tránh nhảy con trỏ), áp dụng khi rời focus.
4. Desktop: cửa sổ note nổi đăng ký realtime cho đúng 1 note.

## 7. Thiết kế trải nghiệm (UX)

- **Lưới masonry** màu pastel giống giấy note (7 màu, hỗ trợ dark mode), ghim lên đầu.
- **Thanh công cụ trên note** chỉ hiện khi hover/focus (giảm nhiễu): màu · ghim · AI ✨ · lịch sử · tách cửa sổ (desktop) · lưu trữ · xoá.
- **Tab bộ lọc**: Tất cả · Đã ghim · Lưu trữ · Thùng rác; ô tìm kiếm; chấm màu để lọc.
- **Phím tắt**: `N` note mới, `/` tìm kiếm, `Esc` thoát ô đang gõ.
- **AI là gợi ý, không tự động**: mọi kết quả AI hiện bản xem trước, người dùng xác nhận.
- **Trạng thái đồng bộ** luôn hiển thị (tin cậy là yếu tố số 1 với app ghi chú).
- Mobile: nút "+" nổi, lưới 2 cột; truy cập qua menu "Mở rộng" và nút ở widget Quick Note.

## 8. Rủi ro

| Rủi ro | Giảm thiểu |
|--------|-----------|
| Google OAuth chặn đăng nhập trong WebView | Dùng email/mật khẩu hoặc magic link trên desktop; theo dõi `disallowed_useragent` |
| Ghi đè khi sửa đồng thời 2 thiết bị | Lịch sử phiên bản + hiển thị "Đã cập nhật từ thiết bị khác" |
| Chi phí AI | Dùng chung quota hiện có, prompt ngắn, giới hạn 4.000 ký tự/note |
| Bộ cài chưa ký số → SmartScreen cảnh báo | Ghi rõ hướng dẫn; sau này mua chứng chỉ code signing |

## 9. Lộ trình phát hành

1. **GĐ1** — Chạy `sql/sticky_notes_schema.sql`, deploy web → beta nội bộ.
2. **GĐ3** — Bật AI (dùng quota sẵn có).
3. **GĐ2** — Tạo tag `desktop-v0.1.0` → GitHub Actions build `.msi/.exe` → phát hành Release.
