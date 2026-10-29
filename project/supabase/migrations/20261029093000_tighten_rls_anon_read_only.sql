/*
# K-SES: Reduce anon and authenticated to read-only (closes defect D1)

## Overview
Migrations 20261028140248 and 20261028140541 enabled RLS on `rooms`, `logs` and
`energy_readings`, then granted `SELECT, INSERT, UPDATE, DELETE` to `anon` and
`authenticated` with `USING (true)` / `WITH CHECK (true)`, documented there as
intentional for a dashboard with no sign-in.

The anon key is embedded in every browser bundle, so those grants make the
database writable by anyone who has the key. The key is in fact already public:
it is baked into `project/dist/assets/index-DRT4vokJ.js`, which is committed to
this repository's `main` history, and the repository is public. Any third party
can currently insert, overwrite or delete every row.

This migration removes the write surface. It is OWASP A01 (Broken Access
Control) and is the `0009_tighten_rls` step of ARCHITECTURE.md §2.9, brought
forward to run standalone against the existing tables instead of after the
normalised schema, because the exposure is live.

## Compatibility
Checked before writing this file: the committed build runs with
`isSupabaseConfigured` inlined to `false` (`const ym=!1` in the bundle), and the
bundle contains no table-name string, because Vite dead-code-eliminated every
query path. **The current deployed frontend therefore performs no Supabase read
or write and is unaffected by this migration.**

Reads stay open, so a build with `VITE_LOCAL_MODE=false` keeps working for
display. The browser write paths in `project/src/lib/api.ts` — `upsertRoom`,
`insertLog`, `deleteRoom`, `clearLogs` — will return a `42501 permission denied`
error once this is applied. That is the intended end state: writes move to the
backend service (ARCHITECTURE.md IMPL-5). Until that service exists, run the
simulator in local mode (`VITE_LOCAL_MODE` unset or `true`, the default).

## Changes
1. Revoke `INSERT`, `UPDATE`, `DELETE` on all three tables from `anon` and
   `authenticated`. `SELECT` is retained.
2. Drop the per-verb write policies, so the catalog stops advertising a write
   path that the grants no longer permit.
3. Recreate the `SELECT` policies with a comment recording why `USING (true)`
   is correct here: the rows are intentionally public dashboard data.
4. Grant `service_role` the full set, for the backend service that will own
   writes.
5. Revoke the schema-level default privileges that would otherwise re-grant
   write access to `anon` on any table created later.

## Security
- Defence at both layers: the grant is removed **and** the policy is dropped.
  RLS with no policy for a verb already denies it; the revoke means the request
  is refused before RLS is consulted.
- `USING (true)` survives only on `SELECT`, each occurrence commented.
- Nothing here weakens a control to make anything pass, and no application code
  is edited to accommodate it.

## This migration does NOT end the exposure on its own
The leaked anon token stays valid until it is rotated. After applying this,
rotate the anon key and the JWT secret in the Supabase dashboard, then review
the three tables for rows written by a third party while the grants were open.
Purging `project/dist/` from git history is secondary: the token is already
public, so rotation is what ends the exposure.

## Verification
Run the block at the bottom of this file. Test 1 must FAIL after this migration
and must SUCCEED before it — that is the proof the control is real rather than
merely present. Do not run the "before" case against a database whose contents
matter: it writes a row.
*/

-- ---------------------------------------------------------------------------
-- 1. Revoke write grants. SELECT is deliberately retained.
-- ---------------------------------------------------------------------------

REVOKE INSERT, UPDATE, DELETE ON rooms            FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON logs             FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON energy_readings  FROM anon, authenticated;

GRANT SELECT ON rooms            TO anon, authenticated;
GRANT SELECT ON logs             TO anon, authenticated;
GRANT SELECT ON energy_readings  TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Drop the write policies created by the two earlier migrations.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "anon_insert_rooms" ON rooms;
DROP POLICY IF EXISTS "anon_update_rooms" ON rooms;
DROP POLICY IF EXISTS "anon_delete_rooms" ON rooms;

DROP POLICY IF EXISTS "anon_insert_logs" ON logs;
DROP POLICY IF EXISTS "anon_update_logs" ON logs;
DROP POLICY IF EXISTS "anon_delete_logs" ON logs;

DROP POLICY IF EXISTS "anon_insert_energy_readings" ON energy_readings;
DROP POLICY IF EXISTS "anon_update_energy_readings" ON energy_readings;
DROP POLICY IF EXISTS "anon_delete_energy_readings" ON energy_readings;

-- ---------------------------------------------------------------------------
-- 3. Read policies, restated explicitly.
-- ---------------------------------------------------------------------------

ALTER TABLE rooms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_readings  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_rooms" ON rooms;
CREATE POLICY "anon_select_rooms" ON rooms FOR SELECT
  TO anon, authenticated USING (true);  -- public dashboard data: every row is meant to be readable

DROP POLICY IF EXISTS "anon_select_logs" ON logs;
CREATE POLICY "anon_select_logs" ON logs FOR SELECT
  TO anon, authenticated USING (true);  -- public dashboard data: every row is meant to be readable

