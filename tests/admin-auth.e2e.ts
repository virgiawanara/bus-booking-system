import { test } from '@e2e-dev/web';
import { credentials, expect } from 'e2e';

test('admin login menuju antrian', async ({ app, screen }) => {
  await app.open('/admin');
  await screen.getByPlaceholder('Password admin').fill(credentials.user('admin').password);
  await screen.getByRole('button', { name: 'Masuk' }).click();
  await expect(screen.getByRole('heading', { name: 'Antrian Inquiry' })).toBeVisible();
});
