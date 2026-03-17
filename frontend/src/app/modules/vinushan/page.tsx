'use client';

export default function DashboardExtendedPage() {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-purple-800">Extended Dashboard Analytics</h1>
        <p className="text-gray-500 text-sm">Cross-module aggregation and session-level deep dives</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="cs-card border-l-4 border-l-purple-500">
          <p className="cs-card-header">Active Sessions Today</p>
          <p className="text-3xl font-extrabold text-purple-700 mt-2">12</p>
        </div>
        <div className="cs-card border-l-4 border-l-green-500">
          <p className="cs-card-header">Rooms Cleaned</p>
          <p className="text-3xl font-extrabold text-green-600 mt-2">8 / 10</p>
        </div>
        <div className="cs-card border-l-4 border-l-red-400">
          <p className="cs-card-header">Reclean Required</p>
          <p className="text-3xl font-extrabold text-red-500 mt-2">2 Rooms</p>
        </div>
      </div>

      <div className="cs-card h-64 flex items-center justify-center">
        <span className="text-gray-400">Session comparison charts — placeholder for Vinushan&apos;s extended analytics</span>
      </div>
    </div>
  );
}
