import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '@/db';
import { sql, eq } from 'drizzle-orm';
import { quotes, unitTypes, units } from '@/db/schema';
import { freeUnitsForType } from './availability';
import { addDays } from './test-utils';
import { holdQuote } from './holds';

const db = createDb(process.env.DATABASE_URL_TEST!);

async function seedTypeAndUnits(n: number) {
  const [t] = await db
    .insert(unitTypes)
    .values({ name: 'CONTOH VIP', seats: 31, ratePerDay: 1_500_000, facilities: [] })
    .returning();
  const us = [];
  for (let i = 0; i < n; i++) {
    us.push((await db.insert(units).values({ typeId: t.id, plate: `CONTOH-${i}` }).returning())[0]);
  }
  return { t, us };
}

async function makeQuote(typeId: number, startAt: Date, endAt: Date, unitCount = 1) {
  const [q] = await db
    .insert(quotes)
    .values({
      code: `Q-AV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      picName: 'P', phone: '6281', origin: 'A', destination: 'B',
      pickupPoint: 'X', standbyTime: '05.30',
      startAt, endAt, pax: 5, unitCount, typeId,
      estimate: 3_000_000,
    })
    .returning();
  return q;
}

beforeEach(async () => {
  await db.execute(sql`TRUNCATE unit_types, units, quotes, holds, payments, assignments, feedback, crew, settings RESTART IDENTITY CASCADE`);
});

const bufferHours = 2;

describe('freeUnitsForType', () => {
  it('2 unit aktif, tanpa hold: free = 2', async () => {
    const { t } = await seedTypeAndUnits(2);
    const r = await freeUnitsForType(db, {
      typeId: t.id,
      startAt: addDays(new Date(), 7),
      endAt: addDays(new Date(), 9),
      bufferHours,
    });
    expect(r).toEqual({ total: 2, free: 2 });
  });

  it('hold mengurangi availability di window yang sama', async () => {
    const { t, us } = await seedTypeAndUnits(2);
    const start = addDays(new Date(), 7);
    const end = addDays(new Date(), 9);
    const q = await makeQuote(t.id, start, end);
    const held = await holdQuote(db, {
      quoteId: q.id,
      unitIds: [us[0].id],
      holdHours: 24,
      bufferHours,
    });
    expect(held.ok).toBe(true);

    const r = await freeUnitsForType(db, { typeId: t.id, startAt: start, endAt: end, bufferHours });
    expect(r).toEqual({ total: 2, free: 1 });
  });

  it('buffer 2 jam: tidak overlap garis, tapi menerobos di dalam buffer = tetap konflik', async () => {
    const { t, us } = await seedTypeAndUnits(1);
    const start = addDays(new Date(), 7);
    const end = addDays(new Date(), 9);
    const q = await makeQuote(t.id, start, end);
    await holdQuote(db, { quoteId: q.id, unitIds: [us[0].id], holdHours: 24, bufferHours });

    // window berhenti 1 jam SEBELUM trip — bukan overlap per hari, tapi menerobos ke buffer
    const nearEnd = new Date(start.getTime() - 1 * 60 * 60 * 1000);
    const rNear = await freeUnitsForType(db, {
      typeId: t.id,
      startAt: addDays(nearEnd, -1),
      endAt: nearEnd,
      bufferHours,
    });
    expect(rNear.free).toBe(0);

    // window berhenti 3 jam sebelum trip: di luar buffer, bebas
    const farEnd = new Date(start.getTime() - 3 * 60 * 60 * 1000);
    const rFar = await freeUnitsForType(db, {
      typeId: t.id,
      startAt: addDays(farEnd, -1),
      endAt: farEnd,
      bufferHours,
    });
    expect(rFar.free).toBe(1);
  });

  it('setelah trip berakhir + buffer, unit kembali bebas (hard lock)', async () => {
    const { t, us } = await seedTypeAndUnits(1);
    const start = addDays(new Date(), 7);
    const end = addDays(new Date(), 9);
    const q = await makeQuote(t.id, start, end);
    await holdQuote(db, { quoteId: q.id, unitIds: [us[0].id], holdHours: 24, bufferHours });

    const qAfter = (await db.select().from(quotes).where(eq(quotes.id, q.id)))[0];
    const afterEndBuffer = new Date(qAfter.endAt.getTime() + (bufferHours + 1) * 3_600_000);
    const r = await freeUnitsForType(db, {
      typeId: t.id,
      startAt: afterEndBuffer,
      endAt: addDays(afterEndBuffer, 2),
      bufferHours,
    });
    expect(r.free).toBe(1);
  });

  it('unit nonaktif tidak dihitung', async () => {
    const { t, us } = await seedTypeAndUnits(2);
    await db.update(units).set({ active: false }).where(eq(units.id, us[1].id));
    const r = await freeUnitsForType(db, {
      typeId: t.id,
      startAt: addDays(new Date(), 7),
      endAt: addDays(new Date(), 9),
      bufferHours,
    });
    expect(r).toEqual({ total: 1, free: 1 });
  });
});
