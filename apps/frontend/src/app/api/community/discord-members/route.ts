import { NextResponse } from 'next/server';

/**
 * Public Discord member count for the marketing surfaces (nav, footer, About,
 * Insights).
 *
 * This lives in the web app rather than being read from the product API for
 * three reasons, each of which has broken the number on the live site before:
 *
 *  - Same-origin. The browser calls `/api/...`, which `connect-src 'self'`
 *    already allows and which needs no CORS negotiation with the API domain.
 *  - No env var in the URL. Building the product-API URL by concatenating
 *    `NEXT_PUBLIC_BASE_URL` breaks whenever that value's trailing slash
 *    changes between environments.
 *  - No credentials and no session interceptor. This is public data; routing it
 *    through the authenticated axios client meant a 401 could bounce a visitor
 *    on a public page to the sign-in screen.
 *
 * It also keeps visitors' IPs out of Discord's hands: the lookup is made by the
 * server, never by the browser.
 */

// Both codes resolve to the same guild. Order matters: the first one to return a
// count wins. The raw invite code is primary - it is what the READMEs, dev-docs
// and issue templates publish, and it does not expire. The `yosemitecrew` vanity
// slug (used by the site footer and marketing assets) is only the fallback,
// because a vanity URL stops resolving if the guild loses its boost level.
const DISCORD_INVITE_CODES = ['SwM6mX85KD', 'yosemitecrew'];

// Discord requires a descriptive User-Agent on API calls and rate-limits or
// rejects generic ones.
const DISCORD_USER_AGENT = 'DiscordBot (https://www.yosemitecrew.com, 1.0)';

const CACHE_TTL_SECONDS = 300;

export interface DiscordMembersResponse {
  /** Localized member count, e.g. '1,204'. Null when the lookup failed. */
  discordMembers: string | null;
}

const readMemberCount = (invite: unknown): string | null => {
  if (!invite || typeof invite !== 'object') return null;
  const { approximate_member_count: count } = invite as { approximate_member_count?: number };
  if (typeof count !== 'number') return null;
  return count.toLocaleString('en-US');
};

const fetchMemberCount = async (inviteCode: string): Promise<string | null> => {
  try {
    const response = await fetch(
      `https://discord.com/api/v10/invites/${inviteCode}?with_counts=true&with_expiration=true`,
      {
        headers: { Accept: 'application/json', 'User-Agent': DISCORD_USER_AGENT },
        // Deliberately uncached at the fetch layer. Next's data cache keys on the
        // request, not the outcome, so `revalidate` here would also cache a 200
        // that carries no member count (or malformed JSON) and keep replaying it
        // for the whole TTL after Discord recovered. Only a parsed count is
        // cached, and that happens below.
        cache: 'no-store',
      }
    );
    if (!response.ok) return null;
    return readMemberCount(await response.json());
  } catch {
    return null;
  }
};

/**
 * Last successfully parsed count. Only successes land here, so a failed or
 * malformed upstream response can never be served from cache - the next request
 * retries Discord immediately. Per server instance, like the equivalent cache in
 * the backend's DiscordMembersService.
 */
let cached: { count: string; at: number } | null = null;

const readCached = (now: number): string | null =>
  cached && now - cached.at < CACHE_TTL_SECONDS * 1000 ? cached.count : null;

export async function GET(): Promise<NextResponse<DiscordMembersResponse>> {
  const now = Date.now();
  const successHeaders = {
    'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_TTL_SECONDS}`,
  };

  const fresh = readCached(now);
  if (fresh !== null) {
    return NextResponse.json({ discordMembers: fresh }, { headers: successHeaders });
  }

  for (const inviteCode of DISCORD_INVITE_CODES) {
    const discordMembers = await fetchMemberCount(inviteCode);
    if (discordMembers !== null) {
      cached = { count: discordMembers, at: now };
      return NextResponse.json({ discordMembers }, { headers: successHeaders });
    }
  }

  // 200 with a null count, not an error status: the caller treats a missing
  // count as "contribute nothing this pass" and keeps its loading placeholder.
  // Nothing about a failure is cached, at this layer or any other.
  return NextResponse.json({ discordMembers: null }, { headers: { 'Cache-Control': 'no-store' } });
}
