#!/usr/bin/env python3
"""Generate the Green Lantern mod's pixel-art textures as PNGs (stdlib only)."""
import zlib
import struct
import os
import math

OUT = os.path.join(os.path.dirname(__file__), "..",
                   "src", "main", "resources", "assets", "greenlantern")


def write_png(path, pixels, w, h):
    """pixels: list of (r,g,b,a) rows-major length w*h."""
    raw = bytearray()
    for y in range(h):
        raw.append(0)  # filter type 0
        for x in range(w):
            r, g, b, a = pixels[y * w + x]
            raw += bytes((r, g, b, a))

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        c += struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        return c

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    png = sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(png)
    print("wrote", os.path.relpath(path))


def blank(w, h, color=(0, 0, 0, 0)):
    return [color for _ in range(w * h)]


def px(buf, w, x, y, color):
    if 0 <= x < w and 0 <= y < (len(buf) // w):
        buf[y * w + x] = color


# ---------------------------------------------------------------------------
# Power Ring (16x16) — a gold band with a glowing green lantern emblem gem.
# ---------------------------------------------------------------------------
def power_ring():
    w = h = 16
    b = blank(w, h)
    gold = (212, 175, 55, 255)
    gold_d = (150, 120, 30, 255)
    gold_l = (245, 215, 110, 255)
    green = (33, 221, 59, 255)
    green_l = (150, 255, 160, 255)
    green_d = (14, 130, 30, 255)
    black = (18, 22, 18, 255)

    cx, cy = 8, 10
    r_out = 5.2
    r_in = 3.0
    for y in range(h):
        for x in range(w):
            dx = x - cx + 0.5
            dy = y - cy + 0.5
            d = math.hypot(dx, dy)
            if r_in <= d <= r_out:
                # shading based on angle for a metallic look
                if d > r_out - 0.9:
                    c = gold_d
                elif d < r_in + 0.9:
                    c = gold_l
                else:
                    c = gold
                px(b, w, x, y, c)

    # The lantern-emblem gem sits at the top of the ring.
    gem = [
        (6, 3), (7, 3), (8, 3), (9, 3),
        (5, 4), (6, 4), (7, 4), (8, 4), (9, 4), (10, 4),
        (5, 5), (6, 5), (7, 5), (8, 5), (9, 5), (10, 5),
        (6, 6), (7, 6), (8, 6), (9, 6),
    ]
    for (x, y) in gem:
        px(b, w, x, y, green)
    # gem highlights / emblem bars
    for (x, y) in [(6, 4), (7, 4), (6, 5)]:
        px(b, w, x, y, green_l)
    for (x, y) in [(9, 5), (9, 6), (8, 6)]:
        px(b, w, x, y, green_d)
    # emblem: two horizontal bars (lantern silhouette)
    px(b, w, 7, 4, black)
    px(b, w, 8, 4, black)
    px(b, w, 7, 5, black)
    px(b, w, 8, 5, black)
    write_png(os.path.join(OUT, "textures", "item", "power_ring.png"), b, w, h)


# ---------------------------------------------------------------------------
# Willpower Crystal (16x16) — a faceted green gem.
# ---------------------------------------------------------------------------
def willpower_crystal():
    w = h = 16
    b = blank(w, h)
    green = (33, 221, 59, 255)
    green_l = (170, 255, 180, 255)
    green_d = (12, 120, 28, 255)
    edge = (8, 70, 18, 255)

    shape = {
        7: (8, 8), 6: (6, 10), 5: (5, 11), 4: (5, 11),
        3: (6, 10), 2: (7, 9), 1: (8, 8),
    }
    # build a diamond
    for y in range(16):
        span = 7 - abs(y - 7)
        if span < 0:
            continue
        for x in range(8 - span, 8 + span):
            b[y * w + x] = green
    # facet shading: left side lighter, right darker
    for y in range(16):
        span = 7 - abs(y - 7)
        if span < 0:
            continue
        left = 8 - span
        right = 8 + span - 1
        for x in range(8 - span, 8 + span):
            if x <= left + 1:
                b[y * w + x] = green_l
            elif x >= right - 1:
                b[y * w + x] = green_d
    # central sparkle line
    for y in range(3, 13):
        b[y * w + 8] = green_l if y % 2 == 0 else green
    # outline
    for y in range(16):
        span = 7 - abs(y - 7)
        if span < 0:
            continue
        b[y * w + (8 - span)] = edge
        b[y * w + (8 + span - 1)] = edge
    write_png(os.path.join(OUT, "textures", "item", "willpower_crystal.png"), b, w, h)


# ---------------------------------------------------------------------------
# Power Battery block texture (16x16) — green lantern housing with panel.
# ---------------------------------------------------------------------------
def power_battery():
    w = h = 16
    b = blank(w, h, (60, 62, 66, 255))
    metal = (90, 94, 100, 255)
    metal_d = (55, 58, 63, 255)
    metal_l = (140, 145, 152, 255)
    green = (33, 221, 59, 255)
    green_l = (160, 255, 175, 255)
    green_d = (16, 140, 34, 255)

    for y in range(h):
        for x in range(w):
            b[y * w + x] = metal if (x + y) % 2 == 0 else metal_d
    # rivets on corners
    for (x, y) in [(1, 1), (14, 1), (1, 14), (14, 14)]:
        b[y * w + x] = metal_l
    # glowing green panel in the middle
    for y in range(4, 12):
        for x in range(4, 12):
            c = green
            if x == 4 or y == 4:
                c = green_l
            if x == 11 or y == 11:
                c = green_d
            b[y * w + x] = c
    # lantern emblem inside panel (two bars + circle gap)
    for x in range(6, 10):
        b[6 * w + x] = green_d
        b[9 * w + x] = green_d
    b[7 * w + 7] = green_l
    b[7 * w + 8] = green_l
    b[8 * w + 7] = green_l
    b[8 * w + 8] = green_l
    write_png(os.path.join(OUT, "textures", "block", "power_battery.png"), b, w, h)


# ---------------------------------------------------------------------------
# Mod icon (64x64) — big lantern emblem on dark background.
# ---------------------------------------------------------------------------
def icon():
    w = h = 64
    b = blank(w, h, (14, 18, 16, 255))
    green = (33, 221, 59, 255)
    green_l = (170, 255, 185, 255)
    green_d = (12, 120, 28, 255)
    black = (10, 12, 10, 255)

    cx, cy = 32, 32
    # outer green circle
    for y in range(h):
        for x in range(w):
            d = math.hypot(x - cx + 0.5, y - cy + 0.5)
            if d <= 26:
                c = green
                if d > 24:
                    c = green_d
                elif d < 10:
                    c = green_l
                b[y * w + x] = c
    # lantern emblem: two horizontal bars + central circle band (classic look)
    for y in range(h):
        for x in range(w):
            d = math.hypot(x - cx + 0.5, y - cy + 0.5)
            if d <= 26:
                # top bar
                if 12 <= y <= 20:
                    b[y * w + x] = black
                # bottom bar
                if 44 <= y <= 52:
                    b[y * w + x] = black
                # central ring band
                ring = abs(d - 15)
                if ring < 3 and not (24 <= x <= 40 and 26 <= y <= 38):
                    b[y * w + x] = black
    write_png(os.path.join(OUT, "icon.png"), b, w, h)


if __name__ == "__main__":
    power_ring()
    willpower_crystal()
    power_battery()
    icon()
    print("All textures generated.")
