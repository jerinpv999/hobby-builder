"""Builds the realistic City Builder models and exports them to public/models/city.glb.

Run:  blender --background --python blender/make_models.py

1 unit = 1 city tile.  Shared helpers are in lib.py.

Material names matter: the app tints, lights and re-colours materials by name.
  tint, tintbrick, tintmetal, tintglass : take the colour chosen for the building
  glasslit : windows that glow at night      leaf / pine / crop : follow the season
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *  # noqa: E402,F403
import creatures  # noqa: E402
import vehicles  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "models", "city.glb")

# ---------------------------------------------------------------- materials
material("tint", "#ffffff", 0.88, tex="plaster", uv=0.6)
material("tintbrick", "#ffffff", 0.92, tex="brick", uv=0.32)
material("tintmetal", "#ffffff", 0.45, 0.55, tex="corrugated", uv=0.6)
material("tintglass", "#ffffff", 0.08, 0.75)
material("carpaint", "#ffffff", 0.22, 0.45)
material("tail", "#ffffff", 0.35, 0.2)
material("glass", "#2b4257", 0.07, 0.7)
material("glasslit", "#34495c", 0.1, 0.6)
material("frame", "#e9e6df", 0.65)
material("darkframe", "#2f353d", 0.45, 0.5)
material("trim", "#d8d2c4", 0.8, tex="concrete", uv=0.5)
material("concrete", "#b9b7b0", 0.9, tex="concrete", uv=0.8)
material("roof", "#a4503a", 0.82, tex="rooftile", uv=0.3)
material("slate", "#59606b", 0.7, tex="rooftile", uv=0.3)
material("flatroof", "#75777a", 0.95, tex="gravel", uv=0.5)
material("wood", "#8a6138", 0.8, tex="bark", uv=0.25)
material("bark", "#8a6a4c", 0.95, tex="bark", uv=0.2)
material("metal", "#aab0b8", 0.35, 0.85)
material("steel", "#d9dde2", 0.4, 0.55, tex="corrugated", uv=0.5)
material("white", "#f1f2f3", 0.4, 0.1)
material("black", "#17181b", 0.6)
material("rubber", "#1c1c1e", 0.95)
material("red", "#c62a2a", 0.45)
material("blue", "#2563c0", 0.45)
material("yellow", "#f0c030", 0.45)
material("awning", "#b8342f", 0.75)
material("asphalt", "#4a4d53", 0.95, tex="asphalt", uv=1.0)
material("grass", "#6fae4a", 1.0, tex="grass", uv=1.0)
material("soil", "#8a6640", 1.0, tex="soil", uv=0.8)
material("gravel", "#a49c90", 1.0, tex="gravel", uv=0.6)
material("paving", "#cbbd9c", 0.95, tex="gravel", uv=0.5)
material("water", "#3f93c9", 0.05, 0.3)
material("pitch", "#3f9d40", 0.95, tex="grass", uv=0.4)
material("leaf", "#ffffff", 0.85, tex="leaves", cutout=True)
material("pine", "#ffffff", 0.9, tex="needles", cutout=True)
material("crop", "#ffffff", 0.9, tex="blades", cutout=True)
material("fruit", "#d22a2a", 0.35)
material("hide", "#f2eee6", 0.9, tex="plaster", uv=0.2)
material("greenglass", "#bfe3ee", 0.05, 0.5)
# swatches only: the app borrows these textures for its roads, ground and water
for key in ("asphalt", "grass", "gravel", "concrete", "soil", "water"):
    material("surface_" + key, "#ffffff", tex=key)


# ---------------------------------------------------------------- building parts
SIDES = {"f": (0, 1), "b": (0, -1), "r": (1, 0), "l": (-1, 0)}


def on_wall(a, side, half_w, half_d, u, y, out, w, h, t, mat, bevel=0.0):
    """A slab lying on one wall: u along the wall, y up, `out` proud of the surface."""
    dx, dz = SIDES[side]
    if dz:
        a.box(w, h, t, mat, u, y, dz * (half_d + out), bevel)
    else:
        a.box(t, h, w, mat, dx * (half_w + out), y, u, bevel)


def window(a, side, hw, hd, u, y, w, h, frame="frame", lit=0.35, sill=True, mullion=True):
    glass = "glasslit" if random.random() < lit else "glass"
    on_wall(a, side, hw, hd, u, y, 0.003, w, h, 0.006, glass)
    t = 0.011
    for dy in (-h / 2, h / 2):
        on_wall(a, side, hw, hd, u, y + dy, 0.007, w + t, t, 0.014, frame)
    for du in (-w / 2, w / 2):
        on_wall(a, side, hw, hd, u + du, y, 0.007, t, h, 0.014, frame)
    if mullion:
        on_wall(a, side, hw, hd, u, y, 0.007, t * 0.6, h, 0.008, frame)
    if sill:
        on_wall(a, side, hw, hd, u, y - h / 2 - 0.012, 0.014, w + 0.035, 0.012, 0.028, "trim")


def door(a, side, hw, hd, u, w, h, mat="wood"):
    on_wall(a, side, hw, hd, u, h / 2, 0.006, w + 0.03, h + 0.015, 0.012, "frame")
    on_wall(a, side, hw, hd, u, h / 2, 0.012, w, h, 0.01, mat)
    on_wall(a, side, hw, hd, u + w * 0.3, h * 0.46, 0.021, 0.012, 0.012, 0.012, "metal")


def spread(n, width):
    step = width / n
    return [-width / 2 + step * (i + 0.5) for i in range(n)]


def storey(name, w, d, fh, wall="tint", cols=(3, 3), win=(0.5, 0.55), frame="frame", lit=0.35, band=True, balcony=False, entrance=None, sill=True):
    """One floor of a building. cols = windows on (front/back, sides); win = size as part of the bay/floor."""
    a = asset(name)
    hw, hd = w / 2, d / 2
    a.box(w, fh, d, wall, 0, fh / 2, 0, 0.006)
    if band:
        a.box(w + 0.018, 0.018, d + 0.018, "trim", 0, fh - 0.009, 0, 0.004)
    for side in "fblr":
        n, width = (cols[0], w) if side in "fb" else (cols[1], d)
        ww, wh = width / n * win[0], fh * win[1]
        for i, u in enumerate(spread(n, width - 0.03)):
            if entrance and side == "f" and abs(u) < entrance[0] * 0.75:
                continue
            window(a, side, hw, hd, u, fh * 0.52, ww, wh, frame, lit, sill=sill and not balcony)
            if balcony and side in "fb" and i % 2 == 0:
                y = fh * 0.52 - wh / 2 - 0.012
                on_wall(a, side, hw, hd, u, y, 0.035, ww + 0.06, 0.014, 0.07, "concrete")
                on_wall(a, side, hw, hd, u, y + 0.075, 0.068, ww + 0.06, 0.008, 0.006, "darkframe")
                for k in range(6):
                    on_wall(a, side, hw, hd, u - (ww + 0.05) / 2 + (ww + 0.05) * k / 5, y + 0.04, 0.068, 0.005, 0.072, 0.005, "darkframe")
    if entrance:
        door(a, "f", hw, hd, 0, entrance[0], entrance[1], entrance[2])
    return a


def flat_roof(name, w, d, extra=True, wall="trim"):
    a = asset(name)
    a.box(w - 0.02, 0.012, d - 0.02, "flatroof", 0, 0.006, 0)
    for s in (-1, 1):
        a.box(w + 0.02, 0.05, 0.028, wall, 0, 0.025, s * (d / 2 - 0.006), 0.004)
        a.box(0.028, 0.05, d + 0.02, wall, s * (w / 2 - 0.006), 0.025, 0, 0.004)
    if extra:  # plant on the roof
        for _ in range(3):
            px, pz = random.uniform(-w * 0.28, w * 0.28), random.uniform(-d * 0.28, d * 0.1)
            a.box(0.09, 0.05, 0.07, "steel", px, 0.037, pz, 0.006)
            a.tube((px, 0.06, pz), (px, 0.072, pz), 0.024, 0.024, "darkframe", 8)
    return a


def modular(t, w, d, fh, roof_extra=True, floors=2, base=None, **kw):
    storey(t + "_base", w, d, fh, **{**kw, **(base or {})})
    for k in "ab"[:floors]:
        storey(f"{t}_floor_{k}", w, d, fh, **kw)
    return flat_roof(t + "_roof", w, d, roof_extra)


# house: brick, pitched tiled roof
for k, (nm, ent) in enumerate((("house_base", (0.11, 0.21, "wood")), ("house_floor_a", None))):
    a = storey(nm, 0.62, 0.58, 0.32, wall="tintbrick", cols=(2 if ent is None else 3, 2), win=(0.46, 0.5), lit=0.5, band=ent is None, entrance=ent)
    if ent:
        a.box(0.2, 0.014, 0.09, "slate", 0, 0.245, 0.33, 0.003)
        a.box(0.19, 0.02, 0.09, "concrete", 0, 0.01, 0.335, 0.003)
a = asset("house_roof")
a.prism(0.74, 0.27, 0.66, "roof", 0, 0, 0, along="x", gable="tintbrick")
a.box(0.76, 0.016, 0.022, "frame", 0, 0.008, 0.33)
a.box(0.76, 0.016, 0.022, "frame", 0, 0.008, -0.33)
a.box(0.08, 0.22, 0.08, "tintbrick", 0.2, 0.2, -0.1, 0.005)
a.box(0.095, 0.025, 0.095, "concrete", 0.2, 0.32, -0.1, 0.004)

# apartments with balconies
modular("apartment", 0.8, 0.8, 0.28, cols=(4, 4), win=(0.55, 0.6), balcony=True, base=dict(balcony=False, entrance=(0.14, 0.19, "darkframe")))

# shops
for nm in ("shop_base",):
    a = asset(nm)
    a.box(0.9, 0.3, 0.7, "tint", 0, 0.15, 0, 0.006)
    for u in (-0.29, 0, 0.29):
        window(a, "f", 0.45, 0.35, u, 0.115, 0.24, 0.19, "darkframe", 0.8, sill=False)
    for side in "lr":
        window(a, side, 0.45, 0.35, 0, 0.14, 0.22, 0.14, lit=0.4)
    for i in range(12):  # striped canopy
        a.box(0.077, 0.014, 0.15, "awning" if i % 2 else "white", -0.4235 + i * 0.077, 0.232, 0.41)
        a.box(0.077, 0.03, 0.008, "awning" if i % 2 else "white", -0.4235 + i * 0.077, 0.212, 0.485)
    a.box(0.5, 0.05, 0.012, "darkframe", 0, 0.272, 0.357, 0.003)
storey("shop_floor_a", 0.9, 0.7, 0.3, cols=(4, 2))
a = flat_roof("shop_roof", 0.9, 0.7)

# glass towers and offices
def curtain(name, w, d, fh, nx, nz, lit=0.3):
    a = asset(name)
    a.box(w - 0.03, fh, d - 0.03, "darkframe", 0, fh / 2, 0)
    for side in "fblr":
        n, width = (nx, w) if side in "fb" else (nz, d)
        bay = (width - 0.02) / n
        for u in spread(n, width - 0.02):
            on_wall(a, side, w / 2 - 0.015, d / 2 - 0.015, u, fh * 0.57, 0.004, bay - 0.008, fh * 0.8, 0.008, "glasslit" if random.random() < lit else "tintglass")
            on_wall(a, side, w / 2 - 0.015, d / 2 - 0.015, u, fh * 0.09, 0.006, bay - 0.008, fh * 0.15, 0.008, "tintmetal")
        for i in range(n + 1):
            on_wall(a, side, w / 2 - 0.015, d / 2 - 0.015, -(width - 0.02) / 2 + bay * i, fh / 2, 0.012, 0.009, fh, 0.016, "metal")
    for sx in (-1, 1):
        for sz in (-1, 1):
            a.box(0.026, fh, 0.026, "metal", sx * (w / 2 - 0.008), fh / 2, sz * (d / 2 - 0.008), 0.005)
    return a


a = curtain("tower_base", 0.74, 0.74, 0.3, 3, 3, 0.9)
a.box(0.82, 0.016, 0.82, "concrete", 0, 0.292, 0, 0.004)
a.box(0.28, 0.014, 0.13, "metal", 0, 0.2, 0.42, 0.003)
curtain("tower_floor_a", 0.7, 0.7, 0.3, 4, 4)
curtain("tower_floor_b", 0.7, 0.7, 0.3, 4, 4, 0.45)
flat_roof("tower_roof_low", 0.7, 0.7, True, "metal")
a = flat_roof("tower_roof_tall", 0.7, 0.7, False, "metal")
for i in range(3):  # stepped crown
    y0 = i * 0.3
    s = 0.5
    a.box(s - 0.03, 0.3, s - 0.03, "darkframe", 0, y0 + 0.15, 0)
    for side in "fblr":
        for u in spread(3, s - 0.02):
            on_wall(a, side, s / 2 - 0.015, s / 2 - 0.015, u, y0 + 0.16, 0.004, 0.148, 0.26, 0.008, "tintglass")
    a.box(s + 0.01, 0.014, s + 0.01, "metal", 0, y0 + 0.293, 0, 0.003)
for sx, sz in ((-0.14, -0.14), (0.14, 0.12)):
    a.box(0.1, 0.05, 0.1, "steel", sx, 0.925, sz, 0.006)
a.tube((0, 0.9, 0), (0, 1.4, 0), 0.016, 0.004, "metal", 8)
for y in (1.02, 1.14, 1.26):
    a.box(0.07, 0.006, 0.006, "metal", 0, y, 0)

a = curtain("office_base", 0.8, 0.6, 0.28, 5, 3, 0.8)
a.box(0.3, 0.014, 0.12, "concrete", 0, 0.2, 0.35, 0.003)
curtain("office_floor_a", 0.8, 0.6, 0.28, 5, 4)
curtain("office_floor_b", 0.8, 0.6, 0.28, 5, 4, 0.5)
a = flat_roof("office_roof", 0.8, 0.6, True, "metal")

# hotel
a = modular("hotel", 0.7, 0.7, 0.27, cols=(4, 4), win=(0.5, 0.62), balcony=True, base=dict(balcony=False, entrance=(0.16, 0.18, "glass")))
a.box(0.46, 0.09, 0.03, "yellow", 0, 0.1, 0.33, 0.006)
for sx in (-0.18, 0.18):
    a.tube((sx, 0, 0.33), (sx, 0.06, 0.33), 0.008, 0.008, "metal", 6)
h = ASSETS["hotel_base"]
h.box(0.36, 0.022, 0.18, "awning", 0, 0.215, 0.43, 0.006)
for sx in (-0.16, 0.16):
    h.tube((sx, 0, 0.5), (sx, 0.21, 0.5), 0.008, 0.008, "metal", 8)

# mall
a = modular("mall", 0.96, 0.8, 0.3, cols=(6, 4), win=(0.75, 0.55), frame="darkframe", lit=0.7, base=dict(entrance=(0.36, 0.22, "glass")))
a.box(0.55, 0.1, 0.035, "red", 0, 0.1, 0.37, 0.008)
for x in (-0.27, 0, 0.27):
    a.prism(0.18, 0.07, 0.36, "greenglass", x, 0.012, -0.12, along="z")
m = ASSETS["mall_base"]
m.box(0.5, 0.025, 0.16, "darkframe", 0, 0.25, 0.46, 0.005)

# hospital, school, fire station
a = modular("hospital", 0.82, 0.6, 0.3, cols=(5, 3), win=(0.6, 0.55), base=dict(entrance=(0.18, 0.2, "glass")))
a.tube((0, 0.012, 0), (0, 0.022, 0), 0.19, 0.19, "concrete", 24)
for w_, d_ in ((0.2, 0.055), (0.055, 0.2)):
    a.box(w_, 0.01, d_, "red", 0, 0.028, 0)
h = ASSETS["hospital_base"]
h.box(0.4, 0.025, 0.18, "white", 0, 0.235, 0.39, 0.006)
for w_, hh in ((0.09, 0.028), (0.028, 0.09)):
    h.box(w_, hh, 0.008, "red", 0.29, 0.2, 0.31)

for nm, ent in (("school_base", (0.14, 0.2, "wood")), ("school_floor_a", None)):
    a = storey(nm, 0.9, 0.5, 0.28, wall="tintbrick", cols=(6, 2), win=(0.62, 0.58), entrance=ent)
a = asset("school_roof")
a.prism(0.58, 0.18, 0.96, "slate", 0, 0, 0, along="x", gable="tintbrick")
a.box(0.16, 0.2, 0.16, "tintbrick", 0, 0.2, 0, 0.006)
a.tube((0, 0.22, 0.081), (0, 0.22, 0.09), 0.045, 0.045, "white", 20)
a.box(0.005, 0.034, 0.003, "black", 0, 0.235, 0.092)
a.prism(0.2, 0.12, 0.2, "slate", 0, 0.3, 0)

for nm, base in (("firestation_base", True), ("firestation_floor_a", False)):
    if base:
        a = asset(nm)
        a.box(0.8, 0.3, 0.6, "tintbrick", 0, 0.15, 0, 0.006)
        for u in (-0.2, 0.2):
            on_wall(a, "f", 0.4, 0.3, u, 0.115, 0.004, 0.3, 0.23, 0.008, "frame")
            for k in range(6):
                on_wall(a, "f", 0.4, 0.3, u, 0.025 + k * 0.036, 0.011, 0.27, 0.026, 0.008, "red")
        for side in "lrb":
            window(a, side, 0.4, 0.3, 0, 0.16, 0.14, 0.13)
        a.box(0.82, 0.03, 0.62, "red", 0, 0.285, 0, 0.004)
    else:
        storey(nm, 0.8, 0.6, 0.3, wall="tintbrick", cols=(4, 2))
a = flat_roof("firestation_roof", 0.8, 0.6, False)
a.box(0.18, 0.3, 0.18, "tintbrick", 0.27, 0.15, -0.17, 0.006)
for side in "fblr":
    dx, dz = SIDES[side]
    a.box(0.07 if dz else 0.008, 0.1, 0.008 if dz else 0.07, "glass", 0.27 + dx * 0.092, 0.19, -0.17 + dz * 0.092)
a.prism(0.22, 0.1, 0.22, "slate", 0.27, 0.3, -0.17)

# airport terminal
for nm in ("terminal_base", "terminal_floor_a"):
    a = curtain(nm, 0.96, 0.5, 0.28, 7, 3, 0.7)
a = asset("terminal_roof")
a.box(1.0, 0.03, 0.56, "white", 0, 0.015, 0, 0.012)
for i in range(7):
    a.box(0.1, 0.016, 0.44, "steel", -0.39 + i * 0.13, 0.038, 0, 0.006)

# factory
for nm, base in (("factory_base", True), ("factory_floor_a", False)):
    a = storey(nm, 0.9, 0.8, 0.3, wall="tintbrick", cols=(5, 4), win=(0.6, 0.45), frame="darkframe", lit=0.25, entrance=(0.2, 0.2, "darkframe") if base else None)
a = asset("factory_roof")
for i in range(3):  # saw-tooth roof
    z = -0.26 + i * 0.26
    a.prism(0.26, 0.12, 0.9, "slate", 0, 0, z, along="x", gable="tintbrick")
    a.box(0.84, 0.05, 0.006, "glass", 0, 0.055, z + 0.065)
for x in (-0.28, -0.1):
    a.tube((x, 0, -0.2), (x, 0.65, -0.2), 0.062, 0.045, "tintbrick", 14)
    for y in (0.5, 0.62):
        a.tube((x, y, -0.2), (x, y + 0.025, -0.2), 0.055, 0.053, "concrete", 14)

# ---------------------------------------------------------------- single buildings
a = asset("church")
a.box(0.46, 0.28, 0.7, "tint", 0, 0.14, -0.05, 0.006)
a.prism(0.56, 0.24, 0.76, "slate", 0, 0.28, -0.05, gable="tint")
for z in (-0.28, -0.1, 0.08):
    for side in "lr":
        window(a, side, 0.23, 0.35, z + 0.05 - 0.05, 0.15, 0.055, 0.15, "trim", 0.7)
    for sx in (-0.25, 0.25):
        a.box(0.04, 0.22, 0.045, "trim", sx, 0.11, z + 0.09, 0.006)
a.box(0.22, 0.52, 0.22, "tint", 0, 0.26, 0.34, 0.008)
door(a, "f", 0.11, 0.45, 0, 0.09, 0.17)
a.tube((0, 0.31, 0.449), (0, 0.31, 0.458), 0.042, 0.042, "glasslit", 16)
for side in (-1, 1):
    a.box(0.008, 0.09, 0.05, "black", side * 0.112, 0.42, 0.34)
a.box(0.25, 0.025, 0.25, "trim", 0, 0.52, 0.34, 0.005)
a.tube((0, 0.53, 0.34), (0, 0.86, 0.34), 0.15, 0.004, "slate", 4, smooth=False)
a.box(0.012, 0.1, 0.012, "yellow", 0, 0.9, 0.34)
a.box(0.055, 0.012, 0.012, "yellow", 0, 0.915, 0.34)

a = asset("stadium")
N_ = 32
for i in range(N_):
    t = math.tau * i / N_
    cx, cz = math.cos(t), math.sin(t)
    ry = -t + math.pi / 2
    for step, (r, y) in enumerate(((0.34, 0.03), (0.38, 0.065), (0.42, 0.1))):  # tiered seating
        a.box(math.tau * r / N_ * 1.04, 0.04, 0.045, ("blue", "white", "red")[step], cx * r, y, cz * r, ry=ry)
    a.box(math.tau * 0.46 / N_ * 1.04, 0.17, 0.035, "tint", cx * 0.46, 0.085, cz * 0.46, ry=ry)
    a.box(math.tau * 0.43 / N_ * 1.06, 0.012, 0.11, "white", cx * 0.43, 0.2, cz * 0.43, ry=ry)
    if i % 2 == 0:
        a.tube((cx * 0.475, 0, cz * 0.475), (cx * 0.475, 0.2, cz * 0.475), 0.008, 0.008, "metal", 6)
a.tube((0, 0, 0), (0, 0.016, 0), 0.325, 0.325, "pitch", 32)
for w_, d_, x, z in ((0.34, 0.006, 0, 0.12), (0.34, 0.006, 0, -0.12), (0.006, 0.24, 0.17, 0), (0.006, 0.24, -0.17, 0), (0.006, 0.24, 0, 0)):
    a.box(w_, 0.003, d_, "white", x, 0.018, z)
for sx in (-1, 1):
    for sz in (-1, 1):
        a.tube((sx * 0.37, 0, sz * 0.37), (sx * 0.37, 0.46, sz * 0.37), 0.012, 0.007, "metal", 8)
        a.box(0.08, 0.045, 0.02, "darkframe", sx * 0.36, 0.47, sz * 0.36, ry=math.atan2(sx, sz))

a = asset("warehouse")
a.box(0.96, 0.24, 0.72, "tintmetal", 0, 0.12, 0, 0.006)
a.prism(0.78, 0.1, 0.98, "steel", 0, 0.24, 0, along="x", gable="tintmetal")
for x in (-0.3, 0, 0.3):
    on_wall(a, "f", 0.48, 0.36, x, 0.09, 0.005, 0.2, 0.18, 0.01, "darkframe")
    for k in range(5):
        on_wall(a, "f", 0.48, 0.36, x, 0.02 + k * 0.033, 0.012, 0.18, 0.024, 0.006, "metal")
    a.box(0.24, 0.025, 0.06, "concrete", x, 0.012, 0.4, 0.004)
for u in spread(5, 0.9):
    window(a, "b", 0.48, 0.36, u, 0.17, 0.1, 0.05, "darkframe", sill=False)

a = asset("gasstation")
a.box(0.98, 0.02, 0.98, "asphalt", 0, 0.01, 0)
a.box(0.5, 0.18, 0.28, "tint", 0, 0.11, -0.32, 0.008)
a.box(0.54, 0.025, 0.32, "darkframe", 0, 0.212, -0.32, 0.005)
for u in (-0.14, 0.0):
    window(a, "f", 0.25, -0.18, u, 0.105, 0.11, 0.13, "darkframe", 0.9, sill=False)
a.box(0.76, 0.055, 0.42, "white", 0, 0.345, 0.18, 0.012)
a.box(0.775, 0.018, 0.435, "red", 0, 0.34, 0.18, 0.004)
for sx in (-0.33, 0.33):
    for sz in (0.01, 0.35):
        a.tube((sx, 0, sz), (sx, 0.33, sz), 0.016, 0.016, "metal", 10)
for x in (-0.17, 0.17):
    a.box(0.14, 0.018, 0.3, "concrete", x, 0.029, 0.18, 0.004)
    for z in (0.11, 0.25):
        a.box(0.055, 0.11, 0.04, "red", x, 0.09, z, 0.008)
        a.box(0.04, 0.03, 0.044, "black", x, 0.115, z)
a.tube((0.4, 0, -0.3), (0.4, 0.42, -0.3), 0.014, 0.014, "metal", 8)
a.box(0.13, 0.11, 0.035, "yellow", 0.4, 0.44, -0.3, 0.008)

a = asset("atc")
a.box(0.38, 0.2, 0.34, "concrete", 0, 0.1, 0, 0.01)
for u in spread(3, 0.34):
    window(a, "f", 0.19, 0.17, u, 0.11, 0.07, 0.09)
a.tube((0, 0.2, 0), (0, 0.9, 0), 0.085, 0.06, "white", 20)
for y in (0.4, 0.58, 0.74):
    a.box(0.025, 0.05, 0.16, "glass", 0, y, 0)
a.tube((0, 0.88, 0), (0, 0.92, 0), 0.14, 0.17, "concrete", 8, smooth=False)
a.tube((0, 0.92, 0), (0, 1.07, 0), 0.135, 0.175, "glasslit", 8, smooth=False)
for i in range(8):
    t = math.tau * i / 8
    a.tube((math.sin(t) * 0.137, 0.92, math.cos(t) * 0.137), (math.sin(t) * 0.177, 1.07, math.cos(t) * 0.177), 0.006, 0.006, "darkframe", 5)
a.tube((0, 1.07, 0), (0, 1.11, 0), 0.19, 0.17, "white", 8, smooth=False)
a.tube((0, 1.11, 0), (0, 1.42, 0), 0.008, 0.004, "metal", 6)
a.ball(0.07, 1.15, -0.05, 0.045, 0.045, 0.045, "white")

a = asset("hangar")
SEG = 18
arc = [(math.cos(math.pi * i / SEG) * 0.46, math.sin(math.pi * i / SEG) * 0.3) for i in range(SEG + 1)]
for i in range(SEG):
    (x0, y0), (x1, y1) = arc[i], arc[i + 1]
    a.solid([[(x0, y0, -0.46), (x1, y1, -0.46), (x1, y1, 0.46), (x0, y0, 0.46)]], "tintmetal", (0, 0, 0))
    for z in (-0.462, -0.155, 0.155, 0.462):
        a.tube((x0, y0, z), (x1, y1, z), 0.008, 0.008, "metal", 5, caps=False)
for z in (-0.455, 0.455):
    a.solid([[(x, y, z) for x, y in arc]], "tint", (0, 0.1, 0))
a.box(0.62, 0.19, 0.012, "darkframe", 0, 0.095, 0.462)
for i in range(6):
    a.box(0.094, 0.175, 0.008, "steel", -0.2575 + i * 0.103, 0.09, 0.47)

a = asset("barn")
a.box(0.7, 0.3, 0.58, "tintmetal", 0, 0.15, 0, 0.006)
gambrel = [(-0.38, 0.3), (-0.26, 0.47), (0, 0.55), (0.26, 0.47), (0.38, 0.3)]
for i in range(4):
    (x0, y0), (x1, y1) = gambrel[i], gambrel[i + 1]
    a.solid([[(x0, y0, -0.32), (x1, y1, -0.32), (x1, y1, 0.32), (x0, y0, 0.32)]], "slate", (0, 0.2, 0))
for z in (-0.29, 0.29):
    a.solid([[(x, y, z) for x, y in gambrel]], "tintmetal", (0, 0.35, 0))
on_wall(a, "f", 0.35, 0.29, 0, 0.12, 0.006, 0.28, 0.24, 0.012, "wood")
for u in (-0.07, 0.07):
    for ang in (-1, 1):
        a.tube((u - 0.06 * ang, 0.02, 0.304), (u + 0.06 * ang, 0.22, 0.304), 0.006, 0.006, "white", 4)
    on_wall(a, "f", 0.35, 0.29, u, 0.12, 0.014, 0.01, 0.24, 0.006, "white")
on_wall(a, "f", 0.35, 0.29, 0, 0.245, 0.014, 0.3, 0.012, 0.008, "white")
window(a, "f", 0.35, 0.29, 0, 0.37, 0.09, 0.08, "white")

a = asset("silo")
a.tube((0, 0, 0), (0, 0.78, 0), 0.22, 0.22, "steel", 24)
a.ball(0, 0.78, 0, 0.225, 0.17, 0.225, "metal", 24, 6, top_only=True)
for y in (0.03, 0.2, 0.39, 0.58, 0.77):
    a.tube((0, y, 0), (0, y + 0.016, 0), 0.228, 0.228, "metal", 24)
for x in (-0.035, 0.035):
    a.tube((x, 0, 0.235), (x, 0.82, 0.235), 0.005, 0.005, "darkframe", 5)
for k in range(16):
    a.box(0.07, 0.006, 0.006, "darkframe", 0, 0.05 + k * 0.05, 0.235)
a.tube((0, 0.93, 0), (0, 1.0, 0), 0.03, 0.03, "darkframe", 8)

a = asset("greenhouse")
a.box(0.9, 0.025, 0.7, "soil", 0, 0.0125, 0)
for z in (-0.2, 0, 0.2):
    for i in range(14):
        x = -0.39 + i * 0.06
        a.card((x, 0.065, z), (0.045, 0, 0), (0, 0.045, 0), "leaf")
        a.card((x, 0.065, z), (0, 0, 0.045), (0, 0.045, 0), "leaf")
arc = [(math.cos(math.pi * i / 12) * 0.34, math.sin(math.pi * i / 12) * 0.34) for i in range(13)]
for i in range(12):
    (z0, y0), (z1, y1) = arc[i], arc[i + 1]
    a.solid([[(-0.45, y0, z0), (-0.45, y1, z1), (0.45, y1, z1), (0.45, y0, z0)]], "greenglass", (0, 0, 0))
    for x in (-0.45, -0.225, 0, 0.225, 0.45):
        a.tube((x, y0, z0), (x, y1, z1), 0.007, 0.007, "white", 5, caps=False)
    if i % 3 == 0:
        a.tube((-0.45, y0, z0), (0.45, y0, z0), 0.005, 0.005, "white", 4)

a = asset("treatment")
a.box(0.98, 0.04, 0.98, "concrete", 0, 0.02, 0, 0.006)
for cx, cz in ((-0.23, 0.2), (0.25, 0.2)):
    for i in range(24):
        t = math.tau * i / 24
        a.box(0.06, 0.12, 0.022, "concrete", cx + math.cos(t) * 0.21, 0.1, cz + math.sin(t) * 0.21, 0.003, ry=-t + math.pi / 2)
        a.tube((cx + math.cos(t) * 0.21, 0.16, cz + math.sin(t) * 0.21), (cx + math.cos(t) * 0.21, 0.2, cz + math.sin(t) * 0.21), 0.003, 0.003, "metal", 4)
    a.tube((cx, 0.04, cz), (cx, 0.13, cz), 0.2, 0.2, "water", 24)
    a.box(0.44, 0.012, 0.035, "steel", cx, 0.175, cz, ry=0.5)
    a.tube((cx, 0.13, cz), (cx, 0.2, cz), 0.025, 0.025, "metal", 8)
a.box(0.5, 0.22, 0.26, "trim", -0.12, 0.15, -0.28, 0.008)
a.box(0.53, 0.03, 0.29, "slate", -0.12, 0.275, -0.28, 0.006)
for u in spread(3, 0.42):
    a.box(0.08, 0.08, 0.006, "glasslit", -0.12 + u, 0.16, -0.147)
a.tube((0.31, 0.04, -0.28), (0.31, 0.46, -0.28), 0.045, 0.035, "steel", 12)
for z in (-0.12, -0.06):
    a.tube((0.1, 0.07, z), (0.42, 0.07, z), 0.022, 0.022, "blue", 8)

a = asset("turbine_tower")
a.tube((0, 0, 0), (0, 0.03, 0), 0.1, 0.09, "concrete", 16)
a.tube((0, 0.02, 0), (0, 0.98, 0), 0.04, 0.018, "white", 20)
a.box(0.07, 0.065, 0.16, "white", 0, 1.0, 0.0, 0.025)
a = asset("turbine_blades")  # origin at the hub
a.ball(0, 0, 0.005, 0.028, 0.028, 0.045, "white")
for i in range(3):
    t = math.tau * i / 3
    ux, uy = -math.sin(t), math.cos(t)
    px, py = uy, -ux
    shape = [(0.025, 0.012), (0.1, 0.038), (0.25, 0.022), (0.43, 0.003)]
    for (l0, w0), (l1, w1) in zip(shape, shape[1:]):
        quad = [(ux * l0 + px * s * k, uy * l0 + py * s * k) for k, s in ((1, w0),) for _ in (0,)]
        pts = [(ux * l0 + px * w0 * 0.3, uy * l0 + py * w0 * 0.3), (ux * l0 - px * w0 * 0.7, uy * l0 - py * w0 * 0.7),
               (ux * l1 - px * w1 * 0.7, uy * l1 - py * w1 * 0.7), (ux * l1 + px * w1 * 0.3, uy * l1 + py * w1 * 0.3)]
        a.face([(x, y, 0.006) for x, y in pts], "white")
        a.face([(x, y, -0.006) for x, y in pts][::-1], "white")


# ---------------------------------------------------------------- plants and animals
a = asset("tree_broad")
trunk(a, 0, 0, 0.52, 0.036)
for tip in branches(a, 0, 0, 0.5, 0.036, 5, 0.14):
    leaf_cloud(a, tip[0], tip[1], tip[2], 0.12, 0.1, 16, 0.065)
leaf_cloud(a, 0, 0.55, 0, 0.2, 0.17, 55, 0.075)
a = asset("tree_bare")
trunk(a, 0, 0, 0.64, 0.036)
for tip in branches(a, 0, 0, 0.62, 0.036, 7, 0.17):
    for _ in range(3):
        n = rand_unit()
        a.tube(tip, (tip[0] + n[0] * 0.08, tip[1] + abs(n[1]) * 0.09, tip[2] + n[2] * 0.08), 0.004, 0.001, "bark", 4, caps=False)
a = asset("tree_pine")
trunk(a, 0, 0, 0.78, 0.03)
for i in range(8):
    y = 0.17 + i * 0.082
    r = 0.25 * (1 - i / 8.6)
    n = 11 - i // 2
    for k in range(n):
        t = math.tau * k / n + i * 0.4
        out = (math.cos(t), 0, math.sin(t))
        side = (-math.sin(t) * r * 0.55, 0, math.cos(t) * r * 0.55)
        a.card((out[0] * r * 0.5, y - r * 0.12, out[2] * r * 0.5), side, (out[0] * r * 0.58, -r * 0.24, out[2] * r * 0.58), "pine")
leaf_cloud(a, 0, 0.83, 0, 0.035, 0.07, 10, 0.04, "pine")

a = asset("orchard_tree")
trunk(a, 0, 0, 0.3, 0.024)
branches(a, 0, 0, 0.3, 0.024, 4, 0.07)
leaf_cloud(a, 0, 0.31, 0, 0.14, 0.12, 40, 0.055)
a = asset("orchard_fruit")
for _ in range(16):
    n = rand_unit()
    a.ball(n[0] * 0.14, 0.31 + n[1] * 0.11, n[2] * 0.14, 0.017, 0.018, 0.017, "fruit", 6, 4)
a = asset("orchard_bare")
trunk(a, 0, 0, 0.34, 0.024)
for tip in branches(a, 0, 0, 0.34, 0.024, 6, 0.1):
    for _ in range(2):
        n = rand_unit()
        a.tube(tip, (tip[0] + n[0] * 0.05, tip[1] + abs(n[1]) * 0.06, tip[2] + n[2] * 0.05), 0.003, 0.001, "bark", 4, caps=False)


a = asset("wheat_crop")
for i in range(5):
    for j in range(9):
        tuft(a, -0.36 + i * 0.18 + random.uniform(-0.012, 0.012), -0.4 + j * 0.1, 0.14, random.uniform(0.85, 1.1))
a = asset("paddy_crop")
for i in range(6):
    for j in range(6):
        tuft(a, -0.36 + i * 0.144, -0.36 + j * 0.144, 0.1, random.uniform(0.85, 1.1))
for k, nm in enumerate(("veg_leaves", "veg_produce")):
    a = asset(nm)
    for x in (-0.28, 0, 0.28):
        for z in (-0.3, -0.1, 0.1, 0.3):
            if k == 0:
                leaf_cloud(a, x, 0.07, z, 0.065, 0.04, 9, 0.035)
            else:
                for _ in range(3):
                    a.ball(x + random.uniform(-0.05, 0.05), 0.065, z + random.uniform(-0.05, 0.05), 0.022, 0.02, 0.022, "fruit", 7, 5)

a = asset("park")
a.box(0.98, 0.02, 0.98, "grass", 0, 0.01, 0)
a.box(0.9, 0.012, 0.13, "paving", 0, 0.022, 0)
a.box(0.13, 0.013, 0.9, "paving", 0, 0.022, 0)
a.tube((0, 0.02, 0), (0, 0.036, 0), 0.19, 0.19, "paving", 24)
for i in range(20):
    t = math.tau * i / 20
    a.box(0.05, 0.045, 0.024, "concrete", math.cos(t) * 0.14, 0.05, math.sin(t) * 0.14, 0.006, ry=-t + math.pi / 2)
a.tube((0, 0.036, 0), (0, 0.058, 0), 0.135, 0.135, "water", 24)
a.tube((0, 0.04, 0), (0, 0.13, 0), 0.022, 0.014, "concrete", 10)
a.tube((0, 0.125, 0), (0, 0.14, 0), 0.03, 0.055, "concrete", 14)
a.tube((0, 0.14, 0), (0, 0.19, 0), 0.007, 0.001, "water", 6)
for sx, sz, ry in ((-0.22, -0.11, 0), (0.22, 0.11, math.pi)):
    a.box(0.14, 0.008, 0.045, "wood", sx, 0.06, sz, ry=ry)
    a.box(0.14, 0.035, 0.007, "wood", sx, 0.085, sz - 0.022 * math.cos(ry), ry=ry)
    for o in (-0.055, 0.055):
        a.box(0.008, 0.045, 0.04, "darkframe", sx + o, 0.035, sz)
for sx, sz in ((0.11, -0.23), (-0.11, 0.23)):
    a.tube((sx, 0, sz), (sx, 0.19, sz), 0.006, 0.005, "darkframe", 6)
    a.ball(sx, 0.2, sz, 0.018, 0.018, 0.018, "glasslit", 8, 5)
a = asset("park_trees")
for sx in (-0.31, 0.31):
    for sz in (-0.31, 0.31):
        trunk(a, sx, sz, 0.3, 0.022)
        leaf_cloud(a, sx, 0.33, sz, 0.14, 0.12, 34, 0.055)
a = asset("park_bare")
for sx in (-0.31, 0.31):
    for sz in (-0.31, 0.31):
        trunk(a, sx, sz, 0.34, 0.022)
        branches(a, sx, sz, 0.34, 0.022, 6, 0.09)
a = asset("park_bushes")
for _ in range(14):
    sx = random.choice((-1, 1)) * random.uniform(0.12, 0.44)
    sz = random.choice((-1, 1)) * random.choice((0.12, 0.44))
    leaf_cloud(a, sx, 0.05, sz, 0.045, 0.035, 8, 0.028)

a = asset("pasture")
a.box(0.96, 0.02, 0.96, "grass", 0, 0.01, 0)
for o in (-0.46, 0.46):
    for y in (0.07, 0.115):
        a.box(0.93, 0.012, 0.009, "wood", 0, y, o)
        a.box(0.009, 0.012, 0.93, "wood", o, y, 0)
    for q in (-0.46, -0.23, 0.0, 0.23, 0.46):
        a.box(0.022, 0.15, 0.022, "wood", q, 0.075, o, 0.004)
        a.box(0.022, 0.15, 0.022, "wood", o, 0.075, q, 0.004)
a.box(0.18, 0.045, 0.07, "metal", 0.22, 0.043, -0.3, 0.008)
a.box(0.16, 0.006, 0.05, "water", 0.22, 0.067, -0.3)
for _ in range(24):
    tuft(a, random.uniform(-0.42, 0.42), random.uniform(-0.42, 0.42), 0.05, 0.05, 0.02)

# station buildings (the app draws the track beneath them)
a = asset("railstation")
for sx in (-0.36, 0.36):
    a.box(0.24, 0.07, 0.98, "concrete", sx, 0.035, 0, 0.006)
    a.box(0.015, 0.004, 0.98, "yellow", sx - math.copysign(0.1, sx), 0.073, 0)
a.box(0.2, 0.22, 0.62, "tintbrick", 0.38, 0.18, 0, 0.006)
for u in spread(4, 0.56):
    window(a, "l", -0.28, 0.31, u, 0.18, 0.08, 0.11, lit=0.7, sill=False)
a.prism(0.28, 0.1, 0.7, "slate", 0.38, 0.29, 0, gable="tintbrick")
a.box(0.28, 0.02, 0.7, "slate", -0.36, 0.33, 0, 0.006)
for z in (-0.3, 0, 0.3):
    a.tube((-0.4, 0.07, z), (-0.4, 0.32, z), 0.009, 0.009, "darkframe", 8)
    a.box(0.09, 0.01, 0.035, "wood", -0.35, 0.11, z + 0.1)
a = asset("metrostation")  # sits on the raised deck
for sx, sz in ((-0.38, -0.34), (0.38, -0.34), (-0.38, 0.34), (0.38, 0.34), (-0.38, 0), (0.38, 0)):
    a.tube((sx, 0.49, sz), (sx, 0.79, sz), 0.012, 0.012, "metal", 8)
for i in range(10):
    t0, t1 = math.pi * i / 10, math.pi * (i + 1) / 10
    p0 = (-math.cos(t0) * 0.45, 0.78 + math.sin(t0) * 0.13)
    p1 = (-math.cos(t1) * 0.45, 0.78 + math.sin(t1) * 0.13)
    a.solid([[(p0[0], p0[1], -0.42), (p1[0], p1[1], -0.42), (p1[0], p1[1], 0.42), (p0[0], p0[1], 0.42)]], "tintglass", (0, 0.5, 0))
    for z in (-0.42, 0, 0.42):
        a.tube((p0[0], p0[1], z), (p1[0], p1[1], z), 0.008, 0.008, "white", 5, caps=False)
for sx in (-0.39, 0.39):
    a.box(0.015, 0.06, 0.96, "glass", sx, 0.53, 0)
a.box(0.32, 0.055, 0.012, "blue", 0, 0.76, 0.43, 0.004)


# ---------------------------------------------------------------- vehicles, planes, birds and cows
material("v_steel", "#9aa3ad", 0.35, 0.65)
vehicles.mats()
vehicles.DETAIL["k"] = 0.5  # the city shows many at once, so they carry fewer segments
creatures.DETAIL["k"] = 0.45
# city material names for the workshop's materials ("v_" keeps winter snow off moving things)
NAMES = {n: "v_" + n for n in ("tyre", "rim", "chrome", "dark", "black", "white", "redlight", "amber", "headlight", "bluelight", "yellow", "steel", "coal", "flame", "red", "blue", "green", "orange", "hullred", "timber", "sail")}
NAMES.update({"color_paint": "carpaint", "color_dark": "carpaint", "color": "carpaint", "glass": "v_glass"})
for n, new_name in list(NAMES.items()):
    if new_name.startswith("v_") and new_name not in MATS:
        MATS[new_name] = MATS[n]
        bm = MATS[n][0].copy()
        bm.name = new_name
        MATS[new_name] = (bm, MATS[n][1])


def workshop(build, *args):
    """Run a shared builder (stud units) and return what it made."""
    part = Asset()
    saved = dict(ROUND)
    ROUND.update(min=0.07, max=0.12)
    build(part, *args)
    ROUND.update(saved)
    return part


def place(name, part, scale, centre_x, centre_z, rename=NAMES):
    asset(name).merge(part, scale, (-centre_x * scale, 0, -centre_z * scale), rename)


place("car", workshop(vehicles.car, "sedan"), 0.049, 1.0, 1.99)
place("car_suv", workshop(vehicles.car, "suv"), 0.049, 1.0, 1.99)
place("car_taxi", workshop(vehicles.car, "taxi"), 0.049, 1.0, 1.99)
place("car_van", workshop(vehicles.van, "van"), 0.047, 1.0, 2.48)
place("car_bus", workshop(vehicles.bus, "city"), 0.05, 1.0, 2.98)
place("car_truck", workshop(vehicles.truck, "box"), 0.047, 1.0, 3.48)
for name, part, length in (("loco", workshop(vehicles.loco, 5.96, False), 5.96), ("wagon", workshop(vehicles.coach), 5.96), ("metrocar", workshop(vehicles.coach, 5.96, True), 5.96)):
    asset(name).merge(part, 0.064, (-0.064, -0.002 if name == "metrocar" else 0.0, -length / 2 * 0.064), {**NAMES, "color_paint": "carpaint", "color": "v_blue"})

# the airliner is already in city units: nose +z, centred on the fuselage
vehicles.DETAIL["k"] = 0.7
vehicles.airliner(asset("airliner"), 0.8, 0.88, accent="tail", white="v_white", dark="v_black", glass="v_glass", metal="v_steel")

cow_part = workshop(creatures.cow)
asset("cow").merge(cow_part, 0.13, (-0.5 * 0.13, 0, -1.35 * 0.13), {"color": "flat_d22a2a"} )
flat("#d22a2a")

# traffic light and warning light poles; the app adds the glowing lamps on the +z face
a = asset("signal_pole")
a.tube((0, 0, 0), (0, 0.022, 0), 0.026, 0.022, "concrete", 14)
a.tube((0, 0.02, 0), (0, 0.3, 0), 0.008, 0.007, "darkframe", 10)
for y in (0.07, 0.11, 0.15):
    a.tube((0, y, 0), (0, y + 0.02, 0), 0.0095, 0.0095, "v_white", 10)
a.box(0.07, 0.175, 0.008, "v_yellow", 0, 0.36, -0.02, 0.003)
a.box(0.052, 0.155, 0.04, "v_black", 0, 0.36, 0, 0.012)
for i in range(3):
    y = 0.405 - i * 0.045
    a.torus((0, y, 0.021), 0.0195, 0.003, "darkframe", "z", 20, 6)
    a.torus((0, y, 0.032), 0.022, 0.0035, "v_black", "z", 16, 6, 0.25, math.pi - 0.5)

a = asset("warn_pole")
a.tube((0, 0, 0), (0, 0.022, 0), 0.026, 0.022, "concrete", 14)
a.tube((0, 0.02, 0), (0, 0.37, 0), 0.008, 0.007, "metal", 10)
a.box(0.07, 0.07, 0.035, "v_black", 0, 0.39, 0, 0.012)
a.torus((0, 0.39, 0.019), 0.029, 0.0035, "darkframe", "z", 22, 6)
a.torus((0, 0.39, 0.032), 0.032, 0.0045, "v_black", "z", 18, 6, 0.2, math.pi - 0.4)
tri = [(-0.062, 0.225), (0.062, 0.225), (0.0, 0.333)]
a.face([(x, y, 0.012) for x, y in tri], "v_red")
a.face([(x, y, 0.006) for x, y in tri][::-1], "metal")
a.face([(x * 0.68, 0.261 + (y - 0.261) * 0.68, 0.0135) for x, y in tri], "v_yellow")
a.box(0.009, 0.034, 0.003, "v_black", 0, 0.268, 0.015)
a.box(0.009, 0.009, 0.003, "v_black", 0, 0.242, 0.015)

# townspeople: a body and head, plus separate arms and legs so the app can swing them
# (built 1.7 units tall, then scaled to city size)
for name, colour, rough in (("p_shirt", "#ffffff", 0.85), ("p_pants", "#ffffff", 0.85), ("p_skin", "#ffffff", 0.6), ("p_hair", "#ffffff", 0.75), ("p_shoe", "#25201d", 0.5), ("p_eye", "#15100e", 0.2), ("p_white", "#f6f4f0", 0.3), ("p_lip", "#9a4a40", 0.5)):
    ensure(name, colour, rough)


def head(a, hair_long):
    a.tube((0, 1.37, 0), (0, 1.46, 0), 0.05, 0.048, "p_skin", 10)
    a.ball(0, 1.565, 0.0, 0.125, 0.14, 0.125, "p_skin", 20, 14)
    for s in (-1, 1):
        a.ball(s * 0.042, 1.58, 0.113, 0.021, 0.015, 0.012, "p_white", 8, 6)
        a.ball(s * 0.042, 1.58, 0.123, 0.01, 0.011, 0.006, "p_eye", 8, 5)
        a.capsule((s * 0.022, 1.612, 0.117), (s * 0.068, 1.61, 0.108), 0.006, 0.005, "p_hair", 6)
        a.ball(s * 0.126, 1.562, 0.0, 0.018, 0.032, 0.022, "p_skin", 8, 6)
    a.capsule((0, 1.575, 0.12), (0, 1.538, 0.137), 0.009, 0.015, "p_skin", 8)
    a.capsule((-0.03, 1.498, 0.113), (0.03, 1.498, 0.113), 0.007, 0.007, "p_lip", 8)
    a.ball(0, 1.615, -0.022, 0.136, 0.115, 0.132, "p_hair", 18, 12)
    if hair_long:
        a.ball(0, 1.5, -0.07, 0.135, 0.19, 0.085, "p_hair", 16, 12)
        for s in (-1, 1):
            a.capsule((s * 0.105, 1.6, -0.01), (s * 0.12, 1.42, -0.02), 0.04, 0.032, "p_hair", 10)
        a.ball(0.0, 1.668, 0.055, 0.1, 0.045, 0.075, "p_hair", 14, 8)
    else:
        a.ball(0.025, 1.675, 0.045, 0.095, 0.045, 0.08, "p_hair", 14, 8)


def torso(a, woman):
    part = Asset()
    if woman:
        lathe_rows = [(0.55, 0.235), (0.68, 0.2), (0.88, 0.13), (1.0, 0.125), (1.17, 0.165), (1.3, 0.16), (1.38, 0.09)]
    else:
        lathe_rows = [(0.8, 0.14), (0.9, 0.155), (1.05, 0.15), (1.2, 0.185), (1.31, 0.195), (1.39, 0.095)]
    vehicles.lathe(part, (0, 0, 0), lathe_rows, "p_shirt", "y", 20, 3)
    for pts, uv, mat, smooth, ns in part.faces:  # a body is flatter front to back
        a.face([(x, y, z * 0.68) for x, y, z in pts], mat, uv, smooth, [norm((n[0], n[1], n[2] / 0.68)) for n in ns] if ns else None)
    for s in (-1, 1):
        a.ball(s * 0.165, 1.285, 0, 0.07, 0.065, 0.065, "p_shirt", 12, 9)
    if not woman:
        a.ball(0, 0.82, 0, 0.145, 0.09, 0.1, "p_pants", 16, 10)
        a.tube((0, 0.875, 0), (0, 0.91, 0), 0.0, 0.0, "p_shoe", 6, caps=False)
        for y in (1.02, 1.12, 1.22):
            a.ball(0, y, 0.108 if y < 1.15 else 0.12, 0.011, 0.011, 0.007, "p_white", 8, 5)
    for s in (-1, 1):  # collar
        a.capsule((s * 0.012, 1.34, 0.085), (s * 0.075, 1.385, 0.05), 0.016, 0.011, "p_white", 8)
    head(a, woman)


vehicles.DETAIL["k"] = 0.8
for name, woman in (("person_man", False), ("person_woman", True)):
    part = Asset()
    torso(part, woman)
    asset(name).merge(part, 0.1)

part = Asset()  # a leg hanging from the hip at the origin
part.capsule((0, -0.02, 0), (0, -0.38, 0.008), 0.072, 0.052, "p_pants", 12)
part.capsule((0, -0.38, 0.008), (0, -0.72, 0), 0.052, 0.036, "p_pants", 12)
part.ball(0, -0.755, 0.035, 0.052, 0.042, 0.105, "p_shoe", 14, 9)
asset("person_leg").merge(part, 0.1)

part = Asset()  # an arm hanging from the shoulder at the origin
part.capsule((0, 0, 0), (0, -0.25, 0), 0.052, 0.038, "p_shirt", 12)
part.capsule((0, -0.25, 0), (0, -0.49, 0.015), 0.034, 0.025, "p_skin", 12)
part.ball(0, -0.54, 0.018, 0.028, 0.05, 0.034, "p_skin", 12, 9)
asset("person_arm").merge(part, 0.1)

a = asset("bird_body")
a.ball(0, 0, 0, 0.022, 0.02, 0.05, "v_dark", 12, 9)
a.ball(0, 0.01, 0.052, 0.015, 0.015, 0.018, "v_dark", 10, 7)
a.tube((0, 0.008, 0.065), (0, 0.004, 0.088), 0.006, 0.0005, "v_amber", 6)
for sx in (-1, 0, 1):
    a.face([(sx * 0.006, 0.002, -0.04), (sx * 0.02 + 0.008, 0, -0.095), (sx * 0.02 - 0.008, 0, -0.095)], "v_dark")
a = asset("bird_wing")  # spreads towards +x from the body; the app mirrors it for the other side
outline = [(0.008, 0.028), (0.06, 0.034), (0.12, 0.016), (0.17, -0.016), (0.15, -0.02), (0.16, -0.034), (0.125, -0.028), (0.13, -0.046), (0.09, -0.03), (0.06, -0.036), (0.008, -0.022)]
for lift in (0.004, -0.004):
    pts = [(x, lift * (1 - x / 0.2), z) for x, z in outline]
    a.face(pts if lift < 0 else pts[::-1], "v_dark")

# a swatch object keeps every surface texture in the exported file
s_ = asset("surfaces")
for i, key in enumerate(("asphalt", "grass", "gravel", "concrete", "soil", "water")):
    s_.card((i * 0.01, -1, 0), (0.002, 0, 0), (0, 0.002, 0), "surface_" + key)

# the water texture is a normal map, so attach it as one
wm = MATS["surface_water"][0].node_tree
img = next(n for n in wm.nodes if n.type == "TEX_IMAGE")
nm_ = wm.nodes.new("ShaderNodeNormalMap")
bsdf = wm.nodes["Principled BSDF"]
for link in list(img.outputs["Color"].links):
    wm.links.remove(link)
for link in list(bsdf.inputs["Base Color"].links):
    wm.links.remove(link)
wm.links.new(img.outputs["Color"], nm_.inputs["Color"])
wm.links.new(nm_.outputs["Normal"], bsdf.inputs["Normal"])

export(OUT, "MODELS")
