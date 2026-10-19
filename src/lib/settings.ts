import { getDb } from '@/db';
import { settings } from '@/db/schema';

// Settings runtime dibaca dari tabel settings; fallback ke env.
export type AppSettings = {
  PO_NAME: string;
  WA_NUMBER: string;
  DP_PERCENT: number;
  PELUNASAN_H: number;
  HOLD_HOURS: number;
  BUFFER_HOURS: number;
};

const DEFAULTS: Record<string, string> = {
  PO_NAME: process.env.PO_NAME ?? 'Nama PO Bus',
  WA_NUMBER: process.env.PO_WA_NUMBER ?? '6281234567890',
  DP_PERCENT: process.env.DP_PERCENT ?? '30',
  PELUNASAN_H: process.env.PELUNASAN_H ?? '3',
  HOLD_HOURS: process.env.HOLD_HOURS ?? '24',
  BUFFER_HOURS: process.env.BUFFER_HOURS ?? '2',
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await getDb().select().from(settings);
  const map = { ...DEFAULTS };
  for (const r of rows) map[r.key] = r.value;
  return {
    PO_NAME: map.PO_NAME,
    WA_NUMBER: map.WA_NUMBER,
    DP_PERCENT: Number(map.DP_PERCENT) || 30,
    PELUNASAN_H: Number(map.PELUNASAN_H) || 3,
    HOLD_HOURS: Number(map.HOLD_HOURS) || 24,
    BUFFER_HOURS: Number(map.BUFFER_HOURS) || 2,
  };
}
