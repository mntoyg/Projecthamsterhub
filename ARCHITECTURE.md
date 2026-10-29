# ProjectHamsterHub / K-SES — Architecture

KMITL Smart Energy Saver: real-time detection of wasted electrical load in campus rooms.

This document is the agreed design record. It is written before code. Section 1 describes what
exists today, measured by reading the repository. Section 2 describes the proposed backend and
AI/ML architecture. Section 3 is the verification gate. Nothing in section 2 is implemented yet.

- **Owner scope:** backend and AI/ML.
- **UI / frontend (`project/src/components/**`, `project/src/App.tsx`, `project/index.html`,
  Tailwind and PostCSS config): READ-ONLY, OUT OF SCOPE.** No agent and no implementation step
  described here may edit a UI file. The backend is designed to keep the current UI working
  unchanged (see §2.6 compatibility views).

---

## 1. Current state

### 1.1 Repository layout

The clone is nested. The git root is one level below the folder name:

```
D:\code-project\ProjectHamsterHub\          <- plain folder, holds nothing else
└── Projecthamsterhub\                      <- GIT ROOT (this file lives here)
    ├── README.md
    └── project\                            <- the application
        ├── package.json, package-lock.json
        ├── index.html, vite.config.ts, tsconfig*.json
        ├── eslint.config.js, postcss.config.js, tailwind.config.js
        ├── sonar-project.properties
        ├── dist\                           <- BUILD OUTPUT, COMMITTED TO GIT
        ├── src\
        │   ├── main.tsx            entry point (ReactDOM.createRoot)
        │   ├── App.tsx             all application state (344 lines)
        │   ├── components\         UI only — 10 files, out of scope
        │   ├── engine\energy.ts    decision engine (39 lines) + energy.test.ts (31 lines)
        │   ├── lib\supabase.ts     Supabase browser client
        │   ├── lib\api.ts          every database call
        │   ├── data\rooms.ts       seed rooms + derived metrics
        │   ├── types.ts            shared TypeScript types
        │   └── utils\logs.ts       timestamp + id helpers
        └── supabase\migrations\    2 SQL files
```

Remotes: `origin` = `mntoyg/Projecthamsterhub` (fork), `upstream` = `nxdklx465/Projecthamsterhub`.
History is 2 commits (`99a44bc Initial commit`, `2515610 Add files via upload`).

### 1.2 Tech stack actually in use

| Concern | Present today |
| --- | --- |
| Runtime | Browser only. No server process of any kind. |
| Language | TypeScript 5.5.3, `target: ES2020`, `strict: true`, path alias `@/* -> src/*` |
| UI | React 18.3.1, react-dom 18.3.1, lucide-react 0.446.0, Tailwind CSS 3.4.1 |
| Build | Vite 7.3.7 with `@vitejs/plugin-react` 5.1.1, PostCSS 8.4 + autoprefixer |
| Web framework (server) | **Absent** |
| Database | Supabase (hosted Postgres), reached **directly from the browser** via `@supabase/supabase-js` 2.57.4 REST + Realtime |
| Schema source | `project/supabase/migrations/` — 2 files, raw SQL, applied by hand. No ORM, no migration runner in `package.json`. |
| Auth | **Absent.** `auth: { persistSession: false }`; no sign-in screen, no roles, no sessions. |
| Background jobs / queue / cron | **Absent.** `components/AutoSim.tsx` is a browser `setInterval`. |
| AI / ML / LLM | **Absent.** See §1.5. |
| Tests | Vitest 5.0.5 — one file, `src/engine/energy.test.ts` (31 lines) |
| Lint / types | ESLint 9.9 (flat config) + typescript-eslint 8.3; `tsc --noEmit -p tsconfig.app.json` |
| Static analysis | `sonar-project.properties` present; see defect D2 below |
| Containerisation | **Absent.** No `Dockerfile`, no `docker-compose.yml`. |
| CI | **Absent.** No `.github/` directory. |
| Deploy target | **Absent.** No host config, no deploy script. `project/dist/` is committed instead. |
| Secrets template | **Absent.** No `.env`, no `.env.example`. |
| VCS hygiene | **No `.gitignore` anywhere in the repository.** |
| Installed deps | `node_modules` is not installed in this working copy. |

### 1.3 Entry points

1. `project/index.html` -> `project/src/main.tsx` -> `<App />` wrapped in `ErrorBoundary`.
2. There is no second entry point. No CLI, no server, no worker, no scheduled task.

### 1.4 Data flow today

