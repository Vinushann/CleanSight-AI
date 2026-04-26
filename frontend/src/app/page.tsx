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
import { FileText, ShieldCheck } from 'lucide-react';

import HelpHint from '@/components/HelpHint';
import HouseCleaningReportModal from '@/components/HouseCleaningReportModal';
import PersistentContextBar from '@/components/PersistentContextBar';
import { useDashboardData } from '@/core/DashboardDataContext';
import { METRIC_COLORS } from '@/core/chartColors';
import {
  averageBySessionType,
  decisionStatusFromDustAir,
  detectAnomalies,
  filterBySessionType,
  filterByTimeRange,
  METRIC_META,
  metricSummary,
  statusFromAQI,
  type TimeRangeSelection,
  withTimestampLabel,
} from '@/core/iotDataUtils';
import type { MetricKey, SessionType } from '@/core/iotTypes';

function getStageValue(stageRows: Array<{ stage: SessionType; value: number }>, stage: SessionType): number {
  return stageRows.find((row) => row.stage === stage)?.value ?? 0;
}

function getReductionPercent(before: number, after: number): number | null {
  if (!before || !Number.isFinite(before) || !Number.isFinite(after)) return null;
  return Number((((before - after) / before) * 100).toFixed(1));
}

function formatReduction(value: number | null): string {
  if (value == null) return 'Not enough before/after data';
  if (value > 0) return `${value}% lower after cleaning`;
  if (value < 0) return `${Math.abs(value)}% higher after cleaning`;
  return 'No after-cleaning change';
}

function actionLabel(action: string): string {
  return action.replace(/_/g, ' ');
}

