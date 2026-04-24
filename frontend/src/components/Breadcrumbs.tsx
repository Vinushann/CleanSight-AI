'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, House } from 'lucide-react';

const routeLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/modules': 'Modules',
  '/modules/vinushan': 'Dashboard',
  '/modules/vishva': 'Dust Sensor',
  '/modules/vishva/air-quality': 'Air Quality',
  '/modules/ayathma': 'Temperature',
  '/modules/ayathma/humidity': 'Humidity',
  '/modules/iot': 'IoT',
  '/chatbot': 'Chatbot',
  '/modules/nandhika': 'Settings',
};

function toTitle(segment: string): string {
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function Breadcrumbs() {
  const pathname = usePathname();

  const parts = pathname.split('/').filter(Boolean);
  const crumbs = parts.map((part, index) => {
    const href = `/${parts.slice(0, index + 1).join('/')}`;

    return {
      href,
      label: routeLabels[href] ?? toTitle(part),
    };
  });

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 overflow-x-auto text-sm whitespace-nowrap">
      <Link
        href="/"
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors"
        style={{ color: 'var(--text-secondary)' }}
      >
        <House size={14} />
        <span>{routeLabels['/']}</span>
      </Link>

      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;

        return (
          <div key={crumb.href} className="flex items-center gap-1">
            <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
            {isLast ? (
              <span className="rounded-md px-2 py-1 font-semibold" style={{ color: 'var(--text-accent)' }}>
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="rounded-md px-2 py-1 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                {crumb.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
