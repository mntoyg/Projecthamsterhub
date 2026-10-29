# K-SES — Backend & AI seat (พี่)

This is the design record for **our seat only**. The system-level architecture, the team's
division of work and the milestones live in [`project/ARCHITECTURE.md`](project/ARCHITECTURE.md),
delivered by the project lead. The interface between the two sides is
[`project/API_CONTRACT.md`](project/API_CONTRACT.md). **Where this file and those two disagree,
they win** — change them first, by agreement, then update this file.

## 0. Who owns what

From `project/ARCHITECTURE.md` §1.1:

| Area | Owner |
| --- | --- |
| Frontend Dashboard (React) | nackjub |
| IoT Simulator (script + in-page button) | nackjub |
| **Backend API + Database** | **พี่ — us** |
| **AI: Energy Waste analysis** | **พี่ — us** |
| API Contract | agreed jointly |
| CI / SonarCloud / Deploy | agreed jointly |

Our milestones, from §8 of that document:

- **M1 — Express backend + validation + SQLite + the API per contract.** Done when the
  integration tests pass in CI.
- **M3 — L3 hour-of-week baseline + an evaluation set reporting Precision / Recall / F1**,
  comparing L1 vs L1+L2 vs L3.

M0 and M0.5 are already delivered by nackjub. M2 (wiring the dashboard to our API) and M4/M5 are
not ours.

**The UI is out of scope and read-only for this seat**: `project/src/components/**`,
`project/src/App.tsx`, `project/src/main.tsx`, `project/index.html`, `project/src/index.css`,
`project/tailwind.config.js`, `project/postcss.config.js`. We satisfy the contract; we do not
edit the dashboard.

## 1. What already exists (measured, 2026-10-29)

A React 18.3 + TypeScript 5.5 + Vite 7 + Tailwind 3.4 single-page dashboard, ~1,400 lines of
`src`. It runs fully **without any backend**: `VITE_LOCAL_MODE` defaults on, state lives in
`localStorage`, and `AutoSim.tsx` drives a simulator in the browser.

Three things in the delivered v3 matter to us directly:

- **`project/src/lib/config.ts`** exports `API_URL` from `VITE_API_URL`. Empty means local mode.
- **`project/src/App.tsx`** polls `GET /api/rooms` and `GET /api/readings` every 2 s when
  `API_URL` is set, and falls back to `OFFLINE` with the last known data when we stop answering.
  Our downtime degrades the demo; it does not break it.
- **`project/server/mock-api.ts`** is nackjub's mock of *our* service, already conforming to the
  contract, with `project/server/api.test.ts` against it. **It is the executable specification
  for M1** — our real service must pass those tests unchanged.

`project/src/engine/energy.ts` is a pure module with no I/O: the L1 rule
(`current >= 7 A && !motion`) and the L2 z-score (`MIN_HISTORY = 5`, `Z_LIMIT = 2.5`,
guard `std < 0.05`), plus the savings formulas (4.2 THB/kWh, 0.5 kgCO₂/kWh, 14 h × 22 days).
Because it is pure, **the server imports the same file** rather than reimplementing it. One
definition of "Energy Waste" for both sides is the point.

Absent and not planned by us: user authentication, cloud database, multi-server, real hardware
control. Supabase remains wired in `project/src/lib/supabase.ts` and
`project/supabase/migrations/` but is **not** the direction — the team architecture is a REST API
over SQLite. Treat Supabase as legacy.

## 2. Our design

### 2.1 Decisions

| # | Decision | Why |
| --- | --- | --- |
| D-1 | **Node.js + Express + SQLite** (`better-sqlite3`), TypeScript, run with `tsx` | Set by the team architecture §2 and §5. It also lets the server `import` the frontend's `engine/energy.ts` directly — no second implementation of the rule to drift. |
| D-2 | **Polling, not SSE, for v1.** `GET /api/rooms` + `GET /api/readings` every 2 s, as the dashboard already does | The client side is built and working. SSE is an additive endpoint (`GET /api/events`) once M1 is green; it is open decision #2 in the team doc. |
| D-3 | **No LLM anywhere.** The "AI" is L1 rule → L2 z-score → L3 EWMA baseline → L4 optional Isolation Forest | Team architecture §4. It also keeps the honesty rule there: with no L4, we call it *rule-based + statistical anomaly detection*, never "machine learning". |
| D-4 | **`project/server/api.test.ts` is the acceptance test.** The real service replaces `mock-api.ts` behind the same tests | Removes argument about whether M1 is done. The test either passes or it does not. |
| D-5 | Supersedes the earlier proposal in this file (Python + FastAPI, OpenAI insight layer, normalised Supabase schema). None of it is built | The team had already decided Node + Express + SQLite. A second stack in one repo, and an LLM nobody asked for, is cost with no milestone behind it. |

### 2.2 Module boundaries

