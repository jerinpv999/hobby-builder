"""Road, rail, air and water vehicles with smooth bodies.

Built in stud units (the Hobby Builder footprint: x 0..w, z 0..d, front towards +z).  The city
script builds the same shapes and scales them down.  Materials starting with "color" take the
colour picked in the app.
"""
import math
import random

from lib import *  # noqa: F403

DETAIL = {"k": 1.0}  # fewer segments for the small city versions


def n_(count):
    return max(6, int(round(count * DETAIL["k"])))


def mats():
    ensure("color_paint", "#ffffff", 0.2, 0.18)
    ensure("color", "#ffffff", 0.45, 0.0, True)
    ensure("color_dark", "#ffffff", 0.5, 0.0, True)
    for name, colour, rough, metal in (
        ("glass", "#31506a", 0.04, 0.35), ("tyre", "#151517", 0.9, 0.0), ("rim", "#c8cdd5", 0.22, 0.65), ("chrome", "#e6eaf0", 0.1, 0.8),
        ("dark", "#242932", 0.5, 0.2), ("black", "#0e0f11", 0.65, 0.0), ("white", "#eef0f2", 0.3, 0.1), ("redlight", "#d21c1c", 0.15, 0.1),
        ("amber", "#ff9a1f", 0.2, 0.0), ("headlight", "#fff6cf", 0.08, 0.2), ("bluelight", "#2461e0", 0.15, 0.1), ("yellow", "#f0c22c", 0.35, 0.05),
        ("steel", "#9aa3ad", 0.35, 0.65), ("timber", "#9a6a38", 0.7, 0.0), ("sail", "#f6f3ea", 0.85, 0.0), ("hullred", "#a8261f", 0.5, 0.05),
        ("coal", "#1c1c1f", 0.95, 0.0), ("flame", "#ff8a24", 0.3, 0.0), ("red", "#cc2222", 0.35, 0.1), ("blue", "#1f57b8", 0.35, 0.1), ("green", "#237841", 0.4, 0.05), ("orange", "#ee7d18", 0.4, 0.05),
    ):
        ensure(name, colour, rough, metal, name in ("sail",))


def spline(rows, k=4):
    """Catmull-Rom through rows of numbers, k steps between neighbours."""
    k = max(2, int(round(k * DETAIL["k"])))
    out = []
    for i in range(len(rows) - 1):
        p0, p1, p2, p3 = rows[max(i - 1, 0)], rows[i], rows[i + 1], rows[min(i + 2, len(rows) - 1)]
        for s in range(k):
            t = s / k
            out.append(tuple(0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t ** 3) for a, b, c, d in zip(p0, p1, p2, p3)))
    out.append(tuple(rows[-1]))
    return out


def se(t, e):
    c, s = math.cos(t), math.sin(t)
    return math.copysign(abs(c) ** (2 / e), c), math.copysign(abs(s) ** (2 / e), s)


def body(a, cx, rows, mat, seg=28, k=4, paint=None, caps=True):
    """A shell along z through cross-sections (z, half width, bottom, top, squareness)."""
    seg = n_(seg)
    rings = []
    for z, hw, y0, y1, e in spline(rows, k):
        ring = []
        for i in range(seg):
            x, y = se(math.tau * (i + 0.5) / seg, max(e, 1.6))
            ring.append((cx + x * max(hw, 0.004), (y0 + y1) / 2 + y * max((y1 - y0) / 2, 0.004), z))
        rings.append(ring)
    a.loft(rings, mat, caps, paint)


def lathe(a, base, rows, mat, axis="y", seg=32, k=3, paint=None):
    """A turned shape: rows of (distance along the axis, radius)."""
    seg = n_(seg)
    rings = []
    for h, r in spline(rows, k):
        ring = []
        for i in range(seg):
            t = math.tau * i / seg
            u, v = math.cos(t) * max(r, 0.003), math.sin(t) * max(r, 0.003)
            if axis == "y":
                ring.append((base[0] + u, base[1] + h, base[2] + v))
            else:
                ring.append((base[0] + u, base[1] + v, base[2] + h))
        rings.append(ring)
    a.loft(rings, mat, True, paint)


def foil(a, sections, mat, seg=18, vertical=False):
    """A wing: sections of (spanwise position, leading edge z, chord, thickness, height)."""
    seg = n_(seg)
    rings = []
    for pos, lead, chord, thick, h in sections:
        ring = []
        for i in range(seg):
            t = math.tau * i / seg
            f = (1 - math.cos(t)) / 2  # 0 at the leading edge, 1 at the trailing edge
            side = math.copysign(math.sqrt(max(f, 0)) * (1 - f) * 1.3, math.sin(t)) * thick
            z = lead - f * chord
            ring.append((h + side, pos, z) if vertical else (pos, h + side, z))
        rings.append(ring)
    a.loft(rings, mat)


def rbox(a, w, h, d, mat, x, y, z, r=0.06):
    a.box(w, h, d, mat, x, y, z, r)


def bar(a, p, q, r, mat, seg=8):
    a.capsule(p, q, r, r, mat, n_(seg))


def wheel(a, x, z, r, w, side, y=None, spokes=6):
    """A tyre with a rounded shoulder, alloy rim, spokes and hub; `side` is which way it faces."""
    y = r if y is None else y
    sh = min(w * 0.35, r * 0.2)
    a.tube((x - w / 2 + sh, y, z), (x + w / 2 - sh, y, z), r, r, "tyre", n_(28), caps=False)
    for s in (-1, 1):
        a.torus((x + s * (w / 2 - sh), y, z), r - sh, sh, "tyre", "x", n_(28), n_(10))
        a.tube((x + s * (w / 2 - sh * 0.4), y, z), (x + s * (w / 2), y, z), r - sh * 0.9, r - sh * 1.6, "tyre", n_(28))
    face = x + side * (w / 2)
    a.tube((face - side * 0.02, y, z), (face + side * 0.008, y, z), r * 0.62, r * 0.6, "dark", n_(28))
    a.torus((face + side * 0.008, y, z), r * 0.57, r * 0.045, "rim", "x", n_(28), n_(8))
    for i in range(spokes):
        t = math.tau * i / spokes
        a.capsule((face + side * 0.022, y, z), (face + side * 0.012, y + math.cos(t) * r * 0.52, z + math.sin(t) * r * 0.52), r * 0.075, r * 0.05, "rim", n_(8))
    a.ball(face + side * 0.026, y, z, r * 0.1, r * 0.16, r * 0.16, "chrome", n_(12), n_(7))


def arches(a, z, r, hw, mat="dark", cx=1.0, tube=0.055):
    for s in (-1, 1):
        a.tube((cx + s * (hw - 0.1), r, z), (cx + s * (hw + 0.004), r, z), r + 0.07, r + 0.07, "black", n_(26))
        a.torus((cx + s * (hw + 0.006), r, z), r + 0.075, tube, mat, "x", n_(18), n_(8), 0.0, math.pi)


def lamp_pair(a, z, y, mat, dx=0.55, rx=0.17, ry=0.075, facing=1, cx=1.0):
    for s in (-1, 1):
        a.ball(cx + s * dx, y, z, rx + 0.025, ry + 0.022, 0.035, "chrome", n_(14), n_(8))
        a.ball(cx + s * dx, y, z + facing * 0.018, rx, ry, 0.032, mat, n_(14), n_(8))


def mirrors(a, z, y, hw, mat="color_paint"):
    for s in (-1, 1):
        bar(a, (1 + s * (hw - 0.08), y - 0.05, z), (1 + s * (hw + 0.1), y, z), 0.025, "dark")
        a.ball(1 + s * (hw + 0.14), y + 0.03, z, 0.07, 0.09, 0.11, mat, n_(14), n_(9))
        a.ball(1 + s * (hw + 0.14), y + 0.03, z - 0.085, 0.055, 0.07, 0.035, "glass", n_(12), n_(7))


def plates(a, front, back, y):
    rbox(a, 0.44, 0.12, 0.016, "white", 1, y, front, 0.006)
    rbox(a, 0.44, 0.12, 0.016, "yellow", 1, y + 0.1, back, 0.006)


def lightbar(a, y, z):
    rbox(a, 0.9, 0.05, 0.2, "dark", 1, y, z, 0.02)
    for s, m in ((-1, "redlight"), (1, "bluelight")):
        a.capsule((1 + s * 0.12, y + 0.06, z), (1 + s * 0.36, y + 0.06, z), 0.065, 0.065, m, n_(12))
    rbox(a, 0.1, 0.09, 0.12, "chrome", 1, y + 0.06, z, 0.02)


