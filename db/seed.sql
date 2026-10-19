-- Seed data CONTOH (admin wajib mengganti tarif!!).
-- Jalankan: psql -d bus_booking -f db/seed.sql

INSERT INTO settings(key, value) VALUES
  ('PO_NAME', 'PO Ceplis Mantap'),
  ('WA_NUMBER', '6281234567890'),
  ('DP_PERCENT', '30'),
  ('PELUNASAN_H', '3'),
  ('HOLD_HOURS', '24'),
  ('BUFFER_HOURS', '2')
ON CONFLICT (key) DO NOTHING;

-- Tarif CONTOH: admin wajib memperbarui!
INSERT INTO unit_types (name, seats, rate_per_day, image_url, facilities)
SELECT v.name, v.seats, v.rate_per_day, v.image_url, v.facilities::jsonb
FROM (VALUES
  ('Eksekutif Plus 18 Seat', 18, 1500000, '/buses/placeholder.svg', '["AC","Reclining Seat","Wifi","USB Charger"]'),
  ('Eksekutif Plus 32 Seat', 32, 2000000, '/buses/placeholder.svg', '["AC","Reclining Seat","Wifi","USB Charger","Toilet"]'),
  ('VIP 31 Seat', 31, 2500000, '/buses/placeholder.svg', '["AC Iceman","Reclining Seat 140°","Wifi","USB Charger","Toilet","Snack"]'),
  ('VIP 45 Seat', 45, 3500000, '/buses/placeholder.svg', '["AC Iceman","Reclining Seat 140°","Wifi","USB Charger","Toilet","Snack"]'),
  ('Ekonomi AC 48 Seat', 48, 1800000, '/buses/placeholder.svg', '["AC","Seat Kapal","Wifi"]')
) AS v(name, seats, rate_per_day, image_url, facilities)
WHERE NOT EXISTS (SELECT 1 FROM unit_types);

INSERT INTO units (type_id, plate)
SELECT t.id, 'CONTOH-B ' || LPAD((ROW_NUMBER() OVER ())::text, 3, '0')
FROM unit_types t
CROSS JOIN LATERAL (SELECT generate_series(1, 2) AS n) g
WHERE NOT EXISTS (SELECT 1 FROM units);

INSERT INTO crew (name, phone, role)
SELECT v.name, v.phone, v.role
FROM (VALUES
  ('CONTOH Bpk. Sutrisno', '6281234560001', 'driver'),
  ('CONTOH Bpk. Hendra', '6281234560002', 'driver'),
  ('CONTOH Bpk. Agus', '6281234560003', 'co_driver'),
  ('CONTOH Bpk. Yanto', '6281234560004', 'co_driver')
) AS v(name, phone, role)
WHERE NOT EXISTS (SELECT 1 FROM crew);
