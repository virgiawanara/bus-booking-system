import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '@/db';
import { sql, eq } from 'drizzle-orm';
import { quotes, payments, unitTypes, units } from '@/db/schema';
import { createQuote } from './quotes';
import { verifyDpPayment, verifyPelunasanPayment } from './payments';
import { holdQuote } from './holds';
import { addDays } from './test-utils';

const db = createDb(process.env.DATABASE_URL_TEST!);

beforeEach(async () => {
  await db.execute(sql`TRUNCATE unit_types, units, quotes, holds, payments, assignments, feedback, crew, settings RESTART IDENTITY CASCADE`);
});

async function seedOneUnit() {
  const [t] = await db
    .insert(unitTypes)
    .values({ name: 'CONTOH VIP (31 Seat)', seats: 31, ratePerDay: 1_500_000, facilities: ['AC'] })
    .returning();
  const [u] = await db.insert(units).values({ typeId: t.id, plate: 'CONTOH-01' }).returning();
  return { t, u };
}

type QuoteInput = Parameters<typeof createQuote>[1];
function baseInput(overrides: Partial<QuoteInput> = {}): QuoteInput {
  const start = addDays(new Date(), 7);
  return {
    picName: 'Bpk. Rian',
    phone: '0812-3456-7890',
    origin: 'Jakarta',
    destination: 'Yogya',
    pickupPoint: 'Graha Mandiri',
    standbyTime: '05.30',
    startAt: start,
    endAt: addDays(start, 2),
    luggageNote: null,
    unitCount: 1,
    typeId: 0,
    notes: null,
    ...overrides,
  };
}

describe('createQuote', () => {
  it('kode format Q-YYYY-XXXX + estimasi dihitung + phone dinormalisasi', async () => {
    const { t, u } = await seedOneUnit();
    const q = await createQuote(db, baseInput({ typeId: t.id }));
    expect(q.code).toMatch(/^Q-20\d{2}-\d{4}$/);
    expect(q.phone).toBe('6281234567890');
    expect(q.estimate).toBeGreaterThan(0);
    expect(q.status).toBe('quoted');
    // 2 durasi hari x 1.5jt = 3jt (rate contoh)
    expect(q.estimate).toBe(3_000_000);
    expect(u.plate).toBeDefined();
  });

  it('unit tidak positif / tanggal kembali lebih awal ditolak', async () => {
    const { t } = await seedOneUnit();
    await expect(createQuote(db, baseInput({ typeId: t.id, unitCount: 0 }))).rejects.toThrow();
    const start = addDays(new Date(), 7);
    await expect(
      createQuote(db, baseInput({ typeId: t.id, startAt: start, endAt: addDays(start, -1) })),
    ).rejects.toThrow();
  });

  it('sewa sehari (kembali = berangkat) legal, dihitung 1 hari', async () => {
    const { t } = await seedOneUnit();
    const start = addDays(new Date(), 7);
    const q = await createQuote(db, baseInput({ typeId: t.id, startAt: start, endAt: start }));
    expect(q.estimate).toBe(1_500_000);
  });

  it('nomor WA tidak valid ditolak', async () => {
    const { t } = await seedOneUnit();
    await expect(createQuote(db, baseInput({ typeId: t.id, phone: 'bukan-nomor' }))).rejects.toThrow(/WhatsApp/i);
  });
});

describe('verifyDpPayment (DP -> dp_paid + hard lock)', () => {
  it('hanya dari status held, dan mengunci unit sampai trip selesai', async () => {
    const { t, u } = await seedOneUnit();
    const q = await createQuote(db, baseInput({ typeId: t.id, unitCount: 1 }));

    // DP sebelum hold harus ditolak
    const early = await verifyDpPayment(db, {
      quoteId: q.id,
      amount: 900_000,
      paidAt: new Date(),
    });
    expect(early.ok).toBe(false);

    const hold = await holdQuote(db, {
      quoteId: q.id,
      unitIds: [u.id],
      holdHours: 24,
      bufferHours: 2,
    });
    expect(hold.ok).toBe(true);

    // di-hold: hard lock belum; lease masih 24 jam dari now
    const dp = await verifyDpPayment(db, {
      quoteId: q.id,
      amount: 900_000,
      paidAt: new Date(),
    });
    expect(dp.ok).toBe(true);

    const after = (await db.select().from(quotes).where(eq(quotes.id, q.id)))[0];
    expect(after.status).toBe('dp_paid');
    // hard lock: lease >= endAt
    expect(after.holdUntil!.getTime()).toBeGreaterThanOrEqual(after.endAt.getTime());
  });

  it('atomik: nominal tidak valid ditolak tanpa efek, lalu bisa diulang', async () => {
    const { t, u } = await seedOneUnit();
    const q = await createQuote(db, baseInput({ typeId: t.id }));
    await holdQuote(db, { quoteId: q.id, unitIds: [u.id], holdHours: 24, bufferHours: 2 });

    const bad = await verifyDpPayment(db, { quoteId: q.id, amount: -5, paidAt: new Date() });
    expect(bad.ok).toBe(false);
    expect(await db.select().from(payments)).toHaveLength(0);
    const after = (await db.select().from(quotes).where(eq(quotes.id, q.id)))[0];
    expect(after.status).toBe('held');

    const retry = await verifyDpPayment(db, { quoteId: q.id, amount: 900_000, paidAt: new Date() });
    expect(retry.ok).toBe(true);
  });
});

describe('verifyPelunasanPayment (dp_paid -> confirmed)', () => {
  it('hanya dari dp_paid', async () => {
    const { t, u } = await seedOneUnit();
    const q = await createQuote(db, baseInput({ typeId: t.id }));

    const r = await verifyPelunasanPayment(db, { quoteId: q.id, amount: 2_100_000, paidAt: new Date() });
    expect(r.ok).toBe(false); // masih quoted, belum DP

    await holdQuote(db, { quoteId: q.id, unitIds: [u.id], holdHours: 24, bufferHours: 2 });
    await verifyDpPayment(db, { quoteId: q.id, amount: 900_000, paidAt: new Date() });
    const r2 = await verifyPelunasanPayment(db, { quoteId: q.id, amount: 2_100_000, paidAt: new Date() });
    expect(r2.ok).toBe(true);

    const after = (await db.select().from(quotes).where(eq(quotes.id, q.id)))[0];
    expect(after.status).toBe('confirmed');
  });

  it('nominal pelunasan harus positif, ditolak tanpa efek', async () => {
    const { t, u } = await seedOneUnit();
    const q = await createQuote(db, baseInput({ typeId: t.id }));
    await holdQuote(db, { quoteId: q.id, unitIds: [u.id], holdHours: 24, bufferHours: 2 });
    await verifyDpPayment(db, { quoteId: q.id, amount: 900_000, paidAt: new Date() });

    const bad = await verifyPelunasanPayment(db, { quoteId: q.id, amount: 0, paidAt: new Date() });
    expect(bad.ok).toBe(false);
    const rows = await db.select().from(payments);
    expect(rows.filter((p) => p.kind === 'pelunasan')).toHaveLength(0);
    const after = (await db.select().from(quotes).where(eq(quotes.id, q.id)))[0];
    expect(after.status).toBe('dp_paid');
  });
});
