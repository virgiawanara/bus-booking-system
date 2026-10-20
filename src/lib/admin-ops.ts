import { eq, sql } from 'drizzle-orm';
import type { DB } from '@/db';
import { feedback, holds, quotes } from '@/db/schema';
import { canTransition, type QuoteStatus } from './status';

export type OpResult = { ok: true } | { ok: false; reason: string };

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function transition(db: DB, quoteId: number, to: QuoteStatus, patch?: Partial<typeof quotes.$inferInsert>): Promise<OpResult> {
  try {
    await db.transaction(async (tx) => {
      const [q] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).for('update');
      if (!q) throw new Error('Quote tidak ditemukan');
      if (!canTransition(q.status as QuoteStatus, to)) {
        throw new Error(`Transisi ${q.status} -> ${to} tidak legal`);
      }
      await tx.update(quotes).set({ status: to, ...patch }).where(eq(quotes.id, quoteId));
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: msg(e) };
  }
}

export async function setFinalPrice(db: DB, { quoteId, finalPrice }: { quoteId: number; finalPrice: number }): Promise<OpResult> {
  if (!Number.isInteger(finalPrice) || finalPrice <= 0) return { ok: false, reason: 'Harga final tidak valid' };
  try {
    await db.update(quotes).set({ finalPrice }).where(eq(quotes.id, quoteId));
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: msg(e) };
  }
}

// Nomor SPK global tahunan: SPK/<tahun>/<seq>
export async function issueSpk(db: DB, { quoteId }: { quoteId: number }): Promise<OpResult> {
  try {
    let number: string = '';
    await db.transaction(async (tx) => {
      const [q] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).for('update');
      if (!q) throw new Error('Quote tidak ditemukan');
      if (!canTransition(q.status as QuoteStatus, 'spk_issued')) {
        throw new Error(`SPK hanya bisa diterbitkan dari confirmed (sekarang: ${q.status})`);
      }
      const year = new Date().getFullYear();
      const [{ maxSeq }] = await tx
        .select({
          maxSeq: sql<number>`coalesce(max(split_part(${quotes.spkNumber}, '/', 3)::int), 0)`,
        })
        .from(quotes)
        .where(sql`${quotes.spkNumber} like ${'SPK/' + year + '/%'}`);
      number = `SPK/${year}/${String(Number(maxSeq) + 1).padStart(4, '0')}`;
      await tx.update(quotes).set({ status: 'spk_issued', spkNumber: number }).where(eq(quotes.id, quoteId));
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: msg(e) };
  }
}

export function markDispatched(db: DB, { quoteId }: { quoteId: number }) {
  return transition(db, quoteId, 'dispatched');
}

// Selesai trip + bersihkan baris hold (lease trip sudah lewat; jangan menumpuk).
export async function markCompleted(db: DB, { quoteId }: { quoteId: number }): Promise<OpResult> {
  try {
    await db.transaction(async (tx) => {
      const [q] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).for('update');
      if (!q) throw new Error('Quote tidak ditemukan');
      if (!canTransition(q.status as QuoteStatus, 'completed')) {
        throw new Error(`Transisi ${q.status} -> completed tidak legal`);
      }
      await tx.update(quotes).set({ status: 'completed' }).where(eq(quotes.id, quoteId));
      await tx.delete(holds).where(eq(holds.quoteId, quoteId));
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: msg(e) };
  }
}

export async function markContacted(db: DB, { quoteId }: { quoteId: number }): Promise<OpResult> {
  try {
    await db.update(quotes).set({ contactedAt: new Date() }).where(eq(quotes.id, quoteId));
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: msg(e) };
  }
}

// Token feedback idempotent per order (dikirim admin manual via WA).
export async function ensureFeedbackToken(db: DB, { quoteId }: { quoteId: number }): Promise<string | null> {
  const existing = await db.select().from(feedback).where(eq(feedback.quoteId, quoteId));
  if (existing.length > 0) return existing[0].token;
  const token = crypto.randomUUID();
  await db.insert(feedback).values({ quoteId, token });
  return token;
}


