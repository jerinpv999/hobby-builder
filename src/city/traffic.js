/* Road traffic: cars, traffic lights and warning lights. Pure logic (no rendering) so it can be tested. */

// one signal cycle: north-south goes, then east-west, with an all-red pause between
export const PHASES = [
  { ns: "green", ew: "red", secs: 6 },
  { ns: "amber", ew: "red", secs: 1.6 },
  { ns: "red", ew: "red", secs: 1.2 },
  { ns: "red", ew: "green", secs: 6 },
  { ns: "red", ew: "amber", secs: 1.6 },
  { ns: "red", ew: "red", secs: 1.2 },
];
export const CYCLE = PHASES.reduce((s, p) => s + p.secs, 0);

/* The vehicle models were made small, so each is enlarged to suit the people (about 0.17 tall):
   a car roof comes to a person's shoulder, and buses and trucks stand above their heads. */
export const SCALE = { car: 1.8, car_suv: 1.8, car_taxi: 1.8, car_van: 1.9, car_bus: 2.1, car_truck: 1.9 };
const MODEL = { car: [0.104, 0.193], car_suv: [0.104, 0.193], car_taxi: [0.104, 0.193], car_van: [0.1, 0.233], car_bus: [0.111, 0.297], car_truck: [0.102, 0.324] }; // [width, length]
const sized = (i) => Object.fromEntries(Object.entries(MODEL).map(([k, d]) => [k, d[i] * SCALE[k]]));
export const WIDTHS = sized(0);
export const LENGTHS = sized(1);
export const LANE = 0.15; // how far from the middle of the road cars drive
const KINDS = ["car", "car", "car", "car_suv", "car_suv", "car_taxi", "car_van", "car_bus", "car_truck"];

export const STOP_AT = 0.38; // how far along the approach a car waits (1 = the middle of the junction)
const COMMIT = 0.18; // a car further along than this when the light turns amber carries on
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const CORNER = 0.28; // extra room behind a car that has turned

/* What a road tile shows: "lights", "warn" or "none". Left on automatic, junctions get traffic lights. */
export function signalMode(cell, roadNeighbours) {
  if (!cell || cell.t !== "road") return "none";
  if (cell.l === "lights" || cell.l === "warn" || cell.l === "none") return cell.l;
  return roadNeighbours >= 3 ? "lights" : "none";
}

/* long vehicles wait further back, so their front stays behind the stop line */
export const stopAt = (c) => Math.min(STOP_AT, 0.5 - c.len / 2);

