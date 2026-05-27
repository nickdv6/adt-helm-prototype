import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import path from 'path';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const dbPath = path.join(process.cwd(), 'data', 'helm.db');
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  return _db;
}

export function initSchema(): void {
  const db = getDb();
  const schemaPath = path.join(process.cwd(), 'src', 'db', 'schema.sql');
  const sql = readFileSync(schemaPath, 'utf-8');
  db.exec(sql);
}

export function resetDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
