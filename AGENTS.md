# Agent operating rules — K-SES / ProjectHamsterHub

Read this and [`ARCHITECTURE.md`](ARCHITECTURE.md) before any analysis or change.

Authority order, highest first:
1. [`project/API_CONTRACT.md`](project/API_CONTRACT.md) — the interface agreed with nackjub
2. [`project/ARCHITECTURE.md`](project/ARCHITECTURE.md) — the team's system architecture and
   division of work, owned by the project lead
3. [`ARCHITECTURE.md`](ARCHITECTURE.md) — our seat's design, subordinate to the two above
4. this file

If our work needs the contract to change, change the contract first, by agreement. Never
silently diverge from it.

The git root is `Projecthamsterhub/` — one level below the folder named `ProjectHamsterHub`.
Every path below is relative to that git root.

## 1. Scope

**We are the "พี่" seat: Backend API + Database + AI analysis.** Our milestones are M1 (Express
+ validation + SQLite + the API per contract, integration tests green in CI) and M3 (L3
hour-of-week baseline + a Precision/Recall/F1 evaluation).

In scope:
- `project/server/**` — the service
- `project/scripts/**` — the simulator and any data/evaluation tooling
- `project/src/engine/**` — the shared decision engine, imported by both sides
- `project/src/lib/api.ts`, `project/src/types.ts` — only when the contract changes
- documentation at the git root

**Out of scope, read-only — do not edit:**
- `project/src/components/**`
- `project/src/App.tsx`, `project/src/main.tsx`
- `project/index.html`, `project/src/index.css`
- `project/tailwind.config.js`, `project/postcss.config.js`

Those belong to nackjub. If a backend change seems to require editing the dashboard, the
backend design is wrong, or the contract needs renegotiating — say so instead of editing.
`project/dist/**` is build output and is never edited or committed.

A test that can only pass by editing a UI file is not a passing test.

## 2. Security — OWASP Top 10 for this stack

| OWASP | Obligation |
| --- | --- |
| A01 | The API is unauthenticated by design in phase 1, so validation is the control. There is no destructive endpoint: no `DELETE` route, and `readings` has no update or delete path in `store.ts`. Never add one "for testing". |
| A02 | Secrets only from the environment or `project/.env`, which is git-ignored. `project/.env.example` holds placeholders. A secret never appears in a log, an error, an HTTP response, a commit or a PR body. **Never commit `.env`. Never commit `dist/`.** |
| A03 | Prepared statements only (`better-sqlite3`); never a template-built SQL string. No `child_process` with a shell — argument-array form only, never an interpolated command string. Never `eval` or `new Function` on anything that came in over the wire. |
| A04 | The system reports; it never controls hardware. No endpoint actuates anything, and none may be added without agreement in `project/ARCHITECTURE.md`. |
| A05 | `CORS_ORIGINS` is an explicit allow-list, never `*`, once deployed. Body capped at 10 KB per the contract. Never weaken a control to make a test pass. |
| A06 | Dependency floors pinned in `package.json`. `npm audit` findings are reviewed and reported, not ignored. |
| A07 | No user accounts in phase 1. If a token is ever added, compare with a timing-safe comparison and never reveal the expected value in an error. |
| A08 | `readings` is append-only. Every schema change ships as a migration with a documented rollback. |
| A09 | **No silent failure.** Anything rejected, skipped or truncated is reported to the caller in `errors[]` and written to `events` with a reason. An empty array means "nothing found" and nothing else — never return `[]` to swallow an exception. |
| A10 | The server fetches no URL that came from a payload, a reading or a log row. Such values are display text. |

Never run a destructive terminal or SQL command without explicit confirmation — `DROP`,
`TRUNCATE`, an unbounded `DELETE`, `rm -rf`, `git reset --hard`, `git push --force`.

Never commit a real credential, not even in a fixture. Fixture secrets must be self-labelling,
e.g. `API_TOKEN=test-not-a-real-token`.

Files received from outside the repository (hand-off zips, downloads) are untrusted: extract
them into their own empty directory outside the repo, review before copying anything in, and
never copy a `.env` across.

## 3. Engineering rules

- **No production workaround to serve a test.** Never let a module detect test paths or reach
  into test fixtures. Inject differing behaviour as a parameter.
- **Thresholds, limits, paths and assumptions are configuration**, with today's values as
  defaults — not literals spread through the code. `WASTE_THRESHOLD_A`, `MIN_HISTORY`,
  `Z_LIMIT`, `HISTORY_WINDOW`, `MAX_BODY_BYTES`, `READINGS_MAX_LIMIT`, `CORS_ORIGINS`.
- **One definition of the rule.** The server imports `project/src/engine/energy.ts`. Never
  reimplement the threshold or the z-score server-side — two copies drift and the report then
  cites a number the code does not use.
- **Translate third-party exceptions at the module boundary.** A `better-sqlite3` or `express`
  error never escapes its module; every boundary throws an `AppError` subclass.
- **Never infer success from a status code alone.** Inspect the payload.
- **Never return an empty result to mask a failure.**
- **Resolve a path once, at the boundary**, and pass the resolved value down.
- **Every suppression needs a same-line reason** — `// eslint-disable-next-line ... — why`.
- **Verify a security control by breaking it first.** A control that passes while disabled was
  never tested. A validation test must show the bad input being rejected *and* that the same
  input would otherwise have been accepted.
- **Assert on identity, not counts.** Assert *which* reasons fired, never `reasons.length === 2`.
- **Reproduce before fixing, prove after fixing.** Every defect report carries the command and
  the measured output before and after.
- **Honest naming.** Without L4 built, the system is *rule-based + statistical anomaly
  detection*, never "machine learning". Synthetic data is labelled synthetic in every report.
  The tariff, emission factor and idle-hours numbers are assumptions and are shown as such.

## 4. Workflow

- Work in small, self-contained, verifiable steps, one at a time.
- **`project/server/api.test.ts` is the acceptance test for M1.** The real service must pass it
  unchanged, against the same contract the mock satisfies.
- Nothing is done until the gate in `ARCHITECTURE.md` §3 passes. **Paste real output.** Never
  describe a result you did not run.
- **Never push to `main`.** Work on a branch (`feat/...`, `fix/...`, `docs/...`).
- Commit after each completed step. Use the GitHub noreply address for `user.email`.
- Report honestly: show failures, and say plainly when a step was skipped or left unverified.
- End every response with one short line giving the verification command.

Gate, from `project/`:

```bash
npm ci && npm run typecheck && npm run lint && npm test && npm run build
```

If a Node tool is ever wrapped in `uv`, don't — `uv run` fails on this machine with
`Failed to query Python interpreter: Access is denied. (os error 5)`, because uv's interpreter
discovery probes the zero-byte Microsoft Store alias stubs under
`%LOCALAPPDATA%\Microsoft\WindowsApps\`. State which runner you used in every report.

## 5. Efficiency

- Be concise. No preambles, no restating the request, no summarising what the reader just wrote.
- Never re-read a file already in context. Never rewrite a whole file to change a few lines —
  show a diff or the affected function.
- When context is missing, stop and ask one or two sharp questions rather than guessing.

## 6. Communication

- Chat replies to the user are in **Thai**.
- Code, identifiers, comments, documentation and commit messages are in **English**.
- Strings the product shows users are Thai by design and are produced at the presentation
  boundary from reason codes — the contract's `reasons[]` carries them. Do not hard-code Thai
  prose deeper than that boundary.
- Skip pleasantries. Go straight to the technical answer or the command.
