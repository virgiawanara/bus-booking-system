// Halaman dinamis (cookies + DB) — blok eksplisit untuk Next Cache Components.
export const instant = false;

import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';
import { getDb } from '@/db';
import { crew, unitTypes, units } from '@/db/schema';
import { Card, Button, Input, Pill, Select } from '@/components/ui';
import { fmtIDR } from '@/lib/format';
import { saveUnitTypeAction, saveUnitAction, toggleUnitAction, saveCrewAction, toggleCrewAction } from '@/app/admin-actions';

const CONTOH_WARN = 'âš ï¸ Tarif di bawah masih CONTOH â€” ganti dengan tarif asli PO sebelum dipakai!';

export default async function FleetPage({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string }> }) {
  await requireAdmin();
  const { err, ok } = await searchParams;
  const db = getDb();
  const types = await db.select().from(unitTypes).orderBy(desc(unitTypes.active), unitTypes.seats);
  const allUnits = await db.select().from(units);
  const crewRows = await db.select().from(crew).orderBy(desc(crew.active), crew.role, crew.name);

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Armada</h1>
          <p className="text-sm text-ink-soft">Tipe unit (foto, fasilitas, tarif) dan plat masing-masing.</p>
        </div>
        <Link href="/admin" className="text-sm text-ink-soft hover:text-ink">â† Antrian</Link>
      </div>

      <div className="rounded-[18px] border border-warn/40 bg-warn/10 p-3 text-sm font-semibold text-warn">
        âš ï¸ Tarif awal masih CONTOH â€” ganti dengan tarif asli PO lewat form di bawah sebelum dipakai!
      </div>
      {err ? <Card className="border border-danger/30"><p className="text-sm font-semibold text-danger">{err}</p></Card> : null}
      {ok ? <Card className="border border-ok/30"><p className="text-sm font-semibold text-ok">{ok}</p></Card> : null}

      {types.map((t) => {
        const tUnits = allUnits.filter((u) => u.typeId === t.id);
        const facilities = (t.facilities ?? []).join(', ');
        return (
          <Card key={t.id}>
            <div className="flex gap-4">
              <img src={t.imageUrl ?? '/buses/placeholder.svg'} alt={t.name} className="h-28 w-40 flex-none rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-bold">{t.name}</h2>
                  {!t.active ? <Pill tone="warn">nonaktif</Pill> : null}
                </div>
                <p className="text-sm text-ink-soft">{t.seats} seat Â· {fmtIDR(t.ratePerDay)}/hari Â· {tUnits.filter((u) => u.active).length} unit aktif</p>
                <p className="mt-1 text-xs text-ink-soft">{facilities}</p>
                {t.ratePerDay < 500_000 ? <p className="mt-2 text-xs font-bold text-warn">{CONTOH_WARN}</p> : null}
              </div>
            </div>

            <form action={saveUnitTypeAction} className="mt-4 grid grid-cols-2 gap-2">
              <input type="hidden" name="id" value={t.id} />
              <Input name="name" defaultValue={t.name} placeholder="Nama tipe" required />
              <Input name="seats" type="number" min={1} defaultValue={t.seats} placeholder="Seats" required />
              <Input name="ratePerDay" type="number" min={1} defaultValue={t.ratePerDay} placeholder="Tarif/hari" required />
              <Input name="imageUrl" defaultValue={t.imageUrl ?? ''} placeholder="/buses/foto.jpg atau URL" />
              <Input name="facilities" defaultValue={facilities} placeholder="Fasilitas (pisah koma)" className="col-span-2" />
              <Button variant="ghost" type="submit">Simpan tipe</Button>
            </form>

            <div className="mt-3 border-t border-line pt-3">
              <div className="flex flex-wrap items-center gap-2">
                {tUnits.map((u) => (
                  <form key={u.id} action={toggleUnitAction} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="active" value={u.active ? '0' : '1'} />
                    <button
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${u.active ? 'bg-ok/10 text-ok' : 'bg-ink/5 text-ink-soft line-through'}`}
                    >
                      {u.plate} {u.active ? '' : '(nonaktif)'}
                    </button>
                  </form>
                ))}
              </div>
              <form action={saveUnitAction} className="mt-3 flex items-center gap-2">
                <input type="hidden" name="typeId" value={t.id} />
                <Input name="plate" placeholder="Plat baru, mis. D 7777 CON" className="!w-56" required />
                <Button type="submit" variant="ghost">Tambah unit</Button>
              </form>
            </div>
          </Card>
        );
      })}

      <Card>
        <h2 className="mb-1 text-base font-bold">Kru — driver &amp; co-driver</h2>
        <p className="mb-3 text-xs text-ink-soft">Dipakai di halaman SPK &amp; dispatch H-1. Klik kru untuk mengaktif/nonaktifkan.</p>
        <div className="flex flex-wrap items-center gap-2">
          {crewRows.map((c) => (
            <form key={c.id} action={toggleCrewAction} className="flex items-center gap-1">
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="active" value={c.active ? '0' : '1'} />
              <button
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${c.active ? 'bg-ok/10 text-ok' : 'bg-ink/5 text-ink-soft line-through'}`}
              >
                {c.name} · {c.role === 'co_driver' ? 'co-driver' : 'driver'}{c.active ? '' : ' (nonaktif)'}
              </button>
            </form>
          ))}
          {crewRows.length === 0 ? <p className="text-sm text-ink-soft">Belum ada kru.</p> : null}
        </div>
        <form action={saveCrewAction} className="mt-3 flex flex-wrap items-center gap-2">
          <Input name="name" placeholder="Nama kru" className="!w-44" required />
          <Input name="phone" placeholder="No. WA, mis. 0812-3456-7890" className="!w-56" required />
          <Select name="role" defaultValue="driver" className="!w-36">
            <option value="driver">Driver</option>
            <option value="co_driver">Co-driver</option>
          </Select>
          <Button type="submit" variant="ghost">Tambah kru</Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-2 text-base font-bold">Tambah tipe baru</h2>
        <form action={saveUnitTypeAction} className="grid grid-cols-2 gap-2">
          <Input name="name" placeholder="Nama tipe, contoh: VIP 31 Seat" required />
          <Input name="seats" type="number" min={1} placeholder="Seats" required />
          <Input name="ratePerDay" type="number" min={1} placeholder="Tarif/hari (IDR)" required />
          <Input name="imageUrl" placeholder="/buses/foto.jpg (opsional)" />
          <Input name="facilities" placeholder="AC, Reclining, Toilet (opsional)" className="col-span-2" />
          <Button type="submit">Tambah tipe</Button>
        </form>
      </Card>
    </div>
  );
}

