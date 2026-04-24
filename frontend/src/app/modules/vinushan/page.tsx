'use client';

export default function DashboardExtendedPage() {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Extended Dashboard Analytics</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Cross-module aggregation and session-level deep dives</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="cs-card" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
          <p className="cs-card-header">Active Sessions Today</p>
          <p className="text-3xl font-extrabold mt-2" style={{ color: 'var(--accent-primary)' }}>12</p>
        </div>
        <div className="cs-card" style={{ borderLeft: '4px solid var(--accent-secondary)' }}>
          <p className="cs-card-header">Rooms Cleaned</p>
          <p className="text-3xl font-extrabold mt-2" style={{ color: 'var(--accent-secondary)' }}>8 / 10</p>
        </div>
        <div className="cs-card" style={{ borderLeft: '4px solid var(--badge-poor-text)' }}>
          <p className="cs-card-header">Reclean Required</p>
          <p className="text-3xl font-extrabold mt-2" style={{ color: 'var(--badge-poor-text)' }}>2 Rooms</p>
        </div>
      </div>

      <div className="cs-card h-64 flex items-center justify-center">
        <span style={{ color: 'var(--text-muted)' }}>Session comparison charts — placeholder for Vinushan&apos;s extended analytics</span>
      </div>
    </div>
  );
}
