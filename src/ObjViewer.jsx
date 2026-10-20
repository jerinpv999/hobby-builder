/* global TextDecoder, Response, DecompressionStream */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildObj } from "./objExport";

/* A built-in viewer for .obj models: your current build, or any .obj (+ .mtl) or the zip made by Export OBJ. */

function parseMtl(txt) {
  const m = {}; let cur = null;
  txt.split(/\r?\n/).forEach((l) => {
    const p = l.trim().split(/\s+/), k = p[0];
    if (k === "newmtl") cur = m[p.slice(1).join(" ")] = { kd: [0.8, 0.8, 0.8], d: 1, ke: null };
    else if (cur && k === "Kd") cur.kd = [+p[1], +p[2], +p[3]];
    else if (cur && k === "Ke" && (+p[1] || +p[2] || +p[3])) cur.ke = [+p[1], +p[2], +p[3]];
    else if (cur && k === "d") cur.d = +p[1];
    else if (cur && k === "Tr") cur.d = 1 - p[1];
  });
  return m;
}

function buildModel(objTxt, mtl, wire) {
  const V = [], N = [], groups = {};
  let cur = "default";
  const g = (n) => groups[n] || (groups[n] = { pos: [], nor: [] });
  for (const l of objTxt.split(/\r?\n/)) {
    if (!l || l[0] === "#") continue;
    const p = l.trim().split(/\s+/), k = p[0];
    if (k === "v") V.push(+p[1], +p[2], +p[3]);
    else if (k === "vn") N.push(+p[1], +p[2], +p[3]);
    else if (k === "usemtl") cur = p.slice(1).join(" ");
    else if (k === "f") {
      const idx = [];
      for (let j = 1; j < p.length; j++) {
        const s = p[j].split("/"); let vi = +s[0], ni = s[2] ? +s[2] : 0;
        vi = vi < 0 ? V.length / 3 + vi : vi - 1; ni = ni < 0 ? N.length / 3 + ni : ni - 1;
        idx.push([vi, s[2] ? ni : -1]);
      }
      const G = g(cur);
      for (let t = 1; t < idx.length - 1; t++) for (const q of [idx[0], idx[t], idx[t + 1]]) {
        G.pos.push(V[q[0] * 3], V[q[0] * 3 + 1], V[q[0] * 3 + 2]);
        if (q[1] >= 0 && N.length) G.nor.push(N[q[1] * 3], N[q[1] * 3 + 1], N[q[1] * 3 + 2]); else G.nor.push(0, 0, 0);
      }
    }
  }
  const root = new THREE.Group(); let tris = 0;
  Object.keys(groups).forEach((n) => {
    const G = groups[n], geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(G.pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(G.nor, 3));
    if (!G.nor.some((x) => x !== 0)) geo.computeVertexNormals();
    const d = mtl && mtl[n];
    const mat = new THREE.MeshStandardMaterial({ color: d ? new THREE.Color(d.kd[0], d.kd[1], d.kd[2]) : new THREE.Color(0xb0b8c0), roughness: 0.7, metalness: 0, side: THREE.DoubleSide, transparent: !!d && d.d < 1, opacity: d ? d.d : 1, wireframe: wire });
    if (d && d.ke) mat.emissive = new THREE.Color(d.ke[0], d.ke[1], d.ke[2]);
    root.add(new THREE.Mesh(geo, mat));
    tris += G.pos.length / 9;
  });
  return { root, tris };
}

async function unzip(buf) { // stored or deflated entries
  const dv = new DataView(buf), u8 = new Uint8Array(buf), out = [];
  let e = buf.byteLength - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("not a zip file");
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
  for (let i = 0; i < n; i++) {
    const meth = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
    const ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
    let data = u8.subarray(ds, ds + csz);
    if (meth === 8) data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
    out.push({ name, text: new TextDecoder().decode(data) });
    p += 46 + nl + xl + cl;
  }
  return out;
}

async function readFiles(files) {
  const objs = [], mtls = [];
  for (const f of files) {
    const nm = f.name.toLowerCase();
    if (nm.endsWith(".zip")) (await unzip(await f.arrayBuffer())).forEach((z) => { const n = z.name.toLowerCase(); if (n.endsWith(".obj")) objs.push(z); else if (n.endsWith(".mtl")) mtls.push(z.text); });
    else if (nm.endsWith(".obj")) objs.push({ name: f.name, text: await f.text() });
    else if (nm.endsWith(".mtl")) mtls.push(await f.text());
  }
  if (!objs.length) throw new Error("no .obj file found");
  const mtl = {}; mtls.forEach((t) => Object.assign(mtl, parseMtl(t)));
  return { name: objs[0].name, obj: objs[0].text, mtl, hasMtl: mtls.length > 0 };
}

