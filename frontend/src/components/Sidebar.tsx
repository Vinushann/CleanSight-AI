'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Wind, Beaker, Thermometer, Droplets, Radio, Settings, HelpCircle, ChevronDown, ChevronRight, ShieldCheck, MessageSquareText } from 'lucide-react';
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
    <aside
      className="w-56 flex-shrink-0 flex flex-col h-full"
      style={{
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        transition: 'background-color 0.3s ease, border-color 0.3s ease',
      }}
    >
      {/* Brand */}
      <div
        className="h-16 flex items-center px-5"
        style={{ borderBottom: '1px solid var(--border-light)' }}
      >
        <ShieldCheck style={{ color: 'var(--accent-primary)' }} className="mr-2" size={22} />
        <span className="font-extrabold text-lg tracking-tight" style={{ color: 'var(--text-heading)' }}>CleanSight AI</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {/* Overview */}
        <Link href="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: isActive('/') ? 'var(--bg-active)' : 'transparent',
            color: isActive('/') ? 'var(--text-accent)' : 'var(--text-secondary)',
          }}>
          <LayoutDashboard size={18} style={{ color: isActive('/') ? 'var(--accent-secondary)' : 'var(--text-muted)' }} />
          Overview
        </Link>

        {/* Sensors with submenu */}
        <div>
          <button
            onClick={() => setSensorsOpen(!sensorsOpen)}
            className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              color: isSensorActive ? 'var(--text-accent)' : 'var(--text-secondary)',
            }}>
            <div className="flex items-center gap-3">
              <Beaker size={18} style={{ color: isSensorActive ? 'var(--accent-secondary)' : 'var(--text-muted)' }} />
              Sensors
            </div>
            {sensorsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {sensorsOpen && (
            <div className="ml-4 pl-4 mt-1 space-y-0.5" style={{ borderLeft: '2px solid var(--border-light)' }}>
              {sensorSubmenu.map((item) => (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{
                    color: isActive(item.href) ? 'var(--text-accent)' : 'var(--text-secondary)',
                    fontWeight: isActive(item.href) ? 600 : 400,
                    background: isActive(item.href) ? 'var(--bg-active)' : 'transparent',
                  }}>
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* IoT */}
        <Link href="/modules/iot"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: isActive('/modules/iot') ? 'var(--bg-active)' : 'transparent',
            color: isActive('/modules/iot') ? 'var(--text-accent)' : 'var(--text-secondary)',
          }}>
          <Radio size={18} style={{ color: isActive('/modules/iot') ? 'var(--accent-secondary)' : 'var(--text-muted)' }} />
          IoT
        </Link>

        {/* Chatbot */}
        <Link href="/chatbot"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: isActive('/chatbot') ? 'var(--bg-active)' : 'transparent',
            color: isActive('/chatbot') ? 'var(--text-accent)' : 'var(--text-secondary)',
          }}>
          <MessageSquareText size={18} style={{ color: isActive('/chatbot') ? 'var(--accent-secondary)' : 'var(--text-muted)' }} />
          Chatbot
        </Link>

        {/* Settings */}
        <div>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ color: 'var(--text-secondary)' }}>
            <div className="flex items-center gap-3">
              <Settings size={18} style={{ color: 'var(--text-muted)' }} />
              Setting
            </div>
            {settingsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {settingsOpen && (
            <div className="ml-4 pl-4 mt-1 space-y-0.5" style={{ borderLeft: '2px solid var(--border-light)' }}>
              <Link href="/modules/nandhika" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{ color: 'var(--text-secondary)' }}>
                General
              </Link>
              <Link href="/modules/nandhika" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{ color: 'var(--text-secondary)' }}>
                Thresholds
              </Link>
            </div>
          )}
        </div>

        {/* Help */}
        <Link href="#"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{ color: 'var(--text-secondary)' }}>
          <HelpCircle size={18} style={{ color: 'var(--text-muted)' }} />
          Help
        </Link>
      </nav>
    </aside>
  );
}
