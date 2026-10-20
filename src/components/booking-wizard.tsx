'use client';

import { useState } from 'react';
import { Button, Card, Field, Input, Pill, Stepper, Textarea, cx } from '@/components/ui';
import { checkAvailabilityAction, createQuoteAction, type TypeAvailability } from '@/app/actions';

type QuoteResult = Extract<Awaited<ReturnType<typeof createQuoteAction>>, { ok: true }>;

type FormState = {
  origin: string;
  destination: string;
  startDate: string; // yyyy-mm-dd
  endDate: string;
  unitCount: number;
  typeId: number | null;
  picName: string;
  phone: string;
  pickupPoint: string;
  standbyTime: string;
  luggageNote: string;
  notes: string;
};

const initialState: FormState = {
  origin: '',
  destination: '',
  startDate: '',
  endDate: '',
  unitCount: 1,
  typeId: null,
  picName: '',
  phone: '',
  pickupPoint: '',
  standbyTime: '',
  luggageNote: '',
  notes: '',
};

// Date-only: startAt/endAt tetap tersimpan sebagai ISO; midnight WIB.
// Duraion dihitung di estimate (tanggal sama = 1 hari).
function toISO(date: string): string {
  return date ? `${date}T00:00:00+07:00` : '';
}

function fmtIDR(n: number) {
  return 'Rp' + new Intl.NumberFormat('id-ID').format(n);
}

