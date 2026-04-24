'use client';

import { FormEvent, useMemo, useState } from 'react';

import { getApiBaseUrl } from '@/core/apiBase';

type SessionType = 'before' | 'during' | 'after';

type ActiveSession = {
  session_id: string;
  house_id: string;
  room_id: string;
  session_type: SessionType;
};

type FieldErrors = {
  house_id?: string;
  room_id?: string;
  session_type?: string;
};

export default function IoTControlPage() {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const [houseId, setHouseId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [sessionType, setSessionType] = useState<SessionType | ''>('');

  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [statusMessage, setStatusMessage] = useState('Idle');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const hasActiveSession = useMemo(() => activeSession !== null, [activeSession]);

  const validateForm = () => {
    const errors: FieldErrors = {};

    if (!houseId.trim()) {
      errors.house_id = 'House ID is required.';
    }

    if (!roomId.trim()) {
      errors.room_id = 'Room ID is required.';
    }

    if (!sessionType) {
      errors.session_type = 'Session Type is required.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStartCollect = async (event: FormEvent) => {
    event.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (!validateForm()) {
      setStatusMessage('Validation failed');
      return;
    }

    try {
      setIsStarting(true);
      setStatusMessage('Starting collection session...');

      const response = await fetch(`${apiBaseUrl}/api/session/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          house_id: houseId.trim(),
          room_id: roomId.trim(),
          session_type: sessionType,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.detail || 'Failed to start collection session.');
      }

      const nextSession: ActiveSession = {
        session_id: payload.session_id,
        house_id: houseId.trim(),
        room_id: roomId.trim(),
        session_type: sessionType as SessionType,
      };

      setActiveSession(nextSession);
      setStatusMessage('Collecting');
      setSuccessMessage(`Session started successfully: ${payload.session_id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start collection session.';
      setErrorMessage(message);
      setStatusMessage('Start failed');
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopCollect = async () => {
    if (!activeSession) {
      return;
    }

    setSuccessMessage('');
    setErrorMessage('');

    try {
      setIsStopping(true);
      setStatusMessage('Stopping collection session...');

      const response = await fetch(`${apiBaseUrl}/api/session/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: activeSession.session_id,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.detail || 'Failed to stop collection session.');
      }

      setStatusMessage('Stopped');
      setSuccessMessage(`Session stopped successfully: ${activeSession.session_id}`);
      setActiveSession(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to stop collection session.';
      setErrorMessage(message);
      setStatusMessage('Stop failed');
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <section className="cs-card xl:col-span-2">
        <p className="cs-card-header text-base">IoT Sensor Data Collection Control</p>
        <form className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleStartCollect}>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>House ID</label>
            <input
              type="text"
              value={houseId}
              onChange={(event) => setHouseId(event.target.value)}
              className="rounded-lg px-3 py-2 text-sm"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
              placeholder="ex: H001"
              disabled={hasActiveSession || isStarting || isStopping}
            />
            {fieldErrors.house_id ? (
              <p className="text-xs" style={{ color: 'var(--badge-poor-text)' }}>{fieldErrors.house_id}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Room ID</label>
            <input
              type="text"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              className="rounded-lg px-3 py-2 text-sm"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
              placeholder="ex: R101"
              disabled={hasActiveSession || isStarting || isStopping}
            />
            {fieldErrors.room_id ? (
              <p className="text-xs" style={{ color: 'var(--badge-poor-text)' }}>{fieldErrors.room_id}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Session Type</label>
            <select
              value={sessionType}
              onChange={(event) => setSessionType(event.target.value as SessionType | '')}
              className="rounded-lg px-3 py-2 text-sm"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
              disabled={hasActiveSession || isStarting || isStopping}
            >
              <option value="">Select session stage</option>
              <option value="before">before</option>
              <option value="during">during</option>
              <option value="after">after</option>
            </select>
            {fieldErrors.session_type ? (
              <p className="text-xs" style={{ color: 'var(--badge-poor-text)' }}>{fieldErrors.session_type}</p>
            ) : null}
          </div>

          <div className="md:col-span-2 flex items-center gap-3 mt-2">
            <button
              type="submit"
              disabled={hasActiveSession || isStarting || isStopping}
              className="rounded-lg px-4 py-2 text-sm font-semibold"
              style={{
                background: hasActiveSession || isStarting || isStopping ? 'var(--border-light)' : 'var(--accent-primary)',
                color: hasActiveSession || isStarting || isStopping ? 'var(--text-muted)' : '#FFFFFF',
              }}
            >
              {isStarting ? 'Starting...' : 'Start Collect'}
            </button>

            <button
              type="button"
              onClick={handleStopCollect}
              disabled={!hasActiveSession || isStarting || isStopping}
              className="rounded-lg px-4 py-2 text-sm font-semibold"
              style={{
                background: !hasActiveSession || isStarting || isStopping ? 'var(--border-light)' : 'var(--badge-poor-text)',
                color: !hasActiveSession || isStarting || isStopping ? 'var(--text-muted)' : '#FFFFFF',
              }}
            >
              {isStopping ? 'Stopping...' : 'Stop Collect'}
            </button>
          </div>
        </form>

        {(successMessage || errorMessage) && (
          <div className="mt-4 space-y-2">
            {successMessage ? (
              <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--badge-good-bg)', color: 'var(--badge-good-text)' }}>
                {successMessage}
              </div>
            ) : null}
            {errorMessage ? (
              <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--badge-poor-bg)', color: 'var(--badge-poor-text)' }}>
                {errorMessage}
              </div>
            ) : null}
          </div>
        )}
      </section>

      <aside className="cs-card">
        <p className="cs-card-header text-base">Collection Status</p>
        <div className="space-y-2 text-sm mt-2">
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-secondary)' }}>Current Status</span>
            <span className="font-semibold" style={{ color: hasActiveSession ? 'var(--badge-good-text)' : 'var(--text-primary)' }}>
              {statusMessage}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-secondary)' }}>Active Session ID</span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {activeSession?.session_id || '-'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-secondary)' }}>House ID</span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {activeSession?.house_id || houseId || '-'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-secondary)' }}>Room ID</span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {activeSession?.room_id || roomId || '-'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-secondary)' }}>Session Type</span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {activeSession?.session_type || sessionType || '-'}
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}
