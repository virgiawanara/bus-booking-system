import { describe, expect, it } from 'vitest';
import { computeEstimate } from './estimate';

// timezone Jakarta: 24 Okt 2026 05:30 s/d 26 Okt 2026 20:30 = 63 jam = 3 hari
const start = new Date('2026-10-24T05:30:00+07:00');
const end63h = new Date('2026-10-26T20:30:00+07:00');

describe('computeEstimate', () => {
  it('63 jam dihitung 3 hari', () => {
    const est = computeEstimate({ startAt: start, endAt: end63h, ratePerDay: 1_500_000, unitCount: 1 });
    expect(est.days).toBe(3);
    expect(est.total).toBe(4_500_000);
  });

  it('tepat 48 jam = 2 hari', () => {
    const end = new Date('2026-10-26T05:30:00+07:00');
    const est = computeEstimate({ startAt: start, endAt: end, ratePerDay: 1_500_000, unitCount: 1 });
    expect(est.days).toBe(2);
    expect(est.total).toBe(3_000_000);
  });

  it('47 jam dibulatkan ke atas jadi 2 hari', () => {
    const end = new Date('2026-10-26T04:30:00+07:00');
    expect(computeEstimate({ startAt: start, endAt: end, ratePerDay: 1_500_000, unitCount: 1 }).days).toBe(2);
  });

  it('mengalikan jumlah unit', () => {
    const est = computeEstimate({ startAt: start, endAt: end63h, ratePerDay: 1_500_000, unitCount: 2 });
    expect(est.total).toBe(9_000_000);
  });

  it('sewa sehari (berangkat = kembali) dihitung 1 hari', () => {
    const est = computeEstimate({ startAt: start, endAt: start, ratePerDay: 1_500_000, unitCount: 1 });
    expect(est.days).toBe(1);
    expect(est.total).toBe(1_500_000);
  });

  it('menolak rentang bolak-balik', () => {
    expect(() =>
      computeEstimate({ startAt: end63h, endAt: start, ratePerDay: 1_500_000, unitCount: 1 }),
    ).toThrow();
  });

  it('menolak rate/unit tidak positif', () => {
    expect(() =>
      computeEstimate({ startAt: start, endAt: end63h, ratePerDay: 0, unitCount: 1 }),
    ).toThrow();
    expect(() =>
      computeEstimate({ startAt: start, endAt: end63h, ratePerDay: 1_500_000, unitCount: 0 }),
    ).toThrow();
  });
});
