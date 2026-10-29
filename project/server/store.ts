// The only module where SQL appears. Prepared statements only — never a built string.
// Driver exceptions are translated to StorageError here and never escape.
import type { DatabaseSync } from 'node:sqlite';
import { StorageError } from './errors';
import { EMPTY_BASELINE, type BaselineStats } from './baseline';
import type { EnergyReading, Room, RoomStatus } from '../src/types';

type RoomRow = {
  id: string;
  building: string;
  room_number: string;
  current: number;
  motion: number;
  status: string;
  zone: string;
  updated_at: number;
};

type ReadingRow = {
  id: number;
  room_id: string;
  building: string;
  room_number: string;
  current: number;
  power: number;
  status: string;
  ts: number;
};

const toRoom = (r: RoomRow): Room => ({
  id: r.id,
  building: r.building,
  roomNumber: r.room_number,
  current: Number(r.current),
  motion: r.motion === 1,
  status: r.status as RoomStatus,
  zone: r.zone,
  lastUpdated: Number(r.updated_at),
});

const toReading = (r: ReadingRow): EnergyReading => ({
  id: String(r.id),
  roomId: r.room_id,
  building: r.building,
  roomNumber: r.room_number,
  current: Number(r.current),
  power: Number(r.power),
  status: r.status,
  timestamp: Number(r.ts),
});

export type NewReading = {
  roomId: string;
  building: string;
  roomNumber: string;
  current: number;
  voltage: number;
  power: number;
  motion: boolean;
  status: RoomStatus;
  ts: number;
};

export type Store = ReturnType<typeof createStore>;

export function createStore(db: DatabaseSync) {
  // Prepared once, reused for the life of the process.
  const q = {
    upsertRoom: db.prepare(`
      INSERT INTO rooms (id, building, room_number, current, motion, status, zone, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        building = excluded.building,
        room_number = excluded.room_number,
        current = excluded.current,
        motion = excluded.motion,
        status = excluded.status,
        updated_at = excluded.updated_at`),
    getRoom: db.prepare('SELECT * FROM rooms WHERE id = ?'),
    listRooms: db.prepare('SELECT * FROM rooms ORDER BY updated_at DESC'),
    countRooms: db.prepare('SELECT COUNT(*) AS n FROM rooms'),
    insertReading: db.prepare(`
      INSERT INTO readings (room_id, building, room_number, current, voltage, power, motion, status, ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    // Newest first so LIMIT takes the most recent; callers reverse to oldest-first per the contract.
    recentByRoom: db.prepare('SELECT * FROM readings WHERE room_id = ? ORDER BY ts DESC, id DESC LIMIT ?'),
    recentAll: db.prepare('SELECT * FROM readings ORDER BY ts DESC, id DESC LIMIT ?'),
    insertEvent: db.prepare('INSERT INTO events (room_id, level, message, ts) VALUES (?, ?, ?, ?)'),
    getBaseline: db.prepare('SELECT n, mean, variance FROM baselines WHERE room_id = ? AND hour_of_week = ?'),
    putBaseline: db.prepare(`
      INSERT INTO baselines (room_id, hour_of_week, n, mean, variance, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(room_id, hour_of_week) DO UPDATE SET
        n = excluded.n,
        mean = excluded.mean,
        variance = excluded.variance,
        updated_at = excluded.updated_at`),
  };

  const guard = <T>(what: string, fn: () => T): T => {
    try {
      return fn();
    } catch (cause) {
      throw new StorageError(`database operation failed: ${what}`, { cause });
    }
  };

  return {
    upsertRoom(room: Room): void {
      guard('upsertRoom', () =>
        q.upsertRoom.run(
          room.id,
          room.building,
          room.roomNumber,
          room.current,
          room.motion ? 1 : 0,
          room.status,
          room.zone,
          room.lastUpdated,
        ),
      );
    },

    getRoom(id: string): Room | null {
      const row = guard('getRoom', () => q.getRoom.get(id)) as RoomRow | undefined;
      return row ? toRoom(row) : null;
    },

    listRooms(): Room[] {
      const rows = guard('listRooms', () => q.listRooms.all()) as RoomRow[];
      return rows.map(toRoom);
    },

    isEmpty(): boolean {
      const row = guard('countRooms', () => q.countRooms.get()) as { n: number } | undefined;
      return Number(row?.n ?? 0) === 0;
    },

    insertReading(r: NewReading): void {
      guard('insertReading', () =>
        q.insertReading.run(
          r.roomId,
          r.building,
          r.roomNumber,
          r.current,
          r.voltage,
          r.power,
          r.motion ? 1 : 0,
          r.status,
          r.ts,
        ),
      );
    },

    /** The room's most recent current values, oldest first, for the z-score. */
    recentCurrents(roomId: string, limit: number): number[] {
      const rows = guard('recentCurrents', () => q.recentByRoom.all(roomId, limit)) as ReadingRow[];
      return rows.map((r) => Number(r.current)).reverse();
    },

    /** Oldest first, as API_CONTRACT.md requires. */
    listReadings(limit: number, roomId?: string): EnergyReading[] {
      const rows = guard('listReadings', () =>
        roomId ? q.recentByRoom.all(roomId, limit) : q.recentAll.all(limit),
      ) as ReadingRow[];
      return rows.map(toReading).reverse();
    },

    /** L3 state for one room at one hour-of-week. EMPTY_BASELINE when it has never been seen. */
    getBaseline(roomId: string, hourOfWeek: number): BaselineStats {
      const row = guard('getBaseline', () => q.getBaseline.get(roomId, hourOfWeek)) as
        | { n: number; mean: number; variance: number }
        | undefined;
      return row
        ? { n: Number(row.n), mean: Number(row.mean), variance: Number(row.variance) }
        : EMPTY_BASELINE;
    },

    putBaseline(roomId: string, hourOfWeek: number, stats: BaselineStats): void {
      guard('putBaseline', () =>
        q.putBaseline.run(roomId, hourOfWeek, stats.n, stats.mean, stats.variance, Date.now()),
      );
    },

    /** No silent failure: anything rejected, skipped or broken is recorded here. */
    recordEvent(level: 'info' | 'warn' | 'error', message: string, roomId: string | null = null): void {
      guard('insertEvent', () => q.insertEvent.run(roomId, level, message, Date.now()));
    },
  };
}
