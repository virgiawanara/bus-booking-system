'use server';

import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { unitTypes } from '@/db/schema';
import { freeUnitsForType } from '@/lib/availability';
import { createQuote } from '@/lib/quotes';
import { buildWaMessage, buildWaLink } from '@/lib/wa-template';
import { getSettings } from '@/lib/settings';

export type TypeAvailability = {
  id: number;
  name: string;
  seats: number;
  ratePerDay: number;
  imageUrl: string | null;
  facilities: string[];
  total: number;
  free: number;
};

export async function checkAvailabilityAction(
  startAtISO: string,
  endAtISO: string,
): Promise<TypeAvailability[] | { error: string }> {
  try {
    const start = new Date(startAtISO);
    const end = new Date(endAtISO);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return { error: 'Rentang waktu tidak valid' };
    }
    const db = getDb();
    const settings = await getSettings();
    const types = await db.select().from(unitTypes).where(eq(unitTypes.active, true));
    const rows = await Promise.all(
      types.map(async (t) => {
        const avail = await freeUnitsForType(db, {
          typeId: t.id,
          startAt: start,
          endAt: end,
          bufferHours: settings.BUFFER_HOURS,
        });
        return {
          id: t.id,
          name: t.name,
          seats: t.seats,
          ratePerDay: t.ratePerDay,
          imageUrl: t.imageUrl,
          facilities: t.facilities ?? [],
          total: avail.total,
          free: avail.free,
        };
      }),
    );
    // Stok ada di depan; yang habis tetap tampil agar pelanggan bisa tanya admin.
    rows.sort((a, b) => b.free - a.free || a.ratePerDay - b.ratePerDay);
    return rows;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Gagal cek ketersediaan' };
  }
}

export type CreateQuotePublicInput = {
  picName: string;
  phone: string;
  origin: string;
  destination: string;
  pickupPoint: string;
  standbyTime: string;
  startAtISO: string;
  endAtISO: string;
  pax: number;
  luggageNote?: string | null;
  unitCount: number;
  typeId: number;
  notes?: string | null;
};

export async function createQuoteAction(
  input: CreateQuotePublicInput,
): Promise<
  | { ok: true; code: string; estimate: number; waLink: string; typeName: string; seats: number; days: number; dpHint: number; stickyNote: string }
  | { ok: false; error: string }
> {
  try {
    const settings = await getSettings();
    const startAt = new Date(input.startAtISO);
    const endAt = new Date(input.endAtISO);
    const q = await createQuote(getDb(), {
      picName: input.picName,
      phone: input.phone,
      origin: input.origin,
      destination: input.destination,
      pickupPoint: input.pickupPoint,
      standbyTime: input.standbyTime,
      startAt,
      endAt,
      pax: input.pax,
      luggageNote: input.luggageNote ?? null,
      unitCount: input.unitCount,
      typeId: input.typeId,
      notes: input.notes ?? null,
    });

    const db = getDb();
    const [type] = await db.select().from(unitTypes).where(eq(unitTypes.id, input.typeId));
    if (!type) return { ok: false, error: 'Tipe unit tidak ditemukan' };

    const message = buildWaMessage({
      quote: {
        code: q.code,
        picName: q.picName,
        phone: q.phone,
        origin: q.origin,
        destination: q.destination,
        pickupPoint: q.pickupPoint,
        standbyTime: q.standbyTime,
        startAt: q.startAt,
        endAt: q.endAt,
        pax: q.pax,
        unitCount: q.unitCount,
        estimate: q.estimate,
      },
      typeName: type.name,
      seats: type.seats,
      poName: settings.PO_NAME,
    });
    const waLink = buildWaLink(settings.WA_NUMBER, message);

    return {
      ok: true,
      code: q.code,
      estimate: q.estimate,
      waLink,
      typeName: type.name,
      seats: type.seats,
      days: Math.max(1, Math.ceil((endAt.getTime() - startAt.getTime()) / (24 * 3_600_000))),
      dpHint: Math.round((q.estimate * settings.DP_PERCENT) / 100),
      stickyNote: 'Harga belum termasuk tol, parkir, retribusi wisata, dan tips kru. Harga dapat berubah sampai DP dikonfirmasi.',
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Gagal membuat quote';
    return { ok: false, error: msg };
  }
}
