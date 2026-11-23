import os
import json
import asyncio
import subprocess
import edge_tts

EPISODE_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPT_PATH = os.path.join(EPISODE_DIR, "episodes", "ep01_giant_coffee", "script.json")
OUTPUT_DIR = os.path.join(EPISODE_DIR, "episodes", "ep01_giant_coffee")
AUDIO_DIR = os.path.join(OUTPUT_DIR, "audio")

def format_timestamp(seconds: float) -> str:
    """Format seconds into SRT timestamp HH:MM:SS,mmm"""
    millis = int(round((seconds - int(seconds)) * 1000))
    total_seconds = int(seconds)
    secs = total_seconds % 60
    mins = (total_seconds // 60) % 60
    hours = total_seconds // 3600
    return f"{hours:02d}:{mins:02d}:{secs:02d},{millis:03d}"

def get_audio_duration(file_path: str) -> float:
    """Get duration of audio file using ffprobe/ffmpeg"""
    try:
        cmd = [
            "ffprobe", "-v", "error", "-show_entries",
            "format=duration", "-of", "default=noprint_wrappers=1:nokey=1",
            file_path
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        return float(result.stdout.strip())
    except Exception as e:
        print(f"Error getting duration for {file_path}: {e}")
        return 2.5

from gtts import gTTS

async def generate_speech(text: str, voice: str, rate: str, pitch: str, output_file: str, max_retries: int = 4):
    """Generate audio file using edge-tts for English and gTTS for Vietnamese"""
    if os.path.exists(output_file) and os.path.getsize(output_file) > 500:
        return

    # If it's a Vietnamese voice or Vietnamese text, use gTTS for 100% rock-solid reliability
    if "vi-VN" in voice or voice == "gtts_vi":
        try:
            tts = gTTS(text=text, lang="vi", slow=False)
            tts.save(output_file)
            if os.path.exists(output_file) and os.path.getsize(output_file) > 500:
                return
        except Exception as e:
            print(f"  ⚠️ gTTS error: {e}")

    # For English voices, use high-definition Edge-TTS
    for attempt in range(max_retries):
        try:
            communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
            await communicate.save(output_file)
            if os.path.exists(output_file) and os.path.getsize(output_file) > 500:
                return
        except Exception as e:
            print(f"  ⚠️ Attempt {attempt+1}/{max_retries} for {voice}: {e}")
            if attempt == max_retries - 1:
                # Ultimate fallback to gTTS
                print(f"  🔄 Fallback to gTTS for English...")
                tts = gTTS(text=text, lang="en", slow=False)
                tts.save(output_file)
                return
            await asyncio.sleep(1.5 * (attempt + 1))

async def main():
    os.makedirs(AUDIO_DIR, exist_ok=True)

    with open(SCRIPT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    characters = data.get("characters", {})
    sections = data.get("sections", [])

    timeline = []
    current_time = 0.0
    line_index = 1
    srt_bilingual_entries = []
    srt_en_entries = []
    concat_list = []

    print(f"🎬 Generating assets for: {data.get('title')} ({data.get('episode_id')})")

    for sec in sections:
        sec_title = sec.get("title", "")
        print(f"\n--- {sec_title} ---")
        for item in sec.get("lines", []):
            speaker = item["speaker"]
            text = item["text"]
            vietsub = item.get("vietsub", "")
            pause_after = item.get("pause_after", 0.5)

            char_info = characters.get(speaker, {
                "voice": "en-US-GuyNeural", "rate": "+0%", "pitch": "+0Hz"
            })

            audio_filename = f"line_{line_index:03d}_{speaker}.mp3"
            audio_path = os.path.join(AUDIO_DIR, audio_filename)

            print(f"[{line_index:03d}] {speaker}: \"{text[:40]}...\"")
            await generate_speech(
                text=text,
                voice=char_info.get("voice", "en-US-GuyNeural"),
                rate=char_info.get("rate", "+0%"),
                pitch=char_info.get("pitch", "+0Hz"),
                output_file=audio_path
            )

            # Get duration
            duration = get_audio_duration(audio_path)
            start_time = current_time
            end_time = current_time + duration

            # Add to SRT
            start_str = format_timestamp(start_time)
            end_str = format_timestamp(end_time)

            # Bilingual SRT
            srt_bilingual_entries.append(
                f"{line_index}\n{start_str} --> {end_str}\n{text}\n{vietsub}\n"
            )

            # English only SRT
            srt_en_entries.append(
                f"{line_index}\n{start_str} --> {end_str}\n{text}\n"
            )

            concat_list.append((audio_path, pause_after))
            current_time = end_time + pause_after
            line_index += 1

    # Write SRT files
    srt_bi_path = os.path.join(OUTPUT_DIR, "ep01_subtitles_bilingual.srt")
    with open(srt_bi_path, "w", encoding="utf-8") as f:
        f.write("\n".join(srt_bilingual_entries))

    srt_en_path = os.path.join(OUTPUT_DIR, "ep01_subtitles_en.srt")
    with open(srt_en_path, "w", encoding="utf-8") as f:
        f.write("\n".join(srt_en_entries))

    print(f"\n✅ Subtitles written to:")
    print(f"   - {srt_bi_path}")
    print(f"   - {srt_en_path}")

    # Concatenate audio using ffmpeg with pauses
    print("\n🎵 Stitching master audio track with FFmpeg...")
    master_audio_path = os.path.join(OUTPUT_DIR, "ep01_master_audio.mp3")

    # Generate silence file for pauses
    silence_cache = {}
    inputs = []
    filter_complex = []

    # Simple concatenation list file
    concat_txt_path = os.path.join(AUDIO_DIR, "concat.txt")
    with open(concat_txt_path, "w", encoding="utf-8") as f:
        for idx, (aud_file, pause) in enumerate(concat_list):
            f.write(f"file '{aud_file.replace(os.sep, '/')}'\n")
            if pause > 0:
                silence_file = os.path.join(AUDIO_DIR, f"silence_{pause:.1f}s.mp3")
                if not os.path.exists(silence_file):
                    subprocess.run([
                        "ffmpeg", "-y", "-f", "lavfi",
                        "-i", f"anullsrc=r=24000:cl=mono",
                        "-t", str(pause),
                        "-q:a", "9",
                        silence_file
                    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                if os.path.exists(silence_file):
                    f.write(f"file '{silence_file.replace(os.sep, '/')}'\n")

    # Run ffmpeg concat
    concat_cmd = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", concat_txt_path,
        "-c:a", "libmp3lame", "-q:a", "2",
        master_audio_path
    ]
    subprocess.run(concat_cmd, check=True)

    total_duration = get_audio_duration(master_audio_path)
    mins = int(total_duration // 60)
    secs = int(total_duration % 60)
    print(f"\n🎉 DONE! Master Audio produced: {master_audio_path}")
    print(f"⏱️ Total duration: {mins}:{secs:02d}")

if __name__ == "__main__":
    asyncio.run(main())
