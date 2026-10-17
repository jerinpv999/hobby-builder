import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { ObjectId } from "mongodb";

const MAX_WORKSPACES = 25;
const MAX_DATA = 5 * 1024 * 1024; // characters of saved JSON per workspace
const SESSION_DAYS = 14;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Only the shape is checked here; the browser validates every piece when it loads the data. */
function checkData(data) {
  if (typeof data !== "string" || data.length > MAX_DATA) return { error: "Workspace data is missing or too large." };
  let j;
  try { j = JSON.parse(data); } catch { return { error: "Workspace data isn't valid JSON." }; }
  if (!j || (j.app !== "hobby-builder" && j.app !== "lego-builder") || !Array.isArray(j.pieces)) return { error: "That isn't Hobby Builder data." };
  return { count: j.pieces.length };
}
const cleanName = (s, def = "") => (typeof s === "string" ? s.trim().replace(/\s+/g, " ").slice(0, 60) : "") || def;
const idOf = (s) => (typeof s === "string" && ObjectId.isValid(s) ? new ObjectId(s) : s);
const same = (a, b) => String(a) === String(b);
const dupe = (e) => e && e.code === 11000;

export function createApp({ db, secret, production = false, allowedOrigins = [] }) {
  const app = express();
  app.disable("x-powered-by");
  if (production) app.set("trust proxy", 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: "6mb" }));

  const store = db.memory ? undefined : MongoStore.create({ client: db.client, dbName: db.dbName, collectionName: "sessions", ttl: SESSION_DAYS * 86400 });
  app.use(
    session({
      name: "hb.sid",
      secret,
      store,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: { httpOnly: true, sameSite: "lax", secure: production, maxAge: SESSION_DAYS * 86400 * 1000 },
    })
  );

  // Cross-site writes are refused. A write is fine when the browser says it comes from this same site (Sec-Fetch-Site,
  // which pages can't fake), when the Origin matches this host or an allowed origin, or, in development, from localhost.
  const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
  app.use("/api", (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.get("origin");
    const site = req.get("sec-fetch-site");
    if (origin && site !== "same-origin") {
      let ok = allowedOrigins.includes(origin) || (!production && local.test(origin));
      try { ok = ok || new URL(origin).host === req.get("host"); } catch { ok = false; }
      if (!ok) return res.status(403).json({ error: `Request blocked: unexpected origin ${origin}. Add it to ALLOWED_ORIGINS in server/.env.` });
    }
    if (!req.is("application/json") && req.method !== "DELETE") return res.status(415).json({ error: "Send JSON." });
    next();
  });

  const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: "Too many attempts. Try again in a few minutes." } });
  const publicUser = (u) => ({ id: String(u._id), name: u.name, email: u.email });
  const requireUser = (req, res, next) => (req.session.uid ? next() : res.status(401).json({ error: "Please sign in." }));
  const startSession = (req, user) =>
    new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : ((req.session.uid = String(user._id)), req.session.save((e) => (e ? reject(e) : resolve()))))));

  /* ---------- auth ---------- */
  app.post("/api/auth/register", authLimit, async (req, res, next) => {
    try {
      const name = cleanName(req.body?.name);
      const email = String(req.body?.email || "").trim().toLowerCase();
      const password = String(req.body?.password || "");
      if (name.length < 2) return res.status(400).json({ error: "Enter your name." });
      if (!EMAIL.test(email) || email.length > 120) return res.status(400).json({ error: "Enter a valid email address." });
      if (password.length < 8 || password.length > 200) return res.status(400).json({ error: "Password must be 8 to 200 characters." });
      const hash = await bcrypt.hash(password, 12);
      let user = { name, email, hash, createdAt: new Date() };
      try {
        const r = await db.users.insertOne(user);
        user._id = r.insertedId;
      } catch (e) {
        if (dupe(e)) return res.status(409).json({ error: "An account with that email already exists." });
        throw e;
      }
      await startSession(req, user);
      res.status(201).json({ user: publicUser(user) });
    } catch (e) { next(e); }
  });

  const DUMMY = bcrypt.hashSync("not-a-real-password", 12); // keeps login time similar for unknown emails
  app.post("/api/auth/login", authLimit, async (req, res, next) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const password = String(req.body?.password || "");
      const user = email ? await db.users.findOne({ email }) : null;
      const ok = await bcrypt.compare(password.slice(0, 200), user ? user.hash : DUMMY);
      if (!user || !ok) return res.status(401).json({ error: "Wrong email or password." });
      await startSession(req, user);
      res.json({ user: publicUser(user) });
    } catch (e) { next(e); }
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie("hb.sid");
      res.json({ ok: true });
    });
  });

  app.get("/api/auth/me", async (req, res, next) => {
    try {
      if (!req.session.uid) return res.json({ user: null });
      const user = await db.users.findOne({ _id: idOf(req.session.uid) });
      if (!user) return req.session.destroy(() => res.json({ user: null }));
      res.json({ user: publicUser(user) });
    } catch (e) { next(e); }
  });

  /* ---------- workspaces ---------- */
  const summary = (w) => ({ id: String(w._id), name: w.name, pieceCount: w.pieceCount || 0, updatedAt: w.updatedAt, createdAt: w.createdAt });
  const mine = async (req, res) => {
    const w = await db.workspaces.findOne({ _id: idOf(req.params.id), userId: req.session.uid });
    if (!w) res.status(404).json({ error: "Workspace not found." });
    return w;
  };
  const uniqueName = async (userId, base, skipId) => {
    const names = (await db.workspaces.find({ userId }).toArray()).filter((w) => !skipId || !same(w._id, skipId)).map((w) => w.name.toLowerCase());
    let n = base, i = 2;
    while (names.includes(n.toLowerCase())) n = `${base.slice(0, 54)} ${i++}`;
    return n;
  };

  app.get("/api/workspaces", requireUser, async (req, res, next) => {
    try {
      const list = await db.workspaces.find({ userId: req.session.uid }).sort({ updatedAt: -1 }).toArray();
      res.json({ workspaces: list.map(summary) });
    } catch (e) { next(e); }
  });

  app.post("/api/workspaces", requireUser, async (req, res, next) => {
    try {
      if ((await db.workspaces.countDocuments({ userId: req.session.uid })) >= MAX_WORKSPACES) return res.status(409).json({ error: `You can have up to ${MAX_WORKSPACES} workspaces. Delete one first.` });
      let data = req.body?.data;
      let pieceCount = 0;
      if (data !== undefined && data !== null) {
        const c = checkData(data);
        if (c.error) return res.status(400).json({ error: c.error });
        pieceCount = c.count;
      } else data = null; // null = a fresh empty baseplate
      const now = new Date();
      const doc = { userId: req.session.uid, name: await uniqueName(req.session.uid, cleanName(req.body?.name, "Untitled workspace")), data, pieceCount, createdAt: now, updatedAt: now };
      const r = await db.workspaces.insertOne(doc);
      doc._id = r.insertedId;
      res.status(201).json({ workspace: { ...summary(doc), data } });
    } catch (e) { next(e); }
  });

  app.get("/api/workspaces/:id", requireUser, async (req, res, next) => {
    try {
      const w = await mine(req, res);
      if (w) res.json({ workspace: { ...summary(w), data: w.data } });
    } catch (e) { next(e); }
  });

  app.put("/api/workspaces/:id", requireUser, async (req, res, next) => {
    try {
      const w = await mine(req, res);
      if (!w) return;
      const set = { updatedAt: new Date() };
      if (req.body?.name !== undefined) {
        const n = cleanName(req.body.name);
        if (!n) return res.status(400).json({ error: "Give the workspace a name." });
        set.name = await uniqueName(req.session.uid, n, w._id);
      }
      if (req.body?.data !== undefined) {
        const c = checkData(req.body.data);
        if (c.error) return res.status(400).json({ error: c.error });
        set.data = req.body.data;
        set.pieceCount = c.count;
      }
      await db.workspaces.updateOne({ _id: w._id, userId: req.session.uid }, { $set: set });
      res.json({ workspace: summary({ ...w, ...set }) });
    } catch (e) { next(e); }
  });

  app.post("/api/workspaces/:id/duplicate", requireUser, async (req, res, next) => {
    try {
      const w = await mine(req, res);
      if (!w) return;
      if ((await db.workspaces.countDocuments({ userId: req.session.uid })) >= MAX_WORKSPACES) return res.status(409).json({ error: `You can have up to ${MAX_WORKSPACES} workspaces. Delete one first.` });
      const now = new Date();
      const doc = { userId: req.session.uid, name: await uniqueName(req.session.uid, `${w.name.slice(0, 50)} copy`), data: w.data, pieceCount: w.pieceCount || 0, createdAt: now, updatedAt: now };
      doc._id = (await db.workspaces.insertOne(doc)).insertedId;
      res.status(201).json({ workspace: { ...summary(doc), data: doc.data } });
    } catch (e) { next(e); }
  });

  app.delete("/api/workspaces/:id", requireUser, async (req, res, next) => {
    try {
      const w = await mine(req, res);
      if (!w) return;
      await db.workspaces.deleteOne({ _id: w._id, userId: req.session.uid });
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err?.type === "entity.too.large") return res.status(413).json({ error: "That workspace is too large to save." });
    if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Bad JSON." });
    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server." });
  });
  return app;
}