export function BookingWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [types, setTypes] = useState<TypeAvailability[] | null>(null);
  const [result, setResult] = useState<QuoteResult | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));  async function checkAvailability() {
    if (!form.origin.trim() || !form.destination.trim() || !form.startDate || !form.endDate) {
      setError('Lengkapi rute dan tanggal');
      return;
    }
    if (form.endDate < form.startDate) {
      setError('Tanggal kembali tidak boleh sebelum tanggal berangkat');
      return;
    }
    try {
      setError(null);
      setLoading(true);
      const res = await checkAvailabilityAction(toISO(form.startDate), toISO(form.endDate));
      if ('error' in res) {
        setError(res.error);
        return;
      }
      setTypes(res);
      setStep(1);
    } finally {
      setLoading(false);
    }
  }

  async function submitQuote() {
    if (!form.typeId || !form.picName.trim() || !form.phone.trim() || !form.pickupPoint.trim()) {
      setError('Lengkapi data kontak dan titik jemput');
      return;
    }
    if (!form.standbyTime.trim()) {
      setError('Isi waktu standby armada terlebih dulu');
      return;
    }
    try {
      setError(null);
      setLoading(true);
      const res = await createQuoteAction({
        picName: form.picName,
        phone: form.phone,
        origin: form.origin,
        destination: form.destination,
        pickupPoint: form.pickupPoint,
        standbyTime: form.standbyTime.replace(':', '.'),
        startAtISO: toISO(form.startDate),
        endAtISO: toISO(form.endDate),
        luggageNote: form.luggageNote || null,
        unitCount: form.unitCount,
        typeId: form.typeId,
        notes: form.notes || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res);
      setStep(3);
    } finally {
      setLoading(false);
    }
  }

  if (step === 0) {
    return (
      <Card>
        <Stepper step={0} />
        <h2 className="mb-1 text-2xl font-extrabold tracking-tight">Rencana sewa Anda</h2>
        <p className="mb-4 text-sm text-ink-soft">Rute dan tanggal sewa.</p>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jemput dari">
              <Input value={form.origin} onChange={(e) => set('origin', e.target.value)} placeholder="Jakarta (Cilandak)" />
            </Field>
            <Field label="Tujuan">
              <Input value={form.destination} onChange={(e) => set('destination', e.target.value)} placeholder="Yogyakarta (Malioboro)" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Berangkat">
              <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </Field>
            <Field label="Kembali">
              <Input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jumlah unit">
              <Input type="number" min={1} max={10} value={form.unitCount} onChange={(e) => set('unitCount', Math.max(1, Number(e.target.value) || 1))} />
            </Field>
            <div />
          </div>
          {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
          <Button onClick={checkAvailability} loading={loading}>Cek ketersediaan</Button>
        </div>
      </Card>
    );
  }

  if (step === 1) {
    return (
      <Card>
        <Stepper step={1} />
        <h2 className="mb-1 text-2xl font-extrabold tracking-tight">Pilih armada</h2>
        <p className="mb-4 text-sm text-ink-soft">Periksa kapasitas dan fasilitas. Jika habis, admin dapat membantu mencari alternatif.</p>
        <div className="mb-4 grid gap-3">
          {types?.map((t) => {
            const selected = form.typeId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => set('typeId', selected ? null : t.id)}
                className={cx('flex gap-4 rounded-[18px] border bg-white p-3 text-left transition', selected ? 'border-ink' : 'border-line hover:border-ink/30')}
              >
                <img
                  src={t.imageUrl ?? '/buses/placeholder.svg'}
                  alt={t.name}
                  className="h-24 w-32 flex-none rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate font-bold">{t.name}</h3>
                    {t.free >= form.unitCount ? <Pill tone="ok">{t.free} unit tersedia</Pill> : <Pill tone="warn">Perlu konfirmasi admin</Pill>}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-soft">Mulai dari <b className="text-ink">{fmtIDR(t.ratePerDay)}</b>/hari · {t.total} unit</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {t.facilities.slice(0, 5).map((f) => (
                      <span key={f} className="rounded-full bg-ink/5 px-2.5 py-1 text-[11px] font-medium text-ink-soft">{f}</span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setStep(0)}>Kembali</Button>
          <Button onClick={() => setStep(2)} disabled={!form.typeId}>Lanjut</Button>
        </div>
      </Card>
    );
  }

  if (step === 2) {
    return (
      <Card>
        <Stepper step={2} />
        <h2 className="mb-1 text-2xl font-extrabold tracking-tight">Kontak & titik jemput</h2>
        <p className="mb-4 text-sm text-ink-soft">Data ini diteruskan ke admin via WhatsApp.</p>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nama Pemesan / PIC">
              <Input value={form.picName} onChange={(e) => set('picName', e.target.value)} placeholder="Bpk. Rian Pratama" />
            </Field>
            <Field label="No. WhatsApp">
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="0812-3456-7890" inputMode="tel" />
            </Field>
          </div>
          <Field label="Titik jemput spesifik">
            <Input value={form.pickupPoint} onChange={(e) => set('pickupPoint', e.target.value)} placeholder="Area Parkir Gedung Graha Mandiri, Cilandak" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Waktu standby armada" hint="Jam armada siap di titik jemput (WIB)">
              <Input type="time" value={form.standbyTime} onChange={(e) => set('standbyTime', e.target.value)} />
            </Field>
            <Field label="Jumlah unit">
              <Input type="number" min={1} max={10} value={form.unitCount} onChange={(e) => set('unitCount', Math.max(1, Number(e.target.value) || 1))} />
            </Field>
          </div>
          <Field label="Catatan bagasi (opsional)">
            <Textarea value={form.luggageNote} onChange={(e) => set('luggageNote', e.target.value)} placeholder="±30 tas sekolahan + 2 sound system" />
          </Field>
          {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>Kembali</Button>
            <Button onClick={submitQuote} loading={loading}>Buat quote & lanjut</Button>
          </div>
        </div>
      </Card>
    );
  }

  // STEP 3 — konfirmasi
  return (
    <Card>
      <Stepper step={3} />
      <h2 className="mb-1 text-2xl font-extrabold tracking-tight">Quote siap</h2>
      <p className="mb-4 text-sm text-ink-soft">Kode <b className="text-ink">{result?.code}</b> — kirim ke admin via tombol WhatsApp.</p>
      <div className="mb-4 grid gap-2 rounded-2xl bg-bg p-4 text-[13.5px]">
        <Row k="Armada" v={`${result?.typeName} · ${result?.seats} seat · ${form.unitCount} unit`} />
        <Row k="Durasi" v={`${result?.days} hari`} />
        <Row k="Estimasi" v={<b>Mulai {fmtIDR(result?.estimate ?? 0)}</b>} />
        <Row k="DP ±" v={fmtIDR(result?.dpHint ?? 0)} />
      </div>
      <p className="mb-4 rounded-2xl bg-warn/10 p-3 text-xs font-medium text-warn">
        {result?.stickyNote}
      </p>
      <a href={result?.waLink ?? '#'} target="_blank" rel="noreferrer">
        <Button className="w-full">Lanjut ke WhatsApp</Button>
      </a>
      <p className="mt-3 text-center text-xs text-ink-soft">Admin akan membalas ketersediaan pasti & petunjuk DP di chat.</p>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-ink-soft">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}
