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
    accent: '#DC2626',
    track: 'rgba(220, 38, 38, 0.16)',
    text: '#991B1B',
    glow: '0 16px 36px rgba(220, 38, 38, 0.22)',
    headerFrom: '#F87171',
    headerTo: '#B91C1C',
    panel: 'rgba(220, 38, 38, 0.12)',
  },
  during: {
    accent: '#D97706',
    track: 'rgba(217, 119, 6, 0.16)',
    text: '#9A5B00',
    glow: '0 16px 36px rgba(217, 119, 6, 0.22)',
    headerFrom: '#FBBF24',
    headerTo: '#B45309',
    panel: 'rgba(217, 119, 6, 0.12)',
  },
  after: {
    accent: '#16A34A',
    track: 'rgba(22, 163, 74, 0.16)',
    text: '#166534',
    glow: '0 16px 36px rgba(22, 163, 74, 0.22)',
    headerFrom: '#4ADE80',
    headerTo: '#15803D',
    panel: 'rgba(22, 163, 74, 0.12)',
  },
};

export type PerformanceToneKey = 'best' | 'middle' | 'worst';

export const PERFORMANCE_TONES: Record<PerformanceToneKey, StageTone> = {
  best: {
    accent: '#16A34A',
    track: 'rgba(22, 163, 74, 0.16)',
    text: '#166534',
    glow: '0 16px 36px rgba(22, 163, 74, 0.22)',
    headerFrom: '#4ADE80',
    headerTo: '#15803D',
    panel: 'rgba(22, 163, 74, 0.12)',
  },
  middle: {
    accent: '#EAB308',
    track: 'rgba(234, 179, 8, 0.16)',
    text: '#854D0E',
    glow: '0 16px 36px rgba(234, 179, 8, 0.22)',
    headerFrom: '#FDE047',
    headerTo: '#CA8A04',
    panel: 'rgba(234, 179, 8, 0.12)',
  },
  worst: {
    accent: '#DC2626',
    track: 'rgba(220, 38, 38, 0.16)',
    text: '#991B1B',
    glow: '0 16px 36px rgba(220, 38, 38, 0.22)',
    headerFrom: '#F87171',
    headerTo: '#B91C1C',
    panel: 'rgba(220, 38, 38, 0.12)',
  },
};

export function getPerformanceTone(rank: PerformanceToneKey): StageTone {
  return PERFORMANCE_TONES[rank];
}

export function getMetricColor(metric: string): string {
  return (METRIC_COLORS as Record<string, string>)[metric] ?? 'var(--accent-primary)';
}

export function getStageTone(stage?: string): StageTone {
  return stage && stage in SESSION_STAGE_TONES
    ? SESSION_STAGE_TONES[stage as SessionType]
    : SESSION_STAGE_TONES.before;
}