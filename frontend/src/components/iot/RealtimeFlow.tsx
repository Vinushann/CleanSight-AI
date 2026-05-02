'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getApiBaseUrl } from '@/core/apiBase';
import FlowNode from '@/components/iot/FlowNode';
import SensorCard from '@/components/iot/SensorCard';
import DataBubble from '@/components/iot/DataBubble';

type RealtimeReading = {
  timestamp_ms: number;
  session_id: string;
  device_id?: string | null;
  dust: number | null;
  air_quality: number | null;
  temperature: number | null;
  humidity: number | null;
};

type FlowStage = 'sensor' | 'esp32' | 'backend' | 'firebase' | 'dashboard' | 'done';

type BubbleMetric = 'temperature' | 'humidity' | 'air_quality' | 'dust';
type PredictionMetric = 'cleanliness' | 'anomaly_risk' | 'dust_forecast';
type BubblePayload = BubbleMetric | PredictionMetric;

type FlowBubble = {
  id: string;
  metric: BubblePayload;
  value: number;
  stage: FlowStage;
  sessionId: string;
  readingTimestamp: number;
};

type ControlState = {
  collecting: boolean;
  session_id?: string | null;
  device_id?: string | null;
  house_id?: string | null;
  room_id?: string | null;
  session_type?: 'before' | 'during' | 'after' | null;
};

type LatestValues = {
  temperature: number | null;
  humidity: number | null;
  air_quality: number | null;
  dust: number | null;
  timestamp_ms: number | null;
  session_id: string | null;
  device_id: string | null;
};

type PredictionValues = {
  cleanliness: number | null;
  anomaly_risk: number | null;
  dust_forecast: number | null;
};

const STAGE_ADVANCE_MS = 760;

const FLOW_POINTS = {
  dht22: { x: 11, y: 14 },
  mq135: { x: 11, y: 44 },
  gp2y1010: { x: 11, y: 74 },
  esp32: { x: 34, y: 44 },
  backend: { x: 55, y: 42 },
  firebase: { x: 75, y: 42 },
  dashboard: { x: 92, y: 42 },
};

const METRIC_META: Record<
  BubbleMetric,
  { label: string; short: string; color: string; sensor: 'dht22' | 'mq135' | 'gp2y1010'; decimals: number }
> = {
  temperature: { label: 'Temperature', short: 'Temp', color: '#2c7df4', sensor: 'dht22', decimals: 1 },
  humidity: { label: 'Humidity', short: 'Hum', color: '#1b9aaa', sensor: 'dht22', decimals: 1 },
  air_quality: { label: 'Air Quality', short: 'AQ', color: '#ed8936', sensor: 'mq135', decimals: 0 },
  dust: { label: 'Dust', short: 'Dust', color: '#6d7dff', sensor: 'gp2y1010', decimals: 2 },
};

const PREDICTION_META: Record<
  PredictionMetric,
  { label: string; short: string; color: string; decimals: number }
> = {
  cleanliness: { label: 'Cleanliness', short: 'Clean', color: '#1fcf90', decimals: 0 },
  anomaly_risk: { label: 'Anomaly Risk', short: 'Risk', color: '#ff6b6b', decimals: 0 },
  dust_forecast: { label: 'Dust Forecast', short: 'Dust+5', color: '#ffb454', decimals: 2 },
};

// Example payload shape used by the realtime flow animator.
// const mockReading: RealtimeReading = {
//   timestamp_ms: 1777628471059,
//   session_id: 'session_0ce22720e1a5',
//   device_id: 'esp32_all_sensors_01',
//   dust: 0.0,
//   air_quality: 127,
//   temperature: 31.5,
//   humidity: 79.6,
// };

function formatMetricValue(metric: BubbleMetric, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '-';
  return value.toFixed(METRIC_META[metric].decimals);
}

function formatPredictionValue(metric: PredictionMetric, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '-';
  return value.toFixed(PREDICTION_META[metric].decimals);
}

