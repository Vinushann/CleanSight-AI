'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

import { getApiBaseUrl } from '@/core/apiBase';
import type { HouseOption, SessionType, VisualizationPayload } from '@/core/iotTypes';

type FilterState = {
  houseId: string;
  roomId: string;
};

type DriftRow = {
  timeLabel: string;
  timestamp_ms: number;
  actual_cleanliness: number | null;
  predicted_next_cleanliness: number | null;
  prediction_gap: number | null;
};

type StageModelRow = {
  session_type: SessionType;
  actual_score: number;
  predicted_score: number;
  anomaly_rate: number;
};

type ForecastScatterRow = {
  timeLabel: string;
  dust_forecast: number;
  predicted_cleanliness: number;
  bubble_size: number;
};

type StatusRow = {
  status: string;
  count: number;
};

type ReasonRow = {
  label: string;
  count: number;
};

function formatPercent(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return '-';
  return `${value.toFixed(digits)}%`;
}

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return '-';
  return value.toFixed(digits);
}

function formatSignedPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '-';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function formatTime(timestampMs: number) {
  if (!timestampMs) return '-';
  return new Date(timestampMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function prettify(value: string | null | undefined, fallback = 'Unknown') {
  const raw = (value || '').trim();
  if (!raw) return fallback;
  return raw.replace(/_/g, ' ');
}

function normalizeReason(value: string | null | undefined) {
  const raw = (value || '').trim();
  if (!raw) return null;
  return raw.replace(/\s+/g, ' ');
}

function getStatusTone(status: string | null | undefined) {
  const value = (status || '').toLowerCase();
  if (value === 'clean') {
    return {
      background: 'rgba(46, 204, 113, 0.14)',
      color: '#7ef0a7',
      borderColor: 'rgba(46, 204, 113, 0.28)',
    };
  }
  if (value === 'moderate') {
    return {
      background: 'rgba(255, 184, 76, 0.14)',
      color: '#ffd27d',
      borderColor: 'rgba(255, 184, 76, 0.28)',
    };
  }
  if (value === 'dirty') {
    return {
      background: 'rgba(255, 122, 111, 0.14)',
      color: '#ff9b92',
      borderColor: 'rgba(255, 122, 111, 0.28)',
    };
  }
  return {
    background: 'rgba(148, 163, 184, 0.12)',
    color: '#cbd5e1',
    borderColor: 'rgba(148, 163, 184, 0.2)',
  };
}

function getAnomalyTone(value: string | null | undefined) {
  if (value === 'anomaly') {
    return {
      background: 'rgba(255, 122, 111, 0.14)',
      color: '#ff9b92',
      borderColor: 'rgba(255, 122, 111, 0.28)',
    };
  }
  if (value === 'normal') {
    return {
      background: 'rgba(83, 212, 139, 0.14)',
      color: '#95f2ba',
      borderColor: 'rgba(83, 212, 139, 0.28)',
    };
  }
  return {
    background: 'rgba(148, 163, 184, 0.12)',
    color: '#cbd5e1',
    borderColor: 'rgba(148, 163, 184, 0.2)',
  };
}

function InsightCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border p-5"
      style={{
        background:
          'radial-gradient(circle at top left, rgba(77,163,255,0.08), transparent 40%), linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 96%, #07111f 4%), color-mix(in srgb, var(--bg-card) 98%, #020712 2%))',
        borderColor: 'var(--border-color)',
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-secondary)' }}>
        {title}
      </p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ExplanationList({ title, rows }: { title: string; rows: ReasonRow[] }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(125, 170, 255, 0.12)', background: 'rgba(255,255,255,0.02)' }}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-secondary)' }}>
          {title}
        </p>
        <span className="rounded-full border px-2 py-1 text-[11px]" style={{ borderColor: 'rgba(125, 170, 255, 0.12)', color: 'var(--text-secondary)' }}>
          {rows.reduce((sum, row) => sum + row.count, 0)} signals
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {rows.length ? (
          rows.map((row) => (
            <div
              key={row.label}
              className="flex items-start justify-between gap-3 rounded-xl px-3 py-2"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(125, 170, 255, 0.08)' }}
            >
              <span className="text-sm leading-5" style={{ color: 'var(--text-primary)' }}>{row.label}</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{row.count}</span>
            </div>
          ))
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No stored explanations yet.
          </p>
        )}
      </div>
    </div>
  );
}

