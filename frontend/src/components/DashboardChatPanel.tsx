'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Message } from 'ai/react';
import { useChat } from 'ai/react';
import { MessageSquarePlus, Plus, Square, Volume2, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useDashboardData } from '@/core/DashboardDataContext';

const chartPattern = /__CLEANSIGHT_CHART__([\s\S]*?)__END_CLEANSIGHT_CHART__/;
const CHAT_SESSIONS_STORAGE_KEY = 'cleansight.dashboard-chat.sessions.v1';
const ACTIVE_CHAT_SESSION_STORAGE_KEY = 'cleansight.dashboard-chat.active-session.v1';
const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Hi, I am CleanSight AI. I can list cleaned houses, visualize sensor trends, explain charts, compare sessions, investigate anomalies, and suggest next actions using current dashboard filters.',
};
const LEGACY_WELCOME_SNIPPETS = [
  'Hi, I am your CleanSight dashboard assistant.',
  'Hi, I am CleanSight Copilot.',
];

type ChatChartPayload = {
  type: 'line';
  metric: string;
  label: string;
  unit: string;
  points: Array<{ label: string; value: number; stage?: string; recorded_at?: string; timestamp_ms?: number }>;
  summary?: {
    house_id?: string;
    room_id?: string;
    points_count?: number;
    average?: number | null;
    min?: number | null;
    max?: number | null;
    first?: number;
    last?: number;
    delta?: number;
    direction?: string;
  };
};

type StoredChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
};

function pageToChart(page: string): string | null {
  if (page === '/modules/vishva') return 'dust_trend';
  if (page === '/modules/vishva/air-quality') return 'air_quality_trend';
  if (page === '/modules/ayathma') return 'temperature_trend';
  if (page === '/modules/ayathma/humidity') return 'humidity_trend';
  if (page === '/') return 'overview_summary';
  if (page === '/chatbot') return 'chat_analysis';
  return null;
}

function parseMessageContent(content: string): { text: string; chart: ChatChartPayload | null } {
  const match = content.match(chartPattern);
  if (!match) {
    return { text: content, chart: null };
  }

  try {
    const chart = JSON.parse(match[1]) as ChatChartPayload;
    return {
      text: content.replace(chartPattern, '').trim(),
      chart: Array.isArray(chart.points) && chart.points.length ? chart : null,
    };
  } catch {
    return { text: content.replace(chartPattern, '').trim(), chart: null };
  }
}

function createSession(): StoredChatSession {
  const now = new Date().toISOString();
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id,
    title: 'New chat',
    createdAt: now,
    updatedAt: now,
    messages: [WELCOME_MESSAGE],
  };
}

function loadStoredSessions(): StoredChatSession[] {
  if (typeof window === 'undefined') return [];

  try {
    const rawSessions = window.localStorage.getItem(CHAT_SESSIONS_STORAGE_KEY);
    const parsed = rawSessions ? (JSON.parse(rawSessions) as StoredChatSession[]) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((session) => session?.id && Array.isArray(session.messages))
      .map((session) => ({
        ...session,
        title: session.title || 'New chat',
        createdAt: session.createdAt || new Date().toISOString(),
        updatedAt: session.updatedAt || session.createdAt || new Date().toISOString(),
        messages: session.messages.length ? normalizeStoredMessages(session.messages) : [WELCOME_MESSAGE],
      }));
  } catch {
    return [];
  }
}

function normalizeStoredMessages(messages: Message[]): Message[] {
  return messages.map((message) => {
    if (
      message.id === 'welcome' ||
      LEGACY_WELCOME_SNIPPETS.some((snippet) => message.content.includes(snippet))
    ) {
      return WELCOME_MESSAGE;
    }
    return message;
  });
}

function deriveSessionTitle(messages: Message[], fallback: string): string {
  const firstUserMessage = messages.find((message) => message.role === 'user' && message.content.trim());
  if (!firstUserMessage) return fallback || 'New chat';

  const compactTitle = firstUserMessage.content.replace(/\s+/g, ' ').trim();
  return compactTitle.length > 44 ? `${compactTitle.slice(0, 41)}...` : compactTitle;
}

function formatSessionTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function detectSpeechLanguage(text: string): 'ta' | 'si' | 'en' {
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/[\u0D80-\u0DFF]/.test(text)) return 'si';
  return 'en';
}

function pickNaturalVoice(voices: SpeechSynthesisVoice[], language: 'ta' | 'si' | 'en'): SpeechSynthesisVoice | null {
  const preferredHints = [
    'siri',
    'natural',
    'neural',
    'premium',
    'enhanced',
    'online',
    'samantha',
    'victoria',
    'karen',
    'daniel',
    'google us english',
    'microsoft aria',
    'microsoft jenny',
    'microsoft ava',
    'microsoft guy',
    'moira',
    'rishi',
    'lekha',
    'veena',
  ];

  const languagePrefixes: Record<typeof language, string[]> = {
    en: ['en'],
    ta: ['ta', 'hi', 'en'],
    si: ['si', 'hi', 'en'],
  };

  const scoredVoices = voices
    .map((voice) => {
      const voiceName = voice.name.toLowerCase();
      const voiceLang = voice.lang.toLowerCase();
      const languageScore = languagePrefixes[language].reduce((score, prefix, index) => {
        if (score > 0 || !voiceLang.startsWith(prefix)) return score;
        return 120 - index * 25;
      }, 0);
      const qualityScore = preferredHints.reduce(
        (score, hint, index) => (voiceName.includes(hint) ? Math.max(score, 80 - index * 3) : score),
        0
      );
      const localPenalty = voice.localService ? 0 : 8;
      return { voice, score: languageScore + qualityScore + localPenalty };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  return scoredVoices[0]?.voice || voices[0] || null;
}

function chartTitle(chart: ChatChartPayload): string {
  if (chart.metric === 'dust') return 'Dust Sensor Visual Analytics Trend';
  if (chart.metric === 'air_quality') return 'Air Quality Visual Analytics Trend';
  if (chart.metric === 'temperature') return 'Temperature Visual Analytics Trend';
  if (chart.metric === 'humidity') return 'Humidity Visual Analytics Trend';
  return `${chart.label} Visual Analytics Trend`;
}

function metricStroke(metric: string): string {
  if (metric === 'dust') return '#087BF8';
  if (metric === 'air_quality') return '#16A34A';
  if (metric === 'temperature') return '#EA580C';
  if (metric === 'humidity') return '#0891B2';
  return 'var(--accent-primary)';
}

function stageColor(stage?: string): string {
  if (stage === 'before') return '#F5C400';
  if (stage === 'during') return '#D93255';
  if (stage === 'after') return '#2FB344';
  return '#087BF8';
}

function formatSummaryValue(value: number | null | undefined, unit: string): string {
  return typeof value === 'number' ? `${value.toFixed(2)} ${unit}` : '-';
}

function ChatInlineChart({ chart }: { chart: ChatChartPayload }) {
  const stroke = metricStroke(chart.metric);
  const hasManyPoints = chart.points.length > 18;
  const summaryItems = [
    { label: 'Average', value: formatSummaryValue(chart.summary?.average, chart.unit) },
    { label: 'Min', value: formatSummaryValue(chart.summary?.min, chart.unit) },
    { label: 'Max', value: formatSummaryValue(chart.summary?.max, chart.unit) },
    { label: 'Points', value: String(chart.summary?.points_count || chart.points.length) },
  ];

  return (
    <div
      className="mt-3 rounded-2xl p-4"
      style={{
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, white 6%) 0%, var(--bg-card) 100%)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-card)',
      }}
      aria-label={`${chart.label} trend chart`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p
            className="text-[12px] font-black uppercase tracking-[0.14em]"
            style={{ color: 'var(--text-heading)' }}
          >
            {chartTitle(chart)}
          </p>
          {chart.summary?.house_id || chart.summary?.room_id ? (
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              {chart.summary?.house_id || 'Selected house'} / {chart.summary?.room_id || 'selected room'}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {['before', 'during', 'after'].map((stage) => (
            <span
              key={stage}
              className="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
              style={{
                background: `${stageColor(stage)}22`,
                color: stageColor(stage),
                border: `1px solid ${stageColor(stage)}55`,
              }}
            >
              {stage}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className="rounded-xl px-3 py-2"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              {item.label}
            </p>
            <p className="mt-1 text-sm font-black" style={{ color: 'var(--text-heading)' }}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="h-[340px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chart.points} margin={{ top: 8, right: 20, bottom: hasManyPoints ? 34 : 18, left: 4 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="var(--chart-grid)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
              tickLine={{ stroke: 'var(--border-color)' }}
              axisLine={{ stroke: 'var(--text-muted)' }}
              minTickGap={18}
              label={{
                value: 'Time',
                position: 'insideBottom',
                offset: hasManyPoints ? -28 : -8,
                fill: 'var(--text-muted)',
                fontSize: 12,
              }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
              tickLine={{ stroke: 'var(--border-color)' }}
              axisLine={{ stroke: 'var(--text-muted)' }}
              width={58}
              label={{
                value: chart.metric === 'dust' ? 'Dust concentration' : chart.label,
                angle: -90,
                position: 'insideLeft',
                fill: 'var(--text-muted)',
                fontSize: 12,
              }}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 12,
                color: 'var(--text-primary)',
                boxShadow: 'var(--shadow-card)',
              }}
              labelStyle={{ color: 'var(--text-heading)', fontWeight: 800 }}
              formatter={(value, _name, payload) => [
                `${Number(value).toFixed(2)} ${chart.unit}`,
                `${chart.label}${payload?.payload?.stage ? ` (${payload.payload.stage})` : ''}`,
              ]}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={`${chart.label} (${chart.unit})`}
              stroke={stroke}
              strokeWidth={3.2}
              dot={(props) => {
                const payload = props.payload as { stage?: string };
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={props.index % 8 === 0 ? 3 : 0}
                    fill={stageColor(payload?.stage)}
                    stroke="var(--bg-card)"
                    strokeWidth={1.5}
                  />
                );
              }}
              activeDot={{ r: 6, fill: stroke, stroke: '#fff', strokeWidth: 2 }}
            />
            {hasManyPoints ? (
              <Brush
                dataKey="label"
                height={22}
                travellerWidth={9}
                stroke={stroke}
                fill="color-mix(in srgb, var(--bg-active) 70%, transparent)"
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChatMessageBubble({
  id,
  role,
  content,
  isSpeaking,
  onSpeak,
}: {
  id: string;
  role: string;
  content: string;
  isSpeaking: boolean;
  onSpeak: (messageId: string, text: string) => void;
}) {
  const parsed = parseMessageContent(content);
  const canSpeak = role === 'assistant' && parsed.text.trim().length > 0;

  return (
    <div
      className="rounded-lg px-3 py-2 text-sm whitespace-pre-wrap"
      style={{
        background: role === 'user' ? 'var(--bg-active)' : 'var(--bg-input)',
        color: 'var(--text-primary)',
      }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          {role}
        </p>
        {canSpeak ? (
          <button
            type="button"
            onClick={() => onSpeak(id, parsed.text)}
            className="rounded-full p-1 transition hover:scale-105"
            style={{
              color: isSpeaking ? 'var(--accent-primary)' : 'var(--text-muted)',
              background: isSpeaking ? 'var(--bg-card)' : 'transparent',
            }}
            aria-label={isSpeaking ? 'Stop reading assistant message' : 'Read assistant message aloud'}
            title={isSpeaking ? 'Stop reading' : 'Read aloud'}
          >
            {isSpeaking ? <Square size={14} /> : <Volume2 size={15} />}
          </button>
        ) : null}
      </div>
      {parsed.text}
      {role === 'assistant' && parsed.chart ? <ChatInlineChart chart={parsed.chart} /> : null}
    </div>
  );
}

type DashboardChatPanelProps = {
  title?: string;
  onClose?: () => void;
  className?: string;
  showSessionSidebar?: boolean;
};

export default function DashboardChatPanel({
  title = 'CleanSight AI',
  onClose,
  className = '',
  showSessionSidebar = false,
}: DashboardChatPanelProps) {
  const pathname = usePathname();
  const [sessions, setSessions] = useState<StoredChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [hasHydratedSessions, setHasHydratedSessions] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const {
    selectedHouseId,
    selectedRoomId,
    selectedSessionType,
    selectedDate,
    selectedDateTo,
    appliedHouseId,
    appliedRoomId,
    appliedSessionType,
    appliedDate,
    appliedDateTo,
  } = useDashboardData();

  const dashboardContext = useMemo(() => {
    const houseId = appliedHouseId || selectedHouseId || null;
    const roomId = appliedRoomId || selectedRoomId || null;
    const sessionType = appliedSessionType || selectedSessionType || null;
    const dateFrom = appliedDate || selectedDate || null;
    const dateTo = appliedDateTo || selectedDateTo || dateFrom;
    return {
      house_id: houseId,
      room_id: roomId,
      session_type: sessionType === 'all' ? null : sessionType,
      date_range: dateFrom || dateTo ? { from: dateFrom, to: dateTo } : null,
      selected_page: pathname,
      selected_chart: pageToChart(pathname),
      filters: {
        session_type: sessionType,
        date_from: dateFrom,
        date_to: dateTo,
      },
    };
  }, [
    pathname,
    selectedHouseId,
    selectedRoomId,
    selectedSessionType,
    selectedDate,
    selectedDateTo,
    appliedHouseId,
    appliedRoomId,
    appliedSessionType,
    appliedDate,
    appliedDateTo,
  ]);

  const { messages, input, isLoading, error, setInput, setMessages, append, stop } = useChat({
    api: '/api/chat',
    id: 'cleansight-dashboard-chat',
    streamProtocol: 'text',
    initialMessages: [WELCOME_MESSAGE],
  });

  useEffect(() => {
    const storedSessions = loadStoredSessions();
    const nextSessions = storedSessions.length ? storedSessions : [createSession()];
    const storedActiveSessionId = window.localStorage.getItem(ACTIVE_CHAT_SESSION_STORAGE_KEY);
    const nextActiveSession =
      nextSessions.find((session) => session.id === storedActiveSessionId) || nextSessions[0];

    setSessions(nextSessions);
    setActiveSessionId(nextActiveSession.id);
    setInput('');
    setMessages(nextActiveSession.messages);
    setHasHydratedSessions(true);
  }, [setInput, setMessages]);

  useEffect(() => {
    if (!hasHydratedSessions) return;
    window.localStorage.setItem(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  }, [hasHydratedSessions, sessions]);

  useEffect(() => {
    if (!hasHydratedSessions || !activeSessionId) return;
    window.localStorage.setItem(ACTIVE_CHAT_SESSION_STORAGE_KEY, activeSessionId);
  }, [activeSessionId, hasHydratedSessions]);

  useEffect(() => {
    if (!hasHydratedSessions || !activeSessionId) return;

    setSessions((currentSessions) =>
      currentSessions.map((session) => {
        if (session.id !== activeSessionId) return session;

        return {
          ...session,
          title: deriveSessionTitle(messages, session.title),
          updatedAt: new Date().toISOString(),
          messages,
        };
      })
    );
  }, [activeSessionId, hasHydratedSessions, messages]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      setAvailableVoices(window.speechSynthesis.getVoices());
    };

    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      window.speechSynthesis.cancel();
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  const chatErrorMessage = useMemo(() => {
    if (!error?.message) return '';
    if (error.message.includes('Failed to fetch')) {
      return 'Unable to reach frontend API route. Restart frontend and try again.';
    }
    try {
      const parsed = JSON.parse(error.message);
      if (typeof parsed?.detail === 'string') {
        return parsed.detail;
      }
    } catch (_ignored) {
      // Keep original error text when message is not JSON.
    }
    return error.message;
  }, [error?.message]);

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort(
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      ),
    [sessions]
  );

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId),
    [activeSessionId, sessions]
  );

  const createNewChat = () => {
    stop();
    window.speechSynthesis?.cancel();
    setSpeakingMessageId(null);

    const nextSession = createSession();
    setSessions((currentSessions) => [nextSession, ...currentSessions]);
    setActiveSessionId(nextSession.id);
    setInput('');
    setMessages(nextSession.messages);
  };

  const selectSession = (session: StoredChatSession) => {
    if (session.id === activeSessionId) return;

    stop();
    window.speechSynthesis?.cancel();
    setSpeakingMessageId(null);
    setActiveSessionId(session.id);
    setInput('');
    setMessages(session.messages);
  };

  const speakAssistantMessage = (messageId: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (speakingMessageId === messageId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const speechText = text.replace(/\s+/g, ' ').trim();
    const speechLanguage = detectSpeechLanguage(speechText);
    const utterance = new SpeechSynthesisUtterance(speechText);
    const naturalVoice = pickNaturalVoice(availableVoices, speechLanguage);
    if (naturalVoice) {
      utterance.voice = naturalVoice;
      utterance.lang = naturalVoice.lang;
    } else {
      utterance.lang = speechLanguage === 'ta' ? 'ta-IN' : speechLanguage === 'si' ? 'si-LK' : 'en-US';
    }
    utterance.rate = speechLanguage === 'en' ? 0.9 : 0.82;
    utterance.pitch = speechLanguage === 'en' ? 1.08 : 1.02;
    utterance.volume = 1;
    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    setSpeakingMessageId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim()) return;
    const question = input;
    setInput('');
    await append(
      { role: 'user', content: question },
      {
        body: {
          dashboard_context: dashboardContext,
        },
      }
    );
  };

  return (
    <div
      className={`h-full min-h-0 ${
        showSessionSidebar ? 'flex flex-col gap-3 lg:flex-row' : 'flex flex-col'
      } ${className}`}
    >
      {showSessionSidebar ? (
        <aside
          className="min-h-0 rounded-xl p-3 lg:w-72 lg:shrink-0"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
          aria-label="Chat history"
        >
          <button
            type="button"
            onClick={createNewChat}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
            style={{ background: 'var(--accent-primary)', color: '#fff' }}
          >
            <Plus size={16} />
            New chat
          </button>

          <div className="max-h-40 space-y-2 overflow-y-auto pr-1 lg:max-h-none">
            {sortedSessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const userMessageCount = session.messages.filter((message) => message.role === 'user').length;

              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => selectSession(session)}
                  className="w-full rounded-lg px-3 py-2 text-left transition hover:scale-[1.01]"
                  style={{
                    background: isActive ? 'var(--bg-active)' : 'var(--bg-card)',
                    border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    color: 'var(--text-primary)',
                  }}
                >
                  <span className="line-clamp-1 block text-sm font-semibold">{session.title}</span>
                  <span className="mt-1 block text-xs" style={{ color: 'var(--text-muted)' }}>
                    {userMessageCount} message{userMessageCount === 1 ? '' : 's'} - {formatSessionTime(session.updatedAt)}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className="mb-2 flex items-center justify-between gap-2 pb-2"
          style={{ borderBottom: '1px solid var(--border-color)' }}
        >
          <div className="min-w-0">
            <h2 className="font-semibold" style={{ color: 'var(--text-heading)' }}>
              {title}
            </h2>
            {activeSession ? (
              <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                {activeSession.title}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {!showSessionSidebar ? (
              <button
                type="button"
                onClick={createNewChat}
                className="rounded-lg p-2"
                style={{ background: 'var(--bg-input)', color: 'var(--accent-primary)' }}
                aria-label="Create new chat"
                title="New chat"
              >
                <MessageSquarePlus size={18} />
              </button>
            ) : null}
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                style={{ color: 'var(--text-muted)' }}
                aria-label="Close chatbot"
              >
                <X size={18} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.map((message) => (
            <ChatMessageBubble
              key={message.id}
              id={message.id}
              role={message.role}
              content={message.content}
              isSpeaking={speakingMessageId === message.id}
              onSpeak={speakAssistantMessage}
            />
          ))}
          {isLoading && (
            <div
              className="rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}
            >
              Assistant is thinking...
            </div>
          )}
          {error && (
            <div
              className="rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--badge-poor-bg)', color: 'var(--badge-poor-text)' }}
            >
              Chat error: {chatErrorMessage}
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border-color)' }}>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about trends, anomalies, comparisons..."
              className="flex-1 rounded-lg px-3 py-2 text-sm"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-lg px-3 py-2 text-sm font-semibold"
              style={{
                background: isLoading ? 'var(--border-light)' : 'var(--accent-primary)',
                color: isLoading ? 'var(--text-muted)' : '#fff',
              }}
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
