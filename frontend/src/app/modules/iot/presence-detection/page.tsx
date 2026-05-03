'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { getApiBaseUrl } from '@/core/apiBase';
import type {
  ActivityStatus, ActivityTimelineEvent, CameraFrame,
  PresenceAlert, PresenceController, PresenceLivePayload, PresenceSession,
} from '@/core/iotTypes';

/* ── helpers ── */
const fmt = (ms: number | null | undefined) => ms ? new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';
const fmtDur = (ms: number) => { const s = Math.floor(ms / 1000); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; };
const statusClr = (s?: string) => s === 'running' ? '#66dc98' : s === 'stopped' || s === 'completed' ? '#ff7a6f' : '#94a3b8';
const presClr = (e: string) => e === 'person_detected' || e === 'idle' ? '#66dc98' : e === 'no_person' ? '#ff7a6f' : '#ffb454';
const detClr = (t: string) => t === 'person' ? '#0a84ff' : t === 'tool' ? '#30d158' : '#ffd60a';

/* ── Canvas bounding-box renderer ── */
function drawDetections(
  canvas: HTMLCanvasElement, img: HTMLImageElement, detections: CameraFrame['detections'],
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  for (const d of detections) {
    if (!d.bbox) continue;
    const b = d.bbox;
    const maxAbs = Math.max(Math.abs(b.x1), Math.abs(b.y1), Math.abs(b.x2), Math.abs(b.y2));
    const norm = maxAbs <= 1.05;
    const x1 = norm ? b.x1 * canvas.width : b.x1;
    const y1 = norm ? b.y1 * canvas.height : b.y1;
    const x2 = norm ? b.x2 * canvas.width : b.x2;
    const y2 = norm ? b.y2 * canvas.height : b.y2;
    const x = Math.max(0, x1), y = Math.max(0, y1);
    const w = Math.max(1, x2 - x1), h = Math.max(1, y2 - y1);
    const color = detClr(d.type);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    const label = `${d.label || d.type} ${(d.confidence * 100).toFixed(1)}%`;
    ctx.font = '15px -apple-system, BlinkMacSystemFont, sans-serif';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = color;
    ctx.fillRect(x, Math.max(0, y - 20), tw + 12, 20);
    ctx.fillStyle = '#000';
    ctx.fillText(label, x + 6, Math.max(14, y - 6));
  }
}

/* Image base URL — images are served from FastAPI's /captures static mount */

