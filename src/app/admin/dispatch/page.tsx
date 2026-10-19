// Halaman dinamis (cookies + DB) — blok eksplisit untuk Next Cache Components.
export const instant = false;

import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { getDb } from '@/db';
import { dispatchDue } from '@/lib/admin-data';
import { Card, Pill } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';

export default async function DispatchPage() {
  await requireAdmin();
  const rows = await dispatchDue(getDb());

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dispatch H-1</h1>
          <p className="text-sm text-ink-soft">Keberangkatan â‰¤36 jam: konfirmasi kru, kirim kontak ke pelanggan, koordinasi titik jemput.</p>
        </div>
        <Link href="/admin" className="text-sm text-ink-soft hover:text-ink">â† Antrian</Link>
      </div>

      {rows.length === 0 ? (
        <Card><p className="text-sm text-ink-soft">Tidak ada keberangkatan dalam 36 jam ke depan.</p></Card>
      ) : null}
      <div className="grid gap-3">
        {rows.map(({ q, typeName }) => (
          <Link key={q.id} href={`/admin/q/${q.id}`} className="block">
            <Card className="transition hover:shadow-md">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{q.code}</span>
                    <Pill tone={q.status === 'dispatched' ? 'ok' : 'warn'}>
                      {q.status === 'dispatched' ? 'Kru terkirim âœ“' : 'Belum dispatch'}
                    </Pill>
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">
                    {q.picName} Â· {q.pickupPoint}
                  </p>
                  <p className="text-[13px] text-ink-soft">
                    Berangkat {fmtDateTime(q.startAt)} Â· {q.unitCount}Ã— {typeName} Â· {q.pax} pax
                  </p>
                </div>
                <span className="text-xs font-semibold text-ink-soft">Standby {q.standbyTime} WIB</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
      <p className="text-center text-xs text-ink-soft">Kontak kru + koordinasi titik jemput dikirim lewat halaman detail (Antrian â†’ detail â†’ Kru).</p>
    </div>
  );
}

