import { and, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import type { DB } from '@/db';
import { holds, quotes, units } from '@/db/schema';
import { BLOCKING_STATUS } from './status';

// Ketersediaan indikatif per tipe unit untuk window [startAt, endAt] + buffer di kedua sisi.
// TIDAK mengunci apa pun; penguncian = hold admin (konstraint gist di DB).
export async function freeUnitsForType(
  db: DB,
  {
    typeId,
    startAt,
    endAt,
    bufferHours = 2,
  }: { typeId: number; startAt: Date; endAt: Date; bufferHours?: number },
): Promise<{ total: number; free: number }> {
  const bufMs = bufferHours * 3_600_000;
  // Occupied range sudah memuat buffer ekor [trip start .. trip end+buffer).
  // Buffer diterapkan sekali di ekor; window cek ini identik dengan rentang gist no_overlap.
  const windowStart = startAt;
  const windowEnd = new Date(endAt.getTime() + bufMs);

  const [agg] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(units)
    .where(and(eq(units.typeId, typeId), eq(units.active, true)));

  const takenRows = await db
    .selectDistinct({ unitId: holds.unitId })
    .from(holds)
    .innerJoin(quotes, eq(quotes.id, holds.quoteId))
    .where(
      and(
        eq(quotes.typeId, typeId),
        inArray(quotes.status, BLOCKING_STATUS),
        gt(holds.occupiedUntil, windowStart),
        lt(holds.occupiedFrom, windowEnd),
      ),
    );

  const total = agg?.n ?? 0;
  const taken = takenRows.length;
  return { total, free: Math.max(0, total - taken) };
}
