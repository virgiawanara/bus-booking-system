export type EstimateInput = {
  startAt: Date;
  endAt: Date;
  ratePerDay: number; // IDR integer
  unitCount: number;
};

export type Estimate = {
  days: number;
  total: number; // IDR integer
  hours: number;
};

// Sewa dihitung per blok 24 jam, dibulatkan ke atas.
// 24 Okt 05:30 -> 26 Okt 20:30 = 63 jam = 3 hari.
export function computeEstimate({ startAt, endAt, ratePerDay, unitCount }: EstimateInput): Estimate {
  const ms = endAt.getTime() - startAt.getTime();
  if (!(ms > 0)) throw new Error('Rentang waktu tidak valid (harus endAt > startAt)');
  if (!Number.isInteger(ratePerDay) || ratePerDay <= 0) throw new Error('Rate harian tidak valid');
  if (!Number.isInteger(unitCount) || unitCount <= 0) throw new Error('Jumlah unit tidak valid');

  const hours = ms / 3_600_000;
  const days = Math.ceil(hours / 24);
  return { days, hours, total: days * ratePerDay * unitCount };
}
