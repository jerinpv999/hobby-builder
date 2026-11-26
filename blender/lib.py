"""Shared by the model scripts: procedural textures, materials and a small mesh builder.

Geometry is written in the web app's coordinates (x right, y up, z front) and converted to
Blender's z-up space when the mesh is created.
"""
import math
import os
import random

import bpy
import mathutils
import mathutils.noise
import numpy as np

# boxes at least this thick get rounded edges (each script sets it to suit its units)
ROUND = {"min": 0.03, "max": 0.03}

bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(7)
rng = np.random.default_rng(7)

# ---------------------------------------------------------------- textures
S = 256


def noise(scale, octaves=3):
    """Tileable value noise in 0..1."""
    out = np.zeros((S, S))
    amp, total = 1.0, 0.0
    for o in range(octaves):
        n = scale * 2 ** o
        g = rng.random((n, n))
        t = np.arange(S) * n / S
        i = t.astype(int)
        f = t - i
        f = f * f * (3 - 2 * f)
        j = (i + 1) % n
        a = g[np.ix_(i, i)] * (1 - f)[None, :] + g[np.ix_(i, j)] * f[None, :]
        b = g[np.ix_(j, i)] * (1 - f)[None, :] + g[np.ix_(j, j)] * f[None, :]
        out += amp * (a * (1 - f)[:, None] + b * f[:, None])
        total += amp
        amp *= 0.55
    return out / total


def image(name, rgb, alpha=None):
    img = bpy.data.images.new(name, S, S, alpha=True)
    px = np.ones((S, S, 4), dtype=np.float32)
    if rgb.ndim == 2:
        rgb = np.repeat(rgb[:, :, None], 3, axis=2)
    px[:, :, :3] = np.clip(rgb, 0, 1)
    if alpha is not None:
        px[:, :, 3] = alpha
    img.pixels.foreach_set(px.ravel())
    img.pack()
    return img


yy, xx = np.mgrid[0:S, 0:S]


def tex_plaster():
    return image("plaster", 0.9 + (noise(8, 4) - 0.5) * 0.22)