# ---------------------------------------------------------------- cars
def car(a, kind="sedan"):
    L = {"lux": 4.96, "fullsuv": 4.96, "pickup": 4.96}.get(kind, 3.98)
    suv = kind in ("suv", "midsuv", "fullsuv")
    W = 0.83
    r = 0.44 if kind in ("midsuv", "fullsuv", "pickup") else 0.41
    low = 0.82 if kind == "sport" else 1.0
    base = 0.46 if kind in ("midsuv", "fullsuv", "pickup") else 0.36 * low
    belt = (1.15 if suv or kind == "pickup" else 0.99) * low
    zr, zf = 0.86, L - 0.86
    body(a, 1, [(0.07, 0.5, base + 0.2, belt - 0.24, 2.6), (0.16, 0.76, base + 0.06, belt - 0.07, 3.5), (0.45, W, base, belt, 5), (L * 0.42, W, base - 0.02, belt, 6), (zf - 0.15, W, base - 0.02, belt - 0.02, 6), (L - 0.45, W - 0.01, base + 0.02, belt - 0.13, 4.5), (L - 0.17, W - 0.1, base + 0.08, belt - 0.24, 3.5), (L - 0.06, 0.52, base + 0.18, belt - 0.33, 2.6)], "color_paint", 32, 4)
    for z in (zr, zf):
        arches(a, z, r, W, "dark" if suv or kind == "pickup" else "color_paint", tube=0.075 if kind in ("midsuv", "fullsuv", "pickup") else 0.045)
        for s in (-1, 1):
            wheel(a, 1 + s * 0.84, z, r, 0.29, s)
    # cabin: (start, front of roof span) per body style
    if suv:
        top = 1.97 if kind != "suv" else 1.92
        cab = [(0.2, 0.62, belt - 0.1, belt + 0.08, 4), (0.34, 0.74, belt - 0.1, top - 0.14, 4.5), (0.65, 0.76, belt - 0.1, top - 0.02, 5), (L - 2.15, 0.76, belt - 0.1, top, 5), (L - 1.72, 0.74, belt - 0.1, top - 0.12, 4.5), (L - 1.2, 0.7, belt - 0.12, belt + 0.03, 4)]
        roof = (0.5, L - 2.0, top)
        posts = [0.42, L * 0.4, L - 2.05]
        windscreen = (L - 1.25, L - 1.9)
    elif kind == "pickup":
        top = 1.7
        cab = [(2.0, 0.66, belt - 0.1, belt + 0.08, 4), (2.15, 0.75, belt - 0.1, top - 0.1, 5), (2.45, 0.76, belt - 0.1, top, 5), (3.05, 0.76, belt - 0.1, top, 5), (3.45, 0.74, belt - 0.1, top - 0.14, 4.5), (3.9, 0.7, belt - 0.12, belt + 0.02, 4)]
        roof = (2.3, 3.2, top)
        posts = [2.2, 2.75, 3.18]
        windscreen = (3.84, 3.25)
    elif kind == "race":
        cab = None
    else:
        top = {"sport": 1.25, "lux": 1.6}.get(kind, 1.62)
        s0, s1 = (1.1, L - 1.2) if kind == "lux" else (0.72, L - 1.08)
        mid0, mid1 = s0 + 0.65, s1 - 0.8
        cab = [(s0, 0.64, belt - 0.1, belt + 0.03, 3.5), (s0 + 0.32, 0.72, belt - 0.1, top - 0.14, 4), (mid0, 0.73, belt - 0.1, top - 0.01, 4.5), (mid1, 0.73, belt - 0.1, top, 4.5), (s1 - 0.42, 0.72, belt - 0.1, top - 0.17, 4), (s1, 0.68, belt - 0.12, belt + 0.01, 3.5)]
        roof = (mid0 - 0.1, mid1 + 0.08, top)
        posts = [s0 + 0.4, (mid0 + mid1) / 2, mid1 + 0.15]
        windscreen = (s1 - 0.03, mid1 + 0.14)
    if cab:
        body(a, 1, cab, "glass", 30, 4)
        body(a, 1, [(roof[0], 0.55, roof[2] - 0.09, roof[2] - 0.02, 4), (roof[0] + 0.2, 0.68, roof[2] - 0.1, roof[2] + 0.035, 5), (roof[1] - 0.2, 0.68, roof[2] - 0.1, roof[2] + 0.035, 5), (roof[1], 0.55, roof[2] - 0.09, roof[2] - 0.02, 4)], "color_paint", 28, 4)
        for s in (-1, 1):
            for z in posts:
                bar(a, (1 + s * 0.75, belt - 0.03, z), (1 + s * 0.69, roof[2] - 0.05, z + (-0.05 if z > L / 2 else 0.04)), 0.035, "color_paint")
            bar(a, (1 + s * 0.72, belt - 0.02, windscreen[0] - 0.04), (1 + s * 0.64, roof[2] - 0.05, windscreen[1]), 0.036, "color_paint")
            bar(a, (1 + s * 0.75, belt + 0.005, posts[0] - 0.12), (1 + s * 0.74, belt + 0.005, windscreen[0] - 0.15), 0.016, "chrome" if kind == "lux" else "dark")
        for s in (-0.28, 0.32):  # wipers
            bar(a, (1 + s - 0.2, belt + 0.07, windscreen[0] - 0.12), (1 + s + 0.12, belt + 0.2, windscreen[0] - 0.28), 0.012, "black", 6)
        mirrors(a, windscreen[0] - 0.1, belt + 0.07, W)
        for s in (-1, 1):  # doors
            for z in (posts[0] + 0.12, posts[1], windscreen[0] - 0.2):
                rbox(a, 0.008, (belt - base) * 0.72, 0.012, "black", 1 + s * (W - 0.003), (belt + base) / 2, z, 0.002)
            for z in (posts[0] + 0.3, posts[1] + 0.18):
                bar(a, (1 + s * (W + 0.008), belt - 0.16, z), (1 + s * (W + 0.008), belt - 0.16, z + 0.14), 0.018, "chrome")
    # nose and tail
    nose, ny = L - 0.075, belt - 0.27
    lamp_pair(a, nose - 0.02, ny, "headlight")
    rbox(a, 0.62, 0.19, 0.06, "black", 1, ny - 0.04, nose, 0.03)
    for i in range(3):
        bar(a, (0.74, ny - 0.09 + i * 0.055, nose + 0.035), (1.26, ny - 0.09 + i * 0.055, nose + 0.035), 0.009, "chrome", 6)
    a.torus((1, ny + 0.02, nose + 0.055), 0.045, 0.012, "chrome", "z", n_(18), n_(6))
    for s in (-1, 1):
        a.ball(1 + s * 0.52, base + 0.12, nose - 0.01, 0.09, 0.045, 0.035, "amber", n_(10), n_(6))
    lamp_pair(a, 0.095, belt - 0.2, "redlight", 0.57, 0.15, 0.08, -1)
    a.capsule((0.3, base + 0.07, L - 0.14), (1.7, base + 0.07, L - 0.14), 0.085, 0.085, "dark", n_(12))
    a.capsule((0.3, base + 0.1, 0.14), (1.7, base + 0.1, 0.14), 0.085, 0.085, "dark", n_(12))
    plates(a, L - 0.045, 0.045, base + 0.1)
    a.tube((0.45, base - 0.04, 0.35), (0.45, base - 0.04, 0.04), 0.045, 0.05, "chrome", n_(14))
    for s in (-1, 1):  # sills
        bar(a, (1 + s * (W - 0.02), base + 0.03, zr + r + 0.08), (1 + s * (W - 0.02), base + 0.03, zf - r - 0.08), 0.05, "dark")
    # per style
    if kind == "lux":
        for s in (-1, 1):
            bar(a, (1 + s * (W + 0.006), 0.62, 0.4), (1 + s * (W + 0.006), 0.62, L - 0.4), 0.014, "chrome")
        for i in range(7):
            bar(a, (0.76 + i * 0.08, ny - 0.1, nose + 0.04), (0.76 + i * 0.08, ny + 0.03, nose + 0.04), 0.01, "chrome", 6)
    if kind == "sport":
        for s in (-1, 1):
            bar(a, (1 + s * 0.5, belt - 0.05, 0.3), (1 + s * 0.52, belt + 0.16, 0.2), 0.03, "dark")
        foil(a, [(0.2, 0.34, 0.28, 0.03, belt + 0.17), (1.0, 0.36, 0.3, 0.04, belt + 0.17), (1.8, 0.34, 0.28, 0.03, belt + 0.17)], "color_paint")
        a.ball(1, belt - 0.08, L - 0.9, 0.22, 0.06, 0.32, "dark", n_(14), n_(8))
    if kind == "taxi":
        rbox(a, 0.55, 0.18, 0.24, "yellow", 1, 1.74, 1.75, 0.07)
        rbox(a, 0.3, 0.08, 0.25, "black", 1, 1.74, 1.75, 0.02)
        for i in range(18):
            for s in (-1, 1):
                rbox(a, 0.012, 0.07, 0.11, "black" if i % 2 else "white", 1 + s * (W + 0.002), 0.8, 0.95 + i * 0.12, 0.002)
    if kind == "police":
        lightbar(a, 1.66, 1.75)
        for s in (-1, 1):
            rbox(a, 0.014, 0.42, 1.55, "white", 1 + s * (W - 0.001), 0.7, 2.0, 0.006)
            a.torus((1 + s * (W + 0.012), 0.72, 2.0), 0.13, 0.022, "bluelight", "x", n_(18), n_(6))
    if suv:
        t = 1.97 if kind != "suv" else 1.92
        for s in (-1, 1):
            bar(a, (1 + s * 0.55, t + 0.08, 0.65), (1 + s * 0.55, t + 0.08, L - 2.1), 0.028, "chrome")
            for z in (0.75, L - 2.2):
                bar(a, (1 + s * 0.55, t, z), (1 + s * 0.55, t + 0.08, z), 0.024, "dark")
    if kind in ("midsuv", "fullsuv"):
        for s in (-1, 1):
            bar(a, (1 + s * 0.42, base + 0.05, L - 0.04), (1 + s * 0.42, belt - 0.08, L - 0.04), 0.035, "chrome")
        for y in (base + 0.2, belt - 0.1):
            bar(a, (0.4, y, L - 0.035), (1.6, y, L - 0.035), 0.032, "chrome")
        a.torus((1, 1.1, 0.04), 0.27, 0.095, "tyre", "z", n_(24), n_(10))
        a.ball(1, 1.1, 0.04, 0.2, 0.2, 0.05, "color_paint", n_(16), n_(8))
    if kind == "fullsuv":
        for s in (-1, 1):
            bar(a, (1 + s * (W + 0.09), base - 0.04, zr + 0.55), (1 + s * (W + 0.09), base - 0.04, zf - 0.55), 0.05, "chrome")
        bar(a, (1.82, belt, L - 1.5), (1.8, 2.0, L - 1.95), 0.05, "dark")
        for z in (0.8, 1.4, 2.0, 2.6):
            bar(a, (0.45, 2.07, z), (1.55, 2.07, z), 0.022, "dark")
    if kind == "pickup":
        rbox(a, 1.5, 0.06, 1.75, "dark", 1, belt + 0.01, 1.05, 0.02)
        for s in (-1, 1):
            rbox(a, 0.12, 0.32, 1.85, "color_paint", 1 + s * 0.74, belt + 0.12, 1.08, 0.055)
            bar(a, (1 + s * 0.66, belt + 0.2, 1.9), (1 + s * 0.62, 1.62, 1.98), 0.035, "chrome")
        rbox(a, 1.58, 0.32, 0.12, "color_paint", 1, belt + 0.12, 0.17, 0.055)
        rbox(a, 1.5, 0.42, 0.1, "color_paint", 1, belt + 0.17, 1.98, 0.045)
        bar(a, (0.38, 1.62, 1.98), (1.62, 1.62, 1.98), 0.035, "chrome")


def racecar(a):
    body(a, 1, [(0.35, 0.34, 0.2, 0.55, 3), (0.8, 0.46, 0.16, 0.68, 3.5), (1.5, 0.44, 0.15, 0.62, 3), (2.2, 0.33, 0.16, 0.54, 3), (3.0, 0.2, 0.18, 0.44, 2.6), (3.75, 0.11, 0.2, 0.34, 2.4), (3.95, 0.05, 0.22, 0.28, 2)], "color_paint", 28, 5)
    for s in (-1, 1):
        body(a, 1 + s * 0.48, [(0.85, 0.12, 0.16, 0.42, 3), (1.15, 0.22, 0.14, 0.52, 4), (1.9, 0.2, 0.15, 0.46, 3.5), (2.35, 0.08, 0.18, 0.3, 3)], "color_paint", 20, 4)
        a.ball(1 + s * 0.48, 0.34, 2.36, 0.1, 0.09, 0.05, "black", n_(14), n_(8))
        for z, r, w in ((0.75, 0.42, 0.42), (3.15, 0.34, 0.3)):
            wheel(a, 1 + s * (0.98 - w / 2), z, r, w, s, spokes=5)
            bar(a, (1 + s * 0.25, 0.42, z + 0.18), (1 + s * (0.95 - w), r, z), 0.022, "dark")
            bar(a, (1 + s * 0.25, 0.26, z - 0.18), (1 + s * (0.95 - w), r, z), 0.022, "dark")
        rbox(a, 0.05, 0.4, 0.5, "color_paint", 1 + s * 0.86, 0.78, 0.28, 0.02)
        rbox(a, 0.05, 0.2, 0.38, "color_paint", 1 + s * 0.94, 0.24, 3.9, 0.02)
        bar(a, (1 + s * 0.25, 0.5, 0.5), (1 + s * 0.28, 0.82, 0.3), 0.03, "dark")
    for y, ch in ((0.94, 0.36), (0.78, 0.22)):
        foil(a, [(0.14, 0.45, ch, 0.04, y), (1.86, 0.45, ch, 0.04, y)], "color_paint")
    for y, z in ((0.17, 4.1), (0.27, 3.95)):
        foil(a, [(0.06, z, 0.24, 0.03, y), (1.0, z + 0.06, 0.28, 0.035, y - 0.01), (1.94, z, 0.24, 0.03, y)], "white" if y > 0.2 else "color_paint")
    a.ball(1, 0.6, 1.85, 0.25, 0.14, 0.42, "black", n_(18), n_(10))
    a.ball(1, 0.8, 1.72, 0.17, 0.18, 0.19, "white", n_(18), n_(12))
    a.ball(1, 0.81, 1.86, 0.13, 0.07, 0.08, "glass", n_(14), n_(8))
    body(a, 1, [(0.9, 0.2, 0.55, 0.7, 2.4), (1.35, 0.14, 0.55, 0.98, 2.4), (1.55, 0.06, 0.55, 0.9, 2.2)], "color_paint", 18, 4)
    a.torus((1, 0.66, 2.1), 0.2, 0.025, "dark", "y", n_(18), n_(6), math.pi, math.pi)
    for s in (-1, 1):
        a.ball(1 + s * 0.215, 0.5, 2.7, 0.012, 0.13, 0.13, "white", n_(18), n_(8))


# ---------------------------------------------------------------- vans and buses
def side_windows(a, hw, y, h, z0, z1, count, cx=1.0, mat="glass", frame="dark"):
    bay = (z1 - z0) / count
    for s in (-1, 1):
        for i in range(count):
            z = z0 + bay * (i + 0.5)
            rbox(a, 0.024, h + 0.045, bay - 0.045, frame, cx + s * (hw - 0.006), y, z, 0.01)
            rbox(a, 0.03, h, bay - 0.095, mat, cx + s * (hw - 0.002), y, z, 0.012)


def screens(a, L, hw, y, h, cx=1.0):
    rbox(a, hw * 1.72, h, 0.05, "glass", cx, y, L - 0.085, 0.022)
    bar(a, (cx, y - h / 2, L - 0.055), (cx, y + h / 2, L - 0.055), 0.014, "dark")
    rbox(a, hw * 1.5, h * 0.7, 0.05, "glass", cx, y + 0.05, 0.085, 0.022)


def van(a, kind="van"):
    L, r = 4.96, 0.41
    paint = "white" if kind == "ambulance" else "color_paint"
    body(a, 1, [(0.07, 0.7, 0.55, 1.55, 5), (0.17, 0.82, 0.38, 1.74, 6.5), (0.6, 0.84, 0.36, 1.77, 7), (3.3, 0.84, 0.36, 1.77, 7), (3.85, 0.83, 0.36, 1.68, 6), (4.45, 0.82, 0.36, 1.2, 5), (4.82, 0.76, 0.4, 0.96, 4), (4.93, 0.55, 0.52, 0.8, 3)], paint, 36, 5)
    body(a, 1, [(3.62, 0.74, 1.18, 1.73, 6), (3.9, 0.77, 1.1, 1.69, 6), (4.42, 0.75, 0.98, 1.29, 5), (4.55, 0.68, 0.98, 1.12, 4)], "glass", 30, 5)
    for z in (0.95, 3.98):
        arches(a, z, r, 0.84, "dark", tube=0.05)
        for s in (-1, 1):
            wheel(a, 1 + s * 0.85, z, r, 0.27, s)
    side_windows(a, 0.842, 1.36, 0.45, 2.7, 3.65, 1)
    if kind == "van":
        side_windows(a, 0.842, 1.36, 0.45, 0.45, 2.6, 2)
    for s in (-1, 1):
        for z in (1.5, 2.62, 3.68):
            rbox(a, 0.01, 1.15, 0.012, "black", 1 + s * 0.84, 0.98, z, 0.002)
        bar(a, (1 + s * 0.856, 1.0, 2.75), (1 + s * 0.856, 1.0, 2.95), 0.02, "dark")
        bar(a, (1 + s * 0.82, 0.42, 1.5), (1 + s * 0.82, 0.42, 3.45), 0.07, "dark")
    mirrors(a, 4.05, 1.25, 0.86, "dark")
    lamp_pair(a, 4.9, 0.72, "headlight", 0.52)
    rbox(a, 0.6, 0.16, 0.05, "black", 1, 0.66, 4.93, 0.025)
    for z in (4.86, 0.1):
        a.capsule((0.3, 0.45, z), (1.7, 0.45, z), 0.09, 0.09, "dark", n_(12))
    lamp_pair(a, 0.085, 0.9, "redlight", 0.66, 0.08, 0.19, -1)
    rbox(a, 0.012, 1.1, 0.01, "black", 1, 1.1, 0.07, 0.002)
    plates(a, 4.955, 0.062, 0.5)
    if kind == "ambulance":
        for s in (-1, 1):
            rbox(a, 0.016, 0.2, 3.9, "color", 1 + s * 0.84, 0.82, 2.25, 0.006)
            for w, h in ((0.5, 0.15), (0.15, 0.5)):
                rbox(a, 0.022, h, w, "red", 1 + s * 0.846, 1.32, 1.55, 0.006)
        lightbar(a, 1.76, 3.35)
        a.capsule((0.72, 1.8, 0.45), (1.28, 1.8, 0.45), 0.07, 0.07, "redlight", n_(12))


