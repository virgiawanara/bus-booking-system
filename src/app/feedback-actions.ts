'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { feedback } from '@/db/schema';

export async function submitFeedbackAction(fd: FormData): Promise<void> {
  'use server';

  const token = fd.get('token');
  if (typeof token !== 'string' || !token) redirect('/');

  const ratingRaw = fd.get('rating');
  const rating = typeof ratingRaw === 'string' && ratingRaw ? Number(ratingRaw) : null;
  const commentRaw = fd.get('comment');
  const comment = typeof commentRaw === 'string' && commentRaw.trim() ? commentRaw.trim().slice(0, 1000) : null;

  if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    redirect(`/feedback/${token}?err=${encodeURIComponent('Pilih rating 1–5')}`);
  }

  const updated = await getDb()
    .update(feedback)
    .set({ rating, comment, submittedAt: new Date() })
    .where(eq(feedback.token, token))
    .returning({ id: feedback.id });

  if (updated.length === 0) redirect('/');

  revalidatePath(`/feedback/${token}`);
  redirect(`/feedback/${token}?thanks=1`);
}
