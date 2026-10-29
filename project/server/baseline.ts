// L3: per-room, per-hour-of-week baseline with an EWMA mean and variance.
//
// Why this exists on top of L1 and L2:
//   L1 fires only above a fixed 7 A, so a room that normally draws 2 A and is
//   suddenly left at 5 A unoccupied is invisible to it.
//   L2 compares against the room's own recent readings regardless of when they
//   were taken, so a lab that is genuinely busy every Tuesday afternoon keeps
//   dragging its own reference up.
//   L3 compares a reading against what THAT room normally draws at THAT hour of
//   the week, which separates "normal busy" from "actually abnormal".
//
// Pure module: no I/O, no database, no formatted prose. It returns a code and
// the numbers behind it; the caller renders text.

/** Rolling state kept per (room, hour-of-week). */
export type BaselineStats = {
  /** How many readings have contributed. */
  n: number;
  /** EWMA mean of current, in amps. */
  mean: number;
  /** EWMA variance of current. */
  variance: number;
};

export type BaselineVerdict = {
  flagged: boolean;
  /** Reason code, or null when nothing fired. Rendered to Thai by the caller. */
  code: 'STAT_ABOVE_HOUR_BASELINE' | null;
  /** (x - mean) / sd, or null when there is not enough history to judge. */
  score: number | null;
  /** Why no score was produced, for honest reporting rather than a silent skip. */
  skipped: 'insufficient_history' | 'baseline_too_flat' | null;
  stats: BaselineStats;
};

export type BaselineOptions = {
  /** EWMA smoothing. Higher reacts faster and forgets sooner. */
  alpha: number;
  /** How many standard deviations above the hour's mean counts as abnormal. */
  k: number;
  /** Minimum contributing readings before the baseline is allowed to judge. */
  minSamples: number;
  /** Below this standard deviation the baseline is too flat to divide by. */
  sdFloor: number;
};

export const EMPTY_BASELINE: BaselineStats = { n: 0, mean: 0, variance: 0 };

/**
 * Hour-of-week bucket, 0..167, Monday 00:00 = 0.
 * A campus load pattern repeats weekly, not daily: Tuesday 14:00 and
 * Saturday 14:00 are different situations in the same room.
 */
export function hourOfWeek(timestamp: number): number {
  const d = new Date(timestamp);
  const mondayFirst = (d.getDay() + 6) % 7; // JS: 0 = Sunday
  return mondayFirst * 24 + d.getHours();
}

/**
 * Folds one reading into the baseline. Standard EWMA mean and variance:
 *   mean' = mean + a(x - mean)
 *   var'  = (1 - a)(var + a(x - mean)^2)
 */
export function update(stats: BaselineStats, current: number, alpha: number): BaselineStats {
  if (stats.n === 0) return { n: 1, mean: current, variance: 0 };
  const delta = current - stats.mean;
  return {
    n: stats.n + 1,
    mean: stats.mean + alpha * delta,
    variance: (1 - alpha) * (stats.variance + alpha * delta * delta),
  };
}

/**
 * Judges one reading against the baseline for its hour.
 * Only an unoccupied room can be flagged: high load with people present is use, not waste.
 */
export function detect(
  stats: BaselineStats,
  current: number,
  motion: boolean,
  options: BaselineOptions,
): BaselineVerdict {
  if (stats.n < options.minSamples) {
    return { flagged: false, code: null, score: null, skipped: 'insufficient_history', stats };
  }
  const sd = Math.sqrt(stats.variance);
  if (sd < options.sdFloor) {
    return { flagged: false, code: null, score: null, skipped: 'baseline_too_flat', stats };
  }
  const score = (current - stats.mean) / sd;
  const flagged = !motion && score > options.k;
  return {
    flagged,
    code: flagged ? 'STAT_ABOVE_HOUR_BASELINE' : null,
    score,
    skipped: null,
    stats,
  };
}
