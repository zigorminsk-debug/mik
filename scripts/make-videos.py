#!/usr/bin/env python3
"""Сборка поясняющих видео: слайды (PIL) + озвучка (mp3) -> mp4 (ffmpeg).

Слайды урока: титул -> абзацы объяснения -> слайды с CLI-командами -> итог.
Если озвучка есть (media/audio/<id>-p*.mp3) — она используется и длительность
слайдов подстраивается под неё. Если озвучки нет — видео собирается с тишиной
и таймингом, рассчитанным по объёму текста.
"""
from PIL import Image, ImageDraw, ImageFont
import json, os, subprocess, sys, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA = os.path.join(ROOT, "media")
AUDIO_DIR = os.path.join(MEDIA, "audio")
SLIDES_DIR = os.path.join(MEDIA, "slides")
OUT_DIR = os.path.join(ROOT, "web", "assets", "media", "video")
FFMPEG = shutil.which("ffmpeg") or __import__("imageio_ffmpeg").get_ffmpeg_exe()
FFPROBE = shutil.which("ffprobe")

W, H = 1280, 720
BG = (13, 17, 23)
BG2 = (22, 28, 37)
CARD = (21, 27, 35)
CODE_BG = (11, 15, 20)
LINE = (35, 44, 56)
TXT = (230, 237, 243)
TXT2 = (169, 180, 194)
TXT3 = (111, 125, 141)
ORANGE = (255, 106, 26)
BLUE = (55, 185, 241)
GREEN = (126, 231, 135)
COMMENT = (107, 123, 141)
KEYWORD = (55, 185, 241)

FONTS = {
    "bold": "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "reg": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "mono": "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
}
for p in FONTS.values():
    if not os.path.exists(p):
        sys.exit(f"Не найден шрифт: {p}")


def f(name, size):
    return ImageFont.truetype(FONTS[name], size)


