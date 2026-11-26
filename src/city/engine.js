/* City Builder engine: a 3D tile city on a diorama board, built with three.js. */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createFlights } from "./flights.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export const N = 32;
export const KEY = "hobby-city-v1";
export const PALETTE = ["#e8dcc8", "#f2c9a0", "#d9886b", "#b5c7d3", "#9fb8a0", "#e3e0e8", "#f0e68c", "#c9a7c7", "#8fb3d9", "#d7d7d7"];
export const GLASS = ["#8fb3d9", "#9fc5e8", "#b8c7d9", "#7fa6c9", "#d9e2ec", "#a8d5ba"];
export const GREENS = ["#4f9d4a", "#3f8a43", "#6bb04f", "#2f7a45", "#8bbf4c", "#c98a3a"];

// f = default floors (or size), min/max = slider range, pal = color choices, rot = can be rotated
export const TYPES = {
  road: { label: "Road", icon: "🛣️" },
  house: { label: "House", icon: "🏠", f: 2, min: 1, max: 3, pal: PALETTE, rot: true, unit: "Floors" },
  apartment: { label: "Apartment", icon: "🏢", f: 5, min: 2, max: 10, pal: PALETTE, rot: true, unit: "Floors" },
  shop: { label: "Shop", icon: "🏪", f: 1, min: 1, max: 3, pal: PALETTE, rot: true, unit: "Floors" },
  tower: { label: "Skyscraper", icon: "🏙️", f: 14, min: 6, max: 40, pal: GLASS, rot: false, unit: "Floors" },
  factory: { label: "Factory", icon: "🏭", f: 1, min: 1, max: 3, pal: PALETTE, rot: true, unit: "Size" },
  park: { label: "Park", icon: "⛲" },
  tree: { label: "Tree", icon: "🌳", f: 2, min: 1, max: 3, pal: GREENS, rot: false, unit: "Size" },
  water: { label: "Water", icon: "🌊" },
  office: { label: "Office", icon: "🏬", f: 8, min: 4, max: 20, pal: GLASS, rot: true, unit: "Floors" },
  hotel: { label: "Hotel", icon: "🏨", f: 6, min: 3, max: 12, pal: PALETTE, rot: true, unit: "Floors" },
  mall: { label: "Mall", icon: "🛍️", f: 1, min: 1, max: 2, pal: PALETTE, rot: true, unit: "Floors" },
  gasstation: { label: "Gas station", icon: "⛽", pal: PALETTE, rot: true },
  hospital: { label: "Hospital", icon: "🏥", f: 3, min: 2, max: 5, pal: PALETTE, rot: true, unit: "Floors" },
  school: { label: "School", icon: "🏫", f: 2, min: 1, max: 3, pal: PALETTE, rot: true, unit: "Floors" },
  firestation: { label: "Fire station", icon: "🚒", f: 2, min: 1, max: 2, pal: PALETTE, rot: true, unit: "Floors" },
  church: { label: "Church", icon: "⛪", f: 1, min: 1, max: 2, pal: PALETTE, rot: true, unit: "Size" },
  stadium: { label: "Stadium", icon: "🏟️", f: 1, min: 1, max: 3, pal: PALETTE, rot: false, unit: "Height" },
  warehouse: { label: "Warehouse", icon: "📦", f: 1, min: 1, max: 2, pal: PALETTE, rot: true, unit: "Height" },
  turbine: { label: "Wind turbine", icon: "🌬️" },
  rail: { label: "Railway", icon: "🚆" },
  railstation: { label: "Rail station", icon: "🚉", pal: PALETTE, rot: true },
  metro: { label: "Metro line", icon: "🚇" },
  metrostation: { label: "Metro station", icon: "Ⓜ️", pal: GLASS, rot: true },
  runway: { label: "Runway", icon: "🛬" },
  apron: { label: "Plane stand", icon: "🛩️", pal: ["#e63946", "#2a6fdb", "#2a9d8f", "#f4a261", "#6a4c93", "#222222"], rot: true },
  terminal: { label: "Terminal", icon: "🛄", f: 2, min: 1, max: 3, pal: GLASS, rot: true, unit: "Floors" },
  taxiway: { label: "Taxiway", icon: "➖" },
  atc: { label: "Control tower", icon: "🗼" },
  hangar: { label: "Hangar", icon: "🏗️", pal: PALETTE, rot: true },
  drain: { label: "Drain", icon: "🕳️" },
  treatment: { label: "Treatment plant", icon: "🚰" },
  field: { label: "Wheat field", icon: "🌾" },
  paddy: { label: "Rice paddy", icon: "🍚" },
  vegfarm: { label: "Vegetables", icon: "🥕" },
  orchard: { label: "Orchard", icon: "🍎" },
  pasture: { label: "Cow pasture", icon: "🐄", rot: true },
  barn: { label: "Barn", icon: "🛖", pal: ["#b83b2e", "#8c5a3c", "#e8dcc8", "#4f6d8f", "#5f7f4f"], rot: true },
  silo: { label: "Silo", icon: "🛢️" },
  greenhouse: { label: "Greenhouse", icon: "🪴", rot: true },
  custom: { label: "My model", icon: "🧱", rot: true }, // imported from Hobby Builder
};
export const SEASONS = [["spring", "🌸 Spring"], ["summer", "☀️ Summer"], ["autumn", "🍂 Autumn"], ["winter", "❄️ Winter"]];
export const GROUPS = [
  ["Land", ["road", "park", "tree", "water"]],
  ["Homes", ["house", "apartment", "hotel"]],
  ["Shops and offices", ["shop", "mall", "office", "tower", "gasstation"]],
  ["Public", ["hospital", "school", "firestation", "church", "stadium"]],
  ["Industry", ["factory", "warehouse", "turbine"]],
  ["Railway and metro", ["rail", "railstation", "metro", "metrostation"]],
  ["Airport", ["runway", "taxiway", "apron", "terminal", "atc", "hangar"]],
  ["Farms", ["field", "paddy", "vegfarm", "orchard", "pasture", "barn", "silo", "greenhouse"]],
  ["Drainage", ["drain", "treatment", "water"]],
];
const DEFAULT_COLOR = { house: "#f2c9a0", apartment: "#e8dcc8", shop: "#b5c7d3", tower: "#8fb3d9", factory: "#d7d7d7", tree: "#4f9d4a", office: "#8fb3d9", hotel: "#f2c9a0", mall: "#e3e0e8", gasstation: "#e3e0e8", hospital: "#f4f6f8", school: "#f0c987", firestation: "#d9886b", church: "#e8dcc8", stadium: "#b5c7d3", warehouse: "#b5c7d3", railstation: "#e3e0e8", metrostation: "#8fb3d9", apron: "#e63946", terminal: "#8fb3d9", hangar: "#b5c7d3", barn: "#b83b2e" };

export function defaultCell(t) {
  const d = TYPES[t];
  const c = { t, r: 0 };
  if (d.f) c.f = d.f;
  if (d.pal) c.c = DEFAULT_COLOR[t];
  return c;
}

/* ---------- the starting city ---------- */
export function baseCity() {
  let s = 20240611;
  const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const grid = Array.from({ length: N }, () => Array(N).fill(null));
  const put = (x, z, t, o = {}) => { grid[z][x] = { ...defaultCell(t), ...o }; };
  const R = [2, 8, 14, 20];
  const warm = ["#f2c9a0", "#e8dcc8", "#d9886b", "#f0e68c", "#c9a7c7"];
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    if ((R.includes(x) && z >= 2 && z <= 20) || (R.includes(z) && x >= 2 && x <= 20)) put(x, z, "road");
    else if ((x < 2 || x > 20 || z < 2 || z > 20) && rnd() < (x > 23 ? 0.12 : 0.3)) put(x, z, "tree", { f: 1 + Math.floor(rnd() * 3), c: pick(GREENS.slice(0, 5)) });
  }
  for (let bz = 0; bz < 3; bz++) for (let bx = 0; bx < 3; bx++) {
    const x0 = 3 + bx * 6, z0 = 3 + bz * 6;
    for (let dz = 0; dz < 5; dz++) for (let dx = 0; dx < 5; dx++) {
      const x = x0 + dx, z = z0 + dz;
      const m = Math.min(dx, 4 - dx, dz, 4 - dz);
      const r = m === dx ? 3 : m === 4 - dx ? 1 : m === dz ? 2 : 0;
      const dist = Math.abs(dx - 2) + Math.abs(dz - 2);
      const q = rnd();
      const mid = dx === 2 && dz === 2;
      if (mid && bx === 1 && bz === 0) put(x, z, "hospital", { f: 4, r });
      else if (mid && bx === 0 && bz === 1) put(x, z, "school", { r });
      else if (mid && bx === 2 && bz === 1) put(x, z, "firestation", { r });
      else if (mid && bx === 1 && bz === 2) put(x, z, "mall", { r });
      else if (mid && bx === 0 && bz === 0) put(x, z, "church", { r });
      else if (bx === 2 && bz === 0 && dx > 0 && dx < 4 && dz > 0 && dz < 4 && dx === 2 && dz === 3) put(x, z, "stadium", { f: 2 });
      else if (bx === 1 && bz === 1) put(x, z, "tower", { f: 8 + (4 - dist) * 3 + Math.floor(rnd() * 3), c: pick(GLASS) });
      else if (bx === 0 && bz === 0) { if (q < 0.8) put(x, z, "house", { f: 1 + Math.floor(rnd() * 2), c: pick(warm), r }); else put(x, z, "tree", { f: 2, c: pick(GREENS.slice(0, 5)) }); }
      else if (bx === 2 && bz === 0) put(x, z, "park");
      else if (bx === 0 && bz === 2) { if (q < 0.55) put(x, z, "factory", { f: 1 + Math.floor(rnd() * 2), c: pick(PALETTE), r }); else if (q < 0.8) put(x, z, "warehouse", { f: 1, c: pick(PALETTE), r }); }
      else if (bx === 2 && bz === 2) { if (Math.hypot(dx - 2, dz - 2) <= 1.9) put(x, z, "water"); else if (q < 0.5) put(x, z, "tree", { f: 1 + Math.floor(rnd() * 3), c: pick(GREENS.slice(0, 5)) }); }
      else if (q < 0.4) put(x, z, "apartment", { f: 3 + Math.floor(rnd() * 5), c: pick(PALETTE), r });
      else if (q < 0.48) put(x, z, "hotel", { f: 5 + Math.floor(rnd() * 4), c: pick(PALETTE), r });
      else if (q < 0.58) put(x, z, "office", { f: 6 + Math.floor(rnd() * 6), c: pick(GLASS), r });
      else if (q < 0.62 && dx % 4 === 0) put(x, z, "gasstation", { c: pick(PALETTE), r });
      else if (q < 0.9) put(x, z, "shop", { f: 1 + Math.floor(rnd() * 2), c: pick(PALETTE), r });
      else put(x, z, "tree", { f: 2, c: pick(GREENS.slice(0, 5)) });
    }
  }
  [[23, 3], [23, 5], [23, 17], [23, 19], [23, 11]].forEach(([x, z]) => put(x, z, "turbine"));
  // railway (ground level) around the west, north and south edges
  for (let i = 0; i <= 22; i++) { put(i, 0, "rail"); put(i, 22, "rail"); put(0, i, "rail"); }
  put(11, 22, "railstation", { r: 1, c: "#e3e0e8" });
  put(0, 11, "railstation", { r: 0, c: "#f0c987" });
  // metro (raised) just inside it
  for (let i = 1; i <= 21; i++) { put(i, 1, "metro"); put(i, 21, "metro"); put(1, i, "metro"); }
  put(11, 1, "metrostation", { r: 1 });
  put(1, 11, "metrostation", { r: 0 });
  put(11, 21, "metrostation", { r: 1 });
  // roads out to the airport
  [8, 14].forEach((z) => { for (let x = 21; x <= 25; x++) put(x, z, "road"); });
  // airport (clear the land first)
  for (let z = 0; z < N; z++) for (let x = 24; x < N; x++) if (!(grid[z][x] && grid[z][x].t === "road")) grid[z][x] = null;
  for (let z = 2; z <= 29; z++) put(30, z, "runway");
  [5, 7, 9, 11, 18, 20, 22].forEach((z) => { put(28, z, "taxiway"); put(29, z, "taxiway"); });
  for (let z = 5; z <= 12; z++) put(26, z, "terminal", { r: 1, f: 2 });
  [5, 7, 9, 11].forEach((z, i) => put(27, z, "apron", { r: 1, c: ["#e63946", "#2a6fdb", "#2a9d8f", "#f4a261"][i] }));
  put(26, 15, "atc");
  [18, 20, 22].forEach((z) => put(26, z, "hangar", { r: 1, c: "#b5c7d3" }));
  [[27, 18], [27, 20], [27, 22]].forEach(([x, z]) => put(x, z, "apron", { r: 1, c: "#2a6fdb" }));
  // farms and drainage along the south
  for (let z = 23; z < N; z++) for (let x = 0; x < 24; x++) grid[z][x] = rnd() < 0.08 ? { ...defaultCell("tree"), f: 1 + Math.floor(rnd() * 3), c: pick(GREENS.slice(0, 5)) } : null;
  const area = (t, x0, x1, z0, z1) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) put(x, z, t); };
  area("field", 1, 6, 24, 27);
  area("vegfarm", 1, 6, 28, 30);
  area("paddy", 8, 13, 24, 29);
  area("orchard", 15, 18, 24, 26);
  area("pasture", 15, 19, 28, 30);
  put(20, 25, "barn", { r: 2 });
  put(21, 25, "silo");
  put(22, 25, "silo");
  put(20, 28, "greenhouse", { r: 1 });
  put(21, 28, "greenhouse", { r: 1 });
  area("drain", 1, 21, 23, 23);
  area("drain", 7, 7, 24, 30);
  area("drain", 14, 14, 24, 30);
  put(22, 23, "treatment");
  return grid;
}

