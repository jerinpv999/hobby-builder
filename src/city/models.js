/* Models made in Hobby Builder, rebuilt as city objects.
   Each one is built once, its still parts merged by material, then cloned for every placement. */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { parseStructure } from "../structureIO";
import { buildPiece, TYPES as PIECES, BH } from "../hobbyBuilderPieces";
import { spinFans } from "../pieceAnimations";

const STUDS_PER_TILE = 16; // default scale: a 16-stud build fills one city tile
export const MIN_SIZE = 0.3;
export const MAX_SIZE = 8;

function buildPrototype(pieces) {
  const root = new THREE.Group();
  const moving = [];
  const byMaterial = new Map();
  const content = new THREE.Group();
  for (const p of pieces) {
    const g = buildPiece(PIECES[p.type], p.color, p.id, p.rot, null, p.opts, p.dim);
    g.position.set(p.x, p.y * BH, p.z);
    root.add(g);
  }
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  for (const g of [...root.children]) {
    let moves = false;
    g.traverse((o) => { if (o.userData.spin) moves = true; });
    if (moves) { moving.push(g); continue; }
    g.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      if (Array.isArray(o.material) || o.isInstancedMesh || o.matrixWorld.determinant() < 0) {
        const copy = o.clone(false);
        o.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale);
        content.add(copy);
        return;
      }
      const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      Object.keys(geo.attributes).forEach((k) => { if (!["position", "normal", "uv"].includes(k)) geo.deleteAttribute(k); });
      if (!geo.attributes.normal) geo.computeVertexNormals();
      if (!geo.attributes.uv) geo.setAttribute("uv", new THREE.Float32BufferAttribute(geo.attributes.position.count * 2, 2));
      geo.morphAttributes = {};
      geo.clearGroups();
      geo.applyMatrix4(o.matrixWorld);
      if (!byMaterial.has(o.material)) byMaterial.set(o.material, []);
      byMaterial.get(o.material).push(geo);
    });
  }
  const owned = [];
  byMaterial.forEach((list, material) => {
    const merged = mergeGeometries(list);
    list.forEach((g) => g.dispose());
    if (!merged) return;
    owned.push(merged);
    const m = new THREE.Mesh(merged, material);
    m.castShadow = !material.transparent;
    m.receiveShadow = true;
    content.add(m);
  });
  moving.forEach((g) => content.add(g));
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  content.position.set(-centre.x, -bounds.min.y, -centre.z); // stand on the ground, centred
  const proto = new THREE.Group();
  proto.add(content);
  return { proto, owned, w: Math.max(size.x, 1), d: Math.max(size.z, 1), h: size.y };
}

export function createModelLibrary() {
  const items = new Map();
  const clampSize = (s) => Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(s * 10) / 10));
  return {
    has: (id) => items.has(id),
    get: (id) => items.get(id),
    list: () => [...items.values()],
    serialize: () => [...items.values()].map(({ id, name, text }) => ({ id, name, text })),
    /* throws a readable Error if the text isn't a usable Hobby Builder file */
    add(name, text, id = "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)) {
      if (items.has(id)) return id;
      const { pieces } = parseStructure(text);
      if (!pieces.length) throw new Error("That build has no pieces in it.");
      const compact = JSON.stringify(JSON.parse(text));
      items.set(id, { id, name: String(name || "My build").slice(0, 40), text: compact, count: pieces.length, ...buildPrototype(pieces) });
      return id;
    },
    remove(id) {
      items.get(id)?.owned.forEach((g) => g.dispose());
      items.delete(id);
    },
    defaultSize(id) {
      const it = items.get(id);
      return it ? clampSize(Math.max(it.w, it.d) / STUDS_PER_TILE) : 1;
    },
    /* footprint in city tiles, and height, for a placed cell */
    extent(cell) {
      const it = items.get(cell.m);
      if (!it) return { w: 1, d: 1, h: 0.5 };
      const k = cell.s / Math.max(it.w, it.d);
      const [w, d] = (cell.r || 0) % 2 ? [it.d, it.w] : [it.w, it.d];
      return { w: w * k, d: d * k, h: it.h * k };
    },
    instance(cell) {
      const g = new THREE.Group();
      const it = items.get(cell.m);
      if (!it) return g;
      const copy = it.proto.clone(true); // shares geometry and materials with the prototype
      copy.scale.setScalar(cell.s / Math.max(it.w, it.d));
      const spinners = [];
      copy.traverse((o) => o.userData.spin && spinners.push(o));
      copy.userData.spinners = spinners;
      g.add(copy);
      g.rotation.y = (cell.r || 0) * (Math.PI / 2);
      g.userData.shared = true; // the city must not dispose what the prototype owns
      g.userData.moving = spinners.length ? copy : null;
      return g;
    },
    animate(group, t) {
      if (group.userData.moving) spinFans(group.userData.moving, t);
    },
    dispose() {
      [...items.keys()].forEach((id) => this.remove(id));
    },
  };
}
