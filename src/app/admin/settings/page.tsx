// Halaman dinamis (cookies + DB) — blok eksplisit untuk Next Cache Components.
export const instant = false;

import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { getDb } from '@/db';
import { Card, Input } from '@/components/ui';
import { saveSettingsAction } from '@/app/admin-actions';

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string }> }) {
  await requireAdmin();
  const { err, ok } = await searchParams;
  await getDb();
  const s = await getSettings();

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Setelan</h1>
          <p className="text-sm text-ink-soft">Nama PO, nomor WhatsApp tujuan, persen DP, dan aturan hold.</p>
        </div>
        <Link href="/admin" className="text-sm text-ink-soft hover:text-ink">â† Antrian</Link>
      </div>

      {err ? <Card className="border border-danger/30"><p className="text-sm font-semibold text-danger">{err}</p></Card> : null}
      {ok ? <Card className="border border-ok/30"><p className="text-sm font-semibold text-ok">{ok}</p></Card> : null}

      <Card>
        <form action={saveSettingsAction} className="grid gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold">Nama PO Bus</span>
            <Input name="PO_NAME" defaultValue={s.PO_NAME} required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold">Nomor WhatsApp admin</span>
            <Input name="WA_NUMBER" defaultValue={s.WA_NUMBER} placeholder="6281234567890" required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold">DP (%)</span>
              <Input name="DP_PERCENT" type="number" min={1} max={100} defaultValue={s.DP_PERCENT} required />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold">Pelunasan (H-berapa)</span>
              <Input name="PELUNASAN_H" type="number" min={0} max={30} defaultValue={s.PELUNASAN_H} required />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold">Durasi hold (jam)</span>
              <Input name="HOLD_HOURS" type="number" min={1} max={72} defaultValue={s.HOLD_HOURS} required />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold">Buffer antar-trip (jam)</span>
              <Input name="BUFFER_HOURS" type="number" min={0} max={12} defaultValue={s.BUFFER_HOURS} required />
            </label>
          </div>
          <button className="w-max rounded-full bg-accent px-5 py-3 text-[15px] font-semibold text-accent-ink">Simpan</button>
        </form>
      </Card>
    </div>
  );
}

