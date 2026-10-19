-- Constraint di luar kemampuan drizzle-kit push.
-- Idempotent — aman dijalankan ulang setelah push skema.
-- Menjamin satu unit TIDAK BISA punya dua hold yang overlap pada rentang occupied
-- [trip start .. trip end + buffer), proteksi race di level DB.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE holds DROP CONSTRAINT IF EXISTS no_overlap;

ALTER TABLE holds
  ADD CONSTRAINT no_overlap
  EXCLUDE USING gist (
    unit_id WITH =,
    tstzrange(occupied_from, occupied_until, '[)') WITH &&
  );

DROP INDEX IF EXISTS quotes_status_idx; CREATE INDEX IF NOT EXISTS quotes_status_idx ON quotes (status);
DROP INDEX IF EXISTS holds_unit_idx; CREATE INDEX IF NOT EXISTS holds_unit_idx ON holds (unit_id);
DROP INDEX IF EXISTS holds_unit_quote_uq; CREATE UNIQUE INDEX IF NOT EXISTS holds_unit_quote_uq ON holds (quote_id, unit_id);
