// IoT board simulator: POSTs fake telemetry to the API every 2 s.
// Usage: npm run simulate -- after|class     (API_URL env overrides the default)
import { INITIAL_ROOMS } from '../src/data/rooms';

const API = process.env.API_URL ?? 'http://localhost:8787';
const scenario = process.argv[2] === 'class' ? 'class' : 'after';
const cfg = scenario === 'class' ? { motion: 0.9, amps: [1.5, 6] } : { motion: 0.15, amps: [6, 16] };
const rnd = (a: number, b: number) => Math.round((a + Math.random() * (b - a)) * 10) / 10;

async function tick() {
  const r = INITIAL_ROOMS[Math.floor(Math.random() * INITIAL_ROOMS.length)];
  const body = {
    building: r.building,
    roomNumber: r.roomNumber,
    current: rnd(cfg.amps[0], cfg.amps[1]),
    voltage: 220,
    motion: Math.random() < cfg.motion,
  };
  try {
    const res = await fetch(`${API}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { status?: string; errors?: string[] };
    console.log(`${res.status} ${body.building} ${body.roomNumber} ${body.current}A motion=${body.motion} -> ${data.status ?? data.errors}`);
  } catch (e) {
    console.log(`API unreachable (${(e as Error).message}), retrying...`); // keep running: fault tolerant
  }
}

console.log(`Simulator "${scenario}" -> ${API}  (Ctrl+C to stop)`);
void tick();
setInterval(() => void tick(), 2000);
