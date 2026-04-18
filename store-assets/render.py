"""
Render HTML screens to PNG at exact 1280x800.
Inlines _template.css into each HTML before rendering.
"""
from html2image import Html2Image
import os
import re
import time
import shutil

here = os.path.dirname(os.path.abspath(__file__))
os.chdir(here)

# اقرأ CSS المشترك
with open('_template.css', 'r', encoding='utf-8') as f:
    TEMPLATE_CSS = f.read()

# أنشئ مجلد مؤقت فيه النسخ المدمجة
tmp_dir = os.path.join(here, '_tmp')
os.makedirs(tmp_dir, exist_ok=True)

screens = ['screen1.html', 'screen2.html', 'screen3.html', 'screen4.html', 'screen5.html']

for s in screens:
    with open(s, 'r', encoding='utf-8') as f:
        html = f.read()

    # استبدل رابط CSS بمحتواه
    html = re.sub(
        r'<link[^>]+_template\.css[^>]*>',
        f'<style>\n{TEMPLATE_CSS}\n</style>',
        html
    )

    tmp_file = os.path.join(tmp_dir, s)
    with open(tmp_file, 'w', encoding='utf-8') as f:
        f.write(html)

hti = Html2Image(
    output_path=here,
    size=(1280, 800),
    custom_flags=[
        '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
        '--default-background-color=00000000',
        '--force-device-scale-factor=1',
        '--font-render-hinting=none'
    ]
)

for s in screens:
    out = s.replace('.html', '.png')
    tmp_file = os.path.join(tmp_dir, s)
    print(f'Rendering {s} -> {out}')
    hti.screenshot(html_file=tmp_file, save_as=out, size=(1280, 800))
    time.sleep(3)  # وقت لتحميل الخطوط
    print(f'  done')

shutil.rmtree(tmp_dir, ignore_errors=True)
print(f'\nAll 5 screenshots rendered at 1280x800 in: {here}')
