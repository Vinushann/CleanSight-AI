'use client';

import { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { usePathname } from 'next/navigation';

import DashboardChatPanel from '@/components/DashboardChatPanel';

export default function DashboardChatDrawer() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname === '/chatbot') {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full p-3 font-bold"
        style={{
          background: 'var(--accent-primary)',
          color: '#fff',
          boxShadow: '0 14px 30px rgba(0, 122, 255, 0.28), 0 1px 0 rgba(255,255,255,0.35) inset',
        }}
        aria-label="Toggle CleanSight AI"
      >
        {open ? <X size={20} /> : <MessageSquare size={20} />}
        <span className="a11y-icon-label hidden text-sm">{open ? 'Close AI chat' : 'Open AI chat'}</span>
      </button>

      {open && (
        <aside
          className="fixed right-5 bottom-20 z-40 w-[360px] max-w-[92vw] h-[520px] cs-card flex flex-col"
          style={{ padding: '0.9rem', backdropFilter: 'saturate(180%) blur(22px)' }}
        >
          <DashboardChatPanel onClose={() => setOpen(false)} showFullPageLink />
        </aside>
      )}
    </>
  );
}
