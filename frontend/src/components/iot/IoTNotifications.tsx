'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, BellDot, Check, CheckCheck, TriangleAlert, XCircle } from 'lucide-react';

import { getApiBaseUrl } from '@/core/apiBase';
import type { IoTNotification } from '@/core/iotTypes';

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

function severityIcon(severity: string) {
  if (severity === 'critical') {
    return <XCircle size={15} style={{ color: '#ff8f86' }} />;
  }
  if (severity === 'warning') {
    return <TriangleAlert size={15} style={{ color: '#ffd27d' }} />;
  }
  return <Bell size={15} style={{ color: '#8fb7ff' }} />;
}

export default function IoTNotifications() {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<IoTNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const unreadCount = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    let canceled = false;

    const loadNotifications = async (showSpinner = false) => {
      try {
        if (showSpinner && !canceled) {
          setLoading(true);
        }
        const response = await fetch(`${apiBaseUrl}/api/iot/notifications`, { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.detail || 'Unable to load IoT notifications.');
        }
        if (!canceled) {
          setNotifications((payload.notifications || []) as IoTNotification[]);
          setError(null);
        }
      } catch (fetchError) {
        if (!canceled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Unable to load IoT notifications.');
        }
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    };

    void loadNotifications(true);
    const interval = window.setInterval(() => {
      void loadNotifications(false);
    }, 7000);

    return () => {
      canceled = true;
      window.clearInterval(interval);
    };
  }, [apiBaseUrl]);

  const markAsRead = async (notificationId: string) => {
    try {
      setBusyIds((prev) => ({ ...prev, [notificationId]: true }));
      const response = await fetch(`${apiBaseUrl}/api/iot/notifications/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notification_id: notificationId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || 'Unable to mark notification as read.');
      }
      setNotifications((prev) =>
        prev.map((item) => (item.notification_id === notificationId ? { ...item, read: true } : item))
      );
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to mark notification as read.');
    } finally {
      setBusyIds((prev) => ({ ...prev, [notificationId]: false }));
    }
  };

  const markAllRead = async () => {
    try {
      setIsMarkingAll(true);
      const response = await fetch(`${apiBaseUrl}/api/iot/notifications/read-all`, {
        method: 'POST',
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || 'Unable to mark all notifications as read.');
      }
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to mark all notifications as read.');
    } finally {
      setIsMarkingAll(false);
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border transition-colors"
        style={{
          background: 'var(--bg-card)',
          borderColor: open ? 'color-mix(in srgb, var(--accent-primary) 55%, transparent)' : 'var(--border-color)',
          color: 'var(--text-primary)',
          boxShadow: 'var(--card-shadow)',
        }}
        aria-label="Open IoT notifications"
      >
        {unreadCount > 0 ? <BellDot size={20} /> : <Bell size={20} />}
        {unreadCount > 0 ? (
          <span
            className="absolute -right-1 -top-1 min-w-5 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
            style={{ background: '#ff7a6f', color: '#fff' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 z-30 mt-3 w-[360px] max-w-[92vw] rounded-2xl border p-4"
          style={{
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 98%, #07111f 2%), color-mix(in srgb, var(--bg-card) 95%, #020712 5%))',
            borderColor: 'var(--border-color)',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.35)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                IoT Notifications
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Validation errors, duplicate readings, and other ingestion alerts.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={isMarkingAll || unreadCount === 0}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
              style={{
                background: unreadCount === 0 ? 'rgba(148,163,184,0.12)' : 'rgba(90,168,255,0.14)',
                color: unreadCount === 0 ? 'var(--text-muted)' : '#b9d6ff',
              }}
            >
              <CheckCheck size={14} />
              {isMarkingAll ? 'Updating...' : 'Mark all read'}
            </button>
          </div>

          {error ? (
            <div
              className="mt-3 rounded-xl px-3 py-2 text-xs"
              style={{ background: 'var(--badge-poor-bg)', color: 'var(--badge-poor-text)' }}
            >
              {error}
            </div>
          ) : null}

          <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {loading ? (
              <div className="rounded-xl border px-3 py-6 text-sm text-center" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                Loading notifications...
              </div>
            ) : notifications.length ? (
              notifications.map((notification) => (
                <div
                  key={notification.notification_id}
                  className="rounded-2xl border px-3 py-3"
                  style={{
                    borderColor: notification.read
                      ? 'rgba(148,163,184,0.14)'
                      : 'color-mix(in srgb, var(--accent-primary) 30%, var(--border-color))',
                    background: notification.read ? 'rgba(255,255,255,0.01)' : 'rgba(90,168,255,0.06)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5">{severityIcon(notification.severity)}</div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                          {notification.title}
                        </p>
                        <p className="mt-1 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                          {notification.message}
                        </p>
                      </div>
                    </div>
                    {!notification.read ? (
                      <button
                        type="button"
                        onClick={() => void markAsRead(notification.notification_id)}
                        disabled={busyIds[notification.notification_id]}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold"
                        style={{ background: 'rgba(83,212,139,0.14)', color: '#95f2ba' }}
                      >
                        <Check size={12} />
                        {busyIds[notification.notification_id] ? 'Saving...' : 'Read'}
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    <span className="rounded-full px-2 py-1" style={{ background: 'rgba(148,163,184,0.12)' }}>
                      {notification.category}
                    </span>
                    <span>{formatNotificationTime(notification.created_at)}</span>
                    {notification.session_id ? <span>Session: {notification.session_id}</span> : null}
                    {notification.device_id ? <span>Device: {notification.device_id}</span> : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border px-3 py-6 text-sm text-center" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                No IoT notifications yet.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
