import { useCallback, useEffect, useRef, useState } from "react";
import HobbyBuilder from "./HobbyBuilder";
import { api } from "./api";
import { parseStructure, STORAGE_KEY } from "./structureIO";

/* The app's entry point: sign in or register, then pick a workspace. Each workspace is its own
   build, saved to the server a moment after every change. */

const BAR = 46; // px height of the top bar
const SAVE_DELAY = 1500;
const LAST_KEY = "hobby-builder:last-workspace";
const remember = (id) => { try { localStorage.setItem(LAST_KEY, id); } catch { /* blocked storage is fine */ } };
const remembered = () => { try { return localStorage.getItem(LAST_KEY); } catch { return null; } };

const CSS = `
.hbw{height:100vh;display:flex;flex-direction:column;background:#0F1A33;color:#E8EEF8;font-family:'Trebuchet MS','Segoe UI',sans-serif;font-size:14px;--lb-h:calc(100vh - ${BAR}px)}
.hbw button{font:inherit;cursor:pointer}
.hbw .bar{height:${BAR}px;flex:none;display:flex;align-items:center;gap:10px;padding:0 12px;background:#16254A;border-bottom:1px solid #2A3C6B;position:relative;z-index:30}
.hbw .logo{font-weight:700;letter-spacing:.3px}
.hbw .btn{background:#24396F;color:#E8EEF8;border:1px solid #3A528C;border-radius:8px;padding:6px 12px}
.hbw .btn:hover{background:#2E4888}
.hbw .btn.pri{background:#F2B632;color:#1A1A1A;border-color:#F2B632;font-weight:700}
.hbw .btn.danger{background:#7A2B2B;border-color:#A24444}
.hbw .btn:disabled{opacity:.5;cursor:default}
.hbw .grow{flex:1}
.hbw .status{font-size:12px;opacity:.8;min-width:90px;text-align:right}
.hbw .status.err{color:#FF9C9C;opacity:1}
.hbw .menu{position:absolute;top:${BAR - 4}px;left:90px;width:340px;max-height:70vh;overflow:auto;background:#16254A;border:1px solid #3A528C;border-radius:10px;padding:8px;box-shadow:0 12px 30px #0008}
.hbw .row{display:flex;align-items:center;gap:6px;padding:7px 8px;border-radius:8px}
.hbw .row:hover{background:#1F3262}
.hbw .row.on{background:#2A4380}
.hbw .row .nm{flex:1;min-width:0;text-align:left;background:none;border:0;color:inherit;padding:0}
.hbw .row .nm b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hbw .row .nm small{opacity:.65}
.hbw .ico{background:none;border:0;color:#B9C7E6;padding:4px 6px;border-radius:6px}
.hbw .ico:hover{background:#34508F;color:#fff}
.hbw input.f{width:100%;box-sizing:border-box;background:#0F1A33;border:1px solid #3A528C;color:#E8EEF8;border-radius:8px;padding:9px 10px;font:inherit}
.hbw .auth{margin:auto;width:min(380px,92vw);background:#16254A;border:1px solid #2A3C6B;border-radius:14px;padding:26px 24px;display:flex;flex-direction:column;gap:12px;box-shadow:0 18px 50px #0008}
.hbw .auth h1{margin:0 0 2px;font-size:22px}
.hbw .auth p{margin:0;opacity:.75}
.hbw .tabs{display:flex;gap:6px}
.hbw .tabs button{flex:1;background:none;border:0;border-bottom:2px solid transparent;color:#B9C7E6;padding:8px}
.hbw .tabs button.on{color:#fff;border-color:#F2B632}
.hbw .err{background:#4A1F26;border:1px solid #8A3A45;color:#FFC9CF;border-radius:8px;padding:8px 10px}
.hbw .center{margin:auto;opacity:.8}
.hbw .toast{position:absolute;top:${BAR + 8}px;left:50%;transform:translateX(-50%);background:#4A1F26;border:1px solid #8A3A45;color:#FFC9CF;padding:8px 14px;border-radius:8px;z-index:40}
`;

