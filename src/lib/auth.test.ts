import { describe, expect, it } from 'vitest';
import { allowLoginAttempt, makeSessionValue, verifySessionValue } from './auth';

describe('session cookie (HMAC)', () => {
  it('nilai yang ditandatangani dan segar terverifikasi', () => {
    expect(verifySessionValue(makeSessionValue())).toBe(true);
  });

  it('payload diubah -> ditolak', () => {
    const v = makeSessionValue();
    expect(verifySessionValue(v.replace('admin.', 'driver.'))).toBe(false);
  });

  it('signature diubah -> ditolak', () => {
    const [user, ts, sig] = makeSessionValue().split('.');
    const flipped = (sig[0] === '0' ? '1' : '0') + sig.slice(1);
    expect(verifySessionValue(`${user}.${ts}.${flipped}`)).toBe(false);
  });

  it('umur: 6 hari lolos, 8 hari ditolak (batas 7)', () => {
    const now = Date.now();
    expect(verifySessionValue(makeSessionValue(now - 6 * 24 * 3_600_000))).toBe(true);
    expect(verifySessionValue(makeSessionValue(now - 8 * 24 * 3_600_000))).toBe(false);
  });

  it('format salah / kosong -> ditolak', () => {
    expect(verifySessionValue('admin.123')).toBe(false);
    expect(verifySessionValue(undefined)).toBe(false);
  });
});

describe('allowLoginAttempt (rate limit per IP)', () => {
  it('ke-11 percobaan dalam jendela 5 menit ditolak; setelah jendela lewat lunas', () => {
    const t0 = 1_000_000;
    const key = 'ip-a';
    for (let i = 0; i < 10; i++) {
      expect(allowLoginAttempt(key, 10, 5 * 60_000, t0)).toBe(true);
    }
    expect(allowLoginAttempt(key, 10, 5 * 60_000, t0 + 60_000)).toBe(false);
    expect(allowLoginAttempt(key, 10, 5 * 60_000, t0 + 5 * 60_000)).toBe(true);
  });

  it('jendela menggulung: usia percobaan kedaluwarsa satu per satu', () => {
    const key = 'ip-b';
    const t0 = 2_000_000;
    expect(allowLoginAttempt(key, 2, 60_000, t0)).toBe(true);
    expect(allowLoginAttempt(key, 2, 60_000, t0 + 30_000)).toBe(true);
    expect(allowLoginAttempt(key, 2, 60_000, t0 + 45_000)).toBe(false);
    expect(allowLoginAttempt(key, 2, 60_000, t0 + 70_000)).toBe(false);
    // percobaan yang ditolak juga dihitung; pelunasan saat dua terakhir kedaluwarsa
    expect(allowLoginAttempt(key, 2, 60_000, t0 + 105_000)).toBe(true);
  });
});
