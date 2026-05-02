import type { MetricKey, SessionType } from '@/core/iotTypes';

export const METRIC_COLORS: Record<MetricKey, string> = {
  air_quality: 'var(--metric-air-quality, #7B61FF)',
  dust: 'var(--metric-dust, #2D7FF9)',
  humidity: 'var(--metric-humidity, #2BB6A8)',
  temperature: 'var(--metric-temperature, #F4A261)',
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
    accent: 'var(--stage-before-accent, #DC2626)',
    track: 'var(--stage-before-track, rgba(220, 38, 38, 0.16))',
    text: 'var(--stage-before-text, #991B1B)',
    glow: 'var(--stage-before-glow, 0 16px 36px rgba(220, 38, 38, 0.22))',
    headerFrom: 'var(--stage-before-from, #F87171)',
    headerTo: 'var(--stage-before-to, #B91C1C)',
    panel: 'var(--stage-before-panel, rgba(220, 38, 38, 0.12))',
  },
  during: {
    accent: 'var(--stage-during-accent, #D97706)',
    track: 'var(--stage-during-track, rgba(217, 119, 6, 0.16))',
    text: 'var(--stage-during-text, #9A5B00)',
    glow: 'var(--stage-during-glow, 0 16px 36px rgba(217, 119, 6, 0.22))',
    headerFrom: 'var(--stage-during-from, #FBBF24)',
    headerTo: 'var(--stage-during-to, #B45309)',
    panel: 'var(--stage-during-panel, rgba(217, 119, 6, 0.12))',
  },
  after: {
    accent: 'var(--stage-after-accent, #16A34A)',
    track: 'var(--stage-after-track, rgba(22, 163, 74, 0.16))',
    text: 'var(--stage-after-text, #166534)',
    glow: 'var(--stage-after-glow, 0 16px 36px rgba(22, 163, 74, 0.22))',
    headerFrom: 'var(--stage-after-from, #4ADE80)',
    headerTo: 'var(--stage-after-to, #15803D)',
    panel: 'var(--stage-after-panel, rgba(22, 163, 74, 0.12))',
  },
};

export type PerformanceToneKey = 'best' | 'middle' | 'worst';

export const PERFORMANCE_TONES: Record<PerformanceToneKey, StageTone> = {
  best: {
    accent: 'var(--performance-best-accent, #16A34A)',
    track: 'var(--performance-best-track, rgba(22, 163, 74, 0.16))',
    text: 'var(--performance-best-text, #166534)',
    glow: 'var(--performance-best-glow, 0 16px 36px rgba(22, 163, 74, 0.22))',
    headerFrom: 'var(--performance-best-from, #4ADE80)',
    headerTo: 'var(--performance-best-to, #15803D)',
    panel: 'var(--performance-best-panel, rgba(22, 163, 74, 0.12))',
  },
  middle: {
    accent: 'var(--performance-middle-accent, #EAB308)',
    track: 'var(--performance-middle-track, rgba(234, 179, 8, 0.16))',
    text: 'var(--performance-middle-text, #854D0E)',
    glow: 'var(--performance-middle-glow, 0 16px 36px rgba(234, 179, 8, 0.22))',
    headerFrom: 'var(--performance-middle-from, #FDE047)',
    headerTo: 'var(--performance-middle-to, #CA8A04)',
    panel: 'var(--performance-middle-panel, rgba(234, 179, 8, 0.12))',
  },
  worst: {
    accent: 'var(--performance-worst-accent, #DC2626)',
    track: 'var(--performance-worst-track, rgba(220, 38, 38, 0.16))',
    text: 'var(--performance-worst-text, #991B1B)',
    glow: 'var(--performance-worst-glow, 0 16px 36px rgba(220, 38, 38, 0.22))',
    headerFrom: 'var(--performance-worst-from, #F87171)',
    headerTo: 'var(--performance-worst-to, #B91C1C)',
    panel: 'var(--performance-worst-panel, rgba(220, 38, 38, 0.12))',
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
