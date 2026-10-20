// Halaman dinamis (cookies + DB) — blok eksplisit untuk Next Cache Components.
export const instant = false;

import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { getDb } from '@/db';
import { listAdminQuotes, listRecentClosed } from '@/lib/admin-data';
import { Card, Pill } from '@/components/ui';
import { STATUS_LABEL, type QuoteStatus } from '@/lib/status';
import { fmtDate, fmtIDR } from '@/lib/format';

function pillTone(status: string): 'neutral' | 'ok' | 'warn' | 'danger' {
  switch (status) {
    case 'held': return 'warn';
    case 'dp_paid': return 'ok';
    case 'confirmed': return 'ok';
    case 'spk_issued': return 'ok';
    case 'dispatched': return 'ok';
    case 'cancelled':
    case 'expired': return 'danger';
    default: return 'neutral';
  }
}

export default async function AdminQueuePage() {
  await requireAdmin();
  const [rows, closed] = await Promise.all([listAdminQuotes(getDb()), listRecentClosed(getDb())]);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Antrian Inquiry</h1>
        <p className="text-sm text-ink-soft">Quote masuk dari form publik. Hubungi, tahan unit, amankan DP.</p>
      </div>
      {rows.length === 0 ? (
        <Card><p className="text-sm text-ink-soft">Belum ada inquiry. Coba isi form publik untuk uji.</p></Card>
      ) : null}
      <div className="grid gap-3">
        {rows.map(({ q, typeName }) => {
          const expired = q.status === 'expired';
          return (
            <Link key={q.id} href={`/admin/q/${q.id}`} className="block">
              <Card className="transition hover:shadow-md">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{q.code}</span>
                      <Pill tone={expired ? 'danger' : pillTone(q.status)}>
                        {expired ? 'Hold Lewat' : STATUS_LABEL[q.status as QuoteStatus]}
                      </Pill>
                      {q.contactedAt ? <span className="text-[11px] text-ink-soft">sudah dihubungi</span> : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-ink-soft">
                      {q.picName} Â· {q.phone} Â· {q.origin} â†’ {q.destination}
                    </p>
                    <p className="mt-0.5 text-[13px] text-ink-soft">
                      {fmtDate(q.startAt)} â†’ {fmtDate(q.endAt)} Â· {q.unitCount}Ã— {typeName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{fmtIDR(q.estimate)}</p>
                    {q.finalPrice ? <p className="text-xs text-ink-soft">Final {fmtIDR(q.finalPrice)}</p> : null}
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
      {closed.length > 0 ? (
        <div>
          <h2 className="mb-2 mt-4 text-sm font-bold text-ink-soft">Riwayat selesai / dibatalkan</h2>
          <div className="grid gap-2">
            {closed.map(({ q }) => (
              <Link key={q.id} href={`/admin/q/${q.id}`} className="flex items-center justify-between rounded-[18px] bg-surface px-4 py-2.5 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <span className="text-ink-soft">{q.code} Â· {STATUS_LABEL[q.status as QuoteStatus]} Â· {fmtDate(q.startAt)}</span>
                <span className="font-semibold">{q.picName}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

