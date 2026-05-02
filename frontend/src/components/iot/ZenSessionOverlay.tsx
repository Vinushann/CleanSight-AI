'use client';

import { useEffect, useMemo, useState } from 'react';
import { Leaf, Sparkles, X } from 'lucide-react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  AreaChart,
} from 'recharts';

import { getApiBaseUrl } from '@/core/apiBase';
import { useIoTZenMode } from '@/components/iot/IoTZenModeContext';
import type { ReadingPoint } from '@/core/iotTypes';

type ControlPayload = {
  collecting: boolean;
  session_id: string | null;
  device_id: string | null;
  house_id: string | null;
  room_id: string | null;
  session_type: 'before' | 'during' | 'after' | null;
};

type TrendRow = {
  label: string;
  dust: number | null;
  air_quality: number | null;
  actual_cleanliness: number | null;
  predicted_next_cleanliness: number | null;
};

function timeLabel(timestampMs: number) {
  return new Date(timestampMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ZenSessionOverlay() {
  const { zenMode, toggleZenMode } = useIoTZenMode();
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const [control, setControl] = useState<ControlPayload | null>(null);
  const [readings, setReadings] = useState<ReadingPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!zenMode) {
      return;
    }

    let canceled = false;

    const loadZenData = async () => {
      try {
        if (!canceled) {
          setLoading(true);
          setError(null);
        }

        const controlResponse = await fetch(`${apiBaseUrl}/api/device/control`, { cache: 'no-store' });
        const controlPayload = await controlResponse.json();
        if (!controlResponse.ok) {
          throw new Error(controlPayload.detail || 'Unable to load active session.');
        }
        if (canceled) {
          return;
        }

        setControl(controlPayload as ControlPayload);

        if (!controlPayload.collecting || !controlPayload.session_id) {
          setReadings([]);
          return;
        }

        const readingsResponse = await fetch(`${apiBaseUrl}/api/session/${controlPayload.session_id}/readings`, {
          cache: 'no-store',
        });
        const readingsPayload = await readingsResponse.json();
        if (!readingsResponse.ok) {
          throw new Error(readingsPayload.detail || 'Unable to load session readings.');
        }
        if (!canceled) {
          setReadings((readingsPayload.readings || []) as ReadingPoint[]);
        }
      } catch (fetchError) {
        if (!canceled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Unable to load Zen session view.');
        }
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    };

    void loadZenData();
    return () => {
      canceled = true;
    };
  }, [apiBaseUrl, zenMode]);

  useEffect(() => {
    if (!zenMode) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        toggleZenMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleZenMode, zenMode]);

  if (!zenMode) {
    return null;
  }

  const latestReading = readings.length ? readings[readings.length - 1] : null;
  const trendRows: TrendRow[] = readings.slice(-16).map((reading) => ({
    label: timeLabel(reading.timestamp_ms),
    dust: reading.dust,
    air_quality: reading.air_quality,
    actual_cleanliness: reading.actual_cleanliness ?? reading.cleanliness_score,
    predicted_next_cleanliness: reading.predicted_next_cleanliness,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        onClick={toggleZenMode}
        className="absolute inset-0 cursor-default"
        style={{ background: 'rgba(2, 6, 23, 0.62)', backdropFilter: 'blur(16px)' }}
        aria-label="Close Zen mode"
      />

      <section
        className="relative z-10 w-full max-w-6xl rounded-[32px] border p-5 lg:p-6"
        style={{
          background:
            'radial-gradient(circle at top left, rgba(83, 212, 139, 0.1), transparent 28%), radial-gradient(circle at top right, rgba(90, 168, 255, 0.1), transparent 24%), linear-gradient(180deg, rgba(11, 18, 32, 0.96), rgba(8, 13, 24, 0.98))',
          borderColor: 'rgba(148, 163, 184, 0.18)',
          boxShadow: '0 36px 120px rgba(0, 0, 0, 0.45)',
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl border"
              style={{ background: 'rgba(83, 212, 139, 0.12)', borderColor: 'rgba(83, 212, 139, 0.2)', color: '#95f2ba' }}
            >
              <Leaf size={20} />
            </div>
            <div>
              <p className="text-xl font-semibold" style={{ color: '#f8fafc' }}>
                Zen Session View
              </p>
              <p className="mt-1 text-sm" style={{ color: '#a8b3c7' }}>
                Calm, focused session essentials with just the key signals and model outcomes.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleZenMode}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border"
            style={{ borderColor: 'rgba(148, 163, 184, 0.18)', color: '#cbd5e1', background: 'rgba(255,255,255,0.03)' }}
            aria-label="Close Zen mode"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl px-4 py-3 text-sm" style={{ background: 'rgba(255, 122, 111, 0.14)', color: '#ffb4ad' }}>
            {error}
          </div>
        ) : null}

        {!control?.collecting && !loading ? (
          <div className="mt-6 rounded-3xl border px-6 py-12 text-center" style={{ borderColor: 'rgba(148, 163, 184, 0.16)', color: '#a8b3c7' }}>
            No active IoT session is running right now.
          </div>
        ) : null}

        {(control?.collecting || loading) ? (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
              <div className="rounded-3xl border px-4 py-4" style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-xs uppercase tracking-[0.14em]" style={{ color: '#8da0ba' }}>Session</p>
                <p className="mt-2 text-sm font-semibold" style={{ color: '#f8fafc' }}>{control?.session_id || '-'}</p>
              </div>
              <div className="rounded-3xl border px-4 py-4" style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-xs uppercase tracking-[0.14em]" style={{ color: '#8da0ba' }}>Location</p>
                <p className="mt-2 text-sm font-semibold" style={{ color: '#f8fafc' }}>{control?.house_id && control?.room_id ? `${control.house_id} / ${control.room_id}` : '-'}</p>
              </div>
              <div className="rounded-3xl border px-4 py-4" style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-xs uppercase tracking-[0.14em]" style={{ color: '#8da0ba' }}>Stage</p>
                <p className="mt-2 text-sm font-semibold capitalize" style={{ color: '#f8fafc' }}>{control?.session_type || '-'}</p>
              </div>
              <div className="rounded-3xl border px-4 py-4" style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-xs uppercase tracking-[0.14em]" style={{ color: '#8da0ba' }}>Readings</p>
                <p className="mt-2 text-sm font-semibold" style={{ color: '#f8fafc' }}>{readings.length}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <section className="rounded-[28px] border p-5" style={{ borderColor: 'rgba(148, 163, 184, 0.16)', background: 'rgba(255,255,255,0.03)' }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold" style={{ color: '#f8fafc' }}>
                      Session Visuals
                    </p>
                    <p className="mt-1 text-sm" style={{ color: '#98a7be' }}>
                      Just the essential sensor rhythm for this session.
                    </p>
                  </div>
                  <Sparkles size={16} style={{ color: '#95f2ba' }} />
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4">
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendRows}>
                        <defs>
                          <linearGradient id="zenDustFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6d7dff" stopOpacity={0.28} />
                            <stop offset="100%" stopColor="#6d7dff" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fill: '#8da0ba', fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: '#8da0ba', fontSize: 11 }} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: 'rgba(15, 23, 42, 0.96)',
                            border: '1px solid rgba(148,163,184,0.18)',
                            borderRadius: '16px',
                            color: '#f8fafc',
                          }}
                        />
                        <Area type="monotone" dataKey="dust" stroke="#6d7dff" fill="url(#zenDustFill)" strokeWidth={2.2} name="Dust" />
                        <Area type="monotone" dataKey="air_quality" stroke="#ed8936" fill="none" strokeWidth={2.2} name="Air Quality" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border p-5" style={{ borderColor: 'rgba(148, 163, 184, 0.16)', background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-base font-semibold" style={{ color: '#f8fafc' }}>
                  Model Predictions
                </p>
                <p className="mt-1 text-sm" style={{ color: '#98a7be' }}>
                  Two key AI signals for the active session.
                </p>

                <div className="mt-4 space-y-3">
                  <div className="rounded-3xl border px-4 py-4" style={{ borderColor: 'rgba(148,163,184,0.14)', background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-xs uppercase tracking-[0.14em]" style={{ color: '#8da0ba' }}>Cleanliness Status</p>
                    <p className="mt-2 text-xl font-semibold capitalize" style={{ color: '#f8fafc' }}>
                      {latestReading?.cleanliness_status || 'Unknown'}
                    </p>
                    <p className="mt-2 text-sm" style={{ color: '#98a7be' }}>
                      {latestReading?.prediction_reason || 'No prediction explanation available yet.'}
                    </p>
                  </div>

                  <div className="rounded-3xl border px-4 py-4" style={{ borderColor: 'rgba(148,163,184,0.14)', background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-xs uppercase tracking-[0.14em]" style={{ color: '#8da0ba' }}>Anomaly Prediction</p>
                    <p className="mt-2 text-xl font-semibold capitalize" style={{ color: '#f8fafc' }}>
                      {latestReading?.anomaly_prediction || 'Unknown'}
                    </p>
                    <p className="mt-2 text-sm" style={{ color: '#98a7be' }}>
                      {latestReading?.anomaly_reason || 'No anomaly explanation available.'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 h-[190px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendRows}>
                      <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#8da0ba', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#8da0ba', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(15, 23, 42, 0.96)',
                          border: '1px solid rgba(148,163,184,0.18)',
                          borderRadius: '16px',
                          color: '#f8fafc',
                        }}
                      />
                      <Line type="monotone" dataKey="actual_cleanliness" stroke="#5aa8ff" strokeWidth={2.3} dot={false} connectNulls name="Actual" />
                      <Line type="monotone" dataKey="predicted_next_cleanliness" stroke="#8aee94" strokeWidth={2.3} strokeDasharray="6 6" dot={false} connectNulls name="Predicted" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
