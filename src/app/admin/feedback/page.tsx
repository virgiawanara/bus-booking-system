// Halaman dinamis (cookies + DB) — blok eksplisit untuk Next Cache Components.
export const instant = false;

import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { getDb } from '@/db';
import { feedbackDue } from '@/lib/admin-data';
import { Card, Pill, Button, cx } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import { feedbackTokenAction } from '@/app/admin-actions';
import { getSettings } from '@/lib/settings';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

export default async function FeedbackAdminPage() {
  await requireAdmin();
  const [rows, settings] = await Promise.all([feedbackDue(getDb()), getSettings()]);

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Feedback H+1</h1>
          <p className="text-sm text-ink-soft">
            Trip yang selesai ≤14 hari. Buat link rating, kirim via WA, admin menandai sendiri (tanpa auto-send).
          </p>
        </div>
        <Link href="/admin" className="text-sm text-ink-soft hover:text-ink">← Antrian</Link>
      </div>

      {rows.length === 0 ? (
        <Card><p className="text-sm text-ink-soft">Belum ada trip yang selesai dalam 14 hari terakhir.</p></Card>
      ) : null}

      <div className="grid gap-3">
        {rows.map(({ q, typeName, fbRow }) => {
          const link = fbRow ? `${BASE_URL}/feedback/${fbRow.token}` : null;
          const sendMsg = `Terima kasih telah memesan bus di ${settings.PO_NAME} 🙏\nBantu kami dengan memberi rating perjalanan ${q.code}:\n${link ?? ''}`;
          return (
            <Card key={q.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{q.code}</span>
                    <Pill tone={fbRow?.submittedAt ? 'ok' : 'neutral'}>
                      {fbRow ? (fbRow.submittedAt ? 'sudah dinilai' : 'link dibuat') : 'belum ada link'}
                    </Pill>
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">
                    {q.picName} · {fmtDate(q.endAt)} selesai · {q.unitCount}× {typeName}
                  </p>
                  {fbRow?.rating ? (
                    <p className="mt-0.5 text-[13px] font-semibold">
                      Rating {fbRow.rating}/5{fbRow.comment ? ` · "${fbRow.comment}"` : ''}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {fbRow ? (
                    <>
                      <Link href={`/feedback/${fbRow.token}`} target="_blank">
                        <Button variant="ghost">Buka form</Button>
                      </Link>
                      <a
                        href={`https://wa.me/${q.phone}?text=${encodeURIComponent(sendMsg)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button>Kirim link via WA</Button>
                      </a>
                    </>
                  ) : (
                    <form action={feedbackTokenAction}>
                      <input type="hidden" name="quoteId" value={q.id} />
                      <Button variant="ghost">Buat link feedback</Button>
                    </form>
                  )}
                </div>
              </div>
              {fbRow?.token ? (
                <p className={cx('mt-2 rounded-xl bg-bg px-3 py-2 text-xs text-ink-soft')}>
                  Link: <code>{link}</code>
                </p>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