```
                 LOCAL_MODE = true  (the default)
  SimulatorForm / AutoSim --> App.tsx state --> engine/energy.analyze()
                                   |
                                   +--> localStorage ("ksesRooms", "ksesReadings")
                                   +--> UI (RoomGrid, MetricCards, EnergyChart, LiveLogs)

                 LOCAL_MODE = false  (VITE_LOCAL_MODE=false in .env)
  Browser --> lib/api.ts --> Supabase REST  (rooms, logs, energy_readings: full CRUD as `anon`)
  Browser <-- Supabase Realtime channels `rooms-changes`, `logs-changes`
```

Mode is decided in `lib/supabase.ts`: `LOCAL_MODE = import.meta.env.VITE_LOCAL_MODE !== 'false'`,
and `isSupabaseConfigured = !LOCAL_MODE && Boolean(url && anonKey)`. Every function in
`lib/api.ts` short-circuits when `isSupabaseConfigured` is false — `fetchLogs` and
`fetchEnergyReadings` return `[]`, `insertLog` and `deleteRoom` return without acting.

### 1.5 The "AI" in the current system

There is no model, no inference, no provider, and no API key. The whole decision logic is
`project/src/engine/energy.ts`, 39 lines of pure TypeScript:

- **Rule:** `status = 'Energy Waste'` when `current >= 7.0 A && motion === false`.
- **Statistical:** `zScore(value, history)` over the room's own recent readings; requires
  `history.length >= 5` (`MIN_HISTORY`), returns `null` when `std < 0.05`; flags an anomaly when
  `z > 2.5` (`Z_LIMIT`) and there is no motion.
- **Savings estimate:** `powerKw = current * voltage / 1000`; monthly figures use
  `TARIFF_BAHT_PER_KWH = 4.2`, `CO2_KG_PER_KWH = 0.5`, `IDLE_HOURS_PER_MONTH = 14 * 22`.
  `project/README.md` labels these as documented assumptions, not measured campus data.

The log strings `"K-SES core initialized · AI engine online"` and
`"Energy optimization model loaded (v3.2)"` in `App.tsx` and in the seed data of
migration `20261028140248` are **decorative text**. They do not correspond to any artifact.

### 1.6 Storage schema today

| Table | Columns | Notes |
| --- | --- | --- |
| `rooms` | `id text PK`, `building`, `room_number`, `current numeric(8,2)`, `motion bool`, `status text`, `zone text`, `last_updated timestamptz`, `created_at` | `id` is a slug built in the client: `` `${building}-${roomNumber}` `` lowercased, spaces to `-`. `status` is a free-text column, not an enum. Seeded with 6 rooms. |
| `logs` | `id uuid PK`, `ts`, `level text`, `tag text`, `message text`, `created_at` | `level` and `tag` are free text. Seeded with the 3 boot lines. |
| `energy_readings` | `id uuid PK`, `room_id text`, `building`, `room_number`, `current numeric(8,2)`, `power numeric(10,3)`, `status text`, `ts` | Migration 2 states "no FK to allow simulator rows". `building` and `room_number` are duplicated from `rooms`. `power` is written as kW by `lib/api.ts` (`current * voltage / 1000`) but migration 2 documents it as `kW = current * 220 / 1000` — the client uses the form's `voltage`, so the two disagree whenever voltage is not 220. |

Indexes: `rooms_last_updated_idx`, `logs_created_at_idx`, `energy_readings_ts_idx`,
`energy_readings_room_idx`.

### 1.7 External services

Supabase only: Postgres via PostgREST, plus Realtime over websockets. No other third party is
contacted — no analytics, no auth provider, no mail, no LLM.

### 1.8 Defects carried forward

These are facts read from the repository, each to be closed by a step in §2.9.

