'use client';
import { Search, CalendarDays } from 'lucide-react';
import { usePathname } from 'next/navigation';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/modules/vinushan': 'Dashboard',
  '/modules/vishva': 'Dust Sensor Monitoring (GP2Y1010)',
  '/modules/vishva/air-quality': 'Gas Sensor Monitoring (MQ135)',
  '/modules/ayathma': 'Temperature Sensor (DHT11)',
  '/modules/ayathma/humidity': 'Humidity Sensor (DHT11)',
  '/modules/nandhika': 'Settings',
};

export default function Topbar() {
  const pathname = usePathname();
  const title = pageTitles[pathname] || 'Dashboard';

  return (
    <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-purple-100 sticky top-0 z-20">
      {/* Page Title */}
      <h1 className="text-lg font-bold text-purple-800">{title}</h1>

      {/* Search + Date */}
      <div className="flex items-center gap-3">
        <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 gap-2">
          <span className="text-xs text-gray-400">R_Main_3</span>
          <Search size={16} className="text-purple-600 cursor-pointer" />
        </div>
        <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 gap-2">
          <span className="text-xs text-gray-400">Date</span>
          <CalendarDays size={16} className="text-purple-600 cursor-pointer" />
        </div>
      </div>
    </header>
  );
}
