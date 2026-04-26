'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Wind, Beaker, Thermometer, Droplets, Radio, Settings, HelpCircle, ChevronDown, ChevronRight, ShieldCheck, MessageSquareText } from 'lucide-react';
import { useState } from 'react';

const sensorSubmenu = [
  { label: 'Dust Sensor', href: '/modules/vishva', icon: Wind },
  { label: 'Air Quality', href: '/modules/vishva/air-quality', icon: Beaker },
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
      className="w-60 flex-shrink-0 flex flex-col h-full"
      style={{
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        backdropFilter: 'saturate(180%) blur(22px)',
        transition: 'background-color 0.3s ease, border-color 0.3s ease',
      }}
    >
      {/* Brand */}
      <div
        className="h-16 flex items-center px-5 gap-3"
        style={{ borderBottom: '1px solid var(--border-light)' }}
      >
        <div
          className="grid h-8 w-8 place-items-center rounded-lg"
          style={{
            background: 'var(--bg-active)',
            color: 'var(--accent-primary)',
            border: '1px solid var(--border-active)',
          }}
        >
          <ShieldCheck size={18} />
        </div>
        <div className="leading-tight">
          <span className="block text-[15px] font-bold" style={{ color: 'var(--text-heading)' }}>CleanSight AI</span>
          <span className="block text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Cleaning intelligence</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {/* Overview */}
        <Link href="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          style={{
            background: isActive('/') ? 'var(--bg-active)' : 'transparent',
            color: isActive('/') ? 'var(--text-accent)' : 'var(--text-secondary)',
            border: `1px solid ${isActive('/') ? 'var(--border-active)' : 'transparent'}`,
          }}>
          <LayoutDashboard size={18} style={{ color: isActive('/') ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
          Overview
        </Link>

        {/* Sensors with submenu */}
        <div>
          <button
            onClick={() => setSensorsOpen(!sensorsOpen)}
            className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: isSensorActive ? 'var(--bg-active)' : 'transparent',
              color: isSensorActive ? 'var(--text-accent)' : 'var(--text-secondary)',
              border: `1px solid ${isSensorActive ? 'var(--border-active)' : 'transparent'}`,
            }}>
            <div className="flex items-center gap-3">
              <Beaker size={18} style={{ color: isSensorActive ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
              Sensors
            </div>
            {sensorsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {sensorsOpen && (
            <div className="ml-4 pl-4 mt-1 space-y-0.5" style={{ borderLeft: '1px solid var(--border-light)' }}>
              {sensorSubmenu.map((item) => (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{
                    color: isActive(item.href) ? 'var(--text-accent)' : 'var(--text-secondary)',
                    fontWeight: isActive(item.href) ? 700 : 500,
                    background: isActive(item.href) ? 'var(--bg-active)' : 'transparent',
                    border: `1px solid ${isActive(item.href) ? 'var(--border-active)' : 'transparent'}`,
                  }}>
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* IoT */}
        <Link href="/modules/iot"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          style={{
            background: isActive('/modules/iot') ? 'var(--bg-active)' : 'transparent',
            color: isActive('/modules/iot') ? 'var(--text-accent)' : 'var(--text-secondary)',
            border: `1px solid ${isActive('/modules/iot') ? 'var(--border-active)' : 'transparent'}`,
          }}>
          <Radio size={18} style={{ color: isActive('/modules/iot') ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
          IoT
        </Link>

        {/* Settings */}
        <div>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            style={{ color: 'var(--text-secondary)' }}>
            <div className="flex items-center gap-3">
              <Settings size={18} style={{ color: 'var(--text-muted)' }} />
              Setting
            </div>
            {settingsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {settingsOpen && (
            <div className="ml-4 pl-4 mt-1 space-y-0.5" style={{ borderLeft: '1px solid var(--border-light)' }}>
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
        <Link href="/help"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          style={{
            background: isActive('/help') ? 'var(--bg-active)' : 'transparent',
            color: isActive('/help') ? 'var(--text-accent)' : 'var(--text-secondary)',
            border: `1px solid ${isActive('/help') ? 'var(--border-active)' : 'transparent'}`,
          }}>
          <HelpCircle size={18} style={{ color: isActive('/help') ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
          Help
        </Link>
      </nav>

      <div className="px-3 pb-4 pt-3" style={{ borderTop: '1px solid var(--border-light)' }}>
        <Link href="/chatbot"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          style={{
            background: isActive('/chatbot') ? 'var(--bg-active)' : 'var(--bg-card)',
            color: isActive('/chatbot') ? 'var(--text-accent)' : 'var(--text-secondary)',
            border: `1px solid ${isActive('/chatbot') ? 'var(--border-active)' : 'var(--border-color)'}`,
          }}>
          <MessageSquareText size={18} style={{ color: isActive('/chatbot') ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
          CleanSight AI
        </Link>
      </div>
    </aside>
  );
}
