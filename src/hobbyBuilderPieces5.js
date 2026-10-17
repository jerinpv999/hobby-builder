import * as THREE from "three";

/* Units: 1 = one stud. A brick is BH tall; stud height SH, radius SR.
   Every piece is built in a local frame with its origin at the min corner of
   its footprint (w along x, d along z) and its "front" facing +z. */
export const BH = 1.2;
export const SH = 0.2;
export const SR = 0.3;
export const studGeo = new THREE.CylinderGeometry(SR, SR, SH, 20);

/* ---------- caches so rebuilding the scene never leaks ---------- */
const geos = new Map();
const G = (C, ...a) => {
  let m = geos.get(C);
  if (!m) geos.set(C, (m = new Map()));
  const k = a.join();
  if (!m.has(k)) m.set(k, new C(...a));
  return m.get(k);
};
const mats = {};
const mat = (c, o = {}) =>
  (mats[c + JSON.stringify(o)] ||= new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, ...o }));
const glass = () => mat("#8CC8E8", { transparent: true, opacity: 0.45, roughness: 0.1 });
const shade = (hex, f) => "#" + new THREE.Color(hex).multiplyScalar(f).getHexString();

/* ---------- tiny mesh helpers (x, y, z are the part's CENTER) ---------- */
function add(g, geo, m, x, y, z) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  g.add(o);
  return o;
}
const B = (g, w, h, d, m, x, y, z) => add(g, G(THREE.BoxGeometry, w, h, d), m, x, y, z);
const Cyl = (g, rt, rb, h, m, x, y, z) => add(g, G(THREE.CylinderGeometry, rt, rb, h, 20), m, x, y, z);
const Sph = (g, r, m, x, y, z) => add(g, G(THREE.SphereGeometry, r, 14, 10), m, x, y, z);
function studs(g, w, d, y, m) {
  for (let x = 0; x < w; x++)
    for (let z = 0; z < d; z++) add(g, studGeo, m, x + 0.5, y + SH / 2, z + 0.5);
}

/* ---------- catalog ---------- */
export const TYPES = {};
const reg = (key, name, w, d, h, top, build) => (TYPES[key] = { key, name, w, d, h, top, build });

/* Customizable pieces: the app shows controls for `params`, and size(opts) gives the
   footprint (w, d), height in brick layers (h) and whether things can stack on it (top).
   params: { key, label, kind: "num" (min, max, step) | "sel" (options: [[value, label]]) | "tog", def } */
export const defaultOpts = (t) => (t.params ? Object.fromEntries(t.params.map((p) => [p.key, p.def])) : null);
// Fill in defaults and clamp or snap anything that is missing or out of range (used for loaded files too)
export function cleanOpts(t, raw) {
  const out = defaultOpts(t);
  if (!t.params || !raw || typeof raw !== "object") return out;
  for (const p of t.params) {
    const v = raw[p.key];
    if (p.kind === "num" && Number.isFinite(v)) {
      const snapped = Math.round((v - p.min) / p.step) * p.step + p.min;
      out[p.key] = Math.min(p.max, Math.max(p.min, +snapped.toFixed(4)));
    } else if (p.kind === "sel" && p.options.some(([val]) => val === v)) out[p.key] = v;
    else if (p.kind === "tog" && typeof v === "boolean") out[p.key] = v;
  }
  return out;
}
/* Size before any stretching, then with a stretch (dim = { w, d, h }) applied to any piece. */
const baseDims = (t, opts) => (t.params ? t.size(cleanOpts(t, opts)) : { w: t.w, d: t.d, h: t.h, top: t.top });
export const typeDims = (t, opts, dim) => {
  const base = baseDims(t, opts);
  return dim ? { ...base, w: dim.w, d: dim.d, h: dim.h } : base;
};
// A stretched size: whole studs from 1 to 16, height in quarter bricks from 1/4 to 8. Returns null if not valid.
export function cleanDim(raw) {
  if (!raw || typeof raw !== "object" || ![raw.w, raw.d, raw.h].every(Number.isFinite)) return null;
  const q = (v, lo, hi, step) => Math.min(hi, Math.max(lo, Math.round(v / step) * step));
  return { w: q(raw.w, 1, 16, 1), d: q(raw.d, 1, 16, 1), h: q(raw.h, 0.25, 8, 0.25) };
}
const regCustom = (key, name, params, size, build, light = null) => {
  const defaults = Object.fromEntries(params.map((p) => [p.key, p.def]));
  TYPES[key] = { key, name, params, size, build, light, custom: true, ...size(defaults) };
};
// w, d = footprint in studs, h = height in brick layers, top = can other pieces stack on it?

// Plain bricks
[[1, 1], [1, 2], [1, 3], [1, 4], [2, 2], [2, 3], [2, 4]].forEach(([w, d]) =>
  reg(`b${w}x${d}`, `${w}×${d}`, w, d, 1, true, (c) => {
    const g = new THREE.Group();
    const m = mat(c);
    B(g, w - 0.04, BH, d - 0.04, m, w / 2, BH / 2, d / 2);
    studs(g, w, d, BH, m);
    return g;
  })
);

// Flat bricks: same size as a brick but with a smooth top (no studs)
[[1, 1], [1, 2], [1, 3], [1, 4], [2, 2], [2, 3], [2, 4]].forEach(([w, d]) =>
  reg(`f${w}x${d}`, `Flat ${w}×${d}`, w, d, 1, true, (c) => {
    const g = new THREE.Group();
    B(g, w - 0.04, BH, d - 0.04, mat(c), w / 2, BH / 2, d / 2);
    return g;
  })
);
// Tiles: a quarter-brick thick, smooth top. Good for floors, roads and paths.
[[1, 2], [2, 2], [2, 4], [4, 4], [4, 8]].forEach(([w, d]) =>
  reg(`t${w}x${d}`, `Tile ${w}×${d}`, w, d, 0.25, true, (c) => {
    const g = new THREE.Group();
    B(g, w - 0.04, BH * 0.25 - 0.01, d - 0.04, mat(c), w / 2, (BH * 0.25 - 0.01) / 2, d / 2);
    return g;
  })
);

// Window: frame in the chosen color, glass pane in the middle
reg("window", "Window", 2, 1, 2, true, (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  B(g, 0.25, 2.4, 0.96, m, 0.125, 1.2, 0.5);
  B(g, 0.25, 2.4, 0.96, m, 1.875, 1.2, 0.5);
  B(g, 2, 0.3, 0.96, m, 1, 0.15, 0.5); // sill
  B(g, 2, 0.3, 0.96, m, 1, 2.25, 0.5); // lintel
  B(g, 0.1, 1.8, 0.2, m, 1, 1.2, 0.5); // mullions
  B(g, 1.5, 0.1, 0.2, m, 1, 1.2, 0.5);
  B(g, 1.5, 1.8, 0.06, glass(), 1, 1.2, 0.5);
  studs(g, 2, 1, 2.4, m);
  return g;
});

// Door: darker frame, leaf in the chosen color, gold handles on both sides
reg("door", "Door", 2, 1, 3, true, (c) => {
  const g = new THREE.Group();
  const frame = mat(shade(c, 0.6));
  B(g, 0.25, 3.6, 0.96, frame, 0.125, 1.8, 0.5);
  B(g, 0.25, 3.6, 0.96, frame, 1.875, 1.8, 0.5);
  B(g, 2, 0.3, 0.96, frame, 1, 3.45, 0.5);
  B(g, 1.5, 3.3, 0.5, mat(c), 1, 1.65, 0.5);
  const gold = mat("#E3B23C", { metalness: 0.5 });
  Sph(g, 0.09, gold, 1.45, 1.6, 0.78);
  Sph(g, 0.09, gold, 1.45, 1.6, 0.22);
  studs(g, 2, 1, 3.6, frame);
  return g;
});

// Flower pot: terracotta pot, plant, flower in the chosen color
reg("pot", "Pot", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  const green = mat("#2E7D32");
  Cyl(g, 0.44, 0.32, 0.9, mat("#B5532F"), 0.5, 0.45, 0.5);
  Cyl(g, 0.47, 0.47, 0.12, mat("#B5532F"), 0.5, 0.86, 0.5);
  Cyl(g, 0.38, 0.38, 0.02, mat("#3B2A1D"), 0.5, 0.93, 0.5);
  Cyl(g, 0.04, 0.04, 0.7, green, 0.5, 1.3, 0.5);
  Sph(g, 0.2, green, 0.28, 1.2, 0.5);
  Sph(g, 0.2, green, 0.72, 1.3, 0.5);
  Sph(g, 0.17, mat(c), 0.5, 1.75, 0.5);
  return g;
});

// Roof slopes: low edge at the front (z = 0), high edge at the back. Pair two
// facing opposite directions (rotate one twice) to make a peaked roof.
const roofGeos = {};
const roofGeo = (len) => {
  if (!roofGeos[len]) {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(2, 0);
    s.lineTo(2, BH);
    s.lineTo(0, 0);
    roofGeos[len] = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
  }
  return roofGeos[len];
};
[2, 4].forEach((len) =>
  reg(`roof${len}`, `Roof ${len}×2`, len, 2, 1, false, (c) => {
    const g = new THREE.Group();
    const mesh = add(g, roofGeo(len), mat(shade(c, 0.9)), len, 0, 0);
    mesh.rotation.y = -Math.PI / 2; // profile x -> world z, extrusion -> world x
    return g;
  })
);

// People: shirt in the chosen color; the worker wears an orange hard hat
const person = (hardHat) => (c) => {
  const g = new THREE.Group();
  const skin = mat("#F2CD37");
  const shirt = mat(c);
  const pants = mat("#2F4B7C");
  const dark = mat("#111111");
  B(g, 0.34, 1, 0.46, pants, 0.33, 0.5, 0.5); // legs
  B(g, 0.34, 1, 0.46, pants, 0.67, 0.5, 0.5);
  B(g, 0.64, 1.1, 0.46, shirt, 0.5, 1.55, 0.5); // torso
  B(g, 0.18, 1, 0.28, shirt, 0.09, 1.5, 0.5); // arms
  B(g, 0.18, 1, 0.28, shirt, 0.91, 1.5, 0.5);
  B(g, 0.18, 0.2, 0.26, skin, 0.09, 0.9, 0.5); // hands
  B(g, 0.18, 0.2, 0.26, skin, 0.91, 0.9, 0.5);
  Cyl(g, 0.3, 0.3, 0.5, skin, 0.5, 2.35, 0.5); // head
  Sph(g, 0.04, dark, 0.4, 2.4, 0.79); // face
  Sph(g, 0.04, dark, 0.6, 2.4, 0.79);
  B(g, 0.2, 0.04, 0.02, dark, 0.5, 2.25, 0.8);
  if (hardHat) {
    const hat = mat("#FE8A18");
    add(g, G(THREE.SphereGeometry, 0.34, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), hat, 0.5, 2.55, 0.5);
    B(g, 0.5, 0.05, 0.2, hat, 0.5, 2.57, 0.84);
  } else {
    const hair = mat("#4A2F1B");
    Cyl(g, 0.32, 0.32, 0.16, hair, 0.5, 2.58, 0.5);
    B(g, 0.6, 0.45, 0.1, hair, 0.5, 2.4, 0.24);
  }
  return g;
};
reg("person", "Person", 1, 1, 3, false, person(false));
reg("worker", "Worker", 1, 1, 3, false, person(true));

// Car: 2 wide, 4 long, front (headlights) toward +z
reg("car", "Car", 2, 4, 2, false, (c) => {
  const g = new THREE.Group();
  const body = mat(c);
  const tyre = mat("#1B1B1B");
  const tint = mat("#2C4A5E", { roughness: 0.15 });
  for (const x of [0.14, 1.86])
    for (const z of [0.85, 3.15]) {
      const wheel = Cyl(g, 0.42, 0.42, 0.28, tyre, x, 0.42, z);
      wheel.rotation.z = Math.PI / 2;
    }
  B(g, 1.7, 0.65, 3.8, body, 1, 0.625, 2); // chassis
  B(g, 1.5, 0.7, 1.7, body, 1, 1.3, 1.55); // cabin
  B(g, 1.52, 0.4, 1.3, tint, 1, 1.3, 1.55); // side windows
  B(g, 1.3, 0.4, 1.72, tint, 1, 1.3, 1.55); // windshield + rear window
  B(g, 1.5, 0.08, 1.7, body, 1, 1.69, 1.55); // roof
  const lamp = mat("#FFF3B0", { emissive: "#FFF3B0", emissiveIntensity: 0.3 });
  const tail = mat("#D01012");
  B(g, 0.3, 0.18, 0.06, lamp, 0.45, 0.7, 3.9);
  B(g, 0.3, 0.18, 0.06, lamp, 1.55, 0.7, 3.9);
  B(g, 0.3, 0.18, 0.06, tail, 0.45, 0.7, 0.1);
  B(g, 0.3, 0.18, 0.06, tail, 1.55, 0.7, 0.1);
  return g;
});

/* ---------- more roofs ---------- */
const prismGeo = (key, pts, len) => {
  const k = key + len;
  if (!roofGeos[k]) {
    const s = new THREE.Shape();
    pts.forEach(([u, v], i) => (i ? s.lineTo(u, v) : s.moveTo(u, v)));
    roofGeos[k] = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
  }
  return roofGeos[k];
};
const Cone = (g, r, h, seg, m, x, y, z) => add(g, G(THREE.ConeGeometry, r, h, seg), m, x, y, z);
const Ico = (g, r, m, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) => {
  const o = add(g, G(THREE.IcosahedronGeometry, r, 0), m, x, y, z);
  o.scale.set(sx, sy, sz);
  o.rotation.y = ry;
  return o;
};

// Gable: ridge runs along x, slopes fall away toward front and back
[2, 4].forEach((len) =>
  reg(`gable${len}`, `Gable ${len}×4`, len, 4, 2, false, (c) => {
    const g = new THREE.Group();
    const o = add(g, prismGeo("g", [[0, 0], [4, 0], [2, 1.8]], len), mat(shade(c, 0.9)), len, 0, 0);
    o.rotation.y = -Math.PI / 2;
    return g;
  })
);
// Hip: four-sided pyramid
[2, 4].forEach((n) =>
  reg(`hip${n}`, `Hip ${n}×${n}`, n, n, n === 2 ? 1 : 2, false, (c) => {
    const g = new THREE.Group();
    const o = Cone(g, n * 0.693, n * 0.45, 4, mat(shade(c, 0.9)), n / 2, (n * 0.45) / 2, n / 2);
    o.rotation.y = Math.PI / 4;
    return g;
  })
);
reg("spire", "Spire", 2, 2, 2, false, (c) => {
  const g = new THREE.Group();
  Cone(g, 1, 1.9, 20, mat(shade(c, 0.9)), 1, 0.95, 1);
  return g;
});
reg("dome", "Dome", 2, 2, 1, false, (c) => {
  const g = new THREE.Group();
  add(g, G(THREE.SphereGeometry, 0.97, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(shade(c, 0.9)), 1, 0, 1);
  return g;
});

/* ---------- trees ---------- */
const bark = mat("#6B4426");
const leafA = mat("#2E7D32");
const leafB = mat("#3FA34D");

reg("pine", "Pine tree", 2, 2, 3, false, () => {
  const g = new THREE.Group();
  const pine = mat("#1F5F34");
  Cyl(g, 0.12, 0.16, 0.9, bark, 1, 0.45, 1);
  Cone(g, 0.9, 1.5, 8, pine, 1, 1.45, 1);
  Cone(g, 0.7, 1.3, 8, pine, 1, 2.15, 1);
  Cone(g, 0.5, 1.1, 8, pine, 1, 2.75, 1);
  return g;
});
reg("oak", "Round tree", 2, 2, 3, false, () => {
  const g = new THREE.Group();
  Cyl(g, 0.18, 0.25, 1.5, bark, 1, 0.75, 1);
  Sph(g, 0.95, leafA, 1, 2.4, 1);
  Sph(g, 0.6, leafB, 0.5, 2.0, 1.15);
  Sph(g, 0.65, leafB, 1.5, 2.1, 0.8);
  Sph(g, 0.55, leafA, 1.05, 3.0, 0.85);
  return g;
});
reg("palm", "Palm tree", 2, 2, 4, false, () => {
  const g = new THREE.Group();
  const trunk = mat("#8B6B43");
  for (let i = 0; i < 5; i++) Cyl(g, 0.1, 0.13, 0.85, trunk, 1 + i * 0.04, 0.42 + i * 0.82, 1);
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    const f = Sph(g, 0.5, leafB, 1.16 + Math.cos(a) * 0.42, 4.1, 1 + Math.sin(a) * 0.42);
    f.scale.set(1, 0.12, 0.5);
    f.rotation.order = "YZX";
    f.rotation.set(0, -a, -0.4);
  }
  Sph(g, 0.1, bark, 1.1, 3.95, 0.9);
  Sph(g, 0.1, bark, 1.25, 3.95, 1.1);
  return g;
});

/* ---------- plants and stones ---------- */
reg("bush", "Bush", 1, 1, 1, false, () => {
  const g = new THREE.Group();
  Sph(g, 0.3, leafA, 0.3, 0.3, 0.55);
  Sph(g, 0.3, leafA, 0.72, 0.3, 0.45);
  Sph(g, 0.3, leafB, 0.5, 0.62, 0.5);
  return g;
});
reg("flowers", "Flower bed", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  B(g, 0.92, 0.14, 0.92, mat("#4A3222"), 0.5, 0.07, 0.5);
  [[0.25, 0.25], [0.7, 0.3], [0.4, 0.62], [0.75, 0.72], [0.2, 0.75]].forEach(([x, z], i) => {
    Cyl(g, 0.025, 0.025, 0.45, leafA, x, 0.37, z);
    Sph(g, 0.11, i % 2 ? mat(c) : mat("#FFD23F"), x, 0.65, z);
  });
  return g;
});
reg("sunflower", "Sunflower", 1, 1, 2, false, () => {
  const g = new THREE.Group();
  Cyl(g, 0.05, 0.06, 1.6, leafA, 0.5, 0.8, 0.5);
  const l = Sph(g, 0.15, leafB, 0.3, 0.7, 0.5);
  l.scale.set(1.4, 0.25, 0.8);
  const petals = Cyl(g, 0.3, 0.3, 0.08, mat("#F2CD37"), 0.5, 1.7, 0.55);
  petals.rotation.x = Math.PI / 2;
  const mid = Cyl(g, 0.16, 0.16, 0.1, mat("#5A3A1E"), 0.5, 1.7, 0.58);
  mid.rotation.x = Math.PI / 2;
  return g;
});
reg("cactus", "Cactus", 1, 1, 2, false, (c) => {
  const g = new THREE.Group();
  const cg = mat("#3F8F4F");
  Cyl(g, 0.2, 0.22, 1.3, cg, 0.5, 0.65, 0.5);
  [[-1, 0.7, 0.9], [1, 0.55, 0.75]].forEach(([s, yh, yv]) => {
    const arm = Cyl(g, 0.09, 0.09, 0.3, cg, 0.5 + s * 0.2, yh, 0.5);
    arm.rotation.z = Math.PI / 2;
    Cyl(g, 0.09, 0.09, 0.4, cg, 0.5 + s * 0.33, yv, 0.5);
  });
  Sph(g, 0.1, mat(c), 0.5, 1.33, 0.5);
  return g;
});
reg("grass", "Grass", 1, 1, 1, false, () => {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const r = 0.1 + (i % 3) * 0.12;
    const h = 0.5 + (i % 3) * 0.15;
    const b = Cone(g, 0.045, h, 5, i % 2 ? leafA : leafB, 0.5 + Math.cos(a) * r, h / 2, 0.5 + Math.sin(a) * r);
    b.rotation.set(Math.sin(a) * 0.2, 0, Math.cos(a) * 0.2);
  }
  return g;
});
reg("hedge", "Hedge", 1, 2, 1, false, () => {
  const g = new THREE.Group();
  B(g, 0.92, 0.9, 1.92, mat("#2E6B34"), 0.5, 0.45, 1);
  [0.5, 1.5].forEach((z) => Sph(g, 0.46, leafA, 0.5, 0.9, z).scale.set(1, 0.6, 1));
  return g;
});
const rock = mat("#8A8D91", { flatShading: true, roughness: 0.95 });
const rock2 = mat("#74777B", { flatShading: true, roughness: 0.95 });
reg("stone", "Stone", 1, 1, 1, false, () => {
  const g = new THREE.Group();
  Ico(g, 0.42, rock, 0.5, 0.3, 0.5, 1, 0.75, 0.9, 0.6);
  Ico(g, 0.2, rock2, 0.82, 0.12, 0.25, 1, 0.7, 1, 1.1);
  return g;
});
reg("boulder", "Boulder", 2, 2, 2, false, () => {
  const g = new THREE.Group();
  Ico(g, 0.95, rock, 1, 0.75, 1, 1, 0.85, 0.95, 0.4);
  Ico(g, 0.55, rock2, 1.55, 0.4, 1.45, 1, 0.8, 1, 1.2);
  Ico(g, 0.4, rock, 0.45, 0.3, 1.5, 1, 0.7, 1, 0.2);
  return g;
});

/* ---------- bus: 2 wide, 6 long, front toward +z ---------- */
reg("bus", "Bus", 2, 6, 2, false, (c) => {
  const g = new THREE.Group();
  const trim = mat("#F4F4F4");
  const tint = mat("#2C4A5E", { roughness: 0.15 });
  for (const x of [0.14, 1.86])
    for (const z of [1.2, 4.8]) {
      const w = Cyl(g, 0.42, 0.42, 0.28, mat("#1B1B1B"), x, 0.42, z);
      w.rotation.z = Math.PI / 2;
    }
  B(g, 1.8, 1.5, 5.8, mat(c), 1, 1.1, 3);
  B(g, 1.84, 0.12, 5.82, trim, 1, 0.7, 3); // stripe
  for (let i = 0; i < 5; i++) B(g, 1.84, 0.55, 0.75, tint, 1, 1.45, 1 + i * 0.95); // side windows
  B(g, 1.5, 0.6, 0.06, tint, 1, 1.4, 5.92); // windshield
  B(g, 1.2, 0.4, 0.06, tint, 1, 1.4, 0.08); // rear window
  B(g, 1.9, 0.08, 5.9, trim, 1, 1.89, 3); // roof
  const lamp = mat("#FFF3B0", { emissive: "#FFF3B0", emissiveIntensity: 0.3 });
  const tail = mat("#D01012");
  [0.4, 1.6].forEach((x) => {
    B(g, 0.3, 0.18, 0.06, lamp, x, 0.65, 5.93);
    B(g, 0.3, 0.18, 0.06, tail, x, 0.65, 0.07);
  });
  return g;
});

/* ---------- helpers for the transport / home / kitchen sets ---------- */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const steel = mat("#B8BCC4", { metalness: 0.6, roughness: 0.35 });
const black = mat("#1B1B1B");
const white = mat("#F4F4F4");
const tintGlass = mat("#2C4A5E", { roughness: 0.15 });
const lampMat = mat("#FFF3B0", { emissive: "#FFF3B0", emissiveIntensity: 0.3 });

// A cylinder between two points: frames, forks, spouts, handles
function tube(g, a, b, r, m) {
  const p = V(...a);
  const q = V(...b);
  const dir = q.clone().sub(p);
  const o = add(g, G(THREE.CylinderGeometry, r, r, 1, 8), m, (p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2);
  o.scale.y = dir.length();
  o.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
  return o;
}
// Wheel with its axle along x
function wheel(g, x, y, z, r, w = 0.25) {
  Cyl(g, r, r, w, black, x, y, z).rotation.z = Math.PI / 2;
  Cyl(g, r * 0.45, r * 0.45, w + 0.02, steel, x, y, z).rotation.z = Math.PI / 2;
}
// Pointed-bow hull seen from above, extruded upward
const hullGeos = {};
function hull(g, w, d, bow, height, m) {
  const k = [w, d, bow, height].join();
  if (!hullGeos[k]) {
    const pts = [[0.05, 0.1], [w - 0.05, 0.1], [w - 0.05, d - bow], [w / 2, d - 0.02], [0.05, d - bow]];
    const s = new THREE.Shape();
    pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
    hullGeos[k] = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: false });
  }
  add(g, hullGeos[k], m, 0, 0, 0).rotation.x = -Math.PI / 2;
}

/* ---------- railway (plate-height pieces: h = 0.25 of a brick) ---------- */
const straightTrack = (len) => () => {
  const g = new THREE.Group();
  B(g, 2, 0.1, len - 0.04, mat("#7B7B7B"), 1, 0.05, len / 2);
  for (let z = 0.25; z < len; z += 0.5) B(g, 1.8, 0.08, 0.22, mat("#6B4426"), 1, 0.14, z);
  [0.4, 1.6].forEach((x) => B(g, 0.1, 0.12, len - 0.04, steel, x, 0.24, len / 2));
  return g;
};
reg("track2", "Track 2×2", 2, 2, 0.25, true, straightTrack(2));
reg("track4", "Track 2×4", 2, 4, 0.25, true, straightTrack(4));
// Quarter curve: enters at the z = 0 edge heading +z, leaves at the x = 4 edge heading +x
reg("curve", "Track curve", 4, 4, 0.25, true, () => {
  const g = new THREE.Group();
  const R = 3;
  const n = 14;
  for (let i = 0; i < n; i++) {
    const t = Math.PI - ((i + 0.5) * (Math.PI / 2)) / n;
    const yaw = Math.atan2(Math.cos(t), Math.sin(t));
    B(g, 0.22, 0.08, 1.8, mat("#6B4426"), 4 + R * Math.cos(t), 0.14, R * Math.sin(t)).rotation.y = yaw;
    [R - 0.6, R + 0.6].forEach((r) =>
      (B(g, r * (Math.PI / 2 / n) * 1.06, 0.12, 0.1, steel, 4 + r * Math.cos(t), 0.24, r * Math.sin(t)).rotation.y = yaw)
    );
  }
  return g;
});

/* ---------- trains: 2 wide, 6 long, front toward +z ---------- */
const trainWheels = (g, zs) => zs.forEach((z) => [0.15, 1.85].forEach((x) => wheel(g, x, 0.4, z, 0.4, 0.2)));
reg("loco", "Locomotive", 2, 6, 2, false, (c) => {
  const g = new THREE.Group();
  B(g, 1.7, 0.35, 5.8, black, 1, 0.55, 3); // chassis
  trainWheels(g, [1.0, 2.3, 3.6]);
  B(g, 1.7, 1.7, 1.6, mat(c), 1, 1.25, 0.9); // cab
  B(g, 1.74, 0.5, 0.8, tintGlass, 1, 1.6, 0.9);
  B(g, 1.9, 0.1, 1.9, black, 1, 2.15, 0.9);
  Cyl(g, 0.62, 0.62, 3.4, mat(shade(c, 0.8)), 1, 1.15, 3.4).rotation.x = Math.PI / 2; // boiler
  Cyl(g, 0.65, 0.65, 0.3, black, 1, 1.15, 5.0).rotation.x = Math.PI / 2;
  Cyl(g, 0.2, 0.15, 0.6, black, 1, 1.95, 4.7); // chimney
  Sph(g, 0.25, steel, 1, 1.8, 3.2);
  Sph(g, 0.14, lampMat, 1, 1.15, 5.2);
  B(g, 1.2, 0.3, 0.3, black, 1, 0.45, 5.7); // cow-catcher
  return g;
});
reg("coach", "Train coach", 2, 6, 2, false, (c) => {
  const g = new THREE.Group();
  B(g, 1.7, 0.3, 5.8, black, 1, 0.55, 3);
  trainWheels(g, [1.0, 5.0]);
  B(g, 1.9, 1.5, 5.8, mat(c), 1, 1.35, 3);
  for (let i = 0; i < 5; i++) B(g, 1.94, 0.55, 0.75, tintGlass, 1, 1.6, 0.95 + i * 1.02);
  B(g, 1.96, 0.1, 5.9, white, 1, 2.15, 3);
  B(g, 0.2, 0.2, 0.3, black, 1, 0.55, 0.05);
  B(g, 0.2, 0.2, 0.3, black, 1, 0.55, 5.95);
  return g;
});
reg("wagon", "Cargo wagon", 2, 6, 2, false, (c) => {
  const g = new THREE.Group();
  B(g, 1.7, 0.3, 5.8, black, 1, 0.55, 3);
  trainWheels(g, [1.0, 5.0]);
  const m = mat(c);
  B(g, 1.9, 0.15, 5.8, m, 1, 0.78, 3); // floor
  [0.1, 1.9].forEach((x) => B(g, 0.1, 0.8, 5.8, m, x, 1.2, 3));
  [0.1, 5.9].forEach((z) => B(g, 1.9, 0.8, 0.1, m, 1, 1.2, z));
  const coal = mat("#2A2A2A", { flatShading: true });
  [[0.6, 1.5], [1.4, 2.4], [0.7, 3.6], [1.3, 4.6]].forEach(([x, z]) => Ico(g, 0.5, coal, x, 1.1, z, 1, 0.6, 1, x * z));
  return g;
});

/* ---------- water (plate height; boats and ships can sit on top) ---------- */
const waterBody = (w, d, river) => () => {
  const g = new THREE.Group();
  const sand = mat("#D8C27A");
  const wat = mat("#3C9BD6", { transparent: true, opacity: 0.85, roughness: 0.1 });
  const t = 0.2;
  B(g, w - 0.04, 0.2, d - 0.04, sand, w / 2, 0.1, d / 2);
  B(g, w - 2 * t, 0.08, river ? d - 0.04 : d - 2 * t, wat, w / 2, 0.24, d / 2);
  [t / 2, w - t / 2].forEach((x) => B(g, t, 0.1, d - 0.04, sand, x, 0.25, d / 2));
  if (!river) [t / 2, d - t / 2].forEach((z) => B(g, w - 0.04, 0.1, t, sand, w / 2, 0.25, z));
  return g;
};
reg("pond", "Pond 2×2", 2, 2, 0.25, true, waterBody(2, 2));
reg("river", "River 2×4", 2, 4, 0.25, true, waterBody(2, 4, true));
reg("lake", "Lake 4×4", 4, 4, 0.25, true, waterBody(4, 4));
reg("sea", "Sea 8×8", 8, 8, 0.25, true, waterBody(8, 8));

/* ---------- boats and ship (bow toward +z) ---------- */
reg("motorboat", "Motor boat", 2, 4, 1, false, (c) => {
  const g = new THREE.Group();
  hull(g, 2, 4, 1.2, 0.5, mat(c));
  B(g, 1.2, 0.2, 0.5, white, 1, 0.6, 1.4);
  B(g, 1.2, 0.45, 0.05, tintGlass, 1, 0.85, 2.2);
  B(g, 0.3, 0.7, 0.25, black, 1, 0.45, 0.1);
  return g;
});
reg("sailboat", "Sailboat", 2, 4, 3, false, (c) => {
  const g = new THREE.Group();
  hull(g, 2, 4, 1.3, 0.45, mat(c));
  tube(g, [1, 0.4, 1.4], [1, 3.4, 1.4], 0.05, mat("#6B4426"));
  tube(g, [1, 0.8, 1.5], [1, 0.8, 3.3], 0.03, mat("#6B4426")); // boom
  add(g, prismGeo("sail", [[1.5, 0.85], [1.5, 3.3], [3.4, 0.85]], 0.04), white, 1.02, 0, 0).rotation.y = -Math.PI / 2;
  return g;
});
reg("ship", "Cargo ship", 4, 10, 3, false, (c) => {
  const g = new THREE.Group();
  hull(g, 4, 10, 2.6, 0.9, mat(c));
  B(g, 2.8, 1.1, 2.4, white, 2, 1.45, 2.2); // cabin
  B(g, 2.84, 0.35, 2.0, tintGlass, 2, 1.7, 2.2);
  B(g, 2.4, 0.7, 1.4, white, 2, 2.35, 2.7); // bridge
  B(g, 2.44, 0.3, 1.0, tintGlass, 2, 2.45, 2.8);
  Cyl(g, 0.35, 0.35, 0.9, mat("#D01012"), 2, 2.45, 1.3); // funnel
  Cyl(g, 0.36, 0.36, 0.2, black, 2, 2.85, 1.3);
  const cols = ["#0055BF", "#F2CD37", "#237841", "#FE8A18"];
  [[1.25, 4.8], [2.75, 4.8], [1.25, 6.4], [2.75, 6.4]].forEach(([x, z], i) => {
    B(g, 1.3, 0.7, 1.5, mat(cols[i]), x, 1.25, z);
    if (i % 3 === 0) B(g, 1.3, 0.7, 1.5, mat(cols[(i + 2) % 4]), x, 1.95, z);
  });
  tube(g, [2, 0.9, 9.0], [2, 2.3, 9.0], 0.05, black);
  return g;
});

/* ---------- two-wheelers (front toward +z) ---------- */
reg("bicycle", "Bicycle", 1, 4, 2, false, (c) => {
  const g = new THREE.Group();
  const frame = mat(c);
  [0.8, 3.2].forEach((z) => {
    add(g, G(THREE.TorusGeometry, 0.62, 0.06, 8, 24), black, 0.5, 0.7, z).rotation.y = Math.PI / 2;
    Cyl(g, 0.06, 0.06, 0.12, steel, 0.5, 0.7, z).rotation.z = Math.PI / 2;
  });
  const R = [0.5, 0.7, 0.8], F = [0.5, 0.7, 3.2], Bb = [0.5, 0.5, 1.7], S = [0.5, 1.45, 1.5], H = [0.5, 1.45, 2.8];
  [[R, Bb], [Bb, S], [S, R], [S, H], [Bb, H], [H, F]].forEach(([a, b]) => tube(g, a, b, 0.04, frame));
  tube(g, H, [0.5, 1.75, 2.85], 0.035, steel);
  B(g, 0.55, 0.05, 0.05, black, 0.5, 1.75, 2.85); // handlebar
  B(g, 0.14, 0.06, 0.34, black, 0.5, 1.5, 1.4); // saddle
  B(g, 0.3, 0.04, 0.1, black, 0.5, 0.5, 1.7);
  return g;
});
reg("kick", "Kick scooter", 1, 3, 2, false, (c) => {
  const g = new THREE.Group();
  B(g, 0.4, 0.1, 1.8, mat(c), 0.5, 0.32, 1.1);
  wheel(g, 0.5, 0.3, 0.2, 0.3, 0.14);
  wheel(g, 0.5, 0.3, 2.7, 0.3, 0.14);
  tube(g, [0.5, 0.3, 2.7], [0.5, 2.2, 2.4], 0.045, steel);
  B(g, 0.75, 0.07, 0.07, black, 0.5, 2.2, 2.4);
  return g;
});
reg("scooter", "Scooter", 1, 4, 2, false, (c) => {
  const g = new THREE.Group();
  const body = mat(c);
  wheel(g, 0.5, 0.35, 0.6, 0.35, 0.2);
  wheel(g, 0.5, 0.35, 3.45, 0.35, 0.2);
  B(g, 0.75, 0.8, 1.2, body, 0.5, 0.8, 0.95); // rear body
  B(g, 0.6, 0.12, 1.0, black, 0.5, 1.26, 0.95); // seat
  B(g, 0.65, 0.15, 1.5, body, 0.5, 0.5, 2.2); // floorboard
  B(g, 0.7, 0.9, 0.12, body, 0.5, 1.0, 2.95); // leg shield
  tube(g, [0.5, 1.5, 2.85], [0.5, 0.35, 3.45], 0.04, steel);
  B(g, 0.8, 0.06, 0.06, black, 0.5, 1.6, 2.8);
  Sph(g, 0.12, lampMat, 0.5, 1.4, 3.0);
  return g;
});
reg("motorbike", "Motorbike", 1, 4, 2, false, (c) => {
  const g = new THREE.Group();
  wheel(g, 0.5, 0.5, 0.6, 0.5, 0.22);
  wheel(g, 0.5, 0.5, 3.4, 0.5, 0.22);
  B(g, 0.4, 0.4, 1.0, mat(c), 0.5, 1.2, 1.9); // tank
  B(g, 0.45, 0.5, 0.7, mat("#444"), 0.5, 0.7, 1.7); // engine
  B(g, 0.4, 0.12, 1.0, black, 0.5, 1.1, 1.0); // seat
  tube(g, [0.5, 1.35, 2.9], [0.5, 0.5, 3.4], 0.05, steel);
  tube(g, [0.5, 0.6, 1.5], [0.5, 0.5, 0.6], 0.05, steel);
  tube(g, [0.65, 0.4, 1.6], [0.65, 0.45, 0.3], 0.07, steel); // exhaust
  B(g, 0.8, 0.06, 0.06, black, 0.5, 1.5, 2.95);
  Sph(g, 0.14, lampMat, 0.5, 1.3, 3.15);
  B(g, 0.2, 0.1, 0.05, mat("#D01012"), 0.5, 1.1, 0.45);
  return g;
});

