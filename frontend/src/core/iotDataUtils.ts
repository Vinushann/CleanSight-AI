import type { MetricKey, ReadingPoint, SessionRecord, SessionType } from '@/core/iotTypes';

export type TimeRangeSelection = {
  startIndex: number;
  endIndex: number;
};

export function isSameTimeRangeSelection(
  left: TimeRangeSelection | null,
  right: TimeRangeSelection | null
): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.startIndex === right.startIndex && left.endIndex === right.endIndex;
}

export type AnomalyFlag = {
  reading_id: string;
  session_id: string;
  session_type: SessionType;
  timestamp_ms: number;
  reasons: string[];
  score: number;
};

const METRIC_LIMITS: Record<MetricKey, { high: number; spike: number }> = {
  dust: { high: 180, spike: 45 },
  air_quality: { high: 250, spike: 55 },
  temperature: { high: 32, spike: 2.8 },
  humidity: { high: 75, spike: 8 },
};

export const METRIC_META: Record<
  MetricKey,
  { label: string; unit: string; lowerIsBetter: boolean; description: string; axisLabel: string }
> = {
  dust: {
    label: 'Dust',
    unit: 'PM ug/m3',
    lowerIsBetter: true,
    description: 'Dust shows the concentration of tiny particles in air. Lower values usually mean cleaner indoor air.',
    axisLabel: 'Dust concentration',
  },
  air_quality: {
    label: 'Air Quality',
    unit: 'Air quality index',
    lowerIsBetter: true,
    description: 'Air Quality is a proxy score showing how polluted the air is. Lower values generally mean better air.',
    axisLabel: 'Air quality level',
  },
  temperature: {
    label: 'Temperature',
    unit: 'Degrees Celsius',
    lowerIsBetter: true,
    description: 'Temperature shows how hot or cool the room is in degrees Celsius.',
    axisLabel: 'Temperature',
  },
  humidity: {
    label: 'Humidity',
    unit: 'Relative humidity %',
    lowerIsBetter: true,
    description: 'Humidity shows the amount of moisture in the air as a percentage.',
    axisLabel: 'Humidity',
  },
};

export function formatSessionLabel(session: Pick<SessionRecord, 'house_id' | 'room_id' | 'session_type'>): string {
  return `${session.house_id} - ${session.room_id} (${session.session_type})`;
}

export function withTimestampLabel(readings: ReadingPoint[]) {
  return readings.map((row) => {
    const rawTimestamp = row.timestamp_ms || 0;
    const fallbackTime = row.recorded_at ? new Date(row.recorded_at).getTime() : 0;
    const ts = rawTimestamp > 0 ? rawTimestamp : fallbackTime;
    const date = ts > 0 ? new Date(ts) : new Date();
    return {
      ...row,
      chartLabel: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      chartDateLabel: date.toLocaleDateString(),
      ts,
    };
  });
}

export function filterByTimeRange<T>(rows: T[], range: TimeRangeSelection | null): T[] {
  if (!range || rows.length === 0) {
    return rows;
  }
  const start = Math.max(0, Math.min(range.startIndex, range.endIndex));
  const end = Math.min(rows.length - 1, Math.max(range.startIndex, range.endIndex));
  return rows.slice(start, end + 1);
}

export function pickRecent(readings: ReadingPoint[], limit: number) {
  if (limit <= 0) {
    return readings;
  }
  return readings.slice(-limit);
}

export function filterBySessionType(readings: ReadingPoint[], sessionType: SessionType | 'all') {
  if (sessionType === 'all') {
    return readings;
  }
  return readings.filter((row) => row.session_type === sessionType);
}

export function metricValue(reading: ReadingPoint, key: MetricKey): number {
  const value = reading[key];
  return value == null ? 0 : Number(value);
}

export function averageBySessionType(readings: ReadingPoint[], metric: MetricKey) {
  const stageOrder: Array<SessionType> = ['before', 'during', 'after'];
  return stageOrder.map((stage) => {
    const stageRows = readings.filter((row) => row.session_type === stage);
    if (!stageRows.length) {
      return { stage, value: 0 };
    }
    const total = stageRows.reduce((sum, row) => sum + metricValue(row, metric), 0);
    return { stage, value: Number((total / stageRows.length).toFixed(2)) };
  });
}

export function latestMetric(readings: ReadingPoint[], metric: MetricKey): number {
  if (!readings.length) {
    return 0;
  }
  return metricValue(readings[readings.length - 1], metric);
}

export function metricSummary(readings: ReadingPoint[], metric: MetricKey) {
  const values = readings
    .map((row) => metricValue(row, metric))
    .filter((value) => Number.isFinite(value));

  if (!values.length) {
    return {
      latest: 0,
      average: 0,
      min: 0,
      max: 0,
      p95: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const latest = metricValue(readings[readings.length - 1], metric);
  return {
    latest: Number(latest.toFixed(2)),
    average: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)),
    min: Number(sorted[0].toFixed(2)),
    max: Number(sorted[sorted.length - 1].toFixed(2)),
    p95: Number(sorted[p95Index].toFixed(2)),
  };
}

