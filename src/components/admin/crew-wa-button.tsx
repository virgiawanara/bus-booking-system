'use client';

import { Button } from '@/components/ui';

export function CrewWaButton({ phone, message, label }: { phone: string; message: string; label: string }) {
  const link = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  return (
    <a href={link} target="_blank" rel="noreferrer">
      <Button variant="ghost">{label}</Button>
    </a>
  );
}
