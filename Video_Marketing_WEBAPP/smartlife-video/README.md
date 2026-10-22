# SmartLife — video launch (Remotion)

Video demo ~3 phút, 1920×1080 @ 30fps, dựng hoàn toàn bằng code (React + Remotion).
Cảnh, chuyển cảnh và hiệu ứng âm thanh đều bám theo nhịp (beat) của nhạc nền.

## Thay nhạc nền

1. Chép file nhạc vào `../music/bgm.mp3` (hoặc .wav/.m4a/.aac/.ogg/.flac), dài ≥ 3 phút 10 giây.
2. `npm run beats` — đo BPM + phách đầu, ghi `src/beats.json`, chép nhạc vào `public/`.
3. `npm run render` — xuất `../output/SmartLife_Launch_1080p.mp4`.

Mọi cảnh tự co giãn theo số ô nhịp (bar) của bài mới, nên không cần sửa code.
Chưa có nhạc thì video dùng nhạc tạm 120 BPM (`public/sfx/placeholder-bgm.wav`).

## Lệnh khác

- `npm run studio` — xem trước, tua từng khung hình trong trình duyệt.
- `npm run sfx` — tạo lại hiệu ứng âm thanh (`public/sfx/*.wav`, tổng hợp bằng code, không vướng bản quyền).
- `node scripts/stills.mjs <thư-mục> <frame> [frame…]` — xuất ảnh tĩnh để kiểm tra bố cục.

## Sửa nội dung

- Thứ tự cảnh, độ dài, kiểu chuyển cảnh: `src/timeline.ts`.
- Chữ và chuyển động từng cảnh: `src/scenes/*.tsx` (`**chữ**` = tô gradient, `\n` = xuống dòng).
- Màu, font: `src/theme.ts`.
