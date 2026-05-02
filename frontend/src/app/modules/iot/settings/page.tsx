'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Bug,
  Database,
  Download,
  Radio,
  RefreshCcw,
  Server,
  ShieldCheck,
  Volume2,
} from 'lucide-react';

import { getApiBaseUrl } from '@/core/apiBase';
import type { ReadingPoint } from '@/core/iotTypes';

type ControlPayload = {
  collecting: boolean;
  session_id: string | null;
};

type SystemStatus = {
  success: boolean;
  api_status: string;
  backend_base_url: string | null;
  firestore_connected: boolean;
  active_session_id: string | null;
  simulator_command: string;
};

type IoTSettingsState = {
  enableNotifications: boolean;
  notificationSound: boolean;
  notificationHistoryRetention: number;
  readingRetentionPeriod: number;
  archiveSessionsAfterDays: number;
  debugLogging: boolean;
  showRawPayloads: boolean;
  showDuplicateDetectionLogs: boolean;
  showValidationDecisions: boolean;
};

const STORAGE_KEY = 'cleansight.iot.settings';

const DEFAULT_SETTINGS: IoTSettingsState = {
  enableNotifications: true,
  notificationSound: false,
  notificationHistoryRetention: 30,
  readingRetentionPeriod: 90,
  archiveSessionsAfterDays: 14,
  debugLogging: false,
  showRawPayloads: false,
  showDuplicateDetectionLogs: true,
  showValidationDecisions: true,
};

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-input)' }}>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{label}</p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-8 w-14 shrink-0 rounded-full transition-colors"
        style={{ background: checked ? 'var(--accent-primary)' : 'rgba(148,163,184,0.24)' }}
        aria-pressed={checked}
      >
        <span
          className="absolute top-1 h-6 w-6 rounded-full bg-white transition-transform"
          style={{ left: checked ? 'calc(100% - 28px)' : '4px' }}
        />
      </button>
    </div>
  );
}

function StatusPill({ label, healthy }: { label: string; healthy: boolean }) {
  return (
    <span
      className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold"
      style={{
        borderColor: healthy ? 'rgba(83, 212, 139, 0.22)' : 'rgba(255, 122, 111, 0.22)',
        background: healthy ? 'rgba(83, 212, 139, 0.12)' : 'rgba(255, 122, 111, 0.12)',
        color: healthy ? '#95f2ba' : '#ffb4ad',
      }}
    >
      {label}
    </span>
  );
}

function downloadBlob(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: ReadingPoint[]) {
  const headers = [
    'reading_id',
    'session_id',
    'session_type',
    'timestamp_ms',
    'dust',
    'air_quality',
    'temperature',
    'humidity',
    'cleanliness_score',
    'cleanliness_status',
    'anomaly_prediction',
    'predicted_next_cleanliness',
    'actual_cleanliness',
    'trend_direction',
  ];

  const body = rows.map((row) =>
    headers
      .map((key) => {
        const value = row[key as keyof ReadingPoint];
        const stringValue = value == null ? '' : String(value);
        return `"${stringValue.replaceAll('"', '""')}"`;
      })
      .join(',')
  );

  return [headers.join(','), ...body].join('\n');
}

