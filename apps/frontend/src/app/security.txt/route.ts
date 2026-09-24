/**
 * The RFC 9116 contact file, served at /security.txt and, through the rewrite
 * in next.config.ts, at /.well-known/security.txt. It lives here rather than
 * under an `app/.well-known` folder because the type-checker skips dot folders.
 *
 * Built per request so `Expires` is always a year ahead: a fixed date in a
 * static file would lapse unless someone remembered to renew it.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const REPOSITORY = 'https://github.com/YosemiteCrew/Yosemite-Crew';
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function GET() {
  const expires = new Date(Date.now() + ONE_YEAR_MS).toISOString();
  const body = [
    `Contact: ${REPOSITORY}/security/advisories/new`,
    'Contact: mailto:security@yosemitecrew.com',
    `Expires: ${expires}`,
    `Policy: ${REPOSITORY}/blob/main/SECURITY.md`,
    'Preferred-Languages: en',
    '',
  ].join('\n');

  return new NextResponse(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
