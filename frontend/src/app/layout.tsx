import type { Metadata } from 'next';
import './globals.css';
import ClientProviders from './providers';

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
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
