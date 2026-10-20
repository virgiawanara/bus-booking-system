'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb, type DB } from '@/db';
import { assignments, crew, settings, unitTypes, units } from '@/db/schema';
import { requireAdmin, loginAdmin, logoutAdmin, allowLoginAttempt } from '@/lib/auth';
import { normalizePhone } from '@/lib/wa-template';
import { headers } from 'next/headers';
import { holdQuote, extendHold, releaseHold, cancelQuote } from '@/lib/holds';
import { verifyDpPayment, verifyPelunasanPayment } from '@/lib/payments';
import {
  issueSpk,
  markDispatched,
  markCompleted,
  markContacted,
  setFinalPrice,
  ensureFeedbackToken,
} from '@/lib/admin-ops';
import { getSettings } from '@/lib/settings';

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

function num(fd: FormData, key: string): number {
  return Number(s(fd, key));
}

function back(id: number, err: string): never {
  redirect(`/admin/q/${id}?err=${encodeURIComponent(err)}`);
}

function done(id: number, msg: string): never {
  redirect(`/admin/q/${id}?ok=${encodeURIComponent(msg)}`);
}

async function guard<T>(id: number, fn: (db: DB) => Promise<T>): Promise<T> {
  await requireAdmin();
  try {
    return await fn(getDb());
  } catch (e) {
    back(id, e instanceof Error ? e.message : String(e));
  }
}

function flushed(path: string, msg: string): never {
  revalidatePath(path);
  redirect(`${path}?ok=${encodeURIComponent(msg)}`);
}

export async function loginAction(fd: FormData): Promise<void> {
  const ip = ((await headers()).get('x-forwarded-for') ?? 'local').split(',')[0].trim() || 'local';
  if (!allowLoginAttempt(`login:${ip}`)) {
    redirect('/admin/login?err=' + encodeURIComponent('Terlalu banyak percobaan — coba beberapa menit lagi'));
  }
  const password = s(fd, 'password');
  if (!(await loginAdmin(password))) {
    redirect('/admin/login?err=' + encodeURIComponent('Password salah'));
  }
  redirect('/admin');
}

export async function logoutAction(): Promise<void> {
  await requireAdmin();
  await logoutAdmin();
  redirect('/admin/login');
}

export async function holdAction(fd: FormData): Promise<void> {
  const quoteId = num(fd, 'quoteId');
  const unitIds = fd.getAll('unitIds').map((v) => Number(v)).filter(Number.isInteger);
  const settings = await guard(quoteId, () => getSettings());
  const res = await holdQuote(getDb(), {
    quoteId,
    unitIds,
    holdHours: settings.HOLD_HOURS,
    bufferHours: settings.BUFFER_HOURS,
  });
  if (!res.ok) back(quoteId, res.reason);
  done(quoteId, 'Unit ditahan (harga hold 1x24 jam berlaku)');
}

export async function extendAction(fd: FormData): Promise<void> {
  const quoteId = num(fd, 'quoteId');
  const res = await guard(quoteId, () =>
    extendHold(getDb(), { quoteId, extraHours: num(fd, 'extraHours'), reason: s(fd, 'reason') }),
  );
  if (!res.ok) back(quoteId, res.reason);
  done(quoteId, 'Hold diperpanjang');
}

export async function releaseAction(fd: FormData): Promise<void> {
  const quoteId = num(fd, 'quoteId');
  const res = await guard(quoteId, () => releaseHold(getDb(), { quoteId }));
  if (!res.ok) back(quoteId, res.reason);
  done(quoteId, 'Hold dilepas');
}

export async function cancelAction(fd: FormData): Promise<void> {
  const quoteId = num(fd, 'quoteId');
  const res = await guard(quoteId, () => cancelQuote(getDb(), { quoteId }));
  if (!res.ok) back(quoteId, res.reason);
  done(quoteId, 'Quote dibatalkan');
}

export async function verifyDpAction(fd: FormData): Promise<void> {
  const quoteId = num(fd, 'quoteId');
  const res = await guard(quoteId, () =>
    verifyDpPayment(getDb(), {
      quoteId,
      amount: num(fd, 'amount'),
      paidAt: new Date(),
      proofUrl: s(fd, 'proofUrl') || null,
    }),
  );
  if (!res.ok) back(quoteId, res.reason);
  done(quoteId, 'DP terverifikasi — unit terkunci sampai trip selesai');
}

export async function verifyPelunasanAction(fd: FormData): Promise<void> {
  const quoteId = num(fd, 'quoteId');
  const res = await guard(quoteId, () =>
    verifyPelunasanPayment(getDb(), {
      quoteId,
      amount: num(fd, 'amount'),
      paidAt: new Date(),
      proofUrl: s(fd, 'proofUrl') || null,
    }),
  );
  if (!res.ok) back(quoteId, res.reason);
  done(quoteId, 'Pelunasan terverifikasi');
}

export async function finalPriceAction(fd: FormData): Promise<void> {
  const quoteId = num(fd, 'quoteId');
  const res = await guard(quoteId, () => setFinalPrice(getDb(), { quoteId, finalPrice: num(fd, 'finalPrice') }));
  if (!res.ok) back(quoteId, res.reason);
  done(quoteId, 'Harga final disimpan');
}

