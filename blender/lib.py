"""Shared by the model scripts: procedural textures, materials and a small mesh builder.

Geometry is written in the web app's coordinates (x right, y up, z front) and converted to
Blender's z-up space when the mesh is created.
"""
import math
import os
import random

import bpy
import numpy as np

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


# ---------------------------------------------------------------- geometry
def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


class Asset:
    def __init__(self):
        self.faces = []  # (points, uvs or None, material, smooth)

    def face(self, pts, mat, uv=None, smooth=False):
        self.faces.append((pts, uv, mat, smooth))

    def solid(self, faces, mat, centre, smooth=False):
        """Faces of a convex solid: wind each one so it points away from the centre."""
        for pts in faces:
            n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]))
            mid = tuple(sum(p[i] for p in pts) / len(pts) for i in range(3))
            if dot(n, sub(mid, centre)) < 0:
                pts = pts[::-1]
            self.face(pts, mat, smooth=smooth)

    def box(self, w, h, d, mat, x=0.0, y=0.0, z=0.0, bevel=0.0, ry=0.0):
        """Centre at (x, y, z); ry turns it about the vertical axis."""
        hx, hy, hz = w / 2, h / 2, d / 2
        b = min(bevel, hx * 0.4, hy * 0.4, hz * 0.4)
        c, s = math.cos(ry), math.sin(ry)

        def P(px, py, pz):
            return (x + px * c + pz * s, y + py, z - px * s + pz * c)

        faces = []
        # each corner has three points once the edges are cut
        def X(i, j, k):
            return P(i * hx, j * (hy - b), k * (hz - b))

        def Y(i, j, k):
            return P(i * (hx - b), j * hy, k * (hz - b))

        def Z(i, j, k):
            return P(i * (hx - b), j * (hy - b), k * hz)

        for i in (-1, 1):
            faces.append([X(i, -1, -1), X(i, 1, -1), X(i, 1, 1), X(i, -1, 1)])
            faces.append([Y(-1, i, -1), Y(1, i, -1), Y(1, i, 1), Y(-1, i, 1)])
            faces.append([Z(-1, -1, i), Z(1, -1, i), Z(1, 1, i), Z(-1, 1, i)])
        if b > 0:
            for i in (-1, 1):
                for j in (-1, 1):
                    faces.append([X(i, j, -1), X(i, j, 1), Y(i, j, 1), Y(i, j, -1)])
                    faces.append([X(i, -1, j), X(i, 1, j), Z(i, 1, j), Z(i, -1, j)])
                    faces.append([Y(-1, i, j), Y(1, i, j), Z(1, i, j), Z(-1, i, j)])
                    for k in (-1, 1):
                        faces.append([X(i, j, k), Y(i, j, k), Z(i, j, k)])
        self.solid(faces, mat, (x, y, z))

    def tube(self, p0, p1, r0, r1, mat, seg=10, caps=True, smooth=True):
        """A (tapered) cylinder between two points."""
        axis = sub(p1, p0)
        length = math.sqrt(dot(axis, axis)) or 1e-6
        a = tuple(v / length for v in axis)
        ref = (0, 1, 0) if abs(a[1]) < 0.9 else (1, 0, 0)
        u = cross(a, ref)
        ul = math.sqrt(dot(u, u))
        u = tuple(v / ul for v in u)
        v = cross(a, u)

        def ring(p, r):
            return [tuple(p[i] + r * (math.cos(math.tau * k / seg) * u[i] + math.sin(math.tau * k / seg) * v[i]) for i in range(3)) for k in range(seg)]

        A, B = ring(p0, r0), ring(p1, max(r1, 1e-4))
        centre = tuple((p0[i] + p1[i]) / 2 for i in range(3))
        self.solid([[A[k], A[(k + 1) % seg], B[(k + 1) % seg], B[k]] for k in range(seg)], mat, centre, smooth)
        if caps:
            self.solid([A, B], mat, centre)

    def ball(self, x, y, z, rx, ry, rz, mat, seg=10, rings=7, top_only=False):
        def P(i, j):
            th = math.pi / (2 if top_only else 1) * j / rings
            ph = math.tau * i / seg
            return (x + rx * math.sin(th) * math.cos(ph), y + ry * math.cos(th), z + rz * math.sin(th) * math.sin(ph))

        faces = []
        for j in range(rings):
            for i in range(seg):
                q = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)]
                if j == 0:
                    q = [q[0], q[2], q[3]]
                elif j == rings - 1 and not top_only:
                    q = q[:3]
                faces.append(q)
        self.solid(faces, mat, (x, y, z), True)

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

    def card(self, centre, right, up, mat):
        """A textured quad (leaves, crops): full texture, seen from both sides."""
        c = centre
        pts = [tuple(c[i] + sx * right[i] + sy * up[i] for i in range(3)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        self.face(pts, mat, [(0, 0), (1, 0), (1, 1), (0, 1)])

    def make(self, name):
        names = []
        verts, polys, uvs, idx, smooth = [], [], [], [], []
        for pts, uv, mat, sm in self.faces:
            if mat not in names:
                names.append(mat)
            scale = MATS[mat][1]
            if uv is None:  # box projection in world units
                n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]))
                ax = max(range(3), key=lambda i: abs(n[i]))
                pick = {0: (2, 1), 1: (0, 2), 2: (0, 1)}[ax]
                uv = [(p[pick[0]] / scale, p[pick[1]] / scale) for p in pts]
            start = len(verts)
            verts.extend((p[0], -p[2], p[1]) for p in pts)
            polys.append(list(range(start, start + len(pts))))
            uvs.extend(uv)
            idx.append(names.index(mat))
            smooth.append(sm)
        me = bpy.data.meshes.new(name)
        me.from_pydata(verts, [], polys)
        layer = me.uv_layers.new()
        layer.data.foreach_set("uv", np.array(uvs, dtype=np.float32).ravel())
        for n in names:
            me.materials.append(MATS[n][0])
        me.polygons.foreach_set("material_index", idx)
        me.polygons.foreach_set("use_smooth", smooth)
        if any(smooth):  # weld shared points so smooth faces shade smoothly
            import bmesh
            bm = bmesh.new()
            bm.from_mesh(me)
            bmesh.ops.remove_doubles(bm, verts=[v for v in bm.verts if all(f.smooth for f in v.link_faces)], dist=1e-5)
            bm.to_mesh(me)
            bm.free()
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)


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
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=False, export_yup=True, export_image_format="AUTO", export_cameras=False, export_lights=False, export_animations=False)
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
