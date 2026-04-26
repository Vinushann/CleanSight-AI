'use client';

import { useMemo } from 'react';

import { useDashboardData } from '@/core/DashboardDataContext';
import { formatDateRange } from '@/core/iotDataUtils';

type PersistentContextBarProps = {
  activeStage?: string;
  selectedSessionId?: string | null;
  brushedPoints?: number | null;
  onResetInteractions?: () => void;
};

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-full px-3 py-1 text-xs font-semibold"
      style={{ background: 'var(--bg-active)', color: 'var(--text-accent)', border: '1px solid var(--border-active)' }}
      aria-label={`${label}: ${value}`}
    >
      {label}: {value}
    </div>
  );
}

export default function PersistentContextBar({
  activeStage,
  selectedSessionId,
  brushedPoints,
  onResetInteractions,
}: PersistentContextBarProps) {
  const {
    appliedHouseId,
    appliedRoomId,
    appliedSessionType,
    appliedDate,
    appliedDateTo,
  } = useDashboardData();

  const rangeText = useMemo(() => formatDateRange(appliedDate, appliedDateTo), [appliedDate, appliedDateTo]);

  return (
    <section className="cs-card sticky top-0 z-10" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill label="House" value={appliedHouseId || '-'} />
        <Pill label="Room" value={appliedRoomId || '-'} />
        <Pill label="Session Filter" value={appliedSessionType || 'all'} />
        <Pill label="Date Range" value={rangeText} />
        {activeStage && activeStage !== 'all' ? <Pill label="Stage" value={activeStage} /> : null}
        {selectedSessionId ? <Pill label="Drill-down Session" value={selectedSessionId} /> : null}
        {typeof brushedPoints === 'number' && brushedPoints > 0 ? <Pill label="Window Points" value={`${brushedPoints}`} /> : null}
        {onResetInteractions ? (
          <button
            type="button"
            onClick={onResetInteractions}
            className="rounded-md px-3 py-1 text-xs font-bold"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
          >
            Reset View
          </button>
        ) : null}
      </div>
    </section>
  );
}
