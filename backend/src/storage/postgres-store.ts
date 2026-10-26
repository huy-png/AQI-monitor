import { Pool } from "pg";

type Doc = Record<string, unknown>;
const tables = new Set(["firebase_readings", "environment_alerts", "alert_settings"]);
const field = (key: string) => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) throw new Error("Invalid storage field");
  return `(data->>'${key}') COLLATE "C"`;
};
const scalar = (v: unknown) => v instanceof Date ? v.toISOString() : String(v);
export function predicate(filter: Doc, values: unknown[]): string {
  return Object.entries(filter).map(([key, value]) => {
    if (key === "$or") return `(${(value as Doc[]).map(f => predicate(f, values)).join(" OR ")})`;
    const expression = field(key);
    const compare = (op: string, val: unknown) => {
      const operators: Record<string, string> = { $gte: ">=", $lte: "<=", $gt: ">", $lt: "<", $ne: "IS DISTINCT FROM", $eq: "=" };
      if (!operators[op]) throw new Error("Unsupported storage operator");
      values.push(scalar(val));
      return `${expression} ${operators[op]} $${values.length}`;
    };
    if (value && typeof value === "object" && !(value instanceof Date)) return `(${Object.entries(value).map(([op, val]) => compare(op, val)).join(" AND ")})`;
    return compare("$eq", value);
  }).join(" AND ") || "TRUE";
}
function hydrate<T>(data: Doc): T {
  for (const key of ["timestamp", "receivedAt", "createdAt", "effectiveAt"]) if (typeof data[key] === "string") data[key] = new Date(data[key] as string);
  return data as T;
}
class PgCollection<T> {
  constructor(private pool: Pool, private table: string) {}
  async distinct(key: string): Promise<string[]> {
    const rows = await this.pool.query(`SELECT DISTINCT ${field(key)} AS value FROM ${this.table}`);
    return rows.rows.map(row => row.value).filter(value => typeof value === "string");
  }
  async createIndex(_keys: unknown) { /* Indexes are installed once by PostgresStore.open. */ }
  find(filter: Doc = {}) {
    let order: Record<string, number> = {}, count: number | undefined;
    const cursor = {
      sort: (value: Record<string, number>) => { order = value; return cursor; },
      limit: (value: number) => { count = value; return cursor; },
      toArray: async (): Promise<T[]> => {
        const values: unknown[] = [];
        let sql = `SELECT data FROM ${this.table} WHERE ${predicate(filter, values)}`;
        if (Object.keys(order).length) sql += " ORDER BY " + Object.entries(order).map(([k, v]) => `${field(k)} ${v < 0 ? "DESC" : "ASC"}`).join(", ");
        if (count !== undefined) { values.push(count); sql += ` LIMIT $${values.length}`; }
        return (await this.pool.query(sql, values)).rows.map(r => hydrate<T>(r.data));
      }
    };
    return cursor;
  }
  async findOne(filter: Doc, options?: { sort?: Record<string, number> }): Promise<T | null> {
    return (await this.find(filter).sort(options?.sort ?? {}).limit(1).toArray())[0] ?? null;
  }
  async updateOne(filter: Doc, update: { $set?: Doc; $setOnInsert?: Doc }, options?: { upsert?: boolean }) {
    if (typeof filter._id !== "string" || Object.keys(filter).length !== 1) throw new Error("Storage updates require a single string ID");
    if (options?.upsert) {
      const doc = { ...update.$setOnInsert, ...update.$set, _id: filter._id };
      const result = await this.pool.query(`INSERT INTO ${this.table} (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) ${update.$set ? "DO UPDATE SET data = " + this.table + ".data || $3::jsonb" : "DO NOTHING"}`, update.$set ? [filter._id, JSON.stringify(doc), JSON.stringify(update.$set)] : [filter._id, JSON.stringify(doc)]);
      return { matchedCount: result.rowCount ?? 0 };
    }
    const result = await this.pool.query(`UPDATE ${this.table} SET data = data || $2::jsonb WHERE id = $1`, [filter._id, JSON.stringify(update.$set ?? {})]);
    return { matchedCount: result.rowCount ?? 0 };
  }
}
export class PostgresStore {
  readonly readyState = 1;
  readonly db = { collection: <T>(name: string) => {
    if (!tables.has(name)) throw new Error("Unsupported storage table");
    return new PgCollection<T>(this.pool, name);
  } };
  constructor(readonly pool: Pool) {}
  static async open(url: string) {
    const pool = new Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 5000 });
    pool.on("error", () => { /* Requests and health probes report connectivity failures. */ });
    try {
      for (const table of tables) await pool.query(`CREATE TABLE IF NOT EXISTS ${table} (id text PRIMARY KEY, data jsonb NOT NULL CHECK (data->>'_id' = id))`);
      for (const [name, table, keys] of [
        ["readings_history", "firebase_readings", ["deviceId", "timestamp", "_id"]],
        ["readings_received", "firebase_readings", ["deviceId", "receivedAt", "_id"]],
        ["readings_pending", "firebase_readings", ["alertEvaluated", "receivedAt"]],
        ["alerts_recent", "environment_alerts", ["deviceId", "metric", "reason", "createdAt"]],
        ["alerts_order", "environment_alerts", ["createdAt", "_id"]]
      ] as const) await pool.query(`CREATE INDEX IF NOT EXISTS ${name} ON ${table} (${keys.map(k => `(${field(k)})`).join(", ")})`);
      return new PostgresStore(pool);
    } catch (error) { await pool.end(); throw error; }
  }
  async ping() { await this.pool.query("SELECT 1"); }
  async onModuleDestroy() { await this.pool.end(); }
}
