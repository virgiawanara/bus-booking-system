import { describe, expect, it } from 'vitest';
import { buildWaMessage, buildWaLink, normalizePhone, formatIDR } from './wa-template';

const quote = {
  code: 'Q-2026-0001',
  picName: 'Bpk. Rian Pratama',
  phone: '081234567890',
  origin: 'Jakarta (Cilandak)',
  destination: 'Yogyakarta (Malioboro)',
  pickupPoint: 'Area Parkir Gedung Graha Mandiri, Cilandak',
  standbyTime: '05.30',
  startAt: new Date('2026-10-24T05:30:00+07:00'),
  endAt: new Date('2026-10-26T20:30:00+07:00'),
  unitCount: 1,
  estimate: 4_500_000,
};

const typeName = 'VIP (31 Seat)';

describe('normalizePhone', () => {
  it('0812... -> 62812...', () => {
    expect(normalizePhone('0812-3456-7890')).toBe('6281234567890');
  });
  it('mamakai +62 dan spasi', () => {
    expect(normalizePhone('+62 812 3456 7890')).toBe('6281234567890');
  });
  it('sudah 62 dipertahankan', () => {
    expect(normalizePhone('6281234567890')).toBe('6281234567890');
  });
  it('nomor tidak valid ditolak', () => {
    expect(() => normalizePhone('abc123')).toThrow();
  });
});

describe('formatIDR', () => {
  it('pakai pemisah ribuan id-ID', () => {
    expect(formatIDR(4_500_000)).toBe('Rp4.500.000');
  });
});

describe('buildWaMessage', () => {
  const msg = buildWaMessage({
    quote,
    typeName,
    seats: 31,
    poName: 'PO Bus Sejahtera',
  });

  it('berisi rincian lengkap', () => {
    expect(msg).toContain('PO Bus Sejahtera');
    expect(msg).toContain('Q-2026-0001');
    expect(msg).toContain('Bpk. Rian Pratama');
    expect(msg).toContain('Jakarta (Cilandak) -> Yogyakarta (Malioboro)');
    expect(msg).toContain('24 Oktober 2026');
    expect(msg).toContain('26 Oktober 2026');
    expect(msg).toContain('(3 Hari)');
    expect(msg).toContain('VIP (31 Seat) (31 Seat) - 1 Unit');
  });

  it('berisi catatan harga wajib', () => {
    expect(msg).toContain('belum termasuk tol, parkir, retribusi wisata, dan tips kru');
  });

  it('urutan: catatan harga setelah rincian, sebelum penutup', () => {
    const iStandby = msg.indexOf('Waktu Standby');
    const iNote = msg.indexOf('Harga belum termasuk');
    const iClose = msg.indexOf('Mohon informasi');
    expect(iStandby).toBeGreaterThan(-1);
    expect(iNote).toBeGreaterThan(iStandby);
    expect(iClose).toBeGreaterThan(iNote);
    expect(msg).not.toContain('Catatan: harga');
  });

  it('di bawah batas wa.me', () => {
    expect(msg.length).toBeLessThan(1500);
  });
});

describe('buildWaLink', () => {
  it('lewat wa.me dengan pesan ter-encode', () => {
    const link = buildWaLink('6281234567890', 'Halo Admin');
    expect(link.startsWith('https://wa.me/6281234567890?text=')).toBe(true);
    expect(link).toContain('Halo%20Admin');
  });
  it('nomor yang mengandung karakter non-digit dibersihkan', () => {
    const link = buildWaLink('+62 812-3456-7890', 'x');
    expect(link.startsWith('https://wa.me/6281234567890?text=')).toBe(true);
  });
});
