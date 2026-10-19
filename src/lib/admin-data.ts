import { and, asc, desc, eq, gt, inArray, lt, lte, ne } from 'drizzle-orm';
import type { DB } from '@/db';
import { assignments, crew, feedback, holds, payments, quotes, unitTypes, units } from '@/db/schema';
import { sweepExpired } from './holds';

export const ACTIVE_STATUS = ['quoted', 'held', 'dp_paid', 'confirmed', 'spk_issued', 'dispatched'];

export async function listAdminQuotes(db: DB) {
  await sweepExpired(db);
  const rows = await db
    .select({
      q: quotes,
      typeName: unitTypes.name,
      seats: unitTypes.seats,
    })
    .from(quotes)
    .innerJoin(unitTypes, eq(unitTypes.id, quotes.typeId))
    .where(inArray(quotes.status, [...ACTIVE_STATUS, 'expired']))
    .orderBy(desc(quotes.createdAt))
    .limit(60);
  return rows;
}

export async function listRecentClosed(db: DB) {
  return await db
    .select({ q: quotes, typeName: unitTypes.name })
    .from(quotes)
    .innerJoin(unitTypes, eq(unitTypes.id, quotes.typeId))
    .where(inArray(quotes.status, ['completed', 'cancelled']))
    .orderBy(desc(quotes.createdAt))
    .limit(15);
}

export async function getQuoteDetail(db: DB, id: number) {
  await sweepExpired(db);
  const [q] = await db.select().from(quotes).where(eq(quotes.id, id));
  if (!q) return null;
  const [type] = await db.select().from(unitTypes).where(eq(unitTypes.id, q.typeId));
  const holdRows = await db
    .select({ h: holds, plate: units.plate })
    .from(holds)
    .innerJoin(units, eq(units.id, holds.unitId))
    .where(eq(holds.quoteId, id))
    .orderBy(asc(units.plate));
  const fleetUnits = await db
    .select()
    .from(units)
    .where(and(eq(units.typeId, q.typeId), eq(units.active, true)))
    .orderBy(asc(units.plate));
  const payRows = await db.select().from(payments).where(eq(payments.quoteId, id)).orderBy(desc(payments.createdAt));
  const crewRows = await db.select().from(crew).where(eq(crew.active, true)).orderBy(asc(crew.role), asc(crew.name));
  const assignedRows = await db.select().from(assignments).where(eq(assignments.quoteId, id));
  const [fb] = await db.select().from(feedback).where(eq(feedback.quoteId, id));

  // Unit yang sedang ditahan quote LAIN di window yang sama (untuk tandai "clash" di UI).
  const clashRows = await db
    .select({ unitId: holds.unitId })
    .from(holds)
    .innerJoin(quotes, eq(quotes.id, holds.quoteId))
    .where(
      and(
        ne(holds.quoteId, id),
        eq(quotes.typeId, q.typeId),
        gt(holds.occupiedUntil, q.startAt),
        lt(holds.occupiedFrom, q.endAt),
      ),
    );

  return {
    q,
    type: type!,
    holdRows,
    fleetUnits,
    payRows,
    crewRows,
    assignedRows,
    fb: fb ?? null,
    clashUnitIds: clashRows.map((r) => r.unitId),
  };
}

// H-1: keberangkatan ≤36 jam ke depan dari status confirmed/spk_issued (+dispatched yang sudah dikirim).
export async function dispatchDue(db: DB, now = new Date()) {
  const limit = new Date(now.getTime() + 36 * 3_600_000);
  const rows = await db
    .select({ q: quotes, typeName: unitTypes.name })
    .from(quotes)
    .innerJoin(unitTypes, eq(unitTypes.id, quotes.typeId))
    .where(
      and(
        inArray(quotes.status, ['confirmed', 'spk_issued', 'dispatched']),
        gt(quotes.startAt, new Date(now.getTime() - 12 * 3_600_000)),
        lte(quotes.startAt, limit),
      ),
    )
    .orderBy(asc(quotes.startAt));
  return rows;
}

// H+1: trip yang sudah selesai beserta link feedbacknya (jika sudah dibuat).
export async function feedbackDue(db: DB, now = new Date()) {
  const rows = await db
    .select({ q: quotes, typeName: unitTypes.name, fbRow: feedback })
    .from(quotes)
    .innerJoin(unitTypes, eq(unitTypes.id, quotes.typeId))
    .leftJoin(feedback, eq(feedback.quoteId, quotes.id))
    .where(
      and(
        inArray(quotes.status, ['spk_issued', 'dispatched', 'completed']),
        lte(quotes.endAt, now),
        gt(quotes.endAt, new Date(now.getTime() - 14 * 24 * 3_600_000)),
      ),
    )
    .orderBy(desc(quotes.endAt))
    .limit(40);
  return rows;
}
