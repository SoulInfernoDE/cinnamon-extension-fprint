#!/usr/bin/python3
"""Assembles docs/volume.gif (English) and docs/volume.de.gif (German) from the
captures of capture-volume.py: the applet's two sliders on top, the settings
page below, both at the same value, from 100 % down to 30 %.

The sliders carry no text, so one set of them serves both languages. The
settings window is cut just below its section - the rest of it is empty - and
everything outside the rounded outlines is transparent, as in states.gif.

usage: make-volume-gif.py CAPTURES
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

VALUES = [100, 80, 60, 45, 30]
DURATIONS = [1500, 450, 450, 450, 2200]
GAP = 18
MAX_WIDTH = 760
MENU_RADIUS = 6

captures = sys.argv[1]
docs = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs")


def corner_radius(img, inner_xy):
    a = np.array(img).astype(int)
    inner = a[inner_xy[1], inner_xy[0]]
    d = next((i for i in range(30) if np.abs(a[i, i] - inner).max() < 8), 0)
    return int(round(d / (1 - 1 / np.sqrt(2)))) if d else 0


def content_bottom(img, top=70):
    a = np.array(img).astype(int)
    background = a[-5, a.shape[1] // 2]
    rows = np.where(np.abs(a[top:] - background).max(axis=2).max(axis=1) > 12)[0]
    return top + (rows.max() if len(rows) else 0)


def rounded_mask(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.size[0] - 1, img.size[1] - 1), radius=radius, fill=255)
    return mask


menu = {v: Image.open(os.path.join(captures, "menu", f"{v}.png")).convert("RGB") for v in VALUES}
for lang, out in (("en", "volume.gif"), ("de", "volume.de.gif")):
    window = {v: Image.open(os.path.join(captures, lang, f"{v}.png")).convert("RGB") for v in VALUES}
    first = window[VALUES[0]]
    bottom = max(content_bottom(window[v]) for v in VALUES) + 24
    radius = max(corner_radius(first, (40, 40)), 6)
    width = first.size[0]
    frames = []
    for v in VALUES:
        w = window[v].crop((0, 0, width, bottom))
        m = menu[v]
        height = m.size[1] + GAP + w.size[1]
        canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        canvas.paste(m, ((width - m.size[0]) // 2, 0), rounded_mask(m, MENU_RADIUS))
        canvas.paste(w, (0, m.size[1] + GAP), rounded_mask(w, radius))
        if width > MAX_WIDTH:
            canvas = canvas.resize((MAX_WIDTH, round(height * MAX_WIDTH / width)), Image.LANCZOS)
        frames.append(canvas)

    fw, fh = frames[0].size
    montage = Image.new("RGB", (fw * len(frames), fh))
    for i, f in enumerate(frames):
        montage.paste(f.convert("RGB"), (i * fw, 0))
    palette = montage.quantize(colors=255, method=Image.MAXCOVERAGE).getpalette()[:255 * 3] + [255, 0, 255]
    palimg = Image.new("P", (1, 1))
    palimg.putpalette(palette)
    gif = []
    for f in frames:
        q = f.convert("RGB").quantize(palette=palimg, dither=Image.FLOYDSTEINBERG)
        q.paste(255, mask=f.getchannel("A").point(lambda a: 255 if a < 128 else 0))
        gif.append(q)
    path = os.path.join(docs, out)
    gif[0].save(path, save_all=True, append_images=gif[1:], duration=DURATIONS, loop=0,
                transparency=255, disposal=2, optimize=False)
    print(f"{path}: {fw}x{fh}")
