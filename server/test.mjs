// Runs the API against the in-memory database: node test.mjs
import assert from "node:assert/strict";
import { connect } from "./db.js";
import { createApp } from "./app.js";

const db = await connect({ uri: "memory" });
const server = createApp({ db, secret: "test-secret" }).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

// a tiny cookie-keeping client
const client = () => {
  let cookie = "";
  return async (method, url, body, headers = {}) => {
    const r = await fetch(base + url, { method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...headers }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const sc = r.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0].startsWith("hb.sid=;") ? "" : sc.split(";")[0];
    return { status: r.status, body: await r.json().catch(() => null), setCookie: sc };
  };
};
const struct = (n) => JSON.stringify({ app: "hobby-builder", version: 1, baseSize: 16, pieces: Array.from({ length: n }, (_, i) => ({ type: "brick", x: i, z: 0, y: 0, rot: 0, color: "#fff" })) });
let passed = 0;
const t = async (name, fn) => { await fn(); passed++; console.log("ok  " + name); };

const a = client(), b = client(), anon = client();
await t("anonymous: me is null, workspaces need login", async () => {
  assert.equal((await anon("GET", "/api/auth/me")).body.user, null);
  assert.equal((await anon("GET", "/api/workspaces")).status, 401);
});
await t("register validates input", async () => {
  assert.equal((await anon("POST", "/api/auth/register", { name: "A", email: "x@y.co", password: "longenough" })).status, 400);
  assert.equal((await anon("POST", "/api/auth/register", { name: "Asha", email: "nope", password: "longenough" })).status, 400);
  assert.equal((await anon("POST", "/api/auth/register", { name: "Asha", email: "a@b.co", password: "short" })).status, 400);
});
await t("register starts a session with a httpOnly cookie, password is hashed", async () => {
  const r = await a("POST", "/api/auth/register", { name: "Asha", email: "Asha@Example.com", password: "correct horse" });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.email, "asha@example.com");
  assert.ok(/HttpOnly/i.test(r.setCookie) && /SameSite=Lax/i.test(r.setCookie));
  assert.equal(JSON.stringify(r.body).includes("hash"), false);
  const row = await db.users.findOne({ email: "asha@example.com" });
  assert.ok(row.hash.startsWith("$2") && !row.hash.includes("correct"));
  assert.equal((await a("GET", "/api/auth/me")).body.user.name, "Asha");
});
await t("duplicate email is refused", async () => {
  assert.equal((await anon("POST", "/api/auth/register", { name: "Other", email: "asha@example.com", password: "another pass" })).status, 409);
});
await t("login: wrong password / unknown email rejected, right one works", async () => {
  assert.equal((await anon("POST", "/api/auth/login", { email: "asha@example.com", password: "wrong pass!" })).status, 401);
  assert.equal((await anon("POST", "/api/auth/login", { email: "ghost@example.com", password: "whatever12" })).status, 401);
  const c = client();
  assert.equal((await c("POST", "/api/auth/login", { email: "ASHA@example.com", password: "correct horse" })).status, 200);
  assert.equal((await c("GET", "/api/auth/me")).body.user.email, "asha@example.com");
});
await t("workspaces: create, list, get, rename, save data", async () => {
  const c1 = await a("POST", "/api/workspaces", { name: "Kerala house" });
  assert.equal(c1.status, 201);
  assert.equal(c1.body.workspace.data, null);
  const id = c1.body.workspace.id;
  const c2 = await a("POST", "/api/workspaces", { name: "kerala HOUSE", data: struct(3) });
  assert.equal(c2.body.workspace.name, "kerala HOUSE 2"); // names stay unique
  assert.equal(c2.body.workspace.pieceCount, 3);
  assert.equal((await a("GET", "/api/workspaces")).body.workspaces.length, 2);
  const put = await a("PUT", `/api/workspaces/${id}`, { name: "Village home", data: struct(5) });
  assert.equal(put.status, 200);
  const got = (await a("GET", `/api/workspaces/${id}`)).body.workspace;
  assert.equal(got.name, "Village home");
  assert.equal(got.pieceCount, 5);
  assert.equal(JSON.parse(got.data).pieces.length, 5);
});
await t("workspaces: bad data rejected", async () => {
  const id = (await a("GET", "/api/workspaces")).body.workspaces[0].id;
  assert.equal((await a("PUT", `/api/workspaces/${id}`, { data: "not json" })).status, 400);
  assert.equal((await a("PUT", `/api/workspaces/${id}`, { data: JSON.stringify({ app: "other", pieces: [] }) })).status, 400);
  assert.equal((await a("PUT", `/api/workspaces/${id}`, { name: "  " })).status, 400);
  assert.equal((await a("POST", "/api/workspaces", { data: "x".repeat(5 * 1024 * 1024 + 10) })).status, 400);
});
await t("users can't see or change each other's workspaces", async () => {
  await b("POST", "/api/auth/register", { name: "Ben", email: "ben@example.com", password: "bens password" });
  const aid = (await a("GET", "/api/workspaces")).body.workspaces[0].id;
  assert.equal((await b("GET", "/api/workspaces")).body.workspaces.length, 0);
  assert.equal((await b("GET", `/api/workspaces/${aid}`)).status, 404);
  assert.equal((await b("PUT", `/api/workspaces/${aid}`, { name: "hacked" })).status, 404);
  assert.equal((await b("DELETE", `/api/workspaces/${aid}`)).status, 404);
  assert.equal((await b("POST", `/api/workspaces/${aid}/duplicate`, {})).status, 404);
});
await t("duplicate and delete", async () => {
  const list = (await a("GET", "/api/workspaces")).body.workspaces;
  const src = list.find((w) => w.pieceCount === 5);
  const d = await a("POST", `/api/workspaces/${src.id}/duplicate`, {});
  assert.equal(d.status, 201);
  assert.equal(d.body.workspace.name, "Village home copy");
  assert.equal(d.body.workspace.pieceCount, 5);
  assert.equal((await a("DELETE", `/api/workspaces/${d.body.workspace.id}`)).status, 200);
  assert.equal((await a("GET", `/api/workspaces/${d.body.workspace.id}`)).status, 404);
});
await t("limit of 25 workspaces", async () => {
  const c = client();
  await c("POST", "/api/auth/register", { name: "Cara", email: "cara@example.com", password: "caras password" });
  for (let i = 0; i < 25; i++) assert.equal((await c("POST", "/api/workspaces", { name: "w" + i })).status, 201);
  assert.equal((await c("POST", "/api/workspaces", { name: "one more" })).status, 409);
});
await t("cross-site writes are blocked, JSON required", async () => {
  assert.equal((await a("POST", "/api/workspaces", { name: "evil" }, { origin: "https://evil.example" })).status, 403);
  assert.equal((await a("POST", "/api/workspaces", { name: "same" }, { origin: base })).status, 201);
});
await t("logout ends the session", async () => {
  assert.equal((await a("POST", "/api/auth/logout", {})).status, 200);
  assert.equal((await a("GET", "/api/auth/me")).body.user, null);
  assert.equal((await a("GET", "/api/workspaces")).status, 401);
});
console.log(`\n${passed} passed`);
server.close();
process.exit(0);
