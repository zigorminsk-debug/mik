#!/usr/bin/env python3
"""Сборка видеоуроков: экраны интерфейса RouterOS -> mp4.

Каждый шаг урока показывается дважды:
  * экран Winbox 7 с деревом разделов и таблицей — видно, какая именно
    вкладка RouterOS настраивается;
  * терминал RouterOS с самой командой и её выводом.

Если есть озвучка (media/audio/<id>-p*.mp3), она используется и длительность
экранов подстраивается под неё. Если озвучки нет — тайминг рассчитывается по
объёму показанного текста.
"""
import json
import os
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import routeros_ui as ui
from routeros_ui import caption, f, render_terminal, render_winbox, tw, wrap

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA = os.path.join(ROOT, "media")
AUDIO_DIR = os.path.join(MEDIA, "audio")
SLIDES_DIR = os.path.join(MEDIA, "slides")
OUT_DIR = os.path.join(ROOT, "web", "assets", "media", "video")
FFMPEG = shutil.which("ffmpeg") or __import__("imageio_ffmpeg").get_ffmpeg_exe()
FFPROBE = shutil.which("ffprobe")

W, H = ui.W, ui.H
ACCENT = ui.MIK_ORANGE
BLUE = (55, 185, 241)


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


# --------------------------------------------------------------------------
# Слайды, которых нет в routeros_ui: титул, карточка шага, итог
# --------------------------------------------------------------------------
def slide_title(title, chapter, lesson_id, step, total):
    img = Image.new("RGB", (W, H), (13, 17, 23))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=tuple(int(13 + (28 - 13) * (1 - t) ** 2) for _ in [0]))
    d.rectangle([0, 0, W, 6], fill=ACCENT)
    d.text((72, 88), "MIKROTIK АКАДЕМИЯ", font=f("bold", 22), fill=ACCENT)
    lines = wrap(d, title, f("bold", 50), W - 144)[:3]
    y = 190
    for ln in lines:
        d.text((72, y), ln, font=f("bold", 50), fill=(232, 238, 244))
        y += 60
    d.rectangle([72, y + 16, 210, y + 22], fill=BLUE)
    d.text((72, y + 44), f"Глава: {chapter}", font=f("reg", 26), fill=(150, 163, 178))
    d.text((72, y + 88), "Урок в приложении: экран RouterOS и консоль", font=f("reg", 24), fill=(108, 122, 138))
    d.text((W - 150, H - 96), lesson_id, font=f("mono", 24), fill=(70, 82, 96))
    return img


def slide_card(title, chapter, body, note, step, total, label):
    """Карточка с текстом шага — для действий, где нет команды в консоли."""
    img = Image.new("RGB", (W, H), (13, 17, 23))
    d = ImageDraw.Draw(img)
    d.text((64, 44), f"ГЛАВА · {chapter.upper()}", font=f("bold", 19), fill=ACCENT)
    for i, ln in enumerate(wrap(d, title, f("bold", 38), W - 128)[:2]):
        d.text((64, 76 + i * 46), ln, font=f("bold", 38), fill=(232, 238, 244))
    top = 186
    font, size = f("reg", 29), 29
    lines = []
    for para in body.split("\n"):
        if not para.strip():
            lines.append("")
            continue
        lines += wrap(d, para, font, W - 168)
    while len(lines) * (size + 12) > (H - 118 - top - 60) and size > 19:
        size -= 1
        font = f("reg", size)
        lines = []
        for para in body.split("\n"):
            if not para.strip():
                lines.append("")
                continue
            lines += wrap(d, para, font, W - 168)
    lh = size + 12
    card_bottom = min(H - 118, top + max(len(lines) * lh + 52, 150))
    d.rounded_rectangle([40, top, W - 40, card_bottom], radius=18, fill=(21, 27, 35),
                        outline=(35, 44, 56), width=2)
    d.rounded_rectangle([40, top, 46, card_bottom], radius=3, fill=ACCENT)
    ty = top + 26
    for ln in lines:
        if ty + lh > card_bottom - 16:
            break
        if ln:
            d.text((76, ty), ln, font=font, fill=(206, 215, 225))
        ty += lh
    if note:
        d.rounded_rectangle([40, H - 104, W - 40, H - 56], radius=10, fill=(30, 39, 51))
        d.text((58, H - 94), clip(d, note, f("reg", 21), W - 116), font=f("reg", 21), fill=(150, 163, 178))
    return img