const CSS = `
.ov-wrap{width:min(1100px,100%);height:min(780px,100%);display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-radius:14px;background:#14213D;border:1px solid #33466b;box-shadow:0 12px 40px rgba(0,0,0,.5)}
.ov-top{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.ov-top h2{margin:0 auto 0 0;font-size:20px}
.ov-top .btn.on{background:#33466b;color:#fff}.ov-top .btn{color:#fff}
.ov-stage{position:relative;flex:1;min-height:240px;border-radius:10px;overflow:hidden;border:1px solid #33466b;background:#0b1326}
.ov-stage.light{background:#f4f6f8}
.ov-stage canvas{display:block;width:100%;height:100%;touch-action:none}
.ov-stage.over::after{content:"Drop files to view";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;border:2px dashed #7aa2ff;background:rgba(80,120,255,.2)}
.ov-info{font-size:13px;color:#A9B8D4;display:flex;flex-wrap:wrap;gap:4px 16px}
.ov-info b{color:#fff}
.ov-file{position:relative;overflow:hidden}
.ov-file input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%}
`;

export default function ObjViewer({ getRoot, onClose }) {
  const stageRef = useRef(null), cvRef = useRef(null), api = useRef({});
  const [wire, setWire] = useState(false), [spin, setSpin] = useState(true), [light, setLight] = useState(false);
  const [over, setOver] = useState(false);
  const [info, setInfo] = useState({ name: "", stats: "" }), [err, setErr] = useState("");
  const flags = useRef({ wire, spin }); flags.current = { wire, spin };

  useEffect(() => {
    const stage = stageRef.current, cv = cvRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(5, 10, 7); scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3); fill.position.set(-6, -3, -5); scene.add(fill);
    const grid = new THREE.GridHelper(1, 20, 0x888888, 0x888888); grid.material.opacity = 0.25; grid.material.transparent = true; scene.add(grid);
    const S = { model: null, target: new THREE.Vector3(), sph: { r: 10, th: 0.8, ph: 1.1 }, radius: 10, idle: 0 };
    const reset = () => { S.sph = { r: S.radius * 1.9, th: 0.8, ph: 1.1 }; };
    const show = (res, name, extra) => {
      if (S.model) { scene.remove(S.model); S.model.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
      S.model = res.root; scene.add(S.model);
      const box = new THREE.Box3().setFromObject(S.model), sz = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
      S.target.copy(ctr); S.radius = Math.max(sz.x, sz.y, sz.z, 0.001);
      grid.scale.setScalar(S.radius * 1.6); grid.position.set(ctr.x, box.min.y, ctr.z);
      cam.near = S.radius / 200; cam.far = S.radius * 60; cam.updateProjectionMatrix(); reset();
      setErr(""); setInfo({ name: name + (extra || ""), stats: `${Math.round(res.tris).toLocaleString()} triangles, size ${sz.x.toFixed(1)} x ${sz.y.toFixed(1)} x ${sz.z.toFixed(1)}` });
    };
    api.current = {
      reset,
      setWire: (on) => S.model && S.model.traverse((o) => { if (o.isMesh) o.material.wireframe = on; }),
      showBuild: () => {
        const root = getRoot && getRoot();
        if (!root) return;
        const { obj, mtl } = buildObj(root, "build");
        // reuse the exact exported text so what you see is what the file contains
        const m = {}; Object.assign(m, parseMtl(mtl));
        const res = buildModel(obj, m, flags.current.wire);
        if (!res.tris) { setErr("Nothing to show yet. Place some pieces first."); return; }
        show(res, "Your current build");
      },
      open: async (files) => {
        try { const r = await readFiles(files); show(buildModel(r.obj, r.mtl, flags.current.wire), r.name, r.hasMtl ? "" : " (no .mtl, shown grey)"); }
        catch (e) { setErr("Could not read that file: " + e.message); }
      },
    };
    api.current.showBuild();

    const pts = {}; let drag = null;
    const down = (e) => { cv.setPointerCapture(e.pointerId); pts[e.pointerId] = [e.clientX, e.clientY]; drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey }; S.idle = 0; };
    const move = (e) => {
      if (!pts[e.pointerId]) return;
      const ids = Object.keys(pts);
      if (ids.length === 2) {
        const o = ids.find((i) => +i !== e.pointerId), a = pts[o], b = pts[e.pointerId], d0 = Math.hypot(a[0] - b[0], a[1] - b[1]);
        pts[e.pointerId] = [e.clientX, e.clientY];
        const d1 = Math.hypot(a[0] - e.clientX, a[1] - e.clientY);
        if (d0 > 0) S.sph.r = Math.max(S.radius * 0.2, Math.min(S.radius * 12, (S.sph.r * d0) / d1));
        return;
      }
      pts[e.pointerId] = [e.clientX, e.clientY];
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      if (drag.pan) {
        const k = S.sph.r * 0.0016, r = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0), u = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1);
        S.target.addScaledVector(r, -dx * k).addScaledVector(u, dy * k);
      } else { S.sph.th -= dx * 0.008; S.sph.ph = Math.max(0.05, Math.min(Math.PI - 0.05, S.sph.ph - dy * 0.008)); }
    };
    const up = (e) => { delete pts[e.pointerId]; if (!Object.keys(pts).length) drag = null; };
    const wheel = (e) => { e.preventDefault(); S.sph.r = Math.max(S.radius * 0.2, Math.min(S.radius * 12, S.sph.r * Math.exp(e.deltaY * 0.0012))); S.idle = 0; };
    const ctx = (e) => e.preventDefault();
    cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move); cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", wheel, { passive: false }); cv.addEventListener("contextmenu", ctx);

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const w = stage.clientWidth, h = stage.clientHeight, pr = renderer.getPixelRatio();
      if (cv.width !== Math.round(w * pr) || cv.height !== Math.round(h * pr)) { renderer.setSize(w, h, false); cam.aspect = w / Math.max(h, 1); cam.updateProjectionMatrix(); }
      S.idle++;
      if (flags.current.spin && !drag && S.idle > 30) S.sph.th += 0.004;
      const { r, th, ph } = S.sph, t = S.target;
      cam.position.set(t.x + r * Math.sin(ph) * Math.sin(th), t.y + r * Math.cos(ph), t.z + r * Math.sin(ph) * Math.cos(th));
      cam.lookAt(t); renderer.render(scene, cam);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      cv.removeEventListener("pointerdown", down); cv.removeEventListener("pointermove", move); cv.removeEventListener("pointerup", up); cv.removeEventListener("pointercancel", up);
      cv.removeEventListener("wheel", wheel); cv.removeEventListener("contextmenu", ctx);
      if (S.model) S.model.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      renderer.dispose();
    };
  }, []); // set up once; the latest props are read through getRoot

  const drop = (e) => { e.preventDefault(); setOver(false); api.current.open(e.dataTransfer.files); };
  return (
    <div className="overlay" onClick={onClose}>
      <style>{CSS}</style>
      <div className="ov-wrap" role="dialog" aria-modal="true" aria-label="3D model viewer" onClick={(e) => e.stopPropagation()}>
        <div className="ov-top">
          <h2>3D model viewer</h2>
          <button className="btn sm" onClick={() => api.current.showBuild()} title="Show what you have built right now">My build</button>
          <label className="btn sm ov-file" title="Open a .obj file with its .mtl, or the zip from Export OBJ">Open file
            <input type="file" multiple accept=".obj,.mtl,.zip" onChange={(e) => { api.current.open(e.target.files); e.target.value = ""; }} />
          </label>
          <button className={"btn sm" + (wire ? " on" : "")} aria-pressed={wire} onClick={() => { setWire(!wire); api.current.setWire(!wire); }}>Wireframe</button>
          <button className={"btn sm" + (spin ? " on" : "")} aria-pressed={spin} onClick={() => setSpin(!spin)}>Auto-rotate</button>
          <button className={"btn sm" + (light ? " on" : "")} aria-pressed={light} onClick={() => setLight(!light)}>Light stage</button>
          <button className="btn sm" onClick={() => api.current.reset()}>Reset view</button>
          <button className="btn sm" onClick={onClose} autoFocus>Close (Esc)</button>
        </div>
        <div ref={stageRef} className={"ov-stage" + (light ? " light" : "") + (over ? " over" : "")}
          onDragEnter={(e) => { e.preventDefault(); setOver(true); }} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}>
          <canvas ref={cvRef} />
        </div>
        <div className="ov-info">
          <span><b>{info.name}</b></span><span>{info.stats}</span>
          {err && <span style={{ color: "#ffb4a2" }}>{err}</span>}
          <span>Drag to rotate, scroll or pinch to zoom, right-drag or Shift-drag to pan. Drop an .obj with its .mtl, or the Export OBJ zip.</span>
        </div>
      </div>
    </div>
  );
}
