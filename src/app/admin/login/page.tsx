// Halaman dinamis (cookies + DB) — blok eksplisit untuk Next Cache Components.
export const instant = false;

import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { loginAction } from '@/app/admin-actions';
import { Card, Input } from '@/components/ui';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  if (await isAdmin()) redirect('/admin');
  const { err } = await searchParams;
  return (
    <Card className="mx-auto mt-16 max-w-sm">
      <h1 className="mb-1 text-xl font-extrabold tracking-tight">Login Admin</h1>
      <p className="mb-4 text-sm text-ink-soft">Satu akun admin untuk seluruh kantor.</p>
      {err ? <p className="mb-3 text-sm font-semibold text-danger">{err}</p> : null}
      <form action={loginAction} className="grid gap-3">
        <Input type="password" name="password" placeholder="Password admin" autoFocus required />
        <button className="w-full rounded-full bg-accent px-5 py-3 text-[15px] font-semibold text-accent-ink">Masuk</button>
      </form>
    </Card>
  );
}

