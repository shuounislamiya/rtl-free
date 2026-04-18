"""
RTL Free — Icon Generator
يولّد أيقونات PNG احترافية بأحجام مختلفة
"""

from PIL import Image, ImageDraw, ImageFont
import os

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icons')
os.makedirs(OUT_DIR, exist_ok=True)

# الألوان — تدرج أحمر
COLOR_1 = (239, 68, 68)    # #ef4444 red
COLOR_2 = (190, 18, 60)    # #be123c rose-900
WHITE = (255, 255, 255)


def gradient_bg(size, c1, c2):
    """ينشئ خلفية تدرج لوني قطري"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size - 2)
            r = int(c1[0] + (c2[0] - c1[0]) * t)
            g = int(c1[1] + (c2[1] - c1[1]) * t)
            b = int(c1[2] + (c2[2] - c1[2]) * t)
            img.putpixel((x, y), (r, g, b, 255))
    return img


def rounded_mask(size, radius):
    """ينشئ قناع بزوايا دائرية"""
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def find_arabic_font(size):
    """يبحث عن خط عربي متاح على النظام"""
    candidates = [
        'C:/Windows/Fonts/tahoma.ttf',
        'C:/Windows/Fonts/arial.ttf',
        'C:/Windows/Fonts/arialbd.ttf',
        'C:/Windows/Fonts/trado.ttf',
        'C:/Windows/Fonts/segoeuib.ttf',
        'C:/Windows/Fonts/segoeui.ttf',
        '/System/Library/Fonts/Helvetica.ttc',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def draw_icon(size, letter='R'):
    """يرسم الأيقونة بحجم معيّن"""
    # تدرج الخلفية
    bg = gradient_bg(size, COLOR_1, COLOR_2)

    # إطار بزوايا دائرية
    radius = max(int(size * 0.22), 2)
    mask = rounded_mask(size, radius)

    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    img.paste(bg, (0, 0), mask)

    # رسم الحرف العربي
    draw = ImageDraw.Draw(img)
    font_size = int(size * 0.62)
    font = find_arabic_font(font_size)

    # قياس النص للمحاذاة
    try:
        bbox = draw.textbbox((0, 0), letter, font=font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        offset_x = -bbox[0]
        offset_y = -bbox[1]
    except Exception:
        w, h = draw.textsize(letter, font=font)
        offset_x, offset_y = 0, 0

    x = (size - w) // 2 + offset_x
    y = (size - h) // 2 + offset_y - int(size * 0.05)

    # ظل خفيف
    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.text((x + 1, y + 1), letter, font=font, fill=(0, 0, 0, 80))

    img = Image.alpha_composite(img, shadow)
    draw = ImageDraw.Draw(img)
    draw.text((x, y), letter, font=font, fill=WHITE)

    return img


def main():
    sizes = [16, 32, 48, 128]
    for size in sizes:
        # للأحجام الكبيرة نرسم بحجم 4x ثم نصغّر للحصول على حواف ناعمة
        render_size = size * 4 if size < 128 else size * 2
        icon = draw_icon(render_size)
        icon = icon.resize((size, size), Image.LANCZOS)
        path = os.path.join(OUT_DIR, f'icon{size}.png')
        icon.save(path, 'PNG', optimize=True)
        print(f'✓ {path} ({size}x{size})')

    # أيقونة SVG مصدر
    svg = '''<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ef4444"/>
      <stop offset="100%" stop-color="#be123c"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#g)"/>
  <text x="64" y="92" text-anchor="middle" fill="white" font-size="82" font-weight="800" font-family="Inter, Arial, sans-serif">R</text>
</svg>'''
    with open(os.path.join(OUT_DIR, 'icon.svg'), 'w', encoding='utf-8') as f:
        f.write(svg)
    print('✓ icons/icon.svg')

    print('\nتم توليد كل الأيقونات بنجاح.')


if __name__ == '__main__':
    main()
