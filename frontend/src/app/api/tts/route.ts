import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

function normalizeText(value: unknown): string {
  return String(value || '')
    .replace(/__CLEANSIGHT_CHART__[\s\S]*?__END_CLEANSIGHT_CHART__/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3800);
}

function voiceInstructions(language: string): string {
  if (language === 'ta') {
    return 'Speak naturally in Tamil with warm, clear, conversational pacing. Sound like a helpful human dashboard assistant, not robotic.';
  }
  if (language === 'si') {
    return 'Speak naturally in Sinhala with warm, clear, conversational pacing. Sound like a helpful human dashboard assistant, not robotic.';
  }
  return 'Speak in a warm, natural, human-like voice with clear pacing, friendly intonation, and a calm professional tone.';
}

export async function POST(request: NextRequest) {
  const apiKey =
    process.env.OPENAI_TTS_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.NEXT_OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { detail: 'OpenAI text-to-speech is not configured. Add OPENAI_API_KEY to the frontend environment.' },
      { status: 501 }
    );
  }

  let payload: { text?: unknown; language?: string } = {};
  try {
    payload = await request.json();
  } catch {
    return Response.json({ detail: 'Invalid text-to-speech request.' }, { status: 400 });
  }

  const text = normalizeText(payload.text);
  if (!text) {
    return Response.json({ detail: 'Text is required for speech.' }, { status: 400 });
  }

  const language = payload.language || 'en';
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
      voice: process.env.OPENAI_TTS_VOICE || 'marin',
      input: text,
      instructions: voiceInstructions(language),
      response_format: 'mp3',
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text();
    return Response.json(
      { detail: detail || 'OpenAI text-to-speech request failed.' },
      { status: response.status }
    );
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  });
}
