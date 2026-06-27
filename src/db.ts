import { Database } from "bun:sqlite";
import { mkdirSync, chmodSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const DB_DIR = join(homedir(), ".alicewiki");
const DB_PATH = join(DB_DIR, "alicewiki.db");

let db: Database | null = null;
let currentSessionId: number | null = null;

export function initDB(): void {
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true, mode: 0o700 });
  }

  try {
    chmodSync(DB_DIR, 0o700);
  } catch {}

  db = new Database(DB_PATH);
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON"); // enforce FK constraints + ON DELETE CASCADE (deleting parent also deletes child)

  try {
    chmodSync(DB_PATH, 0o600);
    for (const ext of ["-wal", "-shm"]) {
      const sidecar = DB_PATH + ext;
      if (existsSync(sidecar)) {
        chmodSync(sidecar, 0o600);
      }
    }
  } catch (err) {
    console.warn("Failed to set DB file permissions:", (err as Error).message);
  }

  createTables();
  currentSessionId = createSession();
}

function createTables(): void {
  if (!db) throw new Error("DB not initialized");

  db.run(`
    CREATE TABLE IF NOT EXISTS credentials (
      provider TEXT PRIMARY KEY,
      api_key TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'openai',
      model TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      turn_index INTEGER NOT NULL,
      query TEXT NOT NULL DEFAULT '',
      summary TEXT,
      quotes TEXT,
      sources TEXT,
      raw TEXT,
      error TEXT,
      help INTEGER NOT NULL DEFAULT 0,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function createSession(): number {
  if (!db) throw new Error("DB not initialized");
  const provider = process.env.DEFAULT_PROVIDER || "openai";
  const result = db.run(
    "INSERT INTO sessions (name, provider, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))",
    ["default", provider]
  );
  return Number(result.lastInsertRowid);
}

export function getCurrentSessionId(): number | null {
  return currentSessionId;
}

export function getCredential(provider: string): string | null {
  if (!db) return null;
  const row = db.query("SELECT api_key FROM credentials WHERE provider = ?").get(provider) as { api_key: string } | null;
  return row?.api_key ?? null;
}

export function setCredential(provider: string, apiKey: string): void {
  if (!db) return;
  db.run(
    `INSERT INTO credentials (provider, api_key, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(provider) DO UPDATE SET api_key = excluded.api_key, updated_at = datetime('now')`,
    [provider, apiKey]
  );
}

export function saveTurn(
  sessionId: number,
  data: {
    query: string;
    turnIndex: number;
    summary?: string | null;
    quotes?: string | null;
    sources?: string | null;
    raw?: string | null;
    error?: string | null;
    help?: boolean;
    inputTokens?: number;
    outputTokens?: number;
  }
): void {
  if (!db) return;
  db.run(
    `INSERT INTO turns (session_id, turn_index, query, summary, quotes, sources, raw, error, help, input_tokens, output_tokens, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [sessionId, data.turnIndex, data.query, data.summary ?? null, data.quotes ?? null, data.sources ?? null, data.raw ?? null, data.error ?? null, data.help ? 1 : 0, data.inputTokens ?? 0, data.outputTokens ?? 0]
  );
}

export function updateSessionProvider(provider: string, model: string): void {
  if (!db || currentSessionId === null) return;
  db.run(
    "UPDATE sessions SET provider = ?, model = ?, updated_at = datetime('now') WHERE id = ?",
    [provider, model, currentSessionId]
  );
}

export function closeDB(): void {
  if (db) {
    db.close();
    db = null;
  }
}
