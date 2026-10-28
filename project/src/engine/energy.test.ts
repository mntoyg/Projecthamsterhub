import { describe, expect, it } from 'vitest';
import { analyze, monthlyWaste, powerKw, zScore, WASTE_THRESHOLD_A } from './energy';

describe('analyze', () => {
  it('flags high current with no motion', () => {
    expect(analyze(20, false).status).toBe('Energy Waste');
  });
  it('is normal when occupied, even at high current', () => {
    expect(analyze(20, true).status).toBe('Normal');
  });
  it('treats the threshold as inclusive', () => {
    expect(analyze(WASTE_THRESHOLD_A, false).status).toBe('Energy Waste');
    expect(analyze(WASTE_THRESHOLD_A - 0.1, false).status).toBe('Normal');
  });
  it('handles 0 A', () => {
    expect(analyze(0, false).status).toBe('Normal');
  });
  it('detects statistical anomaly against room history', () => {
    expect(analyze(6, false, [2, 2.1, 1.9, 2.05, 2, 1.95]).anomaly).toBe(true);
  });
});

describe('energy maths', () => {
  it('computes kW', () => expect(powerKw(10, 220)).toBeCloseTo(2.2));
  it('computes monthly waste', () => {
    const w = monthlyWaste(10, 220);
    expect(w.kwh).toBeCloseTo(2.2 * 308);
    expect(w.baht).toBeGreaterThan(0);
  });
  it('needs enough history for z-score', () => expect(zScore(5, [1, 2])).toBeNull());
});
