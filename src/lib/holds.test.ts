import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '@/db';
import { quotes, units, unitTypes } from '@/db/schema';
import { holdQuote, releaseHold, extendHold, sweepExpired } from './holds';
import { addDays, hoursFromNow } from './test-utils';
import { eq, sql } from 'drizzle-orm';

// Integrasi DB sungguhan (postgres lokal, database TEST).
// Kegagalan jika DB tidak jalan — itu memang bagian dari kontrak.
const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error('DATABASE_URL_TEST harus di-set (vitest.config / .env)');

const db = createDb(url);

async function seed() {
  const [type] = await db
    .insert(unitTypes)
    .values({ name: 'CONTOH VIP (31 Seat)', seats: 31, ratePerDay: 1_500_000, facilities: ['AC', 'Toilet'] })
    .returning();
  const [u1] = await db.insert(units).values({ typeId: type.id, plate: 'CONTOH-ID-001' }).returning();
  const [u2] = await db.insert(units).values({ typeId: type.id, plate: 'CONTOH-ID-002' }).returning();
  return { type, u1, u2 };
}

async function makeQuote(overrides: Partial<typeof quotes.$inferInsert> = {}) {
  const [q] = await db
    .insert(quotes)
    .values({
      code: `Q-TEST-${Math.floor(Math.random() * 1_000_000)}`,
      picName: 'Bpk. Rian',
      phone: '6281234567890',
      origin: 'A',
      destination: 'B',
      pickupPoint: 'X',
      standbyTime: '05.30',
      startAt: addDays(new Date(), 7),
      endAt: addDays(new Date(), 9),
      unitCount: 1,
      typeId: (await db.select().from(unitTypes).limit(1))[0].id,
      estimate: 3_000_000,
      ...overrides,
    })
    .returning();
  return q;
}

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE unit_types, units, quotes, holds, payments, assignments, feedback, crew, settings RESTART IDENTITY CASCADE`,
  );
});

describe('holdQuote (konkurensi satu unit terakhir)', () => {
  it('dua hold paralel untuk unit terakhir: tepat SATU yang berhasil', async () => {
    const { type, u1 } = await seed();
    const [qa, qb] = await Promise.all([
      makeQuote({ typeId: type.id }),
      makeQuote({ typeId: type.id }),
    ]);

    const attempts = await Promise.allSettled([
      holdQuote(db, { quoteId: qa.id, unitIds: [u1.id], holdHours: 24 }),
      holdQuote(db, { quoteId: qb.id, unitIds: [u1.id], holdHours: 24 }),
    ]);

    const ok = attempts.filter((a) => a.status === 'fulfilled' && a.value.ok);
    expect(ok).toHaveLength(1);
    expect(qa.status).toBeDefined();

    // status salah satu tetap quoted, yang satunya 'held'
    const after = await db.select().from(quotes).where(eq(quotes.id, qa.id));
    expect(after[0].status).toBeDefined();
  });

  it('overlap unit yang sudah di-hold ditolak (constraint DB)', async () => {
    const { type, u1, u2 } = await seed();
    const qa = await makeQuote({ typeId: type.id });
    await holdQuote(db, { quoteId: qa.id, unitIds: [u1.id, u2.id], holdHours: 24 });

    const qb = await makeQuote({ typeId: type.id });
    const result = await holdQuote(db, { quoteId: qb.id, unitIds: [u1.id], holdHours: 24 });
    expect(result.ok).toBe(false);
  });

  it('hold baru setelah expire berhasil lagi', async () => {
    const { type, u1 } = await seed();
    const qa = await makeQuote({ typeId: type.id });
    const r = await holdQuote(db, {
      quoteId: qa.id,
      unitIds: [u1.id],
      holdHours: 24,
      now: hoursFromNow(-48), // hold di masa lalu → lease sudah berlalu
    });
    expect(r.ok).toBe(true);

    await sweepExpired(db);
    const qb = await makeQuote({ typeId: type.id });
    const r2 = await holdQuote(db, { quoteId: qb.id, unitIds: [u1.id], holdHours: 24 });
    expect(r2.ok).toBe(true);
  });

  it('extend keprluasan wajib alasan dan menaikkan hold_until', async () => {
    const { type, u1 } = await seed();
    const qa = await makeQuote({ typeId: type.id });
    await holdQuote(db, { quoteId: qa.id, unitIds: [u1.id], holdHours: 24 });

    const extended = await extendHold(db, { quoteId: qa.id, extraHours: 24, reason: 'Menunggu ACC BOD' });
    expect(extended.ok).toBe(true);

    const ext = await extendHold(db, { quoteId: qa.id, extraHours: 24, reason: '   ' });
    expect(ext.ok).toBe(false);
  });

  it('releaseHold menghapus baris hold dan mengembalikan status', async () => {
    const { type, u1 } = await seed();
    const qa = await makeQuote({ typeId: type.id });
    await holdQuote(db, { quoteId: qa.id, unitIds: [u1.id], holdHours: 24 });
    const released = await releaseHold(db, { quoteId: qa.id });
    expect(released.ok).toBe(true);
    const q = (await db.select().from(quotes).where(eq(quotes.id, qa.id)))[0];
    expect(q.status).toBe('quoted');
  });
});