def bus(a, kind="city"):
    L = 5.96
    dd = kind == "double"
    school = kind == "school"
    top = 3.36 if dd else 1.82
    end = L - 1.05 if school else L
    body(a, 1, [(0.05, 0.74, 0.52, top - 0.16, 5), (0.16, 0.85, 0.38, top - 0.02, 7), (0.55, 0.87, 0.35, top, 8), (end - 0.55, 0.87, 0.35, top, 8), (end - 0.14, 0.85, 0.38, top - 0.02, 7), (end - 0.03, 0.74, 0.52, top - 0.18, 5)], "color_paint", 36, 4)
    if school:
        body(a, 1, [(end - 0.15, 0.72, 0.42, 1.2, 5), (end + 0.35, 0.68, 0.42, 1.1, 5), (L - 0.15, 0.62, 0.44, 0.98, 4), (L - 0.05, 0.45, 0.55, 0.85, 3)], "color_paint", 28, 4)
        screens(a, end + 0.01, 0.84, 1.38, 0.5)
        lamp_pair(a, L - 0.07, 0.75, "headlight", 0.44, 0.1, 0.09)
        rbox(a, 0.55, 0.3, 0.05, "black", 1, 0.72, L - 0.045, 0.02)
        for s in (-1, 1):
            for y in (0.66, 0.92):
                rbox(a, 0.018, 0.055, end - 0.6, "black", 1 + s * 0.87, y, end / 2, 0.006)
            for z, m in ((0.5, "redlight"), (end - 0.45, "amber")):
                a.ball(1 + s * 0.5, top - 0.1, 0.06 if z < 1 else end - 0.04, 0.1, 0.07, 0.04, m, n_(12), n_(7))
    else:
        screens(a, L, 0.87, 1.24, 0.72)
        if dd:
            screens(a, L, 0.84, 2.55, 0.6)
        lamp_pair(a, L - 0.04, 0.66, "headlight", 0.58, 0.14, 0.075)
        rbox(a, 0.95, 0.16, 0.04, "black", 1, 1.72 if not dd else 1.86, L - 0.04, 0.012)
        for i in range(6):
            rbox(a, 0.08, 0.07, 0.015, "amber", 0.7 + i * 0.12, 1.72 if not dd else 1.86, L - 0.017, 0.004)
    rear, front = 1.25, (L - 0.62 if school else L - 1.3)
    for z in (rear, front):
        arches(a, z, 0.42, 0.87, "dark", tube=0.05)
        for s in (-1, 1):
            wheel(a, 1 + s * 0.85, z, 0.42, 0.28, s)
    side_windows(a, 0.872, 1.34, 0.5, 0.35, end - 1.0 if not school else end - 0.15, 7)
    if dd:
        side_windows(a, 0.87, 2.58, 0.55, 0.35, L - 0.3, 8)
        for s in (-1, 1):
            rbox(a, 0.018, 0.2, L - 0.5, "white", 1 + s * 0.874, 1.93, L / 2, 0.006)
    elif not school:
        for s in (-1, 1):
            rbox(a, 0.018, 0.08, L - 0.5, "white", 1 + s * 0.874, 0.93, L / 2, 0.006)
    if not school:
        rbox(a, 0.03, 1.2, 0.68, "dark", 1.868, 0.98, L - 0.62, 0.012)
        for z in (L - 0.79, L - 0.45):
            rbox(a, 0.032, 1.08, 0.28, "glass", 1.874, 0.99, z, 0.012)
    rbox(a, 0.9, 0.09, 1.2, "white", 1, top + 0.01, 2.0, 0.035)
    for z in (0.1, L - 0.1):
        a.capsule((0.28, 0.46, z), (1.72, 0.46, z), 0.09, 0.09, "dark", n_(12))
    lamp_pair(a, 0.065, 0.82, "redlight", 0.66, 0.08, 0.13, -1)
    mirrors(a, end - 0.12, 1.42, 0.9, "dark")


# ---------------------------------------------------------------- trucks and site machines
def cab(a, z0, z1, top, mat="color_paint", hw=0.86):
    body(a, 1, [(z0, hw - 0.12, 0.6, top - 0.16, 5), (z0 + 0.14, hw, 0.48, top, 7), (z1 - 0.42, hw, 0.46, top, 7), (z1 - 0.12, hw - 0.02, 0.46, top - 0.14, 6), (z1 - 0.02, hw - 0.16, 0.56, top - 0.42, 4)], mat, 34, 4)
    rbox(a, hw * 1.7, 0.5, 0.06, "glass", 1, top - 0.45, z1 - 0.09, 0.026)
    side_windows(a, hw + 0.002, top - 0.42, 0.42, z1 - 0.95, z1 - 0.32, 1)
    mirrors(a, z1 - 0.16, top - 0.42, hw + 0.02, "dark")
    lamp_pair(a, z1 - 0.02, 0.76, "headlight", 0.52, 0.13, 0.07)
    rbox(a, 0.7, 0.26, 0.05, "black", 1, 0.92, z1 - 0.035, 0.022)
    for i in range(4):
        bar(a, (0.7, 0.83 + i * 0.062, z1 - 0.003), (1.3, 0.83 + i * 0.062, z1 - 0.003), 0.01, "chrome", 6)
    a.capsule((0.24, 0.52, z1 - 0.06), (1.76, 0.52, z1 - 0.06), 0.1, 0.1, "dark", n_(12))
    for s in (-1, 1):
        rbox(a, 0.01, top - 0.8, 0.012, "black", 1 + s * hw, (top + 0.6) / 2, z1 - 1.0, 0.002)
        bar(a, (1 + s * (hw + 0.012), top - 0.78, z1 - 0.9), (1 + s * (hw + 0.012), top - 0.78, z1 - 0.72), 0.02, "dark")


def chassis(a, L, axles, r=0.42):
    for s in (-1, 1):
        rbox(a, 0.14, 0.18, L - 0.3, "dark", 1 + s * 0.45, 0.55, L / 2, 0.035)
    for z in axles:
        bar(a, (0.35, r, z), (1.65, r, z), 0.07, "dark")
        for s in (-1, 1):
            wheel(a, 1 + s * 0.82, z, r, 0.34, s)
            a.torus((1 + s * 0.82, r, z), r + 0.08, 0.05, "dark", "x", n_(18), n_(8), 0.25, math.pi - 0.5)
    for s in (-1, 1):
        a.ball(1 + s * 0.62, 0.55, 0.14, 0.13, 0.07, 0.04, "redlight", n_(12), n_(7))
    a.capsule((0.3, 0.45, 0.18), (1.7, 0.45, 0.18), 0.06, 0.06, "dark", n_(10))


def truck(a, kind="box"):
    L = {"crane": 7.96, "dump": 5.96, "cement": 5.96}.get(kind, 6.96)
    axles = [0.75, 1.75, L - 0.85] if kind != "fire" else [0.9, 1.95, L - 0.9]
    chassis(a, L, axles)
    cab_top = {"box": 2.2, "fire": 1.78, "dump": 2.15, "cement": 2.15, "crane": 1.85}[kind]
    cab(a, L - 1.75, L, cab_top)
    zc = L - 1.85
    if kind == "box":
        rbox(a, 1.86, 2.05, zc - 0.15, "white", 1, 1.8, (zc + 0.15) / 2, 0.12)
        for s in (-1, 1):
            rbox(a, 0.014, 0.35, zc - 0.5, "color", 1 + s * 0.932, 1.4, (zc + 0.15) / 2, 0.006)
            for i in range(9):
                rbox(a, 0.02, 1.9, 0.03, "steel", 1 + s * 0.925, 1.8, 0.45 + i * (zc - 0.75) / 8, 0.008)
        rbox(a, 0.014, 1.8, 0.012, "dark", 1, 1.8, 0.145, 0.003)
        for x in (0.86, 1.14):
            bar(a, (x, 1.0, 0.13), (x, 2.6, 0.13), 0.016, "chrome", 6)
    if kind == "fire":
        body(a, 1, [(0.16, 0.8, 0.62, 1.45, 6), (0.3, 0.88, 0.55, 1.55, 8), (zc - 0.1, 0.88, 0.55, 1.55, 8), (zc, 0.82, 0.62, 1.48, 6)], "color_paint", 32, 3)
        for s in (-1, 1):
            for i in range(4):
                z = 0.7 + i * (zc - 1.1) / 3.4
                rbox(a, 0.03, 0.62, 0.82, "steel", 1 + s * 0.875, 1.03, z + 0.1, 0.012)
                bar(a, (1 + s * 0.9, 0.82, z - 0.15), (1 + s * 0.9, 0.82, z + 0.35), 0.015, "chrome", 6)
            rbox(a, 0.016, 0.1, L - 0.6, "white", 1 + s * 0.885, 1.43, L / 2, 0.005)
            bar(a, (1 + s * 0.36, 1.78, 0.2), (1 + s * 0.36, 1.92, L - 1.5), 0.04, "chrome")
            bar(a, (1 + s * 0.36, 1.58, 0.2), (1 + s * 0.36, 1.72, L - 1.5), 0.028, "chrome")
        for i in range(17):
            f = i / 16
            bar(a, (0.64, 1.78 + 0.14 * f, 0.3 + (L - 1.9) * f), (1.36, 1.78 + 0.14 * f, 0.3 + (L - 1.9) * f), 0.022, "chrome", 6)
        for z in (0.55, L - 2.2):
            rbox(a, 0.5, 0.2, 0.35, "dark", 1, 1.62, z, 0.05)
        lightbar(a, 1.82, L - 0.75)
        a.torus((1.9, 1.15, 0.55), 0.2, 0.06, "black", "x", n_(20), n_(8))
    if kind == "dump":
        def wall(x, y, z, w, h, d):
            rbox(a, w, h, d, "color_paint", x, y, z, 0.05)
        rbox(a, 1.5, 0.12, zc - 0.5, "dark", 1, 0.85, zc / 2 + 0.05, 0.04)
        for s in (-1, 1):
            wall(1 + s * 0.84, 1.45, zc / 2 + 0.05, 0.14, 1.05, zc - 0.25)
            for i in range(5):
                rbox(a, 0.05, 0.95, 0.12, "color_dark", 1 + s * 0.925, 1.45, 0.5 + i * (zc - 0.9) / 4, 0.02)
        wall(1, 1.55, zc - 0.1, 1.75, 1.25, 0.14)
        wall(1, 1.35, 0.2, 1.75, 0.85, 0.12)
        wall(1, 2.2, zc + 0.12, 1.7, 0.08, 0.5)
        for i in range(36):
            x, z = random.uniform(0.35, 1.65), random.uniform(0.55, zc - 0.55)
            s_ = random.uniform(0.18, 0.34)
            a.ball(x, 1.35 + (0.5 - abs(x - 1) * 0.4) * random.uniform(0.4, 1), z, s_, s_ * 0.65, s_, "coal" if i % 3 else "timber", 8, 5)
        bar(a, (1, 0.6, zc - 0.5), (1, 1.1, zc - 0.25), 0.07, "chrome")
    if kind == "cement":
        start = len(a.faces)
        rows = [(0.0, 0.34), (0.35, 0.6), (1.1, 0.84), (2.0, 0.82), (2.8, 0.55), (3.25, 0.32)]
        drum = Asset()
        lathe(drum, (0, 0, 0), rows, "white", "z", 36, 5, paint=lambda p: "orange" if math.sin(p[2] * 5.2 + math.atan2(p[1], p[0]) * 2) > 0.35 else "white")
        for pts, uv, mat, smooth, ns in drum.faces:  # tilt the drum, mouth to the back
            tilt = 0.2
            move = lambda p: (1 + p[0], 1.9 + p[1] * math.cos(tilt) + (p[2] - 1.7) * math.sin(tilt) * 0.8, 0.55 + p[2] * 0.98 - p[1] * math.sin(tilt) * 0.3)
            a.face([move(p) for p in pts], mat, uv, smooth, ns)
        assert len(a.faces) > start
        for z, h in ((1.0, 1.1), (3.2, 1.35)):
            for s in (-1, 1):
                bar(a, (1 + s * 0.65, 0.6, z), (1 + s * 0.45, h, z), 0.07, "dark")
        a.torus((1, 1.9, 2.5), 0.86, 0.045, "dark", "z", n_(30), n_(8))
        rbox(a, 0.4, 0.12, 0.55, "steel", 1, 1.15, 0.35, 0.04)
        a.tube((1, 2.55, 0.65), (1, 2.75, 0.35), 0.2, 0.34, "steel", n_(20))
    if kind == "crane":
        rbox(a, 1.8, 0.3, L - 1.9, "color_paint", 1, 0.85, (L - 1.9) / 2 + 0.1, 0.09)
        a.tube((1, 0.98, 2.2), (1, 1.22, 2.2), 0.72, 0.66, "dark", n_(28))
        cab(a, 2.5, 3.75, 2.35, "color_paint", 0.45)
        rbox(a, 1.5, 0.55, 1.0, "yellow", 1, 1.5, 1.25, 0.18)
        p0, p1 = (1.0, 1.75, 1.5), (1.0, 4.25, 7.6)
        for s in (-1, 1):
            for dy in (0.0, 0.34):
                bar(a, (p0[0] + s * 0.22, p0[1] + dy, p0[2]), (p1[0] + s * 0.1, p1[1] + dy * 0.4, p1[2]), 0.05, "yellow")
        for i in range(14):
            f, g = i / 14, (i + 1) / 14
            at = lambda t, s, dy: (1 + s * (0.22 - 0.12 * t), p0[1] + dy * (1 - 0.6 * t) + (p1[1] - p0[1]) * t, p0[2] + (p1[2] - p0[2]) * t)
            for s in (-1, 1):
                bar(a, at(f, s, 0), at(g, s, 0.34), 0.022, "yellow", 6)
            bar(a, at(f, -1, 0.34), at(f, 1, 0.34), 0.018, "yellow", 6)
        bar(a, (1, 1.0, 2.9), (1, 2.5, 3.4), 0.1, "chrome")
        bar(a, (1, 4.2, 7.6), (1, 2.3, 7.6), 0.012, "black", 6)
        a.torus((1, 2.15, 7.6), 0.12, 0.035, "steel", "x", n_(16), n_(8), math.pi * 0.8, math.pi * 1.5)
        rbox(a, 0.16, 0.2, 0.16, "yellow", 1, 2.34, 7.6, 0.05)
        for z in (0.45, 3.9):
            for s in (-1, 1):
                bar(a, (1 + s * 0.8, 0.75, z), (1 + s * 0.96, 0.75, z), 0.07, "steel")
                bar(a, (1 + s * 0.94, 0.75, z), (1 + s * 0.94, 0.12, z), 0.06, "chrome")
                a.tube((1 + s * 0.88, 0.04, z), (1 + s * 0.88, 0.12, z), 0.12, 0.1, "dark", n_(14))


