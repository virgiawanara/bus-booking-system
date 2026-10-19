import { and, eq, gt, inArray, lt } from 'drizzle-orm';
import { canTransition, type QuoteStatus } from './status';
import type { DB } from '@/db';
import { holds, quotes, units } from '@/db/schema';

const HOUR_MS = 3_600_000;

export type HoldResult = { ok: true; holdUntil?: Date } | { ok: false; reason: string };

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// Status effective on-the-fly: held yang melewati lease (hold_until) = expired.
export function effectiveStatus(q: { status: string; holdUntil: Date | null }, now: Date): QuoteStatus {
  if (q.status === 'held' && q.holdUntil && q.holdUntil.getTime() < now.getTime()) return 'expired';
  return q.status as QuoteStatus;
}

type HoldQuoteArgs = {
  quoteId: number;
  unitIds: number[];
  holdHours: number;
  bufferHours?: number;
  now?: Date;
};

// Hold lembut: lease = now + holdHours (1x24 jam). Rentang occupied = trip + buffer.
// DP terverifikasi → convertHoldToHardLock (lease diset sampai trip selesai).
export async function holdQuote(db: DB, args: HoldQuoteArgs): Promise<HoldResult> {
  const { quoteId, unitIds, holdHours, bufferHours = 2, now = new Date() } = args;
  if (unitIds.length === 0) return { ok: false, reason: 'Tidak ada unit yang dipilih' };

  // Bersihkan lease yang sudah lewat supaya unit dapat ditahan lagi.
  await sweepExpired(db, now);

  try {
    const until = await db.transaction(async (tx) => {
      const [q] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).for('update');
      if (!q) throw new Error('Quote tidak ditemukan');
      const st = effectiveStatus(q, now);
      if (!canTransition(st, 'held')) throw new Error(`Tidak bisa menahan unit dari status ${st}`);

      const sel = await tx.select().from(units).where(inArray(units.id, unitIds));
      if (sel.length !== unitIds.length) throw new Error('Ada unit yang tidak ditemukan');
      if (sel.some((u) => !u.active)) throw new Error('Ada unit yang tidak aktif');

      const holdUntil = new Date(now.getTime() + holdHours * HOUR_MS);
      const occupiedFrom = q.startAt;
      const occupiedUntil = new Date(q.endAt.getTime() + bufferHours * HOUR_MS);

      // Cek ramah (pesan enak dibaca). Hard guarantee tetap gist: no_overlap.
      // Lease lewat (hold_until < now) diabaikan — akan ter-sweep.
      const clash = await tx
        .select({ id: holds.id })
        .from(holds)
        .where(
          and(
            inArray(holds.unitId, unitIds),
            gt(holds.occupiedUntil, occupiedFrom),
            lt(holds.occupiedFrom, occupiedUntil),
            gt(holds.holdUntil, now),
          ),
        );
      if (clash.length > 0) throw new Error('Ada unit yang masih ditahan quote lain');

      await tx.insert(holds).values(
        unitIds.map((unitId) => ({
          quoteId,
          unitId,
          occupiedFrom,
          occupiedUntil,
          holdUntil,
          createdAt: now,
        })),
      );
      await tx.update(quotes).set({ status: 'held', holdUntil }).where(eq(quotes.id, quoteId));
      return holdUntil;
    });
    return { ok: true, holdUntil: until };
  } catch (e) {
    return { ok: false, reason: msg(e) };
  }
}

type ExtendArgs = { quoteId: number; extraHours: number; reason: string; now?: Date };

// Perpanjang lease hold aktif. Rentang occupied tidak berubah.
export async function extendHold(db: DB, { quoteId, extraHours, reason, now = new Date() }: ExtendArgs): Promise<HoldResult> {
  if (!reason || !reason.trim()) return { ok: false, reason: 'Perpanjangan wajib beralasan' };
  try {
    await db.transaction(async (tx) => {
      const [q] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).for('update');
      if (!q) throw new Error('Quote tidak ditemukan');
      if (effectiveStatus(q, now) !== 'held') throw new Error('Hanya hold aktif yang bisa diperpanjang');

      const newLease = new Date((q.holdUntil?.getTime() ?? now.getTime()) + extraHours * HOUR_MS);
      await tx.update(holds).set({ holdUntil: newLease }).where(eq(holds.quoteId, quoteId));
      await tx.update(quotes).set({ holdUntil: newLease, extendReason: reason.trim() }).where(eq(quotes.id, quoteId));
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: msg(e) };
  }
}

// DP terverifikasi: lease melar jadi sampai trip selesai (occupiedUntil) → unit
// tak bisa di-hold orang lain sampai trip bubar.
export async function convertHoldToHardLock(
  db: DB,
  { quoteId }: { quoteId: number },
): Promise<HoldResult> {
  try {
    await db.transaction(async (tx) => {
      const [q] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).for('update');
      if (!q) throw new Error('Quote tidak ditemukan');
      if (q.status !== 'held') throw new Error(`Hard lock hanya dari status held (sekarang: ${q.status})`);

      const holdsRows = await tx.select().from(holds).where(eq(holds.quoteId, quoteId));
      if (holdsRows.length === 0) throw new Error('Tidak ada unit yang ditahan');
      const hard = new Date(
        Math.max(...holdsRows.map((h) => h.occupiedUntil.getTime()), Date.now()),
      );

      await tx.update(holds).set({ holdUntil: hard }).where(eq(holds.quoteId, quoteId));
      await tx.update(quotes).set({ status: 'dp_paid', holdUntil: hard }).where(eq(quotes.id, quoteId));
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: msg(e) };
  }
}

type ReleaseArgs = { quoteId: number; now?: Date };

export async function releaseHold(db: DB, { quoteId, now = new Date() }: ReleaseArgs): Promise<HoldResult> {
  try {
    await db.transaction(async (tx) => {
      const [q] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).for('update');
      if (!q) throw new Error('Quote tidak ditemukan');
      const st = effectiveStatus(q, now);
      if (!['quoted', 'held', 'expired'].includes(st)) {
        throw new Error(`Release tidak diizinkan dari status ${st}`);
      }
      await tx.delete(holds).where(eq(holds.quoteId, quoteId));
      await tx.update(quotes).set({ status: 'quoted', holdUntil: null, extendReason: null }).where(eq(quotes.id, quoteId));
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: msg(e) };
  }
}

// Sweep on read: held yang lease-nya lewat → expired; baris hold dilepas.
export async function sweepExpired(db: DB, now = new Date()): Promise<number> {
  return await db.transaction(async (tx) => {
    const affected = await tx
      .update(quotes)
      .set({ status: 'expired' })
      .where(and(eq(quotes.status, 'held'), lt(quotes.holdUntil, now)))
      .returning({ id: quotes.id });
    if (affected.length > 0) {
      await tx
        .delete(holds)
        .where(
          and(
            lt(holds.holdUntil, now),
            inArray(holds.quoteId, affected.map((a) => a.id)),
          ),
        );
    }
    return affected.length;
  });
}

export async function cancelQuote(db: DB, { quoteId }: { quoteId: number }): Promise<HoldResult> {
  try {
    await db.transaction(async (tx) => {
      const [q] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).for('update');
      if (!q) throw new Error('Quote tidak ditemukan');
      if (!canTransition(q.status as QuoteStatus, 'cancelled')) {
        throw new Error(`Tidak bisa membatalkan dari status ${q.status}`);
      }
      await tx.delete(holds).where(eq(holds.quoteId, quoteId));
      await tx.update(quotes).set({ status: 'cancelled', holdUntil: null }).where(eq(quotes.id, quoteId));
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: msg(e) };
  }
}
