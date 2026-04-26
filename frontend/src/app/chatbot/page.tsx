'use client';

import DashboardChatPanel from '@/components/DashboardChatPanel';

export default function ChatbotPage() {
  return (
    <div className="flex min-h-[calc(100vh-8.5rem)] flex-col">
      <section className="cs-card flex min-h-0 flex-1 p-4">
        <DashboardChatPanel showSessionSidebar />
      </section>
    </div>
  );
}
