import { Database } from "bun:sqlite";
import { mkdirSync, chmodSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const DB_DIR = join(homedir(), ".alicewiki");
const DB_PATH = join(DB_DIR, "alicewiki.db");

let db: Database | null = null;
let currentSessionId: number | null = null;

export function initDB(dbPath?: string): void {
  const dbFile = dbPath ?? DB_PATH;

  if (!dbPath) {
    if (!existsSync(DB_DIR)) {
      mkdirSync(DB_DIR, { recursive: true, mode: 0o700 });
    }
    try {
      chmodSync(DB_DIR, 0o700);
    } catch {}
  }

  db = new Database(dbFile);
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");

  if (!dbPath) {
    try {
      chmodSync(dbFile, 0o600);
      for (const ext of ["-wal", "-shm"]) {
        const sidecar = dbFile + ext;
        if (existsSync(sidecar)) {
          chmodSync(sidecar, 0o600);
        }
      }
    } catch (err) {
      console.warn("Failed to set DB file permissions:", (err as Error).message);
    }
  }

  createTables();
  const existing = db.query("SELECT COUNT(*) as count FROM sessions").get() as { count: number };
  if (existing.count === 0) {
    currentSessionId = createSession("default");
  } else {
    const last = db.query("SELECT id FROM sessions ORDER BY id DESC LIMIT 1").get() as { id: number } | null;
    currentSessionId = last?.id ?? null;
  }
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

export interface SessionInfo {
  id: number;
  name: string;
  provider: string;
  model: string | null;
  turnCount: number;
  createdAt: string;
}

export function createSession(name: string = "default"): number {
  if (!db) throw new Error("DB not initialized");
  const lastSession = getSessionProvider();
  const provider = lastSession?.provider ?? "openai";
  const model = lastSession?.model ?? null;
  const result = db.run(
    "INSERT INTO sessions (name, provider, model, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
    [name, provider, model]
  );
  return Number(result.lastInsertRowid);
}

export function listSessions(): SessionInfo[] {
  if (!db) return [];
  return db.query(`
    SELECT s.id, s.name, s.provider, s.model, COUNT(t.id) as turnCount, s.created_at as createdAt
    FROM sessions s LEFT JOIN turns t ON t.session_id = s.id
    GROUP BY s.id ORDER BY s.created_at DESC
  `).all() as SessionInfo[];
}

export function switchSession(id: number): { provider: string; model: string | null; name: string } | null {
  if (!db) return null;
  const session = db.query("SELECT provider, model, name FROM sessions WHERE id = ?").get(id) as any;
  if (!session) return null;
  currentSessionId = id;
  db.run("UPDATE sessions SET updated_at = datetime('now') WHERE id = ?", [id]);
  return session;
}

export function renameSession(id: number, name: string): void {
  if (!db) return;
  db.run("UPDATE sessions SET name = ?, updated_at = datetime('now') WHERE id = ?", [name, id]);
}

export function deleteSession(id: number): void {
  if (!db) return;
  db.run("DELETE FROM sessions WHERE id = ?", [id]);
  if (currentSessionId === id) {
    currentSessionId = null;
  }
}

export interface SessionTurn {
  id: number;
  query: string;
  summary: string | null;
  quotes: string | null;
  sources: string | null;
  raw: string | null;
  error: string | null;
  help: number;
}

export function getSessionTurns(sessionId: number): SessionTurn[] {
  if (!db) return [];
  return db.query(
    "SELECT id, query, summary, quotes, sources, raw, error, help FROM turns WHERE session_id = ? ORDER BY turn_index ASC"
  ).all(sessionId) as SessionTurn[];
}

export function getCurrentSessionId(): number | null {
  return currentSessionId;
}

export function getSessionProvider(): { provider: string; model: string | null } | null {
  if (!db) return null;
  const row = db.query(
    "SELECT provider, model FROM sessions ORDER BY id DESC LIMIT 1"
  ).get() as { provider: string; model: string | null } | null;
  return row ?? null;
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
