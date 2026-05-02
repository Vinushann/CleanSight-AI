'use client';

import { Leaf } from 'lucide-react';

import { useIoTZenMode } from '@/components/iot/IoTZenModeContext';

export default function IoTZenIndicator() {
  const { zenMode } = useIoTZenMode();

  if (!zenMode) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-2 rounded-2xl border px-4 py-3"
      style={{
        background:
          'linear-gradient(90deg, rgba(83, 212, 139, 0.08) 0%, rgba(90, 168, 255, 0.08) 100%)',
        borderColor: 'rgba(83, 212, 139, 0.22)',
      }}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-2xl border"
        style={{
          background: 'rgba(83, 212, 139, 0.12)',
          borderColor: 'rgba(83, 212, 139, 0.18)',
          color: '#95f2ba',
        }}
      >
        <Leaf size={16} />
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
          Zen mode is active
        </p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          The IoT workspace is showing a calmer, reduced-detail view.
        </p>
      </div>
    </div>
  );
}