/* ---------- home: bulb, TV, fridge, oven ---------- */
reg("bulb", "Light bulb", 1, 1, 2, false, (c) => {
  const g = new THREE.Group();
  const glassM = mat(c, { emissive: c, emissiveIntensity: 0.7, transparent: true, opacity: 0.85, roughness: 0.1 });
  Cyl(g, 0.2, 0.2, 0.45, steel, 0.5, 0.225, 0.5);
  [0.12, 0.28].forEach((y) => Cyl(g, 0.21, 0.21, 0.05, black, 0.5, y, 0.5));
  Cyl(g, 0.22, 0.3, 0.3, glassM, 0.5, 0.6, 0.5);
  Sph(g, 0.4, glassM, 0.5, 0.95, 0.5);
  tube(g, [0.45, 0.6, 0.5], [0.45, 0.9, 0.5], 0.015, black);
  tube(g, [0.55, 0.6, 0.5], [0.55, 0.9, 0.5], 0.015, black);
  B(g, 0.12, 0.02, 0.02, black, 0.5, 0.9, 0.5);
  return g;
});
reg("tv", "TV", 3, 1, 2, false, (c) => {
  const g = new THREE.Group();
  const screen = mat("#4FB3E8", { emissive: "#4FB3E8", emissiveIntensity: 0.45, roughness: 0.2 });
  B(g, 1.2, 0.08, 0.6, black, 1.5, 0.04, 0.5);
  B(g, 0.2, 0.4, 0.12, black, 1.5, 0.28, 0.5);
  B(g, 2.8, 1.5, 0.12, black, 1.5, 1.2, 0.5);
  B(g, 2.6, 1.3, 0.02, screen, 1.5, 1.2, 0.57);
  B(g, 2.8, 0.1, 0.13, mat(c), 1.5, 0.55, 0.5);
  return g;
});
reg("fridge", "Fridge", 2, 2, 3, true, (c) => {
  const g = new THREE.Group();
  B(g, 1.8, 3.58, 1.7, mat(c), 1, 1.79, 1);
  B(g, 1.82, 0.04, 0.03, black, 1, 2.4, 1.86); // freezer seam
  B(g, 0.07, 0.8, 0.1, steel, 1.55, 2.9, 1.9);
  B(g, 0.07, 1.0, 0.1, steel, 1.55, 1.5, 1.9);
  return g;
});
reg("oven", "Oven", 2, 2, 2, true, (c) => {
  const g = new THREE.Group();
  const glow = mat("#2B1A10", { emissive: "#FF6A00", emissiveIntensity: 0.25 });
  B(g, 1.84, 2.38, 1.7, mat(c), 1, 1.19, 1);
  B(g, 1.84, 0.06, 1.7, black, 1, 2.41, 1);
  [[0.55, 0.55], [1.45, 0.55], [0.55, 1.45], [1.45, 1.45]].forEach(([x, z]) => {
    Cyl(g, 0.28, 0.28, 0.03, mat("#222"), x, 2.46, z);
    Cyl(g, 0.1, 0.1, 0.04, steel, x, 2.47, z);
  });
  B(g, 1.3, 0.9, 0.06, glow, 1, 1.0, 1.87); // oven window
  B(g, 1.4, 0.07, 0.1, steel, 1, 1.75, 1.93);
  B(g, 1.84, 0.35, 0.05, black, 1, 2.1, 1.86);
  [0.4, 0.8, 1.2, 1.6].forEach((x) => (Cyl(g, 0.07, 0.07, 0.08, steel, x, 2.1, 1.92).rotation.x = Math.PI / 2));
  return g;
});

/* ---------- cooking utensils (each 1×1) ---------- */
reg("pan", "Frying pan", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  Cyl(g, 0.38, 0.3, 0.2, mat("#3A3D42", { metalness: 0.4 }), 0.38, 0.1, 0.5);
  Cyl(g, 0.33, 0.33, 0.02, mat("#1E1F22"), 0.38, 0.2, 0.5);
  B(g, 0.4, 0.06, 0.1, mat(c), 0.85, 0.16, 0.5);
  return g;
});
reg("cookpot", "Cooking pot", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  Cyl(g, 0.4, 0.4, 0.5, steel, 0.5, 0.25, 0.5);
  Cyl(g, 0.42, 0.42, 0.05, steel, 0.5, 0.53, 0.5); // lid
  Sph(g, 0.07, mat(c), 0.5, 0.6, 0.5);
  [0.06, 0.94].forEach((x) => B(g, 0.14, 0.06, 0.1, mat(c), x, 0.4, 0.5));
  return g;
});
reg("kettle", "Kettle", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  Cyl(g, 0.3, 0.38, 0.55, mat(c, { metalness: 0.3 }), 0.5, 0.3, 0.5);
  Cyl(g, 0.2, 0.3, 0.1, steel, 0.5, 0.62, 0.5);
  tube(g, [0.72, 0.4, 0.5], [0.93, 0.65, 0.5], 0.04, steel); // spout
  add(g, G(THREE.TorusGeometry, 0.2, 0.03, 8, 16, Math.PI), black, 0.5, 0.62, 0.5);
  return g;
});
reg("utensils", "Utensils", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  Cyl(g, 0.28, 0.25, 0.5, mat(c), 0.5, 0.25, 0.5);
  tube(g, [0.4, 0.3, 0.5], [0.3, 1.15, 0.5], 0.03, steel); // spoon
  Sph(g, 0.1, steel, 0.3, 1.2, 0.5).scale.set(1, 1.3, 0.4);
  tube(g, [0.5, 0.3, 0.45], [0.62, 1.1, 0.45], 0.03, steel); // ladle
  Sph(g, 0.13, steel, 0.62, 1.15, 0.45).scale.set(1, 0.6, 1);
  tube(g, [0.58, 0.3, 0.58], [0.7, 1.0, 0.6], 0.03, black); // spatula
  B(g, 0.16, 0.22, 0.03, black, 0.7, 1.1, 0.6);
  return g;
});

/* ---------- wooden logs ---------- */
const barkMat = mat("#6B4426");
const woodLight = mat("#D9B382");
const woodRing = mat("#B88A55");
// A log lying along z, starting at z. k stretches its height (cabin logs are slightly oval).
function logZ(g, r, len, x, y, z, k = 1) {
  const put = (o) => {
    o.rotation.x = Math.PI / 2;
    o.scale.z = k;
  };
  put(Cyl(g, r, r, len, barkMat, x, y, z + len / 2));
  for (const zz of [z - 0.006, z + len + 0.006]) {
    put(Cyl(g, r * 0.96, r * 0.96, 0.02, woodLight, x, y, zz)); // cut end
    put(Cyl(g, r * 0.5, r * 0.5, 0.024, woodRing, x, y, zz)); // growth ring
  }
}
// Log-cabin logs: stud-topped so other pieces can be built on them
[2, 4].forEach((len) =>
  reg(`log${len}`, `Log 1×${len}`, 1, len, 1, true, () => {
    const g = new THREE.Group();
    logZ(g, 0.48, len - 0.1, 0.5, 0.575, 0.05, 1.2);
    for (let z = 0; z < len; z++) add(g, studGeo, barkMat, 0.5, 1.15 + SH / 2, z + 0.5);
    return g;
  })
);
reg("logpile", "Log pile", 2, 4, 2, false, () => {
  const g = new THREE.Group();
  [[0.34, 0.33], [1.0, 0.33], [1.66, 0.33], [0.67, 0.9], [1.33, 0.9], [1.0, 1.47]].forEach(([x, y], i) =>
    logZ(g, 0.33, 3.7 + (i % 3) * 0.1, x, y, 0.05 + (i % 2) * 0.1)
  );
  return g;
});
reg("firewood", "Firewood", 2, 2, 1, false, () => {
  const g = new THREE.Group();
  [[4, 0.34, 0.21], [3, 0.56, 0.59], [2, 0.78, 0.97]].forEach(([n, x0, y]) => {
    for (let i = 0; i < n; i++) logZ(g, 0.21, 1.75 + (i % 2) * 0.15, x0 + i * 0.44, y, 0.05);
  });
  return g;
});
reg("stump", "Tree stump", 1, 1, 1, false, () => {
  const g = new THREE.Group();
  Cyl(g, 0.36, 0.44, 0.6, barkMat, 0.5, 0.3, 0.5);
  Cyl(g, 0.36, 0.36, 0.02, woodLight, 0.5, 0.61, 0.5);
  Cyl(g, 0.2, 0.2, 0.024, woodRing, 0.5, 0.612, 0.5);
  Cyl(g, 0.08, 0.08, 0.028, woodLight, 0.5, 0.614, 0.5);
  [0.4, 2.5, 4.4].forEach((a) => (B(g, 0.28, 0.12, 0.12, barkMat, 0.5 + Math.cos(a) * 0.4, 0.06, 0.5 + Math.sin(a) * 0.4).rotation.y = -a));
  return g;
});

/* ---------- furniture (front toward +z; upholstery takes your chosen color) ---------- */
const wood = mat("#A8743C");
const legsAt = (g, w, d, h, t, m, inset = 0.15) =>
  [inset, w - inset].forEach((x) => [inset, d - inset].forEach((z) => B(g, t, h, t, m, x, h / 2, z)));

reg("stool", "Stool", 1, 1, 1, true, (c) => {
  const g = new THREE.Group();
  Cyl(g, 0.42, 0.42, 0.14, mat(c), 0.5, 1.13, 0.5);
  legsAt(g, 1, 1, 1.06, 0.1, wood, 0.25);
  return g;
});
reg("chair", "Chair", 1, 1, 2, false, (c) => {
  const g = new THREE.Group();
  legsAt(g, 1, 1, 0.7, 0.1, wood, 0.15);
  B(g, 0.8, 0.1, 0.8, mat(c), 0.5, 0.75, 0.5);
  B(g, 0.8, 0.75, 0.08, mat(c), 0.5, 1.2, 0.14);
  return g;
});
reg("armchair", "Armchair", 2, 2, 2, false, (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  legsAt(g, 2, 2, 0.15, 0.12, wood, 0.15);
  B(g, 1.9, 0.6, 1.8, m, 1, 0.45, 1);
  B(g, 1.2, 0.25, 1.3, mat(shade(c, 1.15)), 1, 0.88, 1.2);
  B(g, 1.9, 1.1, 0.5, m, 1, 1.15, 0.4);
  [0.2, 1.8].forEach((x) => B(g, 0.35, 0.75, 1.5, m, x, 0.95, 1.15));
  return g;
});
reg("sofa", "Sofa 4×2", 4, 2, 2, false, (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  legsAt(g, 4, 2, 0.15, 0.12, wood, 0.15);
  B(g, 3.9, 0.6, 1.8, m, 2, 0.45, 1);
  B(g, 3.9, 1.1, 0.5, m, 2, 1.15, 0.4);
  [0.2, 3.8].forEach((x) => B(g, 0.4, 0.8, 1.55, m, x, 0.95, 1.12));
  [1.2, 2.8].forEach((x) => B(g, 1.5, 0.25, 1.3, mat(shade(c, 1.15)), x, 0.88, 1.2));
  return g;
});
const table = (w, d) => () => {
  const g = new THREE.Group();
  B(g, w - 0.04, 0.15, d - 0.04, wood, w / 2, 1.125, d / 2);
  legsAt(g, w, d, 1.05, 0.16, mat("#6B4426"), 0.18);
  return g;
};
reg("table2", "Table 2×2", 2, 2, 1, true, table(2, 2));
reg("table4", "Table 4×2", 4, 2, 1, true, table(4, 2));
reg("dresser", "Dresser", 3, 2, 2, true, (c) => {
  const g = new THREE.Group();
  B(g, 2.9, 2.38, 1.8, wood, 1.5, 1.19, 1);
  [0.55, 1.15, 1.75].forEach((y) =>
    [0.55, 1.5, 2.45].forEach((x) => {
      B(g, 0.85, 0.5, 0.04, mat(c), x, y, 1.91);
      Sph(g, 0.05, steel, x, y, 1.96);
    })
  );
  return g;
});
reg("wardrobe", "Wardrobe", 3, 2, 3, true, (c) => {
  const g = new THREE.Group();
  B(g, 2.9, 3.58, 1.8, wood, 1.5, 1.79, 1);
  [0.8, 2.2].forEach((x) => B(g, 1.35, 3.3, 0.04, mat(c), x, 1.8, 1.91));
  [1.4, 1.6].forEach((x) => B(g, 0.05, 0.6, 0.06, steel, x, 1.8, 1.95));
  return g;
});
reg("bookshelf", "Bookshelf", 3, 1, 3, true, (c) => {
  const g = new THREE.Group();
  const cols = ["#D01012", "#0055BF", "#F2CD37", "#237841", "#FE8A18", c];
  [0.05, 2.95].forEach((x) => B(g, 0.1, 3.58, 0.9, wood, x, 1.79, 0.5));
  B(g, 2.9, 3.58, 0.05, wood, 1.5, 1.79, 0.08);
  [0.05, 1.2, 2.4, 3.53].forEach((y) => B(g, 2.9, 0.1, 0.9, wood, 1.5, y, 0.5));
  [0.1, 1.25, 2.45].forEach((base, row) => {
    let x = 0.15;
    for (let i = 0; x < 2.75; i++) {
      const bw = 0.14 + ((i * 7 + row) % 3) * 0.05;
      const bh = 0.6 + ((i * 5 + row) % 4) * 0.1;
      B(g, bw - 0.01, bh, 0.5, mat(cols[(i + row) % cols.length]), x + bw / 2, base + bh / 2, 0.5);
      x += bw;
    }
  });
  return g;
});
// Beds in several sizes (head at the back, foot toward +z). The blanket takes your chosen color.
const bedBuilder = (w, d, o = {}) => (c) => {
  const g = new THREE.Group();
  const hb = o.low ? 0.9 : 1.3; // headboard height
  B(g, w - 0.1, 0.5, d - 0.1, wood, w / 2, 0.45, d / 2); // frame
  B(g, w - 0.3, 0.35, d - 0.5, white, w / 2, 0.88, d / 2 + 0.05); // mattress
  const bl = (d - 0.5) * 0.68;
  B(g, w - 0.28, 0.15, bl, mat(c), w / 2, 1.1, d - 0.2 - bl / 2); // blanket
  const n = Math.max(1, Math.round((w - 0.4) / 1.1));
  const slot = (w - 0.5) / n;
  for (let i = 0; i < n; i++) B(g, slot - 0.15, 0.2, 0.7, white, 0.25 + slot * (i + 0.5), 1.15, 0.7); // pillows
  B(g, w - 0.1, hb, 0.15, wood, w / 2, 0.35 + hb / 2, 0.1);
  if (o.padded) B(g, w - 0.5, 0.7, 0.1, mat(shade(c, 0.85)), w / 2, 1.25, 0.22);
  B(g, w - 0.1, o.low ? 0.4 : 0.6, 0.12, wood, w / 2, o.low ? 0.65 : 0.75, d - 0.1); // footboard
  if (o.rail) {
    B(g, 0.06, 0.08, d - 0.7, wood, 0.08, 1.4, d / 2 + 0.1); // safety rail on one side
    for (let z = 0.9; z < d - 0.6; z += 0.5) B(g, 0.04, 0.5, 0.04, wood, 0.08, 1.15, z);
  }
  return g;
};
reg("bedsingle", "Single bed 2×4", 2, 4, 2, false, bedBuilder(2, 4));
reg("bedkids", "Kids bed 2×3", 2, 3, 2, false, bedBuilder(2, 3, { low: true, rail: true }));
reg("bed", "Bed 3×5", 3, 5, 2, false, bedBuilder(3, 5));
reg("beddouble", "Double bed 4×5", 4, 5, 2, false, bedBuilder(4, 5));
reg("bedking", "King bed 5×6", 5, 6, 2, false, bedBuilder(5, 6, { padded: true }));
reg("bunk", "Bunk bed 2×5", 2, 5, 3, false, (c) => {
  const g = new THREE.Group();
  const blanket = mat(c);
  [0.1, 1.9].forEach((x) => [0.1, 3.9].forEach((z) => B(g, 0.12, 3.2, 0.12, wood, x, 1.6, z))); // posts
  [[0.45, 0.75], [2.1, 2.4]].forEach(([fy, my]) => {
    B(g, 1.9, 0.3, 3.9, wood, 1, fy, 2);
    B(g, 1.7, 0.3, 3.5, white, 1, my, 2);
    B(g, 1.72, 0.12, 2.2, blanket, 1, my + 0.2, 2.8);
  });
  [0.7, 1.3].forEach((x) => B(g, 0.5, 0.18, 0.5, white, x, 2.65, 0.6)); // top pillows
  [0.9, 1.5].forEach((x) => B(g, 0.5, 0.18, 0.5, white, x, 1.0, 0.6)); // bottom pillow
  [0.1, 1.9].forEach((x) => B(g, 0.06, 0.5, 3.7, wood, x, 2.85, 2)); // top guard rails
  [0.55, 1.35].forEach((x) => tube(g, [x, 0, 4.4], [x, 2.7, 4.4], 0.04, wood)); // ladder
  for (let y = 0.4; y < 2.6; y += 0.4) B(g, 0.8, 0.05, 0.06, wood, 0.95, y, 4.4);
  return g;
});
reg("crib", "Baby crib 2×3", 2, 3, 2, false, (c) => {
  const g = new THREE.Group();
  B(g, 1.9, 0.12, 2.9, wood, 1, 0.5, 1.5);
  B(g, 1.7, 0.2, 2.6, white, 1, 0.66, 1.5);
  B(g, 1.7, 0.1, 1.2, mat(c), 1, 0.82, 2.2);
  [0.08, 1.92].forEach((x) => {
    for (let z = 0.2; z < 2.95; z += 0.25) B(g, 0.04, 0.9, 0.04, wood, x, 1.1, z);
    B(g, 0.06, 0.06, 2.9, wood, x, 1.55, 1.5);
  });
  [0.08, 2.92].forEach((z) => B(g, 1.9, 1.1, 0.08, wood, 1, 1.05, z));
  [[0.1, 0.1], [1.9, 0.1], [0.1, 2.9], [1.9, 2.9]].forEach(([x, z]) => B(g, 0.12, 0.6, 0.12, wood, x, 0.3, z));
  return g;
});
reg("floorlamp", "Floor lamp", 1, 1, 3, false, (c) => {
  const g = new THREE.Group();
  const shadeM = mat(c, { emissive: c, emissiveIntensity: 0.5, transparent: true, opacity: 0.9 });
  Cyl(g, 0.3, 0.3, 0.06, black, 0.5, 0.03, 0.5);
  Cyl(g, 0.03, 0.03, 2.6, steel, 0.5, 1.35, 0.5);
  Cyl(g, 0.22, 0.38, 0.6, shadeM, 0.5, 2.9, 0.5);
  return g;
});

/* ---------- bathroom, gas stove, washer, sink, AC, open door and window ---------- */
const porcelain = mat("#F4F4F4", { roughness: 0.25 });
const waterMat = mat("#7EC8E8", { transparent: true, opacity: 0.7, roughness: 0.1 });
const brass = mat("#E3B23C", { metalness: 0.5 });
const lit = (c) => mat(c, { emissive: c, emissiveIntensity: 0.8 });
const flat = (o) => ((o.rotation.x = Math.PI / 2), o); // turn a cylinder so its axis points along z
const ring = (g, r, t, m, x, y, z) => add(g, G(THREE.TorusGeometry, r, t, 8, 28), m, x, y, z); // faces +z

// Toilet: tank at the back, bowl at the front (+z)
reg("toilet", "Toilet", 1, 2, 2, false, () => {
  const g = new THREE.Group();
  Cyl(g, 0.26, 0.3, 0.3, porcelain, 0.5, 0.15, 1.2);
  Cyl(g, 0.4, 0.3, 0.6, porcelain, 0.5, 0.55, 1.25).scale.z = 1.3;
  Cyl(g, 0.42, 0.42, 0.07, mat("#E6E6E6"), 0.5, 0.88, 1.25).scale.z = 1.3; // seat
  Cyl(g, 0.28, 0.28, 0.075, waterMat, 0.5, 0.885, 1.28).scale.z = 1.3;
  B(g, 0.8, 0.95, 0.4, porcelain, 0.5, 1.2, 0.3); // tank
  B(g, 0.86, 0.07, 0.46, porcelain, 0.5, 1.72, 0.3);
  Cyl(g, 0.07, 0.07, 0.05, steel, 0.5, 1.77, 0.3); // flush button
  return g;
});
reg("bathtub", "Bathtub", 2, 4, 2, false, () => {
  const g = new THREE.Group();
  [0.1, 1.9].forEach((x) => B(g, 0.2, 1, 3.9, porcelain, x, 0.6, 2));
  [0.1, 3.9].forEach((z) => B(g, 1.7, 1, 0.2, porcelain, 1, 0.6, z));
  B(g, 1.7, 0.2, 3.5, porcelain, 1, 0.2, 2);
  B(g, 1.64, 0.05, 3.44, waterMat, 1, 0.78, 2);
  [[0.2, 0.2], [1.8, 0.2], [0.2, 3.8], [1.8, 3.8]].forEach(([x, z]) => Cyl(g, 0.1, 0.1, 0.1, steel, x, 0.05, z));
  tube(g, [1, 1.1, 0.3], [1, 1.5, 0.3], 0.04, steel); // faucet
  tube(g, [1, 1.5, 0.3], [1, 1.4, 0.75], 0.04, steel);
  [0.7, 1.3].forEach((x) => Sph(g, 0.07, steel, x, 1.2, 0.15));
  return g;
});
reg("shower", "Shower", 2, 2, 3, false, () => {
  const g = new THREE.Group();
  const tile = mat("#BFE3F2");
  B(g, 1.9, 0.15, 1.9, porcelain, 1, 0.075, 1); // tray
  Cyl(g, 0.1, 0.1, 0.02, steel, 1, 0.16, 1);
  B(g, 1.9, 2.9, 0.05, tile, 1, 1.55, 0.05); // back and left walls
  B(g, 0.05, 2.9, 1.9, tile, 0.05, 1.55, 1);
  B(g, 1.9, 2.9, 0.04, glass(), 1, 1.55, 1.95); // glass front and right
  B(g, 0.04, 2.9, 1.9, glass(), 1.95, 1.55, 1);
  B(g, 0.06, 2.95, 0.06, steel, 1.95, 1.55, 1.95);
  tube(g, [0.35, 0.3, 0.12], [0.35, 2.6, 0.12], 0.03, steel);
  tube(g, [0.35, 2.6, 0.12], [0.35, 2.6, 0.6], 0.03, steel);
  Cyl(g, 0.07, 0.24, 0.1, steel, 0.35, 2.55, 0.6); // shower head
  Sph(g, 0.07, steel, 0.35, 1.4, 0.1);
  return g;
});
reg("basin", "Wash basin", 1, 1, 2, false, () => {
  const g = new THREE.Group();
  Cyl(g, 0.16, 0.2, 0.85, porcelain, 0.5, 0.425, 0.5); // pedestal
  Cyl(g, 0.46, 0.28, 0.3, porcelain, 0.5, 1.0, 0.5);
  Cyl(g, 0.36, 0.36, 0.02, mat("#CFE8F2"), 0.5, 1.16, 0.5);
  B(g, 0.9, 0.3, 0.1, porcelain, 0.5, 1.3, 0.1);
  Cyl(g, 0.03, 0.03, 0.3, steel, 0.5, 1.45, 0.2);
  tube(g, [0.5, 1.6, 0.2], [0.5, 1.5, 0.45], 0.03, steel);
  [0.3, 0.7].forEach((x) => Sph(g, 0.05, steel, x, 1.22, 0.2));
  return g;
});
reg("towels", "Towel rack", 2, 1, 2, false, (c) => {
  const g = new THREE.Group();
  [0.1, 1.9].forEach((x) => {
    tube(g, [x, 0, 0.5], [x, 1.75, 0.5], 0.03, steel);
    B(g, 0.25, 0.05, 0.7, steel, x, 0.025, 0.5);
  });
  tube(g, [0.1, 1.7, 0.5], [1.9, 1.7, 0.5], 0.03, steel);
  tube(g, [0.1, 1.1, 0.5], [1.9, 1.1, 0.5], 0.03, steel);
  B(g, 0.9, 1.1, 0.12, mat(c), 0.65, 1.15, 0.5); // towels
  B(g, 0.7, 0.8, 0.12, white, 1.5, 1.3, 0.5);
  return g;
});
reg("mirror", "Standing mirror", 2, 1, 3, false, () => {
  const g = new THREE.Group();
  B(g, 1.9, 3.5, 0.1, wood, 1, 1.85, 0.5);
  B(g, 1.7, 3.3, 0.04, mat("#CFE8F2", { metalness: 0.9, roughness: 0.05 }), 1, 1.85, 0.55);
  [0.2, 1.8].forEach((x) => B(g, 0.15, 0.1, 0.8, wood, x, 0.05, 0.5));
  return g;
});

// Gas stove: four burners with cast-iron grates and blue flames, oven below
reg("gasstove", "Gas stove", 2, 2, 2, true, (c) => {
  const g = new THREE.Group();
  const flame = lit("#4DA3FF");
  B(g, 1.84, 2.38, 1.7, mat(c), 1, 1.19, 1);
  B(g, 1.84, 0.05, 1.7, black, 1, 2.405, 1);
  [[0.55, 0.55], [1.45, 0.55], [0.55, 1.45], [1.45, 1.45]].forEach(([x, z], i) => {
    Cyl(g, 0.24, 0.24, 0.05, black, x, 2.45, z);
    Cyl(g, 0.12, 0.12, 0.06, steel, x, 2.46, z);
    if (i % 3 === 0) flat(add(g, G(THREE.TorusGeometry, 0.18, 0.025, 6, 18), flame, x, 2.5, z)).rotation.x = Math.PI / 2;
    B(g, 0.7, 0.05, 0.06, black, x, 2.56, z); // grate
    B(g, 0.06, 0.05, 0.7, black, x, 2.56, z);
  });
  B(g, 1.3, 0.9, 0.06, mat("#2B2B2B"), 1, 1.0, 1.87);
  B(g, 1.4, 0.07, 0.1, steel, 1, 1.75, 1.93);
  B(g, 1.84, 0.35, 0.05, black, 1, 2.1, 1.86);
  [0.4, 0.8, 1.2, 1.6].forEach((x) => (Cyl(g, 0.07, 0.07, 0.08, steel, x, 2.1, 1.92).rotation.x = Math.PI / 2));
  return g;
});
reg("gascyl", "Gas cylinder", 1, 1, 2, false, (c) => {
  const g = new THREE.Group();
  const body = mat(c, { roughness: 0.4 });
  Cyl(g, 0.4, 0.4, 0.08, mat("#444"), 0.5, 0.04, 0.5);
  Cyl(g, 0.38, 0.38, 1.3, body, 0.5, 0.7, 0.5);
  add(g, G(THREE.SphereGeometry, 0.38, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), body, 0.5, 1.35, 0.5);
  Cyl(g, 0.1, 0.1, 0.2, steel, 0.5, 1.8, 0.5); // valve
  Cyl(g, 0.07, 0.07, 0.08, black, 0.5, 1.95, 0.5);
  add(g, G(THREE.TorusGeometry, 0.24, 0.025, 6, 16), steel, 0.5, 1.85, 0.5).rotation.x = Math.PI / 2; // guard ring
  return g;
});
reg("sink", "Wash sink", 3, 2, 1, false, (c) => {
  const g = new THREE.Group();
  B(g, 2.9, 1.05, 1.8, wood, 1.5, 0.525, 1);
  [0.8, 2.2].forEach((x) => B(g, 1.3, 0.85, 0.04, mat(c), x, 0.55, 1.91)); // cabinet doors
  [1.3, 1.7].forEach((x) => B(g, 0.05, 0.25, 0.05, steel, x, 0.85, 1.95));
  B(g, 2.94, 0.15, 1.84, mat("#CFCFD4"), 1.5, 1.125, 1); // counter
  B(g, 1.3, 0.03, 0.9, steel, 1, 1.205, 1.1); // basin
  B(g, 1.1, 0.035, 0.7, mat("#8C959F", { metalness: 0.5 }), 1, 1.21, 1.1);
  Cyl(g, 0.07, 0.07, 0.04, black, 1, 1.23, 1.1);
  for (let z = 0.6; z < 1.7; z += 0.2) B(g, 0.9, 0.02, 0.06, steel, 2.2, 1.205, z); // drainer
  tube(g, [1, 1.2, 0.35], [1, 1.75, 0.35], 0.04, steel);
  tube(g, [1, 1.75, 0.35], [1, 1.7, 0.8], 0.04, steel);
  [0.75, 1.25].forEach((x) => B(g, 0.1, 0.12, 0.1, steel, x, 1.25, 0.35));
  return g;
});

// Front-loading washing machine
reg("washer", "Washing machine", 2, 2, 2, true, (c) => {
  const g = new THREE.Group();
  B(g, 1.84, 2.38, 1.7, mat(c), 1, 1.19, 1);
  B(g, 1.84, 0.4, 0.05, black, 1, 2.1, 1.86);
  flat(Cyl(g, 0.62, 0.62, 0.12, steel, 1, 1.15, 1.9));
  flat(Cyl(g, 0.5, 0.5, 0.14, tintGlass, 1, 1.15, 1.92));
  Sph(g, 0.2, mat("#FE8A18"), 0.95, 1.1, 1.97).scale.set(1, 1, 0.4); // laundry
  flat(Cyl(g, 0.2, 0.2, 0.08, steel, 1.45, 2.1, 1.9));
  B(g, 0.5, 0.18, 0.03, lit("#38E07B"), 0.5, 2.1, 1.89); // display
  [0.85, 1.05].forEach((x) => B(g, 0.12, 0.1, 0.03, white, x, 2.1, 1.89));
  return g;
});

// Air conditioner: wall-mounted indoor unit (stack it on a wall) and outdoor unit
reg("ac", "Air conditioner", 3, 1, 1, false, () => {
  const g = new THREE.Group();
  B(g, 2.9, 0.95, 0.85, white, 1.5, 0.65, 0.5);
  B(g, 2.8, 0.02, 0.02, mat("#D5DADF"), 1.5, 0.55, 0.93);
  for (let i = 0; i < 8; i++) B(g, 0.2, 0.02, 0.5, mat("#C3C9CF"), 0.35 + i * 0.33, 1.13, 0.5); // top vents
  B(g, 2.6, 0.06, 0.5, mat("#CED4DA"), 1.5, 0.2, 0.8).rotation.x = 0.35; // louver
  B(g, 0.3, 0.1, 0.03, lit("#4DA3FF"), 2.5, 0.75, 0.93);
  return g;
});
reg("acout", "AC outdoor unit", 2, 1, 2, false, () => {
  const g = new THREE.Group();
  B(g, 1.9, 1.7, 0.9, mat("#E9ECEF"), 1, 0.95, 0.5);
  [0.3, 1.7].forEach((x) => B(g, 0.2, 0.1, 0.8, black, x, 0.05, 0.5));
  flat(Cyl(g, 0.72, 0.72, 0.04, mat("#555555"), 1, 0.95, 0.96));
  [0.2, 0.4, 0.6].forEach((r) => ring(g, r, 0.018, steel, 1, 0.95, 0.985));
  for (let k = 0; k < 4; k++) B(g, 1.4, 0.03, 0.03, steel, 1, 0.95, 0.985).rotation.z = (k * Math.PI) / 4;
  flat(Cyl(g, 0.08, 0.08, 0.06, steel, 1, 0.95, 0.99));
  B(g, 0.03, 1.3, 0.5, mat("#C3C9CF"), 1.93, 0.95, 0.5);
  return g;
});

// Door standing open (hinged on the left, swung toward the front)
reg("dooropen", "Open door", 2, 2, 3, true, (c) => {
  const g = new THREE.Group();
  const frame = mat(shade(c, 0.6));
  B(g, 0.25, 3.6, 0.96, frame, 0.125, 1.8, 0.5);
  B(g, 0.25, 3.6, 0.96, frame, 1.875, 1.8, 0.5);
  B(g, 2, 0.3, 0.96, frame, 1, 3.45, 0.5);
  B(g, 1.5, 0.05, 0.96, mat("#8A8D91"), 1, 0.025, 0.5); // threshold
  studs(g, 2, 1, 3.6, frame);
  const leaf = new THREE.Group();
  leaf.position.set(0.25, 0, 0.5);
  leaf.rotation.y = -1.05;
  g.add(leaf);
  B(leaf, 1.5, 3.3, 0.5, mat(c), 0.75, 1.65, 0);
  [0.28, -0.28].forEach((z) => Sph(leaf, 0.09, brass, 1.35, 1.6, z));
  return g;
});
// Window with both casement sashes swung open
reg("windowopen", "Open window", 2, 2, 2, true, (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  B(g, 0.25, 2.4, 0.96, m, 0.125, 1.2, 0.5);
  B(g, 0.25, 2.4, 0.96, m, 1.875, 1.2, 0.5);
  B(g, 2, 0.3, 0.96, m, 1, 0.15, 0.5);
  B(g, 2, 0.3, 0.96, m, 1, 2.25, 0.5);
  studs(g, 2, 1, 2.4, m);
  [[0.25, -1.15, 1], [1.75, 1.15, -1]].forEach(([x, yaw, flip]) => {
    const sash = new THREE.Group();
    sash.position.set(x, 0, 0.5);
    sash.rotation.y = yaw;
    sash.scale.x = flip;
    g.add(sash);
    B(sash, 0.7, 1.7, 0.03, glass(), 0.375, 1.2, 0);
    [0.33, 2.07].forEach((y) => B(sash, 0.75, 0.06, 0.06, m, 0.375, y, 0));
    [0.03, 0.72].forEach((sx) => B(sash, 0.06, 1.8, 0.06, m, sx, 1.2, 0));
    Sph(sash, 0.05, brass, 0.65, 1.2, 0.05);
  });
  return g;
});

/* ---------- swimming pools, glass roofs and outdoor objects ---------- */
// Swimming pool: tiled basin with a white coping edge, turquoise water, lane ropes and a ladder
const pool = (w, d, board) => () => {
  const g = new THREE.Group();
  const coping = mat("#F2F2F2");
  const t = 0.35;
  B(g, w - 0.04, 0.2, d - 0.04, mat("#BFE6F2"), w / 2, 0.1, d / 2);
  [t / 2, d - t / 2].forEach((z) => B(g, w - 0.04, 0.1, t, coping, w / 2, 0.25, z));
  [t / 2, w - t / 2].forEach((x) => B(g, t, 0.1, d - 2 * t, coping, x, 0.25, d / 2));
  B(g, w - 2 * t, 0.08, d - 2 * t, mat("#35C6E8", { transparent: true, opacity: 0.85, roughness: 0.08 }), w / 2, 0.24, d / 2);
  [d / 3, (2 * d) / 3].forEach((z) => B(g, w - 2 * t - 0.4, 0.02, 0.06, mat("#1E6FB3"), w / 2, 0.285, z));
  const lx = w - t - 0.3;
  [d / 2 - 0.3, d / 2 + 0.3].forEach((z) => {
    tube(g, [lx, 0.15, z], [lx, 0.85, z], 0.03, steel);
    tube(g, [lx, 0.85, z], [lx + 0.35, 0.85, z], 0.03, steel);
    tube(g, [lx + 0.35, 0.85, z], [lx + 0.35, 0.3, z], 0.03, steel);
  });
  [0.45, 0.65].forEach((y) => B(g, 0.03, 0.03, 0.6, steel, lx, y, d / 2));
  if (board) {
    B(g, 0.6, 0.4, 0.6, coping, 0.45, 0.5, d / 2);
    B(g, 1.5, 0.07, 0.5, mat("#F2CD37"), 1.3, 0.72, d / 2);
  }
  return g;
};
reg("pool6", "Swimming pool 6×4", 6, 4, 0.25, true, pool(6, 4, false));
reg("pool8", "Swimming pool 8×6", 8, 6, 0.25, true, pool(8, 6, true));

// Glass roofs: glass panes in a frame in your chosen color
const slope = (g, w, l, m, x, y, z, ang, t = 0.04) => {
  const o = B(g, w, t, l, m, x, y, z);
  o.rotation.x = ang;
  return o;
};
const rafterXs = (len) => Array.from({ length: len + 1 }, (_, i) => (i === 0 ? 0.03 : i === len ? len - 0.03 : i));
[2, 4].forEach((len) =>
  reg(`glassroof${len}`, `Glass roof ${len}×2`, len, 2, 1, false, (c) => {
    const g = new THREE.Group();
    const m = mat(c);
    const ang = -Math.atan2(BH, 2);
    const L = Math.hypot(2, BH);
    slope(g, len - 0.06, L, glass(), len / 2, BH / 2, 1, ang);
    rafterXs(len).forEach((x) => slope(g, 0.06, L, m, x, BH / 2 + 0.03, 1, ang, 0.07));
    slope(g, len, 0.06, m, len / 2, BH / 2 + 0.03, 1, 0, 0.06); // cross bar
    B(g, len, 0.08, 0.08, m, len / 2, 0.04, 0.04);
    B(g, len, 0.08, 0.08, m, len / 2, BH - 0.04, 1.96);
    [0.03, len].forEach((x) => (add(g, prismGeo("gs", [[0, 0], [2, 0], [2, BH]], 0.03), glass(), x, 0, 0).rotation.y = -Math.PI / 2));
    return g;
  })
);
[2, 4].forEach((len) =>
  reg(`glassgable${len}`, `Glass gable ${len}×4`, len, 4, 2, false, (c) => {
    const g = new THREE.Group();
    const m = mat(c);
    const H = 1.8;
    const ang = Math.atan2(H, 2);
    const L = Math.hypot(2, H);
    [[1, -ang], [3, ang]].forEach(([z, a]) => {
      slope(g, len - 0.06, L, glass(), len / 2, H / 2, z, a);
      rafterXs(len).forEach((x) => slope(g, 0.06, L, m, x, H / 2 + 0.03, z, a, 0.07));
    });
    B(g, len, 0.1, 0.1, m, len / 2, H, 2); // ridge
    [0.04, 3.96].forEach((z) => B(g, len, 0.08, 0.08, m, len / 2, 0.04, z));
    [0.03, len].forEach((x) => (add(g, prismGeo("gg", [[0, 0], [4, 0], [2, H]], 0.03), glass(), x, 0, 0).rotation.y = -Math.PI / 2));
    return g;
  })
);
[[2, 2], [4, 4]].forEach(([w, d]) =>
  reg(`glassflat${w}`, `Glass roof flat ${w}×${d}`, w, d, 0.25, true, (c) => {
    const g = new THREE.Group();
    const m = mat(c);
    B(g, w - 0.04, 0.04, d - 0.04, glass(), w / 2, 0.2, d / 2);
    [0.05, d - 0.05].forEach((z) => B(g, w - 0.04, 0.12, 0.1, m, w / 2, 0.16, z));
    [0.05, w - 0.05].forEach((x) => B(g, 0.1, 0.12, d - 0.04, m, x, 0.16, d / 2));
    for (let i = 1; i < w; i++) B(g, 0.06, 0.1, d - 0.04, m, i, 0.16, d / 2);
    for (let i = 1; i < d; i++) B(g, w - 0.04, 0.1, 0.06, m, w / 2, 0.16, i);
    return g;
  })
);

