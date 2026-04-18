"""
Render promo tiles to PNG at exact dimensions.
"""
from html2image import Html2Image
import os
import time

here = os.path.dirname(os.path.abspath(__file__))
os.chdir(here)

jobs = [
    ('promo-small.html', 'promo-small.png', 440, 280),
    ('promo-marquee.html', 'promo-marquee.png', 1400, 560),
]

for html_file, out, w, h in jobs:
    hti = Html2Image(
        output_path=here,
        size=(w, h),
        custom_flags=[
            '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
            '--default-background-color=00000000',
            '--force-device-scale-factor=1',
            '--font-render-hinting=none'
        ]
    )
    print(f'Rendering {html_file} ({w}x{h}) -> {out}')
    hti.screenshot(html_file=html_file, save_as=out, size=(w, h))
    time.sleep(3)
    print('  done')

print('\nBoth promo tiles rendered.')
