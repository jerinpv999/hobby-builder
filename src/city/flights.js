/* Airliners: park on plane stands, taxi to the runway, take off, circle, land, taxi back.
   Pure logic (no rendering) so it can be simulated and tested. */
import * as THREE from "three";

const AIR = { runway: 1, taxiway: 1, apron: 1 };
const lerpAng = (a, b, k) => a + ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI) * k;

/* approximate height of what stands on a tile (used for clearance checks) */
export function tileHeight(c) {
  if (!c) return 0;
  const f = c.f || 1;
  switch (c.t) {
    case "house": return f * 0.32 + 0.3;
    case "apartment": return f * 0.28 + 0.14;
    case "shop": return f * 0.3 + 0.1;
    case "tower": return f * 0.3 + (f >= 10 ? 1.7 : 0.1);
    case "office": return f * 0.28 + 0.06;
    case "hotel": return f * 0.27 + 0.1;
    case "mall": return f * 0.3 + 0.1;
    case "hospital": return f * 0.3 + 0.05;
    case "school": return f * 0.28 + 0.6;
    case "firestation": return f * 0.3 + 0.4;
    case "church": return 0.28 * (f === 1 ? 1 : 1.25) + 0.8;
    case "stadium": return 0.18 + f * 0.06 + 0.3;
    case "warehouse": return 0.26 * f + 0.1;
    case "factory": return f * 0.3 + 0.7;
    case "gasstation": return 0.35;
    case "tree": return 0.8 * (0.8 + 0.3 * (f - 1)) + 0.1;
    case "park": return 0.6;
    case "turbine": return 1.4;
    case "atc": return 1.4;
    case "hangar": return 0.35;
    case "terminal": return f * 0.28 + 0.1;
    case "railstation": return 0.5;
    case "metrostation": return 0.95;
    case "metro": return 0.6;
    default: return 0.06;
  }
}

