import * as SQLite from 'expo-sqlite';

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, ext TEXT NOT NULL, kind TEXT NOT NULL, path TEXT NOT NULL,
  mime TEXT NOT NULL, size INTEGER NOT NULL, modified_at INTEGER NOT NULL, imported_at INTEGER NOT NULL,
  folder_id TEXT, favorite INTEGER NOT NULL DEFAULT 0, last_opened_at INTEGER
);
CREATE TABLE IF NOT EXISTS history (
  id TEXT PRIMARY KEY NOT NULL, file_id TEXT NOT NULL, file_name TEXT NOT NULL, file_kind TEXT NOT NULL,
  presented_at INTEGER NOT NULL, last_slide INTEGER NOT NULL DEFAULT 1, total_slides INTEGER NOT NULL DEFAULT 1,
  duration_sec INTEGER NOT NULL DEFAULT 0, favorite INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS conversions (
  file_id TEXT PRIMARY KEY NOT NULL, pdf_path TEXT NOT NULL, notes_json TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_files_kind ON files(kind);
CREATE INDEX IF NOT EXISTS idx_history_presented ON history(presented_at DESC);
`;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('smartbeam.db').then(async (db) => {
      await db.execAsync(SCHEMA);
      return db;
    });
  }
  return dbPromise;
}

export async function resetDatabaseHandle(): Promise<void> {
  if (dbPromise) { try { (await dbPromise).closeAsync(); } catch { /* ignore */ } }
  dbPromise = null;
}
