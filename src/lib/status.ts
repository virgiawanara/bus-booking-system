export type QuoteStatus =
  | 'quoted'
  | 'held'
  | 'dp_paid'
  | 'confirmed'
  | 'spk_issued'
  | 'dispatched'
  | 'completed'
  | 'cancelled'
  | 'expired';

// Status yang mengunci unit (overlap check).
export const BLOCKING_STATUS: QuoteStatus[] = [
  'held',
  'dp_paid',
  'confirmed',
  'spk_issued',
  'dispatched',
];

// Transisi legal. SPK hanya dari confirmed; bisa cancel kecuali sudah selesai.
const ALLOWED: Record<QuoteStatus, QuoteStatus[]> = {
  quoted: ['held', 'cancelled'],
  held: ['dp_paid', 'expired', 'cancelled'],
  dp_paid: ['confirmed', 'cancelled'],
  confirmed: ['spk_issued', 'cancelled'],
  spk_issued: ['dispatched', 'cancelled'],
  dispatched: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  expired: ['held', 'cancelled'],
};

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return (ALLOWED[from] ?? []).includes(to);
}

export const STATUS_LABEL: Record<QuoteStatus, string> = {
  quoted: 'Draft Quote',
  held: 'Unit Ditahan',
  dp_paid: 'DP Terbayar',
  confirmed: 'Terkonfirmasi',
  spk_issued: 'SPK Terbit',
  dispatched: 'Kru Dikirim',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  expired: 'Hold Atau Sendiri',
};
