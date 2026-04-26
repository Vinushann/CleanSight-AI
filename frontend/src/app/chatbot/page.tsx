'use client';

import DashboardChatPanel from '@/components/DashboardChatPanel';

export default function ChatbotPage() {
  return (
    <div
      className="flex h-[calc(100vh-9.5rem)] min-h-[560px] flex-col rounded-3xl"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <section
        className="flex min-h-0 flex-1 overflow-hidden rounded-3xl p-4"
        style={{
          background: 'color-mix(in srgb, var(--bg-card) 96%, var(--bg-input) 4%)',
          backdropFilter: 'saturate(180%) blur(22px)',
        }}
      >
        <DashboardChatPanel showSessionSidebar />
      </section>
    </div>
  );
}
