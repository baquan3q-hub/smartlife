# Sticky Notes — Nâng cấp Rich Text (ảnh · bảng · link · đậm/nghiêng) & Export (Markdown · PDF)

> Trạng thái: **Kế hoạch** · Ngày: 2026-11-02 · Liên quan: [PRD.md](PRD.md), `sql/sticky_notes_schema.sql`

---

## 1. Hiện trạng (đọc từ source)

| Thành phần | Hiện tại | Ảnh hưởng tới nâng cấp |
|---|---|---|
| `sticky_notes.content` | `TEXT`, văn bản thuần | Phải chọn định dạng lưu rich text |
| Editor | `<textarea>` ở `StickyNoteCard.tsx` và `StickyWindowApp.tsx` | Thay bằng editor WYSIWYG |
| Lưu / đồng bộ | `useStickyNotes`: debounce 700ms, **mỗi phím ghi outbox (localStorage)**, inflight 1 request/note, realtime last-write-wins theo `updated_at` | Editor mới phải giữ nguyên cam kết “không mất dữ liệu” |
| Lịch sử | Trigger chụp `title/content` cũ, tối đa 1 bản/5 phút, giữ 50 bản | Mọi thứ nằm trong `content` sẽ bị nhân tối đa 50 lần → **không được nhét ảnh base64 vào content** |
| Cache offline | `localStorage` (giới hạn ~5MB toàn origin) | Như trên |
| Tìm kiếm / tiêu đề cửa sổ / preview danh sách | `content.toLowerCase().includes(q)`, `content.split('\n')` | Cần hàm bỏ cú pháp Markdown trước khi tìm / hiển thị |
| AI (`stickyNoteAIService`) | Gửi `content` (cắt 4000 ký tự), `rewrite` yêu cầu “văn bản thuần” và **ghi đè content** | Phải giữ ảnh/bảng khi AI viết lại |
| Desktop (Tauri) | Tải `https://www.smartlife.courses/` (remote) → giao diện tự cập nhật. Lệnh app ↔ web đi qua điều hướng bị chặn (không IPC) | Lưu file export & mở link ngoài cần kiểm tra trên WebView2 |
| Mobile (Capacitor) | `webDir: dist` — bundle đóng gói sẵn | **Máy chưa cập nhật app vẫn chạy textarea cũ** → định dạng lưu phải đọc được bằng mắt thường |
| Thư viện sẵn có | `react-markdown`, `remark-gfm`, `jspdf`, `html2canvas` | Tận dụng cho preview & AST Markdown |

---

## 2. Quyết định kỹ thuật cốt lõi

### 2.1 Định dạng lưu: **Markdown (GFM) trong cột `content`** + cột mới `content_format`

> **Cập nhật sau Spike (2026-11-02): BỎ cột `content_format`, không cần migration SQL.**
> Thử nghiệm với Tiptap 3.32 + `@tiptap/markdown`: parse → serialize ổn định (idempotent) với đậm/nghiêng/link/list/checklist/bảng/ảnh;
> văn bản thuần cũ giữ nguyên chuỗi khi chỉ mở. Vì vậy note cũ được đọc thẳng như Markdown (dòng `- ` thành danh sách — đúng ý người viết
> trong đa số trường hợp), chuỗi gốc chỉ đổi khi người dùng sửa và trigger vẫn chụp bản cũ vào lịch sử.
> Lợi ích: không phải chạy SQL trên production trước khi deploy → tránh rủi ro client mới gửi cột chưa tồn tại làm hỏng hàng đợi outbox.
> Phần mô tả `content_format` bên dưới giữ lại để tham khảo.

| Phương án | Ưu | Nhược |
|---|---|---|
| **A. Markdown GFM trong `content`** ✅ | Không đổi schema lớn; tìm kiếm, AI, lịch sử, outbox, realtime giữ nguyên; client cũ vẫn đọc được; export Markdown gần như miễn phí | Bảng GFM hạn chế (không gộp ô, ô 1 dòng); cần kiểm soát round-trip |
| B. JSON ProseMirror ở cột mới + `content` làm bản text | Không mất định dạng | 2 nguồn sự thật; client cũ sửa `content` → lệch JSON; outbox/merge phức tạp gấp đôi |
| C. HTML | Linh hoạt | Rủi ro XSS, khó diff/AI, client cũ thấy thẻ HTML |

