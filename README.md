# Hobby Builder

A 3D brick builder that runs in the browser, made with React and Three.js. Place bricks, windows, doors, roofs, trees, vehicles, furniture and more on a resizable baseplate, save your build as JSON, and export an animation as a GIF or video.

## Features

- **Build in 3D.** Click to place a piece, drag to orbit, scroll to zoom. A translucent preview follows the cursor and snaps to the stud grid.
- **Around 120 pieces** in 15 groups: bricks, flat bricks and tiles, windows and doors, roofs, logs, trees, plants and stones, people, vehicles, two-wheelers, railway, water and boats, furniture, home appliances and kitchen utensils.
- **Stacking.** Pieces stack on top of each other and drop down if what is under them is removed. Pieces that can't be built on (a roof, a tree, a car) show a red preview.
- **Rotation** in 90° steps.
- **Customizable roofs.** A Flat roof and a Triangle roof you size and style yourself.
- **Keyboard shortcuts** for every action, with a built-in list (press **?**).
- **Undo and redo** for placing, removing, clearing, loading and resizing.
- **Colors.** Eight colors for bricks, upholstery, hulls, frames and similar parts.
- **Resizable baseplate** from 8×8 to 64×64 studs.
- **Autosave** in the browser, plus **Save JSON / Load JSON** for files.
- **Walk mode and home tours.** Walk through your build in first person, save a stop in each room, and export a walkthrough video.
- **Animation export** as a GIF or video, with build-up or finished-model reveal and an orbit, your own saved camera angles, or a home tour.

## Requirements

- Node.js 18 or newer
- A current desktop browser (Chrome, Edge, Firefox or Safari) with WebGL

## Setup

The app is a React component, so it needs a small host project. The steps below use Vite.

On Node 18, pin Vite 5. The newest `create-vite` needs Node 20.19 or newer.

```bash
npm create vite@5 hobby-builder -- --template react
cd hobby-builder
npm install
npm install three gifenc
```

On Node 20.19 or newer you can use `npm create vite@latest` instead.

1. Copy these four files into `src/`:
   - `HobbyBuilder.jsx`
   - `hobbyBuilderPieces.js`
   - `structureIO.js`
   - `animation.js`
2. Replace `src/App.jsx` with:

   ```jsx
   import HobbyBuilder from "./HobbyBuilder";

   export default function App() {
     return <HobbyBuilder />;
   }
   ```

