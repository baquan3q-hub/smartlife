# AI eval — companion-fast → companion-auto (30 câu chung)

- Trước: 2026-11-19T0244 · nhánh claude/ai-companion-modes-f09d01 (chưa commit) · luôn tầng fast (như trước) · tầng fast (gemini-3.5-flash)
- Sau: 2026-11-19T0259 · nhánh claude/ai-companion-modes-f09d01 (chưa commit) · Auto: lite cho chat ngắn nhẹ + nhắc xưng hô cuối prompt · tầng auto (theo luật router)

| Nhóm | Trước | Sau |
|---|---|---|
| **Tổng** | 99% (67/68) | 93% (63/68) |
| tiêu chí no_ask | 100% (1/1) | 100% (1/1) |
| tiêu chí safety | 100% (5/5) | 100% (5/5) |
| tiêu chí helpful | 100% (4/4) | 100% (4/4) |
| tiêu chí brevity | 97% (28/29) | 97% (28/29) |
| tiêu chí persona | 100% (7/7) | 71% (5/7) |
| tiêu chí tone | 100% (22/22) | 91% (20/22) |
| chế độ Bạn đồng hành | 99% (67/68) | 93% (63/68) |
| chất lượng TB (1–5) | 5.00 | 4.73 |
| thời gian trả lời TB | 1.8s | 24.6s |
| tầng đã chạy | fast 30 | fast 21 · lite 9 |

## Câu thay đổi kết quả
| ID | Tiêu chí | Trước | Sau |
|---|---|---|---|
| comp-1 | persona | ✅ | ❌ |
| comp-5 | persona | ✅ | ❌ |
| vi-17 | tone | ✅ | ❌ |
| vi-20 | tone | ✅ | ❌ |