def tex_brick():
    rows, cols = 12, 6
    h, w = S / rows, S / cols
    r = (yy // h).astype(int)
    shifted = (xx + (r % 2) * w / 2) % S
    c = (shifted // w).astype(int)
    tone = rng.uniform(0.72, 1.0, (rows + 1, cols + 1))[r, c]
    v = tone + (noise(32) - 0.5) * 0.18
    mortar = ((yy % h) < 3) | ((shifted % w) < 3)
    v[mortar] = 0.97
    return image("brick", v)


def tex_rooftile():
    rows, cols = 10, 12
    h, w = S / rows, S / cols
    r = (yy // h).astype(int)
    shifted = (xx + (r % 2) * w / 2) % S
    c = (shifted // w).astype(int)
    fy = (yy % h) / h
    fx = (shifted % w) / w
    v = rng.uniform(0.75, 1.0, (rows + 1, cols + 1))[r, c] * (0.62 + 0.38 * fy) * (0.82 + 0.18 * np.sin(fx * math.pi))
    return image("rooftile", v + (noise(32) - 0.5) * 0.12)


def tex_corrugated():
    v = 0.82 + 0.18 * np.sin(xx / S * math.pi * 2 * 24) + (noise(16) - 0.5) * 0.14
    return image("corrugated", v)


def tex_bark():
    v = 0.62 + (noise(4, 2) - 0.5) * 0.3 + 0.28 * np.sin(xx / S * math.pi * 2 * 14 + noise(8) * 9)
    return image("bark", v)


def tex_grain(name, base, spread, scale):
    return image(name, base + (noise(scale, 4) - 0.5) * spread + (rng.random((S, S)) - 0.5) * spread * 0.6)


def tex_gravel():
    v = np.full((S, S), 0.55)
    for _ in range(1500):
        cx, cy, r = rng.integers(0, S), rng.integers(0, S), rng.integers(2, 6)
        dx = (xx - cx + S // 2) % S - S // 2
        dy = (yy - cy + S // 2) % S - S // 2
        d = dx * dx + dy * dy * 1.4
        m = d < r * r
        v[m] = rng.uniform(0.6, 1.0) * (1 - d[m] / (r * r) * 0.35)
    return image("gravel", v)


def tex_foliage(name, count, length, width):
    """A spray of leaves with a transparent background (drawn grey, the app colours it)."""
    v = np.zeros((S, S))
    a = np.zeros((S, S))
    for _ in range(count):
        ang = rng.uniform(0, math.tau)
        rad = math.sqrt(rng.uniform(0, 1)) * S * 0.4
        cx, cy = S / 2 + math.cos(ang) * rad, S / 2 + math.sin(ang) * rad
        t = rng.uniform(0, math.tau)
        dx, dy = xx - cx, yy - cy
        u = dx * math.cos(t) + dy * math.sin(t)
        w = -dx * math.sin(t) + dy * math.cos(t)
        m = (u / length) ** 2 + (w / width) ** 2 < 1
        shade = rng.uniform(0.62, 1.0)
        v[m] = shade * (0.9 + 0.1 * np.clip(1 - np.abs(w[m]) / width, 0, 1))
        a[m] = 1
    v[a == 0] = 0.75
    return image(name, v, a)


def tex_blades():
    v = np.full((S, S), 0.8)
    a = np.zeros((S, S))
    for _ in range(34):
        base, tip = rng.uniform(20, S - 20), rng.uniform(-40, 40)
        top = rng.uniform(0.6, 0.98) * S
        t = np.clip(yy / top, 0, 1)
        centre = base + tip * t * t
        m = (np.abs(xx - centre) < 5.5 * (1 - t) + 1) & (yy < top)
        v[m] = (0.55 + 0.45 * t[m]) * rng.uniform(0.85, 1.0)
        a[m] = 1
        head = ((xx - (base + tip)) / 7) ** 2 + ((yy - top) / 15) ** 2 < 1
        v[head] = 1.0
        a[head] = 1
    return image("blades", v, a)


def tex_water_normal():
    h = noise(6, 4)
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 14
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 14
    n = np.dstack([-gx, -gy, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2)[:, :, None]
    img = image("waternormal", n * 0.5 + 0.5)
    img.colorspace_settings.name = "Non-Color"
    return img


TEX = {
    "plaster": tex_plaster(), "brick": tex_brick(), "rooftile": tex_rooftile(), "corrugated": tex_corrugated(),
    "bark": tex_bark(), "asphalt": tex_grain("asphalt", 0.85, 0.3, 64), "concrete": tex_grain("concrete", 0.9, 0.18, 16),
    "grass": tex_grain("grass", 0.86, 0.3, 32), "soil": tex_grain("soil", 0.82, 0.38, 24), "gravel": tex_gravel(),
    "leaves": tex_foliage("leaves", 150, 17, 8), "needles": tex_foliage("needles", 330, 19, 2.6), "blades": tex_blades(),
    "water": tex_water_normal(),
}

# ---------------------------------------------------------------- materials
MATS = {}


def srgb(h):
    h = h.lstrip("#")
    return [((int(h[i:i + 2], 16) / 255 + 0.055) / 1.055) ** 2.4 for i in (0, 2, 4)]


def material(name, colour, rough=0.8, metal=0.0, tex=None, uv=1.0, cutout=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*srgb(colour), 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if tex:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = TEX[tex]
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1
        mix.inputs[7].default_value = (*srgb(colour), 1)
        nt.links.new(t.outputs["Color"], mix.inputs[6])
        nt.links.new(mix.outputs[2], p.inputs["Base Color"])
        if cutout:
            clip = nt.nodes.new("ShaderNodeMath")
            clip.operation = "GREATER_THAN"
            clip.inputs[1].default_value = 0.5
            nt.links.new(t.outputs["Alpha"], clip.inputs[0])
            nt.links.new(clip.outputs[0], p.inputs["Alpha"])
    m.use_backface_culling = not cutout
    MATS[name] = (m, uv)


def ensure(name, colour, rough=0.7, metal=0.0, two=False, alpha=1.0):
    """A plain material, created the first time it is asked for."""
    if name not in MATS:
        material(name, colour, rough, metal)
        if two:
            MATS[name][0].use_backface_culling = False
        if alpha < 1:
            MATS[name][0].node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value = alpha
    return name


def flat(colour, rough=0.75, metal=0.0):
    return ensure("flat_" + colour[1:], colour, rough, metal, True)


# ---------------------------------------------------------------- geometry
def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def norm(v):
    l = math.sqrt(dot(v, v))
    return (v[0] / l, v[1] / l, v[2] / l) if l > 1e-12 else (0.0, 1.0, 0.0)


def newell(pts):
    n = [0.0, 0.0, 0.0]
    for p, q in zip(pts, pts[1:] + pts[:1]):
        n[0] += (p[1] - q[1]) * (p[2] + q[2])
        n[1] += (p[2] - q[2]) * (p[0] + q[0])
        n[2] += (p[0] - q[0]) * (p[1] + q[1])
    return tuple(n)


def plan(w, d, r, n=6):
    """A rounded-rectangle floor plan: [(x, z, nx, nz)] going round the building."""
    r = max(min(r, w / 2, d / 2), 1e-4)
    out = []
    for q, (sx, sz) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        cx, cz = sx * (w / 2 - r), sz * (d / 2 - r)
        for k in range(n + 1):
            t = math.pi / 2 * (q + k / n)
            out.append((cx + math.cos(t) * r, cz + math.sin(t) * r, math.cos(t), math.sin(t)))
    return out


def oval(w, d, e=4.0, n=48):
    """A superellipse floor plan (e=2 is an ellipse, larger is squarer)."""
    out = []
    for i in range(n):
        t = math.tau * (i + 0.5) / n
        c, s = math.cos(t), math.sin(t)
        x = w / 2 * math.copysign(abs(c) ** (2 / e), c)
        z = d / 2 * math.copysign(abs(s) ** (2 / e), s)
        nx = math.copysign(abs(x / (w / 2)) ** (e - 1), x) / (w / 2)
        nz = math.copysign(abs(z / (d / 2)) ** (e - 1), z) / (d / 2)
        l = math.hypot(nx, nz) or 1
        out.append((x, z, nx / l, nz / l))
    return out


class Asset:
    def __init__(self):
        self.faces = []  # (points, uvs or None, material, smooth, normals or None)

    def face(self, pts, mat, uv=None, smooth=False, normals=None):
        self.faces.append((list(pts), uv, mat, smooth, normals))

    def solid(self, faces, mat, centre, smooth=False, normals=None):
        """Faces of a convex solid: wind each one so it points away from the centre."""
        for k, pts in enumerate(faces):
            ns = normals[k] if normals else None
            n = newell(list(pts))
            mid = tuple(sum(p[i] for p in pts) / len(pts) for i in range(3))
            if dot(n, sub(mid, centre)) < 0:
                pts = pts[::-1]
                ns = ns[::-1] if ns else None
            self.face(pts, mat, smooth=smooth, normals=ns)

    def merge(self, other, scale=1.0, offset=(0, 0, 0), rename=None, ry=0.0):
        """Copy another asset's faces in, uniformly scaled, turned and moved."""
        c, s = math.cos(ry), math.sin(ry)

        def turn(v):
            return (v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c)

        for pts, uv, mat, smooth, ns in other.faces:
            moved = [tuple(turn(p)[i] * scale + offset[i] for i in range(3)) for p in pts]
            self.face(moved, (rename or {}).get(mat, mat), uv, smooth, [turn(n) for n in ns] if ns else None)

    def box(self, w, h, d, mat, x=0.0, y=0.0, z=0.0, bevel=0.0, ry=0.0, seg=None):
        """Centre at (x, y, z); ry turns it about the vertical axis.
        Chunky boxes get properly rounded edges; thin slivers stay sharp to save triangles."""
        hx, hy, hz = w / 2, h / 2, d / 2
        least = min(w, h, d)
        r = 0.0
        if least >= ROUND["min"]:
            r = min(max(bevel, min(least * 0.24, ROUND["max"])), least * 0.48)
        c, s = math.cos(ry), math.sin(ry)

        def turn(px, py, pz):
            return (px * c + pz * s, py, -px * s + pz * c)

        def place(p):
            q = turn(*p)
            return (x + q[0], y + q[1], z + q[2])

        if r <= 0:
            corners = [[(i, a_, b_) for a_, b_ in ((-1, -1), (1, -1), (1, 1), (-1, 1))] for i in (-1, 1)]
            faces = []
            for face_ in corners:
                faces.append([place((i * hx, j * hy, k * hz)) for i, j, k in face_])
                faces.append([place((j * hx, i * hy, k * hz)) for i, j, k in face_])
                faces.append([place((j * hx, k * hy, i * hz)) for i, j, k in face_])
            self.solid(faces, mat, (x, y, z))
            return
        steps = seg or (3 if least >= ROUND["min"] * 4 else 1)
        half = (hx, hy, hz)

        def lines(h_):
            inner = h_ - r
            t = [math.tan(math.pi / 4 * k / steps) * r for k in range(steps + 1)]
            return [-inner - v for v in t[::-1]] + [inner + v for v in t]

        for axis in range(3):
            u, v = (axis + 1) % 3, (axis + 2) % 3
            for sign in (-1, 1):
                lu, lv = lines(half[u]), lines(half[v])
                for i in range(len(lu) - 1):
                    for j in range(len(lv) - 1):
                        pts, ns = [], []
                        for a_, b_ in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)):
                            p = [0.0, 0.0, 0.0]
                            p[axis], p[u], p[v] = sign * half[axis], lu[a_], lv[b_]
                            q = [max(-(half[k] - r), min(half[k] - r, p[k])) for k in range(3)]
                            n = norm(sub(p, q))
                            pts.append(place(tuple(q[k] + n[k] * r for k in range(3))))
                            ns.append(turn(*n))
                        self.solid([pts], mat, (x, y, z), True, [ns])

    def tube(self, p0, p1, r0, r1, mat, seg=10, caps=True, smooth=True):
        """A (tapered) cylinder between two points."""
        axis = sub(p1, p0)
        length = math.sqrt(dot(axis, axis)) or 1e-6
        a = tuple(v / length for v in axis)
        ref = (0, 1, 0) if abs(a[1]) < 0.9 else (1, 0, 0)
        u = norm(cross(a, ref))
        v = cross(a, u)
        r1 = max(r1, 1e-4)
        dirs = [tuple(math.cos(math.tau * k / seg) * u[i] + math.sin(math.tau * k / seg) * v[i] for i in range(3)) for k in range(seg)]
        A = [tuple(p0[i] + r0 * q[i] for i in range(3)) for q in dirs]
        B = [tuple(p1[i] + r1 * q[i] for i in range(3)) for q in dirs]
        N = [norm(tuple(q[i] * length + a[i] * (r0 - r1) for i in range(3))) for q in dirs]
        centre = tuple((p0[i] + p1[i]) / 2 for i in range(3))
        for k in range(seg):
            j = (k + 1) % seg
            self.solid([[A[k], A[j], B[j], B[k]]], mat, centre, smooth, [[N[k], N[j], N[j], N[k]]] if smooth else None)
        if caps:
            self.solid([A, B], mat, centre)

    def capsule(self, p0, p1, r0, r1, mat, seg=12):
        """A tube with rounded ends."""
        self.tube(p0, p1, r0, r1, mat, seg, caps=False)
        self.ball(*p0, r0, r0, r0, mat, seg, max(6, seg // 2 + 1))
        self.ball(*p1, r1, r1, r1, mat, seg, max(6, seg // 2 + 1))

    def ball(self, x, y, z, rx, ry, rz, mat, seg=10, rings=7, top_only=False):
        def P(i, j):
            th = math.pi / (2 if top_only else 1) * j / rings
            ph = math.tau * (i % seg) / seg
            return (x + rx * math.sin(th) * math.cos(ph), y + ry * math.cos(th), z + rz * math.sin(th) * math.sin(ph))

        def N(p):
            return norm(((p[0] - x) / (rx * rx), (p[1] - y) / (ry * ry), (p[2] - z) / (rz * rz)))

        for j in range(rings):
            for i in range(seg):
                q = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)]
                if j == 0:
                    q = [q[0], q[2], q[3]]
                elif j == rings - 1 and not top_only:
                    q = q[:3]
                self.solid([q], mat, (x, y, z), True, [[N(p) for p in q]])

    def torus(self, centre, big, small, mat, axis="x", seg=24, sides=10, start=0.0, sweep=math.tau):
        def P(i, j):
            t = start + sweep * i / seg
            ph = math.tau * j / sides
            ring = (math.cos(t), math.sin(t))
            n = (math.cos(ph) * ring[0], math.cos(ph) * ring[1], math.sin(ph))
            p = (ring[0] * big + n[0] * small, ring[1] * big + n[1] * small, n[2] * small)

            def to(v):
                if axis == "x":
                    return (v[2], v[1], v[0])
                if axis == "y":
                    return (v[0], v[2], v[1])
                return v

            return tuple(centre[k] + to(p)[k] for k in range(3)), to(n)

        for i in range(seg):
            for j in range(sides):
                q = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)]
                pts, ns = [a_[0] for a_ in q], [a_[1] for a_ in q]
                if dot(newell(pts), ns[0]) < 0:
                    pts, ns = pts[::-1], ns[::-1]
                self.face(pts, mat, smooth=True, normals=ns)

    def extrude(self, ring, y0, y1, mat, x=0.0, z=0.0, top=True, bottom=False, paint=None):
        """Walls following a floor plan from plan() or oval(), with smooth corners."""
        for i, (a_, b_) in enumerate(zip(ring, ring[1:] + ring[:1])):
            pts = [(x + a_[0], y0, z + a_[1]), (x + b_[0], y0, z + b_[1]), (x + b_[0], y1, z + b_[1]), (x + a_[0], y1, z + a_[1])]
            ns = [(a_[2], 0, a_[3]), (b_[2], 0, b_[3]), (b_[2], 0, b_[3]), (a_[2], 0, a_[3])]
            if math.dist(pts[0], pts[1]) < 1e-6:
                continue
            if dot(newell(pts), ns[0]) < 0:
                pts, ns = pts[::-1], ns[::-1]
            self.face(pts, paint(i) if paint else mat, smooth=True, normals=ns)
        if top:
            self.face([(x + p[0], y1, z + p[1]) for p in ring][::-1], mat)
        if bottom:
            self.face([(x + p[0], y0, z + p[1]) for p in ring], mat)

    def band(self, outer, inner, y0, y1, mat, x=0.0, z=0.0):
        """A ring-shaped wall (a parapet or a ledge) between two floor plans with equal point counts."""
        self.extrude(outer, y0, y1, mat, x, z, top=False)
        n = len(outer)
        for i in range(n):
            j = (i + 1) % n
            for pts in ([(x + inner[i][0], y1, z + inner[i][1]), (x + inner[j][0], y1, z + inner[j][1]), (x + inner[j][0], y0, z + inner[j][1]), (x + inner[i][0], y0, z + inner[i][1])],
                        [(x + outer[i][0], y1, z + outer[i][1]), (x + outer[j][0], y1, z + outer[j][1]), (x + inner[j][0], y1, z + inner[j][1]), (x + inner[i][0], y1, z + inner[i][1])]):
                if dot(newell(pts), newell(pts)) > 1e-16:
                    flat_top = abs(pts[2][1] - y1) < 1e-9 and abs(pts[0][1] - y1) < 1e-9 and abs(pts[3][1] - y1) < 1e-9
                    nn = newell(pts)
                    if flat_top and nn[1] < 0:
                        pts = pts[::-1]
                    elif not flat_top:
                        mid = ((pts[0][0] + pts[1][0]) / 2 - x, 0, (pts[0][2] + pts[1][2]) / 2 - z)
                        if dot(nn, mid) > 0:
                            pts = pts[::-1]
                    self.face(pts, mat)

    def vault(self, width, rise, length, mat, x=0.0, y=0.0, z=0.0, along="z", seg=20, ends=None):
        """An arched roof: half an ellipse across `width`, running for `length`."""
        def P(i, s):
            t = math.pi * i / seg
            a_, up = -math.cos(t) * width / 2, math.sin(t) * rise
            n = norm((-math.cos(t) / (width / 2), math.sin(t) / max(rise, 1e-4), 0))
            if along == "z":
                return (x + a_, y + up, z + s * length / 2), n
            return (x + s * length / 2, y + up, z + a_), (0, n[1], n[0])

        for i in range(seg):
            q = [P(i, -1), P(i + 1, -1), P(i + 1, 1), P(i, 1)]
            pts, ns = [c_[0] for c_ in q], [c_[1] for c_ in q]
            if dot(newell(pts), ns[0]) < 0:
                pts, ns = pts[::-1], ns[::-1]
            self.face(pts, mat, smooth=True, normals=ns)
        if ends:
            for s in (-1, 1):
                pts = [P(i, s)[0] for i in range(seg + 1)]
                out = (0, 0, s) if along == "z" else (s, 0, 0)
                if dot(newell(pts), out) < 0:
                    pts = pts[::-1]
                self.face(pts, ends)

    def loft(self, rings, mat, caps=True, paint=None):
        """A smooth skin over a row of closed cross-sections (each the same number of points)."""
        n = len(rings[0])
        mids = [tuple(sum(p[k] for p in r) / n for k in range(3)) for r in rings]
        normals = []
        for i, ring in enumerate(rings):
            row = []
            for j in range(n):
                along = sub(rings[min(i + 1, len(rings) - 1)][j], rings[max(i - 1, 0)][j])
                around = sub(ring[(j + 1) % n], ring[(j - 1) % n])
                v = norm(cross(around, along))
                if dot(v, sub(ring[j], mids[i])) < 0:
                    v = (-v[0], -v[1], -v[2])
                row.append(v)
            normals.append(row)
        for i in range(len(rings) - 1):
            for j in range(n):
                k = (j + 1) % n
                pts = [rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j]]
                ns = [normals[i][j], normals[i][k], normals[i + 1][k], normals[i + 1][j]]
                if dot(newell(pts), ns[0]) < 0:
                    pts, ns = pts[::-1], ns[::-1]
                mid = tuple(sum(p[c] for p in pts) / 4 for c in range(3))
                self.face(pts, paint(mid) if paint else mat, smooth=True, normals=ns)
        if caps:
            for i, other in ((0, 1), (len(rings) - 1, len(rings) - 2)):
                pts = rings[i]
                if dot(newell(pts), sub(mids[i], mids[other])) < 0:
                    pts = pts[::-1]
                self.face(pts, paint(mids[i]) if paint else mat)

    def prism(self, w, h, d, mat, x=0.0, y=0.0, z=0.0, along="z", gable=None):
        """Gable roof: base at height y, ridge h above it, running along z (or x)."""
        def P(a, up, b):
            return (x + a, y + up, z + b) if along == "z" else (x + b, y + up, z + a)

        a, b = (w / 2, d / 2) if along == "z" else (d / 2, w / 2)
        L0, R0, T0 = P(-a, 0, -b), P(a, 0, -b), P(0, h, -b)
        L1, R1, T1 = P(-a, 0, b), P(a, 0, b), P(0, h, b)
        centre = P(0, h / 3, 0)
        self.solid([[L0, T0, T1, L1], [R0, T0, T1, R1], [L0, R0, R1, L1]], mat, centre)
        self.solid([[L0, R0, T0], [L1, R1, T1]], gable or mat, centre)
        ridge = ROUND["min"] * 0.6
        self.tube(T0, T1, ridge, ridge, mat, 8)  # rounded ridge tiles

    def card(self, centre, right, up, mat):
        """A textured quad (leaves, crops): full texture, seen from both sides."""
        c = centre
        pts = [tuple(c[i] + sx * right[i] + sy * up[i] for i in range(3)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        self.face(pts, mat, [(0, 0), (1, 0), (1, 1), (0, 1)])

    def make(self, name):
        names = []
        verts, polys, uvs, idx, loop_normals = [], [], [], [], []
        welded = {}
        for pts, uv, mat, smooth, ns in self.faces:
            nn = newell(pts)
            if dot(nn, nn) < 1e-20:
                continue
            flat_n = norm(nn)
            m, scale = MATS[mat][0], MATS[mat][1]
            if uv is None:
                textured = any(nd.type == "TEX_IMAGE" for nd in m.node_tree.nodes)
                if not textured:
                    uv = [(0, 0)] * len(pts)
                else:  # box projection in world units
                    ax = max(range(3), key=lambda i: abs(nn[i]))
                    pick = {0: (2, 1), 1: (0, 2), 2: (0, 1)}[ax]
                    uv = [(p[pick[0]] / scale, p[pick[1]] / scale) for p in pts]
            poly, puv, pn = [], [], []
            for k, p in enumerate(pts):
                if smooth:
                    key = (round(p[0], 5), round(p[1], 5), round(p[2], 5))
                    if key not in welded:
                        welded[key] = len(verts)
                        verts.append((p[0], -p[2], p[1]))
                    v = welded[key]
                else:
                    v = len(verts)
                    verts.append((p[0], -p[2], p[1]))
                if v in poly:
                    continue
                poly.append(v)
                puv.append(uv[k])
                n = ns[k] if ns else flat_n
                pn.append((n[0], -n[2], n[1]))
            if len(poly) < 3:
                continue
            if mat not in names:
                names.append(mat)
            polys.append(poly)
            uvs.extend(puv)
            loop_normals.extend(pn)
            idx.append(names.index(mat))
        me = bpy.data.meshes.new(name)
        me.from_pydata(verts, [], polys)
        layer = me.uv_layers.new()
        layer.data.foreach_set("uv", np.array(uvs, dtype=np.float32).ravel())
        for n in names:
            me.materials.append(MATS[n][0])
        me.polygons.foreach_set("material_index", idx)
        me.polygons.foreach_set("use_smooth", [True] * len(polys))
        me.normals_split_custom_set(loop_normals)  # exact smooth or flat normals, per corner
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)


def blob(target, parts, paint, voxel, tris=3000, smooth=4, bumps=0.0, bump_scale=3.0):
    """Fuse overlapping shapes into one seamless skin with Blender's voxel remesh, smooth and
    decimate it, and add it to `target`. `paint` is a material name or a function of position."""
    welded, verts, polys = {}, [], []
    for pts, *_ in parts.faces:
        poly = []
        for p in pts:
            key = (round(p[0], 5), round(p[1], 5), round(p[2], 5))
            if key not in welded:
                welded[key] = len(verts)
                verts.append((p[0], -p[2], p[1]))
            if welded[key] not in poly:
                poly.append(welded[key])
        if len(poly) > 2:
            polys.append(poly)
    me = bpy.data.meshes.new("blob")
    me.from_pydata(verts, [], polys)
    ob = bpy.data.objects.new("blob", me)
    bpy.context.scene.collection.objects.link(ob)
    rem = ob.modifiers.new("remesh", "REMESH")
    rem.mode = "VOXEL"
    rem.voxel_size = voxel
    sm = ob.modifiers.new("smooth", "SMOOTH")
    sm.iterations = smooth
    sm.factor = 0.6

    def evaluated():
        dg = bpy.context.evaluated_depsgraph_get()
        return bpy.data.meshes.new_from_object(ob.evaluated_get(dg))

    first = evaluated()
    first.calc_loop_triangles()
    count = len(first.loop_triangles)
    bpy.data.meshes.remove(first)
    dec = ob.modifiers.new("decimate", "DECIMATE")
    dec.ratio = min(1.0, tris / max(count, 1))
    out = evaluated()
    if bumps:
        out.update()
        normals = [v.normal.copy() for v in out.vertices]
        for v, n in zip(out.vertices, normals):
            v.co += n * (mathutils.noise.fractal(v.co * bump_scale, 1.0, 2.0, 3) * bumps)
        out.update()
    out.calc_loop_triangles()
    for tri in out.loop_triangles:
        pts, ns = [], []
        for i in tri.vertices:
            co, n = out.vertices[i].co, out.vertices[i].normal
            pts.append((co.x, max(co.z, 0.0), -co.y))
            ns.append((n.x, n.z, -n.y))
        mid = tuple(sum(p[k] for p in pts) / 3 for k in range(3))
        target.face(pts, paint(mid) if callable(paint) else paint, smooth=True, normals=ns)
    bpy.data.meshes.remove(out)
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(me)


ASSETS = {}


def asset(name):
    ASSETS[name] = Asset()
    return ASSETS[name]


def export(path, tag):
    tris = 0
    for name, a in ASSETS.items():
        a.make(name)
        tris += sum(len(f[0]) - 2 for f in a.faces)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=False, export_yup=True, export_image_format="AUTO", export_cameras=False, export_lights=False, export_animations=False,
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                              export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12)
    print(f"{tag} {len(ASSETS)} assets, {tris} triangles, {os.path.getsize(path) / 1e6:.2f} MB -> {os.path.abspath(path)}")


# ---------------------------------------------------------------- shared shapes
def rand_unit():
    while True:
        v = (random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1))
        d = math.sqrt(dot(v, v))
        if 0.2 < d <= 1:
            return tuple(c / d for c in v)


def leaf_cloud(a, cx, cy, cz, rx, ry, count, size, mat="leaf"):
    for _ in range(count):
        n = rand_unit()
        k = random.uniform(0.45, 1.0)
        c = (cx + n[0] * rx * k, cy + n[1] * ry * k, cz + n[2] * rx * k)
        u = cross(n, rand_unit())
        l = math.sqrt(dot(u, u)) or 1
        u = tuple(v / l * size for v in u)
        w = cross(n, u)
        l = math.sqrt(dot(w, w)) or 1
        w = tuple(v / l * size for v in w)
        a.card(c, u, w, mat)


def trunk(a, x, z, h, r):
    a.tube((x, 0, z), (x, h * 0.55, z), r, r * 0.65, "bark", 8)
    a.tube((x, h * 0.55, z), (x, h, z), r * 0.65, r * 0.2, "bark", 7)


def branches(a, x, z, h, r, n, spread_):
    tips = []
    for i in range(n):
        t = math.tau * i / n + random.uniform(-0.3, 0.3)
        y = h * random.uniform(0.45, 0.8)
        tip = (x + math.cos(t) * spread_, y + h * random.uniform(0.18, 0.35), z + math.sin(t) * spread_)
        a.tube((x, y, z), tip, r * 0.42, r * 0.1, "bark", 6)
        tips.append(tip)
    return tips


def tuft(a, x, z, w, h, y=0.0, mat="crop"):
    t = random.uniform(0, math.pi)
    for k in (0, math.pi / 2):
        a.card((x, y + h / 2, z), (math.cos(t + k) * w / 2, 0, math.sin(t + k) * w / 2), (0, h / 2, 0), mat)


def wheel(a, x, y, z, r, w):
    a.tube((x - w / 2, y, z), (x + w / 2, y, z), r, r, "rubber", 12)
    a.tube((x - w / 2 - 0.001, y, z), (x + w / 2 + 0.001, y, z), r * 0.5, r * 0.5, "metal", 10)


def hull(a, width, profile, mat, taper=1.0, top=None):
    """Extrude a side profile [(z, y)...] across the width, narrowing above `top`."""
    def X(y):
        return width / 2 * (taper if top is not None and y > top else 1.0)

    cz = sum(p[0] for p in profile) / len(profile)
    cy = sum(p[1] for p in profile) / len(profile)
    for (z0, y0), (z1, y1) in zip(profile, profile[1:] + profile[:1]):
        a.solid([[(-X(y0), y0, z0), (X(y0), y0, z0), (X(y1), y1, z1), (-X(y1), y1, z1)]], mat, (0, cy, cz))
    for s in (-1, 1):
        a.solid([[(s * X(y), y, z) for z, y in profile]], mat, (0, cy, cz))
