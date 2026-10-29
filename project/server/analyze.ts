// L1 + L2 run here by importing the frontend's pure engine. The threshold and the
// z-score have exactly one definition in this repository; the server does not restate them.
// L3 adds the per-hour baseline, which is server-side only because it needs stored history.
import { analyze, monthlyWaste, powerKw } from '../src/engine/energy';
import { config } from './config';
import { roomId as slugFor } from './validate';
import { detect, hourOfWeek, update } from './baseline';
import type { Store } from './store';
import type { TelemetryResponse } from './contract';
import type { Room, SimulationPayload } from '../src/types';

/** Reason codes are rendered to the Thai text the contract puts in `reasons[]`. */
const REASON_TEXT = {
  STAT_ABOVE_HOUR_BASELINE: (score: number, mean: number) =>
    `สูงกว่าค่าปกติของห้องนี้ในช่วงเวลาเดียวกันของสัปดาห์ (ปกติ ${mean.toFixed(1)} A, z=${score.toFixed(1)})`,
} as const;

/**
 * Analyses one telemetry reading, persists the room state and the reading, and
 * returns the contract's POST /api/telemetry response.
 *
 * Detection is layered. L1 (fixed 7 A rule) and L2 (z-score against the room's
 * recent readings) come from the shared engine. L3 compares the reading against
 * what this room normally draws at this hour of the week; it is the only layer
 * that can catch waste *below* the 7 A threshold, which L1 cannot see by design.
 * A reading flagged by L3 is reported as Energy Waste, same as L1, because to an
 * operator it is the same situation: load with nobody in the room.
 */
export function ingest(store: Store, payload: SimulationPayload): TelemetryResponse {
  const id = slugFor(payload.building, payload.roomNumber);
  const history = store.recentCurrents(id, config.historyWindow);
  const base = analyze(payload.current, payload.motion, history);
  const now = Date.now();

  // --- L3 -----------------------------------------------------------------
  const bucket = hourOfWeek(now);
  const stats = store.getBaseline(id, bucket);
  const verdict = detect(stats, payload.current, payload.motion, config.baseline);

  const reasons = [...base.reasons];
  let status = base.status;
  let anomaly = base.anomaly;

  if (verdict.flagged && verdict.code && verdict.score !== null) {
    reasons.push(REASON_TEXT[verdict.code](verdict.score, verdict.stats.mean));
    anomaly = true;
    status = 'Energy Waste';
  }

  const room: Room = {
    id,
    building: payload.building,
    roomNumber: payload.roomNumber,
    current: payload.current,
    motion: payload.motion,
    status,
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
    status,
    ts: now,
  });

  // Only normal readings shape "normal". Folding waste back into the baseline
  // would teach the detector that waste is expected for that hour.
  if (status === 'Normal') {
    store.putBaseline(id, bucket, update(stats, payload.current, config.baseline.alpha));
  }

  if (status === 'Energy Waste') {
    store.recordEvent('warn', `Energy Waste: ${reasons.join(' · ')}`, id);
  }

  return {
    room,
    status,
    anomaly,
    reasons,
    monthly: monthlyWaste(payload.current, payload.voltage),
  };
}
