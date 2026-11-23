import os
import subprocess
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EPISODE_DIR = os.path.join(BASE_DIR, "episodes", "ep01_giant_coffee")
SCENES_DIR = os.path.join(EPISODE_DIR, "scenes")
AUDIO_DIR = os.path.join(EPISODE_DIR, "audio")
MASTER_AUDIO = os.path.join(EPISODE_DIR, "ep01_master_audio.mp3")
ASS_PATH = os.path.join(EPISODE_DIR, "ep01_karaoke.ass")
OUTPUT_VIDEO = os.path.join(EPISODE_DIR, "ep01_the_giant_coffee_final.mp4")

def get_audio_duration(file_path: str) -> float:
    try:
        cmd = [
            "ffprobe", "-v", "error", "-show_entries",
            "format=duration", "-of", "default=noprint_wrappers=1:nokey=1",
            file_path
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        return float(res.stdout.strip())
    except Exception as e:
        print(f"Error ffprobe {file_path}: {e}")
        return 2.5

def format_ass_time(seconds: float) -> str:
    cs = int(round((seconds - int(seconds)) * 100))
    total_seconds = int(seconds)
    secs = total_seconds % 60
    mins = (total_seconds // 60) % 60
    hours = total_seconds // 3600
    return f"{hours:d}:{mins:02d}:{secs:02d}.{cs:02d}"

def make_karaoke_line(text: str, duration_sec: float) -> str:
    """Break sentence into words with \\k<centiseconds> tags proportional to length"""
    words = text.strip().split()
    if not words:
        return text

    total_cs = max(1, int(round(duration_sec * 100)))
    weights = [max(1, len(w)) for w in words]
    sum_w = sum(weights)
    cs_list = [max(3, int(round(total_cs * (w / sum_w)))) for w in weights]
    diff = total_cs - sum(cs_list)
    cs_list[-1] = max(3, cs_list[-1] + diff)

    karaoke_parts = []
    for w, cs in zip(words, cs_list):
        karaoke_parts.append(f"{{\\k{cs}}}{w}")
    return " ".join(karaoke_parts)

def generate_ass_file(data, audio_files, line_pauses):
    """Generate ASS subtitle file with Yellow Karaoke highlight for spoken words"""
    ass_header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Segoe UI,28,&H0000E5FF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,1.8,1.0,2,40,40,32,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    current_time = 0.0
    line_idx = 1

    for sec in data.get("sections", []):
        for line in sec.get("lines", []):
            speaker = line["speaker"]
            text = line["text"]
            vietsub = line.get("vietsub", "")
            pause = line_pauses.get(line_idx, 0.8)

            a_path = audio_files.get(line_idx)
            dur = get_audio_duration(a_path) if a_path else 2.5

            start_t = current_time
            end_t = current_time + dur + pause

            start_str = format_ass_time(start_t)
            end_str = format_ass_time(end_t)

            if speaker == "Narrator_VN":
                # Vietnamese narrator: Karaoke on the Vietnamese text, smaller English note
                karaoke_vn = make_karaoke_line(text, dur)
                dialogue_text = f"{karaoke_vn}"
                if vietsub and vietsub != text:
                    dialogue_text += f"\\N{{\\r\\fs18\\c&H00CBD5E1&\\b0}}{vietsub}"
            else:
                # English character: Karaoke on English words (turns Yellow), clean subtle Vietsub below
                karaoke_en = make_karaoke_line(text, dur)
                dialogue_text = f"{karaoke_en}"
                if vietsub:
                    dialogue_text += f"\\N{{\\r\\fs18\\c&H00CBD5E1&\\b0}}{vietsub}"

            events.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{dialogue_text}")

            current_time = end_t
            line_idx += 1

    ass_content = ass_header + "\n".join(events)
    with open(ASS_PATH, "w", encoding="utf-8") as f:
        f.write(ass_content)
    print(f"✅ Generated ASS Karaoke Subtitles: {ASS_PATH}")

def main():
    print("🎬 Preparing Video Render Pipeline with Yellow Karaoke...")

    with open(os.path.join(EPISODE_DIR, "script.json"), "r", encoding="utf-8") as f:
        data = json.load(f)

    scene_mapping = [
        {"lines": [1, 2], "img": "scene_01_sleepy_cafe.png"},
        {"lines": [3, 4, 5, 6, 7], "img": "scene_02_ordering.png"},
        {"lines": [8, 9, 10], "img": "scene_03_giant_latte.png"},
        {"lines": [11], "img": "card_01_intro.png"},
        {"lines": [12, 13], "img": "card_02_phrase1.png"},
        {"lines": [14, 15], "img": "card_03_phrase2.png"},
        {"lines": [16, 17], "img": "card_04_phrase3.png"},
        {"lines": [18, 19, 20, 21], "img": "card_05_roleplay.png"},
        {"lines": [22, 23], "img": "card_06_quiz_outro.png"}
    ]

    line_pauses = {}
    current_idx = 1
    for sec in data.get("sections", []):
        for line in sec.get("lines", []):
            line_pauses[current_idx] = line.get("pause_after", 0.8)
            current_idx += 1

    audio_files = {}
    for f in os.listdir(AUDIO_DIR):
        if f.startswith("line_") and f.endswith(".mp3"):
            parts = f.split("_")
            idx = int(parts[1])
            audio_files[idx] = os.path.join(AUDIO_DIR, f)

    # 1. Generate Karaoke ASS file
    generate_ass_file(data, audio_files, line_pauses)

    # 2. Build slideshow.txt
    slideshow_entries = []
    total_calc_duration = 0.0

    for sc in scene_mapping:
        img_name = sc["img"]
        img_path = os.path.join(SCENES_DIR, img_name).replace(os.sep, "/")
        sc_duration = 0.0
        for l_num in sc["lines"]:
            a_path = audio_files.get(l_num)
            if a_path:
                d = get_audio_duration(a_path)
                p = line_pauses.get(l_num, 0.8)
                sc_duration += (d + p)
        slideshow_entries.append((img_path, sc_duration))
        total_calc_duration += sc_duration

    slideshow_txt_path = os.path.join(EPISODE_DIR, "slideshow.txt")
    with open(slideshow_txt_path, "w", encoding="utf-8") as f:
        for img_path, dur in slideshow_entries:
            f.write(f"file '{img_path}'\n")
            f.write(f"duration {dur:.3f}\n")
        last_img = slideshow_entries[-1][0]
        f.write(f"file '{last_img}'\n")

    # 3. Render with FFmpeg using ASS filter
    print("\n🎥 Rendering 1080p Full HD Video with Yellow Karaoke Subtitles...")
    ass_clean_path = ASS_PATH.replace("\\", "/").replace(":", "\\:")

    vf_filters = [
        "fps=25",
        "scale=1920:1080:force_original_aspect_ratio=decrease",
        "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black",
        "format=yuv420p",
        f"ass='{ass_clean_path}'"
    ]

    cmd = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", slideshow_txt_path,
        "-i", MASTER_AUDIO,
        "-vf", ",".join(vf_filters),
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "20",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        OUTPUT_VIDEO
    ]

    subprocess.run(cmd, check=True)

    if os.path.exists(OUTPUT_VIDEO):
        v_size_mb = os.path.getsize(OUTPUT_VIDEO) / (1024 * 1024)
        print(f"\n🎉 VIDEO RENDER COMPLETE!")
        print(f"📁 Output file: {OUTPUT_VIDEO}")
        print(f"📦 File size: {v_size_mb:.2f} MB")

if __name__ == "__main__":
    main()
