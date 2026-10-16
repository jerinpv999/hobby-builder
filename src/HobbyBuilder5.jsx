import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { getThumb, peekThumb } from "./thumbs";
import { MOTIONS, AXES, cleanAnim, newAnim, applyPieceAnims, resetPieceAnims, pathPoints } from "./pieceAnimations";
import { planAnimation, playPreview, recordGif, recordVideo, downloadBlob } from "./animation";
import { PRESET_VIEWS, PHOTO_SIZES, takePhotos, contactSheet, canvasToBlob } from "./photo";
import { MIN_N, MAX_N, serializeStructure, parseStructure, loadSaved, autosave } from "./structureIO";
import { BH, SH, studGeo, TYPES, GROUPS, buildPiece, stackInfo, settle, typeDims, cleanOpts, cleanDim } from "./hobbyBuilderPieces";

/* ---------- constants ---------- */
const DEFAULT_N = 20; // starting baseplate: N x N studs
const STEP = 4; // each expand/shrink adds or removes this many studs per side

const COLORS = [
  { name: "Red", hex: "#D01012" },
  { name: "Blue", hex: "#0055BF" },
  { name: "Yellow", hex: "#F2CD37" },
  { name: "Green", hex: "#237841" },
  { name: "Orange", hex: "#FE8A18" },
  { name: "Lime", hex: "#A6CA55" },
  { name: "White", hex: "#F4F4F4" },
  { name: "Black", hex: "#1B2A34" },
  { name: "Dark Red", hex: "#72000F" },
  { name: "Bright Light Blue", hex: "#6CB4EE" },
  { name: "Dark Blue", hex: "#0A2940" },
  { name: "Bright Light Yellow", hex: "#FFF289" },
  { name: "Dark Green", hex: "#184923" },
  { name: "Dark Orange", hex: "#A83C00" },
  { name: "Dark Turquoise", hex: "#008B8B" },
  { name: "Light Bluish Gray", hex: "#A3A3A3" },
  { name: "Dark Bluish Gray", hex: "#4C5656" },
  { name: "Sand Green", hex: "#7F9684" },
  { name: "Sand Blue", hex: "#5C768D" },
  { name: "Dark Tan", hex: "#8E764E" },
  { name: "Tan", hex: "#D9C2A3" },
  { name: "Medium Lavender", hex: "#9370DB" },
  { name: "Lavender", hex: "#E6E6FA" },
  { name: "Magenta", hex: "#9B2D55" },
  { name: "Bright Pink", hex: "#FF69B4" },
  { name: "Coral", hex: "#FF6F59" },
  { name: "Nougat", hex: "#D08B5B" },
  { name: "Medium Nougat", hex: "#AA7D55" },
  { name: "Transparent Clear", hex: "#F5F5F5" },
  { name: "Transparent Red", hex: "#E53935" },
  { name: "Transparent Blue", hex: "#1E88E5" },
  { name: "Transparent Green", hex: "#43A047" },
  { name: "Transparent Yellow", hex: "#FDD835" },
  { name: "Gold", hex: "#D4AF37" },
  { name: "Silver", hex: "#C0C0C0" }
];

const groupOf = {};
GROUPS.forEach((g) => g.keys.forEach((k) => (groupOf[k] = g.title)));

function Thumb({ k, color }) {
  const [src, setSrc] = useState(() => peekThumb(k, color));
  useEffect(() => {
    const hit = peekThumb(k, color);
    if (hit) return setSrc(hit);
    const id = setTimeout(() => setSrc(getThumb(k, color)), 0); // staggered so the panel stays responsive
    return () => clearTimeout(id);
  }, [k, color]);
  return <span className="th">{src && <img src={src} alt="" />}</span>;
}

const CSS = `
.lb{display:flex;flex-direction:column;height:100vh;min-height:520px;background:#0F1A33;color:#E8EEF8;font-family:'Trebuchet MS','Segoe UI',sans-serif;font-size:14px}
.lb *{box-sizing:border-box}
.lb button{font:inherit;color:inherit;cursor:pointer}
.lb button:disabled{opacity:.4;cursor:default}
.lb button:focus-visible,.lb input:focus-visible{outline:3px solid #fff;outline-offset:2px}
.lb.busy .tb,.lb.busy .side{pointer-events:none;opacity:.5}
.tb{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:8px 12px;background:#14213D;border-bottom:1px solid #2A3C63}
.brand{font-size:18px}
.grp{display:flex;align-items:center;gap:6px}
.seg{display:flex;align-items:center;border:2px solid #33466b;border-radius:8px;overflow:hidden}
.btn{padding:6px 12px;border-radius:6px;border:2px solid #33466b;background:transparent;font-weight:700}
.seg .btn{border:0;border-radius:0}
.btn:hover:not(:disabled){background:#22365e}
.btn.on{background:#FFD23F;border-color:#FFD23F;color:#14213D}
.btn.accent{border-color:#FFD23F}
.btn.sm{padding:3px 8px}
.lbl{color:#A9B8D4;font-size:12px}
.body{display:flex;flex:1;min-height:0}
.side{width:304px;flex-shrink:0;display:flex;flex-direction:column;background:#14213D;border-right:1px solid #2A3C63;min-height:0}
.sec{padding:10px 12px 4px}
.h{font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#A9B8D4;margin-bottom:6px}
.swatches{display:flex;flex-wrap:wrap;gap:8px}
.sw{width:30px;height:30px;border-radius:50%;border:3px solid transparent;box-shadow:inset 0 0 0 1px rgba(255,255,255,.35)}
.sw.on{border-color:#FFD23F}
.search{width:100%;padding:8px 10px;border-radius:8px;border:2px solid #33466b;background:#0F1A33;color:inherit;font:inherit}
.cats{display:flex;gap:6px;overflow-x:auto;padding:8px 12px;flex-shrink:0}
.chip{flex-shrink:0;white-space:nowrap;padding:4px 10px;border-radius:999px;border:2px solid #33466b;background:transparent;font-size:13px}
.chip.on{background:#FFD23F;border-color:#FFD23F;color:#14213D;font-weight:700}
.grid{flex:1;min-height:0;overflow-y:auto;padding:4px 12px 12px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;align-content:start}
.card{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 4px;border-radius:8px;border:2px solid #2A3C63;background:#1B2B4D}
.card:hover{border-color:#5B74A6}
.card.on{border-color:#FFD23F;background:#26396A}
.th{display:block;width:64px;height:64px}
.th img{display:block;width:100%;height:100%}
.nm{font-size:12px;text-align:center;line-height:1.2}
.empty{grid-column:1/-1;color:#A9B8D4;padding:16px 4px}
.stage{position:relative;flex:1;min-width:0}
.canvas{position:absolute;inset:0}
.status{position:absolute;left:12px;right:12px;bottom:12px;display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:8px 12px;border-radius:10px;background:rgba(20,33,61,.92);pointer-events:none}
.status .dot{width:14px;height:14px;border-radius:50%;border:2px solid #fff}
.status .hint{margin-left:auto;color:#A9B8D4}
.drawer{position:absolute;top:12px;right:12px;width:290px;max-height:calc(100% - 90px);overflow-y:auto;padding:12px;border-radius:12px;background:#14213D;border:1px solid #33466b;box-shadow:0 8px 24px rgba(0,0,0,.35)}
.row{display:flex;gap:8px;margin-bottom:10px}
.row .btn{flex:1}
.shot{display:flex;align-items:center;gap:6px;margin-bottom:6px}
.shot span{flex:1}
.note{font-size:12px;color:#A9B8D4;margin:4px 0 0}
.toast{position:absolute;top:12px;left:50%;transform:translateX(-50%);max-width:80%;padding:8px 14px;border-radius:8px;background:#14213D;border:1px solid #FFD23F}
.bar{height:8px;background:#33466b;border-radius:4px;overflow:hidden}
.bar>div{height:100%;background:#FFD23F}
@media (max-width:760px){.body{flex-direction:column-reverse}.side{width:auto;height:44%;border-right:0;border-top:1px solid #2A3C63}.hint{display:none}.grid{grid-template-columns:repeat(4,1fr)}}
`;

// lamp strength in the scene: newer versions of three.js measure light differently
const PHYS = parseInt(THREE.REVISION, 10) >= 155;
const LIGHT_K = PHYS ? 40 : 1.6;
const LIGHT_DECAY = PHYS ? 1.4 : 1;
const MAX_LIGHTS = 8; // real lights are costly, so only the brightest lamps light the scene

/* The controls for a customizable piece's settings (sliders, choices, switches). */
function ParamControls({ params, opts, onChange }) {
  return params.map((pr) =>
    pr.kind === "num" ? (
      <label className="prm" key={pr.key}>
        <span>{pr.label}</span>
        <input type="range" min={pr.min} max={pr.max} step={pr.step} value={opts[pr.key]} onChange={(e) => onChange(pr.key, Number(e.target.value))} />
        <output>{opts[pr.key]}</output>
      </label>
    ) : pr.kind === "sel" ? (
      <div className="prm sel" key={pr.key}>
        <span>{pr.label}</span>
        <div className="chips">
          {pr.options.map(([val, lab]) => (
            <button key={val} className={"chip sm" + (opts[pr.key] === val ? " on" : "")} aria-pressed={opts[pr.key] === val} onClick={() => onChange(pr.key, val)}>{lab}</button>
          ))}
        </div>
      </div>
    ) : (
      <label className="prm tog" key={pr.key}>
        <input type="checkbox" checked={opts[pr.key]} onChange={(e) => onChange(pr.key, e.target.checked)} />
        <span>{pr.label}</span>
      </label>
    )
  );
}

/* Width, length and height sliders that stretch any piece to a custom size. */
function DimControls({ dim, base, onChange, onReset }) {
  const cur = dim || base;
  const row = (key, label, min, max, step) => (
    <label className="prm">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={cur[key]} onChange={(e) => onChange({ [key]: Number(e.target.value) })} />
      <output>{cur[key]}</output>
    </label>
  );
  return (
    <>
      {row("w", "Width", 1, 16, 1)}
      {row("d", "Length", 1, 16, 1)}
      {row("h", "Height", 0.25, 8, 0.25)}
      <button className="btn sm" onClick={onReset} disabled={!dim}>Reset size</button>
    </>
  );
}

