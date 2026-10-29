// The metric function has to be right before any table it produces means anything.
import { describe, expect, it } from 'vitest';
import { score } from './evaluate';

describe('score', () => {
  it('counts a worked example correctly', () => {
    //              TP     FP     FN     TN
    const pred = [true, true, false, false];
    const truth = [true, false, true, false];
    const m = score(pred, truth);
    expect(m).toMatchObject({ tp: 1, fp: 1, fn: 1, tn: 1 });
    expect(m.precision).toBeCloseTo(0.5, 6);
    expect(m.recall).toBeCloseTo(0.5, 6);
    expect(m.f1).toBeCloseTo(0.5, 6);
  });

  it('is perfect when prediction matches truth', () => {
    const t = [true, false, true, true, false];
    const m = score([...t], t);
    expect(m.precision).toBe(1);
    expect(m.recall).toBe(1);
    expect(m.f1).toBe(1);
    expect(m.fp).toBe(0);
    expect(m.fn).toBe(0);
  });

  it('gives zero, not NaN, when nothing is predicted positive', () => {
    const m = score([false, false], [true, false]);
    expect(m.precision).toBe(0);
    expect(m.recall).toBe(0);
    expect(m.f1).toBe(0);
  });

  it('gives zero, not NaN, when truth has no positives', () => {
    const m = score([true, false], [false, false]);
    expect(m.recall).toBe(0);
    expect(m.f1).toBe(0);
  });

  it('computes F1 as the harmonic mean, not the average', () => {
    // precision 1.0, recall 0.5 -> F1 = 2(1 x 0.5)/1.5 = 0.666..., not 0.75
    const m = score([true, false, false, false], [true, true, false, false]);
    expect(m.precision).toBe(1);
    expect(m.recall).toBeCloseTo(0.5, 6);
    expect(m.f1).toBeCloseTo(2 / 3, 6);
  });

  it('refuses mismatched lengths instead of scoring nonsense', () => {
    expect(() => score([true], [true, false])).toThrow(/differ in length/);
  });
});
