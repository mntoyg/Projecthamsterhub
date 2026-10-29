// Response shapes from API_CONTRACT.md, typed once so the server and the tests
// agree at compile time instead of at review time.
import type { EnergyReading, Room } from '../src/types';

export type TelemetryResponse = {
  room: Room;
  status: Room['status'];
  anomaly: boolean;
  reasons: string[];
  monthly: { kwh: number; baht: number; co2: number };
};

export type RoomsResponse = { readonly rooms: Room[] };

export type ReadingsResponse = { readonly readings: EnergyReading[] };

export type ErrorResponse = { readonly errors: string[]; readonly correlationId?: string };
