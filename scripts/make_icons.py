#!/usr/bin/env python3
"""Generate Firebrox app icons (flame lettermark) with pure-stdlib Python.

Produces:
  public/icons/apple-touch-icon.png  (180x180, solid background — iOS masks it)
  public/icons/icon-192.png          (192x192, rounded corners + alpha)
  public/icons/icon-512.png          (512x512, rounded corners + alpha)
  apple-touch-icon.png               (repo root, for the GitHub Pages landing page)

No dependencies: builds PNGs with zlib + struct, draws the flame as a
smooth-min (metaball) distance field of stacked circles.
"""
import math
import os
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


# ---------- PNG writer ----------
def write_png(path, w, h, rows):
    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(png)
    print(f"wrote {path} ({len(png)} bytes)")


# ---------- color helpers ----------
def hexc(s):
    return tuple(int(s[i : i + 2], 16) for i in (0, 2, 4))


def lerp3(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def clamp01(x):
    return 0.0 if x < 0 else (1.0 if x > 1 else x)


# ---------- flame field ----------
# Spine of discs (in 512-space): a teardrop flame, gently swaying.
OUTER = [
    (256, 332, 106),
    (256, 262, 96),
    (248, 198, 78),
    (262, 146, 56),
    (251, 106, 36),
    (256, 68, 17),
]
CORE = [
    (256, 320, 58),
    (256, 272, 50),
    (253, 224, 34),
    (258, 186, 20),
    (256, 158, 10),
]


def smin(a, b, k=52.0):
    h = max(k - abs(a - b), 0.0) / k
    return min(a, b) - h * h * k * 0.25


def field(discs, x, y, scale=1.0):
    d = 1e9
    for cx, cy, r in discs:
        cx = 256 + (cx - 256) * scale
        cy = 318 + (cy - 318) * scale
        r = r * scale
        dx, dy = x - cx, y - cy
        d = smin(d, math.sqrt(dx * dx + dy * dy) - r)
    return d


def render(size, rounded=False, solid=False):
    """Render the icon at `size`. rounded -> rounded-rect alpha; solid -> opaque bg."""
    s = size / 512.0
    rows = []
    # palette
    bg_top = hexc("181210")
    bg_bot = hexc("0a0807")
    glow = hexc("ff6a3d")
    flame_top = hexc("ff4517")
    flame_mid = hexc("ff6a3d")
    flame_bot = hexc("ffab47")
    core_top = hexc("ffc95e")
    core_bot = hexc("fff4d8")
    corner = 112 * s  # rounded-corner radius
    for py in range(size):
        row = bytearray()
        y512 = py / s
        for px in range(size):
            x512 = px / s
            # background gradient
            t = clamp01(y512 / 512.0)
            col = lerp3(bg_top, bg_bot, t)
            # warm radial glow behind flame
            gx, gy = x512 - 256, y512 - 300
            gd = math.sqrt(gx * gx + gy * gy) / 340.0
            g = clamp01(1.0 - gd) ** 2.2 * 0.22
            col = tuple(min(255, col[i] + glow[i] * g) for i in range(3))
            alpha = 255
            # outer flame
            d = field(OUTER, x512, y512)
            fa = clamp01(0.5 - d / 1.6)
            if fa > 0:
                ft = clamp01((y512 - 60.0) / 280.0)  # 0 at tip, 1 at base
                fc = lerp3(flame_top, flame_mid, min(1.0, ft * 1.6))
                if ft > 0.62:
                    fc = lerp3(flame_mid, flame_bot, (ft - 0.62) / 0.38)
                col = tuple(col[i] + (fc[i] - col[i]) * fa for i in range(3))
            # inner core
            d2 = field(CORE, x512, y512)
            ca = clamp01(0.5 - d2 / 1.6) * 0.95
            if ca > 0:
                ct = clamp01((y512 - 140.0) / 200.0)
                cc = lerp3(core_top, core_bot, ct)
                col = tuple(col[i] + (cc[i] - col[i]) * ca for i in range(3))
            # rounded-corner mask (alpha)
            if rounded and not solid:
                rx, ry = px, py
                m = 1.0
                if rx < corner and ry < corner:
                    m = clamp01(1.0 - (math.hypot(corner - rx, corner - ry) / 1.4))
                elif rx > size - corner and ry < corner:
                    m = clamp01(1.0 - (math.hypot(rx - (size - corner), corner - ry) / 1.4))
                elif rx < corner and ry > size - corner:
                    m = clamp01(1.0 - (math.hypot(corner - rx, ry - (size - corner)) / 1.4))
                elif rx > size - corner and ry > size - corner:
                    m = clamp01(1.0 - (math.hypot(rx - (size - corner), ry - (size - corner)) / 1.4))
                alpha = int(255 * m)
            row += bytes(
                (int(col[0]), int(col[1]), int(col[2]), alpha if not solid else 255)
            )
        rows.append(row)
    return rows


if __name__ == "__main__":
    icons = os.path.join(ROOT, "public", "icons")
    write_png(os.path.join(icons, "apple-touch-icon.png"), 180, 180, render(180))
    write_png(os.path.join(icons, "icon-192.png"), 192, 192, render(192, rounded=True))
    write_png(os.path.join(icons, "icon-512.png"), 512, 512, render(512, rounded=True))
    # root-level copy for the GitHub Pages landing page
    write_png(os.path.join(ROOT, "apple-touch-icon.png"), 180, 180, render(180))
