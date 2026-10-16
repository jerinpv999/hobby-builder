import { TYPES, settle, cleanOpts, cleanDim, typeDims } from "./hobbyBuilderPieces";
import { cleanAnim } from "./pieceAnimations";

export const MIN_N = 8;
export const MAX_N = 64;
const APP = "hobby-builder";
const OLD_APP = "lego-builder"; // files saved before the rename still load
const MAX_PIECES = 2000;
export const STORAGE_KEY = "hobby-builder:autosave:v1";
const OLD_STORAGE_KEY = "lego-builder:autosave:v1"; // autosave from before the rename

/* The video setup saved with a structure: what the animation shows and how the camera moves.
   { reveal, camMode, pieceAnims, shots: [{theta,phi,radius}], stops: [{x,y,z,yaw,pitch}], stopSecs }.
   Everything is clamped, since the text may come from a hand-edited file. Returns null if nothing usable. */
const num = (v, lo, hi, def) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v * 100) / 100)) : def);
export function cleanSetup(raw) {
  if (!raw || typeof raw !== "object") return null;
  const list = (a, max) => (Array.isArray(a) ? a.slice(0, max).filter((o) => o && typeof o === "object") : []);
  return {
    reveal: raw.reveal === "finished" ? "finished" : "build",
    camMode: ["orbit", "angles", "tour"].includes(raw.camMode) ? raw.camMode : "orbit",
    pieceAnims: raw.pieceAnims !== false,
    shots: list(raw.shots, 8).map((o) => ({ theta: num(o.theta, -100, 100, 0), phi: num(o.phi, 0.2, 1.5, 0.95), radius: num(o.radius, 10, 200, 30) })),
    stops: list(raw.stops, 12).map((o) => ({ x: num(o.x, -200, 200, 0), y: num(o.y, 0.6, 40, 2.4), z: num(o.z, -200, 200, 0), yaw: num(o.yaw, -100, 100, 0), pitch: num(o.pitch, -1.5, 1.5, 0) })),
    stopSecs: num(raw.stopSecs, 1, 10, 3),
  };
}

/* Only the fields needed to rebuild a piece are saved. Size, height and
   stackability are derived from the piece type when loading. */
export function serializeStructure(N, pieces, setup) {
  const animation = cleanSetup(setup);
  return JSON.stringify(
    {
      app: APP,
      version: 1,
      baseSize: N,
      ...(animation ? { animation } : {}),
      pieces: pieces.map(({ type, x, z, y, rot, color, opts, dim, anim }) => ({ type, x, z, y, rot, color, ...(opts ? { opts } : {}), ...(dim ? { dim } : {}), ...(anim ? { anim } : {}) })),
    },
    null,
    2
  );
}

/* Validates everything, since the text may come from a hand-edited file.
   Returns { N, pieces } ready for state, or throws an Error with a readable message. */
export function parseStructure(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (!data || (data.app !== APP && data.app !== OLD_APP) || !Array.isArray(data.pieces))
    throw new Error("This doesn't look like a Hobby Builder file.");
  const N = data.baseSize;
  if (!Number.isInteger(N) || N < MIN_N || N > MAX_N)
    throw new Error(`Baseplate size must be a whole number from ${MIN_N} to ${MAX_N}.`);
  if (data.pieces.length > MAX_PIECES) throw new Error(`Too many pieces (limit ${MAX_PIECES}).`);

  const pieces = data.pieces.map((p, i) => {
    const t = p && TYPES[p.type];
    if (!t) throw new Error(`Piece ${i + 1}: unknown type.`);
    if (![p.x, p.z, p.rot].every(Number.isInteger) || p.rot < 0 || p.rot > 3 || !(p.y >= 0 && p.y * 4 === Math.round(p.y * 4)))
      throw new Error(`Piece ${i + 1}: invalid position or rotation.`);
    if (typeof p.color !== "string" || !/^#[0-9a-f]{6}$/i.test(p.color))
      throw new Error(`Piece ${i + 1}: invalid color.`);
    const opts = t.params ? cleanOpts(t, p.opts) : null; // customizable pieces keep their settings
    const anim = p.anim ? cleanAnim(p.anim) : null; // a piece's own motion, if it has one
    const dim = p.dim ? cleanDim(p.dim) : null; // a stretched size, if the piece was resized
    const dm = typeDims(t, opts, dim);
    const [w, d] = p.rot % 2 ? [dm.d, dm.w] : [dm.w, dm.d];
    if (p.x < 0 || p.z < 0 || p.x + w > N || p.z + d > N)
      throw new Error(`Piece ${i + 1} is outside the baseplate.`);
    return { id: i + 1, type: t.key, rot: p.rot, x: p.x, z: p.z, y: p.y, w, d, h: dm.h, top: dm.top, color: p.color, ...(opts ? { opts } : {}), ...(dim ? { dim } : {}), ...(anim ? { anim } : {}) };
  });
  return { N, pieces: settle(pieces), setup: cleanSetup(data.animation) };
}

/* Read the browser's autosave, or null if there is none or it's unusable. */
export function loadSaved() {
  try {
    const text = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY);
    return text ? parseStructure(text) : null;
  } catch {
    return null;
  }
}

export function autosave(N, pieces, setup) {
  try {
    localStorage.setItem(STORAGE_KEY, serializeStructure(N, pieces, setup));
  } catch {
    /* storage full or blocked: ignore, the app still works */
  }
}