const SHORTCUTS = [
  ["Build and edit", [
    ["B", "Build mode"], ["X", "Remove mode"], ["S", "Select mode"], ["Space / Enter", "Place, remove or select at the cursor"],
    ["R", "Rotate the piece"], ["Shift+R", "Rotate the other way"], ["Ctrl+Z", "Undo"],
    ["Ctrl+Y or Ctrl+Shift+Z", "Redo"], ["Shift+Delete", "Clear everything"], ["Esc", "Back to build mode"],
  ]],
  ["Pieces and colors", [
    ["[ and ]", "Previous / next category"], [", and .", "Previous / next piece"],
    ["C / Shift+C", "Next / previous color"], ["/ or Ctrl+K", "Search pieces"],
  ]],
  ["Camera", [
    ["1 2 3 4", "Front, Side, Top, Iso view"], ["0", "Reset the view"], ["Arrow keys", "Rotate and tilt (Shift = bigger steps)"],
    ["Z / Shift+Z", "Zoom in / out"], ["F", "Walk mode on / off"], ["W A S D", "Walk (in walk mode)"],
    ["Q / E", "Down / up (in walk mode)"], ["← →", "Turn (in walk mode)"], ["Shift", "Move faster (in walk mode)"],
  ]],
  ["Baseplate and files", [
    ["+ or =", "Expand the baseplate"], ["- or _", "Shrink the baseplate"], ["Ctrl+S", "Save JSON"], ["Ctrl+O", "Load JSON"],
  ]],
  ["Animation", [
    ["M", "Open / close the Animate panel"], ["U", "Pieces: build-up / finished"], ["O", "Camera: Orbit, Angles, Home tour"],
    ["K", "Save a camera angle or tour stop"], ["P", "Preview"], ["G", "Export GIF"], ["V", "Export video"], ["Esc", "Cancel a running export"],
  ]],
  ["Photos", [
    ["J", "Take a photo of the current view"], ["Shift+J", "Open / close the Photos panel"],
  ]],
  ["Select pieces (S)", [
    ["Click", "Select a piece"], ["Shift+click", "Add or remove a piece"], ["Shift+drag", "Box-select (Ctrl+Shift+drag adds)"],
    ["Ctrl+A", "Select everything"], ["Arrow keys", "Move the selection (Shift = 4 studs)"], ["R / Shift+R", "Turn the selected pieces"],
    ["Ctrl+D", "Duplicate"], ["Delete", "Delete the selected pieces"], ["Esc", "Clear the selection"],
  ]],
  ["Light", [["N", "Day / night"]]],
  ["Piece motion", [
    ["A", "Motion tab for the selected pieces"], ["T", "Play / pause piece motion"], ["Y / Shift+Y", "Cycle the motion type"],
    ["I", "Cycle the direction (forward, side, up)"], ["{ and }", "Speed  - and +"], ["< and >", "Distance, angle or size  - and +"],
    ["( and )", "Delay  - and +"], ["L", "Reverse, or go-and-return / repeat"]
  ]],
  ["Customize roofs", [
    ["{ and }", "Width / ridge length  - and +"], ["< and >", "Length / span  - and +"], ["( and )", "Thickness / ridge height  - and +"],
    ["Y / Shift+Y", "Cycle the surface"], ["I / Shift+I", "Cycle the edge or roof shape"], ["L", "Skylight / ridge cap on or off"],
  ]],
  ["Help", [["? or H", "Show this list"]]],
];

const HELP_CSS = `
.overlay{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,10,25,.7)}
.help{width:min(900px,100%);max-height:100%;overflow-y:auto;padding:18px 20px;border-radius:14px;background:#14213D;border:1px solid #33466b;box-shadow:0 12px 40px rgba(0,0,0,.5)}
.help h2{margin:0 0 4px;font-size:20px}
.help .cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px 24px;margin-top:12px}
.help h3{margin:0 0 6px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#A9B8D4}
.help ul{margin:0;padding:0;list-style:none}
.help li{display:flex;justify-content:space-between;gap:12px;padding:3px 0;font-size:13px}
.help kbd{flex-shrink:0;padding:1px 7px;border-radius:5px;border:1px solid #5B74A6;background:#0F1A33;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;white-space:nowrap}
.help li span{text-align:right}
.custom{position:absolute;z-index:2;top:12px;left:12px;width:270px;max-height:calc(100% - 90px);overflow-y:auto;padding:10px 12px;border-radius:12px;background:rgba(20,33,61,.96);border:1px solid #33466b;box-shadow:0 8px 24px rgba(0,0,0,.35)}
.prm{display:grid;grid-template-columns:96px 1fr 34px;align-items:center;gap:6px;margin:7px 0;font-size:13px}
.prm input[type=range]{width:100%;margin:0}
.prm output{text-align:right;font-variant-numeric:tabular-nums}
.prm.sel{display:block}
.prm.sel>span{display:block;margin-bottom:4px}
.prm.tog{display:flex;gap:8px}
.chips{display:flex;flex-wrap:wrap;gap:4px}
.chip.sm{padding:2px 8px;font-size:12px}
.badge{padding:0 6px;border-radius:999px;background:#FFD23F;color:#14213D;font-size:10px;font-weight:700}
.custom summary{cursor:pointer;font-size:13px;margin:6px 0}
.movepad{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:6px}
.pt{display:grid;grid-template-columns:20px repeat(3,1fr) 26px;gap:4px;align-items:center;margin:3px 0;font-size:12px}
.pt input{width:100%;padding:2px 4px;background:#0F1A33;color:inherit;border:1px solid #33466b;border-radius:4px}
.album{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-height:180px;overflow:auto;margin-top:6px}
.shotimg{padding:0;border:1px solid #33466b;border-radius:6px;background:#0F1A33;color:inherit;cursor:pointer;overflow:hidden;font-size:11px;text-align:center}
.shotimg img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover}
.shotimg span{display:block;padding:2px 0}
.marquee{position:absolute;z-index:1;border:2px dashed #FFD23F;background:rgba(255,210,63,.12);pointer-events:none}
`;

