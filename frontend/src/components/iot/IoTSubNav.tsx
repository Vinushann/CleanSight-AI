'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Leaf } from 'lucide-react';

import { useIoTZenMode } from '@/components/iot/IoTZenModeContext';

const NAV_ITEMS: Array<{ label: string; href: string }> = [
  { label: 'Controller', href: '/modules/iot' },
  { label: 'Realtime', href: '/modules/iot/realtime' },
  { label: 'Edge AI Analytics', href: '/modules/iot/ml-prediction' },
  { label: 'Presence Detection', href: '/modules/iot/presence-detection' },
  { label: 'Device Health Monitor', href: '/modules/iot/device-health' },
  { label: 'Settings', href: '/modules/iot/settings' },
  { label: 'Help', href: '/modules/iot/help' },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/modules/iot') {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function IoTSubNav() {
  const pathname = usePathname();
  const { zenMode, toggleZenMode } = useIoTZenMode();

  return (
    <nav
      className="flex items-center gap-2 overflow-x-auto rounded-2xl px-2 py-2"
      aria-label="IoT navigation"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className="shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition-colors"
            style={{
              background: active ? 'color-mix(in srgb, var(--accent-primary) 18%, transparent)' : 'transparent',
              border: active ? '1px solid color-mix(in srgb, var(--accent-primary) 60%, transparent)' : '1px solid transparent',
              color: active ? 'var(--text-heading)' : 'var(--text-secondary)',
            }}
          >
            {item.label}
          </Link>
        );
      })}

      <button
        type="button"
        onClick={toggleZenMode}
        aria-pressed={zenMode}
        aria-label="Toggle Zen mode"
        title="Zen mode"
        className="ml-auto inline-flex shrink-0 items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold transition-colors"
        style={{
          background: zenMode ? 'color-mix(in srgb, var(--accent-primary) 16%, transparent)' : 'transparent',
          borderColor: zenMode ? 'color-mix(in srgb, var(--accent-primary) 58%, transparent)' : 'transparent',
          color: zenMode ? 'var(--text-heading)' : 'var(--text-secondary)',
        }}
      >
        <Leaf size={16} />
      </button>
    </nav>
  );
}
