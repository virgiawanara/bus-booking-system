import Link from 'next/link';
import { isAdmin } from '@/lib/auth';
import { logoutAction } from '@/app/admin-actions';
import { getSettings } from '@/lib/settings';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin();
  const settings = await getSettings();
  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-6">
      {admin ? (
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm font-semibold">
            <Link className="text-ink" href="/admin">Antrian</Link>
            <Link className="text-ink-soft hover:text-ink" href="/admin/dispatch">Dispatch</Link>
            <Link className="text-ink-soft hover:text-ink" href="/admin/feedback">Feedback</Link>
            <Link className="text-ink-soft hover:text-ink" href="/admin/fleet">Armada</Link>
            <Link className="text-ink-soft hover:text-ink" href="/admin/settings">Setelan</Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs font-semibold text-ink-soft sm:inline">{settings.PO_NAME}</span>
            <form action={logoutAction}>
              <button className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink">
                Keluar
              </button>
            </form>
          </div>
        </header>
      ) : null}
      {children}
    </div>
  );
}
