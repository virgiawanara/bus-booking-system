// Smoke wizard: kalau locator gagal di sini, cek .e2e/results/<test>/trace.md
import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('pelanggan membuat quote lewat wizard', async ({ app, screen, browser }) => {
  await app.open('/');

  // Langkah 1 — kebutuhan
  await screen.getByPlaceholder('Jakarta (Cilandak)').fill('Depok');
  await screen.getByPlaceholder('Yogyakarta (Malioboro)').fill('Bandung');
  await browser.locator('input[type="date"]').nth(0).fill('2026-11-10');
  await browser.locator('input[type="date"]').nth(1).fill('2026-11-12');
  await screen.getByRole('button', { name: /Cek ketersediaan/ }).click();
  await expect(screen.getByRole('heading', { name: 'Pilih armada' })).toBeVisible();

  // Langkah 2 — pilih armada pertama yang tersedia
  await screen.getByRole('button', { name: /Seat/ }).first().click();
  await screen.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await expect(screen.getByRole('heading', { name: 'Kontak & titik jemput' })).toBeVisible();

  // Langkah 3 — kontak & titik jemput
  await screen.getByPlaceholder('Bpk. Rian Pratama').fill('Uji E2E');
  await screen.getByPlaceholder('0812-3456-7890').fill('0812-0000-1111');
  await screen.getByPlaceholder('Area Parkir Gedung Graha Mandiri, Cilandak').fill('Depok Square');
  await browser.locator('input[type="time"]').fill('06:00');
  await screen.getByRole('button', { name: /Buat quote & lanjut/ }).click();

  // Langkah 4 — quote siap + handoff WA
  await expect(screen.getByRole('heading', { name: 'Quote siap' })).toBeVisible();
  const codeText = await screen.getByText(/Q-20\d{2}-\d{4}/).textContent();
  const code = codeText?.match(/Q-\d{4}-\d{4}/)?.[0];
  expect(code).toBeTruthy();
  // Nomor tujuan = setting admin (bisa berubah saat UAT) — jangan hardcode.
  const href = await screen.getByRole('link', { name: 'Lanjut ke WhatsApp' }).getAttribute('href');
  expect(href).toMatch(/^https:\/\/wa\.me\/\d{10,15}\?text=/);
  const text = decodeURIComponent(new URL(href!).searchParams.get('text') ?? '');
  expect(text).toContain(`Kode Quote: ${code}`);
});