```
project/server/
  index.ts          Express app, CORS allow-list, 10 KB body cap, route mounting
  routes/
    telemetry.ts    POST /api/telemetry
    rooms.ts        GET  /api/rooms
    readings.ts     GET  /api/readings
    health.ts       GET  /api/health
  validate.ts       the contract's field rules, one function per field, returns errors[]
  store.ts          the ONLY place SQL appears; prepared statements only
  analyze.ts        calls src/engine/energy.ts, adds L3; returns status + reasons + anomaly
  db.ts             schema creation, migrations, connection
  errors.ts         AppError hierarchy; routes translate, nothing else throws past itself
```

| Module | Must not |
| --- | --- |
| `routes/*` | contain business rules or touch SQL |
| `validate.ts` | write to the database or log user values verbatim |
| `store.ts` | leak a `better-sqlite3` exception past its own boundary |
| `analyze.ts` | perform I/O other than through `store.ts`, or return localised prose — it returns reason **codes** plus the Thai string the contract already specifies |

Thresholds, limits and assumptions are **configuration with the current values as defaults**, not
literals scattered through the code: `WASTE_THRESHOLD_A=7`, `MIN_HISTORY=5`, `Z_LIMIT=2.5`,
`HISTORY_WINDOW=20`, `MAX_BODY_BYTES=10240`, `READINGS_MAX_LIMIT=500`, `PORT=8787`,
`CORS_ORIGINS=` (explicit list).

### 2.3 API

Exactly `project/API_CONTRACT.md`. Summarised so a reviewer can check this file against it:

| Method | Path | Returns |
| --- | --- | --- |
| POST | `/api/telemetry` | `{room, status, anomaly, reasons[], monthly{kwh,baht,co2}}`, or `400 {errors[]}` |
| GET | `/api/rooms` | `{rooms: Room[]}` |
| GET | `/api/readings?limit=&roomId=` | `{readings: Reading[]}` — `power` in kW, `timestamp` epoch ms, oldest first, `limit` 1–500 |
| GET | `/api/health` | `{ok: true}` |
| GET | `/api/events` | SSE, optional, after M1 |

Validation, per the contract: `building` required ≤ 40 chars; `roomNumber` 1–12 chars from
letters, digits, space, `-`, `_`; `current` 0–100; `voltage` 0–500, default 220; `motion`
boolean. `status` is only `"Normal"` or `"Energy Waste"`.

### 2.4 Data model (SQLite)

Follows the ER diagram in the team architecture §5.

```sql
rooms(id TEXT PRIMARY KEY, building TEXT NOT NULL, room_number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Normal', zone TEXT NOT NULL DEFAULT 'Simulated',
      updated_at INTEGER NOT NULL)

readings(id INTEGER PRIMARY KEY AUTOINCREMENT,
         room_id TEXT NOT NULL REFERENCES rooms(id),
         current REAL NOT NULL, voltage REAL NOT NULL, motion INTEGER NOT NULL,
         status TEXT NOT NULL, ts INTEGER NOT NULL)
-- append only: no UPDATE, no DELETE path in store.ts
-- INDEX (room_id, ts DESC), INDEX (ts DESC)

events(id INTEGER PRIMARY KEY AUTOINCREMENT,
       room_id TEXT REFERENCES rooms(id),
       level TEXT NOT NULL, message TEXT NOT NULL, ts INTEGER NOT NULL)
-- every rejected telemetry is written here with its reason, per §6 of the team doc
```

`id` is the contract's slug (`ecc-building-402`), built server-side from `building` and
`roomNumber` — never taken from the request body.

### 2.5 AI / analysis

| Level | Method | Status | Owner note |
| --- | --- | --- | --- |
| L1 | Rule: `!motion && current >= 7 A` | exists in `engine/energy.ts` | server imports it |
| L2 | z-score vs the room's last 20 readings, needs ≥ 5, `z > 2.5`, skip when `std < 0.05` | exists | server imports it |
| L3 | EWMA baseline per room per hour-of-week, from `readings` | **done**, `server/baseline.ts` | separates "normal busy" from "abnormal"; the only layer that sees waste below 7 A |
| L4 | Isolation Forest or load forecasting | optional, only if L1–L3 are done and data is sufficient | if not built, do not say "machine learning" |

L3 keeps one EWMA mean and variance per `(room, hour-of-week)` bucket, 168 buckets per room,
persisted in `baselines`. Only readings judged `Normal` are folded in — feeding waste back
would teach the detector that waste is expected at that hour. A reading L3 flags is reported as
`Energy Waste`, the same as L1, because to an operator it is the same situation.

### Evaluation (M3)

`npm run evaluate` replays a labelled synthetic set in time order — each detector sees only what
came before it — and writes [`project/EVALUATION.md`](project/EVALUATION.md). Current result,
4 weeks, 6 rooms, 16,128 readings, seed 42:

