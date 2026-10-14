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
reg("bed", "Bed 3×5", 3, 5, 2, false, (c) => {
  const g = new THREE.Group();
  B(g, 2.9, 0.5, 4.9, wood, 1.5, 0.45, 2.5);
  B(g, 2.7, 0.35, 4.5, white, 1.5, 0.88, 2.55); // mattress
  B(g, 2.72, 0.15, 3.1, mat(c), 1.5, 1.1, 3.3); // blanket
  [0.85, 2.15].forEach((x) => B(g, 1.1, 0.2, 0.7, white, x, 1.15, 0.7)); // pillows
  B(g, 2.9, 1.3, 0.15, wood, 1.5, 1.0, 0.1); // headboard
  B(g, 2.9, 0.6, 0.12, wood, 1.5, 0.75, 4.9); // footboard
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

/* How the picker groups pieces */
export const GROUPS = [
  { title: "Bricks", keys: ["b1x1", "b1x2", "b1x3", "b1x4", "b2x2", "b2x3", "b2x4"] },
  { title: "Flat bricks (smooth top)", keys: ["f1x1", "f1x2", "f1x3", "f1x4", "f2x2", "f2x3", "f2x4"] },
  { title: "Flat tiles (thin)", keys: ["t1x2", "t2x2", "t2x4", "t4x4", "t4x8"] },
  { title: "Round bricks", keys: ["round1", "round2", "round3", "round4"] },
  { title: "Building parts", keys: ["window", "windowopen", "door", "dooropen"] },
  { title: "Stairs and ladders", keys: ["stairs4", "stairs4r", "stairs8", "doorstep", "step2", "stepstool", "ladder2", "ladder4", "ladderlean"] },
  { title: "Roofs", keys: ["roof2", "roof4", "gable2", "gable4", "hip2", "hip4", "spire", "dome", "rooftile2", "rooftile4", "tilegable2", "tilegable4", "glassroof2", "glassroof4", "glassgable2", "glassgable4", "glassflat2", "glassflat4", "roofcornerout2", "roofcornerout4", "roofcornerin2", "roofcornerin4", "barrel2", "barrel4", "metalroof4"] },
  { title: "Wooden logs", keys: ["log2", "log4", "logpile", "firewood", "stump"] },
  { title: "Trees", keys: ["pine", "oak", "palm"] },
  { title: "Plants and stones", keys: ["pot", "bush", "flowers", "sunflower", "cactus", "grass", "hedge", "stone", "boulder"] },
  { title: "Outdoor", keys: ["bench", "picnic", "lounger", "patio", "lamppost", "bbq", "fountain", "mailbox", "bin"] },
  { title: "Fences and gates", keys: ["fence2", "fence", "panelfence", "ironfence", "meshfence", "gate2", "gate4", "gateopen"] },
  { title: "Roof rails", keys: ["roofrail2", "roofrail4", "railcorner", "glassrail"] },
  { title: "Floor tiles", keys: ["floorc2", "floorc4", "floorw2", "floorw4", "floort2", "floort4"] },
  { title: "Garden tiles", keys: ["lawn2", "lawn4", "gpath", "gsteps", "paver2", "paver4", "cobble2", "cobble4"] },
  { title: "Garden things", keys: ["raisedbed", "wheelbarrow", "wateringcan", "shed", "greenhouse", "pergola", "arch", "birdbath", "scarecrow", "well"] },
  { title: "Roof logs and steel", keys: ["logbeam4", "logbeam8", "logtruss4", "logtruss6", "steel4", "steel8", "steel12", "steelpost", "steeltruss"] },
  { title: "Towers and castle", keys: ["towerround2", "towerround4", "towertop2", "towertop4", "towerroof2", "towerroof4", "castlewall", "castlegate", "flag"] },
  { title: "People", keys: ["person", "worker", "woman", "man", "child", "chef", "doctor", "police", "farmer"] },
  { title: "Pets", keys: ["dog", "cat", "rabbit", "parrot", "fishbowl"] },
  { title: "Road vehicles", keys: ["car", "bus"] },
  { title: "Air vehicles", keys: ["heli", "jet"] },
  { title: "Roads", keys: ["road4", "road8", "roadcurve", "roadt", "roadx", "zebra", "pavement"] },
  { title: "Two-wheelers", keys: ["bicycle", "kick", "scooter", "motorbike"] },
  { title: "Railway", keys: ["track2", "track4", "curve", "loco", "coach", "wagon"] },
  { title: "Water and boats", keys: ["pond", "river", "lake", "sea", "pool6", "pool8", "motorboat", "sailboat", "ship"] },
  { title: "Furniture", keys: ["stool", "chair", "armchair", "sofa", "table2", "table4", "dresser", "wardrobe", "bookshelf", "bed", "floorlamp"] },
  { title: "Bathroom", keys: ["toilet", "bathtub", "shower", "basin", "towels", "mirror"] },
  { title: "Home", keys: ["bulb", "tv", "fridge", "washer", "ac", "acout"] },
  { title: "Kitchen", keys: ["oven", "gasstove", "gascyl", "sink", "pan", "cookpot", "kettle", "utensils"] },
];

/* ---------- placement ---------- */
/* Rotate a piece 90 degrees at a time; the footprint swaps on odd turns and
   the result's origin stays at the min corner of the rotated footprint. */
export function buildPiece(type, color, id, rot = 0, ghostMat = null) {
  const inner = type.build(color);
  inner.position.set(-type.w / 2, 0, -type.d / 2);
  const pivot = new THREE.Group();
  pivot.add(inner);
  pivot.rotation.y = (rot * Math.PI) / 2;
  const [w, d] = rot % 2 ? [type.d, type.w] : [type.w, type.d];
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

/* Which layer would a piece land on, and is something un-stackable in the way? */
export function stackInfo(pieces, x, z, w, d) {
  let lvl = 0;
  for (const p of pieces) if (overlaps(p, x, z, w, d)) lvl = Math.max(lvl, p.y + p.h);
  const blocked = pieces.some((p) => overlaps(p, x, z, w, d) && p.y + p.h === lvl && !p.top);
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