- **D1 — OWASP A01, Broken Access Control.** All three migrations enable RLS and then grant
  `SELECT, INSERT, UPDATE, DELETE` to `anon` with `USING (true)` / `WITH CHECK (true)`. The anon
  key ships in the browser bundle, so anyone who loads the page can read, forge, overwrite or
  delete every row, including `clearLogs()`'s unbounded `DELETE ... WHERE created_at >= epoch`.
  The migration headers describe this as intentional for a no-sign-in shared dashboard. It is
  still an unauthenticated public write surface and the proposed design removes it.

  **Escalated 2026-10-29.** The anon key is not merely embeddable, it is already published:
  `project/dist/assets/index-DRT4vokJ.js` is committed to `main` (`2515610`) and carries the
  live project URL `https://ycunhpuedmrulggdxkvb.supabase.co` together with an anon JWT
  (`role: anon`, `exp` 2108756967 ≈ 2036), and the GitHub repository is public. Combined with
  the permissive grants, that token is in practice an unauthenticated write credential for the
  live database. Removing `dist/` from the index (IMPL-0) does not remove it from history.

  Partially closed by `project/supabase/migrations/20261029093000_tighten_rls_anon_read_only.sql`,
  which revokes `INSERT`, `UPDATE` and `DELETE` from `anon` and `authenticated`, drops the write
  policies, and revokes the schema default privileges that would re-grant them on a future table.
  **That migration does not end the exposure by itself:** the leaked token stays valid until the
  anon key and JWT secret are rotated in the Supabase dashboard, and the existing rows need an
  audit for third-party writes. Both are operator actions, tracked as IMPL-0a below.

  Checked while writing that migration: the published bundle has `isSupabaseConfigured` inlined
  to `false` (`const ym=!1`) and contains no table-name string, Vite having eliminated every
  query path, so the deployed frontend performs no Supabase read or write and the migration does
  not break it.
- **D2 — OWASP A09, logging/monitoring failure.** `sonar-project.properties` sets
  `sonar.javascript.lcov.reportPaths=coverage/lcov.info`, but `package.json` has no coverage
  script and `@vitest/coverage-*` is not a dependency. Sonar therefore reports coverage over an
  absent file: a quality gate that silently measures nothing.
- **D3 — No `.gitignore`.** `project/dist/` is already committed. Once anyone runs
  `npm install`, `node_modules` becomes stageable. A secret written to `project/.env` would also
  be stageable. This must be fixed before the first `npm install` in a shared clone.
- **D4 — Localisation inside a pure module.** `engine/energy.ts` returns Thai user-facing
  sentences in `Analysis.reasons`. A pure decision module should return machine-readable reason
  codes and let a presentation layer translate them. The backend will emit codes (§2.5) and will
  not copy this pattern. `engine/energy.ts` is not a UI file, so it may be changed later, but it
  is not in this task's scope.
- **D5 — `power` unit disagreement** between `lib/api.ts` and migration 2 (see §1.6). The new
  schema stores watts explicitly with the voltage used (§2.6).

---

## 2. Proposed backend + AI/ML architecture

### 2.1 Decisions (agreed 2026-10-29)

| # | Decision | Rationale |
| --- | --- | --- |
| ADR-1 | Backend is **Python 3.12 + FastAPI**, a separate service in `backend/` | Matches the owner's backend/AI-ML seat; gives scikit-learn, pandas and numpy for §2.5 tier 1; gives `pydantic-settings` + `SecretStr` for §2.7. Cost: two languages in one repo, bounded by keeping the frontend untouched. |
| ADR-2 | LLM provider is **OpenAI**, called **server-side only**, behind a provider interface | The owner has OpenAI credit and no Anthropic credit. The interface (`InsightProvider`) keeps a later swap to another vendor a config change, not a rewrite. |
| ADR-3 | Data model is **normalised reference tables + append-only time series**, delivered as new migrations alongside **read-only compatibility views** carrying the current column names | Gives referential integrity and a real time series, while letting the out-of-scope UI keep reading `rooms`, `logs`, `energy_readings` with no frontend edit. |
| ADR-4 | Postgres stays **Supabase**; the browser keeps Realtime for reads | No reason to move the database; Realtime already works and is read-only under the new policies. |
| ADR-5 | **All writes move server-side.** `anon` is reduced to `SELECT`. Ingest is authenticated with a device token. | Closes D1. |
| ADR-6 | Docs and agent files live at the **nested git root** `Projecthamsterhub/` | That is the real repo root; files one level up would not be tracked or pushed. |
| ADR-7 | Migration files keep the repository's existing `YYYYMMDDHHMMSS_description.sql` convention. The `000n_` labels in §2.6 and §2.9 name the *step*, not the filename. | The two existing migrations are timestamped; a second scheme in the same directory would make the apply order ambiguous. |
| ADR-8 | **RLS tightening ships first, standalone, against the current tables** — `20261029093000_tighten_rls_anon_read_only.sql` — instead of waiting for the normalised schema as `0009` | D1 is live on a public repository with a published anon token. A security fix does not queue behind seven schema migrations. The later `0009` step now only extends the same policy shape to the new tables. |

### 2.2 Target topology