// Outdoor objects
const slat = mat("#B07A45");
reg("bench", "Outdoor bench", 4, 1, 2, false, () => {
  const g = new THREE.Group();
  [0.2, 0.5, 0.8].forEach((z) => B(g, 3.8, 0.08, 0.22, slat, 2, 0.62, z));
  [1.0, 1.3, 1.6].forEach((y) => B(g, 3.8, 0.2, 0.06, slat, 2, y, 0.12));
  [0.4, 3.6].forEach((x) => {
    tube(g, [x, 0, 0.85], [x, 0.95, 0.85], 0.04, black);
    tube(g, [x, 0, 0.2], [x, 1.8, 0.1], 0.04, black);
    B(g, 0.08, 0.06, 0.8, black, x, 0.95, 0.5);
  });
  return g;
});
reg("picnic", "Picnic table", 4, 3, 1, true, () => {
  const g = new THREE.Group();
  [1.0, 1.5, 2.0].forEach((z) => B(g, 3.9, 0.1, 0.38, slat, 2, 1.12, z));
  [0.3, 2.7].forEach((z) => {
    B(g, 3.9, 0.1, 0.5, slat, 2, 0.62, z);
    [0.7, 3.3].forEach((x) => B(g, 0.1, 0.57, 0.1, slat, x, 0.285, z));
  });
  [0.7, 3.3].forEach((x) => {
    tube(g, [x, 0.55, 0.3], [x, 1.1, 1.2], 0.06, slat);
    tube(g, [x, 0.55, 2.7], [x, 1.1, 1.8], 0.06, slat);
  });
  return g;
});
reg("lounger", "Sun lounger", 2, 4, 2, false, (c) => {
  const g = new THREE.Group();
  const cushion = mat(c);
  B(g, 1.5, 0.15, 2.2, cushion, 1, 0.6, 1.2);
  const back = new THREE.Group();
  back.position.set(1, 0.65, 2.3);
  back.rotation.x = -0.9;
  g.add(back);
  B(back, 1.5, 0.12, 1.5, cushion, 0, 0, 0.75);
  [[0.3, 0.3], [1.7, 0.3], [0.3, 2.0], [1.7, 2.0]].forEach(([x, z]) => tube(g, [x, 0, z], [x, 0.52, z], 0.04, steel));
  B(g, 1.6, 0.05, 2.3, steel, 1, 0.5, 1.2);
  [0.3, 1.7].forEach((x) => wheel(g, x, 0.12, 0.2, 0.12, 0.08));
  return g;
});
// Patio set: round table, two chairs and a parasol in your chosen color
reg("patio", "Patio set", 4, 4, 3, false, (c) => {
  const g = new THREE.Group();
  const chair = mat("#F4F4F4");
  Cyl(g, 1.0, 1.0, 0.1, slat, 2, 1.15, 2);
  Cyl(g, 0.5, 0.6, 0.1, steel, 2, 0.05, 2);
  Cyl(g, 0.08, 0.08, 2.9, steel, 2, 1.45, 2);
  Cone(g, 1.9, 0.7, 16, mat(c), 2, 3.25, 2);
  [[0.7, 0.32], [3.3, 3.68]].forEach(([sz, bz]) => {
    B(g, 0.8, 0.08, 0.8, chair, 2, 0.7, sz);
    B(g, 0.8, 0.7, 0.06, chair, 2, 1.1, bz);
    [[-0.34, -0.34], [0.34, -0.34], [-0.34, 0.34], [0.34, 0.34]].forEach(([dx, dz]) => B(g, 0.06, 0.7, 0.06, chair, 2 + dx, 0.35, sz + dz));
  });
  return g;
});
reg("lamppost", "Garden lamp", 1, 1, 3, false, () => {
  const g = new THREE.Group();
  const iron = mat("#2B2F36");
  Cyl(g, 0.2, 0.25, 0.2, iron, 0.5, 0.1, 0.5);
  Cyl(g, 0.05, 0.07, 2.6, iron, 0.5, 1.5, 0.5);
  B(g, 0.34, 0.5, 0.34, mat("#FFE9A8", { emissive: "#FFE9A8", emissiveIntensity: 0.7, transparent: true, opacity: 0.9 }), 0.5, 3.05, 0.5);
  Cone(g, 0.28, 0.25, 4, iron, 0.5, 3.42, 0.5).rotation.y = Math.PI / 4;
  return g;
});
reg("bbq", "BBQ grill", 2, 2, 1, false, () => {
  const g = new THREE.Group();
  add(g, G(THREE.SphereGeometry, 0.8, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat("#1B1B1B"), 1, 1.15, 1);
  Cyl(g, 0.82, 0.82, 0.06, black, 1, 1.15, 1);
  Cyl(g, 0.7, 0.7, 0.04, lit("#FF5A1F"), 1, 1.0, 1);
  for (let z = 0.4; z <= 1.6; z += 0.2) B(g, 1.5, 0.02, 0.03, steel, 1, 1.13, z);
  [[0.4, 0.4], [1.6, 0.4], [1, 1.75]].forEach(([x, z]) => tube(g, [x, 0, z], [1, 0.9, 1], 0.04, black));
  return g;
});
reg("fountain", "Fountain", 4, 4, 2, false, () => {
  const g = new THREE.Group();
  const stone = mat("#B9B3A8");
  Cyl(g, 1.9, 1.9, 0.6, stone, 2, 0.3, 2);
  Cyl(g, 1.7, 1.7, 0.04, waterMat, 2, 0.62, 2);
  Cyl(g, 0.35, 0.45, 1.0, stone, 2, 1.1, 2);
  Cyl(g, 0.9, 0.45, 0.25, stone, 2, 1.7, 2);
  Cyl(g, 0.8, 0.8, 0.03, waterMat, 2, 1.85, 2);
  Cyl(g, 0.06, 0.06, 0.4, waterMat, 2, 2.0, 2);
  return g;
});
reg("fence", "Picket fence", 4, 1, 1, false, (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  const rail = mat(shade(c, 0.85));
  for (let i = 0; i < 8; i++) B(g, 0.34, 0.9, 0.1, m, 0.25 + i * 0.5, 0.55, 0.5);
  [0.35, 0.8].forEach((y) => B(g, 4, 0.1, 0.08, rail, 2, y, 0.4));
  [0.07, 3.93].forEach((x) => B(g, 0.14, 1.1, 0.14, rail, x, 0.55, 0.5));
  return g;
});
reg("mailbox", "Mailbox", 1, 1, 2, false, (c) => {
  const g = new THREE.Group();
  B(g, 0.12, 1.2, 0.12, slat, 0.5, 0.6, 0.5);
  flat(Cyl(g, 0.25, 0.25, 0.7, mat(c), 0.5, 1.35, 0.5));
  B(g, 0.04, 0.3, 0.1, mat("#D01012"), 0.77, 1.4, 0.5);
  return g;
});
reg("bin", "Dustbin", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  Cyl(g, 0.4, 0.3, 0.9, mat(c), 0.5, 0.45, 0.5);
  Cyl(g, 0.43, 0.43, 0.08, mat(shade(c, 0.75)), 0.5, 0.94, 0.5);
  B(g, 0.2, 0.05, 0.05, black, 0.5, 1.02, 0.5);
  return g;
});

/* ---------- gates, fences, roof rails, floor tiles and garden tiles ---------- */
const plate = (g, w, d, m) => B(g, w - 0.04, 0.26, d - 0.04, m, w / 2, 0.13, d / 2); // quarter-brick base slab
const rnd = (i) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x); // repeatable "random" so a piece always looks the same
};
const ironM = mat("#1F2329");

// Gates: posts at both ends and one or two hinged leaves; the open gate swings its leaf toward the front
function leafBoards(leaf, lw, m, rail) {
  [0.3, 0.8].forEach((y) => B(leaf, lw, 0.1, 0.06, rail, lw / 2, y, 0));
  for (let x = 0.12; x <= lw - 0.1; x += 0.3) B(leaf, 0.2, 0.85, 0.05, m, x, 0.55, 0.05);
  tube(leaf, [0.05, 0.3, -0.04], [lw - 0.05, 0.8, -0.04], 0.03, rail);
  [0.3, 0.8].forEach((y) => B(leaf, 0.12, 0.08, 0.08, black, 0.06, y, 0)); // hinges
  B(leaf, 0.1, 0.06, 0.08, black, lw - 0.1, 0.55, 0); // latch
}
const gate = (len, open) => (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  const rail = mat(shade(c, 0.6));
  [0.1, len - 0.1].forEach((x) => B(g, 0.2, 1.15, 0.2, rail, x, 0.575, 0.5));
  const n = len > 2 ? 2 : 1;
  const lw = (len - 0.4) / n;
  for (let i = 0; i < n; i++) {
    const leaf = new THREE.Group();
    leaf.position.set(0.2 + i * lw, 0, 0.5);
    if (open) leaf.rotation.y = -1.0;
    g.add(leaf);
    leafBoards(leaf, lw - 0.02, m, rail);
  }
  return g;
};
reg("gate2", "Garden gate", 2, 1, 1, false, gate(2, false));
reg("gate4", "Double gate", 4, 1, 1, false, gate(4, false));
reg("gateopen", "Open gate", 2, 2, 1, false, gate(2, true));

// More fences (the Picket fence 4×1 is in the Outdoor section above)
reg("fence2", "Picket fence 2×1", 2, 1, 1, false, (c) => {
  const g = new THREE.Group();
  const rail = mat(shade(c, 0.85));
  for (let i = 0; i < 4; i++) B(g, 0.34, 0.9, 0.1, mat(c), 0.25 + i * 0.5, 0.55, 0.5);
  [0.35, 0.8].forEach((y) => B(g, 2, 0.1, 0.08, rail, 1, y, 0.4));
  [0.07, 1.93].forEach((x) => B(g, 0.14, 1.1, 0.14, rail, x, 0.55, 0.5));
  return g;
});
reg("panelfence", "Panel fence", 4, 1, 1, false, (c) => {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) B(g, 3.8, 0.19, 0.08, mat(shade(c, i % 2 ? 0.92 : 1)), 2, 0.14 + i * 0.22, 0.5);
  [0.08, 2, 3.92].forEach((x) => B(g, 0.16, 1.2, 0.16, mat(shade(c, 0.8)), x, 0.6, 0.5));
  return g;
});
reg("ironfence", "Iron fence", 4, 1, 1, false, () => {
  const g = new THREE.Group();
  [0.1, 3.9].forEach((x) => {
    B(g, 0.1, 1.2, 0.1, ironM, x, 0.6, 0.5);
    Sph(g, 0.07, ironM, x, 1.25, 0.5);
  });
  for (let x = 0.35; x < 3.7; x += 0.25) {
    B(g, 0.04, 0.95, 0.04, ironM, x, 0.55, 0.5);
    Cone(g, 0.045, 0.14, 4, ironM, x, 1.1, 0.5);
  }
  [0.3, 0.9].forEach((y) => B(g, 3.8, 0.06, 0.06, ironM, 2, y, 0.5));
  return g;
});
reg("meshfence", "Mesh fence", 4, 1, 1, false, () => {
  const g = new THREE.Group();
  [0.08, 2, 3.92].forEach((x) => B(g, 0.08, 1.2, 0.08, steel, x, 0.6, 0.5));
  B(g, 3.8, 0.9, 0.02, mat("#9AA3AD", { transparent: true, opacity: 0.4 }), 2, 0.65, 0.5);
  [0.2, 1.1].forEach((y) => tube(g, [0, y, 0.5], [4, y, 0.5], 0.03, steel));
  for (let x = 0.3; x < 3.8; x += 0.5) tube(g, [x, 0.2, 0.5], [x + 0.5, 1.1, 0.5], 0.008, steel);
  return g;
});

// Roof rails: safety railings for flat roofs, terraces and balconies (rails take your chosen color)
const roofRail = (len) => (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  const n = Math.max(1, Math.round(len));
  for (let i = 0; i <= n; i++) {
    const x = 0.08 + (i * (len - 0.16)) / n;
    B(g, 0.08, 0.95, 0.08, m, x, 0.475, 0.5);
    B(g, 0.2, 0.04, 0.2, steel, x, 0.02, 0.5);
  }
  tube(g, [0, 0.95, 0.5], [len, 0.95, 0.5], 0.04, m);
  tube(g, [0, 0.55, 0.5], [len, 0.55, 0.5], 0.03, m);
  B(g, len, 0.1, 0.04, m, len / 2, 0.07, 0.5); // toe board
  return g;
};
reg("roofrail2", "Roof rail 2×1", 2, 1, 1, false, roofRail(2));
reg("roofrail4", "Roof rail 4×1", 4, 1, 1, false, roofRail(4));
reg("railcorner", "Roof rail corner", 2, 2, 1, false, (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  [[0.1, 0.1], [1, 0.1], [1.9, 0.1], [0.1, 1], [0.1, 1.9]].forEach(([x, z]) => {
    B(g, 0.08, 0.95, 0.08, m, x, 0.475, z);
    B(g, 0.2, 0.04, 0.2, steel, x, 0.02, z);
  });
  [0.95, 0.55].forEach((y) => {
    tube(g, [0, y, 0.1], [2, y, 0.1], y > 0.9 ? 0.04 : 0.03, m);
    tube(g, [0.1, y, 0], [0.1, y, 2], y > 0.9 ? 0.04 : 0.03, m);
  });
  return g;
});
reg("glassrail", "Glass railing", 4, 1, 1, false, () => {
  const g = new THREE.Group();
  B(g, 3.7, 0.85, 0.04, glass(), 2, 0.55, 0.5);
  tube(g, [0, 1.0, 0.5], [4, 1.0, 0.5], 0.04, steel);
  [0.15, 2, 3.85].forEach((x) => B(g, 0.08, 1.0, 0.08, steel, x, 0.5, 0.5));
  return g;
});

// Floor tiles: quarter-brick thick with patterned tops
const woods = ["#B07A45", "#A56E3B", "#BC8650"];
[2, 4].forEach((n) => {
  reg(`floorc${n}`, `Checker floor ${n}×${n}`, n, n, 0.25, true, (c) => {
    const g = new THREE.Group();
    plate(g, n, n, mat("#8A8D91"));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) B(g, 0.94, 0.04, 0.94, mat((i + j) % 2 ? "#F4F4F4" : c), i + 0.5, 0.28, j + 0.5);
    return g;
  });
  reg(`floorw${n}`, `Wood floor ${n}×${n}`, n, n, 0.25, true, () => {
    const g = new THREE.Group();
    plate(g, n, n, mat("#5A3A1E"));
    for (let r = 0; r < n * 2; r++)
      for (let k = 0; k < n; k++) {
        const x0 = Math.max(0, (r % 2 ? -1 : 0) + 2 * k);
        const x1 = Math.min(n, (r % 2 ? -1 : 0) + 2 * k + 2);
        if (x1 > x0) B(g, x1 - x0 - 0.04, 0.04, 0.46, mat(woods[(r + k) % 3]), (x0 + x1) / 2, 0.28, r * 0.5 + 0.25);
      }
    return g;
  });
  reg(`floort${n}`, `Ceramic floor ${n}×${n}`, n, n, 0.25, true, (c) => {
    const g = new THREE.Group();
    plate(g, n, n, mat("#CFCFD4")); // grout
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) B(g, 0.92, 0.04, 0.92, mat(c), i + 0.5, 0.28, j + 0.5);
    return g;
  });
});

// Garden tiles
const grass = "#4C9F4A";
const stoneC = ["#9A9A9A", "#8C8C8C", "#A6A29A"];
const bricks = ["#B5532F", "#A5472A", "#C4623B"];
[2, 4].forEach((n) => {
  reg(`lawn${n}`, `Lawn ${n}×${n}`, n, n, 0.25, true, () => {
    const g = new THREE.Group();
    plate(g, n, n, mat(grass));
    for (let i = 0; i < n * 3; i++) {
      const o = B(g, 0.5, 0.03, 0.4, mat(i % 2 ? "#3F8F3F" : "#5DB25A"), 0.3 + rnd(i) * (n - 0.6), 0.28, 0.3 + rnd(i + 50) * (n - 0.6));
      o.rotation.y = rnd(i + 9) * 3;
    }
    return g;
  });
  reg(`paver${n}`, `Brick paving ${n}×${n}`, n, n, 0.25, true, () => {
    const g = new THREE.Group();
    plate(g, n, n, mat("#A89F91")); // mortar
    for (let r = 0; r < n * 2; r++)
      for (let k = 0; k <= n; k++) {
        const x0 = Math.max(0, k - (r % 2 ? 0.5 : 0));
        const x1 = Math.min(n, k + (r % 2 ? 0.5 : 1));
        if (x1 - x0 > 0.1) B(g, x1 - x0 - 0.06, 0.04, 0.44, mat(bricks[(r + k) % 3]), (x0 + x1) / 2, 0.28, r * 0.5 + 0.25);
      }
    return g;
  });
  reg(`cobble${n}`, `Cobblestone ${n}×${n}`, n, n, 0.25, true, () => {
    const g = new THREE.Group();
    plate(g, n, n, mat("#6E6A63"));
    const m = n === 2 ? 3 : 6;
    const pitch = n / m;
    for (let i = 0; i < m; i++)
      for (let j = 0; j < m; j++)
        Ico(g, pitch * 0.52, mat(stoneC[(i * 3 + j) % 3], { flatShading: true, roughness: 0.95 }), (i + 0.5) * pitch + (rnd(i * 7 + j) - 0.5) * 0.08, 0.24, (j + 0.5) * pitch + (rnd(i + j * 5) - 0.5) * 0.08, 1, 0.25, 1, rnd(i + j * 11) * 3);
    return g;
  });
});
reg("gpath", "Flagstone path", 2, 4, 0.25, true, () => {
  const g = new THREE.Group();
  plate(g, 2, 4, mat(grass));
  [[1, 0.6, 1.2, 0.8], [0.9, 1.6, 1.1, 0.8], [1.1, 2.6, 1.3, 0.9], [1, 3.5, 1.2, 0.7]].forEach(([x, z, w, d], i) => {
    B(g, w, 0.05, d, mat(stoneC[i % 3]), x, 0.285, z).rotation.y = (rnd(i + 3) - 0.5) * 0.4;
  });
  return g;
});
reg("gsteps", "Stepping stones", 2, 4, 0.25, true, () => {
  const g = new THREE.Group();
  plate(g, 2, 4, mat(grass));
  [[0.8, 0.6], [1.2, 1.55], [0.8, 2.5], [1.2, 3.4]].forEach(([x, z], i) => Cyl(g, 0.42, 0.42, 0.06, mat(stoneC[i % 3]), x, 0.29, z));
  return g;
});

/* ---------- tiled roofs, round bricks, stairs, steps and ladders ---------- */
// Overlapping rows of clay tiles on a slope. (z0, y0) is where the slope starts; dz = +1 if it rises toward +z.
function tileRows(g, len, ang, L, c, z0, y0, dz) {
  const n = Math.round(L / 0.55);
  const step = L / n;
  for (let i = 0; i < n; i++) {
    const s = (i + 0.5) * step;
    const y = y0 + s * Math.sin(ang) + 0.03 * Math.cos(ang);
    const z = z0 + dz * s * Math.cos(ang) - dz * 0.03 * Math.sin(ang);
    for (let j = -1; j * 0.5 < len; j++) {
      const cx = 0.25 + j * 0.5 + (i % 2 ? 0.25 : 0); // every other row is shifted half a tile
      const a = Math.max(0, cx - 0.25);
      const b = Math.min(len, cx + 0.25);
      if (b - a < 0.08) continue;
      B(g, b - a - 0.03, 0.05, step * 1.15, mat(shade(c, [1, 0.93, 1.06][(i + j + 3) % 3])), (a + b) / 2, y, z).rotation.x = -dz * ang;
    }
  }
}
[2, 4].forEach((len) => {
  reg(`rooftile${len}`, `Tiled roof ${len}×2`, len, 2, 1, false, (c) => {
    const g = new THREE.Group();
    add(g, roofGeo(len), mat(shade(c, 0.55)), len, 0, 0).rotation.y = -Math.PI / 2;
    tileRows(g, len, Math.atan2(BH, 2), Math.hypot(2, BH), c, 0, 0, 1);
    return g;
  });
  reg(`tilegable${len}`, `Tiled gable ${len}×4`, len, 4, 2, false, (c) => {
    const g = new THREE.Group();
    const H = 1.8;
    const ang = Math.atan2(H, 2);
    const L = Math.hypot(2, H);
    add(g, prismGeo("g", [[0, 0], [4, 0], [2, H]], len), mat(shade(c, 0.55)), len, 0, 0).rotation.y = -Math.PI / 2;
    tileRows(g, len, ang, L, c, 0, 0, 1);
    tileRows(g, len, ang, L, c, 4, 0, -1);
    Cyl(g, 0.13, 0.13, len, mat(shade(c, 0.8)), len / 2, H + 0.02, 2).rotation.z = Math.PI / 2; // ridge cap
    return g;
  });
});

// Round bricks: a cylinder with studs on top
[1, 2, 3, 4].forEach((n) =>
  reg(`round${n}`, `Round ${n}×${n}`, n, n, 1, true, (c) => {
    const g = new THREE.Group();
    const m = mat(c);
    const r = n / 2 - 0.02;
    add(g, G(THREE.CylinderGeometry, r, r, BH, 32), m, n / 2, BH / 2, n / 2);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        if (Math.hypot(i + 0.5 - n / 2, j + 0.5 - n / 2) <= r - 0.1) add(g, studGeo, m, i + 0.5, BH + SH / 2, j + 0.5);
    return g;
  })
);

// Stairs: low end at the front (+z), climbing toward the back. Each step rises a quarter brick.
const stairs = (steps, rail) => (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  const tread = mat(shade(c, 1.15));
  const rise = BH * 0.25;
  for (let i = 0; i < steps; i++) {
    const h = (i + 1) * rise;
    const z = steps - (i + 0.5);
    B(g, 1.96, h, 0.96, m, 1, h / 2, z);
    B(g, 1.96, 0.03, 1.0, tread, 1, h, z);
  }
  if (rail) {
    for (let i = 0; i < steps; i += 2) {
      const h = (i + 1) * rise;
      B(g, 0.06, 0.85, 0.06, steel, 0.1, h + 0.425, steps - (i + 0.5));
    }
    tube(g, [0.1, rise + 0.9, steps - 0.5], [0.1, steps * rise + 0.9, 0.5], 0.03, steel);
  }
  return g;
};
reg("stairs4", "Stairs 2×4", 2, 4, 1, false, stairs(4, false));
reg("stairs4r", "Stairs 2×4 with rail", 2, 4, 1, false, stairs(4, true));
reg("stairs8", "Stairs 2×8", 2, 8, 2, false, stairs(8, false));

// Single steps and a step stool
reg("doorstep", "Doorstep", 2, 1, 0.25, true, (c) => {
  const g = new THREE.Group();
  B(g, 1.96, 0.3, 0.96, mat(c), 1, 0.15, 0.5);
  [0.25, 0.45, 0.65, 0.85].forEach((z) => B(g, 1.8, 0.02, 0.05, mat(shade(c, 0.8)), 1, 0.31, z)); // anti-slip ribs
  return g;
});
reg("step2", "Two-tier step", 2, 2, 0.5, false, (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  B(g, 1.96, 0.3, 0.96, m, 1, 0.15, 1.5);
  B(g, 1.96, 0.6, 0.96, m, 1, 0.3, 0.5);
  B(g, 1.96, 0.03, 1.0, mat(shade(c, 1.15)), 1, 0.3, 1.5);
  B(g, 1.96, 0.03, 1.0, mat(shade(c, 1.15)), 1, 0.6, 0.5);
  return g;
});
reg("stepstool", "Step stool", 1, 2, 1, false, (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  B(g, 0.9, 0.06, 0.6, m, 0.5, 1.15, 0.4); // top tread
  B(g, 0.9, 0.06, 0.5, m, 0.5, 0.6, 1.45); // lower tread
  [0.1, 0.9].forEach((x) => {
    tube(g, [x, 0, 0.1], [x, 1.15, 0.2], 0.04, steel);
    tube(g, [x, 0, 1.9], [x, 0.6, 1.6], 0.04, steel);
    tube(g, [x, 0.6, 1.6], [x, 1.15, 0.5], 0.04, steel);
  });
  return g;
});

// Ladders
const wallLadder = (H) => () => {
  const g = new THREE.Group();
  [0.15, 0.85].forEach((x) => tube(g, [x, 0, 0.2], [x, H, 0.2], 0.04, steel));
  for (let y = 0.25; y < H - 0.1; y += 0.4) Cyl(g, 0.03, 0.03, 0.7, steel, 0.5, y, 0.2).rotation.z = Math.PI / 2; // rungs
  [H * 0.2, H * 0.8].forEach((y) => [0.15, 0.85].forEach((x) => B(g, 0.05, 0.05, 0.18, steel, x, y, 0.1))); // wall brackets
  return g;
};
reg("ladder2", "Ladder (2 tall)", 1, 1, 2, false, wallLadder(2.3));
reg("ladder4", "Ladder (4 tall)", 1, 1, 4, false, wallLadder(4.7));
reg("ladderlean", "Leaning ladder", 1, 2, 3, false, () => {
  const g = new THREE.Group();
  const wood = mat("#B07A45");
  [0.2, 0.8].forEach((x) => {
    tube(g, [x, 0, 1.8], [x, 3.4, 0.25], 0.05, wood);
    B(g, 0.12, 0.05, 0.12, black, x, 0.025, 1.8);
  });
  for (let k = 1; k <= 9; k++) {
    const t = k / 10;
    Cyl(g, 0.035, 0.035, 0.6, wood, 0.5, 3.4 * t, 1.8 + (0.25 - 1.8) * t).rotation.z = Math.PI / 2;
  }
  return g;
});