/* obstacles() lists the people on foot, as { x, z, r } in world units, that cars must not drive into */
export function createTraffic({ N, cellAt, obstacles = () => [], rnd = Math.random }) {
  const cars = [];
  let time = 0, nextId = 1;
  const isRoad = (x, z) => cellAt(x, z)?.t === "road";
  const options = (x, z) => DIRS.map(([dx, dz]) => [x + dx, z + dz]).filter(([a, b]) => isRoad(a, b));
  const mode = (x, z) => signalMode(cellAt(x, z), options(x, z).length);
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  /* the colour shown to traffic travelling along `axis` ("ns" or "ew") */
  function state(x, z, axis) {
    let t = (time + ((x * 7 + z * 3) % 5) * 3.1) % CYCLE;
    for (const p of PHASES) {
      if (t < p.secs) return p[axis];
      t -= p.secs;
    }
    return "red";
  }

  const roads = () => {
    const out = [];
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (isRoad(x, z)) out.push([x, z]);
    return out;
  };
  const gap = (a, b) => (a.len + b.len) / 2 + 0.07;

  function spawn() {
    const spots = roads().filter(([x, z]) => options(x, z).length);
    if (!spots.length) return null;
    for (let tries = 0; tries < 20; tries++) {
      const [x, z] = pick(spots);
      const [nx, nz] = pick(options(x, z));
      const kind = pick(KINDS);
      const car = { id: nextId++, kind, len: LENGTHS[kind], wid: WIDTHS[kind], x, z, nx, nz, t: rnd() * 0.3, v: 0.8 + rnd() * 0.7, commit: undefined, stopped: false };
      // never appear on top of another car
      if (!cars.some((o) => o.x === x && o.z === z && o.nx === nx && o.nz === nz && Math.abs(o.t - car.t) < gap(o, car))) return car;
    }
    return null;
  }

  function setCount(n) {
    while (cars.length > n) cars.pop();
    while (cars.length < n) {
      const c = spawn();
      if (!c) break;
      cars.push(c);
    }
  }

  /* furthest a car may get along its segment without running into the one ahead */
  function room(c, want) {
    let limit = want;
    for (const o of cars) {
      if (o === c) continue;
      if (o.x === c.x && o.z === c.z && o.nx === c.nx && o.nz === c.nz) {
        if (o.t > c.t || (o.t === c.t && o.id < c.id)) limit = Math.min(limit, o.t - gap(c, o));
      } else if (o.x === c.nx && o.z === c.nz && (!(o.nx === c.x && o.nz === c.z) || options(c.nx, c.nz).length === 1)) {
        // (at a dead end the car coming back out is also ahead of us, because we turn round there)
        // round a corner the two are closer than the distance along the road, so leave more room
        const turning = o.nx - o.x !== c.nx - c.x || o.nz - o.z !== c.nz - c.z;
        limit = Math.min(limit, 1 + o.t - gap(c, o) - (turning ? CORNER : 0)); // just beyond the next tile
      }
    }
    return Math.max(c.t, limit);
  }

  /* is a car from another road inside the junction at (x, z)? */
  function occupied(c, x, z) {
    return cars.some((o) => {
      if (o === c) return false;
      const entering = o.nx === x && o.nz === z && o.t > stopAt(o) + 0.001; // on its way in
      const leaving = o.x === x && o.z === z && o.t < 0.3 + o.len / 2; // on its way out
      if (entering) return !(o.x === c.x && o.z === c.z); // cars from our own road are handled by spacing
      return leaving && !(o.nx === c.x && o.nz === c.z && o.t > 0.2);
    });
  }

  /* stop short of anyone standing or walking in the lane ahead */
  function giveWay(c, want, people) {
    const tx = c.nx - c.x, tz = c.nz - c.z;
    const px = c.x + tx * c.t - N / 2 + 0.5 - tz * LANE, pz = c.z + tz * c.t - N / 2 + 0.5 + tx * LANE;
    let limit = want;
    for (const o of people) {
      const dx = o.x - px, dz = o.z - pz;
      const along = dx * tx + dz * tz, across = Math.abs(dz * tx - dx * tz);
      if (along <= 0 || along > c.len / 2 + 0.6 || across > c.wid / 2 + o.r + 0.012) continue;
      limit = Math.min(limit, c.t + Math.max(0, along - c.len / 2 - o.r - 0.05));
    }
    return Math.max(c.t, limit);
  }

  function step(dt) {
    time += dt;
    const people = obstacles();
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      if (!isRoad(c.x, c.z) || !isRoad(c.nx, c.nz)) {
        const n = spawn();
        if (n) cars[i] = n;
        continue;
      }
      const ahead = mode(c.nx, c.nz);
      let want = c.t + dt * c.v * (ahead === "warn" ? 0.55 : 1); // slow down for a warning light
      if (ahead === "lights") {
        const light = state(c.nx, c.nz, c.nx === c.x ? "ns" : "ew");
        if (light === "amber" && c.commit === undefined) c.commit = c.t > COMMIT;
        if (light === "green") c.commit = undefined;
        if (light === "red") c.commit = false; // red always stops a car that hasn't reached the line
        const go = light === "green" || (light === "amber" && c.commit);
        // a car that had already passed the stop line carries on through
        if (!go && !c.commit && c.t <= stopAt(c)) want = Math.min(want, stopAt(c));
      }
      // take turns: don't drive into a junction someone else is crossing
      if (c.t <= stopAt(c) && want > stopAt(c) && options(c.nx, c.nz).length >= 3 && occupied(c, c.nx, c.nz)) want = stopAt(c);
      const next = giveWay(c, room(c, want), people);
      c.stopped = next - c.t < dt * c.v * 0.2;
      c.t = next;
      if (c.t >= 1) {
        c.t -= 1;
        c.commit = undefined;
        const px = c.x, pz = c.z;
        c.x = c.nx; c.z = c.nz;
        const all = options(c.x, c.z);
        const onward = all.filter(([a, b]) => !(a === px && b === pz));
        if (!all.length) continue;
        [c.nx, c.nz] = pick(onward.length ? onward : all);
      }
    }
  }

  return { cars, state, mode, setCount, step, count: () => roads().length };
}
