/* What is solid in the city, and how close things may get. Pure logic, no rendering.
   A shape is a circle { x, z, r } or a box { x, z, hw, hl, yaw } (half width, half length),
   in world units. h is how tall it is. */
import { tileHeight } from "./flights.js";
import { signalMode } from "./traffic.js";

export const PLAYER_R = 0.035;
export const PERSON_R = 0.024;

/* how far (x, z) is from the edge of a shape; negative inside it */
export function distance(s, x, z) {
  const dx = x - s.x, dz = z - s.z;
  if (s.r !== undefined) return Math.hypot(dx, dz) - s.r;
  const cos = Math.cos(s.yaw || 0), sin = Math.sin(s.yaw || 0);
  const qx = Math.abs(dx * cos - dz * sin) - s.hw, qz = Math.abs(dx * sin + dz * cos) - s.hl;
  return qx > 0 && qz > 0 ? Math.hypot(qx, qz) : Math.max(qx, qz);
}

/* would a body of radius r moving from one point to another push into the shape?
   Moving away is always allowed, so nothing stays stuck if two things end up overlapping. */
export function blocks(s, fromX, fromZ, x, z, r) {
  const d = distance(s, x, z);
  return d < r && d < distance(s, fromX, fromZ) - 1e-7;
}

/* where a body of radius r that overlaps the shape should be moved to, or null if it doesn't */
export function pushOut(s, x, z, r) {
  const d = distance(s, x, z);
  if (d >= r) return null;
  const e = 1e-4;
  let nx = distance(s, x + e, z) - distance(s, x - e, z), nz = distance(s, x, z + e) - distance(s, x, z - e);
  const len = Math.hypot(nx, nz);
  [nx, nz] = len > 1e-9 ? [nx / len, nz / len] : [1, 0];
  return { x: x + nx * (r - d + 1e-4), z: z + nz * (r - d + 1e-4) };
}

/* ---------- what stands on each kind of tile, measured from the tile's centre ---------- */
const rect = (x0, x1, z0, z1, h) => ({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hw: (x1 - x0) / 2, hl: (z1 - z0) / 2, h });
const post = (x, z, r, h) => ({ x, z, r, h });
const CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

// buildings: [x0, x1, z0, z1] of the ground floor (matches blender/make_models.py)
const WALLS = {
  house: [-0.34, 0.34, -0.32, 0.34], apartment: [-0.43, 0.43, -0.43, 0.43], shop: [-0.48, 0.48, -0.35, 0.39],
  tower: [-0.41, 0.41, -0.41, 0.41], office: [-0.41, 0.41, -0.31, 0.31], hotel: [-0.38, 0.38, -0.38, 0.4],
  mall: [-0.49, 0.49, -0.43, 0.44], hospital: [-0.44, 0.44, -0.33, 0.36], school: [-0.48, 0.48, -0.42, 0.14],
  firestation: [-0.43, 0.43, -0.33, 0.33], factory: [-0.48, 0.48, -0.43, 0.43], church: [-0.28, 0.28, -0.43, 0.48],
  warehouse: [-0.48, 0.48, -0.49, 0.49], atc: [-0.19, 0.19, -0.19, 0.19], hangar: [-0.47, 0.47, -0.47, 0.47],
  barn: [-0.38, 0.38, -0.32, 0.32], greenhouse: [-0.46, 0.46, -0.35, 0.35], treatment: [-0.49, 0.49, -0.49, 0.49],
  water: [-0.5, 0.5, -0.5, 0.5], paddy: [-0.5, 0.5, -0.5, 0.5], pasture: [-0.47, 0.47, -0.47, 0.47],
};
const ROUND = { stadium: 0.48, silo: 0.23, turbine: 0.07, tree: 0.05, metro: 0.09, metrostation: 0.09 };
// open ground with a few solid things on it
const PROPS = {
  park: [
    post(0, 0, 0.16, 0.19), // fountain
    ...CORNERS.map(([a, b]) => post(a * 0.31, b * 0.31, 0.035, 0.47)), // trees
    rect(-0.295, -0.145, -0.14, -0.08, 0.1), rect(0.145, 0.295, 0.08, 0.14, 0.1), // benches
    post(0.11, -0.23, 0.01, 0.22), post(-0.11, 0.23, 0.01, 0.22), // lamps
  ],
  orchard: CORNERS.map(([a, b]) => post(a * 0.24, b * 0.24, 0.035, 0.45)),
  gasstation: [
    rect(-0.27, 0.27, -0.48, -0.16, 0.23), // shop
    rect(-0.24, -0.1, 0.03, 0.33, 0.15), rect(0.1, 0.24, 0.03, 0.33, 0.15), // pumps
    ...[-0.33, 0.33].flatMap((x) => [0.01, 0.35].map((z) => post(x, z, 0.018, 0.37))),
    post(0.4, -0.3, 0.016, 0.5), // sign
  ],
  railstation: [rect(0.27, 0.5, -0.35, 0.35, 0.41), ...[-0.3, 0, 0.3].map((z) => post(-0.4, z, 0.012, 0.33))],
};
const PARKED_PLANE = [rect(-0.07, 0.07, -0.45, 0.45, 0.35), rect(-0.49, 0.49, -0.12, 0.1, 0.2)];