export function detectAnomalies(readings: ReadingPoint[]): AnomalyFlag[] {
  const anomalies: AnomalyFlag[] = [];
  let prev: ReadingPoint | null = null;

  for (const row of readings) {
    const reasons: string[] = [];
    (Object.keys(METRIC_LIMITS) as MetricKey[]).forEach((metric) => {
      const current = metricValue(row, metric);
      const { high, spike } = METRIC_LIMITS[metric];
      if (current > high) {
        reasons.push(`${METRIC_META[metric].label} above expected limit`);
      }
      if (prev) {
        const previous = metricValue(prev, metric);
        if (Math.abs(current - previous) > spike) {
          reasons.push(`${METRIC_META[metric].label} sudden spike`);
        }
      }
    });

    if (reasons.length) {
      anomalies.push({
        reading_id: row.reading_id,
        session_id: row.session_id,
        session_type: row.session_type,
        timestamp_ms: row.timestamp_ms || 0,
        reasons,
        score: reasons.length,
      });
    }

    prev = row;
  }

  return anomalies;
}

export function anomalySet(readings: ReadingPoint[]): Set<string> {
  return new Set(detectAnomalies(readings).map((row) => row.reading_id));
}

export function sessionAverages(
  sessions: SessionRecord[],
  readings: ReadingPoint[],
  metric: MetricKey
): Array<{ session_id: string; session_type: SessionType; value: number; total_points: number }> {
  return sessions
    .map((session) => {
      const sessionRows = readings.filter((row) => row.session_id === session.session_id);
      if (!sessionRows.length) {
        return null;
      }
      const average =
        sessionRows.reduce((sum, row) => sum + metricValue(row, metric), 0) / sessionRows.length;
      return {
        session_id: session.session_id,
        session_type: session.session_type,
        value: Number(average.toFixed(2)),
        total_points: sessionRows.length,
      };
    })
    .filter((row): row is { session_id: string; session_type: SessionType; value: number; total_points: number } => row !== null);
}

export function stageComparisonInsight(
  stageRows: Array<{ stage: SessionType; value: number }>,
  metric: MetricKey
): { headline: string; detail: string; status: 'good' | 'moderate' | 'poor' } {
  const before = stageRows.find((row) => row.stage === 'before')?.value ?? 0;
  const after = stageRows.find((row) => row.stage === 'after')?.value ?? 0;
  const during = stageRows.find((row) => row.stage === 'during')?.value ?? 0;

  if (!before || !after) {
    return {
      headline: 'Not enough staged data',
      detail: `Need both before and after sessions to evaluate ${METRIC_META[metric].label.toLowerCase()} change.`,
      status: 'moderate',
    };
  }

  const changePercent = Number((((before - after) / before) * 100).toFixed(1));
  const improved = changePercent > 0;
  const trendWord = improved ? 'decreased' : 'increased';
  const absChange = Math.abs(changePercent);
  const status: 'good' | 'moderate' | 'poor' = improved && absChange >= 20 ? 'good' : improved ? 'moderate' : 'poor';

  return {
    headline: `${METRIC_META[metric].label} ${trendWord} ${absChange}% after cleaning`,
    detail: `Before: ${before.toFixed(2)} ${METRIC_META[metric].unit}, During: ${during.toFixed(2)}, After: ${after.toFixed(2)}.`,
    status,
  };
}

export function decisionStatusFromDustAir(
  dustByStage: Array<{ stage: SessionType; value: number }>,
  airByStage: Array<{ stage: SessionType; value: number }>
): {
  cleaning_effectiveness: 'effective' | 'partially_effective' | 'not_effective';
  recommended_action: 'monitor' | 'reclean_required' | 'urgent_attention';
} {
  const beforeDust = dustByStage.find((row) => row.stage === 'before')?.value ?? 0;
  const afterDust = dustByStage.find((row) => row.stage === 'after')?.value ?? 0;
  const beforeAir = airByStage.find((row) => row.stage === 'before')?.value ?? 0;
  const afterAir = airByStage.find((row) => row.stage === 'after')?.value ?? 0;

  if (!beforeDust || !afterDust || !beforeAir || !afterAir) {
    return {
      cleaning_effectiveness: 'partially_effective',
      recommended_action: 'monitor',
    };
  }

  const dustDrop = ((beforeDust - afterDust) / beforeDust) * 100;
  const airDrop = ((beforeAir - afterAir) / beforeAir) * 100;

  if (dustDrop >= 20 && airDrop >= 15) {
    return { cleaning_effectiveness: 'effective', recommended_action: 'monitor' };
  }
  if (dustDrop >= 8 || airDrop >= 8) {
    return { cleaning_effectiveness: 'partially_effective', recommended_action: 'reclean_required' };
  }
  return { cleaning_effectiveness: 'not_effective', recommended_action: 'urgent_attention' };
}

export function formatDateRange(fromDate: string, toDate: string): string {
  if (!fromDate && !toDate) {
    return 'All dates';
  }
  if (fromDate && !toDate) {
    return fromDate;
  }
  if (!fromDate && toDate) {
    return toDate;
  }
  if (fromDate === toDate) {
    return fromDate;
  }
  return `${fromDate} to ${toDate}`;
}

export function statusFromAQI(value: number): 'Good' | 'Moderate' | 'Poor' {
  if (value <= 80) {
    return 'Good';
  }
  if (value <= 150) {
    return 'Moderate';
  }
  return 'Poor';
}
