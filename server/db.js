import { MongoClient } from "mongodb";

/* A tiny in-memory stand-in for the few collection calls the app uses. It is only used when
   MONGODB_URI is empty or "memory" (tests, quick local tries). Data is lost on restart. */
class MemCollection {
  constructor() { this.rows = []; this.n = 0; }
  match(row, f) { return Object.entries(f).every(([k, v]) => String(row[k]) === String(v)); }
  async findOne(f) { const r = this.rows.find((x) => this.match(x, f)); return r ? { ...r } : null; }
  async insertOne(doc) {
    if (this.unique) for (const k of this.unique) if (this.rows.some((r) => r[k] === doc[k])) { const e = new Error("duplicate key"); e.code = 11000; throw e; }
    const _id = doc._id || `m${++this.n}`; this.rows.push({ ...doc, _id }); return { insertedId: _id };
  }
  find(f = {}) {
    let out = this.rows.filter((x) => this.match(x, f)).map((x) => ({ ...x }));
    const cur = {
      sort: (s) => { const [k, d] = Object.entries(s)[0]; out.sort((a, b) => (a[k] > b[k] ? d : a[k] < b[k] ? -d : 0)); return cur; },
      project: () => cur,
      toArray: async () => out,
    };
    return cur;
  }
  async updateOne(f, u) { const r = this.rows.find((x) => this.match(x, f)); if (r) Object.assign(r, u.$set || {}); return { matchedCount: r ? 1 : 0 }; }
  async deleteOne(f) { const i = this.rows.findIndex((x) => this.match(x, f)); if (i >= 0) this.rows.splice(i, 1); return { deletedCount: i >= 0 ? 1 : 0 }; }
  async deleteMany(f) { const before = this.rows.length; this.rows = this.rows.filter((x) => !this.match(x, f)); return { deletedCount: before - this.rows.length }; }
  async countDocuments(f = {}) { return this.rows.filter((x) => this.match(x, f)).length; }
  async createIndex() {}
}

export async function connect({ uri, dbName }) {
  if (!uri || uri === "memory") {
    const users = new MemCollection();
    users.unique = ["email"];
    return { users, workspaces: new MemCollection(), client: null, memory: true, close: async () => {} };
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(dbName);
  const users = db.collection("users");
  const workspaces = db.collection("workspaces");
  await users.createIndex({ email: 1 }, { unique: true });
  await workspaces.createIndex({ userId: 1, updatedAt: -1 });
  return { users, workspaces, client, memory: false, close: () => client.close() };
}
