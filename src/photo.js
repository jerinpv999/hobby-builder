import * as THREE from "three";

/* Photos: still pictures of the build from different camera angles.
   A view is { kind: "orbit", theta, phi, radius } or { kind: "walk", x, y, z, yaw, pitch }. */
export const PRESET_VIEWS = [
  { key: "front", name: "Front", theta: 0, phi: 1.15 },
  { key: "right", name: "Right", theta: Math.PI / 2, phi: 1.15 },
  { key: "back", name: "Back", theta: Math.PI, phi: 1.15 },
  { key: "left", name: "Left", theta: -Math.PI / 2, phi: 1.15 },
  { key: "top", name: "Top", theta: 0, phi: 0.2 },
  { key: "iso", name: "Corner", theta: 0.8, phi: 0.95 },
  { key: "iso2", name: "Far corner", theta: 0.8 + Math.PI, phi: 0.95 },
];
export const PHOTO_SIZES = [[1, "Screen size"], [2, "HD (2x)"], [4, "Large (4x)"]];
const MAX_SIDE = 4096; // keeps big photos inside what browsers can render

const forward = (yaw, pitch) =>
  new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));

/* Take one photo. Returns an offscreen canvas. The live scene is put back exactly as it was. */
function shoot(env, view, scale) {
  const { renderer, scene, camera, orbit, updateCamera, ghost, selBoxes, pathViz } = env;
  const hidden = [ghost, pathViz, ...(selBoxes || [])].filter((o) => o && o.visible);
  hidden.forEach((o) => (o.visible = false)); // no placement ghost, selection outlines or path lines in a photo
  const savedOrbit = { ...orbit };
  const savedPos = camera.position.clone();
  const savedQuat = camera.quaternion.clone();
  const savedFov = camera.fov;
  const savedRatio = renderer.getPixelRatio();
  const size = renderer.getSize(new THREE.Vector2());
  try {
    if (view) {
      if (view.kind === "walk") {
        camera.fov = 65;
        camera.updateProjectionMatrix();
        camera.position.set(view.x, view.y, view.z);
        camera.lookAt(camera.position.clone().add(forward(view.yaw, view.pitch)));
      } else {
        camera.fov = 45;
        camera.updateProjectionMatrix();
        Object.assign(orbit, { theta: view.theta, phi: view.phi, radius: view.radius });
        updateCamera();
      }
    }
    const ratio = Math.min(Math.max(1, savedRatio) * scale, MAX_SIDE / Math.max(size.x, size.y));
    renderer.setPixelRatio(ratio);
    renderer.render(scene, camera);
    const src = renderer.domElement;
    const out = document.createElement("canvas");
    out.width = src.width;
    out.height = src.height;
    out.getContext("2d").drawImage(src, 0, 0); // copy right after render, before the browser repaints
    return out;
  } finally {
    renderer.setPixelRatio(savedRatio);
    Object.assign(orbit, savedOrbit);
    camera.fov = savedFov;
    camera.updateProjectionMatrix();
    camera.position.copy(savedPos);
    camera.quaternion.copy(savedQuat);
    hidden.forEach((o) => (o.visible = true));
    renderer.render(scene, camera);
  }
}

export const canvasToBlob = (canvas) =>
  new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("couldn't make the image"))), "image/png"));

/* Take photos from a list of { name, view } (view null = whatever the camera shows now).
   Returns [{ name, canvas }]. */
export function takePhotos(env, list, scale = 1) {
  return list.map(({ name, view }) => ({ name, canvas: shoot(env, view, scale) }));
}

/* Put several photos on one picture, in a grid, each with its name. */
export function contactSheet(photos, cols = 0) {
  const n = photos.length;
  const c = cols || Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / c);
  const cw = photos[0].canvas.width;
  const ch = photos[0].canvas.height;
  const gap = Math.round(cw * 0.02);
  const label = Math.round(cw * 0.05);
  const sheet = document.createElement("canvas");
  sheet.width = c * cw + (c + 1) * gap;
  sheet.height = rows * (ch + label) + (rows + 1) * gap;
  const ctx = sheet.getContext("2d");
  ctx.fillStyle = "#101828";
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.font = `600 ${Math.round(label * 0.7)}px system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  photos.forEach((p, i) => {
    const x = gap + (i % c) * (cw + gap);
    const y = gap + Math.floor(i / c) * (ch + label + gap);
    ctx.drawImage(p.canvas, x, y + label, cw, ch);
    ctx.fillStyle = "#e8eefc";
    ctx.fillText(p.name, x + 4, y + label / 2);
  });
  return sheet;
}
