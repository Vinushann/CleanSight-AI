'use client';

import DashboardChatPanel from '@/components/DashboardChatPanel';

export default function ChatbotPage() {
  return (
    <div className="space-y-4">
      <section className="cs-card p-4">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-heading)' }}>
          Dashboard Assistant
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Ask questions about trends, anomalies, comparisons, and cleaning effectiveness using your current dashboard filters.
        </p>
      </section>

      <section className="cs-card p-4 h-[68vh] min-h-[520px]">
        <DashboardChatPanel />
      </section>
    </div>
  );
}
