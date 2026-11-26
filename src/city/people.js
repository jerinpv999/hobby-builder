/* Townspeople: who they are and where they walk. Pure logic, no rendering. */
import { makeProfile } from "./talk.js";

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const SIDEWALK = 0.43; // how far from the middle of a road tile people walk
// ways to try when the straight line is blocked: ahead, then further and further round, right side first
const TURNS = [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1];
const PATIENCE = 4; // seconds without getting closer before someone turns back

/* blocked(person, x, z) says whether stepping to (x, z) would walk into something */
export function createPeople({ N, cellAt, traffic, blocked = () => false, rnd = Math.random }) {
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
    const k = cellAt(x, z)?.t === "park" ? off * 0.49 : off; // in a park, pass beside the fountain
    return [wx(x) - dz * k, wx(z) + dx * k];
  }

  function choose(p) {
    const all = options(p.x, p.z);
    if (!all.length) return false;
    const onward = all.filter(([a, b]) => !(a === p.px && b === p.pz));
    [p.nx, p.nz] = pick(onward.length ? onward : all);
    aim(p);
    return true;
  }

  function aim(p) {
    [p.tx, p.tz] = spot(p.nx, p.nz, p.nx - p.x, p.nz - p.z, p.off);
    p.best = Infinity;
    p.stall = 0;
  }

  /* give up on this way and head back where we came from */
  function turnBack(p) {
    [p.x, p.z, p.nx, p.nz] = [p.nx, p.nz, p.x, p.z];
    p.px = -1; p.pz = -1;
    p.crossing = false;
    aim(p);
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
      // there, or as near as whoever is standing on the spot allows
      if (dist <= go || (dist < 0.07 && blocked(p, p.tx, p.tz))) {
        if (dist <= go && !blocked(p, p.tx, p.tz)) { p.wx = p.tx; p.wz = p.tz; }
        p.px = p.x; p.pz = p.z; p.x = p.nx; p.z = p.nz;
        p.crossing = false;
        if (rnd() < 0.05) p.pause = 1 + rnd() * 3; // stop to look around
        choose(p);
        continue;
      }
      const ux = dx / dist, uz = dz / dist;
      for (const a of TURNS) {
        const c = Math.cos(a), s = Math.sin(a);
        const vx = ux * c - uz * s, vz = uz * c + ux * s;
        const x = p.wx + vx * go, z = p.wz + vz * go;
        if (!walkTile(Math.floor(x + N / 2), Math.floor(z + N / 2)) || blocked(p, x, z)) continue;
        p.wx = x; p.wz = z;
        p.yaw = Math.atan2(vx, vz);
        p.moving = true;
        p.phase += go * 55;
        break;
      }
      const left = Math.hypot(p.tx - p.wx, p.tz - p.wz);
      if (left < p.best - 0.01) { p.best = left; p.stall = 0; }
      else if ((p.stall += dt) > PATIENCE) turnBack(p);
    }
  }

  return { list, setCount, step, count: () => tiles().length };
}
