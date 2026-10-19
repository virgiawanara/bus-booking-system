import { describe, expect, it } from 'vitest';
import { canTransition, BLOCKING_STATUS, STATUS_LABEL, type QuoteStatus } from './status';

describe('status transitions', () => {
  it('alur utama quoted..dispatched..completed diperbolehkan', () => {
    expect(canTransition('quoted', 'held')).toBe(true);
    expect(canTransition('held', 'dp_paid')).toBe(true);
    expect(canTransition('dp_paid', 'confirmed')).toBe(true);
    expect(canTransition('confirmed', 'spk_issued')).toBe(true);
    expect(canTransition('spk_issued', 'dispatched')).toBe(true);
    expect(canTransition('dispatched', 'completed')).toBe(true);
  });

  it('cabang cancelled/expired diperbolehkan dari status aktif', () => {
    expect(canTransition('held', 'cancelled')).toBe(true);
    expect(canTransition('dp_paid', 'cancelled')).toBe(true);
    expect(canTransition('quoted', 'expired')).toBe(false);
    expect(canTransition('held', 'expired')).toBe(true);
  });

  it('transisi tidak valid ditolak', () => {
    expect(canTransition('quoted', 'dp_paid')).toBe(false);
    expect(canTransition('quoted', 'spk_issued')).toBe(false);
    expect(canTransition('completed', 'quoted')).toBe(false);
    expect(canTransition('cancelled', 'held')).toBe(false);
    // setelah completed, tidak bisa dibatalkan
    expect(canTransition('completed', 'cancelled')).toBe(false);
  });

  it('SPK hanya boleh dari confirmed', () => {
    expect(canTransition('dp_paid', 'spk_issued')).toBe(false);
  });
});

describe('BLOCKING_STATUS', () => {
  it('hanya status yang mengunci unit', () => {
    expect(BLOCKING_STATUS).toEqual(
      expect.arrayContaining(['held', 'dp_paid', 'confirmed', 'spk_issued', 'dispatched']),
    );
    expect(BLOCKING_STATUS).not.toContain('quoted');
    expect(BLOCKING_STATUS).not.toContain('completed');
  });
});

describe('STATUS_LABEL', () => {
  it('punya label Indonesia untuk semua status', () => {
    const keys: QuoteStatus[] = [
      'quoted',
      'held',
      'dp_paid',
      'confirmed',
      'spk_issued',
      'dispatched',
      'completed',
      'cancelled',
      'expired',
    ];
    for (const s of keys) {
      expect(typeof STATUS_LABEL[s]).toBe('string');
      expect(STATUS_LABEL[s].length).toBeGreaterThan(0);
    }
  });
});
