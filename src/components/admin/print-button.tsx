'use client';

export function PrintButton({ label = 'Cetak / Simpan PDF' }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-[15px] font-semibold text-accent-ink"
    >
      {label}
    </button>
  );
}
