'use client';

import { useMemo } from 'react';
import { useChat } from 'ai/react';
import { X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useDashboardData } from '@/core/DashboardDataContext';

const chartPattern = /__CLEANSIGHT_CHART__(.*?)__END_CLEANSIGHT_CHART__/s;

type ChatChartPayload = {
  type: 'line';
  metric: string;
  label: string;
  unit: string;
  points: Array<{ label: string; value: number; stage?: string }>;
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

function ChatInlineChart({ chart }: { chart: ChatChartPayload }) {
  return (
    <div
      className="mt-3 h-44 rounded-md p-2"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
      aria-label={`${chart.label} trend chart`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chart.points} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={42} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="value"
            name={`${chart.label} (${chart.unit})`}
            stroke="var(--accent-primary)"
            strokeWidth={2.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChatMessageBubble({ role, content }: { role: string; content: string }) {
  const parsed = parseMessageContent(content);

  return (
    <div
      className="rounded-lg px-3 py-2 text-sm whitespace-pre-wrap"
      style={{
        background: role === 'user' ? 'var(--bg-active)' : 'var(--bg-input)',
        color: 'var(--text-primary)',
      }}
    >
      <p className="text-[10px] mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {role}
      </p>
      {parsed.text}
      {role === 'assistant' && parsed.chart ? <ChatInlineChart chart={parsed.chart} /> : null}
    </div>
  );
}

type DashboardChatPanelProps = {
  title?: string;
  onClose?: () => void;
  className?: string;
};

export default function DashboardChatPanel({
  title = 'Dashboard Assistant',
  onClose,
  className = '',
}: DashboardChatPanelProps) {
  const pathname = usePathname();
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

  const { messages, input, isLoading, error, setInput, append } = useChat({
    api: '/api/chat',
    streamProtocol: 'text',
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content:
          'Hi, I am your CleanSight dashboard assistant. I can explain trends, compare sessions, investigate anomalies, and suggest next actions using current dashboard filters.',
      },
    ],
  });

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
    <div className={`h-full flex flex-col ${className}`}>
      <div className="flex items-center justify-between pb-2 mb-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <h2 className="font-semibold" style={{ color: 'var(--text-heading)' }}>{title}</h2>
        {onClose ? (
          <button type="button" onClick={onClose} style={{ color: 'var(--text-muted)' }} aria-label="Close chatbot">
            <X size={18} />
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-3">
        {messages.map((message) => (
          <ChatMessageBubble key={message.id} role={message.role} content={message.content} />
        ))}
        {isLoading && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
            Assistant is thinking...
          </div>
        )}
        {error && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--badge-poor-bg)', color: 'var(--badge-poor-text)' }}>
            Chat error: {chatErrorMessage}
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="pt-2 mt-2" style={{ borderTop: '1px solid var(--border-color)' }}>
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
  );
}
