# SmartLife API v1 — cổng dữ liệu cho AI bên ngoài

## 1. Kiến trúc

```
AI bên ngoài (Custom GPT / Claude MCP / n8n / bot)
   │  Authorization: Bearer sl_live_<48 hex>
   ▼
Vercel Function  /api/v1/*            (api/v1/*.js + api/_lib/authKey.js)
   │  • kiểm tra định dạng key, method, CORS
   │  • gọi supabase.rpc('api_v1_xxx', { p_key, ... }) bằng ANON key
   ▼
Postgres function api_v1_xxx  (SECURITY DEFINER)
   │  1. _api_auth(): sha256(key) → tra api_keys → kiểm tra active / hết hạn / scope / rate limit
   │  2. chỉ đọc-ghi dữ liệu WHERE user_id = key.user_id
   ▼
todos, timetable, transactions, budgets, wallets, debts, goals, habits, ...
```

Lý do chọn thiết kế này:

- **Không dùng Service Role Key.** Server chỉ có anon key (vốn đã công khai trong frontend). Quyền truy cập nằm hoàn toàn ở API key của người dùng.
- **Hash tính trong Postgres.** Nếu Node tự hash rồi gửi hash lên, thì hash sẽ trở thành "chìa khóa" thật — ai đọc được cột `key_hash` sẽ gọi được API. Gửi key gốc và hash trong DB nên cột `key_hash` không dùng làm chìa khóa được. Client cũng không có quyền SELECT cột này.
- **Xác thực và truy vấn cùng một transaction.** Mỗi request chỉ tốn 1 lần gọi DB. `/ai/context` gom toàn bộ dữ liệu trong 1 hàm SQL, nên nhanh và số liệu nhất quán.
- **Mã lỗi**: hàm SQL raise `SQLSTATE 'PTxxx'`, PostgREST trả về HTTP `xxx`, middleware chuyển thành `{ "error": { "code", "message" } }`.
- File trong `api/_lib/` không bị Vercel biến thành function (thư mục bắt đầu bằng `_`), nên không tốn quota 12 function của gói Hobby. Tổng cộng có 9 function.

## 2. Bảng dữ liệu

| Bảng | Mục đích | Quyền client (RLS) |
|---|---|---|
| `api_keys` | `key_prefix`, `key_hash` (SHA-256), `scopes[]`, `is_active`, `expires_at`, `last_used_at`, bộ đếm rate limit | SELECT (trừ `key_hash`, rate limit) và DELETE dữ liệu của mình. Tạo/thu hồi chỉ qua RPC `create_api_key`, `revoke_api_key` |
| `ai_advisor_logs` | Lời khuyên do AI ghi: `category`, `severity`, `title`, `content` (Markdown), `data` | SELECT, DELETE, UPDATE riêng cột `is_read` |

## 3. Scopes

| Scope | Cho phép |
|---|---|
| `read:all` | Mọi scope `*:read` |
| `context:read` | `GET /ai/context` |
| `tasks:read` | `GET /tasks`, `GET /tasks/:id` |
| `tasks:write` | Tạo, sửa, sắp xếp task (bao gồm cả `tasks:read`) |
| `finance:read` | `GET /finance/overview`, `/finance/options`, `/finance/transactions` |
| `finance:write` | Thêm / xóa giao dịch, tự cập nhật số dư ví (bao gồm cả `finance:read`) |
| `insights:write` | `POST /ai/insights` (bao gồm cả `insights:read`) |

Giới hạn: 120 request/phút/key, tối đa 10 key đang hoạt động, 200 task tạo mới/giờ, 200 insight/ngày.

