import { supabase, isSupabaseConfigured } from './supabase';
import { INITIAL_ROOMS, evaluateStatus } from '../data/rooms';
import type { Room, LogEntry, SimulationPayload, EnergyReading } from '../types';

interface RoomRow {
  id: string;
  building: string;
  room_number: string;
  current: number;
  motion: boolean;
  status: string;
  zone: string;
  last_updated: string;
}

interface LogRow {
  id: string;
  ts: string;
  level: string;
  tag: string;
  message: string;
}

interface ReadingRow {
  id: string;
  room_id: string;
  building: string;
  room_number: string;
  current: number;
  power: number;
  status: string;
  ts: string;
}

function rowToRoom(r: RoomRow): Room {
  return {
    id: r.id,
    building: r.building,
    roomNumber: r.room_number,
    current: Number(r.current),
    motion: r.motion,
    status: r.status as Room['status'],
    zone: r.zone,
    lastUpdated: new Date(r.last_updated).getTime(),
  };
}

export async function fetchRooms(): Promise<Room[]> {
  if (!isSupabaseConfigured) return INITIAL_ROOMS;
  const { data, error } = await supabase
    .from('rooms')
    .select('id, building, room_number, current, motion, status, zone, last_updated')
    .order('last_updated', { ascending: false });
  if (error) throw error;
  if (!data || data.length === 0) return INITIAL_ROOMS;
  return (data as RoomRow[]).map(rowToRoom);
}

export async function upsertRoom(payload: SimulationPayload): Promise<Room> {
  const id = `${payload.building}-${payload.roomNumber}`.toLowerCase().replace(/\s+/g, '-');
  const status = evaluateStatus(payload.current, payload.motion);
  const power = (payload.current * payload.voltage) / 1000;

  if (!isSupabaseConfigured) {
    return {
      id,
      building: payload.building,
      roomNumber: payload.roomNumber,
      current: payload.current,
      motion: payload.motion,
      status,
      lastUpdated: Date.now(),
      zone: 'Simulated',
    };
  }

  const row = {
    id,
    building: payload.building,
    room_number: payload.roomNumber,
    current: payload.current,
    motion: payload.motion,
    status,
    zone: 'Simulated',
    last_updated: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('rooms')
    .upsert(row, { onConflict: 'id' })
    .select('id, building, room_number, current, motion, status, zone, last_updated')
    .maybeSingle();

  if (error) throw error;

  // Also record a historical energy reading for the chart
  await supabase.from('energy_readings').insert({
    room_id: id,
    building: payload.building,
    room_number: payload.roomNumber,
    current: payload.current,
    power: Math.round(power * 1000) / 1000,
    status,
    ts: new Date().toISOString(),
  });

  return rowToRoom(data as RoomRow);
}

export async function deleteRoom(roomId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('rooms').delete().eq('id', roomId);
  if (error) throw error;
}

export async function insertLog(entry: {
  level: LogEntry['level'];
  tag: string;
  message: string;
}): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('logs').insert({
    level: entry.level,
    tag: entry.tag,
    message: entry.message,
    ts: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function fetchLogs(limit = 80): Promise<LogEntry[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('logs')
    .select('id, ts, level, tag, message')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!data) return [];
  const rows = data as LogRow[];
  return rows
    .map((r) => ({
      id: r.id,
      timestamp:
        new Date(r.ts).toLocaleTimeString('en-GB', { hour12: false }) +
        '.' +
        String(new Date(r.ts).getMilliseconds()).padStart(3, '0'),
      level: r.level as LogEntry['level'],
      tag: r.tag,
      message: r.message,
    }))
    .reverse();
}

export async function clearLogs(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('logs').delete().gte('created_at', '1970-01-01T00:00:00Z');
  if (error) throw error;
  await insertLog({ level: 'info', tag: '[SYS]', message: 'Console cleared by operator' });
}

export async function fetchEnergyReadings(limit = 30): Promise<EnergyReading[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('energy_readings')
    .select('id, room_id, building, room_number, current, power, status, ts')
    .order('ts', { ascending: true })
    .limit(limit);
  if (error) throw error;
  if (!data) return [];
  return (data as ReadingRow[]).map((r) => ({
    id: r.id,
    roomId: r.room_id,
    building: r.building,
    roomNumber: r.room_number,
    current: Number(r.current),
    power: Number(r.power),
    status: r.status,
    timestamp: new Date(r.ts).getTime(),
  }));
}

// Realtime subscription helpers
export function subscribeToRooms(callback: (payload: { eventType: string; newData: Room | null; oldData: Room | null }) => void) {
  if (!isSupabaseConfigured) return null;
  return supabase
    .channel('rooms-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, (payload) => {
      const newData = payload.new ? rowToRoom(payload.new as RoomRow) : null;
      const oldData = payload.old ? rowToRoom(payload.old as RoomRow) : null;
      callback({ eventType: payload.eventType, newData, oldData });
    })
    .subscribe();
}

export function subscribeToLogs(callback: (entry: LogEntry) => void) {
  if (!isSupabaseConfigured) return null;
  return supabase
    .channel('logs-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs' }, (payload) => {
      const r = payload.new as LogRow;
      callback({
        id: r.id,
        timestamp:
          new Date(r.ts).toLocaleTimeString('en-GB', { hour12: false }) +
          '.' +
          String(new Date(r.ts).getMilliseconds()).padStart(3, '0'),
        level: r.level as LogEntry['level'],
        tag: r.tag,
        message: r.message,
      });
    })
    .subscribe();
}

export function unsubscribeChannel(channel: { unsubscribe: () => void } | null) {
  if (channel) channel.unsubscribe();
}