**Chọn A.** Giới hạn tính năng editor đúng bằng những gì GFM biểu diễn được (đậm, nghiêng, link, ảnh, bảng không gộp ô, danh sách, checklist, tiêu đề) → round-trip không mất dữ liệu.

**`content_format`** (`'plain' | 'md'`, mặc định `'plain'`):
- Note cũ = `plain`. Khi mở bằng editor mới, văn bản được nạp **như đoạn văn thuần** (không parse Markdown) → ký tự `*`, `#`, `_` người dùng gõ trước đây không tự biến thành định dạng.
- Lần sửa đầu tiên: chụp snapshot → serialize ra Markdown (có escape) → lưu `content_format = 'md'`. Không chạy migration hàng loạt.
- Note mới tạo bởi client mới = `md`.

### 2.2 Editor: **Tiptap 3 (ProseMirror)** + extension Markdown

- Lý do: React 19 OK, có sẵn Bold/Italic/Link/Image/Table/TaskList, input rules kiểu Markdown (`**x**`, `# `), paste ảnh, schema chặt (chỉ node đã khai báo → tự lọc HTML lạ khi paste).
- Phương án dự phòng: Milkdown (Markdown-first, dùng remark giống `react-markdown`). Chọn dứt điểm ở bước Spike.
- **Lazy-load** editor (`React.lazy`) để không tăng bundle trang chủ.

### 2.3 Ảnh: **lưu LOCAL trên thiết bị (IndexedDB)** — không dùng Supabase Storage

> Đã chốt với chủ sản phẩm (2026-11-02): ảnh chỉ lưu trên máy để không tốn dung lượng Supabase.

- Lưu blob ảnh trong IndexedDB `smartlife_sticky_images` (cùng pattern `taskAttachmentService`): `{ id, user_id, note_id, mime, width, height, size, data: Blob, created_at }`, index theo `note_id`.
- Trong Markdown chỉ có tham chiếu: `![mô tả](sticky-img://{uuid})` — **không lưu base64 vào `content`** (phình row Supabase, nhân 50 lần ở lịch sử, vỡ localStorage, vượt payload realtime → trái với mục tiêu tiết kiệm).
- Khi hiển thị: tra IndexedDB → `URL.createObjectURL` (thu hồi khi unmount).
- Xử lý trước khi lưu: chỉ nhận `png/jpeg/webp/gif` (**chặn SVG**); tối đa 10MB đầu vào; resize cạnh dài ≤ 1600px, nén WebP ~0.82 (vài trăm KB/ảnh); bỏ EXIF/GPS nhờ vẽ lại qua canvas.
- **Hệ quả cần chấp nhận** (hiển thị rõ cho người dùng):
  - Ảnh **không đồng bộ** giữa các thiết bị. Máy khác (hoặc trình duyệt khác) thấy khung *“🖼 Ảnh chỉ có trên thiết bị đã chèn”* thay cho ảnh; chữ, bảng, link vẫn đồng bộ bình thường.
  - App Windows (cửa sổ chính + mọi note nổi) dùng chung một kho vì cùng WebView2 profile & origin → thấy ảnh của nhau. Web trên Chrome và app Windows là **2 kho khác nhau**.
  - Xoá dữ liệu trình duyệt / gỡ app → mất ảnh. Gọi `navigator.storage.persist()` để trình duyệt không tự dọn, và nhắc người dùng **Export (Markdown .zip / PDF) để giữ bản có ảnh**.
- **Dọn rác**: ảnh sống cùng vòng đời note (lịch sử phiên bản có thể còn tham chiếu). Xoá vĩnh viễn / purge thùng rác 30 ngày → xoá ảnh của note đó; khi tải danh sách, dọn ảnh của note không còn tồn tại.
- **Giới hạn**: ≤ 20 ảnh/note; hiển thị dung lượng đã dùng (`navigator.storage.estimate()`).
- Chèn ảnh bằng: nút toolbar, kéo-thả, **dán từ clipboard** (Win+Shift+S → Ctrl+V trên note nổi), chụp ảnh trên mobile (`accept="image/*" capture`).

### 2.4 Link

- Chỉ cho phép `http:`, `https:`, `mailto:`; mọi scheme khác (`javascript:`, `data:`, `file:`) bị loại ở cả editor và renderer.
- Tự nhận URL khi gõ/dán; Ctrl+K mở ô sửa link; hover hiện URL đầy đủ (chống link giả).
- Mở bằng Ctrl+Click trong lúc soạn (click thường = đặt con trỏ); `target="_blank" rel="noopener noreferrer"`.
- **Desktop**: link phải mở bằng trình duyệt mặc định, không mở trong cửa sổ note → thêm lệnh `open-external` vào `desktopBridge`/`main.rs` (cần bản Rust mới; bản cũ fallback `window.open`).

