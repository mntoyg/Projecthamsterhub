// Mock backend that follows API_CONTRACT.md. Zero framework, in-memory state.
// Uses the same decision engine as the frontend so behaviour stays consistent.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { analyze, monthlyWaste, powerKw } from '../src/engine/energy';
import { INITIAL_ROOMS } from '../src/data/rooms';
import type { EnergyReading, Room, SimulationPayload } from '../src/types';

const MAX_BODY = 10_000;
const MAX_READINGS = 500;
const ROOM_RE = /^[\p{L}\p{N} _-]{1,12}$/u;

type Validation = { ok: true; value: SimulationPayload } | { ok: false; errors: string[] };

export function validate(body: unknown): Validation {
  const errors: string[] = [];
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const building = typeof b.building === 'string' ? b.building.trim() : '';
  const roomNumber = typeof b.roomNumber === 'string' ? b.roomNumber.trim() : '';
  const voltage = b.voltage === undefined ? 220 : b.voltage;
  if (!building || building.length > 40) errors.push('building is required (max 40 chars)');
  if (!ROOM_RE.test(roomNumber)) errors.push('roomNumber must be 1-12 chars: letters, digits, space, - or _');
  if (typeof b.current !== 'number' || !Number.isFinite(b.current) || b.current < 0 || b.current > 100)
    errors.push('current must be a number between 0 and 100 (A)');
  if (typeof voltage !== 'number' || !Number.isFinite(voltage) || voltage < 0 || voltage > 500)
    errors.push('voltage must be a number between 0 and 500 (V)');
  if (typeof b.motion !== 'boolean') errors.push('motion must be a boolean');
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: { building, roomNumber, current: b.current as number, voltage: voltage as number, motion: b.motion as boolean },
  };
}

export function createMockApi(): { server: Server } {
  const rooms = new Map<string, Room>(INITIAL_ROOMS.map((r) => [r.id, r]));
  const readings: EnergyReading[] = [];

  const send = (res: ServerResponse, code: number, data: unknown) => {
    res.writeHead(code, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(JSON.stringify(data));
  };

  const readBody = (req: IncomingMessage): Promise<string> =>
    new Promise((resolve, reject) => {
      let raw = '';
      req.on('data', (chunk: Buffer) => {
        raw += chunk;
        if (raw.length > MAX_BODY) {
          reject(new Error('payload too large'));
          req.destroy();
        }
      });
      req.on('end', () => resolve(raw));
      req.on('error', reject);
    });

  const telemetry = async (req: IncomingMessage, res: ServerResponse) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readBody(req));
    } catch {
      return send(res, 400, { errors: ['body must be valid JSON (max 10 KB)'] });
    }
    const v = validate(parsed);
    if (!v.ok) return send(res, 400, { errors: v.errors });
    const p = v.value;
    const id = `${p.building}-${p.roomNumber}`.toLowerCase().replace(/\s+/g, '-');
    const history = readings.filter((r) => r.roomId === id).slice(-20).map((r) => r.current);
    const analysis = analyze(p.current, p.motion, history);
    const room: Room = {
      id,
      building: p.building,
      roomNumber: p.roomNumber,
      current: p.current,
      motion: p.motion,
      status: analysis.status,
      zone: rooms.get(id)?.zone ?? 'Simulated',
      lastUpdated: Date.now(),
    };
    rooms.set(id, room);
    readings.push({
      id: randomUUID(),
      roomId: id,
      building: p.building,
      roomNumber: p.roomNumber,
      current: p.current,
      power: Math.round(powerKw(p.current, p.voltage) * 1000) / 1000,
      status: analysis.status,
      timestamp: Date.now(),
    });
    if (readings.length > MAX_READINGS) readings.splice(0, readings.length - MAX_READINGS);
    send(res, 200, {
      room,
      status: analysis.status,
      anomaly: analysis.anomaly,
      reasons: analysis.reasons,
      monthly: monthlyWaste(p.current, p.voltage),
    });
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const route = `${req.method} ${url.pathname}`;
    try {
      if (req.method === 'OPTIONS') return send(res, 204, {});
      if (route === 'GET /api/health') return send(res, 200, { ok: true });
      if (route === 'GET /api/rooms') return send(res, 200, { rooms: [...rooms.values()] });
      if (route === 'GET /api/readings') {
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 30, 1), MAX_READINGS);
        const roomId = url.searchParams.get('roomId');
        const list = roomId ? readings.filter((r) => r.roomId === roomId) : readings;
        return send(res, 200, { readings: list.slice(-limit) });
      }
      if (route === 'POST /api/telemetry') {
        void telemetry(req, res).catch(() => send(res, 500, { errors: ['internal error'] }));
        return;
      }
      send(res, 404, { errors: ['not found'] });
    } catch {
      send(res, 500, { errors: ['internal error'] });
    }
  });
  return { server };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const port = Number(process.env.PORT) || 8787;
  createMockApi().server.listen(port, () => console.log(`Mock API listening on http://localhost:${port}`));
}
