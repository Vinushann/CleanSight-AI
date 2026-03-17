import type { Metadata } from 'next';
import './globals.css';
import MainLayout from '@/layouts/MainLayout';

export const metadata: Metadata = {
  title: 'CleanSight AI | Cleaning Intelligence Platform',
  description: 'Evidence-based cleaning intelligence platform powered by IoT data',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex overflow-hidden">
        <MainLayout>
          {children}
        </MainLayout>
      </body>
    </html>
  );
}
