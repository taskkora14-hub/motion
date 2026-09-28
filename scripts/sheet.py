# Contact sheet of rendered stills (dev helper): python3 scripts/sheet.py out/stills out/sheet.png
import sys, glob
from PIL import Image, ImageDraw
fs = sorted(glob.glob(sys.argv[1] + '/*.png'))
w, h = 360, 640
cols = min(5, len(fs)); rows = (len(fs) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * (h + 30)), 'white')
d = ImageDraw.Draw(sheet)
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGB').resize((w, h))
    x, y = (i % cols) * w, (i // cols) * (h + 30)
    sheet.paste(im, (x, y + 30)); d.text((x + 8, y + 8), f.split('/')[-1], fill='black')
sheet.save(sys.argv[2])
