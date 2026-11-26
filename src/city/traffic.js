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

export const LENGTHS = { car: 0.2, car_suv: 0.2, car_taxi: 0.2, car_van: 0.23, car_bus: 0.3, car_truck: 0.33 };
const KINDS = ["car", "car", "car", "car_suv", "car_suv", "car_taxi", "car_van", "car_bus", "car_truck"];

export const STOP_AT = 0.38; // how far along the approach a car waits (1 = the middle of the junction)
const COMMIT = 0.18; // a car further along than this when the light turns amber carries on
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/* What a road tile shows: "lights", "warn" or "none". Left on automatic, junctions get traffic lights. */
export function signalMode(cell, roadNeighbours) {
  if (!cell || cell.t !== "road") return "none";
  if (cell.l === "lights" || cell.l === "warn" || cell.l === "none") return cell.l;
  return roadNeighbours >= 3 ? "lights" : "none";
}

export function createTraffic({ N, cellAt, rnd = Math.random }) {
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
      const car = { id: nextId++, kind, len: LENGTHS[kind], x, z, nx, nz, t: rnd() * 0.3, v: 0.8 + rnd() * 0.7, commit: undefined, stopped: false };
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
        limit = Math.min(limit, 1 + o.t - gap(c, o)); // just beyond the next tile
      }
    }
    return Math.max(c.t, limit);
  }

  /* is a car from another road inside the junction at (x, z)? */
  function occupied(c, x, z) {
    return cars.some((o) => {
      if (o === c) return false;
      const entering = o.nx === x && o.nz === z && o.t > STOP_AT + 0.001; // on its way in
      const leaving = o.x === x && o.z === z && o.t < 0.45; // on its way out
      if (entering) return !(o.x === c.x && o.z === c.z); // cars from our own road are handled by spacing
      return leaving && !(o.nx === c.x && o.nz === c.z && o.t > 0.2);
    });
  }

  function step(dt) {
    time += dt;
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
        if (!go && !c.commit && c.t <= STOP_AT) want = Math.min(want, STOP_AT);
      }
      // take turns: don't drive into a junction someone else is crossing
      if (c.t <= STOP_AT && want > STOP_AT && options(c.nx, c.nz).length >= 3 && occupied(c, c.nx, c.nz)) want = STOP_AT;
      const next = room(c, want);
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