export async function spkAction(fd: FormData): Promise<void> {
  const quoteId = num(fd, 'quoteId');
  const res = await guard(quoteId, () => issueSpk(getDb(), { quoteId }));
  if (!res.ok) back(quoteId, res.reason);
  done(quoteId, 'SPK diterbitkan');
}

export async function dispatchedAction(fd: FormData): Promise<void> {
  const quoteId = num(fd, 'quoteId');
  const crewIds = fd.getAll('crewIds').map((v) => Number(v)).filter(Number.isInteger);
  if (crewIds.length === 0) back(quoteId, 'Pilih minimal 1 kru');
  await guard(quoteId, async (db) => {
    const r = await markDispatched(db, { quoteId });
    if (!r.ok) throw new Error(r.reason);
    await db.transaction(async (tx) => {
      await tx.delete(assignments).where(eq(assignments.quoteId, quoteId));
      await tx.insert(assignments).values(crewIds.map((crewId) => ({ quoteId, crewId, sentAt: new Date() })));
    });
  });
  done(quoteId, 'Kru tercatat terkirim');
}

export async function completedAction(fd: FormData): Promise<void> {
  const quoteId = num(fd, 'quoteId');
  const res = await guard(quoteId, () => markCompleted(getDb(), { quoteId }));
  if (!res.ok) back(quoteId, res.reason);
  done(quoteId, 'Trip ditandai selesai');
}

export async function contactedAction(fd: FormData): Promise<void> {
  const quoteId = num(fd, 'quoteId');
  const res = await guard(quoteId, () => markContacted(getDb(), { quoteId }));
  if (!res.ok) back(quoteId, res.reason);
  done(quoteId, 'Ditandai sudah dihubungi');
}

export async function feedbackTokenAction(fd: FormData): Promise<void> {
  const quoteId = num(fd, 'quoteId');
  await guard(quoteId, () => ensureFeedbackToken(getDb(), { quoteId }));
  done(quoteId, 'Link feedback siap dikirim');
}

// ---- Fleet & settings ----

export async function saveUnitTypeAction(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = s(fd, 'id') ? Number(s(fd, 'id')) : undefined;
  const name = s(fd, 'name');
  const seats = num(fd, 'seats');
  const rate = num(fd, 'ratePerDay');
  const image = s(fd, 'imageUrl');
  const facilities = s(fd, 'facilities')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (!name || !Number.isInteger(seats) || seats <= 0 || !Number.isInteger(rate) || rate <= 0) {
    redirect('/admin/fleet?err=' + encodeURIComponent('Data tipe unit tidak valid'));
  }
  try {
    if (id) {
      await getDb()
        .update(unitTypes)
        .set({ name, seats, ratePerDay: rate, imageUrl: image || null, facilities })
        .where(eq(unitTypes.id, id));
    } else {
      await getDb().insert(unitTypes).values({ name, seats, ratePerDay: rate, imageUrl: image || null, facilities });
    }
  } catch (e) {
    redirect('/admin/fleet?err=' + encodeURIComponent(e instanceof Error ? e.message : String(e)));
  }
  flushed('/admin/fleet', 'Tipe unit disimpan');
}

export async function saveUnitAction(fd: FormData): Promise<void> {
  await requireAdmin();
  const typeId = num(fd, 'typeId');
  const plate = s(fd, 'plate');
  if (!typeId || !plate) redirect('/admin/fleet?err=' + encodeURIComponent('Unit tidak valid'));
  await getDb().insert(units).values({ typeId, plate });
  flushed('/admin/fleet', 'Unit ditambahkan');
}

export async function toggleUnitAction(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = num(fd, 'id');
  const active = s(fd, 'active') === '1';
  await getDb().update(units).set({ active }).where(eq(units.id, id));
  flushed('/admin/fleet', 'Unit diubah');
}

export async function saveCrewAction(fd: FormData): Promise<void> {
  await requireAdmin();
  const name = s(fd, 'name');
  const role = s(fd, 'role');
  let phone: string;
  try {
    phone = normalizePhone(s(fd, 'phone'));
  } catch {
    redirect('/admin/fleet?err=' + encodeURIComponent('Nomor WhatsApp kru tidak valid'));
  }
  if (!name || (role !== 'driver' && role !== 'co_driver')) {
    redirect('/admin/fleet?err=' + encodeURIComponent('Nama atau role kru tidak valid'));
  }
  try {
    await getDb().insert(crew).values({ name, phone, role });
  } catch (e) {
    redirect('/admin/fleet?err=' + encodeURIComponent(e instanceof Error ? e.message : String(e)));
  }
  flushed('/admin/fleet', 'Kru ditambahkan');
}

export async function toggleCrewAction(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = num(fd, 'id');
  const active = s(fd, 'active') === '1';
  await getDb().update(crew).set({ active }).where(eq(crew.id, id));
  flushed('/admin/fleet', 'Kru diubah');
}

export async function saveSettingsAction(fd: FormData): Promise<void> {
  await requireAdmin();
  const keys = ['PO_NAME', 'WA_NUMBER', 'DP_PERCENT', 'PELUNASAN_H', 'HOLD_HOURS', 'BUFFER_HOURS'];
  const db = getDb();
  for (const k of keys) {
    const v = s(fd, k);
    if (!v) continue;
    await db
      .insert(settings)
      .values({ key: k, value: v })
      .onConflictDoUpdate({ target: settings.key, set: { value: v } });
  }
  flushed('/admin/settings', 'Pengaturan disimpan');
}
