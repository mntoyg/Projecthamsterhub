// The contract's field rules, in one place. API_CONTRACT.md "POST /api/telemetry".
// mock-api.ts re-exports this so the two sides can never drift apart.
import type { SimulationPayload } from '../src/types';

const ROOM_RE = /^[\p{L}\p{N} _-]{1,12}$/u;

export const DEFAULT_VOLTAGE = 220;
export const MAX_BUILDING_CHARS = 40;
export const MAX_CURRENT_A = 100;
export const MAX_VOLTAGE_V = 500;

export type Validation = { ok: true; value: SimulationPayload } | { ok: false; errors: string[] };

export function validate(body: unknown): Validation {
  const errors: string[] = [];
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const building = typeof b.building === 'string' ? b.building.trim() : '';
  const roomNumber = typeof b.roomNumber === 'string' ? b.roomNumber.trim() : '';
  const voltage = b.voltage === undefined ? DEFAULT_VOLTAGE : b.voltage;

  if (!building || building.length > MAX_BUILDING_CHARS)
    errors.push(`building is required (max ${MAX_BUILDING_CHARS} chars)`);
  if (!ROOM_RE.test(roomNumber))
    errors.push('roomNumber must be 1-12 chars: letters, digits, space, - or _');
  if (typeof b.current !== 'number' || !Number.isFinite(b.current) || b.current < 0 || b.current > MAX_CURRENT_A)
    errors.push(`current must be a number between 0 and ${MAX_CURRENT_A} (A)`);
  if (typeof voltage !== 'number' || !Number.isFinite(voltage) || voltage < 0 || voltage > MAX_VOLTAGE_V)
    errors.push(`voltage must be a number between 0 and ${MAX_VOLTAGE_V} (V)`);
  if (typeof b.motion !== 'boolean') errors.push('motion must be a boolean');

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      building,
      roomNumber,
      current: b.current as number,
      voltage: voltage as number,
      motion: b.motion as boolean,
    },
  };
}

/** The contract's room id: slug of building and room number, built server-side, never taken from the body. */
export function roomId(building: string, roomNumber: string): string {
  return `${building}-${roomNumber}`.toLowerCase().replace(/\s+/g, '-');
}