export default function DashboardPage() {
  const { data, error, loadingData, setSelectedSessionType, applySearch } = useDashboardData();
  const [activeStage, setActiveStage] = useState<SessionType | 'all'>('all');
  const [metricFocus, setMetricFocus] = useState<MetricKey>('dust');
  const [brushRange, setBrushRange] = useState<TimeRangeSelection | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

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

  const latestAQI = useMemo(() => metricSummary(linkedRows, 'air_quality').latest, [linkedRows]);
  const decision = useMemo(() => decisionStatusFromDustAir(dustByStage, airByStage), [dustByStage, airByStage]);
  const cleaningInsight = useMemo(() => {
    const dustBefore = getStageValue(dustByStage, 'before');
    const dustAfter = getStageValue(dustByStage, 'after');
    const airBefore = getStageValue(airByStage, 'before');
    const airAfter = getStageValue(airByStage, 'after');
    const dustReduction = getReductionPercent(dustBefore, dustAfter);
    const airReduction = getReductionPercent(airBefore, airAfter);
    const effectiveness = decision.cleaning_effectiveness.replace('_', ' ');

    return {
      dustReduction,
      airReduction,
      headline:
        decision.cleaning_effectiveness === 'effective'
          ? 'Cleaning result looks acceptable'
          : decision.cleaning_effectiveness === 'partially_effective'
            ? 'Cleaning improved conditions, but needs review'
            : 'Cleaning needs attention',
      summary:
        `Decision: ${effectiveness}. Recommended action: ${actionLabel(decision.recommended_action)}.`,
      dustLine: `Dust: ${dustBefore.toFixed(2)} -> ${dustAfter.toFixed(2)} ${METRIC_META.dust.unit} (${formatReduction(dustReduction)}).`,
      airLine: `Air quality: ${airBefore.toFixed(2)} -> ${airAfter.toFixed(2)} ${METRIC_META.air_quality.unit} (${formatReduction(airReduction)}).`,
    };
  }, [airByStage, decision, dustByStage]);
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
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1">
            <PersistentContextBar
              activeStage={activeStage}
              selectedSessionId={selectedSessionId}
              brushedPoints={brushedPoints}
              onResetInteractions={resetLinkedViews}
            />
          </div>
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold"
            style={{
              background: 'var(--accent-primary)',
              color: '#fff',
              boxShadow: '0 12px 24px rgba(0, 122, 255, 0.22)',
            }}
          >
            <FileText size={17} />
            Report
          </button>
        </div>
      ) : null}

      {error ? (
        <section className="cs-card">
          <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--badge-poor-bg)', color: 'var(--badge-poor-text)' }}>
            {error}
          </div>
        </section>
      ) : null}

      {showStartState ? (
        <section className="min-h-[64vh] flex items-center justify-center">
          <div
            className="w-full max-w-xl rounded-lg border px-8 py-9 text-center"
            style={{
              borderColor: 'var(--border-color)',
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 92%, var(--bg-main) 8%) 0%, var(--bg-card) 100%)',
              boxShadow: 'var(--shadow-card)',
              backdropFilter: 'saturate(180%) blur(22px)',
            }}
          >
            <div
              className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-lg"
              style={{
                background: 'var(--bg-active)',
                border: '1px solid var(--border-active)',
                boxShadow: 'var(--control-inset-shadow, 0 1px 0 rgba(255,255,255,0.8) inset)',
                color: 'var(--accent-primary)',
              }}
            >
              <ShieldCheck size={24} />
            </div>
            <h2 className="text-4xl font-bold" style={{ color: 'var(--text-heading)' }}>
              CleanSight AI
            </h2>
            <p className="mt-4 text-base leading-7" style={{ color: 'var(--text-secondary)' }}>
              Please choose the preferred date, house, and room from the top-right filters.
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
                className="rounded-lg px-5 py-2.5 text-sm font-bold"
                style={{
                  background: loadingData ? 'var(--border-light)' : 'var(--accent-primary)',
                  color: loadingData ? 'var(--text-muted)' : '#FFFFFF',
                  boxShadow: loadingData ? 'none' : '0 10px 22px rgba(0, 122, 255, 0.22)',
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
                      stroke={METRIC_COLORS.dust}
                      strokeWidth={metricFocus === 'dust' ? 3 : 2.1}
                      strokeOpacity={metricFocus === 'dust' ? 1 : 0.82}
                      dot={false}
                    />
                    <Line type="monotone" dataKey="air_quality" name={METRIC_META.air_quality.label} stroke={METRIC_COLORS.air_quality} strokeWidth={metricFocus === 'air_quality' ? 3 : 2.1} strokeOpacity={metricFocus === 'air_quality' ? 1 : 0.82} dot={false} />
                    <Line type="monotone" dataKey="temperature" name={METRIC_META.temperature.label} stroke={METRIC_COLORS.temperature} strokeWidth={metricFocus === 'temperature' ? 3 : 2.1} strokeOpacity={metricFocus === 'temperature' ? 1 : 0.82} dot={false} />
                    <Line type="monotone" dataKey="humidity" name={METRIC_META.humidity.label} stroke={METRIC_COLORS.humidity} strokeWidth={metricFocus === 'humidity' ? 3 : 2.1} strokeOpacity={metricFocus === 'humidity' ? 1 : 0.82} dot={false} />
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
                <div
                  className={`rounded-md px-3 py-2 text-sm ${
                    decision.cleaning_effectiveness === 'effective'
                      ? 'badge-good'
                      : decision.cleaning_effectiveness === 'not_effective'
                        ? 'badge-poor'
                        : 'badge-moderate'
                  }`}
                >
                  {cleaningInsight.headline}
                </div>
                <div className="rounded-md px-3 py-2 text-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
                  <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>Recommended next step</span>
                  <br />
                  {cleaningInsight.summary}
                </div>
                <div className="rounded-md px-3 py-2 text-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
                  <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>Cleaning evidence</span>
                  <br />
                  {cleaningInsight.dustLine}
                  <br />
                  {cleaningInsight.airLine}
                </div>
                <div className="rounded-md px-3 py-2 text-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
                  <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>Watch points</span>
                  <br />
                  {anomalies.length > 0
                    ? `${anomalies.length} suspicious reading(s) were found in the current view. Review spikes before signing off.`
                    : 'No suspicious readings were found in the current view.'}
                  {activeStage !== 'all' ? (
                    <>
                      <br />
                      Viewing only the {activeStage} cleaning stage.
                    </>
                  ) : null}
                </div>
                {compareCardDelta?.dust_delta || compareCardDelta?.air_quality_delta ? (
                  <div className="rounded-md px-3 py-2 text-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
                    <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>Room vs house context</span>
                    <br />
                    Dust difference: {compareCardDelta.dust_delta?.toFixed(2) ?? '-'}
                    <br />
                    Air quality difference: {compareCardDelta.air_quality_delta?.toFixed(2) ?? '-'}
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
                      fill={METRIC_COLORS.dust}
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
                          fill={METRIC_COLORS.dust}
                          stroke={activeStage === row.stage ? 'var(--accent-primary)' : 'transparent'}
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
                    <Bar dataKey="value" name="Air Quality Average" fill={METRIC_COLORS.air_quality} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {data ? (
            <HouseCleaningReportModal
              open={reportOpen}
              onClose={() => setReportOpen(false)}
              data={data}
              rows={rows}
              dustByStage={dustByStage}
              airByStage={airByStage}
              anomalies={anomalies}
              decision={decision}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
