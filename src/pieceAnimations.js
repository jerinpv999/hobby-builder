import * as THREE from "three";
import { BH } from "./hobbyBuilderPieces";

/* Motion for individual pieces. A piece can carry one motion, stored as
   { type, speed, amount, axis, loop, delay, reverse, turn }.
   Everything is a pure function of time, so the live view, the preview and every
   GIF or video frame show exactly the same thing.

   speed is cycles per 4 seconds (so 1 = one cycle every 4 seconds).
   Axes are relative to the piece: "forward" is the way it faces, "side" is to its right, "up" is up. */
export const AXES = [["forward", "Forward"], ["side", "Side"], ["up", "Up"]];
export const MOTIONS = [
  { key: "spin", label: "Spin", hint: "Turns around", axis: true, reverse: true, defAxis: "up" },
  { key: "move", label: "Move", hint: "Slides out and back", axis: true, loop: true, defAxis: "forward", amount: { label: "Distance (studs)", min: 1, max: 16, step: 1, def: 4 } },
  { key: "bob", label: "Bob", hint: "Floats up and down", amount: { label: "Height (studs)", min: 0.25, max: 4, step: 0.25, def: 1 } },
  { key: "swing", label: "Swing", hint: "Rocks back and forth", axis: true, defAxis: "forward", amount: { label: "Angle (degrees)", min: 5, max: 90, step: 5, def: 30 } },
  { key: "orbit", label: "Circle", hint: "Drives in a circle", reverse: true, turn: true, amount: { label: "Radius (studs)", min: 1, max: 8, step: 1, def: 3 } },
  { key: "pulse", label: "Pulse", hint: "Grows and shrinks", amount: { label: "Size change (%)", min: 10, max: 100, step: 10, def: 30 } },
  { key: "blink", label: "Blink", hint: "Switches on and off" },
  { key: "path", label: "Path", hint: "Follows a route you draw on the ground", path: true, turn: true },
];

// waypoints of a drawn path: up to 12 offsets (x, y, z) in studs from where the piece was placed
const cleanPts = (raw) =>
  Array.isArray(raw)
    ? raw
        .slice(0, 12)
        .filter((p) => Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every(Number.isFinite))
        .map((p) => p.slice(0, 3).map((v) => Math.min(40, Math.max(-40, Math.round(v * 4) / 4))))
    : [];

const snap = (v, lo, hi, step, def) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, +(Math.round((v - lo) / step) * step + lo).toFixed(4))) : def;

/* Fill in defaults and clamp anything missing or out of range. Returns null if there is no valid motion. */
export function cleanAnim(raw) {
  if (!raw || typeof raw !== "object") return null;
  const m = MOTIONS.find((x) => x.key === raw.type);
  if (!m) return null;
  return {
    type: m.key,
    speed: snap(raw.speed, 0.25, 4, 0.25, 1),
    delay: snap(raw.delay, 0, 8, 0.5, 0),
    amount: m.amount ? snap(raw.amount, m.amount.min, m.amount.max, m.amount.step, m.amount.def) : 0,
    axis: AXES.some(([k]) => k === raw.axis) ? raw.axis : m.defAxis || "up",
    loop: raw.loop === "repeat" || (raw.loop === "closed" && m.key === "path") ? raw.loop : "pingpong",
    reverse: m.reverse ? raw.reverse === true : false,
    turn: m.turn ? raw.turn !== false : false,
    ...(m.path ? { pts: cleanPts(raw.pts) } : {}),
  };
}
export const newAnim = (type) => cleanAnim({ type });

const UP = new THREE.Vector3(0, 1, 0);

// A smooth curve through the waypoints, starting from the piece's own position
const curves = new Map();
function pathCurve(pts, closed) {
  const key = JSON.stringify([pts, closed]);
  let c = curves.get(key);
  if (!c) {
    const v = [new THREE.Vector3(0, 0, 0), ...pts.map((p) => new THREE.Vector3(...p))];
    const curve = new THREE.CatmullRomCurve3(v, closed, "catmullrom", 0.5);
    c = { curve, len: curve.getLength() };
    if (curves.size > 200) curves.clear();
    curves.set(key, c);
  }
  return c;
}
/* Points along a drawn path (offsets from the piece), for showing the route in the scene. */
export function pathPoints(a, samples = 80) {
  if (!a || a.type !== "path" || !a.pts || !a.pts.length) return [];
  return pathCurve(a.pts, a.loop === "closed").curve.getPoints(samples);
}
const TAU = Math.PI * 2;

