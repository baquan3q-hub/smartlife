# Bộ hội thoại "AI người bạn tiếng Việt"

`vi_friend_dialogues.jsonl` chứa 30 hội thoại mẫu, mỗi dòng là một bản ghi `{"messages":[system, user, assistant, …]}`. Định dạng này dùng được ngay để fine-tune theo kiểu chat.

## Nguồn
- Tài liệu "AI người bạn · Thiết kế hội thoại tiếng Việt" (bản nghiên cứu ngày 19/11/2026) do chủ dự án cung cấp.
- Tài liệu đó dựa trên các nghiên cứu sau:
  - Brandtzaeg, Skjuve & Følstad (2022), *Human Communication Research*, doi:10.1093/hcr/hqac008: tính tương hỗ, niềm tin, sự tương đồng và tính sẵn có trong quan hệ bạn bè với chatbot.
  - Ta và cộng sự (2020), *JMIR*: hỗ trợ xã hội qua Replika.
  - ViLexNorm (Nguyen, Le & Nguyen, EACL 2024): chuẩn hoá từ ngữ mạng xã hội tiếng Việt.
- Toàn bộ 30 hội thoại đều được viết mới, không lấy từ dữ liệu chat thật.

## Cách app đang dùng bộ mẫu
App chưa fine-tune mô hình, vì SmartLife gọi Gemini qua API và 30 mẫu là quá ít để fine-tune. Bộ mẫu đang được dùng qua prompt như sau:
- `src/services/ai/companion/dataset.ts` là bản TypeScript của cùng 30 mẫu, có thêm nhãn tình huống (`tags`) và kiểu xưng hô (`pronoun`). Test `dataset.test.ts` kiểm tra để hai bản không lệch nhau.
- `examples.ts` chọn 4–6 mẫu hợp với tin nhắn hiện tại và đưa vào prompt chế độ Bạn đồng hành.
- `style.ts` chứa quy tắc giọng nói và từ điển teencode, lấy từ mục 2 và 3 của tài liệu.

## Giới hạn
- Chỉ có 30 mẫu và chưa được người dùng Việt thật duyệt. Tài liệu gốc cũng ghi rõ điều này.
- Mẫu chủ yếu theo giọng người trẻ, ngang vai. Chưa xét tới vùng miền và độ tuổi khác.
- 23/30 mẫu dùng xưng hô t–m, vốn là lựa chọn của người dùng trong mẫu. Khi đưa vào prompt, app luôn nói rõ rằng xưng hô trong ví dụ chỉ để minh hoạ.
- Mẫu 28 (hỏi ai đọc được chat) không được đưa vào prompt. App trả lời bằng thông tin thật thay cho câu "chưa có thông tin" trong mẫu: chat được lưu trong tài khoản, nội dung được gửi tới Google Gemini để tạo câu trả lời, và người dùng có thể xoá cuộc trò chuyện.
- Muốn fine-tune thật thì cần thêm nhiều mẫu, có người Việt duyệt, và giữ riêng một tập kiểm thử không trùng tình huống với tập học (xem mục 6 của tài liệu).
