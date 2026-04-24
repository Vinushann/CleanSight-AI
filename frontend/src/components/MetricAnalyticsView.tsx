'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import PersistentContextBar from '@/components/PersistentContextBar';
import { useDashboardData } from '@/core/DashboardDataContext';
import {
  averageBySessionType,
  detectAnomalies,
  filterBySessionType,
  filterByTimeRange,
  formatSessionLabel,
  METRIC_META,
  metricSummary,
  stageComparisonInsight,
  type TimeRangeSelection,
  withTimestampLabel,
} from '@/core/iotDataUtils';
import type { MetricKey, SessionType } from '@/core/iotTypes';
import HelpHint from '@/components/HelpHint';

const CRITICAL_LIMITS: Record<MetricKey, number> = {
  dust: 180,
  air_quality: 250,
  temperature: 32,
  humidity: 75,
};

function decisionBadge(score: number, limit: number) {
  if (score >= limit) return 'critical';
  if (score >= limit * 0.7) return 'warning';
  return 'normal';
}

export default function MetricAnalyticsView({ metric, title }: { metric: MetricKey; title: string }) {
  const { data } = useDashboardData();
  const [activeStage, setActiveStage] = useState<SessionType | 'all'>('all');
  const [brushRange, setBrushRange] = useState<TimeRangeSelection | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const rows = useMemo(() => withTimestampLabel(data?.readings || []), [data?.readings]);
  const stageFilteredRows = useMemo(() => filterBySessionType(rows, activeStage), [rows, activeStage]);
  const linkedRows = useMemo(() => filterByTimeRange(stageFilteredRows, brushRange), [stageFilteredRows, brushRange]);
  const hasData = linkedRows.length > 0;

  const summary = useMemo(() => metricSummary(linkedRows, metric), [linkedRows, metric]);
  const stageRows = useMemo(() => averageBySessionType(rows, metric), [rows, metric]);
  const insight = useMemo(() => stageComparisonInsight(stageRows, metric), [stageRows, metric]);
  const anomalies = useMemo(() => detectAnomalies(linkedRows), [linkedRows]);
  const anomalyBySession = useMemo(() => {
    const map = new Map<string, number>();
    anomalies.forEach((row) => map.set(row.session_id, (map.get(row.session_id) || 0) + 1));
    return map;
  }, [anomalies]);

  useEffect(() => {
    if (!data?.sessions?.length) {
      setSelectedSessionId(null);
      return;
    }
    if (!selectedSessionId || !data.sessions.some((session) => session.session_id === selectedSessionId)) {
      setSelectedSessionId(data.sessions[0].session_id);
    }
  }, [data?.sessions, selectedSessionId]);

  const selectedSessionRows = useMemo(
    () => linkedRows.filter((row) => row.session_id === selectedSessionId),
    [linkedRows, selectedSessionId]
  );

  const sessionBars = useMemo(
    () =>
      (data?.sessions || [])
        .map((session) => {
          const sessionRows = linkedRows.filter((row) => row.session_id === session.session_id);
          if (!sessionRows.length) return null;
          const avg =
            sessionRows.reduce((sum, row) => sum + Number(row[metric] || 0), 0) / sessionRows.length;
          return {
            session_id: session.session_id,
            session_type: session.session_type,
            avg: Number(avg.toFixed(2)),
          };
        })
        .filter((row): row is { session_id: string; session_type: SessionType; avg: number } => row !== null),
    [data?.sessions, linkedRows, metric]
  );

  const roomDelta = data?.house_context?.selected_room_vs_house?.[
    `${metric}_delta` as 'dust_delta' | 'air_quality_delta' | 'temperature_delta' | 'humidity_delta'
  ];
  const decision = decisionBadge(summary.p95, CRITICAL_LIMITS[metric]);

  if (!data || !rows.length) {
    return (
      <div className="cs-card">
        <p style={{ color: 'var(--text-secondary)' }}>
          Run Search from global filters first to load {title} analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PersistentContextBar
        activeStage={activeStage}
        selectedSessionId={selectedSessionId}
        brushedPoints={linkedRows.length}
        onResetInteractions={() => {
          setActiveStage('all');
          setBrushRange(null);
          setSelectedSessionId(data.sessions?.[0]?.session_id || null);
        }}
      />

      <section className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="cs-card">
          <p className="cs-card-header">Latest {METRIC_META[metric].label}</p>
          <p className="text-3xl font-extrabold" style={{ color: 'var(--text-heading)' }}>{summary.latest.toFixed(2)}</p>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>{METRIC_META[metric].unit}</span>
            <HelpHint text={METRIC_META[metric].description} />
          </div>
        </div>
        <div className="cs-card">
          <p className="cs-card-header">Average {METRIC_META[metric].label}</p>
          <p className="text-3xl font-extrabold" style={{ color: 'var(--text-heading)' }}>{summary.average.toFixed(2)}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Current range</p>
        </div>
        <div className="cs-card">
          <p className="cs-card-header">Anomaly Points</p>
          <p className="text-3xl font-extrabold" style={{ color: 'var(--text-heading)' }}>{anomalies.length}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Metric + spike rules</p>
        </div>
        <div className="cs-card">
          <p className="cs-card-header">Condition</p>
          <p className={decision === 'normal' ? 'badge-good' : decision === 'warning' ? 'badge-moderate' : 'badge-poor'}>
            {decision}
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            P95 {METRIC_META[metric].label}: {summary.p95.toFixed(2)}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="cs-card xl:col-span-2">
          <div className="flex items-center gap-2">
            <p className="cs-card-header">{title} Trend</p>
            <HelpHint text={METRIC_META[metric].description} />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stageFilteredRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="chartLabel" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} label={{ value: 'Time', position: 'insideBottom', offset: -5, fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} label={{ value: METRIC_META[metric].axisLabel, angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip />
                <Legend formatter={() => METRIC_META[metric].label} />
                <Line
                  type="monotone"
                  dataKey={metric}
                  name={METRIC_META[metric].label}
                  stroke="var(--accent-primary)"
                  strokeWidth={2.4}
                  dot={false}
                />
                <Brush
                  dataKey="chartLabel"
                  height={24}
                  stroke="var(--accent-primary)"
                  travellerWidth={8}
                  onChange={(event) => {
                    if (!event || event.startIndex == null || event.endIndex == null) {
                      setBrushRange(null);
                      return;
                    }
                    setBrushRange({ startIndex: event.startIndex, endIndex: event.endIndex });
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="cs-card">
          <p className="cs-card-header">Insight + Decision</p>
          <div className="space-y-3 text-sm">
            <div className={insight.status === 'good' ? 'badge-good' : insight.status === 'poor' ? 'badge-poor' : 'badge-moderate'}>
              {insight.headline}
            </div>
            <div className="rounded-md px-3 py-2" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
              {insight.detail}
            </div>
            <div className="rounded-md px-3 py-2" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
              Room vs house baseline ({METRIC_META[metric].label}): {roomDelta?.toFixed(2) ?? '-'}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="cs-card">
          <p className="cs-card-header">Before / During / After (Click to Filter)</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="stage" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} label={{ value: 'Session Stage', position: 'insideBottom', offset: -5, fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} label={{ value: METRIC_META[metric].axisLabel, angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="value"
                  name={`Avg ${METRIC_META[metric].label}`}
                  onClick={(row: any) => {
                    if (row?.stage) {
                      setActiveStage(row.stage as SessionType);
                    }
                  }}
                  radius={[4, 4, 0, 0]}
                >
                  {stageRows.map((row) => (
                    <Cell
                      key={row.stage}
                      fill={activeStage === row.stage ? 'var(--accent-primary)' : 'var(--chart-fill-1)'}
                      stroke={activeStage === row.stage ? 'var(--accent-secondary)' : 'transparent'}
                      strokeWidth={1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="cs-card">
          <p className="cs-card-header">Session-level Comparison</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sessionBars.map((row) => ({ ...row, session_label: formatSessionLabel({ house_id: data.sessions?.find((session) => session.session_id === row.session_id)?.house_id || '-', room_id: data.sessions?.find((session) => session.session_id === row.session_id)?.room_id || '-', session_type: row.session_type }) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="session_label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} label={{ value: 'House + Room + Stage', position: 'insideBottom', offset: -5, fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} label={{ value: METRIC_META[metric].axisLabel, angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="avg" name={`Avg ${METRIC_META[metric].label}`} fill="var(--chart-fill-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="cs-card">
          <p className="cs-card-header">Session Drill-down</p>
          <div className="max-h-72 overflow-y-auto space-y-2">
            {(data?.sessions || []).map((session) => {
              const active = selectedSessionId === session.session_id;
              const anomalyCount = anomalyBySession.get(session.session_id) || 0;
              return (
                <button
                  key={session.session_id}
                  type="button"
                  onClick={() => setSelectedSessionId(session.session_id)}
                  className="w-full rounded-md px-3 py-2 text-left text-sm"
                  style={{
                    background: active ? 'var(--bg-active)' : 'var(--bg-input)',
                    border: `1px solid ${active ? 'var(--border-active)' : 'var(--border-color)'}`,
                    color: 'var(--text-primary)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{formatSessionLabel(session)}</span>
                    <span className={anomalyCount > 0 ? 'badge-poor' : 'badge-good'}>
                      {anomalyCount > 0 ? `${anomalyCount} anomalies` : 'normal'}
                    </span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Stage: {session.session_type} | Total readings: {session.total_readings}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="cs-card">
          <p className="cs-card-header">Selected Session Trend</p>
          {!hasData || !selectedSessionRows.length ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No points in current range.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selectedSessionRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="chartLabel" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} label={{ value: 'Time', position: 'insideBottom', offset: -5, fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} label={{ value: METRIC_META[metric].axisLabel, angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11 }} />
                  <Tooltip />
                  <Legend formatter={() => METRIC_META[metric].label} />
                  <Line type="monotone" dataKey={metric} name={METRIC_META[metric].label} stroke="var(--chart-stroke-3)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
