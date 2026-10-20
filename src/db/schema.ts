import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';

// Tarif & tipe armada. rate_per_day = IDR integer (placeholder CONTOH, admin wajib ganti).
export const unitTypes = pgTable('unit_types', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  seats: integer('seats').notNull(),
  ratePerDay: integer('rate_per_day').notNull(),
  imageUrl: text('image_url'),
  facilities: jsonb('facilities').$type<string[]>().notNull().default([]),
  active: boolean('active').notNull().default(true),
});

export const units = pgTable('units', {
  id: serial('id').primaryKey(),
  typeId: integer('type_id')
    .notNull()
    .references(() => unitTypes.id),
  plate: text('plate').notNull(),
  active: boolean('active').notNull().default(true),
});

// Satu order = satu tipe unit, jumlah unit boleh >1.
// Status: quoted|held|dp_paid|confirmed|spk_issued|dispatched|completed|cancelled|expired
export const quotes = pgTable('quotes', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  picName: text('pic_name').notNull(),
  phone: text('phone').notNull(), // E.164 62...
  origin: text('origin').notNull(),
  destination: text('destination').notNull(),
  pickupPoint: text('pickup_point').notNull(),
  standbyTime: text('standby_time').notNull(), // "05.30"
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  luggageNote: text('luggage_note'),
  unitCount: integer('unit_count').notNull(),
  typeId: integer('type_id')
    .notNull()
    .references(() => unitTypes.id),
  estimate: integer('estimate').notNull(),
  finalPrice: integer('final_price'), // ditetapkan admin
  status: text('status').notNull().default('quoted'),
  holdUntil: timestamp('hold_until', { withTimezone: true }),
  extendReason: text('extend_reason'),
  spkNumber: text('spk_number'),
  notes: text('notes'),
  contactedAt: timestamp('contacted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Hold unit konkret oleh admin. Dua macam waktu:
// occupied [trip start .. trip end+buffer) = yang dilindungi DB (gist no_overlap);
// hold_until (lease) = batas 1x24 jam untuk hold lembut (sweep on read).
export const holds = pgTable('holds', {
  id: serial('id').primaryKey(),
  quoteId: integer('quote_id')
    .notNull()
    .references(() => quotes.id),
  unitId: integer('unit_id')
    .notNull()
    .references(() => units.id),
  occupiedFrom: timestamp('occupied_from', { withTimezone: true }).notNull(),
  occupiedUntil: timestamp('occupied_until', { withTimezone: true }).notNull(),
  holdUntil: timestamp('hold_until', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Pembayaran manual (transfer). Buktinya diupload admin.
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  quoteId: integer('quote_id')
    .notNull()
    .references(() => quotes.id),
  kind: text('kind').notNull(), // dp | pelunasan
  amount: integer('amount').notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
  proofUrl: text('proof_url'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const crew = pgTable('crew', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  role: text('role').notNull().default('driver'), // driver | co_driver
  active: boolean('active').notNull().default(true),
});

export const assignments = pgTable('assignments', {
  id: serial('id').primaryKey(),
  quoteId: integer('quote_id')
    .notNull()
    .references(() => quotes.id),
  crewId: integer('crew_id')
    .notNull()
    .references(() => crew.id),
  sentAt: timestamp('sent_at', { withTimezone: true }),
});

// Form rating via link bertoken (dikirim admin manual lewat WA).
export const feedback = pgTable('feedback', {
  id: serial('id').primaryKey(),
  quoteId: integer('quote_id')
    .notNull()
    .references(() => quotes.id),
  token: text('token').notNull().unique(),
  rating: integer('rating'),
  comment: text('comment'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Settings runtime (PO_NAME, WA_NUMBER, DP_PERCENT, ...), override dari .env saat dibaca.
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
