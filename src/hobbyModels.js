/* Swaps some Hobby Builder pieces for detailed models made in Blender
   (blender/make_hobby_models.py -> public/models/hobby.glb). Footprints and heights are unchanged,
   so saved builds look the same apart from the detail. If the file can't be loaded, the simple pieces stay. */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TYPES } from "./hobbyBuilderPieces";

const materials = new Map();

/* "color…" materials take the colour picked in the app; the rest keep Blender's colour */
function materialFor(base, color) {
  const tinted = base.name.startsWith("color");
  const key = tinted ? base.name + color : base.name;
  if (!materials.has(key)) {
    const m = base.clone();
    if (tinted) {
      m.color.set(color);
      if (base.name === "color_dark") m.color.multiplyScalar(0.62);
    }
    if (base.alphaTest > 0) {
      m.side = THREE.DoubleSide;
      m.color.multiplyScalar(1.5); // the leaf texture darkens the colour, so lift it back
    }
    materials.set(key, m);
  }
  return materials.get(key);
}

function useModels(gltf) {
  gltf.scene.updateMatrixWorld(true);
  for (const root of gltf.scene.children) {
    const type = TYPES[root.name];
    if (!type) continue;
    const parts = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      if (o.material.map) o.material.map.anisotropy = 8;
      parts.push({ geometry: o.geometry.clone().applyMatrix4(o.matrixWorld), material: o.material });
    });
    type.build = (color) => {
      const group = new THREE.Group();
      for (const part of parts) {
        const mesh = new THREE.Mesh(part.geometry, materialFor(part.material, color));
        if (part.material.alphaTest > 0) mesh.userData.noWalk = true; // you can walk through leaves
        group.add(mesh);
      }
      return group;
    };
  }
}

/* Resolves when the models are in place, or after `timeout` ms so a slow network never blocks the app. */
export function loadHobbyModels(timeout = 8000) {
  const url = `${import.meta.env.BASE_URL}models/hobby.glb`;
  const load = new GLTFLoader().loadAsync(url).then(useModels).catch((err) => console.warn("Detailed models not loaded:", err));
  return Promise.race([load, new Promise((resolve) => setTimeout(resolve, timeout))]);
}
