// Halaman dinamis (cookies + DB) — blok eksplisit untuk Next Cache Components.
export const instant = false;

import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { feedback, quotes } from '@/db/schema';
import { getSettings } from '@/lib/settings';
import { fmtDate } from '@/lib/format';
import { submitFeedbackAction } from '@/app/feedback-actions';

type Params = Promise<{ token: string }>;
type Search = Promise<{ thanks?: string; err?: string }>;

export default async function FeedbackPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { token } = await params;
  const { thanks, err } = await searchParams;

  const [row] = await getDb()
    .select({ fb: feedback, q: quotes })
    .from(feedback)
    .innerJoin(quotes, eq(quotes.id, feedback.quoteId))
    .where(eq(feedback.token, token));
  if (!row) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-4">
        <p className="text-center text-sm text-ink-soft">Link feedback tidak valid.</p>
      </main>
    );
  }
  const { fb, q } = row;
  const settings = await getSettings();

  if (fb.submittedAt || thanks) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-8">
        <div className="rounded-[18px] bg-surface p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <p className="text-4xl">🙏</p>
          <h1 className="mt-3 text-xl font-extrabold tracking-tight">Terima kasih!</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Penilaian Anda untuk perjalanan {q.code} sudah kami terima. Sampai jumpa di trip berikutnya.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-4 py-10">
      <header className="mb-5">
        <span className="text-sm font-bold tracking-tight">{settings.PO_NAME}</span>
        <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight">Bagaimana perjalanannya?</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {q.code} · {q.origin} → {q.destination} · selesai {fmtDate(q.endAt)}
        </p>
      </header>

      {err ? (
        <p className="mb-3 rounded-2xl border border-danger/30 bg-danger/5 p-3 text-sm font-semibold text-danger">{err}</p>
      ) : null}

      <form action={submitFeedbackAction} className="grid gap-4 rounded-[18px] bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <input type="hidden" name="token" value={token} />
        <div>
          <span className="mb-2 block text-[13px] font-semibold">Rating</span>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-3.5 py-2.5 text-sm font-semibold hover:border-ink/40">
                <input type="radio" name="rating" value={n} required className="size-4" />
                {n} ★
              </label>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">Catatan (opsional)</span>
          <textarea
            name="comment"
            rows={3}
            placeholder="Komentar tentang bus, driver, kebersihan, dsb."
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-[15px] outline-none focus:border-ink"
          />
        </label>
        <button className="rounded-full bg-accent px-5 py-3 text-[15px] font-semibold text-accent-ink">Kirim penilaian</button>
      </form>
    </main>
  );
}

