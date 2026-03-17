'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Wind, Beaker, Thermometer, Droplets, Settings, HelpCircle, ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

const sensorSubmenu = [
  { label: 'Dust Sensor', href: '/modules/vishva', icon: Wind },
  { label: 'Air Quality Sensor', href: '/modules/vishva/air-quality', icon: Beaker },
  { label: 'Temperature', href: '/modules/ayathma', icon: Thermometer },
  { label: 'Humidity', href: '/modules/ayathma/humidity', icon: Droplets },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [sensorsOpen, setSensorsOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isActive = (href: string) => pathname === href;
  const isSensorActive = sensorSubmenu.some(item => pathname === item.href);

  return (
    <aside className="w-56 bg-white border-r border-purple-100 flex-shrink-0 flex flex-col h-full">
      {/* Brand */}
      <div className="h-16 flex items-center px-5 border-b border-purple-50">
        <ShieldCheck className="text-purple-700 mr-2" size={22} />
        <span className="font-extrabold text-purple-800 text-lg tracking-tight">CleanSight AI</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {/* Overview */}
        <Link href="/"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            isActive('/') ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50 hover:text-purple-700'
          }`}>
          <LayoutDashboard size={18} className={isActive('/') ? 'text-green-500' : 'text-gray-400'} />
          Overview
        </Link>

        {/* Sensors with submenu */}
        <div>
          <button
            onClick={() => setSensorsOpen(!sensorsOpen)}
            className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isSensorActive ? 'text-purple-700' : 'text-gray-600 hover:bg-gray-50 hover:text-purple-700'
            }`}>
            <div className="flex items-center gap-3">
              <Beaker size={18} className={isSensorActive ? 'text-green-500' : 'text-gray-400'} />
              Sensors
            </div>
            {sensorsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {sensorsOpen && (
            <div className="ml-4 pl-4 border-l-2 border-purple-100 mt-1 space-y-0.5">
              {sensorSubmenu.map((item) => (
                <Link key={item.href} href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive(item.href) ? 'text-purple-700 font-semibold bg-purple-50' : 'text-gray-500 hover:text-purple-600 hover:bg-gray-50'
                  }`}>
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Settings */}
        <div>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-50 hover:text-purple-700`}>
            <div className="flex items-center gap-3">
              <Settings size={18} className="text-gray-400" />
              Setting
            </div>
            {settingsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {settingsOpen && (
            <div className="ml-4 pl-4 border-l-2 border-purple-100 mt-1 space-y-0.5">
              <Link href="/modules/nandhika" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-purple-600 hover:bg-gray-50">
                General
              </Link>
              <Link href="/modules/nandhika" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-purple-600 hover:bg-gray-50">
                Thresholds
              </Link>
            </div>
          )}
        </div>

        {/* Help */}
        <Link href="#"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-purple-700 transition-colors">
          <HelpCircle size={18} className="text-gray-400" />
          Help
        </Link>
      </nav>
    </aside>
  );
}