export function createFlights({ N, cellAt, wx }) {
  const planes = [];
  let rw = null, sig = "", owner = null, stands = [], active = false;
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const rand = (a, b) => a + Math.random() * (b - a);
  const wp = (pos, v, o = {}) => ({ pos, v, ...o });

  function findRunway() {
    let best = null;
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      if (cellAt(x, z)?.t !== "runway") continue;
      [[1, 0], [0, 1]].forEach(([dx, dz]) => {
        if (cellAt(x - dx, z - dz)?.t === "runway") return;
        let n = 0;
        while (cellAt(x + dx * n, z + dz * n)?.t === "runway") n++;
        if (n >= 3 && (!best || n > best.n)) best = { x, z, dx, dz, n };
      });
    }
    return best;
  }

  // taxi route from a plane stand to the runway: stand, taxiways..., runway tile
  function taxiPath(r, sx, sz) {
    const key = (x, z) => x + z * N;
    const prev = new Map([[key(sx, sz), null]]);
    const queue = [[sx, sz]];
    while (queue.length) {
      const [x, z] = queue.shift();
      for (const [dx, dz] of DIRS) {
        const nx = x + dx, nz = z + dz, t = cellAt(nx, nz)?.t;
        if (!t || !AIR[t] || prev.has(key(nx, nz))) continue;
        const along = (nx - r.x) * r.dx + (nz - r.z) * r.dz, across = (nx - r.x) * r.dz - (nz - r.z) * r.dx;
        if (t === "runway") {
          if (across !== 0 || along < 0 || along >= r.n) continue;
          prev.set(key(nx, nz), [x, z]);
          const path = [[nx, nz]];
          for (let p = [x, z]; p; p = prev.get(key(p[0], p[1]))) path.unshift(p);
          return { path, k: along };
        }
        if (t === "taxiway") { prev.set(key(nx, nz), [x, z]); queue.push([nx, nz]); }
      }
    }
    return null;
  }

  function setup() {
    const r = findRunway();
    const found = [];
    if (r) {
      for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
        if (cellAt(x, z)?.t !== "apron") continue;
        const tp = taxiPath(r, x, z);
        if (tp && tp.k >= 2) found.push({ x, z, path: tp.path, k: tp.k, busy: false, yaw: 0 });
      }
    }
    const s = r ? [r.x, r.z, r.dx, r.dz, r.n, found.map((q) => q.x + "," + q.z + ":" + q.path.length + ":" + q.k + ":" + (cellAt(q.x, q.z).r || 0)).join(";")].join() : "";
    if (s === sig) return false;
    sig = s;
    active = !!r;
    rw = null; owner = null; planes.length = 0; stands = found;
    if (!r) return true;
    const d = new THREE.Vector3(r.dx, 0, r.dz), pr = new THREE.Vector3(-r.dz, 0, r.dx);
    const a0 = new THREE.Vector3(wx(r.x), 0, wx(r.z)).addScaledVector(d, -0.5);
    rw = { r, d, pr, a0, L: r.n };
    const P = (sv, q, y) => a0.clone().addScaledVector(d, sv).addScaledVector(pr, q).setY(y);
    const T = (x, z, y = 0.1) => new THREE.Vector3(wx(x), y, wx(z));
    stands.forEach((q) => { const c = cellAt(q.x, q.z); q.yaw = Math.atan2(...[[0, 1], [1, 0], [0, -1], [-1, 0]][(c.r || 0) % 4]); });
    const L = rw.L;
    const nPlanes = stands.length ? Math.min(4, stands.length) : 2;
    for (let k = 0; k < nPlanes; k++) planes.push({ k, pos: new THREE.Vector3(), yaw: 0, pitch: 0, roll: 0, q: [], wait: 0, stand: null });

    const alt = (pl) => 7.5 + pl.k * 1.3;
    const lat = (pl) => pl.k * 1.6;
    const circuit = (pl) => [
      wp(P(L + 12, 0, 5.5 + pl.k * 0.4), 7),
      wp(P(L + 22, 12 + lat(pl), alt(pl)), 7),
      ...core(pl),
    ];
    const core = (pl) => [
      wp(P(-34, 12 + lat(pl), alt(pl)), 7),
      wp(P(-44, 2 + lat(pl) / 2, alt(pl)), 7),
      wp(P(-30, 0, alt(pl)), 6.5, { fn: decide }),
    ];
    const freeStand = () => { const f = stands.filter((q) => !q.busy); return f.length ? f[Math.floor(Math.random() * f.length)] : null; };
    function decide(pl) {
      const st = freeStand();
      if (owner || (stands.length && !st)) { pl.q.push(wp(P(-24, 8, alt(pl)), 6.5), ...core(pl)); return; } // go around
      owner = pl;
      pl.q.push(wp(P(1.2, 0, 0.1), 5.5));
      if (!st) { // no stand: touch and go
        pl.q.push(wp(P(L * 0.5, 0, 0.1), 4.5), wp(P(L + 2, 0, 1.8), 6.5, { fn: (p) => { owner = null; p.q.push(...circuit(p)); } }));
        return;
      }
      st.busy = true; pl.stand = st;
      pl.q.push(wp(P(st.k + 0.5, 0, 0.1), 3));
      const taxi = st.path.slice(0, -1).reverse();
      taxi.forEach((t, i) => pl.q.push(wp(T(t[0], t[1]), 1.8, i === 0 ? { fn: () => { owner = null; } } : {})));
      const last = pl.q[pl.q.length - 1];
      const prevFn = last.fn;
      last.fn = (p) => { prevFn && prevFn(p); park(p); };
      last.wait = rand(6, 12);
    }
    function park(pl) { pl.q.push(...takeoff(pl)); }
    function takeoff(pl) {
      const st = pl.stand;
      const out = st.path.slice(0, -1).map((t) => wp(T(t[0], t[1]), 1.8));
      const hold = out[out.length - 1];
      const rt = st.path[st.path.length - 1], ht = st.path[st.path.length - 2];
      // stop a little short of the tile next to the runway so wings clear a plane rolling past
      hold.pos.x += (ht[0] - rt[0]) * 0.4; hold.pos.z += (ht[1] - rt[1]) * 0.4;
      hold.gate = () => owner === null;
      const prevFn = hold.fn;
      hold.fn = (p) => { prevFn && prevFn(p); owner = p; };
      const sj = st.k + 0.5, sl = Math.max(sj + 1, sj + (L - sj) * 0.7);
      return [
        ...out,
        wp(P(sj, 0, 0.1), 1.8, { wait: 1.0, fn: () => { st.busy = false; } }),
        wp(P(sl, 0, 0.1), 5.5),
        wp(P(L + 2, 0, 1.8), 6.5, { fn: (p) => { owner = null; p.stand = null; p.q.push(...circuit(p)); } }),
      ];
    }
    // starting positions
    planes.forEach((pl, i) => {
      if (stands.length) {
        const st = stands[i];
        st.busy = true; pl.stand = st;
        pl.pos.copy(T(st.x, st.z)); pl.yaw = st.yaw;
        pl.q = [wp(pl.pos.clone(), 1, { wait: 2 + i * 6 + rand(0, 3), fn: park })];
      } else {
        pl.pos.copy(P(-30 - i * 14, 0, alt(pl))); pl.yaw = Math.atan2(d.x, d.z);
        pl.q = [wp(P(-30, 0, alt(pl)), 6.5, { fn: decide })];
      }
    });
    return true;
  }

  function step(dt) {
    if (!rw) return;
    const dir = new THREE.Vector3();
    planes.forEach((pl) => {
      const w = pl.q[0];
      if (!w) return;
      dir.subVectors(w.pos, pl.pos);
      const ground = pl.pos.y < 0.25;
      if (pl.wait > 0) pl.wait -= dt;
      else {
        let stepLen = w.v * dt;
        if (!ground) { // in the air: slow down behind another plane, the lower-numbered plane has priority
          const hx = Math.sin(pl.yaw), hz = Math.cos(pl.yaw);
          for (const o of planes) {
            if (o === pl || o.pos.y < 0.25 || Math.abs(o.pos.y - pl.pos.y) > 2.5) continue;
            const ox = o.pos.x - pl.pos.x, oz = o.pos.z - pl.pos.z, dist = Math.hypot(ox, oz);
            if (dist < 3.5 && ((ox * hx + oz * hz) / (dist || 1) > 0.3 || (dist < 1 && o.k < pl.k))) stepLen *= 0.4;
          }
        }
        if (ground) { // keep clear of other planes on the ground
          const hx = Math.sin(pl.yaw), hz = Math.cos(pl.yaw);
          for (const o of planes) {
            if (o === pl || o.pos.y > 0.25 || (o.q[0] && o.q[0].gate)) continue; // planes holding short don't block anyone
            const ox = o.pos.x - pl.pos.x, oz = o.pos.z - pl.pos.z, dist = Math.hypot(ox, oz);
            const lateral = Math.abs(ox * hz - oz * hx);
            if (dist < 2.2 && lateral < 1.1 && (ox * hx + oz * hz) / (dist || 1) > 0.3) stepLen = 0;
          }
        }
        const dist = dir.length();
        if (dist <= stepLen + 1e-6) {
          if (!(w.gate && !w.gate(pl))) {
            pl.pos.copy(w.pos);
            pl.q.shift();
            w.fn && w.fn(pl);
            pl.wait = w.wait || 0;
          }
        } else if (stepLen > 0) pl.pos.addScaledVector(dir, stepLen / dist);
      }
      const n = pl.q[0] || w;
      dir.subVectors(n.pos, pl.pos);
      const hor = Math.hypot(dir.x, dir.z);
      if (hor > 0.02) {
        const before = pl.yaw;
        pl.yaw = lerpAng(pl.yaw, Math.atan2(dir.x, dir.z), Math.min(1, dt * (ground ? 3 : 2.5)));
        pl.roll = THREE.MathUtils.clamp((before - pl.yaw) * 6, -0.5, 0.5);
      }
      const tp = ground && dir.y <= 0.01 ? 0 : Math.atan2(dir.y, hor || 1);
      pl.pitch += (tp - pl.pitch) * Math.min(1, dt * 3);
    });
  }

  return { planes, sync: setup, step, isActive: () => active };
}
