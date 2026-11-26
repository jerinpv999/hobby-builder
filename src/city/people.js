/* Townspeople: who they are, where they walk, and where you may walk. Pure logic, no rendering. */
import { makeProfile } from "./talk.js";

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const SIDEWALK = 0.43; // how far from the middle of a road tile people walk

export function createPeople({ N, cellAt, traffic, rnd = Math.random }) {
  const list = [];
  let nextId = 1;
  const wx = (x) => x - N / 2 + 0.5;
  const walkTile = (x, z) => ["road", "park"].includes(cellAt(x, z)?.t);
  const options = (x, z) => DIRS.map(([dx, dz]) => [x + dx, z + dz]).filter(([a, b]) => walkTile(a, b));
  const tiles = () => {
    const out = [];
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (walkTile(x, z) && options(x, z).length) out.push([x, z]);
    return out;
  };
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  /* the spot on tile (x, z) for someone heading (dx, dz): the right-hand sidewalk, or a park path */
  function spot(x, z, dx, dz, off) {
    const k = cellAt(x, z)?.t === "park" ? off * 0.2 : off;
    return [wx(x) - dz * k, wx(z) + dx * k];
  }

  function choose(p) {
    const all = options(p.x, p.z);
    if (!all.length) return false;
    const onward = all.filter(([a, b]) => !(a === p.px && b === p.pz));
    [p.nx, p.nz] = pick(onward.length ? onward : all);
    [p.tx, p.tz] = spot(p.nx, p.nz, p.nx - p.x, p.nz - p.z, p.off);
    return true;
  }

  function spawn() {
    const all = tiles();
    if (!all.length) return null;
    const [x, z] = pick(all);
    const p = { id: nextId++, ...makeProfile(rnd), x, z, px: -1, pz: -1, off: SIDEWALK - rnd() * 0.035, phase: rnd() * 6, moving: false, talking: false, pause: 0, yaw: 0 };
    p.speed = (p.child ? 0.2 : 0.17) + rnd() * 0.1;
    if (!choose(p)) return null;
    [p.wx, p.wz] = spot(x, z, p.nx - x, p.nz - z, p.off);
    return p;
  }

  function setCount(n) {
    while (list.length > n) list.pop();
    while (list.length < n) {
      const p = spawn();
      if (!p) break;
      list.push(p);
    }
  }

  function step(dt) {
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.moving = false;
      if (p.talking) continue;
      if (!walkTile(p.x, p.z) || !walkTile(p.nx, p.nz)) {
        const fresh = spawn();
        if (fresh) list[i] = fresh;
        continue;
      }
      if (p.pause > 0) { p.pause -= dt; continue; }
      // wait at the kerb until traffic on our axis has the green light
      if (!p.crossing && traffic && traffic.mode(p.nx, p.nz) === "lights") {
        const near = Math.hypot(p.tx - p.wx, p.tz - p.wz) < 0.75;
        if (near && traffic.state(p.nx, p.nz, p.nx === p.x ? "ns" : "ew") !== "green") continue;
        if (near) p.crossing = true;
      }
      const dx = p.tx - p.wx, dz = p.tz - p.wz, dist = Math.hypot(dx, dz), go = p.speed * dt;
      if (dist <= go) {
        p.wx = p.tx; p.wz = p.tz;
        p.px = p.x; p.pz = p.z; p.x = p.nx; p.z = p.nz;
        p.crossing = false;
        if (rnd() < 0.05) p.pause = 1 + rnd() * 3; // stop to look around
        choose(p);
      } else {
        p.wx += (dx / dist) * go; p.wz += (dz / dist) * go;
        p.yaw = Math.atan2(dx, dz);
        p.moving = true;
        p.phase += go * 55;
      }
    }
  }

  return { list, setCount, step, count: () => tiles().length };
}

/* ---------- where a walker may stand ---------- */
const OPEN = new Set(["road", "park", "field", "vegfarm", "orchard", "pasture", "runway", "taxiway", "apron", "rail", "drain", "railstation", "gasstation"]);
const POSTS = { tree: 0.07, metro: 0.13, metrostation: 0.13, turbine: 0.07 }; // only the trunk or pillar is in the way
export const BODY = 0.035;

export function canStand(wxp, wzp, N, cellAt, blockedExtent) {
  if (Math.abs(wxp) > N / 2 - BODY || Math.abs(wzp) > N / 2 - BODY) return false;
  const tx = Math.floor(wxp + N / 2), tz = Math.floor(wzp + N / 2);
  const reach = blockedExtent ? 4 : 1; // imported models can be several tiles wide
  for (let z = tz - reach; z <= tz + reach; z++) for (let x = tx - reach; x <= tx + reach; x++) {
    const c = cellAt(x, z);
    if (!c || OPEN.has(c.t)) continue;
    const dx = wxp - (x - N / 2 + 0.5), dz = wzp - (z - N / 2 + 0.5);
    if (POSTS[c.t]) { if (Math.hypot(dx, dz) < POSTS[c.t] + BODY) return false; continue; }
    let hx = c.t === "water" ? 0.5 : 0.42, hz = hx;
    if (c.t === "custom" && blockedExtent) { const e = blockedExtent(c); hx = e.w * 0.45; hz = e.d * 0.45; }
    if (Math.abs(dx) < hx + BODY && Math.abs(dz) < hz + BODY) return false;
  }
  return true;
}
