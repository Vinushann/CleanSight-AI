'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Message } from 'ai/react';
import { useChat } from 'ai/react';
import {
  Bot,
  ExternalLink,
  MessageSquarePlus,
  Plus,
  SendHorizontal,
  Sparkles,
  Square,
  UserRound,
  Volume2,
  X,
} from 'lucide-react';
import Link from 'next/link';
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
    if (message.role === 'assistant') {
      return {
        ...message,
        content: sanitizeAssistantContent(message.content),
      };
    }
    return message;
  });
}

function sanitizeAssistantContent(content: string): string {
  return content
    .replace(
      /\n\nNext demo step: ask me to visualize dust for a house and room, for example:\nplease visualize the dust in the house "fern" and room as "room1"/g,
      ''
    )
    .trim();
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

function stopBrowserSpeech() {
  window.speechSynthesis?.cancel();
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
  const isUser = role === 'user';
  const displayName = isUser ? 'You' : 'CleanSight AI';
  const displayText = role === 'assistant' ? sanitizeAssistantContent(parsed.text) : parsed.text;

  return (
    <div className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser ? (
        <div
          className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full"
          style={{
            background: 'var(--bg-input)',
            color: 'var(--accent-primary)',
            border: '1px solid var(--border-color)',
          }}
        >
          <Bot size={15} />
        </div>
      ) : null}

      <div className={`min-w-0 ${isUser ? 'max-w-[74%]' : 'max-w-[88%] flex-1'}`}>
        <div className={`mb-1 flex items-center gap-2 ${isUser ? 'justify-end' : 'justify-between'}`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
            {displayName}
          </p>
          {canSpeak ? (
            <button
              type="button"
              onClick={() => onSpeak(id, displayText)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition hover:opacity-80"
              style={{
                color: isSpeaking ? 'var(--accent-primary)' : 'var(--text-muted)',
                background: 'transparent',
                border: '1px solid transparent',
              }}
              aria-label={isSpeaking ? 'Stop reading assistant message' : 'Read assistant message aloud with AI-generated voice'}
              title={isSpeaking ? 'Stop reading' : 'Read aloud with AI voice'}
            >
              {isSpeaking ? <Square size={13} /> : <Volume2 size={14} />}
              <span className="hidden sm:inline">{isSpeaking ? 'Stop' : 'Voice'}</span>
            </button>
          ) : null}
        </div>

        <div
          className="rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap"
          style={{
            background: isUser
              ? 'var(--accent-primary)'
              : 'color-mix(in srgb, var(--bg-input) 78%, var(--bg-card) 22%)',
            color: isUser ? '#fff' : 'var(--text-primary)',
            border: isUser ? '1px solid var(--accent-primary)' : '1px solid var(--border-light)',
            boxShadow: 'none',
            borderTopRightRadius: isUser ? 6 : 18,
            borderTopLeftRadius: isUser ? 18 : 6,
          }}
        >
          {displayText}
          {role === 'assistant' && parsed.chart ? <ChatInlineChart chart={parsed.chart} /> : null}
        </div>
      </div>

      {isUser ? (
        <div
          className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full"
          style={{
            background: 'var(--bg-active)',
            color: 'var(--accent-primary)',
            border: '1px solid var(--border-active)',
          }}
        >
          <UserRound size={14} />
        </div>
      ) : null}
    </div>
  );
}

type DashboardChatPanelProps = {
  title?: string;
  onClose?: () => void;
  className?: string;
  showSessionSidebar?: boolean;
  showFullPageLink?: boolean;
};

export default function DashboardChatPanel({
  title = 'CleanSight AI',
  onClose,
  className = '',
  showSessionSidebar = false,
  showFullPageLink = false,
}: DashboardChatPanelProps) {
  const pathname = usePathname();
  const [sessions, setSessions] = useState<StoredChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [hasHydratedSessions, setHasHydratedSessions] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speechRequestRef = useRef(0);
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
      stopBrowserSpeech();
      audioRef.current?.pause();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
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

  const stopAudioPlayback = () => {
    speechRequestRef.current += 1;
    stopBrowserSpeech();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setSpeakingMessageId(null);
  };

  const createNewChat = () => {
    stop();
    stopAudioPlayback();

    const nextSession = createSession();
    setSessions((currentSessions) => [nextSession, ...currentSessions]);
    setActiveSessionId(nextSession.id);
    setInput('');
    setMessages(nextSession.messages);
  };

  const selectSession = (session: StoredChatSession) => {
    if (session.id === activeSessionId) return;

    stop();
    stopAudioPlayback();
    setActiveSessionId(session.id);
    setInput('');
    setMessages(session.messages);
  };

  const speakWithBrowserFallback = (messageId: string, speechText: string, speechLanguage: 'ta' | 'si' | 'en') => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSpeakingMessageId(null);
      return;
    }

    stopBrowserSpeech();
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

    window.speechSynthesis.speak(utterance);
  };

  const speakAssistantMessage = async (messageId: string, text: string) => {
    if (typeof window === 'undefined') return;

    if (speakingMessageId === messageId) {
      stopAudioPlayback();
      return;
    }

    const speechText = text.replace(/\s+/g, ' ').trim();
    if (!speechText) return;

    stopAudioPlayback();
    const requestId = speechRequestRef.current + 1;
    speechRequestRef.current = requestId;
    setSpeakingMessageId(messageId);
    const speechLanguage = detectSpeechLanguage(speechText);

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: speechText, language: speechLanguage }),
      });

      if (!response.ok) {
        throw new Error('OpenAI text-to-speech is unavailable.');
      }

      const audioBlob = await response.blob();
      if (speechRequestRef.current !== requestId) return;

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audioUrlRef.current = audioUrl;
      audio.onended = () => {
        if (audioRef.current === audio) {
          stopAudioPlayback();
        }
      };
      audio.onerror = () => {
        if (audioRef.current === audio) {
          stopAudioPlayback();
        }
      };
      await audio.play();
    } catch {
      if (speechRequestRef.current !== requestId) return;
      speakWithBrowserFallback(messageId, speechText, speechLanguage);
    }
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
      className={`h-full min-h-0 w-full rounded-2xl ${
        showSessionSidebar
          ? 'grid grid-rows-[auto_minmax(0,1fr)] gap-3 lg:grid-cols-[20rem_minmax(0,1fr)] lg:grid-rows-1'
          : 'flex flex-col'
      } ${className}`}
      style={{
        background: 'var(--bg-card)',
      }}
    >
      {showSessionSidebar ? (
        <aside
          className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl p-3"
          style={{
            background: 'color-mix(in srgb, var(--bg-input) 82%, var(--bg-card) 18%)',
            border: '1px solid var(--border-color)',
          }}
          aria-label="Chat history"
        >
          <button
            type="button"
            onClick={createNewChat}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:opacity-90"
            style={{
              background: 'var(--accent-primary)',
              color: '#fff',
              boxShadow: 'none',
            }}
          >
            <Plus size={16} />
            New chat
          </button>

          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>
            Recent conversations
          </p>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {sortedSessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const userMessageCount = session.messages.filter((message) => message.role === 'user').length;

              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => selectSession(session)}
                  className="w-full rounded-xl px-3 py-2.5 text-left transition hover:opacity-90"
                  style={{
                    background: isActive ? 'var(--bg-active)' : 'transparent',
                    border: `1px solid ${isActive ? 'var(--border-active)' : 'transparent'}`,
                    color: 'var(--text-primary)',
                    boxShadow: 'none',
                  }}
                >
                  <span className="line-clamp-2 block text-sm font-semibold leading-5">{session.title}</span>
                  <span className="mt-1 block text-xs" style={{ color: 'var(--text-muted)' }}>
                    {userMessageCount} message{userMessageCount === 1 ? '' : 's'} - {formatSessionTime(session.updatedAt)}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div
          className="mb-3 flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            boxShadow: 'none',
          }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
              style={{
                background: 'var(--bg-active)',
                color: 'var(--accent-primary)',
                border: '1px solid var(--border-active)',
              }}
            >
              <Sparkles size={17} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-tight" style={{ color: 'var(--text-heading)' }}>
                {title}
              </h2>
              <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                {activeSession?.title || 'Ask about cleaning sessions, charts, and reports'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {showFullPageLink ? (
              <Link
                href="/chatbot"
                className="rounded-xl p-2 transition hover:opacity-80"
                style={{
                  background: 'var(--bg-active)',
                  color: 'var(--accent-primary)',
                  border: '1px solid var(--border-active)',
                }}
                aria-label="Open full CleanSight AI page"
                title="Open full CleanSight AI page"
              >
                <ExternalLink size={18} />
              </Link>
            ) : null}
            {!showSessionSidebar ? (
              <button
                type="button"
                onClick={createNewChat}
                className="rounded-xl p-2 transition hover:opacity-80"
                style={{
                  background: 'var(--bg-active)',
                  color: 'var(--accent-primary)',
                  border: '1px solid var(--border-active)',
                }}
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
                className="rounded-xl p-2 transition hover:opacity-80"
                style={{ color: 'var(--text-muted)', background: 'var(--bg-input)' }}
                aria-label="Close chatbot"
              >
                <X size={18} />
              </button>
            ) : null}
          </div>
        </div>

        <div
          className="min-h-0 flex-1 space-y-4 overflow-y-auto rounded-2xl p-4"
          style={{
            background: 'color-mix(in srgb, var(--bg-input) 68%, var(--bg-card) 32%)',
            border: '1px solid var(--border-light)',
          }}
        >
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
              className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm"
              style={{
                background: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                boxShadow: 'none',
              }}
            >
              <span
                className="h-2 w-2 animate-pulse rounded-full"
                style={{ background: 'var(--accent-primary)' }}
              />
              CleanSight AI is thinking...
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

        <form
          onSubmit={onSubmit}
          className="mt-3 rounded-2xl p-2"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            boxShadow: 'none',
          }}
        >
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask CleanSight AI about trends, cleaned houses, reports..."
              className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90"
              style={{
                background: isLoading ? 'var(--border-light)' : 'var(--accent-primary)',
                color: isLoading ? 'var(--text-muted)' : '#fff',
                boxShadow: 'none',
              }}
            >
              <SendHorizontal size={16} />
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
