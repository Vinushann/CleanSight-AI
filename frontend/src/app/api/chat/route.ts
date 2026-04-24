import { NextRequest } from 'next/server';

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function buildCandidateBaseUrls(request: NextRequest): string[] {
  const fromEnv = process.env.BACKEND_SERVER_URL?.trim();
  const configured = fromEnv ? [normalizeBaseUrl(fromEnv)] : [];

  const hostHeader =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    '';
  const hostName = hostHeader.split(':')[0].trim();
  const hostBased = hostName ? [`http://${hostName}:8000`] : [];

  const defaults = ['http://127.0.0.1:8000', 'http://localhost:8000'];

  return Array.from(new Set([...configured, ...hostBased, ...defaults]));
}

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const bodyText = await request.text();
  const candidates = buildCandidateBaseUrls(request);
  const attempts: string[] = [];

  for (const baseUrl of candidates) {
    try {
      const backendResponse = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: bodyText,
        cache: 'no-store',
      });

      const contentType = backendResponse.headers.get('content-type') || 'text/plain; charset=utf-8';
      return new Response(backendResponse.body, {
        status: backendResponse.status,
        headers: {
          'Content-Type': contentType,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      attempts.push(`${baseUrl} -> ${message}`);
    }
  }

  try {
    const tried = attempts.join(' | ');
    return Response.json(
      {
        detail:
          `Chat proxy failed. Start backend with 'python -m app.main' in /backend. ` +
          `Tried: ${tried}`,
      },
      { status: 502 }
    );
  } catch {
    return Response.json({ detail: 'Chat proxy failed. Start backend with python -m app.main.' }, { status: 502 });
  }
}