### 2.5 Hiển thị read-only (lịch sử phiên bản, preview thẻ)

- Dùng `react-markdown` + `remark-gfm` sẵn có, **không bật `rehype-raw`** (không render HTML thô) + `urlTransform` lọc scheme như mục 2.4 + component `img` tự đổi `sticky-img://`.
- Một hàm `markdownToPlainText()` dùng chung cho: tìm kiếm, `noteHeading()`, preview danh sách, tiêu đề cửa sổ, nội dung gửi AI.

### 2.6 Export

**Markdown**
- 1 note không ảnh → `Tieu-de.md` có front-matter (`title`, `labels`, `created`, `updated`).
- 1 note có ảnh → `.zip` (`Tieu-de.md` + `images/…`, link ảnh đổi sang đường dẫn tương đối). Tuỳ chọn thay thế: “1 file .md nhúng ảnh base64” cho ai cần đúng một file.
- Nhiều note (đã chọn / theo nhãn / tất cả) → `.zip`, mỗi note một file. Dùng `fflate` (nhẹ, ~8KB gz).
- Tên file: bỏ dấu, loại ký tự cấm trên Windows (`\/:*?"<>|`), tối đa 80 ký tự, chống trùng tên.

**PDF** — so sánh:

| Cách | Chữ chọn được / link bấm được | Tiếng Việt | Chạy trên mobile | Ghi chú |
|---|---|---|---|---|
| `html2canvas` + `jsPDF` (như CVBuilder) | ❌ ảnh chụp | ✅ | ✅ | File nặng, ngắt trang cắt ngang dòng chữ |
| `window.print()` + CSS in | ✅ | ✅ | ❌ Android WebView | Phải qua hộp thoại in, UX không đồng nhất |
| **`pdfmake` dựng từ AST Markdown** ✅ | ✅ | ✅ (font Roboto có dấu tiếng Việt — kiểm chứng ở Spike) | ✅ | Hỗ trợ sẵn bảng, ảnh, đậm/nghiêng, link; lazy-load (~1MB chỉ tải khi export) |
| Render phía server (FastAPI + WeasyPrint/Playwright) | ✅ | ✅ | ✅ | Tốn hạ tầng, gửi nội dung lên server |

**Chọn `pdfmake`**: parse Markdown bằng `remark` (đã có) → map node sang pdfmake (heading, đoạn, list, checklist ☐/☑, bảng, ảnh đã tải về dạng dataURL, link). Header: tiêu đề + nhãn; footer: số trang + ngày xuất. Giữ màu note làm dải màu đầu trang (tuỳ chọn).

