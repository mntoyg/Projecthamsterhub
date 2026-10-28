/*
# K-SES: Add energy_readings table for historical chart data

## Overview
Adds a table to store periodic energy readings per room, used to render
the energy history chart. Each telemetry push also inserts a reading here.

## 1. New Tables

### energy_readings
- id (uuid, primary key)
- room_id (text) — references rooms.id loosely (no FK to allow simulator rows)
- building (text)
- room_number (text)
- current (numeric) — amps at time of reading
- power (numeric) — computed kW = current * 220 / 1000
- status (text) — "Normal" or "Energy Waste"
- ts (timestamptz, default now()) — reading timestamp

## 2. Indexes
- energy_readings_ts_idx on ts desc — chart ordering
- energy_readings_room_idx on room_id, ts desc — per-room history

## 3. Security
- RLS enabled.
- Grant CRUD to anon, authenticated (public shared dashboard).
- 4 per-verb policies with USING(true) — intentionally public data.
*/

CREATE TABLE IF NOT EXISTS energy_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  building text NOT NULL,
  room_number text NOT NULL,
  current numeric(8,2) NOT NULL DEFAULT 0,
  power numeric(10,3) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Normal',
  ts timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS energy_readings_ts_idx ON energy_readings (ts DESC);
CREATE INDEX IF NOT EXISTS energy_readings_room_idx ON energy_readings (room_id, ts DESC);

ALTER TABLE energy_readings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON energy_readings TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_energy_readings" ON energy_readings;
CREATE POLICY "anon_select_energy_readings" ON energy_readings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_energy_readings" ON energy_readings;
CREATE POLICY "anon_insert_energy_readings" ON energy_readings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_energy_readings" ON energy_readings;
CREATE POLICY "anon_update_energy_readings" ON energy_readings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_energy_readings" ON energy_readings;
CREATE POLICY "anon_delete_energy_readings" ON energy_readings FOR DELETE
  TO anon, authenticated USING (true);
