'use client';

import { useMemo, useState } from 'react';
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
  decisionStatusFromDustAir,
  detectAnomalies,
  filterBySessionType,
  filterByTimeRange,
  METRIC_META,
  metricSummary,
  stageComparisonInsight,
  statusFromAQI,
  type TimeRangeSelection,
  withTimestampLabel,
} from '@/core/iotDataUtils';
import type { MetricKey, SessionType } from '@/core/iotTypes';
import HelpHint from '@/components/HelpHint';

function statusClass(status: 'good' | 'moderate' | 'poor') {
  if (status === 'good') return 'badge-good';
  if (status === 'poor') return 'badge-poor';
  return 'badge-moderate';
}

export default function DashboardPage() {
  const { data, error, loadingData, setSelectedSessionType, applySearch } = useDashboardData();
  const [activeStage, setActiveStage] = useState<SessionType | 'all'>('all');
  const [metricFocus, setMetricFocus] = useState<MetricKey>('dust');
  const [brushRange, setBrushRange] = useState<TimeRangeSelection | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const rows = useMemo(() => withTimestampLabel(data?.readings || []), [data?.readings]);
  const stageFilteredRows = useMemo(
    () => filterBySessionType(rows, activeStage),
    [rows, activeStage]
  );
  const linkedRows = useMemo(
    () => filterByTimeRange(stageFilteredRows, brushRange),
    [stageFilteredRows, brushRange]
  );

  const hasData = linkedRows.length > 0;
  const showStartState = !data || !rows.length;
  const anomalies = useMemo(() => detectAnomalies(linkedRows), [linkedRows]);

  const dustByStage = useMemo(() => averageBySessionType(rows, 'dust'), [rows]);
  const airByStage = useMemo(() => averageBySessionType(rows, 'air_quality'), [rows]);

  const metricCard = useMemo(() => metricSummary(linkedRows, metricFocus), [linkedRows, metricFocus]);
  const latestAQI = useMemo(() => metricSummary(linkedRows, 'air_quality').latest, [linkedRows]);
  const decision = useMemo(() => decisionStatusFromDustAir(dustByStage, airByStage), [dustByStage, airByStage]);
  const stageInsight = useMemo(
    () => stageComparisonInsight(averageBySessionType(rows, metricFocus), metricFocus),
    [rows, metricFocus]
  );
  const brushedPoints = linkedRows.length;
  const compareCardDelta = data?.house_context?.selected_room_vs_house;

  const resetLinkedViews = () => {
    setActiveStage('all');
    setMetricFocus('dust');
    setBrushRange(null);
    setSelectedSessionId(data?.sessions?.[0]?.session_id || null);
  };

  return (
    <div className="flex flex-col gap-5">
      {!showStartState ? (
        <PersistentContextBar
          activeStage={activeStage}
          selectedSessionId={selectedSessionId}
          brushedPoints={brushedPoints}
          onResetInteractions={resetLinkedViews}
        />
      ) : null}

      {error ? (
        <section className="cs-card">
          <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--badge-poor-bg)', color: 'var(--badge-poor-text)' }}>
            {error}
          </div>
        </section>
      ) : null}

      {showStartState ? (
        <section className="min-h-[62vh] flex items-center justify-center">
          <div
            className="w-full max-w-3xl rounded-2xl border px-8 py-10 text-center"
            style={{
              borderColor: 'var(--border-active)',
              background:
                'linear-gradient(160deg, color-mix(in srgb, var(--bg-card) 88%, var(--accent-primary) 12%) 0%, var(--bg-card) 55%)',
            }}
          >
            <h2 className="text-5xl font-black tracking-tight" style={{ color: 'var(--text-heading)' }}>
              CleanSight AI
            </h2>
            <p className="mt-4 text-lg" style={{ color: 'var(--text-secondary)' }}>
              Please choose the prefered date and house and room from the top right-filter.
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              If you want to see the latest cleaning session, click the button below.
            </p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setSelectedSessionType('all');
                  setActiveStage('all');
                  setBrushRange(null);
                  void applySearch();
                }}
                disabled={loadingData}
                className="rounded-xl px-6 py-3 text-base font-bold"
                style={{
                  background: loadingData ? 'var(--border-light)' : 'var(--accent-primary)',
                  color: loadingData ? 'var(--text-muted)' : '#FFFFFF',
                }}
              >
                {loadingData ? 'Loading Latest...' : 'See Latest Cleaning Session'}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            <button
              type="button"
              onClick={() => setMetricFocus('dust')}
              className="cs-card text-left"
              style={{ borderColor: metricFocus === 'dust' ? 'var(--border-active)' : 'var(--border-color)' }}
            >
              <p className="cs-card-header">Dust</p>
              <p className="text-3xl font-extrabold" style={{ color: 'var(--text-heading)' }}>
                {metricSummary(linkedRows, 'dust').latest.toFixed(2)}
              </p>
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>{METRIC_META.dust.unit}</span>
                <HelpHint text={METRIC_META.dust.description} />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMetricFocus('air_quality')}
              className="cs-card text-left"
              style={{ borderColor: metricFocus === 'air_quality' ? 'var(--border-active)' : 'var(--border-color)' }}
            >
              <p className="cs-card-header">Air Quality</p>
              <p className="text-3xl font-extrabold" style={{ color: 'var(--text-heading)' }}>
                {latestAQI.toFixed(2)}
              </p>
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>Status: {statusFromAQI(latestAQI)}</span>
                <HelpHint text={METRIC_META.air_quality.description} />
              </div>
            </button>

            <div className="cs-card">
              <p className="cs-card-header">Anomaly Signals</p>
              <p className="text-3xl font-extrabold" style={{ color: 'var(--text-heading)' }}>{anomalies.length}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Highlighted points in current range
              </p>
            </div>

            <div className="cs-card">
              <p className="cs-card-header">Decision Output</p>
              <p className={decision.cleaning_effectiveness === 'effective' ? 'badge-good' : decision.cleaning_effectiveness === 'partially_effective' ? 'badge-moderate' : 'badge-poor'}>
                {decision.cleaning_effectiveness.replace('_', ' ')}
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Action: {decision.recommended_action.replace('_', ' ')}
              </p>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="cs-card xl:col-span-2">
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <p className="cs-card-header mb-0">Overview Trend</p>
                  <HelpHint text="This chart shows how Dust, Air Quality, Temperature, and Humidity change over time." />
                </div>
                <div className="flex items-center gap-2">
                  {(Object.keys(METRIC_META) as MetricKey[]).map((metric) => (
                    <button
                      key={metric}
                      type="button"
                      onClick={() => setMetricFocus(metric)}
                      className="rounded-md px-2 py-1 text-xs font-semibold"
                      style={{
                        background: metricFocus === metric ? 'var(--bg-active)' : 'var(--bg-input)',
                        color: metricFocus === metric ? 'var(--text-accent)' : 'var(--text-secondary)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      {METRIC_META[metric].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stageFilteredRows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="chartLabel" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} label={{ value: 'Time', position: 'insideBottom', offset: -5, fill: 'var(--text-muted)', fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} label={{ value: 'Sensor reading value', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11 }} />
                    <Tooltip />
                    <Legend formatter={(value) => METRIC_META[value as MetricKey]?.label || value} />
                    <Line
                      type="monotone"
                      dataKey="dust"
                      name={METRIC_META.dust.label}
                      stroke="var(--chart-stroke-1)"
                      strokeWidth={metricFocus === 'dust' ? 3 : 1.6}
                      dot={false}
                    />
                    <Line type="monotone" dataKey="air_quality" name={METRIC_META.air_quality.label} stroke="var(--chart-stroke-3)" strokeWidth={metricFocus === 'air_quality' ? 3 : 1.6} dot={false} />
                    <Line type="monotone" dataKey="temperature" name={METRIC_META.temperature.label} stroke="var(--chart-stroke-2)" strokeWidth={metricFocus === 'temperature' ? 3 : 1.6} dot={false} />
                    <Line type="monotone" dataKey="humidity" name={METRIC_META.humidity.label} stroke="var(--chart-fill-1)" strokeWidth={metricFocus === 'humidity' ? 3 : 1.6} dot={false} />
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
              <p className="cs-card-header">Insight Summary</p>
              <div className="flex flex-col gap-3">
                <div className={`rounded-md px-3 py-2 text-sm ${statusClass(stageInsight.status)}`}>
                  {stageInsight.headline}
                </div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{stageInsight.detail}</p>
                <div className="rounded-md px-3 py-2 text-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
                  {METRIC_META[metricFocus].label} in current range
                  <br />
                  Avg: {metricCard.average.toFixed(2)} {METRIC_META[metricFocus].unit}
                  <br />
                  Min/Max: {metricCard.min.toFixed(2)} / {metricCard.max.toFixed(2)}
                </div>
                <div className="rounded-md px-3 py-2 text-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
                  Suspicious points: {anomalies.length}
                  <br />
                  Active stage filter: {activeStage}
                </div>
                {compareCardDelta ? (
                  <div className="rounded-md px-3 py-2 text-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
                    Selected room vs house average
                    <br />
                    Dust: {compareCardDelta.dust_delta?.toFixed(2) ?? '-'}
                    <br />
                    Air: {compareCardDelta.air_quality_delta?.toFixed(2) ?? '-'}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="cs-card">
              <p className="cs-card-header">Before / During / After Comparison</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dustByStage}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="stage" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} label={{ value: 'Session Stage', position: 'insideBottom', offset: -5, fill: 'var(--text-muted)', fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} label={{ value: METRIC_META.dust.axisLabel, angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="value"
                      name="Dust Average"
                      onClick={(row: any) => {
                        if (row?.stage) {
                          setActiveStage(row.stage as SessionType);
                        }
                      }}
                      radius={[4, 4, 0, 0]}
                    >
                      {dustByStage.map((row) => (
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
              <p className="cs-card-header">Air Quality Stage Comparison</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={airByStage}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="stage" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} label={{ value: 'Session Stage', position: 'insideBottom', offset: -5, fill: 'var(--text-muted)', fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} label={{ value: METRIC_META.air_quality.axisLabel, angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" name="Air Quality Average" fill="var(--chart-fill-2)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

        </>
      )}
    </div>
  );
}