3. Replace `src/index.css` with the following. Vite's default styles center everything and would squash the 3D view.

   ```css
   html, body, #root { margin: 0; height: 100%; }
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

   Open the address it prints, usually http://localhost:5173. To open it from a phone or another computer on the same network, run `npm run dev -- --host`.

5. For a production build, run `npm run build`. The output goes to `dist/`.

## Project layout

| File | What it does |
|---|---|
| `HobbyBuilder.jsx` | The React component: scene, camera, placement, sidebar UI, save/load and export buttons |
| `hobbyBuilderPieces.js` | The piece catalog, how each piece is drawn, stacking rules and the sidebar groups |
| `structureIO.js` | Saving, loading, validating and autosaving a build |
| `animation.js` | The animation timeline, camera paths, GIF encoding and video recording |

## Using the app

| Action | How |
|---|---|
| Place a piece | Click the baseplate or the top of another piece |
| Orbit the camera | Drag |
| Zoom | Scroll |
| Rotate the selected piece | **R** or the Rotate button |
| Remove a piece | Switch to **Remove** mode and click it. Anything above it drops down |
| Undo or redo | **Undo** and **Redo** step back and forward through every change, up to 100 steps |
| Clear | Removes everything (asks first). You can undo it |
| Walk through the build | Press **Walk**. Use **W A S D** to move, **Q / E** to go down or up, **← →** to turn, drag to look, scroll to step forward or back, and hold **Shift** to move faster. Placing pieces is switched off while you walk; press Walk again to return to the orbit view |
| Resize the baseplate | **Expand** or **Shrink** (4 studs per side per click). Existing pieces stay centered, and Shrink is disabled if it would cut off a piece |

Pieces face the front by default (the drawers, doors and seat opening toward the front of the baseplate). Use R to turn them.

## Keyboard shortcuts

Press **?** or **H** (or the **Keys** button) to see this list in the app. On a Mac, use ⌘ instead of Ctrl. Shortcuts are paused while you type in the search box, and while a video or GIF export is running only **Esc** and the help window work.

| Area | Keys | Action |
|---|---|---|
| Build and edit | **B** / **X** | Build mode / Remove mode |
| | **Space** or **Enter** | Place or remove at the cursor (with the pointer over the 3D view) |
| | **R** / **Shift+R** | Rotate the piece / rotate the other way |
| | **Ctrl+Z** | Undo |
| | **Ctrl+Y** or **Ctrl+Shift+Z** | Redo |
| | **Shift+Delete** | Clear everything (asks first) |
| | **Esc** | Close help, cancel an export, close the Animate panel, leave walk mode, then return to build mode |
| Pieces and colors | **[** and **]** | Previous / next category |
| | **,** and **.** | Previous / next piece |
| | **C** / **Shift+C** | Next / previous color |
| | **/** or **Ctrl+K** | Search pieces |
| Camera | **1 2 3 4** | Front, Side, Top, Iso view |
| | **0** | Reset the view |
| | **Arrow keys** | Rotate and tilt (hold **Shift** for bigger steps) |
| | **Z** / **Shift+Z** | Zoom in / out |
| | **F** | Walk mode on / off |
| | **W A S D**, **Q / E**, **← →**, **Shift** | Walk, down / up, turn, faster (walk mode only) |
| Baseplate and files | **+** or **=** / **-** or **_** | Expand / shrink the baseplate |
| | **Ctrl+S** / **Ctrl+O** | Save JSON / Load JSON |
| Animation | **M** | Open / close the Animate panel |
| | **U** | Pieces: build-up / finished |
| | **O** | Camera: Orbit, Angles, Home tour |
| | **K** | Save the current camera angle or home tour stop |
| | **P** / **G** / **V** | Preview / export GIF / export video |
| Customize roofs | **{ }** / **< >** / **( )** | Width or ridge length / length or span / thickness or ridge height, smaller or larger |
| | **Y** / **I** (+ **Shift** to go back) | Cycle the surface / cycle the edge or roof shape |
| | **L** | Skylight or ridge cap on or off |
| Help | **?** or **H** | Show the shortcut list |

## Customizable roofs

Pick **Flat roof (custom)** or **Triangle roof (custom)** from the **Custom roofs** group. A **customize** card appears over the 3D view, and the preview updates as you change it. Reset puts everything back to the defaults. Each placed roof keeps the settings it was made with.

| Piece | Settings |
|---|---|
| Flat roof | **Width** and **Length** (2 to 16 studs), **Thickness** (a quarter to a full brick), **Surface** (plain, gravel, tiles, metal, glass or green roof), **Edge** (none, parapet or rail) and a **Skylight** option. The roof takes your chosen color |
| Triangle roof | **Length** along the ridge (1 to 16) and **Span** across the slopes (2 to 12), **Ridge height** (half a brick to 4 bricks), **Surface** (plain, tiles, metal or glass), **Shape** (two slopes, or one slope for a lean-to) and a **Ridge cap** option |

Things can be stacked on the Flat roof but not on the Triangle roof. Press R to turn either one. Large roofs with tiles or metal ribs have more parts, so a very big tiled roof can slow older machines.

## Saving and loading

Your build is saved in the browser automatically after every change, so a refresh restores it. The autosave is stored per browser and per address.

**Save JSON** downloads `hobby-structure.json`. **Load JSON** replaces the current build, including the baseplate size. A file is checked before it loads, and a bad file is rejected with a message while your current build stays as it was.

```json
{
  "app": "hobby-builder",
  "version": 1,
  "baseSize": 20,
  "pieces": [
    { "type": "b2x4", "x": 2, "z": 3, "y": 0, "rot": 1, "color": "#D01012" },
    { "type": "triroof", "x": 6, "z": 3, "y": 0, "rot": 0, "color": "#D01012",
      "opts": { "len": 6, "span": 4, "pitch": 2, "surface": "tiles", "shape": "gable", "cap": true } }
  ]
}
```

- `type` is a piece key from `hobbyBuilderPieces.js`.
- `x` and `z` are grid positions. `y` is the layer, in multiples of 0.25 (thin pieces such as tracks and tiles are a quarter of a brick tall).
- `rot` is 0 to 3, in 90° steps.
- `color` is a hex color like `#D01012`.
- `opts` appears only on customizable pieces and holds their settings. Missing or out-of-range settings are replaced with defaults or clamped when the file loads.

Files saved before the project was renamed (with `"app": "lego-builder"`) still load, and an autosave stored under the old name is picked up and moved to the new one automatically.

Limits: baseplate 8 to 64, up to 2000 pieces. Size, height and stacking rules come from the piece catalog when a file loads, so renaming or removing a piece type in `hobbyBuilderPieces.js` breaks saves that use it.

Saved camera angles and home tour stops are not part of the JSON file.

## Animation and video export

The **Camera and video** section of the sidebar controls the animation.

- **Views:** Front, Side, Top and Iso jump the camera to a standard angle.
- **Pieces:**
  - **Build-up:** pieces drop in one at a time in the order you placed them.
  - **Finished:** the whole model is visible from the start.
- **Camera:**
  - **Orbit:** one full turn around the model, starting from your current view.
  - **Angles:** rotate and zoom to a view, press **+ Save current view**, and repeat for up to 8 angles. The camera flies smoothly through them in order.
  - **Home tour:** first-person walkthrough. Choosing it turns on Walk. Walk to the start of the tour and press **+ Add stop here**, then walk to the next room and add another (up to 12 stops). The camera glides through the stops in order at a Fast (2 s), Normal (3 s) or Slow (5 s) pace per stop, with a wider lens suited to interiors. Go jumps back to a stop and × removes it.