```
  IoT node / simulator                     Browser (UI — out of scope)
        |  POST /v1/ingest/readings              |  SELECT via PostgREST + Realtime
        |  Authorization: Bearer <ingest token>  |  anon key, SELECT only
        v                                        v
  +---------------------------------+      +--------------------------+
  |  FastAPI service (backend/)     |      |  Supabase Postgres       |
  |                                 |      |                          |
  |  api/        HTTP boundary      |      |  reference tables        |
  |  ingest/     validate + persist |----->|  readings (append-only)  |
  |  detect/     tier 0 + tier 1    |      |  anomalies               |
  |  insight/    tier 2 (LLM)       |      |  insights                |
  |  store/      repository layer   |      |  event_log               |
  |  config/     settings, secrets  |      |  compat views (read-only)|
  +---------------------------------+      +--------------------------+
        |  service-role key (server only)
        |  OPENAI_API_KEY (server only)
        v
  OpenAI API  <-- the only outbound third party
```

The service-role key and the OpenAI key never reach the browser. Nothing in the frontend bundle
changes.

### 2.3 Service boundaries

| Module | Owns | Must not |
| --- | --- | --- |
| `backend/app/api/` | HTTP: routing, request/response schemas, auth dependency, error translation to RFC 9457 `application/problem+json` | Contain business rules or touch the database driver |
| `backend/app/ingest/` | Validating telemetry, computing derived power, appending a reading, firing detection | Call the LLM, or render text for humans |
| `backend/app/detect/` | Tier 0 rules and tier 1 statistics/ML; produces `Anomaly` records with reason **codes** | Perform I/O other than through `store/`; produce localised prose |
| `backend/app/insight/` | Tier 2: builds a numeric prompt, calls the provider, stores the result | Be on the request path of ingest; be required for detection to work |
| `backend/app/store/` | Repository functions, one per query; the only place SQL or the Supabase client appears | Leak driver exceptions past its own boundary |
| `backend/app/config/` | `Settings` (pydantic-settings), `SecretStr` fields, one resolved config object | Read `os.environ` anywhere else in the tree |
| `backend/app/errors.py` | `HamsterHubError` and subclasses | — |

Rule carried from the owner's other project: **a path, a limit, an exclusion or a threshold is
configuration, not a constant with an exception.** The 7.0 A threshold, `MIN_HISTORY`, `Z_LIMIT`,
the tariff and the emission factor all become settings with the current values as defaults.

### 2.4 API contract shape

Versioned under `/v1`. JSON only. Errors are `application/problem+json`
(`{type, title, status, detail, instance}`) and never contain a secret, a stack trace or a
provider message verbatim.

| Method | Path | Auth | Body / query | Returns |
| --- | --- | --- | --- | --- |
| `GET` | `/healthz` | none | — | `{"status":"ok"}` — liveness, no dependency check |
| `GET` | `/readyz` | none | — | database reachability; `503` when not ready |
| `POST` | `/v1/ingest/readings` | `Bearer` ingest token | `{device_external_id, ts?, current_a, voltage_v, motion}` or a batch of up to `INGEST_MAX_BATCH` | `202` `{accepted, rejected: [{index, code}]}` — partial rejects are reported, never dropped silently |
| `GET` | `/v1/rooms` | anon read | `?building=&zone=&status=` | current state per room, latest reading joined |
| `GET` | `/v1/rooms/{room_id}/readings` | anon read | `?from=&to=&limit=` (`limit` capped by `READINGS_MAX_LIMIT`) | time series, ascending |
| `GET` | `/v1/anomalies` | anon read | `?room_id=&since=&status=&limit=` | anomaly records with reason codes and evidence |
| `POST` | `/v1/anomalies/{id}/ack` | operator token | `{note?}` | acknowledged anomaly |
| `POST` | `/v1/insights` | operator token | `{anomaly_id}` or `{room_id, window}` | `201` insight, or `200` with a cached insight for the same `prompt_hash` |
| `GET` | `/v1/insights` | anon read | `?room_id=&since=&limit=` | stored insights |
| `GET` | `/v1/metrics/summary` | anon read | `?window=` | rooms monitored, rooms wasting, kWh/baht/kgCO2 estimates with the assumption set used |

Three distinct credentials, never interchangeable: the **ingest token** (write telemetry only),
the **operator token** (acknowledge, request an insight), and Supabase **anon** (read only, used
by the browser directly, not by this API).

### 2.5 AI/ML design

Three tiers. Each tier is useful alone, and a failure in a higher tier never disables a lower one.

**Tier 0 — deterministic rule (always on, no dependency).**
Parity with today's engine so results stay comparable: `waste` when
`current_a >= WASTE_THRESHOLD_A` (default `7.0`) and `motion is false`. Emits reason code
`RULE_HIGH_LOAD_NO_OCCUPANCY`.

**Tier 1 — statistics and classical ML (in-process, no network).**

