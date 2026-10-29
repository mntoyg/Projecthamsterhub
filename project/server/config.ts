// Every limit, threshold and path is configuration with today's value as the default.
// Nothing below is duplicated as a literal elsewhere in server/.

const positive = (raw: string | undefined, fallback: number): number => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const list = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const config = {
  port: positive(process.env.PORT, 8787),
  /** ':memory:' keeps a run ephemeral; tests use it. */
  dbFile: process.env.DB_FILE ?? 'server/data/k-ses.db',
  /** Explicit allow-list. Empty means "development, reflect any origin" and warns at startup. */
  corsOrigins: list(process.env.CORS_ORIGINS),
  /** API_CONTRACT.md: a body over this is rejected with 400, never a crash. */
  maxBodyBytes: positive(process.env.MAX_BODY_BYTES, 10_000),
  /** How many of a room's recent readings feed the z-score. */
  historyWindow: positive(process.env.HISTORY_WINDOW, 20),
  readingsDefaultLimit: positive(process.env.READINGS_DEFAULT_LIMIT, 30),
  readingsMaxLimit: positive(process.env.READINGS_MAX_LIMIT, 500),

  /** L3 baseline (server/baseline.ts). Tuned on the evaluation set, `npm run evaluate`. */
  baseline: {
    /** EWMA smoothing: higher reacts faster and forgets sooner. */
    alpha: positive(process.env.BASELINE_ALPHA, 0.3),
    /**
     * Standard deviations above the hour's mean that count as abnormal.
     * 6, not 3: the sweep in ARCHITECTURE.md §2.5 shows recall is flat from k=3
     * to k=6 while precision climbs from 75% to 90%, so the lower values only
     * buy false positives. Measured on four seeds, synthetic data.
     */
    k: positive(process.env.BASELINE_K, 6),
    /** Readings required in an hour bucket before the baseline may judge. */
    minSamples: positive(process.env.BASELINE_MIN_SAMPLES, 5),
    /** Below this standard deviation the baseline is too flat to divide by. */
    sdFloor: positive(process.env.BASELINE_SD_FLOOR, 0.05),
  },
} as const;

export type Config = typeof config;
