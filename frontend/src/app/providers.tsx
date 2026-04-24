'use client';
import { ThemeProvider } from '@/core/ThemeContext';
import { DashboardDataProvider } from '@/core/DashboardDataContext';
import MainLayout from '@/layouts/MainLayout';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <DashboardDataProvider>
        <MainLayout>
          {children}
        </MainLayout>
      </DashboardDataProvider>
    </ThemeProvider>
  );
}
