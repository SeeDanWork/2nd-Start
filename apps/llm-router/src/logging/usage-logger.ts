// @ts-expect-error sql.js has no type declarations
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import type { UsageLog } from '../types.js';

const DB_PATH = path.resolve(process.cwd(), 'usage.db');

let db: any = null;
let initPromise: Promise<void> | null = null;

async function getDb(): Promise<any> {
  if (db) return db;
  if (initPromise) {
    await initPromise;
    return db!;
  }

  initPromise = (async () => {
    const SQL = await initSqlJs();
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }
    db.run(`
      CREATE TABLE IF NOT EXISTS usage_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        task_type TEXT NOT NULL,
        model_used TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        latency_ms INTEGER NOT NULL,
        success INTEGER NOT NULL,
        cached INTEGER NOT NULL DEFAULT 0
      )
    `);
  })();

  await initPromise;
  return db!;
}

function persist(): void {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

export async function logUsage(log: UsageLog): Promise<void> {
  const d = await getDb();
  d.run(
    `INSERT INTO usage_logs (timestamp, task_type, model_used, input_tokens, output_tokens, latency_ms, success, cached)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [log.timestamp, log.task_type, log.model_used, log.input_tokens, log.output_tokens, log.latency_ms, log.success ? 1 : 0, log.cached ? 1 : 0]
  );
  persist();
}

export async function getRecentLogs(limit = 50): Promise<UsageLog[]> {
  const d = await getDb();
  const results = d.exec(`SELECT timestamp, task_type, model_used, input_tokens, output_tokens, latency_ms, success, cached FROM usage_logs ORDER BY id DESC LIMIT ${limit}`);
  if (!results.length) return [];

  return results[0].values.map((row: any[]) => ({
    timestamp: row[0] as string,
    task_type: row[1] as any,
    model_used: row[2] as any,
    input_tokens: row[3] as number,
    output_tokens: row[4] as number,
    latency_ms: row[5] as number,
    success: !!(row[6] as number),
    cached: !!(row[7] as number),
  }));
}

export async function getUsageSummary(): Promise<{
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  avg_latency_ms: number;
  by_model: Record<string, { calls: number; tokens: number }>;
  cache_hit_rate: number;
}> {
  const d = await getDb();

  const totals = d.exec(`
    SELECT
      COUNT(*) as total_calls,
      COALESCE(SUM(input_tokens), 0) as total_input_tokens,
      COALESCE(SUM(output_tokens), 0) as total_output_tokens,
      COALESCE(AVG(latency_ms), 0) as avg_latency_ms,
      COALESCE(SUM(cached), 0) as cache_hits
    FROM usage_logs
  `);

  const t = totals[0]?.values[0] || [0, 0, 0, 0, 0];

  const byModelResult = d.exec(`
    SELECT model_used, COUNT(*) as calls, SUM(input_tokens + output_tokens) as tokens
    FROM usage_logs GROUP BY model_used
  `);

  const by_model: Record<string, { calls: number; tokens: number }> = {};
  if (byModelResult.length > 0) {
    for (const row of byModelResult[0].values) {
      by_model[row[0] as string] = { calls: row[1] as number, tokens: row[2] as number };
    }
  }

  const totalCalls = t[0] as number;
  return {
    total_calls: totalCalls,
    total_input_tokens: t[1] as number,
    total_output_tokens: t[2] as number,
    avg_latency_ms: Math.round(t[3] as number),
    by_model,
    cache_hit_rate: totalCalls > 0 ? Math.round(((t[4] as number) / totalCalls) * 100) : 0,
  };
}
