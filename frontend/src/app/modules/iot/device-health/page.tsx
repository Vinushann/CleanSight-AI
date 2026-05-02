'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Cpu,
  Gauge,
  ShieldAlert,
  Thermometer,
  Waves,
  Wind,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { getApiBaseUrl } from '@/core/apiBase';
import type { IoTNotification, ReadingPoint } from '@/core/iotTypes';

type SessionType = 'before' | 'during' | 'after';

type ControlPayload = {
  collecting: boolean;
  session_id: string | null;
  device_id: string | null;
  house_id: string | null;
  room_id: string | null;
  session_type: SessionType | null;
};

type HealthStatus = 'OK' | 'WARNING' | 'ERROR' | 'ONLINE' | 'IDLE';

type DeviceCardState = {
  status: HealthStatus;
  detail: string;
};

type DustTrendRow = {
  label: string;
  dust: number;
};

function formatReadingTime(timestampMs: number | null | undefined) {
  if (!timestampMs) {
    return '-';
  }
  return new Date(timestampMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatNotificationTime(value: string | null) {
  if (!value) {
    return 'Just now';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function healthTone(status: HealthStatus) {
  if (status === 'ONLINE' || status === 'OK') {
    return {
      background: 'rgba(83, 212, 139, 0.14)',
      color: '#95f2ba',
      borderColor: 'rgba(83, 212, 139, 0.28)',
    };
  }
  if (status === 'WARNING') {
    return {
      background: 'rgba(255, 184, 76, 0.14)',
      color: '#ffd27d',
      borderColor: 'rgba(255, 184, 76, 0.28)',
    };
  }
  if (status === 'ERROR') {
    return {
      background: 'rgba(255, 122, 111, 0.14)',
      color: '#ff9b92',
      borderColor: 'rgba(255, 122, 111, 0.28)',
    };
  }
  return {
    background: 'rgba(148, 163, 184, 0.12)',
    color: '#cbd5e1',
    borderColor: 'rgba(148, 163, 184, 0.2)',
  };
}

function DeviceHealthCard({
  title,
  subtitle,
  status,
  detail,
  icon,
}: {
  title: string;
  subtitle: string;
  status: HealthStatus;
  detail: string;
  icon: ReactNode;
}) {
  const tone = healthTone(status);

  return (
    <section
      className="rounded-2xl border p-5"
      style={{
        background:
          'radial-gradient(circle at top left, rgba(77,163,255,0.08), transparent 42%), linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 96%, #07111f 4%), color-mix(in srgb, var(--bg-card) 98%, #020712 2%))',
        borderColor: 'var(--border-color)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold" style={{ color: 'var(--text-heading)' }}>
            {title}
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {subtitle}
          </p>
        </div>
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl border"
          style={{ borderColor: 'rgba(90,168,255,0.18)', background: 'rgba(90,168,255,0.08)', color: '#93c5fd' }}
        >
          {icon}
        </div>
      </div>

      <div className="mt-5 inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold" style={tone}>
        {status}
      </div>

      <p className="mt-4 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
        {detail}
      </p>
    </section>
  );
}

export default function IoTDeviceHealthPage() {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const [chartsReady, setChartsReady] = useState(false);
  const [control, setControl] = useState<ControlPayload | null>(null);
  const [readings, setReadings] = useState<ReadingPoint[]>([]);
  const [notifications, setNotifications] = useState<IoTNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setChartsReady(true);
  }, []);

  useEffect(() => {
    let canceled = false;

    const loadHealth = async (showSpinner = false) => {
      try {
        if (showSpinner && !canceled) {
          setLoading(true);
        }
        const controlResponse = await fetch(`${apiBaseUrl}/api/device/control`, { cache: 'no-store' });
        const controlPayload = await controlResponse.json();
        if (!controlResponse.ok) {
          throw new Error(controlPayload.detail || 'Unable to load IoT control state.');
        }
        if (canceled) {
          return;
        }

        setControl(controlPayload as ControlPayload);

        const notificationsPromise = fetch(`${apiBaseUrl}/api/iot/notifications`, { cache: 'no-store' });

        if (controlPayload.collecting && controlPayload.session_id) {
          const readingsResponse = await fetch(`${apiBaseUrl}/api/session/${controlPayload.session_id}/readings`, {
            cache: 'no-store',
          });
          const readingsPayload = await readingsResponse.json();
          if (!readingsResponse.ok) {
            throw new Error(readingsPayload.detail || 'Unable to load device health readings.');
          }
          if (!canceled) {
            setReadings((readingsPayload.readings || []) as ReadingPoint[]);
          }
        } else if (!canceled) {
          setReadings([]);
        }

        const notificationsResponse = await notificationsPromise;
        const notificationsPayload = await notificationsResponse.json();
        if (!notificationsResponse.ok) {
          throw new Error(notificationsPayload.detail || 'Unable to load IoT notifications.');
        }
        if (!canceled) {
          setNotifications((notificationsPayload.notifications || []) as IoTNotification[]);
          setError(null);
        }
      } catch (fetchError) {
        if (!canceled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Unable to load device health.');
        }
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    };

    void loadHealth(true);
    const interval = window.setInterval(() => {
      void loadHealth(false);
    }, 6000);

    return () => {
      canceled = true;
      window.clearInterval(interval);
    };
  }, [apiBaseUrl]);

  const latestReading = readings.length ? readings[readings.length - 1] : null;
  const recentFiveReadings = readings.slice(-5);
  const dustZeroWarning =
    recentFiveReadings.length === 5 && recentFiveReadings.every((reading) => Number(reading.dust ?? NaN) === 0);
  const warningMessage = dustZeroWarning ? 'Dust sensor value stayed 0 for multiple readings' : '';

  const latestReadingValid = Boolean(
    latestReading &&
      latestReading.temperature != null &&
      latestReading.humidity != null &&
      latestReading.humidity >= 0 &&
      latestReading.humidity <= 100 &&
      latestReading.dust != null &&
      latestReading.dust >= 0 &&
      latestReading.air_quality != null &&
      latestReading.air_quality >= 0
  );

  const esp32Status: DeviceCardState = control?.collecting
    ? latestReadingValid
      ? {
          status: 'ONLINE',
          detail: `Valid reading received at ${formatReadingTime(latestReading?.timestamp_ms)} from ${control.device_id || 'ESP32 device'}.`,
        }
      : {
          status: 'WARNING',
          detail: 'Session is active, but a fresh valid reading has not been confirmed yet.',
        }
    : {
        status: 'IDLE',
        detail: 'No active collection session is running right now.',
      };

  const dht22Status: DeviceCardState =
    latestReading &&
    latestReading.temperature != null &&
    latestReading.humidity != null &&
    latestReading.humidity >= 0 &&
    latestReading.humidity <= 100
      ? {
          status: 'OK',
          detail: `Temperature ${latestReading.temperature.toFixed(1)}°C and humidity ${latestReading.humidity.toFixed(1)}% look valid.`,
        }
      : {
          status: 'ERROR',
          detail: 'Temperature or humidity is missing, or humidity is outside the 0 to 100 range.',
        };

  const mq135Status: DeviceCardState =
    latestReading && latestReading.air_quality != null && latestReading.air_quality >= 0
      ? {
          status: 'OK',
          detail: `Air quality reading is available at ${latestReading.air_quality.toFixed(2)}.`,
        }
      : {
          status: 'ERROR',
          detail: 'Air quality reading is missing or below zero.',
        };

  const dustSensorStatus: DeviceCardState = dustZeroWarning
    ? {
        status: 'WARNING',
        detail: warningMessage,
      }
    : latestReading && latestReading.dust != null && latestReading.dust >= 0
      ? {
          status: 'OK',
          detail: `Dust reading is ${latestReading.dust.toFixed(2)} and within a valid range.`,
        }
      : {
          status: 'ERROR',
          detail: 'Dust reading is missing or below zero.',
        };

  const dustTrendRows: DustTrendRow[] = recentFiveReadings.map((reading, index) => ({
    label: `R${index + 1}`,
    dust: Number(reading.dust ?? 0),
  }));

  const latestAlerts = notifications
    .filter((item) => item.category === 'validation' || item.category === 'duplicate')
    .slice(0, 5);

  return (
    <section className="space-y-5">
      <div className="cs-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="cs-card-header text-base">Device Health Monitor</p>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Live health checks for the ESP32 and connected sensors, based on the active session and latest readings.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-input)' }}>
              <p className="text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--text-secondary)' }}>
                Session
              </p>
              <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                {control?.session_id || 'No active session'}
              </p>
            </div>
            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-input)' }}>
              <p className="text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--text-secondary)' }}>
                Room
              </p>
              <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                {control?.house_id && control?.room_id ? `${control.house_id} / ${control.room_id}` : 'Waiting'}
              </p>
            </div>
            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-input)' }}>
              <p className="text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--text-secondary)' }}>
                Latest Packet
              </p>
              <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                {formatReadingTime(latestReading?.timestamp_ms)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'var(--badge-poor-bg)', color: 'var(--badge-poor-text)' }}>
          {error}
        </div>
      ) : null}

      {!control?.collecting && !loading ? (
        <div className="cs-card">
          <div className="rounded-2xl border px-5 py-10 text-center" style={{ borderColor: 'var(--border-color)' }}>
            <p className="text-lg font-semibold" style={{ color: 'var(--text-heading)' }}>
              No active IoT collection session
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Start a collection session to monitor live ESP32 and sensor health here.
            </p>
          </div>
        </div>
      ) : null}

      {(control?.collecting || loading) ? (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-4">
            <DeviceHealthCard
              title="ESP32"
              subtitle="Main collection device"
              status={esp32Status.status}
              detail={esp32Status.detail}
              icon={<Cpu size={20} />}
            />
            <DeviceHealthCard
              title="DHT22"
              subtitle="Temperature and humidity sensor"
              status={dht22Status.status}
              detail={dht22Status.detail}
              icon={<Thermometer size={20} />}
            />
            <DeviceHealthCard
              title="MQ135"
              subtitle="Air quality sensor"
              status={mq135Status.status}
              detail={mq135Status.detail}
              icon={<Wind size={20} />}
            />
            <DeviceHealthCard
              title="GP2Y1010"
              subtitle="Dust sensor"
              status={dustSensorStatus.status}
              detail={dustSensorStatus.detail}
              icon={<Waves size={20} />}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="cs-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="cs-card-header text-base">Dust Sensor Zero Watch</p>
                  <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    The latest 5 readings are inspected to detect a stuck dust sensor returning zero repeatedly.
                  </p>
                </div>
                <div
                  className="inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold"
                  style={healthTone(dustSensorStatus.status)}
                >
                  {dustSensorStatus.status}
                </div>
              </div>

              {warningMessage ? (
                <div
                  className="mt-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm"
                  style={{
                    borderColor: 'rgba(255, 184, 76, 0.28)',
                    background: 'rgba(255, 184, 76, 0.12)',
                    color: '#ffd27d',
                  }}
                >
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>{warningMessage}</span>
                </div>
              ) : null}

              <div className="mt-4 h-[300px]">
                {chartsReady ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dustTrendRows}>
                      <CartesianGrid stroke="rgba(148,163,184,0.14)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(15, 23, 42, 0.96)',
                          border: '1px solid rgba(90, 168, 255, 0.18)',
                          borderRadius: '16px',
                          color: '#f8fafc',
                        }}
                      />
                      <Bar dataKey="dust" radius={[10, 10, 4, 4]}>
                        {dustTrendRows.map((row, index) => (
                          <Cell
                            key={`${row.label}-${index}`}
                            fill={row.dust === 0 ? '#ffb454' : '#5aa8ff'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
            </section>

            <section className="cs-card">
              <p className="cs-card-header text-base">Latest Sensor Snapshot</p>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Fast operational view of the most recent packet that reached the system.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  {
                    label: 'Temperature',
                    value: latestReading?.temperature != null ? `${latestReading.temperature.toFixed(1)} °C` : '-',
                    icon: <Thermometer size={16} />,
                  },
                  {
                    label: 'Humidity',
                    value: latestReading?.humidity != null ? `${latestReading.humidity.toFixed(1)} %` : '-',
                    icon: <Gauge size={16} />,
                  },
                  {
                    label: 'Air Quality',
                    value: latestReading?.air_quality != null ? latestReading.air_quality.toFixed(2) : '-',
                    icon: <Wind size={16} />,
                  },
                  {
                    label: 'Dust',
                    value: latestReading?.dust != null ? latestReading.dust.toFixed(2) : '-',
                    icon: <Waves size={16} />,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border px-4 py-4"
                    style={{ borderColor: 'var(--border-color)', background: 'var(--bg-input)' }}
                  >
                    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {item.icon}
                      {item.label}
                    </div>
                    <p className="mt-3 text-xl font-semibold" style={{ color: 'var(--text-heading)' }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="cs-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="cs-card-header text-base">Recent Device Alerts</p>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Latest validation and duplicate-reading issues captured by the backend notification system.
                </p>
              </div>
              <div
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  borderColor: 'rgba(255, 122, 111, 0.22)',
                  background: 'rgba(255, 122, 111, 0.1)',
                  color: '#ff9b92',
                }}
              >
                <ShieldAlert size={13} />
                {latestAlerts.length} recent alerts
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {latestAlerts.length ? (
                latestAlerts.map((item) => (
                  <div
                    key={item.notification_id}
                    className="rounded-2xl border px-4 py-3"
                    style={{ borderColor: 'var(--border-color)', background: 'var(--bg-input)' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <Activity size={16} className="mt-0.5 shrink-0" style={{ color: '#ff9b92' }} />
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                            {item.title}
                          </p>
                          <p className="mt-1 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                            {item.message}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {formatNotificationTime(item.created_at)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border px-4 py-6 text-sm text-center" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                  No recent validation or duplicate-reading alerts.
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
