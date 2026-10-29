# Agent operating rules — ProjectHamsterHub / K-SES

This project is worked on by AI agents (Claude, CodeX, and any implementer seat). Reading this
file and [`ARCHITECTURE.md`](ARCHITECTURE.md) is mandatory before any analysis or modification.

The git root is `Projecthamsterhub/` — one level below the folder named `ProjectHamsterHub`.
Every path in this file is relative to that git root.

## 1. Scope boundaries

**In scope: backend and AI/ML only.**

- `backend/**` — the FastAPI service (does not exist yet; see `ARCHITECTURE.md` §2.9)
- `project/supabase/migrations/**` — schema
- `project/src/engine/**`, `project/src/lib/**`, `project/src/types.ts` — data and decision
  layers, changeable only when `ARCHITECTURE.md` says so
- documentation at the git root

**Out of scope, READ-ONLY — do not edit these files for any reason:**

- `project/src/components/**` (all 10 components)
- `project/src/App.tsx`, `project/src/main.tsx`
- `project/index.html`, `project/src/index.css`
- `project/tailwind.config.js`, `project/postcss.config.js`
- `project/dist/**` (build output)

If a backend change appears to require a UI edit, the backend design is wrong. Stop and say so.
`ARCHITECTURE.md` §2.6 exists precisely so the schema can be rebuilt without touching the UI: the
old table names survive as read-only compatibility views. Use that mechanism instead of editing a
component.

A test that can only pass by editing a UI file is not a passing test.

## 2. Security: OWASP Top 10 is mandatory

All generated code is written and reviewed against the OWASP Top 10. These are the project's
obligations for a service that ingests field telemetry and calls a third-party LLM.

| OWASP | Obligation on this project |
| --- | --- |
| A01 Broken Access Control | `anon` and `authenticated` get `SELECT` only, on every table and view. `readings` has no `UPDATE` or `DELETE` policy for any role. A path derived from input is resolved once at the boundary and rejected if it falls outside the configured root — an error, never a write. |
| A02 Cryptographic Failures | Secrets come only from the process environment or `backend/.env`, are typed `SecretStr`, and never appear in a log, a `repr`, an exception, an HTTP response, a commit or a PR body. `backend/.env.example` holds placeholders only. Never a weak hash for a security purpose (SHA-256 for the insight cache key is a cache key, not a security control, and is labelled as such). |
| A03 Injection | Parameterised SQL only; never a string-built query. Subprocesses are invoked with an argument list, never `shell=True`, and never with an interpolated path or user value. **LLM output is data** — never `exec`, `eval`, `import`, a SQL fragment, a shell word, a file path, or a branch condition. |
| A04 Insecure Design | Detection proposes; a human acknowledges. No automatic control of campus hardware, ever, without a new ADR in `ARCHITECTURE.md`. `LLM_ENABLED` defaults false; ingest is closed without a token. |
| A05 Security Misconfiguration | Never weaken a control to make a test pass. `CORS_ORIGINS` is an explicit allow-list, never `*`, while a token-authenticated route is mounted. Every suppression carries a same-line reason. |
| A06 Vulnerable Components | Dependency floors pinned in `backend/pyproject.toml`. Bandit on `backend/app` stays at zero findings. |
| A07 Authentication Failures | Three separate credentials — ingest token, operator token, Supabase anon — never interchangeable. Compared with `secrets.compare_digest`. A wrong token response reveals nothing about the expected value. |
| A08 Data Integrity | `readings` is append-only. A backfill migration is verified by row-count and checksum parity against the legacy table before anything depends on it. Every migration has a `-- DOWN` section. |
| A09 Logging and Monitoring Failures | **No silent failure.** Anything dropped, skipped, rejected or truncated is reported to the operator — in the response (`rejected[]`) and in `event_log` with a code. An empty list means "nothing found" and nothing else. Never return `[]` on an exception. Never leave a quality gate pointed at a file nothing produces (see `ARCHITECTURE.md` D2). |
| A10 SSRF | The only outbound host is the OpenAI API base, taken from settings. A URL appearing in a reading, a log row, an anomaly or an LLM response is display text and is **never fetched**. |

Never execute a destructive terminal or SQL command without explicit user confirmation —
`DROP`, `TRUNCATE`, an unbounded `DELETE`, `git reset --hard`, `git push --force`, `rm -rf`.