**Lưu file theo nền tảng** (một adapter `saveFile(blob, filename)`):
- Web: Blob + `<a download>`.
- Windows (WebView2): kiểm chứng ở Spike rằng tải Blob vẫn hoạt động trong cửa sổ Tauri (handler `on_download`). Không truyền nội dung qua URL lệnh (giữ nguyên quyết định bảo mật ở PR #83).
- Mobile (Capacitor): `<a download>` không chạy trong WebView → thêm `@capacitor/filesystem` + `@capacitor/share` (lưu vào Documents rồi mở bảng chia sẻ).

---

## 3. Bảo vệ dữ liệu & tương thích ngược

1. **Migration chỉ thêm, không sửa/xoá** (an toàn chạy lại):
   ```sql
   ALTER TABLE public.sticky_notes
     ADD COLUMN IF NOT EXISTS content_format TEXT NOT NULL DEFAULT 'plain'
     CHECK (content_format IN ('plain','md'));
   ALTER TABLE public.sticky_note_versions
     ADD COLUMN IF NOT EXISTS content_format TEXT NOT NULL DEFAULT 'plain';
   ALTER TABLE public.sticky_notes
     ADD CONSTRAINT sticky_notes_content_len CHECK (char_length(content) <= 100000) NOT VALID;
   ```
   Trigger `sticky_notes_before_update` chụp thêm `content_format` và coi đổi format là thay đổi nội dung. Bucket + policy `storage.objects` theo `(storage.foldername(name))[1] = auth.uid()::text`.
2. **Không có lần lưu “ma” khi mở note**: Markdown serialize lại có thể khác chuỗi gốc (`*` ↔ `_`, khoảng trắng). Chỉ gọi `updateNote` khi transaction đến từ người dùng (`docChanged` và không phải `setContent`), nếu không mỗi lần mở note sẽ tăng `version`, sinh snapshot và bắn realtime sang máy khác.
3. **Realtime khi đang soạn**: giữ cơ chế `setEditing`/`deferredRemote`. Khi note rảnh và có bản remote mới → `editor.commands.setContent(md, { emitUpdate: false })`, giữ vị trí con trỏ nếu được.
4. **Giữ cam kết mỗi phím vào outbox**: serialize Markdown ở `onUpdate` (note cỡ sticky < 1ms) → `updateNote` như hiện tại. `pagehide` / `__smartlifeSaveNow` vẫn flush như cũ.
5. **Client cũ (mobile chưa cập nhật)**: thấy Markdown thô nhưng đọc được, sửa được. Ảnh hiển thị dạng `![…](sticky-img://…)` — chấp nhận được; bật banner “Cập nhật app để xem ảnh”.
6. **AI**: trước khi gửi, thay ảnh bằng placeholder `[[IMG_1]]`, giữ bảng Markdown; đổi prompt `rewrite` sang “trả về Markdown GFM, giữ nguyên mọi placeholder `[[IMG_n]]`”; khi áp kết quả, kiểm tra đủ placeholder → nếu thiếu, cảnh báo trước khi ghi đè (vẫn có snapshot như hiện tại). Không gửi ảnh lên AI.
7. **Feature flag** `sticky_rich_editor` (localStorage + biến môi trường) để bật dần; tắt flag → quay về textarea hiển thị Markdown thô, **không mất dữ liệu**.
8. **Kiểm thử tự động** (hiện repo chưa có test runner → thêm `vitest`): bộ mẫu round-trip `md → editor → md` phải ổn định (idempotent); `plain → md` không làm đổi nghĩa văn bản; lọc URL độc hại; tên file export; chuyển AST → pdfmake.

---

## 4. Trải nghiệm người dùng

- **Bảng thẻ (dashboard)**: toolbar gọn hiện khi focus: **B** · *I* · 🔗 · 🖼 · ▦ bảng · ☑ checklist · ⋯. Bubble menu khi bôi đen chữ. Phím tắt Ctrl+B / Ctrl+I / Ctrl+K.
- **Note nổi (cửa sổ nhỏ)**: không thêm hàng toolbar cố định (tốn chỗ). Dùng bubble menu khi chọn chữ + nút “Aa” trên thanh hiện có để bật/tắt toolbar định dạng; vẫn hỗ trợ cú pháp Markdown và dán ảnh.
- **Bảng**: chèn 3×3, Tab sang ô kế, menu thêm/xoá hàng-cột; cuộn ngang trên màn hình hẹp; không có gộp ô (giới hạn GFM, có tooltip giải thích).
- **Ảnh**: placeholder + thanh tiến độ khi đang tải lên; biểu tượng “chờ đồng bộ” khi offline; click để xem lớn; kéo góc để đổi cỡ (lưu dạng `![alt](url "w=320")` hoặc bỏ qua ở v1).
- **Export**: menu ⋯ của thẻ và cửa sổ nổi → “Xuất Markdown” / “Xuất PDF”; dashboard có chế độ chọn nhiều → “Xuất (.zip)”. Toast báo kết quả + đường dẫn (desktop/mobile).
- **Accessibility**: nút có `aria-label`, trạng thái `aria-pressed` cho B/I, ảnh bắt buộc có alt (mặc định tên file).

---

## 5. Kế hoạch triển khai (mỗi giai đoạn = 1 PR, chạy `/code-review` trước khi merge)

| # | Giai đoạn | Việc chính | Đầu ra / tiêu chí xong | Ước lượng |
|---|---|---|---|---|
| 0 | **Spike** | Thử Tiptap 3 + Markdown round-trip với ~30 mẫu note thật; pdfmake + tiếng Việt có dấu; tải Blob trong cửa sổ Tauri; Filesystem/Share trên Android | Ghi chú kết quả, chốt thư viện | 1–2 ngày |
| 1 | **Nền dữ liệu** | Migration SQL (`content_format`, CHECK độ dài, trigger), type `StickyNote`, util `markdownToPlainText`, `sanitizeUrl`, thêm `vitest` + test | Note cũ không đổi gì; tìm kiếm/preview dùng util mới | 1–2 ngày |
| 2 | **Editor rich text** | `RichNoteEditor` (bold, italic, link, bảng, checklist), thay textarea ở `StickyNoteCard` + `StickyWindowApp`; read-only bằng `react-markdown` cho `StickyHistoryModal`; chuyển `plain → md` khi sửa; chặn lưu ma; feature flag; cập nhật AI | Gõ / offline / đóng cửa sổ không mất chữ; realtime 2 máy ổn | 4–5 ngày |
| 3 | **Ảnh (local)** | Kho IndexedDB `stickyImageStore`; nén WebP; node ảnh đọc `sticky-img://`; khung “ảnh chỉ có trên thiết bị đã chèn”; dán/kéo-thả/chụp; dọn ảnh khi xoá vĩnh viễn & purge; `storage.persist()` | Ảnh hiện cả khi offline; không byte ảnh nào lên Supabase | 2–3 ngày |
| 4 | **Export** | Adapter `saveFile` (web/Tauri/Capacitor); Markdown (.md, hoặc .zip khi có ảnh); PDF bằng pdfmake (lazy) nhúng ảnh từ IndexedDB; xuất 1 note và nhiều note | File mở đúng trên Windows/Android, chữ có dấu, bảng, ảnh, link bấm được | 3–4 ngày |
| 5 | **Desktop & phát hành** | Lệnh `open-external` trong `main.rs`, build Windows mới; build mobile mới; bật flag theo đợt (nội bộ → 10% → 100%) | Không có báo lỗi mất dữ liệu sau 1 tuần | 2–3 ngày |

**Tổng: ~3–4 tuần** cho 1 người.

### Ma trận kiểm thử thủ công (giai đoạn 2–5)
- Web Chrome/Edge/Safari · Windows app (note nổi + cửa sổ chính) · Android · iOS.
- Kịch bản: gõ rồi tắt mạng → đóng app → mở lại; sửa cùng note trên 2 máy; chèn ảnh khi offline; khôi phục phiên bản có ảnh; AI viết lại note có bảng + ảnh; note cũ dạng plain có ký tự `* # _ |`; note 50.000 ký tự; export note rỗng / chỉ có ảnh / tiêu đề có ký tự đặc biệt.

---

## 6. Rủi ro & cách giảm

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Round-trip Markdown làm đổi nội dung | Cao | Giới hạn tính năng theo GFM, test idempotent, chặn lưu ma, snapshot trước lần chuyển đầu |
| Mất ảnh khi xoá dữ liệu trình duyệt / đổi máy (ảnh local) | Trung bình | `storage.persist()`, cảnh báo rõ trong UI, khuyến khích Export .zip/PDF |
| XSS qua link / ảnh SVG / HTML dán vào | Cao | Schema Tiptap chặt, lọc scheme, chặn SVG, không `rehype-raw` |
| Client mobile cũ ghi đè format | Trung bình | Markdown vẫn là văn bản; client cũ không đổi `content_format` |
| Bundle tăng (Tiptap ~150KB, pdfmake ~1MB) | Trung bình | Lazy-load editor, chỉ tải pdfmake khi bấm xuất |
| Tải file trong WebView2 / Capacitor | Trung bình | Kiểm chứng ở Spike, adapter theo nền tảng |
| Đầy bộ nhớ trình duyệt do ảnh | Thấp | Nén WebP, ≤ 20 ảnh/note, dọn theo vòng đời note, hiển thị dung lượng đã dùng |

---

## 7. Quyết định đã chốt (2026-11-02)

- Ảnh lưu **local (IndexedDB)**, chấp nhận không đồng bộ giữa thiết bị.
- Export v1: **từng note + nhiều note** (.md / .zip / .pdf).
- PDF: **nền trắng, dải màu note ở đầu trang**.
- Lộ trình: làm đủ các giai đoạn, **mỗi giai đoạn 1 PR**, `/code-review` trước khi merge, có feature flag.

## 8. Câu hỏi ban đầu (lưu lại)

1. ~~Hạn mức ảnh theo gói~~ → đã chốt: ảnh lưu local (IndexedDB), không tốn Supabase.
2. Export PDF có cần giữ màu nền note hay xuất nền trắng cho dễ in?
3. Ảnh có cần đổi kích thước trong note ở v1 không, hay để v2?
4. Có cần export nhiều note cùng lúc ngay v1 không?