- *Robust baseline:* per room, per hour-of-week bucket, rolling median and MAD over the trailing
  `BASELINE_WINDOW_DAYS` (default 14). Modified z-score `0.6745 * (x - median) / MAD`; anomaly
  when it exceeds `Z_LIMIT` (default 2.5) and `motion is false`. MAD below `MAD_FLOOR` yields no
  score rather than a divide-by-near-zero — the same guard as today's `std < 0.05`, kept as a
  setting. Requires at least `MIN_HISTORY` samples (default 5). Reason code
  `STAT_ABOVE_ROOM_BASELINE`.
- *Multivariate:* scikit-learn `IsolationForest` over `(current_a, voltage_v, motion,
  hour_of_week, rolling_mean_1h)`, trained offline by `backend/scripts/train_detector.py` into a
  **versioned artifact** `models/detector-<semver>.joblib` with a sidecar JSON recording training
  row count, date range, feature list and library versions. The service loads the artifact named
  by `DETECTOR_MODEL_PATH`; when it is absent or fails to load, the service logs a WARNING and
  runs tiers 0 and 1 only — it does not start pretending to be healthy. Reason code
  `ML_ISOLATION_FOREST`. Artifacts are **not** committed to git (§2.8 ignore rules); they are
  rebuilt by the script from `readings`.
- Severity is derived from which codes fired and the margin over threshold, not from the LLM.

**Tier 2 — LLM explanation and recommendation (OpenAI, server-side, optional).**

- *Purpose:* turn an `Anomaly` plus its numeric evidence into a short Thai operator note and a
  concrete recommendation. It **explains**; it never decides. An insight is never the source of
  `anomalies.severity` or of any control action.
- *Provider:* `insight/providers/openai_provider.py` implementing
  `InsightProvider.explain(evidence: AnomalyEvidence) -> InsightDraft`. Model id comes from
  `OPENAI_MODEL` (starting default `gpt-4o-mini`, to be confirmed against the account's available
  models before the first call). A second implementation can target another vendor without
  touching callers.
- *Input:* a compact numeric summary only — room code, building, zone, window, current/voltage/
  power statistics, baseline median and MAD, the reason codes that fired, the assumption set.
  No raw log text, no free-text user input, no identifiers of people. Occupancy enters as the
  boolean `motion`, never as a person.
- *Output handling, OWASP A03 and A10:* the response is **data**. It is stored and displayed. It
  is never `exec`'d, `eval`'d, imported, used to build SQL or a shell command, used as a file
  path, or used to choose a code branch. Any URL in it is stored as display text and **never
  fetched**. Length is clamped to `INSIGHT_MAX_CHARS`.
- *Resilience:* `LLM_ENABLED` defaults false so the system is useful before any key exists.
  Timeout `LLM_TIMEOUT_S`, bounded retries on 429/5xx with jitter, a per-day token budget
  `LLM_DAILY_TOKEN_BUDGET`; exceeding it logs a WARNING and falls back to a deterministic Thai
  template built from the reason codes. A provider failure marks the insight `status='failed'`
  with the reason recorded — it never returns an empty success.
- *Cost control:* insights are cached on `prompt_hash` (SHA-256 of the canonical evidence JSON);
  an identical request returns the stored row instead of calling the provider.

### 2.6 Data model

New tables. `room_id` is a UUID surrogate key; the human slug stays as `rooms.code` so existing
links keep working.

```
buildings(id uuid pk, code text unique, name text, created_at timestamptz)

rooms(id uuid pk, building_id uuid -> buildings(id), room_number text, code text unique,
      zone text, nominal_voltage_v numeric(6,1) default 220, active bool default true,
      created_at timestamptz,
      unique (building_id, room_number))

devices(id uuid pk, room_id uuid -> rooms(id), external_id text unique, kind text,
        installed_at timestamptz, active bool default true)
        -- external_id is what an IoT node sends; it is resolved to room_id server-side.

readings(id bigserial pk, device_id uuid -> devices(id), room_id uuid -> rooms(id),
         ts timestamptz not null, current_a numeric(8,2) not null,
         voltage_v numeric(6,1) not null, power_w numeric(10,2) not null,
         motion bool not null, source text not null check (source in ('device','simulator')),
         created_at timestamptz default now())
         -- APPEND-ONLY. No UPDATE, no DELETE policy for any role. power_w is stored in WATTS
         -- together with the voltage_v it was computed from, closing D5.
         -- index (room_id, ts desc), index (ts desc)

anomalies(id uuid pk, room_id uuid -> rooms(id), detected_at timestamptz,
          window_start timestamptz, window_end timestamptz,
          reason_codes text[] not null, score numeric(10,4),
          severity text check (severity in ('info','warn','critical')),
          status text check (status in ('open','acked','resolved')) default 'open',
          detector_version text, evidence jsonb not null, acked_at timestamptz, acked_note text)
          -- index (room_id, detected_at desc), index (status, detected_at desc)

insights(id uuid pk, anomaly_id uuid -> anomalies(id) null, room_id uuid -> rooms(id),
         created_at timestamptz, provider text, model text, prompt_hash text unique,
         body_th text, body_en text null,
         status text check (status in ('ok','failed','fallback')),
         failure_code text null, tokens_in int, tokens_out int)
         -- prompt_hash unique => the cache in §2.5 is enforced by the database, not by hope.

event_log(id bigserial pk, ts timestamptz default now(),
          level text check (level in ('debug','info','warn','error')),
          tag text, message text, context jsonb)
          -- replaces `logs`; `context` carries structured fields instead of formatted strings.
```

