#!/usr/bin/python3
"""Assembles docs/states.gif (English) and docs/states.de.gif (German) from the
captures of tools/render-preview.js.

The captures are whole-monitor screenshots, so they also show whatever was on
the screen behind the dialog. Everything outside the dialog's rounded outline is
therefore made transparent - which also keeps the animation clean on light and
dark pages alike. One frame per state, held for the durations the login screen's
animation uses; one shared palette with Floyd-Steinberg dithering per language.

usage: make-preview-gif.py CAPTURES   (CAPTURES/de and CAPTURES/en from the renders)
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

NAMES = ["1-waiting", "2-failed", "3-success", "4-password"]
SEQUENCE = [("1-waiting", 2400), ("2-failed", 1500), ("1-waiting", 1600),
            ("3-success", 1500), ("1-waiting", 1600), ("4-password", 1800)]
TRANSPARENT = 255

captures = sys.argv[1]
docs = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs")

rect = {}
for line in open(os.path.join(captures, "de", "log.txt")):
    p = line.split()
    if len(p) == 5 and p[0] in NAMES:
        x, y, w, h = map(int, p[1:])
        rect[p[0]] = (x, y, x + w, y + h)
box = (min(r[0] for r in rect.values()), min(r[1] for r in rect.values()),
       max(r[2] for r in rect.values()), max(r[3] for r in rect.values()))
W, H = box[2] - box[0], box[3] - box[1]

# The dialog's corner radius, measured: along the diagonal from its corner until
# the dialog's own colour is reached.
first = np.array(Image.open(os.path.join(captures, "de", "1-waiting.png")).convert("RGB")).astype(int)
x0, y0 = rect["1-waiting"][:2]
inner = first[y0 + 40, x0 + 40]
d = next(i for i in range(40) if np.abs(first[y0 + i, x0 + i] - inner).max() < 6)
radius = int(round(d / (1 - 1 / np.sqrt(2))))


def frame(lang, name):
    img = Image.open(os.path.join(captures, lang, name + ".png")).convert("RGB").crop(box)
    r = rect[name]
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (r[0] - box[0], r[1] - box[1], r[2] - box[0] - 1, r[3] - box[1] - 1), radius=radius, fill=255)
    return img, mask


for lang, out in (("en", "states.gif"), ("de", "states.de.gif")):
    frames = {n: frame(lang, n) for n in NAMES}
    montage = Image.new("RGB", (W * len(NAMES), H))
    for i, n in enumerate(NAMES):
        montage.paste(frames[n][0], (i * W, 0))
    palette = montage.quantize(colors=255, method=Image.MAXCOVERAGE).getpalette()[:255 * 3] + [255, 0, 255]
    palimg = Image.new("P", (1, 1))
    palimg.putpalette(palette)
    gif = []
    for n, _ in SEQUENCE:
        img, mask = frames[n]
        q = img.quantize(palette=palimg, dither=Image.FLOYDSTEINBERG)
        q.paste(TRANSPARENT, mask=Image.eval(mask, lambda v: 255 - v))
        gif.append(q)
    path = os.path.join(docs, out)
    gif[0].save(path, save_all=True, append_images=gif[1:], duration=[t for _, t in SEQUENCE],
                loop=0, transparency=TRANSPARENT, disposal=2, optimize=False)
    print(f"{path}: {W}x{H}, corner radius {radius}px")
