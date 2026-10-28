/*
# K-SES: Create rooms and logs tables

## Overview
Creates the data store for the KMITL Smart Energy Saver (K-SES) real-time dashboard.
The app is a single-tenant shared dashboard (no sign-in), so anon + authenticated
roles are granted CRUD and policies use USING (true) for intentionally public data.

## 1. New Tables

### rooms
Stores the live state of each monitored classroom.
- id (text, primary key) — composite slug like "ecc-building-402"
- building (text) — e.g. "ECC Building"
- room_number (text) — e.g. "402"
- current (numeric, default 0) — current draw in amps
- motion (boolean, default false) — motion sensor state
- status (text, default 'Normal') — "Normal" or "Energy Waste"
- zone (text) — zone label, e.g. "Engineering"
- last_updated (timestamptz) — last telemetry update time
- created_at (timestamptz, default now())

### logs
Stores console log entries for the System Live Logs panel.
- id (uuid, primary key)
- ts (timestamptz, default now()) — timestamp of the event
- level (text) — "success" | "error" | "info" | "warn"
- tag (text) — e.g. "[MESH]", "[AI]", "[NODE]"
- message (text)
- created_at (timestamptz, default now())

## 2. Indexes
- rooms_last_updated_idx on rooms(last_updated desc) — dashboard ordering
- logs_created_at_idx on logs(created_at desc) — log retrieval

## 3. Security
- RLS enabled on both tables.
- Grant CRUD to anon, authenticated (no-auth shared dashboard).
- 4 per-verb policies per table using USING (true) / WITH CHECK (true),
  documented as intentionally public shared data.
*/

CREATE TABLE IF NOT EXISTS rooms (
  id text PRIMARY KEY,
  building text NOT NULL,
  room_number text NOT NULL,
  current numeric(8,2) NOT NULL DEFAULT 0,
  motion boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'Normal',
  zone text NOT NULL DEFAULT 'Engineering',
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rooms_last_updated_idx ON rooms (last_updated DESC);

CREATE TABLE IF NOT EXISTS logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  level text NOT NULL DEFAULT 'info',
  tag text NOT NULL DEFAULT '[SYS]',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS logs_created_at_idx ON logs (created_at DESC);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- rooms grants + policies (intentionally public shared dashboard data)
GRANT SELECT, INSERT, UPDATE, DELETE ON rooms TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_rooms" ON rooms;
CREATE POLICY "anon_select_rooms" ON rooms FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_rooms" ON rooms;
CREATE POLICY "anon_insert_rooms" ON rooms FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_rooms" ON rooms;
CREATE POLICY "anon_update_rooms" ON rooms FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_rooms" ON rooms;
CREATE POLICY "anon_delete_rooms" ON rooms FOR DELETE
  TO anon, authenticated USING (true);

-- logs grants + policies (intentionally public shared dashboard data)
GRANT SELECT, INSERT, UPDATE, DELETE ON logs TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_logs" ON logs;
CREATE POLICY "anon_select_logs" ON logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_logs" ON logs;
CREATE POLICY "anon_insert_logs" ON logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_logs" ON logs;
CREATE POLICY "anon_update_logs" ON logs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_logs" ON logs;
CREATE POLICY "anon_delete_logs" ON logs FOR DELETE
  TO anon, authenticated USING (true);

-- Seed initial rooms
INSERT INTO rooms (id, building, room_number, current, motion, status, zone) VALUES
  ('ecc-402', 'ECC Building', '402', 3.2, true, 'Normal', 'Engineering'),
  ('ecc-403', 'ECC Building', '403', 12.8, false, 'Energy Waste', 'Engineering'),
  ('it-105', 'IT Building', '105', 2.1, true, 'Normal', 'Information Tech'),
  ('it-204', 'IT Building', '204', 8.6, false, 'Energy Waste', 'Information Tech'),
  ('ee-lab-1', 'EE Building', 'Lab 1', 1.8, true, 'Normal', 'Electrical'),
  ('me-301', 'ME Building', '301', 4.4, false, 'Normal', 'Mechanical')
ON CONFLICT (id) DO NOTHING;

-- Seed boot logs
INSERT INTO logs (ts, level, tag, message) VALUES
  (now() - interval '3 seconds', 'info', '[BOOT]', 'K-SES core initialized · AI engine online'),
  (now() - interval '2 seconds', 'success', '[MESH]', 'Connected to 6 IoT nodes across KMITL campus'),
  (now() - interval '1 second', 'info', '[AI]', 'Energy optimization model loaded (v3.2)')
ON CONFLICT DO NOTHING;