- **Preview** plays the animation on screen without saving.
- **GIF** renders 480 px wide at 15 frames per second and loops forever.
- **Video** records the canvas in real time and saves WebM, or MP4 where the browser supports it.

Tips:

- Keep the tab visible while a video records, because browsers slow down hidden tabs.
- Frame the build before exporting. For large baseplates, zoom out first.
- For smaller GIFs, lower `width` or `fps` in `recordGif()` in `animation.js`.
- To convert WebM to MP4: `ffmpeg -i hobby-animation.webm hobby-animation.mp4`.

## Piece groups

| Group | Pieces |
|---|---|
| Bricks | 1×1, 1×2, 1×3, 1×4, 2×2, 2×3, 2×4 |
| Flat bricks (smooth top) | The same sizes as bricks, without studs |
| Flat tiles (thin) | 1×2, 2×2, 2×4, 4×4, 4×8 |
| Building parts | Window, Door |
| Roofs | Roof 2×2 and 4×2, Gable 2×4 and 4×4, Hip 2×2 and 4×4, Spire, Dome |
| Wooden logs | Log 1×2, Log 1×4, Log pile, Firewood, Tree stump |
| Trees | Pine, Round tree, Palm |
| Plants and stones | Pot, Bush, Flower bed, Sunflower, Cactus, Grass, Hedge, Stone, Boulder |
| People | Person, Worker |
| Road vehicles | Car, Bus |
| Two-wheelers | Bicycle, Kick scooter, Scooter, Motorbike |
| Railway | Track 2×2, Track 2×4, Track curve, Locomotive, Train coach, Cargo wagon |
| Water and boats | Pond, River, Lake, Sea, Motor boat, Sailboat, Cargo ship |
| Furniture | Stool, Chair, Armchair, Sofa, Table 2×2 and 4×2, Dresser, Wardrobe, Bookshelf, Bed, Floor lamp |
| Home | Light bulb, TV, Fridge, Oven |
| Kitchen | Frying pan, Cooking pot, Kettle, Utensils |

Tracks and water are a quarter of a brick tall, so a train sits on its rails and a boat sits on the water. Tables, the stool, dresser, wardrobe, bookshelf, fridge, oven, logs, flat pieces, tracks and water can have other pieces placed on top. Roofs, trees, plants, vehicles, people, most small items and the bed cannot.

## Adding your own pieces

Each piece is one `reg(...)` call in `hobbyBuilderPieces.js`:

```js
reg("key", "Name", w, d, h, canStackOn, (color) => {
  const g = new THREE.Group();
  // build the piece from boxes, cylinders and so on, using the helpers B, Cyl, Sph, Cone and tube
  return g;
});
```

- `w` and `d` are the footprint in studs (x and z).
- `h` is the height in brick layers. Use 0.25 for thin pieces.
- `canStackOn` says whether other pieces can be placed on top.
- For a piece whose size or style the user can choose, use `regCustom(key, name, params, size, build)` instead. `params` lists the controls (number, choice or on/off), `size(opts)` returns the footprint and height for the chosen settings, and `build(color, opts)` draws it. See **Flat roof** and **Triangle roof** in the same file.
- Build the piece with its origin at the minimum corner of its footprint and its front facing +z. The file's header comment explains the units.
- Add the piece's key to a group in the `GROUPS` array at the bottom of the file so it appears in the sidebar.

## Configuration

| Setting | Where | Default |
|---|---|---|
| Starting baseplate size | `DEFAULT_N` in `HobbyBuilder.jsx` | 20 |
| Baseplate size limits | `MIN_N` and `MAX_N` in `structureIO.js` | 8 and 64 |
| Expand and Shrink step | `STEP` in `HobbyBuilder.jsx` | 4 |
| Color palette | `COLORS` in `HobbyBuilder.jsx` | 8 colors |
| Piece limit per file | `MAX_PIECES` in `structureIO.js` | 2000 |
| GIF size and speed | `width` and `fps` in `recordGif()` in `animation.js` | 480 and 15 |

## Troubleshooting

- **`styleText` error when creating the project.** Your Node is older than the newest Vite needs. Use `npm create vite@5` or upgrade Node.
- **Blank screen.** Check the browser console. The usual causes are a missing `npm install three gifenc` or a file not copied into `src/`.
- **`--host` is ignored.** With npm, put it after a double dash: `npm run dev -- --host`.
- **Video export fails.** Some browsers can't record the canvas. Use the GIF option instead.
- **Autosave is gone.** It is stored in the browser, so clearing site data or using a different address or browser starts fresh. Use Save JSON for backups.
- **A saved file won't load.** The message under the buttons says which piece is invalid. This usually means a piece type was renamed or removed.

## Known limitations

- Placement is grid-based, so pieces always snap to whole studs.
- Stacking is simplified. Pieces rest on the highest piece under their footprint, and there is no real connection or collision check beyond that.
- Saved camera angles and home tour stops are not stored in the JSON file.
- Walk mode has no collision, so you can walk through walls and furniture. Place your stops where you want the camera to be.
- There is no multi-select or move tool. To reposition a piece, remove it and place it again.