/* rotates(type): is the tile drawn turned by cell.r?  extent(cell): size of an imported model.
   planesParked(): are the planes on the stands still ones (not the flying fleet)? */
export function createCollision({ N, cellAt, rotates = () => false, extent, planesParked = () => false }) {
  const road = (x, z) => cellAt(x, z)?.t === "road";

  /* the poles of the traffic or warning lights stand on the pavement corners */
  function poles(cell, x, z) {
    const n = road(x, z - 1), e = road(x + 1, z), s = road(x, z + 1), w = road(x - 1, z);
    if (signalMode(cell, [n, e, s, w].filter(Boolean).length) === "none") return [];
    const none = !n && !e && !s && !w;
    return [[0, 1, n], [0, -1, s], [1, 0, w || none], [-1, 0, e || none]]
      .filter((a) => a[2])
      .map(([dx, dz]) => post((-dx - dz) * 0.43, (-dz + dx) * 0.43, 0.025, 0.58));
  }

  function local(cell, x, z) {
    const { t } = cell;
    if (t === "road") return poles(cell, x, z);
    if (t === "apron") return planesParked() ? PARKED_PLANE : [];
    if (PROPS[t]) return PROPS[t];
    if (WALLS[t]) return [rect(...WALLS[t], tileHeight(cell))];
    if (ROUND[t]) return [post(0, 0, ROUND[t], tileHeight(cell))];
    return []; // fields, runways, drains, railway: open ground
  }

  function shapes(cell, x, z) {
    const cx = x - N / 2 + 0.5, cz = z - N / 2 + 0.5;
    if (cell.t === "custom") {
      const e = extent?.(cell) || { w: 1, d: 1, h: 1 };
      return [{ x: cx, z: cz, hw: e.w * 0.45, hl: e.d * 0.45, h: e.h }];
    }
    const yaw = rotates(cell.t) ? (cell.r || 0) * (Math.PI / 2) : 0;
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    return local(cell, x, z).map((s) => ({ ...s, yaw, x: cx + s.x * cos + s.z * sin, z: cz - s.x * sin + s.z * cos }));
  }

  /* is anything built within r of this point? With y, only things taller than y count. */
  function hit(wxp, wzp, r, y = 0) {
    const tx = Math.floor(wxp + N / 2), tz = Math.floor(wzp + N / 2);
    const reach = 4; // imported models can be several tiles wide
    for (let z = tz - reach; z <= tz + reach; z++) for (let x = tx - reach; x <= tx + reach; x++) {
      const c = cellAt(x, z);
      if (!c || (c.t !== "custom" && (Math.abs(x - tx) > 1 || Math.abs(z - tz) > 1))) continue;
      if (shapes(c, x, z).some((s) => y < s.h && distance(s, wxp, wzp) < r)) return true;
    }
    return false;
  }

  return {
    hit,
    /* may a walker stand here? */
    canStand: (x, z, r = PLAYER_R) => Math.abs(x) <= N / 2 - r && Math.abs(z) <= N / 2 - r && !hit(x, z, r),
  };
}