/* ── Main Component ── */
export default function PresenceDetectionPage() {
  const api = useMemo(() => getApiBaseUrl(), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState<PresenceSession[]>([]);
  const [sel, setSel] = useState('');
  const [live, setLive] = useState<PresenceLivePayload | null>(null);
  const [alerts, setAlerts] = useState<PresenceAlert[]>([]);
  const [timeline, setTimeline] = useState<ActivityTimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setReady(true); }, []);

  // Load sessions
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${api}/api/v1/presence/sessions`, { cache: 'no-store' });
        const d = await r.json();
        if (r.ok && Array.isArray(d.sessions)) {
          setSessions(d.sessions);
          if (d.sessions.length > 0 && !sel) setSel(d.sessions[0].sessionId);
        }
      } catch { /* */ }
    })();
  }, [api]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch live + alerts + timeline
  useEffect(() => {
    if (!sel) return;
    let canceled = false;
    setLoading(true);
    const load = async () => {
      try {
        const [lR, aR, tR] = await Promise.all([
          fetch(`${api}/api/v1/presence/live?session_id=${sel}`, { cache: 'no-store' }),
          fetch(`${api}/api/v1/presence/alerts?session_id=${sel}`, { cache: 'no-store' }),
          fetch(`${api}/api/v1/presence/timeline?session_id=${sel}`, { cache: 'no-store' }),
        ]);
        if (canceled) return;
        if (lR.ok) setLive(await lR.json());
        if (aR.ok) { const j = await aR.json(); setAlerts(j.alerts || []); }
        if (tR.ok) { const j = await tR.json(); setTimeline(j.events || []); }
      } catch { /* */ }
      if (!canceled) setLoading(false);
    };
    void load();
    const iv = setInterval(load, 3000);
    return () => { canceled = true; clearInterval(iv); };
  }, [api, sel]);

  // Draw image + bounding boxes on canvas whenever live frame updates
  const renderCanvas = useCallback(() => {
    const frame = live?.frame;
    const canvas = canvasRef.current;
    if (!frame?.imagePath || !canvas) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => drawDetections(canvas, img, frame.detections || []);
    img.src = `${api}/${frame.imagePath}?t=${frame.receivedAt || Date.now()}`;
  }, [live?.frame]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  const ctrl: PresenceController | null = live?.controller ?? null;
  const frame: CameraFrame | null = live?.frame ?? null;
  const activity: ActivityStatus | null = live?.activity ?? null;
  const persons = (frame?.detections || []).filter(d => d.type === 'person');
  const tools = (frame?.detections || []).filter(d => d.type === 'tool');
  const curSession = sessions.find(s => s.sessionId === sel);

  const chartData = timeline.map(e => ({
    time: fmt(e.timestamp), score: Math.round((e.score || 0) * 100), active: e.active ? 1 : 0,
  }));

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="cs-card">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-heading)' }}>
              ESP32-CAM Presence Detection
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Live camera feed with YOLOv8 person &amp; tool detection + Edge Impulse TinyML presence analysis.
            </p>
          </div>
          <select value={sel} onChange={e => setSel(e.target.value)}
            className="rounded-xl border px-3 py-2 text-sm"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            {sessions.map(s => <option key={s.sessionId} value={s.sessionId}>{s.sessionName || s.sessionId}</option>)}
            {sessions.length === 0 && <option value="">No sessions</option>}
          </select>
        </div>
      </div>

      {loading && !live ? (
        <div className="cs-card text-center py-12"><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p></div>
      ) : (
        <>
          {/* ── Live Camera + AI Detection (full-width, like dummy website) ── */}
          <div className="cs-card">
            <div className="flex items-center justify-between">
              <p className="cs-card-header text-base">📷 Live Camera + AI Detection</p>
              <div className="flex gap-2">
                {/* Activity pill */}
                <span className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    background: activity?.active ? 'rgba(48,209,88,0.12)' : 'rgba(255,214,10,0.08)',
                    color: activity?.active ? '#30d158' : '#ffd60a',
                    border: `1px solid ${activity?.active ? 'rgba(48,209,88,0.3)' : 'rgba(255,214,10,0.3)'}`,
                  }}>
                  Activity: {activity?.active ? 'Cleaning Active' : 'Not Active'}
                  {activity?.score != null ? ` (${(activity.score * 100).toFixed(0)}%)` : ''}
                </span>
                {/* Presence pill */}
                <span className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    background: activity?.presenceStatus === 'no_person' ? 'rgba(255,69,58,0.12)' : 'rgba(48,209,88,0.12)',
                    color: activity?.presenceStatus === 'no_person' ? '#ff6961' : '#30d158',
                    border: `1px solid ${activity?.presenceStatus === 'no_person' ? 'rgba(255,69,58,0.3)' : 'rgba(48,209,88,0.3)'}`,
                  }}>
                  Presence: {activity?.presenceStatus === 'no_person' ? 'No Person' : activity?.presenceStatus === 'idle' ? 'Person Detected' : 'Unknown'}
                </span>
                {/* Model pill */}
                <span className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.14)' }}>
                  Model: {frame?.modelVersion || 'not configured'}
                </span>
              </div>
            </div>

            {/* Camera Canvas */}
            <div className="mt-4 relative overflow-hidden rounded-2xl border" style={{ borderColor: 'rgba(255,255,255,0.09)', background: 'rgba(0,0,0,0.45)', aspectRatio: '16/9', minHeight: '280px' }}>
              <canvas ref={canvasRef} className="w-full h-full object-contain" style={{ display: frame?.imagePath ? 'block' : 'none', background: '#000' }} />
              {!frame?.imagePath && (
                <div className="absolute inset-0 flex items-center justify-center text-center px-4">
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Waiting for camera frames. Start your ESP32-CAM and an active session to see live footage.
                  </p>
                </div>
              )}
            </div>

            {/* Camera Meta */}
            <p className="mt-3 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
              Device: {frame?.deviceId || '-'} · Room: {frame?.roomId || '-'} · Session: {frame?.sessionId || '-'} · Captured: {fmt(frame?.receivedAt)} · Inference: {frame?.latencyMs != null ? `${frame.latencyMs}ms` : 'pending'}
            </p>

            {/* Detection List */}
            <div className="mt-3 rounded-xl border p-3" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.22)', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              {(frame?.detections || []).length > 0
                ? (frame?.detections || []).map((d, i) => (
                    <div key={i}>{i + 1}. <strong style={{ color: detClr(d.type) }}>{d.label}</strong> [{d.type}] confidence={((d.confidence || 0) * 100).toFixed(1)}%</div>
                  ))
                : 'No objects detected in the latest frame.'}
            </div>
          </div>

          {/* ── Row 2: Session + Activity + Detection Summary ── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="cs-card">
              <p className="cs-card-header text-base">Session Status</p>
              <div className="mt-4 space-y-3">
                {[
                  ['Status', <span key="s" className="rounded-full px-3 py-1 text-xs font-semibold uppercase" style={{ background: `${statusClr(ctrl?.status)}20`, color: statusClr(ctrl?.status), border: `1px solid ${statusClr(ctrl?.status)}40` }}>{ctrl?.status || 'unknown'}</span>],
                  ['Room', ctrl?.roomId || curSession?.roomId || '-'],
                  ['Started', fmt(ctrl?.startTime || curSession?.startTime)],
                ].map(([label, val], i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="cs-card">
              <p className="cs-card-header text-base">Cleaning Activity</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Status</span>
                  <span className="rounded-full px-3 py-1 text-xs font-semibold uppercase" style={{ background: activity?.active ? 'rgba(102,220,152,0.14)' : 'rgba(255,122,111,0.14)', color: activity?.active ? '#66dc98' : '#ff7a6f' }}>
                    {activity?.active ? 'Cleaning' : 'Idle'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Score</span>
                  <span className="text-lg font-bold" style={{ color: 'var(--text-heading)' }}>{activity?.score != null ? `${Math.round(activity.score * 100)}%` : '-'}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full" style={{ background: 'rgba(148,163,184,0.12)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(activity?.score || 0) * 100}%`, background: activity?.active ? '#66dc98' : '#ffb454' }} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[['Person', activity?.personFrames], ['Tool', activity?.toolFrames], ['Co-occur', activity?.cooccurFrames]].map(([l, v]) => (
                    <div key={l as string}><p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{l}</p><p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{v ?? '-'}</p></div>
                  ))}
                </div>
              </div>
            </div>

            <div className="cs-card">
              <p className="cs-card-header text-base">Latest Detection</p>
              <div className="mt-4 space-y-3">
                {[
                  ['Persons Detected', persons.length, persons.length > 0 ? '#66dc98' : undefined],
                  ['Tools Detected', tools.length, tools.length > 0 ? '#5aa8ff' : undefined],
                  ['Inference Latency', frame?.latencyMs != null ? `${frame.latencyMs}ms` : '-'],
                  ['Frame Time', fmt(frame?.receivedAt)],
                ].map(([label, val, clr], i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label as string}</span>
                    <span className="text-sm font-bold" style={{ color: (clr as string) || 'var(--text-heading)' }}>{val as string}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Presence Alert Timeline ── */}
          <div className="cs-card">
            <div className="flex items-center justify-between">
              <p className="cs-card-header text-base">⚠️ Presence Alerts</p>
              <span className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>{alerts.length} alerts</span>
            </div>
            <div className="mt-4 max-h-[300px] space-y-2 overflow-y-auto pr-1">
              {alerts.length > 0 ? alerts.slice(0, 30).map(a => (
                <div key={a.key} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: `${presClr(a.event)}28`, background: `${presClr(a.event)}08` }}>
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: presClr(a.event), boxShadow: `0 0 12px ${presClr(a.event)}50` }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{(a.event || '').replace(/_/g, ' ')}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {fmt(a.timestamp)} · {a.deviceId || 'unknown'}{a.absenceMs ? ` · absent ${fmtDur(a.absenceMs)}` : ''}
                    </p>
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ background: `${presClr(a.event)}18`, color: presClr(a.event) }}>{a.source || 'edge'}</span>
                </div>
              )) : <p className="py-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>No presence alerts for this session.</p>}
            </div>
          </div>

          {/* ── Charts ── */}
          {timeline.length > 0 && ready && (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <section className="cs-card">
                <p className="cs-card-header text-base">Activity Score Over Time</p>
                <div className="mt-4 h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid stroke="rgba(148,163,184,0.14)" vertical={false} />
                      <XAxis dataKey="time" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.96)', border: '1px solid rgba(90,168,255,0.18)', borderRadius: '16px', color: '#f8fafc' }} />
                      <Legend />
                      <Line type="monotone" dataKey="score" name="Score (%)" stroke="#5aa8ff" strokeWidth={2.4} dot={{ r: 3, fill: '#5aa8ff' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="cs-card">
                <p className="cs-card-header text-base">Cleaning Active vs Idle</p>
                <div className="mt-4 h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid stroke="rgba(148,163,184,0.14)" vertical={false} />
                      <XAxis dataKey="time" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 1]} ticks={[0, 1]} tickFormatter={v => v === 1 ? 'Active' : 'Idle'} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.96)', border: '1px solid rgba(90,168,255,0.18)', borderRadius: '16px', color: '#f8fafc' }} formatter={(v: number) => [v === 1 ? 'Active' : 'Idle', 'Status']} />
                      <Bar dataKey="active" name="Status" radius={[6, 6, 0, 0]} fill="#66dc98" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          )}

          {/* No Data */}
          {!frame && !activity && alerts.length === 0 && timeline.length === 0 && (
            <div className="cs-card text-center py-12">
              <p className="text-lg font-semibold" style={{ color: 'var(--text-heading)' }}>No Presence Data Available</p>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Start the ESP32-CAM MQTT backend and run a session to see live detection here.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
