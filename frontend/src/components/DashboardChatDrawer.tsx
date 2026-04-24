'use client';

import { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';

import DashboardChatPanel from '@/components/DashboardChatPanel';

export default function DashboardChatDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-5 right-5 z-40 rounded-full p-3 shadow-lg"
        style={{ background: 'var(--accent-primary)', color: '#fff' }}
        aria-label="Toggle chatbot"
      >
        {open ? <X size={20} /> : <MessageSquare size={20} />}
      </button>

      {open && (
        <aside
          className="fixed right-5 bottom-20 z-40 w-[360px] max-w-[92vw] h-[520px] cs-card flex flex-col"
          style={{ padding: '0.9rem' }}
        >
          <DashboardChatPanel onClose={() => setOpen(false)} />
        </aside>
      )}
    </>
  );
}
