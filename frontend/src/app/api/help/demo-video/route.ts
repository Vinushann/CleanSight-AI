import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

import { NextRequest, NextResponse } from 'next/server';

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function buildCandidateBaseUrls(request: NextRequest): string[] {
  const fromEnv = process.env.BACKEND_SERVER_URL?.trim() || process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const configured = fromEnv ? [normalizeBaseUrl(fromEnv)] : [];

  const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const hostName = hostHeader.split(':')[0].trim();
  const hostBased = hostName ? [`http://${hostName}:8000`] : [];

  const defaults = ['http://127.0.0.1:8000', 'http://localhost:8000'];

  return Array.from(new Set([...configured, ...hostBased, ...defaults]));
}

export const runtime = 'nodejs';

const localDemoVideoPaths = [
  path.resolve(process.cwd(), '..', 'backend', 'data', 'Demo Video', 'CleanSightAI Demo.mp4'),
  path.resolve(process.cwd(), 'backend', 'data', 'Demo Video', 'CleanSightAI Demo.mp4'),
];

type ByteRange = {
  start: number;
  end: number;
};

function parseRangeHeader(rangeHeader: string | null, size: number): ByteRange | null {
  if (!rangeHeader) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) {
    return null;
  }

  const startText = match[1];
  const endText = match[2];

  if (!startText && !endText) {
    return null;
  }

  if (!startText) {
    const suffixLength = Number(endText);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }

    return {
      start: Math.max(size - suffixLength, 0),
      end: size - 1,
    };
  }

  const start = Number(startText);
  if (!Number.isFinite(start) || start < 0 || start >= size) {
    return null;
  }

  const end = endText ? Number(endText) : size - 1;
  if (!Number.isFinite(end) || end < start) {
    return null;
  }

  return {
    start,
    end: Math.min(end, size - 1),
  };
}

async function tryServeLocalVideo(request: NextRequest, headOnly = false): Promise<Response | null> {
  try {
    let selectedPath: string | null = null;
    let fileStats = null as Awaited<ReturnType<typeof stat>> | null;

    for (const candidatePath of localDemoVideoPaths) {
      try {
        const candidateStats = await stat(candidatePath);
        if (candidateStats.isFile()) {
          selectedPath = candidatePath;
          fileStats = candidateStats;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!selectedPath || !fileStats) {
      return null;
    }

    const fileSize = Number(fileStats.size);
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return null;
    }

    const rangeHeader = request.headers.get('range');
    const range = parseRangeHeader(rangeHeader, fileSize);

    const headers = new Headers({
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
      'Content-Type': 'video/mp4',
    });

    if (rangeHeader && !range) {
      headers.set('Content-Range', `bytes */${fileSize}`);
      return new Response(null, { status: 416, headers });
    }

    const start = range?.start ?? 0;
    const end = range?.end ?? fileSize - 1;
    headers.set('Content-Length', String(end - start + 1));

    if (headOnly) {
      if (range) {
        headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        return new Response(null, { status: 206, headers });
      }

      return new Response(null, { status: 200, headers });
    }

    const nodeStream = createReadStream(selectedPath, { start, end });
    const body = Readable.toWeb(nodeStream) as ReadableStream;

    if (range) {
      headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      return new Response(body, { status: 206, headers });
    }

    return new Response(body, { status: 200, headers });
  } catch {
    return null;
  }
}

export async function HEAD(request: NextRequest) {
  const localResponse = await tryServeLocalVideo(request, true);
  if (localResponse) {
    return localResponse;
  }

  const fallback = await proxyDemoVideoRedirect(request);
  return new Response(null, { status: fallback.status, headers: fallback.headers });
}

export async function GET(request: NextRequest) {
  const localResponse = await tryServeLocalVideo(request);
  if (localResponse) {
    return localResponse;
  }

  return proxyDemoVideoRedirect(request);
}

async function proxyDemoVideoRedirect(request: NextRequest) {
  const videoPath = '/assets/help-demo/CleanSightAI%20Demo.mp4';

  for (const baseUrl of buildCandidateBaseUrls(request)) {
    const targetUrl = `${baseUrl}${videoPath}`;

    try {
      const response = await fetch(targetUrl, { method: 'HEAD', cache: 'no-store' });
      if (response.ok) {
        return NextResponse.redirect(new URL(targetUrl), 307);
      }
    } catch {
      continue;
    }
  }

  return Response.json(
    { detail: 'Demo video is unavailable. Start the backend and confirm the mp4 exists in backend/data/Demo Video.' },
    { status: 404 }
  );
}