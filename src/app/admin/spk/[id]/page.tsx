// Halaman dinamis (cookies + DB) — blok eksplisit untuk Next Cache Components.
export const instant = false;

import { notFound, redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { getDb } from '@/db';
import { getQuoteDetail } from '@/lib/admin-data';
import { getSettings } from '@/lib/settings';
import { fmtDate, fmtIDR } from '@/lib/format';
import { PrintButton } from '@/components/admin/print-button';

export default async function SpkPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isInteger(id)) notFound();
  const detail = await getQuoteDetail(getDb(), id);
  if (!detail) notFound();
  const { q, type, holdRows, payRows, crewRows, assignedRows } = detail;
  const sw = await getSettings();

  if (!q.spkNumber) redirect(`/admin/q/${q.id}?err=${encodeURIComponent('SPK belum diterbitkan')}`);

  const dp = payRows.find((p) => p.kind === 'dp' && p.verifiedAt);
  const pelunasan = payRows.find((p) => p.kind === 'pelunasan' && p.verifiedAt);
  const assigned = crewRows.filter((c) => assignedRows.some((a) => a.crewId === c.id));
  const final = q.finalPrice ?? q.estimate;
  const sisa = final - (dp?.amount ?? 0) - (pelunasan?.amount ?? 0);

  return (
    <div className="mx-auto max-w-2xl bg-white p-10 text-[13px] text-black">
      <div className="print:hidden mb-6">
        <PrintButton />
      </div>
      <header className="mb-6 flex items-start justify-between border-b border-black/20 pb-4">
        <div>
          <h1 className="text-lg font-extrabold">{sw.PO_NAME}</h1>
          <p className="text-xs">Surat Perintah Kerja (SPK) Sewa Bus</p>
        </div>
        <div className="text-right text-xs">
          <p className="font-bold">{q.spkNumber}</p>
          <p>Tanggal terbit: {fmtDate(new Date())}</p>
          <p>Ref. Quote: {q.code}</p>
        </div>
      </header>

      <table className="mb-5 w-full text-left">
        <tbody className="[&_th]:w-44 [&_th]:font-semibold [&_th]:py-1 [&_td]:py-1 align-top">
          <tr><th>Pemesan / PIC</th><td>: {q.picName}</td></tr>
          <tr><th>Kontak WA</th><td>: {q.phone}</td></tr>
          <tr><th>Rute</th><td>: {q.origin} → {q.destination}</td></tr>
          <tr><th>Jadwal</th><td>: {fmtDate(q.startAt)} s/d {fmtDate(q.endAt)} · standby {q.standbyTime} WIB</td></tr>
          <tr><th>Titik jemput</th><td>: {q.pickupPoint} (koordinasi akses bus besar di H-1)</td></tr>
          <tr><th>Armada</th><td>: {q.unitCount}× {type?.name}{holdRows.length > 0 ? ` (${holdRows.map((r) => r.plate).join(', ')})` : ''}</td></tr>
          {q.luggageNote ? <tr><th>Bagasi</th><td>: {q.luggageNote}</td></tr> : null}
        </tbody>
      </table>

      <table className="mb-5 w-full border border-black/20">
        <thead>
          <tr className="border-b border-black/20 bg-black/5">
            <th className="p-2 text-left">Rincian biaya</th>
            <th className="p-2 text-right">Jumlah (IDR)</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-black/10"><td className="p-2">Sewa kesepakatan (final)</td><td className="p-2 text-right">{fmtIDR(final)}</td></tr>
          <tr className="border-b border-black/10"><td className="p-2">DP terbayar{dp ? ` (${fmtDate(dp.paidAt)})` : ''}</td><td className="p-2 text-right">- {fmtIDR(dp?.amount ?? 0)}</td></tr>
          <tr className="border-b border-black/10"><td className="p-2">Pelunasan terbayar{pelunasan ? ` (${fmtDate(pelunasan.paidAt)})` : ''}</td><td className="p-2 text-right">- {fmtIDR(pelunasan?.amount ?? 0)}</td></tr>
          <tr className="font-bold"><td className="p-2">Sisa</td><td className="p-2 text-right">{fmtIDR(Math.max(0, sisa))}</td></tr>
        </tbody>
      </table>

      <section className="mb-5">
        <h2 className="mb-1 font-bold">Kru yang ditugaskan</h2>
        {assigned.length > 0 ? (
          <ul className="list-disc pl-5">
            {assigned.map((c) => (
              <li key={c.id}>{c.role === 'driver' ? 'Driver' : 'Co-driver'}: {c.name} — {c.phone}</li>
            ))}
          </ul>
        ) : (
          <p>Menyusul (diarahkan lewat daftar dispatch H-1).</p>
        )}
      </section>

      <footer className="border-t border-black/20 pt-3 text-[11px] leading-relaxed">
        <p>
          Termasuk: bus + driver & co-driver, BBM standar, durasi sewa sesuai jadwal. Tidak termasuk: tol,
          parkir, retribusi wisata, dan tips kru (tanggung jawab pemesanan). Perubahan jadwal maksimal
          H-{sw.PELUNASAN_H}; pembatalan setelah DP mengikuti kesepakatan tertulis.
        </p>
      </footer>
    </div>
  );
}