/* ---------- roads, aircraft, pets, people, roof parts, steel, garden and towers ---------- */
// Flat top-view shapes extruded upward, and shapes built from triangles
const planGeos = {};
function plan(g, pts, h, m, y = 0) {
  const k = h + JSON.stringify(pts);
  if (!planGeos[k]) {
    const sh = new THREE.Shape();
    pts.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z)));
    planGeos[k] = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false });
  }
  const o = add(g, planGeos[k], m, 0, y, 0);
  o.rotation.x = -Math.PI / 2;
  return o;
}
const polyGeos = {};
function polyGeo(key, tris) {
  if (!polyGeos[key]) {
    const pts = [];
    tris.forEach((t) => t.forEach((p) => pts.push(V(...p))));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    geo.computeVertexNormals();
    polyGeos[key] = geo;
  }
  return polyGeos[key];
}
// Square-section bar between two points (steel tubes)
function sq(g, a, b, t, m) {
  const p = V(...a);
  const q = V(...b);
  const dir = q.clone().sub(p);
  const o = add(g, G(THREE.BoxGeometry, 1, 1, 1), m, (p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2);
  o.scale.set(t, dir.length(), t);
  o.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
  return o;
}

/* ----- roads (quarter-brick thick; markings sit on top) ----- */
const asphalt = mat("#3B3F45");
const lineW = mat("#F4F4F4");
const lineY = mat("#F2CD37");
const mark = (g, w, d, m, x, z) => B(g, w, 0.02, d, m, x, 0.27, z);
const dashZ = (g, x, z0, z1) => { for (let t = z0; t < z1 - 0.1; t += 1) mark(g, 0.12, 0.5, lineY, x, t + 0.5); };
const dashX = (g, z, x0, x1) => { for (let t = x0; t < x1 - 0.1; t += 1) mark(g, 0.5, 0.12, lineY, t + 0.5, z); };
const road = (d) => () => {
  const g = new THREE.Group();
  plate(g, 4, d, asphalt);
  [0.2, 3.8].forEach((x) => mark(g, 0.1, d - 0.1, lineW, x, d / 2));
  dashZ(g, 2, 0, d);
  return g;
};
reg("road4", "Road 4×4", 4, 4, 0.25, true, road(4));
reg("road8", "Road 4×8", 4, 8, 0.25, true, road(8));
function arcLine(g, cx, cz, r, a0, a1, n, w, m, dashed) {
  for (let i = 0; i < n; i++) {
    if (dashed && i % 2) continue;
    const a = a0 + ((i + 0.5) * (a1 - a0)) / n;
    const len = Math.abs(((a1 - a0) / n) * r) * 1.08;
    mark(g, len, w, m, cx + r * Math.cos(a), cz + r * Math.sin(a)).rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
  }
}
// Curve: enters at the front edge, leaves at the right edge
reg("roadcurve", "Road curve", 4, 4, 0.25, true, () => {
  const g = new THREE.Group();
  B(g, 3.96, 0.2, 3.96, mat("#9A978F"), 2, 0.1, 2); // pavement in the corner
  const pts = [[4, 4]];
  for (let i = 0; i <= 16; i++) pts.push([4 + 4 * Math.cos(Math.PI + (i * Math.PI) / 32), 4 + 4 * Math.sin(Math.PI + (i * Math.PI) / 32)]);
  plan(g, pts, 0.26, asphalt);
  arcLine(g, 4, 4, 3.85, Math.PI, Math.PI * 1.5, 24, 0.1, lineW, false);
  arcLine(g, 4, 4, 2, Math.PI, Math.PI * 1.5, 12, 0.12, lineY, true);
  return g;
});
// Junctions: the main road runs left to right; the side road leaves from the front edge
reg("roadt", "Road T-junction", 4, 4, 0.25, true, () => {
  const g = new THREE.Group();
  plate(g, 4, 4, asphalt);
  mark(g, 3.8, 0.1, lineW, 2, 0.2);
  dashX(g, 2, 0, 1);
  dashX(g, 2, 3, 4);
  dashZ(g, 2, 3, 4);
  return g;
});
reg("roadx", "Road crossing", 4, 4, 0.25, true, () => {
  const g = new THREE.Group();
  plate(g, 4, 4, asphalt);
  dashX(g, 2, 0, 1);
  dashX(g, 2, 3, 4);
  dashZ(g, 2, 0, 1);
  dashZ(g, 2, 3, 4);
  return g;
});
reg("zebra", "Zebra crossing", 4, 4, 0.25, true, () => {
  const g = new THREE.Group();
  plate(g, 4, 4, asphalt);
  [0.2, 3.8].forEach((x) => mark(g, 0.1, 3.9, lineW, x, 2));
  for (let k = 0; k < 6; k++) mark(g, 0.35, 2, lineW, 0.5 + k * 0.6, 2);
  dashZ(g, 2, 0, 1);
  dashZ(g, 2, 3, 4);
  return g;
});
reg("pavement", "Pavement 2×4", 2, 4, 0.25, true, () => {
  const g = new THREE.Group();
  plate(g, 2, 4, mat("#B8B4AC"));
  for (let z = 1; z < 4; z++) mark(g, 1.9, 0.04, mat("#8F8B84"), 1, z);
  mark(g, 0.06, 3.9, mat("#8F8B84"), 1, 2);
  return g;
});

/* ----- helicopter and fighter jet (nose toward +z) ----- */
reg("heli", "Helicopter", 4, 6, 3, false, (c) => {
  const g = new THREE.Group();
  const body = mat(c);
  Sph(g, 1, body, 2, 1.45, 3.7).scale.set(0.85, 0.8, 1.35); // cabin
  Sph(g, 0.8, tintGlass, 2, 1.55, 4.45).scale.set(0.95, 0.8, 0.95); // canopy glass
  tube(g, [2, 1.5, 2.6], [2, 1.95, 0.4], 0.17, body); // tail boom
  B(g, 0.07, 0.9, 0.5, body, 2, 2.35, 0.3); // fin
  B(g, 1.0, 0.06, 0.3, body, 2, 1.95, 0.35);
  Cyl(g, 0.04, 0.04, 0.7, black, 2.12, 2.1, 0.2); // tail rotor
  Cyl(g, 0.07, 0.07, 0.5, steel, 2, 2.6, 3.7); // mast
  for (let k = 0; k < 3; k++) B(g, 3.8, 0.04, 0.2, black, 2, 2.9, 3.7).rotation.y = (k * Math.PI) / 3; // main rotor
  [1.1, 2.9].forEach((x) => {
    const lean = x < 2 ? 0.2 : -0.2;
    tube(g, [x, 0.12, 2.6], [x, 0.12, 4.9], 0.05, steel); // skids
    tube(g, [x, 0.12, 3.1], [x + lean, 0.9, 3.2], 0.04, steel);
    tube(g, [x, 0.12, 4.4], [x + lean, 0.9, 4.3], 0.04, steel);
  });
  return g;
});
reg("jet", "Fighter jet", 6, 8, 2, false, (c) => {
  const g = new THREE.Group();
  const body = mat(c);
  const wing = mat(shade(c, 0.8));
  flat(Cyl(g, 0.5, 0.5, 5, body, 3, 1.0, 3.0)); // fuselage
  flat(Cone(g, 0.5, 2.2, 16, body, 3, 1.0, 6.6)); // nose
  flat(Cyl(g, 0.42, 0.5, 0.5, mat("#444444", { metalness: 0.6 }), 3, 1.0, 0.3)); // nozzle
  flat(Cyl(g, 0.32, 0.32, 0.05, lit("#FF8A3D"), 3, 1.0, 0.06));
  plan(g, [[3, 5.8], [5.95, 1.6], [5.95, 1.0], [3.55, 1.3], [2.45, 1.3], [0.05, 1.0], [0.05, 1.6]], 0.1, wing, 0.85); // wings
  plan(g, [[3, 1.7], [4.7, 0.6], [4.7, 0.25], [3.4, 0.5], [2.6, 0.5], [1.3, 0.25], [1.3, 0.6]], 0.08, wing, 0.9); // tailplane
  [2.55, 3.45].forEach((x, i) => (B(g, 0.07, 1.0, 0.9, body, x, 1.55, 0.9).rotation.z = i ? -0.25 : 0.25)); // twin fins
  Sph(g, 0.45, tintGlass, 3, 1.4, 4.3).scale.set(0.8, 0.75, 2.0); // canopy
  [2.45, 3.55].forEach((x) => B(g, 0.3, 0.4, 1.0, mat("#222222"), x, 0.85, 3.4)); // intakes
  [[0.9, 2.0], [5.1, 2.0], [1.7, 2.4], [4.3, 2.4]].forEach(([x, z]) => {
    flat(Cyl(g, 0.07, 0.07, 1.1, white, x, 0.72, z));
    flat(Cone(g, 0.07, 0.25, 8, black, x, 0.72, z + 0.68));
  });
  return g;
});

/* ----- pets ----- */
reg("dog", "Dog", 1, 2, 2, false, (c) => {
  const g = new THREE.Group();
  const coat = mat("#B98A55");
  const dark = mat("#7A5230");
  [[0.32, 0.5], [0.68, 0.5], [0.32, 1.1], [0.68, 1.1]].forEach(([x, z]) => B(g, 0.13, 0.5, 0.13, coat, x, 0.25, z));
  B(g, 0.5, 0.5, 1.0, coat, 0.5, 0.75, 0.8);
  B(g, 0.42, 0.4, 0.45, coat, 0.5, 1.2, 1.5);
  B(g, 0.22, 0.18, 0.28, mat("#D9B382"), 0.5, 1.1, 1.78);
  Sph(g, 0.05, black, 0.5, 1.16, 1.93);
  [0.4, 0.6].forEach((x) => {
    Sph(g, 0.04, black, x, 1.28, 1.72);
    B(g, 0.1, 0.26, 0.12, dark, x + (x < 0.5 ? -0.17 : 0.17), 1.28, 1.45);
  });
  B(g, 0.54, 0.1, 0.3, mat(c), 0.5, 1.0, 1.3); // collar
  tube(g, [0.5, 0.95, 0.3], [0.5, 1.4, 0.07], 0.04, coat);
  return g;
});
reg("cat", "Cat", 1, 1, 1, false, () => {
  const g = new THREE.Group();
  const fr = mat("#8E8E93");
  Sph(g, 0.3, fr, 0.5, 0.4, 0.45).scale.set(1, 1.25, 1);
  Sph(g, 0.21, fr, 0.5, 0.95, 0.5);
  [0.4, 0.6].forEach((x) => {
    Cone(g, 0.07, 0.16, 4, fr, x, 1.17, 0.5);
    Sph(g, 0.035, lit("#8CE08C"), x, 0.98, 0.69);
    Sph(g, 0.08, fr, x, 0.1, 0.72); // front paws
  });
  Sph(g, 0.03, mat("#F4A9B8"), 0.5, 0.9, 0.71);
  tube(g, [0.72, 0.1, 0.5], [0.9, 0.12, 0.7], 0.05, fr);
  tube(g, [0.9, 0.12, 0.7], [0.85, 0.55, 0.85], 0.05, fr);
  return g;
});
reg("rabbit", "Rabbit", 1, 1, 1, false, () => {
  const g = new THREE.Group();
  const fur = mat("#F1EEE8");
  Sph(g, 0.3, fur, 0.5, 0.35, 0.5).scale.set(1, 0.9, 1.3);
  Sph(g, 0.2, fur, 0.5, 0.62, 0.78);
  [0.43, 0.57].forEach((x) => (Sph(g, 0.08, mat("#F4C7D0"), x, 1.0, 0.72).scale.set(0.7, 3.4, 0.5)));
  [0.43, 0.57].forEach((x) => Sph(g, 0.03, black, x, 0.68, 0.95));
  Sph(g, 0.11, white, 0.5, 0.38, 0.12);
  [0.35, 0.65].forEach((x) => Sph(g, 0.09, fur, x, 0.08, 0.8));
  return g;
});
reg("parrot", "Parrot on perch", 1, 1, 2, false, (c) => {
  const g = new THREE.Group();
  const wing = mat(shade(c, 0.7));
  Cyl(g, 0.3, 0.3, 0.06, wood, 0.5, 0.03, 0.5);
  Cyl(g, 0.03, 0.03, 1.35, wood, 0.5, 0.7, 0.5);
  tube(g, [0.2, 1.4, 0.5], [0.8, 1.4, 0.5], 0.035, wood);
  Sph(g, 0.2, mat(c), 0.5, 1.68, 0.5).scale.set(1, 1.5, 1);
  Sph(g, 0.13, mat(c), 0.5, 2.0, 0.55);
  Cone(g, 0.05, 0.13, 6, mat("#FE8A18"), 0.5, 1.98, 0.7).rotation.x = Math.PI / 2; // beak
  [0.43, 0.57].forEach((x) => Sph(g, 0.02, black, x, 2.04, 0.64));
  [0.3, 0.7].forEach((x) => B(g, 0.06, 0.4, 0.16, wing, x, 1.65, 0.5));
  tube(g, [0.5, 1.45, 0.4], [0.5, 0.95, 0.25], 0.05, mat(shade(c, 1.2)));
  return g;
});
reg("fishbowl", "Fish bowl", 1, 1, 1, false, () => {
  const g = new THREE.Group();
  const orange = mat("#FE8A18");
  Cyl(g, 0.25, 0.3, 0.1, mat("#8A6A44"), 0.5, 0.05, 0.5);
  Sph(g, 0.4, glass(), 0.5, 0.55, 0.5);
  Sph(g, 0.34, waterMat, 0.5, 0.5, 0.5);
  Sph(g, 0.09, orange, 0.45, 0.5, 0.5).scale.set(1.6, 1, 0.7);
  Cone(g, 0.07, 0.16, 4, orange, 0.62, 0.5, 0.5).rotation.z = Math.PI / 2;
  tube(g, [0.32, 0.2, 0.4], [0.36, 0.6, 0.42], 0.02, leafA);
  [[0.6, 0.18], [0.45, 0.19], [0.68, 0.2]].forEach(([x, z]) => Sph(g, 0.04, mat("#8C8C8C"), x, 0.2, z + 0.3));
  return g;
});

/* ----- more people (shirt, dress or apron takes your chosen color where noted) ----- */
const figure = (sp) => (c) => {
  const g = new THREE.Group();
  const s = sp.scale || 1;
  const f = new THREE.Group();
  f.scale.setScalar(s);
  f.position.set(0.5 - 0.5 * s, 0, 0.5 - 0.5 * s);
  g.add(f);
  const skin = mat("#F2CD37");
  const top = mat(sp.top === "c" ? c : sp.top);
  if (sp.dress) {
    Cyl(f, 0.3, 0.46, 0.9, mat(c), 0.5, 0.65, 0.5);
    [0.38, 0.62].forEach((x) => B(f, 0.14, 0.3, 0.14, skin, x, 0.15, 0.5));
  } else {
    [0.33, 0.67].forEach((x) => B(f, 0.34, 1, 0.46, mat(sp.bottom), x, 0.5, 0.5));
  }
  B(f, 0.64, 1.1, 0.46, top, 0.5, 1.55, 0.5);
  [0.09, 0.91].forEach((x) => {
    B(f, 0.18, 1, 0.28, top, x, 1.5, 0.5);
    B(f, 0.18, 0.2, 0.26, skin, x, 0.9, 0.5);
  });
  Cyl(f, 0.3, 0.3, 0.5, skin, 0.5, 2.35, 0.5);
  [0.4, 0.6].forEach((x) => Sph(f, 0.04, black, x, 2.4, 0.79));
  B(f, 0.2, 0.04, 0.02, black, 0.5, 2.25, 0.8);
  if (sp.hair) {
    const hm = mat(sp.hair.color);
    Cyl(f, 0.32, 0.32, 0.16, hm, 0.5, 2.58, 0.5);
    B(f, 0.6, 0.45, 0.1, hm, 0.5, 2.4, 0.24);
    if (sp.hair.style === "long") {
      B(f, 0.62, 0.95, 0.14, hm, 0.5, 2.05, 0.26);
      [0.2, 0.8].forEach((x) => B(f, 0.1, 0.5, 0.3, hm, x, 2.3, 0.42));
    }
    if (sp.hair.style === "pigtails") [0.14, 0.86].forEach((x) => Sph(f, 0.14, hm, x, 2.4, 0.45));
  }
  if (sp.hat === "chef") {
    Cyl(f, 0.28, 0.28, 0.45, white, 0.5, 2.82, 0.5);
    Sph(f, 0.3, white, 0.5, 3.1, 0.5);
  }
  if (sp.hat === "police") {
    Cyl(f, 0.33, 0.33, 0.14, mat("#1E2A44"), 0.5, 2.67, 0.5);
    B(f, 0.46, 0.04, 0.22, black, 0.5, 2.62, 0.82);
  }
  if (sp.hat === "straw") {
    Cyl(f, 0.6, 0.6, 0.04, mat("#E3C27A"), 0.5, 2.66, 0.5);
    Cyl(f, 0.3, 0.3, 0.22, mat("#E3C27A"), 0.5, 2.78, 0.5);
  }
  if (sp.extra) sp.extra(f, c);
  return g;
};
reg("woman", "Woman", 1, 1, 3, false, figure({ top: "c", dress: true, hair: { color: "#3A2412", style: "long" } }));
reg("man", "Man in suit", 1, 1, 3, false, figure({
  top: "#2B3544", bottom: "#2B3544", hair: { color: "#2A1B10", style: "short" },
  extra: (f, c) => {
    B(f, 0.2, 0.5, 0.02, white, 0.5, 1.7, 0.745);
    B(f, 0.1, 0.55, 0.03, mat(c), 0.5, 1.62, 0.76); // tie
  },
}));
reg("child", "Child", 1, 1, 2, false, figure({ scale: 0.72, top: "c", bottom: "#2F4B7C", hair: { color: "#C9822B", style: "pigtails" } }));
reg("chef", "Chef", 1, 1, 3, false, figure({
  top: "#F4F4F4", bottom: "#555C66", hat: "chef",
  extra: (f, c) => B(f, 0.6, 0.95, 0.03, mat(c), 0.5, 1.2, 0.745), // apron
}));
reg("doctor", "Doctor", 1, 1, 3, false, figure({
  top: "#F4F4F4", bottom: "#2E8B8B", hair: { color: "#2A1B10", style: "short" },
  extra: (f) => {
    B(f, 0.68, 0.55, 0.5, white, 0.5, 0.95, 0.5); // long coat
    add(f, G(THREE.TorusGeometry, 0.16, 0.015, 6, 16), black, 0.5, 1.95, 0.745); // stethoscope
  },
}));
reg("police", "Police officer", 1, 1, 3, false, figure({
  top: "#1E2A44", bottom: "#1E2A44", hat: "police",
  extra: (f) => {
    B(f, 0.1, 0.12, 0.02, brass, 0.68, 1.9, 0.745);
    B(f, 0.66, 0.1, 0.48, black, 0.5, 1.05, 0.5);
  },
}));
reg("farmer", "Farmer", 1, 1, 3, false, figure({
  top: "c", bottom: "#2F5D9E", hat: "straw",
  extra: (f) => B(f, 0.5, 0.6, 0.03, mat("#2F5D9E"), 0.5, 1.4, 0.745), // overall bib
}));

/* ----- corner roofs, barrel tiles and a metal roof sheet ----- */
const cornerRoof = (n, outer) => (c) => {
  const g = new THREE.Group();
  const H = (BH * n) / 2;
  const A = [0, 0, 0], Bp = [n, 0, 0], C = [n, 0, n], D = [0, 0, n];
  const Bt = [n, H, 0], Ct = [n, H, n], Dt = [0, H, n];
  // outer: two slopes meeting at a hip; inner: two slopes meeting in a valley
  const tris = outer
    ? [[A, Bp, Ct], [A, Ct, D], [Bp, C, Ct], [D, Ct, C], [A, Bp, C], [A, C, D]]
    : [[A, Bt, Ct], [A, Ct, Dt], [Bp, C, Ct], [Bp, Ct, Bt], [D, C, Ct], [D, Ct, Dt], [A, Bp, Bt], [A, D, Dt], [A, Bp, C], [A, C, D]];
  add(g, polyGeo(`corner${outer ? "o" : "i"}${n}`, tris), mat(shade(c, 0.9), { side: THREE.DoubleSide }), 0, 0, 0);
  return g;
};
[2, 4].forEach((n) => {
  reg(`roofcornerout${n}`, `Roof corner outer ${n}×${n}`, n, n, n === 2 ? 1 : 2, false, cornerRoof(n, true));
  reg(`roofcornerin${n}`, `Roof corner inner ${n}×${n}`, n, n, n === 2 ? 1 : 2, false, cornerRoof(n, false));
});
[2, 4].forEach((len) =>
  reg(`barrel${len}`, `Barrel-tile roof ${len}×2`, len, 2, 1, false, (c) => {
    const g = new THREE.Group();
    add(g, roofGeo(len), mat(shade(c, 0.55)), len, 0, 0).rotation.y = -Math.PI / 2;
    const L = Math.hypot(2, BH);
    const cs = 2 / L;
    const sn = BH / L;
    for (let j = 0; j < len * 2; j++) {
      const x = 0.25 + j * 0.5;
      const q = (t) => [x, BH * t + 0.12 * cs, 2 * t - 0.12 * sn]; // a point on the slope, lifted off it a little
      tube(g, q(0.07), q(0.93), 0.15, mat(shade(c, [1, 0.92, 1.06][j % 3])));
    }
    return g;
  })
);
reg("metalroof4", "Metal roof sheet 4×2", 4, 2, 1, false, () => {
  const g = new THREE.Group();
  add(g, roofGeo(4), mat("#7D8791", { metalness: 0.6, roughness: 0.4 }), 4, 0, 0).rotation.y = -Math.PI / 2;
  const L = Math.hypot(2, BH);
  for (let k = 0; k < 10; k++) {
    B(g, 0.12, 0.07, L, mat(k % 2 ? "#AEB6BF" : "#9AA3AD", { metalness: 0.6, roughness: 0.35 }), 0.2 + k * 0.4, BH / 2 + 0.04 * (2 / L), 1 - 0.04 * (BH / L)).rotation.x = -Math.atan2(BH, 2);
  }
  return g;
});

/* ----- roof logs, steel beams and trusses ----- */
[4, 8].forEach((len) =>
  reg(`logbeam${len}`, `Log beam 1×${len}`, 1, len, 0.75, true, () => {
    const g = new THREE.Group();
    logZ(g, 0.4, len - 0.1, 0.5, 0.4, 0.05);
    return g;
  })
);
const logTruss = (len, H) => () => {
  const g = new THREE.Group();
  tube(g, [0.1, 0.3, 0.5], [len / 2, H, 0.5], 0.09, barkMat); // rafters
  tube(g, [len - 0.1, 0.3, 0.5], [len / 2, H, 0.5], 0.09, barkMat);
  tube(g, [0.1, 0.3, 0.5], [len - 0.1, 0.3, 0.5], 0.09, barkMat); // tie beam
  tube(g, [len / 2, 0.3, 0.5], [len / 2, H, 0.5], 0.08, barkMat); // king post
  tube(g, [len / 2, 0.4, 0.5], [len * 0.25, H * 0.5, 0.5], 0.06, barkMat); // struts
  tube(g, [len / 2, 0.4, 0.5], [len * 0.75, H * 0.5, 0.5], 0.06, barkMat);
  return g;
};
reg("logtruss4", "Log roof truss 4×1", 4, 1, 2, false, logTruss(4, 1.7));
reg("logtruss6", "Log roof truss 6×1", 6, 1, 2, false, logTruss(6, 2.2));
const steelSq = mat("#8A929B", { metalness: 0.7, roughness: 0.4 });
[4, 8, 12].forEach((len) =>
  reg(`steel${len}`, `Steel beam 1×${len}`, 1, len, 0.5, true, () => {
    const g = new THREE.Group();
    B(g, 0.6, 0.6, len - 0.04, steelSq, 0.5, 0.3, len / 2); // square-section bar
    [0.01, len - 0.01].forEach((z) => B(g, 0.38, 0.38, 0.02, black, 0.5, 0.3, z)); // hollow ends
    return g;
  })
);
reg("steelpost", "Steel post", 1, 1, 3, true, () => {
  const g = new THREE.Group();
  B(g, 0.5, 3.5, 0.5, steelSq, 0.5, 1.75, 0.5);
  B(g, 0.9, 0.05, 0.9, steelSq, 0.5, 0.025, 0.5);
  return g;
});
reg("steeltruss", "Steel roof truss 6×1", 6, 1, 2, false, () => {
  const g = new THREE.Group();
  const t = 0.1;
  sq(g, [0.1, 0.4, 0.5], [5.9, 0.4, 0.5], t, steelSq);
  sq(g, [0.1, 0.4, 0.5], [3, 2.0, 0.5], t, steelSq);
  sq(g, [5.9, 0.4, 0.5], [3, 2.0, 0.5], t, steelSq);
  [1.5, 3, 4.5].forEach((x) => sq(g, [x, 0.4, 0.5], [x, x === 3 ? 2.0 : 0.4 + 1.6 * (x < 3 ? x / 3 : (6 - x) / 3), 0.5], 0.07, steelSq));
  sq(g, [1.5, 0.4, 0.5], [3, 2.0, 0.5], 0.07, steelSq);
  sq(g, [4.5, 0.4, 0.5], [3, 2.0, 0.5], 0.07, steelSq);
  return g;
});

/* ----- garden things ----- */
const soil = mat("#4A3222");
reg("raisedbed", "Raised garden bed", 2, 4, 1, false, () => {
  const g = new THREE.Group();
  [0.05, 3.95].forEach((z) => B(g, 1.96, 0.8, 0.1, wood, 1, 0.4, z));
  [0.05, 1.95].forEach((x) => B(g, 0.1, 0.8, 3.9, wood, x, 0.4, 2));
  B(g, 1.8, 0.05, 3.8, soil, 1, 0.7, 2);
  for (let k = 0; k < 6; k++) {
    Sph(g, 0.24, k % 2 ? leafA : leafB, 0.55, 0.92, 0.4 + k * 0.6);
    Sph(g, 0.2, mat(k % 3 ? "#D01012" : "#FE8A18"), 1.45, 0.9, 0.7 + k * 0.5);
  }
  return g;
});
reg("wheelbarrow", "Wheelbarrow", 2, 3, 1, false, (c) => {
  const g = new THREE.Group();
  B(g, 1.3, 0.5, 1.3, mat(c), 1, 0.85, 1.5);
  B(g, 1.1, 0.04, 1.1, soil, 1, 1.1, 1.5);
  wheel(g, 1, 0.35, 2.7, 0.35, 0.15);
  [0.4, 1.6].forEach((x) => {
    tube(g, [x, 0.8, 0.95], [x, 0.9, 0.1], 0.05, wood); // handles
    tube(g, [x, 0.75, 0.6], [x, 0, 0.35], 0.04, steel); // legs
  });
  return g;
});
reg("wateringcan", "Watering can", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  Cyl(g, 0.3, 0.3, 0.5, mat(c, { metalness: 0.3 }), 0.4, 0.3, 0.5);
  tube(g, [0.62, 0.35, 0.5], [0.92, 0.75, 0.5], 0.04, steel);
  Cyl(g, 0.1, 0.05, 0.1, steel, 0.95, 0.8, 0.5).rotation.z = -0.8; // rose
  add(g, G(THREE.TorusGeometry, 0.22, 0.025, 6, 12, Math.PI), steel, 0.4, 0.55, 0.5);
  return g;
});
reg("shed", "Garden shed", 4, 4, 3, false, (c) => {
  const g = new THREE.Group();
  B(g, 3.8, 2.2, 3.6, mat(c), 2, 1.1, 2);
  add(g, prismGeo("g", [[0, 0], [4, 0], [2, 1.2]], 4), mat(shade(c, 0.5)), 4, 2.2, 0).rotation.y = -Math.PI / 2; // roof
  B(g, 0.9, 1.7, 0.06, wood, 1.2, 0.85, 3.83); // door
  Sph(g, 0.05, brass, 1.5, 0.85, 3.88);
  B(g, 0.9, 0.8, 0.04, glass(), 3.0, 1.4, 3.83); // window
  B(g, 1.0, 0.9, 0.05, white, 3.0, 1.4, 3.81);
  return g;
});
reg("greenhouse", "Greenhouse", 6, 4, 3, false, () => {
  const g = new THREE.Group();
  const fr = white;
  B(g, 5.9, 0.3, 3.9, fr, 3, 0.15, 2);
  [0.05, 3.95].forEach((z) => B(g, 5.9, 1.6, 0.04, glass(), 3, 1.1, z));
  [0.05, 5.95].forEach((x) => B(g, 0.04, 1.6, 3.9, glass(), x, 1.1, 2));
  [0.05, 2, 4, 5.95].forEach((x) => [0.05, 3.95].forEach((z) => B(g, 0.08, 1.7, 0.08, fr, x, 1.15, z)));
  const ang = Math.atan2(0.8, 2);
  const L = Math.hypot(2, 0.8);
  slope(g, 5.9, L, glass(), 3, 2.3, 1, -ang);
  slope(g, 5.9, L, glass(), 3, 2.3, 3, ang);
  B(g, 6, 0.08, 0.08, fr, 3, 2.7, 2);
  [0.03, 6].forEach((x) => (add(g, prismGeo("gh", [[0, 0], [4, 0], [2, 0.8]], 0.03), glass(), x, 1.9, 0).rotation.y = -Math.PI / 2));
  B(g, 5, 0.06, 0.6, wood, 3, 0.9, 0.5); // potting bench with plants
  for (let k = 0; k < 5; k++) Sph(g, 0.18, k % 2 ? leafA : leafB, 1 + k, 1.15, 0.5);
  return g;
});
reg("pergola", "Pergola", 4, 4, 3, false, () => {
  const g = new THREE.Group();
  [0.2, 3.8].forEach((x) => [0.2, 3.8].forEach((z) => {
    B(g, 0.25, 3.2, 0.25, wood, x, 1.6, z);
    Sph(g, 0.2, leafA, x, 1.4, z);
  }));
  [0.2, 3.8].forEach((z) => B(g, 3.9, 0.2, 0.2, wood, 2, 3.1, z));
  for (let k = 0; k < 8; k++) B(g, 0.12, 0.12, 3.9, wood, 0.3 + k * 0.5, 3.3, 2);
  return g;
});
reg("arch", "Garden arch", 2, 1, 3, false, (c) => {
  const g = new THREE.Group();
  [0.15, 1.85].forEach((x) => B(g, 0.1, 2.2, 0.1, wood, x, 1.1, 0.5));
  add(g, G(THREE.TorusGeometry, 0.85, 0.05, 8, 20, Math.PI), wood, 1, 2.2, 0.5);
  for (let a = 0; a <= Math.PI + 0.01; a += 0.4) Sph(g, 0.1, (a / 0.4) % 2 ? leafA : mat(c), 1 + 0.85 * Math.cos(a), 2.2 + 0.85 * Math.sin(a), 0.5);
  return g;
});
reg("birdbath", "Bird bath", 1, 1, 2, false, () => {
  const g = new THREE.Group();
  const st = mat("#B9B3A8");
  Cyl(g, 0.28, 0.32, 0.12, st, 0.5, 0.06, 0.5);
  Cyl(g, 0.12, 0.18, 1.1, st, 0.5, 0.65, 0.5);
  Cyl(g, 0.45, 0.2, 0.22, st, 0.5, 1.3, 0.5);
  Cyl(g, 0.38, 0.38, 0.03, waterMat, 0.5, 1.4, 0.5);
  return g;
});
reg("scarecrow", "Scarecrow", 1, 1, 3, false, (c) => {
  const g = new THREE.Group();
  const straw = mat("#E3C27A");
  B(g, 0.08, 2.6, 0.08, wood, 0.5, 1.3, 0.5);
  B(g, 0.9, 0.08, 0.08, wood, 0.5, 1.9, 0.5);
  B(g, 0.5, 0.8, 0.2, mat(c), 0.5, 1.6, 0.5);
  Sph(g, 0.22, straw, 0.5, 2.35, 0.5);
  Cyl(g, 0.4, 0.4, 0.04, mat("#5A3A1E"), 0.5, 2.5, 0.5);
  Cyl(g, 0.2, 0.2, 0.2, mat("#5A3A1E"), 0.5, 2.62, 0.5);
  [0.1, 0.9].forEach((x) => Cone(g, 0.05, 0.2, 5, straw, x, 1.8, 0.5).rotation.z = x < 0.5 ? Math.PI / 2 : -Math.PI / 2);
  return g;
});
reg("well", "Stone well", 2, 2, 3, false, (c) => {
  const g = new THREE.Group();
  const st = mat("#9A9690");
  if (!planGeos.well) {
    const sh = new THREE.Shape();
    sh.absarc(0, 0, 0.92, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.62, 0, Math.PI * 2, true);
    sh.holes.push(hole);
    planGeos.well = new THREE.ExtrudeGeometry(sh, { depth: 1.0, bevelEnabled: false, curveSegments: 32 });
  }
  add(g, planGeos.well, st, 1, 0, 1).rotation.x = -Math.PI / 2; // hollow ring wall
  Cyl(g, 0.6, 0.6, 0.04, waterMat, 1, 0.5, 1);
  [0.12, 1.88].forEach((x) => B(g, 0.12, 1.9, 0.12, wood, x, 1.95, 1)); // posts
  tube(g, [0.1, 2.6, 1], [1.9, 2.6, 1], 0.05, wood); // windlass bar
  B(g, 1.15, 0.06, 1.6, mat(c), 0.55, 3.0, 1).rotation.z = 0.45; // little roof
  B(g, 1.15, 0.06, 1.6, mat(c), 1.45, 3.0, 1).rotation.z = -0.45;
  tube(g, [1, 2.6, 1], [1, 2.0, 1], 0.012, steel);
  Cyl(g, 0.15, 0.12, 0.25, wood, 1, 1.85, 1); // bucket
  return g;
});

/* ----- tower and castle parts (round towers stack: shaft, battlements, roof) ----- */
const castleStone = mat("#9A9690");
const castleDark = mat("#7E7A74");
const towerShaft = (n, h) => () => {
  const g = new THREE.Group();
  const r = n / 2 - 0.05;
  Cyl(g, r, r + 0.05, h, castleStone, n / 2, h / 2, n / 2);
  [0.25, 0.5, 0.75].forEach((t) => Cyl(g, r + 0.03, r + 0.03, 0.04, castleDark, n / 2, h * t, n / 2));
  B(g, 0.1, 0.5, 0.08, black, n / 2, h * 0.55, n / 2 + r); // arrow slit
  return g;
};
reg("towerround2", "Round tower 2×2", 2, 2, 2, true, towerShaft(2, 2.4));
reg("towerround4", "Round tower 4×4", 4, 4, 3, true, towerShaft(4, 3.6));
[2, 4].forEach((n) =>
  reg(`towertop${n}`, `Tower battlements ${n}×${n}`, n, n, 1, false, () => {
    const g = new THREE.Group();
    const r = n / 2 - 0.05;
    Cyl(g, r + 0.02, r + 0.02, 0.3, castleStone, n / 2, 0.15, n / 2);
    const count = n === 2 ? 8 : 14;
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2;
      B(g, ((2 * Math.PI * r) / count) * 0.55, 0.4, 0.28, castleStone, n / 2 + (r - 0.1) * Math.cos(a), 0.5, n / 2 + (r - 0.1) * Math.sin(a)).rotation.y = -(a + Math.PI / 2);
    }
    return g;
  })
);
reg("towerroof2", "Tower roof 2×2", 2, 2, 2, false, (c) => {
  const g = new THREE.Group();
  Cone(g, 1.05, 2.2, 24, mat(c), 1, 1.1, 1);
  Sph(g, 0.07, brass, 1, 2.25, 1);
  return g;
});
reg("towerroof4", "Tower roof 4×4", 4, 4, 3, false, (c) => {
  const g = new THREE.Group();
  Cone(g, 2.05, 3.4, 32, mat(c), 2, 1.7, 2);
  Sph(g, 0.1, brass, 2, 3.45, 2);
  return g;
});
reg("castlewall", "Castle wall 4×1", 4, 1, 2, false, () => {
  const g = new THREE.Group();
  B(g, 3.96, 1.8, 0.8, castleStone, 2, 0.9, 0.5);
  [0.6, 1.2].forEach((y) => B(g, 3.96, 0.03, 0.82, castleDark, 2, y, 0.5));
  for (let k = 0; k < 5; k++) B(g, 0.5, 0.4, 0.8, castleStone, 0.3 + k * 0.85, 2.0, 0.5);
  return g;
});
const gateGeo = () => {
  if (!planGeos.gate) {
    const sh = new THREE.Shape();
    sh.moveTo(0.02, 0);
    sh.lineTo(1.1, 0);
    sh.lineTo(1.1, 1.5);
    sh.absarc(2, 1.5, 0.9, Math.PI, 0, true);
    sh.lineTo(2.9, 0);
    sh.lineTo(3.98, 0);
    sh.lineTo(3.98, 3.2);
    sh.lineTo(0.02, 3.2);
    sh.lineTo(0.02, 0);
    planGeos.gate = new THREE.ExtrudeGeometry(sh, { depth: 0.8, bevelEnabled: false, curveSegments: 16 });
  }
  return planGeos.gate;
};
reg("castlegate", "Castle gate 4×1", 4, 1, 3, false, () => {
  const g = new THREE.Group();
  add(g, gateGeo(), castleStone, 0, 0, 0.1);
  for (let k = 0; k < 5; k++) B(g, 0.5, 0.4, 0.8, castleStone, 0.3 + k * 0.85, 3.4, 0.5);
  for (let x = 1.35; x < 2.7; x += 0.25) B(g, 0.05, 1.7, 0.05, ironM, x, 1.0, 0.5); // portcullis
  [0.9, 1.7].forEach((y) => B(g, 1.6, 0.05, 0.05, ironM, 2, y, 0.5));
  return g;
});
reg("flag", "Flag", 1, 1, 3, false, (c) => {
  const g = new THREE.Group();
  Cyl(g, 0.03, 0.03, 2.8, steel, 0.5, 1.4, 0.5);
  Sph(g, 0.06, brass, 0.5, 2.85, 0.5);
  B(g, 0.4, 0.45, 0.03, mat(c), 0.7, 2.5, 0.5);
  return g;
});

/* ---------- customizable roofs: pick the size and style in the app ---------- */
const GROUT = mat("#CFCFD4");
// Tile rows for any slope. Tiles get bigger on big roofs so the part count stays reasonable.
function tileRowsG(g, len, ang, L, c, z0, dz) {
  const tw = Math.max(0.5, len / 14);
  const n = Math.max(1, Math.round(L / (0.55 * (tw / 0.5))));
  const step = L / n;
  for (let i = 0; i < n; i++) {
    const s = (i + 0.5) * step;
    const y = s * Math.sin(ang) + 0.03 * Math.cos(ang);
    const z = z0 + dz * s * Math.cos(ang) - dz * 0.03 * Math.sin(ang);
    for (let j = -1; j * tw < len; j++) {
      const cx = tw / 2 + j * tw + (i % 2 ? tw / 2 : 0);
      const a = Math.max(0, cx - tw / 2);
      const b = Math.min(len, cx + tw / 2);
      if (b - a < tw * 0.15) continue;
      B(g, b - a - 0.03, 0.05, step * 1.08, mat(shade(c, [1, 0.93, 1.06][(i + j + 3) % 3])), (a + b) / 2, y, z).rotation.x = -dz * ang;
    }
  }
}
const scatter = (g, w, d, y, colors, count) => {
  for (let i = 0; i < count; i++)
    B(g, 0.5, 0.03, 0.4, mat(colors[i % colors.length]), 0.3 + rnd(i + 7) * (w - 0.6), y, 0.3 + rnd(i + 57) * (d - 0.6)).rotation.y = rnd(i + 16) * 3;
};
const railRun = (g, ax, az, bx, bz, y0, m) => {
  const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az)));
  for (let i = 0; i <= n; i++) B(g, 0.08, 0.95, 0.08, m, ax + ((bx - ax) * i) / n, y0 + 0.475, az + ((bz - az) * i) / n);
  tube(g, [ax, y0 + 0.95, az], [bx, y0 + 0.95, bz], 0.04, m);
  tube(g, [ax, y0 + 0.55, az], [bx, y0 + 0.55, bz], 0.03, m);
};
const flatRoof = (c, o) => {
  const { w, d, t, surface, edge, skylight } = o;
  const g = new THREE.Group();
  const th = t * BH;
  const trim = mat(shade(c, 0.75));
  if (surface === "glass") {
    // a glass roof: panel in a frame with bars every stud
    B(g, w - 0.04, 0.04, d - 0.04, glass(), w / 2, th - 0.02, d / 2);
    [0.05, d - 0.05].forEach((z) => B(g, w - 0.04, th, 0.1, trim, w / 2, th / 2, z));
    [0.05, w - 0.05].forEach((x) => B(g, 0.1, th, d - 0.04, trim, x, th / 2, d / 2));
    for (let i = 1; i < w; i++) B(g, 0.06, th * 0.8, d - 0.04, trim, i, th * 0.4, d / 2);
    for (let i = 1; i < d; i++) B(g, w - 0.04, th * 0.8, 0.06, trim, w / 2, th * 0.4, i);
  } else {
    const base = { gravel: "#9A9690", grass: "#4C9F4A", metal: "#8F98A3" }[surface] || c;
    B(g, w - 0.04, th, d - 0.04, mat(base, surface === "metal" ? { metalness: 0.6, roughness: 0.4 } : {}), w / 2, th / 2, d / 2);
    if (surface === "tiles") {
      for (let i = 1; i < w; i++) B(g, 0.04, 0.02, d - 0.04, GROUT, i, th + 0.01, d / 2);
      for (let i = 1; i < d; i++) B(g, w - 0.04, 0.02, 0.04, GROUT, w / 2, th + 0.01, i);
    }
    if (surface === "metal") {
      const sp = Math.max(0.4, w / 40);
      for (let x = sp / 2, k = 0; x < w; x += sp, k++) B(g, 0.12, 0.05, d - 0.08, mat(k % 2 ? "#AEB6BF" : "#9AA3AD", { metalness: 0.6, roughness: 0.35 }), x, th + 0.025, d / 2);
    }
    if (surface === "gravel") scatter(g, w, d, th + 0.015, ["#8A8680", "#ABA69E", "#77736D"], Math.min(60, Math.round(w * d)));
    if (surface === "grass") scatter(g, w, d, th + 0.015, ["#3F8F3F", "#5DB25A"], Math.min(60, Math.round(w * d * 0.6)));
  }
  if (edge === "parapet") {
    [0.1, d - 0.1].forEach((z) => B(g, w - 0.04, 0.5, 0.2, trim, w / 2, th + 0.25, z));
    [0.1, w - 0.1].forEach((x) => B(g, 0.2, 0.5, d - 0.4, trim, x, th + 0.25, d / 2));
  }
  if (edge === "rail") {
    const m = mat(c);
    railRun(g, 0.1, 0.1, w - 0.1, 0.1, th, m);
    railRun(g, w - 0.1, 0.1, w - 0.1, d - 0.1, th, m);
    railRun(g, w - 0.1, d - 0.1, 0.1, d - 0.1, th, m);
    railRun(g, 0.1, d - 0.1, 0.1, 0.1, th, m);
  }
  if (skylight && surface !== "glass") {
    const sw = Math.min(2.4, Math.max(0.8, w * 0.4));
    const sd = Math.min(2.4, Math.max(0.8, d * 0.4));
    B(g, sw, 0.3, sd, steel, w / 2, th + 0.15, d / 2);
    B(g, sw - 0.2, 0.05, sd - 0.2, glass(), w / 2, th + 0.32, d / 2);
  }
  return g;
};
regCustom(
  "flatroof",
  "Flat roof (custom)",
  [
    { key: "w", label: "Width", kind: "num", min: 2, max: 16, step: 1, def: 6 },
    { key: "d", label: "Length", kind: "num", min: 2, max: 16, step: 1, def: 6 },
    { key: "t", label: "Thickness", kind: "num", min: 0.25, max: 1, step: 0.25, def: 0.5 },
    { key: "surface", label: "Surface", kind: "sel", def: "plain", options: [["plain", "Plain"], ["gravel", "Gravel"], ["tiles", "Tiles"], ["metal", "Metal"], ["glass", "Glass"], ["grass", "Green roof"]] },
    { key: "edge", label: "Edge", kind: "sel", def: "parapet", options: [["none", "None"], ["parapet", "Parapet"], ["rail", "Rail"]] },
    { key: "skylight", label: "Skylight", kind: "tog", def: false },
  ],
  (o) => ({ w: o.w, d: o.d, h: o.t, top: true }),
  flatRoof
);

const triRoof = (c, o) => {
  const { len, span, pitch, surface, shape, cap } = o;
  const g = new THREE.Group();
  const H = pitch * BH;
  const lean = shape === "lean";
  const slopes = lean ? [{ z0: 0, dz: 1, run: span }] : [{ z0: 0, dz: 1, run: span / 2 }, { z0: span, dz: -1, run: span / 2 }];
  const pts = lean ? [[0, 0], [span, 0], [span, H]] : [[0, 0], [span, 0], [span / 2, H]];
  const key = `tri${span}_${H}_${lean ? "l" : "g"}`;
  const m = mat(c);
  if (surface !== "glass") add(g, prismGeo(key, pts, len), mat(shade(c, surface === "plain" ? 0.9 : 0.55)), len, 0, 0).rotation.y = -Math.PI / 2;
  slopes.forEach(({ z0, dz, run }) => {
    const ang = Math.atan2(H, run);
    const L = Math.hypot(run, H);
    const zm = z0 + dz * (run / 2);
    if (surface === "tiles") tileRowsG(g, len, ang, L, c, z0, dz);
    if (surface === "metal") {
      const sp = Math.max(0.4, len / 30);
      for (let x = sp / 2, k = 0; x < len; x += sp, k++)
        B(g, 0.12, 0.07, L, mat(k % 2 ? "#AEB6BF" : "#9AA3AD", { metalness: 0.6, roughness: 0.35 }), x, H / 2 + 0.04 * Math.cos(ang), zm - dz * 0.04 * Math.sin(ang)).rotation.x = -dz * ang;
    }
    if (surface === "glass") {
      slope(g, len - 0.06, L, glass(), len / 2, H / 2, zm, -dz * ang);
      const gap = Math.max(1, len / 16);
      for (let x = 0.03; x < len - 0.03; x += gap) slope(g, 0.06, L, m, x, H / 2 + 0.03, zm, -dz * ang, 0.07);
      slope(g, 0.06, L, m, len - 0.03, H / 2 + 0.03, zm, -dz * ang, 0.07);
      B(g, len, 0.08, 0.08, m, len / 2, 0.04, z0 === 0 ? 0.04 : span - 0.04); // eave beam
    }
  });
  const ridgeZ = lean ? span : span / 2;
  if (surface === "glass") {
    B(g, len, 0.1, 0.1, m, len / 2, H, ridgeZ);
    [0.03, len].forEach((x) => (add(g, prismGeo(key + "e", pts, 0.03), glass(), x, 0, 0).rotation.y = -Math.PI / 2));
  } else if (cap) {
    Cyl(g, 0.13, 0.13, len, mat(shade(c, 0.8)), len / 2, H + 0.02, ridgeZ).rotation.z = Math.PI / 2;
  }
  return g;
};
regCustom(
  "triroof",
  "Triangle roof (custom)",
  [
    { key: "len", label: "Length (ridge)", kind: "num", min: 1, max: 16, step: 1, def: 4 },
    { key: "span", label: "Span (width)", kind: "num", min: 2, max: 12, step: 1, def: 4 },
    { key: "pitch", label: "Ridge height", kind: "num", min: 0.5, max: 4, step: 0.5, def: 1.5 },
    { key: "surface", label: "Surface", kind: "sel", def: "tiles", options: [["plain", "Plain"], ["tiles", "Tiles"], ["metal", "Metal"], ["glass", "Glass"]] },
    { key: "shape", label: "Shape", kind: "sel", def: "gable", options: [["gable", "Two slopes"], ["lean", "One slope"]] },
    { key: "cap", label: "Ridge cap", kind: "tog", def: true },
  ],
  (o) => ({ w: o.len, d: o.span, h: o.pitch, top: false }),
  triRoof
);

