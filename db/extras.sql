-- Constraint di luar kemampuan drizzle-kit push.
-- Jalankan: biz db/extras.sql  (lihat README)
-- Menjamin satu unit TIDAK BISA punya dua hold yang overlap (proteksi race di level DB).

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE holds
  ADD CONSTRAINT no_overlap
  EXCLUDE USING gist (
    unit_id WITH =,
    tstzrange(created_at, hold_until, '[)') WITH &&
  );

CREATE INDEX IF NOT EXISTS quotes_status_idx ON quotes (status);
CREATE INDEX IF NOT EXISTS holds_unit_idx ON holds (unit_id);
CREATE UNIQUE INDEX IF NOT EXISTS holds_unit_quote_uq ON holds (quote_id, unit_id);