/* ---------- building meshes ---------- */
const lit = new Set(); // materials with lit windows
let night = 0;
const glow = new Map(); // lamp materials -> { mode, ph }: runway lights and danger (obstruction) lights
function lamp(g, color, r, x, y, z, mode = "steady") {
  const m = new THREE.MeshStandardMaterial({ color: "#222222", emissive: color, emissiveIntensity: 0.3, roughness: 0.4 });
  glow.set(m, { mode, ph: Math.random() * 6.28 });
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), m);
  o.position.set(x, y, z);
  g.add(o);
}
function updateGlow(t) {
  glow.forEach((e, m) => {
    if (e.mode === "blink") m.emissiveIntensity = Math.sin(t * 3.5 + e.ph) > 0.35 ? 0.9 + night * 3 : 0.05;
    else if (e.mode === "white") m.emissiveIntensity = 0.1 + night * 2.2;
    else m.emissiveIntensity = 0.25 + night * 2.2;
  });
}
const wx = (x) => x - N / 2 + 0.5;
let season = "summer";
let ASSETS = null; // detailed Blender models; simple shapes are used until they load
const surf = (name) => (ASSETS?.ready ? { map: ASSETS.texture(name) } : {});
const ripples = () => (ASSETS?.ready ? { normalMap: ASSETS.texture("water"), normalScale: new THREE.Vector2(0.35, 0.35) } : {});
const SNOW = { value: 0 }; // 1 in winter: surfaces facing up turn white
function mat(color, o = {}) {
  const { snow = 1, ...rest } = o;
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...rest });
  return addSnow(m, snow);
}
function addSnow(m, snow) {
  if (snow) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uSnow = SNOW;
      sh.uniforms.uSnowK = { value: snow };
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying float vUp;")
        .replace("#include <defaultnormal_vertex>", "#include <defaultnormal_vertex>\nvUp = normalize(mat3(modelMatrix) * objectNormal).y;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vUp;\nuniform float uSnow;\nuniform float uSnowK;")
        .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.93, 0.98), uSnow * uSnowK * smoothstep(0.3, 0.7, vUp));");
    };
  }
  return m;
}
function foliage(color) {
  const i = Math.max(0, GREENS.indexOf(color));
  if (season === "autumn") return ["#d9822b", "#b8452a", "#e0b034", "#8a6a2a", "#cc5f2d", "#c98a3a"][i];
  if (season === "winter") return "#3d6152";
  if (season === "spring") return "#" + new THREE.Color(color).lerp(new THREE.Color("#b8e07a"), 0.4).getHexString();
  return color;
}
function mesh(geo, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}
const box = (w, h, d, color, x, y, z, o) => mesh(new THREE.BoxGeometry(w, h, d), mat(color, o), x, y, z);
const cyl = (r, h, color, x, y, z) => mesh(new THREE.CylinderGeometry(r, r, h, 10), mat(color), x, y, z);

let canvases = null;
const texCache = new Map();
function texFor(cols, rows) {
  if (!canvases) {
    const mk = (lit_) => {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d");
      g.fillStyle = lit_ ? "#000" : "#fff";
      g.fillRect(0, 0, 128, 128);
      let seed = 7;
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        seed = (seed * 16807) % 2147483647;
        const on = seed % 10 < 6;
        g.fillStyle = lit_ ? (on ? "#ffd27a" : "#000") : on ? "#3a4a5e" : "#2c3a4d";
        g.fillRect(i * 32 + 6, j * 32 + 6, 20, 20);
      }
      return c;
    };
    canvases = { map: mk(false), em: mk(true) };
  }
  const key = cols + "x" + rows;
  if (!texCache.has(key)) {
    const make = (c) => {
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(cols / 4, rows / 4);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    };
    texCache.set(key, { map: make(canvases.map), em: make(canvases.em) });
  }
  return texCache.get(key);
}

function wall(w, h, d, rows, color, y0 = 0, o = {}) {
  const side = (cols) => {
    const t = texFor(cols, rows);
    const m = mat(color, { map: t.map, emissive: 0xffffff, emissiveMap: t.em, emissiveIntensity: night, ...o });
    lit.add(m);
    return m;
  };
  const mx = side(Math.max(1, Math.round(d / 0.2)));
  const mz = side(Math.max(1, Math.round(w / 0.2)));
  const roof = mat(new THREE.Color(color).multiplyScalar(0.7));
  return mesh(new THREE.BoxGeometry(w, h, d), [mx, mx, roof, roof, mz, mz], 0, y0 + h / 2, 0);
}

function treeMesh(s, base) {
  const g = new THREE.Group();
  const color = foliage(base);
  if (season === "spring" && (base === GREENS[2] || base === GREENS[4])) {
    [[0.14, 0.38, 0.08], [-0.12, 0.45, -0.08], [0.02, 0.62, 0.12], [-0.05, 0.34, 0.16]].forEach(([x, y, z]) => g.add(mesh(new THREE.SphereGeometry(0.05 * s, 6, 5), mat("#f7a8c4"), x * s, y * s, z * s)));
  }
  g.add(cyl(0.04 * s, 0.22 * s, "#7a5230", 0, 0.11 * s, 0));
  g.add(mesh(new THREE.ConeGeometry(0.22 * s, 0.36 * s, 8), mat(color), 0, 0.4 * s, 0));
  g.add(mesh(new THREE.ConeGeometry(0.16 * s, 0.3 * s, 8), mat(color), 0, 0.6 * s, 0));
  return g;
}

function planeMesh(tail, s = 1) {
  const g = new THREE.Group();
  if (ASSETS?.ready) {
    const model = ASSETS.model("airliner", { tail });
    model.position.y = 0.035;
    g.add(model);
    g.scale.setScalar(s);
    return g;
  }
  const white = mat("#f4f6f8", { roughness: 0.4, snow: 0 });
  const add = (m) => { g.add(m); return m; };
  add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 10).rotateX(Math.PI / 2), white));
  add(mesh(new THREE.ConeGeometry(0.05, 0.14, 10).rotateX(Math.PI / 2), white, 0, 0, 0.32));
  add(mesh(new THREE.ConeGeometry(0.05, 0.16, 10).rotateX(-Math.PI / 2), white, 0, 0.01, -0.33));
  [-1, 1].forEach((k) => {
    const w = mesh(new THREE.BoxGeometry(0.42, 0.012, 0.13), white, k * 0.24, -0.01, -0.02);
    w.rotation.y = -k * 0.35;
    add(w);
    add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 8).rotateX(Math.PI / 2), mat("#888"), k * 0.2, -0.045, 0.03));
    add(mesh(new THREE.BoxGeometry(0.13, 0.01, 0.06), white, k * 0.07, 0.01, -0.35));
  });
  add(mesh(new THREE.BoxGeometry(0.014, 0.13, 0.11), mat(tail), 0, 0.08, -0.31));
  g.scale.setScalar(s);
  return g;
}

function railArms(g, nb) {
  const { n, e, s, w } = nb;
  g.add(box(0.5, 0.03, 0.5, "#a49a8e", 0, 0.015, 0, surf("gravel")));
  const arm = (dx, dz) => {
    const along = dz !== 0;
    g.add(box(along ? 0.5 : 0.5, 0.03, along ? 0.5 : 0.5, "#a49a8e", dx * 0.25, 0.015, dz * 0.25, surf("gravel")));
  };
  if (n) arm(0, -1); if (s) arm(0, 1); if (e) arm(1, 0); if (w) arm(-1, 0);
  const sleepers = (vert) => { for (let i = -3; i <= 3; i++) g.add(box(vert ? 0.34 : 0.05, 0.02, vert ? 0.05 : 0.34, "#5b4636", vert ? 0 : i * 0.14, 0.035, vert ? i * 0.14 : 0)); };
  const rails = (vert) => [-0.11, 0.11].forEach((o) => g.add(box(vert ? 0.03 : 1, 0.035, vert ? 1 : 0.03, "#b8bcc4", vert ? o : 0, 0.055, vert ? 0 : o)));
  return { sleepers, rails };
}

