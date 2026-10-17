---
name: hobby-builder
description: Work on the Hobby Builder app, a React and Three.js 3D brick builder. Use when adding or changing pieces, customizable pieces, lights, per-piece motion, camera or video export, the save format or the UI in HobbyBuilder.jsx, hobbyBuilderPieces.js, pieceAnimations.js, animation.js, structureIO.js or thumbs.js.
---

# Hobby Builder

A browser app: a resizable baseplate, about 360 pieces, a select/move/resize/recolor tool, lights, per-piece motion, walk-through camera, and GIF or video export. Everything is client-side React plus `three`; the only other package is `gifenc`.

## Files

| File | Owns |
|---|---|
| `HobbyBuilder.jsx` | The component: scene, camera, pointer and keyboard handling, undo/redo, toolbar, picker, select card, build card, animate drawer, help window |
| `hobbyBuilderPieces.js` | The piece catalog (`reg`, `regCustom`), drawing helpers, stacking (`stackInfo`, `settle`), `buildPiece`, picker `GROUPS` |
| `structureIO.js` | Save, load, validate, autosave (localStorage) |
| `pieceAnimations.js` | Motion types and the pure function `poseAt(anim, rot, h, t)` |
| `animation.js` | Video timeline, camera paths, GIF and WebM export |
| Camera and placement | `orbit` has a look-at point (`tx,ty,tz`) moved by `panBy`; `cut` (Show layers) hides pieces with `y >= cut` via `holder.userData.cut`, and `stackInfo(..., {below, h})` stacks only on what is still shown |
| Lights and spinning | every lamp gets a halo Sprite; a fixed pool of real PointLight/SpotLight (size from `renderer.capabilities.maxFragmentUniforms`) is re-assigned to the lamps nearest the view by `assignLights`; `userData.spin = {axis, speed}` on a Group is turned by `spinFans(group, t)` (live loop and `poseScene`) |
| Walk placement | in walk mode `updateHover`/`placeAt` use the walk camera ray, always stick to surfaces, and limit floor support to layers below eye height (`lim`) |
| Surface placement | `attach` (key Q): `updateHover` reads the hit normal and sets position, rotation and y; such pieces carry `att:true`, may sit on quarter-stud x/z and are skipped by `settle`/`stackInfo` lift; `boxHits` is the overlap test; saved as `att` |
| `photo.js` | Still photos from preset or saved angles (`takePhotos`, `contactSheet`); hides ghost, selection and path helpers while shooting |
| `thumbs.js` | Picker preview images (offscreen renderer, cached) |

## Coordinates and units

- 1 unit = 1 stud. `BH = 1.2` is one brick layer, `SH = 0.2` stud height, `SR = 0.3` stud radius.
- A piece is drawn with its origin at the minimum corner of its footprint: x spans `0..w`, z spans `0..d`, y up. Its front faces **+z**.
- `buildPiece` re-centres the piece and applies rotation (`rot` 0 to 3, 90 degree steps), so `build` functions never handle rotation.
- Height `h` is in brick layers. Thin pieces use `0.25` (tiles, tracks, water). Stack levels are multiples of 0.25.

## Adding an ordinary piece

```js
reg("key", "Name", w, d, h, canStackOn, (color) => {
  const g = new THREE.Group();
  B(g, 1.9, 1, 1.9, mat(color), 1, 0.5, 1);   // B(group, sizeX, sizeY, sizeZ, material, centreX, centreY, centreZ)
  return g;
});
```

Then add `"key"` to a group in `GROUPS` at the bottom of `hobbyBuilderPieces.js`. A piece missing from `GROUPS` never shows in the picker.