/* ---------- sliding door, curtain window, glass table, lights and custom tiles ---------- */
regCustom(
  "slidingdoor",
  "Sliding door (custom)",
  [
    { key: "w", label: "Width", kind: "num", min: 2, max: 8, step: 1, def: 4 },
    { key: "tall", label: "Height", kind: "num", min: 2, max: 5, step: 1, def: 3 },
    { key: "open", label: "Open (%)", kind: "num", min: 0, max: 100, step: 25, def: 50 },
    { key: "panel", label: "Panels", kind: "sel", def: "glass", options: [["glass", "Glass"], ["wood", "Wood"]] },
  ],
  (o) => ({ w: o.w, d: 1, h: o.tall, top: true }),
  (c, o) => {
    const g = new THREE.Group();
    const { w } = o;
    const H = o.tall * BH;
    const frame = mat(shade(c, 0.55));
    const pm = mat(c);
    [0.075, w - 0.075].forEach((x) => B(g, 0.15, H, 0.5, frame, x, H / 2, 0.5)); // jambs
    B(g, w - 0.04, 0.2, 0.5, frame, w / 2, H - 0.1, 0.5); // top track
    B(g, w - 0.04, 0.08, 0.5, frame, w / 2, 0.04, 0.5); // floor track
    const pw = (w - 0.3) / 2 + 0.12; // the two panels overlap a little
    const ph = H - 0.35;
    const py = 0.1 + ph / 2;
    const panel = (x0, z, handleRight) => {
      const cx = x0 + pw / 2;
      [0.14, 0.1 + ph - 0.04].forEach((y) => B(g, pw, 0.08, 0.06, pm, cx, y, z));
      [x0 + 0.04, x0 + pw - 0.04].forEach((x) => B(g, 0.08, ph, 0.06, pm, x, py, z));
      if (o.panel === "glass") B(g, pw - 0.16, ph - 0.16, 0.03, glass(), cx, py, z);
      else B(g, pw - 0.16, ph - 0.16, 0.04, mat(shade(c, 1.12)), cx, py, z);
      B(g, 0.04, 0.5, 0.08, steel, handleRight ? x0 + pw - 0.12 : x0 + 0.12, py, z);
    };
    const closedX = w - 0.15 - pw;
    panel(0.15, 0.35, true); // fixed panel
    panel(closedX - (o.open / 100) * (closedX - 0.15), 0.62, false); // sliding panel
    return g;
  }
);
regCustom(
  "windowcurtain",
  "Window with curtain (custom)",
  [
    { key: "w", label: "Width", kind: "num", min: 2, max: 8, step: 1, def: 4 },
    { key: "tall", label: "Height", kind: "num", min: 2, max: 5, step: 1, def: 3 },
    { key: "curtain", label: "Curtain", kind: "sel", def: "open", options: [["open", "Open"], ["half", "Half"], ["closed", "Closed"]] },
  ],
  (o) => ({ w: o.w, d: 1, h: o.tall, top: true }),
  (c, o) => {
    const g = new THREE.Group();
    const { w } = o;
    const H = o.tall * BH;
    const fr = mat("#F4F4F4");
    [0.125, w - 0.125].forEach((x) => B(g, 0.25, H, 0.96, fr, x, H / 2, 0.5));
    B(g, w, 0.3, 0.96, fr, w / 2, 0.15, 0.5);
    B(g, w, 0.3, 0.96, fr, w / 2, H - 0.15, 0.5);
    B(g, w - 0.5, H - 0.6, 0.04, glass(), w / 2, H / 2, 0.5);
    B(g, 0.06, H - 0.6, 0.08, fr, w / 2, H / 2, 0.5);
    studs(g, w, 1, H, fr);
    const hang = H - 0.85; // curtain length, from under the rod to just above the sill
    const yc = 0.45 + hang / 2;
    tube(g, [0.1, H - 0.35, 0.9], [w - 0.1, H - 0.35, 0.9], 0.03, steel);
    [0.1, w - 0.1].forEach((x) => Sph(g, 0.06, steel, x, H - 0.35, 0.9));
    const drape = (xa, xb) => {
      const n = Math.max(2, Math.round((xb - xa) / 0.13));
      for (let i = 0; i < n; i++)
        B(g, (xb - xa) / n - 0.01, hang, 0.06 + 0.04 * (i % 2), mat(shade(c, [1, 0.88, 1.1][i % 3])), xa + ((i + 0.5) * (xb - xa)) / n, yc, 0.88 + 0.02 * (i % 2));
    };
    const span = w - 0.5;
    const cw = { open: 0.7, half: span * 0.3, closed: span / 2 }[o.curtain];
    drape(0.25, 0.25 + cw);
    drape(w - 0.25 - cw, w - 0.25);
    return g;
  }
);
regCustom(
  "glasstable",
  "Glass table (custom)",
  [
    { key: "w", label: "Width", kind: "num", min: 2, max: 8, step: 1, def: 4 },
    { key: "d", label: "Length", kind: "num", min: 2, max: 8, step: 1, def: 3 },
    { key: "shape", label: "Shape", kind: "sel", def: "rect", options: [["rect", "Rectangle"], ["round", "Round / oval"]] },
    { key: "legs", label: "Legs", kind: "sel", def: "steel", options: [["steel", "Steel"], ["wood", "Wood"]] },
    { key: "shelf", label: "Lower shelf", kind: "tog", def: false },
  ],
  (o) => ({ w: o.w, d: o.d, h: 1, top: true }),
  (c, o) => {
    const g = new THREE.Group();
    const { w, d } = o;
    if (o.shape === "round") {
      add(g, G(THREE.CylinderGeometry, 1, 1, 0.06, 40), glass(), w / 2, 1.17, d / 2).scale.set(w / 2 - 0.04, 1, d / 2 - 0.04);
      const rim = add(g, G(THREE.TorusGeometry, 1, 0.02, 6, 40), steel, w / 2, 1.17, d / 2);
      rim.scale.set(w / 2 - 0.04, d / 2 - 0.04, 1);
      rim.rotation.x = Math.PI / 2;
    } else {
      B(g, w - 0.04, 0.06, d - 0.04, glass(), w / 2, 1.17, d / 2);
      [0.03, d - 0.03].forEach((z) => B(g, w - 0.04, 0.04, 0.04, steel, w / 2, 1.17, z));
      [0.03, w - 0.03].forEach((x) => B(g, 0.04, 0.04, d - 0.04, steel, x, 1.17, d / 2));
    }
    const ix = o.shape === "round" ? w * 0.22 : w / 2 - 0.3;
    const iz = o.shape === "round" ? d * 0.22 : d / 2 - 0.3;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const x = w / 2 + sx * ix;
      const z = d / 2 + sz * iz;
      if (o.legs === "steel") tube(g, [x, 0, z], [x, 1.14, z], 0.04, steel);
      else B(g, 0.14, 1.14, 0.14, mat("#A8743C"), x, 0.57, z);
    });
    if (o.shelf) B(g, w - 0.8, 0.04, d - 0.8, glass(), w / 2, 0.5, d / 2);
    return g;
  }
);

/* ----- lights: each has Brightness and Light color settings, and the app adds a real light for it ----- */
const TONES = { warm: "#FFD9A0", white: "#FFFFFF", cool: "#BFD8FF" };
const toneOf = (o, c) => (o.tone === "color" ? c : TONES[o.tone]);
const glowMat = (o, c) => {
  const col = toneOf(o, c);
  return mat(col, { emissive: col, emissiveIntensity: o.intensity / 50, transparent: true, opacity: 0.92, roughness: 0.3 });
};
const lightParams = [
  { key: "intensity", label: "Brightness (%)", kind: "num", min: 0, max: 100, step: 5, def: 80 },
  { key: "tone", label: "Light color", kind: "sel", def: "warm", options: [["warm", "Warm"], ["white", "White"], ["cool", "Cool"], ["color", "Chosen color"]] },
];
// the light a piece gives off: position (and aim) relative to the middle of its base
const pointLight = (y, dist, x = 0, z = 0) => (o, c) => ({ kind: "point", pos: [x, y, z], power: o.intensity / 100, color: toneOf(o, c), dist: typeof dist === "function" ? dist(o) : dist });
const spotLight = (pos, dir, angle, dist) => (o, c) => ({ kind: "spot", pos, dir, angle, power: o.intensity / 100, color: toneOf(o, c), dist });
const hangParam = { key: "tall", label: "Height", kind: "num", min: 1, max: 6, step: 1, def: 2 };

regCustom("tablelamp", "Table lamp", lightParams, () => ({ w: 1, d: 1, h: 1, top: false }), (c, o) => {
  const g = new THREE.Group();
  Cyl(g, 0.22, 0.26, 0.08, mat("#5A3A1E"), 0.5, 0.04, 0.5);
  Cyl(g, 0.04, 0.04, 0.45, steel, 0.5, 0.3, 0.5);
  Cyl(g, 0.3, 0.4, 0.5, glowMat(o, c), 0.5, 0.78, 0.5);
  return g;
}, pointLight(0.8, 9));
regCustom("hanglamp", "Hanging lamp", [hangParam, ...lightParams], (o) => ({ w: 1, d: 1, h: o.tall, top: true }), (c, o) => {
  const g = new THREE.Group();
  const H = o.tall * BH;
  B(g, 0.5, 0.08, 0.5, steel, 0.5, H - 0.04, 0.5); // ceiling plate
  tube(g, [0.5, H - 0.08, 0.5], [0.5, 0.78, 0.5], 0.02, black);
  Cyl(g, 0.12, 0.38, 0.3, mat(c), 0.5, 0.7, 0.5);
  Sph(g, 0.14, glowMat(o, c), 0.5, 0.52, 0.5);
  return g;
}, pointLight(0.5, 10));
regCustom("spotlight", "Spotlight", lightParams, () => ({ w: 1, d: 1, h: 2, top: false }), (c, o) => {
  const g = new THREE.Group();
  [[0.2, 0.2], [0.8, 0.2], [0.5, 0.85]].forEach(([x, z]) => tube(g, [x, 0, z], [0.5, 1.5, 0.5], 0.03, steel));
  const head = Cyl(g, 0.26, 0.2, 0.5, mat(c), 0.5, 1.65, 0.55);
  head.rotation.x = 2.09;
  const lens = Cyl(g, 0.22, 0.22, 0.04, glowMat(o, c), 0.5, 1.52, 0.78);
  lens.rotation.x = 2.09;
  return g;
}, spotLight([0, 1.55, 0.3], [0, -0.9, 1.6], 0.55, 14));
regCustom("walllight", "Wall light", lightParams, () => ({ w: 1, d: 1, h: 1, top: false }), (c, o) => {
  const g = new THREE.Group();
  B(g, 0.5, 0.6, 0.06, steel, 0.5, 0.65, 0.1); // mounts on a wall behind it
  tube(g, [0.5, 0.7, 0.1], [0.5, 0.7, 0.4], 0.03, steel);
  Cyl(g, 0.22, 0.14, 0.3, mat(c), 0.5, 0.7, 0.45);
  Sph(g, 0.11, glowMat(o, c), 0.5, 0.65, 0.45);
  return g;
}, pointLight(0.65, 8, 0, 0.2));
regCustom("chandelier", "Chandelier", [hangParam, ...lightParams], (o) => ({ w: 2, d: 2, h: o.tall, top: true }), (c, o) => {
  const g = new THREE.Group();
  const H = o.tall * BH;
  const yb = Math.max(0.7, H - 0.9);
  const glow = glowMat(o, c);
  B(g, 0.6, 0.08, 0.6, steel, 1, H - 0.04, 1);
  tube(g, [1, H - 0.08, 1], [1, yb + 0.12, 1], 0.02, black);
  Sph(g, 0.12, brass, 1, yb, 1);
  add(g, G(THREE.TorusGeometry, 0.6, 0.02, 6, 24), brass, 1, yb - 0.1, 1).rotation.x = Math.PI / 2;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const x = 1 + 0.6 * Math.cos(a);
    const z = 1 + 0.6 * Math.sin(a);
    tube(g, [1, yb, 1], [x, yb - 0.1, z], 0.02, brass);
    Cyl(g, 0.04, 0.04, 0.25, white, x, yb + 0.03, z);
    Sph(g, 0.06, glow, x, yb + 0.2, z);
  }
  return g;
}, (o, c) => ({ kind: "point", pos: [0, Math.max(0.7, o.tall * BH - 0.9) + 0.1, 0], power: o.intensity / 100, color: toneOf(o, c), dist: 13 }));
regCustom("streetlight", "Street light", lightParams, () => ({ w: 1, d: 1, h: 4, top: false }), (c, o) => {
  const g = new THREE.Group();
  Cyl(g, 0.2, 0.25, 0.2, ironM, 0.5, 0.1, 0.5);
  Cyl(g, 0.06, 0.1, 4.5, ironM, 0.5, 2.25, 0.5);
  tube(g, [0.5, 4.45, 0.5], [0.8, 4.55, 0.5], 0.04, ironM);
  B(g, 0.3, 0.1, 0.25, ironM, 0.8, 4.55, 0.5);
  B(g, 0.26, 0.03, 0.2, glowMat(o, c), 0.8, 4.48, 0.5);
  return g;
}, spotLight([0.3, 4.4, 0], [0, -1, 0], 1.0, 14));
regCustom("lantern", "Lantern", lightParams, () => ({ w: 1, d: 1, h: 1, top: false }), (c, o) => {
  const g = new THREE.Group();
  B(g, 0.5, 0.06, 0.5, ironM, 0.5, 0.03, 0.5);
  [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]].forEach(([x, z]) => B(g, 0.05, 0.6, 0.05, ironM, x, 0.36, z));
  B(g, 0.34, 0.5, 0.34, glowMat(o, c), 0.5, 0.36, 0.5);
  Cone(g, 0.34, 0.2, 4, ironM, 0.5, 0.76, 0.5).rotation.y = Math.PI / 4;
  add(g, G(THREE.TorusGeometry, 0.14, 0.015, 6, 12, Math.PI), ironM, 0.5, 0.84, 0.5);
  return g;
}, pointLight(0.4, 7));
regCustom("ledstrip", "LED light bar", [{ key: "len", label: "Length", kind: "num", min: 1, max: 8, step: 1, def: 4 }, ...lightParams], (o) => ({ w: o.len, d: 1, h: 0.25, top: false }), (c, o) => {
  const g = new THREE.Group();
  B(g, o.len - 0.1, 0.12, 0.16, steel, o.len / 2, 0.08, 0.5);
  B(g, o.len - 0.16, 0.04, 0.1, glowMat(o, c), o.len / 2, 0.15, 0.5);
  return g;
}, pointLight(0.35, (o) => 4 + o.len * 0.6));

/* ----- floor and garden tiles in any size, with a choice of tile size ----- */
const cellFit = (w, d, cell, limit = 300) => {
  let k = cell;
  while ((w / k) * (d / k) > limit) k += 0.5; // big areas get bigger tiles so the part count stays reasonable
  return k;
};
const tileGrid = (w, d, cell, fn) => {
  const k = cellFit(w, d, cell);
  const nx = Math.ceil(w / k - 1e-6);
  const nz = Math.ceil(d / k - 1e-6);
  for (let ix = 0; ix < nx; ix++)
    for (let iz = 0; iz < nz; iz++) {
      const x0 = ix * k;
      const z0 = iz * k;
      const x1 = Math.min(w, x0 + k);
      const z1 = Math.min(d, z0 + k);
      fn(ix, iz, (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0);
    }
};
// rows of boards or bricks, every other row shifted half a length
const courses = (g, w, d, len, rowH, colorFor) => {
  for (let r = 0; r * rowH < d - 1e-6; r++) {
    const z0 = r * rowH;
    const z1 = Math.min(d, z0 + rowH);
    for (let k = 0, x = r % 2 ? -len / 2 : 0; x < w; x += len, k++) {
      const a = Math.max(0, x);
      const b = Math.min(w, x + len);
      if (b - a > 0.08) B(g, b - a - 0.05, 0.04, z1 - z0 - 0.05, mat(colorFor(r, k)), (a + b) / 2, 0.28, (z0 + z1) / 2);
    }
  }
};
const tileParams = (patterns) => [
  { key: "w", label: "Width", kind: "num", min: 1, max: 16, step: 1, def: 4 },
  { key: "d", label: "Length", kind: "num", min: 1, max: 16, step: 1, def: 4 },
  { key: "cell", label: "Tile size", kind: "num", min: 0.5, max: 2, step: 0.5, def: 1 },
  { key: "pattern", label: "Pattern", kind: "sel", def: patterns[0][0], options: patterns },
];
regCustom(
  "floortile",
  "Floor tile (custom)",
  tileParams([["checker", "Checker"], ["wood", "Wood"], ["ceramic", "Ceramic"], ["stripes", "Stripes"], ["marble", "Marble"]]),
  (o) => ({ w: o.w, d: o.d, h: 0.25, top: true }),
  (c, o) => {
    const { w, d, pattern } = o;
    const g = new THREE.Group();
    plate(g, w, d, mat({ wood: "#5A3A1E", marble: "#B9B6AE" }[pattern] || "#CFCFD4"));
    if (pattern === "wood") {
      const k = cellFit(w, d, o.cell, 150);
      courses(g, w, d, 2 * k, k / 2, (r, i) => woods[Math.abs(r + i) % 3]);
    } else
      tileGrid(w, d, o.cell, (ix, iz, cx, cz, sx, sz) => {
        const col =
          pattern === "checker" ? ((ix + iz) % 2 ? "#F4F4F4" : c)
          : pattern === "stripes" ? (iz % 2 ? shade(c, 0.55) : c)
          : pattern === "marble" ? shade("#E8E6E1", 0.9 + rnd(ix * 13 + iz) * 0.14)
          : c;
        B(g, sx - 0.04, 0.04, sz - 0.04, mat(col), cx, 0.28, cz);
      });
    return g;
  }
);
regCustom(
  "gardentile",
  "Garden tile (custom)",
  tileParams([["lawn", "Lawn"], ["brick", "Brick"], ["cobble", "Cobblestone"], ["flagstone", "Flagstone"], ["gravel", "Gravel"]]),
  (o) => ({ w: o.w, d: o.d, h: 0.25, top: true }),
  (c, o) => {
    const { w, d, pattern } = o;
    const g = new THREE.Group();
    plate(g, w, d, mat({ lawn: "#4C9F4A", brick: "#A89F91", cobble: "#6E6A63", flagstone: "#4C9F4A", gravel: "#8A8680" }[pattern]));
    if (pattern === "lawn") scatter(g, w, d, 0.28, ["#3F8F3F", "#5DB25A"], Math.min(60, Math.round(w * d * 1.5)));
    if (pattern === "gravel")
      for (let i = 0; i < Math.min(120, Math.round(w * d * 3)); i++)
        Ico(g, 0.1 + rnd(i) * 0.08, mat(stoneC[i % 3], { flatShading: true }), 0.15 + rnd(i + 3) * (w - 0.3), 0.27, 0.15 + rnd(i + 90) * (d - 0.3), 1, 0.4, 1, rnd(i + 5) * 3);
    if (pattern === "brick") {
      const k = cellFit(w, d, o.cell, 150);
      courses(g, w, d, k, k / 2, (r, i) => bricks[Math.abs(r + i) % 3]);
    }
    if (pattern === "cobble")
      tileGrid(w, d, o.cell, (ix, iz, cx, cz, sx, sz) =>
        Ico(g, Math.min(sx, sz) * 0.52, mat(stoneC[(ix * 3 + iz) % 3], { flatShading: true, roughness: 0.95 }), cx + (rnd(ix * 7 + iz) - 0.5) * 0.08, 0.24, cz + (rnd(ix + iz * 5) - 0.5) * 0.08, 1, 0.25, 1, rnd(ix + iz * 11) * 3));
    if (pattern === "flagstone")
      tileGrid(w, d, o.cell, (ix, iz, cx, cz, sx, sz) => {
        B(g, sx * (0.7 + rnd(ix * 9 + iz) * 0.25), 0.05, sz * (0.7 + rnd(ix + iz * 9) * 0.25), mat(stoneC[(ix + iz) % 3]), cx, 0.285, cz).rotation.y = (rnd(ix * 5 + iz * 3) - 0.5) * 0.4;
      });
    return g;
  }
);

/* How the picker groups pieces */

/* =====================================================================
   Big batch: more vehicles, street lights, bridges and beams, flowers,
   trees, animals, kitchen items and landscape.
   ===================================================================== */
const tintM = mat("#2C4A5E", { roughness: 0.15 });
const lampM = mat("#FFF3B0", { emissive: "#FFF3B0", emissiveIntensity: 0.3 });
const tailM = mat("#D01012");
const concreteM = mat("#A9ADB3", { roughness: 0.85 });
const woodM = mat("#A8743C");
const orangeM = mat("#F28C28");

/* ----- road vehicles (front toward +z) ----- */
const lampsAt = (g, len, y = 0.7, xs = [0.45, 1.55]) =>
  xs.forEach((x) => {
    B(g, 0.3, 0.18, 0.06, lampM, x, y, len - 0.1);
    B(g, 0.3, 0.18, 0.06, tailM, x, y, 0.1);
  });
// a passenger car body; returns the roof height
function sedan(g, c, o = {}) {
  const { len = 4, cabZ = 1.55, cabLen = 1.7, cabH = 0.7, lift = 0 } = o;
  const body = mat(c);
  const r = 0.42 + lift;
  for (const x of [0.17, 1.83]) for (const z of [0.85, len - 0.85]) wheel(g, x, r, z, r, 0.28);
  B(g, 1.7, 0.65, len - 0.2, body, 1, 0.625 + lift, len / 2);
  const cy = 0.95 + lift + cabH / 2;
  B(g, 1.5, cabH, cabLen, body, 1, cy, cabZ);
  B(g, 1.52, cabH * 0.57, cabLen * 0.76, tintM, 1, cy, cabZ);
  B(g, 1.3, cabH * 0.57, cabLen + 0.02, tintM, 1, cy, cabZ);
  B(g, 1.5, 0.08, cabLen, body, 1, 0.95 + lift + cabH + 0.04, cabZ);
  lampsAt(g, len, 0.7 + lift);
  return 0.95 + lift + cabH + 0.08;
}
// a truck frame with a cab at the front (+z end) and wheels at the given z positions
function truckBase(g, c, len, axles, cabH = 1.3) {
  B(g, 1.7, 0.5, len - 0.2, black, 1, 0.7, len / 2);
  axles.forEach((z) => [0.17, 1.83].forEach((x) => wheel(g, x, 0.45, z, 0.45, 0.3)));
  B(g, 1.8, cabH, 1.6, mat(c), 1, 0.75 + cabH / 2, len - 1.0);
  B(g, 1.5, 0.5, 0.05, tintM, 1, 0.75 + cabH * 0.7, len - 0.19);
  B(g, 1.82, 0.5, 0.9, tintM, 1, 0.75 + cabH * 0.7, len - 1.0);
  B(g, 1.8, 0.2, 0.1, steel, 1, 0.55, len - 0.1);
  [0.45, 1.55].forEach((x) => {
    B(g, 0.3, 0.18, 0.06, lampM, x, 0.9, len - 0.17);
    B(g, 0.3, 0.18, 0.06, tailM, x, 0.8, 0.1);
  });
}
const beacon = (g, x, y, z, col) => B(g, 0.2, 0.1, 0.2, lit(col), x, y, z);

reg("taxi", "Taxi", 2, 4, 2, false, (c) => {
  const g = new THREE.Group();
  const roof = sedan(g, c);
  B(g, 1.72, 0.1, 3.82, black, 1, 0.78, 2);
  B(g, 0.5, 0.16, 0.26, lit("#FFF6C8"), 1, roof + 0.08, 1.55);
  return g;
});
reg("suv", "SUV", 2, 4, 2, false, (c) => {
  const g = new THREE.Group();
  const roof = sedan(g, c, { cabLen: 2.4, cabZ: 1.7, cabH: 0.85, lift: 0.1 });
  [0.3, 1.7].forEach((x) => B(g, 0.05, 0.05, 2.2, steel, x, roof + 0.05, 1.7));
  Cyl(g, 0.3, 0.3, 0.14, black, 1, 1.1, 0.07).rotation.x = Math.PI / 2;
  return g;
});
reg("policecar", "Police car", 2, 4, 2, false, (c) => {
  const g = new THREE.Group();
  const roof = sedan(g, c);
  B(g, 1.72, 0.2, 2.4, white, 1, 0.65, 2);
  B(g, 0.9, 0.1, 0.25, black, 1, roof + 0.05, 1.55);
  beacon(g, 0.75, roof + 0.13, 1.55, "#FF2A2A");
  beacon(g, 1.25, roof + 0.13, 1.55, "#2A6BFF");
  return g;
});
reg("racecar", "Race car", 2, 4, 1, false, (c) => {
  const g = new THREE.Group();
  const body = mat(c);
  [0.9, 3.0].forEach((z) => [0.2, 1.8].forEach((x) => wheel(g, x, 0.38, z, 0.38, 0.36)));
  B(g, 0.9, 0.3, 3.6, body, 1, 0.5, 2);
  B(g, 0.5, 0.2, 0.8, body, 1, 0.45, 3.7);
  B(g, 0.6, 0.25, 0.7, black, 1, 0.75, 1.6);
  Sph(g, 0.14, white, 1, 0.9, 1.5);
  B(g, 1.9, 0.05, 0.4, black, 1, 0.28, 3.8);
  B(g, 1.8, 0.05, 0.5, black, 1, 1.0, 0.35);
  [0.5, 1.5].forEach((x) => B(g, 0.05, 0.5, 0.1, black, x, 0.75, 0.35));
  B(g, 1.0, 0.04, 0.5, white, 1, 0.66, 2.7);
  return g;
});
reg("pickup", "Pickup truck", 2, 5, 2, false, (c) => {
  const g = new THREE.Group();
  const body = mat(c);
  [0.9, 4.0].forEach((z) => [0.17, 1.83].forEach((x) => wheel(g, x, 0.42, z, 0.42, 0.28)));
  B(g, 1.7, 0.6, 4.8, body, 1, 0.6, 2.5);
  B(g, 1.5, 0.75, 1.5, body, 1, 1.275, 2.9);
  B(g, 1.52, 0.4, 1.0, tintM, 1, 1.35, 2.9);
  B(g, 1.3, 0.4, 1.52, tintM, 1, 1.35, 2.9);
  B(g, 1.5, 0.08, 1.5, body, 1, 1.69, 2.9);
  B(g, 1.6, 0.06, 2.0, black, 1, 0.93, 1.1);
  [0.12, 1.88].forEach((x) => B(g, 0.08, 0.45, 2.0, body, x, 1.15, 1.1));
  B(g, 1.7, 0.45, 0.08, body, 1, 1.15, 0.1);
  lampsAt(g, 5);
  return g;
});
// van body shared by the van and the ambulance
function vanBody(g, col, accent) {
  const body = mat(col);
  [0.95, 4.0].forEach((z) => [0.17, 1.83].forEach((x) => wheel(g, x, 0.42, z, 0.42, 0.28)));
  B(g, 1.7, 0.5, 4.8, black, 1, 0.55, 2.5);
  B(g, 1.8, 1.0, 3.3, body, 1, 1.3, 1.75);
  B(g, 1.7, 1.0, 1.4, body, 1, 1.3, 4.1);
  B(g, 1.72, 0.4, 1.0, tintM, 1, 1.5, 4.15);
  B(g, 1.5, 0.45, 0.05, tintM, 1, 1.5, 4.82);
  if (accent) B(g, 1.82, 0.14, 3.3, mat(accent), 1, 1.1, 1.75);
  lampsAt(g, 5);
}
reg("van", "Van", 2, 5, 2, false, (c) => {
  const g = new THREE.Group();
  vanBody(g, c, null);
  return g;
});
reg("ambulance", "Ambulance", 2, 5, 2, false, (c) => {
  const g = new THREE.Group();
  vanBody(g, "#F4F4F4", c);
  [0.09, 1.91].forEach((x) => {
    B(g, 0.04, 0.5, 0.14, tailM, x, 1.5, 1.7);
    B(g, 0.04, 0.14, 0.5, tailM, x, 1.5, 1.7);
  });
  beacon(g, 0.7, 1.85, 4.1, "#FF2A2A");
  beacon(g, 1.3, 1.85, 4.1, "#2A6BFF");
  return g;
});
reg("firetruck", "Fire truck", 2, 7, 2, false, (c) => {
  const g = new THREE.Group();
  truckBase(g, c, 7, [1.0, 2.2, 5.9], 1.0);
  const body = mat(c);
  B(g, 1.8, 0.9, 4.2, body, 1, 1.35, 2.8);
  B(g, 1.84, 0.5, 3.8, steel, 1, 1.3, 2.8);
  [0.6, 1.4].forEach((x) => B(g, 0.05, 0.05, 4.6, steel, x, 1.95, 2.7));
  for (let z = 0.6; z < 5; z += 0.45) B(g, 0.8, 0.04, 0.04, steel, 1, 1.95, z);
  beacon(g, 0.65, 1.95, 6.1, "#FF2A2A");
  beacon(g, 1.35, 1.95, 6.1, "#2A6BFF");
  return g;
});
reg("truck", "Cargo truck", 2, 7, 3, false, (c) => {
  const g = new THREE.Group();
  truckBase(g, c, 7, [0.9, 2.0, 5.9]);
  B(g, 1.9, 1.9, 5.0, white, 1, 1.9, 2.9);
  B(g, 1.92, 0.12, 5.0, mat(shade(c, 0.9)), 1, 1.2, 2.9);
  return g;
});
reg("dumptruck", "Dump truck", 2, 6, 3, false, (c) => {
  const g = new THREE.Group();
  truckBase(g, c, 6, [0.9, 1.9, 4.6]);
  B(g, 1.9, 0.9, 3.8, mat(shade(c, 0.85)), 1, 1.6, 2.1).rotation.x = 0.12;
  tube(g, [1, 0.95, 3.4], [1, 1.45, 2.6], 0.06, steel);
  return g;
});
reg("cement", "Cement mixer", 2, 6, 3, false, (c) => {
  const g = new THREE.Group();
  truckBase(g, c, 6, [0.9, 1.9, 4.7]);
  Cyl(g, 0.8, 0.35, 3.0, orangeM, 1, 1.95, 2.55).rotation.x = Math.PI / 2 + 0.3;
  B(g, 0.3, 0.08, 0.8, steel, 1, 2.45, 0.7).rotation.x = 0.5;
  tube(g, [1.7, 0.9, 1.0], [1.7, 2.6, 1.0], 0.03, steel);
  return g;
});
reg("tractor", "Tractor", 2, 3, 2, false, (c) => {
  const g = new THREE.Group();
  const body = mat(c);
  B(g, 0.9, 0.3, 2.6, black, 1, 0.7, 1.5);
  B(g, 0.9, 0.75, 1.3, body, 1, 1.15, 2.2);
  [0.17, 1.83].forEach((x) => {
    wheel(g, x, 0.75, 0.85, 0.75, 0.33);
    wheel(g, x, 0.4, 2.45, 0.4, 0.25);
  });
  [[0.45, 0.35], [1.55, 0.35], [0.45, 1.4], [1.55, 1.4]].forEach(([x, z]) => B(g, 0.07, 1.1, 0.07, body, x, 1.55, z));
  B(g, 1.3, 0.07, 1.2, body, 1, 2.15, 0.9);
  B(g, 0.6, 0.15, 0.5, black, 1, 1.0, 0.8);
  Cyl(g, 0.05, 0.05, 0.6, black, 0.75, 1.9, 2.5);
  [0.6, 1.4].forEach((x) => B(g, 0.2, 0.15, 0.06, lampM, x, 1.2, 2.88));
  return g;
});
reg("excavator", "Excavator", 3, 5, 3, false, (c) => {
  const g = new THREE.Group();
  const body = mat(c);
  [0.5, 2.5].forEach((x) => {
    B(g, 0.7, 0.55, 4.2, black, x, 0.4, 2.2);
    [0.5, 1.4, 2.3, 3.2, 3.9].forEach((z) => Cyl(g, 0.22, 0.22, 0.74, steel, x, 0.4, z).rotation.z = Math.PI / 2);
  });
  B(g, 2.2, 0.35, 2.2, body, 1.5, 0.85, 1.7);
  B(g, 2.2, 0.55, 1.0, body, 1.5, 1.3, 0.8);
  B(g, 1.0, 1.0, 1.1, body, 0.95, 1.6, 2.2);
  B(g, 0.9, 0.55, 1.0, tintM, 0.95, 1.8, 2.25);
  tube(g, [1.9, 1.3, 2.4], [1.9, 3.2, 3.8], 0.14, body);
  tube(g, [1.9, 3.2, 3.8], [1.9, 1.7, 4.6], 0.11, body);
  B(g, 0.7, 0.45, 0.35, steel, 1.9, 1.4, 4.65).rotation.x = 0.4;
  return g;
});
reg("bulldozer", "Bulldozer", 3, 4, 2, false, (c) => {
  const g = new THREE.Group();
  const body = mat(c);
  [0.45, 2.55].forEach((x) => {
    B(g, 0.7, 0.7, 3.4, black, x, 0.4, 1.9);
    [0.5, 1.4, 2.4, 3.2].forEach((z) => Cyl(g, 0.25, 0.25, 0.74, steel, x, 0.4, z).rotation.z = Math.PI / 2);
  });
  B(g, 1.7, 0.7, 2.4, body, 1.5, 1.0, 1.6);
  B(g, 1.5, 0.3, 1.0, body, 1.5, 1.4, 2.5);
  B(g, 1.4, 0.8, 1.2, body, 1.5, 1.75, 0.9);
  B(g, 1.42, 0.45, 0.9, tintM, 1.5, 1.85, 0.9);
  B(g, 1.6, 0.06, 1.3, body, 1.5, 2.2, 0.9);
  B(g, 2.9, 0.95, 0.15, steel, 1.5, 0.75, 3.85);
  [0.8, 2.2].forEach((x) => tube(g, [x, 0.8, 2.7], [x, 0.75, 3.8], 0.06, steel));
  return g;
});
reg("crane", "Mobile crane", 2, 8, 4, false, (c) => {
  const g = new THREE.Group();
  truckBase(g, c, 8, [1.0, 2.3, 6.9]);
  B(g, 1.9, 0.25, 5.2, mat(shade(c, 0.8)), 1, 1.0, 3.2);
  [0.2, 1.8].forEach((x) => tube(g, [x, 1.0, 1.5], [x, 0.1, 1.5], 0.07, steel));
  tube(g, [1, 1.3, 1.2], [1, 4.3, 6.6], 0.15, mat("#F2CD37"));
  tube(g, [1, 4.3, 6.6], [1, 3.0, 6.6], 0.02, black);
  Sph(g, 0.1, steel, 1, 2.95, 6.6);
  return g;
});
reg("rickshaw", "Auto rickshaw", 2, 3, 2, false, (c) => {
  const g = new THREE.Group();
  const body = mat(c);
  wheel(g, 1, 0.35, 2.6, 0.35, 0.22);
  [0.17, 1.83].forEach((x) => wheel(g, x, 0.35, 0.6, 0.35, 0.25));
  B(g, 1.5, 0.45, 2.0, body, 1, 0.65, 1.2);
  B(g, 0.8, 0.5, 0.8, body, 1, 0.85, 2.4);
  B(g, 1.5, 0.5, 0.9, mat("#3A2A1A"), 1, 1.0, 0.6);
  [[0.2, 0.2], [1.8, 0.2], [0.2, 1.7], [1.8, 1.7]].forEach(([x, z]) => B(g, 0.06, 1.1, 0.06, black, x, 1.45, z));
  B(g, 1.8, 0.08, 1.7, mat("#222"), 1, 2.0, 0.95);
  B(g, 1.3, 0.5, 0.05, tintM, 1, 1.55, 1.78);
  tube(g, [0.5, 1.2, 2.3], [1.5, 1.2, 2.3], 0.03, black);
  B(g, 0.25, 0.15, 0.06, lampM, 1, 0.95, 2.82);
  return g;
});
reg("schoolbus", "School bus", 2, 6, 2, false, (c) => {
  const g = new THREE.Group();
  const body = mat(c);
  [1.0, 4.6].forEach((z) => [0.17, 1.83].forEach((x) => wheel(g, x, 0.42, z, 0.42, 0.28)));
  B(g, 1.9, 1.4, 4.7, body, 1, 1.15, 2.45);
  B(g, 1.8, 0.8, 1.0, body, 1, 0.9, 5.4);
  B(g, 1.92, 0.4, 4.4, tintM, 1, 1.45, 2.4);
  B(g, 1.92, 0.1, 4.7, black, 1, 0.95, 2.45);
  B(g, 1.5, 0.4, 0.05, tintM, 1, 1.4, 5.0);
  [0.45, 1.55].forEach((x) => B(g, 0.3, 0.16, 0.06, lampM, x, 0.8, 5.92));
  B(g, 0.5, 0.2, 0.04, tailM, 1, 0.8, 0.1);
  return g;
});
reg("doubledecker", "Double-decker bus", 2, 6, 3, false, (c) => {
  const g = new THREE.Group();
  const body = mat(c);
  [1.0, 4.7].forEach((z) => [0.17, 1.83].forEach((x) => wheel(g, x, 0.42, z, 0.42, 0.28)));
  B(g, 1.9, 3.0, 5.8, body, 1, 1.85, 3);
  [1.35, 2.75].forEach((y) => {
    B(g, 1.92, 0.55, 5.2, tintM, 1, y, 3);
    B(g, 1.7, 0.55, 5.84, tintM, 1, y, 3);
  });
  B(g, 1.92, 0.08, 5.8, white, 1, 2.1, 3);
  B(g, 1.94, 0.08, 5.82, white, 1, 3.4, 3);
  B(g, 1.9, 0.1, 5.8, mat(shade(c, 0.8)), 1, 3.38, 3);
  return g;
});
reg("tram", "Tram", 2, 8, 2, false, (c) => {
  const g = new THREE.Group();
  [1.2, 6.8].forEach((z) => [0.2, 1.8].forEach((x) => wheel(g, x, 0.3, z, 0.3, 0.2)));
  B(g, 1.9, 1.4, 7.8, mat(c), 1, 1.0, 4);
  B(g, 1.92, 0.5, 7.2, tintM, 1, 1.3, 4);
  B(g, 1.9, 0.1, 7.8, white, 1, 1.75, 4);
  [[0.6, 6.8], [1.4, 6.8]].forEach(([x, z]) => tube(g, [x, 1.8, z - 0.9], [1, 2.25, z], 0.03, black));
  B(g, 1.0, 0.04, 0.5, black, 1, 2.28, 6.8);
  [0.6, 1.4].forEach((x) => B(g, 0.2, 0.15, 0.06, lampM, x, 0.7, 7.93));
  return g;
});
reg("balloon", "Hot air balloon", 3, 3, 6, false, (c) => {
  const g = new THREE.Group();
  const env = Sph(g, 1.4, mat(c), 1.5, 4.3, 1.5);
  env.scale.set(1, 1.25, 1);
  [-0.6, 0.5].forEach((dy) => {
    const R = 1.4 * Math.sqrt(1 - Math.pow(dy / 1.75, 2)) + 0.015;
    add(g, G(THREE.TorusGeometry, R, 0.05, 6, 28), white, 1.5, 4.3 + dy, 1.5).rotation.x = Math.PI / 2;
  });
  B(g, 0.7, 0.45, 0.7, mat("#8A5A2B"), 1.5, 0.45, 1.5);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => tube(g, [1.5 + sx * 0.33, 0.65, 1.5 + sz * 0.33], [1.5 + sx * 0.6, 2.7, 1.5 + sz * 0.6], 0.02, black));
  Cone(g, 0.12, 0.3, 8, lit("#FF9A2A"), 1.5, 1.4, 1.5).rotation.x = Math.PI;
  tube(g, [1.5, 0.7, 1.5], [1.5, 1.25, 1.5], 0.03, steel);
  return g;
});
reg("airplane", "Passenger plane", 8, 10, 3, false, (c) => {
  const g = new THREE.Group();
  const flatz = (o) => ((o.rotation.x = Math.PI / 2), o);
  flatz(Cyl(g, 0.7, 0.7, 7.2, white, 4, 1.0, 5.0));
  flatz(Cone(g, 0.7, 1.4, 16, white, 4, 1.0, 9.3));
  (Cone(g, 0.7, 1.4, 16, white, 4, 1.0, 0.7).rotation.x = -Math.PI / 2);
  B(g, 8, 0.1, 1.6, white, 4, 0.85, 5.0);
  [0.15, 7.85].forEach((x) => B(g, 0.3, 0.12, 1.0, mat(c), x, 0.85, 5.0));
  B(g, 0.1, 1.5, 1.2, mat(c), 4, 1.9, 0.9);
  B(g, 3.2, 0.08, 0.8, white, 4, 1.15, 0.8);
  [2.2, 5.8].forEach((x) => flatz(Cyl(g, 0.35, 0.35, 1.2, steel, x, 0.65, 4.8)));
  for (let z = 2.2; z < 8; z += 0.6) [3.28, 4.72].forEach((x) => Sph(g, 0.07, tintM, x, 1.25, z));
  B(g, 0.9, 0.3, 0.05, tintM, 4, 1.15, 9.0);
  [3.3, 4.7].forEach((x) => wheel(g, x, 0.28, 5.6, 0.28, 0.2));
  wheel(g, 4, 0.28, 8.4, 0.28, 0.2);
  [3.3, 4.7].forEach((x) => tube(g, [x, 0.3, 5.6], [x, 0.4, 5.6], 0.05, steel));
  return g;
});
reg("rocket", "Rocket", 2, 2, 6, false, (c) => {
  const g = new THREE.Group();
  Cyl(g, 0.5, 0.5, 4, mat(c), 1, 3.0, 1);
  Cone(g, 0.5, 1.4, 16, tailM, 1, 5.7, 1);
  Cyl(g, 0.5, 0.5, 0.15, white, 1, 4.9, 1);
  [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]].forEach(([dx, dz]) =>
    B(g, dz ? 0.08 : 0.6, 1.2, dz ? 0.6 : 0.08, tailM, 1 + dx, 1.4, 1 + dz)
  );
  Cyl(g, 0.3, 0.2, 0.3, steel, 1, 0.85, 1);
  Cone(g, 0.2, 0.6, 12, lit("#FF9A2A"), 1, 0.4, 1).rotation.x = Math.PI;
  Sph(g, 0.17, tintM, 1, 3.9, 1.47).scale.set(1, 1, 0.5);
  Sph(g, 0.17, tintM, 1, 3.0, 1.47).scale.set(1, 1, 0.5);
  return g;
});
reg("submarine", "Submarine", 2, 6, 2, false, (c) => {
  const g = new THREE.Group();
  const body = mat(c);
  Cyl(g, 0.8, 0.8, 3.2, body, 1, 1.0, 3).rotation.x = Math.PI / 2;
  [1.4, 4.6].forEach((z) => Sph(g, 0.8, body, 1, 1.0, z).scale.set(1, 1, 1.5));
  B(g, 0.5, 0.6, 1.0, body, 1, 2.05, 3.2);
  tube(g, [1, 2.3, 3.5], [1, 2.38, 3.5], 0.04, black);
  [0.2, 1.8].forEach((x) => B(g, 0.6, 0.06, 0.6, body, x, 1.0, 1.0));
  B(g, 0.06, 0.6, 0.6, body, 1, 1.0, 0.6);
  [-1, 1].forEach((s) => B(g, 0.08, 0.5, 0.05, steel, 1 + s * 0.2, 1.0, 0.25));
  [2.2, 3.0, 3.8].forEach((z) => [0.2, 1.8].forEach((x) => Sph(g, 0.12, tintM, x, 1.2, z)));
  return g;
});
reg("canoe", "Canoe", 1, 4, 1, false, (c) => {
  const g = new THREE.Group();
  hull(g, 1, 4, 1.0, 0.35, mat(c));
  B(g, 0.6, 0.05, 0.25, woodM, 0.5, 0.4, 1.8);
  B(g, 0.6, 0.05, 0.25, woodM, 0.5, 0.4, 2.6);
  tube(g, [0.2, 0.4, 2.0], [0.8, 0.9, 3.0], 0.03, woodM);
  B(g, 0.15, 0.02, 0.4, woodM, 0.8, 0.95, 3.1);
  return g;
});

