// L1 + L2 run here by importing the frontend's pure engine. The threshold and the
// z-score have exactly one definition in this repository; the server does not restate them.
import { analyze, monthlyWaste, powerKw } from '../src/engine/energy';
import { config } from './config';
import { roomId as slugFor } from './validate';
import type { Store } from './store';
import type { TelemetryResponse } from './contract';
import type { Room, SimulationPayload } from '../src/types';

/**
 * Analyses one telemetry reading, persists the room state and the reading, and
 * returns the contract's POST /api/telemetry response.
 */
export function ingest(store: Store, payload: SimulationPayload): TelemetryResponse {
  const id = slugFor(payload.building, payload.roomNumber);
  const history = store.recentCurrents(id, config.historyWindow);
  const analysis = analyze(payload.current, payload.motion, history);
  const now = Date.now();

  const room: Room = {
    id,
    building: payload.building,
    roomNumber: payload.roomNumber,
    current: payload.current,
    motion: payload.motion,
    status: analysis.status,
    zone: store.getRoom(id)?.zone ?? 'Simulated',
    lastUpdated: now,
  };

  store.upsertRoom(room);
  store.insertReading({
    roomId: id,
    building: payload.building,
    roomNumber: payload.roomNumber,
    current: payload.current,
    voltage: payload.voltage,
    // The contract reports power in kW.
    power: Math.round(powerKw(payload.current, payload.voltage) * 1000) / 1000,
    motion: payload.motion,
    status: analysis.status,
    ts: now,
  });

  if (analysis.status === 'Energy Waste') {
    store.recordEvent('warn', `Energy Waste: ${analysis.reasons.join(' · ')}`, id);
  }

  return {
    room,
    status: analysis.status,
    anomaly: analysis.anomaly,
    reasons: analysis.reasons,
    monthly: monthlyWaste(payload.current, payload.voltage),
  };
}
