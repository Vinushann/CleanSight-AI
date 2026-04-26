'use client';
import { ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Breadcrumbs from '@/components/Breadcrumbs';
import DashboardChatDrawer from '@/components/DashboardChatDrawer';

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex h-screen w-full overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--bg-main) 88%, var(--bg-card) 12%) 0%, var(--bg-main) 28%, var(--bg-main) 100%)',
        transition: 'background-color 0.3s ease',
      }}
    >
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-5 py-4 lg:px-7 lg:py-6">
          <Breadcrumbs />
          {children}
        </main>
      </div>
      <DashboardChatDrawer />
    </div>
  );
}
