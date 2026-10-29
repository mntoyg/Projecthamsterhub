import { describe, expect, it } from 'vitest';
import { EMPTY_BASELINE, detect, hourOfWeek, update, type BaselineOptions } from './baseline';

const opts: BaselineOptions = { alpha: 0.3, k: 3, minSamples: 5, sdFloor: 0.05 };

const feed = (values: number[], alpha = opts.alpha) =>
  values.reduce((s, v) => update(s, v, alpha), EMPTY_BASELINE);

describe('hourOfWeek', () => {
  it('puts Monday 00:00 at bucket 0', () => {
    // 2026-10-26 is a Monday
    expect(hourOfWeek(new Date(2026, 9, 26, 0, 30).getTime())).toBe(0);
  });

  it('separates the same clock hour on different weekdays', () => {
    const tuesday = hourOfWeek(new Date(2026, 9, 27, 14, 0).getTime());
    const saturday = hourOfWeek(new Date(2026, 9, 31, 14, 0).getTime());
    expect(tuesday).not.toBe(saturday);
  });

  it('covers exactly one week', () => {
    const sundayLate = hourOfWeek(new Date(2026, 10, 1, 23, 0).getTime());
    expect(sundayLate).toBe(167);
  });
});

describe('update', () => {
  it('starts at the first value with no variance', () => {
    expect(update(EMPTY_BASELINE, 4.2, opts.alpha)).toEqual({ n: 1, mean: 4.2, variance: 0 });
  });

  it('tracks a steady signal to that value', () => {
    const s = feed(Array(50).fill(3));
    expect(s.mean).toBeCloseTo(3, 6);
    expect(Math.sqrt(s.variance)).toBeLessThan(0.01);
  });

  it('moves toward a new level instead of jumping to it', () => {
    const s = update(feed(Array(20).fill(2)), 10, opts.alpha);
    expect(s.mean).toBeGreaterThan(2);
    expect(s.mean).toBeLessThan(10);
  });
});

describe('detect', () => {
  it('reports insufficient history rather than silently passing', () => {
    const v = detect(feed([2, 2.1, 2]), 9, false, opts);
    expect(v.flagged).toBe(false);
    expect(v.skipped).toBe('insufficient_history');
    expect(v.score).toBeNull();
  });

  it('refuses to divide by a flat baseline and says so', () => {
    const v = detect(feed(Array(30).fill(2)), 9, false, opts);
    expect(v.skipped).toBe('baseline_too_flat');
    expect(v.flagged).toBe(false);
  });

  it('flags a load far above what this hour normally draws', () => {
    const v = detect(feed([2, 2.4, 1.8, 2.2, 2.1, 2.3, 1.9, 2.2]), 9, false, opts);
    expect(v.flagged).toBe(true);
    expect(v.code).toBe('STAT_ABOVE_HOUR_BASELINE');
    expect(v.score).toBeGreaterThan(opts.k);
  });

  it('catches waste below the 7 A rule, which is the whole point of L3', () => {
    // A room that normally idles near 1 A, now sitting at 5 A with nobody in it.
    // L1 never fires below 7 A.
    const v = detect(feed([1, 1.2, 0.9, 1.1, 1.0, 1.3, 0.8, 1.1]), 5, false, opts);
    expect(v.flagged).toBe(true);
    expect(5).toBeLessThan(7);
  });

  it('never flags an occupied room, however high the load', () => {
    const v = detect(feed([2, 2.4, 1.8, 2.2, 2.1, 2.3, 1.9, 2.2]), 40, true, opts);
    expect(v.flagged).toBe(false);
    expect(v.code).toBeNull();
    expect(v.score).toBeGreaterThan(opts.k); // the score is still reported, only the verdict differs
  });

  it('does not flag a reading that sits inside the normal spread', () => {
    const v = detect(feed([2, 2.4, 1.8, 2.2, 2.1, 2.3, 1.9, 2.2]), 2.3, false, opts);
    expect(v.flagged).toBe(false);
    expect(v.code).toBeNull();
  });
});
