import { useEffect, useRef, useState, useCallback } from "react";
import { createEngine, TYPES, GROUPS, PALETTE } from "./engine";
import "./city.css";

const fmtHour = (h) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

export default function CityBuilder() {
  const box = useRef(null);
  const eng = useRef(null);
  const file = useRef(null);
  const [, setTick] = useState(0);
  const [hover, setHover] = useState(null);
  const [msg, setMsg] = useState("");
  const bump = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const e = createEngine(box.current, { onChange: bump, onSelect: bump, onHover: setHover });
    eng.current = e;
    bump();
    const onKey = (ev) => {
      if (ev.target.tagName === "INPUT" && ev.target.type !== "range" && ev.target.type !== "color") return;
      const k = ev.key.toLowerCase();
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
  const st = E ? E.getState() : { tool: "select", rot: 0, sel: null, cell: null, canUndo: false, canRedo: false, name: "", hour: 14, traffic: true };
  const stats = E ? E.stats() : { residents: 0, jobs: 0, roads: 0, green: 0, buildings: 0 };
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

  return (
    <div className="city">
      <aside className="side">
        <a className="back" href={import.meta.env.BASE_URL}>← Home</a>
        <input className="name" value={st.name} onChange={(e) => E.setName(e.target.value)} aria-label="City name" />
        <div className="stats">
          <div><b>{stats.residents.toLocaleString()}</b><span>Residents</span></div>
          <div><b>{stats.jobs.toLocaleString()}</b><span>Jobs</span></div>
          <div><b>{stats.buildings}</b><span>Buildings</span></div>
          <div><b>{stats.roads}</b><span>Road tiles</span></div>
          <div><b>{stats.green}</b><span>Green tiles</span></div>
        </div>
        <h3>Tools</h3>
        <div className="tools">
          <button className={st.tool === "select" ? "on" : ""} onClick={() => E.setTool("select")}>👆 Select</button>
          <button className={st.tool === "bulldoze" ? "on danger" : ""} onClick={() => E.setTool("bulldoze")}>🚧 Bulldoze</button>
        </div>
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
      </aside>

      <main className="stage">
        <div ref={box} className="canvas" />
        <div className="bar">
          <button disabled={!st.canUndo} onClick={() => E.undo()}>↶ Undo</button>
          <button disabled={!st.canRedo} onClick={() => E.redo()}>↷ Redo</button>
          <label className="time">☀ {fmtHour(st.hour)}
            <input type="range" min="0" max="24" step="0.25" value={st.hour} onChange={(e) => E.setTime(+e.target.value)} />
          </label>
          <label className="chk"><input type="checkbox" checked={st.traffic} onChange={(e) => E.setTraffic(e.target.checked)} /> Traffic</label>
          <button onClick={() => E.resetCamera()}>⟲ View</button>
          <span className="sp" />
          <button onClick={download}>⬇ Save file</button>
          <button onClick={() => file.current.click()}>⬆ Load file</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={upload} />
          <button onClick={() => confirmDo("Replace your city with the starting city?", () => E.newBase())}>Base city</button>
          <button onClick={() => confirmDo("Clear the whole map?", () => E.clear())}>Clear</button>
        </div>
        {hover && <div className="tag">Tile {hover.x},{hover.z}{hover.cell ? ` · ${TYPES[hover.cell.t].label}` : ""}</div>}
        {msg && <div className="toast">{msg}</div>}
      </main>

      {cell && (
        <aside className="insp">
          <h3>{def.icon} {def.label}</h3>
          <p className="muted">Tile {st.sel.x}, {st.sel.z}</p>
          <label>Type
            <select value={cell.t} onChange={(e) => E.patch({ t: e.target.value, r: cell.r })}>
              {Object.keys(TYPES).map((t) => <option key={t} value={t}>{TYPES[t].label}</option>)}
            </select>
          </label>
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
