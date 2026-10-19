# Bus Booking System (1 PO, WhatsApp Handoff)

Web reservasi sewa bus untuk **satu PO**: inquiry publik → quote → hold unit → DP → SPK → dispatch H-1 → feedback H+1. Bukan tiket per-kursi; sewa per unit per blok 24 jam. Spesifikasi lengkap: [`SPEC.md`](./SPEC.md).

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind v4 · PostgreSQL 17 + Drizzle · Zod · Vitest. Tanpa payment gateway / WhatsApp Cloud API — konfirmasi tetap lewat `wa.me` (link prefilled).

## Setup (Windows, lokal)

1. **Database** — PostgreSQL service berjalan (port 5432). Buat DB dev + test:

   ```powershell
   $env:PGPASSWORD='admin123'
   & 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U postgres -c "CREATE DATABASE bus_booking"
   & 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U postgres -c "CREATE DATABASE bus_booking_test"
   ```

2. **Skema** — `npm run db:push` (drizzle-kit push, baca `.env`), lalu constraint yang di luar kemampuan push:

   ```powershell
   & 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U postgres -d bus_booking -f db\extras.sql      # gist no_overlap
   & 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U postgres -d bus_booking -f db\seed.sql        # data CONTOH
   # database TEST (dipakai vitest):
   $env:DATABASE_URL_TEST='postgresql://postgres:admin123@localhost:5432/bus_booking_test'
   npm run db:push;  & 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U postgres -d bus_booking_test -f db\extras.sql
   ```

3. **Env** — salin `.env.example` → `.env`, isi `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` (hex acak 64), `PO_NAME`, `PO_WA_NUMBER` (format `62…`).

4. **Jalan** — `npm run dev` → http://localhost:3000 · admin: http://localhost:3000/admin (login pakai `ADMIN_PASSWORD`).

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` / `build` / `start` | Aplikasi Next.js |
| `npm test` | Vitest — 46 test (estimate, template WA, status, hold+konkurensi+overlap, availability, quote+payment, admin ops) |
| `npm run lint` | ESLint |
| `npm run db:push` | Push skema Drizzle ke DB |

## Alur kerja

**Publik** (`/`): form 4 langkah (rute+tanggal+pax → pilih armada beserta foto & fasilitas → kontak → summary). Cek ketersediaan *indikatif* (unit aktif − hold yang overlap jendela trip; tanpa kunci otomatis). Hasil: kode quote + tombol "Lanjut ke WhatsApp" berisi template pesan ter-encode.

**Admin** (`/admin`, password env): 
- **Antrian** → detail quote: hold unit (1×24 jam, extend wajib alasan, auto-release saat dibaca), verifikasi DP (unit terkunci sampai trip selesai — *hard lock*), verifikasi pelunasan, harga final, terbitkan SPK bernomor (`SPK/<tahun>/<0001>`), pilih kru + kirim kontak via WA, tandai selesai, cabalkan.
- **Dispatch** (H-1) — keberangkatan ≤36 jam.
- **Feedback** (H+1) — buat link rating bertoken, kirim manual via WA.
- **Armada** — tipe unit (foto, fasilitas, tarif/hari) + unit/plat. **Setelan** — nama PO, nomor WA tujuan, %DP, H-pelunasan, durasi hold, buffer.
- **SPK** — halaman siap cetak (Ctrl+P → simpan PDF).

## Aturan kunci (dilindungi test & DB)

- Estimasi = `rate_per_day × ceil(jam/24) × unit_count` (63 jam = 3 hari). IDR integer, timestamptz, Asia/Jakarta.
- Anti-overlap di **level DB**: `EXCLUDE USING gist (unit_id WITH =, tstzrange(occupied_from, occupied_until) WITH &&)` pada tabel `holds`. Hold memegang dua waktu: *occupied range* (jendela trip + buffer — dilindungi gist) dan *lease* (batas 1×24 jam — di-sweep saat dibaca). Dua admin yang menahan unit terakhir bersamaan: tepat satu berhasil.
- Pax ≤ seats × unit_count (ditolak server).
- `expired` = hold lewat lease, sweep on read; `cancelled` bebas kecuali dari completed.

## Konvensi

- Bila mengubah skema: `npm run db:push` **di kedua DB** lalu `db\extras.sql` di keduanya (idempotent).
- Tarif & data seed berlabel CONTOH — admin wajib mengganti via menu Armada.
- Foto bus: path `/buses/*.jpg` atau URL — diisi lewat menu Armada. Placeholder tersedia di `public/buses/`.
- `NEXT_PUBLIC_BASE_URL` dipakai untuk link feedback di pesan WA (default `http://localhost:3000`).

## Yang belum ada (disengaja lihat SPEC)

Browser E2E (Playwright) menunggu fitur inti stabil; dulu diuji unit/integrasi DB + UAT manual 1 minggu. Tidak ada email, tidak ada multi-PO, tidak ada auto-send WA.
