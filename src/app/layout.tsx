import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reservasi Sewa Bus',
  description: 'Sewa bus rombongan — quote cepat, lanjut ke WhatsApp.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