/* How a piece is posed at time t (seconds): an offset, a rotation, a scale, a pivot point for
   the rotation and scale (relative to the piece's base centre) and whether it is visible. */
export function poseAt(a, rot, heightLayers, t) {
  const out = { offset: new THREE.Vector3(), q: new THREE.Quaternion(), scale: new THREE.Vector3(1, 1, 1), pivot: new THREE.Vector3(), visible: true };
  const p = Math.max(0, t - a.delay) / (4 / a.speed); // cycles done so far
  const frac = p - Math.floor(p);
  const ang = (rot * Math.PI) / 2;
  const f = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
  const s = new THREE.Vector3(Math.cos(ang), 0, -Math.sin(ang));
  const axis = { forward: f, side: s, up: UP }[a.axis] || UP;
  const dir = a.reverse ? -1 : 1;
  const wave = 0.5 - 0.5 * Math.cos(TAU * p); // 0 -> 1 -> 0 smoothly
  switch (a.type) {
    case "spin":
      out.q.setFromAxisAngle(axis, dir * TAU * p);
      if (a.axis !== "up") out.pivot.set(0, (heightLayers * BH) / 2, 0); // roll about the middle, not the base
      break;
    case "move": {
      const u = a.loop === "repeat" ? frac : 1 - Math.abs(2 * frac - 1);
      out.offset.copy(axis).multiplyScalar(a.amount * u * u * (3 - 2 * u));
      break;
    }
    case "bob":
      out.offset.y = a.amount * wave;
      break;
    case "swing":
      out.q.setFromAxisAngle(axis, ((a.amount * Math.PI) / 180) * Math.sin(TAU * p)); // rocks about its base
      break;
    case "orbit": {
      const th = TAU * p;
      out.offset.copy(f).multiplyScalar(a.amount * Math.sin(th)).addScaledVector(s, dir * a.amount * (1 - Math.cos(th)));
      if (a.turn) out.q.setFromAxisAngle(UP, dir * th); // faces the way it is travelling
      break;
    }
    case "pulse":
      out.scale.setScalar(1 + (a.amount / 100) * wave);
      break;
    case "blink":
      out.visible = frac < 0.5;
      break;
    case "path": {
      if (!a.pts || !a.pts.length) break;
      const { curve, len } = pathCurve(a.pts, a.loop === "closed");
      if (len < 0.01) break;
      const dist = Math.max(0, t - a.delay) * 2 * a.speed; // x1 is 2 studs per second
      let u;
      let fwd = true;
      if (a.loop === "pingpong") {
        const m = (dist / len) % 2;
        fwd = m <= 1;
        u = fwd ? m : 2 - m;
      } else u = (dist / len) % 1;
      u = Math.min(1, Math.max(0, u));
      out.offset.copy(curve.getPointAt(u));
      if (a.turn) {
        const tg = curve.getTangentAt(u);
        if (!fwd) tg.negate();
        if (tg.x * tg.x + tg.z * tg.z > 1e-6) out.q.setFromAxisAngle(UP, Math.atan2(tg.x, tg.z) - ang);
      }
      break;
    }
    default:
  }
  return out;
}

/* Each placed piece sits in a holder group centred on its footprint. userData on the holder:
   anim, rot, h (height in layers), base (resting position), dropY and revealed (set by the video timeline). */
export function applyPieceAnims(group, t) {
  for (const hd of group.children) {
    const a = hd.userData.anim;
    if (!a) continue;
    const r = poseAt(a, hd.userData.rot, hd.userData.h, t);
    const base = hd.userData.base;
    const moved = r.pivot.clone().multiply(r.scale).applyQuaternion(r.q); // where the pivot ends up
    hd.quaternion.copy(r.q);
    hd.scale.copy(r.scale);
    hd.position.set(
      base.x + r.offset.x + r.pivot.x - moved.x,
      base.y + (hd.userData.dropY || 0) + r.offset.y + r.pivot.y - moved.y,
      base.z + r.offset.z + r.pivot.z - moved.z
    );
    hd.visible = hd.userData.revealed !== false && r.visible;
  }
}

/* Put every animated piece back where it was placed. */
export function resetPieceAnims(group, clearDrop = false) {
  for (const hd of group.children) {
    if (clearDrop) hd.userData.dropY = 0;
    if (!hd.userData.anim) continue;
    hd.quaternion.identity();
    hd.scale.set(1, 1, 1);
    hd.position.set(hd.userData.base.x, hd.userData.base.y + (hd.userData.dropY || 0), hd.userData.base.z);
    hd.visible = hd.userData.revealed !== false;
  }
}
