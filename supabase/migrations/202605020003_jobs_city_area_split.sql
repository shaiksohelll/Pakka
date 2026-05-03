-- Sprint 2: Split location_text into city + area columns
-- Run this against your Supabase project via the Supabase Dashboard > SQL Editor

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS area text;

-- Backfill: parse existing location_text "area, city" → city/area columns
-- location_text was stored as "area, city" (comma-separated)
UPDATE jobs
SET
  area = CASE
    WHEN position(',' IN location_text) > 0
    THEN trim(split_part(location_text, ',', 1))
    ELSE NULL
  END,
  city = CASE
    WHEN position(',' IN location_text) > 0
    THEN trim(split_part(location_text, ',', 2))
    ELSE location_text
  END
WHERE location_text IS NOT NULL AND city IS NULL;

-- Add NOT NULL constraint after backfill (optional — only if all rows are filled)
-- ALTER TABLE jobs ALTER COLUMN city SET NOT NULL;

-- Add an index for city-based job searches
CREATE INDEX IF NOT EXISTS jobs_city_idx ON jobs(city);