def clip(d, text, font, max_w):
    if tw(d, text, font) <= max_w:
        return text
    while text and tw(d, text + "…", font) > max_w:
        text = text[:-1]
    return text + "…"


def slide_summary(lesson, step, total):
    """Итоговый экран с ключевыми командами урока."""
    img = Image.new("RGB", (W, H), ui.T_BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 40], fill=ui.T_BAR)
    d.text((18, 11), f"Итог урока · {lesson['title']}", font=f("bold", 17), fill=(226, 232, 238))
    d.line([(0, 40), (W, 40)], fill=(48, 52, 60))
    y = 64
    d.text((28, y), "Команды урока:", font=f("bold", 19), fill=ui.T_HEAD)
    y += 40
    seen = set()
    for c in lesson.get("cheat", [])[:8]:
        cmd = c.get("c", "").strip()
        if not cmd or cmd in seen:
            continue
        seen.add(cmd)
        if y > H - 150:
            break
        d.text((28, y), "→", font=f("mono", 18), fill=ui.T_PROMPT)
        d.text((52, y), cmd, font=f("mono", 18), fill=ui.T_VAL)
        y += 32
    if y < H - 140:
        d.text((28, y + 14), "Откройте приложение MikroTik Академия:", font=f("reg", 19), fill=ui.T_HEAD)
        d.text((28, y + 44), "выполните чек-лист, пройдите тест и переходите дальше.",
               font=f("reg", 19), fill=(150, 160, 172))
    return img


# --------------------------------------------------------------------------
# Сборка экранов урока
# --------------------------------------------------------------------------
def first_command(cmd):
    """Первая значимая команда из блока."""
    for ln in (cmd or "").split("\n"):
        s = ln.strip()
        if not s or s.startswith("#"):
            continue
        return s
    return ""


def menu_of(cmd):
    path, action, params = ui.parse_cmd(first_command(cmd))
    if not path:
        return None
    return ui.menu_for_cli(path)


def build_screens(lesson):
    """Список экранов урока: (kind, данные, длительность)."""
    screens = []
    steps = lesson.get("steps", [])
    used_cmd = set()

    for st in steps:
        cmd = (st.get("cmd") or "").strip()
        title = st.get("title") or ""
        text = st.get("text") or ""
        note = st.get("note") or ""
        mp = menu_of(cmd)
        if mp and cmd:
            screens.append(("winbox", {"menu": mp, "cmd": cmd, "title": title, "lesson": lesson}, 5.2))
            screens.append(("terminal", {"cmd": cmd, "menu": mp, "title": title,
                                         "comment": note or text, "lesson": lesson}, 5.6))
        else:
            body = text or cmd or note
            screens.append(("card", {"title": title, "chapter": lesson["chapter"], "body": body,
                                     "note": note, "lesson": lesson}, 6.4))

    # дополнительные блоки с командами из текста урока
    for c in lesson.get("codes", [])[:3]:
        cmd = (c.get("cmd") or "").strip()
        if not cmd or cmd in used_cmd:
            continue
        if not cmd.startswith("/") and " " not in cmd:
            continue
        used_cmd.add(cmd)
        mp = menu_of(cmd)
        screens.append(("terminal", {"cmd": cmd, "menu": mp, "title": c.get("title") or "RouterOS",
                                     "comment": "", "lesson": lesson}, 6.0))

    return screens


