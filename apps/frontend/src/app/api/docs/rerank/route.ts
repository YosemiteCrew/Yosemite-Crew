import { TextEncoder } from 'node:util';
import { NextResponse } from 'next/server';
import { rerankDocs } from '@/app/features/docs/searchReranker';

const MAX_QUERY_LENGTH = 200;
const MAX_BODY_LENGTH = 4096;
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_LENGTH) {
    return NextResponse.json({ order: null }, { status: 413, headers: NO_STORE });
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_LENGTH) {
      return NextResponse.json({ order: null }, { status: 413, headers: NO_STORE });
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ order: null }, { status: 400, headers: NO_STORE });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ order: null }, { status: 400, headers: NO_STORE });
  }

  const input = body as Record<string, unknown>;
  if (
    Object.keys(input).length !== 1 ||
    !Object.hasOwn(input, 'query') ||
    typeof input.query !== 'string' ||
    input.query.length > MAX_QUERY_LENGTH
  ) {
    return NextResponse.json({ order: null }, { status: 400, headers: NO_STORE });
  }

  const order = await rerankDocs(input.query);
  return NextResponse.json({ order }, { headers: NO_STORE });
}