**Compatibility views** (this is what keeps the UI out of scope). Read-only views reproduce the
exact column names `lib/api.ts` selects today, so no frontend file is edited:

```
rooms                  (id, building, room_number, current, motion, status, zone, last_updated)
                       -- status derived from the latest open anomaly, not stored free text
logs                   (id, ts, level, tag, message)
energy_readings        (id, room_id, building, room_number, current, power, status, ts)
                       -- `power` is emitted as kW (power_w / 1000) to match what the chart expects
```

The existing `rooms`, `logs` and `energy_readings` tables are **renamed** to `*_legacy` and the
view takes the old name, so PostgREST keeps serving `/rest/v1/rooms` unchanged. Realtime is
re-subscribed to the underlying tables. A view cannot be written through, which is precisely the
guarantee wanted: the browser physically cannot write any more.

**RLS, closing D1:**

| Role | Reference tables | `readings` | `anomalies` | `insights` | `event_log` | compat views |
| --- | --- | --- | --- | --- | --- | --- |
| `anon` | SELECT | SELECT | SELECT | SELECT | SELECT | SELECT |
| `authenticated` | SELECT | SELECT | SELECT | SELECT | SELECT | SELECT |
| `service_role` | full | INSERT + SELECT only | full | full | INSERT + SELECT | — |

No `INSERT`, `UPDATE` or `DELETE` is granted to `anon` or `authenticated` on anything. No
`UPDATE` or `DELETE` is granted to any role on `readings`. Each policy is written per verb with
an explicit predicate; `USING (true)` survives only on `SELECT` of intentionally public rows, and
each such policy carries a comment saying why.

Migration order (reversible, one concern each):
`0003_reference_tables` -> `0004_readings_append_only` -> `0005_anomalies_insights` ->
`0006_event_log` -> `0007_backfill_from_legacy` -> `0008_compat_views_and_rename` ->
`0009_tighten_rls`. Each file has a `-- DOWN` section. `0007` is verified by row-count and
checksum comparison against the legacy tables before `0008` runs. These are step names, not
filenames (ADR-7).

The `0009` policy shape already exists for the current tables:
`20261029093000_tighten_rls_anon_read_only.sql` applied it ahead of the rest (ADR-8), so the
`0009` step reduces to extending the same revokes and SELECT-only policies to the new tables.

### 2.7 Configuration and secrets — OWASP A02

- One `Settings` class (`pydantic-settings`), loaded once at startup, passed down. No module
  reads `os.environ`.
- Every secret is typed `SecretStr`: `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`,
  `INGEST_TOKEN`, `OPERATOR_TOKEN`, `DATABASE_URL`.
- Secrets come **only** from the process environment or `backend/.env`. `backend/.env` is
  git-ignored and agent-ignored. `backend/.env.example` is committed with placeholder values
  only, never a real key.
- A `SecretStr` never appears in a log line, an exception message, a `repr`, an HTTP response, a
  commit or a PR body. A startup self-check asserts that no setting whose name matches
  `KEY|TOKEN|SECRET|PASSWORD` is a plain `str`.
