"""Crop the few pack sprites Emberwing uses into public/sprites/.
The full packs in ./assets are licensed for use but NOT redistribution,
so ./assets is git-ignored and only these crops ship. Re-run with:
    python3 tools/extract-sprites.py
"""
from PIL import Image, ImageSequence
import os
A = 'assets'
OUT = 'public/sprites'
os.makedirs(OUT, exist_ok=True)

def gif_strip(src, dst):
    g = Image.open(src)
    frames = [f.convert('RGBA').copy() for f in ImageSequence.Iterator(g)]
    w, h = frames[0].size
    strip = Image.new('RGBA', (w * len(frames), h))
    for i, f in enumerate(frames):
        strip.paste(f, (w * i, 0))
    strip.save(dst)

# Cozy Fishing (Shubibubi): perched seagull, 2-frame idle + 2-frame peck, 18x18 cells
gull = Image.new('RGBA', (72, 18))
for i, name in enumerate(['seagull_fly', 'seagull_peck']):
    g = Image.open(f'{A}/Cozy Fishing/Gifs/{name}.gif')
    for j, f in enumerate(ImageSequence.Iterator(g)):
        gull.paste(f.convert('RGBA'), (36 * i + 18 * j, 0))
gull.save(f'{OUT}/gull.png')

# Cozy Nature (Shubibubi): pine tree + dead oak, 32x32 cells
n = Image.open(f'{A}/Cozy Nature/global.png').convert('RGBA')
n.crop((96, 0, 128, 32)).save(f'{OUT}/pine.png')
n.crop((128, 32, 160, 64)).save(f'{OUT}/oak_dead.png')

# Cozy Winter (Shubibubi): windswept bare tree
w = Image.open(f'{A}/Cozy Winter/winter_global.png').convert('RGBA')
w.crop((1, 335, 32, 380)).crop(w.crop((1, 335, 32, 380)).getbbox()).save(f'{OUT}/tree_bare.png')
print('ok', os.listdir(OUT))