## 4. Endpoints

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/api/v1/ai/context?tz=` | Gọi đầu tiên. `user`, `tasks` (counts, overdue, due_next_48h, top_priority, today_timetable, today_events), `finance` (số dư, chi/ngân sách, `categories_at_risk`, `upcoming_recurring_7d`, nợ, mục tiêu tiết kiệm, `risk_flags`), `productivity` (sao, streak thói quen, phút tập trung, mood nhật ký) |
| GET | `/api/v1/tasks` | `status`, `priority` (phân tách bằng dấu phẩy), `due_from`, `due_to`, `overdue`, `q`, `limit`, `offset`. Mặc định bỏ qua task done |
| GET | `/api/v1/tasks/:id` | |
| POST | `/api/v1/tasks` | `{ title, description?, status?=backlog, priority?=focus, deadline?, scheduled_date?, scheduled_time?, subtasks?: string[] }` |
| PATCH | `/api/v1/tasks/:id` | Chỉ các trường gửi lên. `status: "done"` sẽ ghi `completed_at` |
| POST | `/api/v1/tasks/reorder` | `{ ids: [...], status? }`. Phần tử đầu nằm trên cùng. Task khác trong cùng cột xếp phía sau, giữ thứ tự cũ |
| GET | `/api/v1/finance/overview?month=YYYY-MM` | Chi theo danh mục kèm `status` (ok/warning/over/no_budget), so với tháng trước, dự báo, `safe_daily_spend`, dòng tiền định kỳ |
| GET | `/api/v1/finance/options` | Ví (id, tên, số dư) và các danh mục hay dùng |
| GET | `/api/v1/finance/transactions?from=&to=&type=&category=&q=` | Có sẵn `total_expense`, `total_income`, `summary` |
| POST | `/api/v1/finance/transactions` | `{ amount, category, type?=expense, description?, date?, wallet? }` — cập nhật số dư ví như app |
| DELETE | `/api/v1/finance/transactions/:id` | Hoàn lại số dư ví; không xóa được giao dịch gắn với sổ nợ |
| GET/POST | `/api/v1/ai/insights` | `{ title, content, category?, severity?, data? }` |
| GET | `/api/v1/me` | Kiểm tra key |
| GET | `/api/v1/openapi.json` | Công khai, dùng để import vào GPT Actions / n8n |

Mức ưu tiên: API dùng nhãn giao diện `urgent / focus / chill / temp`, DB lưu `high / medium / low / temp`. API nhận cả hai dạng.

## 5. MCP server cho Claude & Gemini — `POST /api/mcp`

`api/mcp.js` là MCP server chạy kiểu Streamable HTTP, stateless, trả về JSON. Nó dùng lại các hàm `api_v1_*`, nên scope và rate limit giống hệt REST API.

Có 13 tool: `get_context`, `list_tasks`, `get_task`, `create_task`, `update_task`, `reorder_tasks`, `get_finance_overview`, `list_transactions`, `get_finance_options`, `add_transaction`, `delete_transaction`, `list_insights`, `create_insight`.

| Ứng dụng | Cấu hình |
|---|---|
| Claude Code | `claude mcp add --transport http smartlife https://<domain>/api/mcp --header "Authorization: Bearer <key>"` |
| Claude Desktop | `claude_desktop_config.json` → `npx -y mcp-remote https://<domain>/api/mcp --header Authorization:${AUTH_HEADER}`, với `env.AUTH_HEADER = "Bearer <key>"` (cần Node.js) |
| claude.ai (web) | Settings → Connectors → Add custom connector → `https://<domain>/api/mcp?key=<key>`. Nên dùng một key riêng, chỉ đọc |
| Gemini CLI | `~/.gemini/settings.json` → `mcpServers.smartlife = { httpUrl, headers: { Authorization: "Bearer <key>" } }` |
| Gemini API / AI Studio | Tự khai báo function calling rồi gọi REST `/api/v1/*` |

Ứng dụng Gemini (gemini.google.com, Gems) hiện chưa gọi được API bên ngoài.

Tab **Cài đặt → AI & API** có sẵn đoạn cấu hình để copy cho từng ứng dụng.

## 6. Triển khai

1. Supabase SQL Editor: chạy `sql/api_v1_external_ai.sql`.
2. Vercel env (đã có sẵn nếu `api/gemini.js` đang chạy): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Có thể thêm `PUBLIC_APP_URL=https://<domain>` để cố định `servers.url` trong openapi.json.
3. Frontend (tùy chọn): `VITE_PUBLIC_APP_URL=https://<domain>` để tab "AI & API" hiển thị đúng URL khi chạy trong app mobile (Capacitor).
4. Deploy. Vào **Cài đặt → AI & API → Tạo key**, rồi bấm "Kiểm tra kết nối".