def rickshaw(a):
    body(a, 1, [(0.12, 0.62, 0.45, 0.92, 4), (0.35, 0.82, 0.34, 1.0, 5), (1.7, 0.8, 0.34, 0.95, 5), (2.2, 0.52, 0.38, 1.02, 3.5), (2.6, 0.34, 0.5, 0.98, 3), (2.85, 0.2, 0.62, 0.86, 2.4)], "color_paint", 30, 5)
    body(a, 1, [(0.18, 0.62, 1.72, 1.86, 3), (0.4, 0.86, 1.68, 2.0, 3.5), (1.6, 0.86, 1.68, 2.02, 3.5), (2.2, 0.66, 1.66, 1.9, 3), (2.42, 0.4, 1.66, 1.76, 2.5)], "black", 28, 5)
    rbox(a, 1.34, 0.75, 0.05, "color_paint", 1, 1.33, 0.2, 0.025)
    rbox(a, 0.8, 0.3, 0.06, "glass", 1, 1.45, 0.17, 0.025)
    for s in (-1, 1):
        bar(a, (1 + s * 0.74, 0.95, 0.35), (1 + s * 0.76, 1.75, 0.4), 0.035, "black")
        bar(a, (1 + s * 0.52, 0.98, 2.2), (1 + s * 0.52, 1.74, 2.14), 0.032, "black")
        wheel(a, 1 + s * 0.84, 0.72, 0.38, 0.26, s)
        a.torus((1 + s * 0.84, 0.38, 0.72), 0.47, 0.05, "color_paint", "x", n_(18), n_(8), 0.0, math.pi)
    rbox(a, 0.98, 0.7, 0.04, "glass", 1, 1.37, 2.17, 0.018)
    rbox(a, 1.45, 0.2, 0.55, "dark", 1, 0.98, 0.7, 0.08)
    wheel(a, 1.0, 2.6, 0.33, 0.2, 1)
    for s in (-1, 1):
        bar(a, (1 + s * 0.14, 0.33, 2.6), (1 + s * 0.1, 1.05, 2.45), 0.03, "chrome")
    a.torus((1, 0.33, 2.6), 0.42, 0.045, "color_paint", "x", n_(18), n_(8), 0.3, math.pi - 0.7)
    bar(a, (0.72, 1.14, 2.42), (1.28, 1.14, 2.42), 0.025, "chrome")
    a.ball(1, 0.86, 2.86, 0.12, 0.11, 0.07, "headlight", n_(14), n_(8))
    lamp_pair(a, 0.12, 0.72, "redlight", 0.5, 0.09, 0.07, -1)


def tractor(a):
    for s in (-1, 1):
        wheel(a, 1 + s * 0.78, 0.82, 0.72, 0.42, s, spokes=8)
        wheel(a, 1 + s * 0.68, 2.45, 0.42, 0.3, s)
        a.torus((1 + s * 0.78, 0.72, 0.82), 0.84, 0.07, "color_paint", "x", n_(20), n_(8), 0.15, math.pi - 0.3)
        rbox(a, 0.42, 0.07, 0.65, "color_paint", 1 + s * 0.76, 1.58, 0.82, 0.03)
        for k in range(20):  # tread bars
            t = math.tau * k / 20
            bar(a, (1 + s * 0.6, 0.72 + math.cos(t) * 0.72, 0.82 + math.sin(t) * 0.72), (1 + s * 0.96, 0.72 + math.cos(t + 0.14) * 0.72, 0.82 + math.sin(t + 0.14) * 0.72), 0.028, "tyre", 6)
    body(a, 1, [(1.35, 0.42, 0.62, 1.32, 5), (2.2, 0.38, 0.62, 1.22, 5), (2.72, 0.34, 0.64, 1.14, 4), (2.84, 0.24, 0.72, 1.04, 3)], "color_paint", 28, 4)
    rbox(a, 0.5, 0.34, 0.05, "black", 1, 0.9, 2.84, 0.022)
    lamp_pair(a, 2.8, 1.06, "headlight", 0.18, 0.07, 0.05)
    rbox(a, 0.9, 0.4, 1.6, "dark", 1, 0.66, 1.2, 0.14)
    rbox(a, 0.5, 0.14, 0.42, "black", 1, 1.2, 0.72, 0.06)
    rbox(a, 0.5, 0.5, 0.12, "black", 1, 1.45, 0.5, 0.05)
    for x in (0.5, 1.5):
        for z in (0.42, 1.4):
            bar(a, (x, 0.9, z), (x, 2.08, z), 0.035, "dark")
    rbox(a, 1.2, 0.12, 1.2, "color_paint", 1, 2.14, 0.9, 0.05)
    a.torus((1, 1.5, 1.28), 0.18, 0.025, "black", "y", n_(20), n_(6))
    bar(a, (1, 1.2, 1.4), (1, 1.5, 1.28), 0.03, "dark")
    bar(a, (1.28, 1.2, 1.9), (1.28, 2.1, 1.9), 0.055, "steel")


def tracks(a, x, z0, z1, r=0.36, w=0.52):
    """A crawler track: rubber belt round rollers."""
    for z in (z0, z1):
        a.tube((x - w / 2, r + 0.1, z), (x + w / 2, r + 0.1, z), r, r, "black", n_(24))
        a.torus((x, r + 0.1, z), r + 0.015, 0.07, "tyre", "x", n_(24), n_(8))
        for s in (-1, 1):
            a.ball(x + s * w / 2, r + 0.1, z, 0.03, r * 0.5, r * 0.5, "steel", n_(16), n_(8))
    rbox(a, w, 0.14, z1 - z0, "tyre", x, 0.17, (z0 + z1) / 2, 0.05)
    rbox(a, w, 0.14, z1 - z0, "tyre", x, 2 * r + 0.13, (z0 + z1) / 2, 0.05)
    rbox(a, w - 0.08, 2 * r - 0.28, z1 - z0, "dark", x, r + 0.14, (z0 + z1) / 2, 0.08)
    steps = int((z1 - z0) / 0.17)
    for i in range(steps + 1):
        z = z0 + (z1 - z0) * i / steps
        for y in (0.12, 2 * r + 0.2):
            rbox(a, w + 0.05, 0.05, 0.08, "black", x, y, z, 0.015)
    for i in range(3):
        z = z0 + (z1 - z0) * (i + 1) / 4
        for s in (-1, 1):
            a.ball(x + s * w / 2, 0.38, z, 0.035, 0.14, 0.14, "steel", n_(12), n_(7))


