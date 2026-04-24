'use client';
import { ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Breadcrumbs from '@/components/Breadcrumbs';
import DashboardChatDrawer from '@/components/DashboardChatDrawer';

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: 'var(--bg-main)', transition: 'background-color 0.3s ease' }}>
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-6 py-5">
          <Breadcrumbs />
          {children}
        </main>
      </div>
      <DashboardChatDrawer />
    </div>
  );
}
