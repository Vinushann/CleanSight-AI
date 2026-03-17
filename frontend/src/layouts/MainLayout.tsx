'use client';
import { ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F8F7FC]">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </main>
      </div>
    </div>
  );
}
