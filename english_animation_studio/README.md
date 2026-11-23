# 🎬 ENGLISH ANIMATION STUDIO - DÂY CHUYỀN SẢN XUẤT VIDEO HOẠT HÌNH TIẾNG ANH 2D

Dự án này là hệ thống đóng gói tự động tạo nội dung (Audio, Subtitles, Storyboard) cho kênh YouTube/TikTok hoạt hình tiếng Anh A1–A2 dạng câu chuyện đời thường.

---

## 📂 CẤU TRÚC THƯ MỤC DỰ ÁN

```
english_animation_studio/
│
├── generator.py                      # Script tự động hoá sinh Audio đa nhân vật + File Subtitle song ngữ
├── README.md                         # Tài liệu hướng dẫn quy trình vận hành
│
└── episodes/
    └── ep01_giant_coffee/            # Tập 1: The Giant Coffee
        ├── script.json               # Dữ liệu kịch bản: nhân vật, thoại, vietsub, visual cues, thời gian dừng
        ├── storyboard.md             # Bảng phân cảnh chi tiết dựng hoạt họa
        ├── audio/                    # Toàn bộ file âm thanh tách riêng từng câu
        ├── scenes/                   # 9 hình ảnh phân cảnh 2D hoạt họa và thẻ học 1080p
        ├── ep01_subtitles_bilingual.srt  # Phụ đề song ngữ dạng chuẩn
        ├── ep01_karaoke.ass          # Phụ đề Karaoke cao cấp: Chữ chạy đổi màu VÀNG theo giọng nói
        ├── ep01_master_audio.mp3     # File âm thanh tổng (Master track)
        └── ep01_the_giant_coffee_final.mp4 # Video MP4 1080p Full HD xuất bản hoàn chỉnh
```

---

## ⚡ BỘ CÔNG CỤ ĐÃ THIẾT LẬP (TECH STACK)

1. **Python 3.12 + `edge-tts`:**
   - Hoàn toàn miễn phí, không giới hạn ký tự.
   - Giọng người thật chất lượng cao của Microsoft Neural TTS:
     - **Leo:** `en-US-GuyNeural` (Giọng nam trẻ, năng động, hơi ngố vui tính).
     - **Mia:** `en-US-JennyNeural` (Giọng nữ trong trẻo, thông minh, phát âm cực chuẩn).
     - **Barista/Khách mời:** `en-US-AndrewMultilingualNeural` (Giọng trầm ấm, chuyên nghiệp).
     - **Người dẫn chuyện (Narrator):** `vi-VN-HoaiMyNeural` (Giọng nữ thuyết minh tiếng Việt chuẩn truyền cảm).
2. **FFmpeg:** Tự động đo thời lượng chính xác đến mili-giây, ghép nối audio và chèn khoảng lặng (silence pauses) cho người xem nhại giọng (shadowing).

---

## 🚀 QUY TRÌNH SẢN XUẤT 1 TẬP VIDEO MỚI (CHỈ MẤT 15 - 20 PHÚT)

### BƯỚC 1: TẠO KỊCH BẢN MỚI
Chỉ cần yêu cầu tôi (Antigravity):
> *"Tạo kịch bản Tập 2: Leo đi lạc đường và hỏi đường cụ bà tốt bụng"*

Tôi sẽ lập tức tạo file `script.json` và `storyboard.md` theo chuẩn cấu trúc 4 phần.

### BƯỚC 2: CHẠY SCRIPT TẠO AUDIO & PHỤ ĐỀ TỰ ĐỘNG
Chạy lệnh sau trong terminal:
```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe" "c:\Users\Baquan\OneDrive\Máy tính\C_SmartLifeApp\english_animation_studio\generator.py"
```
👉 Bạn sẽ nhận được ngay:
- Toàn bộ file voice của từng nhân vật trong thư mục `audio/`.
- File nhạc tổng `epXX_master_audio.mp3`.
- File phụ đề song ngữ `epXX_subtitles_bilingual.srt`.

### BƯỚC 3: DỰNG HOẠT HỌA 2D
Bạn có 2 lựa chọn phần mềm dựng:

#### Cách A: Dùng CapCut PC (Miễn phí & Nhanh nhất)
1. Kéo thả file `epXX_master_audio.mp3` vào thanh Audio.
2. Kéo thả file `epXX_subtitles_bilingual.srt` vào thanh Text -> Phụ đề khớp 100% không cần chỉnh tay!
3. Dùng hình nhân vật 2D của Leo & Mia:
   - Thêm hiệu ứng hoạt họa: **Animation -> In -> Shake / Wobble** để nhân vật cử động khi nói.
   - Thêm Sticker / Bối cảnh quán cafe từ kho CapCut hoặc Canva.
   - Thêm hiệu ứng âm thanh (Pop, Ding, Whoosh) theo chỉ dẫn trong `storyboard.md`.

#### Cách B: Dùng Vyond / Animaker
- Dành cho phong cách hoạt hình truyền thống với nhân vật biết đi lại, nhấp nháy môi theo giọng nói (Lip-sync tự động theo file audio).

---

## 🎨 THIẾT KẾ NHẬN DIỆN NHÂN VẬT (PROMPT TẠO HÌNH NẾU DÙNG AI)

Nếu bạn muốn tạo thêm các biểu cảm của nhân vật Leo và Mia bằng Midjourney / Leonardo / Bing Image Creator:

- **Leo (Biểu cảm ngạc nhiên):**
  > `Cute 2D cartoon illustration, young guy named Leo with messy brown hair, wearing yellow t-shirt, extremely surprised expression with big funny eyes, flat vector art style, solid white background, clean line art --no background`
- **Mia (Biểu cảm cười vui):**
  > `Cute 2D cartoon illustration, young smart girl named Mia with red hoodie, friendly smile, pointing gesture, modern flat vector design, solid white background, clean line art --no background`
