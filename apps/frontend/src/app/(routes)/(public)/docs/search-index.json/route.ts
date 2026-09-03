import { NextResponse } from 'next/server';
import { buildSearchIndex } from '@/app/features/docs/searchIndex';

/**
 * The documentation search index, prerendered at build time.
 *
 * `force-static` matters: without it this would run per request and read the
 * whole corpus off disk each time. The index is derived entirely from files
 * committed to the repo, so it can only change when the app is rebuilt.
 */
export const dynamic = 'force-static';

export function GET() {
  return NextResponse.json(buildSearchIndex(), {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