export default function IoTEdgeAiAnalyticsPage() {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const [chartsReady, setChartsReady] = useState(false);
  const [houses, setHouses] = useState<HouseOption[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    houseId: '',
    roomId: '',
  });
  const [data, setData] = useState<VisualizationPayload | null>(null);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rooms = useMemo(() => {
    const selectedHouse = houses.find((house) => house.house_id === filters.houseId);
    return selectedHouse?.rooms || [];
  }, [filters.houseId, houses]);

  useEffect(() => {
    setChartsReady(true);
  }, []);

  useEffect(() => {
    let canceled = false;

    const loadFilters = async () => {
      try {
        setLoadingFilters(true);
        const response = await fetch(`${apiBaseUrl}/api/v1/dashboard/filters`, { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.detail || 'Failed to load house and room filters.');
        }
        if (canceled) return;

        const fetchedHouses = (payload.houses || []) as HouseOption[];
        setHouses(fetchedHouses);
        if (!fetchedHouses.length) return;

        const firstHouse = fetchedHouses[0];
        const firstRoom = firstHouse.rooms[0] || '';
        setFilters((prev) => ({
          houseId: prev.houseId || firstHouse.house_id,
          roomId: prev.roomId || firstRoom,
        }));
      } catch (fetchError) {
        if (!canceled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Unable to load filters.');
        }
      } finally {
        if (!canceled) {
          setLoadingFilters(false);
        }
      }
    };

    void loadFilters();
    return () => {
      canceled = true;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!filters.houseId) return;
    const selectedHouse = houses.find((house) => house.house_id === filters.houseId);
    const nextRooms = selectedHouse?.rooms || [];
    if (!nextRooms.includes(filters.roomId)) {
      setFilters((prev) => ({ ...prev, roomId: nextRooms[0] || '' }));
    }
  }, [filters.houseId, filters.roomId, houses]);

  useEffect(() => {
    let canceled = false;

    const loadInsights = async () => {
      if (!filters.houseId || !filters.roomId) return;

      try {
        setLoadingData(true);
        setError(null);
        const query = new URLSearchParams({
          house_id: filters.houseId,
          room_id: filters.roomId,
        });
        const response = await fetch(`${apiBaseUrl}/api/v1/dashboard/visualization?${query.toString()}`, {
          cache: 'no-store',
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.detail || 'Failed to load Edge AI insights.');
        }
        if (!canceled) {
          setData(payload as VisualizationPayload);
        }
      } catch (fetchError) {
        if (!canceled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Unable to load Edge AI insights.');
          setData(null);
        }
      } finally {
        if (!canceled) {
          setLoadingData(false);
        }
      }
    };

    void loadInsights();
    return () => {
      canceled = true;
    };
  }, [apiBaseUrl, filters.houseId, filters.roomId]);

  const insightReadings = useMemo(() => {
    return (data?.readings || []).filter(
      (reading) =>
        reading.cleanliness_score != null ||
        reading.actual_cleanliness != null ||
        reading.predicted_next_cleanliness != null ||
        reading.next_dust_prediction != null ||
        reading.cleanliness_status ||
        reading.anomaly_prediction
    );
  }, [data]);

  const latestInsight = insightReadings[insightReadings.length - 1] || null;
  const latestScore = latestInsight?.cleanliness_score ?? latestInsight?.actual_cleanliness ?? null;
  const latestPredictedNext = latestInsight?.predicted_next_cleanliness ?? null;
  const latestDustForecast = latestInsight?.next_dust_prediction ?? null;
  const latestStatus = latestInsight?.cleanliness_status || null;
  const latestAnomaly = latestInsight?.anomaly_prediction || null;

  const driftRows = useMemo<DriftRow[]>(() => {
    return insightReadings
      .filter(
        (reading) =>
          reading.timestamp_ms &&
          (reading.actual_cleanliness != null ||
            reading.cleanliness_score != null ||
            reading.predicted_next_cleanliness != null)
      )
      .slice(-36)
      .map((reading) => {
        const actual = reading.actual_cleanliness ?? reading.cleanliness_score ?? null;
        const predicted = reading.predicted_next_cleanliness ?? null;
        return {
          timeLabel: formatTime(reading.timestamp_ms),
          timestamp_ms: reading.timestamp_ms,
          actual_cleanliness: actual,
          predicted_next_cleanliness: predicted,
          prediction_gap:
            actual != null && predicted != null ? Number((predicted - actual).toFixed(1)) : null,
        };
      });
  }, [insightReadings]);

  const stageModelRows = useMemo<StageModelRow[]>(() => {
    return (['before', 'during', 'after'] as const).map((sessionType) => {
      const rows = insightReadings.filter((reading) => reading.session_type === sessionType);
      const actuals = rows
        .map((reading) => reading.actual_cleanliness ?? reading.cleanliness_score)
        .filter((value): value is number => value != null);
      const predictions = rows
        .map((reading) => reading.predicted_next_cleanliness)
        .filter((value): value is number => value != null);
      const anomalyRows = rows.filter((reading) => reading.anomaly_prediction === 'anomaly').length;
      const anomalyRate = rows.length ? (anomalyRows / rows.length) * 100 : 0;

      return {
        session_type: sessionType,
        actual_score: actuals.length ? Number((actuals.reduce((sum, value) => sum + value, 0) / actuals.length).toFixed(1)) : 0,
        predicted_score: predictions.length ? Number((predictions.reduce((sum, value) => sum + value, 0) / predictions.length).toFixed(1)) : 0,
        anomaly_rate: Number(anomalyRate.toFixed(1)),
      };
    });
  }, [insightReadings]);

  const improvementValue = useMemo(() => {
    const beforeValue = stageModelRows.find((row) => row.session_type === 'before')?.actual_score ?? 0;
    const afterValue = stageModelRows.find((row) => row.session_type === 'after')?.actual_score ?? 0;
    if (!beforeValue && !afterValue) return null;
    return Number((afterValue - beforeValue).toFixed(1));
  }, [stageModelRows]);

  const forecastScatterRows = useMemo(() => {
    const baseRows = insightReadings
      .filter(
        (reading) =>
          reading.next_dust_prediction != null &&
          (reading.predicted_next_cleanliness != null || reading.cleanliness_score != null || reading.actual_cleanliness != null)
      )
      .slice(-60)
      .map((reading) => ({
        timeLabel: formatTime(reading.timestamp_ms),
        dust_forecast: Number(reading.next_dust_prediction),
        predicted_cleanliness: Number(
          reading.predicted_next_cleanliness ?? reading.cleanliness_score ?? reading.actual_cleanliness ?? 0
        ),
        bubble_size: reading.anomaly_prediction === 'anomaly' ? 180 : 110,
        anomaly_prediction: reading.anomaly_prediction,
      }));

    return {
      normal: baseRows.filter((row) => row.anomaly_prediction !== 'anomaly') as ForecastScatterRow[],
      anomaly: baseRows.filter((row) => row.anomaly_prediction === 'anomaly') as ForecastScatterRow[],
    };
  }, [insightReadings]);

  const statusRows = useMemo<StatusRow[]>(() => {
    const counts = new Map<string, number>();
    for (const reading of insightReadings) {
      const key = (reading.cleanliness_status || 'unknown').toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return ['clean', 'moderate', 'dirty', 'unknown']
      .map((status) => ({ status, count: counts.get(status) || 0 }))
      .filter((row) => row.count > 0);
  }, [insightReadings]);

  const trendDirectionRows = useMemo(() => {
    const counts = {
      increasing: 0,
      stable: 0,
      decreasing: 0,
    };

    for (const reading of insightReadings) {
      const direction = (reading.trend_direction || '').toLowerCase();
      if (direction === 'increasing' || direction === 'stable' || direction === 'decreasing') {
        counts[direction] += 1;
      }
    }

    return [
      { name: 'Increasing', value: counts.increasing, color: '#7ef0a7' },
      { name: 'Stable', value: counts.stable, color: '#5aa8ff' },
      { name: 'Decreasing', value: counts.decreasing, color: '#ffb454' },
    ].filter((row) => row.value > 0);
  }, [insightReadings]);

  const anomalyRate = useMemo(() => {
    const rows = insightReadings.filter((reading) => reading.anomaly_prediction === 'anomaly' || reading.anomaly_prediction === 'normal');
    if (!rows.length) return null;
    const anomalies = rows.filter((reading) => reading.anomaly_prediction === 'anomaly').length;
    return Number(((anomalies / rows.length) * 100).toFixed(1));
  }, [insightReadings]);

  const predictionGapAverage = useMemo(() => {
    const values = driftRows
      .map((row) => row.prediction_gap)
      .filter((value): value is number => value != null);
    if (!values.length) return null;
    return Number((values.reduce((sum, value) => sum + Math.abs(value), 0) / values.length).toFixed(1));
  }, [driftRows]);

  const topPredictionReasons = useMemo<ReasonRow[]>(() => {
    const counts = new Map<string, number>();
    for (const reading of insightReadings) {
      const reason = normalizeReason(reading.prediction_reason);
      if (!reason) continue;
      counts.set(reason, (counts.get(reason) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, count]) => ({ label, count }));
  }, [insightReadings]);

  const topAnomalyReasons = useMemo<ReasonRow[]>(() => {
    const counts = new Map<string, number>();
    for (const reading of insightReadings) {
      const reason = normalizeReason(reading.anomaly_reason);
      if (!reason) continue;
      counts.set(reason, (counts.get(reason) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, count]) => ({ label, count }));
  }, [insightReadings]);

  const modelBadge = latestInsight?.model_version || latestInsight?.model_source || null;
  const statusTone = getStatusTone(latestStatus);
  const anomalyTone = getAnomalyTone(latestAnomaly);
  const noData = !loadingData && !error && !insightReadings.length;

  return (
    <section className="space-y-5">
      <div className="cs-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="cs-card-header text-base">Edge AI Cleaning Insights</p>
              {modelBadge ? (
                <span
                  className="rounded-full border px-3 py-1 text-[11px] font-medium"
                  style={{ borderColor: 'rgba(125, 170, 255, 0.16)', color: 'var(--text-secondary)' }}
                >
                  {modelBadge}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Prediction analytics for stored Firestore readings. This version focuses on forecast drift, stage-by-stage
              model behavior, dust-risk mapping, and the explanations coming back from the edge model.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>House</span>
              <select
                value={filters.houseId}
                onChange={(event) => setFilters((prev) => ({ ...prev, houseId: event.target.value }))}
                disabled={loadingFilters}
                className="rounded-xl px-3 py-2"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                {!houses.length ? <option value="">No house</option> : null}
                {houses.map((house) => (
                  <option key={house.house_id} value={house.house_id}>
                    {house.house_id}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>Room</span>
              <select
                value={filters.roomId}
                onChange={(event) => setFilters((prev) => ({ ...prev, roomId: event.target.value }))}
                disabled={loadingFilters || !rooms.length}
                className="rounded-xl px-3 py-2"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                {!rooms.length ? <option value="">No room</option> : null}
                {rooms.map((roomId) => (
                  <option key={roomId} value={roomId}>
                    {roomId}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      {error ? (
        <div
          className="rounded-2xl px-4 py-3 text-sm"
          style={{ background: 'var(--badge-poor-bg)', color: 'var(--badge-poor-text)' }}
        >
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <InsightCard title="Latest Cleanliness">
          <p className="text-4xl font-bold" style={{ color: 'var(--text-heading)' }}>
            {formatPercent(latestScore)}
          </p>
          <div className="mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize" style={statusTone}>
            {prettify(latestStatus, 'No status')}
          </div>
          <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Current edge-evaluated room condition from the latest stored reading.
          </p>
        </InsightCard>

        <InsightCard title="Next Predicted Cleanliness">
          <p className="text-4xl font-bold" style={{ color: 'var(--text-heading)' }}>
            {formatPercent(latestPredictedNext)}
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Forecasted next-step cleanliness from the model output stored in Firebase.
          </p>
          <p className="mt-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Drift vs latest actual: {formatSignedPercent(latestPredictedNext != null && latestScore != null ? latestPredictedNext - latestScore : null)}
          </p>
        </InsightCard>

        <InsightCard title="Dust Forecast">
          <p className="text-4xl font-bold" style={{ color: 'var(--text-heading)' }}>
            {formatNumber(latestDustForecast, 2)}
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Predicted next dust value carried by the model payload.
          </p>
          <p className="mt-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Average prediction gap: {formatPercent(predictionGapAverage, 1)}
          </p>
        </InsightCard>

        <InsightCard title="Anomaly Pressure">
          <p className="text-4xl font-bold" style={{ color: 'var(--text-heading)' }}>
            {formatPercent(anomalyRate, 1)}
          </p>
          <div className="mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize" style={anomalyTone}>
            {prettify(latestAnomaly, 'No signal')}
          </div>
          <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Share of prediction points that were marked as anomaly across this room selection.
          </p>
        </InsightCard>
      </div>

      {noData ? (
        <div className="cs-card">
          <div className="rounded-2xl border px-5 py-10 text-center" style={{ borderColor: 'var(--border-color)' }}>
            <p className="text-lg font-semibold" style={{ color: 'var(--text-heading)' }}>
              No Edge AI prediction data available
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Once prediction fields are stored in Firestore for this house and room, the analytics and insight cards
              will appear here.
            </p>
          </div>
        </div>
      ) : null}

      {!noData ? (
        <>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_0.95fr]">
            <section className="cs-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="cs-card-header text-base">Prediction Drift Timeline</p>
                  <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Tracks actual cleanliness against the next-step prediction, with bars showing how far the forecast
                    is drifting at each reading.
                  </p>
                </div>
                <div className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                  {driftRows.length} points
                </div>
              </div>

              <div className="mt-4 h-[340px]">
                {chartsReady ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={driftRows}>
                      <CartesianGrid stroke="rgba(148,163,184,0.14)" vertical={false} />
                      <XAxis dataKey="timeLabel" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="score" domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="gap" orientation="right" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(15, 23, 42, 0.96)',
                          border: '1px solid rgba(90, 168, 255, 0.18)',
                          borderRadius: '16px',
                          color: '#f8fafc',
                        }}
                      />
                      <Legend />
                      <Bar yAxisId="gap" dataKey="prediction_gap" name="Prediction Gap" radius={[6, 6, 0, 0]} fill="rgba(255, 180, 84, 0.5)" />
                      <Line yAxisId="score" type="monotone" dataKey="actual_cleanliness" name="Actual Cleanliness" stroke="#5aa8ff" strokeWidth={2.4} dot={false} connectNulls />
                      <Line yAxisId="score" type="monotone" dataKey="predicted_next_cleanliness" name="Predicted Next Cleanliness" stroke="#7ef0a7" strokeWidth={2.4} strokeDasharray="6 6" dot={false} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
            </section>

            <section className="cs-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="cs-card-header text-base">Model Explanation Snapshot</p>
                  <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    The most frequent explanation phrases stored with prediction and anomaly outputs.
                  </p>
                </div>
                <div className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                  {insightReadings.length} readings
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4">
                <ExplanationList title="Prediction Reasons" rows={topPredictionReasons} />
                <ExplanationList title="Anomaly Reasons" rows={topAnomalyReasons} />
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <section className="cs-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="cs-card-header text-base">Stage-by-Stage Model Behavior</p>
                  <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Compares actual cleanliness, predicted next cleanliness, and anomaly rate across `before`, `during`,
                    and `after` sessions.
                  </p>
                </div>
                <div className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                  Improvement {formatSignedPercent(improvementValue)}
                </div>
              </div>

              <div className="mt-4 h-[340px]">
                {chartsReady ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stageModelRows} barGap={8}>
                      <CartesianGrid stroke="rgba(148,163,184,0.14)" vertical={false} />
                      <XAxis dataKey="session_type" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(15, 23, 42, 0.96)',
                          border: '1px solid rgba(90, 168, 255, 0.18)',
                          borderRadius: '16px',
                          color: '#f8fafc',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="actual_score" name="Actual Score" radius={[8, 8, 0, 0]} fill="#5aa8ff" />
                      <Bar dataKey="predicted_score" name="Predicted Score" radius={[8, 8, 0, 0]} fill="#7ef0a7" />
                      <Bar dataKey="anomaly_rate" name="Anomaly Rate" radius={[8, 8, 0, 0]} fill="#ff8a7a" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
            </section>

            <section className="cs-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="cs-card-header text-base">Forecast Risk Map</p>
                  <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Maps predicted dust against predicted cleanliness so we can spot low-cleanliness and high-dust
                    combinations instantly.
                  </p>
                </div>
                <div className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                  Normal vs anomaly
                </div>
              </div>

              <div className="mt-4 h-[340px]">
                {chartsReady ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid stroke="rgba(148,163,184,0.14)" />
                      <XAxis
                        type="number"
                        dataKey="dust_forecast"
                        name="Predicted Dust"
                        tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="number"
                        dataKey="predicted_cleanliness"
                        name="Predicted Cleanliness"
                        domain={[0, 100]}
                        tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ZAxis type="number" dataKey="bubble_size" range={[80, 220]} />
                      <Tooltip
                        cursor={{ strokeDasharray: '4 4' }}
                        contentStyle={{
                          background: 'rgba(15, 23, 42, 0.96)',
                          border: '1px solid rgba(90, 168, 255, 0.18)',
                          borderRadius: '16px',
                          color: '#f8fafc',
                        }}
                        formatter={(value: number, name: string) => [Number(value).toFixed(name === 'Predicted Dust' ? 2 : 1), name]}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.timeLabel || ''}
                      />
                      <Legend />
                      <Scatter name="Normal" data={forecastScatterRows.normal} fill="#63d996" />
                      <Scatter name="Anomaly" data={forecastScatterRows.anomaly} fill="#ff7a6f" />
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_0.95fr]">
            <section className="cs-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="cs-card-header text-base">Cleanliness Status Distribution</p>
                  <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Shows how the model is classifying the room across the selected reading history.
                  </p>
                </div>
                <div className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                  {statusRows.reduce((sum, row) => sum + row.count, 0)} labels
                </div>
              </div>

              <div className="mt-4 h-[300px]">
                {chartsReady ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusRows} layout="vertical" margin={{ left: 8, right: 8, top: 0, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(148,163,184,0.14)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="status"
                        tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={78}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(15, 23, 42, 0.96)',
                          border: '1px solid rgba(90, 168, 255, 0.18)',
                          borderRadius: '16px',
                          color: '#f8fafc',
                        }}
                      />
                      <Bar dataKey="count" name="Readings" radius={[0, 10, 10, 0]}>
                        {statusRows.map((row) => (
                          <Cell
                            key={row.status}
                            fill={
                              row.status === 'clean'
                                ? '#66dc98'
                                : row.status === 'moderate'
                                  ? '#ffb454'
                                  : row.status === 'dirty'
                                    ? '#ff7a6f'
                                    : '#94a3b8'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
            </section>

            <section className="cs-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="cs-card-header text-base">Trend Direction Signals</p>
                  <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Quick read on whether the model thinks conditions are improving, holding steady, or degrading.
                  </p>
                </div>
                <div className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                  {trendDirectionRows.reduce((sum, row) => sum + row.value, 0)} trend calls
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {trendDirectionRows.length ? (
                  trendDirectionRows.map((row) => {
                    const total = trendDirectionRows.reduce((sum, item) => sum + item.value, 0);
                    const width = total ? `${(row.value / total) * 100}%` : '0%';
                    return (
                      <div key={row.name}>
                        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                          <span style={{ color: 'var(--text-primary)' }}>{row.name}</span>
                          <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>{row.value}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full" style={{ background: 'rgba(148, 163, 184, 0.12)' }}>
                          <div className="h-full rounded-full" style={{ width, background: row.color }} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    No stored trend direction labels yet.
                  </p>
                )}
              </div>

              <div className="mt-6 rounded-2xl border p-4" style={{ borderColor: 'rgba(125, 170, 255, 0.12)', background: 'rgba(255,255,255,0.02)' }}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-secondary)' }}>
                  Latest explanation
                </p>
                <p className="mt-3 text-sm leading-6" style={{ color: 'var(--text-primary)' }}>
                  {latestInsight?.prediction_reason || latestInsight?.anomaly_reason || 'No latest model explanation stored yet.'}
                </p>
              </div>
            </section>
          </div>
        </>
      ) : null}
    </section>
  );
}
