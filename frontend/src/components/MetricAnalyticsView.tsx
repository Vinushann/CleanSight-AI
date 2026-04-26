'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useDashboardData } from '@/core/DashboardDataContext';
import { METRIC_COLORS, SESSION_STAGE_TONES, type StageTone } from '@/core/chartColors';
import {
  averageBySessionType,
  detectAnomalies,
  filterBySessionType,
  filterByTimeRange,
  formatSessionLabel,
  isSameTimeRangeSelection,
  METRIC_META,
  metricSummary,
  statusFromAQI,
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

function metricInsightTone(decision: ReturnType<typeof decisionBadge>, improved: boolean): 'good' | 'moderate' | 'poor' {
  if (decision === 'critical') return 'poor';
  if (decision === 'warning') return 'moderate';
  return improved ? 'good' : 'moderate';
}

function badgeClass(tone: 'good' | 'moderate' | 'poor') {
  if (tone === 'good') return 'badge-good';
  if (tone === 'poor') return 'badge-poor';
  return 'badge-moderate';
}

function formatMetricValue(value: number, metric: MetricKey): string {
  return `${value.toFixed(2)} ${METRIC_META[metric].unit}`;
}

function buildMetricInsight({
  metric,
  stageRows,
  summary,
  anomaliesCount,
  decision,
  roomDelta,
  activeStage,
}: {
  metric: MetricKey;
  stageRows: Array<{ stage: SessionType; value: number }>;
  summary: ReturnType<typeof metricSummary>;
  anomaliesCount: number;
  decision: ReturnType<typeof decisionBadge>;
  roomDelta: number | null | undefined;
  activeStage: SessionType | 'all';
}) {
  const before = stageRows.find((row) => row.stage === 'before')?.value ?? 0;
  const during = stageRows.find((row) => row.stage === 'during')?.value ?? 0;
  const after = stageRows.find((row) => row.stage === 'after')?.value ?? 0;
  const lowerIsBetter = metric === 'dust' || metric === 'air_quality';
  const hasBeforeAfter = before > 0 && after > 0;
  const delta = after - before;
  const improvementPercentValue = hasBeforeAfter ? ((before - after) / before) * 100 : 0;
  const improved = lowerIsBetter ? improvementPercentValue > 0 : Math.abs(delta) <= Math.max(Math.abs(before) * 0.08, 1);
  const tone = metricInsightTone(decision, improved);

  const headline = lowerIsBetter
    ? hasBeforeAfter
      ? improved
        ? `${METRIC_META[metric].label} improved after cleaning`
        : `${METRIC_META[metric].label} did not improve enough`
      : `Need before and after ${METRIC_META[metric].label.toLowerCase()} readings`
    : hasBeforeAfter
      ? `${METRIC_META[metric].label} changed by ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`
      : `Need before and after ${METRIC_META[metric].label.toLowerCase()} readings`;

  const action = (() => {
    if (!hasBeforeAfter) {
      return 'Collect before and after readings before making a final cleaning decision.';
    }
    if (decision === 'critical') {
      return `Review this room before sign-off because the high-end ${METRIC_META[metric].label.toLowerCase()} reading is above the expected limit.`;
    }
    if (anomaliesCount > 0) {
      return `Check the ${anomaliesCount} suspicious reading(s), especially around visible spikes, before closing the session.`;
    }
    if (lowerIsBetter && improved) {
      return 'Cleaning moved the reading in the right direction. Continue monitoring the after-cleaning settled period.';
    }
    if (!lowerIsBetter) {
      return `Confirm the final ${METRIC_META[metric].label.toLowerCase()} is comfortable for the room before sign-off.`;
    }
    return 'Consider a quick re-check or re-clean because the after-cleaning reading is not clearly better than the baseline.';
  })();

  const movement = hasBeforeAfter
    ? lowerIsBetter
      ? `${formatMetricValue(before, metric)} before -> ${formatMetricValue(after, metric)} after (${Math.abs(improvementPercentValue).toFixed(1)}% ${improvementPercentValue >= 0 ? 'lower' : 'higher'}).`
      : `${formatMetricValue(before, metric)} before -> ${formatMetricValue(after, metric)} after. During cleaning: ${formatMetricValue(during, metric)}.`
    : 'Before/after readings are incomplete for this metric.';

  const baselineContext =
    typeof roomDelta === 'number' && roomDelta !== 0
      ? `This room is ${Math.abs(roomDelta).toFixed(2)} ${METRIC_META[metric].unit} ${roomDelta > 0 ? 'above' : 'below'} the house average.`
      : 'Room and house baseline are currently similar for this metric.';

  return {
    tone,
    headline,
    action,
    movement,
    range: `Current view average is ${formatMetricValue(summary.average, metric)}. P95 is ${formatMetricValue(summary.p95, metric)}.`,
    baselineContext,
    stageNote: activeStage === 'all' ? 'All cleaning stages are included.' : `Only the ${activeStage} stage is selected.`,
  };
}

type StageMetricCard = {
  stage: SessionType;
  title: string;
  timestamp: string;
  description: string;
  percentLabel: string;
  metricCaption: string;
  stats: Array<{ label: string; value: string; fill: number }>;
};

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function improvementPercent(before: number, current: number): number {
  if (!before || !Number.isFinite(before) || !Number.isFinite(current)) {
    return 0;
  }
  return clampPercentage(((before - current) / before) * 100);
}

function normalizedPercent(value: number, reference: number): number {
  if (!reference || !Number.isFinite(reference)) {
    return 0;
  }
  return clampPercentage((value / reference) * 100);
}

function formatStageTimestamp(timestampMs?: number | null, recordedAt?: string | null): string {
  const derived = timestampMs && timestampMs > 0 ? timestampMs : recordedAt ? new Date(recordedAt).getTime() : 0;
  if (!derived) {
    return 'Timestamp unavailable';
  }
  return new Date(derived).toLocaleString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusStrength(status: ReturnType<typeof statusFromAQI>): number {
  if (status === 'Good') return 92;
  if (status === 'Moderate') return 58;
  return 26;
}

function MetricStatStrip({
  tone,
  label,
  value,
  fill,
}: {
  tone: StageTone;
  label: string;
  value: string;
  fill: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-[11px]">
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className="text-right font-semibold" style={{ color: tone.text }}>
          {value}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full" style={{ background: tone.track }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${clampPercentage(fill)}%`,
            background: `linear-gradient(90deg, ${tone.accent} 0%, ${tone.accent}CC 100%)`,
            boxShadow: `0 0 0 1px ${tone.accent}22 inset`,
          }}
        />
      </div>
    </div>
  );
}

