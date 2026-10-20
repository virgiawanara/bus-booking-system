import { eq } from 'drizzle-orm';
import type { DB } from '@/db';
import { holds, payments, quotes } from '@/db/schema';

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

function validAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0;
}

// DP: SATU transaksi — cek status, catat pembayaran, hard lock unit, set dp_paid.
// Atomik karena kegagalan di tengah (mis. nominal jelek) tidak boleh meninggalkan
// status berubah tanpa baris pembayaran (retry jadi mustahil).
export async function verifyDpPayment(db: DB, args: VerifyPaymentArgs): Promise<PaymentResult> {
  try {
    if (!validAmount(args.amount)) return { ok: false, reason: 'Nominal DP tidak valid' };
    await db.transaction(async (tx) => {
      const [q] = await tx.select().from(quotes).where(eq(quotes.id, args.quoteId)).for('update');
      if (!q) throw new Error('Quote tidak ditemukan');
      if (q.status !== 'held') {
        throw new Error(`DP hanya bisa diverifikasi dari status held (sekarang: ${q.status})`);
      }
      const rows = await tx.select().from(holds).where(eq(holds.quoteId, args.quoteId));
      if (rows.length === 0) throw new Error('Tidak ada unit yang ditahan');
      const hard = new Date(Math.max(...rows.map((h) => h.occupiedUntil.getTime()), Date.now()));
      await tx.insert(payments).values({
        quoteId: args.quoteId,
        kind: 'dp',
        amount: args.amount,
        paidAt: args.paidAt,
        proofUrl: args.proofUrl ?? null,
        verifiedAt: new Date(),
      });
      await tx.update(holds).set({ holdUntil: hard }).where(eq(holds.quoteId, args.quoteId));
      await tx.update(quotes).set({ status: 'dp_paid', holdUntil: hard }).where(eq(quotes.id, args.quoteId));
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: msg(e) };
  }
}

// Pelunasan: dp_paid -> confirmed, satu transaksi.
export async function verifyPelunasanPayment(db: DB, args: VerifyPaymentArgs): Promise<PaymentResult> {
  try {
    if (!validAmount(args.amount)) return { ok: false, reason: 'Nominal pelunasan tidak valid' };
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