Helpers (all take the part's **centre**): `B` box, `Cyl(g, rTop, rBottom, h, ...)`, `Sph`, `Cone`, `Ico`, `tube(g, [x,y,z], [x,y,z], r, mat)` between two points, `wheel`, `studs(g, w, d, y, mat)`, `plan` and `prismGeo` for extruded outlines. Materials: `mat(hex, opts)`, `shade(hex, factor)`, `glass()`. Geometry and materials are cached, so do not create meshes outside these helpers.

Rules that have caused bugs:
- Keep parts inside the footprint (`0..w`, `0..d`) and above `y = 0`. A small overhang (under about 0.1) is fine.
- Declare helpers and shared constants **before** the first piece that uses them. They are `const`, so use-before-define fails at load.
- Use the chosen color on the main body only; keep glass, steel, wood and natural parts fixed.
- `canStackOn` false means the preview turns red and a click does nothing. Use true for floors, tables, tiles and anything flat on top.

## Customizable pieces

```js
regCustom("key", "Name (custom)",
  [ { key: "w", label: "Width", kind: "num", min: 2, max: 8, step: 1, def: 4 },
    { key: "style", label: "Style", kind: "sel", def: "a", options: [["a", "A"], ["b", "B"]] },
    { key: "extra", label: "Extra", kind: "tog", def: false } ],
  (o) => ({ w: o.w, d: 1, h: 3, top: true }),   // footprint and height for these settings
  (color, o) => { /* draw using o.w, o.style, o.extra */ return g; },
  lightFn /* optional, see Lights */);
```

- Settings are cleaned with `cleanOpts` (clamped, snapped, defaults filled) on build, load and edit, so `build` always sees valid values.
- The build card and the select card's Settings tab render these controls automatically, and the keyboard shortcuts (`{ }`, `< >`, `( )`, Y, I, L) map to the first number, second number, third number, first choice, second choice and first switch.
- Large sizes mean many meshes. Scale tile or rib size with the area (see `cellFit`, `tileRowsG`) and cap part counts.

## Stretching any piece

`dim = { w, d, h }` on a placed piece scales the whole built model from its corner (`buildPiece` scales the inner group). Sizes are whole studs 1 to 16 and quarter-brick heights up to 8. `typeDims(type, opts, dim)` is the single source of truth for footprint, height and stackability; always use it instead of reading `type.w`.

## Lights

Pass a sixth argument to `regCustom` returning `{ kind: "point" | "spot", pos: [x,y,z], dir, angle, power: 0..1, color, dist }`. `pos` is relative to the middle of the piece base and is rotated with the piece. `HobbyBuilder.jsx` creates real lights from this, only for the `MAX_LIGHTS` (8) brightest lamps, and `power` 0 means no light. Give every lamp a `lightParams`-style Brightness and Light color setting and a glowing emissive part.

## Per-piece motion

`pieceAnimations.js`: add an entry to `MOTIONS` (key, label, hint, optional `axis`, `reverse`, `loop`, `turn`, `amount`, `path`), extend `cleanAnim` to validate any new field, and add a `case` to `poseAt`. `poseAt` must be a **pure function of time** so the live view, previews and every exported frame match. Directions are relative to the piece, so rotation must be honoured.

Holders: each placed piece lives in a holder group centred on its footprint (`userData.base`, `rot`, `h`, `anim`). Motion changes the holder, never the piece geometry.

## Save format

Only these are stored: `type, x, z, y, rot, color` and optionally `opts`, `dim`, `anim`. The file also has an optional top-level `animation` block (reveal, camMode, pieceAnims, shots, stops, stopSecs), cleaned by `cleanSetup` in `structureIO.js`; `serializeStructure` and `autosave` take it as a third argument and `parseStructure` returns it as `setup`. Size, height and stackability are derived on load. Consequences:
- Never rename or remove a piece key without a migration, or old saves fail with "unknown type".
- New optional fields must be cleaned in `parseStructure` and added to `serializeStructure`.
- The format marker is `app: "hobby-builder"`; the old `"lego-builder"` and its autosave key are still read.

## History and state

Undo and redo snapshot `{ N, bricks }` on every change (up to 100). Use `touch(key)` before a run of slider updates so they merge into one undo step. Anything that changes pieces should end with `settle(...)` so floating pieces drop.

## Verifying changes

Run these before handing work over; a build that compiles can still crash on the first frame.

1. **Bundle:** `npx esbuild HobbyBuilder.jsx --bundle --external:three --external:react --external:gifenc --loader:.jsx=jsx --loader:.js=jsx --format=esm --outfile=out.js`
2. **Lint for undefined names and hook mistakes** with eslint (rules `no-undef`, `react/jsx-uses-vars`, `hooks/rules-of-hooks`).
3. **Check pieces** in Node: build every piece in all 4 rotations, compute `Box3.setFromObject`, and flag anything that sticks out of `0..w`, `0..d`, goes below y 0, or has NaN. Test customizable pieces across every option combination at small and large sizes. Confirm every key in `TYPES` appears exactly once in `GROUPS`.
4. **Headless run** with jsdom and a stand-in `WebGLRenderer` (alias `three` to a shim that re-exports three plus a fake renderer). Place, select, move, delete, undo, edit a setting and check `localStorage` autosave. In tests call a slider's React `onChange` prop directly; synthetic `input` events do not reach React reliably in jsdom.
5. **Look at it.** Playwright's pre-installed Chromium can render with software WebGL (`--use-gl=swiftshader --enable-unsafe-swiftshader`, `executablePath: '/opt/pw-browsers/chromium'`; `npm i playwright-core --no-save`). Bundle a small page with esbuild (real `three`, not the test shim) that builds pieces into one contact-sheet canvas, screenshot it and read the PNG. Bounds checks cannot tell you a tree looks wrong. Use `setFromObject(obj, true)` (precise) in Node bounds checks; the default box inflates rotated parts.
6. **Save round trip:** `serializeStructure` then `parseStructure` keeps `opts`, `dim` and `anim`, and tampered values are clamped.

`gifenc` is CommonJS: Node cannot import its named exports directly, but bundlers (Vite, esbuild) can, so bundle tests that touch `animation.js`.

## Setup notes

Node 18 needs `npm create vite@5` (the newest Vite needs Node 20.19 or newer). Install `three` and `gifenc`. The root needs `html, body, #root { margin: 0; height: 100% }`. A very large baseplate or hundreds of detailed pieces slows older machines, so keep part counts low.
