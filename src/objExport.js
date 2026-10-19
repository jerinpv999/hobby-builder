import * as THREE from "three";

/* Export the build as a Wavefront .obj + .mtl (colours, transparency), packed in a .zip so the two files stay together. */
const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = crcTable[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

export function zipStore(files) { // files: [{name, data: Uint8Array}] -> Blob (no compression)
  const enc = new TextEncoder(), parts = [], central = [];
  let off = 0;
  files.forEach((f) => {
    const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true); lh.setUint16(26, nm.length, true);
    parts.push(lh.buffer, nm, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint32(16, crc, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
    central.push(ch.buffer, nm);
    off += 30 + nm.length + sz;
  });
  const csz = central.reduce((s, b) => s + b.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csz, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, end.buffer], { type: "application/zip" });
}

export function buildObj(root, name = "hobby-structure") {
  root.updateMatrixWorld(true);
  const mats = new Map(), lines = [`# Hobby Builder export`, `mtllib ${name}.mtl`];
  let vBase = 0, count = 0;
  const v = new THREE.Vector3(), nrm = new THREE.Vector3(), nm3 = new THREE.Matrix3(), col = new THREE.Color();
  const f = (n) => (Math.round(n * 1e5) / 1e5).toString();
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    for (let p = o; p; p = p.parent) if (p.visible === false) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const geo = o.geometry, pos = geo.attributes.position, nor = geo.attributes.normal, idx = geo.index;
    nm3.getNormalMatrix(o.matrixWorld);
    lines.push(`o m${count++}`);
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); lines.push(`v ${f(v.x)} ${f(v.y)} ${f(v.z)}`); }
    if (nor) for (let i = 0; i < nor.count; i++) { nrm.fromBufferAttribute(nor, i).applyMatrix3(nm3).normalize(); lines.push(`vn ${f(nrm.x)} ${f(nrm.y)} ${f(nrm.z)}`); }
    const groups = geo.groups && geo.groups.length ? geo.groups : [{ start: 0, count: idx ? idx.count : pos.count, materialIndex: 0 }];
    const flip = o.matrixWorld.determinant() < 0;
    groups.forEach((g) => {
      const m = list[g.materialIndex] || list[0];
      if (!mats.has(m)) mats.set(m, "mat" + mats.size);
      lines.push(`usemtl ${mats.get(m)}`);
      for (let i = g.start; i + 2 < g.start + g.count; i += 3) {
        let a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
        if (flip) [b, c] = [c, b];
        const t = (k) => (nor ? `${vBase + k + 1}//${vBase + k + 1}` : `${vBase + k + 1}`);
        lines.push(`f ${t(a)} ${t(b)} ${t(c)}`);
      }
    });
    vBase += pos.count;
  });
  const mtl = ["# Hobby Builder materials"];
  mats.forEach((id, m) => {
    col.copy(m.color || col.set(0xcccccc));
    mtl.push(`newmtl ${id}`, `Kd ${f(col.r)} ${f(col.g)} ${f(col.b)}`, `Ka 0 0 0`, `Ks 0.1 0.1 0.1`);
    if (m.emissive && m.emissive.getHex() && (m.emissiveIntensity ?? 1) > 0) mtl.push(`Ke ${f(m.emissive.r)} ${f(m.emissive.g)} ${f(m.emissive.b)}`);
    const d = m.transparent ? Math.max(0.05, Math.min(1, m.opacity ?? 1)) : 1;
    mtl.push(`d ${f(d)}`, "illum 2", "");
  });
  return { obj: lines.join("\n") + "\n", mtl: mtl.join("\n"), meshes: count };
}

export function exportObjZip(root, name = "hobby-structure") {
  const { obj, mtl, meshes } = buildObj(root, name), enc = new TextEncoder();
  const blob = zipStore([{ name: name + ".obj", data: enc.encode(obj) }, { name: name + ".mtl", data: enc.encode(mtl) }]);
  return { blob, meshes };
}
