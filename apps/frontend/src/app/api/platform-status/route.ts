import { NextResponse } from 'next/server';

/**
 * Platform status for the footer, sidebar and phone shells.
 *
 * The public status API answers `operational` for a page that has nothing
 * configured to measure: with zero monitors and zero components it still
 * returns a green result, because "no incident open" is its default. Shown as
 * live platform health, that is a claim nobody verified (#2743).
 *
 * So `operational` is only passed through when the page's summary lists at
 * least one component that could have gone red. Any other status (an incident,
 * maintenance, an outage) is a positive report someone or something raised,
 * and is passed through as is. Everything else resolves to `unknown`, which the
 * UI renders as "Status unavailable".
 *
 * This runs server-side because the summary endpoint sends no CORS headers, so
 * the browser cannot read it; it also keeps the browser same-origin.
 */
const STATUS_API_URL = 'https://api.openstatus.dev/public/status/yosemite-crew';
const STATUS_SUMMARY_URL = 'https://yosemite-crew.openstatus.dev/api/status/summary.json';

const CACHE_TTL_SECONDS = 60;

export interface PlatformStatusResponse {
  status: string;
}

const fetchJson = async (url: string): Promise<unknown> => {
  try {
    // Uncached at the fetch layer for the same reason as the community routes:
    // Next's data cache keys on the request, not the outcome, so it would keep
    // replaying a failure. Only a real answer is cached, in the header below.
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

const readStatus = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') return null;
  const { status } = data as { status?: unknown };
  return typeof status === 'string' ? status : null;
};

const hasMonitoredComponents = (summary: unknown): boolean => {
  if (!summary || typeof summary !== 'object') return false;
  const { components } = summary as { components?: unknown };
  return Array.isArray(components) && components.length > 0;
};

const uncachedUnknown = () =>
  NextResponse.json({ status: 'unknown' }, { headers: { 'Cache-Control': 'no-store' } });

export async function GET(): Promise<NextResponse<PlatformStatusResponse>> {
  const [statusData, summary] = await Promise.all([
    fetchJson(STATUS_API_URL),
    fetchJson(STATUS_SUMMARY_URL),
  ]);
  const status = readStatus(statusData);

  // A failed lookup is not an answer, so it is cached nowhere and retried on the
  // next request. A green status whose evidence could not be read is the same.
  if (status === null) return uncachedUnknown();
  if (status === 'operational' && summary === null) return uncachedUnknown();

  // From here both answers are real, including "nothing is being measured".
  const reported =
    status === 'operational' && !hasMonitoredComponents(summary) ? 'unknown' : status;

  return NextResponse.json(
    { status: reported },
    {
      headers: {
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_TTL_SECONDS}`,
      },
    }
  );
}
