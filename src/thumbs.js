import * as THREE from "three";
import { TYPES, buildPiece } from "./hobbyBuilderPieces";

/* Renders a small preview image of each piece for the picker. One shared offscreen
   renderer is used, and every image is cached by piece + color. */
let renderer = null;
let scene = null;
let camera = null;
let failed = false;
const cache = new Map();

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(128, 128, false);
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#ffffff", "#8aa1b4", 1.0));
  const sun = new THREE.DirectionalLight("#ffffff", 1.1);
  sun.position.set(3, 6, 4);
  scene.add(sun);
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 300);
}

export const peekThumb = (key, color) => cache.get(key + "|" + color) || null;

export function getThumb(key, color) {
  const ck = key + "|" + color;
  if (cache.has(ck)) return cache.get(ck);
  if (failed) return null;
  try {
    if (!renderer) init();
    const piece = buildPiece(TYPES[key], color, 0, 0);
    scene.add(piece);
    piece.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(piece, true);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const dir = new THREE.Vector3(1, 0.85, 1.2).normalize();
    const dist = (sphere.radius / Math.sin(THREE.MathUtils.degToRad(15))) * 1.02;
    camera.position.copy(sphere.center).addScaledVector(dir, dist);
    camera.lookAt(sphere.center);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL("image/png");
    scene.remove(piece);
    cache.set(ck, url);
    return url;
  } catch {
    failed = true; // no WebGL for the offscreen canvas: the picker falls back to names only
    return null;
  }
}