/* ----- more street and garden lights (each has Brightness and Light color) ----- */
regCustom("streetlight2", "Double street light", lightParams, () => ({ w: 3, d: 1, h: 4, top: false }), (c, o) => {
  const g = new THREE.Group();
  Cyl(g, 0.2, 0.25, 0.2, ironM, 1.5, 0.1, 0.5);
  Cyl(g, 0.06, 0.1, 4.5, ironM, 1.5, 2.25, 0.5);
  [-1, 1].forEach((s) => {
    tube(g, [1.5, 4.4, 0.5], [1.5 + s * 1.1, 4.55, 0.5], 0.04, ironM);
    B(g, 0.3, 0.1, 0.25, ironM, 1.5 + s * 1.2, 4.55, 0.5);
    B(g, 0.26, 0.03, 0.2, glowMat(o, c), 1.5 + s * 1.2, 4.48, 0.5);
  });
  return g;
}, pointLight(4.3, 16));
regCustom("curvedlight", "Curved street light", lightParams, () => ({ w: 1, d: 1, h: 4, top: false }), (c, o) => {
  const g = new THREE.Group();
  Cyl(g, 0.2, 0.25, 0.2, ironM, 0.2, 0.1, 0.5);
  Cyl(g, 0.05, 0.09, 3.6, ironM, 0.2, 1.9, 0.5);
  for (let i = 0; i < 6; i++) {
    const a0 = Math.PI - (i / 6) * (Math.PI / 2);
    const a1 = Math.PI - ((i + 1) / 6) * (Math.PI / 2);
    tube(g, [0.75 + 0.55 * Math.cos(a0), 3.7 + 0.55 * Math.sin(a0), 0.5], [0.75 + 0.55 * Math.cos(a1), 3.7 + 0.55 * Math.sin(a1), 0.5], 0.05, ironM);
  }
  B(g, 0.4, 0.07, 0.2, ironM, 0.9, 4.27, 0.5);
  B(g, 0.36, 0.03, 0.16, glowMat(o, c), 0.9, 4.22, 0.5);
  return g;
}, spotLight([0.4, 4.2, 0], [0, -1, 0], 1.0, 14));
regCustom("solarlight", "Solar street light", lightParams, () => ({ w: 1, d: 1, h: 4, top: false }), (c, o) => {
  const g = new THREE.Group();
  Cyl(g, 0.2, 0.25, 0.2, ironM, 0.5, 0.1, 0.5);
  Cyl(g, 0.05, 0.08, 3.7, ironM, 0.5, 1.95, 0.5);
  B(g, 0.9, 0.05, 0.6, mat("#1F3A6E"), 0.5, 4.05, 0.4).rotation.x = -0.4;
  tube(g, [0.5, 3.6, 0.5], [0.5, 3.6, 0.85], 0.04, ironM);
  Cyl(g, 0.1, 0.15, 0.1, glowMat(o, c), 0.5, 3.55, 0.85);
  return g;
}, spotLight([0, 3.5, 0.35], [0, -1, 0], 1.0, 12));
regCustom("bollardlight", "Bollard light", lightParams, () => ({ w: 1, d: 1, h: 1, top: false }), (c, o) => {
  const g = new THREE.Group();
  Cyl(g, 0.2, 0.22, 0.7, ironM, 0.5, 0.35, 0.5);
  Cyl(g, 0.205, 0.205, 0.2, glowMat(o, c), 0.5, 0.5, 0.5);
  Cyl(g, 0.12, 0.2, 0.08, ironM, 0.5, 0.74, 0.5);
  return g;
}, pointLight(0.5, 6));
regCustom("pathlight", "Garden path light", lightParams, () => ({ w: 1, d: 1, h: 1, top: false }), (c, o) => {
  const g = new THREE.Group();
  Cyl(g, 0.03, 0.03, 0.55, ironM, 0.5, 0.28, 0.5);
  Cyl(g, 0.08, 0.26, 0.16, ironM, 0.5, 0.63, 0.5);
  Sph(g, 0.1, glowMat(o, c), 0.5, 0.55, 0.5);
  return g;
}, pointLight(0.55, 5));
regCustom("floodlight", "Flood light tower", lightParams, () => ({ w: 1, d: 1, h: 6, top: false }), (c, o) => {
  const g = new THREE.Group();
  Cyl(g, 0.25, 0.3, 0.2, ironM, 0.5, 0.1, 0.5);
  Cyl(g, 0.06, 0.1, 6.5, ironM, 0.5, 3.35, 0.5);
  B(g, 0.9, 0.1, 0.15, ironM, 0.5, 6.6, 0.45);
  const head = new THREE.Group();
  head.position.set(0.5, 6.7, 0.5);
  head.rotation.x = 0.6;
  [-0.3, 0, 0.3].forEach((x) => {
    B(head, 0.26, 0.4, 0.08, ironM, x, 0, 0);
    B(head, 0.22, 0.34, 0.03, glowMat(o, c), x, 0, 0.05);
  });
  g.add(head);
  return g;
}, spotLight([0, 6.6, 0.3], [0, -0.6, 0.8], 0.9, 22));
reg("trafficlight", "Traffic light", 1, 1, 4, false, () => {
  const g = new THREE.Group();
  Cyl(g, 0.2, 0.25, 0.2, ironM, 0.5, 0.1, 0.5);
  Cyl(g, 0.05, 0.07, 3.1, ironM, 0.5, 1.65, 0.5);
  B(g, 0.32, 0.95, 0.28, black, 0.5, 3.6, 0.5);
  [["#FF2A2A", 3.9], ["#FFC21A", 3.6], ["#2AD04A", 3.3]].forEach(([col, y]) => {
    Sph(g, 0.08, lit(col), 0.5, y, 0.65);
    B(g, 0.2, 0.04, 0.1, black, 0.5, y + 0.1, 0.68);
  });
  return g;
});
reg("roadsign", "Road sign", 1, 1, 3, false, (c) => {
  const g = new THREE.Group();
  Cyl(g, 0.2, 0.25, 0.15, ironM, 0.5, 0.07, 0.5);
  Cyl(g, 0.04, 0.05, 2.3, steel, 0.5, 1.2, 0.5);
  B(g, 0.55, 0.55, 0.05, white, 0.5, 2.5, 0.5).rotation.z = Math.PI / 4;
  B(g, 0.46, 0.46, 0.06, mat(c), 0.5, 2.5, 0.5).rotation.z = Math.PI / 4;
  B(g, 0.1, 0.3, 0.07, white, 0.5, 2.5, 0.5);
  return g;
});

/* ----- bridges and construction ----- */
regCustom("bridgedeck", "Bridge deck (custom)", [
  { key: "len", label: "Length", kind: "num", min: 2, max: 12, step: 1, def: 6 },
  { key: "wid", label: "Width", kind: "num", min: 2, max: 6, step: 1, def: 3 },
  { key: "kind", label: "Deck", kind: "sel", def: "road", options: [["road", "Road"], ["steel", "Steel"], ["wood", "Wood planks"]] },
  { key: "rails", label: "Side rails", kind: "tog", def: true },
], (o) => ({ w: o.len, d: o.wid, h: 1, top: !o.rails }), (c, o) => {
  const g = new THREE.Group();
  const { len, wid } = o;
  const slab = o.kind === "road" ? mat("#6C7078", { roughness: 0.8 }) : o.kind === "steel" ? mat("#7C8794", { metalness: 0.5, roughness: 0.4 }) : woodM;
  B(g, len - 0.04, 0.4, wid - 0.04, slab, len / 2, 0.2, wid / 2);
  if (o.kind === "road") for (let x = 0.4; x < len - 0.3; x += 0.9) B(g, 0.5, 0.02, 0.07, white, x + 0.25, 0.41, wid / 2);
  if (o.kind === "wood") for (let x = 0.5; x < len; x += 0.5) B(g, 0.03, 0.02, wid - 0.1, mat("#7A4E22"), x, 0.41, wid / 2);
  if (o.rails) {
    const rail = mat(c);
    [0.1, wid - 0.1].forEach((z) => {
      B(g, len - 0.04, 0.07, 0.07, rail, len / 2, 1.05, z);
      B(g, len - 0.04, 0.05, 0.05, rail, len / 2, 0.7, z);
      for (let x = 0.1; x <= len - 0.09; x += 1) B(g, 0.07, 0.65, 0.07, rail, x, 0.72, z);
      if (len - 0.1 - Math.floor(len - 0.1) > 0.01) B(g, 0.07, 0.65, 0.07, rail, len - 0.1, 0.72, z);
    });
  }
  return g;
});
regCustom("bridgepier", "Bridge pier (custom)", [
  { key: "tall", label: "Height", kind: "num", min: 1, max: 8, step: 1, def: 4 },
  { key: "style", label: "Style", kind: "sel", def: "twin", options: [["twin", "Twin columns"], ["solid", "Solid wall"], ["round", "Round column"]] },
], (o) => ({ w: 2, d: 2, h: o.tall, top: true }), (c, o) => {
  const g = new THREE.Group();
  const H = o.tall * BH;
  B(g, 1.9, 0.3, 1.9, concreteM, 1, 0.15, 1);
  if (o.style === "twin") [0.55, 1.45].forEach((x) => B(g, 0.5, H - 0.7, 0.8, concreteM, x, 0.3 + (H - 0.7) / 2, 1));
  else if (o.style === "solid") B(g, 1.4, H - 0.7, 0.8, concreteM, 1, 0.3 + (H - 0.7) / 2, 1);
  else Cyl(g, 0.55, 0.65, H - 0.7, concreteM, 1, 0.3 + (H - 0.7) / 2, 1);
  B(g, 2, 0.4, 1.4, mat(c), 1, H - 0.2, 1);
  return g;
});
reg("bridgearch", "Arch bridge 8×3", 8, 3, 4, false, (c) => {
  const g = new THREE.Group();
  const R = 3.5;
  B(g, 8, 0.4, 3, concreteM, 4, 4.0, 1.5);
  B(g, 7.9, 0.02, 2.9, mat("#6C7078"), 4, 4.21, 1.5);
  [0.4, 2.6].forEach((z) => {
    add(g, G(THREE.TorusGeometry, R, 0.22, 6, 28, Math.PI), mat(c), 4, 0, z);
    [1.2, 2.2, 3.2, 4, 4.8, 5.8, 6.8].forEach((x) => {
      const ya = Math.sqrt(R * R - (x - 4) * (x - 4));
      tube(g, [x, ya + 0.1, z], [x, 3.8, z], 0.07, concreteM);
    });
    B(g, 7.9, 0.07, 0.07, steel, 4, 4.55, z === 0.4 ? 0.1 : 2.9);
    for (let x = 0.1; x < 8; x += 1) B(g, 0.06, 0.35, 0.06, steel, x, 4.38, z === 0.4 ? 0.1 : 2.9);
  });
  [0.3, 7.7].forEach((x) => B(g, 0.6, 3.8, 3, concreteM, x, 1.9, 1.5));
  return g;
});
reg("trussbridge", "Truss bridge 8×3", 8, 3, 3, false, (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  B(g, 8, 0.3, 3, woodM, 4, 0.15, 1.5);
  [0.1, 2.9].forEach((z) => {
    B(g, 8, 0.15, 0.15, m, 4, 3.4, z);
    B(g, 8, 0.15, 0.15, m, 4, 0.37, z);
    for (let i = 0; i <= 8; i++) B(g, 0.1, 3.0, 0.1, m, i === 0 ? 0.08 : i === 8 ? 7.92 : i, 1.9, z);
    for (let i = 0; i < 8; i++) tube(g, i % 2 ? [i + 1, 0.4, z] : [i, 0.4, z], i % 2 ? [i, 3.35, z] : [i + 1, 3.35, z], 0.05, m);
  });
  for (let x = 1; x < 8; x += 2) B(g, 0.1, 0.1, 3, m, x, 3.4, 1.5);
  return g;
});
reg("suspension", "Suspension bridge 12×3", 12, 3, 6, false, (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  B(g, 12, 0.3, 3, mat("#6C7078", { roughness: 0.8 }), 6, 0.3, 1.5);
  [1.5, 10.5].forEach((tx) => {
    [0.3, 2.7].forEach((z) => B(g, 0.3, 6.6, 0.3, m, tx, 3.3, z));
    [3.2, 4.8, 6.35].forEach((y) => B(g, 0.2, 0.2, 2.7, m, tx, y, 1.5));
  });
  [0.3, 2.7].forEach((z) => {
    tube(g, [0.2, 0.8, z], [1.5, 6.5, z], 0.05, steel);
    tube(g, [10.5, 6.5, z], [11.8, 0.8, z], 0.05, steel);
    let prev = null;
    for (let x = 1.5; x <= 10.51; x += 0.75) {
      const t = (x - 6) / 4.5;
      const y = 1.8 + 4.7 * t * t;
      if (prev) tube(g, prev, [x, y, z], 0.05, steel);
      if (x > 1.6 && x < 10.4) tube(g, [x, 0.45, z], [x, y, z], 0.015, steel);
      prev = [x, y, z];
    }
  });
  return g;
});
reg("cablestay", "Cable-stayed bridge 10×3", 10, 3, 6, false, (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  B(g, 10, 0.3, 3, mat("#6C7078", { roughness: 0.8 }), 5, 0.3, 1.5);
  [0.5, 2.5].forEach((z) => tube(g, [5, 0.4, z], [5, 6.6, 1.5], 0.16, m));
  B(g, 0.3, 0.25, 2.2, m, 5, 3.0, 1.5);
  [0.5, 2.5].forEach((z) => {
    for (let i = 0; i < 4; i++) {
      const y = 6.4 - i * 0.55;
      tube(g, [5, y, 1.5], [0.8 + i * 1.0, 0.45, z], 0.02, steel);
      tube(g, [5, y, 1.5], [9.2 - i * 1.0, 0.45, z], 0.02, steel);
    }
  });
  return g;
});
regCustom("beam", "Structural beam", [
  { key: "len", label: "Length", kind: "num", min: 2, max: 16, step: 1, def: 6 },
  { key: "kind", label: "Type", kind: "sel", def: "ibeam", options: [["ibeam", "Steel I-beam"], ["box", "Box girder"], ["concrete", "Concrete beam"], ["timber", "Timber beam"]] },
], (o) => ({ w: o.len, d: 1, h: 1, top: true }), (c, o) => {
  const g = new THREE.Group();
  const L = o.len - 0.04;
  const x = o.len / 2;
  const metal = mat(c, { metalness: 0.45, roughness: 0.4 });
  if (o.kind === "ibeam") {
    B(g, L, 0.1, 0.55, metal, x, 0.05, 0.5);
    B(g, L, 0.1, 0.55, metal, x, 0.95, 0.5);
    B(g, L, 0.8, 0.1, metal, x, 0.5, 0.5);
  } else if (o.kind === "box") {
    B(g, L, 0.95, 0.8, metal, x, 0.475, 0.5);
    for (let i = 1; i < o.len; i++) B(g, 0.03, 0.9, 0.82, steel, i, 0.475, 0.5);
  } else if (o.kind === "concrete") {
    B(g, L, 0.9, 0.7, concreteM, x, 0.45, 0.5);
    B(g, L, 0.04, 0.72, mat("#8D9197"), x, 0.9, 0.5);
  } else {
    B(g, L, 0.9, 0.7, mat("#B07A42"), x, 0.45, 0.5);
    for (let i = 0; i < o.len; i++) B(g, 0.02, 0.9, 0.72, mat("#8A5A2B"), i + 0.5, 0.45, 0.5);
  }
  return g;
});
regCustom("column", "Structural column", [
  { key: "tall", label: "Height", kind: "num", min: 1, max: 8, step: 1, def: 3 },
  { key: "kind", label: "Type", kind: "sel", def: "h", options: [["h", "Steel H-column"], ["round", "Round pillar"], ["square", "Concrete column"]] },
], (o) => ({ w: 1, d: 1, h: o.tall, top: true }), (c, o) => {
  const g = new THREE.Group();
  const H = o.tall * BH;
  const metal = mat(c, { metalness: 0.45, roughness: 0.4 });
  if (o.kind === "h") {
    B(g, 0.9, 0.06, 0.9, steel, 0.5, 0.03, 0.5);
    B(g, 0.1, H - 0.06, 0.5, metal, 0.5, 0.06 + (H - 0.06) / 2, 0.5);
    [0.27, 0.73].forEach((z) => B(g, 0.5, H - 0.06, 0.08, metal, 0.5, 0.06 + (H - 0.06) / 2, z));
    B(g, 0.9, 0.06, 0.9, steel, 0.5, H - 0.03, 0.5);
  } else if (o.kind === "round") {
    Cyl(g, 0.4, 0.4, 0.15, concreteM, 0.5, 0.075, 0.5);
    Cyl(g, 0.3, 0.3, H - 0.3, concreteM, 0.5, H / 2, 0.5);
    Cyl(g, 0.4, 0.4, 0.15, concreteM, 0.5, H - 0.075, 0.5);
  } else B(g, 0.7, H, 0.7, concreteM, 0.5, H / 2, 0.5);
  return g;
});
regCustom("scaffold", "Scaffolding", [
  { key: "bays", label: "Bays", kind: "num", min: 1, max: 4, step: 1, def: 2 },
  { key: "levels", label: "Levels", kind: "num", min: 1, max: 6, step: 1, def: 3 },
], (o) => ({ w: o.bays * 2, d: 1, h: o.levels, top: false }), (c, o) => {
  const g = new THREE.Group();
  const H = o.levels * BH;
  const W = o.bays * 2;
  for (let i = 0; i <= o.bays; i++) [0.1, 0.9].forEach((z) => Cyl(g, 0.04, 0.04, H, steel, Math.min(W - 0.05, Math.max(0.05, i * 2)), H / 2, z));
  for (let k = 1; k <= o.levels; k++) {
    const y = k * BH - 0.06;
    B(g, W - 0.1, 0.05, 0.8, woodM, W / 2, y, 0.5);
    [0.1, 0.9].forEach((z) => B(g, W - 0.1, 0.05, 0.05, steel, W / 2, y - 0.06, z));
    if (k < o.levels) for (let i = 0; i < o.bays; i++) tube(g, [i * 2 + 0.1, y, 0.9], [i * 2 + 1.9, y + BH - 0.1, 0.9], 0.02, steel);
  }
  return g;
});
reg("towercrane", "Tower crane", 8, 3, 9, false, (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  B(g, 1.6, 0.3, 1.6, concreteM, 1.5, 0.15, 1.5);
  const top = 9.4;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => B(g, 0.07, top - 0.3, 0.07, m, 1.5 + sx * 0.35, 0.3 + (top - 0.3) / 2, 1.5 + sz * 0.35));
  for (let y = 1.0; y < top; y += 1.2) {
    [[1.5, 1.15, 0.7, 0.05], [1.5, 1.85, 0.7, 0.05]].forEach(([x, z, w, d]) => B(g, w, d, 0.05, m, x, y, z));
    [1.15, 1.85].forEach((x) => B(g, 0.05, 0.05, 0.7, m, x, y, 1.5));
    tube(g, [1.15, y, 1.15], [1.85, y + 1.2, 1.15], 0.025, m);
    tube(g, [1.85, y, 1.85], [1.15, y + 1.2, 1.85], 0.025, m);
  }
  B(g, 1.0, 0.4, 1.0, m, 1.5, top + 0.2, 1.5);
  B(g, 0.5, 0.5, 0.5, white, 2.1, top + 0.25, 1.5);
  B(g, 7.2, 0.08, 0.08, m, 4.0, top + 0.75, 1.5);
  [1.35, 1.65].forEach((z) => B(g, 7.2, 0.08, 0.08, m, 4.0, top + 0.25, z));
  for (let x = 0.4; x < 7.2; x += 0.8) {
    tube(g, [x, top + 0.25, 1.35], [x + 0.4, top + 0.75, 1.5], 0.025, m);
    tube(g, [x + 0.4, top + 0.75, 1.5], [x + 0.8, top + 0.25, 1.65], 0.025, m);
  }
  B(g, 0.6, 0.5, 0.6, concreteM, 0.45, top + 0.2, 1.5);
  tube(g, [1.5, top + 0.4, 1.5], [0.45, top + 0.2, 1.5], 0.03, steel);
  B(g, 0.35, 0.18, 0.3, black, 6.0, top + 0.1, 1.5);
  tube(g, [6.0, top, 1.5], [6.0, 7.2, 1.5], 0.015, black);
  Sph(g, 0.1, steel, 6.0, 7.1, 1.5);
  B(g, 0.5, 0.3, 0.5, orangeM, 6.0, 6.9, 1.5);
  return g;
});
reg("trafficcone", "Traffic cone", 1, 1, 1, false, () => {
  const g = new THREE.Group();
  B(g, 0.62, 0.05, 0.62, black, 0.5, 0.025, 0.5);
  Cone(g, 0.26, 0.9, 16, orangeM, 0.5, 0.5, 0.5);
  Cyl(g, 0.15, 0.19, 0.15, white, 0.5, 0.5, 0.5);
  return g;
});
reg("roadbarrier", "Road barrier", 2, 1, 1, false, (c) => {
  const g = new THREE.Group();
  [0.2, 1.8].forEach((x) => B(g, 0.1, 1.0, 0.5, black, x, 0.5, 0.5));
  for (let i = 0; i < 8; i++) B(g, 0.2, 0.22, 0.06, i % 2 ? white : mat(c), 0.2 + i * 0.228, 0.88, 0.5);
  for (let i = 0; i < 8; i++) B(g, 0.2, 0.22, 0.06, i % 2 ? mat(c) : white, 0.2 + i * 0.228, 0.58, 0.5);
  return g;
});

/* ----- flowering plants ----- */
const stemM = mat("#3E8E41");
const soilM = mat("#4A3222");
const yellowF = mat("#FFD23F");
// a flat flower: ring of petals around a centre
function bloom(g, x, y, z, r, col, centre = yellowF, n = 6) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    Sph(g, r * 0.5, mat(col), x + Math.cos(a) * r * 0.62, y, z + Math.sin(a) * r * 0.62).scale.set(1, 0.45, 1);
  }
  Sph(g, r * 0.4, centre, x, y + r * 0.08, z);
}
const stem = (g, x, z, h, m = stemM) => Cyl(g, 0.018, 0.022, h, m, x, 0.14 + h / 2, z);

reg("rose", "Rose bush", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  [[0.35, 0.3, 0.5], [0.65, 0.32, 0.45], [0.5, 0.5, 0.55], [0.5, 0.28, 0.7], [0.45, 0.3, 0.3]].forEach(([x, y, z]) => Sph(g, 0.24, leafA, x, y, z));
  [[0.3, 0.55, 0.65], [0.68, 0.52, 0.55], [0.5, 0.78, 0.5], [0.4, 0.5, 0.25], [0.7, 0.45, 0.3], [0.55, 0.62, 0.8]].forEach(([x, y, z]) => {
    Sph(g, 0.1, mat(c), x, y, z);
    Sph(g, 0.06, mat(shade(c, 0.7)), x, y + 0.05, z);
  });
  return g;
});
reg("tulips", "Tulip bed", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  B(g, 0.92, 0.14, 0.92, soilM, 0.5, 0.07, 0.5);
  [[0.25, 0.25], [0.5, 0.2], [0.75, 0.28], [0.3, 0.55], [0.6, 0.55], [0.8, 0.75], [0.35, 0.8], [0.55, 0.82]].forEach(([x, z], i) => {
    stem(g, x, z, 0.4 + (i % 3) * 0.06);
    Sph(g, 0.09, mat(i % 3 === 2 ? "#FFD23F" : c), x, 0.64 + (i % 3) * 0.06, z).scale.set(1, 1.35, 1);
    B(g, 0.04, 0.2, 0.1, leafA, x + 0.06, 0.3, z).rotation.z = -0.3;
  });
  return g;
});
reg("lavender", "Lavender", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  B(g, 0.92, 0.12, 0.92, soilM, 0.5, 0.06, 0.5);
  for (let i = 0; i < 9; i++) {
    const x = 0.15 + rnd(i) * 0.7;
    const z = 0.15 + rnd(i + 20) * 0.7;
    stem(g, x, z, 0.55);
    Cyl(g, 0.045, 0.03, 0.22, mat(c), x, 0.83, z);
  }
  return g;
});
reg("daisies", "Daisy patch", 1, 1, 1, false, () => {
  const g = new THREE.Group();
  B(g, 0.92, 0.1, 0.92, mat("#3F8F3F"), 0.5, 0.05, 0.5);
  [[0.25, 0.25], [0.7, 0.3], [0.45, 0.55], [0.75, 0.75], [0.25, 0.75]].forEach(([x, z], i) => {
    stem(g, x, z, 0.3 + (i % 2) * 0.1);
    bloom(g, x, 0.48 + (i % 2) * 0.1, z, 0.16, "#FFFFFF", yellowF, 8);
  });
  return g;
});
reg("orchid", "Orchid pot", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  Cyl(g, 0.22, 0.17, 0.3, mat("#F4F4F4"), 0.5, 0.15, 0.5);
  [-1, 0, 1].forEach((d) => B(g, 0.08, 0.04, 0.4, leafA, 0.5 + d * 0.13, 0.36, 0.5 + d * 0.05).rotation.x = -0.4);
  tube(g, [0.5, 0.3, 0.5], [0.55, 0.75, 0.5], 0.015, stemM);
  tube(g, [0.55, 0.75, 0.5], [0.72, 0.95, 0.5], 0.015, stemM);
  [[0.58, 0.72], [0.64, 0.82], [0.72, 0.94]].forEach(([x, y]) => {
    bloom(g, x, y, 0.5, 0.11, c, white, 5);
    Sph(g, 0.03, mat(shade(c, 0.6)), x, y + 0.02, 0.5);
  });
  return g;
});
reg("hibiscus", "Hibiscus", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  [[0.4, 0.35, 0.5], [0.62, 0.4, 0.45], [0.5, 0.62, 0.55], [0.5, 0.35, 0.7]].forEach(([x, y, z]) => Sph(g, 0.26, leafA, x, y, z));
  [[0.3, 0.55, 0.78], [0.7, 0.62, 0.7], [0.5, 0.95, 0.5], [0.35, 0.8, 0.3]].forEach(([x, y, z]) => {
    bloom(g, x, y, z, 0.15, c, mat("#FFD23F"), 5);
    Cyl(g, 0.012, 0.012, 0.16, mat("#F2CD37"), x, y + 0.08, z);
  });
  return g;
});
reg("marigold", "Marigold bed", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  B(g, 0.92, 0.14, 0.92, soilM, 0.5, 0.07, 0.5);
  for (let i = 0; i < 12; i++) {
    const x = 0.15 + rnd(i * 3) * 0.7;
    const z = 0.15 + rnd(i * 3 + 1) * 0.7;
    Sph(g, 0.1, mat(i % 3 ? "#F28C28" : c), x, 0.3 + rnd(i + 5) * 0.12, z);
  }
  [[0.3, 0.3], [0.7, 0.4], [0.5, 0.7]].forEach(([x, z]) => Sph(g, 0.2, leafA, x, 0.22, z).scale.set(1, 0.6, 1));
  return g;
});
reg("lotus", "Lotus pond 2×2", 2, 2, 0.5, false, (c) => {
  const g = waterBody(2, 2)();
  [[0.6, 0.7], [1.3, 0.6], [1.4, 1.4], [0.7, 1.4]].forEach(([x, z]) => Cyl(g, 0.28, 0.28, 0.03, leafB, x, 0.32, z));
  [[1.0, 1.0], [1.4, 0.55]].forEach(([x, z], k) => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p = Sph(g, 0.1, mat(k ? "#FFFFFF" : c), x + Math.cos(a) * 0.1, 0.45, z + Math.sin(a) * 0.1);
      p.scale.set(0.8, 1.7, 0.8);
      p.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
    }
    Sph(g, 0.06, yellowF, x, 0.45, z);
  });
  return g;
});
reg("bougainvillea", "Bougainvillea trellis", 2, 1, 3, false, (c) => {
  const g = new THREE.Group();
  [0.1, 1.9].forEach((x) => B(g, 0.1, 3.4, 0.12, woodM, x, 1.7, 0.5));
  for (let y = 0.5; y < 3.3; y += 0.7) B(g, 1.9, 0.06, 0.1, woodM, 1, y, 0.5);
  for (let i = 0; i < 18; i++) Sph(g, 0.16, leafA, 0.2 + rnd(i) * 1.6, 0.4 + rnd(i + 30) * 2.9, 0.4 + rnd(i + 60) * 0.2);
  for (let i = 0; i < 34; i++) Sph(g, 0.08, mat(i % 5 ? c : shade(c, 0.8)), 0.15 + rnd(i + 90) * 1.7, 0.4 + rnd(i + 120) * 2.9, 0.3 + rnd(i + 150) * 0.4);
  return g;
});
reg("hangbasket", "Hanging flower basket", 1, 1, 3, false, (c) => {
  const g = new THREE.Group();
  Cyl(g, 0.2, 0.25, 0.15, ironM, 0.5, 0.07, 0.5);
  Cyl(g, 0.04, 0.06, 3.0, ironM, 0.25, 1.6, 0.5);
  tube(g, [0.25, 3.0, 0.5], [0.7, 3.0, 0.5], 0.035, ironM);
  [[0.7, 3.0]].forEach(([x, y]) => {
    tube(g, [x, y, 0.5], [x - 0.2, y - 0.4, 0.5], 0.01, black);
    tube(g, [x, y, 0.5], [x + 0.2, y - 0.4, 0.5], 0.01, black);
    Sph(g, 0.24, mat("#7A5230"), x, y - 0.5, 0.5).scale.set(1, 0.6, 1);
    for (let i = 0; i < 8; i++) Sph(g, 0.09, mat(i % 3 ? c : "#FFD23F"), x - 0.2 + rnd(i) * 0.4, y - 0.36 + rnd(i + 7) * 0.08, 0.3 + rnd(i + 14) * 0.4);
    [-0.15, 0.1].forEach((dx) => tube(g, [x + dx, y - 0.55, 0.5], [x + dx, y - 0.95, 0.5], 0.015, leafA));
  });
  return g;
});
reg("flowergarden", "Flower garden 2×2", 2, 2, 1, false, (c) => {
  const g = new THREE.Group();
  B(g, 1.92, 0.18, 1.92, soilM, 1, 0.09, 1);
  const cols = [c, "#FFD23F", "#F7B6CD", "#FFFFFF", "#C86BFA"];
  for (let i = 0; i < 24; i++) {
    const x = 0.2 + rnd(i * 2) * 1.6;
    const z = 0.2 + rnd(i * 2 + 1) * 1.6;
    const h = 0.25 + rnd(i + 40) * 0.35;
    Cyl(g, 0.016, 0.02, h, stemM, x, 0.18 + h / 2, z);
    bloom(g, x, 0.2 + h, z, 0.1, cols[i % cols.length], yellowF, 5);
  }
  return g;
});
reg("meadow", "Wildflower meadow 2×2", 2, 2, 1, false, (c) => {
  const g = new THREE.Group();
  B(g, 1.96, 0.1, 1.96, mat("#4C9A45"), 1, 0.05, 1);
  const cols = [c, "#FFD23F", "#FFFFFF", "#F28C28", "#C86BFA", "#F7B6CD"];
  for (let i = 0; i < 20; i++) {
    const x = 0.12 + rnd(i * 5) * 1.76;
    const z = 0.12 + rnd(i * 5 + 2) * 1.76;
    B(g, 0.05, 0.3 + rnd(i) * 0.2, 0.05, leafB, x, 0.25, z).rotation.z = (rnd(i + 9) - 0.5) * 0.4;
  }
  for (let i = 0; i < 28; i++) {
    const x = 0.12 + rnd(i * 7 + 1) * 1.76;
    const z = 0.12 + rnd(i * 7 + 3) * 1.76;
    const h = 0.3 + rnd(i + 70) * 0.4;
    Cyl(g, 0.012, 0.015, h, stemM, x, 0.1 + h / 2, z);
    Sph(g, 0.06, mat(cols[i % cols.length]), x, 0.1 + h, z);
  }
  return g;
});
reg("planter", "Flower planter", 2, 1, 1, false, (c) => {
  const g = new THREE.Group();
  B(g, 1.9, 0.5, 0.8, woodM, 1, 0.25, 0.5);
  B(g, 1.7, 0.06, 0.6, soilM, 1, 0.5, 0.5);
  for (let i = 0; i < 6; i++) Sph(g, 0.2, leafA, 0.3 + i * 0.28, 0.6, 0.5).scale.set(1, 0.7, 1);
  for (let i = 0; i < 10; i++) Sph(g, 0.09, mat(i % 3 ? c : "#FFD23F"), 0.2 + (i % 5) * 0.4 + (i > 4 ? 0.15 : 0), 0.78 + (i % 2) * 0.08, 0.35 + (i > 4 ? 0.3 : 0));
  return g;
});