function buildTile(cell, nb) {
  const g = new THREE.Group();
  const { t, f = 1, c = "#ffffff" } = cell;
  if (detailedTile(g, cell)) return g;
  if (t === "road") {
    g.add(box(1, 0.04, 1, "#44474f", 0, 0.02, 0, { snow: 0.3, ...surf("asphalt") }));
    let { n, e, s, w } = nb;
    const side = "#c9c6bd";
    const kerb = surf("concrete");
    if (!n) g.add(box(1, 0.06, 0.1, side, 0, 0.03, -0.45, kerb));
    if (!s) g.add(box(1, 0.06, 0.1, side, 0, 0.03, 0.45, kerb));
    if (!e) g.add(box(0.1, 0.06, 1, side, 0.45, 0.03, 0, kerb));
    if (!w) g.add(box(0.1, 0.06, 1, side, -0.45, 0.03, 0, kerb));
    if (!n && !e && !s && !w) { e = true; w = true; }
    const dash = (x, z, vertical) => g.add(box(vertical ? 0.04 : 0.16, 0.01, vertical ? 0.16 : 0.04, "#f4f1e6", x, 0.045, z));
    if (n) dash(0, -0.3, true);
    if (s) dash(0, 0.3, true);
    if (e) dash(0.3, 0, false);
    if (w) dash(-0.3, 0, false);
    if (n && s && !e && !w) dash(0, 0, true);
    if (e && w && !n && !s) dash(0, 0, false);
  } else if (t === "water") {
    g.add(box(1, 0.05, 1, season === "winter" ? "#bfdcea" : "#3f93c9", 0, 0.025, 0, { roughness: 0.06, metalness: 0.35, snow: 0.2, ...ripples() }));
  } else if (t === "park") {
    g.add(box(0.98, 0.02, 0.98, "#7ccb6a", 0, 0.01, 0));
    g.add(box(0.84, 0.012, 0.12, "#eadfbf", 0, 0.022, 0));
    g.add(box(0.12, 0.012, 0.84, "#eadfbf", 0, 0.022, 0));
    g.add(cyl(0.14, 0.03, "#cfcfcf", 0, 0.035, 0));
    g.add(cyl(0.1, 0.04, "#5fb4e8", 0, 0.04, 0));
    [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]].forEach(([x, z], i) => {
      const tr = treeMesh(0.7, GREENS[i % 4]);
      tr.position.set(x, 0, z);
      g.add(tr);
    });
  } else if (t === "tree") {
    g.add(treeMesh(0.8 + 0.3 * (f - 1), c));
  } else if (t === "house") {
    const h = f * 0.32;
    g.add(wall(0.6, h, 0.6, f, c));
    const roof = mesh(new THREE.ConeGeometry(0.46, 0.3, 4), mat("#a5543f"), 0, h + 0.15, 0);
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    g.add(box(0.12, 0.2, 0.03, "#6b4a35", 0, 0.1, 0.3));
  } else if (t === "apartment") {
    const h = f * 0.28;
    g.add(wall(0.8, h, 0.8, f, c));
    g.add(box(0.86, 0.04, 0.86, "#9a9a9a", 0, h + 0.02, 0));
    g.add(box(0.22, 0.1, 0.22, "#777", 0.2, h + 0.09, -0.2));
    if (f >= 8) lamp(g, "#ff2a2a", 0.03, 0.2, h + 0.17, -0.2, "blink");
  } else if (t === "shop") {
    const h = f * 0.3;
    g.add(wall(0.9, h, 0.7, f, c));
    g.add(box(0.92, 0.04, 0.22, "#d64545", 0, 0.24, 0.4));
    g.add(box(0.6, 0.1, 0.02, "#fff6d5", 0, h + 0.05, 0.36, { emissive: "#ffe9a0", emissiveIntensity: 0.3 }));
  } else if (t === "tower") {
    const h = f * 0.3;
    const o = { metalness: 0.3, roughness: 0.4 };
    g.add(wall(0.7, h, 0.7, f, c, 0, o));
    if (f >= 10) {
      g.add(wall(0.5, 0.9, 0.5, 3, c, h, o));
      g.add(cyl(0.015, 0.5, "#bbb", 0, h + 1.15, 0));
      lamp(g, "#ff2a2a", 0.045, 0, h + 1.42, 0, "blink");
      if (f >= 16) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => lamp(g, "#ff2a2a", 0.03, a * 0.33, h + 0.03, b * 0.33, "steady"));
    } else { g.add(box(0.3, 0.1, 0.3, "#888", 0, h + 0.05, 0)); lamp(g, "#ff2a2a", 0.035, 0, h + 0.13, 0, "blink"); }
  } else if (t === "factory") {
    const h = f * 0.3 + 0.1;
    g.add(wall(0.9, h, 0.8, f + 1, c));
    g.add(box(0.92, 0.05, 0.82, "#555", 0, h + 0.025, 0));
    g.add(cyl(0.06, 0.55, "#8a8f98", -0.28, h + 0.27, -0.2));
    g.add(cyl(0.06, 0.55, "#8a8f98", -0.1, h + 0.27, -0.2));
    lamp(g, "#ff2a2a", 0.03, -0.28, h + 0.57, -0.2, "steady");
    lamp(g, "#ff2a2a", 0.03, -0.1, h + 0.57, -0.2, "steady");
  } else if (t === "rail" || t === "railstation") {
    let { n, e, s, w } = nb;
    const st = t === "railstation";
    if (st) { n = s = true; e = w = false; }
    else if (!n && !e && !s && !w) { e = w = true; }
    const rA = railArms(g, { n, e, s, w });
    if (n && s && !e && !w) { rA.sleepers(true); rA.rails(true); }
    else if (e && w && !n && !s) { rA.sleepers(false); rA.rails(false); }
    else {
      // junction or corner: draw each arm's rails
      const half = (dx, dz) => {
        const along = dz !== 0;
        [-0.11, 0.11].forEach((o) => g.add(box(along ? 0.03 : 0.5, 0.035, along ? 0.5 : 0.03, "#b8bcc4", along ? o : dx * 0.25, 0.055, along ? dz * 0.25 : o)));
        for (let i = 1; i <= 3; i++) g.add(box(along ? 0.34 : 0.05, 0.02, along ? 0.05 : 0.34, "#5b4636", along ? 0 : dx * i * 0.14, 0.035, along ? dz * i * 0.14 : 0));
      };
      if (n) half(0, -1); if (s) half(0, 1); if (e) half(1, 0); if (w) half(-1, 0);
    }
    if (st && ASSETS?.ready) g.add(ASSETS.tile(cell, season, foliage));
    else if (st) {
      g.add(box(0.24, 0.07, 0.96, "#d8d4c8", -0.36, 0.035, 0));
      g.add(box(0.24, 0.07, 0.96, "#d8d4c8", 0.36, 0.035, 0));
      g.add(wall(0.2, 0.26, 0.7, 1, c, 0.07).translateX(0.36));
      g.add(box(0.3, 0.03, 0.8, "#566079", 0.34, 0.4, 0));
      [-0.3, 0.3].forEach((z) => g.add(cyl(0.012, 0.3, "#999", -0.36, 0.22, z)));
      g.add(box(0.3, 0.03, 0.6, "#566079", -0.34, 0.38, 0));
    }
  } else if (t === "metro" || t === "metrostation") {
    const st = t === "metrostation";
    let { n, e, s, w } = nb;
    if (st) { n = s = true; e = w = false; }
    else if (!n && !e && !s && !w) { e = w = true; }
    g.add(cyl(0.08, 0.42, "#9aa0a8", 0, 0.21, 0));
    g.add(box(0.4, 0.06, 0.4, "#6d7480", 0, 0.45, 0));
    const half = (dx, dz) => {
      const along = dz !== 0;
      g.add(box(along ? 0.4 : 0.3, 0.06, along ? 0.3 : 0.4, "#6d7480", dx * 0.35, 0.45, dz * 0.35));
      [-0.08, 0.08].forEach((o) => g.add(box(along ? 0.025 : 0.5, 0.03, along ? 0.5 : 0.025, "#c0c4cc", along ? o : dx * 0.25, 0.495, along ? dz * 0.25 : o)));
      [-0.19, 0.19].forEach((o) => g.add(box(along ? 0.03 : 0.5, 0.07, along ? 0.5 : 0.03, "#8d95a3", along ? o : dx * 0.25, 0.51, along ? dz * 0.25 : o)));
    };
    if (n) half(0, -1); if (s) half(0, 1); if (e) half(1, 0); if (w) half(-1, 0);
    if (st) {
      g.add(box(0.8, 0.06, 0.96, "#6d7480", 0, 0.45, 0));
      g.add(box(0.3, 0.02, 0.96, "#d8d4c8", -0.26, 0.49, 0));
      g.add(box(0.3, 0.02, 0.96, "#d8d4c8", 0.26, 0.49, 0));
      g.add(box(0.03, 0.03, 0.96, "#c0c4cc", -0.06, 0.5, 0));
      g.add(box(0.03, 0.03, 0.96, "#c0c4cc", 0.06, 0.5, 0));
      if (ASSETS?.ready) g.add(ASSETS.tile(cell, season, foliage));
      else {
      g.add(box(0.9, 0.04, 0.7, c, 0, 0.82, 0));
      [[-0.38, -0.3], [0.38, -0.3], [-0.38, 0.3], [0.38, 0.3]].forEach(([x, z]) => g.add(cyl(0.015, 0.32, "#999", x, 0.66, z)));
      g.add(box(0.5, 0.07, 0.03, "#2a6fdb", 0, 0.9, 0.36, { emissive: "#2a6fdb", emissiveIntensity: 0.5 }));
      g.add(cyl(0.08, 0.42, "#9aa0a8", 0, 0.21, 0.32));
      g.children[g.children.length - 1].position.z = -0.32;
      }
    }
  } else if (t === "runway") {
    const { n, e, s, w } = nb;
    const rn = nb.rw;
    const none = !rn.n && !rn.e && !rn.s && !rn.w;
    const vert = (rn.n || rn.s) && !(rn.e || rn.w);
    g.add(box(1, 0.03, 1, "#363940", 0, 0.015, 0, { snow: 0.15, ...surf("asphalt") }));
    const mark = (a, off, wd, len) => g.add(box(vert ? wd : len, 0.006, vert ? len : wd, "#f4f1e6", vert ? off : a, 0.033, vert ? a : off));
    [-0.32, 0, 0.32].forEach((a) => mark(a, 0, 0.035, 0.18));
    [-0.46, 0.46].forEach((o) => mark(0, o, 0.02, 1));
    const endNeg = none || (vert ? !rn.n : !rn.w), endPos = none || (vert ? !rn.s : !rn.e);
    const bars = (sgn) => [-2, -1, 0, 1, 2].forEach((i) => g.add(box(vert ? 0.05 : 0.14, 0.006, vert ? 0.14 : 0.05, "#f4f1e6", vert ? i * 0.15 : sgn * 0.38, 0.033, vert ? sgn * 0.38 : i * 0.15)));
    if (endNeg) bars(-1);
    if (endPos) bars(1);
    // edge lights, green at the start end, red at the far end
    const L = (a, off, color, mode = "steady") => lamp(g, color, 0.022, vert ? off : a, 0.04, vert ? a : off, mode);
    [-0.47, 0.47].forEach((o) => { L(-0.25, o, "#fff6dc", "white"); L(0.25, o, "#fff6dc", "white"); });
    if (endNeg) [-0.35, -0.12, 0.12, 0.35].forEach((o) => L(-0.49, o, "#2bff6a"));
    if (endPos) [-0.35, -0.12, 0.12, 0.35].forEach((o) => L(0.49, o, "#ff3030"));
    // yellow stubs where a taxiway joins
    if (n && !rn.n) g.add(box(0.03, 0.007, 0.5, "#f2c94c", 0, 0.034, -0.25));
    if (s && !rn.s) g.add(box(0.03, 0.007, 0.5, "#f2c94c", 0, 0.034, 0.25));
    if (e && !rn.e) g.add(box(0.5, 0.007, 0.03, "#f2c94c", 0.25, 0.034, 0));
    if (w && !rn.w) g.add(box(0.5, 0.007, 0.03, "#f2c94c", -0.25, 0.034, 0));
  } else if (t === "taxiway") {
    let { n, e, s, w } = nb;
    g.add(box(1, 0.028, 1, "#565a63", 0, 0.014, 0, { snow: 0.25, ...surf("asphalt") }));
    if (!n && !e && !s && !w) { e = w = true; }
    if (n) g.add(box(0.03, 0.007, 0.5, "#f2c94c", 0, 0.032, -0.25));
    if (s) g.add(box(0.03, 0.007, 0.5, "#f2c94c", 0, 0.032, 0.25));
    if (e) g.add(box(0.5, 0.007, 0.03, "#f2c94c", 0.25, 0.032, 0));
    if (w) g.add(box(0.5, 0.007, 0.03, "#f2c94c", -0.25, 0.032, 0));
    // blue edge lights on straight taxiways
    if (n && s && !e && !w) [-0.47, 0.47].forEach((o) => lamp(g, "#3a7bff", 0.02, o, 0.036, 0));
    if (e && w && !n && !s) [-0.47, 0.47].forEach((o) => lamp(g, "#3a7bff", 0.02, 0, 0.036, o));
  } else if (t === "apron") {
    g.add(box(0.98, 0.025, 0.98, "#aeb3b8", 0, 0.0125, 0, surf("concrete")));
    g.add(box(0.03, 0.006, 0.8, "#f2c94c", 0, 0.028, 0));
    const p = planeMesh(c, 1.1);
    p.position.y = 0.1;
    g.add(p);
    g.userData.parked = p;
  } else if (t === "terminal") {
    const h = f * 0.28;
    const b = wall(0.96, h, 0.5, f, c, 0, { metalness: 0.25, roughness: 0.4 });
    b.position.z = -0.2;
    g.add(b);
    g.add(box(0.98, 0.04, 0.52, "#667", 0, h + 0.02, -0.2));
    [-0.28, 0.28].forEach((x) => { g.add(box(0.14, 0.08, 0.3, "#9aa5b1", x, 0.18, 0.2)); g.add(box(0.16, 0.02, 0.3, "#667", x, 0.23, 0.2)); });
  } else if (t === "atc") {
    g.add(box(0.34, 0.22, 0.34, "#cfd3d8", 0, 0.11, 0));
    g.add(cyl(0.065, 0.7, "#e8eaed", 0, 0.57, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.16, 12), mat("#7fb6d6", { metalness: 0.4, roughness: 0.15 }), 0, 1.0, 0));
    g.add(mesh(new THREE.ConeGeometry(0.18, 0.1, 12), mat("#aab"), 0, 1.13, 0));
    g.add(cyl(0.01, 0.22, "#bbb", 0, 1.3, 0));
    lamp(g, "#ff2a2a", 0.035, 0, 1.43, 0, "blink");
    lamp(g, "#ffffff", 0.03, 0, 1.2, 0, "white");
  } else if (t === "hangar") {
    const hg = new THREE.CylinderGeometry(0.46, 0.46, 0.92, 20).rotateX(Math.PI / 2);
    const m = mesh(hg, mat(c, { metalness: 0.2 }), 0, 0, 0);
    m.scale.y = 0.62;
    g.add(m);
    g.add(box(0.6, 0.2, 0.02, "#4a5560", 0, 0.1, 0.462));
  } else if (t === "drain") {
    const { n, e, s, w, flow, down } = nb;
    const water = !flow ? "#6b5a45" : season === "winter" ? "#bfdcea" : "#3f9bd6";
    const wallC = "#a9a59a";
    const arms = { n: n || (!n && !e && !s && !w), s: s || (!n && !e && !s && !w), e, w };
    g.add(box(0.32, 0.03, 0.32, water, 0, 0.015, 0, { snow: 0.2 }));
    [["n", 0, -1], ["s", 0, 1], ["e", 1, 0], ["w", -1, 0]].forEach(([k, dx, dz]) => {
      const along = dz !== 0;
      if (arms[k]) {
        g.add(box(along ? 0.32 : 0.34, 0.03, along ? 0.34 : 0.32, water, dx * 0.33, 0.015, dz * 0.33, { snow: 0.2 }));
        [-0.19, 0.19].forEach((o) => g.add(box(along ? 0.07 : 0.34, 0.07, along ? 0.34 : 0.07, wallC, along ? o : dx * 0.33, 0.035, along ? dz * 0.33 : o)));
      } else g.add(box(along ? 0.45 : 0.07, 0.07, along ? 0.07 : 0.45, wallC, dx * 0.19, 0.035, dz * 0.19));
    });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => g.add(box(0.07, 0.072, 0.07, wallC, a * 0.19, 0.036, b * 0.19)));
    if (flow && down && season !== "winter") {
      const r = box(down[0] ? 0.1 : 0.18, 0.006, down[0] ? 0.18 : 0.1, "#bfe6ff", 0, 0.034, 0, { snow: 0 });
      g.add(r);
      g.userData.ripple = { m: r, dx: down[0], dz: down[1] };
    }
  } else if (t === "treatment") {
    g.add(box(0.98, 0.04, 0.98, "#b9b6ad", 0, 0.02, 0));
    [[-0.22, 0.2], [0.24, 0.2]].forEach(([x, z]) => { g.add(cyl(0.22, 0.14, "#8f949c", x, 0.11, z)); g.add(cyl(0.18, 0.015, season === "winter" ? "#bfdcea" : "#4f9fb0", x, 0.186, z)); });
    g.add(box(0.5, 0.22, 0.28, "#e3e0e8", -0.1, 0.15, -0.28));
    g.add(box(0.52, 0.04, 0.3, "#566079", -0.1, 0.28, -0.28));
    g.add(cyl(0.05, 0.4, "#8a8f98", 0.32, 0.24, -0.28));
  } else if (t === "field") {
    g.add(box(0.96, 0.03, 0.96, "#8a6a43", 0, 0.015, 0));
    const [col, h] = { spring: ["#8fd05a", 0.05], summer: ["#a8c23f", 0.12], autumn: ["#e6b93c", 0.15], winter: ["#b59a68", 0.025] }[season];
    [-0.36, -0.18, 0, 0.18, 0.36].forEach((x) => g.add(box(0.09, h, 0.9, col, x, 0.03 + h / 2, 0)));
  } else if (t === "paddy") {
    g.add(box(0.96, 0.025, 0.96, season === "winter" ? "#c4dde8" : season === "autumn" ? "#8f7a45" : "#6fa79a", 0, 0.012, 0, { roughness: 0.2 }));
    [[0, -0.47, 0.96, 0.05], [0, 0.47, 0.96, 0.05], [-0.47, 0, 0.05, 0.96], [0.47, 0, 0.05, 0.96]].forEach(([x, z, w, d]) => g.add(box(w, 0.06, d, "#7d6440", x, 0.03, z)));
    if (season !== "winter") {
      const col = { spring: "#a6e06a", summer: "#4fae3a", autumn: "#e0c04a" }[season];
      const h = season === "spring" ? 0.07 : 0.14;
      [-0.28, 0, 0.28].forEach((x) => [-0.28, 0, 0.28].forEach((z) => g.add(mesh(new THREE.ConeGeometry(0.06, h, 5), mat(col), x, 0.025 + h / 2, z))));
    }
  } else if (t === "vegfarm") {
    g.add(box(0.96, 0.03, 0.96, "#7a5a38", 0, 0.015, 0));
    const crops = { spring: ["#7cc24c", "#7cc24c", "#7cc24c"], summer: ["#d8412f", "#4f9d4a", "#8a3fa0"], autumn: ["#e8862a", "#4f9d4a", "#e8862a"], winter: [] }[season];
    [-0.28, 0, 0.28].forEach((x, i) => {
      g.add(box(0.14, 0.02, 0.88, "#5f4429", x, 0.035, 0));
      if (crops.length) [-0.3, -0.1, 0.1, 0.3].forEach((z) => g.add(mesh(new THREE.SphereGeometry(season === "spring" ? 0.03 : 0.055, 7, 5), mat(crops[i]), x, 0.075, z)));
    });
  } else if (t === "orchard") {
    g.add(box(0.96, 0.02, 0.96, "#7fb35a", 0, 0.01, 0));
    [[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.24, 0.24]].forEach(([x, z]) => {
      g.add(cyl(0.025, 0.2, "#7a5230", x, 0.1, z));
      if (season === "winter") { [-0.6, 0.6].forEach((a) => { const b = cyl(0.012, 0.18, "#7a5230", x + a * 0.07, 0.24, z); b.rotation.z = -a; g.add(b); }); return; }
      g.add(mesh(new THREE.SphereGeometry(0.15, 9, 7), mat(season === "spring" ? "#f4b8d0" : season === "autumn" ? "#c98a2f" : "#4f9d4a"), x, 0.31, z));
      if (season !== "spring") [[0.13, 0.3, 0.03], [-0.05, 0.37, 0.12], [-0.1, 0.27, -0.1], [0.04, 0.45, -0.03]].forEach(([a, y, b]) => g.add(mesh(new THREE.SphereGeometry(0.032, 6, 5), mat("#d62f2f", { snow: 0 }), x + a, y, z + b)));
    });
  } else if (t === "pasture") {
    g.add(box(0.96, 0.02, 0.96, season === "autumn" ? "#a9a456" : "#79b955", 0, 0.01, 0));
    [-0.46, 0.46].forEach((o) => { g.add(box(0.92, 0.015, 0.015, "#c9a876", 0, 0.12, o)); g.add(box(0.015, 0.015, 0.92, "#c9a876", o, 0.12, 0)); [-0.46, 0, 0.46].forEach((q) => { g.add(box(0.03, 0.15, 0.03, "#8c6a43", q, 0.075, o)); g.add(box(0.03, 0.15, 0.03, "#8c6a43", o, 0.075, q)); }); });
    [[-0.17, -0.12, 0.4], [0.2, 0.18, -2.2]].forEach(([x, z, a]) => {
      const cow = new THREE.Group();
      cow.add(box(0.12, 0.1, 0.22, "#f4f1ea", 0, 0.11, 0, { snow: 0.2 }));
      cow.add(box(0.125, 0.06, 0.07, "#2b2724", 0, 0.12, -0.03, { snow: 0 }));
      cow.add(box(0.08, 0.07, 0.07, "#f4f1ea", 0, 0.16, 0.14, { snow: 0 }));
      [[-0.04, -0.08], [0.04, -0.08], [-0.04, 0.08], [0.04, 0.08]].forEach(([a2, b]) => cow.add(box(0.025, 0.07, 0.025, "#2b2724", a2, 0.035, b)));
      cow.position.set(x, 0, z);
      cow.rotation.y = a;
      g.add(cow);
    });
  } else if (t === "barn") {
    g.add(box(0.7, 0.34, 0.6, c, 0, 0.17, 0));
    const roof = box(0.5, 0.5, 0.64, "#6b6f78", 0, 0.34, 0);
    roof.rotation.z = Math.PI / 4;
    roof.scale.y = 1;
    g.add(roof);
    g.add(box(0.24, 0.24, 0.02, "#f4eadb", 0, 0.12, 0.325));
    g.add(box(0.02, 0.24, 0.025, c, 0, 0.12, 0.327));
  } else if (t === "silo") {
    g.add(cyl(0.22, 0.8, "#c8ccd2", 0, 0.4, 0));
    g.add(mesh(new THREE.SphereGeometry(0.22, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat("#9aa1ab"), 0, 0.8, 0));
    [0.2, 0.45, 0.7].forEach((y) => g.add(cyl(0.228, 0.015, "#8a8f98", 0, y, 0)));
  } else if (t === "greenhouse") {
    g.add(box(0.9, 0.02, 0.7, "#6f5233", 0, 0.01, 0));
    [-0.2, 0, 0.2].forEach((z) => g.add(box(0.8, 0.07, 0.08, "#4f9d4a", 0, 0.055, z, { snow: 0 })));
    const glass = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.9, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), mat("#cdeeff", { transparent: true, opacity: 0.38, roughness: 0.1, snow: 0.7, side: THREE.DoubleSide, depthWrite: false }), 0, 0.02, 0);
    glass.castShadow = false;
    g.add(glass);
    [-0.45, -0.15, 0.15, 0.45].forEach((x) => g.add(mesh(new THREE.TorusGeometry(0.34, 0.008, 5, 16, Math.PI).rotateY(Math.PI / 2), mat("#e8eef2"), x, 0.02, 0)));
  } else if (t === "office") {
    const h = f * 0.28;
    g.add(wall(0.8, h, 0.6, f, c, 0, { metalness: 0.2, roughness: 0.45 }));
    g.add(box(0.5, 0.06, 0.3, "#888", 0, h + 0.03, 0));
    if (f >= 12) lamp(g, "#ff2a2a", 0.03, 0, h + 0.09, 0, "blink");
  } else if (t === "hotel") {
    const h = f * 0.27;
    g.add(wall(0.7, h, 0.7, f, c));
    g.add(box(0.44, 0.04, 0.24, "#7a1f2b", 0, 0.2, 0.42));
    g.add(box(0.5, 0.09, 0.04, "#ffd166", 0, h + 0.07, 0.3, { emissive: "#ffd166", emissiveIntensity: 0.4 }));
  } else if (t === "mall") {
    const h = f * 0.3;
    g.add(wall(0.96, h, 0.8, f, c));
    g.add(box(0.5, 0.2, 0.02, "#9cd0e8", 0, 0.12, 0.405, { metalness: 0.4, roughness: 0.15 }));
    g.add(box(0.6, 0.1, 0.04, "#e63946", 0, h + 0.06, 0.34));
  } else if (t === "gasstation") {
    g.add(box(0.98, 0.02, 0.98, "#555a63", 0, 0.01, 0));
    g.add(box(0.4, 0.18, 0.3, c, 0, 0.11, -0.3));
    g.add(box(0.76, 0.04, 0.4, "#e63946", 0, 0.34, 0.2));
    [[-0.34, 0.04], [0.34, 0.04], [-0.34, 0.36], [0.34, 0.36]].forEach(([x, z]) => g.add(cyl(0.015, 0.32, "#ddd", x, 0.18, z)));
    [-0.15, 0.15].forEach((x) => g.add(box(0.06, 0.12, 0.05, "#e8e8e8", x, 0.08, 0.2)));
  } else if (t === "hospital") {
    const h = f * 0.3;
    g.add(wall(0.82, h, 0.6, f, c));
    g.add(box(0.18, 0.045, 0.02, "#d62828", 0, h * 0.8, 0.31));
    g.add(box(0.045, 0.18, 0.02, "#d62828", 0, h * 0.8, 0.31));
    g.add(box(0.2, 0.02, 0.06, "#d62828", 0, h + 0.03, 0));
    g.add(box(0.06, 0.02, 0.2, "#d62828", 0, h + 0.03, 0));
    g.add(box(0.36, 0.04, 0.18, "#bbb", 0, 0.18, 0.4));
  } else if (t === "school") {
    const h = f * 0.28;
    const b = wall(0.9, h, 0.5, f, c);
    b.position.z = -0.2;
    g.add(b);
    g.add(box(0.5, 0.012, 0.3, "#c96f4a", -0.2, 0.006, 0.3));
    g.add(cyl(0.01, 0.5, "#ccc", 0.36, h + 0.25, -0.2));
    g.add(box(0.12, 0.07, 0.01, "#e63946", 0.42, h + 0.45, -0.2));
  } else if (t === "firestation") {
    const h = f * 0.3 + 0.05;
    g.add(wall(0.8, h, 0.6, f, c));
    [-0.2, 0.2].forEach((x) => g.add(box(0.26, 0.2, 0.02, "#f2f2f2", x, 0.1, 0.31)));
    g.add(box(0.18, h + 0.3, 0.18, c, 0.3, (h + 0.3) / 2, -0.2));
    g.add(box(0.5, 0.05, 0.02, "#e63946", 0, h - 0.04, 0.31));
  } else if (t === "church") {
    const s = f === 1 ? 1 : 1.25;
    const hh = 0.28 * s;
    g.add(box(0.5, hh, 0.8, c, 0, hh / 2, 0));
    const ridge = box(0.36, 0.36, 0.82, "#a5543f", 0, hh, 0);
    ridge.rotation.z = Math.PI / 4;
    g.add(ridge);
    g.add(box(0.22, 0.5 * s, 0.22, c, 0, 0.25 * s, 0.34));
    g.add(mesh(new THREE.ConeGeometry(0.17, 0.3, 4), mat("#a5543f"), 0, 0.5 * s + 0.15, 0.34));
    g.add(box(0.02, 0.1, 0.02, "#e8c547", 0, 0.5 * s + 0.35, 0.34));
  } else if (t === "stadium") {
    const h = 0.18 + f * 0.06;
    g.add(mesh(new THREE.CylinderGeometry(0.47, 0.42, h, 28), mat(c), 0, h / 2, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.01, 28), mat("#4fae4a"), 0, h + 0.006, 0));
    g.add(mesh(new THREE.TorusGeometry(0.31, 0.02, 6, 28).rotateX(Math.PI / 2), mat("#fff"), 0, h + 0.015, 0));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { g.add(cyl(0.012, 0.3, "#ccc", a * 0.36, h + 0.15, b * 0.36)); lamp(g, "#fff2c0", 0.035, a * 0.36, h + 0.31, b * 0.36, "steady"); });
  } else if (t === "warehouse") {
    const h = 0.26 * f + 0.06;
    g.add(box(0.96, h, 0.72, c, 0, h / 2, 0));
    g.add(box(0.98, 0.04, 0.74, "#555", 0, h + 0.02, 0));
    [-0.3, 0, 0.3].forEach((x) => g.add(box(0.2, 0.16, 0.02, "#4a5560", x, 0.08, 0.361)));
  } else if (t === "turbine") {
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.04, 1, 8), mat("#f2f2f2"), 0, 0.5, 0));
    g.add(box(0.07, 0.06, 0.12, "#e8e8e8", 0, 1.0, 0.02));
    lamp(g, "#ff2a2a", 0.03, 0, 1.06, -0.02, "blink");
    const blades = new THREE.Group();
    blades.position.set(0, 1.0, 0.09);
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Group();
      arm.rotation.z = (i * Math.PI * 2) / 3;
      arm.add(box(0.04, 0.4, 0.008, "#fafafa", 0, 0.2, 0));
      blades.add(arm);
    }
    g.add(blades);
    g.userData.spin = blades;
  }
  if (TYPES[t].rot) g.rotation.y = (cell.r || 0) * (Math.PI / 2);
  return g;
}