| Level | Precision | Recall | F1 | recall on waste **under** 7 A |
| --- | ---: | ---: | ---: | ---: |
| L1 | 100.0% | 53.5% | 69.7% | 0.0% (0/492) |
| L1+L2 | 90.1% | 66.9% | 76.8% | 29.5% (145/492) |
| **L1+L2+L3** | **90.5%** | **74.5%** | **81.7%** | **45.5% (224/492)** |

L3 adds 7.6 points of recall over L1+L2 at the same precision. L1 cannot score above zero on the
last column by construction: that class is generated below its fixed threshold on purpose.

**How `k` was chosen.** Sweeping the threshold showed recall flat at 74.5% from k=3 to k=6 while
precision rose from 75.2% to 90.5% — the low values bought false positives and nothing else.
k=6 held as the best of {5, 6} on seeds 42, 7, 99 and 2026, so `BASELINE_K` defaults to 6.
It is tuned on this generator, with everything that implies.

**Two honesty rules, enforced in the report itself.** The data is **synthetic**, generated by
`scripts/evaluate.ts`, not measured at KMITL; the report says so in its first lines. And the
report counts how often L3 was actually able to judge versus skipped for thin history, because
a level that never runs and a level that runs and finds nothing produce identical tables. The
first run of this harness showed `judged: 0, skipped: 4032` — the generator emitted one reading
per hour, so no hour bucket ever reached `minSamples`. That was a flaw in the generator, not the
detector: real nodes report every few seconds.

The tariff, emission factor and idle-hours figures remain assumptions and are labelled as such
wherever a number is shown.

### 2.6 Fault tolerance

Per §6 of the team document, and this is a graded requirement, not a nicety:

| Input | Behaviour |
| --- | --- |
| `current`/`voltage` negative, `NaN`, > 100 A, > 500 V | `400` with the field error, write an `events` row, stay up |
| `roomNumber` empty or with forbidden characters | `400` with the reason |
| body not JSON, or > 10 KB | `400`, never a crash |
| room history < 5 readings | skip L2, report L1 only |
| database write fails | `500` with a correlation id; the detail goes to the log, not to the client |

**No silent failure.** Anything rejected, skipped or truncated is reported to the caller in
`errors[]` and recorded in `events`. An empty array means "nothing found" and nothing else.

### 2.7 Security — OWASP, for this stack

| OWASP | Obligation here |
| --- | --- |
| A01 | The API is unauthenticated by design (team doc §5: no login in phase 1). That makes input validation and the absence of any destructive endpoint the control: there is no `DELETE` route, and `readings` has no update or delete path. |
| A02 | Secrets only from the environment or `project/.env`, which is git-ignored. `project/.env.example` carries placeholders. Never log a secret or echo one in an error. |
| A03 | **Prepared statements only** via `better-sqlite3`; never a template-built SQL string. No `child_process` with a shell; if a subprocess is ever needed, argument array form. Never `eval`. |
| A04 | The tool reports; it never controls hardware. No endpoint actuates anything. |
| A05 | `CORS_ORIGINS` is an explicit allow-list, never `*`, once deployed. Body size capped. No security control is weakened to make a test pass. |
| A06 | Dependency floors pinned in `package.json`. `npm audit` findings are reviewed, not ignored — the current tree reports 14 (9 high) and that is tracked, not accepted silently. |
| A09 | Structured logs with a correlation id; every rejection recorded in `events`. |
| A10 | The server fetches no URL from any payload. |

Learned the hard way on this repository, and it must not recur: **never commit `.env`, and never
commit `dist/`.** The upstream repository shipped a built bundle containing a live Supabase URL
and anon key; the `.gitignore` at the repository root now blocks both. The delivered `.env` in
the hand-off zip was deliberately **not** copied into this repository for the same reason.

## 3. Verification gate

Nothing is done until this has been run and its real output pasted. A described result is not a
result. Run from `project/`.

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

From M1 onward the same `npm test` run must include the integration tests in
`project/server/api.test.ts` against the real service, not the mock. CI runs this already:
`project/.github/workflows/ci.yml` does typecheck → lint → test → build.

Running the pair locally:

```bash
npm run mock-api     # or the real server once it exists, on :8787
npm run simulate     # drives telemetry at it
```

Pointing the dashboard at a backend is a build-time variable: set `VITE_API_URL` before
`npm run build`. It must be HTTPS when the site is served over HTTPS, and our CORS list must
contain the site's origin.

**Windows runner note.** If a Node tool is ever wrapped in `uv`, don't: `uv run` fails here with
`Failed to query Python interpreter: Access is denied. (os error 5)` because uv's interpreter
discovery probes the zero-byte Microsoft Store alias stubs under
`%LOCALAPPDATA%\Microsoft\WindowsApps\`. That is an environment fault. State which runner you
used in every report.

### Reporting

Every claim carries the command and the measured output, before and after. Test failures are
shown, not summarised. A skipped step is named as skipped. Assert on identity, not counts — a
test asserts *which* reasons fired, never `reasons.length === 2`.
