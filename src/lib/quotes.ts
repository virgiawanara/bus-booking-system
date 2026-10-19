import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { DB } from '@/db';
import { quotes, unitTypes } from '@/db/schema';
import { computeEstimate } from './estimate';
import { normalizePhone } from './wa-template';

const quoteInputSchema = z.object({
  picName: z.string().min(2).max(120),
  phone: z.string().min(6),
  origin: z.string().min(2).max(120),
  destination: z.string().min(2).max(120),
  pickupPoint: z.string().min(2).max(240),
  standbyTime: z.string().regex(/^\d{1,2}\.\d{2}$/),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  pax: z.number().int().min(1).max(200),
  luggageNote: z.string().max(400).nullish(),
  unitCount: z.number().int().min(1).max(10),
  typeId: z.number().int(),
  notes: z.string().max(1000).nullish(),
});

export type QuoteInput = z.input<typeof quoteInputSchema>;

export async function createQuote(db: DB, input: QuoteInput) {
  const data = quoteInputSchema.parse(input);
  if (!(data.endAt.getTime() > data.startAt.getTime())) throw new Error('Rentang waktu tidak valid');

  const [type] = await db.select().from(unitTypes).where(eq(unitTypes.id, data.typeId));
  if (!type || !type.active) throw new Error('Tipe unit tidak tersedia');
  if (data.pax > type.seats * data.unitCount) throw new Error('Melebihi kapasitas armada');

  const phone = normalizePhone(data.phone);
  const est = computeEstimate({
    startAt: data.startAt,
    endAt: data.endAt,
    ratePerDay: type.ratePerDay,
    unitCount: data.unitCount,
  });

  const [row] = await db
    .insert(quotes)
    .values({
      code: 'TMP',
      picName: data.picName,
      phone,
      origin: data.origin,
      destination: data.destination,
      pickupPoint: data.pickupPoint,
      standbyTime: data.standbyTime,
      startAt: data.startAt,
      endAt: data.endAt,
      pax: data.pax,
      luggageNote: data.luggageNote ?? null,
      unitCount: data.unitCount,
      typeId: data.typeId,
      estimate: est.total,
      notes: data.notes ?? null,
    })
    .returning();

  const year = new Date().getFullYear();
  const code = `Q-${year}-${String(row.id).padStart(4, '0')}`;
  await db.update(quotes).set({ code }).where(eq(quotes.id, row.id));
  return { ...row, code };
}
