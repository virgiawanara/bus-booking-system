import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const COOKIE = 'bb_admin';
const MAX_AGE_S = 7 * 24 * 3600;

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 8) throw new Error('ADMIN_SESSION_SECRET wajib diisi di .env');
  return s;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

export function makeSessionValue(nowMs = Date.now()): string {
  const payload = `admin.${nowMs}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionValue(value: string | undefined): boolean {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  const { 0: user, 1: ts, 2: sig } = parts;
  if (user !== 'admin') return false;
  const now = Date.now();
  const issued = Number(ts);
  if (!Number.isFinite(issued) || now - issued > MAX_AGE_S * 1000) return false;
  const expect = sign(`${user}.${ts}`);
  try {
    return timingSafeEqual(Buffer.from(expect), Buffer.from(sig));
  } catch {
    return false;
  }
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySessionValue(store.get(COOKIE)?.value);
}

// Guard untuk setiap halaman admin (bukan middleware; Next 16 + Cache Components).
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect('/admin/login');
}

export async function loginAdmin(password: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || password !== expected) return false;
  const store = await cookies();
  store.set(COOKIE, makeSessionValue(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_S,
    path: '/',
  });
  return true;
}

export async function logoutAdmin(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