function AuthScreen({ onAuth, notice }) {
  const [tab, setTab] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(notice || "");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      onAuth(tab === "login" ? await api.login(email, password) : await api.register(name, email, password), tab === "register");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <form className="auth" onSubmit={submit}>
      <h1>Hobby Builder</h1>
      <p>{tab === "login" ? "Sign in to open your workspaces." : "Create an account to save your builds in workspaces."}</p>
      <div className="tabs">
        <button type="button" className={tab === "login" ? "on" : ""} onClick={() => { setTab("login"); setError(""); }}>Sign in</button>
        <button type="button" className={tab === "register" ? "on" : ""} onClick={() => { setTab("register"); setError(""); }}>Create account</button>
      </div>
      {error && <div className="err" role="alert">{error}</div>}
      {tab === "register" && <input className="f" placeholder="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />}
      <input className="f" type="email" placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className="f" type="password" placeholder={tab === "register" ? "Password (8 or more characters)" : "Password"} autoComplete={tab === "login" ? "current-password" : "new-password"} minLength={tab === "register" ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button className="btn pri" disabled={busy}>{busy ? "Please wait…" : tab === "login" ? "Sign in" : "Create account"}</button>
    </form>
  );
}

function Workspaces({ user, onLogout, onExpired }) {
  const [list, setList] = useState(null);
  const [loaded, setLoaded] = useState(null); // { id, initial }
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(null); // id being renamed
  const [editName, setEditName] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [saveState, setSaveState] = useState("saved"); // saved | saving | error
  const [toast, setToast] = useState("");
  const pending = useRef({ id: null, text: null, timer: null, baseline: false });
  const activeId = loaded?.id;

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(""), 4000); }, []);
  const refresh = useCallback(async () => setList(await api.list()), []);

  const flush = useCallback(async (opts) => {
    const p = pending.current;
    clearTimeout(p.timer);
    if (p.text === null || !p.id) return true;
    const { id, text } = p;
    p.text = null;
    setSaveState("saving");
    try {
      const w = await api.save(id, text, opts);
      setList((l) => (l ? l.map((x) => (x.id === id ? { ...x, ...w } : x)) : l));
      setSaveState(p.text === null ? "saved" : "saving");
      return true;
    } catch (err) {
      if (err.status === 401) return onExpired(), false;
      if (p.text === null && p.id === id) p.text = text; // keep it for the retry
      setSaveState("error");
      p.timer = setTimeout(() => flush(), 5000);
      return false;
    }
  }, [onExpired]);

  const onChange = useCallback((text) => {
    const p = pending.current;
    if (!p.baseline) { p.baseline = true; return; } // the first call is just the loaded build
    p.text = text;
    setSaveState("saving");
    clearTimeout(p.timer);
    p.timer = setTimeout(() => flush(), SAVE_DELAY);
  }, [flush]);

  const open = useCallback(async (id) => {
    setMenu(false);
    if (id === pending.current.id && loaded) return;
    if (!(await flush())) say("Couldn't save the current workspace yet. Try again in a moment.");
    try {
      const w = await api.get(id);
      let initial = null;
      if (w.data) {
        try { initial = parseStructure(w.data); } catch (err) { say("This workspace's data couldn't be read: " + err.message); }
      }
      pending.current = { id, text: null, timer: null, baseline: false };
      remember(id);
      setSaveState("saved");
      setLoaded({ id, initial });
    } catch (err) {
      if (err.status === 401) return onExpired();
      say(err.message);
    }
  }, [flush, loaded, onExpired, say]);

  // first load: list the workspaces, make one if there are none (bringing along this browser's old autosave)
  useEffect(() => {
    (async () => {
      try {
        let ws = await api.list();
        if (!ws.length) {
          let old = null;
          try { const t = localStorage.getItem(STORAGE_KEY); if (t) { parseStructure(t); old = t; } } catch { /* unusable autosave */ }
          const w = await api.create("My first build", old);
          ws = [w];
        }
        setList(ws);
        const id = ws.find((w) => w.id === remembered())?.id || ws[0].id;
        const w = await api.get(id);
        let initial = null;
        if (w.data) try { initial = parseStructure(w.data); } catch { /* shows an empty plate */ }
        pending.current = { id, text: null, timer: null, baseline: false };
        remember(id);
        setLoaded({ id, initial });
      } catch (err) {
        if (err.status === 401) onExpired(); else say(err.message);
      }
    })();
  }, [onExpired, say]);

  // save when the tab is hidden or closed, and warn if something is unsaved
  useEffect(() => {
    const hide = () => document.visibilityState === "hidden" && flush({ keepalive: true });
    const warn = (e) => { if (pending.current.text !== null) { e.preventDefault(); e.returnValue = ""; } };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("beforeunload", warn);
    return () => { document.removeEventListener("visibilitychange", hide); window.removeEventListener("beforeunload", warn); };
  }, [flush]);

  const create = async () => {
    try {
      await flush();
      const w = await api.create("Untitled workspace");
      await refresh();
      await open(w.id);
      setEditing(w.id);
      setEditName(w.name);
      setMenu(true);
    } catch (err) { say(err.message); }
  };
  const dup = async (id) => {
    try { await flush(); const w = await api.duplicate(id); await refresh(); await open(w.id); } catch (err) { say(err.message); }
  };
  const rename = async (id) => {
    const n = editName.trim();
    setEditing(null);
    if (!n) return;
    try { const w = await api.rename(id, n); setList((l) => l.map((x) => (x.id === id ? { ...x, name: w.name } : x))); } catch (err) { say(err.message); }
  };
  const del = async (id) => {
    setConfirmDel(null);
    try {
      if (id === pending.current.id) { clearTimeout(pending.current.timer); pending.current.text = null; }
      await api.remove(id);
      let rest = list.filter((x) => x.id !== id);
      if (!rest.length) rest = [await api.create("My first build")];
      setList(rest);
      if (id === activeId) { pending.current.id = null; await open(rest[0].id); }
    } catch (err) { say(err.message); }
  };
  const signOut = async () => {
    await flush();
    try { await api.logout(); } catch { /* the session may already be gone */ }
    onLogout();
  };

  const current = list?.find((w) => w.id === activeId);
  return (
    <>
      <div className="bar">
        <span className="logo">Hobby Builder</span>
        <button className="btn" onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
          {current ? current.name : "Workspaces"} ▾
        </button>
        <span className="grow" />
        <span className={"status" + (saveState === "error" ? " err" : "")} aria-live="polite">
          {saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved. Retrying…" : "All changes saved"}
        </span>
        <span style={{ opacity: 0.8 }}>{user.name}</span>
        <button className="btn" onClick={signOut}>Sign out</button>
      </div>
      {menu && list && (
        <div className="menu" role="menu">
          {list.map((w) => (
            <div key={w.id} className={"row" + (w.id === activeId ? " on" : "")}>
              {editing === w.id ? (
                <input className="f" autoFocus value={editName} maxLength={60} onChange={(e) => setEditName(e.target.value)} onBlur={() => rename(w.id)} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditing(null); }} />
              ) : confirmDel === w.id ? (
                <>
                  <span className="nm"><b>Delete “{w.name}”?</b><small>This can't be undone.</small></span>
                  <button className="btn danger" onClick={() => del(w.id)}>Delete</button>
                  <button className="btn" onClick={() => setConfirmDel(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <button className="nm" onClick={() => open(w.id)}>
                    <b>{w.name}</b>
                    <small>{w.pieceCount} piece{w.pieceCount === 1 ? "" : "s"} · {new Date(w.updatedAt).toLocaleDateString()}</small>
                  </button>
                  <button className="ico" title="Rename" aria-label={`Rename ${w.name}`} onClick={() => { setEditing(w.id); setEditName(w.name); }}>✎</button>
                  <button className="ico" title="Duplicate" aria-label={`Duplicate ${w.name}`} onClick={() => dup(w.id)}>⧉</button>
                  <button className="ico" title="Delete" aria-label={`Delete ${w.name}`} onClick={() => setConfirmDel(w.id)}>🗑</button>
                </>
              )}
            </div>
          ))}
          <button className="btn pri" style={{ width: "100%", marginTop: 6 }} onClick={create}>+ New workspace</button>
        </div>
      )}
      {toast && <div className="toast" role="alert">{toast}</div>}
      {loaded ? <HobbyBuilder key={loaded.id} initial={loaded.initial} onChange={onChange} /> : <div className="center">Loading your workspaces…</div>}
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = checking, null = signed out
  const [notice, setNotice] = useState("");
  useEffect(() => { api.me().then(setUser).catch((e) => { setUser(null); setNotice(e.message); }); }, []);
  const expired = useCallback(() => { setNotice("Your session ended. Please sign in again."); setUser(null); }, []);
  const out = useCallback(() => { setNotice(""); setUser(null); }, []);
  return (
    <div className="hbw">
      <style>{CSS}</style>
      {user === undefined ? <div className="center">Loading…</div> : user === null ? <AuthScreen key={notice} notice={notice} onAuth={(u) => { setNotice(""); setUser(u); }} /> : <Workspaces user={user} onLogout={out} onExpired={expired} />}
    </div>
  );
}
