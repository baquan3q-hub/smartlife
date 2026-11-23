import os
from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "episodes", "ep01_giant_coffee", "scenes"
)
os.makedirs(OUTPUT_DIR, exist_ok=True)

def get_font(size: int, bold: bool = False):
    font_names = ["segoeuib.ttf" if bold else "segoeui.ttf", "arialbd.ttf" if bold else "arial.ttf"]
    for fn in font_names:
        fp = os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "Fonts", fn)
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size)
            except Exception:
                pass
    return ImageFont.load_default()

def draw_card(title, subtitle, badge_text, badge_color, bullet_points, bg_gradient_start, bg_gradient_end, filename):
    w, h = 1920, 1080
    img = Image.new("RGB", (w, h), bg_gradient_start)
    draw = ImageDraw.Draw(img)

    # Vertical gradient background
    for y in range(h):
        r = int(bg_gradient_start[0] + (bg_gradient_end[0] - bg_gradient_start[0]) * (y / h))
        g = int(bg_gradient_start[1] + (bg_gradient_end[1] - bg_gradient_start[1]) * (y / h))
        b = int(bg_gradient_start[2] + (bg_gradient_end[2] - bg_gradient_start[2]) * (y / h))
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # Top banner / Badge
    if badge_text:
        badge_font = get_font(38, bold=True)
        bw, bh = 480, 70
        bx = (w - bw) // 2
        by = 80
        draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=35, fill=badge_color)
        draw.text((w // 2, by + bh // 2), badge_text, font=badge_font, fill=(255, 255, 255), anchor="mm")

    # Main Card container
    card_x0, card_y0 = 160, 200
    card_x1, card_y1 = w - 160, h - 140
    # Outer shadow
    draw.rounded_rectangle([card_x0 + 8, card_y0 + 12, card_x1 + 8, card_y1 + 12], radius=36, fill=(0, 0, 0, 40))
    # Main white card
    draw.rounded_rectangle([card_x0, card_y0, card_x1, card_y1], radius=36, fill=(255, 255, 255))

    # Title
    title_font = get_font(68, bold=True)
    draw.text((w // 2, card_y0 + 90), title, font=title_font, fill=(30, 41, 59), anchor="mm")

    # Subtitle
    if subtitle:
        sub_font = get_font(38, bold=False)
        draw.text((w // 2, card_y0 + 165), subtitle, font=sub_font, fill=(100, 116, 139), anchor="mm")

    # Decorative separator line
    draw.line([(card_x0 + 100, card_y0 + 220), (card_x1 - 100, card_y0 + 220)], fill=(226, 232, 240), width=3)

    # Bullet points / Content boxes
    box_y = card_y0 + 270
    content_font_bold = get_font(44, bold=True)
    content_font_sub = get_font(34, bold=False)

    for bp in bullet_points:
        b_x0, b_y0 = card_x0 + 80, box_y
        b_x1, b_y1 = card_x1 - 80, box_y + 110
        box_bg = bp.get("bg", (248, 250, 252))
        border_c = bp.get("border", (203, 213, 225))
        draw.rounded_rectangle([b_x0, b_y0, b_x1, b_y1], radius=22, fill=box_bg, outline=border_c, width=2)

        # Icon or tag
        icon = bp.get("icon", "💡")
        tag_font = get_font(40)
        draw.text((b_x0 + 40, b_y0 + 55), icon, font=tag_font, fill=(0, 0, 0), anchor="mm")

        # Main line
        draw.text((b_x0 + 90, b_y0 + 38), bp.get("text", ""), font=content_font_bold, fill=bp.get("color", (15, 23, 42)))
        # Sub line
        if bp.get("sub"):
            draw.text((b_x0 + 90, b_y0 + 78), bp.get("sub", ""), font=content_font_sub, fill=(71, 85, 105))

        box_y += 140

    # Save
    out_path = os.path.join(OUTPUT_DIR, filename)
    img.save(out_path, quality=95)
    print(f"Generated card: {out_path}")
    return out_path

def generate_all():
    # Card 1: Breakdown Intro
    draw_card(
        title="3 CỤM TỪ 'CỨU NGUY' KHI GỌI CÀ PHÊ",
        subtitle="Học cách nói tự nhiên như người bản xứ cùng Mia & Leo",
        badge_text="✨ ENGLISH SURVIVAL HACKS",
        badge_color=(234, 88, 12),
        bullet_points=[
            {"icon": "1️⃣", "text": "What can I get for you?", "sub": "Nhân viên hỏi gọi món cực lịch sự (thay vì 'What do you want?')", "bg": (255, 247, 237), "border": (254, 215, 170), "color": (194, 65, 12)},
            {"icon": "2️⃣", "text": "For here or to go?", "sub": "Dùng tại quán (For here) hay mang về (To go)?", "bg": (240, 253, 244), "border": (187, 247, 208), "color": (21, 128, 61)},
            {"icon": "3️⃣", "text": "On second thought...", "sub": "Nghĩ lại thì... (cứu tinh khi bạn lỡ mồm gọi nhầm và muốn đổi ý!)", "bg": (239, 246, 255), "border": (191, 219, 254), "color": (29, 78, 216)}
        ],
        bg_gradient_start=(255, 241, 230),
        bg_gradient_end=(254, 215, 170),
        filename="card_01_intro.png"
    )

    # Card 2: Phrase 1 Deep Dive
    draw_card(
        title="Phrase 1: What can I get for you?",
        subtitle="Cách gọi món tự nhiên và lịch sự",
        badge_text="🗣️ ORDERING TIP",
        badge_color=(14, 165, 233),
        bullet_points=[
            {"icon": "❓", "text": "Barista: \"What can I get for you today?\"", "sub": "Chào buổi sáng! Bạn muốn dùng gì hôm nay ạ?", "bg": (240, 249, 255), "border": (186, 230, 253), "color": (3, 105, 161)},
            {"icon": "👉", "text": "Công thức đáp: \"Can I get [tên món], please?\"", "sub": "Ví dụ: Can I get one iced latte, please?", "bg": (254, 243, 199), "border": (253, 230, 138), "color": (180, 83, 9)},
            {"icon": "⚠️", "text": "Lưu ý văn hóa:", "sub": "Người bản xứ luôn thêm từ 'please' ở cuối để thể hiện sự thân thiện, tôn trọng.", "bg": (248, 250, 252), "border": (226, 232, 240), "color": (71, 85, 105)}
        ],
        bg_gradient_start=(224, 242, 254),
        bg_gradient_end=(186, 230, 253),
        filename="card_02_phrase1.png"
    )

    # Card 3: Phrase 2 Deep Dive
    draw_card(
        title="Phrase 2: For here or to go?",
        subtitle="Uống tại quán hay mang đi?",
        badge_text="☕ QUICK CHOICE",
        badge_color=(16, 185, 129),
        bullet_points=[
            {"icon": "🪑", "text": "Option A: \"For here, please.\"", "sub": "Dùng tại bàn trong quán (được phục vụ bằng ly sứ / ly thủy tinh)", "bg": (240, 253, 244), "border": (187, 247, 208), "color": (21, 128, 61)},
            {"icon": "🛍️", "text": "Option B: \"To go, please.\"", "sub": "Mang đi (được đựng trong cốc giấy kèm túi xách / nắp đậy)", "bg": (254, 242, 242), "border": (254, 202, 202), "color": (185, 28, 28)},
            {"icon": "🇬🇧", "text": "Mẹo thêm (Anh - Anh):", "sub": "Tại Anh/Úc, người ta thường hỏi: 'Eat in or take away?'", "bg": (248, 250, 252), "border": (226, 232, 240), "color": (71, 85, 105)}
        ],
        bg_gradient_start=(209, 250, 229),
        bg_gradient_end=(167, 243, 208),
        filename="card_03_phrase2.png"
    )

    # Card 4: Phrase 3 Deep Dive
    draw_card(
        title="Phrase 3: On second thought...",
        subtitle="Nghĩ lại thì... (Cách đổi ý lịch sự)",
        badge_text="💡 MIND CHANGER",
        badge_color=(139, 92, 246),
        bullet_points=[
            {"icon": "💭", "text": "\"On second thought, maybe share with me?\"", "sub": "Nghĩ lại thì, hay là chia một nửa với tớ nhé?", "bg": (245, 243, 255), "border": (221, 214, 254), "color": (109, 40, 217)},
            {"icon": "🔄", "text": "Ví dụ thực tế khi gọi món:", "sub": "\"A large coffee, please. Actually, on second thought, make it a medium!\"", "bg": (254, 243, 199), "border": (253, 230, 138), "color": (180, 83, 9)},
            {"icon": "⭐", "text": "Điểm cộng giao tiếp:", "sub": "Giúp bạn sửa lời tự nhiên mà không cần phải nói 'Sorry, I am wrong'.", "bg": (248, 250, 252), "border": (226, 232, 240), "color": (71, 85, 105)}
        ],
        bg_gradient_start=(237, 233, 254),
        bg_gradient_end=(221, 214, 254),
        filename="card_04_phrase3.png"
    )

    # Card 5: Interactive Shadowing
    draw_card(
        title="THỰC HÀNH PHẢN XẠ: BẠN ĐÓNG VAI LEO!",
        subtitle="Hãy nhìn màn hình và đọc to khi đồng hồ đếm ngược 3... 2... 1...",
        badge_text="🎤 YOUR TURN - SHADOWING",
        badge_color=(239, 68, 68),
        bullet_points=[
            {"icon": "☕", "text": "Barista: \"Good morning! What can I get for you today?\"", "sub": "👉 BẠN ĐỌC: \"Can I get one iced latte, please?\"", "bg": (254, 242, 242), "border": (254, 202, 202), "color": (185, 28, 28)},
            {"icon": "🛍️", "text": "Barista: \"For here or to go?\"", "sub": "👉 BẠN ĐỌC: \"To go, please!\"", "bg": (254, 243, 199), "border": (253, 230, 138), "color": (180, 83, 9)},
            {"icon": "⏱️", "text": "Mẹo luyện tập:", "sub": "Đừng sợ nói sai! Nói to, rõ ràng theo ngữ điệu của Leo và Mia nhé!", "bg": (240, 253, 244), "border": (187, 247, 208), "color": (21, 128, 61)}
        ],
        bg_gradient_start=(254, 226, 226),
        bg_gradient_end=(254, 202, 202),
        filename="card_05_roleplay.png"
    )

    # Card 6: Quiz & Outro
    draw_card(
        title="MINI QUIZ & BÌNH LUẬN ĐÁP ÁN",
        subtitle="Khi bạn muốn đổi ý định, bạn sẽ nói cụm từ nào?",
        badge_text="🏆 THỬ THÁCH NHANH",
        badge_color=(245, 158, 11),
        bullet_points=[
            {"icon": "🅰️", "text": "A. On first thought", "sub": "Sai rồi nhé!", "bg": (248, 250, 252), "border": (226, 232, 240), "color": (100, 116, 139)},
            {"icon": "🅱️", "text": "B. On second thought ✅ (CHÍNH XÁC!)", "sub": "Nghĩ lại thì... (Ví dụ: On second thought, make it a medium!)", "bg": (240, 253, 244), "border": (74, 222, 128), "color": (21, 128, 61)},
            {"icon": "🔔", "text": "ĐỪNG QUÊN BẤM SUBSCRIBE KÊNH!", "sub": "Đón xem Tập 2: \"Leo đi phỏng vấn xin việc nhưng nhầm phòng!\"", "bg": (254, 242, 242), "border": (239, 68, 68), "color": (220, 38, 38)}
        ],
        bg_gradient_start=(254, 243, 199),
        bg_gradient_end=(253, 230, 138),
        filename="card_06_quiz_outro.png"
    )

if __name__ == "__main__":
    generate_all()