/* ----- more trees ----- */
const trunkLight = mat("#EDEAE2");
reg("birch", "Birch tree", 2, 2, 3, false, () => {
  const g = new THREE.Group();
  Cyl(g, 0.1, 0.13, 2.0, trunkLight, 1, 1.0, 1);
  [0.5, 0.9, 1.3, 1.7].forEach((y) => B(g, 0.22, 0.04, 0.05, black, 1, y, 1.1).rotation.y = y);
  const lf = mat("#8CC25A");
  Sph(g, 0.75, lf, 1, 2.5, 1);
  Sph(g, 0.5, mat("#A5D36F"), 0.6, 2.2, 1.2);
  Sph(g, 0.5, mat("#7DB04B"), 1.4, 2.3, 0.8);
  return g;
});
reg("willow", "Weeping willow", 3, 3, 3, false, () => {
  const g = new THREE.Group();
  Cyl(g, 0.16, 0.24, 1.8, bark, 1.5, 0.9, 1.5);
  Sph(g, 1.0, mat("#7FB069"), 1.5, 2.45, 1.5);
  const strand = mat("#6FA25A");
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = 0.9 + (i % 2) * 0.2;
    tube(g, [1.5 + Math.cos(a) * r, 2.5, 1.5 + Math.sin(a) * r], [1.5 + Math.cos(a) * (r + 0.2), 0.75 + (i % 3) * 0.2, 1.5 + Math.sin(a) * (r + 0.2)], 0.04, strand);
  }
  return g;
});
reg("maple", "Maple tree (autumn)", 2, 2, 3, false, () => {
  const g = new THREE.Group();
  Cyl(g, 0.17, 0.24, 1.5, bark, 1, 0.75, 1);
  Sph(g, 0.9, mat("#D2691E"), 1, 2.4, 1);
  Sph(g, 0.58, mat("#C0392B"), 0.55, 2.0, 1.1);
  Sph(g, 0.6, mat("#E8A33D"), 1.45, 2.1, 0.85);
  Sph(g, 0.5, mat("#C0392B"), 1.0, 3.0, 0.9);
  return g;
});
reg("cherry", "Cherry blossom tree", 3, 3, 3, false, () => {
  const g = new THREE.Group();
  const dark = mat("#5A3A2A");
  Cyl(g, 0.14, 0.22, 1.4, dark, 1.5, 0.7, 1.5);
  tube(g, [1.5, 1.2, 1.5], [0.8, 2.0, 1.5], 0.08, dark);
  tube(g, [1.5, 1.2, 1.5], [2.2, 2.0, 1.4], 0.08, dark);
  [[1.5, 2.55, 1.5, 0.8, "#F7B6CD"], [0.8, 2.2, 1.5, 0.6, "#F29BB8"], [2.2, 2.2, 1.4, 0.6, "#F7B6CD"], [1.5, 2.1, 0.8, 0.5, "#FAD0DF"], [1.4, 2.1, 2.2, 0.5, "#F29BB8"]].forEach(([x, y, z, r, col]) => Sph(g, r, mat(col), x, y, z));
  for (let i = 0; i < 10; i++) Sph(g, 0.05, mat("#F7B6CD"), 0.4 + rnd(i) * 2.2, 0.04, 0.4 + rnd(i + 11) * 2.2).scale.set(1, 0.3, 1);
  return g;
});
reg("banyan", "Banyan tree", 4, 4, 4, false, () => {
  const g = new THREE.Group();
  Cyl(g, 0.4, 0.55, 2.4, bark, 2, 1.2, 2);
  [[-0.9, -0.5], [0.9, -0.4], [-0.5, 0.9], [0.6, 0.9]].forEach(([dx, dz], i) => tube(g, [2 + dx * 1.2, 3.0, 2 + dz * 1.2], [2 + dx * 1.2, 0.05, 2 + dz * 1.2], 0.05 + (i % 2) * 0.02, bark));
  [[2, 3.4, 2, 1.0], [1.2, 3.1, 1.3, 0.9], [2.8, 3.1, 1.3, 0.9], [1.2, 3.1, 2.8, 0.9], [2.8, 3.1, 2.8, 0.9]].forEach(([x, y, z, r], i) => Sph(g, r, i % 2 ? leafB : leafA, x, y, z));
  return g;
});
reg("mango", "Mango tree", 3, 3, 3, false, () => {
  const g = new THREE.Group();
  Cyl(g, 0.2, 0.3, 1.4, bark, 1.5, 0.7, 1.5);
  [[1.5, 2.3, 1.5, 1.0], [0.8, 2.0, 1.2, 0.7], [2.2, 2.0, 1.7, 0.7]].forEach(([x, y, z, r]) => Sph(g, r, mat("#2B6B2F"), x, y, z));
  [[0.8, 1.5, 0.5], [2.2, 1.6, 1.9], [1.5, 1.4, 0.5], [1.9, 1.5, 2.2], [1.0, 1.4, 2.2]].forEach(([x, y, z]) => Sph(g, 0.1, mat("#E8A33D"), x, y, z).scale.set(1, 1.3, 1));
  return g;
});
reg("coconut", "Coconut tree", 3, 3, 5, false, () => {
  const g = new THREE.Group();
  const trunk = mat("#8B6B43");
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    Cyl(g, 0.11 - t * 0.03, 0.13 - t * 0.03, 0.85, trunk, 1.2 + t * t * 0.7, 0.42 + i * 0.78, 1.5).rotation.z = -t * 0.35;
  }
  const hx = 1.2 + 0.7;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const f = Sph(g, 0.6, leafB, hx + Math.cos(a) * 0.55, 5.15 - (k % 2) * 0.1, 1.5 + Math.sin(a) * 0.55);
    f.scale.set(1, 0.1, 0.45);
    f.rotation.order = "YZX";
    f.rotation.set(0, -a, -0.35);
  }
  [[0.1, 0.1], [-0.1, 0.12], [0.02, -0.12]].forEach(([dx, dz]) => Sph(g, 0.12, mat("#5A3F22"), hx + dx, 4.95, 1.5 + dz));
  return g;
});
reg("bamboo", "Bamboo clump", 2, 2, 4, false, () => {
  const g = new THREE.Group();
  for (let s = 0; s < 6; s++) {
    const x = 0.5 + rnd(s) * 1.0;
    const z = 0.5 + rnd(s + 9) * 1.0;
    const hh = 3.4 + rnd(s + 4) * 1.1;
    for (let k = 0; k * 0.75 < hh; k++) Cyl(g, 0.055, 0.06, Math.min(0.72, hh - k * 0.75), mat(k % 2 ? "#6E9A31" : "#7DA83A"), x, k * 0.75 + Math.min(0.72, hh - k * 0.75) / 2, z);
    for (let j = 0; j < 3; j++) Sph(g, 0.22, leafB, x + (j - 1) * 0.18, hh - 0.15 - j * 0.3, z).scale.set(1.2, 0.35, 0.5);
  }
  return g;
});
reg("baobab", "Baobab tree", 3, 3, 4, false, () => {
  const g = new THREE.Group();
  const trunk = mat("#8E7455");
  Cyl(g, 0.75, 1.0, 2.8, trunk, 1.5, 1.4, 1.5);
  [[-0.5, 0], [0.5, 0.3], [0, -0.5], [0.1, 0.5]].forEach(([dx, dz]) => tube(g, [1.5 + dx * 0.3, 2.7, 1.5 + dz * 0.3], [1.5 + dx * 1.4, 3.7, 1.5 + dz * 1.4], 0.12, trunk));
  [[-0.7, 0], [0.7, 0.4], [0, -0.7], [0.1, 0.7], [0, 0]].forEach(([dx, dz]) => Sph(g, 0.42, leafA, 1.5 + dx * 1.2, 3.9, 1.5 + dz * 1.2));
  return g;
});
reg("cypress", "Cypress tree", 1, 1, 4, false, () => {
  const g = new THREE.Group();
  Cyl(g, 0.06, 0.08, 0.8, bark, 0.5, 0.4, 0.5);
  Sph(g, 0.34, mat("#1F5F34"), 0.5, 2.6, 0.5).scale.set(1, 4.3, 1);
  return g;
});
reg("appletree", "Apple tree", 2, 2, 3, false, () => {
  const g = new THREE.Group();
  Cyl(g, 0.17, 0.24, 1.4, bark, 1, 0.7, 1);
  Sph(g, 0.9, leafA, 1, 2.3, 1);
  Sph(g, 0.55, leafB, 0.55, 2.0, 1.1);
  Sph(g, 0.55, leafB, 1.45, 2.05, 0.85);
  [[0.5, 1.8, 1.6], [1.5, 1.9, 1.6], [1.1, 1.6, 0.4], [0.6, 2.4, 0.5], [1.5, 2.5, 1.3], [1.0, 3.0, 1.5]].forEach(([x, y, z]) => Sph(g, 0.1, tailM, x, y, z));
  return g;
});
reg("deadtree", "Bare dead tree", 2, 2, 3, false, () => {
  const g = new THREE.Group();
  const w = mat("#5B4B3E");
  Cyl(g, 0.1, 0.2, 2.0, w, 1, 1.0, 1);
  [[0.5, 0.5, 2.9, 1], [1.6, 0.4, 2.8, 1.2], [1.0, 0.1, 2.2, 0.4], [0.7, 0.7, 2.3, 1.5]].forEach(([x, , y, z]) => tube(g, [1, y - 0.6, 1], [x, y + 0.1, z], 0.05, w));
  tube(g, [0.5, 2.9, 1], [0.3, 3.3, 1], 0.025, w);
  tube(g, [1.6, 2.8, 1.2], [1.8, 3.3, 1.3], 0.025, w);
  return g;
});
reg("xmas", "Christmas tree", 2, 2, 4, false, () => {
  const g = new THREE.Group();
  const pine = mat("#1F5F34");
  Cyl(g, 0.12, 0.16, 0.5, bark, 1, 0.25, 1);
  [[0.9, 1.4, 1.0], [0.7, 1.2, 1.9], [0.5, 1.0, 2.7], [0.32, 0.8, 3.4]].forEach(([r, h, y]) => Cone(g, r, h, 10, pine, 1, y, 1));
  Cone(g, 0.18, 0.3, 5, lit("#FFD23F"), 1, 4.2, 1);
  const cols = ["#D01012", "#0055BF", "#FFD23F", "#FFFFFF"];
  for (let i = 0; i < 14; i++) {
    const t = i / 14;
    const y = 1.0 + t * 2.7;
    const r = 0.75 - t * 0.55;
    const a = i * 2.4;
    Sph(g, 0.06, i % 3 === 0 ? lit(cols[i % 4]) : mat(cols[i % 4]), 1 + Math.cos(a) * r, y, 1 + Math.sin(a) * r);
  }
  return g;
});
reg("bigpine", "Tall pine tree", 3, 3, 6, false, () => {
  const g = new THREE.Group();
  const pine = mat("#1B5430");
  Cyl(g, 0.16, 0.22, 1.2, bark, 1.5, 0.6, 1.5);
  [[1.3, 1.6, 1.4], [1.1, 1.5, 2.3], [0.9, 1.4, 3.2], [0.7, 1.3, 4.1], [0.5, 1.2, 4.9], [0.3, 1.0, 5.6]].forEach(([r, h, y]) => Cone(g, r, h, 10, pine, 1.5, y, 1.5));
  return g;
});
reg("snowpine", "Snowy pine tree", 2, 2, 3, false, () => {
  const g = new THREE.Group();
  const pine = mat("#1F5F34");
  const snow = mat("#F4F8FB");
  Cyl(g, 0.12, 0.16, 0.9, bark, 1, 0.45, 1);
  [[0.9, 1.5, 1.45], [0.7, 1.3, 2.15], [0.5, 1.1, 2.75]].forEach(([r, h, y]) => {
    Cone(g, r, h, 8, pine, 1, y, 1);
    Cone(g, r * 0.8, h * 0.5, 8, snow, 1, y + h * 0.27, 1);
  });
  return g;
});
reg("acacia", "Acacia tree", 4, 4, 3, false, () => {
  const g = new THREE.Group();
  const trunk = mat("#7B5A38");
  tube(g, [2, 0.1, 2], [1.8, 1.5, 2], 0.2, trunk);
  tube(g, [1.8, 1.5, 2], [1.0, 2.3, 1.7], 0.1, trunk);
  tube(g, [1.8, 1.5, 2], [2.8, 2.4, 2.2], 0.1, trunk);
  Sph(g, 1.7, mat("#7C9A3A"), 2, 2.85, 2).scale.set(1, 0.28, 1);
  Sph(g, 0.9, mat("#8DAA45"), 1.0, 2.6, 1.7).scale.set(1, 0.3, 1);
  return g;
});

/* ----- animals (head toward +z) ----- */
// a four-legged body with neck, head, ears and tail; returns key positions so each animal can add its own details
function quad(g, p) {
  const { cx = 0.5, z0, L, W, H, legH, col, dark = col, legT = 0.13, neckLen = 0.2, neckRise = 0.15, head = 0.32, snout = 0.2, snoutCol, tail = 0.35, tailCol } = p;
  const m = mat(col);
  const dm = mat(dark);
  const top = legH + H;
  [[-1, 0.12], [1, 0.12], [-1, 0.88], [1, 0.88]].forEach(([s, f]) => B(g, legT, legH + 0.04, legT, dm, cx + s * (W / 2 - legT / 2), (legH + 0.04) / 2, z0 + L * f));
  B(g, W, H, L, m, cx, legH + H / 2, z0 + L / 2);
  const hy = top - head * 0.3 + neckRise;
  const hz = z0 + L + neckLen + head * 0.35;
  tube(g, [cx, top - H * 0.3, z0 + L - 0.12], [cx, hy, hz - head * 0.2], Math.min(W, head) * 0.4, m);
  B(g, head, head, head * 1.1, m, cx, hy, hz);
  const sz = hz + head * 0.55 + snout / 2 - 0.03;
  B(g, head * 0.7, head * 0.6, snout, mat(snoutCol || col), cx, hy - head * 0.18, sz);
  [-1, 1].forEach((s) => {
    Sph(g, head * 0.1, black, cx + s * head * 0.3, hy + head * 0.15, hz + head * 0.5);
    B(g, head * 0.25, head * 0.4, head * 0.15, dm, cx + s * head * 0.38, hy + head * 0.55, hz - head * 0.15);
  });
  tube(g, [cx, top - 0.1, z0 + 0.1], [cx, top - 0.1 - tail, z0 + 0.03], 0.03, mat(tailCol || dark));
  return { top, hy, hz, sz, cx, z0, L, W, H, legH, head, m, dm };
}
const stripesAcross = (g, q, col, z1, z2, step, hgt) => {
  const m = mat(col);
  for (let z = z1; z < z2; z += step) B(g, q.W + 0.02, hgt || q.H + 0.02, step * 0.4, m, q.cx, q.legH + q.H / 2, z);
};

reg("horse", "Horse", 1, 3, 2, false, () => {
  const g = new THREE.Group();
  const q = quad(g, { z0: 0.35, L: 1.5, W: 0.45, H: 0.55, legH: 0.95, col: "#8B5A2B", dark: "#3A2412", neckLen: 0.15, neckRise: 0.45, head: 0.28, snout: 0.3, legT: 0.11, tail: 0.8 });
  B(g, 0.08, 0.6, 0.45, mat("#3A2412"), q.cx, q.hy - 0.15, q.hz - 0.45).rotation.x = 0.5;
  return g;
});
reg("zebraanimal", "Zebra", 1, 3, 2, false, () => {
  const g = new THREE.Group();
  const q = quad(g, { z0: 0.35, L: 1.5, W: 0.45, H: 0.55, legH: 0.95, col: "#F4F4F4", dark: "#1B1B1B", neckLen: 0.15, neckRise: 0.45, head: 0.28, snout: 0.3, legT: 0.11, tail: 0.8 });
  stripesAcross(g, q, "#1B1B1B", 0.5, 1.85, 0.2);
  B(g, 0.08, 0.6, 0.45, black, q.cx, q.hy - 0.15, q.hz - 0.45).rotation.x = 0.5;
  return g;
});
reg("cow", "Cow", 1, 3, 2, false, (c) => {
  const g = new THREE.Group();
  const q = quad(g, { z0: 0.35, L: 1.3, W: 0.7, H: 0.65, legH: 0.55, col: "#F4F4F4", dark: "#2A2A2A", neckLen: 0.1, neckRise: 0, head: 0.38, snout: 0.22, snoutCol: "#F4B6B6", legT: 0.12, tail: 0.6 });
  const spot = mat(c);
  B(g, 0.72, 0.3, 0.4, spot, q.cx, 1.0, 0.75);
  B(g, 0.72, 0.35, 0.3, spot, q.cx, 0.95, 1.3);
  B(g, 0.3, 0.15, 0.25, mat("#F4B6B6"), q.cx, 0.5, 0.65);
  [-1, 1].forEach((s) => Cone(g, 0.04, 0.16, 6, white, q.cx + s * 0.2, q.hy + 0.28, q.hz - 0.05));
  return g;
});
reg("sheep", "Sheep", 1, 2, 1, false, () => {
  const g = new THREE.Group();
  const wool = mat("#F1EFE8");
  const dk = mat("#3A3A3A");
  [[0.35, 0.55], [0.65, 0.55], [0.35, 1.05], [0.65, 1.05]].forEach(([x, z]) => B(g, 0.1, 0.35, 0.1, dk, x, 0.18, z));
  Sph(g, 0.38, wool, 0.5, 0.65, 0.8).scale.set(0.95, 0.85, 1.25);
  [[0.3, 0.9, 0.5], [0.7, 0.9, 0.55], [0.5, 1.0, 0.85], [0.3, 0.85, 1.1], [0.7, 0.85, 1.05]].forEach(([x, y, z]) => Sph(g, 0.2, wool, x, y - 0.2, z));
  B(g, 0.22, 0.24, 0.3, dk, 0.5, 0.78, 1.5);
  [-1, 1].forEach((s) => {
    B(g, 0.12, 0.06, 0.1, dk, 0.5 + s * 0.16, 0.88, 1.42).rotation.z = s * 0.4;
    Sph(g, 0.03, white, 0.5 + s * 0.07, 0.82, 1.64);
  });
  return g;
});
reg("pig", "Pig", 1, 2, 1, false, () => {
  const g = new THREE.Group();
  const q = quad(g, { z0: 0.35, L: 0.95, W: 0.55, H: 0.45, legH: 0.28, col: "#F2A5B5", dark: "#E58FA3", neckLen: 0.02, neckRise: 0, head: 0.36, snout: 0.12, snoutCol: "#E58FA3", legT: 0.12, tail: 0.1 });
  add(g, G(THREE.TorusGeometry, 0.05, 0.015, 6, 10), mat("#E58FA3"), q.cx, 0.62, 0.3);
  return g;
});
reg("goat", "Goat", 1, 2, 2, false, () => {
  const g = new THREE.Group();
  const q = quad(g, { z0: 0.35, L: 1.0, W: 0.38, H: 0.45, legH: 0.6, col: "#D9D2C5", dark: "#8A7A66", neckLen: 0.15, neckRise: 0.2, head: 0.26, snout: 0.2, legT: 0.09, tail: 0.15 });
  [-1, 1].forEach((s) => tube(g, [q.cx + s * 0.07, q.hy + 0.13, q.hz - 0.05], [q.cx + s * 0.09, q.hy + 0.5, q.hz - 0.3], 0.025, mat("#6B5A45")));
  Cone(g, 0.05, 0.16, 5, mat("#6B5A45"), q.cx, q.hy - 0.3, q.hz + 0.25).rotation.x = Math.PI;
  return g;
});
reg("deer", "Deer", 1, 3, 2, false, () => {
  const g = new THREE.Group();
  const q = quad(g, { z0: 0.35, L: 1.1, W: 0.34, H: 0.45, legH: 0.8, col: "#B07A4A", dark: "#8A5A33", neckLen: 0.2, neckRise: 0.5, head: 0.24, snout: 0.22, legT: 0.09, tail: 0.12 });
  const ant = mat("#D9C7A0");
  [-1, 1].forEach((s) => {
    tube(g, [q.cx + s * 0.06, q.hy + 0.12, q.hz - 0.1], [q.cx + s * 0.18, q.hy + 0.55, q.hz - 0.2], 0.02, ant);
    tube(g, [q.cx + s * 0.12, q.hy + 0.33, q.hz - 0.15], [q.cx + s * 0.1, q.hy + 0.55, q.hz + 0.05], 0.015, ant);
  });
  B(g, 0.36, 0.1, 0.9, white, q.cx, q.legH + 0.08, 0.9);
  for (let i = 0; i < 6; i++) Sph(g, 0.04, white, q.cx + (rnd(i) - 0.5) * 0.25, q.top + 0.01, 0.55 + i * 0.17);
  return g;
});
reg("lion", "Lion", 1, 3, 2, false, () => {
  const g = new THREE.Group();
  const q = quad(g, { z0: 0.35, L: 1.1, W: 0.4, H: 0.45, legH: 0.35, col: "#D7A24B", dark: "#B9812F", neckLen: 0.1, neckRise: 0.1, head: 0.32, snout: 0.15, snoutCol: "#E8C58A", legT: 0.12, tail: 0.1 });
  Sph(g, 0.32, mat("#7A4B1E"), q.cx, q.hy, q.hz - 0.1).scale.set(1, 1, 0.8);
  tube(g, [q.cx, q.legH + q.H - 0.1, 0.4], [q.cx, 0.25, 0.1], 0.03, mat("#B9812F"));
  Sph(g, 0.07, mat("#7A4B1E"), q.cx, 0.22, 0.1);
  return g;
});
reg("tiger", "Tiger", 1, 3, 2, false, () => {
  const g = new THREE.Group();
  const q = quad(g, { z0: 0.35, L: 1.1, W: 0.4, H: 0.45, legH: 0.35, col: "#E8892B", dark: "#C96E1A", neckLen: 0.1, neckRise: 0.05, head: 0.32, snout: 0.15, snoutCol: "#F4E4C8", legT: 0.12, tail: 0.4 });
  stripesAcross(g, q, "#1B1B1B", 0.45, 1.4, 0.2, 0.4);
  B(g, 0.3, 0.1, 0.8, mat("#F4E4C8"), q.cx, q.legH + 0.03, 0.9);
  return g;
});
reg("bear", "Bear", 2, 3, 2, false, () => {
  const g = new THREE.Group();
  const q = quad(g, { cx: 1, z0: 0.4, L: 1.3, W: 0.85, H: 0.8, legH: 0.4, col: "#6B4A2F", dark: "#5A3C25", neckLen: 0, neckRise: 0, head: 0.5, snout: 0.22, snoutCol: "#C9A57A", legT: 0.3, tail: 0.05 });
  Sph(g, 0.06, black, q.cx, q.hy - 0.15, q.sz + 0.1);
  return g;
});
reg("panda", "Panda", 1, 2, 1, false, () => {
  const g = new THREE.Group();
  const q = quad(g, { z0: 0.35, L: 0.9, W: 0.6, H: 0.6, legH: 0.3, col: "#F4F4F4", dark: "#1B1B1B", neckLen: 0, neckRise: 0, head: 0.45, snout: 0.1, legT: 0.2, tail: 0.05, tailCol: "#F4F4F4" });
  B(g, 0.62, 0.62, 0.3, black, q.cx, q.legH + q.H / 2, 0.8);
  [-1, 1].forEach((s) => B(g, 0.1, 0.12, 0.04, black, q.cx + s * 0.12, q.hy + 0.06, q.hz + 0.5 * 0.45));
  return g;
});
reg("elephant", "Elephant", 3, 5, 4, false, () => {
  const g = new THREE.Group();
  const gray = mat("#8E949B");
  const dgray = mat("#7A8087");
  [[-1, 0.9], [1, 0.9], [-1, 2.5], [1, 2.5]].forEach(([s, z]) => Cyl(g, 0.26, 0.28, 1.05, dgray, 1.5 + s * 0.45, 0.52, z));
  B(g, 1.5, 1.4, 2.4, gray, 1.5, 1.7, 1.7);
  B(g, 1.1, 1.1, 1.0, gray, 1.5, 2.1, 3.4);
  [-1, 1].forEach((s) => {
    Cyl(g, 0.55, 0.55, 0.06, dgray, 1.5 + s * 0.68, 2.1, 3.1).rotation.z = Math.PI / 2;
    Sph(g, 0.06, black, 1.5 + s * 0.4, 2.3, 3.88);
    Cone(g, 0.07, 0.6, 6, mat("#F4EEDD"), 1.5 + s * 0.38, 1.55, 3.95).rotation.x = Math.PI / 2 - 0.5;
  });
  tube(g, [1.5, 1.95, 3.85], [1.5, 1.3, 4.25], 0.2, gray);
  tube(g, [1.5, 1.3, 4.25], [1.5, 0.6, 4.4], 0.16, gray);
  tube(g, [1.5, 0.6, 4.4], [1.5, 0.35, 4.1], 0.12, gray);
  tube(g, [1.5, 2.2, 0.55], [1.5, 1.2, 0.35], 0.04, dgray);
  return g;
});
reg("giraffe", "Giraffe", 1, 3, 4, false, () => {
  const g = new THREE.Group();
  const q = quad(g, { z0: 0.3, L: 1.1, W: 0.45, H: 0.55, legH: 1.6, col: "#E8B04B", dark: "#C4902E", neckLen: 0.12, neckRise: 2.1, head: 0.24, snout: 0.2, legT: 0.1, tail: 0.5 });
  const spot = mat("#8A5A2B");
  [[0.8, 2.05], [1.3, 2.2], [0.5, 2.15], [1.05, 2.0]].forEach(([z, y]) => B(g, 0.47, 0.17, 0.2, spot, q.cx, y, z));
  for (let i = 0; i < 4; i++) {
    const t = 0.2 + i * 0.2;
    Sph(g, 0.07, spot, q.cx + 0.1, q.top - 0.3 + (q.hy - q.top + 0.3) * t, q.z0 + q.L - 0.1 + (q.hz - q.z0 - q.L) * t);
  }
  [-1, 1].forEach((s) => {
    tube(g, [q.cx + s * 0.06, q.hy + 0.12, q.hz - 0.05], [q.cx + s * 0.06, q.hy + 0.36, q.hz - 0.05], 0.02, spot);
    Sph(g, 0.04, spot, q.cx + s * 0.06, q.hy + 0.38, q.hz - 0.05);
  });
  return g;
});
reg("camel", "Camel", 1, 3, 3, false, () => {
  const g = new THREE.Group();
  const q = quad(g, { z0: 0.35, L: 1.7, W: 0.6, H: 0.75, legH: 1.0, col: "#C9A15B", dark: "#A8803F", neckLen: 0.2, neckRise: 0.8, head: 0.28, snout: 0.3, legT: 0.13, tail: 0.4 });
  [0.55, 1.2].forEach((z) => Sph(g, 0.3, mat("#C9A15B"), q.cx, q.top + 0.18, z).scale.set(0.9, 1.1, 1));
  return g;
});
reg("monkey", "Monkey", 1, 1, 1, false, () => {
  const g = new THREE.Group();
  const fur = mat("#7A5230");
  const face = mat("#E8C9A0");
  Sph(g, 0.2, fur, 0.5, 0.42, 0.45).scale.set(1, 1.2, 0.9);
  Sph(g, 0.16, fur, 0.5, 0.82, 0.5);
  Sph(g, 0.1, face, 0.5, 0.78, 0.62);
  [-1, 1].forEach((s) => {
    Sph(g, 0.06, face, 0.5 + s * 0.16, 0.86, 0.48);
    Sph(g, 0.025, black, 0.5 + s * 0.06, 0.85, 0.65);
    tube(g, [0.5 + s * 0.17, 0.55, 0.45], [0.5 + s * 0.22, 0.28, 0.58], 0.04, fur);
    tube(g, [0.5 + s * 0.12, 0.3, 0.48], [0.5 + s * 0.12, 0.1, 0.58], 0.05, fur);
    Sph(g, 0.07, fur, 0.5 + s * 0.12, 0.08, 0.6);
  });
  tube(g, [0.5, 0.25, 0.3], [0.5, 0.1, 0.15], 0.03, fur);
  tube(g, [0.5, 0.1, 0.15], [0.5, 0.4, 0.08], 0.03, fur);
  tube(g, [0.5, 0.4, 0.08], [0.5, 0.65, 0.2], 0.03, fur);
  return g;
});
reg("penguin", "Penguin", 1, 1, 1, false, () => {
  const g = new THREE.Group();
  Sph(g, 0.3, black, 0.5, 0.5, 0.5).scale.set(1, 1.5, 0.9);
  Sph(g, 0.24, white, 0.5, 0.48, 0.58).scale.set(0.9, 1.4, 0.7);
  Sph(g, 0.16, black, 0.5, 0.98, 0.5);
  Cone(g, 0.05, 0.14, 6, orangeM, 0.5, 0.95, 0.68).rotation.x = Math.PI / 2;
  [-1, 1].forEach((s) => {
    Sph(g, 0.025, white, 0.5 + s * 0.07, 1.02, 0.63);
    B(g, 0.05, 0.4, 0.2, black, 0.5 + s * 0.33, 0.55, 0.5).rotation.z = s * 0.3;
    B(g, 0.15, 0.04, 0.22, orangeM, 0.5 + s * 0.12, 0.03, 0.6);
  });
  return g;
});
reg("duck", "Duck", 1, 1, 1, false, () => {
  const g = new THREE.Group();
  Sph(g, 0.26, white, 0.5, 0.33, 0.5).scale.set(1, 0.8, 1.3);
  Sph(g, 0.13, mat("#2E7D32"), 0.5, 0.6, 0.7);
  B(g, 0.12, 0.04, 0.14, orangeM, 0.5, 0.57, 0.84);
  [-1, 1].forEach((s) => Sph(g, 0.02, black, 0.5 + s * 0.07, 0.64, 0.78));
  Cone(g, 0.08, 0.2, 6, white, 0.5, 0.42, 0.2).rotation.x = -Math.PI / 2 - 0.4;
  [-1, 1].forEach((s) => B(g, 0.1, 0.02, 0.12, orangeM, 0.5 + s * 0.1, 0.02, 0.5));
  return g;
});
reg("chicken", "Chicken", 1, 1, 1, false, () => {
  const g = new THREE.Group();
  const feather = mat("#B5651D");
  Sph(g, 0.22, feather, 0.5, 0.4, 0.5).scale.set(0.9, 0.95, 1.2);
  Sph(g, 0.1, feather, 0.5, 0.68, 0.7);
  B(g, 0.03, 0.08, 0.1, tailM, 0.5, 0.8, 0.7);
  Cone(g, 0.04, 0.1, 5, yellowF, 0.5, 0.66, 0.82).rotation.x = Math.PI / 2;
  Sph(g, 0.03, tailM, 0.5, 0.58, 0.78);
  B(g, 0.05, 0.3, 0.16, mat("#7A3F10"), 0.5, 0.55, 0.22).rotation.x = -0.5;
  [-1, 1].forEach((s) => tube(g, [0.5 + s * 0.07, 0.2, 0.5], [0.5 + s * 0.07, 0.02, 0.52], 0.02, yellowF));
  return g;
});
reg("turtle", "Turtle", 1, 2, 1, false, () => {
  const g = new THREE.Group();
  const shell = mat("#6B7F3A");
  Sph(g, 0.4, shell, 0.5, 0.3, 0.85).scale.set(1, 0.55, 1.2);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    Sph(g, 0.1, mat("#4F6029"), 0.5 + Math.cos(a) * 0.2, 0.5, 0.85 + Math.sin(a) * 0.28).scale.set(1, 0.4, 1);
  }
  Sph(g, 0.12, mat("#9BB46A"), 0.5, 0.28, 1.5);
  [[0.2, 0.5], [0.8, 0.5], [0.2, 1.2], [0.8, 1.2]].forEach(([x, z]) => Sph(g, 0.1, mat("#9BB46A"), x, 0.1, z).scale.set(1, 0.6, 1.3));
  [-1, 1].forEach((s) => Sph(g, 0.02, black, 0.5 + s * 0.06, 0.33, 1.6));
  return g;
});
reg("frog", "Frog", 1, 1, 1, false, () => {
  const g = new THREE.Group();
  const gr = mat("#4CAF50");
  Sph(g, 0.22, gr, 0.5, 0.28, 0.5).scale.set(1, 0.7, 1.1);
  [-1, 1].forEach((s) => {
    Sph(g, 0.07, gr, 0.5 + s * 0.12, 0.45, 0.62);
    Sph(g, 0.03, black, 0.5 + s * 0.12, 0.47, 0.68);
    Sph(g, 0.1, gr, 0.5 + s * 0.22, 0.12, 0.3).scale.set(0.8, 0.8, 1.4);
    Sph(g, 0.05, gr, 0.5 + s * 0.15, 0.07, 0.72);
  });
  B(g, 0.2, 0.03, 0.04, tailM, 0.5, 0.32, 0.72);
  return g;
});
reg("crocodile", "Crocodile", 1, 4, 1, false, () => {
  const g = new THREE.Group();
  const gr = mat("#4F7F3A");
  const dk = mat("#3B6029");
  B(g, 0.5, 0.22, 1.4, gr, 0.5, 0.3, 2.0);
  [[0.4, 1.0, 0.4], [0.3, 0.7, 0.25], [0.2, 0.5, 0.12]].forEach(([w, l, h], i) => B(g, w, h + 0.1, l, gr, 0.5, 0.25 - i * 0.03, 1.3 - [0, 0.8, 1.35][i] * 0.7));
  B(g, 0.42, 0.2, 0.8, gr, 0.5, 0.28, 3.1);
  B(g, 0.3, 0.12, 0.7, gr, 0.5, 0.22, 3.6);
  [-1, 1].forEach((s) => {
    Sph(g, 0.05, yellowF, 0.5 + s * 0.14, 0.42, 3.05);
    Sph(g, 0.02, black, 0.5 + s * 0.14, 0.43, 3.09);
    B(g, 0.14, 0.08, 0.2, dk, 0.5 + s * 0.34, 0.1, 1.5);
    B(g, 0.14, 0.08, 0.2, dk, 0.5 + s * 0.34, 0.1, 2.6);
  });
  for (let z = 1.4; z < 2.8; z += 0.28) Cone(g, 0.05, 0.1, 4, dk, 0.5, 0.45, z);
  return g;
});
reg("dolphin", "Dolphin", 1, 4, 2, false, () => {
  const g = new THREE.Group();
  B(g, 0.9, 0.1, 3.8, mat("#3C9BD6", { transparent: true, opacity: 0.8, roughness: 0.1 }), 0.5, 0.05, 2);
  const sk = mat("#8DA3B5");
  const belly = mat("#E6EEF4");
  const up = (o, a) => ((o.rotation.x = -a), o);
  up(Sph(g, 0.3, sk, 0.5, 1.05, 2.0), 0.45).scale.set(1, 1, 2.6);
  up(Sph(g, 0.17, sk, 0.5, 0.62, 1.15), 0.9).scale.set(1, 1, 2.4);
  up(Sph(g, 0.2, belly, 0.5, 0.98, 2.05), 0.45).scale.set(0.9, 0.7, 2.2);
  Cone(g, 0.07, 0.36, 8, sk, 0.5, 1.42, 2.82).rotation.x = Math.PI / 2 - 0.45;
  B(g, 0.55, 0.04, 0.22, sk, 0.5, 0.36, 0.78).rotation.x = 0.5;
  Cone(g, 0.09, 0.32, 4, sk, 0.5, 1.4, 1.75).rotation.x = -0.9;
  [-1, 1].forEach((sx) => {
    B(g, 0.22, 0.04, 0.3, sk, 0.5 + sx * 0.28, 0.95, 2.35).rotation.z = sx * 0.4;
    Sph(g, 0.025, black, 0.5 + sx * 0.14, 1.28, 2.52);
  });
  return g;
});