export default function IoTSettingsPage() {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const [settings, setSettings] = useState<IoTSettingsState>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    } catch {
      // Ignore corrupted local settings and keep defaults.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage failures and keep the in-memory state.
    }
  }, [settings]);

  const loadSystemStatus = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) {
        setLoadingStatus(true);
      }
      const response = await fetch(`${apiBaseUrl}/api/iot/system-status`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || 'Unable to load IoT system status.');
      }
      setStatus(payload as SystemStatus);
      setError(null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unable to load IoT system status.');
    } finally {
      if (showSpinner) {
        setLoadingStatus(false);
      }
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void loadSystemStatus(true);
  }, [loadSystemStatus]);

  const updateSetting = <K extends keyof IoTSettingsState>(key: K, value: IoTSettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setFeedback('Settings updated.');
  };

  const withAction = async (actionName: string, callback: () => Promise<void>) => {
    try {
      setBusyAction(actionName);
      setFeedback(null);
      setError(null);
      await callback();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Action failed.');
    } finally {
      setBusyAction(null);
    }
  };

  const exportCurrentSession = async (format: 'csv' | 'json') => {
    await withAction(`export-${format}`, async () => {
      const controlResponse = await fetch(`${apiBaseUrl}/api/device/control`, { cache: 'no-store' });
      const controlPayload = (await controlResponse.json()) as ControlPayload;
      if (!controlResponse.ok) {
        throw new Error('Unable to resolve the current session for export.');
      }
      if (!controlPayload.collecting || !controlPayload.session_id) {
        throw new Error('Start or resume a session before exporting readings.');
      }

      const readingsResponse = await fetch(`${apiBaseUrl}/api/session/${controlPayload.session_id}/readings`, {
        cache: 'no-store',
      });
      const readingsPayload = await readingsResponse.json();
      if (!readingsResponse.ok) {
        throw new Error(readingsPayload.detail || 'Unable to export current session.');
      }

      const readings = (readingsPayload.readings || []) as ReadingPoint[];
      if (!readings.length) {
        throw new Error('No readings are available for the current session yet.');
      }

      if (format === 'csv') {
        downloadBlob(toCsv(readings), `${controlPayload.session_id}.csv`, 'text/csv;charset=utf-8;');
      } else {
        downloadBlob(JSON.stringify(readings, null, 2), `${controlPayload.session_id}.json`, 'application/json;charset=utf-8;');
      }
      setFeedback(`Exported ${readings.length} readings as ${format.toUpperCase()}.`);
    });
  };

  const runTestNotification = async () => {
    await withAction('test-notification', async () => {
      const response = await fetch(`${apiBaseUrl}/api/iot/test-notification`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || 'Unable to generate a test notification.');
      }
      setFeedback(`Test notification created: ${payload.notification_id}`);
    });
  };

  const reconnectFirestore = async () => {
    await withAction('reconnect-firebase', async () => {
      const response = await fetch(`${apiBaseUrl}/api/iot/reconnect-firebase`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || 'Unable to reconnect Firebase.');
      }
      setFeedback(payload.firestore_connected ? 'Firebase reconnected successfully.' : 'Firebase reconnect attempt failed.');
      await loadSystemStatus();
    });
  };

  return (
    <section className="space-y-5">
      <div className="cs-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="cs-card-header text-base">IoT Settings</p>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Operational settings for notifications, retention, exports, and developer-facing IoT tools.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSystemStatus(true)}
            className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: 'var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
          >
            <RefreshCcw size={15} />
            {loadingStatus ? 'Refreshing...' : 'Refresh status'}
          </button>
        </div>
      </div>

      {feedback ? (
        <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'var(--badge-good-bg)', color: 'var(--badge-good-text)' }}>
          {feedback}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'var(--badge-poor-bg)', color: 'var(--badge-poor-text)' }}>
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="cs-card">
          <div className="flex items-center gap-3">
            <Server size={18} style={{ color: 'var(--accent-primary)' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>API endpoint status</p>
              <div className="mt-2">{status ? <StatusPill label={status.api_status} healthy={status.api_status === 'online'} /> : <StatusPill label="loading" healthy={false} />}</div>
            </div>
          </div>
        </div>
        <div className="cs-card">
          <div className="flex items-center gap-3">
            <Radio size={18} style={{ color: 'var(--accent-primary)' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Current backend base URL</p>
              <p className="mt-2 text-sm break-all" style={{ color: 'var(--text-secondary)' }}>{apiBaseUrl}</p>
            </div>
          </div>
        </div>
        <div className="cs-card">
          <div className="flex items-center gap-3">
            <Database size={18} style={{ color: 'var(--accent-primary)' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Firestore connection status</p>
              <div className="mt-2">{status ? <StatusPill label={status.firestore_connected ? 'connected' : 'disconnected'} healthy={status.firestore_connected} /> : <StatusPill label="loading" healthy={false} />}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="cs-card">
          <div className="flex items-center gap-3">
            <Bell size={18} style={{ color: 'var(--accent-primary)' }} />
            <div>
              <p className="cs-card-header text-base">Notifications</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Quiet operational controls for alerts and notification retention.
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <ToggleRow
              label="Enable notifications"
              description="Allow IoT alerts and session notifications across the dashboard."
              checked={settings.enableNotifications}
              onChange={(next) => updateSetting('enableNotifications', next)}
            />
            <ToggleRow
              label="Notification sound"
              description="Prepare the UI for audible alerts when sound support is enabled."
              checked={settings.notificationSound}
              onChange={(next) => updateSetting('notificationSound', next)}
            />
            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-input)' }}>
              <div className="flex items-center gap-2">
                <Volume2 size={16} style={{ color: 'var(--text-secondary)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Notification history retention</p>
              </div>
              <select
                value={settings.notificationHistoryRetention}
                onChange={(event) => updateSetting('notificationHistoryRetention', Number(event.target.value))}
                className="mt-3 w-full rounded-xl px-3 py-2 text-sm"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={180}>180 days</option>
              </select>
            </div>
          </div>
        </section>

        <section className="cs-card">
          <div className="flex items-center gap-3">
            <Download size={18} style={{ color: 'var(--accent-primary)' }} />
            <div>
              <p className="cs-card-header text-base">Data Storage</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Retention policy and export utilities for IoT session data.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-input)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Reading retention period</p>
              <input
                type="number"
                min={1}
                value={settings.readingRetentionPeriod}
                onChange={(event) => updateSetting('readingRetentionPeriod', Number(event.target.value))}
                className="mt-3 w-full rounded-xl px-3 py-2 text-sm"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void exportCurrentSession('csv')}
                disabled={busyAction === 'export-csv'}
                className="rounded-2xl border px-4 py-3 text-sm font-semibold"
                style={{ borderColor: 'var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
              >
                {busyAction === 'export-csv' ? 'Exporting CSV...' : 'Export CSV'}
              </button>
              <button
                type="button"
                onClick={() => void exportCurrentSession('json')}
                disabled={busyAction === 'export-json'}
                className="rounded-2xl border px-4 py-3 text-sm font-semibold"
                style={{ borderColor: 'var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
              >
                {busyAction === 'export-json' ? 'Exporting JSON...' : 'Export JSON'}
              </button>
            </div>

            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-input)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Archive sessions</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Choose after how many days sessions should be considered ready for archiving.
              </p>
              <input
                type="number"
                min={1}
                value={settings.archiveSessionsAfterDays}
                onChange={(event) => updateSetting('archiveSessionsAfterDays', Number(event.target.value))}
                className="mt-3 w-full rounded-xl px-3 py-2 text-sm"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
        </section>
      </div>

      <section className="cs-card">
        <div className="flex items-center gap-3">
          <Bug size={18} style={{ color: 'var(--accent-primary)' }} />
          <div>
            <p className="cs-card-header text-base">Developer / Admin Tools</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Visibility and control tools for debugging the IoT ingestion pipeline.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            <ToggleRow
              label="Debug logging"
              description="Keep verbose device and request diagnostics enabled locally."
              checked={settings.debugLogging}
              onChange={(next) => updateSetting('debugLogging', next)}
            />
            <ToggleRow
              label="Show raw payloads"
              description="Expose the incoming sensor payload details in future debug views."
              checked={settings.showRawPayloads}
              onChange={(next) => updateSetting('showRawPayloads', next)}
            />
            <ToggleRow
              label="Show duplicate detection logs"
              description="Highlight duplicate-reading decisions in the admin-facing workflow."
              checked={settings.showDuplicateDetectionLogs}
              onChange={(next) => updateSetting('showDuplicateDetectionLogs', next)}
            />
            <ToggleRow
              label="Show validation decisions"
              description="Keep validation reasoning visible while tuning the sensor rules."
              checked={settings.showValidationDecisions}
              onChange={(next) => updateSetting('showValidationDecisions', next)}
            />
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border px-4 py-4" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-input)' }}>
              <div className="flex items-center gap-2">
                <Radio size={16} style={{ color: 'var(--text-secondary)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Simulator controls</p>
              </div>
              <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Recommended simulator command
              </p>
              <code className="mt-2 block rounded-xl px-3 py-2 text-xs" style={{ background: 'rgba(15,23,42,0.46)', color: '#dbeafe' }}>
                {status?.simulator_command || 'python3 backend/simulate_iot_session.py'}
              </code>
              <p className="mt-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Active session: {status?.active_session_id || 'none'}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void runTestNotification()}
                disabled={busyAction === 'test-notification'}
                className="rounded-2xl border px-4 py-3 text-sm font-semibold"
                style={{ borderColor: 'var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
              >
                {busyAction === 'test-notification' ? 'Generating...' : 'Test notification generator'}
              </button>
              <button
                type="button"
                onClick={() => void reconnectFirestore()}
                disabled={busyAction === 'reconnect-firebase'}
                className="rounded-2xl border px-4 py-3 text-sm font-semibold"
                style={{ borderColor: 'var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
              >
                {busyAction === 'reconnect-firebase' ? 'Reconnecting...' : 'Reconnect Firebase'}
              </button>
            </div>

            <div className="rounded-2xl border px-4 py-4" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-input)' }}>
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} style={{ color: 'var(--text-secondary)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Current system picture</p>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>API</span>
                  <span style={{ color: 'var(--text-primary)' }}>{status?.api_status || 'unknown'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Firestore</span>
                  <span style={{ color: 'var(--text-primary)' }}>{status?.firestore_connected ? 'connected' : 'disconnected'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Notifications</span>
                  <span style={{ color: 'var(--text-primary)' }}>{settings.enableNotifications ? 'enabled' : 'disabled'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