DROP POLICY IF EXISTS "anon_select_energy_readings" ON energy_readings;
CREATE POLICY "anon_select_energy_readings" ON energy_readings FOR SELECT
  TO anon, authenticated USING (true);  -- public dashboard data: every row is meant to be readable

-- ---------------------------------------------------------------------------
-- 4. The backend service owns writes.
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON rooms            TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON logs             TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON energy_readings  TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Stop future tables from inheriting write access for anon.
--    Default privileges are per granting role, so this must run as the role
--    that creates tables in `public` (on Supabase: `postgres`). If it is run
--    as anything else it is a no-op rather than an error, so confirm with the
--    `pg_default_acl` query in the verification block below.
-- ---------------------------------------------------------------------------

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated;

-- ===========================================================================
-- VERIFICATION
-- ===========================================================================
--
-- a) No write grant survives for anon or authenticated. Expect ZERO rows.
--
--    SELECT grantee, table_name, privilege_type
--      FROM information_schema.role_table_grants
--     WHERE table_schema = 'public'
--       AND grantee IN ('anon', 'authenticated')
--       AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
--     ORDER BY table_name, grantee, privilege_type;
--
-- b) Only SELECT policies remain for those roles. Expect `cmd = 'SELECT'`
--    on every row.
--
--    SELECT tablename, policyname, cmd, roles
--      FROM pg_policies
--     WHERE schemaname = 'public'
--     ORDER BY tablename, policyname;
--
-- c) Step 5 actually applied. Expect a row whose defaclacl shows no
--    INSERT/UPDATE/DELETE (a/w/d) for anon.
--
--    SELECT defaclrole::regrole, defaclnamespace::regnamespace, defaclacl
--      FROM pg_default_acl;
--
-- d) BREAK IT FIRST. Run this against a scratch project BEFORE applying the
--    migration: it must return 201, proving the control was closing something
--    real. Then apply, and run it again: it must return 401 or 403. A 2xx
--    after the migration is a failed gate.
--
--    curl -i -X POST "$SUPABASE_URL/rest/v1/logs" \
--      -H "apikey: $SUPABASE_ANON_KEY" \
--      -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
--      -H "Content-Type: application/json" \
--      -d '{"level":"info","tag":"[RLSTEST]","message":"negative control test"}'
--
-- e) Reads must still work. Expect 200 with a JSON array.
--
--    curl -i "$SUPABASE_URL/rest/v1/rooms?select=id,status&limit=1" \
--      -H "apikey: $SUPABASE_ANON_KEY" \
--      -H "Authorization: Bearer $SUPABASE_ANON_KEY"
--
-- f) Delete must fail too. Expect 401/403, and `rooms` unchanged afterwards.
--
--    curl -i -X DELETE "$SUPABASE_URL/rest/v1/rooms?id=eq.ecc-402" \
--      -H "apikey: $SUPABASE_ANON_KEY" \
--      -H "Authorization: Bearer $SUPABASE_ANON_KEY"
--
-- g) Audit for tampering while the grants were open. Rows the simulator never
--    created, or timestamps outside your own use, are suspect.
--
--    SELECT zone, count(*), min(last_updated), max(last_updated)
--      FROM rooms GROUP BY zone ORDER BY zone;
--    SELECT tag, count(*), min(ts), max(ts) FROM logs GROUP BY tag ORDER BY tag;
--
-- ===========================================================================


-- ===========================================================================
-- DOWN
--
-- WARNING: this restores the insecure state of migrations 20261028140248 and
-- 20261028140541 — unauthenticated full CRUD for anyone holding the anon key.
-- Use it only to unblock a rollback, and only on a database that holds nothing
-- you care about. Prefer fixing forward.
--
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public
--   GRANT INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
--
-- GRANT INSERT, UPDATE, DELETE ON rooms           TO anon, authenticated;
-- GRANT INSERT, UPDATE, DELETE ON logs            TO anon, authenticated;
-- GRANT INSERT, UPDATE, DELETE ON energy_readings TO anon, authenticated;
--
-- CREATE POLICY "anon_insert_rooms" ON rooms FOR INSERT
--   TO anon, authenticated WITH CHECK (true);
-- CREATE POLICY "anon_update_rooms" ON rooms FOR UPDATE
--   TO anon, authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "anon_delete_rooms" ON rooms FOR DELETE
--   TO anon, authenticated USING (true);
--
-- CREATE POLICY "anon_insert_logs" ON logs FOR INSERT
--   TO anon, authenticated WITH CHECK (true);
-- CREATE POLICY "anon_update_logs" ON logs FOR UPDATE
--   TO anon, authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "anon_delete_logs" ON logs FOR DELETE
--   TO anon, authenticated USING (true);
--
-- CREATE POLICY "anon_insert_energy_readings" ON energy_readings FOR INSERT
--   TO anon, authenticated WITH CHECK (true);
-- CREATE POLICY "anon_update_energy_readings" ON energy_readings FOR UPDATE
--   TO anon, authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "anon_delete_energy_readings" ON energy_readings FOR DELETE
--   TO anon, authenticated USING (true);
-- ===========================================================================