/* ----- more kitchen items ----- */
const stoneTop = mat("#5B6068");
reg("microwave", "Microwave", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  B(g, 0.92, 0.55, 0.76, mat(c), 0.5, 0.275, 0.5);
  B(g, 0.58, 0.4, 0.04, tintM, 0.38, 0.28, 0.9);
  B(g, 0.2, 0.46, 0.04, black, 0.8, 0.28, 0.9);
  [0.4, 0.28, 0.16].forEach((y) => Sph(g, 0.025, steel, 0.8, y, 0.93));
  B(g, 0.03, 0.34, 0.04, steel, 0.65, 0.28, 0.94);
  return g;
});
reg("toaster", "Toaster", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  B(g, 0.62, 0.38, 0.38, mat(c, { metalness: 0.4 }), 0.5, 0.19, 0.5);
  [0.42, 0.58].forEach((z) => {
    B(g, 0.46, 0.01, 0.06, black, 0.5, 0.385, z);
    B(g, 0.4, 0.14, 0.05, mat("#D9A860"), 0.5, 0.42, z);
  });
  B(g, 0.04, 0.06, 0.04, steel, 0.83, 0.28, 0.5);
  return g;
});
reg("blender", "Blender", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  B(g, 0.5, 0.25, 0.5, mat(c), 0.5, 0.125, 0.5);
  Cyl(g, 0.2, 0.24, 0.55, glass(), 0.5, 0.52, 0.5);
  Cyl(g, 0.21, 0.21, 0.07, black, 0.5, 0.835, 0.5);
  Cyl(g, 0.05, 0.05, 0.03, steel, 0.5, 0.27, 0.5);
  Sph(g, 0.03, steel, 0.5, 0.2, 0.76);
  return g;
});
reg("coffeemaker", "Coffee maker", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  B(g, 0.7, 0.08, 0.6, black, 0.5, 0.04, 0.5);
  B(g, 0.6, 0.8, 0.25, m, 0.5, 0.48, 0.25);
  B(g, 0.6, 0.15, 0.45, m, 0.5, 0.8, 0.4);
  Cyl(g, 0.17, 0.2, 0.3, glass(), 0.5, 0.23, 0.62);
  Cyl(g, 0.16, 0.19, 0.14, mat("#4A2C17"), 0.5, 0.15, 0.62);
  Sph(g, 0.025, tailM, 0.7, 0.55, 0.38);
  return g;
});
reg("ricecooker", "Rice cooker", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  Cyl(g, 0.38, 0.4, 0.4, white, 0.5, 0.2, 0.5);
  Cyl(g, 0.395, 0.395, 0.06, mat(c), 0.5, 0.28, 0.5);
  Sph(g, 0.36, white, 0.5, 0.4, 0.5).scale.set(1, 0.5, 1);
  Sph(g, 0.04, steel, 0.5, 0.6, 0.5);
  Sph(g, 0.03, tailM, 0.5, 0.18, 0.89);
  return g;
});
reg("mixergrinder", "Mixer grinder", 1, 1, 1, false, (c) => {
  const g = new THREE.Group();
  B(g, 0.62, 0.3, 0.5, mat(c), 0.5, 0.15, 0.5);
  Cyl(g, 0.2, 0.17, 0.42, steel, 0.5, 0.51, 0.5);
  Cyl(g, 0.21, 0.21, 0.06, mat(shade(c, 0.8)), 0.5, 0.75, 0.5);
  tube(g, [0.72, 0.3, 0.5], [0.72, 0.68, 0.5], 0.03, black);
  Cyl(g, 0.05, 0.05, 0.06, black, 0.5, 0.18, 0.78).rotation.x = Math.PI / 2;
  return g;
});
reg("pressurecooker", "Pressure cooker", 1, 1, 1, false, () => {
  const g = new THREE.Group();
  Cyl(g, 0.38, 0.38, 0.5, steel, 0.5, 0.25, 0.5);
  Cyl(g, 0.4, 0.4, 0.08, steel, 0.5, 0.54, 0.5);
  [-1, 1].forEach((s) => B(g, 0.2, 0.06, 0.08, black, 0.5 + s * 0.4, 0.5, 0.5));
  Cyl(g, 0.04, 0.04, 0.1, black, 0.5, 0.63, 0.5);
  Cyl(g, 0.07, 0.07, 0.04, black, 0.5, 0.7, 0.5);
  return g;
});
reg("wok", "Wok", 1, 1, 1, false, () => {
  const g = new THREE.Group();
  add(g, G(THREE.SphereGeometry, 0.4, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat("#3A3A3A", { side: THREE.DoubleSide, metalness: 0.5, roughness: 0.5 }), 0.4, 0.45, 0.5);
  add(g, G(THREE.TorusGeometry, 0.22, 0.03, 6, 14), steel, 0.4, 0.08, 0.5).rotation.x = Math.PI / 2;
  tube(g, [0.78, 0.45, 0.5], [0.97, 0.5, 0.5], 0.035, black);
  return g;
});
reg("tawa", "Tawa (flat pan)", 1, 1, 0.25, false, () => {
  const g = new THREE.Group();
  Cyl(g, 0.42, 0.4, 0.07, mat("#2A2A2A", { metalness: 0.4 }), 0.4, 0.05, 0.5);
  B(g, 0.28, 0.04, 0.07, black, 0.83, 0.1, 0.5);
  return g;
});
reg("cuttingboard", "Cutting board", 1, 2, 0.25, false, () => {
  const g = new THREE.Group();
  B(g, 0.9, 0.07, 1.8, mat("#C89B5E"), 0.5, 0.04, 1);
  B(g, 0.1, 0.03, 0.45, steel, 0.35, 0.1, 0.7);
  B(g, 0.1, 0.04, 0.22, black, 0.35, 0.1, 1.05);
  Sph(g, 0.1, tailM, 0.68, 0.16, 1.1);
  return g;
});
reg("platestack", "Plate stack", 1, 1, 0.5, false, (c) => {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) Cyl(g, 0.4, 0.34, 0.05, white, 0.5, 0.03 + i * 0.055, 0.5);
  Cyl(g, 0.405, 0.405, 0.012, mat(c), 0.5, 0.3, 0.5);
  return g;
});
reg("dinnerset", "Dinner set", 2, 1, 0.5, false, (c) => {
  const g = new THREE.Group();
  [0.5, 1.5].forEach((x) => {
    Cyl(g, 0.4, 0.3, 0.06, white, x, 0.03, 0.5);
    Cyl(g, 0.25, 0.22, 0.012, mat(c), x, 0.065, 0.5);
  });
  Cyl(g, 0.12, 0.1, 0.16, mat(c), 1.0, 0.09, 0.3);
  Cyl(g, 0.12, 0.1, 0.16, mat(c), 1.0, 0.09, 0.7);
  B(g, 0.05, 0.015, 0.4, steel, 0.0 + 0.08, 0.02, 0.5);
  B(g, 0.05, 0.015, 0.4, steel, 1.92, 0.02, 0.5);
  return g;
});
reg("basecab", "Kitchen base cabinet", 2, 1, 1.5, true, (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  B(g, 1.9, 0.15, 0.9, black, 1, 0.075, 0.5);
  B(g, 1.96, 1.5, 0.96, m, 1, 0.9, 0.5);
  B(g, 2, 0.12, 1, stoneTop, 1, 1.74, 0.5);
  [0.5, 1.5].forEach((x) => {
    B(g, 0.9, 1.2, 0.03, mat(shade(c, 1.12)), x, 0.9, 0.985);
    B(g, 0.04, 0.3, 0.05, steel, x + (x < 1 ? 0.35 : -0.35), 1.3, 1.0 - 0.0);
  });
  return g;
});
reg("pantry", "Pantry cabinet", 2, 1, 3, false, (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  B(g, 1.96, 3.4, 0.96, m, 1, 1.85, 0.5);
  B(g, 1.9, 0.15, 0.9, black, 1, 0.075, 0.5);
  [[0.5, 0.9, 1.5], [1.5, 0.9, 1.5], [0.5, 2.65, 1.3], [1.5, 2.65, 1.3]].forEach(([x, y, h]) => {
    B(g, 0.9, h, 0.03, mat(shade(c, 1.12)), x, y, 0.985);
    B(g, 0.04, 0.3, 0.05, steel, x + (x < 1 ? 0.35 : -0.35), y, 1.0);
  });
  return g;
});
reg("kitchenisland", "Kitchen island", 4, 2, 1.5, true, (c) => {
  const g = new THREE.Group();
  const m = mat(c);
  B(g, 3.5, 1.6, 1.5, m, 2, 0.8, 0.75);
  B(g, 4, 0.14, 2, stoneTop, 2, 1.72, 1);
  [0.2, 3.8].forEach((x) => B(g, 0.1, 1.65, 0.1, black, x, 0.83, 1.9));
  [0.7, 2, 3.3].forEach((x) => {
    B(g, 1.1, 0.5, 0.03, mat(shade(c, 1.12)), x, 1.25, 1.51);
    B(g, 0.5, 0.04, 0.05, steel, x, 1.4, 1.54);
    B(g, 1.1, 0.5, 0.03, mat(shade(c, 1.12)), x, 0.6, 1.51);
    B(g, 0.5, 0.04, 0.05, steel, x, 0.75, 1.54);
  });
  return g;
});
reg("rangehood", "Range hood", 2, 1, 2, false, () => {
  const g = new THREE.Group();
  B(g, 1.9, 0.35, 0.95, steel, 1, 0.2, 0.5);
  B(g, 1.7, 0.03, 0.85, lit("#FFF3B0"), 1, 0.02, 0.5);
  B(g, 0.6, 1.9, 0.5, steel, 1, 1.3, 0.35);
  B(g, 0.7, 0.1, 0.55, steel, 1, 2.3, 0.35);
  return g;
});
reg("dishwasher", "Dishwasher", 2, 1, 1.5, true, () => {
  const g = new THREE.Group();
  B(g, 1.96, 1.65, 0.96, steel, 1, 0.83, 0.5);
  B(g, 1.9, 0.22, 0.02, black, 1, 1.52, 0.99);
  B(g, 1.4, 0.05, 0.07, white, 1, 1.25, 1.0);
  [0.3, 0.45, 0.6].forEach((x) => Sph(g, 0.03, lit("#2AD04A"), 1.5 + x - 0.45, 1.52, 1.0));
  return g;
});
reg("waterdispenser", "Water dispenser", 1, 1, 3, false, (c) => {
  const g = new THREE.Group();
  B(g, 0.7, 2.0, 0.65, mat(c), 0.5, 1.0, 0.5);
  B(g, 0.55, 0.06, 0.2, black, 0.5, 0.8, 0.9);
  Cyl(g, 0.03, 0.03, 0.12, tailM, 0.38, 1.3, 0.85);
  Cyl(g, 0.03, 0.03, 0.12, mat("#2A6BFF"), 0.62, 1.3, 0.85);
  Cyl(g, 0.1, 0.22, 0.2, mat("#6FB6FF", { transparent: true, opacity: 0.55 }), 0.5, 2.1, 0.5);
  Cyl(g, 0.28, 0.28, 0.95, mat("#6FB6FF", { transparent: true, opacity: 0.55 }), 0.5, 2.68, 0.5);
  return g;
});
reg("fruitbowl", "Fruit bowl", 1, 1, 0.5, false, (c) => {
  const g = new THREE.Group();
  add(g, G(THREE.SphereGeometry, 0.4, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(c, { side: THREE.DoubleSide }), 0.5, 0.4, 0.5);
  [[0.38, 0.5], [0.62, 0.45], [0.5, 0.68]].forEach(([x, z]) => Sph(g, 0.12, tailM, x, 0.26, z));
  [[0.55, 0.3], [0.35, 0.7]].forEach(([x, z]) => Sph(g, 0.11, orangeM, x, 0.3, z));
  tube(g, [0.3, 0.33, 0.35], [0.5, 0.4, 0.5], 0.035, yellowF);
  tube(g, [0.5, 0.4, 0.5], [0.68, 0.34, 0.6], 0.035, yellowF);
  return g;
});
reg("tandoor", "Tandoor (clay oven)", 2, 2, 2, false, (c) => {
  const g = new THREE.Group();
  const clay = mat("#B5532A", { roughness: 0.9 });
  Cyl(g, 0.8, 0.93, 1.6, clay, 1, 0.8, 1);
  Cyl(g, 0.58, 0.8, 0.3, clay, 1, 1.75, 1);
  add(g, G(THREE.TorusGeometry, 0.58, 0.07, 8, 24), clay, 1, 1.92, 1).rotation.x = Math.PI / 2;
  Cyl(g, 0.5, 0.5, 0.02, black, 1, 1.9, 1);
  Cyl(g, 0.9, 0.93, 0.12, mat(c), 1, 0.55, 1);
  B(g, 0.4, 0.4, 0.05, black, 1, 0.35, 1.9);
  return g;
});

/* ----- landscape: ocean, river, waterfall, mountain, forest, island, hill, cliff ----- */
const rockM = mat("#8A8D91", { flatShading: true, roughness: 0.95 });
const rockBrown = mat("#7C6A55", { flatShading: true, roughness: 0.95 });
const sandM = mat("#D8C27A");
const grassM = mat("#5DAA4F");
const waterTint = mat("#3C9BD6", { transparent: true, opacity: 0.85, roughness: 0.1 });
const snowM = mat("#F4F8FB", { flatShading: true });

regCustom("ocean", "Ocean (custom)", [
  { key: "w", label: "Width", kind: "num", min: 4, max: 16, step: 1, def: 8 },
  { key: "d", label: "Length", kind: "num", min: 4, max: 16, step: 1, def: 8 },
  { key: "waves", label: "Waves", kind: "sel", def: "rolling", options: [["calm", "Calm"], ["rolling", "Rolling"], ["rough", "Rough"]] },
  { key: "beach", label: "Beach edge", kind: "tog", def: true },
], (o) => ({ w: o.w, d: o.d, h: 0.5, top: true }), (c, o) => {
  const g = new THREE.Group();
  const { w, d } = o;
  B(g, w - 0.04, 0.3, d - 0.04, mat("#1F5F8F"), w / 2, 0.15, d / 2);
  B(g, w - 0.04, 0.1, d - 0.04, waterTint, w / 2, 0.35, d / 2);
  if (o.beach) {
    B(g, w - 0.04, 0.5, 1.3, sandM, w / 2, 0.25, 0.65);
    B(g, w - 0.04, 0.4, 0.5, mat("#CDB87A"), w / 2, 0.2, 1.55);
    B(g, w - 0.04, 0.04, 0.1, white, w / 2, 0.41, 1.9);
  }
  const amp = { calm: 0.08, rolling: 0.2, rough: 0.24 }[o.waves];
  const wave = mat("#6FC1EA", { transparent: true, opacity: 0.9, roughness: 0.2 });
  let i = 0;
  for (let z = o.beach ? 2.4 : 0.8; z < d - 0.5; z += 1.1) {
    for (let x = 1.2 + (i % 2) * 0.9; x < w - 1.1; x += 2.2) {
      const jx = x + (rnd(i * 3) - 0.5) * 0.3;
      const jz = z + (rnd(i * 3 + 1) - 0.5) * 0.3;
      Sph(g, 0.5, wave, jx, 0.4, jz).scale.set(1.7, amp, 0.45);
      if (o.waves === "rough") Sph(g, 0.22, white, jx, 0.4 + 0.5 * amp, jz).scale.set(1.5, 0.3, 0.6);
      i++;
    }
  }
  return g;
});

regCustom("rivercustom", "River (custom)", [
  { key: "wid", label: "Width", kind: "num", min: 3, max: 10, step: 1, def: 4 },
  { key: "len", label: "Length", kind: "num", min: 3, max: 16, step: 1, def: 6 },
  { key: "bend", label: "Shape", kind: "sel", def: "straight", options: [["straight", "Straight"], ["bend", "Bend (square piece)"]] },
  { key: "rapids", label: "Rapids", kind: "tog", def: false },
], (o) => (o.bend === "bend" ? { w: o.len, d: o.len, h: 0.5, top: true } : { w: o.wid, d: o.len, h: 0.5, top: true }), (c, o) => {
  const g = new THREE.Group();
  const soil = mat("#C9B070");
  const reed = mat("#6E9A31");
  if (o.bend !== "bend") {
    const { wid: w, len: d } = o;
    const ww = Math.max(1, w - 1.6);
    B(g, w - 0.04, 0.2, d - 0.04, grassM, w / 2, 0.1, d / 2);
    [(w - ww) / 2 - 0.1, (w + ww) / 2 + 0.1].forEach((x) => B(g, 0.2, 0.14, d - 0.04, soil, x, 0.1, d / 2));
    B(g, ww, 0.1, d - 0.04, waterTint, w / 2, 0.22, d / 2);
    for (let z = 0.5, i = 0; z < d - 0.3; z += 0.8, i++) {
      const left = i % 2 === 0;
      const x = left ? (w - ww) / 2 - 0.3 - rnd(i) * 0.15 : (w + ww) / 2 + 0.3 + rnd(i) * 0.15;
      if (x > 0.2 && x < w - 0.2) Ico(g, 0.13 + rnd(i + 3) * 0.1, rockM, x, 0.24, z, 1, 0.8, 1, rnd(i) * 3);
      if (i % 3 === 1 && x > 0.2 && x < w - 0.2) for (let k = 0; k < 3; k++) Cyl(g, 0.012, 0.015, 0.3 + k * 0.05, reed, x + (k - 1) * 0.06, 0.35, z + 0.2);
    }
    if (o.rapids) for (let z = 0.6, i = 0; z < d - 0.4; z += 0.9, i++) {
      B(g, ww * 0.7, 0.03, 0.08, white, w / 2 + (rnd(i) - 0.5) * 0.3, 0.29, z);
      Ico(g, 0.12, rockM, w / 2 + (rnd(i + 5) - 0.5) * (ww - 0.6), 0.27, z + 0.35, 1, 0.7, 1, i);
    }
  } else {
    const n = o.len;
    const ww = Math.min(Math.max(1, o.wid - 1.6), n - 1.2);
    const r1 = n / 2 - ww / 2;
    const r2 = n / 2 + ww / 2;
    const ringM = (col, extra = {}) => mat(col, { side: THREE.DoubleSide, ...extra });
    B(g, n - 0.04, 0.2, n - 0.04, grassM, n / 2, 0.1, n / 2);
    add(g, G(THREE.RingGeometry, Math.max(0.01, r1 - 0.2), r1, 40, 1, 0, Math.PI / 2), ringM("#C9B070"), 0, 0.2, 0).rotation.x = Math.PI / 2;
    add(g, G(THREE.RingGeometry, r2, r2 + 0.2, 40, 1, 0, Math.PI / 2), ringM("#C9B070"), 0, 0.2, 0).rotation.x = Math.PI / 2;
    add(g, G(THREE.RingGeometry, r1, r2, 40, 1, 0, Math.PI / 2), ringM("#3C9BD6", { transparent: true, opacity: 0.85, roughness: 0.1 }), 0, 0.26, 0).rotation.x = Math.PI / 2;
    for (let i = 0; i < 10; i++) {
      const a = 0.12 + (i / 10) * (Math.PI / 2 - 0.2);
      const r = i % 2 ? r1 - 0.3 : r2 + 0.3;
      if (r > 0.6) Ico(g, 0.13 + rnd(i) * 0.1, rockM, Math.cos(a) * r, 0.24, Math.sin(a) * r, 1, 0.8, 1, i);
      if (o.rapids && i % 2 === 0) {
        const rm = (r1 + r2) / 2;
        B(g, ww * 0.6, 0.03, 0.08, white, Math.cos(a) * rm, 0.3, Math.sin(a) * rm).rotation.y = -a;
      }
    }
  }
  return g;
});

regCustom("waterfall", "Waterfall (custom)", [
  { key: "wid", label: "Fall width", kind: "num", min: 1, max: 6, step: 1, def: 3 },
  { key: "tall", label: "Height", kind: "num", min: 3, max: 10, step: 1, def: 6 },
  { key: "pool", label: "Pool at the bottom", kind: "tog", def: true },
], (o) => ({ w: o.wid + 2, d: o.pool ? 4 : 2, h: o.tall, top: false }), (c, o) => {
  const g = new THREE.Group();
  const w = o.wid + 2;
  const H = o.tall * BH;
  const sheet = mat("#BFE6FA", { transparent: true, opacity: 0.75, roughness: 0.1 });
  B(g, w - 0.04, H - 0.12, 1.5, rockBrown, w / 2, (H - 0.12) / 2, 0.75);
  [0.45, w - 0.45].forEach((x, k) => {
    B(g, 0.9, H * 0.7, 0.45, rockM, x, (H * 0.7) / 2, 1.72);
    Ico(g, 0.45, rockM, x, H * 0.7 + 0.1, 1.6, 1, 0.8, 1, k + 1);
    Sph(g, 0.4, leafA, x, H - 0.2, 0.7).scale.set(1, 0.7, 1);
  });
  B(g, o.wid, 0.1, 1.55, waterTint, w / 2, H - 0.07, 0.78);
  B(g, o.wid, H - 0.5, 0.1, sheet, w / 2, (H - 0.5) / 2 + 0.35, 1.56);
  for (let i = 0; i < o.wid * 2; i++) {
    const hh = H * (0.5 + rnd(i) * 0.4);
    B(g, 0.07, hh, 0.04, white, 1 + 0.25 + (i / (o.wid * 2)) * o.wid, H - 0.3 - hh / 2, 1.64);
  }
  if (o.pool) {
    B(g, w - 0.04, 0.3, 2.4, sandM, w / 2, 0.15, 2.8);
    B(g, w - 0.5, 0.1, 2.0, waterTint, w / 2, 0.3, 2.85);
    for (let i = 0; i < 9; i++) {
      const t = i / 9;
      const x = 0.3 + t * (w - 0.6);
      Ico(g, 0.15 + rnd(i) * 0.1, rockM, x, 0.32, 3.85, 1, 0.8, 1, i);
    }
    [0.2, w - 0.2].forEach((x) => [2.3, 3.2].forEach((z, k) => Ico(g, 0.18, rockM, x, 0.32, z, 1, 0.8, 1, k)));
  } else {
    B(g, w - 0.04, 0.25, 0.4, rockM, w / 2, 0.125, 1.8);
  }
  B(g, o.wid + 0.3, 0.04, 0.5, white, w / 2, o.pool ? 0.37 : 0.28, 1.85);
  const mist = mat("#FFFFFF", { transparent: true, opacity: 0.45 });
  for (let i = 0; i < 4; i++) Sph(g, 0.3, mist, w / 2 + (i - 1.5) * (o.wid / 4 + 0.1), 0.55 + (i % 2) * 0.1, 1.75);
  return g;
});

regCustom("mountain", "Mountain (custom)", [
  { key: "size", label: "Base size", kind: "num", min: 4, max: 12, step: 1, def: 6 },
  { key: "tall", label: "Height", kind: "num", min: 3, max: 12, step: 1, def: 7 },
  { key: "peaks", label: "Peaks", kind: "num", min: 1, max: 3, step: 1, def: 2 },
  { key: "style", label: "Style", kind: "sel", def: "snowy", options: [["snowy", "Snow-capped"], ["rocky", "Rocky"], ["green", "Forested"], ["volcano", "Volcano"]] },
], (o) => ({ w: o.size, d: o.size, h: o.tall, top: false }), (c, o) => {
  const g = new THREE.Group();
  const n = o.size;
  const H = o.tall * BH;
  const col = { snowy: "#7D8187", rocky: "#8A7F75", green: "#5E8F4B", volcano: "#5A4B45" }[o.style];
  const body = mat(col, { flatShading: true, roughness: 0.95 });
  B(g, n - 0.04, 0.12, n - 0.04, o.style === "green" ? grassM : mat("#7C7F83"), n / 2, 0.06, n / 2);
  const cone = (x, z, R, h, ry) => {
    Cone(g, R, h, 7, body, x, 0.1 + h / 2, z).rotation.y = ry;
    return { x, z, R, h };
  };
  const peaks = [];
  if (o.style === "volcano") {
    Cyl(g, 0.16 * n, 0.48 * n, H - 0.1, body, n / 2, 0.1 + (H - 0.1) / 2, n / 2);
    Cyl(g, 0.12 * n, 0.12 * n, 0.04, black, n / 2, H - 0.0, n / 2);
    Cyl(g, 0.11 * n, 0.11 * n, 0.03, lit("#FF6A1A"), n / 2, H - 0.03, n / 2);
    [-0.5, 0.9, 2.3].forEach((a, i) => {
      const r = 0.2 * n + 0.1 * n * (1 - i * 0.18);
      B(g, 0.12, H * 0.55, 0.05, lit("#FF6A1A"), n / 2 + Math.cos(a) * r, H * 0.62, n / 2 + Math.sin(a) * r).rotation.set(0.0, -a + Math.PI / 2, 0.0);
    });
  } else {
    peaks.push(cone(n / 2, n / 2, 0.48 * n, H - 0.1, 0.3));
    if (o.peaks >= 2) peaks.push(cone(n / 2 - 0.22 * n, n / 2 + 0.12 * n, 0.26 * n, (H - 0.1) * 0.62, 1.1));
    if (o.peaks >= 3) peaks.push(cone(n / 2 + 0.22 * n, n / 2 - 0.1 * n, 0.26 * n, (H - 0.1) * 0.5, 2.0));
    if (o.style === "snowy")
      peaks.forEach((p, i) => Cone(g, p.R * 0.31, p.h * 0.3, 7, snowM, p.x, 0.1 + p.h * 0.85, p.z).rotation.y = [0.3, 1.1, 2.0][i]);
  }
  if (o.style === "green") {
    const pine = mat("#1F5F34");
    for (let i = 0; i < Math.min(26, n * 3); i++) {
      const a = rnd(i * 2) * Math.PI * 2;
      const r = n * (0.14 + rnd(i * 2 + 1) * 0.26);
      const y = 0.12 + Math.max(0, (H - 0.1) * (1 - r / (0.48 * n))) * 0.45;
      Cone(g, 0.14, 0.45, 6, pine, n / 2 + Math.cos(a) * r, y + 0.2, n / 2 + Math.sin(a) * r);
    }
  } else {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      Ico(g, 0.15 + rnd(i) * 0.1, rockM, n / 2 + Math.cos(a) * n * 0.38, 0.22, n / 2 + Math.sin(a) * n * 0.38, 1, 0.8, 1, i);
    }
  }
  return g;
});

// a small tree for forests
function smallTree(g, kind, x, z, s, i) {
  const trunkH = 0.7 * s;
  Cyl(g, 0.06 * s, 0.09 * s, trunkH, bark, x, 0.14 + trunkH / 2, z);
  const base = 0.14 + trunkH;
  const k = kind === "mixed" ? (i % 3 === 0 ? "round" : "pine") : kind;
  if (k === "pine") {
    const pine = mat(i % 2 ? "#1F5F34" : "#2A6E3F");
    Cone(g, 0.55 * s, 1.1 * s, 7, pine, x, base + 0.35 * s, z);
    Cone(g, 0.42 * s, 0.9 * s, 7, pine, x, base + 0.85 * s, z);
    Cone(g, 0.3 * s, 0.8 * s, 7, pine, x, base + 1.25 * s, z);
  } else if (k === "jungle") {
    Sph(g, 0.6 * s, mat(["#2E7D32", "#3FA34D", "#1F6B2A"][i % 3]), x, base + 0.45 * s, z).scale.set(1.2, 0.8, 1.2);
    Sph(g, 0.4 * s, leafB, x + 0.25 * s, base + 0.9 * s, z - 0.1 * s);
  } else {
    const cols = k === "autumn" ? ["#D2691E", "#C0392B", "#E8A33D"] : k === "blossom" ? ["#F7B6CD", "#F29BB8", "#FAD0DF"] : ["#2E7D32", "#3FA34D", "#2B6B2F"];
    Sph(g, 0.5 * s, mat(cols[i % 3]), x, base + 0.4 * s, z);
    Sph(g, 0.35 * s, mat(cols[(i + 1) % 3]), x + 0.2 * s, base + 0.8 * s, z + 0.05);
  }
}
regCustom("forest", "Forest (custom)", [
  { key: "w", label: "Width", kind: "num", min: 3, max: 12, step: 1, def: 6 },
  { key: "d", label: "Length", kind: "num", min: 3, max: 12, step: 1, def: 6 },
  { key: "kind", label: "Trees", kind: "sel", def: "mixed", options: [["mixed", "Mixed"], ["pine", "Pine"], ["jungle", "Jungle"], ["autumn", "Autumn"], ["blossom", "Blossom"]] },
  { key: "density", label: "Density", kind: "sel", def: "normal", options: [["sparse", "Sparse"], ["normal", "Normal"], ["dense", "Dense"]] },
], (o) => ({ w: o.w, d: o.d, h: 3, top: false }), (c, o) => {
  const g = new THREE.Group();
  const { w, d } = o;
  B(g, w - 0.04, 0.14, d - 0.04, mat(o.kind === "autumn" ? "#8B6F3A" : o.kind === "jungle" ? "#3F7A35" : "#4C8A3E"), w / 2, 0.07, d / 2);
  const count = Math.max(2, Math.min(44, Math.round(w * d * { sparse: 0.12, normal: 0.22, dense: 0.38 }[o.density])));
  const cols = Math.max(1, Math.round(Math.sqrt((count * (w - 1.2)) / (d - 1.2))));
  const rows = Math.ceil(count / cols);
  const cw = (w - 1.2) / cols;
  const ch = (d - 1.2) / rows;
  for (let i = 0; i < count; i++) {
    const cx = i % cols;
    const cz = Math.floor(i / cols);
    const x = 0.6 + (cx + 0.5 + (rnd(i * 2) - 0.5) * 0.6) * cw;
    const z = 0.6 + (cz + 0.5 + (rnd(i * 2 + 1) - 0.5) * 0.6) * ch;
    smallTree(g, o.kind, x, z, 0.8 + rnd(i + 40) * 0.4, i);
  }
  for (let i = 0; i < Math.min(14, count); i++) {
    const x = 0.4 + rnd(i * 5 + 7) * (w - 0.8);
    const z = 0.4 + rnd(i * 5 + 8) * (d - 0.8);
    if (i % 4 === 0) Ico(g, 0.14, rockM, x, 0.2, z, 1, 0.7, 1, i);
    else Sph(g, 0.16, i % 2 ? leafA : leafB, x, 0.22, z).scale.set(1, 0.7, 1);
  }
  return g;
});
reg("island", "Tropical island 5×5", 5, 5, 2, false, () => {
  const g = new THREE.Group();
  B(g, 4.96, 0.2, 4.96, waterTint, 2.5, 0.1, 2.5);
  add(g, G(THREE.TorusGeometry, 2.25, 0.05, 6, 36), white, 2.5, 0.22, 2.5).rotation.x = Math.PI / 2;
  Cyl(g, 1.8, 2.15, 0.35, sandM, 2.5, 0.37, 2.5);
  const trunk = mat("#8B6B43");
  [[2.0, 2.2, 0.2], [3.1, 2.9, -0.25]].forEach(([x, z, lean], k) => {
    for (let i = 0; i < 3; i++) Cyl(g, 0.08, 0.1, 0.6, trunk, x + lean * (i / 2), 0.7 + i * 0.58, z).rotation.z = -lean;
    for (let f = 0; f < 6; f++) {
      const a = (f * Math.PI) / 3;
      const fr = Sph(g, 0.45, leafB, x + lean + Math.cos(a) * 0.4, 2.3, z + Math.sin(a) * 0.4);
      fr.scale.set(1, 0.12, 0.45);
      fr.rotation.order = "YZX";
      fr.rotation.set(0, -a, -0.35);
    }
    Sph(g, 0.08, bark, x + lean, 2.2 - k * 0.0, z);
  });
  [[3.4, 1.6], [1.5, 3.4], [3.0, 3.6]].forEach(([x, z], i) => Ico(g, 0.25 + rnd(i) * 0.15, rockM, x, 0.6, z, 1, 0.8, 1, i));
  B(g, 0.5, 0.05, 0.8, tailM, 1.6, 0.56, 1.5).rotation.y = 0.5;
  return g;
});
reg("hill", "Grassy hill 4×4", 4, 4, 2, false, () => {
  const g = new THREE.Group();
  const dome = add(g, G(THREE.SphereGeometry, 1.95, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat("#5FAF4F"), 2, 0, 2);
  dome.scale.set(1, 0.8, 1);
  [[1.2, 2.9, 0.9], [3.0, 1.4, 0.85], [2.5, 3.1, 0.8]].forEach(([x, z, s], i) => smallTree(g, "round", x, z, s, i));
  [[2.2, 1.2], [1.1, 1.6]].forEach(([x, z], i) => Ico(g, 0.18, rockM, x, 1.3, z, 1, 0.7, 1, i));
  return g;
});
reg("cliff", "Rock cliff 4×2", 4, 2, 5, false, () => {
  const g = new THREE.Group();
  const layers = [[3.8, 1.0, 1.8], [3.5, 1.2, 1.7], [3.2, 1.0, 1.6], [2.8, 1.2, 1.5], [2.3, 1.1, 1.3]];
  let y = 0;
  layers.forEach(([lw, lh, ld], i) => {
    B(g, lw, lh, ld, i % 2 ? rockBrown : rockM, 2 + (rnd(i) - 0.5) * 0.2, y + lh / 2, 1);
    y += lh;
  });
  B(g, 2.3, 0.1, 1.3, grassM, 2, y + 0.05, 1);
  [[0.5, 1.5], [3.5, 1.4], [3.3, 0.5]].forEach(([x, z], i) => Ico(g, 0.35, rockM, x, 0.3, z, 1, 0.8, 1, i));
  return g;
});

export const GROUPS = [
  { title: "Bricks", keys: ["b1x1", "b1x2", "b1x3", "b1x4", "b2x2", "b2x3", "b2x4"] },
  { title: "Flat bricks (smooth top)", keys: ["f1x1", "f1x2", "f1x3", "f1x4", "f2x2", "f2x3", "f2x4"] },
  { title: "Flat tiles (thin)", keys: ["t1x2", "t2x2", "t2x4", "t4x4", "t4x8"] },
  { title: "Round bricks", keys: ["round1", "round2", "round3", "round4"] },
  { title: "Building parts", keys: ["window", "windowopen", "windowcurtain", "door", "dooropen", "slidingdoor"] },
  { title: "Stairs and ladders", keys: ["stairs4", "stairs4r", "stairs8", "doorstep", "step2", "stepstool", "ladder2", "ladder4", "ladderlean"] },
  { title: "Custom roofs", keys: ["flatroof", "triroof"] },
  { title: "Roofs", keys: ["roof2", "roof4", "gable2", "gable4", "hip2", "hip4", "spire", "dome", "rooftile2", "rooftile4", "tilegable2", "tilegable4", "glassroof2", "glassroof4", "glassgable2", "glassgable4", "glassflat2", "glassflat4", "roofcornerout2", "roofcornerout4", "roofcornerin2", "roofcornerin4", "barrel2", "barrel4", "metalroof4"] },
  { title: "Wooden logs", keys: ["log2", "log4", "logpile", "firewood", "stump"] },
  { title: "Trees", keys: ["pine", "oak", "palm", "birch", "willow", "maple", "cherry", "banyan", "mango", "coconut", "bamboo", "baobab", "cypress", "appletree", "deadtree", "xmas", "bigpine", "snowpine", "acacia"] },
  { title: "Flowering plants", keys: ["rose", "tulips", "lavender", "daisies", "orchid", "hibiscus", "marigold", "lotus", "bougainvillea", "hangbasket", "flowergarden", "meadow", "planter"] },
  { title: "Plants and stones", keys: ["pot", "bush", "flowers", "sunflower", "cactus", "grass", "hedge", "stone", "boulder"] },
  { title: "Outdoor", keys: ["bench", "picnic", "lounger", "patio", "lamppost", "bbq", "fountain", "mailbox", "bin"] },
  { title: "Fences and gates", keys: ["fence2", "fence", "panelfence", "ironfence", "meshfence", "gate2", "gate4", "gateopen"] },
  { title: "Roof rails", keys: ["roofrail2", "roofrail4", "railcorner", "glassrail"] },
  { title: "Lighting", keys: ["tablelamp", "hanglamp", "chandelier", "walllight", "spotlight", "lantern", "streetlight", "streetlight2", "curvedlight", "solarlight", "floodlight", "bollardlight", "pathlight", "ledstrip"] },
  { title: "Floor tiles", keys: ["floortile", "floorc2", "floorc4", "floorw2", "floorw4", "floort2", "floort4"] },
  { title: "Garden tiles", keys: ["gardentile", "lawn2", "lawn4", "gpath", "gsteps", "paver2", "paver4", "cobble2", "cobble4"] },
  { title: "Garden things", keys: ["raisedbed", "wheelbarrow", "wateringcan", "shed", "greenhouse", "pergola", "arch", "birdbath", "scarecrow", "well"] },
  { title: "Roof logs and steel", keys: ["logbeam4", "logbeam8", "logtruss4", "logtruss6", "steel4", "steel8", "steel12", "steelpost", "steeltruss"] },
  { title: "Towers and castle", keys: ["towerround2", "towerround4", "towertop2", "towertop4", "towerroof2", "towerroof4", "castlewall", "castlegate", "flag"] },
  { title: "People", keys: ["person", "worker", "woman", "man", "child", "chef", "doctor", "police", "farmer"] },
  { title: "Pets", keys: ["dog", "cat", "rabbit", "parrot", "fishbowl"] },
  { title: "Animals", keys: ["horse", "cow", "sheep", "pig", "goat", "chicken", "duck", "deer", "zebraanimal", "lion", "tiger", "bear", "panda", "elephant", "giraffe", "camel", "monkey", "penguin", "turtle", "frog", "crocodile", "dolphin"] },
  { title: "Road vehicles", keys: ["car", "taxi", "suv", "policecar", "racecar", "pickup", "van", "ambulance", "firetruck", "truck", "rickshaw", "bus", "schoolbus", "doubledecker"] },
  { title: "Construction vehicles", keys: ["dumptruck", "cement", "tractor", "excavator", "bulldozer", "crane"] },
  { title: "Bridges and construction", keys: ["bridgedeck", "bridgepier", "bridgearch", "trussbridge", "suspension", "cablestay", "beam", "column", "scaffold", "towercrane", "trafficcone", "roadbarrier"] },
  { title: "Air vehicles", keys: ["heli", "jet", "airplane", "balloon", "rocket"] },
  { title: "Roads", keys: ["road4", "road8", "roadcurve", "roadt", "roadx", "zebra", "pavement", "trafficlight", "roadsign"] },
  { title: "Two-wheelers", keys: ["bicycle", "kick", "scooter", "motorbike"] },
  { title: "Railway", keys: ["track2", "track4", "curve", "loco", "coach", "wagon", "tram"] },
  { title: "Water and boats", keys: ["pond", "river", "lake", "sea", "pool6", "pool8", "motorboat", "sailboat", "ship", "canoe", "submarine"] },
  { title: "Furniture", keys: ["stool", "chair", "armchair", "sofa", "table2", "table4", "glasstable", "dresser", "wardrobe", "bookshelf", "floorlamp"] },
  { title: "Beds", keys: ["crib", "bedkids", "bedsingle", "bed", "beddouble", "bedking", "bunk"] },
  { title: "Bathroom", keys: ["toilet", "bathtub", "shower", "basin", "towels", "mirror"] },
  { title: "Home", keys: ["bulb", "tv", "fridge", "washer", "ac", "acout"] },
  { title: "Kitchen", keys: ["oven", "gasstove", "gascyl", "sink", "pan", "cookpot", "kettle", "utensils", "microwave", "toaster", "blender", "coffeemaker", "ricecooker", "mixergrinder", "pressurecooker", "wok", "tawa", "tandoor", "cuttingboard", "platestack", "dinnerset", "fruitbowl"] },
  { title: "Kitchen units", keys: ["basecab", "kitchenisland", "pantry", "dishwasher", "rangehood", "waterdispenser"] },
  { title: "Landscape", keys: ["ocean", "rivercustom", "waterfall", "mountain", "forest", "hill", "cliff", "island"] },
];

/* ---------- placement ---------- */
/* Rotate a piece 90 degrees at a time; the footprint swaps on odd turns and
   the result's origin stays at the min corner of the rotated footprint. */
export function buildPiece(type, color, id, rot = 0, ghostMat = null, opts = null, dim = null) {
  const o = type.params ? cleanOpts(type, opts) : null;
  const base = baseDims(type, o);
  const dm = dim ? { ...base, w: dim.w, d: dim.d, h: dim.h } : base;
  const inner = type.build(color, o);
  if (dim) inner.scale.set(dm.w / base.w, dm.h / base.h, dm.d / base.d); // stretch from the corner, then centre
  inner.position.set(-dm.w / 2, 0, -dm.d / 2);
  const pivot = new THREE.Group();
  pivot.add(inner);
  pivot.rotation.y = (rot * Math.PI) / 2;
  const [w, d] = rot % 2 ? [dm.d, dm.w] : [dm.w, dm.d];
  pivot.position.set(w / 2, 0, d / 2);
  const out = new THREE.Group();
  out.add(pivot);
  out.traverse((o) => {
    if (!o.isMesh) return;
    o.userData.id = id;
    if (ghostMat) {
      o.material = ghostMat;
      o.raycast = () => {};
    } else {
      o.castShadow = !o.material.transparent;
      o.receiveShadow = true;
    }
  });
  return out;
}

const overlaps = (p, x, z, w, d) => x < p.x + p.w && x + w > p.x && z < p.z + p.d && z + d > p.z;

/* Which layer would a piece land on, and is something in the way?
   opts.below: only pieces that start under this layer count as support (the rest are cut away, so you can build inside a house).
   opts.h: the piece's height, so it cannot poke into a hidden roof or beam above it. */
export function stackInfo(pieces, x, z, w, d, opts) {
  const below = opts && opts.below != null ? opts.below : Infinity;
  let lvl = 0;
  for (const p of pieces) if (p.y < below && overlaps(p, x, z, w, d)) lvl = Math.max(lvl, p.y + p.h);
  let blocked = pieces.some((p) => p.y < below && overlaps(p, x, z, w, d) && p.y + p.h === lvl && !p.top);
  if (!blocked && opts && opts.h) blocked = pieces.some((p) => overlaps(p, x, z, w, d) && p.y < lvl + opts.h && p.y + p.h > lvl);
  return { lvl, blocked };
}

/* After a removal, let anything left floating drop down. */
export function settle(pieces) {
  const out = [];
  [...pieces]
    .sort((a, b) => a.y - b.y)
    .forEach((p) => out.push({ ...p, y: stackInfo(out, p.x, p.z, p.w, p.d).lvl }));
  return out;
}
