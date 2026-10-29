// Mock backend that follows API_CONTRACT.md. Zero framework, in-memory state.
// Uses the same decision engine as the frontend so behaviour stays consistent.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { analyze, monthlyWaste, powerKw } from '../src/engine/energy';
import { INITIAL_ROOMS } from '../src/data/rooms';
import { validate } from './validate';
import type { EnergyReading, Room } from '../src/types';

// The contract's field rules moved to ./validate so the mock and the real server
// cannot drift apart. Re-exported here because api.test.ts imports it from this module.
export { validate };

const MAX_BODY = 10_000;
const MAX_READINGS = 500;

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
