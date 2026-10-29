// Schema and connection. node:sqlite ships with Node, so there is no native build
// step and nothing for a package install script to compile.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { StorageError } from './errors';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS rooms (
  id          TEXT PRIMARY KEY,
  building    TEXT    NOT NULL,
  room_number TEXT    NOT NULL,
  current     REAL    NOT NULL DEFAULT 0,
  motion      INTEGER NOT NULL DEFAULT 0,
  status      TEXT    NOT NULL DEFAULT 'Normal',
  zone        TEXT    NOT NULL DEFAULT 'Simulated',
  updated_at  INTEGER NOT NULL
);

-- Append only. store.ts exposes no update or delete for this table.
CREATE TABLE IF NOT EXISTS readings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id     TEXT    NOT NULL REFERENCES rooms(id),
  building    TEXT    NOT NULL,
  room_number TEXT    NOT NULL,
  current     REAL    NOT NULL,
  voltage     REAL    NOT NULL,
  power       REAL    NOT NULL,
  motion      INTEGER NOT NULL,
  status      TEXT    NOT NULL,
  ts          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS readings_room_ts_idx ON readings (room_id, ts DESC);
CREATE INDEX IF NOT EXISTS readings_ts_idx      ON readings (ts DESC);

-- L3: one rolling baseline per room per hour-of-week (0..167, Monday 00:00 = 0).
-- Derived state, rebuildable from readings; losing it costs accuracy, not data.
CREATE TABLE IF NOT EXISTS baselines (
  room_id      TEXT    NOT NULL REFERENCES rooms(id),
  hour_of_week INTEGER NOT NULL,
  n            INTEGER NOT NULL,
  mean         REAL    NOT NULL,
  variance     REAL    NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (room_id, hour_of_week)
);

-- Nothing is dropped silently: every rejection and every internal failure lands here.
CREATE TABLE IF NOT EXISTS events (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT,
  level   TEXT    NOT NULL,
  message TEXT    NOT NULL,
  ts      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_ts_idx ON events (ts DESC);
`;

/**
 * Opens the database and creates the schema if needed.
 * `file` is resolved once here; nothing downstream depends on the process working directory.
 */
export function openDb(file: string): DatabaseSync {
  try {
    const target = file === ':memory:' ? file : resolve(file);
    if (target !== ':memory:') mkdirSync(dirname(target), { recursive: true });
    const db = new DatabaseSync(target);
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(SCHEMA);
    return db;
  } catch (cause) {
    throw new StorageError(`could not open the database at ${file}`, { cause });
  }
}
