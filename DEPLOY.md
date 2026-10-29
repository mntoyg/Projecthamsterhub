# Deploying K-SES

Two things ship separately:

| Part | What it is | Where it goes |
| --- | --- | --- |
| Dashboard | static files from `npm run build` | any static host (Vercel, Netlify, Cloudflare Pages) |
| API | the Express + SQLite service in `project/server` | any host that takes a Dockerfile (Render, Railway, Fly.io, a VPS) |

They are wired together by two settings, and the order matters because each needs
the other's URL:

1. Deploy the **API** first. It starts with `CORS_ORIGINS` empty, which accepts any
   origin and logs a warning — fine for a few minutes, not fine to leave.
2. Build the **dashboard** with `VITE_API_URL` set to the API's URL. This is a
   **build-time** variable: Vite bakes it into the bundle, so changing it later
   means rebuilding, not restarting.
3. Set the API's `CORS_ORIGINS` to the dashboard's origin and redeploy the API.

If the site is served over HTTPS, the API must be HTTPS too. A browser blocks an
HTTPS page calling an HTTP API, and the dashboard will sit on `OFFLINE` with
nothing obviously wrong in the UI.

---

## API

The image is portable on purpose — no host is baked into the repository.

```bash
cd project
docker build -t k-ses-api .
docker run -p 8787:8787 -e CORS_ORIGINS=https://your-dashboard.example k-ses-api
```

### On Render

Checked against Render's own documentation on 2026-10-29.

1. New → **Web Service**, connect this GitHub repository, pick the branch.
2. **Language**: `Docker`. Render's docs say to choose this even when the app's
   language appears in the dropdown.
3. **Root Directory**: `project` — the repository root has no `package.json`.
4. **Dockerfile Path**: `Dockerfile`.
   Render's own pages contradict each other here: the monorepo page says these
   paths are relative to the Root Directory, the blueprint spec says relative to
   the repo root. If the build reports it cannot find the Dockerfile, clear Root
   Directory and set Dockerfile Path to `project/Dockerfile` instead.
5. **Health Check Path**: `/api/health`
6. **Environment variables**: `CORS_ORIGINS` = the dashboard's origin, once it
   exists. Leave `PORT` alone — Render injects its own (default `10000`) and the
   server reads it. `DB_FILE` already has a working default in the image.

Railway and Fly.io take the same Dockerfile; only the UI differs.

### Render free tier, from the docs

- **No persistent disk.** Free web services cannot attach one. Anything written
  inside the container — the SQLite file included — is lost on every redeploy,
  restart and spin-down.
- **Spins down after 15 minutes** without inbound traffic; spin-up is about a
  minute, during which visitors see a loading page and the dashboard reads
  `OFFLINE`.
- **750 free instance hours per workspace per month.** Past that, free services
  are suspended until the next month.
- Render may restart a free service at any time.
- The service must bind `0.0.0.0`. `server/index.ts` does so explicitly.

### Settings the image reads

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `8787` | hosts that inject their own `PORT` are respected |
| `DB_FILE` | `/data/k-ses.db` | `/data` is a volume in the image |
| `CORS_ORIGINS` | *(empty)* | comma-separated allow-list. Empty accepts any origin and warns at startup |
| `BASELINE_K` | `6` | L3 sensitivity; see ARCHITECTURE.md §2.5 |
| `MAX_BODY_BYTES` | `10000` | the contract's 10 KB cap |
| `READINGS_MAX_LIMIT` | `500` | |

---

## Dashboard

Static build, no server.

```bash
cd project
VITE_API_URL=https://your-api.example npm run build   # output: project/dist
```

On Vercel / Netlify / Cloudflare Pages: root directory `project`, build command
`npm run build`, output directory `dist`, and set `VITE_API_URL` as a build
environment variable.

With `VITE_API_URL` unset the dashboard runs in local mode: the simulator runs in
the browser, nothing is shared between visitors, and no API is needed. That mode
cannot fall over, so it is the safer choice when the audience only watches one
screen.

---

## Two things that will bite, stated plainly

**The database is ephemeral.** SQLite lives on the container's disk. On a free
tier with no persistent volume, every deploy and every restart wipes it: the six
demo rooms reseed and all history is gone. That is acceptable for a demo and must
not be described as a database that keeps data. To keep it, attach a persistent
disk and point `DB_FILE` at it.

**Free tiers sleep.** Render's free web services spin down after 15 minutes
without traffic, and the next request pays a cold start of about a minute. During
that minute the dashboard shows `OFFLINE`. Before presenting, either wake it with
a request a few minutes ahead, or use a plan that stays up, or run the API
locally and skip the network entirely:

```bash
cd project && npm run server
```

---

## Verifying a deployment

Replace the URL and run all of it. Items 3 and 4 must **fail**; a 2xx there means
the deployment is not doing what this file claims.

```bash
API=https://your-api.example

# 1. alive
curl -i "$API/api/health"                      # 200 {"ok":true}

# 2. analysis works end to end
curl -i -X POST "$API/api/telemetry" -H 'Content-Type: application/json' \
  -d '{"building":"ECC Building","roomNumber":"402","current":20,"voltage":220,"motion":false}'
                                               # 200, status "Energy Waste"

# 3. bad input is refused, and the server stays up
curl -i -X POST "$API/api/telemetry" -H 'Content-Type: application/json' \
  -d '{"building":"ECC","roomNumber":"","current":-1,"motion":"yes"}'
                                               # 400 with errors[]
curl -i "$API/api/health"                      # still 200

# 4. CORS is an allow-list, not a wildcard
curl -sD - -o /dev/null -H "Origin: https://evil.example" "$API/api/health" \
  | grep -i access-control-allow-origin        # must print NOTHING
curl -sD - -o /dev/null -H "Origin: https://your-dashboard.example" "$API/api/health" \
  | grep -i access-control-allow-origin        # must print the dashboard origin
```

Item 4 is the one worth running twice. A CORS allow-list that was never tested
against a disallowed origin has not been tested at all.

---

## Verified locally, 2026-10-29

Built and run from the Dockerfile in this repository, production install only
(`npm ci --omit=dev`), nothing from devDependencies present:

```
docker build -t k-ses-api:test .                 -> built
docker run -p 8788:8787 -e CORS_ORIGINS=https://example-dashboard.test ...
container status                                 -> Up (healthy)
log: {"level":"info","event":"listening","url":"http://localhost:8787","db":"/data/k-ses.db"}

GET  /api/health                                 -> 200 {"ok":true}
POST /api/telemetry 20 A motion=false            -> 200 "Energy Waste", id ecc-building-402
GET  /api/rooms                                  -> 7 rooms
POST bad payload                                 -> 400
GET  /api/nope                                   -> 404
Origin: https://example-dashboard.test           -> Access-Control-Allow-Origin: https://example-dashboard.test
Origin: https://evil.test                        -> no header (correctly refused)
```

This proves the image runs and serves. It does not prove any particular host
accepts it; that step needs an account and is done from the host's own dashboard.
