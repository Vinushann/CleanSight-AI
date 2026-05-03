'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { getApiBaseUrl } from '@/core/apiBase';
import type {
  ActivityStatus,
  ActivityTimelineEvent,
  CameraFrame,
  PresenceAlert,
  PresenceController,
  PresenceLivePayload,
  PresenceSession,
} from '@/core/iotTypes';

/* ── helpers ── */

function fmtTime(ms: number | null | undefined): string {
  if (!ms) return '-';
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

function statusColor(status: string | undefined): string {
  switch (status) {
    case 'running': return '#66dc98';
    case 'stopped': case 'completed': return '#ff7a6f';
    default: return '#94a3b8';
  }
}

function presenceColor(event: string): string {
  if (event === 'person_detected' || event === 'idle') return '#66dc98';
  if (event === 'no_person') return '#ff7a6f';
  return '#ffb454';
}

/* ── component ── */

export default function PresenceDetectionPage() {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const [chartsReady, setChartsReady] = useState(false);

  // Data states
  const [sessions, setSessions] = useState<PresenceSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [liveData, setLiveData] = useState<PresenceLivePayload | null>(null);
  const [alerts, setAlerts] = useState<PresenceAlert[]>([]);
  const [timeline, setTimeline] = useState<ActivityTimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Hydrate recharts on client
  useEffect(() => { setChartsReady(true); }, []);

  // Fetch sessions
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/presence/sessions`, { cache: 'no-store' });
        const payload = await res.json();
        if (res.ok && Array.isArray(payload.sessions)) {
          setSessions(payload.sessions);
          if (payload.sessions.length > 0 && !selectedSession) {
            setSelectedSession(payload.sessions[0].sessionId);
          }
        }
      } catch { /* ignore */ }
    };
    void load();
  }, [apiBaseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch live data + alerts + timeline when session changes
  useEffect(() => {
    if (!selectedSession) return;
    let canceled = false;
    setLoading(true);

    const load = async () => {
      try {
        const [liveRes, alertsRes, timelineRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/v1/presence/live?session_id=${selectedSession}`, { cache: 'no-store' }),
          fetch(`${apiBaseUrl}/api/v1/presence/alerts?session_id=${selectedSession}`, { cache: 'no-store' }),
          fetch(`${apiBaseUrl}/api/v1/presence/timeline?session_id=${selectedSession}`, { cache: 'no-store' }),
        ]);

        if (canceled) return;

        const live = await liveRes.json();
        const alertsData = await alertsRes.json();
        const timelineData = await timelineRes.json();

        if (liveRes.ok) setLiveData(live as PresenceLivePayload);
        if (alertsRes.ok) setAlerts(alertsData.alerts || []);
        if (timelineRes.ok) setTimeline(timelineData.events || []);
      } catch { /* ignore */ }
      if (!canceled) setLoading(false);
    };

    void load();
    // Auto-refresh every 5s
    const interval = setInterval(load, 5000);
    return () => { canceled = true; clearInterval(interval); };
  }, [apiBaseUrl, selectedSession]);

  const controller: PresenceController | null = liveData?.controller ?? null;
  const frame: CameraFrame | null = liveData?.frame ?? null;
  const activity: ActivityStatus | null = liveData?.activity ?? null;

  const personDetections = (frame?.detections || []).filter((d) => d.type === 'person');
  const toolDetections = (frame?.detections || []).filter((d) => d.type === 'tool');

  const currentSession = sessions.find((s) => s.sessionId === selectedSession);

  // Compute session phase
  let sessionPhase = 'unknown';
  if (currentSession?.startTime) {
    const now = currentSession.endTime || Date.now();
    const elapsed = now - currentSession.startTime;
    const beforeMs = (currentSession.beforeDuration || 0) * 60000;
    const duringMs = (currentSession.duringDuration || 0) * 60000;
    if (elapsed < beforeMs) sessionPhase = 'before';
    else if (elapsed < beforeMs + duringMs) sessionPhase = 'during';
    else sessionPhase = 'after';
  }

  // Chart data for detection timeline
  const detectionChartData = timeline.map((e) => ({
    time: fmtTime(e.timestamp),
    score: Math.round((e.score || 0) * 100),
    active: e.active ? 1 : 0,
  }));

  return (
    <section className="space-y-5">
      {/* ── Page Header ── */}
      <div className="cs-card">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-heading)' }}>
              ESP32-CAM Presence Detection
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Live camera feed, person &amp; tool detection, and cleaning activity analysis powered by Edge Impulse TinyML + YOLOv8.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Session:</label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              {sessions.map((s) => (
                <option key={s.sessionId} value={s.sessionId}>
                  {s.sessionName || s.sessionId} {s.roomId ? `(${s.roomId})` : ''}
                </option>
              ))}
              {sessions.length === 0 && <option value="">No sessions found</option>}
            </select>
          </div>
        </div>
      </div>

      {loading && !liveData ? (
        <div className="cs-card text-center py-12">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading presence data…</p>
        </div>
      ) : (
        <>
          {/* ── Row 1: Session + Controller + Activity ── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Session Status */}
            <div className="cs-card">
              <p className="cs-card-header text-base">Session Status</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Status</span>
                  <span className="rounded-full px-3 py-1 text-xs font-semibold uppercase" style={{ background: `${statusColor(controller?.status)}20`, color: statusColor(controller?.status), border: `1px solid ${statusColor(controller?.status)}40` }}>
                    {controller?.status || 'unknown'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Phase</span>
                  <span className="text-sm font-semibold capitalize" style={{ color: 'var(--text-heading)' }}>{sessionPhase}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Room</span>
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{controller?.roomId || currentSession?.roomId || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Started</span>
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{fmtTime(controller?.startTime || currentSession?.startTime)}</span>
                </div>
              </div>
            </div>

            {/* Activity Status */}
            <div className="cs-card">
              <p className="cs-card-header text-base">Cleaning Activity</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Active</span>
                  <span className="rounded-full px-3 py-1 text-xs font-semibold uppercase" style={{ background: activity?.active ? 'rgba(102, 220, 152, 0.14)' : 'rgba(255, 122, 111, 0.14)', color: activity?.active ? '#66dc98' : '#ff7a6f', border: `1px solid ${activity?.active ? '#66dc9840' : '#ff7a6f40'}` }}>
                    {activity?.active ? 'Cleaning' : 'Idle'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Score</span>
                  <span className="text-lg font-bold" style={{ color: 'var(--text-heading)' }}>{activity?.score != null ? `${Math.round(activity.score * 100)}%` : '-'}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full" style={{ background: 'rgba(148, 163, 184, 0.12)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(activity?.score || 0) * 100}%`, background: activity?.active ? '#66dc98' : '#ffb454' }} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Person</p>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{activity?.personFrames ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Tool</p>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{activity?.toolFrames ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Co-occur</p>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{activity?.cooccurFrames ?? '-'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Latest Detection */}
            <div className="cs-card">
              <p className="cs-card-header text-base">Latest Detection</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Persons</span>
                  <span className="text-lg font-bold" style={{ color: personDetections.length > 0 ? '#66dc98' : 'var(--text-heading)' }}>{personDetections.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Tools</span>
                  <span className="text-lg font-bold" style={{ color: toolDetections.length > 0 ? '#5aa8ff' : 'var(--text-heading)' }}>{toolDetections.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Model</span>
                  <span className="text-xs truncate max-w-[180px]" style={{ color: 'var(--text-primary)' }}>{frame?.modelVersion || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Latency</span>
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{frame?.latencyMs != null ? `${frame.latencyMs}ms` : '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Last Frame</span>
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{fmtTime(frame?.receivedAt)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Row 2: Detection Details + Presence Alerts ── */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {/* Detection List */}
            <section className="cs-card">
              <p className="cs-card-header text-base">Detection Details</p>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>All objects detected in the latest camera frame.</p>
              <div className="mt-4 space-y-2">
                {(frame?.detections || []).length > 0 ? (
                  (frame?.detections || []).map((d, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: 'rgba(125, 170, 255, 0.12)', background: 'rgba(255,255,255,0.02)' }}>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ background: d.type === 'person' ? 'rgba(102, 220, 152, 0.14)' : d.type === 'tool' ? 'rgba(90, 168, 255, 0.14)' : 'rgba(255, 180, 84, 0.14)', color: d.type === 'person' ? '#66dc98' : d.type === 'tool' ? '#5aa8ff' : '#ffb454' }}>
                        {d.type}
                      </span>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{d.label}</span>
                      <span className="ml-auto text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{(d.confidence * 100).toFixed(1)}%</span>
                    </div>
                  ))
                ) : (
                  <p className="py-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>No detections in latest frame.</p>
                )}
              </div>
            </section>

            {/* Presence Alert Timeline */}
            <section className="cs-card">
              <div className="flex items-center justify-between">
                <p className="cs-card-header text-base">Presence Alert Timeline</p>
                <span className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>{alerts.length} alerts</span>
              </div>
              <div className="mt-4 max-h-[340px] space-y-2 overflow-y-auto pr-1">
                {alerts.length > 0 ? (
                  alerts.slice(0, 30).map((a) => (
                    <div key={a.key} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: 'rgba(125, 170, 255, 0.08)', background: 'rgba(255,255,255,0.015)' }}>
                      <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: presenceColor(a.event) }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{(a.event || '').replace(/_/g, ' ')}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {fmtTime(a.timestamp)} · {a.deviceId || 'unknown device'}
                          {a.absenceMs ? ` · absent ${fmtDuration(a.absenceMs)}` : ''}
                        </p>
                      </div>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ background: `${presenceColor(a.event)}18`, color: presenceColor(a.event) }}>
                        {a.source || 'edge'}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>No presence alerts for this session.</p>
                )}
              </div>
            </section>
          </div>

          {/* ── Row 3: Activity Score Trend ── */}
          {timeline.length > 0 && (
            <section className="cs-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="cs-card-header text-base">Activity Score Over Time</p>
                  <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    The cleaning activity confidence score computed from person + tool co-occurrence in a sliding window.
                  </p>
                </div>
                <span className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>{timeline.length} events</span>
              </div>
              <div className="mt-4 h-[300px]">
                {chartsReady ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={detectionChartData}>
                      <CartesianGrid stroke="rgba(148,163,184,0.14)" vertical={false} />
                      <XAxis dataKey="time" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: 'rgba(15, 23, 42, 0.96)', border: '1px solid rgba(90, 168, 255, 0.18)', borderRadius: '16px', color: '#f8fafc' }} />
                      <Legend />
                      <Line type="monotone" dataKey="score" name="Activity Score (%)" stroke="#5aa8ff" strokeWidth={2.4} dot={{ r: 3, fill: '#5aa8ff' }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
            </section>
          )}

          {/* ── Row 4: Detection Breakdown per Timeline Event ── */}
          {timeline.length > 0 && (
            <section className="cs-card">
              <p className="cs-card-header text-base">Cleaning Active vs Idle</p>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Shows when the system classified cleaning as actively happening vs idle at each evaluation point.
              </p>
              <div className="mt-4 h-[260px]">
                {chartsReady ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={detectionChartData}>
                      <CartesianGrid stroke="rgba(148,163,184,0.14)" vertical={false} />
                      <XAxis dataKey="time" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 1]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} ticks={[0, 1]} tickFormatter={(v) => v === 1 ? 'Active' : 'Idle'} />
                      <Tooltip contentStyle={{ background: 'rgba(15, 23, 42, 0.96)', border: '1px solid rgba(90, 168, 255, 0.18)', borderRadius: '16px', color: '#f8fafc' }} formatter={(value: number) => [value === 1 ? 'Active' : 'Idle', 'Status']} />
                      <Bar dataKey="active" name="Cleaning Status" radius={[6, 6, 0, 0]} fill="#66dc98" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
            </section>
          )}

          {/* ── No Data Fallback ── */}
          {!frame && !activity && alerts.length === 0 && timeline.length === 0 && (
            <div className="cs-card text-center py-12">
              <p className="text-lg font-semibold" style={{ color: 'var(--text-heading)' }}>No Presence Data Available</p>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Start the ESP32-CAM MQTT backend and run a session to see live presence detection data here.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