/* ---------- component ---------- */
export default function HobbyBuilder() {
  const mountRef = useRef(null);
  const three = useRef({});
  const live = useRef({});
  const [init] = useState(loadSaved); // restored from the browser autosave, if any
  const idCounter = useRef(init ? init.pieces.length : 0);
  const fileRef = useRef(null);
  const [note, setNote] = useState("");
  const [anim, setAnim] = useState(init?.setup?.reveal || "build"); // pieces: "build" or "finished"
  const [camMode, setCamMode] = useState(init?.setup?.camMode || "orbit"); // camera: "orbit", "angles" or "tour"
  const [shots, setShots] = useState(init?.setup?.shots || []); // saved camera angles: { theta, phi, radius }
  const [walkMode, setWalkMode] = useState(false); // first-person camera
  const [stops, setStops] = useState(init?.setup?.stops || []); // home tour stops: { x, y, z, yaw, pitch }
  const [stopSecs, setStopSecs] = useState(init?.setup?.stopSecs || 3); // seconds between tour stops
  const [busy, setBusy] = useState(""); // "" | "gif" | "video" | "preview"
  const [progress, setProgress] = useState(0);
  const cancelRef = useRef({ v: false });
  const [cat, setCat] = useState(GROUPS[0].title); // piece category shown in the picker
  const [query, setQuery] = useState(""); // piece search text
  const [animOpen, setAnimOpen] = useState(false); // animation panel
  const [helpOpen, setHelpOpen] = useState(false); // keyboard shortcut list
  const [optsByType, setOptsByType] = useState({}); // chosen settings for customizable pieces, per piece type
  const [selIds, setSelIds] = useState([]); // pieces picked in Select mode
  const [selTab, setSelTab] = useState("edit"); // tab of the selection card
  const [moveStep, setMoveStep] = useState(1); // studs moved per click
  const [marquee, setMarquee] = useState(null); // the box being dragged in Select mode
  const [pathPick, setPathPick] = useState(false); // clicking the ground adds motion-path points
  const [dimByType, setDimByType] = useState({}); // stretched size chosen for a piece type
  const [daylight, setDaylight] = useState(1); // 0 = night, 1 = day
  const [playing, setPlaying] = useState(false); // piece motion playing in the live view
  const [animPieces, setAnimPieces] = useState(init?.setup?.pieceAnims !== false); // include piece motion in previews and exports
  const [photoOpen, setPhotoOpen] = useState(false); // photos panel
  const [photoPick, setPhotoPick] = useState(["front", "right", "back", "left", "iso"]); // chosen angles
  const [photoSize, setPhotoSize] = useState(2); // 1, 2 or 4 times the screen size
  const [photoSheet, setPhotoSheet] = useState(false); // also make one picture with all the angles
  const [album, setAlbum] = useState([]); // photos taken this session: { id, name, url, blob }
  const photoId = useRef(0);
  const lastMotionEdit = useRef({ id: null, t: 0 });
  const coalesce = useRef(false); // merges a run of slider changes into one undo step
  const actions = useRef({}); // latest action functions, so keyboard shortcuts never use stale state

  const [N, setN] = useState(init ? init.N : DEFAULT_N);
  const [bricks, setBricks] = useState(init ? init.pieces : []);
  const past = useRef([]); // undo / redo history of { N, bricks }
  const future = useRef([]);
  const prevState = useRef({ N: init ? init.N : DEFAULT_N, bricks: init ? init.pieces : [] });
  const skipHistory = useRef(false);
  const [hist, setHist] = useState({ undo: 0, redo: 0 });
  const [color, setColor] = useState(COLORS[0].hex);
  const [typeKey, setTypeKey] = useState("b2x4");
  const [rot, setRot] = useState(0);
  const [mode, setMode] = useState("build");

  const type = TYPES[typeKey];
  const opts = type.params ? cleanOpts(type, optsByType[typeKey]) : null; // null for ordinary pieces
  const dim = dimByType[typeKey] || null; // stretched size, if any
  const baseDm = typeDims(type, opts); // size before stretching
  const dm = typeDims(type, opts, dim); // footprint, height and stackability for these settings
  const [w, d] = rot % 2 ? [dm.d, dm.w] : [dm.w, dm.d];
  live.current = { N, bricks, color, type, rot, w, d, dm, opts, dim, mode, pathPick };

  /* scene setup (once) */
  useEffect(() => {
    const el = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#CFE3F0");

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight("#ffffff", "#8aa1b4", 0.8);
    scene.add(hemi);
    const lightGroup = new THREE.Group(); // lamps the user has placed
    scene.add(lightGroup);
    const sun = new THREE.DirectionalLight("#ffffff", 0.9);
    sun.position.set(14, 26, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 70 });
    scene.add(sun);

    /* baseplate lives in a group; it is rebuilt whenever N changes */
    const base = new THREE.Group();
    scene.add(base);

    const brickGroup = new THREE.Group();
    scene.add(brickGroup);

    /* orbit camera (hand-rolled so no extra imports are needed) */
    const orbit = { theta: 0.8, phi: 0.95, radius: 30 };
    const updateCamera = () => {
      const { theta, phi, radius } = orbit;
      camera.position.set(
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.cos(theta)
      );
      camera.lookAt(0, 1.5, 0);
    };
    updateCamera();

    /* first-person walk camera for home tours. yaw 0 looks toward -z; positive yaw turns right. */
    const walk = { active: false, started: false, pos: new THREE.Vector3(0, 2.4, 14), yaw: 0, pitch: 0, keys: new Set(), last: performance.now() };
    const forwardOf = (yaw, pitch) =>
      new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    const applyWalk = () => {
      camera.position.copy(walk.pos);
      camera.lookAt(walk.pos.clone().add(forwardOf(walk.yaw, walk.pitch)));
    };

    const resize = () => {
      const r = el.getBoundingClientRect();
      renderer.setSize(r.width, r.height);
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    /* picking */
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pick = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.intersectObjects([base, brickGroup], true)[0] || null;
    };

    const updateHover = (e) => {
      const { N, bricks, w, d, mode } = live.current;
      const ghost = three.current.ghost;
      if (walk.active) {
        if (ghost) ghost.visible = false;
        return;
      }
      const hit = pick(e);
      if (!hit || mode !== "build") {
        three.current.hover = null;
        if (ghost) ghost.visible = false;
        return;
      }
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      const p = hit.point.clone().addScaledVector(n, 0.1);
      const x = Math.min(Math.max(Math.round(p.x + N / 2 - w / 2), 0), Math.max(0, N - w));
      const z = Math.min(Math.max(Math.round(p.z + N / 2 - d / 2), 0), Math.max(0, N - d));
      const { lvl: y, blocked } = stackInfo(bricks, x, z, w, d);
      three.current.hover = { x, z, y, ok: !blocked };
      if (ghost) {
        ghost.position.set(x - N / 2, y * BH, z - N / 2);
        ghost.visible = true;
        three.current.ghostMat.color.set(blocked ? "#FF4D4D" : live.current.color);
      }
    };

    let down = null;
    const dom = renderer.domElement;
    dom.style.touchAction = "none";
    const onDown = (e) => {
      down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, box: live.current.mode === "select" && e.shiftKey && !walk.active, add: e.ctrlKey || e.metaKey };
      dom.setPointerCapture(e.pointerId);
    };
    const onMove = (e) => {
      three.current.lastPointer = { clientX: e.clientX, clientY: e.clientY }; // for Space / Enter placement
      if (down) {
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) down.moved = true;
        if (down.moved) {
          if (down.box) {
            const r = dom.getBoundingClientRect(); // Shift+drag draws a selection box instead of orbiting
            setMarquee({ x0: down.x - r.left, y0: down.y - r.top, x1: e.clientX - r.left, y1: e.clientY - r.top });
          } else if (walk.active) {
            walk.yaw -= (e.clientX - down.lx) * 0.004; // drag like Street View: the scene follows your pointer
            walk.pitch = Math.min(1.3, Math.max(-1.3, walk.pitch + (e.clientY - down.ly) * 0.004));
            applyWalk();
          } else {
            orbit.theta -= (e.clientX - down.lx) * 0.008;
            orbit.phi = Math.min(1.5, Math.max(0.2, orbit.phi - (e.clientY - down.ly) * 0.008));
            updateCamera();
          }
        }
        down.lx = e.clientX;
        down.ly = e.clientY;
        if (down.moved && three.current.ghost) three.current.ghost.visible = false;
        return;
      }
      updateHover(e);
    };
    const removeAt = (e) => {
      const hit = pick(e);
      const id = hit && hit.object.userData.id;
      if (id) setBricks((prev) => settle(prev.filter((b) => b.id !== id)));
    };
    const selectAt = (e) => {
      const hit = pick(e);
      if (live.current.pathPick) {
        if (hit) actions.current.addPathWorldPoint(hit.point.x, hit.point.y, hit.point.z); // draw a motion path on the ground
        return;
      }
      const id = hit && hit.object.userData.id ? hit.object.userData.id : null;
      const add = e.shiftKey || e.ctrlKey || e.metaKey;
      setSelIds((prev) => {
        if (!id) return add ? prev : [];
        if (add) return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        return [id];
      });
    };
    const placeAt = (e) => {
      const { color, type, rot, w, d, dm, opts, dim } = live.current;
      updateHover(e);
      const h = three.current.hover;
      if (h && h.ok)
        setBricks((prev) => {
          const { lvl, blocked } = stackInfo(prev, h.x, h.z, w, d);
          if (blocked) return prev;
          return [
            ...prev,
            { id: ++idCounter.current, type: type.key, rot, x: h.x, z: h.z, y: lvl, w, d, h: dm.h, top: dm.top, color, ...(opts ? { opts } : {}), ...(dim ? { dim } : {}) },
          ];
        });
    };
    const boxSelect = (d0, e) => {
      const r = dom.getBoundingClientRect();
      const x0 = Math.min(d0.x, e.clientX) - r.left;
      const x1 = Math.max(d0.x, e.clientX) - r.left;
      const y0 = Math.min(d0.y, e.clientY) - r.top;
      const y1 = Math.max(d0.y, e.clientY) - r.top;
      const ids = [];
      brickGroup.children.forEach((hd) => {
        const bs = hd.userData.base;
        const v = new THREE.Vector3(bs.x, bs.y + (hd.userData.h * BH) / 2, bs.z).project(camera); // the piece's middle on screen
        const sx = ((v.x + 1) / 2) * r.width;
        const sy = ((1 - v.y) / 2) * r.height;
        if (v.z < 1 && sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) ids.push(hd.userData.pid);
      });
      setSelIds((prev) => (d0.add ? [...new Set([...prev, ...ids])] : ids));
    };
    const onUp = (e) => {
      const d0 = down;
      down = null;
      if (d0 && d0.box) setMarquee(null);
      if (d0 && d0.box && d0.moved) {
        boxSelect(d0, e);
        return;
      }
      const wasClick = d0 && !d0.moved;
      if (!wasClick || walk.active) return; // no placing while walking
      if (live.current.mode === "remove") removeAt(e);
      else if (live.current.mode === "select") selectAt(e);
      else placeAt(e);
    };
    const onLeave = () => {
      three.current.lastPointer = null;
      if (three.current.ghost) three.current.ghost.visible = false;
    };
    const onWheel = (e) => {
      e.preventDefault();
      if (walk.active) {
        walk.pos.addScaledVector(forwardOf(walk.yaw, 0), -e.deltaY * 0.01);
        applyWalk();
        return;
      }
      orbit.radius = Math.min(40 + live.current.N * 1.5, Math.max(10, orbit.radius + e.deltaY * 0.02));
      updateCamera();
    };
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("pointerleave", onLeave);
    dom.addEventListener("wheel", onWheel, { passive: false });

    let raf;
    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - walk.last) / 1000);
      walk.last = now;
      if (walk.active && !three.current.recording) {
        const k = walk.keys;
        const step = (k.has("shift") ? 14 : 6) * dt;
        const f = forwardOf(walk.yaw, 0);
        const right = new THREE.Vector3(-f.z, 0, f.x);
        if (k.has("w") || k.has("arrowup")) walk.pos.addScaledVector(f, step);
        if (k.has("s") || k.has("arrowdown")) walk.pos.addScaledVector(f, -step);
        if (k.has("d")) walk.pos.addScaledVector(right, step);
        if (k.has("a")) walk.pos.addScaledVector(right, -step);
        if (k.has("e")) walk.pos.y += step;
        if (k.has("q")) walk.pos.y -= step;
        if (k.has("arrowright")) walk.yaw += 1.6 * dt;
        if (k.has("arrowleft")) walk.yaw -= 1.6 * dt;
        walk.pos.y = Math.min(40, Math.max(0.6, walk.pos.y));
        applyWalk();
      }
      if (!three.current.recording) {
        const tc = three.current;
        if (tc.playing) applyPieceAnims(brickGroup, (now - tc.playStart) / 1000); // piece motion
        if (tc.selBoxes) tc.selBoxes.forEach((bx) => bx.update()); // not set yet on the very first frame
        renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    three.current = { scene, camera, renderer, brickGroup, base, sun, orbit, updateCamera, walk, applyWalk, placeAt, removeAt, selectAt, hemi, lightGroup, playing: false, playStart: 0, selBoxes: [], pathViz: null, lastPointer: null, ghost: null, hover: null };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerup", onUp);
      dom.removeEventListener("pointerleave", onLeave);
      dom.removeEventListener("wheel", onWheel);
      renderer.dispose();
      el.removeChild(dom);
    };
  }, []);

  /* undo / redo history: every change to the pieces or baseplate size is one step */
  useEffect(() => {
    if (prevState.current.N === N && prevState.current.bricks === bricks) return;
    if (skipHistory.current) skipHistory.current = false; // this change came from undo or redo
    else if (coalesce.current) coalesce.current = false; // a run of slider changes counts as one step
    else {
      past.current.push(prevState.current);
      if (past.current.length > 100) past.current.shift();
      future.current = [];
    }
    prevState.current = { N, bricks };
    setHist({ undo: past.current.length, redo: future.current.length });
  }, [N, bricks]);

  /* keyboard shortcuts (the list is also shown in the help window) */
  useEffect(() => {
    const MOVE = ["w", "a", "s", "d", "q", "e", "shift", "arrowup", "arrowdown", "arrowleft", "arrowright"];
    const onKeyDown = (e) => {
      const t = three.current;
      const A = actions.current;
      const k = e.key.toLowerCase();
      if (e.target.closest && e.target.closest("input,select,textarea")) {
        if (k === "escape") e.target.blur(); // leave the search box
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (A.busy && k !== "escape" && k !== "?" && !(k === "h" && !mod)) return; // exporting: only Esc and help
      if (t.walk && t.walk.active && !mod && MOVE.includes(k)) {
        if (k.startsWith("arrow")) e.preventDefault();
        t.walk.keys.add(k);
        return;
      }
      if (mod) {
        const map = { z: () => (e.shiftKey ? A.redo() : A.undo()), y: A.redo, s: A.save, o: A.openFile, k: A.focusSearch, a: A.selectAll, d: A.duplicate };
        if (map[k]) {
          e.preventDefault();
          map[k]();
        }
        return;
      }
      if (e.altKey) return;
      const onCanvas = e.target === document.body || (t.renderer && e.target === t.renderer.domElement);
      const go = (fn) => {
        e.preventDefault();
        fn();
      };
      switch (k) {
        case "b": return A.setMode("build");
        case "a": return A.motionTab();
        case "s": return A.setMode("select");
        case "n": return A.night();
        case "t": return A.play();
        case "x": return A.setMode("remove");
        case "r": return A.rotate(e.shiftKey ? -1 : 1);
        case " ":
        case "enter": return onCanvas && go(A.actAtPointer);
        case "delete":
        case "backspace": return e.shiftKey ? go(A.clear) : A.deleteSel();
        case "escape": return A.escape();
        case "[": return A.category(-1);
        case "]": return A.category(1);
        case ",": return A.piece(-1);
        case ".": return A.piece(1);
        case "c": return A.color(e.shiftKey ? -1 : 1);
        case "/": return go(A.focusSearch);
        case "1": case "2": case "3": case "4": return A.view(Number(k) - 1);
        case "0": return A.resetView();
        case "arrowleft": return go(() => (A.hasSel ? A.moveSel(-1, 0, e.shiftKey) : A.orbitBy(-1, 0, e.shiftKey)));
        case "arrowright": return go(() => (A.hasSel ? A.moveSel(1, 0, e.shiftKey) : A.orbitBy(1, 0, e.shiftKey)));
        case "arrowup": return go(() => (A.hasSel ? A.moveSel(0, -1, e.shiftKey) : A.orbitBy(0, -1, e.shiftKey)));
        case "arrowdown": return go(() => (A.hasSel ? A.moveSel(0, 1, e.shiftKey) : A.orbitBy(0, 1, e.shiftKey)));
        case "z": return A.zoom(e.shiftKey ? 1 : -1);
        case "f": return A.walk();
        case "+": case "=": return A.plate(1);
        case "-": case "_": return A.plate(-1);
        case "m": return A.toggleAnim();
        case "j": return e.shiftKey ? A.togglePhotos() : A.snap();
        case "u": return A.toggleReveal();
        case "o": return A.cycleCamera();
        case "k": return A.keyframe();
        case "p": return A.run("preview");
        case "g": return A.run("gif");
        case "v": return A.run("video");
        case "{": return A.customize("num", 0, -1);
        case "}": return A.customize("num", 0, 1);
        case "<": return A.customize("num", 1, -1);
        case ">": return A.customize("num", 1, 1);
        case "(": return A.customize("num", 2, -1);
        case ")": return A.customize("num", 2, 1);
        case "y": return A.customize("sel", 0, e.shiftKey ? -1 : 1);
        case "i": return A.customize("sel", 1, e.shiftKey ? -1 : 1);
        case "l": return A.customize("tog", 0, 1);
        case "?": case "h": return A.toggleHelp();
        default: return undefined;
      }
    };
    const onKeyUp = (e) => three.current.walk && three.current.walk.keys.delete(e.key.toLowerCase());
    const onBlur = () => three.current.walk && three.current.walk.keys.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  /* keep the selected piece card in view when it changes by keyboard */
  useEffect(() => {
    const el = document.querySelector(".card.on");
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [typeKey, cat]);

  /* rebuild placed bricks when state changes */
  useEffect(() => {
    const { brickGroup } = three.current;
    if (!brickGroup) return;
    brickGroup.clear();
    for (const b of bricks) {
      const g = buildPiece(TYPES[b.type], b.color, b.id, b.rot, null, b.opts, b.dim);
      // each piece sits in a holder centred on its footprint, so motion can turn and scale it about its middle
      const holder = new THREE.Group();
      const base = new THREE.Vector3(b.x - N / 2 + b.w / 2, b.y * BH, b.z - N / 2 + b.d / 2);
      holder.position.copy(base);
      g.position.set(-b.w / 2, 0, -b.d / 2);
      holder.add(g);
      holder.userData = { pid: b.id, baseY: b.y * BH, base, rot: b.rot, h: b.h, anim: b.anim || null };
      brickGroup.add(holder);
    }
    // real lights for the lamps (only the brightest few, to keep the scene fast)
    const lg = three.current.lightGroup;
    lg.clear();
    const lamps = [];
    for (const b of bricks) {
      const ty = TYPES[b.type];
      if (!ty.light) continue;
      const L = ty.light(cleanOpts(ty, b.opts), b.color);
      if (L.power > 0) lamps.push({ b, L });
    }
    lamps.sort((a, c) => c.L.power - a.L.power).slice(0, MAX_LIGHTS).forEach(({ b, L }) => {
      const a = (b.rot * Math.PI) / 2;
      const turn = ([x, y, z]) => new THREE.Vector3(x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a));
      const pos = new THREE.Vector3(b.x - N / 2 + b.w / 2, b.y * BH, b.z - N / 2 + b.d / 2).add(turn(L.pos));
      const light =
        L.kind === "spot"
          ? new THREE.SpotLight(L.color, L.power * LIGHT_K * 1.3, L.dist, L.angle, 0.5, LIGHT_DECAY)
          : new THREE.PointLight(L.color, L.power * LIGHT_K, L.dist, LIGHT_DECAY);
      light.position.copy(pos);
      if (L.kind === "spot") {
        light.target.position.copy(pos.clone().add(turn(L.dir)));
        lg.add(light.target);
      }
      lg.add(light);
    });
  }, [bricks, N]);

  /* day and night */
  useEffect(() => {
    const t = three.current;
    if (!t.hemi) return;
    t.hemi.intensity = 0.12 + 0.68 * daylight;
    t.sun.intensity = 0.04 + 0.86 * daylight;
    t.scene.background.copy(new THREE.Color("#0B1426").lerp(new THREE.Color("#CFE3F0"), daylight));
  }, [daylight]);

  /* outlines around the selected pieces */
  useEffect(() => {
    const t = three.current;
    if (!t.scene) return;
    t.selBoxes.forEach((bx) => {
      t.scene.remove(bx);
      bx.geometry.dispose();
    });
    t.selBoxes = [];
    if (mode !== "select" || !selIds.length) return;
    const holders = t.brickGroup.children.filter((c) => selIds.includes(c.userData.pid));
    if (holders.length !== selIds.length) {
      setSelIds(holders.map((hd) => hd.userData.pid)); // some selected pieces were removed
      return;
    }
    holders.slice(0, 80).forEach((hd) => {
      const bx = new THREE.BoxHelper(hd, 0xffd23f);
      t.scene.add(bx);
      t.selBoxes.push(bx);
    });
  }, [selIds, bricks, N, mode]);

  /* the route of a path motion, drawn on the ground while it is being edited */
  useEffect(() => {
    const t = three.current;
    if (!t.scene) return;
    if (t.pathViz) {
      t.scene.remove(t.pathViz);
      t.pathViz.traverse((o) => o.geometry && o.geometry.dispose());
      t.pathViz = null;
    }
    const piece = selIds.length === 1 ? bricks.find((b) => b.id === selIds[0]) : null;
    if (mode !== "select" || selTab !== "motion" || !piece || !piece.anim || piece.anim.type !== "path") return;
    const base = new THREE.Vector3(piece.x - N / 2 + piece.w / 2, piece.y * BH + 0.1, piece.z - N / 2 + piece.d / 2);
    const grp = new THREE.Group();
    const line = pathPoints(piece.anim).map((p) => p.clone().add(base));
    if (line.length) grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(line), new THREE.LineBasicMaterial({ color: 0xffd23f })));
    piece.anim.pts.forEach((p) => {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
      dot.position.set(base.x + p[0], base.y + p[1], base.z + p[2]);
      grp.add(dot);
    });
    t.scene.add(grp);
    t.pathViz = grp;
  }, [selIds, selTab, mode, bricks, N]);

  /* rebuild baseplate (and fit lights + camera) when its size changes */
  useEffect(() => {
    const t = three.current;
    if (!t.base) return;
    t.base.children.forEach((c) => c.geometry && c.geometry.dispose());
    t.base.clear();
    const mat = new THREE.MeshStandardMaterial({ color: "#3C8D4E", roughness: 0.6 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(N, 0.4, N), mat);
    plate.position.y = -0.2;
    plate.receiveShadow = true;
    const studs = new THREE.InstancedMesh(studGeo, mat, N * N);
    const tmp = new THREE.Object3D();
    let i = 0;
    for (let x = 0; x < N; x++)
      for (let z = 0; z < N; z++) {
        tmp.position.set(x - N / 2 + 0.5, 0.2 + SH / 2, z - N / 2 + 0.5);
        tmp.updateMatrix();
        studs.setMatrixAt(i++, tmp.matrix);
      }
    studs.raycast = () => {};
    studs.receiveShadow = true;
    t.base.add(plate, studs);

    const half = N / 2 + 2;
    Object.assign(t.sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, far: 40 + N * 2 });
    t.sun.shadow.camera.updateProjectionMatrix();
    t.sun.position.set(N * 0.7, N * 1.3, N * 0.5);
    t.orbit.radius = Math.max(t.orbit.radius, N * 1.5);
    t.updateCamera();
  }, [N]);

  /* grow or shrink the plate, keeping existing bricks centered */
  const shift = (delta) => (b) => ({ ...b, x: b.x + delta / 2, z: b.z + delta / 2 });
  const fits = (delta) => {
    const nn = N + delta;
    if (nn < MIN_N || nn > MAX_N) return false;
    return bricks.map(shift(delta)).every((b) => b.x >= 0 && b.z >= 0 && b.x + b.w <= nn && b.z + b.d <= nn);
  };
  const resizePlate = (delta) => {
    if (!fits(delta)) return;
    setN(N + delta);
    setBricks((p) => p.map(shift(delta)));
  };

  /* rebuild ghost preview when the selection changes */
  useEffect(() => {
    const t = three.current;
    if (!t.scene) return;
    if (t.ghost) t.scene.remove(t.ghost);
    if (t.ghostMat) t.ghostMat.dispose();
    t.ghostMat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.55 });
    const g = buildPiece(type, color, 0, rot, t.ghostMat, opts, dim);
    g.visible = false;
    t.scene.add(g);
    t.ghost = g;
  }, [typeKey, rot, color, mode, JSON.stringify(opts), JSON.stringify(dim)]);

  /* keep the creation in the browser so a refresh doesn't lose it */
  const setup = { reveal: anim, camMode, pieceAnims: animPieces, shots, stops, stopSecs }; // the video setup is saved with the structure
  useEffect(() => autosave(N, bricks, setup), [N, bricks, anim, camMode, animPieces, shots, stops, stopSecs]);

  const saveJson = () => {
    const blob = new Blob([serializeStructure(N, bricks, setup)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hobby-structure.json";
    a.click();
    URL.revokeObjectURL(url);
    setNote(`Saved ${bricks.length} piece${bricks.length === 1 ? "" : "s"} and your animation setup to hobby-structure.json`);
  };
  const loadJson = async (e) => {
    const file = e.target.files[0];
    e.target.value = ""; // lets the same file be chosen again
    if (!file) return;
    try {
      const { N: n, pieces, setup: su } = parseStructure(await file.text());
      idCounter.current = pieces.length;
      setN(n);
      setBricks(pieces);
      if (su) {
        setAnim(su.reveal);
        setCamMode(su.camMode);
        setAnimPieces(su.pieceAnims);
        setShots(su.shots);
        setStops(su.stops);
        setStopSecs(su.stopSecs);
      }
      setNote(`Loaded ${pieces.length} piece${pieces.length === 1 ? "" : "s"}`);
    } catch (err) {
      setNote("Couldn't load: " + err.message);
    }
  };

  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(""), 4000);
    return () => clearTimeout(id);
  }, [note]);

  /* camera angles */
  const VIEWS = { Front: { theta: 0, phi: 1.15 }, Side: { theta: Math.PI / 2, phi: 1.15 }, Top: { theta: 0, phi: 0.2 }, Iso: { theta: 0.8, phi: 0.95 } };
  const setView = (v) => {
    const t = three.current;
    if (t.walk.active) toggleWalk(); // leave walk mode so the orbit camera is visible
    Object.assign(t.orbit, v);
    t.updateCamera();
  };
  /* walk mode and home tour stops */
  const toggleWalk = () => {
    const t = three.current;
    if (!t.walk.active) {
      const w = t.walk;
      if (!w.started) {
        // first time: stand at the current camera spot at eye height, facing the middle of the plate
        w.pos.set(t.camera.position.x, 2.4, t.camera.position.z);
        w.yaw = Math.atan2(-w.pos.x, w.pos.z);
        w.pitch = -0.05;
        w.started = true;
      }
      w.active = true;
      t.camera.fov = 65;
      t.camera.updateProjectionMatrix();
      t.applyWalk();
      if (t.ghost) t.ghost.visible = false;
      setWalkMode(true);
    } else {
      t.walk.active = false;
      t.walk.keys.clear();
      t.camera.fov = 45;
      t.camera.updateProjectionMatrix();
      t.updateCamera();
      setWalkMode(false);
    }
  };
  const addStop = () => {
    const w = three.current.walk;
    if (!w.active) return setNote("Turn on Walk first, move to a spot, then add a stop.");
    const r = (v) => Math.round(v * 100) / 100;
    setStops((p) => (p.length < 12 ? [...p, { x: r(w.pos.x), y: r(w.pos.y), z: r(w.pos.z), yaw: r(w.yaw), pitch: r(w.pitch) }] : p));
  };
  const goStop = (st) => {
    const t = three.current;
    if (!t.walk.active) toggleWalk();
    t.walk.pos.set(st.x, st.y, st.z);
    t.walk.yaw = st.yaw;
    t.walk.pitch = st.pitch;
    t.applyWalk();
  };
  const chooseCam = (m) => {
    setCamMode(m);
    if (m === "tour" && !three.current.walk.active) toggleWalk();
  };
  const addShot = () => setShots((p) => (p.length < 8 ? [...p, { ...three.current.orbit }] : p));

  /* preview the animation, or record it and download it */
  const exportAnimation = async (kind) => {
    const t = three.current;
    if (!bricks.length) return setNote("Place some pieces first.");
    if (camMode === "angles" && !shots.length) return setNote("Add at least one camera angle first.");
    if (camMode === "tour" && !stops.length) return setNote("Add at least one tour stop first.");
    const cancel = { v: false };
    cancelRef.current = cancel;
    const saved = { ...t.orbit };
    const savedFov = t.camera.fov;
    const order = new Map([...bricks].sort((a, b) => a.id - b.id).map((b, i) => [b.id, i]));
    const plan = planAnimation(bricks.length, anim, camMode, shots, { stops, secs: stopSecs });
    plan.pieceAnims = animPieces;
    const env = { ...t, startTheta: saved.theta, startPhi: saved.phi, startRadius: saved.radius };
    t.recording = true;
    t.renderer.domElement.style.pointerEvents = "none";
    setBusy(kind);
    setProgress(0);
    try {
      const run = { gif: recordGif, video: recordVideo, preview: playPreview }[kind];
      const out = await run(env, plan, order, setProgress, () => cancel.v);
      if (kind === "preview") setNote("");
      else if (out) {
        downloadBlob(out.blob, "hobby-animation." + out.ext);
        setNote("Saved hobby-animation." + out.ext);
      } else setNote("Export cancelled");
    } catch (err) {
      setNote("Couldn't export: " + err.message);
    } finally {
      Object.assign(t.orbit, saved);
      t.camera.fov = savedFov;
      t.camera.updateProjectionMatrix();
      if (t.walk.active) t.applyWalk();
      else t.updateCamera();
      t.brickGroup.children.forEach((g) => {
        g.visible = true;
        g.userData.revealed = true;
        g.position.y = g.userData.baseY;
      });
      resetPieceAnims(t.brickGroup, true);
      t.renderer.domElement.style.pointerEvents = "";
      t.recording = false;
      setBusy("");
    }
  };

  /* photos from different camera angles, saved as PNG files */
  const photoViews = () => {
    const r = three.current.orbit.radius;
    return [
      { key: "now", name: "Current view", view: null },
      ...PRESET_VIEWS.map((v) => ({ key: v.key, name: v.name, view: { kind: "orbit", theta: v.theta, phi: v.phi, radius: r } })),
      ...shots.map((sh, i) => ({ key: "shot" + i, name: "Angle " + (i + 1), view: { kind: "orbit", ...sh } })),
      ...stops.map((st, i) => ({ key: "stop" + i, name: "Stop " + (i + 1), view: { kind: "walk", ...st } })),
    ];
  };
  const savePhoto = (item) => downloadBlob(item.blob, "hobby-" + item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".png");
  const takeShots = async (keys, download = true) => {
    const t = three.current;
    if (busy) return;
    if (!bricks.length) return setNote("Place some pieces first.");
    const list = photoViews().filter((v) => keys.includes(v.key));
    if (!list.length) return setNote("Choose at least one angle.");
    try {
      const photos = takePhotos(t, list, photoSize);
      const out = photos.map((p) => ({ name: p.name, canvas: p.canvas }));
      if (photoSheet && photos.length > 1) out.push({ name: "All angles", canvas: contactSheet(photos) });
      const items = [];
      for (const p of out) {
        const blob = await canvasToBlob(p.canvas);
        const item = { id: ++photoId.current, name: p.name, blob, url: URL.createObjectURL(blob) };
        items.push(item);
        if (download) {
          savePhoto(item);
          await new Promise((r) => setTimeout(r, 250)); // browsers drop downloads that arrive all at once
        }
      }
      setAlbum((a) => {
        const all = [...items, ...a];
        all.slice(24).forEach((x) => URL.revokeObjectURL(x.url));
        return all.slice(0, 24);
      });
      setNote(`Saved ${items.length} photo${items.length === 1 ? "" : "s"}`);
    } catch (err) {
      setNote("Couldn't take the photo: " + err.message);
    }
  };
  const clearAlbum = () => {
    album.forEach((x) => URL.revokeObjectURL(x.url));
    setAlbum([]);
  };

  /* ---------- UI ---------- */
  const q = query.trim().toLowerCase();
  const keys = q
    ? Object.keys(TYPES).filter((k) => (TYPES[k].name + " " + groupOf[k]).toLowerCase().includes(q))
    : GROUPS.find((g) => g.title === cat).keys;
  const colorName = (COLORS.find((c) => c.hex === color) || {}).name;
  const plan = planAnimation(bricks.length, anim, camMode, shots, { stops, secs: stopSecs });
  const restore = (e) => {
    skipHistory.current = true;
    idCounter.current = Math.max(idCounter.current, ...e.bricks.map((b) => b.id), 0); // keep ids unique
    setN(e.N);
    setBricks(e.bricks);
  };
  const undo = () => {
    const e = past.current.pop();
    if (!e) return setNote("Nothing to undo");
    future.current.push({ N, bricks });
    restore(e);
  };
  const redo = () => {
    const e = future.current.pop();
    if (!e) return setNote("Nothing to redo");
    past.current.push({ N, bricks });
    restore(e);
  };
  const clearAll = () => {
    if (window.confirm("Remove all pieces?")) setBricks([]);
  };
  const on = (cond) => " btn" + (cond ? " on" : "");
  const sel = bricks.filter((b) => selIds.includes(b.id));
  const first = sel[0] || null;
  const firstType = first ? TYPES[first.type] : null;
  const motion = first ? first.anim || null : null;
  const mdef = motion ? MOTIONS.find((m) => m.key === motion.type) : null;
  const canSettings = sel.length === 1 && !!firstType && !!firstType.params;
  const tabs = [["edit", "Edit"], ["size", "Size"], ["motion", "Motion"], ...(canSettings ? [["settings", "Settings"]] : [])];
  const tab = tabs.some(([k]) => k === selTab) ? selTab : "edit";
  const hasSel = mode === "select" && sel.length > 0;
  const withAnim = (b, a) => {
    const nb = { ...b };
    if (a) nb.anim = a;
    else delete nb.anim;
    return nb;
  };
  // a run of slider changes on the same thing counts as one undo step
  const touch = (key) => {
    const now = Date.now();
    coalesce.current = lastMotionEdit.current.id === key && now - lastMotionEdit.current.t < 700;
    lastMotionEdit.current = { id: key, t: now };
  };
  const togglePlay = () => {
    const t = three.current;
    if (!t.playing) {
      t.playing = true;
      t.playStart = performance.now();
      setPlaying(true);
    } else {
      t.playing = false;
      resetPieceAnims(t.brickGroup);
      setPlaying(false);
    }
  };

  /* editing the selected pieces */
  // measure a piece again after its settings or stretched size change, keeping it on the baseplate
  const refit = (b, patch) => {
    const t = TYPES[b.type];
    const o = t.params ? cleanOpts(t, patch.opts !== undefined ? patch.opts : b.opts) : null;
    const dimN = patch.dim !== undefined ? patch.dim : b.dim || null;
    const dmn = typeDims(t, o, dimN);
    const [nw, nd] = b.rot % 2 ? [dmn.d, dmn.w] : [dmn.w, dmn.d];
    const nb = { ...b, w: nw, d: nd, h: dmn.h, top: dmn.top, x: Math.min(b.x, Math.max(0, N - nw)), z: Math.min(b.z, Math.max(0, N - nd)) };
    if (o) nb.opts = o;
    if (dimN) nb.dim = dimN;
    else delete nb.dim;
    return nb;
  };
  const colorSel = (hex) => setBricks((prev) => prev.map((b) => (selIds.includes(b.id) ? { ...b, color: hex } : b)));
  const moveSel = (dx, dz, step) => {
    if (!sel.length) return;
    const ids = new Set(selIds);
    setBricks((prev) => {
      const moved = prev.map((b) => (ids.has(b.id) ? { ...b, x: b.x + dx * step, z: b.z + dz * step } : b));
      if (moved.some((b) => ids.has(b.id) && (b.x < 0 || b.z < 0 || b.x + b.w > N || b.z + b.d > N))) return prev; // stay on the baseplate
      return settle(moved);
    });
  };
  const rotateSel = (dir) => {
    if (!sel.length) return;
    const ids = new Set(selIds);
    setBricks((prev) =>
      settle(
        prev.map((b) => {
          if (!ids.has(b.id)) return b;
          const t = TYPES[b.type];
          const dmn = typeDims(t, t.params ? cleanOpts(t, b.opts) : null, b.dim || null);
          const r = (b.rot + dir + 4) % 4;
          const [nw, nd] = r % 2 ? [dmn.d, dmn.w] : [dmn.w, dmn.d];
          return {
            ...b,
            rot: r,
            w: nw,
            d: nd,
            x: Math.min(Math.max(0, Math.round(b.x + b.w / 2 - nw / 2)), Math.max(0, N - nw)),
            z: Math.min(Math.max(0, Math.round(b.z + b.d / 2 - nd / 2)), Math.max(0, N - nd)),
          };
        })
      )
    );
  };
  const duplicateSel = () => {
    if (!sel.length) return;
    const dx = sel.every((b) => b.x + b.w + 2 <= N) ? 2 : -2;
    const dz = sel.every((b) => b.z + b.d + 2 <= N) ? 2 : -2;
    const copies = sel.map((b) => ({ ...b, id: ++idCounter.current, x: Math.max(0, b.x + dx), z: Math.max(0, b.z + dz) }));
    setBricks((prev) => settle([...prev, ...copies]));
    setSelIds(copies.map((c) => c.id));
  };
  const deleteSel = () => {
    if (!sel.length) return;
    const ids = new Set(selIds);
    setBricks((prev) => settle(prev.filter((b) => !ids.has(b.id))));
    setSelIds([]);
  };
  const selectAll = () => {
    setMode("select");
    setSelIds(bricks.map((b) => b.id));
  };
  // stretch the selected pieces to a custom width, length and height (patch = null puts them back)
  const setSelDim = (patch) => {
    if (!sel.length) return;
    touch("d" + selIds.join());
    const ids = new Set(selIds);
    setBricks((prev) =>
      settle(
        prev.map((b) => {
          if (!ids.has(b.id)) return b;
          const cur = b.dim || typeDims(TYPES[b.type], b.opts);
          return refit(b, { dim: patch === null ? null : cleanDim({ w: cur.w, d: cur.d, h: cur.h, ...patch }) });
        })
      )
    );
  };
  // change the settings of one selected customizable piece (a lamp's brightness, a roof's size, ...)
  const editOpts = (patch) => {
    if (!canSettings) return;
    touch("o" + first.id);
    setBricks((prev) => settle(prev.map((b) => (b.id === first.id ? refit(b, { opts: { ...(b.opts || {}), ...patch } }) : b))));
  };

  /* motion for the selected pieces: patch = null removes it, { type } picks one, anything else adjusts it */
  const setMotion = (patch) => {
    if (!sel.length) return;
    touch("m" + selIds.join());
    const ids = new Set(selIds);
    setBricks((prev) =>
      prev.map((b) => {
        if (!ids.has(b.id)) return b;
        const cur = b.anim || null;
        let next;
        if (patch === null) next = null;
        else if (patch.type && (!cur || patch.type !== cur.type)) next = { ...newAnim(patch.type), speed: cur ? cur.speed : 1, delay: cur ? cur.delay : 0 };
        else next = cleanAnim({ ...(cur || newAnim("spin")), ...patch });
        return withAnim(b, next);
      })
    );
    if (patch !== null && !three.current.playing) togglePlay(); // show it straight away
  };
  const applyToSame = () => {
    if (!first) return;
    const count = bricks.filter((b) => b.type === first.type).length;
    coalesce.current = false;
    setBricks((prev) => prev.map((b) => (b.type === first.type ? withAnim(b, first.anim ? { ...first.anim, ...(first.anim.pts ? { pts: first.anim.pts.map((p) => [...p]) } : {}) } : null) : b)));
    setNote("Applied to " + count + " × " + firstType.name);
  };
  // keyboard version of the controls: { } speed, < > distance / angle / size, ( ) delay, Y type, I direction, L reverse
  const motionKey = (kind, idx, dir) => {
    if (!first) return setNote("Select a piece first, then use these keys");
    const types = ["none", ...MOTIONS.map((m) => m.key)];
    if (kind === "sel" && idx === 0) {
      const next = types[(types.indexOf(motion ? motion.type : "none") + dir + types.length) % types.length];
      return setMotion(next === "none" ? null : { type: next });
    }
    if (!motion) return setNote("Give the piece a motion first (press Y)");
    if (kind === "num") {
      const specs = [{ key: "speed", min: 0.25, max: 4, step: 0.25 }, mdef.amount && { key: "amount", ...mdef.amount }, { key: "delay", min: 0, max: 8, step: 0.5 }].filter(Boolean);
      const sp = specs[idx];
      return sp ? setMotion({ [sp.key]: motion[sp.key] + dir * sp.step }) : undefined;
    }
    if (kind === "sel" && mdef.axis) {
      const keys = AXES.map(([k]) => k);
      return setMotion({ axis: keys[(keys.indexOf(motion.axis) + dir + keys.length) % keys.length] });
    }
    if (kind === "tog") {
      if (mdef.reverse) return setMotion({ reverse: !motion.reverse });
      if (mdef.loop) return setMotion({ loop: motion.loop === "repeat" ? "pingpong" : "repeat" });
    }
    return undefined;
  };
  // drawn paths: waypoints are offsets in studs from where the piece was placed
  const pathPts = motion && motion.type === "path" ? motion.pts : [];
  const addPathWorldPoint = (x, y, z) => {
    if (sel.length !== 1 || !motion || motion.type !== "path") return;
    const bx = first.x - N / 2 + first.w / 2;
    const by = first.y * BH;
    const bz = first.z - N / 2 + first.d / 2;
    const dy = Math.abs(y - by) < 0.35 ? 0 : Math.round((y - by) * 4) / 4;
    setMotion({ pts: [...pathPts, [Math.round((x - bx) * 4) / 4, dy, Math.round((z - bz) * 4) / 4]] });
  };
  const setPoint = (i, axis, val) => setMotion({ pts: pathPts.map((p, j) => (j === i ? p.map((v, k) => (k === axis ? val : v)) : p)) });
  // stretch the piece type that is about to be placed
  const setDim = (patch) => setDimByType((p) => ({ ...p, [typeKey]: cleanDim({ w: baseDm.w, d: baseDm.d, h: baseDm.h, ...(p[typeKey] || {}), ...patch }) }));
  const setOpt = (key, val) => setOptsByType((p) => ({ ...p, [typeKey]: { ...opts, [key]: val } }));

  actions.current = {
    busy: !!busy,
    undo, redo, save: saveJson, clear: clearAll,
    openFile: () => fileRef.current && fileRef.current.click(),
    focusSearch: () => {
      const el = document.querySelector(".search");
      if (el) {
        el.focus();
        el.select();
      }
    },
    setMode,
    rotate: (dir) => (mode === "select" && sel.length ? rotateSel(dir) : setRot((r) => (r + dir + 4) % 4)),
    actAtPointer: () => {
      const t = three.current;
      if (t.walk.active || !t.lastPointer) return setNote("Move the pointer over the 3D view first");
      if (mode === "remove") t.removeAt(t.lastPointer);
      else if (mode === "select") t.selectAt(t.lastPointer);
      else t.placeAt(t.lastPointer);
    },
    escape: () => {
      if (helpOpen) return setHelpOpen(false);
      if (busy) {
        cancelRef.current.v = true;
        return undefined;
      }
      if (pathPick) return setPathPick(false);
      if (mode === "select" && selIds.length) return setSelIds([]);
      if (animOpen) return setAnimOpen(false);
      if (three.current.walk.active) return toggleWalk();
      return setMode("build");
    },
    category: (dir) => {
      const i = GROUPS.findIndex((g) => g.title === cat);
      setQuery("");
      setCat(GROUPS[(i + dir + GROUPS.length) % GROUPS.length].title);
    },
    piece: (dir) => {
      if (!keys.length) return;
      const i = keys.indexOf(typeKey);
      setTypeKey(keys[((i < 0 ? (dir > 0 ? -1 : 0) : i) + dir + keys.length) % keys.length]);
      setMode("build");
    },
    color: (dir) => {
      const i = COLORS.findIndex((c) => c.hex === color);
      setColor(COLORS[(i + dir + COLORS.length) % COLORS.length].hex);
      setMode("build");
    },
    view: (i) => setView(Object.values(VIEWS)[i]),
    resetView: () => setView({ theta: 0.8, phi: 0.95, radius: Math.max(30, N * 1.5) }),
    orbitBy: (dx, dy, big) => {
      const t = three.current;
      const step = big ? 0.4 : 0.12;
      t.orbit.theta += dx * step;
      t.orbit.phi = Math.min(1.5, Math.max(0.2, t.orbit.phi + dy * step));
      t.updateCamera();
    },
    zoom: (dir) => {
      const t = three.current;
      t.orbit.radius = Math.min(40 + N * 1.5, Math.max(10, t.orbit.radius * (dir > 0 ? 1.12 : 0.89)));
      t.updateCamera();
    },
    walk: toggleWalk,
    plate: (dir) => resizePlate(dir * STEP),
    toggleAnim: () => {
      setPhotoOpen(false);
      setAnimOpen((o) => !o);
    },
    togglePhotos: () => {
      setAnimOpen(false);
      setPhotoOpen((o) => !o);
    },
    snap: () => takeShots(["now"]),
    toggleReveal: () => {
      const next = anim === "build" ? "finished" : "build";
      setAnim(next);
      setNote("Animation pieces: " + (next === "build" ? "build-up" : "finished model"));
    },
    cycleCamera: () => {
      const order = ["orbit", "angles", "tour"];
      const next = order[(order.indexOf(camMode) + 1) % order.length];
      chooseCam(next);
      setNote("Animation camera: " + { orbit: "orbit", angles: "your angles", tour: "home tour" }[next]);
    },
    keyframe: () => {
      if (camMode === "angles") {
        if (shots.length >= 8) return setNote("You can save up to 8 angles");
        addShot();
        return setNote("Saved angle " + (shots.length + 1));
      }
      if (camMode === "tour") {
        if (!three.current.walk.active) return setNote("Turn on Walk (F) first, then save a stop");
        if (stops.length >= 12) return setNote("You can save up to 12 stops");
        addStop();
        return setNote("Saved stop " + (stops.length + 1));
      }
      return setNote("Choose Angles or Home tour first (press O)");
    },
    run: (kind) => {
      setAnimOpen(true);
      exportAnimation(kind);
    },
    toggleHelp: () => setHelpOpen((o) => !o),
    play: togglePlay,
    hasSel,
    moveSel: (dx, dz, big) => moveSel(dx, dz, big ? 4 : moveStep),
    deleteSel,
    duplicate: duplicateSel,
    selectAll,
    motionTab: () => {
      setMode("select");
      setSelTab("motion");
    },
    night: () => {
      const next = daylight > 0.5 ? 0.1 : 1;
      setDaylight(next);
      setNote(next < 0.5 ? "Night" : "Day");
    },
    addPathWorldPoint,
    customize: (kind, idx, dir) => {
      if (mode === "select" && tab === "motion") return motionKey(kind, idx, dir);
      const inSettings = mode === "select" && tab === "settings" && canSettings;
      const params = inSettings ? firstType.params : type.params;
      const cur = inSettings ? cleanOpts(firstType, first.opts) : opts;
      if (!params) return setNote("Select a customizable piece first, such as a roof, lamp or door");
      const pr = params.filter((p) => p.kind === kind)[idx];
      if (!pr) return undefined;
      const c = cur[pr.key];
      let val;
      if (kind === "num") val = Math.min(pr.max, Math.max(pr.min, c + dir * pr.step));
      else if (kind === "sel") {
        const i = pr.options.findIndex(([v]) => v === c);
        val = pr.options[(i + dir + pr.options.length) % pr.options.length][0];
      } else val = !c;
      if (inSettings) {
        editOpts({ [pr.key]: val });
        return undefined;
      }
      setOpt(pr.key, val);
      return setMode("build");
    },
  };

  const selectCard =
    mode === "select" && !walkMode ? (
      <div className="custom" role="group" aria-label="Selected pieces">
        {!sel.length ? (
          <p className="note" style={{ margin: 0 }}>
            Click a piece to select it. Shift+click adds or removes pieces, Shift+drag draws a box around several, and Ctrl+A selects everything.
          </p>
        ) : (
          <>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <strong>{sel.length === 1 ? firstType.name : sel.length + " pieces selected"}</strong>
              <button className="btn sm" style={{ flex: "none" }} onClick={() => setSelIds([])}>Done</button>
            </div>
            <div className="chips" role="tablist" style={{ marginBottom: 8 }}>
              {tabs.map(([k, label]) => (
                <button key={k} role="tab" aria-selected={tab === k} className={"chip sm" + (tab === k ? " on" : "")} onClick={() => setSelTab(k)}>{label}</button>
              ))}
            </div>

            {tab === "edit" && (
              <>
                <div className="h">Color</div>
                <div className="swatches" style={{ marginBottom: 8 }}>
                  {COLORS.map((c) => (
                    <button
                      key={c.hex}
                      className={"sw" + (sel.every((b) => b.color === c.hex) ? " on" : "")}
                      style={{ background: c.hex }}
                      aria-label={"Color " + c.name}
                      title={c.name}
                      onClick={() => colorSel(c.hex)}
                    />
                  ))}
                </div>
                <div className="h">Move</div>
                <div className="movepad">
                  <button className="btn sm" onClick={() => moveSel(-1, 0, moveStep)} aria-label="Move left" title="Left (arrow key)">◀</button>
                  <button className="btn sm" onClick={() => moveSel(1, 0, moveStep)} aria-label="Move right" title="Right (arrow key)">▶</button>
                  <button className="btn sm" onClick={() => moveSel(0, -1, moveStep)} aria-label="Move back" title="Back (arrow key)">▲</button>
                  <button className="btn sm" onClick={() => moveSel(0, 1, moveStep)} aria-label="Move forward" title="Forward (arrow key)">▼</button>
                </div>
                <div className="chips" style={{ marginBottom: 8 }}>
                  {[1, 4].map((n) => (
                    <button key={n} className={"chip sm" + (moveStep === n ? " on" : "")} aria-pressed={moveStep === n} onClick={() => setMoveStep(n)}>{n} stud{n > 1 ? "s" : ""} per step</button>
                  ))}
                </div>
                <div className="row" style={{ marginBottom: 0 }}>
                  <button className="btn sm" onClick={() => rotateSel(1)} title="Turn (R)">Rotate</button>
                  <button className="btn sm" onClick={duplicateSel} title="Duplicate (Ctrl+D)">Duplicate</button>
                  <button className="btn sm" onClick={deleteSel} title="Delete (Delete key)">Delete</button>
                </div>
              </>
            )}

            {tab === "size" && (
              <>
                <p className="note" style={{ margin: "0 0 6px" }}>
                  Stretch {sel.length > 1 ? "all " + sel.length + " selected pieces" : "this piece"} to a custom width, length and height.
                </p>
                <DimControls dim={first.dim || null} base={typeDims(firstType, first.opts)} onChange={setSelDim} onReset={() => setSelDim(null)} />
              </>
            )}

            {tab === "settings" && canSettings && (
              <ParamControls params={firstType.params} opts={cleanOpts(firstType, first.opts)} onChange={(k, v) => editOpts({ [k]: v })} />
            )}

            {tab === "motion" && (
              <>
                <div className="prm sel">
                  <span>Motion</span>
                  <div className="chips">
                    <button className={"chip sm" + (!motion ? " on" : "")} aria-pressed={!motion} onClick={() => setMotion(null)}>None</button>
                    {MOTIONS.map((m) => (
                      <button key={m.key} className={"chip sm" + (motion && motion.type === m.key ? " on" : "")} aria-pressed={!!motion && motion.type === m.key} title={m.hint} onClick={() => setMotion({ type: m.key })}>{m.label}</button>
                    ))}
                  </div>
                </div>
                {motion && (
                  <>
                    <p className="note" style={{ margin: "0 0 4px" }}>{mdef.hint}</p>
                    {mdef.axis && (
                      <div className="prm sel">
                        <span>Direction</span>
                        <div className="chips">
                          {AXES.map(([k, lab]) => (
                            <button key={k} className={"chip sm" + (motion.axis === k ? " on" : "")} aria-pressed={motion.axis === k} onClick={() => setMotion({ axis: k })}>{lab}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    <label className="prm">
                      <span>Speed</span>
                      <input type="range" min={0.25} max={4} step={0.25} value={motion.speed} onChange={(e) => setMotion({ speed: Number(e.target.value) })} />
                      <output>×{motion.speed}</output>
                    </label>
                    {mdef.amount && (
                      <label className="prm">
                        <span>{mdef.amount.label.split(" (")[0]}</span>
                        <input type="range" min={mdef.amount.min} max={mdef.amount.max} step={mdef.amount.step} value={motion.amount} onChange={(e) => setMotion({ amount: Number(e.target.value) })} />
                        <output>{motion.amount}</output>
                      </label>
                    )}
                    <label className="prm">
                      <span>Delay (s)</span>
                      <input type="range" min={0} max={8} step={0.5} value={motion.delay} onChange={(e) => setMotion({ delay: Number(e.target.value) })} />
                      <output>{motion.delay}</output>
                    </label>
                    {mdef.loop && (
                      <div className="prm sel">
                        <span>Repeat</span>
                        <div className="chips">
                          <button className={"chip sm" + (motion.loop === "pingpong" ? " on" : "")} onClick={() => setMotion({ loop: "pingpong" })}>Out and back</button>
                          <button className={"chip sm" + (motion.loop === "repeat" ? " on" : "")} onClick={() => setMotion({ loop: "repeat" })}>Jump back</button>
                        </div>
                      </div>
                    )}
                    {mdef.path &&
                      (sel.length === 1 ? (
                        <div className="prm sel">
                          <span>Route</span>
                          <div className="chips" style={{ marginBottom: 4 }}>
                            <button className={"chip sm" + (pathPick ? " on" : "")} aria-pressed={pathPick} onClick={() => setPathPick((p) => !p)}>
                              {pathPick ? "Click the ground…" : "Add points on the ground"}
                            </button>
                            <button className="chip sm" disabled={!pathPts.length} onClick={() => setMotion({ pts: pathPts.slice(0, -1) })}>Undo point</button>
                            <button className="chip sm" disabled={!pathPts.length} onClick={() => setMotion({ pts: [] })}>Clear</button>
                          </div>
                          <div className="chips" style={{ marginBottom: 4 }}>
                            {[["pingpong", "Out and back"], ["repeat", "Jump back"], ["closed", "Circuit"]].map(([k, lab]) => (
                              <button key={k} className={"chip sm" + (motion.loop === k ? " on" : "")} aria-pressed={motion.loop === k} onClick={() => setMotion({ loop: k })}>{lab}</button>
                            ))}
                          </div>
                          {pathPts.map((p, i) => (
                            <div className="pt" key={i}>
                              <span>{i + 1}</span>
                              {["x", "up", "z"].map((lab, k) => (
                                <input key={lab} type="number" step={0.25} value={p[k]} aria-label={"Point " + (i + 1) + " " + lab} onChange={(e) => setPoint(i, k, Number(e.target.value) || 0)} />
                              ))}
                              <button className="chip sm" aria-label={"Remove point " + (i + 1)} onClick={() => setMotion({ pts: pathPts.filter((_, j) => j !== i) })}>×</button>
                            </div>
                          ))}
                          <p className="note">The piece follows the yellow route. Points are in studs from where it sits (across, up, along). Speed ×1 is 2 studs per second.</p>
                        </div>
                      ) : (
                        <p className="note">Select a single piece to draw its route.</p>
                      ))}
                    {mdef.reverse && (
                      <label className="prm tog">
                        <input type="checkbox" checked={motion.reverse} onChange={(e) => setMotion({ reverse: e.target.checked })} />
                        <span>Reverse direction</span>
                      </label>
                    )}
                    {mdef.turn && (
                      <label className="prm tog">
                        <input type="checkbox" checked={motion.turn} onChange={(e) => setMotion({ turn: e.target.checked })} />
                        <span>Face the way it travels</span>
                      </label>
                    )}
                  </>
                )}
                <div className="row" style={{ marginTop: 8, marginBottom: 0 }}>
                  <button className="btn sm" onClick={togglePlay}>{playing ? "Pause" : "Play"}</button>
                  <button className="btn sm" onClick={applyToSame} title="Give every placed piece of this kind the same motion">Apply to all {firstType.name}</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    ) : null;

  return (
    <div className={"lb" + (busy ? " busy" : "")}>
      <style>{CSS + HELP_CSS}</style>

      <header className="tb">
        <strong className="brand">Hobby Builder</strong>

        <div className="seg" role="group" aria-label="Mode">
          <button className={on(mode === "build").trim()} onClick={() => setMode("build")} title="Place pieces (B)">Build</button>
          <button className={on(mode === "remove").trim()} onClick={() => setMode("remove")} title="Remove pieces (X)">Remove</button>
          <button className={on(mode === "select").trim()} onClick={() => setMode("select")} title="Select pieces to move, delete, recolor, resize, light or animate (S)">Select</button>
        </div>

        <button className={on(playing).trim()} onClick={togglePlay} title="Play or pause piece motion (T)">{playing ? "Pause" : "Play"}</button>

        <div className="grp">
          <button className="btn" onClick={() => setRot((r) => (r + 1) % 4)} title="Rotate the piece (R, or Shift+R the other way)">Rotate</button>
          <button className="btn" onClick={undo} disabled={!hist.undo} title="Undo (Ctrl+Z)">Undo</button>
          <button className="btn" onClick={redo} disabled={!hist.redo} title="Redo (Ctrl+Y or Ctrl+Shift+Z)">Redo</button>
          <button className="btn" onClick={clearAll} disabled={!bricks.length} title="Remove everything (Shift+Delete)">Clear</button>
        </div>

        <div className="grp">
          <span className="lbl">View</span>
          <div className="seg" role="group" aria-label="Camera view">
            {Object.entries(VIEWS).map(([name, v], i) => (
              <button key={name} className="btn" onClick={() => setView(v)} title={name + " view (" + (i + 1) + ")"}>{name}</button>
            ))}
          </div>
        </div>

        <button className={on(walkMode).trim()} onClick={toggleWalk} title="Walk through your build like a home tour (F): W A S D to move, drag to look">Walk</button>

        <div className="grp">
          <span className="lbl">Baseplate</span>
          <button className="btn sm" onClick={() => resizePlate(-STEP)} disabled={!fits(-STEP)} aria-label="Shrink baseplate" title="Shrink baseplate (-)">−</button>
          <span>{N}×{N}</span>
          <button className="btn sm" onClick={() => resizePlate(STEP)} disabled={!fits(STEP)} aria-label="Expand baseplate" title="Expand baseplate (+)">+</button>
        </div>

        <label className="grp" title="Daylight (press N for night)">
          <span className="lbl">Daylight</span>
          <input type="range" min={0} max={100} value={Math.round(daylight * 100)} onChange={(e) => setDaylight(Number(e.target.value) / 100)} style={{ width: 80 }} />
        </label>

        <div className="grp">
          <button className="btn" onClick={saveJson} title="Download your build as a JSON file (Ctrl+S)">Save</button>
          <button className="btn" onClick={() => fileRef.current.click()} title="Open a saved JSON file (Ctrl+O)">Load</button>
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={loadJson} style={{ display: "none" }} />
        </div>

        <button className="btn" style={{ marginLeft: "auto" }} onClick={() => setHelpOpen(true)} title="Keyboard shortcuts (? or H)">Keys</button>
        <button className={"btn" + (photoOpen ? " on" : "")} onClick={() => actions.current.togglePhotos()} aria-expanded={photoOpen} title="Photos from different angles (Shift+J)">
          Photos
        </button>
        <button className={"btn accent" + (animOpen ? " on" : "")} onClick={() => actions.current.toggleAnim()} aria-expanded={animOpen} title="Animation video (M)">
          Animate
        </button>
      </header>

      <div className="body">
        <aside className="side">
          <div className="sec">
            <div className="h">Color · {colorName}</div>
            <div className="swatches">
              {COLORS.map((c) => (
                <button
                  key={c.hex}
                  className={"sw" + (color === c.hex ? " on" : "")}
                  style={{ background: c.hex }}
                  aria-label={c.name}
                  aria-pressed={color === c.hex}
                  title={c.name}
                  onClick={() => { setColor(c.hex); setMode("build"); }}
                />
              ))}
            </div>
          </div>

          <div className="sec">
            <div className="h">Pieces</div>
            <input className="search" type="search" placeholder="Search pieces (press /)" aria-label="Search pieces" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          {!q && (
            <div className="cats" role="tablist" aria-label="Piece categories">
              {GROUPS.map((g) => (
                <button key={g.title} role="tab" aria-selected={cat === g.title} className={"chip" + (cat === g.title ? " on" : "")} onClick={() => setCat(g.title)}>
                  {g.title}
                </button>
              ))}
            </div>
          )}

          <div className="grid">
            {keys.length === 0 && <div className="empty">No pieces match “{query}”.</div>}
            {keys.map((k) => {
              const t = TYPES[k];
              return (
                <button
                  key={k}
                  className={"card" + (typeKey === k ? " on" : "")}
                  aria-pressed={typeKey === k}
                  title={t.custom ? `${t.name} · choose its size and style after selecting it` : `${t.name} · ${t.w}×${t.d} studs${t.top ? "" : " · nothing can be stacked on it"}`}
                  onClick={() => { setTypeKey(k); setMode("build"); }}
                >
                  <Thumb k={k} color={color} />
                  <span className="nm">{t.name}</span>
                  {t.custom && <span className="badge">custom</span>}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="stage">
          <div ref={mountRef} className="canvas" style={{ cursor: mode === "remove" ? "crosshair" : "pointer" }} />

          <div className="status">
            {walkMode ? (
              <>
                <strong>Walk mode</strong>
                <span>W A S D move · Q / E down / up · ← → turn · drag to look · Shift faster</span>
              </>
            ) : mode === "build" ? (
              <>
                <span className="dot" style={{ background: color }} />
                <strong>{type.name}</strong>
                <span>{w}×{d} studs · turned {rot * 90}°</span>
              </>
            ) : mode === "remove" ? (
              <strong>Remove mode: click a piece to delete it</strong>
            ) : (
              <strong>Select mode: click a piece (Shift+click adds, Shift+drag draws a box){sel.length ? " · " + sel.length + " selected" : ""}</strong>
            )}
            <span>{bricks.length} piece{bricks.length === 1 ? "" : "s"}</span>
            {bricks.some((b) => b.anim) && <span>{bricks.filter((b) => b.anim).length} with motion</span>}
            <span className="hint">
              {walkMode ? "Open Animate to save a stop in each room" : "Click or Space to place · Drag to orbit · R rotate · ? all shortcuts"}
            </span>
          </div>

          {mode === "build" && !walkMode && (
            <div className="custom" role="group" aria-label={"Settings for " + type.name}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <strong>{type.name}</strong>
                {(type.params || dim) && (
                  <button
                    className="btn sm"
                    style={{ flex: "none" }}
                    onClick={() => {
                      setOptsByType((p) => ({ ...p, [typeKey]: undefined }));
                      setDimByType((p) => ({ ...p, [typeKey]: undefined }));
                    }}
                  >Reset</button>
                )}
              </div>
              <p className="note" style={{ margin: "0 0 6px" }}>{w}×{d} studs · {dm.h} layer{dm.h === 1 ? "" : "s"} tall{dim ? " · stretched" : ""}</p>
              {type.params && <ParamControls params={type.params} opts={opts} onChange={setOpt} />}
              <details>
                <summary>Stretch to a custom size</summary>
                <DimControls dim={dim} base={baseDm} onChange={setDim} onReset={() => setDimByType((p) => ({ ...p, [typeKey]: undefined }))} />
              </details>
              {type.params && <p className="note">Keys: {"{ }"} width, {"< >"} length, {"( )"} height, Y and I styles, L toggle</p>}
            </div>
          )}

          {selectCard}

          {marquee && (
            <div className="marquee" style={{ left: Math.min(marquee.x0, marquee.x1), top: Math.min(marquee.y0, marquee.y1), width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0) }} />
          )}

          {note && <div className="toast" role="status">{note}</div>}

          {photoOpen && (
            <div className="drawer" role="dialog" aria-label="Photos">
              <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                <strong>Photos</strong>
                <button className="btn sm" style={{ flex: "none" }} onClick={() => setPhotoOpen(false)}>Close</button>
              </div>
              <div className="h">Angles</div>
              <div className="chips" style={{ marginBottom: 8 }}>
                {photoViews().map((v) => {
                  const picked = photoPick.includes(v.key);
                  return (
                    <button
                      key={v.key}
                      className={"chip sm" + (picked ? " on" : "")}
                      aria-pressed={picked}
                      onClick={() => setPhotoPick((p) => (p.includes(v.key) ? p.filter((k) => k !== v.key) : [...p, v.key]))}
                    >{v.name}</button>
                  );
                })}
              </div>
              <div className="h">Size</div>
              <div className="row">
                {PHOTO_SIZES.map(([n, label]) => (
                  <button key={n} className={on(photoSize === n).trim()} onClick={() => setPhotoSize(n)}>{label}</button>
                ))}
              </div>
              <label className="note" style={{ display: "flex", gap: 6, alignItems: "center", margin: "4px 0 8px" }}>
                <input type="checkbox" checked={photoSheet} onChange={(e) => setPhotoSheet(e.target.checked)} />
                Also make one picture with all the angles
              </label>
              <button className="btn accent" style={{ width: "100%" }} onClick={() => takeShots(photoPick)} disabled={!!busy}>
                Take {photoPick.length} photo{photoPick.length === 1 ? "" : "s"} and save
              </button>
              <p className="note">Photos download as PNG files. Press J any time to save the view you are looking at. Angles you saved in Animate and tour stops show up here too.</p>
              {!!album.length && (
                <>
                  <div className="row" style={{ alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                    <div className="h" style={{ margin: 0 }}>This session ({album.length})</div>
                    <button className="btn sm" style={{ flex: "none" }} onClick={clearAlbum}>Clear</button>
                  </div>
                  <div className="album">
                    {album.map((x) => (
                      <button key={x.id} className="shotimg" onClick={() => savePhoto(x)} title={"Save " + x.name + " again"}>
                        <img src={x.url} alt={x.name} />
                        <span>{x.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {animOpen && (
            <div className="drawer" role="dialog" aria-label="Animation video">
              <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                <strong>Animation video</strong>
                <button className="btn sm" style={{ flex: "none" }} onClick={() => setAnimOpen(false)} disabled={!!busy}>Close</button>
              </div>

              <div className="h">Pieces</div>
              <div className="row">
                <button className={on(anim === "build").trim()} onClick={() => setAnim("build")} disabled={!!busy}>Build-up</button>
                <button className={on(anim === "finished").trim()} onClick={() => setAnim("finished")} disabled={!!busy}>Finished</button>
              </div>

              <div className="h">Piece motion</div>
              <div className="row">
                <button className={on(animPieces).trim()} onClick={() => setAnimPieces(true)} disabled={!!busy}>Include</button>
                <button className={on(!animPieces).trim()} onClick={() => setAnimPieces(false)} disabled={!!busy}>Leave out</button>
              </div>

              <div className="h">Camera</div>
              <div className="row">
                <button className={on(camMode === "orbit").trim()} onClick={() => chooseCam("orbit")} disabled={!!busy}>Orbit</button>
                <button className={on(camMode === "angles").trim()} onClick={() => chooseCam("angles")} disabled={!!busy}>Angles</button>
                <button
                  className={on(camMode === "tour").trim()}
                  onClick={() => chooseCam("tour")}
                  disabled={!!busy}
                >Home tour</button>
              </div>

              {camMode === "angles" && (
                <div style={{ marginBottom: 10 }}>
                  {shots.map((sh, i) => (
                    <div className="shot" key={i}>
                      <span>Angle {i + 1}</span>
                      <button className="btn sm" onClick={() => setView(sh)} disabled={!!busy}>Go</button>
                      <button className="btn sm" aria-label={"Remove angle " + (i + 1)} onClick={() => setShots((p) => p.filter((_, j) => j !== i))} disabled={!!busy}>×</button>
                    </div>
                  ))}
                  <button className="btn" style={{ width: "100%" }} onClick={addShot} disabled={!!busy || shots.length >= 8}>+ Save current view</button>
                  <p className="note">Rotate and zoom to a view, then save it. The video flies through the angles in order.</p>
                </div>
              )}

              {camMode === "tour" && (
                <div style={{ marginBottom: 10 }}>
                  {stops.map((st, i) => (
                    <div className="shot" key={i}>
                      <span>Stop {i + 1}</span>
                      <button className="btn sm" onClick={() => goStop(st)} disabled={!!busy}>Go</button>
                      <button className="btn sm" aria-label={"Remove stop " + (i + 1)} onClick={() => setStops((p) => p.filter((_, j) => j !== i))} disabled={!!busy}>×</button>
                    </div>
                  ))}
                  <button className="btn" style={{ width: "100%" }} onClick={addStop} disabled={!!busy || stops.length >= 12}>+ Add stop here</button>
                  <div className="h" style={{ marginTop: 10 }}>Pace</div>
                  <div className="row">
                    {[[2, "Fast"], [3, "Normal"], [5, "Slow"]].map(([secs, label]) => (
                      <button key={secs} className={on(stopSecs === secs).trim()} onClick={() => setStopSecs(secs)} disabled={!!busy}>{label}</button>
                    ))}
                  </div>
                  <p className="note">Walk to the start of the tour and add a stop. Then walk to the next room and add another. The camera glides through the stops in order, like a walkthrough.</p>
                </div>
              )}

              {busy ? (
                <div>
                  <div className="bar"><div style={{ width: Math.round(progress * 100) + "%" }} /></div>
                  <p className="note">{{ gif: "Encoding GIF", video: "Recording video", preview: "Previewing" }[busy]}… {Math.round(progress * 100)}%</p>
                  <button className="btn" style={{ width: "100%", marginTop: 8 }} onClick={() => (cancelRef.current.v = true)}>Cancel</button>
                </div>
              ) : (
                <>
                  <div className="row" style={{ marginBottom: 4 }}>
                    <button className="btn" onClick={() => exportAnimation("preview")} title="Preview (P)">Preview</button>
                    <button className="btn" onClick={() => exportAnimation("gif")} title="Export GIF (G)">GIF</button>
                    <button className="btn" onClick={() => exportAnimation("video")} title="Export video (V)">Video</button>
                  </div>
                  <p className="note">About {Math.round(plan.total)} seconds. Preview plays on screen without saving.</p>
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {helpOpen && (
        <div className="overlay" onClick={() => setHelpOpen(false)}>
          <div className="help" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 0 }}>
              <h2>Keyboard shortcuts</h2>
              <button className="btn sm" style={{ flex: "none" }} onClick={() => setHelpOpen(false)} autoFocus>Close (Esc)</button>
            </div>
            <p className="note">On a Mac, use ⌘ instead of Ctrl. Shortcuts are paused while you type in the search box.</p>
            <div className="cols">
              {SHORTCUTS.map(([title, items]) => (
                <section key={title}>
                  <h3>{title}</h3>
                  <ul>
                    {items.map(([keysLabel, what]) => (
                      <li key={keysLabel + what}>
                        <kbd>{keysLabel}</kbd>
                        <span>{what}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
