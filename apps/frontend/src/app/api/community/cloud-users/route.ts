import { NextResponse } from 'next/server';
import {
  CACHED_HEADERS,
  UNCACHED_HEADERS,
  rejectUnexpectedParams,
} from '@/app/api/community/publicProxy';

/**
 * Public cloud-user totals for the marketing "building in public" stats.
 *
 * Same reasoning as the sibling GitHub/Discord routes: this is a same-origin
 * proxy for a number that lives on another product surface (the SuperAdmin
 * panel's own SuperTokens-backed count), so the browser makes one same-origin
 * request instead of a cross-origin one to admin.yosemitecrew.com, and visitor
 * IPs never reach that panel directly.
 */

const CLOUD_USERS_ORIGIN = 'https://admin.yosemitecrew.com';
const CLOUD_USERS_ENDPOINT = `${CLOUD_USERS_ORIGIN}/api/cloud-users`;

export interface CloudUsersResponse {
  /** Localized total, e.g. '346'. Null when the upstream lookup failed. */
  totalUsers: string | null;
  /** ISO timestamp of the newest signup. Null when unknown or nobody has signed up. */
  latestSignupAt: string | null;
}

const EMPTY_RESPONSE: CloudUsersResponse = { totalUsers: null, latestSignupAt: null };

const readCloudUsers = (payload: unknown): CloudUsersResponse => {
  const { totalUsers, latestSignupAt } = payload as {
    totalUsers?: unknown;
    latestSignupAt?: unknown;
  };
  return {
    totalUsers: typeof totalUsers === 'number' ? totalUsers.toLocaleString('en-US') : null,
    latestSignupAt: typeof latestSignupAt === 'string' ? latestSignupAt : null,
  };
};

export async function GET(request: Request): Promise<NextResponse> {
  const rejected = rejectUnexpectedParams(request, {});
  if (rejected) return rejected;

  try {
    const res = await fetch(CLOUD_USERS_ENDPOINT, {
      headers: { Accept: 'application/json' },
      // Outcome-keyed caching only, via the response header below - see publicProxy.ts.
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json(EMPTY_RESPONSE, { headers: UNCACHED_HEADERS });

    const result = readCloudUsers(await res.json());
    // A resolved total is the signal this pass is usable; latestSignupAt alone
    // (or neither) is not worth caching a placeholder-shaped response for.
    return NextResponse.json(result, {
      headers: result.totalUsers !== null ? CACHED_HEADERS : UNCACHED_HEADERS,
    });
  } catch {
    return NextResponse.json(EMPTY_RESPONSE, { headers: UNCACHED_HEADERS });
  }
}
