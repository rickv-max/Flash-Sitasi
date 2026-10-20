export class MemoryFirestore {
  constructor() { this.records = new Map(); this.queue = Promise.resolve(); }
  doc(path) {
    const db = this;
    return { path, id: path.split('/').at(-1), get: async () => db.snapshot(path),
      set: async (data) => { db.records.set(path, structuredClone(data)); },
      update: async (data) => { if (!db.records.has(path)) throw new Error('Missing document'); db.records.set(path, { ...db.records.get(path), ...structuredClone(data) }); },
      delete: async () => db.records.delete(path) };
  }
  snapshot(path, records = this.records) {
    return { path, ref: this.doc(path), exists: records.has(path), id: path.split('/').at(-1), data: () => structuredClone(records.get(path)) };
  }
  collection(path) { return new MemoryQuery(this, path); }
  collectionGroup(name) { return new MemoryQuery(this, name, true); }
  runTransaction(callback) {
    const task = this.queue.then(async () => {
      const draft = new Map([...this.records].map(([key, value]) => [key, structuredClone(value)]));
      let written = false;
      const tx = { get: async (ref) => { if (written) throw new Error('Transaction read after write'); return ref instanceof MemoryQuery ? ref.get() : this.snapshot(ref.path, draft); },
        set: (ref, data) => { written = true; draft.set(ref.path, structuredClone(data)); },
        update: (ref, data) => { written = true; if (!draft.has(ref.path)) throw new Error('Missing document'); draft.set(ref.path, { ...draft.get(ref.path), ...structuredClone(data) }); } };
      tx.delete = (ref) => { written = true; draft.delete(ref.path); };
      const result = await callback(tx); this.records = draft; return result;
    });
    this.queue = task.catch(() => {});
    return task;
  }
}
class MemoryQuery {
  constructor(db, path, group = false, filters = [], order = [], cap = Infinity, cursor = null) { Object.assign(this, { db, path, group, filters, order, cap, cursor }); }
  copy(patch) { return Object.assign(new MemoryQuery(this.db, this.path), this, patch); }
  doc(id) { return this.db.doc(`${this.path}/${id}`); }
  where(field, op, value) { return this.copy({ filters: [...this.filters, [field, op, value]] }); }
  orderBy(field, direction = 'asc') { return this.copy({ order: [...this.order, [field, direction]] }); }
  limit(cap) { return this.copy({ cap }); }
  startAfter(cursor) { return this.copy({ cursor }); }
  async get() {
    let docs = [...this.db.records.keys()].filter((path) => this.group ? path.split('/').at(-2) === this.path : path.startsWith(`${this.path}/`) && path.split('/').length === this.path.split('/').length + 1).map((path) => this.db.snapshot(path));
    docs = docs.filter((doc) => this.filters.every(([field, op, expected]) => {
      const actual = doc.data()[field];
      if (actual === undefined) return false;
      return ({ '==': () => actual === expected, '>=': () => actual >= expected, '<=': () => actual <= expected, '<': () => actual < expected, '>': () => actual > expected })[op]();
    }));
    docs = docs.filter((doc) => this.order.every(([field]) => doc.data()[field] !== undefined));
    const compare = (a, b) => {
      for (const [field, direction] of this.order) { const av = a.data()[field], bv = b.data()[field]; if (av !== bv) return (av < bv ? -1 : 1) * (direction === 'desc' ? -1 : 1); }
      return a.path.localeCompare(b.path) * (this.order.at(-1)?.[1] === 'desc' ? -1 : 1);
    };
    docs.sort(compare);
    if (this.cursor) docs = docs.filter((doc) => compare(doc, this.cursor) > 0);
    return { docs: docs.slice(0, this.cap) };
  }
  count() { return { get: async () => { const { docs } = await this.get(); return { data: () => ({ count: docs.length }) }; } }; }
  aggregate(spec) {
    return { get: async () => {
      const { docs } = await this.get();
      const values = Object.fromEntries(Object.entries(spec).map(([alias, field]) => [alias, field.aggregateType === 'count' ? docs.length : docs.reduce((total, doc) => total + (typeof doc.data()[field._field] === 'number' ? doc.data()[field._field] : 0), 0)]));
      return { data: () => values };
    } };
  }
}
export const env = { APP_URL: 'https://flashcite.example', BAYAR_GG_API_KEY: 'test-api-key', BAYAR_GG_WEBHOOK_SECRET: 'test-webhook-secret' };
export const user = { uid: 'writer-one', name: 'Penulis Satu', email: 'writer@example.test' };
export const headers = { authorization: 'Bearer test-id-token', 'idempotency-key': 'test-request-key-0001' };
export async function call(handler, { method = 'POST', body = {}, query = {}, customHeaders = {} } = {}) {
  const req = { method, body, query, headers: { ...headers, ...customHeaders } };
  const res = { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler(req, res); return res;
}
