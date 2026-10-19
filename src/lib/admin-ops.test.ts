import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '@/db';
import { sql, eq } from 'drizzle-orm';
import { crew, feedback, quotes, unitTypes, units } from '@/db/schema';
import { createQuote } from './quotes';
import { holdQuote, cancelQuote } from './holds';
import { verifyDpPayment, verifyPelunasanPayment } from './payments';
import { issueSpk, setFinalPrice, markDispatched, markCompleted, markContacted, ensureFeedbackToken } from './admin-ops';
import { addDays } from './test-utils';

const db = createDb(process.env.DATABASE_URL_TEST!);

beforeEach(async () => {
  await db.execute(sql`TRUNCATE unit_types, units, quotes, holds, payments, assignments, feedback, crew, settings RESTART IDENTITY CASCADE`);
});

async function seedAndConfirmedOrder() {
  const [t] = await db
    .insert(unitTypes)
    .values({ name: 'CONTOH VIP (31)', seats: 31, ratePerDay: 1_500_000, facilities: [] })
    .returning();
  const [u] = await db.insert(units).values({ typeId: t.id, plate: 'CONTOH-VIP-1' }).returning();
  const start = addDays(new Date(), 7);
  const q = await createQuote(db, {
    picName: 'Bpk. Rian',
    phone: '0812-3456-7890',
    origin: 'Jakarta',
    destination: 'Yogya',
    pickupPoint: 'Graha Mandiri',
    standbyTime: '05.30',
    startAt: start,
    endAt: addDays(start, 2),
    pax: 30,
    unitCount: 1,
    typeId: t.id,
  });
  await holdQuote(db, { quoteId: q.id, unitIds: [u.id], holdHours: 24, bufferHours: 2 });
  await verifyDpPayment(db, { quoteId: q.id, amount: 900_000, paidAt: new Date() });
  await verifyPelunasanPayment(db, { quoteId: q.id, amount: 2_100_000, paidAt: new Date() });
  const after = (await db.select().from(quotes).where(eq(quotes.id, q.id)))[0];
  return { q: after, t, u };
}

describe('setFinalPrice', () => {
  it('harga final diset admin, IDR integer > 0', async () => {
    const { q } = await seedAndConfirmedOrder();
    const r = await setFinalPrice(db, { quoteId: q.id, finalPrice: 4_800_000 });
    expect(r.ok).toBe(true);
    const after = (await db.select().from(quotes).where(eq(quotes.id, q.id)))[0];
    expect(after.finalPrice).toBe(4_800_000);

    const bad = await setFinalPrice(db, { quoteId: q.id, finalPrice: 0 });
    expect(bad.ok).toBe(false);
  });
});

describe('issueSpk', () => {
  it('hanya dari confirmed; nomor SPK/YYYY/NNNN', async () => {
    const { q } = await seedAndConfirmedOrder();
    const r = await issueSpk(db, { quoteId: q.id, status: q.status });
    if (!r.ok) console.log('ISSUE_FAIL', r.reason);
    expect(r.ok).toBe(true);

    const after = (await db.select().from(quotes).where(eq(quotes.id, q.id)))[0];
    expect(after.status).toBe('spk_issued');
    expect(after.spkNumber).toMatch(/^SPK\/20\d{2}\/\d{4}$/);
  });

  it('gagal dari dp_paid (belum lunas)', async () => {
    const [t] = await db
      .insert(unitTypes)
      .values({ name: 'X', seats: 10, ratePerDay: 1_000_000, facilities: [] })
      .returning();
    const [u] = await db.insert(units).values({ typeId: t.id, plate: 'X1' }).returning();
    const start = addDays(new Date(), 7);
    const q = await createQuote(db, {
      picName: 'Bpk. Andi',
      phone: '081234567890',
      origin: 'Kota A',
      destination: 'Kota B',
      pickupPoint: 'Halte C',
      standbyTime: '06.00',
      startAt: start,
      endAt: addDays(start, 1),
      pax: 5,
      unitCount: 1,
      typeId: t.id,
    });
    await holdQuote(db, { quoteId: q.id, unitIds: [u.id], holdHours: 24, bufferHours: 2 });
    await verifyDpPayment(db, { quoteId: q.id, amount: 500_000, paidAt: new Date() });
    const r = await issueSpk(db, { quoteId: q.id, status: 'dp_paid' });
    expect(r.ok).toBe(false);
  });
});

describe('markDispatched / markCompleted / markContacted', () => {
  it('alur kontrol mengikuti transisi legal', async () => {
    const { q } = await seedAndConfirmedOrder();
    await setFinalPrice(db, { quoteId: q.id, finalPrice: 4_800_000 });
    await issueSpk(db, { quoteId: q.id, status: 'confirmed' });

    const d = await markDispatched(db, { quoteId: q.id, status: 'spk_issued' });
    expect(d.ok).toBe(true);

    const c = await markCompleted(db, { quoteId: q.id, status: 'dispatched' });
    expect(c.ok).toBe(true);
    const after = (await db.select().from(quotes).where(eq(quotes.id, q.id)))[0];
    expect(after.status).toBe('completed');
  });

  it('dispatched tidak boleh dari confirmed (harus via spk_issued)', async () => {
    const { q } = await seedAndConfirmedOrder();
    const r = await markDispatched(db, { quoteId: q.id, status: 'confirmed' });
    expect(r.ok).toBe(false);
  });

  it('ketuk "sudah dihubungi" manual', async () => {
    const { q } = await seedAndConfirmedOrder();
    const r = await markContacted(db, { quoteId: q.id });
    expect(r.ok).toBe(true);
    const after = (await db.select().from(quotes).where(eq(quotes.id, q.id)))[0];
    expect(after.contactedAt).not.toBeNull();
  });
});

describe('ensureFeedbackToken', () => {
  it('token idempotent unik per order', async () => {
    const { q } = await seedAndConfirmedOrder();
    const t1 = await ensureFeedbackToken(db, { quoteId: q.id });
    const t2 = await ensureFeedbackToken(db, { quoteId: q.id });
    expect(t1).toBe(t2);
    const rows = await db.select().from(feedback).where(eq(feedback.quoteId, q.id));
    expect(rows).toHaveLength(1);
  });
});

describe('cancelQuote setelah selesai', () => {
  it('completed tidak bisa dibatalkan', async () => {
    const { q } = await seedAndConfirmedOrder();
    await setFinalPrice(db, { quoteId: q.id, finalPrice: 4_800_000 });
    await issueSpk(db, { quoteId: q.id, status: 'confirmed' });
    await markDispatched(db, { quoteId: q.id, status: 'spk_issued' });
    await markCompleted(db, { quoteId: q.id, status: 'dispatched' });

    const r = await cancelQuote(db, { quoteId: q.id });
    expect(r.ok).toBe(false);
    const after = (await db.select().from(quotes).where(eq(quotes.id, q.id)))[0];
    expect(after.status).toBe('completed');
  });
});
