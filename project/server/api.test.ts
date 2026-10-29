import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createMockApi, validate } from './mock-api';
import type { ErrorResponse, ReadingsResponse, RoomsResponse, TelemetryResponse } from './contract';

let base = '';
const api = createMockApi();
beforeAll(async () => {
  await new Promise<void>((r) => api.server.listen(0, r));
  base = `http://localhost:${(api.server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => api.server.close(() => r())));

const post = (body: unknown, raw = false) =>
  fetch(`${base}/api/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ? (body as string) : JSON.stringify(body),
  });
const good = { building: 'ECC', roomNumber: '402', current: 20, voltage: 220, motion: false };

describe('POST /api/telemetry', () => {
  it('flags energy waste with reasons', async () => {
    const res = await post(good);
    const data = (await res.json()) as TelemetryResponse;
    expect(res.status).toBe(200);
    expect(data.status).toBe('Energy Waste');
    expect(data.reasons.length).toBeGreaterThan(0);
    expect(data.monthly.baht).toBeGreaterThan(0);
  });
  it('reports normal when occupied', async () => {
    const data = (await (await post({ ...good, motion: true })).json()) as TelemetryResponse;
    expect(data.status).toBe('Normal');
  });
  it.each([
    [{ ...good, current: -1 }],
    [{ ...good, current: 'x' }],
    [{ ...good, voltage: 9999 }],
    [{ ...good, roomNumber: '' }],
    [{ ...good, motion: 'yes' }],
    [{}],
  ])('rejects invalid payload %#', async (bad) => {
    const res = await post(bad);
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorResponse).errors.length).toBeGreaterThan(0);
  });
  it('rejects malformed JSON without crashing', async () => {
    expect((await post('{oops', true)).status).toBe(400);
    expect((await fetch(`${base}/api/health`)).status).toBe(200);
  });
});

describe('read endpoints', () => {
  it('lists rooms and readings', async () => {
    await post(good);
    const rooms = (await (await fetch(`${base}/api/rooms`)).json()) as RoomsResponse;
    expect(rooms.rooms.some((r: { id: string }) => r.id === 'ecc-402')).toBe(true);
    const rd = (await (await fetch(`${base}/api/readings?limit=5&roomId=ecc-402`)).json()) as ReadingsResponse;
    expect(rd.readings.length).toBeGreaterThan(0);
  });
  it('returns 404 for unknown routes', async () => {
    expect((await fetch(`${base}/api/nope`)).status).toBe(404);
  });
});

describe('validate', () => {
  it('defaults voltage to 220', () => {
    const v = validate({ building: 'ECC', roomNumber: '1', current: 5, motion: true });
    expect(v.ok && v.value.voltage).toBe(220);
  });
});