function disposeGroup(g) {
  if (g.userData.shared || g.userData.cached) return; // owned by the model library or the asset cache
  if (g.geometry) g.geometry.dispose();
  [].concat(g.material || []).forEach((m) => { lit.delete(m); glow.delete(m); m.dispose(); });
  g.children.forEach(disposeGroup);
}

/* a tile drawn with the Blender models, plus the ground and lamps that go with it */
function detailedTile(g, cell) {
  const model = ASSETS?.ready && !["railstation", "metrostation"].includes(cell.t) && ASSETS.tile(cell, season, foliage);
  if (!model) return false;
  const { t, f = 1 } = cell;
  const h = f * ({ house: 0.32, apartment: 0.28, office: 0.28, terminal: 0.28 }[t] || 0.3);
  const red = "#ff2a2a";
  g.add(model);
  if (t === "field") g.add(box(0.96, 0.03, 0.96, "#a07a50", 0, 0.015, 0, surf("soil")));
  if (t === "vegfarm") {
    g.add(box(0.96, 0.03, 0.96, "#8f6a43", 0, 0.015, 0, surf("soil")));
    [-0.28, 0, 0.28].forEach((x) => g.add(box(0.14, 0.02, 0.88, "#6d4d30", x, 0.035, 0, surf("soil"))));
  }
  if (t === "orchard") g.add(box(0.96, 0.02, 0.96, "#8cc062", 0, 0.01, 0, surf("grass")));
  if (t === "paddy") {
    g.add(box(0.96, 0.025, 0.96, season === "winter" ? "#c4dde8" : season === "autumn" ? "#8f7a45" : "#6fa79a", 0, 0.012, 0, { roughness: 0.08, metalness: 0.2, ...ripples() }));
    [[0, -0.47, 0.96, 0.05], [0, 0.47, 0.96, 0.05], [-0.47, 0, 0.05, 0.96], [0.47, 0, 0.05, 0.96]].forEach(([x, z, w, d]) => g.add(box(w, 0.06, d, "#8f7248", x, 0.03, z, surf("soil"))));
  }
  if (t === "terminal") [-0.28, 0.28].forEach((x) => { g.add(box(0.14, 0.08, 0.3, "#9aa5b1", x, 0.18, 0.2)); g.add(box(0.16, 0.02, 0.3, "#667", x, 0.23, 0.2)); });
  if (t === "tower") {
    lamp(g, red, 0.03, 0, f >= 10 ? h + 1.42 : h + 0.1, 0, "blink");
    if (f >= 16) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => lamp(g, red, 0.022, a * 0.34, h + 0.065, b * 0.34));
  }
  if (t === "apartment" && f >= 8) lamp(g, red, 0.025, 0.3, h + 0.07, -0.3, "blink");
  if (t === "office" && f >= 12) lamp(g, red, 0.025, 0.3, h + 0.07, -0.2, "blink");
  if (t === "factory") [-0.28, -0.1].forEach((x) => lamp(g, red, 0.025, x, h + 0.665, -0.2));
  if (t === "atc") { lamp(g, red, 0.03, 0, 1.43, 0, "blink"); lamp(g, "#ffffff", 0.022, 0, 1.2, 0, "white"); }
  if (t === "stadium") [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => lamp(g, "#fff2c0", 0.028, a * 0.35, 0.47 * (0.75 + 0.25 * f), b * 0.35));
  if (t === "turbine") {
    const blades = ASSETS.model("turbine_blades");
    blades.position.set(0, 1.0, 0.09);
    g.add(blades);
    g.userData.spin = blades;
    lamp(g, red, 0.025, 0, 1.05, -0.04, "blink");
  }
  if (TYPES[t].rot) g.rotation.y = (cell.r || 0) * (Math.PI / 2);
  return true;
}

