import * as THREE from "three";
import { GIFEncoder, quantize, applyPalette } from "gifenc";

const ease = (x) => 1 - Math.pow(1 - x, 3);

const smooth = (x) => x * x * (3 - 2 * x);

/* reveal "build": pieces drop in one by one in the order they were placed.
   reveal "finished": the whole model is shown from the start.
   camera "orbit": one full turn around the model from the current view.
   camera "angles": fly smoothly through the saved orbit shots, in order.
   camera "tour": a first-person home tour that glides through saved walk stops. */
const forward = (yaw, pitch) =>
  new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));

function makeTour(stops) {
  const pos = stops.map((s) => new THREE.Vector3(s.x, s.y, s.z));
  const look = stops.map((s, i) => pos[i].clone().addScaledVector(forward(s.yaw, s.pitch), 5));
  if (stops.length === 1) return { single: { pos: pos[0], look: look[0] } };
  // "catmullrom" (not centripetal) so two stops at the same spot don't break the curve
  const curve = (pts) => new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
  return { pos: curve(pos), look: curve(look) };
}

export function planAnimation(count, reveal, camera = "orbit", shots = [], tour = { stops: [], secs: 3 }) {
  const build = reveal === "build";
  const buildTime = build ? Math.min(8, Math.max(2.5, count * 0.12)) : 0;
  const drop = 0.4;
  const useShots = camera === "angles" && shots.length > 0;
  const useTour = camera === "tour" && tour.stops.length > 0;
  const camTotal = useTour
    ? tour.stops.length > 1 ? (tour.stops.length - 1) * tour.secs + 1 : 4
    : useShots
      ? shots.length > 1 ? ((shots.length - 1) * 2.5) / 0.9 : 4
      : 6;
  const total = build ? Math.max(camTotal, buildTime + drop + 2.5) : camTotal;
  return {
    count, reveal, buildTime, drop, total,
    shots: useShots ? shots : null,
    tour: useTour ? makeTour(tour.stops) : null,
    fov: useTour ? 65 : 45, // interiors need a wider lens
  };
}

/* Camera pose at progress u (0..1). Shots are blended with a smooth ease, taking the
   shorter way around for rotation. A short hold sits at the start and the end. */
function cameraAt(plan, env, u) {
  const s = plan.shots;
  if (!s) return { theta: env.startTheta + u * Math.PI * 2, phi: env.startPhi, radius: env.startRadius };
  if (s.length === 1) return s[0];
  const v = Math.min(1, Math.max(0, (u - 0.05) / 0.9)) * (s.length - 1);
  const i = Math.min(Math.floor(v), s.length - 2);
  const f = smooth(v - i);
  const [p, q] = [s[i], s[i + 1]];
  const turn = ((((q.theta - p.theta + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return { theta: p.theta + turn * f, phi: p.phi + (q.phi - p.phi) * f, radius: p.radius + (q.radius - p.radius) * f };
}

/* Pose the scene at time t (seconds) and render one frame. */
export function poseScene(env, plan, t, order) {
  const { brickGroup, orbit, updateCamera, renderer, scene, camera, ghost } = env;
  if (ghost) ghost.visible = false;
  const n = plan.count;
  brickGroup.children.forEach((g) => {
    if (plan.reveal !== "build") {
      g.visible = true;
      g.position.y = g.userData.baseY;
      return;
    }
    const i = order.get(g.userData.pid) ?? 0;
    const start = n > 1 ? (i / (n - 1)) * plan.buildTime : 0;
    const local = (t - start) / plan.drop;
    g.visible = local > 0;
    g.position.y = g.userData.baseY + (1 - ease(Math.min(1, Math.max(0, local)))) * 8;
  });
  if (camera.fov !== plan.fov) {
    camera.fov = plan.fov;
    camera.updateProjectionMatrix();
  }
  if (plan.tour) {
    const tr = plan.tour;
    let p, l;
    if (tr.single) ({ pos: p, look: l } = tr.single);
    else {
      const u = Math.min(1, Math.max(0, (t - 0.5) / (plan.total - 1))); // short hold at both ends
      p = tr.pos.getPoint(u);
      l = tr.look.getPoint(u);
    }
    camera.position.copy(p);
    camera.lookAt(l);
  } else {
    Object.assign(orbit, cameraAt(plan, env, t / plan.total));
    updateCamera();
  }
  renderer.render(scene, camera);
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* Play the animation on screen in real time. */
function playRealtime(env, plan, order, onProgress, cancelled) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = () => {
      const t = Math.min((performance.now() - t0) / 1000, plan.total);
      poseScene(env, plan, t, order);
      onProgress(t / plan.total);
      if (cancelled() || t >= plan.total) return resolve();
      requestAnimationFrame(tick);
    };
    tick();
  });
}

export async function playPreview(env, plan, order, onProgress, cancelled) {
  await playRealtime(env, plan, order, onProgress, cancelled);
  return null;
}

/* Real-time capture of the canvas with MediaRecorder (WebM, or MP4 where supported). */
export async function recordVideo(env, plan, order, onProgress, cancelled) {
  const canvas = env.renderer.domElement;
  const mime = ["video/webm;codecs=vp9", "video/webm", "video/mp4"].find(
    (m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)
  );
  if (!mime) throw new Error("this browser can't record video. Try the GIF option.");
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((res) => (rec.onstop = res));
  rec.start();
  await playRealtime(env, plan, order, onProgress, cancelled);
  await new Promise((r) => requestAnimationFrame(r)); // let the last frame reach the recorder
  rec.stop();
  await stopped;
  stream.getTracks().forEach((tr) => tr.stop());
  if (cancelled()) return null;
  return { blob: new Blob(chunks, { type: mime.split(";")[0] }), ext: mime.startsWith("video/mp4") ? "mp4" : "webm" };
}

/* Frame-by-frame GIF: render, copy to a small 2D canvas, quantize, encode. */
export async function recordGif(env, plan, order, onProgress, cancelled, width = 480, fps = 15) {
  const src = env.renderer.domElement;
  const w = width;
  const h = Math.round((width * src.height) / src.width);
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const ctx = off.getContext("2d", { willReadFrequently: true });
  const gif = GIFEncoder();
  const frames = Math.round(plan.total * fps);
  for (let i = 0; i < frames; i++) {
    if (cancelled()) return null;
    poseScene(env, plan, (i / frames) * plan.total, order);
    ctx.drawImage(src, 0, 0, w, h); // must happen right after render, before the browser repaints
    const { data } = ctx.getImageData(0, 0, w, h);
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), w, h, { palette, delay: Math.round(1000 / fps) });
    onProgress((i + 1) / frames);
    await new Promise((r) => setTimeout(r, 0)); // keep the page responsive
  }
  gif.finish();
  return { blob: new Blob([gif.bytes()], { type: "image/gif" }), ext: "gif" };
}