function formatPredictionPercent(metric: PredictionMetric, value: number | null): string {
  const base = formatPredictionValue(metric, value);
  return base === '-' ? base : `${base}%`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function getPredictionValues(reading: RealtimeReading): PredictionValues {
  const t = reading.temperature ?? 0;
  const h = reading.humidity ?? 0;
  const aq = reading.air_quality ?? 0;
  const d = reading.dust ?? 0;
  const cleanliness = clamp(Math.round(100 - d * 1.1 - aq * 0.22 + (60 - h) * 0.16), 0, 100);
  const anomalyRisk = clamp(Math.round(aq * 0.28 + d * 0.85 + Math.max(0, t - 30) * 4.2), 0, 100);
  const dustForecast = Math.max(0, d * 1.18 + aq * 0.03 + Math.max(0, h - 70) * 0.05);
  return { cleanliness, anomaly_risk: anomalyRisk, dust_forecast: dustForecast };
}

function NodeIcon({ type }: { type: 'esp32' | 'backend' | 'firebase' | 'dashboard' }) {
  if (type === 'esp32') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <rect x="5" y="6" width="14" height="12" rx="2.5" fill="#55afff" opacity="0.26" />
        <rect x="7.5" y="8.5" width="9" height="7" rx="1.4" fill="#9cd2ff" />
        <path d="M3 9h2M3 12h2M3 15h2M19 9h2M19 12h2M19 15h2" stroke="#cce8ff" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'backend') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <ellipse cx="12" cy="6.5" rx="6.5" ry="2.7" fill="#8cc8ff" />
        <path d="M5.5 6.5V12c0 1.5 2.9 2.7 6.5 2.7s6.5-1.2 6.5-2.7V6.5" fill="#5faef7" opacity="0.25" />
        <ellipse cx="12" cy="12" rx="6.5" ry="2.7" fill="#7ebeff" />
        <ellipse cx="12" cy="17.5" rx="6.5" ry="2.7" fill="#66b2ff" />
      </svg>
    );
  }
  if (type === 'firebase') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path d="M6 18 9.6 4.7c.1-.3.6-.4.8-.1l2.2 4-2.7 2.5 5.1-4.9c.2-.2.5-.1.6.2L18 18l-6 3Z" fill="#ffb44f" />
        <path d="m9.8 11.1 2.8-2.5 1.8 3.1z" fill="#ffe0ad" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path d="M4 18V8M9 18V11M14 18V6M19 18V13" stroke="#8fd1ff" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 15.5 9 12l5-2.8 5 3.6" stroke="#76c5ff" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export default function RealtimeFlow() {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  const [controlState, setControlState] = useState<ControlState>({
    collecting: false,
    session_id: null,
    device_id: null,
    house_id: null,
    room_id: null,
    session_type: null,
  });
  const [latestValues, setLatestValues] = useState<LatestValues>({
    temperature: null,
    humidity: null,
    air_quality: null,
    dust: null,
    timestamp_ms: null,
    session_id: null,
    device_id: null,
  });
  const [flowBubbles, setFlowBubbles] = useState<FlowBubble[]>([]);
  const [predictionValues, setPredictionValues] = useState<PredictionValues>({
    cleanliness: null,
    anomaly_risk: null,
    dust_forecast: null,
  });
  const [pulseSensor, setPulseSensor] = useState<{ dht22: boolean; mq135: boolean; gp2y1010: boolean }>({
    dht22: false,
    mq135: false,
    gp2y1010: false,
  });
  const [flowStatus, setFlowStatus] = useState<'idle' | 'collecting' | 'stopped' | 'no_data'>('idle');

  const lastSeenTimestampRef = useRef<number>(0);
  const lastSessionIdRef = useRef<string | null>(null);
  const pumpTimeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      pumpTimeoutsRef.current.forEach((timer) => window.clearTimeout(timer));
      pumpTimeoutsRef.current = [];
    };
  }, []);

  const triggerSensorPulse = (sensor: 'dht22' | 'mq135' | 'gp2y1010') => {
    setPulseSensor((prev) => ({ ...prev, [sensor]: true }));
    const timer = window.setTimeout(() => {
      setPulseSensor((prev) => ({ ...prev, [sensor]: false }));
    }, 520);
    pumpTimeoutsRef.current.push(timer);
  };

  const clearFlowAnimation = () => {
    pumpTimeoutsRef.current.forEach((timer) => window.clearTimeout(timer));
    pumpTimeoutsRef.current = [];
    setFlowBubbles([]);
  };

  const animateReading = useCallback((reading: RealtimeReading, deviceId: string | null) => {
    const metrics: BubbleMetric[] = [];
    if (reading.temperature != null) metrics.push('temperature');
    if (reading.humidity != null) metrics.push('humidity');
    if (reading.air_quality != null) metrics.push('air_quality');
    if (reading.dust != null) metrics.push('dust');
    if (!metrics.length) return;

    const bubbles: FlowBubble[] = metrics.map((metric) => ({
      id: `${reading.timestamp_ms}-${metric}`,
      metric,
      value: Number(reading[metric] as number),
      stage: 'sensor',
      sessionId: reading.session_id,
      readingTimestamp: reading.timestamp_ms,
    }));
    setFlowBubbles((prev) => [...prev, ...bubbles]);

    metrics.forEach((metric) => triggerSensorPulse(METRIC_META[metric].sensor));

    const predictions = getPredictionValues(reading);
    setPredictionValues(predictions);
    const predictionBubbles: FlowBubble[] = (Object.keys(predictions) as PredictionMetric[]).map((metric) => ({
      id: `${reading.timestamp_ms}-${metric}`,
      metric,
      value: Number(predictions[metric] as number),
      stage: 'esp32',
      sessionId: reading.session_id,
      readingTimestamp: reading.timestamp_ms,
    }));
    setFlowBubbles((prev) => [...prev, ...predictionBubbles]);

    const stages: FlowStage[] = ['esp32', 'backend', 'firebase', 'dashboard', 'done'];
    stages.forEach((stage, index) => {
      const timer = window.setTimeout(() => {
        setFlowBubbles((prev) =>
          prev
            .map((bubble) =>
              bubble.readingTimestamp === reading.timestamp_ms ? { ...bubble, stage } : bubble
            )
            .filter((bubble) => bubble.stage !== 'done')
        );
        if (stage === 'dashboard') {
          setLatestValues({
            temperature: reading.temperature,
            humidity: reading.humidity,
            air_quality: reading.air_quality,
            dust: reading.dust,
            timestamp_ms: reading.timestamp_ms,
            session_id: reading.session_id,
            device_id: deviceId,
          });
        }
      }, STAGE_ADVANCE_MS * (index + 1));
      pumpTimeoutsRef.current.push(timer);
    });
  }, []);

  useEffect(() => {
    let canceled = false;
    let pollTimer: number | undefined;

    const pollRealtime = async () => {
      try {
        const controlResponse = await fetch(`${apiBaseUrl}/api/device/control`, { cache: 'no-store' });
        const controlPayload = (await controlResponse.json()) as ControlState;
        if (!controlResponse.ok) {
          throw new Error('Unable to load device control state.');
        }
        if (canceled) return;
        setControlState(controlPayload);

        if (!controlPayload.collecting || !controlPayload.session_id) {
          setFlowStatus((status) => (status === 'idle' ? 'idle' : 'stopped'));
          clearFlowAnimation();
          setLatestValues({
            temperature: null,
            humidity: null,
            air_quality: null,
            dust: null,
            timestamp_ms: null,
            session_id: controlPayload.session_id || null,
            device_id: controlPayload.device_id || null,
          });
          lastSessionIdRef.current = null;
          lastSeenTimestampRef.current = 0;
          return;
        }

        setFlowStatus('collecting');

        if (lastSessionIdRef.current !== controlPayload.session_id) {
          clearFlowAnimation();
          lastSeenTimestampRef.current = 0;
          lastSessionIdRef.current = controlPayload.session_id;
        }

        const readingsResponse = await fetch(
          `${apiBaseUrl}/api/session/${controlPayload.session_id}/readings`,
          { cache: 'no-store' }
        );
        const readingsPayload = await readingsResponse.json();
        if (!readingsResponse.ok) {
          throw new Error(readingsPayload?.detail || 'Unable to load realtime readings.');
        }
        if (canceled) return;

        const readings = (readingsPayload?.readings || []) as RealtimeReading[];
        const latest = readings.length ? readings[readings.length - 1] : null;
        if (!latest) {
          setFlowStatus('no_data');
          return;
        }

        if (latest.timestamp_ms <= lastSeenTimestampRef.current) {
          return;
        }

        lastSeenTimestampRef.current = latest.timestamp_ms;
        animateReading(latest, controlPayload.device_id || null);
      } catch {
        if (!canceled) {
          setFlowStatus('idle');
        }
      } finally {
        if (!canceled) {
          pollTimer = window.setTimeout(pollRealtime, 1800);
        }
      }
    };

    void pollRealtime();
    return () => {
      canceled = true;
      if (pollTimer) {
        window.clearTimeout(pollTimer);
      }
    };
  }, [animateReading, apiBaseUrl]);

  const bubblePosition = (bubble: FlowBubble): { x: number; y: number } => {
    if (bubble.stage === 'sensor' && bubble.metric in METRIC_META) {
      const sensor = METRIC_META[bubble.metric as BubbleMetric].sensor;
      return FLOW_POINTS[sensor];
    }
    if (bubble.stage === 'esp32') return FLOW_POINTS.esp32;
    if (bubble.stage === 'backend') return FLOW_POINTS.backend;
    if (bubble.stage === 'firebase') return FLOW_POINTS.firebase;
    return FLOW_POINTS.dashboard;
  };

  const liveTimestampText = latestValues.timestamp_ms
    ? new Date(latestValues.timestamp_ms).toLocaleTimeString()
    : '-';

  return (
    <section className="cs-card">
      <div className="flex items-center justify-between gap-3">
        <p className="cs-card-header text-base">Realtime Data Flow</p>
        <div className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          {flowStatus === 'collecting' ? 'Live collecting' : flowStatus === 'stopped' ? 'Collection stopped' : flowStatus === 'no_data' ? 'Waiting for readings' : 'Idle'}
        </div>
      </div>

      <div className="mt-3 rounded-3xl border p-4" style={{ borderColor: 'var(--border-color)', background: 'radial-gradient(circle at top left, rgba(77,163,255,0.08), transparent 32%), linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, #081225 6%), color-mix(in srgb, var(--bg-card) 98%, #030814 2%))' }}>
        <div className="relative min-h-[760px] overflow-hidden rounded-2xl">
          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <linearGradient id="iotFlowLine" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#4da3ff" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#86d0ff" stopOpacity="0.75" />
              </linearGradient>
              <linearGradient id="iotFlowCore" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6fc1ff" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#c9f0ff" stopOpacity="0.5" />
              </linearGradient>
            </defs>
            <line x1="11%" y1="14%" x2="34%" y2="44%" stroke="url(#iotFlowLine)" strokeWidth="2.2" />
            <line x1="11%" y1="44%" x2="34%" y2="44%" stroke="url(#iotFlowLine)" strokeWidth="2.2" />
            <line x1="11%" y1="74%" x2="34%" y2="44%" stroke="url(#iotFlowLine)" strokeWidth="2.2" />
            <line x1="34%" y1="44%" x2="55%" y2="42%" stroke="url(#iotFlowLine)" strokeWidth="2.4" />
            <line x1="55%" y1="42%" x2="75%" y2="42%" stroke="url(#iotFlowLine)" strokeWidth="2.4" />
            <line x1="75%" y1="42%" x2="92%" y2="42%" stroke="url(#iotFlowLine)" strokeWidth="2.4" />
            <line x1="34%" y1="44%" x2="92%" y2="42%" stroke="url(#iotFlowCore)" strokeWidth="8" strokeLinecap="round" opacity="0.18" />
          </svg>

          <SensorCard
            sensorType="dht22"
            title="DHT22"
            subtitle="Temperature & Humidity Sensor"
            pulse={pulseSensor.dht22}
            x={FLOW_POINTS.dht22.x}
            y={FLOW_POINTS.dht22.y}
            values={[
              { label: 'Temp', value: formatMetricValue('temperature', latestValues.temperature) },
              { label: 'Hum', value: formatMetricValue('humidity', latestValues.humidity) },
            ]}
          />
          <SensorCard
            sensorType="mq135"
            title="MQ-135"
            subtitle="Air Quality Sensor"
            pulse={pulseSensor.mq135}
            x={FLOW_POINTS.mq135.x}
            y={FLOW_POINTS.mq135.y}
            values={[{ label: 'AQ', value: formatMetricValue('air_quality', latestValues.air_quality) }]}
          />
          <SensorCard
            sensorType="gp2y1010"
            title="GP2Y1010"
            subtitle="Dust Sensor"
            pulse={pulseSensor.gp2y1010}
            x={FLOW_POINTS.gp2y1010.x}
            y={FLOW_POINTS.gp2y1010.y}
            values={[{ label: 'Dust', value: formatMetricValue('dust', latestValues.dust) }]}
          />

          <FlowNode title="ESP32" subtitle={`${controlState.device_id || 'device unavailable'} + TinyML predictions`} x={FLOW_POINTS.esp32.x} y={FLOW_POINTS.esp32.y} icon={<NodeIcon type="esp32" />} />
          <FlowNode title="Backend API" subtitle="Ingestion + validation + prediction payload" x={FLOW_POINTS.backend.x} y={FLOW_POINTS.backend.y} icon={<NodeIcon type="backend" />} />
          <FlowNode title="Firebase" subtitle="Session readings + prediction store" x={FLOW_POINTS.firebase.x} y={FLOW_POINTS.firebase.y} icon={<NodeIcon type="firebase" />} />
          <FlowNode title="Dashboard" subtitle="Latest values + charts + predictions" x={FLOW_POINTS.dashboard.x} y={FLOW_POINTS.dashboard.y} height={186} icon={<NodeIcon type="dashboard" />}>
            <div className="mt-2 flex items-end gap-1.5 rounded-lg px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(125, 170, 255, 0.1)' }}>
              {[latestValues.temperature, latestValues.humidity, latestValues.air_quality, latestValues.dust].map((v, idx) => {
                const value = v ?? 0;
                const h = `${clamp((value / (idx === 2 ? 180 : idx === 3 ? 80 : 100)) * 100, 20, 96)}%`;
                return (
                  <span
                    key={idx}
                    className="block w-3 rounded-sm"
                    style={{
                      height: h,
                      background: idx === 0 ? '#4da3ff' : idx === 1 ? '#1b9aaa' : idx === 2 ? '#ed8936' : '#6d7dff',
                      opacity: 0.9,
                    }}
                  />
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
              <span style={{ color: 'var(--text-secondary)' }}>Temp</span>
              <span className="text-right font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatMetricValue('temperature', latestValues.temperature)}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>Hum</span>
              <span className="text-right font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatMetricValue('humidity', latestValues.humidity)}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>AQ</span>
              <span className="text-right font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatMetricValue('air_quality', latestValues.air_quality)}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>Dust</span>
              <span className="text-right font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatMetricValue('dust', latestValues.dust)}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>Cleanliness</span>
              <span className="text-right font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatPredictionPercent('cleanliness', predictionValues.cleanliness)}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>Anomaly</span>
              <span className="text-right font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatPredictionPercent('anomaly_risk', predictionValues.anomaly_risk)}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>Dust+5m</span>
              <span className="text-right font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatPredictionValue('dust_forecast', predictionValues.dust_forecast)}
              </span>
            </div>
          </FlowNode>

          {flowBubbles.map((bubble) => {
            const pos = bubblePosition(bubble);
            const meta = bubble.metric in METRIC_META
              ? METRIC_META[bubble.metric as BubbleMetric]
              : PREDICTION_META[bubble.metric as PredictionMetric];
            return (
              <DataBubble
                key={bubble.id}
                label={meta.short}
                valueText={bubble.value.toFixed(meta.decimals)}
                x={pos.x}
                y={pos.y}
                color={meta.color}
              />
            );
          })}

          {flowStatus === 'no_data' ? (
            <div
              className="absolute left-1/2 top-[82%] -translate-x-1/2 rounded-full px-4 py-2 text-sm font-medium"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(138, 178, 255, 0.16)',
                color: 'var(--text-secondary)',
              }}
            >
              Waiting for first reading from the active session...
            </div>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
            Session: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{latestValues.session_id || controlState.session_id || '-'}</span>
          </div>
          <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
            Device: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{latestValues.device_id || controlState.device_id || '-'}</span>
          </div>
          <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
            Last packet: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{liveTimestampText}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
