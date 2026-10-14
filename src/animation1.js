import { GIFEncoder, quantize, applyPalette } from "gifenc";

const ease = (x) => 1 - Math.pow(1 - x, 3);

/* style "build": pieces drop in one by one in the order they were placed while
   the camera circles the scene once. style "turntable": finished model, one full turn. */
export function planAnimation(count, style) {
  const build = style === "build";
  const buildTime = build ? Math.min(8, Math.max(2.5, count * 0.12)) : 0;
  const drop = 0.4;
  return { count, style, buildTime, drop, total: build ? buildTime + drop + 3 : 6 };
}

/* Pose the scene at time t (seconds) and render one frame. */
export function poseScene(env, plan, t, order) {
  const { brickGroup, orbit, updateCamera, renderer, scene, camera, ghost } = env;
  if (ghost) ghost.visible = false;
  const n = plan.count;
  brickGroup.children.forEach((g) => {
    if (plan.style !== "build") {
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
  orbit.theta = env.startTheta + (t / plan.total) * Math.PI * 2;
  updateCamera();
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
  const t0 = performance.now();
  await new Promise((resolve) => {
    const tick = () => {
      const t = Math.min((performance.now() - t0) / 1000, plan.total);
      poseScene(env, plan, t, order);
      onProgress(t / plan.total);
      if (cancelled() || t >= plan.total) return resolve();
      requestAnimationFrame(tick);
    };
    tick();
  });
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