function metricStageDescription(metric: MetricKey, stage: SessionType): string {
  const descriptions: Record<MetricKey, Record<SessionType, string>> = {
    dust: {
      before: 'Baseline dust level captured before cleaning started.',
      during: 'Temporary particle disturbance while cleaning is in progress.',
      after: 'Final settled reading after cleaning was completed.',
    },
    air_quality: {
      before: 'Baseline air quality recorded before cleaning and ventilation work.',
      during: 'Air can fluctuate while dust and particles are disturbed during cleaning.',
      after: 'Final air quality reading after the room had time to stabilize.',
    },
    temperature: {
      before: 'Baseline room temperature before cleaning activity began.',
      during: 'Temperature during cleaning, when movement and ventilation can affect the room.',
      after: 'Final temperature after cleaning was completed and the room settled.',
    },
    humidity: {
      before: 'Baseline humidity before cleaning activity began.',
      during: 'Humidity during cleaning, when moisture and ventilation can shift conditions.',
      after: 'Final humidity after cleaning was completed and the room settled.',
    },
  };

  return descriptions[metric][stage];
}

function MetricStageProgressPanel({
  metric,
  cards,
  stageRows,
  activeStage,
  onSelectStage,
}: {
  metric: MetricKey;
  cards: StageMetricCard[];
  stageRows: Array<{ stage: SessionType; value: number }>;
  activeStage: SessionType | 'all';
  onSelectStage: (stage: SessionType) => void;
}) {
  const metricMeta = METRIC_META[metric];
  const before = stageRows.find((row) => row.stage === 'before')?.value ?? 0;
  const after = stageRows.find((row) => row.stage === 'after')?.value ?? 0;
  const reduction = improvementPercent(before, after);
  const finalChange = after - before;
  const maxValue = Math.max(...stageRows.map((row) => row.value), 50, 1);
  const lowerIsBetter = metric === 'dust' || metric === 'air_quality';
  const headlineValue = lowerIsBetter
    ? `${reduction.toFixed(1)}%`
    : `${finalChange >= 0 ? '+' : ''}${finalChange.toFixed(2)}`;
  const headlineCaption = lowerIsBetter
    ? `Final ${metricMeta.label.toLowerCase()} improvement`
    : `Final ${metricMeta.label.toLowerCase()} change`;
  const headlineBackground = lowerIsBetter
    ? reduction >= 20
      ? 'var(--badge-good-bg)'
      : reduction > 0
        ? 'var(--badge-moderate-bg)'
        : 'var(--badge-poor-bg)'
    : 'var(--bg-active)';
  const headlineColor = lowerIsBetter
    ? reduction > 0
      ? 'var(--badge-good-text)'
      : 'var(--badge-poor-text)'
    : 'var(--text-accent)';

  return (
    <section className="cs-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="cs-card-header mb-1">{metricMeta.label} Cleaning Progress</p>
          <p className="max-w-3xl text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
            A cleaner before, during, and after view. Click any stage to filter this page by that cleaning stage.
          </p>
        </div>
        <div
          className="rounded-2xl border px-4 py-3 text-right"
          style={{
            background: headlineBackground,
            borderColor: 'var(--border-light)',
          }}
        >
          <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
            {headlineCaption}
          </p>
          <p className="mt-1 text-3xl font-extrabold" style={{ color: headlineColor }}>
            {headlineValue}
          </p>
          {!lowerIsBetter ? (
            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              {metricMeta.unit}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border p-4" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
                Stage average {metricMeta.label.toLowerCase()} levels
              </h3>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                {lowerIsBetter
                  ? 'Lower after-cleaning values indicate better cleaning quality.'
                  : `Compare how ${metricMeta.label.toLowerCase()} changed across cleaning stages.`}
              </p>
            </div>
            <HelpHint text={`The chart compares average ${metricMeta.label.toLowerCase()} for before, during, and after cleaning.`} />
          </div>

          <div className="mt-5 flex h-72 items-end gap-4 rounded-2xl border px-4 pb-4 pt-8" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
            {stageRows.map((row) => {
              const tone = SESSION_STAGE_TONES[row.stage];
              const height = Math.max(12, (row.value / maxValue) * 210);
              const isActive = activeStage === row.stage;

              return (
                <button
                  key={row.stage}
                  type="button"
                  onClick={() => onSelectStage(row.stage)}
                  className="group flex h-full flex-1 flex-col items-center justify-end gap-2 rounded-xl px-2 pb-2 transition hover:-translate-y-1"
                  style={{
                    background: isActive ? tone.panel : 'transparent',
                    outline: isActive ? `2px solid ${tone.accent}` : 'none',
                  }}
                >
                  <span className="text-sm font-extrabold" style={{ color: tone.text }}>
                    {row.value.toFixed(2)}
                  </span>
                  <span
                    className="w-full max-w-24 rounded-t-2xl transition-all"
                    style={{
                      height,
                      background: `linear-gradient(180deg, ${tone.headerFrom} 0%, ${tone.headerTo} 100%)`,
                      boxShadow: isActive ? tone.glow : '0 12px 24px rgba(15, 23, 42, 0.10)',
                    }}
                  />
                  <span className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--text-secondary)' }}>
                    {row.stage}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3">
          {cards.map((card) => {
            const tone = SESSION_STAGE_TONES[card.stage];
            const isActive = activeStage === card.stage;
            const averageStat = card.stats[0];

            return (
              <button
                key={card.stage}
                type="button"
                onClick={() => onSelectStage(card.stage)}
                className="rounded-2xl border p-4 text-left transition hover:-translate-y-0.5"
                style={{
                  background: isActive ? tone.panel : 'var(--bg-input)',
                  borderColor: isActive ? tone.accent : 'var(--border-light)',
                  boxShadow: isActive ? tone.glow : 'none',
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: tone.text }}>
                      {card.title}
                    </p>
                    <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                      {metricStageDescription(metric, card.stage)}
                    </p>
                    <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {card.timestamp}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-extrabold" style={{ color: tone.accent }}>
                      {card.percentLabel}
                    </p>
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                      {card.metricCaption}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <MetricStatStrip tone={tone} label={averageStat.label} value={averageStat.value} fill={averageStat.fill} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
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
  const metricInsight = useMemo(
    () =>
      buildMetricInsight({
        metric,
        stageRows,
        summary,
        anomaliesCount: anomalies.length,
        decision,
        roomDelta,
        activeStage,
      }),
    [activeStage, anomalies.length, decision, metric, roomDelta, stageRows, summary]
  );
  const stageSummary = data?.metrics?.session_type_summary;
  const stageCards = useMemo(() => {
    const before = stageRows.find((row) => row.stage === 'before')?.value ?? 0;
    const during = stageRows.find((row) => row.stage === 'during')?.value ?? 0;
    const after = stageRows.find((row) => row.stage === 'after')?.value ?? 0;
    const values: Record<SessionType, number> = { before, during, after };
    const reference = Math.max(before, during, after, CRITICAL_LIMITS[metric], 1);
    const stages: SessionType[] = ['before', 'during', 'after'];

    const getPercentLabel = (stage: SessionType, value: number) => {
      if (stage === 'before') {
        return `${normalizedPercent(value, reference).toFixed(1)}%`;
      }
      if (metric === 'dust' || metric === 'air_quality') {
        return `${improvementPercent(before, value).toFixed(1)}%`;
      }
      const delta = value - before;
      return `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`;
    };

    const getMetricCaption = (stage: SessionType) => {
      if (stage === 'before') {
        if (metric === 'dust') return 'Dust load';
        if (metric === 'air_quality') return 'Air load';
        return 'Baseline';
      }
      if (metric === 'dust') return 'Dust reduction';
      if (metric === 'air_quality') return 'Air improvement';
      return `${METRIC_META[metric].label} change`;
    };

    const getStats = (stage: SessionType, value: number) => {
      const delta = value - before;
      const baseStats = [
        {
          label: `Average ${METRIC_META[metric].label.toLowerCase()}`,
          value: `${value.toFixed(2)} ${METRIC_META[metric].unit}`,
          fill: normalizedPercent(value, reference),
        },
      ];

      if (metric === 'air_quality') {
        const status = statusFromAQI(value);
        return [
          ...baseStats,
          {
            label: 'Air status',
            value: status,
            fill: statusStrength(status),
          },
        ];
      }

      if (stage === 'before') {
        return [
          ...baseStats,
          {
            label: metric === 'dust' ? 'Safe target' : 'Baseline reference',
            value: metric === 'dust' ? `50 ${METRIC_META.dust.unit}` : `${value.toFixed(2)} ${METRIC_META[metric].unit}`,
            fill: metric === 'dust' ? normalizedPercent(50, reference) : 100,
          },
        ];
      }

      return [
        ...baseStats,
        {
          label: 'Change vs before',
          value: `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} ${METRIC_META[metric].unit}`,
          fill: metric === 'dust'
            ? improvementPercent(before, value)
            : normalizedPercent(Math.abs(delta), Math.max(Math.abs(before), Math.abs(value), 1)),
        },
      ];
    };

    return stages.map((stage) => ({
      stage,
      title: `${stage[0].toUpperCase()}${stage.slice(1)} Cleaning`,
      timestamp: formatStageTimestamp(stageSummary?.[stage]?.latest?.timestamp_ms, stageSummary?.[stage]?.latest?.recorded_at),
      description: metricStageDescription(metric, stage),
      percentLabel: getPercentLabel(stage, values[stage]),
      metricCaption: getMetricCaption(stage),
      stats: getStats(stage, values[stage]),
    }));
  }, [metric, stageRows, stageSummary]);

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
                  stroke={METRIC_COLORS[metric]}
                  strokeWidth={2.4}
                  dot={false}
                />
                <Brush
                  dataKey="chartLabel"
                  height={24}
                  stroke={METRIC_COLORS[metric]}
                  travellerWidth={8}
                  onChange={(event) => {
                    if (!event || event.startIndex == null || event.endIndex == null) {
                      setBrushRange((current) => (current === null ? current : null));
                      return;
                    }
                    const nextRange = { startIndex: event.startIndex, endIndex: event.endIndex };
                    setBrushRange((current) =>
                      isSameTimeRangeSelection(current, nextRange) ? current : nextRange
                    );
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="cs-card">
          <p className="cs-card-header">Insight + Decision</p>
          <div className="space-y-3 text-sm">
            <div className={badgeClass(metricInsight.tone)}>
              {metricInsight.headline}
            </div>
            <div className="rounded-md px-3 py-2" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
              <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>Recommended action</span>
              <br />
              {metricInsight.action}
            </div>
            <div className="rounded-md px-3 py-2" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
              <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>Evidence</span>
              <br />
              {metricInsight.movement}
              <br />
              {metricInsight.range}
            </div>
            <div className="rounded-md px-3 py-2" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
              <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>Context</span>
              <br />
              {metricInsight.baselineContext}
              <br />
              {metricInsight.stageNote}
            </div>
          </div>
        </div>
      </section>

      <MetricStageProgressPanel
        metric={metric}
        cards={stageCards}
        stageRows={stageRows}
        activeStage={activeStage}
        onSelectStage={setActiveStage}
      />

      {metric !== 'dust' ? (
        <section className="grid grid-cols-1 gap-5">
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
                  <Bar dataKey="avg" name={`Avg ${METRIC_META[metric].label}`} fill={METRIC_COLORS[metric]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      ) : null}

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
                    <Line type="monotone" dataKey={metric} name={METRIC_META[metric].label} stroke={METRIC_COLORS[metric]} strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