- Non-secret settings and their defaults: `WASTE_THRESHOLD_A=7.0`, `MIN_HISTORY=5`,
  `Z_LIMIT=2.5`, `MAD_FLOOR=0.05`, `BASELINE_WINDOW_DAYS=14`, `TARIFF_BAHT_PER_KWH=4.2`,
  `CO2_KG_PER_KWH=0.5`, `IDLE_HOURS_PER_MONTH=308`, `INGEST_MAX_BATCH=200`,
  `READINGS_MAX_LIMIT=5000`, `LLM_ENABLED=false`, `OPENAI_MODEL=gpt-4o-mini`,
  `LLM_TIMEOUT_S=20`, `LLM_DAILY_TOKEN_BUDGET=200000`, `INSIGHT_MAX_CHARS=1200`,
  `DETECTOR_MODEL_PATH=` (empty disables tier 1 ML), `LOG_LEVEL=INFO`, `CORS_ORIGINS=`.
- `CORS_ORIGINS` is an explicit allow-list. `*` is not permitted while any token-authenticated
  route is mounted.

### 2.8 Error handling, logging and other OWASP obligations

- **A09, no silent failure.** Anything dropped, skipped, rejected or truncated is reported: to
  the caller in the response (`rejected[]`), and to `event_log` with a code. An empty list means
  "nothing found" and nothing else — never a masked error. Returning `[]` on an exception is
  forbidden, which is a deliberate change from today's `lib/api.ts` short-circuits.
- **Exception translation at the boundary.** `store/` raises `StorageError`, `insight/` raises
  `ProviderError`, `config/` raises `ConfigError` — all subclasses of `HamsterHubError`. A
  `httpx`, `postgrest` or `openai` exception never escapes its module. The API layer maps
  `HamsterHubError` to a problem document; an unexpected exception becomes a `500` with a
  correlation id, and the detail goes to the log, not to the client.
- **Never infer success from an exit code or a truthy value alone.** Supabase returns `200` with
  an `error` payload in several paths; the repository layer inspects the payload, not just the
  status.
- **Structured logging.** JSON lines: `ts`, `level`, `logger`, `event`, `correlation_id`, plus
  typed fields. No f-string-formatted prose as the primary record. A redaction filter drops any
  value matching the secret-name pattern.
- **A03, injection.** Parameterised SQL only; no string-built queries. Subprocesses, if any are
  ever needed, are invoked with an argument list and never `shell=True`. LLM output is data
  (§2.5).
- **A01, path handling.** The service writes to exactly two configured directories (model
  artifacts, logs). Any path derived from input is resolved once at the boundary with
  `Path.resolve()` and rejected unless it is inside the configured root. A path outside the root
  is an error, never a write.
- **A04, insecure design.** Detection proposes; a human acknowledges. There is no automatic
  control action on campus hardware anywhere in this design, and none may be added without a new
  ADR. `LLM_ENABLED` is off and ingest is closed by default.
- **A05.** No security control is weakened to make a test pass. Every `# nosec`, `# noqa` or
  `# type: ignore` carries a same-line reason, and the suppressed set is audited with
  `bandit -r backend/app --ignore-nosec`.
- **A06.** Dependency floors pinned in `backend/pyproject.toml`; Bandit on `backend/app` must
  stay at zero findings.
- **A07.** Tokens are compared with `secrets.compare_digest`, carry at least 32 bytes of
  entropy, and are rotatable by environment change alone.
- **A10, SSRF.** The only outbound host is the OpenAI API base, taken from settings, not from any
  payload. No URL from a reading, an anomaly, a log row or an LLM response is ever fetched.

### 2.9 Implementation path (micro-steps, each independently verifiable)

No step below is started by this task.

| Step | Deliverable | Done when |
| --- | --- | --- |
| IMPL-0 | `.gitignore` at the git root; `project/dist/` removed from the index | `git status` clean after `npm install`; closes D3 — **done**, `19ba2ff` |
| IMPL-0a | **Operator actions on the D1 exposure, not code.** Apply `20261029093000_tighten_rls_anon_read_only.sql`; rotate the anon key and JWT secret in the Supabase dashboard; audit `rooms`, `logs` and `energy_readings` for third-party writes; decide on repository visibility and on purging `dist/` from history | the verification block in that migration passes, including the negative test that must return 401/403 where it previously returned 201; the old token is rejected after rotation |
| IMPL-1 | `backend/` skeleton: `pyproject.toml`, `Settings`, `errors.py`, `/healthz`, `/readyz`, structured logging | gate block §3.2 passes with a trivial test |
| IMPL-2 | Migrations `0003`–`0006` with `-- DOWN`, applied to a scratch Supabase project | DDL check plus a reversibility test |
| IMPL-3 | `store/` repositories + `0007` backfill | row-count and checksum parity against `*_legacy` |
| IMPL-4 | `0008` compat views + rename; `0009` RLS tightening | the unchanged frontend still loads; an `anon` INSERT is **rejected** (control verified by breaking it, §3.3) |
| IMPL-5 | `POST /v1/ingest/readings` + tier 0 detection | partial-batch rejects reported; anomaly rows created |
| IMPL-6 | Tier 1 statistics; `GET /v1/anomalies` | property tests on the robust z-score including the MAD floor |
| IMPL-7 | `scripts/train_detector.py` + artifact loading | an absent artifact degrades with a WARNING and the service still serves |
| IMPL-8 | Tier 2 insights behind `LLM_ENABLED`, OpenAI provider, cache, budget, fallback | provider failure yields `status='failed'`, never an empty success |
| IMPL-9 | Coverage reporting wired so Sonar measures something | `coverage/lcov.info` exists after the test run; closes D2 |
| IMPL-10 | `Dockerfile` for `backend/`, `docker-compose.yml` for local Postgres, CI workflow running §3 | CI green on the branch |

