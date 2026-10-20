import { computeEstimate } from './estimate';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

type WaQuote = {
  code: string;
  picName: string;
  phone: string;
  origin: string;
  destination: string;
  pickupPoint: string;
  standbyTime: string;
  startAt: Date;
  endAt: Date;
  unitCount: number;
  estimate: number;
};

const PRICING_NOTE = 'Harga belum termasuk tol, parkir, retribusi wisata, dan tips kru';

export function normalizePhone(raw: string): string {
  let n = raw.replace(/\D/g, '');
  if (n.startsWith('0')) n = '62' + n.slice(1);
  else if (n.startsWith('8')) n = '62' + n;
  if (!/^62\d{8,13}$/.test(n)) throw new Error(`Nomor WhatsApp tidak valid: ${raw}`);
  return n;
}

export function formatIDR(n: number): string {
  return 'Rp' + new Intl.NumberFormat('id-ID').format(n);
}

function formatDateJakarta(d: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(d);
}

export function buildWaMessage({
  quote,
  typeName,
  seats,
  poName,
}: {
  quote: WaQuote;
  typeName: string;
  seats: number;
  poName: string;
}): string {
  const est = computeEstimate({
    startAt: quote.startAt,
    endAt: quote.endAt,
    ratePerDay: 1,
    unitCount: 1,
  });

  const lines = [
    `Halo Admin Reservasi ${poName},`,
    '',
    'Saya ingin konfirmasi pemesanan sewa bus dengan rincian berikut:',
    '',
    `Kode Quote: ${quote.code}`,
    `Nama Pemesan / PIC: ${quote.picName}`,
    `No. Kontak: ${quote.phone}`,
    `Rute: ${quote.origin} -> ${quote.destination}`,
    `Tanggal Perjalanan: ${formatDateJakarta(quote.startAt)} s/d ${formatDateJakarta(quote.endAt)} (${est.days} Hari)`,
    `Pilihan Armada: ${typeName} (${seats} Seat) - ${quote.unitCount} Unit`,
    `Estimasi Biaya Sistem: Mulai dari ${formatIDR(quote.estimate)}`,
    `Titik Jemput Spesifik: ${quote.pickupPoint}`,
    `Waktu Standby: Pukul ${quote.standbyTime} WIB`,
    '',
    PRICING_NOTE,
    '',
    'Mohon informasi ketersediaan pasti dan petunjuk pembayaran DP-nya. Terima kasih.',
  ];
  return lines.join('\n');
}

// Praktis <1500 karakter; diuji, wa.me menolak URL ekstra panjang.
export function buildWaLink(rawNumber: string, message: string): string {
  const number = normalizePhone(rawNumber);
  if (message.length >= 1500) throw new Error('Pesan WA terlalu panjang (>=1500)');
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export { TWO_HOURS_MS };