/* ---------- the engine ---------- */
export function createEngine(container, hooks, library, assets) {
  ASSETS = assets || null;
  let disposed = false;
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  let grid = baseCity();
  let name = "My city";
  let tool = "select";
  let activeModel = null;
  let rot = 0;
  let sel = null;
  let hover = null;
  let hour = 14;
  let trafficOn = true;
  const undo = [];
  const redo = [];
  let lastKey = "", lastT = 0;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  container.appendChild(renderer.domElement);
  const dom = renderer.domElement;
  dom.style.display = "block";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#9fd3ff");
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envMap = pmrem.fromScene(room, 0.04);
  scene.environment = envMap.texture; // soft reflections on glass, paint, metal and water
  room.dispose();
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  const controls = new OrbitControls(camera, dom);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2.2;
  controls.minDistance = 6;
  controls.maxDistance = 90;
  const resetCamera = () => { camera.position.set(28, 27, 28); controls.target.set(0, 0, 0); controls.update(); };
  resetCamera();

  const hemi = new THREE.HemisphereLight("#ffffff", "#6b7a5a", 0.6);
  const sun = new THREE.DirectionalLight("#fff4e0", 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 120 });
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.012;
  scene.add(hemi, sun);

  // the board
  const soil = mat("#6b4f3a");
  const GROUND = { spring: "#6fb04a", summer: "#64984a", autumn: "#958342", winter: "#b4bfc9" };
  const groundMat = mat(GROUND.summer);
  const board = new THREE.Mesh(new THREE.BoxGeometry(N, 0.4, N), [soil, soil, groundMat, soil, soil, soil]);
  board.position.y = -0.2;
  board.receiveShadow = true;
  scene.add(board);
  const gridLines = new THREE.GridHelper(N, N, "#6aa356", "#6aa356");
  gridLines.position.y = 0.003;
  gridLines.material.transparent = true;
  gridLines.material.opacity = 0.35;
  scene.add(gridLines);

  const tileLayer = new THREE.Group();
  scene.add(tileLayer);
  const groups = new Map();

  const cellAt = (x, z) => (x >= 0 && z >= 0 && x < N && z < N ? grid[z][x] : null);
  const isRoad = (x, z) => cellAt(x, z)?.t === "road";
  const KLASS = { road: "road", rail: "rail", railstation: "rail", metro: "metro", metrostation: "metro", runway: "air", taxiway: "air", apron: "air", drain: "drain", treatment: "drain", water: "drain" };
  const STATION = { railstation: 1, metrostation: 1 };
  const axisOk = (c, dx) => !STATION[c.t] || ((c.r || 0) % 2 === 0) === (dx === 0);
  function link(x, z, dx, dz, self = cellAt(x, z)) {
    const b = cellAt(x + dx, z + dz);
    if (!self || !b) return false;
    const k = KLASS[self.t];
    if (k === "drain" && b.t === "road") return KLASS[cellAt(x + dx * 2, z + dz * 2)?.t] === "drain"; // culvert under a road
    return !!k && KLASS[b.t] === k && axisOk(self, dx) && axisOk(b, dx);
  }
  const isRw = (x, z) => cellAt(x, z)?.t === "runway";
  const nbOf = (x, z, self) => ({ n: link(x, z, 0, -1, self), e: link(x, z, 1, 0, self), s: link(x, z, 0, 1, self), w: link(x, z, -1, 0, self), rw: { n: isRw(x, z - 1), e: isRw(x + 1, z), s: isRw(x, z + 1), w: isRw(x - 1, z) }, flow: flow.has(x + z * N), down: flow.get(x + z * N) });

  /* which drains reach an outlet (water or a treatment plant), and which way they run */
  let flow = new Map();
  function computeFlow(redraw) {
    const next = new Map();
    const queue = [];
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (["water", "treatment"].includes(cellAt(x, z)?.t)) queue.push([x, z]);
    for (let i = 0; i < queue.length; i++) {
      const [x, z] = queue[i];
      DIRS.forEach(([dx, dz]) => {
        const k = cellAt(x + dx, z + dz)?.t === "road" ? 2 : 1;
        const a = x + dx * k, b = z + dz * k;
        if (cellAt(a, b)?.t !== "drain" || next.has(a + b * N)) return;
        next.set(a + b * N, [-dx, -dz]);
        queue.push([a, b]);
      });
    }
    const dirty = new Set([...flow.keys(), ...next.keys()].filter((k) => String(flow.get(k)) !== String(next.get(k))));
    flow = next;
    if (redraw) dirty.forEach((k) => refresh(k % N, Math.floor(k / N)));
  }
  function refresh(x, z) {
    const k = x + z * N;
    const old = groups.get(k);
    if (old) { tileLayer.remove(old); disposeGroup(old); groups.delete(k); }
    const cell = grid[z][x];
    if (!cell) return;
    const g = cell.t === "custom" ? library.instance(cell) : buildTile(cell, nbOf(x, z));
    g.position.set(wx(x), 0, wx(z));
    if (cell.t === "tree" || cell.t === "pasture") g.rotation.y = ((x * 73 + z * 151) % 8) * (Math.PI / (cell.t === "tree" ? 4 : 2));
    g.userData.tile = { x, z };
    if (g.userData.parked) g.userData.parked.visible = !flights.isActive();
    tileLayer.add(g);
    groups.set(k, g);
  }
  function refreshAround(x, z) {
    refresh(x, z);
    DIRS.forEach(([dx, dz]) => {
      [1, 2].forEach((k) => { const c = cellAt(x + dx * k, z + dz * k); if (c && KLASS[c.t] && (k === 1 || KLASS[c.t] === "drain")) refresh(x + dx * k, z + dz * k); });
    });
  }
  function refreshAll() {
    computeFlow(false);
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) refresh(x, z);
  }

  /* highlights and ghost */
  const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const hoverMesh = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ color: "#7CFC8A", transparent: true, opacity: 0.4, depthWrite: false }));
  hoverMesh.position.y = 0.08;
  hoverMesh.visible = false;
  const selMesh = new THREE.Group();
  selMesh.add(new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ color: "#ffb703", transparent: true, opacity: 0.3, depthWrite: false })));
  selMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 0.1, 1)), new THREE.LineBasicMaterial({ color: "#ffb703" })));
  selMesh.visible = false;
  scene.add(hoverMesh, selMesh);
  let ghost = null;
  const ghostMats = [];
  function updateGhost() {
    if (ghost) { scene.remove(ghost); disposeGroup(ghost); ghost = null; }
    ghostMats.splice(0).forEach((m) => m.dispose());
    if (!hover || !TYPES[tool] || samePiece(cellAt(hover.x, hover.z))) return;
    const cell = newCell();
    if (tool === "custom") {
      if (!library.has(activeModel)) return;
      const e = library.extent(cell);
      ghost = new THREE.Group();
      ghost.add(box(e.w, Math.max(e.h, 0.05), e.d, "#7CFC8A", 0, Math.max(e.h, 0.05) / 2, 0, { snow: 0 }));
    } else ghost = buildTile(cell, nbOf(hover.x, hover.z, cell));
    ghost.position.set(wx(hover.x), 0, wx(hover.z));
    ghost.traverse((o) => {
      if (!o.material) return;
      if (o.userData.cached) { o.material = o.material.clone(); ghostMats.push(o.material); }
      [].concat(o.material).forEach((m) => { m.transparent = true; m.opacity = 0.6; m.depthWrite = false; });
      o.castShadow = false;
    });
    scene.add(ghost);
  }
  const newCell = () => (tool === "custom" ? { t: "custom", m: activeModel, s: library.defaultSize(activeModel), r: rot } : { ...defaultCell(tool), r: rot });
  const samePiece = (c) => !!c && c.t === tool && (tool !== "custom" || c.m === activeModel);
  function setHover(t) {
    if (hover && t && hover.x === t.x && hover.z === t.z) return;
    hover = t;
    hoverMesh.visible = !!t;
    if (t) {
      hoverMesh.position.set(wx(t.x), 0.08, wx(t.z));
      hoverMesh.material.color.set(tool === "bulldoze" ? "#ff5a5a" : tool === "select" ? "#ffffff" : "#7CFC8A");
    }
    updateGhost();
    hooks.onHover?.(t ? { ...t, cell: cellAt(t.x, t.z) } : null);
  }

  /* history, saving */
  const snap = () => JSON.stringify(grid);
  function pushHistory(key) {
    const now = performance.now();
    if (key && key === lastKey && now - lastT < 800) { lastT = now; return; }
    lastKey = key || ""; lastT = now;
    undo.push(snap());
    if (undo.length > 60) undo.shift();
    redo.length = 0;
  }
  let saveTimer = 0;
  const save = () => ({ v: 1, name, season, models: library.serialize(), n: N, grid: grid.map((row) => row.map((c) => c || 0)) });
  function changed() {
    computeFlow(true);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(save())); } catch { hooks.onError?.("Browser storage is full, so autosave stopped. Use Save file."); } }, 300);
    syncCars();
    syncTrains();
    syncPlanes();
    hooks.onChange?.();
  }
  function loadGrid(data) {
    grid = data;
    refreshAll();
    if (sel && !cellAt(sel.x, sel.z)) select(null);
    else if (sel) hooks.onSelect?.(sel);
    updateGhost();
  }
  function restore(from, to) {
    if (!from.length) return;
    to.push(snap());
    loadGrid(JSON.parse(from.pop()));
    lastKey = "";
    changed();
  }

  function loadModels(raw) {
    (Array.isArray(raw?.models) ? raw.models : []).slice(0, 40).forEach((m) => {
      try { library.add(m.name, m.text, String(m.id)); } catch { /* skip a broken model */ }
    });
  }
  function sanitize(raw) {
    let rows = raw && raw.grid;
    if (Array.isArray(rows) && rows.length === 24 && rows.every((r) => Array.isArray(r) && r.length === 24)) {
      const old = rows;
      rows = Array.from({ length: N }, (_, z) => Array.from({ length: N }, (_, x) => (old[z] && old[z][x]) || 0));
    }
    if (!Array.isArray(rows) || rows.length !== N) throw new Error("This is not a city file for this version.");
    return rows.map((row) => {
      if (!Array.isArray(row) || row.length !== N) throw new Error("This is not a city file for this version.");
      return row.map((c) => {
        if (!c || !TYPES[c.t]) return null;
        const d = TYPES[c.t];
        const out = { t: c.t, r: ((c.r | 0) % 4 + 4) % 4 };
        if (c.t === "custom") {
          if (!library.has(c.m)) return null;
          out.m = c.m;
          out.s = Math.max(0.3, Math.min(8, +c.s || 1));
        }
        if (d.f) out.f = Math.max(d.min, Math.min(d.max, c.f | 0 || d.f));
        if (d.pal) out.c = /^#[0-9a-f]{6}$/i.test(c.c) ? c.c : DEFAULT_COLOR[c.t];
        return out;
      });
    });
  }

  /* editing */
  function put(x, z, cell) {
    grid[z][x] = cell;
    refreshAround(x, z);
  }
  function applyTool(t) {
    const cur = cellAt(t.x, t.z);
    if (tool === "bulldoze") {
      if (!cur) return false;
      put(t.x, t.z, null);
      if (sel && sel.x === t.x && sel.z === t.z) select(null);
      return true;
    }
    if (!TYPES[tool] || samePiece(cur) || (tool === "custom" && !library.has(activeModel))) return false;
    put(t.x, t.z, newCell());
    if (sel && sel.x === t.x && sel.z === t.z) hooks.onSelect?.(sel);
    updateGhost();
    return true;
  }
  function sizeSelection() {
    const c = sel && cellAt(sel.x, sel.z);
    const e = c?.t === "custom" ? library.extent(c) : { w: 1, d: 1 };
    selMesh.scale.set(Math.max(1, e.w), 1, Math.max(1, e.d));
  }
  function select(t) {
    sel = t ? { x: t.x, z: t.z } : null;
    selMesh.visible = !!sel;
    if (sel) selMesh.position.set(wx(sel.x), 0.06, wx(sel.z));
    sizeSelection();
    hooks.onSelect?.(sel);
  }

  /* picking */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(e) {
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const seeThrough = tool !== "select" && tool !== "bulldoze";
    let hit = null, o = null;
    for (const h of ray.intersectObjects([board, tileLayer], true)) {
      let p = h.object;
      while (p && !p.userData.tile) p = p.parent;
      if (seeThrough && p?.userData.shared) continue;
      hit = h; o = p;
      break;
    }
    if (!hit) return null;
    if (o) return { ...o.userData.tile };
    const x = Math.floor(hit.point.x + N / 2), z = Math.floor(hit.point.z + N / 2);
    return x >= 0 && z >= 0 && x < N && z < N ? { x, z } : null;
  }
  let down = null, painting = false, lastPaint = "";
  function paintAt(t) {
    const k = t.x + "," + t.z;
    if (k === lastPaint) return;
    lastPaint = k;
    applyTool(t);
  }
  const onDown = (e) => {
    if (e.button !== 0) return;
    down = { x: e.clientX, y: e.clientY };
    if (e.shiftKey && tool !== "select") {
      painting = true;
      controls.enabled = false;
      pushHistory();
      const t = pick(e);
      if (t) paintAt(t);
    }
  };
  const onMove = (e) => {
    const t = pick(e);
    setHover(t);
    if (painting && t) paintAt(t);
  };
  const onUp = (e) => {
    controls.enabled = true;
    if (painting) { painting = false; lastPaint = ""; down = null; changed(); return; }
    if (down && e.button === 0 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) {
      const t = pick(e);
      if (tool === "select") select(t && cellAt(t.x, t.z) ? t : null);
      else if (t) { pushHistory(); if (applyTool(t)) changed(); }
    }
    down = null;
  };
  const onLeave = () => setHover(null);
  dom.addEventListener("pointerdown", onDown, true);
  dom.addEventListener("pointermove", onMove);
  dom.addEventListener("pointerup", onUp);
  dom.addEventListener("pointerleave", onLeave);

  /* sky: sun, moon, stars, clouds, birds */
  const sky = new THREE.Group();
  scene.add(sky);
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 16), new THREE.MeshBasicMaterial({ color: "#fff1a8", fog: false, toneMapped: false }));
  const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(4.5, 24, 16), new THREE.MeshBasicMaterial({ color: "#e9eefc", fog: false, toneMapped: false }));
  sky.add(sunMesh, moonMesh);
  const starPos = [];
  for (let i = 0; i < 350; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.acos(Math.random() * 0.95 + 0.05);
    starPos.push(Math.sin(e) * Math.cos(a) * 200, Math.cos(e) * 200, Math.sin(e) * Math.sin(a) * 200);
  }
  const starGeo = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: "#ffffff", size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false }));
  sky.add(stars);

  const clouds = [];
  const cloudMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.78, toneMapped: false });
  const cloudGeo = new THREE.SphereGeometry(1, 12, 8);
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    const parts = 4 + Math.floor(Math.random() * 3);
    for (let j = 0; j < parts; j++) {
      const m = new THREE.Mesh(cloudGeo, cloudMat);
      const k = 1.1 + Math.random() * 1.1;
      m.scale.set(k * 1.4, k * 0.7, k);
      m.position.set((j - parts / 2) * 1.6, Math.random() * 0.4, (Math.random() - 0.5) * 1.5);
      c.add(m);
    }
    c.position.set((Math.random() - 0.5) * 110, 12 + Math.random() * 6, (Math.random() - 0.5) * 80);
    c.userData.v = 0.4 + Math.random() * 0.6;
    sky.add(c);
    clouds.push(c);
  }

  const birds = [];
  const birdMat = new THREE.MeshBasicMaterial({ color: "#2b2b33", side: THREE.DoubleSide });
  const wingGeo = new THREE.PlaneGeometry(0.2, 0.07).translate(0.1, 0, 0).rotateX(-Math.PI / 2);
  const bodyBird = new THREE.BoxGeometry(0.035, 0.03, 0.09);
  const birdsGroup = new THREE.Group();
  sky.add(birdsGroup);
  for (let f = 0; f < 3; f++) {
    const cx = (Math.random() - 0.5) * 14, cz = (Math.random() - 0.5) * 14, r = 8 + Math.random() * 8, h = 6 + Math.random() * 3, dir = f % 2 ? 1 : -1;
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const wl = new THREE.Mesh(wingGeo, birdMat), wr = new THREE.Mesh(wingGeo, birdMat);
      wr.scale.x = -1;
      g.add(new THREE.Mesh(bodyBird, birdMat), wl, wr);
      g.scale.setScalar(1.6);
      birdsGroup.add(g);
      birds.push({ g, wl, wr, cx, cz, r: r + i * 0.5, a: Math.random() * 6.28, sp: (0.12 + Math.random() * 0.03) * dir, h: h + i * 0.3, ph: Math.random() * 6 });
    }
  }
  let clock = 0;
  const cloudDay = new THREE.Color("#ffffff"), cloudNight = new THREE.Color("#3a4468");
  function stepSky(dt) {
    clock += dt;
    clouds.forEach((c) => { c.position.x += c.userData.v * dt; if (c.position.x > 60) c.position.x = -60; });
    birds.forEach((b) => {
      b.a += b.sp * dt;
      const x = b.cx + Math.cos(b.a) * b.r, z = b.cz + Math.sin(b.a) * b.r;
      const vx = -Math.sin(b.a) * Math.sign(b.sp), vz = Math.cos(b.a) * Math.sign(b.sp);
      b.g.position.set(x, b.h + Math.sin(b.a * 3 + b.ph) * 0.4, z);
      b.g.rotation.y = Math.atan2(vx, vz);
      const fl = Math.sin(clock * 9 + b.ph) * 0.7;
      b.wl.rotation.z = fl; b.wr.rotation.z = -fl;
    });
    groups.forEach((g) => { if (g.userData.spin) g.userData.spin.rotation.z -= dt * 1.2; if (g.userData.shared) library.animate(g, clock); });
    updateGlow(clock);
    ASSETS?.texture("water")?.offset.set(clock * 0.03, clock * 0.018);
  }

  const flakeCanvas = document.createElement("canvas");
  flakeCanvas.width = flakeCanvas.height = 32;
  const fg = flakeCanvas.getContext("2d");
  fg.fillStyle = "#fff";
  fg.beginPath(); fg.arc(16, 16, 13, 0, Math.PI * 2); fg.fill();
  const FLAKES = 3500;
  const flakePos = new Float32Array(FLAKES * 3);
  for (let i = 0; i < FLAKES; i++) flakePos.set([(Math.random() - 0.5) * 48, Math.random() * 22, (Math.random() - 0.5) * 48], i * 3);
  const flakeGeo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(flakePos, 3));
  const snowfall = new THREE.Points(flakeGeo, new THREE.PointsMaterial({ size: 0.16, map: new THREE.CanvasTexture(flakeCanvas), transparent: true, alphaTest: 0.2, depthWrite: false }));
  snowfall.visible = false;
  snowfall.frustumCulled = false;
  scene.add(snowfall);
  function stepSeason(dt) {
    groups.forEach((g) => {
      const r = g.userData.ripple;
      if (!r) return;
      const k = ((clock * 0.9) % 1) - 0.5;
      r.m.position.set(r.dx * k * 0.9, 0.034, r.dz * k * 0.9);
    });
    if (!snowfall.visible) return;
    for (let i = 0; i < FLAKES; i++) {
      let y = flakePos[i * 3 + 1] - dt * (0.9 + (i % 5) * 0.18);
      if (y < 0) y += 22;
      flakePos[i * 3 + 1] = y;
      flakePos[i * 3] += Math.sin(clock + i) * dt * 0.25;
    }
    flakeGeo.attributes.position.needsUpdate = true;
  }
  function applySeason(name_) {
    season = SEASONS.some(([k]) => k === name_) ? name_ : "summer";
    SNOW.value = season === "winter" ? 1 : 0;
    groundMat.color.set(GROUND[season]);
    gridLines.material.opacity = season === "winter" ? 0.12 : 0.35;
    snowfall.visible = season === "winter";
  }

  /* time of day */
  const dayCol = new THREE.Color("#9fd3ff"), nightCol = new THREE.Color("#0a1128"), duskCol = new THREE.Color("#ff9f6b");
  function setTime(h) {
    hour = h;
    const ang = ((h - 6) / 24) * Math.PI * 2;
    const e = Math.sin(ang);
    const day = THREE.MathUtils.smoothstep(e, -0.1, 0.35);
    sun.position.set(-Math.cos(ang) * 30, Math.max(e, 0.12) * 32, 12);
    sun.intensity = 0.12 + 1.75 * day;
    sun.color.set(day < 0.15 ? "#8fa8ff" : day < 0.5 ? "#ffb27a" : "#fff4e0");
    const d = new THREE.Vector3(-Math.cos(ang), Math.sin(ang), 0.4).normalize();
    sunMesh.position.copy(d).multiplyScalar(130);
    moonMesh.position.copy(d).multiplyScalar(-130);
    sunMesh.visible = sunMesh.position.y > -4;
    moonMesh.visible = moonMesh.position.y > -4;
    stars.material.opacity = Math.max(0, 1 - day * 1.8) * 0.9;
    cloudMat.color.copy(cloudNight).lerp(cloudDay, day);
    birdsGroup.visible = day > 0.3;
    hemi.intensity = 0.14 + 0.26 * day;
    scene.environmentIntensity = 0.05 + 0.22 * day;
    const sky = nightCol.clone().lerp(dayCol, day).lerp(duskCol, Math.max(0, 0.5 - Math.abs(e - 0.05) * 3) * 0.7);
    if (season === "winter") sky.lerp(new THREE.Color("#8d9bad"), 0.45 * day);
    scene.background.copy(sky);
    night = 1 - day;
    lit.forEach((m) => { m.emissiveIntensity = night; });
  }
  setTime(hour);

  /* cars */
  const cars = [];
  const carGroup = new THREE.Group();
  scene.add(carGroup);
  const CAR_COLORS = ["#e63946", "#f4a261", "#2a9d8f", "#457b9d", "#f1faee", "#ffd166", "#6a4c93", "#222"];
  const bodyGeo = new THREE.BoxGeometry(0.09, 0.05, 0.19), cabGeo = new THREE.BoxGeometry(0.08, 0.045, 0.09);
  const cabMat = new THREE.MeshStandardMaterial({ color: "#cfe8f5", roughness: 0.2 });
  const roads = () => { const r = []; for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (isRoad(x, z)) r.push([x, z]); return r; };
  function options(x, z) { return DIRS.map(([dx, dz]) => [x + dx, z + dz]).filter(([a, b]) => isRoad(a, b)); }
  function spawn() {
    const spots = roads().filter(([x, z]) => options(x, z).length);
    if (!spots.length) return null;
    const [x, z] = spots[Math.floor(Math.random() * spots.length)];
    const [nx, nz] = options(x, z)[Math.floor(Math.random() * options(x, z).length)];
    const g = new THREE.Group();
    const kinds = ["car", "car", "car", "car_suv", "car_suv", "car_taxi", "car_van", "car_bus", "car_truck"];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const paint = kind === "car_taxi" ? "#f2c230" : CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    const bm = new THREE.MeshStandardMaterial({ color: paint, roughness: 0.4 });
    if (ASSETS?.ready) g.add(ASSETS.model(kind, { carpaint: paint }));
    else {
      const b = new THREE.Mesh(bodyGeo, bm); b.position.y = 0.065; b.castShadow = true;
      const c = new THREE.Mesh(cabGeo, cabMat); c.position.set(0, 0.11, -0.01); c.castShadow = true;
      g.add(b, c);
    }
    carGroup.add(g);
    return { g, bm, x, z, nx, nz, t: Math.random(), dx: nx - x, dz: nz - z, v: 0.8 + Math.random() * 0.7 };
  }
  function syncCars() {
    const want = trafficOn ? Math.min(34, Math.floor(roads().length * 0.5)) : 0;
    while (cars.length > want) { const c = cars.pop(); carGroup.remove(c.g); c.bm.dispose(); }
    while (cars.length < want) { const c = spawn(); if (!c) break; cars.push(c); }
  }
  function stepCars(dt) {
    cars.forEach((c, i) => {
      if (!isRoad(c.x, c.z) || !isRoad(c.nx, c.nz)) {
        const n = spawn();
        if (n) { carGroup.remove(c.g); c.bm.dispose(); cars[i] = n; }
        return;
      }
      c.t += dt * c.v;
      if (c.t >= 1) {
        c.t -= 1;
        const px = c.x, pz = c.z;
        c.x = c.nx; c.z = c.nz;
        const opts = options(c.x, c.z);
        const fwd = opts.filter(([a, b]) => !(a === px && b === pz));
        const pool = fwd.length ? fwd : opts;
        [c.nx, c.nz] = pool[Math.floor(Math.random() * pool.length)];
      }
      const tx = c.nx - c.x, tz = c.nz - c.z;
      const k = Math.min(1, dt * 6);
      c.dx += (tx - c.dx) * k; c.dz += (tz - c.dz) * k;
      const len = Math.hypot(c.dx, c.dz) || 1, ux = c.dx / len, uz = c.dz / len;
      const px = c.x + (c.nx - c.x) * c.t, pz = c.z + (c.nz - c.z) * c.t;
      c.g.position.set(wx(px) - uz * 0.12, 0.04, wx(pz) + ux * 0.12);
      c.g.rotation.y = Math.atan2(ux, uz);
    });
  }

  /* trains (ground railway) and metro (raised) */
  const lerpAng = (a, b, k) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; };
  const carBox = (w, h, l, color, y) => mesh(new THREE.BoxGeometry(w, h, l), mat(color, { roughness: 0.45, snow: 0 }), 0, y, 0);
  function makeRailCars() {
    if (ASSETS?.ready) return [["loco", "#a52a22"], ["wagon", "#2a5f9e"], ["wagon", "#8a6a35"]].map(([n, c]) => ASSETS.model(n, { carpaint: c }));
    const loco = new THREE.Group();
    loco.add(carBox(0.19, 0.11, 0.36, "#c0392b", 0.1));
    loco.add(mesh(new THREE.BoxGeometry(0.19, 0.06, 0.12), mat("#7d2218"), 0, 0.19, -0.1));
    loco.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8), mat("#222"), 0, 0.2, 0.1));
    const cars = [loco];
    ["#2a6fdb", "#e0b872"].forEach((c) => { const g = new THREE.Group(); g.add(carBox(0.18, 0.11, 0.36, c, 0.1), mesh(new THREE.BoxGeometry(0.19, 0.012, 0.37), mat("#ddd"), 0, 0.16, 0)); cars.push(g); });
    return cars;
  }
  function makeMetroCars() {
    if (ASSETS?.ready) return [0, 1, 2].map(() => ASSETS.model("metrocar"));
    return [0, 1, 2].map(() => {
      const g = new THREE.Group();
      g.add(carBox(0.17, 0.1, 0.36, "#dfe5ee", 0.07));
      g.add(mesh(new THREE.BoxGeometry(0.175, 0.03, 0.3), mat("#1c2a3a"), 0, 0.09, 0));
      g.add(mesh(new THREE.BoxGeometry(0.175, 0.02, 0.362), mat("#2a6fdb"), 0, 0.035, 0));
      return g;
    });
  }
  const systems = [
    { klass: "rail", y: 0.06, speed: 0.9, make: makeRailCars, trains: [], sig: "", group: new THREE.Group() },
    { klass: "metro", y: 0.51, speed: 1.4, make: makeMetroCars, trains: [], sig: "", group: new THREE.Group() },
  ];
  systems.forEach((sy) => scene.add(sy.group));
  const nbrs = (x, z, klass) => DIRS.filter(([dx, dz]) => link(x, z, dx, dz) && KLASS[cellAt(x + dx, z + dz).t] === klass).map(([dx, dz]) => [x + dx, z + dz]);
  const nextTile = (pts, klass) => {
    const [x, z] = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const o = nbrs(x, z, klass);
    const fwd = prev ? o.filter(([a, b]) => !(a === prev[0] && b === prev[1])) : o;
    const pool = fwd.length ? fwd : o;
    return pool[Math.floor(Math.random() * pool.length)];
  };
  function syncTrains() {
    systems.forEach((sy) => {
      const tiles = [];
      let sig = "";
      for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
        const c = cellAt(x, z);
        if (c && KLASS[c.t] === sy.klass) { tiles.push([x, z]); sig += x + "," + z + c.t + (c.r || 0) + ";"; }
      }
      if (sig === sy.sig) return;
      sy.sig = sig;
      sy.trains.forEach((t) => { sy.group.remove(t.g); disposeGroup(t.g); });
      sy.trains = [];
      const starts = tiles.filter(([x, z]) => nbrs(x, z, sy.klass).length);
      const want = starts.length < 4 ? 0 : Math.min(3, 1 + Math.floor(starts.length / 25));
      for (let i = 0; i < want; i++) {
        const [x, z] = starts[Math.floor(Math.random() * starts.length)];
        const pts = [[x, z]];
        for (let k = 0; k < 8; k++) { const n = nextTile(pts, sy.klass); if (!n) break; pts.push(n); }
        if (pts.length < 6) continue;
        const g = new THREE.Group();
        const cars = sy.make();
        cars.forEach((c) => g.add(c));
        sy.group.add(g);
        sy.trains.push({ g, cars, pts, s: 3.2, ang: cars.map(() => 0) });
      }
    });
  }
  function stepTrains(dt) {
    systems.forEach((sy) => sy.trains.forEach((t) => {
      t.s += sy.speed * dt;
      while (t.pts.length < Math.floor(t.s) + 3) { const n = nextTile(t.pts, sy.klass); if (!n) break; t.pts.push(n); }
      if (Math.floor(t.s) > 6) { t.pts.shift(); t.s -= 1; }
      t.cars.forEach((car, i) => {
        const d = Math.max(0, t.s - i * 0.42);
        const k = Math.min(Math.floor(d), t.pts.length - 2), f = d - k;
        const a = t.pts[k], b = t.pts[k + 1];
        if (!b) return;
        car.position.set(wx(a[0] + (b[0] - a[0]) * f), sy.y, wx(a[1] + (b[1] - a[1]) * f));
        t.ang[i] = lerpAng(t.ang[i], Math.atan2(b[0] - a[0], b[1] - a[1]), Math.min(1, dt * 8));
        car.rotation.y = t.ang[i];
      });
    }));
  }

  /* airliners: logic lives in flights.js */
  const flights = createFlights({ N, cellAt, wx });
  const planeGroup = new THREE.Group();
  scene.add(planeGroup);
  const planeMeshes = [];
  function makePlaneMeshes() {
    planeMeshes.splice(0).forEach((m) => { planeGroup.remove(m); disposeGroup(m); });
    ["#e63946", "#2a6fdb", "#2a9d8f", "#f4a261"].forEach((c) => {
      const p = planeMesh(c, 1.4);
      p.rotation.order = "YXZ";
      p.visible = false;
      planeGroup.add(p);
      planeMeshes.push(p);
    });
  }
  makePlaneMeshes();
  function syncPlanes() {
    if (flights.sync()) groups.forEach((g) => { if (g.userData.parked) g.userData.parked.visible = !flights.isActive(); });
    planeMeshes.forEach((m, i) => { m.visible = i < flights.planes.length; });
  }
  function stepPlanes(dt) {
    flights.step(dt);
    flights.planes.forEach((q, i) => {
      const m = planeMeshes[i];
      m.position.copy(q.pos);
      m.rotation.set(-q.pitch, q.yaw, q.roll);
    });
  }

  /* loop and size */
  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  let raf = 0, last = performance.now();
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    stepCars(dt);
    stepSky(dt);
    stepSeason(dt);
    stepTrains(dt);
    stepPlanes(dt);
    controls.update();
    renderer.render(scene, camera);
  };

  // load: saved city, else the base city
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    applySeason(raw?.season);
    if (raw) { loadModels(raw); grid = sanitize(raw); name = String(raw.name || name).slice(0, 40); }
  } catch { grid = baseCity(); }
  setTime(hour);
  refreshAll();
  syncCars();
  syncTrains();
  syncPlanes();
  raf = requestAnimationFrame(loop);

  /* how the app dresses each Blender material: tint, lit windows, glass, snow */
  assets?.setMaterialFactory((base, color) => {
    const m = base.clone();
    const name = base.name;
    if (color) m.color.set(color);
    if (name === "glasslit") { m.emissive.set("#ffc873"); m.emissiveIntensity = night; lit.add(m); }
    if (name === "tintglass") Object.assign(m, { metalness: 0.35, roughness: 0.12 });
    if (name === "greenglass") Object.assign(m, { transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide });
    if (["leaf", "pine", "crop"].includes(name)) { m.alphaTest = 0.5; m.side = THREE.DoubleSide; }
    // moving things (names starting v_, and paint) stay clear of snow
    const still = !name.startsWith("v_") && !["carpaint", "tail", "rubber", "glass", "glasslit", "tintglass"].includes(name);
    return addSnow(m, still ? (name === "water" ? 0.2 : 0.75) : 0);
  });
  assets?.load().then(() => {
    if (disposed) return;
    const grass = assets.texture("grass").clone();
    grass.repeat.set(N, N);
    groundMat.map = grass;
    groundMat.needsUpdate = true;
    makePlaneMeshes();
    birds.forEach((b) => {
      b.g.clear();
      const left = assets.model("bird_wing"), right = assets.model("bird_wing");
      right.scale.x = -1;
      b.g.add(assets.model("bird_body"), left, right);
      b.wl = left;
      b.wr = right;
    });
    cars.splice(0).forEach((c) => { carGroup.remove(c.g); c.bm.dispose(); });
    systems.forEach((sy) => { sy.sig = ""; });
    refreshAll();
    groups.forEach((g) => { if (g.userData.parked) g.userData.parked.visible = !flights.isActive(); });
    syncCars();
    syncTrains();
    planeMeshes.forEach((m, i) => { m.visible = i < flights.planes.length; });
    updateGhost();
  }).catch((err) => { console.error(err); hooks.onError?.("Could not load the detailed models, so simple shapes are shown."); });

  return {
    getState: () => ({ tool, rot, sel, cell: sel ? cellAt(sel.x, sel.z) : null, canUndo: undo.length > 0, canRedo: redo.length > 0, name, hour, traffic: trafficOn, season, activeModel, models: library.list(), extent: sel && cellAt(sel.x, sel.z)?.t === "custom" ? library.extent(cellAt(sel.x, sel.z)) : null }),
    stats() {
      const s = { residents: 0, jobs: 0, roads: 0, green: 0, buildings: 0, farms: 0, drains: 0, flowing: flow.size };
      grid.forEach((row) => row.forEach((c) => {
        if (!c) return;
        const f = c.f || 1;
        const farm = ["field", "paddy", "vegfarm", "orchard", "pasture"].includes(c.t);
        if (farm) { s.farms++; s.jobs += 3; }
        if (c.t === "drain") s.drains++;
        if (["barn", "greenhouse", "treatment"].includes(c.t)) s.jobs += 4;
        if (c.t === "road") s.roads++;
        else if (c.t === "park" || c.t === "tree") s.green++;
        else if (!["water", "rail", "metro", "runway", "apron", "taxiway", "drain", "field", "paddy", "vegfarm", "orchard", "pasture"].includes(c.t)) s.buildings++;
        if (c.t === "house") s.residents += 3 * f;
        if (c.t === "apartment") s.residents += 7 * f;
        if (c.t === "tower") { s.residents += 4 * f; s.jobs += 12 * f; }
        if (c.t === "shop") s.jobs += 6 * f;
        if (c.t === "factory") s.jobs += 20 * f;
        const j = { office: 10, hotel: 4, mall: 10, hospital: 12, school: 8, terminal: 25, warehouse: 8 }[c.t];
        if (j) s.jobs += j * f;
        if (c.t === "hotel") s.residents += 2 * f;
        s.jobs += { gasstation: 4, firestation: 8, church: 3, stadium: 30, hangar: 12, atc: 6, railstation: 5, metrostation: 5, turbine: 1 }[c.t] || 0;
      }));
      return s;
    },
    setTool(t) { tool = t; if (t !== "select") select(null); hoverMesh.material.color.set(t === "bulldoze" ? "#ff5a5a" : t === "select" ? "#ffffff" : "#7CFC8A"); updateGhost(); hooks.onChange?.(); },
    rotate() {
      if (sel && cellAt(sel.x, sel.z) && TYPES[cellAt(sel.x, sel.z).t].rot) { this.patch({ r: ((cellAt(sel.x, sel.z).r || 0) + 1) % 4 }); return; }
      rot = (rot + 1) % 4; updateGhost(); hooks.onChange?.();
    },
    patch(p, coalesce) {
      const c = sel && cellAt(sel.x, sel.z);
      if (!c) return;
      pushHistory(coalesce ? coalesce + sel.x + "," + sel.z : "");
      if (p.t && p.t !== c.t) { const d = defaultCell(p.t); for (const k of Object.keys(c)) delete c[k]; Object.assign(c, d, { r: p.r ?? 0 }); }
      else Object.assign(c, p);
      refreshAround(sel.x, sel.z);
      sizeSelection();
      changed();
    },
    addModel(modelName, text) {
      const id = library.add(modelName, text);
      this.chooseModel(id);
      changed();
      return id;
    },
    chooseModel(id) { activeModel = id; this.setTool("custom"); },
    removeModel(id) {
      for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (grid[z][x]?.m === id) put(x, z, null);
      library.remove(id);
      undo.length = 0; redo.length = 0; // history may refer to the removed model
      if (activeModel === id) { activeModel = null; tool = "select"; updateGhost(); }
      select(null);
      changed();
    },
    /* bulldoze whatever sits under the selected imported model */
    clearUnder() {
      const c = sel && cellAt(sel.x, sel.z);
      if (c?.t !== "custom") return;
      const e = library.extent(c);
      pushHistory();
      for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
        if ((x === sel.x && z === sel.z) || !grid[z][x]) continue;
        if (Math.abs(x - sel.x) < e.w / 2 + 0.45 && Math.abs(z - sel.z) < e.d / 2 + 0.45) put(x, z, null);
      }
      changed();
    },
    removeSelected() { if (!sel) return; pushHistory(); const { x, z } = sel; put(x, z, null); select(null); changed(); },
    deselect: () => select(null),
    undo: () => restore(undo, redo),
    redo: () => restore(redo, undo),
    setTime: (h) => { setTime(h); hooks.onChange?.(); },
    setSeason(v) { applySeason(v); setTime(hour); refreshAll(); updateGhost(); changed(); },
    setTraffic: (on) => { trafficOn = on; syncCars(); hooks.onChange?.(); },
    setName: (n) => { name = n.slice(0, 40); changed(); },
    resetCamera,
    newBase() { pushHistory(); loadGrid(baseCity()); changed(); },
    clear() { pushHistory(); loadGrid(Array.from({ length: N }, () => Array(N).fill(null))); changed(); },
    exportJSON: () => JSON.stringify(save(), null, 1),
    importJSON(text) {
      const raw = JSON.parse(text);
      loadModels(raw);
      const g = sanitize(raw);
      pushHistory();
      if (raw.name) name = String(raw.name).slice(0, 40);
      if (raw.season) { applySeason(raw.season); setTime(hour); }
      loadGrid(g);
      changed();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      clearTimeout(saveTimer);
      ro.disconnect();
      dom.removeEventListener("pointerdown", onDown, true);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerup", onUp);
      dom.removeEventListener("pointerleave", onLeave);
      controls.dispose();
      groups.forEach(disposeGroup);
      library.dispose();
      assets?.dispose();
      envMap.dispose();
      ASSETS = null;
      renderer.dispose();
      dom.remove();
    },
  };
}