def render_screen(kind, data, step, total):
    lesson = data["lesson"]
    if kind == "winbox":
        img = render_winbox(data["menu"], cmd=data["cmd"])
        menu_label = ui.find_menu_label(data["menu"])
        trail = " → ".join(data["menu"])
        caption(img, f"{trail}", step, total, first_command(data["cmd"]))
        return img
    if kind == "terminal":
        img = render_terminal(data["cmd"], data.get("menu"), comment=data.get("comment"))
        caption(img, f"Терминал · {data.get('title') or 'RouterOS'}", step, total)
        return img
    if kind == "card":
        img = slide_card(data["title"], data["chapter"], data["body"], data["note"], step, total, "RouterOS")
        return img
    return slide_summary(lesson, step, total)


# --------------------------------------------------------------------------
# Озвучка
# --------------------------------------------------------------------------
def concat_audio(lesson_id):
    parts = sorted([f for f in os.listdir(AUDIO_DIR)
                    if f.startswith(lesson_id + "-p") and f.endswith(".mp3")])
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


def make_video(lesson, screens, audio, total_dur):
    lst = os.path.join(SLIDES_DIR, f"_{lesson['id']}_slides.txt")
    with open(lst, "w") as fh:
        for path, dur in screens:
            fh.write(f"file '{path}'\nduration {dur:.3f}\n")
        fh.write(f"file '{screens[-1][0]}'\nduration {screens[-1][1]:.3f}\n")

    out = os.path.join(OUT_DIR, f"{lesson['id']}.mp4")
    cmd = [FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
           "-f", "concat", "-safe", "0", "-i", lst]
    if audio:
        cmd += ["-i", audio]
    else:
        cmd += ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"]
    cmd += ["-c:v", "libx264", "-preset", "medium", "-crf", "30", "-maxrate", "700k", "-bufsize", "1400k",
            "-pix_fmt", "yuv420p", "-profile:v", "baseline", "-level", "3.1", "-r", "25",
            "-vf", f"scale={W}:{H}",
            "-c:a", "aac", "-b:a", "96k", "-ar", "44100", "-ac", "1",
            "-movflags", "+faststart", "-shortest", out]
    subprocess.run(cmd, check=True)
    os.remove(lst)
    return out


def main():
    only = sys.argv[1:] if len(sys.argv) > 1 else None
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(SLIDES_DIR, exist_ok=True)
    lessons = json.load(open(os.path.join(MEDIA, "narration.json"), encoding="utf-8"))
    built = 0
    for lesson in lessons:
        if only and lesson["id"] not in only:
            continue
        screens = build_screens(lesson)
        total = len(screens) + 2
        paths = []
        step = 1

        # титул
        p = os.path.join(SLIDES_DIR, f"{lesson['id']}-00.png")
        slide_title(lesson["title"], lesson["chapter"], lesson["id"], step, total).save(p)
        paths.append((p, 4.0))
        step += 1

        for kind, data, dur in screens:
            p = os.path.join(SLIDES_DIR, f"{lesson['id']}-{step:02d}.png")
            render_screen(kind, data, step, total).save(p)
            paths.append((p, dur))
            step += 1

        # итог
        p = os.path.join(SLIDES_DIR, f"{lesson['id']}-end.png")
        slide_summary(lesson, step, total).save(p)
        paths.append((p, 5.0))
        step += 1

        # озвучка: длительность экранов подгоняется под неё
        audio, audio_dur = (None, 0.0)
        if os.path.isdir(AUDIO_DIR):
            audio, audio_dur = concat_audio(lesson["id"])
        if audio and audio_dur > 0:
            sum_d = sum(d for _, d in paths)
            k = audio_dur / max(sum_d, 0.1)
            paths = [(p, max(d * k, 1.2)) for p, d in paths]
        else:
            paths = [(p, d) for p, d in paths]

        out = make_video(lesson, paths, audio, sum(d for _, d in paths))
        dur = probe_duration(out)
        size = os.path.getsize(out) // 1024
        voice = "с озвучкой" if audio else "без озвучки"
        print(f"  ✓ {lesson['id']}: {dur:6.1f} с, {size:5d} КБ, экранов: {len(paths):2d} ({voice})", flush=True)
        built += 1
        for p, _ in paths:
            os.remove(p)
        if audio:
            os.remove(audio)
    print(f"Готово: {built} видео.")


if __name__ == "__main__":
    main()
