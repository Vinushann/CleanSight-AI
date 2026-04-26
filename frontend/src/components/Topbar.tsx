'use client';

import { usePathname } from 'next/navigation';
import { CalendarDays, Search } from 'lucide-react';

import ThemeSelector from '@/components/ThemeSelector';
import { useDashboardData } from '@/core/DashboardDataContext';
import type { SessionType } from '@/core/iotTypes';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/modules/vinushan': 'Dashboard',
  '/modules/vishva': 'Dust Sensor Monitoring (GP2Y1010)',
  '/modules/vishva/air-quality': 'Gas Sensor Monitoring (MQ135)',
  '/modules/ayathma': 'Temperature Sensor (DHT11)',
  '/modules/ayathma/humidity': 'Humidity Sensor (DHT11)',
  '/modules/iot': 'IoT Data Collection Control',
  '/modules/nandhika': 'Settings',
  '/help': 'Help & Documentation',
};

const sessionOptions: Array<{ value: SessionType | 'all'; label: string }> = [
  { value: 'all', label: 'All Sessions' },
  { value: 'before', label: 'Before' },
  { value: 'during', label: 'During' },
  { value: 'after', label: 'After' },
];

export default function Topbar() {
  const pathname = usePathname();
  const title = pageTitles[pathname] || 'Dashboard';
  const {
    houses,
    rooms,
    selectedHouseId,
    selectedRoomId,
    selectedSessionType,
    selectedDate,
    selectedDateTo,
    loadingFilters,
    loadingData,
    setSelectedHouseId,
    setSelectedRoomId,
    setSelectedSessionType,
    setSelectedDate,
    setSelectedDateTo,
    applyDateFilter,
    applySearch,
  } = useDashboardData();

  return (
    <header
      className="min-h-16 flex items-center justify-between px-5 py-2 sticky top-0 z-20 gap-4"
      style={{
        background: 'var(--bg-topbar)',
        borderBottom: '1px solid var(--border-color)',
        backdropFilter: 'saturate(180%) blur(22px)',
        transition: 'background-color 0.3s ease, border-color 0.3s ease',
      }}
    >
      <h1 className="text-[21px] font-bold shrink-0" style={{ color: 'var(--text-heading)' }}>{title}</h1>

      <div className="flex items-center gap-2 flex-wrap justify-end">
        <div
          className="flex items-center rounded-lg px-2 py-1.5 gap-2"
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--control-inset-shadow, 0 1px 0 rgba(255,255,255,0.65) inset)',
          }}
        >
          <CalendarDays size={14} style={{ color: 'var(--accent-primary)' }} />
          <span className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>From</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="text-xs bg-transparent outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          <span className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>To</span>
          <input
            type="date"
            value={selectedDateTo}
            onChange={(event) => setSelectedDateTo(event.target.value)}
            className="text-xs bg-transparent outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          <button
            type="button"
            onClick={() => void applyDateFilter()}
            disabled={loadingFilters}
            className="rounded-md px-2 py-1 text-xs font-bold"
            style={{
              background: loadingFilters ? 'var(--border-light)' : 'var(--accent-primary)',
              color: loadingFilters ? 'var(--text-muted)' : '#FFFFFF',
              boxShadow: loadingFilters ? 'none' : '0 6px 14px rgba(0, 122, 255, 0.18)',
            }}
          >
            Apply
          </button>
        </div>

        <select
          value={selectedHouseId}
          onChange={(event) => setSelectedHouseId(event.target.value)}
          disabled={loadingFilters}
          className="rounded-lg px-2.5 py-1.5 text-xs min-w-28 font-semibold"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
        >
          {!houses.length && <option value="">No house</option>}
          {houses.map((house) => (
            <option key={house.house_id} value={house.house_id}>
              {house.house_id}
            </option>
          ))}
        </select>

        <select
          value={selectedRoomId}
          onChange={(event) => setSelectedRoomId(event.target.value)}
          disabled={loadingFilters || !rooms.length}
          className="rounded-lg px-2.5 py-1.5 text-xs min-w-24 font-semibold"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
        >
          {!rooms.length && <option value="">No room</option>}
          {rooms.map((roomId) => (
            <option key={roomId} value={roomId}>
              {roomId}
            </option>
          ))}
        </select>

        <select
          value={selectedSessionType}
          onChange={(event) => setSelectedSessionType(event.target.value as SessionType | 'all')}
          className="rounded-lg px-2.5 py-1.5 text-xs min-w-32 font-semibold"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
        >
          {sessionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => void applySearch()}
          disabled={loadingFilters || loadingData}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold"
          style={{
            background: loadingFilters || loadingData ? 'var(--border-light)' : 'var(--accent-primary)',
            color: loadingFilters || loadingData ? 'var(--text-muted)' : '#FFFFFF',
            boxShadow: loadingFilters || loadingData ? 'none' : '0 8px 18px rgba(0, 122, 255, 0.2)',
          }}
        >
          <Search size={13} />
          {loadingData ? 'Searching...' : 'Search'}
        </button>

        <ThemeSelector />
      </div>
    </header>
  );
}
