'use client';
import { ReactNode, useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Breadcrumbs from '@/components/Breadcrumbs';
import DashboardChatDrawer from '@/components/DashboardChatDrawer';

export default function MainLayout({ children }: { children: ReactNode }) {
  const [sidebarHidden, setSidebarHidden] = useState(false);

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem('cleansight.sidebar.hidden');
      if (storedValue != null) {
        setSidebarHidden(storedValue === 'true');
      }
    } catch {
      // Ignore storage issues and keep default visible state.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('cleansight.sidebar.hidden', String(sidebarHidden));
    } catch {
      // Ignore storage issues so the shortcut still works.
    }
  }, [sidebarHidden]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey && event.shiftKey && event.key.toLowerCase() === 's')) {
        return;
      }

      event.preventDefault();
      setSidebarHidden((current) => !current);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      className="flex h-screen w-full overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--bg-main) 88%, var(--bg-card) 12%) 0%, var(--bg-main) 28%, var(--bg-main) 100%)',
        transition: 'background-color 0.3s ease',
      }}
    >
      <Sidebar hidden={sidebarHidden} />
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