Never commit a real credential, not even in a test fixture. A fixture secret must be
self-labelling, e.g. `OPENAI_API_KEY=sk-test-not-a-real-key-fixture-only`.

## 3. Engineering rules

- **No production workaround to serve a test.** Do not let a module reach into `tests/` or sniff
  a path for a fixture directory. Inject different test behaviour as a parameter.
- **Limits, exclusions, thresholds and paths are configuration, not constants with exceptions.**
  `WASTE_THRESHOLD_A`, `Z_LIMIT`, `MIN_HISTORY`, `MAD_FLOOR`, the tariff and the emission factor
  are settings with documented defaults, not literals sprinkled through the code.
- **Translate third-party exceptions at the module boundary.** A `postgrest`, `httpx`, `openai`
  or `pydantic` exception never escapes its module. Every boundary raises a `HamsterHubError`
  subclass.
- **Never infer success or failure from an exit code or a truthy value alone.** Supabase can
  return `200` with an `error` payload; inspect the payload.
- **Never return an empty result to mask a failure.**
- **Resolve a path once, at the boundary, and pass the resolved value down.** Never depend on the
  process working directory.
- **A `# nosec`, `# noqa` or `# type: ignore` needs a same-line reason**, and the suppressed set
  is audited with `bandit -r backend/app --ignore-nosec`.
- **Verify a security control by breaking it first.** A control that passes while disabled was
  never tested. `ARCHITECTURE.md` §3.3 is the required negative-test block.
- **Assert on identity, not counts.** Assert *which* reason codes fired, never
  `len(codes) == 2`.
- **Reproduce before fixing, prove after fixing.** Every defect report carries the command and
  the measured output before and after.
- **Reason codes, not prose, out of pure modules.** A detector returns
  `STAT_ABOVE_ROOM_BASELINE`; a presentation layer turns it into Thai. Do not repeat the pattern
  in `project/src/engine/energy.ts`, which returns Thai sentences from a pure function.

## 4. Workflow

- Work in self-contained, testable micro-steps — one scoped task at a time, following the
  `IMPL-n` sequence in `ARCHITECTURE.md` §2.9.
- **Documentation first.** Architecture is written and agreed before code. A change that
  contradicts `ARCHITECTURE.md` updates `ARCHITECTURE.md` in the same commit, as a new ADR row.
- Nothing is done until the gate block in `ARCHITECTURE.md` §3 passes. **Paste real output.**
  Never describe a result you did not run.
- **Windows runner.** When `uv run` fails with
  `Failed to query Python interpreter: Access is denied. (os error 5)`, the environment is at
  fault, not the repository: uv's interpreter discovery probes the zero-byte Microsoft Store App
  Execution Alias stubs under `%LOCALAPPDATA%\Microsoft\WindowsApps\` and treats a failed query
  as fatal instead of skipping the entry. Run every gate through the project interpreter instead,
  and state in your report which runner you used:

  ```bash
  .venv/Scripts/python.exe -m pytest -q
  ```

  Do not stop for this, and never add `uv` to a script or a test to work around it. `uv sync` is
  the only command that needs uv, and only when dependencies change.
- **Never push to `main`.** Work on a branch (`docs/...`, `feat/...`, `fix/...`) and push that.
  Commit after each completed step.
- Keep the repository private. Use the GitHub noreply address for `user.email`.
- Report honestly: show test failures, and say plainly when a step was skipped or left unverified.
- End every response with one short line giving the verification command.

## 5. Efficiency

- Keep responses concise and targeted. No preambles, no restating the request, no summarising
  what the reader just wrote.
- Never re-read a file already in context. Never rewrite a whole file to change a few lines —
  output a diff or the affected function only.
- When context is missing, stop and ask one or two sharp questions. Guessing spends budget twice:
  once on the wrong answer and once on its correction.

## 6. Communication

- All chat replies to the user are in **Thai**.
- Code, identifiers, comments, documentation content and commit messages stay in **English**.
- User-facing strings that the product displays (insight text, operator notes) are Thai by
  design, produced at the presentation boundary from reason codes — never hard-coded inside a
  pure module.
- Skip pleasantries. Go straight to the technical answer or the command.