### 2.10 Explicitly out of scope

The UI layer; any change under `project/src/components/`; styling; `project/src/App.tsx`;
authentication for human users (there is no sign-in and none is proposed here); multi-tenancy;
automated control of campus hardware; replacing Supabase.

---

## 3. Verification gate

Nothing is "done" until this block has been run and its real output pasted into the report. A
described result is not a result.

**Runner note (Windows).** `uv run` can fail with
`Failed to query Python interpreter: Access is denied. (os error 5)` because uv's interpreter
discovery probes the zero-byte Microsoft Store App Execution Alias stubs under
`%LOCALAPPDATA%\Microsoft\WindowsApps\` and treats a failed query as fatal instead of skipping
the entry. That is an environment fault, not a repository fault. Run the gates through the
project interpreter directly and state in every report which runner was used. Never add `uv` to
a script or a test to work around it. `uv sync` is the only command that needs uv, and only when
dependencies change.

### 3.1 Frontend gate — runnable today, read-only

Run from `project/`. These commands verify the out-of-scope layer still builds; they must not be
made to pass by editing a UI file.

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Status at the time of writing: `node_modules` is not installed in this working copy, so none of
these has been executed yet. They are the gate, not a claim.

### 3.2 Backend gate — applies from IMPL-1 onward

Run from `backend/`.

```bash
.venv/Scripts/python.exe -m pytest -q
.venv/Scripts/python.exe -m ruff check app tests
.venv/Scripts/python.exe -m ruff format --check app tests
.venv/Scripts/python.exe -m mypy app
.venv/Scripts/python.exe -m bandit -r app -ll
.venv/Scripts/python.exe -m bandit -r app --ignore-nosec -ll
```

Required outcomes: pytest exits 0 with no skipped test left unexplained in the report; ruff and
the format check clean; mypy clean on `app`; Bandit at **zero** findings, and the
`--ignore-nosec` run reviewed so nothing hides behind a suppression.

### 3.3 Security control verification — break it first

A control that passes while disabled was never tested. From IMPL-4 onward these must be run and
their output pasted.

```bash
# 1. anon must NOT be able to write. This request must FAIL with 401 or 403.
curl -i -X POST "$SUPABASE_URL/rest/v1/readings" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"room_id":"00000000-0000-0000-0000-000000000000","current_a":1,"voltage_v":220,"power_w":220,"motion":false,"source":"device","ts":"2026-01-01T00:00:00Z"}'

# 2. readings must be append-only. This request must FAIL.
curl -i -X PATCH "$SUPABASE_URL/rest/v1/readings?id=eq.1" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" -d '{"current_a":0}'

# 3. ingest without a token must FAIL with 401.
curl -i -X POST http://localhost:8000/v1/ingest/readings \
  -H "Content-Type: application/json" -d '{}'

# 4. ingest with a wrong token must FAIL with 401 and must not reveal the expected value.
curl -i -X POST http://localhost:8000/v1/ingest/readings \
  -H "Authorization: Bearer wrong" -H "Content-Type: application/json" -d '{}'

# 5. no secret in logs. Must print "clean".
grep -rEi 'sk-[A-Za-z0-9]|service_role|eyJ[A-Za-z0-9_-]{20,}' backend/logs/ || echo "clean"
```

Each of 1–4 is a **negative** test: a `2xx` is a failure of the gate. Each is also asserted in
`backend/tests/` so it runs in CI, and each has a paired test that disables the control and
confirms the request would otherwise have succeeded.

### 3.4 Reporting rules

Every defect report and every completed step carries the command and the measured output before
and after. Test failures are shown, not summarised. A skipped step is named as skipped. Assert on
identity, not counts: a test asserts *which* reason codes fired, never `len(codes) == 2`.
