'use client';
import { ThemeProvider } from '@/core/ThemeContext';
import { DashboardDataProvider } from '@/core/DashboardDataContext';
import MainLayout from '@/layouts/MainLayout';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <DashboardDataProvider>
        <MainLayout>
          {children}
        </MainLayout>
        <KeyboardShortcuts />
      </DashboardDataProvider>
    </ThemeProvider>
  );
}
