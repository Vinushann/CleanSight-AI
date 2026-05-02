import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

type ReportEmailPayload = {
  reportMetrics?: Record<string, unknown>;
};

function sanitizeEmailBody(value: unknown): string {
  return String(value || '')
    .replace(/^```[\w-]*\s*/g, '')
    .replace(/\s*```$/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function buildPrompt(reportMetrics: Record<string, unknown>): string {
  return [
    'Write a polished professional client email for a cleaning completion report.',
    '',
    'Rules:',
    '- Use only the supplied report data.',
    '- Do not mention AI, ChatGPT, demos, prompts, JSON, dashboards, or internal systems.',
    '- Do not invent values, dates, improvements, or recommendations.',
    '- Keep the tone professional, reassuring, and client-ready.',
    '- Start with "Dear Client,".',
    '- End with "Regards," and "Fern Janitorial (Pvt) Ltd".',
    '- Return plain text only. No markdown. No subject line.',
    '- If the selected report has limited or no readings, explain that the selected report window did not contain recorded cleaning evidence in a polite business tone.',
    '',
    'Report metrics:',
    JSON.stringify(reportMetrics, null, 2),
  ].join('\n');
}

export async function POST(request: NextRequest) {
  const apiKey =
    process.env.OPENAI_API_KEY ||
    process.env.NEXT_OPENAI_API_KEY ||
    process.env.OPENAI_TTS_API_KEY;

  if (!apiKey) {
    return Response.json(
      { detail: 'OpenAI email drafting is not configured. Add OPENAI_API_KEY to the frontend environment.' },
      { status: 501 }
    );
  }

  let payload: ReportEmailPayload = {};
  try {
    payload = await request.json();
  } catch {
    return Response.json({ detail: 'Invalid email drafting request.' }, { status: 400 });
  }

  if (!payload.reportMetrics || typeof payload.reportMetrics !== 'object') {
    return Response.json({ detail: 'Report metrics are required.' }, { status: 400 });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_EMAIL_MODEL || process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'You write concise, polished business emails for cleaning-service clients. You are factual, clear, and professional.',
        },
        {
          role: 'user',
          content: buildPrompt(payload.reportMetrics),
        },
      ],
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text();
    return Response.json(
      { detail: detail || 'OpenAI email drafting request failed.' },
      { status: response.status }
    );
  }

  const completion = await response.json();
  const body = sanitizeEmailBody(completion?.choices?.[0]?.message?.content);

  if (!body) {
    return Response.json({ detail: 'OpenAI did not return an email body.' }, { status: 502 });
  }

  return Response.json({ body });
}