`npm run dev` (Vite) không chạy được `/api/v1/*`. Khi chạy local, dùng `vercel dev`.

## 7. Ví dụ

```bash
KEY=sl_live_...
BASE=https://<domain>

curl -s "$BASE/api/v1/ai/context" -H "Authorization: Bearer $KEY"

curl -s "$BASE/api/v1/tasks?status=todo,doing&priority=urgent" -H "Authorization: Bearer $KEY"

curl -s -X POST "$BASE/api/v1/tasks/reorder" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -d '{"ids":["<id1>","<id2>","<id3>"],"status":"todo"}'

curl -s -X POST "$BASE/api/v1/ai/insights" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Ăn uống đã dùng 92% ngân sách","severity":"warning","category":"finance","content":"Còn 9 ngày, nên giữ dưới **85.000đ/ngày**."}'
```

## 8. Bot Telegram — `api/telegram.js`

Bot cá nhân dùng Gemini (function calling) và chung bộ tool với MCP (`api/_lib/tools.js`). Bot chỉ trả lời `TELEGRAM_ALLOWED_CHAT_ID`.

Biến môi trường trên Vercel: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_ALLOWED_CHAT_ID`, `SMARTLIFE_API_KEY`, cùng `GEMINI_API_KEYS` đã có sẵn.

Cài webhook: mở `https://<domain>/api/telegram?setup=<TELEGRAM_WEBHOOK_SECRET>`.

Tính năng:
- **Nhận diện giọng nói (Voice Multimodal)**: Giữ mic nói giao dịch chi tiêu (vd: *"Trưa nay ăn bún chả 45 ngàn"*), Gemini nhận diện số tiền & phân loại danh mục, gửi lại thẻ giao diện hiện đại kèm 2 nút bấm tương tác: **✨ Xác nhận ghi sổ** hoặc **❌ Hủy bỏ**.
- **Hỏi đáp qua Voice**: Nếu gửi voice câu hỏi thông thường (vd: *"Hôm nay tôi có bao nhiêu tiền?"*), bot tự động chuyển text và trả lời ngay.
- Lệnh: `/today`, `/finance`, `/overdue`, `/spend 45k ăn trưa`, `/debug` (hiện các tool đã gọi), `/reset`, `/id`. Bot nhớ 10 tin nhắn gần nhất.

## 9. Tự động thông báo & Nhắc việc qua Telegram — `api/cron-telegram.js`

Endpoint tự động hóa gửi thông báo lịch trình, task và tổng kết ngày qua Telegram bot:
- **8h00 Sáng**: Gửi Morning Briefing (lịch học/sự kiện hôm nay, task ưu tiên, task quá hạn, số dư ví, tiến độ thói quen).
- **14h00 Chiều**: Gửi Afternoon Check-in (nhắc nhở các task đến hạn & sắp đến hạn trong 48h, task quá hạn, lịch học/sự kiện buổi chiều, gợi ý mục tiêu cho ca chiều).
- **22h00 Tối**: Gửi Evening Review (tiến độ task đã xong, nhắc nhở ghi chép chi tiêu bằng `/spend`).
- **Cảnh báo hạn chót**: Tự động lọc các task sắp đến hạn trong 48h và task quá hạn.

Kích hoạt hoặc test thủ công:
- Test tin nhắn sáng: `https://<domain>/api/cron-telegram?key=smartlife2026&type=morning`
- Test tin nhắn chiều (14h): `https://<domain>/api/cron-telegram?key=smartlife2026&type=afternoon`
- Test tin nhắn tối: `https://<domain>/api/cron-telegram?key=smartlife2026&type=evening`
- Tự động: Vercel Cron chạy theo cấu hình trong `vercel.json` hoặc thiết lập qua dịch vụ cron định kỳ.

Thu/chi luôn bỏ qua danh mục "Điều chỉnh số dư" (giống app). Các kết quả tài chính đều có trường `summary` đã định dạng sẵn, để AI trích dẫn thay vì tự tính.
