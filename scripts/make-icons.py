#!/usr/bin/env python3
"""Генерация иконок приложения (веб + Android mipmaps) без внешних зависимостей."""
from PIL import Image, ImageDraw
import os

BG = (17, 22, 29)
ORANGE = (255, 106, 26)
BLUE = (55, 185, 241)
DARK = (13, 17, 23)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def draw_icon(size: int, rounded: bool = True, padding: float = 0.0) -> Image.Image:
    """Рисует иконку роутера: тёмный фон, оранжевый корпус, синие wifi-волны."""
    s = size * 4  # рисуем с запасом для сглаживания
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    m = int(s * padding)
    box = (m, m, s - m, s - m)
    if rounded:
        d.rounded_rectangle(box, radius=int((s - 2 * m) * 0.22), fill=BG, outline=ORANGE, width=max(2, int(s * 0.012)))
    else:
        d.rectangle(box, fill=BG)

    cx = s / 2
    # wifi-волны
    for rad, wdt in ((0.30, 0.028), (0.20, 0.028)):
        d.arc([cx - s * rad, s * 0.16, cx + s * rad, s * 0.16 + s * 2 * rad],
              start=200, end=340, fill=BLUE, width=max(2, int(s * wdt)))

    # антенны
    aw = max(2, int(s * 0.022))
    d.line([(cx - s * 0.17, s * 0.66), (cx - s * 0.17, s * 0.45)], fill=BLUE, width=aw)
    d.line([(cx + s * 0.17, s * 0.66), (cx + s * 0.17, s * 0.45)], fill=BLUE, width=aw)

    # корпус
    body = [cx - s * 0.28, s * 0.63, cx + s * 0.28, s * 0.75]
    d.rounded_rectangle(body, radius=int(s * 0.03), fill=ORANGE)

    # индикаторы
    r = s * 0.022
    for dx in (-0.14, -0.07):
        d.ellipse([cx + s * dx - r, s * 0.675 - r, cx + s * dx + r, s * 0.675 + r], fill=DARK)

    return img.resize((size, size), Image.LANCZOS)


def save(img: Image.Image, path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "PNG", optimize=True)
    print(f"  {os.path.relpath(path, ROOT):<62} {os.path.getsize(path) // 1024:>4} КБ")


print("Иконки веб-приложения:")
web = os.path.join(ROOT, "web", "assets", "img")
save(draw_icon(192), os.path.join(web, "icon-192.png"))
save(draw_icon(512), os.path.join(web, "icon-512.png"))
# maskable: безопасная зона 80% — рисуем фон на всю площадь, логотип меньше
save(draw_icon(512, rounded=False, padding=0.14), os.path.join(web, "icon-maskable-512.png"))
save(draw_icon(180), os.path.join(web, "apple-touch-icon.png"))
save(draw_icon(32), os.path.join(web, "favicon-32.png"))

print("Иконки Android (mipmap):")
res = os.path.join(ROOT, "android", "app", "src", "main", "res")
for folder, size in (("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)):
    d = os.path.join(res, f"mipmap-{folder}")
    save(draw_icon(size), os.path.join(d, "ic_launcher.png"))
    save(draw_icon(size), os.path.join(d, "ic_launcher_round.png"))

print("Готово.")
