# SPEC: Web Reservasi Sewa Bus (1 PO, WhatsApp Handoff)

Source of truth: BRIEF FINAL (disetujui user, 2026-10-19). Dokumen ini menambahkan keputusan teknis.

## Objective
- Satu PO bus: inquiry WhatsApp → quote → hold → DP → SPK → dispatch H-1 → feedback.
- Bukan tiket per kursi. Tanpa payment gateway, tanpa Cloud API, tanpa bot, tanpa multi-tenant.
- Tampilan mengikuti referensi desain (mobile-first, light gray, kartu putih rounded, pill button gelap) **hanya bahasa visualnya**; pola seat-map/per-orang/jadwal reguler TIDAK dipakai.
- Baru (permintaan user): setiap tipe unit menampilkan **foto bus + daftar fasilitas** (AC, wifi, toilet, USB, dll) di form pilihan dan detail.

## Keputusan teknis (delta dari brief)
| Keputusan | Alasan |
|---|---|
| Drizzle ORM + PostgreSQL 17 (service lokal sudah ada) | DB constraint anti-overlap (EXCLUDE USING gist) hanya masuk akal di Postgres |
| Komponen UI ditulis sendiri (bukan shadcn) | Butuh card/input/button/pill saja; menarik radix tidak sepadan |
| SPK = halaman HTML siap cetak (Ctrl+P → PDF), bernomor | Tanpa dependensi PDF; tetap "SPK PDF bernomor" secara proses |
| Expire hold **lazily on read** (sweepExpired), tanpa scheduler | Satu admin, volume kecil; auto-send WA adalah non-goal |
| Playwright diadopsi setelah fitur inti stabil | Prioritas: unit test dulu, E2E smoke belakangan |
| Auth admin = cookie bertanda HMAC + ADMIN_PASSWORD env | Satu role; tanpa dependensi auth framework |

## Commands
- Dev: `npm run dev` (http://localhost:3000)
- Build: `npm run build` · Lint: `npm run lint` · Test: `npm test`
- DB: `npm run db:push` (drizzle-kit push) + SQL manual `db/extras.sql` (constraint gist)

## Struktur
```
src/app            → halaman (app router): publik, admin, feedback
src/db/schema.ts   → skema Drizzle
src/lib            → estimate, availability, wa-template, status, auth (logika murni, dapat diuji)
tests/ atau *.test.ts → Vitest (unit + integrasi DB)
db/extras.sql      → constraint yang di luar kemampuan drizzle-kit push
public/buses/      → foto bus (admin mengisi path/gambar)
```

## Data model
- `unit_types` (name, seats, rate_per_day IDR, image_url, facilities[], active)
- `units` (plate, type_id, active)
- `quotes` (code Q-YYYY-XXXX, PIC, phone, origin, destination, pickup_point, standby_time,
  start_at, end_at, pax, luggage_note, unit_count, type_id, estimate, final_price,
  status, hold_until, extend_reason, spk_number, notes, contacted_at)
- `holds` (quote_id, unit_id, hold_until, created_at) → **aturan anti-overlap di level DB**
- `payments` (quote_id, kind dp|pelunasan, amount, paid_at, proof_url, verified_at)
- `crew` (name, phone, role driver|co_driver, active); `assignments` (quote_id, crew_id, sent_at)
- `feedback` (quote_id, token unik, rating, comment, submitted_at)
- `settings` (key, value): PO_NAME, WA_NUMBER, DP_PERCENT, PELUNASAN_H, BUFFER_HOURS

## Status & transisi
`quoted → held → dp_paid → confirmed → spk_issued → dispatched → completed`;
cabang `cancelled` (dari status mana pun) dan `expired` (hold lewat; sweep on read).
- hold: hanya admin, dari quoted/expired, pilih unit konkret; hold lembut = now+24 jam; extend wajib alasan.
  Saat DP terverifikasi: `convertHoldToHardLock` kunci unit sampai trip selesai + buffer.
- dp_paid: DP terverifikasi; konfirmasi.

## Aturan bisnis
- Estimasi: `rate_per_day × ceil(jam/24) × unit_count`; 63 jam = 3 hari.
- Ketersediaan = indikatif; buffer 2 jam; tidak otomatis mengunci unit.
- Pax ≤ seats × unit_count; peringatan bila mendekati kapasitas.
- IDR integer; timezone Asia/Jakarta; tanggal = timestamptz.
- Email tidak dikumpulkan (tidak dipakai).
- Tarif = placeholder berlabel CONTOH; admin wajib mengganti.
- Template WA: encodeURIComponent, ±<1500 karakter, nomor dari settings, tanpa tracking; admin
  menandai "sudah dihubungi" manual.
- Catatan harga wajib: "Harga belum termasuk tol, parkir, retribusi wisata, dan tips kru."

## Non-goals
Seat map, tiket per kursi, gateway, Cloud API, bot, multi-PO, multi-tipe per order,
role kompleks, kalender maintenance, auto-send WA, rekomendasi otomatis alternatif.

## Success criteria / Bukti
- Test: estimasi (63 jam = 3 hari, pembulatan, multi-unit), template WA (encoding/panjang),
  konkurensi hold unit terakhir (tepat satu berhasil), overlap ditolak DB, expiry hold, transisi status.
- Build + lint + test hijau; alur publik manual verify via dev server.
