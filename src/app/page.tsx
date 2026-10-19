import { BookingWizard } from '@/components/booking-wizard';
import { getSettings } from '@/lib/settings';

// Blokir prerender build — data dibaca saat request (Next 16 Cache Components).
export const instant = false;

export default async function Home() {
  const settings = await getSettings();
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-5 px-4 py-8">
      <header className="flex items-center justify-between">
        <span className="text-sm font-bold tracking-tight">{settings.PO_NAME}</span>
        <span className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink-soft">Sewa Bus</span>
      </header>
      <div>
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">Yuk, sewa bus<br />untuk rombongan Anda</h1>
        <p className="mt-1.5 text-sm text-ink-soft">Konsultasi harga & slot diproses admin lewat WhatsApp.</p>
      </div>
      <BookingWizard />
      <footer className="pb-4 text-center text-xs text-ink-soft">
        Estimasi bukan penawaran mengikat · Harga final oleh admin setelah cek jadwal armada
      </footer>
    </main>
  );
}