def probe_duration(path):
    if FFPROBE:
        out = subprocess.run(
            [FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
            capture_output=True, text=True, check=True).stdout.strip()
        return float(out)
    p = subprocess.run([FFMPEG, "-i", path], capture_output=True, text=True)
    for line in p.stderr.splitlines():
        if "Duration:" in line:
            ts = line.split("Duration:")[1].split(",")[0].strip()
            h, m, s = ts.split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
    raise RuntimeError(f"Не удалось определить длительность {path}")


def bg_image():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=tuple(int(BG[i] + (BG2[i] - BG[i]) * (1 - t) ** 2) for i in range(3)))
    glow = Image.new("L", (W, H), 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W / 2 - 420, -330, W / 2 + 420, 330], fill=52)
    img = Image.composite(Image.new("RGB", (W, H), (30, 41, 56)), img, glow.point(lambda v: v // 3))
    return img


def wrap(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if draw.textlength(test, font=font) <= max_w:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def header(d, title, chapter, step, total):
    d.text((64, 46), f"ГЛАВА · {chapter.upper()}", font=f("bold", 19), fill=ORANGE)
    for i, ln in enumerate(wrap(d, title, f("bold", 40), W - 128)[:2]):
        d.text((64, 80 + i * 48), ln, font=f("bold", 40), fill=TXT)
    d.rectangle([64, 178, 154, 183], fill=BLUE)
    return 214


def footer(d, step, total, label="MikroTik Академия"):
    d.rectangle([0, H - 56, W, H], fill=(16, 21, 28))
    d.rectangle([0, H - 56, int(W * step / max(total, 1)), H - 52], fill=ORANGE)
    d.text((64, H - 42), label, font=f("reg", 18), fill=TXT3)
    d.text((W - 120, H - 42), f"{step}/{total}", font=f("mono", 18), fill=TXT3)


def slide_text(title, chapter, body, step, total):
    img = bg_image()
    d = ImageDraw.Draw(img)
    y = header(d, title, chapter, step, total)

    card_top = y
    font, size = f("reg", 31), 31
    lines = []
    for para in body.split("\n"):
        if not para.strip():
            lines.append("")
            continue
        lines += wrap(d, para, font, W - 128)
    while len(lines) * (size + 13) > (H - 92 - card_top - 60) and size > 20:
        size -= 1
        font = f("reg", size)
        lines = []
        for para in body.split("\n"):
            if not para.strip():
                lines.append("")
                continue
            lines += wrap(d, para, font, W - 128)
    lh = size + 13
    card_bottom = min(H - 92, card_top + max(len(lines) * lh + 56, 150))
    d.rounded_rectangle([40, card_top, W - 40, card_bottom], radius=18, fill=CARD, outline=LINE, width=2)
    d.rounded_rectangle([40, card_top, 46, card_bottom], radius=3, fill=ORANGE)
    ty = card_top + 28
    for ln in lines:
        if ty + lh > card_bottom - 16:
            break
        if ln:
            d.text((76, ty), ln, font=font, fill=TXT)
        ty += lh
    footer(d, step, total)
    return img


def slide_code(title, chapter, code_title, code, step, total):
    img = bg_image()
    d = ImageDraw.Draw(img)
    y = header(d, title, chapter, step, total)

    card = [40, y, W - 40, H - 92]
    d.rounded_rectangle(card, radius=18, fill=CODE_BG, outline=LINE, width=2)
    d.rounded_rectangle([card[0], card[1], card[0] + 6, card[3]], radius=3, fill=BLUE)
    d.text((70, card[1] + 20), code_title or "RouterOS CLI", font=f("bold", 19), fill=TXT3)

    mono = f("mono", 24)
    lines = code.split("\n")
    max_lines = int((card[3] - card[1] - 80) / 32)
    if len(lines) > max_lines:
        lines = lines[: max_lines - 1] + ["…"]
    ty = card[1] + 56
    for ln in lines:
        if ln.strip().startswith("#"):
            d.text((70, ty), ln, font=mono, fill=COMMENT)
        elif ln.strip().startswith("/"):
            d.text((70, ty), ln, font=mono, fill=ORANGE)
        else:
            d.text((70, ty), ln, font=mono, fill=TXT2)
        ty += 32
    footer(d, step, total)
    return img


def slide_title(title, chapter, subtitle, step, total):
    img = bg_image()
    d = ImageDraw.Draw(img)
    d.text((64, 46), "MIKROTIK АКАДЕМИЯ", font=f("bold", 20), fill=ORANGE)
    for i, ln in enumerate(wrap(d, title, f("bold", 52), W - 128)[:2]):
        d.text((64, 210 + i * 62), ln, font=f("bold", 52), fill=TXT)
    d.rectangle([64, 350, 190, 356], fill=BLUE)
    d.text((64, 386), subtitle, font=f("reg", 26), fill=TXT2)
    d.text((64, H - 200), f"Глава: {chapter}", font=f("reg", 22), fill=TXT3)
    footer(d, step, total)
    return img


def build_slides(lesson, total_audio):
    """Возвращает список (путь к PNG, длительность)."""
    os.makedirs(SLIDES_DIR, exist_ok=True)
    paragraphs = lesson["paragraphs"]
    codes = lesson["codes"]
    n_slides = len(paragraphs) + len(codes) + 2

    weights = [max(len(p), 1) for p in paragraphs] + [max(len(c["cmd"]), 1) * 0.8 for c in codes]
    total_w = sum(weights)

    if total_audio:
        title_dur, outro_dur = 3.0, 2.0
        speech = max(total_audio - title_dur - outro_dur, 1.0)
    else:
        title_dur, outro_dur = 3.5, 3.0
        speech = max(total_audio, 1.0)

    items = []
    step = 1
    p = os.path.join(SLIDES_DIR, f"{lesson['id']}-00.png")
    slide_title(lesson["title"], lesson["chapter"], "Поясняющее видео к уроку", step, n_slides).save(p)
    items.append((p, title_dur))
    step += 1

    idx = 0
    for para in paragraphs:
        dur = (speech * weights[idx] / total_w) if total_audio else max(4.5, len(para) / 13.0)
        p = os.path.join(SLIDES_DIR, f"{lesson['id']}-{step:02d}.png")
        slide_text(lesson["title"], lesson["chapter"], para, step, n_slides).save(p)
        items.append((p, dur))
        idx += 1
        step += 1

    for c in codes:
        dur = (speech * weights[idx] / total_w) if total_audio else max(5.0, len(c["cmd"]) / 12.0)
        p = os.path.join(SLIDES_DIR, f"{lesson['id']}-{step:02d}.png")
        slide_code(lesson["title"], lesson["chapter"], c.get("title"), c["cmd"], step, n_slides).save(p)
        items.append((p, dur))
        idx += 1
        step += 1

    p = os.path.join(SLIDES_DIR, f"{lesson['id']}-end.png")
    slide_text(lesson["title"], lesson["chapter"],
               "Откройте приложение MikroTik Академия: выполните чек-лист урока, пройдите тест и переходите к следующему уроку.",
               step, n_slides).save(p)
    items.append((p, outro_dur))
    return items


def concat_audio(lesson_id):
    parts = sorted([f for f in os.listdir(AUDIO_DIR) if f.startswith(lesson_id + "-p") and f.endswith(".mp3")])
    if not parts:
        return None, 0.0
    out = os.path.join(AUDIO_DIR, f"{lesson_id}-full.m4a")
    if os.path.exists(out):
        os.remove(out)
    tmp = os.path.join(AUDIO_DIR, f"_{lesson_id}_list.txt")
    with open(tmp, "w") as fh:
        for p in parts:
            fh.write(f"file '{os.path.join(AUDIO_DIR, p)}'\n")
    subprocess.run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", tmp, "-c:a", "aac",
                    "-b:a", "112k", "-ar", "44100", "-ac", "1", out], check=True, capture_output=True)
    os.remove(tmp)
    return out, probe_duration(out)


def make_video(lesson, items, audio, total_dur):
    lst = os.path.join(SLIDES_DIR, f"_{lesson['id']}_slides.txt")
    with open(lst, "w") as fh:
        for path, dur in items:
            fh.write(f"file '{path}'\nduration {dur:.3f}\n")
        fh.write(f"file '{items[-1][0]}'\nduration {items[-1][1]:.3f}\n")

    out = os.path.join(OUT_DIR, f"{lesson['id']}.mp4")
    cmd = [FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
           "-f", "concat", "-safe", "0", "-i", lst]
    if audio:
        cmd += ["-i", audio]
    else:
        cmd += ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"]
    cmd += ["-c:v", "libx264", "-preset", "slow", "-crf", "30", "-maxrate", "700k", "-bufsize", "1400k",
            "-pix_fmt", "yuv420p", "-profile:v", "baseline", "-level", "3.1", "-r", "25",
            "-vf", f"scale={W}:{H}",
            "-c:a", "aac", "-b:a", "96k", "-ar", "44100", "-ac", "1",
            "-movflags", "+faststart", "-shortest", out]
    subprocess.run(cmd, check=True)
    os.remove(lst)
    return out, total_dur


def main():
    only = sys.argv[1:] if len(sys.argv) > 1 else None
    os.makedirs(OUT_DIR, exist_ok=True)
    lessons = json.load(open(os.path.join(MEDIA, "narration.json"), encoding="utf-8"))
    built = 0
    for lesson in lessons:
        if only and lesson["id"] not in only:
            continue
        audio, dur = concat_audio(lesson["id"])
        items = build_slides(lesson, dur)
        if not audio:
            dur = sum(d for _, d in items)
        out, dur = make_video(lesson, items, audio, dur)
        size = os.path.getsize(out) // 1024
        voice = "с озвучкой" if audio else "без озвучки"
        print(f"  ✓ {lesson['id']}: {dur:6.1f} с, {size:5d} КБ, слайдов: {len(items):2d} ({voice})")
        built += 1
        for p, _ in items:
            os.remove(p)
        if audio:
            os.remove(audio)
    print(f"Готово: {built} видео.")


if __name__ == "__main__":
    main()
