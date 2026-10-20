// Halaman dinamis (cookies + DB) — blok eksplisit untuk Next Cache Components.
export const instant = false;

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { getDb } from '@/db';
import { getQuoteDetail } from '@/lib/admin-data';
import { getSettings } from '@/lib/settings';
import { Card, Button, Input, Pill, cx } from '@/components/ui';
import { STATUS_LABEL, type QuoteStatus } from '@/lib/status';
import { fmtDate, fmtDateTime, fmtIDR, waPhoneLink } from '@/lib/format';

import {
  holdAction,
  extendAction,
  releaseAction,
  cancelAction,
  verifyDpAction,
  verifyPelunasanAction,
  finalPriceAction,
  spkAction,
  dispatchedAction,
  completedAction,
  contactedAction,
  feedbackTokenAction,
} from '@/app/admin-actions';
import { CrewWaButton } from '@/components/admin/crew-wa-button';

type Params = Promise<{ id: string }>;
type Search = Promise<{ err?: string; ok?: string }>;

export default async function QuoteDetailPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  await requireAdmin();
  const { id: idRaw } = await params;
  const { err, ok } = await searchParams;
  const id = Number(idRaw);
  if (!Number.isInteger(id)) notFound();

  const detail = await getQuoteDetail(getDb(), id);
  if (!detail) notFound();
  const { q, type, holdRows, fleetUnits, payRows, crewRows, assignedRows, fb, clashUnitIds } = detail;
  const settings = await getSettings();

  const dpPaid = payRows.some((p) => p.kind === 'dp' && p.verifiedAt);
  const pelunasanPaid = payRows.some((p) => p.kind === 'pelunasan' && p.verifiedAt);
  const dpAmount = payRows.filter((p) => p.kind === 'dp').reduce((a, p) => a + p.amount, 0);
  const allPelunasan = payRows.filter((p) => p.kind === 'pelunasan').reduce((a, p) => a + p.amount, 0);
  const dpIdeal = Math.round((q.estimate * settings.DP_PERCENT) / 100);

  const crewIds = assignedRows.length > 0 ? assignedRows.map((a) => a.crewId) : [];
  const assignedCrew = crewRows.filter((c) => crewIds.includes(c.id));
  const crewMsg = [
    `Halo ${q.picName},`,
    '',
    `Ini kontak kru untuk trip ${q.code} PO ${settings.PO_NAME}:`,
    ...(assignedCrew.length > 0
      ? assignedCrew.map((c) => `${c.role === 'driver' ? 'Driver' : 'Co-driver'}: ${c.name} - ${c.phone}`)
      : []),
    '',
    `${type?.name} Â· ${q.unitCount} unit`,
    `Rute: ${q.origin} -> ${q.destination}`,
    `Jadwal: ${fmtDate(q.startAt)} - ${fmtDate(q.endAt)}`,
    `Standby: ${q.standbyTime} WIB di ${q.pickupPoint}`,
    '',
    'Mohon koordinasi rute masuk bus besar untuk titik jemput. Terima kasih.',
  ].join('\n');

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/admin" className="text-ink-soft hover:text-ink">â† Antrian</Link>
      </div>

      {err ? <Card className="border border-danger/30"><p className="text-sm font-semibold text-danger">{err}</p></Card> : null}
      {ok ? <Card className="border border-ok/30"><p className="text-sm font-semibold text-ok">{ok}</p></Card> : null}

      {/* Ringkasan */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight">{q.code}</h1>
              <Pill tone={q.status === 'expired' ? 'danger' : q.status === 'held' ? 'warn' : 'ok'}>
                {STATUS_LABEL[q.status as QuoteStatus]}
              </Pill>
            </div>
            <p className="mt-1 text-sm text-ink-soft">{settings.PO_NAME} Â· dibuat {fmtDateTime(q.createdAt)}</p>
          </div>
          <div className="flex gap-2">
            <a href={waPhoneLink(q.phone, `Halo ${q.picName}, saya admin ${settings.PO_NAME} soal quote ${q.code}.`)} target="_blank" rel="noreferrer">
              <Button>WA ke PIC</Button>
            </a>
            <form action={contactedAction}>
              <input type="hidden" name="quoteId" value={q.id} />
              <Button variant="ghost" disabled={!!q.contactedAt}>{q.contactedAt ? 'Sudah dihubungi' : 'Tandai terhubungi'}</Button>
            </form>
          </div>
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Row k="PIC" v={q.picName} />
          <Row k="WA" v={q.phone} />
          <Row k="Rute" v={`${q.origin} â†’ ${q.destination}`} />
          <Row k="Jadwal" v={`${fmtDate(q.startAt)} â†’ ${fmtDate(q.endAt)} Â· standby ${q.standbyTime} WIB`} />
          <Row k="Titik jemput" v={q.pickupPoint} />
          <Row k="Kapasitas" v={`${type?.seats ?? '?'} seat Ã— ${q.unitCount} unit${q.luggageNote ? ` Â· bagasi: ${q.luggageNote}` : ''}`} />
          {q.notes ? <Row k="Catatan" v={q.notes} /> : null}
          <Row k="Estimasi sistem" v={fmtIDR(q.estimate)} />
          <Row k="Harga final" v={q.finalPrice ? fmtIDR(q.finalPrice) : 'â€” belum ditetapkan'} />
        </dl>
      </Card>

      {/* Hold unit */}
      <Card>
        <h2 className="mb-1 text-base font-bold">Unit Ditahan (Hold)</h2>
        <p className="mb-3 text-xs text-ink-soft">
          Hold lembut 1Ã—{settings.HOLD_HOURS} jam. Jatuh tempo: <b className="text-ink">{q.holdUntil ? fmtDateTime(q.holdUntil) : 'â€”'}</b>
        </p>
        {q.status === 'held' ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              {holdRows.map(({ h, plate }) => (
                <span key={h.id} className="rounded-full bg-warn/10 px-3 py-1.5 text-xs font-semibold text-warn">ðŸ”’ {plate}</span>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <form action={extendAction} className="flex items-center gap-2">
                <input type="hidden" name="quoteId" value={q.id} />
                <Input type="number" name="extraHours" min={1} max={72} defaultValue={24} className="!w-24" />
                <Input name="reason" placeholder="Alasan perpanjangâ€¦" required />
                <Button variant="ghost">Perpanjang</Button>
              </form>
              <form action={releaseAction} className="flex items-center">
                <input type="hidden" name="quoteId" value={q.id} />
                <Button variant="danger">Lepas hold</Button>
              </form>
            </div>
          </div>
        ) : ['quoted', 'expired'].includes(q.status) ? (
          <form action={holdAction} className="grid gap-3">
            <input type="hidden" name="quoteId" value={q.id} />
            <div className="grid gap-1.5">
              {fleetUnits.map((u) => {
                const clash = clashUnitIds.includes(u.id);
                return (
                  <label key={u.id} className={cx('flex items-center gap-3 rounded-xl border px-3 py-2 text-sm', clash ? 'border-danger/40 bg-danger/5' : 'border-line')}>
                    <input type="checkbox" name="unitIds" value={u.id} disabled={clash} className="size-4" />
                    <span className="font-semibold">{u.plate}</span>
                    {clash ? <Pill tone="danger">ditahan quote lain di jadwal ini</Pill> : null}
                  </label>
                );
              })}
              {fleetUnits.length === 0 ? <p className="text-sm text-ink-soft">Belum ada unit aktif untuk tipe {type?.name}. Tambah di menu Armada.</p> : null}
            </div>
            <Button type="submit">Tahan unit terpilih</Button>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2 text-sm text-ink-soft">
            {holdRows.length > 0 ? holdRows.map(({ h, plate }) => <Pill key={h.id} tone="ok">ðŸ”’ {plate}</Pill>) : <p>Tidak ada unit ditahan pada status ini.</p>}
          </div>
        )}
      </Card>

      {/* Pembayaran */}
      <Card>
        <h2 className="mb-1 text-base font-bold">Pembayaran</h2>
        <p className="mb-3 text-xs text-ink-soft">
          DP ideal Â±{settings.DP_PERCENT}% = {fmtIDR(dpIdeal)} Â· Pelunasan H-{settings.PELUNASAN_H} Â· bukti sah dulu, baru verifikasi.
        </p>
        <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-bg p-3">
            <p className="text-xs text-ink-soft">DP</p>
            <p className={cx('font-bold', dpPaid ? 'text-ok' : 'text-ink')}>{dpPaid ? `âœ… ${fmtIDR(dpAmount)}` : 'belum'}</p>
          </div>
          <div className="rounded-xl bg-bg p-3">
            <p className="text-xs text-ink-soft">Pelunasan</p>
            <p className={cx('font-bold', pelunasanPaid ? 'text-ok' : 'text-ink')}>{pelunasanPaid ? `âœ… ${fmtIDR(allPelunasan)}` : 'belum'}</p>
          </div>
        </div>
        {q.status === 'held' ? (
          <form action={verifyDpAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="quoteId" value={q.id} />
            <Input type="number" name="amount" min={1} defaultValue={dpIdeal} className="!w-40" />
            <Input name="proofUrl" placeholder="URL bukti bilyet (opsional)" className="!w-56" />
            <Button>Verifikasi DP â†’ kunci unit</Button>
          </form>
        ) : null}
        {q.status === 'dp_paid' ? (
          <form action={verifyPelunasanAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="quoteId" value={q.id} />
            <Input type="number" name="amount" min={1} defaultValue={Math.max(1, q.finalPrice ?? q.estimate - dpAmount)} className="!w-40" />
            <Input name="proofUrl" placeholder="URL bukti bilyet (opsional)" className="!w-56" />
            <Button>Verifikasi pelunasan</Button>
          </form>
        ) : null}
      </Card>

      {/* Harga final + SPK */}
      <Card>
        <h2 className="mb-3 text-base font-bold">Harga Final & SPK</h2>
        <div className="grid gap-3">
          <form action={finalPriceAction} className="flex items-center gap-2">
            <input type="hidden" name="quoteId" value={q.id} />
            <Input type="number" name="finalPrice" min={1} defaultValue={q.finalPrice ?? undefined} placeholder="Harga deal final (IDR)" className="!w-64" />
            <Button variant="ghost">Simpan harga final</Button>
          </form>
          <div className="flex flex-wrap items-center gap-2">
            {q.spkNumber ? (
              <>
                <Pill tone="ok">{q.spkNumber}</Pill>
                <Link href={`/admin/spk/${q.id}`}><Button variant="ghost">Buka / cetak SPK</Button></Link>
              </>
            ) : q.status === 'confirmed' ? (
              <form action={spkAction}>
                <input type="hidden" name="quoteId" value={q.id} />
                <Button>Terbitkan SPK</Button>
              </form>
            ) : (
              <p className="text-xs text-ink-soft">SPK terbit setelah status Terkonfirmasi (lunas).</p>
            )}
          </div>
        </div>
      </Card>

      {/* Kru & dispatch */}
      <Card>
        <h2 className="mb-1 text-base font-bold">Kru & Dispatch (H-1)</h2>
        <p className="mb-3 text-xs text-ink-soft">
          Pilih kru, tandai terkirim, lalu kirim kontaknya ke pelanggan via WA (keputusan: kontak kru dikirim s.d. 1 hari sebelum berangkat).
        </p>
        {['confirmed', 'spk_issued', 'dispatched'].includes(q.status) ? (
          <>
            <form action={dispatchedAction} className="grid gap-2">
              <input type="hidden" name="quoteId" value={q.id} />
              <div className="grid gap-1.5 sm:grid-cols-2">
                {crewRows.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                    <input type="checkbox" name="crewIds" value={c.id} defaultChecked={crewIds.includes(c.id)} className="size-4" />
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-xs text-ink-soft">{c.role === 'driver' ? 'Driver' : 'Co-driver'} Â· {c.phone}</span>
                  </label>
                ))}
              </div>
              {crewRows.length > 0 ? <Button type="submit" variant="ghost">Simpan kru & tandai terkirim</Button> : <p className="text-sm text-ink-soft">Tambah kru dulu di menu Armada.</p>}
            </form>
            {assignedCrew.length > 0 ? (
              <div className="mt-3">
                <CrewWaButton
                  phone={q.phone}
                  message={crewMsg}
                  label="Kirim kontak kru via WA"
                />
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-ink-soft">Menu kru aktif setelah unit terkunci (status confirm ke atas).</p>
        )}
        {q.status === 'dispatched' ? (
          <form action={completedAction} className="mt-3">
            <input type="hidden" name="quoteId" value={q.id} />
            <Button variant="ghost">Tandai trip selesai</Button>
          </form>
        ) : null}
      </Card>

      {/* Feedback */}
      <Card>
        <h2 className="mb-2 text-base font-bold">Feedback (H+1)</h2>
        {fb ? (
          <div className="grid gap-1 text-sm">
            <p>Token: <code className="rounded bg-bg px-1.5 py-0.5 text-xs">{fb.token}</code></p>
            <p className="text-ink-soft">Rating: {fb.rating ?? 'â€”'} {fb.comment ? `Â· "${fb.comment}"` : ''}</p>
            <a href={`/feedback/${fb.token}`} target="_blank" rel="noreferrer" className="text-sm font-semibold underline">Buka form feedback</a>
          </div>
        ) : ['dispatched', 'completed'].includes(q.status) ? (
          <form action={feedbackTokenAction}>
            <input type="hidden" name="quoteId" value={q.id} />
            <Button variant="ghost">Buat link feedback</Button>
          </form>
        ) : (
          <p className="text-xs text-ink-soft">Setelah trip selesai, buat link rating untuk dikirim via WA.</p>
        )}
      </Card>

      {/* Cancel di bawah */}
      {q.status !== 'cancelled' && q.status !== 'completed' ? (
        <Card>
          <form action={cancelAction}>
            <input type="hidden" name="quoteId" value={q.id} />
            <Button variant="danger">Batalkan quote ini</Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-ink-soft">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

