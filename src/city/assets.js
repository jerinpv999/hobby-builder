/* The detailed models made in Blender (blender/make_models.py -> public/models/city.glb).
   Buildings are assembled from a ground floor, repeated floors and a roof, then merged by
   material and cached, so every copy of the same building shares its geometry. */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// floor height of each stacked building (matches the heights used for lamps and flight clearance)
const FLOORS = { house: 0.32, apartment: 0.28, shop: 0.3, tower: 0.3, office: 0.28, hotel: 0.27, mall: 0.3, hospital: 0.3, school: 0.28, firestation: 0.3, terminal: 0.28, factory: 0.3 };
const SINGLE = ["gasstation", "atc", "hangar", "silo", "treatment", "barn", "greenhouse"];
const CROP = { spring: "#9bd65a", summer: "#a9bf3f", autumn: "#eab842", winter: "#b9a06a" };

const mix = (a, b, k) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();

/* which parts make up a tile, and the colour of each tinted material */
function recipe(cell, season, foliage) {
  const { t, f = 1, c = "#ffffff" } = cell;
  const colors = {
    tint: c, tintbrick: mix(c, "#a85a3c", 0.3), tintmetal: c, tintglass: mix(c, "#4a7196", 0.25), tail: c,
    leaf: foliage("#4f9d4a"), pine: foliage("#2f7a45"),
  };
  const parts = [];
  const add = (name, o = {}) => parts.push({ name, ...o });
  const fh = FLOORS[t];
  if (fh) {
    const z = t === "school" ? -0.14 : t === "terminal" ? -0.2 : 0;
    add(t + "_base", { z });
    for (let i = 1; i < f; i++) add(t === "tower" || t === "office" || t === "apartment" || t === "hotel" || t === "mall" || t === "hospital" ? `${t}_floor_${i % 3 ? "a" : "b"}` : t + "_floor_a", { y: i * fh, z });
    add(t === "tower" ? (f >= 10 ? "tower_roof_tall" : "tower_roof_low") : t + "_roof", { y: f * fh, z });
  } else if (SINGLE.includes(t)) add(t);
  else if (t === "church") add(t, { sy: f === 1 ? 1 : 1.25 });
  else if (t === "stadium") add(t, { sy: 0.75 + 0.25 * f });
  else if (t === "warehouse") add(t, { sy: (0.26 * f + 0.06) / 0.3 });
  else if (t === "tree") {
    const s = 0.8 + 0.3 * (f - 1);
    const pine = c === "#3f8a43" || c === "#2f7a45";
    colors.leaf = foliage(c);
    colors.pine = foliage(c);
    add(pine ? "tree_pine" : season === "winter" ? "tree_bare" : "tree_broad", { s });
  } else if (t === "park") {
    add("park");
    add(season === "winter" ? "park_bare" : "park_trees");
    add("park_bushes");
  } else if (t === "field") {
    colors.crop = CROP[season];
    add("wheat_crop", { y: 0.03, sy: { spring: 0.07, summer: 0.13, autumn: 0.15, winter: 0.035 }[season] });
  } else if (t === "paddy") {
    if (season !== "winter") {
      colors.crop = { spring: "#b4ea72", summer: "#57b83c", autumn: "#e6c64e" }[season];
      add("paddy_crop", { y: 0.025, sy: season === "spring" ? 0.08 : 0.15 });
    }
  } else if (t === "vegfarm") {
    if (season !== "winter") {
      add("veg_leaves", { sy: season === "spring" ? 0.7 : 1 });
      colors.fruit = season === "autumn" ? "#e8862a" : "#d8412f";
      if (season !== "spring") add("veg_produce");
    }
  } else if (t === "orchard") {
    if (season === "spring") colors.leaf = "#ffc4da";
    for (const [x, z] of [[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.24, 0.24]]) {
      add(season === "winter" ? "orchard_bare" : "orchard_tree", { x, z, y: 0.02 });
      if (season === "summer" || season === "autumn") add("orchard_fruit", { x, z, y: 0.02 });
    }
  } else if (t === "pasture") {
    add("pasture");
    add("cow", { x: -0.17, z: -0.12, ry: 0.4 });
    add("cow", { x: 0.2, z: 0.18, ry: -2.2 });
  } else if (t === "turbine") add("turbine_tower");
  else if (t === "railstation" || t === "metrostation") add(t);
  else return null;
  return { parts, colors };
}

export function createAssets(url) {
  const models = new Map(); // name -> [{ geometry, material }]
  const textures = new Map();
  const merged = new Map();
  const materials = new Map();
  let makeMaterial = (base) => base.clone();
  let ready = false;
  let loading = null;

  function load() {
    loading ||= new GLTFLoader().loadAsync(url).then((gltf) => {
      gltf.scene.updateMatrixWorld(true);
      for (const root of gltf.scene.children) {
        const list = [];
        root.traverse((o) => {
          if (!o.isMesh) return;
          const m = o.material;
          [m.map, m.normalMap].forEach((t) => { if (t) t.anisotropy = 8; });
          if (m.name.startsWith("surface_")) textures.set(m.name.slice(8), m.map || m.normalMap);
          list.push({ geometry: o.geometry.clone().applyMatrix4(o.matrixWorld), material: m });
        });
        models.set(root.name, list);
      }
      ready = true;
    }).catch((err) => { loading = null; throw err; });
    return loading;
  }

  function material(base, color) {
    const tinted = color && base.name !== "glass" && base.name !== "glasslit";
    const key = base.name + (tinted ? color : "");
    if (!materials.has(key)) materials.set(key, makeMaterial(base, tinted ? color : null));
    return materials.get(key);
  }

  /* parts: [{ name, x, y, z, ry, s, sy }] merged into one mesh per material */
  function compose(parts, colors) {
    const key = parts.map((p) => [p.name, p.x, p.y, p.z, p.ry, p.s, p.sy].join()).join("|");
    if (!merged.has(key)) {
      const buckets = new Map();
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
      for (const p of parts) {
        const s = p.s || 1;
        m4.compose(new THREE.Vector3(p.x || 0, p.y || 0, p.z || 0), q.setFromAxisAngle(up, p.ry || 0), new THREE.Vector3(s, s * (p.sy || 1), s));
        for (const { geometry, material: base } of models.get(p.name) || []) {
          if (!buckets.has(base)) buckets.set(base, []);
          buckets.get(base).push(geometry.clone().applyMatrix4(m4));
        }
      }
      merged.set(key, [...buckets].map(([base, list]) => {
        const geometry = mergeGeometries(list);
        list.forEach((g) => g.dispose());
        return { geometry, base };
      }));
    }
    const group = new THREE.Group();
    group.userData.cached = true;
    for (const { geometry, base } of merged.get(key)) {
      const mesh = new THREE.Mesh(geometry, material(base, colors[base.name]));
      mesh.castShadow = !mesh.material.transparent;
      mesh.receiveShadow = true;
      mesh.userData.cached = true; // geometry and material belong to this cache
      group.add(mesh);
    }
    return group;
  }

  return {
    load,
    get ready() { return ready; },
    setMaterialFactory(fn) { makeMaterial = fn; },
    texture: (name) => textures.get(name) || null,
    model: (name, colors = {}) => compose([{ name }], colors),
    tile(cell, season, foliage) {
      const r = recipe(cell, season, foliage);
      return r && compose(r.parts, r.colors);
    },
    dispose() {
      merged.forEach((list) => list.forEach((p) => p.geometry.dispose()));
      materials.forEach((m) => m.dispose());
      merged.clear();
      materials.clear();
    },
  };
}
