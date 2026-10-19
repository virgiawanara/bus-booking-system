import { eq } from 'drizzle-orm';
import type { DB } from '@/db';
import { payments, quotes } from '@/db/schema';
import { convertHoldToHardLock } from './holds';

export type PaymentResult = { ok: true } | { ok: false; reason: string };

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// Satu aksi admin: catat pembayaran + verifikasi (single operator).
export type VerifyPaymentArgs = {
  quoteId: number;
  amount: number;
  paidAt: Date;
  proofUrl?: string | null;
};

// DP: status held -> dp_paid + hard lock unit sampai trip selesai.
export async function verifyDpPayment(db: DB, args: VerifyPaymentArgs): Promise<PaymentResult> {
  try {
    const locked = await convertHoldToHardLock(db, { quoteId: args.quoteId });
    if (!locked.ok) return { ok: false, reason: locked.reason };
    await db.transaction(async (tx) => {
      await tx.insert(payments).values({
        quoteId: args.quoteId,
        kind: 'dp',
        amount: args.amount,
        paidAt: args.paidAt,
        proofUrl: args.proofUrl ?? null,
        verifiedAt: new Date(),
      });
      await tx.update(quotes).set({ status: 'dp_paid' }).where(eq(quotes.id, args.quoteId));
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: msg(e) };
  }
}

// Pelunasan: dp_paid -> confirmed.
export async function verifyPelunasanPayment(db: DB, args: VerifyPaymentArgs): Promise<PaymentResult> {
  try {
    await db.transaction(async (tx) => {
      const [q] = await tx.select().from(quotes).where(eq(quotes.id, args.quoteId)).for('update');
      if (!q) throw new Error('Quote tidak ditemukan');
      if (q.status !== 'dp_paid') {
        throw new Error(`Pelunasan hanya dari status dp_paid (sekarang: ${q.status})`);
      }
      await tx.insert(payments).values({
        quoteId: args.quoteId,
        kind: 'pelunasan',
        amount: args.amount,
        paidAt: args.paidAt,
        proofUrl: args.proofUrl ?? null,
        verifiedAt: new Date(),
      });
      await tx.update(quotes).set({ status: 'confirmed' }).where(eq(quotes.id, args.quoteId));
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: msg(e) };
  }
}
