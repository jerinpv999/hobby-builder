"""Detailed Blender models that replace some Hobby Builder pieces: trees, plants, stones,
vehicles, trains, aircraft, boats and animals.

Run:  blender --background --python blender/make_hobby_models.py

1 unit = 1 stud.  Each model sits in its piece's footprint (x 0..w, z 0..d, y up), and the
asset name is the piece key, so footprints and heights match hobbyBuilderPieces.js.
Materials named color / color_dark / color_paint take the colour picked in the app.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403
import creatures  # noqa: E402
import vehicles  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "models", "hobby.glb")


def two_sided(name, *a, **kw):
    material(name, *a, **kw)
    MATS[name][0].use_backface_culling = False


def foliage_mat(colour, tex="leaves"):
    name = f"leaf_{tex}_{colour[1:]}"
    if name not in MATS:
        material(name, colour, 0.85, tex=tex, cutout=True)
    return name


ROUND.update(min=0.07, max=0.12)
material("bark", "#8a6446", 0.95, tex="bark", uv=0.9)
material("palmbark", "#a58560", 0.95, tex="bark", uv=0.6)
material("birchbark", "#ece8df", 0.85, tex="plaster", uv=0.8)
material("dead", "#7a6858", 0.95, tex="bark", uv=0.9)
material("rock", "#9a9da1", 0.95, tex="concrete", uv=1.2)
material("rock2", "#7d8084", 0.95, tex="gravel", uv=1.4)
material("soil", "#5d4330", 1.0, tex="soil", uv=1.0)
material("darkframe", "#2b2f35", 0.5, 0.2)
material("trim", "#f2f2f0", 0.4)
material("wood", "#a8743c", 0.8, tex="bark", uv=1.2)
material("terracotta", "#c0603a", 0.85, tex="concrete", uv=0.8)
material("stonerim", "#c9b98c", 0.9, tex="gravel", uv=0.8)
material("water", "#3c9bd6", 0.08, 0.2)
material("cactusskin", "#4a9a55", 0.75, tex="plaster", uv=0.6)
two_sided("frond", "#4aa83f", 0.7)
two_sided("pad", "#3f9a45", 0.6)


def add(p, q):
    return (p[0] + q[0], p[1] + q[1], p[2] + q[2])


def mul(p, k):
    return (p[0] * k, p[1] * k, p[2] * k)


def unit(v):
    l = math.sqrt(dot(v, v)) or 1
    return mul(v, 1 / l)


def lumpy(a, c, rx, ry, rz, mat, rough=0.22, seg=14, rings=9):
    """A rock: a ball with uneven radius, shaded flat."""
    jitter = [[1 + random.uniform(-rough, rough) for _ in range(seg)] for _ in range(rings + 1)]

    def P(i, j):
        th = math.pi * j / rings
        ph = math.tau * i / seg
        k = jitter[j][i % seg] if 0 < j < rings else 1
        y = c[1] + ry * math.cos(th) * k
        return (c[0] + rx * math.sin(th) * math.cos(ph) * k, max(y, 0.0), c[2] + rz * math.sin(th) * math.sin(ph) * k)

    for j in range(rings):
        for i in range(seg):
            q = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)]
            if j == 0:
                q = [q[0], q[2], q[3]]
            elif j == rings - 1:
                q = q[:3]
            a.solid([q], mat, c)


def cloud(a, c, rx, ry, n, size, mat):
    leaf_cloud(a, c[0], c[1], c[2], max(rx - size * 0.6, 0.05), max(ry - size * 0.6, 0.05), n, size, mat)


def blade(a, p, direction, length, width, mat):
    """A pointed leaf or petal from p along direction."""
    d = unit(direction)
    side = cross(d, (0, 1, 0) if abs(d[1]) < 0.95 else (1, 0, 0))
    side = mul(unit(side), width / 2)
    mid = add(p, mul(d, length * 0.55))
    tip = add(p, mul(d, length))
    a.face([p, add(mid, side), tip, sub(mid, side)], mat)


vehicles.mats()


# ---------------------------------------------------------------- trees
def broad(a, cx, cz, H, R, leaves, trunk_r=0.17, bark="bark", clumps=6, density=1.0, trunk_top=0.62):
    top = H * trunk_top
    a.tube((cx, 0, cz), (cx, top * 0.5, cz), trunk_r * 1.25, trunk_r, bark, 10)
    a.tube((cx, top * 0.5, cz), (cx, H - R * 0.7, cz), trunk_r, trunk_r * 0.35, bark, 9)
    for k in range(5):  # roots
        t = math.tau * k / 5 + 0.4
        a.tube((cx, trunk_r, cz), (cx + math.cos(t) * trunk_r * 2.4, 0, cz + math.sin(t) * trunk_r * 2.4), trunk_r * 0.5, 0.02, bark, 6)
    centre_y = H - R * 0.82
    for i in range(clumps):
        t = math.tau * i / clumps + random.uniform(-0.3, 0.3)
        r = R * 0.55
        tip = (cx + math.cos(t) * r, centre_y + random.uniform(-0.45, 0.2) * R, cz + math.sin(t) * r)
        a.tube((cx, top * random.uniform(0.6, 0.95), cz), tip, trunk_r * 0.42, trunk_r * 0.1, bark, 6)
        cloud(a, tip, R * 0.46, R * 0.4, int(34 * density), R * 0.19, leaves[i % len(leaves)])
    cloud(a, (cx, centre_y + R * 0.1, cz), R * 0.8, R * 0.72, int(120 * density), R * 0.21, leaves[0])


def conifer(a, cx, cz, H, R, mat, tiers, snow=False, trunk_r=0.14):
    a.tube((cx, 0, cz), (cx, H * 0.55, cz), trunk_r * 1.2, trunk_r * 0.8, "bark", 10)
    a.tube((cx, H * 0.55, cz), (cx, H * 0.94, cz), trunk_r * 0.8, 0.02, "bark", 8)
    white = foliage_mat("#f4f8fb", "needles")
    base = H * 0.16
    for i in range(tiers):
        y = base + (H * 0.94 - base) * i / tiers + H * 0.04
        r = R * (1 - i / (tiers + 0.7))
        n = max(7, int(13 - i * 0.6))
        for k in range(n):
            t = math.tau * k / n + i * 0.5
            ox, oz = math.cos(t), math.sin(t)
            side = (-oz * r * 0.5, 0, ox * r * 0.5)
            a.card((cx + ox * r * 0.5, y - r * 0.14, cz + oz * r * 0.5), side, (ox * r * 0.52, -r * 0.24, oz * r * 0.52), mat)
            if snow and k % 2 == 0:
                a.card((cx + ox * r * 0.5, y - r * 0.09, cz + oz * r * 0.5), mul(side, 0.65), (ox * r * 0.34, -r * 0.16, oz * r * 0.34), white)
        cloud(a, (cx, y, cz), r * 0.6, H / tiers * 0.7, 14, r * 0.28, mat)
    cloud(a, (cx, H * 0.92, cz), R * 0.17, H * 0.08, 18, R * 0.13, white if snow else mat)


for key, W, H, tiers, mat, extra in (("pine", 2, 3.4, 8, "#2f7a45", None), ("bigpine", 3, 6.1, 13, "#276b3f", None), ("snowpine", 2, 3.4, 8, "#2f6a48", "snow"), ("xmas", 2, 4.1, 10, "#2a7344", "xmas")):
    a = asset(key)
    R = W / 2 * 0.9
    conifer(a, W / 2, W / 2, H, R, foliage_mat(mat, "needles"), tiers, extra == "snow", 0.12 if W == 2 else 0.2)
    if extra == "xmas":
        for i in range(46):
            f = i / 46
            y = H * (0.2 + 0.68 * f)
            r = R * (1 - f * 0.9) * 0.86
            t = i * 2.4
            a.ball(W / 2 + math.cos(t) * r, y - 0.05, W / 2 + math.sin(t) * r, 0.075, 0.075, 0.075, flat(("#d01012", "#ffd23f", "#0055bf", "#ffffff")[i % 4], 0.18), 10, 7)
        for k in range(5):  # star
            t0 = math.tau * k / 5 + math.pi / 2
            for s in (-1, 1):
                t1 = t0 + s * math.pi / 5
                a.face([(1, H + 0.02, 1), (1 + math.cos(t0) * 0.28, H + 0.02 + math.sin(t0) * 0.28, 1), (1 + math.cos(t1) * 0.11, H + 0.02 + math.sin(t1) * 0.11, 1)], flat("#ffd23f", 0.25))

L = foliage_mat
a = asset("oak")
broad(a, 1, 1, 3.5, 1.08, [L("#3f9a3c"), L("#58ad45"), L("#2f8236")])
a = asset("maple")
broad(a, 1, 1, 3.45, 1.05, [L("#d9641e"), L("#c0392b"), L("#e8a33d")])
a = asset("cherry")
broad(a, 1.5, 1.5, 3.35, 1.34, [L("#f7b6cd"), L("#f29bb8"), L("#fbd7e4")], 0.2, density=1.25)
a = asset("mango")
broad(a, 1.5, 1.5, 3.35, 1.3, [L("#2b6b2f"), L("#357d36")], 0.24, density=1.35)
for _ in range(26):
    t, r = random.uniform(0, math.tau), random.uniform(0.7, 1.2)
    x, y, z = 1.5 + math.cos(t) * r, random.uniform(1.45, 2.3), 1.5 + math.sin(t) * r
    a.tube((x, y + 0.2, z), (x, y + 0.08, z), 0.008, 0.008, "bark", 4, caps=False)
    a.ball(x, y, z, 0.075, 0.11, 0.07, flat("#e8a33d", 0.4), 10, 7)
a = asset("appletree")
broad(a, 1, 1, 3.2, 1.04, [L("#3f9a3c"), L("#2f7d32")])
for _ in range(30):
    n = unit(rand_unit())
    a.ball(1 + n[0] * 0.92, 2.35 + n[1] * 0.75, 1 + n[2] * 0.82, 0.085, 0.082, 0.085, flat("#d01012", 0.3), 10, 7)

a = asset("banyan")
broad(a, 2, 2, 4.35, 1.75, [L("#2e7d32"), L("#46984a")], 0.42, clumps=9, density=1.5, trunk_top=0.55)
for i in range(11):  # hanging roots
    t, r = math.tau * i / 11, random.uniform(0.7, 1.45)
    x, z = 2 + math.cos(t) * r, 2 + math.sin(t) * r
    a.tube((x, 2.7, z), (x + random.uniform(-0.1, 0.1), 0 if i % 3 == 0 else random.uniform(0.9, 1.6), z), 0.07 if i % 3 == 0 else 0.018, 0.04 if i % 3 == 0 else 0.006, "bark", 7)

a = asset("birch")
a.tube((1, 0, 1), (1.04, 1.7, 1), 0.14, 0.1, "birchbark", 12)
a.tube((1.04, 1.7, 1), (1, 2.9, 1), 0.1, 0.03, "birchbark", 10)
for i in range(26):
    y, t = random.uniform(0.15, 2.2), random.uniform(0, math.tau)
    r = 0.14 - 0.025 * y
    a.box(0.09, random.uniform(0.015, 0.04), 0.012, "darkframe", 1.02 + math.cos(t) * r, y, 1 + math.sin(t) * r, ry=math.pi / 2 - t)
for i, (dx, y, dz, r) in enumerate(((0, 2.75, 0, 0.5), (-0.4, 2.25, 0.1, 0.45), (0.42, 2.35, -0.12, 0.45), (0.05, 2.1, -0.28, 0.4), (-0.05, 1.95, 0.28, 0.36))):
    a.tube((1.03, y - 0.5, 1), (1 + dx, y, 1 + dz), 0.04, 0.01, "birchbark", 6)
    cloud(a, (1 + dx, y, 1 + dz), r, r * 1.05, 55, 0.14, L(("#8cc25a", "#a5d36f", "#7db04b")[i % 3]))

a = asset("willow")
a.tube((1.5, 0, 1.5), (1.45, 1.2, 1.5), 0.26, 0.19, "bark", 12)
a.tube((1.45, 1.2, 1.5), (1.5, 2.6, 1.5), 0.19, 0.06, "bark", 10)
wm, wm2 = L("#8dbf6a"), L("#76aa55")
for i in range(8):
    t = math.tau * i / 8
    a.tube((1.47, 1.7, 1.5), (1.5 + math.cos(t) * 0.8, 2.85, 1.5 + math.sin(t) * 0.8), 0.07, 0.015, "bark", 6)
cloud(a, (1.5, 2.75, 1.5), 1.15, 0.7, 150, 0.24, wm)
for i in range(70):  # trailing strands
    t, r = random.uniform(0, math.tau), random.uniform(0.7, 1.22)
    x, z = 1.5 + math.cos(t) * r, 1.5 + math.sin(t) * r
    y, bottom = 2.75 - random.uniform(0, 0.35), random.uniform(0.55, 1.5)
    k = 0
    while y - k * 0.27 > bottom:
        a.card((x + math.cos(t) * 0.012 * k, y - k * 0.27, z + math.sin(t) * 0.012 * k), (-math.sin(t) * 0.11, 0, math.cos(t) * 0.11), (0, 0.19, 0), wm if i % 2 else wm2)
        k += 1


def frond(a, top, t, length, lift, droop, mat="frond"):
    prev = top
    for s in range(1, 11):
        f = s / 10
        p = (top[0] + math.cos(t) * length * f, top[1] + lift * math.sin(f * math.pi * 0.75) - droop * f * f, top[2] + math.sin(t) * length * f)
        a.tube(prev, p, 0.028 * (1.05 - f), 0.028 * (0.95 - f) + 0.002, mat, 5, caps=False)
        d = unit(sub(p, prev))
        for side in (-1, 1):
            out = (-math.sin(t) * side, -0.35, math.cos(t) * side)
            blade(a, p, add(mul(out, 1), mul(d, 0.7)), 0.46 * (1 - f * 0.55), 0.1, mat)
        prev = p


for key, W, H, lean, trunk_r in (("palm", 2, 3.75, 0.24, 0.13), ("coconut", 3, 4.9, 0.55, 0.15)):
    a = asset(key)
    cx = cz = W / 2
    x0 = cx - lean / 2
    pts = [(x0 + lean * (i / 14) ** 1.6, H * i / 14, cz) for i in range(15)]
    for i in range(14):
        r = trunk_r * (1.25 - 0.55 * i / 14)
        a.tube(pts[i], pts[i + 1], r * 1.1, r * 0.86, "palmbark", 11)
    top = pts[-1]
    reach = 0.82 if W == 2 else 1.2
    for i in range(11):
        t = math.tau * i / 11 + 0.2
        # keep the leaves inside the footprint
        room = min((W - top[0]) if math.cos(t) > 0 else top[0], (W - top[2]) if math.sin(t) > 0 else top[2])
        frond(a, top, t, min(reach + random.uniform(-0.1, 0.1), room + 0.05), 0.55 if i % 2 else 0.8, 0.75 if i % 2 else 0.45)
    if key == "coconut":
        for i in range(6):
            t = math.tau * i / 6
            a.ball(top[0] + math.cos(t) * 0.18, top[1] - 0.2, top[2] + math.sin(t) * 0.18, 0.14, 0.17, 0.14, flat("#6b7a2c" if i % 2 else "#7a5a26", 0.6), 10, 8)

a = asset("bamboo")
for i, (x, z, h) in enumerate(((0.55, 0.75, 4.0), (1.0, 1.2, 3.55), (1.45, 0.8, 3.75), (0.85, 0.95, 3.1), (1.35, 1.3, 2.7), (0.6, 1.3, 2.4))):
    m = flat("#86ad3c" if i % 2 else "#739a30", 0.45)
    seg = 0.45
    for k in range(int(h / seg)):
        a.tube((x, k * seg, z), (x, (k + 1) * seg - 0.012, z), 0.055, 0.05, m, 10)
        a.tube((x, (k + 1) * seg - 0.03, z), (x, (k + 1) * seg, z), 0.064, 0.064, m, 10)
        if k > 2:
            for j in range(5):
                t = random.uniform(0, math.tau)
                blade(a, (x, (k + 1) * seg - 0.02, z), (math.cos(t), random.uniform(-0.5, 0.35), math.sin(t)), random.uniform(0.28, 0.46), 0.075, "frond")

a = asset("baobab")
for y0, y1, r0, r1 in ((0, 0.5, 0.78, 0.66), (0.5, 1.5, 0.66, 0.72), (1.5, 2.4, 0.72, 0.42), (2.4, 2.8, 0.42, 0.3)):
    a.tube((1.5, y0, 1.5), (1.5, y1, 1.5), r0, r1, "bark", 18)
for i in range(7):
    t = math.tau * i / 7
    tip = (1.5 + math.cos(t) * 0.85, 3.65 + random.uniform(-0.15, 0.2), 1.5 + math.sin(t) * 0.85)
    a.tube((1.5 + math.cos(t) * 0.18, 2.6, 1.5 + math.sin(t) * 0.18), tip, 0.18, 0.04, "bark", 8)
    cloud(a, tip, 0.45, 0.38, 40, 0.15, L("#3c8a38"))
cloud(a, (1.5, 3.8, 1.5), 0.6, 0.45, 45, 0.16, L("#4b9a42"))

a = asset("cypress")
a.tube((0.5, 0, 0.5), (0.5, 1.2, 0.5), 0.09, 0.06, "bark", 9)
for i in range(11):
    y = 0.62 + i * 0.31
    r = 0.36 * math.sin(math.pi * (i + 1.4) / 13.4) + 0.05
    cloud(a, (0.5, y, 0.5), r + 0.06, 0.34, 50, 0.12, foliage_mat("#2a6a3e", "needles"))


def limb(a, p, d, length, r, depth, mat):
    q = add(p, mul(unit(d), length))
    a.tube(p, q, r, r * 0.6, mat, 7, caps=depth == 0)
    if depth:
        for _ in range(3 if depth > 1 else 2):
            n = rand_unit()
            nd = unit(add(unit(d), (n[0] * 0.95, abs(n[1]) * 0.35, n[2] * 0.95)))
            limb(a, add(p, mul(sub(q, p), random.uniform(0.6, 1.0))), nd, length * 0.68, r * 0.55, depth - 1, mat)


a = asset("deadtree")
a.tube((1, 0, 1), (1, 0.9, 1), 0.2, 0.15, "dead", 10)
for d in ((0.5, 1, 0.1), (-0.55, 0.9, -0.2), (0.05, 1, 0.45), (0, 1, -0.2)):
    limb(a, (1, 0.85, 1), d, 0.78, 0.11, 3, "dead")

a = asset("acacia")
a.tube((2, 0, 2), (1.88, 1.3, 2), 0.24, 0.17, "bark", 11)
for dx, dz, y in ((-1.05, 0.1, 2.75), (1.0, -0.4, 2.9), (0.4, 0.95, 2.65), (-0.4, -0.9, 2.7), (0.1, 0.05, 3.0)):
    tip = (2 + dx, y, 2 + dz)
    mid = (1.9 + dx * 0.35, 1.95, 2 + dz * 0.35)
    a.tube((1.88, 1.25, 2), mid, 0.13, 0.09, "bark", 8)
    a.tube(mid, tip, 0.09, 0.02, "bark", 7)
    cloud(a, tip, 0.88, 0.32, 85, 0.18, L("#7f9c3a"))
    cloud(a, (tip[0], tip[1] + 0.1, tip[2]), 0.6, 0.24, 35, 0.15, L("#93ac47"))


# ---------------------------------------------------------------- flowers
def bed(a, w, d, h=0.12, mat="soil"):
    a.box(w * 0.92, h, d * 0.92, mat, w / 2, h / 2, d / 2, 0.03)


def stem(a, x, z, y0, y1, leaves=3, r=0.018):
    top = (x + random.uniform(-0.04, 0.04), y1, z + random.uniform(-0.04, 0.04))
    a.tube((x, y0, z), top, r, r * 0.7, "pad", 6, caps=False)
    for i in range(leaves):
        t = random.uniform(0, math.tau)
        y = y0 + (y1 - y0) * random.uniform(0.05, 0.6)
        blade(a, (x, y, z), (math.cos(t), 0.55, math.sin(t)), random.uniform(0.13, 0.22), 0.085, "pad")
    return top


def bloom(a, c, r, mat, petals=6, cup=0.35, heart=None, layers=1):
    for k in range(layers):
        f = 1 - k * 0.28
        for i in range(petals):
            t = math.tau * (i + k * 0.5) / petals
            blade(a, c, (math.cos(t), cup + k * 0.8, math.sin(t)), r * f * math.sqrt(1 + (cup + k * 0.8) ** 2), r * f * 0.9, mat if k % 2 == 0 else ("color_dark" if mat == "color" else mat))
    if heart:
        a.ball(c[0], c[1] + r * 0.1, c[2], r * 0.28, r * 0.2, r * 0.28, flat(heart, 0.6), 8, 5)


SPOTS = [(0.25, 0.25), (0.72, 0.28), (0.5, 0.52), (0.26, 0.76), (0.75, 0.74), (0.5, 0.17), (0.82, 0.5), (0.17, 0.5)]

a = asset("rose")
a.tube((0.5, 0, 0.5), (0.5, 0.12, 0.5), 0.28, 0.24, "soil", 14)
for i in range(9):
    t = i * 2.4
    cloud(a, (0.5 + math.cos(t) * 0.2, 0.25 + (i % 3) * 0.13, 0.5 + math.sin(t) * 0.2), 0.2, 0.15, 12, 0.08, L("#2e7d32"))
for i in range(7):
    t, r = i * 2.4, 0.08 + 0.2 * (i % 3) / 2
    top = stem(a, 0.5 + math.cos(t) * r * 0.6, 0.5 + math.sin(t) * r * 0.6, 0.2, 0.55 + (i % 4) * 0.09, 1)
    bloom(a, top, 0.115, "color", 5, 0.45, layers=3)

a = asset("tulips")
bed(a, 1, 1)
for i, (x, z) in enumerate(SPOTS):
    top = stem(a, x, z, 0.1, 0.55 + (i % 3) * 0.1, 3)
    m = ("color", "color", flat("#ffd23f"))[i % 3]
    for k in range(6):
        t = math.tau * k / 6
        blade(a, top, (math.cos(t) * 0.42, 1, math.sin(t) * 0.42), 0.2, 0.12, m)
    a.ball(top[0], top[1] + 0.035, top[2], 0.05, 0.055, 0.05, m, 8, 6)

a = asset("lavender")
bed(a, 1, 1)
for i in range(34):
    x, z = random.uniform(0.14, 0.86), random.uniform(0.14, 0.86)
    top = stem(a, x, z, 0.1, random.uniform(0.5, 0.85), 2, 0.01)
    for k in range(9):
        a.ball(top[0] + random.uniform(-0.018, 0.018), top[1] - 0.2 + k * 0.026, top[2] + random.uniform(-0.018, 0.018), 0.026 - k * 0.0016, 0.024, 0.026 - k * 0.0016, "color", 6, 4)

a = asset("daisies")
bed(a, 1, 1, 0.1)
cloud(a, (0.5, 0.2, 0.5), 0.46, 0.14, 60, 0.09, L("#3f8f3f"))
for i in range(15):
    x, z = random.uniform(0.16, 0.84), random.uniform(0.16, 0.84)
    bloom(a, stem(a, x, z, 0.1, random.uniform(0.35, 0.6), 1, 0.012), 0.1, flat("#ffffff"), 12, 0.12, "#ffc81f")

a = asset("orchid")
a.tube((0.5, 0, 0.5), (0.5, 0.32, 0.5), 0.17, 0.22, "trim", 16)
a.tube((0.5, 0.3, 0.5), (0.5, 0.325, 0.5), 0.2, 0.2, "soil", 16)
for i in range(5):
    t = i * 1.26
    blade(a, (0.5, 0.32, 0.5), (math.cos(t), 0.35, math.sin(t)), 0.3, 0.14, "pad")
prev = (0.5, 0.32, 0.5)
for i, p in enumerate(((0.47, 0.55, 0.5), (0.46, 0.76, 0.51), (0.52, 0.9, 0.5), (0.62, 0.93, 0.48), (0.71, 0.86, 0.5))):
    a.tube(prev, p, 0.012, 0.01, "pad", 6, caps=False)
    if i:
        bloom(a, (p[0], p[1], p[2] + 0.03), 0.11, "color", 5, 0.25, "#ffd23f")
    prev = p

a = asset("hibiscus")
a.tube((0.5, 0, 0.5), (0.5, 0.35, 0.5), 0.05, 0.03, "bark", 7)
cloud(a, (0.5, 0.55, 0.5), 0.44, 0.42, 120, 0.12, L("#2e7d32"))
for p in ((0.2, 0.62, 0.62), (0.68, 0.86, 0.55), (0.45, 0.92, 0.3), (0.74, 0.52, 0.78), (0.42, 0.6, 0.9), (0.8, 0.62, 0.3)):
    bloom(a, p, 0.15, "color", 5, 0.3)
    a.tube(p, (p[0], p[1] + 0.13, p[2] + 0.03), 0.009, 0.007, flat("#f2cd37"), 6)
    a.ball(p[0], p[1] + 0.14, p[2] + 0.03, 0.022, 0.022, 0.022, flat("#ffd23f"), 6, 4)

a = asset("marigold")
bed(a, 1, 1)
for i in range(16):
    x, z = 0.17 + (i % 4) * 0.22 + random.uniform(-0.03, 0.03), 0.17 + (i // 4) * 0.22 + random.uniform(-0.03, 0.03)
    cloud(a, (x, 0.2, z), 0.12, 0.1, 6, 0.065, L("#2e7d32"))
    y = random.uniform(0.32, 0.43)
    a.tube((x, 0.1, z), (x, y, z), 0.012, 0.01, "pad", 5, caps=False)
    m = "color" if i % 2 else flat("#f28c28")
    for k in range(3):
        bloom(a, (x, y + k * 0.015, z), 0.095 - k * 0.022, m, 10, 0.15 + k * 0.35)

a = asset("lotus")
for i in range(26):
    t = math.tau * i / 26
    a.box(0.25, 0.16, 0.12, "stonerim", 1 + math.cos(t) * 0.92, 0.08, 1 + math.sin(t) * 0.92, 0.03, ry=-t + math.pi / 2)
a.tube((1, 0, 1), (1, 0.09, 1), 0.88, 0.88, "water", 36)
for x, z, r in ((0.55, 0.65, 0.24), (1.4, 0.75, 0.2), (0.75, 1.4, 0.22), (1.38, 1.35, 0.26), (1.0, 0.42, 0.14), (0.42, 1.08, 0.15)):
    start = random.uniform(0, math.tau)
    ring = [(x + math.cos(start + 0.3 + (math.tau - 0.6) * i / 16) * r, 0.098, z + math.sin(start + 0.3 + (math.tau - 0.6) * i / 16) * r) for i in range(17)]
    for p, q in zip(ring, ring[1:]):
        a.face([(x, 0.099, z), p, q], "pad")
for x, z, s in ((1.05, 0.98, 1.0), (0.55, 0.65, 0.6), (1.38, 1.35, 0.7)):
    c = (x, 0.13, z)
    bloom(a, c, 0.3 * s, "color", 11, 0.3)
    bloom(a, c, 0.23 * s, "color_dark", 9, 0.95)
    bloom(a, c, 0.15 * s, flat("#ffd6e2"), 7, 1.9)
    a.ball(x, 0.17, z, 0.06 * s, 0.05 * s, 0.06 * s, flat("#ffd23f"), 8, 5)

a = asset("bougainvillea")
for x in (0.1, 1.9):
    a.box(0.09, 3.2, 0.09, "wood", x, 1.6, 0.34, 0.012)
for y in (0.7, 1.45, 2.2, 2.95):
    a.box(1.9, 0.06, 0.05, "wood", 1.0, y, 0.34, 0.01)
for sx in (0.55, 1.45):
    a.tube((sx, 0, 0.45), (sx + 0.1, 1.6, 0.4), 0.06, 0.035, "bark", 7)
    a.tube((sx + 0.1, 1.6, 0.4), (sx - 0.05, 2.9, 0.42), 0.035, 0.012, "bark", 6)
for i in range(30):
    x, y = random.uniform(0.3, 1.7), 0.6 + 2.7 * (i / 30) ** 0.75
    cloud(a, (x, y, 0.5), 0.28, 0.24, 16, 0.11, L("#2e7d32"))
    if i % 4 != 0:
        for _ in range(11):
            c = (x + random.uniform(-0.22, 0.22), y + random.uniform(-0.18, 0.18), random.uniform(0.55, 0.7))
            bloom(a, c, 0.075, "color" if i % 3 else "color_dark", 3, 0.2)

a = asset("hangbasket")
a.tube((0.3, 0, 0.5), (0.3, 3.0, 0.5), 0.045, 0.035, "darkframe", 10)
a.tube((0.3, 0, 0.5), (0.3, 0.07, 0.5), 0.2, 0.17, "darkframe", 14)
a.tube((0.3, 2.95, 0.5), (0.68, 3.02, 0.5), 0.028, 0.022, "darkframe", 8)
a.tube((0.3, 2.65, 0.5), (0.55, 2.98, 0.5), 0.018, 0.018, "darkframe", 6)
for i in range(3):
    t = math.tau * i / 3
    a.tube((0.68, 3.02, 0.5), (0.68 + math.cos(t) * 0.2, 2.42, 0.5 + math.sin(t) * 0.2), 0.007, 0.007, "darkframe", 4)
a.tube((0.68, 2.18, 0.5), (0.68, 2.44, 0.5), 0.12, 0.23, "wood", 16)
cloud(a, (0.68, 2.5, 0.5), 0.29, 0.16, 50, 0.09, L("#2e7d32"))
for i in range(15):
    t, r = i * 2.4, 0.07 + 0.2 * (i % 4) / 3
    bloom(a, (0.68 + math.cos(t) * r, 2.62 - r * 0.45, 0.5 + math.sin(t) * r), 0.085, "color" if i % 3 else flat("#ffd23f"), 6, 0.35, "#ffd23f")
for i in range(8):
    t = math.tau * i / 8
    for k in range(4):
        a.card((0.68 + math.cos(t) * 0.25, 2.34 - k * 0.1, 0.5 + math.sin(t) * 0.25), (-math.sin(t) * 0.05, 0, math.cos(t) * 0.05), (0, 0.065, 0), L("#2e7d32"))

for key, mix_ in (("flowergarden", True), ("meadow", False)):
    a = asset(key)
    bed(a, 2, 2, 0.12, "soil")
    cols = ["color", flat("#ffd23f"), flat("#ffffff"), flat("#c86bfa"), flat("#f7b6cd"), flat("#f28c28")]
    if not mix_:
        a.box(1.9, 0.03, 1.9, flat("#4c9a45", 0.95), 1, 0.13, 1)
        for _ in range(150):
            tuft(a, random.uniform(0.15, 1.85), random.uniform(0.15, 1.85), 0.22, random.uniform(0.2, 0.45), 0.12, L("#57a845", "blades"))
    for i in range(46 if mix_ else 38):
        x, z = random.uniform(0.17, 1.83), random.uniform(0.17, 1.83)
        if mix_:
            x, z = 0.27 + (i % 7) * 0.243 + random.uniform(-0.05, 0.05), 0.27 + (i // 7) * 0.243 + random.uniform(-0.05, 0.05)
            cloud(a, (x, 0.22, z), 0.15, 0.1, 6, 0.075, L("#3e8e41"))
        top = stem(a, x, z, 0.1, random.uniform(0.38, 0.68), 1, 0.012)
        bloom(a, top, random.uniform(0.07, 0.11), cols[(i // 2 + i // 7) % len(cols)], 6 + i % 5, 0.3, "#ffd23f")

a = asset("planter")
a.box(1.9, 0.5, 0.74, "wood", 1.0, 0.25, 0.5, 0.025)
for y in (0.17, 0.34):
    for s in (-1, 1):
        a.box(1.92, 0.012, 0.012, "darkframe", 1.0, y, 0.5 + s * 0.372)
for x in (0.09, 1.91):
    a.box(0.1, 0.56, 0.78, "wood", x, 0.28, 0.5, 0.02)
a.box(1.76, 0.03, 0.62, "soil", 1.0, 0.51, 0.5)
for i in range(9):
    x = 0.24 + i * 0.19
    cloud(a, (x, 0.6, 0.5), 0.18, 0.14, 16, 0.085, L("#2e7d32"))
    for k in (-1, 1):
        bloom(a, (x + random.uniform(-0.05, 0.05), random.uniform(0.7, 0.82), 0.5 + k * random.uniform(0.06, 0.18)), 0.095, "color" if (i + (k > 0)) % 2 else flat("#ffd23f"), 6, 0.35, "#ffd23f")

# ---------------------------------------------------------------- plants and stones
a = asset("pot")
a.tube((0.5, 0, 0.5), (0.5, 0.55, 0.5), 0.26, 0.38, "terracotta", 22)
a.tube((0.5, 0.52, 0.5), (0.5, 0.66, 0.5), 0.43, 0.43, "terracotta", 22)
a.tube((0.5, 0.655, 0.5), (0.5, 0.675, 0.5), 0.37, 0.37, "soil", 22)
for i in range(30):
    t, y = i * 2.4, random.uniform(0.75, 1.35)
    r = random.uniform(0.04, 0.26)
    a.tube((0.5, 0.66, 0.5), (0.5 + math.cos(t) * r, y, 0.5 + math.sin(t) * r), 0.012, 0.007, "pad", 5, caps=False)
    for k in range(3):
        blade(a, (0.5 + math.cos(t) * r, y - k * 0.1, 0.5 + math.sin(t) * r), (math.cos(t + k), 0.4, math.sin(t + k)), 0.19, 0.11, "pad")
for p in ((0.5, 1.7, 0.5), (0.3, 1.45, 0.62), (0.72, 1.5, 0.38), (0.68, 1.35, 0.7), (0.3, 1.3, 0.33)):
    a.tube((0.5, 0.66, 0.5), p, 0.014, 0.01, "pad", 5, caps=False)
    bloom(a, p, 0.15, "color", 7, 0.35, "#ffd23f", 2)

a = asset("bush")
for x, y, z, r in ((0.33, 0.3, 0.55, 0.34), (0.7, 0.3, 0.45, 0.34), (0.52, 0.52, 0.5, 0.36)):
    lumpy(a, (x, y, z), r * 0.55, r * 0.55, r * 0.55, flat("#2c6a2d", 0.95))
    cloud(a, (x, y, z), r, r, 95, 0.1, L("#46983f" if y > 0.4 else "#357f34"))

a = asset("flowers")
bed(a, 1, 1, 0.14)
for i, (x, z) in enumerate(SPOTS):
    cloud(a, (x, 0.25, z), 0.17, 0.13, 12, 0.085, L("#2e7d32"))
    top = stem(a, x, z, 0.12, 0.45 + (i % 3) * 0.09, 1)
    bloom(a, top, 0.12, "color" if i % 2 == 0 else flat("#ffd23f"), 6, 0.4, "#f0a020", 2)

a = asset("sunflower")
a.tube((0.5, 0, 0.5), (0.5, 1.62, 0.48), 0.05, 0.035, "pad", 9)
for i in range(7):
    t = i * 2.4
    y = 0.28 + i * 0.18
    p = (0.5 + math.cos(t) * 0.1, y + 0.04, 0.5 + math.sin(t) * 0.1)
    a.tube((0.5, y, 0.5), p, 0.012, 0.01, "pad", 5, caps=False)
    blade(a, p, (math.cos(t), 0.12, math.sin(t)), 0.28, 0.22, "pad")
c = (0.5, 1.68, 0.52)
for ring_, (r0, r1, n, col, dz) in enumerate(((0.17, 0.33, 18, "#f2cd37", 0.035), (0.16, 0.28, 16, "#f5b81c", 0.055))):
    for i in range(n):
        t = math.tau * i / n + ring_ * 0.17
        base = (c[0] + math.cos(t) * r0 * 0.8, c[1] + math.sin(t) * r0 * 0.8, c[2] + dz)
        blade(a, base, (math.cos(t), math.sin(t), 0.12), r1 - r0 * 0.55, 0.085, flat(col))
a.tube((c[0], c[1], c[2] - 0.03), (c[0], c[1], c[2] + 0.07), 0.17, 0.16, flat("#5a3a1e", 0.95), 24)
for i in range(55):
    r, t = 0.145 * math.sqrt(i / 55), i * 2.39996
    a.ball(c[0] + math.cos(t) * r, c[1] + math.sin(t) * r, c[2] + 0.075, 0.014, 0.014, 0.012, flat("#3b2412" if i % 3 else "#8a5a22", 0.9), 6, 3)


def ribbed(a, pts, radii, mat, ribs=11):
    rings = []
    for p, r in zip(pts, radii):
        rings.append([(p[0] + math.cos(math.tau * i / (ribs * 2)) * r * (1 if i % 2 == 0 else 0.82), p[1], p[2] + math.sin(math.tau * i / (ribs * 2)) * r * (1 if i % 2 == 0 else 0.82)) for i in range(ribs * 2)])
    for A, B, p, q in zip(rings, rings[1:], pts, pts[1:]):
        mid = tuple((p[i] + q[i]) / 2 for i in range(3))
        for i in range(ribs * 2):
            j = (i + 1) % (ribs * 2)
            a.solid([[A[i], A[j], B[j], B[i]]], mat, mid)
        for i in range(0, ribs * 2, 2):  # spines
            a.tube(B[i], (B[i][0] + (B[i][0] - q[0]) * 0.22, B[i][1] + 0.012, B[i][2] + (B[i][2] - q[2]) * 0.22), 0.004, 0.0005, flat("#efe6c4"), 3, caps=False)


a = asset("cactus")
ys = [0, 0.15, 0.35, 0.55, 0.75, 0.95, 1.1, 1.22, 1.29, 1.32]
ribbed(a, [(0.5, y, 0.5) for y in ys], [0.17, 0.19, 0.19, 0.19, 0.19, 0.185, 0.17, 0.13, 0.07, 0.005], "cactusskin")
for s, y0 in ((-1, 0.55), (1, 0.72)):
    x1 = 0.5 + s * 0.3
    a.tube((0.5, y0, 0.5), (x1, y0 + 0.04, 0.5), 0.085, 0.09, "cactusskin", 12)
    ribbed(a, [(x1, y0 - 0.04 + d, 0.5) for d in (0, 0.07, 0.2, 0.33, 0.4, 0.43)], [0.05, 0.105, 0.105, 0.09, 0.05, 0.005], "cactusskin", 8)
bloom(a, (0.5, 1.33, 0.5), 0.14, "color", 10, 0.35, "#ffd23f", 2)

a = asset("grass")
green = L("#55a83f", "blades")
for i in range(26):
    t, r = i * 2.4, 0.34 * math.sqrt((i + 0.5) / 26)
    tuft(a, 0.52 + math.cos(t) * r, 0.48 + math.sin(t) * r * 0.9, random.uniform(0.22, 0.36), random.uniform(0.4, 0.78), 0.0, green)

a = asset("hedge")
a.box(0.72, 0.9, 1.72, flat("#26572a", 0.95), 0.5, 0.45, 1, 0.12)
hm, hm2 = L("#347a35"), L("#438c3c")
for _ in range(620):
    face = random.choice(("l", "r", "t", "t", "f", "b", "l", "r"))
    x, y, z = random.uniform(0.16, 0.84), random.uniform(0.1, 0.95), random.uniform(0.16, 1.84)
    if face in "lr":
        x = 0.14 if face == "l" else 0.86
    elif face == "t":
        y = random.uniform(0.9, 1.05)
    else:
        z = 0.14 if face == "f" else 1.86
    cloud(a, (x, y, z), 0.12, 0.12, 2, 0.095, hm if random.random() < 0.55 else hm2)

a = asset("stone")
lumpy(a, (0.45, 0.24, 0.52), 0.4, 0.33, 0.37, "rock")
lumpy(a, (0.8, 0.09, 0.24), 0.18, 0.13, 0.18, "rock2")
lumpy(a, (0.2, 0.05, 0.82), 0.12, 0.08, 0.11, "rock2")
a = asset("boulder")
lumpy(a, (0.95, 0.68, 0.98), 0.9, 0.76, 0.84, "rock", 0.16, 20, 13)
lumpy(a, (1.52, 0.33, 1.45), 0.46, 0.42, 0.45, "rock2", 0.2)
lumpy(a, (1.65, 0.12, 0.42), 0.24, 0.18, 0.22, "rock2", 0.25, 10, 7)
for _ in range(14):
    t = random.uniform(0, math.tau)
    tuft(a, 1 + math.cos(t) * 0.9, 1 + math.sin(t) * 0.86, 0.2, random.uniform(0.15, 0.3), 0.0, L("#5a9a3c", "blades"))


# ---------------------------------------------------------------- vehicles and animals
vehicles.mats()
ROAD = {"car": "sedan", "luxsedan": "lux", "sportsedan": "sport", "taxi": "taxi", "suv": "suv", "midsuv": "midsuv", "fullsuv": "fullsuv", "policecar": "police", "pickup": "pickup"}
for key, kind in ROAD.items():
    vehicles.car(asset(key), kind)
vehicles.racecar(asset("racecar"))
for key in ("van", "ambulance"):
    vehicles.van(asset(key), key)
for key, kind in (("bus", "city"), ("schoolbus", "school"), ("doubledecker", "double")):
    vehicles.bus(asset(key), kind)
for key, kind in (("truck", "box"), ("firetruck", "fire"), ("dumptruck", "dump"), ("cement", "cement"), ("crane", "crane")):
    vehicles.truck(asset(key), kind)
for key in ("rickshaw", "tractor", "excavator", "bulldozer", "bicycle", "kick", "scooter", "motorbike", "loco", "coach", "tram", "jet", "heli", "balloon", "rocket", "motorboat", "sailboat", "ship", "canoe", "submarine"):
    getattr(vehicles, key)(asset(key))
vehicles.freight(asset("wagon"))
vehicles.airliner(asset("airplane"), 9.75, 7.9, 4.0, 1.06, 5.05, accent="color_paint", dark="black", glass="glass", metal="steel")

for key, build in creatures.ANIMALS.items():
    random.seed(sum(map(ord, key)))
    build(asset(key))

export(OUT, "HOBBY")
