import type { MetricKey, SessionType } from '@/core/iotTypes';

export const METRIC_COLORS: Record<MetricKey, string> = {
  air_quality: '#7B61FF',
  dust: '#2D7FF9',
  humidity: '#2BB6A8',
  temperature: '#F4A261',
};

export type StageTone = {
  accent: string;
  track: string;
  text: string;
  glow: string;
  headerFrom: string;
  headerTo: string;
  panel: string;
};

export const SESSION_STAGE_TONES: Record<SessionType, StageTone> = {
  before: {
    accent: '#64748B',
    track: 'rgba(100, 116, 139, 0.16)',
    text: '#334155',
    glow: '0 16px 36px rgba(100, 116, 139, 0.16)',
    headerFrom: '#7C8795',
    headerTo: '#5B6677',
    panel: 'rgba(241, 245, 249, 0.78)',
  },
  during: {
    accent: '#475569',
    track: 'rgba(71, 85, 105, 0.16)',
    text: '#273142',
    glow: '0 16px 36px rgba(71, 85, 105, 0.18)',
    headerFrom: '#657083',
    headerTo: '#495467',
    panel: 'rgba(236, 241, 246, 0.80)',
  },
  after: {
    accent: '#334155',
    track: 'rgba(51, 65, 85, 0.16)',
    text: '#1F2937',
    glow: '0 16px 36px rgba(51, 65, 85, 0.18)',
    headerFrom: '#566173',
    headerTo: '#394455',
    panel: 'rgba(230, 236, 243, 0.82)',
  },
};

export function getMetricColor(metric: string): string {
  return (METRIC_COLORS as Record<string, string>)[metric] ?? 'var(--accent-primary)';
}

export function getStageTone(stage?: string): StageTone {
  return stage && stage in SESSION_STAGE_TONES
    ? SESSION_STAGE_TONES[stage as SessionType]
    : SESSION_STAGE_TONES.before;
}