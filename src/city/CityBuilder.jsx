import { useEffect, useRef, useState, useCallback } from "react";
import { createEngine, TYPES, GROUPS, SEASONS, PALETTE } from "./engine";
import { createModelLibrary, MIN_SIZE, MAX_SIZE } from "./models";
import { STORAGE_KEY as HOBBY_KEY } from "../structureIO";
import { createAssets } from "./assets";
import { QUESTIONS } from "./talk";
import Talk from "./Talk.jsx";
import "./city.css";

const fmtHour = (h) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

export default function CityBuilder() {
  const box = useRef(null);
  const eng = useRef(null);
  const file = useRef(null);
  const modelFile = useRef(null);
  const [, setTick] = useState(0);
  const [hover, setHover] = useState(null);
  const [msg, setMsg] = useState("");
  const [near, setNear] = useState(null);
  const [talk, setTalk] = useState(null);
  const [heading, setHeading] = useState("N");
  const bump = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const e = createEngine(box.current, { onChange: bump, onSelect: bump, onHover: setHover, onError: setMsg, onNear: setNear, onTalk: setTalk, onHeading: setHeading }, createModelLibrary(), createAssets(`${import.meta.env.BASE_URL}models/city.glb`));
    eng.current = e;
    bump();
    const onKey = (ev) => {
      if (ev.target.tagName === "INPUT" && !["range", "color", "checkbox"].includes(ev.target.type)) { if (ev.key === "Escape") e.endTalk(); return; }
      const k = ev.key.toLowerCase();
      const s = e.getState();
      if (!s.walking && k === "b" && !ev.ctrlKey && !ev.metaKey) { e.setBuildMode(!s.building); return; }
      if (!s.walking && !s.building) return; // nothing can be changed by key in explore mode
      if (s.walking) { // building keys are off while walking
        if (k === "e") { ev.preventDefault(); e.talkNearest(); }
        else if (k === "escape") { if (document.querySelector(".talk")) e.endTalk(); else e.stopWalk(); }
        return;
      }
      if ((ev.ctrlKey || ev.metaKey) && k === "z") { ev.preventDefault(); ev.shiftKey ? e.redo() : e.undo(); }
      else if ((ev.ctrlKey || ev.metaKey) && k === "y") { ev.preventDefault(); e.redo(); }
      else if (k === "r") e.rotate();
      else if (k === "escape") { e.setTool("select"); e.deselect(); }
      else if (k === "delete" || k === "backspace") e.removeSelected();
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); e.dispose(); eng.current = null; };
  }, [bump]);

  const E = eng.current;
  const st = E ? E.getState() : { tool: "select", rot: 0, sel: null, cell: null, canUndo: false, canRedo: false, name: "", hour: 14, traffic: true, season: "summer", walking: false, building: false, people: true, activeModel: null, models: [], extent: null };
  const stats = E ? E.stats() : { residents: 0, jobs: 0, roads: 0, green: 0, buildings: 0, farms: 0, drains: 0, flowing: 0 };
  const cell = st.cell;
  const def = cell ? TYPES[cell.t] : null;

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };
  const download = () => {
    const url = URL.createObjectURL(new Blob([E.exportJSON()], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = (st.name || "city").replace(/[^\w-]+/g, "_") + ".json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const upload = async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = "";
    if (!f) return;
    try { E.importJSON(await f.text()); flash("City loaded."); } catch (err) { flash(err.message || "Could not read that file."); }
  };
  const confirmDo = (text, fn) => { if (window.confirm(text)) fn(); };
  const addModel = (name, text) => {
    try { E.addModel(name, text); flash(`"${name}" added. Click a tile to place it.`); } catch (err) { flash(err.message || "Could not read that build."); }
  };
  const importModels = async (ev) => {
    const files = [...ev.target.files];
    ev.target.value = "";
    for (const f of files) addModel(f.name.replace(/\.json$/i, ""), await f.text());
  };
  const importCurrent = () => {
    let text = null;
    try { text = localStorage.getItem(HOBBY_KEY); } catch { /* storage blocked */ }
    if (!text) { flash("No Hobby Builder build found in this browser. Make one first, or import a saved JSON file."); return; }
    addModel(`My build ${st.models.length + 1}`, text);
  };

  return (
    <div className={["city", st.walking && "walking", st.building ? "building" : "exploring"].filter(Boolean).join(" ")}>
      <aside className="side">
        <a className="back" href={import.meta.env.BASE_URL}>← Home</a>
        <input className="name" value={st.name} readOnly={!st.building} onChange={(e) => E.setName(e.target.value)} aria-label="City name" />
        <div className="modes" role="group" aria-label="Mode">
          <button className={st.building ? "" : "on"} aria-pressed={!st.building} onClick={() => E.setBuildMode(false)}>👁 Explore</button>
          <button className={st.building ? "on" : ""} aria-pressed={st.building} onClick={() => E.setBuildMode(true)}>🔨 Build</button>
        </div>
        <div className="stats">
          <div><b>{stats.residents.toLocaleString()}</b><span>Residents</span></div>
          <div><b>{stats.jobs.toLocaleString()}</b><span>Jobs</span></div>
          <div><b>{stats.buildings}</b><span>Buildings</span></div>
          <div><b>{stats.roads}</b><span>Road tiles</span></div>
          <div><b>{stats.green}</b><span>Green tiles</span></div>
          <div><b>{stats.farms}</b><span>Farm fields</span></div>
          <div><b>{stats.flowing}/{stats.drains}</b><span>Drains flowing</span></div>
        </div>
        {!st.building && (
          <p className="hint">You are looking around: clicking changes nothing. Drag to orbit, right-drag to pan, scroll to zoom, or use <b>Walk the city</b>. Choose <b>Build</b> (or press <kbd>B</kbd>) to edit.</p>
        )}
        {st.building && (
          <>
          <h3>Tools</h3>
          <div className="tools">
            <button className={st.tool === "select" ? "on" : ""} onClick={() => E.setTool("select")}>👆 Select</button>
            <button className={st.tool === "bulldoze" ? "on danger" : ""} onClick={() => E.setTool("bulldoze")}>🚧 Bulldoze</button>
          </div>
          <h3>My models</h3>
          <div className="tools">
            <button onClick={importCurrent}>🧱 Use my current build</button>
            <button onClick={() => modelFile.current.click()}>📂 Import JSON</button>
          </div>
          <input ref={modelFile} type="file" accept="application/json,.json" multiple hidden onChange={importModels} />
          {st.models.map((m) => (
            <div className="model" key={m.id}>
              <button className={st.tool === "custom" && st.activeModel === m.id ? "on" : ""} onClick={() => E.chooseModel(m.id)} title={`${m.count} pieces`}>{m.name}</button>
              <button className="danger" aria-label={`Remove ${m.name}`} onClick={() => confirmDo(`Remove "${m.name}" and every copy of it in the city?`, () => E.removeModel(m.id))}>✕</button>
            </div>
          ))}
          {!st.models.length && <p className="hint">Bring in anything you made in <a href={`${import.meta.env.BASE_URL}builder.html`}>Hobby Builder</a>, then place and scale it here.</p>}
          {GROUPS.map(([title, list]) => (
            <div key={title}>
              <h3>{title}</h3>
              <div className="tools">
                {list.map((t) => (
                  <button key={t} className={st.tool === t ? "on" : ""} onClick={() => E.setTool(t)}>{TYPES[t].icon} {TYPES[t].label}</button>
                ))}
              </div>
            </div>
          ))}
          <p className="hint">Click to place or select. <kbd>Shift</kbd>+drag paints a line of roads, trees or water. Drag to orbit, right-drag to pan, scroll to zoom. <kbd>R</kbd> rotates, <kbd>Esc</kbd> picks Select.</p>
          {st.tool !== "select" && st.tool !== "bulldoze" && TYPES[st.tool].rot && <p className="hint">Facing: {["south", "east", "north", "west"][st.rot]} (press R)</p>}
          </>
        )}
      </aside>

      <main className="stage">
        <div ref={box} className="canvas" />
        <div className="bar">
          <button className="walkbtn" onClick={(e) => { e.currentTarget.blur(); E.startWalk(); }}>🚶 Walk the city</button>
          {st.building && (
            <>
              <button disabled={!st.canUndo} onClick={() => E.undo()}>↶ Undo</button>
              <button disabled={!st.canRedo} onClick={() => E.redo()}>↷ Redo</button>
            </>
          )}
          <label className="time">☀ {fmtHour(st.hour)}
            <input type="range" min="0" max="24" step="0.25" value={st.hour} onChange={(e) => E.setTime(+e.target.value)} />
          </label>
          <select className="season" value={st.season} onChange={(e) => { E.setSeason(e.target.value); e.target.blur(); }} aria-label="Season">
            {SEASONS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <label className="chk"><input type="checkbox" checked={st.traffic} onChange={(e) => E.setTraffic(e.target.checked)} /> Traffic</label>
          <label className="chk"><input type="checkbox" checked={st.people} onChange={(e) => E.setPeople(e.target.checked)} /> People</label>
          <button onClick={() => E.resetCamera()}>⟲ View</button>
          <span className="sp" />
          <button onClick={download}>⬇ Save file</button>
          {st.building && (
            <>
            <button onClick={() => file.current.click()}>⬆ Load file</button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={upload} />
            <button onClick={() => confirmDo("Replace your city with the starting city?", () => E.newBase())}>Base city</button>
            <button onClick={() => confirmDo("Clear the whole map?", () => E.clear())}>Clear</button>
            </>
          )}
        </div>
        {hover && <div className="tag">Tile {hover.x},{hover.z}{hover.cell ? ` · ${TYPES[hover.cell.t].label}` : ""}</div>}
        {msg && <div className="toast">{msg}</div>}
        {st.walking && (
          <>
            <div className="hud">
              <button onClick={() => E.stopWalk()}>← Stop walking</button>
              <span className="compass" title="Direction you are facing">🧭 {heading}</span>
              <label className="time">☀ {fmtHour(st.hour)}
                <input type="range" min="0" max="24" step="0.25" value={st.hour} onChange={(e) => E.setTime(+e.target.value)} onPointerUp={(e) => e.target.blur()} />
              </label>
              <span className="hint"><kbd>W A S D</kbd> move · <kbd>← →</kbd> turn · drag to look · <kbd>Shift</kbd> run · <kbd>E</kbd> talk · <kbd>Esc</kbd> leave</span>
            </div>
            <div className="pad">
              {[["turnLeft", "⟲"], ["forward", "▲"], ["turnRight", "⟳"], ["left", "◀"], ["back", "▼"], ["right", "▶"]].map(([a, icon]) => (
                <button key={a} aria-label={a} onPointerDown={() => E.walkHold(a, true)} onPointerUp={() => E.walkHold(a, false)} onPointerLeave={() => E.walkHold(a, false)} onPointerCancel={() => E.walkHold(a, false)}>{icon}</button>
              ))}
            </div>
            {near && !talk && <button className="prompt" onClick={() => E.talkNearest()}>💬 Talk to {near.name}, {near.job} <kbd>E</kbd></button>}
            {talk && <Talk key={talk.id} person={talk} questions={QUESTIONS} ask={(q) => E.ask(q)} close={() => E.endTalk()} />}
          </>
        )}
      </main>

      {cell && (
        <aside className="insp">
          <h3>{def.icon} {def.label}</h3>
          <p className="muted">Tile {st.sel.x}, {st.sel.z}</p>
          <label>Type
            <select value={cell.t} onChange={(e) => E.patch({ t: e.target.value, r: cell.r })}>
              {Object.keys(TYPES).filter((t) => t !== "custom" || cell.t === "custom").map((t) => <option key={t} value={t}>{TYPES[t].label}</option>)}
            </select>
          </label>
          {cell.t === "custom" && st.extent && (
            <>
              <p className="muted">{st.models.find((m) => m.id === cell.m)?.name}</p>
              <label>Size: {cell.s.toFixed(1)} tiles
                <input type="range" min={MIN_SIZE} max={MAX_SIZE} step="0.1" value={cell.s} onChange={(e) => E.patch({ s: +e.target.value }, "s")} />
              </label>
              <p className="muted">Covers {st.extent.w.toFixed(1)} × {st.extent.d.toFixed(1)} tiles, {st.extent.h.toFixed(1)} tall.</p>
              <button onClick={() => E.clearUnder()}>Clear tiles under it</button>
            </>
          )}
          {cell.t === "road" && (
            <label>Signals
              <select value={cell.l || "auto"} onChange={(e) => E.patch({ l: e.target.value })}>
                <option value="auto">Automatic (lights at junctions)</option>
                <option value="lights">Traffic lights</option>
                <option value="warn">Flashing warning light</option>
                <option value="none">None</option>
              </select>
            </label>
          )}
          {def.max && (
            <label>{def.unit}: {cell.f}
              <input type="range" min={def.min} max={def.max} value={cell.f} onChange={(e) => E.patch({ f: +e.target.value }, "f")} />
            </label>
          )}
          {def.pal && (
            <div>
              <span className="lbl">Color</span>
              <div className="sw">
                {def.pal.map((c) => <button key={c} style={{ background: c }} className={cell.c.toLowerCase() === c ? "on" : ""} onClick={() => E.patch({ c })} aria-label={c} />)}
                <input type="color" value={cell.c} onChange={(e) => E.patch({ c: e.target.value }, "c")} aria-label="Custom color" />
              </div>
            </div>
          )}
          <div className="row">
            {def.rot && <button onClick={() => E.rotate()}>⟳ Rotate</button>}
            <button className="danger" onClick={() => E.removeSelected()}>Remove</button>
          </div>
        </aside>
      )}
    </div>
  );
}
export { PALETTE };
