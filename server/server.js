import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import express from "express";
import { connect } from "./db.js";
import { createApp } from "./app.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const production = process.env.NODE_ENV === "production";
let secret = process.env.SESSION_SECRET;
if (!secret || secret === "change-me") {
  if (production) { console.error("Set SESSION_SECRET in the environment."); process.exit(1); }
  secret = crypto.randomBytes(32).toString("hex");
  console.warn("SESSION_SECRET not set: using a random one (sessions end when the server restarts).");
}
const dbName = process.env.MONGODB_DB || "hobby_builder";
const db = await connect({ uri: process.env.MONGODB_URI, dbName });
db.dbName = dbName;
console.log(db.memory ? "Using the in-memory database (data is lost on restart)." : "Connected to MongoDB.");

const api = createApp({ db, secret, production, allowedOrigins: (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean) });
const app = express();
app.use(api);
// Serve the built web app if it is next to this folder (npm run build output in ../dist)
const dist = path.join(here, "..", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));
}
const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`Hobby Builder server on http://localhost:${port}`));