def excavator(a):
    for x in (0.55, 2.45):
        tracks(a, x, 0.65, 3.0, 0.34, 0.6)
    a.tube((1.5, 0.75, 1.85), (1.5, 1.02, 1.85), 0.75, 0.75, "dark", n_(28))
    body(a, 1.5, [(0.35, 0.8, 1.1, 1.75, 3.5), (0.65, 1.05, 1.0, 1.95, 5), (2.2, 1.05, 1.0, 1.7, 5), (2.9, 0.9, 1.02, 1.45, 4)], "color_paint", 32, 4)
    body(a, 0.95, [(1.65, 0.46, 1.5, 2.55, 6), (1.85, 0.5, 1.45, 2.75, 6), (2.7, 0.5, 1.45, 2.72, 6), (2.95, 0.44, 1.5, 2.45, 4)], "glass", 26, 4)
    rbox(a, 1.08, 0.14, 1.3, "color_paint", 0.95, 2.76, 2.28, 0.06)
    for z in (1.7, 2.9):
        for s in (-1, 1):
            bar(a, (0.95 + s * 0.48, 1.5, z), (0.95 + s * 0.46, 2.7, z), 0.035, "color_paint")
    bar(a, (2.2, 1.9, 0.9), (2.2, 2.45, 0.9), 0.08, "steel")
    p = [(1.95, 1.5, 2.2), (1.95, 3.05, 3.15), (1.95, 2.2, 4.25), (1.95, 0.85, 4.45)]
    a.capsule(p[0], p[1], 0.2, 0.17, "color_paint", n_(14))
    a.capsule(p[1], p[2], 0.17, 0.13, "color_paint", n_(14))
    a.capsule(p[2], p[3], 0.13, 0.1, "color_paint", n_(14))
    for q0, q1 in (((1.95, 1.2, 2.8), (1.95, 2.3, 3.0)), ((1.95, 3.15, 2.7), (1.95, 2.75, 3.9))):
        bar(a, q0, ((q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2, (q0[2] + q1[2]) / 2), 0.075, "dark")
        bar(a, q0, q1, 0.04, "chrome")
    for q in p[1:3]:
        a.tube((1.68, q[1], q[2]), (2.22, q[1], q[2]), 0.09, 0.09, "dark", n_(14))
    # bucket
    rows = []
    for x in (1.55, 2.35):
        rows.append([(x, 0.85 + math.sin(t) * 0.55 * 0.9, 4.35 + math.cos(t) * 0.5) for t in [math.pi * (0.95 + 1.05 * i / 12) for i in range(13)]])
    a.loft(rows, "dark", True)
    for i in range(5):
        x = 1.62 + i * 0.165
        a.tube((x, 0.84, 4.8), (x, 0.66, 4.9), 0.045, 0.004, "steel", n_(8))


def bulldozer(a):
    for x in (0.5, 2.5):
        tracks(a, x, 0.65, 2.9, 0.42, 0.6)
    body(a, 1.5, [(0.3, 0.55, 0.7, 1.35, 5), (0.5, 0.68, 0.62, 1.5, 6), (2.0, 0.68, 0.62, 1.4, 6), (2.95, 0.6, 0.65, 1.28, 5), (3.1, 0.45, 0.75, 1.15, 3)], "color_paint", 30, 4)
    for x in (0.95, 2.05):
        for z in (0.65, 1.75):
            bar(a, (x, 1.35, z), (x, 2.12, z), 0.045, "dark")
    rbox(a, 1.35, 0.12, 1.35, "color_paint", 1.5, 2.17, 1.2, 0.05)
    rbox(a, 1.0, 0.62, 0.04, "glass", 1.5, 1.76, 1.76, 0.018)
    rbox(a, 0.55, 0.14, 0.42, "black", 1.5, 1.55, 0.95, 0.06)
    for y in (0.85, 0.98, 1.11):
        bar(a, (1.15, y, 3.11), (1.85, y, 3.11), 0.022, "black", 6)
    bar(a, (1.95, 1.3, 2.5), (1.95, 2.0, 2.5), 0.07, "steel")
    rows = []
    for x in (0.12, 0.6, 1.5, 2.4, 2.88):
        edge = 0.1 if x in (0.12, 2.88) else 0.0
        front = [(x, 0.1 + 1.3 * t, 3.65 + edge - math.sin(math.pi * t) * 0.24) for t in [i / 10 for i in range(11)]]
        back = [(x, p[1], p[2] - 0.13) for p in front[::-1]]
        rows.append(front + back)
    a.loft(rows, "color_paint", True)
    bar(a, (0.15, 0.14, 3.7), (2.85, 0.14, 3.7), 0.035, "steel")
    for x in (0.85, 2.15):
        bar(a, (x, 0.6, 2.9), (x, 0.65, 3.5), 0.085, "dark")
        bar(a, (x, 1.15, 2.85), (x, 0.95, 3.45), 0.05, "chrome")
    lamp_pair(a, 1.82, 2.05, "headlight", 0.45, 0.08, 0.06, 1, 1.5)


# ---------------------------------------------------------------- two wheelers
def spoked(a, x, z, r, tube=0.06, spokes=14, mat="rim"):
    a.torus((x, r, z), r - tube, tube, "tyre", "x", n_(36), n_(10))
    a.torus((x, r, z), r - tube * 2.1, 0.022, mat, "x", n_(36), n_(8))
    a.tube((x - 0.07, r, z), (x + 0.07, r, z), 0.05, 0.05, "chrome", n_(12))
    for i in range(spokes):
        t = math.tau * i / spokes
        bar(a, (x + (0.05 if i % 2 else -0.05), r, z), (x, r + math.cos(t) * (r - tube * 2.1), z + math.sin(t) * (r - tube * 2.1)), 0.007, "chrome", 5)


def bicycle(a):
    r, zr, zf = 0.62, 0.74, 3.26
    for z in (zr, zf):
        spoked(a, 0.5, z, r, 0.055, 18)
        a.torus((0.5, r, z), r + 0.06, 0.028, "color_paint", "x", n_(24), n_(8), 0.5, math.pi - 0.9)
    seat, crank, head = (0.5, 1.38, 1.45), (0.5, 0.55, 1.85), (0.5, 1.35, 2.85)
    for p, q in ((crank, seat), (crank, (0.5, 1.08, 2.92)), (seat, head), (head, (0.5, 1.0, 2.94)), (crank, (0.5, r, zr)), (seat, (0.5, r, zr))):
        bar(a, p, q, 0.04, "color_paint")
    for s in (-1, 1):
        bar(a, (0.5 + s * 0.09, 1.0, 2.94), (0.5 + s * 0.09, r, zf), 0.03, "chrome")
    bar(a, head, (0.5, 1.62, 2.76), 0.035, "chrome")
    bar(a, (0.22, 1.66, 2.74), (0.78, 1.66, 2.74), 0.032, "chrome")
    for x in (0.2, 0.8):
        a.capsule((x - 0.03, 1.66, 2.74), (x + 0.03, 1.66, 2.74), 0.052, 0.052, "black", n_(10))
    bar(a, seat, (0.5, 1.52, 1.41), 0.028, "chrome")
    body(a, 0.5, [(1.12, 0.13, 1.5, 1.6, 2.5), (1.35, 0.14, 1.5, 1.62, 2.5), (1.55, 0.06, 1.52, 1.6, 2), (1.75, 0.035, 1.53, 1.58, 2)], "black", 16, 4)
    a.torus((0.62, crank[1], crank[2]), 0.18, 0.018, "chrome", "x", n_(24), n_(6))
    bar(a, (0.62, 0.6, 1.88), (0.62, r + 0.07, zr), 0.012, "dark", 6)
    for s in (-1, 1):
        q = (0.5 + s * 0.2, crank[1] + s * 0.2, crank[2] + s * 0.08)
        bar(a, (0.5 + s * 0.1, crank[1], crank[2]), q, 0.028, "chrome")
        rbox(a, 0.2, 0.05, 0.13, "black", q[0] + s * 0.08, q[1], q[2], 0.018)
    a.ball(0.5, 1.56, 2.86, 0.08, 0.08, 0.06, "headlight", n_(12), n_(7))


def kick(a):
    for z in (0.38, 2.55):
        wheel(a, 0.5, z, 0.3, 0.14, 1, spokes=5)
    body(a, 0.5, [(0.55, 0.14, 0.24, 0.33, 4), (0.75, 0.25, 0.22, 0.34, 6), (2.0, 0.25, 0.22, 0.34, 6), (2.2, 0.1, 0.26, 0.4, 4)], "color_paint", 22, 4)
    rbox(a, 0.38, 0.02, 1.15, "black", 0.5, 0.35, 1.38, 0.008)
    bar(a, (0.5, 0.35, 2.18), (0.5, 0.65, 2.42), 0.05, "color_paint")
    bar(a, (0.5, 0.6, 2.45), (0.5, 2.1, 2.25), 0.04, "chrome")
    bar(a, (0.17, 2.12, 2.25), (0.83, 2.12, 2.25), 0.032, "chrome")
    for x in (0.18, 0.82):
        a.capsule((x - 0.04, 2.12, 2.25), (x + 0.04, 2.12, 2.25), 0.055, 0.055, "black", n_(10))
    for s in (-1, 1):
        bar(a, (0.5 + s * 0.11, 0.62, 2.45), (0.5 + s * 0.1, 0.3, 2.55), 0.028, "color_paint")
    a.torus((0.5, 0.3, 0.38), 0.37, 0.04, "color_paint", "x", n_(18), n_(8), 0.5, 1.9)


def scooter(a):
    r = 0.36
    for z in (0.65, 3.35):
        wheel(a, 0.5, z, r, 0.2, 1, spokes=5)
    body(a, 0.5, [(0.32, 0.16, 0.72, 0.9, 2.6), (0.55, 0.34, 0.55, 1.08, 3), (1.2, 0.36, 0.42, 1.1, 3.5), (1.75, 0.26, 0.38, 0.95, 3.5), (1.95, 0.2, 0.36, 0.5, 4)], "color_paint", 30, 5)
    body(a, 0.5, [(1.85, 0.27, 0.34, 0.46, 5), (2.6, 0.27, 0.34, 0.46, 5), (2.8, 0.2, 0.36, 0.55, 4)], "color_paint", 20, 3)
    rbox(a, 0.42, 0.025, 0.7, "black", 0.5, 0.47, 2.28, 0.01)
    body(a, 0.5, [(2.65, 0.28, 0.4, 0.8, 3), (2.82, 0.32, 0.5, 1.2, 3), (2.95, 0.2, 0.85, 1.35, 2.6), (3.0, 0.08, 1.0, 1.25, 2.2)], "color_paint", 26, 5)
    body(a, 0.5, [(0.5, 0.14, 1.05, 1.16, 3), (0.75, 0.23, 1.05, 1.24, 3), (1.35, 0.21, 1.06, 1.2, 3), (1.65, 0.1, 1.02, 1.12, 2.4)], "black", 22, 4)
    for s in (-1, 1):
        bar(a, (0.5 + s * 0.13, 0.4, 3.35), (0.5 + s * 0.08, 1.15, 3.0), 0.035, "chrome")
    a.torus((0.5, r, 3.35), r + 0.07, 0.07, "color_paint", "x", n_(22), n_(8), 0.35, math.pi - 0.9)
    body(a, 0.5, [(2.72, 0.2, 1.25, 1.45, 3), (2.9, 0.24, 1.22, 1.5, 3), (3.08, 0.12, 1.26, 1.44, 2.4)], "color_paint", 22, 4)
    a.ball(0.5, 1.36, 3.08, 0.11, 0.1, 0.06, "headlight", n_(16), n_(9))
    bar(a, (0.14, 1.46, 2.82), (0.86, 1.46, 2.82), 0.028, "chrome")
    for x in (0.16, 0.84):
        a.capsule((x - 0.04, 1.46, 2.82), (x + 0.04, 1.46, 2.82), 0.048, 0.048, "black", n_(10))
        bar(a, (x + (0.04 if x < 0.5 else -0.04), 1.46, 2.82), (x, 1.58, 2.76), 0.012, "chrome", 6)
        a.ball(x, 1.58, 2.76, 0.07, 0.045, 0.02, "dark", n_(10), n_(6))
    a.ball(0.5, 0.85, 0.34, 0.09, 0.06, 0.05, "redlight", n_(12), n_(7))
    bar(a, (0.78, 0.35, 1.3), (0.8, 0.3, 0.4), 0.065, "chrome")


def motorbike(a):
    r = 0.48
    for z in (0.62, 3.38):
        spoked(a, 0.5, z, r, 0.11, 10)
        a.tube((0.44, r, z), (0.56, r, z), 0.18, 0.18, "steel", n_(18))
    body(a, 0.5, [(1.75, 0.14, 0.86, 1.1, 2.5), (2.05, 0.27, 0.82, 1.3, 3), (2.5, 0.25, 0.86, 1.28, 3), (2.75, 0.12, 0.95, 1.18, 2.4)], "color_paint", 28, 5)
    body(a, 0.5, [(0.55, 0.09, 1.0, 1.14, 2.4), (0.85, 0.2, 0.9, 1.14, 3), (1.5, 0.19, 0.86, 1.04, 3), (1.85, 0.14, 0.86, 1.02, 2.5)], "black", 22, 4)
    body(a, 0.5, [(0.2, 0.06, 1.05, 1.15, 2.4), (0.45, 0.15, 0.98, 1.17, 2.6), (0.9, 0.17, 0.85, 1.05, 3)], "color_paint", 18, 4)
    rbox(a, 0.42, 0.4, 0.65, "dark", 0.5, 0.58, 2.0, 0.13)
    for i in range(6):
        a.torus((0.5, 0.62 + i * 0.055, 2.18), 0.2, 0.018, "steel", "y", n_(22), n_(6))
    for s in (-1, 1):
        a.tube((0.5 + s * 0.22, 0.52, 1.9), (0.5 + s * 0.26, 0.52, 1.9), 0.15, 0.13, "chrome", n_(18))
        bar(a, (0.5 + s * 0.15, r, 3.38), (0.5 + s * 0.12, 1.28, 2.85), 0.045, "chrome")
        bar(a, (0.5 + s * 0.15, 0.55, 1.65), (0.5 + s * 0.15, r, 0.62), 0.05, "dark")
        bar(a, (0.5 + s * 0.16, 1.0, 1.0), (0.5 + s * 0.16, 0.6, 0.75), 0.045, "chrome")
    bar(a, (0.5, 0.6, 1.55), (0.5, 1.02, 2.8), 0.06, "dark")
    bar(a, (0.76, 0.5, 2.3), (0.78, 0.36, 1.7), 0.055, "chrome")
    a.tube((0.78, 0.36, 1.7), (0.78, 0.46, 0.35), 0.075, 0.105, "chrome", n_(16))
    a.torus((0.5, r, 3.38), r + 0.07, 0.065, "color_paint", "x", n_(22), n_(8), 0.5, math.pi - 1.1)
    bar(a, (0.13, 1.45, 2.7), (0.87, 1.45, 2.7), 0.032, "chrome")
    for x in (0.15, 0.85):
        a.capsule((x - 0.04, 1.45, 2.7), (x + 0.04, 1.45, 2.7), 0.052, 0.052, "black", n_(10))
        a.ball(x, 1.5, 2.8, 0.06, 0.04, 0.025, "dark", n_(10), n_(6))
    bar(a, (0.5, 1.28, 2.85), (0.5, 1.45, 2.7), 0.035, "dark")
    a.ball(0.5, 1.25, 3.0, 0.17, 0.16, 0.13, "color_paint", n_(18), n_(12))
    a.ball(0.5, 1.25, 3.1, 0.12, 0.11, 0.055, "headlight", n_(16), n_(9))
    a.ball(0.5, 1.1, 0.18, 0.09, 0.05, 0.05, "redlight", n_(12), n_(7))


# ---------------------------------------------------------------- railway
def bogie(a, z, gauge=0.62, r=0.24):
    rbox(a, gauge * 2 - 0.05, 0.14, 1.0, "dark", 1, 0.38, z, 0.045)
    for dz in (-0.3, 0.3):
        bar(a, (1 - gauge, r, z + dz), (1 + gauge, r, z + dz), 0.045, "steel")
        for s in (-1, 1):
            x = 1 + s * gauge
            a.tube((x - 0.07, r, z + dz), (x + 0.07, r, z + dz), r, r, "steel", n_(24))
            a.torus((x - s * 0.065, r, z + dz), r - 0.005, 0.028, "dark", "x", n_(24), n_(8))
            a.ball(x + s * 0.09, r, z + dz, 0.045, 0.085, 0.085, "dark", n_(12), n_(7))
    for s in (-1, 1):
        rbox(a, 0.08, 0.15, 0.82, "black", 1 + s * (gauge + 0.13), 0.33, z, 0.03)
        bar(a, (1 + s * (gauge + 0.13), 0.42, z - 0.12), (1 + s * (gauge + 0.13), 0.42, z + 0.12), 0.05, "steel")


def couplers(a, L):
    for z, d in ((0.12, -1), (L - 0.12, 1)):
        bar(a, (1, 0.55, z), (1, 0.55, z + d * 0.1), 0.06, "dark")
        for s in (-1, 1):
            bar(a, (1 + s * 0.55, 0.55, z), (1 + s * 0.55, 0.55, z + d * 0.06), 0.04, "steel")
            a.tube((1 + s * 0.55, 0.55, z + d * 0.06), (1 + s * 0.55, 0.55, z + d * 0.1), 0.1, 0.1, "steel", n_(14))


def pantograph(a, z, y):
    for s in (-1, 1):
        bar(a, (1 + s * 0.28, y, z - 0.35), (1 + s * 0.05, y + 0.22, z + 0.15), 0.018, "dark", 6)
        bar(a, (1 + s * 0.05, y + 0.22, z + 0.15), (1 + s * 0.3, y + 0.42, z - 0.12), 0.018, "dark", 6)
    bar(a, (0.45, y + 0.43, z - 0.12), (1.55, y + 0.43, z - 0.12), 0.022, "steel", 6)


def loco(a, L=5.96, detail=True):
    body(a, 1, [(0.15, 0.66, 0.68, 1.72, 4), (0.32, 0.82, 0.56, 1.9, 5.5), (0.8, 0.86, 0.52, 1.98, 6.5), (L - 1.7, 0.86, 0.52, 1.98, 6.5), (L - 1.0, 0.85, 0.52, 1.94, 5.5), (L - 0.52, 0.78, 0.54, 1.55, 4), (L - 0.24, 0.6, 0.6, 1.18, 3), (L - 0.13, 0.32, 0.68, 0.95, 2.4)], "color_paint", 36, 5)
    body(a, 1, [(L - 1.28, 0.7, 1.32, 1.93, 5), (L - 0.98, 0.76, 1.24, 1.9, 5), (L - 0.58, 0.68, 1.14, 1.55, 4), (L - 0.44, 0.52, 1.14, 1.33, 3)], "glass", 30, 5)
    bar(a, (1, 1.35, L - 0.45), (1, 1.9, L - 0.96), 0.022, "color_paint")
    for s in (-1, 1):
        rbox(a, 0.03, 0.4, 0.55, "glass", 1 + s * 0.855, 1.55, L - 1.62, 0.012)
        for i in range(7):
            rbox(a, 0.025, 0.5, 0.2, "dark", 1 + s * 0.855, 1.42, 0.8 + i * 0.4, 0.008)
            for k in range(5):
                bar(a, (1 + s * 0.875, 1.24 + k * 0.09, 0.72 + i * 0.4), (1 + s * 0.875, 1.24 + k * 0.09, 0.88 + i * 0.4), 0.012, "steel", 5)
        rbox(a, 0.018, 0.12, L - 1.3, "white", 1 + s * 0.866, 0.9, L / 2 - 0.2, 0.005)
        bar(a, (1 + s * 0.88, 0.65, L - 1.35), (1 + s * 0.88, 1.5, L - 1.35), 0.018, "chrome", 6)
        a.ball(1 + s * 0.38, 0.88, L - 0.2, 0.12, 0.08, 0.06, "headlight", n_(14), n_(8))
        a.ball(1 + s * 0.45, 0.9, 0.16, 0.1, 0.07, 0.04, "redlight", n_(12), n_(7))
    a.ball(1, 1.93, L - 1.12, 0.1, 0.07, 0.07, "headlight", n_(12), n_(7))
    rbox(a, 1.72, 0.2, L - 0.7, "dark", 1, 0.5, L / 2, 0.07)
    rbox(a, 0.9, 0.3, 1.1, "black", 1, 0.3, L / 2, 0.1)
    for z in (1.12, L - 1.12):
        bogie(a, z)
    couplers(a, L)
    body(a, 1, [(L - 0.55, 0.72, 0.12, 0.42, 4), (L - 0.3, 0.55, 0.1, 0.36, 3), (L - 0.18, 0.3, 0.14, 0.3, 2.4)], "yellow", 20, 3)
    for z in (1.0, 1.8, 2.6):
        a.tube((1, 1.96, z), (1, 2.06, z), 0.3, 0.28, "steel", n_(22))
        a.tube((1, 2.06, z), (1, 2.08, z), 0.22, 0.22, "black", n_(22))
    if detail:
        pantograph(a, 3.4, 1.98)


def coach(a, L=5.96, metro=False):
    top = 1.9 if metro else 1.98
    paint = "white" if metro else "color_paint"
    body(a, 1, [(0.15, 0.78, 0.6, top - 0.14, 5), (0.28, 0.86, 0.5, top - 0.02, 7), (0.7, 0.87, 0.48, top, 7.5), (L - 0.7, 0.87, 0.48, top, 7.5), (L - 0.28, 0.86, 0.5, top - 0.02, 7), (L - 0.15, 0.78, 0.6, top - 0.14, 5)], paint, 36, 4)
    body(a, 1, [(0.35, 0.55, top - 0.1, top + 0.08, 3), (0.8, 0.68, top - 0.1, top + 0.16, 3), (L - 0.8, 0.68, top - 0.1, top + 0.16, 3), (L - 0.35, 0.55, top - 0.1, top + 0.08, 3)], "steel", 26, 3)
    side_windows(a, 0.872, 1.36, 0.52, 0.95, L - 0.95, 6 if metro else 8)
    for s in (-1, 1):
        for z in (0.62, L - 0.62):
            rbox(a, 0.03, 1.22, 0.5, "dark", 1 + s * 0.862, 1.12, z, 0.012)
            for dz in (-0.115, 0.115):
                rbox(a, 0.034, 0.55, 0.19, "glass", 1 + s * 0.866, 1.38, z + dz, 0.012)
            bar(a, (1 + s * 0.885, 0.75, z), (1 + s * 0.885, 1.65, z), 0.008, "chrome", 5)
        rbox(a, 0.018, 0.16 if metro else 0.07, L - 0.4, "color" if metro else "white", 1 + s * 0.874, 0.86, L / 2, 0.005)
        rbox(a, 0.018, 0.05, L - 0.4, "color" if metro else "white", 1 + s * 0.874, 1.76, L / 2, 0.004)
    for z, d in ((0.15, -1), (L - 0.15, 1)):
        if metro:
            rbox(a, 1.36, 0.68, 0.05, "glass", 1, 1.38, z + d * 0.005, 0.022)
            for s in (-1, 1):
                a.ball(1 + s * 0.5, 0.84, z + d * 0.02, 0.1, 0.06, 0.035, "headlight" if d > 0 else "redlight", n_(12), n_(7))
        else:
            rbox(a, 0.55, 1.15, 0.12, "black", 1, 1.15, z, 0.05)
            rbox(a, 0.3, 0.5, 0.13, "glass", 1, 1.38, z, 0.03)
    rbox(a, 1.74, 0.18, L - 0.5, "dark", 1, 0.46, L / 2, 0.06)
    rbox(a, 1.1, 0.26, 1.5, "black", 1, 0.3, L / 2, 0.08)
    for z in (1.15, L - 1.15):
        bogie(a, z)
    couplers(a, L)


def freight(a, L=5.96):
    rbox(a, 1.76, 0.2, L - 0.3, "dark", 1, 0.56, L / 2, 0.06)
    for s in (-1, 1):
        rbox(a, 0.12, 0.86, L - 0.42, "color_paint", 1 + s * 0.82, 1.08, L / 2, 0.035)
        for i in range(9):
            rbox(a, 0.06, 0.88, 0.09, "color_dark", 1 + s * 0.9, 1.08, 0.35 + i * (L - 0.7) / 8, 0.02)
        bar(a, (1 + s * 0.84, 1.53, 0.25), (1 + s * 0.84, 1.53, L - 0.25), 0.045, "steel")
    for z in (0.26, L - 0.26):
        rbox(a, 1.62, 0.86, 0.12, "color_paint", 1, 1.08, z, 0.035)
        bar(a, (0.17, 1.53, z), (1.83, 1.53, z), 0.045, "steel")
    for i in range(110):
        x, z = random.uniform(0.38, 1.62), random.uniform(0.55, L - 0.55)
        s_ = random.uniform(0.13, 0.26)
        a.ball(x, 1.18 + (0.34 - abs(x - 1) * 0.35) * random.uniform(0.3, 1), z, s_, s_ * 0.7, s_, "coal", 7, 5)
    for z in (1.15, L - 1.15):
        bogie(a, z)
    couplers(a, L)


def tram(a):
    L = 7.96
    body(a, 1, [(0.12, 0.45, 0.55, 1.4, 3), (0.35, 0.74, 0.4, 1.82, 4), (0.95, 0.87, 0.32, 1.97, 6.5), (L - 0.95, 0.87, 0.32, 1.97, 6.5), (L - 0.35, 0.74, 0.4, 1.82, 4), (L - 0.12, 0.45, 0.55, 1.4, 3)], "color_paint", 38, 5)
    for z, rows in ((0, [(0.22, 0.56, 1.02, 1.55, 3), (0.42, 0.74, 0.92, 1.86, 4), (0.98, 0.82, 0.95, 1.88, 5)]), (1, [(L - 0.98, 0.82, 0.95, 1.88, 5), (L - 0.42, 0.74, 0.92, 1.86, 4), (L - 0.22, 0.56, 1.02, 1.55, 3)])):
        body(a, 1, rows, "glass", 30, 5)
    side_windows(a, 0.872, 1.38, 0.66, 1.1, L - 1.1, 9)
    for s in (-1, 1):
        for z in (2.45, L - 2.45):
            rbox(a, 0.034, 1.36, 0.72, "dark", 1 + s * 0.866, 1.07, z, 0.014)
            for dz in (-0.17, 0.17):
                rbox(a, 0.036, 1.2, 0.28, "glass", 1 + s * 0.87, 1.09, z + dz, 0.014)
        rbox(a, 0.018, 0.2, L - 1.6, "white", 1 + s * 0.874, 0.74, L / 2, 0.006)
        for z, m in ((0.2, "redlight"), (L - 0.2, "headlight")):
            a.ball(1 + s * 0.35, 0.72, z, 0.12, 0.07, 0.07, m, n_(12), n_(7))
    rbox(a, 1.2, 0.13, 5.4, "white", 1, 2.0, L / 2, 0.055)
    pantograph(a, L / 2, 2.05 - 0.2)
    for z in (1.35, L / 2, L - 1.35):
        bogie(a, z, 0.62, 0.2)
    rbox(a, 1.6, 0.2, 5.8, "dark", 1, 0.36, L / 2, 0.07)


# ---------------------------------------------------------------- air
def airliner(a, L, span, cx=0.0, cy=0.0, cz=0.0, accent="tail", white="white", dark="black", glass="glass", metal="steel", fins=None):
    """Nose towards +z, centred on (cx, cy, cz); wheels reach cy - 0.107 L."""
    R = L * 0.062

    rows = [(cz + f * L, R * r, cy + yo * L - R * r, cy + yo * L + R * r, 2.0) for f, r, yo in ((-0.5, 0.06, 0.036), (-0.44, 0.3, 0.027), (-0.33, 0.7, 0.012), (-0.2, 0.96, 0.002), (-0.05, 1.0, 0.0), (0.22, 1.0, 0.0), (0.34, 0.93, -0.001), (0.42, 0.72, -0.006), (0.475, 0.4, -0.011), (0.497, 0.08, -0.014))]
    body(a, cx, rows, white, 32, 5)
    # cockpit glazing and cabin windows
    for s in (-1, 1):
        for dx, z, w in ((0.012, 0.418, 0.014), (0.033, 0.402, 0.015)):
            a.ball(cx + s * dx * L, cy + L * (0.034 if dx < 0.02 else 0.029), cz + z * L, w * L * 0.75, L * 0.009, L * 0.014, glass, n_(10), n_(7))
        for i in range(24):
            z = -0.23 + i * 0.0235
            a.ball(cx + s * R * 0.975, cy + R * 0.2, cz + z * L, L * 0.0024, L * 0.0066, L * 0.0048, glass, n_(8), n_(6))
        for z in (0.35, -0.27):
            a.ball(cx + s * R * 0.93, cy + R * 0.02, cz + z * L, L * 0.0025, L * 0.019, L * 0.008, metal, n_(10), n_(7))
        a.capsule((cx + s * R * 0.985, cy - R * 0.14, cz - 0.24 * L), (cx + s * R * 0.985, cy - R * 0.14, cz + 0.33 * L), L * 0.0036, L * 0.0036, accent, n_(8))
    for s in (-1, 1):
        # main wing with a raised tip
        foil(a, [(cx + s * R * 0.5, cz + 0.11 * L, 0.24 * L, 0.03 * L, cy - R * 0.45), (cx + s * span * 0.15, cz + 0.045 * L, 0.15 * L, 0.02 * L, cy - R * 0.3), (cx + s * span * 0.49, cz - 0.135 * L, 0.055 * L, 0.007 * L, cy + R * 0.45)], white if white else metal)
        foil(a, [(cy + R * 0.42, cz - 0.133 * L, 0.05 * L, 0.006 * L, cx + s * span * 0.488), (cy + R * 1.45, cz - 0.185 * L, 0.025 * L, 0.003 * L, cx + s * span * 0.505)], accent, vertical=True)
        for k, z in ((0.22, -0.05), (0.33, -0.095)):
            a.capsule((cx + s * span * k, cy - R * 0.4, cz + (z - 0.02) * L), (cx + s * span * k, cy - R * 0.55, cz + (z - 0.075) * L), L * 0.006, L * 0.002, metal, n_(8))
        # engine
        ex, ey = cx + s * span * 0.19, cy - R * 1.05
        er = R * 0.52
        lathe(a, (ex, ey, cz), [(-0.07 * L, er * 0.45), (-0.045 * L, er * 0.72), (0.0, er * 0.96), (0.055 * L, er), (0.078 * L, er * 0.93)], white, "z", 28, 4)
        a.torus((ex, ey, cz + 0.079 * L), er * 0.84, er * 0.1, metal, "z", n_(28), n_(10))
        a.tube((ex, ey, cz + 0.076 * L), (ex, ey, cz + 0.08 * L), er * 0.8, er * 0.8, dark, n_(24))
        for k in range(10):
            t = math.tau * k / 10
            a.capsule((ex, ey, cz + 0.082 * L), (ex + math.cos(t) * er * 0.72, ey + math.sin(t) * er * 0.72, cz + 0.0815 * L), L * 0.0022, L * 0.0035, metal, n_(6))
        a.tube((ex, ey, cz + 0.08 * L), (ex, ey, cz + 0.098 * L), er * 0.25, 0.001, metal, n_(16))
        a.tube((ex, ey, cz - 0.07 * L), (ex, ey, cz - 0.095 * L), er * 0.3, er * 0.08, dark, n_(16))
        foil(a, [(ey + er * 0.7, cz + 0.03 * L, 0.085 * L, 0.006 * L, ex), (cy - R * 0.42, cz + 0.015 * L, 0.095 * L, 0.006 * L, ex)], metal, vertical=True)
        # tailplane
        foil(a, [(cx + s * R * 0.25, cz - 0.355 * L, 0.11 * L, 0.012 * L, cy + 0.018 * L), (cx + s * span * 0.21, cz - 0.445 * L, 0.042 * L, 0.005 * L, cy + 0.038 * L)], white)
        # landing gear
        gx = cx + s * span * 0.09
        a.capsule((gx, cy - R * 0.7, cz - 0.045 * L), (gx, cy - 0.088 * L, cz - 0.045 * L), L * 0.005, L * 0.005, metal, n_(8))
        for dz in (-0.022, 0.022):
            a.tube((gx - 0.012 * L, cy - 0.088 * L, cz + (-0.045 + dz) * L), (gx + 0.012 * L, cy - 0.088 * L, cz + (-0.045 + dz) * L), L * 0.019, L * 0.019, dark, n_(18))
            a.ball(gx + s * 0.013 * L, cy - 0.088 * L, cz + (-0.045 + dz) * L, L * 0.003, L * 0.008, L * 0.008, metal, n_(10), n_(6))
    foil(a, [(cy + R * 0.55, cz - 0.3 * L, 0.18 * L, 0.014 * L, cx), (cy + R * 1.2, cz - 0.35 * L, 0.13 * L, 0.012 * L, cx), (cy + L * 0.235, cz - 0.45 * L, 0.058 * L, 0.006 * L, cx)], accent, vertical=True)
    a.capsule((cx, cy - R * 0.8, cz + 0.33 * L), (cx, cy - 0.09 * L, cz + 0.33 * L), L * 0.0045, L * 0.0045, metal, n_(8))
    for s in (-1, 1):
        a.tube((cx + s * 0.004 * L, cy - 0.091 * L, cz + 0.33 * L), (cx + s * 0.018 * L, cy - 0.091 * L, cz + 0.33 * L), L * 0.015, L * 0.015, dark, n_(16))
    a.ball(cx, cy + R * 1.0, cz - 0.08 * L, L * 0.006, L * 0.008, L * 0.014, "redlight", n_(8), n_(6))


def jet(a):
    cx = 3.0
    body(a, cx, [(0.55, 0.32, 0.98, 1.52, 2.2), (1.2, 0.52, 0.88, 1.6, 3), (3.2, 0.55, 0.86, 1.62, 3), (4.6, 0.44, 0.9, 1.6, 2.6), (6.0, 0.28, 0.98, 1.46, 2.2), (7.1, 0.13, 1.08, 1.32, 2), (7.72, 0.015, 1.19, 1.21, 2)], "color_paint", 32, 5)
    a.ball(cx, 1.55, 4.95, 0.3, 0.3, 0.82, "glass", n_(22), n_(14))
    a.torus((cx, 1.55, 4.35), 0.29, 0.025, "dark", "z", n_(22), n_(6), 0.0, math.pi)
    for s in (-1, 1):
        body(a, cx + s * 0.55, [(0.75, 0.2, 0.9, 1.3, 3), (2.5, 0.28, 0.86, 1.36, 4), (4.1, 0.24, 0.9, 1.34, 4), (4.55, 0.18, 0.94, 1.28, 3)], "color_paint", 24, 4)
        a.ball(cx + s * 0.55, 1.11, 4.53, 0.16, 0.16, 0.06, "black", n_(16), n_(8))
        a.torus((cx + s * 0.28, 1.2, 0.55), 0.22, 0.045, "dark", "z", n_(24), n_(8))
        a.tube((cx + s * 0.28, 1.2, 0.58), (cx + s * 0.28, 1.2, 0.3), 0.19, 0.05, "flame", n_(18))
        foil(a, [(cx + s * 0.6, 4.15, 2.9, 0.12, 1.1), (cx + s * 1.7, 2.9, 1.75, 0.07, 1.1), (cx + s * 2.9, 1.65, 0.65, 0.025, 1.12)], "color_paint")
        foil(a, [(cx + s * 0.5, 1.5, 1.05, 0.06, 1.2), (cx + s * 1.55, 0.7, 0.45, 0.02, 1.2)], "color_paint")
        foil(a, [(1.45, 2.05, 1.2, 0.05, cx + s * 0.42), (2.04, 1.15, 0.5, 0.02, cx + s * 0.62)], "color_dark", vertical=True)
        a.capsule((cx + s * 2.92, 1.12, 0.8), (cx + s * 2.92, 1.12, 1.95), 0.06, 0.06, "white", n_(10))
        a.tube((cx + s * 2.92, 1.12, 1.95), (cx + s * 2.92, 1.12, 2.2), 0.06, 0.004, "red", n_(10))
        a.capsule((cx + s * 1.6, 0.92, 2.0), (cx + s * 1.6, 0.92, 3.0), 0.1, 0.1, "white", n_(12))
        a.capsule((cx + s * 0.62, 1.0, 3.0), (cx + s * 0.75, 0.68, 3.0), 0.05, 0.05, "steel", n_(8))
        wheel(a, cx + s * 0.78, 3.0, 0.2, 0.14, s, 0.7, 5)
    a.capsule((cx, 1.0, 5.9), (cx, 0.72, 5.9), 0.045, 0.045, "steel", n_(8))
    wheel(a, cx, 5.9, 0.18, 0.12, 1, 0.68, 5)
    a.tube((cx, 1.2, 7.7), (cx, 1.2, 7.95), 0.012, 0.004, "steel", n_(8))


def heli(a):
    cx = 2.0
    body(a, cx, [(1.7, 0.28, 1.05, 1.75, 2.4), (2.2, 0.72, 0.72, 2.1, 2.8), (3.2, 0.9, 0.6, 2.2, 3), (4.2, 0.82, 0.62, 2.1, 2.6), (4.95, 0.55, 0.75, 1.75, 2.3), (5.38, 0.15, 1.0, 1.3, 2)], "color_paint", 34, 6, paint=lambda p: "glass" if p[2] > 3.65 and p[1] > 1.18 - (p[2] - 3.65) * 0.12 and abs(p[0] - cx) > 0.03 else "color_paint")
    for s in (-1, 1):
        rbox(a, 0.03, 0.6, 0.75, "glass", cx + s * 0.885, 1.6, 3.05, 0.012)
        for z in (2.6, 3.52):
            bar(a, (cx + s * 0.9, 0.85, z), (cx + s * 0.88, 1.92, z), 0.012, "dark", 6)
        bar(a, (cx + s * 0.92, 1.18, 3.3), (cx + s * 0.92, 1.18, 3.5), 0.022, "chrome", 6)
        bar(a, (cx + s * 0.95, 0.1, 2.0), (cx + s * 0.95, 0.1, 4.6), 0.065, "dark")
        bar(a, (cx + s * 0.95, 0.1, 4.6), (cx + s * 0.95, 0.36, 5.0), 0.06, "dark")
        for z in (2.45, 4.1):
            bar(a, (cx + s * 0.95, 0.12, z), (cx + s * 0.55, 0.8, z), 0.05, "steel")
        body(a, cx + s * 0.45, [(2.2, 0.16, 1.85, 2.22, 3), (2.7, 0.26, 1.9, 2.42, 3.5), (3.6, 0.18, 1.9, 2.25, 3)], "color_paint", 18, 4)
        a.ball(cx + s * 0.45, 2.15, 2.18, 0.1, 0.1, 0.06, "black", n_(12), n_(7))
    a.capsule((cx, 1.55, 2.0), (cx, 1.75, 0.35), 0.28, 0.09, "color_paint", n_(20))
    foil(a, [(1.7, 0.6, 0.45, 0.05, cx), (2.65, 0.28, 0.2, 0.02, cx)], "color_dark", vertical=True)
    foil(a, [(cx - 0.75, 1.0, 0.3, 0.03, 1.66), (cx + 0.75, 1.0, 0.3, 0.03, 1.66)], "color_dark")
    a.tube((cx + 0.1, 1.78, 0.3), (cx + 0.3, 1.78, 0.3), 0.09, 0.07, "steel", n_(14))
    for k in range(2):
        t = math.pi * k + 0.5
        a.capsule((cx + 0.3, 1.78, 0.3), (cx + 0.31, 1.78 + math.cos(t) * 0.52, 0.3 + math.sin(t) * 0.52), 0.055, 0.025, "dark", n_(8))
    a.tube((cx, 2.15, 3.1), (cx, 2.75, 3.1), 0.11, 0.08, "steel", n_(16))
    a.ball(cx, 2.8, 3.1, 0.2, 0.11, 0.2, "dark", n_(16), n_(9))
    for k in range(4):
        t = math.pi / 2 * k + math.pi / 4
        d = (math.cos(t), math.sin(t))
        p0 = (cx + d[0] * 0.2, 2.8, 3.1 + d[1] * 0.2)
        p1 = (cx + d[0] * 2.55, 2.84, 3.1 + d[1] * 2.55)
        side = (-d[1] * 0.13, 0.0, d[0] * 0.13)
        rows = []
        for p, w in ((p0, 0.6), (tuple((p0[i] + p1[i]) / 2 for i in range(3)), 1.0), (p1, 0.75)):
            rows.append([(p[0] + side[0] * w * math.cos(u), p[1] + 0.022 * math.sin(u), p[2] + side[2] * w * math.cos(u)) for u in [math.tau * i / 10 for i in range(10)]])
        a.loft(rows, "dark")
        a.ball(p1[0], p1[1], p1[2], 0.07, 0.03, 0.07, "yellow", n_(10), n_(6))
    a.ball(cx, 0.82, 5.0, 0.12, 0.08, 0.1, "headlight", n_(12), n_(7))


def balloon(a):
    seg = n_(48)
    lathe(a, (1.5, 0, 1.5), [(2.1, 0.32), (2.45, 0.55), (3.1, 1.02), (3.8, 1.34), (4.5, 1.4), (5.15, 1.22), (5.7, 0.8), (5.98, 0.35), (6.05, 0.02)], "color", "y", 48, 5, paint=lambda p: "sail" if int((math.atan2(p[2] - 1.5, p[0] - 1.5) + math.pi) / math.tau * 12) % 2 else "color")
    assert seg
    a.torus((1.5, 4.35, 1.5), 1.39, 0.035, "yellow", "y", n_(48), n_(8))
    a.torus((1.5, 2.12, 1.5), 0.33, 0.04, "dark", "y", n_(24), n_(8))
    for i in range(8):
        t = math.tau * i / 8
        bar(a, (1.5 + math.cos(t) * 0.44, 1.02, 1.5 + math.sin(t) * 0.44), (1.5 + math.cos(t) * 0.5, 2.35, 1.5 + math.sin(t) * 0.5), 0.012, "dark", 5)
    lathe(a, (1.5, 0, 1.5), [(0.22, 0.36), (0.3, 0.45), (0.65, 0.5), (1.0, 0.52)], "timber", "y", 28, 3)
    for y in (0.35, 0.5, 0.66, 0.82):
        a.torus((1.5, y, 1.5), 0.47 + (y - 0.35) * 0.09, 0.025, "timber", "y", n_(30), n_(6))
    a.torus((1.5, 1.02, 1.5), 0.52, 0.05, "black", "y", n_(30), n_(8))
    a.tube((1.5, 1.45, 1.5), (1.5, 1.62, 1.5), 0.13, 0.1, "steel", n_(14))
    lathe(a, (1.5, 1.6, 1.5), [(0.0, 0.06), (0.14, 0.13), (0.42, 0.02)], "flame", "y", 14, 4)
    for i in range(6):
        t = math.tau * i / 6
        a.ball(1.5 + math.cos(t) * 0.5, 0.6, 1.5 + math.sin(t) * 0.5, 0.09, 0.14, 0.09, "timber", 8, 6)


def rocket(a):
    lathe(a, (1, 0, 1), [(0.75, 0.34), (1.0, 0.5), (1.8, 0.58), (3.6, 0.58), (4.6, 0.52), (5.4, 0.36), (6.05, 0.15), (6.38, 0.015)], "white", "y", 40, 6, paint=lambda p: "color" if p[1] > 5.05 or 1.55 < p[1] < 2.0 else "white")
    for y, r in ((1.55, 0.575), (2.0, 0.585), (3.55, 0.58), (5.05, 0.445)):
        a.torus((1, y, 1), r, 0.02, "steel", "y", n_(40), n_(8))
    for y, r in ((3.9, 0.2), (3.0, 0.15)):
        a.torus((1, y, 1.575), r, 0.04, "steel", "z", n_(28), n_(10))
        a.ball(1, y, 1.56, r, r, 0.06, "glass", n_(18), n_(10))
    for i in range(4):
        t = math.pi / 2 * i + math.pi / 4
        d = (math.cos(t), math.sin(t))
        rows = []
        for reach, y0, y1, thick in ((0.48, 0.9, 2.2, 0.06), (0.85, 0.45, 1.45, 0.045), (1.3, 0.12, 0.72, 0.02)):
            side = (-d[1] * thick, d[0] * thick)
            c = (1 + d[0] * reach, 1 + d[1] * reach)
            rows.append([(c[0] + side[0], y0, c[1] + side[1]), (c[0] + side[0], y1, c[1] + side[1]), (c[0] - side[0], y1, c[1] - side[1]), (c[0] - side[0], y0, c[1] - side[1])])
        a.loft(rows, "red")
    lathe(a, (1, 0, 1), [(0.35, 0.38), (0.5, 0.32), (0.78, 0.2)], "steel", "y", 28, 4)
    lathe(a, (1, 0, 1), [(-0.08, 0.02), (0.1, 0.18), (0.38, 0.27)], "flame", "y", 20, 4)


# ---------------------------------------------------------------- boats
def hull(a, cx, rows, mat, paint=None, seg=30):
    """rows: (z, half width, keel height, deck height): a rounded bottom with a flat deck."""
    seg = n_(seg)
    rings = []
    for z, hw, keel, deck in spline(rows, 5):
        ring = []
        for i in range(seg + 1):
            t = math.pi * i / seg
            x, y = se(math.pi + t, 2.6)
            ring.append((cx + x * max(hw, 0.006), deck + y * max(deck - keel, 0.006), z))
        for i in range(1, 6):
            ring.append((cx + max(hw, 0.006) * (1 - i / 3), deck + 0.001, z))
        rings.append(ring)
    a.loft(rings, mat, True, paint)


def motorboat(a):
    rows = [(0.1, 0.62, 0.15, 0.62), (0.7, 0.85, 0.05, 0.62), (1.9, 0.88, 0.02, 0.64), (2.9, 0.68, 0.08, 0.68), (3.55, 0.36, 0.2, 0.72), (3.95, 0.02, 0.5, 0.75)]
    hull(a, 1, rows, "color_paint", paint=lambda p: "white" if p[1] < 0.28 else "color_paint")
    for s in (-1, 1):
        pts = [(1 + s * (r[1] - 0.04), r[3] + 0.04, r[0]) for r in spline(rows, 5)]
        for p, q in zip(pts, pts[1:]):
            bar(a, p, q, 0.032, "white", 8)
    rbox(a, 1.3, 0.06, 1.5, "timber", 1, 0.67, 1.1, 0.025)
    body(a, 1, [(2.2, 0.55, 0.64, 1.02, 3), (2.45, 0.5, 0.66, 0.95, 3), (2.75, 0.34, 0.66, 0.76, 2.4)], "glass", 22, 4)
    a.torus((1, 0.62, 2.2), 0.45, 0.025, "chrome", "z", n_(24), n_(6), 0.35, math.pi - 0.7)
    for x in (0.68, 1.32):
        rbox(a, 0.4, 0.14, 0.4, "white", x, 0.78, 1.55, 0.06)
        rbox(a, 0.4, 0.4, 0.12, "white", x, 0.95, 1.33, 0.05)
    body(a, 1, [(0.02, 0.14, 0.6, 0.95, 3), (0.16, 0.22, 0.6, 1.05, 3.5), (0.38, 0.17, 0.62, 0.96, 3)], "dark", 18, 4)
    bar(a, (1, 0.65, 0.1), (1, 0.15, 0.06), 0.05, "steel")
    for k in range(3):
        t = math.tau * k / 3
        a.capsule((1, 0.15, 0.05), (1 + math.cos(t) * 0.18, 0.15 + math.sin(t) * 0.18, 0.05), 0.06, 0.02, "chrome", n_(8))


def sailboat(a):
    rows = [(0.15, 0.55, 0.15, 0.62), (0.8, 0.82, 0.02, 0.6), (2.0, 0.84, 0.0, 0.6), (3.0, 0.58, 0.08, 0.66), (3.6, 0.28, 0.24, 0.72), (3.95, 0.02, 0.55, 0.76)]
    hull(a, 1, rows, "color_paint", paint=lambda p: "white" if 0.3 < p[1] < 0.42 else "color_paint")
    rbox(a, 1.05, 0.06, 2.3, "timber", 1, 0.64, 1.65, 0.025)
    rbox(a, 0.72, 0.24, 0.85, "white", 1, 0.76, 1.05, 0.1)
    for z in (0.85, 1.22):
        for x in (0.63, 1.37):
            a.torus((x, 0.77, z), 0.07, 0.018, "chrome", "x", n_(16), n_(6))
    bar(a, (1, 0.6, 2.2), (1, 3.4, 2.2), 0.045, "timber")
    bar(a, (1, 1.12, 2.2), (1, 1.12, 0.45), 0.032, "timber")

    def sail(p0, p1, p2, belly):
        rows_ = []
        steps = 12
        for i in range(steps + 1):
            f = i / steps
            left = tuple(p0[k] + (p2[k] - p0[k]) * f for k in range(3))
            right = tuple(p1[k] + (p2[k] - p1[k]) * f for k in range(3))
            line = [tuple(left[k] + (right[k] - left[k]) * j / steps for k in range(3)) for j in range(steps + 1)]
            rows_.append([(p[0] + belly * math.sin(math.pi * j / steps) * (1 - f * 0.8), p[1], p[2]) for j, p in enumerate(line)])
        for r0, r1 in zip(rows_, rows_[1:]):
            for j in range(steps):
                a.face([r0[j], r0[j + 1], r1[j + 1], r1[j]], "sail", smooth=False)

    sail((1, 1.17, 2.16), (1, 1.17, 0.5), (1, 3.3, 2.16), 0.28)
    sail((1, 0.85, 2.3), (1, 0.8, 3.8), (1, 3.05, 2.24), 0.2)
    bar(a, (1, 3.4, 2.2), (1, 0.74, 3.9), 0.008, "dark", 5)
    bar(a, (1, 3.4, 2.2), (1, 0.66, 0.2), 0.008, "dark", 5)
    a.face([(1, 3.4, 2.2), (1, 3.28, 2.2), (1, 3.34, 1.85)], "red")


def ship(a):
    rows = [(0.15, 1.35, 0.2, 1.1), (0.9, 1.8, 0.03, 1.08), (5.0, 1.85, 0.0, 1.08), (7.4, 1.65, 0.02, 1.12), (8.9, 1.0, 0.12, 1.22), (9.95, 0.03, 0.5, 1.35)]
    hull(a, 2, rows, "color_paint", paint=lambda p: "hullred" if p[1] < 0.42 else "color_paint", seg=40)
    for s in (-1, 1):
        pts = [(2 + s * (r[1] - 0.03), r[3] + 0.03, r[0]) for r in spline(rows, 5)]
        for p, q in zip(pts, pts[1:]):
            bar(a, p, q, 0.04, "white", 8)
            bar(a, (p[0], p[1] + 0.2, p[2]), (q[0], q[1] + 0.2, q[2]), 0.014, "steel", 5)
        for p in pts[::2]:
            bar(a, p, (p[0], p[1] + 0.2, p[2]), 0.012, "steel", 5)
        for i in range(13):
            z = 1.1 + i * 0.52
            a.torus((2 + s * 1.82, 0.76, z), 0.085, 0.02, "chrome", "x", n_(14), n_(6))
            a.ball(2 + s * 1.805, 0.76, z, 0.03, 0.075, 0.075, "glass", n_(12), n_(7))
    for y, w, z0, z1 in ((1.45, 2.8, 0.7, 3.4), (1.95, 2.3, 0.85, 3.1), (2.42, 1.7, 1.5, 2.95)):
        a.extrude(plan(w, z1 - z0, 0.35, 8), y - 0.28, y + 0.2, "white", 2, (z0 + z1) / 2)
        for s in (-1, 1):
            for i in range(int((z1 - z0 - 0.7) / 0.34) + 1):
                rbox(a, 0.03, 0.17, 0.24, "glass", 2 + s * (w / 2), y, z0 + 0.38 + i * 0.34, 0.012)
        rbox(a, w - 0.75, 0.2, 0.03, "glass", 2, y + 0.02, z1, 0.012)
    for z in (1.05, 1.8):
        a.tube((2, 2.55, z), (2, 2.88, z - 0.08), 0.24, 0.22, "red", n_(24))
        a.tube((2, 2.88, z - 0.08), (2, 2.95, z - 0.1), 0.23, 0.23, "black", n_(24))
    bar(a, (2, 2.6, 2.7), (2, 2.95, 2.7), 0.025, "steel")
    colours = ["blue", "green", "yellow", "orange", "red"]
    for i, z in enumerate((4.2, 5.2, 6.2, 7.2)):
        for j, x in enumerate((1.05, 2.0, 2.95)):
            if z > 7 and j != 1:
                continue
            for k in range(1 + (i + j) % 2):
                m = colours[(i * 2 + j + k * 3) % 5]
                rbox(a, 0.85, 0.42, 0.9, m, x, 1.34 + k * 0.45, z, 0.045)
                for n in range(7):
                    rbox(a, 0.87, 0.34, 0.025, m, x, 1.34 + k * 0.45, z - 0.33 + n * 0.11, 0.006)
    bar(a, (2, 1.25, 8.7), (2, 2.5, 8.7), 0.045, "white")


def canoe(a):
    rows = [(0.1, 0.02, 0.55, 0.9), (0.45, 0.22, 0.22, 0.72), (1.2, 0.4, 0.08, 0.62), (2.8, 0.4, 0.08, 0.62), (3.55, 0.22, 0.22, 0.72), (3.9, 0.02, 0.55, 0.9)]
    outer, inner = [], []
    seg = 24
    for z, hw, keel, deck in spline(rows, 6):
        for out, shrink, store in ((1.0, 0.0, outer), (0.82, 0.07, inner)):
            ring = []
            for i in range(seg + 1):
                x, y = se(math.pi + math.pi * i / seg, 2.3)
                ring.append((0.5 + x * max(hw * out, 0.004), deck + y * max(deck - keel - shrink, 0.004), z))
            store.append(ring)
    for rows_, mat, flip in ((outer, "color_paint", False), (inner, "timber", True)):
        for r0, r1 in zip(rows_, rows_[1:]):
            for j in range(seg):
                pts = [r0[j], r0[j + 1], r1[j + 1], r1[j]]
                mid = tuple(sum(p[k] for p in pts) / 4 for k in range(3))
                outward = (mid[0] - 0.5, mid[1] - 0.8, 0)
                if (dot(newell(pts), outward) < 0) != flip:
                    pts = pts[::-1]
                a.face(pts, mat)
    for side in (0, seg):
        for r0, r1 in zip(outer, outer[1:]):
            bar(a, r0[side], r1[side], 0.032, "timber", 8)
    for z, w in ((1.2, 0.74), (2.0, 0.76), (2.8, 0.74)):
        rbox(a, w, 0.05, 0.18, "timber", 0.5, 0.5, z, 0.02)
    bar(a, (0.25, 0.62, 1.0), (0.74, 0.72, 2.6), 0.025, "timber")
    for p, d in (((0.25, 0.62, 1.0), -1), ((0.74, 0.72, 2.6), 1)):
        a.ball(p[0] + d * 0.02, p[1], p[2] + d * 0.2, 0.09, 0.025, 0.24, "timber", n_(12), n_(7))


def submarine(a):
    lathe(a, (1, 1.05, 0), [(0.35, 0.1), (0.7, 0.32), (1.5, 0.66), (2.6, 0.78), (4.2, 0.78), (5.05, 0.65), (5.55, 0.4), (5.75, 0.08)], "color_paint", "z", 40, 6)
    for z, r in ((1.5, 0.665), (4.2, 0.785)):
        a.torus((1, 1.05, z), r, 0.018, "dark", "z", n_(40), n_(6))
    body(a, 1, [(2.4, 0.08, 1.7, 2.0, 2.2), (2.75, 0.3, 1.65, 2.18, 3), (3.5, 0.32, 1.65, 2.18, 3), (3.9, 0.14, 1.7, 2.0, 2.2)], "color_paint", 26, 5)
    bar(a, (1, 2.1, 3.3), (1, 2.36, 3.3), 0.035, "steel")
    bar(a, (1, 2.36, 3.3), (1, 2.36, 3.45), 0.035, "steel")
    bar(a, (1, 2.1, 2.95), (1, 2.3, 2.95), 0.02, "steel")
    for s in (-1, 1):
        for z in (2.3, 3.0, 3.7, 4.4):
            a.torus((1 + s * 0.775, 1.15, z), 0.14, 0.032, "chrome", "x", n_(24), n_(8))
            a.ball(1 + s * 0.76, 1.15, z, 0.04, 0.13, 0.13, "glass", n_(16), n_(9))
        foil(a, [(1 + s * 0.28, 1.35, 0.55, 0.05, 1.05), (1 + s * 1.05, 0.95, 0.28, 0.02, 1.05)], "dark")
        foil(a, [(1 + s * 0.3, 3.4, 0.3, 0.04, 1.95), (1 + s * 0.85, 3.25, 0.18, 0.015, 1.95)], "dark")
    for y0, y1 in ((1.3, 2.0), (0.8, 0.28)):
        foil(a, [(y0, 1.35, 0.55, 0.05, 1.0), (y1, 0.95, 0.28, 0.02, 1.0)], "dark", vertical=True)
    a.tube((1, 1.05, 0.36), (1, 1.05, 0.24), 0.1, 0.06, "steel", n_(16))
    for k in range(5):
        t = math.tau * k / 5
        a.capsule((1, 1.05, 0.27), (1 + math.cos(t) * 0.36, 1.05 + math.sin(t) * 0.36, 0.23), 0.04, 0.1, "yellow", n_(8))
    a.ball(1, 1.12, 5.66, 0.14, 0.14, 0.07, "headlight", n_(14), n_(8))
